/* StructCap XLSheet — draws a converted calculation workbook the way Excel prints it: column widths, row heights,
   fonts, fills, borders, merged cells, text overflow, number formats, conditional colours and the XY-scatter drawings
   (as SVG), with the input cells as editable fields. Works with xlcalc.js. */
(function (G) {
  'use strict';
  const X = () => G.XLCALC;
  const PX = w => Math.trunc(((256 * w + Math.trunc(128 / 7)) / 256) * 7);   // column width (characters) -> px, Arial 10
  const PT = 4 / 3, EMU = 9525;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const BW = { thin: [1, 'solid'], hair: [1, 'dotted'], dotted: [1, 'dotted'], dashed: [1, 'dashed'], medium: [2, 'solid'], mediumDashed: [2, 'dashed'], thick: [3, 'solid'], double: [3, 'double'], dashDot: [1, 'dashed'], mediumDashDot: [2, 'dashed'], slantDashDot: [2, 'dashed'], dashDotDot: [1, 'dashed'], mediumDashDotDot: [2, 'dashed'] };
  const DASH = { dash: [4, 3], sysDash: [3, 1], dashDot: [4, 3, 1, 3], lgDash: [8, 3], lgDashDot: [8, 3, 1, 3], lgDashDotDot: [8, 3, 1, 3, 1, 3], sysDot: [1, 1], sysDashDot: [3, 1, 1, 1], sysDashDotDot: [3, 1, 1, 1, 1, 1] };

  // geometry of one sheet (print area, without hidden columns and rows)
  function geom(sh) {
    if (sh._g) return sh._g;
    const pa = sh.print || [1, 1, sh.cols.length, Math.max(...Object.keys(sh.cells).map(a => +a.replace(/^[A-Z]+/, '')))];
    const hidC = new Set(sh.hidden || []), hidR = new Set(sh.hrows || []), colX = {}, rowY = {};
    const colW = c => (hidC.has(X().colName(c)) ? 0 : PX(sh.cols[c - 1] != null ? sh.cols[c - 1] : 8.43));
    const rowH = r => (hidR.has(r) ? 0 : Math.round((sh.rows[r] != null ? sh.rows[r] : sh.defRow) * PT));
    let x = 0; for (let c = 1; c <= Math.max(pa[2], sh.cols.length) + 2; c++) { colX[c] = x; x += colW(c); }
    const W = colX[pa[2] + 1] - colX[pa[0]];
    let y = 0; const maxR = pa[3] + 2; for (let r = 1; r <= maxR; r++) { rowY[r] = y; y += rowH(r); }
    const merges = {}, inMerge = {};
    (sh.merges || []).forEach(m => { const [a, b] = m.split(':'), p = X().parseAddr(a), q = X().parseAddr(b); merges[a] = [p[0], p[1], q[0], q[1]]; for (let r = p[1]; r <= q[1]; r++) for (let c = p[0]; c <= q[0]; c++) if (r !== p[1] || c !== p[0]) inMerge[X().colName(c) + r] = a; });
    const val = {}; Object.entries(sh.val || {}).forEach(([sq, opts]) => sq.split(' ').forEach(rg => { const [a, b] = rg.split(':'), p = X().parseAddr(a), q = b ? X().parseAddr(b) : p; for (let r = p[1]; r <= q[1]; r++) for (let c = p[0]; c <= q[0]; c++) val[X().colName(c) + r] = opts; }));
    // rows -> cells index for the print area
    const byRow = {}; Object.keys(sh.cells).forEach(a => { const p = X().parseAddr(a); if (p[0] < pa[0] || p[0] > pa[2] || p[1] < pa[1] || p[1] > pa[3]) return; (byRow[p[1]] = byRow[p[1]] || []).push([p[0], a]); });
    Object.values(byRow).forEach(L => L.sort((u, v) => u[0] - v[0]));
    sh._g = { pa, colX, rowY, colW, rowH, W, merges, inMerge, val, byRow, inputs: new Set(sh.inputs || []) };
    return sh._g;
  }
  const anchorPx = (g, a) => [g.colX[a[0] + 1] + a[1] / EMU - g.colX[g.pa[0]], g.rowY[a[2] + 1] + a[3] / EMU];

  // conditional formats -> font colour per cell
  function cfColour(book, sh, addr, v) {
    for (const rule of sh.cf || []) {
      const inside = rule.sq.split(' ').some(rg => { const [a, b] = rg.split(':'), p = X().parseAddr(a), q = b ? X().parseAddr(b) : p, z = X().parseAddr(addr); return z[0] >= p[0] && z[0] <= q[0] && z[1] >= p[1] && z[1] <= q[1]; });
      if (!inside) continue;
      if (rule.type === 'cellIs' && rule.op === 'equal') { const t = String(rule.f[0]).replace(/^"|"$/g, ''); if (String(v) === t) return rule.c; }
      else if (rule.type === 'expression') { try { const r = book.evalFormula(rule.f[0], sh.name); if (r === true || (typeof r === 'number' && r)) return rule.c; } catch (e) { } }
    }
    return null;
  }

  // ------------------------------------------------------------------ one chart (XY scatter drawing) -> SVG
  function chartSVG(book, sh, ch, w, h) {
    const pad = 7, x0 = ch.x ? ch.x[0] : 0, x1 = ch.x ? ch.x[1] : 100, y0 = ch.y ? ch.y[0] : 0, y1 = ch.y ? ch.y[1] : 100;
    const pw = w - 2 * pad, ph = h - 2 * pad, X0 = x => pad + (x - x0) / (x1 - x0) * pw, Y0 = y => pad + ph - (y - y0) / (y1 - y0) * ph;
    const vals = ref => { if (!ref) return []; const m = /^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(ref); if (!m) return []; const sn = (m[1] || m[2]).replace(/''/g, "'"); const r = { range: true, sheet: sn, c1: X().colNum(m[3]), r1: +m[4], c2: X().colNum(m[5] || m[3]), r2: +(m[6] || m[4]) }; return book.rangeVals(r); };
    const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
    let s = `<svg class="xs-ch" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="#${ch.bg || 'ffffff'}" stroke="${ch.bd ? '#' + ch.bd[0] : 'none'}" stroke-width="${ch.bd ? Math.max(0.75, ch.bd[1] * PT) : 0}"/><g clip-path="none">`;
    const labels = [];
    ch.series.forEach(se => {
      const xs = vals(se.x), ys = vals(se.y), n = Math.max(xs.length, ys.length), pts = [];
      for (let i = 0; i < n; i++) { const xv = xs.length ? num(xs[i]) : i + 1, yv = num(ys[i]); pts.push(xv == null || yv == null ? null : [X0(xv), Y0(yv)]); }
      if (se.ln) {
        const lw = Math.max(0.6, se.ln.w * PT), da = se.ln.d && DASH[se.ln.d] ? DASH[se.ln.d].map(k => +(k * lw).toFixed(2)).join(' ') : '';
        let d = '', pen = false; pts.forEach(p => { if (!p) { pen = false; return; } d += (pen ? 'L' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2); pen = true; });
        if (d) s += `<path d="${d}" fill="none" stroke="#${se.ln.c}" stroke-width="${lw.toFixed(2)}"${da ? ` stroke-dasharray="${da}"` : ''} stroke-linejoin="round"/>`;
      }
      if (se.mk) pts.forEach(p => { if (p) s += `<circle cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="${(se.mks || 5) / 2}" fill="#${se.mkc || '000000'}"/>`; });
      if (se.lbl) {
        let name = se.name ? (se.name.f ? book.evalFormula(se.name.f, sh.name) : se.name.v) : '';
        if (name == null || X().isErr(name)) return; name = typeof name === 'number' ? X().general(name) : String(name); if (!name) return;
        const fs = se.lbl.sz * PT, gap = 3;
        pts.forEach(p => { if (!p) return; let x = p[0], y = p[1], an = 'start', bl = 'central';
          if (se.lbl.pos === 'r') x += gap + 2; else if (se.lbl.pos === 'l') { x -= gap + 2; an = 'end'; } else if (se.lbl.pos === 't') { y -= gap; an = 'middle'; bl = 'auto'; } else if (se.lbl.pos === 'b') { y += gap; an = 'middle'; bl = 'hanging'; } else an = 'middle';
          labels.push(`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${fs.toFixed(2)}" fill="#${se.lbl.c}" text-anchor="${an}" dominant-baseline="${bl}"${se.lbl.b ? ' font-weight="700"' : ''}>${esc(name)}</text>`); });
      }
    });
    return s + labels.join('') + '</g></svg>';
  }

  // ------------------------------------------------------------------ sheet (rows r1..r2) -> HTML
  // o: { r1, r2, edit (render input cells as fields), id (prefix for element ids) }
  function render(book, name, o) {
    o = o || {}; const sh = book.S[name].sh, g = geom(sh), st = book.model.styles, pa = g.pa;
    const r1 = o.r1 || pa[1], r2 = o.r2 || pa[3], top = g.rowY[r1], H = g.rowY[r2 + 1] - top, cx = c => g.colX[c] - g.colX[pa[0]];
    const out = [], bgs = [], isEmpty = a => { const c = sh.cells[a]; return !c || (c.f == null && (c.v == null || c.v === '')); };
    for (let r = r1; r <= r2; r++) {
      const rh = g.rowH(r); if (!rh) continue; const y = g.rowY[r] - top;
      for (const [c, a] of g.byRow[r] || []) {
        if (g.inMerge[a] || !g.colW(c)) continue;
        const cell = sh.cells[a], s = st[cell.s || 0] || {}, mg = g.merges[a];
        let x = cx(c), w = g.colW(c), h = rh;
        if (mg) { w = g.colX[Math.min(mg[2], pa[2]) + 1] - g.colX[c]; h = g.rowY[mg[3] + 1] - g.rowY[r]; }
        const inp = o.edit && g.inputs.has(a);
        let v = book.get(name, a), txt = inp ? '' : X().fmtValue(v, s.nf);
        if (cell.f == null && cell.v === '=') txt = '=';
        // borders and fill
        let css = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;
        if (s.bg) css += `background:#${s.bg};`;
        if (s.bd) Object.entries(s.bd).forEach(([k, b]) => { const [bw, bs] = BW[b[0]] || [1, 'solid']; css += `border-${{ l: 'left', r: 'right', t: 'top', b: 'bottom' }[k]}:${bw}px ${bs} #${b[1]};`; });
        const font = `font-size:${((s.sz || 10) * PT).toFixed(2)}px;${s.b ? 'font-weight:700;' : ''}${s.i ? 'font-style:italic;' : ''}${s.u ? 'text-decoration:underline;' : ''}`;
        const cf = !inp && cfColour(book, sh, a, v);
        const colour = cf ? `color:#${cf};` : s.c ? `color:#${s.c};` : '';
        if (inp) {
          const opts = g.val[a];
          const field = opts ? `<select class="xs-in" data-xs="${a}" style="${font}${colour}">${opts.map(q => `<option ${String(q) === String(v) ? 'selected' : ''}>${esc(q)}</option>`).join('')}${opts.some(q => String(q) === String(v)) ? '' : `<option selected>${esc(v == null ? '' : v)}</option>`}</select>`
            : `<input class="xs-in" data-xs="${a}" data-raw="${esc(v == null ? '' : v)}" value="${esc(v == null ? '' : typeof v === 'number' ? X().fmtValue(v, s.nf) : v)}" style="${font}${colour}text-align:${typeof v === 'number' ? 'right' : s.h === 'center' ? 'center' : 'left'}" spellcheck="false" autocomplete="off">`;
          out.push(`<div class="xs-c xs-ic" id="${o.id || 'xs'}-${a}" style="${css}">${field}</div>`);
          continue;
        }
        if (s.bg || s.bd) bgs.push(`<div class="xs-c" style="${css}"></div>`);
        if (txt === '') continue;
        const isNum = typeof v === 'number', isTxt = !isNum && typeof v !== 'boolean' && !X().isErr(v);
        let al = s.h && s.h !== 'general' ? s.h : isNum ? 'right' : isTxt ? 'left' : 'center'; if (al === 'centerContinuous') al = 'center';
        // text overflow into empty neighbours (Excel)
        let tx = x, tw = w;
        if (isTxt && !s.wrap && !mg) {
          if (al === 'left' || al === 'center') { let k = c + 1; while (k <= pa[2] && isEmpty(X().colName(k) + r) && !g.inMerge[X().colName(k) + r]) { tw += g.colW(k); k++; } }
          if (al === 'right' || al === 'center') { let k = c - 1; while (k >= pa[0] && isEmpty(X().colName(k) + r) && !g.inMerge[X().colName(k) + r]) { tx -= g.colW(k); tw += g.colW(k); k--; } }
          if (al === 'center') { const half = Math.min(x - tx, tx + tw - x - w); tx = x - half; tw = w + 2 * half; }
        }
        const va = s.va === 'top' ? 'flex-start' : s.va === 'center' ? 'center' : 'flex-end';
        const ind = s.ind ? `padding-left:${s.ind * 9 + 2}px;` : '';
        css = `left:${tx}px;top:${y}px;width:${tw}px;height:${h}px;`;
        out.push(`<div class="xs-c xs-t${s.wrap ? ' xs-w' : ''}" style="${css}justify-content:${al === 'right' ? 'flex-end' : al === 'center' ? 'center' : 'flex-start'};align-items:${va};${font}${colour}${ind}" data-a="${a}"><span>${esc(txt)}</span></div>`);
      }
    }
    // charts whose top-left lies in the row range
    (sh.charts || []).forEach((ch, i) => {
      if (ch.from[2] + 1 < r1 || ch.from[2] + 1 > r2) return;
      const p = anchorPx(g, ch.from), q = anchorPx(g, ch.to), w = Math.round(q[0] - p[0]), h = Math.round(q[1] - p[1]);
      out.push(`<div class="xs-chw" data-ch="${i}" style="left:${p[0]}px;top:${p[1] - top}px;width:${w}px;height:${h}px">${chartSVG(book, sh, ch, w, h)}</div>`);
    });
    return { html: `<div class="xs-sheet" style="width:${g.W}px;height:${H}px">${bgs.join('')}${out.join('')}</div>`, W: g.W, H };
  }
  // page breaks (row ranges): manual breaks, or fit-to-width pages of the given height ratio that do not cut a drawing
  function pages(book, name, ratio) {
    const sh = book.S[name].sh, g = geom(sh), pa = g.pa, P = [];
    if (sh.brk && sh.brk.length) { let s = pa[1]; sh.brk.concat([pa[3]]).forEach(b => { if (b >= s) { P.push([s, Math.min(b, pa[3])]); s = b + 1; } }); return P; }
    const ph = g.W * ratio, spans = (sh.charts || []).map(ch => [ch.from[2] + 1, ch.to[2] + 1]);
    let s = pa[1];
    while (s <= pa[3]) {
      let e = s; while (e < pa[3] && g.rowY[e + 2] - g.rowY[s] <= ph) e++;
      if (e < pa[3]) { const cut = spans.find(([a, b]) => a <= e && b > e && a > s); if (cut) e = cut[0] - 1; }
      // do not leave a section heading alone at the bottom of a page
      P.push([s, e]); s = e + 1;
    }
    return P;
  }
  G.XLSHEET = { render, pages, geom, chartSVG, PX };
})(typeof window !== 'undefined' ? window : globalThis);
