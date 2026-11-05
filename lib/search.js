// Free web search without an API key: DuckDuckGo HTML, falling back to Bing.
const { getText } = require('./http');

const SKIP = /(youtube\.com|youtu\.be|twitch\.tv|facebook\.com|tiktok\.com|instagram\.com|x\.com|twitter\.com|duckduckgo\.com|bing\.com|microsoft\.com)/i;

function clean(u) {
  try {
    if (u.startsWith('//')) u = 'https:' + u;
    const url = new URL(u, 'https://duckduckgo.com');
    if (url.hostname.endsWith('duckduckgo.com') && url.searchParams.get('uddg')) return decodeURIComponent(url.searchParams.get('uddg'));
    if (url.hostname.endsWith('bing.com') && url.pathname.startsWith('/ck/')) {
      const p = url.searchParams.get('u');
      if (p && p.startsWith('a1')) return Buffer.from(p.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    }
    return url.href;
  } catch { return null; }
}

async function ddg(q) {
  const html = await getText('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), { timeout: 15000 });
  const out = [];
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = clean(m[1].replace(/&amp;/g, '&'));
    if (url) out.push({ url, title: m[2].replace(/<[^>]+>/g, '').trim() });
  }
  return out;
}

async function bing(q) {
  const html = await getText('https://www.bing.com/search?setlang=en&q=' + encodeURIComponent(q), { timeout: 15000 });
  const out = [];
  const re = /<li class="b_algo"[\s\S]*?<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = clean(m[1].replace(/&amp;/g, '&'));
    if (url) out.push({ url, title: m[2].replace(/<[^>]+>/g, '').trim() });
  }
  return out;
}

async function search(q, limit = 5) {
  let results = [];
  try { results = await ddg(q); } catch (e) { /* fall through */ }
  if (!results.length) { try { results = await bing(q); } catch (e) { /* none */ } }
  const seen = new Set();
  return results
    .filter((r) => r.url && !SKIP.test(r.url) && !seen.has(r.url) && seen.add(r.url))
    .slice(0, limit);
}

module.exports = { search };
