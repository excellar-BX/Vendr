import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from './prisma';

let io: SocketIOServer | null = null;

/**
 * How long a user may be fully disconnected before we mark them offline.
 * Absorbs brief network blips / app switches so presence doesn't flicker.
 */
const OFFLINE_GRACE_MS = 8000;
const offlineTimers = new Map<string, NodeJS.Timeout>();

export const userRoom = (userId: string) => `user:${userId}`;
export const conversationRoom = (conversationId: string) => `conversation:${conversationId}`;

// ─── Helpers usable from services ───────────────────────────────────────────

/** Emit an event to every connected device of the given users (deduplicated). */
export function emitToUsers(
  userIds: Array<string | null | undefined>,
  event: string,
  payload: unknown
) {
  if (!io) return;
  const rooms = [...new Set(userIds.filter(Boolean) as string[])].map(userRoom);
  if (rooms.length === 0) return;
  io.to(rooms).emit(event, payload);
}

/** True if the user currently has at least one connected socket. */
export async function isUserConnected(userId: string): Promise<boolean> {
  if (!io) return false;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  return sockets.length > 0;
}

/** Returns { buyerId, vendorUserId } for a conversation, or null if it doesn't exist. */
export async function getConversationParticipants(conversationId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { buyer_id: true, vendor: { select: { user_id: true } } },
  });
  if (!conv) return null;
  return { buyerId: conv.buyer_id, vendorUserId: conv.vendor.user_id };
}

/** Users who share at least one conversation with `userId` — the only people who see their presence. */
async function getContactUserIds(userId: string): Promise<string[]> {
  const convs = await prisma.conversation.findMany({
    where: { OR: [{ buyer_id: userId }, { vendor: { user_id: userId } }] },
    select: { buyer_id: true, vendor: { select: { user_id: true } } },
  });
  const ids = new Set<string>();
  for (const c of convs) {
    const other = c.buyer_id === userId ? c.vendor.user_id : c.buyer_id;
    if (other && other !== userId) ids.add(other);
  }
  return [...ids];
}

/** Persist presence and notify the user's contacts in real time. */
export async function setPresence(userId: string, isOnline: boolean, at: Date = new Date()) {
  const lastSeen = at;
  await prisma.userPresence.upsert({
    where: { user_id: userId },
    update: { is_online: isOnline, last_seen: lastSeen },
    create: { user_id: userId, is_online: isOnline, last_seen: lastSeen },
  });
  const contacts = await getContactUserIds(userId);
  emitToUsers(contacts, 'user_presence', {
    userId,
    isOnline,
    lastSeen: lastSeen.toISOString(),
  });
}

/**
 * When a user comes online, everything that was sent to them while they were away
 * is now delivered. Flip the flags and tell the senders (double grey ticks).
 */
async function markPendingDelivered(userId: string) {
  const pending = await prisma.message.findMany({
    where: {
      delivered: false,
      deleted: false,
      sender_id: { not: userId },
      conversation: { OR: [{ buyer_id: userId }, { vendor: { user_id: userId } }] },
    },
    select: { id: true, conversation_id: true, sender_id: true },
  });
  if (pending.length === 0) return;

  await prisma.message.updateMany({
    where: { id: { in: pending.map((p) => p.id) } },
    data: { delivered: true },
  });

  const byConversation = new Map<string, { senderId: string; ids: string[] }>();
  for (const p of pending) {
    const entry = byConversation.get(p.conversation_id) ?? { senderId: p.sender_id, ids: [] };
    entry.ids.push(p.id);
    byConversation.set(p.conversation_id, entry);
  }
  for (const [conversationId, { senderId, ids }] of byConversation) {
    emitToUsers([senderId, userId], 'message_delivered', {
      conversationId,
      messageIds: ids,
      userId,
    });
  }
}

/**
 * Resolve (and cache on the socket) the other participant of a conversation,
 * verifying the socket's user actually belongs to it.
 */
async function resolveOtherParticipant(socket: Socket, conversationId: string): Promise<string | null> {
  const cache: Map<string, string> = socket.data.conversations;
  const cached = cache.get(conversationId);
  if (cached) return cached;

  if (typeof conversationId !== 'string' || conversationId.length > 64) return null;
  const participants = await getConversationParticipants(conversationId);
  if (!participants) return null;

  const userId = socket.data.userId as string;
  let other: string | null = null;
  if (participants.buyerId === userId) other = participants.vendorUserId;
  else if (participants.vendorUserId === userId) other = participants.buyerId;
  if (!other) return null;

  cache.set(conversationId, other);
  return other;
}

// ─── Server ──────────────────────────────────────────────────────────────────

export function initSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
    // Detect killed apps / dropped networks within ~20s (WhatsApp-like)
    pingInterval: 10000,
    pingTimeout: 10000,
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        const allowedPatterns = [
          /^http:\/\/localhost(:\d+)?$/,        // any localhost port
          /^http:\/\/127\.0\.0\.1(:\d+)?$/,     // any 127.0.0.1 port
          /^https?:\/\/.*\.ngrok-free\.app$/,   // ngrok free tunnels
          /^https?:\/\/.*\.ngrok\.io$/,         // ngrok legacy
          /^https?:\/\/.*\.ngrok-free\.dev$/,   // ngrok free dev tunnels
          /^https?:\/\/.*\.vercel\.app$/,       // Vercel deployments
          /^https?:\/\/.*\.onrender\.com$/,     // Render deployments
        ];

        // Add production origins via env: ALLOWED_ORIGINS=https://admin.vendr.ng,https://app.vendr.ng
        const explicitOrigins = (process.env.ALLOWED_ORIGINS ?? '')
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);

        const isAllowed =
          allowedPatterns.some((pattern) => pattern.test(origin)) ||
          explicitOrigins.includes(origin);

        if (isAllowed) {
          callback(null, true);
        } else {
          console.warn(`[Socket] CORS blocked origin: ${origin}`);
          callback(new Error(`Origin ${origin} not allowed by CORS`), false);
        }
      },
      methods: ['GET', 'POST'],
    },
  });

  // Anyone still flagged online from before a restart is not actually connected.
  prisma.userPresence
    .updateMany({ where: { is_online: true }, data: { is_online: false } })
    .catch((err) => console.error('[Socket] Failed to reset stale presence:', err));

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const raw = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!raw || typeof raw !== 'string') {
        return next(new Error('Authentication error'));
      }
      // Access tokens are signed as { id, email } (see auth.service generateAccessToken).
      // Reading `userId` here used to yield undefined, putting every socket in the
      // room "user:undefined" so no event ever reached a real user.
      const decoded = jwt.verify(raw, env.JWT_ACCESS_SECRET) as { id?: string; userId?: string };
      const userId = decoded.id ?? decoded.userId;
      if (!userId) return next(new Error('Authentication error'));
      socket.data.userId = userId;
      console.log(`[Socket] connected user ${userId} (${socket.id})`);
      next();
    } catch {
      // Expired / invalid token — the client refreshes and retries on this message.
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    socket.data.conversations = new Map<string, string>();
    socket.join(userRoom(userId));

    // Came back within the grace window — never went offline.
    const pendingOffline = offlineTimers.get(userId);
    if (pendingOffline) {
      clearTimeout(pendingOffline);
      offlineTimers.delete(userId);
    }

    try {
      const sockets = await io!.in(userRoom(userId)).fetchSockets();
      if (sockets.length === 1) {
        await setPresence(userId, true);
      }
      await markPendingDelivered(userId);
    } catch (err) {
      console.error('[Socket] connection bookkeeping failed:', err);
    }

    // Join a conversation room (only if the user is a participant)
    socket.on('join_conversation', async (conversationId: string, ack?: (ok: boolean) => void) => {
      try {
        const other = await resolveOtherParticipant(socket, conversationId);
        if (!other) return ack?.(false);
        socket.join(conversationRoom(conversationId));
        ack?.(true);
      } catch (err) {
        console.error('[Socket] join_conversation failed:', err);
        ack?.(false);
      }
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(conversationRoom(conversationId));
    });

    // Typing indicator — relayed only to the other participant
    socket.on('typing', async (data: { conversationId: string; isTyping: boolean }) => {
      try {
        if (!data?.conversationId) return;
        const other = await resolveOtherParticipant(socket, data.conversationId);
        if (!other) return;
        emitToUsers([other], 'user_typing', {
          conversationId: data.conversationId,
          userId,
          isTyping: !!data.isTyping,
        });
      } catch (err) {
        console.error('[Socket] typing relay failed:', err);
      }
    });

    socket.on('disconnect', async () => {
      // "Last seen" is when they actually left, not when the grace period ended
      const disconnectedAt = new Date();
      try {
        // Stop any "typing…" this socket left hanging
        const convs: Map<string, string> = socket.data.conversations;
        for (const [conversationId, other] of convs) {
          emitToUsers([other], 'user_typing', { conversationId, userId, isTyping: false });
        }

        const remaining = await io!.in(userRoom(userId)).fetchSockets();
        if (remaining.length > 0) return;

        const existing = offlineTimers.get(userId);
        if (existing) clearTimeout(existing);
        offlineTimers.set(
          userId,
          setTimeout(async () => {
            offlineTimers.delete(userId);
            try {
              const still = await io!.in(userRoom(userId)).fetchSockets();
              if (still.length === 0) await setPresence(userId, false, disconnectedAt);
            } catch (err) {
              console.error('[Socket] offline presence update failed:', err);
            }
          }, OFFLINE_GRACE_MS)
        );
      } catch (err) {
        console.error('[Socket] disconnect bookkeeping failed:', err);
      }
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}
