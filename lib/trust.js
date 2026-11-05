// Which websites count as trustworthy for links shown to players.
// Community wikis/databases, the official sites and well-known guide sites are trusted.
// Shops selling currency/boosting are blocked: their "guides" exist to sell things.
const DEFAULT_TRUSTED = {
  poe: ['pathofexile.com', 'poewiki.net', 'poedb.tw', 'poe.ninja', 'maxroll.gg', 'mobalytics.gg', 'poe-vault.com', 'pobb.in', 'poeplanner.com', 'youtube.com', 'youtu.be', 'reddit.com'],
  tli: ['torchlight.xd.com', 'maxroll.gg', 'mobalytics.gg', 'tlifaq.pages.dev', 'youtube.com', 'youtu.be', 'reddit.com'],
};
const DEFAULT_BLOCKED = ['mmoexp.com', 'mmogah.com', 'u4gm.com', 'aoeah.com', 'pvpbank.com', 'timesaver.gg', 'playerauctions.com', 'poecurrency.com', 'akrpg.com', 'expcarry.com', 'iggm.com', 'boostmatch.gg', 'eldorado.gg', 'g2g.com', 'igvault.com', 'mmojugg.com', 'lootbar.gg'];

function domainOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}
const match = (host, list) => list.some((d) => host === d || host.endsWith('.' + d));

function trustedList(config, game) { return config.trust?.[game] || DEFAULT_TRUSTED[game] || []; }
function blockedList(config) { return config.trust?.blocked || DEFAULT_BLOCKED; }
function isTrusted(config, game, u) { return match(domainOf(u), trustedList(config, game)); }
function isBlocked(config, u) { return match(domainOf(u), blockedList(config)); }

// A lookup link that always works: wiki search for PoE, Maxroll (via Google site search) for TLI.
function lookupUrl(game, name) {
  const q = encodeURIComponent(name);
  return game === 'poe'
    ? `https://www.poewiki.net/index.php?search=${q}`
    : `https://www.google.com/search?q=${encodeURIComponent('site:maxroll.gg/torchlight-infinite ' + name)}`;
}

// When no tree link was found: a YouTube search for that strategy's atlas tree / setup (always works, shows thumbnails).
function treeSearchUrl(game, strategy, season) {
  const q = game === 'poe' ? `${strategy} atlas tree ${season}` : `Torchlight Infinite ${season} ${strategy} farming setup`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

module.exports = { domainOf, isTrusted, isBlocked, lookupUrl, treeSearchUrl, DEFAULT_TRUSTED, DEFAULT_BLOCKED };
