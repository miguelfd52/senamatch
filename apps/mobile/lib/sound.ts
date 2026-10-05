/**
 * Utilidad de sonido de notificación para SENA Match usando Web Audio API estándar.
 * - Cero dependencias externas.
 * - Desbloqueo automático tras la primera interacción del usuario (click, touch, keydown).
 * - Sonido limpio, corto y sutil (dos tonos armónicos).
 */

let audioCtx: AudioContext | null = null;
let unlocked = false;

function initAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
    } catch (_) {
      return null;
    }
  }

  if (audioCtx && audioCtx.state === 'suspended' && unlocked) {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

// Activar el contexto de audio tras la primera interacción del usuario para cumplir con las políticas de autoplay
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    unlocked = true;
    const ctx = initAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };

  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

/**
 * Reproduce un sonido corto y agradable de notificación de nuevo mensaje.
 */
export function playNotificationSound(): void {
  try {
    const ctx = initAudioContext();
    if (!ctx) return;

    // Si aún está suspendido, intentar reanudar
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return;
    }

    const t = ctx.currentTime;

    // Primer tono: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, t);

    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.16);

    // Segundo tono: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, t + 0.08);

    gain2.gain.setValueAtTime(0, t + 0.08);
    gain2.gain.linearRampToValueAtTime(0.2, t + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.08);
    osc2.stop(t + 0.32);
  } catch (_) {
    // Falla silenciosa si el navegador bloquea audio
  }
}
