import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStages, SequenceController, validateStages } from './sequence';

const stages = [
  { id: 'one', sceneId: 'a', seconds: 2 },
  { id: 'two', sceneId: 'b', seconds: 0 },
];
function setup() {
  const existing = new Set(['original', 'a', 'b']);
  const play = vi.fn<(id: string, signal: AbortSignal) => Promise<boolean>>().mockResolvedValue(true);
  const restore = vi.fn<(id: string, signal: AbortSignal) => Promise<boolean>>().mockResolvedValue(true);
  const stop = vi.fn();
  const controller = new SequenceController({
    currentSceneId: () => 'original',
    sceneExists: (id) => existing.has(id),
    activateAndPlay: play,
    restoreScene: restore,
    stopPlayback: stop,
  });
  return { controller, existing, play, restore, stop };
}
afterEach(() => {
  vi.useRealTimers();
});

describe('scene sequence controller', () => {
  it('advances timed stages, waits at manual stages, and restores original scene once', async () => {
    vi.useFakeTimers();
    const { controller, play, restore, stop } = setup();
    await controller.start(stages);
    expect(play.mock.calls.map(([id]) => id)).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(2000);
    expect(play.mock.calls.map(([id]) => id)).toEqual(['a', 'b']);
    await vi.advanceTimersByTimeAsync(100000);
    expect(play).toHaveBeenCalledTimes(2);
    await controller.next();
    expect(controller.snapshot()).toMatchObject({ phase: 'idle', result: 'completed' });
    expect(restore).toHaveBeenCalledExactlyOnceWith('original', expect.any(AbortSignal));
    expect(stop.mock.calls.length).toBeGreaterThanOrEqual(3);
    controller.dispose();
  });
  it('cancels pending activation before restoring and does not schedule stale timers', async () => {
    vi.useFakeTimers();
    const { controller, play, restore } = setup();
    let resolve!: (success: boolean) => void;
    play.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const starting = controller.start(stages);
    await Promise.resolve();
    const stopping = controller.stop();
    expect(play.mock.calls[0][1].aborted).toBe(true);
    expect(controller.snapshot().phase).toBe('stopping');
    expect(restore).not.toHaveBeenCalled();
    resolve(true);
    await Promise.all([starting, stopping]);
    expect(restore).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(play).toHaveBeenCalledTimes(1);
    expect(controller.snapshot()).toMatchObject({ phase: 'idle', result: 'stopped' });
    controller.dispose();
  });
  it('skips removed future scenes and tolerates deletion of the original scene', async () => {
    vi.useFakeTimers();
    const { controller, existing, play, restore } = setup();
    await controller.start(stages);
    existing.delete('b');
    existing.delete('original');
    await vi.advanceTimersByTimeAsync(2000);
    expect(play).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();
    expect(controller.snapshot()).toMatchObject({ phase: 'idle', result: 'completed' });
    controller.dispose();
  });
  it('aborts on activation failure and never runs later stages', async () => {
    vi.useFakeTimers();
    const { controller, play, restore } = setup();
    play.mockResolvedValueOnce(false);
    await controller.start(stages);
    expect(controller.snapshot().result).toBe('failed');
    expect(restore).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(play).toHaveBeenCalledTimes(1);
    controller.dispose();
  });
  it('clears timers on disposal and suppresses restoration after pending activation', async () => {
    vi.useFakeTimers();
    const { controller, play, restore } = setup();
    let resolve!: (success: boolean) => void;
    play.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const starting = controller.start(stages);
    await Promise.resolve();
    controller.dispose();
    resolve(true);
    await starting;
    await vi.advanceTimersByTimeAsync(10000);
    expect(play.mock.calls[0][1].aborted).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();
  });
  it('ignores double starts and simultaneous next clicks during loading', async () => {
    const { controller, play } = setup();
    let resolve!: (success: boolean) => void;
    play.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const starting = controller.start(stages);
    await controller.start(stages);
    await controller.next();
    resolve(true);
    await starting;
    expect(play).toHaveBeenCalledTimes(1);
    await controller.stop();
    controller.dispose();
  });
  it('reports missing stages and restoration failures honestly', async () => {
    const { controller, existing, restore } = setup();
    existing.delete('a');
    existing.delete('b');
    await controller.start(stages);
    expect(controller.snapshot().result).toBe('empty');
    existing.add('a');
    restore.mockResolvedValue(false);
    await controller.start(stages);
    await controller.stop();
    expect(controller.snapshot().result).toBe('restore-failed');
    controller.dispose();
  });
});

describe('sequence persistence validation', () => {
  it('restores safe stage data and strips unsupported properties', () => {
    expect(validateStages([{ ...stages[0], script: 'alert(1)' }])).toEqual([stages[0]]);
    expect(readStages({ getItem: () => JSON.stringify(stages) })).toEqual(stages);
  });
  it('recovers from corrupt storage, duplicate IDs and invalid durations', () => {
    expect(readStages({ getItem: () => '{' })).toEqual([]);
    expect(
      readStages({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toEqual([]);
    for (const value of [
      [stages[0], stages[0]],
      [{ ...stages[0], seconds: -1 }],
      [{ ...stages[0], seconds: 86401 }],
      [{ ...stages[0], seconds: 0.5 }],
      Array(65).fill(stages[0]),
    ]) {
      expect(validateStages(value)).toEqual([]);
    }
  });
});
