import { useState } from 'react';
import { useStore } from '../app/store';
import { session } from '../app/session';
import { GAME_SUBTITLE, GAME_TITLE, LATENCY_OPTIONS, type LayoutMode } from '../app/config';
import { DIFFICULTY_LABEL } from '../engine/bot';
import { MAX_BOTS, MAX_PLAYERS, type Difficulty, type GameSettings } from '../engine/types';
import { unlockAudio, sfx } from '../fx/sound';

export function Lobby({ mode, onOpenSettings }: { mode: LayoutMode; onOpenSettings: () => void }) {
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.sessionId);
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const [diff, setDiff] = useState<Difficulty>('hard');
  const [nick, setNick] = useState<string | null>(null);
  if (!room) return null;
  const isHost = room.hostId === me;
  const s = room.settings;
  const bots = room.players.filter((p) => p.isBot);
  const canAddBot = isHost && bots.length < MAX_BOTS && room.players.length < MAX_PLAYERS;
  const upd = (p: Partial<GameSettings>) => {
    unlockAudio();
    sfx('tap', { volume: 0.6 });
    session.updateSettings(p);
  };
  const myNick = room.players.find((p) => p.id === me)?.nickname ?? '';

  return (
    <div className={`lobby lobby-${mode}`}>
      <header className="lobby-head">
        <div className="logo">
          <span className="brand-coin big" aria-hidden />
          <div>
            <h1>{GAME_TITLE}</h1>
            <p className="muted">{GAME_SUBTITLE}</p>
          </div>
        </div>
        {mode === 'landscape' && (
          <button className="btn primary head-start" disabled={!isHost} onClick={() => session.start()}>
            게임 시작
          </button>
        )}
        <button className="icon-btn" onClick={onOpenSettings} aria-label="설정 열기">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
            <path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
          </svg>
        </button>
      </header>

      <div className="lobby-grid">
        <section className="card-panel">
          <h3>
            참가자 <span className="muted">{room.players.length}/{MAX_PLAYERS}</span>
          </h3>
          <ul className="roster">
            {room.players.map((p) => (
              <li key={p.id} className={p.id === me ? 'me' : ''}>
                <span className={`avatar ${p.isBot ? 'bot' : ''}`}>{p.isBot ? 'AI' : p.nickname.slice(0, 1)}</span>
                {p.id === me ? (
                  <input
                    className="nick-input"
                    value={nick ?? myNick}
                    maxLength={20}
                    aria-label="내 닉네임"
                    onChange={(e) => setNick(e.target.value)}
                    onBlur={() => {
                      if (nick && nick.trim() && nick !== myNick) {
                        session.setNickname(nick.trim());
                        localStorage.setItem('nt-nick', nick.trim());
                      }
                      setNick(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <span className="roster-name">{p.nickname}</span>
                )}
                {room.hostId === p.id && <span className="tag">방장</span>}
                {p.isBot && isHost && (
                  <button className="mini-btn" onClick={() => session.removeBot(p.id)} aria-label={`${p.nickname} 제거`}>
                    제거
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isHost && (
            <div className="bot-add">
              <div className="seg" role="radiogroup" aria-label="봇 난이도">
                {(['medium', 'hard', 'expert'] as Difficulty[]).map((d) => (
                  <button key={d} role="radio" aria-checked={diff === d} className={diff === d ? 'on' : ''} onClick={() => setDiff(d)}>
                    {DIFFICULTY_LABEL[d]}
                  </button>
                ))}
              </div>
              <button className="btn" disabled={!canAddBot} onClick={() => session.addBot(diff)}>
                + 봇 추가
              </button>
            </div>
          )}
          <p className="muted small">봇은 최대 {MAX_BOTS}개, 전체 {MAX_PLAYERS}명까지. (master 규칙)</p>
        </section>

        <section className="card-panel">
          <h3>게임 설정 {!isHost && <span className="muted">(방장만 변경)</span>}</h3>
          <Stepper label="제외할 카드 수" value={s.removedCount} min={1} max={32} def={9} disabled={!isHost} onChange={(v) => upd({ removedCount: v })} />
          <Stepper label="시작 칩" value={s.initialTokens} min={1} max={50} def={11} disabled={!isHost} onChange={(v) => upd({ initialTokens: v })} />
          <Field label="턴 시간 제한">
            <div className="seg">
              {[0, 15, 30, 60].map((t) => (
                <button key={t} className={s.turnTimeLimit === t ? 'on' : ''} disabled={!isHost} onClick={() => upd({ turnTimeLimit: t })}>
                  {t ? `${t}초` : '없음'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="모드">
            <div className="seg">
              <button className={s.gameMode === 'normal' ? 'on' : ''} disabled={!isHost} onClick={() => upd({ gameMode: 'normal' })}>
                일반
              </button>
              <button className={s.gameMode === 'hidden' ? 'on' : ''} disabled={!isHost} onClick={() => upd({ gameMode: 'hidden' })}>
                히든
              </button>
            </div>
          </Field>
          {s.gameMode === 'hidden' && (
            <Stepper label="히든 카드 수" value={s.hiddenCardCount} min={1} max={5} def={3} disabled={!isHost} onChange={(v) => upd({ hiddenCardCount: v })} />
          )}
          <Toggle label="상대 칩 공개" checked={s.showOpponentTokens} disabled={!isHost} onChange={(v) => upd({ showOpponentTokens: v })} />
          <Toggle label="실시간 점수 표시" checked={s.showRealTimeScore} disabled={!isHost} onChange={(v) => upd({ showRealTimeScore: v })} />
        </section>

        <section className="card-panel">
          <h3>프로토타입 옵션</h3>
          <Field label="목 서버 지연 (왕복)">
            <div className="seg" role="radiogroup" aria-label="지연">
              {LATENCY_OPTIONS.map((l) => (
                <button key={l} role="radio" aria-checked={prefs.latency === l} className={prefs.latency === l ? 'on' : ''} onClick={() => setPrefs({ latency: l })}>
                  {l}ms
                </button>
              ))}
            </div>
          </Field>
          <Field label="봇 생각 속도">
            <div className="seg">
              {([1, 0.5, 0.25] as const).map((v) => (
                <button key={v} className={prefs.botSpeed === v ? 'on' : ''} onClick={() => setPrefs({ botSpeed: v })}>
                  {v === 1 ? '원본' : v === 0.5 ? '×2' : '×4'}
                </button>
              ))}
            </div>
          </Field>
          <div className="rules-mini">
            <h4>규칙 한눈에</h4>
            <ul>
              <li>카드 3~35 중 일부를 몰래 빼고 시작합니다.</li>
              <li>내 차례: <b>칩 1개를 걸고 넘기기</b> 또는 <b>카드와 쌓인 칩 가져가기</b>.</li>
              <li>가져가면 다음 카드도 내가 먼저 결정합니다.</li>
              <li>연속된 숫자는 가장 낮은 카드만 점수. 점수 = 카드 − 칩, <b>낮을수록 승리</b>.</li>
            </ul>
          </div>
        </section>
      </div>

      {mode !== 'landscape' && (
      <footer className="lobby-foot">
        <button
          className="btn primary big"
          disabled={!isHost}
          onClick={() => {
            unlockAudio();
            session.start();
          }}
        >
          게임 시작
        </button>
      </footer>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
    </div>
  );
}

function Stepper(props: { label: string; value: number; min: number; max: number; def: number; disabled?: boolean; onChange: (v: number) => void }) {
  const { label, value, min, max, def, disabled, onChange } = props;
  return (
    <Field label={label}>
      <div className="stepper">
        <button aria-label={`${label} 줄이기`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <output aria-live="polite">{value}</output>
        <button aria-label={`${label} 늘리기`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
        {value !== def && !disabled && (
          <button className="reset" onClick={() => onChange(def)} aria-label={`${label} 기본값`}>
            기본 {def}
          </button>
        )}
      </div>
    </Field>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
    </label>
  );
}
