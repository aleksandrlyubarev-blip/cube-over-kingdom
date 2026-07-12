const AudioContextClass = window.AudioContext || window.webkitAudioContext;

let context = null;
let masterGain = null;
let muted = false;

export function unlockAudio() {
  if (!AudioContextClass) {
    return false;
  }
  if (!context) {
    context = new AudioContextClass();
    masterGain = context.createGain();
    masterGain.gain.value = muted ? 0 : 0.22;
    masterGain.connect(context.destination);
  }
  if (context.state === "suspended") {
    void context.resume();
  }
  return true;
}

export function setMuted(nextMuted) {
  muted = Boolean(nextMuted);
  if (masterGain && context) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.22, context.currentTime, 0.01);
  }
}

export function isMuted() {
  return muted;
}

export function playSound(name) {
  if (!context || !masterGain || muted || context.state === "closed") {
    return;
  }

  const sounds = {
    tap: () => tone(190, 125, 0.045, "sine", 0.3),
    shot: () => tone(105, 55, 0.11, "square", 0.22),
    purchase: () => {
      tone(440, 660, 0.08, "triangle", 0.24);
      tone(660, 880, 0.09, "triangle", 0.2, 0.07);
    },
    destruction: () => {
      tone(90, 34, 0.3, "sawtooth", 0.32);
      tone(52, 28, 0.42, "square", 0.16, 0.04);
    }
  };
  sounds[name]?.();
}

function tone(startFrequency, endFrequency, duration, type, volume, delay = 0) {
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}
