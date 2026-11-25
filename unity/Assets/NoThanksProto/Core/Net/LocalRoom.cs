using System;

namespace NoThanks.Core.Net
{
    /// <summary>
    /// 목 서버에 붙는 클라이언트 측 Room. 지연 시뮬레이션을 담당한다.
    /// - LatencyMs: 단방향 지연. 클라이언트→서버, 서버→클라이언트 각각 이만큼 늦게 도착 (왕복 = 2×LatencyMs).
    ///   0 / 100 / 300 프리셋. 300 이면 왕복 600ms 로, 일반적인 "300ms 지연"보다 가혹한 조건이다.
    /// - 같은 방향 메시지는 순서가 바뀌지 않는다 (TCP/WebSocket 과 동일).
    /// </summary>
    public sealed class LocalRoom : IRoom, IClientSink
    {
        private readonly Scheduler _clock;
        private readonly MockRoomServer _server;
        private double _lastUp;   // 클라→서버 마지막 도착 예정 시각
        private double _lastDown; // 서버→클라 마지막 도착 예정 시각
        private bool _left;

        public double LatencyMs;
        /// <summary>추가 지터(0~JitterMs 균등). 기본 0. 순서는 유지된다.</summary>
        public double JitterMs;
        private readonly Random _jitterRng = new Random(1234);

        public string SessionId { get; private set; }
        public RoomStateSchema State { get; private set; }

        public event Action<RoomStateSchema> OnStateChange;
        public event Action<ServerEvent> OnEvent;
        public event Action<int, string> OnError;
        public event Action<int> OnLeave;

        public LocalRoom(Scheduler clock, MockRoomServer server, double latencyMs)
        {
            _clock = clock;
            _server = server;
            LatencyMs = latencyMs;
            State = new RoomStateSchema();
        }

        /// <summary>입장. 지연 없이 즉시 처리(로비 진입은 측정 대상이 아님).</summary>
        public bool Join(string nickname)
        {
            SessionId = _server.Join(nickname, this);
            if (SessionId == null)
            {
                if (OnError != null) OnError(4000, "Unable to join game (already started, full, or duplicate nickname)");
                return false;
            }
            return true;
        }

        private double NextDelay()
        {
            double j = JitterMs > 0 ? _jitterRng.NextDouble() * JitterMs : 0;
            return Math.Max(0, LatencyMs + j);
        }

        public void Send(string type, ClientMessage message)
        {
            if (_left || SessionId == null) return;
            var at = Math.Max(_clock.Now + NextDelay(), _lastUp);
            _lastUp = at;
            var sid = SessionId;
            _clock.ScheduleAt(at, () => _server.Receive(sid, type, message));
        }

        public void Leave()
        {
            if (_left) return;
            _left = true;
            var sid = SessionId;
            _clock.Schedule(LatencyMs, () => _server.Leave(sid));
            if (OnLeave != null) OnLeave(1000);
        }

        void IClientSink.DeliverState(RoomStateSchema state)
        {
            var copy = state.Clone();
            ScheduleDown(() =>
            {
                State = copy;
                if (OnStateChange != null) OnStateChange(copy);
            });
        }

        void IClientSink.DeliverEvent(ServerEvent ev)
        {
            var copy = ev.Clone();
            ScheduleDown(() =>
            {
                if (OnEvent != null) OnEvent(copy);
            });
        }

        private void ScheduleDown(Action a)
        {
            if (_left) return;
            var at = Math.Max(_clock.Now + NextDelay(), _lastDown);
            _lastDown = at;
            _clock.ScheduleAt(at, () => { if (!_left) a(); });
        }
    }
}
