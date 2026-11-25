using System.Collections.Generic;
using NoThanks.Core.Net;
using UnityEngine;
using UnityEngine.UIElements;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace NoThanks.Proto
{
    public enum KeyId { Take, Pass, Menu, Mute, Perf, Lat0, Lat100, Lat300, Confirm }

    /// <summary>키보드 입력. Input System 이 켜져 있으면 그것을, 아니면 레거시 Input 을 사용.</summary>
    public static class Keys
    {
        public static bool Down(KeyId k)
        {
#if ENABLE_INPUT_SYSTEM
            var kb = Keyboard.current;
            if (kb == null) return false;
            switch (k)
            {
                case KeyId.Take: return kb.enterKey.wasPressedThisFrame || kb.numpadEnterKey.wasPressedThisFrame || kb.tKey.wasPressedThisFrame;
                case KeyId.Pass: return kb.spaceKey.wasPressedThisFrame || kb.pKey.wasPressedThisFrame;
                case KeyId.Menu: return kb.escapeKey.wasPressedThisFrame;
                case KeyId.Mute: return kb.mKey.wasPressedThisFrame;
                case KeyId.Perf: return kb.f3Key.wasPressedThisFrame;
                case KeyId.Lat0: return kb.digit1Key.wasPressedThisFrame;
                case KeyId.Lat100: return kb.digit2Key.wasPressedThisFrame;
                case KeyId.Lat300: return kb.digit3Key.wasPressedThisFrame;
                case KeyId.Confirm: return kb.enterKey.wasPressedThisFrame || kb.numpadEnterKey.wasPressedThisFrame;
            }
            return false;
#elif ENABLE_LEGACY_INPUT_MANAGER
            switch (k)
            {
                case KeyId.Take: return Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter) || Input.GetKeyDown(KeyCode.T);
                case KeyId.Pass: return Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.P);
                case KeyId.Menu: return Input.GetKeyDown(KeyCode.Escape);
                case KeyId.Mute: return Input.GetKeyDown(KeyCode.M);
                case KeyId.Perf: return Input.GetKeyDown(KeyCode.F3);
                case KeyId.Lat0: return Input.GetKeyDown(KeyCode.Alpha1);
                case KeyId.Lat100: return Input.GetKeyDown(KeyCode.Alpha2);
                case KeyId.Lat300: return Input.GetKeyDown(KeyCode.Alpha3);
                case KeyId.Confirm: return Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter);
            }
            return false;
#else
            return false;
#endif
        }
    }

    /// <summary>프레임 시간 측정 (평균 fps, 최저 1% fps).</summary>
    public sealed class PerfMeter
    {
        private readonly float[] _dt = new float[240];
        private int _i, _n;

        public void Tick(float dt)
        {
            _dt[_i] = dt;
            _i = (_i + 1) % _dt.Length;
            if (_n < _dt.Length) _n++;
        }

        public float AvgFps
        {
            get
            {
                if (_n == 0) return 0;
                float s = 0;
                for (int i = 0; i < _n; i++) s += _dt[i];
                return _n / Mathf.Max(0.0001f, s);
            }
        }

        public float Low1Fps
        {
            get
            {
                if (_n == 0) return 0;
                var list = new List<float>(_n);
                for (int i = 0; i < _n; i++) list.Add(_dt[i]);
                list.Sort();
                int idx = Mathf.Clamp(Mathf.CeilToInt(_n * 0.99f) - 1, 0, _n - 1);
                return 1f / Mathf.Max(0.0001f, list[idx]);
            }
        }
    }

    /// <summary>
    /// 앱 진입점. 화면(로비/게임/결과) 전환, 레이아웃 판정, safe area, 패널 배율(DPR),
    /// 키보드 단축키, 성능 표시, 설정 저장을 맡는다.
    /// </summary>
    public sealed class App : MonoBehaviour
    {
        public PanelSettings PanelSettings;
        public TableFx Fx;

        private enum ScreenId { Lobby, Game, Result }

        private UIDocument _doc;
        private VisualElement _root;
        private ScreenId _screen = ScreenId.Lobby;
        private LayoutKind _layout;
        private Vector4 _safe;
        private float _dpr = 1;
        private Vector2Int _lastPx;
        private Vector4 _lastSafe;

        private GameConfig _cfg;
        private readonly AnimQueue _queue = new AnimQueue();
        private LobbyScreen _lobby;
        private GameScreen _game;
        private ResultScreen _result;
        private GameController _ctl;
        private List<ResultSchema> _lastResults;
        private string _lastMeId;
        private bool _perfVisible;
        private readonly PerfMeter _perf = new PerfMeter();
        private float _perfRefresh;
        private bool _osReduced;

        private const string PrefKey = "nothanks.proto.config";

        private void Awake()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            Application.targetFrameRate = -1; // 브라우저 requestAnimationFrame 에 맡김
#else
            Application.targetFrameRate = 60;
#endif
            Input_Init();
            _cfg = LoadConfig();
            Sfx.Muted = _cfg.Muted;
            Haptics.Enabled = _cfg.HapticsOn;
            if (GetComponent<Sfx>() == null) gameObject.AddComponent<Sfx>();
            _osReduced = WebBridge.PrefersReducedMotion;
            ApplyReducedMotion();
        }

        private void Input_Init()
        {
            // 터치 중 브라우저 스크롤/확대 방지는 WebGL 템플릿(CSS)이 처리
        }

        private void Start()
        {
            SetupDocument();
            _lobby = new LobbyScreen();
            _lobby.OnStart = StartGame;
            _lobby.OnConfigChanged = () => { SaveConfig(); ApplyReducedMotion(); };
            _game = new GameScreen();
            _result = new ResultScreen();
            _result.OnAgain = StartGame;
            _result.OnLobby = ShowLobby;
            MeasureDisplay(true);
            ShowLobby();
        }

        private void SetupDocument()
        {
            _doc = GetComponent<UIDocument>();
            if (_doc == null)
            {
                if (PanelSettings == null) PanelSettings = ScriptableObject.CreateInstance<PanelSettings>();
                var go = new GameObject("UIDocument");
                go.SetActive(false);
                go.transform.SetParent(transform, false);
                _doc = go.AddComponent<UIDocument>();
                _doc.panelSettings = PanelSettings;
                go.SetActive(true);
            }
            if (_doc.panelSettings == null)
            {
                _doc.panelSettings = PanelSettings != null ? PanelSettings : ScriptableObject.CreateInstance<PanelSettings>();
            }
            // 실행 중 배율(DPR)을 바꾸므로 에셋 원본을 건드리지 않도록 복제본 사용
            PanelSettings = Instantiate(_doc.panelSettings);
            _doc.panelSettings = PanelSettings;
            PanelSettings.scaleMode = PanelScaleMode.ConstantPixelSize;
            _root = _doc.rootVisualElement;
            _root.style.flexGrow = 1;
            U.SetFont(_root, Fonts.Body);
            _root.style.color = Pal.Text;
        }

        // ------------------------------------------------------------------
        // 화면 측정 / 레이아웃
        // ------------------------------------------------------------------
        private void MeasureDisplay(bool force)
        {
            var px = new Vector2Int(Screen.width, Screen.height);
            float dpr = WebBridge.DevicePixelRatio;
            var safe = WebBridge.SafeInsets(dpr);
            if (!force && px == _lastPx && Mathf.Approximately(dpr, _dpr) && safe == _lastSafe) return;
            _lastPx = px; _dpr = dpr; _lastSafe = safe;
            _safe = safe;
            if (PanelSettings != null) PanelSettings.scale = _dpr;
            float w = px.x / _dpr, h = px.y / _dpr;
            var kind = LayoutRules.Decide(w, h);
            bool changed = kind != _layout;
            _layout = kind;
            if (!force) Rebuild(changed);
        }

        private void Rebuild(bool layoutChanged)
        {
            switch (_screen)
            {
                case ScreenId.Lobby:
                    _lobby.Build(_layout, _safe, _cfg);
                    break;
                case ScreenId.Game:
                    if (_ctl != null)
                    {
                        _game.Build(_layout, _safe, _ctl.Model);
                        HookGameScreen();
                        _game.RestoreLog();
                        _game.SetLatency(_cfg.LatencyMs);
                    }
                    break;
                case ScreenId.Result:
                    _queue.Clear();
                    _result.Build(_layout, _safe, _lastResults, _lastMeId, _queue);
                    break;
            }
        }

        private void Switch(VisualElement screenRoot)
        {
            _root.Clear();
            _root.Add(screenRoot);
        }

        // ------------------------------------------------------------------
        // 화면 전환
        // ------------------------------------------------------------------
        private void ShowLobby()
        {
            StopGame();
            _screen = ScreenId.Lobby;
            _queue.Clear();
            Switch(_lobby.Root);
            _lobby.Build(_layout, _safe, _cfg);
        }

        private void StartGame()
        {
            StopGame();
            SaveConfig();
            ApplyReducedMotion();
            _screen = ScreenId.Game;
            _queue.Clear();
            _game.ClearLog();
            Switch(_game.Root);
            _ctl = new GameController(_cfg, _queue, () => _screen == ScreenId.Game ? _game : null, model =>
            {
                _game.Build(_layout, _safe, model);
                HookGameScreen();
                _game.SetLatency(_cfg.LatencyMs);
            });
            _ctl.OnEnded = results =>
            {
                _lastResults = results;
                _lastMeId = _ctl.Client.SessionId;
                if (results != null && results.Count > 0 && results[0].Id == _lastMeId && Fx != null) Fx.Confetti();
                ShowResult();
            };
            _ctl.OnFxBurst = (kind, panelPos, count) =>
            {
                if (Fx == null) return;
                var sp = PanelToScreen(panelPos);
                if (kind == "glow") Fx.Glow(sp);
                else Fx.Burst(sp, count);
            };
            _ctl.OnFxFocus = panelPos => { if (Fx != null) Fx.Focus(PanelToScreen(panelPos)); };
            // 첫 이벤트 전까지 빈 테이블
            _game.Build(_layout, _safe, new DisplayModel { Phase = Phases.Lobby });
            HookGameScreen();
            _game.SetLatency(_cfg.LatencyMs);
            _ctl.Start();
        }

        private void ShowResult()
        {
            _screen = ScreenId.Result;
            // 결과 집계는 큐가 비어 있는 상태에서 시작 (end 단계의 done 직후 실행되도록 다음 프레임)
            Switch(_result.Root);
            _result.Build(_layout, _safe, _lastResults, _lastMeId, _queue);
        }

        private void StopGame()
        {
            if (_ctl != null)
            {
                _ctl.Stop();
                _ctl = null;
            }
        }

        private void HookGameScreen()
        {
            _game.OnTake = () => { if (_ctl != null) _ctl.Take(_game.TakeButton != null ? _game.TakeButton.LastPressTime : -1); };
            _game.OnPass = () => { if (_ctl != null) _ctl.Pass(_game.PassButton != null ? _game.PassButton.LastPressTime : -1); };
            _game.OnMenuToggle = ToggleMenu;
            _game.OnPerfToggle = () => _perfVisible = !_perfVisible;
            _game.OnLatencyPick = SetLatency;
            _game.OnToLobby = ShowLobby;
            _game.OnReducedToggle = () =>
            {
                _cfg.MotionMode = Tw.Reduced ? 2 : 1;
                ApplyReducedMotion();
                SaveConfig();
                _game.ShowMenu(true, _cfg.LatencyMs, Tw.Reduced, Sfx.Muted);
            };
            _game.OnMuteToggle = () =>
            {
                _cfg.Muted = !_cfg.Muted;
                Sfx.Muted = _cfg.Muted;
                SaveConfig();
                _game.ShowMenu(true, _cfg.LatencyMs, Tw.Reduced, Sfx.Muted);
            };
        }

        private void ToggleMenu()
        {
            if (_screen != ScreenId.Game) return;
            _game.ShowMenu(!_game.MenuVisible, _cfg.LatencyMs, Tw.Reduced, Sfx.Muted);
        }

        private void SetLatency(int ms)
        {
            _cfg.LatencyMs = ms;
            if (_ctl != null) _ctl.SetLatency(ms);
            _game.SetLatency(ms);
            if (_game.MenuVisible) _game.ShowMenu(true, ms, Tw.Reduced, Sfx.Muted);
            _game.Toast("지연 " + ms + "ms (단방향)");
            SaveConfig();
        }

        private void ApplyReducedMotion()
        {
            bool reduced = _cfg.MotionMode == 1 || (_cfg.MotionMode == 0 && _osReduced);
            Tw.Reduced = reduced;
            if (Fx != null) Fx.SetReducedMotion(reduced);
        }

        /// <summary>UI Toolkit 패널 좌표 → 화면 픽셀 (ConstantPixelSize, scale = DPR).</summary>
        public Vector2 PanelToScreen(Vector2 panel)
        {
            return new Vector2(panel.x * _dpr, Screen.height - panel.y * _dpr);
        }

        // ------------------------------------------------------------------
        // 프레임
        // ------------------------------------------------------------------
        private void Update()
        {
            _perf.Tick(Time.unscaledDeltaTime);
            MeasureDisplay(false);
            if (_ctl != null) _ctl.Update();
            _queue.Update();
            HandleKeys();

            if (_screen == ScreenId.Game && _game != null)
            {
                _perfRefresh -= Time.unscaledDeltaTime;
                if (_perfRefresh <= 0)
                {
                    _perfRefresh = 0.25f;
                    string text = "";
                    if (_perfVisible)
                    {
                        text = Mathf.RoundToInt(_perf.AvgFps) + "fps · 1%↓ " + Mathf.RoundToInt(_perf.Low1Fps)
                            + " · 입력→반응 " + (_ctl != null ? Mathf.RoundToInt(_ctl.LastInputMs) + "ms(평균 " + Mathf.RoundToInt(_ctl.AvgInputMs) + ")" : "-")
                            + " · 큐 " + _queue.Count + " · 지연 " + _cfg.LatencyMs + "ms"
                            + (_ctl != null ? " · 롤백 " + _ctl.RollbackCount + " · 보정 " + _ctl.ReconcileCount : "")
                            + (WebBridge.LoadMs > 0 ? " · 로드 " + Mathf.RoundToInt(WebBridge.LoadMs) + "ms" : "")
                            + " · " + _layout + " " + Mathf.RoundToInt(Screen.width / _dpr) + "×" + Mathf.RoundToInt(Screen.height / _dpr) + "@" + _dpr.ToString("0.##");
                    }
                    _game.SetPerf(text, _perfVisible);
                }
            }
        }

        private void LateUpdate()
        {
            if (_ctl != null) _ctl.LateUpdate();
        }

        private void HandleKeys()
        {
            if (Keys.Down(KeyId.Perf)) _perfVisible = !_perfVisible;
            if (Keys.Down(KeyId.Mute))
            {
                _cfg.Muted = !_cfg.Muted;
                Sfx.Muted = _cfg.Muted;
                SaveConfig();
                if (_screen == ScreenId.Game) _game.Toast(_cfg.Muted ? "소리 끔" : "소리 켬");
            }
            switch (_screen)
            {
                case ScreenId.Lobby:
                    if (Keys.Down(KeyId.Confirm)) { _lobby.FlashStart(); StartGame(); }
                    break;
                case ScreenId.Game:
                    if (Keys.Down(KeyId.Menu)) ToggleMenu();
                    if (_game.MenuVisible) break;
                    if (Keys.Down(KeyId.Lat0)) SetLatency(0);
                    if (Keys.Down(KeyId.Lat100)) SetLatency(100);
                    if (Keys.Down(KeyId.Lat300)) SetLatency(300);
                    if (Keys.Down(KeyId.Take))
                    {
                        if (_game.TakeButton != null) _game.TakeButton.Flash();
                        if (_ctl != null) _ctl.Take(Time.realtimeSinceStartup);
                    }
                    else if (Keys.Down(KeyId.Pass))
                    {
                        if (_game.PassButton != null) _game.PassButton.Flash();
                        if (_ctl != null) _ctl.Pass(Time.realtimeSinceStartup);
                    }
                    break;
                case ScreenId.Result:
                    if (Keys.Down(KeyId.Confirm)) StartGame();
                    else if (Keys.Down(KeyId.Menu)) ShowLobby();
                    break;
            }
        }

        // ------------------------------------------------------------------
        // 설정 저장
        // ------------------------------------------------------------------
        private static GameConfig LoadConfig()
        {
            try
            {
                var json = PlayerPrefs.GetString(PrefKey, "");
                if (!string.IsNullOrEmpty(json))
                {
                    var c = JsonUtility.FromJson<GameConfig>(json);
                    if (c != null)
                    {
                        if (c.BotDifficulties == null || c.BotDifficulties.Length < 3) c.BotDifficulties = new[] { "medium", "hard", "expert" };
                        return c;
                    }
                }
            }
            catch (System.Exception e)
            {
                Debug.LogWarning("config load failed: " + e.Message);
            }
            return new GameConfig();
        }

        private void SaveConfig()
        {
            try
            {
                PlayerPrefs.SetString(PrefKey, JsonUtility.ToJson(_cfg));
                PlayerPrefs.Save();
            }
            catch (System.Exception e)
            {
                Debug.LogWarning("config save failed: " + e.Message);
            }
        }

        private void OnDestroy()
        {
            StopGame();
        }
    }
}
