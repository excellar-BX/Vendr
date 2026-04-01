// ── Change this one value to switch payment providers everywhere in the app ──
// 'monnify' | 'paystack'
export const PAYMENT_PROVIDER = 'monnify' as const;

export type PaymentProviderName = 'monnify' | 'paystack';