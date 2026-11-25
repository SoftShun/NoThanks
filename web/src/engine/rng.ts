/**
 * 난수 소스. master 의 server/crypto-random.js 를 대체합니다.
 * - 기본: crypto.getRandomValues 기반 (원본의 crypto.randomBytes(4)/2^32 와 같은 분포)
 * - 테스트: setRandomSource(mulberry32(seed)) 로 결정적 실행
 */
export type RandomSource = () => number;

export function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

/** 결정적 시드 RNG (테스트·리플레이용) */
export function mulberry32(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let source: RandomSource = cryptoRandom;

export function setRandomSource(fn: RandomSource): void {
  source = fn;
}
export function resetRandomSource(): void {
  source = cryptoRandom;
}
export function random(): number {
  return source();
}

/** 원본 CryptoRandom 과 같은 API (legacyBot.js 가 사용) */
export const CryptoRandom = {
  random: () => source(),
  enhancedRandom: () => source(),
  randomInt: (min: number, max: number) => Math.floor(source() * (max - min)) + min,
};
