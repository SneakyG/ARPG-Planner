// Twitch Helix API: live streams for a game, most viewers first.
// Needs a free Twitch app (Client ID + Client Secret) from https://dev.twitch.tv/console
// Terms followed (Twitch Developer Services Agreement + embed requirements):
// - video is only shown through Twitch's own embeddable player;
// - API data is cached for at most 24 hours (we refresh every ~30 minutes and never commit it to git);
// - thumbnails are loaded from Twitch's CDN, never copied.
const { request } = require('./http');

async function token(clientId, secret) {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`;
  const res = await request(url, { method: 'POST', timeout: 20000 });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Twitch từ chối Client ID/Secret (HTTP ${res.status}) ${data.message || ''}`.trim());
  return data.access_token;
}

async function helix(path, clientId, tok) {
  const res = await request('https://api.twitch.tv/helix/' + path, { timeout: 20000, headers: { 'Client-Id': clientId, Authorization: 'Bearer ' + tok } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twitch API ${path.split('?')[0]}: HTTP ${res.status} ${data.message || ''}`.trim());
  return data;
}

// names: exact Twitch category names to try, e.g. ["Path of Exile"].
async function liveFor(names, clientId, tok, first = 24) {
  let game = null;
  for (const n of names) {
    const g = await helix('games?name=' + encodeURIComponent(n), clientId, tok);
    if (g.data && g.data[0]) { game = g.data[0]; break; }
  }
  if (!game) return { game: null, streams: [] };
  const s = await helix(`streams?game_id=${game.id}&first=${first}&type=live`, clientId, tok);
  const streams = (s.data || [])
    .sort((a, b) => b.viewer_count - a.viewer_count)
    .map((x) => ({
      login: x.user_login, name: x.user_name, title: x.title, viewers: x.viewer_count,
      language: x.language, startedAt: x.started_at,
      thumb: String(x.thumbnail_url || '').replace('{width}', '440').replace('{height}', '248'),
    }));
  return { game: { id: game.id, name: game.name, boxArt: String(game.box_art_url || '').replace('{width}', '144').replace('{height}', '192') }, streams };
}

module.exports = { token, liveFor };
