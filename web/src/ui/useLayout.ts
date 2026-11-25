import { useEffect } from 'react';
import { layoutModeFor } from '../app/config';
import { useStore } from '../app/store';

/** 창 크기 → 레이아웃 모드 (스토어에 저장, <html data-layout> 로도 노출) */
export function useLayoutMode() {
  const set = useStore((s) => s.set);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mode = layoutModeFor(w, h);
      document.documentElement.dataset.layout = mode;
      document.documentElement.style.setProperty('--vh', `${h}px`);
      set({ layout: mode });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [set]);
  return useStore((s) => s.layout);
}
