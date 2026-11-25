using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

namespace NoThanks.Proto
{
    /// <summary>
    /// 브라우저 연동 (Assets/Plugins/WebGL/NoThanksWeb.jslib). 에디터/다른 플랫폼에서는 안전한 기본값.
    /// </summary>
    public static class WebBridge
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void NT_Vibrate(int ms);
        [DllImport("__Internal")] private static extern int NT_PrefersReducedMotion();
        [DllImport("__Internal")] private static extern float NT_DevicePixelRatio();
        [DllImport("__Internal")] private static extern float NT_SafeAreaInset(int side);
        [DllImport("__Internal")] private static extern int NT_IsTouch();
        [DllImport("__Internal")] private static extern float NT_LoadMs();
#endif

        public static void Vibrate(int ms)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            NT_Vibrate(ms);
#elif (UNITY_ANDROID || UNITY_IOS) && !UNITY_EDITOR
            if (ms >= 25) Handheld.Vibrate();
#endif
        }

        public static bool PrefersReducedMotion
        {
            get
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                return NT_PrefersReducedMotion() != 0;
#else
                return false;
#endif
            }
        }

        /// <summary>논리 픽셀(CSS px / dp) 당 물리 픽셀 수.</summary>
        public static float DevicePixelRatio
        {
            get
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                return Mathf.Clamp(NT_DevicePixelRatio(), 1f, 4f);
#elif UNITY_EDITOR
                return 1f; // 에디터 Game 뷰 해상도 프리셋(390×844 등)을 논리 px 로 그대로 쓰기 위해
#else
                float dpi = Screen.dpi;
                if (dpi <= 0) return 1f;
                if (Application.isMobilePlatform) return Mathf.Clamp(dpi / 160f, 1f, 4f);
                return dpi >= 180 ? 2f : 1f; // 맥 레티나 등
#endif
            }
        }

        /// <summary>safe area 여백 (논리 px). 0=위 1=오른쪽 2=아래 3=왼쪽.</summary>
        public static Vector4 SafeInsets(float dpr)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return new Vector4(NT_SafeAreaInset(0), NT_SafeAreaInset(1), NT_SafeAreaInset(2), NT_SafeAreaInset(3));
#else
            var sa = Screen.safeArea;
            float top = Screen.height - sa.yMax, bottom = sa.yMin, left = sa.xMin, right = Screen.width - sa.xMax;
            return new Vector4(top, right, bottom, left) / Mathf.Max(1f, dpr);
#endif
        }

        public static bool IsTouchDevice
        {
            get
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                return NT_IsTouch() != 0;
#else
                return Application.isMobilePlatform; // 레거시 Input 은 "Input System 전용" 설정에서 예외를 던지므로 쓰지 않는다
#endif
            }
        }

        /// <summary>WebGL 템플릿이 기록한 로딩 시간(ms, 스크립트 시작 → 인스턴스 준비). 없으면 -1.</summary>
        public static float LoadMs
        {
            get
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                return NT_LoadMs();
#else
                return -1f;
#endif
            }
        }
    }

    /// <summary>모바일 햅틱. WebGL 은 navigator.vibrate (Android Chrome 지원, iOS Safari 미지원).</summary>
    public static class Haptics
    {
        public static bool Enabled = true;

        public static void Light() { if (Enabled) WebBridge.Vibrate(8); }
        public static void Medium() { if (Enabled) WebBridge.Vibrate(18); }
        public static void Heavy() { if (Enabled) WebBridge.Vibrate(32); }
        public static void Error() { if (Enabled) WebBridge.Vibrate(45); }
    }

    public enum SfxId
    {
        Tap,
        Chip,
        Flip,
        Take,
        MyTurn,
        Tick,
        Error,
        Tally,
        Win,
        End,
        Reveal,
    }

    /// <summary>
    /// 임시 효과음: 실행 시 PCM 으로 합성 (외부 파일 없음 → 저작권/용량 부담 없음).
    /// 나중에 Resources/Audio/{이름} 에 실제 음원을 넣으면 그것을 우선 사용.
    /// </summary>
    public sealed class Sfx : MonoBehaviour
    {
        public static Sfx Instance;
        public static bool Muted;
        public float Volume = 0.8f;

        private readonly Dictionary<SfxId, AudioClip> _clips = new Dictionary<SfxId, AudioClip>();
        private AudioSource[] _sources;
        private int _next;
        private const int Rate = 44100;

        private void Awake()
        {
            Instance = this;
            _sources = new AudioSource[8];
            for (int i = 0; i < _sources.Length; i++)
            {
                var s = gameObject.AddComponent<AudioSource>();
                s.playOnAwake = false;
                s.spatialBlend = 0;
                _sources[i] = s;
            }
            foreach (SfxId id in System.Enum.GetValues(typeof(SfxId)))
            {
                var external = Resources.Load<AudioClip>("Audio/" + id.ToString().ToLowerInvariant());
                _clips[id] = external != null ? external : Synth(id);
            }
        }

        public static void Play(SfxId id, float pitch = 1f, float volume = 1f)
        {
            if (Instance == null || Muted) return;
            Instance.PlayInternal(id, pitch, volume);
        }

        private void PlayInternal(SfxId id, float pitch, float volume)
        {
            AudioClip clip;
            if (!_clips.TryGetValue(id, out clip) || clip == null) return;
            var src = _sources[_next];
            _next = (_next + 1) % _sources.Length;
            src.pitch = pitch;
            src.volume = Volume * volume;
            src.clip = clip;
            src.Play();
        }

        // ---------------- 합성 ----------------
        private static AudioClip Make(string name, float[] data)
        {
            var c = AudioClip.Create(name, data.Length, 1, Rate, false);
            c.SetData(data, 0);
            return c;
        }

        private static float[] Buf(float seconds) { return new float[Mathf.Max(1, (int)(seconds * Rate))]; }

        private static void AddTone(float[] b, float start, float dur, float freq, float amp, float decay, float attack = 0.002f)
        {
            int s0 = (int)(start * Rate), n = (int)(dur * Rate);
            for (int i = 0; i < n && s0 + i < b.Length; i++)
            {
                float t = i / (float)Rate;
                float env = Mathf.Min(1f, t / attack) * Mathf.Exp(-t * decay);
                b[s0 + i] += Mathf.Sin(2 * Mathf.PI * freq * t) * amp * env;
            }
        }

        private static void AddNoise(float[] b, float start, float dur, float amp, float lowpass, System.Random rng, bool swell = false)
        {
            int s0 = (int)(start * Rate), n = (int)(dur * Rate);
            float y = 0;
            for (int i = 0; i < n && s0 + i < b.Length; i++)
            {
                float t = i / (float)n;
                float env = swell ? Mathf.Sin(t * Mathf.PI) : Mathf.Exp(-t * 6f);
                float x = (float)(rng.NextDouble() * 2 - 1);
                y += (x - y) * lowpass;
                b[s0 + i] += y * amp * env;
            }
        }

        private static void Clink(float[] b, float start, float amp)
        {
            AddTone(b, start, 0.09f, 2830, amp * 0.5f, 55);
            AddTone(b, start, 0.09f, 4170, amp * 0.35f, 70);
            AddTone(b, start, 0.07f, 6310, amp * 0.2f, 90);
        }

        private static void Normalize(float[] b, float peak = 0.85f)
        {
            float m = 0.0001f;
            foreach (var v in b) m = Mathf.Max(m, Mathf.Abs(v));
            float k = peak / m;
            for (int i = 0; i < b.Length; i++) b[i] *= k;
        }

        private static AudioClip Synth(SfxId id)
        {
            var rng = new System.Random((int)id * 97 + 13);
            float[] b;
            switch (id)
            {
                case SfxId.Tap:
                    b = Buf(0.05f); AddTone(b, 0, 0.05f, 1800, 0.5f, 120); AddNoise(b, 0, 0.012f, 0.4f, 0.6f, rng); Normalize(b, 0.5f); break;
                case SfxId.Chip:
                    b = Buf(0.16f); Clink(b, 0, 1f); Clink(b, 0.045f, 0.55f); Normalize(b, 0.7f); break;
                case SfxId.Flip:
                    b = Buf(0.14f); AddNoise(b, 0, 0.13f, 1f, 0.25f, rng, true); AddTone(b, 0.1f, 0.04f, 420, 0.3f, 60); Normalize(b, 0.6f); break;
                case SfxId.Take:
                    b = Buf(0.34f); AddNoise(b, 0, 0.2f, 0.9f, 0.18f, rng, true);
                    Clink(b, 0.16f, 0.8f); Clink(b, 0.2f, 0.6f); Clink(b, 0.235f, 0.45f); Normalize(b, 0.75f); break;
                case SfxId.MyTurn:
                    b = Buf(0.5f); AddTone(b, 0, 0.5f, 880, 0.5f, 7, 0.01f); AddTone(b, 0.06f, 0.44f, 1318.5f, 0.35f, 8, 0.01f); Normalize(b, 0.45f); break;
                case SfxId.Tick:
                    b = Buf(0.03f); AddTone(b, 0, 0.03f, 1200, 0.6f, 160); Normalize(b, 0.35f); break;
                case SfxId.Error:
                    b = Buf(0.24f);
                    for (int i = 0; i < 2; i++)
                    {
                        float st = i * 0.11f;
                        AddTone(b, st, 0.09f, 180 - i * 30, 0.6f, 18); AddTone(b, st, 0.09f, 360 - i * 60, 0.25f, 22);
                    }
                    Normalize(b, 0.5f); break;
                case SfxId.Tally:
                    b = Buf(0.05f); AddTone(b, 0, 0.05f, 1560, 0.5f, 90); Normalize(b, 0.35f); break;
                case SfxId.Win:
                    b = Buf(0.9f);
                    float[] notes = { 523.25f, 659.25f, 783.99f, 1046.5f };
                    for (int i = 0; i < notes.Length; i++)
                    {
                        AddTone(b, i * 0.11f, 0.6f, notes[i], 0.4f, 5, 0.01f);
                        AddTone(b, i * 0.11f, 0.6f, notes[i] * 2, 0.12f, 7, 0.01f);
                    }
                    Normalize(b, 0.55f); break;
                case SfxId.End:
                    b = Buf(0.7f); AddTone(b, 0, 0.7f, 220, 0.4f, 4, 0.02f); AddTone(b, 0, 0.7f, 277.18f, 0.3f, 4, 0.02f); AddTone(b, 0, 0.7f, 329.63f, 0.3f, 4, 0.02f); Normalize(b, 0.45f); break;
                case SfxId.Reveal:
                    b = Buf(0.4f); AddNoise(b, 0, 0.25f, 0.6f, 0.08f, rng, true); AddTone(b, 0.2f, 0.2f, 660, 0.4f, 14); AddTone(b, 0.2f, 0.2f, 990, 0.25f, 16); Normalize(b, 0.55f); break;
                default:
                    b = Buf(0.05f); break;
            }
            return Make("sfx_" + id, b);
        }
    }
}
