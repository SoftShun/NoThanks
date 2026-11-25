/**
 * 임시 효과음: jsfxr 파라미터로 런타임에 WAV 를 합성하고 Howler 로 재생합니다.
 * 최종 사운드로 교체할 때는 SFX 키는 그대로 두고 src 만 파일로 바꾸면 됩니다.
 */
import { Howl, Howler } from 'howler';
import { sfxr } from 'jsfxr';

export type SfxKey = 'tap' | 'flip' | 'chip' | 'take' | 'coins' | 'turn' | 'error' | 'tick' | 'win' | 'shuffle' | 'reveal';

// wave_type: 0 square, 1 sawtooth, 2 sine, 3 noise
const PRESETS: Record<SfxKey, Record<string, number>> = {
  tap: { wave_type: 2, p_env_sustain: 0.02, p_env_decay: 0.06, p_base_freq: 0.62, sound_vol: 0.18 },
  flip: { wave_type: 3, p_env_sustain: 0.03, p_env_decay: 0.12, p_base_freq: 0.62, p_freq_ramp: -0.2, p_hpf_freq: 0.25, sound_vol: 0.2 },
  chip: { wave_type: 0, p_env_sustain: 0.02, p_env_decay: 0.14, p_env_punch: 0.45, p_base_freq: 0.66, p_duty: 0.4, p_arp_mod: 0.3, p_arp_speed: 0.55, sound_vol: 0.16 },
  take: { wave_type: 1, p_env_sustain: 0.06, p_env_decay: 0.22, p_base_freq: 0.32, p_freq_ramp: 0.18, p_lpf_freq: 0.55, sound_vol: 0.18 },
  coins: { wave_type: 0, p_env_sustain: 0.04, p_env_decay: 0.3, p_env_punch: 0.5, p_base_freq: 0.55, p_arp_mod: 0.45, p_arp_speed: 0.62, p_duty: 0.25, sound_vol: 0.15 },
  turn: { wave_type: 2, p_env_attack: 0.02, p_env_sustain: 0.08, p_env_decay: 0.2, p_base_freq: 0.44, p_arp_mod: 0.35, p_arp_speed: 0.5, sound_vol: 0.17 },
  error: { wave_type: 0, p_env_sustain: 0.08, p_env_decay: 0.16, p_base_freq: 0.22, p_freq_ramp: -0.12, p_duty: 0.6, sound_vol: 0.16 },
  tick: { wave_type: 2, p_env_sustain: 0.01, p_env_decay: 0.05, p_base_freq: 0.8, sound_vol: 0.12 },
  win: { wave_type: 0, p_env_sustain: 0.25, p_env_decay: 0.45, p_env_punch: 0.3, p_base_freq: 0.4, p_arp_mod: 0.42, p_arp_speed: 0.4, p_duty: 0.3, p_vib_strength: 0.08, p_vib_speed: 0.5, sound_vol: 0.17 },
  shuffle: { wave_type: 3, p_env_sustain: 0.2, p_env_decay: 0.25, p_base_freq: 0.75, p_repeat_speed: 0.62, p_hpf_freq: 0.3, sound_vol: 0.14 },
  reveal: { wave_type: 2, p_env_attack: 0.05, p_env_sustain: 0.15, p_env_decay: 0.35, p_base_freq: 0.35, p_freq_ramp: 0.15, p_vib_strength: 0.2, p_vib_speed: 0.6, sound_vol: 0.16 },
};

const BASE: Record<string, number> = {
  wave_type: 0, p_env_attack: 0, p_env_sustain: 0.3, p_env_punch: 0, p_env_decay: 0.4,
  p_base_freq: 0.3, p_freq_limit: 0, p_freq_ramp: 0, p_freq_dramp: 0, p_vib_strength: 0, p_vib_speed: 0,
  p_arp_mod: 0, p_arp_speed: 0, p_duty: 0, p_duty_ramp: 0, p_repeat_speed: 0, p_pha_offset: 0, p_pha_ramp: 0,
  p_lpf_freq: 1, p_lpf_ramp: 0, p_lpf_resonance: 0, p_hpf_freq: 0, p_hpf_ramp: 0,
  sound_vol: 0.25, sample_rate: 44100, sample_size: 8,
};

export const SFX_LIST = Object.keys(PRESETS) as SfxKey[];

let howls: Partial<Record<SfxKey, Howl>> | null = null;
let enabled = true;
let volume = 0.8;

function build() {
  if (howls) return;
  howls = {};
  for (const key of SFX_LIST) {
    const wave = sfxr.toWave({ ...BASE, ...PRESETS[key] });
    howls[key] = new Howl({ src: [wave.dataURI], format: ['wav'], volume, preload: true });
  }
}

/** 첫 사용자 입력 시 호출 (오디오 자동재생 정책) */
export function unlockAudio() {
  try {
    build();
    const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx;
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* noop */
  }
}

export function sfx(key: SfxKey, opts: { rate?: number; volume?: number } = {}) {
  if (!enabled) return;
  if (!howls) return; // 아직 사용자 입력 전
  const h = howls[key];
  if (!h) return;
  const id = h.play();
  if (opts.rate) h.rate(opts.rate, id);
  if (opts.volume !== undefined) h.volume(opts.volume * volume, id);
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}
export function setVolume(v: number) {
  volume = v;
  Howler.volume(v);
}
