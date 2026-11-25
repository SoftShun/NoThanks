/*
 * master server/game.js 를 그대로 실행해서 C# GameEngine 과 비교할 전체 게임 기록을 만든다.
 * 같은 난수열(카드 제거·셔플·플레이어 순서·숨김 카드 선택)과 같은 행동열(p/t)을 재생해서
 * 최종 점수표와 중간 상태가 일치하는지 본다.
 * 실행: node unity/dotnet/parity/gen-game-parity.js
 */
const path = require('path');
const fs = require('fs');

const serverDir = path.join(__dirname, '..', '..', '..', 'server');
const CryptoRandom = require(path.join(serverDir, 'crypto-random'));
let seq = [];
let idx = 0;
CryptoRandom.enhancedRandom = () => { const v = seq[idx % seq.length]; idx++; return v; };
const Game = require(path.join(serverDir, 'game'));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cases = [];
for (let c = 0; c < 200; c++) {
  const r = mulberry32(5000 + c);
  seq = Array.from({ length: 128 }, () => r());
  idx = 0;
  const n = 2 + Math.floor(r() * 6);
  const settings = {
    removedCount: 1 + Math.floor(r() * 20),
    initialTokens: 1 + Math.floor(r() * 15),
    gameMode: r() < 0.3 ? 'hidden' : 'normal',
    hiddenCardCount: 1 + Math.floor(r() * 5),
  };
  const g = new Game();
  for (let i = 0; i < n; i++) g.addPlayer('p' + i, 'P' + i);
  g.updateSettings(settings);
  g.start();
  const startOrder = g.players.map(p => p.id);
  const removed = g.removedCards.slice();
  const hidden = [...g.hiddenCards].sort((a, b) => a - b);
  const actions = [];
  const trace = [];
  let guard = 0;
  while (g.started && guard++ < 2000) {
    const cur = g.players[g.currentPlayerIndex];
    const a = r() < 0.55 ? 'p' : 't';
    actions.push(a);
    const res = a === 'p' ? g.pass(cur.id) : g.takeCard(cur.id);
    trace.push([g.currentCard, g.pileTokens, g.currentPlayerIndex, res.isHiddenRevealed ? 1 : 0]);
  }
  cases.push({
    n, settings, rng: seq, actions,
    expected: { startOrder, removed, hidden, trace, scores: g.calculateScores().map(s => ({ nickname: s.nickname, score: s.score, tokens: s.tokens, rank: s.rank, cards: s.cards })) },
  });
}
const out = path.join(__dirname, '..', 'NoThanks.Core.Tests', 'game-parity-cases.json');
fs.writeFileSync(out, JSON.stringify(cases));
console.log(`wrote ${cases.length} cases → ${out}`);
