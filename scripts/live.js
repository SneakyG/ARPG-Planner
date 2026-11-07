#!/usr/bin/env node
// Writes docs/data/live.json with the current Twitch live streams for each game.
// Run inside the deploy job: the file goes into the published site but is NOT committed to git
// (it is listed in .gitignore), so no copy of Twitch data is kept beyond the next refresh.
const fs = require('fs');
const path = require('path');
const twitch = require('../lib/twitch');
const { loadConfig } = require('../lib/config');

const OUT = path.join(__dirname, '..', 'docs', 'data', 'live.json');
const GAMES = { poe: ['Path of Exile'], tli: ['Torchlight: Infinite', 'Torchlight Infinite'] };

async function main() {
  const config = loadConfig();
  const id = process.env.TWITCH_CLIENT_ID || config.twitch?.clientId;
  const secret = process.env.TWITCH_CLIENT_SECRET || config.twitch?.clientSecret;
  const out = { updatedAt: new Date().toISOString(), source: 'twitch', games: {} };
  if (!id || !secret) {
    out.error = 'Chưa có Twitch Client ID/Secret (secrets TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET).';
  } else {
    try {
      const tok = await twitch.token(id, secret);
      for (const [g, names] of Object.entries(config.twitch?.categories || GAMES)) {
        try { out.games[g] = await twitch.liveFor(names, id, tok, 24); }
        catch (e) { out.games[g] = { game: null, streams: [], error: e.message }; }
      }
    } catch (e) { out.error = e.message; }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(out.error ? `Live: ${out.error}` : `Live: ${Object.entries(out.games).map(([g, v]) => `${g} ${v.streams.length} stream`).join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(0); });
