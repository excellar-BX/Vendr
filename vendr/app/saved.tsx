import { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { VendorCard } from '../components/vendor/VendorCard';
import { savedVendorApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Vendor } from '../types';
import { T, useTheme } from '../constants/theme';

export default function SavedVendorsScreen() {
  useTheme();
  const { user } = useAuthStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const fetchSaved = async () => {
      if (!user?.id) return;
      setLoading(true);

      try {
        const res = await savedVendorApi.getSavedVendors();
        const data = res.data || [];

        // Backend returns saved vendors with full vendor details already
        // Map to Vendor[] and preserve order (backend already orders by created_at desc)
        const vendors: Vendor[] = (data as any[]).map(item => item.vendor);
        setVendors(vendors);
      } catch (error) {
        console.error('Failed to fetch saved vendors:', error);
        setVendors([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSaved();
  }, [user?.id]));

  const handleUnsave = async (vendorId: string) => {
    if (!user?.id) return;
    try {
      await savedVendorApi.unsaveVendor(vendorId);
      setVendors(prev => prev.filter(v => v.id !== vendorId));
    } catch (error) {
      console.error('Failed to unsave vendor:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <StatusBar style={T.statusBar} />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: T.line, gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: T.ink, flex: 1 }}>
          Saved Vendors
        </Text>
        {vendors.length > 0 && (
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: T.ink3 }}>
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
            backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="bookmark-outline" size={32} color={T.ink4} />
          </View>
          <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: T.ink }}>No saved vendors</Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: T.ink2, textAlign: 'center', lineHeight: 22 }}>
            Tap the bookmark on any vendor profile to save them here for quick access.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            style={{ backgroundColor: '#E8521A', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 }}
          >
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: 'white' }}>Browse Vendors</Text>
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