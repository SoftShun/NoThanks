/*
 * Game logic for a simplified No Thanks! implementation.
 *
 * This class encapsulates the state of a single game and exposes
 * methods to add/remove players, start the game with custom settings,
 * handle actions (pass and take card), and compute final scores.
 *
 * The rules implemented here align with the user requirements:
 * - Deck consists of cards numbered 3–35. A configurable number of
 *   cards are removed randomly at the start of each game.
 * - Players begin with a configurable number of tokens.
 * - On a player's turn they may either "pass" (pay one token onto
 *   the current card) or "take" the card, collecting all tokens on it.
 * - If a player attempts to pass with zero tokens, they are forced
 *   to take the card.
 * - Taking a card keeps the current player as the active player;
 *   passing advances the turn to the next player.
 * - When the deck is exhausted, the game ends and scores are
 *   calculated: for each player, the sum of the lowest card in each
 *   run of consecutive cards minus the number of tokens they hold.
 */

const Bot = require('./bot');

class Game {
  constructor() {
    this.reset();
  }

  /**
   * Reset the game state to an initial pre-game configuration.
   */
  reset() {
    this.players = []; // { id, nickname, tokens, cards, isBot }
    this.deck = [];
    this.removedCards = [];
    this.currentCard = null;
    this.pileTokens = 0;
    this.currentPlayerIndex = 0;
    this.started = false;
    
    // 게임 설정 (기본값)
    this.gameSettings = {
      removedCount: 9,           // 제거할 카드 수
      initialTokens: 11,         // 초기 토큰 수  
      showOpponentTokens: true,  // 상대 토큰 공개
      showRealTimeScore: true,   // 게임 중 실시간 점수 표시
      turnTimeLimit: 30          // 턴 시간 제한 (초, 0=무제한)
    };
    
    // 방장 및 턴 관리
    this.hostId = null;          // 방장 ID
    this.turnTimer = null;       // 턴 타이머
    this.turnStartTime = null;   // 턴 시작 시간
  }

  /**
   * Add a player to the game. Returns true if successful, false if the
   * game is full or has already started.
   * @param {string} id Socket identifier for the player
   * @param {string} nickname Player's nickname
   */
  addPlayer(id, nickname) {
    if (this.started) return false;
    if (this.players.length >= 7) return false; // 최대 7명으로 확장
    // prevent duplicate nicknames
    if (this.players.find((p) => p.nickname === nickname)) return false;
    this.players.push({ id, nickname, tokens: 0, cards: [], isBot: false });
    
    // 첫 번째 플레이어가 방장이 됨
    if (this.players.length === 1) {
      this.hostId = id;
    }
    
    return true;
  }

  /**
   * Remove a player from the game. Adjusts the current player index if
   * necessary. If the game is in progress and fewer than two players
   * remain, the game will end when the caller checks for deck exhaustion.
   * @param {string} id Socket identifier of the player to remove
   */
  removePlayer(id) {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return;
    
    const wasHost = this.hostId === id;
    
    // Remove the player
    this.players.splice(idx, 1);
    
    // 방장이 나갔으면 다른 사람(봇 아닌)에게 양도
    if (wasHost && this.players.length > 0) {
      const nextHost = this.players.find(p => !p.isBot);
      this.hostId = nextHost ? nextHost.id : this.players[0].id;
    }
    
    // Adjust currentPlayerIndex if the removed player was ahead
    if (this.started) {
      if (idx < this.currentPlayerIndex) {
        this.currentPlayerIndex -= 1;
      } else if (idx === this.currentPlayerIndex) {
        // If current player leaves, wrap to same index since
        // players array shrunk; next turn will be handled by
        // calling code when broadcasting state.
        if (this.currentPlayerIndex >= this.players.length) {
          this.currentPlayerIndex = 0;
        }
      }
    }
  }

  /**
   * Initialize and start the game with provided settings. Returns
   * false if game has already started.
   */
  start() {
    if (this.started) return false;
    
    // Initialize deck 3–35
    const deck = [];
    for (let i = 3; i <= 35; i++) deck.push(i);
    
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    // Remove cards according to settings
    this.removedCards = deck.splice(0, this.gameSettings.removedCount);
    this.deck = deck;
    
    // 매 게임마다 플레이어 순서를 완전 랜덤으로 섞음
    this.shufflePlayerOrder();
    
    // Assign tokens and clear player cards
    this.players.forEach((p) => {
      p.tokens = this.gameSettings.initialTokens;
      p.cards = [];
    });
    
    // 첫 번째 플레이어부터 시작 (이미 순서가 섞였으므로)
    this.currentPlayerIndex = 0;
    
    // Draw first card
    this.currentCard = this.nextCard();
    this.pileTokens = 0;
    this.started = true;
    // turnStartTime은 startTurnTimer에서 설정됩니다
    
    return true;
  }

  /**
   * Draw the next card from the deck.
   * @returns {number|null}
   */
  nextCard() {
    return this.deck.length > 0 ? this.deck.shift() : null;
  }

  /**
   * Handle a pass action by the player with id. If the player has
   * tokens, one token is placed on the card and the turn advances.
   * If the player has zero tokens, the pass is converted into a
   * take action.
   * @param {string} id
   * @returns {Object} Object describing the outcome, including
   *   { gameOver: boolean }
   */
  pass(id) {
    // Validate turn
    if (!this.started) return { error: 'Game not started' };
    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== id) {
      return { error: 'Not your turn' };
    }
    if (player.tokens > 0) {
      player.tokens -= 1;
      this.pileTokens += 1;
      // Advance turn to next player
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      return { gameOver: false };
    }
    // No tokens: force take
    return this.takeCard(id);
  }

  /**
   * Handle a take action by the player with id. The player collects
   * the current card and any tokens on it, then draws a new card.
   * The current player index remains on the same player unless the
   * game ends, in which case this.started becomes false and a
   * subsequent start will be required.
   * @param {string} id
   * @returns {Object} Object describing the outcome, including
   *   { gameOver: boolean }
   */
  takeCard(id) {
    if (!this.started) return { error: 'Game not started' };
    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== id) {
      return { error: 'Not your turn' };
    }
    // Add card to player
    if (this.currentCard != null) {
      player.cards.push(this.currentCard);
    }
    // Collect pile tokens
    if (this.pileTokens > 0) {
      player.tokens += this.pileTokens;
      this.pileTokens = 0;
    }
    // Draw next card
    this.currentCard = this.nextCard();
    if (this.currentCard == null) {
      // No more cards: game over
      this.started = false;
      return { gameOver: true };
    }
    // Current player remains the same
    return { gameOver: false };
  }

  /**
   * Compute final scores. Returns an array of objects sorted by
   * ascending score (lower is better), each containing nickname,
   * score, cards, tokens, and rank.
   */
  calculateScores() {
    const results = this.players.map((p) => {
      // Sort the player's cards ascending
      const sorted = [...p.cards].sort((a, b) => a - b);
      let sum = 0;
      let prev = null;
      sorted.forEach((card) => {
        if (prev == null || card !== prev + 1) {
          sum += card;
        }
        prev = card;
      });
      // Subtract tokens
      const score = sum - p.tokens;
      return {
        nickname: p.nickname,
        score,
        cards: p.cards,
        tokens: p.tokens,
      };
    });
    // Sort ascending by score (lowest wins)
    results.sort((a, b) => a.score - b.score);
    // Add rank
    results.forEach((res, idx) => {
      res.rank = idx + 1;
    });
    return results;
  }

  /**
   * 설정을 업데이트합니다. 전달된 항목만 갱신하고 나머지는 유지합니다.
   * @param {Object} newSettings 업데이트할 설정들
   */
  updateSettings(newSettings) {
    if (this.started) return false;
    
    // 기존 설정을 유지하면서 새 설정만 덮어씀
    this.gameSettings = { ...this.gameSettings, ...newSettings };
    
    // 값 유효성 검사 및 범위 제한
    if (this.gameSettings.removedCount !== undefined) {
      this.gameSettings.removedCount = Math.max(1, Math.min(32, this.gameSettings.removedCount));
    }
    if (this.gameSettings.initialTokens !== undefined) {
      this.gameSettings.initialTokens = Math.max(1, Math.min(50, this.gameSettings.initialTokens));
    }
    if (this.gameSettings.turnTimeLimit !== undefined) {
      this.gameSettings.turnTimeLimit = Math.max(0, Math.min(300, this.gameSettings.turnTimeLimit));
    }
    
    return true;
  }

  /**
   * 방장을 다른 플레이어에게 양도합니다.
   * @param {string} currentHostId 현재 방장 ID
   * @param {string} newHostId 새 방장 ID
   */
  transferHost(currentHostId, newHostId) {
    if (this.hostId !== currentHostId) return false;
    if (!this.players.find(p => p.id === newHostId)) return false;
    
    this.hostId = newHostId;
    return true;
  }

  /**
   * 게임 종료 후 플레이어 목록을 유지하고 게임 데이터만 초기화
   */
  /**
   * AI 봇을 추가합니다.
   * @param {string} difficulty 봇 난이도 ('medium', 'hard', 'expert')
   */
  addBot(difficulty = 'medium') {
    if (this.started) return false;
    if (this.players.length >= 7) return false;
    
    // 현재 봇 수 계산
    const botCount = this.players.filter(p => p.isBot).length;
    if (botCount >= 3) return false;
    
    // 봇 ID와 닉네임 생성
    const botId = `bot_${Date.now()}_${Math.random()}`;
    const difficultyKorean = { medium: '중', hard: '상', expert: '최상' };
    const nickname = `AI봇 ${botCount + 1} (${difficultyKorean[difficulty]})`;
    
    const bot = new Bot(botId, nickname, difficulty);
    this.players.push(bot);
    
    return true;
  }

  /**
   * AI 봇을 제거하고 남은 봇들의 닉네임을 재정렬합니다.
   * @param {string} botId 제거할 봇의 ID
   */
  removeBot(botId) {
    if (this.started) return false;
    
    const botIndex = this.players.findIndex(p => p.id === botId && p.isBot);
    if (botIndex === -1) return false;
    
    // 봇 제거
    this.players.splice(botIndex, 1);
    
    // 남은 봇들의 닉네임 재정렬
    const bots = this.players.filter(p => p.isBot);
    const difficultyKorean = { medium: '중', hard: '상', expert: '최상' };
    
    bots.forEach((bot, index) => {
      bot.nickname = `AI봇 ${index + 1} (${difficultyKorean[bot.difficulty]})`;
    });
    
    return true;
  }

  /**
   * 플레이어 순서를 완전 랜덤으로 섞습니다.
   */
  shufflePlayerOrder() {
    for (let i = this.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.players[i], this.players[j]] = [this.players[j], this.players[i]];
    }
  }

  /**
   * 턴 타이머를 시작합니다.
   * @param {Function} onTimeout 시간 초과 시 실행될 콜백
   */
  startTurnTimer(onTimeout) {
    this.clearTurnTimer();
    
    if (this.gameSettings.turnTimeLimit === 0) return; // 무제한이면 타이머 없음
    
    this.turnStartTime = Date.now();
    this.turnTimer = setTimeout(() => {
      // 시간 초과 시 자동 액션
      const currentPlayer = this.players[this.currentPlayerIndex];
      if (currentPlayer && !currentPlayer.isBot) {
        onTimeout(currentPlayer.id);
      }
    }, this.gameSettings.turnTimeLimit * 1000);
  }

  /**
   * 턴 타이머를 정리합니다.
   */
  clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnStartTime = null;
  }

  softReset() {
    // 인간 플레이어만 유지, AI 봇은 모두 제거
    const humanPlayers = this.players.filter(p => !p.isBot);
    const savedHostId = this.hostId;
    
    // 게임 데이터 초기화
    this.deck = [];
    this.removedCards = [];
    this.currentCard = null;
    this.pileTokens = 0;
    this.currentPlayerIndex = 0;
    this.started = false;
    this.clearTurnTimer();
    
    // 인간 플레이어들의 카드와 토큰만 초기화
    this.players = humanPlayers.map(p => ({
      ...p,
      tokens: 0,
      cards: []
    }));
    
    // 방장이 봇이었거나 인간 플레이어가 없으면 첫 번째 인간 플레이어를 방장으로 설정
    const hostExists = this.players.find(p => p.id === savedHostId);
    this.hostId = hostExists ? savedHostId : (this.players[0]?.id || null);
    
    // 게임 설정을 기본값으로 초기화
    this.gameSettings = {
      removedCount: 9,
      initialTokens: 11,
      showOpponentTokens: true,
      showRealTimeScore: true,
      turnTimeLimit: 30
    };
  }

  /**
   * 인간 플레이어가 있는지 확인
   */
  hasHumanPlayers() {
    return this.players.some(p => !p.isBot);
  }

  /**
   * Return a serialisable representation of the current game state,
   * excluding sensitive information (like socket IDs). Includes
   * currentCard, pileTokens, deckSize, started flag, and players
   * with their nicknames, tokens, and number of cards.
   */
  getState() {
    return {
      players: this.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        tokens: p.tokens,
        cards: p.cards, // send full list so client can display own hand
        isBot: p.isBot || false,
      })),
      currentCard: this.currentCard,
      pileTokens: this.pileTokens,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id ?? null,
      deckSize: this.deck.length,
      removedCount: this.removedCards.length, // 실제 제거된 카드 수
      started: this.started,
      hostId: this.hostId,
      gameSettings: this.gameSettings,
      turnStartTime: this.turnStartTime,
    };
  }
}

module.exports = Game;