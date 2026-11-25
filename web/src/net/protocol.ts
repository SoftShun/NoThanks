/**
 * 클라이언트 ↔ 서버 계약 (docs/remake/game-interface.md 와 1:1 대응)
 * 실제 Colyseus 로 교체할 때 이 파일의 타입은 그대로 두고 transport 만 바꿉니다.
 */
import type { Difficulty, GameSettings, ScoreRow } from '../engine/types';

export const ROOM_NAME = 'no_thanks';
export const PROTOCOL_VERSION = 1;

// ───────────── 상태 (Schema) ─────────────
export type Phase = 'lobby' | 'playing' | 'ended';

export interface PlayerState {
  id: string;
  nickname: string;
  /** 비공개 설정이면 다른 사람에게는 -1 (Colyseus @filter 대응) */
  tokens: number;
  cards: number[];
  isBot: boolean;
  difficulty: Difficulty | '';
  connected: boolean;
}

export interface RoomState {
  phase: Phase;
  hostId: string;
  /** 턴 순서대로 정렬됨 (게임 시작 시 섞임) */
  players: PlayerState[];
  /** null = 덱 소진 / 게임 전. 히든 미공개면 -1 */
  currentCard: number | null;
  currentCardHidden: boolean;
  pileTokens: number;
  currentPlayerId: string;
  deckSize: number;
  removedCount: number;
  settings: GameSettings;
  /** 서버 시각 기준 턴 마감(ms). 0 = 무제한/봇 턴 */
  turnDeadline: number;
  /** 마지막으로 브로드캐스트된 이벤트 seq */
  lastSeq: number;
  results: ScoreRow[];
  hiddenTotal: number;
  hiddenRevealed: number;
}

// ───────────── 클라 → 서버 메시지 ─────────────
export interface ClientMessages {
  pass: { actionId: string };
  take: { actionId: string };
  start: { actionId: string };
  updateSettings: { actionId: string; settings: Partial<GameSettings> };
  addBot: { actionId: string; difficulty: Difficulty };
  removeBot: { actionId: string; botId: string };
  setNickname: { actionId: string; nickname: string };
  returnToLobby: { actionId: string };
  /** 디버그: 시퀀스 공백 시 전체 동기화 요청 */
  resync: { actionId: string };
}
export type ClientMessageType = keyof ClientMessages;

// ───────────── 서버 → 클라 메시지 ─────────────
export interface AckMessage {
  actionId: string;
  ok: boolean;
  error?: string;
  /** 처리 결과로 생긴 이벤트 seq (있으면) */
  seq?: number;
}

export type GameEvent =
  | { type: 'game_started'; order: string[]; deckSize: number; removedCount: number; startTokens: number; opponentTokensVisible: boolean }
  | { type: 'card_revealed'; card: number | null; hidden: boolean; deckSize: number }
  | { type: 'chip_placed'; playerId: string; pileTokens: number; nextPlayerId: string; auto: boolean }
  | { type: 'hidden_flipped'; playerId: string; card: number }
  | { type: 'card_taken'; playerId: string; card: number; tokens: number; forced: boolean; auto: boolean }
  | { type: 'turn_changed'; playerId: string; deadline: number }
  | { type: 'game_ended'; results: ScoreRow[] };

export type SeqEvent = GameEvent & {
  seq: number;
  /** 서버 시각 */
  t: number;
  /** 이 이벤트를 만든 클라이언트 actionId (낙관적 반응 매칭용) */
  actionId?: string;
};

export interface ServerMessages {
  ack: AckMessage;
  event: SeqEvent;
  toast: { message: string };
}
export type ServerMessageType = keyof ServerMessages;

/** 화면 표시용 테이블 뷰 (이벤트를 순서대로 적용해 만듦) */
export interface TableView {
  players: Array<Pick<PlayerState, 'id' | 'nickname' | 'tokens' | 'cards' | 'isBot' | 'difficulty'>>;
  currentCard: number | null;
  currentCardHidden: boolean;
  pileTokens: number;
  currentPlayerId: string;
  deckSize: number;
  lastSeq: number;
}

export function viewFromState(s: RoomState): TableView {
  return {
    players: s.players.map((p) => ({ id: p.id, nickname: p.nickname, tokens: p.tokens, cards: [...p.cards], isBot: p.isBot, difficulty: p.difficulty })),
    currentCard: s.currentCard,
    currentCardHidden: s.currentCardHidden,
    pileTokens: s.pileTokens,
    currentPlayerId: s.currentPlayerId,
    deckSize: s.deckSize,
    lastSeq: s.lastSeq,
  };
}

/**
 * 이벤트 1개를 뷰에 적용 (순수 함수). 클라 애니메이션 큐와 테스트가 공유합니다.
 * 토큰이 비공개(-1)인 플레이어는 -1 을 유지합니다. me = 이 뷰를 보는 플레이어 id
 */
export function applyEvent(v: TableView, e: SeqEvent, me = ''): TableView {
  const players = v.players.map((p) => ({ ...p, cards: [...p.cards] }));
  const next: TableView = { ...v, players, lastSeq: e.seq };
  const find = (id: string) => players.find((p) => p.id === id);
  switch (e.type) {
    case 'game_started': {
      const ordered = e.order.map((id) => find(id)).filter(Boolean) as typeof players;
      ordered.forEach((p) => {
        p.cards = [];
        p.tokens = e.opponentTokensVisible || p.id === me ? e.startTokens : -1;
      });
      next.players = ordered;
      next.deckSize = e.deckSize;
      next.pileTokens = 0;
      next.currentCard = null;
      next.currentCardHidden = false;
      next.currentPlayerId = e.order[0] ?? '';
      break;
    }
    case 'card_revealed':
      next.currentCard = e.card;
      next.currentCardHidden = e.hidden;
      next.deckSize = e.deckSize;
      break;
    case 'chip_placed': {
      const p = find(e.playerId);
      if (p && p.tokens > 0) p.tokens -= 1;
      next.pileTokens = e.pileTokens;
      next.currentPlayerId = e.nextPlayerId;
      break;
    }
    case 'hidden_flipped':
      next.currentCard = e.card;
      next.currentCardHidden = false;
      break;
    case 'card_taken': {
      const p = find(e.playerId);
      if (p) {
        p.cards.push(e.card);
        if (p.tokens !== -1) p.tokens += e.tokens;
      }
      next.pileTokens = 0;
      next.currentCard = null;
      next.currentCardHidden = false;
      break;
    }
    case 'turn_changed':
      next.currentPlayerId = e.playerId;
      break;
    case 'game_ended':
      next.currentPlayerId = '';
      break;
  }
  return next;
}

/** 뷰 비교용 해시 (서버 상태와 클라 표시가 같은지 검증) */
export function viewHash(v: TableView): string {
  return JSON.stringify([
    v.players.map((p) => [p.id, p.tokens, [...p.cards].sort((a, b) => a - b)]),
    v.currentCard,
    v.currentCardHidden,
    v.pileTokens,
    v.currentPlayerId,
    v.deckSize,
  ]);
}
