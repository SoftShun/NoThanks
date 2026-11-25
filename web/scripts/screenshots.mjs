// 로비 / 게임 중 / 점수 화면 스크린샷을 4개 뷰포트로 찍어 docs/remake/screens/web/ 에 저장
// 사용: (다른 터미널에서 npm run dev 또는 npm run preview 실행 후) BASE_URL=http://localhost:5173 npm run shots
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWPORTS, launch, newPage, autoPlayUntil, state } from './shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../docs/remake/screens/web');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const only = process.env.ONLY;
mkdirSync(OUT, { recursive: true });

const browser = await launch();
for (const vp of VIEWPORTS) {
  if (only && !vp.name.includes(only)) continue;
  const { ctx, page } = await newPage(browser, vp);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__store?.getState().screen === 'lobby');
  // 봇 3개 구성
  await page.evaluate(() => window.__session.addBot('expert'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${vp.name}-1-lobby.png` });

  await page.getByRole('button', { name: '게임 시작' }).click();
  await autoPlayUntil(page, async (p) => {
    const s = await state(p);
    return s.taken >= 11 && s.myTurn && !s.busy;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${vp.name}-2-game.png` });

  await autoPlayUntil(page, async (p) => (await state(p)).screen === 'results');
  await page.waitForSelector('.results[data-done="1"]', { timeout: 60_000 }); // 점수 집계 연출 끝까지
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${vp.name}-3-results.png` });
  console.log('✓', vp.name);
  await ctx.close();
}
await browser.close();
