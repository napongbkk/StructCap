/* StructCap Timber — repair drawing workspace (CAD): place standard repair details on a sheet, edit them,
   draw and annotate, and exchange with AutoCAD as DXF (R12 / AC1009 writer; reader for LINE, LWPOLYLINE,
   POLYLINE, CIRCLE, ARC, TEXT, MTEXT, SOLID, INSERT). Paper space in millimetres; y up. */
(function (G) {
  'use strict';
  const PI = Math.PI, sq = Math.sqrt, abs = Math.abs, max = Math.max, min = Math.min;
  const D = () => G.TDET;
  const SIZES = { A1: [841, 594], A2: [594, 420], A3: [420, 297], A0: [1189, 841] };
  const ACI = { 1: '#e03030', 2: '#d9b400', 3: '#1f9d55', 4: '#1c8fbf', 5: '#3a5bd9', 6: '#b03ab0', 7: 'currentColor', 8: '#8a8f99', 9: '#b7bcc6', 32: '#a0522d' };
  const DASH = { CONTINUOUS: '', DASHED: '3 1.5', HIDDEN: '1.6 0.9', CENTER: '8 1.5 1.5 1.5', PHANTOM: '10 1.5 1.5 1.5 1.5 1.5' };
  const layerDef = (doc, L) => (doc.layers && doc.layers[L]) || (D().LAYERS[L]) || { c: 7, lt: 'CONTINUOUS', lw: 0.25 };

  // ------------------------------------------------------------------ geometry helpers
  const xf = (t) => (p) => { const c = Math.cos(t.r || 0), s = Math.sin(t.r || 0), k = t.s || 1; return [t.x + k * (c * p[0] - s * p[1]), t.y + k * (s * p[0] + c * p[1])]; };
  function transform(e, t) { // returns a transformed copy of an entity
    const f = xf(t), k = t.s || 1, rd = (t.r || 0) * 180 / PI, o = Object.assign({}, e);
    if (e.a) o.a = f(e.a); if (e.b) o.b = f(e.b); if (e.p && Array.isArray(e.p[0])) o.p = e.p.map(f); else if (e.p) o.p = f(e.p);
    if (e.c) o.c = f(e.c); if (e.r != null && e.t !== 'text') o.r = e.r * k; if (e.h) o.h = e.h * k; if (e.t === 'text') o.ang = (e.ang || 0) + rd; if (e.t === 'arc') { o.a0 = e.a0 + rd; o.a1 = e.a1 + rd; } if (e.sc) o.sc = e.sc * k;
    return o;
  }
  function itemEnts(it) { if (!it._ents || it._k !== JSON.stringify([it.det, it.params])) { it._ents = it.det === '__import' ? (it.ents || []) : D().generate(it.det, it.params); it._k = JSON.stringify([it.det, it.params]); } return it._ents.map(e => transform(e, it)); }
  function bboxOf(E) { return D().bbox(E); }
  function entPoints(e) { if (e.t === 'line') return [e.a, e.b]; if (e.t === 'pl' || e.t === 'hatch' || e.t === 'solid') return e.p; if (e.t === 'circle') return [e.c]; if (e.t === 'arc') return [e.c, [e.c[0] + e.r * Math.cos(e.a0 * PI / 180), e.c[1] + e.r * Math.sin(e.a0 * PI / 180)], [e.c[0] + e.r * Math.cos(e.a1 * PI / 180), e.c[1] + e.r * Math.sin(e.a1 * PI / 180)]]; if (e.t === 'text') return [e.p]; return []; }
  function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]); }
  function hitEnt(e, p, tol) {
    if (e.t === 'line') return segDist(p, e.a, e.b) <= tol;
    if (e.t === 'pl' || e.t === 'hatch' || e.t === 'solid') { const P = e.p, n = P.length; for (let i = 0; i < n - (e.closed || e.t !== 'pl' ? 0 : 1); i++) if (segDist(p, P[i], P[(i + 1) % n]) <= tol) return true; if (e.t !== 'pl' && inPoly(p, P)) return true; return false; }
    if (e.t === 'circle') return abs(Math.hypot(p[0] - e.c[0], p[1] - e.c[1]) - e.r) <= tol;
    if (e.t === 'arc') { const d = Math.hypot(p[0] - e.c[0], p[1] - e.c[1]); if (abs(d - e.r) > tol) return false; let a = Math.atan2(p[1] - e.c[1], p[0] - e.c[0]) * 180 / PI; const a0 = ((e.a0 % 360) + 360) % 360, a1 = ((e.a1 % 360) + 360) % 360; a = (a + 360) % 360; return a0 <= a1 ? a >= a0 && a <= a1 : a >= a0 || a <= a1; }
    if (e.t === 'text') { const b = bboxOf([e]); return p[0] >= b.x0 - tol && p[0] <= b.x1 + tol && p[1] >= b.y0 - tol && p[1] <= b.y1 + tol; }
    return false;
  }
  function inPoly(p, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if ((P[i][1] > p[1]) !== (P[j][1] > p[1]) && p[0] < (P[j][0] - P[i][0]) * (p[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; } return c; }
  // hatch pattern lines clipped to the boundary (paper mm)
  function hatchLines(e) {
    const out = [], P = e.p, b = bboxOf([{ t: 'pl', p: P }]), sc = e.sc || 1;
    const fam = e.pat === 'ansi37' ? [[45, 2.5 * sc], [135, 2.5 * sc]] : e.pat === 'conc' ? [] : e.pat === 'earth' ? [[0, 3 * sc]] : [[45, 2.5 * sc]];
    fam.forEach(([ang, sp]) => { const a = ang * PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, cs = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(q => q[0] * nx + q[1] * ny), d0 = min(...cs), d1 = max(...cs);
      for (let d = Math.ceil(d0 / sp) * sp; d <= d1; d += sp) { const ts = []; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const p0 = P[j], p1 = P[i], s0 = p0[0] * nx + p0[1] * ny - d, s1 = p1[0] * nx + p1[1] * ny - d; if ((s0 < 0) !== (s1 < 0)) { const t = s0 / (s0 - s1), x = p0[0] + t * (p1[0] - p0[0]), y = p0[1] + t * (p1[1] - p0[1]); ts.push(x * ux + y * uy); } } ts.sort((q, r) => q - r); for (let k = 0; k + 1 < ts.length; k += 2) out.push([[d * nx + ts[k] * ux, d * ny + ts[k] * uy], [d * nx + ts[k + 1] * ux, d * ny + ts[k + 1] * uy]]); } });
    if (e.pat === 'conc') { const sp = 4.5 * sc; let k = 0; for (let x = b.x0 + sp / 2; x < b.x1; x += sp) for (let y = b.y0 + sp / 2; y < b.y1; y += sp) { k++; const jx = x + ((k * 37) % 10) / 10 * sp * 0.6 - sp * 0.3, jy = y + ((k * 53) % 10) / 10 * sp * 0.6 - sp * 0.3; if (!inPoly([jx, jy], P)) continue; if (k % 3 === 0) { const r = 0.5 * sc; out.push([[jx, jy + r], [jx - r * 0.87, jy - r / 2]], [[jx - r * 0.87, jy - r / 2], [jx + r * 0.87, jy - r / 2]], [[jx + r * 0.87, jy - r / 2], [jx, jy + r]]); } else out.push([[jx, jy], [jx + 0.2 * sc, jy]]); } }
    return out;
  }
  // explode an entity into primitive lines/arcs/text for DXF (hatch -> lines)
  function primitives(e) { if (e.t === 'hatch') return hatchLines(e).map(s => ({ t: 'line', a: s[0], b: s[1], L: e.L })).concat(e.pat === 'solid' ? [] : []); return [e]; }

  // ------------------------------------------------------------------ title block & border (paper mm)
  function sheetFrame(sh) {
    const [W, H] = SIZES[sh.size] || SIZES.A1, E = [], t = sh.title || {}, m = 10, add = e => E.push(Object.assign({ L: 'S-BORDER' }, e));
    add({ t: 'pl', p: [[m, m], [W - m, m], [W - m, H - m], [m, H - m]], closed: true });
    const bw = 180, bh = 70, x0 = W - m - bw, y0 = m; add({ t: 'pl', p: [[x0, y0], [x0 + bw, y0], [x0 + bw, y0 + bh], [x0, y0 + bh]], closed: true });
    [[y0 + 52], [y0 + 38], [y0 + 26], [y0 + 14]].forEach(([y]) => add({ t: 'line', a: [x0, y], b: [x0 + bw, y] }));
    add({ t: 'line', a: [x0 + 90, y0], b: [x0 + 90, y0 + 26] }); add({ t: 'line', a: [x0 + 135, y0], b: [x0 + 135, y0 + 14] });
    const T = (x, y, s, h, al, L) => E.push({ t: 'text', p: [x, y], s: String(s || ''), h, al: al || 'l', v: 'b', ang: 0, L: L || 'S-TEXT' });
    T(x0 + 3, y0 + 64, (t.client || 'CLIENT / ASSET OWNER').toUpperCase(), 3.5, 'l', 'S-TITLE'); T(x0 + 3, y0 + 56, (t.project || 'PROJECT').toUpperCase(), 2.8);
    T(x0 + bw / 2, y0 + 45, (t.title1 || 'TIMBER BRIDGE REPAIR DETAILS').toUpperCase(), 3.5, 'c', 'S-TITLE'); T(x0 + bw / 2, y0 + 40, (t.title2 || '').toUpperCase(), 3, 'c');
    T(x0 + 3, y0 + 30, 'BRIDGE No ' + (t.bridge || '') + (t.road ? '  —  ' + t.road : ''), 2.5);
    T(x0 + 3, y0 + 18, 'DRAWN  ' + (t.drawn || ''), 2.2); T(x0 + 3, y0 + 4, 'CHECKED  ' + (t.checked || ''), 2.2); T(x0 + 47, y0 + 18, 'DESIGNED  ' + (t.designed || ''), 2.2); T(x0 + 47, y0 + 4, 'DATE  ' + (t.date || ''), 2.2);
    T(x0 + 92, y0 + 18, 'SCALE  ' + (t.scale || 'AS SHOWN'), 2.2); T(x0 + 92, y0 + 4, 'SHEET  ' + (t.sheet || '1 OF 1'), 2.2);
    T(x0 + 137, y0 + 20, 'DRAWING No', 2); T(x0 + 137, y0 + 15, t.dwg || 'XXXX-XXXX', 3.5, 'l', 'S-TITLE'); T(x0 + 137, y0 + 4, 'REV  ' + (t.rev || 'A'), 2.5);
    if (t.status) { E.push({ t: 'pl', p: [[x0 + 20, y0 + bh + 8], [x0 + bw - 20, y0 + bh + 8], [x0 + bw - 20, y0 + bh + 20], [x0 + 20, y0 + bh + 20]], closed: true, L: 'S-BORDER' }); T(x0 + bw / 2, y0 + bh + 12, String(t.status).toUpperCase(), 4.5, 'c', 'S-TITLE'); }
    T(m + 2, m + 2, 'Drawn with StructCap · details redrawn after the road authority standard drawings — verify against the current issue before use', 1.8, 'l');
    return E;
  }
  function allEnts(sh, opt) { opt = opt || {}; let E = (opt.noFrame ? [] : sheetFrame(sh)).concat(sh.ents || []); (sh.items || []).forEach(it => { E = E.concat(itemEnts(it)); }); return E; }

  // ------------------------------------------------------------------ SVG rendering
  const escX = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function svgEnt(e, doc, H, extra) {
    const ld = layerDef(doc, e.L), col = e.col != null ? (ACI[e.col] || e.col) : (ACI[ld.c] || ld.c || 'currentColor'), dash = DASH[e.lt || ld.lt] || '', lw = max(0.13, e.lw || ld.lw || 0.25), Y = y => H - y, at = extra || '';
    const st = `stroke="${col}" stroke-width="${lw}" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ''}`;
    switch (e.t) {
      case 'line': return `<line x1="${e.a[0]}" y1="${Y(e.a[1])}" x2="${e.b[0]}" y2="${Y(e.b[1])}" ${st} ${at}/>`;
      case 'pl': return `<polyline points="${e.p.concat(e.closed ? [e.p[0]] : []).map(q => q[0] + ',' + Y(q[1])).join(' ')}" ${st} stroke-linejoin="round" ${at}/>`;
      case 'circle': return `<circle cx="${e.c[0]}" cy="${Y(e.c[1])}" r="${e.r}" ${st} ${at}/>`;
      case 'arc': { const a0 = e.a0 * PI / 180, a1 = e.a1 * PI / 180, sweep = ((e.a1 - e.a0) % 360 + 360) % 360, large = sweep > 180 ? 1 : 0, p0 = [e.c[0] + e.r * Math.cos(a0), Y(e.c[1] + e.r * Math.sin(a0))], p1 = [e.c[0] + e.r * Math.cos(a1), Y(e.c[1] + e.r * Math.sin(a1))]; return `<path d="M${p0[0]},${p0[1]} A${e.r},${e.r} 0 ${large} 0 ${p1[0]},${p1[1]}" ${st} ${at}/>`; }
      case 'solid': return `<polygon points="${e.p.map(q => q[0] + ',' + Y(q[1])).join(' ')}" fill="${col}" stroke="none" ${at}/>`;
      case 'hatch': { const L = hatchLines(e); return `<g ${at}><path d="${L.map(s => `M${s[0][0].toFixed(2)},${Y(s[0][1]).toFixed(2)}L${s[1][0].toFixed(2)},${Y(s[1][1]).toFixed(2)}`).join('')}" stroke="${col}" stroke-width="0.13" fill="none"/></g>`; }
      case 'text': { const anc = e.al === 'c' ? 'middle' : e.al === 'r' ? 'end' : 'start', dy = e.v === 'm' ? e.h * 0.5 : e.v === 't' ? e.h : 0, x = e.p[0], y = Y(e.p[1]); return `<text x="${x}" y="${y + dy}" font-size="${(e.h * 1.38).toFixed(2)}" text-anchor="${anc}" fill="${col}" font-family="ISOCPEUR, 'Arial Narrow', 'Roboto Condensed', Arial, sans-serif"${e.ang ? ` transform="rotate(${-e.ang} ${x} ${y})"` : ''} ${at}>${escX(e.s)}</text>`; }
    }
    return '';
  }
  function svgSheet(doc, sh, opt) {
    opt = opt || {}; const [W, H] = SIZES[sh.size] || SIZES.A1, vis = L => !doc.hidden || !doc.hidden[L];
    let s = ''; sheetFrame(sh).forEach(e => { if (vis(e.L)) s += svgEnt(e, doc, H); });
    (sh.ents || []).forEach((e, i) => { if (vis(e.L)) s += svgEnt(e, doc, H, `data-e="${i}"`); });
    (sh.items || []).forEach((it, i) => { s += `<g data-i="${i}">` + itemEnts(it).filter(e => vis(e.L)).map(e => svgEnt(e, doc, H)).join('') + '</g>'; });
    return { W, H, body: s };
  }
  function svgStandalone(doc, sh, dark) { const r = svgSheet(doc, sh); return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r.W} ${r.H}" width="${r.W}mm" height="${r.H}mm" preserveAspectRatio="xMidYMid meet" style="background:${dark ? '#111' : '#fff'};color:${dark ? '#eee' : '#111'}">${r.body}</svg>`; }
  function svgThumb(E, w, h) { const b = bboxOf(E), pad = 4, W = b.x1 - b.x0 + 2 * pad, H = b.y1 - b.y0 + 2 * pad; const doc = { layers: {} }; return `<svg viewBox="${b.x0 - pad} ${-b.y1 - pad} ${W} ${H}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">${E.map(e => svgEnt(e, doc, 0)).join('')}</svg>`; }

  // ------------------------------------------------------------------ DXF writer (R12 / AC1009)
  function dxf(doc, sh, opt) {
    opt = opt || {}; const out = [], w = (c, v) => { out.push(String(c), String(v)); }, f = v => (+v).toFixed(4);
    const E = allEnts(sh, opt), Ls = {}; E.forEach(e => { Ls[e.L || '0'] = 1; }); Object.keys(D().LAYERS).forEach(k => { Ls[k] = 1; });
    const [W, H] = SIZES[sh.size] || SIZES.A1;
    w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); w(9, '$INSBASE'); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(9, '$EXTMIN'); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(9, '$EXTMAX'); w(10, f(W)); w(20, f(H)); w(30, '0.0');
    w(9, '$LIMMIN'); w(10, '0.0'); w(20, '0.0'); w(9, '$LIMMAX'); w(10, f(W)); w(20, f(H)); w(9, '$LTSCALE'); w(40, '1.0'); w(9, '$TEXTSTYLE'); w(7, 'STANDARD'); w(9, '$MEASUREMENT'); w(70, 1); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'TABLES');
    const LT = { CONTINUOUS: ['Solid line', []], DASHED: ['Dashed __ __ __', [3, -1.5]], HIDDEN: ['Hidden _ _ _', [1.6, -0.9]], CENTER: ['Center ____ _ ____', [8, -1.5, 1.5, -1.5]], PHANTOM: ['Phantom ____ _ _ ____', [10, -1.5, 1.5, -1.5, 1.5, -1.5]] };
    w(0, 'TABLE'); w(2, 'LTYPE'); w(70, Object.keys(LT).length); Object.entries(LT).forEach(([n, [d, p]]) => { w(0, 'LTYPE'); w(2, n); w(70, 0); w(3, d); w(72, 65); w(73, p.length); w(40, f(p.reduce((a, v) => a + abs(v), 0))); p.forEach(v => w(49, f(v))); }); w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'LAYER'); w(70, Object.keys(Ls).length + 1); w(0, 'LAYER'); w(2, '0'); w(70, 0); w(62, 7); w(6, 'CONTINUOUS');
    Object.keys(Ls).filter(k => k !== '0').forEach(k => { const ld = layerDef(doc, k); w(0, 'LAYER'); w(2, k); w(70, 0); w(62, typeof ld.c === 'number' ? ld.c : 7); w(6, ld.lt || 'CONTINUOUS'); }); w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'STYLE'); w(70, 1); w(0, 'STYLE'); w(2, 'STANDARD'); w(70, 0); w(40, '0.0'); w(41, '0.8'); w(50, '0.0'); w(71, 0); w(42, '2.5'); w(3, 'txt'); w(4, ''); w(0, 'ENDTAB');
    w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'BLOCKS'); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'ENTITIES');
    const common = e => { w(8, e.L || '0'); if (e.lt) w(6, e.lt); if (e.col != null && typeof e.col === 'number') w(62, e.col); };
    E.forEach(e0 => primitives(e0).forEach(e => {
      if (e.t === 'line') { w(0, 'LINE'); common(e); w(10, f(e.a[0])); w(20, f(e.a[1])); w(30, '0.0'); w(11, f(e.b[0])); w(21, f(e.b[1])); w(31, '0.0'); }
      else if (e.t === 'pl') { w(0, 'POLYLINE'); common(e); w(66, 1); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(70, e.closed ? 1 : 0); e.p.forEach(q => { w(0, 'VERTEX'); w(8, e.L || '0'); w(10, f(q[0])); w(20, f(q[1])); w(30, '0.0'); }); w(0, 'SEQEND'); w(8, e.L || '0'); }
      else if (e.t === 'circle') { w(0, 'CIRCLE'); common(e); w(10, f(e.c[0])); w(20, f(e.c[1])); w(30, '0.0'); w(40, f(e.r)); }
      else if (e.t === 'arc') { w(0, 'ARC'); common(e); w(10, f(e.c[0])); w(20, f(e.c[1])); w(30, '0.0'); w(40, f(e.r)); w(50, f(((e.a0 % 360) + 360) % 360)); w(51, f(((e.a1 % 360) + 360) % 360)); }
      else if (e.t === 'solid') { w(0, 'SOLID'); common(e); const p = e.p; w(10, f(p[0][0])); w(20, f(p[0][1])); w(30, '0.0'); w(11, f(p[1][0])); w(21, f(p[1][1])); w(31, '0.0'); w(12, f(p[2][0])); w(22, f(p[2][1])); w(32, '0.0'); w(13, f((p[3] || p[2])[0])); w(23, f((p[3] || p[2])[1])); w(33, '0.0'); }
      else if (e.t === 'text') { w(0, 'TEXT'); common(e); w(10, f(e.p[0])); w(20, f(e.p[1])); w(30, '0.0'); w(40, f(e.h)); w(1, String(e.s).replace(/[\r\n]+/g, ' ').replace(/℄/g, 'CL').replace(/[^\x20-\x7e°±φ≥≤]/g, '?').replace(/φ/g, '%%c').replace(/°/g, '%%d').replace(/±/g, '%%p').replace(/≥/g, '>=').replace(/≤/g, '<=')); if (e.ang) w(50, f(e.ang)); w(41, '0.8'); w(7, 'STANDARD');
        const h = e.al === 'c' ? 1 : e.al === 'r' ? 2 : 0, v = e.v === 'm' ? 2 : e.v === 't' ? 3 : 0; if (h || v) { w(72, h); w(11, f(e.p[0])); w(21, f(e.p[1])); w(31, '0.0'); if (v) w(73, v); } }
    }));
    w(0, 'ENDSEC'); w(0, 'EOF');
    return out.join('\r\n') + '\r\n';
  }

  // ------------------------------------------------------------------ DXF reader
  function parseDXF(text) {
    const lines = text.split(/\r?\n/), pairs = []; for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([parseInt(lines[i].trim(), 10), lines[i + 1].replace(/\s+$/, '')]);
    const blocks = {}, ents = []; let i = 0, section = null;
    const readEnt = () => { const t = pairs[i][1], g = {}; const list = []; i++; while (i < pairs.length && pairs[i][0] !== 0) { const [c, v] = pairs[i]; list.push([c, v]); if (!(c in g)) g[c] = v; i++; } return { t, g, list }; };
    const cvt = (r, out) => {
      const g = r.g, L = g[8] || '0', num = c => parseFloat(g[c] || 0);
      if (r.t === 'LINE') out.push({ t: 'line', a: [num(10), num(20)], b: [num(11), num(21)], L });
      else if (r.t === 'CIRCLE') out.push({ t: 'circle', c: [num(10), num(20)], r: num(40), L });
      else if (r.t === 'ARC') out.push({ t: 'arc', c: [num(10), num(20)], r: num(40), a0: num(50), a1: num(51), L });
      else if (r.t === 'TEXT' || r.t === 'MTEXT') { let s = r.t === 'MTEXT' ? r.list.filter(q => q[0] === 3 || q[0] === 1).map(q => q[1]).join('') : g[1] || ''; s = s.replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '').replace(/%%[cC]/g, 'φ').replace(/%%[dD]/g, '°').replace(/%%[pP]/g, '±'); const h72 = +g[72] || 0, h73 = +g[73] || 0, useAl = r.t === 'TEXT' && (h72 || h73) && g[11] != null; const att = r.t === 'MTEXT' ? +g[71] || 1 : 0;
        out.push({ t: 'text', p: useAl ? [num(11), num(21)] : [num(10), num(20)], s, h: num(40) || 2.5, al: r.t === 'MTEXT' ? ['l', 'c', 'r'][(att - 1) % 3] : ['l', 'c', 'r', 'l', 'c', 'l'][h72] || 'l', v: r.t === 'MTEXT' ? ['t', 'm', 'b'][Math.floor((att - 1) / 3)] : ['b', 'b', 'm', 't'][h73] || 'b', ang: num(50), L }); }
      else if (r.t === 'SOLID' || r.t === 'TRACE') out.push({ t: 'solid', p: [[num(10), num(20)], [num(11), num(21)], [num(13), num(23)], [num(12), num(22)]], L });
      else if (r.t === 'LWPOLYLINE') { const P = []; let x = null; r.list.forEach(([c, v]) => { if (c === 10) x = parseFloat(v); else if (c === 20 && x != null) { P.push([x, parseFloat(v)]); x = null; } }); out.push({ t: 'pl', p: P, closed: (+g[70] & 1) === 1, L }); }
      else if (r.t === 'POINT') out.push({ t: 'circle', c: [num(10), num(20)], r: 0.2, L });
    };
    const insert = (r, out) => { const g = r.g, b = blocks[g[2]]; if (!b) return; const t = { x: parseFloat(g[10] || 0), y: parseFloat(g[20] || 0), s: parseFloat(g[41] || 1), r: parseFloat(g[50] || 0) * PI / 180 }; b.forEach(e => out.push(transform(e, t))); };
    let curBlock = null, poly = null;
    while (i < pairs.length) {
      const [c, v] = pairs[i];
      if (c === 0 && v === 'SECTION') { i++; section = pairs[i] && pairs[i][1]; i++; continue; }
      if (c === 0 && v === 'ENDSEC') { section = null; i++; continue; }
      if (c === 0 && (section === 'ENTITIES' || section === 'BLOCKS')) {
        if (v === 'BLOCK') { const r = readEnt(); curBlock = r.g[2]; blocks[curBlock] = []; continue; }
        if (v === 'ENDBLK') { readEnt(); curBlock = null; continue; }
        const r = readEnt(), out = curBlock ? blocks[curBlock] : ents;
        if (r.t === 'POLYLINE') { poly = { t: 'pl', p: [], closed: (+r.g[70] & 1) === 1, L: r.g[8] || '0' }; continue; }
        if (r.t === 'VERTEX' && poly) { poly.p.push([parseFloat(r.g[10] || 0), parseFloat(r.g[20] || 0)]); continue; }
        if (r.t === 'SEQEND' && poly) { out.push(poly); poly = null; continue; }
        if (r.t === 'INSERT') { insert(r, out); continue; }
        cvt(r, out); continue;
      }
      i++;
    }
    return ents;
  }

  // ------------------------------------------------------------------ the editor UI
  G.SC_TDRAW_UI = function (ctx) {
    const { T, esc, $, S, toast, saveFile, today } = ctx, VIEW = 'tdraw', LS = 'sc.tdraw.v1';
    const store = { get() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v, (k, x) => (k === '_ents' || k === '_k' ? undefined : x))); } catch (e) { } } };
    const newSheet = n => ({ name: n || 'Sheet 1', size: 'A1', title: { client: 'ASSET OWNER', project: 'TIMBER BRIDGE REFURBISHMENT', title1: 'TIMBER BRIDGE REPAIR DETAILS', title2: 'SUBSTRUCTURE / SUPERSTRUCTURE', bridge: '', dwg: 'XXXX-XXXX', rev: 'A', drawn: '', checked: '', designed: '', date: today(), scale: 'AS SHOWN', sheet: '1 OF 1', status: 'PRELIMINARY' }, ents: [], items: [] });
    const saved = store.get(), A = { doc: saved && saved.sheets ? saved : { sheets: [newSheet()], cur: 0, hidden: {}, layers: {} }, tool: 'select', sel: [], cam: null, draft: null, place: null, hist: [], fut: [], snap: { end: true, mid: true, grid: true, ortho: false }, lib: 'Piles', curL: 'S-NEW', rib: 'home', cursor: [0, 0], clip: null };
    const SH = () => A.doc.sheets[A.doc.cur] || A.doc.sheets[0];
    const persist = () => store.set(A.doc);
    const snapH = () => { A.hist.push(JSON.stringify(A.doc, (k, x) => (k === '_ents' || k === '_k' ? undefined : x))); if (A.hist.length > 80) A.hist.shift(); A.fut = []; };
    const undo = redo => { const from = redo ? A.fut : A.hist, to = redo ? A.hist : A.fut; if (!from.length) return; to.push(JSON.stringify(A.doc, (k, x) => (k === '_ents' || k === '_k' ? undefined : x))); A.doc = JSON.parse(from.pop()); A.sel = []; persist(); redraw(); refreshSide(); };
    const IC = { sel: '<path d="M5 3l12 8-6 1.5L8 19z"/>', line: '<path d="M4 20L20 4"/>', pl: '<path d="M3 19l5-9 6 5 7-11"/>', rect: '<path d="M4 6h16v12H4z"/>', circ: '<circle cx="12" cy="12" r="8"/>', text: '<path d="M5 6h14M12 6v13"/>', dim: '<path d="M4 8v8M20 8v8M4 12h16M6 10l-2 2 2 2M18 10l2 2-2 2"/>', leader: '<path d="M4 18l8-8h8M4 18l1-4M4 18l4-1"/>', move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3"/>', copy: '<path d="M8 8h12v12H8zM4 16V4h12"/>', del: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>', rot: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>', expl: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4"/>', undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3"/>', redo: '<path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h3"/>', fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>', dxf: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13l2 3 2-3M9 17l2-3 2 3"/>', imp: '<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>', pdf: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>', svg: '<path d="M4 4h16v16H4zM8 15l3-6 3 6M8 12h6"/>', save: '<path d="M5 3h12l3 3v15H5zM8 3v5h8V3M8 14h8v7H8z"/>', open: '<path d="M3 7h6l2 2h10v10H3zM3 11h18"/>', new: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M12 10v7M8.5 13.5h7"/>', hatch: '<path d="M4 4h16v16H4zM4 12L12 4M4 20L20 4M12 20l8-8"/>', sheet: '<path d="M3 5h18v14H3zM14 13h7M14 13v6"/>', lib: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>' };
    const icon = (k, big) => `<svg class="an-ic ${big ? 'big' : ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || IC.sel}</svg>`;

    // ---------------------------------------------------------------- ribbon
    function RIB() {
      const tool = (c, i, l) => ({ c: 'tool', v: c, i, l, on: () => A.tool === c });
      return [
        ['home', T('Home', 'หน้าหลัก'), [
          [T('Drawing', 'แบบ'), [{ c: 'new', i: 'new', l: T('New drawing', 'แบบใหม่') }, { file: 1, i: 'open', l: T('Open', 'เปิด') }, { c: 'save', i: 'save', l: T('Save', 'บันทึก') }]],
          [T('Draw', 'วาด'), [tool('select', 'sel', T('Select', 'เลือก')), tool('line', 'line', T('Line', 'เส้น')), tool('pl', 'pl', T('Polyline', 'เส้นต่อเนื่อง')), tool('rect', 'rect', T('Rectangle', 'สี่เหลี่ยม')), tool('circle', 'circ', T('Circle', 'วงกลม')), tool('hatch', 'hatch', T('Hatch', 'แรเงา'))]],
          [T('Modify', 'แก้ไข'), [{ c: 'copy', i: 'copy', l: T('Copy', 'คัดลอก') }, { c: 'rot', i: 'rot', l: T('Rotate 90°', 'หมุน 90°') }, { c: 'explode', i: 'expl', l: T('Explode', 'แยกส่วน') }, { c: 'del', i: 'del', l: T('Delete', 'ลบ') }, { col: [{ c: 'undo', i: 'undo', l: T('Undo', 'เลิกทำ') }, { c: 'redo', i: 'redo', l: T('Redo', 'ทำซ้ำ') }] }]]]],
        ['annot', T('Annotate', 'คำอธิบาย'), [
          [T('Annotate', 'คำอธิบาย'), [tool('text', 'text', T('Text', 'ข้อความ')), tool('leader', 'leader', T('Leader', 'เส้นชี้')), tool('dim', 'dim', T('Dimension', 'มิติ'))]],
          [T('Snap', 'สแนป'), [{ col: [['end', T('Endpoint', 'จุดปลาย')], ['mid', T('Midpoint', 'จุดกึ่งกลาง')], ['grid', T('Grid 1 mm', 'กริด 1 มม.')], ['ortho', T('Ortho (F8)', 'ตั้งฉาก (F8)')]].map(([v, l]) => ({ radio: 1, c: 'snap', v, l, on: () => A.snap[v] })) }]]]],
        ['insert', T('Repair details', 'รายละเอียดซ่อม'), [
          [T('Library', 'คลังแบบ'), [{ c: 'libpanel', i: 'lib', l: T('Detail library', 'คลังรายละเอียด'), on: () => true }]],
          [T('Sheet', 'แผ่นงาน'), [{ c: 'sheetnew', i: 'sheet', l: T('New sheet', 'แผ่นใหม่') }, { col: ['A1', 'A2', 'A3'].map(s => ({ radio: 1, c: 'size', v: s, l: s, on: () => SH().size === s })) }]]]],
        ['export', T('Export', 'ส่งออก'), [
          [T('AutoCAD', 'AutoCAD'), [{ c: 'dxf', i: 'dxf', l: T('Export DXF', 'ส่งออก DXF') }, { dxfin: 1, i: 'imp', l: T('Import DXF', 'นำเข้า DXF') }]],
          [T('Print', 'พิมพ์'), [{ c: 'pdf', i: 'pdf', l: T('Export PDF', 'ส่งออก PDF') }, { c: 'svg', i: 'svg', l: T('Export SVG', 'ส่งออก SVG') }]]]],
        ['view', T('View', 'มุมมอง'), [[T('View', 'มุมมอง'), [{ c: 'fit', i: 'fit', l: T('Zoom to sheet', 'พอดีแผ่น') }]]]]
      ];
    }
    function rbtn(it, big) {
      const on = it.on ? it.on() : false, lab = esc(it.l);
      if (it.file) return `<label class="an-rb ${big ? 'big' : 'sm'}" title="${lab}">${icon(it.i, big)}<span>${lab}</span><input type="file" accept=".json,application/json" id="td-file" hidden></label>`;
      if (it.dxfin) return `<label class="an-rb ${big ? 'big' : 'sm'}" title="${lab}">${icon(it.i, big)}<span>${lab}</span><input type="file" accept=".dxf" id="td-dxf" hidden></label>`;
      if (it.radio) return `<button class="an-rb sm an-rradio" data-act="td-rb" data-c="${it.c}" data-v="${it.v}" aria-pressed="${on}"><i class="an-rdot"></i><span>${lab}</span></button>`;
      return `<button class="an-rb ${big ? 'big' : 'sm'}" data-act="td-rb" data-c="${it.c}" ${it.v ? `data-v="${esc(it.v)}"` : ''} aria-pressed="${on}" title="${lab}">${icon(it.i, big)}<span>${lab}</span></button>`;
    }
    function ribHTML() {
      const tabs = RIB(), cur = tabs.find(t => t[0] === A.rib) || tabs[0];
      return `<div class="an-rib" id="tdRib"><div class="an-ribtabs" role="tablist">${tabs.map(t => `<button role="tab" class="an-rtab" data-act="td-ribtab" data-t="${t[0]}" aria-selected="${t[0] === cur[0]}">${t[1]}</button>`).join('')}<span class="grow"></span>
        <span class="an-qat">${[['undo', 'undo', T('Undo', 'เลิกทำ')], ['redo', 'redo', T('Redo', 'ทำซ้ำ')], ['save', 'save', T('Save', 'บันทึก')], ['dxf', 'dxf', T('Export DXF', 'ส่งออก DXF')]].map(([c, i, l]) => `<button class="an-qb" data-act="td-rb" data-c="${c}" title="${esc(l)}" aria-label="${esc(l)}">${icon(i)}</button>`).join('')}</span></div>
        <div class="an-ribbar" role="toolbar">${cur[2].map(([title, items]) => `<div class="an-rg"><div class="an-rgi">${items.map(it => (it.col ? `<div class="an-rcol">${it.col.map(x => rbtn(x, false)).join('')}</div>` : rbtn(it, true))).join('')}</div><div class="an-rgt">${title}</div></div>`).join('')}</div></div>`;
    }
    const ribRefresh = () => { const r = $('#tdRib'); if (r) r.outerHTML = ribHTML(); };

    // ---------------------------------------------------------------- side panels
    const thumbs = {};
    function libHTML() {
      const cats = [...new Set(D().DEF.map(d => d.cat))];
      return `<div class="td-libh">${cats.map(c => `<button class="td-cat" data-act="td-cat" data-v="${esc(c)}" aria-pressed="${A.lib === c}">${esc(c)}</button>`).join('')}</div>
        <div class="td-libl">${D().DEF.filter(d => d.cat === A.lib).map(d => { if (!thumbs[d.id]) { try { thumbs[d.id] = svgThumb(D().generate(d.id, {}), 220, 120); } catch (e) { thumbs[d.id] = ''; } } return `<button class="td-li ${A.place && A.place.det === d.id ? 'on' : ''}" data-act="td-pick" data-v="${d.id}" title="${esc(d.info || d.name)}"><span class="td-th">${thumbs[d.id]}</span><b>${esc(d.name)}</b><span class="muted small">${T('after std drg', 'อ้างอิงแบบมาตรฐาน')} ${esc(d.ref)}</span></button>`; }).join('')}</div>`;
    }
    function propsHTML() {
      const sh = SH(), one = A.sel.length === 1 ? A.sel[0] : null;
      const fld = (key, lbl, val, kind, opts) => { const id = 'tdf-' + key.replace(/[^\w]/g, '_'); return `<label class="cn-f" for="${id}"><span>${lbl}</span>${kind === 'sel' ? `<select id="${id}" data-tp="${esc(key)}">${opts.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(val) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>` : `<input id="${id}" data-tp="${esc(key)}" ${kind === 'num' ? 'type="number" step="any"' : ''} value="${esc(val == null ? '' : val)}">`}</label>`; };
      const layers = Object.keys(D().LAYERS).map(k => [k, k]);
      let h = '';
      if (one && one.k === 'i') { const it = sh.items[one.i], d = D().DEF.find(q => q.id === it.det); if (it && d) { h = `<div class="cn-ph"><b>${esc(d.name)}</b><span class="muted small">${T('After standard drawing', 'อ้างอิงแบบมาตรฐาน')} ${esc(d.ref)}</span></div>` + d.params.map(q => fld('p.' + q.k, esc(q.n), it.params[q.k] != null ? it.params[q.k] : q.v, q.opts ? 'sel' : q.num ? 'num' : 'text', q.opts && q.opts.map(o => [o, String(o).replace(/(\d+)(UC|UB|PFC)(\d*)/, '$1 $2 $3').trim()]))).join('') + fld('it.s', T('Size factor', 'ตัวคูณขนาด'), it.s || 1, 'num') + fld('it.rd', T('Rotation (°)', 'มุมหมุน (°)'), Math.round((it.r || 0) * 180 / PI), 'num') + `<p class="cn-note">${esc(d.info || '')} ${T('Each view keeps its drawing scale; the size factor scales the whole detail on the sheet.', 'แต่ละมุมมองคงมาตราส่วนเดิม ตัวคูณขนาดย่อ/ขยายรายละเอียดทั้งหมดบนแผ่น')}</p><div class="cn-btns"><button class="btn btn-ghost xs" data-act="td-rb" data-c="explode">${T('Explode to editable lines', 'แยกเป็นเส้นแก้ไขได้')}</button><button class="btn btn-ghost xs" data-act="td-rb" data-c="del">${T('Delete', 'ลบ')}</button></div>`; } }
      else if (one && one.k === 'e') { const e = sh.ents[one.i]; if (e) { h = `<div class="cn-ph"><b>${{ line: T('Line', 'เส้น'), pl: T('Polyline', 'เส้นต่อเนื่อง'), circle: T('Circle', 'วงกลม'), arc: T('Arc', 'ส่วนโค้ง'), text: T('Text', 'ข้อความ'), hatch: T('Hatch', 'แรเงา'), solid: T('Solid', 'ทึบ') }[e.t] || e.t}</b></div>` + fld('e.L', T('Layer', 'เลเยอร์'), e.L, 'sel', layers);
        if (e.t === 'text') h += fld('e.s', T('Text', 'ข้อความ'), e.s, 'text') + fld('e.h', T('Height (mm)', 'ความสูง (มม.)'), e.h, 'num') + fld('e.ang', T('Angle (°)', 'มุม (°)'), e.ang || 0, 'num') + fld('e.al', T('Align', 'จัดแนว'), e.al || 'l', 'sel', [['l', T('Left', 'ซ้าย')], ['c', T('Centre', 'กลาง')], ['r', T('Right', 'ขวา')]]);
        if (e.t === 'line') h += fld('e.a0', 'X1', e.a[0].toFixed(2), 'num') + fld('e.a1', 'Y1', e.a[1].toFixed(2), 'num') + fld('e.b0', 'X2', e.b[0].toFixed(2), 'num') + fld('e.b1', 'Y2', e.b[1].toFixed(2), 'num');
        if (e.t === 'circle') h += fld('e.r', T('Radius', 'รัศมี'), e.r, 'num');
        if (e.t === 'hatch') h += fld('e.pat', T('Pattern', 'ลาย'), e.pat, 'sel', [['ansi31', 'ANSI31 (steel / section)'], ['ansi37', 'ANSI37 (cross)'], ['conc', T('Concrete', 'คอนกรีต')], ['earth', T('Earth', 'ดิน')]]) + fld('e.sc', T('Pattern scale', 'มาตราส่วนลาย'), e.sc || 1, 'num');
        h += fld('e.lt', T('Linetype', 'ชนิดเส้น'), e.lt || '', 'sel', [['', T('By layer', 'ตามเลเยอร์')], ['CONTINUOUS', 'CONTINUOUS'], ['DASHED', 'DASHED'], ['HIDDEN', 'HIDDEN'], ['CENTER', 'CENTER'], ['PHANTOM', 'PHANTOM']]); } }
      else if (A.sel.length > 1) h = `<div class="cn-ph"><b>${A.sel.length} ${T('objects selected', 'วัตถุที่เลือก')}</b></div>` + fld('m.L', T('Move to layer', 'ย้ายไปเลเยอร์'), '', 'sel', [['', '—']].concat(layers));
      else { const t = sh.title || {}; h = `<div class="cn-ph"><b>${T('Sheet', 'แผ่นงาน')} — ${esc(sh.name)}</b><span class="muted small">${sh.size} · ${(sh.items || []).length} ${T('details', 'รายละเอียด')} · ${(sh.ents || []).length} ${T('objects', 'วัตถุ')}</span></div>` +
        [['name', T('Sheet name', 'ชื่อแผ่น')], ['t.client', T('Client / asset owner', 'เจ้าของทรัพย์สิน')], ['t.project', T('Project', 'โครงการ')], ['t.title1', T('Title line 1', 'ชื่อแบบบรรทัด 1')], ['t.title2', T('Title line 2', 'ชื่อแบบบรรทัด 2')], ['t.bridge', T('Bridge No.', 'หมายเลขสะพาน')], ['t.road', T('Road / location', 'ถนน / ที่ตั้ง')], ['t.dwg', T('Drawing No.', 'เลขที่แบบ')], ['t.rev', T('Revision', 'ฉบับแก้ไข')], ['t.designed', T('Designed', 'ออกแบบ')], ['t.drawn', T('Drawn', 'เขียนแบบ')], ['t.checked', T('Checked', 'ตรวจสอบ')], ['t.date', T('Date', 'วันที่')], ['t.sheet', T('Sheet', 'แผ่นที่')], ['t.status', T('Status stamp', 'สถานะ')]].map(([k, l]) => fld(k, l, k === 'name' ? sh.name : t[k.slice(2)], 'text')).join(''); }
      const lay = `<div class="cn-ph"><b>${T('Layers', 'เลเยอร์')}</b></div><div class="td-lay">${Object.entries(D().LAYERS).map(([k, l]) => `<label class="td-ly"><input type="checkbox" data-tl="${k}" ${A.doc.hidden && A.doc.hidden[k] ? '' : 'checked'}><i style="background:${ACI[l.c] === 'currentColor' ? 'var(--ink)' : ACI[l.c] || '#888'}"></i><span title="${esc(l.n)}">${k}</span><button class="td-cur ${A.curL === k ? 'on' : ''}" data-act="td-curl" data-v="${k}" title="${T('Make current', 'ตั้งเป็นเลเยอร์ปัจจุบัน')}">${A.curL === k ? '●' : '○'}</button></label>`).join('')}</div>`;
      return h + lay;
    }
    function tabsHTML() { return `<div class="td-tabs">${A.doc.sheets.map((s, i) => `<button class="td-tab" data-act="td-sheet" data-v="${i}" aria-pressed="${i === A.doc.cur}">${esc(s.name)}</button>`).join('')}<button class="td-tab" data-act="td-rb" data-c="sheetnew" title="${T('New sheet', 'แผ่นใหม่')}">+</button><span class="grow"></span><span class="muted small" id="tdXY"></span></div>`; }
    function refreshSide() { const p = $('#tdProps'); if (p) p.innerHTML = propsHTML(); const l = $('#tdLib'); if (l) l.innerHTML = libHTML(); const t = $('#tdTabs'); if (t) t.innerHTML = tabsHTML(); }
    function view() {
      return `<main class="an an-app td-app">${ribHTML()}
        <aside class="an-side td-lib" id="tdLib">${libHTML()}</aside>
        <section class="td-work"><div class="td-tabsw" id="tdTabs">${tabsHTML()}</div><div class="td-canvas" id="tdCanvas"><svg id="tdSvg" tabindex="0" aria-label="${T('Drawing sheet', 'แผ่นงาน')}"></svg></div>
          <p class="an-hintbar td-hint" id="tdHint">${hint()}</p></section>
        <aside class="cn-props td-props" id="tdProps">${propsHTML()}</aside></main>`;
    }
    function hint() { return ({ select: T('Click to select · drag a box (→ window, ← crossing) · drag selected objects to move · double-click text or a detail to edit · Del deletes', 'คลิกเพื่อเลือก · ลากกรอบ · ลากวัตถุที่เลือกเพื่อย้าย · ดับเบิลคลิกเพื่อแก้ไข · Del ลบ'), line: T('Line: click start and end points (chain) · Esc / right-click: stop', 'เส้น: คลิกจุดเริ่มและจุดปลาย · Esc: หยุด'), pl: T('Polyline: click points · double-click or Enter: finish', 'เส้นต่อเนื่อง: คลิกจุด · ดับเบิลคลิกหรือ Enter: จบ'), rect: T('Rectangle: two corners', 'สี่เหลี่ยม: คลิกสองมุม'), circle: T('Circle: centre then radius', 'วงกลม: จุดศูนย์กลางแล้วรัศมี'), text: T('Text: click to place, then type in the panel', 'ข้อความ: คลิกเพื่อวาง แล้วพิมพ์ในแผง'), leader: T('Leader: click the arrow point, then the text point', 'เส้นชี้: คลิกปลายลูกศร แล้วตำแหน่งข้อความ'), dim: T('Dimension: click two points, then the dimension line position', 'มิติ: คลิกสองจุด แล้วตำแหน่งเส้นมิติ'), hatch: T('Hatch: click inside a closed polyline or rectangle', 'แรเงา: คลิกภายในรูปปิด'), place: T('Click to place the detail · Esc: cancel · wheel: zoom', 'คลิกเพื่อวางรายละเอียด · Esc: ยกเลิก') })[A.place ? 'place' : A.tool] + ' · ' + T('wheel: zoom · middle / right-drag: pan', 'ล้อเมาส์: ซูม · ลากปุ่มกลาง/ขวา: เลื่อน'); }

    // ---------------------------------------------------------------- drawing
    let svg = null;
    function vb() { const [W, H] = SIZES[SH().size] || SIZES.A1, el = $('#tdCanvas'); if (!A.cam && el) { const r = el.getBoundingClientRect(), k = min(r.width / (W + 40), r.height / (H + 40)); A.cam = { x: -20 - (r.width / k - W - 40) / 2, y: -20 - (r.height / k - H - 40) / 2, k }; } return A.cam; }
    function redraw() {
      svg = $('#tdSvg'); if (!svg) return; const el = $('#tdCanvas'), r = el.getBoundingClientRect(), c = vb(); if (!c) return; const sh = SH(), [W, H] = SIZES[sh.size] || SIZES.A1;
      svg.setAttribute('viewBox', `${c.x} ${c.y} ${r.width / c.k} ${r.height / c.k}`);
      const body = svgSheet(A.doc, sh);
      let selH = ''; A.sel.forEach(s => { const E = s.k === 'i' ? itemEnts(sh.items[s.i] || {}) : [sh.ents[s.i]].filter(Boolean); const b = bboxOf(E); selH += `<rect x="${b.x0 - 1}" y="${H - b.y1 - 1}" width="${b.x1 - b.x0 + 2}" height="${b.y1 - b.y0 + 2}" class="td-selb"/>`; if (s.k === 'e' && E[0]) entPoints(E[0]).forEach(q => { selH += `<rect x="${q[0] - 1.2}" y="${H - q[1] - 1.2}" width="2.4" height="2.4" class="td-grip"/>`; }); });
      let ghost = ''; if (A.place) { const E = itemEnts(A.place); ghost = `<g class="td-ghost">${E.map(e => svgEnt(e, A.doc, H)).join('')}</g>`; }
      if (A.draft) ghost += `<g class="td-ghost">${A.draft.map(e => svgEnt(e, A.doc, H)).join('')}</g>`;
      if (A.box) { const b = A.box; ghost += `<rect x="${min(b.a[0], b.b[0])}" y="${H - max(b.a[1], b.b[1])}" width="${abs(b.b[0] - b.a[0])}" height="${abs(b.b[1] - b.a[1])}" class="${b.b[0] >= b.a[0] ? 'td-win' : 'td-cross'}"/>`; }
      if (A.snapPt) ghost += `<rect x="${A.snapPt[0] - 1.5}" y="${H - A.snapPt[1] - 1.5}" width="3" height="3" class="td-snap"/>`;
      svg.innerHTML = `<rect x="0" y="0" width="${W}" height="${H}" class="td-paper"/>${body.body}${selH}${ghost}`;
    }
    const toModel = (ev) => { const r = svg.getBoundingClientRect(), c = A.cam, [, H] = SIZES[SH().size] || SIZES.A1; return [c.x + (ev.clientX - r.left) / c.k, H - (c.y + (ev.clientY - r.top) / c.k)]; };
    function snapPoint(p, base) {
      const tol = 8 / A.cam.k, sh = SH(); let best = null, bd = tol;
      if (A.snap.end || A.snap.mid) { const E = allEnts(sh, { noFrame: false }); for (const e of E) { const pts = []; if (A.snap.end) entPoints(e).forEach(q => pts.push(q)); if (A.snap.mid && e.t === 'line') pts.push([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]); if (A.snap.mid && e.t === 'pl') e.p.forEach((q, i) => { const r = e.p[i + 1] || (e.closed ? e.p[0] : null); if (r) pts.push([(q[0] + r[0]) / 2, (q[1] + r[1]) / 2]); }); for (const q of pts) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } } } }
      let out = best ? best.slice() : (A.snap.grid ? [Math.round(p[0]), Math.round(p[1])] : p.slice());
      if (A.snap.ortho && base && !best) { if (abs(out[0] - base[0]) > abs(out[1] - base[1])) out[1] = base[1]; else out[0] = base[0]; }
      A.snapPt = best; return out;
    }
    function pick(p) { const tol = 4 / A.cam.k, sh = SH(); for (let i = (sh.ents || []).length - 1; i >= 0; i--) if (!(A.doc.hidden || {})[sh.ents[i].L] && hitEnt(sh.ents[i], p, tol)) return { k: 'e', i }; for (let i = (sh.items || []).length - 1; i >= 0; i--) { const E = itemEnts(sh.items[i]); if (E.some(e => hitEnt(e, p, tol))) return { k: 'i', i }; } return null; }
    const same = (a, b) => a.k === b.k && a.i === b.i;
    function boxSelect(a, b) { const x0 = min(a[0], b[0]), x1 = max(a[0], b[0]), y0 = min(a[1], b[1]), y1 = max(a[1], b[1]), win = b[0] >= a[0], sh = SH(), out = [];
      const test = E => { const bb = bboxOf(E); return win ? bb.x0 >= x0 && bb.x1 <= x1 && bb.y0 >= y0 && bb.y1 <= y1 : !(bb.x1 < x0 || bb.x0 > x1 || bb.y1 < y0 || bb.y0 > y1); };
      (sh.ents || []).forEach((e, i) => { if (test([e])) out.push({ k: 'e', i }); }); (sh.items || []).forEach((it, i) => { if (test(itemEnts(it))) out.push({ k: 'i', i }); }); return out; }
    function moveSel(dx, dy) { const sh = SH(); A.sel.forEach(s => { if (s.k === 'i') { const it = sh.items[s.i]; it.x += dx; it.y += dy; } else sh.ents[s.i] = transform(sh.ents[s.i], { x: dx, y: dy, s: 1, r: 0 }); }); }
    function addEnt(e) { snapH(); SH().ents.push(Object.assign({ L: A.curL }, e)); persist(); }
    function finishDraft() { if (A.draftPts && A.tool === 'pl' && A.draftPts.length > 1) addEnt({ t: 'pl', p: A.draftPts.slice(), closed: false }); A.draftPts = null; A.draft = null; redraw(); refreshSide(); }
    function bind() {
      svg = $('#tdSvg'); if (!svg || svg._b) return; svg._b = true; let drag = null, lastClick = 0;
      svg.addEventListener('contextmenu', e => e.preventDefault());
      svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, c = A.cam, f = e.deltaY < 0 ? 1.2 : 1 / 1.2, wx = c.x + mx / c.k, wy = c.y + my / c.k; c.k *= f; c.x = wx - mx / c.k; c.y = wy - my / c.k; redraw(); }, { passive: false });
      svg.addEventListener('pointerdown', e => {
        svg.focus(); const p = toModel(e);
        if (e.button === 1 || e.button === 2) { if (e.button === 2 && (A.tool === 'line' || A.tool === 'pl') && A.draftPts) { finishDraft(); return; } drag = { pan: true, x: e.clientX, y: e.clientY, cx: A.cam.x, cy: A.cam.y }; svg.setPointerCapture(e.pointerId); return; }
        const sp = snapPoint(p, A.draftPts ? A.draftPts[A.draftPts.length - 1] : null), now = Date.now(), dbl = now - lastClick < 380; lastClick = now;
        if (A.place) { snapH(); const o = A.placeOff || [0, 0], it = Object.assign({}, A.place, { x: sp[0] - o[0], y: sp[1] - o[1] }); delete it._ents; delete it._k; SH().items.push(it); A.sel = [{ k: 'i', i: SH().items.length - 1 }]; A.place = null; persist(); redraw(); refreshSide(); setHint(); toast(T('Detail placed — edit its parameters on the right, or Explode to edit the lines.', 'วางรายละเอียดแล้ว — แก้ค่าได้ทางขวา หรือแยกส่วนเพื่อแก้เส้น'), 'ok'); return; }
        if (A.tool === 'select') {
          const hit = pick(p);
          if (dbl && hit) { A.sel = [hit]; refreshSide(); const f = document.querySelector('#tdProps input, #tdProps select'); if (f) f.focus(); redraw(); return; }
          if (hit) { if (e.shiftKey || e.ctrlKey) { const k = A.sel.findIndex(s => same(s, hit)); if (k >= 0) A.sel.splice(k, 1); else A.sel.push(hit); } else if (!A.sel.some(s => same(s, hit))) A.sel = [hit]; drag = { move: true, p0: sp, last: sp, moved: false }; }
          else { if (!e.shiftKey) A.sel = []; drag = { box: true, a: p }; A.box = { a: p, b: p }; }
          svg.setPointerCapture(e.pointerId); redraw(); refreshSide(); return;
        }
        if (A.tool === 'line') { if (!A.draftPts) A.draftPts = [sp]; else { addEnt({ t: 'line', a: A.draftPts[A.draftPts.length - 1], b: sp }); A.draftPts = [sp]; } return; }
        if (A.tool === 'pl') { if (dbl && A.draftPts) { finishDraft(); return; } (A.draftPts = A.draftPts || []).push(sp); return; }
        if (A.tool === 'rect' || A.tool === 'circle' || A.tool === 'leader') { if (!A.draftPts) A.draftPts = [sp]; else { const a = A.draftPts[0];
          if (A.tool === 'rect') addEnt({ t: 'pl', p: [a, [sp[0], a[1]], sp, [a[0], sp[1]]], closed: true });
          else if (A.tool === 'circle') addEnt({ t: 'circle', c: a, r: Math.hypot(sp[0] - a[0], sp[1] - a[1]) });
          else { const right = sp[0] >= a[0]; snapH(); const ang = Math.atan2(sp[1] - a[1], sp[0] - a[0]); SH().ents.push({ t: 'pl', p: [a, sp, [sp[0] + (right ? 3 : -3), sp[1]]], closed: false, L: 'S-TEXT' }, { t: 'solid', p: [a, [a[0] + 2.2 * Math.cos(ang) - 0.7 * Math.sin(ang), a[1] + 2.2 * Math.sin(ang) + 0.7 * Math.cos(ang)], [a[0] + 2.2 * Math.cos(ang) + 0.7 * Math.sin(ang), a[1] + 2.2 * Math.sin(ang) - 0.7 * Math.cos(ang)]], L: 'S-TEXT' }, { t: 'text', p: [sp[0] + (right ? 4.2 : -4.2), sp[1] - 1.1], s: T('NOTE TEXT', 'ข้อความ'), h: 2.2, al: right ? 'l' : 'r', v: 'b', ang: 0, L: 'S-TEXT' }); A.sel = [{ k: 'e', i: SH().ents.length - 1 }]; persist(); setTool('select'); refreshSide(); focusText(); }
          A.draftPts = null; A.draft = null; redraw(); refreshSide(); } return; }
        if (A.tool === 'text') { addEnt({ t: 'text', p: sp, s: T('TEXT', 'ข้อความ'), h: 2.5, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); A.sel = [{ k: 'e', i: SH().ents.length - 1 }]; setTool('select'); refreshSide(); redraw(); focusText(); return; }
        if (A.tool === 'dim') { (A.draftPts = A.draftPts || []).push(sp); if (A.draftPts.length === 3) { const [a, b, c] = A.draftPts, Bd = new (D().Builder)(), v = Bd.view(1, 0, 0), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, off = ((c[0] - a[0]) * -dy + (c[1] - a[1]) * dx) / L; v.dim(a[0], a[1], b[0], b[1], off, prompt1(String(Math.round(L * (A.dimScale || 1))))); snapH(); Bd.E.forEach(q => SH().ents.push(q)); persist(); A.draftPts = null; A.draft = null; redraw(); refreshSide(); } return; }
        if (A.tool === 'hatch') { const sh = SH(); const k = sh.ents.findIndex(q => (q.t === 'pl' && q.closed || q.t === 'circle') && (q.t === 'circle' ? Math.hypot(p[0] - q.c[0], p[1] - q.c[1]) < q.r : inPoly(p, q.p))); if (k < 0) { toast(T('Click inside a closed polyline, rectangle or circle.', 'คลิกภายในรูปปิด'), 'bad'); return; } const q = sh.ents[k], P = q.t === 'circle' ? Array.from({ length: 48 }, (_, i) => [q.c[0] + q.r * Math.cos(2 * PI * i / 48), q.c[1] + q.r * Math.sin(2 * PI * i / 48)]) : q.p.slice(); addEnt({ t: 'hatch', p: P, pat: 'ansi31', sc: 1, L: 'S-HATCH' }); redraw(); return; }
      });
      svg.addEventListener('pointermove', e => {
        const p = toModel(e), xy = $('#tdXY'); if (xy) xy.textContent = 'X ' + p[0].toFixed(1) + '  Y ' + p[1].toFixed(1) + ' mm';
        if (drag && drag.pan) { A.cam.x = drag.cx - (e.clientX - drag.x) / A.cam.k; A.cam.y = drag.cy - (e.clientY - drag.y) / A.cam.k; redraw(); return; }
        if (drag && drag.box) { A.box.b = p; redraw(); return; }
        if (drag && drag.move) { const sp = snapPoint(p, drag.p0), dx = sp[0] - drag.last[0], dy = sp[1] - drag.last[1]; if (dx || dy) { if (!drag.moved) { snapH(); drag.moved = true; } moveSel(dx, dy); drag.last = sp; redraw(); } return; }
        if (A.place) { const sp = snapPoint(p), o = A.placeOff || [0, 0]; A.place.x = sp[0] - o[0]; A.place.y = sp[1] - o[1]; redraw(); return; }
        if (A.draftPts) { const b = A.draftPts[A.draftPts.length - 1], sp = snapPoint(p, b), a = A.draftPts[0];
          if (A.tool === 'line' || A.tool === 'leader') A.draft = [{ t: 'line', a: b, b: sp, L: A.curL }];
          else if (A.tool === 'pl') A.draft = [{ t: 'pl', p: A.draftPts.concat([sp]), closed: false, L: A.curL }];
          else if (A.tool === 'rect') A.draft = [{ t: 'pl', p: [a, [sp[0], a[1]], sp, [a[0], sp[1]]], closed: true, L: A.curL }];
          else if (A.tool === 'circle') A.draft = [{ t: 'circle', c: a, r: Math.hypot(sp[0] - a[0], sp[1] - a[1]), L: A.curL }];
          else if (A.tool === 'dim') A.draft = A.draftPts.length === 1 ? [{ t: 'line', a, b: sp, L: 'S-DIM' }] : [{ t: 'line', a, b: A.draftPts[1], L: 'S-DIM' }, { t: 'line', a: A.draftPts[1], b: sp, L: 'S-DIM' }];
          redraw(); return; }
        if (A.tool !== 'select') { snapPoint(p); redraw(); }
      });
      const up = e => { if (!drag) return; const d = drag; drag = null; if (d.box) { const b = A.box; A.box = null; if (Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) > 1) { const got = boxSelect(b.a, b.b); got.forEach(g => { if (!A.sel.some(s => same(s, g))) A.sel.push(g); }); } redraw(); refreshSide(); } if (d.move && d.moved) { persist(); refreshSide(); } };
      svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', () => { drag = null; A.box = null; });
      if (G.ResizeObserver) new G.ResizeObserver(() => { if (svg.isConnected) redraw(); }).observe($('#tdCanvas'));
    }
    const prompt1 = v => v; // dimension text = measured value (editable afterwards)
    function focusText() { setTimeout(() => { const f = document.querySelector('#tdProps [data-tp="e.s"]'); if (f) { f.focus(); f.select(); } }, 30); }
    function setHint() { const h = $('#tdHint'); if (h) h.textContent = hint(); }
    function setTool(t) { A.tool = t; A.draftPts = null; A.draft = null; A.place = null; ribRefresh(); setHint(); redraw(); }

    // ---------------------------------------------------------------- commands
    function delSel() { if (!A.sel.length) return; snapH(); const sh = SH(); const ei = A.sel.filter(s => s.k === 'e').map(s => s.i).sort((a, b) => b - a), ii = A.sel.filter(s => s.k === 'i').map(s => s.i).sort((a, b) => b - a); ei.forEach(i => sh.ents.splice(i, 1)); ii.forEach(i => sh.items.splice(i, 1)); A.sel = []; persist(); redraw(); refreshSide(); }
    function explodeSel() { const sh = SH(), its = A.sel.filter(s => s.k === 'i').map(s => s.i).sort((a, b) => b - a); if (!its.length) { toast(T('Select a placed detail to explode.', 'เลือกรายละเอียดที่วางไว้เพื่อแยกส่วน'), ''); return; } snapH(); its.forEach(i => { itemEnts(sh.items[i]).forEach(e => sh.ents.push(e)); sh.items.splice(i, 1); }); A.sel = []; persist(); redraw(); refreshSide(); toast(T('Exploded — every line, text and hatch is now editable.', 'แยกส่วนแล้ว — แก้ไขเส้นและข้อความได้ทุกชิ้น'), 'ok'); }
    function copySel() { if (!A.sel.length) return; snapH(); const sh = SH(), out = []; A.sel.forEach(s => { if (s.k === 'i') { const it = JSON.parse(JSON.stringify(sh.items[s.i], (k, x) => (k === '_ents' || k === '_k' ? undefined : x))); it.x += 20; it.y -= 20; sh.items.push(it); out.push({ k: 'i', i: sh.items.length - 1 }); } else { sh.ents.push(transform(sh.ents[s.i], { x: 20, y: -20, s: 1, r: 0 })); out.push({ k: 'e', i: sh.ents.length - 1 }); } }); A.sel = out; persist(); redraw(); refreshSide(); }
    function rotSel() { if (!A.sel.length) return; snapH(); const sh = SH(), E = A.sel.flatMap(s => (s.k === 'i' ? itemEnts(sh.items[s.i]) : [sh.ents[s.i]])), b = bboxOf(E), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      A.sel.forEach(s => { if (s.k === 'i') { const it = sh.items[s.i], dx = it.x - cx, dy = it.y - cy; it.x = cx - dy; it.y = cy + dx; it.r = (it.r || 0) + PI / 2; } else { const e = transform(sh.ents[s.i], { x: -cx, y: -cy, s: 1, r: 0 }); sh.ents[s.i] = transform(e, { x: cx, y: cy, s: 1, r: PI / 2 }); } }); persist(); redraw(); refreshSide(); }
    async function exportPDF() {
      const sh = SH(), [W, H] = SIZES[sh.size] || SIZES.A1, svgS = svgStandalone(A.doc, sh, false).replace(/currentColor/g, '#111');
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        const img = new Image(), url = URL.createObjectURL(new Blob([svgS], { type: 'image/svg+xml' })); await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
        const k = 5, cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(H * k); const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        const pdf = new G.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] }); pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
        saveFile(fname('pdf'), pdf.output('blob'));
      } catch (e) { toast(T('Could not create the PDF here — use Export SVG and print it.', 'สร้าง PDF ไม่ได้ — ใช้ส่งออก SVG แล้วพิมพ์'), 'bad'); }
    }
    const loadScript = src => new Promise((ok, bad) => { if (document.querySelector(`script[src="${src}"]`)) { ok(); return; } const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    const fname = ext => ((SH().title && SH().title.dwg) || 'repair-details').replace(/[^\w\-]+/g, '_') + '_' + (SH().name || 'sheet').replace(/[^\w\-]+/g, '_') + '.' + ext;
    function cmd(c, v) {
      if (c === 'tool') { setTool(v); return; }
      if (c === 'new') { if (!confirm(T('Start a new drawing? The current one is replaced (Undo brings it back).', 'เริ่มแบบใหม่? แบบปัจจุบันจะถูกแทนที่ (ย้อนกลับได้)'))) return; snapH(); A.doc = { sheets: [newSheet()], cur: 0, hidden: {}, layers: {} }; A.sel = []; A.cam = null; persist(); ctx.render(); return; }
      if (c === 'save') { persist(); saveFile(fname('json').replace('.json', '.scdwg.json'), new Blob([JSON.stringify({ app: 'StructCap repair drawing', v: 1, doc: A.doc }, (k, x) => (k === '_ents' || k === '_k' ? undefined : x))], { type: 'application/json' })); return; }
      if (c === 'undo') { undo(false); return; } if (c === 'redo') { undo(true); return; }
      if (c === 'del') { delSel(); return; } if (c === 'explode') { explodeSel(); return; } if (c === 'copy') { copySel(); return; } if (c === 'rot') { rotSel(); return; }
      if (c === 'snap') { A.snap[v] = !A.snap[v]; ribRefresh(); return; }
      if (c === 'size') { snapH(); SH().size = v; A.cam = null; persist(); redraw(); ribRefresh(); return; }
      if (c === 'sheetnew') { snapH(); const t = JSON.parse(JSON.stringify(SH().title || {})); const s = newSheet('Sheet ' + (A.doc.sheets.length + 1)); s.title = Object.assign(t, { sheet: (A.doc.sheets.length + 1) + ' OF ' + (A.doc.sheets.length + 1) }); A.doc.sheets.push(s); A.doc.cur = A.doc.sheets.length - 1; A.sel = []; A.cam = null; persist(); redraw(); refreshSide(); return; }
      if (c === 'libpanel') { const l = $('#tdLib'); if (l) l.scrollIntoView({ behavior: 'smooth' }); return; }
      if (c === 'fit') { A.cam = null; redraw(); return; }
      if (c === 'dxf') { const s = dxf(A.doc, SH()); saveFile(fname('dxf'), new Blob([s], { type: 'application/dxf' })); return; }
      if (c === 'svg') { saveFile(fname('svg'), new Blob([svgStandalone(A.doc, SH(), false).replace(/currentColor/g, '#111')], { type: 'image/svg+xml' })); return; }
      if (c === 'pdf') { exportPDF(); return; }
    }
    // first free spot on a sheet for an item (top-left first, clear of other details and the title block)
    function freeSpot(sh, it) {
      const [W, H] = SIZES[sh.size] || SIZES.A1, lb = bboxOf(itemEnts(Object.assign({}, it, { x: 0, y: 0 }))), w = lb.x1 - lb.x0, h = lb.y1 - lb.y0, pad = 8;
      const used = (sh.items || []).map(o => bboxOf(itemEnts(o))).concat([{ x0: W - 10 - 180 - pad, y0: 0, x1: W, y1: 10 + 70 + 24 }]);
      for (let top = H - 16; top - h >= 14; top -= 6) for (let left = 16; left + w <= W - 16; left += 6) {
        const b = { x0: left - pad, y0: top - h - pad, x1: left + w + pad, y1: top + pad };
        if (!used.some(u => u.x0 < b.x1 && u.x1 > b.x0 && u.y0 < b.y1 && u.y1 > b.y0)) return { x: left - lb.x0, y: top - h - lb.y0 };
      }
      return null;
    }
    function autoPlace(it) { // place on the current sheet, or on new sheets when full
      let sp = freeSpot(SH(), it);
      if (!sp) { const t = JSON.parse(JSON.stringify(SH().title || {})), ns = newSheet('Sheet ' + (A.doc.sheets.length + 1)); ns.size = SH().size; ns.title = t; A.doc.sheets.push(ns); A.doc.cur = A.doc.sheets.length - 1; A.cam = null; sp = freeSpot(SH(), it) || { x: 20, y: 20 }; }
      SH().items.push(Object.assign(it, sp)); }
    function insert(det, params) { const d = D().DEF.find(q => q.id === det); if (!d) return false; const p = {}; d.params.forEach(q => { p[q.k] = params && params[q.k] != null ? params[q.k] : q.v; }); A.place = { det, params: p, x: 300, y: 300, s: 1, r: 0 }; const lb = bboxOf(itemEnts(Object.assign({}, A.place, { x: 0, y: 0 }))); A.placeOff = [(lb.x0 + lb.x1) / 2, (lb.y0 + lb.y1) / 2]; A.tool = 'select'; A.lib = d.cat; return true; }
    function onClick(a, b) {
      if (a === 'td-rb') { cmd(b.dataset.c, b.dataset.v); return true; }
      if (a === 'td-ribtab') { A.rib = b.dataset.t; ribRefresh(); return true; }
      if (a === 'td-cat') { A.lib = b.dataset.v; refreshSide(); return true; }
      if (a === 'td-pick') { insert(b.dataset.v); refreshSide(); setHint(); redraw(); return true; }
      if (a === 'td-sheet') { A.doc.cur = +b.dataset.v; A.sel = []; A.cam = null; persist(); redraw(); refreshSide(); return true; }
      if (a === 'td-curl') { A.curL = b.dataset.v; refreshSide(); return true; }
      return false;
    }
    function onInput(t) {
      if (!t.closest('.td-app')) return false;
      if (t.dataset.tl) { A.doc.hidden = A.doc.hidden || {}; if (t.checked) delete A.doc.hidden[t.dataset.tl]; else A.doc.hidden[t.dataset.tl] = true; persist(); redraw(); return true; }
      const k = t.dataset.tp; if (!k) return true; const sh = SH(), val = t.value, one = A.sel[0];
      if (!A._ts || Date.now() - A._ts > 800) snapH(); A._ts = Date.now();
      if (k === 'name') sh.name = val;
      else if (k.startsWith('t.')) { sh.title = sh.title || {}; sh.title[k.slice(2)] = val; }
      else if (k.startsWith('p.') && one && one.k === 'i') { const it = sh.items[one.i], d = D().DEF.find(q => q.id === it.det), q = d && d.params.find(r => r.k === k.slice(2)); it.params[k.slice(2)] = q && q.num ? +val : val; }
      else if (k === 'it.s' && one) { sh.items[one.i].s = +val || 1; }
      else if (k === 'it.rd' && one) { sh.items[one.i].r = (+val || 0) * PI / 180; }
      else if (k === 'm.L' && val) { A.sel.forEach(s => { if (s.k === 'e') sh.ents[s.i].L = val; }); }
      else if (k.startsWith('e.') && one && one.k === 'e') { const e = sh.ents[one.i], f = k.slice(2); if (f === 'a0') e.a[0] = +val; else if (f === 'a1') e.a[1] = +val; else if (f === 'b0') e.b[0] = +val; else if (f === 'b1') e.b[1] = +val; else if (['h', 'r', 'ang', 'sc'].includes(f)) e[f] = +val; else if (f === 'lt') { if (val) e.lt = val; else delete e.lt; } else e[f] = val; }
      persist(); redraw(); if (t.tagName === 'SELECT' && k !== 'm.L' && !k.startsWith('p.')) refreshSide(); const tb = $('#tdTabs'); if (tb && k === 'name') tb.innerHTML = tabsHTML();
      return true;
    }
    let keys = false;
    function mount() {
      bind(); redraw();
      // queued details from the assessment app
      try { const q = JSON.parse(localStorage.getItem('sc.tdraw.queue') || '[]'); if (q.length) { localStorage.removeItem('sc.tdraw.queue'); snapH(); const br = q.find(r => r.bridge); if (br) { SH().title = SH().title || {}; SH().title.bridge = br.bridge; } let n = 0; q.forEach(r => { const d = D().DEF.find(x => x.id === r.det); if (!d) return; const p = {}; d.params.forEach(x => { p[x.k] = r.params && r.params[x.k] != null ? r.params[x.k] : x.v; }); autoPlace({ det: r.det, params: p, s: 1, r: 0 }); n++; }); A.sel = []; A.cam = null; persist(); redraw(); refreshSide(); setHint(); toast(n + T(' suggested repair details placed — select one to edit its parameters, or Explode it to edit the lines.', ' รายละเอียดซ่อมที่แนะนำถูกวางแล้ว — เลือกเพื่อแก้ไขค่า หรือระเบิดเพื่อแก้ไขเส้น'), 'ok'); } } catch (e) { }
      if (keys) return; keys = true;
      document.addEventListener('keydown', e => {
        if (S.view !== VIEW || !$('#tdSvg')) return; const tg = e.target, typing = tg && /INPUT|SELECT|TEXTAREA/.test(tg.tagName);
        if (typing) { if (e.key === 'Escape') tg.blur(); return; }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(e.shiftKey); return; }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); undo(true); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') { A.clip = A.sel.slice(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') { if (A.clip) { A.sel = A.clip; copySel(); } return; }
        if (e.key === 'Escape') { if (A.place || A.draftPts) { A.place = null; A.draftPts = null; A.draft = null; } else if (A.tool !== 'select') setTool('select'); else A.sel = []; redraw(); refreshSide(); setHint(); return; }
        if (e.key === 'Enter' && A.tool === 'pl') { finishDraft(); return; }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); return; }
        if (e.key === 'F8') { e.preventDefault(); A.snap.ortho = !A.snap.ortho; ribRefresh(); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key.toLowerCase(); const map = { l: 'line', p: 'pl', r: 'rect', c: 'circle', t: 'text', d: 'dim', s: 'select', h: 'hatch' };
        if (map[k]) setTool(map[k]); else if (k === 'e') explodeSel(); else if (k === 'f') { A.cam = null; redraw(); }
        else if (e.key.startsWith('Arrow') && A.sel.length) { e.preventDefault(); const st = e.shiftKey ? 10 : 1; snapH(); moveSel(e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, e.key === 'ArrowUp' ? st : e.key === 'ArrowDown' ? -st : 0); persist(); redraw(); }
      });
      document.addEventListener('change', e => { const t = e.target; if (S.view !== VIEW || !t) return;
        if (t.id === 'td-file') { const fl = t.files[0]; if (!fl) return; fl.text().then(txt => { try { const j = JSON.parse(txt), d = j.doc || j; if (!d.sheets) throw 0; snapH(); A.doc = d; A.sel = []; A.cam = null; persist(); ctx.render(); toast(T('Drawing opened', 'เปิดแบบแล้ว'), 'ok'); } catch (er) { toast(T('That file is not a StructCap drawing.', 'ไฟล์นี้ไม่ใช่แบบ StructCap'), 'bad'); } }); }
        if (t.id === 'td-dxf') { const fl = t.files[0]; if (!fl) return; fl.text().then(txt => { try { const E = parseDXF(txt); if (!E.length) throw 0; const b = bboxOf(E), sh = SH(), [W, H] = SIZES[sh.size] || SIZES.A1, k = min(1, (W - 40) / max(1, b.x1 - b.x0), (H - 120) / max(1, b.y1 - b.y0)); snapH(); E.forEach(e => sh.ents.push(transform(e, { x: 20 - b.x0 * k, y: 100 - b.y0 * k, s: k, r: 0 }))); persist(); redraw(); refreshSide(); toast(T('Imported ', 'นำเข้า ') + E.length + T(' objects from DXF', ' วัตถุจาก DXF') + (k < 1 ? T(' (scaled ', ' (ย่อ ') + k.toFixed(3) + T(' to fit the sheet)', ' ให้พอดีแผ่น)') : ''), 'ok'); } catch (er) { toast(T('Could not read that DXF file.', 'อ่านไฟล์ DXF ไม่ได้'), 'bad'); } }); }
      });
    }
    return { view, mount, onClick, onInput, state: A, insert, dxf: () => dxf(A.doc, SH()) };
  };
  G.TDRAW = { dxf, parseDXF, svgStandalone, svgThumb, allEnts, sheetFrame, hatchLines, SIZES, transform };
})(typeof window !== 'undefined' ? window : globalThis);
