import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Bot from '../engine/legacyBot.js';
import { botViewOf, botThinkDelay, BOT_THINK_MS } from '../engine/bot';
import { createEngineState, isError, pass, startGame, takeCard, calculateScores } from '../engine/rules';
import { mulberry32, random, resetRandomSource, setRandomSource } from '../engine/rng';
import type { Difficulty } from '../engine/types';

afterEach(() => resetRandomSource());

/** master server/bot.js 원본을 그대로 로드 (crypto-random 만 시드 RNG 로 대체, 콘솔 무음) */
function loadOriginalBot(rng: () => number) {
  const src = readFileSync(resolve(__dirname, '../../../server/bot.js'), 'utf8');
  const module = { exports: {} as any };
  const fakeRequire = (name: string) => {
    if (name === './crypto-random') return { enhancedRandom: rng, random: rng };
    throw new Error('unexpected require ' + name);
  };
  const silent = { log() {}, error() {}, warn() {} };
  new Function('require', 'module', 'console', src)(fakeRequire, module, silent);
  return module.exports as typeof Bot;
}

function playBotGame(BotClass: typeof Bot, difficulties: Difficulty[], seed: number) {
  setRandomSource(mulberry32(seed));
  const s = createEngineState();
  difficulties.forEach((d, i) => s.players.push(new BotClass('b' + i, 'bot' + i, d) as any));
  startGame(s);
  const decisions: string[] = [];
  let guard = 0;
  while (s.started && guard++ < 2000) {
    const bot = s.players[s.currentPlayerIndex] as unknown as Bot;
    const action = bot.makeDecision(botViewOf(s));
    decisions.push(action);
    const r = action === 'take' ? takeCard(s, bot.id) : pass(s, bot.id);
    expect(isError(r)).toBe(false);
  }
  return { decisions, scores: calculateScores(s.players), started: s.started };
}

describe('봇 (master bot.js 이식본)', () => {
  it('이식본과 원본이 같은 시드에서 완전히 같은 결정을 내린다 (3 난이도 × 20판)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const diffs: Difficulty[] = ['medium', 'hard', 'expert'];
      let shared = mulberry32(seed * 7919);
      const rngProxy = () => shared();
      const Original = loadOriginalBot(rngProxy);
      // 같은 시드로 두 번 실행: 원본/이식본 모두 rng 모듈의 source 를 사용하도록 맞춘다
      setRandomSource(mulberry32(seed));
      shared = mulberry32(seed);
      const a = (() => {
        // 원본은 rngProxy(shared) 를, 엔진은 rng.source 를 쓰므로 둘을 같은 스트림으로 묶는다
        setRandomSource(() => shared());
        const s = createEngineState();
        diffs.forEach((d, i) => s.players.push(new Original('b' + i, 'bot' + i, d) as any));
        startGame(s);
        const out: string[] = [];
        while (s.started) {
          const bot = s.players[s.currentPlayerIndex] as any;
          const act = bot.makeDecision(botViewOf(s));
          out.push(act);
          act === 'take' ? takeCard(s, bot.id) : pass(s, bot.id);
        }
        return out;
      })();
      const b = (() => {
        shared = mulberry32(seed);
        setRandomSource(() => shared());
        const s = createEngineState();
        diffs.forEach((d, i) => s.players.push(new Bot('b' + i, 'bot' + i, d) as any));
        startGame(s);
        const out: string[] = [];
        while (s.started) {
          const bot = s.players[s.currentPlayerIndex] as any;
          const act = bot.makeDecision(botViewOf(s));
          out.push(act);
          act === 'take' ? takeCard(s, bot.id) : pass(s, bot.id);
        }
        return out;
      })();
      expect(b).toEqual(a);
      expect(a.length).toBeGreaterThan(24);
    }
  });

  it('난이도별 기본 성향 수치 = master', () => {
    setRandomSource(mulberry32(3));
    expect(new Bot('x', 'x', 'medium').baseTendency).toMatchObject({ riskTolerance: 0.5, emotionalIntensity: 0.3, learningRate: 0.1, randomness: 0.15 });
    expect(new Bot('x', 'x', 'hard').baseTendency).toMatchObject({ riskTolerance: 0.7, emotionalIntensity: 0.6, learningRate: 0.3, randomness: 0.25 });
    expect(new Bot('x', 'x', 'expert').baseTendency).toMatchObject({ riskTolerance: 0.8, emotionalIntensity: 0.8, learningRate: 0.5, randomness: 0.35 });
  });

  it('칩이 없으면 반드시 가져간다', () => {
    setRandomSource(mulberry32(5));
    const s = createEngineState();
    const b = new Bot('b', 'b', 'expert');
    s.players.push(b as any, { id: 'h', nickname: 'h', tokens: 0, cards: [], isBot: false });
    startGame(s);
    b.tokens = 0;
    s.currentPlayerIndex = s.players.indexOf(b as any);
    expect(b.makeDecision(botViewOf(s))).toBe('take');
  });

  it('칩이 카드값보다 많이 쌓이면 가져간다 (명백한 이익)', () => {
    for (const d of ['medium', 'hard', 'expert'] as Difficulty[]) {
      setRandomSource(mulberry32(9));
      const s = createEngineState();
      const b = new Bot('b', 'b', d);
      s.players.push(b as any, { id: 'h', nickname: 'h', tokens: 11, cards: [], isBot: false });
      startGame(s);
      s.currentPlayerIndex = s.players.indexOf(b as any);
      s.currentCard = 8;
      s.pileTokens = 12;
      expect(b.makeDecision(botViewOf(s))).toBe('take');
    }
  });

  it('봇끼리 50판을 끝까지 진행해도 오류 없이 종료된다', () => {
    for (let seed = 100; seed < 150; seed++) {
      const r = playBotGame(Bot, ['medium', 'hard', 'expert'], seed);
      expect(r.started).toBe(false);
      expect(r.scores.reduce((n, x) => n + x.cards.length, 0)).toBe(24);
    }
  });

  it('난이도별 사고 시간 = index.js', () => {
    expect(BOT_THINK_MS).toEqual({ medium: { base: 800, range: 2000 }, hard: { base: 900, range: 2800 }, expert: { base: 1000, range: 3500 } });
    setRandomSource(() => 0.999999);
    expect(botThinkDelay('expert')).toBeCloseTo(4500, 0);
    setRandomSource(() => 0);
    expect(botThinkDelay('medium')).toBe(800);
    void random;
  });
});
