import { Pause, Play, Square, Volume2 } from 'lucide-react';
import type { Studio } from '../useStudio';
import { Volume } from './Controls';

export function Transport({ studio }: { studio: Studio }) {
  const ids = studio.scene?.tracks.filter((t) => studio.playback[t.id]).map((t) => t.id) ?? [];
  const playing = ids.some((id) => studio.playback[id]?.playing);
  return (
    <footer className="transport">
      <button
        className="button primary play-scene"
        disabled={studio.busy || !ids.length}
        onClick={() => (playing ? studio.pause() : void studio.play(ids))}
      >
        {playing ? <Pause size={20} /> : <Play size={20} />}
        {playing ? 'Пауза сцены' : 'Играть сцену'}
      </button>
      <button className="button stop-button" disabled={!ids.length} onClick={() => studio.stop()}>
        <Square size={17} /> Стоп
      </button>
      <div className="transport-state">
        <output className="signal" aria-label="Уровень сигнала" data-level={studio.level.toFixed(5)}>
          <span style={{ height: `${Math.min(100, studio.level * 500)}%` }} />
        </output>
        <span>
          {studio.busy ? 'Подготовка аудио…' : playing ? 'Сцена звучит' : 'Готово к воспроизведению'}
        </span>
      </div>
      <div className="master-volume">
        <span>Общая громкость</span>
        <Volume2 size={19} />
        <Volume
          label="Общая громкость"
          value={studio.scene?.masterGain ?? 0.8}
          disabled={studio.busy}
          onChange={(masterGain) => studio.change((s) => ({ ...s, masterGain }))}
        />
      </div>
    </footer>
  );
}
