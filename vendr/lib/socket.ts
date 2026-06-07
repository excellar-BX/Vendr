import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../lib/api';

let socket: Socket | null = null;
let isConnecting = false; // ← guard against multiple simultaneous connection attempts

export function getSocket(): Socket | null {
  return socket;
}

export async function connectSocket(): Promise<Socket | null> {
  // Already connected
  if (socket?.connected) {
    return socket;
  }

  // Already in the process of connecting
  if (isConnecting) {
    return socket;
  }

  // Socket exists but is disconnected — clean it up first
  if (socket && !socket.connected) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const token = await getAccessToken();
  if (!token) {
    console.log('[Socket] No token, skipping connection');
    return null;
  }

  const tokenString = typeof token === 'string' ? token : (token as any)._j || token;
  const apiUrl = /*process.env.EXPO_PUBLIC_API_URL ||*/ 'https://vendr-production.up.railway.app';
  const baseUrl = apiUrl.replace(/\/$/, '');

  isConnecting = true;

  socket = io(baseUrl, {
    auth: { token: tokenString },
    transports: ['polling'],
    upgrade: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    isConnecting = false;
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    isConnecting = false;
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    isConnecting = false;
    console.log('[Socket] Connection error:', err.message);
  });

  socket.onAny((eventName, ...args) => {
    console.log('[Socket] Received event:', eventName, args);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  isConnecting = false;
}

export function joinConversation(conversationId: string) {
  if (socket?.connected) {
    socket.emit('join_conversation', conversationId);
  }
}

export function leaveConversation(conversationId: string) {
  if (socket?.connected) {
    socket.emit('leave_conversation', conversationId);
  }
}