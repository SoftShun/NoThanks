/**
 * 테이블 장면 (Pixi, 명령형). 상태는 TableView(protocol) 로만 받고,
 * 연출은 이벤트 단위 메서드(animXxx)로 실행되어 Promise 를 반환합니다 → AnimationQueue 가 순서를 보장.
 */
import { Container, Graphics, Text, type Application } from 'pixi.js';
import { gsap } from 'gsap';
import { CardNode, ChipPile, MiniHand, Seat, makeChip } from './nodes';
import { FONT_UI, PALETTE } from '../app/theme';
import type { LayoutMode } from '../app/config';
import type { TableView as View } from '../net/protocol';
import { cardPoints, playerScore, runsOf } from '../engine/rules';
import { EASE, MOTION, isReduced } from '../anim/motion';
import { play } from '../anim/queue';

type Pt = { x: number; y: number };

interface Geo {
  cardW: number;
  cardH: number;
  center: Pt;
  deck: Pt;
  deckScale: number;
  chipR: number;
  seatStyle: 'column' | 'row';
  seatW: number;
  avatarR: number;
  miniW: number;
  font: number;
  seats: Pt[];
  hand: { x: number; y: number; maxW: number; miniW: number; centered: boolean };
  myOrigin: Pt;
  felt: { cx: number; cy: number; rx: number; ry: number; oval: boolean };
}

export interface TableOptions {
  showOpponentTokens: boolean;
  showRealTimeScore: boolean;
}

export class TableScene {
  root = new Container();
  private felt = new Graphics();
  private feltLayer = new Container();
  /** 다음 프레임에 다시 그려야 함 (요청 기반 렌더) */
  dirty = true;
  markDirty() {
    this.dirty = true;
  }
  private layerSeats = new Container();
  private layerCenter = new Container();
  private layerHand = new Container();
  private layerFx = new Container();
  private seats = new Map<string, Seat>();
  private card: CardNode;
  private pile: ChipPile;
  private deck = new Container();
  private deckCards: CardNode[] = [];
  private deckLabel: Text;
  private hand: MiniHand;
  private handLabel: Text;
  private handGlow = new Graphics();
  private tooltip = new Container();
  private tooltipBg = new Graphics();
  private tooltipText: Text;
  private geo!: Geo;
  view: View | null = null;
  me = '';
  mode: LayoutMode = 'desktop';
  w = 800;
  h = 600;
  opts: TableOptions = { showOpponentTokens: false, showRealTimeScore: true };
  onCardHover?: (on: boolean) => void;

  constructor(public app: Application) {
    this.feltLayer.addChild(this.felt);
    this.root.addChild(this.feltLayer, this.layerSeats, this.layerCenter, this.layerHand, this.layerFx, this.tooltip);
    this.card = new CardNode(140, 192);
    this.pile = new ChipPile(14);
    for (let i = 0; i < 3; i++) {
      const c = new CardNode(100, 136);
      c.setFace(null, false);
      this.deckCards.push(c);
      this.deck.addChild(c);
    }
    this.deckLabel = new Text({ text: '', style: { fontFamily: FONT_UI, fontWeight: '700', fontSize: 13, fill: PALETTE.muted } });
    this.deckLabel.anchor.set(0.5, 0);
    this.deck.addChild(this.deckLabel);
    this.layerCenter.addChild(this.deck, this.card, this.pile);
    this.hand = new MiniHand(30, 600);
    this.handLabel = new Text({ text: '내 카드', style: { fontFamily: FONT_UI, fontWeight: '700', fontSize: 13, fill: PALETTE.muted } });
    this.layerHand.addChild(this.handGlow, this.handLabel, this.hand);
    this.tooltipText = new Text({ text: '', style: { fontFamily: FONT_UI, fontSize: 13, fill: PALETTE.text, lineHeight: 19, wordWrap: true, wordWrapWidth: 240 } });
    this.tooltip.addChild(this.tooltipBg, this.tooltipText);
    this.tooltip.visible = false;
    this.tooltip.eventMode = 'none';

    this.card.eventMode = 'static';
    this.card.cursor = 'help';
    this.card.on('pointerover', () => {
      if (this.mode === 'desktop' || this.mode === 'wide') {
        gsap.to(this.card.scale, { x: 1.04, y: 1.04, duration: 0.12 });
        this.onCardHover?.(true);
      }
    });
    this.card.on('pointerout', () => {
      gsap.to(this.card.scale, { x: 1, y: 1, duration: 0.12 });
      this.onCardHover?.(false);
    });
  }

  destroy() {
    gsap.killTweensOf(this.root);
    this.root.destroy({ children: true });
  }

  // ─────────────────────────── 레이아웃 ───────────────────────────
  resize(w: number, h: number, mode: LayoutMode) {
    this.w = w;
    this.h = h;
    this.mode = mode;
    if (this.view) this.sync(this.view);
  }

  private computeGeo(nOpp: number): Geo {
    const { w, h, mode } = this;
    const evenX = (n: number, left: number, right: number) =>
      Array.from({ length: n }, (_, i) => left + ((right - left) * (i + 0.5)) / n);
    if (mode === 'portrait') {
      const twoRows = nOpp > 3;
      const perRow = twoRows ? Math.ceil(nOpp / 2) : nOpp;
      const seatW = Math.floor((w - 16) / Math.max(1, perRow)) - 6;
      const seats: Pt[] = [];
      const row1 = evenX(Math.min(nOpp, perRow), 8, w - 8);
      row1.forEach((x) => seats.push({ x, y: 8 }));
      if (twoRows) evenX(nOpp - perRow, 8, w - 8).forEach((x) => seats.push({ x, y: 128 }));
      const seatZone = twoRows ? 250 : 150;
      const handZone = Math.max(150, h * 0.27);
      const cardH = Math.min(176, Math.max(118, (h - seatZone - handZone) * 0.78));
      const cardW = Math.round(cardH * 0.72);
      const cy = seatZone + (h - seatZone - handZone) / 2 + 6;
      return {
        cardW, cardH,
        center: { x: w / 2 + cardW * 0.32, y: cy },
        deck: { x: w / 2 - cardW * 0.78, y: cy + 4 },
        deckScale: 0.72,
        chipR: 12,
        seatStyle: 'column', seatW, avatarR: 18, miniW: 19, font: 13,
        seats,
        hand: { x: 16, y: h - handZone + 30, maxW: w - 32, miniW: 26, centered: true },
        myOrigin: { x: w / 2, y: h + 40 },
        felt: { cx: w / 2, cy, rx: w * 0.62, ry: (h - seatZone - handZone) * 0.62, oval: false },
      };
    }
    if (mode === 'landscape') {
      const colW = Math.min(300, w * 0.4);
      const rowH = Math.min(92, (h - 16) / Math.max(1, nOpp));
      const seats = Array.from({ length: nOpp }, (_, i) => ({ x: 12, y: 10 + i * rowH }));
      const cardH = Math.min(140, h * 0.38);
      const cardW = Math.round(cardH * 0.72);
      const cx = colW + (w - colW) / 2 + cardW * 0.35;
      const cy = h * 0.37;
      return {
        cardW, cardH,
        center: { x: cx, y: cy },
        deck: { x: cx - cardW * 1.25, y: cy + 4 },
        deckScale: 0.72,
        chipR: 11,
        seatStyle: 'row', seatW: colW - 16, avatarR: 16, miniW: 18, font: 12,
        seats,
        hand: { x: colW + 8, y: h - 88, maxW: w - colW - 16, miniW: 23, centered: true },
        myOrigin: { x: w + 40, y: h - 60 },
        felt: { cx: colW + (w - colW) / 2, cy, rx: (w - colW) * 0.55, ry: h * 0.5, oval: false },
      };
    }
    const wide = mode === 'wide';
    const k = wide ? 1.18 : 1;
    const cardH = Math.round(Math.min(wide ? 240 : 200, h * 0.29));
    const cardW = Math.round(cardH * 0.72);
    const cy = h * 0.5;
    const seatW = Math.round(Math.min(220 * k, (w - 80) / Math.max(1, nOpp) - 16));
    const xs = evenX(nOpp, 40, w - 40);
    const seats = xs.map((x) => {
      const d = Math.abs(x - w / 2) / (w / 2); // 0~1
      return { x, y: 18 + d * d * h * 0.22 };
    });
    return {
      cardW, cardH,
      center: { x: w / 2 + cardW * 0.4, y: cy },
      deck: { x: w / 2 - cardW * 0.85, y: cy + 6 },
      deckScale: 0.78,
      chipR: Math.round(15 * k),
      seatStyle: 'column', seatW, avatarR: Math.round(24 * k), miniW: Math.round(19 * k), font: Math.round(15 * k),
      seats,
      hand: { x: 0, y: h - Math.round(118 * k), maxW: Math.min(w - 120, 860 * k), miniW: Math.round(32 * k), centered: true },
      myOrigin: { x: w / 2, y: h + 40 },
      felt: { cx: w / 2, cy: h * 0.48, rx: w * 0.47, ry: h * 0.47, oval: true },
    };
  }

  private feltKey = '';
  private drawFelt(g: Geo) {
    // 정적인 천은 텍스처로 캐시 (매 프레임 큰 반투명 타원을 다시 칠하지 않도록)
    const key = [this.w, this.h, g.felt.cx, g.felt.cy, g.felt.rx, g.felt.ry, g.felt.oval].map((n) => Math.round(Number(n))).join(',');
    if (key === this.feltKey) return;
    this.feltKey = key;
    this.feltLayer.cacheAsTexture(false);
    const f = this.felt.clear();
    f.rect(0, 0, this.w, this.h).fill(PALETTE.ink);
    if (g.felt.oval) {
      f.ellipse(g.felt.cx, g.felt.cy + 8, g.felt.rx, g.felt.ry).fill({ color: 0x000000, alpha: 0.35 });
      f.ellipse(g.felt.cx, g.felt.cy, g.felt.rx, g.felt.ry).fill(PALETTE.felt).stroke({ width: 10, color: PALETTE.feltEdge });
      f.ellipse(g.felt.cx, g.felt.cy, g.felt.rx - 16, g.felt.ry - 16).stroke({ width: 1.5, color: PALETTE.brass, alpha: 0.25 });
      f.ellipse(g.felt.cx, g.felt.cy, g.felt.rx * 0.55, g.felt.ry * 0.45).fill({ color: PALETTE.feltLight, alpha: 0.45 });
    } else {
      f.ellipse(g.felt.cx, g.felt.cy, g.felt.rx, g.felt.ry).fill({ color: PALETTE.feltLight, alpha: 0.5 });
      f.ellipse(g.felt.cx, g.felt.cy, g.felt.rx * 0.6, g.felt.ry * 0.6).fill({ color: PALETTE.feltLight, alpha: 0.4 });
    }
    this.feltLayer.cacheAsTexture(true);
    this.dirty = true;
  }

  // ─────────────────────────── 동기화 (애니메이션 없음) ───────────────────────────
  sync(v: View) {
    this.view = v;
    this.dirty = true;
    const opps = v.players.filter((p) => p.id !== this.me);
    const g = (this.geo = this.computeGeo(opps.length));
    this.drawFelt(g);

    // 좌석
    const ids = new Set(opps.map((p) => p.id));
    for (const [id, s] of this.seats) if (!ids.has(id)) {
      s.destroy({ children: true });
      this.seats.delete(id);
    }
    opps.forEach((p, i) => {
      let s = this.seats.get(p.id);
      if (!s) {
        s = new Seat();
        s.cursor = 'help';
        s.on('pointerover', () => this.showSeatTooltip(p.id));
        s.on('pointerout', () => {
          this.tooltip.visible = false;
          this.dirty = true;
        });
        this.seats.set(p.id, s);
        this.layerSeats.addChild(s);
      }
      s.configure(g.seatStyle, g.seatW, g.avatarR, g.miniW, g.font);
      s.setData(this.seatData(p.id));
      s.position.set(g.seats[i].x, g.seats[i].y);
      s.alpha = 1;
      s.scale.set(1);
    });

    // 가운데 카드
    this.card.resize(g.cardW, g.cardH);
    this.card.position.set(g.center.x, g.center.y);
    this.card.rotation = 0;
    this.card.scale.set(1);
    this.card.visible = v.currentCard != null;
    this.card.alpha = 1;
    if (v.currentCard != null) this.card.setFace(v.currentCard, !v.currentCardHidden && v.currentCard > 0);
    this.pile.setR(g.chipR);
    this.pile.setCount(v.pileTokens);
    this.pile.position.set(g.center.x + g.cardW * 0.5 - g.chipR * 0.3, g.center.y - g.cardH * 0.5 + g.chipR * 0.6);
    this.pile.visible = v.currentCard != null;

    // 덱
    this.deck.position.set(g.deck.x, g.deck.y);
    this.deckCards.forEach((c, i) => {
      c.resize(g.cardW * g.deckScale, g.cardH * g.deckScale);
      c.position.set(-i * 2, -i * 3);
      c.visible = v.deckSize > i;
    });
    this.deckLabel.text = `남은 카드 ${v.deckSize}`;
    this.deckLabel.style.fontSize = Math.max(12, g.font - 1);
    this.deckLabel.position.set(0, (g.cardH * g.deckScale) / 2 + 8);

    // 내 손패 (모바일은 화면 아래에 붙이고, 남는 공간은 가운데 카드에 준다)
    const me = v.players.find((p) => p.id === this.me);
    this.hand.configure(g.hand.miniW, g.hand.maxW);
    this.hand.render(me?.cards ?? []);
    this.anchorHand();
    this.layoutHand();
    this.drawHandGlow(v.currentPlayerId === this.me ? 1 : 0);
  }

  /** 모바일: 손패 상자를 바닥에 붙이고 카드/덱 세로 위치를 남는 공간 가운데로 */
  private anchorHand() {
    const g = this.geo;
    if (this.mode !== 'portrait' && this.mode !== 'landscape') return;
    const boxH = Math.max(this.hand.contentH, this.hand.ch) + 42;
    g.hand.y = this.h - 10 - boxH + 30;
    if (this.mode === 'portrait') {
      const seatBottom = Math.max(...[...this.seats.values()].map((s) => s.y + s.blockHeight), 60);
      const top = seatBottom + 12;
      const bottom = g.hand.y - 30 - 28; // 덱 라벨 여유
      const cardH = Math.max(120, Math.min(200, (bottom - top) * 0.82));
      g.cardH = cardH;
      g.cardW = Math.round(cardH * 0.72);
      const cy = (top + bottom) / 2;
      g.center = { x: this.w / 2 + g.cardW * 0.32, y: cy };
      g.deck = { x: this.w / 2 - g.cardW * 0.78, y: cy + 4 };
      g.felt.cy = cy;
    }
    // 가운데 카드·칩·덱 위치 재적용
    this.card.resize(g.cardW, g.cardH);
    this.card.position.set(g.center.x, g.center.y);
    this.pile.position.set(g.center.x + g.cardW * 0.5 - g.chipR * 0.3, g.center.y - g.cardH * 0.5 + g.chipR * 0.6);
    this.deck.position.set(g.deck.x, g.deck.y);
    this.deckCards.forEach((c) => c.resize(g.cardW * g.deckScale, g.cardH * g.deckScale));
    this.deckLabel.position.set(0, (g.cardH * g.deckScale) / 2 + 8);
    this.drawFelt(g);
  }

  private layoutHand() {
    const g = this.geo;
    const cw = this.hand.contentW;
    const x = g.hand.centered ? (g.hand.maxW === this.w - 32 ? 16 + (g.hand.maxW - cw) / 2 : g.hand.x + (g.hand.maxW - cw) / 2) : g.hand.x;
    const hx = this.mode === 'desktop' || this.mode === 'wide' ? (this.w - cw) / 2 : x;
    this.hand.position.set(hx, g.hand.y);
    this.handLabel.style.fontSize = Math.max(12, g.font - 1);
    const count = this.hand.cards.length;
    const me = this.view?.players.find((p) => p.id === this.me);
    const pts = me ? cardPoints(me.cards) : 0;
    this.handLabel.text = count ? `내 카드 ${count}장 · 카드 점수 ${pts}` : '내 카드 — 아직 없음';
    this.handLabel.anchor.set(0.5, 1);
    const centerX = count ? hx + cw / 2 : (this.mode === 'landscape' ? g.hand.x + g.hand.maxW / 2 : this.w / 2);
    this.handLabel.position.set(centerX, g.hand.y - 8);
  }

  private drawHandGlow(alpha: number) {
    const g = this.geo;
    const x0 = this.mode === 'landscape' ? g.hand.x - 4 : this.mode === 'portrait' ? 8 : (this.w - g.hand.maxW) / 2 - 16;
    const w = this.mode === 'portrait' ? this.w - 16 : g.hand.maxW + (this.mode === 'landscape' ? 8 : 32);
    const y0 = g.hand.y - 30;
    const hgt = Math.max(this.hand.contentH, this.hand.ch) + 42;
    this.handGlow.clear();
    this.handGlow.roundRect(x0, y0, w, hgt, 14).fill({ color: PALETTE.brass, alpha: 0.07 * alpha }).stroke({ width: 2, color: PALETTE.brass, alpha: 0.55 * alpha });
    this.handGlowAlpha = alpha;
  }
  private handGlowAlpha = 0;

  private seatData(id: string) {
    const v = this.view!;
    const p = v.players.find((x) => x.id === id)!;
    const showScore = this.opts.showRealTimeScore && p.tokens >= 0;
    return {
      id: p.id,
      nickname: p.nickname,
      tokens: p.tokens,
      cards: p.cards,
      isBot: p.isBot,
      score: showScore ? playerScore(p) : this.opts.showRealTimeScore ? null : null,
      isTurn: v.currentPlayerId === p.id,
    };
  }

  private showSeatTooltip(id: string) {
    if (this.mode !== 'desktop' && this.mode !== 'wide') return;
    const s = this.seats.get(id);
    const p = this.view?.players.find((x) => x.id === id);
    if (!s || !p) return;
    const runs = runsOf(p.cards).map((r) => (r.length > 1 ? `${r[0]}–${r[r.length - 1]}` : `${r[0]}`));
    const lines = [
      `${p.nickname}${p.isBot ? ` · 난이도 ${p.difficulty === 'medium' ? '중' : p.difficulty === 'hard' ? '상' : '최상'}` : ''}`,
      `카드 점수 ${cardPoints(p.cards)} (${p.cards.length}장)`,
      runs.length ? `묶음: ${runs.join(', ')}` : '묶음: 없음',
      p.tokens >= 0 ? `칩 ${p.tokens}개 → 현재 ${playerScore(p)}점` : '칩: 비공개',
    ];
    this.tooltipText.text = lines.join('\n');
    const pad = 10;
    const bw = this.tooltipText.width + pad * 2;
    const bh = this.tooltipText.height + pad * 2;
    this.tooltipBg.clear().roundRect(0, 0, bw, bh, 8).fill({ color: PALETTE.ink, alpha: 0.96 }).stroke({ width: 1, color: PALETTE.brass, alpha: 0.6 });
    this.tooltipText.position.set(pad, pad);
    const gp = this.root.toLocal(s.toGlobal({ x: 0, y: s.blockHeight }));
    this.tooltip.position.set(Math.min(this.w - bw - 8, Math.max(8, gp.x - bw / 2)), Math.min(this.h - bh - 8, gp.y + 8));
    this.tooltip.visible = true;
    this.dirty = true;
  }

  // ─────────────────────────── 좌표 헬퍼 ───────────────────────────
  private local(node: Container, p: Pt): Pt {
    const gp = node.toGlobal(p);
    return this.root.toLocal(gp);
  }
  private seatOrigin(id: string): Pt {
    if (id === this.me) return this.geo.myOrigin;
    const s = this.seats.get(id);
    return s ? this.local(s, s.chipOrigin()) : this.geo.myOrigin;
  }
  private takeTarget(id: string): Pt {
    if (id === this.me) {
      const cw = this.hand.contentW;
      return { x: this.hand.position.x + cw + this.hand.cw * 0.7, y: this.hand.position.y + this.hand.ch / 2 };
    }
    const s = this.seats.get(id);
    return s ? this.local(s, s.handTarget()) : this.geo.myOrigin;
  }

  // ─────────────────────────── 연출 ───────────────────────────
  async animGameStart(v: View) {
    this.sync(v);
    this.card.visible = false;
    this.pile.visible = false;
    const seats = [...this.seats.values()];
    if (isReduced()) {
      this.root.alpha = 0;
      await play(gsap.to(this.root, { alpha: 1, duration: MOTION.reducedFade }));
      return;
    }
    const tl = gsap.timeline();
    seats.forEach((s, i) => {
      tl.fromTo(s, { alpha: 0, y: s.y - 16 }, { alpha: 1, y: s.y, duration: MOTION.seatIn, ease: EASE.out }, i * MOTION.seatStagger);
    });
    this.deckCards.forEach((c, i) => {
      tl.fromTo(c, { x: (i - 1) * 40, rotation: (i - 1) * 0.3 }, { x: -i * 2, rotation: 0, duration: MOTION.shuffle, ease: 'elastic.out(1, 0.6)' }, 0.05 * i);
    });
    await play(tl);
  }

  async animReveal(v: View) {
    const g = this.geo;
    this.view = v;
    this.updateDeck(v.deckSize);
    if (v.currentCard == null) return;
    const card = this.card;
    card.setFace(v.currentCard, false);
    card.visible = true;
    this.pile.setCount(0);
    this.pile.visible = true;
    if (isReduced()) {
      card.position.set(g.center.x, g.center.y);
      card.setFace(v.currentCard, !v.currentCardHidden && v.currentCard > 0);
      card.alpha = 0;
      await play(gsap.to(card, { alpha: 1, duration: MOTION.reducedFade }));
      return;
    }
    card.position.set(g.deck.x, g.deck.y);
    card.scale.set(g.deckScale);
    card.rotation = -0.12;
    card.alpha = 1;
    const tl = gsap.timeline();
    tl.to(card, { x: g.center.x, y: g.center.y, rotation: 0, duration: MOTION.cardSlide, ease: EASE.out }, 0);
    tl.to(card.scale, { x: 1, y: 1, duration: MOTION.cardSlide, ease: EASE.out }, 0);
    if (!v.currentCardHidden && v.currentCard > 0) {
      tl.to(card.scale, { x: 0, duration: MOTION.cardFlipHalf, ease: EASE.flipIn });
      tl.call(() => card.setFace(v.currentCard, true));
      tl.to(card.scale, { x: 1, duration: MOTION.cardFlipOut, ease: EASE.flipOut });
    } else {
      tl.to(card, { rotation: 0.05, duration: 0.08, yoyo: true, repeat: 3 });
    }
    await play(tl);
  }

  private updateDeck(n: number) {
    this.deckCards.forEach((c, i) => (c.visible = n > i));
    this.deckLabel.text = `남은 카드 ${n}`;
  }

  async animChip(playerId: string, after: View) {
    const g = this.geo;
    const from = this.seatOrigin(playerId);
    const before = this.view;
    // 좌석 칩 숫자는 즉시 감소 (입력 반응)
    this.view = after;
    this.refreshSeat(playerId);
    const top = this.pile.topLocal();
    const to = { x: this.pile.x + top.x, y: this.pile.y + top.y };
    const chip = makeChip(g.chipR);
    chip.position.set(from.x, from.y);
    this.layerFx.addChild(chip);
    if (isReduced()) {
      chip.destroy();
      this.pile.setCount(after.pileTokens);
      return;
    }
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 };
    const tl = gsap.timeline();
    tl.to(chip, { x: mid.x, duration: MOTION.chipArcUp, ease: 'none' }, 0)
      .to(chip, { y: mid.y, duration: MOTION.chipArcUp, ease: EASE.arcUp }, 0)
      .to(chip, { x: to.x, duration: MOTION.chipArcDown, ease: 'none' }, MOTION.chipArcUp)
      .to(chip, { y: to.y, duration: MOTION.chipArcDown, ease: EASE.arcDown }, MOTION.chipArcUp)
      .call(() => {
        chip.destroy();
        this.pile.setCount(after.pileTokens);
      })
      .fromTo(this.pile.scale, { x: 1.18, y: 1.18 }, { x: 1, y: 1, duration: MOTION.chipLand, ease: EASE.land });
    void before;
    await play(tl);
  }

  async animTake(playerId: string, card: number, tokens: number, after: View) {
    const g = this.geo;
    const to = this.takeTarget(playerId);
    const before = this.view?.players.find((p) => p.id === playerId);
    const delta = before ? cardPoints([...before.cards, card]) - cardPoints(before.cards) - (before.tokens >= 0 ? tokens : 0) : 0;
    if (isReduced()) {
      this.view = after;
      this.card.visible = false;
      this.pile.setCount(0);
      this.refreshAll(playerId, card);
      this.popText(to, delta, tokens);
      return;
    }
    const tl = gsap.timeline();
    const miniScale = (playerId === this.me ? g.hand.miniW : g.miniW) / g.cardW;
    tl.to(this.card, { x: to.x, y: to.y, rotation: 0.08, duration: MOTION.takeFly, ease: EASE.inOut }, 0);
    tl.to(this.card.scale, { x: miniScale, y: miniScale, duration: MOTION.takeFly, ease: EASE.inOut }, 0);
    // 칩 흐름
    const chipTarget = this.seatOrigin(playerId);
    const n = Math.min(tokens, 10);
    this.pile.setCount(0);
    for (let i = 0; i < n; i++) {
      const c = makeChip(g.chipR);
      c.position.set(this.pile.x, this.pile.y - i * g.chipR * 0.3);
      this.layerFx.addChild(c);
      tl.to(c, { x: chipTarget.x, y: chipTarget.y, alpha: 0.2, duration: MOTION.takeFly * 0.9, ease: EASE.inOut, onComplete: () => c.destroy() }, 0.04 + i * MOTION.takeChipStagger);
    }
    await play(tl);
    this.card.visible = false;
    this.card.scale.set(1);
    this.card.rotation = 0;
    this.view = after;
    this.refreshAll(playerId, card);
    this.popText(to, delta, tokens);
  }

  private refreshAll(playerId: string, newCard?: number) {
    if (!this.view) return;
    if (playerId === this.me) {
      const me = this.view.players.find((p) => p.id === this.me);
      this.hand.render(me?.cards ?? [], newCard);
      this.anchorHand();
      this.layoutHand();
      this.drawHandGlow(this.handGlowAlpha);
      const n = newCard != null ? this.hand.nodeFor(newCard) : undefined;
      if (n && !isReduced()) gsap.fromTo(n.scale, { x: 1.35, y: 1.35 }, { x: 1, y: 1, duration: MOTION.newCardGlow, ease: EASE.pop });
    } else {
      this.refreshSeat(playerId, newCard);
    }
  }

  private refreshSeat(id: string, newCard?: number) {
    if (id === this.me || !this.view) return;
    const s = this.seats.get(id);
    if (!s) return;
    s.setData(this.seatData(id));
    if (newCard != null) {
      s.hand.render(s.data.cards, newCard);
      const n = s.hand.nodeFor(newCard);
      if (n && !isReduced()) gsap.fromTo(n.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: MOTION.newCardGlow, ease: EASE.pop });
    }
  }

  private popText(at: Pt, delta: number, tokens: number) {
    const txt = new Text({
      text: `${delta >= 0 ? '+' : ''}${delta}점${tokens > 0 ? `  칩 +${tokens}` : ''}`,
      style: { fontFamily: FONT_UI, fontWeight: '800', fontSize: Math.max(14, this.geo.font + 2), fill: delta <= 0 ? PALETTE.good : PALETTE.brassLight, stroke: { color: PALETTE.ink, width: 4 } },
    });
    txt.anchor.set(0.5);
    txt.position.set(Math.min(this.w - 70, Math.max(70, at.x)), Math.max(16, at.y - 14));
    this.layerFx.addChild(txt);
    if (isReduced()) {
      gsap.to(txt, { alpha: 0, delay: 0.9, duration: 0.2, onComplete: () => txt.destroy() });
      return;
    }
    gsap.fromTo(txt, { y: txt.y + 10, alpha: 0 }, { y: txt.y - 26, alpha: 1, duration: MOTION.scorePop * 0.45, ease: EASE.out });
    gsap.to(txt, { alpha: 0, delay: MOTION.scorePop + 0.25, duration: 0.25, onComplete: () => txt.destroy() });
  }

  async animTurn(v: View) {
    this.view = v;
    const tl = gsap.timeline();
    for (const [id, s] of this.seats) {
      const on = v.currentPlayerId === id;
      if (on && s.ringAlpha < 1) {
        const o = { a: s.ringAlpha };
        tl.to(o, { a: 1, duration: isReduced() ? 0.01 : MOTION.turnRing, onUpdate: () => s.drawRing(o.a) }, 0);
        if (!isReduced()) tl.fromTo(s.scale, { x: 1.06, y: 1.06 }, { x: 1, y: 1, duration: MOTION.turnRing, ease: EASE.pop }, 0);
      } else if (!on && s.ringAlpha > 0) {
        const o = { a: s.ringAlpha };
        tl.to(o, { a: 0, duration: isReduced() ? 0.01 : MOTION.turnRing * 0.7, onUpdate: () => s.drawRing(o.a) }, 0);
      }
    }
    const mine = v.currentPlayerId === this.me ? 1 : 0;
    if (mine !== this.handGlowAlpha) {
      const o = { a: this.handGlowAlpha };
      tl.to(o, { a: mine, duration: isReduced() ? 0.01 : MOTION.turnRing, onUpdate: () => this.drawHandGlow(o.a) }, 0);
    }
    await play(tl);
  }

  async animHiddenFlip(card: number) {
    const c = this.card;
    if (isReduced()) {
      c.setFace(card, true);
      return;
    }
    const tl = gsap.timeline();
    tl.to(c, { rotation: 0.07, duration: MOTION.hiddenWobble / 4, yoyo: true, repeat: 3, ease: 'sine.inOut' });
    tl.to(c.scale, { x: 0, duration: MOTION.hiddenFlip / 2, ease: EASE.flipIn });
    tl.call(() => c.setFace(card, true));
    tl.to(c.scale, { x: 1, duration: MOTION.hiddenFlip / 2, ease: EASE.flipOut });
    tl.call(() => this.sparkle(c.x, c.y));
    await play(tl);
  }

  /** 히든 카드 가져가기 입력 즉시 반응 (상태 변화 없는 로컬 연출) */
  pressFeedback() {
    if (isReduced()) return;
    gsap.fromTo(this.card, { y: this.geo.center.y - 10 }, { y: this.geo.center.y, duration: 0.25, ease: EASE.land });
  }

  private sparkle(x: number, y: number) {
    for (let i = 0; i < 14; i++) {
      const p = new Graphics().star(0, 0, 4, 5, 2).fill(PALETTE.brassLight);
      p.position.set(x, y);
      this.layerFx.addChild(p);
      const a = (Math.PI * 2 * i) / 14;
      const d = 70 + Math.random() * 50;
      gsap.to(p, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, rotation: 2, duration: MOTION.sparkle, ease: EASE.out, onComplete: () => p.destroy() });
    }
  }

  /** 서버 거절 시 되돌리기 */
  async animRollback(kind: 'pass' | 'take', before: View) {
    const g = this.geo;
    if (!isReduced()) {
      if (kind === 'pass') {
        const chip = makeChip(g.chipR);
        chip.position.set(this.pile.x, this.pile.y);
        this.layerFx.addChild(chip);
        this.pile.setCount(Math.max(0, this.pile.count - 1));
        await play(gsap.to(chip, { x: g.myOrigin.x, y: g.myOrigin.y, duration: MOTION.rollback, ease: EASE.inOut, onComplete: () => chip.destroy() }));
      } else {
        this.card.visible = true;
        this.card.setFace(before.currentCard, !before.currentCardHidden);
        const from = this.takeTarget(this.me);
        this.card.position.set(from.x, from.y);
        this.card.scale.set(0.3);
        const tl = gsap.timeline();
        tl.to(this.card, { x: g.center.x, y: g.center.y, duration: MOTION.rollback, ease: EASE.out }, 0);
        tl.to(this.card.scale, { x: 1, y: 1, duration: MOTION.rollback, ease: EASE.out }, 0);
        await play(tl);
      }
    }
    this.sync(before);
    if (!isReduced()) await play(gsap.fromTo(this.card, { x: g.center.x - 8 }, { x: g.center.x, duration: 0.3, ease: 'elastic.out(1, 0.3)' }));
  }

  async animGameEnd() {
    if (isReduced()) return;
    const tl = gsap.timeline();
    for (const s of this.seats.values()) tl.to(s, { alpha: 0.55, duration: MOTION.endBanner * 0.5 }, 0);
    tl.to(this.deck, { alpha: 0.3, duration: MOTION.endBanner * 0.5 }, 0);
    await play(tl);
  }
}
