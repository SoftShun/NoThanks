/** 게임 규칙 상 공유 타입. master server/game.js 의 gameSettings / getState() 형태를 따릅니다. */
export type Difficulty = 'medium' | 'hard' | 'expert';
export type GameMode = 'normal' | 'hidden';

export interface GameSettings {
  /** 제거할 카드 수 (기본 9, 1~32) */
  removedCount: number;
  /** 초기 칩(토큰) 수 (기본 11, 1~50) — master 는 인원과 무관하게 고정값 */
  initialTokens: number;
  /** 상대 칩 공개 여부 (기본 false) */
  showOpponentTokens: boolean;
  /** 실시간 점수 표시 (기본 true) */
  showRealTimeScore: boolean;
  /** 턴 제한 시간 초 (기본 30, 0=무제한, 0~300) */
  turnTimeLimit: number;
  /** 'normal' | 'hidden' (기본 normal) */
  gameMode: GameMode;
  /** 히든 카드 수 (기본 3, 1~5) */
  hiddenCardCount: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  removedCount: 9,
  initialTokens: 11,
  showOpponentTokens: false,
  showRealTimeScore: true,
  turnTimeLimit: 30,
  gameMode: 'normal',
  hiddenCardCount: 3,
};

export const CARD_MIN = 3;
export const CARD_MAX = 35;
export const MAX_PLAYERS = 7;
export const MAX_BOTS = 3;

export interface PlayerCore {
  id: string;
  nickname: string;
  tokens: number;
  cards: number[];
  isBot: boolean;
  difficulty?: Difficulty;
}

export interface ScoreRow {
  id: string;
  nickname: string;
  score: number;
  /** 카드 합(연속 묶음 최저값 합) — 표시용 */
  cardPoints: number;
  cards: number[];
  tokens: number;
  rank: number;
  isBot: boolean;
}
