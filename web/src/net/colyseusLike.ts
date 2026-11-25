/**
 * Colyseus Room/Client 구조를 흉내 낸 로컬 목 프레임워크.
 * - 서버: Room.onCreate/onJoin/onLeave/onMessage/broadcast/clock, patchRate 마다 상태 동기화
 * - 클라: Client.joinOrCreate() → RoomConnection.send/onMessage/onStateChange/onLeave/leave
 * - 전송: 구조적 복제(JSON) + 지연(왕복 latencyMs, 편도 latencyMs/2, 지터) + 순서 보장(FIFO)
 * 실제 colyseus.js 로 바꿀 때는 RoomConnection 인터페이스만 맞추면 됩니다.
 */

export interface ClientRef {
  sessionId: string;
  /** 서버 → 이 클라이언트 메시지 */
  send(type: string, message: unknown): void;
}

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number | undefined): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => {
    if (id !== undefined) clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  },
};

type Handler = (client: ClientRef, message: any) => void;

export abstract class Room<S> {
  state!: S;
  clients: ClientRef[] = [];
  clock: Clock = realClock;
  /** Colyseus 기본값과 같은 50ms */
  patchRate = 50;
  private handlers = new Map<string, Handler>();
  /** @internal */ _dirty = true;
  /** @internal */ _onPatch?: () => void;

  setState(s: S) {
    this.state = s;
    this.markDirty();
  }
  markDirty() {
    this._dirty = true;
    this._onPatch?.();
  }
  onMessage(type: string, handler: Handler) {
    this.handlers.set(type, handler);
  }
  broadcast(type: string, message: unknown) {
    for (const c of this.clients) c.send(type, message);
  }
  /** Colyseus @filter 대응: 클라이언트별로 보여줄 상태 */
  filterStateFor(_sessionId: string): S {
    return this.state;
  }
  /** @internal */ _dispatch(client: ClientRef, type: string, message: unknown) {
    const h = this.handlers.get(type);
    if (h) h(client, message);
  }
  abstract onCreate(options: any): void;
  abstract onJoin(client: ClientRef, options: any): void;
  abstract onLeave(client: ClientRef): void;
  onDispose(): void {}
}

/** 네트워크 지연 시뮬레이터 (FIFO 보장: 하나의 큐 + 하나의 타이머로 순서대로 배달) */
export class LatencyLink {
  private lastDelivery = 0;
  private q: Array<{ at: number; fn: () => void }> = [];
  private timer: number | undefined;
  constructor(
    private getLatency: () => number,
    private clock: Clock = realClock,
    private jitter = 0.15,
  ) {}
  deliver(fn: () => void) {
    const rtt = this.getLatency();
    if (rtt <= 0 && this.q.length === 0) {
      // 0ms: 같은 프레임 안에서 처리되지 않도록 마이크로태스크로 (실제 소켓처럼 비동기)
      queueMicrotask(fn);
      return;
    }
    const oneWay = rtt > 0 ? (rtt / 2) * (1 + (Math.random() * 2 - 1) * this.jitter) : 0;
    const at = Math.max(this.clock.now() + oneWay, this.lastDelivery);
    this.lastDelivery = at;
    this.q.push({ at, fn });
    this.arm();
  }
  private arm() {
    if (this.timer !== undefined || this.q.length === 0) return;
    const wait = Math.max(0, this.q[0].at - this.clock.now());
    this.timer = this.clock.setTimeout(() => {
      this.timer = undefined;
      const now = this.clock.now();
      // 시계 해상도 오차(1ms) 허용, 앞에서부터 순서대로
      while (this.q.length && this.q[0].at <= now + 1) this.q.shift()!.fn();
      this.arm();
    }, wait);
  }
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export interface RoomConnection<S> {
  sessionId: string;
  state: S;
  send(type: string, message?: unknown): void;
  onMessage(type: string, cb: (message: any) => void): () => void;
  onStateChange(cb: (state: S) => void): () => void;
  onLeave(cb: (code: number) => void): () => void;
  leave(): void;
}

let sessionCounter = 0;

/**
 * 목 "서버 프로세스". 방 1개를 호스팅합니다.
 */
export class MockServer<S> {
  room: Room<S> | null = null;
  latencyMs = 0;
  private patchTimer: number | undefined;
  private connections = new Map<string, { push: (s: S) => void; link: LatencyLink }>();

  constructor(
    private roomFactory: () => Room<S>,
    public clock: Clock = realClock,
  ) {}

  setLatency(ms: number) {
    this.latencyMs = ms;
  }

  private ensureRoom(options: unknown) {
    if (this.room) return this.room;
    const room = this.roomFactory();
    room.clock = this.clock;
    room._onPatch = () => this.schedulePatch();
    room.onCreate(options);
    this.room = room;
    return room;
  }

  private schedulePatch() {
    if (this.patchTimer !== undefined || !this.room) return;
    this.patchTimer = this.clock.setTimeout(() => {
      this.patchTimer = undefined;
      this.flushPatch();
    }, this.room.patchRate);
  }

  /** 대기 중인 상태 패치를 즉시 보냄 (테스트용) */
  flushPatch() {
    const room = this.room;
    if (!room || !room._dirty) return;
    room._dirty = false;
    for (const [sid, c] of this.connections) {
      const snap = clone(room.filterStateFor(sid));
      c.link.deliver(() => c.push(snap));
    }
  }

  connect(options: unknown): Promise<RoomConnection<S>> {
    const room = this.ensureRoom(options);
    const sessionId = `s${++sessionCounter}_${Math.random().toString(36).slice(2, 7)}`;
    const msgListeners = new Map<string, Set<(m: any) => void>>();
    const stateListeners = new Set<(s: S) => void>();
    const leaveListeners = new Set<(code: number) => void>();
    const down = new LatencyLink(() => this.latencyMs, this.clock);
    const up = new LatencyLink(() => this.latencyMs, this.clock);
    let left = false;

    const conn: RoomConnection<S> = {
      sessionId,
      state: clone(room.filterStateFor(sessionId)),
      send: (type, message) => {
        if (left) return;
        const payload = clone(message ?? {});
        up.deliver(() => {
          if (!left) room._dispatch(clientRef, type, payload);
        });
      },
      onMessage: (type, cb) => {
        if (!msgListeners.has(type)) msgListeners.set(type, new Set());
        msgListeners.get(type)!.add(cb);
        return () => msgListeners.get(type)?.delete(cb);
      },
      onStateChange: (cb) => {
        stateListeners.add(cb);
        return () => stateListeners.delete(cb);
      },
      onLeave: (cb) => {
        leaveListeners.add(cb);
        return () => leaveListeners.delete(cb);
      },
      leave: () => {
        if (left) return;
        left = true;
        this.connections.delete(sessionId);
        room.clients = room.clients.filter((c) => c !== clientRef);
        room.onLeave(clientRef);
        leaveListeners.forEach((cb) => cb(1000));
      },
    };

    const clientRef: ClientRef = {
      sessionId,
      send: (type, message) => {
        if (left) return;
        const payload = clone(message);
        down.deliver(() => msgListeners.get(type)?.forEach((cb) => cb(payload)));
      },
    };

    this.connections.set(sessionId, {
      link: down,
      push: (s) => {
        if (left) return;
        conn.state = s;
        stateListeners.forEach((cb) => cb(s));
      },
    });

    return new Promise((resolve) => {
      up.deliver(() => {
        room.clients.push(clientRef);
        room.onJoin(clientRef, options);
        conn.state = clone(room.filterStateFor(sessionId));
        room.markDirty();
        down.deliver(() => resolve(conn));
      });
    });
  }

  dispose() {
    this.clock.clearTimeout(this.patchTimer);
    this.room?.onDispose();
    this.room = null;
    this.connections.clear();
  }
}

/** colyseus.js Client 와 같은 모양 */
export class MockClient<S> {
  constructor(private server: MockServer<S>) {}
  joinOrCreate(_roomName: string, options: unknown = {}): Promise<RoomConnection<S>> {
    return this.server.connect(options);
  }
}
