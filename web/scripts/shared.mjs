// Playwright 공용 헬퍼 (스크린샷·측정 스크립트에서 사용)
import { chromium, devices } from 'playwright';

export const VIEWPORTS = [
  { name: 'mobile-portrait-390x844', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'mobile-landscape-844x390', viewport: { width: 844, height: 390 }, mobile: true },
  { name: 'desktop-1440x900', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'desktop-1920x1080', viewport: { width: 1920, height: 1080 }, mobile: false },
];

export async function launch() {
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

export async function newPage(browser, vp, { dpr = 2, prefs = {} } = {}) {
  const ctx = await browser.newContext({
    viewport: vp.viewport,
    deviceScaleFactor: dpr,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    userAgent: vp.mobile ? devices['iPhone 13'].userAgent : undefined,
  });
  await ctx.addInitScript((p) => {
    localStorage.setItem('nt-prefs', JSON.stringify({ latency: 0, sound: false, haptics: false, motion: 'full', botSpeed: 0.05, showStats: false, ...p }));
    localStorage.setItem('nt-nick', '나');
  }, prefs);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  return { ctx, page };
}

/** 내 차례마다 간단한 정책으로 행동 (자동 플레이) */
export async function autoPlayUntil(page, predicate, { timeout = 180_000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await predicate(page)) return true;
    await page.evaluate(() => {
      const s = window.__session;
      if (!s || !s.canAct()) return;
      const v = window.__store.getState().view;
      const me = v.players.find((p) => p.id === s.me);
      const card = v.currentCard;
      const take = me.tokens === 0 || v.currentCardHidden ? true : card > 0 && (v.pileTokens >= Math.ceil(card / 4) || card <= 12 || me.cards.some((c) => Math.abs(c - card) === 1));
      s.act(take ? 'take' : 'pass');
    });
    await page.waitForTimeout(60);
  }
  return false;
}

export const state = (page) => page.evaluate(() => {
  const st = window.__store.getState();
  return { screen: st.screen, taken: st.view ? st.view.players.reduce((n, p) => n + p.cards.length, 0) : 0, myTurn: st.view?.currentPlayerId === st.sessionId, busy: window.__session.queue.busy };
});
