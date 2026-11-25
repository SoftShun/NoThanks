using System;
using System.Collections.Generic;

namespace NoThanks.Core
{
    /// <summary>
    /// master 브랜치 server/game.js 에서 추출한 규칙 상수. 값을 바꾸지 말 것.
    /// 출처 표는 docs/remake/rules.md 참고.
    /// </summary>
    public static class GameRules
    {
        /// <summary>카드 최솟값 (game.js:150 `for (let i = 3; i <= 35; i++)`).</summary>
        public const int MinCard = 3;
        /// <summary>카드 최댓값 (game.js:150).</summary>
        public const int MaxCard = 35;
        /// <summary>전체 카드 수 33장 (bot.js analyzeGameSituation `totalCards = 33`).</summary>
        public const int TotalCards = MaxCard - MinCard + 1;

        /// <summary>최대 인원 (game.js:72, 401).</summary>
        public const int MaxPlayers = 7;
        /// <summary>최대 봇 수 (game.js:405).</summary>
        public const int MaxBots = 3;

        /// <summary>숨김 카드 공개 후 실제 가져가기까지 지연 (index.js:115, 443).</summary>
        public const int HiddenRevealDelayMs = 1000;

        /// <summary>닉네임 최대 길이 (game.js:373).</summary>
        public const int MaxNicknameLength = 20;
    }

    /// <summary>게임 모드 (game.js gameMode 'normal' | 'hidden').</summary>
    public enum GameMode
    {
        Normal = 0,
        Hidden = 1,
    }

    /// <summary>봇 난이도 (game.js addBot: 'medium' | 'hard' | 'expert' → 중/상/최상).</summary>
    public enum BotDifficulty
    {
        Medium = 0,
        Hard = 1,
        Expert = 2,
    }

    public static class BotDifficultyExt
    {
        public static string ToKorean(this BotDifficulty d)
        {
            switch (d)
            {
                case BotDifficulty.Hard: return "상";
                case BotDifficulty.Expert: return "최상";
                default: return "중";
            }
        }

        public static string ToWire(this BotDifficulty d)
        {
            switch (d)
            {
                case BotDifficulty.Hard: return "hard";
                case BotDifficulty.Expert: return "expert";
                default: return "medium";
            }
        }

        public static bool TryParseWire(string s, out BotDifficulty d)
        {
            switch (s)
            {
                case "medium": d = BotDifficulty.Medium; return true;
                case "hard": d = BotDifficulty.Hard; return true;
                case "expert": d = BotDifficulty.Expert; return true;
                default: d = BotDifficulty.Medium; return false;
            }
        }
    }

    /// <summary>
    /// 게임 설정. 기본값/허용 범위는 game.js reset()/updateSettings() 와 동일.
    /// </summary>
    public sealed class GameSettings
    {
        public int RemovedCount = 9;            // game.js:49, 범위 1~32 (game.js:326)
        public int InitialTokens = 11;          // game.js:50, 범위 1~50 (game.js:329)
        public bool ShowOpponentTokens = false; // game.js:51
        public bool ShowRealTimeScore = true;   // game.js:52
        public int TurnTimeLimit = 30;          // game.js:53, 초, 0=무제한, 범위 0~300 (game.js:332)
        public GameMode GameMode = GameMode.Normal; // game.js:54
        public int HiddenCardCount = 3;         // game.js:55, 범위 1~5 (game.js:340)

        public GameSettings Clone()
        {
            return (GameSettings)MemberwiseClone();
        }

        /// <summary>game.js updateSettings() 의 범위 제한을 그대로 적용.</summary>
        public void Clamp()
        {
            RemovedCount = Math.Max(1, Math.Min(32, RemovedCount));
            InitialTokens = Math.Max(1, Math.Min(50, InitialTokens));
            TurnTimeLimit = Math.Max(0, Math.Min(300, TurnTimeLimit));
            if (GameMode != GameMode.Normal && GameMode != GameMode.Hidden) GameMode = GameMode.Normal;
            HiddenCardCount = Math.Max(1, Math.Min(5, HiddenCardCount));
        }
    }

    /// <summary>설정 부분 갱신용 패치 (전달된 항목만 갱신 — game.js:322 스프레드 병합과 동일).</summary>
    public sealed class SettingsPatch
    {
        public int? RemovedCount;
        public int? InitialTokens;
        public bool? ShowOpponentTokens;
        public bool? ShowRealTimeScore;
        public int? TurnTimeLimit;
        public GameMode? GameMode;
        public int? HiddenCardCount;

        public void ApplyTo(GameSettings s)
        {
            if (RemovedCount.HasValue) s.RemovedCount = RemovedCount.Value;
            if (InitialTokens.HasValue) s.InitialTokens = InitialTokens.Value;
            if (ShowOpponentTokens.HasValue) s.ShowOpponentTokens = ShowOpponentTokens.Value;
            if (ShowRealTimeScore.HasValue) s.ShowRealTimeScore = ShowRealTimeScore.Value;
            if (TurnTimeLimit.HasValue) s.TurnTimeLimit = TurnTimeLimit.Value;
            if (GameMode.HasValue) s.GameMode = GameMode.Value;
            if (HiddenCardCount.HasValue) s.HiddenCardCount = HiddenCardCount.Value;
        }
    }

    /// <summary>
    /// 점수 계산 (game.js:284~312 calculateScores, bot.js calculatePlayerScore).
    /// 연속된 카드 묶음은 가장 낮은 카드만 합산하고, 보유 칩 수를 뺀다. 낮을수록 좋다.
    /// </summary>
    public static class Scoring
    {
        public static int CardSum(IReadOnlyList<int> cards)
        {
            if (cards == null || cards.Count == 0) return 0;
            var sorted = new List<int>(cards);
            sorted.Sort();
            int sum = 0;
            int? prev = null;
            foreach (var card in sorted)
            {
                if (prev == null || card != prev.Value + 1) sum += card;
                prev = card;
            }
            return sum;
        }

        public static int Score(IReadOnlyList<int> cards, int tokens)
        {
            return CardSum(cards) - tokens;
        }

        /// <summary>
        /// 연속 묶음(run) 목록. UI 에서 묶음 표시/점수 집계 연출에 사용.
        /// 각 run 의 첫 원소가 점수에 반영되는 카드.
        /// </summary>
        public static List<List<int>> Runs(IReadOnlyList<int> cards)
        {
            var runs = new List<List<int>>();
            if (cards == null || cards.Count == 0) return runs;
            var sorted = new List<int>(cards);
            sorted.Sort();
            List<int> cur = null;
            foreach (var c in sorted)
            {
                if (cur == null || c != cur[cur.Count - 1] + 1)
                {
                    cur = new List<int>();
                    runs.Add(cur);
                }
                cur.Add(c);
            }
            return runs;
        }
    }
}
