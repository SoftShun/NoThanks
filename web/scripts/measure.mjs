// 성능 측정: 빌드 용량 / 첫 로딩 / FPS / 입력 반응(지연 0·100·300ms)
// 사용: npm run build && (다른 터미널) npm run preview  →  BASE_URL=http://localhost:4173 npm run measure
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, newPage, VIEWPORTS } from './shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, '../dist');
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const out = {};

// ── 1. 빌드 용량 ──
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  statSync(p).isDirectory() ? walk(p) : files.push(p);
});
walk(DIST);
const sum = (arr) => arr.reduce((n, f) => n + statSync(f).size, 0);
const gz = (arr) => arr.reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
const fonts = files.filter((f) => /\.(woff2?|ttf)$/.test(f));
out.build = {
  totalBytes: sum(files),
  jsBytes: sum(js), jsGzip: gz(js),
  cssBytes: sum(css), cssGzip: gz(css),
  fontBytes: sum(fonts), fontFiles: fonts.length,
  files: files.length,
};

const browser = await launch();
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

// ── 2. 첫 로딩 (캐시 없음) ──
async function loadOnce(vp, throttle) {
  const { ctx, page } = await newPage(browser, vp, { dpr: 1 });
  if (throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  }
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__store?.getState().screen === 'lobby');
  await page.evaluate(() => document.fonts.ready);
  const wall = Date.now() - t0;
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
    const res = performance.getEntriesByType('resource');
    const transfer = res.reduce((n, r) => n + (r.transferSize || r.encodedBodySize || 0), 0) + (nav.transferSize || nav.encodedBodySize || 0);
    return { dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, fcp, transfer, requests: res.length + 1 };
  });
  // 게임 시작 → 테이블 준비
  const s0 = Date.now();
  await page.getByRole('button', { name: '게임 시작' }).first().click();
  await page.waitForFunction(() => performance.getEntriesByName('table-ready').length > 0);
  const tableReady = Date.now() - s0;
  const res2 = await page.evaluate(() => performance.getEntriesByType('resource').reduce((n, r) => n + (r.transferSize || r.encodedBodySize || 0), 0));
  await ctx.close();
  return { ...m, wallToLobby: wall, tableReadyAfterStart: tableReady, transferAfterGame: res2 };
}
const desk = VIEWPORTS[2];
const mob = VIEWPORTS[0];
for (const [label, vp, thr] of [['desktop_local', desk, false], ['mobile_local', mob, false], ['mobile_fast3g', mob, true]]) {
  const runs = [];
  for (let i = 0; i < (thr ? 3 : 5); i++) runs.push(await loadOnce(vp, thr));
  out[`load_${label}`] = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, median(runs.map((r) => r[k]))]));
}

// ── 3. FPS (게임 진행 중 10초) ──
async function fps(vp) {
  const { ctx, page } = await newPage(browser, vp, { dpr: vp.mobile ? 2 : 1, prefs: { botSpeed: 0.25 } });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__store?.getState().screen === 'lobby');
  await page.evaluate(() => window.__session.updateSettings({ turnTimeLimit: 0 }));
  await page.getByRole('button', { name: '게임 시작' }).first().click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => (window.__renderMs = []));
  const r = await page.evaluate(() => new Promise((resolve) => {
    const dts = []; let last = performance.now(); const end = last + 10000;
    const auto = setInterval(() => { const s = window.__session; if (s.canAct()) s.act(Math.random() < 0.4 ? 'take' : 'pass'); }, 120);
    const f = (t) => { dts.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else { clearInterval(auto); resolve(dts); } };
    requestAnimationFrame(f);
  }));
  const renderMs = await page.evaluate(() => window.__renderMs);
  // 정지 상태(연출 없음) FPS
  await page.evaluate(() => (window.__session.server.room.botSpeed = 1000));
  await page.waitForTimeout(1500);
  const idle = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  await ctx.close();
  const avg = 1000 / (r.reduce((a, b) => a + b, 0) / r.length);
  return { avgFpsWhileAnimating: +avg.toFixed(1), p99FrameMs: +pct(r, 0.99).toFixed(1), frames: r.length, over33ms: r.filter((x) => x > 33.4).length, idleFps: idle, renderCallMedianMs: +median(renderMs).toFixed(2), renderCallP95Ms: +pct(renderMs, 0.95).toFixed(2), renders: renderMs.length };
}
out.fps_desktop_1440 = await fps(desk);
out.fps_mobile_390 = await fps(mob);

// ── 4. 입력 반응 (지연 0/100/300) ──
async function inputLatency(latency) {
  const { ctx, page } = await newPage(browser, desk, { dpr: 1, prefs: { botSpeed: 0.1, latency } });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__store?.getState().screen === 'lobby');
  await page.evaluate(() => window.__session.updateSettings({ turnTimeLimit: 0 }));
  await page.waitForTimeout(latency + 200);
  await page.getByRole('button', { name: '게임 시작' }).first().click();
  const samples = []; const acks = [];
  const t0 = Date.now();
  while (samples.length < 12 && Date.now() - t0 < 90_000) {
    const ok = await page.evaluate(() => window.__session.canAct() && window.__store.getState().view.players.find((p) => p.id === window.__session.me).tokens > 0);
    if (!ok) { await page.waitForTimeout(40); if (await page.evaluate(() => window.__store.getState().screen === 'results')) break; continue; }
    const kind = samples.length % 3 === 2 ? 'take' : 'pass';
    const before = await page.evaluate(() => window.__store.getState().stats.inputMs.length);
    const tClick = Date.now();
    await page.click(`[data-action="${kind}"]`);
    await page.waitForFunction((n) => window.__store.getState().stats.inputMs.length > n, before);
    await page.waitForFunction(() => window.__session.pending === null, null, { timeout: 5000 });
    acks.push(Date.now() - tClick);
    samples.push(await page.evaluate(() => window.__store.getState().stats.lastInputMs));
  }
  await ctx.close();
  return { n: samples.length, inputToFrameMedianMs: +median(samples).toFixed(1), inputToFrameP95Ms: +pct(samples, 0.95).toFixed(1), serverConfirmMedianMs: median(acks) };
}
for (const l of [0, 100, 300]) out[`input_${l}ms`] = await inputLatency(l);

await browser.close();
console.log(JSON.stringify(out, null, 2));
writeFileSync(resolve(here, '../../docs/remake/measure-web.json'), JSON.stringify({ measuredAt: new Date().toISOString(), env: 'headless Chromium (SwiftShader 소프트웨어 GL), Linux 컨테이너', ...out }, null, 2));
