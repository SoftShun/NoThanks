using System;
using System.Collections.Generic;
using LitMotion;
using UnityEngine;
using UnityEngine.UIElements;

namespace NoThanks.Proto
{
    /// <summary>레이아웃별 치수 (논리 px). ux-spec.md 의 화면별 배치도 표와 동일.</summary>
    public struct LayoutSpec
    {
        public float CardW, CardH;        // 중앙 카드
        public float SeatMiniW, SeatMiniH; // 상대 손패 카드
        public float MyMiniW, MyMiniH;     // 내 손패 카드
        public float NameSize, MyNameSize;
        public float ButtonH, ButtonFont;
        public float ChipSize;
        public float TurnFont;
        public float SidePanelW;

        public static LayoutSpec For(LayoutKind k)
        {
            switch (k)
            {
                case LayoutKind.LandscapeCompact:
                    return new LayoutSpec { CardW = 100, CardH = 140, SeatMiniW = 17, SeatMiniH = 24, MyMiniW = 26, MyMiniH = 36, NameSize = 12, MyNameSize = 13, ButtonH = 58, ButtonFont = 18, ChipSize = 20, TurnFont = 14, SidePanelW = 0 };
                case LayoutKind.Desktop:
                    return new LayoutSpec { CardW = 176, CardH = 246, SeatMiniW = 24, SeatMiniH = 34, MyMiniW = 42, MyMiniH = 60, NameSize = 15, MyNameSize = 17, ButtonH = 64, ButtonFont = 22, ChipSize = 30, TurnFont = 18, SidePanelW = 320 };
                case LayoutKind.DesktopWide:
                    return new LayoutSpec { CardW = 216, CardH = 302, SeatMiniW = 28, SeatMiniH = 40, MyMiniW = 50, MyMiniH = 70, NameSize = 17, MyNameSize = 19, ButtonH = 72, ButtonFont = 24, ChipSize = 36, TurnFont = 20, SidePanelW = 380 };
                default:
                    return new LayoutSpec { CardW = 140, CardH = 196, SeatMiniW = 16, SeatMiniH = 23, MyMiniW = 30, MyMiniH = 42, NameSize = 13, MyNameSize = 15, ButtonH = 60, ButtonFont = 20, ChipSize = 26, TurnFont = 15, SidePanelW = 0 };
            }
        }
    }

    /// <summary>
    /// 게임 화면. 레이아웃마다 트리를 따로 만든다(늘리고 줄이기 X).
    /// 연출 메서드는 모두 done 콜백을 받아 애니메이션 큐 단계로 쓰인다.
    /// </summary>
    public sealed class GameScreen
    {
        public readonly VisualElement Root;
        public LayoutKind Kind { get; private set; }
        public LayoutSpec Spec { get; private set; }

        private readonly Dictionary<string, SeatView> _seats = new Dictionary<string, SeatView>();
        private CardView _card;
        private VisualElement _cardHolder, _deck, _glow;
        private Label _deckLabel, _turnLabel, _infoLabel, _latencyBadge, _toast, _perf, _hint;
        private VisualElement _timerTrack, _timerFill, _logList, _scoreList, _menuOverlay;
        private ChipPile _pile;
        private VisualElement _fx;
        public ActionButton TakeButton { get; private set; }
        public ActionButton PassButton { get; private set; }

        public Action OnTake, OnPass, OnMenuToggle, OnPerfToggle;
        public Action<int> OnLatencyPick;
        public Action OnToLobby, OnReducedToggle, OnMuteToggle;

        private MotionHandle _toastMotion;
        private readonly List<string> _log = new List<string>();

        public GameScreen()
        {
            Root = U.El("game-screen").Fill();
        }

        // ------------------------------------------------------------------
        // 빌드
        // ------------------------------------------------------------------
        public void Build(LayoutKind kind, Vector4 safe, DisplayModel model)
        {
            Kind = kind;
            Spec = LayoutSpec.For(kind);
            Root.Clear();
            _seats.Clear();
            Root.Pad4(safe.x, safe.y, safe.z, safe.w);

            switch (kind)
            {
                case LayoutKind.LandscapeCompact: BuildLandscape(model); break;
                case LayoutKind.Desktop:
                case LayoutKind.DesktopWide: BuildDesktop(model); break;
                default: BuildPortrait(model); break;
            }

            // 화면 가장자리 비네트 (UI 위, 클릭 통과)
            var vig = U.El().Fill().Img(ProceduralArt.Vignette).Ignore();
            vig.style.opacity = 0.55f;
            Root.Add(vig);

            _fx = U.El("fx").Fill().Ignore(); // 좌표 변환은 ToFx() 가 worldBound 기준으로 처리
            Root.Add(_fx);

            _toast = U.Text("", 15, Pal.Ink, false, true).Abs(null, 64);
            _toast.style.alignSelf = Align.Center;
            _toast.style.left = new Length(50, LengthUnit.Percent);
            _toast.Bg(Pal.BrassLight).Radius(20).Pad(10, 18);
            _toast.style.opacity = 0;
            _toast.style.translate = new Translate(new Length(-50, LengthUnit.Percent), new Length(0, LengthUnit.Pixel));
            Root.Add(_toast);

            _perf = U.Text("", 11, Pal.A(Pal.Text, 0.85f)).Abs(8, kind == LayoutKind.LandscapeCompact ? 4 : 52);
            _perf.Bg(Pal.A(Pal.Ink, 0.7f)).Radius(6).Pad(4, 8);
            U.Show(_perf, false);
            Root.Add(_perf);

            BuildMenuOverlay();
            Render(model, false);
        }

        private VisualElement TopBar(float h, bool large)
        {
            var bar = U.El("topbar").Row().H(h).NoShrink();
            bar.style.alignItems = Align.Center;
            bar.Pad(0, 12);
            var brand = U.Text(Brand.Name, large ? 22 : 16, Pal.BrassLight, true);
            bar.Add(brand);
            if (large)
            {
                var tag = U.Text("  " + Brand.Tagline, 13, Pal.Muted);
                bar.Add(tag);
            }
            bar.Add(U.El().Grow().Ignore());
            _infoLabel = U.Text("", large ? 14 : 12, Pal.Muted);
            _infoLabel.style.marginRight = 10;
            bar.Add(_infoLabel);
            bar.Add(LatencyBadge());
            bar.Add(MenuButton());
            return bar;
        }

        private VisualElement LatencyBadge()
        {
            var b = U.El().Row().Center().H(44).Pad(0, 10).Radius(22);
            b.style.minWidth = 44;
            b.style.marginRight = 6;
            b.Border(1, Pal.A(Pal.Brass, 0.3f));
            _latencyBadge = U.Text("0ms", 12, Pal.BrassLight);
            b.Add(_latencyBadge);
            b.AddManipulator(new Clickable(() => { if (OnPerfToggle != null) OnPerfToggle(); }));
            b.tooltip = "지연 시뮬레이션 / 성능 표시 (F3)";
            return b;
        }

        private VisualElement MenuButton()
        {
            var b = U.El().Size(44, 44).Center().Radius(22);
            b.Border(1, Pal.A(Pal.Brass, 0.3f));
            var l = U.Text("≡", 20, Pal.BrassLight);
            b.Add(l);
            b.AddManipulator(new Clickable(() => { Sfx.Play(SfxId.Tap); if (OnMenuToggle != null) OnMenuToggle(); }));
            b.RegisterCallback<PointerEnterEvent>(e => b.Bg(Pal.A(Pal.Brass, 0.15f)));
            b.RegisterCallback<PointerLeaveEvent>(e => b.Bg(Pal.Clear));
            b.tooltip = "메뉴 (Esc)";
            return b;
        }

        private VisualElement Stage(bool horizontalExtras)
        {
            var stage = U.El("stage").Col().Center().Grow();
            _turnLabel = U.Text("", Spec.TurnFont, Pal.Text, false, true);
            _turnLabel.style.unityTextAlign = TextAnchor.MiddleCenter;
            _turnLabel.style.marginBottom = 6;
            stage.Add(_turnLabel);

            _timerTrack = U.El().H(4).W(Spec.CardW * 1.6f).Radius(2).Bg(Pal.A(Pal.Ivory, 0.08f)).Ignore();
            _timerTrack.style.marginBottom = 12;
            _timerFill = U.El().HPct(100).WPct(100).Radius(2).Bg(Pal.Brass).Ignore();
            _timerTrack.Add(_timerFill);
            stage.Add(_timerTrack);

            var row = U.El().Row().Center().Ignore();
            // 덱
            _deck = U.El().Col().Center().Ignore();
            var deckCard = new CardView(Spec.CardW * 0.42f, Spec.CardH * 0.42f, false);
            deckCard.SetValue(-1);
            _deck.Add(deckCard);
            _deckLabel = U.Text("", Mathf.Max(11, Spec.TurnFont * 0.8f), Pal.Muted);
            _deckLabel.style.marginTop = 6;
            _deck.Add(_deckLabel);
            _deck.style.marginRight = Spec.CardW * 0.18f;
            row.Add(_deck);

            // 중앙 카드 + 글로우
            _cardHolder = U.El().Size(Spec.CardW, Spec.CardH).Ignore();
            _glow = U.El().Abs(-Spec.CardW * 0.5f, -Spec.CardH * 0.35f).Size(Spec.CardW * 2f, Spec.CardH * 1.7f).Img(ProceduralArt.Soft).Ignore();
            _glow.style.unityBackgroundImageTintColor = Pal.A(Pal.BrassLight, 0.22f);
            _cardHolder.Add(_glow);
            _card = new CardView(Spec.CardW, Spec.CardH);
            _cardHolder.Add(_card);
            row.Add(_cardHolder);

            // 칩 더미
            _pile = new ChipPile(Spec.ChipSize, Mathf.Max(12, Spec.TurnFont));
            _pile.style.marginLeft = Spec.CardW * 0.18f;
            _pile.style.minWidth = Spec.ChipSize * 2.4f;
            row.Add(_pile);
            stage.Add(row);

            _hint = U.Text("", Mathf.Max(11, Spec.TurnFont * 0.82f), Pal.Muted);
            _hint.style.marginTop = 10;
            _hint.style.unityTextAlign = TextAnchor.MiddleCenter;
            stage.Add(_hint);
            return stage;
        }

        private void MakeButtons(string takeKey, string passKey)
        {
            TakeButton = new ActionButton("가져가기", "", Pal.Brass, Pal.Ink, Spec.ButtonH, Spec.ButtonFont, takeKey);
            PassButton = new ActionButton("패스", "칩 1개 지불", Pal.A(Pal.Ivory, 0.1f), Pal.Text, Spec.ButtonH, Spec.ButtonFont, passKey);
            TakeButton.OnClick = () => { if (OnTake != null) OnTake(); };
            PassButton.OnClick = () => { if (OnPass != null) OnPass(); };
            TakeButton.tooltip = "카드와 칩을 가져옵니다 (Enter / T)";
            PassButton.tooltip = "칩 1개를 내고 넘깁니다 (Space / P)";
        }

        private SeatView MakeSeat(SeatModel s, bool wrap)
        {
            bool me = s.IsMe;
            var v = new SeatView(s.Id, s.Name, s.Sub, me,
                me ? Spec.MyMiniW : Spec.SeatMiniW, me ? Spec.MyMiniH : Spec.SeatMiniH,
                me ? Spec.MyNameSize : Spec.NameSize, wrap);
            _seats[s.Id] = v;
            if (!me)
            {
                v.RegisterCallback<PointerEnterEvent>(e => { v.style.borderTopColor = Pal.A(Pal.Brass, 0.5f); });
                v.RegisterCallback<PointerLeaveEvent>(e => { v.style.borderTopColor = Pal.A(Pal.Brass, 0.18f); });
            }
            return v;
        }

        // 세로 모바일 390×844
        private void BuildPortrait(DisplayModel m)
        {
            var col = U.El().Col().Grow();
            col.Add(TopBar(48, false));

            var opp = U.El("opponents").Row().NoShrink();
            opp.style.paddingLeft = 10; opp.style.paddingRight = 10;
            opp.style.minHeight = 104;
            int n = 0;
            foreach (var s in m.Seats)
            {
                if (s.IsMe) continue;
                var v = MakeSeat(s, true).Grow();
                v.style.flexBasis = 0;
                v.style.marginRight = 8;
                v.style.maxHeight = 150;
                opp.Add(v);
                n++;
            }
            if (opp.childCount > 0) opp[opp.childCount - 1].style.marginRight = 0;
            col.Add(opp);

            col.Add(Stage(false));

            var me = m.Me;
            if (me != null)
            {
                var mv = MakeSeat(me, true);
                mv.Mar(0, 10, 8, 10);
                mv.style.maxHeight = 170;
                col.Add(mv);
            }

            MakeButtons(null, null);
            var bar = U.El("actions").Row().NoShrink();
            bar.Pad4(0, 10, 10, 10);
            PassButton.Grow(); PassButton.style.flexBasis = 0; PassButton.style.marginRight = 10;
            TakeButton.Grow(); TakeButton.style.flexBasis = 0;
            bar.Add(PassButton);
            bar.Add(TakeButton);
            col.Add(bar);
            Root.Add(col);
        }

        // 가로 모바일 844×390
        private void BuildLandscape(DisplayModel m)
        {
            var row = U.El().Row().Grow();

            var left = U.El("left").Col().W(232).NoShrink();
            left.Pad4(6, 0, 6, 8);
            var mini = U.El().Row().H(30).NoShrink();
            mini.style.alignItems = Align.Center;
            mini.Add(U.Text(Brand.Name, 14, Pal.BrassLight, true));
            mini.Add(U.El().Grow().Ignore());
            _infoLabel = U.Text("", 11, Pal.Muted);
            mini.Add(_infoLabel);
            left.Add(mini);
            foreach (var s in m.Seats)
            {
                if (s.IsMe) continue;
                var v = MakeSeat(s, true).Grow();
                v.style.flexBasis = 0;
                v.style.marginBottom = 6;
                v.Pad(6, 8);
                left.Add(v);
            }
            row.Add(left);

            var center = U.El("center").Col().Grow();
            center.Add(Stage(true));
            var me = m.Me;
            if (me != null)
            {
                var mv = MakeSeat(me, false);
                mv.Mar(0, 8, 6, 8);
                mv.Pad(6, 10);
                center.Add(mv);
            }
            row.Add(center);

            var right = U.El("right").Col().W(176).NoShrink();
            right.Pad4(6, 8, 8, 0);
            var tools = U.El().Row().NoShrink();
            tools.style.justifyContent = Justify.FlexEnd;
            tools.Add(LatencyBadge());
            tools.Add(MenuButton());
            right.Add(tools);
            right.Add(U.El().Grow().Ignore());
            MakeButtons(null, null);
            TakeButton.style.marginBottom = 10;
            TakeButton.style.height = Spec.ButtonH + 8;
            right.Add(TakeButton);
            right.Add(PassButton);
            row.Add(right);
            Root.Add(row);
        }

        // 데스크톱 1440×900 / 1920×1080
        private void BuildDesktop(DisplayModel m)
        {
            bool wide = Kind == LayoutKind.DesktopWide;
            var col = U.El().Col().Grow();
            col.Add(TopBar(wide ? 64 : 56, true));

            var main = U.El().Row().Grow();
            var table = U.El("table").Col().Grow();
            table.Pad(8, 24);

            var opp = U.El("opponents").Row().NoShrink();
            opp.style.justifyContent = Justify.Center;
            opp.style.alignItems = Align.FlexStart;
            var others = m.Seats.FindAll(s => !s.IsMe);
            for (int i = 0; i < others.Count; i++)
            {
                var v = MakeSeat(others[i], true);
                v.W(wide ? 250 : 212);
                v.style.minHeight = wide ? 140 : 120;
                float arc = Mathf.Abs(i - (others.Count - 1) * 0.5f) * (wide ? 26 : 20);
                v.Mar(arc, 10, 0, 10);
                opp.Add(v);
            }
            table.Add(opp);
            table.Add(Stage(true));

            var bottom = U.El().Row().NoShrink();
            bottom.style.alignItems = Align.FlexEnd;
            bottom.style.justifyContent = Justify.Center;
            var me = m.Me;
            if (me != null)
            {
                var mv = MakeSeat(me, true).Grow();
                mv.style.maxWidth = wide ? 900 : 700;
                mv.style.minHeight = Spec.MyMiniH + 70;
                mv.style.marginRight = 16;
                bottom.Add(mv);
            }
            MakeButtons("Enter", "Space");
            var acts = U.El().Col().W(wide ? 230 : 200).NoShrink();
            TakeButton.style.marginBottom = 10;
            acts.Add(TakeButton);
            acts.Add(PassButton);
            bottom.Add(acts);
            table.Add(bottom);
            main.Add(table);

            // 오른쪽 패널: 점수판 / 기록 / 단축키
            var side = U.El("side").Col().W(Spec.SidePanelW).NoShrink();
            side.Bg(Pal.A(Pal.Ink, 0.55f)).Pad(16, 16);
            side.style.borderLeftWidth = 1; side.style.borderLeftColor = Pal.A(Pal.Brass, 0.15f);
            side.Add(SectionTitle("점수판"));
            _scoreList = U.El().Col().NoShrink();
            _scoreList.style.marginBottom = 16;
            side.Add(_scoreList);
            side.Add(SectionTitle("기록"));
            var scroll = new ScrollView(ScrollViewMode.Vertical);
            scroll.Grow();
            _logList = scroll.contentContainer;
            side.Add(scroll);
            side.Add(SectionTitle("단축키"));
            var keys = U.Text("Enter / T  가져가기\nSpace / P  패스\nEsc  메뉴    M  소리\nF3  성능 표시    1·2·3  지연 0·100·300ms", 12, Pal.Muted);
            keys.style.whiteSpace = WhiteSpace.Normal;
            side.Add(keys);
            main.Add(side);
            col.Add(main);
            Root.Add(col);
        }

        private static Label SectionTitle(string t)
        {
            var l = U.Text(t, 13, Pal.Brass, false, true);
            l.style.marginBottom = 8;
            l.style.letterSpacing = 1;
            return l;
        }

        private void BuildMenuOverlay()
        {
            _menuOverlay = U.El("menu").Fill().Bg(Pal.A(Pal.Ink, 0.82f)).Center();
            var panel = U.El().Col().W(Mathf.Min(360, 320)).Bg(Pal.PanelHi).Radius(18).Pad(20, 20);
            panel.Border(1, Pal.A(Pal.Brass, 0.3f));
            panel.Add(U.Text("메뉴", 20, Pal.BrassLight, true));
            panel.Add(U.El().H(12));
            var resume = new ActionButton("계속하기", null, Pal.Brass, Pal.Ink, 52, 17);
            resume.OnClick = () => { if (OnMenuToggle != null) OnMenuToggle(); };
            resume.style.marginBottom = 10;
            panel.Add(resume);
            var lat = U.El().Row();
            lat.style.flexWrap = Wrap.Wrap;
            lat.Add(U.Text("지연  ", 14, Pal.Muted).Mar(12, 0, 0, 0));
            foreach (var ms in new[] { 0, 100, 300 })
            {
                var p = new Pill(ms + "ms");
                int v = ms;
                p.OnClick = () => { if (OnLatencyPick != null) OnLatencyPick(v); };
                p.name = "lat-" + ms;
                lat.Add(p);
            }
            panel.Add(lat);
            var toggles = U.El().Row();
            toggles.style.flexWrap = Wrap.Wrap;
            var reduce = new Pill("모션 줄이기") { name = "reduce" };
            reduce.OnClick = () => { if (OnReducedToggle != null) OnReducedToggle(); };
            var mute = new Pill("소리 끄기") { name = "mute" };
            mute.OnClick = () => { if (OnMuteToggle != null) OnMuteToggle(); };
            toggles.Add(reduce); toggles.Add(mute);
            panel.Add(toggles);
            var lobby = new ActionButton("로비로 나가기", null, Pal.A(Pal.Ivory, 0.1f), Pal.Text, 48, 15);
            lobby.style.marginTop = 10;
            lobby.OnClick = () => { if (OnToLobby != null) OnToLobby(); };
            panel.Add(lobby);
            _menuOverlay.Add(panel);
            U.Show(_menuOverlay, false);
            Root.Add(_menuOverlay);
        }

        public bool MenuVisible { get { return _menuOverlay != null && _menuOverlay.resolvedStyle.display == DisplayStyle.Flex; } }

        public void ShowMenu(bool show, int latency, bool reduced, bool muted)
        {
            U.Show(_menuOverlay, show);
            if (!show) return;
            foreach (var ms in new[] { 0, 100, 300 })
            {
                var p = _menuOverlay.Q<Pill>("lat-" + ms);
                if (p != null) p.On = ms == latency;
            }
            var r = _menuOverlay.Q<Pill>("reduce"); if (r != null) r.On = reduced;
            var m = _menuOverlay.Q<Pill>("mute"); if (m != null) m.On = muted;
            _menuOverlay.style.opacity = 0;
            Tw.Run(0.16f, Ease.OutQuad, t => _menuOverlay.style.opacity = t);
        }

        // ------------------------------------------------------------------
        // 렌더 (애니메이션 없이 모델을 그대로 표시)
        // ------------------------------------------------------------------
        public void Render(DisplayModel m, bool animateTurn)
        {
            if (_card == null) return;
            _card.SetValue(m.Card);
            _pile.Set(m.Pile);
            _deckLabel.text = "덱 " + m.Deck;
            if (_infoLabel != null)
            {
                var info = "제거 " + m.Removed + "장";
                if (m.HiddenTotal > 0) info += " · 숨김 " + (m.HiddenTotal - m.RevealedCount) + "장 남음";
                _infoLabel.text = info;
            }
            foreach (var s in m.Seats)
            {
                SeatView v;
                if (!_seats.TryGetValue(s.Id, out v)) continue;
                v.SetData(s.Chips, s.Cards, m.ShowScore || s.IsMe);
                v.SetActive(s.Id == m.TurnId, animateTurn);
            }
            UpdateTurnLabel(m);
            RenderScoreboard(m);
        }

        public void UpdateTurnLabel(DisplayModel m)
        {
            if (_turnLabel == null) return;
            var s = m.Seat(m.TurnId);
            if (m.Phase != NoThanks.Core.Net.Phases.Playing) _turnLabel.text = "";
            else if (s == null) _turnLabel.text = "";
            else if (m.RevealPending) _turnLabel.text = "숨김 카드 공개!";
            else if (s.IsMe) _turnLabel.text = "내 차례";
            else _turnLabel.text = s.Name + "의 차례";
            _turnLabel.style.color = s != null && s.IsMe ? Pal.BrassLight : Pal.Text;
        }

        private void RenderScoreboard(DisplayModel m)
        {
            if (_scoreList == null) return;
            _scoreList.Clear();
            foreach (var s in m.Seats)
            {
                var row = U.El().Row().H(26).Ignore();
                row.style.alignItems = Align.Center;
                var dot = U.El().Size(8, 8).Radius(4).Bg(s.Id == m.TurnId ? Pal.BrassLight : Pal.A(Pal.Ivory, 0.15f)).Ignore();
                dot.style.marginRight = 8;
                row.Add(dot);
                row.Add(U.Text(s.Name, 13, s.IsMe ? Pal.BrassLight : Pal.Text));
                row.Add(U.El().Grow().Ignore());
                int pts = NoThanks.Core.Scoring.CardSum(s.Cards);
                string score = !m.ShowScore && !s.IsMe ? "—" : s.Chips < 0 ? "카드 " + pts : (pts - s.Chips).ToString();
                row.Add(U.Text(score, 13, Pal.Text));
                _scoreList.Add(row);
            }
        }

        public void SetButtons(bool canTake, bool canPass, string takeSub, string passSub)
        {
            if (TakeButton == null) return;
            TakeButton.Enabled = canTake;
            PassButton.Enabled = canPass;
            TakeButton.SetText("가져가기", takeSub ?? "");
            PassButton.SetText("패스", passSub ?? "");
        }

        public void SetHint(string text)
        {
            if (_hint != null) _hint.text = text ?? "";
        }

        public void SetLatency(int ms)
        {
            if (_latencyBadge != null) _latencyBadge.text = ms + "ms";
        }

        public void SetPerf(string text, bool visible)
        {
            if (_perf == null) return;
            U.Show(_perf, visible);
            _perf.text = text;
        }

        public void SetTimer(float frac, bool visible, bool urgent)
        {
            if (_timerTrack == null) return;
            _timerTrack.style.opacity = visible ? 1 : 0;
            _timerFill.style.width = new Length(Mathf.Clamp01(frac) * 100f, LengthUnit.Percent);
            _timerFill.style.backgroundColor = urgent ? Pal.Danger : Pal.Brass;
        }

        public void AddLog(string line)
        {
            _log.Add(line);
            if (_log.Count > 60) _log.RemoveAt(0);
            if (_logList == null) return;
            var l = U.Text(line, 12, Pal.A(Pal.Text, 0.85f));
            l.style.whiteSpace = WhiteSpace.Normal;
            l.style.marginBottom = 4;
            _logList.Insert(0, l);
            while (_logList.childCount > 60) _logList.RemoveAt(_logList.childCount - 1);
            l.style.opacity = 0;
            Tw.Run(0.2f, Ease.OutQuad, t => l.style.opacity = t);
        }

        public void ClearLog()
        {
            _log.Clear();
            if (_logList != null) _logList.Clear();
        }

        public void RestoreLog()
        {
            if (_logList == null) return;
            for (int i = _log.Count - 1; i >= 0; i--)
            {
                var l = U.Text(_log[i], 12, Pal.A(Pal.Text, 0.85f));
                l.style.whiteSpace = WhiteSpace.Normal;
                l.style.marginBottom = 4;
                _logList.Add(l);
            }
        }

        public void Toast(string text, bool error = false)
        {
            if (_toast == null) return;
            Tw.Kill(_toastMotion);
            _toast.text = text;
            _toast.style.backgroundColor = error ? Pal.Danger : Pal.BrassLight;
            _toast.style.color = error ? Color.white : Pal.Ink;
            _toastMotion = Tw.Run(2.2f, Ease.Linear, t =>
            {
                float a = t < 0.08f ? t / 0.08f : t > 0.85f ? (1 - t) / 0.15f : 1f;
                _toast.style.opacity = a;
                _toast.style.translate = new Translate(new Length(-50, LengthUnit.Percent), new Length((1 - Mathf.Min(1, t / 0.08f)) * -8, LengthUnit.Pixel));
            });
        }

        // ------------------------------------------------------------------
        // 위치 헬퍼 (패널 좌표)
        // ------------------------------------------------------------------
        public Vector2 CardCenter { get { return U.CenterOf(_cardHolder); } }
        public Vector2 DeckCenter { get { return U.CenterOf(_deck); } }
        public Vector2 PileAnchor { get { return _pile.Anchor; } }
        public bool Ready { get { return U.HasLayout(_cardHolder); } }

        public Vector2 SeatChipAnchor(string id)
        {
            SeatView v;
            return _seats.TryGetValue(id, out v) && U.HasLayout(v) ? v.ChipAnchor : CardCenter;
        }

        public Vector2 SeatHandAnchor(string id)
        {
            SeatView v;
            return _seats.TryGetValue(id, out v) && U.HasLayout(v) ? v.HandAnchor : CardCenter;
        }

        public Vector2 SeatCenter(string id)
        {
            SeatView v;
            return _seats.TryGetValue(id, out v) && U.HasLayout(v) ? U.CenterOf(v) : CardCenter;
        }

        public SeatView Seat(string id)
        {
            SeatView v;
            return _seats.TryGetValue(id, out v) ? v : null;
        }

        private Vector2 ToFx(Vector2 panel)
        {
            var o = _fx.worldBound;
            return new Vector2(panel.x - o.x, panel.y - o.y);
        }

        // ------------------------------------------------------------------
        // 연출 프리미티브
        // ------------------------------------------------------------------
        /// <summary>덱 → 중앙으로 카드가 나와 뒤집힘.</summary>
        public void AnimReveal(int value, Action onLand, Action done)
        {
            if (!Ready || Tw.Reduced)
            {
                _card.SetValue(value);
                U.Opacity(_card, 0);
                Tw.Run(MotionSpec.ReducedFade, Ease.Linear, t => U.Opacity(_card, t), () => { U.Opacity(_card, 1); if (onLand != null) onLand(); done(); });
                return;
            }
            var from = DeckCenter; var to = CardCenter;
            _card.SetValue(0);
            var fly = new CardView(Spec.CardW, Spec.CardH);
            fly.SetValue(-1);
            fly.Abs(0, 0);
            _fx.Add(fly);
            var a = ToFx(from) - new Vector2(Spec.CardW * 0.5f, Spec.CardH * 0.5f);
            var b = ToFx(to) - new Vector2(Spec.CardW * 0.5f, Spec.CardH * 0.5f);
            bool flipped = false;
            Sfx.Play(SfxId.Flip, 1f + UnityEngine.Random.Range(-0.05f, 0.05f));
            Tw.Run(MotionSpec.CardReveal, Ease.OutCubic, t =>
            {
                var p = Tw.Arc(a, b, t, 18);
                fly.style.left = p.x; fly.style.top = p.y;
                float sx = Mathf.Abs(Mathf.Cos(t * Mathf.PI));
                if (!flipped && t >= 0.5f) { flipped = true; fly.SetValue(value); }
                U.SetScale(fly, Mathf.Lerp(0.45f, 1f, Mathf.Min(1, t * 1.4f)) * Mathf.Max(0.02f, sx), Mathf.Lerp(0.45f, 1f, Mathf.Min(1, t * 1.4f)));
            }, () =>
            {
                fly.RemoveFromHierarchy();
                _card.SetValue(value);
                if (onLand != null) onLand();
                // 착지 바운스 + 광택 + 글로우
                Tw.Run(0.22f, Ease.OutBack, t => U.SetScale(_card, 1.06f - 0.06f * t));
                Tw.Run(0.5f, Ease.InOutCubic, t => _card.SetSheen(t));
                Tw.Run(0.5f, Ease.OutQuad, t => _glow.style.opacity = 1 + 0.8f * Mathf.Sin(t * Mathf.PI));
                done();
            });
        }

        /// <summary>좌석 → 카드 위로 칩 한 개.</summary>
        public void AnimChip(Vector2 fromPanel, Vector2 toPanel, float delay, Action onArrive, Action done)
        {
            if (!Ready || Tw.Reduced)
            {
                if (onArrive != null) onArrive();
                done();
                return;
            }
            var chip = new ChipView(Spec.ChipSize);
            chip.Abs(0, 0);
            chip.style.opacity = 0;
            _fx.Add(chip);
            var off = new Vector2(Spec.ChipSize * 0.5f, Spec.ChipSize * 0.5f);
            var a = ToFx(fromPanel) - off; var b = ToFx(toPanel) - off;
            Tw.Run(MotionSpec.ChipPlace, Ease.OutQuad, t =>
            {
                var p = Tw.Arc(a, b, t, 40);
                chip.style.left = p.x; chip.style.top = p.y;
                chip.style.opacity = Mathf.Min(1, t * 5);
                U.SetRotate(chip, t * 220);
                U.SetScale(chip, 1f + 0.25f * Mathf.Sin(t * Mathf.PI));
            }, () =>
            {
                chip.RemoveFromHierarchy();
                Sfx.Play(SfxId.Chip, 1f + UnityEngine.Random.Range(-0.06f, 0.06f));
                if (onArrive != null) onArrive();
                done();
            }, delay);
        }

        /// <summary>중앙 카드 → 좌석 손패 (칩도 함께 이동).</summary>
        public void AnimTake(string seatId, int value, int chips, Action onArrive, Action done)
        {
            if (!Ready || Tw.Reduced)
            {
                _card.SetValue(0);
                _pile.Set(0);
                if (onArrive != null) onArrive();
                done();
                return;
            }
            var to = SeatHandAnchor(seatId);
            var from = CardCenter;
            _card.SetValue(0);
            var fly = new CardView(Spec.CardW, Spec.CardH);
            fly.SetValue(value);
            fly.Abs(0, 0);
            _fx.Add(fly);
            var a = ToFx(from) - new Vector2(Spec.CardW * 0.5f, Spec.CardH * 0.5f);
            var b = ToFx(to) - new Vector2(Spec.CardW * 0.5f, Spec.CardH * 0.5f);
            SeatView seat = Seat(seatId);
            float endScale = seat != null && seat.IsMe ? Spec.MyMiniW / Spec.CardW : Spec.SeatMiniW / Spec.CardW;
            Sfx.Play(SfxId.Take);

            // 칩: 더미에서 좌석 칩 아이콘으로 순차 이동
            int shown = Mathf.Min(chips, 8);
            var pileFrom = PileAnchor;
            var chipTo = SeatChipAnchor(seatId);
            _pile.Set(0);
            for (int i = 0; i < shown; i++) AnimChip(pileFrom, chipTo, 0.06f + i * MotionSpec.ChipCollectStagger, null, () => { });

            Tw.Run(MotionSpec.CardTake, Ease.InOutCubic, t =>
            {
                var p = Tw.Arc(a, b, t, -30);
                fly.style.left = p.x; fly.style.top = p.y;
                U.SetScale(fly, Mathf.Lerp(1f, endScale, t));
                U.SetRotate(fly, Mathf.Sin(t * Mathf.PI) * -8);
            }, () =>
            {
                fly.RemoveFromHierarchy();
                if (onArrive != null) onArrive();
                if (seat != null) seat.Pulse();
                done();
            });
        }

        /// <summary>좌석 손패 → 중앙으로 되돌림 (롤백).</summary>
        public void AnimReturnCard(string seatId, int value, int chips, Action onArrive, Action done)
        {
            if (!Ready || Tw.Reduced || value <= 0)
            {
                if (onArrive != null) onArrive();
                done();
                return;
            }
            var from = SeatHandAnchor(seatId); var to = CardCenter;
            var fly = new CardView(Spec.CardW, Spec.CardH);
            fly.SetValue(value);
            fly.Abs(0, 0);
            _fx.Add(fly);
            var a = ToFx(from) - new Vector2(Spec.CardW * 0.5f, Spec.CardH * 0.5f);
            var b = ToFx(to) - new Vector2(Spec.CardW * 0.5f, Spec.CardH * 0.5f);
            SeatView seat = Seat(seatId);
            float startScale = seat != null && seat.IsMe ? Spec.MyMiniW / Spec.CardW : Spec.SeatMiniW / Spec.CardW;
            int shown = Mathf.Min(chips, 8);
            for (int i = 0; i < shown; i++) AnimChip(SeatChipAnchor(seatId), PileAnchor, i * MotionSpec.ChipCollectStagger, null, () => { });
            Tw.Run(MotionSpec.Rollback, Ease.OutBack, t =>
            {
                var p = Vector2.LerpUnclamped(a, b, t);
                fly.style.left = p.x; fly.style.top = p.y;
                U.SetScale(fly, Mathf.LerpUnclamped(startScale, 1f, t));
            }, () =>
            {
                fly.RemoveFromHierarchy();
                if (onArrive != null) onArrive();
                done();
            });
        }

        /// <summary>숨김 카드: 흔들림 → 뒤집혀 숫자 공개.</summary>
        public void AnimHiddenReveal(int value, Action done)
        {
            if (!Ready || Tw.Reduced)
            {
                _card.SetValue(value);
                done();
                return;
            }
            Sfx.Play(SfxId.Reveal);
            Tw.Run(MotionSpec.HiddenShake, Ease.Linear, t =>
            {
                U.SetRotate(_card, Mathf.Sin(t * Mathf.PI * 8) * 4 * (1 - t));
            }, () =>
            {
                U.SetRotate(_card, 0);
                bool flipped = false;
                Tw.Run(MotionSpec.CardReveal, Ease.InOutCubic, t =>
                {
                    float sx = Mathf.Abs(Mathf.Cos(t * Mathf.PI));
                    if (!flipped && t >= 0.5f) { flipped = true; _card.SetValue(value); Sfx.Play(SfxId.Flip, 1.1f); }
                    U.SetScale(_card, Mathf.Max(0.02f, sx) * (1 + 0.1f * Mathf.Sin(t * Mathf.PI)), 1 + 0.1f * Mathf.Sin(t * Mathf.PI));
                }, () =>
                {
                    U.SetScale(_card, 1);
                    Tw.Run(0.5f, Ease.InOutCubic, t => _card.SetSheen(t));
                    done();
                });
            });
        }

        /// <summary>턴 전환 하이라이트 (짧게). 내 턴이면 버튼이 떠오름.</summary>
        public void AnimTurn(DisplayModel m, bool mine, Action done)
        {
            foreach (var kv in _seats) kv.Value.SetActive(kv.Key == m.TurnId, true);
            UpdateTurnLabel(m);
            RenderScoreboard(m);
            if (mine && TakeButton != null && !Tw.Reduced)
            {
                Tw.Run(0.26f, Ease.OutBack, t =>
                {
                    U.SetTranslate(TakeButton, 0, (1 - t) * 14);
                    U.SetTranslate(PassButton, 0, (1 - t) * 14);
                }, () => { U.SetTranslate(TakeButton, 0, 0); U.SetTranslate(PassButton, 0, 0); });
                Tw.Run(0.3f, Ease.OutQuad, t => U.SetScale(_turnLabel, 1 + 0.12f * Mathf.Sin(t * Mathf.PI)));
            }
            Tw.Run(MotionSpec.TurnChange, Ease.OutCubic, t => { }, done);
        }

        /// <summary>패스 불가/거절 시 버튼 흔들림.</summary>
        public void ShakeButton(ActionButton b)
        {
            if (b == null) return;
            Tw.Run(0.2f, Ease.Linear, t => U.SetTranslate(b, Mathf.Sin(t * Mathf.PI * 6) * 7 * (1 - t), 0), () => U.SetTranslate(b, 0, 0));
        }

        public void AnimEndBanner(Action done)
        {
            var banner = U.Text("게임 종료", Kind == LayoutKind.Portrait ? 34 : 44, Pal.BrassLight, true).Fill();
            banner.style.unityTextAlign = TextAnchor.MiddleCenter;
            banner.Bg(Pal.A(Pal.Ink, 0.6f));
            banner.style.opacity = 0;
            _fx.Add(banner);
            Sfx.Play(SfxId.End);
            Tw.Run(MotionSpec.EndBanner, Ease.OutCubic, t =>
            {
                banner.style.opacity = t;
                U.SetScale(banner, Mathf.Lerp(1.15f, 1f, t));
            }, () =>
            {
                Tw.Run(0.5f, Ease.Linear, t => { }, () => { banner.RemoveFromHierarchy(); done(); });
            });
        }

        public void PulseCard()
        {
            Tw.Run(0.16f, Ease.OutQuad, t => U.SetScale(_card, 1 + 0.05f * Mathf.Sin(t * Mathf.PI)));
        }
    }
}
