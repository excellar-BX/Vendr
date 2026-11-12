import { useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { TextInput } from 'react-native';
import { Button } from '../components/ui/Button';
import { useVendrAlert } from '../components/ui/VendrAlert';
import { apiFetch } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { T, useTheme } from '../constants/theme';

export default function AddPasswordScreen() {
  useTheme();
  const { user, setUser } = useAuthStore();
  const { alert, alertElement } = useVendrAlert();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleAddPassword = async () => {
    if (!password.trim()) {
      alert('Missing password', 'Please enter a password', undefined, { type: 'warning' });
      return;
    }
    if (password.length < 8) {
      alert('Password too short', 'Password must be at least 8 characters', undefined, { type: 'warning' });
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords mismatch', 'Passwords do not match', undefined, { type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch('/auth/add-password', {
        method: 'POST',
        body: JSON.stringify({
          password: password.trim(),
          confirm_password: confirmPassword.trim(),
        }),
      });

      alert('Success!', response.data.message, [
        { text: 'OK', onPress: () => router.back() },
      ], { type: 'success' });
    } catch (e: any) {
      alert('Error', e.message ?? 'Failed to add password', undefined, { type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      <StatusBar style={T.statusBar} />
      {alertElement}

      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-line gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={T.ink} />
        </TouchableOpacity>
        <Text className="text-ink text-xl flex-1" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>Set Up Password</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }} showsVerticalScrollIndicator={false}>
        {/* Info */}
        <View className="bg-orange/10 border border-orange/30 rounded-2xl p-4 gap-2">
          <View className="flex-row items-start gap-3">
            <Ionicons name="information-circle" size={20} color="#E8521A" />
            <View className="flex-1">
              <Text className="text-ink text-sm" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                Add a password to your account
              </Text>
              <Text className="text-ink-2 text-xs mt-1">
                After setting a password, you can log in with either your Google account or email/password.
              </Text>
            </View>
          </View>
        </View>

        {/* Fields */}
        <View className="gap-4">
          <View>
            <Text className="text-ink-2 text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>Password</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password" placeholderTextColor={T.ink3}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={{ fontFamily: 'PlusJakartaSans_400Regular', color: T.ink, fontSize: 15, backgroundColor: T.surface, borderWidth: 1, borderColor: T.lineStrong, borderRadius: 16, paddingHorizontal: 16, height: 56, paddingRight: 50 }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -mt-3"
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.ink2} />
              </TouchableOpacity>
            </View>
            <Text className="text-ink-2 text-xs mt-1.5 px-1">Minimum 8 characters</Text>
          </View>

          <View>
            <Text className="text-ink-2 text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'PlusJakartaSans_600SemiBold' }}>Confirm Password</Text>
            <View className="relative">
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password" placeholderTextColor={T.ink3}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                style={{ fontFamily: 'PlusJakartaSans_400Regular', color: T.ink, fontSize: 15, backgroundColor: T.surface, borderWidth: 1, borderColor: T.lineStrong, borderRadius: 16, paddingHorizontal: 16, height: 56, paddingRight: 50 }}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -mt-3"
              >
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.ink2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Button label="Set Password" onPress={handleAddPassword} loading={loading} />
      </ScrollView>
    </View>
  );
}
