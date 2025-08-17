/*
 * Entry point for the No Thanks! game server.
 *
 * This server uses Express to serve a minimal health check and
 * Socket.io for real‑time communication between clients. A single
 * instance of the Game class maintains the state of one game. Since
 * this project is intended for a small group of friends, multiple
 * rooms or games are not supported; all connected players join the
 * same game.
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const Game = require('./game');
const CryptoRandom = require('./crypto-random');
const path = require('path');

// Create the Express app and HTTP server
const app = express();
app.use(cors());
const server = http.createServer(app);

// Initialise Socket.io with CORS disabled for simplicity (only for dev)
const io = new Server(server, {
  transports: ['websocket'],
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Create a single game instance
const game = new Game();

// 턴 시간 초과 처리 함수
function handleTurnTimeout(playerId) {
  // 토큰이 있으면 자동 패스, 없으면 자동으로 카드 가져가기
  const player = game.players.find(p => p.id === playerId);
  if (!player) return;
  
  let result;
  if (player.tokens > 0) {
    result = game.pass(playerId);
  } else {
    result = game.takeCard(playerId);
  }
  
  if (result && result.gameOver) {
    const scores = game.calculateScores();
    handleGameEnd(scores);
    return;
  }
  
  // 다음 턴 타이머 시작
  startNextTurn();
}

// 봇 자동 플레이 처리
function handleBotTurn() {
  const currentPlayer = game.players[game.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.isBot) return;

  // 봇에게 딜레이 부여 (난이도별 차별화)
  let baseDelay = 800;   // 중급: 0.8초 기본 (인간다운 사고시간)
  let randomDelay = 2000; // 중급: +0~2초 랜덤
  
  // 난이도별 사고 시간 차별화
  if (currentPlayer.difficulty === 'expert') {
    baseDelay = 1000;   // 최상급: 1초 기본 (더 많이 고민)
    randomDelay = 3500; // 최상급: +0~3.5초 랜덤
  } else if (currentPlayer.difficulty === 'hard') {
    baseDelay = 900;    // 상급: 0.9초 기본
    randomDelay = 2800; // 상급: +0~2.8초 랜덤
  }
  
  const delay = baseDelay + CryptoRandom.enhancedRandom() * randomDelay;
  
  setTimeout(() => {
    // 게임이 끝났거나 턴이 바뀌었으면 중단
    if (!game.started || game.players[game.currentPlayerIndex]?.id !== currentPlayer.id) return;

    // 봇 의사결정
    const action = currentPlayer.makeDecision(game.getState());
    
    let result;
    if (action === 'take') {
      const cardTaken = game.currentCard;
      const tokensTaken = game.pileTokens;
      result = game.takeCard(currentPlayer.id);
      
      // 히든 카드 공개 단계인 경우
      if (result.needsDelay && result.isHiddenRevealed) {
        // 카드 공개 후 상태 브로드캐스트
        broadcastState();
        
        // 1초 후 실제로 카드 가져가기 실행
        setTimeout(() => {
          const finalResult = game.takeCard(currentPlayer.id);
          
          if (finalResult && !finalResult.error) {
            // AI가 카드를 가져갔을 때 다른 AI들에게 이벤트 알림
            notifyBotsOfCardTaken(currentPlayer, cardTaken, tokensTaken);
            notifyBotsOfPlayerAction(currentPlayer.id, 'take', cardTaken, tokensTaken);
            
            if (finalResult.gameOver) {
              const scores = game.calculateScores();
              handleGameEnd(scores);
              return;
            }
            
            startNextTurn();
          }
        }, 1000);
        return;
      }
      
      // 일반 카드 또는 이미 공개된 히든 카드인 경우
      notifyBotsOfCardTaken(currentPlayer, cardTaken, tokensTaken);
      notifyBotsOfPlayerAction(currentPlayer.id, 'take', cardTaken, tokensTaken);
    } else {
      const cardPassed = game.currentCard;
      const tokensOnCard = game.pileTokens;
      result = game.pass(currentPlayer.id);
      
      // 모든 봇들이 이 행동을 관찰하도록 업데이트
      notifyBotsOfPlayerAction(currentPlayer.id, 'pass', cardPassed, tokensOnCard);
    }

    if (result && result.gameOver) {
      const scores = game.calculateScores();
      handleGameEnd(scores);
      return;
    }

    startNextTurn();
  }, delay);
}

// 다음 턴 시작
function startNextTurn() {
  // 현재 턴 플레이어가 봇인지 확인
  const currentPlayer = game.players[game.currentPlayerIndex];
  if (currentPlayer && currentPlayer.isBot) {
    // 봇 턴에서는 타이머 없음
    game.turnStartTime = null;
    broadcastState();
    handleBotTurn();
  } else {
    // 인간 플레이어 턴에서는 타이머 시작
    game.startTurnTimer(handleTurnTimeout);
    broadcastState();
  }
}

/**
 * AI 봇들에게 카드 취득 이벤트 알림
 */
function notifyBotsOfCardTaken(takerBot, cardNumber, tokensGained) {
  game.players.forEach(player => {
    if (player.isBot && player.id !== takerBot.id) {
      // 다른 AI 봇들이 이 카드를 원했는지 확인
      const wouldWantCard = player.wouldPlayerWantCard ? 
        player.wouldPlayerWantCard(takerBot, cardNumber) : 
        player.cards.some(card => Math.abs(card - cardNumber) <= 2);
      
      if (wouldWantCard) {
        // 내가 원하던 카드를 다른 봇이 가져갔을 때 감정 반응
        player.reactToEvent('someone_took_my_card', {
          playerId: takerBot.id,
          playerName: takerBot.nickname,
          card: cardNumber,
          tokens: tokensGained
        });
      }
    }
  });
}

/**
 * AI 봇들에게 순위 변동 알림
 */
function notifyBotsOfRankingChange() {
  if (!game.started) return;
  
  // 현재 순위 계산
  const currentRankings = game.players.map(p => ({
    id: p.id,
    nickname: p.nickname,
    score: calculatePlayerScore(p),
    isBot: p.isBot
  })).sort((a, b) => a.score - b.score);
  
  // 각 봇에게 순위 변동 알림
  game.players.forEach(player => {
    if (!player.isBot) return;
    
    const myRank = currentRankings.findIndex(r => r.id === player.id) + 1;
    const isLeading = myRank === 1;
    const wasOvertaken = myRank > 1 && currentRankings.slice(0, myRank - 1).some(r => !r.isBot);
    
    if (wasOvertaken) {
      player.reactToEvent('got_overtaken', { 
        currentRank: myRank,
        totalPlayers: currentRankings.length
      });
    } else if (isLeading && CryptoRandom.enhancedRandom() < 0.3) {
      player.reactToEvent('winning_streak', {
        currentRank: myRank
      });
    }
  });
}

/**
 * 플레이어 점수 계산 헬퍼
 */
function calculatePlayerScore(player) {
  if (!player.cards || player.cards.length === 0) return 0;
  
  const sorted = [...player.cards].sort((a, b) => a - b);
  let sum = 0;
  let prev = null;
  
  sorted.forEach((card) => {
    if (prev == null || card !== prev + 1) {
      sum += card;
    }
    prev = card;
  });
  
  return sum - player.tokens;
}

/**
 * 모든 봇들에게 플레이어 행동 관찰 알림
 */
function notifyBotsOfPlayerAction(playerId, action, card, tokens) {
  game.players.forEach(bot => {
    if (bot.isBot && bot.id !== playerId && bot.observePlayerAction) {
      bot.observePlayerAction(playerId, action, card, tokens);
    }
  });
}

/**
 * AI 봇들의 연속 실패/성공 체크
 */
function checkBotsConsecutiveResults() {
  game.players.forEach(player => {
    if (!player.isBot || !player.gameEvents) return;
    
    const recentDecisions = player.gameEvents.slice(-3);
    if (recentDecisions.length >= 3) {
      const allBadDeals = recentDecisions.every(event => 
        event.type === 'decision' && event.myDecision === 'take' && 
        (event.tokens || 0) < event.card * 0.3
      );
      
      if (allBadDeals) {
        player.reactToEvent('consecutive_bad_cards', {
          recentCards: recentDecisions.map(e => e.card)
        });
      }
    }
  });
}

/**
 * Helper function to broadcast the current game state to all
 * connected clients.
 */
function broadcastState() {
    const state = game.getState();
    io.emit('gameState', state);
    
    // 상태 브로드캐스트 후 AI 봇들에게 순위 변동 알림
    if (game.started) {
      notifyBotsOfRankingChange();
      checkBotsConsecutiveResults();
    }
}

/**
 * 게임 종료 후 처리 및 상태 확인
 */
function handleGameEnd(results, cancelled = false, reason = null) {
  // 게임 종료 이벤트 발송
  if (cancelled) {
    io.emit('gameEnd', { results, cancelled, reason });
  } else {
    io.emit('gameEnd', { results });
  }
  
  // 소프트 리셋 (AI봇 제거)
  game.softReset();
  
  // 인간 플레이어가 없으면 완전 초기화
  if (!game.hasHumanPlayers()) {
    console.log('No human players remain, performing full reset');
    game.reset(); // 완전 초기화
  }
  
  broadcastState();
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send initial state on connection
  socket.emit('gameState', game.getState());

  // Heartbeat ping to keep WS stable (prevent some proxies from dropping idle connections)
  const ping = setInterval(() => {
    try { socket.emit('ping'); } catch {}
  }, 25000);

  /**
   * Client requests to join the game. Payload should contain a
   * nickname. If successful, the player is added; otherwise an
   * error event is emitted.
   */
  socket.on('join', ({ nickname }) => {
    if (typeof nickname !== 'string' || nickname.trim().length === 0) {
      socket.emit('gameError', { message: 'Invalid nickname' });
      return;
    }
    const ok = game.addPlayer(socket.id, nickname.trim());
    if (!ok) {
      socket.emit('gameError', { message: 'Unable to join game (already started, full, or duplicate nickname)' });
      return;
    }
    broadcastState();
  });

  /**
   * Host starts the game. Only the host may start the game.
   */
  socket.on('start', (_, ack) => {
    if (socket.id !== game.hostId) {
      socket.emit('gameError', { message: 'Only the host can start the game' });
      if (typeof ack === 'function') ack({ ok: false, error: 'Only the host can start the game' });
      return;
    }
    if (game.started) {
      socket.emit('gameError', { message: 'Game already started' });
      if (typeof ack === 'function') ack({ ok: false, error: 'Game already started' });
      return;
    }
    
    // 인간 플레이어가 있는지 확인
    if (!game.hasHumanPlayers()) {
      socket.emit('gameError', { message: 'At least one human player is required to start the game' });
      if (typeof ack === 'function') ack({ ok: false, error: 'At least one human player is required to start the game' });
      return;
    }
    
    const success = game.start();
    if (!success) {
      socket.emit('gameError', { message: 'Failed to start the game' });
      if (typeof ack === 'function') ack({ ok: false, error: 'Failed to start the game' });
      return;
    }
    
    // 게임 시작 시 첫 턴 시작
    startNextTurn();
    if (typeof ack === 'function') ack({ ok: true });
  });

  /**
   * Player chooses to pass (pay a token) on their turn. The server
   * will automatically convert this to a take action if the player
   * has no tokens.
   */
  socket.on('pass', () => {
    const cardPassed = game.currentCard;
    const tokensOnCard = game.pileTokens;
    const result = game.pass(socket.id);
    if (result && result.error) {
      socket.emit('gameError', { message: result.error });
      // UX: notifies specific player about insufficient tokens to pass
      if (result.error.includes('Not your turn') === false && result.error.includes('Game not started') === false) {
        socket.emit('toast', { message: '칩이 부족해 패스할 수 없습니다.' });
      }
      return;
    }
    
    // 봇들이 인간 플레이어의 패스 행동을 관찰하도록 업데이트
    notifyBotsOfPlayerAction(socket.id, 'pass', cardPassed, tokensOnCard);
    
    if (result.gameOver) {
      const scores = game.calculateScores();
      handleGameEnd(scores);
      return;
    }
    
    // 다음 턴 시작
    startNextTurn();
  });

  /**
   * Player chooses to take the current card on their turn.
   */
  socket.on('take', () => {
    const takenCard = game.currentCard;
    const takenTokens = game.pileTokens;
    const result = game.takeCard(socket.id);
    
    if (result && result.error) {
      socket.emit('gameError', { message: result.error });
      return;
    }
    
    // 히든 카드 공개 단계인 경우
    if (result.needsDelay && result.isHiddenRevealed) {
      // 카드 공개 후 상태 브로드캐스트
      broadcastState();
      
      // 1초 후 실제로 카드 가져가기 실행
      setTimeout(() => {
        const finalResult = game.takeCard(socket.id);
        
        if (finalResult && finalResult.error) {
          socket.emit('gameError', { message: finalResult.error });
          return;
        }
        
        // 인간 플레이어가 카드를 가져갔을 때 AI들에게 알림
        const humanPlayer = game.players.find(p => p.id === socket.id);
        if (humanPlayer && !humanPlayer.isBot) {
          notifyBotsOfCardTaken(humanPlayer, takenCard, takenTokens);
          notifyBotsOfPlayerAction(socket.id, 'take', takenCard, takenTokens);
        }
        
        if (finalResult.gameOver) {
          const scores = game.calculateScores();
          handleGameEnd(scores);
          return;
        }
        
        startNextTurn();
      }, 1000);
      return;
    }
    
    // 일반 카드 또는 이미 공개된 히든 카드인 경우
    const humanPlayer = game.players.find(p => p.id === socket.id);
    if (humanPlayer && !humanPlayer.isBot) {
      notifyBotsOfCardTaken(humanPlayer, takenCard, takenTokens);
      notifyBotsOfPlayerAction(socket.id, 'take', takenCard, takenTokens);
    }
    
    if (result.gameOver) {
      const scores = game.calculateScores();
      handleGameEnd(scores);
      return;
    }
    
    startNextTurn();
  });

  /**
   * 설정 업데이트 (방장만 가능)
   */
  socket.on('updateSettings', (newSettings) => {
    // 입력 유효성 검증
    if (!newSettings || typeof newSettings !== 'object') {
      socket.emit('gameError', { message: '잘못된 설정 데이터입니다.' });
      return;
    }
    
    if (socket.id !== game.hostId) {
      socket.emit('gameError', { message: '방장만 설정을 변경할 수 있습니다.' });
      return;
    }
    
    const success = game.updateSettings(newSettings);
    if (!success) {
      socket.emit('gameError', { message: '게임이 진행 중일 때는 설정을 변경할 수 없습니다.' });
      return;
    }
    
    broadcastState();
  });

  /**
   * 방장 양도
   */
  socket.on('transferHost', (newHostId) => {
    const success = game.transferHost(socket.id, newHostId);
    if (!success) {
      socket.emit('gameError', { message: '방장 양도에 실패했습니다.' });
      return;
    }
    
    broadcastState();
  });

  /**
   * AI 봇 추가 (방장만 가능)
   */
  socket.on('addBot', (difficulty) => {
    // 입력 유효성 검증
    if (typeof difficulty !== 'string' || !['medium', 'hard', 'expert'].includes(difficulty)) {
      socket.emit('gameError', { message: '잘못된 봇 난이도입니다.' });
      return;
    }
    
    if (!game.hostId || socket.id !== game.hostId) {
      socket.emit('gameError', { message: '방장만 봇을 추가할 수 있습니다.' });
      return;
    }
    
    const success = game.addBot(difficulty);
    if (!success) {
      socket.emit('gameError', { message: '봇을 추가할 수 없습니다. (최대 3개, 총 인원 7명 제한)' });
      return;
    }
    
    broadcastState();
  });

  /**
   * AI 봇 제거 (방장만 가능)
   */
  socket.on('removeBot', (botId) => {
    if (!game.hostId || socket.id !== game.hostId) {
      socket.emit('gameError', { message: '방장만 봇을 제거할 수 있습니다.' });
      return;
    }
    
    const success = game.removeBot(botId);
    if (!success) {
      socket.emit('gameError', { message: '봇을 제거할 수 없습니다.' });
      return;
    }
    
    broadcastState();
  });

  /**
   * 닉네임 변경
   */
  socket.on('changeNickname', (newNickname) => {
    const result = game.changeNickname(socket.id, newNickname);
    if (!result.success) {
      socket.emit('gameError', { message: result.error });
      return;
    }
    
    broadcastState();
  });

  /**
   * Handle a player disconnecting. Remove them from the game and
   * broadcast the updated state. If only one player remains after
   * the disconnect, the game ends immediately. If only AI bots remain,
   * the game is automatically cancelled.
   */
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(ping);
    // Remove the player
    game.removePlayer(socket.id);
    
    // 인간 플레이어가 없으면 모든 AI 봇 제거
    const humanPlayers = game.players.filter(p => !p.isBot);
    if (humanPlayers.length === 0 && game.players.length > 0) {
      console.log('No human players remain, removing all AI bots');
      if (game.started) {
        // 게임 중이면 게임 취소
        handleGameEnd([], true, 'AI 봇만 남아 게임이 취소되었습니다.');
      } else {
        // 대기실이면 완전 초기화
        game.reset();
        broadcastState();
      }
      return;
    }
    
    if (game.started) {
      // 기존 로직: 2명 미만 남은 경우 게임 종료
      if (game.players.length < 2) {
        const scores = game.calculateScores();
        handleGameEnd(scores);
        return;
      }
    }
    
    broadcastState();
  });
});

// Provide a simple health check endpoint
app.get('/', (req, res) => {
  res.json({ ok: true, players: game.players.length, started: game.started });
});

// Serve static files from the client build if it exists. When the React
// app is built (via `npm run build` in the client folder), the
// generated files reside in ../client/dist. Hosting them here allows
// the server to serve both the API and the front‑end from the same
// origin.
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));
// For any other request, return the built index.html so that React
// Router (if used) can handle the routing. This will fallback only
// if the file exists; otherwise no harm is done when running in dev.
app.get('*', (req, res, next) => {
  const indexFile = path.join(clientBuildPath, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) next();
  });
});

// Start listening
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});