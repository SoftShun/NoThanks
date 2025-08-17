#!/usr/bin/env node

const CryptoRandom = require('./crypto-random');

/**
 * 피셔-예이츠 셔플 알고리즘 정확성 검증
 */

console.log('🔍 피셔-예이츠 셔플 알고리즘 디버깅\n');

// 1. 현재 게임에서 사용하는 방식 (카드 제거)
function currentGameShuffle() {
  const deck = [];
  for (let i = 3; i <= 35; i++) deck.push(i);
  
  // 현재 게임 로직과 동일
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(CryptoRandom.enhancedRandom() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  // 9개 제거
  return deck.splice(0, 9);
}

// 2. 표준 피셔-예이츠 셔플
function standardShuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(CryptoRandom.enhancedRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 3. 직접 랜덤 선택 방식
function directRandomSelection(array, count) {
  const selected = [];
  const remaining = [...array];
  
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(CryptoRandom.enhancedRandom() * remaining.length);
    selected.push(remaining[randomIndex]);
    remaining.splice(randomIndex, 1);
  }
  
  return selected;
}

// 테스트 실행
const testCount = 5000;
const cards = [];
for (let i = 3; i <= 35; i++) cards.push(i);

console.log('1️⃣ 현재 게임 방식 테스트 (5000회)');
const currentResults = {};
cards.forEach(card => currentResults[card] = 0);

for (let test = 0; test < testCount; test++) {
  const removed = currentGameShuffle();
  removed.forEach(card => currentResults[card]++);
}

const expectedFreq = (testCount * 9) / 33;
const currentVariance = Object.values(currentResults)
  .reduce((sum, freq) => sum + Math.pow(freq - expectedFreq, 2), 0) / 33;

console.log(`   기대 빈도: ${expectedFreq.toFixed(1)}`);
console.log(`   분산: ${currentVariance.toFixed(2)}`);

const currentMax = Math.max(...Object.values(currentResults));
const currentMin = Math.min(...Object.values(currentResults));
console.log(`   최대/최소: ${currentMax}/${currentMin} (차이: ${currentMax - currentMin})`);

console.log('\n2️⃣ 표준 셔플 + 첫 9개 선택 테스트');
const standardResults = {};
cards.forEach(card => standardResults[card] = 0);

for (let test = 0; test < testCount; test++) {
  const shuffled = standardShuffle(cards);
  const removed = shuffled.slice(0, 9);
  removed.forEach(card => standardResults[card]++);
}

const standardVariance = Object.values(standardResults)
  .reduce((sum, freq) => sum + Math.pow(freq - expectedFreq, 2), 0) / 33;

console.log(`   분산: ${standardVariance.toFixed(2)}`);

const standardMax = Math.max(...Object.values(standardResults));
const standardMin = Math.min(...Object.values(standardResults));
console.log(`   최대/최소: ${standardMax}/${standardMin} (차이: ${standardMax - standardMin})`);

console.log('\n3️⃣ 직접 랜덤 선택 테스트');
const directResults = {};
cards.forEach(card => directResults[card] = 0);

for (let test = 0; test < testCount; test++) {
  const removed = directRandomSelection(cards, 9);
  removed.forEach(card => directResults[card]++);
}

const directVariance = Object.values(directResults)
  .reduce((sum, freq) => sum + Math.pow(freq - expectedFreq, 2), 0) / 33;

console.log(`   분산: ${directVariance.toFixed(2)}`);

const directMax = Math.max(...Object.values(directResults));
const directMin = Math.min(...Object.values(directResults));
console.log(`   최대/최소: ${directMax}/${directMin} (차이: ${directMax - directMin})`);

// 4. CryptoRandom 자체 품질 테스트
console.log('\n4️⃣ CryptoRandom 품질 상세 테스트');
const samples = [];
for (let i = 0; i < 100000; i++) {
  samples.push(CryptoRandom.enhancedRandom());
}

// 분포 균등성 체크
const buckets = new Array(10).fill(0);
samples.forEach(sample => {
  const bucket = Math.floor(sample * 10);
  if (bucket >= 0 && bucket < 10) buckets[bucket]++;
});

const expectedBucket = samples.length / 10;
const bucketVariance = buckets.reduce((sum, count) => 
  sum + Math.pow(count - expectedBucket, 2), 0) / 10;

console.log(`   10구간 분포 분산: ${bucketVariance.toFixed(2)}`);
console.log(`   구간별 개수: ${buckets.join(', ')}`);

// 연속성 테스트
let autocorrelation = 0;
for (let i = 1; i < Math.min(samples.length, 10000); i++) {
  autocorrelation += samples[i] * samples[i-1];
}
autocorrelation = autocorrelation / 9999;

console.log(`   자기상관: ${autocorrelation.toFixed(4)} (0.25에 가까울수록 좋음)`);

// 결론
console.log('\n📊 결론');
console.log(`현재 방식 분산: ${currentVariance.toFixed(2)}`);
console.log(`표준 셔플 분산: ${standardVariance.toFixed(2)}`);
console.log(`직접 선택 분산: ${directVariance.toFixed(2)}`);

const bestMethod = Math.min(currentVariance, standardVariance, directVariance);
if (bestMethod === directVariance) {
  console.log('✅ 직접 랜덤 선택 방식이 가장 균등합니다.');
} else if (bestMethod === standardVariance) {
  console.log('✅ 표준 셔플 방식이 가장 균등합니다.');
} else {
  console.log('✅ 현재 방식이 가장 균등합니다.');
}

console.log('\n💡 권장사항:');
if (directVariance < currentVariance * 0.8) {
  console.log('- 카드 제거 로직을 직접 랜덤 선택 방식으로 변경');
}
if (bucketVariance > 1000) {
  console.log('- CryptoRandom 알고리즘 재검토 필요');
}
if (autocorrelation < 0.2 || autocorrelation > 0.3) {
  console.log('- CryptoRandom 연속성 개선 필요');
}