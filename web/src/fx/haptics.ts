/**
 * 모바일 햅틱. Vibration API(안드로이드 크롬 등)만 지원합니다.
 * iOS Safari 는 Vibration API 를 지원하지 않아 무시됩니다 (docs 참고).
 */
export type HapticKind = 'tap' | 'chip' | 'take' | 'turn' | 'error' | 'win';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  chip: 12,
  take: [14, 40, 22],
  turn: 18,
  error: [30, 50, 30],
  win: [20, 60, 20, 60, 40],
};

let enabled = true;
export function setHapticsEnabled(v: boolean) {
  enabled = v;
}
export function haptic(kind: HapticKind) {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* noop */
  }
}
export const hapticsSupported = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;
