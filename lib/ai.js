// Free AI providers. Gemini (Google AI Studio free key) or any OpenAI-compatible endpoint
// with a free model: Groq, OpenRouter ":free" models, or a local Ollama.
const { request } = require('./http');

function parseJSON(txt) {
  let s = String(txt || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error('AI không trả về JSON hợp lệ');
}

// Models that answered 404 (retired / not available to this key) are skipped for the rest of the run.
const deadModels = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEFAULT_GEMINI = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

function retryDelayMs(data) {
  for (const d of data?.error?.details || []) {
    const m = String(d.retryDelay || '').match(/([\d.]+)s/);
    if (m) return Math.ceil(parseFloat(m[1]) * 1000);
  }
  const m = String(data?.error?.message || '').match(/retry in ([\d.]+)s/i);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : 20000;
}

async function gemini(cfg, system, user, json) {
  if (!cfg.apiKey) throw new Error('Chưa có Gemini API key (secret GEMINI_API_KEY).');
  const models = [...new Set((cfg.models && cfg.models.length ? cfg.models : DEFAULT_GEMINI).filter(Boolean))];
  const errors = [];
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    if (deadModels.has(model)) continue;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: 'application/json' } : {}) },
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await request(url, { method: 'POST', timeout: 150000, headers: { 'Content-Type': 'application/json' }, body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
        if (text) return { text, model };
        errors.push(`${model}: phản hồi rỗng (${data.candidates?.[0]?.finishReason || 'không rõ'})`);
        break;
      }
      const msg = data.error?.message || '';
      if (res.status === 429) {
        // Free tier per-minute limit: wait as long as Google asks (up to ~1 minute) and try the same model once more.
        const wait = retryDelayMs(data);
        if (attempt === 0 && wait <= 65000) { await sleep(wait + 1000); continue; }
        errors.push(`${model}: hết quota (429)`);
        break;
      }
      if (res.status === 404) {
        deadModels.add(model);
        // Google names the replacement model in the message: try it too.
        const repl = msg.match(/use models\/([\w.-]+)/i);
        if (repl && !models.includes(repl[1])) models.push(repl[1]);
        errors.push(`${model}: không còn dùng được (404)`);
        break;
      }
      if (res.status === 400 && /API key/i.test(msg)) throw new Error('Gemini API key không hợp lệ: ' + msg);
      if (res.status === 403) throw new Error('Gemini từ chối key (403): ' + msg);
      errors.push(`${model}: HTTP ${res.status} ${msg.slice(0, 120)}`.trim());
      break;
    }
  }
  throw new Error('Không model Gemini nào trả lời được → ' + errors.join(' · '));
}

async function openaiCompat(cfg, system, user, json) {
  if (!cfg.baseUrl || !cfg.model) throw new Error('Chưa cấu hình Base URL và Model cho nhà cung cấp OpenAI-compatible.');
  const url = cfg.baseUrl.replace(/\/$/, '') + '/chat/completions';
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
  const base = { model: cfg.model, temperature: 0.3, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  const attempt = async (withFormat) => {
    const body = withFormat && json ? { ...base, response_format: { type: 'json_object' } } : base;
    const res = await request(url, { method: 'POST', timeout: 180000, headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };
  let { res, data } = await attempt(true);
  if (!res.ok && res.status === 400) ({ res, data } = await attempt(false));
  if (!res.ok) throw new Error(`${cfg.model}: HTTP ${res.status} ${data.error?.message || ''}`.trim());
  return { text: data.choices?.[0]?.message?.content || '', model: cfg.model };
}

async function ask(config, { system, user, json = true }) {
  const ai = config.ai || {};
  const fn = ai.provider === 'openai' ? openaiCompat : gemini;
  const sub = ai.provider === 'openai' ? ai.openai || {} : ai.gemini || {};
  const { text, model } = await fn(sub, system, user, json);
  return { data: json ? parseJSON(text) : text, model };
}

function hasAI(config) {
  const ai = config.ai || {};
  if (ai.provider === 'openai') return !!(ai.openai?.baseUrl && ai.openai?.model);
  return !!ai.gemini?.apiKey;
}

module.exports = { ask, hasAI, parseJSON };
