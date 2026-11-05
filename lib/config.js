// Config = config.json (committed, no secrets) + config.local.json (ignored by git) + environment variables.
// API keys come from environment variables / GitHub Secrets so they never reach the public site.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function merge(a, b) {
  for (const [k, v] of Object.entries(b || {})) {
    a[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] || {}, v) : v;
  }
  return a;
}
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch { return {}; } };

function loadConfig() {
  const c = merge(read('config.json'), read('config.local.json'));
  c.ai = c.ai || {}; c.ai.gemini = c.ai.gemini || {}; c.ai.openai = c.ai.openai || {};
  const env = process.env;
  if (env.AI_PROVIDER) c.ai.provider = env.AI_PROVIDER;
  if (env.GEMINI_API_KEY) c.ai.gemini.apiKey = env.GEMINI_API_KEY;
  if (env.GEMINI_MODELS) c.ai.gemini.models = env.GEMINI_MODELS.split(',').map((s) => s.trim()).filter(Boolean);
  if (env.OPENAI_BASE_URL) c.ai.openai.baseUrl = env.OPENAI_BASE_URL;
  if (env.OPENAI_API_KEY) c.ai.openai.apiKey = env.OPENAI_API_KEY;
  if (env.OPENAI_MODEL) c.ai.openai.model = env.OPENAI_MODEL;
  // Groq/OpenRouter key set but no provider chosen: switch automatically.
  if (!env.AI_PROVIDER && !c.ai.gemini.apiKey && c.ai.openai.apiKey && c.ai.openai.model) c.ai.provider = 'openai';
  return c;
}

module.exports = { loadConfig, ROOT };
