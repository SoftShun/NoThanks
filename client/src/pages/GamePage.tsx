import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

/**
 * GamePage handles both the lobby (pre‑game) interface and the
 * gameplay interface. It uses the SocketContext to retrieve the
 * current game state and to send player actions to the server.
 */
const GamePage: React.FC = () => {
  const { socket, state, pass, take, startGame, error, clearError } = useSocket();
  const yourId = socket?.id;

  // Local settings for host to configure game
  const [removedCount, setRemovedCount] = useState(9);
  const [initialTokens, setInitialTokens] = useState(11);
  const [showOpponentTokens, setShowOpponentTokens] = useState(true);
  // 버튼 로딩 상태는 훅 규칙을 지키기 위해 컴포넌트 최상단에 선언
  const [starting, setStarting] = useState(false);
  const [chipAnim, setChipAnim] = useState(0);
  const [takeAnimKey, setTakeAnimKey] = useState(0);

  // 키보드 접근성: 스페이스/엔터로 주요 액션 트리거
  // 항상 동일한 훅 순서를 보장하기 위해 early return 이전에 선언
  useEffect(() => {
    const isYourTurnNow = state?.currentPlayerId === yourId;
    const startedNow = !!state?.started;
    const handler = (e: KeyboardEvent) => {
      if (!startedNow || !isYourTurnNow) return;
      if (e.key === 'Enter') { take(); }
      if (e.key === ' ') { e.preventDefault(); pass(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [yourId, pass, take, state?.currentPlayerId, state?.started]);

  if (!state) {
    return (
      <div className="container">
        <div className="panel">서버에 연결 중…</div>
      </div>
    );
  }

  // Determine if you are the host (first player)
  const isHost = state.hostId === yourId;

  // If game has not started, show lobby
  if (!state.started) {
    return (
      <div className="container">
        <div className="header">
          <div className="title" role="heading" aria-level={2}>대기실</div>
        </div>
        <div className="panel">
          <div className="meta" aria-live="polite">현재 접속한 플레이어</div>
          <div className="players" style={{ marginTop: 8 }}>
            {state.players.map((p) => (
              <div key={p.id} className="player" aria-label={`${p.nickname}${state.hostId === p.id ? ' 방장' : ''}`}>
                <div className="name">
                  <span>{p.nickname}</span>
                  {state.hostId === p.id && <span className="badge">방장</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="title" style={{ fontSize: 16 }}>게임 설정</div>
          <div className="row two" style={{ marginTop: 8 }}>
            <div className="field">
              <label className="field-label" htmlFor="removed">제거할 카드 수</label>
              <input
                id="removed"
                type="number"
                inputMode="numeric"
                min={1}
                max={32}
                value={removedCount}
                onChange={(e) => setRemovedCount(Math.max(1, Math.min(32, Number(e.target.value) || 1)))}
                aria-label="제거할 카드 수 (1–32)"
                className="input"
                disabled={!isHost}
              />
              <div className="help">3–35 중 무작위로 제거되는 카드 개수 (기본 9)</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="tokens">초기 토큰 수</label>
              <input
                id="tokens"
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={initialTokens}
                onChange={(e) => setInitialTokens(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                aria-label="초기 토큰 수 (1–50)"
                className="input"
                disabled={!isHost}
              />
              <div className="help">각 플레이어가 시작 시 보유하는 토큰 수 (기본 11)</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="showTokens">상대 토큰 공개</label>
              <select 
                id="showTokens" 
                className="input" 
                value={showOpponentTokens ? 'public' : 'private'} 
                onChange={(e)=> setShowOpponentTokens(e.target.value === 'public')}
                disabled={!isHost}
              >
                <option value="public">공개</option>
                <option value="private">비공개</option>
              </select>
              <div className="help">상대 플레이어의 남은 칩 수를 공개/비공개로 설정</div>
            </div>
          </div>
          {isHost && (
            <div className="controls" style={{ marginTop: 8 }}>
              <button
                className="btn primary"
                onClick={async () => {
                  if (starting) return;
                  setStarting(true);
                  const ok = await startGame({ removedCount: removedCount || 1, initialTokens: initialTokens || 1, showOpponentTokens });
                  setStarting(false);
                  if (!ok) return;
                }}
                aria-label="게임 시작"
              >
                {starting ? '시작 중…' : '게임 시작'}
              </button>
            </div>
          )}
        </div>
        <div className="panel">
          <div className="meta" role="note">
            • 목표는 낮은 점수입니다. 연속된 카드 묶음에서 가장 낮은 카드만 합산, 합계에서 토큰 수를 뺍니다.
          </div>
        </div>
        {!isHost && (
          <div className="panel turn-banner" role="status" aria-live="polite">방장이 게임을 시작할 때까지 기다려 주세요…</div>
        )}
        {error && (
          <div className="toast" role="alert" onAnimationEnd={clearError}>{error}</div>
        )}
      </div>
    );
  }

  // Game in progress: show current card, pile tokens, players, actions
  const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const you = state.players.find((p) => p.id === yourId);
  const isYourTurn = state.currentPlayerId === yourId;

  

  return (
    <div className="container" role="main">
      <div className={`turn-banner ${isYourTurn ? 'is-you' : ''}`} role="status" aria-live="polite">
        {isYourTurn ? '당신의 차례입니다' : currentPlayer ? `${currentPlayer.nickname} 님의 차례입니다` : '대기 중…'}
      </div>
      <div className="row">
        <div className="panel">
          <div className="current-card">
            <div className={`card ${takeAnimKey ? 'take-lift' : ''}`} aria-label="현재 카드" key={`card-${state.currentCard}-${takeAnimKey}`} onAnimationEnd={() => setTakeAnimKey(0)}>
              <div className="value flip-in">{state.currentCard ?? '–'}</div>
              {chipAnim > 0 && <div className="chip-fly" onAnimationEnd={() => setChipAnim(0)} />}
            </div>
            <div className="pile-badge" aria-label={`카드 위 토큰 ${state.pileTokens}개`}>
              <div className="chip" aria-hidden>●</div>
              <div style={{ color: 'var(--muted)' }}>+{state.pileTokens}</div>
            </div>
          </div>
          <div className="meta" style={{ marginTop: 10 }}>
            <span>덱 남은 카드: {state.deckSize}</span>
            <span>제거된 카드 수: {state.removedCount}</span>
          </div>
          <div className="controls" style={{ marginTop: 12 }}>
            <button className="btn primary sm" onClick={() => { setTakeAnimKey((k)=>k+1); take(); }} disabled={!isYourTurn} aria-disabled={!isYourTurn} aria-label="카드 가져오기">
              가져오기
            </button>
            <button className="btn sm" onClick={() => { setChipAnim((k) => k + 1); pass(); }} disabled={!isYourTurn} aria-disabled={!isYourTurn} aria-label="패스">
              패스
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="players" aria-label="플레이어 목록">
            {state.players.map((p) => {
              const isYou = p.id === yourId;
              return (
                <div key={p.id} className={`player ${p.id === state.currentPlayerId ? 'active flash-win' : ''}`} aria-current={isYou ? 'true' : undefined}>
                  <div className="name">
                    <span>{p.nickname}</span>
                    <span className="badge">
                      {p.id === state.hostId ? '방장' : ''}
                    </span>
                  </div>
                  <div className="tokens" style={{ marginTop: 6 }}>
                    <div className="chip" aria-hidden>●</div>
                    <span>{(state.showOpponentTokens || isYou) ? p.tokens : '?'}</span>
                    {state.showOpponentTokens && (
                      <span className="score-badge" title="현재 추정 점수" style={{ marginLeft: 6 }}>
                        {(() => {
                          const sorted = p.cards.slice().sort((a,b)=>a-b);
                          let sum = 0; let prev: number | null = null;
                          for (const c of sorted) { if (prev == null || c !== prev + 1) sum += c; prev = c; }
                          return sum - p.tokens;
                        })()}
                      </span>
                    )}
                  </div>
                  {p.cards.length > 0 && (
                    <div className="my-cards" aria-label={isYou ? '내 카드' : `${p.nickname}님의 카드`}>
                      {(() => {
                        const sorted = p.cards.slice().sort((a,b)=>a-b);
                        const groups: number[][] = [];
                        for (const card of sorted) {
                          const last = groups[groups.length-1];
                          if (last && card === last[last.length-1] + 1) {
                            last.push(card);
                          } else {
                            groups.push([card]);
                          }
                        }
                        return (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {groups.map((g, gi)=> (
                              <div key={`g-${gi}`} className="card-group-box">
                                {g.map((c)=> (<span key={`n-${gi}-${c}`} className="tag">{c}</span>))}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && <div className="toast" role="alert">{error}</div>}
      </div>
    </div>
  );
};

export default GamePage;