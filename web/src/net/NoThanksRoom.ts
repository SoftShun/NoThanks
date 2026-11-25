/**
 * 목 서버 방. master server/index.js 의 Socket.io 핸들러 흐름을 Colyseus Room 형태로 옮겼습니다.
 * 규칙 처리는 engine/rules.ts, 봇 의사결정은 engine/legacyBot.js(원본 이식본)를 사용합니다.
 */
import { Room, type ClientRef } from './colyseusLike';
import {
  calculateScores,
  clampSettings,
  createEngineState,
  isError,
  pass as rulePass,
  playerScore,
  startGame,
  takeCard as ruleTake,
  type ActionResult,
  type EngineState,
} from '../engine/rules';
import { Bot, botNickname, botThinkDelay, botViewOf, createBot } from '../engine/bot';
import { MAX_BOTS, MAX_PLAYERS, type Difficulty, type GameSettings, type PlayerCore, type ScoreRow } from '../engine/types';
import { random } from '../engine/rng';
import type { ClientMessages, GameEvent, RoomState, SeqEvent } from './protocol';

export interface RoomOptions {
  nickname?: string;
  /** 봇 사고시간 배율 (1 = master 와 동일). 프로토타입 시연용 */
  botSpeed?: number;
  /** 히든 카드 공개 후 실제 획득까지 지연 (master: 1000ms) */
  hiddenRevealDelayMs?: number;
}

type Player = PlayerCore & { connected: boolean };

export class NoThanksRoom extends Room<RoomState> {
  engine!: EngineState;
  hostId = '';
  seq = 0;
  botSpeed = 1;
  hiddenRevealDelayMs = 1000;
  results: ScoreRow[] = [];
  phase: RoomState['phase'] = 'lobby';
  turnDeadline = 0;
  /** 히든 카드 공개 대기 중 (원본에는 없던 중복 입력 방지 잠금 — 규칙 변화 없음) */
  revealLock = false;
  private turnTimer: number | undefined;
  private botTimer: number | undefined;
  private revealTimer: number | undefined;
  /** 테스트용 이벤트 로그 */
  eventLog: SeqEvent[] = [];

  onCreate(options: RoomOptions = {}) {
    this.engine = createEngineState();
    this.botSpeed = options.botSpeed ?? 1;
    this.hiddenRevealDelayMs = options.hiddenRevealDelayMs ?? 1000;
    this.setState(this.snapshot());

    this.onMessage('pass', (c, m: ClientMessages['pass']) => this.handleAction(c, m.actionId, 'pass'));
    this.onMessage('take', (c, m: ClientMessages['take']) => this.handleAction(c, m.actionId, 'take'));
    this.onMessage('start', (c, m: ClientMessages['start']) => this.handleStart(c, m.actionId));
    this.onMessage('updateSettings', (c, m: ClientMessages['updateSettings']) => {
      if (c.sessionId !== this.hostId) return this.nack(c, m.actionId, '방장만 설정을 변경할 수 있습니다.');
      if (this.engine.started) return this.nack(c, m.actionId, '게임이 진행 중일 때는 설정을 변경할 수 없습니다.');
      if (!m.settings || typeof m.settings !== 'object') return this.nack(c, m.actionId, '잘못된 설정 데이터입니다.');
      this.engine.settings = clampSettings({ ...this.engine.settings, ...m.settings });
      this.ack(c, m.actionId);
      this.sync();
    });
    this.onMessage('addBot', (c, m: ClientMessages['addBot']) => {
      if (!['medium', 'hard', 'expert'].includes(m.difficulty)) return this.nack(c, m.actionId, '잘못된 봇 난이도입니다.');
      if (c.sessionId !== this.hostId) return this.nack(c, m.actionId, '방장만 봇을 추가할 수 있습니다.');
      if (!this.addBot(m.difficulty)) return this.nack(c, m.actionId, '봇을 추가할 수 없습니다. (최대 3개, 총 인원 7명 제한)');
      this.ack(c, m.actionId);
      this.sync();
    });
    this.onMessage('removeBot', (c, m: ClientMessages['removeBot']) => {
      if (c.sessionId !== this.hostId) return this.nack(c, m.actionId, '방장만 봇을 제거할 수 있습니다.');
      if (!this.removeBot(m.botId)) return this.nack(c, m.actionId, '봇을 제거할 수 없습니다.');
      this.ack(c, m.actionId);
      this.sync();
    });
    this.onMessage('setNickname', (c, m: ClientMessages['setNickname']) => {
      const r = this.changeNickname(c.sessionId, m.nickname);
      if (r) return this.nack(c, m.actionId, r);
      this.ack(c, m.actionId);
      this.sync();
    });
    this.onMessage('returnToLobby', (c, m: ClientMessages['returnToLobby']) => {
      if (this.phase !== 'ended') return this.nack(c, m.actionId, '게임이 끝난 뒤에만 가능합니다.');
      this.phase = 'lobby';
      this.results = [];
      this.ack(c, m.actionId);
      this.sync();
    });
    this.onMessage('resync', (c, m: ClientMessages['resync']) => {
      this.ack(c, m.actionId);
      this.markDirty();
    });
  }

  onJoin(client: ClientRef, options: RoomOptions = {}) {
    const players = this.engine.players as Player[];
    if (this.engine.started || players.length >= MAX_PLAYERS) {
      client.send('toast', { message: '입장할 수 없습니다 (게임 중이거나 인원 초과).' });
      return;
    }
    let nickname = (options.nickname ?? '').trim() || '플레이어';
    while (players.some((p) => p.nickname === nickname)) nickname += '´';
    players.push({ id: client.sessionId, nickname, tokens: 0, cards: [], isBot: false, connected: true });
    if (players.filter((p) => !p.isBot).length === 1) this.hostId = client.sessionId;
    this.sync();
  }

  onLeave(client: ClientRef) {
    const players = this.engine.players;
    const idx = players.findIndex((p) => p.id === client.sessionId);
    if (idx === -1) return;
    const wasHost = this.hostId === client.sessionId;
    players.splice(idx, 1);
    if (wasHost) this.hostId = players.find((p) => !p.isBot)?.id ?? '';
    if (this.engine.started) {
      if (idx < this.engine.currentPlayerIndex) this.engine.currentPlayerIndex -= 1;
      else if (idx === this.engine.currentPlayerIndex && this.engine.currentPlayerIndex >= players.length) this.engine.currentPlayerIndex = 0;
    }
    if (!players.some((p) => !p.isBot)) {
      // index.js: 인간이 없으면 게임 취소 + 초기화
      this.clearTimers();
      this.engine = createEngineState(this.engine.settings);
      this.phase = 'lobby';
      this.sync();
      return;
    }
    if (this.engine.started && players.length < 2) {
      this.endGame();
      return;
    }
    this.sync();
  }

  onDispose() {
    this.clearTimers();
  }

  // ───────── 로비 조작 (game.js addBot/removeBot/changeNickname) ─────────
  addBot(difficulty: Difficulty): boolean {
    if (this.engine.started) return false;
    const players = this.engine.players;
    if (players.length >= MAX_PLAYERS) return false;
    const botCount = players.filter((p) => p.isBot).length;
    if (botCount >= MAX_BOTS) return false;
    const bot = createBot(difficulty, botCount + 1) as unknown as Player;
    (bot as Player).connected = true;
    players.push(bot);
    return true;
  }

  removeBot(botId: string): boolean {
    if (this.engine.started) return false;
    const players = this.engine.players;
    const i = players.findIndex((p) => p.id === botId && p.isBot);
    if (i === -1) return false;
    players.splice(i, 1);
    players.filter((p) => p.isBot).forEach((b, k) => (b.nickname = botNickname(k + 1, b.difficulty!)));
    return true;
  }

  changeNickname(id: string, nick: string): string | null {
    if (this.engine.started) return '게임 중에는 닉네임을 변경할 수 없습니다.';
    if (typeof nick !== 'string' || !nick.trim()) return '유효하지 않은 닉네임입니다.';
    const t = nick.trim();
    if (t.length > 20) return '닉네임은 20자를 초과할 수 없습니다.';
    if (this.engine.players.some((p) => p.id !== id && p.nickname === t)) return '이미 사용 중인 닉네임입니다.';
    const p = this.engine.players.find((x) => x.id === id);
    if (!p) return '플레이어를 찾을 수 없습니다.';
    p.nickname = t;
    return null;
  }

  // ───────── 게임 진행 ─────────
  private handleStart(c: ClientRef, actionId: string) {
    if (c.sessionId !== this.hostId) return this.nack(c, actionId, 'Only the host can start the game');
    if (this.engine.started) return this.nack(c, actionId, 'Game already started');
    if (!this.engine.players.some((p) => !p.isBot)) return this.nack(c, actionId, 'At least one human player is required to start the game');
    // 이전 판의 봇은 새 인스턴스로 교체 (master 는 판이 끝나면 봇을 제거 → 다시 추가하는 흐름. 감정 상태를 새로 시작하는 것과 같음)
    this.engine.players = this.engine.players.map((p) => {
      if (!p.isBot) return p;
      const b = new Bot(p.id, p.nickname, p.difficulty!) as unknown as Player;
      b.connected = true;
      return b;
    });
    this.results = [];
    if (!startGame(this.engine)) return this.nack(c, actionId, 'Failed to start the game');
    this.phase = 'playing';
    const seq = this.emit({
      type: 'game_started',
      order: this.engine.players.map((p) => p.id),
      deckSize: this.engine.deck.length + 1,
      removedCount: this.engine.removedCards.length,
      startTokens: this.engine.settings.initialTokens,
      opponentTokensVisible: this.engine.settings.showOpponentTokens,
    }, actionId);
    this.ack(c, actionId, seq);
    this.emitReveal();
    this.startNextTurn();
  }

  private handleAction(c: ClientRef, actionId: string, kind: 'pass' | 'take') {
    if (this.revealLock) return this.nack(c, actionId, '카드 공개 중입니다.');
    const player = this.engine.players.find((p) => p.id === c.sessionId);
    const card = this.engine.currentCard;
    const tokens = this.engine.pileTokens;
    const result = kind === 'pass' ? rulePass(this.engine, c.sessionId) : ruleTake(this.engine, c.sessionId);
    if (isError(result)) {
      this.nack(c, actionId, result.error);
      return;
    }
    this.clearTurnTimer();
    // index.js: 'pass' 핸들러는 강제 가져가기여도 'pass' 관찰만 알림
    if (kind === 'pass') this.notifyBotsOfPlayerAction(c.sessionId, 'pass', card, tokens);
    const seq = this.resolveResult(c.sessionId, kind, result, card, tokens, actionId, false, () => {
      if (kind === 'take' && player && !player.isBot) {
        this.notifyBotsOfCardTaken(player, card!, tokens);
        this.notifyBotsOfPlayerAction(c.sessionId, 'take', card, tokens);
      }
    });
    this.ack(c, actionId, seq);
  }

  /**
   * 규칙 결과를 이벤트로 변환. 반환: 첫 이벤트 seq
   * onTake: 실제로 카드를 가져간 직후 호출 (봇 알림)
   */
  private resolveResult(
    playerId: string,
    kind: 'pass' | 'take',
    result: Exclude<ActionResult, { error: string }>,
    card: number | null,
    tokens: number,
    actionId: string | undefined,
    auto: boolean,
    onTake?: () => void,
  ): number {
    if (result.needsDelay && result.isHiddenRevealed) {
      // 히든 카드: 먼저 공개 → hiddenRevealDelayMs 후 실제 획득 (index.js 1초)
      const seq = this.emit({ type: 'hidden_flipped', playerId, card: card! }, actionId);
      this.revealLock = true;
      this.sync();
      this.revealTimer = this.clock.setTimeout(() => {
        this.revealLock = false;
        const r2 = ruleTake(this.engine, playerId);
        if (isError(r2)) return;
        this.resolveResult(playerId, 'take', r2, card, tokens, undefined, auto, onTake);
      }, this.hiddenRevealDelayMs);
      return seq;
    }
    let seq: number;
    if (result.taken) {
      seq = this.emit({ type: 'card_taken', playerId, card: result.taken.card, tokens: result.taken.tokens, forced: !!result.forcedTake, auto }, actionId);
      onTake?.();
      if (result.gameOver) {
        this.endGame();
        return seq;
      }
      this.emitReveal();
    } else {
      seq = this.emit({
        type: 'chip_placed',
        playerId,
        pileTokens: this.engine.pileTokens,
        nextPlayerId: this.engine.players[this.engine.currentPlayerIndex].id,
        auto,
      }, actionId);
    }
    void kind;
    this.startNextTurn();
    return seq;
  }

  private emitReveal() {
    const c = this.engine.currentCard;
    const hidden = c != null && this.engine.hiddenCards.has(c) && !this.engine.revealedCards.has(c);
    this.emit({ type: 'card_revealed', card: hidden ? -1 : c, hidden, deckSize: this.engine.deck.length });
  }

  /** index.js startNextTurn() */
  private startNextTurn() {
    const cur = this.engine.players[this.engine.currentPlayerIndex];
    if (!cur) return;
    if (cur.isBot) {
      this.turnDeadline = 0;
      this.emit({ type: 'turn_changed', playerId: cur.id, deadline: 0 });
      this.broadcastState();
      this.handleBotTurn();
    } else {
      const limit = this.engine.settings.turnTimeLimit;
      this.turnDeadline = limit > 0 ? this.clock.now() + limit * 1000 : 0;
      this.emit({ type: 'turn_changed', playerId: cur.id, deadline: this.turnDeadline });
      if (limit > 0) {
        this.turnTimer = this.clock.setTimeout(() => this.handleTurnTimeout(cur.id), limit * 1000);
      }
      this.broadcastState();
    }
  }

  /** index.js handleTurnTimeout(): 칩이 있으면 자동 패스, 없으면 자동 가져가기 */
  private handleTurnTimeout(playerId: string) {
    const p = this.engine.players[this.engine.currentPlayerIndex];
    if (!p || p.id !== playerId || p.isBot || this.revealLock) return;
    const card = this.engine.currentCard;
    const tokens = this.engine.pileTokens;
    const r = p.tokens > 0 ? rulePass(this.engine, playerId) : ruleTake(this.engine, playerId);
    if (isError(r)) return;
    this.resolveResult(playerId, p.tokens > 0 ? 'pass' : 'take', r, card, tokens, undefined, true);
  }

  /** index.js handleBotTurn() */
  private handleBotTurn() {
    const bot = this.engine.players[this.engine.currentPlayerIndex] as unknown as Bot;
    if (!bot || !bot.isBot) return;
    const delay = botThinkDelay(bot.difficulty) * this.botSpeed;
    this.botTimer = this.clock.setTimeout(() => {
      if (!this.engine.started || this.engine.players[this.engine.currentPlayerIndex]?.id !== bot.id) return;
      const action = bot.makeDecision(botViewOf(this.engine));
      const card = this.engine.currentCard;
      const tokens = this.engine.pileTokens;
      if (action === 'take') {
        const r = ruleTake(this.engine, bot.id);
        if (isError(r)) return;
        this.resolveResult(bot.id, 'take', r, card, tokens, undefined, false, () => {
          this.notifyBotsOfCardTaken(bot as unknown as PlayerCore, card!, tokens);
          this.notifyBotsOfPlayerAction(bot.id, 'take', card, tokens);
        });
      } else {
        const r = rulePass(this.engine, bot.id);
        if (isError(r)) return;
        this.notifyBotsOfPlayerAction(bot.id, 'pass', card, tokens);
        this.resolveResult(bot.id, 'pass', r, card, tokens, undefined, false);
      }
    }, delay);
  }

  private endGame() {
    this.clearTimers();
    this.engine.started = false;
    this.results = calculateScores(this.engine.players);
    this.phase = 'ended';
    this.turnDeadline = 0;
    this.emit({ type: 'game_ended', results: this.results });
    this.sync();
  }

  // ───────── 봇 알림 (index.js 와 동일) ─────────
  private bots(): Bot[] {
    return this.engine.players.filter((p) => p.isBot) as unknown as Bot[];
  }

  private notifyBotsOfCardTaken(taker: PlayerCore, card: number, tokensGained: number) {
    for (const b of this.bots()) {
      if (b.id === taker.id) continue;
      const want = b.wouldPlayerWantCard
        ? b.wouldPlayerWantCard(taker, card)
        : b.cards.some((c) => Math.abs(c - card) <= 2);
      if (want) b.reactToEvent('someone_took_my_card', { playerId: taker.id, playerName: taker.nickname, card, tokens: tokensGained });
    }
  }

  private notifyBotsOfPlayerAction(playerId: string, action: 'take' | 'pass', card: number | null, tokens: number) {
    for (const b of this.bots()) if (b.id !== playerId) b.observePlayerAction(playerId, action, card, tokens);
  }

  private notifyBotsOfRankingChange() {
    if (!this.engine.started) return;
    const ranks = this.engine.players
      .map((p) => ({ id: p.id, score: p.cards.length === 0 ? 0 : playerScore(p), isBot: p.isBot }))
      .sort((a, b) => a.score - b.score);
    for (const b of this.bots()) {
      const myRank = ranks.findIndex((r) => r.id === b.id) + 1;
      const overtaken = myRank > 1 && ranks.slice(0, myRank - 1).some((r) => !r.isBot);
      if (overtaken) b.reactToEvent('got_overtaken', { currentRank: myRank, totalPlayers: ranks.length });
      else if (myRank === 1 && random() < 0.3) b.reactToEvent('winning_streak', { currentRank: myRank });
    }
  }

  private checkBotsConsecutiveResults() {
    for (const b of this.bots()) {
      if (!b.gameEvents) continue;
      const recent = b.gameEvents.slice(-3);
      if (recent.length >= 3 && recent.every((e) => e.type === 'decision' && e.myDecision === 'take' && (e.tokens || 0) < e.card * 0.3)) {
        b.reactToEvent('consecutive_bad_cards', { recentCards: recent.map((e) => e.card) });
      }
    }
  }

  /** index.js broadcastState(): 상태 송신 + 봇 순위 알림 */
  private broadcastState() {
    this.sync();
    if (this.engine.started) {
      this.notifyBotsOfRankingChange();
      this.checkBotsConsecutiveResults();
    }
  }

  // ───────── 공통 ─────────
  private emit(e: GameEvent, actionId?: string): number {
    const ev: SeqEvent = { ...e, seq: ++this.seq, t: this.clock.now(), ...(actionId ? { actionId } : {}) } as SeqEvent;
    this.eventLog.push(ev);
    if (this.eventLog.length > 500) this.eventLog.shift();
    this.broadcast('event', ev);
    return ev.seq;
  }
  private ack(c: ClientRef, actionId: string, seq?: number) {
    c.send('ack', { actionId, ok: true, seq });
  }
  private nack(c: ClientRef, actionId: string, error: string) {
    c.send('ack', { actionId, ok: false, error });
  }
  private clearTurnTimer() {
    this.clock.clearTimeout(this.turnTimer);
    this.turnTimer = undefined;
  }
  private clearTimers() {
    this.clearTurnTimer();
    this.clock.clearTimeout(this.botTimer);
    this.clock.clearTimeout(this.revealTimer);
    this.revealLock = false;
  }

  sync() {
    this.setState(this.snapshot());
  }

  snapshot(): RoomState {
    const e = this.engine;
    const cur = e.currentCard;
    const hidden = cur != null && e.hiddenCards.has(cur) && !e.revealedCards.has(cur);
    return {
      phase: this.phase,
      hostId: this.hostId,
      players: (e.players as Player[]).map((p) => ({
        id: p.id,
        nickname: p.nickname,
        tokens: p.tokens,
        cards: [...p.cards],
        isBot: p.isBot,
        difficulty: p.difficulty ?? '',
        connected: p.connected ?? true,
      })),
      currentCard: e.started ? (hidden ? -1 : cur) : null,
      currentCardHidden: e.started && hidden,
      pileTokens: e.pileTokens,
      currentPlayerId: e.started ? e.players[e.currentPlayerIndex]?.id ?? '' : '',
      deckSize: e.started ? e.deck.length : 0,
      removedCount: e.removedCards.length,
      settings: { ...e.settings } as GameSettings,
      turnDeadline: this.turnDeadline,
      lastSeq: this.seq,
      results: this.results,
      hiddenTotal: e.hiddenCards.size,
      hiddenRevealed: e.revealedCards.size,
    };
  }

  /** @filter: 상대 칩 비공개 설정이면 본인 외 -1 (게임 종료 후엔 공개) */
  filterStateFor(sessionId: string): RoomState {
    const s = this.state;
    if (s.settings.showOpponentTokens || s.phase !== 'playing') return s;
    return { ...s, players: s.players.map((p) => (p.id === sessionId ? p : { ...p, tokens: -1 })) };
  }
}
