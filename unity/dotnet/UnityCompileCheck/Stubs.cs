// 컴파일 검사 전용 스텁: LitMotion v2.0.2, URP Light2D, Input System 의 "우리가 쓰는" API 만 실제 소스 시그니처대로 흉내.
using System;
namespace LitMotion
{
    public enum Ease { Linear, OutSine, InOutSine, InQuad, OutQuad, InOutQuad, InCubic, OutCubic, InOutCubic, OutQuart, OutExpo, OutElastic, InBack, OutBack }
    public interface IMotionScheduler { }
    public static class MotionScheduler { public static readonly IMotionScheduler UpdateIgnoreTimeScale = null; }
    public struct NoOptions { }
    public struct FloatMotionAdapter { }
    public enum DelayType { FirstLoop, EveryLoop }
    public struct MotionHandle { }
    public static class MotionHandleExtensions
    {
        public static bool IsActive(this MotionHandle h) => false;
        public static void Cancel(this MotionHandle h) { }
    }
    public struct MotionBuilder<TValue, TOptions, TAdapter> : IDisposable
    {
        public readonly MotionBuilder<TValue, TOptions, TAdapter> WithEase(Ease ease) => this;
        public readonly MotionBuilder<TValue, TOptions, TAdapter> WithDelay(float delay, DelayType delayType = DelayType.FirstLoop, bool skipValuesDuringDelay = true) => this;
        public readonly MotionBuilder<TValue, TOptions, TAdapter> WithOnComplete(Action callback) => this;
        public readonly MotionBuilder<TValue, TOptions, TAdapter> WithScheduler(IMotionScheduler scheduler) => this;
        public MotionHandle Bind(Action<TValue> action) => default;
        public void Dispose() { }
    }
    public static class LMotion
    {
        public static MotionBuilder<float, NoOptions, FloatMotionAdapter> Create(float from, float to, float duration) => default;
    }
}
namespace UnityEngine.Rendering.Universal
{
    public sealed class Light2D : UnityEngine.Behaviour
    {
        public enum LightType { Parametric = 0, Freeform = 1, Sprite = 2, Point = 3, Global = 4 }
        public LightType lightType { get; set; }
        public Color color { get; set; }
        public float intensity { get; set; }
        public float falloffIntensity { get; set; }
        public float pointLightInnerRadius { get; set; }
        public float pointLightOuterRadius { get; set; }
    }
}
#if ENABLE_INPUT_SYSTEM
namespace UnityEngine.InputSystem
{
    public class ButtonControl { public bool wasPressedThisFrame => false; }
    public class KeyControl : ButtonControl { }
    public class Keyboard
    {
        public static Keyboard current => null;
        public KeyControl enterKey, numpadEnterKey, tKey, spaceKey, pKey, escapeKey, mKey, f3Key, digit1Key, digit2Key, digit3Key;
    }
}
#endif
