/**
 * 단일 애니메이션 큐. 모든 연출은 여기로 들어와 순서대로 실행됩니다.
 * - task 는 Promise 를 반환하는 함수
 * - 밀린 작업이 많으면(지연 폭주) timeScale 을 올려 따라잡음
 * - 낙관적 반응은 runNow() 로 큐 맨 앞에서 즉시 실행 (큐가 비어 있을 때만 허용)
 */
import { gsap } from 'gsap';

export type AnimTask = { label: string; run: () => Promise<void> | void };

export class AnimationQueue {
  private q: AnimTask[] = [];
  private running = false;
  private idleWaiters: Array<() => void> = [];
  onIdle?: () => void;
  onDrain?: () => void;
  /** 현재 실행 중 라벨 (디버그) */
  current = '';

  get length() {
    return this.q.length + (this.running ? 1 : 0);
  }
  get busy() {
    return this.running || this.q.length > 0;
  }

  push(task: AnimTask) {
    this.q.push(task);
    if (!this.running) void this.pump();
  }

  /** 큐 맨 앞에 끼워 즉시 시작 (동기적으로 첫 프레임 변화가 일어나도록) */
  runNow(task: AnimTask) {
    this.q.unshift(task);
    if (!this.running) void this.pump();
  }

  clear() {
    this.q = [];
  }

  whenIdle(): Promise<void> {
    if (!this.busy) return Promise.resolve();
    return new Promise((r) => this.idleWaiters.push(r));
  }

  private async pump() {
    this.running = true;
    while (this.q.length) {
      const t = this.q.shift()!;
      this.current = t.label;
      // 밀린 연출이 많으면 빠르게 (지연 300ms 에서 이벤트가 몰려 와도 화면이 뒤처지지 않게)
      gsap.globalTimeline.timeScale(this.q.length >= 4 ? 2.2 : this.q.length >= 2 ? 1.4 : 1);
      try {
        await t.run();
      } catch (e) {
        console.error('[anim]', t.label, e);
      }
    }
    gsap.globalTimeline.timeScale(1);
    this.current = '';
    this.running = false;
    this.onIdle?.();
    const w = this.idleWaiters;
    this.idleWaiters = [];
    w.forEach((f) => f());
  }
}

/** GSAP 타임라인을 Promise 로 */
export function play(tl: gsap.core.Timeline | gsap.core.Tween): Promise<void> {
  return new Promise((resolve) => {
    if (tl.totalDuration() === 0) {
      tl.progress(1);
      resolve();
      return;
    }
    tl.eventCallback('onComplete', () => resolve());
  });
}
