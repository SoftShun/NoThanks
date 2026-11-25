using System.Collections.Generic;
using System.Linq;
using NoThanks.Core;
using NoThanks.Core.Client;
using NoThanks.Core.Net;
using Xunit;

namespace NoThanks.Core.Tests
{
    public class NetTests
    {
        private sealed class Harness
        {
            public Scheduler Clock = new Scheduler();
            public MockRoomServer Server;
            public LocalRoom Room;
            public GameClient Client;
            public List<ServerEvent> Events = new List<ServerEvent>();
            public List<(string kind, double at, int reqId)> Log = new List<(string, double, int)>();

            public Harness(double latency, int seed = 11, double botScale = 1.0, int bots = 3)
            {
                Server = new MockRoomServer(Clock, new SystemRandom(seed), new MockServerOptions { BotDelayScale = botScale });
                Room = new LocalRoom(Clock, Server, latency);
                Client = new GameClient(Room, Clock);
                Client.OnServerEvent += (e, predicted) => Events.Add(e);
                Client.OnPredicted += p => Log.Add(("predicted", Clock.Now, p.ReqId));
                Client.OnConfirmed += p => Log.Add(("confirmed", Clock.Now, p.ReqId));
                Client.OnRolledBack += (p, r) => Log.Add(("rollback", Clock.Now, p.ReqId));
                Assert.True(Room.Join("나"));
                var diffs = new[] { "medium", "hard", "expert" };
                for (int i = 0; i < bots; i++) Client.Send(ClientMessageTypes.AddBot, new ClientMessage { Difficulty = diffs[i] });
                Clock.Advance(latency * 2 + 1);
            }

            public void Start()
            {
                Client.Send(ClientMessageTypes.Start, new ClientMessage());
                Clock.Advance(Room.LatencyMs * 2 + 1);
            }

            /// <summary>내 턴이 될 때까지 시간을 흘린다. 게임이 끝나면 false.</summary>
            public bool WaitMyTurn(double maxMs = 60000)
            {
                double end = Clock.Now + maxMs;
                while (Clock.Now < end)
                {
                    if (Client.State.Phase != Phases.Playing) return false;
                    if (Client.CanAct) return true;
                    Clock.Advance(10);
                }
                return false;
            }
        }

        [Fact]
        public void Full_Game_Against_Three_Bots_Completes_With_Contiguous_Seq()
        {
            foreach (var latency in new double[] { 0, 100, 300 })
            {
                var h = new Harness(latency, seed: (int)latency + 3);
                h.Start();
                Assert.Equal(Phases.Playing, h.Client.State.Phase);
                Assert.Equal(4, h.Client.State.Players.Count);
                int myActions = 0;
                while (h.WaitMyTurn())
                {
                    var s = h.Client.State;
                    // 간단한 사람 전략: 칩이 카드값/3 이상 쌓였거나 칩이 없으면 가져가기
                    var p = (s.CurrentCard == -1 || s.PileChips * 3 >= s.CurrentCard || !h.Client.CanPass) ? h.Client.RequestTake() : h.Client.RequestPass();
                    Assert.NotNull(p);
                    myActions++;
                    h.Clock.Advance(latency * 2 + 5);
                }
                h.Clock.Advance(2000);
                Assert.Equal(Phases.Ended, h.Client.State.Phase);
                Assert.Equal(4, h.Client.State.Results.Count);
                Assert.Equal(24, h.Client.State.Results.Sum(r => r.Cards.Count));
                Assert.True(myActions > 0);
                // 시퀀스는 1부터 빈틈없이 증가
                var seqs = h.Events.Select(e => e.Seq).ToList();
                Assert.Equal(Enumerable.Range(1, seqs.Count).Select(i => (long)i), seqs);
                Assert.Contains(h.Events, e => e.Type == EventTypes.GameEnded);
                // 로그: 예측은 즉시(같은 시각), 확인은 왕복 지연 후
                Assert.DoesNotContain(h.Log, l => l.kind == "rollback");
            }
        }

        [Fact]
        public void Prediction_Is_Immediate_And_Confirmation_After_RoundTrip_At_300ms()
        {
            var h = new Harness(300, seed: 21);
            h.Start();
            Assert.True(h.WaitMyTurn());
            double t0 = h.Clock.Now;
            bool predictedFired = false;
            h.Client.OnPredicted += _ => predictedFired = true;
            var p = h.Client.RequestTake();
            Assert.True(predictedFired);                 // 입력과 같은 호출 안에서 반응
            Assert.Equal(t0, h.Log.Last(l => l.kind == "predicted").at);
            h.Clock.Advance(599);
            Assert.NotNull(h.Client.Pending);            // 아직 확인 전
            h.Clock.Advance(2);
            Assert.Null(h.Client.Pending);               // 600ms 왕복 후 확정
            var conf = h.Log.Last(l => l.kind == "confirmed");
            Assert.Equal(p.ReqId, conf.reqId);
            Assert.InRange(conf.at - t0, 600, 601);
        }

        [Fact]
        public void Server_Reject_Rolls_Back()
        {
            var h = new Harness(100, seed: 4);
            h.Start();
            Assert.True(h.WaitMyTurn());
            h.Server.Options.DebugRejectRate = 1.0;
            string reason = null;
            h.Client.OnRolledBack += (pa, r) => reason = r;
            var p = h.Client.RequestPass();
            Assert.NotNull(p);
            h.Clock.Advance(250);
            Assert.Null(h.Client.Pending);
            Assert.NotNull(reason);
            Assert.Contains(h.Log, l => l.kind == "rollback" && l.reqId == p.ReqId);
            // 상태는 변하지 않음: 여전히 내 턴, 칩 11개
            Assert.True(h.Client.IsMyTurn);
            Assert.Equal(11, h.Client.Me.Chips);
        }

        [Fact]
        public void Predicted_Events_Are_Flagged()
        {
            var h = new Harness(100, seed: 8);
            var flagged = new List<(string type, bool predicted)>();
            h.Client.OnServerEvent += (e, pr) => flagged.Add((e.Type, pr));
            h.Start();
            Assert.True(h.WaitMyTurn());
            h.Client.RequestPass();
            h.Clock.Advance(250);
            Assert.Contains(flagged, f => f.type == EventTypes.ChipPlaced && f.predicted);
        }

        [Fact]
        public void Not_Your_Turn_Is_Rejected_By_Server()
        {
            var h = new Harness(0, seed: 2);
            h.Start();
            // 봇 턴일 때 직접 take 전송 (클라 검증 우회)
            int guard = 0;
            while (h.Client.State.CurrentPlayerId == h.Client.SessionId && guard++ < 100) { h.Client.RequestPass(); h.Clock.Advance(1); }
            var reasons = new List<string>();
            h.Client.OnToast += r => reasons.Add(r);
            h.Client.Send(ClientMessageTypes.Take, new ClientMessage());
            h.Clock.Advance(1);
            Assert.Contains(GameEngine.ErrNotYourTurn, reasons);
        }

        [Fact]
        public void Opponent_Chips_Hidden_By_Default()
        {
            var h = new Harness(0, seed: 6);
            h.Start();
            var s = h.Client.State;
            Assert.All(s.Players.Where(p => p.Id != h.Client.SessionId), p => Assert.Equal(-1, p.Chips));
            Assert.Equal(11, h.Client.Me.Chips);
        }

        [Fact]
        public void Turn_Timeout_Auto_Passes()
        {
            var h = new Harness(0, seed: 9, bots: 1);
            h.Client.Send(ClientMessageTypes.UpdateSettings, new ClientMessage { Settings = new SettingsPatchDto { TurnTimeLimit = 5 } });
            h.Clock.Advance(1);
            h.Start();
            Assert.True(h.WaitMyTurn());
            var before = h.Client.Me.Chips;
            h.Clock.Advance(5001);
            Assert.Contains(h.Events, e => e.Type == EventTypes.ChipPlaced && e.Forced && e.PlayerId == h.Client.SessionId);
            Assert.Equal(before - 1, h.Client.Me.Chips);
        }

        [Fact]
        public void Hidden_Mode_Reveal_Then_Take_After_One_Second()
        {
            for (int seed = 0; seed < 40; seed++)
            {
                var h = new Harness(0, seed: seed, botScale: 0.01, bots: 1);
                h.Client.Send(ClientMessageTypes.UpdateSettings, new ClientMessage { Settings = new SettingsPatchDto { GameMode = "hidden", HiddenCardCount = 5, TurnTimeLimit = 0 } });
                h.Clock.Advance(1);
                h.Start();
                while (h.WaitMyTurn(20000))
                {
                    if (h.Client.State.CurrentCard == -1)
                    {
                        var p = h.Client.RequestTake();
                        Assert.Equal(PendingKind.TakeHidden, p.Kind);
                        h.Clock.Advance(1);
                        var rev = h.Events.Last(e => e.Type == EventTypes.HiddenRevealed);
                        Assert.True(rev.Card > 0);
                        Assert.True(h.Client.State.RevealPending);
                        Assert.False(h.Client.CanAct);
                        h.Clock.Advance(999);
                        Assert.Contains(h.Events, e => e.Type == EventTypes.CardTaken && e.Card == rev.Card);
                        return;
                    }
                    h.Client.RequestTake();
                    h.Clock.Advance(1);
                }
            }
            Assert.Fail("숨김 카드가 내 턴에 나오지 않음");
        }

        [Fact]
        public void Client_Reorders_Out_Of_Order_Events_And_Resyncs_On_Gap()
        {
            var clock = new Scheduler();
            var server = new MockRoomServer(clock, new SystemRandom(1));
            var room = new LocalRoom(clock, server, 0);
            var client = new GameClient(room, clock);
            room.Join("나");
            clock.Advance(1);
            var got = new List<long>();
            client.OnServerEvent += (e, _) => got.Add(e.Seq);
            long baseSeq = client.LastAppliedSeq;
            client.InjectForTest(new ServerEvent { Seq = baseSeq + 2, Type = EventTypes.Toast, Reason = "b" });
            Assert.Empty(got);
            client.InjectForTest(new ServerEvent { Seq = baseSeq + 1, Type = EventTypes.Toast, Reason = "a" });
            Assert.Equal(new[] { baseSeq + 1, baseSeq + 2 }, got);
            // 구멍: +4 만 도착 → 타임아웃 후 resync
            client.InjectForTest(new ServerEvent { Seq = baseSeq + 4, Type = EventTypes.Toast });
            clock.Advance(client.GapTimeoutMs + 5);
            Assert.Equal(1, client.ResyncCount);
        }

        [Fact]
        public void Back_To_Lobby_After_End_Allows_New_Game_With_Bots_Readded()
        {
            var h = new Harness(0, seed: 31, botScale: 0.01, bots: 2);
            h.Start();
            while (h.WaitMyTurn()) { h.Client.RequestTake(); h.Clock.Advance(1); }
            h.Clock.Advance(100);
            Assert.Equal(Phases.Ended, h.Client.State.Phase);
            Assert.Single(h.Client.State.Players); // master: 종료 후 봇 제거
            h.Client.Send(ClientMessageTypes.BackToLobby, new ClientMessage());
            h.Client.Send(ClientMessageTypes.AddBot, new ClientMessage { Difficulty = "expert" });
            h.Start();
            Assert.Equal(Phases.Playing, h.Client.State.Phase);
            Assert.Equal(2, h.Client.State.Players.Count);
        }

        [Fact]
        public void Scheduler_Is_Fifo_For_Same_Time()
        {
            var c = new Scheduler();
            var order = new List<int>();
            c.Schedule(10, () => order.Add(1));
            c.Schedule(10, () => order.Add(2));
            var h3 = c.Schedule(5, () => order.Add(3));
            c.Schedule(10, () => c.Schedule(0, () => order.Add(4)));
            Scheduler.Cancel(h3);
            c.Advance(10);
            Assert.Equal(new[] { 1, 2, 4 }, order);
        }
    }
}
