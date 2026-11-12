import { useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, TextInput, TouchableOpacity, ActivityIndicator, Linking, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/StyledText';
import { T, useTheme } from '../../constants/theme';

/** Runner screens use green as their accent (matches the runner tab tint). */
export const RUNNER_GREEN = '#2D8653';

export const naira = (n: number) => `₦${Math.round(n ?? 0).toLocaleString()}`;

/** Turn-by-turn directions in Google Maps / Apple Maps. */
export async function openDirections(lat: number, lng: number, label?: string) {
  const q = `${lat},${lng}`;
  const native = Platform.OS === 'ios'
    ? `maps://?daddr=${q}&dirflg=d`
    : `google.navigation:q=${q}`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${q}${label ? `&destination_place_id=${encodeURIComponent(label)}` : ''}`;
  try {
    if (await Linking.canOpenURL(native)) return Linking.openURL(native);
  } catch {}
  return Linking.openURL(web);
}

export function callPhone(phone?: string | null) {
  if (!phone) return;
  Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {});
}

/**
 * Bottom sheet for typing a handoff code (seller's pickup code / buyer's delivery code).
 * Big digit boxes, numeric keypad, server error shown inline.
 */
export function CodeSheet({ visible, title, subtitle, length, icon, onSubmit, onClose }: {
  visible: boolean;
  title: string;
  subtitle: string;
  length: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onSubmit: (code: string) => Promise<void>;
  onClose: () => void;
}) {
  useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCode(''); setError(null); setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [visible]);

  const submit = async (value = code) => {
    if (value.length !== length || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Try again.');
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ backgroundColor: T.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 12, paddingBottom: insets.bottom + 20 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: T.lineStrong, alignSelf: 'center', marginBottom: 18 }} />
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: `${RUNNER_GREEN}1F`, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name={icon} size={26} color={RUNNER_GREEN} />
          </View>
          <Text style={{ fontSize: 19, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink }}>{title}</Text>
          <Text style={{ fontSize: 13.5, color: T.ink3, marginTop: 4, lineHeight: 19 }}>{subtitle}</Text>

          {/* Digit boxes (one hidden input drives them) */}
          <Pressable onPress={() => inputRef.current?.focus()} style={{ flexDirection: 'row', gap: 8, marginTop: 20, justifyContent: 'center' }}>
            {Array.from({ length }).map((_, i) => {
              const filled = i < code.length;
              const active = i === code.length && !busy;
              return (
                <View key={i} style={{
                  width: length > 4 ? 46 : 58, height: 58, borderRadius: 14,
                  borderWidth: 2, borderColor: error ? T.danger : active ? RUNNER_GREEN : T.line,
                  backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: T.ink }}>{filled ? code[i] : ''}</Text>
                </View>
              );
            })}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(t) => {
              const v = t.replace(/\D/g, '').slice(0, length);
              setCode(v);
              setError(null);
              if (v.length === length) submit(v);
            }}
            keyboardType="number-pad"
            maxLength={length}
            style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
            accessibilityLabel={title}
          />

          {error && <Text style={{ fontSize: 13, color: T.dangerInk, textAlign: 'center', marginTop: 12 }}>{error}</Text>}

          <TouchableOpacity
            onPress={() => submit()}
            disabled={code.length !== length || busy}
            style={{ marginTop: 20, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: code.length === length ? RUNNER_GREEN : T.surface2 }}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: code.length === length ? '#FFFFFF' : T.ink4 }}>Confirm</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Coloured info strip at the top of runner screens (pending approval, offline…). */
export function RunnerBanner({ tone, icon, title, body, action }: {
  tone: 'warn' | 'info' | 'danger';
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  useTheme();
  const c = tone === 'warn' ? { bg: T.goldSoft, fg: T.goldInk } : tone === 'danger' ? { bg: T.dangerSoft, fg: T.dangerInk } : { bg: T.infoSoft, fg: T.infoInk };
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, backgroundColor: c.bg }}>
      <Ionicons name={icon} size={20} color={c.fg} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, fontFamily: 'PlusJakartaSans_700Bold', color: c.fg }}>{title}</Text>
        {!!body && <Text style={{ fontSize: 12.5, color: c.fg, marginTop: 2, lineHeight: 17 }}>{body}</Text>}
        {action && (
          <TouchableOpacity onPress={action.onPress} style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: c.fg, textDecorationLine: 'underline' }}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
