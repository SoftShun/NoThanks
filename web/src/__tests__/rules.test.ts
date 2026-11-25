import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildDeck,
  calculateScores,
  cardPoints,
  clampSettings,
  createEngineState,
  fullDeck,
  isError,
  pass,
  playerScore,
  runsOf,
  startGame,
  takeCard,
} from '../engine/rules';
import { DEFAULT_SETTINGS, type PlayerCore } from '../engine/types';
import { mulberry32, resetRandomSource, setRandomSource } from '../engine/rng';

const P = (id: string): PlayerCore => ({ id, nickname: id, tokens: 0, cards: [], isBot: false });

beforeEach(() => setRandomSource(mulberry32(42)));
afterEach(() => resetRandomSource());

describe('덱 구성', () => {
  it('카드 범위는 3~35 (33장)', () => {
    const d = fullDeck();
    expect(d.length).toBe(33);
    expect(d[0]).toBe(3);
    expect(d[32]).toBe(35);
  });
  it('기본 9장 제거 → 24장, 중복 없음', () => {
    const { deck, removed } = buildDeck(9);
    expect(removed.length).toBe(9);
    expect(deck.length).toBe(24);
    expect(new Set([...deck, ...removed]).size).toBe(33);
  });
  it('설정 범위 제한 (game.js updateSettings)', () => {
    const s = clampSettings({ ...DEFAULT_SETTINGS, removedCount: 99, initialTokens: 0, turnTimeLimit: 999, hiddenCardCount: 9 });
    expect(s).toMatchObject({ removedCount: 32, initialTokens: 1, turnTimeLimit: 300, hiddenCardCount: 5 });
  });
  it('기본 설정값 = master', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      removedCount: 9, initialTokens: 11, showOpponentTokens: false, showRealTimeScore: true,
      turnTimeLimit: 30, gameMode: 'normal', hiddenCardCount: 3,
    });
  });
});

describe('게임 시작', () => {
  it('인원과 무관하게 모두 initialTokens 를 받고 첫 카드가 공개된다', () => {
    for (const n of [2, 3, 5, 7]) {
      const s = createEngineState();
      for (let i = 0; i < n; i++) s.players.push(P('p' + i));
      expect(startGame(s)).toBe(true);
      expect(s.players.every((p) => p.tokens === 11 && p.cards.length === 0)).toBe(true);
      expect(s.currentCard).not.toBeNull();
      expect(s.deck.length).toBe(23);
      expect(s.pileTokens).toBe(0);
      expect(s.currentPlayerIndex).toBe(0);
    }
  });
  it('이미 시작했으면 false', () => {
    const s = createEngineState();
    s.players.push(P('a'), P('b'));
    startGame(s);
    expect(startGame(s)).toBe(false);
  });
});

describe('턴 진행', () => {
  const setup = () => {
    const s = createEngineState();
    s.players.push(P('a'), P('b'), P('c'));
    startGame(s);
    return s;
  };
  it('패스: 칩 1개를 카드에 올리고 다음 사람', () => {
    const s = setup();
    const first = s.players[0];
    pass(s, first.id);
    expect(first.tokens).toBe(10);
    expect(s.pileTokens).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
  });
  it('차례가 아니면 거절', () => {
    const s = setup();
    const r = pass(s, s.players[1].id);
    expect(isError(r) && r.error).toBe('Not your turn');
    expect(isError(takeCard(s, s.players[2].id))).toBe(true);
  });
  it('가져가기: 카드와 칩을 얻고 같은 사람이 계속', () => {
    const s = setup();
    pass(s, s.players[0].id);
    pass(s, s.players[1].id);
    const p = s.players[2];
    const card = s.currentCard!;
    takeCard(s, p.id);
    expect(p.cards).toEqual([card]);
    expect(p.tokens).toBe(13);
    expect(s.pileTokens).toBe(0);
    expect(s.currentPlayerIndex).toBe(2);
    expect(s.currentCard).not.toBe(card);
  });
  it('칩이 0이면 패스가 강제 가져가기로 바뀐다', () => {
    const s = setup();
    s.players[0].tokens = 0;
    const card = s.currentCard!;
    const r = pass(s, s.players[0].id);
    expect(!isError(r) && r.forcedTake).toBe(true);
    expect(s.players[0].cards).toEqual([card]);
    expect(s.currentPlayerIndex).toBe(0);
  });
  it('덱이 다 떨어지면 종료 (마지막 카드 가져갈 때)', () => {
    const s = setup();
    let guard = 0;
    let over = false;
    while (!over && guard++ < 1000) {
      const cur = s.players[s.currentPlayerIndex];
      const r = takeCard(s, cur.id);
      if (!isError(r)) over = r.gameOver;
    }
    expect(over).toBe(true);
    expect(s.started).toBe(false);
    expect(s.players.reduce((n, p) => n + p.cards.length, 0)).toBe(24);
  });
  it('히든 모드: 첫 가져가기는 공개만, 두 번째에 획득', () => {
    const s = createEngineState({ gameMode: 'hidden', hiddenCardCount: 5 });
    s.players.push(P('a'), P('b'));
    startGame(s);
    expect(s.hiddenCards.size).toBe(5);
    // 히든 카드가 나올 때까지 가져가기
    let guard = 0;
    while (!s.hiddenCards.has(s.currentCard!) && guard++ < 50) takeCard(s, s.players[s.currentPlayerIndex].id);
    const pid = s.players[s.currentPlayerIndex].id;
    const card = s.currentCard!;
    const r1 = takeCard(s, pid);
    expect(!isError(r1) && r1.isHiddenRevealed).toBe(true);
    expect(s.currentCard).toBe(card);
    const r2 = takeCard(s, pid);
    expect(!isError(r2) && r2.taken?.card).toBe(card);
  });
});

describe('점수 계산', () => {
  it('연속 묶음은 최저값만 합산', () => {
    expect(cardPoints([3, 4, 5])).toBe(3);
    expect(cardPoints([35, 33, 34, 10])).toBe(43);
    expect(cardPoints([20, 22])).toBe(42);
    expect(cardPoints([])).toBe(0);
  });
  it('점수 = 카드 점수 - 칩', () => {
    expect(playerScore({ cards: [27, 28, 29], tokens: 5 })).toBe(22);
    expect(playerScore({ cards: [], tokens: 11 })).toBe(-11);
  });
  it('묶음 분리', () => {
    expect(runsOf([9, 3, 5, 4, 21, 20])).toEqual([[3, 4, 5], [9], [20, 21]]);
  });
  it('낮은 점수가 1등, 동점은 원본처럼 정렬 순서대로 순번', () => {
    const rows = calculateScores([
      { ...P('a'), cards: [30], tokens: 0 },
      { ...P('b'), cards: [10, 11], tokens: 2 },
      { ...P('c'), cards: [8], tokens: 0 },
    ]);
    expect(rows.map((r) => [r.id, r.score, r.rank])).toEqual([
      ['b', 8, 1],
      ['c', 8, 2],
      ['a', 30, 3],
    ]);
  });
});
