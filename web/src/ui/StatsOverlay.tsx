import { useStore } from '../app/store';

export function StatsOverlay() {
  const stats = useStore((s) => s.stats);
  const latency = useStore((s) => s.prefs.latency);
  const xs = [...stats.inputMs].sort((a, b) => a - b);
  const p50 = xs.length ? xs[Math.floor(xs.length * 0.5)] : null;
  const p95 = xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] : null;
  return (
    <div className="stats" aria-hidden>
      <span>FPS {stats.fps}</span>
      <span>렌더 {stats.renders ?? '-'}/s</span>
      <span>입력→화면 {stats.lastInputMs?.toFixed(0) ?? '-'}ms</span>
      <span>p50 {p50?.toFixed(0) ?? '-'} / p95 {p95?.toFixed(0) ?? '-'}</span>
      <span>지연 {latency}ms</span>
    </div>
  );
}
