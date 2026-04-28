import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../lib/prisma';
import { monnifyService, verifyWebhookSignature } from '../payments/monnify.service';

// Withdrawal fee configuration
const MONNIFY_FEE = 35; // Monnify transfer fee
const VENDR_FEE = 25; // Vendr platform fee
const TOTAL_FEE = MONNIFY_FEE + VENDR_FEE;

/**
 * Get user's wallet balance
 */
export async function getWalletBalance(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    
    const wallet = await prisma.wallet.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      // Create wallet if doesn't exist
      const newWallet = await prisma.wallet.create({
        data: {
          user_id: userId,
          available_balance: 0,
          frozen_balance: 0,
          currency: 'NGN',
        },
      });
      return reply.status(200).send({
        success: true,
        data: {
          available_balance: newWallet.available_balance,
          frozen_balance: newWallet.frozen_balance,
          currency: newWallet.currency,
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: {
        available_balance: wallet.available_balance,
        frozen_balance: wallet.frozen_balance,
        currency: wallet.currency,
      },
    });
  } catch (err: any) {
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Get or create virtual account for user
 */
export async function getOrCreateVirtualAccount(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    
    // Check if user already has a virtual account
    const existing = await prisma.virtualAccount.findUnique({
      where: { user_id: userId },
    });

    if (existing && existing.account_number) {
      return reply.status(200).send({
        success: true,
        data: {
          account_number: existing.account_number,
          account_name: existing.account_name,
          bank_name: existing.bank_name,
          reference: existing.reference,
        },
      });
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { full_name: true, email: true },
    });

    if (!user) {
      return reply.status(404).send({ success: false, message: 'User not found' });
    }

    // Create virtual account via Monnify
    const account = await monnifyService.createVirtualAccount({
      userId,
      name: user.full_name || 'Vendr User',
      email: user.email || `user_${userId.slice(0, 8)}@vendr.app`,
    });

    // Store in database
    const virtualAccount = await prisma.virtualAccount.create({
      data: {
        user_id: userId,
        account_number: account.accountNumber,
        account_name: account.accountName,
        bank_name: account.bankName,
        reference: account.reference,
        provider: 'monnify',
      },
    });

    return reply.status(200).send({
      success: true,
      data: {
        account_number: virtualAccount.account_number,
        account_name: virtualAccount.account_name,
        bank_name: virtualAccount.bank_name,
        reference: virtualAccount.reference,
      },
    });
  } catch (err: any) {
    console.error('[Wallet] Virtual account error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Get user's virtual account
 */
export async function getVirtualAccount(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    
    const virtualAccount = await prisma.virtualAccount.findUnique({
      where: { user_id: userId },
    });

    if (!virtualAccount) {
      return reply.status(404).send({ success: false, message: 'Virtual account not found' });
    }

    return reply.status(200).send({
      success: true,
      data: {
        account_number: virtualAccount.account_number,
        account_name: virtualAccount.account_name,
        bank_name: virtualAccount.bank_name,
        reference: virtualAccount.reference,
      },
    });
  } catch (err: any) {
    return reply.status(500).send({ success: false, message: err.message });
  }
}
 
/**
 * Get user's transaction history
 */
export async function getTransactions(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const { limit = '50', offset = '0' } = request.query as { limit?: string; offset?: string };

    const transactions = await prisma.transaction.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    return reply.status(200).send({
      success: true,
      data: transactions,
    });
  } catch (err: any) {
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Get list of supported banks
 */
export async function getBanks(request: FastifyRequest, reply: FastifyReply) {
  try {
    const banks = await monnifyService.getBanks();
    return reply.status(200).send({ success: true, data: banks });
  } catch (err: any) {
    console.error('[Wallet] Get banks error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

export async function validateAccount(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { account_number, bank_code } = request.query as {
      account_number: string;
      bank_code: string;
    };

    if (!account_number || !bank_code) {
      return reply.status(400).send({ success: false, message: 'Account number and bank code are required' });
    }

    const result = await monnifyService.validateAccount(account_number, bank_code);
    return reply.status(200).send({ success: true, data: result });
  } catch (err: any) {
    console.error('[Wallet] Validate account error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * PATCHED: withdrawToBank
 *
 * Key fix: Monnify disbursement call is now OUTSIDE the Prisma transaction.
 *
 * Flow:
 *   1. Validate amount + balance
 *   2. DB tx: freeze funds + create pending transaction record
 *   3. Call Monnify (outside DB tx)
 *   4a. If Monnify throws: DB tx to unfreeze + mark failed — clean rollback
 *   4b. If Monnify succeeds: update transaction metadata — webhook will finalize
 */
export async function withdrawToBank(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const { amount, bank_code, account_number, account_name } = request.body as {
      amount: number;
      bank_code: string;
      account_number: string;
      account_name: string;
    };

    // ── 0. Check user is a vendor ───────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { is_vendor: true, role: true, last_withdrawal_at: true },
    });

    if (!user || !user.is_vendor) {
      return reply.status(403).send({ success: false, message: 'Only vendors can withdraw funds' });
    }

    // ── 0.1. Get vendor record for fraud check ────────────────────────────────────
    const vendor = await prisma.vendor.findFirst({
      where: { user_id: userId },
    });

    if (!vendor) {
      return reply.status(403).send({ success: false, message: 'Vendor record not found' });
    }

    // ── 0.2. Check fraud flag ────────────────────────────────────────────────────
    if (vendor.is_fraud_flagged) {
      return reply.status(403).send({ 
        success: false, 
        message: 'Your account has been flagged for review. Withdrawals are temporarily disabled.' 
      });
    }

    // ── 0.3. Check minimum withdrawal threshold ───────────────────────────────────
    const MIN_WITHDRAWAL_THRESHOLD = 5000; // ₦5,000
    if (amount < MIN_WITHDRAWAL_THRESHOLD) {
      return reply.status(400).send({ 
        success: false, 
        message: `Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_THRESHOLD.toLocaleString()}` 
      });
    }

    // ── 0.4. Check withdrawal cooldown (48 hours) ────────────────────────────────
    if (user.last_withdrawal_at) {
      const cooldownHours = 48;
      const cooldownExpiry = new Date(user.last_withdrawal_at.getTime() + cooldownHours * 60 * 60 * 1000);
      const now = new Date();
      
      if (now < cooldownExpiry) {
        const hoursRemaining = Math.ceil((cooldownExpiry.getTime() - now.getTime()) / (60 * 60 * 1000));
        return reply.status(400).send({ 
          success: false, 
          message: `You must wait ${hoursRemaining} hours before making another withdrawal` 
        });
      }
    }

    // ── 0.5. Check bank account verification (must have at least one saved account) ─
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { user_id: userId },
    });

    if (bankAccounts.length === 0) {
      return reply.status(400).send({ 
        success: false, 
        message: 'Please add and verify a bank account before withdrawing' 
      });
    }

    // ── 0.6. Check for pending withdrawal transactions ───────────────────────────
    const pendingWithdrawal = await prisma.transaction.findFirst({
      where: {
        user_id: userId,
        type: 'withdrawal',
        status: 'pending',
      },
    });

    if (pendingWithdrawal) {
      return reply.status(400).send({
        success: false,
        message: 'You have a pending withdrawal. Please wait for it to complete before initiating another withdrawal.',
      });
    }

    // ── 1. Validate inputs ────────────────────────────────────────────────────
    if (!amount || amount <= 0) {
      return reply.status(400).send({ success: false, message: 'Invalid amount' });
    }
    if (!bank_code || !account_number || !account_name) {
      return reply.status(400).send({ success: false, message: 'bank_code, account_number and account_name are required' });
    }

    const FREE_TIER_LIMIT = 50000;
    if (amount > FREE_TIER_LIMIT) {
      return reply.status(400).send({
        success: false,
        message: `Free tier withdrawal limit is ₦${FREE_TIER_LIMIT.toLocaleString()}. Upgrade to Pro for higher limits.`,
      });
    }

    // ── 2. Calculate total deduction (amount + fees) ───────────────────────────
    const totalDeduction = amount + TOTAL_FEE;

    // ── 3. Check wallet balance ───────────────────────────────────────────────
    const wallet = await prisma.wallet.findUnique({ where: { user_id: userId } });

    if (!wallet) {
      return reply.status(404).send({ success: false, message: 'Wallet not found' });
    }
    if (wallet.available_balance < totalDeduction) {
      return reply.status(400).send({ success: false, message: 'Insufficient wallet balance' });
    }

    const reference = `vendr_wd_${userId}_${Date.now()}`;

    // ── 4. DB transaction: freeze total funds + create pending record ──────────
    // NOTE: No external calls inside here. Pure DB work only.
    let transaction: { id: string; metadata?: any } | null = null;

    try {
      transaction = await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { user_id: userId },
          data: {
            available_balance: { decrement: totalDeduction },
            frozen_balance: { increment: totalDeduction },
          },
        });

        // Update user's last withdrawal timestamp
        await tx.user.update({
          where: { id: userId },
          data: { last_withdrawal_at: new Date() },
        });

        return tx.transaction.create({
          data: {
            user_id: userId,
            type: 'withdrawal',
            amount: totalDeduction, // Store total deduction (amount + fees)
            status: 'pending',
            reference,
            description: `Withdrawal to ${account_name} (${account_number})`,
            provider: 'monnify',
            metadata: {
              withdrawalAmount: amount, // Actual amount sent to user's bank
              monnifyFee: MONNIFY_FEE,
              vendrFee: VENDR_FEE,
              totalFee: TOTAL_FEE,
            } as any,
          },
        });
      });
    } catch (dbErr: any) {
      console.error('[Wallet] DB freeze error:', dbErr);
      return reply.status(500).send({ success: false, message: 'Failed to initiate withdrawal. Please try again.' });
    }

    // ── 5. Call Monnify outside the DB transaction (only send withdrawal amount) ────
    try {
      const disbursement = await monnifyService.disburseTo({
        amount, // Only send the withdrawal amount, not the total deduction
        bankCode: bank_code,
        accountNumber: account_number,
        accountName: account_name,
        narration: `Vendr withdrawal - ${account_name}`,
        reference,
      });

      // Update transaction metadata with Monnify's disbursement reference
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          metadata: {
            ...((transaction as any).metadata || {}),
            disbursementReference: disbursement.reference,
            disbursementStatus: disbursement.status,
          },
        },
      });

      return reply.status(200).send({
        success: true,
        message: 'Withdrawal initiated successfully. Funds will arrive shortly.',
        data: {
          reference,
          amount, // Return the withdrawal amount (not total deduction)
          fee: TOTAL_FEE,
          totalDeduction,
          status: 'pending',
        },
      });

    } catch (monnifyErr: any) {
      // ── 5a. Monnify failed — unfreeze withdrawal amount (fee stays consumed) ────
      console.error('[Wallet] Monnify disbursement error:', monnifyErr);

      await prisma.$transaction(async (tx) => {
        // Only return the withdrawal amount to available balance, keep fee consumed
        await tx.wallet.update({
          where: { user_id: userId },
          data: {
            available_balance: { increment: amount },
            frozen_balance: { decrement: totalDeduction }, // Unfreeze total deduction
          },
        });
        await tx.transaction.update({
          where: { id: transaction!.id },
          data: {
            status: 'failed',
            metadata: {
              ...((transaction as any).metadata || {}),
              error: monnifyErr.message,
              failedAt: new Date().toISOString(),
            },
          },
        });
      });

      return reply.status(502).send({
        success: false,
        message: 'Transfer could not be initiated. Your withdrawal amount has been returned to your wallet (fee consumed).',
      });
    }

  } catch (err: any) {
    console.error('[Wallet] Withdrawal error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Add bank account for withdrawals
 */
export async function addBankAccount(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const { account_number, account_name, bank_name, bank_code } = request.body as {
      account_number: string;
      account_name: string;
      bank_name: string;
      bank_code: string;
    };

    // Check user is a vendor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { is_vendor: true },
    });

    if (!user || !user.is_vendor) {
      return reply.status(403).send({ success: false, message: 'Only vendors can add bank accounts for withdrawals' });
    }

    const bankAccount = await prisma.bankAccount.create({
      data: {
        user_id: userId,
        account_number,
        account_name,
        bank_name,
        bank_code,
      },
    });

    return reply.status(201).send({
      success: true,
      data: bankAccount,
    });
  } catch (err: any) {
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Get user's bank accounts
 */
export async function getBankAccounts(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;

    // Check user is a vendor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { is_vendor: true },
    });

    if (!user || !user.is_vendor) {
      return reply.status(403).send({ success: false, message: 'Only vendors can view bank accounts' });
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { user_id: userId },
      orderBy: { is_default: 'desc' },
    });

    return reply.status(200).send({
      success: true,
      data: bankAccounts,
    });
  } catch (err: any) {
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Delete bank account
 */
export async function deleteBankAccount(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const { id } = request.params as { id: string };

    // Check user is a vendor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { is_vendor: true },
    });

    if (!user || !user.is_vendor) {
      return reply.status(403).send({ success: false, message: 'Only vendors can delete bank accounts' });
    }

    await prisma.bankAccount.deleteMany({
      where: { id, user_id: userId },
    });

    return reply.status(200).send({ success: true, message: 'Bank account deleted' });
  } catch (err: any) {
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Set default bank account
 */
export async function setDefaultBankAccount(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user.id;
    const { id } = request.params as { id: string };

    // Check user is a vendor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { is_vendor: true },
    });

    if (!user || !user.is_vendor) {
      return reply.status(403).send({ success: false, message: 'Only vendors can set default bank accounts' });
    }

    // Remove default from all accounts
    await prisma.bankAccount.updateMany({
      where: { user_id: userId },
      data: { is_default: false },
    });

    // Set new default
    await prisma.bankAccount.updateMany({
      where: { id, user_id: userId },
      data: { is_default: true },
    });

    return reply.status(200).send({ success: true, message: 'Default bank account updated' });
  } catch (err: any) {
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Process Monnify webhook
 */
export async function processWebhook(request: FastifyRequest, reply: FastifyReply) {
  try {
    const event = request.body;

    console.log('[Wallet] Webhook received:', event);

    const processed = monnifyService.processWebhookEvent(event);

    if (processed.type === 'wallet_funded' && processed.userId && processed.amount) {
      // Check if transaction with this reference already exists (idempotency)
      const existingTx = await prisma.transaction.findUnique({
        where: { reference: processed.reference },
      });

      if (existingTx) {
        console.log('[Wallet] Transaction already processed, skipping:', processed.reference);
        return reply.status(200).send({ success: true, message: 'Transaction already processed' });
      }

      // Credit user's wallet
      await prisma.$transaction(async (tx) => {
        // Get or create wallet
        let wallet = await tx.wallet.findUnique({
          where: { user_id: processed.userId! },
        });

        if (!wallet) {
          wallet = await tx.wallet.create({
            data: {
              user_id: processed.userId!,
              available_balance: 0,
              frozen_balance: 0,
              currency: 'NGN',
            },
          });
        }

        // Credit wallet
        await tx.wallet.update({
          where: { user_id: processed.userId! },
          data: { available_balance: { increment: processed.amount! } },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            user_id: processed.userId!,
            type: 'credit',
            amount: processed.amount!,
            status: 'success',
            reference: processed.reference,
            description: 'Wallet funded via transfer',
            provider: 'monnify',
          },
        });
      });

      console.log('[Wallet] Wallet credited:', processed);
    }

    return reply.status(200).send({ success: true });
  } catch (err: any) {
    console.error('[Wallet] Webhook error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Process Monnify disbursement webhook
 */
export async function processDisbursementWebhook(request: FastifyRequest, reply: FastifyReply) {
  try {
    const event = request.body as any;
    const signature = request.headers['monnify-signature'] as string;

    console.log('[Wallet] Disbursement webhook received:', event);

    // Verify webhook signature for security (in production)
    if (process.env.NODE_ENV === 'production' && signature) {
      const clientSecret = process.env.MONNIFY_SECRET_KEY || '';
      const payload = JSON.stringify(event);
      const isValid = verifyWebhookSignature(payload, signature, clientSecret);

      if (!isValid) {
        console.log('[Wallet] Invalid webhook signature');
        return reply.status(401).send({ success: false, message: 'Invalid signature' });
      }
    }

    const eventType = event.eventType || event.event;
    const eventData = event.eventData || {};

    // Handle Monnify disbursement events
    if (
      eventType === 'SUCCESSFUL_DISBURSEMENT' ||
      eventType === 'FAILED_DISBURSEMENT' ||
      eventType === 'REVERSED_DISBURSEMENT'
    ) {
      const reference = eventData.reference || eventData.transactionReference;
      const status = eventData.status || eventData.transactionStatus;

      if (!reference) {
        console.log('[Wallet] Disbursement webhook missing reference');
        return reply.status(400).send({ success: false, message: 'Missing reference' });
      }

      // Find transaction by reference
      const transaction = await prisma.transaction.findUnique({
        where: { reference },
      });

      if (!transaction) {
        console.log('[Wallet] Transaction not found for reference:', reference);
        return reply.status(404).send({ success: false, message: 'Transaction not found' });
      }

      // Only process withdrawal transactions
      if (transaction.type !== 'withdrawal') {
        console.log('[Wallet] Not a withdrawal transaction, skipping');
        return reply.status(200).send({ success: true });
      }

      // Check if already processed (idempotency)
      if (transaction.status === 'completed' || transaction.status === 'failed') {
        console.log('[Wallet] Transaction already finalized, skipping:', reference);
        return reply.status(200).send({ success: true, message: 'Transaction already finalized' });
      }

      // Process based on status
      await prisma.$transaction(async (tx: any) => {
        const withdrawalAmount = (transaction.metadata as any)?.withdrawalAmount || transaction.amount;

        if (status === 'SUCCESS' || status === 'SUCCESSFUL') {
          // Transaction successful - release frozen funds (total deduction already deducted from available)
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'completed',
              metadata: {
                ...(transaction.metadata as any || {}),
                disbursementStatus: status,
                completedAt: new Date().toISOString(),
              } as any,
            },
          });
          await tx.wallet.update({
            where: { user_id: transaction.user_id },
            data: { frozen_balance: { decrement: transaction.amount } }, // Unfreeze total deduction
          });
          console.log('[Wallet] Withdrawal completed:', reference);
        } else if (status === 'FAILED' || status === 'REVERSED') {
          // Transaction failed or reversed - return withdrawal amount only (fee stays consumed)
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'failed',
              metadata: {
                ...(transaction.metadata as any || {}),
                disbursementStatus: status,
                failedAt: new Date().toISOString(),
              } as any,
            },
          });
          await tx.wallet.update({
            where: { user_id: transaction.user_id },
            data: {
              available_balance: { increment: withdrawalAmount }, // Only return withdrawal amount
              frozen_balance: { decrement: transaction.amount }, // Unfreeze total deduction
            },
          });
          console.log('[Wallet] Withdrawal failed/reversed, withdrawal amount restored (fee consumed):', reference);
        } else {
          // Still pending - just update metadata
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              metadata: {
                ...(transaction.metadata as any),
                disbursementStatus: status,
              },
            },
          });
          console.log('[Wallet] Withdrawal still pending:', reference);
        }
      });

      return reply.status(200).send({ success: true });
    }

    return reply.status(200).send({ success: true, message: 'Event processed' });
  } catch (err: any) {
    console.error('[Wallet] Disbursement webhook error:', err);
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Poll pending withdrawals (safety net for missed webhooks)
 * Call this periodically (e.g., every 10 minutes) to check on transactions
 * that have been pending for more than 5 minutes
 */
export async function pollPendingWithdrawals() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        type: 'withdrawal',
        status: 'pending',
        created_at: { lt: fiveMinutesAgo },
      },
    });

    console.log(`[Wallet] Polling ${pendingTransactions.length} pending withdrawals`);

    for (const transaction of pendingTransactions) {
      try {
        const disbursementRef = (transaction.metadata as any)?.disbursementReference;

        if (!disbursementRef) {
          console.log('[Wallet] No disbursement reference for transaction:', transaction.reference);
          continue;
        }

        const status = await monnifyService.checkDisbursementStatus(disbursementRef);

        console.log('[Wallet] Disbursement status for', transaction.reference, ':', status.status);

        if (status.status === 'SUCCESS') {
          await prisma.$transaction(async (tx: any) => {
            await tx.transaction.update({
              where: { id: transaction.id },
              data: {
                status: 'success',
                metadata: {
                  ...(transaction.metadata as any || {}),
                  disbursementStatus: status.status,
                  completedAt: new Date().toISOString(),
                  pollingUpdate: true,
                } as any,
              },
            });
            await tx.wallet.update({
              where: { user_id: transaction.user_id },
              data: { frozen_balance: { decrement: transaction.amount } }, // Unfreeze total deduction
            });
          });
          console.log('[Wallet] Withdrawal completed via polling:', transaction.reference);
        } else if ((status.status as any) === 'FAILED' || (status.status as any) === 'REVERSED' || (status.status as any) === 'EXPIRED') {
          const withdrawalAmount = (transaction.metadata as any)?.withdrawalAmount || transaction.amount;

          await prisma.$transaction(async (tx: any) => {
            await tx.transaction.update({
              where: { id: transaction.id },
              data: {
                status: 'failed',
                metadata: {
                  ...(transaction.metadata as any),
                  disbursementStatus: status.status,
                  failedAt: new Date().toISOString(),
                  pollingUpdate: true,
                },
              },
            });
            await tx.wallet.update({
              where: { user_id: transaction.user_id },
              data: {
                available_balance: { increment: withdrawalAmount }, // Only return withdrawal amount
                frozen_balance: { decrement: transaction.amount }, // Unfreeze total deduction
              },
            });
          });
          console.log('[Wallet] Withdrawal failed via polling:', transaction.reference);
        }
      } catch (err) {
        console.error('[Wallet] Error polling transaction:', transaction.reference, err);
      }
    }

    return { polled: pendingTransactions.length };
  } catch (err) {
    console.error('[Wallet] Poll pending withdrawals error:', err);
    throw err;
  }
}
