import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './client';

let socket: Socket | null = null;

/**
 * Create and return a Socket.IO connection authenticated with the given JWT.
 *
 * Connects to the current origin with `/api/socket.io` path so that
 * nginx can proxy WebSocket traffic to the API server.
 */
export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(window.location.origin, {
    path: '/api/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
  });

  return socket;
}

/**
 * Disconnect the current socket if one exists.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Return the current Socket instance, or null if not connected.
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * React hook that manages the Socket.IO lifecycle for a given lab.
 *
 * - Connects on mount (using the current access token).
 * - Joins the `lab:{labId}` room when labId changes.
 * - Leaves the previous lab room on labId change or unmount.
 * - Returns connection status.
 */
export function useSocket(labId: string | undefined): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);
  const prevLabIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const s = connectSocket(token);

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // If already connected when effect runs
    if (s.connected) {
      setIsConnected(true);
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  // Handle lab room join/leave
  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    // Leave previous room
    if (prevLabIdRef.current) {
      s.emit('leave:lab', prevLabIdRef.current);
    }

    // Join new room
    if (labId) {
      s.emit('join:lab', labId);
    }

    prevLabIdRef.current = labId;

    return () => {
      if (labId) {
        s.emit('leave:lab', labId);
      }
    };
  }, [labId]);

  return { isConnected };
}
