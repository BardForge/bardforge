// Original, deterministic demo synthesis. No downloaded or third-party recordings.
export function demoWav(kind: 'rain' | 'drone' | 'bell'): Blob {
  const rate = 22050;
  const seconds = kind === 'bell' ? 4 : 12;
  const count = rate * seconds;
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const word = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  word(0, 'RIFF');
  view.setUint32(4, 36 + count * 2, true);
  word(8, 'WAVE');
  word(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  word(36, 'data');
  view.setUint32(40, count * 2, true);
  let seed = 781;
  let low = 0;
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 0x100000000) * 2 - 1;
    low = low * 0.96 + noise * 0.04;
    const fade = Math.min(1, t * 4, (seconds - t) * 4);
    const sample =
      kind === 'rain'
        ? (low * 0.8 + noise * 0.09) * (0.8 + Math.sin((t * Math.PI) / 3) * 0.2)
        : kind === 'drone'
          ? (Math.sin(t * Math.PI * 110) + Math.sin(t * Math.PI * 165) * 0.45) * 0.07
          : (Math.sin(t * Math.PI * 880) + Math.sin(t * Math.PI * 1320) * 0.4) * Math.exp(-t * 1.5) * 0.18;
    view.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, sample * fade * 32767)), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
