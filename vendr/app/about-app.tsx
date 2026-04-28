import { View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/ui/StyledText';

const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '100';

const TECH_STACK = [
  { label: 'Mobile',    value: 'React Native + Expo SDK 55' },
  { label: 'Backend',   value: 'Fastify + Neon DB' },
  { label: 'Payments',  value: 'Paystack' },
  { label: 'Maps',      value: 'OpenStreetMap + Leaflet' },
  { label: 'State',     value: 'Zustand' },
];

const LINKS = [
  { icon: 'shield-outline'        as const, label: 'Privacy Policy',   route: '/privacy-policy'   },
  { icon: 'document-text-outline' as const, label: 'Terms of Service', route: '/terms-of-service' },
  { icon: 'help-circle-outline'   as const, label: 'Help Center',      route: '/help-center'      },
  { icon: 'chatbubble-outline'    as const, label: 'Contact Support',  route: '/contact-support'  },
];

export default function AboutAppScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A06' }}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}
        >
          <Ionicons name="arrow-back" size={20} color="#FDF6EC" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#FDF6EC' }}>About Vendr</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>

        {/* Logo / Hero */}
        <View style={{ alignItems: 'center', paddingVertical: 36 }}>
          <View style={{
            width: 88, height: 88, borderRadius: 28,
            backgroundColor: '#1A1208', borderWidth: 1.5, borderColor: 'rgba(232,82,26,0.3)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 18,
            shadowColor: '#E8521A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
          }}>
            <Ionicons name="storefront" size={44} color="#E8521A" />
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: '#FDF6EC', letterSpacing: -0.5 }}>Vendr</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', marginTop: 4 }}>
            Your local marketplace
          </Text>

          {/* Version badge */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
            backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14',
            borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
          }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#2D8653' }} />
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#FDF6EC' }}>
              Version {APP_VERSION}
            </Text>
            <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#6B5E50' }}>
              Build {BUILD_NUMBER}
            </Text>
          </View>
        </View>

        {/* Mission */}
        {/* <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 24, padding: 20, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(232,82,26,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="rocket-outline" size={18} color="#E8521A" />
            </View>
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: '#FDF6EC' }}>Our Mission</Text>
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570', lineHeight: 22 }}>
            Vendr connects buyers to verified local vendors in Nigeria — starting in Lagos and expanding across West Africa. We make it easy to discover, chat with, and pay local sellers all in one place.
          </Text>
        </View> */}

        {/* Version info */}
        <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 24, marginBottom: 16, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2A1F14' }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#6B5E50', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              App Info
            </Text>
          </View>
          {[
            { label: 'Version',       value: APP_VERSION },
            { label: 'Build',         value: BUILD_NUMBER },
            { label: 'Platform',      value: 'iOS & Android' },
            { label: 'Environment',   value: 'Production' },
          ].map((row, i, arr) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 13,
                borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: '#2A1F14',
              }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570' }}>{row.label}</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 14, color: '#FDF6EC' }}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Tech stack */}
        {/* <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 24, marginBottom: 16, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2A1F14' }}>
            <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, color: '#6B5E50', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Built With
            </Text>
          </View>
          {TECH_STACK.map((item, i) => (
            <View
              key={item.label}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 13,
                borderBottomWidth: i < TECH_STACK.length - 1 ? 1 : 0, borderBottomColor: '#2A1F14',
              }}
            >
              <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#9A8570' }}>{item.label}</Text>
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#FDF6EC', maxWidth: '60%', textAlign: 'right' }}>{item.value}</Text>
            </View>
          ))}
        </View> */}

        {/* Links */}
        <View style={{ backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#2A1F14', borderRadius: 24, marginBottom: 24, overflow: 'hidden' }}>
          {LINKS.map((link, i) => (
            <TouchableOpacity
              key={link.label}
              onPress={() => router.push(link.route as any)}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 16, paddingVertical: 14,
                borderBottomWidth: i < LINKS.length - 1 ? 1 : 0, borderBottomColor: '#2A1F14',
              }}
            >
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#2E2214', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={link.icon} size={17} color="#9A8570" />
              </View>
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#FDF6EC', flex: 1 }}>{link.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#3D3026" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', gap: 6, paddingBottom: 8 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 13, color: '#E8521A' }}>
            Made with love in Lagos
          </Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#3D3026' }}>
            © {new Date().getFullYear()} Vendr. All rights reserved.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}