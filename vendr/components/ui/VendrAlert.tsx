import { useEffect, useRef } from 'react';
import {
  Modal, View, TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './StyledText';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  icon?: IoniconsName;
  iconColor?: string;
  // Shorthand types that auto-configure icon + color
  type?: 'info' | 'success' | 'warning' | 'danger' | 'question';
};

interface VendrAlertProps {
  visible: boolean;
  config: AlertConfig | null;
  onDismiss: () => void;
}

const TYPE_CONFIG = {
  info:     { icon: 'information-circle-outline' as IoniconsName, color: '#5599E8' },
  success:  { icon: 'checkmark-circle-outline' as IoniconsName,   color: '#2D8653' },
  warning:  { icon: 'warning-outline' as IoniconsName,            color: '#F5A623' },
  danger:   { icon: 'alert-circle-outline' as IoniconsName,       color: '#E85555' },
  question: { icon: 'help-circle-outline' as IoniconsName,        color: '#E8521A' },
};

export function VendrAlert({ visible, config, onDismiss }: VendrAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 280 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!config) return null;

  const typeConf = config.type ? TYPE_CONFIG[config.type] : null;
  const icon = config.icon ?? typeConf?.icon;
  const iconColor = config.iconColor ?? typeConf?.color ?? '#E8521A';

  const buttons: AlertButton[] = config.buttons ?? [{ text: 'OK', style: 'default' }];

  const handlePress = (btn: AlertButton) => {
    onDismiss();
    btn.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      {/* Backdrop */}
      <Animated.View
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, opacity: opacityAnim }}
      >
        <Animated.View
          style={{
            width: '100%',
            backgroundColor: '#1A1208',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: '#2A1F14',
            overflow: 'hidden',
            transform: [{ scale: scaleAnim }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.4,
            shadowRadius: 24,
            elevation: 16,
          }}
        >
          {/* Body */}
          <View style={{ padding: 24, alignItems: 'center', gap: 12 }}>
            {/* Icon */}
            {icon && (
              <View style={{
                width: 56, height: 56, borderRadius: 18,
                backgroundColor: `${iconColor}18`,
                borderWidth: 1, borderColor: `${iconColor}30`,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 4,
              }}>
                <Ionicons name={icon} size={26} color={iconColor} />
              </View>
            )}

            {/* Title */}
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, color: '#FDF6EC', textAlign: 'center' }}>
              {config.title}
            </Text>

            {/* Message */}
            {config.message && (
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', textAlign: 'center', lineHeight: 22 }}>
                {config.message}
              </Text>
            )}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#2A1F14' }} />

          {/* Buttons */}
          <View style={{ flexDirection: buttons.length === 2 ? 'row' : 'column' }}>
            {buttons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              const isLast = i === buttons.length - 1;
              const showRightBorder = buttons.length === 2 && i === 0;

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => handlePress(btn)}
                  activeOpacity={0.7}
                  style={{
                    flex: buttons.length === 2 ? 1 : undefined,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRightWidth: showRightBorder ? 1 : 0,
                    borderRightColor: '#2A1F14',
                    borderBottomWidth: !isLast && buttons.length > 2 ? 1 : 0,
                    borderBottomColor: '#2A1F14',
                  }}
                >
                  <Text style={{
                    fontFamily: isCancel ? 'SpaceGrotesk_400Regular' : 'SpaceGrotesk_600SemiBold',
                    fontSize: 15,
                    color: isDestructive ? '#E85555' : isCancel ? '#6B5E50' : '#E8521A',
                  }}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Hook for easy usage anywhere ──────────────────────────────────────────────
import { useState } from 'react';

export function useVendrAlert() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig | null>(null);

  const showAlert = (cfg: AlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  };

  const hideAlert = () => setVisible(false);

  // Convenience: drop-in replacement for Alert.alert(title, message, buttons)
  const alert = (title: string, message?: string, buttons?: AlertButton[], extras?: Partial<AlertConfig>) => {
    showAlert({ title, message, buttons, ...extras });
  };

  const alertElement = (
    <VendrAlert visible={visible} config={config} onDismiss={hideAlert} />
  );

  return { alert, showAlert, hideAlert, alertElement };
}