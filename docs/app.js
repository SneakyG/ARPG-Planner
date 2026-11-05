// ARPG Planner static front-end (GitHub Pages). Reads JSON written by scripts/update.js.
// Hash routes: #/<game>/<page>[/<id>] and #/status
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const view = $('#view');
  const GAME = { poe: 'Path of Exile', tli: 'Torchlight: Infinite' };
  const CUR = { poe: 'Divine Orb', tli: 'Flame Elementium' };
  const PAGES = ['season', 'builds', 'farm', 'items'];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//.test(u || '') ? esc(u) : '#');
  let meta = null;
  let itemsUI = { mode: 'hot', cat: '', q: '' };
  let buildsUI = { play: '', budget: '' };

  // ---------- Static data ----------
  const seeds = {};
  async function getJSON(path) {
    const r = await fetch(path + (path.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    if (!r.ok) return null;
    try { return await r.json(); } catch { return null; }
  }
  async function seed(game) {
    if (!seeds[game]) seeds[game] = (await getJSON(`data/seed/${game}.json`)) || {};
    return seeds[game];
  }
  async function data(game, kind) {
    const d = await getJSON(`data/${game}-${kind}.json`);
    if (d) return { ...d, origin: 'live' };
    const s = (await seed(game))[kind];
    return s ? { ...s, origin: 'seed' } : {};
  }
  async function guide(game, id) {
    const g = await getJSON(`data/guides/${game}-${id}.json`);
    return g || (await seed(game)).guides?.[id] || {};
  }
  function repoInfo() {
    let repo = meta?.repo || '';
    if (!repo && location.hostname.endsWith('.github.io')) {
      const owner = location.hostname.split('.')[0];
      const first = location.pathname.split('/').filter(Boolean)[0];
      repo = `${owner}/${first || owner + '.github.io'}`;
    }
    return repo ? { repo, actions: `https://github.com/${repo}/actions/workflows/update.yml` } : null;
  }

  function route() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 'status') return { page: 'status', game: localGame() };
    const game = p[0] === 'tli' ? 'tli' : p[0] === 'poe' ? 'poe' : localGame();
    const page = p[1] === 'build' ? 'build' : PAGES.includes(p[1]) ? p[1] : 'builds';
    return { game, page, id: p[2] ? decodeURIComponent(p[2]) : '' };
  }
  function localGame() { try { return localStorage.getItem('arpg-game') || 'poe'; } catch { return 'poe'; } }

  function chrome(r) {
    document.body.dataset.game = r.game;
    try { localStorage.setItem('arpg-game', r.game); } catch {}
    document.querySelectorAll('.switch button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.g === r.game)));
    document.querySelectorAll('.tabs a[data-p]').forEach((a) => {
      if (a.dataset.p !== 'status') a.href = `#/${r.game}/${a.dataset.p}`;
      const on = a.dataset.p === r.page || (r.page === 'build' && a.dataset.p === 'builds');
      a.classList.toggle('on', on);
    });
    document.title = `ARPG Planner · ${GAME[r.game]}`;
    const banner = $('#banner');
    const failed = meta ? Object.entries(meta.status || {}).filter(([k, v]) => !v.ok && k.startsWith(r.game + ':')) : [];
    if (!meta) {
      banner.hidden = false;
      banner.innerHTML = `<div class="banner">Chưa chạy cập nhật lần nào, trang đang hiển thị dữ liệu mẫu. Chạy workflow <b>Update data</b> trong tab Actions của repo để lấy dữ liệu mới. <a href="#/status">Xem trạng thái</a></div>`;
    } else if (meta.ai === 'none') {
      banner.hidden = false;
      banner.innerHTML = `<div class="banner">Repo chưa có AI key, nên chỉ giá item PoE được cập nhật. Thêm secret <code>GEMINI_API_KEY</code> để cập nhật Mùa giải, Build và Farm. <a href="#/status">Xem trạng thái</a></div>`;
    } else if (failed.length) {
      banner.hidden = false;
      banner.innerHTML = `<div class="banner">Lần cập nhật gần nhất có ${failed.length} mục lỗi. <a href="#/status">Xem chi tiết</a></div>`;
    } else banner.hidden = true;
  }

  const when = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '');
  function updateLink(label = 'Cập nhật ngay') {
    const info = repoInfo();
    return info ? `<a class="btn" href="${safeUrl(info.actions)}" target="_blank" rel="noopener" title="Mở GitHub Actions, bấm Run workflow">${label} ↗</a>` : '';
  }
  function head(r, eyebrow, title, data, kind, extra = '') {
    const origin = data?.origin === 'seed' ? '<span class="badge seed">Dữ liệu mẫu</span>' : data?.updatedAt ? '<span class="badge live">Đã cập nhật</span>' : '';
    const cadence = kind === 'items' && r.game === 'poe' ? 'Tự cập nhật mỗi 3 giờ' : 'Tự cập nhật mỗi ngày';
    return `<div class="phead"><div class="grow"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>
      <div class="meta">${origin}${data?.updatedAt ? `<span>${when(data.updatedAt)}</span>` : ''}${data?.model ? `<span>· AI: ${esc(data.model)}</span>` : ''}<span>· ${cadence}</span></div></div>
      ${extra}<button class="btn ghost" data-reload="1">Tải lại</button>${updateLink()}</div><div id="msg"></div>`;
  }
  const sources = (list) => (list && list.length ? `<div class="sources">Nguồn: ${list.map((u) => `<a href="${safeUrl(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70))}</a>`).join(' · ')}</div>` : '');
  const bar5 = (label, v) => `<div>${label}<div class="bar5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= (+v || 0) ? 'on' : ''}"></i>`).join('')}</div></div>`;

  // ---------- Season ----------
  function season(r, d) {
    if (!d || !d.name) return head(r, GAME[r.game], 'Mùa giải', d, 'season') + `<div class="empty">Chưa có dữ liệu mùa giải.</div>`;
    return head(r, `${GAME[r.game]} · mùa hiện hành`, `${d.patch ? d.patch + ' · ' : ''}${d.name}`, d, 'season') + `
      <div class="season-hero">
        <div class="stat"><small>Bắt đầu</small><b>${esc(d.start || '—')}</b></div>
        <div class="stat"><small>Kết thúc</small><b>${esc(d.end || '—')}</b></div>
        <div class="stat"><small>Mùa kế tiếp</small><b>${esc(d.next || '—')}</b></div>
      </div>
      ${d.note ? `<p class="note">${esc(d.note)}</p>` : ''}
      ${(d.mechanics || []).length ? `<h2 class="sec">Cơ chế mùa</h2><div class="mech">${d.mechanics.map((m) => `<div><h3>${esc(m.name)}</h3><div class="muted">${esc(m.desc)}</div></div>`).join('')}</div>` : ''}
      ${(d.changes || []).length ? `<h2 class="sec">Thay đổi đáng chú ý</h2><ul>${d.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      ${sources(d.sources)}`;
  }

  // ---------- Builds ----------
  function searchLinks(game, b) {
    const q = encodeURIComponent(`${b.name} ${b.class || ''} build guide`);
    const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(GAME[game] + ' ' + b.name + ' build guide')}`;
    return game === 'poe'
      ? [['YouTube', yt], ['Maxroll', `https://maxroll.gg/poe/build-guides?search=${encodeURIComponent(b.name)}`], ['Mobalytics', `https://mobalytics.gg/poe/builds?search=${encodeURIComponent(b.name)}`]]
      : [['YouTube', yt], ['Google', `https://www.google.com/search?q=${encodeURIComponent('Torchlight Infinite ' + b.name + ' build')}`]];
  }
  function builds(r, d) {
    const all = d?.builds || [];
    const list = all.filter((b) => (!buildsUI.play || b.playstyle === buildsUI.play) && (!buildsUI.budget || b.budget === buildsUI.budget));
    const opts = (arr, cur, label) => `<option value="">${label}</option>` + [...new Set(arr.filter(Boolean))].map((v) => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
    return head(r, `${d?.season || GAME[r.game]} · League Starter`, 'Build Starter xếp hạng', d, 'builds') + `
      <div class="filters">
        <select id="f-play" aria-label="Lọc playstyle">${opts(all.map((b) => b.playstyle), buildsUI.play, 'Mọi playstyle')}</select>
        <select id="f-budget" aria-label="Lọc ngân sách">${opts(all.map((b) => b.budget), buildsUI.budget, 'Mọi ngân sách')}</select>
      </div>
      ${list.length ? `<div class="blist">${list.map((b) => `
        <article class="build">
          <div class="rank">${esc(b.rank)}<small>HẠNG</small></div>
          <div class="body">
            <h3><span class="tier ${esc(b.tier)}">${esc(b.tier || '?')}</span>${esc(b.name)}</h3>
            <div class="cls">${esc(b.class || '')}</div>
            <div class="chips">${[b.playstyle, b.budget && 'Vốn ' + b.budget.toLowerCase(), b.difficulty && 'Độ khó: ' + b.difficulty].filter(Boolean).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
            <div class="bars">${bar5('Clear', b.clear)}${bar5('Boss', b.boss)}${bar5('Tank', b.tank)}</div>
            <div>${esc(b.why || '')}</div>
            <div class="links">
              <a class="main" href="#/${r.game}/build/${encodeURIComponent(b.id)}">Xem hướng dẫn build →</a>
              ${(b.guides || []).map((g) => `<a href="${safeUrl(g.url)}" target="_blank" rel="noopener">${esc(g.title || 'Guide')} ↗</a>`).join('')}
              ${!(b.guides || []).length ? searchLinks(r.game, b).map(([t, u]) => `<a href="${safeUrl(u)}" target="_blank" rel="noopener">Tìm trên ${t} ↗</a>`).join('') : ''}
            </div>
          </div>
        </article>`).join('')}</div>` : `<div class="empty">Không có build phù hợp bộ lọc.</div>`}
      ${d?.notes ? `<p class="note">${esc(d.notes)}</p>` : ''}
      ${sources(d?.sources)}`;
  }

  // ---------- Build detail ----------
  async function buildDetail(r) {
    const [list, g] = await Promise.all([data(r.game, "builds"), guide(r.game, r.id)]);
    const b = (list.builds || []).find((x) => x.id === r.id);
    if (!b) return `<p><a href="#/${r.game}/builds">← Danh sách build</a></p><div class="empty">Không tìm thấy build này (danh sách có thể đã được cập nhật).</div>`;
    return `<p><a href="#/${r.game}/builds">← Danh sách build</a></p>
      <div class="phead"><div class="grow"><div class="eyebrow">Hạng ${esc(b.rank)} · ${esc(b.class || '')}</div><h1>${esc(b.name)}</h1>
      <div class="meta"><span class="tier ${esc(b.tier)}">${esc(b.tier)}</span>${g.updatedAt ? `<span>Hướng dẫn: ${when(g.updatedAt)}</span>` : ''}${g.model ? `<span>· AI: ${esc(g.model)}</span>` : ''}</div></div>
      </div>
      <div class="links">${(b.guides || []).map((x) => `<a href="${safeUrl(x.url)}" target="_blank" rel="noopener">${esc(x.title || 'Guide')} ↗</a>`).join('')}
      ${searchLinks(r.game, b).map(([t, u]) => `<a href="${safeUrl(u)}" target="_blank" rel="noopener">Tìm trên ${t} ↗</a>`).join('')}</div>
      <p>${esc(b.why || '')}</p>
      ${g.markdown ? `<div class="md">${window.renderMarkdown(g.markdown)}</div>${sources(g.sources)}` : `<div class="empty">Chưa có hướng dẫn chi tiết cho build này. Hướng dẫn được AI viết tự động cho ${esc(meta?.guidesTopN || 5)} build xếp hạng cao nhất mỗi lần cập nhật. Trong lúc chờ, dùng các link guide phía trên.</div>`}`;
  }

  // ---------- Farm ----------
  const riskCls = (r) => (/thấp|low/i.test(r) ? 'low' : /cao|high/i.test(r) ? 'high' : 'mid');
  function farm(r, d) {
    const st = d?.stages || [];
    const label = { starter: 'Starter', mid: 'Mid-Game', end: 'End-Game' };
    return head(r, `${d?.season || GAME[r.game]} · farm ${CUR[r.game]}`, 'Hướng farm từ Starter đến Endgame', d, 'farm') + (st.length ? `<div class="stages">${st.map((s, i) => `
      <section>
        <div class="stage-h"><span class="step">${esc(label[s.key] || 'Giai đoạn ' + (i + 1))}</span><h2>${esc(s.title || '')}</h2><span class="muted">${esc([s.budget && 'Vốn: ' + s.budget, s.content].filter(Boolean).join(' · '))}</span></div>
        <div class="strats">${(s.strategies || []).map((x) => `
          <div class="strat"><h3>${esc(x.name)} ${x.risk ? `<span class="risk ${riskCls(x.risk)}">Rủi ro ${esc(x.risk)}</span>` : ''}</h3>
            ${x.where ? `<div class="kv"><b>Nội dung:</b> ${esc(x.where)}</div>` : ''}
            ${x.setup ? `<div class="kv"><b>Setup:</b> ${esc(x.setup)}</div>` : ''}
            ${(x.steps || []).length ? `<ol>${x.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
            ${x.requires ? `<div class="kv"><b>Yêu cầu build:</b> ${esc(x.requires)}</div>` : ''}
            ${x.profit ? `<div class="kv"><b>Lợi nhuận:</b> ${esc(x.profit)}</div>` : ''}
          </div>`).join('')}</div>
      </section>`).join('')}</div>` : `<div class="empty">Chưa có dữ liệu farm.</div>`) +
      ((d?.tips || []).length ? `<h2 class="sec">Mẹo</h2><ul>${d.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '') + sources(d?.sources);
  }

  // ---------- Items ----------
  function spark(data) {
    const v = (data || []).filter((x) => typeof x === 'number');
    if (v.length < 2) return '';
    const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
    const pts = v.map((y, i) => `${(i / (v.length - 1)) * 68 + 1},${19 - ((y - min) / span) * 18}`).join(' ');
    const cls = v[v.length - 1] >= v[0] ? 'up' : 'down';
    return `<svg class="spark ${cls}" viewBox="0 0 70 20" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }
  const fmt = (n, d = 1) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: n < 10 ? d + 1 : d }));
  function items(r, d) {
    if (r.game === 'tli') {
      const it = d?.items || [];
      const tr = { up: '<span class="up">▲ Tăng</span>', down: '<span class="down">▼ Giảm</span>', flat: 'Ổn định' };
      return head(r, `${d?.season || 'Torchlight: Infinite'} · tổng hợp từ web bằng AI`, 'Item farm đang hot', d, 'items') +
        `<p class="note">TLI không có API giá công khai. Danh sách này do AI tổng hợp từ các trang web; giá chỉ để tham khảo, hãy kiểm tra lại trên Trade Market trong game.</p>` +
        (it.length ? `<div class="tbl"><table><thead><tr><th>Vật phẩm</th><th>Loại</th><th class="n">Giá (FE)</th><th>Xu hướng</th><th>Farm ở đâu</th><th>Vì sao</th></tr></thead><tbody>${it.map((x) => `
          <tr><td><b>${esc(x.name)}</b>${x.source ? ` <a href="${safeUrl(x.source)}" target="_blank" rel="noopener">↗</a>` : ''}</td><td>${esc(x.category)}</td><td class="n">${esc(x.price || '—')}</td><td>${tr[x.trend] || 'Chưa rõ'}</td><td>${esc(x.where || '')}</td><td>${esc(x.why || '')}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${esc(d?.notes || 'Chưa có dữ liệu.')}</div>`) + sources(d?.sources);
    }
    const rows = d?.rows || [];
    const min = 5;
    let list = rows.filter((x) => (!itemsUI.cat || x.category === itemsUI.cat) && (!itemsUI.q || x.name.toLowerCase().includes(itemsUI.q.toLowerCase())));
    if (itemsUI.mode === 'hot') list = list.filter((x) => x.chaos >= min && x.change != null && (x.volume == null || x.volume > 50) && (x.listings == null || x.listings >= 10)).sort((a, b) => b.change - a.change);
    if (itemsUI.mode === 'drop') list = list.filter((x) => x.chaos >= min && x.change != null).sort((a, b) => a.change - b.change);
    if (itemsUI.mode === 'volume') list = list.filter((x) => x.volume != null || x.listings != null).sort((a, b) => (b.volume ?? b.listings * b.chaos) - (a.volume ?? a.listings * a.chaos));
    if (itemsUI.mode === 'value') list = list.slice().sort((a, b) => (b.chaos || 0) - (a.chaos || 0));
    list = list.slice(0, 100);
    const cats = [...new Set(rows.map((x) => x.category))];
    const seg = [['hot', 'Đang tăng giá'], ['volume', 'Giao dịch nhiều'], ['value', 'Giá trị cao'], ['drop', 'Đang giảm']];
    return head(r, `poe.ninja · league ${d?.league?.name || '?'}`, 'Item farm trend', d, 'items') + `
      <div class="filters">
        <div class="seg" role="group" aria-label="Sắp xếp">${seg.map(([k, t]) => `<button data-mode="${k}" class="${itemsUI.mode === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <select id="f-cat" aria-label="Loại vật phẩm"><option value="">Mọi loại</option>${cats.map((c) => `<option ${c === itemsUI.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <input id="f-q" type="search" placeholder="Tìm vật phẩm…" value="${esc(itemsUI.q)}" aria-label="Tìm vật phẩm">
      </div>
      ${(d?.errors || []).length ? `<p class="err">Không tải được: ${esc(d.errors.join('; '))}</p>` : ''}
      ${rows.length ? `<div class="tbl"><table><thead><tr><th>Vật phẩm</th><th>Loại</th><th class="n">Chaos</th><th class="n">Divine</th><th class="n">7 ngày</th><th></th><th class="n">${itemsUI.mode === 'volume' ? 'Khối lượng (c)' : 'Volume / Listing'}</th></tr></thead><tbody>${list.map((x) => `
        <tr><td><div class="it">${x.icon ? `<img src="${safeUrl(x.icon)}" alt="" loading="lazy">` : ''}<b>${esc(x.name)}</b></div></td><td>${esc(x.category)}</td>
        <td class="n">${fmt(x.chaos)}</td><td class="n">${fmt(x.divine, 2)}</td>
        <td class="n ${x.change > 0 ? 'up' : x.change < 0 ? 'down' : ''}">${x.change == null ? '—' : (x.change > 0 ? '+' : '') + fmt(x.change) + '%'}</td><td>${spark(x.spark)}</td>
        <td class="n">${x.volume != null ? fmt(x.volume, 0) : x.listings != null ? fmt(x.listings, 0) + ' listing' : '—'}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted" style="font-size:13px">"Đang tăng giá" chỉ tính món ≥ ${min} chaos và có đủ giao dịch, để lọc nhiễu. Giá cập nhật khoảng 15 phút/lần từ poe.ninja.</p>`
      : `<div class="empty">${esc(d?.note || 'Chưa có dữ liệu giá.')} </div>`}
      ${sources(d?.sources)}`;
  }

  // ---------- Status ----------
  function status() {
    const info = repoInfo();
    const LABEL = { season: 'Mùa giải', builds: 'Build Starter', farm: 'Farm', items: 'Item Trend', guides: 'Hướng dẫn build' };
    const rows = Object.entries(meta?.status || {}).sort();
    return `<div class="phead"><div class="grow"><div class="eyebrow">GitHub Actions</div><h1>Trạng thái cập nhật</h1>
      <div class="meta">${meta?.updatedAt ? `<span>Lần chạy gần nhất: ${when(meta.updatedAt)}</span>` : '<span>Chưa chạy lần nào</span>'}${meta ? `<span>· AI: ${esc(meta.ai)}</span>` : ''}</div></div>
      <button class="btn ghost" data-reload="1">Tải lại</button>${updateLink('Chạy cập nhật')}</div>
      ${rows.length ? `<div class="tbl"><table><thead><tr><th>Game</th><th>Mục</th><th>Kết quả</th><th>Lúc</th><th>Chi tiết</th></tr></thead><tbody>${rows.map(([k, v]) => {
        const [g, kind] = k.split(':');
        return `<tr><td>${g === 'poe' ? 'PoE' : 'TLI'}</td><td>${esc(LABEL[kind] || kind)}</td><td class="${v.ok ? 'up' : 'down'}">${v.ok ? 'Thành công' : 'Lỗi'}</td><td>${when(v.at)}</td><td>${esc(v.ok ? v.info || '' : v.error || '')}</td></tr>`;
      }).join('')}</tbody></table></div>` : `<div class="empty">Chưa có lịch sử cập nhật.</div>`}
      <h2 class="sec">Lịch tự động</h2>
      <ul>
        <li>Giá item PoE (poe.ninja): mỗi 3 giờ.</li>
        <li>Mùa giải, Build, Farm, item TLI và hướng dẫn top build: mỗi ngày lúc khoảng 05:40 sáng (giờ Việt Nam).</li>
        <li>Muốn cập nhật ngay: ${info ? `mở <a href="${safeUrl(info.actions)}" target="_blank" rel="noopener">workflow Update data</a>` : 'mở tab Actions của repo, chọn workflow Update data'}, bấm <b>Run workflow</b>. Trang có dữ liệu mới sau khoảng 2–5 phút.</li>
      </ul>`;
  }

  // ---------- Render & actions ----------
  async function render() {
    const r = route();
    chrome(r);
    view.innerHTML = '<p class="muted">Đang tải…</p>';
    try {
      if (r.page === 'status') { view.innerHTML = status(); return; }
      if (r.page === 'build') { view.innerHTML = await buildDetail(r); return; }
      const d = await data(r.game, r.page);
      view.innerHTML = { season, builds, farm, items }[r.page](r, d);
    } catch (e) {
      view.innerHTML = `<p class="err">Không tải được dữ liệu: ${esc(e.message)}</p>`;
    }
  }
  async function reloadAll() {
    meta = await getJSON('data/meta.json');
    for (const k in seeds) delete seeds[k];
    await render();
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.g) { const r = route(); location.hash = `#/${t.dataset.g}/${r.page === 'status' || r.page === 'build' ? 'builds' : r.page}`; return; }
    if (t.dataset.reload) { t.disabled = true; await reloadAll(); return; }
    if (t.dataset.mode) { itemsUI.mode = t.dataset.mode; render(); return; }
    if (t.classList.contains('copy')) {
      const el = document.getElementById(t.dataset.copy);
      try { await navigator.clipboard.writeText(el.textContent); t.textContent = 'Đã copy'; }
      catch { const rg = document.createRange(); rg.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); t.textContent = 'Đã chọn'; }
      setTimeout(() => (t.textContent = 'Copy'), 1500);
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'f-play') { buildsUI.play = e.target.value; render(); }
    if (e.target.id === 'f-budget') { buildsUI.budget = e.target.value; render(); }
    if (e.target.id === 'f-cat') { itemsUI.cat = e.target.value; render(); }
  });
  let qTimer;
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'f-q') return;
    clearTimeout(qTimer);
    qTimer = setTimeout(async () => {
      itemsUI.q = e.target.value; await render();
      const f = $('#f-q'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    }, 300);
  });

  window.addEventListener('hashchange', render);
  reloadAll();
})();
