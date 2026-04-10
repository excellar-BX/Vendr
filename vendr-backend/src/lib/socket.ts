import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      console.log('[Socket] Auth attempt - token exists:', !!token);
      console.log('[Socket] Token type:', typeof token);
      console.log('[Socket] Token value (first 50 chars):', typeof token === 'string' ? token.substring(0, 50) : JSON.stringify(token).substring(0, 50));

      if (!token) {
        console.log('[Socket] Auth failed: No token provided');
        return next(new Error('Authentication error'));
      }

      console.log('[Socket] Verifying token...');
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string };
      console.log('[Socket] Token verified, userId:', decoded.userId);
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      console.error('[Socket] Auth error:', err);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    console.log(`[Socket] User connected: ${userId}, socket ID: ${socket.id}`);

    // Join user's personal room for direct messages
    socket.join(`user:${userId}`);
    console.log(`[Socket] User ${userId} joined personal room: user:${userId}`);

    // Handle joining conversation rooms
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket] User ${userId} joined conversation: ${conversationId}`);
    });

    // Handle leaving conversation rooms
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`[Socket] User ${userId} left conversation: ${conversationId}`);
    });

    // Debug: Log all incoming events
    socket.onAny((eventName, ...args) => {
      console.log(`[Socket] User ${userId} sent event: ${eventName}`, args);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${userId}`);
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}
