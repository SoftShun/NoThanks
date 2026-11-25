using System.Collections.Generic;
using System.Linq;
using NoThanks.Core;
using NoThanks.Core.Bots;
using Xunit;

namespace NoThanks.Core.Tests
{
    public class BotTests
    {
        private static (GameEngine g, PlayerData bot) Setup(BotDifficulty d, int seed = 5)
        {
            var g = new GameEngine(new SystemRandom(seed));
            g.AddPlayer("h", "Human");
            var bot = g.AddBot(d);
            g.Start();
            return (g, bot);
        }

        [Theory]
        [InlineData(BotDifficulty.Medium, 0.5, 0.3, 0.1, 0.15)]
        [InlineData(BotDifficulty.Hard, 0.7, 0.6, 0.3, 0.25)]
        [InlineData(BotDifficulty.Expert, 0.8, 0.8, 0.5, 0.35)]
        public void Tendency_Matches_Master(BotDifficulty d, double risk, double emo, double learn, double rnd)
        {
            var t = BotBrain.InitializeTendency(d);
            Assert.Equal(risk, t.RiskTolerance);
            Assert.Equal(emo, t.EmotionalIntensity);
            Assert.Equal(learn, t.LearningRate);
            Assert.Equal(rnd, t.Randomness);
        }

        [Theory]
        [InlineData(BotDifficulty.Medium, 800, 2800)]
        [InlineData(BotDifficulty.Hard, 900, 3700)]
        [InlineData(BotDifficulty.Expert, 1000, 4500)]
        public void Think_Delay_Range(BotDifficulty d, double min, double max)
        {
            Assert.Equal(min, BotBrain.ThinkDelayMs(d, 0));
            Assert.Equal(max, BotBrain.ThinkDelayMs(d, 1));
        }

        [Fact]
        public void Base_Max_Loss()
        {
            Assert.Equal(6, BotBrain.BaseMaxLoss(BotDifficulty.Medium));
            Assert.Equal(8, BotBrain.BaseMaxLoss(BotDifficulty.Hard));
            Assert.Equal(12, BotBrain.BaseMaxLoss(BotDifficulty.Expert));
        }

        [Fact]
        public void Emotions_Initialized_In_Ranges()
        {
            for (int s = 0; s < 50; s++)
            {
                var (_, bot) = Setup(BotDifficulty.Hard, s);
                var e = bot.Brain.Emotions;
                Assert.InRange(e.Mood, 0.3, 0.7);
                Assert.InRange(e.Confidence, 0.3, 0.7);
                Assert.InRange(e.Competitiveness, 0.2, 0.8);
                Assert.InRange(e.Greed, 0.3, 0.7);
                Assert.Equal(0, e.Frustration);
                Assert.Equal(0, e.Vengeful);
            }
        }

        [Fact]
        public void No_Chips_Means_Take()
        {
            foreach (BotDifficulty d in new[] { BotDifficulty.Medium, BotDifficulty.Hard, BotDifficulty.Expert })
            {
                var (g, bot) = Setup(d);
                bot.Tokens = 0;
                Assert.Equal(BotBrain.Take, bot.Brain.MakeDecision(g.GetState()));
            }
        }

        [Fact]
        public void Clear_Profit_Is_Taken()
        {
            // 칩 20개가 쌓인 3번 카드 → 명백한 이익 ("전략적 이익" → 무작위 보호)
            foreach (BotDifficulty d in new[] { BotDifficulty.Medium, BotDifficulty.Hard, BotDifficulty.Expert })
            {
                for (int seed = 0; seed < 20; seed++)
                {
                    var (g, bot) = Setup(d, seed);
                    g.CurrentCard = 3;
                    g.PileTokens = 20;
                    Assert.Equal(BotBrain.Take, bot.Brain.MakeDecision(g.GetState()));
                }
            }
        }

        [Fact]
        public void Expensive_Isolated_Card_Is_Usually_Passed_Early()
        {
            int passes = 0, trials = 60;
            for (int seed = 0; seed < trials; seed++)
            {
                var (g, bot) = Setup(BotDifficulty.Medium, seed);
                g.CurrentCard = 35;
                g.PileTokens = 0;
                if (bot.Brain.MakeDecision(g.GetState()) == BotBrain.Pass) passes++;
            }
            Assert.True(passes > trials * 0.8, "passes=" + passes);
        }

        [Fact]
        public void Connection_Bonus_Uses_Actual_Score_Delta()
        {
            var (g, bot) = Setup(BotDifficulty.Medium);
            bot.Cards = new List<int> { 20 };
            // 21 은 20 과 연결 → 점수 증가 0 → 절약 21
            Assert.Equal(21, bot.Brain.GetConnectionBonus(21, null), 6);
            // 22 는 간접 연결 → 절약 0 + min(0*0.1, 22*0.05)=0
            Assert.Equal(0, bot.Brain.GetConnectionBonus(22, null), 6);
            // 19 는 20 앞 → 새 점수 19, 증가 -1 → 절약 20
            Assert.Equal(20, bot.Brain.GetConnectionBonus(19, null), 6);
        }

        [Fact]
        public void Card_Availability_Risk()
        {
            var map = BotBrain.AnalyzeCardAvailability(new List<int> { 10, 12 });
            Assert.Equal(1.0, map[11]);
            Assert.Equal(0.5, map[9]);
            Assert.Equal(0.0, map[20]);
        }

        [Fact]
        public void Hidden_Decision_Threshold_By_Difficulty()
        {
            var (g, bot) = Setup(BotDifficulty.Medium);
            g.HiddenCards.Add(g.CurrentCard.Value);
            bot.Brain.Emotions.Confidence = 0.5; bot.Brain.Emotions.Greed = 0.5; bot.Brain.Emotions.Frustration = 0;
            var st = g.GetState();
            Assert.True(st.IsCurrentCardHidden);
            g.PileTokens = 0;
            Assert.Equal(BotBrain.Pass, bot.Brain.MakeDecision(g.GetState()));
            g.PileTokens = 40;
            Assert.Equal(BotBrain.Take, bot.Brain.MakeDecision(g.GetState()));
        }

        [Fact]
        public void Observations_Are_Capped()
        {
            var (_, bot) = Setup(BotDifficulty.Expert);
            for (int i = 0; i < 30; i++) bot.Brain.ObservePlayerAction("h", "take", 10 + (i % 5), 1);
            Assert.Equal(20, bot.Brain.PlayerRelations["h"].ObservedPatterns.Count);
            for (int i = 0; i < 20; i++) bot.Brain.LearnFromSituation(10, 1, new List<PlayerView>(), "take");
            Assert.Equal(15, bot.Brain.GameEvents.Count);
        }

        [Fact]
        public void React_To_Event_Uses_Intensity()
        {
            var (_, bot) = Setup(BotDifficulty.Expert);
            bot.Brain.ReactToEvent("someone_took_my_card", "h");
            Assert.Equal(0.3 * 0.8, bot.Brain.Emotions.Vengeful, 6);
            Assert.Equal(0.2, bot.Brain.PlayerRelations["h"].Rivalry, 6);
        }

        [Theory]
        [InlineData(BotDifficulty.Medium)]
        [InlineData(BotDifficulty.Hard)]
        [InlineData(BotDifficulty.Expert)]
        public void Bots_Only_Games_Complete_With_Valid_Decisions(BotDifficulty d)
        {
            for (int seed = 0; seed < 25; seed++)
            {
                var g = new GameEngine(new SystemRandom(seed));
                g.AddPlayer("h", "Human");
                g.AddBot(d); g.AddBot(BotDifficulty.Hard); g.AddBot(BotDifficulty.Expert);
                if (seed % 2 == 0) g.UpdateSettings(new SettingsPatch { GameMode = GameMode.Hidden });
                g.Start();
                // 사람 자리도 봇 두뇌로 대신 둔다
                var human = g.Players.First(p => !p.IsBot);
                human.Brain = new BotBrain(human, BotDifficulty.Medium, g.Random);
                int steps = 0;
                while (g.Started && steps++ < 2000)
                {
                    var cur = g.CurrentPlayer;
                    var act = cur.Brain.MakeDecision(g.GetState());
                    Assert.True(act == BotBrain.Take || act == BotBrain.Pass);
                    var r = act == BotBrain.Take ? g.TakeCard(cur.Id) : g.Pass(cur.Id);
                    Assert.False(r.IsError);
                }
                Assert.False(g.Started);
                Assert.Equal(24, g.Players.Sum(p => p.Cards.Count));
                Assert.Equal(4 * 11, g.Players.Sum(p => p.Tokens)); // 칩 총량 보존
            }
        }
    }
}
