import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!,
  offlineAccess: false,
})

export function useGoogleAuth() {
  async function signInWithGoogle(): Promise<string | null> {
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
    try {
      await GoogleSignin.signOut()
    } catch {}
  }

  return { signInWithGoogle, signOutFromGoogle }
}