import { View, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect information you provide when creating an account (name, email, phone number), your location when you use the app, messages sent through our chat system, and transaction data for orders placed on the platform.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'Your information is used to connect you with nearby vendors, process orders and payments, send you relevant notifications, improve our services, and ensure platform safety and security.',
  },
  {
    title: '3. Information Sharing',
    body: 'We do not sell your personal data. We share information with vendors only as necessary to fulfill orders, and with payment processors (Paystack) to handle transactions securely.',
  },
  {
    title: '4. Data Security',
    body: 'We use industry-standard encryption and security practices to protect your data. Your password is never stored in plain text. Payment details are handled entirely by Paystack and never stored on our servers.',
  },
  {
    title: '5. Your Rights',
    body: 'You have the right to access, correct, or delete your personal data at any time. You can delete your account from the Profile screen. Data is permanently purged within 30 days of account deletion.',
  },
  {
    title: '6. Location Data',
    body: 'Location is used only to show you nearby vendors and improve search relevance. We do not share your precise location with third parties. You can disable location access in your profile settings.',
  },
  {
    title: '7. Changes to This Policy',
    body: 'We may update this policy from time to time. We will notify you of significant changes via email or in-app notification.',
  },
  {
    title: '8. Contact Us',
    body: 'For privacy-related questions, contact us at privacy@vendr.ng.',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-faint gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-xl flex-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text className="text-muted text-xs mb-6" style={{ fontFamily: 'SpaceGrotesk_400Regular' }}>
          Last updated: March 2026
        </Text>
        <Text className="text-muted text-sm mb-6" style={{ fontFamily: 'SpaceGrotesk_400Regular', lineHeight: 24 }}>
          Vendr ("we", "us", or "our") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information when you use our app.
        </Text>

        {SECTIONS.map((section, i) => (
          <View key={i} style={{ marginBottom: 24 }}>
            <Text className="text-cream text-sm mb-2" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>{section.title}</Text>
            <Text className="text-muted text-sm" style={{ fontFamily: 'SpaceGrotesk_400Regular', lineHeight: 24 }}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}