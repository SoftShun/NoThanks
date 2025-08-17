// 랜덤성 테스트 스크립트 (crypto 랜덤 적용 후)
const Game = require('./server/game');

// 1000번의 게임을 시뮬레이션하여 랜덤성 분석
function testRandomness() {
  const results = {
    removedCards: new Map(), // 각 카드가 제거된 횟수
    firstCards: new Map(),   // 첫 번째로 나온 카드들
    cardSequences: [],       // 전체 카드 순서들
  };

  console.log('🔍 랜덤성 테스트 시작 (1000회 시뮬레이션)...\n');

  for (let i = 0; i < 1000; i++) {
    const game = new Game();
    game.addPlayer('test', '테스트');
    game.start();

    // 제거된 카드 분석
    game.removedCards.forEach(card => {
      results.removedCards.set(card, (results.removedCards.get(card) || 0) + 1);
    });

    // 첫 번째 카드 분석
    const firstCard = game.currentCard;
    results.firstCards.set(firstCard, (results.firstCards.get(firstCard) || 0) + 1);

    // 전체 덱 순서 저장 (처음 5장만)
    const sequence = [firstCard, ...game.deck.slice(0, 4)];
    results.cardSequences.push(sequence);
  }

  // 결과 분석
  console.log('📊 제거된 카드 분포 (3-35, 예상: 각각 약 273회):');
  const removedFreq = [];
  for (let card = 3; card <= 35; card++) {
    const count = results.removedCards.get(card) || 0;
    removedFreq.push(count);
    if (card <= 15) {
      console.log(`카드 ${card}: ${count}회`);
    }
  }

  console.log('\n📊 첫 번째 카드 분포 (예상: 각각 약 30회):');
  const firstFreq = [];
  for (let card = 3; card <= 35; card++) {
    const count = results.firstCards.get(card) || 0;
    firstFreq.push(count);
    if (card <= 15) {
      console.log(`카드 ${card}: ${count}회`);
    }
  }

  // 통계적 분석
  const avgRemoved = removedFreq.reduce((a, b) => a + b, 0) / removedFreq.length;
  const avgFirst = firstFreq.reduce((a, b) => a + b, 0) / firstFreq.length;
  
  const varianceRemoved = removedFreq.reduce((sum, freq) => sum + Math.pow(freq - avgRemoved, 2), 0) / removedFreq.length;
  const varianceFirst = firstFreq.reduce((sum, freq) => sum + Math.pow(freq - avgFirst, 2), 0) / firstFreq.length;

  console.log('\n📈 통계 분석:');
  console.log(`제거된 카드 - 평균: ${avgRemoved.toFixed(1)}, 분산: ${varianceRemoved.toFixed(1)}`);
  console.log(`첫 번째 카드 - 평균: ${avgFirst.toFixed(1)}, 분산: ${varianceFirst.toFixed(1)}`);

  // 패턴 분석
  console.log('\n🔍 패턴 분석:');
  const sequences = results.cardSequences;
  let identicalSequences = 0;
  
  for (let i = 0; i < sequences.length; i++) {
    for (let j = i + 1; j < sequences.length; j++) {
      if (JSON.stringify(sequences[i]) === JSON.stringify(sequences[j])) {
        identicalSequences++;
      }
    }
  }

  console.log(`동일한 5카드 시퀀스: ${identicalSequences}개 (예상: 거의 0개)`);

  // Chi-square 테스트 (간단 버전)
  const expectedRemoved = 1000 * 9 / 33; // 각 카드가 제거될 기댓값
  const chiSquareRemoved = removedFreq.reduce((sum, observed) => {
    return sum + Math.pow(observed - expectedRemoved, 2) / expectedRemoved;
  }, 0);

  console.log(`\n🧮 Chi-square 값 (제거된 카드): ${chiSquareRemoved.toFixed(2)}`);
  console.log(`(32 자유도에서 임계값 ~46.2, 낮을수록 더 랜덤)`);

  // 결론
  console.log('\n🎯 결론:');
  if (varianceRemoved < avgRemoved * 0.3 && varianceFirst < avgFirst * 0.3 && identicalSequences === 0) {
    console.log('✅ 랜덤성이 양호합니다.');
  } else {
    console.log('⚠️  일부 편향이 감지되었습니다.');
  }
}

// 테스트 실행
testRandomness();