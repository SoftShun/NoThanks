using System;
using System.Collections.Generic;
using LitMotion;
using NoThanks.Core;
using NoThanks.Core.Net;
using UnityEngine;
using UnityEngine.UIElements;

namespace NoThanks.Proto
{
    /// <summary>로비: 제목 + 설정(봇/규칙/지연/접근성) + 시작.</summary>
    public sealed class LobbyScreen
    {
        public readonly VisualElement Root;
        public Action OnStart;
        public Action OnConfigChanged;
        private GameConfig _cfg;
        private ActionButton _start;

        public LobbyScreen()
        {
            Root = U.El("lobby").Fill();
        }

        public void Build(LayoutKind kind, Vector4 safe, GameConfig cfg)
        {
            _cfg = cfg;
            Root.Clear();
            Root.Pad4(safe.x, safe.y, safe.z, safe.w);
            bool desktop = kind == LayoutKind.Desktop || kind == LayoutKind.DesktopWide;
            bool landscape = kind == LayoutKind.LandscapeCompact;

            var title = U.El().Col();
            title.style.alignItems = desktop || landscape ? Align.FlexStart : Align.Center;
            var name = U.Text(Brand.Name, desktop ? 64 : landscape ? 34 : 44, Pal.BrassLight, true);
            var tag = U.Text(Brand.Tagline, desktop ? 18 : 14, Pal.Muted);
            tag.style.marginTop = 6;
            var concept = U.Text("UI/UX 프로토타입 · 콘셉트 1안 「" + Brand.Concept + "」 · 로컬 목 서버", 12, Pal.A(Pal.Muted, 0.7f));
            concept.style.marginTop = 4;
            concept.style.whiteSpace = WhiteSpace.Normal;
            title.Add(name); title.Add(tag); title.Add(concept);

            // 데코: 카드 3장 부채꼴
            var deco = U.El().Row().H(desktop ? 220 : landscape ? 0 : 150).Center().Ignore();
            if (!landscape)
            {
                int[] vals = { 7, 22, 35 };
                for (int i = 0; i < 3; i++)
                {
                    var c = new CardView(desktop ? 120 : 84, desktop ? 168 : 118);
                    c.SetValue(vals[i]);
                    c.style.marginLeft = i == 0 ? 0 : (desktop ? -30 : -22);
                    U.SetRotate(c, (i - 1) * 9);
                    U.SetTranslate(c, 0, Mathf.Abs(i - 1) * 8);
                    deco.Add(c);
                    int idx = i;
                    c.style.opacity = 0;
                    Tw.Run(0.5f, Ease.OutBack, t =>
                    {
                        c.style.opacity = Mathf.Clamp01(t * 2);
                        U.SetTranslate(c, 0, Mathf.Abs(idx - 1) * 8 + (1 - t) * 30);
                    }, null, 0.08f * i);
                }
            }

            _start = new ActionButton("게임 시작", "봇 " + cfg.Bots + "명과 대결", Pal.Brass, Pal.Ink, desktop ? 68 : 62, desktop ? 24 : 21, desktop ? "Enter" : null);
            _start.OnClick = () => { if (OnStart != null) OnStart(); };
            _start.style.marginTop = 16;
            if (desktop) _start.W(360);

            var settings = BuildSettings(desktop);

            if (desktop)
            {
                var wrap = U.El().Row().Grow().Center();
                var left = U.El().Col().W(kind == LayoutKind.DesktopWide ? 620 : 520).Mar(0, 48, 0, 0);
                left.Add(title); left.Add(deco); left.Add(_start);
                var right = U.El().Col().W(kind == LayoutKind.DesktopWide ? 620 : 540).Bg(Pal.Panel).Radius(20).Pad(24, 28);
                right.style.maxHeight = new Length(88, LengthUnit.Percent);
                right.Border(1, Pal.A(Pal.Brass, 0.2f));
                var scroll = new ScrollView(ScrollViewMode.Vertical);
                scroll.Grow();
                scroll.Add(settings);
                right.Add(scroll);
                wrap.Add(left); wrap.Add(right);
                Root.Add(wrap);
            }
            else if (landscape)
            {
                var row = U.El().Row().Grow();
                var left = U.El().Col().W(300).NoShrink().Pad(16, 16);
                left.style.justifyContent = Justify.Center;
                left.Add(title); left.Add(_start);
                var scroll = new ScrollView(ScrollViewMode.Vertical);
                scroll.Grow();
                scroll.style.paddingRight = 12;
                scroll.Add(settings);
                row.Add(left); row.Add(scroll);
                Root.Add(row);
            }
            else
            {
                var col = U.El().Col().Grow();
                var scroll = new ScrollView(ScrollViewMode.Vertical);
                scroll.Grow();
                var inner = U.El().Col().Pad(20, 18);
                inner.Add(title); inner.Add(deco); inner.Add(settings);
                scroll.Add(inner);
                col.Add(scroll);
                var bar = U.El().Pad4(8, 16, 12, 16).NoShrink();
                _start.style.marginTop = 0;
                bar.Add(_start);
                col.Add(bar);
                Root.Add(col);
            }

            Root.style.opacity = 0;
            Tw.Run(0.25f, Ease.OutQuad, t => Root.style.opacity = t);
        }

        private VisualElement Section(VisualElement parent, string title)
        {
            var l = U.Text(title, 13, Pal.Brass, false, true);
            l.style.marginTop = 18; l.style.marginBottom = 8;
            l.style.letterSpacing = 1;
            parent.Add(l);
            return l;
        }

        private VisualElement Field(VisualElement parent, string label, VisualElement control, string help = null)
        {
            var row = U.El().Col();
            row.style.marginBottom = 8;
            var head = U.Text(label, 15, Pal.Text);
            head.style.marginBottom = 6;
            row.Add(head);
            row.Add(control);
            if (help != null)
            {
                var h = U.Text(help, 12, Pal.Muted);
                h.style.whiteSpace = WhiteSpace.Normal;
                row.Add(h);
            }
            parent.Add(row);
            return row;
        }

        private VisualElement Segmented<T>(IList<T> values, Func<T, string> label, T current, Action<T> onPick)
        {
            var row = U.El().Row();
            row.style.flexWrap = Wrap.Wrap;
            var pills = new List<Pill>();
            for (int i = 0; i < values.Count; i++)
            {
                var v = values[i];
                var p = new Pill(label(v)) { On = EqualityComparer<T>.Default.Equals(v, current) };
                p.OnClick = () =>
                {
                    foreach (var q in pills) q.On = false;
                    p.On = true;
                    onPick(v);
                    Changed();
                };
                pills.Add(p);
                row.Add(p);
            }
            return row;
        }

        private void Changed()
        {
            if (_start != null) _start.SetText("게임 시작", "봇 " + _cfg.Bots + "명과 대결");
            if (OnConfigChanged != null) OnConfigChanged();
        }

        private VisualElement BuildSettings(bool desktop)
        {
            var c = _cfg;
            var root = U.El().Col();

            Section(root, "상대 (AI 봇)");
            var botsBox = U.El().Col();
            Action rebuildBots = null;
            rebuildBots = () =>
            {
                botsBox.Clear();
                for (int i = 0; i < c.Bots; i++)
                {
                    int idx = i;
                    var cur = c.BotDifficulties != null && idx < c.BotDifficulties.Length ? c.BotDifficulties[idx] : "medium";
                    Field(botsBox, "봇 " + (i + 1) + " 난이도", Segmented(new[] { "medium", "hard", "expert" }, d => DisplayModel.DifficultyKo(d), cur, d =>
                    {
                        if (c.BotDifficulties == null || c.BotDifficulties.Length < 3) c.BotDifficulties = new[] { "medium", "hard", "expert" };
                        c.BotDifficulties[idx] = d;
                    }));
                }
            };
            var count = new Stepper(c.Bots, 1, GameRules.MaxBots);
            count.OnChanged = v => { c.Bots = v; rebuildBots(); Changed(); };
            Field(root, "봇 수 (1~3)", count, "master 규칙: 봇 최대 3, 총 인원 최대 7명");
            root.Add(botsBox);
            rebuildBots();

            Section(root, "규칙 (master 와 동일한 범위)");
            var removed = new Stepper(c.RemovedCount, 1, 32);
            removed.OnChanged = v => { c.RemovedCount = v; Changed(); };
            Field(root, "제거할 카드 수", removed, "기본 9장 · 카드 3~35 중 무작위 제거");
            var chips = new Stepper(c.InitialChips, 1, 50);
            chips.OnChanged = v => { c.InitialChips = v; Changed(); };
            Field(root, "시작 칩", chips, "기본 11개 · master 는 인원과 무관하게 동일 개수");
            Field(root, "턴 제한 시간", Segmented(new[] { 0, 15, 30, 60 }, v => v == 0 ? "없음" : v + "초", c.TurnLimit, v => c.TurnLimit = v), "시간 초과 시 칩이 있으면 자동 패스, 없으면 가져가기");
            var hiddenCount = new Stepper(c.HiddenCount, 1, 5);
            hiddenCount.OnChanged = v => { c.HiddenCount = v; Changed(); };
            Field(root, "게임 모드", Segmented(new[] { false, true }, v => v ? "숨김 모드" : "일반", c.Hidden, v => c.Hidden = v), "숨김 모드: 일부 카드가 뒷면으로 나와 가져가는 순간 공개");
            Field(root, "숨김 카드 수", hiddenCount);
            Field(root, "상대 칩 공개", Segmented(new[] { false, true }, v => v ? "공개" : "비공개", c.ShowOpponentChips, v => c.ShowOpponentChips = v));
            Field(root, "실시간 점수", Segmented(new[] { true, false }, v => v ? "표시" : "숨김", c.ShowScore, v => c.ShowScore = v));

            Section(root, "네트워크 시뮬레이션 (비교용)");
            Field(root, "지연 (단방향)", Segmented(new[] { 0, 100, 300 }, v => v + "ms", c.LatencyMs, v => c.LatencyMs = v), "보내기·받기 각각 이만큼 늦게 도착 (300 = 왕복 600ms)");
            Field(root, "거절 시뮬레이션", Segmented(new[] { false, true }, v => v ? "20% 거절" : "끔", c.DebugReject, v => c.DebugReject = v), "켜면 서버가 일부 요청을 거절 → 롤백 연출 확인");
            Field(root, "봇 사고 시간", Segmented(new[] { false, true }, v => v ? "빠르게(×0.35)" : "기본", c.FastBots, v => c.FastBots = v));

            Section(root, "접근성 · 피드백");
            Field(root, "모션", Segmented(new[] { 0, 1, 2 }, v => v == 0 ? "자동(OS)" : v == 1 ? "줄이기" : "켜기", c.MotionMode, v => c.MotionMode = v), "자동: 브라우저 prefers-reduced-motion 을 따름");
            Field(root, "소리", Segmented(new[] { false, true }, v => v ? "끔" : "켬", c.Muted, v => { c.Muted = v; Sfx.Muted = v; }));
            Field(root, "햅틱 (Android)", Segmented(new[] { true, false }, v => v ? "켬" : "끔", c.HapticsOn, v => { c.HapticsOn = v; Haptics.Enabled = v; }));
            return root;
        }

        public void FlashStart()
        {
            if (_start != null) _start.Flash();
        }
    }

    /// <summary>결과 화면: 순위 + 점수 집계 연출 (연속 묶음 강조 → 카드 점수 → 칩 차감 → 최종).</summary>
    public sealed class ResultScreen
    {
        public readonly VisualElement Root;
        public Action OnAgain, OnLobby;

        public ResultScreen()
        {
            Root = U.El("result").Fill();
        }

        public void Build(LayoutKind kind, Vector4 safe, List<ResultSchema> results, string meId, AnimQueue queue)
        {
            Root.Clear();
            Root.Pad4(safe.x, safe.y, safe.z, safe.w);
            bool desktop = kind == LayoutKind.Desktop || kind == LayoutKind.DesktopWide;
            bool landscape = kind == LayoutKind.LandscapeCompact;
            float mini = desktop ? 34 : landscape ? 22 : 24;

            var col = U.El().Col().Grow();
            col.style.alignItems = Align.Center;
            var head = U.Text("결과", desktop ? 40 : 28, Pal.BrassLight, true);
            head.style.marginTop = landscape ? 6 : 20;
            col.Add(head);
            var sub = U.Text("점수가 낮을수록 좋습니다 · 연속된 카드는 가장 낮은 숫자만 계산", 12, Pal.Muted);
            sub.style.marginBottom = landscape ? 6 : 14;
            col.Add(sub);

            var scroll = new ScrollView(ScrollViewMode.Vertical);
            scroll.Grow();
            scroll.style.width = new Length(100, LengthUnit.Percent);
            scroll.style.maxWidth = desktop ? 900 : 10000;
            col.Add(scroll);

            var rows = new List<Action<Action>>();
            if (results == null || results.Count == 0)
            {
                scroll.Add(U.Text("게임이 취소되었습니다.", 16, Pal.Text));
            }
            for (int i = 0; i < (results != null ? results.Count : 0); i++)
            {
                var r = results[i];
                bool me = r.Id == meId;
                var row = U.El().Col().Bg(me ? Pal.PanelHi : Pal.Panel).Radius(14).Pad(landscape ? 8 : 12, 14);
                row.style.marginBottom = 8;
                row.style.marginLeft = 12; row.style.marginRight = 12;
                row.Border(me ? 2 : 1, me ? Pal.BrassLight : Pal.A(Pal.Brass, 0.15f));
                var top = U.El().Row();
                top.style.alignItems = Align.Center;
                var rank = U.Text(r.Rank + "위", desktop ? 22 : 18, r.Rank == 1 ? Pal.BrassLight : Pal.Text, true);
                rank.style.minWidth = 52;
                top.Add(rank);
                top.Add(U.Text(me ? "나" : r.Nickname, desktop ? 18 : 15, Pal.Text, false, true));
                top.Add(U.El().Grow());
                var detail = U.Text("", 12, Pal.Muted);
                detail.style.marginRight = 12;
                top.Add(detail);
                var score = U.Text("0", desktop ? 28 : 22, Pal.BrassLight, true);
                score.style.minWidth = 56;
                score.style.unityTextAlign = TextAnchor.MiddleRight;
                top.Add(score);
                row.Add(top);
                var hand = U.El().Row();
                hand.style.flexWrap = Wrap.Wrap;
                hand.style.marginTop = 6;
                row.Add(hand);
                row.style.opacity = 0;
                scroll.Add(row);

                var runs = Scoring.Runs(r.Cards);
                int cardPts = Scoring.CardSum(r.Cards);
                var groups = new List<VisualElement>();
                foreach (var run in runs)
                {
                    var g = U.El().Row();
                    g.style.marginRight = mini * 0.25f; g.style.marginBottom = 4;
                    for (int k = 0; k < run.Count; k++)
                    {
                        var mc = new MiniCard(run[k], mini, mini * 1.4f, k == 0);
                        if (k > 0) mc.style.marginLeft = -mini * 0.4f;
                        g.Add(mc);
                    }
                    g.style.opacity = 0.25f;
                    hand.Add(g);
                    groups.Add(g);
                }

                int idx = i;
                var res = r;
                rows.Add(done =>
                {
                    Tw.Run(0.25f, Ease.OutCubic, t => { row.style.opacity = t; U.SetTranslate(row, 0, (1 - t) * 16); });
                    // 묶음을 하나씩 밝히며 카드 점수 누적
                    int shownPts = 0;
                    float per = groups.Count > 0 ? Mathf.Min(0.12f, MotionSpec.TallyPerPlayer * 0.6f / groups.Count) : 0;
                    for (int gi = 0; gi < groups.Count; gi++)
                    {
                        var g = groups[gi];
                        int add = runs[gi][0];
                        int gIndex = gi;
                        Tw.Run(per, Ease.OutQuad, t => g.style.opacity = Mathf.Lerp(0.25f, 1f, t), () =>
                        {
                            shownPts += add;
                            score.text = shownPts.ToString();
                            Sfx.Play(SfxId.Tally, 1f + gIndex * 0.04f, 0.6f);
                        }, 0.25f + per * gi);
                    }
                    float tChips = 0.25f + per * groups.Count + 0.1f;
                    Tw.Run(0.35f, Ease.OutCubic, t =>
                    {
                        int v = Mathf.RoundToInt(Mathf.Lerp(cardPts, res.Score, t));
                        score.text = v.ToString();
                        detail.text = "카드 " + cardPts + " − 칩 " + res.Chips;
                    }, () =>
                    {
                        score.text = res.Score.ToString();
                        if (res.Rank == 1)
                        {
                            Tw.Run(0.3f, Ease.OutBack, t => U.SetScale(rank, 1 + 0.3f * Mathf.Sin(t * Mathf.PI)));
                        }
                        done();
                    }, tChips);
                });
            }

            var btns = U.El().Row().NoShrink();
            btns.style.justifyContent = Justify.Center;
            btns.Pad4(10, 16, 14, 16);
            var again = new ActionButton("다시 하기", null, Pal.Brass, Pal.Ink, 58, 19, desktop ? "Enter" : null);
            again.Grow(); again.style.maxWidth = 280; again.style.marginRight = 12;
            again.OnClick = () => { if (OnAgain != null) OnAgain(); };
            var lobby = new ActionButton("로비로", null, Pal.A(Pal.Ivory, 0.1f), Pal.Text, 58, 19, desktop ? "Esc" : null);
            lobby.Grow(); lobby.style.maxWidth = 280;
            lobby.OnClick = () => { if (OnLobby != null) OnLobby(); };
            btns.Add(again); btns.Add(lobby);
            col.Add(btns);
            Root.Add(col);

            // 집계는 애니메이션 큐에서 순서대로 (1위부터)
            foreach (var r in rows) queue.Enqueue("tally", r, 4f);
            bool iWon = results != null && results.Count > 0 && results[0].Id == meId;
            queue.EnqueueInstant("result-sfx", () =>
            {
                if (iWon) { Sfx.Play(SfxId.Win); Haptics.Heavy(); }
            });
        }
    }
}
