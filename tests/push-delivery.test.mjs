import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { sendPushToUser } from '../functions/_lib/push.js';
import { createSessionCookie } from '../functions/_lib/auth.js';
import { onRequestPost, onRequestDelete } from '../functions/api/push/devices.js';

test('FCM delivery skips safely when server credentials are absent', async () => {
  const result = await sendPushToUser({ DB: { prepare() { throw new Error('DB should not be queried'); } } }, 'user-1', {});
  assert.deepEqual(result, { sent: 0, skipped: true });
});

test('FCM uses the HTTP v1 API and deactivates an unregistered device token', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const serviceAccount = {
    client_email: `push-test-${Date.now()}@example.iam.gserviceaccount.com`,
    project_id: 'tamusni-test-project',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
  const updates = [];
  const env = {
    FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount),
    DB: { prepare(sql) { return { bind(...values) { return {
      async all() { assert.match(sql, /FROM push_devices/); return { results: [{ token: 'fcm-device-token' }] }; },
      async run() { updates.push({ sql, values }); },
    }; } }; } },
  };
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes('oauth2.googleapis.com/token')) return Response.json({ access_token: 'test-access-token', expires_in: 3600 });
    return Response.json({ error: { status: 'NOT_FOUND' } }, { status: 404 });
  };

  const result = await sendPushToUser(env, 'user-1', { title: 'Nouvel article', body: 'Le sujet', data: { slug: 'ia' } }, fetchImpl);
  assert.deepEqual(result, { sent: 0 });
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /\/v1\/projects\/tamusni-test-project\/messages:send$/);
  assert.equal(JSON.parse(calls[1].options.body).message.data.slug, 'ia');
  assert.equal(updates.length, 1);
  assert.match(updates[0].sql, /SET active=0/);
});

function authenticatedContext(method, body, calls) {
  const sessionSecret = 'test-session-secret-not-for-production';
  const user = { id: 'user-123', role: 'USER', name: 'Test', email: 'test@example.com', session_version: 1, email_verified_at: '2026-01-01' };
  const DB = { prepare(sql) { return { bind(...values) { return {
    async first() { return sql.includes('FROM users u') ? user : null; },
    async run() { calls.push({ sql, values }); },
  }; } }; } };
  return createSessionCookie(user, sessionSecret).then((cookie) => ({
    request: new Request('https://tamusni.pages.dev/api/push/devices', {
      method,
      headers: { Cookie: cookie.split(';')[0], Origin: 'https://tamusni.pages.dev', 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env: { DB, SESSION_SECRET: sessionSecret },
  }));
}

test('device registration is per authenticated user and unregister deactivates only that token', async () => {
  const calls = [];
  const postContext = await authenticatedContext('POST', { token: 'x'.repeat(48), platform: 'android' }, calls);
  const postResponse = await onRequestPost(postContext);
  assert.equal(postResponse.status, 200);
  assert.match(calls[0].sql, /ON CONFLICT\(token\) DO UPDATE/);
  assert.equal(calls[0].values[1], 'user-123');

  const deleteContext = await authenticatedContext('DELETE', { token: 'x'.repeat(48) }, calls);
  const deleteResponse = await onRequestDelete(deleteContext);
  assert.equal(deleteResponse.status, 200);
  assert.match(calls[1].sql, /SET active=0/);
  assert.equal(calls[1].values[2], 'user-123');
});
