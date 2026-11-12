import { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './StyledText';
import { T, useTheme } from '../../constants/theme';

interface NetworkToastProps {
  visible: boolean;
  onDismiss?: () => void;
}

export function NetworkToast({ visible, onDismiss }: NetworkToastProps) {
  useTheme();
  const insets = useSafeAreaInsets();
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
      // When hidden it must not swallow taps meant for headers / back buttons underneath
      pointerEvents={visible ? 'box-none' : 'none'}
      style={{
        position: 'absolute',
        top: insets.top,
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
          backgroundColor: T.surface,
          borderWidth: 1,
          borderColor: T.line,
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: '#1C1917',
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
            backgroundColor: T.dangerSoft,
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
              fontFamily: 'PlusJakartaSans_600SemiBold',
              fontSize: 13,
              color: T.ink,
              marginBottom: 1,
            }}
          >
            No Internet Connection
          </Text>
          <Text
            style={{
              fontFamily: 'PlusJakartaSans_400Regular',
              fontSize: 11,
              color: T.ink3,
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
            backgroundColor: T.ink,
          }}
        >
          <Text
            style={{
              fontFamily: 'PlusJakartaSans_600SemiBold',
              fontSize: 12,
              color: T.canvas,
            }}
          >
            Settings
          </Text>
        </TouchableOpacity>

        {/* Dismiss */}
        <TouchableOpacity
          onPress={onDismiss}
          activeOpacity={0.7}
          hitSlop={12}
          accessibilityLabel="Dismiss"
          style={{ padding: 4 }}
        >
          <Ionicons name="close" size={18} color={T.ink3} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}