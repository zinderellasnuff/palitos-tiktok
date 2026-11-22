// Puente TikTok → juego. Sirve el juego en http://localhost:5173 y manda los eventos del live por SSE (/events).
// Uso: npm start -- usuario_del_streamer   (sin usuario: solo sirve el juego, para usar el simulador)
// La clave de Euler Stream es opcional; si la tienes, ponla tú en la variable EULER_API_KEY.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { userOf, giftEvent, avatarAllowed } from './tiktok.js';

const PORT = Number(process.env.PORT) || 5174; // La Balsa usa el 5173: así corren los dos a la vez
const ROOT = resolve(import.meta.dirname);
const STREAMER = String(process.argv[2] || process.env.TIKTOK_USER || '').replace(/^@/, '').trim();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.md': 'text/plain; charset=utf-8' };

// ---------- SSE ----------
const clients = new Set();
let status = STREAMER ? `Conectando a @${STREAMER}…` : 'Sin TikTok: solo simulador';
const line = ev => `data: ${JSON.stringify(ev)}\n\n`;
const send = ev => { const s = line(ev); for (const c of clients) c.write(s); };
function setStatus(text) { status = text; console.log(`[${new Date().toLocaleTimeString()}] ${text}`); send({ type: 'status', text }); }
setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 20000); // que OBS no corte la conexión

// ---------- HTTP ----------
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(line({ type: 'status', text: status }));
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/avatar') { // fotos de perfil con el mismo origen, para que el canvas las pueda dibujar
    const src = url.searchParams.get('u');
    if (!avatarAllowed(src)) { res.writeHead(400); return res.end(); }
    try {
      const r = await fetch(src, { signal: AbortSignal.timeout(8000) });
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.startsWith('image/')) throw new Error(`HTTP ${r.status}`);
      res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=86400' });
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch { res.writeHead(502); res.end(); }
    return;
  }
  let file;
  try { file = normalize(join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))); } catch { file = ''; }
  const rel = file.slice(ROOT.length);
  if (!file.startsWith(ROOT + sep) || /[\\/](node_modules|\.)/.test(rel)) { res.writeHead(404); return res.end(); } // nada fuera del proyecto ni archivos ocultos
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Juego en http://localhost:${PORT}/?live&clean  (para OBS / LIVE Studio)`);
  console.log(`Simulador en http://localhost:${PORT}/`);
  if (STREAMER) connect(); else console.log('Para conectar a TikTok: npm start -- usuario_del_streamer');
});

// ---------- TikTok, con reconexión automática ----------
let attempt = 0, timer = null;
function retry(why) {
  if (timer) return;
  const s = Math.min(60, 5 * 2 ** Math.min(attempt++, 4)); // 5, 10, 20, 40, 60 s
  setStatus(`${why}. Reintento en ${s} s`);
  timer = setTimeout(() => { timer = null; connect(); }, s * 1000);
}

async function connect() {
  const conn = new TikTokLiveConnection(STREAMER, process.env.EULER_API_KEY ? { signApiKey: process.env.EULER_API_KEY } : {});
  let dead = false;
  const die = why => { if (dead) return; dead = true; try { conn.disconnect(); } catch { /* ya estaba cerrada */ } retry(why); };
  const out = (ev, d) => {
    if (dead) return;
    const u = userOf(d);
    if (!u.user) return;
    send({ ...ev, user: u.user, avatar: u.avatar ? `/avatar?u=${encodeURIComponent(u.avatar)}` : '' });
  };
  conn.on(WebcastEvent.CHAT, d => out({ type: 'comment', text: String(d.comment ?? '').slice(0, 200) }, d));
  conn.on(WebcastEvent.LIKE, d => out({ type: 'like', count: Number(d.likeCount) || 1 }, d));
  conn.on(WebcastEvent.FOLLOW, d => out({ type: 'follow' }, d));
  conn.on(WebcastEvent.SHARE, d => out({ type: 'share' }, d));
  conn.on(WebcastEvent.GIFT, d => { const g = giftEvent(d); if (g) out(g, d); });
  conn.on(WebcastEvent.STREAM_END, () => die('El live terminó'));
  conn.on(ControlEvent.DISCONNECTED, () => die('Se cortó la conexión'));
  conn.on(ControlEvent.ERROR, e => console.warn('Error del conector:', e?.message ?? e));
  try {
    await conn.connect();
    attempt = 0;
    setStatus(`🔴 Conectado al live de @${STREAMER}`);
  } catch (e) {
    die(`No se pudo conectar a @${STREAMER} (${e?.message ?? e})`);
  }
}
