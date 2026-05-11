import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// Web fallback using localStorage with basic obfuscation
const WebStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        const item = localStorage.getItem(`secure_${key}`)
        if (!item) return null
        
        // Basic de-obfuscation (not truly secure, but better than plain text)
        return atob(item)
      } catch {
        return null
      }
    }
    return SecureStore.getItemAsync(key)
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        // Basic obfuscation (not truly secure, but better than plain text)
        const obfuscated = btoa(value)
        localStorage.setItem(`secure_${key}`, obfuscated)
      } catch (error) {
        console.error('Failed to save to web storage:', error)
        throw error
      }
    } else {
      return SecureStore.setItemAsync(key, value)
    }
  },

  async deleteItemAsync(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(`secure_${key}`)
      } catch (error) {
        console.error('Failed to delete from web storage:', error)
        throw error
      }
    } else {
      return SecureStore.deleteItemAsync(key)
    }
  }
}

export default WebStorage
