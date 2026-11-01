import { build, Platform, Arch } from 'electron-builder';

// Explicit allowlist: specifications, agent files and user data never enter the app.
await build({
  targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
  publish: 'never',
  config: {
    appId: 'studio.bardforge.desktop',
    productName: 'BardForge Studio',
    directories: { output: 'build' },
    electronDownload: process.env.ELECTRON_CACHE ? { cache: process.env.ELECTRON_CACHE } : undefined,
    files: ['dist/**/*', 'electron/**/*.cjs', 'electron/catalog.json', 'package.json'],
    asar: true,
    npmRebuild: false,
    win: {
      target: 'nsis',
      artifactName: 'BardForge-Studio-Setup-${version}.${ext}',
      signAndEditExecutable: false,
    },
    nsis: {
      // Extract directly to the chosen destination and check extraction errors.
      // The 7z NSIS plugin can silently truncate on a full temporary drive.
      useZip: true,
      differentialPackage: false,
      oneClick: false,
      perMachine: false,
      allowElevation: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      deleteAppDataOnUninstall: false,
      runAfterFinish: true,
      installerLanguages: ['ru_RU', 'en_US'],
      displayLanguageSelector: true,
    },
    publish: [{ provider: 'github', owner: 'ShinozakiAichi', repo: 'BardForge-Studio' }],
  },
});
