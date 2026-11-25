using System;
using System.Collections.Generic;
using System.Linq;

namespace NoThanks.Core
{
    /// <summary>플레이어 (game.js players 원소 { id, nickname, tokens, cards, isBot }).</summary>
    public sealed class PlayerData
    {
        public string Id;
        public string Nickname;
        public int Tokens;
        public List<int> Cards = new List<int>();
        public bool IsBot;
        public BotDifficulty Difficulty;
        /// <summary>봇이면 의사결정 두뇌 (master 에서는 Bot 인스턴스 자체가 플레이어 객체).</summary>
        public Bots.BotBrain Brain;

        public PlayerView ToView()
        {
            return new PlayerView(Id, Nickname, Tokens, Cards, IsBot);
        }
    }

    /// <summary>
    /// 봇이 읽는 플레이어 정보 (game.js getState().players 원소).
    /// Cards 가 null 이면 "카드 정보 없음" (bot.js 에서 scores 배열 원소처럼 cards 필드가 없는 객체).
    /// </summary>
    public sealed class PlayerView
    {
        public readonly string Id;
        public readonly string Nickname;
        public readonly int Tokens;
        public readonly IReadOnlyList<int> Cards;
        public readonly bool IsBot;

        public PlayerView(string id, string nickname, int tokens, IReadOnlyList<int> cards, bool isBot)
        {
            Id = id;
            Nickname = nickname;
            Tokens = tokens;
            Cards = cards;
            IsBot = isBot;
        }
    }

    /// <summary>game.js getState() 에 해당하는 서버 내부 스냅샷 (봇 입력).</summary>
    public sealed class GameSnapshot
    {
        public List<PlayerView> Players = new List<PlayerView>();
        public int? CurrentCard;
        public int PileTokens;
        public string CurrentPlayerId;
        public int DeckSize;
        public int RemovedCount;
        public List<int> RemovedCards = new List<int>();
        public bool Started;
        public bool IsCurrentCardHidden;
        public int HiddenCardsTotal;
        public int RevealedCardsCount;
    }

    /// <summary>pass/take 결과 (game.js 반환 객체 { error, gameOver, isHiddenRevealed, needsDelay }).</summary>
    public struct ActionResult
    {
        public string Error;
        public bool GameOver;
        public bool IsHiddenRevealed;
        public bool NeedsDelay;

        public bool IsError { get { return Error != null; } }

        public static ActionResult Fail(string e) { return new ActionResult { Error = e }; }
    }

    public sealed class ScoreResult
    {
        public string Id;
        public string Nickname;
        public int Score;
        public List<int> Cards;
        public int Tokens;
        public int Rank;
        public bool IsBot;
    }

    /// <summary>
    /// master server/game.js 의 Game 클래스를 1:1 로 옮긴 순수 C# 엔진.
    /// 타이머/소켓 관련 부분은 MockRoomServer 로 분리했다.
    /// </summary>
    public sealed class GameEngine
    {
        public const string ErrNotStarted = "Game not started";
        public const string ErrNotYourTurn = "Not your turn";

        private readonly IRandom _rng;
        private int _botSerial;

        public List<PlayerData> Players = new List<PlayerData>();
        public List<int> Deck = new List<int>();
        public List<int> RemovedCards = new List<int>();
        public int? CurrentCard;
        public int PileTokens;
        public int CurrentPlayerIndex;
        public bool Started;
        public HashSet<int> HiddenCards = new HashSet<int>();
        public HashSet<int> RevealedCards = new HashSet<int>();
        public GameSettings Settings = new GameSettings();
        public string HostId;

        public IRandom Random { get { return _rng; } }

        public GameEngine(IRandom rng)
        {
            _rng = rng ?? new SystemRandom();
            Reset();
        }

        /// <summary>game.js:34 reset()</summary>
        public void Reset()
        {
            Players = new List<PlayerData>();
            Deck = new List<int>();
            RemovedCards = new List<int>();
            CurrentCard = null;
            PileTokens = 0;
            CurrentPlayerIndex = 0;
            Started = false;
            HiddenCards = new HashSet<int>();
            RevealedCards = new HashSet<int>();
            Settings = new GameSettings();
            HostId = null;
        }

        public PlayerData CurrentPlayer
        {
            get
            {
                if (CurrentPlayerIndex < 0 || CurrentPlayerIndex >= Players.Count) return null;
                return Players[CurrentPlayerIndex];
            }
        }

        public PlayerData Find(string id)
        {
            for (int i = 0; i < Players.Count; i++) if (Players[i].Id == id) return Players[i];
            return null;
        }

        /// <summary>game.js:70 addPlayer()</summary>
        public bool AddPlayer(string id, string nickname)
        {
            if (Started) return false;
            if (Players.Count >= GameRules.MaxPlayers) return false;

            var existing = Players.FirstOrDefault(p => p.Nickname == nickname && !p.IsBot);
            if (existing != null)
            {
                // 재연결: 소켓 ID 만 교체 (game.js:76~84).
                // 원본은 id 를 먼저 교체한 뒤 hostId 를 비교하므로 사실상 방장 ID 가 갱신되지 않는다. 그대로 옮김.
                existing.Id = id;
                if (HostId == existing.Id) HostId = id;
                return true;
            }

            if (Players.Any(p => p.Nickname == nickname)) return false;

            Players.Add(new PlayerData { Id = id, Nickname = nickname, Tokens = 0, IsBot = false });
            if (Players.Count == 1) HostId = id;
            return true;
        }

        /// <summary>game.js:106 removePlayer()</summary>
        public void RemovePlayer(string id)
        {
            var idx = Players.FindIndex(p => p.Id == id);
            if (idx == -1) return;
            var wasHost = HostId == id;
            Players.RemoveAt(idx);

            if (wasHost && Players.Count > 0)
            {
                var nextHost = Players.FirstOrDefault(p => !p.IsBot);
                HostId = nextHost != null ? nextHost.Id : null;
            }

            if (Started)
            {
                if (idx < CurrentPlayerIndex)
                {
                    CurrentPlayerIndex -= 1;
                }
                else if (idx == CurrentPlayerIndex)
                {
                    if (CurrentPlayerIndex >= Players.Count) CurrentPlayerIndex = 0;
                }
            }
        }

        /// <summary>game.js:145 start()</summary>
        public bool Start()
        {
            if (Started) return false;

            var fullDeck = new List<int>();
            for (int i = GameRules.MinCard; i <= GameRules.MaxCard; i++) fullDeck.Add(i);

            // 직접 랜덤 선택 방식으로 카드 제거 (game.js:153~160)
            RemovedCards = new List<int>();
            var remaining = new List<int>(fullDeck);
            for (int i = 0; i < Settings.RemovedCount; i++)
            {
                int ri = (int)Math.Floor(_rng.NextDouble() * remaining.Count);
                RemovedCards.Add(remaining[ri]);
                remaining.RemoveAt(ri);
            }

            // 남은 카드 셔플 (Fisher-Yates, game.js:163~167)
            Deck = new List<int>(remaining);
            for (int i = Deck.Count - 1; i > 0; i--)
            {
                int j = (int)Math.Floor(_rng.NextDouble() * (i + 1));
                var t = Deck[i]; Deck[i] = Deck[j]; Deck[j] = t;
            }

            HiddenCards = new HashSet<int>();
            RevealedCards = new HashSet<int>();
            if (Settings.GameMode == GameMode.Hidden) SelectHiddenCards();

            ShufflePlayerOrder();

            foreach (var p in Players)
            {
                p.Tokens = Settings.InitialTokens;
                p.Cards = new List<int>();
            }

            CurrentPlayerIndex = 0;
            CurrentCard = NextCard();
            PileTokens = 0;
            Started = true;
            return true;
        }

        /// <summary>game.js:201 nextCard()</summary>
        public int? NextCard()
        {
            if (Deck.Count == 0) return null;
            var c = Deck[0];
            Deck.RemoveAt(0);
            return c;
        }

        /// <summary>game.js:214 pass() — 칩이 0개면 강제로 가져가기.</summary>
        public ActionResult Pass(string id)
        {
            if (!Started) return ActionResult.Fail(ErrNotStarted);
            var player = CurrentPlayer;
            if (player == null || player.Id != id) return ActionResult.Fail(ErrNotYourTurn);
            if (player.Tokens > 0)
            {
                player.Tokens -= 1;
                PileTokens += 1;
                CurrentPlayerIndex = (CurrentPlayerIndex + 1) % Players.Count;
                return new ActionResult { GameOver = false };
            }
            return TakeCard(id);
        }

        /// <summary>game.js:242 takeCard() — 가져간 플레이어가 계속 턴을 유지.</summary>
        public ActionResult TakeCard(string id)
        {
            if (!Started) return ActionResult.Fail(ErrNotStarted);
            var player = CurrentPlayer;
            if (player == null || player.Id != id) return ActionResult.Fail(ErrNotYourTurn);

            // 숨김 카드는 먼저 공개만 한다 (game.js:252~257)
            if (CurrentCard.HasValue && HiddenCards.Contains(CurrentCard.Value) && !RevealedCards.Contains(CurrentCard.Value))
            {
                RevealedCards.Add(CurrentCard.Value);
                return new ActionResult { GameOver = false, IsHiddenRevealed = true, NeedsDelay = true };
            }

            if (CurrentCard.HasValue) player.Cards.Add(CurrentCard.Value);
            if (PileTokens > 0)
            {
                player.Tokens += PileTokens;
                PileTokens = 0;
            }
            CurrentCard = NextCard();
            if (CurrentCard == null)
            {
                Started = false;
                return new ActionResult { GameOver = true };
            }
            return new ActionResult { GameOver = false, IsHiddenRevealed = false };
        }

        /// <summary>game.js:284 calculateScores() — 점수 오름차순(안정 정렬), 순위는 1부터 순번.</summary>
        public List<ScoreResult> CalculateScores()
        {
            var results = Players.Select(p => new ScoreResult
            {
                Id = p.Id,
                Nickname = p.Nickname,
                Score = Scoring.Score(p.Cards, p.Tokens),
                Cards = new List<int>(p.Cards),
                Tokens = p.Tokens,
                IsBot = p.IsBot,
            }).OrderBy(r => r.Score).ToList(); // LINQ OrderBy 는 안정 정렬 (JS Array.sort 와 동일)
            for (int i = 0; i < results.Count; i++) results[i].Rank = i + 1;
            return results;
        }

        /// <summary>game.js:318 updateSettings()</summary>
        public bool UpdateSettings(SettingsPatch patch)
        {
            if (Started) return false;
            patch.ApplyTo(Settings);
            Settings.Clamp();
            return true;
        }

        /// <summary>game.js:351 transferHost()</summary>
        public bool TransferHost(string currentHostId, string newHostId)
        {
            if (HostId != currentHostId) return false;
            if (Find(newHostId) == null) return false;
            HostId = newHostId;
            return true;
        }

        /// <summary>game.js:399 addBot() — 최대 3봇, 총 7명.</summary>
        public PlayerData AddBot(BotDifficulty difficulty)
        {
            if (Started) return null;
            if (Players.Count >= GameRules.MaxPlayers) return null;
            int botCount = Players.Count(p => p.IsBot);
            if (botCount >= GameRules.MaxBots) return null;

            _botSerial++;
            var bot = new PlayerData
            {
                Id = "bot_" + _botSerial,
                Nickname = "AI봇 " + (botCount + 1) + " (" + difficulty.ToKorean() + ")",
                IsBot = true,
                Difficulty = difficulty,
            };
            bot.Brain = new Bots.BotBrain(bot, difficulty, _rng);
            Players.Add(bot);
            return bot;
        }

        /// <summary>game.js:422 removeBot() — 남은 봇 이름 재정렬.</summary>
        public bool RemoveBot(string botId)
        {
            if (Started) return false;
            var idx = Players.FindIndex(p => p.Id == botId && p.IsBot);
            if (idx == -1) return false;
            Players.RemoveAt(idx);
            int n = 0;
            foreach (var b in Players.Where(p => p.IsBot))
            {
                n++;
                b.Nickname = "AI봇 " + n + " (" + b.Difficulty.ToKorean() + ")";
            }
            return true;
        }

        /// <summary>game.js:445 shufflePlayerOrder()</summary>
        public void ShufflePlayerOrder()
        {
            for (int i = Players.Count - 1; i > 0; i--)
            {
                int j = (int)Math.Floor(_rng.NextDouble() * (i + 1));
                var t = Players[i]; Players[i] = Players[j]; Players[j] = t;
            }
        }

        /// <summary>game.js:456 selectHiddenCards()</summary>
        public void SelectHiddenCards()
        {
            var remaining = new List<int>(Deck);
            int count = Math.Min(Settings.HiddenCardCount, remaining.Count);
            for (int i = 0; i < count; i++)
            {
                int ri = (int)Math.Floor(_rng.NextDouble() * remaining.Count);
                HiddenCards.Add(remaining[ri]);
                remaining.RemoveAt(ri);
            }
        }

        /// <summary>game.js:505 softReset() — 사람만 남기고 봇 제거, 설정 기본값 복귀.</summary>
        public void SoftReset()
        {
            var humans = Players.Where(p => !p.IsBot).ToList();
            var savedHost = HostId;
            Deck = new List<int>();
            RemovedCards = new List<int>();
            CurrentCard = null;
            PileTokens = 0;
            CurrentPlayerIndex = 0;
            Started = false;
            HiddenCards = new HashSet<int>();
            RevealedCards = new HashSet<int>();
            foreach (var h in humans)
            {
                h.Tokens = 0;
                h.Cards = new List<int>();
            }
            Players = humans;
            if (Players.Any(p => p.Id == savedHost && !p.IsBot)) HostId = savedHost;
            else
            {
                var first = Players.FirstOrDefault(p => !p.IsBot);
                HostId = first != null ? first.Id : null;
            }
            Settings = new GameSettings();
        }

        public bool HasHumanPlayers()
        {
            return Players.Any(p => !p.IsBot);
        }

        public bool IsCurrentCardHidden
        {
            get { return CurrentCard.HasValue && HiddenCards.Contains(CurrentCard.Value) && !RevealedCards.Contains(CurrentCard.Value); }
        }

        /// <summary>game.js:565 getState()</summary>
        public GameSnapshot GetState()
        {
            var s = new GameSnapshot
            {
                CurrentCard = CurrentCard,
                PileTokens = PileTokens,
                CurrentPlayerId = CurrentPlayer != null ? CurrentPlayer.Id : null,
                DeckSize = Deck.Count,
                RemovedCount = RemovedCards.Count,
                RemovedCards = new List<int>(RemovedCards),
                Started = Started,
                IsCurrentCardHidden = IsCurrentCardHidden,
                HiddenCardsTotal = HiddenCards.Count,
                RevealedCardsCount = RevealedCards.Count,
            };
            foreach (var p in Players) s.Players.Add(new PlayerView(p.Id, p.Nickname, p.Tokens, new List<int>(p.Cards), p.IsBot));
            return s;
        }
    }
}
