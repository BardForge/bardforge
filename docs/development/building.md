# Запуск и сборка для разработчиков

[Документация](../README.md) → Сборка

Используйте Node.js 24, npm и Git. Для Windows EXE требуется Windows x64. Из корня checkout актуальной `dev`:

```sh
npm ci
npm ci --prefix services/relay
npm run dev
```

`npm run dev:web` открывает браузерный просмотр через локальный Vite. Компоненты и автообновления доступны только в Electron. Данные браузера и desktop-приложения разделены.

```sh
npm run build
npm run package:win
```

EXE: `build/BardForge-Studio-Setup-<версия>.exe`; распакованная программа: `build/win-unpacked/`. Сборка не публикует релиз. Не редактируйте исходники во время упаковки. Тестовые сборки не подписаны сертификатом издателя.

Сборка должна сохранять MIT-уведомление BardForge и собственные лицензии зависимостей/Electron/Chromium. Не удаляйте их для уменьшения размера. [Лицензирование](../../LICENSING.md), [проверки](testing.md), [релизные условия](../releases/README.md).
