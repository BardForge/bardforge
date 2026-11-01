import { validateScene, type AudioAsset, type Scene } from '../domain/scene';

export class Repository {
  private database?: Promise<IDBDatabase>;
  constructor(private readonly name = 'bardforge-library-v1') {}

  private open(): Promise<IDBDatabase> {
    return (this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('scenes', { keyPath: 'id' });
        db.createObjectStore('assets', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        this.database = undefined;
        reject(request.error);
      };
      request.onblocked = () => reject(new Error('Закройте другие окна BardForge и повторите открытие.'));
    }));
  }

  private async transact<T>(
    store: string,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = action(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () =>
        reject(tx.error ?? request.error ?? new Error('Не удалось сохранить данные на диск.'));
      tx.onerror = () => reject(tx.error ?? request.error);
    });
  }
  async listScenes(): Promise<Scene[]> {
    const values = await this.transact<Scene[]>('scenes', 'readonly', (s) => s.getAll());
    return values.map(validateScene).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async saveScene(scene: Scene): Promise<void> {
    const valid = validateScene(scene);
    await this.transact('scenes', 'readwrite', (s) => s.put(valid));
  }
  async deleteScene(id: string): Promise<void> {
    await this.transact('scenes', 'readwrite', (s) => s.delete(id));
  }
  async saveAsset(asset: AudioAsset): Promise<void> {
    if (!(asset.blob instanceof Blob) || !asset.id || !Number.isFinite(asset.duration) || asset.duration <= 0)
      throw new Error('Некорректный аудиофайл.');
    await this.transact('assets', 'readwrite', (s) => s.put(asset));
  }
  async getAsset(id: string): Promise<AudioAsset | undefined> {
    return this.transact('assets', 'readonly', (s) => s.get(id));
  }
  async close(): Promise<void> {
    if (this.database) (await this.database).close();
    this.database = undefined;
  }
}
