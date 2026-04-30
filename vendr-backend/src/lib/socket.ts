import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new SocketIOServer(server, {
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
