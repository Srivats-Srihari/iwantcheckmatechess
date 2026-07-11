/**
 * Web Audio API programmatically synthesized chess sound effects.
 * Avoids the need to download/load external audio asset files.
 */

class AudioSynthesizer {
  private ctx: AudioContext | null = null;

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume context if suspended (browser security blocks autoplay)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play standard chess move sound (wood click / snap)
  public playMove() {
    try {
      const ctx = this.initContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime); // Mid range tap
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  }

  // Play chess capture sound (lower snap / dual tap)
  public playCapture() {
    try {
      const ctx = this.initContext();
      
      // Tap 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(260, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);
      gain1.gain.setValueAtTime(0.5, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.13);

      // Tap 2 (slightly delayed metal-clink)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(450, ctx.currentTime + 0.03);
      osc2.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc2.start(ctx.currentTime + 0.03);
      osc2.stop(ctx.currentTime + 0.16);
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  }

  // Play king check sound (two-tone alarming chime)
  public playCheck() {
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // Note 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2 (slightly delayed higher chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain2.gain.setValueAtTime(0.25, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.4);
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  }

  // Play game victory soundscape (ascending major arpeggio chord)
  public playVictory() {
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major scale

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.6);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.65);
      });
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  }

  // Play game defeat soundscape (descending minor chord with low rumble)
  public playDefeat() {
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;
      const notes = [440.00, 349.23, 293.66, 220.00, 146.83]; // Descending minor chord

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        osc.frequency.exponentialRampToValueAtTime(freq / 2, now + idx * 0.12 + 0.8);

        gain.gain.setValueAtTime(0.12, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 1.0);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 1.1);
      });

      // Low bass rumble
      const lowOsc = ctx.createOscillator();
      const lowGain = ctx.createGain();
      lowOsc.connect(lowGain);
      lowGain.connect(ctx.destination);
      lowOsc.type = 'sine';
      lowOsc.frequency.setValueAtTime(70, now);
      lowOsc.frequency.exponentialRampToValueAtTime(30, now + 1.5);
      lowGain.gain.setValueAtTime(0.35, now);
      lowGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
      lowOsc.start(now);
      lowOsc.stop(now + 1.6);
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  }
}

export const chessAudio = new AudioSynthesizer();
