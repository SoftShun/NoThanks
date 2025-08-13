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
    io.emit('gameEnd', { results: scores });
    game.softReset();
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
  let baseDelay = 500;  // 중급: 0.5초 기본
  let randomDelay = 2000; // 중급: +0~2초 랜덤
  
  // 난이도별 사고 시간 차별화
  if (currentPlayer.difficulty === 'expert') {
    baseDelay = 500;   // 최상급: 0.5초 기본
    randomDelay = 3000; // 최상급: +0~3초 랜덤
  } else if (currentPlayer.difficulty === 'hard') {
    baseDelay = 500;   // 상급: 0.5초 기본
    randomDelay = 2500; // 상급: +0~2.5초 랜덤
  }
  
  const delay = baseDelay + Math.random() * randomDelay;
  
  setTimeout(() => {
    // 게임이 끝났거나 턴이 바뀌었으면 중단
    if (!game.started || game.players[game.currentPlayerIndex]?.id !== currentPlayer.id) return;

    // 봇 의사결정
    const action = currentPlayer.makeDecision(game.getState());
    
    let result;
    if (action === 'take') {
      result = game.takeCard(currentPlayer.id);
    } else {
      result = game.pass(currentPlayer.id);
    }

    if (result && result.gameOver) {
      const scores = game.calculateScores();
      io.emit('gameEnd', { results: scores });
      game.softReset();
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
 * Helper function to broadcast the current game state to all
 * connected clients.
 */
function broadcastState() {
    const state = game.getState();
    io.emit('gameState', state);
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
    const result = game.pass(socket.id);
    if (result && result.error) {
      socket.emit('gameError', { message: result.error });
      // UX: notifies specific player about insufficient tokens to pass
      if (result.error.includes('Not your turn') === false && result.error.includes('Game not started') === false) {
        socket.emit('toast', { message: '칩이 부족해 패스할 수 없습니다.' });
      }
      return;
    }
    if (result.gameOver) {
      const scores = game.calculateScores();
      io.emit('gameEnd', { results: scores });
      game.softReset(); // 소프트 리셋으로 변경
      return;
    }
    
    // 다음 턴 시작
    startNextTurn();
  });

  /**
   * Player chooses to take the current card on their turn.
   */
  socket.on('take', () => {
    const result = game.takeCard(socket.id);
    if (result && result.error) {
      socket.emit('gameError', { message: result.error });
      return;
    }
    if (result.gameOver) {
      const scores = game.calculateScores();
      io.emit('gameEnd', { results: scores });
      game.softReset(); // 소프트 리셋으로 변경
      return;
    }
    
    // take는 턴이 바뀌지 않지만, 카드를 가져간 후 다음 턴 시작
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
    
    if (socket.id !== game.hostId) {
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
    if (socket.id !== game.hostId) {
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
    
    if (game.started) {
      // AI봇만 남은 경우 게임 자동 취소
      const humanPlayers = game.players.filter(p => !p.isBot);
      if (humanPlayers.length === 0 && game.players.length > 0) {
        console.log('Game cancelled: Only AI bots remain');
        io.emit('gameEnd', { 
          results: [], 
          cancelled: true, 
          reason: 'AI 봇만 남아 게임이 취소되었습니다.' 
        });
        game.softReset();
        return;
      }
      
      // 기존 로직: 2명 미만 남은 경우 게임 종료
      if (game.players.length < 2) {
        const scores = game.calculateScores();
        io.emit('gameEnd', { results: scores });
        game.softReset();
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