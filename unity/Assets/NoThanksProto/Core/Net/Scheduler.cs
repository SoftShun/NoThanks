using System;
using System.Collections.Generic;

namespace NoThanks.Core.Net
{
    /// <summary>
    /// 단일 스레드 가상 시계 스케줄러. 서버 타이머(봇 사고 시간, 턴 제한, 숨김 공개 지연)와
    /// 지연 시뮬레이션 전송을 모두 이 시계로 돌린다. Unity 에서는 매 프레임 AdvanceTo(실시간 ms) 를 호출하고,
    /// 테스트에서는 Advance(ms) 로 시간을 빨리 감는다. (WebGL 은 스레드가 없으므로 이 방식이 필수)
    /// 같은 시각에 예약된 작업은 예약 순서(FIFO)대로 실행한다.
    /// </summary>
    public sealed class Scheduler
    {
        public sealed class Handle
        {
            internal double At;
            internal long Order;
            internal Action Action;
            internal bool Cancelled;
            public bool IsActive { get { return !Cancelled && Action != null; } }
        }

        private readonly List<Handle> _queue = new List<Handle>();
        private long _order;

        public double Now { get; private set; }

        public Scheduler(double startMs = 0)
        {
            Now = startMs;
        }

        public int PendingCount
        {
            get
            {
                int n = 0;
                foreach (var h in _queue) if (h.IsActive) n++;
                return n;
            }
        }

        public Handle Schedule(double delayMs, Action action)
        {
            return ScheduleAt(Now + Math.Max(0, delayMs), action);
        }

        public Handle ScheduleAt(double atMs, Action action)
        {
            var h = new Handle { At = Math.Max(atMs, Now), Order = ++_order, Action = action };
            // 정렬 삽입 (At, Order)
            int i = _queue.Count;
            while (i > 0 && Compare(_queue[i - 1], h) > 0) i--;
            _queue.Insert(i, h);
            return h;
        }

        public static void Cancel(Handle h)
        {
            if (h != null) { h.Cancelled = true; h.Action = null; }
        }

        private static int Compare(Handle a, Handle b)
        {
            int c = a.At.CompareTo(b.At);
            return c != 0 ? c : a.Order.CompareTo(b.Order);
        }

        public void Advance(double dtMs)
        {
            AdvanceTo(Now + dtMs);
        }

        /// <summary>목표 시각까지 기한이 된 작업을 순서대로 실행. 실행 중 새로 예약된 작업도 기한 내라면 함께 처리.</summary>
        public void AdvanceTo(double targetMs)
        {
            int guard = 0;
            while (_queue.Count > 0 && _queue[0].At <= targetMs)
            {
                var h = _queue[0];
                _queue.RemoveAt(0);
                if (h.Cancelled || h.Action == null) continue;
                if (h.At > Now) Now = h.At;
                var a = h.Action;
                h.Action = null;
                a();
                if (++guard > 100000) throw new InvalidOperationException("Scheduler runaway");
            }
            if (targetMs > Now) Now = targetMs;
        }
    }
}
