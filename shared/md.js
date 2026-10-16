/* Markdown mini renderer (aman, tanpa library). Dipakai di build & admin. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.MD = f(); })(this, function () {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  function inline(t) {
    t = esc(t);
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" decoding="async" width="800" height="500">');
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, u) => {
      const ext = /^https?:/.test(u); return '<a href="' + u + '"' + (ext ? ' rel="noopener" target="_blank"' : '') + '>' + a + '</a>';
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    return t;
  }
  function render(md) {
    const lines = String(md || '').replace(/\r/g, '').split('\n'); let out = [], i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { const n = m[1].length; out.push('<h' + n + ' id="' + slug(m[2]) + '">' + inline(m[2]) + '</h' + n + '>'); i++; continue; }
      if (/^\|/.test(l) && /^\|[\s:|-]+\|?$/.test(lines[i + 1] || '')) {
        const row = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const head = row(l); i += 2; const body = [];
        while (i < lines.length && /^\|/.test(lines[i])) { body.push(row(lines[i])); i++; }
        out.push('<div class="tbl"><table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + body.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'); continue;
      }
      if (/^[-*]\s+/.test(l)) { const it = []; while (i < lines.length && /^[-*]\s+/.test(lines[i])) { it.push('<li>' + inline(lines[i].replace(/^[-*]\s+/, '')) + '</li>'); i++; } out.push('<ul>' + it.join('') + '</ul>'); continue; }
      if (/^\d+\.\s+/.test(l)) { const it = []; while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { it.push('<li>' + inline(lines[i].replace(/^\d+\.\s+/, '')) + '</li>'); i++; } out.push('<ol>' + it.join('') + '</ol>'); continue; }
      if (/^>\s?/.test(l)) { out.push('<blockquote>' + inline(l.replace(/^>\s?/, '')) + '</blockquote>'); i++; continue; }
      const p = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|[-*]\s|\d+\.\s|\||>)/.test(lines[i])) { p.push(lines[i]); i++; }
      out.push('<p>' + inline(p.join(' ')) + '</p>');
    }
    return out.join('\n');
  }
  /* ambil FAQ: heading ### Pertanyaan + paragraf jawaban di bawah "## Pertanyaan yang sering diajukan" */
  function faq(md) {
    const s = String(md || '').replace(/\r/g, ''); const idx = s.search(/^##\s+.*(pertanyaan|faq)/im); if (idx < 0) return [];
    const part = s.slice(idx).split('\n').slice(1).join('\n'); const res = [];
    part.split(/^###\s+/m).slice(1).forEach(b => { const ls = b.split('\n'); const q = ls[0].trim(); const a = ls.slice(1).join(' ').replace(/\s+/g, ' ').trim(); if (q && a) res.push({ q, a }); });
    return res;
  }
  const strip = md => String(md || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*>|`_-]/g, ' ').replace(/\s+/g, ' ').trim();
  return { render, inline, faq, strip, esc, slug };
});
