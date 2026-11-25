import { create } from 'zustand';
import type { RoomState, TableView } from '../net/protocol';
import type { ScoreRow } from '../engine/types';
import type { LayoutMode } from './config';

export type Screen = 'connecting' | 'lobby' | 'game' | 'results';

export interface Prefs {
  latency: 0 | 100 | 300;
  sound: boolean;
  haptics: boolean;
  /** system = OS 설정 따름 */
  motion: 'system' | 'reduce' | 'full';
  botSpeed: 1 | 0.5 | 0.25;
  showStats: boolean;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export interface LogLine {
  seq: number;
  text: string;
}

interface StoreState {
  screen: Screen;
  sessionId: string;
  room: RoomState | null;
  view: TableView | null;
  results: ScoreRow[];
  pending: 'pass' | 'take' | null;
  animating: boolean;
  /** 히든 카드 공개 대기 중 */
  revealing: boolean;
  toasts: Toast[];
  log: LogLine[];
  prefs: Prefs;
  layout: LayoutMode;
  stats: { fps: number; renders?: number; inputMs: number[]; lastInputMs: number | null };
  hoverCard: boolean;
  set: (p: Partial<StoreState>) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  pushLog: (l: LogLine) => void;
  recordInput: (ms: number) => void;
}

const loadPrefs = (): Prefs => {
  const d: Prefs = { latency: 0, sound: true, haptics: true, motion: 'system', botSpeed: 1, showStats: false };
  try {
    const raw = localStorage.getItem('nt-prefs');
    if (raw) return { ...d, ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
  return d;
};

let toastId = 0;

export const useStore = create<StoreState>((set, get) => ({
  screen: 'connecting',
  sessionId: '',
  room: null,
  view: null,
  results: [],
  pending: null,
  animating: false,
  revealing: false,
  toasts: [],
  log: [],
  prefs: loadPrefs(),
  layout: 'desktop',
  stats: { fps: 0, inputMs: [], lastInputMs: null },
  hoverCard: false,
  set: (p) => set(p),
  setPrefs: (p) => {
    const prefs = { ...get().prefs, ...p };
    try {
      localStorage.setItem('nt-prefs', JSON.stringify(prefs));
    } catch {
      /* noop */
    }
    set({ prefs });
  },
  toast: (text, tone = 'info') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, text, tone }].slice(-3) });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600);
  },
  pushLog: (l) => set({ log: [...get().log, l].slice(-60) }),
  recordInput: (ms) => {
    const s = get().stats;
    set({ stats: { ...s, inputMs: [...s.inputMs, ms].slice(-50), lastInputMs: ms } });
  },
}));

export const selectMe = (s: StoreState) => s.view?.players.find((p) => p.id === s.sessionId) ?? null;
