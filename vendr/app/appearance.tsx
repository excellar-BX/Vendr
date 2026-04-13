import { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { apiFetch } from '../lib/api';
import { useAuthStore, FontSize } from '../stores/authStore';

const LANGUAGES = ['English', 'Yoruba', 'Igbo', 'Hausa', 'Pidgin'];
const FONT_SIZES: { label: FontSize; desc: string }[] = [
  { label: 'Small',  desc: 'Compact, fits more on screen' },
  { label: 'Normal', desc: 'Default size, recommended' },
  { label: 'Large',  desc: 'Easier to read' },
];

export default function AppearanceScreen() {
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
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />

      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-faint gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-xl flex-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Appearance</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#E8521A" />
            : <Text className="text-orange text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={{ padding: 20, gap: 28 }}>
        {/* Language */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#9A8570', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Language
          </Text>
          <View className="bg-dark-2 border border-faint rounded-3xl overflow-hidden">
            {LANGUAGES.map((lang, i) => (
              <TouchableOpacity
                key={lang}
                onPress={() => setSelectedLang(lang)}
                activeOpacity={0.75}
                className="flex-row items-center px-4 py-4"
                style={i < LANGUAGES.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#3D3026' } : {}}
              >
                <Text className="flex-1 text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>{lang}</Text>
                {selectedLang === lang && <Ionicons name="checkmark-circle" size={20} color="#E8521A" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Font Size */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#9A8570', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Text Size
          </Text>
          <View className="bg-dark-2 border border-faint rounded-3xl overflow-hidden">
            {FONT_SIZES.map(({ label, desc }, i) => (
              <TouchableOpacity
                key={label}
                onPress={() => { setSelectedSize(label); setFontSize(label); }}
                activeOpacity={0.75}
                className="flex-row items-center px-4 py-4 gap-3"
                style={i < FONT_SIZES.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#3D3026' } : {}}
              >
                <View className="flex-1">
                  <Text className="text-cream" style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14 * (label === 'Small' ? 0.88 : label === 'Large' ? 1.14 : 1) }}>
                    {label}
                  </Text>
                  <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#9A8570', marginTop: 2 }}>{desc}</Text>
                </View>
                {selectedSize === label && <Ionicons name="checkmark-circle" size={20} color="#E8521A" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Live preview */}
          <View className="bg-dark-2 border border-orange/30 rounded-2xl px-4 py-3 gap-1">
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#E8521A', textTransform: 'uppercase', letterSpacing: 1 }}>Preview</Text>
            <Text className="text-cream" style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 * (selectedSize === 'Small' ? 0.88 : selectedSize === 'Large' ? 1.14 : 1) }}>
              Amala & Ewedu — ₦1,200
            </Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13 * (selectedSize === 'Small' ? 0.88 : selectedSize === 'Large' ? 1.14 : 1), color: '#9A8570' }}>
              Mama Titi's Kitchen · 1.2km away
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}