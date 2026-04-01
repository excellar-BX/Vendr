import * as SecureStore from 'expo-secure-store'
import { useAuthStore } from '../stores/authStore'


const BASE_URL = "http://10.161.22.15:3000/api" //'https://vendr-backend-unlt.onrender.com/api'
console.log(BASE_URL)
// ─── Token storage ────────────────────────────────────────────────────────────

export async function getAccessToken() {
  return await SecureStore.getItemAsync('access_token')
}

export async function getRefreshToken() {
  return await SecureStore.getItemAsync('refresh_token')
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync('access_token', accessToken)
  await SecureStore.setItemAsync('refresh_token', refreshToken)
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync('access_token')
  await SecureStore.deleteItemAsync('refresh_token')
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    // No refresh token means user is not logged in
    await clearTokens()
    useAuthStore.getState().clear()
    return null
  }

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    // Refresh token expired or invalid - user must log in again
    await clearTokens()
    useAuthStore.getState().clear()
    return null
  }

  const data = await res.json()
  await saveTokens(data.data.accessToken, data.data.refreshToken)
  return data.data.accessToken
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<any> {
  const accessToken = await getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  // Token expired — try refresh once
  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      return apiFetch(path, options, false)
    }
    // Refresh failed — user must log in again
    throw { statusCode: 401, message: 'Your session has expired. Please log in again.' }
  }

  const data = await res.json()

  if (!res.ok) {
    throw { statusCode: res.status, message: data.message ?? 'Something went wrong', errors: data.errors }
  }

  return data
}