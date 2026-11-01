import { useRef, useState } from 'react';
import { AudioLines, Music2, Plus, Save, Search, Settings, SlidersHorizontal, X } from 'lucide-react';
import { useStudio } from './useStudio';
import { EditableName, IconButton } from './components/Controls';
import { MixerGroup } from './components/MixerGroup';
import { Sidebar } from './components/Sidebar';
import { Transport } from './components/Transport';
import { Inspector } from './components/Inspector';
import { Soundboard } from './components/Soundboard';
import { DesktopSettings } from './components/DesktopSettings';

export default function App() {
  const studio = useStudio();
  const picker = useRef<HTMLInputElement>(null);
  const targetGroup = useRef<string | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null | undefined>();
  const [trackQuery, setTrackQuery] = useState('');
  const [settings, setSettings] = useState(false);
  const openImport = (groupId?: string) => {
    targetGroup.current = groupId;
    picker.current?.click();
  };
  const scene = studio.scene;
  const selected =
    selectedId === null ? undefined : (scene?.tracks.find((t) => t.id === selectedId) ?? scene?.tracks[0]);
  return (
    <div className="studio">
      <Sidebar studio={studio} onDelete={() => setConfirmDelete(true)} />
      <main
        className={`workspace ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes('Files')) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!studio.busy) void studio.importFiles([...e.dataTransfer.files]);
        }}
      >
        <header className="workspace-header">
          <div className="scene-title">
            <label htmlFor="scene-name">Звуковая сцена</label>
            {scene ? (
              <EditableName
                className="scene-name"
                label="Название сцены"
                value={scene.name}
                disabled={studio.busy}
                onCommit={(name) => studio.change((s) => ({ ...s, name }))}
              />
            ) : (
              <h1>{studio.busy ? 'Открываем библиотеку…' : 'Библиотека недоступна'}</h1>
            )}
            <p>Окружение, музыка и эффекты в одном месте</p>
          </div>
          <div className="header-actions">
            <IconButton label="Приложение и компоненты" onClick={() => setSettings(true)}>
              <Settings size={20} />
            </IconButton>
            <button className="button" disabled={studio.busy || !scene} onClick={() => void studio.save()}>
              <Save size={18} /> Сохранить
            </button>
            <button className="button primary" disabled={studio.busy || !scene} onClick={() => openImport()}>
              <Plus size={20} /> Импорт аудио
            </button>
            <span className="save-state" role="status" aria-label="Сохранение сцены">
              {studio.busy ? 'Подготовка…' : studio.saved ? 'Сохранено на компьютере' : 'Сохранение…'}
            </span>
          </div>
        </header>
        {studio.error && (
          <div className="error-banner" role="alert">
            <span>{studio.error}</span>
            <IconButton label="Закрыть сообщение" onClick={studio.clearError}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        {scene && (
          <div className={`editing-area ${selected ? 'with-inspector' : ''}`}>
            <div className="mixer">
              <div className="mixer-toolbar">
                <h1>
                  <SlidersHorizontal size={16} /> Микшер
                </h1>
                <button
                  className="tab-link"
                  onClick={() =>
                    document
                      .getElementById('soundboard')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                  }
                >
                  <AudioLines size={16} /> Звуковая панель
                </button>
                <label className="search-field track-search">
                  <Search size={14} />
                  <input
                    aria-label="Поиск дорожек"
                    placeholder="Поиск дорожек…"
                    value={trackQuery}
                    onChange={(e) => setTrackQuery(e.target.value)}
                  />
                </label>
                <button className="button subtle" disabled={studio.busy} onClick={() => studio.addGroup()}>
                  <Plus size={17} /> Категория
                </button>
              </div>
              <div className="mixer-columns">
                <span>Название</span>
                <span>Воспроизведение</span>
                <span>Громкость</span>
              </div>
              <div className="group-list">
                {scene.groups
                  .filter((g) => g.parentId === null)
                  .map((group, index) => (
                    <MixerGroup
                      key={group.id}
                      group={group}
                      studio={studio}
                      index={index}
                      onImport={openImport}
                      selectedId={selected?.id}
                      onSelect={setSelectedId}
                      query={trackQuery}
                    />
                  ))}
              </div>
              <div className="drop-zone">
                <Music2 size={22} />
                <p>
                  {dragging
                    ? 'Отпустите файлы для импорта'
                    : 'Перетащите аудиофайлы сюда или нажмите «Импорт аудио»'}
                </p>
                <small>
                  WAV, MP3, OGG и другие форматы, поддерживаемые проигрывателем · до 100 МБ на файл
                </small>
                {!scene.tracks.length && (
                  <>
                    <button className="button" disabled={studio.busy} onClick={() => void studio.loadDemo()}>
                      Попробовать демосцену
                    </button>
                    <small>Три синтезированных звука для знакомства с микшером</small>
                  </>
                )}
              </div>
            </div>
            {selected && <Inspector track={selected} studio={studio} onClose={() => setSelectedId(null)} />}
          </div>
        )}
        {scene && <Soundboard studio={studio} onImport={() => openImport()} />}
      </main>
      <Transport studio={studio} />
      {settings && (
        <DesktopSettings
          onClose={() => setSettings(false)}
          canRestart={
            !studio.busy && studio.saved && !Object.values(studio.playback).some((track) => track.playing)
          }
        />
      )}
      <input
        ref={picker}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void studio.importFiles(files, targetGroup.current);
        }}
      />
      {confirmDelete && (
        <div className="modal-backdrop">
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">Удалить сцену «{scene?.name}»?</h2>
            <p>Настройки сцены будут удалены. Исходные файлы на диске останутся на месте.</p>
            <div className="dialog-actions">
              <button className="button" autoFocus onClick={() => setConfirmDelete(false)}>
                Отмена
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setConfirmDelete(false);
                  void studio.deleteScene();
                }}
              >
                Удалить сцену
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
