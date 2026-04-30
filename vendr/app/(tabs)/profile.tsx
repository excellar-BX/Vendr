import { useState, useCallback } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  Image, Switch,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { apiFetch, getRefreshToken, clearTokens } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { clearPushToken } from '../../lib/notifications';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuItemProps {
  icon: IoniconsName;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  danger?: boolean;
}

function MenuItem({ icon, label, sublabel, onPress, rightElement, iconBg = '#2E2214', iconColor = '#FDF6EC', danger = false }: MenuItemProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} className="flex-row items-center px-4 py-3.5 gap-3">
      <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: iconBg }}>
        <Ionicons name={icon} size={18} color={danger ? '#E85555' : iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-sm" style={{ fontFamily: 'SpaceGrotesk_500Medium', color: danger ? '#E85555' : '#FDF6EC' }}>
          {label}
        </Text>
        {sublabel && <Text className="text-muted text-xs mt-0.5">{sublabel}</Text>}
      </View>
      {rightElement ?? <Ionicons name="chevron-forward" size={16} color="#3D3026" />}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-muted text-xs px-4 pt-5 pb-2 tracking-widest uppercase" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
      {title}
    </Text>
  );
}

function Divider() {
  return <View className="h-px bg-faint mx-4" />;
}

export default function ProfileScreen() {
  const { user, clear } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ orders: 0, reviews: 0, saved: 0 });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [canAddPassword, setCanAddPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  const userId = user?.id;
  const email = user?.email ?? '';
  const name = profile?.name ?? user?.full_name ?? 'Vendr User';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const isVendor = profile?.is_vendor === true;

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    const fetchAll = async () => {
      try {
        const response = await apiFetch('/auth/me', { method: 'GET' });
        const data = response.data;
        // Map backend response to frontend state shape
        setProfile({
          name: data.full_name,
          avatar_url: data.avatar_url,
          notifications_enabled: data.notifications_enabled,
          is_vendor: !!data.vendor,
        });
        setNotificationsEnabled(data.notifications_enabled);
        setCanAddPassword(data.can_add_password || false);
        setHasPassword(data.has_password || false);
        setStats({
          orders: data.stats?.orders || 0,
          reviews: data.stats?.reviews || 0,
          saved: data.stats?.saved || 0,
        });
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      }
    };
    fetchAll();
  }, [userId]));

  const savePreference = async (field: string, value: boolean) => {
    if (!userId) return;
    try {
      await apiFetch('/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      });
    } catch (err) {
      console.error('Failed to save preference:', err);
    }
  };

  const handleLogout = () => {
    showAlert({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      type: 'question',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out', style: 'destructive',
          onPress: async () => {
            try {
              const refreshToken = await getRefreshToken();
              if (refreshToken) {
                await apiFetch('/auth/logout', {
                  method: 'POST',
                  body: JSON.stringify({ refresh_token: refreshToken }),
                });
              }
            } catch {
              // Logout best-effort — clear locally regardless
            } finally {
              await clearTokens();
              clear();
              router.replace('/(auth)/login');
            }
          },
        },
      ],
    });
  };

  const handleDeleteAccount = () => {
    showAlert({
      title: 'Delete Account',
      message: 'Your account will be scheduled for deletion. You have 30 days to recover it before all data is permanently removed.',
      type: 'danger',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account', style: 'destructive',
          onPress: () => {
            showAlert({
              title: 'Are you absolutely sure?',
              message: 'This will sign you out immediately. Your data is permanently deleted after 30 days.',
              type: 'danger',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete', style: 'destructive',
                  onPress: async () => {
                    if (!userId) return;
                    try {
                      await apiFetch('/users/me', { method: 'DELETE' });
                      await clearTokens();
                      clear();
                      router.replace('/(auth)/welcome');
                    } catch (err: any) {
                      showAlert({ title: 'Error', message: err.message || 'Could not delete account. Please try again.', type: 'danger' });
                    }
                  },
                },
              ],
            });
          },
        },
      ],
    });
  };

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-orange opacity-[0.06]" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
          <Text className="text-cream text-2xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Profile</Text>
        </View>

        {/* Avatar card */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push('/profile-view')}
          className="mx-5 bg-dark-2 border border-faint rounded-3xl p-5 flex-row items-center gap-4 mb-2"
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} className="w-16 h-16 rounded-2xl" />
          ) : (
            <View className="w-16 h-16 rounded-2xl bg-orange/20 border border-orange/30 items-center justify-center">
              <Text className="text-orange text-xl" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>{initials}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-cream text-lg" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>{name}</Text>
            <Text className="text-muted text-sm mt-0.5">{email}</Text>
            <View style={{
              alignSelf: 'flex-start', marginTop: 8,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: isVendor ? 'rgba(245,166,35,0.15)' : '#1A1208',
              borderWidth: 1, borderColor: isVendor ? 'rgba(245,166,35,0.3)' : '#3D3026',
            }}>
              <Ionicons name={isVendor ? 'storefront-outline' : 'person-outline'} size={11} color={isVendor ? '#F5A623' : '#9A8570'} />
              <Text style={{ fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', color: isVendor ? '#F5A623' : '#9A8570' }}>
                {isVendor ? 'Vendor' : 'Buyer'}
              </Text>
            </View>
          </View>
          <TouchableOpacity className="w-9 h-9 bg-dark-3 border border-faint rounded-xl items-center justify-center" onPress={() => router.push('/edit-profile')}>
            <Ionicons name="pencil-outline" size={16} color="#9A8570" />
          </TouchableOpacity>
        </TouchableOpacity>
        {/* Stats row */}
        <View className="mx-5 flex-row gap-3 mb-2 mt-3">
          {[
            { label: 'Orders',  value: stats.orders,  icon: 'bag-outline'      as IoniconsName, route: '/orders'  },
            { label: 'Reviews', value: stats.reviews, icon: 'star-outline'     as IoniconsName, route: '/reviews' },
            { label: 'Saved',   value: stats.saved,   icon: 'bookmark-outline' as IoniconsName, route: '/saved'   },
          ].map(stat => (
            <TouchableOpacity
              key={stat.label}
              onPress={() => router.push(stat.route as any)}
              activeOpacity={0.75}
              className="flex-1 bg-dark-2 border border-faint rounded-2xl p-3 items-center gap-1"
            >
              <Ionicons name={stat.icon} size={18} color="#9A8570" />
              <Text className="text-cream text-lg" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>{stat.value}</Text>
              <Text className="text-muted text-xs">{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View className="mx-5 bg-dark-2 border border-faint rounded-3xl overflow-hidden">
          <MenuItem icon="person-outline"   label="Edit Profile"  sublabel="Update your name, photo and phone"   iconBg="#2E2214" iconColor="#F5A623" onPress={() => router.push('/edit-profile')} />
          <Divider />
          <MenuItem icon="wallet-outline"   label="My Wallet"     sublabel="Balance, transactions & withdrawals" iconBg="#2E2214" iconColor="#2D8653" onPress={() => router.push('/wallet')} />
          <MenuItem icon="bag-outline"      label="My Orders"     sublabel="Track your purchases"                iconBg="#2E2214" iconColor="#E8521A" onPress={() => router.push('/orders')} />
          <Divider />
          <MenuItem icon="bookmark-outline" label="Saved Vendors" sublabel="Your favourite vendors"              iconBg="#2E2214" iconColor="#5599E8" onPress={() => router.push('/saved')} />
          <Divider />
          <MenuItem icon="star-outline"     label="My Reviews"    sublabel="Reviews you have left"               iconBg="#2E2214" iconColor="#F5A623" onPress={() => router.push('/reviews')} />
          {canAddPassword && (
            <>
              <Divider />
              <MenuItem icon="lock-closed-outline" label="Set Up Password" sublabel="Add password to log in with email" iconBg="#2E2214" iconColor="#9A8570" onPress={() => router.push('/add-password')} />
            </>
          )}
          {hasPassword && (
            <>
              <Divider />
              <MenuItem icon="lock-closed-outline" label="Change Password" sublabel="Update your password" iconBg="#2E2214" iconColor="#9A8570" onPress={() => router.push('/change-password')} />
            </>
          )}
        </View>

        {isVendor && (
          <>
            <SectionHeader title="My Business" />
            <TouchableOpacity
              activeOpacity={0.85} onPress={() => router.push('/my-stores')}
              className="mx-5 bg-dark-2 border border-faint rounded-3xl p-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 bg-orange/20 rounded-2xl items-center justify-center">
                <Ionicons name="storefront-outline" size={20} color="#E8521A" />
              </View>
              <View className="flex-1">
                <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>My Stores</Text>
                <Text className="text-muted text-xs mt-0.5">Manage your stores and products</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#E8521A" />
            </TouchableOpacity>
          </>
        )}

        {!isVendor && (
          <>
            <SectionHeader title="Sell on Vendr" />
            <TouchableOpacity
              activeOpacity={0.85} onPress={() => router.push('/become-vendor')}
              className="mx-5 bg-orange/10 border border-orange/30 rounded-3xl p-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 bg-orange/20 rounded-2xl items-center justify-center">
                <Ionicons name="storefront-outline" size={20} color="#E8521A" />
              </View>
              <View className="flex-1">
                <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Become a Vendor</Text>
                <Text className="text-muted text-xs mt-0.5">Start selling to customers near you</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#E8521A" />
            </TouchableOpacity>
          </>
        )}

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <View className="mx-5 bg-dark-2 border border-faint rounded-3xl overflow-hidden">
          <MenuItem
            icon="notifications-outline" label="Push Notifications" sublabel="Orders, chats and offers"
            iconBg="#2E2214" iconColor="#FDF6EC"
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={v => { setNotificationsEnabled(v); savePreference('notifications_enabled', v); }}
                trackColor={{ false: '#3D3026', true: '#E8521A' }} thumbColor="white"
              />
            }
          />
          <Divider />
          <MenuItem icon="color-palette-outline" label="Appearance" sublabel="Language & text size" iconBg="#2E2214" iconColor="#9A8570" onPress={() => router.push('/appearance')} />
        </View>

        {/* Support */}
        <SectionHeader title="Support" />
        <View className="mx-5 bg-dark-2 border border-faint rounded-3xl overflow-hidden">
          <MenuItem icon="help-circle-outline"   label="Help Center"      iconBg="#2E2214" iconColor="#FDF6EC" onPress={() => router.push('/help-center')} />
          <Divider />
          <MenuItem icon="chatbubble-outline"    label="Contact Support"  iconBg="#2E2214" iconColor="#FDF6EC" onPress={() => router.push('/contact-support')} />
          <Divider />
          <MenuItem icon="shield-outline"        label="Privacy Policy"   iconBg="#2E2214" iconColor="#FDF6EC" onPress={() => router.push('/privacy-policy')} />
          <Divider />
          <MenuItem icon="document-text-outline" label="Terms of Service" iconBg="#2E2214" iconColor="#FDF6EC" onPress={() => router.push('/terms-of-service')} />
          <Divider />
          <MenuItem icon="information-circle-outline" label="About Vendr" sublabel={`Version 1.0.0`} iconBg="#2E2214" iconColor="#E8521A" onPress={() => router.push('/about-app')} />
        </View>

        {/* Account Actions */}
        <SectionHeader title="Account Actions" />
        <View className="mx-5 bg-dark-2 border border-faint rounded-3xl overflow-hidden">
          <MenuItem icon="log-out-outline" label="Sign Out"       iconBg="rgba(232,85,85,0.15)" danger onPress={handleLogout}        rightElement={<View />} />
          <Divider />
          <MenuItem icon="trash-outline"   label="Delete Account" sublabel="Permanently remove your account" iconBg="rgba(232,85,85,0.15)" danger onPress={handleDeleteAccount} rightElement={<View />} />
        </View>

        <TouchableOpacity onPress={() => router.push('/about-app')} activeOpacity={0.7} style={{ alignItems: 'center', marginTop: 24, marginBottom: 4 }}>
          <Text className="text-faint text-xs">Vendr v1.0.0 — Made with love in Lagos</Text>
        </TouchableOpacity>
      </ScrollView>

      {alertElement}
    </View>
  );
}