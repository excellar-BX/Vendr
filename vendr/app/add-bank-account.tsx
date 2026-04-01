import { useState, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput as RNTextInput, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface Bank { name: string; code: string; }

interface SavedAccount {
  id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  is_default: boolean;
}

export default function AddBankAccountScreen() {
  const { session } = useAuthStore();
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [resolvedName, setResolvedName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.user?.id) return;

    // Fetch saved accounts
    supabase.from('bank_accounts').select('*').eq('user_id', session.user.id)
      .order('is_default', { ascending: false })
      .then(({ data }) => setSavedAccounts(data ?? []));

    // Fetch live bank list from Paystack via edge function
    const fetchBanks = async () => {
      setLoadingBanks(true);
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        const res = await fetch(
          'https://mbdojwirmtknzpwccthb.supabase.co/functions/v1/list-banks',
          { headers: { Authorization: `Bearer ${s?.access_token}` } }
        );
        const json = await res.json();
        if (json.banks) setBanks(json.banks);
      } catch (e) {
        console.log('Failed to fetch banks:', e);
      } finally {
        setLoadingBanks(false);
      }
    };
    fetchBanks();
  }, [session]);

  // Auto-resolve account name when number is 10 digits and bank selected
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      resolveAccountName();
    } else {
      setResolvedName('');
    }
  }, [accountNumber, selectedBank]);

  const resolveAccountName = async () => {
    setResolving(true);
    setResolvedName('');
    setError('');
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const res = await fetch(
        'https://mbdojwirmtknzpwccthb.supabase.co/functions/v1/resolve-account',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token}` },
          body: JSON.stringify({ account_number: accountNumber, bank_code: selectedBank!.code }),
        }
      );
      const json = await res.json();
      if (json.account_name) {
        setResolvedName(json.account_name);
      } else {
        setError(json.error ?? 'Could not verify account. Check the number and bank.');
      }
    } catch (e: any) {
      setError('Could not verify account number: ' + e.message);
    } finally {
      setResolving(false);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id || !selectedBank || !resolvedName) return;
    setSaving(true);
    try {
      if (isDefault) {
        await supabase.from('bank_accounts').update({ is_default: false }).eq('user_id', session.user.id);
      }

      const { data, error: saveErr } = await supabase.from('bank_accounts').insert({
        user_id: session.user.id,
        account_number: accountNumber,
        account_name: resolvedName,
        bank_name: selectedBank.name,
        bank_code: selectedBank.code,
        is_default: isDefault || savedAccounts.length === 0,
      }).select().single();

      if (saveErr) throw saveErr;
      setSavedAccounts(prev => [data, ...prev]);
      setAccountNumber('');
      setSelectedBank(null);
      setResolvedName('');
      setIsDefault(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSavedAccounts(prev => prev.filter(a => a.id !== id));
    await supabase.from('bank_accounts').delete().eq('id', id);
  };

  const filteredBanks = banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
  const canSave = accountNumber.length === 10 && selectedBank && resolvedName && !resolving;

  const inputStyle = {
    fontFamily: 'SpaceGrotesk_400Regular' as const,
    color: '#FDF6EC' as const,
    fontSize: 15,
    backgroundColor: '#1A1208' as const,
    borderWidth: 1,
    borderColor: '#3D3026' as const,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22, color: '#FDF6EC', flex: 1 }}>Bank Accounts</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* Saved accounts */}
        {savedAccounts.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>Saved Accounts</Text>
            {savedAccounts.map(acc => (
              <View key={acc.id} style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(232,82,26,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="card-outline" size={20} color="#E8521A" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>{acc.bank_name}</Text>
                    {acc.is_default && (
                      <View style={{ backgroundColor: 'rgba(232,82,26,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 10, color: '#E8521A' }}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#9A8570', marginTop: 2 }}>
                    {acc.account_name} • ••••{acc.account_number.slice(-4)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(acc.id)} style={{ padding: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#E85555" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Add new account form */}
        <View style={{ gap: 14 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, color: '#FDF6EC' }}>Add New Account</Text>

          {/* Bank picker trigger */}
          <TouchableOpacity
            onPress={() => setShowBankPicker(true)}
            style={[inputStyle, { justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}
          >
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 15, color: selectedBank ? '#FDF6EC' : '#6B5E50' }}>
              {selectedBank ? selectedBank.name : 'Select bank'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#6B5E50" />
          </TouchableOpacity>

          {/* Account number */}
          <RNTextInput
            value={accountNumber}
            onChangeText={t => { setAccountNumber(t.replace(/\D/g, '').slice(0, 10)); setError(''); }}
            placeholder="Account number (10 digits)"
            placeholderTextColor="#6B5E50"
            keyboardType="numeric"
            maxLength={10}
            style={inputStyle}
          />

          {/* Resolved name */}
          {resolving && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#E8521A" />
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>Verifying account...</Text>
            </View>
          )}
          {resolvedName ? (
            <View style={{ backgroundColor: 'rgba(45,134,83,0.1)', borderWidth: 1, borderColor: 'rgba(45,134,83,0.25)', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="checkmark-circle" size={20} color="#2D8653" />
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#2D8653' }}>{resolvedName}</Text>
            </View>
          ) : null}

          {error ? <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#E85555' }}>{error}</Text> : null}

          {/* Set as default */}
          <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#FDF6EC' }}>Set as default</Text>
            <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ false: '#3D3026', true: '#E8521A' }} thumbColor="white" />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave || saving}
            style={{
              backgroundColor: canSave ? '#E8521A' : '#2A1F14', borderRadius: 16, height: 56,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {saving ? <ActivityIndicator size="small" color="white" /> : (
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: canSave ? 'white' : '#6B5E50' }}>Save Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bank picker modal */}
      {showBankPicker && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { setShowBankPicker(false); setBankSearch(''); }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
        >
          {/* Inner sheet — stop touches from bubbling to backdrop */}
          <View
            onStartShouldSetResponder={() => true}
            style={{
              backgroundColor: '#1A1208',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderTopWidth: 1,
              borderColor: '#2A1F14',
              paddingTop: 16,
              paddingBottom: 36,
              maxHeight: '80%',
            }}
          >
            <View style={{ width: 40, height: 4, backgroundColor: '#3D3026', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC', textAlign: 'center', marginBottom: 16 }}>Select Bank</Text>

            {/* Search input */}
            <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: '#0F0A06', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48, gap: 8 }}>
              <Ionicons name="search-outline" size={16} color="#6B5E50" />
              <RNTextInput
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder="Search banks..."
                placeholderTextColor="#6B5E50"
                style={{ flex: 1, fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#FDF6EC', backgroundColor: 'transparent' }}
              />
            </View>

            {loadingBanks ? (
              <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
                <ActivityIndicator size="large" color="#E8521A" />
                <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#9A8570' }}>Loading banks...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 20 }}>
                {filteredBanks.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50' }}>No banks found</Text>
                  </View>
                ) : filteredBanks.map((bank, index) => (
                  <TouchableOpacity
                    key={`${bank.code}-${index}`}
                    onPress={() => { setSelectedBank(bank); setShowBankPicker(false); setBankSearch(''); }}
                    style={{
                      backgroundColor: selectedBank?.code === bank.code ? 'rgba(232,82,26,0.1)' : '#0F0A06',
                      borderWidth: 1,
                      borderColor: selectedBank?.code === bank.code ? '#E8521A' : '#2A1F14',
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#FDF6EC' }}>{bank.name}</Text>
                    {selectedBank?.code === bank.code && <Ionicons name="checkmark-circle" size={18} color="#E8521A" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}