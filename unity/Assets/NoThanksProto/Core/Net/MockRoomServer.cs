using System;
using System.Collections.Generic;
using System.Linq;
using NoThanks.Core.Bots;

namespace NoThanks.Core.Net
{
    /// <summary>서버가 클라이언트로 보내는 출구 (Colyseus 의 client.send / broadcast / state patch 에 해당).</summary>
    public interface IClientSink
    {
        void DeliverState(RoomStateSchema state);
        void DeliverEvent(ServerEvent ev);
    }

    public sealed class MockServerOptions
    {
        /// <summary>봇 사고 시간 배율. 1 = master 와 동일(0.8~4.5초). 테스트/데모용으로 낮출 수 있음.</summary>
        public double BotDelayScale = 1.0;
        /// <summary>take/pass 를 이 확률로 일부러 거절 (롤백 UX 확인용 디버그 옵션). 기본 0.</summary>
        public double DebugRejectRate = 0.0;
    }

    /// <summary>
    /// master server/index.js 의 소켓 핸들러 흐름을 Colyseus Room 형태로 옮긴 로컬 목 서버.
    /// - 권한 있는 상태는 GameEngine 하나 (index.js 의 단일 game 인스턴스와 동일)
    /// - 모든 타이머는 Scheduler(가상 시계) 사용
    /// - 상태는 클라이언트별로 필터링(StateView)해서 전송, 이벤트에는 클라이언트별 Seq 부여
    /// </summary>
    public sealed class MockRoomServer
    {
        private sealed class ClientConn
        {
            public string SessionId;
            public IClientSink Sink;
            public long Seq;
        }

        private readonly Scheduler _clock;
        private readonly IRandom _rng;
        private readonly IRandom _debugRng;
        private readonly GameEngine _game;
        private readonly Dictionary<string, ClientConn> _clients = new Dictionary<string, ClientConn>();
        private int _sessionSerial;
        private long _version;

        private Scheduler.Handle _turnTimer;
        private Scheduler.Handle _botTimer;
        private Scheduler.Handle _revealTimer;
        private double _turnDeadline;   // 0 = 없음
        private string _lastTurnPlayerId;
        private string _phase = Phases.Lobby;
        private List<ResultSchema> _lastResults = new List<ResultSchema>();

        public MockServerOptions Options;
        public GameEngine Engine { get { return _game; } }
        public string Phase { get { return _phase; } }

        public MockRoomServer(Scheduler clock, IRandom rng = null, MockServerOptions options = null)
        {
            _clock = clock;
            _rng = rng ?? new SystemRandom();
            _debugRng = new SystemRandom();
            _game = new GameEngine(_rng);
            Options = options ?? new MockServerOptions();
        }

        // ------------------------------------------------------------------
        // 접속 (Colyseus onJoin / onLeave)
        // ------------------------------------------------------------------
        public string Join(string nickname, IClientSink sink)
        {
            var sid = "s" + (++_sessionSerial);
            if (string.IsNullOrWhiteSpace(nickname)) return null;
            if (!_game.AddPlayer(sid, nickname.Trim())) return null;
            _clients[sid] = new ClientConn { SessionId = sid, Sink = sink };
            BroadcastState();
            return sid;
        }

        /// <summary>index.js:561 disconnect 처리.</summary>
        public void Leave(string sid)
        {
            _clients.Remove(sid);
            _game.RemovePlayer(sid);
            var humans = _game.Players.Where(p => !p.IsBot).ToList();
            if (humans.Count == 0 && _game.Players.Count > 0)
            {
                if (_game.Started) EndGame(new List<ScoreResult>());
                else { _game.Reset(); BroadcastState(); }
                return;
            }
            if (_game.Started && _game.Players.Count < 2)
            {
                EndGame(_game.CalculateScores());
                return;
            }
            BroadcastState();
        }

        // ------------------------------------------------------------------
        // 메시지 수신 (Colyseus onMessage)
        // ------------------------------------------------------------------
        public void Receive(string sid, string type, ClientMessage msg)
        {
            if (!_clients.ContainsKey(sid)) return;
            msg = msg ?? new ClientMessage();
            switch (type)
            {
                case ClientMessageTypes.Start: HandleStart(sid, msg); break;
                case ClientMessageTypes.Take: HandleTake(sid, msg); break;
                case ClientMessageTypes.Pass: HandlePass(sid, msg); break;
                case ClientMessageTypes.UpdateSettings: HandleUpdateSettings(sid, msg); break;
                case ClientMessageTypes.AddBot: HandleAddBot(sid, msg); break;
                case ClientMessageTypes.RemoveBot: HandleRemoveBot(sid, msg); break;
                case ClientMessageTypes.BackToLobby: HandleBackToLobby(sid, msg); break;
                case ClientMessageTypes.Resync: HandleResync(sid); break;
                default: Reply(sid, msg.ReqId, type, false, "unknown message"); break;
            }
        }

        private void HandleStart(string sid, ClientMessage msg)
        {
            if (sid != _game.HostId) { Reply(sid, msg.ReqId, "start", false, "Only the host can start the game"); return; }
            if (_game.Started) { Reply(sid, msg.ReqId, "start", false, "Game already started"); return; }
            if (!_game.HasHumanPlayers()) { Reply(sid, msg.ReqId, "start", false, "At least one human player is required to start the game"); return; }
            if (!_game.Start()) { Reply(sid, msg.ReqId, "start", false, "Failed to start the game"); return; }

            _phase = Phases.Playing;
            _lastResults = new List<ResultSchema>();
            _lastTurnPlayerId = null;
            Reply(sid, msg.ReqId, "start", true, null);
            EmitAll(new ServerEvent
            {
                Type = EventTypes.GameStarted,
                Order = _game.Players.Select(p => p.Id).ToList(),
                DeckCount = _game.Deck.Count,
            });
            EmitCardRevealed();
            StartNextTurn();
        }

        private bool DebugReject(string sid, ClientMessage msg, string action)
        {
            if (Options.DebugRejectRate > 0 && _debugRng.NextDouble() < Options.DebugRejectRate)
            {
                Reply(sid, msg.ReqId, action, false, "디버그: 서버가 요청을 거절함");
                return true;
            }
            return false;
        }

        /// <summary>index.js:376 pass 핸들러.</summary>
        private void HandlePass(string sid, ClientMessage msg)
        {
            if (_revealTimer != null && _revealTimer.IsActive) { Reply(sid, msg.ReqId, "pass", false, "Reveal in progress"); return; }
            if (DebugReject(sid, msg, "pass")) return;

            int? cardPassed = _game.CurrentCard;
            int tokensOnCard = _game.PileTokens;
            var cur = _game.CurrentPlayer;
            bool forcedTake = cur != null && cur.Id == sid && cur.Tokens <= 0 && _game.Started;

            var result = _game.Pass(sid);
            if (result.IsError)
            {
                Reply(sid, msg.ReqId, "pass", false, result.Error);
                return;
            }
            Reply(sid, msg.ReqId, "pass", true, null);

            // index.js:390 — 패스(강제 가져가기 포함)는 'pass' 로 관찰된다
            NotifyBotsOfPlayerAction(sid, BotBrain.Pass, cardPassed ?? 0, tokensOnCard);

            if (forcedTake)
            {
                // 칩 0개 패스 = 가져가기 (game.js:229)
                if (result.NeedsDelay && result.IsHiddenRevealed)
                {
                    // 원본에서 처리되지 않던 경로: 숨김 카드면 take 와 동일하게 1초 후 가져가기로 보완
                    BeginHiddenReveal(sid, msg.ReqId, cardPassed ?? 0, tokensOnCard, true, false);
                    return;
                }
                EmitCardTaken(sid, cardPassed ?? 0, tokensOnCard, msg.ReqId, true);
                AfterTake(result);
                return;
            }

            EmitAll(new ServerEvent
            {
                Type = EventTypes.ChipPlaced,
                PlayerId = sid,
                PileChips = _game.PileTokens,
                PlayerChips = PlayerChipsFor(sid),
            }, sid, msg.ReqId);

            if (result.GameOver) { EndGame(_game.CalculateScores()); return; }
            StartNextTurn();
        }

        /// <summary>index.js:405 take 핸들러.</summary>
        private void HandleTake(string sid, ClientMessage msg)
        {
            if (_revealTimer != null && _revealTimer.IsActive) { Reply(sid, msg.ReqId, "take", false, "Reveal in progress"); return; }
            if (DebugReject(sid, msg, "take")) return;

            int? taken = _game.CurrentCard;
            int takenTokens = _game.PileTokens;
            var result = _game.TakeCard(sid);
            if (result.IsError)
            {
                Reply(sid, msg.ReqId, "take", false, result.Error);
                return;
            }
            Reply(sid, msg.ReqId, "take", true, null);

            if (result.NeedsDelay && result.IsHiddenRevealed)
            {
                BeginHiddenReveal(sid, msg.ReqId, taken ?? 0, takenTokens, false, true);
                return;
            }

            var human = _game.Find(sid);
            if (human != null && !human.IsBot)
            {
                NotifyBotsOfCardTaken(human, taken ?? 0, takenTokens);
                NotifyBotsOfPlayerAction(sid, BotBrain.Take, taken ?? 0, takenTokens);
            }
            EmitCardTaken(sid, taken ?? 0, takenTokens, msg.ReqId, false);
            AfterTake(result);
        }

        /// <summary>
        /// 숨김 카드 공개 → 1초 후 실제 가져가기 (index.js:93~117, 415~445).
        /// notifyAsTake: 최종 가져가기 후 봇들에게 take 로 알릴지(사람/봇 take 경로). 강제 가져가기/시간초과 경로는 원본처럼 알리지 않음.
        /// </summary>
        private void BeginHiddenReveal(string sid, int reqId, int card, int tokens, bool forced, bool notifyAsTake)
        {
            ClearTurnTimer();
            _revealTimer = _clock.Schedule(GameRules.HiddenRevealDelayMs, () =>
            {
                _revealTimer = null;
                var final = _game.TakeCard(sid);
                if (final.IsError)
                {
                    SendToast(sid, final.Error);
                    return;
                }
                var p = _game.Find(sid);
                if (notifyAsTake && p != null)
                {
                    NotifyBotsOfCardTaken(p, card, tokens);
                    NotifyBotsOfPlayerAction(sid, BotBrain.Take, card, tokens);
                }
                EmitCardTaken(sid, card, tokens, reqId, forced);
                AfterTake(final);
            });
            EmitAll(new ServerEvent { Type = EventTypes.HiddenRevealed, PlayerId = sid, Card = card }, sid, reqId);
            BroadcastState();
        }

        private void AfterTake(ActionResult result)
        {
            if (result.GameOver) { EndGame(_game.CalculateScores()); return; }
            EmitCardRevealed();
            StartNextTurn();
        }

        private void HandleUpdateSettings(string sid, ClientMessage msg)
        {
            if (msg.Settings == null) { Reply(sid, msg.ReqId, "updateSettings", false, "잘못된 설정 데이터입니다."); return; }
            if (sid != _game.HostId) { Reply(sid, msg.ReqId, "updateSettings", false, "방장만 설정을 변경할 수 있습니다."); return; }
            if (!_game.UpdateSettings(msg.Settings.ToPatch())) { Reply(sid, msg.ReqId, "updateSettings", false, "게임이 진행 중일 때는 설정을 변경할 수 없습니다."); return; }
            Reply(sid, msg.ReqId, "updateSettings", true, null);
            BroadcastState();
        }

        private void HandleAddBot(string sid, ClientMessage msg)
        {
            BotDifficulty d;
            if (!BotDifficultyExt.TryParseWire(msg.Difficulty, out d)) { Reply(sid, msg.ReqId, "addBot", false, "잘못된 봇 난이도입니다."); return; }
            if (_game.HostId == null || sid != _game.HostId) { Reply(sid, msg.ReqId, "addBot", false, "방장만 봇을 추가할 수 있습니다."); return; }
            if (_game.AddBot(d) == null) { Reply(sid, msg.ReqId, "addBot", false, "봇을 추가할 수 없습니다. (최대 3개, 총 인원 7명 제한)"); return; }
            Reply(sid, msg.ReqId, "addBot", true, null);
            BroadcastState();
        }

        private void HandleRemoveBot(string sid, ClientMessage msg)
        {
            if (_game.HostId == null || sid != _game.HostId) { Reply(sid, msg.ReqId, "removeBot", false, "방장만 봇을 제거할 수 있습니다."); return; }
            if (!_game.RemoveBot(msg.BotId)) { Reply(sid, msg.ReqId, "removeBot", false, "봇을 제거할 수 없습니다."); return; }
            Reply(sid, msg.ReqId, "removeBot", true, null);
            BroadcastState();
        }

        private void HandleBackToLobby(string sid, ClientMessage msg)
        {
            if (_game.Started) { Reply(sid, msg.ReqId, "backToLobby", false, "Game in progress"); return; }
            _phase = Phases.Lobby;
            _lastResults = new List<ResultSchema>();
            Reply(sid, msg.ReqId, "backToLobby", true, null);
            BroadcastState();
        }

        private void HandleResync(string sid)
        {
            ClientConn c;
            if (!_clients.TryGetValue(sid, out c)) return;
            c.Sink.DeliverState(BuildState(sid));
            c.Seq++;
            c.Sink.DeliverEvent(new ServerEvent { Seq = c.Seq, Type = EventTypes.Resync, ServerTimeMs = _clock.Now, StateVersion = _version });
        }

        // ------------------------------------------------------------------
        // 턴 진행 (index.js:142 startNextTurn, 61 handleBotTurn, 38 handleTurnTimeout)
        // ------------------------------------------------------------------
        private void StartNextTurn()
        {
            ClearTurnTimer();
            var cur = _game.CurrentPlayer;
            if (cur == null) return;

            double turnMs = 0;
            if (!cur.IsBot && _game.Settings.TurnTimeLimit > 0)
            {
                turnMs = _game.Settings.TurnTimeLimit * 1000.0;
                _turnDeadline = _clock.Now + turnMs;
                var pid = cur.Id;
                _turnTimer = _clock.Schedule(turnMs, () => HandleTurnTimeout(pid));
            }

            EmitAll(new ServerEvent
            {
                Type = EventTypes.TurnChanged,
                PlayerId = cur.Id,
                SamePlayer = cur.Id == _lastTurnPlayerId,
                TurnMs = turnMs,
            });
            _lastTurnPlayerId = cur.Id;
            BroadcastState();

            if (cur.IsBot) HandleBotTurn(cur);
        }

        private void ClearTurnTimer()
        {
            Scheduler.Cancel(_turnTimer);
            _turnTimer = null;
            _turnDeadline = 0;
        }

        private void HandleTurnTimeout(string playerId)
        {
            _turnTimer = null;
            _turnDeadline = 0;
            var cur = _game.CurrentPlayer;
            if (cur == null || cur.IsBot || cur.Id != playerId) return;

            int? card = _game.CurrentCard;
            int tokens = _game.PileTokens;
            ActionResult result;
            if (cur.Tokens > 0)
            {
                result = _game.Pass(playerId);
                EmitAll(new ServerEvent { Type = EventTypes.ChipPlaced, PlayerId = playerId, PileChips = _game.PileTokens, PlayerChips = PlayerChipsFor(playerId), Forced = true });
                if (result.GameOver) { EndGame(_game.CalculateScores()); return; }
                StartNextTurn();
                return;
            }
            result = _game.TakeCard(playerId);
            if (result.NeedsDelay && result.IsHiddenRevealed)
            {
                BeginHiddenReveal(playerId, 0, card ?? 0, tokens, true, false);
                return;
            }
            EmitCardTaken(playerId, card ?? 0, tokens, 0, true);
            AfterTake(result);
        }

        private void HandleBotTurn(PlayerData bot)
        {
            Scheduler.Cancel(_botTimer);
            double delay = BotBrain.ThinkDelayMs(bot.Difficulty, _rng.NextDouble()) * Math.Max(0, Options.BotDelayScale);
            _botTimer = _clock.Schedule(delay, () =>
            {
                _botTimer = null;
                if (!_game.Started || _game.CurrentPlayer == null || _game.CurrentPlayer.Id != bot.Id) return;

                var action = bot.Brain.MakeDecision(_game.GetState());
                if (action == BotBrain.Take)
                {
                    int? cardTaken = _game.CurrentCard;
                    int tokensTaken = _game.PileTokens;
                    var result = _game.TakeCard(bot.Id);
                    if (result.IsError) return;
                    if (result.NeedsDelay && result.IsHiddenRevealed)
                    {
                        BeginHiddenReveal(bot.Id, 0, cardTaken ?? 0, tokensTaken, false, true);
                        return;
                    }
                    NotifyBotsOfCardTaken(bot, cardTaken ?? 0, tokensTaken);
                    NotifyBotsOfPlayerAction(bot.Id, BotBrain.Take, cardTaken ?? 0, tokensTaken);
                    EmitCardTaken(bot.Id, cardTaken ?? 0, tokensTaken, 0, false);
                    AfterTake(result);
                }
                else
                {
                    int? cardPassed = _game.CurrentCard;
                    int tokensOnCard = _game.PileTokens;
                    bool forced = bot.Tokens <= 0;
                    var result = _game.Pass(bot.Id);
                    if (result.IsError) return;
                    NotifyBotsOfPlayerAction(bot.Id, BotBrain.Pass, cardPassed ?? 0, tokensOnCard);
                    if (forced)
                    {
                        if (result.NeedsDelay && result.IsHiddenRevealed)
                        {
                            BeginHiddenReveal(bot.Id, 0, cardPassed ?? 0, tokensOnCard, true, false);
                            return;
                        }
                        EmitCardTaken(bot.Id, cardPassed ?? 0, tokensOnCard, 0, true);
                        AfterTake(result);
                        return;
                    }
                    EmitAll(new ServerEvent { Type = EventTypes.ChipPlaced, PlayerId = bot.Id, PileChips = _game.PileTokens, PlayerChips = PlayerChipsFor(bot.Id) });
                    if (result.GameOver) { EndGame(_game.CalculateScores()); return; }
                    StartNextTurn();
                }
            });
        }

        private void EndGame(List<ScoreResult> scores)
        {
            ClearTurnTimer();
            Scheduler.Cancel(_botTimer); _botTimer = null;
            Scheduler.Cancel(_revealTimer); _revealTimer = null;

            _lastResults = scores.Select(s => new ResultSchema
            {
                Id = s.Id, Nickname = s.Nickname, Score = s.Score, Cards = new List<int>(s.Cards), Chips = s.Tokens, Rank = s.Rank, IsBot = s.IsBot,
            }).ToList();
            _phase = Phases.Ended;
            EmitAll(new ServerEvent { Type = EventTypes.GameEnded, Results = _lastResults.Select(r => r.Clone()).ToList() });

            // index.js:297 소프트 리셋 (봇 제거, 설정 기본값). 결과 화면은 Results 로 유지.
            _game.SoftReset();
            if (!_game.HasHumanPlayers()) _game.Reset();
            BroadcastState();
        }

        // ------------------------------------------------------------------
        // 봇 알림 (index.js:160, 184, 239, 250)
        // ------------------------------------------------------------------
        private void NotifyBotsOfCardTaken(PlayerData taker, int card, int tokens)
        {
            foreach (var p in _game.Players)
            {
                if (!p.IsBot || p.Id == taker.Id || p.Brain == null) continue;
                var takerView = taker.ToView();
                if (p.Brain.WouldPlayerWantCard(takerView, card)) p.Brain.ReactToEvent("someone_took_my_card", taker.Id);
            }
        }

        private void NotifyBotsOfPlayerAction(string playerId, string action, int card, int tokens)
        {
            foreach (var p in _game.Players)
            {
                if (p.IsBot && p.Id != playerId && p.Brain != null) p.Brain.ObservePlayerAction(playerId, action, card, tokens);
            }
        }

        private void NotifyBotsOfRankingChange()
        {
            if (!_game.Started) return;
            var rankings = _game.Players.Select(p => new { p.Id, Score = BotBrain.CalculatePlayerScore(p.Cards, p.Tokens), p.IsBot })
                .OrderBy(r => r.Score).ToList();
            foreach (var p in _game.Players)
            {
                if (!p.IsBot || p.Brain == null) continue;
                int myRank = rankings.FindIndex(r => r.Id == p.Id) + 1;
                bool isLeading = myRank == 1;
                bool wasOvertaken = myRank > 1 && rankings.Take(myRank - 1).Any(r => !r.IsBot);
                if (wasOvertaken) p.Brain.ReactToEvent("got_overtaken", null);
                else if (isLeading && _rng.NextDouble() < 0.3) p.Brain.ReactToEvent("winning_streak", null);
            }
        }

        private void CheckBotsConsecutiveResults()
        {
            foreach (var p in _game.Players)
            {
                if (!p.IsBot || p.Brain == null) continue;
                var ev = p.Brain.GameEvents;
                if (ev.Count < 3) continue;
                var recent = ev.Skip(ev.Count - 3).ToList();
                bool allBad = recent.All(e => e.Type == "decision" && e.MyDecision == BotBrain.Take && e.Tokens < e.Card * 0.3);
                if (allBad) p.Brain.ReactToEvent("consecutive_bad_cards", null);
            }
        }

        // ------------------------------------------------------------------
        // 송신
        // ------------------------------------------------------------------
        private void EmitCardRevealed()
        {
            EmitAll(new ServerEvent
            {
                Type = EventTypes.CardRevealed,
                Card = CardForWire(),
                DeckCount = _game.Deck.Count,
                PileChips = _game.PileTokens,
            });
        }

        private void EmitCardTaken(string playerId, int card, int chips, int reqId, bool forced)
        {
            EmitAll(new ServerEvent
            {
                Type = EventTypes.CardTaken,
                PlayerId = playerId,
                Card = card,
                Chips = chips,
                PlayerChips = PlayerChipsFor(playerId),
                Forced = forced,
            }, playerId, reqId);
        }

        private int CardForWire()
        {
            if (!_game.CurrentCard.HasValue) return 0;
            return _game.IsCurrentCardHidden ? -1 : _game.CurrentCard.Value;
        }

        private int PlayerChipsFor(string playerId)
        {
            var p = _game.Find(playerId);
            return p != null ? p.Tokens : 0;
        }

        private void Reply(string sid, int reqId, string action, bool ok, string reason)
        {
            ClientConn c;
            if (!_clients.TryGetValue(sid, out c)) return;
            c.Seq++;
            c.Sink.DeliverEvent(new ServerEvent
            {
                Seq = c.Seq, Type = EventTypes.ActionResult, ReqId = reqId, Ok = ok, Reason = reason, Action = action,
                ServerTimeMs = _clock.Now, StateVersion = _version,
            });
        }

        private void SendToast(string sid, string text)
        {
            ClientConn c;
            if (!_clients.TryGetValue(sid, out c)) return;
            c.Seq++;
            c.Sink.DeliverEvent(new ServerEvent { Seq = c.Seq, Type = EventTypes.Toast, Reason = text, ServerTimeMs = _clock.Now });
        }

        /// <summary>모든 클라이언트에게 이벤트 전송. originSid 에게만 ReqId 를 채워 보낸다. 칩 비공개면 다른 사람에게는 PlayerChips=-1.</summary>
        private void EmitAll(ServerEvent ev, string originSid = null, int reqId = 0)
        {
            _version++;
            foreach (var c in _clients.Values)
            {
                var e = ev.Clone();
                c.Seq++;
                e.Seq = c.Seq;
                e.ServerTimeMs = _clock.Now;
                e.StateVersion = _version;
                e.ReqId = c.SessionId == originSid ? reqId : 0;
                if (!_game.Settings.ShowOpponentTokens && e.PlayerId != null && e.PlayerId != c.SessionId) e.PlayerChips = -1;
                c.Sink.DeliverEvent(e);
            }
        }

        /// <summary>index.js:274 broadcastState() — 진행 중이면 봇 순위/연속 결과 반응도 갱신.</summary>
        private void BroadcastState()
        {
            _version++;
            foreach (var c in _clients.Values) c.Sink.DeliverState(BuildState(c.SessionId));
            if (_game.Started)
            {
                NotifyBotsOfRankingChange();
                CheckBotsConsecutiveResults();
            }
        }

        /// <summary>클라이언트별 상태 (Colyseus StateView 필터링에 해당).</summary>
        public RoomStateSchema BuildState(string forSid)
        {
            var s = new RoomStateSchema
            {
                Phase = _phase,
                HostId = _game.HostId,
                CurrentPlayerId = _game.Started && _game.CurrentPlayer != null ? _game.CurrentPlayer.Id : null,
                CurrentCard = _game.Started ? CardForWire() : 0,
                PileChips = _game.PileTokens,
                DeckCount = _game.Deck.Count,
                RemovedCount = _game.RemovedCards.Count,
                HiddenTotal = _game.HiddenCards.Count,
                RevealedCount = _game.RevealedCards.Count,
                RevealPending = _revealTimer != null && _revealTimer.IsActive,
                TurnRemainingMs = _turnDeadline > 0 ? Math.Max(0, _turnDeadline - _clock.Now) : 0,
                ServerTimeMs = _clock.Now,
                Settings = SettingsSchema.From(_game.Settings),
                Version = _version,
            };
            bool hideChips = !_game.Settings.ShowOpponentTokens && _game.Started;
            for (int i = 0; i < _game.Players.Count; i++)
            {
                var p = _game.Players[i];
                s.Players.Add(new PlayerSchema
                {
                    Id = p.Id,
                    Nickname = p.Nickname,
                    IsBot = p.IsBot,
                    Difficulty = p.IsBot ? p.Difficulty.ToWire() : "",
                    Chips = hideChips && p.Id != forSid ? -1 : p.Tokens,
                    Cards = new List<int>(p.Cards),
                    CardPoints = Scoring.CardSum(p.Cards),
                    Seat = i,
                });
            }
            foreach (var r in _lastResults) s.Results.Add(r.Clone());
            return s;
        }
    }
}
