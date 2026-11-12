import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * On-device copy of each chat (header info + latest messages) so a conversation
 * opens instantly and stays readable with no or poor network — like WhatsApp.
 * Stored in AsyncStorage, scoped per user, wiped on logout.
 */

export interface ChatMeta {
  otherUserId: string | null;
  otherName: string;
  otherAvatar: string | null;
  isVerified: boolean;
  actingAsVendor: boolean;
  vendorProfileId: string;
}

interface Entry {
  meta?: ChatMeta;
  messages?: any[];
}

const PREFIX = 'vendr-chat:';
const MAX_MESSAGES = 100;

let scope = 'anon';
const mem = new Map<string, Entry>();
const loaded = new Set<string>();
const writeTimers = new Map<string, ReturnType<typeof setTimeout>>();

const keyFor = (cid: string) => `${PREFIX}${scope}:${cid}`;

export function setChatCacheScope(userId: string | null) {
  const next = userId ?? 'anon';
  if (next === scope) return;
  scope = next;
  mem.clear();
  loaded.clear();
}

/** Synchronous read of whatever is already in memory (opened earlier this session). */
export function peekChat(cid: string): Entry | null {
  return mem.get(cid) ?? null;
}

/** Load from disk (fast, ~ms). Safe to call repeatedly. */
export async function loadChat(cid: string): Promise<Entry> {
  if (loaded.has(cid)) return mem.get(cid) ?? {};
  let fromDisk: Entry = {};
  try {
    const raw = await AsyncStorage.getItem(keyFor(cid));
    if (raw) fromDisk = JSON.parse(raw);
  } catch {
    // corrupted / unavailable — start fresh
  }
  // Anything written in memory meanwhile is newer than disk
  const merged = { ...fromDisk, ...(mem.get(cid) ?? {}) };
  mem.set(cid, merged);
  loaded.add(cid);
  return merged;
}

function persistSoon(cid: string) {
  const existing = writeTimers.get(cid);
  if (existing) clearTimeout(existing);
  const key = keyFor(cid);
  writeTimers.set(
    cid,
    setTimeout(() => {
      writeTimers.delete(cid);
      const entry = mem.get(cid);
      if (entry) AsyncStorage.setItem(key, JSON.stringify(entry)).catch(() => {});
    }, 400)
  );
}

export function saveChatMeta(cid: string, meta: ChatMeta) {
  mem.set(cid, { ...(mem.get(cid) ?? {}), meta });
  persistSoon(cid);
}

export function saveChatMessages(cid: string, messages: any[]) {
  mem.set(cid, { ...(mem.get(cid) ?? {}), messages: messages.slice(-MAX_MESSAGES) });
  persistSoon(cid);
}

/** Remove every cached chat (all users) — call on logout. */
export async function clearChatCache() {
  writeTimers.forEach(clearTimeout);
  writeTimers.clear();
  mem.clear();
  loaded.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {}
}
