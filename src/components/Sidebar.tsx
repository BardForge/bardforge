import { t, nameOf } from '../i18n';
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
      <div className="section-label">{t('Сцены')}</div>
      <label className="search-field">
        <Search size={16} />
        <input
          placeholder={t('Поиск сцен…')}
          aria-label={t('Поиск сцен')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <nav aria-label={t('Сцены')} className="scene-list">
        {studio.scenes
          .filter((s) => nameOf(s).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
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
                <strong>{nameOf(scene)}</strong>
                <span>{t('Дорожек: {count}', { count: scene.tracks.length })}</span>
              </span>
            </button>
          ))}
      </nav>
      <button className="button new-scene" disabled={studio.busy} onClick={() => void studio.newScene()}>
        <Plus size={19} />
        {t('Новая сцена')}
      </button>
      {studio.scene && (
        <div className="scene-actions">
          <button
            disabled={studio.busy}
            title={t('Скопировать сцену')}
            onClick={() => void studio.duplicateScene()}
          >
            <Copy size={15} />
            {t('Копия')}
          </button>
          <button disabled={studio.busy} title={t('Удалить сцену')} onClick={onDelete}>
            <Trash2 size={15} />
            {t('Удалить')}
          </button>
        </div>
      )}
      <div className="library-note">
        <FolderClosed size={20} />
        <div>
          {t('Локальная библиотека')}
          <small>{t('Данные на этом компьютере')}</small>
        </div>
      </div>
    </aside>
  );
}
