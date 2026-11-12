import "../global.css";
import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, useColorScheme } from 'react-native';
import { vars } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom API & Stores
import { apiFetch, getAccessToken, clearTokens } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { usePresenceStore } from '../stores/presenceStore';
import SplashScreenView from '../components/SplashScreenView';
import { startSocket, stopSocket as disconnectSocket, onSocketEvent } from '../lib/socket';
import { setChatCacheScope, clearChatCache } from '../lib/chatCache';
import { startOutbox, resetOutbox } from '../lib/chatOutbox';
import {
  registerPushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener
} from '../lib/notifications';
import { NetworkToast } from '../components/ui/NetworkToast';
import { useNetwork } from '../hooks/useNetwork';
import { T, useTheme, useThemeStore, THEME_VARS } from '../constants/theme';

const THEME_STYLES = { light: vars(THEME_VARS.light), dark: vars(THEME_VARS.dark) };

/** Resolves System/Light/Dark into the live theme. */
function useResolveTheme() {
  const system = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const applyScheme = useThemeStore((s) => s.applyScheme);
  const resolved = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  // Layout effect runs before paint, so there is no light/dark flash.
  useLayoutEffect(() => {
    applyScheme(resolved);
    // Native window background behind screens (avoids white flashes in dark mode)
    SystemUI.setBackgroundColorAsync(T.canvas).catch(() => {});
  }, [resolved, applyScheme]);
  return resolved;
}

SplashScreen.preventAutoHideAsync();

// React Query Setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'vendr-query-cache',
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : 'production',
  integrations: [Sentry.mobileReplayIntegration()],
});

function RootLayout() {
  useTheme();
  const scheme = useResolveTheme();
  const { setUser, user, clear, justLoggedOut, setJustLoggedOut } = useAuthStore();
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  const { isOnline } = useNetwork();
  // The offline toast can be dismissed; it comes back the next time the connection drops
  const [offlineToastDismissed, setOfflineToastDismissed] = useState(false);
  useEffect(() => { if (isOnline) setOfflineToastDismissed(false); }, [isOnline]);

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // 1. Bootstrap Auth
  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = await getAccessToken();
      try {
        console.log("🔐 Starting auth bootstrap...");
        console.log("🔑 Token exists:", !!token);

        if (!token) {
          // No token at all — genuine first-time / logged-out user
          // But only clear store if there's no persisted user already loaded.
          // The persist middleware may have already rehydrated user from AsyncStorage;
          // if there's no token, that cached user is stale — clear it.
          clear();
          disconnectSocket();
          console.log("❌ No token found - user not logged in");
        } else {
          try {
            console.log("🔍 Validating token with /users/me...");
            const response = await apiFetch('/users/me');
            const userData = response.data;
            console.log("✅ Token valid, user:", userData.email);

            if (userData?.is_deleted) {
              await clearTokens();
              clear();
              disconnectSocket();
              setSessionExpired(true);
              console.log("🚫 User account deleted");
            } else {
              setUser(userData);
              Sentry.setUser({ id: userData.id, email: userData.email });

              // Realtime connection is started by the user-keyed effect below

              if (userData?.notifications_enabled !== false) {
                registerPushToken(userData.id);
              }

              if (sessionExpired) setSessionExpired(false);
              console.log("✅ User successfully logged in");
            }
          } catch (validationError: any) {
            console.log("❌ Token validation failed:", validationError.statusCode, validationError.message);

            if (validationError.statusCode === 401) {
              // Genuine auth failure — token is expired/invalid. Boot them out.
              await clearTokens();
              clear();
              disconnectSocket();
              setSessionExpired(true);
              console.log("🚫 Token expired - session expired");
            } else {
              // Network error or server unreachable.
              // Token exists + persisted user in store = treat as logged in (offline mode).
              // The persist middleware already rehydrated `user` from AsyncStorage before
              // this effect runs, so we don't need to do anything here — just let it ride.
              console.log("⚠️ Network error during validation - using cached user if available");
            }
          }
        }
      } catch (error: any) {
        console.error("Auth bootstrap failed:", error);
        if (error.statusCode === 401 || error.message?.includes('session')) {
          await clearTokens();
          clear();
          disconnectSocket();
          setSessionExpired(true);
        }
        // Non-auth errors: keep persisted user, let routing handle it
      } finally {
        setAppReady(true);
      }
    };

    bootstrapAuth();

    // 2. Notification Listeners
    responseListener.current = addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (!data) return;

      switch (data.type) {
        case 'message':
          if (data.conversation_id) {
            router.push({
              pathname: '/chat/[conversationId]',
              params: { conversationId: data.conversation_id },
            });
          }
          break;
        case 'review': router.push('/reviews'); break;
        // Comments, replies and "a store you follow posted" open the post
        case 'reel_comment':
        case 'new_post':
          if (data.reel_id) router.push({ pathname: '/reel/[reelId]', params: { reelId: data.reel_id } });
          else router.push('/notifications');
          break;
        case 'order': router.push('/orders'); break;
        default: router.push('/notifications');
      }
    });

    notificationListener.current = addNotificationReceivedListener(notification => {
      console.log('[Push] Foreground notification:', notification.request.content.title);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // 2b. Realtime: the socket follows the logged-in user (login, logout, account switch)
  const userId = user?.id;
  const prevUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const presence = usePresenceStore.getState();
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = userId;
    if (!userId) {
      disconnectSocket();
      presence.clearPresence();
      // Only a real logout wipes on-device chats — not the brief "no user yet" at launch
      if (prevUserId) {
        resetOutbox();
        clearChatCache();
        setChatCacheScope(null);
      }
      return;
    }
    if (prevUserId && prevUserId !== userId) {
      // Switched accounts without a logout in between
      clearChatCache();
    }
    setChatCacheScope(userId);
    startSocket();
    startOutbox(userId);
    const offs = [
      onSocketEvent('connect', () => usePresenceStore.getState().bumpConnectionEpoch()),
      onSocketEvent('user_presence', (d: { userId: string; isOnline: boolean; lastSeen?: string }) => {
        usePresenceStore.getState().setUserPresence(d.userId, d.isOnline, d.lastSeen);
      }),
      onSocketEvent('user_typing', (d: { conversationId: string; userId: string; isTyping: boolean }) => {
        if (d.userId !== userId) usePresenceStore.getState().setTyping(d.conversationId, d.userId, d.isTyping);
      }),
      // In-app notifications: bell badge updates instantly instead of every minute
      onSocketEvent('notification_new', () => {
        queryClient.setQueryData<number>(['unread-notifications-count'], (n) => (n ?? 0) + 1);
        queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      }),
      onSocketEvent('notifications_read', () => {
        queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      }),
      // A message arriving means they've stopped typing
      onSocketEvent('new_message', (m: { conversation_id: string; sender_id: string }) => {
        if (m.sender_id !== userId) usePresenceStore.getState().setTyping(m.conversation_id, m.sender_id, false);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [userId]);

  // 3. Handle Splash visibility
  useEffect(() => {
    if (appReady && (fontsLoaded || fontError)) {
      const timer = setTimeout(() => {
        SplashScreen.hideAsync();
        setShowSplash(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [appReady, fontsLoaded, fontError]);

  // 4. Routing Logic
  useEffect(() => {
    if (!showSplash && appReady) {
      // Handle intentional logout first
      if (justLoggedOut) {
        // Clear the flag and navigate to login
        setJustLoggedOut(false);
        router.replace('/(auth)/login');
        return;
      }

      if (user) {
        if (user.is_verified) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/verify-email');
        }
      } else if (sessionExpired) {
        router.replace('/(auth)/login?expired=true');
      } else {
        router.replace('/(auth)/welcome');
      }
    }
  }, [showSplash, appReady, user, sessionExpired, justLoggedOut, setJustLoggedOut]);

  if (showSplash || !appReady || (!fontsLoaded && !fontError)) {
    return (
      <View style={[{ flex: 1 }, THEME_STYLES[scheme]]}>
        <SplashScreenView />
      </View>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <View className="flex-1 bg-canvas" style={THEME_STYLES[scheme]}>
        <StatusBar style={T.statusBar} />
        <NetworkToast visible={!isOnline && !offlineToastDismissed} onDismiss={() => setOfflineToastDismissed(true)} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.canvas } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="vendor/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="become-vendor" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="orders" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="saved" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="reviews" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="chat/[conversationId]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="appearance" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="help-center" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="about-app" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="profile-view" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="reel-upload" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="reel-edit/[reelId]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="reel-insights" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="reel/[reelId]" options={{ animation: 'fade', headerShown: false }} />
          <Stack.Screen name="hashtag/[tag]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="contact-support" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="privacy-policy" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="terms-of-service" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="my-stores" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="store/[storeId]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="map-search" options={{ animation: "slide_from_bottom", presentation: "fullScreenModal" }} />
          <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="wallet" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="withdraw" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="add-bank-account" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="wallet-transactions" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="fund-wallet" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        </Stack>
      </View>
    </PersistQueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);