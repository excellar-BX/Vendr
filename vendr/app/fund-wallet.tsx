import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
  Share, Clipboard,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { useAuthStore } from '../stores/authStore';
import { walletApi } from '../lib/api';
import { T, useTheme } from '../constants/theme';

function formatAmount(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

type Stage = 'loading' | 'show_account' | 'error';

export default function FundWalletScreen() {
  useTheme();
  const { user } = useAuthStore();
  const intervalRef = useRef<number | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [virtualAccount, setVirtualAccount] = useState<{
    accountNumber: string;
    bankName: string;
    accountName: string;
  } | null>(null);
  const [balance, setBalance] = useState(0);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [balanceBefore, setBalanceBefore] = useState(0);
  const [funded, setFunded] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      setStage('loading');
      const [accountRes, balRes] = await Promise.all([
        walletApi.getOrCreateVirtualAccount(),
        walletApi.getBalance(),
      ]);
      const account = accountRes.data;
      setVirtualAccount({
        accountNumber: account.account_number,
        bankName: account.bank_name,
        accountName: account.account_name,
      });
      setBalance(balRes.data?.available_balance ?? 0);
      setBalanceBefore(balRes.data?.available_balance ?? 0);
      setStage('show_account');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Could not load account details');
      setStage('error');
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Auto-redirect to wallet 3s after funding is detected
  useEffect(() => {
    if (funded) {
      const timer = setTimeout(() => {
        router.replace('/wallet');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [funded]);

  // Poll balance every 15s to detect incoming transfer
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (stage !== 'show_account' || funded) return;

    intervalRef.current = setInterval(async () => {
      if (!user?.id) return;
      try {
        const balRes = await walletApi.getBalance();
        const newBal = balRes.data?.available_balance ?? 0;
        setBalance(newBal);
        if (newBal > balanceBefore) {
          setFunded(true);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch {}
    }, 15000) as unknown as number;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [stage, funded, balanceBefore, user?.id]);

  const copyAccountNumber = () => {
    if (!virtualAccount) return;
    Clipboard.setString(virtualAccount.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareDetails = () => {
    if (!virtualAccount) return;
    Share.share({
      message:
        `Pay into my Vendr wallet:\n\nBank: ${virtualAccount.bankName}\nAccount: ${virtualAccount.accountNumber}\nName: ${virtualAccount.accountName}`,
    });
  };

  if (stage === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <StatusBar style={T.statusBar} />
        <ActivityIndicator size="large" color="#E8521A" />
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: T.ink2 }}>Setting up your wallet...</Text>
      </View>
    );
  }

  if (stage === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 20 }}>
        <StatusBar style={T.statusBar} />
        <Ionicons name="warning-outline" size={48} color="#DC2626" />
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: T.ink, textAlign: 'center' }}>Could not load account</Text>
        <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: T.ink2, textAlign: 'center' }}>{errorMsg}</Text>
        <TouchableOpacity onPress={load} style={{ backgroundColor: '#E8521A', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: 'white' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: T.ink, flex: 1 }}>Fund Wallet</Text>
        <TouchableOpacity onPress={shareDetails} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="share-outline" size={22} color={T.ink2} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* Balance */}
        <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink2, marginBottom: 4 }}>Current Balance</Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: T.ink }}>{formatAmount(balance)}</Text>
          </View>
        </View>

        {/* Funded banner */}
        {funded && (
          <View style={{ backgroundColor: 'rgba(45,134,83,0.12)', borderWidth: 1, borderColor: 'rgba(45,134,83,0.3)', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="checkmark-circle" size={24} color="#2D8653" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: T.successInk }}>Payment Received!</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.successInk, marginTop: 2 }}>Your wallet has been funded successfully.</Text>
            </View>
          </View>
        )}

        {/* How it works */}
        <View style={{ backgroundColor: 'rgba(232,82,26,0.06)', borderWidth: 1, borderColor: 'rgba(232,82,26,0.15)', borderRadius: 18, padding: 16, gap: 12 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: T.ink }}>How to fund your wallet</Text>
          {[
            { n: '1', text: 'Copy the account number below' },
            { n: '2', text: 'Open your bank app or dial USSD' },
            { n: '3', text: 'Transfer any amount to this account' },
            { n: '4', text: 'Your wallet updates automatically within minutes' },
          ].map(step => (
            <View key={step.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: 'rgba(232,82,26,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: T.primaryInk }}>{step.n}</Text>
              </View>
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink2, flex: 1 }}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* Virtual Account Card */}
        <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 20, overflow: 'hidden' }}>
          <View style={{ backgroundColor: T.canvas, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: T.line }}>
            <Ionicons name="shield-checkmark" size={14} color="#2D8653" />
            <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: T.successInk }}>
              Secured by Monnify
            </Text>
          </View>

          <View style={{ padding: 20, gap: 20 }}>
            <View>
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3, letterSpacing: 1, marginBottom: 6 }}>BANK NAME</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: T.ink }}>{virtualAccount?.bankName}</Text>
            </View>

            <View>
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3, letterSpacing: 1, marginBottom: 6 }}>ACCOUNT NUMBER</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, color: T.ink, letterSpacing: 4 }}>
                  {virtualAccount?.accountNumber}
                </Text>
                <TouchableOpacity
                  onPress={copyAccountNumber}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: copied ? 'rgba(45,134,83,0.15)' : 'rgba(232,82,26,0.12)',
                    borderWidth: 1, borderColor: copied ? 'rgba(45,134,83,0.3)' : 'rgba(232,82,26,0.25)',
                    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
                  }}
                >
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? '#2D8653' : '#E8521A'} />
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: copied ? T.successInk : T.primaryInk }}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink3, letterSpacing: 1, marginBottom: 6 }}>ACCOUNT NAME</Text>
              <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: T.ink }}>{virtualAccount?.accountName}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={copyAccountNumber}
            style={{ backgroundColor: '#E8521A', margin: 16, marginTop: 0, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
          >
            <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={18} color="white" />
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: 'white' }}>
              {copied ? 'Copied!' : 'Copy Account Number'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 4 }}>
          <Ionicons name="information-circle-outline" size={16} color={T.ink3} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink3, flex: 1, lineHeight: 18 }}>
            This account number is unique to you. Transfers usually reflect within 1–5 minutes.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}