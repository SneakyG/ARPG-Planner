// Minimal, safe Markdown renderer: headings, lists, tables, code blocks, quotes, bold/italic/code/links.
(function () {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return s;
  }
  let codeId = 0;
  window.renderMarkdown = function (md) {
    const lines = String(md || '').replace(/\r/g, '').split('\n');
    let out = '', i = 0;
    while (i < lines.length) {
      let l = lines[i];
      if (/^```/.test(l)) {
        const buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; const id = 'code-' + ++codeId;
        out += `<div class="codebox"><pre id="${id}">${esc(buf.join('\n'))}</pre><button class="copy" data-copy="${id}">Copy</button></div>`;
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const row = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = row(l); i += 2; const body = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) body.push(row(lines[i++]));
        out += '<div class="tbl"><table><thead><tr>' + head.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>' +
          body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
        continue;
      }
      const h = l.match(/^(#{1,4})\s+(.*)/);
      if (h) { const n = Math.min(4, h[1].length + 1); out += `<h${n}>${inline(h[2])}</h${n}>`; i++; continue; }
      if (/^\s*[-*+]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {
        const ordered = /^\s*\d/.test(l); const items = [];
        while (i < lines.length && (/^\s*[-*+]\s+/.test(lines[i]) || /^\s*\d+[.)]\s+/.test(lines[i]))) items.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        out += (ordered ? '<ol>' : '<ul>') + items.map((t) => `<li>${inline(t)}</li>`).join('') + (ordered ? '</ol>' : '</ul>');
        continue;
      }
      if (/^>\s?/.test(l)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
        out += `<blockquote>${inline(buf.join(' '))}</blockquote>`; continue;
      }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out += '<hr>'; i++; continue; }
      if (!l.trim()) { i++; continue; }
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s|\s*\|)/.test(lines[i])) buf.push(lines[i++]);
      if (!buf.length) buf.push(lines[i++]);
      out += `<p>${inline(buf.join(' '))}</p>`;
    }
    return out;
  };
})();
