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

/**
 * Helper function to broadcast the current game state to all
 * connected clients.
 */
function broadcastState() {
    const state = game.getState();
    // Also include hostId (first player) in the broadcast for client UI
    const hostId = game.players?.[0]?.id || null;
    io.emit('gameState', { ...state, hostId });
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send initial state on connection
  socket.emit('gameState', { ...game.getState(), hostId: game.players?.[0]?.id || null });

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
   * Host starts the game with settings. Only the first player to join
   * (host) may start the game. Settings include removedCount and
   * initialTokens.
   */
  socket.on('start', (settings, ack) => {
    const hostId = game.players?.[0]?.id;
    if (socket.id !== hostId) {
      socket.emit('gameError', { message: 'Only the host can start the game' });
      if (typeof ack === 'function') ack({ ok: false, error: 'Only the host can start the game' });
      return;
    }
    if (game.started) {
      socket.emit('gameError', { message: 'Game already started' });
      if (typeof ack === 'function') ack({ ok: false, error: 'Game already started' });
      return;
    }
    const success = game.start(settings || {});
    if (!success) {
      socket.emit('gameError', { message: 'Failed to start the game' });
      if (typeof ack === 'function') ack({ ok: false, error: 'Failed to start the game' });
      return;
    }
    broadcastState();
    // Immediately send the current state to the starter too (redundant safety)
    socket.emit('gameState', { ...game.getState(), hostId: game.players?.[0]?.id || null });
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
      game.reset();
      return;
    }
    broadcastState();
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
      game.reset();
      return;
    }
    broadcastState();
  });

  /**
   * Handle a player disconnecting. Remove them from the game and
   * broadcast the updated state. If only one player remains after
   * the disconnect, the game ends immediately.
   */
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(ping);
    // Remove the player
    game.removePlayer(socket.id);
    if (game.started && game.players.length < 2) {
      // End the game if fewer than two players remain
      const scores = game.calculateScores();
      io.emit('gameEnd', { results: scores });
      game.reset();
      return;
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