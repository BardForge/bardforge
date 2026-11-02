export interface SequenceStage {
  id: string;
  sceneId: string;
  seconds: number;
}
export const sequenceStorageKey = 'bardforge.sequence.v1';
export const maxSequenceStages = 64;

// Transport registers no engine callback here: this signal cancels orchestration,
// while its normal stop action handles playback. Internal stage stops never emit it.
const globalStopListeners = new Set<() => void>();
export function registerSequenceStop(listener: () => void): () => void {
  globalStopListeners.add(listener);
  return () => {
    globalStopListeners.delete(listener);
  };
}
export function requestSequenceStop(): void {
  globalStopListeners.forEach((listener) => listener());
}

export function validateStages(value: unknown): SequenceStage[] {
  if (!Array.isArray(value) || value.length > maxSequenceStages) return [];
  const ids = new Set<string>();
  const valid = value.every((stage) => {
    if (
      !stage ||
      typeof stage.id !== 'string' ||
      !stage.id ||
      stage.id.length > 256 ||
      ids.has(stage.id) ||
      typeof stage.sceneId !== 'string' ||
      !stage.sceneId ||
      stage.sceneId.length > 256 ||
      !Number.isInteger(stage.seconds) ||
      stage.seconds < 0 ||
      stage.seconds > 86400
    )
      return false;
    ids.add(stage.id);
    return true;
  });
  return valid ? value.map(({ id, sceneId, seconds }) => ({ id, sceneId, seconds })) : [];
}

export function readStages(storage: Pick<Storage, 'getItem'>): SequenceStage[] {
  try {
    return validateStages(JSON.parse(storage.getItem(sequenceStorageKey) ?? '[]'));
  } catch {
    return [];
  }
}

export type SequenceResult = 'completed' | 'stopped' | 'failed' | 'restore-failed' | 'empty' | null;
export interface SequenceState {
  phase: 'idle' | 'running' | 'stopping';
  index: number;
  transitioning: boolean;
  result: SequenceResult;
}
interface SequenceDependencies {
  currentSceneId: () => string | undefined;
  sceneExists: (id: string) => boolean;
  activateAndPlay: (id: string, signal: AbortSignal) => Promise<boolean>;
  restoreScene: (id: string, signal: AbortSignal) => Promise<boolean>;
  stopPlayback: () => void;
}

export class SequenceController {
  private state: SequenceState = { phase: 'idle', index: -1, transitioning: false, result: null };
  private listeners = new Set<() => void>();
  private stages: SequenceStage[] = [];
  private original?: string;
  private abort?: AbortController;
  private pending?: Promise<boolean>;
  private stopping?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  constructor(private readonly deps: SequenceDependencies) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<SequenceState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private clearTimer() {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  async start(stages: SequenceStage[]): Promise<void> {
    if (this.disposed || this.state.phase !== 'idle' || this.stopping) return;
    this.stages = validateStages(stages);
    if (!this.stages.some((stage) => this.deps.sceneExists(stage.sceneId))) {
      this.update({ result: 'empty' });
      return;
    }
    this.original = this.deps.currentSceneId();
    this.abort = new AbortController();
    this.update({ phase: 'running', result: null, index: -1 });
    await this.advance(0);
  }

  async next(): Promise<void> {
    if (this.disposed || this.state.phase !== 'running' || this.state.transitioning) return;
    await this.advance(this.state.index + 1);
  }

  private async advance(index: number): Promise<void> {
    this.clearTimer();
    while (index < this.stages.length && !this.deps.sceneExists(this.stages[index].sceneId)) index++;
    if (index === this.stages.length) {
      await this.finish('completed');
      return;
    }
    const stage = this.stages[index];
    const signal = this.abort!.signal;
    this.update({ index, transitioning: true });
    this.deps.stopPlayback();
    // Wrap synchronous throws too, and keep the pending operation available to stop().
    const pending = Promise.resolve().then(() => this.deps.activateAndPlay(stage.sceneId, signal));
    this.pending = pending;
    let success = false;
    try {
      success = await pending;
    } catch {
      /* surfaced as failed sequence */
    } finally {
      if (this.pending === pending) this.pending = undefined;
    }
    if (signal.aborted || this.disposed) return;
    if (!success) {
      await this.finish('failed');
      return;
    }
    this.update({ transitioning: false });
    if (stage.seconds > 0)
      this.timer = setTimeout(() => {
        void this.next();
      }, stage.seconds * 1000);
  }

  stop = (): Promise<void> => this.finish('stopped');

  private finish(result: SequenceResult): Promise<void> {
    if (this.stopping) return this.stopping;
    if (this.state.phase !== 'running' || this.disposed) return Promise.resolve();
    this.clearTimer();
    this.abort?.abort();
    this.update({ phase: 'stopping', transitioning: false });
    this.deps.stopPlayback();
    const pending = this.pending;
    this.stopping = (async () => {
      try {
        await pending;
      } catch {
        /* restore only after the old operation settles */
      }
      if (this.disposed) return;
      this.deps.stopPlayback();
      let finalResult = result;
      if (this.original && this.deps.sceneExists(this.original)) {
        const restoration = new AbortController();
        this.abort = restoration;
        try {
          if (!(await this.deps.restoreScene(this.original, restoration.signal)))
            finalResult = 'restore-failed';
        } catch {
          finalResult = 'restore-failed';
        }
      }
      if (!this.disposed) this.update({ phase: 'idle', index: -1, result: finalResult });
    })().finally(() => {
      this.stopping = undefined;
    });
    return this.stopping;
  }

  dispose() {
    this.disposed = true;
    this.clearTimer();
    this.abort?.abort();
    this.deps.stopPlayback();
    this.listeners.clear();
  }
}
