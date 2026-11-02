import { effectiveGain, type Scene } from '../domain/scene';

type Voice = {
  audio: HTMLAudioElement;
  url: string;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  broadcastGain: GainNode;
  request: number;
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
  private broadcastMaster?: GainNode;
  private broadcastDestination?: MediaStreamAudioDestinationNode;
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
      this.broadcastMaster = this.context.createGain();
      this.broadcastDestination = this.context.createMediaStreamDestination();
      const broadcastLimiter = this.context.createDynamicsCompressor();
      broadcastLimiter.threshold.value = -3;
      broadcastLimiter.knee.value = 0;
      broadcastLimiter.ratio.value = 20;
      broadcastLimiter.attack.value = 0.003;
      broadcastLimiter.release.value = 0.15;
      this.broadcastMaster.connect(broadcastLimiter).connect(this.broadcastDestination);
      this.broadcastMaster.gain.value = this.scene?.broadcastGain ?? 0.8;
    }
    return this.context;
  }

  getBroadcastStream(): MediaStream {
    this.ensureContext();
    return this.broadcastDestination!.stream;
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
    const broadcastGain = context.createGain();
    broadcastGain.gain.value = 0;
    source.connect(broadcastGain).connect(this.broadcastMaster!);
    const voice: Voice = { audio, url, source, gain, broadcastGain, request: 0 };
    audio.onerror = () => {
      voice.error = 'Не удалось воспроизвести файл.';
    };
    this.voices.set(id, voice);
  }

  sync(scene: Scene): void {
    this.scene = scene;
    if (!this.context) return;
    this.master!.gain.setTargetAtTime(scene.masterGain, this.context.currentTime, 0.015);
    this.broadcastMaster!.gain.setTargetAtTime(scene.broadcastGain ?? 0.8, this.context.currentTime, 0.015);
    for (const [id, voice] of this.voices) {
      const track = scene.tracks.find((t) => t.id === id);
      if (!track) {
        this.remove(id);
        continue;
      }
      voice.audio.loop = track.loop;
      voice.gain.gain.setTargetAtTime(effectiveGain(scene, id), this.context.currentTime, 0.015);
      voice.broadcastGain.gain.setTargetAtTime(
        track.broadcast ? effectiveGain(scene, id) : 0,
        this.context.currentTime,
        0.015,
      );
    }
  }

  async play(ids: string[]): Promise<void> {
    const generation = this.generation;
    const voices = ids.map((id) => this.voices.get(id));
    if (voices.some((v) => !v)) throw new Error('Аудиофайл не загружен. Откройте сцену повторно.');
    const requests = voices.map((voice) => ({ voice: voice!, request: ++voice!.request }));
    await this.ensureContext().resume();
    if (generation !== this.generation) return;
    try {
      await Promise.all(
        requests.map(async ({ voice, request }) => {
          if (voice.request !== request) return;
          if (voice.audio.ended) voice.audio.currentTime = 0;
          try {
            await voice.audio.play();
          } catch (error) {
            if (voice.request === request) throw error;
          }
        }),
      );
    } catch (error) {
      for (const { voice, request } of requests) {
        if (voice.request === request) {
          voice.request++;
          voice.audio.pause();
        }
      }
      throw error;
    }
  }
  pause(ids = [...this.voices.keys()]): void {
    ids.forEach((id) => {
      const voice = this.voices.get(id);
      if (voice) {
        voice.request++;
        voice.audio.pause();
      }
    });
  }
  stop(ids = [...this.voices.keys()]): void {
    ids.forEach((id) => {
      const v = this.voices.get(id);
      if (v) {
        v.request++;
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
    v.request++;
    v.audio.pause();
    v.audio.onerror = null;
    v.audio.removeAttribute('src');
    v.audio.load();
    v.source.disconnect();
    v.gain.disconnect();
    v.broadcastGain.disconnect();
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
