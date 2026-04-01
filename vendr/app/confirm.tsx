import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Text } from '../components/ui/StyledText';

export default function ConfirmScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const verify = async () => {
      const token_hash = params.token_hash as string;
      const token = params.token as string;
      const type = params.type as string;

      // Handle both token_hash and token formats
      const t = token_hash || token;

      if (t && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: t,
          type: type as any,
        });

        if (!error) {
          router.replace('/(tabs)');
        } else {
          console.log('Verify error:', error.message);
          router.replace('/(auth)/login');
        }
      } else {
        router.replace('/(auth)/login');
      }
    };

    verify();
  }, []);

  return (
    <View className="flex-1 bg-dark items-center justify-center gap-4">
      <ActivityIndicator size="large" color="#E8521A" />
      <Text weight="medium" className="text-muted text-sm">
        Verifying your email...
      </Text>
    </View>
  );
}