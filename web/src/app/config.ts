/** 게임 이름은 아직 정하지 않았으므로 자리표시자를 그대로 노출합니다. */
export const GAME_TITLE = '{새 이름}';
export const GAME_SUBTITLE = '심야 전당포 · 카드 경매 게임';

export type LayoutMode = 'portrait' | 'landscape' | 'desktop' | 'wide';

/**
 * 브레이크포인트 (docs/remake/ux-spec.md 와 동일)
 * - portrait : 짧은 변 < 600 이고 세로가 더 김            (기준 390×844)
 * - landscape: 높이 < 560 이고 가로가 더 김 (폰 가로)     (기준 844×390)
 * - wide     : 너비 ≥ 1680 이고 높이 ≥ 940               (기준 1920×1080)
 * - desktop  : 그 외 (태블릿·노트북·데스크톱)             (기준 1440×900)
 */
export function layoutModeFor(w: number, h: number): LayoutMode {
  if (h >= w && w < 600) return 'portrait';
  if (w > h && h < 560) return 'landscape';
  if (w >= 1680 && h >= 940) return 'wide';
  if (h > w && w < 900) return 'portrait';
  return 'desktop';
}

export const LATENCY_OPTIONS = [0, 100, 300] as const;
