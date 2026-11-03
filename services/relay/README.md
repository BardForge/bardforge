# BardForge signaling relay

> Основной репозиторий интеграции: [BardForge/bardforge-foundry](https://github.com/BardForge/bardforge-foundry). Эта копия сохранена для проверок Core; новые изменения транспорта направляйте сначала туда. [Границы и порядок синхронизации](../../docs/integrations/foundry.md).

Development transport for a private tabletop session. One authenticated publisher sends its selected mixer output to up to 16 listeners by default. The standalone Node service forwards WebRTC offers, answers and ICE candidates. **Audio travels over encrypted WebRTC, directly or through your TURN server; this service does not host or record audio.** Each listener consumes a separate outgoing stream from the publisher.

**Optional add-on source, not enabled in the base Studio application.** The current base app does not mount the publisher panel or expose broadcast track controls. The receiver and relay can be tested with the included browser proof; using them with Studio requires a future separately integrated publisher add-on. The steps below describe that integration's deployment, not an already available base-app feature.

## Local check

Requires Node 22.12 or newer. From the repository root:

```powershell
npm ci --prefix services/relay
$env:BARDFORGE_ROOM = 'my-table'
$env:BARDFORGE_PUBLISH_TOKEN = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
$env:BARDFORGE_LISTEN_TOKEN = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node services/relay/server.mjs
```

For a host application that integrates `src/transport/BroadcastPanel.tsx`, configure `ws://127.0.0.1:8787/relay`, the room and publisher key in that panel. Configure the same room/address and **listener** key in the Foundry receiver. Share only the listener key with players. The panel keeps the publisher key in memory and does not include it in profiles, scene packs or saved browser storage. The receiver's listener key is a world setting visible to world users. To validate the standalone transport now, run `node tests/transport.browser.mjs` instead of looking for broadcast controls in the base app.

These localhost addresses only work when the receiver browser and relay are on the same computer. Players on other computers need the public WSS endpoint below. Both keys must be different and contain 32–256 characters; generate random keys rather than passwords. Avoid shell tracing and never put keys into source control.

## Host an internet session

1. Deploy `package.json`, `package-lock.json` and `server.mjs` to a server with Node. Run `npm ci --omit=dev` in that directory. Supply `BARDFORGE_ROOM`, `BARDFORGE_PUBLISH_TOKEN` and `BARDFORGE_LISTEN_TOKEN` using your host's secret/environment settings.
2. Keep the service bound to loopback (default `HOST=127.0.0.1`, `PORT=8787`). Run it under your service manager as an unprivileged user. Expose only your HTTPS reverse proxy publicly. The health endpoint is `/health` and returns no configuration or credentials.
3. Point a DNS name to that server and terminate TLS with a trusted certificate. For example, a [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) configuration is:

   ```caddyfile
   relay.example.org {
       reverse_proxy 127.0.0.1:8787
   }
   ```

   Caddy provisions HTTPS for a reachable public hostname. Set Studio and Foundry to `wss://relay.example.org/relay`. Proxy WebSocket upgrades, allow long-lived connections, and do not log WebSocket frames. A certificate warning is not a valid TLS setup. The clients reject remote unencrypted `ws:` URLs.

4. Provide a [TURN server](https://webrtc.org/getting-started/turn-server) with appropriately restricted or short-lived credentials. Enter the TURN address, username and password in the integrated publisher panel's advanced connection settings and Foundry's module settings. STUN alone cannot traverse every NAT/firewall. TURN is a separate service, with its own firewall ports and bandwidth budget; deploying the WSS relay does not provide TURN.
5. Optionally enable “Require TURN relay” on **both** clients to avoid direct peer connections. Direct WebRTC connections expose peer network addresses to participants. With this option enabled, valid working TURN credentials are required.
6. Enable the receiver module, have each player click **Enable audio**, then start the integrated publisher. A “Live” indication requires an established peer connection. Verify audible output with the actual remote players before the session.

Optional environment variables:

| Variable                  | Default     | Purpose                                                 |
| ------------------------- | ----------- | ------------------------------------------------------- |
| `HOST`                    | `127.0.0.1` | Bind address; keep behind the TLS proxy                 |
| `PORT`                    | `8787`      | HTTP/WebSocket port                                     |
| `BARDFORGE_MAX_LISTENERS` | `16`        | Listener limit, 1–64                                    |
| `BARDFORGE_ORIGINS`       | empty       | Optional comma-separated exact browser Origin allowlist |

If an Origin allowlist is enabled, include the Foundry HTTPS origin and Studio's actual Origin header. The desktop uses the secure `bardforge://app` custom scheme; development uses its exact localhost origin. Verify the emitted Origin for your packaged version before enforcing the allowlist. Origin checks supplement token authentication; they do not replace it. Empty means any Origin may attempt token authentication. Rotate both room keys by updating the server environment and restarting, then update authorized clients.

## Limits and validation

- No credentials in URL query strings or logs. Authentication is the first WebSocket message; publisher and listener tokens are distinct. There is one publisher per room, no listener-to-listener signaling, and no discovery/listing API.
- 5-second authentication deadline, 64 KiB incoming messages, 256 messages per 10 seconds per connection, 256 KiB outgoing buffer cutoff, bounded connection count, and 15-second ping heartbeats. Binary payloads are rejected. Audio jitter/buffering is managed by WebRTC, without an application audio-chunk queue.
- Failed peer negotiation is bounded to 30 seconds. Disconnects trigger reconnection with capped exponential delay; permanent credential/configuration errors require correction and a new start. Stopping closes peers without stopping mixer-owned audio tracks.
- Local verification: `node --test tests/transport.node.test.mjs` and `node tests/transport.browser.mjs` (from the repository root, after both dependency installs and Playwright Chromium installation). The browser proof checks real Opus RTP and a decoded nonzero waveform in two isolated contexts, listener volume, relay restart and stopping the sender.
- No actual user's Foundry world or remote TURN deployment is certified by these local checks. This is an initial integration, with no recording, synchronization guarantee, TURN credential service, multi-room administration or large-audience SFU.

Protocol implementation references: [W3C WebRTC](https://www.w3.org/TR/webrtc/), [remote streams](https://webrtc.org/getting-started/remote-streams), [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay/).

## Кратко по-русски

Ретранслятор передаёт только служебные сообщения соединения. Звук идёт через WebRTC напрямую или через отдельный TURN-сервер. Для удалённых игроков нужен публичный адрес **WSS с действующим TLS-сертификатом**, а для надёжного соединения через NAT — TURN. Адрес localhost подходит только для проверки на одном компьютере.

Это исходники отдельного будущего дополнения: в базовом Studio сейчас нет панели трансляции и переключателей эфира. Браузерный тест проверяет рабочую передачу звука отдельно от основного приложения. Для пользовательского запуска нужна отдельная интеграция панели отправителя.

Создайте разные случайные ключи ведущего и слушателей. Ключ ведущего вводится только в панели отправителя; ключ слушателей — в настройках модуля Foundry и доступен участникам мира. Игроки нажимают «Включить звук» и регулируют свою громкость. Настройка TURN находится в дополнительных параметрах соединения. Перед сессией проверьте звук с реальными удалёнными игроками: локальная автоматическая проверка не подтверждает работу конкретного хостинга или мира Foundry.
