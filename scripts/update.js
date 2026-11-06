#!/usr/bin/env node
// Refresh the site's data. Used by GitHub Actions, and can be run locally.
//   node scripts/update.js                 -> everything
//   node scripts/update.js --scope prices  -> PoE prices only (fast, no AI)
//   node scripts/update.js --scope meta    -> season, builds, farm, TLI items, guides
//   node scripts/update.js --game tli
const fs = require('fs');
const path = require('path');
const { loadConfig, ROOT } = require('../lib/config');
const { hasAI } = require('../lib/ai');
const tasks = require('../lib/tasks');

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const scope = (arg('scope', process.env.SCOPE || 'all') || 'all').toLowerCase();
const games = (arg('game', 'all') === 'all' ? ['poe', 'tli'] : [arg('game')]);
const config = loadConfig();
const DATA = process.env.ARPG_DATA_DIR || path.join(ROOT, 'docs', 'data');
const META = path.join(DATA, 'meta.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const aiPause = () => sleep(+(config.ai?.pauseMs ?? 4000)); // stay under free-tier requests/minute

async function main() {
  fs.mkdirSync(DATA, { recursive: true });
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(META, 'utf8')); } catch {}
  meta.repo = process.env.GITHUB_REPOSITORY || meta.repo || '';
  meta.ai = hasAI(config) ? (config.ai.provider === 'openai' ? 'openai-compatible' : 'gemini') : 'none';
  meta.status = meta.status || {};
  meta.guidesTopN = config.guidesTopN || 5;
  const plan = [];
  for (const g of games) {
    if (scope === 'all' || scope === 'prices') if (g === 'poe') plan.push([g, 'items']);
    if (scope === 'all' || scope === 'meta') {
      plan.push([g, 'season'], [g, 'builds'], [g, 'farm']);
      if (g === 'tli') plan.push([g, 'items'], [g, 'pacts']);
      plan.push([g, 'guides']);
    }
  }
  const removed = tasks.cleanupPoe2();
  if (removed.length) {
    console.log('Đã xoá dữ liệu Path of Exile 2 lưu nhầm: ' + removed.join(', '));
    meta.status['poe:cleanup'] = { ok: true, at: new Date().toISOString(), info: 'Đã xoá dữ liệu PoE 2 lưu nhầm: ' + removed.join(', ') };
  }
  console.log(`Phạm vi: ${scope} · AI: ${meta.ai} · ${plan.length} bước`);
  for (const [g, kind] of plan) {
    const key = `${g}:${kind}`;
    const t0 = Date.now();
    const usesAI = !((g === 'poe' && (kind === 'items' || kind === 'season')) || kind === 'pacts');
    if (usesAI && !hasAI(config)) {
      meta.status[key] = { ok: false, at: new Date().toISOString(), error: 'Bỏ qua: chưa có AI key (thêm secret GEMINI_API_KEY).' };
      console.log(`- ${key}: bỏ qua (chưa có AI key)`);
      continue;
    }
    try {
      let info = '';
      if (kind === 'guides') {
        const r = await tasks.refreshTopGuides(config, g, config.guidesTopN || 5, config.guidesMaxAgeDays || 7, aiPause);
        info = `tạo ${r.done.length}, lỗi ${r.failed.length}`;
        if (r.failed.length) info += ` (${r.failed.join('; ')})`;
      } else {
        const r = await tasks.refresh[kind](config, g);
        info = kind === 'builds' ? `${r.builds.length} build` : kind === 'items' ? `${(r.rows || r.items || []).length} món` : kind === 'pacts' ? `${r.items.length} Pactspirit` : '';
        if (r.errors?.length) info += ` · lỗi: ${r.errors.join('; ')}`;
      }
      meta.status[key] = { ok: true, at: new Date().toISOString(), info, ms: Date.now() - t0 };
      console.log(`✓ ${key} ${info}`);
    } catch (e) {
      meta.status[key] = { ok: false, at: new Date().toISOString(), error: e.message };
      console.log(`✗ ${key}: ${e.message}`);
    }
    if (usesAI) await aiPause();
  }
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(META, JSON.stringify(meta, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
