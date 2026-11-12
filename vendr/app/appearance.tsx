import { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { apiFetch } from '../lib/api';
import { useAuthStore, FontSize } from '../stores/authStore';
import { T, useTheme, useThemeStore, ThemeMode } from '../constants/theme';

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { mode: 'light',  label: 'Light',  icon: 'sunny-outline' },
  { mode: 'dark',   label: 'Dark',   icon: 'moon-outline' },
];

const LANGUAGES = ['English', 'Yoruba', 'Igbo', 'Hausa', 'Pidgin'];
const FONT_SIZES: { label: FontSize; desc: string }[] = [
  { label: 'Small',  desc: 'Compact, fits more on screen' },
  { label: 'Normal', desc: 'Default size, recommended' },
  { label: 'Large',  desc: 'Easier to read' },
];

export default function AppearanceScreen() {
  useTheme();
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const { user, setFontSize } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English');
  const [selectedSize, setSelectedSize] = useState<FontSize>('Normal');

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await apiFetch('/users/me');
        setSelectedLang(response.data.language || 'English');
        setSelectedSize((response.data.font_size as FontSize) || 'Normal');
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
      }
    };

    if (user?.id) {
      fetchPreferences();
    }
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const response = await apiFetch('/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ language: selectedLang, font_size: selectedSize }),
      });

      setFontSize(selectedSize);
      setSaving(false);
      Alert.alert('Saved', 'Appearance updated.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update appearance');
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style={T.statusBar} />

      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-line gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text className="text-ink text-xl flex-1" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Appearance</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#E8521A" />
            : <Text className="text-orange-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={{ padding: 20, gap: 28 }}>
        {/* Theme */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: T.ink2, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Theme
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  onPress={() => setThemeMode(opt.mode)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.label} theme`}
                  style={{
                    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 16,
                    backgroundColor: active ? T.primarySoft : T.surface,
                    borderWidth: 1.5, borderColor: active ? T.primary : T.line,
                  }}
                >
                  <Ionicons name={opt.icon} size={22} color={active ? T.primary : T.ink2} />
                  <Text style={{ fontFamily: active ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_500Medium', fontSize: 13, color: active ? T.primaryInk : T.ink }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: T.ink3 }}>
            System follows your phone's light/dark setting. Changes apply instantly.
          </Text>
        </View>

        {/* Language */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: T.ink2, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Language
          </Text>
          <View className="bg-surface border border-line rounded-3xl overflow-hidden">
            {LANGUAGES.map((lang, i) => (
              <TouchableOpacity
                key={lang}
                onPress={() => setSelectedLang(lang)}
                activeOpacity={0.75}
                className="flex-row items-center px-4 py-4"
                style={i < LANGUAGES.length - 1 ? { borderBottomWidth: 1, borderBottomColor: T.lineStrong } : {}}
              >
                <Text className="flex-1 text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_500Medium' }}>{lang}</Text>
                {selectedLang === lang && <Ionicons name="checkmark-circle" size={20} color="#E8521A" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Font Size */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: T.ink2, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Text Size
          </Text>
          <View className="bg-surface border border-line rounded-3xl overflow-hidden">
            {FONT_SIZES.map(({ label, desc }, i) => (
              <TouchableOpacity
                key={label}
                onPress={() => { setSelectedSize(label); setFontSize(label); }}
                activeOpacity={0.75}
                className="flex-row items-center px-4 py-4 gap-3"
                style={i < FONT_SIZES.length - 1 ? { borderBottomWidth: 1, borderBottomColor: T.lineStrong } : {}}
              >
                <View className="flex-1">
                  <Text className="text-ink" style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14 * (label === 'Small' ? 0.88 : label === 'Large' ? 1.14 : 1) }}>
                    {label}
                  </Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: T.ink2, marginTop: 2 }}>{desc}</Text>
                </View>
                {selectedSize === label && <Ionicons name="checkmark-circle" size={20} color="#E8521A" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Live preview */}
          <View className="bg-surface border border-orange/30 rounded-2xl px-4 py-3 gap-1">
            <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: T.primaryInk, textTransform: 'uppercase', letterSpacing: 1 }}>Preview</Text>
            <Text className="text-ink" style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16 * (selectedSize === 'Small' ? 0.88 : selectedSize === 'Large' ? 1.14 : 1) }}>
              Amala & Ewedu — ₦1,200
            </Text>
            <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 * (selectedSize === 'Small' ? 0.88 : selectedSize === 'Large' ? 1.14 : 1), color: T.ink2 }}>
              Mama Titi's Kitchen · 1.2km away
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}