import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/StyledText';

// ─── Placeholder for Expo Go ───────────────────────────────────────────────────
// Reels require expo-video which needs a dev build. This placeholder works in Expo Go.
// To enable full reels: run `npx expo prebuild --clean` then `npx expo run:ios`
// and restore the original reels.tsx from git history.

export default function ReelsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
      <StatusBar style="light" />
      <View style={{
        width: 72, height: 72, borderRadius: 24,
        backgroundColor: 'rgba(232, 82, 26, 0.15)',
        borderWidth: 1.5, borderColor: 'rgba(232, 82, 26, 0.4)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <Ionicons name="play-circle" size={36} color="#E8521A" />
      </View>

      <Text style={{
        fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26,
        color: '#FDF6EC', letterSpacing: 0.5,
        marginBottom: 10, textAlign: 'center',
      }}>
        Coming Soon
      </Text>

      <Text style={{
        fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14,
        color: 'rgba(253, 246, 236, 0.5)',
        textAlign: 'center', lineHeight: 22,
      }}>
        Vendor reels require a development build.{'\n'}Use Expo Go for now.
      </Text>
    </View>
  );
}