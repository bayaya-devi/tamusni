const encoder = new TextEncoder();
const accessTokens = new Map();

function base64Url(bytes) {
  const data = typeof bytes === 'string'
    ? encoder.encode(bytes)
    : bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemBytes(pem) {
  const body = String(pem || '').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getAccessToken(env, fetchImpl) {
  let account;
  try { account = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON || ''); }
  catch { throw new Error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON.'); }
  const email = String(account.client_email || '');
  const projectId = String(env.FCM_PROJECT_ID || account.project_id || '');
  const tokenUri = account.token_uri || 'https://oauth2.googleapis.com/token';
  if (!email || !account.private_key || !projectId || tokenUri !== 'https://oauth2.googleapis.com/token') {
    throw new Error('FCM service account configuration is incomplete.');
  }
  const cached = accessTokens.get(email);
  if (cached && cached.expiresAt > Date.now() + 60_000) return { token: cached.token, projectId };

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', ...(account.private_key_id ? { kid: account.private_key_id } : {}) }));
  const claim = base64Url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = base64Url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned)));
  const response = await fetchImpl(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error(`FCM OAuth token request failed (${response.status}).`);
  accessTokens.set(email, { token: result.access_token, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 });
  return { token: result.access_token, projectId };
}

function isUnregistered(body) {
  return body?.error?.details?.some((detail) => detail?.errorCode === 'UNREGISTERED') || body?.error?.status === 'NOT_FOUND';
}

export async function sendPushToUser(env, userId, payload, fetchImpl = fetch) {
  if (!env.FCM_SERVICE_ACCOUNT_JSON) return { sent: 0, skipped: true };
  const devices = await env.DB.prepare('SELECT token FROM push_devices WHERE user_id=? AND active=1 ORDER BY last_seen_at DESC LIMIT 20').bind(userId).all();
  const tokens = (devices.results || []).map((device) => device.token).filter(Boolean);
  if (!tokens.length) return { sent: 0 };
  const { token: accessToken, projectId } = await getAccessToken(env, fetchImpl);
  let sent = 0;
  for (const deviceToken of tokens) {
    const response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        token: deviceToken,
        notification: { title: String(payload.title || 'TAMUSNI').slice(0, 120), body: String(payload.body || '').slice(0, 400) },
        data: Object.fromEntries(Object.entries(payload.data || {}).map(([key, value]) => [String(key), String(value)])),
        android: { priority: 'HIGH', notification: { channel_id: 'tamusni_news', click_action: 'FLUTTER_NOTIFICATION_CLICK' } },
      } }),
    });
    if (response.ok) { sent += 1; continue; }
    const errorBody = await response.json().catch(() => ({}));
    if (isUnregistered(errorBody)) {
      await env.DB.prepare('UPDATE push_devices SET active=0,updated_at=? WHERE token=?').bind(new Date().toISOString(), deviceToken).run();
    } else {
      console.error('fcm_delivery_failed', response.status, errorBody?.error?.status || 'UNKNOWN');
    }
  }
  return { sent };
}

export async function notifyContentSubscribers(context, category, slug, title) {
  if (!context.env.FCM_SERVICE_ACCOUNT_JSON || typeof context.waitUntil !== 'function') return;
  const task = (async () => {
    const users = await context.env.DB.prepare("SELECT DISTINCT u.id FROM topic_subscriptions s JOIN users u ON u.id=s.user_id WHERE LOWER(s.topic)=LOWER(?) AND u.notifications_enabled=1 LIMIT 500").bind(category).all();
    for (const user of users.results || []) {
      try {
        await sendPushToUser(context.env, user.id, {
          title: 'Nouveau contenu sur TAMUSNI',
          body: title,
          data: { slug, url: `/article/${slug}/`, type: 'article' },
        });
      } catch (error) {
        console.error('fcm_user_delivery_failed', String(user.id), String(error?.message || error).slice(0, 160));
      }
    }
  })();
  context.waitUntil(task);
}
