import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from '../app/store';
import { session } from '../app/session';
import { useLayoutMode } from './useLayout';
import { Lobby } from './Lobby';
import { SettingsSheet } from './SettingsSheet';
import { Toasts } from './Toasts';
import { StatsOverlay } from './StatsOverlay';
import { setSoundEnabled } from '../fx/sound';
import { setHapticsEnabled } from '../fx/haptics';
import { setReducedMotion, systemPrefersReduced } from '../anim/motion';

// 테이블(Pixi)은 게임 시작 때 불러옴 → 로비 첫 로딩을 가볍게. 로비에서 미리 받아 둠(prefetch)
const loadGame = () => import('./GameScreen');
const GameScreen = lazy(() => loadGame().then((m) => ({ default: m.GameScreen })));
const Results = lazy(() => import('./Results').then((m) => ({ default: m.Results })));

export function App() {
  const mode = useLayoutMode();
  const screen = useStore((s) => s.screen);
  const prefs = useStore((s) => s.prefs);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 접속 (목 서버)
  useEffect(() => {
    if (session.conn) return;
    const params = new URLSearchParams(location.search);
    const nick = params.get('nick') ?? localStorage.getItem('nt-nick') ?? '나';
    void session.connect(nick);
  }, []);

  // 로비가 뜬 뒤 한가할 때 게임 화면 코드를 미리 받아 둠
  useEffect(() => {
    if (screen !== 'lobby') return;
    const id = setTimeout(() => void loadGame(), 1200);
    return () => clearTimeout(id);
  }, [screen]);

  // 환경 설정 반영
  useEffect(() => {
    setSoundEnabled(prefs.sound);
    setHapticsEnabled(prefs.haptics);
    session.setLatency(prefs.latency);
    session.setBotSpeed(prefs.botSpeed);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      const reduced = prefs.motion === 'reduce' || (prefs.motion === 'system' && systemPrefersReduced());
      setReducedMotion(reduced);
      document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [prefs]);

  // 전역 단축키: Esc = 설정, M = 소리
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') setSettingsOpen((o) => !o);
      if (e.key === 'm' || e.key === 'M') useStore.getState().setPrefs({ sound: !useStore.getState().prefs.sound });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`app mode-${mode}`}>
      {screen === 'connecting' && <div className="connecting">접속 중…</div>}
      {screen === 'lobby' && <Lobby mode={mode} onOpenSettings={() => setSettingsOpen(true)} />}
      <Suspense fallback={<div className="connecting">테이블 준비 중…</div>}>
        {(screen === 'game' || screen === 'results') && <GameScreen mode={mode} onOpenSettings={() => setSettingsOpen(true)} />}
        {screen === 'results' && <Results mode={mode} />}
      </Suspense>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toasts />
      {prefs.showStats && <StatsOverlay />}
    </div>
  );
}
