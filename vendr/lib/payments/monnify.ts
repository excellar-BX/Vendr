import { WalletProvider, VirtualAccount, Disbursement, Bank } from './types';

const BASE_URL    = process.env.EXPO_PUBLIC_MONNIFY_BASE_URL    ?? 'https://sandbox.monnify.com';
const API_KEY     = process.env.EXPO_PUBLIC_MONNIFY_API_KEY     ?? '';
const SECRET_KEY  = process.env.EXPO_PUBLIC_MONNIFY_SECRET_KEY  ?? '';
const CONTRACT_CODE = process.env.EXPO_PUBLIC_MONNIFY_CONTRACT_CODE ?? '';

// ── Auth token cache ──────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const credentials = btoa(`${API_KEY}:${SECRET_KEY}`);
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`Monnify auth failed: ${res.status}`);

  const json = await res.json();
  if (!json.requestSuccessful) throw new Error('Monnify auth unsuccessful');

  cachedToken = json.responseBody.accessToken;
  // Token valid for 1 hour — cache for 55 mins to be safe
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  return cachedToken!;
}

async function monnifyFetch(path: string, method = 'GET', body?: object) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!json.requestSuccessful) {
    throw new Error(json.responseMessage ?? 'Monnify request failed');
  }
  return json.responseBody;
}

// ── Monnify provider ──────────────────────────────────────────────────────────
export const monnifyProvider: WalletProvider = {

  async createVirtualAccount(
    userId: string,
    name: string,
    email: string,
    bvn?: string,
  ): Promise<VirtualAccount> {
    console.log('[Monnify] Building account name from:', { name, email });
    const firstName = (name ?? '').split(' ')[0].trim().slice(0, 8) || email.split('@')[0].slice(0, 8) || 'User';
    const shortName = `Vendr-${firstName}`;

    const body: any = {
      accountReference: `vendr_${userId}_${Date.now()}`,
      accountName: shortName,
      currencyCode: 'NGN',
      contractCode: CONTRACT_CODE,
      customerEmail: email,
      customerName: shortName,
      // bvnValidationRequired must be false for starter business (no BVN enforcement)
      bvnValidationRequired: false,
      getAllAvailableBanks: false,
      preferredBanks: ['035'], // Wema Bank — fastest activation
    };

    if (bvn) {
      body.bvn = bvn;
      body.bvnValidationRequired = true;
    }

    const data = await monnifyFetch(
      '/api/v2/bank-transfer/reserved-accounts',
      'POST',
      body,
    );

    const account = data.accounts?.[0] ?? {};
    return {
      accountNumber: account.accountNumber ?? data.accountNumber,
      bankName: account.bankName ?? data.bankName,
      accountName: data.accountName,
      reference: data.accountReference,
    };
  },

  async disburseTo({ amount, bankCode, accountNumber, narration, reference }): Promise<Disbursement> {
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

    const data = await monnifyFetch(
      '/api/v2/disbursements/single',
      'POST',
      {
        amount,
        reference,
        narration,
        destinationBankCode: bankCode,
        destinationAccountNumber: accountNumber,
        currency: 'NGN',
        sourceAccountNumber: process.env.EXPO_PUBLIC_MONNIFY_WALLET_ACCOUNT ?? '',
      },
    );

    return {
      reference: data.reference,
      status: data.status === 'SUCCESS' ? 'success'
            : data.status === 'PENDING' ? 'pending'
            : 'failed',
      amount: data.amount,
    };
  },

  async verifyTransaction(reference: string) {
    const data = await monnifyFetch(
      `/api/v2/bank-transfer/reserved-accounts/transactions?accountReference=${encodeURIComponent(reference)}&page=0&size=1`,
    );
    const tx = data.content?.[0];
    if (!tx) throw new Error('Transaction not found');
    return {
      status: tx.paymentStatus === 'PAID' ? 'success' : 'pending',
      amount: tx.amountPaid ?? 0,
    };
  },

  async getBanks(): Promise<Bank[]> {
    const data = await monnifyFetch('/api/v1/sdk/transactions/banks');
    return (data ?? []).map((b: any) => ({
      name: b.name,
      code: b.code,
    }));
  },
};