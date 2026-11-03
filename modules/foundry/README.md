# BardForge Receiver for Foundry VTT

> Основной репозиторий интеграции: [BardForge/bardforge-foundry](https://github.com/BardForge/bardforge-foundry). Эта копия сохранена для проверок Core; новые изменения транспорта направляйте сначала туда. [Границы и порядок синхронизации](../../docs/integrations/foundry.md).

An optional browser receiver for the Studio broadcast bus. It uses the included dependency-free WebRTC client and a separately hosted [authenticated signaling relay](../../services/relay/README.md). It does not upload scenes or audio files to Foundry and does not use Foundry's socket to carry audio.

**Separate development add-on:** the base Studio application currently does not expose a publisher panel. The receiver ZIP alone does not enable broadcasting from the base app. Publisher integration is future work; the included browser transport test provides a working standalone sender/receiver verification.

## Installation and use

1. Copy the **`bardforge-receiver` folder**, including `module.json`, into your Foundry user-data `Data/modules/` directory. Restart Foundry and enable **BardForge Receiver** for the world. Do this only with the world administrator's approval.
2. In **Configure Settings → Module Settings → BardForge Receiver**, set the relay URL, room and **listener key**. The publisher key belongs only in Studio. Remote URLs must use `wss://` and end in `/relay`. Configure STUN/TURN as provided by your relay administrator; TURN is normally needed for internet sessions.
3. Each player clicks **Enable audio** in the BardForge panel. Browsers require a user gesture for playback; the module never bypasses this. Each browser has its own saved volume slider and can disable audio at any time.
4. Start a host application integrating the shared `RelayAudioClient` publisher with a real audio `MediaStream`. The source includes an optional publisher panel under `src/transport`, but the base Studio application does not mount it. The receiver waits for that publisher and reconnects after transient network loss.

The interface follows Foundry's English/Russian language setting. Listener and TURN credentials are world settings, readable by users of that world. Use dedicated listening credentials and limited-lifetime TURN credentials. Changing connection settings requires reloading the world clients; playback still requires each player's consent.

This module targets Foundry 13+ using the documented `init`/`ready` hooks and `game.settings` API. Its manifest intentionally does not declare a `verified` Foundry version until a real installation has been tested. Browser transport verification does not establish compatibility with every Foundry version, hosting proxy, system or module combination. No installation into a user's world is performed by the build or tests.

See [Foundry module development](https://foundryvtt.com/article/module-development/) and [Foundry 13 settings API](https://foundryvtt.com/api/v13/classes/foundry.helpers.ClientSettings.html) for the host integration.

## Установка и использование

1. Поместите папку **`bardforge-receiver`** в `Data/modules/` каталога пользовательских данных Foundry. Перезапустите Foundry и включите модуль в мире с разрешения его администратора.
2. В настройках модуля укажите адрес WSS, комнату и **ключ слушателя**. Ключ ведущего остаётся только в Studio. Для интернета настройте TURN по данным администратора.
3. Каждый игрок нажимает **«Включить звук»**. Ползунок регулирует только его громкость. Кнопка **«Выключить звук»** прекращает приём.
4. Запустите отправителя, использующего `RelayAudioClient` с аудиопотоком `MediaStream`. Панель отправителя находится в исходниках `src/transport`, но не подключена в базовом Studio. Установка ZIP приёмника сама по себе не добавляет трансляцию в основное приложение. При кратком обрыве связи модуль переподключается.

Модуль предназначен для Foundry 13+, но версия совместимости не помечена как проверенная до испытания в реальном экземпляре Foundry. Проверка браузерной передачи звука не заменяет проверку мира, хостинга и удалённого TURN.
