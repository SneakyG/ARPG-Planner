// Refresh jobs. Each one collects real web pages, then asks a free AI to turn them into
// structured data. Links the AI returns are checked against the pages it was given.
const fs = require('fs');
const path = require('path');
const { fetchPage } = require('./http');
const { search } = require('./search');
const { ask, hasAI } = require('./ai');
const ninja = require('./poe-ninja');

const ROOT = path.join(__dirname, '..');
// Output goes straight into the static site so GitHub Pages serves it as-is.
const CACHE = process.env.ARPG_DATA_DIR || path.join(ROOT, 'docs', 'data');
const SEED = path.join(ROOT, 'docs', 'data', 'seed');
const GAME = { poe: 'Path of Exile', tli: 'Torchlight: Infinite' };
const CURRENCY = { poe: 'Divine Orb', tli: 'Flame Elementium (FE)' };

fs.mkdirSync(path.join(CACHE, 'guides'), { recursive: true });

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeJSON(file, v) { fs.writeFileSync(file, JSON.stringify(v, null, 2), 'utf8'); }

function load(game, kind) {
  const cached = readJSON(path.join(CACHE, `${game}-${kind}.json`));
  if (cached) return { ...cached, origin: 'cache' };
  const seed = readJSON(path.join(SEED, `${game}.json`));
  return seed && seed[kind] ? { ...seed[kind], origin: 'seed' } : null;
}
function save(game, kind, data) {
  const v = { ...data, updatedAt: new Date().toISOString() };
  writeJSON(path.join(CACHE, `${game}-${kind}.json`), v);
  return { ...v, origin: 'cache' };
}

async function gather(config, queries, fixed = [], maxPages = 5) {
  const urls = [...fixed];
  for (const q of queries) {
    try { (await search(q, 4)).forEach((r) => urls.push(r.url)); } catch {}
  }
  const uniq = [...new Set(urls)].slice(0, maxPages + fixed.length);
  const budget = config.ai?.maxContextChars || 40000;
  const per = Math.max(3000, Math.floor(budget / Math.max(1, Math.min(uniq.length, maxPages))));
  const pages = [];
  for (const u of uniq) {
    if (pages.length >= maxPages) break;
    try {
      const p = await fetchPage(u, per);
      if (p.text.length > 400) pages.push(p);
    } catch {}
  }
  if (!pages.length) throw new Error('Không tải được trang nguồn nào (kiểm tra mạng hoặc thêm URL nguồn trong config.json).');
  return pages;
}

const block = (pages) => pages.map((p, i) => `### NGUỒN ${i + 1}: ${p.title}\nURL: ${p.url}\n${p.text}`).join('\n\n');
const corpus = (pages) => pages.map((p) => p.url + '\n' + p.text).join('\n');
const okUrl = (u, pages) => typeof u === 'string' && /^https?:\/\//.test(u) && corpus(pages).includes(u.replace(/\/$/, ''));

function system(game) {
  return [
    `Bạn là chuyên gia phân tích meta ARPG cho ${GAME[game]}. Hôm nay là ${today()}.`,
    'CHỈ dùng thông tin có trong các NGUỒN được cung cấp. Không bịa tên build, số liệu, ngày tháng hay đường link.',
    'Mọi URL bạn trả về phải xuất hiện nguyên văn trong NGUỒN. Không chắc thì để chuỗi rỗng.',
    'Viết tiếng Việt, giữ nguyên thuật ngữ tiếng Anh của game (DPS, Map, Divine Orb, Netherrealm, Flame Elementium...).',
    'Trả về đúng một object JSON theo schema được yêu cầu, không thêm chữ nào ngoài JSON.',
  ].join('\n');
}

function needAI(config) {
  if (!hasAI(config)) throw new Error('Chưa cấu hình AI miễn phí. Vào trang Cài đặt để nhập Gemini API key (miễn phí) hoặc Groq/OpenRouter/Ollama.');
}

// ---------- 1. Season ----------
async function refreshSeason(config, game) {
  let ninjaLeague = null;
  if (game === 'poe') { try { ninjaLeague = (await ninja.leagues(config)).current; } catch {} }
  if (!hasAI(config)) {
    if (ninjaLeague) return save(game, 'season', { name: ninjaLeague.name, patch: '', start: '', end: '', mechanics: [], changes: [], next: '', sources: ['https://poe.ninja'], note: 'Chỉ lấy tên league từ poe.ninja. Thêm AI key để có chi tiết mùa giải.' });
    needAI(config);
  }
  const fixed = (config.sources?.[game]?.season) || [];
  const q = game === 'poe'
    ? [`Path of Exile ${ninjaLeague?.name || 'new'} league patch notes mechanics`, 'Path of Exile current league start date end date']
    : ['Torchlight Infinite new season start date', 'Torchlight Infinite current season hero trait new mechanics'];
  const pages = await gather(config, q, fixed, 5);
  const user = `${block(pages)}

YÊU CẦU: Xác định MÙA GIẢI HIỆN HÀNH (đang chạy vào ngày ${today()}) của ${GAME[game]}.${ninjaLeague ? ` poe.ninja xác nhận league hiện tại tên là "${ninjaLeague.name}".` : ''}
Schema JSON:
{"name":"tên mùa","patch":"số patch/season (vd 3.29 hoặc SS14)","start":"YYYY-MM-DD","end":"ngày kết thúc hoặc ước tính, ghi rõ 'ước tính' nếu chưa công bố","mechanics":[{"name":"","desc":"1-2 câu"}],"changes":["buff/nerf/thay đổi hệ thống quan trọng"],"next":"thông tin mùa kế tiếp nếu có","sources":["url đã dùng"]}`;
  const { data, model } = await ask(config, { system: system(game), user });
  data.sources = (data.sources || []).filter((u) => okUrl(u, pages));
  if (!data.sources.length) data.sources = pages.map((p) => p.url);
  return save(game, 'season', { ...data, model });
}

function seasonLabel(game) {
  const s = load(game, 'season') || {};
  return [GAME[game], s.patch, s.name].filter(Boolean).join(' ');
}

// ---------- 2. Starter builds ----------
async function refreshBuilds(config, game) {
  needAI(config);
  const label = seasonLabel(game);
  const fixed = (config.sources?.[game]?.builds) || [];
  const pages = await gather(config, [`${label} league starter tier list`, `${label} best starter builds budget`], fixed, 5);
  const user = `${block(pages)}

YÊU CẦU: Từ các nguồn trên, lập danh sách 8–15 build LEAGUE STARTER của mùa hiện hành (${label}), sắp xếp theo độ ưu tiên cho người chơi bắt đầu từ 0 vốn (rank 1 = nên chơi nhất). Ưu tiên: rẻ, an toàn, clear tốt, có thể đánh boss, dễ chơi.
Schema JSON:
{"builds":[{"rank":1,"name":"tên build","class":"Class/Ascendancy hoặc Hero + Trait","tier":"S|A|B|C","playstyle":"Speed Mapper|Boss Killer|All-Rounder|Tanker","budget":"Thấp|Trung bình|Cao","difficulty":"Dễ|Trung bình|Khó","clear":1-5,"boss":1-5,"tank":1-5,"why":"1-2 câu vì sao xếp hạng này","guides":[{"title":"","url":"link hướng dẫn build xuất hiện trong NGUỒN"}]}],"notes":"lưu ý chung về meta mùa này","sources":["url"]}`;
  const { data, model } = await ask(config, { system: system(game), user });
  const used = new Set();
  const builds = (data.builds || []).map((b, i) => {
    let id = slug(b.name || 'build-' + i);
    while (used.has(id)) id += '-x';
    used.add(id);
    return { ...b, id, rank: b.rank || i + 1, guides: (b.guides || []).filter((g) => okUrl(g.url, pages)) };
  }).sort((a, b) => a.rank - b.rank);
  return save(game, 'builds', { season: label, builds, notes: data.notes || '', sources: pages.map((p) => p.url), model });
}

// ---------- 3. Farming strategies ----------
async function refreshFarm(config, game) {
  needAI(config);
  const label = seasonLabel(game);
  const fixed = (config.sources?.[game]?.farm) || [];
  const q = game === 'poe'
    ? [`${label} league start farming strategy`, `${label} best currency farming strategy atlas endgame`]
    : [`${label} farming guide Flame Elementium`, `${label} best farming strategy endgame profit`];
  const pages = await gather(config, q, fixed, 5);
  let market = '';
  if (game === 'poe') {
    try {
      const t = await ninja.trend(config);
      const top = t.rows.filter((r) => r.chaos >= (config.poe?.minChaos || 5)).sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 20);
      market = `\n\nDỮ LIỆU GIÁ THẬT TỪ poe.ninja (league ${t.league?.name}, chaos, % thay đổi 7 ngày):\n` + top.map((r) => `- ${r.name} [${r.category}]: ${r.chaos?.toFixed(1)}c, ${r.change ?? '?'}%`).join('\n');
    } catch {}
  }
  const user = `${block(pages)}${market}

YÊU CẦU: Lập lộ trình FARM ${CURRENCY[game]} cho mùa ${label}, từ lúc bắt đầu (0 vốn) tới endgame. Mỗi giai đoạn 2–4 chiến lược, hành động cụ thể.
Schema JSON:
{"stages":[{"key":"starter|mid|end","title":"tên giai đoạn","budget":"vốn cần","content":"${game === 'poe' ? 'tier map' : 'Netherrealm tier'} phù hợp","strategies":[{"name":"","where":"nội dung/cơ chế farm","setup":"${game === 'poe' ? 'Atlas Passive/Scarab' : 'Compass/Probe/Memory'} cần dùng","steps":["bước làm"],"profit":"lợi nhuận/giờ nếu nguồn có nêu, nếu không ghi 'chưa có số liệu'","requires":"yêu cầu sức mạnh build","risk":"Thấp|Trung bình|Cao"}]}],"tips":["mẹo chung"],"sources":["url"]}`;
  const { data, model } = await ask(config, { system: system(game), user });
  return save(game, 'farm', { season: label, stages: data.stages || [], tips: data.tips || [], sources: pages.map((p) => p.url), model });
}

// ---------- 4. Trending farm items ----------
async function refreshItems(config, game) {
  if (game === 'poe') {
    const t = await ninja.trend(config);
    return save(game, 'items', { kind: 'market', league: t.league, categories: t.categories, rows: t.rows, errors: t.errors, sources: ['https://poe.ninja'] });
  }
  needAI(config);
  const label = seasonLabel(game);
  const fixed = (config.sources?.[game]?.items) || [];
  const pages = await gather(config, [`${label} most profitable items to farm price`, `${label} market prices flame elementium farm`], fixed, 5);
  const user = `${block(pages)}

YÊU CẦU: Liệt kê 10–25 vật phẩm đáng farm/bán nhất ở mùa ${label} theo các nguồn trên.
Schema JSON:
{"items":[{"name":"","category":"loại (Compass, Probe, Ember, Fuel, Legendary, ...)","price":"giá FE nếu nguồn có nêu, nếu không để ''","trend":"up|down|flat|unknown","source":"url nguồn nêu món này","where":"farm ở đâu","why":"vì sao đáng farm"}],"notes":"lưu ý"}`;
  const { data, model } = await ask(config, { system: system(game), user });
  const items = (data.items || []).map((it) => ({ ...it, source: okUrl(it.source, pages) ? it.source : '' }));
  return save(game, 'items', { kind: 'ai', season: label, items, notes: data.notes || '', sources: pages.map((p) => p.url), model });
}

// ---------- 5. Detailed build guide (uses the user's own system prompt) ----------
function guideFile(game, id) { return path.join(CACHE, 'guides', `${game}-${slug(id)}.json`); }
function loadGuide(game, id) {
  const cached = readJSON(guideFile(game, id));
  if (cached) return cached;
  const seed = readJSON(path.join(SEED, `${game}.json`));
  return seed?.guides?.[id] || null;
}

async function refreshGuide(config, game, id) {
  needAI(config);
  const builds = load(game, 'builds')?.builds || [];
  const b = builds.find((x) => x.id === id);
  if (!b) throw new Error('Không tìm thấy build này. Hãy cập nhật danh sách build trước.');
  const label = seasonLabel(game);
  const fixed = (b.guides || []).map((g) => g.url).slice(0, 3);
  const pages = await gather(config, [`${GAME[game]} ${b.name} ${b.class || ''} build guide ${label}`], fixed, 4);
  let sys = '';
  try { sys = fs.readFileSync(path.join(ROOT, 'prompts', 'system-prompt.txt'), 'utf8'); } catch {}
  sys += `\n\nQUY TẮC BỔ SUNG: Hôm nay là ${today()}. Chỉ dùng thông tin có trong NGUỒN. Chỉ đưa PoB Link/Build Code nếu nó xuất hiện nguyên văn trong NGUỒN; nếu không có, ghi rõ "Chưa có code công khai trong nguồn". Số liệu lợi nhuận phải ghi rõ là ước tính nếu nguồn không nêu. Kết thúc bằng mục "Nguồn" liệt kê URL đã dùng.`;
  const user = `${block(pages)}

TRUY VẤN NGƯỜI DÙNG: Game: ${GAME[game]} (${label}). Build: ${b.name} — ${b.class || ''}. Ngân sách: League Starter (0 vốn). Playstyle mong muốn: ${b.playstyle || 'All-Rounder'}.
Trả lời bằng Markdown theo đúng cấu trúc trong hướng dẫn hệ thống.`;
  const { data, model } = await ask(config, { system: sys, user, json: false });
  const v = { id, game, name: b.name, markdown: data, sources: pages.map((p) => p.url), model, updatedAt: new Date().toISOString() };
  writeJSON(guideFile(game, id), v);
  return v;
}

// Pre-generate guides for the top N builds. A guide is rebuilt when missing or older than maxAgeDays.
async function refreshTopGuides(config, game, n = 5, maxAgeDays = 7, pause = async () => {}) {
  const builds = (load(game, 'builds')?.builds || []).slice(0, n);
  const done = [], failed = [];
  for (const b of builds) {
    const cur = readJSON(guideFile(game, b.id));
    if (cur?.updatedAt && Date.now() - Date.parse(cur.updatedAt) < maxAgeDays * 864e5) continue;
    try { await refreshGuide(config, game, b.id); done.push(b.id); }
    catch (e) { failed.push(`${b.id}: ${e.message}`); }
    await pause();
  }
  if (failed.length && !done.length) throw new Error(failed.join('; '));
  return { done, failed };
}

module.exports = {
  load, loadGuide,
  refresh: { season: refreshSeason, builds: refreshBuilds, farm: refreshFarm, items: refreshItems },
  refreshGuide, refreshTopGuides,
};
