/* StructCap Timber — drafting core for the library of standard timber bridge repair details (parametric, vector).
   The details themselves live in the family files tdet_*.js, which register through TDET.api:
     tdet_mr1.js  1330-0001 … 0011   general notes, pier / abutment / wing wall pile repairs, sheeting, spiking rail
     tdet_mr2.js  1330-0012 … 0027   halfcap bearing / connection / strengthening, abutment top connections, stringers, corbels
     tdet_p21a.js PN30-2101 … 2116   pile banding, pier pile repair Types 1 – 6, pier pile strengthening
     tdet_p21b.js PN30-2117 … 2133   steel pile bearings, abutment and wingwall piles, restraint, driven piles
     tdet_p22.js  PN30-2201 … 2305   sheeting, scour, wingwall extension, retaining wall, spiking rail, halfcap replacement
     tdet_p23a.js PN30-2306 … 2317   halfcap strengthening / widening
     tdet_p23b.js PN30-2317A … 2329  halfcap / fullcap strengthening, fullcap replacement, bearing tables
     tdet_p31a.js PN30-3101 … 3112   stringer and corbel replacement / strengthening
     tdet_p31b.js PN30-3113 … 3123   abutment stringers, widening, packing, bolting, splicing
     tdet_p32.js  PN30-3201 … 3214   concrete overlay, reinforcement, kerb, drainage, joints, sill beam
     tdet_p4.js   PN30-4101 … 4209   traffic barrier, project notes, legend, drainage, approach slab, expansion angles
   Drafting conventions follow the source sheets:
     proposed work ........ S-NEW     continuous, heavy
     hidden proposed edges  S-HIDDEN  dashed
     existing structure ... S-EXIST   dash-dot (long dash / short dash), thin
     centre lines ......... S-CL      chain
     reinforcement ........ S-REO     continuous, heavy, with cross-wire dots for fabric
     concrete outline ..... S-CONC    continuous
     designer's notes ..... S-NOTE    dashed box ("delete or complete" notes on the source sheets)
   Each generator returns entities in PAPER millimetres; each view is drawn at its own scale (1:5, 1:10, 1:20 …).
   Entity types: line, pl (polyline), circle, arc, text, solid (filled 3/4-gon), hatch (boundary + pattern). y is up. */
(function (G) {
  'use strict';
  const PI = Math.PI, sq = Math.sqrt, abs = Math.abs, max = Math.max, min = Math.min;
  // ------------------------------------------------------------------ steel sections (mm): d, bf, tf, tw
  const SEC = {
    '150UC30': { k: 'I', d: 158, b: 153, tf: 9.4, tw: 6.6 }, '200UC46': { k: 'I', d: 203, b: 203, tf: 11.0, tw: 7.3 }, '200UC52': { k: 'I', d: 206, b: 204, tf: 12.5, tw: 8.0 }, '200UC60': { k: 'I', d: 210, b: 205, tf: 14.2, tw: 9.3 },
    '250UC73': { k: 'I', d: 254, b: 254, tf: 14.2, tw: 8.6 }, '250UC90': { k: 'I', d: 260, b: 256, tf: 17.3, tw: 10.5 }, '310UC97': { k: 'I', d: 308, b: 305, tf: 15.4, tw: 9.9 }, '310UC118': { k: 'I', d: 315, b: 307, tf: 18.7, tw: 11.9 },
    '250UB37': { k: 'I', d: 256, b: 146, tf: 10.9, tw: 6.4 }, '310UB40': { k: 'I', d: 304, b: 165, tf: 10.2, tw: 6.1 }, '310UB46': { k: 'I', d: 307, b: 166, tf: 11.8, tw: 6.7 }, '360UB45': { k: 'I', d: 352, b: 171, tf: 9.7, tw: 6.9 },
    '360UB51': { k: 'I', d: 356, b: 171, tf: 11.5, tw: 7.3 }, '410UB54': { k: 'I', d: 403, b: 178, tf: 10.9, tw: 7.6 }, '410UB60': { k: 'I', d: 406, b: 178, tf: 12.8, tw: 7.8 }, '460UB67': { k: 'I', d: 454, b: 190, tf: 12.7, tw: 8.5 }, '460UB74': { k: 'I', d: 457, b: 190, tf: 14.5, tw: 9.1 },
    '125PFC': { k: 'C', d: 125, b: 65, tf: 7.5, tw: 4.7 }, '150PFC': { k: 'C', d: 150, b: 75, tf: 9.5, tw: 6.0 }, '180PFC': { k: 'C', d: 180, b: 75, tf: 11.0, tw: 6.0 }, '200PFC': { k: 'C', d: 200, b: 75, tf: 12.0, tw: 6.0 },
    '230PFC': { k: 'C', d: 230, b: 75, tf: 12.0, tw: 6.5 }, '250PFC': { k: 'C', d: 250, b: 90, tf: 15.0, tw: 8.0 }, '300PFC': { k: 'C', d: 300, b: 90, tf: 16.0, tw: 8.0 }, '380PFC': { k: 'C', d: 380, b: 100, tf: 17.5, tw: 10.0 }
  };
  const UCs = ['200UC52', '250UC73', '250UC90', '310UC97'], UBs = ['310UB46', '410UB54', '410UB60', '460UB67'], PFCs = ['125PFC', '150PFC', '180PFC', '200PFC', '250PFC', '300PFC', '380PFC'];
  const secName = s => String(s).replace(/(\d+)(UC|UB|PFC)(\d*)/, (m, a, b, c) => a + ' ' + b + (c ? ' ' + c : ''));

  // ------------------------------------------------------------------ builder
  const LAYERS = {
    'S-NEW': { c: 4, lt: 'CONTINUOUS', lw: 0.5, n: 'Proposed steel / timber' }, 'S-HIDDEN': { c: 4, lt: 'HIDDEN', lw: 0.25, n: 'Hidden edges (proposed)' },
    'S-EXIST': { c: 8, lt: 'DASHDOT', lw: 0.25, n: 'Existing structure' }, 'S-CONC': { c: 2, lt: 'CONTINUOUS', lw: 0.35, n: 'Concrete' },
    'S-REO': { c: 1, lt: 'CONTINUOUS', lw: 0.6, n: 'Reinforcement' }, 'S-HATCH': { c: 9, lt: 'CONTINUOUS', lw: 0.13, n: 'Hatching' }, 'S-TEXT': { c: 7, lt: 'CONTINUOUS', lw: 0.25, n: 'Notes and labels' },
    'S-NOTE': { c: 7, lt: 'DASHED', lw: 0.18, n: "Designer's notes (dashed boxes)" },
    'S-DIM': { c: 3, lt: 'CONTINUOUS', lw: 0.18, n: 'Dimensions' }, 'S-CL': { c: 6, lt: 'CENTER', lw: 0.18, n: 'Centre lines' }, 'S-GROUND': { c: 32, lt: 'CONTINUOUS', lw: 0.35, n: 'Ground / water' },
    'S-TITLE': { c: 7, lt: 'CONTINUOUS', lw: 0.35, n: 'Titles' }, 'S-BORDER': { c: 7, lt: 'CONTINUOUS', lw: 0.7, n: 'Border and title block' }, 'S-BOLT': { c: 5, lt: 'CONTINUOUS', lw: 0.35, n: 'Bolts, rods, anchors' }
  };
  const TH = 2.2; // standard paper text height (mm)
  function Builder() { this.E = []; }
  Builder.prototype.view = function (s, ox, oy) { return new View(this, s, ox || 0, oy || 0); };
  function View(B, s, ox, oy) { this.B = B; this.s = s; this.ox = ox; this.oy = oy; }
  const VP = View.prototype;
  VP.P = function (x, y) { return [this.ox + x / this.s, this.oy + y / this.s]; };
  VP.add = function (e) { this.B.E.push(e); return e; };
  VP.line = function (x1, y1, x2, y2, L) { return this.add({ t: 'line', a: this.P(x1, y1), b: this.P(x2, y2), L: L || 'S-NEW' }); };
  VP.pl = function (pts, closed, L) { return this.add({ t: 'pl', p: pts.map(q => this.P(q[0], q[1])), closed: !!closed, L: L || 'S-NEW' }); };
  VP.rect = function (x, y, w, h, L) { return this.pl([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, L); };
  VP.circ = function (x, y, r, L) { return this.add({ t: 'circle', c: this.P(x, y), r: r / this.s, L: L || 'S-NEW' }); };
  VP.arc = function (x, y, r, a0, a1, L) { return this.add({ t: 'arc', c: this.P(x, y), r: r / this.s, a0, a1, L: L || 'S-NEW' }); };
  // hatch patterns: ansi31 (steel / general 45°), ansi37 (cross), conc (concrete stipple), earth (horizontal), timber (grain), gravel (dots)
  VP.hatch = function (pts, pat, L, sc) { return this.add({ t: 'hatch', p: pts.map(q => this.P(q[0], q[1])), pat: pat || 'ansi31', sc: sc || 1, L: L || 'S-HATCH' }); };
  // filled polygon (convex, model coords) as a fan of solids — used for weld fills, small steel sections at small scale, markers
  VP.fill = function (pts, L) { for (let i = 1; i + 1 < pts.length; i++) this.add({ t: 'solid', p: [this.P(...pts[0]), this.P(...pts[i]), this.P(...pts[i + 1])], L: L || 'S-NEW' }); };
  // text in paper mm height h at a model point; al: l/c/r, v: b/m/t
  VP.text = function (x, y, s, h, al, v, L, ang) { const p = this.P(x, y); return this.add({ t: 'text', p, s: String(s), h: h || TH, al: al || 'l', v: v || 'b', ang: ang || 0, L: L || 'S-TEXT' }); };
  // multi-line text block, first line baseline at the model point
  VP.mtext = function (x, y, s, h, al, L) { h = h || TH; const p = this.P(x, y); String(s).split('\n').forEach((l, i) => this.add({ t: 'text', p: [p[0], p[1] - i * h * 1.55], s: l, h, al: al || 'l', v: 'b', ang: 0, L: L || 'S-TEXT' })); };
  VP.ptext = function (px, py, s, h, al, v, L) { return this.add({ t: 'text', p: [px, py], s: String(s), h: h || TH, al: al || 'l', v: v || 'b', ang: 0, L: L || 'S-TEXT' }); };
  // paper-space arrowhead at point a (paper), pointing along angle ang (radians, direction the arrow points)
  function arrowP(add, a, ang, L, len, wid) { const al = len || 2.4, aw = (wid || 0.8); add({ t: 'solid', p: [a, [a[0] - al * Math.cos(ang) - aw * Math.sin(ang), a[1] - al * Math.sin(ang) + aw * Math.cos(ang)], [a[0] - al * Math.cos(ang) + aw * Math.sin(ang), a[1] - al * Math.sin(ang) - aw * Math.cos(ang)]], L: L || 'S-TEXT' }); }
  VP.arrow = function (x, y, ang, L) { arrowP(e => this.add(e), this.P(x, y), ang * PI / 180, L || 'S-TEXT'); };
  // leader: arrow at the model point (x,y), shoulder at paper offset (dx,dy), text beside the shoulder (first line on the shoulder).
  // opt: h (text height), dot (dot terminator instead of an arrow — used where the leader ends inside an object), noArrow
  VP.leader = function (x, y, dx, dy, s, opt) {
    opt = opt || {}; const a = this.P(x, y), b = [a[0] + dx, a[1] + dy], right = dx >= 0, lines = String(s).split('\n'), h = opt.h || TH, gap = 1.0, tl = max(...lines.map(l => l.length)) * h * 0.7;
    const c = [b[0] + (right ? 2.5 : -2.5), b[1]];
    this.add({ t: 'pl', p: [a, b, c], closed: false, L: 'S-TEXT' });
    const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
    if (opt.dot) this.add({ t: 'circle', c: a, r: 0.45, L: 'S-TEXT' }), this.add({ t: 'solid', p: [[a[0] - 0.4, a[1] - 0.4], [a[0] + 0.4, a[1] - 0.4], [a[0] + 0.4, a[1] + 0.4], [a[0] - 0.4, a[1] + 0.4]], L: 'S-TEXT' });
    else if (!opt.noArrow) arrowP(e => this.add(e), a, ang, 'S-TEXT');
    lines.forEach((l, i) => this.add({ t: 'text', p: [c[0] + (right ? gap : -gap), c[1] - h / 2 - i * h * 1.55], s: l, h, al: right ? 'l' : 'r', v: 'b', ang: 0, L: opt.L || 'S-TEXT' }));
    return tl;
  };
  // several arrows from one label: pts = [[x,y],…] model points, label shoulder at paper offset (dx,dy) from the FIRST point
  VP.leaders = function (pts, dx, dy, s, opt) { opt = opt || {}; const a0 = this.P(pts[0][0], pts[0][1]), b = [a0[0] + dx, a0[1] + dy]; this.leader(pts[0][0], pts[0][1], dx, dy, s, opt); pts.slice(1).forEach(q => { const a = this.P(q[0], q[1]); this.add({ t: 'line', a: b, b: a, L: 'S-TEXT' }); arrowP(e => this.add(e), a, Math.atan2(a[1] - b[1], a[0] - b[0]), 'S-TEXT'); }); };
  // linear dimension between model points; off = paper offset (+ left of a->b), txt overrides the measured value.
  // Closed filled arrowheads (MRWA practice), extension lines with a 1 mm gap, text above the dimension line.
  // opt: h, tick (oblique ticks instead of arrows), sub (second text line under the line, e.g. 'TYP' / 'MIN')
  VP.dim = function (x1, y1, x2, y2, off, txt, opt) {
    opt = opt || {}; const a = this.P(x1, y1), b = this.P(x2, y2), dx = b[0] - a[0], dy = b[1] - a[1], L = sq(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, o = off == null ? 6 : off, sg = o >= 0 ? 1 : -1;
    const a2 = [a[0] + nx * o, a[1] + ny * o], b2 = [b[0] + nx * o, b[1] + ny * o];
    if (abs(o) > 1.2) { this.add({ t: 'line', a: [a[0] + nx * sg, a[1] + ny * sg], b: [a2[0] + nx * sg * 1.5, a2[1] + ny * sg * 1.5], L: 'S-DIM' }); this.add({ t: 'line', a: [b[0] + nx * sg, b[1] + ny * sg], b: [b2[0] + nx * sg * 1.5, b2[1] + ny * sg * 1.5], L: 'S-DIM' }); }
    const real = Math.round(sq(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))), s = txt != null ? String(txt) : String(real), h = opt.h || 2.0;
    const tw = s.length * h * 0.7, inside = L > 6.5;
    if (opt.tick) { this.add({ t: 'line', a: [a2[0] - ux * 1.5, a2[1] - uy * 1.5], b: [b2[0] + ux * 1.5, b2[1] + uy * 1.5], L: 'S-DIM' }); [a2, b2].forEach(p => this.add({ t: 'line', a: [p[0] - (ux + nx) * 0.9, p[1] - (uy + ny) * 0.9], b: [p[0] + (ux + nx) * 0.9, p[1] + (uy + ny) * 0.9], L: 'S-DIM' })); }
    else if (inside) { this.add({ t: 'line', a: a2, b: b2, L: 'S-DIM' }); arrowP(e => this.add(e), a2, Math.atan2(-uy, -ux), 'S-DIM', 2.2, 0.7); arrowP(e => this.add(e), b2, Math.atan2(uy, ux), 'S-DIM', 2.2, 0.7); }
    else { this.add({ t: 'line', a: [a2[0] - ux * 5, a2[1] - uy * 5], b: [b2[0] + ux * 5, b2[1] + uy * 5], L: 'S-DIM' }); arrowP(e => this.add(e), a2, Math.atan2(uy, ux), 'S-DIM', 2.2, 0.7); arrowP(e => this.add(e), b2, Math.atan2(-uy, -ux), 'S-DIM', 2.2, 0.7); }
    let ang = Math.atan2(uy, ux) * 180 / PI; if (ang > 90.01 || ang <= -90) ang += 180; ang = Math.round(ang * 100) / 100; if (ang > 180) ang -= 360;
    const ar = ang * PI / 180, px = -Math.sin(ar), py = Math.cos(ar); // "up" for the text
    let m = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2];
    if (!inside || tw > L - 1) { // text does not fit: put it beyond the second point
      const k = (tw / 2 + 3); const dir = Math.cos(ar) * ux + Math.sin(ar) * uy >= 0 ? 1 : -1; m = [b2[0] + ux * (k + (inside ? 0 : 5)) * 1, b2[1] + uy * (k + (inside ? 0 : 5))]; if (dir < 0) m = [a2[0] - ux * (k + 5), a2[1] - uy * (k + 5)];
    }
    this.add({ t: 'text', p: [m[0] + px * 0.7, m[1] + py * 0.7], s, h, al: 'c', v: 'b', ang, L: 'S-DIM' });
    if (opt.sub) this.add({ t: 'text', p: [m[0] - px * 0.9, m[1] - py * 0.9], s: opt.sub, h: h * 0.9, al: 'c', v: 't', ang, L: 'S-DIM' });
  };
  // chain of dimensions along a line through model points pts (sorted), same offset; txts optional array ('=' for equal spacing)
  VP.dimChain = function (pts, off, txts, opt) { for (let i = 0; i + 1 < pts.length; i++) this.dim(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], off, txts ? txts[i] : null, opt); };
  VP.cl = function (x1, y1, x2, y2, lbl) { this.line(x1, y1, x2, y2, 'S-CL'); if (lbl) { const p = this.P(x2, y2); this.add({ t: 'text', p: [p[0], p[1] + 1.2], s: '℄ ' + lbl, h: TH, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); } };
  // break line (zigzag) across from (x1,y1) to (x2,y2)
  VP.brk = function (x1, y1, x2, y2, L) { const dx = x2 - x1, dy = y2 - y1, len = sq(dx * dx + dy * dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux, z = 2.5 * this.s, m = [(x1 + x2) / 2, (y1 + y2) / 2]; this.pl([[x1 - ux * z, y1 - uy * z], [m[0] - ux * z / 2, m[1] - uy * z / 2], [m[0] - ux * z / 4 + nx * z, m[1] - uy * z / 4 + ny * z], [m[0] + ux * z / 4 - nx * z, m[1] + uy * z / 4 - ny * z], [m[0] + ux * z / 2, m[1] + uy * z / 2], [x2 + ux * z, y2 + uy * z]], false, L || 'S-TEXT'); };
  // "S" break across a round member (timber pile / log) of diameter D centred at x, at level y (horizontal member: pass rot=1)
  VP.pileEnd = function (x, y, D, L, rot) { const r = D / 4; if (rot) { this.arc(x, y - r, r, 90, 270, L || 'S-EXIST'); this.arc(x, y + r, r, 270, 450, L || 'S-EXIST'); } else { this.arc(x - r, y, r, 180, 360, L || 'S-EXIST'); this.arc(x + r, y, r, 0, 180, L || 'S-EXIST'); } };
  // natural ground line with MRWA "tuft" hatching under it
  VP.ground = function (x1, x2, y, lbl) { this.line(x1, y, x2, y, 'S-GROUND'); const s = 6 * this.s, t = 1.8 * this.s; for (let x = x1 + s * 0.3; x + t < x2; x += s) { for (let k = 0; k < 3; k++) this.line(x + k * t * 0.45, y, x + k * t * 0.45 - t * 0.8, y - t, 'S-GROUND'); } if (lbl) { const p = this.P(x2, y); this.add({ t: 'text', p: [p[0] + 2, p[1] + 1], s: lbl, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); } };
  // level marker: filled triangle with its point on the level line, label on a horizontal line above (MRWA "EXISTING G.L.")
  VP.wl = function (x, y, lbl, opt) { opt = opt || {}; const p = this.P(x, y); this.add({ t: 'solid', p: [p, [p[0] - 1.8, p[1] + 2.6], [p[0] + 1.8, p[1] + 2.6]], L: 'S-GROUND' }); const tw = lbl ? max(...String(lbl).split('\n').map(l => l.length)) * TH * 0.7 + 3 : 8; const x0 = opt.left ? p[0] - tw : p[0] - 4; this.add({ t: 'line', a: [x0, p[1] + 2.6], b: [x0 + tw + 4, p[1] + 2.6], L: 'S-TEXT' }); if (lbl) String(lbl).split('\n').forEach((l, i, A) => this.add({ t: 'text', p: [x0 + 1, p[1] + 3.6 + (A.length - 1 - i) * TH * 1.55], s: l, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' })); };
  // water level symbol (solid wedge over two short lines) at model point
  VP.water = function (x, y, lbl) { const p = this.P(x, y); this.add({ t: 'solid', p: [[p[0] - 6, p[1] + 1.4], [p[0] + 6, p[1] + 1.4], [p[0], p[1]]], L: 'S-GROUND' }); this.add({ t: 'line', a: [p[0] - 9, p[1] + 1.4], b: [p[0] + 9, p[1] + 1.4], L: 'S-GROUND' }); this.add({ t: 'line', a: [p[0] - 4, p[1] - 0.8], b: [p[0] + 4, p[1] - 0.8], L: 'S-GROUND' }); if (lbl) this.add({ t: 'text', p: [p[0] + 10, p[1] + 0.6], s: lbl, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); };
  // section / view marker: circle with letter; dir (deg) = direction of view, drawn as a solid pointer on the circle; optional cut line of len paper mm opposite
  VP.mark = function (x, y, ch, dir, cut) { const p = this.P(x, y); this.add({ t: 'circle', c: p, r: 3, L: 'S-TEXT' }); if (ch != null && ch !== '') this.add({ t: 'text', p, s: String(ch), h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); if (dir != null) { const a = dir * PI / 180; this.add({ t: 'solid', p: [[p[0] + 5.2 * Math.cos(a), p[1] + 5.2 * Math.sin(a)], [p[0] + 2.4 * Math.cos(a + 1.1), p[1] + 2.4 * Math.sin(a + 1.1)], [p[0] + 2.4 * Math.cos(a - 1.1), p[1] + 2.4 * Math.sin(a - 1.1)]], L: 'S-TEXT' }); } if (cut) { const a = (dir || 0) * PI / 180 + PI / 2; this.add({ t: 'line', a: [p[0] + 3 * Math.cos(a + PI), p[1] + 3 * Math.sin(a + PI)], b: [p[0] + (3 + cut) * Math.cos(a + PI), p[1] + (3 + cut) * Math.sin(a + PI)], L: 'S-TITLE' }); } };
  // section cut: heavy short line from (x1,y1) to (x2,y2) with markers at both ends looking in direction dir (deg)
  VP.cut = function (x1, y1, x2, y2, ch, dir) { const a = this.P(x1, y1), b = this.P(x2, y2), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];[[a, -1], [b, 1]].forEach(([p, k]) => { const q = [p[0] + u[0] * k * 6, p[1] + u[1] * k * 6]; this.add({ t: 'line', a: p, b: q, L: 'S-TITLE' }); this.add({ t: 'circle', c: [q[0] + u[0] * k * 3, q[1] + u[1] * k * 3], r: 3, L: 'S-TEXT' }); this.add({ t: 'text', p: [q[0] + u[0] * k * 3, q[1] + u[1] * k * 3], s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); const d = dir * PI / 180, c = [q[0] + u[0] * k * 3, q[1] + u[1] * k * 3]; this.add({ t: 'solid', p: [[c[0] + 5.2 * Math.cos(d), c[1] + 5.2 * Math.sin(d)], [c[0] + 2.4 * Math.cos(d + 1.1), c[1] + 2.4 * Math.sin(d + 1.1)], [c[0] + 2.4 * Math.cos(d - 1.1), c[1] + 2.4 * Math.sin(d - 1.1)]], L: 'S-TEXT' }); }); this.add({ t: 'line', a, b, L: 'S-CL' }); };
  // AS 1101.3 weld symbol: arrow at model point (x,y), reference line from the paper offset (dx,dy).
  // o: { size: '6', len: '50-75' (length/pitch text), other: true (weld on the other side: symbol above the line), both: true,
  //      all: true (weld all round circle), site: true (site weld flag), butt: true (butt weld 'V' symbol), tail: 'TYP' }
  VP.weld = function (x, y, dx, dy, o) {
    o = o || {}; const a = this.P(x, y), b = [a[0] + dx, a[1] + dy], k = dx >= 0 ? 1 : -1, rl = 14, c = [b[0] + k * rl, b[1]], add = e => this.add(e);
    add({ t: 'pl', p: [a, b, c], closed: false, L: 'S-TEXT' }); arrowP(add, a, Math.atan2(a[1] - b[1], a[0] - b[0]), 'S-TEXT');
    const sx = b[0] + k * 5.5, tri = (sgn) => { if (o.butt) add({ t: 'pl', p: [[sx - 1.4, b[1] + sgn * 2.6], [sx, b[1]], [sx + 1.4, b[1] + sgn * 2.6]], closed: false, L: 'S-TEXT' }); else add({ t: 'pl', p: [[sx - 1.3, b[1]], [sx - 1.3, b[1] + sgn * 2.6], [sx + 1.3, b[1]]], closed: false, L: 'S-TEXT' }); if (o.size) add({ t: 'text', p: [sx - 2.2, b[1] + (sgn > 0 ? 0.5 : -0.5)], s: String(o.size), h: 2.0, al: 'r', v: sgn > 0 ? 'b' : 't', ang: 0, L: 'S-TEXT' }); if (o.len) add({ t: 'text', p: [sx + 2.2, b[1] + (sgn > 0 ? 0.5 : -0.5)], s: String(o.len), h: 2.0, al: 'l', v: sgn > 0 ? 'b' : 't', ang: 0, L: 'S-TEXT' }); };
    if (o.both) { tri(1); tri(-1); } else tri(o.other ? 1 : -1);
    if (o.all) add({ t: 'circle', c: b, r: 1.1, L: 'S-TEXT' });
    if (o.site) { add({ t: 'line', a: b, b: [b[0], b[1] + 4.5], L: 'S-TEXT' }); add({ t: 'solid', p: [[b[0], b[1] + 4.5], [b[0], b[1] + 2.8], [b[0] + k * 2.6, b[1] + 3.65]], L: 'S-TEXT' }); }
    if (o.tail) { add({ t: 'line', a: c, b: [c[0] + k * 2, c[1] + 2], L: 'S-TEXT' }); add({ t: 'line', a: c, b: [c[0] + k * 2, c[1] - 2], L: 'S-TEXT' }); add({ t: 'text', p: [c[0] + k * 3, c[1] - 1], s: o.tail, h: 2.0, al: k > 0 ? 'l' : 'r', v: 'b', ang: 0, L: 'S-TEXT' }); }
  };
  // reinforcement: bar along model points (heavy line); fabric = line with cross-wire dots at sp (model mm)
  VP.bar = function (pts, L) { return this.pl(pts, false, L || 'S-REO'); };
  VP.fabric = function (x1, y1, x2, y2, sp) { this.line(x1, y1, x2, y2, 'S-REO'); const L = Math.hypot(x2 - x1, y2 - y1), n = max(1, Math.floor(L / (sp || 200))); for (let i = 0; i <= n; i++) { const t = i / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t, p = this.P(x, y), r = 0.42; this.add({ t: 'solid', p: [[p[0] - r, p[1] - r], [p[0] + r, p[1] - r], [p[0] + r, p[1] + r], [p[0] - r, p[1] + r]], L: 'S-REO' }); } };
  // bar seen end-on: small circle with a dot (bar diameter db in model mm, drawn min 0.8 paper mm)
  VP.barEnd = function (x, y, db) { const r = max(0.45, (db || 12) / 2 / this.s), p = this.P(x, y); this.add({ t: 'circle', c: p, r, L: 'S-REO' }); this.add({ t: 'solid', p: [[p[0] - r * 0.55, p[1] - r * 0.55], [p[0] + r * 0.55, p[1] - r * 0.55], [p[0] + r * 0.55, p[1] + r * 0.55], [p[0] - r * 0.55, p[1] + r * 0.55]], L: 'S-REO' }); };
  // spike / dowel from (x1,y1) (head) to (x2,y2) (point); hidden (inside timber) by default
  VP.spike = function (x1, y1, x2, y2, L) { const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, w = max(4, 5 * this.s * 0.4); this.line(x1, y1, x2 - ux * w * 2, y2 - uy * w * 2, L || 'S-BOLT'); this.pl([[x2 - ux * w * 2 + nx * w / 2, y2 - uy * w * 2 + ny * w / 2], [x2, y2], [x2 - ux * w * 2 - nx * w / 2, y2 - uy * w * 2 - ny * w / 2]], false, L || 'S-BOLT'); this.line(x1 + nx * w, y1 + ny * w, x1 - nx * w, y1 - ny * w, L || 'S-BOLT'); };
  // hex nut + washer seen side-on, on a bolt axis through (x,y) with unit direction (ux,uy) pointing AWAY from the bearing face
  VP.nut = function (x, y, ux, uy, d) { d = d || 20; const nx = -uy, ny = ux, ww = d * 1.6, wt = 3, nh = d * 0.8, nw = d * 1.5, P = (a, b) => [x + ux * a + nx * b, y + uy * a + ny * b]; this.pl([P(0, -ww), P(wt, -ww), P(wt, ww), P(0, ww)], true, 'S-BOLT'); this.pl([P(wt, -nw / 2), P(wt + nh, -nw / 2), P(wt + nh, nw / 2), P(wt, nw / 2)], true, 'S-BOLT'); this.line(...P(wt, -nw / 6), ...P(wt + nh, -nw / 6), 'S-BOLT'); this.line(...P(wt, nw / 6), ...P(wt + nh, nw / 6), 'S-BOLT'); };
  // bolt / threaded rod side-on from (x1,y1) to (x2,y2) through the parts: nut+washer at both ends (head: 'nut' | 'head' | 'none' at the first end)
  VP.bolt = function (x1, y1, x2, y2, d, head) { d = d || 20; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, pr = d * 1.2; this.line(x1 - ux * pr + nx * d / 2, y1 - uy * pr + ny * d / 2, x2 + ux * pr + nx * d / 2, y2 + uy * pr + ny * d / 2, 'S-BOLT'); this.line(x1 - ux * pr - nx * d / 2, y1 - uy * pr - ny * d / 2, x2 + ux * pr - nx * d / 2, y2 + uy * pr - ny * d / 2, 'S-BOLT'); this.nut(x2, y2, ux, uy, d); if (head !== 'none') this.nut(x1, y1, -ux, -uy, d); };
  // bolt / rod seen end-on: circle with a cross (hole + bolt)
  VP.boltEnd = function (x, y, d) { const r = (d || 20) / 2; this.circ(x, y, r, 'S-BOLT'); this.line(x - r * 1.6, y, x + r * 1.6, y, 'S-CL'); this.line(x, y - r * 1.6, x, y + r * 1.6, 'S-CL'); };
  // dashed designer's note box (paper mm width w) with its top-left at the model point; solid: true for a construction note box
  VP.noteBox = function (x, y, s, w, opt) { opt = opt || {}; const p = this.P(x, y), h = opt.h || TH, lines = []; String(s).split('\n').forEach(par => { let cur = ''; par.split(' ').forEach(wd => { if (((cur + ' ' + wd).length) * h * 0.7 > w - 4 && cur) { lines.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; }); lines.push(cur); }); const H = lines.length * h * 1.55 + 2.6; this.add({ t: 'pl', p: [[p[0], p[1]], [p[0] + w, p[1]], [p[0] + w, p[1] - H], [p[0], p[1] - H]], closed: true, L: opt.solid ? 'S-TEXT' : 'S-NOTE' }); lines.forEach((l, i) => this.add({ t: 'text', p: [p[0] + 2, p[1] - 1.6 - h - i * h * 1.55], s: l, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' })); return H; };
  // grout / mortar or packer hatch helpers
  VP.timberHatch = function (pts) { this.hatch(pts, 'timber', 'S-HATCH'); };

  // ------------------------------------------------------------------ titles, notes, tables
  // view title (MRWA): underlined title, letter in a circle for SECTION/VIEW/DETAIL X, scale ('1:10') under, centred at x
  Builder.prototype.title = function (x, y, s, scale, sub, opt) {
    opt = opt || {}; const m = /^((?:TYPICAL |PART )?(?:SECTIONAL ELEVATION|SECTIONAL PLAN|SECTION|VIEW|DETAIL|ELEVATION|PLAN))\s+([A-Z0-9]{1,2})$/.exec(s), h = opt.h || 3.2;
    if (opt.main) return this.mainTitle(x, y, s, scale, sub, opt);
    const word = m ? m[1] : s, tw = word.length * h * 0.7, cw = m ? 8 : 0, x0 = x - (tw + cw) / 2;
    this.E.push({ t: 'text', p: [x0, y], s: word, h, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); this.E.push({ t: 'line', a: [x0, y - 1.1], b: [x0 + tw, y - 1.1], L: 'S-TITLE' });
    if (m) { this.E.push({ t: 'circle', c: [x0 + tw + 5, y + h / 2], r: 3, L: 'S-TITLE' }); this.E.push({ t: 'text', p: [x0 + tw + 5, y + h / 2], s: m[2], h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); }
    let yy = y - 4.4; if (sub) String(sub).split('\n').forEach(l => { this.E.push({ t: 'text', p: [x0, yy], s: l, h: TH * 0.95, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.4; });
    if (scale) this.E.push({ t: 'text', p: [x0, yy], s: '1:' + scale, h: TH * 0.95, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
  };
  // detail title (MRWA): solid bullet, underlined title, optional project drawing ref ('XX30-XXXX'), sub-lines and scale below
  Builder.prototype.mainTitle = function (x, y, s, scale, sub, opt) {
    opt = opt || {}; const h = 3.6, tw = s.length * h * 0.7, x0 = x - tw / 2 + 4;
    const bc = [x0 - 5, y + h / 2]; for (let i = 0; i < 16; i++) { const a0 = 2 * PI * i / 16, a1 = 2 * PI * (i + 1) / 16; this.E.push({ t: 'solid', p: [bc, [bc[0] + 2 * Math.cos(a0), bc[1] + 2 * Math.sin(a0)], [bc[0] + 2 * Math.cos(a1), bc[1] + 2 * Math.sin(a1)]], L: 'S-TITLE' }); } this.E.push({ t: 'line', a: [bc[0] - 4.5, bc[1]], b: [bc[0] - 2, bc[1]], L: 'S-TITLE' });
    this.E.push({ t: 'text', p: [x0, y], s, h, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); this.E.push({ t: 'line', a: [x0, y - 1.2], b: [x0 + tw, y - 1.2], L: 'S-TITLE' });
    if (opt.ref) this.E.push({ t: 'text', p: [x0 + tw + 3, y], s: opt.ref, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
    let yy = y - 4.6; if (sub) String(sub).split('\n').forEach(l => { this.E.push({ t: 'text', p: [x0, yy], s: l, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.4; });
    if (scale) this.E.push({ t: 'text', p: [x0, yy], s: '1:' + scale, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
  };
  // numbered notes; w = paper width for wrapping; head = heading (default 'NOTES:'); returns the y under the last line
  Builder.prototype.notes = function (x, y, lines, w, head) { if (head !== '') { this.E.push({ t: 'text', p: [x, y], s: head || 'NOTES:', h: 2.6, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); this.E.push({ t: 'line', a: [x, y - 0.9], b: [x + (head || 'NOTES:').length * 2.6 * 0.7, y - 0.9], L: 'S-TITLE' }); } let yy = y - 5; const num = lines.length > 1; lines.forEach((l, i) => { const words = String(l).split(' '), rows = []; let cur = ''; words.forEach(wd => { if ((cur + ' ' + wd).length * TH * 0.7 > (w || 120) - 6 && cur) { rows.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; }); rows.push(cur); rows.forEach((r, k) => { if (!k && num) this.E.push({ t: 'text', p: [x, yy], s: (i + 1) + '.', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); this.E.push({ t: 'text', p: [x + (num ? 5 : 0), yy], s: r, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.4; }); yy -= 0.6; }); return yy; };
  Builder.prototype.table = function (x, y, cols, rows, h) { h = h || TH; let yy = y; const W = cols.reduce((a, c) => a + c.w, 0), all = [cols.map(c => c.n)].concat(rows);
    all.forEach((r, i) => { const nl = Math.max(...r.map(c => String(c).split('\n').length)), rh = nl * h * 1.45 + h * 1.1; let xx = x; r.forEach((cell, j) => { const L = String(cell).split('\n'); L.forEach((l, k) => this.E.push({ t: 'text', p: [xx + cols[j].w / 2, yy - rh / 2 + (L.length - 1) * h * 0.725 - k * h * 1.45], s: l, h: i ? h : h * 0.95, al: 'c', v: 'm', ang: 0, L: i ? 'S-TEXT' : 'S-TITLE' })); xx += cols[j].w; }); this.E.push({ t: 'line', a: [x, yy], b: [x + W, yy], L: 'S-TEXT' }); yy -= rh; });
    this.E.push({ t: 'line', a: [x, yy], b: [x + W, yy], L: 'S-TEXT' }); let xx = x; [0].concat(cols.map(c => c.w)).forEach(w => { xx += w; this.E.push({ t: 'line', a: [xx, y], b: [xx, yy], L: 'S-TEXT' }); }); return yy; };
  Builder.prototype.noteBox = function (x, y, s, w, opt) { return new View(this, 1, 0, 0).noteBox(x, y, s, w, opt); };

  // ------------------------------------------------------------------ structural shapes (model mm in a view)
  // I section in cross-section, centred, web vertical (rot 0) or horizontal (rot 90)
  function iSec(v, cx, cy, s, rot, L) { const d = s.d, b = s.b, tf = s.tf, tw = s.tw, P = [[-b / 2, -d / 2], [b / 2, -d / 2], [b / 2, -d / 2 + tf], [tw / 2, -d / 2 + tf], [tw / 2, d / 2 - tf], [b / 2, d / 2 - tf], [b / 2, d / 2], [-b / 2, d / 2], [-b / 2, d / 2 - tf], [-tw / 2, d / 2 - tf], [-tw / 2, -d / 2 + tf], [-b / 2, -d / 2 + tf]]; v.pl(P.map(p => (rot ? [cx + p[1], cy + p[0]] : [cx + p[0], cy + p[1]])), true, L || 'S-NEW'); }
  // channel in cross-section: web vertical at x = cx, toes pointing +x (dir 1) or -x (dir -1)
  function cSec(v, cx, cy, s, dir, L) { const d = s.d, b = s.b, tf = s.tf, tw = s.tw, k = dir || 1, P = [[0, -d / 2], [b, -d / 2], [b, -d / 2 + tf], [tw, -d / 2 + tf], [tw, d / 2 - tf], [b, d / 2 - tf], [b, d / 2], [0, d / 2]]; v.pl(P.map(p => [cx + k * p[0], cy + p[1]]), true, L || 'S-NEW'); }
  // channel in cross-section with the web horizontal (lying flat): web at y = cy, toes pointing +y (dir 1) or -y, centred on cx
  function cSecH(v, cx, cy, s, dir, L) { const d = s.d, b = s.b, tf = s.tf, tw = s.tw, k = dir || 1, P = [[-d / 2, 0], [-d / 2, b], [-d / 2 + tf, b], [-d / 2 + tf, tw], [d / 2 - tf, tw], [d / 2 - tf, b], [d / 2, b], [d / 2, 0]]; v.pl(P.map(p => [cx + p[0], cy + k * p[1]]), true, L || 'S-NEW'); }
  // equal / unequal angle in cross-section with heel at (x, y); legs along +x*dx and +y*dy
  function aSec(v, x, y, a, b, t, dx, dy, L) { dx = dx || 1; dy = dy || 1; v.pl([[x, y], [x + dx * a, y], [x + dx * a, y + dy * t], [x + dx * t, y + dy * t], [x + dx * t, y + dy * b], [x, y + dy * b]], true, L || 'S-NEW'); }
  // RHS / SHS in cross-section, centred
  function rhsSec(v, cx, cy, b, d, t, L) { v.rect(cx - b / 2, cy - d / 2, b, d, L || 'S-NEW'); v.rect(cx - b / 2 + t, cy - d / 2 + t, b - 2 * t, d - 2 * t, L || 'S-NEW'); }
  // I member in elevation seen on the flange (width b) between y0..y1 at centre x (web shown hidden)
  function iElevFlange(v, x, y0, y1, s, L) { v.rect(x - s.b / 2, y0, s.b, y1 - y0, L || 'S-NEW'); v.line(x - s.tw / 2, y0, x - s.tw / 2, y1, 'S-HIDDEN'); v.line(x + s.tw / 2, y0, x + s.tw / 2, y1, 'S-HIDDEN'); }
  // I member in elevation seen on the web (depth d), vertical between y0..y1 or horizontal x0..x1
  function iElevWebV(v, x, y0, y1, s, L) { v.rect(x - s.d / 2, y0, s.d, y1 - y0, L || 'S-NEW'); v.line(x - s.d / 2 + s.tf, y0, x - s.d / 2 + s.tf, y1, L || 'S-NEW'); v.line(x + s.d / 2 - s.tf, y0, x + s.d / 2 - s.tf, y1, L || 'S-NEW'); }
  function iElevWebH(v, x0, x1, y, s, L) { v.rect(x0, y - s.d / 2, x1 - x0, s.d, L || 'S-NEW'); v.line(x0, y - s.d / 2 + s.tf, x1, y - s.d / 2 + s.tf, L || 'S-NEW'); v.line(x0, y + s.d / 2 - s.tf, x1, y + s.d / 2 - s.tf, L || 'S-NEW'); }
  // channel seen in elevation (web face), horizontal from x0..x1, top at yt (flange lines hidden behind the web face when hid)
  function pfcElevH(v, x0, x1, yt, s, L, hid) { v.rect(x0, yt - s.d, x1 - x0, s.d, L || 'S-NEW'); v.line(x0, yt - s.tf, x1, yt - s.tf, hid ? 'S-HIDDEN' : (L || 'S-NEW')); v.line(x0, yt - s.d + s.tf, x1, yt - s.d + s.tf, hid ? 'S-HIDDEN' : (L || 'S-NEW')); }
  // channel seen in elevation, vertical, x = web back face, toes towards +x (dir 1) or -x, from y0..y1 (seen on the flange edge)
  function pfcElevV(v, x, y0, y1, s, dir, L) { const k = dir || 1; v.rect(min(x, x + k * s.b), y0, s.b, y1 - y0, L || 'S-NEW'); v.line(x + k * s.tw, y0, x + k * s.tw, y1, 'S-HIDDEN'); }
  // timber pile in elevation (existing, dash-dot) from y0 (bottom, S-break) to y1 (top, S-break when brkTop)
  function pileElev(v, x, y0, y1, D, L, brkTop) { v.line(x - D / 2, y0, x - D / 2, y1, L || 'S-EXIST'); v.line(x + D / 2, y0, x + D / 2, y1, L || 'S-EXIST'); v.pileEnd(x, y0, D, L || 'S-EXIST'); if (brkTop) v.pileEnd(x, y1, D, L || 'S-EXIST'); }
  // threaded rod through (x1,y1)-(x2,y2) with nuts + washers (w = washer width)
  function rod(v, x1, y1, x2, y2, w) { const dx = x2 - x1, dy = y2 - y1, L = sq(dx * dx + dy * dy), ux = dx / L, uy = dy / L; v.line(x1 - ux * 25, y1 - uy * 25, x2 + ux * 25, y2 + uy * 25, 'S-BOLT'); v.nut(x2, y2, ux, uy, (w || 65) / 3.2); v.nut(x1, y1, -ux, -uy, (w || 65) / 3.2); }
  function boltSym(v, x, y, d) { v.boltEnd(x, y, d || 20); }
  // concrete outline with concrete stipple
  function concBox(v, pts) { v.pl(pts, true, 'S-CONC'); v.hatch(pts, 'conc', 'S-HATCH'); }
  function ringPts(r0, r1) { const P0 = [], n = 48; for (let i = 0; i <= n; i++) { const a = 2 * PI * i / n; P0.push([r1 * Math.cos(a), r1 * Math.sin(a)]); } for (let i = n; i >= 0; i--) { const a = 2 * PI * i / n; P0.push([r0 * Math.cos(a), r0 * Math.sin(a)]); } return P0; }
  const ellP = (cx, cy, rx, ry, n) => Array.from({ length: n || 28 }, (_, i) => { const a = 2 * PI * i / (n || 28); return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
  const circP = (cx, cy, r, n) => ellP(cx, cy, r, r, n || 40);
  // timber in section (rectangle with diagonal cross = the "timber" convention); existing by default
  function timberX(v, x, y, w, h, L) { v.rect(x, y, w, h, L || 'S-EXIST'); v.line(x, y, x + w, y + h, L || 'S-EXIST'); v.line(x, y + h, x + w, y, L || 'S-EXIST'); }
  // log stringer / pile seen end-on (circle, existing)
  const logEnd = (v, x, y, r, L) => v.circ(x, y, r, L || 'S-EXIST');

  // ------------------------------------------------------------------ auto layout: views drawn about their own origins, flowed left to right
  // (top aligned, wrapping at maxW paper mm) with each view's title under it, then notes, then the main captions under everything.
  function shiftE(e, dx, dy) { const f = q => [q[0] + dx, q[1] + dy]; if (e.a) e.a = f(e.a); if (e.b) e.b = f(e.b); if (e.c) e.c = f(e.c); if (e.p) e.p = Array.isArray(e.p[0]) ? e.p.map(f) : f(e.p); }
  function Lay(maxW) { this.G = []; this.cap = []; this.nt = null; this.maxW = maxW || 470; this.extra = []; }
  Lay.prototype.view = function (s) { const g = { B: new Builder(), t: null }; this.G.push(g); return new View(g.B, s, 0, 0); };
  // title for the view just created; a second call (or a call before any view) adds a main caption under the whole detail
  Lay.prototype.title = function (s, scale, sub, opt) { const g = this.G[this.G.length - 1]; if (!g || g.t) this.cap.push([s, scale, sub, opt]); else g.t = [s, scale, sub, opt]; };
  // main caption (bullet title) under the whole detail
  Lay.prototype.caption = function (s, scale, sub, opt) { this.cap.push([s, scale, sub, Object.assign({ main: true }, opt || {})]); };
  Lay.prototype.notes = function (lines, w, head) { this.nt = [lines, min(w || 120, 190), head]; };
  // a free block (notes box, table…) built on its own Builder: fn(B) draws about (0,0) going down/right
  Lay.prototype.block = function (fn) { const B = new Builder(); fn(B); this.G.push({ B, t: null }); };
  Lay.prototype.break = function () { this.G.push({ brk: true }); };
  Lay.prototype.done = function () {
    const out = [], gap = 22; let x = 0, y = 0, rowH = 0;
    const parts = this.G.map(g => { if (g.brk) return 'BRK'; const E = g.B.E; if (g.t) { const bb = bbox(E), tb = new Builder(); tb.title((bb.x0 + bb.x1) / 2, bb.y0 - 8, g.t[0], g.t[1], g.t[2], g.t[3]); E.push(...tb.E); } return E; });
    if (this.nt) { const nb = new Builder(); nb.notes(0, 0, this.nt[0], this.nt[1], this.nt[2]); parts.push(nb.E); }
    parts.forEach(E => { if (E === 'BRK') { if (x > 0) { y -= rowH + gap; x = 0; rowH = 0; } return; } if (!E.length) return; const bb = bbox(E), w = bb.x1 - bb.x0, h = bb.y1 - bb.y0; if (x > 0 && x + w > this.maxW) { y -= rowH + gap; x = 0; rowH = 0; } E.forEach(e => shiftE(e, x - bb.x0, y - bb.y1)); out.push(...E); x += w + gap; rowH = max(rowH, h); });
    const ob = bbox(out); let cy = ob.y0 - 12; this.cap.forEach(c => { const tb = new Builder(); const o = c[3] || {}; tb.title((ob.x0 + ob.x1) / 2, cy, c[0], c[1], c[2], o); out.push(...tb.E); cy -= 14 + (c[2] ? String(c[2]).split('\n').length * 3.4 : 0); });
    return out;
  };

  // ------------------------------------------------------------------ the library
  const GEN = {};
  const DEF = [];
  function def(id, cat, name, ref, params, fn, info) { const i = DEF.findIndex(d => d.id === id); const d = { id, cat, name, ref, params, info: info || '' }; if (i >= 0) DEF[i] = d; else DEF.push(d); GEN[id] = fn; }
  const P = (k, n, v, o) => Object.assign({ k, n, v }, o || {});
  function generate(id, params) { const d = DEF.find(q => q.id === id); if (!d) return []; const p = {}; d.params.forEach(q => { p[q.k] = params && params[q.k] != null ? params[q.k] : q.v; }); return GEN[id](p); }
  function bbox(E) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    E.forEach(e => { if (e.t === 'line') { add(...e.a); add(...e.b); } else if (e.t === 'pl' || e.t === 'hatch' || e.t === 'solid') e.p.forEach(q => add(...q)); else if (e.t === 'circle') { add(e.c[0] - e.r, e.c[1] - e.r); add(e.c[0] + e.r, e.c[1] + e.r); } else if (e.t === 'arc') { let a0 = e.a0, a1 = e.a1; while (a1 <= a0) a1 += 360; for (let a = a0; a < a1; a += 5) add(e.c[0] + e.r * Math.cos(a * PI / 180), e.c[1] + e.r * Math.sin(a * PI / 180)); add(e.c[0] + e.r * Math.cos(a1 * PI / 180), e.c[1] + e.r * Math.sin(a1 * PI / 180)); } else if (e.t === 'text') { const w = e.s.length * e.h * 0.7, x = e.al === 'c' ? e.p[0] - w / 2 : e.al === 'r' ? e.p[0] - w : e.p[0]; add(x, e.p[1] - (e.v === 't' ? e.h : e.v === 'm' ? e.h / 2 : 0)); add(x + w, e.p[1] + (e.v === 't' ? 0 : e.v === 'm' ? e.h / 2 : e.h)); } });
    return x0 > x1 ? { x0: 0, y0: 0, x1: 1, y1: 1 } : { x0, y0, x1, y1 }; }
  // repair families suggested by the timber assessment (ids are filtered to those registered — see TDET.suggest)
  const SUGGEST = {
    stringer: ['sbf', 'stf', 'pn3101', 'pn3104', 'pn3106', 'pn3108', 'scs', 'pn3112', 'asr', 'pn3115', 'pn3117', 'pn3119', 'pn3120', 'stb', 'pn3122', 'pn3123', 'ssp', 'cr1'],
    pierPile: ['pp2a', 'pp1', 'pn2105', 'pn2107', 'pn2110', 'pn2111', 'pn2112', 'pn2113', 'pn2114', 'pp4', 'pp4c', 'pps', 'spb', 'pn2118', 'pb3', 'pn2101', 'pphc1', 'pn2132'],
    abutPile: ['ap1a', 'ap2', 'pn2120', 'pn2122', 'pn2125', 'atA', 'atBC', 'atDE', 'atFG', 'ahc', 'prs', 'dsp', 'pn2131', 'pn2133'],
    halfcap: ['phs', 'phc2', 'phr', 'pn2303', 'pn2307', 'pn2309', 'phw', 'pn2313', 'pn2317', 'pn2317a', 'pn2323', 'ahs', 'afr', 'hcr', 'hcb', 'pn2328', 'hcch1'],
    bearing: ['hcb', 'pn2328', 'pn2329', 'phs', 'spb', 'pn2119', 'phc2'],
    wing: ['ww1', 'ww2', 'ww3', 'pn2126', 'pn2127', 'pn2128', 'wwx'],
    sheeting: ['shc', 'sht1', 'sht2', 'pn2201', 'pn2202', 'scr', 'srb', 'srr', 'pn2206'],
    planks: ['stf', 'ovl', 'pn3202', 'kdp', 'pn3207', 'cj', 'pn3212', 'slb', 'exa', 'pn4207']
  };
  const api = { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, LAYERS, TH, Builder, View, Lay, def, P, bbox, shiftE,
    iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd };
  G.TDET = { DEF, generate, bbox, LAYERS, SEC, SUGGEST, Builder, api };
})(typeof window !== 'undefined' ? window : globalThis);
