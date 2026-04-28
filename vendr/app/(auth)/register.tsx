import { useState } from 'react'
import {
  View, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native'
import { Text } from '../../components/ui/StyledText'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path } from 'react-native-svg'
import { StyledInput as RNTextInput } from '../../components/ui/StyledInput'
import { Button } from '../../components/ui/Button'
import { apiFetch, saveTokens } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { useVendrAlert } from '../../components/ui/VendrAlert'
import { useGoogleAuth } from '../../hooks/useGoogleAuth'

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.9 1.1 8 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.7-3.2-11.3-7.8l-6.5 5C9.7 39.7 16.3 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4-4.2 5.2l6.2 5.2C40.8 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z" />
    </Svg>
  )
}

export default function RegisterScreen() {
  const { setUser } = useAuthStore()
  const { showAlert, alertElement } = useVendrAlert()
  const { signInWithGoogle } = useGoogleAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Enter your full name'
    if (!email || !email.includes('@')) errs.email = 'Enter a valid email'
    if (!password || password.length < 8) errs.password = 'At least 8 characters'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleRegister = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: name }),
      })
      await saveTokens(data.data.accessToken, data.data.refreshToken)
      setUser(data.data.user)
      // Automatic redirect handled by layout guard based on is_verified status
    } catch (err: any) {
      showAlert({ title: 'Sign up failed', message: err.message, type: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true)
    try {
      const idToken = await signInWithGoogle()
      if (!idToken) return // user cancelled
      const data = await apiFetch('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ id_token: idToken }),
      })
      await saveTokens(data.data.accessToken, data.data.refreshToken)
      setUser(data.data.user)
      router.replace('/(tabs)')
    } catch (err: any) {
      showAlert({ title: 'Google sign in failed', message: err.message, type: 'danger' })
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-dark"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <View className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-orange opacity-[0.07]" />

      <ScrollView
        className="flex-1 px-7"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          className="mt-14 w-10 h-10 rounded-xl bg-dark-2 border border-faint items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#FDF6EC" />
        </TouchableOpacity>

        <View className="mt-7 mb-8">
          <Text className="text-muted text-sm font-medium mb-2">New here?</Text>
          <Text style={{ fontWeight: '600' }} className="text-cream text-4xl tracking-tight leading-tight mb-2">
            Create your{'\n'}account
          </Text>
          <Text className="text-subtle text-base">Join thousands discovering local vendors.</Text>
        </View>

        <TouchableOpacity
          className="flex-row items-center justify-center gap-3 bg-dark-2 border border-faint rounded-2xl py-4 mb-6"
          activeOpacity={0.85}
          onPress={handleGoogleSignUp}
          disabled={googleLoading}
        >
          {googleLoading
            ? <ActivityIndicator color="#FDF6EC" size="small" />
            : <><GoogleIcon /><Text className="text-cream text-base font-semibold ml-2">Continue with Google</Text></>
          }
        </TouchableOpacity>

        <View className="flex-row items-center gap-3 mb-7">
          <View className="flex-1 h-px bg-faint" />
          <Text className="text-subtle text-xs font-medium">or sign up with email</Text>
          <View className="flex-1 h-px bg-faint" />
        </View>

        <View className="gap-5 mb-4">
          <View className="gap-2">
            <Text className="text-muted text-xs font-semibold tracking-widest uppercase">Full Name</Text>
            <View className={`flex-row items-center bg-dark-2 rounded-2xl border px-4 h-14 ${errors.name ? 'border-brand-red' : 'border-faint'}`}>
              <Ionicons name="person-outline" size={18} color="#6B5E50" style={{ marginRight: 10 }} />
              <RNTextInput
                className="flex-1 text-cream text-base"
                placeholder="Your full name"
                placeholderTextColor="#6B5E50"
                value={name}
                onChangeText={(t: string) => { setName(t); setErrors(e => ({ ...e, name: '' })) }}
                autoCapitalize="words"
              />
            </View>
            {errors.name ? <Text className="text-brand-red text-xs font-medium">{errors.name}</Text> : null}
          </View>

          <View className="gap-2">
            <Text className="text-muted text-xs font-semibold tracking-widest uppercase">Email</Text>
            <View className={`flex-row items-center bg-dark-2 rounded-2xl border px-4 h-14 ${errors.email ? 'border-brand-red' : 'border-faint'}`}>
              <Ionicons name="mail-outline" size={18} color="#6B5E50" style={{ marginRight: 10 }} />
              <RNTextInput
                className="flex-1 text-cream text-base"
                placeholder="you@example.com"
                placeholderTextColor="#6B5E50"
                value={email}
                onChangeText={(t: string) => { setEmail(t); setErrors(e => ({ ...e, email: '' })) }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {errors.email ? <Text className="text-brand-red text-xs font-medium">{errors.email}</Text> : null}
          </View>

          <View className="gap-2">
            <Text className="text-muted text-xs font-semibold tracking-widest uppercase">Password</Text>
            <View className={`flex-row items-center bg-dark-2 rounded-2xl border px-4 h-14 ${errors.password ? 'border-brand-red' : 'border-faint'}`}>
              <Ionicons name="lock-closed-outline" size={18} color="#6B5E50" style={{ marginRight: 10 }} />
              <RNTextInput
                className="flex-1 text-cream text-base"
                placeholder="Min. 8 characters"
                placeholderTextColor="#6B5E50"
                value={password}
                onChangeText={(t: string) => { setPassword(t); setErrors(e => ({ ...e, password: '' })) }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity className="p-1" onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B5E50" />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text className="text-brand-red text-xs font-medium">{errors.password}</Text> : null}
          </View>
        </View>

        <Text className="text-subtle text-xs text-center leading-relaxed mb-6">
          By creating an account you agree to our{' '}
          <Text className="text-orange font-semibold">Terms of Service</Text>
          {' '}and{' '}
          <Text className="text-orange font-semibold">Privacy Policy</Text>
        </Text>

        <View className="mt-5">
          <Button label="Create Account" onPress={handleRegister} loading={loading} />
        </View>

        <TouchableOpacity className="items-center py-5" onPress={() => router.replace('/(auth)/login')}>
          <Text className="text-subtle text-sm">
            Already have an account?{' '}
            <Text className="text-orange font-semibold">Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {alertElement}
    </KeyboardAvoidingView>
  )
}