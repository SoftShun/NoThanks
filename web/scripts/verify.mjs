// 기능 검증: 지연 300ms 전체 게임 일관성 + 서버 거절 롤백 + 모션 줄이기
import { launch, newPage, VIEWPORTS, autoPlayUntil, state } from './shared.mjs';
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const browser = await launch();
const results = {};

// 1) 지연 300ms 로 한 판 끝까지: 재동기화(스냅) 경고가 없어야 함
{
  const { ctx, page } = await newPage(browser, VIEWPORTS[2], { dpr: 1, prefs: { latency: 300, botSpeed: 0.1 } });
  const warns = [];
  page.on('console', (m) => m.text().includes('[reconcile]') || m.text().includes('[seq gap]') ? warns.push(m.text()) : 0);
  await page.goto(BASE);
  await page.waitForFunction(() => window.__store?.getState().screen === 'lobby');
  await page.evaluate(() => window.__session.updateSettings({ turnTimeLimit: 0 }));
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '게임 시작' }).first().click();
  const done = await autoPlayUntil(page, async (p) => (await state(p)).screen === 'results', { timeout: 240_000 });
  const consistent = await page.evaluate(() => {
    const st = window.__store.getState();
    return st.results.reduce((n, r) => n + r.cards.length, 0);
  });
  results.latency300_fullGame = { finished: done, cardsInResults: consistent, snapWarnings: warns.length };
  await ctx.close();
}

// 2) 롤백: 내 차례에 서버 쪽 차례를 몰래 바꿔 거절 유도
for (const latency of [0, 300]) {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0], { dpr: 1, prefs: { latency, botSpeed: 0.1 } });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__store?.getState().screen === 'lobby');
  await page.evaluate(() => window.__session.updateSettings({ turnTimeLimit: 0 }));
  await page.waitForTimeout(latency + 200);
  await page.getByRole('button', { name: '게임 시작' }).first().click();
  await page.waitForFunction(() => window.__session.canAct() && window.__store.getState().view.players.find((p) => p.id === window.__session.me).tokens > 0, null, { timeout: 60_000 });
  const r = await page.evaluate(async () => {
    const s = window.__session;
    const before = JSON.stringify(window.__store.getState().view);
    const room = s.server.room;
    room.botSpeed = 1000; // 봇이 움직이지 않게
    const idx = room.engine.currentPlayerIndex;
    room.engine.currentPlayerIndex = (idx + 1) % room.engine.players.length; // 서버만 차례 변경
    s.act('pass');
    const predicted = JSON.stringify(window.__store.getState().view) !== before;
    await new Promise((res) => { const t = setInterval(() => { if (!s.pending && !s.queue.busy) { clearInterval(t); res(); } }, 20); });
    const after = JSON.stringify(window.__store.getState().view);
    const toast = window.__store.getState().toasts.map((t) => t.text);
    return { predictedImmediately: predicted, restored: after === before, toast };
  });
  results[`rollback_${latency}ms`] = r;
  await ctx.close();
}

// 3) 모션 줄이기: 시스템 설정(prefers-reduced-motion) 반영
{
  const { ctx, page } = await newPage(browser, VIEWPORTS[2], { dpr: 1, prefs: { motion: 'system' } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__store?.getState().screen === 'lobby');
  results.reducedMotion = { htmlDataMotion: await page.evaluate(() => document.documentElement.dataset.motion) };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
