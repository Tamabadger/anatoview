import http from 'http';
import { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth';

let io: Server | null = null;

/**
 * Attach Socket.IO to the HTTP server with JWT auth middleware.
 *
 * Must be called once during bootstrap, after LTI init.
 */
export function initSocketIO(server: http.Server): void {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // nginx proxies /api/socket.io → this server
    path: '/socket.io',
  });

  // ─── JWT Authentication Middleware ─────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error('Authentication error: no token provided'));
    }

    try {
      const payload = verifyToken(token);
      // Attach decoded user to socket data for downstream handlers
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Authentication error: invalid token'));
    }
  });

  // ─── Connection Handling ───────────────────────────────────────
  io.on('connection', (socket) => {
    const userName = socket.data.user?.name ?? 'unknown';
    console.log(`[Socket.IO] Connected: ${socket.id} (${userName})`);

    // Join a lab room for real-time grade updates
    socket.on('join:lab', (labId: string) => {
      if (labId) {
        socket.join(`lab:${labId}`);
        console.log(`[Socket.IO] ${socket.id} joined room lab:${labId}`);
      }
    });

    // Leave a lab room
    socket.on('leave:lab', (labId: string) => {
      if (labId) {
        socket.leave(`lab:${labId}`);
        console.log(`[Socket.IO] ${socket.id} left room lab:${labId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('[Socket.IO] Initialized');
}

/**
 * Return the Socket.IO Server instance, or null if not yet initialized.
 * Used by route handlers to emit events.
 */
export function getIO(): Server | null {
  return io;
}
