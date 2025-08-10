// Node 18+ built-in test runner
const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('./game');

test('game start initializes deck, tokens and random current player', () => {
  const g = new Game();
  g.addPlayer('a', 'A');
  g.addPlayer('b', 'B');
  const ok = g.start({ removedCount: 9, initialTokens: 11 });
  assert.ok(ok);
  assert.equal(g.players.length, 2);
  assert.equal(g.players[0].tokens, 11);
  assert.equal(g.players[1].tokens, 11);
  assert.ok(g.currentCard != null);
  assert.equal(g.started, true);
});

test('pass consumes token and rotates turn; zero token forces take', () => {
  const g = new Game();
  g.addPlayer('a', 'A');
  g.addPlayer('b', 'B');
  g.start({ removedCount: 1, initialTokens: 2 });
  // player a turn
  const before = g.players[0].tokens;
  let res = g.pass('a');
  assert.equal(g.players[0].tokens, before - 1);
  assert.equal(res.gameOver, false);
  // player b turn, set tokens to 0 forces take
  g.players[1].tokens = 0;
  res = g.pass('b');
  assert.equal(res.gameOver, false);
  // after forced take, current player remains b
  assert.equal(g.players[g.currentPlayerIndex].id, 'b');
});

test('take collects pile tokens and keeps current player', () => {
  const g = new Game();
  g.addPlayer('a', 'A');
  g.addPlayer('b', 'B');
  g.start({ removedCount: 1, initialTokens: 2 });
  // a passes once -> pile 1, turn to b
  g.pass('a');
  // b takes -> gets card and +1 token, current player stays b
  const tokensBefore = g.players[1].tokens;
  const res = g.takeCard('b');
  assert.equal(g.players[1].tokens, tokensBefore + 1);
  assert.equal(res.gameOver, g.currentCard == null ? true : false);
  assert.equal(g.players[g.currentPlayerIndex].id, 'b');
});

test('scoring: only lowest of consecutive runs counted minus tokens', () => {
  const g = new Game();
  g.addPlayer('a', 'A');
  g.addPlayer('b', 'B');
  g.start({ removedCount: 1, initialTokens: 0 });
  // craft example hands
  g.players[0].cards = [3,4,5,10]; // -> 3 + 10 = 13
  g.players[0].tokens = 2; // 13 - 2 = 11
  g.players[1].cards = [7,9]; // -> 7 + 9 = 16
  g.players[1].tokens = 0; // 16
  const results = g.calculateScores();
  const a = results.find(r => r.nickname === 'A');
  const b = results.find(r => r.nickname === 'B');
  assert.equal(a.score, 11);
  assert.equal(b.score, 16);
  assert.ok(results[0].score <= results[1].score);
});


