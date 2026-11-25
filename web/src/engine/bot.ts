import Bot, { type BotGameState } from './legacyBot.js';
import type { Difficulty } from './types';
import type { EngineState } from './rules';
import { random } from './rng';

export { Bot };
export type { BotGameState };

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { medium: '중', hard: '상', expert: '최상' };

/** game.js addBot() 의 닉네임 규칙: `AI봇 N (난이도)` */
export function botNickname(index: number, difficulty: Difficulty): string {
  return `AI봇 ${index} (${DIFFICULTY_LABEL[difficulty]})`;
}

export function createBot(difficulty: Difficulty, index: number): Bot {
  const id = `bot_${Date.now()}_${Math.floor(random() * 1e9)}`;
  return new Bot(id, botNickname(index, difficulty), difficulty);
}

export function isBot(p: unknown): p is Bot {
  return p instanceof Bot;
}

/**
 * index.js handleBotTurn() 의 사고 시간: base + rand * range (ms)
 * medium 800+0~2000, hard 900+0~2800, expert 1000+0~3500
 */
export const BOT_THINK_MS: Record<Difficulty, { base: number; range: number }> = {
  medium: { base: 800, range: 2000 },
  hard: { base: 900, range: 2800 },
  expert: { base: 1000, range: 3500 },
};

export function botThinkDelay(d: Difficulty): number {
  const t = BOT_THINK_MS[d];
  return t.base + random() * t.range;
}

/** 봇에게 넘기는 상태 = game.js getState() 와 같은 모양 */
export function botViewOf(s: EngineState): BotGameState {
  return {
    players: s.players.map((p) => ({ id: p.id, nickname: p.nickname, tokens: p.tokens, cards: p.cards, isBot: p.isBot })),
    currentCard: s.currentCard,
    pileTokens: s.pileTokens,
    currentPlayerId: s.players[s.currentPlayerIndex]?.id ?? null,
    deckSize: s.deck.length,
    removedCount: s.removedCards.length,
    removedCards: s.removedCards,
    started: s.started,
    isCurrentCardHidden: s.currentCard != null && s.hiddenCards.has(s.currentCard) && !s.revealedCards.has(s.currentCard),
  };
}
