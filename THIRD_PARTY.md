# Сторонние компоненты

В приложение входят React / React DOM (MIT), Lucide (ISC) и Electron (MIT). Electron поставляет собственные `LICENSE` и `LICENSES.chromium.html`; эти файлы сохраняются в Windows-сборке.

`npm run check:licenses` проверяет наличие допустимых идентификаторов лицензий у прямых распространяемых зависимостей. Это техническая проверка деклараций пакетов; она не заменяет полного анализа всех транзитивных компонентов перед релизом.

Фоновая иллюстрация леса создана с помощью генератора изображений для проекта. Звуки демосцены синтезируются алгоритмически приложением; сторонние аудиозаписи не включены.

Лицензия самого BardForge пока не выбрана. Не следует считать лицензии зависимостей лицензией проекта.

# Downloadable runtime

The optional Windows x64 Python embeddable distribution is downloaded from python.org only when requested. It is not bundled in the repository or installer. Python is covered by the PSF license and bundled third-party notices; see https://docs.python.org/3/license.html. The pinned catalog records version, byte count and SHA-256. Its extracted license is retained with the runtime. No AI model weights are distributed.

Desktop update delivery uses electron-updater (MIT); archive reading uses yauzl (MIT). Their license files remain in the packaged dependencies.

The separately hosted signaling relay uses ws (MIT). It is installed from its own lockfile; the relay's node_modules and credentials are not included in the desktop installer or public repository. Browser transport uses built-in WebRTC APIs.
