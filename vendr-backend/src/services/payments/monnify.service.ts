// ── Monnify Integration Service ─────────────────────────────────────────────────────

import { createHmac } from 'crypto';

const BASE_URL = process.env.MONNIFY_BASE_URL || 'https://sandbox.monnify.com';
const API_KEY = process.env.MONNIFY_API_KEY || '';
const SECRET_KEY = process.env.MONNIFY_SECRET_KEY || '';
const CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE || '';

interface MonnifyAuthResponse {
  requestSuccessful: boolean;
  responseBody: {
    accessToken: string;
    expiresIn: number;
  };
  responseMessage: string;
}

interface MonnifyResponse<T = any> {
  requestSuccessful: boolean;
  responseBody: T;
  responseMessage: string;
}

interface VirtualAccountRequest {
  accountReference: string;
  accountName: string;
  currencyCode: string;
  contractCode: string;
  customerEmail: string;
  customerName: string;
  bvn?: string;
  bvnValidationRequired: boolean;
  getAllAvailableBanks: boolean;
  preferredBanks: string[];
}

interface VirtualAccountResponse {
  accountReference: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  reservationReference: string;
  accounts: Array<{
    accountNumber: string;
    bankName: string;
    bankCode: string;
  }>;
}

interface DisbursementRequest {
  amount: number;
  reference: string;
  narration: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  destinationAccountName: string;
  currency: string;
  sourceAccountNumber?: string;
}

interface DisbursementResponse {
  reference: string;
  status: 'SUCCESS' | 'SUCCESSFUL' | 'PENDING' | 'FAILED';
  amount: number;
}

interface Bank {
  name: string;
  code: string;
}

// ── Auth token cache ───────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

// ── Webhook signature verification ───────────────────────────────────────────────────
/**
 * Verify Monnify webhook signature
 * Monnify sends a SHA-512 HMAC hash in the 'monnify-signature' header
 * Hash = SHA-512(clientSecret + requestBody)
 */
export function verifyWebhookSignature(payload: string, signature: string, clientSecret: string): boolean {
  const computedHash = createHmac('sha512', clientSecret).update(payload).digest('hex');
  return computedHash === signature;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;

  const credentials = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64');
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Monnify auth failed: ${res.status}`);
  }

  const json = await res.json() as MonnifyAuthResponse;
  if (!json.requestSuccessful) {
    throw new Error('Monnify auth unsuccessful');
  }

  cachedToken = json.responseBody.accessToken;
  // Token valid for 1 hour — cache for 55 mins to be safe
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  return cachedToken!;
}

async function monnifyFetch<T = any>(path: string, method = 'GET', body?: object): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as MonnifyResponse<T>;
  console.log('[Monnify] Response:', { path, status: res.status, requestSuccessful: json.requestSuccessful, responseMessage: json.responseMessage });

  if (!json.requestSuccessful) {
    throw new Error(json.responseMessage || 'Monnify request failed');
  }
  return json.responseBody;
}

// ── Public API ────────────────────────────────────────────────────────────────────

export interface CreateVirtualAccountParams {
  userId: string;
  name: string;
  email: string;
  bvn?: string;
}

export interface CreateVirtualAccountResult {
  accountNumber: string;
  bankName: string;
  accountName: string;
  reference: string;
}

export interface DisburseParams {
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  narration: string;
  reference: string;
}

export interface DisburseResult {
  reference: string;
  status: 'success' | 'pending' | 'failed';
  amount: number;
}

export interface DisbursementStatusResult {
  transactionReference: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REVERSED';
  amount: number;
}

export interface VerifyTransactionResult {
  status: 'success' | 'pending';
  amount: number;
}

export const monnifyService = {
  /**
   * Create a virtual account for a user
   */
  async createVirtualAccount(params: CreateVirtualAccountParams): Promise<CreateVirtualAccountResult> {
    const { userId, name, email, bvn } = params;
    
    console.log('[Monnify] Creating VA for:', { userId, name, email });
    
    const firstName = (name || '').split(' ')[0].trim().slice(0, 8) || email.split('@')[0].slice(0, 8) || 'User';
    const shortName = `Vendr-${firstName}`;

    const body: VirtualAccountRequest = {
      accountReference: `vendr_${userId}_${Date.now()}`,
      accountName: shortName,
      currencyCode: 'NGN',
      contractCode: CONTRACT_CODE,
      customerEmail: email,
      customerName: shortName,
      bvnValidationRequired: false,
      getAllAvailableBanks: false,
      preferredBanks: ['035'], // Wema Bank — fastest activation
    };

    if (bvn) {
      body.bvn = bvn;
      body.bvnValidationRequired = true;
    }

    const data: VirtualAccountResponse = await monnifyFetch(
      '/api/v2/bank-transfer/reserved-accounts',
      'POST',
      body,
    );

    const account = data.accounts?.[0] || {};
    return {
      accountNumber: account.accountNumber || data.accountNumber,
      bankName: account.bankName || data.bankName,
      accountName: data.accountName,
      reference: data.accountReference,
    };
  },

  /**
   * Disburse funds to a bank account
   */
  async disburseTo(params: DisburseParams): Promise<DisburseResult> {
    const { amount, bankCode, accountNumber, accountName, narration, reference } = params;

    const body: DisbursementRequest = {
      amount,
      reference,
      narration,
      destinationBankCode: bankCode,
      destinationAccountNumber: accountNumber,
      destinationAccountName: accountName,
      currency: 'NGN',
      sourceAccountNumber: process.env.MONNIFY_WALLET_ACCOUNT || '',
    };

    const data: DisbursementResponse = await monnifyFetch(
      '/api/v2/disbursements/single',
      'POST',
      body,
    );

    console.log('[Monnify] Disbursement response data:', data);

    const status = 'pending';

    return {
      reference: data.reference,
      status,
      amount: data.amount,
    };
  },

  /**
   * PATCHED: checkDisbursementStatus
   *
   * The transfer-status endpoint returns a different response shape —
   * requestSuccessful is undefined, so monnifyFetch throws even on HTTP 200.
   * This method now calls the endpoint directly and handles the raw response.
   */
  async checkDisbursementStatus(reference: string): Promise<DisbursementStatusResult> {
    const token = await getAccessToken();
    const res = await fetch(
      `${BASE_URL}/api/v2/disbursements/transfer-status/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const json = await res.json() as any;

    console.log('[Monnify] checkDisbursementStatus raw response:', JSON.stringify(json, null, 2));

    if (!res.ok) {
      throw new Error(json?.responseMessage || `Monnify status check failed: ${res.status}`);
    }

    // Monnify wraps in responseBody for this endpoint
    const data = json?.responseBody || json;

    return {
      transactionReference: data.transactionReference || data.reference || reference,
      status: data.transactionStatus || data.status || 'PENDING',
      amount: data.amount || 0,
    };
  },

  /**
   * Verify a transaction by reference
   */
  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    const data = await monnifyFetch(
      `/api/v2/bank-transfer/reserved-accounts/transactions?accountReference=${encodeURIComponent(reference)}&page=0&size=1`,
    );
    
    const tx = data.content?.[0];
    if (!tx) {
      throw new Error('Transaction not found');
    }
    
    return {
      status: tx.paymentStatus === 'PAID' ? 'success' : 'pending',
      amount: tx.amountPaid || 0,
    };
  },

  /**
   * PATCHED: getBanks
   *
   * Bug: monnifyFetch() already unwraps responseBody before returning.
   * The old code then tried to do response?.responseBody?.banks on the
   * already-unwrapped value, which was always undefined → returned [].
   *
   * Fix: treat the returned value as the banks array directly.
   * Monnify's GET /api/v1/banks returns responseBody as an array of banks.
   */
  async getBanks(): Promise<Bank[]> {
    const response = await monnifyFetch('/api/v1/banks');
    // monnifyFetch returns responseBody directly.
    // responseBody for /api/v1/banks is an array of bank objects.
    const banks: any[] = Array.isArray(response) ? response : (response?.banks ?? []);
    return banks.map((bank: any) => ({
      name: bank.name || bank.bankName,
      code: bank.code || bank.bankCode,
    }));
  },

  /**
   * Validate account number and get account name
   */
  async validateAccount(accountNumber: string, bankCode: string): Promise<{ accountName: string }> {
    console.log('[Monnify] Validating account:', { accountNumber, bankCode });
    const response = await monnifyFetch(`/api/v1/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`, 'GET');

    return {
      accountName: response?.responseBody?.accountName || response?.accountName || '',
    };
  },

  /**
   * Process webhook event from Monnify
   */
  processWebhookEvent(event: any): { type: string; userId?: string; amount?: number; reference?: string } {
    // Monnify webhook structure
    const eventType = event.eventType || event.event;
    const eventData = event.eventData || {};

    console.log('[Monnify] Processing webhook:', { eventType, paymentStatus: eventData.paymentStatus });

    if (eventType === 'SUCCESSFUL_TRANSACTION' && eventData.paymentStatus === 'PAID') {
      // Extract account reference to find user
      const accountReference = eventData.product?.reference || eventData.accountReference;
      const transactionReference = eventData.transactionReference || eventData.paymentReference;
      const amount = eventData.amountPaid || eventData.amount;

      console.log('[Monnify] Transaction details:', { accountReference, transactionReference, amount });

      // Parse user ID from account reference (format: vendr_userId_timestamp)
      const userIdMatch = accountReference?.match(/vendr_([^_]+)_/);
      const userId = userIdMatch ? userIdMatch[1] : undefined;

      console.log('[Monnify] Extracted userId:', userId);

      return {
        type: 'wallet_funded',
        userId,
        amount,
        reference: transactionReference || accountReference, // Use unique transaction reference
      };
    }

    if (eventType === 'DISBURSEMENT') {
      return {
        type: 'transfer_complete',
        reference: eventData.reference,
      };
    }

    return { type: 'unknown' };
  },
};
