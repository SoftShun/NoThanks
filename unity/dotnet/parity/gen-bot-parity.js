/*
 * master server/bot.js 를 그대로 실행해서 C# BotBrain 과 비교할 케이스를 만든다.
 * - server/ 코드는 읽기만 한다 (require 후 난수 함수만 테스트용으로 교체)
 * - 출력: unity/dotnet/NoThanks.Core.Tests/bot-parity-cases.json
 * 실행: node unity/dotnet/parity/gen-bot-parity.js
 */
const path = require('path');
const fs = require('fs');

const serverDir = path.join(__dirname, '..', '..', '..', 'server');
const CryptoRandom = require(path.join(serverDir, 'crypto-random'));

// 공유 난수열: 두 구현이 같은 순서로 같은 값을 소비해야 한다.
let seq = [];
let idx = 0;
CryptoRandom.enhancedRandom = () => {
  const v = seq[idx % seq.length];
  idx++;
  return v;
};

const Bot = require(path.join(serverDir, 'bot'));

// 케이스 생성용 별도 PRNG (mulberry32)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const origLog = console.log;
const origErr = console.error;
const difficulties = ['medium', 'hard', 'expert'];
const cases = [];
const N = 600;

for (let c = 0; c < N; c++) {
  const r = mulberry32(1000 + c);
  const nBots = 1 + Math.floor(r() * 3);
  const nPlayers = nBots + 1;

  // 카드 분배
  const all = [];
  for (let i = 3; i <= 35; i++) all.push(i);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  const removedCards = all.slice(0, 9);
  const playable = all.slice(9); // 24장
  const dealt = Math.floor(r() * 23); // 0~22장 분배됨
  const currentCard = playable[dealt];
  const deckSize = 24 - dealt - 1;
  const hands = Array.from({ length: nPlayers }, () => []);
  for (let k = 0; k < dealt; k++) hands[Math.floor(r() * nPlayers)].push(playable[k]);

  const players = [];
  players.push({ id: 'h', nickname: 'Human', tokens: Math.floor(r() * 20), cards: hands[0], isBot: false });
  const botDefs = [];
  for (let b = 0; b < nBots; b++) {
    const d = difficulties[Math.floor(r() * 3)];
    botDefs.push(d);
    players.push({ id: 'bot_' + (b + 1), nickname: `AI봇 ${b + 1}`, tokens: Math.floor(r() * 16), cards: hands[b + 1], isBot: true });
  }
  const subjectIndex = 1 + Math.floor(r() * nBots);
  const subject = players[subjectIndex];
  const difficulty = botDefs[subjectIndex - 1];
  if (r() < 0.1) subject.tokens = 0;
  const pileTokens = Math.floor(r() * 12);

  const emotions = {
    mood: r(), confidence: r(), competitiveness: r(), frustration: r(), greed: r(), vengeful: r(),
  };
  // 사람 관찰 기록
  const observations = [];
  const nObs = Math.floor(r() * 6);
  for (let k = 0; k < nObs; k++) observations.push({ type: r() < 0.5 ? 'take' : 'pass', card: 3 + Math.floor(r() * 33), tokens: Math.floor(r() * 6) });
  const rivalry = r() < 0.3 ? 0.6 + r() * 0.4 : r() * 0.5;
  const hidden = r() < 0.12;

  seq = Array.from({ length: 64 }, () => r());
  idx = 0;

  console.log = () => {};
  console.error = () => {};
  const bot = new Bot(subject.id, subject.nickname, difficulty);
  bot.tokens = subject.tokens;
  bot.cards = subject.cards.slice();
  Object.assign(bot.emotionalState, emotions);
  bot.playerRelations['h'] = { rivalry, trust: 0.5, observedPatterns: observations.map(o => ({ ...o, timestamp: 0 })) };

  let basicReason = '';
  const origBasic = bot.makeBasicDecision.bind(bot);
  bot.makeBasicDecision = (...a) => { const d = origBasic(...a); basicReason = d.reason; return d; };

  const state = {
    players: players.map(p => ({ ...p, cards: p.cards.slice() })),
    currentCard, pileTokens, deckSize, removedCount: 9, removedCards, isCurrentCardHidden: hidden,
  };
  const decision = bot.makeDecision(state);
  console.log = origLog;
  console.error = origErr;

  cases.push({
    difficulty, subjectId: subject.id, players: state.players, currentCard, pileTokens, deckSize, removedCards,
    hidden, emotions, observations, rivalry, rng: seq,
    expected: {
      decision, basicReason: hidden ? '' : basicReason, rngUsed: idx,
      emotionsAfter: { ...bot.emotionalState },
      gameEvents: (bot.gameEvents || []).length,
    },
  });
}

const out = path.join(__dirname, '..', 'NoThanks.Core.Tests', 'bot-parity-cases.json');
fs.writeFileSync(out, JSON.stringify(cases));
origLog(`wrote ${cases.length} cases → ${out}`);
