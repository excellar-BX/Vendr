import { View, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By using Vendr, you agree to these Terms of Service. If you do not agree, please do not use the app. These terms apply to all users including buyers and vendors.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 18 years old to use Vendr. By registering, you confirm that all information provided is accurate and that you have the legal capacity to enter into these terms.',
  },
  {
    title: '3. Vendor Responsibilities',
    body: 'Vendors are responsible for the accuracy of their listings, the quality and legality of goods sold, fulfilling orders in a timely manner, and maintaining accurate business information on their profile.',
  },
  {
    title: '4. Buyer Responsibilities',
    body: 'Buyers are responsible for providing accurate delivery information, making payment promptly, and using the platform in good faith. Fraudulent chargebacks or false claims may result in account suspension.',
  },
  {
    title: '5. Prohibited Content',
    body: 'You may not use Vendr to sell counterfeit goods, illegal substances, weapons, or any item prohibited by Nigerian law. Vendr reserves the right to remove listings and suspend accounts that violate these rules.',
  },
  {
    title: '6. Payments',
    body: 'All transactions are processed by Paystack. Vendr charges a small service fee per transaction. Refund eligibility depends on vendor policy and the nature of the dispute.',
  },
  {
    title: '7. Disputes',
    body: "Buyers and vendors should first attempt to resolve disputes directly via chat. If unresolved, Vendr support may mediate. Vendr's decision in disputes is final.",
  },
  {
    title: '8. Limitation of Liability',
    body: 'Vendr is a marketplace platform. We are not responsible for the quality, safety, or legality of goods sold by vendors. Our liability is limited to the amount of fees paid to us in the last 30 days.',
  },
  {
    title: '9. Termination',
    body: 'We may suspend or terminate your account for violation of these terms, fraudulent activity, or behavior harmful to other users, with or without notice.',
  },
  {
    title: '10. Governing Law',
    body: 'These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes will be subject to the jurisdiction of Nigerian courts.',
  },
];

export default function TermsOfServiceScreen() {
  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-faint gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-xl flex-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Terms of Service</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Text className="text-muted text-xs mb-6" style={{ fontFamily: 'SpaceGrotesk_400Regular' }}>
          Last updated: March 2026
        </Text>
        <Text className="text-muted text-sm mb-6" style={{ fontFamily: 'SpaceGrotesk_400Regular', lineHeight: 24 }}>
          Welcome to Vendr. Please read these terms carefully before using our platform. By accessing or using the app, you agree to be bound by these terms.
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