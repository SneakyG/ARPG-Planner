// HTTP helpers: fetch with timeout, small in-memory cache, HTML -> readable text.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const memo = new Map(); // url -> {t, value}

async function request(url, { timeout = 20000, headers = {}, method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    body,
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.8', ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
  });
  return res;
}

async function getText(url, opts = {}) {
  const ttl = opts.ttl ?? 0;
  const hit = memo.get(url);
  if (ttl && hit && Date.now() - hit.t < ttl) return hit.value;
  const res = await request(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} khi tải ${url}`);
  const value = await res.text();
  if (ttl) memo.set(url, { t: Date.now(), value });
  return value;
}

async function getJSON(url, opts = {}) {
  const txt = await getText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  return JSON.parse(txt);
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

// Turn an HTML page into plain text the AI can read. Absolute links are kept as "text <url>"
// so the AI can cite real guide URLs that we can later verify. Format: "text (url)".
function htmlToText(html, baseUrl, maxChars = 14000) {
  let h = html
    .replace(/<(script|style|noscript|svg|iframe|form|header|footer|nav|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const titleM = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  h = h.replace(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    let abs = href;
    try { abs = new URL(href, baseUrl).href; } catch { return inner; }
    if (!/^https?:/.test(abs)) return inner;
    const t = inner.replace(/<[^>]+>/g, ' ').trim();
    return t ? ` ${t} (${abs}) ` : ' ';
  });
  h = h
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|li|h\d)[^>]*>/gi, '\n')
    .replace(/<(td|th)[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');
  let text = decode(h).replace(/[ \t\f\r]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n…(đã cắt bớt)';
  return { title: titleM ? decode(titleM[1]).trim() : baseUrl, text };
}

async function fetchPage(url, maxChars) {
  const html = await getText(url, { ttl: 30 * 60 * 1000, timeout: 20000 });
  return { url, ...htmlToText(html, url, maxChars) };
}

module.exports = { request, getText, getJSON, fetchPage, htmlToText, BROWSER_UA };
