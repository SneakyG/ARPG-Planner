// ARPG Planner — local server. Run: node server.js  (Node 18+, no npm install needed)
const http = require('http');
const fs = require('fs');
const path = require('path');
const tasks = require('./lib/tasks');
const { ask, hasAI } = require('./lib/ai');

const ROOT = __dirname;
const CONFIG = path.join(ROOT, 'config.json');
const EXAMPLE = path.join(ROOT, 'config.example.json');
if (!fs.existsSync(CONFIG)) fs.copyFileSync(EXAMPLE, CONFIG);

const readConfig = () => JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const writeConfig = (c) => fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2), 'utf8');

const GAMES = new Set(['poe', 'tli']);
const KINDS = ['season', 'builds', 'farm', 'items'];
const running = new Map();

function once(key, fn) {
  if (running.has(key)) return running.get(key);
  const p = fn().finally(() => running.delete(key));
  running.set(key, p);
  return p;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((ok, bad) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { bad(e); } });
  });
}
function mask(c) {
  const m = JSON.parse(JSON.stringify(c));
  const hide = (o) => { if (o && o.apiKey) { o.hasKey = true; o.apiKey = ''; } };
  hide(m.ai?.gemini); hide(m.ai?.openai);
  return m;
}

async function api(req, res, parts) {
  const [, , route, game, kind] = parts;
  const config = readConfig();

  if (route === 'state') return send(res, 200, { ai: hasAI(config), provider: config.ai?.provider || 'gemini', running: [...running.keys()] });

  if (route === 'config' && req.method === 'GET') return send(res, 200, mask(config));
  if (route === 'config' && req.method === 'POST') {
    const b = await body(req);
    const c = readConfig();
    c.ai = c.ai || {}; c.ai.gemini = c.ai.gemini || {}; c.ai.openai = c.ai.openai || {};
    if (b.provider) c.ai.provider = b.provider;
    if (b.gemini) {
      if (b.gemini.apiKey) c.ai.gemini.apiKey = b.gemini.apiKey.trim();
      if (Array.isArray(b.gemini.models) && b.gemini.models.length) c.ai.gemini.models = b.gemini.models;
    }
    if (b.openai) {
      if (b.openai.apiKey) c.ai.openai.apiKey = b.openai.apiKey.trim();
      if (b.openai.baseUrl !== undefined) c.ai.openai.baseUrl = b.openai.baseUrl.trim();
      if (b.openai.model !== undefined) c.ai.openai.model = b.openai.model.trim();
    }
    if (b.maxContextChars) c.ai.maxContextChars = +b.maxContextChars;
    if (b.contact !== undefined) c.contact = String(b.contact).trim();
    writeConfig(c);
    return send(res, 200, mask(c));
  }
  if (route === 'test-ai') {
    try {
      const r = await ask(config, { system: 'Trả lời JSON.', user: 'Trả về {"ok":true,"msg":"xin chào"}' });
      return send(res, 200, { ok: true, model: r.model, reply: r.data });
    } catch (e) { return send(res, 200, { ok: false, error: e.message }); }
  }

  if (!GAMES.has(game)) return send(res, 404, { error: 'Game không hợp lệ' });

  if (route === 'data') {
    if (!KINDS.includes(kind)) return send(res, 404, { error: 'Loại dữ liệu không hợp lệ' });
    return send(res, 200, tasks.load(game, kind) || {});
  }

  if (route === 'refresh' && req.method === 'POST') {
    const list = kind === 'all' ? KINDS : [kind];
    if (!list.every((k) => KINDS.includes(k))) return send(res, 404, { error: 'Loại dữ liệu không hợp lệ' });
    const out = {};
    for (const k of list) {
      try { out[k] = await once(`${game}:${k}`, () => tasks.refresh[k](config, game)); }
      catch (e) { out[k] = { error: e.message }; }
    }
    return send(res, 200, kind === 'all' ? out : out[kind]);
  }

  if (route === 'guide') {
    const id = decodeURIComponent(kind || '');
    if (req.method === 'POST') {
      try { return send(res, 200, await once(`${game}:guide:${id}`, () => tasks.refreshGuide(config, game, id))); }
      catch (e) { return send(res, 200, { error: e.message }); }
    }
    return send(res, 200, tasks.loadGuide(game, id) || {});
  }
  return send(res, 404, { error: 'Không có API này' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/');
    if (parts[1] === 'api') return await api(req, res, parts);
    let file = path.normalize(path.join(ROOT, 'public', url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file)) file = path.join(ROOT, 'public', 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

const port = readConfig().port || 5178;
server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}`;
  console.log(`\n  ARPG Planner đang chạy: ${url}\n  (Ctrl+C để tắt)\n`);
  if (process.platform === 'win32' && process.env.ARPG_NO_BROWSER !== '1') require('child_process').exec(`start "" ${url}`);
  // Light auto-update: refresh the PoE season name from poe.ninja once a day when the app starts.
  const c = readConfig();
  if (c.autoUpdateOnStart !== false) {
    for (const g of ['poe', 'tli']) {
      const s = tasks.load(g, 'season');
      const old = !s?.updatedAt || Date.now() - Date.parse(s.updatedAt) > 24 * 3600 * 1000;
      if (old && (hasAI(c) || g === 'poe')) once(`${g}:season`, () => tasks.refresh.season(c, g)).then(() => console.log(`  Đã cập nhật mùa giải ${g}.`)).catch((e) => console.log(`  Không cập nhật được mùa ${g}: ${e.message}`));
    }
  }
});
