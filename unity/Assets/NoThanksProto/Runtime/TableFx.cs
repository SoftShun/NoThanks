using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace NoThanks.Proto
{
    /// <summary>
    /// 월드 공간 분위기 레이어 (UI Toolkit 뒤): 펠트 테이블, 2D 라이트(펜던트 조명 + 턴 강조광),
    /// 먼지 파티클, 가져가기/종료 파티클, 블룸을 받는 HDR 글로우.
    /// 씬 생성 메뉴(Tools/NoThanks Proto/Build Scene)가 카메라·라이트·볼륨을 만들고 이 컴포넌트에 연결한다.
    /// </summary>
    public sealed class TableFx : MonoBehaviour
    {
        public Camera Cam;
        public Light2D GlobalLight;
        public Light2D Lamp;
        public Light2D Accent;
        [Tooltip("URP Sprite-Lit-Default (조명 받는 스프라이트)")] public Material LitSpriteMaterial;
        [Tooltip("URP Sprite-Unlit-Default (파티클/글로우)")] public Material UnlitSpriteMaterial;

        private SpriteRenderer _felt, _glow, _halo;
        private ParticleSystem _dust, _sparks;
        private Vector2 _lastScreen;
        private Vector3 _accentTarget;
        private float _glowBoost;
        private bool _reduced;

        private void Start()
        {
            if (Cam == null) Cam = Camera.main;
            BuildFelt();
            BuildGlow();
            BuildParticles();
            Fit();
            if (Accent != null) _accentTarget = Accent.transform.position;
        }

        private Material Mat(Material src)
        {
            return src != null ? new Material(src) : null;
        }

        private void BuildFelt()
        {
            var go = new GameObject("Felt");
            go.transform.SetParent(transform, false);
            _felt = go.AddComponent<SpriteRenderer>();
            var tex = ProceduralArt.Felt;
            var sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 64f, 0, SpriteMeshType.FullRect);
            _felt.sprite = sprite;
            _felt.drawMode = SpriteDrawMode.Tiled;
            _felt.sortingOrder = -100;
            if (LitSpriteMaterial != null) _felt.sharedMaterial = LitSpriteMaterial;
        }

        private void BuildGlow()
        {
            var tex = ProceduralArt.Soft;
            var sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 32f);

            var halo = new GameObject("LampHalo");
            halo.transform.SetParent(transform, false);
            _halo = halo.AddComponent<SpriteRenderer>();
            _halo.sprite = sprite;
            _halo.sortingOrder = -90;
            _halo.color = new Color(1.0f, 0.82f, 0.55f, 0.10f);
            if (UnlitSpriteMaterial != null) _halo.sharedMaterial = UnlitSpriteMaterial;

            var glow = new GameObject("CardGlow");
            glow.transform.SetParent(transform, false);
            _glow = glow.AddComponent<SpriteRenderer>();
            _glow.sprite = sprite;
            _glow.sortingOrder = -80;
            _glow.color = new Color(1.6f, 1.25f, 0.75f, 0.0f); // HDR → 블룸
            if (UnlitSpriteMaterial != null) _glow.sharedMaterial = UnlitSpriteMaterial;
        }

        private void BuildParticles()
        {
            var mat = Mat(UnlitSpriteMaterial);
            if (mat != null) mat.mainTexture = ProceduralArt.Soft;

            // 조명 속 먼지
            var dustGo = new GameObject("Dust");
            dustGo.transform.SetParent(transform, false);
            _dust = dustGo.AddComponent<ParticleSystem>();
            _dust.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = _dust.main;
            main.loop = true;
            main.playOnAwake = false;
            main.startLifetime = new ParticleSystem.MinMaxCurve(6f, 10f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0f, 0f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.03f, 0.09f);
            main.startColor = new ParticleSystem.MinMaxGradient(new Color(1f, 0.9f, 0.7f, 0.35f), new Color(1f, 0.95f, 0.85f, 0.12f));
            main.maxParticles = 90;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            var em = _dust.emission;
            em.rateOverTime = 7f;
            var sh = _dust.shape;
            sh.shapeType = ParticleSystemShapeType.Box;
            sh.scale = new Vector3(7f, 5f, 0.1f);
            var vel = _dust.velocityOverLifetime;
            vel.enabled = true;
            vel.space = ParticleSystemSimulationSpace.World;
            vel.x = new ParticleSystem.MinMaxCurve(-0.05f, 0.05f);
            vel.y = new ParticleSystem.MinMaxCurve(0.01f, 0.07f);
            vel.z = new ParticleSystem.MinMaxCurve(0f, 0f);
            var col = _dust.colorOverLifetime;
            col.enabled = true;
            var grad = new Gradient();
            grad.SetKeys(
                new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                new[] { new GradientAlphaKey(0f, 0f), new GradientAlphaKey(1f, 0.3f), new GradientAlphaKey(0f, 1f) });
            col.color = new ParticleSystem.MinMaxGradient(grad);
            var dr = _dust.GetComponent<ParticleSystemRenderer>();
            if (mat != null) dr.sharedMaterial = mat;
            dr.sortingOrder = -70;
            _dust.Play();

            // 가져가기/종료 불꽃
            var sparkGo = new GameObject("Sparks");
            sparkGo.transform.SetParent(transform, false);
            _sparks = sparkGo.AddComponent<ParticleSystem>();
            _sparks.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var sm = _sparks.main;
            sm.loop = false;
            sm.playOnAwake = false;
            sm.startLifetime = new ParticleSystem.MinMaxCurve(0.5f, 1.1f);
            sm.startSpeed = new ParticleSystem.MinMaxCurve(1.5f, 4f);
            sm.startSize = new ParticleSystem.MinMaxCurve(0.05f, 0.14f);
            sm.gravityModifier = 0.6f;
            sm.maxParticles = 400;
            sm.simulationSpace = ParticleSystemSimulationSpace.World;
            var sem = _sparks.emission;
            sem.rateOverTime = 0f;
            var ssh = _sparks.shape;
            ssh.enabled = false;
            var scol = _sparks.colorOverLifetime;
            scol.enabled = true;
            var sg = new Gradient();
            sg.SetKeys(
                new[] { new GradientColorKey(new Color(1f, 0.9f, 0.6f), 0f), new GradientColorKey(new Color(0.8f, 0.55f, 0.25f), 1f) },
                new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(0f, 1f) });
            scol.color = new ParticleSystem.MinMaxGradient(sg);
            var sr = _sparks.GetComponent<ParticleSystemRenderer>();
            if (mat != null) sr.sharedMaterial = mat;
            sr.sortingOrder = -60;
        }

        public void SetReducedMotion(bool reduced)
        {
            _reduced = reduced;
            if (_dust == null) return;
            if (reduced) _dust.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            else if (!_dust.isPlaying) _dust.Play();
        }

        public Vector3 ScreenToWorld(Vector2 screenPx)
        {
            if (Cam == null) return Vector3.zero;
            var w = Cam.ScreenToWorldPoint(new Vector3(screenPx.x, screenPx.y, -Cam.transform.position.z));
            w.z = 0;
            return w;
        }

        /// <summary>턴인 좌석 쪽으로 강조광 이동.</summary>
        public void Focus(Vector2 screenPx)
        {
            _accentTarget = ScreenToWorld(screenPx);
        }

        public void Glow(Vector2 screenPx)
        {
            if (_glow == null) return;
            _glow.transform.position = ScreenToWorld(screenPx);
            _glowBoost = 1f;
        }

        public void Burst(Vector2 screenPx, int count)
        {
            if (_sparks == null || _reduced || count <= 0) return;
            var p = ScreenToWorld(screenPx);
            var ep = new ParticleSystem.EmitParams();
            for (int i = 0; i < count; i++)
            {
                var dir = Random.insideUnitCircle.normalized;
                ep.position = p;
                ep.velocity = new Vector3(dir.x, Mathf.Abs(dir.y) + 0.4f, 0) * Random.Range(1.5f, 3.5f);
                ep.applyShapeToPosition = false;
                _sparks.Emit(ep, 1);
            }
        }

        public void Confetti()
        {
            if (_sparks == null || _reduced || Cam == null) return;
            float h = Cam.orthographicSize, w = h * Cam.aspect;
            var ep = new ParticleSystem.EmitParams();
            for (int i = 0; i < 120; i++)
            {
                ep.position = new Vector3(Random.Range(-w, w), h + Random.Range(0f, 1f), 0);
                ep.velocity = new Vector3(Random.Range(-0.6f, 0.6f), Random.Range(-2.5f, -0.5f), 0);
                ep.startLifetime = Random.Range(1.6f, 2.6f);
                ep.startSize = Random.Range(0.08f, 0.18f);
                ep.applyShapeToPosition = false;
                _sparks.Emit(ep, 1);
            }
        }

        private void Fit()
        {
            if (Cam == null) return;
            _lastScreen = new Vector2(Screen.width, Screen.height);
            float h = Cam.orthographicSize * 2f, w = h * Cam.aspect;
            if (_felt != null) _felt.size = new Vector2(w + 2f, h + 2f);
            float r = Mathf.Max(w, h);
            if (_halo != null) _halo.transform.localScale = Vector3.one * r * 0.42f;
            if (_glow != null) _glow.transform.localScale = Vector3.one * Mathf.Min(w, h) * 0.32f;
            if (Lamp != null)
            {
                Lamp.pointLightOuterRadius = r * 0.62f;
                Lamp.pointLightInnerRadius = r * 0.08f;
            }
            if (_dust != null)
            {
                var sh = _dust.shape;
                sh.scale = new Vector3(w * 0.8f, h * 0.7f, 0.1f);
            }
        }

        private void Update()
        {
            if (Screen.width != (int)_lastScreen.x || Screen.height != (int)_lastScreen.y) Fit();
            float dt = Time.unscaledDeltaTime;
            if (Accent != null)
            {
                Accent.transform.position = Vector3.Lerp(Accent.transform.position, _accentTarget, 1f - Mathf.Exp(-dt * 6f));
            }
            if (_glow != null)
            {
                _glowBoost = Mathf.MoveTowards(_glowBoost, 0f, dt * 1.6f);
                var c = _glow.color;
                c.a = 0.18f + 0.5f * _glowBoost;
                _glow.color = c;
            }
            if (Lamp != null && !_reduced)
            {
                // 아주 미세한 조명 흔들림 (살아있는 느낌)
                Lamp.intensity = 1.05f + Mathf.Sin(Time.unscaledTime * 0.7f) * 0.03f;
            }
        }
    }
}
