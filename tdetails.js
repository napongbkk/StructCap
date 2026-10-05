/* StructCap Timber — library of standard timber bridge repair details (parametric, vector).
   Redrawn after the MRWA Structures Engineering project standard drawings 1330-0001 … 1330-0027
   (pier / abutment / wing wall pile repairs, sheeting, spiking rail, halfcap strengthening and bearing,
   stringer replacement connections, splices, corbels, halfcap replacement). Each generator returns entities in
   PAPER millimetres; each view is drawn at its own scale (1:5, 1:10, 1:20) and labelled.
   Entity types: line, pl (polyline), circle, arc, text, solid (filled triangle), hatch (boundary + pattern). y is up. */
(function (G) {
  'use strict';
  const PI = Math.PI, sq = Math.sqrt, abs = Math.abs, max = Math.max, min = Math.min;
  // ------------------------------------------------------------------ steel sections (mm): d, bf, tf, tw
  const SEC = {
    '200UC52': { k: 'I', d: 206, b: 204, tf: 12.5, tw: 8.0 }, '250UC73': { k: 'I', d: 254, b: 254, tf: 14.2, tw: 8.6 }, '250UC90': { k: 'I', d: 260, b: 256, tf: 17.3, tw: 10.5 }, '310UC97': { k: 'I', d: 308, b: 305, tf: 15.4, tw: 9.9 },
    '310UB46': { k: 'I', d: 307, b: 166, tf: 11.8, tw: 6.7 }, '410UB54': { k: 'I', d: 403, b: 178, tf: 10.9, tw: 7.6 }, '410UB60': { k: 'I', d: 406, b: 178, tf: 12.8, tw: 7.8 }, '460UB67': { k: 'I', d: 454, b: 190, tf: 12.7, tw: 8.5 },
    '125PFC': { k: 'C', d: 125, b: 65, tf: 7.5, tw: 4.7 }, '150PFC': { k: 'C', d: 150, b: 75, tf: 9.5, tw: 6.0 }, '180PFC': { k: 'C', d: 180, b: 75, tf: 11.0, tw: 6.0 }, '200PFC': { k: 'C', d: 200, b: 75, tf: 12.0, tw: 6.0 },
    '250PFC': { k: 'C', d: 250, b: 90, tf: 15.0, tw: 8.0 }, '300PFC': { k: 'C', d: 300, b: 90, tf: 16.0, tw: 8.0 }, '380PFC': { k: 'C', d: 380, b: 100, tf: 17.5, tw: 10.0 }
  };
  const UCs = ['200UC52', '250UC73', '250UC90', '310UC97'], UBs = ['310UB46', '410UB54', '410UB60', '460UB67'], PFCs = ['125PFC', '150PFC', '180PFC', '200PFC', '250PFC', '300PFC', '380PFC'];
  const secName = s => s.replace(/(\d+)(UC|UB|PFC)(\d*)/, (m, a, b, c) => a + ' ' + b + (c ? ' ' + c : ''));

  // ------------------------------------------------------------------ builder
  const LAYERS = {
    'S-NEW': { c: 4, lt: 'CONTINUOUS', lw: 0.5, n: 'Proposed steel / timber' }, 'S-EXIST': { c: 8, lt: 'DASHED', lw: 0.25, n: 'Existing structure' }, 'S-CONC': { c: 2, lt: 'CONTINUOUS', lw: 0.35, n: 'Concrete' },
    'S-REO': { c: 1, lt: 'CONTINUOUS', lw: 0.35, n: 'Reinforcement' }, 'S-HATCH': { c: 9, lt: 'CONTINUOUS', lw: 0.13, n: 'Hatching' }, 'S-TEXT': { c: 7, lt: 'CONTINUOUS', lw: 0.25, n: 'Notes and labels' },
    'S-DIM': { c: 3, lt: 'CONTINUOUS', lw: 0.18, n: 'Dimensions' }, 'S-CL': { c: 6, lt: 'CENTER', lw: 0.18, n: 'Centre lines' }, 'S-GROUND': { c: 32, lt: 'CONTINUOUS', lw: 0.35, n: 'Ground / water' },
    'S-TITLE': { c: 7, lt: 'CONTINUOUS', lw: 0.35, n: 'Titles' }, 'S-BORDER': { c: 7, lt: 'CONTINUOUS', lw: 0.7, n: 'Border and title block' }, 'S-BOLT': { c: 5, lt: 'CONTINUOUS', lw: 0.35, n: 'Bolts, rods, anchors' }
  };
  function Builder() { this.E = []; }
  Builder.prototype.view = function (s, ox, oy) { return new View(this, s, ox, oy); };
  function View(B, s, ox, oy) { this.B = B; this.s = s; this.ox = ox; this.oy = oy; }
  const VP = View.prototype;
  VP.P = function (x, y) { return [this.ox + x / this.s, this.oy + y / this.s]; };
  VP.add = function (e) { this.B.E.push(e); return e; };
  VP.line = function (x1, y1, x2, y2, L) { return this.add({ t: 'line', a: this.P(x1, y1), b: this.P(x2, y2), L: L || 'S-NEW' }); };
  VP.pl = function (pts, closed, L) { return this.add({ t: 'pl', p: pts.map(q => this.P(q[0], q[1])), closed: !!closed, L: L || 'S-NEW' }); };
  VP.rect = function (x, y, w, h, L) { return this.pl([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, L); };
  VP.circ = function (x, y, r, L) { return this.add({ t: 'circle', c: this.P(x, y), r: r / this.s, L: L || 'S-NEW' }); };
  VP.arc = function (x, y, r, a0, a1, L) { return this.add({ t: 'arc', c: this.P(x, y), r: r / this.s, a0, a1, L: L || 'S-NEW' }); };
  VP.hatch = function (pts, pat, L, sc) { return this.add({ t: 'hatch', p: pts.map(q => this.P(q[0], q[1])), pat: pat || 'ansi31', sc: sc || 1, L: L || 'S-HATCH' }); };
  // text in paper mm height h at a model point; al: l/c/r, v: b/m/t
  VP.text = function (x, y, s, h, al, v, L, ang) { const p = this.P(x, y); return this.add({ t: 'text', p, s: String(s), h: h || 2.5, al: al || 'l', v: v || 'b', ang: ang || 0, L: L || 'S-TEXT' }); };
  VP.ptext = function (px, py, s, h, al, v, L) { return this.add({ t: 'text', p: [px, py], s: String(s), h: h || 2.5, al: al || 'l', v: v || 'b', ang: 0, L: L || 'S-TEXT' }); };
  // leader: arrow at the first point (model), text placed beside the last point, offset in paper mm (dx, dy)
  VP.leader = function (x, y, dx, dy, s, opt) {
    opt = opt || {}; const a = this.P(x, y), b = [a[0] + dx, a[1] + dy], right = dx >= 0, lines = String(s).split('\n'), h = opt.h || 2.2, gap = 1.2, tl = max(...lines.map(l => l.length)) * h * 0.62;
    const c = [b[0] + (right ? 3 : -3), b[1]];
    this.add({ t: 'pl', p: [a, b, c], closed: false, L: 'S-TEXT' });
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), al = 2.2, aw = 0.7;
    this.add({ t: 'solid', p: [a, [a[0] + al * Math.cos(ang) - aw * Math.sin(ang), a[1] + al * Math.sin(ang) + aw * Math.cos(ang)], [a[0] + al * Math.cos(ang) + aw * Math.sin(ang), a[1] + al * Math.sin(ang) - aw * Math.cos(ang)]], L: 'S-TEXT' });
    lines.forEach((l, i) => this.add({ t: 'text', p: [c[0] + (right ? gap : -gap), c[1] - (i - (lines.length - 1) / 2) * h * 1.45 - h / 2 + (lines.length > 1 ? 0 : 0)], s: l, h, al: right ? 'l' : 'r', v: 'b', ang: 0, L: 'S-TEXT' }));
    return tl;
  };
  // linear dimension between model points; off = paper offset (+ left of a->b), txt overrides the measured value
  VP.dim = function (x1, y1, x2, y2, off, txt, opt) {
    opt = opt || {}; const a = this.P(x1, y1), b = this.P(x2, y2), dx = b[0] - a[0], dy = b[1] - a[1], L = sq(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, o = off == null ? 6 : off;
    const a2 = [a[0] + nx * o, a[1] + ny * o], b2 = [b[0] + nx * o, b[1] + ny * o], ext = o > 0 ? 1.5 : -1.5;
    this.add({ t: 'line', a: [a[0] + nx * (o > 0 ? 1 : -1), a[1] + ny * (o > 0 ? 1 : -1)], b: [a2[0] + nx * ext, a2[1] + ny * ext], L: 'S-DIM' });
    this.add({ t: 'line', a: [b[0] + nx * (o > 0 ? 1 : -1), b[1] + ny * (o > 0 ? 1 : -1)], b: [b2[0] + nx * ext, b2[1] + ny * ext], L: 'S-DIM' });
    this.add({ t: 'line', a: [a2[0] - ux * 1.5, a2[1] - uy * 1.5], b: [b2[0] + ux * 1.5, b2[1] + uy * 1.5], L: 'S-DIM' });
    [a2, b2].forEach(p => this.add({ t: 'line', a: [p[0] - (ux + nx) * 0.9, p[1] - (uy + ny) * 0.9], b: [p[0] + (ux + nx) * 0.9, p[1] + (uy + ny) * 0.9], L: 'S-DIM' })); // oblique ticks
    const real = Math.round(sq(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))), s = txt != null ? txt : String(real);
    let ang = Math.atan2(uy, ux) * 180 / PI; if (ang > 90.01 || ang <= -90) ang += 180; ang = Math.round(ang * 100) / 100; if (ang > 180) ang -= 360;
    const m = [(a2[0] + b2[0]) / 2 + nx * 0.8 * Math.sign(o || 1), (a2[1] + b2[1]) / 2 + ny * 0.8 * Math.sign(o || 1)];
    this.add({ t: 'text', p: m, s, h: opt.h || 2.0, al: 'c', v: Math.sign(o || 1) * ny >= 0 || abs(ny) < 1e-6 ? 'b' : 't', ang, L: 'S-DIM' });
  };
  VP.cl = function (x1, y1, x2, y2, lbl) { this.line(x1, y1, x2, y2, 'S-CL'); if (lbl) { const p = this.P(x2, y2); this.add({ t: 'text', p: [p[0], p[1] + 1.2], s: '℄ ' + lbl, h: 2.2, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); } };
  // break line (zigzag) across from (x1,y1) to (x2,y2)
  VP.brk = function (x1, y1, x2, y2, L) { const dx = x2 - x1, dy = y2 - y1, len = sq(dx * dx + dy * dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux, z = 4 * this.s, m = [(x1 + x2) / 2, (y1 + y2) / 2]; this.pl([[x1 - ux * z, y1 - uy * z], [m[0] - ux * z, m[1] - uy * z], [m[0] - ux * z / 2 + nx * z, m[1] - uy * z / 2 + ny * z], [m[0] + ux * z / 2 - nx * z, m[1] + uy * z / 2 - ny * z], [m[0] + ux * z, m[1] + uy * z], [x2 + ux * z, y2 + uy * z]], false, L || 'S-TEXT'); };
  // wavy end of a timber pile (the conventional "rounded break")
  VP.pileEnd = function (x, y, D, L) { const r = D / 4; this.arc(x - r, y, r, 180, 360, L || 'S-EXIST'); this.arc(x + r, y, r, 0, 180, L || 'S-EXIST'); };
  VP.ground = function (x1, x2, y, lbl) { this.line(x1, y, x2, y, 'S-GROUND'); const s = 2.5 * this.s; for (let x = x1 + s / 2; x < x2; x += s) this.line(x, y, x - s * 0.7, y - s * 0.7, 'S-GROUND'); if (lbl) { const p = this.P(x2, y); this.add({ t: 'text', p: [p[0] + 2, p[1] + 1], s: lbl, h: 2.2, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); } };
  VP.wl = function (x, y, lbl) { const p = this.P(x, y); this.add({ t: 'solid', p: [p, [p[0] - 2, p[1] + 2.6], [p[0] + 2, p[1] + 2.6]], L: 'S-GROUND' }); this.add({ t: 'line', a: [p[0] - 6, p[1]], b: [p[0] + 6, p[1]], L: 'S-GROUND' }); if (lbl) this.add({ t: 'text', p: [p[0] + 4, p[1] + 1], s: lbl, h: 2.2, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); };
  // section marker (circle with letter) and view title
  VP.mark = function (x, y, ch, dir) { const p = this.P(x, y); this.add({ t: 'circle', c: p, r: 3, L: 'S-TEXT' }); this.add({ t: 'text', p, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); if (dir) { const a = dir * PI / 180; this.add({ t: 'solid', p: [[p[0] + 5.5 * Math.cos(a), p[1] + 5.5 * Math.sin(a)], [p[0] + 3 * Math.cos(a + 0.6), p[1] + 3 * Math.sin(a + 0.6)], [p[0] + 3 * Math.cos(a - 0.6), p[1] + 3 * Math.sin(a - 0.6)]], L: 'S-TEXT' }); } };
  Builder.prototype.title = function (x, y, s, scale, sub) { const tw = s.length * 3.5 * 0.62; this.E.push({ t: 'text', p: [x, y], s, h: 3.5, al: 'c', v: 'b', ang: 0, L: 'S-TITLE' }); this.E.push({ t: 'line', a: [x - tw / 2, y - 1.2], b: [x + tw / 2, y - 1.2], L: 'S-TITLE' }); let yy = y - 5; if (sub) { sub.split('\n').forEach(l => { this.E.push({ t: 'text', p: [x, yy], s: l, h: 2.2, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.5; }); } if (scale) this.E.push({ t: 'text', p: [x, yy], s: 'SCALE 1:' + scale, h: 2.2, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); };
  Builder.prototype.notes = function (x, y, lines, w) { this.E.push({ t: 'text', p: [x, y], s: 'NOTES:', h: 2.8, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); let yy = y - 5; lines.forEach((l, i) => { const words = l.split(' '), rows = []; let cur = ''; words.forEach(wd => { if ((cur + ' ' + wd).length * 2.2 * 0.7 > (w || 120) && cur) { rows.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; }); rows.push(cur); rows.forEach((r, k) => { this.E.push({ t: 'text', p: [x + (k ? 6 : 0), yy], s: (k ? '' : (i + 1) + '.  ') + r, h: 2.2, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.4; }); }); return yy; };
  Builder.prototype.table = function (x, y, cols, rows, h) { h = h || 2.2; let yy = y; const W = cols.reduce((a, c) => a + c.w, 0), all = [cols.map(c => c.n)].concat(rows), ys = [y];
    all.forEach((r, i) => { const nl = Math.max(...r.map(c => String(c).split('\n').length)), rh = nl * h * 1.45 + h * 1.1; let xx = x; r.forEach((cell, j) => { const L = String(cell).split('\n'); L.forEach((l, k) => this.E.push({ t: 'text', p: [xx + cols[j].w / 2, yy - rh / 2 + (L.length - 1) * h * 0.725 - k * h * 1.45], s: l, h: i ? h : h * 0.95, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' })); xx += cols[j].w; }); this.E.push({ t: 'line', a: [x, yy], b: [x + W, yy], L: 'S-TEXT' }); yy -= rh; ys.push(yy); });
    this.E.push({ t: 'line', a: [x, yy], b: [x + W, yy], L: 'S-TEXT' }); let xx = x; [0].concat(cols.map(c => c.w)).forEach(w => { xx += w; this.E.push({ t: 'line', a: [xx, y], b: [xx, yy], L: 'S-TEXT' }); }); return yy; };

  // ------------------------------------------------------------------ structural shapes (model mm in a view)
  // I section in cross-section, centred, web vertical (rot 0) or horizontal (rot 90)
  function iSec(v, cx, cy, s, rot, L) { const d = s.d, b = s.b, tf = s.tf, tw = s.tw, P = [[-b / 2, -d / 2], [b / 2, -d / 2], [b / 2, -d / 2 + tf], [tw / 2, -d / 2 + tf], [tw / 2, d / 2 - tf], [b / 2, d / 2 - tf], [b / 2, d / 2], [-b / 2, d / 2], [-b / 2, d / 2 - tf], [-tw / 2, d / 2 - tf], [-tw / 2, -d / 2 + tf], [-b / 2, -d / 2 + tf]]; v.pl(P.map(p => (rot ? [cx + p[1], cy + p[0]] : [cx + p[0], cy + p[1]])), true, L || 'S-NEW'); }
  // channel in cross-section: web vertical at x = cx, toes pointing +x (dir 1) or -x (dir -1)
  function cSec(v, cx, cy, s, dir, L) { const d = s.d, b = s.b, tf = s.tf, tw = s.tw, k = dir || 1, P = [[0, -d / 2], [b, -d / 2], [b, -d / 2 + tf], [tw, -d / 2 + tf], [tw, d / 2 - tf], [b, d / 2 - tf], [b, d / 2], [0, d / 2]]; v.pl(P.map(p => [cx + k * p[0], cy + p[1]]), true, L || 'S-NEW'); }
  // equal / unequal angle in cross-section with heel at (x, y); legs along +x*dx and +y*dy
  function aSec(v, x, y, a, b, t, dx, dy, L) { dx = dx || 1; dy = dy || 1; v.pl([[x, y], [x + dx * a, y], [x + dx * a, y + dy * t], [x + dx * t, y + dy * t], [x + dx * t, y + dy * b], [x, y + dy * b]], true, L || 'S-NEW'); }
  // I member in elevation seen on the flange (width b) between y0..y1 at centre x
  function iElevFlange(v, x, y0, y1, s, L) { v.rect(x - s.b / 2, y0, s.b, y1 - y0, L || 'S-NEW'); v.line(x - s.tw / 2, y0, x - s.tw / 2, y1, 'S-EXIST'); v.line(x + s.tw / 2, y0, x + s.tw / 2, y1, 'S-EXIST'); }
  // I member in elevation seen on the web (depth d), vertical between y0..y1 or horizontal x0..x1
  function iElevWebV(v, x, y0, y1, s, L) { v.rect(x - s.d / 2, y0, s.d, y1 - y0, L || 'S-NEW'); v.line(x - s.d / 2 + s.tf, y0, x - s.d / 2 + s.tf, y1, L || 'S-NEW'); v.line(x + s.d / 2 - s.tf, y0, x + s.d / 2 - s.tf, y1, L || 'S-NEW'); }
  function iElevWebH(v, x0, x1, y, s, L) { v.rect(x0, y - s.d / 2, x1 - x0, s.d, L || 'S-NEW'); v.line(x0, y - s.d / 2 + s.tf, x1, y - s.d / 2 + s.tf, L || 'S-NEW'); v.line(x0, y + s.d / 2 - s.tf, x1, y + s.d / 2 - s.tf, L || 'S-NEW'); }
  // timber pile in elevation (existing, dashed) from y0 (bottom, wavy end) to y1
  function pileElev(v, x, y0, y1, D, L) { v.line(x - D / 2, y0, x - D / 2, y1, L || 'S-EXIST'); v.line(x + D / 2, y0, x + D / 2, y1, L || 'S-EXIST'); v.pileEnd(x, y0, D, L || 'S-EXIST'); }
  // threaded rod through (x1,y1)-(x2,y2) with nuts + washers
  function rod(v, x1, y1, x2, y2, w) { v.line(x1, y1, x2, y2, 'S-BOLT'); const dx = x2 - x1, dy = y2 - y1, L = sq(dx * dx + dy * dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux, ww = (w || 65) / 2; [[x1, y1, -1], [x2, y2, 1]].forEach(([x, y, k]) => { v.line(x + nx * ww, y + ny * ww, x - nx * ww, y - ny * ww, 'S-BOLT'); v.rect(x + ux * k * 5 - 15, y + uy * k * 5 - 15, 30, 30, 'S-BOLT'); }); }
  function boltSym(v, x, y, d) { v.circ(x, y, (d || 20) / 2, 'S-BOLT'); v.line(x - d * 0.9, y, x + d * 0.9, y, 'S-BOLT'); v.line(x, y - d * 0.9, x, y + d * 0.9, 'S-BOLT'); }
  // concrete pot / block outline with concrete hatch
  function concBox(v, pts) { v.pl(pts, true, 'S-CONC'); v.hatch(pts, 'conc', 'S-HATCH'); }

  // ------------------------------------------------------------------ the library
  const GEN = {};
  const DEF = [];
  function def(id, cat, name, ref, params, fn, info) { DEF.push({ id, cat, name, ref, params, info: info || '' }); GEN[id] = fn; }
  const P = (k, n, v, o) => Object.assign({ k, n, v }, o || {});

  // 1 GENERAL NOTES
  def('gn', 'General', 'General notes & bar lap table', '1330-0001', [P('proj', 'Concrete class', 'S40'), P('cover', 'Clear cover (mm)', 40, { num: 1 })], (p) => {
    const B = new Builder();
    const y = B.notes(0, 0, ['ALL WORKS SHALL BE CARRIED OUT IN ACCORDANCE WITH THE SPECIFICATION AND THE OCCUPATIONAL SAFETY AND HEALTH ACT 1984.', 'NO CHANGES TO DESIGN DETAILS SHALL BE ADOPTED DURING CONSTRUCTION WITHOUT WRITTEN APPROVAL OF THE ENGINEER.', 'DIMENSIONS SHALL NOT BE SCALED FROM THE DRAWINGS. ALL DIMENSIONS IN MILLIMETRES AND LEVELS IN METRES UNLESS NOTED OTHERWISE.',
      'CONCRETE SHALL BE CLASS ' + p.proj + ' UNLESS OTHERWISE SPECIFIED. ALL EXPOSED CORNERS SHALL HAVE A 20x20 CHAMFER.', 'CLEAR COVER TO REINFORCEMENT SHALL BE ' + p.cover + 'mm UNLESS OTHERWISE SHOWN. SL - 500 MPa MESH, N - 500 MPa BARS, R - 250 MPa PLAIN BARS TO AS/NZS 4671.',
      'WELDING TO AS/NZS 1554 SP. BOLTS AND THREADED RODS GRADE 8.8 TO AS/NZS 1252 UNO. THREADED RODS DIAMETER 20 GRADE 300 UNO.', 'AFTER FABRICATION ALL STEELWORK SHALL BE HOT-DIP GALVANISED (AS 1214 FOR FASTENERS, AS/NZS 4680 OTHERS). DAMAGED GALVANISING SHALL BE MADE GOOD BY COLD GALVANISING.',
      'STRUCTURAL SECTIONS GRADE 300 MIN, HOLLOW SECTIONS C350 MIN, PLATE GRADE 250 MIN, FLATS GRADE 300 MIN. FABRICATION TO AS 4100.', 'ALL NEW BOLTS THROUGH TIMBER SHALL BE COATED WITH DENSOPASTE; EXPOSED THREADS AND NUTS COATED AFTER TIGHTENING.', 'ENDS OF ALL NEWLY CUT TIMBER SHALL RECEIVE END GRAIN TREATMENT. HOLES WITHOUT BOLTS WITHIN 1.5 m OF GROUND OR WATER LINE SHALL BE FILLED WITH CONBEXTRA EP GROUT OR SIMILAR APPROVED.',
      'PILE DRIVING TOLERANCES: VERTICAL ±15 mm IN A 3 m TEMPLATE, PLAN 50 mm ANY DIRECTION, CUT OFF LEVEL ±5 mm. STEEL PILING TO 3 m BELOW GROUND SHALL BE GALVANISED.'], 190);
    B.title(85, y - 8, 'GENERAL NOTES', null, 'AFTER MRWA STD DRG 1330-0001');
    const ty = B.table(205, 0, [{ n: 'BAR DIAMETER, D', w: 30 }, { n: 'MIN LAP, HORIZ. BARS\nWITH >300mm CONC. BELOW', w: 45 }, { n: 'MIN LAP LENGTH\nOTHER CASES', w: 35 }], [['D ≤ 24mm', '60D', '45D'], ['D > 24mm', '65D', '50D']], 2.2);
    B.title(260, ty - 7, 'TABLE 1 - BAR LAP LENGTHS');
    return B.E;
  });

  // 2 PIER PILE REPAIR FOUNDATION TYPE 2A (bolted, 1330-0002)
  def('pp2a', 'Piles', 'Pier pile repair foundation – Type 2A', '1330-0002', [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('D', 'Existing pile dia. (mm)', 400, { num: 1 }), P('pot', 'Pot diameter (mm)', 900, { num: 1 }), P('depth', 'Pot depth (mm)', 1250, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], D = +p.D || 400, R = (+p.pot || 900) / 2, H = +p.depth || 1250;
    // ELEVATION 1:20, origin at top of pot / ground
    const v = B.view(20, 60, 110), gl = 0, top = 150, cut = top - 250;
    concBox(v, [[-R, top - H], [R, top - H], [R, top], [-R, top]]);
    v.ground(-R - 500, -R, gl); v.ground(R, R + 500, gl); v.wl(R + 900, gl, 'EXISTING G.L., PERMANENT WATER LEVEL OR HIGH TIDE LEVEL');
    pileElev(v, 0, top - H - 600, cut, D);
    iElevFlange(v, 0, cut + 12, top + 1300, s); v.rect(-125, cut, 250, 12, 'S-NEW');
    v.line(0, cut - 250, 0, cut, 'S-BOLT'); // spike
    [top - H + 75, top - 75].forEach(y => v.line(-R + 75, y, R - 75, y, 'S-REO')); v.pl([[-R + 75, top - H + 75], [-R + 75, top - 75]], false, 'S-REO'); v.pl([[R - 75, top - H + 75], [R - 75, top - 75]], false, 'S-REO');
    v.dim(-R, top - H, -R, top, 8, H + ' MIN.'); v.dim(R, gl, R, top, -8, '150 MIN.'); v.dim(-R + 75, cut - 375, -R + 75, cut + 375, 18, '750'); v.dim(R, cut, R, gl, -16, '250 MIN.');
    v.leader(0, top + 900, 22, 6, 'PROPOSED ' + secName(p.uc) + ' PILE'); v.leader(-D / 2, cut - 40, -26, 22, 'CUT BACK PILE TO\nSOUND TIMBER'); v.leader(R - 75, top - 300, 22, -10, 'N16 HOOP BARS AT\nTOP & BOTTOM (500 LAP)'); v.leader(-R + 75, top - 600, -24, -6, 'SL81 FABRIC'); v.leader(0, cut - 200, -30, -18, 'φ10 x 250 LONG\nSPIKE (TYP.)'); v.leader(-R, top - H + 100, -14, -10, '75 COVER (TYP.)');
    v.text(0, top - H - 160, '', 2);
    B.title(60, 5, 'PIER PILE REPAIR FOUNDATION DETAIL - TYPE 2A', 20);
    // SECTION A 1:10
    const w = B.view(10, 200, 85);
    w.circ(0, 0, R, 'S-CONC'); w.circ(0, 0, R - 75, 'S-REO'); w.circ(0, 0, D / 2, 'S-EXIST'); iSec(w, 0, 0, s, 0);
    const ua = 150, big = D >= 350; [-1, 1].forEach(k => { aSec(w, k * (s.b / 2 + 2), -s.d / 2 - 10, 100, 150, 10, k, 1, 'S-NEW'); boltSym(w, k * (s.b / 2 + 50), -s.d / 2 + 30, 20); boltSym(w, k * (s.b / 2 + 50), s.d / 2 - 30, 20); });
    if (big) w.rect(-75, -s.d / 2 - 25, 150, 10, 'S-NEW');
    w.dim(-150, -R - 40, 150, -R - 40, -6, '300 (TYP.)'); w.dim(-70, -R + 30, 70, -R + 30, -4, '140 (TYP.)');
    w.leader(-R * 0.7, R * 0.7, -18, 10, 'SL81 FABRIC (TYP.)'); w.leader(0, -s.d / 2 - 20, 40, -26, 'ANGLE SHALL BEAR ON\nSOLID TIMBER (TYP.)'); w.leader(s.b / 2 + 50, s.d / 2 - 30, 30, 18, '4-M20 BOLTS (SITE DRILL\nHOLES AFTER SHIM PLACED)'); w.leader(-R, 0, -16, 0, 'φ' + (2 * R) + ' CONCRETE\nFOOTING');
    w.mark(R + 60, 0, 'A');
    B.title(200, 15, 'SECTION A', 10, big ? 'BEARING ARRANGEMENT FOR PILES ≥ φ350' : 'BEARING ARRANGEMENT FOR PILES < φ350');
    B.notes(150, -2, ['BASE OF PROPOSED UC PILE SHALL BE TRIMMED ON SITE TO SUIT.', 'HALF-CAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL POSITIONS UNTIL CONCRETE HAS BEEN PLACED A MINIMUM OF 7 DAYS OR HAS REACHED 30 MPa.', '150x100x10 UA x 300 LONG BEARING ANGLES WITH 4-M20 BOLTS; SHIM 90x90 x THICKNESS TO SUIT BETWEEN UC AND ANGLES.'], 110);
    return B.E;
  }, 'Steel UC stub pile on the cut-back timber pile, cast in a 900 mm concrete pot (bolted angle version).');

  // 3 PIER PILE REPAIR TYPE 4 (4A/4B/4C) + TYPE 5 WRAP (1330-0003)
  def('pp4', 'Piles', 'Pier pile repair – Types 4A/4B/4C & 5', '1330-0003', [P('D', 'Pile diameter (mm)', 400, { num: 1 }), P('zone', 'Deterioration zone (mm)', 1000, { num: 1 })], (p) => {
    const B = new Builder(), D = +p.D || 400, Z = +p.zone || 1000, v = B.view(20, 20, 140);
    const pile = (x, label) => { v.line(x - D / 2, -1600, x - D / 2, 1600, 'S-EXIST'); v.line(x + D / 2, -1600, x + D / 2, 1600, 'S-EXIST'); v.brk(x - D / 2 - 40, 1600, x + D / 2 + 40, 1600); v.brk(x - D / 2 - 40, -1600, x + D / 2 + 40, -1600); v.text(x, -1850, label, 3, 'c', 'b', 'S-TITLE'); };
    pile(0, "TYPE '4A'"); pile(1300, "TYPE '4B'"); pile(2600, "TYPE '4C'");
    for (let y = -400; y <= 400; y += 120) v.line(-D / 2 + 30, y, -D / 2 + 90, y + 50, 'S-EXIST');
    v.leader(-D / 2 + 60, 0, -14, 8, 'SEAL INDIVIDUAL SPLITS\n>10mm WIDTH. FILL EXISTING\nBOLT HOLES WITH EPOXY.');
    v.rect(1300 - D / 2 - 8, -350, D + 16, 900, 'S-NEW'); v.hatch([[1300 - D / 2 - 8, -350], [1300 + D / 2 + 8, -350], [1300 + D / 2 + 8, 550], [1300 - D / 2 - 8, 550]], 'ansi37', 'S-HATCH', 0.5);
    v.leader(1300 + D / 2 + 8, 250, 14, -4, 'WRAP PILE WITH 0.8mm THICK\nCLEAR ACRYLIC & FILL WITH\nAPPROVED EPOXY'); v.wl(1300 + D / 2 + 300, 600, 'W.L. (HIGH)'); v.wl(1300 + D / 2 + 300, -50, 'W.L. (LOW)'); v.dim(1300 - D / 2 - 60, -350, 1300 - D / 2 - 60, -50, 8, '300');
    const sx = 2600, g = 60; v.rect(sx - D / 2 - g, -Z / 2 - 750, D + 2 * g, Z + 1500, 'S-NEW'); v.hatch([[sx - D / 2 - g, -Z / 2 - 750], [sx - D / 2, -Z / 2 - 750], [sx - D / 2, Z / 2 + 750], [sx - D / 2 - g, Z / 2 + 750]], 'conc', 'S-HATCH');
    v.dim(sx + D / 2 + g, -Z / 2, sx + D / 2 + g, Z / 2, -10, 'DETERIORATION\nZONE'.split('\n')[0]); v.dim(sx + D / 2 + g, Z / 2, sx + D / 2 + g, Z / 2 + 750, -10, '750'); v.dim(sx + D / 2 + g, -Z / 2 - 750, sx + D / 2 + g, -Z / 2, -10, '750');
    v.leader(sx - D / 2 - g, Z / 2 + 300, -14, 8, 'CONBEXTRA UW\nCEMENTITIOUS GROUT'); v.leader(sx - D / 2 - g, -Z / 2 - 300, -14, -8, '5PL ROLLED STEEL SLEEVE\n(REFER SLEEVE DETAIL)');
    B.title(80, 25, 'PIER PILE REPAIR DETAIL - TYPE 4', 20, 'FOR PREPARATION OF PILE SURFACE FOR GROUTING REFER NOTES');
    const t4y = B.table(170, 230, [{ n: 'TYPE', w: 18 }, { n: 'EXISTING TIMBER CONDITION', w: 62 }, { n: 'SECTION', w: 28 }, { n: 'WORK REQUIRED', w: 62 }], [['4A', 'GOOD, SURFACE SPLITS 5-15mm\nNOT INTERCONNECTING', '90% AREA', 'WATER JET, EPOXY FILL\nBOLT HOLES, SEAL SPLITS'], ['4B', 'MORE LOSS AT WALER BOLTS\nAND PIPE, ANNULUS > 90mm', '70% AREA', 'WATER JET, 0.8mm ACRYLIC\nWRAP + EPOXY'], ['4C', 'INTERCONNECTED LOSS,\nANNULUS < 80mm', 'MIN 250x250\nSOLID CORE', 'STEEL SLEEVE + CONBEXTRA\nUW GROUT'], ['4D', 'CANNOT CARRY DEAD LOAD', '< 250x250', 'REPLACE ZONE WITH UC +\nSLEEVE (ENGINEER)']], 2.0);
    B.title(255, t4y - 7, 'TABLE OF TYPES OF PIER PILE REPAIRS - TYPE 4');
    // type 5
    const w = B.view(20, 200, 45); w.line(-D / 2, -700, -D / 2, 900, 'S-EXIST'); w.line(D / 2, -700, D / 2, 900, 'S-EXIST'); w.rect(-D / 2 - 6, -500, D + 12, 1100, 'S-NEW');
    for (let y = -480; y < 600; y += 90) w.line(-D / 2 - 6, y, D / 2 + 6, y + 60, 'S-HATCH');
    w.wl(D / 2 + 250, 300, 'PERMANENT WATER LEVEL\nOR HIGH TIDE LEVEL'.split('\n')[0]); w.ground(D / 2 + 6, D / 2 + 600, 0, 'EXISTING GROUND LEVEL'); w.dim(-D / 2 - 40, 300, -D / 2 - 40, 600, 8, '300'); w.dim(-D / 2 - 40, -500, -D / 2 - 40, 0, 8, '500 MIN.');
    w.leader(D / 2 + 6, 500, 14, 6, 'DENSO WRAP "SEASHIELD SERIES 60\nSYSTEM" OR SIMILAR APPROVED');
    B.title(200, -15, 'PIER PILE REPAIR DETAIL - TYPE 5', 20);
    return B.E;
  });

  // 4 SLEEVE DETAIL TYPE 4C (1330-0003)
  def('pp4c', 'Piles', 'Pile sleeve – Type 4C (sleeve detail)', '1330-0003', [P('D', 'Pile diameter (mm)', 400, { num: 1 }), P('g', 'Grout thickness (40–75 mm)', 50, { num: 1 }), P('rot', 'Rot zone length (mm)', 900, { num: 1 })], (p) => {
    const B = new Builder(), D = +p.D || 400, g = max(40, min(75, +p.g || 50)), Z = +p.rot || 900, Ds = D + 2 * g, v = B.view(20, 50, 150), L = Z + 1500;
    v.line(-D / 2, -L / 2 - 400, -D / 2, L / 2 + 400, 'S-EXIST'); v.line(D / 2, -L / 2 - 400, D / 2, L / 2 + 400, 'S-EXIST');
    v.rect(-Ds / 2, -L / 2, Ds, L, 'S-NEW'); [-L / 2, -Z / 2, Z / 2, L / 2].forEach(y => v.line(-Ds / 2 - 10, y, Ds / 2 + 10, y, 'S-NEW'));
    [-L / 2 + 250, L / 2 - 250].forEach(y => { v.circ(-Ds / 2 - 15, y, 10, 'S-BOLT'); v.circ(Ds / 2 + 15, y, 10, 'S-BOLT'); });
    for (let y = -L / 2 + 40; y < L / 2; y += 65 * 3) [0, 65, 130].forEach(k => y + k < L / 2 && v.circ(0, y + k, 8, 'S-BOLT'));
    v.dim(Ds / 2 + 40, -L / 2, Ds / 2 + 40, L / 2, -12, 'LENGTH TO SUIT'); v.dim(Ds / 2 + 40, -Z / 2, Ds / 2 + 40, Z / 2, -5, 'ROT ZONE'); v.dim(-Ds / 2 - 40, Z / 2, -Ds / 2 - 40, L / 2, 6, '750'); v.dim(-Ds / 2 - 40, -L / 2, -Ds / 2 - 40, -Z / 2, 6, '750');
    v.leader(-Ds / 2, L / 2 - 100, -20, 6, 'M16 8.8 BOLTS (TYP.)'); v.leader(Ds / 2, -L / 2, 22, -6, '50x50x5 EA TOP, BOTTOM & EACH END\nOF ROT ZONE (750 MAX CRS)'); v.leader(-Ds / 2 - 15, -L / 2 + 250, -20, -6, 'COACH SCREW (TYP.)'); v.leader(D / 2, L / 2 + 300, 20, 4, 'EXISTING TIMBER PILE');
    B.title(50, 15, 'SLEEVE DETAIL', 20);
    // SECTION A 1:10
    const w = B.view(10, 175, 110); w.circ(0, 0, D / 2, 'S-EXIST'); w.circ(0, 0, Ds / 2, 'S-NEW'); w.circ(0, 0, Ds / 2 + 5, 'S-NEW'); w.hatch(ringPts(D / 2, Ds / 2), 'conc', 'S-HATCH');
    [[0, 1], [0, -1]].forEach(([x, k]) => { w.rect(-6, k * (Ds / 2) - (k > 0 ? 0 : 50), 6, 50, 'S-NEW'); w.rect(0, k * (Ds / 2) - (k > 0 ? 0 : 50), 6, 50, 'S-NEW'); });
    w.leader(0, Ds / 2 + 2, 18, 12, '5PL SLEEVE (ROLLED STEEL)'); w.leader(-(D / 2 + g / 2), 0, -18, -14, 'CEMENTITIOUS GROUT CONBEXTRA UW\nOR SIMILAR, MIN 40mm, MAX 75mm\nTHICK BETWEEN PILE AND SLEEVE'); w.leader(D / 4, -D / 4, 20, -16, 'EXISTING TIMBER PILE'); w.dim(-Ds / 2, -Ds / 2 - 40, -D / 2, -Ds / 2 - 40, -4, String(g));
    B.title(175, 75, 'SECTION A', 10);
    B.notes(130, 40, ['SITE MEASURE AND FABRICATE SLEEVE WITH DIAMETERS TO SUIT GROUT THICKNESS IN THE RANGE 40 MIN. TO 75 MAX. AROUND PILES.', 'CLEAN OUT DEBRIS AND DECOMPOSED TIMBER WITH HIGH PRESSURE WATER JETTING.', 'EXPOSED TIMBER WITH A "CORK LIKE" DENSITY SHALL BE REMOVED TO EXPOSE WOOD WHICH WHEN DRILLED PRODUCES PARTICLES 2-3 mm LONG, NOT A POWDER.', 'LONGITUDINAL JOINTS 2-50x50x6 EA BOTH SIDES WITH 3-M16 8.8 BOLTS AND 40x5FLx40 WASHERS AT 65 CRS.'], 115);
    return B.E;
  });
  function ringPts(r0, r1) { const P0 = [], n = 48; for (let i = 0; i <= n; i++) { const a = 2 * PI * i / n; P0.push([r1 * Math.cos(a), r1 * Math.sin(a)]); } for (let i = n; i >= 0; i--) { const a = 2 * PI * i / n; P0.push([r0 * Math.cos(a), r0 * Math.sin(a)]); } return P0; }

  // 5 ABUTMENT PILE REPAIR FOUNDATION TYPE 1A (1330-0004)
  def('ap1a', 'Piles', 'Abutment pile repair foundation – Type 1A', '1330-0004', [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('D', 'Existing pile dia. (mm)', 400, { num: 1 }), P('depth', 'Pot depth (mm)', 1250, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], D = +p.D || 400, H = +p.depth || 1250, v = B.view(20, 70, 110), top = 150, cut = top - 250;
    concBox(v, [[-450, top - H], [450, top - H], [450, top], [-450, top]]); v.line(-450 - 75, top - H - 100, -450 - 75, top + 1400, 'S-EXIST'); v.text(-450 - 75, top + 1450, '', 2);
    v.ground(450, 1100, 0, 'EXISTING G.L., PERMANENT\nWATER LEVEL OR HIGH TIDE'.split('\n')[0]);
    pileElev(v, 0, top - H - 600, cut, D); iElevFlange(v, 0, cut + 12, top + 1300, s); v.rect(-75, cut, 150, 10, 'S-NEW');
    [-1, 1].forEach(k => v.line(k * 375, top - H + 75, k * 375, top - 75, 'S-REO')); v.line(-375, top - 75, 375, top - 75, 'S-REO'); v.line(-375, top - H + 75, 375, top - H + 75, 'S-REO');
    v.dim(450, top - H, 450, top, -10, H + ' MIN.'); v.dim(-450, cut - 375, -450, cut + 375, 10, '750'); v.dim(450, 0, 450, top, -24, '150');
    v.leader(0, top + 1000, 22, 6, 'PROPOSED ' + secName(p.uc) + ' PILE'); v.leader(-525, top + 900, -14, 8, 'EXISTING TIMBER\nSHEETING'); v.leader(D / 2, cut - 60, 26, -14, 'CUT BACK PILE TO\nSOUND TIMBER'); v.leader(-375, top - 500, -18, -12, '4-N20 + SL81 FABRIC\n(GALV.)'); v.leader(-450, top - H + 30, -18, -8, '75 COVER (TYP.)'); v.leader(-300, top - H, -14, -14, 'PERMANENT FORMWORK');
    B.title(70, 8, 'ABUTMENT PILE REPAIR FOUNDATION DETAIL - TYPE 1A', 20);
    const w = B.view(20, 205, 105); concBox(w, [[-450, -450], [450, -450], [450, 450], [-450, 450]]); w.line(-450, -500, -450, 500, 'S-EXIST'); w.circ(0, 0, D / 2, 'S-EXIST'); iSec(w, 0, 0, s, 0); [[-375, -375], [375, -375], [375, 375], [-375, 375]].forEach(q => w.circ(q[0], q[1], 10, 'S-REO')); w.pl([[-375, -375], [375, -375], [375, 375], [-375, 375]], true, 'S-REO');
    w.dim(-450, -450, 450, -450, -8, '900'); w.dim(450, -450, 450, 450, -8, '900'); w.leader(-450, 300, -14, 6, 'FRONT FACE OF EXISTING\nTIMBER SHEETING'); w.leader(375, 375, 16, 8, 'SL81 FABRIC (TYP.)'); w.leader(0, D / 2, 18, 22, 'EXISTING TIMBER PILE'); w.leader(-375, -375, -14, -10, '4-N20');
    B.title(205, 82, 'SECTION A', 20);
    B.notes(150, 60, ['CUT BASE OF PROPOSED STEEL PILE TO SUIT ON SITE. REFER PILE REPAIR REQUIREMENTS TABLE ON BRIDGE SPECIFIC DRAWINGS FOR PILE TOP CONNECTION.', 'FULL-CAPS / HALF-CAPS AND ABUTMENT SHEETING SHALL BE PROPPED DURING CONSTRUCTION; PROPS REMOVED ONLY AFTER CONCRETE HAS BEEN PLACED 7 DAYS OR REACHED 30 MPa.', 'STEEL SHIM WIDTH TO SUIT PILE, HEIGHT AND THICKNESS TO SUIT AREA TO BE SHIMMED; SHIMS TACK WELDED TOGETHER AND TO STEEL PILE FLANGE.'], 115);
    return B.E;
  });

  // 6 WING WALL PILE REPAIR TYPE WW1 (1330-0005) — UB pile alongside, in a concrete pot
  def('ww1', 'Wing walls', 'Wing wall pile repair – Type WW1 (UB)', '1330-0005', [P('ub', 'Proposed UB pile', '410UB54', { opts: UBs }), P('H', 'Height to wing wall capping (mm)', 1800, { num: 1 }), P('D', 'Pile dia. (mm)', 350, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.ub] || SEC['410UB54'], H = +p.H || 1800, D = +p.D || 350, v = B.view(20, 60, 85);
    concBox(v, [[-325, -1500], [325, -1500], [325, 150], [-325, 150]]); v.ground(325, 900, 0, 'EXISTING G.L., PERMANENT WATER\nLEVEL OR HIGH TIDE LEVEL'.split('\n')[0]); v.ground(-900, -325, 0);
    v.line(-500, -1600, -500, H + 200, 'S-EXIST'); v.text(-520, H - 200, '', 2); pileElev(v, -500 + D / 2 + 20, -1900, -100, D);
    iElevWebV(v, 0, -1400, H, s); v.rect(-260, H, 520, 160, 'S-EXIST'); v.rect(-560, H - 200, 140, 200, 'S-EXIST');
    for (let y = -1300; y < H - 300; y += 600) rod(v, -560, y, s.d / 2 + 30, y, 65);
    v.dim(325, -1500, 325, 0, -10, '1500 MIN.'); v.dim(325, 0, 325, 150, -22, '150'); v.dim(-325, 0, -325, H, 10, 'HEIGHT TO SUIT U/S\nCAPPING'.split('\n')[0]);
    v.leader(s.d / 2, H * 0.6, 18, 6, 'PROPOSED ' + secName(p.ub) + ' PILE'); v.leader(-500, H * 0.4, -20, 6, 'EXISTING TIMBER\nSHEETING'); v.leader(0, H + 80, 18, 10, 'WING WALL CAPPING'); v.leader(-560, H - 100, -14, 10, 'RETAIN EXISTING SPIKING\nRAIL, NOTCH UB TO SUIT'); v.leader(s.d / 2 + 30, -700, 20, -8, 'φ20 THREADED U-ROD OR\n2 THREADED RODS AT 600 CRS'); v.leader(-325, -800, -16, -12, 'PERMANENT FORMWORK'); v.leader(0, 150, 12, 14, '2% FALL, U2 FINISH');
    B.title(60, -2, 'WING WALL PILE REPAIR DETAIL - TYPE WW1', 20, 'SIDE ELEVATION');
    const w = B.view(10, 200, 95); concBox(w, [[-325, -150 - 40], [325, -150 - 40], [325, 160 + 40], [-325, 160 + 40]]); iSec(w, 0, 0, s, 1); w.circ(-200, -50, D / 2, 'S-EXIST'); w.line(-325, 190, 325, 190, 'S-EXIST');
    w.pl([[-s.d / 2, 60], [-s.d / 2 - 60, 60], [-s.d / 2 - 60, -60], [-s.d / 2, -60]], false, 'S-BOLT');
    w.dim(-325, -190, 325, -190, -6, '650'); w.leader(-200, -50 - D / 2, -16, -12, 'TRIM EXISTING TIMBER PILE TO\nPROVIDE 75 MIN. BEARING FACE\nWITH WEB OF UB (TYP.)'); w.leader(0, s.b / 2 * 0, 22, 18, 'EA WELDED TO UB. PROVIDE φ22\nHOLES FOR THREADED U-ROD'); w.leader(325, 0, 14, -6, 'SL81 FABRIC (TYP.)');
    B.title(200, 68, 'SECTION A', 10);
    B.notes(150, 45, ['WHERE A SINGLE PILE IS PROPOSED, PILE SHALL BE PLACED ON THE HIGHER SIDE OF THE EXISTING TIMBER WING WALL PILE UNLESS OTHERWISE SHOWN.', 'ENSURE WING WALL SHEETING IS SAFELY PROPPED. DO NOT REMOVE PROPS UNTIL THE PROPOSED PILE IS IN POSITION AND CONCRETE HAS BEEN PLACED A MINIMUM OF 7 DAYS.', 'TOP CUT OF UB 15°; 150x150x10 EA x 125 LONG WITH φ12 HOLES AT 75 CRS FOR 2-M10x100 COACH SCREWS AT SPIKING RAIL.'], 115);
    return B.E;
  });

  // 7 WING WALL PILE REPAIR TYPE WW2 (1330-0006) — timber pile retained in concrete encasement
  def('ww2', 'Wing walls', 'Wing wall pile repair – Type WW2 (encasement)', '1330-0006', [P('H', 'H to underside of capping (≤1500)', 1400, { num: 1 }), P('D', 'Pile dia. (mm)', 350, { num: 1 })], (p) => {
    const B = new Builder(), H = min(1500, +p.H || 1400), D = +p.D || 350, v = B.view(20, 70, 90);
    concBox(v, [[-325, -600], [325, -600], [325, H - 150], [0, H], [-325, H]]); pileElev(v, 0, -1100, H - 100, D);
    v.line(-325, -700, -325, H + 300, 'S-EXIST'); v.line(-600, H + 250, 400, H - 150, 'S-EXIST'); v.line(-600, H + 120, 400, H - 280, 'S-EXIST');
    v.ground(325, 900, 0, 'EXISTING G.L., PERMANENT WATER LEVEL OR HIGH TIDE LEVEL'); v.ground(-900, -325, 0);
    v.line(-325, -500, 325, -500, 'S-BOLT'); v.dim(325, -600, 325, H - 150, -10, "'H' (" + 1500 + ' MAX.)'); v.dim(-325, -600, -325, -100, 10, '500 MIN.');
    v.leader(0, H - 80, 16, 14, 'CUT BACK TOP OF PILE.\n100 MIN. CONCRETE COVER'); v.leader(325, H / 2, 14, 4, 'SL81 FABRIC'); v.leader(-325, -500, -18, -6, 'ANCHOR STRAP\n(100x5FL WITH φ20 ROD)'); v.leader(-325, H / 2, -18, 6, 'EXISTING TIMBER\nSPIKING RAIL / SHEETING');
    B.title(70, 0, 'WING WALL PILE REPAIR DETAIL - TYPE WW2', 20, 'ELEVATION');
    const w = B.view(20, 205, 105); concBox(w, [[-450, -325], [450, -325], [450, 325], [-450, 325]]); w.circ(0, 0, D / 2, 'S-EXIST'); w.circ(0, 0, D / 2 - 100, 'S-EXIST'); w.line(-600, 325, 600, 325, 'S-EXIST');
    w.dim(-450, -325, 450, -325, -6, '900'); w.dim(450, -325, 450, 325, -6, '650'); w.leader(D / 2 - 50, 0, 20, 10, 'MIN. 100 AVERAGE SOLID\nTIMBER ANNULUS'); w.leader(-200, -280, -16, -8, 'φ20 THREADED ROD');
    B.title(205, 82, 'SECTION A', 20);
    const u = B.view(10, 175, 45); u.pl([[0, -50], [-550, -50], [-550 - 0, 50], [0, 50]], false, 'S-NEW'); u.arc(0, 0, 50, -90, 90, 'S-NEW'); u.dim(-550, -50, 0, -50, -6, '550'); B.title(150, 35, 'ANCHOR STRAP DETAIL', 10, '100x5FL ANCHOR STRAP, φ24 HOLE');
    B.notes(150, 22, ['EXTENT OF DETERIORATED TIMBER PILE SHALL BE DETERMINED ON SITE BY DRILLING.', 'IF A MINIMUM 100 SOLID TIMBER ANNULUS IS NOT ACHIEVABLE WITHIN 1500 FROM THE TOP OF PILE, THE ENGINEER IS TO PROVIDE AN ALTERNATIVE DESIGN.'], 115);
    return B.E;
  });

  // 8 WING WALL PILE REPAIR TYPE WW3 (1330-0007) — PFC pile(s)
  def('ww3', 'Wing walls', 'Wing wall pile repair – Type WW3 (PFC)', '1330-0007', [P('pfc', 'Proposed PFC', '300PFC', { opts: PFCs }), P('D', 'Pile dia. (mm)', 350, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.pfc] || SEC['300PFC'], D = +p.D || 350, w = B.view(10, 70, 90);
    concBox(w, [[-325, -190], [325, -190], [325, 190], [-325, 190]]); w.line(-400, 190, 400, 190, 'S-EXIST'); cSec(w, -s.d / 2 * 0 - 60, -10, Object.assign({}, s, { d: s.d }), 1); w.circ(120, -20, D / 2, 'S-EXIST');
    rod(w, -60, 80, 120 + D / 2 + 20, 80, 65);
    w.dim(-325, -190, 325, -190, -6, '650'); w.dim(-325, 190, 325, 190, 10, '75 COVER'.slice(0, 0) + '650');
    w.leader(-60, -s.d / 2 + 20, -18, -10, 'PROPOSED ' + secName(p.pfc) + ' PILE'); w.leader(120 + D / 2, -20, 18, -12, 'TRIM EXISTING TIMBER PILE TO PROVIDE\n75 MIN. BEARING FACE WITH WEB OF PFC'); w.leader(80, 80, 16, 18, 'φ20 THREADED U-ROD FLUSH\nWITH PFC FLANGES (TYP.)'); w.leader(325, 0, 14, 6, 'SL81 FABRIC (TYP.)');
    B.title(70, 55, 'SECTION A - WING WALL PILE REPAIR TYPE WW3', 10);
    B.notes(10, 40, ['WHERE A SINGLE PFC PILE IS PROPOSED, PILE SHALL BE PLACED ON THE HIGHER SIDE OF THE EXISTING TIMBER WING WALL PILE UNLESS OTHERWISE SHOWN.', 'MAXIMUM PILE HEIGHT WITHOUT SURCHARGE: 1-300PFC 3000, 2-300PFC 4000; WITH 20 kPa SURCHARGE 2500 AND 3500 (ENGINEER TO CONFIRM).', 'ENSURE SHEETING IS SAFELY PROPPED; PROPS REMOVED ONLY AFTER PILE IN POSITION AND CONCRETE PLACED 3 DAYS MINIMUM.'], 150);
    return B.E;
  });

  // 9 CONCRETE SHEETING REPAIR (1330-0008)
  def('shc', 'Sheeting', 'Abutment / wing wall concrete sheeting repair', '1330-0008', [P('cap', 'Wing wall capping required', 'no', { opts: ['no', 'yes'] })], (p) => {
    const B = new Builder(), v = B.view(20, 50, 80), cap = p.cap === 'yes';
    const top = cap ? 1500 : 1300; concBox(v, [[0, -600], [200, -600], [200, top], [0, top]]); if (cap) concBox(v, [[200, top - 300], [500, top - 300], [500, top], [200, top]]);
    v.line(-75, -800, -75, top + 300, 'S-EXIST'); v.line(-150, -800, -150, top + 300, 'S-EXIST'); v.ground(200, 900, 0, 'EXISTING G.L., PERMANENT WATER LEVEL OR HIGH TIDE LEVEL'); v.line(125, -525, 125, top - 75, 'S-REO');
    v.dim(-150, -600, -150, 0, 8, '600 MIN.'); v.dim(0, top, 200, top, 6, '200');
    v.leader(125, 400, 16, 4, 'SL81 FABRIC'); v.leader(-75, 800, -16, 6, 'EXISTING TIMBER\nSHEETING'); v.leader(200, top, 16, 10, '20 CHAMFER, U2 FINISH'); v.leader(0, -300, -16, -8, '75 COVER');
    B.title(50, 0, 'SECTION A', 20, cap ? 'SHEETING WHERE WINGWALL CAPPING REQUIRED' : 'SHEETING WHERE WINGWALL CAPPING NOT REQUIRED');
    const w = B.view(10, 175, 100); w.line(-400, 100, 400, 100, 'S-EXIST'); iSec(w, 0, -60, SEC['200UC52'], 1); concBox(w, [[-400, -180], [400, -180], [400, 60], [-400, 60]]); w.line(-380, -140, 380, -140, 'S-REO'); w.line(-300, 20, 300, 20, 'S-BOLT');
    w.leader(0, 20, 14, 18, 'N12x300 LONG DOWEL AT 200 CRS\n(N12x600 THROUGH φ40 HOLE IN STEEL PILE)'); w.leader(-380, -140, -12, -8, 'SL81 FABRIC'); w.leader(0, -160, 10, -18, 'EXISTING STEEL PILE');
    B.title(175, 72, 'SECTION B - TYPE C1A / C2A', 10, 'DOWELS AT EXISTING STEEL PILES');
    B.notes(130, 55, ['EXISTING DETAILS SHOWN ARE INDICATIVE ONLY AND INTENDED TO SET CONTEXT FOR THE REPAIR. ACTUAL DETAILS TO BE CONFIRMED ON SITE.', 'LOCATIONS AND EXTENT OF REPAIRS SHALL BE CONFIRMED ON SITE BY THE CONTRACTOR TO THE APPROVAL OF THE SUPERINTENDENT.', 'FOR DOWELS WELDED TO STEEL PILE WEBS ENSURE MINIMUM 10mm CLEARANCE BETWEEN DOWEL EDGE AND PILE FLANGE.', 'TYPE C3: N12 DOWEL x 600 LONG EMBEDDED 300 INTO EXISTING CONCRETE USING HILTI HIT-HY150 OR SIMILAR APPROVED, 4 DOWELS AT 100 CRS.'], 115);
    return B.E;
  });

  // 10 TIMBER SHEETING REPAIR TYPE 1 (1330-0009)
  def('sht1', 'Sheeting', 'Timber sheeting repair – Type 1 / 1A', '1330-0009', [P('n', 'Number of boards replaced', 3, { num: 1 }), P('D', 'Pile dia. (mm)', 350, { num: 1 })], (p) => {
    const B = new Builder(), n = max(1, min(8, +p.n || 3)), D = +p.D || 350, v = B.view(10, 40, 130);
    v.line(-600, 0, 800, 0, 'S-EXIST'); v.line(-600, -75, 800, -75, 'S-EXIST'); v.circ(-D / 2 - 20, -75 - D / 2, D / 2, 'S-EXIST'); v.rect(0, -75, 700, 75, 'S-NEW'); aSec(v, 0, -75, 90, 150, 8, 1, -1, 'S-NEW'); v.line(-60, -45, 20, -45, 'S-BOLT');
    v.dim(-20, -75 - 40, 55, -75 - 40, -6, '55'); v.leader(350, -40, 14, 14, 'PROPOSED 225x75 THICK\nSEASONED JARRAH SHEETING'); v.leader(-D / 2 - 20, -75 - D, -14, -8, 'TRIM EXISTING PILE FACE TO\nPROVIDE 70 MIN. BEARING TO ANGLE');
    B.title(40, 75, 'PLAN', 10);
    const w = B.view(10, 190, 175); for (let i = 0; i < n + 2; i++) w.line(-300, -i * 225, 800, -i * 225, i && i <= n ? 'S-NEW' : 'S-EXIST'); w.line(-D / 2, 150, -D / 2, -(n + 2) * 225, 'S-EXIST'); w.line(D / 2, 150, D / 2, -(n + 2) * 225, 'S-EXIST');
    w.rect(D / 2, -n * 225 - 225 + 225, 90, n * 225, 'S-NEW'); for (let i = 0; i < n; i++) { w.circ(D / 2 + 45, -i * 225 - 225 / 2, 8, 'S-BOLT'); w.line(D / 2 - 40, -i * 225 - 112, D / 2 + 90, -i * 225 - 112, 'S-BOLT'); }
    w.leader(D / 2 + 90, -112, 20, 10, 'M12x75 LONG COACH SCREW FIXED CENTRALLY\nIN PROPOSED TIMBER SHEET (1 PER SHEET)'); w.leader(D / 2 + 45, -n * 225 + 30, 20, -12, '150x90x8 UA (GALV.) LENGTH TO SUIT'); w.leader(500, -225 - 112, 16, -4, 'REPAIR LOCATION (TYP.)');
    w.cl(0, 200, 0, -(n + 2) * 225 - 50, 'PILE');
    B.title(215, 175 - (n + 2) * 22.5 - 14, 'TYPE 1 - TIMBER PILE CONNECTION', 10, 'ELEVATION');
    B.notes(15, 60, ['LOCATIONS AND EXTENT OF REPAIRS SHALL BE CONFIRMED ON SITE BY THE CONTRACTOR TO THE APPROVAL OF THE SUPERINTENDENT.', 'PGI STRIPS SHALL BE PLACED OVER SHEETING JOINTS: 100 WIDE FOR GAPS ≤ 20mm AND 150 WIDE FOR GAPS > 20mm. PGI REPAIRS NOT APPROPRIATE FOR GAPS EXCEEDING 70mm.', 'TYPE 1A (ABUTMENT CORNER PILE): 90x8FL (GALV.) LENGTH TO SUIT WITH M12x125 COACH SCREWS AT 60 FROM BOARD EDGES.'], 95);
    return B.E;
  });

  // 11 SPIKING RAIL RETAINER (1330-0011)
  def('srr', 'Sheeting', 'Spiking rail retainer – Type 1', '1330-0011', [P('L', 'Plate length (mm)', 500, { num: 1 })], (p) => {
    const B = new Builder(), L = +p.L || 500, v = B.view(10, 70, 110);
    v.rect(-260, -60, 260, 160, 'S-EXIST'); v.rect(-260, 100, 260, 120, 'S-EXIST'); v.rect(0, -10, 260, 260, 'S-CONC'); v.hatch([[0, -10], [260, -10], [260, 250], [0, 250]], 'conc', 'S-HATCH');
    v.rect(-200, 0, L * 0.6, 150, 'S-NEW'); [[-150, 75], [-60, 75]].forEach(q => v.circ(q[0], q[1], 5, 'S-BOLT')); [[60, 75], [150, 75]].forEach(q => v.rect(q[0] - 10, q[1] - 5, 20, 10, 'S-BOLT'));
    v.leader(-130, 220, -14, 8, 'EXISTING TIMBER\nWING WALL CAPPING'); v.leader(-200, 20, -16, -10, 'EXISTING TIMBER\nSPIKING RAIL'); v.leader(-100, 150, -6, 22, '8PL BENT TO SUIT WING WALL\nREFER FABRICATION DETAIL - TYPE A'); v.leader(250, 200, 16, 10, 'EXISTING OR PROPOSED\nCONCRETE OVERLAY');
    B.title(70, 70, 'SPIKING RAIL RETAINER - TYPE 1', 10, 'ELEVATION');
    const w = B.view(10, 70, 35); w.rect(0, 0, L, 150, 'S-NEW'); [30, 120].forEach(x => w.circ(x, 75, 5, 'S-BOLT')); [L - 120, L - 30].forEach(x => w.rect(x - 10, 70, 20, 10, 'S-BOLT')); w.line(330, -10, 330, 160, 'S-TEXT');
    w.dim(0, 0, 30, 0, -6, '30'); w.dim(30, 0, 120, 0, -6, '90'); w.dim(120, 0, 330, 0, -6, '210'); w.dim(330, 0, L - 120, 0, -6, String(L - 450)); w.dim(L - 120, 0, L - 30, 0, -6, '90'); w.dim(L - 30, 0, L, 0, -6, '30'); w.dim(0, 0, L, 0, -14, String(L)); w.dim(L, 0, L, 150, -6, '150');
    w.leader(330, 160, 8, 8, 'PLATE BENT TO SUIT\nWING WALL ANGLE'); w.leader(L - 30, 80, 14, 8, 'φ10x20 LONG\nSLOTTED HOLE (TYP.)');
    B.title(95, 15, 'PLATE FABRICATION DETAIL - TYPE A', 10, 'DEVELOPED ELEVATION');
    B.notes(150, 110, ['M8x75 LONG GALV. COACH SCREWS FIXED TO SPIKING RAIL; φ8 MASONRY ANCHORS (BTG875 BLUE-TIP SCREW BOLT OR SIMILAR APPROVED) TO CONCRETE.', 'FOR PROPOSED OVERLAYS, CONCRETE TO BE CURED FOR A MINIMUM OF 7 DAYS PRIOR TO INSTALLATION OF MECHANICAL FASTENERS.', 'ANGLE TO SUIT EXISTING GEOMETRY TO BE SITE MEASURED PRIOR TO FABRICATION.'], 110);
    return B.E;
  });

  // 12 PIER PILE REPAIR HALF-CAP BEARING TYPE 1 (1330-0012)
  def('pphc1', 'Halfcaps', 'Pier pile repair – half-cap bearing Type 1', '1330-0012', [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('hc', 'Halfcap depth (mm)', 300, { num: 1 }), P('gap', 'Gap between halfcaps (mm)', 140, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], hc = +p.hc || 300, gap = +p.gap || 140, v = B.view(10, 50, 120), w0 = 200;
    // elevation along halfcap
    v.rect(-700, 0, 1400, hc, 'S-EXIST'); iElevFlange(v, 0, -900, -12, s); v.rect(-s.b / 2 - 20, -12, s.b + 40, 12, 'S-NEW'); v.rect(-35, 40, 70, hc - 60, 'S-NEW'); [80, 200].forEach(y => boltSym(v, 0, y, 20));
    v.line(-s.b / 2, -12, -s.b / 2 - 20, -80, 'S-NEW'); v.line(s.b / 2, -12, s.b / 2 + 20, -80, 'S-NEW');
    v.cl(0, -950, 0, hc + 120, 'PILE'); v.leader(-600, hc, -10, 10, 'EXISTING TIMBER\nHALF-CAP'); v.leader(s.b / 2 + 10, -60, 18, -10, '90x12FL STIFFENER WITH\n20 CHAMFER TO CLEAR UC RADIUS (TYP.)'); v.leader(0, -600, 18, -6, 'PROPOSED UC PILE');
    B.title(50, 15, 'ELEVATION', 10);
    const w = B.view(10, 185, 120); const cw = 2 * w0 + gap; w.rect(-gap / 2 - 170, 0, 170, hc, 'S-EXIST'); w.rect(gap / 2, 0, 170, hc, 'S-EXIST'); w.line(-gap / 2 - 170, 0, gap / 2 + 170, hc, 'S-EXIST'); w.line(-gap / 2 - 170, hc, -gap / 2, 0, 'S-EXIST'); w.line(gap / 2, 0, gap / 2 + 170, hc, 'S-EXIST'); w.line(gap / 2, hc, gap / 2 + 170, 0, 'S-EXIST');
    iElevWebH(w, -cw / 2 - 50, cw / 2 + 50, -s.d / 2, s); iElevWebV(w, 0, -s.d - 700, -s.d, s); cSec(w, -gap / 2 + 10, hc / 2, SEC['150PFC'], 1); rod(w, -gap / 2 - 170 - 40, hc * 0.35, gap / 2 + 170 + 40, hc * 0.35, 65); rod(w, -gap / 2 - 170 - 40, hc * 0.7, gap / 2 + 170 + 40, hc * 0.7, 65);
    w.dim(-cw / 2 - 50, -s.d - 40, -cw / 2 + 150, -s.d - 40, -6, '200'); w.dim(cw / 2 - 150, -s.d - 40, cw / 2 + 50, -s.d - 40, -6, '200');
    w.leader(-gap / 2 + 40, hc / 2, -20, 18, 'REFER TO HALF-CAP CONNECTION\nCHANNEL - TYPE A'); w.leader(gap / 2 + 170 + 40, hc * 0.7, 14, 10, 'φ20 THREADED ROD WITH\n1-65x5FLx65 WASHER TO\nTIMBER FACE (TYP.)'); w.leader(cw / 2, -s.d / 2, 16, -8, 'UC CORBEL SIZE TO MATCH\nPROPOSED UC PILE');
    B.title(185, 15, 'VIEW B', 10);
    B.title(120, -2, 'PIER PILE REPAIR HALF-CAP BEARING DETAIL - TYPE 1');
    B.notes(10, -15, ['DIMENSIONS TO BE MEASURED ON SITE PRIOR TO FABRICATION AND CONSTRUCTION.', 'STEEL SHIMS TO BE (3, 5, 8, 10 OR 12 FL) WIDTH AND LENGTH TO SUIT. TACK WELD TOGETHER ONCE IN PLACE.', 'ALL WELDS 6mm CONTINUOUS FILLET UNO.'], 200);
    return B.E;
  });

  // 13 HALF-CAP CONNECTION CHANNEL TYPE A / B (1330-0013)
  def('hcch', 'Halfcaps', 'Half-cap connection channel – Type A / B', '1330-0013', [P('type', 'Type', 'A', { opts: ['A', 'B'] }), P('pfc', 'PFC size', '150PFC', { opts: ['125PFC', '150PFC', '180PFC', '200PFC'] }), P('hc', 'Timber halfcap depth (mm)', 300, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.pfc] || SEC['150PFC'], hc = +p.hc || 300, typeB = p.type === 'B', v = B.view(10, 60, 90), e = s.d <= 125 ? 35 : 45;
    const bot = typeB ? -300 : -75, len = hc - 20 - bot;
    v.rect(-s.b / 2 + 20, bot, s.b, len, 'S-NEW'); v.line(-s.b / 2 + 20 + s.tw, bot, -s.b / 2 + 20 + s.tw, hc - 20, 'S-NEW');
    const holes = typeB ? [hc - 75, 75, -150, -225] : [hc - 75, 0]; holes.forEach(y => v.circ(e - s.b / 2 + 20, y, 11, 'S-BOLT'));
    v.line(-250, hc, 250, hc, 'S-TEXT'); v.line(-250, 0, 250, 0, 'S-TEXT'); v.wl(-200, hc, 'TOP OF TIMBER HALF-CAP'); v.wl(-200, 0, 'UNDERSIDE OF TIMBER HALF-CAP'); if (typeB) { v.wl(200, -100, 'TOP OF STEEL HALF-CAP'); v.wl(200, -300, 'U/S OF STEEL HALF-CAP'); }
    v.dim(-s.b / 2 + 20, hc, e - s.b / 2 + 20, hc, 8, String(e)); v.dim(s.b / 2 + 20, hc - 20, s.b / 2 + 20, hc, -6, '20'); v.dim(s.b / 2 + 20, hc - 75, s.b / 2 + 20, hc - 20, -6, '55');
    v.leader(e - s.b / 2 + 20, holes[1], 18, -10, 'φ22 HOLE (TYP.)'); v.leader(s.b / 2 + 20, bot + 40, 18, -10, secName(p.pfc) + ' LENGTH TO SUIT');
    B.title(95, 15, 'HALF-CAP CONNECTION CHANNEL - TYPE ' + (typeB ? 'B' : 'A'), 10, 'ELEVATION');
    B.notes(130, 100, ['125 - 200 PFC SHIMMED TO FIT GAP BETWEEN TIMBER OR STEEL HALF-CAPS.', 'DIMENSIONS TO BE MEASURED ON SITE PRIOR TO FABRICATION.', 'STEEL SHIMS (3, 5, 8, 10 OR 12 FL) WIDTH AND LENGTH TO SUIT, TACK WELDED TOGETHER ONCE IN PLACE.', 'CHANNEL WELDED TO UC CORBEL OR CAP PLATE WITH 6mm FILLET WELD ALL ROUND.'], 110);
    return B.E;
  });

  // 14 ABUTMENT TOP CONNECTION TYPE A (1330-0014)
  def('atA', 'Halfcaps', 'Abutment pile top connection – Type A', '1330-0014', [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('X', "Dimension 'X' (mm)", 60, { num: 1 }), P('hc', 'Halfcap / fullcap depth (mm)', 300, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], X = +p.X || 60, hc = +p.hc || 300, v = B.view(10, 40, 125), xc = X + s.d / 2, big = X >= 50;
    v.line(0, -s.d - 900, 0, hc + 560, 'S-EXIST'); v.line(-75, -s.d - 900, -75, hc + 560, 'S-EXIST'); // sheeting
    v.rect(0, -s.d - 900, X, s.d + 900, big ? 'S-NEW' : 'S-NEW'); if (big) { v.line(0, -s.d - 900, X, 0, 'S-NEW'); v.line(0, 0, X, -s.d - 900, 'S-NEW'); }
    iElevWebV(v, xc, -s.d - 900, -s.d, s); iElevWebH(v, xc - 100, xc + 100, -s.d / 2, s); v.line(xc - 100 + 12, -s.d, xc - 100 + 12, 0, 'S-NEW'); v.line(xc + 100 - 12, -s.d, xc + 100 - 12, 0, 'S-NEW');
    v.rect(xc - 85, 0, 170, hc, 'S-EXIST'); v.line(xc - 85, 0, xc + 85, hc, 'S-EXIST'); v.line(xc - 85, hc, xc + 85, 0, 'S-EXIST'); v.rect(xc + 85, -20, 10, hc - 20 + 20, 'S-NEW');
    rod(v, xc - 85 - 30, hc * 0.3, xc + 95 + 30, hc * 0.3, 65); rod(v, xc - 85 - 30, hc * 0.72, xc + 95 + 30, hc * 0.72, 65);
    v.circ(xc + 40, hc + 230, 230, 'S-EXIST'); v.line(-75, hc + 460, xc + 700, hc + 460, 'S-EXIST'); v.line(-75, hc + 560, xc + 700, hc + 560, 'S-EXIST');
    v.dim(0, -s.d - 980, X, -s.d - 980, -6, "'X'"); v.dim(xc + 260, -20, xc + 260, 0, -6, '20');
    v.leader(-75, -400, -16, 8, 'EXISTING TIMBER\nSHEETING'); v.leader(xc, -s.d - 500, 22, -6, 'PROPOSED UC PILE ' + secName(p.uc)); v.leader(xc + 100, -s.d / 2, 26, 8, 'PROPOSED UC CORBEL TO MATCH\nPILE SIZE x200 LONG'); v.leader(xc + 85, hc * 0.85, 30, 22, 'EXISTING TIMBER HALF-CAP\n(PFC SIMILAR)'); v.leader(xc + 95 + 30, hc * 0.3, 26, -4, 'φ20 THREADED ROD WITH 65x5FLx65\nWASHER TO TIMBER FACE'); v.leader(X / 2, -s.d - 300, -16, -16, big ? 'TIMBER PACKER\nMIN. 50 THICK' : 'PACK WITH 250x(6,8,10\nOR 12)FL STEEL SHIMS'); v.leader(xc + 40, hc + 400, 30, 8, 'EXISTING TIMBER STRINGER / DECKING');
    B.title(80, 12, 'ABUTMENT TOP CONNECTION DETAIL - TYPE A', 10, big ? "(REPAIR TO BE USED WHERE DIMENSION 'X' ≥ 50mm)" : "(REPAIR TO BE USED WHERE DIMENSION 'X' < 50mm)");
    B.notes(165, 120, ['TIMBER HALF-CAPS / FULL-CAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL POSITIONS.', 'STEEL SHIMS TO BE (3, 5, 8, 10 OR 12 FL) WIDTH AND LENGTH TO SUIT. TACK WELD TOGETHER ONCE IN PLACE.', 'PROVIDE GALV. STEEL SHIMS IF REQUIRED TO ENSURE TIGHT FIT. PROVIDE 2 No. 10PL WEB STIFFENERS TO BOTH FACES OF THE CORBEL.', 'SITE DRILL HOLES TO SUIT φ20 THREADED RODS.'], 100);
    return B.E;
  });

  // 15 PIER HALF-CAP STRENGTHENING (1330-0018 / 0019) — parametric along the pier
  def('phs', 'Halfcaps', 'Pier half-cap strengthening (PFC)', '1330-0018', [P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('piles', 'Pile spacings (mm, comma)', '2000, 2000, 2000', {}), P('ns', 'Number of stringers', 7, { num: 1 }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('hc', 'Halfcap depth (mm)', 300, { num: 1 }), P('packer', 'Packer option', 'yes', { opts: ['yes', 'no'] })], (p) => {
    const B = new Builder(), s = SEC[p.pfc] || SEC['300PFC'], sp = String(p.piles).split(/[ ,;]+/).map(Number).filter(x => x > 0), D = +p.D || 380, hc = +p.hc || 300, ns = max(2, +p.ns || 7);
    const xp = [0]; sp.forEach(d => xp.push(xp[xp.length - 1] + d)); const W = xp[xp.length - 1], x0 = -400, x1 = W + 400, v = B.view(20, 25, 140), top = 0;
    v.rect(x0, top, x1 - x0, hc, 'S-EXIST'); v.rect(x0, top - s.d + hc - 20 - (s.d - hc), x1 - x0, 0, 'S-NEW');
    const yb = top + hc - s.d; v.rect(x0 + 100, yb, x1 - x0 - 200, s.d, 'S-NEW'); v.line(x0 + 100, yb + s.tf, x1 - 100, yb + s.tf, 'S-NEW'); v.line(x0 + 100, yb + s.d - s.tf, x1 - 100, yb + s.d - s.tf, 'S-NEW');
    xp.forEach(x => { pileElev(v, x, yb - 1400, yb - 25, D); v.line(x - D / 2, yb - 100, x + D / 2, yb - 100, 'S-NEW'); v.line(x - D / 2, yb - 160, x + D / 2, yb - 160, 'S-NEW'); v.rect(x - 150, yb - 25, 300, 25, 'S-NEW'); v.cl(x, yb - 1500, x, top + hc + 950); });
    const ys = Array.from({ length: ns }, (_, i) => x0 + 200 + i * (x1 - x0 - 400) / (ns - 1));
    ys.forEach(x => { v.rect(x - 110, top + hc, 220, 300, 'S-EXIST'); v.circ(x, top + hc + 300 + 220, 220, 'S-EXIST'); v.line(x, top + 40, x, top + hc + 260, 'S-BOLT'); });
    v.line(x0 - 200, top + hc + 300 + 440, x1 + 200, top + hc + 300 + 440, 'S-EXIST'); v.line(x0 - 200, top + hc + 300 + 440 + 120, x1 + 200, top + hc + 300 + 440 + 120, 'S-EXIST');
    for (let x = x0 + 250; x < x1 - 150; x += 900) { boltSym(v, x, yb + s.d / 2, 20); }
    v.dim(x0 + 100, yb - 200, xp[0] - D / 2, yb - 200, -6, '100 MIN.-300 MAX.'); sp.forEach((d, i) => v.dim(xp[i], yb - 1550, xp[i + 1], yb - 1550, -6, String(d)));
    v.leader(x0 + 250, yb + s.d / 2, -10, -16, 'φ20 THREADED RODS AT 900 MAXIMUM CRS.\nTHROUGH φ22 HOLE IN PFC WITH 65x5FLx65\nWASHER TO TIMBER FACE (TYP.)'); v.leader(xp[1] + 300, yb + 10, 18, -12, secName(p.pfc) + ' HALF-CAP\nSTRENGTHENING'); v.leader(xp[0] + D / 2, yb - 130, 18, -18, 'PILE BAND (TYP.)'); v.leader(ys[1], top + hc + 150, 10, 30, 'EXISTING TIMBER\nCORBEL (TYP.)'); v.leader(ys[2] + 150, top + hc + 520, 10, 22, 'EXISTING TIMBER\nSTRINGER (TYP.)'); v.leader(x1 - 300, top + hc / 2, 12, 22, 'EXISTING TIMBER HALF-CAP');
    if (p.packer === 'yes') v.leader(xp[0] - D / 2 + 20, yb - 12, -18, -26, 'STEEL OR TIMBER PACKER\n(REFER DETAIL 1)');
    B.title(25 + (W / 2) / 20, 40, 'PIER HALF-CAP STRENGTHENING DETAIL', 20, p.packer === 'yes' ? 'PACKER OPTION' : 'NO PACKER OPTION');
    const w = B.view(10, 25 + (W + 400) / 20 + 70, 150); pileElev(w, 0, -1000, -30, D); w.rect(-60 - 170 - 60, 0, 170, hc, 'S-EXIST'); w.rect(60, 0, 170, hc, 'S-EXIST'); cSec(w, -60, hc - s.d / 2 - 0, s, -1); w.line(-60 - s.b, hc - s.d, 60 + D / 2, hc - s.d, 'S-NEW');
    w.pl([[-60 - s.b - 30, hc - s.d / 2], [D / 2 + 60, hc - s.d / 2]], false, 'S-BOLT'); w.arc(D / 2 + 60 - 0, hc - s.d / 2 - 0, 0.01, 0, 1, 'S-BOLT'); rod(w, -60 - 170 - 60 - 30, hc - 60, -60 + 20, hc - 60, 65);
    w.dim(-60 - s.b, hc - s.d - 120, -60, hc - s.d - 120, -6, String(s.b)); w.dim(-60, hc + 60, 0, hc + 60, 6, '50 MIN.');
    w.leader(-60 - s.b / 2, hc - s.d + 5, -18, -14, secName(p.pfc) + ' HALF-CAP\nSTRENGTHENING'); w.leader(D / 2, hc - s.d / 2, 16, -10, 'φ20 THREADED U-ROD'); w.leader(0, -300, 16, -10, 'EXISTING TIMBER PILE'); w.leader(-200, hc, -16, 10, 'EXISTING TIMBER\nHALF-CAP (TYP.)');
    B.title(25 + (W + 400) / 20 + 70, 40, 'HALF-CAP TO PILE CONNECTION DETAIL - TYPE 1', 10, 'SECTION A');
    B.notes(25, 25, ['RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED HALF-CAP REPAIRS. RE-USE EXISTING PILE BANDS WHERE POSSIBLE.', 'PROP STRINGERS AND CORBELS PRIOR TO INSTALLING HALF-CAP STRENGTHENING. INSTALL STRENGTHENING BY JACKING AGAINST THE TIMBER HALF-CAP TO REMOVE ALL BOWS AND DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT.', 'MAKE GOOD DAMAGED GALV. SURFACE BY APPLYING COLD GALV. OR SIMILAR APPROVED.', 'IF EXISTING BEARING IS LESS THAN REQUIRED MIN. (70 FOR PILES > φ340, 90 FOR PILES ≤ φ340) REFER PILE - HALF-CAP BEARING DETAILS.', 'REPLACE EXISTING SPLICE BOLTS WHERE POSSIBLE USING φ20 THREADED RODS WITH 65x5FLx65 WASHERS TO TIMBER FACES.'], 230);
    return B.E;
  }, 'PFC each side of the timber halfcap, rods at 900 crs; drawn for the pile spacings and stringer count you enter.');

  // 16 PILE – HALF-CAP BEARING DETAILS + TABLE (1330-0022)
  def('hcb', 'Halfcaps', 'Pile – half-cap bearing details & table', '1330-0022', [P('type', 'Bearing type', 1, { opts: [1, 2, 3, 4], num: 1 }), P('D', 'Pile dia. (mm)', 360, { num: 1 }), P('pfc', 'PFC half-cap', '300PFC', { opts: ['300PFC', '380PFC'] })], (p) => {
    const B = new Builder(), t = +p.type || 1, D = +p.D || 360, s = SEC[p.pfc] || SEC['300PFC'], v = B.view(10, 60, 120), small = D < 340, bmin = small ? 90 : 70;
    const A = t === 1 ? (small ? 80 : 60) : t === 2 ? (small ? 62 : 42) : 25;
    pileElev(v, 0, -900, -100, D); v.line(-D / 2, -100, D / 2 - A, -100, 'S-EXIST'); v.rect(-D / 2, 0, 170, 300, 'S-EXIST');
    const xw = D / 2 - A; cSec(v, xw, 300 - s.d / 2, s, 1); v.rect(xw - 130 + 0, -100, 130, 20, 'S-NEW'); if (t >= 2) v.line(xw + 5, -80, xw + 5, 120, 'S-NEW');
    if (t === 3) { cSec(v, xw - 100, -180, SEC['200PFC'], 1); v.rect(xw - 150, -100 - 20, 150, 20, 'S-NEW'); }
    v.dim(xw, -260, D / 2, -260, -6, "'A'"); v.dim(xw - bmin, -330, xw, -330, -6, 'MIN. ' + bmin);
    v.leader(-D / 2 + 80, 300, -14, 10, 'EXISTING TIMBER\nHALF-CAP'); v.leader(xw + s.b, 300 - s.d / 2, 16, 8, secName(p.pfc) + ' HALF-CAP'); v.leader(xw - 60, -90, -24, -16, '130x20FLx300 LONG\nBEARING PLATE'); v.leader(D / 2, -600, 14, -6, 'EXISTING TIMBER PILE'); if (t >= 2) v.leader(xw + 5, 60, 16, -18, '75x10FL STIFFENER (TYP.)');
    B.title(60, 15, 'TYPE ' + t + (t === 3 ? ' (PIER REPAIR ONLY)' : ''), 10, 'SECTIONAL ELEVATION');
    const rows = [[1, '≥ 340', 70, '50-70'], [1, '< 340', 90, '70-90'], [2, '≥ 340', 70, '35-50'], [2, '< 340', 90, '55-70'], [3, '≥ 340', 70, '0-35'], [3, '< 340', 90, '0-55'], [4, '≥ 340', 70, '0-35'], [4, '< 340', 90, '0-55'], [5, '≥ 340', 70, '-'], [5, '< 340', 90, '-']];
    const tby = B.table(130, 125, [{ n: 'PILE TYPE', w: 20 }, { n: 'PILE DIAMETER\n(mm)', w: 28 }, { n: 'MIN. BEARING\nREQUIRED (mm)', w: 30 }, { n: "HALFCAP SEATING\n'A' (mm)", w: 32 }], rows.map(r => r.map(String)), 2.1);
    B.title(185, tby - 7, 'PILE BEARING TABLE');
    B.notes(130, tby - 16, ['RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED HALF-CAP REPAIRS. NEW PILE BANDS AS PER STANDARD DRAWING.', 'TYPES 1-3 SUITABLE AT ABUTMENT AND PIER PILES REQUIRING REPAIR ON A SINGLE FACE. TYPE 4 SUITABLE AT PIER PILES REQUIRING REPAIR AT BOTH FACES.', 'TRIM EXISTING TIMBER PILE TO SUIT PROPOSED SUPPORT BRACKET. 4mm CONTINUOUS FILLET WELDS UNO.'], 110);
    return B.E;
  });

  // 17 STRINGER REPLACEMENT – PIER BOTTOM FLANGE CONNECTION TYPE 1 (1330-0023)
  def('sbf', 'Stringers', 'Stringer replacement – bottom flange connection (pier, Type 1)', '1330-0023', [P('ub', 'Proposed stringer', '410UB54', { opts: UBs })], (p) => {
    const B = new Builder(), s = SEC[p.ub] || SEC['410UB54'], v = B.view(20, 60, 120), hc = 300;
    v.rect(-200, -hc, 400, hc, 'S-EXIST'); v.line(-200, -hc, 200, 0, 'S-EXIST'); v.line(-200, 0, 200, -hc, 'S-EXIST'); v.rect(-1400, 0, 1400 - 10, 260, 'S-EXIST'); v.circ(-1500, 230, 230, 'S-EXIST');
    iElevWebH(v, 10, 1800, s.d / 2 + 16, s); v.rect(10, 0, 1000, 16, 'S-NEW'); v.rect(-10 - 300, 0, 300, 16, 'S-NEW');
    v.line(-1600, s.d + 16, 1900, s.d + 16, 'S-EXIST'); v.line(-1600, s.d + 16 + 100, 1900, s.d + 16 + 100, 'S-EXIST'); v.cl(0, -hc - 150, 0, s.d + 300, 'PIER');
    [60, 160].forEach(x => boltSym(v, x, 8, 20)); v.dim(0, s.d + 200, 10, s.d + 200, 6, '10'); v.dim(-310, -80, 0, -80, -6, '300 MIN.');
    v.leader(600, s.d / 2, 16, 14, 'PROPOSED ' + secName(p.ub) + ' STRINGER'); v.leader(500, 8, 14, -16, 'MODIFIED FLANGE\nREFER DETAIL'); v.leader(-600, 130, -14, 20, 'EXISTING TIMBER\nSTRINGER'); v.leader(-100, -hc / 2, -18, -14, 'EXISTING TIMBER\nHALF-CAP (TYP.)'); v.leader(-200, 8, -20, -20, '200x(6,8,10,12,16,20 OR 25FL)x300 LONG STEEL SHIMS\nUSED TO PACK STEEL STRINGER TIGHT AGAINST DECKING');
    B.title(80, 10, 'PIER BOTTOM FLANGE CONNECTION DETAIL - TYPE 1', 20, 'ELEVATION');
    const w = B.view(10, 210, 95); w.rect(-420, 0, 840, 300, 'S-EXIST'); w.line(-420, 0, 420, 300, 'S-EXIST'); w.line(-420, 300, 420, 0, 'S-EXIST'); w.rect(-100, 300, 200, 16, 'S-NEW'); iSec(w, 0, 316 + s.d / 2, s, 0); w.rect(-130, 316, 260, 0.1, 'S-NEW');
    [-1, 1].forEach(k => { rod(w, k * 45, 316 + 60, k * 45, -60, 75); }); w.dim(-45, -100, 45, -100, -6, '90');
    w.leader(0, 316 + s.d, 18, 8, 'PROPOSED STRINGER'); w.leader(45, 316 + 40, 20, -10, '75x8FLx100 LONG WASHER WITH\nφ22 HOLE TO SUIT THREADED ROD'); w.leader(45, -60, 18, -10, '100x10FLx300 WASHER,\nφ20 THREADED ROD (TYP.)');
    B.title(210, 45, 'SECTIONAL ELEVATION D', 20);
    const u = B.view(10, 210, 22); u.rect(0, 0, 840, 200, 'S-NEW'); u.rect(0, 100 - 5, 400, 10, 'S-NEW'); [400, 790].forEach(x => { u.circ(x, 45, 11, 'S-BOLT'); u.circ(x, 155, 11, 'S-BOLT'); }); u.dim(0, 0, 400, 0, -6, '400'); u.dim(400, 0, 790, 0, -6, '390'); u.dim(0, 0, 840, 0, -13, '840'); u.dim(840, 0, 840, 200, -6, '200');
    B.title(252, 12, 'PIER MODIFIED FLANGE DETAIL', 10, '200x16FL - STRINGER REPLACEMENT ON STEEL CORBEL');
    B.notes(10, -8, ['GAP BETWEEN STRINGER AND DECK SHALL BE SUITABLY PACKED. REFER STEEL STRINGER PACKING DETAIL.', 'DIMENSIONS SHALL BE SITE MEASURED PRIOR TO FABRICATION AND CONSTRUCTION.', 'SLOT WIDTH TO BE EQUAL TO PROPOSED STEEL STRINGER WEB THICKNESS +2mm. 6mm FILLET WELDS BOTH SIDES OF WEB.'], 180);
    return B.E;
  });

  // 18 TOP FLANGE CONNECTION TYPE A (1330-0024)
  def('stf', 'Stringers', 'Stringer replacement – top flange connection Type A', '1330-0024', [P('ub', 'Proposed stringer', '410UB54', { opts: UBs }), P('np', 'Deck planks shown', 9, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.ub] || SEC['410UB54'], n = max(4, +p.np || 9), v = B.view(20, 30, 110), pw = 220;
    for (let i = 0; i <= n; i++) v.line(i * pw, -400, i * pw, 400, 'S-EXIST'); v.line(0, -s.b / 2, n * pw, -s.b / 2, 'S-NEW'); v.line(0, s.b / 2, n * pw, s.b / 2, 'S-NEW'); v.cl(-100, 0, n * pw + 100, 0, 'STRINGER');
    for (let i = 1; i < n; i += 3) boltSym(v, i * pw + pw / 2, (i % 2 ? 45 : -45), 20); v.dim(pw * 1, 450, pw * 4, 450, 6, 'EVERY THIRD DECK PLANK (TYP.)');
    v.leader(pw * 1 + pw / 2, 45, 14, 18, 'φ22 HOLE TO SUIT φ20x130\nLONG COACH SCREW'); v.leader(pw * 2, -s.b / 2, -6, -18, 'PROPOSED STEEL STRINGER'); v.leader(pw * (n - 1), 300, 10, 12, 'EXISTING TIMBER DECK');
    B.title(30 + n * pw / 40, 70, 'TOP FLANGE CONNECTION DETAIL - TYPE A', 20, 'PLAN');
    const w = B.view(10, 210, 100); w.rect(-300, 0, 600, 120, 'S-EXIST'); w.rect(-300, 120, 600, 80, 'S-CONC'); w.hatch([[-300, 120], [300, 120], [300, 200], [-300, 200]], 'conc', 'S-HATCH'); iSec(w, 0, -s.d / 2, s, 0); [-45, 45].forEach(x => w.line(x, -s.tf - 10, x, 160, 'S-BOLT')); w.dim(-45, 260, 0, 260, 6, '45'); w.dim(0, 260, 45, 260, 6, '45');
    w.leader(-300, 160, -14, 6, 'EXISTING CONCRETE\nOVERLAY'); w.leader(300, 60, 14, -6, 'EXISTING TIMBER\nDECK'); w.leader(45, -s.tf, 18, -10, 'φ22 HOLE (TYP.)');
    B.title(210, 45, 'SECTIONAL ELEVATION A', 10);
    B.notes(150, 30, ['DETAILS SHOWN ARE ONLY APPLICABLE FOR UB STRINGERS 250 UB 31.4 OR HEAVIER.', 'GAP BETWEEN STRINGER AND DECK SHALL BE SUITABLY PACKED. REFER STEEL STRINGER PACKING DETAIL.', 'FIX LOOSE PLANKS TO ADJACENT BOLTED PLANKS WITH φ10x200 LONG SPIKES (TYP.).', 'CENTRE PUNCH BOLT THREAD TO NUT TO PREVENT UNDOING OF NUT.'], 115);
    return B.E;
  });

  // 19 STEEL STRINGER SPLICE (1330-0025)
  def('ssp', 'Stringers', 'Steel stringer splice joint & packing', '1330-0025', [P('ub', 'Stringer', '410UB54', { opts: UBs })], (p) => {
    const B = new Builder(), s = SEC[p.ub] || SEC['410UB54'], v = B.view(10, 60, 110);
    iElevWebH(v, -900, -2, 0, s); iElevWebH(v, 2, 900, 0, s); v.rect(-12.5 - 12.5, -s.d / 2, 25, s.d, 'S-NEW'); [-1, 1].forEach(k => v.rect(k > 0 ? 0 : -25, -s.d / 2 - 0, 25, s.d, 'S-NEW'));
    const ys = [s.d / 2 - 45, s.d / 2 - 45 - 135, s.d / 2 - 45 - 270, -s.d / 2 + 45]; ys.forEach(y => v.rect(-40, y - 12, 80, 24, 'S-BOLT'));
    v.dim(-900, s.d / 2 + 60, 0, s.d / 2 + 60, 8, '1200 MAX. FROM ℄ SUPPORT');
    v.leader(-25, ys[1], -24, 10, 'SPLICE PLATES WITH\n8 - M24 8.8TF BOLTS'); v.leader(400, 0, 14, 16, 'PROPOSED STRINGER\n(' + secName(p.ub) + ' OR SMALLER)');
    B.title(60, 15, 'STEEL STRINGER SPLICE JOINT DETAIL', 10, 'ELEVATION');
    const w = B.view(10, 185, 85); w.rect(-100, 0, 200, 530, 'S-NEW'); w.line(0, -20, 0, 550, 'S-CL'); [45, 205, 340, 475].forEach(y => [-55, 55].forEach(x => boltSym(w, x, y, 26)));
    w.dim(-100, 0, 100, 0, -6, '200'); w.dim(-55, 530, 55, 530, 6, '110'); w.dim(100, 0, 100, 45, -6, '45'); w.dim(100, 45, 100, 205, -6, '160'); w.dim(100, 205, 100, 340, -6, '135'); w.dim(100, 340, 100, 475, -6, '135'); w.dim(100, 475, 100, 530, -6, '55'); w.dim(-100, 0, -100, 530, 10, '530');
    w.leader(55, 205, 22, 0, 'φ26 HOLE (TYP.)'); w.leader(-100, 300, -16, 0, '200 x 25 FL\nSPLICE PLATE');
    B.title(185, 70, 'SPLICE PLATE DETAIL', 10);
    const u = B.view(10, 120, 50); u.rect(-400, 0, 800, 100, 'S-EXIST'); iSec(u, 0, -s.d / 2 - 10, s, 0); u.rect(-s.b / 2, -10, s.b, 10, 'S-NEW'); u.leader(-s.b / 2, -5, -16, -6, 'STEEL SHIMS / EMACO S88C\nGROUT (REFER NOTES)'); B.title(120, 0, 'STEEL STRINGER PACKING DETAIL', 10, 'ALL DECK PLANKS REQUIRE BEARING ON STRINGER');
    B.notes(235, 105, ['STRINGER SPLICE TO BE SHOP FABRICATED AND PRE-ASSEMBLED.', 'CONTACT FACES OF SPLICE PLATES TO BE GRIT BLASTED BACK TO BRIGHT STEEL PRIOR TO INSTALLATION.', 'SPLICE JOINT TO BE COLD GALVANISED AFTER STRINGER INSTALLATION.', 'GAP < 20mm: PACK WITH STEEL SHIMS TACK WELDED TO UB. GAP 20-40mm: PACK WITH EMACO S88C GROUT; FORM ONE FACE, TROWEL THE OTHER. GAP > 40mm: ENGINEERING INPUT REQUIRED.', 'SPLICE DETAILS ONLY APPROPRIATE FOR 410 UB 54 OR SMALLER MEMBER.'], 95);
    return B.E;
  });

  // 20 CORBEL REPLACEMENT TYPE 1 (1330-0026)
  def('cr1', 'Stringers', 'Corbel replacement – Type 1 (steel corbel)', '1330-0026', [P('uc', 'Proposed UC corbel', '310UC97', { opts: UCs }), P('ub', 'Proposed stringer', '410UB54', { opts: UBs })], (p) => {
    const B = new Builder(), c = SEC[p.uc] || SEC['310UC97'], s = SEC[p.ub] || SEC['410UB54'], v = B.view(10, 70, 100), hc = 300;
    v.rect(-175 - 170, -hc, 170, hc, 'S-EXIST'); v.rect(175, -hc, 170, hc, 'S-EXIST'); [-1, 1].forEach(k => { v.line(k * 175, -hc, k * 345, 0, 'S-EXIST'); v.line(k * 175, 0, k * 345, -hc, 'S-EXIST'); });
    iElevWebH(v, -500, 500, c.d / 2 + 12, c); v.rect(-175 - 200, 0, 200, 12, 'S-NEW'); v.rect(175, 0, 200, 12, 'S-NEW'); [-1, 1].forEach(k => { aSec(v, k * 175, 12, 200, 200, 13, k, 1, 'S-NEW'); rod(v, k * 260, 60, k * 260, -hc - 60, 65); });
    iElevWebH(v, 10, 1500, c.d + 12 + s.d / 2, s); v.rect(-1500, c.d + 12, 1500 - 10, 330, 'S-EXIST'); v.cl(0, -hc - 200, 0, c.d + s.d + 200, 'PIER PILE');
    v.dim(-500, c.d + s.d + 120, 500, c.d + s.d + 120, 6, '1000'); v.dim(-175, -hc - 120, 175, -hc - 120, -6, '350'); v.dim(0, c.d + s.d + 60, 10, c.d + s.d + 60, 6, '10');
    v.leader(-450, c.d / 2, -18, -6, 'PROPOSED STEEL\nCORBEL ' + secName(p.uc)); v.leader(800, c.d + s.d / 2, 14, 16, 'PROPOSED STEEL STRINGER'); v.leader(-800, c.d + 200, -12, 18, 'EXISTING TIMBER\nSTRINGER'); v.leader(-260, -hc - 60, -16, -12, 'φ20 THREADED ROD WITH 65x5FLx65\nWASHER TO TIMBER FACE (TYP.)'); v.leader(375, 6, 16, -18, '200x(6,8,10 OR 12FL)x300 LONG\nSTEEL SHIMS'); v.leader(-345, -hc / 2, -14, -4, 'EXISTING TIMBER\nHALFCAP (TYP.)');
    B.title(80, 25, 'CORBEL REPLACEMENT DETAIL - TYPE 1', 10, 'ELEVATION');
    const w = B.view(10, 225, 95); iSec(w, 0, c.d / 2, c, 0); iSec(w, 0, c.d + s.d / 2, s, 0); [-1, 1].forEach(k => aSec(w, k * 5, -13, 200, 200, 13, k, 1, 'S-NEW')); w.rect(-150, -13 - 300, 300, 300, 'S-EXIST'); [-100, 100].forEach(x => boltSym(w, x, 0 - 13 + 40, 20)); [-45, 45].forEach(x => boltSym(w, x, c.d + 12, 20));
    w.dim(-100, -360, 100, -360, -6, '200'); w.dim(-45, c.d + s.d + 40, 45, c.d + s.d + 40, 6, '90'); w.leader(c.b / 2, c.d / 2, 16, 4, '10FL STIFFENER (TYP.)'); w.leader(150, -40, 16, -12, '200x200x13 EA x300 LONG (TYP.)\nφ22 HOLES TO SUIT M20 BOLTS');
    B.title(225, 50, 'SECTION A', 10);
    B.notes(150, 40, ['STEEL SHIMS USED TO PACK STEEL STRINGER TIGHT AGAINST EXISTING DECKING AND ACHIEVE FULL BEARING. TACK WELD STEEL PACKERS TO CORBEL AFTER PLACEMENT.', 'CONTINUOUS TIMBER PACKERS (F11 SEASONED JARRAH) TO ACHIEVE TIGHT FIT BETWEEN CORBEL AND EXISTING TIMBER STRINGER WHERE THE TIMBER STRINGER IS RETAINED (SECTION B).', 'ALL WELDS 6mm CONTINUOUS FILLET UNO.'], 120);
    return B.E;
  });

  // 21 HALF-CAP REPLACEMENT (1330-0027)
  def('hcr', 'Halfcaps', 'Half-cap replacement (PFC) & pile connection', '1330-0027', [P('pfc', 'PFC halfcap', '300PFC', { opts: ['300PFC', '380PFC'] }), P('D', 'Pile dia. (mm)', 360, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.pfc] || SEC['300PFC'], D = +p.D || 360, v = B.view(10, 60, 100);
    iElevWebH(v, -600, 600, s.d / 2, s); pileElev(v, 0, -900, -100, D); v.rect(-150, -100, 300, 100, 'S-NEW'); v.line(-D / 2, -100 - 0, D / 2, -100, 'S-NEW'); [-100, 100].forEach(x => boltSym(v, x, s.d / 2, 20));
    v.dim(-150, -160, 150, -160, -6, '300'); v.dim(-D / 2 - 30, -100, -D / 2 - 30, 0, 8, '100'); v.dim(-D / 2, -40, -D / 2 + 25, -40, -6, '25 NOTCH');
    v.leader(400, s.d * 0.8, 16, 10, 'PROPOSED STEEL\nPFC HALFCAP'); v.leader(150, -50, 16, -10, 'SHIM PLATE'); v.leader(D / 2, -400, 16, -6, 'EXISTING TIMBER PILE'); v.leader(-100, s.d / 2, -18, 14, 'φ20 THREADED ROD OR φ20 U-ROD');
    B.title(60, 15, 'HALFCAP TO PILE CONNECTION DETAIL - TYPE 1', 10, 'ELEVATION');
    const w = B.view(10, 200, 100); pileElev(w, 0, -900, -110, D); cSec(w, -70, s.d / 2, s, -1); w.rect(-70 - s.b, -10, s.b + D / 2 + 70, 10, 'S-NEW'); w.line(-70 - s.b - 40, s.d * 0.7, D / 2 + 40, s.d * 0.7, 'S-BOLT');
    w.dim(-70, -200, D / 2, -200, -6, '70 MIN. BEARING (>φ340)'); w.leader(-70 - s.b, 0, -18, -12, '130x(6,8,10 OR 12FL)x300 LONG GALV\nSTEEL SHIM IF REQUIRED'); w.leader(D / 2, -400, 14, -8, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED PFC');
    B.title(200, 15, 'SECTION A', 10);
    B.notes(255, 100, ['MAKE GOOD DAMAGED GALV. SURFACE BY APPLYING COLD GALV. OR SIMILAR APPROVED.', 'IF EXISTING BEARING IS LESS THAN REQUIRED MIN. REFER PILE - HALF-CAP BEARING DETAILS.', 'MINIMUM DISTANCE BETWEEN MODIFIED FLANGE AND PFC FLANGE TO BE DETERMINED BY ENGINEER.', 'PROPOSED PFC TO BE DRILLED ON SITE AND NEW BOLTS PROVIDED TO SUIT EXISTING PILE CONNECTION. ABUTMENT: φ20 THREADED U-ROD; PIER: 2 THREADED RODS THROUGH BOTH PFCs WITH SHIM PLATES.'], 120);
    return B.E;
  });

  // ------------------------------------------------------------------ helpers for the editor
  function generate(id, params) { const d = DEF.find(q => q.id === id); if (!d) return []; const p = {}; d.params.forEach(q => { p[q.k] = params && params[q.k] != null ? params[q.k] : q.v; }); return GEN[id](p); }
  function bbox(E) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    E.forEach(e => { if (e.t === 'line') { add(...e.a); add(...e.b); } else if (e.t === 'pl' || e.t === 'hatch' || e.t === 'solid') e.p.forEach(q => add(...q)); else if (e.t === 'circle' || e.t === 'arc') { add(e.c[0] - e.r, e.c[1] - e.r); add(e.c[0] + e.r, e.c[1] + e.r); } else if (e.t === 'text') { const w = e.s.length * e.h * 0.62, x = e.al === 'c' ? e.p[0] - w / 2 : e.al === 'r' ? e.p[0] - w : e.p[0]; add(x, e.p[1] - e.h); add(x + w, e.p[1] + e.h); } });
    return x0 > x1 ? { x0: 0, y0: 0, x1: 1, y1: 1 } : { x0, y0, x1, y1 }; }
  // repair families suggested by the timber assessment
  const SUGGEST = { stringer: ['sbf', 'stf', 'ssp', 'cr1'], pierPile: ['pp2a', 'pp4', 'pp4c', 'pphc1'], abutPile: ['ap1a', 'atA'], halfcap: ['phs', 'hcr', 'hcb'], bearing: ['hcb', 'phs'], wing: ['ww1', 'ww2', 'ww3'], sheeting: ['shc', 'sht1', 'srr'], planks: ['stf'] };
  G.TDET = { DEF, generate, bbox, LAYERS, SEC, SUGGEST, Builder };
})(typeof window !== 'undefined' ? window : globalThis);
