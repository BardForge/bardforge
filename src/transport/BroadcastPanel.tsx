import { useEffect, useRef, useState } from 'react';
import { RelayAudioClient, type TransportStatus } from './publisher';

const copy = {
  ru: {
    title: 'Трансляция в Foundry',
    url: 'Адрес ретранслятора',
    room: 'Комната',
    token: 'Ключ ведущего',
    advanced: 'Настройки соединения',
    relay: 'Только через TURN',
    stun: 'Адрес STUN',
    turn: 'Адрес TURN',
    username: 'Пользователь TURN',
    password: 'Пароль TURN',
    start: 'Начать трансляцию',
    stop: 'Остановить',
    listeners: 'Слушателей',
    hint: 'В эфир идут только отмеченные дорожки. Игроки включают звук в модуле BardForge Receiver. Для интернета нужны WSS и настроенный TURN. Ключ не сохраняется.',
    invalid: 'Проверьте адрес /relay, комнату, ключ (от 32 символов) и адреса серверов соединения.',
    idle: 'Выключено',
    connecting: 'Подключение…',
    waiting: 'Ожидание слушателей',
    live: 'В эфире',
    reconnecting: 'Восстановление связи…',
    'auth-error': 'Неверный ключ или комната',
    error: 'Подключение отклонено; проверьте, не подключён ли другой ведущий',
  },
  en: {
    title: 'Broadcast to Foundry',
    url: 'Relay address',
    room: 'Room',
    token: 'Publisher key',
    advanced: 'Connection settings',
    relay: 'Require TURN relay',
    stun: 'STUN address',
    turn: 'TURN address',
    username: 'TURN username',
    password: 'TURN password',
    start: 'Start broadcast',
    stop: 'Stop broadcast',
    listeners: 'Listeners',
    hint: 'Only selected tracks are broadcast. Players enable audio in the BardForge Receiver module. Internet sessions need WSS and configured TURN. The key is not saved.',
    invalid: 'Check the /relay URL, room, key (at least 32 characters), and connection server addresses.',
    idle: 'Off',
    connecting: 'Connecting…',
    waiting: 'Waiting for listeners',
    live: 'Live',
    reconnecting: 'Reconnecting…',
    'auth-error': 'Incorrect key or room',
    error: 'Connection rejected; check whether another publisher is connected',
  },
};

export function BroadcastPanel({
  streamFactory,
  locale = 'ru',
}: {
  streamFactory: () => MediaStream;
  locale?: 'ru' | 'en';
}) {
  const labels = copy[locale];
  const [url, setUrl] = useState('');
  const [room, setRoom] = useState('');
  const [token, setToken] = useState('');
  const [stun, setStun] = useState('');
  const [turn, setTurn] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [relayOnly, setRelayOnly] = useState(false);
  const [status, setStatus] = useState<TransportStatus>({ state: 'idle', listeners: 0 });
  const [invalid, setInvalid] = useState(false);
  const client = useRef<RelayAudioClient | null>(null);
  useEffect(() => () => client.current?.stop(), []);
  const active = ['connecting', 'waiting', 'live', 'reconnecting'].includes(status.state);
  const start = () => {
    client.current?.stop();
    setInvalid(false);
    try {
      const iceServers: RTCIceServer[] = [];
      if (stun.trim()) iceServers.push({ urls: stun.trim() });
      if (turn.trim())
        iceServers.push({ urls: turn.trim(), username: username.trim(), credential: password });
      if (relayOnly && !turn.trim()) throw new Error('turn-required');
      client.current = new RelayAudioClient({
        url: url.trim(),
        room: room.trim(),
        token: token.trim(),
        role: 'publisher',
        stream: streamFactory(),
        iceServers,
        relayOnly,
        onState: setStatus,
      });
      client.current.start();
    } catch {
      client.current?.stop();
      setInvalid(true);
    }
  };
  return (
    <details className="broadcast-panel">
      <summary>
        {labels.title} · {labels[status.state]}
      </summary>
      <p>{labels.hint}</p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 640 }}>
        <label>
          {labels.url}
          <input
            aria-label={labels.url}
            type="url"
            placeholder="wss://relay.example.org/relay"
            value={url}
            disabled={active}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label>
          {labels.room}
          <input
            aria-label={labels.room}
            value={room}
            disabled={active}
            maxLength={64}
            onChange={(e) => setRoom(e.target.value)}
          />
        </label>
        <label>
          {labels.token}
          <input
            aria-label={labels.token}
            type="password"
            autoComplete="off"
            value={token}
            disabled={active}
            maxLength={256}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <details>
          <summary>{labels.advanced}</summary>
          <label>
            {labels.stun}
            <input
              aria-label={labels.stun}
              placeholder="stun:stun.example.org:3478"
              value={stun}
              disabled={active}
              onChange={(e) => setStun(e.target.value)}
            />
          </label>
          <label>
            {labels.turn}
            <input
              aria-label={labels.turn}
              placeholder="turns:turn.example.org:5349"
              value={turn}
              disabled={active}
              onChange={(e) => setTurn(e.target.value)}
            />
          </label>
          <label>
            {labels.username}
            <input
              aria-label={labels.username}
              value={username}
              disabled={active}
              autoComplete="off"
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            {labels.password}
            <input
              aria-label={labels.password}
              type="password"
              value={password}
              disabled={active}
              autoComplete="off"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={relayOnly}
              disabled={active}
              onChange={(e) => setRelayOnly(e.target.checked)}
            />{' '}
            {labels.relay}
          </label>
        </details>
        <div role="status">
          {labels[status.state]} · {labels.listeners}: {status.listeners}
        </div>
        {invalid && <p role="alert">{labels.invalid}</p>}
        <button type="button" onClick={active ? () => client.current?.stop() : start}>
          {active ? labels.stop : labels.start}
        </button>
      </div>
    </details>
  );
}
