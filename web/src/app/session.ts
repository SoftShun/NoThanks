/**
 * 게임 세션 컨트롤러.
 * - 목 서버(Colyseus 흉내)에 접속, 메시지·상태를 스토어와 애니메이션 큐로 연결
 * - 낙관적 반응: 버튼 → 즉시 예측 이벤트 연출(같은 프레임) → 서버 이벤트로 확인 / ack 거절 시 롤백
 * - 큐가 비면 서버 상태와 표시 상태를 해시로 비교해 어긋나면 스냅(재동기화)
 */
import { MockClient, MockServer, type RoomConnection } from '../net/colyseusLike';
import { NoThanksRoom } from '../net/NoThanksRoom';
import {
  ROOM_NAME,
  applyEvent,
  viewFromState,
  viewHash,
  type AckMessage,
  type RoomState,
  type SeqEvent,
  type TableView,
} from '../net/protocol';
import { AnimationQueue } from '../anim/queue';
import { useStore } from './store';
import type { TableScene } from '../table/TableView';
import { sfx, unlockAudio } from '../fx/sound';
import { haptic } from '../fx/haptics';
import { cardPoints } from '../engine/rules';
import type { Difficulty, GameSettings } from '../engine/types';

type Pending = {
  actionId: string;
  kind: 'pass' | 'take';
  before: TableView;
  predicted: SeqEvent['type'] | null;
  confirmed: boolean;
  held: SeqEvent[];
};

let actionCounter = 0;
const newActionId = () => `c${Date.now().toString(36)}_${++actionCounter}`;

class GameSession {
  server = new MockServer<RoomState>(() => new NoThanksRoom());
  conn: RoomConnection<RoomState> | null = null;
  queue = new AnimationQueue();
  table: TableScene | null = null;
  pending: Pending | null = null;
  private expectedSeq = 1;
  private needSnap = false;

  constructor() {
    this.queue.onIdle = () => {
      useStore.getState().set({ animating: false });
      this.reconcile();
    };
  }

  get me() {
    return this.conn?.sessionId ?? '';
  }

  private connecting = false;
  async connect(nickname: string) {
    if (this.connecting || this.conn) return;
    this.connecting = true;
    const prefs = useStore.getState().prefs;
    this.server.setLatency(prefs.latency);
    const client = new MockClient(this.server);
    const conn = await client.joinOrCreate(ROOM_NAME, { nickname, botSpeed: prefs.botSpeed });
    this.conn = conn;
    const st = useStore.getState();
    st.set({ sessionId: conn.sessionId, room: conn.state, screen: 'lobby' });
    if (this.table) this.table.me = conn.sessionId;
    conn.onStateChange((s) => this.onState(s));
    conn.onMessage('event', (e: SeqEvent) => this.onEvent(e));
    conn.onMessage('ack', (a: AckMessage) => this.onAck(a));
    conn.onMessage('toast', (t: { message: string }) => useStore.getState().toast(t.message));
    this.expectedSeq = conn.state.lastSeq + 1;
    // 기본 구성: 봇 2개(중/상) — 바로 시작해 볼 수 있게
    if (conn.state.players.length === 1) {
      this.send('addBot', { difficulty: 'medium' });
      this.send('addBot', { difficulty: 'hard' });
    }
  }

  setLatency(ms: number) {
    this.server.setLatency(ms);
  }
  setBotSpeed(v: number) {
    const r = this.server.room as NoThanksRoom | null;
    if (r) r.botSpeed = v;
  }

  attachTable(t: TableScene | null) {
    this.table = t;
    if (t) {
      t.me = this.me;
      const v = useStore.getState().view;
      if (v) t.sync(v);
    }
  }

  // ───────────── 송신 ─────────────
  send(type: string, payload: Record<string, unknown> = {}) {
    const actionId = newActionId();
    this.conn?.send(type, { actionId, ...payload });
    return actionId;
  }
  start() {
    unlockAudio();
    sfx('tap');
    this.send('start');
  }
  updateSettings(s: Partial<GameSettings>) {
    this.send('updateSettings', { settings: s });
  }
  addBot(d: Difficulty) {
    this.send('addBot', { difficulty: d });
  }
  removeBot(id: string) {
    this.send('removeBot', { botId: id });
  }
  setNickname(n: string) {
    this.send('setNickname', { nickname: n });
  }
  returnToLobby() {
    unlockAudio();
    this.send('returnToLobby');
  }

  canAct(): boolean {
    const st = useStore.getState();
    return (
      st.screen === 'game' &&
      !!st.view &&
      st.view.currentPlayerId === this.me &&
      !this.pending &&
      !st.revealing &&
      !this.queue.busy &&
      st.view.currentCard != null
    );
  }

  /** 입력: 패스(칩 걸기) / 가져가기 */
  act(kind: 'pass' | 'take', eventTimeStamp?: number) {
    unlockAudio();
    const st = useStore.getState();
    const v = st.view;
    if (!v || !this.canAct()) {
      if (v && v.currentPlayerId !== this.me && st.screen === 'game') {
        sfx('error', { volume: 0.5 });
        haptic('error');
      }
      return;
    }
    const me = v.players.find((p) => p.id === this.me)!;
    // 칩이 없으면 패스 = 강제 가져가기 (서버 규칙). UI 는 가져가기만 노출하지만 방어적으로 처리
    if (kind === 'pass' && me.tokens === 0) kind = 'take';
    const actionId = newActionId();
    const hiddenCard = v.currentCardHidden;
    let predicted: SeqEvent | null = null;
    if (kind === 'pass') {
      const idx = v.players.findIndex((p) => p.id === this.me);
      const next = v.players[(idx + 1) % v.players.length].id;
      predicted = { type: 'chip_placed', playerId: this.me, pileTokens: v.pileTokens + 1, nextPlayerId: next, auto: false, seq: v.lastSeq, t: Date.now(), actionId };
    } else if (!hiddenCard && v.currentCard != null && v.currentCard > 0) {
      predicted = { type: 'card_taken', playerId: this.me, card: v.currentCard, tokens: v.pileTokens, forced: false, auto: false, seq: v.lastSeq, t: Date.now(), actionId };
    }
    this.pending = { actionId, kind, before: v, predicted: predicted?.type ?? null, confirmed: false, held: [] };
    st.set({ pending: kind });

    // 1) 즉시 반응 (같은 프레임): 소리·햅틱·연출 시작
    if (predicted) {
      const ev = predicted;
      const next = { ...applyEvent(v, ev, this.me), lastSeq: v.lastSeq };
      if (ev.type === 'card_taken') {
        sfx('take');
        if (ev.tokens > 0) sfx('coins', { volume: 0.6 });
        haptic('take');
      } else {
        sfx('chip');
        haptic('chip');
      }
      this.queue.runNow({
        label: `predict:${ev.type}`,
        run: async () => {
          useStore.getState().set({ view: next, animating: true });
          if (this.table) {
            if (ev.type === 'chip_placed') await this.table.animChip(this.me, next);
            else if (ev.type === 'card_taken') await this.table.animTake(this.me, ev.card, ev.tokens, next);
          }
        },
      });
    } else {
      // 히든 카드: 결과를 모르므로 로컬 반응만
      sfx('tap');
      haptic('tap');
      this.table?.pressFeedback();
      st.set({ revealing: true });
    }
    // 2) 입력 → 첫 프레임 반응 시간 측정
    const t0 = eventTimeStamp ?? performance.now();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => useStore.getState().recordInput(performance.now() - t0));
    });
    // 3) 서버 전송
    this.conn?.send(kind, { actionId });
  }

  // ───────────── 수신 ─────────────
  private onState(s: RoomState) {
    const st = useStore.getState();
    st.set({ room: s });
    if (s.phase === 'lobby' && st.screen !== 'lobby' && st.screen !== 'connecting' && !this.queue.busy) {
      st.set({ screen: 'lobby', view: null, results: [], log: [] });
    }
    if (s.phase === 'playing' && st.screen === 'lobby' && !this.queue.busy && s.lastSeq > 0 && this.expectedSeq > s.lastSeq) {
      // 재접속 등으로 이벤트 없이 게임 중인 경우
      this.snapTo(s);
      st.set({ screen: 'game' });
    }
    if (this.table) this.table.opts = { showOpponentTokens: s.settings.showOpponentTokens, showRealTimeScore: s.settings.showRealTimeScore };
    if (!this.queue.busy) this.reconcile();
  }

  private onEvent(e: SeqEvent) {
    if (e.seq !== this.expectedSeq) {
      // 시퀀스 공백: 진행 중 연출을 비우고 다음 상태로 스냅
      console.warn('[seq gap]', this.expectedSeq, '→', e.seq);
      this.queue.clear();
      this.needSnap = true;
      this.send('resync');
    }
    this.expectedSeq = e.seq + 1;
    const p = this.pending;
    if (p) {
      if (e.actionId === p.actionId && p.predicted === e.type && !p.confirmed) {
        // 예측 확인: 이미 연출함 → 표시 상태의 seq 만 맞춘다
        p.confirmed = true;
        this.queue.push({
          label: `confirm:${e.type}`,
          run: () => {
            const v = useStore.getState().view;
            if (v) useStore.getState().set({ view: { ...v, lastSeq: e.seq } });
            this.logEvent(e);
          },
        });
        return;
      }
      if (!p.confirmed && e.actionId !== p.actionId) {
        // 내 입력의 결과를 아직 모름 → 보류 (예: 턴 시간 초과 자동 패스와 경합)
        p.held.push(e);
        return;
      }
    }
    this.enqueueEvent(e);
  }

  private onAck(a: AckMessage) {
    const p = this.pending;
    if (!p || a.actionId !== p.actionId) {
      if (!a.ok && a.error) useStore.getState().toast(humanError(a.error), 'error');
      return;
    }
    this.pending = null;
    useStore.getState().set({ pending: null });
    if (a.ok) {
      // 보류된 이벤트는 서버에서 내 행동보다 먼저 일어난 것. 내 차례 알림(turn_changed)은 이미 반영된 내용이라 버리고,
      // 그 밖의 것이 있으면(이론상 드묾) 큐가 빈 뒤 서버 상태로 스냅
      const rest = p.held.filter((e) => !(e.type === 'turn_changed' && e.playerId === this.me));
      if (rest.length) this.needSnap = true;
      return;
    }
    // 거절 → 롤백
    useStore.getState().set({ revealing: false });
    sfx('error');
    haptic('error');
    useStore.getState().toast(humanError(a.error ?? '거절됨'), 'error');
    if (p.predicted) {
      this.queue.push({
        label: 'rollback',
        run: async () => {
          useStore.getState().set({ view: p.before });
          await this.table?.animRollback(p.kind, p.before);
        },
      });
    }
    p.held.forEach((e) => this.enqueueEvent(e));
  }

  private enqueueEvent(e: SeqEvent) {
    this.queue.push({ label: e.type, run: () => this.playEvent(e) });
    useStore.getState().set({ animating: true });
  }

  private async playEvent(e: SeqEvent) {
    const st = useStore.getState();
    const prev = st.view ?? (st.room ? viewFromState(st.room) : null);
    if (!prev) return;
    const next = applyEvent(prev, e, this.me);
    const t = this.table;
    this.logEvent(e);
    switch (e.type) {
      case 'game_started': {
        st.set({ screen: 'game', view: next, results: [], log: [] });
        sfx('shuffle');
        if (t) await t.animGameStart(next);
        return;
      }
      case 'card_revealed':
        st.set({ view: next });
        sfx('flip', { rate: 0.9 + Math.random() * 0.2 });
        if (t) await t.animReveal(next);
        return;
      case 'chip_placed':
        st.set({ view: next });
        sfx('chip', { rate: 0.95 + Math.random() * 0.15, volume: 0.7 });
        if (t) await t.animChip(e.playerId, next);
        return;
      case 'card_taken':
        st.set({ view: next, revealing: false });
        sfx('take', { volume: e.playerId === this.me ? 1 : 0.6 });
        if (e.tokens > 0) sfx('coins', { volume: 0.5 });
        if (e.playerId === this.me) haptic('take');
        if (t) await t.animTake(e.playerId, e.card, e.tokens, next);
        return;
      case 'hidden_flipped':
        st.set({ view: next, revealing: true });
        sfx('reveal');
        if (t) await t.animHiddenFlip(e.card);
        return;
      case 'turn_changed': {
        const wasMine = prev.currentPlayerId === this.me;
        st.set({ view: next });
        if (next.currentPlayerId === this.me && !wasMine) {
          sfx('turn');
          haptic('turn');
        }
        if (t) await t.animTurn(next);
        return;
      }
      case 'game_ended': {
        st.set({ view: next });
        if (t) await t.animGameEnd();
        const meWon = e.results[0]?.id === this.me;
        sfx(meWon ? 'win' : 'turn');
        if (meWon) haptic('win');
        st.set({ screen: 'results', results: e.results });
        return;
      }
    }
  }

  private logEvent(e: SeqEvent) {
    const st = useStore.getState();
    const name = (id: string) => (id === this.me ? '나' : st.view?.players.find((p) => p.id === id)?.nickname ?? '?');
    let text = '';
    switch (e.type) {
      case 'game_started':
        text = `게임 시작 — 제거 ${e.removedCount}장, 칩 ${e.startTokens}개씩`;
        break;
      case 'card_revealed':
        text = e.card == null ? '덱 소진' : e.hidden ? '히든 카드 등장 (?)' : `카드 ${e.card} 공개`;
        break;
      case 'chip_placed':
        text = `${name(e.playerId)}: 칩 걸기${e.auto ? ' (시간 초과)' : ''} → 칩 ${e.pileTokens}`;
        break;
      case 'card_taken': {
        const p = st.view?.players.find((x) => x.id === e.playerId);
        const d = p ? cardPoints([...p.cards.filter((c) => c !== e.card), e.card]) - cardPoints(p.cards.filter((c) => c !== e.card)) : 0;
        text = `${name(e.playerId)}: ${e.card} 가져감 (+칩 ${e.tokens}, 카드 ${d >= 0 ? '+' : ''}${d})${e.forced ? ' · 칩 없음' : ''}${e.auto ? ' · 시간 초과' : ''}`;
        break;
      }
      case 'hidden_flipped':
        text = `${name(e.playerId)}: 히든 카드 공개 → ${e.card}`;
        break;
      case 'game_ended':
        text = `게임 종료 — 1위 ${e.results[0]?.nickname ?? ''}`;
        break;
      default:
        return;
    }
    st.pushLog({ seq: e.seq, text });
  }

  /** 큐가 비었을 때 서버 상태와 표시 상태 비교 */
  private reconcile() {
    const st = useStore.getState();
    const room = st.room;
    if (!room || this.pending || this.queue.busy) return;
    if (st.screen !== 'game') return;
    const v = st.view;
    if (this.needSnap || (v && room.lastSeq === v.lastSeq && viewHash(v) !== viewHash(viewFromState(room)))) {
      if (!this.needSnap) console.warn('[reconcile] 표시 상태가 서버와 달라 스냅합니다.', v ? viewHash(v) : '', viewHash(viewFromState(room)));
      this.needSnap = false;
      this.snapTo(room);
    }
  }

  private snapTo(s: RoomState) {
    const v = viewFromState(s);
    useStore.getState().set({ view: v, revealing: false });
    this.table?.sync(v);
    this.expectedSeq = s.lastSeq + 1;
  }
}

function humanError(e: string): string {
  const map: Record<string, string> = {
    'Not your turn': '내 차례가 아닙니다.',
    'Game not started': '게임이 시작되지 않았습니다.',
    '카드 공개 중입니다.': '카드를 공개하는 중입니다.',
  };
  return map[e] ?? e;
}

export const session = new GameSession();
// 디버그·측정용
if (typeof window !== 'undefined') (window as unknown as { __session: GameSession }).__session = session;
if (typeof window !== 'undefined') (window as unknown as { __store: typeof useStore }).__store = useStore;
