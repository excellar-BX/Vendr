import { Platform } from 'react-native';
import { supabase } from './supabase';

// Expo Go on SDK 53+ does not support push notifications.
// We lazy-import expo-notifications only when needed so the module
// doesn't crash on load in Expo Go.

function isExpoGo(): boolean {
  try {
    // expo-constants tells us if we're in Expo Go
    const Constants = require('expo-constants').default;
    return Constants.executionEnvironment === 'storeClient';
  } catch {
    return false;
  }
}

// Set notification handler — only outside Expo Go
if (!isExpoGo()) {
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {}
}

export async function registerPushToken(userId: string): Promise<string | null> {
  // Push tokens don't work in Expo Go from SDK 53+
  if (isExpoGo()) {
    console.log('[Push] Skipping — Expo Go does not support push notifications from SDK 53+');
    return null;
  }

  try {
    const Notifications = require('expo-notifications');
    const Device = require('expo-device');

    if (!Device.isDevice) {
      console.log('[Push] Skipping — not a physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission denied');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E8521A',
      });
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        lightColor: '#E8521A',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = tokenData.data;
    console.log('[Push] Token:', token);

    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) console.warn('[Push] Failed to save token:', error.message);
    return token;
  } catch (e: any) {
    console.warn('[Push] Failed to register:', e?.message);
    return null;
  }
}

export async function clearPushToken(userId: string) {
  try {
    await supabase
      .from('profiles')
      .update({ push_token: null })
      .eq('id', userId);
  } catch {}
}

// Listener helpers — safe to call anywhere, no-ops in Expo Go
export function addNotificationReceivedListener(handler: (n: any) => void) {
  if (isExpoGo()) return { remove: () => {} };
  try {
    const Notifications = require('expo-notifications');
    return Notifications.addNotificationReceivedListener(handler);
  } catch {
    return { remove: () => {} };
  }
}

export function addNotificationResponseReceivedListener(handler: (r: any) => void) {
  if (isExpoGo()) return { remove: () => {} };
  try {
    const Notifications = require('expo-notifications');
    return Notifications.addNotificationResponseReceivedListener(handler);
  } catch {
    return { remove: () => {} };
  }
}