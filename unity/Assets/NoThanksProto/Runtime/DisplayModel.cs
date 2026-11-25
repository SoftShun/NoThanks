using System.Collections.Generic;
using System.Text;
using NoThanks.Core.Net;

namespace NoThanks.Proto
{
    public enum LayoutKind
    {
        Portrait,
        LandscapeCompact,
        Desktop,
        DesktopWide,
    }

    public static class LayoutRules
    {
        /// <summary>
        /// 브레이크포인트 (논리 px). docs/remake/ux-spec.md 의 표와 동일.
        /// - 세로가 더 길면 Portrait
        /// - 가로가 더 길고 높이 &lt; 560 이면 LandscapeCompact (휴대폰 가로)
        /// - 가로 ≥ 1700 이고 높이 ≥ 950 이면 DesktopWide (1920×1080)
        /// - 그 외 Desktop (1440×900 기준)
        /// </summary>
        public static LayoutKind Decide(float w, float h)
        {
            if (h >= w) return LayoutKind.Portrait;
            if (h < 560) return LayoutKind.LandscapeCompact;
            if (w >= 1700 && h >= 950) return LayoutKind.DesktopWide;
            return LayoutKind.Desktop;
        }
    }

    public sealed class SeatModel
    {
        public string Id;
        public string Name;
        public string Sub;
        public bool IsBot;
        public bool IsMe;
        public int Chips;
        public List<int> Cards = new List<int>();

        public SeatModel Clone()
        {
            var c = (SeatModel)MemberwiseClone();
            c.Cards = new List<int>(Cards);
            return c;
        }
    }

    /// <summary>
    /// 화면에 "지금 보이는" 상태. 서버 상태(권한)와 달리 애니메이션 큐가 한 단계씩 반영한다.
    /// 큐가 비면 서버 상태(+ 미확정 예측)로 맞춘다(reconcile).
    /// </summary>
    public sealed class DisplayModel
    {
        public string Phase = Phases.Lobby;
        public List<SeatModel> Seats = new List<SeatModel>();
        public int Card;
        public int Pile;
        public int Deck;
        public int Removed;
        public string TurnId;
        public bool RevealPending;
        public bool ShowScore = true;
        public bool ShowOpponentChips;
        public int HiddenTotal;
        public int RevealedCount;
        public int TurnLimitSec;

        public SeatModel Seat(string id)
        {
            foreach (var s in Seats) if (s.Id == id) return s;
            return null;
        }

        public SeatModel Me
        {
            get { foreach (var s in Seats) if (s.IsMe) return s; return null; }
        }

        public static string DifficultyKo(string wire)
        {
            switch (wire)
            {
                case "medium": return "중";
                case "hard": return "상";
                case "expert": return "최상";
                default: return "";
            }
        }

        public static DisplayModel From(RoomStateSchema s, string me)
        {
            var m = new DisplayModel();
            if (s == null) return m;
            m.Phase = s.Phase;
            m.Card = s.CurrentCard;
            m.Pile = s.PileChips;
            m.Deck = s.DeckCount;
            m.Removed = s.RemovedCount;
            m.TurnId = s.CurrentPlayerId;
            m.RevealPending = s.RevealPending;
            m.ShowScore = s.Settings == null || s.Settings.ShowRealTimeScore;
            m.ShowOpponentChips = s.Settings != null && s.Settings.ShowOpponentTokens;
            m.HiddenTotal = s.HiddenTotal;
            m.RevealedCount = s.RevealedCount;
            m.TurnLimitSec = s.Settings != null ? s.Settings.TurnTimeLimit : 0;
            foreach (var p in s.Players)
            {
                m.Seats.Add(new SeatModel
                {
                    Id = p.Id,
                    Name = p.Id == me ? "나" : p.Nickname,
                    Sub = p.IsBot ? "AI · 난이도 " + DifficultyKo(p.Difficulty) : (p.Id == me ? "당신" : "플레이어"),
                    IsBot = p.IsBot,
                    IsMe = p.Id == me,
                    Chips = p.Chips,
                    Cards = new List<int>(p.Cards),
                });
            }
            return m;
        }

        public DisplayModel Clone()
        {
            var c = (DisplayModel)MemberwiseClone();
            c.Seats = new List<SeatModel>();
            foreach (var s in Seats) c.Seats.Add(s.Clone());
            return c;
        }

        public string Signature()
        {
            var sb = new StringBuilder();
            sb.Append(Phase).Append('|').Append(Card).Append('|').Append(Pile).Append('|').Append(Deck).Append('|').Append(TurnId).Append('|').Append(RevealPending);
            foreach (var s in Seats)
            {
                sb.Append('|').Append(s.Id).Append(':').Append(s.Chips).Append(':');
                foreach (var c in s.Cards) sb.Append(c).Append(',');
            }
            return sb.ToString();
        }
    }
}
