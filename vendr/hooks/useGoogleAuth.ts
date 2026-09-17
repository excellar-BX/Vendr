let GoogleSignin: any = null
let statusCodes: any = null

try {
  const module = require('@react-native-google-signin/google-signin')
  GoogleSignin = module.GoogleSignin
  statusCodes = module.statusCodes

  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
    offlineAccess: false,
  })
} catch (e) {
  console.log('[GoogleAuth] Native module not available (Expo Go)')
}

export function useGoogleAuth() {
  const isAvailable = GoogleSignin !== null

  async function signInWithGoogle(): Promise<string | null> {
    if (!isAvailable) {
      throw new Error('Google Sign-in requires a development build. Use email/password for now.')
    }

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      await GoogleSignin.signOut()
      const userInfo = await GoogleSignin.signIn()
      const idToken = userInfo.data?.idToken

      if (!idToken) throw new Error('No id_token returned from Google')

      return idToken
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return null
      } else if (error.code === statusCodes.IN_PROGRESS) {
        return null
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Play Services not available')
      } else {
        throw error
      }
    }
  }

  async function signOutFromGoogle() {
    if (!isAvailable) return
    try {
      await GoogleSignin.signOut()
    } catch {}
  }

  return { signInWithGoogle, signOutFromGoogle, isAvailable }
}