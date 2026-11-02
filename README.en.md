# BardForge Studio

[Русский](README.md) · English

A desktop audio mixer for tabletop RPG and D&D game masters: ambience, music, sound effects and saved scenes.

**Status: local development build, not a stable release.** Windows x64, Electron + React. The separate [Foundry module](https://github.com/BardForge/bardforge-foundry) is experimental; real remote-player playback is not verified. AI features are not implemented.

**AI-Assisted Development.** BardForge is developed with assistance from artificial intelligence tools. AI may contribute to code, documentation, testing, and technical design. All contributions remain subject to human review, validation, and applicable licensing requirements.

Organization: [BardForge](https://github.com/BardForge). [Shared development board](https://github.com/orgs/BardForge/projects/1), [contributing](CONTRIBUTING.md), [security](SECURITY.md), [limitations](DISCLAIMER.md). This repository has not yet been transferred to the organization.

## Available features

- Import local audio, including WAV, MP3 and OGG: up to 100 MB per file and 128 tracks per scene.
- Create and rename categories and nested subcategories, up to 64 per scene. Volume, mute and solo inherit through the hierarchy.
- Play, pause, stop, seek and loop audio. Trigger individual sounds from the soundboard or F1–F12.
- Create, duplicate and delete scenes. Scene settings and copies of audio are saved locally.
- Export portable `.bardforge` packages with original audio and import a new copy without overwriting the library. Packages are limited to 256 MB and audio integrity is checked with SHA-256.
- Arrange saved scenes into timed or manually advanced sequences. Stopping restores the original scene; sequences never auto-start after a restart.
- Choose dark, light or system appearance, four accent colors and compact mixer spacing. Preferences are stored locally.
- Three synthesized demo sounds. Original files remain untouched.
- Switch the entire interface between Russian and English, including tooltips, dialogs, errors, download states and built-in names. The choice persists after restarting and switching does not interrupt playback.
- Standalone Windows EXE installer. The mixer needs no separate Node.js or Python installation.
- Download an isolated Python runtime from python.org, resume partial downloads, verify SHA-256 and test execution. System Python and PATH remain unchanged.

Custom names and names in older scenes without language metadata remain exactly as entered. The installer has its own language selector; the app has a language selector in the header and settings. Native file dialogs follow the Windows language.

Python can be prepared in advance. Working AI modules and a model catalog are not available yet. Future module dependencies will be delivered as verified packages; this embedded runtime is not intended for manual pip use.

## Running and building

Users will install `BardForge-Studio-Setup-<version>.exe`. No public stable release is available yet. The installer runs for the current user without requiring administrator privileges. Local development builds are unsigned.

For development, use Node.js 24:

```sh
npm ci
npm ci --prefix services/relay
npm run dev
```

Use `npm run dev:web` for a browser preview. Component downloads and app updates require the Windows application.

```sh
npm test
npm run lint
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e
npm run package:win
npm run test:desktop
npm run test:installer
npm audit --audit-level=moderate
npm run check:licenses
npm run check:public
```

The installer is written to `build/`; the unpacked app is in `build/win-unpacked/`. Building never publishes a release automatically.

`test:installer` installs into an isolated test directory, checks installed file integrity, exercises the app and removes the test installation. It refuses to run when BardForge is already installed or running. Set `BARDFORGE_TEST_DOWNLOADS=1` to test real Python downloads.

## Local data and updates

Development builds store data in `%APPDATA%/BardForge Studio Dev`; stable builds use `%APPDATA%/BardForge Studio`. Scenes and audio are stored in IndexedDB; optional components live in the `components` subdirectory. Deleting a scene retains audio blobs that other scenes may use. Unused audio cleanup is not implemented. Uninstalling preserves the library.

Stable builds check GitHub Releases on startup and every six hours, download updates and offer installation after playback stops and saving completes. They never automatically restart during a session. Development builds do not receive release updates. Differential downloads are disabled. Update delivery between two published versions is **NOT VERIFIED** because there are no public releases yet.

## Limitations

This is a development version of the standalone local mixer. Foundry integration is planned as a separately installable module and is not part of the main interface. Experimental integration source and its standalone signaling service are in `modules/foundry/` and `services/relay/`; downloading this add-on through a module manager is not released yet. Remote playback in a real Foundry world is **NOT VERIFIED** and must be tested before a stable integration release.

Discord, device routing, voice changing, AI generation, the community module catalog and clip timelines are not implemented. Sequences use saved scenes; crossfades and a separate versioned preset model are not supported yet. Windows x64 is tested locally and in CI; ARM64, Linux and macOS are not supported targets yet.

Audio uses Web Audio and HTMLAudio. Professional low latency has not been measured. A native engine or SQLite storage would require further work and data migration. Signal-level tests do not replace listening on the target hardware.

## Contributing and licensing

`main` is for stable releases; `dev` is for integration. Development uses topic branches with pull requests into `dev`. Merges and releases require maintainer approval. See [CONTRIBUTING.md](CONTRIBUTING.md).

The project's source license has not been selected. Public availability does not automatically grant a license to use it. Third-party dependencies and original demonstration material are described in [THIRD_PARTY.md](THIRD_PARTY.md).
