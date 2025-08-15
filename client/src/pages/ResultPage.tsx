import React from 'react';
import { 
  HiTrophy, 
  HiArrowPath,
  HiMiniSparkles
} from 'react-icons/hi2';
import { RiCoinLine, RiMedalLine } from 'react-icons/ri';

interface ResultPageProps {
  results: Array<{ nickname: string; score: number; tokens: number; cards: number[]; rank: number }>;
  onRestart: () => void;
}

/**
 * Displays the final results of a game. Shows each player's rank,
 * nickname, score, tokens and card list. Provides a button to
 * restart the game by clearing the results state in the parent
 * component.
 */
const ResultPage: React.FC<ResultPageProps> = ({ results, onRestart }) => {
  return (
    <div className="container">
      <div className="header">
        <div className="title" role="heading" aria-level={2} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HiTrophy style={{ color: '#fbbf24' }} />
          게임 결과
        </div>
      </div>
      <div className="panel">
        <div className="players" role="table" aria-label="결과 표">
          {results.map((res) => (
            <div key={res.nickname} className="player" role="row">
              <div className="name" role="columnheader" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {res.rank === 1 ? (
                    <HiTrophy style={{ color: '#fbbf24', fontSize: '1.2em' }} />
                  ) : res.rank <= 3 ? (
                    <RiMedalLine style={{ color: res.rank === 2 ? '#9ca3af' : '#d97706', fontSize: '1.2em' }} />
                  ) : (
                    <span style={{ fontSize: '1.1em', fontWeight: 'bold', color: 'var(--muted)', minWidth: '20px' }}>{res.rank}.</span>
                  )}
                  <span style={{ fontWeight: res.rank <= 3 ? '700' : '600' }}>{res.nickname}</span>
                </div>
                <div className="score-display" style={{
                  background: res.rank === 1 
                    ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' 
                    : 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                  color: res.rank === 1 ? 'white' : 'var(--text)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.9em',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <HiMiniSparkles style={{ fontSize: '0.9em' }} />
                  {res.score}
                </div>
              </div>
              <div className="tokens" style={{ marginTop: 6 }}>
                <RiCoinLine style={{ color: 'var(--chip)', fontSize: '1.1em' }} aria-hidden />
                <span>{res.tokens}</span>
              </div>
              {res.cards.length > 0 && (
                <div className="my-cards" aria-label="획득 카드">
                  {res.cards.sort((a, b) => a - b).map((c) => (
                    <span key={c} className="tag">{c}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="controls" style={{ marginTop: 8 }}>
          <button 
            onClick={onRestart} 
            className="btn primary" 
            aria-label="다시 플레이"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              justifyContent: 'center',
              width: '100%'
            }}
          >
            <HiArrowPath style={{ fontSize: '1.1em' }} />
            다시 플레이
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultPage;