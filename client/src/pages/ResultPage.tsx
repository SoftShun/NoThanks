import React from 'react';

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
        <div className="title" role="heading" aria-level={2}>게임 결과</div>
      </div>
      <div className="panel">
        <div className="players" role="table" aria-label="결과 표">
          {results.map((res) => (
            <div key={res.nickname} className="player" role="row">
              <div className="name" role="columnheader">
                <span>{res.rank}. {res.nickname}</span>
                <span className="badge">점수 {res.score}</span>
              </div>
              <div className="tokens" style={{ marginTop: 6 }}>
                <div className="chip" aria-hidden>●</div>
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
          <button onClick={onRestart} className="btn primary" aria-label="다시 플레이">다시 플레이</button>
        </div>
      </div>
    </div>
  );
};

export default ResultPage;