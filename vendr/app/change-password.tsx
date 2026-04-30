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
import { apiFetch, clearTokens } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function ChangePasswordScreen() {
  const { clear } = useAuthStore();
  const { alert, alertElement } = useVendrAlert();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      alert('Missing password', 'Please enter your current password', undefined, { type: 'warning' });
      return;
    }
    if (!newPassword.trim()) {
      alert('Missing password', 'Please enter a new password', undefined, { type: 'warning' });
      return;
    }
    if (newPassword.length < 8) {
      alert('Password too short', 'Password must be at least 8 characters', undefined, { type: 'warning' });
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords mismatch', 'New passwords do not match', undefined, { type: 'warning' });
      return;
    }
    if (currentPassword === newPassword) {
      alert('Same password', 'New password must be different from current password', undefined, { type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword.trim(),
          new_password: newPassword.trim(),
          confirm_password: confirmPassword.trim(),
        }),
      });

      alert('Success!', response.data.message, [
        { text: 'OK', onPress: async () => {
          await clearTokens();
          clear();
          router.replace('/(auth)/login');
        }},
      ], { type: 'success' });
    } catch (e: any) {
      alert('Error', e.message ?? 'Failed to change password', undefined, { type: 'danger' });
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
        <Text className="text-cream text-xl flex-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Change Password</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }} showsVerticalScrollIndicator={false}>
        {/* Info */}
        <View className="bg-orange/10 border border-orange/30 rounded-2xl p-4 gap-2">
          <View className="flex-row items-start gap-3">
            <Ionicons name="information-circle" size={20} color="#E8521A" />
            <View className="flex-1">
              <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
                Security notice
              </Text>
              <Text className="text-muted text-xs mt-1">
                You will be logged out of all devices after changing your password for security.
              </Text>
            </View>
          </View>
        </View>

        {/* Fields */}
        <View className="gap-4">
          <View>
            <Text className="text-muted text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Current Password</Text>
            <View className="relative">
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password" placeholderTextColor="#6B5E50"
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
                style={{ fontFamily: 'SpaceGrotesk_400Regular', color: '#FDF6EC', fontSize: 15, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#3D3026', borderRadius: 16, paddingHorizontal: 16, height: 56, paddingRight: 50 }}
              />
              <TouchableOpacity
                onPress={() => setShowCurrent(!showCurrent)}
                className="absolute right-4 top-1/2 -mt-3"
              >
                <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9A8570" />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text className="text-muted text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>New Password</Text>
            <View className="relative">
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Create a new password" placeholderTextColor="#6B5E50"
                secureTextEntry={!showNew}
                autoCapitalize="none"
                style={{ fontFamily: 'SpaceGrotesk_400Regular', color: '#FDF6EC', fontSize: 15, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#3D3026', borderRadius: 16, paddingHorizontal: 16, height: 56, paddingRight: 50 }}
              />
              <TouchableOpacity
                onPress={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -mt-3"
              >
                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9A8570" />
              </TouchableOpacity>
            </View>
            <Text className="text-muted text-xs mt-1.5 px-1">Minimum 8 characters</Text>
          </View>

          <View>
            <Text className="text-muted text-xs tracking-widest uppercase mb-2" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Confirm New Password</Text>
            <View className="relative">
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password" placeholderTextColor="#6B5E50"
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                style={{ fontFamily: 'SpaceGrotesk_400Regular', color: '#FDF6EC', fontSize: 15, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#3D3026', borderRadius: 16, paddingHorizontal: 16, height: 56, paddingRight: 50 }}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -mt-3"
              >
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9A8570" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Button label="Change Password" onPress={handleChangePassword} loading={loading} />
      </ScrollView>
    </View>
  );
}
