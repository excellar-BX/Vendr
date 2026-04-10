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
import { walletApi } from '../lib/api';
import { useVendrAlert } from '../components/ui/VendrAlert';

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
  debit:            { icon: 'arrow-up-circle',      color: '#E85555', label: 'Debit',             sign: '-' },
  withdrawal:       { icon: 'arrow-up-circle',      color: '#E85555', label: 'Withdrawal',        sign: '-' },
  payment_sent:     { icon: 'send',                 color: '#E85555', label: 'Payment Sent',      sign: '-' },
  payment_received: { icon: 'cash',                 color: '#2D8653', label: 'Payment Received',  sign: '+' },
  refund:           { icon: 'refresh-circle',       color: '#F5A623', label: 'Refund',            sign: '+' },
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
  const { user } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [creatingVA, setCreatingVA] = useState(false);

  const fetchAll = async () => {
    if (!user?.id) return;

    try {
      const [walletRes, vaRes, txRes] = await Promise.all([
        walletApi.getBalance(),
        walletApi.getVirtualAccount().catch(() => null), // Don't fail if no VA
        walletApi.getTransactions({ limit: 50 }),
      ]);

      if (walletRes?.data) setWallet(walletRes.data);
      if (vaRes?.data) setVirtualAccount(vaRes.data);
      if (txRes?.data) setTransactions(txRes.data);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchAll(); }, [user]));

  const [vaStatus, setVaStatus] = useState('');
  const [copied, setCopied] = useState(false);

  const copyAccountNumber = () => {
    if (!virtualAccount) return;
    Clipboard.setString(virtualAccount.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCreateVirtualAccount = async () => {
    setCreatingVA(true);
    setVaStatus('Setting up your account...');
    try {
      const res = await walletApi.getOrCreateVirtualAccount();
      const account = res.data;
      setVirtualAccount({
        account_number: account.account_number,
        account_name: account.account_name,
        bank_name: account.bank_name,
      });
      setVaStatus('Done!');
    } catch (e: any) {
      console.log('[Wallet] Virtual account error:', e.message);
      setVaStatus('');
      showAlert({
        title: 'Setup Failed',
        message: e.message ?? 'Could not create your account. Please try again.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'cancel' }],
      });
    } finally {
      setCreatingVA(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  const grouped = groupByDate(transactions);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC', flex: 1 }}>My Wallet</Text>
        <TouchableOpacity
          onPress={() => router.push('/wallet-transactions')}
          style={{ width: 36, height: 36, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="list-outline" size={18} color="#9A8570" />
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
            borderRadius: 28, overflow: 'hidden',
            backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
          }}>
            {/* Top gradient stripe */}
            <View style={{ height: 4, backgroundColor: '#E8521A' }} />

            <View style={{ padding: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#9A8570' }}>Available Balance</Text>
                <TouchableOpacity onPress={() => setShowBalance(!showBalance)} style={{ padding: 4 }}>
                  <Ionicons name={showBalance ? 'eye-outline' : 'eye-off-outline'} size={18} color="#9A8570" />
                </TouchableOpacity>
              </View>

              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 36, color: '#FDF6EC', marginBottom: 4 }}>
                {showBalance ? formatAmount(wallet?.available_balance ?? 0) : '₦ ••••••'}
              </Text>

              {(wallet?.frozen_balance ?? 0) > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="lock-closed-outline" size={12} color="#F5A623" />
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#F5A623' }}>
                    {formatAmount(wallet!.frozen_balance)} frozen
                  </Text>
                </View>
              )}

              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50', marginTop: 4 }}>NGN • Vendr Wallet</Text>
            </View>

            {/* Actions row */}
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: '#2A1F14' }}>
              {[
                { label: 'Fund', icon: 'add-circle-outline', onPress: () => router.push('/fund-wallet') },
                { label: 'Withdraw', icon: 'arrow-up-circle-outline', onPress: () => router.push('/withdraw') },
                { label: 'History', icon: 'time-outline', onPress: () => router.push('/wallet-transactions') },
              ].map((action, i) => (
                <TouchableOpacity
                  key={action.label}
                  onPress={action.onPress}
                  activeOpacity={0.75}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 16, gap: 6,
                    borderRightWidth: i < 2 ? 1 : 0, borderColor: '#2A1F14',
                  }}
                >
                  <Ionicons name={action.icon as any} size={22} color="#E8521A" />
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#FDF6EC' }}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Virtual Account / Fund Wallet ── */}
        <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC', marginBottom: 12 }}>
            Fund Your Wallet
          </Text>

          {virtualAccount ? (
            <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 20, gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business-outline" size={20} color="#E8521A" />
                </View>
                <View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>{virtualAccount.bank_name}</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570' }}>Transfer to this account to fund wallet</Text>
                </View>
              </View>

              {/* Account details */}
              <View style={{ backgroundColor: '#0F0A06', borderRadius: 14, borderWidth: 1, borderColor: '#2A1F14', padding: 16, gap: 12 }}>
                <View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50', marginBottom: 4 }}>ACCOUNT NUMBER</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC', letterSpacing: 2 }}>
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
                      <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: copied ? '#2D8653' : '#E8521A' }}>
                        {copied ? 'Copied!' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: '#1A1208' }} />
                <View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50', marginBottom: 4 }}>ACCOUNT NAME</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>{virtualAccount.account_name}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#1A1208' }} />
                <View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50', marginBottom: 4 }}>BANK</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>{virtualAccount.bank_name}</Text>
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
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: copied ? '#2D8653' : 'white' }}>
                  {copied ? 'Account Number Copied!' : 'Copy Account Number'}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,166,35,0.08)', borderRadius: 12, padding: 12 }}>
                <Ionicons name="information-circle-outline" size={16} color="#F5A623" />
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#F5A623', flex: 1, lineHeight: 18 }}>
                  Transfer any amount to this account from any Nigerian bank. Your wallet updates automatically.
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleCreateVirtualAccount}
              disabled={creatingVA}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
                borderRadius: 20, padding: 24, alignItems: 'center', gap: 12,
                borderStyle: 'dashed',
              }}
            >
              {creatingVA ? (
                <>
                  <ActivityIndicator size="large" color="#E8521A" />
                  <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#9A8570' }}>{vaStatus || 'Setting up your account...'}</Text>
                </>
              ) : (
                <>
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="wallet-outline" size={28} color="#E8521A" />
                  </View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FDF6EC' }}>Get Your Account Number</Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570', textAlign: 'center', lineHeight: 20 }}>
                    Get a dedicated bank account number to fund your Vendr wallet instantly
                  </Text>
                  <View style={{ backgroundColor: '#E8521A', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: 'white' }}>Set Up Now — Free</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Quick Actions ── */}
        <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC', marginBottom: 12 }}>Quick Actions</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push('/withdraw')}
              activeOpacity={0.85}
              style={{ flex: 1, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 18, padding: 16, alignItems: 'center', gap: 10 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(232,85,85,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="arrow-up-circle-outline" size={22} color="#E85555" />
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#FDF6EC' }}>Withdraw</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570', textAlign: 'center' }}>Send to your bank</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/add-bank-account')}
              activeOpacity={0.85}
              style={{ flex: 1, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 18, padding: 16, alignItems: 'center', gap: 10 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(245,166,35,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="card-outline" size={22} color="#F5A623" />
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#FDF6EC' }}>Bank Accounts</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570', textAlign: 'center' }}>Manage withdrawal accounts</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Recent Transactions ── */}
        <View style={{ marginHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>Recent Activity</Text>
            {transactions.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/wallet-transactions')}>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {transactions.length === 0 ? (
            <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, padding: 32, alignItems: 'center', gap: 10 }}>
              <Ionicons name="receipt-outline" size={32} color="#3D3026" />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#6B5E50' }}>No transactions yet</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#3D3026', textAlign: 'center' }}>
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
                    <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#6B5E50', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {date}
                    </Text>
                    <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 20, overflow: 'hidden' }}>
                      {txs.map((tx, i) => {
                        const cfg = TX_CONFIG[tx.type];
                        const isPositive = cfg.sign === '+';
                        return (
                          <View key={tx.id} style={{
                            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12,
                            borderBottomWidth: i < txs.length - 1 ? 1 : 0, borderColor: '#2A1F14',
                          }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${cfg.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>{cfg.label}</Text>
                              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570', marginTop: 2 }} numberOfLines={1}>
                                {tx.description}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: isPositive ? '#2D8653' : '#E85555' }}>
                                {cfg.sign}{formatAmount(tx.amount)}
                              </Text>
                              <View style={{ marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: tx.status === 'success' ? 'rgba(45,134,83,0.12)' : tx.status === 'pending' ? 'rgba(245,166,35,0.12)' : 'rgba(232,85,85,0.12)' }}>
                                <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 10, color: tx.status === 'success' ? '#2D8653' : tx.status === 'pending' ? '#F5A623' : '#E85555', textTransform: 'uppercase' }}>
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