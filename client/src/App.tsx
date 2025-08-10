import React, { useState } from 'react';
import JoinPage from './pages/JoinPage';
import GamePage from './pages/GamePage';
import ResultPage from './pages/ResultPage';

import { SocketProvider } from './contexts/SocketContext';

/**
 * Main application component. Handles high‑level routing between
 * join/lobby, game, and result screens. SocketProvider supplies the
 * socket and game state to child components.
 */
const App: React.FC = () => {
  const [nickname, setNickname] = useState<string | null>(null);
  const [results, setResults] = useState<any[] | null>(null);

  // When the game ends, we receive final results from the context
  const handleGameEnd = (res: any[]) => {
    setResults(res);
  };

  if (results) {
    return <ResultPage results={results} onRestart={() => { setResults(null); setNickname(null); }} />;
  }

  // If no nickname, show join page
  if (!nickname) {
    return <JoinPage onJoin={(name) => setNickname(name)} />;
  }

  // Otherwise show the game inside the SocketProvider
  return (
    <SocketProvider nickname={nickname} onGameEnd={handleGameEnd}>
      <GamePage />
    </SocketProvider>
  );
};

export default App;