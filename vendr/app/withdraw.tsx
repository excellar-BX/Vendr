import { useState, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput as RNTextInput, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { withdrawToBank, getWalletBalance } from '../lib/walletService';

interface BankAccount {
  id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  is_default: boolean;
}

function formatAmount(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

export default function WithdrawScreen() {
  const { session } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      if (!session?.user?.id) return;
      const [bal, banksRes] = await Promise.all([
        getWalletBalance(session.user.id),
        supabase.from('bank_accounts').select('*').eq('user_id', session.user.id).order('is_default', { ascending: false }),
      ]);
      setBalance(bal);
      if (banksRes.data) {
        setBankAccounts(banksRes.data);
        const def = banksRes.data.find(b => b.is_default) ?? banksRes.data[0];
        if (def) setSelectedBank(def);
      }
      setLoading(false);
    };
    fetch();
  }, [session]);

  const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;

  const validate = () => {
    if (!selectedBank) { setError('Please add a bank account first'); return false; }
    if (parsedAmount < 100) { setError('Minimum withdrawal is ₦100'); return false; }
    if (parsedAmount > balance) { setError('Insufficient balance'); return false; }
    setError('');
    return true;
  };

  const handleWithdraw = async () => {
    if (!session?.user?.id || !selectedBank) return;
    setWithdrawing(true);
    try {
      await withdrawToBank({
        userId: session.user.id,
        amount: parsedAmount,
        bankCode: selectedBank.bank_code,
        accountNumber: selectedBank.account_number,
        accountName: selectedBank.account_name,
      });
      setShowConfirm(false);
      setShowSuccess(true);
      // Refresh balance
      const newBal = await getWalletBalance(session.user.id);
      setBalance(newBal);
    } catch (e: any) {
      setShowConfirm(false);
      setError(e.message);
    } finally {
      setWithdrawing(false);
    }
  };

  const quickAmounts = [500, 1000, 5000, 10000].filter(a => a <= balance);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#E8521A" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC', flex: 1 }}>Withdraw</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* Balance pill */}
        <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#9A8570' }}>Available Balance</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC' }}>{formatAmount(balance)}</Text>
        </View>

        {/* Amount input */}
        <View>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#9A8570', marginBottom: 10 }}>AMOUNT</Text>
          <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: error ? '#E85555' : '#3D3026', borderRadius: 18, paddingHorizontal: 20, height: 64, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#6B5E50' }}>₦</Text>
            <RNTextInput
              value={amount}
              onChangeText={t => { setAmount(t); setError(''); }}
              placeholder="0.00"
              placeholderTextColor="#3D3026"
              keyboardType="numeric"
              style={{ flex: 1, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: '#FDF6EC', backgroundColor: 'transparent' }}
            />
          </View>
          {error ? (
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#E85555', marginTop: 6 }}>{error}</Text>
          ) : null}
        </View>

        {/* Quick amounts */}
        {quickAmounts.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {quickAmounts.map(a => (
              <TouchableOpacity
                key={a}
                onPress={() => setAmount(String(a))}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
                  backgroundColor: parsedAmount === a ? '#E8521A' : '#1A1208',
                  borderWidth: 1, borderColor: parsedAmount === a ? '#E8521A' : '#2A1F14',
                }}
              >
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: parsedAmount === a ? 'white' : '#9A8570' }}>
                  ₦{a.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setAmount(String(balance))}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14' }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#F5A623' }}>All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bank account selector */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#9A8570' }}>WITHDRAW TO</Text>
            <TouchableOpacity onPress={() => router.push('/add-bank-account')}>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>+ Add Account</Text>
            </TouchableOpacity>
          </View>

          {bankAccounts.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/add-bank-account')}
              style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderStyle: 'dashed', borderRadius: 18, padding: 20, alignItems: 'center', gap: 8 }}
            >
              <Ionicons name="card-outline" size={28} color="#3D3026" />
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#6B5E50' }}>No bank accounts yet</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>Add one now</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              {bankAccounts.map(bank => (
                <TouchableOpacity
                  key={bank.id}
                  onPress={() => setSelectedBank(bank)}
                  style={{
                    backgroundColor: '#1A1208', borderWidth: 1,
                    borderColor: selectedBank?.id === bank.id ? '#E8521A' : '#2A1F14',
                    borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: selectedBank?.id === bank.id ? 'rgba(232,82,26,0.15)' : '#0F0A06', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="card-outline" size={20} color={selectedBank?.id === bank.id ? '#E8521A' : '#9A8570'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>{bank.bank_name}</Text>
                    <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570', marginTop: 2 }}>
                      {bank.account_name} • ••••{bank.account_number.slice(-4)}
                    </Text>
                  </View>
                  {selectedBank?.id === bank.id && <Ionicons name="checkmark-circle" size={20} color="#E8521A" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Withdraw button */}
        <TouchableOpacity
          onPress={() => { if (validate()) setShowConfirm(true); }}
          activeOpacity={0.85}
          style={{
            backgroundColor: parsedAmount > 0 && selectedBank ? '#E8521A' : '#2A1F14',
            borderRadius: 18, height: 60, alignItems: 'center', justifyContent: 'center',
            shadowColor: '#E8521A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: parsedAmount > 0 ? 0.3 : 0, shadowRadius: 12, elevation: parsedAmount > 0 ? 6 : 0,
          }}
        >
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: parsedAmount > 0 && selectedBank ? 'white' : '#6B5E50' }}>
            Withdraw {parsedAmount > 0 ? formatAmount(parsedAmount) : ''}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: '#1A1208', borderRadius: 24, borderWidth: 1, borderColor: '#2A1F14', padding: 24, gap: 16 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(232,82,26,0.12)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
              <Ionicons name="arrow-up-circle-outline" size={28} color="#E8521A" />
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC', textAlign: 'center' }}>Confirm Withdrawal</Text>

            <View style={{ backgroundColor: '#0F0A06', borderRadius: 16, borderWidth: 1, borderColor: '#2A1F14', padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>Amount</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#FDF6EC' }}>{formatAmount(parsedAmount)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: '#1A1208' }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>To</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#FDF6EC' }}>{selectedBank?.bank_name}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>Account</Text>
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#FDF6EC' }}>{selectedBank?.account_name}</Text>
              </View>
            </View>

            <View style={{ gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={handleWithdraw}
                disabled={withdrawing}
                style={{ backgroundColor: '#E8521A', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' }}
              >
                {withdrawing ? <ActivityIndicator size="small" color="white" /> : <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>Confirm & Withdraw</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowConfirm(false)}
                style={{ backgroundColor: '#0F0A06', borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A1F14' }}
              >
                <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15, color: '#9A8570' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: '#1A1208', borderRadius: 24, borderWidth: 1, borderColor: '#2A1F14', padding: 32, alignItems: 'center', gap: 16 }}>
            <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(45,134,83,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-circle" size={40} color="#2D8653" />
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC', textAlign: 'center' }}>Withdrawal Initiated</Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', textAlign: 'center', lineHeight: 22 }}>
              {formatAmount(parsedAmount)} is on its way to {selectedBank?.bank_name}. This usually takes a few minutes.
            </Text>
            <TouchableOpacity
              onPress={() => { setShowSuccess(false); router.replace('/wallet'); }}
              style={{ backgroundColor: '#E8521A', borderRadius: 14, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: 'white' }}>Back to Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}