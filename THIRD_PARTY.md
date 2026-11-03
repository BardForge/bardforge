# Сторонние компоненты

В приложение входят React / React DOM (MIT), Lucide (ISC) и Electron (MIT). Electron поставляет собственные `LICENSE` и `LICENSES.chromium.html`; эти файлы сохраняются в Windows-сборке.

`npm run check:licenses` проверяет наличие допустимых идентификаторов лицензий у прямых распространяемых зависимостей. Это техническая проверка деклараций пакетов; она не заменяет полного анализа всех транзитивных компонентов перед релизом.

Фоновая иллюстрация леса создана с помощью генератора изображений для проекта. Звуки демосцены синтезируются алгоритмически приложением; сторонние аудиозаписи не включены.

Собственный код BardForge распространяется по [MIT](LICENSE). [Границы лицензии](LICENSING.md) исключают автоматическое лицензирование сторонних компонентов и фирменных материалов.

# Downloadable runtime

The optional Windows x64 Python embeddable distribution is downloaded from python.org only when requested. It is not bundled in the repository or installer. Python is covered by the PSF license and bundled third-party notices; see https://docs.python.org/3/license.html. The pinned catalog records version, byte count and SHA-256. Its extracted license is retained with the runtime. No AI model weights are distributed.

Desktop update delivery uses electron-updater (MIT); archive reading uses yauzl (MIT). Their license files remain in the packaged dependencies.

## Проверка при принятии MIT

Проверены доступная история авторства и отслеживаемые файлы Core: сторонних vendor-каталогов, чужих copyright-заголовков, пользовательского аудио и весов моделей не обнаружено. Это ограниченная проверка доступных свидетельств, а не доказательство отсутствия любых прав третьих лиц. Иллюстрация `public/art/moonlit-forest.png` и снимки интерфейса рассматриваются отдельно от MIT на код. Логотип находится в репозитории организации и также не лицензируется как программный код.

В текущих lock-файлах Core есть 461 запись зависимостей и одна запись relay; все содержат декларацию лицензии. Это включает инструменты разработки и пакеты для нескольких платформ, а не 462 компонента Windows-установщика. У прямых распространяемых зависимостей проверены MIT/ISC-декларации. Транзитивные `argparse` (Python-2.0) и `sax` (BlueOak-1.0.0) сохраняют свои условия; MIT BardForge их не заменяет. `caniuse-lite` (CC-BY-4.0) и `lightningcss` (MPL-2.0) относятся к инструментам разработки. Для каждого варианта распространения проверяйте фактический состав и сохраняйте исходные LICENSE/NOTICE, включая файлы Electron и Chromium.

Авторский код демосинтеза лицензирован по MIT; это не предоставляет права на импортированные пользователем записи. Снимки в `docs/images/` сняты на встроенной демосцене в пустом браузерном профиле.

The separately hosted signaling relay uses ws (MIT). It is installed from its own lockfile; the relay's node_modules and credentials are not included in the desktop installer or public repository. Browser transport uses built-in WebRTC APIs.
