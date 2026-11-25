using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace NoThanks.Core.Bots
{
    public sealed class EmotionalState
    {
        public double Mood;
        public double Confidence;
        public double Competitiveness;
        public double Frustration;
        public double Greed;
        public double Vengeful;
    }

    public sealed class BaseTendency
    {
        public string Description;
        public double RiskTolerance;
        public double EmotionalIntensity;
        public double LearningRate;
        public double Randomness;
    }

    public sealed class ObservedAction
    {
        public string Type; // "take" | "pass"
        public int Card;
        public int Tokens;
    }

    public sealed class PlayerRelation
    {
        public double Rivalry;
        public double Trust = 0.5;
        public List<ObservedAction> ObservedPatterns = new List<ObservedAction>();
    }

    public sealed class GameEventRecord
    {
        public string Type; // "decision"
        public int Card;
        public int Tokens;
        public string MyDecision;
    }

    public sealed class ScoreEntry
    {
        public string Id;
        public string Nickname;
        public double Score;
        public int Tokens;
        public bool IsBot;
    }

    public sealed class OpponentRisk
    {
        public string Id;
        public string Nickname;
        public double Score;
        public int Tokens;
        public bool IsBot;
        public double RiskScore;
        public string RiskLevel;
        public List<string> RiskFactors = new List<string>();
        public bool ShouldBlock;

        /// <summary>bot.js 의 scores/opponentRisks 원소에는 cards 필드가 없다 → Cards=null 로 전달.</summary>
        public PlayerView AsView()
        {
            return new PlayerView(Id, Nickname, Tokens, null, IsBot);
        }
    }

    public sealed class OpponentAnalysis
    {
        public List<OpponentRisk> Opponents;
        public OpponentRisk PrimaryThreat;
        public bool ShouldUseBlockingStrategy;
        public double BlockingIntensity;
    }

    public sealed class Situation
    {
        public double GameProgress;
        public int MyRank;
        public int TotalPlayers;
        public double PointsFromLead;
        public double PointsFromLast;
        public double TokenAdvantage;
        public string RemainingCardsRisk;
        public bool IsLeading;
        public bool IsLastPlace;
        public bool IsCloseGame;
        public List<ScoreEntry> Scores;
        public OpponentAnalysis OpponentAnalysis;
        public List<PlayerView> Players;
        public Dictionary<int, double> ConnectionRisks; // analyzeCardAvailability().connectionRisks
    }

    public sealed class Strategy
    {
        public string Name;
        public string Description;
        public double RiskTolerance;
        public double ChipValue;
        public double ConnectionBonus;
        public bool BuildupMode;
        public bool IsBlocking;
        public OpponentRisk BlockTarget;
        public double BlockingIntensity;
    }

    public sealed class Decision
    {
        public string Action; // "take" | "pass"
        public string Reason;
        public string EmotionalReason;
        public string SocialReason;

        public Decision Copy() { return (Decision)MemberwiseClone(); }
    }

    /// <summary>
    /// master server/bot.js 의 Bot 클래스를 1:1 로 옮긴 의사결정 두뇌.
    /// - 난이도: medium(중) / hard(상) / expert(최상)
    /// - 4단계 파이프라인: 전략 판단 → 감정 보정 → 관계 보정 → 제한적 무작위
    /// - console.log 는 DecisionLog 로 대체 (UI 디버그 패널용)
    /// 분기 조건이 reason 문자열의 포함 여부('견제', '전략적' 등)에 의존하므로 문자열을 원본과 동일하게 유지한다.
    /// </summary>
    public sealed class BotBrain
    {
        public const string Take = "take";
        public const string Pass = "pass";

        private readonly PlayerData _self;
        private readonly IRandom _rng;

        public readonly BotDifficulty Difficulty;
        public readonly EmotionalState Emotions;
        public readonly BaseTendency Tendency;
        public readonly Dictionary<string, PlayerRelation> PlayerRelations = new Dictionary<string, PlayerRelation>();
        public List<GameEventRecord> GameEvents = new List<GameEventRecord>();

        /// <summary>마지막 결정 근거 (디버그 표시용).</summary>
        public string LastDecisionLog = "";
        /// <summary>마지막 1단계(전략) 판단 근거 문자열 (master 와의 패리티 테스트용).</summary>
        public string LastBasicReason = "";

        public BotBrain(PlayerData self, BotDifficulty difficulty, IRandom rng)
        {
            _self = self;
            _rng = rng;
            Difficulty = difficulty;
            // bot.js:22~29 (난수 호출 순서도 동일: mood, confidence, competitiveness, greed)
            Emotions = new EmotionalState
            {
                Mood = R() * 0.4 + 0.3,
                Confidence = R() * 0.4 + 0.3,
                Competitiveness = R() * 0.6 + 0.2,
                Frustration = 0,
                Greed = R() * 0.4 + 0.3,
                Vengeful = 0,
            };
            Tendency = InitializeTendency(difficulty);
        }

        private double R() { return _rng.NextDouble(); }

        private string Id { get { return _self.Id; } }
        private int Tokens { get { return _self.Tokens; } }
        private List<int> Cards { get { return _self.Cards; } }

        /// <summary>bot.js:48 initializeTendency()</summary>
        public static BaseTendency InitializeTendency(BotDifficulty difficulty)
        {
            switch (difficulty)
            {
                case BotDifficulty.Hard:
                    return new BaseTendency { Description = "감정적이고 경쟁적인 플레이어", RiskTolerance = 0.7, EmotionalIntensity = 0.6, LearningRate = 0.3, Randomness = 0.25 };
                case BotDifficulty.Expert:
                    return new BaseTendency { Description = "예측 불가능하고 전략적인 플레이어", RiskTolerance = 0.8, EmotionalIntensity = 0.8, LearningRate = 0.5, Randomness = 0.35 };
                default:
                    return new BaseTendency { Description = "일반적이고 예측 가능한 플레이어", RiskTolerance = 0.5, EmotionalIntensity = 0.3, LearningRate = 0.1, Randomness = 0.15 };
            }
        }

        /// <summary>index.js:66~76 봇 사고 시간 (ms). base + random * extra.</summary>
        public static double ThinkDelayMs(BotDifficulty d, double random01)
        {
            double baseDelay = 800, randomDelay = 2000;
            if (d == BotDifficulty.Expert) { baseDelay = 1000; randomDelay = 3500; }
            else if (d == BotDifficulty.Hard) { baseDelay = 900; randomDelay = 2800; }
            return baseDelay + random01 * randomDelay;
        }

        // ------------------------------------------------------------------
        // 메인 의사결정 (bot.js:83 makeDecision)
        // ------------------------------------------------------------------
        public string MakeDecision(GameSnapshot state)
        {
            try
            {
                if (!state.CurrentCard.HasValue || state.Players == null) return Pass;
                int currentCard = state.CurrentCard.Value;
                int pileTokens = state.PileTokens;

                if (state.IsCurrentCardHidden) return MakeHiddenCardDecision(currentCard, pileTokens, state);

                var basic = MakeBasicDecision(currentCard, pileTokens, state);
                LastBasicReason = basic.Reason;
                var emotional = ApplyEmotionalFactors(basic, currentCard, pileTokens, state.Players, state);
                var social = ConsiderPlayerRelations(emotional, currentCard, state.Players, state);
                var final = AddFinalRandomness(social, currentCard, pileTokens);

                UpdateEmotionsAfterDecision(final, currentCard, pileTokens);
                LearnFromSituation(currentCard, pileTokens, state.Players, final);

                LastDecisionLog = "기본: " + basic.Action + " (" + basic.Reason + ") / 감정: " + emotional.EmotionalReason + " / 관계: " + social.SocialReason + " → " + final;

                if (final != Take && final != Pass) return Pass;
                return final;
            }
            catch (Exception)
            {
                return Tokens > 0 ? Pass : Take;
            }
        }

        /// <summary>bot.js:140 makeBasicDecision()</summary>
        public Decision MakeBasicDecision(int currentCard, int pileTokens, GameSnapshot state)
        {
            if (Tokens <= 0) return new Decision { Action = Take, Reason = "토큰 없음" };

            var removed = state.RemovedCards ?? new List<int>();
            double realCost = CalculateRealCost(currentCard, pileTokens, removed);
            var situation = AnalyzeGameSituation(state);
            var strategy = SelectStrategy(situation, currentCard, pileTokens, realCost);
            return ExecuteStrategy(strategy, currentCard, pileTokens, realCost, situation);
        }

        /// <summary>bot.js:167 selectStrategy()</summary>
        public Strategy SelectStrategy(Situation situation, int currentCard, int pileTokens, double realCost)
        {
            try
            {
                if (situation == null) return GetDefaultStrategy();
                double gameProgress = situation.GameProgress;
                int myRank = situation.MyRank;
                double pointsFromLead = situation.PointsFromLead;
                double pointsFromLast = situation.PointsFromLast;
                double tokenAdvantage = situation.TokenAdvantage;
                bool isLeading = situation.IsLeading;
                bool isLastPlace = situation.IsLastPlace;
                var opp = situation.OpponentAnalysis;

                // 0. 견제 전략 우선
                if (opp.ShouldUseBlockingStrategy)
                {
                    var threat = opp.PrimaryThreat;
                    bool threatWantsCard = WouldPlayerWantCard(threat.AsView(), currentCard);
                    if (threatWantsCard && gameProgress > 0.4)
                    {
                        double intensity = opp.BlockingIntensity;
                        return new Strategy
                        {
                            Name = "견제_전략",
                            Description = threat.Nickname + " 견제 (위험도: " + threat.RiskLevel + ")",
                            RiskTolerance = 0.7 + (intensity * 0.8),
                            ChipValue = 0.8,
                            ConnectionBonus = 1.0,
                            IsBlocking = true,
                            BlockTarget = threat,
                            BlockingIntensity = intensity,
                        };
                    }
                }

                // 1. 초반 (0~30%)
                if (gameProgress < 0.3)
                {
                    if (myRank >= Math.Ceiling(situation.TotalPlayers * 0.7))
                        return S("초반_꼴찌탈출", "꼴찌 탈출을 위한 적극적 플레이", 1.0, 1.5, 1.4);
                    if (tokenAdvantage < -3)
                        return S("초반_칩파밍", "1등을 위한 칩 확보 우선", 0.8, 2.0, 1.0);
                    if (Cards.Count <= 1)
                    {
                        var st = S("초반_빌드업", "1등을 위한 적극적 빌드업", 0.9, 1.4, 1.5);
                        st.BuildupMode = true;
                        return st;
                    }
                    return S("초반_선별적", "1등을 위한 선택적 플레이", 0.6, 1.3, 1.3);
                }

                // 후반 (70%+)
                if (gameProgress >= 0.7)
                {
                    if (isLastPlace && pointsFromLast > 8) return S("후반_절망적_도박", "꼴찌 탈출을 위한 필사적 도박", 2.5, 0.6, 0.8);
                    if (isLastPlace && pointsFromLast > 3) return S("후반_꼴찌탈출", "꼴찌 회피를 위한 적극적 플레이", 1.5, 0.8, 1.2);
                    if (isLeading && pointsFromLead < -5) return S("후반_1등확정", "1등 확정을 위한 안전한 플레이", 0.2, 1.5, 1.2);
                    if (myRank == 1 || pointsFromLead <= 3) return S("후반_1등경쟁", "1등 경쟁을 위한 전략적 플레이", 0.7, 1.1, 1.3);
                    if (!isLeading && pointsFromLead <= 8) return S("후반_1등추격", "1등 추격을 위한 공격적 플레이", 1.3, 0.8, 1.4);
                    return S("후반_순위유지", "현재 순위 유지 플레이", 0.7, 1.0, 1.2);
                }

                // 2. 중반 (30~70%)
                if (myRank >= Math.Ceiling(situation.TotalPlayers * 0.8))
                    return S("중반_꼴찌위험", "꼴찌 위험 - 즉시 탈출 필요", 1.2, 0.9, 1.3);

                if (isLeading)
                {
                    if (pointsFromLead < -3) return S("중반_1등유지", "1등 우위 유지", 0.4, 1.3, 1.1);
                    return S("중반_1등불안", "1등이지만 불안정 - 신중하게", 0.5, 1.2, 1.2);
                }

                if (myRank <= 3 && pointsFromLead <= 5)
                {
                    if (tokenAdvantage > 2) return S("중반_1등도전_칩우위", "1등 도전 - 칩 우위 활용", 0.9, 0.8, 1.3);
                    return S("중반_1등도전", "1등 도전을 위한 균형잡힌 플레이", 0.7, 1.1, 1.2);
                }

                if (myRank >= Math.Ceiling(situation.TotalPlayers * 0.4))
                    return S("중반_상위추격", "상위권 진입을 위한 적극적 플레이", 1.0, 0.9, 1.3);

                if (tokenAdvantage < -2)
                    return S("중반_칩부족_보존", "칩 부족 시 보존 우선", 0.2, 1.5, 1.0);

                return S("중반_균형", "중반 균형잡힌 플레이", 0.5, 1.0, 1.1);
            }
            catch (Exception)
            {
                return GetDefaultStrategy();
            }
        }

        private static Strategy S(string name, string desc, double risk, double chip, double conn)
        {
            return new Strategy { Name = name, Description = desc, RiskTolerance = risk, ChipValue = chip, ConnectionBonus = conn };
        }

        /// <summary>bot.js:383 getDefaultStrategy()</summary>
        public static Strategy GetDefaultStrategy()
        {
            return S("기본_안전", "안전한 기본 전략", 0.3, 1.0, 1.0);
        }

        /// <summary>bot.js:396 executeBuildupStrategy()</summary>
        private Decision ExecuteBuildupStrategy(int currentCard, int pileTokens, double strategicCost, double strategicMaxLoss, Situation situation)
        {
            if (currentCard <= 15)
            {
                double limit = strategicMaxLoss + 6;
                if (strategicCost <= limit)
                    return new Decision { Action = Take, Reason = "빌드업_낮은카드 (" + currentCard + "≤15, " + F1(strategicCost) + "점)" };
            }

            if (currentCard >= 25 && situation.ConnectionRisks != null)
            {
                double futureValue = AnalyzeFutureConnections(currentCard, situation.ConnectionRisks);
                if (futureValue > 0)
                {
                    double limit = strategicMaxLoss + futureValue + 3;
                    if (strategicCost <= limit)
                        return new Decision { Action = Take, Reason = "빌드업_고카드투자 (" + currentCard + "≥25, 미래가치" + F1(futureValue) + "점)" };
                }
            }

            var interference = CalculateOpponentInterference(currentCard, situation.Players);
            if (interference.IsLowInterference)
            {
                double limit = strategicMaxLoss + 2;
                if (strategicCost <= limit)
                    return new Decision { Action = Take, Reason = "빌드업_간섭최소 (상대방 관심도 낮음, " + F1(strategicCost) + "점)" };
            }

            if (Cards.Count == 0 && currentCard <= 28)
            {
                double limit = strategicMaxLoss + 8;
                if (strategicCost <= limit)
                    return new Decision { Action = Take, Reason = "빌드업_급구 (카드0개, " + F1(strategicCost) + "점)" };
            }
            return null;
        }

        /// <summary>bot.js:445 analyzeFutureConnections()</summary>
        public static double AnalyzeFutureConnections(int currentCard, Dictionary<int, double> connectionRisks)
        {
            if (connectionRisks == null) return 0;
            double futureValue = 0;
            foreach (var adj in new[] { currentCard - 1, currentCard + 1 })
            {
                if (adj >= GameRules.MinCard && adj <= GameRules.MaxCard)
                {
                    double risk;
                    if (connectionRisks.TryGetValue(adj, out risk))
                    {
                        double p = 1 - risk;
                        futureValue += adj * p * 0.3;
                    }
                }
            }
            if (currentCard >= 30) futureValue *= 1.5;
            return futureValue;
        }

        public struct Interference
        {
            public double TotalInterference;
            public double AvgInterference;
            public int InterferingOpponents;
            public bool IsLowInterference;
            public bool IsHighInterference;
        }

        /// <summary>bot.js:474 calculateOpponentInterference()</summary>
        private Interference CalculateOpponentInterference(int currentCard, List<PlayerView> players)
        {
            double total = 0;
            int interfering = 0;
            foreach (var opponent in players.Where(p => p.Id != Id))
            {
                int wantLevel = 0;
                if (opponent.IsBot && opponent.Cards != null)
                {
                    int? found = null;
                    foreach (var c in opponent.Cards) { if (Math.Abs(c - currentCard) <= 2) { found = c; break; } }
                    if (found.HasValue) wantLevel = Math.Abs(found.Value - currentCard) == 1 ? 3 : 1;
                }
                else
                {
                    wantLevel = EstimateHumanPlayerWant(opponent, currentCard);
                }
                if (wantLevel > 0)
                {
                    total += wantLevel;
                    interfering++;
                }
            }
            double avg = interfering > 0 ? total / interfering : 0;
            return new Interference
            {
                TotalInterference = total,
                AvgInterference = avg,
                InterferingOpponents = interfering,
                IsLowInterference = avg <= 1 && interfering <= 1,
                IsHighInterference = avg >= 2 || interfering >= 2,
            };
        }

        /// <summary>difficulty 별 기본 허용 손실 (bot.js:527~534, 592~593).</summary>
        public static double BaseMaxLoss(BotDifficulty d)
        {
            if (d == BotDifficulty.Medium) return 6;
            if (d == BotDifficulty.Hard) return 8;
            return 12;
        }

        /// <summary>bot.js:516 executeStrategy()</summary>
        public Decision ExecuteStrategy(Strategy strategy, int currentCard, int pileTokens, double realCost, Situation situation)
        {
            if (strategy.IsBlocking) return ExecuteBlockingStrategy(strategy, currentCard, pileTokens, realCost, situation);

            double strategicRiskTolerance = Tendency.RiskTolerance * strategy.RiskTolerance;
            double baseMaxLoss = BaseMaxLoss(Difficulty);
            double strategicMaxLoss = baseMaxLoss * strategicRiskTolerance;

            double adjustedChipValue = pileTokens * strategy.ChipValue;
            double adjustedConnectionBonus = GetConnectionBonus(currentCard, null) * strategy.ConnectionBonus;
            double strategicCost = currentCard - adjustedConnectionBonus - adjustedChipValue;

            // 1. 명백한 이익
            if (strategicCost <= 0)
                return new Decision { Action = Take, Reason = "전략적 이익 (" + F1(Math.Abs(strategicCost)) + "점 득, " + strategy.Name + ")" };

            // 2. 경쟁 분석
            var comp = AnalyzeCardCompetition(currentCard, situation.Players);
            if (comp.ShouldForceTake)
            {
                double limit = strategicMaxLoss + comp.CompetitionBonus;
                if (strategicCost <= limit)
                    return new Decision { Action = Take, Reason = "경쟁차단 (" + F1(strategicCost) + "점, " + comp.Reason + ")" };
            }
            if (comp.ShouldAvoidTake)
                return new Decision { Action = Pass, Reason = "상대이익방지 (" + comp.Reason + ")" };

            // 3. 칩이 많이 쌓인 경우
            if (pileTokens >= 8)
            {
                double chipBonusLimit = strategicMaxLoss + Math.Min(pileTokens * 0.5, 8);
                if (strategicCost <= chipBonusLimit)
                    return new Decision { Action = Take, Reason = "고칩보상 (" + F1(strategicCost) + "점, 칩" + pileTokens + "개로 " + F1(chipBonusLimit) + "점까지 허용)" };
            }

            // 3'. 초반 빌드업
            if (strategy.BuildupMode || (situation.GameProgress < 0.4 && Cards.Count <= 2))
            {
                var b = ExecuteBuildupStrategy(currentCard, pileTokens, strategicCost, strategicMaxLoss, situation);
                if (b != null) return b;
            }

            // 4. 직접 연결
            if (HasDirectConnection(currentCard))
            {
                if (strategicCost <= strategicMaxLoss + 3)
                    return new Decision { Action = Take, Reason = "전략적 직접연결 (" + F1(strategicCost) + "점, " + strategy.Name + ")" };
            }

            // 5. 간접 연결
            if (HasIndirectConnection(currentCard) && strategicCost <= strategicMaxLoss + 1)
                return new Decision { Action = Take, Reason = "전략적 간접연결 (" + F1(strategicCost) + "점, " + strategy.Name + ")" };

            // 6. 허용 범위
            if (strategicCost <= strategicMaxLoss)
                return new Decision { Action = Take, Reason = "전략적 허용범위 (" + F1(strategicCost) + "점 ≤ " + F1(strategicMaxLoss) + "점, " + strategy.Name + ")" };

            return new Decision { Action = Pass, Reason = "전략적 거부 (" + F1(strategicCost) + "점 > " + F1(strategicMaxLoss) + "점, " + strategy.Name + ")" };
        }

        /// <summary>bot.js:585 executeBlockingStrategy()</summary>
        private Decision ExecuteBlockingStrategy(Strategy strategy, int currentCard, int pileTokens, double realCost, Situation situation)
        {
            var target = strategy.BlockTarget;
            double baseMaxLoss = BaseMaxLoss(Difficulty);
            double blockingBonus = strategy.BlockingIntensity * 10;
            double blockingMaxLoss = baseMaxLoss * strategy.RiskTolerance + blockingBonus;

            double adjustedChipValue = pileTokens * 1.0;
            double connectionBonus = GetConnectionBonus(currentCard, null);
            double blockingCost = currentCard - connectionBonus - adjustedChipValue;

            if (blockingCost <= 0)
                return new Decision { Action = Take, Reason = "견제+이익 (" + F1(Math.Abs(blockingCost)) + "점 득, " + target.Nickname + " 차단)" };

            if (blockingCost <= blockingMaxLoss)
            {
                var why = string.Join(", ", target.RiskFactors.Take(2));
                return new Decision { Action = Take, Reason = "견제 실행 (" + F1(blockingCost) + "점 손실, " + target.Nickname + " 차단: " + why + ")" };
            }
            return new Decision { Action = Pass, Reason = "견제 포기 (" + F1(blockingCost) + "점 > " + F1(blockingMaxLoss) + "점, 손실 과다)" };
        }

        /// <summary>bot.js:628 calculateRealCost()</summary>
        public double CalculateRealCost(int currentCard, int pileTokens, List<int> removedCards)
        {
            return currentCard - GetConnectionBonus(currentCard, removedCards) - pileTokens;
        }

        /// <summary>bot.js:639 getConnectionBonus() — 실제 점수 증가량 기반 연결 보너스 (+ 간접 연결 소폭 가산).</summary>
        public double GetConnectionBonus(int currentCard, List<int> removedCards)
        {
            try
            {
                var temp = new List<int>(Cards) { currentCard };
                double currentPure = CalculatePlayerScore(Cards, 0);
                double newPure = CalculatePlayerScore(temp, 0);
                double actualIncrease = newPure - currentPure;
                double savings = currentCard - actualIncrease;

                var indirect = Cards.Where(c => Math.Abs(c - currentCard) == 2).ToList();
                double finalBonus = Math.Max(0, savings);

                if (indirect.Count > 0)
                {
                    double indirectBonus = Math.Min(savings * 0.1, currentCard * 0.05);
                    if (removedCards != null && removedCards.Count > 0)
                    {
                        foreach (var ic in indirect)
                        {
                            // (ic + currentCard) 는 항상 짝수 차이 2 → 정수 다리 카드
                            int bridge = (ic + currentCard) / 2;
                            if (removedCards.Contains(bridge)) indirectBonus *= 0.2;
                        }
                    }
                    finalBonus = Math.Max(0, savings + indirectBonus);
                }
                return finalBonus;
            }
            catch (Exception)
            {
                return 0;
            }
        }

        public bool HasDirectConnection(int currentCard) { return Cards.Any(c => Math.Abs(c - currentCard) == 1); }
        public bool HasIndirectConnection(int currentCard) { return Cards.Any(c => Math.Abs(c - currentCard) == 2); }

        // ------------------------------------------------------------------
        // 2단계: 감정 보정 (bot.js:730 applyEmotionalFactors)
        // ------------------------------------------------------------------
        public Decision ApplyEmotionalFactors(Decision basic, int currentCard, int pileTokens, List<PlayerView> players, GameSnapshot state)
        {
            var decision = basic.Copy();
            var reasons = new List<string>();
            var e = Emotions;

            if (basic.Reason != null && basic.Reason.Contains("견제"))
            {
                reasons.Add("견제 전략 유지");
                decision.EmotionalReason = string.Join(", ", reasons);
                return decision;
            }

            double realCost = CalculateRealCost(currentCard, pileTokens, null);

            if (e.Mood > 0.7)
            {
                if (basic.Action == Pass && realCost > 0 && realCost <= 4)
                {
                    double chance = Math.Min(0.3, (e.Mood - 0.7) * 1.0);
                    if (R() < chance) { decision.Action = Take; reasons.Add("기분 좋아서 약간 과감"); }
                }
            }
            if (e.Mood < 0.3)
            {
                if (basic.Action == Take && realCost > 1 && realCost <= 6)
                {
                    double chance = Math.Min(0.25, (0.3 - e.Mood) * 0.8);
                    if (R() < chance) { decision.Action = Pass; reasons.Add("기분 나빠서 더 신중"); }
                }
            }
            if (e.Confidence > 0.8)
            {
                if (basic.Action == Pass && realCost > 0 && realCost <= 3)
                {
                    double chance = Math.Min(0.2, (e.Confidence - 0.8) * 1.0);
                    if (R() < chance) { decision.Action = Take; reasons.Add("자신감으로 위험 감수"); }
                }
            }
            if (e.Frustration > 0.6)
            {
                if (basic.Action == Take && realCost > 0 && realCost <= 5)
                {
                    double chance = Math.Min(0.3, (e.Frustration - 0.6) * 0.75);
                    if (R() < chance) { decision.Action = Pass; reasons.Add("좌절감으로 극도로 신중"); }
                }
            }
            if (e.Competitiveness > 0.8)
            {
                bool leading = IsCurrentlyLeading(players);
                if (!leading && basic.Action == Pass && realCost > 0 && realCost <= 8)
                {
                    double chance = Math.Min(0.15, (e.Competitiveness - 0.8) * 0.75);
                    if (R() < chance) { decision.Action = Take; reasons.Add("승부욕으로 과감"); }
                }
            }
            if (e.Greed > 0.7)
            {
                if (basic.Action == Pass && realCost > 0 && realCost <= 4 && pileTokens >= 2)
                {
                    double chance = Math.Min(0.2, (e.Greed - 0.7) * 0.67);
                    if (R() < chance) { decision.Action = Take; reasons.Add("욕심으로 기회 포착"); }
                }
            }
            if (e.Vengeful > 0.5)
            {
                var target = FindVengefulTarget(players);
                if (target != null && WouldPlayerWantCard(target, currentCard))
                {
                    if (basic.Action == Pass && realCost > 0 && realCost <= 3)
                    {
                        double chance = Math.Min(0.15, (e.Vengeful - 0.5) * 0.3);
                        if (R() < chance) { decision.Action = Take; reasons.Add(target.Nickname + "에게 복수 (손실 " + F1(realCost) + "점 감수)"); }
                    }
                }
            }

            decision.EmotionalReason = reasons.Count > 0 ? string.Join(", ", reasons) : "감정 변화 없음";
            return decision;
        }

        private static bool IsStrategicReason(string reason, bool includeThreat)
        {
            if (reason == null) return false;
            return reason.Contains("견제") || reason.Contains("전략적") || reason.Contains("절망적_도박") || reason.Contains("추격_공세")
                || (includeThreat && reason.Contains("중요 위협"));
        }

        // ------------------------------------------------------------------
        // 3단계: 관계 보정 (bot.js:860 considerPlayerRelations)
        // ------------------------------------------------------------------
        public Decision ConsiderPlayerRelations(Decision emotional, int currentCard, List<PlayerView> players, GameSnapshot state)
        {
            var decision = emotional.Copy();
            var reasons = new List<string>();

            if (IsStrategicReason(emotional.Reason, false))
            {
                reasons.Add("전략 우선");
                decision.SocialReason = string.Join(", ", reasons);
                return decision;
            }

            var situation = AnalyzeGameSituation(state);
            var threat = situation.OpponentAnalysis.PrimaryThreat;
            bool hasImportantThreat = threat != null && threat.RiskLevel == "critical";
            if (hasImportantThreat)
            {
                bool wants = WouldPlayerWantCard(threat.AsView(), currentCard);
                if (wants && decision.Action == Pass)
                {
                    decision.Action = Take;
                    reasons.Add("중요 위협 " + threat.Nickname + " 견제");
                    decision.SocialReason = string.Join(", ", reasons);
                    return decision;
                }
            }

            if (Emotions.Vengeful > 0.7)
            {
                var target = FindVengefulTarget(players);
                if (target != null && WouldPlayerWantCard(target, currentCard))
                {
                    if (decision.Action == Pass && R() < 0.3)
                    {
                        decision.Action = Take;
                        reasons.Add(target.Nickname + "에게 제한적 복수");
                    }
                }
            }

            var allies = FindAllies(players);
            if (allies.Count > 0 && decision.Action == Take)
            {
                bool helpAlly = allies.Any(a => WouldPlayerWantCard(a, currentCard));
                if (helpAlly && R() < 0.15)
                {
                    decision.Action = Pass;
                    reasons.Add("동맹을 위한 제한적 양보");
                }
            }

            decision.SocialReason = reasons.Count > 0 ? string.Join(", ", reasons) : "관계 변화 없음";
            return decision;
        }

        // ------------------------------------------------------------------
        // 4단계: 제한적 무작위 (bot.js:935 addFinalRandomness)
        // ------------------------------------------------------------------
        public string AddFinalRandomness(Decision social, int currentCard, int pileTokens)
        {
            if (IsStrategicReason(social.Reason, true)) return social.Action;

            double realCost = CalculateRealCost(currentCard, pileTokens, null);
            if (realCost <= -1) return social.Action;
            if (realCost >= 6) return social.Action;

            double threshold = Tendency.Randomness * 0.1;
            if (R() < threshold) return social.Action == Take ? Pass : Take;
            return social.Action;
        }

        /// <summary>bot.js:978 updateEmotionsAfterDecision()</summary>
        public void UpdateEmotionsAfterDecision(string decision, int currentCard, int pileTokens)
        {
            double k = Tendency.EmotionalIntensity;
            var e = Emotions;
            double realCost = CalculateRealCost(currentCard, pileTokens, null);
            if (decision == Take)
            {
                if (realCost <= 0)
                {
                    e.Mood = Math.Min(1, e.Mood + 0.15 * k);
                    e.Confidence = Math.Min(1, e.Confidence + 0.1 * k);
                    e.Greed = Math.Min(1, e.Greed + 0.05 * k);
                }
                else if (realCost <= 3)
                {
                    e.Mood = Math.Min(1, e.Mood + 0.05 * k);
                    e.Confidence = Math.Min(1, e.Confidence + 0.03 * k);
                }
                else if (realCost <= 8)
                {
                    e.Confidence = Math.Max(0, e.Confidence - 0.02 * k);
                }
                else
                {
                    e.Mood = Math.Max(0, e.Mood - 0.1 * k);
                    e.Frustration = Math.Min(1, e.Frustration + 0.15 * k);
                    e.Confidence = Math.Max(0, e.Confidence - 0.05 * k);
                }
            }
            else
            {
                if (realCost > 5) e.Confidence = Math.Min(1, e.Confidence + 0.03 * k);
                else if (realCost <= 0) e.Frustration = Math.Min(1, e.Frustration + 0.05 * k);
                else e.Confidence = Math.Max(0, e.Confidence - 0.01 * k);
            }
        }

        /// <summary>bot.js:1036 learnFromSituation()</summary>
        public void LearnFromSituation(int currentCard, int pileTokens, List<PlayerView> players, string myDecision)
        {
            foreach (var p in players)
            {
                if (p.Id == Id || p.IsBot) continue;
                if (!PlayerRelations.ContainsKey(p.Id)) PlayerRelations[p.Id] = new PlayerRelation();
            }
            GameEvents.Add(new GameEventRecord { Type = "decision", Card = currentCard, Tokens = pileTokens, MyDecision = myDecision });
            const int MaxEvents = 15;
            if (GameEvents.Count > MaxEvents) GameEvents = GameEvents.Skip(GameEvents.Count - MaxEvents).ToList();
        }

        /// <summary>bot.js:1067 observePlayerAction()</summary>
        public void ObservePlayerAction(string playerId, string action, int card, int tokens)
        {
            PlayerRelation rel;
            if (!PlayerRelations.TryGetValue(playerId, out rel))
            {
                rel = new PlayerRelation();
                PlayerRelations[playerId] = rel;
            }
            rel.ObservedPatterns.Add(new ObservedAction { Type = action, Card = card, Tokens = tokens });
            const int MaxPatterns = 20;
            if (rel.ObservedPatterns.Count > MaxPatterns)
                rel.ObservedPatterns = rel.ObservedPatterns.Skip(rel.ObservedPatterns.Count - MaxPatterns).ToList();
        }

        /// <summary>bot.js:1097 reactToEvent()</summary>
        public void ReactToEvent(string eventType, string playerId)
        {
            double k = Tendency.EmotionalIntensity;
            var e = Emotions;
            switch (eventType)
            {
                case "someone_took_my_card":
                    e.Vengeful = Math.Min(1, e.Vengeful + 0.3 * k);
                    e.Frustration = Math.Min(1, e.Frustration + 0.2 * k);
                    if (!string.IsNullOrEmpty(playerId)) IncreaseRivalry(playerId, 0.2);
                    break;
                case "got_overtaken":
                    e.Competitiveness = Math.Min(1, e.Competitiveness + 0.2 * k);
                    e.Frustration = Math.Min(1, e.Frustration + 0.15 * k);
                    break;
                case "consecutive_bad_cards":
                    e.Confidence = Math.Max(0, e.Confidence - 0.2 * k);
                    e.Mood = Math.Max(0, e.Mood - 0.15 * k);
                    break;
                case "winning_streak":
                    e.Confidence = Math.Min(1, e.Confidence + 0.2 * k);
                    e.Mood = Math.Min(1, e.Mood + 0.15 * k);
                    e.Greed = Math.Min(1, e.Greed + 0.1 * k);
                    break;
            }
        }

        // ------------------------------------------------------------------
        // 상황 분석 (bot.js:1137 analyzeGameSituation)
        // ------------------------------------------------------------------
        public Situation AnalyzeGameSituation(GameSnapshot state)
        {
            var players = state.Players;
            int totalCards = GameRules.TotalCards;
            int cardsDealt = totalCards - state.RemovedCount - state.DeckSize;
            double gameProgress = (double)cardsDealt / (totalCards - state.RemovedCount);

            var scores = players.Select(p => new ScoreEntry
            {
                Id = p.Id,
                Nickname = p.Nickname,
                Score = CalculatePlayerScore(p.Cards, p.Tokens),
                Tokens = p.Tokens,
                IsBot = p.IsBot,
            }).OrderBy(s => s.Score).ToList();

            int myRank = scores.FindIndex(s => s.Id == Id) + 1;
            int total = scores.Count;
            double myScore = scores.First(s => s.Id == Id).Score;
            var leader = scores[0];
            var last = scores[scores.Count - 1];
            double pointsFromLead = myScore - leader.Score;
            double pointsFromLast = last.Score - myScore;

            double avgTokens = players.Sum(p => (double)p.Tokens) / players.Count;
            double tokenAdvantage = Tokens - avgTokens;

            return new Situation
            {
                GameProgress = gameProgress,
                MyRank = myRank,
                TotalPlayers = total,
                PointsFromLead = pointsFromLead,
                PointsFromLast = pointsFromLast,
                TokenAdvantage = tokenAdvantage,
                RemainingCardsRisk = AssessRemainingCardsRisk(state.DeckSize),
                IsLeading = myRank == 1,
                IsLastPlace = myRank == total,
                IsCloseGame = Math.Abs(pointsFromLead) <= 5,
                Scores = scores,
                OpponentAnalysis = AnalyzeOpponents(scores, gameProgress),
                Players = players,
                ConnectionRisks = AnalyzeCardAvailability(state.RemovedCards ?? new List<int>()),
            };
        }

        /// <summary>bot.js:1213 analyzeOpponents()</summary>
        public OpponentAnalysis AnalyzeOpponents(List<ScoreEntry> scores, double gameProgress)
        {
            double myScore = scores.First(s => s.Id == Id).Score;
            double avgTokens = scores.Sum(s => (double)s.Tokens) / scores.Count;
            var risks = new List<OpponentRisk>();

            foreach (var o in scores.Where(s => s.Id != Id))
            {
                double risk = 0;
                var factors = new List<string>();

                if (o.Score <= scores[0].Score) { risk += 30; factors.Add("현재 1등"); }
                else if (o.Score - scores[0].Score <= 3) { risk += 20; factors.Add("1등 근접"); }

                double diff = o.Score - myScore;
                if (diff < -8) { risk += 25; factors.Add(FmtNum(Math.Abs(diff)) + "점 앞섬"); }
                else if (diff < -3) { risk += 15; factors.Add(FmtNum(Math.Abs(diff)) + "점 앞섬"); }
                else if (diff > 0 && diff <= 5) { risk += 10; factors.Add("근소한 차이로 뒤처짐"); }

                if (o.Tokens > avgTokens + 3) { risk += 15; factors.Add("칩 " + F1(o.Tokens - avgTokens) + "개 우위"); }

                if (gameProgress > 0.7) risk *= 1.3;
                else if (gameProgress < 0.3)
                {
                    if (o.Tokens > avgTokens + 2) risk += 10;
                }

                if (AnalyzeOpponentPattern(o.Id)) { risk += 10; factors.Add("공격적 플레이"); }

                string level;
                if (risk >= 50) level = "critical";
                else if (risk >= 30) level = "high";
                else if (risk >= 15) level = "medium";
                else level = "low";

                risks.Add(new OpponentRisk
                {
                    Id = o.Id,
                    Nickname = o.Nickname,
                    Score = o.Score,
                    Tokens = o.Tokens,
                    IsBot = o.IsBot,
                    RiskScore = risk,
                    RiskLevel = level,
                    RiskFactors = factors,
                    ShouldBlock = risk >= 30,
                });
            }

            risks = risks.OrderByDescending(r => r.RiskScore).ToList();
            var primary = risks.Count > 0 && risks[0].RiskScore >= 25 ? risks[0] : null;
            return new OpponentAnalysis
            {
                Opponents = risks,
                PrimaryThreat = primary,
                ShouldUseBlockingStrategy = primary != null,
                BlockingIntensity = primary != null ? Math.Min(primary.RiskScore / 50, 1) : 0,
            };
        }

        /// <summary>bot.js:1311 analyzeOpponentPattern() → isAggressive 만 사용됨.</summary>
        public bool AnalyzeOpponentPattern(string opponentId)
        {
            PlayerRelation rel;
            if (!PlayerRelations.TryGetValue(opponentId, out rel) || rel.ObservedPatterns.Count < 2) return false;
            var recent = rel.ObservedPatterns.Skip(Math.Max(0, rel.ObservedPatterns.Count - 3)).ToList();
            int takeCount = recent.Count(a => a.Type == Take);
            double avg = takeCount > 0 ? recent.Where(a => a.Type == Take).Sum(a => (double)a.Card) / takeCount : 0;
            return ((double)takeCount / recent.Count > 0.7) || (takeCount > 0 && avg > 20);
        }

        /// <summary>bot.js:1337 assessRemainingCardsRisk()</summary>
        public static string AssessRemainingCardsRisk(int deckSize)
        {
            if (deckSize <= 3) return "very_high";
            if (deckSize <= 6) return "high";
            if (deckSize <= 12) return "medium";
            return "low";
        }

        /// <summary>bot.js:1348 analyzeCardAvailability() → connectionRisks (card → 0/0.5/1.0).</summary>
        public static Dictionary<int, double> AnalyzeCardAvailability(List<int> removedCards)
        {
            var map = new Dictionary<int, double>();
            for (int card = GameRules.MinCard; card <= GameRules.MaxCard; card++)
            {
                double risk = 0;
                int prev = card - 1, next = card + 1;
                if (prev >= GameRules.MinCard && removedCards.Contains(prev)) risk += 0.5;
                if (next <= GameRules.MaxCard && removedCards.Contains(next)) risk += 0.5;
                map[card] = risk;
            }
            return map;
        }

        public sealed class Competition
        {
            public bool ShouldForceTake;
            public bool ShouldAvoidTake;
            public double CompetitionBonus;
            public int CompetitionLevel;
            public int TotalCompetitors;
            public string Reason;
        }

        /// <summary>bot.js:1434 analyzeCardCompetition()</summary>
        public Competition AnalyzeCardCompetition(int currentCard, List<PlayerView> players)
        {
            int competitionLevel = 0;
            var wanters = new List<KeyValuePair<PlayerView, int>>(); // (player, wantLevel)
            var benefits = new List<KeyValuePair<PlayerView, int>>();
            int myConnectionValue = 0;
            if (HasDirectConnection(currentCard)) myConnectionValue = 3;
            else if (HasIndirectConnection(currentCard)) myConnectionValue = 1;

            foreach (var o in players.Where(p => p.Id != Id))
            {
                int want = 0, benefit = 0;
                if (o.IsBot && o.Cards != null)
                {
                    bool d = o.Cards.Any(c => Math.Abs(c - currentCard) == 1);
                    bool ind = o.Cards.Any(c => Math.Abs(c - currentCard) == 2);
                    if (d) { want = 3; benefit = 5; }
                    else if (ind) { want = 2; benefit = 2; }
                    else if (currentCard <= 15) { want = 1; benefit = 1; }
                }
                else
                {
                    int w = EstimateHumanPlayerWant(o, currentCard);
                    if (w > 0) { want = w; benefit = w + 1; }
                }
                if (want > 0)
                {
                    wanters.Add(new KeyValuePair<PlayerView, int>(o, want));
                    competitionLevel += want;
                }
                benefits.Add(new KeyValuePair<PlayerView, int>(o, benefit));
            }

            int totalCompetitors = wanters.Count;
            var high = benefits.Where(b => b.Value >= 4).ToList();

            var r = new Competition { CompetitionLevel = competitionLevel, TotalCompetitors = totalCompetitors, Reason = "" };
            string forceReason = "";
            if (myConnectionValue >= 3 && totalCompetitors > 0)
            {
                r.ShouldForceTake = true; r.CompetitionBonus = 8; forceReason = "내 직접연결+" + totalCompetitors + "명 경쟁";
            }
            else if (myConnectionValue >= 1 && wanters.Any(w => w.Value >= 3))
            {
                r.ShouldForceTake = true; r.CompetitionBonus = 5; forceReason = "상대 직접연결 차단";
            }
            else if (totalCompetitors >= 2)
            {
                r.ShouldForceTake = true; r.CompetitionBonus = 3; forceReason = totalCompetitors + "명 경쟁차단";
            }

            string avoidReason = "";
            if (myConnectionValue == 0 && high.Count > 0 && currentCard >= 20)
            {
                r.ShouldAvoidTake = true;
                avoidReason = "상대에게 " + high[0].Key.Nickname + " 큰 이익 제공";
            }
            r.Reason = r.ShouldForceTake ? forceReason : avoidReason;
            return r;
        }

        /// <summary>bot.js:1535 isCurrentlyLeading()</summary>
        public bool IsCurrentlyLeading(List<PlayerView> players)
        {
            double my = CalculatePlayerScore(Cards, Tokens);
            return players.All(p => p.Id == Id || CalculatePlayerScore(p.Cards, p.Tokens) >= my);
        }

        /// <summary>bot.js:1543 estimateHumanPlayerWant() — 0~3.</summary>
        public int EstimateHumanPlayerWant(PlayerView player, int currentCard)
        {
            if (player == null || player.IsBot) return 0;
            int want = 0;
            PlayerRelation rel;
            var recent = PlayerRelations.TryGetValue(player.Id, out rel) ? rel.ObservedPatterns : new List<ObservedAction>();
            var takes = recent.Where(a => a.Type == Take).ToList();
            if (takes.Count > 5) takes = takes.Skip(takes.Count - 5).ToList();

            if (takes.Count > 0)
            {
                var cards = takes.Select(a => a.Card).ToList();
                if (cards.Any(c => Math.Abs(c - currentCard) == 1)) return 3;
                if (cards.Any(c => Math.Abs(c - currentCard) == 2)) want = Math.Max(want, 2);
                if (cards.Count(c => Math.Abs(c - currentCard) <= 4) >= 2) want = Math.Max(want, 1);
            }

            if (want == 0)
            {
                if (currentCard <= 10) want = 1;
                else if (currentCard <= 20) want = R() < 0.3 ? 1 : 0;
                else want = R() < 0.1 ? 1 : 0;
            }
            return want;
        }

        /// <summary>bot.js:1585 wouldPlayerWantCard()</summary>
        public bool WouldPlayerWantCard(PlayerView player, int currentCard)
        {
            if (player == null || string.IsNullOrEmpty(player.Id)) return false;
            if (player.IsBot && player.Cards != null)
            {
                if (player.Cards.Any(c => Math.Abs(c - currentCard) == 1)) return true;
                if (player.Cards.Any(c => Math.Abs(c - currentCard) == 2)) return R() < 0.6;
                if (currentCard <= 12) return R() < 0.4;
                return R() < 0.2;
            }
            return EstimateHumanPlayerWant(player, currentCard) > 0;
        }

        public PlayerView FindVengefulTarget(List<PlayerView> players)
        {
            foreach (var p in players)
            {
                PlayerRelation rel;
                if (PlayerRelations.TryGetValue(p.Id, out rel) && rel.Rivalry > 0.5) return p;
            }
            return null;
        }

        public List<PlayerView> FindAllies(List<PlayerView> players)
        {
            return players.Where(p =>
            {
                PlayerRelation rel;
                return PlayerRelations.TryGetValue(p.Id, out rel) && rel.Trust > 0.7;
            }).ToList();
        }

        public void IncreaseRivalry(string playerId, double amount)
        {
            PlayerRelation rel;
            if (!PlayerRelations.TryGetValue(playerId, out rel))
            {
                rel = new PlayerRelation();
                PlayerRelations[playerId] = rel;
            }
            rel.Rivalry = Math.Min(1, rel.Rivalry + amount);
        }

        /// <summary>bot.js:1648 calculatePlayerScore() — 카드가 없으면 0 (칩을 빼지 않음).</summary>
        public static double CalculatePlayerScore(IReadOnlyList<int> cards, int tokens)
        {
            if (cards == null || cards.Count == 0) return 0;
            return Scoring.CardSum(cards) - tokens;
        }

        // ------------------------------------------------------------------
        // 숨김 카드 (bot.js:1724~)
        // ------------------------------------------------------------------
        public string MakeHiddenCardDecision(int currentCard, int pileTokens, GameSnapshot state)
        {
            if (Tokens <= 0) return Take;
            double expected = CalculateHiddenCardValue(state);
            CalculateHiddenRiskTolerance(state); // 원본도 계산만 하고 결정에는 쓰지 않음
            double net = pileTokens - expected;
            double final = net + GetHiddenCardEmotionalBonus(state);
            double threshold;
            switch (Difficulty)
            {
                case BotDifficulty.Expert: threshold = -1; break;
                case BotDifficulty.Hard: threshold = 0; break;
                default: threshold = 1; break;
            }
            var d = final >= threshold ? Take : Pass;
            LastDecisionLog = "숨김 카드: 예상 " + F1(expected) + "점, 칩 " + pileTokens + ", 최종 " + F1(final) + " (기준 " + threshold + ") → " + d;
            return d;
        }

        public static double CalculateHiddenCardValue(GameSnapshot state)
        {
            var removed = state.RemovedCards ?? new List<int>();
            var all = new List<int>();
            for (int i = GameRules.MinCard; i <= GameRules.MaxCard; i++) if (!removed.Contains(i)) all.Add(i);
            var held = new HashSet<int>(state.Players.SelectMany(p => p.Cards ?? (IReadOnlyList<int>)new List<int>()));
            var avail = all.Where(c => !held.Contains(c)).ToList();
            if (avail.Count == 0) return 15;
            double ws = avail.Sum(c => c * (c > 20 ? 1.2 : 1.0));
            double tw = avail.Sum(c => c > 20 ? 1.2 : 1.0);
            return ws / tw;
        }

        public double CalculateHiddenRiskTolerance(GameSnapshot state)
        {
            double t = 0.5;
            t += Emotions.Confidence * 0.3;
            t += Emotions.Greed * 0.2;
            t -= Emotions.Frustration * 0.3;
            var s = AnalyzeGameSituation(state);
            if (s.IsLastPlace) t += 0.2;
            if (s.IsLeading) t -= 0.1;
            if (Tokens > 8) t += 0.1;
            if (Tokens < 3) t -= 0.2;
            return Math.Max(0.1, Math.Min(0.9, t));
        }

        public double GetHiddenCardEmotionalBonus(GameSnapshot state)
        {
            double bonus = 0;
            if (Emotions.Greed > 0.7) bonus += 1;
            bonus += (Emotions.Confidence - 0.5) * 2;
            if (Emotions.Frustration > 0.6) bonus += 1.5;
            double progress = (35.0 - state.DeckSize) / 24.0; // 원본 공식 그대로
            if (progress > 0.7) bonus += 1;
            return bonus;
        }

        private static string F1(double v)
        {
            // JS Number.prototype.toFixed(1) 과 동일하게: 실제 double 값 기준 반올림, 정확히 중간이면 0에서 먼 쪽.
            // G17 은 double 을 구분하기에 충분한 자릿수이므로 decimal 로 옮겨 반올림한다.
            if (double.IsNaN(v)) return "NaN";
            if (double.IsInfinity(v)) return v > 0 ? "Infinity" : "-Infinity";
            if (Math.Abs(v) >= 1e21) return v.ToString("R", CultureInfo.InvariantCulture);
            decimal d = decimal.Parse(v.ToString("G17", CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture);
            decimal r = Math.Round(d, 1, MidpointRounding.AwayFromZero);
            var str = r.ToString("0.0", CultureInfo.InvariantCulture);
            if (v < 0 && r == 0m) str = "-0.0"; // (-0.04).toFixed(1) === "-0.0"
            return str;
        }

        private static string FmtNum(double v)
        {
            return v.ToString("0.###", CultureInfo.InvariantCulture);
        }
    }
}
