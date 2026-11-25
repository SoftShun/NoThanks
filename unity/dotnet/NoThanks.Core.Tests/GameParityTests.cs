using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using NoThanks.Core;
using Xunit;

namespace NoThanks.Core.Tests
{
    /// <summary>master server/game.js 를 Node 로 실행한 전체 게임 기록(parity/gen-game-parity.js)과 C# GameEngine 비교.</summary>
    public class GameParityTests
    {
        private sealed class ArrayRandom : IRandom
        {
            private readonly double[] _v; private int _i;
            public ArrayRandom(double[] v) { _v = v; }
            public double NextDouble() { var x = _v[_i % _v.Length]; _i++; return x; }
        }

        private static string Fixture(string name)
        {
            var dir = AppContext.BaseDirectory;
            for (int i = 0; i < 6; i++)
            {
                var p = Path.Combine(dir, name);
                if (File.Exists(p)) return p;
                dir = Path.GetDirectoryName(dir.TrimEnd(Path.DirectorySeparatorChar));
            }
            throw new FileNotFoundException(name);
        }

        [Fact]
        public void CSharp_Engine_Matches_Master_GameJs()
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(Fixture("game-parity-cases.json")));
            int count = 0;
            foreach (var c in doc.RootElement.EnumerateArray())
            {
                count++;
                var g = new GameEngine(new ArrayRandom(c.GetProperty("rng").EnumerateArray().Select(x => x.GetDouble()).ToArray()));
                int n = c.GetProperty("n").GetInt32();
                for (int i = 0; i < n; i++) g.AddPlayer("p" + i, "P" + i);
                var st = c.GetProperty("settings");
                g.UpdateSettings(new SettingsPatch
                {
                    RemovedCount = st.GetProperty("removedCount").GetInt32(),
                    InitialTokens = st.GetProperty("initialTokens").GetInt32(),
                    GameMode = st.GetProperty("gameMode").GetString() == "hidden" ? GameMode.Hidden : GameMode.Normal,
                    HiddenCardCount = st.GetProperty("hiddenCardCount").GetInt32(),
                });
                g.Start();
                var exp = c.GetProperty("expected");
                Assert.Equal(exp.GetProperty("startOrder").EnumerateArray().Select(x => x.GetString()), g.Players.Select(p => p.Id));
                Assert.Equal(exp.GetProperty("removed").EnumerateArray().Select(x => x.GetInt32()), g.RemovedCards);
                Assert.Equal(exp.GetProperty("hidden").EnumerateArray().Select(x => x.GetInt32()), g.HiddenCards.OrderBy(x => x));

                var trace = exp.GetProperty("trace").EnumerateArray().ToList();
                int k = 0;
                foreach (var a in c.GetProperty("actions").EnumerateArray())
                {
                    var cur = g.CurrentPlayer;
                    var res = a.GetString() == "p" ? g.Pass(cur.Id) : g.TakeCard(cur.Id);
                    Assert.False(res.IsError);
                    var t = trace[k++].EnumerateArray().ToList();
                    int? expCard = t[0].ValueKind == JsonValueKind.Null ? (int?)null : t[0].GetInt32();
                    Assert.Equal(expCard, g.CurrentCard);
                    Assert.Equal(t[1].GetInt32(), g.PileTokens);
                    Assert.Equal(t[2].GetInt32(), g.CurrentPlayerIndex);
                    Assert.Equal(t[3].GetInt32() == 1, res.IsHiddenRevealed);
                }
                Assert.False(g.Started);
                var scores = g.CalculateScores();
                var es = exp.GetProperty("scores").EnumerateArray().ToList();
                Assert.Equal(es.Count, scores.Count);
                for (int i = 0; i < es.Count; i++)
                {
                    Assert.Equal(es[i].GetProperty("nickname").GetString(), scores[i].Nickname);
                    Assert.Equal(es[i].GetProperty("score").GetInt32(), scores[i].Score);
                    Assert.Equal(es[i].GetProperty("tokens").GetInt32(), scores[i].Tokens);
                    Assert.Equal(es[i].GetProperty("rank").GetInt32(), scores[i].Rank);
                    Assert.Equal(es[i].GetProperty("cards").EnumerateArray().Select(x => x.GetInt32()), scores[i].Cards);
                }
            }
            Assert.Equal(200, count);
        }
    }
}
