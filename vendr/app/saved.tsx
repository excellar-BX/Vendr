import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { VendorCard } from '../components/vendor/VendorCard';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Vendor } from '../types';

export default function SavedVendorsScreen() {
  const { session } = useAuthStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const fetchSaved = async () => {
      if (!session?.user?.id) return;
      setLoading(true);

      // Step 1: get saved vendor IDs
      const { data: saved, error } = await supabase
        .from('saved_vendors')
        .select('vendor_id, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error || !saved?.length) {
        setVendors([]);
        setLoading(false);
        return;
      }

      // Step 2: fetch vendor details
      const ids = saved.map(s => s.vendor_id);
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('*')
        .in('id', ids);

      // Preserve save order
      const ordered = ids
        .map(id => vendorData?.find(v => v.id === id))
        .filter(Boolean) as Vendor[];

      setVendors(ordered);
      setLoading(false);
    };
    fetchSaved();
  }, [session?.user?.id]));

  const handleUnsave = async (vendorId: string) => {
    if (!session?.user?.id) return;
    await supabase
      .from('saved_vendors')
      .delete()
      .eq('user_id', session.user.id)
      .eq('vendor_id', vendorId);
    setVendors(prev => prev.filter(v => v.id !== vendorId));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#1A1208', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC', flex: 1 }}>
          Saved Vendors
        </Text>
        {vendors.length > 0 && (
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#6B5E50' }}>
            {vendors.length} saved
          </Text>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#E8521A" />
        </View>
      ) : vendors.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 22,
            backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="bookmark-outline" size={32} color="#3D3026" />
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#FDF6EC' }}>No saved vendors</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', textAlign: 'center', lineHeight: 22 }}>
            Tap the bookmark on any vendor profile to save them here for quick access.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            style={{ backgroundColor: '#E8521A', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 }}
          >
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: 'white' }}>Browse Vendors</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={v => v.id}
          contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View>
              <VendorCard vendor={item} />
              {/* Unsave button */}
              <TouchableOpacity
                onPress={() => handleUnsave(item.id)}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 34, height: 34, borderRadius: 10,
                  backgroundColor: 'rgba(15,10,6,0.75)',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: 'rgba(245,166,35,0.3)',
                }}
              >
                <Ionicons name="bookmark" size={16} color="#F5A623" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}