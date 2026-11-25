using UnityEngine;

namespace NoThanks.Proto
{
    /// <summary>
    /// 런타임 절차 생성 텍스처. 원작 아트를 쓰지 않고, 나중에 AI 생성 이미지로 바꿀 자리표시자 역할.
    /// (바꿀 때는 같은 이름의 텍스처를 Resources/Art 에 넣으면 Load() 가 우선 사용)
    /// </summary>
    public static class ProceduralArt
    {
        private static Texture2D _felt, _soft, _shadow, _cardFace, _cardBack, _chip, _vignette, _sheen;

        private static Texture2D Load(string name)
        {
            return Resources.Load<Texture2D>("Art/" + name);
        }

        private static Texture2D New(int w, int h)
        {
            var t = new Texture2D(w, h, TextureFormat.RGBA32, false);
            t.wrapMode = TextureWrapMode.Clamp;
            t.filterMode = FilterMode.Bilinear;
            return t;
        }

        private static float Hash(int x, int y, int seed)
        {
            unchecked
            {
                int h = x * 374761393 + y * 668265263 + seed * 2147483647;
                h = (h ^ (h >> 13)) * 1274126177;
                return ((h ^ (h >> 16)) & 0xFFFF) / 65535f;
            }
        }

        private static float ValueNoise(float x, float y, int seed)
        {
            int xi = Mathf.FloorToInt(x), yi = Mathf.FloorToInt(y);
            float xf = x - xi, yf = y - yi;
            float a = Hash(xi, yi, seed), b = Hash(xi + 1, yi, seed), c = Hash(xi, yi + 1, seed), d = Hash(xi + 1, yi + 1, seed);
            float u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            return Mathf.Lerp(Mathf.Lerp(a, b, u), Mathf.Lerp(c, d, u), v);
        }

        /// <summary>펠트 질감 (버건디, 미세 섬유 노이즈). 반복 타일.</summary>
        public static Texture2D Felt
        {
            get
            {
                if (_felt != null) return _felt;
                _felt = Load("felt");
                if (_felt != null) return _felt;
                const int S = 256;
                _felt = New(S, S);
                _felt.wrapMode = TextureWrapMode.Repeat;
                var px = new Color32[S * S];
                var baseC = Pal.Felt;
                for (int y = 0; y < S; y++)
                    for (int x = 0; x < S; x++)
                    {
                        // 타일링을 위해 주기적 좌표 사용
                        float n = 0.55f * ValueNoise(x / 32f % 8, y / 32f % 8, 3) + 0.3f * ValueNoise(x / 8f % 32, y / 8f % 32, 7) + 0.15f * Hash(x, y, 11);
                        float fiber = 0.06f * Mathf.Sin((x * 0.9f + y * 0.35f) * 0.8f + n * 6f);
                        float k = 0.82f + 0.3f * n + fiber;
                        px[y * S + x] = new Color(baseC.r * k, baseC.g * k, baseC.b * k, 1f);
                    }
                _felt.SetPixels32(px);
                _felt.Apply(false, true);
                return _felt;
            }
        }

        /// <summary>부드러운 원형 그라데이션 (글로우/파티클/조명 헤일로).</summary>
        public static Texture2D Soft
        {
            get
            {
                if (_soft != null) return _soft;
                const int S = 128;
                _soft = New(S, S);
                var px = new Color32[S * S];
                for (int y = 0; y < S; y++)
                    for (int x = 0; x < S; x++)
                    {
                        float dx = (x + 0.5f) / S * 2 - 1, dy = (y + 0.5f) / S * 2 - 1;
                        float d = Mathf.Sqrt(dx * dx + dy * dy);
                        float a = Mathf.Clamp01(1 - d);
                        a = a * a * (3 - 2 * a);
                        px[y * S + x] = new Color(1, 1, 1, a);
                    }
                _soft.SetPixels32(px);
                _soft.Apply(false, true);
                return _soft;
            }
        }

        /// <summary>둥근 사각형 그림자 (UI Toolkit 은 box-shadow 가 없어 텍스처로 대신).</summary>
        public static Texture2D Shadow
        {
            get
            {
                if (_shadow != null) return _shadow;
                const int W = 96, H = 128;
                _shadow = New(W, H);
                var px = new Color32[W * H];
                float r = 14f, blur = 16f;
                for (int y = 0; y < H; y++)
                    for (int x = 0; x < W; x++)
                    {
                        float d = RoundRectDist(x + 0.5f, y + 0.5f, W, H, blur + r, r);
                        float a = Mathf.Clamp01(1 - (d + blur) / (blur * 2));
                        px[y * W + x] = new Color(0, 0, 0, a * a * 0.85f);
                    }
                _shadow.SetPixels32(px);
                _shadow.Apply(false, true);
                return _shadow;
            }
        }

        /// <summary>점 (px,py) 에서 inset 만큼 들어간 둥근 사각형까지의 부호 거리 (안쪽 음수).</summary>
        private static float RoundRectDist(float px, float py, float w, float h, float inset, float radius)
        {
            float hx = w * 0.5f - inset + radius, hy = h * 0.5f - inset + radius;
            float qx = Mathf.Abs(px - w * 0.5f) - hx + radius;
            float qy = Mathf.Abs(py - h * 0.5f) - hy + radius;
            float ox = Mathf.Max(qx, 0), oy = Mathf.Max(qy, 0);
            return Mathf.Sqrt(ox * ox + oy * oy) + Mathf.Min(Mathf.Max(qx, qy), 0) - radius;
        }

        /// <summary>카드 앞면 종이 질감 (아이보리, 가장자리 살짝 어둡게).</summary>
        public static Texture2D CardFace
        {
            get
            {
                if (_cardFace != null) return _cardFace;
                _cardFace = Load("card_face");
                if (_cardFace != null) return _cardFace;
                const int W = 128, H = 180;
                _cardFace = New(W, H);
                var px = new Color32[W * H];
                for (int y = 0; y < H; y++)
                    for (int x = 0; x < W; x++)
                    {
                        float u = x / (float)W, v = y / (float)H;
                        float edge = Mathf.Min(Mathf.Min(u, 1 - u) * 6f, Mathf.Min(v, 1 - v) * 6f);
                        float shade = Mathf.Lerp(0.9f, 1f, Mathf.Clamp01(edge));
                        float grain = 0.97f + 0.05f * Hash(x, y, 5) + 0.02f * ValueNoise(x / 6f, y / 6f, 9);
                        float k = shade * grain * Mathf.Lerp(0.97f, 1.02f, v);
                        var c = Pal.Ivory;
                        px[y * W + x] = new Color(c.r * k, c.g * k, c.b * k, 1);
                    }
                _cardFace.SetPixels32(px);
                _cardFace.Apply(false, true);
                return _cardFace;
            }
        }

        /// <summary>카드 뒷면 (먹색 바탕 + 황동 마름모 패턴).</summary>
        public static Texture2D CardBack
        {
            get
            {
                if (_cardBack != null) return _cardBack;
                _cardBack = Load("card_back");
                if (_cardBack != null) return _cardBack;
                const int W = 128, H = 180;
                _cardBack = New(W, H);
                var px = new Color32[W * H];
                var ink = Pal.InkSoft; var brass = Pal.BrassDim;
                for (int y = 0; y < H; y++)
                    for (int x = 0; x < W; x++)
                    {
                        float dx = Mathf.Abs(((x + y) % 16) - 8), dy = Mathf.Abs(((x - y + 512) % 16) - 8);
                        float line = Mathf.Clamp01(1.2f - Mathf.Min(dx, dy));
                        float border = (x < 8 || x >= W - 8 || y < 8 || y >= H - 8) ? 1 : 0;
                        float inner = (x == 11 || x == W - 12 || y == 11 || y == H - 12) && x >= 11 && x <= W - 12 && y >= 11 && y <= H - 12 ? 1 : 0;
                        float a = Mathf.Max(line * 0.35f, Mathf.Max(border * 0.0f, inner));
                        var c = Color.Lerp(ink, brass, a);
                        px[y * W + x] = new Color(c.r, c.g, c.b, 1);
                    }
                _cardBack.SetPixels32(px);
                _cardBack.Apply(false, true);
                return _cardBack;
            }
        }

        /// <summary>황동 칩 (동심원 각인 + 하이라이트).</summary>
        public static Texture2D Chip
        {
            get
            {
                if (_chip != null) return _chip;
                _chip = Load("chip");
                if (_chip != null) return _chip;
                const int S = 96;
                _chip = New(S, S);
                var px = new Color32[S * S];
                for (int y = 0; y < S; y++)
                    for (int x = 0; x < S; x++)
                    {
                        float dx = (x + 0.5f) / S * 2 - 1, dy = (y + 0.5f) / S * 2 - 1;
                        float d = Mathf.Sqrt(dx * dx + dy * dy);
                        if (d > 1f) { px[y * S + x] = new Color(0, 0, 0, 0); continue; }
                        float aa = Mathf.Clamp01((1f - d) * S * 0.5f);
                        float light = 0.75f + 0.35f * (-dx * 0.5f + dy * 0.7f);
                        float ring = (d > 0.62f && d < 0.7f) || (d > 0.9f) ? 0.72f : 1f;
                        float notch = d > 0.72f && d < 0.9f && (Mathf.Repeat(Mathf.Atan2(dy, dx) / (Mathf.PI * 2) * 12f, 1f) < 0.5f) ? 0.85f : 1f;
                        var c = Color.Lerp(Pal.BrassDim, Pal.BrassLight, Mathf.Clamp01(light)) * ring * notch;
                        px[y * S + x] = new Color(c.r, c.g, c.b, aa);
                    }
                _chip.SetPixels32(px);
                _chip.Apply(false, true);
                return _chip;
            }
        }

        /// <summary>화면 가장자리 비네트 (UI 위에 얹는 얇은 어둠).</summary>
        public static Texture2D Vignette
        {
            get
            {
                if (_vignette != null) return _vignette;
                const int S = 128;
                _vignette = New(S, S);
                var px = new Color32[S * S];
                for (int y = 0; y < S; y++)
                    for (int x = 0; x < S; x++)
                    {
                        float dx = (x + 0.5f) / S * 2 - 1, dy = (y + 0.5f) / S * 2 - 1;
                        float d = Mathf.Clamp01((Mathf.Sqrt(dx * dx + dy * dy) - 0.55f) / 0.9f);
                        px[y * S + x] = new Color(0, 0, 0, d * d * 0.7f);
                    }
                _vignette.SetPixels32(px);
                _vignette.Apply(false, true);
                return _vignette;
            }
        }

        /// <summary>카드 위 사선 광택 (공개 연출용).</summary>
        public static Texture2D Sheen
        {
            get
            {
                if (_sheen != null) return _sheen;
                const int W = 64, H = 64;
                _sheen = New(W, H);
                var px = new Color32[W * H];
                for (int y = 0; y < H; y++)
                    for (int x = 0; x < W; x++)
                    {
                        float t = (x + y * 0.6f) / (W + H * 0.6f);
                        float a = Mathf.Exp(-Mathf.Pow((t - 0.5f) / 0.08f, 2)) * 0.55f;
                        px[y * W + x] = new Color(1, 0.97f, 0.9f, a);
                    }
                _sheen.SetPixels32(px);
                _sheen.Apply(false, true);
                return _sheen;
            }
        }
    }
}
