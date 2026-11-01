import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createUpdates } from '../electron/updates.cjs';

test('development never checks or installs a release', async () => {
  const updater = new EventEmitter();
  updater.checkForUpdates = () => {
    throw new Error('must not check');
  };
  updater.quitAndInstall = () => {
    throw new Error('must not install');
  };
  const service = createUpdates(updater, false);
  await service.check();
  service.install();
  assert.equal(service.state().status, 'development');
});
test('stable update downloads automatically but restart requires explicit ready action', async () => {
  const updater = new EventEmitter();
  let installs = 0;
  updater.quitAndInstall = () => installs++;
  updater.checkForUpdates = async () => {
    updater.emit('update-available');
    return { downloadPromise: Promise.resolve().then(() => updater.emit('update-downloaded')) };
  };
  const service = createUpdates(updater, true);
  assert.equal(updater.autoDownload, true);
  assert.equal(updater.autoInstallOnAppQuit, false);
  service.install();
  assert.equal(installs, 0);
  await service.check();
  assert.equal(service.state().status, 'ready');
  assert.equal(installs, 0);
  service.install();
  assert.equal(installs, 1);
});
test('network failure permits retry without breaking local app', async () => {
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => {
    throw new Error('offline');
  };
  const service = createUpdates(updater, true);
  await service.check();
  assert.equal(service.state().status, 'error');
  updater.checkForUpdates = async () => updater.emit('update-not-available');
  await service.check();
  assert.equal(service.state().status, 'current');
});
