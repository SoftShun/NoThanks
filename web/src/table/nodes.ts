/**
 * 테이블 구성 요소 (Pixi 그래픽으로 직접 그림 — 외부 이미지 없음)
 * 아트 원칙은 docs/remake/art-direction.md 참고.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { FONT_NUM, FONT_UI, PALETTE, cardAccent } from '../app/theme';
import { runsOf } from '../engine/rules';

// ───────────────────────── 카드 ─────────────────────────
export class CardNode extends Container {
  private g = new Graphics();
  private num: Text;
  private corner1: Text;
  private corner2: Text;
  private emblem: Text;
  value: number | null = null;
  faceUp = true;
  constructor(
    public w: number,
    public h: number,
  ) {
    super();
    this.addChild(this.g);
    this.num = new Text({ text: '', style: { fontFamily: FONT_NUM, fontSize: h * 0.44, fill: PALETTE.inkText } });
    this.num.anchor.set(0.5);
    this.corner1 = new Text({ text: '', style: { fontFamily: FONT_NUM, fontSize: h * 0.11, fill: PALETTE.inkText } });
    this.corner2 = new Text({ text: '', style: { fontFamily: FONT_NUM, fontSize: h * 0.11, fill: PALETTE.inkText } });
    this.corner1.anchor.set(0.5);
    this.corner2.anchor.set(0.5);
    this.corner2.rotation = Math.PI;
    this.emblem = new Text({ text: '?', style: { fontFamily: FONT_NUM, fontSize: h * 0.36, fill: PALETTE.brass } });
    this.emblem.anchor.set(0.5);
    this.addChild(this.num, this.corner1, this.corner2, this.emblem);
    this.pivot.set(0, 0);
    this.redraw();
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.num.style.fontSize = h * 0.44;
    this.corner1.style.fontSize = h * 0.11;
    this.corner2.style.fontSize = h * 0.11;
    this.emblem.style.fontSize = h * 0.36;
    this.redraw();
  }

  setFace(value: number | null, faceUp: boolean) {
    this.value = value;
    this.faceUp = faceUp;
    this.redraw();
  }

  private redraw() {
    const { w, h, g } = this;
    const r = Math.round(w * 0.1);
    g.clear();
    // 그림자
    g.roundRect(-w / 2 + 3, -h / 2 + 6, w, h, r).fill({ color: 0x000000, alpha: 0.35 });
    if (this.faceUp && this.value != null && this.value > 0) {
      const acc = cardAccent(this.value);
      g.roundRect(-w / 2, -h / 2, w, h, r).fill(PALETTE.paper).stroke({ width: 1.5, color: PALETTE.paperShade });
      // 전당표 테두리 + 위험색 띠
      const inset = Math.max(4, w * 0.06);
      g.roundRect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, r * 0.6).stroke({ width: Math.max(1.5, w * 0.018), color: acc, alpha: 0.9 });
      g.rect(-w / 2 + inset * 2, h * 0.27, w - inset * 4, Math.max(3, h * 0.03)).fill({ color: acc, alpha: 0.95 });
      // 왼쪽 펀치 구멍(전당표 절취선)
      const holes = 5;
      for (let i = 0; i < holes; i++) {
        const y = -h / 2 + (h / (holes + 1)) * (i + 1);
        g.circle(-w / 2, y, Math.max(1.5, w * 0.028)).fill(PALETTE.felt);
      }
      this.num.text = String(this.value);
      this.corner1.text = String(this.value);
      this.corner2.text = String(this.value);
      this.num.visible = this.corner1.visible = this.corner2.visible = true;
      this.num.position.set(0, -h * 0.04);
      this.corner1.position.set(-w / 2 + inset * 2.6, -h / 2 + inset * 2.4);
      this.corner2.position.set(w / 2 - inset * 2.6, h / 2 - inset * 2.4);
      this.emblem.visible = false;
    } else {
      // 뒷면: 남색 바탕 + 놋쇠 마름모 격자
      g.roundRect(-w / 2, -h / 2, w, h, r).fill(PALETTE.feltLight).stroke({ width: 2, color: PALETTE.brassDark });
      const inset = Math.max(4, w * 0.07);
      g.roundRect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, r * 0.6).stroke({ width: 1.2, color: PALETTE.brass, alpha: 0.7 });
      const step = Math.max(8, w * 0.16);
      for (let x = -w / 2 + inset; x < w / 2 - inset; x += step) {
        g.moveTo(x, -h / 2 + inset).lineTo(Math.min(x + (h - inset * 2), w / 2 - inset), Math.min(-h / 2 + inset + (w / 2 - inset - x), h / 2 - inset));
      }
      g.stroke({ width: 1, color: PALETTE.brass, alpha: 0.18 });
      g.circle(0, 0, Math.min(w, h) * 0.26).fill(PALETTE.felt).stroke({ width: 2, color: PALETTE.brass, alpha: 0.85 });
      this.num.visible = this.corner1.visible = this.corner2.visible = false;
      this.emblem.visible = true;
      this.emblem.text = this.value === -1 ? '?' : '◆';
      this.emblem.style.fontSize = this.value === -1 ? h * 0.3 : h * 0.16;
    }
  }
}

// ───────────────────────── 칩 (엽전 모티프) ─────────────────────────
export function makeChip(r: number): Graphics {
  const g = new Graphics();
  g.circle(1, 2, r).fill({ color: 0x000000, alpha: 0.35 });
  g.circle(0, 0, r).fill(PALETTE.brass).stroke({ width: Math.max(1, r * 0.12), color: PALETTE.brassDark });
  g.circle(0, 0, r * 0.72).stroke({ width: Math.max(1, r * 0.08), color: PALETTE.brassLight, alpha: 0.7 });
  const s = r * 0.3;
  g.rect(-s / 2, -s / 2, s, s).fill(PALETTE.felt);
  return g;
}

export class ChipPile extends Container {
  private chips = new Container();
  private badge = new Container();
  private badgeBg = new Graphics();
  private countText: Text;
  count = 0;
  constructor(public r: number) {
    super();
    this.addChild(this.chips, this.badge);
    this.countText = new Text({ text: '', style: { fontFamily: FONT_UI, fontWeight: '800', fontSize: 15, fill: PALETTE.ink } });
    this.countText.anchor.set(0.5);
    this.badge.addChild(this.badgeBg, this.countText);
    this.setCount(0);
  }
  /** 다음 칩이 놓일 위치 (로컬) */
  topLocal() {
    const n = Math.min(this.count, 9);
    return { x: (n % 2) * 2 - 1, y: -n * (this.r * 0.32) };
  }
  setR(r: number) {
    this.r = r;
    this.setCount(this.count);
  }
  setCount(n: number) {
    this.count = n;
    this.chips.removeChildren().forEach((c) => c.destroy());
    const shown = Math.min(n, 10);
    for (let i = 0; i < shown; i++) {
      const c = makeChip(this.r);
      c.position.set((i % 2) * 2 - 1, -i * (this.r * 0.32));
      this.chips.addChild(c);
    }
    this.countText.text = `×${n}`;
    this.countText.style.fontSize = Math.max(13, this.r * 0.95);
    const bw = this.countText.width + 14;
    const bh = this.countText.height + 4;
    this.badgeBg.clear().roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2).fill(PALETTE.brassLight).stroke({ width: 1.5, color: PALETTE.brassDark });
    this.badge.position.set(this.r * 1.9, this.r * 0.2);
    this.badge.visible = n > 0;
    this.chips.visible = n > 0;
  }
}

// ───────────────────────── 작은 카드 묶음 (손패) ─────────────────────────
export class MiniHand extends Container {
  cards: number[] = [];
  private nodes = new Map<number, Container>();
  constructor(
    public cw: number,
    public maxWidth: number,
  ) {
    super();
  }
  configure(cw: number, maxWidth: number) {
    this.cw = cw;
    this.maxWidth = maxWidth;
    this.render(this.cards);
  }
  get ch() {
    return Math.round(this.cw * 1.36);
  }
  /** 한 묶음 안에서 카드끼리 겹치는 간격 */
  get overlap() {
    return Math.round(this.cw * 0.5);
  }
  render(cards: number[], highlight?: number) {
    this.cards = [...cards];
    this.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.nodes.clear();
    const runs = runsOf(cards);
    const gap = Math.round(this.cw * 0.28);
    let x = 0;
    let y = 0;
    let lineH = this.ch;
    let rowWidth = 0;
    const rows: Array<{ items: Container[]; width: number }> = [{ items: [], width: 0 }];
    for (const run of runs) {
      const runW = this.cw + (run.length - 1) * this.overlap;
      if (x > 0 && x + runW > this.maxWidth) {
        rows[rows.length - 1].width = x - gap;
        rows.push({ items: [], width: 0 });
        x = 0;
        y += lineH + gap;
      }
      // 가장 낮은 카드(점수에 들어가는 카드)가 맨 위, 나머지는 오른쪽으로 비껴 숫자가 보이게
      [...run].reverse().forEach((v) => {
        const i = run.indexOf(v);
        const n = this.makeMini(v, i === 0, v === highlight);
        n.position.set(x + i * this.overlap + this.cw / 2, y + this.ch / 2);
        this.addChild(n);
        rows[rows.length - 1].items.push(n);
        this.nodes.set(v, n);
      });
      x += runW + gap;
      rowWidth = Math.max(rowWidth, x - gap);
    }
    rows[rows.length - 1].width = Math.max(0, x - gap);
    this.rowWidths = rows.map((r) => r.width);
    this.contentH = cards.length ? y + lineH : 0;
    void rowWidth;
  }
  rowWidths: number[] = [];
  contentH = 0;
  get contentW() {
    return Math.max(0, ...this.rowWidths);
  }
  nodeFor(v: number) {
    return this.nodes.get(v);
  }
  /** 카드 v 가 들어갈 자리 (로컬) — 이미 렌더된 상태에서 호출 */
  private makeMini(v: number, counted: boolean, glow: boolean) {
    const c = new Container();
    const g = new Graphics();
    const w = this.cw;
    const h = this.ch;
    const acc = cardAccent(v);
    if (glow) g.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 6).fill({ color: PALETTE.brassLight, alpha: 0.55 });
    g.roundRect(-w / 2 + 1, -h / 2 + 2, w, h, 4).fill({ color: 0x000000, alpha: 0.3 });
    g.roundRect(-w / 2, -h / 2, w, h, 4).fill(counted ? PALETTE.paper : PALETTE.paperShade).stroke({ width: counted ? 2 : 1, color: counted ? acc : PALETTE.brassDark, alpha: counted ? 1 : 0.6 });
    g.rect(-w / 2 + 3, h / 2 - 5, w - 6, 2.5).fill({ color: acc, alpha: counted ? 1 : 0.45 });
    const t = new Text({ text: String(v), style: { fontFamily: FONT_NUM, fontSize: Math.round(w * 0.56), fill: counted ? PALETTE.inkText : 0x6d6555 } });
    t.anchor.set(0.5);
    // 겹친 카드는 왼쪽 위 모서리에 숫자를 보여 준다
    if (!counted) {
      t.style.fontSize = Math.max(9, Math.round(this.overlap * 0.62));
      t.anchor.set(1, 0);
      t.position.set(w / 2 - 2, -h / 2 + 2);
    } else t.position.set(0, -1);
    c.addChild(g, t);
    return c;
  }
}

// ───────────────────────── 좌석 ─────────────────────────
export type SeatStyle = 'column' | 'row';

export interface SeatData {
  id: string;
  nickname: string;
  tokens: number; // -1 = 비공개
  cards: number[];
  isBot: boolean;
  score: number | null; // null = 표시 안 함
  isTurn: boolean;
}

export class Seat extends Container {
  private ring = new Graphics();
  private avatar = new Graphics();
  private initial: Text;
  private nameText: Text;
  private meta: Text;
  hand: MiniHand;
  data!: SeatData;
  style_: SeatStyle = 'column';
  width_ = 160;
  avatarR = 20;
  constructor() {
    super();
    this.initial = new Text({ text: '', style: { fontFamily: FONT_UI, fontWeight: '800', fontSize: 16, fill: PALETTE.ink } });
    this.initial.anchor.set(0.5);
    this.nameText = new Text({ text: '', style: { fontFamily: FONT_UI, fontWeight: '700', fontSize: 14, fill: PALETTE.text } });
    this.meta = new Text({ text: '', style: { fontFamily: FONT_UI, fontWeight: '500', fontSize: 12, fill: PALETTE.muted } });
    this.hand = new MiniHand(18, 140);
    this.addChild(this.ring, this.avatar, this.initial, this.nameText, this.meta, this.hand);
    this.eventMode = 'static';
  }

  configure(style: SeatStyle, width: number, avatarR: number, miniW: number, font: number) {
    this.style_ = style;
    this.width_ = width;
    this.avatarR = avatarR;
    this.nameText.style.fontSize = font;
    this.meta.style.fontSize = Math.round(font * 0.86);
    this.initial.style.fontSize = Math.round(avatarR * 0.9);
    this.hand.configure(miniW, style === 'row' ? width - avatarR * 2 - 120 : width);
    if (this.data) this.setData(this.data);
  }

  setData(d: SeatData) {
    this.data = d;
    const r = this.avatarR;
    const col = d.isBot ? PALETTE.teal : PALETTE.brass;
    this.avatar.clear().circle(0, 0, r).fill(col).stroke({ width: 2, color: PALETTE.feltEdge });
    this.initial.text = d.isBot ? 'AI' : d.nickname.slice(0, 1);
    this.nameText.text = d.nickname;
    const tokenTxt = d.tokens < 0 ? '칩 ?' : `칩 ${d.tokens}`;
    this.meta.text = d.score == null ? tokenTxt : `${tokenTxt} · ${d.score}점`;
    this.hand.render(d.cards);
    this.layoutParts();
    this.drawRing(d.isTurn ? 1 : 0);
  }

  private layoutParts() {
    const r = this.avatarR;
    if (this.style_ === 'column') {
      this.avatar.position.set(0, r);
      this.initial.position.set(0, r);
      this.nameText.anchor.set(0.5, 0);
      this.meta.anchor.set(0.5, 0);
      this.nameText.position.set(0, r * 2 + 4);
      this.meta.position.set(0, r * 2 + 6 + this.nameText.height);
      const hy = r * 2 + 10 + this.nameText.height + this.meta.height;
      this.hand.position.set(-Math.min(this.hand.contentW, this.hand.maxWidth) / 2, hy);
    } else {
      this.avatar.position.set(r, r);
      this.initial.position.set(r, r);
      this.nameText.anchor.set(0, 0);
      this.meta.anchor.set(0, 0);
      this.nameText.position.set(r * 2 + 8, r - this.nameText.height + 2);
      this.meta.position.set(r * 2 + 8, r + 2);
      const hx = r * 2 + 8 + Math.max(this.nameText.width, this.meta.width, 72) + 10;
      this.hand.position.set(hx, r - this.hand.ch / 2);
      this.hand.configure(this.hand.cw, Math.max(60, this.width_ - hx));
    }
  }

  drawRing(alpha: number) {
    const r = this.avatarR;
    const p = this.avatar.position;
    this.ring.clear();
    this.ring.circle(p.x, p.y, r + 6).stroke({ width: 3, color: PALETTE.brassLight, alpha });
    this.ring.circle(p.x, p.y, r + 12).stroke({ width: 6, color: PALETTE.brass, alpha: alpha * 0.25 });
    this.ringAlpha = alpha;
  }
  ringAlpha = 0;

  /** 칩이 출발하는 위치 (아바타 중심, 로컬) */
  chipOrigin() {
    return { x: this.avatar.position.x, y: this.avatar.position.y };
  }
  /** 카드가 도착할 위치 (손패 끝, 로컬) */
  handTarget() {
    const hx = this.hand.position.x + Math.min(this.hand.contentW, this.hand.maxWidth) + this.hand.cw / 2 + 4;
    return { x: this.style_ === 'column' ? this.hand.position.x + this.hand.contentW / 2 : hx, y: this.hand.position.y + this.hand.ch / 2 };
  }
  get blockHeight() {
    return this.style_ === 'column' ? this.avatarR * 2 + 12 + this.nameText.height + this.meta.height + this.hand.contentH : this.avatarR * 2;
  }
}
