import { useState, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, TextInput as RNTextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { useAuthStore } from '../stores/authStore';
import { walletApi } from '../lib/api';

type TxType = 'credit' | 'debit' | 'withdrawal' | 'payment_sent' | 'payment_received' | 'refund';
type TxStatus = 'pending' | 'success' | 'failed';
type FilterType = 'all' | TxType;

interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  status: TxStatus;
  description: string;
  reference: string;
  created_at: string;
  updated_at: string;
  counterparty_id?: string;
}

const TX_CONFIG: Record<TxType, { icon: string; color: string; label: string; sign: string }> = {
  credit:           { icon: 'arrow-down-circle',  color: '#2D8653', label: 'Wallet Funded',     sign: '+' },
  debit:            { icon: 'arrow-up-circle',    color: '#E85555', label: 'Debit',             sign: '-' },
  withdrawal:       { icon: 'arrow-up-circle',    color: '#E85555', label: 'Withdrawal',        sign: '-' },
  payment_sent:     { icon: 'send',               color: '#E85555', label: 'Payment Sent',      sign: '-' },
  payment_received: { icon: 'cash',               color: '#2D8653', label: 'Payment Received',  sign: '+' },
  refund:           { icon: 'refresh-circle',     color: '#F5A623', label: 'Refund',            sign: '+' },
};

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',              label: 'All' },
  { key: 'credit',           label: 'Funded' },
  { key: 'payment_received', label: 'Received' },
  { key: 'payment_sent',     label: 'Sent' },
  { key: 'withdrawal',       label: 'Withdrawn' },
  { key: 'refund',           label: 'Refunds' },
];

function formatAmount(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatGroupDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
}

type ListItem =
  | { kind: 'header'; label: string }
  | { kind: 'tx'; data: Transaction };

export default function WalletTransactionsScreen() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [stats, setStats] = useState({ totalIn: 0, totalOut: 0, count: 0 });

  const fetchAll = async () => {
    if (!user?.id) return;
    const res = await walletApi.getTransactions();
    const txs = res.data ?? [];
    setTransactions(txs);

    // Compute stats
    const totalIn = txs.filter(t => ['credit', 'payment_received', 'refund'].includes(t.type) && t.status === 'success')
      .reduce((s: number, t: Transaction) => s + t.amount, 0);
    const totalOut = txs.filter(t => ['debit', 'withdrawal', 'payment_sent'].includes(t.type) && t.status === 'success')
      .reduce((s: number, t: Transaction) => s + t.amount, 0);
    setStats({ totalIn, totalOut, count: txs.length });
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchAll(); }, [user]));

  const filtered = transactions.filter(tx => {
    const matchesFilter = filter === 'all' || tx.type === filter;
    const matchesSearch = !search || tx.description?.toLowerCase().includes(search.toLowerCase()) || tx.reference?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Build grouped list items
  const listItems: ListItem[] = [];
  let lastGroup = '';
  filtered.forEach(tx => {
    const group = formatGroupDate(tx.created_at);
    if (group !== lastGroup) {
      listItems.push({ kind: 'header', label: group });
      lastGroup = group;
    }
    listItems.push({ kind: 'tx', data: tx });
  });

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.kind === 'header') {
      return (
        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, color: '#6B5E50', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {item.label}
        </Text>
      );
    }

    const tx = item.data;
    const cfg = TX_CONFIG[tx.type];
    const isPositive = cfg.sign === '+';

    return (
      <TouchableOpacity
        onPress={() => setSelectedTx(tx)}
        activeOpacity={0.75}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 }}
      >
        {/* Icon */}
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: `${cfg.color}18`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
        </View>

        {/* Details */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>{cfg.label}</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570' }} numberOfLines={1}>
            {tx.description}
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#6B5E50' }}>
            {formatFullDate(tx.created_at)}
          </Text>
        </View>

        {/* Amount + status */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: isPositive ? '#2D8653' : '#E85555' }}>
            {cfg.sign}{formatAmount(tx.amount)}
          </Text>
          <View style={{
            paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
            backgroundColor: tx.status === 'success' ? 'rgba(45,134,83,0.12)' : tx.status === 'pending' ? 'rgba(245,166,35,0.12)' : 'rgba(232,85,85,0.12)',
          }}>
            <Text style={{
              fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, textTransform: 'uppercase',
              color: tx.status === 'success' ? '#2D8653' : tx.status === 'pending' ? '#F5A623' : '#E85555',
            }}>
              {tx.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC', flex: 1 }}>Transactions</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#6B5E50' }}>{stats.count} total</Text>
        </View>

        {/* Stats row */}
        {stats.count > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(45,134,83,0.1)', borderWidth: 1, borderColor: 'rgba(45,134,83,0.2)', borderRadius: 16, padding: 14 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570', marginBottom: 4 }}>TOTAL IN</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#2D8653' }}>{formatAmount(stats.totalIn)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(232,85,85,0.08)', borderWidth: 1, borderColor: 'rgba(232,85,85,0.18)', borderRadius: 16, padding: 14 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570', marginBottom: 4 }}>TOTAL OUT</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#E85555' }}>{formatAmount(stats.totalOut)}</Text>
            </View>
          </View>
        )}

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 14, paddingHorizontal: 14, height: 46, gap: 8, marginBottom: 14 }}>
          <Ionicons name="search-outline" size={16} color="#6B5E50" />
          <RNTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions..."
            placeholderTextColor="#6B5E50"
            style={{ flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC', backgroundColor: 'transparent' }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#6B5E50" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={f => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item: f }) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                onPress={() => setFilter(f.key)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: active ? '#E8521A' : '#1A1208',
                  borderWidth: 1, borderColor: active ? '#E8521A' : '#2A1F14',
                }}
              >
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: active ? 'white' : '#9A8570' }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#1A1208', marginBottom: 4 }} />

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#E8521A" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#1A1208', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="receipt-outline" size={30} color="#3D3026" />
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC', textAlign: 'center' }}>
            {search ? 'No results found' : 'No transactions yet'}
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', textAlign: 'center' }}>
            {search ? 'Try a different search term' : 'Fund your wallet to get started'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item, i) => item.kind === 'header' ? `h-${item.label}` : item.data.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor="#E8521A" />}
          ItemSeparatorComponent={() => (
            // Only show separator between tx items, not after headers
            <View style={{ height: 1, backgroundColor: '#1A1208', marginHorizontal: 20 }} />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* ── Transaction Detail Modal ── */}
      <Modal visible={!!selectedTx} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
          activeOpacity={1}
          onPress={() => setSelectedTx(null)}
        />
        {selectedTx && (() => {
          const cfg = TX_CONFIG[selectedTx.type];
          const isPositive = cfg.sign === '+';
          return (
            <View style={{ backgroundColor: '#1A1208', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: '#2A1F14', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 44 }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#3D3026', borderRadius: 2, alignSelf: 'center', marginBottom: 24 }} />

              {/* Icon + amount */}
              <View style={{ alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: `${cfg.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={cfg.icon as any} size={32} color={cfg.color} />
                </View>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 32, color: isPositive ? '#2D8653' : '#E85555' }}>
                  {cfg.sign}{formatAmount(selectedTx.amount)}
                </Text>
                <View style={{
                  paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8,
                  backgroundColor: selectedTx.status === 'success' ? 'rgba(45,134,83,0.12)' : selectedTx.status === 'pending' ? 'rgba(245,166,35,0.12)' : 'rgba(232,85,85,0.12)',
                }}>
                  <Text style={{
                    fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, textTransform: 'uppercase',
                    color: selectedTx.status === 'success' ? '#2D8653' : selectedTx.status === 'pending' ? '#F5A623' : '#E85555',
                  }}>
                    {selectedTx.status}
                  </Text>
                </View>
              </View>

              {/* Details */}
              <View style={{ backgroundColor: '#0F0A06', borderRadius: 18, borderWidth: 1, borderColor: '#2A1F14', overflow: 'hidden' }}>
                {[
                  { label: 'Type',        value: cfg.label },
                  { label: 'Description', value: selectedTx.description },
                  { label: 'Date',        value: formatFullDate(selectedTx.updated_at || selectedTx.created_at) },
                  { label: 'Reference',   value: selectedTx.reference },
                ].map((row, i, arr) => (
                  <View key={row.label} style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: '#1A1208', gap: 12 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50', width: 90 }}>{row.label}</Text>
                    <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#FDF6EC', flex: 1 }} numberOfLines={2}>{row.value}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setSelectedTx(null)}
                style={{ marginTop: 16, backgroundColor: '#2A1F14', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#9A8570' }}>Close</Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}