import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../lib/prisma';
import { monnifyService } from '../payments/monnify.service';

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
    const { limit = 50, offset = 0 } = request.query as { limit?: string; offset?: string };
    
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
    return reply.status(500).send({ success: false, message: err.message });
  }
}

/**
 * Withdraw funds to bank account
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

    // Validate amount
    if (!amount || amount <= 0) {
      return reply.status(400).send({ success: false, message: 'Invalid amount' });
    }

    // Get wallet balance
    const wallet = await prisma.wallet.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      return reply.status(404).send({ success: false, message: 'Wallet not found' });
    }

    // Check sufficient balance
    if (wallet.available_balance < amount) {
      return reply.status(400).send({ success: false, message: 'Insufficient wallet balance' });
    }

    // Enforce free tier withdrawal limit (₦50,000)
    const FREE_TIER_LIMIT = 50000;
    if (amount > FREE_TIER_LIMIT) {
      return reply.status(400).send({
        success: false,
        message: `Free tier withdrawal limit is ₦${FREE_TIER_LIMIT.toLocaleString()}. Upgrade to Pro for higher limits.`,
      });
    }

    const reference = `vendr_wd_${userId}_${Date.now()}`;

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Deduct from wallet
      await tx.wallet.update({
        where: { user_id: userId },
        data: { available_balance: { decrement: amount } },
      });

      // 2. Create transaction record
      await tx.transaction.create({
        data: {
          user_id: userId,
          type: 'withdrawal',
          amount,
          status: 'pending',
          reference,
          description: `Withdrawal to ${account_name} (${account_number})`,
          provider: 'monnify',
        },
      });

      // 3. Disburse via Monnify
      const disbursement = await monnifyService.disburseTo({
        amount,
        bankCode: bank_code,
        accountNumber: account_number,
        narration: `Vendr withdrawal - ${account_name}`,
        reference,
      });

      // 4. Update transaction status
      await tx.transaction.update({
        where: { reference },
        data: { status: disbursement.status },
      });

      return disbursement;
    });

    return reply.status(200).send({
      success: true,
      data: result,
    });
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
