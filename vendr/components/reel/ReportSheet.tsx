import { useEffect, useState } from 'react';
import { View, Modal, Pressable, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/StyledText';
import { reelSocialApi, REPORT_REASONS } from '../../lib/api';
import { T, useTheme } from '../../constants/theme';

/** "Report post" bottom sheet. onDone(true) when the report was filed (caller can hide the post). */
export function ReportSheet({ reelId, visible, onClose, onDone }: {
  reelId: string | null;
  visible: boolean;
  onClose: () => void;
  onDone: (reelId: string) => void;
}) {
  useTheme();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (visible) { setReason(null); setDetails(''); setState('idle'); setMessage(''); }
  }, [visible, reelId]);

  const submit = async () => {
    if (!reelId || !reason) return;
    setState('sending');
    try {
      const { data } = await reelSocialApi.report(reelId, reason, details.trim() || undefined);
      setMessage(data?.already_reported ? "You've already reported this post — we're on it." : "Thanks — we'll review this post. You won't see it in your feed again.");
      setState('sent');
      onDone(reelId);
    } catch (e: any) {
      setMessage(e?.statusCode ? (e?.message ?? 'Please try again.') : 'Check your connection and try again.');
      setState('error');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ backgroundColor: T.canvas, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 16 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: T.lineStrong, alignSelf: 'center', marginBottom: 14 }} />

          {state === 'sent' ? (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
              <Ionicons name="shield-checkmark" size={44} color={T.success} />
              <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Report received</Text>
              <Text style={{ fontSize: 14, color: T.ink3, textAlign: 'center', lineHeight: 20 }}>{message}</Text>
              <TouchableOpacity onPress={onClose} style={{ marginTop: 8, backgroundColor: T.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12 }}>
                <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: T.onPrimary }}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: T.ink }}>Report post</Text>
              <Text style={{ fontSize: 13, color: T.ink3, marginTop: 2, marginBottom: 14 }}>Your report is anonymous. What's wrong with it?</Text>
              {REPORT_REASONS.map((r) => {
                const active = reason === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => setReason(r.key)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line }}
                  >
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? T.primary : T.ink4} />
                    <Text style={{ fontSize: 15, color: T.ink, fontFamily: active ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_400Regular' }}>{r.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {!!reason && (
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Anything else we should know? (optional)"
                  placeholderTextColor={T.ink4}
                  multiline
                  maxLength={500}
                  style={{ marginTop: 14, minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: T.ink, textAlignVertical: 'top' }}
                />
              )}
              {state === 'error' && <Text style={{ fontSize: 13, color: T.dangerInk, marginTop: 10 }}>{message}</Text>}
              <TouchableOpacity
                onPress={submit}
                disabled={!reason || state === 'sending'}
                style={{ marginTop: 16, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: reason ? T.danger : T.surface2 }}
              >
                {state === 'sending'
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: reason ? '#FFFFFF' : T.ink4 }}>Submit report</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
