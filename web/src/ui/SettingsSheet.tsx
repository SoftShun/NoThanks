import { useStore } from '../app/store';
import { LATENCY_OPTIONS } from '../app/config';
import { hapticsSupported } from '../fx/haptics';
import { SFX_LIST, sfx, unlockAudio } from '../fx/sound';

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="설정" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>설정</h3>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <div className="field">
          <span className="field-label">목 서버 지연 (왕복)</span>
          <div className="seg">
            {LATENCY_OPTIONS.map((l) => (
              <button key={l} className={prefs.latency === l ? 'on' : ''} onClick={() => setPrefs({ latency: l })}>
                {l}ms
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">모션</span>
          <div className="seg">
            {(['system', 'full', 'reduce'] as const).map((m) => (
              <button key={m} className={prefs.motion === m ? 'on' : ''} onClick={() => setPrefs({ motion: m })}>
                {m === 'system' ? '시스템' : m === 'full' ? '전체' : '줄이기'}
              </button>
            ))}
          </div>
        </div>
        <label className="toggle">
          <span>효과음</span>
          <input type="checkbox" role="switch" checked={prefs.sound} onChange={(e) => setPrefs({ sound: e.target.checked })} />
          <span className="switch" aria-hidden />
        </label>
        <label className="toggle">
          <span>햅틱 {hapticsSupported() ? '' : '(이 기기 미지원)'}</span>
          <input type="checkbox" role="switch" checked={prefs.haptics} onChange={(e) => setPrefs({ haptics: e.target.checked })} />
          <span className="switch" aria-hidden />
        </label>
        <label className="toggle">
          <span>성능 표시 (FPS·입력 반응)</span>
          <input type="checkbox" role="switch" checked={prefs.showStats} onChange={(e) => setPrefs({ showStats: e.target.checked })} />
          <span className="switch" aria-hidden />
        </label>
        <div className="field">
          <span className="field-label">효과음 미리 듣기 (임시음)</span>
          <div className="sfx-grid">
            {SFX_LIST.map((k) => (
              <button
                key={k}
                className="mini-btn"
                onClick={() => {
                  unlockAudio();
                  sfx(k);
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
