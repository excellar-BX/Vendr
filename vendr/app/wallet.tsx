import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions, Clipboard,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { useAuthStore } from '../stores/authStore';
import {
  useWalletBalance,
  useVirtualAccount,
  useWalletTransactions,
  useCreateVirtualAccount,
} from '../hooks/useQueries';
import { useVendrAlert } from '../components/ui/VendrAlert';
import { T, useTheme } from '../constants/theme';

const { width } = Dimensions.get('window');

type TxType = 'credit' | 'debit' | 'withdrawal' | 'payment_sent' | 'payment_received' | 'refund';

interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  description: string;
  reference: string;
  created_at: string;
  updated_at: string;
  counterparty_id?: string;
}

interface Wallet {
  available_balance: number;
  frozen_balance: number;
}

interface VirtualAccount {
  account_number: string;
  account_name: string;
  bank_name: string;
}

const TX_CONFIG: Record<TxType, { icon: string; color: string; label: string; sign: string }> = {
  credit:           { icon: 'arrow-down-circle',    color: '#2D8653', label: 'Wallet Funded',     sign: '+' },
  debit:            { icon: 'arrow-up-circle',      color: '#DC2626', label: 'Debit',             sign: '-' },
  withdrawal:       { icon: 'arrow-up-circle',      color: '#DC2626', label: 'Withdrawal',        sign: '-' },
  payment_sent:     { icon: 'send',                 color: '#DC2626', label: 'Payment Sent',      sign: '-' },
  payment_received: { icon: 'cash',                 color: '#2D8653', label: 'Payment Received',  sign: '+' },
  refund:           { icon: 'refresh-circle',       color: '#D97706', label: 'Refund',            sign: '+' },
};

function formatAmount(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupByDate(txs: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  txs.forEach(tx => {
    const d = new Date(tx.created_at);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    let label = formatDate(tx.created_at);
    if (d.toDateString() === today.toDateString()) label = 'Today';
    else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });
  return groups;
}

export default function WalletScreen() {
  useTheme();
  const { user, isVendor } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  // React Query hooks
  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = useWalletBalance();
  const { data: virtualAccount } = useVirtualAccount();
  const { data: transactions, refetch: refetchTransactions } = useWalletTransactions(50);
  const createVaMutation = useCreateVirtualAccount();

  const loading = walletLoading;

  const copyAccountNumber = () => {
    if (!virtualAccount) return;
    Clipboard.setString(virtualAccount.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCreateVirtualAccount = async () => {
    try {
      await createVaMutation.mutateAsync();
    } catch (e: any) {
      showAlert({
        title: 'Setup Failed',
        message: e.message ?? 'Could not create your account. Please try again.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'cancel' }],
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchWallet(), refetchTransactions()]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  const txList = transactions ?? [];
  const grouped = groupByDate(txList);

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: T.ink, flex: 1 }}>My Wallet</Text>
        <TouchableOpacity
          onPress={() => router.push('/wallet-transactions')}
          style={{ width: 36, height: 36, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="list-outline" size={18} color={T.ink2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8521A" />}
      >
        {/* ── Balance Card ── */}
        <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <View style={{
            borderRadius: 24, overflow: 'hidden',
            backgroundColor: T.heroBg,
            shadowColor: '#1C1917', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 6,
          }}>
            {/* Brand glow */}
            <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#E8521A', opacity: 0.35, top: -110, right: -70 }} />
            <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: '#F5A623', opacity: 0.18, top: -40, right: 60 }} />

            <View style={{ padding: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Available Balance</Text>
                <TouchableOpacity
                  onPress={() => setShowBalance(!showBalance)}
                  style={{ padding: 6 }}
                  accessibilityLabel={showBalance ? 'Hide balance' : 'Show balance'}
                >
                  <Ionicons name={showBalance ? 'eye-outline' : 'eye-off-outline'} size={18} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>

              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 36, color: '#FFFFFF', letterSpacing: -1, marginBottom: 4 }}>
                {showBalance ? formatAmount(wallet?.available_balance ?? 0) : '₦ ••••••'}
              </Text>

              {(wallet?.frozen_balance ?? 0) > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="lock-closed-outline" size={12} color="#F5A623" />
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#FCD34D' }}>
                    {formatAmount(wallet!.frozen_balance)} frozen
                  </Text>
                </View>
              )}

              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>NGN • Vendr Wallet</Text>
            </View>

            {/* Actions row */}
            <View style={{ flexDirection: 'row', backgroundColor: T.surface, borderTopWidth: 0 }}>
              {[
                { label: 'Fund', icon: 'add-circle-outline', onPress: () => router.push('/fund-wallet') },
                ...(isVendor ? [{ label: 'Withdraw', icon: 'arrow-up-circle-outline', onPress: () => router.push('/withdraw') }] : []),
                { label: 'History', icon: 'time-outline', onPress: () => router.push('/wallet-transactions') },
              ].map((action, i) => (
                <TouchableOpacity
                  key={action.label}
                  onPress={action.onPress}
                  activeOpacity={0.75}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 16, gap: 6,
                    borderRightWidth: i < (isVendor ? 2 : 1) ? 1 : 0, borderColor: T.line,
                  }}
                >
                  <Ionicons name={action.icon as any} size={22} color="#E8521A" />
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: T.ink }}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Virtual Account / Fund Wallet ── */}
        <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: T.ink, marginBottom: 12 }}>
            Fund Your Wallet
          </Text>

          {virtualAccount ? (
            <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 20, padding: 20, gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business-outline" size={20} color="#E8521A" />
                </View>
                <View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink }}>{virtualAccount.bank_name}</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink2 }}>Transfer to this account to fund wallet</Text>
                </View>
              </View>

              {/* Account details */}
              <View style={{ backgroundColor: T.canvas, borderRadius: 14, borderWidth: 1, borderColor: T.line, padding: 16, gap: 12 }}>
                <View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3, marginBottom: 4 }}>ACCOUNT NUMBER</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: T.ink, letterSpacing: 2 }}>
                      {virtualAccount.account_number}
                    </Text>
                    <TouchableOpacity
                      onPress={copyAccountNumber}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        backgroundColor: copied ? 'rgba(45,134,83,0.15)' : 'rgba(232,82,26,0.12)',
                        borderWidth: 1, borderColor: copied ? 'rgba(45,134,83,0.3)' : 'rgba(232,82,26,0.25)',
                        borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
                      }}
                    >
                      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? '#2D8653' : '#E8521A'} />
                      <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: copied ? T.successInk : T.primaryInk }}>
                        {copied ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: T.surface }} />
                <View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3, marginBottom: 4 }}>ACCOUNT NAME</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink }}>{virtualAccount.account_name}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: T.surface }} />
                <View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3, marginBottom: 4 }}>BANK</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink }}>{virtualAccount.bank_name}</Text>
                </View>
              </View>

              {/* Copy button */}
              <TouchableOpacity
                onPress={copyAccountNumber}
                style={{
                  backgroundColor: copied ? 'rgba(45,134,83,0.15)' : '#E8521A',
                  borderRadius: 14, height: 48,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                  borderWidth: copied ? 1 : 0,
                  borderColor: 'rgba(45,134,83,0.3)',
                }}
              >
                <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={16} color={copied ? '#2D8653' : 'white'} />
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: copied ? T.successInk : 'white' }}>
                  {copied ? 'Account Number Copied!' : 'Copy Account Number'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,166,35,0.08)', borderRadius: 12, padding: 12 }}>
                <Ionicons name="information-circle-outline" size={16} color="#F5A623" />
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.goldInk, flex: 1, lineHeight: 18 }}>
                  Transfer any amount to this account from any Nigerian bank. Your wallet updates automatically.
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleCreateVirtualAccount}
              disabled={createVaMutation.isPending}
              activeOpacity={0.85}
              style={{
                backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
                borderRadius: 20, padding: 24, alignItems: 'center', gap: 12,
                borderStyle: 'dashed',
              }}
            >
              {createVaMutation.isPending ? (
                <>
                  <ActivityIndicator size="large" color="#E8521A" />
                  <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: T.ink2 }}>Setting up your account...</Text>
                </>
              ) : (
                <>
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="wallet-outline" size={28} color="#E8521A" />
                  </View>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: T.ink }}>Get Your Account Number</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink2, textAlign: 'center', lineHeight: 20 }}>
                    Get a dedicated bank account number to fund your Vendr wallet instantly
                  </Text>
                  <View style={{ backgroundColor: '#E8521A', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: 'white' }}>Set Up Now — Free</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Quick Actions (Vendor Only) ── */}
        {user?.is_vendor && (
          <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: T.ink, marginBottom: 12 }}>Quick Actions</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push('/withdraw')}
                activeOpacity={0.85}
                style={{ flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 18, padding: 16, alignItems: 'center', gap: 10 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(232,85,85,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-up-circle-outline" size={22} color="#DC2626" />
                </View>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: T.ink }}>Withdraw</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink2, textAlign: 'center' }}>Send to your bank</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/add-bank-account')}
                activeOpacity={0.85}
                style={{ flex: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 18, padding: 16, alignItems: 'center', gap: 10 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(245,166,35,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="card-outline" size={22} color="#F5A623" />
                </View>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: T.ink }}>Bank Accounts</Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink2, textAlign: 'center' }}>Manage withdrawal accounts</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Recent Transactions ── */}
        <View style={{ marginHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: T.ink }}>Recent Activity</Text>
            {txList.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/wallet-transactions')}>
                <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: T.primaryInk }}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {txList.length === 0 ? (
            <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 20, padding: 32, alignItems: 'center', gap: 10 }}>
              <Ionicons name="receipt-outline" size={32} color={T.ink4} />
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink3 }}>No transactions yet</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink3, textAlign: 'center' }}>
                Fund your wallet to get started
              </Text>
            </View>
          ) : (
            <View>
              {(() => {
                let count = 0;
                const maxCount = 6;
                const groupsToShow = [];

                for (const [date, txs] of Object.entries(grouped)) {
                  if (count >= maxCount) break;
                  const remaining = maxCount - count;
                  groupsToShow.push({ date, txs: txs.slice(0, remaining) });
                  count += Math.min(remaining, txs.length);
                }

                return groupsToShow.map(({ date, txs }) => (
                  <View key={date} style={{ marginBottom: 16 }}>
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: T.ink3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {date}
                    </Text>
                    <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 20, overflow: 'hidden' }}>
                      {txs.map((tx, i) => {
                        const cfg = TX_CONFIG[tx.type];
                        const isPositive = cfg.sign === '+';
                        return (
                          <View key={tx.id} style={{
                            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
                            borderBottomWidth: i < txs.length - 1 ? 1 : 0, borderColor: T.line,
                          }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${cfg.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: T.ink }}>{cfg.label}</Text>
                              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink2, marginTop: 2 }} numberOfLines={1}>
                                {tx.description}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: isPositive ? T.successInk : T.dangerInk }}>
                                {cfg.sign}{formatAmount(tx.amount)}
                              </Text>
                              <View style={{ marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: tx.status === 'success' ? 'rgba(45,134,83,0.12)' : tx.status === 'pending' ? 'rgba(245,166,35,0.12)' : 'rgba(232,85,85,0.12)' }}>
                                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: tx.status === 'success' ? T.successInk : tx.status === 'pending' ? T.goldInk : T.dangerInk, textTransform: 'uppercase' }}>
                                  {tx.status}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ));
              })()}
            </View>
          )}
        </View>
      </ScrollView>
      {alertElement}
    </View>
  );
}