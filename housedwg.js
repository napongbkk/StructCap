/* StructCap House — structural construction drawings (แบบก่อสร้างงานโครงสร้าง, Thai building-permit style).
   Builds a sheet set from the model H and the design D (house.js): general notes + index, foundation plan and footing
   sections, floor framing plans, roof framing plan and truss elevation, column / beam / slab schedules, typical details, stair.
   Everything is drawn in paper millimetres (y up); views carry their own scale (1:50 / 1:100 / 1:20 / 1:25 …).
   Output: SVG per sheet, one DXF R12 (cp874 Thai text, all sheets side by side), PDF (browser: rasterised pages via jsPDF). */
(function (G) {
  'use strict';
  const PI = Math.PI, max = Math.max, min = Math.min, abs = Math.abs, ceil = Math.ceil, floor = Math.floor, round = Math.round, hyp = Math.hypot;
  const X = () => G.HOUSE, BB = () => G.HOUSEBBS;
  const SIZES = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
  const KF = { A4: 0.7, A3: 0.8, A2: 0.9, A1: 1, A0: 1.2 };            // text / symbol size factor per paper
  const DSC = { A4: 25, A3: 20, A2: 20, A1: 20, A0: 10 };               // preferred detail scale
  // layer: [ACI colour, linetype, plotted line weight mm]
  const LAYERS = { 'S-GRID': [8, 'CENTER', 0.13], 'S-COL': [4, 'CONTINUOUS', 0.35], 'S-BEAM': [3, 'CONTINUOUS', 0.35], 'S-SLAB': [5, 'CONTINUOUS', 0.25], 'S-FND': [6, 'CONTINUOUS', 0.35],
    'S-REBAR': [1, 'CONTINUOUS', 0.35], 'S-DIM': [2, 'CONTINUOUS', 0.13], 'S-TEXT': [7, 'CONTINUOUS', 0.18], 'S-HATCH': [9, 'CONTINUOUS', 0.09], 'S-TITLE': [7, 'CONTINUOUS', 0.5], 'S-ROOF': [30, 'CONTINUOUS', 0.25] };
  const LTYPES = { CONTINUOUS: ['Solid line', []], CENTER: ['Center ____ _ ____', [6, -1.5, 1, -1.5]], HIDDEN: ['Hidden _ _ _', [1.8, -1.2]] };
  const FONT = "Tahoma, Loma, 'Noto Sans Thai', sans-serif", FS = 1.4; // font-size = FS × text height (cap height)

  // ------------------------------------------------------------------ formatting
  const f2 = v => (+v).toFixed(2), fm = v => (+v).toFixed(abs((v * 100) % 5) > 1e-6 && abs((v * 100) % 5 - 5) > 1e-6 ? 3 : 2);
  const at = s => '@' + fm(s / 100);                       // spacing cm -> '@0.175'
  const bxh = (b, h) => `${f2(b / 100)}x${f2(h / 100)}`;   // section cm -> '0.20x0.40'
  const sname = n => String(n || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const uniq = L => [...new Set(L)];
  // text width estimate (Thai above/below marks take no advance)
  const COMB = /[ัิ-ฺ็-๎]/;
  function tw(s, h) { let w = 0; for (const ch of String(s)) { if (COMB.test(ch)) continue; w += ch === ' ' ? 0.4 : /[il.,:;|!'()[\]\-]/.test(ch) ? 0.45 : /[A-Z@#%&MW□×]/.test(ch) ? 0.98 : /[฀-๿]/.test(ch) ? 0.9 : /[0-9]/.test(ch) ? 0.8 : 0.68; } return w * h * 1.02; }
  function wrap(s, h, W) {
    const out = []; String(s).split('\n').forEach(par => {
      let cur = ''; par.split(' ').forEach(wd => {
        const t = cur ? cur + ' ' + wd : wd; if (tw(t, h) <= W || !cur) cur = t; else { out.push(cur); cur = wd; }
        while (tw(cur, h) > W && cur.length > 1) { let n = cur.length; while (n > 1 && tw(cur.slice(0, n), h) > W) n--; while (n > 1 && COMB.test(cur[n])) n--; out.push(cur.slice(0, n)); cur = cur.slice(n); }
      }); out.push(cur);
    }); return out;
  }

  // ------------------------------------------------------------------ entities (paper mm, y up)
  const mv = (e, dx, dy) => { const f = q => [q[0] + dx, q[1] + dy], o = Object.assign({}, e); if (e.a) o.a = f(e.a); if (e.b) o.b = f(e.b); if (e.c) o.c = f(e.c); if (e.p) o.p = e.t === 'text' ? f(e.p) : e.p.map(f); return o; };
  function Pen() {
    const E = [], o = { E,
      line(a, b, L, x) { E.push(Object.assign({ t: 'line', a, b, L }, x)); },
      pl(p, L, cl, x) { if (cl && typeof cl === 'object') { x = cl; cl = false; } E.push(Object.assign({ t: 'pl', p, closed: !!cl, L }, x)); },
      rect(x0, y0, w, h, L, x) { o.pl([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], L, 1, x); },
      fill(x0, y0, w, h, L) { E.push({ t: 'solid', p: [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], L }); },
      circ(c, r, L, x) { E.push(Object.assign({ t: 'circle', c, r, L }, x)); },
      dot(c, r, L) { E.push({ t: 'dot', c, r, L: L || 'S-REBAR' }); },
      arc(c, r, a0, a1, L, x) { E.push(Object.assign({ t: 'arc', c, r, a0, a1, L }, x)); },
      solid(p, L) { E.push({ t: 'solid', p, L }); },
      text(p, s, h, x) { if (s === '' || s == null) return; E.push(Object.assign({ t: 'text', p, s: String(s), h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }, x)); },
      add(E2, dx, dy) { E2.forEach(e => E.push(mv(e, dx || 0, dy || 0))); },
      arrow(tip, d, sz, L) { const n = [-d[1], d[0]]; o.solid([tip, [tip[0] - d[0] * sz + n[0] * sz * 0.3, tip[1] - d[1] * sz + n[1] * sz * 0.3], [tip[0] - d[0] * sz - n[0] * sz * 0.3, tip[1] - d[1] * sz - n[1] * sz * 0.3]], L || 'S-DIM'); },
      // aligned dimension between a and b, dimension line offset by off along the left normal of a->b
      dim(a, b, off, txt, k) {
        const L = hyp(b[0] - a[0], b[1] - a[1]) || 1, u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]], sg = off < 0 ? -1 : 1, P = (p, d) => [p[0] + n[0] * d, p[1] + n[1] * d];
        const A = P(a, off), B = P(b, off), tk = 1.1 * k; o.line(P(a, sg * 0.6), P(a, off + sg * 1.2), 'S-DIM'); o.line(P(b, sg * 0.6), P(b, off + sg * 1.2), 'S-DIM'); o.line([A[0] - u[0] * tk, A[1] - u[1] * tk], [B[0] + u[0] * tk, B[1] + u[1] * tk], 'S-DIM');
        [A, B].forEach(q => o.line([q[0] - (u[0] + n[0]) * tk * 0.7, q[1] - (u[1] + n[1]) * tk * 0.7], [q[0] + (u[0] + n[0]) * tk * 0.7, q[1] + (u[1] + n[1]) * tk * 0.7], 'S-DIM', { lw: 0.3 }));
        let ang = Math.atan2(u[1], u[0]) * 180 / PI; if (ang > 90.01 || ang < -89.99) ang += 180;
        const m = [(A[0] + B[0]) / 2 + n[0] * 0.7 * k * (off < 0 ? 1 : 1), (A[1] + B[1]) / 2 + n[1] * 0.7 * k];
        const up = Math.sin((ang + 90) * PI / 180) * n[1] + Math.cos((ang + 90) * PI / 180) * n[0] > 0; // text above the line on the side of n
        o.text(up ? m : [(A[0] + B[0]) / 2 - n[0] * 0.7 * k, (A[1] + B[1]) / 2 - n[1] * 0.7 * k], txt, 2.2 * k, { al: 'c', v: up ? 'b' : 't', ang, L: 'S-DIM' });
      },
      tag(p, q, n, k) { o.line(p, q, 'S-DIM'); o.dot(p, 0.3 * k, 'S-DIM'); o.circ(q, 1.9 * k, 'S-TEXT', { fill: '#fff', lw: 0.25 }); o.text(q, n, 2.3 * k, { al: 'c', v: 'm' }); },
      // leader from p to a text at q (text left of q when q is left of p)
      lead(p, q, s, h, x) { const left = q[0] < p[0]; o.dot(p, 0.35 * h / 2.5, 'S-DIM'); o.line(p, q, 'S-DIM'); o.line(q, [q[0] + (left ? -1.5 : 1.5), q[1]], 'S-DIM'); o.text([q[0] + (left ? -2.2 : 2.2), q[1]], s, h, Object.assign({ al: left ? 'r' : 'l', v: 'm' }, x)); }
    };
    return o;
  }
  // segments of a-b outside a circle (c, r)
  function clipCircle(a, b, c, r) {
    const d = [b[0] - a[0], b[1] - a[1]], f = [a[0] - c[0], a[1] - c[1]], A = d[0] * d[0] + d[1] * d[1], B = 2 * (f[0] * d[0] + f[1] * d[1]), C = f[0] * f[0] + f[1] * f[1] - r * r, disc = B * B - 4 * A * C;
    if (!c || disc <= 0) return [[a, b]]; const t1 = (-B - Math.sqrt(disc)) / (2 * A), t2 = (-B + Math.sqrt(disc)) / (2 * A), P = t => [a[0] + d[0] * t, a[1] + d[1] * t], out = [];
    if (t1 > 0) out.push([a, P(min(1, t1))]); if (t2 < 1) out.push([P(max(0, t2)), b]); return t1 >= 1 || t2 <= 0 ? [[a, b]] : out;
  }
  function hatch45(P, x0, y0, x1, y1, sp, hole) {
    for (let d = x0 - y1 + sp / 2; d < x1 - y0; d += sp) { const xa = max(x0, y0 + d), xb = min(x1, y1 + d); if (xb - xa < 0.05) continue; clipCircle([xa, xa - d], [xb, xb - d], hole && hole.c, hole ? hole.r : 0).forEach(([a, b]) => P.line(a, b, 'S-HATCH')); }
  }
  function earth(P, x0, x1, y, k) { P.line([x0, y], [x1, y], 'S-FND', { lw: 0.25 }); for (let x = x0 + 1.5 * k; x < x1 - 0.5; x += 2.2 * k) P.line([x, y], [x - 1.2 * k, y - 1.2 * k], 'S-HATCH'); }
  function bubble(P, c, r, s) { P.circ(c, r, 'S-GRID', { lt: 'CONTINUOUS', lw: 0.25 }); P.text(c, s, r * 0.85, { al: 'c', v: 'm', L: 'S-GRID' }); }
  function breakLine(P, a, b, k) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L = hyp(b[0] - a[0], b[1] - a[1]) || 1, u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]], z = 1.2 * k;
    P.pl([a, [m[0] - u[0] * z, m[1] - u[1] * z], [m[0] - u[0] * z * 0.4 + n[0] * z * 1.4, m[1] - u[1] * z * 0.4 + n[1] * z * 1.4], [m[0] + u[0] * z * 0.4 - n[0] * z * 1.4, m[1] + u[1] * z * 0.4 - n[1] * z * 1.4], [m[0] + u[0] * z, m[1] + u[1] * z], b], 'S-DIM'); }

  // ------------------------------------------------------------------ views: {w, h, E, title, scale, sub, grp}; caption is drawn under the view by the packer
  const view = (P, w, h, title, scale, sub) => ({ w, h, E: P.E, title, scale, sub });
  function bbox(E) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = q => { x0 = min(x0, q[0]); y0 = min(y0, q[1]); x1 = max(x1, q[0]); y1 = max(y1, q[1]); };
    E.forEach(e => { if (e.t === 'line') { add(e.a); add(e.b); } else if (e.t === 'pl' || e.t === 'solid') e.p.forEach(add); else if (e.c) { add([e.c[0] - e.r, e.c[1] - e.r]); add([e.c[0] + e.r, e.c[1] + e.r]); }
      else if (e.t === 'text') { const w = tw(e.s, e.h), dx = e.al === 'c' ? -w / 2 : e.al === 'r' ? -w : 0, dy = e.v === 'm' ? -e.h / 2 : e.v === 't' ? -e.h : 0, a = (e.ang || 0) * PI / 180, cs = Math.cos(a), sn = Math.sin(a);
        [[dx, dy - e.h * 0.35], [dx + w, dy - e.h * 0.35], [dx, dy + e.h * 1.35], [dx + w, dy + e.h * 1.35]].forEach(([u, v]) => add([e.p[0] + u * cs - v * sn, e.p[1] + u * sn + v * cs])); } });
    return { x0, y0, x1, y1 };
  }
  function viewAuto(P, title, scale, sub, pad) { const b = bbox(P.E), d = pad == null ? 1 : pad; return { w: b.x1 - b.x0 + 2 * d, h: b.y1 - b.y0 + 2 * d, E: P.E.map(e => mv(e, d - b.x0, d - b.y0)), title, scale, sub }; }
  const capH = (c, v) => (v.title ? 2 + c.TL + (v.scale ? 1.6 + c.TS : 0) + (v.sub ? v.sub.length * c.TS * 1.65 : 0) + 2.5 : 0);
  const capW = (c, v) => (v.title ? max(tw(v.title, c.TL), ...(v.sub || []).map(s => tw(s, c.TS))) + 2 : 0);
  function fitScale(c, list, make) { // largest drawing among the scales that fits the drawing area
    let last = null; for (const sc of list) { const v = make(sc); if (!v) return null; last = v; if (max(v.w, capW(c, v)) <= c.aw && v.h + capH(c, v) <= c.ah) return v; } return last;
  }
  const PLAN_SC = [50, 75, 100, 150, 200, 250, 300, 400, 500], DET_SC = [10, 20, 25, 30, 40, 50, 75, 100];
  const detList = c => DET_SC.filter(s => s >= c.ds);

  // ------------------------------------------------------------------ plans (foundation / floor / roof)
  function planView(c, st, kind, sc) {
    const { H, D, k, TS, TM } = c, HX = X(), g = H.grid, ki = HX.stIdx(H, st.id), s = 1000 / sc, P = Pen();
    const X0 = min(...g.x), X1 = max(...g.x), Y0 = min(...g.y), Y1 = max(...g.y), rg = kind === 'roof' && D.roof ? D.roof.g : null;
    let ext = 0.25; if (kind === 'fnd') D.fnds.forEach(f => { if (f.B) ext = max(ext, max(f.B, f.L) / 2 + 0.1); }); if (rg) ext = max(ext, rg.ov + 0.1);
    const R = 3 * k, dr = 6 * k, mg = ext * s + 2 * dr + 2 * R + TS + 4, Wv = (X1 - X0) * s + 2 * mg, Hv = (Y1 - Y0) * s + 2 * mg;
    const PX = x => mg + (x - X0) * s, PY = y => mg + (y - Y0) * s;
    // grid and bubbles
    g.x.forEach((x, i) => { const xx = PX(x); P.line([xx, 2 * R + 1], [xx, Hv - 2 * R - 1], 'S-GRID'); bubble(P, [xx, R + 1], R, g.xn[i] || i + 1); bubble(P, [xx, Hv - R - 1], R, g.xn[i] || i + 1); });
    g.y.forEach((y, j) => { const yy = PY(y); P.line([2 * R + 1, yy], [Wv - 2 * R - 1, yy], 'S-GRID'); bubble(P, [R + 1, yy], R, g.yn[j] || String.fromCharCode(65 + j)); bubble(P, [Wv - R - 1, yy], R, g.yn[j] || String.fromCharCode(65 + j)); });
    // dimensions (bottom and left): spans and overall
    const xs = g.x.slice().sort((a, b) => a - b), ys = g.y.slice().sort((a, b) => a - b), yb = PY(Y0) - ext * s - 0.5, xl = PX(X0) - ext * s - 0.5;
    for (let i = 0; i + 1 < xs.length; i++) P.dim([PX(xs[i]), yb], [PX(xs[i + 1]), yb], -(dr - 0.5), f2(xs[i + 1] - xs[i]), k);
    for (let j = 0; j + 1 < ys.length; j++) P.dim([xl, PY(ys[j])], [xl, PY(ys[j + 1])], dr - 0.5, f2(ys[j + 1] - ys[j]), k);
    if (xs.length > 2) P.dim([PX(X0), yb], [PX(X1), yb], -(2 * dr - 0.5), f2(X1 - X0), k);
    if (ys.length > 2) P.dim([xl, PY(Y0)], [xl, PY(Y1)], 2 * dr - 0.5, f2(Y1 - Y0), k);
    // columns present at this level
    const cols = H.columns.filter(cl => HX.stIdx(H, cl.top) >= ki), colAt = (i, j) => cols.find(q => q.i === i && q.j === j);
    cols.forEach(cl => {
      const sec = HX.secOf(H, cl.sec), w = sec.b / 100 * s, h = sec.h / 100 * s, cx = PX(g.x[cl.i]), cy = PY(g.y[cl.j]);
      P.fill(cx - w / 2, cy - h / 2, w, h, 'S-COL'); P.rect(cx - w / 2, cy - h / 2, w, h, 'S-COL');
      const seg = kind === 'fnd' ? 0 : HX.stIdx(H, cl.top) > ki ? ki + 1 : ki, d = D.cols.find(q => q.id === cl.id && q.seg === seg);
      if (d && d.mark) P.text([cx - max(w / 2, 0.12 * s) - 0.5, cy + max(h / 2, 0.12 * s) + 0.5], d.mark, TS * 0.85, { al: 'r', L: 'S-COL' });
    });
    // footings and piles (below: hidden)
    if (kind === 'fnd') D.fnds.forEach(f => {
      if (!f.B) return; const cx = PX(g.x[f.i]), cy = PY(g.y[f.j]), B = f.B * s, L = f.L * s;
      P.rect(cx - B / 2, cy - L / 2, B, L, 'S-FND', { lt: 'HIDDEN' }); P.text([cx + B / 2 + 0.5, cy + L / 2 + 0.5], f.mark, TS, { L: 'S-FND' });
      (f.pts || []).forEach(([u, v]) => { const d = (+H.soil.pile.D || 18) / 100 * s, px = cx + u * s, py = cy + v * s; P.rect(px - d / 2, py - d / 2, d, d, 'S-FND', { lt: 'HIDDEN', lw: 0.18 }); P.line([px - d / 2, py - d / 2], [px + d / 2, py + d / 2], 'S-FND', { lw: 0.13 }); P.line([px - d / 2, py + d / 2], [px + d / 2, py - d / 2], 'S-FND', { lw: 0.13 }); });
    });
    // beams on this storey
    H.beams.filter(b => b.st === st.id).forEach(b => {
      const sec = HX.secOf(H, b.sec), w = sec.b / 100 * s, dirX = b.a[1] === b.b[1], [p, q] = (dirX ? b.a[0] < b.b[0] : b.a[1] < b.b[1]) ? [b.a, b.b] : [b.b, b.a];
      const hc = (n, dx) => { const cl = colAt(n[0], n[1]); return cl ? HX.secOf(H, cl.sec)[dx ? 'b' : 'h'] / 200 * s : 0; }, o = kind === 'fnd' ? {} : { lt: 'HIDDEN' };
      const d = D.beams.find(x => x.id === b.id), mk = (d && d.mark) || b.sec;
      if (dirX) { const xa = PX(g.x[p[0]]) + hc(p, 1), xb = PX(g.x[q[0]]) - hc(q, 1), y = PY(g.y[p[1]]); P.line([xa, y - w / 2], [xb, y - w / 2], 'S-BEAM', o); P.line([xa, y + w / 2], [xb, y + w / 2], 'S-BEAM', o); P.text([(xa + xb) / 2, y + w / 2 + 0.6], mk, TS, { al: 'c', L: 'S-BEAM' }); }
      else { const ya = PY(g.y[p[1]]) + hc(p, 0), yb2 = PY(g.y[q[1]]) - hc(q, 0), x = PX(g.x[p[0]]); P.line([x - w / 2, ya], [x - w / 2, yb2], 'S-BEAM', o); P.line([x + w / 2, ya], [x + w / 2, yb2], 'S-BEAM', o); P.text([x - w / 2 - 0.6, (ya + yb2) / 2], mk, TS, { al: 'c', ang: 90, L: 'S-BEAM' }); }
    });
    const sub = [];
    if (kind === 'floor') {
      const S = HX.stories(H), starts = H.stairs.filter(t => t.st === st.id), opens = H.stairs.filter(t => HX.stIdx(H, t.st) === ki - 1);
      const bay = (i, j) => ({ x0: PX(g.x[i]), x1: PX(g.x[i + 1]), y0: PY(g.y[j]), y1: PY(g.y[j + 1]) });
      H.slabs.filter(sl => sl.st === st.id).forEach(sl => {
        const d = D.slabs.find(x => x.id === sl.id), r = bay(sl.i, sl.j), cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, mk = (d && d.mark) || sl.id, rr = max(tw(mk, TM) / 2 + 1, TM * 0.85);
        const stairHere = starts.some(t => t.i === sl.i && t.j === sl.j), mc = stairHere ? [r.x0 + (r.x1 - r.x0) * 0.22, r.y0 + (r.y1 - r.y0) * 0.22] : [cx, cy], ins = 0.12 * s;
        if (sl.ground && !stairHere) hatch45(P, r.x0 + ins, r.y0 + ins, r.x1 - ins, r.y1 - ins, 2.2 * k, { c: mc, r: rr + 0.6 });
        P.circ(mc, rr, 'S-SLAB', { lw: 0.25, fill: '#fff' }); P.text(mc, mk, TM, { al: 'c', v: 'm', L: 'S-SLAB' });
        const way = d && d.g ? d.g.way : 'two', ax = 0.36 * (r.x1 - r.x0), ay = 0.36 * (r.y1 - r.y0), A = (a, b, dd) => { P.line(a, b, 'S-SLAB', { lw: 0.18 }); P.arrow(b, dd, 1.6 * k, 'S-SLAB'); };
        if (!sl.ground && !stairHere) {
          if (way === 'two' || way === 'x') { A([cx - rr - 0.8, cy], [cx - ax, cy], [-1, 0]); A([cx + rr + 0.8, cy], [cx + ax, cy], [1, 0]); }
          if (way === 'two' || way === 'y') { A([cx, cy - rr - 0.8], [cx, cy - ay], [0, -1]); A([cx, cy + rr + 0.8], [cx, cy + ay], [0, 1]); }
        }
      });
      starts.forEach(t => { // treads seen on the start level, arrow up
        const sd = D.stairs.find(x => x.id === t.id), r = bay(t.i, t.j), n = sd ? sd.nr - 1 : 10, mk = (sd && sd.mark) || t.id, dx = t.dir === 'x';
        for (let q = 1; q < n; q++) { if (dx) { const x = r.x0 + (r.x1 - r.x0) * q / n; P.line([x, r.y0 + 0.15 * s], [x, r.y1 - 0.15 * s], 'S-SLAB', { lw: 0.13 }); } else { const y = r.y0 + (r.y1 - r.y0) * q / n; P.line([r.x0 + 0.15 * s, y], [r.x1 - 0.15 * s, y], 'S-SLAB', { lw: 0.13 }); } }
        const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2; if (dx) { P.line([r.x0 + 1, cy], [r.x1 - 1.5, cy], 'S-SLAB', { lw: 0.25 }); P.arrow([r.x1 - 1, cy], [1, 0], 2 * k, 'S-SLAB'); P.text([cx, cy + 1], mk + ' ขึ้น', TS, { al: 'c', L: 'S-SLAB', fill: '#fff' }); }
        else { P.line([cx, r.y0 + 1], [cx, r.y1 - 1.5], 'S-SLAB', { lw: 0.25 }); P.arrow([cx, r.y1 - 1], [0, 1], 2 * k, 'S-SLAB'); P.text([cx - 1, cy], mk + ' ขึ้น', TS, { al: 'c', ang: 90, L: 'S-SLAB' }); }
      });
      opens.forEach(t => { // stair opening on the level above
        const sd = D.stairs.find(x => x.id === t.id), r = bay(t.i, t.j), ins = 0.12 * s, cc = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], s1 = 'ช่องบันได ' + ((sd && sd.mark) || t.id), rad = tw(s1, TS) / 2 + 1.2;
        [[[r.x0 + ins, r.y0 + ins], [r.x1 - ins, r.y1 - ins]], [[r.x0 + ins, r.y1 - ins], [r.x1 - ins, r.y0 + ins]]].forEach(([a, b]) => clipCircle(a, b, cc, rad).forEach(([p, q]) => P.line(p, q, 'S-SLAB', { lw: 0.18 })));
        P.text(cc, s1, TS, { al: 'c', v: 'm', L: 'S-SLAB' });
      });
      if (H.slabs.some(sl => sl.st === st.id && sl.ground)) sub.push('พื้นแรเงา = พื้นวางบนดิน (SG)');
      sub.push('ลูกศรแสดงทิศทางการถ่ายน้ำหนักของพื้น · เส้นประ = คานใต้พื้น · เครื่องหมายเสา = เสาเหนือระดับนี้');
    }
    if (kind === 'roof' && rg) {
      const Rr = D.roof, ov = rg.ov, x0 = PX(rg.x0 - ov), x1 = PX(rg.x1 + ov), y0 = PY(rg.y0 - ov), y1 = PY(rg.y1 + ov), dx = rg.dir === 'x', pp = (Rr.psp || 1) * Math.cos(rg.th) * s;
      P.rect(x0, y0, x1 - x0, y1 - y0, 'S-ROOF', { lw: 0.5 });
      const nT = max(2, Rr.nTruss || 2), mid = dx ? (y0 + y1) / 2 : (x0 + x1) / 2;
      for (let q = 0; q < nT; q++) { if (dx) { const x = PX(rg.x0 + q * (rg.x1 - rg.x0) / (nT - 1)); P.line([x, y0], [x, y1], 'S-ROOF', { lw: 0.45 }); if (q === 1) P.text([x + 0.8, y0 + 1.5], 'T1', TS, { L: 'S-ROOF' }); } else { const y = PY(rg.y0 + q * (rg.y1 - rg.y0) / (nT - 1)); P.line([x0, y], [x1, y], 'S-ROOF', { lw: 0.45 }); if (q === 1) P.text([x0 + 1.5, y + 0.8], 'T1', TS, { L: 'S-ROOF' }); } }
      const pl = { lw: 0.13 };
      if (rg.type === 'hip') {
        const hs = min(x1 - x0, y1 - y0) / 2;
        for (let d = pp; d < hs - 0.3; d += pp) P.rect(x0 + d, y0 + d, x1 - x0 - 2 * d, y1 - y0 - 2 * d, 'S-ROOF', pl);
        const a = [x0 + hs, y0 + hs], b = [x1 - hs, y1 - hs]; P.line(a, b, 'S-ROOF', { lw: 0.5 }); [[x0, y0, a], [x0, y1, [a[0], b[1]]], [x1, y0, [b[0], a[1]]], [x1, y1, b]].forEach(([x, y, e]) => P.line([x, y], e, 'S-ROOF', { lw: 0.5 }));
      } else if (rg.type === 'shed') {
        for (let d = pp; d < (dx ? y1 - y0 : x1 - x0) - 0.3; d += pp) { if (dx) P.line([x0, y0 + d], [x1, y0 + d], 'S-ROOF', pl); else P.line([x0 + d, y0], [x0 + d, y1], 'S-ROOF', pl); }
        if (dx) P.text([(x0 + x1) / 2, y1 + 0.8], 'ด้านสูง', TS, { al: 'c', L: 'S-ROOF' }); else P.text([x1 + 0.8, (y0 + y1) / 2], 'ด้านสูง', TS, { al: 'c', ang: -90, L: 'S-ROOF' });
      } else {
        const half = (dx ? y1 - y0 : x1 - x0) / 2;
        for (let d = pp; d < half - 0.3; d += pp) { if (dx) { P.line([x0, y0 + d], [x1, y0 + d], 'S-ROOF', pl); P.line([x0, y1 - d], [x1, y1 - d], 'S-ROOF', pl); } else { P.line([x0 + d, y0], [x0 + d, y1], 'S-ROOF', pl); P.line([x1 - d, y0], [x1 - d, y1], 'S-ROOF', pl); } }
        if (dx) P.line([x0, mid], [x1, mid], 'S-ROOF', { lw: 0.5 }); else P.line([mid, y0], [mid, y1], 'S-ROOF', { lw: 0.5 });
      }
      const cover = (X().ROOFS[H.roof.cover] || X().ROOFS.tile)[0];
      sub.push(`โครงถัก T1 ระยะห่าง @${f2((rg.len) / (nT - 1))} ม. จำนวน ${nT} ชุด · แป ${Rr.purlin ? 'C' + Rr.purlin.name : '-'} @${f2(Rr.psp || 1)} ม. (ตามแนวลาด)`);
      sub.push(`หลังคา${{ gable: 'จั่ว', hip: 'ปั้นหยา', shed: 'เพิงแหงน' }[rg.type] || ''} ${cover} ความชัน ${round(rg.th * 180 / PI)}° ชายคายื่น ${f2(ov)} ม. · เส้นประ = คานรับโครงหลังคา`);
    }
    const S0 = HX.stories(H), title = kind === 'fnd' ? (H.soil.type === 'pile' ? 'แปลนฐานรากและเสาเข็ม' : 'แปลนฐานราก') : kind === 'roof' ? 'แปลนโครงหลังคา' : 'แปลนโครงสร้าง ' + (ki === 0 ? 'คานคอดินและพื้น' : '') + sname(st.name) + (ki === S0.length - 1 && ki > 0 ? ' (หลังคา คสล.)' : '');
    if (kind === 'fnd') sub.push('เส้นประ = ฐานราก' + (H.soil.type === 'pile' ? ' / เสาเข็ม' : '') + ' · ระดับหลังฐานราก ' + f2(-(+H.soil.Df || 1.5)) + ' ม. (ท้องฐาน) จากระดับคานคอดิน');
    return view(P, Wv, Hv, title, '1:' + sc, sub);
  }

  // ------------------------------------------------------------------ tables (cells: string | string[] | {w,h,E} sketch); split to fit the height
  function tables(c, o) {
    const { k, TS } = c, pad = 1.4 * k, lh = TS * 1.65, lines = v => (v == null ? [''] : Array.isArray(v) ? v.map(String) : String(v).split('\n'));
    const size = v => (v && v.E ? [v.w, v.h] : (L => [max(0, ...L.map(s => tw(s, TS))), L.length * lh - (lh - TS)])(lines(v)));
    const cw = o.cols.map((h, i) => max(size(h)[0], ...o.rows.map(r => size(r[i])[0])) + 2 * pad);
    const hh = max(...o.cols.map(h => size(h)[1])) + 2 * pad, rh = o.rows.map(r => max(TS, ...r.map(v => size(v)[1])) + 2 * pad), Wt = cw.reduce((a, b) => a + b, 0);
    const cell = (P, v, x, y, w, h) => { // y = top
      if (v && v.E) { P.add(v.E, x + (w - v.w) / 2, y - h + (h - v.h) / 2); return; }
      const L = lines(v), bh = L.length * lh - (lh - TS); L.forEach((s, i) => P.text([x + w / 2, y - (h - bh) / 2 - TS - i * lh], s, TS, { al: 'c' }));
    };
    const maxH = c.ah - capH(c, { title: o.title, scale: o.scale, sub: o.sub }) - 1, out = []; let i = 0;
    while (i < o.rows.length || (!o.rows.length && !out.length)) {
      let hsum = hh, j = i; while (j < o.rows.length && (hsum + rh[j] <= maxH || j === i)) { hsum += rh[j]; j++; }
      const P = Pen(); let y = hsum, x = 0;
      o.cols.forEach((h, q) => { cell(P, h, x, y, cw[q], hh); x += cw[q]; }); y -= hh; P.line([0, y], [Wt, y], 'S-TEXT', { lw: 0.35 });
      for (let r = i; r < j; r++) { x = 0; o.rows[r].forEach((v, q) => { cell(P, v, x, y, cw[q], rh[r]); x += cw[q]; }); y -= rh[r]; if (r + 1 < j) P.line([0, y], [Wt, y], 'S-TEXT', { lw: 0.18 }); }
      x = 0; cw.slice(0, -1).forEach(w => { x += w; P.line([x, 0], [x, hsum], 'S-TEXT', { lw: 0.18 }); }); P.rect(0, 0, Wt, hsum, 'S-TEXT', { lw: 0.35 });
      out.push(view(P, Wt, hsum, o.title + (i > 0 ? ' (ต่อ)' : ''), o.scale, j >= o.rows.length ? o.sub : null)); i = j; if (!o.rows.length) break;
    }
    return out;
  }

  // ------------------------------------------------------------------ section sketches (q = paper mm per cm)
  function colSketch(c, d, q) {
    const P = Pen(), cov = c.H.mat.cover.col, W = d.b * q, H = d.h * q, td = X().barD(d.tie) / 10, db = X().barD(d.bar) / 10, ci = (cov) * q;
    P.rect(0, 0, W, H, 'S-COL'); P.rect(ci, ci, W - 2 * ci, H - 2 * ci, 'S-REBAR', { lw: 0.25 });
    P.line([ci, H - ci - 0.2], [ci + 1.6 * c.k, H - ci - 1.6 * c.k], 'S-REBAR', { lw: 0.25 }); P.line([ci + 0.2, H - ci], [ci + 1.6 * c.k, H - ci - 1.4 * c.k], 'S-REBAR', { lw: 0.25 });
    BB().perimeterPts(d.n, d.b - 2 * (cov + td) - db, d.h - 2 * (cov + td) - db).forEach(([u, v]) => P.dot([W / 2 + u * q, H / 2 + v * q], max(0.38 * c.k, db / 2 * q)));
    return { w: W, h: H, E: P.E };
  }
  function beamSketch(c, d, q) {
    const P = Pen(), cov = c.H.mat.cover.beam, W = d.b * q, H = d.h * q, sd = X().barD(d.shear.bar) / 10, ci = cov * q, slab = 0;
    P.rect(0, 0, W, H, 'S-BEAM'); P.rect(ci, ci, W - 2 * ci, H - 2 * ci, 'S-REBAR', { lw: 0.25 }); void slab;
    P.line([ci, H - ci - 0.2], [ci + 1.6 * c.k, H - ci - 1.6 * c.k], 'S-REBAR', { lw: 0.25 });
    const row = (r, top) => { const db = X().barD(r.bar) / 10, n1 = r.layers > 1 ? ceil(r.n / 2) : r.n, rows = r.layers > 1 ? [n1, r.n - n1] : [n1];
      rows.forEach((n, L) => { const y = top ? H - (cov + sd + db / 2) * q - L * (2.5 + db) * q : (cov + sd + db / 2) * q + L * (2.5 + db) * q, x0 = (cov + sd + db / 2) * q, x1 = W - x0;
        for (let i = 0; i < n; i++) P.dot([n > 1 ? x0 + (x1 - x0) * i / (n - 1) : W / 2, y], max(0.38 * c.k, db / 2 * q)); }); };
    row(d.top, true); row(d.bot, false); return { w: W, h: H, E: P.E };
  }

  // ------------------------------------------------------------------ footing section (one per mark)
  function fndView(c, f, sc, typ) {
    const { H, D, k, TS } = c, HX = X(), q = 10 / sc, P = Pen(), M = H.mat, cv = M.cover.fnd, Df = (+H.soil.Df || 1.5) * 100, t = f.t, B = f.B * 100, S = HX.stories(H);
    const col = H.columns.find(x => x.id === f.id), cs = HX.secOf(H, col.sec), ped = D.cols.find(x => x.id === f.id && x.seg === 0) || {}, cb = cs.b;
    const gbs = H.beams.filter(b => b.st === S[0].id && ((b.a[0] === col.i && b.a[1] === col.j) || (b.b[0] === col.i && b.b[1] === col.j))), gbh = gbs.length ? max(...gbs.map(b => HX.secOf(H, b.sec).h)) : 40;
    const pile = H.soil.type === 'pile' && f.np, pd = pile ? (+H.soil.pile.D || 18) : 0, pL = pile ? 110 : 0, zb = -Df, zt = zb + t, xe = B / 2 + 12;
    const ox = xe * q + 14 * k, oy = (Df + 10 + pL) * q + 10 * k, Z = (x, z) => [ox + x * q, oy + z * q];
    // concrete outlines
    const R = (x0, z0, x1, z1, L, o) => P.rect(Z(x0, z0)[0], Z(x0, z0)[1], (x1 - x0) * q, (z1 - z0) * q, L, o);
    R(-B / 2 - 5, zb - 10, B / 2 + 5, zb - 5, 'S-FND', { lw: 0.18 }); R(-B / 2 - 5, zb - 5, B / 2 + 5, zb, 'S-FND', { lw: 0.18 });
    for (let x = -B / 2 - 3; x < B / 2 + 4; x += 4 / q * k) P.dot(Z(x, zb - 7.5), 0.18 * k, 'S-HATCH');
    R(-B / 2, zb, B / 2, zt, 'S-FND'); R(-cb / 2, zt, cb / 2, -gbh, 'S-COL'); R(-cb / 2, 0, cb / 2, 30, 'S-COL');
    P.line(Z(-xe, 0), Z(xe, 0), 'S-BEAM'); P.line(Z(-xe, -gbh), Z(-cb / 2, -gbh), 'S-BEAM'); P.line(Z(cb / 2, -gbh), Z(xe, -gbh), 'S-BEAM');
    breakLine(P, Z(-xe, -gbh - 4), Z(-xe, 4), k); breakLine(P, Z(xe, -gbh - 4), Z(xe, 4), k); breakLine(P, Z(-cb / 2 - 4, 30), Z(cb / 2 + 4, 30), k);
    earth(P, Z(-xe - 8, 0)[0], Z(-cb / 2, 0)[0] - 0.01, Z(0, -gbh)[1], k); earth(P, Z(cb / 2, 0)[0] + 0.01, Z(xe + 8, 0)[0], Z(0, -gbh)[1], k);
    if (pile) uniq(f.pts.map(p => round(p[0] * 100))).forEach(px => { R(px - pd / 2, zb - 10 - pL, px + pd / 2, zb - 10, 'S-FND', { lw: 0.25 }); breakLine(P, Z(px - pd / 2 - 4, zb - 10 - pL), Z(px + pd / 2 + 4, zb - 10 - pL), k); });
    // reinforcement
    const dbx = HX.barD(f.fx.bar) / 10, dby = HX.barD(f.fy.bar) / 10, hk = min(12 * dbx, t - 2 * cv), zr = zb + cv + dbx / 2;
    P.pl([Z(-B / 2 + cv, zr + hk), Z(-B / 2 + cv, zr), Z(B / 2 - cv, zr), Z(B / 2 - cv, zr + hk)], 'S-REBAR', { lw: 0.4 });
    for (let i = 0; i < f.fy.n; i++) P.dot(Z(-B / 2 + cv + dby / 2 + (B - 2 * cv - dby) * i / max(1, f.fy.n - 1), zr + dbx / 2 + dby / 2), max(0.35 * k, dby / 2 * q));
    if (ped.bar) {
      const db = HX.barD(ped.bar) / 10, xc = cb / 2 - M.cover.col - 0.6 - db / 2, z0 = zr + dbx / 2 + db / 2 + dby, h2 = 12 * db;
      [-1, 1].forEach(sg => P.pl([Z(sg * (xc + h2), z0), Z(sg * xc, z0), Z(sg * xc, 28)], 'S-REBAR', { lw: 0.4 }));
      for (let z = zt + 5; z < -gbh - 2; z += ped.s) P.line(Z(-xc - 0.6, z), Z(xc + 0.6, z), 'S-REBAR', { lw: 0.25 });
    }
    // labels (right) with leaders, spread vertically
    const lx = Z(xe, 0)[0] + 6 * k, lab = [];
    if (ped.mark) lab.push([Z(cb / 2, (zt - gbh) / 2), typ ? 'ตอม่อ (ขนาดและเหล็กเสริมตามตารางเสาและตอม่อ)' : `ตอม่อ ${ped.mark} ${bxh(cs.b, cs.h)} ม. ${ped.n}-${ped.bar} ปลอก ${ped.tie}${at(ped.s)}`]);
    lab.push([Z(B / 2 - cv - 2, zr), typ ? 'เหล็กล่างขนานแกน X (ตามตาราง) งอฉาก 90°' : `เหล็กล่าง ${f.fx.n}-${f.fx.bar} (ขนานแกน X) งอฉาก 90°`]);
    lab.push([Z(B / 4, zr + dbx / 2 + dby / 2), typ ? 'เหล็กล่างขนานแกน Y (ตามตาราง)' : `เหล็กล่าง ${f.fy.n}-${f.fy.bar} (ขนานแกน Y)`]);
    lab.push([Z(B / 2 + 3, zb - 2.5), 'คอนกรีตหยาบ หนา 5 ซม.']); lab.push([Z(B / 2 + 3, zb - 7.5), 'ทรายหยาบบดอัดแน่น หนา 5 ซม.']);
    if (pile) lab.push([Z(f.pts.reduce((a, p) => max(a, p[0] * 100), -1e9) + pd / 2, zb - 10 - pL / 2), `${H.soil.pile.name} ${typ ? '(จำนวนตามตาราง)' : f.np + ' ต้น'} รับน้ำหนักปลอดภัย ${H.soil.pile.cap} ตัน/ต้น`]);
    let yPrev = 1e9; lab.sort((a, b) => b[0][1] - a[0][1]).forEach(([p, s]) => { const y = min(p[1], yPrev - TS * 1.9); yPrev = y; P.lead(p, [lx, y], s, TS); });
    P.text([Z(-xe - 8, 0)[0] - 1, Z(0, -gbh)[1] + 0.8], 'ระดับดินเดิม', TS * 0.9, { al: 'r' }); P.text([Z(xe, 0)[0] + 1.5, Z(0, 0)[1] + 0.8], '±0.00 หลังคานคอดิน', TS * 0.9);
    // dimensions
    const zd = zb - 10 - pL; P.dim(Z(-B / 2, zd - 1), Z(B / 2, zd - 1), -5 * k, typ ? 'B' : f2(B / 100), k);
    P.dim(Z(-xe, zb), Z(-xe, zt), 6 * k, typ ? 't' : f2(t / 100), k); P.dim(Z(-xe, zb), Z(-xe, 0), 11 * k, f2(Df / 100), k);
    if (typ) return viewAuto(P, 'รูปตัดฐานรากทั่วไป ' + typ, '1:' + sc, ['ขนาด BxLxt และเหล็กเสริมของแต่ละฐานตามตารางฐานราก']);
    return viewAuto(P, 'รูปตัดฐานราก ' + f.mark, '1:' + sc, [`ขนาด ${f2(f.B)}x${f2(f.L)}x${f2(f.t / 100)} ม. · จำนวน ${c.D.fnds.filter(x => x.mark === f.mark).length} ฐาน`]);
  }

  // ------------------------------------------------------------------ truss elevation
  function trussView(c, sc) {
    const { D, k, TS } = c, R = D.roof, g = R.g, tg = (R.truss && R.truss.geom) || X().trussGeom(g), s = 1000 / sc, P = Pen(), tn = Math.tan(g.th), ov = g.ov;
    const zlo = -ov * tn, zhi = g.type === 'shed' ? g.rise + ov * tn : g.rise, ox = 16 * k + ov * s, oz = 16 * k - zlo * s, T = (x, z) => [ox + x * s, oz + z * s];
    const kinds = ['tc', 'bc', 'vt', 'dg'], tag = {}; kinds.forEach((kd, i) => { tag[kd] = i + 1; });
    tg.mem.forEach(([kd, a, b]) => P.line(T(...tg.nodes[a]), T(...tg.nodes[b]), 'S-ROOF', { lw: kd === 'tc' || kd === 'bc' ? 0.5 : 0.3 }));
    P.line(T(0, 0), T(-ov, -ov * tn), 'S-ROOF', { lw: 0.5 }); if (g.type === 'shed') P.line(T(g.span, g.rise), T(g.span + ov, g.rise + ov * tn), 'S-ROOF', { lw: 0.5 }); else P.line(T(g.span, 0), T(g.span + ov, -ov * tn), 'S-ROOF', { lw: 0.5 });
    tg.sup.forEach(n => { const p = T(...tg.nodes[n]); P.solid([p, [p[0] - 1.6 * k, p[1] - 2.4 * k], [p[0] + 1.6 * k, p[1] - 2.4 * k]], 'S-ROOF'); P.rect(p[0] - 1.5 * k, p[1] - 2.4 * k - 4 * k, 3 * k, 4 * k, 'S-BEAM', { lw: 0.25 }); });
    kinds.forEach(kd => { // tag the member of each group nearest a quarter of the span
      const ms = tg.mem.filter(m => m[0] === kd); if (!ms.length) return; const tx = g.span * (kd === 'vt' ? 0.38 : kd === 'dg' ? 0.3 : 0.22);
      const m = ms.reduce((a, b) => (abs((tg.nodes[b[1]][0] + tg.nodes[b[2]][0]) / 2 - tx) < abs((tg.nodes[a[1]][0] + tg.nodes[a[2]][0]) / 2 - tx) ? b : a));
      const p = T((tg.nodes[m[1]][0] + tg.nodes[m[2]][0]) / 2, (tg.nodes[m[1]][1] + tg.nodes[m[2]][1]) / 2), off = kd === 'bc' ? [0, -4.5 * k] : kd === 'tc' ? [-2.5 * k, 3.5 * k] : [3.2 * k, 0];
      const cc = [p[0] + off[0], p[1] + off[1]]; P.line(p, cc, 'S-DIM'); P.circ(cc, 2.4 * k, 'S-TEXT', { fill: '#fff' }); P.text(cc, tag[kd], TS * 1.1, { al: 'c', v: 'm' });
    });
    const yb = T(0, zlo)[1] - 7 * k; P.dim([T(0, 0)[0], yb + 2], [T(g.span, 0)[0], yb + 2], -2, f2(g.span), k); P.dim([T(-ov, 0)[0], yb + 2], [T(0, 0)[0], yb + 2], -2, f2(ov), k);
    const xr = T(g.span + ov, 0)[0] + 4 * k, hi = g.type === 'shed' ? g.span : g.span / 2; P.dim([xr, T(0, 0)[1]], [xr, T(hi, g.rise)[1]], -4 * k, f2(g.rise), k); P.line(T(hi, g.rise), [xr, T(hi, g.rise)[1]], 'S-DIM', { lw: 0.1 });
    return viewAuto(P, 'รูปด้านโครงถักหลังคา T1', '1:' + sc, [`ช่วงพาด ${f2(g.span)} ม. ความชัน ${round(g.th * 180 / PI)}° · หมายเลขในวงกลม = กลุ่มชิ้นส่วนตามตาราง`]);
  }
  function trussTable(c) {
    const R = c.D.roof, nm = { tc: 'จันทัน (Top chord)', bc: 'ขื่อ (Bottom chord)', vt: 'ค้ำยันแนวดิ่ง (Vertical)', dg: 'ค้ำยันทแยง (Diagonal)' }, rows = [];
    ['tc', 'bc', 'vt', 'dg'].forEach((kd, i) => { const gr = R.truss && R.truss.groups.find(x => x.kind === kd); rows.push([i + 1, nm[kd], gr && gr.sec ? gr.sec.p.name + ' มม.' : 'ไม่มีผลออกแบบ', gr ? f2(gr.L) : '-']); });
    rows.push(['-', 'แป (Purlin)', R.purlin ? 'C' + R.purlin.name + ' มม.' : '-', '@' + f2(R.psp || 1)]);
    return tables(c, { title: 'ตารางขนาดชิ้นส่วนโครงหลังคา', cols: ['กลุ่ม', 'ชิ้นส่วน', 'หน้าตัดเหล็ก', 'ยาวสูงสุด (ม.)'], rows, sub: [`เหล็กรูปพรรณขึ้นรูปเย็น Fy = ${c.H.mat.Fy} กก./ตร.ซม. รอยต่อเชื่อมรอบ`, 'ยึดโครงถักกับคานด้วยเพลทและพุก/เหล็กเสียบ 2-DB12'] });
  }

  // ------------------------------------------------------------------ stair section
  function stairView(c, t, sd, sc) {
    const { H, D, k, TS } = c, HX = X(), s = 1000 / sc, P = Pen(), S = HX.stories(H), ki = HX.stIdx(H, t.st), i = t.i, j = t.j;
    const lower = t.dir === 'x' ? HX.beamOn(H, t.st, [i, j], [i, j + 1]) : HX.beamOn(H, t.st, [i, j], [i + 1, j]), upper = ki + 1 < S.length ? (t.dir === 'x' ? HX.beamOn(H, S[ki + 1].id, [i + 1, j], [i + 1, j + 1]) : HX.beamOn(H, S[ki + 1].id, [i, j + 1], [i + 1, j + 1])) : null;
    const bsec = b => (b ? HX.secOf(H, b.sec) : { b: 20, h: 40 }), bl = bsec(lower), bu = bsec(upper), mk = b => { const d = b && D.beams.find(x => x.id === b.id); return d ? d.mark : ''; };
    const Lh = sd.Lh, hg = sd.hgt, R = sd.R, Tr = sd.Tr, tn = R / Tr, cs = Math.cos(Math.atan(tn)), tw0 = sd.t / 100, cov = H.mat.cover.slab / 100;
    const ox = 14 * k + 1.0 * s, oz = 10 * k + 0.5 * s, T = (x, z) => [ox + x * s, oz + z * s], zs = x => x * tn + R - tw0 / cs;
    const pr = [T(-1.0, 0), T(0, 0)]; let x = 0, z = 0; for (let r = 0; r < sd.nr; r++) { z += R; pr.push(T(x, z)); if (r < sd.nr - 1) { x += Tr; pr.push(T(x, z)); } } pr.push(T(Lh + 1.0, hg));
    P.pl(pr, 'S-SLAB', { lw: 0.4 });
    const xa = bl.b / 200, xb = Lh - bu.b / 200; P.pl([T(xa, 0), T(xa, zs(xa)), T(xb, zs(xb))], 'S-SLAB', { lw: 0.4 });
    P.rect(...T(-bl.b / 200, -bl.h / 100), bl.b / 100 * s, bl.h / 100 * s, 'S-BEAM'); P.rect(...T(Lh - bu.b / 200, hg - bu.h / 100), bu.b / 100 * s, bu.h / 100 * s, 'S-BEAM');
    P.line(T(-1.0, -0.12), T(-bl.b / 200, -0.12), 'S-SLAB'); P.line(T(Lh + bu.b / 200, hg - 0.12), T(Lh + 1.0, hg - 0.12), 'S-SLAB');
    breakLine(P, T(-1.0, -0.2), T(-1.0, 0.08), k); breakLine(P, T(Lh + 1.0, hg - 0.2), T(Lh + 1.0, hg + 0.08), k);
    // bars: main along the soffit, distribution dots, top bars at both supports
    const zm = x => zs(x) + (cov + 0.006) / cs, x0 = -bl.b / 200 + 0.04, x1 = Lh + bu.b / 200 - 0.04;
    P.pl([T(x0, -0.04 - bl.h / 100 * 0.3), T(x0, zm(x0)), T(x1, zm(x1)), T(x1, hg - 0.04)], 'S-REBAR', { lw: 0.4 });
    const ds = sd.dist.s / 100 * cs; for (let xx = xa + ds / 2; xx < xb; xx += ds) P.dot(T(xx, zm(xx) + 0.012), max(0.3 * k, 0.005 * s));
    const zc = x => x * tn - (cov + 0.006) / cs, Lt = 1.0 * cs;
    P.pl([T(-bl.b / 200 + 0.05, -bl.h / 100 * 0.5), T(-bl.b / 200 + 0.05, zc(0)), T(Lt, zc(Lt)), T(Lt, zc(Lt) - 0.06)], 'S-REBAR', { lw: 0.4 });
    P.pl([T(Lh - Lt, zc(Lh - Lt) - 0.06), T(Lh - Lt, zc(Lh - Lt)), T(Lh, hg - 0.04), T(Lh + 0.6, hg - 0.04)], 'S-REBAR', { lw: 0.4 });
    // labels and dimensions
    const mk2 = sd.mark || t.id, lx = T(Lh + 1.0, 0)[0] + 4 * k, lab = [
      [T(Lh * 0.62, zm(Lh * 0.62)), `เหล็กหลัก ${sd.main.bar}${at(sd.main.s)}`], [T(Lh * 0.5 + ds / 2, zm(Lh * 0.5) + 0.012), `เหล็กกันร้าว ${sd.dist.bar}${at(sd.dist.s)}`],
      [T(Lh - Lt * 0.5, zc(Lh - Lt * 0.5)), `เหล็กบน ${sd.main.bar}${at(sd.main.s)} ยาว 1.00 ม. (ที่ปลายทั้งสอง)`], [T(xb, hg - bu.h / 200), `คาน ${mk(upper)} ${bxh(bu.b, bu.h)}`],
      [T(Lh * 0.3, zs(Lh * 0.3)), `ท้องบันไดหนา ${f2(tw0)} ม.`], [T(xa, -bl.h / 200), `คาน ${mk(lower)} ${bxh(bl.b, bl.h)}`]];
    let yPrev = 1e9; lab.sort((a, b) => b[0][1] - a[0][1]).forEach(([p, s2]) => { const y = min(p[1], yPrev - TS * 1.9); yPrev = y; P.lead(p, [lx, y], s2, TS); });
    P.dim(T(0, -bl.h / 100), T(Lh, -bl.h / 100), -6 * k, f2(Lh), k); P.dim(T(-1.0, 0), T(-1.0, hg), 6 * k, f2(hg), k);
    return viewAuto(P, 'รูปตัดบันได ' + mk2, '1:' + sc, [`ลูกตั้ง ${sd.nr} ขั้น สูง ${fm(sd.R)} ม. · ลูกนอน ${fm(sd.Tr)} ม. · กว้าง ${f2(sd.W)} ม. · น้ำหนักจร 300 กก./ตร.ม.`]);
  }

  // ------------------------------------------------------------------ typical details (not to scale, sized by the paper factor)
  function beamTyp(c) {
    const { k, TS, H } = c, P = Pen(), cw = 7 * k, L = 72 * k, bh = 16 * k, y0 = 14 * k, cv = 1.8 * k, x = i => 4 * k + i * (cw + L), Lt = 2 * (cw + L) + cw, lp = 14 * k, hk = 5 * k;
    for (let i = 0; i < 3; i++) P.rect(x(i), y0 - 10 * k, cw, bh + 20 * k, 'S-COL');
    P.line([x(0), y0], [x(0) + Lt, y0], 'S-BEAM'); P.line([x(0), y0 + bh], [x(0) + Lt, y0 + bh], 'S-BEAM');
    const yt = y0 + bh - cv, yb = y0 + cv, xs = x(0) + cv, xe = x(0) + Lt - cv, m1 = x(0) + cw + L / 2, m2 = x(1) + cw + L / 2, sup = x(1) + cw / 2, o = { lw: 0.45 };
    P.pl([[xs, yt - hk], [xs, yt], [m1 + lp / 2, yt]], 'S-REBAR', o); P.line([m1 - lp / 2, yt - 0.8 * k], [m2 + lp / 2, yt - 0.8 * k], 'S-REBAR', o); P.pl([[m2 - lp / 2, yt], [xe, yt], [xe, yt - hk]], 'S-REBAR', o);
    P.pl([[xs, yb + hk], [xs, yb], [sup + lp / 2, yb]], 'S-REBAR', o); P.pl([[sup - lp / 2, yb + 0.8 * k], [xe, yb + 0.8 * k], [xe, yb + hk]], 'S-REBAR', o);
    for (let i = 0; i < 2; i++) for (let xx = x(i) + cw + 1.6 * k; xx < x(i + 1) - 1; xx += 3.6 * k) P.line([xx, yb - 0.6], [xx, yt + 0.6], 'S-REBAR', { lw: 0.18 });
    P.dim([x(0) + cw, y0 + bh + 10 * k], [x(1), y0 + bh + 10 * k], 3 * k, 'L (ช่วงคาน)', k);
    [0, 1, 2].forEach(q => P.dim([x(1) + cw + q * L / 3, y0 - 10 * k], [x(1) + cw + (q + 1) * L / 3, y0 - 10 * k], -3 * k, 'L/3', k));
    const tg = [[[xs, yt - hk / 2], [x(0) + cw + 5 * k, y0 + bh + 5 * k], 'งอฉาก 90° ยาว 12db ยึดในเสาริม'], [[m1, yt], [m1 + 10 * k, y0 + bh + 5 * k], `ต่อทาบเหล็กบนบริเวณกลางช่วง L/3 ยาว ${H.mat.lapDB}db`],
      [[sup + lp / 2 - 1, yb], [sup + 12 * k, y0 - 5 * k], `ต่อทาบเหล็กล่างที่ฐานรองรับ ยาว ${H.mat.lapDB}db`], [[x(0) + cw + 1.6 * k, y0 + bh * 0.4], [x(0) + cw + 8 * k, y0 - 5 * k], 'ปลอกตัวแรกห่างผิวเสา 5 ซม. ระยะเรียงตามตารางคาน']]; tg.forEach(([a, b], i) => P.tag(a, b, i + 1, k));
    return viewAuto(P, 'รายละเอียดการเสริมเหล็กคานทั่วไป', 'ไม่ตามมาตราส่วน', tg.map((t, i) => `(${i + 1}) ${t[2]}`).concat([`ระยะทาบ เหล็กข้ออ้อย ${H.mat.lapDB}db · เหล็กกลม ${H.mat.lapRB}db · ห้ามต่อทาบเกิน 50% ของเหล็กในหน้าตัดเดียวกัน`]));
  }
  function slabTyp(c) {
    const { k, TS, H } = c, P = Pen(), L = 64 * k, bw = 7 * k, bh = 13 * k, t = 5 * k, y0 = 16 * k, x = i => 4 * k + i * (L + bw), Lt = 2 * (L + bw) + bw, cv = 1.1 * k, o = { lw: 0.45 };
    P.line([x(0), y0 + t], [x(0) + Lt, y0 + t], 'S-SLAB'); P.line([x(0) + bw, y0], [x(1), y0], 'S-SLAB'); P.line([x(1) + bw, y0], [x(2), y0], 'S-SLAB');
    for (let i = 0; i < 3; i++) P.pl([[x(i), y0 + t], [x(i), y0 - bh], [x(i) + bw, y0 - bh], [x(i) + bw, y0 + t]], 'S-BEAM');
    P.line([x(0) + cv, y0 + cv], [x(0) + Lt - cv, y0 + cv], 'S-REBAR', o); for (let xx = x(0) + bw + 2 * k; xx < x(2); xx += 3.5 * k) if (xx < x(1) - 0.5 || xx > x(1) + bw + 0.5) P.dot([xx, y0 + cv + 0.9 * k], 0.35 * k);
    const yt = y0 + t - cv, l4 = L / 4; P.pl([[x(0) + cv, yt - 2.5 * k], [x(0) + cv, yt], [x(0) + bw + l4, yt], [x(0) + bw + l4, yt - 1.5 * k]], 'S-REBAR', o);
    P.pl([[x(1) - l4, yt - 1.5 * k], [x(1) - l4, yt], [x(1) + bw + l4, yt], [x(1) + bw + l4, yt - 1.5 * k]], 'S-REBAR', o); P.pl([[x(2) - l4, yt - 1.5 * k], [x(2) - l4, yt], [x(2) + bw - cv, yt], [x(2) + bw - cv, yt - 2.5 * k]], 'S-REBAR', o);
    P.dim([x(1) - l4, y0 + t + 4 * k], [x(1), y0 + t + 4 * k], 2 * k, 'L/4', k); P.dim([x(1) + bw, y0 + t + 4 * k], [x(1) + bw + l4, y0 + t + 4 * k], 2 * k, 'L/4', k); P.dim([x(0) + bw, y0 - bh - 2 * k], [x(1), y0 - bh - 2 * k], -3 * k, 'L (ช่วงสั้น)', k);
    const tg = [[[x(0) + cv, yt - 1.5 * k], [x(0) + bw + 4 * k, y0 + t + 5 * k], 'เหล็กบนที่ขอบนอก งอฉากลงยึดในคาน'], [[x(0) + bw + l4 * 0.5, yt], [x(0) + bw + l4 + 6 * k, y0 + t + 5 * k], 'เหล็กบน (ตามตารางพื้น) ยาว L/4 จากขอบคาน งอฉากลงที่ปลาย'],
      [[x(1) + bw + L * 0.55, y0 + cv], [x(1) + bw + L * 0.6, y0 - 6 * k], 'เหล็กล่าง (ตามตารางพื้น) ฝังในคาน ≥ 15 ซม.'], [[x(0) + bw + 2 * k + 3.5 * k * 5, y0 + cv + 0.9 * k], [x(0) + bw + 26 * k, y0 - 6 * k], 'เหล็กล่างอีกทาง']]; tg.forEach(([a, b], i) => P.tag(a, b, i + 1, k));

    return viewAuto(P, 'รายละเอียดการเสริมเหล็กพื้นทั่วไป', 'ไม่ตามมาตราส่วน', tg.map((q, i) => `(${i + 1}) ${q[2]}`).concat([`ระยะหุ้มพื้น ${H.mat.cover.slab} ซม. · L = ช่วงสั้น · พื้นสองทาง: เหล็กช่วงสั้นอยู่ล่างสุด`]));
  }
  function sgTyp(c) {
    const { k, TS, H, D } = c, P = Pen(), t = 5 * k, y0 = 12 * k, W = 110 * k, bw = 7 * k, bh = 14 * k, sg = D.slabs.find(s => s.ground), r = sg && sg.rows[0];
    P.rect(4 * k, y0 + t - bh, bw, bh, 'S-BEAM'); P.rect(4 * k + bw + 0.8 * k, y0, W - bw, t, 'S-SLAB'); P.rect(4 * k + bw + 0.8 * k, y0 - 2 * k, W - bw, 2 * k, 'S-HATCH', { lw: 0.13 });
    for (let xx = 4 * k + bw + 2 * k; xx < W; xx += 1.6 * k) P.dot([xx + ((xx * 7) % 3) * 0.2, y0 - 1 * k + ((xx * 13) % 3 - 1) * 0.4 * k], 0.15 * k, 'S-HATCH');
    earth(P, 4 * k + bw, 4 * k + W + 0.8 * k, y0 - 2 * k, k);
    P.line([4 * k + bw + 1.6 * k, y0 + t * 0.6], [4 * k + W, y0 + t * 0.6], 'S-REBAR', { lw: 0.45 }); for (let xx = 4 * k + bw + 3 * k; xx < W; xx += 4 * k) P.dot([xx, y0 + t * 0.6 - 0.8 * k], 0.35 * k);
    const tg = [[[4 * k + bw + 0.4 * k, y0 + t / 2], [4 * k + bw + 6 * k, y0 + t + 5 * k], 'รอยต่อแยกพื้นกับคาน (แผ่นโฟม / ยางมะตอย)'], [[4 * k + W * 0.5, y0 + t * 0.6], [4 * k + W * 0.55, y0 + t + 5 * k], r ? `เหล็กตะแกรง ${r.bar}${at(r.s)} ทั้งสองทาง` : 'เหล็กตะแกรงตามตารางพื้น'],
      [[4 * k + W * 0.8, y0 - k], [4 * k + W * 0.75, y0 - 7 * k], 'ทรายหยาบบดอัดแน่น หนา 5 ซม. บนดินถมบดอัดแน่น']]; tg.forEach(([a, b], i) => P.tag(a, b, i + 1, k));

    return viewAuto(P, 'รายละเอียดพื้นวางบนดิน (SG)', 'ไม่ตามมาตราส่วน', tg.map((q, i) => `(${i + 1}) ${q[2]}`).concat(sg ? [`พื้น ${sg.mark} หนา ${f2(sg.t / 100)} ม. · ปูแผ่นพลาสติกกันความชื้นก่อนเทคอนกรีต`] : []));
  }
  function hookTyp(c) {
    const { k, TS } = c, P = Pen(), o = { lw: 0.5 }, y = 18 * k;
    const items = [['ขอฉาก 90° (DB) ยื่น 12db', 26 * k, x => { P.pl([[x, y], [x + 22 * k, y], [x + 22 * k, y + 9 * k]], 'S-REBAR', o); P.text([x + 20.5 * k, y + 4.5 * k], '12db', TS * 0.9, { al: 'r', v: 'm' }); }],
      ['ขอครึ่งวงกลม 180° (RB) 4db ≥ 6.5 ซม.', 26 * k, x => { P.line([x, y], [x + 20 * k, y], 'S-REBAR', o); P.arc([x + 20 * k, y + 2.5 * k], 2.5 * k, -90, 90, 'S-REBAR', o); P.line([x + 20 * k, y + 5 * k], [x + 13 * k, y + 5 * k], 'S-REBAR', o); }],
      ['ปลอกงอ 135° ยื่น 6db ≥ 7.5 ซม.', 16 * k, x => { P.rect(x, y - 1 * k, 14 * k, 13 * k, 'S-REBAR', o); P.line([x + 0.4, y + 12 * k - 0.4], [x + 5 * k, y + 7.5 * k], 'S-REBAR', o); P.line([x + 0.4, y + 12 * k - 0.6], [x + 4.6 * k, y + 7 * k], 'S-REBAR', o); }]];
    let x = 0; items.forEach(([lab, wd, draw]) => { const W = max(wd, tw(lab, TS)); draw(x + (W - wd) / 2); P.text([x + W / 2, y - 6 * k], lab, TS, { al: 'c' }); x += W + 6 * k; });
    return viewAuto(P, 'รายละเอียดการงอขอเหล็ก', 'ไม่ตามมาตราส่วน', null);
  }

  // ------------------------------------------------------------------ general notes (flowed into columns) + sheet index
  function notes(c) {
    const { H, D } = c, M = H.mat, cv = M.cover, So = H.soil, HX = X(), L = [], h = s => L.push(['h', s]), p = s => L.push(['p', s]);
    const grade = fy => (fy >= 5000 ? 'SD50' : fy >= 4000 ? 'SD40' : fy >= 3000 ? 'SD30' : 'SR24');
    h('1. ข้อกำหนดทั่วไป');
    p('1.1 ออกแบบตามพระราชบัญญัติควบคุมอาคาร พ.ศ. 2522 และกฎกระทรวงฉบับที่ 6 (พ.ศ. 2527) มาตรฐานอาคารคอนกรีตเสริมเหล็กโดยวิธีกำลัง ว.ส.ท. 1008-38 (ACI 318-99) และมาตรฐานอาคารเหล็กรูปพรรณ ว.ส.ท. (วิธีหน่วยแรงใช้งาน)');
    p('1.2 มิติในแบบมีหน่วยเป็นเมตร (ม.) ระยะหุ้มคอนกรีตเป็นเซนติเมตร (ซม.) หน้าตัดเหล็กเป็นมิลลิเมตร (มม.) เว้นแต่ระบุเป็นอย่างอื่น ห้ามวัดขนาดจากแบบ');
    p('1.3 หากแบบโครงสร้างขัดแย้งกับแบบสถาปัตยกรรมหรือสภาพหน้างาน ให้แจ้งวิศวกรผู้ออกแบบก่อนดำเนินการ การเปลี่ยนแปลงใด ๆ ต้องได้รับอนุมัติเป็นลายลักษณ์อักษร');
    h('2. วัสดุ');
    p(`2.1 คอนกรีตโครงสร้าง กำลังอัดประลัยทรงกระบอกมาตรฐาน 15x30 ซม. อายุ 28 วัน f'c ไม่น้อยกว่า ${M.fc} กก./ตร.ซม. ใช้ปูนซีเมนต์ปอร์ตแลนด์ประเภท 1 ค่ายุบตัว 7.5-12.5 ซม.`);
    p('2.2 คอนกรีตหยาบ (Lean concrete) ส่วนผสม 1:3:5 หนา 5 ซม. รองใต้ฐานรากทุกฐาน บนทรายหยาบบดอัดแน่น หนา 5 ซม.');
    p(`2.3 เหล็กเสริมข้ออ้อย ${grade(M.fy)} (มอก. 24) fy = ${M.fy} กก./ตร.ซม. เหล็กเสริมกลม SR24 (มอก. 20) fy = ${M.fys} กก./ตร.ซม. DB = เหล็กข้ออ้อย RB = เหล็กกลม`);
    if (D.roof) p(`2.4 เหล็กรูปพรรณโครงหลังคา Fy = ${M.Fy} กก./ตร.ซม. เชื่อมด้วยลวดเชื่อม E60XX ขาเชื่อมไม่น้อยกว่าความหนาชิ้นส่วนที่บางกว่า ทาสีกันสนิม 2 ชั้นและสีทับหน้า`);
    h('3. ระยะหุ้มคอนกรีต (วัดถึงผิวเหล็กปลอก)');
    p(`ฐานราก ${cv.fnd} ซม. · ตอม่อและเสา ${cv.col} ซม. · คาน ${cv.beam} ซม. · พื้นและบันได ${cv.slab} ซม.`);
    h('4. การต่อทาบ การงอ และการวางเหล็ก');
    p(`4.1 ระยะทาบเหล็กข้ออ้อย ${M.lapDB} เท่าของเส้นผ่านศูนย์กลาง (${M.lapDB}db) เหล็กกลม ${M.lapRB}db และต้องมีขอ ห้ามต่อทาบเกิน 50% ของเหล็กในหน้าตัดเดียวกัน`);
    p('4.2 คาน: ต่อทาบเหล็กบนบริเวณกลางช่วง L/3 ต่อทาบเหล็กล่างบริเวณฐานรองรับ เสา: ต่อทาบเหนือระดับพื้นแต่ละชั้น');
    p('4.3 ขอฉาก 90° ยื่น 12db ขอครึ่งวงกลม 180° (RB) 4db ไม่น้อยกว่า 6.5 ซม. ปลอกและเหล็กลูกตั้งงอ 135° ยื่น 6db ไม่น้อยกว่า 7.5 ซม.');
    p('4.4 ระยะห่างช่องว่างระหว่างเหล็กไม่น้อยกว่า 2.5 ซม. หรือ db ใช้ลูกปูนหนุนเหล็กให้ได้ระยะหุ้ม');
    h('5. ฐานราก');
    if (So.type === 'pile') p(`5.1 ใช้${So.pile.name} รับน้ำหนักปลอดภัยไม่น้อยกว่า ${So.pile.cap} ตัน/ต้น ผู้รับจ้างต้องทดสอบการรับน้ำหนัก (Dynamic / Static load test) หรือบันทึกการตอก (Blow count) ให้วิศวกรตรวจ`);
    else p(`5.1 ฐานรากแผ่วางบนดินเดิม ความสามารถรับน้ำหนักบรรทุกปลอดภัยของดินไม่น้อยกว่า ${So.qa} ตัน/ตร.ม. ที่ระดับ -${f2(+So.Df || 1.5)} ม. หากดินไม่ได้ตามกำหนดให้แจ้งวิศวกร`);
    p(`5.2 ระดับท้องฐานราก -${f2(+So.Df || 1.5)} ม. จากระดับหลังคานคอดิน (±0.00) เว้นแต่ระบุเป็นอย่างอื่น ขุดดินและบดอัดก้นหลุมให้แน่นก่อนเทคอนกรีตหยาบ`);
    h('6. น้ำหนักบรรทุกที่ใช้ออกแบบ');
    const uses = uniq(H.slabs.filter(s => !s.ground).map(s => s.use || 'res')).map(u => HX.LL[u] || HX.LL.res);
    uses.forEach(u => p(`น้ำหนักจร ${u[0]} ${u[1]} กก./ตร.ม.`)); if (H.stairs.length) p(`น้ำหนักจร บันได ${HX.LL.stair[1]} กก./ตร.ม.`);
    p(`น้ำหนักบรรทุกคงที่เพิ่มเติม (พื้นผิว / ฝ้า / งานระบบ) ${H.loads.sdl} กก./ตร.ม. คอนกรีตเสริมเหล็ก ${M.ws} กก./ลบ.ม.`);
    uniq(H.walls.map(w => w.type)).forEach(t => { const w = HX.WALLS[t]; if (w) p(`${w[0]} ${w[1]} กก./ตร.ม.`); });
    if (D.roof) p(`หลังคา ${(HX.ROOFS[H.roof.cover] || HX.ROOFS.tile)[0]} · น้ำหนักจรหลังคา ${H.roof.ll} กก./ตร.ม. · ฝ้าเพดาน ${H.roof.ceil} กก./ตร.ม.`);
    if (H.loads.wind && H.loads.wind.on) p(`แรงลม ${H.loads.wind.q} กก./ตร.ม.`);
    p('การรวมน้ำหนัก U = 1.4D + 1.7L' + (H.loads.wind && H.loads.wind.on ? ', 0.75(1.4D + 1.7L ± 1.7W), 0.9D ± 1.3W' : ''));
    h('7. งานคอนกรีต');
    p('7.1 ถอดแบบข้างคาน เสา และฐานรากได้หลัง 2 วัน ท้องพื้นและท้องคานไม่น้อยกว่า 14 วัน หรือเมื่อคอนกรีตได้กำลัง 70% ค้ำยันกลับทันทีหลังถอดแบบ');
    p('7.2 บ่มคอนกรีตให้ชื้นอย่างต่อเนื่องไม่น้อยกว่า 7 วัน เขย่าคอนกรีตด้วยเครื่องสั่นทุกครั้ง หยุดเทคอนกรีตคานและพื้นที่ช่วง L/3 กลางช่วง');
    p('7.3 ฝังเหล็กหนวดกุ้ง RB6 @0.40 ม. ยาว 0.30 ม. ในเสาสำหรับยึดผนัง ทำเสาเอ็นและทับหลังทุกช่องเปิด');
    return L;
  }
  function notesViews(c) {
    const { k, TS, TM } = c, colW = min(c.aw, max(92, 120 * k)), lh = TS * 1.6, items = notes(c), lines = [];
    items.forEach(([t, s]) => { if (t === 'h') { lines.push(['g', TS * 0.6]); lines.push(['h', s, TM]); } else wrap(s, TS, colW - 4 * k).forEach((q, i) => lines.push(['p', q, TS, i ? 4 * k : 0])); });
    const out = []; let P = Pen(), y = 0, first = true;
    const tot = lines.reduce((a, [t, s2, h]) => a + (t === 'g' ? s2 : t === 'h' ? TM * 1.8 : lh), 0) + capH(c, { title: 'x' }), ncol = max(1, floor((c.aw + 7 * k) / (colW + 7 * k)) - 1);
    const H0 = min(c.ah - 2, max(tot / ncol * 1.04 + TM * 2, 40)), flush = () => { const E = P.E.map(e => mv(e, 0, -y)); const vv = { w: colW, h: -y, E, title: first ? 'รายการประกอบแบบโครงสร้าง' : null }; vv.h = max(vv.h, 1); out.push(vv); first = false; P = Pen(); y = 0; };
    lines.forEach(([t, s, h, ind]) => {
      const dy = t === 'g' ? s : t === 'h' ? TM * 1.8 : lh, limit = (first ? H0 - capH(c, { title: 'x' }) : H0);
      if (-y + dy > limit) flush(); if (t === 'g') { if (y) y -= dy; return; }
      y -= dy; P.text([ind || 0, y + (dy - h) * 0.3], s, h, { L: t === 'h' ? 'S-TITLE' : 'S-TEXT' });
    });
    if (P.E.length) flush();
    return out;
  }

  // ------------------------------------------------------------------ schedules
  function colSchedule(c) {
    const { H, D } = c, HX = X(), S = HX.stories(H), q = 10 / c.ds, rows = [], marks = uniq(D.cols.filter(d => d.bar).map(d => d.mark));
    const where = seg => (seg === 0 ? 'ตอม่อ (ฐานราก-คานคอดิน)' : `เสา${sname(S[seg - 1].name)}-${sname(S[seg].name)}`);
    marks.forEach(m => { const L = D.cols.filter(d => d.mark === m), d = L[0]; rows.push([m, colSketch(c, d, q), bxh(d.b, d.h), `${d.n}-${d.bar}`, `${d.tie}${at(d.s)}`, uniq(L.map(x => where(x.seg))), L.length]); });
    return tables(c, { title: 'ตารางเสาและตอม่อ', scale: '1:' + c.ds, cols: ['เครื่องหมาย', 'รูปตัด', 'ขนาด (ม.)', 'เหล็กยืน', 'เหล็กปลอก', 'ตำแหน่ง', 'จำนวน'], rows, sub: [`ระยะหุ้ม ${H.mat.cover.col} ซม. · ต่อทาบเหล็กยืนเหนือพื้นแต่ละชั้น ${H.mat.lapDB}db · ปลอกช่วงต่อคานเสาให้เรียงต่อเนื่อง`] });
  }
  function beamSchedule(c) {
    const { H, D } = c, HX = X(), S = HX.stories(H), q = 10 / c.ds, rows = [], marks = uniq(D.beams.filter(d => d.top).map(d => d.mark));
    marks.forEach(m => { const L = D.beams.filter(d => d.mark === m), d = L[0], sk = beamSketch(c, d, q);
      rows.push([m, bxh(d.b, d.h), sk, sk, `${d.top.n}-${d.top.bar}`, `${d.bot.n}-${d.bot.bar}`, `${d.shear.bar}${at(d.shear.s)}`, uniq(L.map(x => sname((S.find(s => s.id === x.st) || {}).name))).join(', '), L.length]); });
    return tables(c, { title: 'ตารางคาน', scale: '1:' + c.ds, cols: ['คาน', 'ขนาด bxh (ม.)', 'รูปตัดที่\nฐานรองรับ', 'รูปตัด\nกลางช่วง', 'เหล็กบน', 'เหล็กล่าง', 'เหล็กปลอก', 'ชั้น', 'จำนวนช่วง'], rows, sub: [`เหล็กบนและล่างวางตลอดความยาวคาน ยึดปลายในเสาริมด้วยขอฉาก 12db · ระยะหุ้ม ${H.mat.cover.beam} ซม.`] });
  }
  function slabSchedule(c) {
    const { H, D } = c, HX = X(), S = HX.stories(H), rows = [], marks = uniq(D.slabs.filter(d => d.rows.length).map(d => d.mark)), tmp = H.mat.fy >= 3000 ? 'DB10' : 'RB9';
    marks.forEach(m => {
      const L = D.slabs.filter(d => d.mark === m), d = L[0], R = d.rows, st = uniq(L.map(x => sname((S.find(s => s.id === (H.slabs.find(z => z.id === x.id) || {}).st) || {}).name))).join(', ');
      let type, a, b, top;
      if (d.ground) { type = 'พื้นวางบนดิน'; a = b = `${R[0].bar}${at(R[0].s)}`; top = '-'; }
      else if (d.g.way === 'two') { const neg = R.filter(r => /ลบ/.test(r.pos)), tb = neg.reduce((x, y) => (y.As > x.As ? y : x), neg[0]); type = 'สองทาง'; a = `${R[2].bar}${at(R[2].s)}`; b = `${R[5].bar}${at(R[5].s)}`; top = `${tb.bar}${at(tb.s)}`; }
      else { const pos = R.find(r => /บวก/.test(r.pos)), neg = R.find(r => /ลบ/.test(r.pos)), ts = min(30, round(100 * HX.barA(tmp) / (0.0018 * 100 * d.t) / 2.5) * 2.5); type = 'ทางเดียว'; a = `${pos.bar}${at(pos.s)}`; b = `${tmp}${at(ts)} (กันร้าว)`; top = `${neg.bar}${at(neg.s)}`; }
      rows.push([m, type, f2(d.t / 100), a, b, top, st, L.length]);
    });
    return tables(c, { title: 'ตารางพื้น', cols: ['พื้น', 'ชนิด', 'หนา (ม.)', 'เหล็กล่าง\nช่วงสั้น / หลัก', 'เหล็กล่าง\nช่วงยาว / กันร้าว', 'เหล็กบน\n(ที่ขอบคาน)', 'ชั้น', 'จำนวน'], rows, sub: [`ระยะหุ้ม ${H.mat.cover.slab} ซม. · เหล็กบนยาว L/4 จากขอบคาน`] });
  }
  function fndSchedule(c) {
    const { H, D } = c, rows = [], pile = H.soil.type === 'pile', marks = uniq(D.fnds.filter(f => f.B).map(f => f.mark));
    marks.forEach(m => { const L = D.fnds.filter(f => f.mark === m), f = L[0], peds = uniq(L.map(x => (D.cols.find(d => d.id === x.id && d.seg === 0) || {}).mark).filter(Boolean)).join(', ');
      const r = [m, L.length, `${f2(f.B)}x${f2(f.L)}`, f2(f.t / 100), `${f.fx.n}-${f.fx.bar}`, `${f.fy.n}-${f.fy.bar}`]; if (pile) r.push(`${f.np} ต้น`); r.push(peds); rows.push(r); });
    const cols = ['ฐานราก', 'จำนวน', 'ขนาด BxL (ม.)', 'หนา (ม.)', 'เหล็กล่าง\nขนาน X', 'เหล็กล่าง\nขนาน Y']; if (pile) cols.push('เสาเข็ม'); cols.push('ตอม่อ');
    return tables(c, { title: 'ตารางฐานราก', cols, rows, sub: [pile ? `${H.soil.pile.name} รับน้ำหนักปลอดภัย ${H.soil.pile.cap} ตัน/ต้น` : `ดินรับน้ำหนักปลอดภัย ${H.soil.qa} ตัน/ตร.ม. ที่ระดับ -${f2(+H.soil.Df || 1.5)} ม.`] });
  }

  // ------------------------------------------------------------------ title block and frame
  function frame(c, sh) {
    const { W, Hh, k, TS, TM, TL, H, fr } = c, P = Pen(), m = H.meta || {}, x0 = fr.x1 - fr.tb, x1 = fr.x1, pad = 1.5 * k, wv = x1 - x0 - 2 * pad;
    P.rect(fr.x0, fr.y0, fr.x1 - fr.x0, fr.y1 - fr.y0, 'S-TITLE', { lw: 0.7 }); P.rect(4, 4, W - 8, Hh - 8, 'S-TITLE', { lw: 0.18 }); P.line([x0, fr.y0], [x0, fr.y1], 'S-TITLE', { lw: 0.5 });
    let y = fr.y1; const box = (label, val, h, minL, extra) => {
      const L = val ? wrap(val, h, wv) : [], bh = pad + TS + 1 + max(minL || 1, L.length) * h * 1.5 + (extra || 0) + pad * 0.5;
      P.text([x0 + pad, y - pad - TS], label, TS * 0.9); L.forEach((s, i) => P.text([x0 + pad, y - pad - TS - 1.2 - h - i * h * 1.5], s, h, { L: 'S-TITLE' })); y -= bh; P.line([x0, y], [x1, y], 'S-TITLE', { lw: 0.25 }); return y + bh;
    };
    box('โครงการ', m.project, TM, 2); box('เจ้าของ', m.owner, TM); box('สถานที่ก่อสร้าง', m.location, TS, 2); box('ชื่อแบบ', sh.title, TM, 2);
    const ey = box('วิศวกรผู้ออกแบบ', m.engineer, TS, 1, TS * 3.6); P.text([x0 + pad, ey - (ey - y) + pad + TS * 1.7], 'ลงชื่อ ......................................', TS * 0.9); P.text([x0 + pad, y + pad * 0.6], 'เลขทะเบียนใบอนุญาต ' + (m.license || '..............'), TS * 0.9);
    box('ผู้ตรวจ', m.checker, TS); box('ผู้เขียนแบบ', m.drafter, TS); box('วันที่', m.date, TS); box('มาตราส่วน', sh.scale, TS);
    const yb = fr.y0 + TL * 2.6 + 3 * pad; if (y > yb) { P.text([x0 + pad, y - pad - TS], 'แก้ไขครั้งที่ / หมายเหตุ', TS * 0.9); P.line([x0, yb], [x1, yb], 'S-TITLE', { lw: 0.5 }); }
    P.text([x0 + pad, yb - pad - TS], 'แผ่นที่', TS * 0.9); P.text([x0 + (x1 - x0) / 2, fr.y0 + pad + TL * 0.5], sh.no, TL * 1.25, { al: 'c', L: 'S-TITLE' }); P.text([x1 - pad, yb - pad - TS], `${sh.idx}/${sh.of}`, TS, { al: 'r' });
    return P.E;
  }

  // ------------------------------------------------------------------ packer: views -> sheets (shelf rows, captions aligned, centred)
  function pack(c, groups) {
    const out = [], A = c.area, gap = 7 * c.k; let sh = null, cy = 0, cx = 0, row = [];
    const newSheet = () => { sh = { views: [] }; out.push(sh); cx = A.x0; cy = A.y1; row = []; };
    const flush = () => { if (!row.length) return; const rh = max(...row.map(r => r.th)), used = row.reduce((a, r) => a + r.tw, 0) + gap * (row.length - 1); let x = A.x0 + (A.x1 - A.x0 - used) / 2;
      row.forEach(r => { r.x = x; r.y = cy - rh; x += r.tw + gap; }); cy -= rh + gap; cx = A.x0; row = []; };
    groups.forEach((g, gi) => {
      const join = sh && g.join && gi > 0 && groups[gi - 1].join === g.join; if (join) flush(); else { if (sh) flush(); newSheet(); }
      g.views.forEach(v => {
        const r = { v, g, tw: max(v.w, capW(c, v)), th: v.h + capH(c, v) };
        if (row.length && cx + r.tw > A.x1 + 0.01) flush();
        if (cy - r.th < A.y0 - 0.01 && (row.length || sh.views.length)) { flush(); if (cy - r.th < A.y0 - 0.01 && sh.views.length) newSheet(); }
        row.push(r); sh.views.push(r); cx += r.tw + gap;
      });
    });
    flush();
    out.forEach(s => { const lo = min(...s.views.map(r => r.y)), dy = (lo - A.y0) / 2; s.views.forEach(r => { r.y -= dy; }); });
    return out;
  }
  function compose(c, s) { // absolute entities of the views + captions
    const E = [], { TS, TL } = c;
    s.views.forEach(({ v, x, y, tw: w }) => {
      const ch = capH(c, v), dx = x + (w - v.w) / 2; v.E.forEach(e => E.push(mv(e, dx, y + ch)));
      if (!v.title) return; const cxm = x + w / 2; let yy = y + ch - 2 - TL;
      E.push({ t: 'text', p: [cxm, yy], s: v.title, h: TL, al: 'c', v: 'b', ang: 0, L: 'S-TITLE' }); const tl = tw(v.title, TL) / 2; E.push({ t: 'line', a: [cxm - tl, yy - 1.1], b: [cxm + tl, yy - 1.1], L: 'S-TITLE', lw: 0.4 });
      if (v.scale) { yy -= 1.6 + TS; E.push({ t: 'text', p: [cxm, yy], s: 'มาตราส่วน ' + v.scale, h: TS, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); }
      (v.sub || []).forEach(sb => { yy -= TS * 1.65; E.push({ t: 'text', p: [cxm, yy], s: sb, h: TS, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); });
    });
    return E;
  }

  // ------------------------------------------------------------------ the sheet set
  function context(H, A, D, opt) {
    const size = SIZES[opt.size] ? opt.size : 'A3', [W, Hh] = SIZES[size], k = KF[size], small = W < 500;
    const fr = { x0: small ? 15 : 20, y0: small ? 7 : 10, x1: W - (small ? 7 : 10), y1: Hh - (small ? 7 : 10), tb: { A4: 44, A3: 56, A2: 64, A1: 76, A0: 90 }[size] };
    const pad = 5 * k, area = { x0: fr.x0 + pad, y0: fr.y0 + pad, x1: fr.x1 - fr.tb - pad, y1: fr.y1 - pad };
    return { H, A, D, size, W, Hh, k, TS: 2.5 * k, TM: 3.5 * k, TL: 5 * k, fr, area, aw: area.x1 - area.x0, ah: area.y1 - area.y0, ds: DSC[size] };
  }
  function sheets(H, A, D, opt) {
    opt = opt || {}; const c = context(H, A, D, opt), HX = X(), S = HX.stories(H), groups = [], g = (title, views, join) => { views = views.filter(Boolean); if (views.length) groups.push({ title, views, join }); };
    const plan = (st, kind) => fitScale(c, PLAN_SC, sc => planView(c, st, kind, sc));
    // foundation
    const fmarks = uniq(D.fnds.filter(f => f.B).map(f => f.mark)).map(m => D.fnds.find(f => f.mark === m));
    g(H.soil.type === 'pile' ? 'แปลนฐานราก และเสาเข็ม' : 'แปลนฐานราก', [plan(S[0], 'fnd')], 'fnd'); g('ตารางและรูปตัดฐานราก', fndSchedule(c).concat( fmarks.length > 3 ? [fitScale(c, detList(c).filter(s => s >= 25 || c.k >= 1), sc => fndView(c, fmarks.reduce((a, b) => (b.B > a.B ? b : a)), sc, fmarks[0].mark + '–' + fmarks[fmarks.length - 1].mark))]
      : fmarks.map(f => fitScale(c, detList(c).filter(s => s >= 25 || c.k >= 1), sc => fndView(c, f, sc)))), 'fnd');
    // floors
    const trussRoof = !!(D.roof && D.roof.g);
    S.forEach((st, ki) => { if (ki === S.length - 1 && trussRoof) return; if (!H.beams.some(b => b.st === st.id) && !H.slabs.some(s => s.st === st.id)) return; const v = plan(st, 'floor'); g(v.title, [v]); });
    if (trussRoof) g('แปลนโครงหลังคา', [plan(S[S.length - 1], 'roof')], 'roof'); if (trussRoof) g('รูปด้านโครงถักหลังคา', [fitScale(c, [20, 25, 50, 75, 100, 150].filter(s => s >= c.ds), sc => trussView(c, sc))].concat(trussTable(c)), 'roof');
    g('ตารางเสาและตอม่อ', colSchedule(c), 'sch');
    g('ตารางคาน และรายละเอียดคาน', beamSchedule(c).concat([beamTyp(c)]), 'sch');
    g('ตารางพื้น และรายละเอียดพื้น', slabSchedule(c).concat([slabTyp(c), D.slabs.some(s => s.ground) ? sgTyp(c) : null].filter(Boolean)), 'sch');
    if (H.stairs.length) g('รายละเอียดบันได', H.stairs.map(t => { const sd = D.stairs.find(x => x.id === t.id); return sd && fitScale(c, [20, 25, 50, 75, 100].filter(s => s >= c.ds), sc => stairView(c, t, sd, sc)); }), 'sch');
    let body = pack(c, groups);
    // general notes + index (the index needs the final numbering: repack once if the notes take more sheets than assumed)
    let nN = 1, first = [];
    for (let it = 0; it < 3; it++) {
      const idx = body.map((s, i) => [`S-${String(i + 1 + nN).padStart(2, '0')}`, titleOf(s)]); const list = [['S-01', 'รายการประกอบแบบ โครงสร้าง และสารบัญแบบ']].concat(idx);
      const iv = tables(c, { title: 'สารบัญแบบ', cols: ['แผ่นที่', 'รายการแบบ'], rows: list.map(r => [r[0], r[1]]) });
      first = pack(c, [{ title: 'รายการประกอบแบบโครงสร้าง', views: notesViews(c).concat([hookTyp(c)], iv) }]); if (first.length === nN) break; nN = first.length;
    }
    const all = first.concat(body), n = all.length;
    return all.map((s, i) => {
      const no = `S-${String(i + 1).padStart(2, '0')}`, title = i < first.length ? 'รายการประกอบแบบ โครงสร้าง และสารบัญแบบ' : titleOf(s), scs = uniq(s.views.map(r => r.v.scale).filter(Boolean));
      const sh = { no, idx: i + 1, of: n, title, scale: scs.length === 1 ? '1:' === scs[0].slice(0, 2) ? scs[0] : 'ตามระบุ' : scs.length ? 'ตามระบุ' : '-', W: c.W, H: c.Hh, size: c.size };
      sh.ents = frame(c, sh).concat(compose(c, s)); return sh;
    });
  }
  function titleOf(s) { const t = uniq(s.views.map(r => r.g.title)); return t.join(' / '); }

  // ------------------------------------------------------------------ SVG
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lay = L => LAYERS[L] || [7, 'CONTINUOUS', 0.25];
  const n3 = v => +(+v).toFixed(3);
  function svgEnt(e, Hh) {
    const ld = lay(e.L), lw = e.lw || ld[2], lt = e.lt || ld[1], dash = (LTYPES[lt] || LTYPES.CONTINUOUS)[1].map(v => abs(v) || 0.3).join(' '), col = e.L === 'S-HATCH' ? '#444' : '#000', Y = y => n3(Hh - y);
    const st = `stroke="${col}" stroke-width="${lw}"${dash ? ` stroke-dasharray="${dash}"` : ''}`;
    switch (e.t) {
      case 'line': return `<line x1="${n3(e.a[0])}" y1="${Y(e.a[1])}" x2="${n3(e.b[0])}" y2="${Y(e.b[1])}" ${st}/>`;
      case 'pl': return `<${e.closed ? 'polygon' : 'polyline'} points="${e.p.map(q => n3(q[0]) + ',' + Y(q[1])).join(' ')}" fill="none" ${st} stroke-linejoin="round"/>`;
      case 'circle': return `<circle cx="${n3(e.c[0])}" cy="${Y(e.c[1])}" r="${n3(e.r)}" fill="${e.fill || 'none'}" ${st}/>`;
      case 'dot': return `<circle cx="${n3(e.c[0])}" cy="${Y(e.c[1])}" r="${n3(e.r)}" fill="${col}"/>`;
      case 'arc': { const a0 = e.a0 * PI / 180, a1 = e.a1 * PI / 180, sw = ((e.a1 - e.a0) % 360 + 360) % 360; return `<path d="M${n3(e.c[0] + e.r * Math.cos(a0))},${Y(e.c[1] + e.r * Math.sin(a0))} A${n3(e.r)},${n3(e.r)} 0 ${sw > 180 ? 1 : 0} 0 ${n3(e.c[0] + e.r * Math.cos(a1))},${Y(e.c[1] + e.r * Math.sin(a1))}" fill="none" ${st}/>`; }
      case 'solid': return `<polygon points="${e.p.map(q => n3(q[0]) + ',' + Y(q[1])).join(' ')}" fill="${col}" stroke="none"/>`;
      case 'text': { const dy = e.v === 'm' ? e.h / 2 : e.v === 't' ? e.h : 0, an = e.al === 'c' ? 'middle' : e.al === 'r' ? 'end' : 'start';
        return `<text transform="translate(${n3(e.p[0])} ${Y(e.p[1])})${e.ang ? ` rotate(${n3(-e.ang)})` : ''}" y="${n3(dy)}" font-size="${n3(e.h * FS)}" text-anchor="${an}">${esc(e.s)}</text>`; }
    }
    return '';
  }
  function svg(sh) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sh.W} ${sh.H}" width="${sh.W}mm" height="${sh.H}mm"><rect width="${sh.W}" height="${sh.H}" fill="#fff"/><g font-family="${FONT.replace(/"/g, "'")}" fill="#000" stroke-linecap="round">${sh.ents.map(e => svgEnt(e, sh.H)).join('')}</g></svg>`;
  }

  // ------------------------------------------------------------------ DXF R12 (AC1009), Thai text in cp874, all sheets side by side
  function cp874(s) {
    let o = ''; for (const ch of String(s)) {
      const u = ch.codePointAt(0); if (u >= 0x20 && u < 0x7f) o += ch; else if (u >= 0x0E01 && u <= 0x0E5B) o += String.fromCharCode(u - 0x0E00 + 0xA0);
      else o += { '×': 'x', '□': '[]', '°': '%%d', '±': '%%p', 'φ': '%%c', 'Ø': '%%c', '≥': '>=', '≤': '<=', '–': '-', '—': '-', '·': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '²': '2', '³': '3', '…': '...' }[ch] || '?';
    } return o;
  }
  function dxf(H, A, D, opt) {
    const shs = sheets(H, A, D, opt).filter((sh, i) => !opt || !opt.only || opt.only.includes(sh.no) || opt.only.includes(i)), out = [], w = (c, v) => { out.push(String(c), String(v)); }, f = v => (+v).toFixed(3); let ox = 0; const E = [];
    shs.forEach(sh => { sh.ents.forEach(e => E.push(mv(e, ox, 0))); ox += sh.W + 50; });
    const Wt = ox - 50, Ht = max(...shs.map(s => s.H));
    w(0, 'SECTION'); w(2, 'HEADER'); w(9, '$ACADVER'); w(1, 'AC1009'); w(9, '$DWGCODEPAGE'); w(3, 'ANSI_874'); w(9, '$INSBASE'); w(10, '0.0'); w(20, '0.0'); w(30, '0.0');
    w(9, '$EXTMIN'); w(10, '0.0'); w(20, '0.0'); w(30, '0.0'); w(9, '$EXTMAX'); w(10, f(Wt)); w(20, f(Ht)); w(30, '0.0'); w(9, '$LIMMIN'); w(10, '0.0'); w(20, '0.0'); w(9, '$LIMMAX'); w(10, f(Wt)); w(20, f(Ht));
    w(9, '$LTSCALE'); w(40, '1.0'); w(9, '$TEXTSTYLE'); w(7, 'THAI'); w(9, '$CLAYER'); w(8, '0'); w(9, '$MEASUREMENT'); w(70, 1); w(0, 'ENDSEC');
    w(0, 'SECTION'); w(2, 'TABLES');
    w(0, 'TABLE'); w(2, 'LTYPE'); w(70, Object.keys(LTYPES).length); Object.entries(LTYPES).forEach(([n, [d, p]]) => { w(0, 'LTYPE'); w(2, n); w(70, 0); w(3, d); w(72, 65); w(73, p.length); w(40, f(p.reduce((a, v) => a + abs(v), 0))); p.forEach(v => w(49, f(v))); }); w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'LAYER'); w(70, Object.keys(LAYERS).length + 1); w(0, 'LAYER'); w(2, '0'); w(70, 0); w(62, 7); w(6, 'CONTINUOUS');
    Object.entries(LAYERS).forEach(([n, [cl, lt]]) => { w(0, 'LAYER'); w(2, n); w(70, 0); w(62, cl); w(6, lt); }); w(0, 'ENDTAB');
    w(0, 'TABLE'); w(2, 'STYLE'); w(70, 2); [['STANDARD', 'txt'], ['THAI', 'tahoma.ttf']].forEach(([n, fn]) => { w(0, 'STYLE'); w(2, n); w(70, 0); w(40, '0.0'); w(41, '1.0'); w(50, '0.0'); w(71, 0); w(42, '2.5'); w(3, fn); w(4, ''); }); w(0, 'ENDTAB');
    w(0, 'ENDSEC'); w(0, 'SECTION'); w(2, 'BLOCKS'); w(0, 'ENDSEC'); w(0, 'SECTION'); w(2, 'ENTITIES');
    const com = e => { w(8, e.L || '0'); if (e.lt && e.lt !== lay(e.L)[1]) w(6, e.lt); };
    const P10 = (c0, p) => { w(c0, f(p[0])); w(c0 + 10, f(p[1])); w(c0 + 20, '0.0'); };
    E.forEach(e => {
      if (e.t === 'line') { w(0, 'LINE'); com(e); P10(10, e.a); P10(11, e.b); }
      else if (e.t === 'pl') { w(0, 'POLYLINE'); com(e); w(66, 1); P10(10, [0, 0]); w(70, e.closed ? 1 : 0); e.p.forEach(q => { w(0, 'VERTEX'); w(8, e.L); P10(10, q); }); w(0, 'SEQEND'); w(8, e.L); }
      else if (e.t === 'circle') { w(0, 'CIRCLE'); com(e); P10(10, e.c); w(40, f(e.r)); }
      else if (e.t === 'dot') { w(0, 'POLYLINE'); com(e); w(66, 1); P10(10, [0, 0]); w(70, 1); w(40, f(e.r)); w(41, f(e.r)); [[-e.r / 2, 0], [e.r / 2, 0]].forEach(([u, v]) => { w(0, 'VERTEX'); w(8, e.L); P10(10, [e.c[0] + u, e.c[1] + v]); w(40, f(e.r)); w(41, f(e.r)); w(42, '1.0'); }); w(0, 'SEQEND'); w(8, e.L); }
      else if (e.t === 'arc') { w(0, 'ARC'); com(e); P10(10, e.c); w(40, f(e.r)); w(50, f(((e.a0 % 360) + 360) % 360)); w(51, f(((e.a1 % 360) + 360) % 360)); }
      else if (e.t === 'solid') { const p = e.p; w(0, 'SOLID'); com(e); P10(10, p[0]); P10(11, p[1]); P10(12, p[3] || p[2]); P10(13, p[2]); }
      else if (e.t === 'text') { w(0, 'TEXT'); com(e); P10(10, e.p); w(40, f(e.h)); w(1, cp874(e.s)); if (e.ang) w(50, f(e.ang)); w(7, 'THAI'); const h = e.al === 'c' ? 1 : e.al === 'r' ? 2 : 0, v = e.v === 'm' ? 2 : e.v === 't' ? 3 : 0; if (h || v) { w(72, h); P10(11, e.p); if (v) w(73, v); } }
    });
    w(0, 'ENDSEC'); w(0, 'EOF');
    const s = out.join('\r\n') + '\r\n', u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i) & 255; return u8;
  }

  // ------------------------------------------------------------------ canvas renderer + PDF (browser)
  function drawCanvas(g, sh, ppm) {
    const Y = y => (sh.H - y) * ppm, Xp = x => x * ppm; g.lineCap = 'round'; g.lineJoin = 'round';
    sh.ents.forEach(e => {
      const ld = lay(e.L), lt = e.lt || ld[1], col = e.L === 'S-HATCH' ? '#444' : '#000'; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = max(1, (e.lw || ld[2]) * ppm);
      g.setLineDash((LTYPES[lt] || LTYPES.CONTINUOUS)[1].map(v => (abs(v) || 0.3) * ppm));
      if (e.t === 'line') { g.beginPath(); g.moveTo(Xp(e.a[0]), Y(e.a[1])); g.lineTo(Xp(e.b[0]), Y(e.b[1])); g.stroke(); }
      else if (e.t === 'pl' || e.t === 'solid') { g.beginPath(); e.p.forEach((q, i) => (i ? g.lineTo(Xp(q[0]), Y(q[1])) : g.moveTo(Xp(q[0]), Y(q[1])))); if (e.closed || e.t === 'solid') g.closePath(); if (e.t === 'solid') g.fill(); else g.stroke(); }
      else if (e.t === 'circle' || e.t === 'dot') { g.beginPath(); g.arc(Xp(e.c[0]), Y(e.c[1]), e.r * ppm, 0, 2 * PI); if (e.t === 'dot') g.fill(); else { if (e.fill) { g.fillStyle = e.fill; g.fill(); } g.stroke(); } }
      else if (e.t === 'arc') { g.beginPath(); g.arc(Xp(e.c[0]), Y(e.c[1]), e.r * ppm, -e.a0 * PI / 180, -e.a1 * PI / 180, true); g.stroke(); }
      else if (e.t === 'text') { g.save(); g.setLineDash([]); g.translate(Xp(e.p[0]), Y(e.p[1])); if (e.ang) g.rotate(-e.ang * PI / 180); g.font = `${e.h * FS * ppm}px ${FONT}`; g.textAlign = e.al === 'c' ? 'center' : e.al === 'r' ? 'right' : 'left'; g.textBaseline = 'alphabetic'; g.fillText(e.s, 0, (e.v === 'm' ? e.h / 2 : e.v === 't' ? e.h : 0) * ppm); g.restore(); }
    });
  }
  async function pdf(H, A, D, opt) {
    const J = (G.jspdf && G.jspdf.jsPDF) || G.jsPDF; if (!J) throw new Error('jsPDF is not loaded'); if (typeof document === 'undefined') throw new Error('pdf() needs a browser');
    const shs = sheets(H, A, D, opt); try { if (document.fonts && document.fonts.load) { await document.fonts.load(`12px Sarabun`, 'ก'); await document.fonts.ready; } } catch (e) { /* system fonts */ }
    let doc = null;
    for (const sh of shs) {
      const ppm = min(200 / 25.4, 8000 / max(sh.W, sh.H)), cv = document.createElement('canvas'); cv.width = round(sh.W * ppm); cv.height = round(sh.H * ppm);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); drawCanvas(g, sh, ppm);
      const img = cv.toDataURL('image/jpeg', 0.92); if (!doc) doc = new J({ unit: 'mm', format: [sh.W, sh.H], orientation: 'landscape' }); else doc.addPage([sh.W, sh.H], 'landscape');
      doc.addImage(img, 'JPEG', 0, 0, sh.W, sh.H, undefined, 'FAST'); cv.width = cv.height = 1; await new Promise(r => setTimeout(r, 0));
    }
    return doc;
  }

  G.HOUSEDWG = { sheets, svg, dxf, pdf, drawCanvas, SIZES, LAYERS, cp874, tw };
})(typeof window !== 'undefined' ? window : globalThis);
