import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockClient, MockServer, type RoomConnection } from '../net/colyseusLike';
import { NoThanksRoom } from '../net/NoThanksRoom';
import { applyEvent, viewFromState, viewHash, type AckMessage, type RoomState, type SeqEvent, type TableView } from '../net/protocol';
import { mulberry32, resetRandomSource, setRandomSource } from '../engine/rng';

let server: MockServer<RoomState>;
let room: NoThanksRoom;

beforeEach(() => {
  vi.useFakeTimers();
  setRandomSource(mulberry32(1234));
  server = new MockServer<RoomState>(() => (room = new NoThanksRoom()));
});
afterEach(() => {
  server.dispose();
  vi.useRealTimers();
  resetRandomSource();
});

async function join(nickname = '나', latency = 0) {
  server.setLatency(latency);
  const p = new MockClient(server).joinOrCreate('no_thanks', { nickname, botSpeed: 0.05 });
  await vi.advanceTimersByTimeAsync(latency * 1.3 + 20); // 지터 ±15% 여유
  const conn = await p;
  const events: SeqEvent[] = [];
  const acks: AckMessage[] = [];
  conn.onMessage('event', (e) => events.push(e));
  conn.onMessage('ack', (a) => acks.push(a));
  return { conn, events, acks };
}

let n = 0;
const aid = () => 'a' + ++n;

async function settle(ms = 200) {
  await vi.advanceTimersByTimeAsync(ms);
}

describe('목 서버 (Colyseus Room 흉내)', () => {
  it('입장하면 방장이 되고 상태가 동기화된다', async () => {
    const { conn } = await join();
    await settle();
    expect(conn.state.hostId).toBe(conn.sessionId);
    expect(conn.state.players.length).toBe(1);
    expect(conn.state.phase).toBe('lobby');
  });

  it('봇 추가 제한: 최대 3개', async () => {
    const { conn, acks } = await join();
    for (let i = 0; i < 4; i++) conn.send('addBot', { actionId: aid(), difficulty: 'hard' });
    await settle();
    expect(acks.filter((a) => a.ok).length).toBe(3);
    expect(acks[3].ok).toBe(false);
    expect(conn.state.players.map((p) => p.nickname)).toEqual(['나', 'AI봇 1 (상)', 'AI봇 2 (상)', 'AI봇 3 (상)']);
  });

  it('이벤트 seq 는 1부터 빈틈없이 증가하고, 이벤트 적용 결과가 서버 상태와 같다', async () => {
    const { conn, events } = await join();
    conn.send('addBot', { actionId: aid(), difficulty: 'medium' });
    conn.send('addBot', { actionId: aid(), difficulty: 'expert' });
    conn.send('updateSettings', { actionId: aid(), settings: { showOpponentTokens: true, turnTimeLimit: 0 } });
    await settle();
    let view: TableView = viewFromState(conn.state);
    conn.send('start', { actionId: aid() });
    // 내 차례면 무조건 패스(칩 없으면 서버가 강제 가져가기)
    for (let i = 0; i < 400 && conn.state.phase !== 'ended'; i++) {
      await settle(300);
      if (conn.state.currentPlayerId === conn.sessionId) conn.send(i % 3 ? 'pass' : 'take', { actionId: aid() });
    }
    await settle(500);
    expect(conn.state.phase).toBe('ended');
    events.forEach((e, i) => expect(e.seq).toBe(i + 1));
    for (const e of events) view = applyEvent(view, e, conn.sessionId);
    expect(viewHash(view)).toBe(viewHash(viewFromState(conn.state)));
    expect(conn.state.results.length).toBe(3);
    expect(conn.state.results.reduce((s, r) => s + r.cards.length, 0)).toBe(24);
  });

  it('차례가 아닐 때의 입력은 거절(ack ok=false) 되고 상태는 변하지 않는다', async () => {
    const { conn, acks } = await join();
    conn.send('addBot', { actionId: aid(), difficulty: 'medium' });
    conn.send('updateSettings', { actionId: aid(), settings: { turnTimeLimit: 0 } });
    await settle();
    room.botSpeed = 1000; // 봇이 오래 생각하게 해서 봇 차례를 붙잡아 둔다
    conn.send('start', { actionId: aid() });
    await settle(100);
    const cur = () => room.engine.players[room.engine.currentPlayerIndex].id;
    for (let i = 0; i < 50 && cur() === conn.sessionId; i++) {
      conn.send('pass', { actionId: aid() });
      await settle(20);
    }
    expect(cur()).not.toBe(conn.sessionId);
    const before = JSON.stringify(room.snapshot());
    const id = aid();
    conn.send('take', { actionId: id });
    await settle(10);
    const ack = acks.find((a) => a.actionId === id)!;
    expect(ack.ok).toBe(false);
    expect(ack.error).toBe('Not your turn');
    expect(JSON.stringify(room.snapshot())).toBe(before);
  });

  it('턴 시간 초과: 칩이 있으면 자동 패스', async () => {
    const { conn, events } = await join();
    conn.send('addBot', { actionId: aid(), difficulty: 'medium' });
    conn.send('updateSettings', { actionId: aid(), settings: { turnTimeLimit: 15 } });
    await settle();
    conn.send('start', { actionId: aid() });
    await settle(20);
    for (let i = 0; i < 100 && conn.state.currentPlayerId !== conn.sessionId; i++) await settle(100);
    const mark = events.length;
    await settle(15_100);
    const auto = events.slice(mark).find((e) => (e.type === 'chip_placed' || e.type === 'card_taken') && e.auto);
    expect(auto).toBeTruthy();
  });

  it('지연 300ms: ack 는 왕복 약 300ms 뒤에 도착하고, 메시지 순서는 유지된다', async () => {
    const { conn, acks } = await join('나', 300);
    const t0 = Date.now();
    const ids = [aid(), aid(), aid()];
    ids.forEach((id) => conn.send('addBot', { actionId: id, difficulty: 'hard' }));
    await settle(200);
    expect(acks.length).toBe(0);
    await settle(200);
    expect(acks.map((a) => a.actionId)).toEqual(ids);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250);
  });

  it('지연+지터에서도 ack 가 자기 이벤트를 앞지르지 않는다 (FIFO)', async () => {
    const { conn, events, acks } = await join('나', 300);
    const order: string[] = [];
    conn.onMessage('event', (e) => order.push('e' + e.seq));
    conn.onMessage('ack', (a) => a.seq && order.push('a' + a.seq));
    conn.send('addBot', { actionId: aid(), difficulty: 'medium' });
    conn.send('updateSettings', { actionId: aid(), settings: { turnTimeLimit: 0 } });
    await settle(400);
    conn.send('start', { actionId: aid() });
    for (let i = 0; i < 120 && conn.state.phase !== 'ended'; i++) {
      await settle(97);
      if (conn.state.currentPlayerId === conn.sessionId) conn.send(i % 2 ? 'pass' : 'take', { actionId: aid() });
    }
    for (const a of acks.filter((x) => x.seq)) {
      expect(order.indexOf('e' + a.seq)).toBeLessThan(order.indexOf('a' + a.seq));
    }
    expect(events.length).toBeGreaterThan(10);
  });

  it('상대 칩 비공개면 다른 사람 칩은 -1 로 보인다 (@filter)', async () => {
    const { conn } = await join();
    conn.send('addBot', { actionId: aid(), difficulty: 'medium' });
    conn.send('updateSettings', { actionId: aid(), settings: { turnTimeLimit: 0 } });
    await settle();
    conn.send('start', { actionId: aid() });
    await settle();
    const me = conn.state.players.find((p) => p.id === conn.sessionId)!;
    const bot = conn.state.players.find((p) => p.isBot)!;
    expect(me.tokens).toBeGreaterThanOrEqual(0);
    expect(bot.tokens).toBe(-1);
  });

  it('히든 모드: 가져가기 → hidden_flipped → 1초 뒤 card_taken, 그 사이 입력은 잠김', async () => {
    const { conn, events, acks } = await join();
    conn.send('addBot', { actionId: aid(), difficulty: 'medium' });
    conn.send('updateSettings', { actionId: aid(), settings: { turnTimeLimit: 0, gameMode: 'hidden', hiddenCardCount: 5 } });
    await settle();
    conn.send('start', { actionId: aid() });
    await settle(100);
    let found = false;
    for (let i = 0; i < 600 && conn.state.phase === 'playing'; i++) {
      await settle(50);
      if (conn.state.currentPlayerId === conn.sessionId) {
        if (conn.state.currentCardHidden) {
          conn.send('take', { actionId: aid() });
          const lockId = aid();
          await settle(5);
          conn.send('take', { actionId: lockId });
          await settle(5);
          expect(acks.find((a) => a.actionId === lockId)?.ok).toBe(false);
          await settle(1100);
          found = true;
          break;
        }
        conn.send('take', { actionId: aid() });
      }
    }
    expect(found).toBe(true);
    const fi = events.findIndex((e) => e.type === 'hidden_flipped');
    expect(events[fi + 1].type).toBe('card_taken');
    expect(events[fi + 1].t - events[fi].t).toBeGreaterThanOrEqual(1000);
  });

  it('게임 종료 후 로비로 돌아가 다시 시작할 수 있다', async () => {
    const { conn } = await join();
    conn.send('addBot', { actionId: aid(), difficulty: 'medium' });
    conn.send('updateSettings', { actionId: aid(), settings: { turnTimeLimit: 0, removedCount: 30 } });
    await settle();
    conn.send('start', { actionId: aid() });
    for (let i = 0; i < 200 && conn.state.phase !== 'ended'; i++) {
      await settle(100);
      if (conn.state.currentPlayerId === conn.sessionId) conn.send('take', { actionId: aid() });
    }
    expect(conn.state.phase).toBe('ended');
    conn.send('returnToLobby', { actionId: aid() });
    await settle();
    expect(conn.state.phase).toBe('lobby');
    expect(conn.state.players.length).toBe(2);
  });
});

void (null as unknown as RoomConnection<RoomState>);
