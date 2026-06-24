import { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './StyledText';

interface NetworkToastProps {
  visible: boolean;
  onDismiss?: () => void;
}

export function NetworkToast({ visible, onDismiss }: NetworkToastProps) {
  const translateYAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateYAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 220,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateYAnim, {
          toValue: -80,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleOpenSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('App-Prefs:WIFI');
      } else if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      }
    } catch (error) {
      try {
        if (Platform.OS === 'android') {
          await Linking.openSettings();
        }
      } catch (fallbackError) {
        console.error('Failed to open settings:', fallbackError);
      }
    }
    onDismiss?.();
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: Platform.OS === 'ios' ? 54 : 28,
        left: 0,
        right: 0,
        alignItems: 'center',
        transform: [{ translateY: translateYAnim }],
        opacity: opacityAnim,
        zIndex: 9999,
        paddingHorizontal: '2.5%',
        marginTop: 10,
      }}
    >
      <View
        style={{
          width: '95%',
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        {/* Icon */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: '#FEE2E2',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="wifi-outline" size={17} color="#DC2626" />
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 13,
              color: '#111827',
              marginBottom: 1,
            }}
          >
            No Internet Connection
          </Text>
          <Text
            style={{
              fontFamily: 'SpaceGrotesk_400Regular',
              fontSize: 11,
              color: '#9CA3AF',
              lineHeight: 15,
            }}
          >
            Check your network settings
          </Text>
        </View>

        {/* Settings button */}
        <TouchableOpacity
          onPress={handleOpenSettings}
          activeOpacity={0.75}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 8,
            backgroundColor: '#111827',
          }}
        >
          <Text
            style={{
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 12,
              color: '#FFFFFF',
            }}
          >
            Settings
          </Text>
        </TouchableOpacity>

        {/* Dismiss */}
        <TouchableOpacity
          onPress={onDismiss}
          activeOpacity={0.7}
          style={{ padding: 4 }}
        >
          <Ionicons name="close" size={18} color="#D1D5DB" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}