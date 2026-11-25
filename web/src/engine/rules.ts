/**
 * 순수 규칙 엔진. master server/game.js 의 규칙을 그대로 옮겼습니다.
 * 상태를 직접 바꾸는(mutable) 원본 스타일을 유지하되, 함수 단위로 분리해 테스트합니다.
 * 위치 대응은 docs/remake/rules.md 참고.
 */
import { random } from './rng';
import {
  CARD_MAX,
  CARD_MIN,
  DEFAULT_SETTINGS,
  type GameSettings,
  type PlayerCore,
  type ScoreRow,
} from './types';

export interface EngineState {
  players: PlayerCore[];
  deck: number[];
  removedCards: number[];
  currentCard: number | null;
  pileTokens: number;
  currentPlayerIndex: number;
  started: boolean;
  hiddenCards: Set<number>;
  revealedCards: Set<number>;
  settings: GameSettings;
}

export function createEngineState(settings: Partial<GameSettings> = {}): EngineState {
  return {
    players: [],
    deck: [],
    removedCards: [],
    currentCard: null,
    pileTokens: 0,
    currentPlayerIndex: 0,
    started: false,
    hiddenCards: new Set(),
    revealedCards: new Set(),
    settings: clampSettings({ ...DEFAULT_SETTINGS, ...settings }),
  };
}

/** game.js updateSettings() 의 범위 제한 */
export function clampSettings(s: GameSettings): GameSettings {
  const out = { ...s };
  out.removedCount = Math.max(1, Math.min(32, out.removedCount));
  out.initialTokens = Math.max(1, Math.min(50, out.initialTokens));
  out.turnTimeLimit = Math.max(0, Math.min(300, out.turnTimeLimit));
  if (!['normal', 'hidden'].includes(out.gameMode)) out.gameMode = 'normal';
  out.hiddenCardCount = Math.max(1, Math.min(5, out.hiddenCardCount));
  return out;
}

/** 3~35 전체 덱 */
export function fullDeck(): number[] {
  const d: number[] = [];
  for (let i = CARD_MIN; i <= CARD_MAX; i++) d.push(i);
  return d;
}

/** game.js start(): 무작위 제거 → 남은 카드 피셔-예이츠 셔플 */
export function buildDeck(removedCount: number): { deck: number[]; removed: number[] } {
  const removed: number[] = [];
  const remaining = fullDeck();
  for (let i = 0; i < removedCount; i++) {
    const idx = Math.floor(random() * remaining.length);
    removed.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  const deck = [...remaining];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { deck, removed };
}

/** game.js shufflePlayerOrder() */
export function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** game.js selectHiddenCards() */
export function selectHiddenCards(deck: number[], count: number): Set<number> {
  const set = new Set<number>();
  const remaining = [...deck];
  const n = Math.min(count, remaining.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(random() * remaining.length);
    set.add(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return set;
}

/** game.js start() */
export function startGame(s: EngineState): boolean {
  if (s.started) return false;
  const { deck, removed } = buildDeck(s.settings.removedCount);
  s.removedCards = removed;
  s.deck = deck;
  s.hiddenCards = new Set();
  s.revealedCards = new Set();
  if (s.settings.gameMode === 'hidden') {
    s.hiddenCards = selectHiddenCards(s.deck, s.settings.hiddenCardCount);
  }
  shuffleInPlace(s.players);
  s.players.forEach((p) => {
    p.tokens = s.settings.initialTokens;
    p.cards = [];
  });
  s.currentPlayerIndex = 0;
  s.currentCard = s.deck.length > 0 ? s.deck.shift()! : null;
  s.pileTokens = 0;
  s.started = true;
  return true;
}

export type ActionResult =
  | { error: string }
  | { gameOver: boolean; forcedTake?: boolean; isHiddenRevealed?: boolean; needsDelay?: boolean; taken?: { card: number; tokens: number } };

export function isError(r: ActionResult): r is { error: string } {
  return 'error' in r;
}

/** game.js pass(): 칩 1개를 걸고 다음 사람. 칩이 0이면 강제로 가져가기 */
export function pass(s: EngineState, playerId: string): ActionResult {
  if (!s.started) return { error: 'Game not started' };
  const player = s.players[s.currentPlayerIndex];
  if (!player || player.id !== playerId) return { error: 'Not your turn' };
  if (player.tokens > 0) {
    player.tokens -= 1;
    s.pileTokens += 1;
    s.currentPlayerIndex = (s.currentPlayerIndex + 1) % s.players.length;
    return { gameOver: false };
  }
  const r = takeCard(s, playerId);
  return isError(r) ? r : { ...r, forcedTake: true };
}

/** game.js takeCard(): 카드+칩 획득, 같은 플레이어가 계속. 덱이 비면 종료 */
export function takeCard(s: EngineState, playerId: string): ActionResult {
  if (!s.started) return { error: 'Game not started' };
  const player = s.players[s.currentPlayerIndex];
  if (!player || player.id !== playerId) return { error: 'Not your turn' };

  if (s.currentCard != null && s.hiddenCards.has(s.currentCard) && !s.revealedCards.has(s.currentCard)) {
    s.revealedCards.add(s.currentCard);
    return { gameOver: false, isHiddenRevealed: true, needsDelay: true };
  }

  const card = s.currentCard;
  const tokens = s.pileTokens;
  if (s.currentCard != null) player.cards.push(s.currentCard);
  if (s.pileTokens > 0) {
    player.tokens += s.pileTokens;
    s.pileTokens = 0;
  }
  s.currentCard = s.deck.length > 0 ? s.deck.shift()! : null;
  if (s.currentCard == null) {
    s.started = false;
    return { gameOver: true, isHiddenRevealed: false, taken: { card: card!, tokens } };
  }
  return { gameOver: false, isHiddenRevealed: false, taken: { card: card!, tokens } };
}

/** 연속 묶음의 최저값만 합산 (game.js calculateScores 의 카드 부분) */
export function cardPoints(cards: readonly number[]): number {
  const sorted = [...cards].sort((a, b) => a - b);
  let sum = 0;
  let prev: number | null = null;
  for (const c of sorted) {
    if (prev == null || c !== prev + 1) sum += c;
    prev = c;
  }
  return sum;
}

/** 카드 점수 - 칩 (낮을수록 좋음) */
export function playerScore(p: { cards: readonly number[]; tokens: number }): number {
  return cardPoints(p.cards) - p.tokens;
}

/** 연속 묶음 분리 (표시용): [[3,4,5],[9],[20,21]] */
export function runsOf(cards: readonly number[]): number[][] {
  const sorted = [...cards].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const c of sorted) {
    const last = runs[runs.length - 1];
    if (last && c === last[last.length - 1] + 1) last.push(c);
    else runs.push([c]);
  }
  return runs;
}

/** game.js calculateScores(): 점수 오름차순 정렬 후 rank = index+1 (동점도 순번 부여 — 원본과 동일) */
export function calculateScores(players: readonly PlayerCore[]): ScoreRow[] {
  const rows = players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    cardPoints: cardPoints(p.cards),
    score: playerScore(p),
    cards: [...p.cards],
    tokens: p.tokens,
    rank: 0,
    isBot: p.isBot,
  }));
  rows.sort((a, b) => a.score - b.score);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
