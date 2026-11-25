using System;
using System.Collections.Generic;
using LitMotion;
using UnityEngine;

namespace NoThanks.Proto
{
    /// <summary>
    /// 모션 설정. 시간/이징 표는 docs/remake/motion-feedback.md 와 1:1 로 맞춘다.
    /// </summary>
    public static class MotionSpec
    {
        public const float Press = 0.08f;          // 버튼 눌림
        public const float CardReveal = 0.36f;     // 덱 → 중앙 + 뒤집기
        public const float ChipPlace = 0.28f;      // 칩 한 개 이동
        public const float CardTake = 0.42f;       // 카드 → 손패
        public const float ChipCollectStagger = 0.03f;
        public const float TurnChange = 0.24f;
        public const float HiddenShake = 0.30f;
        public const float Rollback = 0.22f;
        public const float Toast = 0.18f;
        public const float TallyPerPlayer = 0.9f;
        public const float EndBanner = 0.6f;
        public const float ReducedFade = 0.12f;
    }

    /// <summary>
    /// LitMotion 래퍼. 모든 트윈은 여기서 만든다 (DOTween 미사용).
    /// - Speed: 애니메이션 큐 적체 시 따라잡기 배속
    /// - Reduced: prefers-reduced-motion / 설정에서 "모션 줄이기" 시, 이동 연출 대신 짧은 페이드
    /// </summary>
    public static class Tw
    {
        public static float Speed = 1f;
        public static bool Reduced;

        public static float Dur(float seconds)
        {
            if (Reduced) seconds = Mathf.Min(seconds, MotionSpec.ReducedFade);
            return Mathf.Max(0.001f, seconds / Mathf.Max(0.1f, Speed));
        }

        /// <summary>0→1 진행값 트윈. onComplete 는 정상 완료 시에만 호출.</summary>
        public static MotionHandle Run(float seconds, Ease ease, Action<float> onT, Action onComplete = null, float delay = 0f)
        {
            var builder = LMotion.Create(0f, 1f, Dur(seconds))
                .WithEase(Reduced ? Ease.Linear : ease)
                .WithScheduler(MotionScheduler.UpdateIgnoreTimeScale);
            if (delay > 0f) builder = builder.WithDelay(delay / Mathf.Max(0.1f, Speed));
            if (onComplete != null) builder = builder.WithOnComplete(onComplete);
            return builder.Bind(onT);
        }

        public static void Kill(MotionHandle h)
        {
            if (h.IsActive()) h.Cancel();
        }

        public static float Lerp(float a, float b, float t) { return a + (b - a) * t; }

        /// <summary>포물선 보간 (카드/칩이 살짝 떠서 날아가는 궤적).</summary>
        public static Vector2 Arc(Vector2 a, Vector2 b, float t, float height)
        {
            var p = Vector2.LerpUnclamped(a, b, t);
            p.y -= Mathf.Sin(Mathf.Clamp01(t) * Mathf.PI) * height;
            return p;
        }
    }

    /// <summary>
    /// 단일 애니메이션 큐. 서버 이벤트·낙관적 반응·롤백 연출을 모두 여기에 넣어 순서를 보장한다.
    /// 한 번에 하나의 단계만 재생하고, 적체되면 배속을 올려 따라잡는다.
    /// 각 단계는 done 콜백을 반드시 호출해야 하며, 호출하지 않으면 MaxSeconds 후 워치독이 넘긴다.
    /// </summary>
    public sealed class AnimQueue
    {
        private sealed class Step
        {
            public string Name;
            public Action<Action> Run;
            public float MaxSeconds;
            public float StartedAt;
        }

        private readonly Queue<Step> _queue = new Queue<Step>();
        private Step _current;
        private bool _wasBusy;

        public event Action OnIdle;
        public event Action<string> OnStepStarted;

        public int Count { get { return _queue.Count + (_current != null ? 1 : 0); } }
        public bool Idle { get { return _current == null && _queue.Count == 0; } }
        public string CurrentName { get { return _current != null ? _current.Name : ""; } }

        public void Enqueue(string name, Action<Action> run, float maxSeconds = 3f)
        {
            _queue.Enqueue(new Step { Name = name, Run = run, MaxSeconds = maxSeconds });
            Pump();
        }

        /// <summary>즉시 실행되는 0초 단계 (데이터 동기화 등). 순서는 지킨다.</summary>
        public void EnqueueInstant(string name, Action action)
        {
            Enqueue(name, done => { action(); done(); }, 1f);
        }

        public void Clear()
        {
            _queue.Clear();
            _current = null;
            Tw.Speed = 1f;
        }

        public void Update()
        {
            if (_current != null && Time.unscaledTime - _current.StartedAt > _current.MaxSeconds)
            {
                Debug.LogWarning("[AnimQueue] watchdog skipped step: " + _current.Name);
                _current = null;
            }
            Pump();
            if (Idle && _wasBusy)
            {
                _wasBusy = false;
                Tw.Speed = 1f;
                if (OnIdle != null) OnIdle();
            }
        }

        private void Pump()
        {
            int guard = 0;
            while (_current == null && _queue.Count > 0 && guard++ < 64)
            {
                var step = _queue.Dequeue();
                _current = step;
                _wasBusy = true;
                step.StartedAt = Time.unscaledTime;
                int backlog = _queue.Count;
                Tw.Speed = backlog >= 4 ? 2.2f : backlog >= 2 ? 1.4f : 1f;
                if (OnStepStarted != null) OnStepStarted(step.Name);
                bool finished = false;
                try
                {
                    step.Run(() =>
                    {
                        if (finished) return;
                        finished = true;
                        if (_current == step) _current = null;
                    });
                }
                catch (Exception e)
                {
                    Debug.LogException(e);
                    if (_current == step) _current = null;
                }
            }
        }
    }
}
