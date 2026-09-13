// Starts scripts/mock-opinly.mjs on an ephemeral port for the router tests and
// polls until it answers. stdio is fully detached so the test process can exit
// and the mock never hits EPIPE on its request logging; stop() kills it.
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

export default async function startMock() {
  const script = resolve(dirname(fileURLToPath(import.meta.url)), '../../scripts/mock-opinly.mjs');
  const port = 8790 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [script], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  child.unref();
  const stop = () => { try { child.kill(); } catch { /* already gone */ } };
  process.on('exit', stop);
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${url}/v1/content/routes`, { headers: { authorization: 'Bearer test' } });
      if (res.ok) return { url, stop };
    } catch { /* not up yet */ }
    await sleep(100);
  }
  stop();
  throw new Error('mock Opinly API did not start');
}
