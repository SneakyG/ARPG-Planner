#!/usr/bin/env node
// Preview images for farm setup links (atlas trees, guides).
// - YouTube video: uses the video thumbnail.
// - Other pages: opens the page in headless Chromium and saves a screenshot to docs/data/img/.
// - If no browser is available or the screenshot fails: falls back to the page's og:image.
// Each URL is captured once; the result is recorded in docs/data/img/index.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getText } = require('../lib/http');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.ARPG_DATA_DIR || path.join(ROOT, 'docs', 'data');
const IMG = path.join(DATA, 'img');
const INDEX = path.join(IMG, 'index.json');
const MAX_NEW = +(process.env.SNAP_MAX || 25);

const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

function farmFor(game) {
  return readJSON(path.join(DATA, `${game}-farm.json`)) || readJSON(path.join(DATA, 'seed', `${game}.json`))?.farm || {};
}

function targets() {
  const out = [];
  for (const g of ['poe', 'tli']) {
    for (const s of farmFor(g).stages || []) {
      for (const x of s.strategies || []) {
        for (const t of x.trees || []) out.push(t.url);
        if (x.links?.[0]) out.push(x.links[0].url);
      }
    }
  }
  return [...new Set(out.filter((u) => /^https?:\/\//.test(u || '')))];
}

function youtubeId(u) {
  try {
    const url = new URL(u);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1);
    if (url.hostname.endsWith('youtube.com')) return url.searchParams.get('v') || (url.pathname.match(/\/(?:shorts|embed)\/([\w-]+)/) || [])[1] || null;
  } catch {}
  return null;
}

async function ogImage(u) {
  try {
    const html = await getText(u, { timeout: 15000 });
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    return m ? new URL(m[1], u).href : null;
  } catch { return null; }
}

async function main() {
  fs.mkdirSync(IMG, { recursive: true });
  const index = readJSON(INDEX) || {};
  const todo = targets().filter((u) => !index[u]).slice(0, MAX_NEW);
  if (!todo.length) { console.log('Ảnh: không có link mới.'); return; }

  let browser = null;
  try { browser = await require('playwright').chromium.launch(); }
  catch { console.log('Ảnh: không có Chromium, chỉ dùng og:image.'); }

  for (const u of todo) {
    const yt = youtubeId(u);
    if (yt) { index[u] = { remote: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, at: new Date().toISOString() }; continue; }
    let saved = false;
    if (browser) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      try {
        let resp = null;
        try { resp = await page.goto(u, { waitUntil: 'networkidle', timeout: 45000 }); }
        catch (e) {
          // networkidle can time out on busy pages; accept the page only if the document itself loaded.
          if (/ERR_|NS_ERROR|net::/.test(e.message)) throw e;
        }
        if (resp && !resp.ok()) throw new Error('HTTP ' + resp.status());
        if (/^chrome-error:/.test(page.url())) throw new Error('trang không tải được');
        await page.waitForTimeout(2500); // let canvas-based planners finish drawing the tree
        const file = crypto.createHash('sha1').update(u).digest('hex').slice(0, 14) + '.jpg';
        await page.screenshot({ path: path.join(IMG, file), type: 'jpeg', quality: 70 });
        index[u] = { file: 'img/' + file, at: new Date().toISOString() };
        saved = true;
      } catch (e) { console.log(`Ảnh: chụp lỗi ${u}: ${e.message.split('\n')[0]}`); }
      await page.close();
    }
    if (!saved) {
      const og = await ogImage(u);
      index[u] = og ? { remote: og, at: new Date().toISOString() } : { none: true, at: new Date().toISOString() };
    }
    console.log(`Ảnh: ${u} → ${index[u].file || index[u].remote || 'không có'}`);
  }
  if (browser) await browser.close();
  // Retry "none" entries after 1 day.
  for (const [u, v] of Object.entries(index)) if (v.none && Date.now() - Date.parse(v.at) > 864e5) delete index[u];
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 2));
}

main().catch((e) => { console.error(e); process.exit(0); });
