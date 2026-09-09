/** Optional LOCAL-ONLY Gemini gateway. Native Node; no browser API key and no paid calls on startup. */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
const ORIGINS = new Set(['http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:4173','http://localhost:4173']);
const MAX_BODY = 180000, MAX_TEXT = 20000;
const SETTINGS = Object.freeze({ temperature: 1, maxOutputTokens: 1024 });
class RequestError extends Error { constructor(status, message) { super(message); this.status = status; } }
function canonical(value) {
 if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
 if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
 return JSON.stringify(value);
}
export function answersMatch(actual, expected) {
 if (actual.trim() === expected.trim()) return true;
 try { return canonical(JSON.parse(actual)) === canonical(JSON.parse(expected)); } catch { return false; }
}
function reply(res, status, data) {
 if (res.writableEnded || res.destroyed) return;
 res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
 res.end(JSON.stringify(data));
}
async function readInput(req) {
 if (Number(req.headers['content-length'] || 0) > MAX_BODY) throw new RequestError(413, 'Request body is too large.');
 const buffers = []; let size = 0;
 for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw new RequestError(413, 'Request body is too large.'); buffers.push(chunk); }
 let data;
 try { data = JSON.parse(Buffer.concat(buffers).toString('utf8')); } catch { throw new RequestError(400, 'Invalid JSON request.'); }
 if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RequestError(400,'A JSON object is required.');
 if (Object.keys(data).some(k => !['original','compressed','expected'].includes(k))) throw new RequestError(400,'Unexpected request field.');
 for (const key of ['original','compressed']) if (typeof data[key] !== 'string' || !data[key].trim() || data[key].length > MAX_TEXT) throw new RequestError(400, `Each prompt must contain 1–${MAX_TEXT} code units.`);
 if (data.expected !== undefined && (typeof data.expected !== 'string' || data.expected.length > 4000)) throw new RequestError(400,'Expected answer must be text of at most 4000 code units.');
 return { original: data.original, compressed: data.compressed, expected: data.expected ?? '' };
}
export function createGateway({ key = process.env.GEMINI_API_KEY ?? '', model = process.env.GEMINI_MODEL ?? '', fetchImpl = globalThis.fetch, now = Date.now, maxPairsPerMinute = 6 } = {}) {
 // Injectable fetch is ONLY a test seam; the executable always uses the fixed Google API origin below.
 const configured = Boolean(key.trim() && /^[a-z0-9][a-z0-9._-]{0,100}$/i.test(model));
 let busy = false, recent = [];
 async function generate(prompt, expected) {
  const start = performance.now(); let response;
  try {
   response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: SETTINGS }),
    signal: AbortSignal.timeout(60000),
   });
  } catch { throw new RequestError(502,'Gemini could not be reached or timed out. A request may already have been billed.'); }
  if (!response.ok) throw new RequestError(502,`Gemini returned HTTP ${response.status}. Check your model access, auth key, quota and billing. No provider error body is exposed.`);
  let data;
  try { data = await response.json(); } catch { throw new RequestError(502,'Gemini returned an unreadable response.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      (data.candidates !== undefined && !Array.isArray(data.candidates))) throw new RequestError(502,'Gemini returned a malformed response.');
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts;
  if ((parts !== undefined && (!Array.isArray(parts) || parts.some(p => !p || typeof p !== 'object' || (p.text !== undefined && typeof p.text !== 'string')))) ||
      (!candidate && !data.promptFeedback?.blockReason)) throw new RequestError(502,'Gemini returned a malformed response.');
  const text = (candidate?.content?.parts ?? []).filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
  const usage = {};
  for (const field of ['promptTokenCount','candidatesTokenCount','totalTokenCount','thoughtsTokenCount']) {
   const value = data.usageMetadata?.[field]; if (Number.isSafeInteger(value) && value >= 0) usage[field] = value;
  }
  return { text, elapsedMs: performance.now()-start, usage, finishReason: candidate?.finishReason ?? data.promptFeedback?.blockReason ?? 'UNKNOWN', exactMatch: expected.trim() ? answersMatch(text, expected) : null, modelVersion: typeof data.modelVersion === 'string' ? data.modelVersion : null };
 }
 const server = createServer(async (req,res) => {
  try {
   // No CORS grant. A Host allowlist also prevents a non-loopback domain from reaching this gateway through DNS rebinding.
   if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? '')) throw new RequestError(403,'Local Host required.');
   const origin = req.headers.origin;
   if (origin !== undefined && !ORIGINS.has(origin)) throw new RequestError(403,'Origin is not allowed.');
   if (req.method === 'GET' && req.url === '/api/health') return reply(res,200,{ configured, model: configured ? model : '', mode:'local-only' });
   if (req.method !== 'POST' || req.url !== '/api/evaluate') throw new RequestError(404,'Route not found.');
   if (!origin || !ORIGINS.has(origin) || req.headers['x-tokenlab-client'] !== '1') throw new RequestError(403,'Use the local TokenLab application.');
   if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw new RequestError(415,'JSON content type required.');
   if (!configured) throw new RequestError(503,'Set GEMINI_API_KEY and GEMINI_MODEL in .env.local, then restart the gateway.');
   if (busy) throw new RequestError(429,'One evaluation is already running.');
   recent = recent.filter(t => now()-t < 60000);
   if (recent.length >= maxPairsPerMinute) throw new RequestError(429,'Local limit reached: at most six prompt pairs per minute.');
   busy = true;
   try {
    const input = await readInput(req); recent.push(now());
    const original = await generate(input.original,input.expected);
    if (res.destroyed) return;
    const compressed = await generate(input.compressed,input.expected);
    return reply(res,200,{
     model, timestamp:new Date(now()).toISOString(), settings:SETTINGS, original, compressed,
     outputsMatch:answersMatch(original.text,compressed.text), expected:input.expected,
     caveat:'Single paired trial, original first; not an accuracy benchmark. Temperature 1 is not deterministic. Latency includes network variation. Output limits or safety blocks can invalidate a comparison.',
    });
   } finally { busy = false; }
  } catch (error) { reply(res,error instanceof RequestError ? error.status : 500,{ error:error instanceof RequestError ? error.message : 'Local gateway error. No prompts or secrets were logged.' }); }
 });
 server.requestTimeout = 150000; server.headersTimeout = 10000;
 return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const server = createGateway();
 server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port 8787 is already in use. Stop the other local gateway.' : 'The local gateway could not start.'); process.exitCode = 1; });
 server.listen(8787,'127.0.0.1',() => console.log('TokenLab Gemini gateway listening on 127.0.0.1:8787. Local use only. No API calls on startup.'));
}
