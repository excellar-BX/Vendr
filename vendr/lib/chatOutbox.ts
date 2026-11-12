import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { AppState, NativeEventSubscription } from 'react-native';
import { chatApi, storageApi } from './api';
import { onSocketEvent } from './socket';

/**
 * Persistent, app-wide queue of outgoing chat messages (WhatsApp-style).
 *
 * - Messages written offline show a clock and are sent automatically, in order,
 *   as soon as the connection is back — even if the chat screen was closed.
 * - The queue survives app restarts (AsyncStorage). Images are copied into the
 *   app's document directory so the picked file isn't lost.
 * - Network/server hiccups are retried with backoff; a real rejection (4xx) is
 *   reported as "failed" so the user can retry or delete it.
 * - The server de-duplicates by client_id, so a retry after a lost response
 *   never creates a duplicate.
 */

export interface OutboxItem {
  clientId: string;
  conversationId: string;
  kind: 'text' | 'image';
  content?: string | null;
  localUri?: string;
  uploadedUrl?: string;
  replyToId?: string | null;
  /** The optimistic message shown in the chat, so it can be restored after a restart */
  message: any;
  attempts: number;
}

export type OutboxEvent =
  | { type: 'sent'; item: OutboxItem; message: any }
  | { type: 'failed'; item: OutboxItem; error: string }
  | { type: 'changed' };

const OUTBOX_DIR = `${FileSystem.documentDirectory ?? ''}chat-outbox/`;

let scope = 'anon';
let items: OutboxItem[] = [];
let loadPromise: Promise<void> | null = null;
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let offs: Array<() => void> = [];
let appStateSub: NativeEventSubscription | null = null;
const listeners = new Set<(e: OutboxEvent) => void>();

const storageKey = () => `vendr-outbox:${scope}`;

function emit(e: OutboxEvent) {
  listeners.forEach((l) => {
    try { l(e); } catch {}
  });
}

async function save() {
  try { await AsyncStorage.setItem(storageKey(), JSON.stringify(items)); } catch {}
}

function ensureLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey());
        items = raw ? JSON.parse(raw) : [];
      } catch {
        items = [];
      }
    })();
  }
  return loadPromise;
}

/** No status code = the request never got an answer (offline / timeout). */
export function isTransientError(e: any): boolean {
  const status = e?.statusCode;
  if (!status) return true;
  return status >= 500 || status === 408 || status === 429 || status === 401;
}

async function persistImage(clientId: string, uri: string): Promise<string> {
  if (!FileSystem.documentDirectory || uri.startsWith(OUTBOX_DIR)) return uri;
  try {
    await FileSystem.makeDirectoryAsync(OUTBOX_DIR, { intermediates: true }).catch(() => {});
    const dest = `${OUTBOX_DIR}${clientId}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

function deleteFile(item: OutboxItem) {
  if (item.localUri?.startsWith(OUTBOX_DIR)) {
    FileSystem.deleteAsync(item.localUri, { idempotent: true }).catch(() => {});
  }
}

async function uploadImage(item: OutboxItem): Promise<string> {
  const fileName = `chat/${item.conversationId}/${Date.now()}.jpg`;
  const { data: signData } = await storageApi.signUpload(fileName, 'image/jpeg');
  const { uploadUrl, publicUrl } = signData;

  const base64 = await FileSystem.readAsStringAsync(item.localUri!, { encoding: 'base64' as any });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  let res: Response;
  try {
    res = await fetch(uploadUrl, { method: 'PUT', body: bytes, headers: { 'Content-Type': 'image/jpeg' } });
  } catch {
    throw { message: 'Network error during upload' }; // transient (no status)
  }
  if (!res.ok) throw { statusCode: res.status >= 500 ? res.status : 400, message: `Upload failed (${res.status})` };
  return publicUrl;
}

async function sendOne(item: OutboxItem) {
  if (item.kind === 'image') {
    if (!item.localUri) throw { statusCode: 400, message: 'Image is no longer available' };
    if (!item.uploadedUrl) {
      item.uploadedUrl = await uploadImage(item);
      await save();
    }
    const { data } = await chatApi.sendMessage({
      conversation_id: item.conversationId, type: 'image', image_url: item.uploadedUrl,
      reply_to_id: item.replyToId ?? null, client_id: item.clientId,
    });
    return data;
  }
  const { data } = await chatApi.sendMessage({
    conversation_id: item.conversationId, type: 'text', content: item.content ?? '',
    reply_to_id: item.replyToId ?? null, client_id: item.clientId,
  });
  return data;
}

function scheduleRetry(attempts: number) {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = Math.min(30_000, 2000 * 2 ** Math.min(attempts, 4));
  retryTimer = setTimeout(() => { retryTimer = null; flushOutbox(); }, delay);
}

/** Try to send everything queued, oldest first. Stops at the first network failure. */
export async function flushOutbox() {
  await ensureLoaded();
  if (flushing || items.length === 0) return;
  flushing = true;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  try {
    while (items.length) {
      const item = items[0];
      try {
        const message = await sendOne(item);
        items = items.filter((i) => i.clientId !== item.clientId);
        await save();
        deleteFile(item);
        emit({ type: 'sent', item, message });
      } catch (e: any) {
        if (isTransientError(e)) {
          item.attempts += 1;
          await save();
          scheduleRetry(item.attempts);
          break;
        }
        // Rejected by the server — surface it, keep the queue moving
        items = items.filter((i) => i.clientId !== item.clientId);
        await save();
        emit({ type: 'failed', item, error: e?.message ?? 'Message could not be sent' });
      }
    }
  } finally {
    flushing = false;
    emit({ type: 'changed' });
  }
}

export async function enqueueOutbox(item: Omit<OutboxItem, 'attempts'>) {
  await ensureLoaded();
  const queued: OutboxItem = { ...item, attempts: 0 };
  if (queued.kind === 'image' && queued.localUri) {
    queued.localUri = await persistImage(queued.clientId, queued.localUri);
    queued.message = { ...queued.message, local_uri: queued.localUri };
  }
  items = [...items.filter((i) => i.clientId !== queued.clientId), queued];
  await save();
  emit({ type: 'changed' });
  flushOutbox();
}

export async function removeFromOutbox(clientId: string) {
  await ensureLoaded();
  const item = items.find((i) => i.clientId === clientId);
  if (!item) return;
  items = items.filter((i) => i.clientId !== clientId);
  deleteFile(item);
  await save();
  emit({ type: 'changed' });
}

/** Queued (not yet sent) messages for a conversation, as chat bubbles. */
export async function pendingForConversation(conversationId: string): Promise<any[]> {
  await ensureLoaded();
  return items
    .filter((i) => i.conversationId === conversationId)
    .map((i) => ({ ...i.message, failed: false }));
}

export function subscribeOutbox(listener: (e: OutboxEvent) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Start for the logged-in user: load the queue and send whenever we're back online. */
export function startOutbox(userId: string) {
  if (scope !== userId) {
    scope = userId;
    items = [];
    loadPromise = null;
  }
  offs.forEach((off) => off());
  offs = [onSocketEvent('connect', () => { flushOutbox(); })];
  appStateSub?.remove();
  appStateSub = AppState.addEventListener('change', (s) => { if (s === 'active') flushOutbox(); });
  flushOutbox();
}

/** Logout: stop and wipe the queue. */
export async function resetOutbox() {
  offs.forEach((off) => off());
  offs = [];
  appStateSub?.remove();
  appStateSub = null;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  items.forEach(deleteFile);
  items = [];
  try { await AsyncStorage.removeItem(storageKey()); } catch {}
  scope = 'anon';
  loadPromise = null;
}
