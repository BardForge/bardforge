interface ComponentState {
  id: string;
  version: string;
  bytes: number;
  received: number;
  status: 'available' | 'downloading' | 'installing' | 'installed' | 'paused' | 'error';
  errorCode?: 'disk-space' | 'download';
}
interface DesktopStatus {
  version: string;
  update: {
    status: 'idle' | 'development' | 'checking' | 'current' | 'downloading' | 'ready' | 'error';
    percent?: number;
  };
  components: ComponentState[];
}
interface Window {
  bardforge?: {
    status(): Promise<DesktopStatus>;
    checkUpdates(): Promise<void>;
    installUpdate(): Promise<void>;
    installComponent(id: string): Promise<void>;
    cancelComponent(id: string): Promise<void>;
  };
}
