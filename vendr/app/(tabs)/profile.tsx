import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  View, ScrollView, TouchableOpacity,
  Image, Switch,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';
import { useVendrAlert } from '../../components/ui/VendrAlert';
import { apiFetch, getRefreshToken, clearTokens, userApi } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { clearPushToken } from '../../lib/notifications';
import { T, useTheme } from '../../constants/theme';
import { onSocketEvent, onSocketStatus, SocketStatus } from '../../lib/socket';
import { isTransientError } from '../../lib/chatOutbox';

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

function MenuItem({ icon, label, sublabel, onPress, rightElement, iconBg, iconColor = T.ink, danger = false }: MenuItemProps) {
  useTheme();
  const tint = danger ? T.dangerSoft : iconBg ?? (/^#[0-9A-Fa-f]{6}$/.test(iconColor) && iconColor !== T.ink && iconColor !== T.ink2 ? `${iconColor}1A` : T.surface2);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} className="flex-row items-center px-4 py-3.5 gap-3">
      <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: tint }}>
        <Ionicons name={icon} size={18} color={danger ? '#DC2626' : iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-sm" style={{ fontFamily: 'PlusJakartaSans_500Medium', color: danger ? T.dangerInk : T.ink }}>
          {label}
        </Text>
        {sublabel && <Text className="text-ink-2 text-xs mt-0.5">{sublabel}</Text>}
      </View>
      {rightElement ?? <Ionicons name="chevron-forward" size={16} color={T.ink4} />}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  useTheme();
  return (
    <Text className="text-ink-2 text-xs px-4 pt-5 pb-2 tracking-widest uppercase" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
      {title}
    </Text>
  );
}

function Divider() {
  useTheme();
  return <View className="h-px bg-line mx-4" />;
}

export default function ProfileScreen() {
  useTheme();
  const { user, setUser, setJustLoggedOut, clear, isRunnerMode, setRunnerMode } = useAuthStore();
  const { showAlert, alertElement } = useVendrAlert();
  const userId = user?.id;

  // Saved on the device (persisted query cache), so the profile shows instantly and
  // stays correct offline; refreshed quietly in the background.
  const profileQuery = useQuery({
    queryKey: ['profile-screen', userId],
    enabled: !!userId,
    gcTime: Infinity,
    staleTime: 0,
    retry: 1,
    queryFn: async () => {
      const [meRes, profileRes] = await Promise.all([
        apiFetch('/auth/me', { method: 'GET' }),
        userApi.getProfile(),
      ]);
      const me = meRes.data ?? {};
      const p = profileRes.data ?? {};
      return {
        name: p.full_name as string | undefined,
        avatar_url: p.avatar_url as string | null | undefined,
        notifications_enabled: p.notifications_enabled !== false,
        is_vendor: !!p.vendor,
        is_runner: !!p.is_runner,
        can_add_password: !!me.can_add_password,
        has_password: !!me.has_password,
        stats: {
          orders: p.stats?.orders ?? 0,
          reviews: p.stats?.reviews ?? 0,
          saved: p.stats?.saved ?? 0,
          runs: p.stats?.runs ?? 0,
        },
      };
    },
  });
  const profile = profileQuery.data ?? null;
  const stats = profile?.stats ?? null; // null = never loaded → show "–", not a misleading 0
  const canAddPassword = profile?.can_add_password ?? false;
  const hasPassword = profile?.has_password ?? false;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  useEffect(() => {
    if (profile) setNotificationsEnabled(profile.notifications_enabled);
  }, [profile?.notifications_enabled]);

  // Connection state, same as the chat screen
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connected');
  useEffect(() => onSocketStatus(setSocketStatus), []);
  const refetchProfile = profileQuery.refetch;
  // Back online → refresh
  useEffect(() => onSocketEvent('connect', () => { refetchProfile(); }), [refetchProfile]);
  const offline = (socketStatus !== 'connected' && socketStatus !== 'idle')
    || (profileQuery.isError && isTransientError(profileQuery.error));

  const email = user?.email ?? '';
  const name = profile?.name ?? user?.full_name ?? 'Vendr User';
  const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const isVendor = profile?.is_vendor === true;
  const isRunner = profile?.is_runner === true;
  const badgeLabel = isRunner ? 'Runner' : isVendor ? 'Vendor' : 'Buyer';
  const badgeIcon: IoniconsName = isRunner 
    ? 'bicycle-outline' 
    : isVendor 
    ? 'storefront-outline' 
    : 'person-outline';
  const badgeColor = isRunner ? T.successInk : isVendor ? T.goldInk : T.infoInk;
  const badgeBg = isRunner ? 'rgba(45,134,83,0.15)' : isVendor ? 'rgba(245,166,35,0.15)' : 'rgba(37,99,235,0.15)';
  const badgeBorder = isRunner ? 'rgba(45,134,83,0.3)' : isVendor ? 'rgba(245,166,35,0.3)' : 'rgba(37,99,235,0.35)';

  useFocusEffect(useCallback(() => {
    if (userId) refetchProfile();
  }, [userId, refetchProfile]));

  const savePreference = async (field: string, value: boolean) => {
    if (!userId) return;
    try {
      await apiFetch('/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      });
      refetchProfile();
    } catch (err) {
      // Don't pretend it saved
      if (field === 'notifications_enabled') setNotificationsEnabled(!value);
      showAlert({
        title: "Couldn't save",
        message: isTransientError(err) ? "You're offline. Try again when you're back online." : 'Please try again.',
        type: 'warning',
      });
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
              setUser(null);
              // Set flag to indicate intentional logout
              setJustLoggedOut(true);
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
    <View className="flex-1 bg-canvas">
      <StatusBar style={T.statusBar} />
      <View className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-orange opacity-[0.06]" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        <View className="flex-row items-center justify-between px-5 pt-14 pb-4">
          <View>
            <Text className="text-ink text-2xl" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Profile</Text>
            {offline && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.gold }} />
                <Text style={{ fontSize: 12.5, color: T.ink3, fontFamily: 'PlusJakartaSans_500Medium' }}>
                  {profile ? 'waiting for network…' : 'waiting for network… your profile will load when you reconnect'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Avatar card */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push('/profile-view')}
          className="mx-5 bg-surface border border-line rounded-3xl p-5 flex-row items-center gap-4 mb-2"
        >
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} className="w-16 h-16 rounded-2xl" />
          ) : (
            <View className="w-16 h-16 rounded-2xl bg-orange/20 border border-orange/30 items-center justify-center">
              <Text className="text-orange-ink text-xl" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{initials}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-ink text-lg" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{name}</Text>
            <Text className="text-ink-2 text-sm mt-0.5">{email}</Text>
            <View style={{
              alignSelf: 'flex-start', marginTop: 8,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: badgeBg,
              borderWidth: 1, borderColor: badgeBorder,
            }}>
              <Ionicons name={badgeIcon} size={11} color={badgeColor} />
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: badgeColor }}>
                {badgeLabel}
              </Text>
            </View>
          </View>
          <TouchableOpacity className="w-9 h-9 bg-surface-2 border border-line rounded-xl items-center justify-center" onPress={() => router.push('/edit-profile')}>
            <Ionicons name="pencil-outline" size={16} color={T.ink2} />
          </TouchableOpacity>
        </TouchableOpacity>
        {/* Stats row */}
        <View className="mx-5 flex-row gap-3 mb-2 mt-3">
          {[
            { label: 'Orders',  value: stats?.orders,  icon: 'bag-outline'      as IoniconsName, route: '/orders'  },
            { label: 'Reviews', value: stats?.reviews, icon: 'star-outline'     as IoniconsName, route: '/reviews' },
            { label: 'Saved',   value: stats?.saved,   icon: 'bookmark-outline' as IoniconsName, route: '/saved'   },
            ...(isRunner ? [{ label: 'Runs', value: stats?.runs, icon: 'bicycle-outline' as IoniconsName, route: '/runner-earnings' }] : []),
          ].map(stat => (
            <TouchableOpacity
              key={stat.label}
              onPress={() => router.push(stat.route as any)}
              activeOpacity={0.75}
              className="flex-1 bg-surface border border-line rounded-2xl p-3 items-center gap-1"
            >
              <Ionicons name={stat.icon} size={18} color={T.ink2} />
              <Text className="text-ink text-lg" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>{stat.value ?? '–'}</Text>
              <Text className="text-ink-2 text-xs">{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Account */}
        <SectionHeader title="Account" />
        <View className="mx-5 bg-surface border border-line rounded-3xl overflow-hidden">
          <MenuItem icon="person-outline"   label="Edit Profile"  sublabel="Update your name, photo and phone"   iconColor="#F5A623" onPress={() => router.push('/edit-profile')} />
          <Divider />
          <MenuItem icon="wallet-outline"   label="My Wallet"     sublabel="Balance, transactions & withdrawals" iconColor="#2D8653" onPress={() => router.push('/wallet')} />
          <MenuItem icon="bag-outline"      label="My Orders"     sublabel="Track your purchases"                iconColor="#E8521A" onPress={() => router.push('/orders')} />
          <Divider />
          <MenuItem icon="bookmark-outline" label="Saved Vendors" sublabel="Your favourite vendors"              iconColor="#2563EB" onPress={() => router.push('/saved')} />
          <Divider />
          <MenuItem icon="star-outline"     label="My Reviews"    sublabel="Reviews you have left"               iconColor="#F5A623" onPress={() => router.push('/reviews')} />
          {canAddPassword && (
            <>
              <Divider />
              <MenuItem icon="lock-closed-outline" label="Set Up Password" sublabel="Add password to log in with email" iconColor={T.ink2} onPress={() => router.push('/add-password')} />
            </>
          )}
          {hasPassword && (
            <>
              <Divider />
              <MenuItem icon="lock-closed-outline" label="Change Password" sublabel="Update your password" iconColor={T.ink2} onPress={() => router.push('/change-password')} />
            </>
          )}
        </View>

        {isVendor && (
          <>
            <SectionHeader title="My Business" />
            <TouchableOpacity
              activeOpacity={0.85} onPress={() => router.push('/my-stores')}
              className="mx-5 bg-surface border border-line rounded-3xl p-4 flex-row items-center gap-3 mb-2"
            >
              <View className="w-10 h-10 bg-orange/20 rounded-2xl items-center justify-center">
                <Ionicons name="storefront-outline" size={20} color="#E8521A" />
              </View>
              <View className="flex-1">
                <Text className="text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>My Stores</Text>
                <Text className="text-ink-2 text-xs mt-0.5">Manage your stores and products</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#E8521A" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85} onPress={() => router.push('/seller-analytics')}
              className="mx-5 bg-surface border border-line rounded-3xl p-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 bg-success/20 rounded-2xl items-center justify-center">
                <Ionicons name="stats-chart-outline" size={20} color="#2D8653" />
              </View>
              <View className="flex-1">
                <Text className="text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Seller Analytics</Text>
                <Text className="text-ink-2 text-xs mt-0.5">Track views, inquiries, and revenue</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#2D8653" />
            </TouchableOpacity>
          </>
        )}

        {!isVendor && !isRunner && (
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
                <Text className="text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Become a Vendor</Text>
                <Text className="text-ink-2 text-xs mt-0.5">Start selling to customers near you</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#E8521A" />
            </TouchableOpacity>
          </>
        )}

        {/* Become a Runner - visible if not vendor and not runner */}
        {!isVendor && !isRunner && (
          <>
            <SectionHeader title="Deliver on Vendr" />
            <TouchableOpacity
              activeOpacity={0.85} onPress={() => router.push('/become-runner')}
              className="mx-5 bg-success/10 border border-success/30 rounded-3xl p-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 bg-success/20 rounded-2xl items-center justify-center">
                <Ionicons name="bicycle-outline" size={20} color="#2D8653" />
              </View>
              <View className="flex-1">
                <Text className="text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Become a Runner</Text>
                <Text className="text-ink-2 text-xs mt-0.5">Earn money delivering orders</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#2D8653" />
            </TouchableOpacity>
          </>
        )}

        {/* Runner - active */}
        {isRunner && (
          <>
            <SectionHeader title="My Deliveries" />
            <View className="mx-5 bg-surface border border-line rounded-3xl p-4 flex-row items-center justify-between mb-2">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 bg-success/20 rounded-2xl items-center justify-center">
                  <Ionicons name={isRunnerMode ? 'flash' : 'flash-outline'} size={20} color="#2D8653" />
                </View>
                <View>
                  <Text className="text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Runner Mode</Text>
                  <Text className="text-ink-2 text-xs mt-0.5">{isRunnerMode ? 'Online - Accepting jobs' : 'Offline'}</Text>
                </View>
              </View>
              <Switch
                value={isRunnerMode}
                onValueChange={setRunnerMode}
                trackColor={{ false: T.ink4, true: '#2D8653' }}
                thumbColor="white"
              />
            </View>
            <TouchableOpacity
              activeOpacity={0.85} onPress={() => router.push('/runner-dashboard')}
              className="mx-5 bg-surface border border-line rounded-3xl p-4 flex-row items-center gap-3 mb-2"
            >
              <View className="w-10 h-10 bg-success/20 rounded-2xl items-center justify-center">
                <Ionicons name="bicycle-outline" size={20} color="#2D8653" />
              </View>
              <View className="flex-1">
                <Text className="text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Runner Dashboard</Text>
                <Text className="text-ink-2 text-xs mt-0.5">Available jobs and active runs</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#2D8653" />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85} onPress={() => router.push('/runner-earnings')}
              className="mx-5 bg-surface border border-line rounded-3xl p-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 bg-orange/20 rounded-2xl items-center justify-center">
                <Ionicons name="wallet-outline" size={20} color="#E8521A" />
              </View>
              <View className="flex-1">
                <Text className="text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Runner Earnings</Text>
                <Text className="text-ink-2 text-xs mt-0.5">Track your delivery income</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#E8521A" />
            </TouchableOpacity>
          </>
        )}


        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <View className="mx-5 bg-surface border border-line rounded-3xl overflow-hidden">
          <MenuItem
            icon="notifications-outline" label="Push Notifications" sublabel="Orders, chats and offers"
            iconColor={T.ink}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={v => { setNotificationsEnabled(v); savePreference('notifications_enabled', v); }}
                trackColor={{ false: T.ink4, true: '#E8521A' }} thumbColor="white"
              />
            }
          />
          <Divider />
          <MenuItem icon="color-palette-outline" label="Appearance" sublabel="Theme, language & text size" iconColor={T.ink2} onPress={() => router.push('/appearance')} />
        </View>

        {/* Support */}
        <SectionHeader title="Support" />
        <View className="mx-5 bg-surface border border-line rounded-3xl overflow-hidden">
          <MenuItem icon="help-circle-outline"   label="Help Center"      iconColor={T.ink} onPress={() => router.push('/help-center')} />
          <Divider />
          <MenuItem icon="chatbubble-outline"    label="Contact Support"  iconColor={T.ink} onPress={() => router.push('/contact-support')} />
          <Divider />
          <MenuItem icon="shield-outline"        label="Privacy Policy"   iconColor={T.ink} onPress={() => router.push('/privacy-policy')} />
          <Divider />
          <MenuItem icon="document-text-outline" label="Terms of Service" iconColor={T.ink} onPress={() => router.push('/terms-of-service')} />
          <Divider />
          <MenuItem icon="information-circle-outline" label="About Vendr" sublabel={`Version 1.0.0`} iconColor="#E8521A" onPress={() => router.push('/about-app')} />
        </View>

        {/* Account Actions */}
        <SectionHeader title="Account Actions" />
        <View className="mx-5 bg-surface border border-line rounded-3xl overflow-hidden">
          <MenuItem icon="log-out-outline" label="Sign Out"       danger onPress={handleLogout}        rightElement={<View />} />
          <Divider />
          <MenuItem icon="trash-outline"   label="Delete Account" sublabel="Permanently remove your account" danger onPress={handleDeleteAccount} rightElement={<View />} />
        </View>

        <TouchableOpacity onPress={() => router.push('/about-app')} activeOpacity={0.7} style={{ alignItems: 'center', marginTop: 24, marginBottom: 4 }}>
          <Text className="text-ink-3 text-xs">Vendr v1.0.0 — Made with love in Lagos</Text>
        </TouchableOpacity>
      </ScrollView>

      {alertElement}
    </View>
  );
}