using System;
using System.Collections.Generic;
using NoThanks.Core;
using UnityEngine;
using UnityEngine.UIElements;

namespace NoThanks.Proto
{
    /// <summary>
    /// 카드 한 장. 값 &gt; 0 앞면, -1 숨김(뒷면 + ?), 0 빈 자리.
    /// 디자인 원칙(art-direction.md): 아이보리 종이 + 큰 세리프 숫자 + 상단 구간 띠(낮음/중간/높음) + 황동 안쪽 테두리.
    /// </summary>
    public sealed class CardView : VisualElement
    {
        private readonly VisualElement _shadow, _body, _band, _inner, _back, _sheen;
        private readonly Label _num, _cornerTL, _cornerBR, _q;
        public int Value { get; private set; }
        public readonly float W, H;

        public CardView(float w, float h, bool withShadow = true)
        {
            W = w; H = h;
            this.Size(w, h).Ignore();
            style.flexShrink = 0;
            float r = Mathf.Round(w * 0.09f);

            if (withShadow)
            {
                _shadow = U.El().Abs(-w * 0.12f, -h * 0.04f).Size(w * 1.24f, h * 1.2f).Img(ProceduralArt.Shadow).Ignore();
                _shadow.style.opacity = 0.9f;
                Add(_shadow);
            }

            _body = U.El().Fill().Radius(r).Img(ProceduralArt.CardFace).Ignore();
            _body.style.overflow = Overflow.Hidden;
            Add(_body);

            _band = U.El().Abs(0, 0, 0).H(Mathf.Max(3, h * 0.055f)).Ignore();
            _body.Add(_band);

            _inner = U.El().Abs(w * 0.06f, h * 0.06f, w * 0.06f, h * 0.06f).Radius(Mathf.Max(2, r - 3)).Border(Mathf.Max(1, w * 0.012f), Pal.A(Pal.BrassDim, 0.55f)).Ignore();
            _body.Add(_inner);

            _num = U.Text("", Mathf.Round(h * 0.4f), Pal.CardInk, true).Fill();
            _num.style.unityTextAlign = TextAnchor.MiddleCenter;
            _body.Add(_num);

            float cs = Mathf.Max(9, Mathf.Round(h * 0.11f));
            _cornerTL = U.Text("", cs, Pal.CardInk, true).Abs(w * 0.1f, h * 0.07f);
            _cornerBR = U.Text("", cs, Pal.CardInk, true).Abs(null, null, w * 0.1f, h * 0.07f);
            U.SetRotate(_cornerBR, 180);
            if (w >= 70) { _body.Add(_cornerTL); _body.Add(_cornerBR); }

            _sheen = U.El().Fill().Img(ProceduralArt.Sheen).Ignore();
            _sheen.style.opacity = 0;
            _body.Add(_sheen);

            _back = U.El().Fill().Radius(r).Img(ProceduralArt.CardBack).Border(Mathf.Max(1, w * 0.015f), Pal.BrassDim).Ignore();
            _q = U.Text("?", Mathf.Round(h * 0.38f), Pal.BrassLight, true).Fill();
            _q.style.unityTextAlign = TextAnchor.MiddleCenter;
            _back.Add(_q);
            Add(_back);

            SetValue(0);
        }

        public void SetValue(int v)
        {
            Value = v;
            bool face = v > 0, hidden = v == -1, empty = v == 0;
            U.Show(_body, face);
            U.Show(_back, hidden);
            if (_shadow != null) U.Show(_shadow, !empty);
            if (empty)
            {
                this.Border(1.5f, Pal.A(Pal.Brass, 0.35f)).Radius(Mathf.Round(W * 0.09f));
            }
            else
            {
                this.Border(0, Pal.Clear);
            }
            if (face)
            {
                var s = v.ToString();
                _num.text = s; _cornerTL.text = s; _cornerBR.text = s;
                _band.style.backgroundColor = Pal.Tier(v);
                _num.style.color = v >= 25 ? Pal.Hex("#5A1E1B") : Pal.CardInk;
            }
        }

        /// <summary>광택 진행 (0~1). 공개 연출에서 사용.</summary>
        public void SetSheen(float t)
        {
            _sheen.style.opacity = Mathf.Sin(Mathf.Clamp01(t) * Mathf.PI);
            U.SetTranslate(_sheen, Mathf.Lerp(-W, W, t), 0);
        }
    }

    /// <summary>손패/좌석용 작은 카드 (숫자 + 구간 띠).</summary>
    public sealed class MiniCard : VisualElement
    {
        public readonly int Value;

        public MiniCard(int v, float w, float h, bool runHead)
        {
            Value = v;
            this.Size(w, h).Radius(Mathf.Max(3, w * 0.14f)).Img(ProceduralArt.CardFace).Ignore();
            style.flexShrink = 0;
            style.overflow = Overflow.Hidden;
            var band = U.El().Abs(0, 0, 0).H(Mathf.Max(2, h * 0.09f)).Bg(Pal.Tier(v)).Ignore();
            Add(band);
            var l = U.Text(v.ToString(), Mathf.Round(h * 0.42f), runHead ? Pal.CardInk : Pal.A(Pal.CardInk, 0.45f), true).Fill();
            l.style.unityTextAlign = TextAnchor.MiddleCenter;
            Add(l);
            if (!runHead) style.opacity = 0.92f;
        }
    }

    /// <summary>칩 하나 (황동 동전).</summary>
    public sealed class ChipView : VisualElement
    {
        public ChipView(float size)
        {
            this.Size(size, size).Img(ProceduralArt.Chip).Ignore();
            style.flexShrink = 0;
        }
    }

    /// <summary>카드 위에 쌓인 칩 더미 + 개수.</summary>
    public sealed class ChipPile : VisualElement
    {
        private readonly VisualElement _stack;
        private readonly Label _count;
        private readonly float _chip;
        public int Count { get; private set; }

        public ChipPile(float chipSize, float fontSize)
        {
            _chip = chipSize;
            this.Col().Center().Ignore();
            _stack = U.El().Size(chipSize * 1.6f, chipSize * 1.5f).Ignore();
            _count = U.Text("0", fontSize, Pal.BrassLight, true);
            _count.style.unityTextAlign = TextAnchor.MiddleCenter;
            _count.style.marginTop = 2;
            Add(_stack);
            Add(_count);
            Set(0);
        }

        /// <summary>칩이 날아와 꽂힐 지점 (패널 좌표).</summary>
        public Vector2 Anchor
        {
            get
            {
                var r = _stack.worldBound;
                return new Vector2(r.x + r.width * 0.5f, r.y + r.height * 0.55f);
            }
        }

        public void Set(int n)
        {
            Count = n;
            _stack.Clear();
            int shown = Mathf.Min(n, 8);
            var rng = new System.Random(n * 31 + 7);
            for (int i = 0; i < shown; i++)
            {
                var c = new ChipView(_chip);
                c.Abs(_chip * 0.3f + (float)(rng.NextDouble() - 0.5) * _chip * 0.35f, _chip * 0.5f - i * Mathf.Max(2f, _chip * 0.12f));
                _stack.Add(c);
            }
            _count.text = n > 0 ? "칩 " + n : "칩 없음";
            _count.style.color = n > 0 ? Pal.BrassLight : Pal.Muted;
        }

        public void Bump()
        {
            Tw.Run(0.18f, LitMotion.Ease.OutBack, t => U.SetScale(_count, 1f + 0.25f * Mathf.Sin(t * Mathf.PI)));
        }
    }

    /// <summary>
    /// 버튼 (터치 타깃 ≥ 44px). 누르는 즉시(PointerDown) 눌림 표현, 손을 떼면(Clickable) 실행.
    /// 데스크톱 hover 시 밝아지고 살짝 떠오름.
    /// </summary>
    public sealed class ActionButton : VisualElement
    {
        private readonly Label _label, _sub, _key;
        private readonly Color _bg, _bgHover, _fg;
        private bool _enabled = true, _hover, _pressed;
        public Action OnClick;
        public float LastPressTime;

        public ActionButton(string text, string sub, Color bg, Color fg, float height, float fontSize, string keyHint = null)
        {
            _bg = bg; _fg = fg;
            _bgHover = Color.Lerp(bg, Color.white, 0.12f);
            style.height = Mathf.Max(44, height);
            style.minWidth = 44;
            this.Radius(Mathf.Min(18, height * 0.3f)).Bg(bg).Center().Col();
            this.Border(1, Pal.A(Pal.BrassLight, 0.25f));
            style.flexShrink = 0;

            _label = U.Text(text, fontSize, fg, true, true);
            _label.style.unityTextAlign = TextAnchor.MiddleCenter;
            Add(_label);
            _sub = U.Text(sub ?? "", Mathf.Max(11, fontSize * 0.5f), Pal.A(fg, 0.75f));
            _sub.style.unityTextAlign = TextAnchor.MiddleCenter;
            if (!string.IsNullOrEmpty(sub)) Add(_sub);
            if (!string.IsNullOrEmpty(keyHint))
            {
                _key = U.Text(keyHint, 11, Pal.A(fg, 0.6f)).Abs(null, 6, 10);
                _key.Border(1, Pal.A(fg, 0.35f)).Radius(4).Pad(1, 5);
                Add(_key);
            }

            RegisterCallback<PointerDownEvent>(e =>
            {
                if (!_enabled) return;
                _pressed = true;
                LastPressTime = Time.realtimeSinceStartup;
                U.SetScale(this, 0.95f);
                style.backgroundColor = Color.Lerp(_bg, Color.black, 0.15f);
                Sfx.Play(SfxId.Tap);
                Haptics.Light();
            });
            RegisterCallback<PointerUpEvent>(e => Release());
            RegisterCallback<PointerLeaveEvent>(e => { _hover = false; Release(); Refresh(); });
            RegisterCallback<PointerEnterEvent>(e => { _hover = true; Refresh(); });
            RegisterCallback<PointerCancelEvent>(e => Release());
            this.AddManipulator(new Clickable(() =>
            {
                if (_enabled && OnClick != null) OnClick();
            }));
            Refresh();
        }

        private void Release()
        {
            if (!_pressed) return;
            _pressed = false;
            Refresh();
        }

        public void SetText(string text, string sub = null)
        {
            _label.text = text;
            if (sub != null)
            {
                _sub.text = sub;
                if (_sub.parent == null) Insert(1, _sub);
            }
        }

        public bool Enabled
        {
            get { return _enabled; }
            set
            {
                if (_enabled == value) return; // 매 프레임 호출되므로 바뀔 때만 갱신 (눌림 연출 보존)
                _enabled = value;
                if (!value) _pressed = false;
                Refresh();
            }
        }

        /// <summary>키보드 단축키로 눌렀을 때 같은 눌림 표현.</summary>
        public void Flash()
        {
            U.SetScale(this, 0.95f);
            schedule.Execute(() => Refresh()).StartingIn(90);
        }

        private void Refresh()
        {
            float s = !_enabled ? 1f : _pressed ? 0.95f : _hover ? 1.03f : 1f;
            U.SetScale(this, s);
            U.SetTranslate(this, 0, _hover && _enabled && !_pressed ? -2 : 0);
            style.backgroundColor = !_enabled ? Color.Lerp(_bg, Pal.Ink, 0.6f) : _hover ? _bgHover : _bg;
            style.opacity = _enabled ? 1f : 0.45f;
            _label.style.color = _fg;
        }
    }

    /// <summary>작은 선택 칩 (세그먼트/토글). 높이 44 이상.</summary>
    public sealed class Pill : VisualElement
    {
        private readonly Label _l;
        private bool _on;
        public Action OnClick;

        public Pill(string text, float fontSize = 15)
        {
            this.Row().Center().Radius(22).Pad(0, 14);
            style.height = 44; style.minWidth = 52;
            style.marginRight = 6; style.marginBottom = 6;
            _l = U.Text(text, fontSize, Pal.Text);
            Add(_l);
            RegisterCallback<PointerEnterEvent>(e => { if (!_on) style.backgroundColor = Pal.A(Pal.Brass, 0.18f); });
            RegisterCallback<PointerLeaveEvent>(e => Refresh());
            RegisterCallback<PointerDownEvent>(e => { U.SetScale(this, 0.95f); Sfx.Play(SfxId.Tap, 1.1f, 0.7f); Haptics.Light(); });
            RegisterCallback<PointerUpEvent>(e => U.SetScale(this, 1f));
            this.AddManipulator(new Clickable(() => { if (OnClick != null) OnClick(); }));
            Refresh();
        }

        public bool On { get { return _on; } set { _on = value; Refresh(); } }
        public string Text { set { _l.text = value; } }

        private void Refresh()
        {
            style.backgroundColor = _on ? Pal.Brass : Pal.A(Pal.Ivory, 0.06f);
            this.Border(1, _on ? Pal.BrassLight : Pal.A(Pal.Ivory, 0.18f));
            _l.style.color = _on ? Pal.Ink : Pal.Text;
        }
    }

    /// <summary>숫자 증감 (−/+ 각각 44×44).</summary>
    public sealed class Stepper : VisualElement
    {
        private readonly Label _value;
        private int _v;
        private readonly int _min, _max;
        public Action<int> OnChanged;

        public Stepper(int value, int min, int max)
        {
            _min = min; _max = max; _v = value;
            this.Row().Center();
            var minus = new Pill("−", 20);
            var plus = new Pill("+", 20);
            minus.style.minWidth = 44; plus.style.minWidth = 44;
            minus.style.marginBottom = 0; plus.style.marginBottom = 0;
            _value = U.Text(value.ToString(), 20, Pal.BrassLight, true);
            _value.style.minWidth = 44;
            _value.style.unityTextAlign = TextAnchor.MiddleCenter;
            _value.style.marginRight = 6;
            minus.OnClick = () => Set(_v - 1);
            plus.OnClick = () => Set(_v + 1);
            Add(minus); Add(_value); Add(plus);
        }

        public int Value { get { return _v; } }

        public void Set(int v)
        {
            v = Mathf.Clamp(v, _min, _max);
            if (v == _v) return;
            _v = v;
            _value.text = v.ToString();
            if (OnChanged != null) OnChanged(v);
        }
    }

    /// <summary>
    /// 플레이어 좌석: 이름, 칩, 점수, 손패(연속 묶음 단위). 현재 턴이면 황동 테두리가 빛난다.
    /// compact = 상대 좌석(작게), 아니면 내 좌석(크게).
    /// </summary>
    public sealed class SeatView : VisualElement
    {
        public readonly string PlayerId;
        public readonly bool IsMe;
        private readonly Label _name, _chips, _score, _sub;
        private readonly VisualElement _hand, _ring, _chipIcon;
        private readonly float _cardW, _cardH;
        private readonly bool _wrap;
        private bool _active;
        public VisualElement HandArea { get { return _hand; } }

        public SeatView(string id, string name, string sub, bool isMe, float cardW, float cardH, float nameSize, bool wrapHand)
        {
            PlayerId = id; IsMe = isMe; _cardW = cardW; _cardH = cardH; _wrap = wrapHand;
            this.Col().Radius(14).Bg(Pal.Panel).Pad(8, 10);
            style.overflow = Overflow.Hidden;
            this.Border(1, Pal.A(Pal.Brass, 0.18f));

            _ring = U.El().Fill().Radius(14).Border(2, Pal.BrassLight).Ignore();
            _ring.style.opacity = 0;
            Add(_ring);

            var head = U.El().Row().Ignore();
            head.style.alignItems = Align.Center;
            _name = U.Text(name, nameSize, Pal.Text, false, true);
            _name.style.flexShrink = 1;
            _name.style.overflow = Overflow.Hidden;
            _name.style.textOverflow = TextOverflow.Ellipsis;
            _name.style.whiteSpace = WhiteSpace.NoWrap;
            head.Add(_name);
            var spacer = U.El().Grow().Ignore();
            head.Add(spacer);
            _chipIcon = new ChipView(nameSize * 1.05f);
            _chipIcon.style.marginRight = 3;
            head.Add(_chipIcon);
            _chips = U.Text("", nameSize, Pal.BrassLight, true);
            head.Add(_chips);
            Add(head);

            var meta = U.El().Row().Ignore();
            meta.style.marginTop = 2;
            _sub = U.Text(sub ?? "", Mathf.Max(11, nameSize * 0.78f), Pal.Muted);
            meta.Add(_sub);
            meta.Add(U.El().Grow().Ignore());
            _score = U.Text("", Mathf.Max(11, nameSize * 0.82f), Pal.Text);
            meta.Add(_score);
            Add(meta);

            _hand = U.El().Row().Ignore();
            _hand.style.marginTop = 6;
            _hand.style.flexWrap = wrapHand ? Wrap.Wrap : Wrap.NoWrap;
            _hand.style.alignItems = Align.FlexStart;
            _hand.style.minHeight = cardH;
            Add(_hand);
        }

        public void SetData(int chips, IReadOnlyList<int> cards, bool showScore)
        {
            _chips.text = chips < 0 ? "?" : chips.ToString();
            int points = Scoring.CardSum(cards);
            if (!showScore) _score.text = "";
            else if (chips < 0) _score.text = "카드 " + points + "점";
            else _score.text = (points - chips) + "점";
            RebuildHand(cards);
        }

        private void RebuildHand(IReadOnlyList<int> cards)
        {
            _hand.Clear();
            if (cards == null || cards.Count == 0)
            {
                var none = U.Text(IsMe ? "아직 가져온 카드가 없습니다" : "카드 없음", Mathf.Max(11, _cardH * 0.28f), Pal.A(Pal.Muted, 0.8f));
                _hand.Add(none);
                return;
            }
            var runs = Scoring.Runs(cards);
            foreach (var run in runs)
            {
                var group = U.El().Row().Ignore();
                group.style.marginRight = _cardW * 0.22f;
                group.style.marginBottom = 4;
                for (int i = 0; i < run.Count; i++)
                {
                    var mc = new MiniCard(run[i], _cardW, _cardH, i == 0);
                    if (i > 0) mc.style.marginLeft = -_cardW * 0.42f; // 연속 묶음은 겹쳐서
                    group.Add(mc);
                }
                _hand.Add(group);
            }
        }

        /// <summary>카드가 날아와 꽂힐 지점 (손패 끝).</summary>
        public Vector2 HandAnchor
        {
            get
            {
                var r = _hand.worldBound;
                if (_hand.childCount > 0)
                {
                    var last = _hand[_hand.childCount - 1].worldBound;
                    return new Vector2(Mathf.Min(r.xMax - _cardW * 0.5f, last.xMax + _cardW * 0.5f), last.y + last.height * 0.5f);
                }
                return new Vector2(r.x + _cardW * 0.5f, r.y + _cardH * 0.5f);
            }
        }

        public Vector2 ChipAnchor { get { return U.CenterOf(_chipIcon); } }

        public void SetActive(bool active, bool animate)
        {
            if (_active == active && animate) return;
            _active = active;
            if (!animate)
            {
                _ring.style.opacity = active ? 1 : 0;
                style.backgroundColor = active ? Pal.PanelHi : Pal.Panel;
                return;
            }
            float from = _ring.resolvedStyle.opacity;
            Tw.Run(MotionSpec.TurnChange, LitMotion.Ease.OutCubic, t =>
            {
                _ring.style.opacity = Mathf.Lerp(from, active ? 1 : 0, t);
                style.backgroundColor = Color.Lerp(active ? Pal.Panel : Pal.PanelHi, active ? Pal.PanelHi : Pal.Panel, t);
            });
        }

        public void Pulse()
        {
            Tw.Run(0.3f, LitMotion.Ease.OutQuad, t => U.SetScale(this, 1f + 0.04f * Mathf.Sin(t * Mathf.PI)));
        }

        public void Shake()
        {
            Tw.Run(0.18f, LitMotion.Ease.Linear, t => U.SetTranslate(this, Mathf.Sin(t * Mathf.PI * 6) * 6 * (1 - t), 0),
                () => U.SetTranslate(this, 0, 0));
        }
    }
}
