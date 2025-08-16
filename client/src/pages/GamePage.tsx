import React, { useEffect, useState, useMemo } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { 
  HiPlay, 
  HiOutlineXCircle, 
  HiOutlineClock,
  HiOutlineSparkles,
  HiChevronRight
} from 'react-icons/hi2';
import { RiCoinLine } from 'react-icons/ri';

// Helper function to calculate player score
const calculatePlayerScore = (cards: number[], tokens: number): number => {
  const sorted = cards.slice().sort((a, b) => a - b);
  let sum = 0;
  let prev: number | null = null;
  for (const card of sorted) {
    if (prev == null || card !== prev + 1) sum += card;
    prev = card;
  }
  return sum - tokens;
};

// Helper function to group consecutive cards
const groupConsecutiveCards = (cards: number[]): number[][] => {
  const sorted = cards.slice().sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const card of sorted) {
    const last = groups[groups.length - 1];
    if (last && card === last[last.length - 1] + 1) {
      last.push(card);
    } else {
      groups.push([card]);
    }
  }
  return groups;
};

/**
 * GamePage handles both the lobby (pre‑game) interface and the
 * gameplay interface. It uses the SocketContext to retrieve the
 * current game state and to send player actions to the server.
 */
const GamePage: React.FC = () => {
  const { socket, state, pass, take, startGame, updateSettings, transferHost, addBot, removeBot, error, clearError } = useSocket();
  const yourId = socket?.id;
  // 버튼 로딩 상태는 훅 규칙을 지키기 위해 컴포넌트 최상단에 선언
  const [starting, setStarting] = useState(false);
  const [chipAnim, setChipAnim] = useState(0);
  const [takeAnimKey, setTakeAnimKey] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [selectedBotDifficulty, setSelectedBotDifficulty] = useState<string>('medium');
  
  // 게임 설정 입력 검증 상태
  const [inputErrors, setInputErrors] = useState<{[key: string]: string}>({});
  const [inputValues, setInputValues] = useState<{[key: string]: string}>({});

  // 입력값 검증 함수
  const validateAndUpdate = (field: string, value: number, min: number, max: number, fieldName: string) => {
    let error = '';
    
    if (isNaN(value) || value < min || value > max) {
      error = `${fieldName}은(는) ${min}~${max} 범위 내에서 입력해주세요.`;
    }
    
    setInputErrors(prev => ({ ...prev, [field]: error }));
    
    if (!error) {
      updateSettings({ [field]: value });
    }
  };

  // +/- 버튼으로 값 조정
  const adjustValue = (field: string, currentValue: number, delta: number, min: number, max: number) => {
    const newValue = Math.max(min, Math.min(max, currentValue + delta));
    updateSettings({ [field]: newValue });
  };

  // 현재 설정을 가져옴 (서버에서 받은 설정 사용) - Hook 순서 보장을 위해 최상단에 선언
  const settings = state?.gameSettings;

  // Extract timer-related values for stable dependencies
  const gameStarted = state?.started;
  const turnStartTime = state?.turnStartTime;
  const turnTimeLimit = settings?.turnTimeLimit;

  // Memoize expensive calculations for all players - Hook 순서 보장을 위해 항상 실행
  const playerData = useMemo(() => {
    if (!state?.players) return [];
    return state.players.map(p => ({
      ...p,
      score: calculatePlayerScore(p.cards, p.tokens),
      cardGroups: groupConsecutiveCards(p.cards)
    }));
  }, [state?.players]);

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

  // 턴 타이머 카운트다운 관리
  useEffect(() => {
    if (!gameStarted || !settings || turnTimeLimit === 0) {
      setTimeLeft(0);
      return;
    }
    
    // 봇 턴이거나 타이머가 설정되지 않은 경우
    if (!turnStartTime) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - turnStartTime) / 1000);
      const remaining = Math.max(0, turnTimeLimit - elapsed);
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000); // 1초마다 업데이트

    return () => clearInterval(interval);
  }, [gameStarted, turnStartTime, turnTimeLimit, settings]);

  if (!state) {
    return (
      <div className="container">
        <div className="panel">서버에 연결 중…</div>
      </div>
    );
  }

  // Determine if you are the host
  const isHost = state.hostId === yourId;
  
  // 설정이 없는 경우 로딩 중이므로 대기
  if (!settings) {
    return (
      <div className="container">
        <div className="panel">설정을 불러오는 중...</div>
      </div>
    );
  }
  

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
              <div className="input-with-controls">
                <button
                  type="button"
                  className="btn sm input-control-btn"
                  onClick={() => adjustValue('removedCount', settings.removedCount, -1, 1, 32)}
                  disabled={!isHost || settings.removedCount <= 1}
                  aria-label="제거할 카드 수 감소"
                >
                  −
                </button>
                <input
                  id="removed"
                  type="number"
                  inputMode="numeric"
                  value={settings.removedCount}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (e.target.value === '') {
                      return; // 빈 값은 허용 (사용자가 입력 중)
                    }
                    validateAndUpdate('removedCount', value, 1, 32, '제거할 카드 수');
                  }}
                  onBlur={(e) => {
                    // 포커스 잃을 때 빈 값이면 기본값으로
                    if (e.target.value === '') {
                      updateSettings({ removedCount: 9 });
                    }
                  }}
                  aria-label="제거할 카드 수 (1–32)"
                  className={`input ${inputErrors.removedCount ? 'input-error' : ''}`}
                  disabled={!isHost}
                />
                <button
                  type="button"
                  className="btn sm input-control-btn"
                  onClick={() => adjustValue('removedCount', settings.removedCount, 1, 1, 32)}
                  disabled={!isHost || settings.removedCount >= 32}
                  aria-label="제거할 카드 수 증가"
                >
                  +
                </button>
              </div>
              {inputErrors.removedCount && (
                <div className="error-message">{inputErrors.removedCount}</div>
              )}
              <div className="help">3–35 중 무작위로 제거되는 카드 개수 (기본 9)</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="tokens">초기 토큰 수</label>
              <div className="input-with-controls">
                <button
                  type="button"
                  className="btn sm input-control-btn"
                  onClick={() => adjustValue('initialTokens', settings.initialTokens, -1, 1, 50)}
                  disabled={!isHost || settings.initialTokens <= 1}
                  aria-label="초기 토큰 수 감소"
                >
                  −
                </button>
                <input
                  id="tokens"
                  type="number"
                  inputMode="numeric"
                  value={settings.initialTokens}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (e.target.value === '') {
                      return; // 빈 값은 허용 (사용자가 입력 중)
                    }
                    validateAndUpdate('initialTokens', value, 1, 50, '초기 토큰 수');
                  }}
                  onBlur={(e) => {
                    // 포커스 잃을 때 빈 값이면 기본값으로
                    if (e.target.value === '') {
                      updateSettings({ initialTokens: 11 });
                    }
                  }}
                  aria-label="초기 토큰 수 (1–50)"
                  className={`input ${inputErrors.initialTokens ? 'input-error' : ''}`}
                  disabled={!isHost}
                />
                <button
                  type="button"
                  className="btn sm input-control-btn"
                  onClick={() => adjustValue('initialTokens', settings.initialTokens, 1, 1, 50)}
                  disabled={!isHost || settings.initialTokens >= 50}
                  aria-label="초기 토큰 수 증가"
                >
                  +
                </button>
              </div>
              {inputErrors.initialTokens && (
                <div className="error-message">{inputErrors.initialTokens}</div>
              )}
              <div className="help">각 플레이어가 시작 시 보유하는 토큰 수 (기본 11)</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="showTokens">상대 토큰 공개</label>
              <select 
                id="showTokens" 
                className="input" 
                value={settings.showOpponentTokens ? 'public' : 'private'} 
                onChange={(e) => updateSettings({ showOpponentTokens: e.target.value === 'public' })}
                disabled={!isHost}
              >
                <option value="public">공개</option>
                <option value="private">비공개</option>
              </select>
              <div className="help">상대 플레이어의 남은 칩 수를 공개/비공개로 설정</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="showScore">실시간 점수 표시</label>
              <select 
                id="showScore" 
                className="input" 
                value={settings.showRealTimeScore ? 'show' : 'hide'} 
                onChange={(e) => updateSettings({ showRealTimeScore: e.target.value === 'show' })}
                disabled={!isHost}
              >
                <option value="show">표시</option>
                <option value="hide">숨김</option>
              </select>
              <div className="help">게임 중 현재 점수를 실시간으로 표시</div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="turnLimit">턴 시간 제한</label>
              <select 
                id="turnLimit" 
                className="input" 
                value={settings.turnTimeLimit} 
                onChange={(e) => updateSettings({ turnTimeLimit: Number(e.target.value) })}
                disabled={!isHost}
              >
                <option value={0}>무제한</option>
                <option value={15}>15초</option>
                <option value={30}>30초</option>
                <option value={60}>60초</option>
              </select>
              <div className="help">각 턴의 시간 제한 (시간 초과 시 자동 행동)</div>
            </div>
          </div>
          {isHost && (
            <div className="controls" style={{ marginTop: 8 }}>
              <button
                className="btn primary"
                onClick={async () => {
                  if (starting) return;
                  setStarting(true);
                  const ok = await startGame();
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
        {isHost && state.players.length > 1 && (
          <div className="panel">
            <div className="title" style={{ fontSize: 16 }}>방장 양도</div>
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              {state.players.filter(p => p.id !== yourId && !p.isBot).map(p => (
                <button
                  key={p.id}
                  className="btn sm"
                  onClick={() => transferHost(p.id)}
                  aria-label={`${p.nickname}에게 방장 양도`}
                >
                  {p.nickname}에게 양도
                </button>
              ))}
            </div>
          </div>
        )}
        {isHost && (
          <div className="panel">
            <div className="title" style={{ fontSize: 16 }}>AI 봇 관리</div>
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              <select 
                className="input" 
                style={{ minWidth: 120 }}
                value={selectedBotDifficulty}
                onChange={(e) => setSelectedBotDifficulty(e.target.value)}
              >
                <option value="medium">중 (일반)</option>
                <option value="hard">상 (숙련)</option>
                <option value="expert">최상 (전문)</option>
              </select>
              <button
                className="btn sm"
                onClick={() => {
                  addBot(selectedBotDifficulty);
                }}
                disabled={state.players.length >= 7 || state.players.filter(p => p.isBot === true).length >= 3}
                aria-label="AI 봇 추가"
              >
                봇 추가
              </button>
            </div>
            {state.players.filter(p => p.isBot).length > 0 && (
              <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                {state.players.filter(p => p.isBot).map(p => (
                  <button
                    key={p.id}
                    className="btn sm"
                    style={{ backgroundColor: '#ff4444', color: 'white' }}
                    onClick={() => removeBot(p.id)}
                    aria-label={`${p.nickname} 제거`}
                  >
                    {p.nickname} 제거
                  </button>
                ))}
              </div>
            )}
            <div className="help" style={{ marginTop: 4, fontSize: '0.9em', opacity: 0.7 }}>
              최대 3개의 봇을 추가할 수 있습니다. 총 플레이어는 7명까지 가능합니다.
            </div>
          </div>
        )}
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
      <div className={`turn-banner ${isYourTurn ? 'is-you' : ''}`} role="status" aria-live="polite" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isYourTurn ? (
            <HiOutlineSparkles style={{ fontSize: '1.2em', color: 'var(--accent)' }} />
          ) : (
            <HiChevronRight style={{ fontSize: '1.2em', color: 'var(--muted)' }} />
          )}
          <strong>
            {isYourTurn ? '당신의 차례입니다' : currentPlayer ? `${currentPlayer.nickname} 님의 차례입니다` : '대기 중…'}
          </strong>
        </div>
        {settings.turnTimeLimit > 0 && state.turnStartTime && (
          <div className="timer" style={{ 
            fontSize: '0.9em', 
            fontWeight: '600', 
            opacity: 0.9, 
            color: timeLeft <= 5 ? '#ff4444' : timeLeft <= 10 ? '#ff8c00' : 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <HiOutlineClock />
            {timeLeft > 0 ? `${timeLeft}초` : '타임아웃'}
          </div>
        )}
      </div>
      <div className="row">
        <div className="panel">
          <div className="current-card">
            <div className={`card ${takeAnimKey ? 'take-lift' : ''}`} aria-label="현재 카드" key={`card-${state.currentCard}-${takeAnimKey}`} onAnimationEnd={() => setTakeAnimKey(0)}>
              <div className="value flip-in">{state.currentCard ?? '–'}</div>
              {chipAnim > 0 && <div className="chip-fly" onAnimationEnd={() => setChipAnim(0)} />}
            </div>
            <div className="pile-badge" aria-label={`카드 위 토큰 ${state.pileTokens}개`}>
              <RiCoinLine style={{ color: 'var(--chip)', fontSize: '1.2em' }} aria-hidden />
              <div style={{ color: 'var(--muted)' }}>+{state.pileTokens}</div>
            </div>
          </div>
          <div className="meta" style={{ marginTop: 10 }}>
            <span>덱 남은 카드: {state.deckSize}</span>
            <span>제거된 카드 수: {state.removedCount}</span>
          </div>
          <div className="controls" style={{ marginTop: 12 }}>
            <button 
              className="btn primary sm" 
              onClick={() => { 
                setTakeAnimKey((k)=>k+1); 
                take(); 
              }} 
              disabled={!isYourTurn} 
              aria-disabled={!isYourTurn} 
              aria-label="카드 가져오기"
              style={{ 
                background: isYourTurn 
                  ? 'linear-gradient(135deg, #0891b2, #0e7490)' 
                  : undefined,
                borderColor: isYourTurn ? '#0891b2' : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                justifyContent: 'center'
              }}
            >
              <HiPlay style={{ fontSize: '1.1em' }} />
              가져오기
            </button>
            <button 
              className="btn sm" 
              onClick={() => { 
                setChipAnim((k) => k + 1); 
                pass(); 
              }} 
              disabled={!isYourTurn} 
              aria-disabled={!isYourTurn} 
              aria-label="패스"
              style={{
                background: isYourTurn 
                  ? 'linear-gradient(135deg, #64748b, #475569)' 
                  : undefined,
                borderColor: isYourTurn ? '#64748b' : undefined,
                color: isYourTurn ? 'white' : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                justifyContent: 'center'
              }}
            >
              <HiOutlineXCircle style={{ fontSize: '1.1em' }} />
              패스
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="players" aria-label="플레이어 목록">
            {playerData.map((p) => {
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
                    <RiCoinLine style={{ color: 'var(--chip)', fontSize: '1.1em' }} aria-hidden />
                    <span>{(settings.showOpponentTokens || isYou) ? p.tokens : '?'}</span>
                    {settings.showRealTimeScore && (settings.showOpponentTokens || isYou) && (
                      <div className="score-display-mini" title="현재 점수" style={{ 
                        marginLeft: 8,
                        background: p.score <= 0 
                          ? 'linear-gradient(135deg, #10b981, #059669)' 
                          : p.score <= 20 
                          ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
                          : 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        fontSize: '0.75em',
                        fontWeight: '600',
                        minWidth: '24px',
                        textAlign: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}>
                        {p.score}
                      </div>
                    )}
                  </div>
                  {p.cards.length > 0 && (
                    <div className="my-cards" aria-label={isYou ? '내 카드' : `${p.nickname}님의 카드`}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {p.cardGroups.map((g, gi) => (
                          <div key={`g-${gi}`} className="card-group-box">
                            {g.map((c) => (<span key={`n-${gi}-${c}`} className="tag">{c}</span>))}
                          </div>
                        ))}
                      </div>
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