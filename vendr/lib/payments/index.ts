import { PAYMENT_PROVIDER } from './config';
import { monnifyProvider } from './monnify';
import { paystackProvider } from './paystack';
import type { WalletProvider } from './types';

// ── Active provider — controlled by config.ts ─────────────────────────────────
const providers: Record<string, WalletProvider> = {
  monnify:  monnifyProvider,
  paystack: paystackProvider,
};

export const paymentProvider: WalletProvider = providers[PAYMENT_PROVIDER];

export { PAYMENT_PROVIDER };
export * from './types';