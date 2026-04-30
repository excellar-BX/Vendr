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

export default function AddPasswordScreen() {
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
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      {alertElement}

      {/* Header */}
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-faint gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-xl flex-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Set Up Password</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }} showsVerticalScrollIndicator={false}>
        {/* Info */}
        <View className="bg-orange/10 border border-orange/30 rounded-2xl p-4 gap-2">
          <View className="flex-row items-start gap-3">
            <Ionicons name="information-circle" size={20} color="#E8521A" />
            <View className="flex-1">
              <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                Add a password to your account
              </Text>
              <Text className="text-muted text-xs mt-1">
                After setting a password, you can log in with either your Google account or email/password.
              </Text>
            </View>
          </View>
        </View>

        {/* Fields */}
        <View className="gap-4">
          <View>
            <Text className="text-muted text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Password</Text>
            <View className="relative">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password" placeholderTextColor="#6B5E50"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={{ fontFamily: 'SpaceGrotesk_400Regular', color: '#FDF6EC', fontSize: 15, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#3D3026', borderRadius: 16, paddingHorizontal: 16, height: 56, paddingRight: 50 }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -mt-3"
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9A8570" />
              </TouchableOpacity>
            </View>
            <Text className="text-muted text-xs mt-1.5 px-1">Minimum 8 characters</Text>
          </View>

          <View>
            <Text className="text-muted text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Confirm Password</Text>
            <View className="relative">
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password" placeholderTextColor="#6B5E50"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                style={{ fontFamily: 'SpaceGrotesk_400Regular', color: '#FDF6EC', fontSize: 15, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#3D3026', borderRadius: 16, paddingHorizontal: 16, height: 56, paddingRight: 50 }}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -mt-3"
              >
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9A8570" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Button label="Set Password" onPress={handleAddPassword} loading={loading} />
      </ScrollView>
    </View>
  );
}
