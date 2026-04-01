import { WalletProvider, VirtualAccount, Disbursement, Bank } from './types';

const BASE_URL = 'https://api.paystack.co';
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY ?? '';

async function paystackFetch(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message ?? 'Paystack request failed');
  return json.data;
}

export const paystackProvider: WalletProvider = {

  async createVirtualAccount(userId: string, name: string, email: string): Promise<VirtualAccount> {
    // Paystack DVA requires registered business — this will fail on starter
    const data = await paystackFetch('/dedicated_account', 'POST', {
      customer: email,
      preferred_bank: 'wema-bank',
    });
    return {
      accountNumber: data.account_number,
      bankName: data.bank.name,
      accountName: data.account_name,
      reference: data.id?.toString(),
    };
  },

  async disburseTo({ amount, bankCode, accountNumber, narration, reference }): Promise<Disbursement> {
    // Create transfer recipient
    const recipient = await paystackFetch('/transferrecipient', 'POST', {
      type: 'nuban',
      name: narration,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    });

    const transfer = await paystackFetch('/transfer', 'POST', {
      source: 'balance',
      amount: amount * 100, // Paystack uses kobo
      recipient: recipient.recipient_code,
      reason: narration,
      reference,
    });

    return {
      reference: transfer.reference,
      status: transfer.status === 'success' ? 'success'
            : transfer.status === 'pending' ? 'pending'
            : 'failed',
      amount,
    };
  },

  async verifyTransaction(reference: string) {
    const data = await paystackFetch(`/transaction/verify/${reference}`);
    return {
      status: data.status === 'success' ? 'success' : 'pending',
      amount: (data.amount ?? 0) / 100,
    };
  },

  async getBanks(): Promise<Bank[]> {
    const data = await paystackFetch('/bank?currency=NGN&perPage=100');
    return (data ?? []).map((b: any) => ({
      name: b.name,
      code: b.code,
    }));
  },
};