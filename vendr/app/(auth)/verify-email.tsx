import { useState } from 'react'
import { View, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '../../components/ui/StyledText'
import { apiFetch } from '../../lib/api'

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [error, setError] = useState('')

  const handleResend = async () => {
    if (!email) return
    setResending(true)
    setError('')
    try {
      await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <View className="flex-1 bg-dark px-7">
      <StatusBar style="light" />
      <View className="absolute top-24 -right-20 w-72 h-72 rounded-full bg-orange opacity-[0.07]" />

      <TouchableOpacity
        className="mt-14 w-10 h-10 rounded-xl bg-dark-2 border border-faint items-center justify-center"
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
      </TouchableOpacity>

      <View className="flex-1 items-center justify-center pb-16">
        <View className="w-28 h-28 rounded-full bg-orange/10 border border-orange/20 items-center justify-center mb-8">
          <Ionicons name="mail-outline" size={48} color="#E8521A" />
          <View className="absolute top-3 right-3 w-4 h-4 rounded-full bg-green-500 border-2 border-dark" />
        </View>

        <Text style={{ fontWeight: '700' }} className="text-cream text-4xl tracking-tight leading-tight text-center mb-4">
          Check your{'\n'}email
        </Text>
        <Text className="text-subtle text-base text-center mb-1">We sent a verification link to</Text>
        <Text className="text-orange font-bold text-base text-center mb-5">{email}</Text>
        <Text className="text-subtle text-sm text-center leading-relaxed px-4 mb-10">
          Click the link in the email to verify your account. After verifying, come back and sign in.
        </Text>

        <TouchableOpacity
          className="w-full bg-orange rounded-2xl py-[18px] items-center mb-5"
          style={{ shadowColor: '#E8521A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8 }}
          activeOpacity={0.85}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text className="text-white text-lg" style={{ fontFamily: 'SpaceGrotesk_700Bold' }}>Go to Sign In</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-1 mb-3">
          <Text className="text-subtle text-sm">Didn't get it? </Text>
          <TouchableOpacity onPress={handleResend} disabled={resending || resent}>
            {resending
              ? <ActivityIndicator size="small" color="#E8521A" />
              : <Text className={`text-sm font-semibold ${resent ? 'text-green-500' : 'text-orange'}`}>
                  {resent ? 'Email sent' : 'Resend email'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {error ? <Text className="text-brand-red text-xs text-center mb-3">{error}</Text> : null}

        <Text className="text-faint text-xs text-center leading-relaxed">
          Check your spam folder if you don't see it within a minute.
        </Text>
      </View>
    </View>
  )
}