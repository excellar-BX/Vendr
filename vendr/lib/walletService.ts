import { supabase } from './supabase';
import { paymentProvider, PAYMENT_PROVIDER } from './payments';

// ── Get or create virtual account for user ────────────────────────────────────
export async function getOrCreateVirtualAccount(userId: string) {
  // Check if user already has a virtual account stored in Supabase
  const { data: existing } = await supabase
    .from('virtual_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // If exists and has an account number, return it
  if (existing?.account_number) return existing;

  // Get user's name from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .maybeSingle();

  // Get email from auth session
  const { data: authData } = await supabase.auth.getUser();
  const email = authData?.user?.email ?? `user_${userId.slice(0, 8)}@vendr.app`;
  const name  = profile?.name ?? authData?.user?.email?.split('@')[0] ?? 'Vendr User';

  console.log('[WalletService] Creating VA for:', { userId, name, email });

  // Create virtual account via active provider
  const account = await paymentProvider.createVirtualAccount(
    userId,
    name,
    email,
  );

  // Store in Supabase — upsert in case a partial row exists
  const { data: stored, error } = await supabase
    .from('virtual_accounts')
    .upsert({
      user_id:        userId,
      account_number: account.accountNumber,
      bank_name:      account.bankName,
      account_name:   account.accountName,
      reference:      account.reference,
      provider:       PAYMENT_PROVIDER,
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw new Error('Could not save virtual account: ' + error.message);
  return stored;
}

// ── Get wallet balance ─────────────────────────────────────────────────────────
export async function getWalletBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('wallets')
    .select('available_balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.available_balance ?? 0;
}

// ── Withdraw to bank ───────────────────────────────────────────────────────────
export async function withdrawToBank(params: {
  userId: string;
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}) {
  const { userId, amount, bankCode, accountNumber, accountName } = params;

  // Check balance first
  const balance = await getWalletBalance(userId);
  if (balance < amount) throw new Error('Insufficient wallet balance');

  // Enforce free tier withdrawal limit (₦50,000)
  const FREE_TIER_LIMIT = 50000;
  if (amount > FREE_TIER_LIMIT) {
    throw new Error(`Free tier withdrawal limit is ₦${FREE_TIER_LIMIT.toLocaleString()}. Upgrade to Pro for higher limits.`);
  }

  const reference = `vendr_wd_${userId}_${Date.now()}`;

  // Deduct from wallet in Supabase first (optimistic)
  const { error: deductErr } = await supabase.rpc('debit_wallet', {
    p_user_id:    userId,
    p_amount:     amount,
    p_reference:  reference,
    p_description: `Withdrawal to ${accountName} (${accountNumber})`,
  });

  if (deductErr) throw new Error('Could not process withdrawal: ' + deductErr.message);

  try {
    // Send via active provider
    const result = await paymentProvider.disburseTo({
      amount,
      bankCode,
      accountNumber,
      narration: `Vendr withdrawal - ${accountName}`,
      reference,
    });

    // Log transaction
    await supabase.from('transactions').insert({
      user_id:     userId,
      type:        'debit',
      amount,
      reference:   result.reference,
      description: `Withdrawal to ${accountName} (${accountNumber})`,
      status:      result.status,
      provider:    PAYMENT_PROVIDER,
    });

    return result;
  } catch (err: any) {
    // Reverse the deduction — direct balance restore, no transaction log entry
    await supabase
      .from('wallets')
      .select('available_balance')
      .eq('user_id', userId)
      .single()
      .then(async ({ data }) => {
        if (data) {
          await supabase
            .from('wallets')
            .update({ available_balance: (data.available_balance ?? 0) + amount })
            .eq('user_id', userId);
        }
      })
      
    throw err;
  }
}

// ── Get bank list ──────────────────────────────────────────────────────────────
export async function getBankList() {
  return paymentProvider.getBanks();
}