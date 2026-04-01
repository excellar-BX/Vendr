export interface VirtualAccount {
  accountNumber: string;
  bankName: string;
  accountName: string;
  reference: string;
}

export interface Disbursement {
  reference: string;
  status: 'success' | 'pending' | 'failed';
  amount: number;
}

export interface Bank {
  name: string;
  code: string;
}

export interface WebhookEvent {
  type: 'wallet_funded' | 'transfer_complete' | 'unknown';
  userId?: string;
  amount?: number;
  reference?: string;
  raw: any;
}

export interface WalletProvider {
  createVirtualAccount(userId: string, name: string, email: string, bvn?: string): Promise<VirtualAccount>;
  disburseTo(params: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    narration: string;
    reference: string;
  }): Promise<Disbursement>;
  verifyTransaction(reference: string): Promise<{ status: string; amount: number }>;
  getBanks(): Promise<Bank[]>;
}