import { t, nameOf } from '../i18n';
import { MoreHorizontal, Pause, Play, Plus, Volume2 } from 'lucide-react';
import { ancestors, type Group } from '../domain/scene';
import type { Studio } from '../useStudio';
import { EditableName, IconButton, Volume } from './Controls';
import { TrackRow } from './TrackRow';
export function MixerGroup({
  group,
  studio,
  index,
  onImport,
  selectedId,
  onSelect,
  query = '',
}: {
  group: Group;
  studio: Studio;
  index: number;
  onImport: (groupId: string) => void;
  selectedId?: string;
  onSelect: (id: string) => void;
  query?: string;
}) {
  const scene = studio.scene!;
  const tracks = scene.tracks.filter((t) => t.groupId === group.id);
  const children = scene.groups.filter((g) => g.parentId === group.id);
  const ids = scene.tracks
    .filter((t) => ancestors(scene, t.groupId).some((g) => g.id === group.id) && studio.playback[t.id])
    .map((t) => t.id);
  const playing = ids.some((id) => studio.playback[id]?.playing);
  const canDelete = !tracks.length && !children.length && scene.groups.length > 1;
  return (
    <section
      className={`mixer-group color-${index % 3}`}
      aria-label={t('Группа {p0}', { p0: nameOf(group) })}
    >
      <div className="group-heading">
        <span className="group-marker" />
        <EditableName
          label={t('Название группы: {p0}', { p0: nameOf(group) })}
          value={nameOf(group)}
          disabled={studio.busy}
          onCommit={(name) => studio.groupChange(group.id, { name })}
        />
        <div className="group-controls">
          <IconButton
            label={`${playing ? t('Пауза группы') : t('Играть группу')}: ${nameOf(group)}`}
            disabled={studio.busy || !ids.length}
            onClick={() => (playing ? studio.pause(ids) : void studio.play(ids))}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </IconButton>
          <Volume2 size={17} className="volume-symbol" />
          <Volume
            label={t('Громкость группы: {p0}', { p0: nameOf(group) })}
            value={group.gain}
            disabled={studio.busy}
            onChange={(gain) => studio.groupChange(group.id, { gain })}
          />
          <IconButton
            label={t('Без звука: {p0}', { p0: nameOf(group) })}
            active={group.muted}
            disabled={studio.busy}
            onClick={() => studio.groupChange(group.id, { muted: !group.muted })}
          >
            M
          </IconButton>
          <IconButton
            label={t('Соло: {p0}', { p0: nameOf(group) })}
            active={group.solo}
            disabled={studio.busy}
            onClick={() => studio.groupChange(group.id, { solo: !group.solo })}
          >
            S
          </IconButton>
          <details className="menu">
            <summary aria-label={t('Настройки группы: {p0}', { p0: nameOf(group) })}>
              <MoreHorizontal size={18} />
            </summary>
            <div className="menu-content">
              <button disabled={studio.busy} onClick={() => onImport(group.id)}>
                <Plus size={15} />
                {t('Добавить аудио')}
              </button>
              <button disabled={studio.busy} onClick={() => studio.addGroup(group.id)}>
                {t('Добавить подгруппу')}
              </button>
              <button
                disabled={studio.busy || !canDelete}
                title={!canDelete ? t('Сначала удалите дорожки и подгруппы') : undefined}
                onClick={() =>
                  studio.change((s) => ({ ...s, groups: s.groups.filter((g) => g.id !== group.id) }))
                }
              >
                {t('Удалить пустую группу')}
              </button>
            </div>
          </details>
          <IconButton
            label={t('Добавить подкатегорию: {p0}', { p0: nameOf(group) })}
            disabled={studio.busy}
            onClick={() => studio.addGroup(group.id)}
          >
            <Plus size={18} />
          </IconButton>
        </div>
      </div>
      {tracks
        .filter((track) => nameOf(track).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
        .map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            studio={studio}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      {!tracks.length && !children.length && (
        <button className="empty-group" disabled={studio.busy} onClick={() => onImport(group.id)}>
          <Plus size={15} />
          {t('Добавить аудио в группу')}
        </button>
      )}
      {!!children.length && (
        <div className="nested-groups">
          {children.map((child) => (
            <MixerGroup
              key={child.id}
              group={child}
              studio={studio}
              index={index}
              onImport={onImport}
              selectedId={selectedId}
              onSelect={onSelect}
              query={query}
            />
          ))}
        </div>
      )}
    </section>
  );
}
