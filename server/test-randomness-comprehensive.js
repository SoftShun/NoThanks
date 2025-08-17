#!/usr/bin/env node

const Game = require('./game');
const CryptoRandom = require('./crypto-random');

/**
 * 포괄적인 랜덤성 테스트
 * 게임의 모든 랜덤 요소를 검증합니다.
 */

// 카이제곱 검정 함수
function chiSquareTest(observed, expected) {
  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    const diff = observed[i] - expected[i];
    chiSquare += (diff * diff) / expected[i];
  }
  return chiSquare;
}

// 균등 분포 테스트
function testUniformDistribution(samples, bins = 10) {
  const buckets = new Array(bins).fill(0);
  const expected = samples.length / bins;
  
  samples.forEach(sample => {
    const bucket = Math.floor(sample * bins);
    if (bucket >= 0 && bucket < bins) buckets[bucket]++;
  });
  
  const chiSquare = chiSquareTest(buckets, new Array(bins).fill(expected));
  const pValue = 1 - Math.exp(-chiSquare / 2); // 근사값
  
  return {
    chiSquare,
    pValue,
    buckets,
    expected,
    uniform: chiSquare < 16.92 // 90% 신뢰도
  };
}

// 연속성 테스트 (연속된 값들의 상관관계)
function testSequenceIndependence(sequence) {
  if (sequence.length < 2) return { independent: true, correlation: 0 };
  
  let correlation = 0;
  for (let i = 1; i < sequence.length; i++) {
    correlation += Math.abs(sequence[i] - sequence[i-1]);
  }
  
  const avgCorrelation = correlation / (sequence.length - 1);
  const expected = 0.33; // 이론적 기댓값
  
  return {
    independent: Math.abs(avgCorrelation - expected) < 0.1,
    correlation: avgCorrelation,
    expected
  };
}

console.log('🎲 게임 랜덤성 포괄적 테스트 시작\n');

// 1. CryptoRandom 기본 함수 테스트
console.log('1️⃣ CryptoRandom 기본 함수 테스트');
const basicSamples = [];
for (let i = 0; i < 10000; i++) {
  basicSamples.push(CryptoRandom.enhancedRandom());
}

const basicTest = testUniformDistribution(basicSamples);
console.log(`   균등분포: ${basicTest.uniform ? '✅' : '❌'} (카이제곱: ${basicTest.chiSquare.toFixed(2)})`);

const basicSeq = testSequenceIndependence(basicSamples);
console.log(`   독립성: ${basicSeq.independent ? '✅' : '❌'} (상관계수: ${basicSeq.correlation.toFixed(3)})`);

// 2. 카드 제거 랜덤성 테스트
console.log('\n2️⃣ 카드 제거 랜덤성 테스트 (1000게임)');
const removedCardsFreq = {};
const gameCount = 1000;

for (let card = 3; card <= 35; card++) {
  removedCardsFreq[card] = 0;
}

for (let gameNum = 0; gameNum < gameCount; gameNum++) {
  const game = new Game();
  game.updateSettings({ removedCount: 9 });
  game.start();
  
  game.removedCards.forEach(card => {
    removedCardsFreq[card]++;
  });
}

const expectedRemovalFreq = (gameCount * 9) / 33; // 9개 제거, 33개 카드
const removalFreqs = Object.values(removedCardsFreq);
const removalTest = testUniformDistribution(removalFreqs.map(f => f / expectedRemovalFreq), 11);

console.log(`   카드별 제거 균등성: ${removalTest.uniform ? '✅' : '❌'} (카이제곱: ${removalTest.chiSquare.toFixed(2)})`);

// 가장/최소 제거된 카드 확인
const maxRemoved = Math.max(...removalFreqs);
const minRemoved = Math.min(...removalFreqs);
const maxCard = Object.keys(removedCardsFreq).find(k => removedCardsFreq[k] === maxRemoved);
const minCard = Object.keys(removedCardsFreq).find(k => removedCardsFreq[k] === minRemoved);

console.log(`   최다 제거: 카드${maxCard} (${maxRemoved}회, ${(maxRemoved/gameCount*100).toFixed(1)}%)`);
console.log(`   최소 제거: 카드${minCard} (${minRemoved}회, ${(minRemoved/gameCount*100).toFixed(1)}%)`);
console.log(`   편차: ${((maxRemoved - minRemoved) / expectedRemovalFreq * 100).toFixed(1)}%`);

// 3. 카드 순서 랜덤성 테스트
console.log('\n3️⃣ 카드 출현 순서 랜덤성 테스트');
const positionFreq = {};
const testGames = 500;

// 각 카드가 각 위치에 나타나는 빈도
for (let card = 3; card <= 35; card++) {
  positionFreq[card] = new Array(24).fill(0); // 최대 24장 덱
}

for (let gameNum = 0; gameNum < testGames; gameNum++) {
  const game = new Game();
  game.updateSettings({ removedCount: 9 });
  game.start();
  
  // 덱의 각 위치별로 카드 기록
  game.deck.forEach((card, position) => {
    if (position < 24) {
      positionFreq[card][position]++;
    }
  });
}

// 첫 5위치의 카드 분포 확인
let earlyPositionBias = 0;
for (let pos = 0; pos < 5; pos++) {
  const positionCounts = {};
  for (let card = 3; card <= 35; card++) {
    positionCounts[card] = positionFreq[card][pos];
  }
  
  const counts = Object.values(positionCounts);
  const expectedCount = testGames / 33;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - expectedCount, 2), 0) / 33;
  earlyPositionBias += variance;
}

console.log(`   초기 순서 편향: ${earlyPositionBias < 100 ? '✅' : '❌'} (분산: ${earlyPositionBias.toFixed(2)})`);

// 4. 플레이어 순서 랜덤성 테스트
console.log('\n4️⃣ 플레이어 순서 셔플 테스트');
const playerOrderTest = [];
const shuffleTests = 1000;

for (let test = 0; test < shuffleTests; test++) {
  const game = new Game();
  // 플레이어 5명 추가
  for (let i = 1; i <= 5; i++) {
    game.addPlayer(`player${i}`, `플레이어${i}`);
  }
  
  game.shufflePlayerOrder();
  
  // 첫 번째 플레이어가 누구인지 기록
  playerOrderTest.push(parseInt(game.players[0].id.replace('player', '')));
}

const playerOrderFreq = [0, 0, 0, 0, 0, 0]; // 인덱스 0은 사용안함
playerOrderTest.forEach(playerId => {
  playerOrderFreq[playerId]++;
});

const expectedPlayerFreq = shuffleTests / 5;
const playerOrderVariance = playerOrderFreq.slice(1).reduce((sum, freq) => 
  sum + Math.pow(freq - expectedPlayerFreq, 2), 0) / 5;

console.log(`   플레이어 순서 균등성: ${playerOrderVariance < 1000 ? '✅' : '❌'} (분산: ${playerOrderVariance.toFixed(2)})`);

// 5. 히든 카드 선택 랜덤성 테스트
console.log('\n5️⃣ 히든 카드 선택 랜덤성 테스트');
const hiddenCardFreq = {};
const hiddenTests = 1000;

for (let card = 3; card <= 35; card++) {
  hiddenCardFreq[card] = 0;
}

for (let test = 0; test < hiddenTests; test++) {
  const game = new Game();
  game.updateSettings({ 
    removedCount: 9, 
    gameMode: 'hidden', 
    hiddenCardCount: 3 
  });
  game.start();
  
  game.hiddenCards.forEach(card => {
    hiddenCardFreq[card]++;
  });
}

const expectedHiddenFreq = (hiddenTests * 3) / 24; // 3개 히든, 24개 남은 카드
const hiddenFreqs = Object.values(hiddenCardFreq);
const hiddenTest = testUniformDistribution(hiddenFreqs.map(f => f / expectedHiddenFreq), 11);

console.log(`   히든 카드 선택 균등성: ${hiddenTest.uniform ? '✅' : '❌'} (카이제곱: ${hiddenTest.chiSquare.toFixed(2)})`);

// 6. 전체 랜덤성 점수 계산
console.log('\n📊 전체 랜덤성 평가');
const scores = [
  basicTest.uniform ? 1 : 0,
  basicSeq.independent ? 1 : 0,
  removalTest.uniform ? 1 : 0,
  earlyPositionBias < 100 ? 1 : 0,
  playerOrderVariance < 1000 ? 1 : 0,
  hiddenTest.uniform ? 1 : 0
];

const totalScore = scores.reduce((a, b) => a + b, 0);
const percentage = (totalScore / scores.length * 100).toFixed(1);

console.log(`\n🎯 랜덤성 점수: ${totalScore}/${scores.length} (${percentage}%)`);

if (totalScore === scores.length) {
  console.log('🎉 모든 랜덤성 테스트 통과! 게임의 랜덤성이 우수합니다.');
} else if (totalScore >= scores.length * 0.8) {
  console.log('✅ 대부분의 랜덤성 테스트 통과. 약간의 개선 여지가 있습니다.');
} else {
  console.log('⚠️  일부 랜덤성 테스트 실패. 개선이 필요합니다.');
}

// 문제가 발견된 경우 Math.random() 사용 위치 알림
console.log('\n🔍 코드 내 Math.random() 사용 현황:');
console.log('   - index.js: AI 봇 딜레이 계산에서 Math.random() 사용');
console.log('   - bot.js: AI 감정상태, 의사결정에서 Math.random() 다수 사용');
console.log('   ➡️  이 부분들을 CryptoRandom으로 교체하면 랜덤성이 더욱 개선됩니다.');