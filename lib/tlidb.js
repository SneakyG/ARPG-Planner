// Pactspirit list from tlidb.com (fan-made Torchlight: Infinite database). No AI needed.
// The list page shows, for each Pactspirit: an icon, a link with its name, then a "<Category> <Rarity>" line
// and a short description. We read the page as a stream of those tokens.
const { getText } = require('./http');

const PAGE = 'https://tlidb.com/en/Pactspirit';
const CATS = ['Attack', 'Spell', 'Persistent', 'Summon', 'Survival', 'Drop', 'Fire', 'Cold', 'Lightning', 'Erosion', 'Elixir'];
const RAR = ['Magic', 'Rare', 'Legendary'];
const CAT_RE = new RegExp(`^(${CATS.join('|')})\\s+(${RAR.join('|')})$`, 'i');

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function parse(html) {
  const tokens = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img\b[^>]*?src=["']([^"']+)["'][^>]*>/gi, (_, src) => `\n@@IMG ${src}\n`)
    .replace(/<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
      const imgs = [...inner.matchAll(/@@IMG (\S+)/g)].map((m) => `\n@@IMG ${m[1]}\n`).join('');
      const text = inner.replace(/@@IMG \S+/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return `${imgs}\n@@A ${href}|${text}\n`;
    })
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/td|li|h\d|p|div|tr|td)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n').map((l) => decode(l).replace(/\s+/g, ' ').trim()).filter(Boolean);

  const out = [];
  let img = null, cur = null;
  for (const t of tokens) {
    if (t.startsWith('@@IMG ')) {
      const src = t.slice(6);
      if (/\/Icon\/Pet\//i.test(src)) img = src;
      continue;
    }
    if (t.startsWith('@@A ')) {
      const [href, text] = t.slice(4).split('|');
      if (img && text && /\/en\/[^/]+$/.test(href) && !/Pactspirit$/i.test(href)) {
        cur = { name: text, url: new URL(href, PAGE).href, image: new URL(img, PAGE).href };
        img = null;
      }
      continue;
    }
    const m = t.match(CAT_RE);
    if (m && cur && !cur.category) { cur.category = cap(m[1]); cur.rarity = cap(m[2]); continue; }
    // Category and rarity on separate lines.
    if (cur && !cur.category && !cur._cat && CATS.some((c) => c.toLowerCase() === t.toLowerCase())) { cur._cat = cap(t); continue; }
    if (cur && cur._cat && !cur.category && RAR.some((r) => r.toLowerCase() === t.toLowerCase())) { cur.category = cur._cat; cur.rarity = cap(t); delete cur._cat; continue; }
    if (cur && cur.category && !cur.desc) { cur.desc = t.slice(0, 160); out.push(cur); cur = null; }
  }
  const seen = new Set();
  const list = out.filter((p) => !seen.has(p.name) && seen.add(p.name));
  for (const p of list) p.mods = modsFor(html, p.url);
  return list;
}

// Effects ("modifiers") of one Pactspirit: the block after its name link, up to the next icon.
// Each <div class="modifier"> is one rank; <br> splits a rank into several lines.
function modsFor(html, url) {
  const slugPart = url.replace(/^https?:\/\/[^/]+/, '');
  let i = html.indexOf(`href="${url}"`);
  if (i < 0) i = html.indexOf(`href="${slugPart}"`);
  if (i < 0) return [];
  const end = html.indexOf('pactspirit_smallicon', i);
  const block = html.slice(i, end > 0 ? end : i + 6000);
  const mods = [];
  for (const m of block.matchAll(/<div class="modifier">([\s\S]*?)<\/div>/g)) {
    const lines = m[1].split(/<br\s*\/?>/i).map((l) => decode(l.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (lines.length) mods.push(lines);
    if (mods.length >= 8) break;
  }
  return mods;
}

async function pactspirits() {
  const html = await getText(PAGE, { timeout: 30000, ttl: 30 * 60 * 1000, headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } });
  // tlidb sits behind Cloudflare: servers (like GitHub Actions) sometimes get a bot-check page instead of the list.
  if (/just a moment|cf-chl|challenge-platform|cf_chl_opt|attention required/i.test(html) && !/Icon\/Pet\//.test(html)) {
    throw new Error('tlidb.com trả về trang kiểm tra chống bot (Cloudflare) thay vì danh sách. Giữ danh sách đã có (181 Pactspirit kèm ảnh).');
  }
  return parse(html);
}

module.exports = { pactspirits, parse, PAGE, CATS };
