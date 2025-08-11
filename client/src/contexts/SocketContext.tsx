import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Types for the game state broadcast from the server
export interface PlayerState {
  id: string;
  nickname: string;
  tokens: number;
  cards: number[];
}

export interface GameState {
  players: PlayerState[];
  currentCard: number | null;
  pileTokens: number;
  currentPlayerId: string | null;
  deckSize: number;
  removedCount: number;
  started: boolean;
  initialTokens: number;
  hostId: string | null;
}

interface SocketContextValue {
  socket: Socket | null;
  state: GameState | null;
  error: string | null;
  clearError: () => void;
  pass: () => void;
  take: () => void;
  startGame: (settings: { removedCount: number; initialTokens: number }) => Promise<boolean>;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

interface ProviderProps {
  nickname: string;
  serverUrl?: string;
  onGameEnd?: (results: any[]) => void;
  children: React.ReactNode;
}

/**
 * SocketProvider establishes a Socket.io connection to the server and
 * listens for game events. It exposes the current game state and
 * action functions to consumers via context.
 */
export const SocketProvider: React.FC<ProviderProps> = ({
  nickname,
  serverUrl = 'http://43.201.36.137:3001',
  onGameEnd,
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onGameEndRef = useRef<((results: any[]) => void) | undefined>(onGameEnd);
  const connectedRef = useRef<boolean>(false);

  // Keep the latest onGameEnd in a ref so we don't reconnect sockets on function identity changes
  useEffect(() => {
    onGameEndRef.current = onGameEnd;
  }, [onGameEnd]);

  useEffect(() => {
    // Establish socket connection
    if (connectedRef.current) return;
    connectedRef.current = true;
    const s: Socket = io(serverUrl, { transports: ['websocket'] });
    setSocket(s);
    // Listen for server events
    s.on('gameState', (data: GameState) => {
      setState(data);
      // eslint-disable-next-line no-console
      console.log('[gameState]', data);
    });
    s.on('gameEnd', (data: { results: any[] }) => {
      if (onGameEndRef.current) onGameEndRef.current(data.results);
    });
    s.on('error', (err: any) => {
      setError(err?.message || 'Unknown error');
    });
    s.on('gameError', (err: any) => {
      setError(err?.message || 'Unknown error');
    });
    s.on('toast', (data: { message: string }) => {
      setError(data?.message || '');
    });
    s.on('connect', () => {
      // Send join request once connected
      s.emit('join', { nickname });
      // eslint-disable-next-line no-console
      console.log('[socket] connected', s.id);
    });
    s.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.warn('[socket] disconnected', reason);
    });
    s.on('connect_error', (err) => {
      setError(err?.message || 'Connection error');
    });
    return () => {
      try { s.disconnect(); } catch {}
      connectedRef.current = false;
    };
  }, [nickname, serverUrl]);

  // Action wrappers
  const pass = React.useCallback(() => {
    if (!socket) return;
    socket.emit('pass');
  }, [socket]);
  const take = React.useCallback(() => {
    if (!socket) return;
    socket.emit('take');
  }, [socket]);
  const startGame = React.useCallback((settings: { removedCount: number; initialTokens: number }) => {
    return new Promise<boolean>((resolve) => {
      if (!socket) { resolve(false); return; }
      socket.emit('start', settings, (res: any) => {
        const ok = !!res?.ok;
        if (!ok) setError(res?.error || 'Failed to start');
        resolve(ok);
      });
    });
  }, [socket]);

  const value = useMemo(
    () => ({ socket, state, error, clearError: () => setError(null), pass, take, startGame }),
    [socket, state, error, pass, take, startGame],
  );
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

/**
 * Custom hook for consuming the socket context. Throws if used outside
 * of a SocketProvider.
 */
export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return ctx;
}