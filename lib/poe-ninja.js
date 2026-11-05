// poe.ninja public economy API (PoE 1). Docs: https://poe.ninja/docs/api
// Requests are cached 10 minutes; poe.ninja itself refreshes about every 15 minutes.
const { getJSON } = require('./http');

const BASE = 'https://poe.ninja/poe1/api/economy';
const IMG = 'https://web.poecdn.com';
const EXCHANGE = new Set(['Currency', 'Fragment', 'Runegraft', 'AllflameEmber', 'Tattoo', 'Omen', 'DjinnCoin', 'Ducat', 'EnshroudingCrystal', 'DivinationCard', 'Artifact', 'Oil', 'DeliriumOrb', 'Scarab', 'Astrolabe', 'Fossil', 'Resonator', 'Essence']);
const TTL = 10 * 60 * 1000;

function ua(config) {
  const contact = (config.contact || '').trim();
  return { 'User-Agent': `ARPG-Planner/1.0 (personal desktop tool${contact ? '; contact: ' + contact : ''})` };
}

async function leagues(config) {
  const list = await getJSON(`${BASE}/leagues`, { ttl: TTL, headers: ua(config) });
  const arr = Array.isArray(list) ? list : list.leagues || [];
  const current = arr.find((l) => !/^(standard|hardcore)$/i.test(l.name) && !/hardcore|ssf|ruthless/i.test(l.name)) || arr[0];
  return { all: arr, current };
}

function pct(spark) {
  const v = spark && typeof spark.totalChange === 'number' ? spark.totalChange : null;
  return v;
}

async function category(config, league, type) {
  const q = `league=${encodeURIComponent(league)}&type=${encodeURIComponent(type)}`;
  if (EXCHANGE.has(type)) {
    const d = await getJSON(`${BASE}/exchange/current/overview?${q}`, { ttl: TTL, headers: ua(config) });
    const core = d.core || {};
    const info = new Map();
    for (const it of [...(core.items || []), ...(d.items || [])]) info.set(it.id, it);
    const rates = core.rates || {};
    return (d.lines || []).map((l) => {
      const it = info.get(l.id) || {};
      let chaos = null, divine = null;
      if (core.primary === 'divine') { divine = l.primaryValue; chaos = rates.chaos ? l.primaryValue * rates.chaos : null; }
      else { chaos = l.primaryValue; divine = rates.divine ? l.primaryValue * rates.divine : null; }
      return {
        id: l.id, name: it.name || l.id, icon: it.image ? (it.image.startsWith('http') ? it.image : IMG + it.image) : '',
        category: type, chaos, divine, change: pct(l.sparkline), spark: l.sparkline?.data || [],
        volume: l.volumePrimaryValue ?? null, listings: null,
      };
    });
  }
  const d = await getJSON(`${BASE}/stash/current/item/overview?${q}`, { ttl: TTL, headers: ua(config) });
  return (d.lines || []).map((l) => {
    const spark = l.sparkLine || l.sparkline || l.lowConfidenceSparkLine;
    const extra = [l.variant, l.mapTier ? 'T' + l.mapTier : null, l.gemLevel ? 'Lv' + l.gemLevel : null, l.links ? l.links + 'L' : null].filter(Boolean).join(' · ');
    return {
      id: l.detailsId || String(l.id), name: l.name + (extra ? ` (${extra})` : ''), icon: l.icon || '',
      category: type, chaos: l.chaosValue ?? null, divine: l.divineValue ?? null, change: pct(spark), spark: spark?.data || [],
      volume: null, listings: l.listingCount ?? null,
    };
  });
}

async function trend(config) {
  const { current, all } = await leagues(config);
  const league = current?.id || current?.name;
  const cats = config.poe?.categories || ['Currency', 'Fragment', 'Scarab', 'Essence', 'DivinationCard', 'Omen'];
  const rows = [], errors = [], seen = new Set();
  for (const c of cats) {
    try {
      // Exchange responses repeat reference currencies (Chaos/Divine) in every category: keep the first one only.
      for (const r of await category(config, league, c)) {
        if (seen.has(r.id)) continue;
        seen.add(r.id); rows.push(r);
      }
    } catch (e) { errors.push(`${c}: ${e.message}`); }
  }
  return { league: current, leagues: all, rows, errors, categories: cats };
}

module.exports = { leagues, category, trend };
