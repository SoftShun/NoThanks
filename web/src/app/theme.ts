/** 1안 "심야 전당포" 팔레트 — docs/remake/art-direction.md 와 동기화 */
export const PALETTE = {
  ink: 0x10131c,
  felt: 0x1a2133,
  feltLight: 0x232c42,
  feltEdge: 0x0b0e15,
  brass: 0xd9a441,
  brassLight: 0xf0c869,
  brassDark: 0x8a6420,
  paper: 0xf3e9d2,
  paperShade: 0xd8c9a6,
  inkText: 0x23202a,
  teal: 0x3aa39a,
  vermilion: 0xe2553b,
  text: 0xede6d6,
  muted: 0x8c93a8,
  good: 0x6cc28a,
} as const;

/** 카드 값(3~35)에 따른 위험 색: 낮을수록 청록, 높을수록 주홍 */
export function cardAccent(value: number): number {
  const t = Math.max(0, Math.min(1, (value - 3) / 32));
  const a = { r: 0x3a, g: 0xa3, b: 0x9a };
  const m = { r: 0xd9, g: 0xa4, b: 0x41 };
  const b = { r: 0xe2, g: 0x55, b: 0x3b };
  const lerp = (x: number, y: number, k: number) => Math.round(x + (y - x) * k);
  const [from, to, k] = t < 0.5 ? [a, m, t * 2] : [m, b, (t - 0.5) * 2];
  return (lerp(from.r, to.r, k) << 16) | (lerp(from.g, to.g, k) << 8) | lerp(from.b, to.b, k);
}

export const FONT_UI = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif';
export const FONT_NUM = '"DM Serif Display", Georgia, serif';
