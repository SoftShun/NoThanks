import { useEffect, useRef, useState } from 'react';
import { useStore, selectMe } from '../app/store';
import { session } from '../app/session';
import { GAME_TITLE, type LayoutMode } from '../app/config';
import { PixiStage } from './PixiStage';
import { cardPoints, playerScore, runsOf } from '../engine/rules';

export function GameScreen({ mode, onOpenSettings }: { mode: LayoutMode; onOpenSettings: () => void }) {
  const big = mode === 'desktop' || mode === 'wide';
  return (
    <div className="game">
      {mode === 'wide' && (
        <aside className="panel panel-left">
          <RoundInfo />
          <EventLog />
        </aside>
      )}
      <div className="game-main">
        {mode !== 'landscape' && <Hud onOpenSettings={onOpenSettings} />}
        <PixiStage mode={mode} />
        {mode !== 'landscape' && <ActionBar mode={mode} />}
      </div>
      {mode === 'landscape' && (
        <aside className="side-actions">
          <Hud onOpenSettings={onOpenSettings} compact />
          <ActionBar mode={mode} />
        </aside>
      )}
      {big && (
        <aside className="panel panel-right">
          <Scoreboard />
          {mode === 'desktop' && <EventLog />}
          <KeyHints />
        </aside>
      )}
    </div>
  );
}

function Hud({ onOpenSettings, compact }: { onOpenSettings: () => void; compact?: boolean }) {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const latency = useStore((s) => s.prefs.latency);
  return (
    <header className={`hud ${compact ? 'hud-compact' : ''}`}>
      <div className="hud-title">
        <span className="brand-coin" aria-hidden />
        <span className="hud-name">{GAME_TITLE}</span>
      </div>
      <div className="hud-stats">
        <span className="pill" title="덱에 남은 카드">
          덱 <b>{view?.deckSize ?? 0}</b>
        </span>
        {!compact && (
          <span className="pill" title="게임에서 제외된 카드 수 (값은 비공개)">
            제외 <b>{room?.removedCount ?? 0}</b>
          </span>
        )}
        {room?.settings.gameMode === 'hidden' && <span className="pill pill-accent">히든 {room.hiddenRevealed}/{room.hiddenTotal}</span>}
        {latency > 0 && <span className="pill pill-warn" title="목 서버 지연 시뮬레이션">지연 {latency}ms</span>}
      </div>
      <button className="icon-btn" onClick={onOpenSettings} aria-label="설정 열기" title="설정 (Esc)">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
        </svg>
      </button>
    </header>
  );
}

function useCountdown(deadline: number | undefined, active: boolean) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!deadline || !active) {
      setLeft(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      setLeft(Math.max(0, deadline - Date.now()));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [deadline, active]);
  return left;
}

function ActionBar({ mode }: { mode: LayoutMode }) {
  const view = useStore((s) => s.view);
  const me = useStore(selectMe);
  const room = useStore((s) => s.room);
  const pending = useStore((s) => s.pending);
  const animating = useStore((s) => s.animating);
  const revealing = useStore((s) => s.revealing);
  const hoverCard = useStore((s) => s.hoverCard);
  const [shake, setShake] = useState(0);
  const myTurn = !!view && view.currentPlayerId === me?.id;
  const deadline = room?.turnDeadline;
  const left = useCountdown(deadline, myTurn);
  const limit = (room?.settings.turnTimeLimit ?? 0) * 1000;
  const currentName = view?.players.find((p) => p.id === view.currentPlayerId)?.nickname;
  const card = view?.currentCard ?? null;
  const hidden = !!view?.currentCardHidden;
  const tokens = me?.tokens ?? 0;
  const canPass = myTurn && tokens > 0 && !pending && !revealing;
  const canTake = myTurn && !pending && !revealing && card != null;
  const takeDelta = me && card != null && card > 0 ? cardPoints([...me.cards, card]) - cardPoints(me.cards) - (view?.pileTokens ?? 0) : null;
  const score = me ? playerScore(me) : 0;
  const lastRejected = useRef(0);

  // 거절 시 버튼 흔들기
  useEffect(() => {
    const unsub = useStore.subscribe((s, prev) => {
      if (s.toasts.length > prev.toasts.length && s.toasts[s.toasts.length - 1].tone === 'error') {
        lastRejected.current = Date.now();
        setShake((n) => n + 1);
      }
    });
    return unsub;
  }, []);

  // 키보드 단축키 (데스크톱)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'Space' || e.key === 'p' || e.key === 'P' || e.key === 'ArrowLeft') {
        e.preventDefault();
        press('pass', e.timeStamp);
      } else if (e.key === 'Enter' || e.key === 't' || e.key === 'T' || e.key === 'ArrowRight') {
        e.preventDefault();
        press('take', e.timeStamp);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const press = (kind: 'pass' | 'take', ts?: number) => {
    const btn = document.querySelector<HTMLElement>(`[data-action="${kind}"]`);
    if (btn) {
      btn.classList.remove('flash');
      void btn.offsetWidth;
      btn.classList.add('flash');
    }
    session.act(kind, ts);
  };

  const status = !view
    ? ''
    : revealing
      ? '히든 카드 공개 중…'
      : myTurn
        ? pending
          ? '처리 중…'
          : tokens === 0
            ? '칩이 없습니다 — 가져가야 합니다'
            : '내 차례 — 칩을 걸거나 가져가세요'
        : animating
          ? `${currentName ?? ''} 차례`
          : `${currentName ?? ''} 생각 중`;

  return (
    <div className={`actionbar ${myTurn ? 'is-turn' : ''} ${hoverCard ? 'hint-take' : ''}`} data-mode={mode}>
      <div className="ab-info">
        <div className="ab-tokens" aria-label={`내 칩 ${tokens}개`}>
          <span className="chip-ico" aria-hidden />
          <b>{tokens}</b>
        </div>
        <div className="ab-score" title="카드 점수 - 칩 (낮을수록 좋음)">
          <span>내 점수</span>
          <b>{score}</b>
        </div>
        <div className={`ab-status ${myTurn ? 'mine' : ''}`} aria-live="polite">
          {status}
          {!myTurn && !revealing && view && <span className="dots" aria-hidden />}
        </div>
      </div>
      {myTurn && limit > 0 && (
        <div className="timer" aria-hidden>
          <div className={`timer-fill ${left < 5000 ? 'urgent' : ''}`} style={{ transform: `scaleX(${Math.min(1, left / limit)})` }} />
        </div>
      )}
      <div className="ab-buttons" key={shake} data-shake={shake > 0 ? 'y' : 'n'}>
        <button
          className="act act-pass"
          data-action="pass"
          disabled={!canPass}
          onClick={(e) => press('pass', e.timeStamp)}
          aria-keyshortcuts="Space P"
        >
          <span className="act-main">칩 걸기</span>
          <span className="act-sub">{tokens > 0 ? `칩 −1 · 남은 칩 ${Math.max(0, tokens - 1)}` : '칩 없음'}</span>
          {(mode === 'desktop' || mode === 'wide') && <kbd>Space</kbd>}
        </button>
        <button
          className="act act-take"
          data-action="take"
          disabled={!canTake}
          onClick={(e) => press('take', e.timeStamp)}
          aria-keyshortcuts="Enter T"
        >
          <span className="act-main">가져가기</span>
          <span className="act-sub">
            {hidden ? '공개 후 가져감' : takeDelta == null ? '—' : `${takeDelta >= 0 ? '+' : ''}${takeDelta}점 · 칩 +${view?.pileTokens ?? 0}`}
          </span>
          {(mode === 'desktop' || mode === 'wide') && <kbd>Enter</kbd>}
        </button>
      </div>
    </div>
  );
}

function Scoreboard() {
  const view = useStore((s) => s.view);
  const me = useStore((s) => s.sessionId);
  const room = useStore((s) => s.room);
  if (!view) return null;
  const showScore = room?.settings.showRealTimeScore ?? true;
  return (
    <section className="card-panel">
      <h3>플레이어 (턴 순서)</h3>
      <ol className="sb-list">
        {view.players.map((p) => {
          const vis = p.tokens >= 0;
          return (
            <li key={p.id} className={`sb-row ${view.currentPlayerId === p.id ? 'turn' : ''} ${p.id === me ? 'me' : ''}`}>
              <span className={`sb-dot ${p.isBot ? 'bot' : ''}`} aria-hidden />
              <span className="sb-name">{p.id === me && p.nickname !== '나' ? `${p.nickname} (나)` : p.nickname}</span>
              <span className="sb-cards" title={runsOf(p.cards).map((r) => r.join('-')).join(', ')}>
                {p.cards.length}장
              </span>
              <span className="sb-tokens">칩 {vis ? p.tokens : '?'}</span>
              <span className="sb-score">{showScore && vis ? `${playerScore(p)}점` : `${cardPoints(p.cards)}+`}</span>
            </li>
          );
        })}
      </ol>
      {!room?.settings.showOpponentTokens && <p className="muted small">상대 칩은 비공개 설정입니다. 점수 칸은 카드 점수만 보여 줍니다.</p>}
    </section>
  );
}

function EventLog() {
  const log = useStore((s) => s.log);
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log]);
  return (
    <section className="card-panel grow">
      <h3>진행 기록</h3>
      <ol className="log" ref={ref} aria-live="off">
        {log.map((l) => (
          <li key={l.seq}>
            <span className="seq">#{l.seq}</span> {l.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

function RoundInfo() {
  const room = useStore((s) => s.room);
  const view = useStore((s) => s.view);
  if (!room || !view) return null;
  const total = 33 - room.removedCount;
  const taken = view.players.reduce((n, p) => n + p.cards.length, 0);
  return (
    <section className="card-panel">
      <h3>이번 판</h3>
      <dl className="kv">
        <dt>진행</dt>
        <dd>
          {taken} / {total}장
        </dd>
        <dt>제외된 카드</dt>
        <dd>{room.removedCount}장 (비공개)</dd>
        <dt>시작 칩</dt>
        <dd>{room.settings.initialTokens}개</dd>
        <dt>턴 제한</dt>
        <dd>{room.settings.turnTimeLimit ? `${room.settings.turnTimeLimit}초` : '없음'}</dd>
        <dt>모드</dt>
        <dd>{room.settings.gameMode === 'hidden' ? `히든 (${room.settings.hiddenCardCount}장)` : '일반'}</dd>
      </dl>
      <div className="progress" aria-hidden>
        <div style={{ width: `${(taken / total) * 100}%` }} />
      </div>
    </section>
  );
}

function KeyHints() {
  return (
    <section className="card-panel keys">
      <h3>단축키</h3>
      <ul>
        <li>
          <kbd>Space</kbd>/<kbd>P</kbd> 칩 걸기
        </li>
        <li>
          <kbd>Enter</kbd>/<kbd>T</kbd> 가져가기
        </li>
        <li>
          <kbd>M</kbd> 소리 켜기/끄기 · <kbd>Esc</kbd> 설정
        </li>
      </ul>
    </section>
  );
}
