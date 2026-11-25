using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using NoThanks.Core;
using NoThanks.Core.Bots;
using Xunit;
using Xunit.Abstractions;

namespace NoThanks.Core.Tests
{
    /// <summary>
    /// master server/bot.js 를 Node 로 실행한 결과(parity/gen-bot-parity.js 가 생성)와
    /// C# BotBrain 의 결과를 비교한다. 같은 난수열을 주입하므로 결정·근거·감정 변화·난수 소비 횟수가 모두 같아야 한다.
    /// </summary>
    public class BotParityTests
    {
        private readonly ITestOutputHelper _out;
        public BotParityTests(ITestOutputHelper output) { _out = output; }

        private static string FixturePath()
        {
            var dir = AppContext.BaseDirectory;
            for (int i = 0; i < 6; i++)
            {
                var p = Path.Combine(dir, "bot-parity-cases.json");
                if (File.Exists(p)) return p;
                dir = Path.GetDirectoryName(dir.TrimEnd(Path.DirectorySeparatorChar));
            }
            throw new FileNotFoundException("bot-parity-cases.json");
        }

        private sealed class CountingRandom : IRandom
        {
            private readonly double[] _v;
            public int Used;
            public CountingRandom(double[] v) { _v = v; }
            public double NextDouble() { var x = _v[Used % _v.Length]; Used++; return x; }
        }

        [Fact]
        public void CSharp_Bot_Matches_Master_BotJs()
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(FixturePath()));
            int n = 0, mismatches = 0;
            foreach (var c in doc.RootElement.EnumerateArray())
            {
                n++;
                var rng = new CountingRandom(c.GetProperty("rng").EnumerateArray().Select(x => x.GetDouble()).ToArray());
                BotDifficulty diff;
                BotDifficultyExt.TryParseWire(c.GetProperty("difficulty").GetString(), out diff);
                var subjectId = c.GetProperty("subjectId").GetString();

                var views = new List<PlayerView>();
                PlayerData self = null;
                foreach (var p in c.GetProperty("players").EnumerateArray())
                {
                    var cards = p.GetProperty("cards").EnumerateArray().Select(x => x.GetInt32()).ToList();
                    var id = p.GetProperty("id").GetString();
                    var v = new PlayerView(id, p.GetProperty("nickname").GetString(), p.GetProperty("tokens").GetInt32(), cards, p.GetProperty("isBot").GetBoolean());
                    views.Add(v);
                    if (id == subjectId)
                        self = new PlayerData { Id = id, Nickname = v.Nickname, Tokens = v.Tokens, Cards = new List<int>(cards), IsBot = true, Difficulty = diff };
                }
                var brain = new BotBrain(self, diff, rng);
                self.Brain = brain;
                var em = c.GetProperty("emotions");
                brain.Emotions.Mood = em.GetProperty("mood").GetDouble();
                brain.Emotions.Confidence = em.GetProperty("confidence").GetDouble();
                brain.Emotions.Competitiveness = em.GetProperty("competitiveness").GetDouble();
                brain.Emotions.Frustration = em.GetProperty("frustration").GetDouble();
                brain.Emotions.Greed = em.GetProperty("greed").GetDouble();
                brain.Emotions.Vengeful = em.GetProperty("vengeful").GetDouble();
                var rel = new PlayerRelation { Rivalry = c.GetProperty("rivalry").GetDouble(), Trust = 0.5 };
                foreach (var o in c.GetProperty("observations").EnumerateArray())
                    rel.ObservedPatterns.Add(new ObservedAction { Type = o.GetProperty("type").GetString(), Card = o.GetProperty("card").GetInt32(), Tokens = o.GetProperty("tokens").GetInt32() });
                brain.PlayerRelations["h"] = rel;

                var snap = new GameSnapshot
                {
                    Players = views,
                    CurrentCard = c.GetProperty("currentCard").GetInt32(),
                    PileTokens = c.GetProperty("pileTokens").GetInt32(),
                    DeckSize = c.GetProperty("deckSize").GetInt32(),
                    RemovedCount = 9,
                    RemovedCards = c.GetProperty("removedCards").EnumerateArray().Select(x => x.GetInt32()).ToList(),
                    IsCurrentCardHidden = c.GetProperty("hidden").GetBoolean(),
                    Started = true,
                };

                var decision = brain.MakeDecision(snap);
                var exp = c.GetProperty("expected");
                var errs = new List<string>();
                if (decision != exp.GetProperty("decision").GetString()) errs.Add("decision " + decision + " != " + exp.GetProperty("decision").GetString());
                if (!snap.IsCurrentCardHidden && brain.LastBasicReason != exp.GetProperty("basicReason").GetString())
                    errs.Add("reason '" + brain.LastBasicReason + "' != '" + exp.GetProperty("basicReason").GetString() + "'");
                if (rng.Used != exp.GetProperty("rngUsed").GetInt32()) errs.Add("rngUsed " + rng.Used + " != " + exp.GetProperty("rngUsed").GetInt32());
                var ea = exp.GetProperty("emotionsAfter");
                void Cmp(string name, double actual)
                {
                    var e = ea.GetProperty(name).GetDouble();
                    if (Math.Abs(e - actual) > 1e-9) errs.Add(name + " " + actual + " != " + e);
                }
                Cmp("mood", brain.Emotions.Mood);
                Cmp("confidence", brain.Emotions.Confidence);
                Cmp("frustration", brain.Emotions.Frustration);
                Cmp("greed", brain.Emotions.Greed);
                if (brain.GameEvents.Count != exp.GetProperty("gameEvents").GetInt32()) errs.Add("gameEvents");

                if (errs.Count > 0)
                {
                    mismatches++;
                    if (mismatches <= 10) _out.WriteLine("case " + (n - 1) + ": " + string.Join("; ", errs));
                }
            }
            _out.WriteLine("cases=" + n + " mismatches=" + mismatches);
            Assert.True(n >= 500);
            Assert.Equal(0, mismatches);
        }
    }
}
