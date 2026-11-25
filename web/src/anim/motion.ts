/**
 * 모션 토큰. docs/remake/motion-feedback.md 의 표와 1:1 대응합니다. (단위: 초)
 */
export const MOTION = {
  press: 0.06,
  cardSlide: 0.24,
  cardFlipHalf: 0.09,
  cardFlipOut: 0.12,
  chipArcUp: 0.15,
  chipArcDown: 0.14,
  chipLand: 0.12,
  takeFly: 0.36,
  takeChipStagger: 0.025,
  newCardGlow: 0.45,
  scorePop: 0.7,
  turnRing: 0.24,
  hiddenWobble: 0.18,
  hiddenFlip: 0.26,
  sparkle: 0.4,
  rollback: 0.2,
  shuffle: 0.55,
  seatIn: 0.3,
  seatStagger: 0.06,
  endBanner: 0.6,
  reducedFade: 0.12,
} as const;

export const EASE = {
  out: 'power3.out',
  inOut: 'power3.inOut',
  arcUp: 'power1.out',
  arcDown: 'power2.in',
  land: 'back.out(3)',
  pop: 'back.out(2)',
  flipIn: 'power2.in',
  flipOut: 'back.out(1.6)',
  linear: 'none',
} as const;

let reduced = false;
export function setReducedMotion(v: boolean) {
  reduced = v;
}
export function isReduced() {
  return reduced;
}
export function systemPrefersReduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
