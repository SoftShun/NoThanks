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

class Game {
  constructor() {
    this.reset();
  }

  /**
   * Reset the game state to an initial pre-game configuration.
   */
  reset() {
    this.players = []; // { id, nickname, tokens, cards }
    this.deck = [];
    this.removedCards = [];
    this.currentCard = null;
    this.pileTokens = 0;
    this.currentPlayerIndex = 0;
    this.initialTokens = 0;
    this.removedCount = 0;
    this.started = false;
    this.showOpponentTokens = true; // UI preference broadcast to clients
  }

  /**
   * Add a player to the game. Returns true if successful, false if the
   * game is full or has already started.
   * @param {string} id Socket identifier for the player
   * @param {string} nickname Player's nickname
   */
  addPlayer(id, nickname) {
    if (this.started) return false;
    if (this.players.length >= 5) return false;
    // prevent duplicate nicknames
    if (this.players.find((p) => p.nickname === nickname)) return false;
    this.players.push({ id, nickname, tokens: 0, cards: [] });
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
    // Remove the player
    this.players.splice(idx, 1);
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
   * @param {Object} settings
   * @param {number} settings.initialTokens Number of tokens each player starts with
   * @param {number} settings.removedCount Number of cards to remove from the deck
   */
  start(settings) {
    if (this.started) return false;
    // Parse settings and clamp values to safe ranges
    this.initialTokens = Math.max(1, Math.min(50, Number(settings.initialTokens) || 0));
    this.removedCount = Math.max(1, Math.min(32, Number(settings.removedCount) || 0));
    // UI preferences (optional)
    this.showOpponentTokens = settings && typeof settings.showOpponentTokens === 'boolean'
      ? settings.showOpponentTokens
      : true;
    // Initialize deck 3–35
    const deck = [];
    for (let i = 3; i <= 35; i++) deck.push(i);
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    // Remove cards
    this.removedCards = deck.splice(0, this.removedCount);
    this.deck = deck;
    // Assign tokens and clear player cards
    this.players.forEach((p) => {
      p.tokens = this.initialTokens;
      p.cards = [];
    });
    // Randomize starting player
    if (this.players.length > 0) {
      this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
    }
    // Draw first card
    this.currentCard = this.nextCard();
    this.pileTokens = 0;
    this.currentPlayerIndex = 0;
    this.started = true;
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
      })),
      currentCard: this.currentCard,
      pileTokens: this.pileTokens,
      currentPlayerId: this.players[this.currentPlayerIndex]?.id ?? null,
      deckSize: this.deck.length,
      removedCount: this.removedCount,
      started: this.started,
      initialTokens: this.initialTokens,
      showOpponentTokens: this.showOpponentTokens,
    };
  }
}

module.exports = Game;