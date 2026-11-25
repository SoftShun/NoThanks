using UnityEngine;
using UnityEngine.UIElements;

namespace NoThanks.Proto
{
    /// <summary>게임 이름은 아직 정하지 않았다. 확정되면 이 상수만 바꾸면 된다.</summary>
    public static class Brand
    {
        public const string Name = "{새 이름}";
        public const string Tagline = "숫자는 피하고, 칩으로 버텨라";
        public const string Concept = "벨벳 누아르";
    }

    /// <summary>1안 "벨벳 누아르" 팔레트 (docs/remake/art-direction.md 표와 동일).</summary>
    public static class Pal
    {
        public static readonly Color Ink = Hex("#0E0C10");
        public static readonly Color InkSoft = Hex("#18131B");
        public static readonly Color Panel = new Color(0.08f, 0.06f, 0.08f, 0.78f);
        public static readonly Color PanelHi = new Color(0.13f, 0.10f, 0.12f, 0.88f);
        public static readonly Color Felt = Hex("#3B1622");
        public static readonly Color FeltDeep = Hex("#220E16");
        public static readonly Color Brass = Hex("#C9A45C");
        public static readonly Color BrassLight = Hex("#EBCB86");
        public static readonly Color BrassDim = Hex("#7A6236");
        public static readonly Color Ivory = Hex("#F3EBDD");
        public static readonly Color IvoryShade = Hex("#E0D3BE");
        public static readonly Color CardInk = Hex("#231C20");
        public static readonly Color Text = Hex("#F1E7DA");
        public static readonly Color Muted = Hex("#A3968B");
        public static readonly Color Danger = Hex("#E2645E");
        public static readonly Color Good = Hex("#7FD3A0");
        public static readonly Color TierLow = Hex("#6F8FA8");
        public static readonly Color TierMid = Hex("#C9A45C");
        public static readonly Color TierHigh = Hex("#B5473F");
        public static readonly Color Clear = new Color(0, 0, 0, 0);

        public static Color Hex(string hex)
        {
            Color c;
            return ColorUtility.TryParseHtmlString(hex, out c) ? c : Color.magenta;
        }

        public static Color A(Color c, float a) { c.a = a; return c; }

        /// <summary>카드 값 구간 색 (낮음 3~12 / 중간 13~24 / 높음 25~35).</summary>
        public static Color Tier(int v)
        {
            if (v <= 12) return TierLow;
            if (v <= 24) return TierMid;
            return TierHigh;
        }
    }

    public static class Fonts
    {
        private static Font _body, _display;
        public static Font Body { get { if (_body == null) _body = Resources.Load<Font>("Fonts/GowunDodum-Regular-KSubset"); return _body; } }
        public static Font Display { get { if (_display == null) _display = Resources.Load<Font>("Fonts/GowunBatang-Bold-KSubset"); return _display; } }
    }

    /// <summary>UI Toolkit 인라인 스타일 헬퍼 (USS 없이 코드로 화면을 만든다).</summary>
    public static class U
    {
        public static VisualElement El(string name = null)
        {
            var e = new VisualElement();
            if (name != null) e.name = name;
            return e;
        }

        public static Label Text(string text, float size, Color color, bool display = false, bool bold = false)
        {
            var l = new Label(text);
            l.pickingMode = PickingMode.Ignore;
            l.style.fontSize = size;
            l.style.color = color;
            l.style.marginLeft = 0; l.style.marginRight = 0; l.style.marginTop = 0; l.style.marginBottom = 0;
            l.style.paddingLeft = 0; l.style.paddingRight = 0; l.style.paddingTop = 0; l.style.paddingBottom = 0;
            SetFont(l, display ? Fonts.Display : Fonts.Body);
            if (bold) l.style.unityFontStyleAndWeight = FontStyle.Bold;
            return l;
        }

        public static void SetFont(VisualElement e, Font f)
        {
            if (f != null) e.style.unityFontDefinition = new StyleFontDefinition(FontDefinition.FromFont(f));
        }

        public static T Abs<T>(this T e, float? left = null, float? top = null, float? right = null, float? bottom = null) where T : VisualElement
        {
            e.style.position = Position.Absolute;
            if (left.HasValue) e.style.left = left.Value;
            if (top.HasValue) e.style.top = top.Value;
            if (right.HasValue) e.style.right = right.Value;
            if (bottom.HasValue) e.style.bottom = bottom.Value;
            return e;
        }

        public static T Fill<T>(this T e) where T : VisualElement
        {
            e.style.position = Position.Absolute;
            e.style.left = 0; e.style.top = 0; e.style.right = 0; e.style.bottom = 0;
            return e;
        }

        public static T Size<T>(this T e, float w, float h) where T : VisualElement
        {
            e.style.width = w; e.style.height = h;
            return e;
        }

        public static T W<T>(this T e, float w) where T : VisualElement { e.style.width = w; return e; }
        public static T H<T>(this T e, float h) where T : VisualElement { e.style.height = h; return e; }
        public static T WPct<T>(this T e, float pct) where T : VisualElement { e.style.width = new Length(pct, LengthUnit.Percent); return e; }
        public static T HPct<T>(this T e, float pct) where T : VisualElement { e.style.height = new Length(pct, LengthUnit.Percent); return e; }

        public static T Bg<T>(this T e, Color c) where T : VisualElement { e.style.backgroundColor = c; return e; }

        public static T Img<T>(this T e, Texture2D t) where T : VisualElement
        {
            e.style.backgroundImage = t != null ? new StyleBackground(t) : new StyleBackground(StyleKeyword.None);
            return e;
        }

        public static T Radius<T>(this T e, float r) where T : VisualElement
        {
            e.style.borderTopLeftRadius = r; e.style.borderTopRightRadius = r;
            e.style.borderBottomLeftRadius = r; e.style.borderBottomRightRadius = r;
            return e;
        }

        public static T Border<T>(this T e, float w, Color c) where T : VisualElement
        {
            e.style.borderTopWidth = w; e.style.borderBottomWidth = w; e.style.borderLeftWidth = w; e.style.borderRightWidth = w;
            e.style.borderTopColor = c; e.style.borderBottomColor = c; e.style.borderLeftColor = c; e.style.borderRightColor = c;
            return e;
        }

        public static T Pad<T>(this T e, float v, float? h = null) where T : VisualElement
        {
            float hh = h ?? v;
            e.style.paddingTop = v; e.style.paddingBottom = v; e.style.paddingLeft = hh; e.style.paddingRight = hh;
            return e;
        }

        public static T Pad4<T>(this T e, float top, float right, float bottom, float left) where T : VisualElement
        {
            e.style.paddingTop = top; e.style.paddingRight = right; e.style.paddingBottom = bottom; e.style.paddingLeft = left;
            return e;
        }

        public static T Mar<T>(this T e, float top, float right, float bottom, float left) where T : VisualElement
        {
            e.style.marginTop = top; e.style.marginRight = right; e.style.marginBottom = bottom; e.style.marginLeft = left;
            return e;
        }

        public static T Row<T>(this T e) where T : VisualElement { e.style.flexDirection = FlexDirection.Row; return e; }
        public static T Col<T>(this T e) where T : VisualElement { e.style.flexDirection = FlexDirection.Column; return e; }

        public static T Center<T>(this T e) where T : VisualElement
        {
            e.style.alignItems = Align.Center; e.style.justifyContent = Justify.Center;
            return e;
        }

        public static T Grow<T>(this T e, float g = 1) where T : VisualElement { e.style.flexGrow = g; e.style.flexShrink = 1; return e; }
        public static T NoShrink<T>(this T e) where T : VisualElement { e.style.flexShrink = 0; return e; }
        public static T Ignore<T>(this T e) where T : VisualElement { e.pickingMode = PickingMode.Ignore; return e; }
        public static T Gap<T>(this T e, float right) where T : VisualElement { e.style.marginRight = right; return e; }

        public static T Add<T>(this T e, params VisualElement[] children) where T : VisualElement
        {
            foreach (var c in children) if (c != null) e.Add(c);
            return e;
        }

        public static void Show(VisualElement e, bool show)
        {
            if (e != null) e.style.display = show ? DisplayStyle.Flex : DisplayStyle.None;
        }

        public static void Opacity(VisualElement e, float a) { if (e != null) e.style.opacity = a; }

        public static void SetScale(VisualElement e, float s)
        {
            if (e != null) e.style.scale = new Scale(new Vector3(s, s, 1));
        }

        public static void SetScale(VisualElement e, float sx, float sy)
        {
            if (e != null) e.style.scale = new Scale(new Vector3(sx, sy, 1));
        }

        public static void SetRotate(VisualElement e, float deg)
        {
            if (e != null) e.style.rotate = new Rotate(new Angle(deg, AngleUnit.Degree));
        }

        public static void SetTranslate(VisualElement e, float x, float y)
        {
            if (e != null) e.style.translate = new Translate(new Length(x, LengthUnit.Pixel), new Length(y, LengthUnit.Pixel));
        }

        /// <summary>패널 좌표의 중심점.</summary>
        public static Vector2 CenterOf(VisualElement e)
        {
            var r = e.worldBound;
            return new Vector2(r.x + r.width * 0.5f, r.y + r.height * 0.5f);
        }

        public static bool HasLayout(VisualElement e)
        {
            if (e == null || e.panel == null) return false;
            var r = e.worldBound;
            return !float.IsNaN(r.width) && r.width > 0.5f && r.height > 0.5f;
        }
    }
}
