import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Types for the game state broadcast from the server
export interface PlayerState {
  id: string;
  nickname: string;
  tokens: number;
  cards: number[];
  isBot?: boolean;
}

export interface GameSettings {
  removedCount: number;
  initialTokens: number;
  showOpponentTokens: boolean;
  showRealTimeScore: boolean;
  turnTimeLimit: number;
}

export interface GameState {
  players: PlayerState[];
  currentCard: number | null;
  pileTokens: number;
  currentPlayerId: string | null;
  deckSize: number;
  removedCount: number;
  started: boolean;
  hostId: string | null;
  gameSettings: GameSettings | null;
  turnStartTime: number | null;
}

interface SocketContextValue {
  socket: Socket | null;
  state: GameState | null;
  error: string | null;
  clearError: () => void;
  pass: () => void;
  take: () => void;
  startGame: () => Promise<boolean>;
  updateSettings: (settings: Partial<GameSettings>) => void;
  transferHost: (newHostId: string) => void;
  addBot: (difficulty: string) => void;
  removeBot: (botId: string) => void;
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
// 환경에 따른 서버 URL 자동 설정
const getDefaultServerUrl = () => {
  // 현재 페이지의 hostname 확인
  const currentHost = window.location.hostname;
  
  // 로컬 개발 환경 (localhost, 127.0.0.1)
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // 배포 환경 (43.201.36.137 또는 다른 IP)
  if (currentHost === '43.201.36.137') {
    return 'http://43.201.36.137:3001';
  }
  
  // 기본값: 현재 호스트의 3001 포트 사용
  return `http://${currentHost}:3001`;
};

export const SocketProvider: React.FC<ProviderProps> = ({
  nickname,
  serverUrl = getDefaultServerUrl(),
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
      setError(null); // 연결 성공 시 에러 상태 초기화
      // eslint-disable-next-line no-console
      console.log('[socket] connected to', serverUrl, s.id);
    });
    s.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.warn('[socket] disconnected', reason);
      if (reason === 'transport close' || reason === 'transport error') {
        setError(`서버 연결이 끊어졌습니다. 서버가 실행 중인지 확인하세요. (${serverUrl})`);
      }
    });
    s.on('connect_error', (err) => {
      console.error('[socket] connection error:', err);
      setError(`서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요. (${serverUrl})`);
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
  const startGame = React.useCallback(() => {
    return new Promise<boolean>((resolve) => {
      if (!socket) { resolve(false); return; }
      socket.emit('start', null, (res: any) => {
        const ok = !!res?.ok;
        if (!ok) setError(res?.error || 'Failed to start');
        resolve(ok);
      });
    });
  }, [socket]);

  const updateSettings = React.useCallback((settings: Partial<GameSettings>) => {
    if (!socket) return;
    socket.emit('updateSettings', settings);
  }, [socket]);

  const transferHost = React.useCallback((newHostId: string) => {
    if (!socket) return;
    socket.emit('transferHost', newHostId);
  }, [socket]);

  const addBot = React.useCallback((difficulty: string) => {
    if (!socket) return;
    socket.emit('addBot', difficulty);
  }, [socket]);

  const removeBot = React.useCallback((botId: string) => {
    if (!socket) return;
    socket.emit('removeBot', botId);
  }, [socket]);

  const changeNickname = React.useCallback((newNickname: string) => {
    if (!socket) return;
    socket.emit('changeNickname', newNickname);
  }, [socket]);

  const value = useMemo(
    () => ({ socket, state, error, clearError: () => setError(null), pass, take, startGame, updateSettings, transferHost, addBot, removeBot, changeNickname }),
    [socket, state, error, pass, take, startGame, updateSettings, transferHost, addBot, removeBot, changeNickname],
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