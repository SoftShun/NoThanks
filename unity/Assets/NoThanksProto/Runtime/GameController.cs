using System;
using System.Collections.Generic;
using NoThanks.Core;
using NoThanks.Core.Client;
using NoThanks.Core.Net;
using UnityEngine;

namespace NoThanks.Proto
{
    /// <summary>로비에서 고른 설정. PlayerPrefs 에 JSON 으로 저장.</summary>
    [Serializable]
    public sealed class GameConfig
    {
        public int Bots = 3;
        public string[] BotDifficulties = { "medium", "hard", "expert" };
        public int RemovedCount = 9;
        public int InitialChips = 11;
        public int TurnLimit = 30;
        public bool Hidden;
        public int HiddenCount = 3;
        public bool ShowOpponentChips;
        public bool ShowScore = true;
        public int LatencyMs;
        public bool DebugReject;
        public bool FastBots;
        public int MotionMode; // 0=자동(OS 설정), 1=줄이기, 2=켜기
        public bool Muted;
        public bool HapticsOn = true;

        public GameConfig Clone() { return (GameConfig)MemberwiseClone(); }
    }

    /// <summary>
    /// 한 판의 진행을 담당: 목 서버/룸/클라이언트 생성, 서버 이벤트 → 애니메이션 큐 단계 변환,
    /// 낙관적 반응·롤백, 큐가 비었을 때 서버 상태와 화면 맞추기(reconcile).
    /// </summary>
    public sealed class GameController
    {
        public readonly GameConfig Config;
        public Scheduler Clock { get; private set; }
        public MockRoomServer Server { get; private set; }
        public LocalRoom Room { get; private set; }
        public GameClient Client { get; private set; }
        public DisplayModel Model { get; private set; }

        private readonly AnimQueue _queue;
        private readonly Func<GameScreen> _screen;
        private readonly Action<DisplayModel> _rebuild;
        private readonly double _clockBase;

        public Action<List<ResultSchema>> OnEnded;
        public Action<string, Vector2, int> OnFxBurst;   // (종류, 패널 좌표, 개수)
        public Action<Vector2> OnFxFocus;

        private float _turnDeadline, _turnTotal;
        private int _lastTickSec = -1;
        private float _inputAt = -1;
        private bool _awaitFrame;
        private int _predFrame = -1;
        public float LastInputMs { get; private set; }
        public float AvgInputMs { get; private set; }
        private int _inputSamples;
        public int ReconcileCount { get; private set; }
        public int RollbackCount { get; private set; }

        public GameController(GameConfig config, AnimQueue queue, Func<GameScreen> screen, Action<DisplayModel> rebuild)
        {
            Config = config;
            _queue = queue;
            _screen = screen;
            _rebuild = rebuild;
            _clockBase = Time.realtimeSinceStartupAsDouble * 1000.0;
            Model = new DisplayModel();
            _queue.OnIdle += Reconcile;
        }

        private string Me { get { return Client != null ? Client.SessionId : null; } }
        private GameScreen Screen { get { return _screen(); } }

        public void Start()
        {
            Clock = new Scheduler(0);
            Server = new MockRoomServer(Clock, new SystemRandom(), new MockServerOptions
            {
                BotDelayScale = Config.FastBots ? 0.35 : 1.0,
                DebugRejectRate = Config.DebugReject ? 0.2 : 0.0,
            });
            Room = new LocalRoom(Clock, Server, Config.LatencyMs);
            Client = new GameClient(Room, Clock);
            Client.OnServerEvent += HandleEvent;
            Client.OnPredicted += HandlePredicted;
            Client.OnRolledBack += HandleRollback;
            Client.OnToast += msg => { var s = Screen; if (s != null) s.Toast(msg, true); };

            Room.Join("나");
            Client.Send(ClientMessageTypes.UpdateSettings, new ClientMessage
            {
                Settings = new SettingsPatchDto
                {
                    RemovedCount = Config.RemovedCount,
                    InitialTokens = Config.InitialChips,
                    TurnTimeLimit = Config.TurnLimit,
                    GameMode = Config.Hidden ? "hidden" : "normal",
                    HiddenCardCount = Config.HiddenCount,
                    ShowOpponentTokens = Config.ShowOpponentChips,
                    ShowRealTimeScore = Config.ShowScore,
                },
            });
            for (int i = 0; i < Mathf.Clamp(Config.Bots, 0, GameRules.MaxBots); i++)
            {
                var d = Config.BotDifficulties != null && i < Config.BotDifficulties.Length ? Config.BotDifficulties[i] : "medium";
                Client.Send(ClientMessageTypes.AddBot, new ClientMessage { Difficulty = d });
            }
            Client.Send(ClientMessageTypes.Start, new ClientMessage());
        }

        public void Stop()
        {
            _queue.OnIdle -= Reconcile;
            if (Room != null) Room.Leave();
        }

        public void SetLatency(int ms)
        {
            Config.LatencyMs = ms;
            if (Room != null) Room.LatencyMs = ms;
        }

        // ------------------------------------------------------------------
        // 프레임 갱신
        // ------------------------------------------------------------------
        public void Update()
        {
            MeasureInput();
            if (Clock != null) Clock.AdvanceTo(Time.realtimeSinceStartupAsDouble * 1000.0 - _clockBase);
            var s = Screen;
            if (s == null || Client == null) return;

            var me = Model.Me;
            bool myTurn = Model.Phase == Phases.Playing && me != null && Model.TurnId == me.Id;
            bool canAct = myTurn && Client.CanAct && _queue.Idle && Model.Card != 0 && !Model.RevealPending;
            bool canPass = canAct && me.Chips > 0;

            string takeSub = "", passSub = "";
            if (myTurn && me != null && Model.Card != 0)
            {
                if (Model.Card == -1) takeSub = "+" + Model.Pile + "칩 · 숫자 비공개";
                else
                {
                    var after = new List<int>(me.Cards) { Model.Card };
                    int delta = Scoring.Score(after, me.Chips + Model.Pile) - Scoring.Score(me.Cards, me.Chips);
                    takeSub = "+" + Model.Pile + "칩 · 점수 " + (delta > 0 ? "+" : "") + delta;
                }
                passSub = me.Chips > 0 ? "칩 1개 지불 (남은 " + (me.Chips - 1) + ")" : "칩이 없어 패스 불가";
            }
            s.SetButtons(canAct, canPass, takeSub, passSub);
            bool revealing = Model.RevealPending || (Client.Pending != null && Client.Pending.Kind == PendingKind.TakeHidden);
            s.SetHint(revealing ? "숨김 카드 공개 중…" : myTurn && canAct ? (Model.Pile > 0 ? "카드 위 칩 " + Model.Pile + "개" : "아직 칩이 없습니다") : "");

            // 턴 타이머
            if (myTurn && _turnDeadline > 0 && _turnTotal > 0)
            {
                float remain = _turnDeadline - Time.realtimeSinceStartup;
                bool urgent = remain <= 5f;
                s.SetTimer(remain / _turnTotal, true, urgent);
                int sec = Mathf.CeilToInt(remain);
                if (urgent && sec != _lastTickSec && sec > 0 && canAct)
                {
                    _lastTickSec = sec;
                    Sfx.Play(SfxId.Tick, 1f + (5 - sec) * 0.05f);
                }
            }
            else s.SetTimer(0, false, false);
        }

        /// <summary>LateUpdate: 입력 후 첫 연출 프레임까지의 시간 측정.</summary>
        public void LateUpdate()
        {
            // 예측 연출이 시작된 프레임 번호를 기록 → 다음 프레임 시작(=그 프레임이 화면에 나간 뒤)에 측정
            if (_awaitFrame && _inputAt > 0 && _predFrame < 0) _predFrame = Time.frameCount;
        }

        private void MeasureInput()
        {
            if (_predFrame >= 0 && Time.frameCount > _predFrame && _inputAt > 0)
            {
                LastInputMs = (Time.realtimeSinceStartup - _inputAt) * 1000f;
                _inputSamples++;
                AvgInputMs += (LastInputMs - AvgInputMs) / _inputSamples;
                _inputAt = -1;
                _predFrame = -1;
                _awaitFrame = false;
            }
        }

        // ------------------------------------------------------------------
        // 입력
        // ------------------------------------------------------------------
        public void Take(float pressedAt)
        {
            var s = Screen;
            if (Client == null || s == null) return;
            if (!(Client.CanAct && _queue.Idle))
            {
                if (Model.TurnId == Me) s.ShakeButton(s.TakeButton);
                return;
            }
            _inputAt = pressedAt > 0 ? pressedAt : Time.realtimeSinceStartup;
            if (Client.RequestTake() == null) { s.ShakeButton(s.TakeButton); _inputAt = -1; }
        }

        public void Pass(float pressedAt)
        {
            var s = Screen;
            if (Client == null || s == null) return;
            var me = Model.Me;
            if (Client.CanAct && _queue.Idle && me != null && me.Chips <= 0)
            {
                s.ShakeButton(s.PassButton);
                s.Toast("칩이 없어 패스할 수 없어요. 가져가야 합니다.", true);
                Sfx.Play(SfxId.Error);
                Haptics.Error();
                return;
            }
            if (!(Client.CanPass && _queue.Idle))
            {
                if (Model.TurnId == Me) s.ShakeButton(s.PassButton);
                return;
            }
            _inputAt = pressedAt > 0 ? pressedAt : Time.realtimeSinceStartup;
            if (Client.RequestPass() == null) { s.ShakeButton(s.PassButton); _inputAt = -1; }
        }

        // ------------------------------------------------------------------
        // 낙관적 반응 / 롤백
        // ------------------------------------------------------------------
        private void HandlePredicted(PendingAction p)
        {
            _awaitFrame = true;
            var meId = Me;
            Haptics.Medium();
            switch (p.Kind)
            {
                case PendingKind.Pass:
                    _queue.Enqueue("pred-pass", done =>
                    {
                        var s = Screen; var me = Model.Me;
                        if (s == null || me == null) { done(); return; }
                        me.Chips = p.MyChipsAfter;
                        s.Seat(meId)?.SetData(me.Chips, me.Cards, true);
                        s.AnimChip(s.SeatChipAnchor(meId), s.PileAnchor, 0f, () =>
                        {
                            Model.Pile = p.PileChips;
                            s.Render(Model, false);
                        }, done);
                    });
                    break;
                case PendingKind.Take:
                    _queue.Enqueue("pred-take", done =>
                    {
                        var s = Screen; var me = Model.Me;
                        if (s == null || me == null) { done(); return; }
                        Model.Card = 0;
                        s.AnimTake(meId, p.Card, p.PileChips, () =>
                        {
                            if (!me.Cards.Contains(p.Card)) me.Cards.Add(p.Card);
                            me.Chips = p.MyChipsAfter;
                            Model.Pile = 0;
                            s.Render(Model, false);
                        }, done);
                        if (OnFxBurst != null) OnFxBurst("take", s.SeatHandAnchor(meId), 14);
                    });
                    break;
                case PendingKind.TakeHidden:
                    _queue.EnqueueInstant("pred-hidden", () =>
                    {
                        var s = Screen;
                        if (s != null) { s.PulseCard(); s.SetHint("공개 중…"); }
                    });
                    break;
            }
        }

        private void HandleRollback(PendingAction p, string reason)
        {
            RollbackCount++;
            var meId = Me;
            _queue.Enqueue("rollback", done =>
            {
                var s = Screen; var me = Model.Me;
                Sfx.Play(SfxId.Error);
                Haptics.Error();
                if (s == null || me == null) { done(); return; }
                s.Toast("서버가 거절했어요 · " + reason, true);
                s.Seat(meId)?.Shake();
                switch (p.Kind)
                {
                    case PendingKind.Take:
                        s.AnimReturnCard(meId, p.Card, p.PileChips, () =>
                        {
                            me.Cards.Remove(p.Card);
                            me.Chips = p.MyChipsAfter - p.PileChips;
                            Model.Card = p.Card;
                            Model.Pile = p.PileChips;
                            s.Render(Model, false);
                        }, done);
                        break;
                    case PendingKind.Pass:
                        s.AnimChip(s.PileAnchor, s.SeatChipAnchor(meId), 0f, () =>
                        {
                            Model.Pile = p.PileChips - 1;
                            me.Chips = p.MyChipsAfter + 1;
                            s.Render(Model, false);
                        }, done);
                        break;
                    default:
                        done();
                        break;
                }
            });
        }

        // ------------------------------------------------------------------
        // 서버 이벤트 → 큐
        // ------------------------------------------------------------------
        private string NameOf(string id)
        {
            var seat = Model.Seat(id);
            return seat != null ? seat.Name : "?";
        }

        private void Log(string line)
        {
            var s = Screen;
            if (s != null) s.AddLog(line);
        }

        private void HandleEvent(ServerEvent ev, bool predicted)
        {
            switch (ev.Type)
            {
                case EventTypes.GameStarted:
                    _queue.Enqueue("start", done =>
                    {
                        Model = BuildInitialModel(ev);
                        _rebuild(Model);
                        Log("게임 시작 · " + Model.Seats.Count + "명 · 제거 " + Model.Removed + "장");
                        done();
                    });
                    break;

                case EventTypes.CardRevealed:
                    _queue.Enqueue("reveal", done =>
                    {
                        var s = Screen;
                        Model.Deck = ev.DeckCount;
                        Model.Pile = ev.PileChips;
                        if (s == null) { Model.Card = ev.Card; done(); return; }
                        s.Render(Model, false);
                        s.AnimReveal(ev.Card, () =>
                        {
                            Model.Card = ev.Card;
                            if (OnFxBurst != null) OnFxBurst("glow", s.CardCenter, 0);
                        }, done);
                    });
                    break;

                case EventTypes.ChipPlaced:
                    if (predicted)
                    {
                        _queue.EnqueueInstant("sync-pass", () =>
                        {
                            Model.Pile = ev.PileChips;
                            var me = Model.Me;
                            if (me != null && ev.PlayerChips >= 0) me.Chips = ev.PlayerChips;
                            Log("나 · 패스 (카드 위 칩 " + ev.PileChips + ")");
                        });
                        break;
                    }
                    _queue.Enqueue("chip", done =>
                    {
                        var s = Screen;
                        var seat = Model.Seat(ev.PlayerId);
                        Log(NameOf(ev.PlayerId) + (ev.Forced ? " · 시간 초과 → 자동 패스" : " · 패스") + " (카드 위 칩 " + ev.PileChips + ")");
                        if (s == null || seat == null) { Model.Pile = ev.PileChips; done(); return; }
                        if (seat.Chips >= 0 && ev.PlayerChips >= 0) seat.Chips = ev.PlayerChips;
                        s.Seat(ev.PlayerId)?.SetData(seat.Chips, seat.Cards, Model.ShowScore || seat.IsMe);
                        s.AnimChip(s.SeatChipAnchor(ev.PlayerId), s.PileAnchor, 0f, () =>
                        {
                            Model.Pile = ev.PileChips;
                            s.Render(Model, false);
                        }, done);
                    });
                    break;

                case EventTypes.CardTaken:
                    if (predicted)
                    {
                        _queue.EnqueueInstant("sync-take", () =>
                        {
                            var me = Model.Me;
                            if (me != null)
                            {
                                if (!me.Cards.Contains(ev.Card)) me.Cards.Add(ev.Card);
                                if (ev.PlayerChips >= 0) me.Chips = ev.PlayerChips;
                            }
                            Model.Card = 0; Model.Pile = 0;
                            Log("나 · " + ev.Card + " 가져감 (+" + ev.Chips + "칩)");
                        });
                        break;
                    }
                    _queue.Enqueue("take", done =>
                    {
                        var s = Screen;
                        var seat = Model.Seat(ev.PlayerId);
                        Log(NameOf(ev.PlayerId) + " · " + ev.Card + " 가져감 (+" + ev.Chips + "칩)" + (ev.Forced ? " · 강제" : ""));
                        Model.Card = 0;
                        if (s == null || seat == null) { Model.Pile = 0; done(); return; }
                        if (seat.IsMe) Haptics.Medium();
                        s.AnimTake(ev.PlayerId, ev.Card, ev.Chips, () =>
                        {
                            if (!seat.Cards.Contains(ev.Card)) seat.Cards.Add(ev.Card);
                            if (seat.Chips >= 0 && ev.PlayerChips >= 0) seat.Chips = ev.PlayerChips;
                            Model.Pile = 0;
                            s.Render(Model, false);
                        }, done);
                        if (OnFxBurst != null) OnFxBurst("take", s.SeatHandAnchor(ev.PlayerId), Mathf.Clamp(ev.Chips + 4, 4, 18));
                    });
                    break;

                case EventTypes.HiddenRevealed:
                    _queue.Enqueue("hidden", done =>
                    {
                        var s = Screen;
                        Model.RevealPending = true;
                        Log(NameOf(ev.PlayerId) + " · 숨김 카드 공개 → " + ev.Card);
                        if (s == null) { Model.Card = ev.Card; done(); return; }
                        s.UpdateTurnLabel(Model);
                        s.AnimHiddenReveal(ev.Card, () => { Model.Card = ev.Card; done(); });
                        if (OnFxBurst != null) OnFxBurst("glow", s.CardCenter, 0);
                    });
                    break;

                case EventTypes.TurnChanged:
                    _queue.Enqueue("turn", done =>
                    {
                        var s = Screen;
                        Model.TurnId = ev.PlayerId;
                        Model.RevealPending = false;
                        bool mine = ev.PlayerId == Me;
                        _turnTotal = (float)(ev.TurnMs / 1000.0);
                        // 서버 기준 남은 시간에서 단방향 지연만큼 빼서 로컬 마감 시각 추정
                        _turnDeadline = ev.TurnMs > 0 ? Time.realtimeSinceStartup + _turnTotal - Config.LatencyMs / 1000f : 0;
                        _lastTickSec = -1;
                        if (mine)
                        {
                            Sfx.Play(SfxId.MyTurn, ev.SamePlayer ? 1.12f : 1f, ev.SamePlayer ? 0.6f : 1f);
                            Haptics.Light();
                        }
                        if (s == null) { done(); return; }
                        if (OnFxFocus != null) OnFxFocus(s.SeatCenter(ev.PlayerId));
                        s.AnimTurn(Model, mine, done);
                    });
                    break;

                case EventTypes.GameEnded:
                    _queue.Enqueue("end", done =>
                    {
                        var s = Screen;
                        Model.Phase = Phases.Ended;
                        _turnDeadline = 0;
                        Log("게임 종료");
                        var results = ev.Results ?? new List<ResultSchema>();
                        if (s == null) { if (OnEnded != null) OnEnded(results); done(); return; }
                        s.AnimEndBanner(() =>
                        {
                            if (OnEnded != null) OnEnded(results);
                            done();
                        });
                    }, 5f);
                    break;

                case EventTypes.Resync:
                    _queue.EnqueueInstant("resync", Reconcile);
                    break;
            }
        }

        private DisplayModel BuildInitialModel(ServerEvent ev)
        {
            var lobby = Client.State;
            var m = new DisplayModel { Phase = Phases.Playing };
            var st = lobby.Settings;
            m.Removed = st.RemovedCount;
            m.ShowScore = st.ShowRealTimeScore;
            m.ShowOpponentChips = st.ShowOpponentTokens;
            m.TurnLimitSec = st.TurnTimeLimit;
            m.HiddenTotal = st.GameMode == "hidden" ? st.HiddenCardCount : 0;
            m.Deck = ev.DeckCount;
            m.Card = 0;
            var order = ev.Order ?? new List<string>();
            foreach (var id in order)
            {
                var p = lobby.FindPlayer(id);
                bool isMe = id == Me;
                m.Seats.Add(new SeatModel
                {
                    Id = id,
                    Name = isMe ? "나" : (p != null ? p.Nickname : id),
                    Sub = p != null && p.IsBot ? "AI · 난이도 " + DisplayModel.DifficultyKo(p.Difficulty) : "당신",
                    IsBot = p != null && p.IsBot,
                    IsMe = isMe,
                    Chips = isMe || st.ShowOpponentTokens ? st.InitialTokens : -1,
                });
            }
            return m;
        }

        /// <summary>큐가 비면 서버 상태와 화면을 맞춘다. 미확정 예측이 있으면 기다린다.</summary>
        private void Reconcile()
        {
            if (Client == null || Client.Pending != null) return;
            var st = Client.State;
            if (st == null || st.Phase != Phases.Playing || Model.Phase != Phases.Playing) return;
            var auth = DisplayModel.From(st, Me);
            if (auth.Signature() == Model.Signature()) return;
            ReconcileCount++;
            Model = auth;
            var s = Screen;
            if (s != null) s.Render(Model, false);
        }
    }
}
