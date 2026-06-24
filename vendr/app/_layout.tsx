import "../global.css";
import { useEffect, useState, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import * as Sentry from '@sentry/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom API & Stores
import { apiFetch, getAccessToken, clearTokens } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import SplashScreenView from '../components/SplashScreenView';
import { connectSocket, disconnectSocket } from '../lib/socket';
import {
  registerPushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener
} from '../lib/notifications';
import { NetworkToast } from '../components/ui/NetworkToast';
import { useNetwork } from '../hooks/useNetwork';

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
  const { setUser, user, clear, justLoggedOut, setJustLoggedOut } = useAuthStore();
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  const { isOnline } = useNetwork();

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
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

              connectSocket().catch(console.error);

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
    return <SplashScreenView />;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <View className="flex-1 bg-dark">
        <StatusBar style="light" />
        <NetworkToast visible={!isOnline} />
        <Stack screenOptions={{ headerShown: false }}>
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
          <Stack.Screen name="reel/[reelId]" options={{ animation: 'fade', headerShown: false }} />
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