// Procedural "western bar" audio: honky-tonk saloon piano loop + game SFX.
// All synthesized with the Web Audio API — no assets needed.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let loopTimer: number | null = null;
let nextNoteTime = 0;
let step = 0;

function ac(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(master);
  }
  return ctx!;
}

export function resumeAudio() {
  const c = ac();
  if (c.state === "suspended") void c.resume();
}

function pluck(freq: number, time: number, dur: number, gain: number, type: OscillatorType) {
  const c = ac();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(g);
  g.connect(musicGain!);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

// Honky-tonk piano: two slightly detuned triangle waves = out-of-tune saloon upright.
function pianoNote(freq: number, time: number, dur: number, gain = 0.5) {
  pluck(freq, time, dur, gain, "triangle");
  pluck(freq * 1.006, time, dur, gain * 0.6, "triangle");
  pluck(freq * 2, time, dur * 0.5, gain * 0.15, "sine");
}

const N = {
  C2: 65.41, G2: 98.0, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
  G3: 196.0, A3: 220.0, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
  F4: 349.23, G4: 392.0, A4: 440.0, C5: 523.25,
} as const;

// 16-step ragtime-ish vamp in C
const BASS = [N.C2, 0, N.G2, 0, N.C2, 0, N.G2, 0, N.F3 / 2, 0, N.C3, 0, N.G2, 0, N.G2, 0];
const MEL = [
  N.E4, N.G4, N.C5, N.G4, N.E4, N.D4, N.E4, 0,
  N.F4, N.A4, N.C5, N.A4, N.G4, N.E4, N.D4, N.C4,
];

const STEP_DUR = 0.16;

function scheduler() {
  const c = ac();
  while (nextNoteTime < c.currentTime + 0.25) {
    const b = BASS[step % 16] ?? 0;
    if (b) pianoNote(b, nextNoteTime, 0.28, 0.55);
    const m = MEL[step % 16] ?? 0;
    if (m) pianoNote(m, nextNoteTime, 0.22, 0.32);
    if (step % 4 === 2) {
      // brushed snare/clap
      const buf = c.createBuffer(1, 1024, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = 0.08;
      src.connect(g);
      g.connect(musicGain!);
      src.start(nextNoteTime);
    }
    nextNoteTime += STEP_DUR;
    step++;
  }
}

export function startMusic() {
  resumeAudio();
  if (loopTimer !== null) return;
  nextNoteTime = ac().currentTime + 0.1;
  loopTimer = window.setInterval(scheduler, 60);
}

export function stopMusic() {
  if (loopTimer !== null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
  }
}

export function setMuted(muted: boolean) {
  if (!master) return;
  master.gain.value = muted ? 0 : 0.9;
}

export function sfxTick() {
  const c = ac();
  pluck(1200, c.currentTime, 0.03, 0.06, "square");
}

export function sfxStop() {
  // saloon-door "thunk" + coin ding
  const c = ac();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(240, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.18);
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g);
  g.connect(master!);
  osc.start(t);
  osc.stop(t + 0.25);
  pluck(1568, t + 0.02, 0.25, 0.12, "triangle");
}

export function sfxWin() {
  const c = ac();
  const t = c.currentTime;
  [N.C4, N.E4, N.G4, N.C5].forEach((f, i) => pianoNote(f, t + i * 0.09, 0.4, 0.6));
}

export function sfxDraw() {
  const c = ac();
  const t = c.currentTime;
  pianoNote(N.E4, t, 0.25, 0.4);
  pianoNote(N.D4 * 0.99, t + 0.12, 0.35, 0.4);
}

export function sfxChampion() {
  const c = ac();
  const t = c.currentTime;
  const seq = [N.C4, N.E4, N.G4, N.C5, N.G4, N.C5, N.E4 * 2];
  seq.forEach((f, i) => pianoNote(f, t + i * 0.13, 0.5, 0.65));
  // gunshot-style whip crack finale
  const buf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++)
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = 0.3;
  src.connect(g);
  g.connect(master!);
  src.start(t + seq.length * 0.13);
}
