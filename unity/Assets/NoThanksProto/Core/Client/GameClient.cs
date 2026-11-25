using System;
using System.Collections.Generic;
using NoThanks.Core.Net;

namespace NoThanks.Core.Client
{
    public enum PendingKind
    {
        Take,
        TakeHidden,
        Pass,
    }

    /// <summary>낙관적으로 먼저 반영한 내 행동 (서버 확인 전).</summary>
    public sealed class PendingAction
    {
        public int ReqId;
        public PendingKind Kind;
        public double SentAtMs;
        public bool Acked;
        /// <summary>예측: 가져갈 카드 (TakeHidden 이면 -1).</summary>
        public int Card;
        /// <summary>예측: 함께 가져갈 칩 / 패스 후 카드 위 칩.</summary>
        public int PileChips;
        /// <summary>예측: 행동 후 내 칩.</summary>
        public int MyChipsAfter;
    }

    /// <summary>
    /// 클라이언트 측 게임 세션.
    /// 1) 이벤트를 Seq 순서대로 정렬해 전달 (구멍이 생기면 대기 → 일정 시간 후 resync 요청)
    /// 2) 내 행동은 서버 응답 전에 OnPredicted 로 즉시 알림 (입력 → 반응 100ms 이내)
    /// 3) 서버가 같은 ReqId 로 결과 이벤트를 보내면 OnConfirmed, 거절하면 OnRolledBack
    /// UnityEngine 에 의존하지 않으므로 dotnet test 로 검증한다.
    /// </summary>
    public sealed class GameClient
    {
        private readonly IRoom _room;
        private readonly Scheduler _clock;
        private readonly SortedDictionary<long, ServerEvent> _buffer = new SortedDictionary<long, ServerEvent>();
        private long _expectedSeq = 1;
        private double _gapSince = -1;
        private int _reqSerial;
        private Scheduler.Handle _pendingTimeout;

        /// <summary>시퀀스 구멍을 이 시간 이상 못 메우면 resync 요청.</summary>
        public double GapTimeoutMs = 1500;
        /// <summary>내 행동에 대한 서버 응답 대기 한도. 넘으면 롤백 후 resync.</summary>
        public double PendingTimeoutMs = 4000;

        public PendingAction Pending { get; private set; }
        public string SessionId { get { return _room.SessionId; } }
        public RoomStateSchema State { get { return _room.State; } }
        public long LastAppliedSeq { get { return _expectedSeq - 1; } }
        public int ResyncCount { get; private set; }

        /// <summary>순서가 보장된 서버 이벤트. 두 번째 인자: 내가 이미 낙관적으로 연출한 행동의 확정이면 true.</summary>
        public event Action<ServerEvent, bool> OnServerEvent;
        public event Action<RoomStateSchema> OnState;
        public event Action<PendingAction> OnPredicted;
        public event Action<PendingAction> OnConfirmed;
        public event Action<PendingAction, string> OnRolledBack;
        public event Action<string> OnToast;

        public GameClient(IRoom room, Scheduler clock)
        {
            _room = room;
            _clock = clock;
            _room.OnEvent += HandleRaw;
            _room.OnStateChange += s => { if (OnState != null) OnState(s); };
        }

        public bool IsMyTurn
        {
            get
            {
                var s = State;
                return s != null && s.Phase == Phases.Playing && s.CurrentPlayerId == SessionId && !s.RevealPending;
            }
        }

        public PlayerSchema Me { get { return State != null ? State.FindPlayer(SessionId) : null; } }

        public bool CanAct { get { return IsMyTurn && Pending == null && State.CurrentCard != 0; } }

        /// <summary>패스 가능 여부 (칩 0개면 패스 = 강제 가져가기이므로 UI 에서는 가져가기만 허용).</summary>
        public bool CanPass
        {
            get
            {
                var me = Me;
                return CanAct && me != null && me.Chips > 0;
            }
        }

        // ------------------------------------------------------------------
        // 입력
        // ------------------------------------------------------------------
        public PendingAction RequestTake()
        {
            if (!CanAct) return null;
            var s = State;
            var me = Me;
            var p = new PendingAction
            {
                ReqId = ++_reqSerial,
                Kind = s.CurrentCard == -1 ? PendingKind.TakeHidden : PendingKind.Take,
                SentAtMs = _clock.Now,
                Card = s.CurrentCard,
                PileChips = s.PileChips,
                MyChipsAfter = (me != null ? me.Chips : 0) + s.PileChips,
            };
            Begin(p, ClientMessageTypes.Take);
            return p;
        }

        public PendingAction RequestPass()
        {
            if (!CanPass) return null;
            var s = State;
            var me = Me;
            var p = new PendingAction
            {
                ReqId = ++_reqSerial,
                Kind = PendingKind.Pass,
                SentAtMs = _clock.Now,
                Card = s.CurrentCard,
                PileChips = s.PileChips + 1,
                MyChipsAfter = me.Chips - 1,
            };
            Begin(p, ClientMessageTypes.Pass);
            return p;
        }

        private void Begin(PendingAction p, string type)
        {
            Pending = p;
            // 낙관적 반응: 서버 전송보다 먼저 UI 에 알린다 (같은 프레임 안에서 연출 시작)
            if (OnPredicted != null) OnPredicted(p);
            _room.Send(type, new ClientMessage { ReqId = p.ReqId });
            Scheduler.Cancel(_pendingTimeout);
            _pendingTimeout = _clock.Schedule(PendingTimeoutMs, () =>
            {
                if (Pending == p) Rollback("서버 응답 없음");
                RequestResync();
            });
        }

        public int Send(string type, ClientMessage msg)
        {
            msg = msg ?? new ClientMessage();
            if (msg.ReqId == 0) msg.ReqId = ++_reqSerial;
            _room.Send(type, msg);
            return msg.ReqId;
        }

        public void RequestResync()
        {
            _room.Send(ClientMessageTypes.Resync, new ClientMessage());
        }

        // ------------------------------------------------------------------
        // 수신 & 순서 보장
        // ------------------------------------------------------------------
        private void HandleRaw(ServerEvent ev)
        {
            if (ev.Type == EventTypes.Resync)
            {
                // 서버가 전체 상태를 다시 보냄 → 시퀀스 재기준
                _buffer.Clear();
                _expectedSeq = ev.Seq + 1;
                _gapSince = -1;
                ResyncCount++;
                Dispatch(ev);
                return;
            }
            if (ev.Seq < _expectedSeq) return; // 중복
            _buffer[ev.Seq] = ev;
            Drain();
        }

        private void Drain()
        {
            ServerEvent next;
            while (_buffer.TryGetValue(_expectedSeq, out next))
            {
                _buffer.Remove(_expectedSeq);
                _expectedSeq++;
                Dispatch(next);
            }
            if (_buffer.Count > 0)
            {
                if (_gapSince < 0)
                {
                    _gapSince = _clock.Now;
                    long waitingFor = _expectedSeq;
                    _clock.Schedule(GapTimeoutMs, () =>
                    {
                        if (_expectedSeq == waitingFor && _buffer.Count > 0) RequestResync();
                    });
                }
            }
            else _gapSince = -1;
        }

        /// <summary>테스트/디버그용: 시퀀스 처리 경로에 직접 이벤트 주입.</summary>
        public void InjectForTest(ServerEvent ev) { HandleRaw(ev); }

        private void Dispatch(ServerEvent ev)
        {
            bool predicted = false;
            var p = Pending;
            switch (ev.Type)
            {
                case EventTypes.ActionResult:
                    if (p != null && ev.ReqId == p.ReqId)
                    {
                        if (!ev.Ok) Rollback(ev.Reason ?? "거절됨");
                        else p.Acked = true;
                    }
                    else if (!ev.Ok && OnToast != null && !string.IsNullOrEmpty(ev.Reason))
                    {
                        OnToast(ev.Reason);
                    }
                    break;
                case EventTypes.CardTaken:
                    if (p != null && ev.ReqId == p.ReqId && p.Kind == PendingKind.Take) { predicted = true; Confirm(); }
                    else if (p != null && ev.ReqId == p.ReqId) Confirm();
                    break;
                case EventTypes.ChipPlaced:
                    if (p != null && ev.ReqId == p.ReqId && p.Kind == PendingKind.Pass) { predicted = true; Confirm(); }
                    break;
                case EventTypes.HiddenRevealed:
                    if (p != null && ev.ReqId == p.ReqId) Confirm();
                    break;
                case EventTypes.Toast:
                    if (OnToast != null) OnToast(ev.Reason);
                    break;
            }
            if (OnServerEvent != null) OnServerEvent(ev, predicted);
        }

        private void Confirm()
        {
            var p = Pending;
            Pending = null;
            Scheduler.Cancel(_pendingTimeout);
            if (p != null && OnConfirmed != null) OnConfirmed(p);
        }

        private void Rollback(string reason)
        {
            var p = Pending;
            Pending = null;
            Scheduler.Cancel(_pendingTimeout);
            if (p != null && OnRolledBack != null) OnRolledBack(p, reason);
        }
    }
}
