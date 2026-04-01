import { useState } from 'react'
import {
  View, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '../../components/ui/StyledText'
import { StyledInput as RNTextInput } from '../../components/ui/StyledInput'
import { Button } from '../../components/ui/Button'
import { apiFetch } from '../../lib/api'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleReset = async () => {
    if (!email || !email.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    setLoading(true)
    setError('')
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-dark"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <View className="absolute -top-16 -right-20 w-72 h-72 rounded-full bg-orange opacity-[0.07]" />

      <View className="flex-1 px-7">
        <TouchableOpacity
          className="mt-14 w-10 h-10 rounded-xl bg-dark-2 border border-faint items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>

        <View className="flex-1 justify-center pb-16">
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-2xl bg-orange/10 border border-orange/20 items-center justify-center">
              <Ionicons name={sent ? 'checkmark-circle-outline' : 'key-outline'} size={40} color="#E8521A" />
            </View>
          </View>

          <Text style={{ fontWeight: '600' }} className="text-cream text-4xl tracking-tight leading-tight text-center mb-4">
            {sent ? 'Check your\nemail' : 'Reset your\npassword'}
          </Text>
          <Text className="text-subtle text-base text-center leading-relaxed mb-10 px-4">
            {sent
              ? `We sent a reset link to ${email}. Open the link to set a new password.`
              : "Enter your email and we'll send you a reset link."}
          </Text>

          {!sent && (
            <>
              <View className="gap-2 mb-6">
                <Text className="text-muted text-xs font-semibold tracking-widest uppercase">Email address</Text>
                <View className={`bg-dark-2 rounded-2xl border px-4 h-14 justify-center ${error ? 'border-brand-red' : 'border-faint'}`}>
                  <RNTextInput
                    className="text-cream text-base"
                    placeholder="you@example.com"
                    placeholderTextColor="#6B5E50"
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError('') }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {error ? <Text className="text-brand-red text-xs font-medium">{error}</Text> : null}
              </View>

              <View className="mt-2">
                <Button label="Send Reset Link" onPress={handleReset} loading={loading} />
              </View>
            </>
          )}

          {sent && (
            <Button label="Back to Sign In" onPress={() => router.replace('/(auth)/login')} />
          )}

          <TouchableOpacity className="items-center mt-5 py-2" onPress={() => router.back()}>
            <Text className="text-subtle text-sm">Back to login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}