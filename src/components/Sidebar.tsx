import { useState } from 'react';
import { Copy, FolderClosed, Plus, Search, Trash2, TreeDeciduous } from 'lucide-react';
import type { Studio } from '../useStudio';

export function Sidebar({ studio, onDelete }: { studio: Studio; onDelete: () => void }) {
  const [query, setQuery] = useState('');
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <TreeDeciduous size={30} />
        </div>
        <div className="wordmark">
          BardForge<span>Studio</span>
        </div>
      </div>
      <div className="section-label">Сцены</div>
      <label className="search-field">
        <Search size={16} />
        <input
          placeholder="Поиск сцен…"
          aria-label="Поиск сцен"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <nav aria-label="Сцены" className="scene-list">
        {studio.scenes
          .filter((s) => s.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
          .map((scene) => (
            <button
              key={scene.id}
              className={`scene-item ${scene.id === studio.scene?.id ? 'selected' : ''}`}
              aria-current={scene.id === studio.scene?.id ? 'page' : undefined}
              disabled={studio.busy}
              onClick={() => void studio.selectScene(scene.id)}
            >
              <span className="scene-thumb" />
              <span className="scene-item-text">
                <strong>{scene.name}</strong>
                <span>Дорожек: {scene.tracks.length}</span>
              </span>
            </button>
          ))}
      </nav>
      <button className="button new-scene" disabled={studio.busy} onClick={() => void studio.newScene()}>
        <Plus size={19} /> Новая сцена
      </button>
      {studio.scene && (
        <div className="scene-actions">
          <button
            disabled={studio.busy}
            title="Скопировать сцену"
            onClick={() => void studio.duplicateScene()}
          >
            <Copy size={15} /> Копия
          </button>
          <button disabled={studio.busy} title="Удалить сцену" onClick={onDelete}>
            <Trash2 size={15} /> Удалить
          </button>
        </div>
      )}
      <div className="library-note">
        <FolderClosed size={20} />
        <div>
          Локальная библиотека<small>Данные на этом компьютере</small>
        </div>
      </div>
    </aside>
  );
}
