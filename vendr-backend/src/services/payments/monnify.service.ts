// ── Monnify Integration Service ─────────────────────────────────────────────────────

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
  currency: string;
  sourceAccountNumber?: string;
}

interface DisbursementResponse {
  reference: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  amount: number;
}

interface Bank {
  name: string;
  code: string;
}

// ── Auth token cache ─────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

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
  narration: string;
  reference: string;
}

export interface DisburseResult {
  reference: string;
  status: 'success' | 'pending' | 'failed';
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
    const { amount, bankCode, accountNumber, narration, reference } = params;
    
    const isSandbox = BASE_URL.includes('sandbox');

    // In sandbox, Monnify requires OTP for disbursements which can't be automated
    // We simulate a successful disbursement so the full flow can be tested
    if (isSandbox) {
      console.log('[Monnify] Sandbox disbursement simulated for:', { amount, accountNumber, reference });
      return {
        reference,
        status: 'success',
        amount,
      };
    }

    const body: DisbursementRequest = {
      amount,
      reference,
      narration,
      destinationBankCode: bankCode,
      destinationAccountNumber: accountNumber,
      currency: 'NGN',
      sourceAccountNumber: process.env.MONNIFY_WALLET_ACCOUNT || '',
    };

    const data: DisbursementResponse = await monnifyFetch(
      '/api/v2/disbursements/single',
      'POST',
      body,
    );

    return {
      reference: data.reference,
      status: data.status === 'SUCCESS' ? 'success' 
            : data.status === 'PENDING' ? 'pending' 
            : 'failed',
      amount: data.amount,
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
   * Get list of supported banks
   */
  async getBanks(): Promise<Bank[]> {
    const data: Bank[] = await monnifyFetch('/api/v1/sdk/transactions/banks');
    return data;
  },

  /**
   * Process webhook event from Monnify
   */
  processWebhookEvent(event: any): { type: string; userId?: string; amount?: number; reference?: string } {
    // Monnify webhook structure
    // This is a simplified version - you'll need to adjust based on actual webhook payload
    const eventType = event.eventType || event.event;
    
    if (eventType === 'ACCOUNT_CREDITED') {
      // Extract account reference to find user
      const accountReference = event.eventData?.accountReference || event.accountReference;
      const amount = event.eventData?.amount || event.amount;
      
      // Parse user ID from account reference (format: vendr_userId_timestamp)
      const userIdMatch = accountReference?.match(/vendr_([^_]+)_/);
      const userId = userIdMatch ? userIdMatch[1] : undefined;
      
      return {
        type: 'wallet_funded',
        userId,
        amount,
        reference: accountReference,
      };
    }
    
    if (eventType === 'DISBURSEMENT') {
      return {
        type: 'transfer_complete',
        reference: event.eventData?.reference,
      };
    }
    
    return {
      type: 'unknown',
    };
  },
};
