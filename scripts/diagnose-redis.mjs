/**
 * Diagnoses credentials and Redis command support without showing secrets.
 * Run: npm run redis:check
 */
import { Redis } from '@upstash/redis';
import { randomUUID } from 'node:crypto';

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

if (!url || !token) {
  console.error('FAIL: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing.');
  process.exit(1);
}

try {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:') throw new Error('HTTPS required');
} catch {
  console.error('FAIL: Redis REST URL must be a valid HTTPS URL.');
  process.exit(1);
}

let redis;
try {
  redis = new Redis({ url, token });
} catch {
  console.error('FAIL: Could not initialize Redis client; check REST URL/token format.');
  process.exit(1);
}
let failures = 0;

/** Classify failures without leaking endpoint addresses or tokens. */
function categorize(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/unauthorized|invalid.*token|401/i.test(message)) return 'authentication';
  if (/403|forbidden|permission denied/i.test(message)) return 'permission';
  if (/fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|timeout/i.test(message)) {
    return 'network/DNS';
  }
  if (/EVAL|script|unknown command/i.test(message)) return 'command';
  return 'unknown';
}

async function check(name, operation) {
  try {
    await operation();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${name} (${categorize(error)})`);
  }
}

const key = `sketch:diagnostics:${randomUUID()}`;
await check('PING / Redis authentication', () => redis.ping());
await check('EVAL (atomic rate limiting)', async () => {
  const response = await redis.eval('return ARGV[1]', [], ['sketch-ok']);
  if (response !== 'sketch-ok') throw new Error('Unexpected script response');
});
await check('SET NX / GET / DEL (room storage)', async () => {
  const value = randomUUID();
  const created = await redis.set(key, value, { nx: true, ex: 30 });
  if (created !== 'OK') throw new Error('Write not acknowledged');
  if ((await redis.get(key)) !== value) throw new Error('Readback mismatch');
});
try {
  await redis.del(key);
} catch {
  // Diagnostic key has a short automatic expiration regardless.
}

if (failures) {
  console.error(`${failures} Redis diagnostic check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('Redis commands needed for room creation are accessible.');
}
