import { effectiveGain, type Scene } from '../domain/scene';

type Voice = {
  audio: HTMLAudioElement;
  url: string;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  error?: string;
};
export interface Playback {
  playing: boolean;
  position: number;
  duration: number;
  error?: string;
}

export async function inspectAudio(blob: Blob): Promise<number> {
  if (blob.size > 100 * 1024 * 1024) throw new Error('Файл больше 100 МБ.');
  if (blob.size === 0) throw new Error('Пустой файл.');
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  audio.preload = 'metadata';
  try {
    return await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        clean();
        reject(new Error('Не удалось прочитать аудио за 15 секунд.'));
      }, 15_000);
      const clean = () => {
        clearTimeout(timer);
        audio.onloadedmetadata = null;
        audio.onerror = null;
      };
      audio.onloadedmetadata = () => {
        clean();
        if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(audio.duration);
        else reject(new Error('Не удалось определить длительность.'));
      };
      audio.onerror = () => {
        clean();
        reject(new Error('Формат не поддерживается или файл повреждён.'));
      };
      audio.src = url;
    });
  } finally {
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(url);
  }
}

export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private analyser?: AnalyserNode;
  private samples?: Float32Array<ArrayBuffer>;
  private voices = new Map<string, Voice>();
  private scene?: Scene;
  private generation = 0;

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.samples = new Float32Array(512);
      this.master.connect(limiter).connect(this.analyser).connect(this.context.destination);
    }
    return this.context;
  }

  async loadTrack(id: string, blob: Blob): Promise<void> {
    if (this.voices.has(id)) return;
    const context = this.ensureContext();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = 'auto';
    const source = context.createMediaElementSource(audio);
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.master!);
    const voice: Voice = { audio, url, source, gain };
    audio.onerror = () => {
      voice.error = 'Не удалось воспроизвести файл.';
    };
    this.voices.set(id, voice);
  }

  sync(scene: Scene): void {
    this.scene = scene;
    if (!this.context) return;
    this.master!.gain.setTargetAtTime(scene.masterGain, this.context.currentTime, 0.015);
    for (const [id, voice] of this.voices) {
      const track = scene.tracks.find((t) => t.id === id);
      if (!track) {
        this.remove(id);
        continue;
      }
      voice.audio.loop = track.loop;
      voice.gain.gain.setTargetAtTime(effectiveGain(scene, id), this.context.currentTime, 0.015);
    }
  }

  async play(ids: string[]): Promise<void> {
    const generation = this.generation;
    await this.ensureContext().resume();
    if (generation !== this.generation) return;
    const voices = ids.map((id) => this.voices.get(id));
    if (voices.some((v) => !v)) throw new Error('Аудиофайл не загружен. Откройте сцену повторно.');
    try {
      await Promise.all(
        voices.map(async (voice) => {
          if (voice!.audio.ended) voice!.audio.currentTime = 0;
          await voice!.audio.play();
        }),
      );
    } catch (error) {
      this.pause(ids);
      throw error;
    }
  }
  pause(ids = [...this.voices.keys()]): void {
    ids.forEach((id) => this.voices.get(id)?.audio.pause());
  }
  stop(ids = [...this.voices.keys()]): void {
    ids.forEach((id) => {
      const v = this.voices.get(id);
      if (v) {
        v.audio.pause();
        v.audio.currentTime = 0;
      }
    });
  }
  seek(id: string, position: number): void {
    const v = this.voices.get(id);
    if (v && Number.isFinite(v.audio.duration))
      v.audio.currentTime = Math.max(0, Math.min(position, v.audio.duration));
  }
  remove(id: string): void {
    const v = this.voices.get(id);
    if (!v) return;
    v.audio.pause();
    v.audio.onerror = null;
    v.audio.removeAttribute('src');
    v.audio.load();
    v.source.disconnect();
    v.gain.disconnect();
    URL.revokeObjectURL(v.url);
    this.voices.delete(id);
  }
  clear(): void {
    this.generation++;
    [...this.voices.keys()].forEach((id) => this.remove(id));
    this.scene = undefined;
  }
  snapshot(): Record<string, Playback> {
    return Object.fromEntries(
      [...this.voices].map(([id, v]) => [
        id,
        {
          playing: !v.audio.paused && !v.audio.ended,
          position: v.audio.currentTime || 0,
          duration: Number.isFinite(v.audio.duration) ? v.audio.duration : 0,
          error: v.error,
        },
      ]),
    );
  }
  level(): number {
    if (!this.analyser || !this.samples) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    return Math.sqrt(this.samples.reduce((sum, value) => sum + value * value, 0) / this.samples.length);
  }
  async dispose(): Promise<void> {
    this.clear();
    await this.context?.close();
  }
}
