const MUTE_STORAGE_KEY = 'swarm_plaza_muted';

let audioCtx: AudioContext | null = null;
let unlocked = false;
let mutedState = (() => {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
})();

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

export function initAudioUnlock(): () => void {
  const unlock = () => {
    const ctx = getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    unlocked = true;
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });

  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

export function isMuted(): boolean {
  return mutedState;
}

export function setMuted(muted: boolean): void {
  mutedState = muted;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
  } catch {
    // ignore
  }
}

export function toggleMuted(): boolean {
  setMuted(!mutedState);
  return mutedState;
}

function playTone(
  freq: number,
  durationSec: number,
  type: OscillatorType = 'square',
  gainPeak = 0.08,
  delaySec = 0,
  endFreq?: number,
): void {
  if (mutedState) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    if (!unlocked) return;
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durationSec);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

/** Crisp 8-bit two-tone elevator arrival ding */
export function playElevatorDing(): void {
  playTone(784, 0.12, 'triangle', 0.11, 0);
  playTone(1046.5, 0.28, 'triangle', 0.11, 0.11);
}

/** Short retro UI selection blip */
export function playSelectBlip(): void {
  playTone(520, 0.055, 'square', 0.06, 0, 740);
}

/** 3-note @mention chime when a new board message arrives */
export function playMentionChime(): void {
  playTone(659.25, 0.09, 'square', 0.06, 0);
  playTone(880, 0.09, 'square', 0.06, 0.08);
  playTone(1174.66, 0.18, 'triangle', 0.08, 0.16);
}

/** Subtle mechanical 8-bit keyboard tick */
export function playKeyboardTick(): void {
  const jitter = 950 + Math.random() * 250;
  playTone(jitter, 0.02, 'square', 0.025, 0, jitter * 0.7);
}

/** Classic Game Dev Story / RPG level-up or tier-up fanfare */
export function playLevelUp(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((n, idx) => {
    playTone(n, idx === notes.length - 1 ? 0.34 : 0.1, 'square', 0.075, idx * 0.09);
  });
}

/** 8-bit retro console gamepad start / button blip */
export function playGamepadBlip(): void {
  playTone(440, 0.05, 'square', 0.055, 0);
  playTone(660, 0.07, 'square', 0.055, 0.05);
}

/** 3-note chime for floor random events */
export function playEventJingle(): void {
  playTone(587.33, 0.09, 'triangle', 0.09, 0);
  playTone(783.99, 0.09, 'triangle', 0.09, 0.08);
  playTone(1174.66, 0.22, 'triangle', 0.1, 0.16);
}
