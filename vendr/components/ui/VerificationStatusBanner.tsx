import { View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './StyledText';

interface VerificationStatusBannerProps {
  isVerified: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | null;
  rejectionReason?: string;
  vendorId?: string;
}

export function VerificationStatusBanner({ 
  isVerified, 
  verificationStatus,
  rejectionReason,
  vendorId 
}: VerificationStatusBannerProps) {
  // If verified, don't show banner (badge is shown elsewhere)
  if (isVerified) return null;

  // If no verification status, show "Get Verified" CTA
  if (!verificationStatus) {
    return (
      <TouchableOpacity
        onPress={() => router.push('/verification/submit')}
        className="bg-orange/10 border border-orange/30 rounded-2xl p-4 mx-4 mt-4"
      >
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-orange/20 items-center justify-center">
            <Ionicons name="shield-checkmark-outline" size={20} color="#E8521A" />
          </View>
          <View className="flex-1">
            <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              Get Verified
            </Text>
            <Text className="text-muted text-xs mt-0.5">
              Build trust with buyers by verifying your business
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B5E50" />
        </View>
      </TouchableOpacity>
    );
  }

  // Show status based on verification status
  if (verificationStatus === 'pending') {
    return (
      <View className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mx-4 mt-4">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center">
            <Ionicons name="time-outline" size={20} color="#3B82F6" />
          </View>
          <View className="flex-1">
            <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              Verification in Review
            </Text>
            <Text className="text-muted text-xs mt-0.5">
              Your verification request is being reviewed (3-4 business days)
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (verificationStatus === 'rejected') {
    return (
      <TouchableOpacity
        onPress={() => router.push('/verification/submit')}
        className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mx-4 mt-4"
      >
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center">
            <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
          </View>
          <View className="flex-1">
            <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>
              Verification Rejected
            </Text>
            <Text className="text-muted text-xs mt-0.5">
              {rejectionReason || 'Please resubmit with correct information'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6B5E50" />
        </View>
      </TouchableOpacity>
    );
  }

  return null;
}
