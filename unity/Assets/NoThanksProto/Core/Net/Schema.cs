using System.Collections.Generic;

namespace NoThanks.Core.Net
{
    /// <summary>
    /// Colyseus Room State(@colyseus/schema) 를 흉내 낸 상태 스키마.
    /// 실제 Colyseus 로 교체 시 동일한 필드명을 가진 Schema 클래스로 1:1 대응시키면 된다.
    /// (필드 정의/의미는 docs/remake/game-interface.md 표 참고)
    /// </summary>
    public static class Phases
    {
        public const string Lobby = "lobby";
        public const string Playing = "playing";
        public const string Ended = "ended";
    }

    public sealed class SettingsSchema
    {
        public int RemovedCount;
        public int InitialTokens;
        public bool ShowOpponentTokens;
        public bool ShowRealTimeScore;
        public int TurnTimeLimit;
        public string GameMode; // "normal" | "hidden"
        public int HiddenCardCount;

        public static SettingsSchema From(GameSettings s)
        {
            return new SettingsSchema
            {
                RemovedCount = s.RemovedCount,
                InitialTokens = s.InitialTokens,
                ShowOpponentTokens = s.ShowOpponentTokens,
                ShowRealTimeScore = s.ShowRealTimeScore,
                TurnTimeLimit = s.TurnTimeLimit,
                GameMode = s.GameMode == Core.GameMode.Hidden ? "hidden" : "normal",
                HiddenCardCount = s.HiddenCardCount,
            };
        }

        public SettingsSchema Clone() { return (SettingsSchema)MemberwiseClone(); }
    }

    public sealed class PlayerSchema
    {
        public string Id;
        public string Nickname;
        public bool IsBot;
        public string Difficulty; // "" | "medium" | "hard" | "expert"
        /// <summary>보유 칩. 상대 칩 비공개 설정이면 다른 클라이언트에게는 -1 (StateView 필터링).</summary>
        public int Chips;
        public List<int> Cards = new List<int>();
        /// <summary>카드 점수 합(연속 묶음 최저값 합). 칩 차감 전.</summary>
        public int CardPoints;
        public int Seat;

        public PlayerSchema Clone()
        {
            var c = (PlayerSchema)MemberwiseClone();
            c.Cards = new List<int>(Cards);
            return c;
        }
    }

    public sealed class ResultSchema
    {
        public string Id;
        public string Nickname;
        public int Score;
        public List<int> Cards = new List<int>();
        public int Chips;
        public int Rank;
        public bool IsBot;

        public ResultSchema Clone()
        {
            var c = (ResultSchema)MemberwiseClone();
            c.Cards = new List<int>(Cards);
            return c;
        }
    }

    public sealed class RoomStateSchema
    {
        public string Phase = Phases.Lobby;
        public string HostId;
        public string CurrentPlayerId;
        /// <summary>현재 공개 카드. 0 = 없음, -1 = 숨김 카드(미공개).</summary>
        public int CurrentCard;
        public int PileChips;
        public int DeckCount;
        public int RemovedCount;
        public int HiddenTotal;
        public int RevealedCount;
        /// <summary>숨김 카드 공개 후 가져가기 대기 중(1초).</summary>
        public bool RevealPending;
        /// <summary>현재 턴 남은 시간(ms) — 상태 생성 시점 기준. 0 = 무제한/봇 턴.</summary>
        public double TurnRemainingMs;
        public double ServerTimeMs;
        public List<PlayerSchema> Players = new List<PlayerSchema>();
        public SettingsSchema Settings = new SettingsSchema();
        public List<ResultSchema> Results = new List<ResultSchema>();
        /// <summary>상태 버전(서버가 상태를 바꿀 때마다 +1). 패치 순서 확인용.</summary>
        public long Version;

        public PlayerSchema FindPlayer(string id)
        {
            foreach (var p in Players) if (p.Id == id) return p;
            return null;
        }

        public RoomStateSchema Clone()
        {
            var c = (RoomStateSchema)MemberwiseClone();
            c.Players = new List<PlayerSchema>();
            foreach (var p in Players) c.Players.Add(p.Clone());
            c.Settings = Settings.Clone();
            c.Results = new List<ResultSchema>();
            foreach (var r in Results) c.Results.Add(r.Clone());
            return c;
        }
    }
}
