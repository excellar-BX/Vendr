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

// Custom API & Stores
import { apiFetch, getAccessToken, clearTokens } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import SplashScreenView from '../components/SplashScreenView';
import { 
  registerPushToken, 
  addNotificationReceivedListener, 
  addNotificationResponseReceivedListener 
} from '../lib/notifications';

SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : 'production',
  integrations: [Sentry.mobileReplayIntegration()],
});

function RootLayout() {
  const { setUser, user, clear } = useAuthStore();
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // 1. Bootstrap Auth (Custom API Pattern)
  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          clear();
        } else {
          const response = await apiFetch('/auth/me');
          const userData = response.data;

          if (userData?.is_deleted) {
            await clearTokens();
            clear();
          } else {
            setUser(userData);
            Sentry.setUser({ id: userData.id, email: userData.email });
            
            // Handle push tokens if enabled
            if (userData?.notifications_enabled !== false) {
              registerPushToken(userData.id);
            }
          }
        }
      } catch (error) {
        console.error("Auth bootstrap failed:", error);
        await clearTokens();
        clear();
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
      SplashScreen.hideAsync();
      const timer = setTimeout(() => setShowSplash(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [appReady, fontsLoaded, fontError]);

  // 4. Routing Logic
  useEffect(() => {
    if (!showSplash && appReady) {
      if (user) {
        if (user.is_verified) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/verify-email');
        }
      } else {
        router.replace('/(auth)/welcome');
      }
    }
  }, [showSplash, appReady, user]);

  if (showSplash || !appReady || (!fontsLoaded && !fontError)) {
    return <SplashScreenView />;
  }

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="vendor/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="confirm" />
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
  );
}

export default Sentry.wrap(RootLayout);