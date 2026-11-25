import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useStore } from '../app/store';
import { session } from '../app/session';
import type { LayoutMode } from '../app/config';
import { runsOf } from '../engine/rules';
import { isReduced } from '../anim/motion';
import { sfx } from '../fx/sound';

/** 점수 집계 화면: 꼴찌부터 1등 순으로 카드 점수 → 칩 차감 → 최종 점수 카운트 */
export function Results({ mode }: { mode: LayoutMode }) {
  const results = useStore((s) => s.results);
  const me = useStore((s) => s.sessionId);
  const room = useStore((s) => s.room);
  const root = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const [done, setDone] = useState(false);
  const [again, setAgain] = useState(false);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const rows = [...el.querySelectorAll<HTMLElement>('.res-row')].reverse();
    const t = gsap.timeline({ onComplete: () => setDone(true) });
    tl.current = t;
    t.fromTo(el.querySelector('.res-sheet'), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
    rows.forEach((row) => {
      const cardsEl = row.querySelector<HTMLElement>('[data-k="cards"]')!;
      const tokEl = row.querySelector<HTMLElement>('[data-k="tokens"]')!;
      const totEl = row.querySelector<HTMLElement>('[data-k="total"]')!;
      const cp = Number(cardsEl.dataset.v);
      const tk = Number(tokEl.dataset.v);
      const total = Number(totEl.dataset.v);
      const o = { c: 0, k: 0, t: 0 };
      t.fromTo(row, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.22, ease: 'power3.out' });
      t.to(o, {
        c: cp,
        duration: 0.45,
        ease: 'power1.out',
        onStart: () => sfx('tick'),
        onUpdate: () => {
          cardsEl.textContent = String(Math.round(o.c));
        },
      });
      t.to(o, { k: tk, duration: 0.25, ease: 'power1.out', onUpdate: () => {
          tokEl.textContent = `−${Math.round(o.k)}`;
        } });
      t.to(o, {
        t: total,
        duration: 0.2,
        onUpdate: () => {
          totEl.textContent = String(Math.round(o.t));
        },
        onComplete: () => {
          totEl.textContent = String(total);
          sfx('tick', { rate: 1.4 });
        },
      });
      if (row.dataset.rank === '1') {
        t.fromTo(row.querySelector('.crown'), { scale: 0, rotate: -40 }, { scale: 1, rotate: 0, duration: 0.4, ease: 'back.out(2)' });
        t.call(() => sfx('win'));
      }
    });
    if (isReduced()) t.progress(1);
    return () => {
      t.kill();
    };
  }, [results]);

  const skip = () => tl.current?.progress(1);

  useEffect(() => {
    if (!again || room?.phase !== 'lobby') return;
    session.start();
    setAgain(false);
  }, [again, room?.phase]);

  const myRank = results.find((r) => r.id === me)?.rank;
  return (
    <div className={`results results-${mode}`} data-done={done ? '1' : '0'} ref={root} onClick={done ? undefined : skip}>
      <div className="res-sheet" role="dialog" aria-label="최종 점수">
        <h2>{myRank === 1 ? '최저 점수로 승리!' : `${myRank ?? '-'}위로 마감`}</h2>
        <p className="muted small">점수 = 묶음별 최저 카드 합 − 남은 칩 · 낮을수록 좋음{done ? '' : ' · 탭하면 건너뛰기'}</p>
        <ol className="res-list">
          {results.map((r) => (
            <li key={r.id} className={`res-row ${r.id === me ? 'me' : ''}`} data-rank={r.rank}>
              <span className="res-rank">
                {r.rank}
                <span className="crown" aria-hidden>
                  {r.rank === 1 ? '♛' : ''}
                </span>
              </span>
              <span className="res-name">
                {r.nickname}
                {r.id === me && r.nickname !== '나' && <span className="tag">나</span>}
              </span>
              <span className="res-runs" aria-label="가져간 카드">
                {runsOf(r.cards).map((run) => (
                  <span key={run[0]} className="run">
                    {run.map((c, i) => (
                      <span key={c} className={`mc ${i === 0 ? 'counted' : ''}`} style={{ zIndex: run.length - i }}>
                        {c}
                      </span>
                    ))}
                  </span>
                ))}
                {r.cards.length === 0 && <span className="muted small">카드 없음</span>}
              </span>
              <span className="res-num" data-k="cards" data-v={r.cardPoints} title="카드 점수">
                0
              </span>
              <span className="res-num tok" data-k="tokens" data-v={r.tokens} title="칩">
                −0
              </span>
              <span className="res-num total" data-k="total" data-v={r.score} title="최종">
                0
              </span>
            </li>
          ))}
        </ol>
        <div className="res-actions">
          <button
            className="btn primary big"
            onClick={(e) => {
              e.stopPropagation();
              setAgain(true);
              session.returnToLobby();
            }}
          >
            같은 설정으로 다시
          </button>
          <button
            className="btn big"
            onClick={(e) => {
              e.stopPropagation();
              session.returnToLobby();
            }}
          >
            로비로
          </button>
        </div>
      </div>
    </div>
  );
}
