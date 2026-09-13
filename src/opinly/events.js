// Server-side Opinly events (secret sk- key, never exposed to the browser).
//
// trackEvent / trackPurchase are the HTTP form of @opinly/backend's track().
// handlePurchaseIngest exposes them at POST /api/opinly/purchase behind a
// bearer token so the app backend (or a billing webhook relay) can record
// purchases with authoritative revenue. It is disabled until
// OPINLY_PURCHASE_INGEST_TOKEN is set.

import { API_URL_DEFAULT } from './config.js';

const RESERVED = new Set(['page_view', 'page_leave', 'click', 'form_submit', 'identify', 'session_start', 'scroll']);

function base(env) {
  return (env?.OPINLY_API_URL || API_URL_DEFAULT).replace(/\/+$/, '');
}

async function post(env, path, body) {
  if (!env?.OPINLY_API_KEY) throw new Error('OPINLY_API_KEY is not set');
  const res = await fetch(`${base(env)}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPINLY_API_KEY}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  if (!res.ok) {
    const err = new Error(`Opinly events ${res.status}${data?.code ? ` ${data.code}` : ''}${data?.detail ? `: ${data.detail}` : ''}`);
    err.status = res.status;
    throw err;
  }
  return data ?? { recorded: true };
}

export function trackEvent(env, { event, properties, externalEventId, email, anonId }) {
  if (!event || typeof event !== 'string' || event.length > 64) throw new Error('event name required (≤64 chars)');
  if (RESERVED.has(event) || event.startsWith('$')) throw new Error(`event "${event}" is reserved for the pixel`);
  const body = { event };
  if (properties && typeof properties === 'object') body.properties = properties;
  if (externalEventId) body.externalEventId = String(externalEventId).slice(0, 255);
  if (email) body.email = email;
  if (anonId) body.anonId = String(anonId).slice(0, 128);
  return post(env, '/v1/events', body);
}

export function validatePurchase(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['body must be a JSON object'], value: NaN, currency: 'USD' };
  }
  const { orderId, value, currency = 'USD', email, anonId } = input;
  if (!orderId || typeof orderId !== 'string' || orderId.length > 251) errors.push('orderId must be a string of 1–251 chars');
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num) || num < 0 || num > 99999999.99) errors.push('value must be a number ≥ 0 in major units');
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/i.test(currency)) errors.push('currency must be a 3-letter ISO 4217 code');
  if (email !== undefined && email !== null && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.push('email is not valid');
  if (!email && !anonId) errors.push('send at least one of email or anonId, or the purchase is recorded as "direct"');
  return { ok: errors.length === 0, errors, value: num, currency: String(currency || 'USD').toUpperCase() };
}

export function trackPurchase(env, input) {
  const v = validatePurchase(input);
  const hard = v.errors.filter((e) => !e.startsWith('send at least'));
  if (hard.length) throw new Error(hard.join('; '));
  const body = { orderId: input.orderId, value: v.value, currency: v.currency };
  if (input.email) body.email = input.email;
  if (input.anonId) body.anonId = String(input.anonId).slice(0, 128);
  return post(env, '/v1/events/purchase', body);
}

function timingSafeEqual(a, b) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i += 1) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function handlePurchaseIngest(request, env) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
  const token = env?.OPINLY_PURCHASE_INGEST_TOKEN;
  if (!token) return json({ error: 'purchase ingest disabled (OPINLY_PURCHASE_INGEST_TOKEN not set)' }, 404);
  const auth = request.headers.get('authorization') || '';
  const presented = auth.replace(/^Bearer\s+/i, '');
  if (!presented || !timingSafeEqual(presented, token)) return json({ error: 'unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const v = validatePurchase(body);
  const hard = v.errors.filter((e) => !e.startsWith('send at least'));
  if (hard.length) return json({ error: 'validation', details: v.errors }, 400);
  try {
    const result = await trackPurchase(env, body);
    return json({ ok: true, result, warnings: v.errors }, 201);
  } catch (e) {
    console.error('[opinly] purchase ingest failed', e?.message || e);
    return json({ error: 'upstream', detail: e?.message || String(e) }, e?.status === 400 ? 400 : 502);
  }
}
