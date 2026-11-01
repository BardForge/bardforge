import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';

const server = await createServer();
await server.listen();
const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, BARDFORGE_DEV_URL: 'http://127.0.0.1:5173' },
});
child.once('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
child.once('error', async (error) => {
  console.error(error);
  await server.close();
  process.exit(1);
});
process.once('SIGINT', () => child.kill());
process.once('SIGTERM', () => child.kill());
