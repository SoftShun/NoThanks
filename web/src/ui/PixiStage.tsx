import { Application, useApplication } from '@pixi/react';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { UPDATE_PRIORITY } from 'pixi.js';
import { TableScene } from '../table/TableView';
import { session } from '../app/session';
import { useStore } from '../app/store';
import { PALETTE } from '../app/theme';
import type { LayoutMode } from '../app/config';

function SceneBinder({ mode }: { mode: LayoutMode }) {
  const { app, isInitialised } = useApplication();
  const sceneRef = useRef<TableScene | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    if (!isInitialised || !app?.renderer) return;
    const scene = new TableScene(app);
    sceneRef.current = scene;
    app.stage.addChild(scene.root);
    scene.onCardHover = (on) => useStore.getState().set({ hoverCard: on });
    const room = useStore.getState().room;
    if (room) scene.opts = { showOpponentTokens: room.settings.showOpponentTokens, showRealTimeScore: room.settings.showRealTimeScore };
    scene.resize(app.screen.width, app.screen.height, modeRef.current);
    session.attachTable(scene);
    const onResize = () => {
      scene.resize(app.screen.width, app.screen.height, modeRef.current);
      scene.dirty = true;
    };
    app.renderer.on('resize', onResize);

    // 한글 폰트 서브셋이 늦게 도착하면 텍스트 다시 그림
    const onFonts = () => {
      const v = useStore.getState().view;
      if (v && !session.queue.busy) scene.sync(v);
    };
    document.fonts?.addEventListener?.('loadingdone', onFonts);

    // FPS / 실제 렌더 횟수 측정
    let frames = 0;
    let rendered = 0;
    let last = performance.now();
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        const s = useStore.getState();
        s.set({ stats: { ...s.stats, fps: Math.round((frames * 1000) / (now - last)), renders: Math.round((rendered * 1000) / (now - last)) } });
        frames = 0;
        rendered = 0;
        last = now;
      }
    };
    app.ticker.add(tick);

    // 요청 기반 렌더: GSAP 트윈이 돌거나 장면이 바뀐 때만 그림(+여유 2프레임). 정지 화면에서는 GPU 를 쉬게 함.
    // Application 은 ticker 에 render 를 직접 등록하므로, 그 리스너를 빼고 조건부 렌더로 교체.
    const originalRender = app.render;
    app.ticker.remove(originalRender, app);
    let grace = 0;
    const onDemandRender = () => {
      const animating = gsap.globalTimeline.getChildren(false, true, true).length > 0;
      if (animating || scene.dirty) grace = 2;
      if (grace > 0) {
        grace--;
        scene.dirty = false;
        const t0 = performance.now();
        originalRender.call(app);
        const w = window as unknown as { __renderMs?: number[] };
        (w.__renderMs ??= []).push(performance.now() - t0);
        if (w.__renderMs.length > 600) w.__renderMs.shift();
        rendered++;
      }
    };
    app.ticker.add(onDemandRender, undefined, UPDATE_PRIORITY.LOW);

    // 점수 화면이 덮고 있을 땐 테이블 렌더를 멈춤
    const unsubScreen = useStore.subscribe((s, prev) => {
      if (s.screen === prev.screen) return;
      if (s.screen === 'results') setTimeout(() => useStore.getState().screen === 'results' && app.ticker.stop(), 400);
      else app.ticker.start();
    });
    performance.mark('table-ready');

    return () => {
      unsubScreen();
      app.ticker.remove(onDemandRender);
      app.ticker.add(originalRender, app, UPDATE_PRIORITY.LOW);
      app.ticker.start();
      app.ticker.remove(tick);
      app.renderer?.off('resize', onResize);
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      session.attachTable(null);
      scene.destroy();
      sceneRef.current = null;
    };
  }, [app, isInitialised]);

  useEffect(() => {
    const s = sceneRef.current;
    if (s && app?.renderer) {
      s.resize(app.screen.width, app.screen.height, mode);
      s.dirty = true;
    }
  }, [mode, app]);

  return null;
}

export function PixiStage({ mode }: { mode: LayoutMode }) {
  const host = useRef<HTMLDivElement>(null);
  return (
    <div ref={host} className="stage" aria-label="게임 테이블" role="img">
      <Application
        resizeTo={host}
        background={PALETTE.ink}
        antialias
        autoDensity
        resolution={Math.min(window.devicePixelRatio || 1, 2)}
        preference="webgl"
      >
        <SceneBinder mode={mode} />
      </Application>
    </div>
  );
}
