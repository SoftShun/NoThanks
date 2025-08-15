import React from 'react';
import { 
  HiTrophy, 
  HiArrowPath,
  HiStar,
  HiBolt,
  HiChevronRight,
  HiFire
} from 'react-icons/hi2';
import { RiCoinLine, RiMedalLine } from 'react-icons/ri';

interface ResultPageProps {
  results: Array<{ nickname: string; score: number; tokens: number; cards: number[]; rank: number }>;
  onRestart: () => void;
}

/**
 * 최신 디자인의 게임 결과 페이지 - 모바일 우선 미니멀 디자인
 * 승리자 강조, 성과 통계, 인터랙티브 요소 포함
 */
const ResultPage: React.FC<ResultPageProps> = ({ results, onRestart }) => {
  const winner = results[0];
  const totalPlayers = results.length;
  
  // 추가 통계 계산
  const getPerformanceLevel = (rank: number, totalPlayers: number) => {
    const ratio = rank / totalPlayers;
    if (ratio <= 0.2) return 'excellent';
    if (ratio <= 0.5) return 'good';
    if (ratio <= 0.8) return 'average';
    return 'poor';
  };

  const getPerformanceIcon = (level: string) => {
    switch (level) {
      case 'excellent': return HiFire;
      case 'good': return HiStar;
      case 'average': return HiBolt;
      default: return HiBolt; // 기본값도 HiBolt로 안전하게
    }
  };

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'excellent': return '#ef4444'; // 빨간색 (불꽃)
      case 'good': return '#10b981'; // 초록색 (좋음)
      case 'average': return '#f59e0b'; // 노란색 (평균)
      default: return '#6b7280'; // 회색 (아쉬움)
    }
  };

  return (
    <div className="result-container">
      {/* 승리 배너 */}
      <div className="winner-banner">
        <div className="winner-crown">
          <HiTrophy style={{ fontSize: '2.5rem', color: '#fbbf24' }} />
        </div>
        <h1 className="winner-title">
          🎉 {winner.nickname} 승리!
        </h1>
        <div className="winner-score">
          <HiStar style={{ fontSize: '1.2rem' }} />
          <span>최종 점수: {winner.score}점</span>
        </div>
      </div>

      {/* 순위표 */}
      <div className="results-panel">
        <div className="results-header">
          <h2>🏆 최종 순위</h2>
          <div className="results-subtitle">{totalPlayers}명 참여</div>
        </div>
        
        <div className="results-list">
          {results.map((player, index) => {
            const performanceLevel = getPerformanceLevel(player.rank, totalPlayers);
            const PerformanceIcon = getPerformanceIcon(performanceLevel);
            const performanceColor = getPerformanceColor(performanceLevel);
            
            return (
              <div 
                key={player.nickname} 
                className={`result-card ${player.rank === 1 ? 'winner-card' : ''}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* 순위 표시 */}
                <div className="rank-indicator">
                  {player.rank === 1 ? (
                    <div className="first-place">
                      <HiTrophy style={{ color: '#fbbf24', fontSize: '1.8rem' }} />
                    </div>
                  ) : player.rank === 2 ? (
                    <div className="second-place">
                      <RiMedalLine style={{ color: '#c0c0c0', fontSize: '1.5rem' }} />
                    </div>
                  ) : player.rank === 3 ? (
                    <div className="third-place">
                      <RiMedalLine style={{ color: '#cd7f32', fontSize: '1.5rem' }} />
                    </div>
                  ) : (
                    <div className="other-rank">
                      <span className="rank-number">{player.rank}</span>
                    </div>
                  )}
                </div>

                {/* 플레이어 정보 */}
                <div className="player-info">
                  <div className="player-name">
                    {player.nickname}
                    {player.rank === 1 && (
                      <span className="winner-badge">승리</span>
                    )}
                  </div>
                  
                  <div className="player-stats">
                    <div className="score-stat">
                      <span className="stat-label">점수</span>
                      <span className="stat-value score-value">{player.score}</span>
                    </div>
                    
                    <div className="token-stat">
                      <RiCoinLine style={{ color: 'var(--chip)' }} />
                      <span className="stat-value">{player.tokens}</span>
                    </div>
                    
                    <div className="performance-stat">
                      <PerformanceIcon style={{ color: performanceColor, fontSize: '1.1rem' }} />
                    </div>
                  </div>
                </div>

                {/* 획득 카드 */}
                {player.cards.length > 0 && (
                  <div className="player-cards">
                    <div className="cards-grid">
                      {player.cards
                        .sort((a, b) => a - b)
                        .slice(0, 8) // 최대 8개만 표시
                        .map((card) => (
                          <span key={card} className="result-card-tag">{card}</span>
                        ))}
                      {player.cards.length > 8 && (
                        <span className="more-cards">+{player.cards.length - 8}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 액션 버튼들 */}
      <div className="result-actions">
        <button 
          onClick={onRestart} 
          className="restart-btn"
          aria-label="다시 플레이"
        >
          <HiArrowPath style={{ fontSize: '1.2rem' }} />
          <span>다시 플레이</span>
          <HiChevronRight style={{ fontSize: '1rem', opacity: 0.7 }} />
        </button>
      </div>
    </div>
  );
};

export default ResultPage;