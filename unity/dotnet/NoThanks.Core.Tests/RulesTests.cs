using System.Collections.Generic;
using System.Linq;
using NoThanks.Core;
using Xunit;

namespace NoThanks.Core.Tests
{
    public class RulesTests
    {
        private static GameEngine NewGame(int humans, int seed = 1)
        {
            var g = new GameEngine(new SystemRandom(seed));
            for (int i = 0; i < humans; i++) Assert.True(g.AddPlayer("p" + i, "P" + i));
            return g;
        }

        [Fact]
        public void Defaults_Match_Master()
        {
            var s = new GameSettings();
            Assert.Equal(9, s.RemovedCount);
            Assert.Equal(11, s.InitialTokens);
            Assert.False(s.ShowOpponentTokens);
            Assert.True(s.ShowRealTimeScore);
            Assert.Equal(30, s.TurnTimeLimit);
            Assert.Equal(GameMode.Normal, s.GameMode);
            Assert.Equal(3, s.HiddenCardCount);
            Assert.Equal(3, GameRules.MinCard);
            Assert.Equal(35, GameRules.MaxCard);
            Assert.Equal(33, GameRules.TotalCards);
        }

        [Fact]
        public void Start_Removes_Cards_And_Deals_Chips_Regardless_Of_PlayerCount()
        {
            for (int n = 2; n <= 7; n++)
            {
                var g = NewGame(n, n);
                Assert.True(g.Start());
                Assert.Equal(9, g.RemovedCards.Count);
                // 덱 23장 + 공개 카드 1장 = 24장
                Assert.Equal(23, g.Deck.Count);
                Assert.NotNull(g.CurrentCard);
                var all = new HashSet<int>(g.RemovedCards.Concat(g.Deck).Concat(new[] { g.CurrentCard.Value }));
                Assert.Equal(33, all.Count);
                Assert.True(all.All(c => c >= 3 && c <= 35));
                Assert.All(g.Players, p => Assert.Equal(11, p.Tokens)); // 인원과 무관하게 11개 (master)
                Assert.Equal(0, g.PileTokens);
                Assert.Equal(0, g.CurrentPlayerIndex);
            }
        }

        [Fact]
        public void Pass_Pays_One_Chip_And_Advances_Turn()
        {
            var g = NewGame(3);
            g.Start();
            var first = g.CurrentPlayer;
            var r = g.Pass(first.Id);
            Assert.False(r.IsError);
            Assert.Equal(10, first.Tokens);
            Assert.Equal(1, g.PileTokens);
            Assert.Equal(1, g.CurrentPlayerIndex);
        }

        [Fact]
        public void Pass_With_Zero_Chips_Is_Forced_Take()
        {
            var g = NewGame(2);
            g.Start();
            var p = g.CurrentPlayer;
            p.Tokens = 0;
            var card = g.CurrentCard.Value;
            var r = g.Pass(p.Id);
            Assert.False(r.IsError);
            Assert.Contains(card, p.Cards);
            Assert.Same(p, g.CurrentPlayer); // 가져가기는 턴 유지
        }

        [Fact]
        public void Take_Collects_Pile_Keeps_Turn_And_Draws()
        {
            var g = NewGame(2);
            g.Start();
            var a = g.CurrentPlayer;
            g.Pass(a.Id);
            var b = g.CurrentPlayer;
            var card = g.CurrentCard.Value;
            var r = g.TakeCard(b.Id);
            Assert.False(r.IsError);
            Assert.Contains(card, b.Cards);
            Assert.Equal(12, b.Tokens);
            Assert.Equal(0, g.PileTokens);
            Assert.Same(b, g.CurrentPlayer);
            Assert.Equal(22, g.Deck.Count);
        }

        [Fact]
        public void Wrong_Player_Is_Rejected()
        {
            var g = NewGame(2);
            Assert.Equal(GameEngine.ErrNotStarted, g.Pass("p0").Error);
            g.Start();
            var other = g.Players[1];
            Assert.Equal(GameEngine.ErrNotYourTurn, g.Pass(other.Id).Error);
            Assert.Equal(GameEngine.ErrNotYourTurn, g.TakeCard(other.Id).Error);
        }

        [Fact]
        public void Game_Ends_When_Deck_Exhausted()
        {
            var g = NewGame(3);
            g.Start();
            int takes = 0;
            ActionResult r = default;
            while (g.Started)
            {
                r = g.TakeCard(g.CurrentPlayer.Id);
                takes++;
            }
            Assert.True(r.GameOver);
            Assert.Equal(24, takes);
            Assert.Null(g.CurrentCard);
        }

        [Theory]
        [InlineData(new[] { 3, 4, 5, 10, 12, 13 }, 5, 20)]
        [InlineData(new int[0], 11, -11)]
        [InlineData(new[] { 35 }, 0, 35)]
        [InlineData(new[] { 20, 22, 21, 30 }, 3, 47)]
        public void Score_Runs_Lowest_Minus_Chips(int[] cards, int chips, int expected)
        {
            Assert.Equal(expected, Scoring.Score(cards, chips));
        }

        [Fact]
        public void Runs_Are_Grouped()
        {
            var runs = Scoring.Runs(new[] { 13, 3, 5, 4, 12, 10 });
            Assert.Equal(3, runs.Count);
            Assert.Equal(new[] { 3, 4, 5 }, runs[0]);
            Assert.Equal(new[] { 10 }, runs[1]);
            Assert.Equal(new[] { 12, 13 }, runs[2]);
        }

        [Fact]
        public void Scores_Sorted_Ascending_With_Sequential_Ranks_On_Tie()
        {
            var g = NewGame(3);
            g.Players[0].Cards = new List<int> { 10 }; g.Players[0].Tokens = 0;
            g.Players[1].Cards = new List<int> { 5 }; g.Players[1].Tokens = 0;
            g.Players[2].Cards = new List<int> { 10 }; g.Players[2].Tokens = 0;
            var res = g.CalculateScores();
            Assert.Equal(new[] { "P1", "P0", "P2" }, res.Select(r => r.Nickname).ToArray()); // 안정 정렬
            Assert.Equal(new[] { 1, 2, 3 }, res.Select(r => r.Rank).ToArray()); // 동점이어도 순번
        }

        [Fact]
        public void Settings_Clamp_Like_Master()
        {
            var g = NewGame(1);
            g.UpdateSettings(new SettingsPatch { RemovedCount = 99, InitialTokens = 0, TurnTimeLimit = 999, HiddenCardCount = 9 });
            Assert.Equal(32, g.Settings.RemovedCount);
            Assert.Equal(1, g.Settings.InitialTokens);
            Assert.Equal(300, g.Settings.TurnTimeLimit);
            Assert.Equal(5, g.Settings.HiddenCardCount);
            g.UpdateSettings(new SettingsPatch { RemovedCount = -3, TurnTimeLimit = -1, HiddenCardCount = 0 });
            Assert.Equal(1, g.Settings.RemovedCount);
            Assert.Equal(0, g.Settings.TurnTimeLimit);
            Assert.Equal(1, g.Settings.HiddenCardCount);
            g.Start();
            Assert.False(g.UpdateSettings(new SettingsPatch { RemovedCount = 5 }));
        }

        [Fact]
        public void Bot_Limits_And_Renaming()
        {
            var g = NewGame(1);
            Assert.NotNull(g.AddBot(BotDifficulty.Medium));
            var b2 = g.AddBot(BotDifficulty.Hard);
            Assert.NotNull(g.AddBot(BotDifficulty.Expert));
            Assert.Null(g.AddBot(BotDifficulty.Medium)); // 최대 3봇
            Assert.Equal("AI봇 2 (상)", b2.Nickname);
            Assert.True(g.RemoveBot(g.Players[1].Id));
            Assert.Equal(new[] { "AI봇 1 (상)", "AI봇 2 (최상)" }, g.Players.Where(p => p.IsBot).Select(p => p.Nickname).ToArray());

            var g7 = NewGame(6);
            Assert.NotNull(g7.AddBot(BotDifficulty.Medium));
            Assert.Null(g7.AddBot(BotDifficulty.Medium)); // 총 7명
            Assert.False(g7.AddPlayer("x", "X"));
        }

        [Fact]
        public void Duplicate_Nickname_Rejected_And_First_Is_Host()
        {
            var g = new GameEngine(new SystemRandom(3));
            Assert.True(g.AddPlayer("a", "Alice"));
            Assert.True(g.AddPlayer("b", "Bob"));
            Assert.Equal("a", g.HostId);
            g.AddBot(BotDifficulty.Medium);
            Assert.False(g.AddPlayer("c", "AI봇 1 (중)"));
            g.RemovePlayer("a");
            Assert.Equal("b", g.HostId); // 사람에게만 방장 양도
        }

        [Fact]
        public void Hidden_Card_First_Take_Reveals_Then_Takes()
        {
            var g = NewGame(2, 7);
            g.UpdateSettings(new SettingsPatch { GameMode = GameMode.Hidden, HiddenCardCount = 5 });
            g.Start();
            Assert.Equal(5, g.HiddenCards.Count);
            // 숨김 카드가 나올 때까지 진행
            int guard = 0;
            while (!g.IsCurrentCardHidden && g.Started && guard++ < 40) g.TakeCard(g.CurrentPlayer.Id);
            Assert.True(g.IsCurrentCardHidden);
            var p = g.CurrentPlayer;
            var card = g.CurrentCard.Value;
            int before = p.Cards.Count;
            var r1 = g.TakeCard(p.Id);
            Assert.True(r1.IsHiddenRevealed && r1.NeedsDelay);
            Assert.Equal(before, p.Cards.Count);
            Assert.False(g.IsCurrentCardHidden);
            var r2 = g.TakeCard(p.Id);
            Assert.False(r2.IsHiddenRevealed);
            Assert.Contains(card, p.Cards);
        }

        [Fact]
        public void SoftReset_Removes_Bots_And_Resets_Settings()
        {
            var g = NewGame(1);
            g.AddBot(BotDifficulty.Hard);
            g.UpdateSettings(new SettingsPatch { InitialTokens = 20 });
            g.Start();
            g.SoftReset();
            Assert.Single(g.Players);
            Assert.False(g.Players[0].IsBot);
            Assert.Equal(11, g.Settings.InitialTokens);
            Assert.Equal("p0", g.HostId);
            Assert.False(g.Started);
        }

        [Fact]
        public void Player_Order_Is_Shuffled_Across_Seeds()
        {
            var firsts = new HashSet<string>();
            for (int seed = 0; seed < 30; seed++)
            {
                var g = NewGame(4, seed);
                g.Start();
                firsts.Add(g.Players[0].Id);
            }
            Assert.True(firsts.Count >= 3);
        }
    }
}
