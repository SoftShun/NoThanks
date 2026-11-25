using System;
using System.Collections.Generic;

namespace NoThanks.Core.Net
{
    /// <summary>클라이언트 → 서버 메시지 타입 (Colyseus room.send(type, message)).</summary>
    public static class ClientMessageTypes
    {
        public const string Start = "start";
        public const string Take = "take";
        public const string Pass = "pass";
        public const string UpdateSettings = "updateSettings";
        public const string AddBot = "addBot";
        public const string RemoveBot = "removeBot";
        public const string BackToLobby = "backToLobby";
        public const string Resync = "resync";
    }

    /// <summary>클라이언트 → 서버 메시지 본문. ReqId 는 클라이언트가 붙이는 요청 번호(낙관적 반응의 확인/롤백 매칭용).</summary>
    public sealed class ClientMessage
    {
        public int ReqId;
        public string Difficulty;   // addBot
        public string BotId;        // removeBot
        public SettingsPatchDto Settings; // updateSettings
    }

    /// <summary>updateSettings 본문 (null 필드는 변경 안 함).</summary>
    public sealed class SettingsPatchDto
    {
        public int? RemovedCount;
        public int? InitialTokens;
        public bool? ShowOpponentTokens;
        public bool? ShowRealTimeScore;
        public int? TurnTimeLimit;
        public string GameMode;
        public int? HiddenCardCount;

        public SettingsPatch ToPatch()
        {
            var p = new SettingsPatch
            {
                RemovedCount = RemovedCount,
                InitialTokens = InitialTokens,
                ShowOpponentTokens = ShowOpponentTokens,
                ShowRealTimeScore = ShowRealTimeScore,
                TurnTimeLimit = TurnTimeLimit,
                HiddenCardCount = HiddenCardCount,
            };
            if (GameMode == "hidden") p.GameMode = Core.GameMode.Hidden;
            else if (GameMode == "normal") p.GameMode = Core.GameMode.Normal;
            else if (GameMode != null) p.GameMode = Core.GameMode.Normal; // 잘못된 값 → normal (game.js:335)
            return p;
        }
    }

    /// <summary>서버 → 클라이언트 이벤트 타입. 모두 room.onMessage("event") 로 전달되며 Seq 가 붙는다.</summary>
    public static class EventTypes
    {
        public const string ActionResult = "action_result";
        public const string GameStarted = "game_started";
        public const string CardRevealed = "card_revealed";
        public const string HiddenRevealed = "hidden_revealed";
        public const string ChipPlaced = "chip_placed";
        public const string CardTaken = "card_taken";
        public const string TurnChanged = "turn_changed";
        public const string GameEnded = "game_ended";
        public const string Resync = "resync";
        public const string Toast = "toast";
    }

    /// <summary>
    /// 시퀀스 번호가 붙은 서버 이벤트. 클라이언트별로 Seq 가 1부터 1씩 증가한다.
    /// 필드는 타입별로 일부만 사용 (game-interface.md 의 이벤트 표 참고).
    /// </summary>
    public sealed class ServerEvent
    {
        public long Seq;
        public string Type;
        public double ServerTimeMs;
        public long StateVersion;

        public string PlayerId;
        public int ReqId;          // 이 이벤트를 일으킨 클라이언트 요청 번호(해당 클라이언트에게만 의미)
        public bool Ok;            // action_result
        public string Reason;      // action_result 거절 사유, toast 메시지
        public string Action;      // action_result 대상 ("take" | "pass" | ...)

        public int Card;           // card_revealed(-1=숨김, 0=없음), card_taken, hidden_revealed
        public int Chips;          // card_taken: 함께 가져간 칩 수
        public int PlayerChips;    // chip_placed/card_taken 후 해당 플레이어 칩 (비공개면 -1)
        public int PileChips;      // chip_placed 후 카드 위 칩 수
        public int DeckCount;      // card_revealed 후 남은 덱
        public bool SamePlayer;    // turn_changed: 같은 플레이어 계속(가져가기 후)
        public double TurnMs;      // turn_changed: 제한 시간(ms), 0=무제한
        public bool Forced;        // card_taken: 칩 0개로 패스 → 강제 가져가기 / 시간 초과
        public List<string> Order; // game_started: 셔플된 턴 순서
        public List<ResultSchema> Results; // game_ended

        public ServerEvent Clone()
        {
            var c = (ServerEvent)MemberwiseClone();
            if (Order != null) c.Order = new List<string>(Order);
            if (Results != null)
            {
                c.Results = new List<ResultSchema>();
                foreach (var r in Results) c.Results.Add(r.Clone());
            }
            return c;
        }
    }

    /// <summary>
    /// 클라이언트가 보는 Room 인터페이스 (colyseus.js / colyseus-unity-sdk 의 Room&lt;T&gt; 와 같은 모양).
    /// 실제 서버로 교체할 때는 이 인터페이스를 ColyseusRoom 어댑터로 구현하면 된다.
    /// </summary>
    public interface IRoom
    {
        string SessionId { get; }
        RoomStateSchema State { get; }
        event Action<RoomStateSchema> OnStateChange;
        event Action<ServerEvent> OnEvent;
        event Action<int, string> OnError;
        event Action<int> OnLeave;
        void Send(string type, ClientMessage message);
        void Leave();
    }
}
