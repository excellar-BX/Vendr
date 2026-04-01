import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';

const FAQS = [
  {
    q: 'How do I find vendors near me?',
    a: 'Vendr uses your location to show vendors closest to you first. Make sure location access is enabled in your profile settings.',
  },
  {
    q: 'How do I become a vendor?',
    a: "Go to your Profile tab and tap 'Become a Vendor'. Fill in your business details and you'll be live immediately.",
  },
  {
    q: 'Is my payment secure?',
    a: 'Yes. All payments are processed by Paystack, a trusted Nigerian payment provider. We never store your card details.',
  },
  {
    q: 'How do I contact a vendor?',
    a: "Open any vendor's store page and tap the Chat button to start a conversation directly.",
  },
  {
    q: 'Can I cancel an order?',
    a: 'You can cancel an order before the vendor confirms it. Once confirmed, contact the vendor directly via chat to discuss.',
  },
  {
    q: 'How does vendor verification work?',
    a: 'Verified vendors have gone through our identity and business check process. Look for the green shield badge on vendor profiles.',
  },
  {
    q: 'What if I have a problem with my order?',
    a: "First try to resolve it with the vendor via chat. If unresolved, contact our support team and we'll mediate.",
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Profile → scroll to Account Actions → Delete Account. Your data will be permanently removed after 30 days.',
  },
];

export default function HelpCenterScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <View className="flex-1 bg-dark">
      <StatusBar style="light" />
      <View className="flex-row items-center px-5 pt-14 pb-4 border-b border-faint gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>
        <Text className="text-cream text-xl flex-1" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Help Center</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }} showsVerticalScrollIndicator={false}>
        <Text className="text-muted text-sm mb-2" style={{ fontFamily: 'SpaceGrotesk_400Regular' }}>
          Frequently asked questions
        </Text>

        {FAQS.map((faq, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setOpenIndex(openIndex === i ? null : i)}
            activeOpacity={0.8}
            className="bg-dark-2 border border-faint rounded-2xl overflow-hidden"
            style={{ marginBottom: 8 }}
          >
            <View className="flex-row items-center px-4 py-4 gap-3">
              <Text className="text-cream text-sm flex-1" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>{faq.q}</Text>
              <Ionicons name={openIndex === i ? 'chevron-up' : 'chevron-down'} size={16} color="#6B5E50" />
            </View>
            {openIndex === i && (
              <View className="px-4 pb-4 border-t border-faint">
                <Text className="text-muted text-sm mt-3" style={{ fontFamily: 'SpaceGrotesk_400Regular', lineHeight: 22 }}>
                  {faq.a}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <View className="bg-orange/10 border border-orange/30 rounded-2xl px-4 py-4 mt-4 flex-row items-center gap-3">
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#E8521A" />
          <View className="flex-1">
            <Text className="text-cream text-sm" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Still need help?</Text>
            <Text className="text-muted text-xs mt-0.5">Contact our support team directly</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/contact-support')} className="bg-orange rounded-xl px-3 py-2">
            <Text className="text-white text-xs" style={{ fontFamily: 'SpaceGrotesk_600SemiBold' }}>Contact</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}