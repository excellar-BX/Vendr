import { View, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';
import { useAuthStore } from '../stores/authStore';

const WHATSAPP_NUMBER = '2348000000000'; // replace with real number
const SUPPORT_EMAIL = 'support@vendr.ng';

export default function ContactSupportScreen() {
  const { session, profile } = useAuthStore();
  const name = profile?.name ?? 'User';
  const email = session?.user?.email ?? '';

  const openWhatsApp = async () => {
    const message = encodeURIComponent(`Hi Vendr Support! My name is ${name} (${email}). I need help with:`);
    const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${message}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not installed', 'Please contact us via email instead.');
    }
  };

  const openEmail = () => {
    const subject = encodeURIComponent('Vendr Support Request');
    const body = encodeURIComponent(`Hi Vendr Support,\n\nMy name is ${name}.\nAccount email: ${email}\n\nIssue:\n`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-faint gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-xl flex-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Contact Support</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
        <Text className="text-muted text-sm" style={{ fontFamily: 'SpaceGrotesk_400Regular', lineHeight: 22 }}>
          Our support team is available Monday – Saturday, 8am to 8pm WAT. We typically respond within 2 hours.
        </Text>

        {/* WhatsApp */}
        <TouchableOpacity
          onPress={openWhatsApp}
          activeOpacity={0.85}
          className="bg-dark-2 border border-faint rounded-2xl p-5 flex-row items-center gap-4"
        >
          <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: '#25D36620' }}>
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
          </View>
          <View className="flex-1">
            <Text className="text-cream text-base" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>WhatsApp</Text>
            <Text className="text-muted text-xs mt-0.5">Fastest response — usually under 30 mins</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#E8521A" />
        </TouchableOpacity>

        {/* Email */}
        <TouchableOpacity
          onPress={openEmail}
          activeOpacity={0.85}
          className="bg-dark-2 border border-faint rounded-2xl p-5 flex-row items-center gap-4"
        >
          <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: '#5599E820' }}>
            <Ionicons name="mail-outline" size={24} color="#5599E8" />
          </View>
          <View className="flex-1">
            <Text className="text-cream text-base" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Email</Text>
            <Text className="text-muted text-xs mt-0.5">{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#E8521A" />
        </TouchableOpacity>

        {/* Response hours */}
        <View className="bg-dark-2 border border-faint rounded-2xl px-4 py-4 gap-3">
          <Text className="text-muted text-xs tracking-widest uppercase" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Support Hours</Text>
          {[
            { day: 'Monday – Friday', hours: '8:00 AM – 8:00 PM' },
            { day: 'Saturday', hours: '9:00 AM – 5:00 PM' },
            { day: 'Sunday', hours: 'Closed' },
          ].map(({ day, hours }) => (
            <View key={day} className="flex-row justify-between">
              <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>{day}</Text>
              <Text className="text-muted text-sm" style={{ fontFamily: 'SpaceGrotesk_400Regular' }}>{hours}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}