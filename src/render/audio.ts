/** Small synthesized stall sounds. No external audio files. */

export interface StallAudio {
  resume: () => void;
  knock: () => void;
  chime: () => void;
  thunder: () => void;
}

export function createStallAudio(): StallAudio {
  let context: AudioContext | null = null;
  const ctx = () => {
    if (context == null) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      context = new Ctx();
    }
    return context;
  };

  const tone = (frequency: number, duration: number, type: OscillatorType, gainValue: number) => {
    const audio = ctx();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    gain.gain.setValueAtTime(gainValue, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  };

  return {
    resume: () => {
      void ctx().resume();
    },
    knock: () => tone(180, 0.08, 'square', 0.03),
    chime: () => {
      tone(660, 0.18, 'triangle', 0.04);
      tone(990, 0.28, 'sine', 0.03);
    },
    thunder: () => {
      const audio = ctx();
      const length = Math.floor(audio.sampleRate * 0.45);
      const buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        const envelope = 1 - index / length;
        data[index] = (Math.random() * 2 - 1) * envelope * envelope;
      }
      const source = audio.createBufferSource();
      const gain = audio.createGain();
      const filter = audio.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      source.buffer = buffer;
      gain.gain.value = 0.35;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audio.destination);
      source.start();
      tone(90, 0.3, 'sawtooth', 0.04);
    },
  };
}
