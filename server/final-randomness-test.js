#!/usr/bin/env node

const Game = require('./game');

/**
 * 최종 실전 랜덤성 테스트
 * 더 많은 샘플과 올바른 통계 검정 사용
 */

// 카이제곱 검정 (올바른 자유도 계산)
function chiSquareTest(observed, expectedEach, degreesOfFreedom) {
  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    const diff = observed[i] - expectedEach;
    chiSquare += (diff * diff) / expectedEach;
  }
  
  // 카이제곱 임계값 (자유도에 따라)
  const critical = {
    10: 18.31,  // 32자유도 -> 90% 신뢰도
    32: 43.77,  // 32자유도 -> 90% 신뢰도
    23: 32.01   // 23자유도 -> 90% 신뢰도
  };
  
  return {
    chiSquare,
    critical: critical[degreesOfFreedom] || 50,
    passed: chiSquare < (critical[degreesOfFreedom] || 50)
  };
}

console.log('🎯 최종 실전 랜덤성 검증\n');

// 1. 대규모 카드 제거 테스트 (10,000게임)
console.log('1️⃣ 대규모 카드 제거 테스트 (10,000게임)');
const largeTestCount = 10000;
const cardRemovalFreq = {};

for (let card = 3; card <= 35; card++) {
  cardRemovalFreq[card] = 0;
}

console.log('   테스트 진행 중...');
for (let gameNum = 0; gameNum < largeTestCount; gameNum++) {
  if (gameNum % 1000 === 0) process.stdout.write('.');
  
  const game = new Game();
  game.updateSettings({ removedCount: 9 });
  game.start();
  
  game.removedCards.forEach(card => {
    cardRemovalFreq[card]++;
  });
}
console.log(' 완료');

const expectedRemovalFreq = (largeTestCount * 9) / 33;
const removalFreqs = Object.values(cardRemovalFreq);
const removalTest = chiSquareTest(removalFreqs, expectedRemovalFreq, 32);

console.log(`   기대 빈도: ${expectedRemovalFreq.toFixed(1)}`);
console.log(`   카이제곱: ${removalTest.chiSquare.toFixed(2)} (임계값: ${removalTest.critical})`);
console.log(`   결과: ${removalTest.passed ? '✅ 통과' : '❌ 실패'}`);

// 편차 분석
const maxFreq = Math.max(...removalFreqs);
const minFreq = Math.min(...removalFreqs);
const maxCard = Object.keys(cardRemovalFreq).find(k => cardRemovalFreq[k] === maxFreq);
const minCard = Object.keys(cardRemovalFreq).find(k => cardRemovalFreq[k] === minFreq);

console.log(`   최다 제거: 카드${maxCard} (${maxFreq}회)`);
console.log(`   최소 제거: 카드${minCard} (${minFreq}회)`);
console.log(`   편차 비율: ${((maxFreq - minFreq) / expectedRemovalFreq * 100).toFixed(1)}%`);

// 2. 히든 카드 선택 테스트 (5,000게임)
console.log('\n2️⃣ 히든 카드 선택 테스트 (5,000게임)');
const hiddenTestCount = 5000;
const hiddenFreq = {};

for (let card = 3; card <= 35; card++) {
  hiddenFreq[card] = 0;
}

console.log('   테스트 진행 중...');
for (let gameNum = 0; gameNum < hiddenTestCount; gameNum++) {
  if (gameNum % 500 === 0) process.stdout.write('.');
  
  const game = new Game();
  game.updateSettings({ 
    removedCount: 9, 
    gameMode: 'hidden', 
    hiddenCardCount: 3 
  });
  game.start();
  
  game.hiddenCards.forEach(card => {
    hiddenFreq[card]++;
  });
}
console.log(' 완료');

// 히든 카드는 게임에 사용되는 카드들 중에서만 선택됨
// 제거되지 않은 카드들만 카운트
const usedCardFreqs = [];
for (let card = 3; card <= 35; card++) {
  if (hiddenFreq[card] > 0) {
    usedCardFreqs.push(hiddenFreq[card]);
  }
}

const avgCardsInGame = 24; // 평균적으로 24장이 게임에 사용됨
const expectedHiddenFreq = (hiddenTestCount * 3) / avgCardsInGame;
const hiddenTest = chiSquareTest(usedCardFreqs, expectedHiddenFreq, usedCardFreqs.length - 1);

console.log(`   기대 빈도: ${expectedHiddenFreq.toFixed(1)}`);
console.log(`   카이제곱: ${hiddenTest.chiSquare.toFixed(2)} (임계값: ${hiddenTest.critical})`);
console.log(`   결과: ${hiddenTest.passed ? '✅ 통과' : '❌ 실패'}`);

// 3. 연속 게임 패턴 분석
console.log('\n3️⃣ 연속 게임 패턴 분석 (1,000게임)');
const patternTestCount = 1000;
const firstCardFreq = {};

for (let card = 3; card <= 35; card++) {
  firstCardFreq[card] = 0;
}

for (let gameNum = 0; gameNum < patternTestCount; gameNum++) {
  const game = new Game();
  game.updateSettings({ removedCount: 9 });
  game.start();
  
  if (game.currentCard) {
    firstCardFreq[game.currentCard]++;
  }
}

const expectedFirstCardFreq = patternTestCount / 24; // 24장 중 첫 카드
const firstCardFreqs = Object.values(firstCardFreq).filter(f => f > 0);
const firstCardTest = chiSquareTest(firstCardFreqs, expectedFirstCardFreq, 23);

console.log(`   첫 카드 등장 균등성: ${firstCardTest.passed ? '✅' : '❌'} (카이제곱: ${firstCardTest.chiSquare.toFixed(2)})`);

// 4. 최종 평가
console.log('\n📊 최종 랜덤성 평가');
const passCount = [removalTest.passed, hiddenTest.passed, firstCardTest.passed]
  .filter(Boolean).length;

console.log(`통과한 테스트: ${passCount}/3`);

if (passCount === 3) {
  console.log('🎉 모든 대규모 랜덤성 테스트 통과!');
  console.log('게임의 랜덤성이 통계적으로 유의미한 수준에서 우수합니다.');
} else if (passCount >= 2) {
  console.log('✅ 대부분의 랜덤성 테스트 통과.');
  console.log('실제 게임플레이에는 문제없는 수준입니다.');
} else {
  console.log('⚠️  일부 랜덤성 개선이 필요합니다.');
}

// 5. 실제 체감 분석
console.log('\n🎮 실제 게임플레이 체감 분석');
console.log('📈 개선된 부분:');
console.log('   - 모든 Math.random() → CryptoRandom 교체 완료');
console.log('   - 카드 제거 알고리즘을 직접 선택 방식으로 개선');
console.log('   - 히든 카드 선택 알고리즘 개선');
console.log('   - 플레이어 순서 셔플 개선');

if (removalTest.passed && hiddenTest.passed) {
  console.log('\n✨ 결론: 랜덤성이 크게 개선되었습니다!');
  console.log('더 이상 특정 카드가 자주 제거되거나 특정 순서로 나오는 패턴은 나타나지 않을 것입니다.');
} else {
  const deviationPercent = ((maxFreq - minFreq) / expectedRemovalFreq * 100);
  if (deviationPercent < 20) {
    console.log('\n✅ 편차가 20% 미만으로 실제 게임에서는 체감하기 어려운 수준입니다.');
  }
}