import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { getAccessToken, refreshAccessToken } from './api';

/**
 * One managed Socket.IO connection for the whole app.
 *
 * - Screens subscribe with `onSocketEvent(...)`; subscriptions survive reconnects
 *   and can be made before the socket exists.
 * - The token is read fresh on every (re)connect, and refreshed on auth errors.
 * - The socket is closed while the app is backgrounded so the server can mark the
 *   user offline (presence is derived from the connection on the server).
 * - Conversation rooms are re-joined automatically after a reconnect.
 */

type Handler = (...args: any[]) => void;
export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

let socket: Socket | null = null;
let started = false;
let authRetryTimer: ReturnType<typeof setTimeout> | null = null;
let authFailures = 0;
let appStateSub: NativeEventSubscription | null = null;
let appState: AppStateStatus = AppState.currentState;

const handlers = new Map<string, Set<Handler>>();
const statusListeners = new Set<(s: SocketStatus) => void>();
const joinedConversations = new Set<string>();
let status: SocketStatus = 'idle';

// Socket.IO lives at the server root, the REST API under /api.
function socketUrl() {
  const explicit = process.env.EXPO_PUBLIC_SOCKET_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const api = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://excellar.outray.app/api';
  return api.replace(/\/$/, '').replace(/\/api$/, '');
}

function setStatus(next: SocketStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((l) => l(next));
}

function dispatch(event: string, args: any[]) {
  const set = handlers.get(event);
  if (!set) return;
  // Copy so handlers can unsubscribe while we iterate
  [...set].forEach((h) => {
    try {
      h(...args);
    } catch (err) {
      console.error(`[Socket] handler for ${event} threw`, err);
    }
  });
}

function createSocket(): Socket {
  const s = io(socketUrl(), {
    // Called on every connection attempt, so reconnects always use the latest token
    auth: (cb) => {
      getAccessToken()
        .then((token) => cb({ token: typeof token === 'string' ? token : '' }))
        .catch(() => cb({ token: '' }));
    },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 15000,
    autoConnect: false,
  });

  s.on('connect', () => {
    authFailures = 0;
    setStatus('connected');
    joinedConversations.forEach((id) => s.emit('join_conversation', id));
    dispatch('connect', []);
  });

  s.on('disconnect', (reason) => {
    setStatus('disconnected');
    dispatch('disconnect', [reason]);
    // Server-side kicks don't auto-reconnect; reconnect if we still want to be live
    if (reason === 'io server disconnect' && started && appState === 'active') {
      s.connect();
    }
  });

  s.on('connect_error', async (err) => {
    setStatus('disconnected');
    // Middleware rejections are not retried by socket.io — handle them ourselves.
    if (err?.message === 'Authentication error') {
      if (authRetryTimer || !started) return;
      authFailures += 1;
      const token = await refreshAccessToken().catch(() => null);
      if (!token || !started) return; // logged out — nothing to do
      const delay = Math.min(30000, 1000 * 2 ** Math.min(authFailures, 5));
      authRetryTimer = setTimeout(() => {
        authRetryTimer = null;
        if (started && appState === 'active' && !s.connected) s.connect();
      }, authFailures === 1 ? 0 : delay);
    }
  });

  s.onAny((event, ...args) => dispatch(event, args));
  return s;
}

function handleAppState(next: AppStateStatus) {
  const prev = appState;
  appState = next;
  if (!started || !socket) return;
  if (next === 'active' && prev !== 'active') {
    if (!socket.connected) {
      setStatus('connecting');
      socket.connect();
    }
  } else if (next === 'background') {
    // Going away: drop the connection so contacts see us go offline
    socket.disconnect();
  }
}

/** Start the realtime connection for the logged-in user. Safe to call repeatedly. */
export function startSocket() {
  if (!socket) socket = createSocket();
  started = true;
  if (!appStateSub) appStateSub = AppState.addEventListener('change', handleAppState);
  if (!socket.connected && appState !== 'background') {
    setStatus('connecting');
    socket.connect();
  }
}

/** Tear down on logout. Subscriptions are kept so mounted screens keep working after re-login. */
export function stopSocket() {
  started = false;
  if (authRetryTimer) clearTimeout(authRetryTimer);
  authRetryTimer = null;
  authFailures = 0;
  appStateSub?.remove();
  appStateSub = null;
  joinedConversations.clear();
  if (socket) {
    socket.removeAllListeners();
    socket.offAny();
    socket.disconnect();
    socket = null;
  }
  setStatus('idle');
}

/** Subscribe to a server event (or 'connect' / 'disconnect'). Returns an unsubscribe function. */
export function onSocketEvent<T = any>(event: string, handler: (payload: T, ...rest: any[]) => void): () => void {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(handler as Handler);
  return () => {
    set!.delete(handler as Handler);
  };
}

export function onSocketStatus(listener: (s: SocketStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}

export function getSocketStatus(): SocketStatus {
  return status;
}

export function isSocketConnected() {
  return !!socket?.connected;
}

export function joinConversation(conversationId: string) {
  joinedConversations.add(conversationId);
  if (socket?.connected) socket.emit('join_conversation', conversationId);
}

export function leaveConversation(conversationId: string) {
  joinedConversations.delete(conversationId);
  if (socket?.connected) socket.emit('leave_conversation', conversationId);
}

export function emitTyping(conversationId: string, isTyping: boolean) {
  if (socket?.connected) socket.emit('typing', { conversationId, isTyping });
}

// ─── Back-compat shims (older call sites) ──────────────────────────────────

/** @deprecated use startSocket + onSocketEvent */
export async function connectSocket(): Promise<Socket | null> {
  startSocket();
  return socket;
}

/** @deprecated use stopSocket */
export function disconnectSocket() {
  stopSocket();
}

export function getSocket(): Socket | null {
  return socket;
}
