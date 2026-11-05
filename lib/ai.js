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

async function gemini(cfg, system, user, json) {
  if (!cfg.apiKey) throw new Error('Chưa nhập Gemini API key (trang Cài đặt).');
  const models = (cfg.models && cfg.models.length ? cfg.models : [cfg.model]).filter(Boolean);
  let lastErr;
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: 'application/json' } : {}) },
    };
    const res = await request(url, { method: 'POST', timeout: 120000, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      if (text) return { text, model };
      lastErr = new Error(`Gemini ${model}: phản hồi rỗng (${data.candidates?.[0]?.finishReason || 'không rõ'})`);
      continue;
    }
    lastErr = new Error(`Gemini ${model}: HTTP ${res.status} ${data.error?.message || ''}`.trim());
    if (![400, 403, 404, 429, 500, 503].includes(res.status) || (res.status === 400 && /API key/i.test(data.error?.message || ''))) break;
  }
  throw lastErr;
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
