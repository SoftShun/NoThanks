import type { Difficulty } from './types';

/** legacyBot.js (master server/bot.js 이식본) 의 타입 선언 */
export default class Bot {
  constructor(id: string, nickname: string, difficulty?: Difficulty);
  id: string;
  nickname: string;
  difficulty: Difficulty;
  tokens: number;
  cards: number[];
  isBot: true;
  emotionalState: Record<string, number>;
  playerRelations: Record<string, { rivalry: number; trust: number; observedPatterns: unknown[] }>;
  gameEvents: Array<{ type: string; card: number; tokens: number; myDecision?: string }>;
  baseTendency: { description: string; riskTolerance: number; emotionalIntensity: number; learningRate: number; randomness: number };
  makeDecision(gameState: BotGameState): 'take' | 'pass';
  observePlayerAction(playerId: string, action: 'take' | 'pass', card: number | null, tokens: number): void;
  reactToEvent(eventType: string, details: Record<string, unknown>): void;
  wouldPlayerWantCard(player: { id: string; isBot?: boolean; cards?: number[] }, card: number): boolean;
  calculatePlayerScore(player: { cards: number[]; tokens?: number }): number;
  calculateCurrentScore(): number;
}

/** master game.js getState() 중 봇이 읽는 필드 */
export interface BotGameState {
  players: Array<{ id: string; nickname: string; tokens: number; cards: number[]; isBot: boolean }>;
  currentCard: number | null;
  pileTokens: number;
  currentPlayerId: string | null;
  deckSize: number;
  removedCount: number;
  removedCards: number[];
  started: boolean;
  isCurrentCardHidden: boolean;
}
