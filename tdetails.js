/* StructCap Timber — library of standard timber bridge repair details (parametric, vector).
   Redrawn after the MRWA Structures Engineering project standard drawings 1330-0001 … 1330-0027
   (pier / abutment / wing wall pile repairs, sheeting, spiking rail, halfcap strengthening and bearing,
   stringer replacement connections, splices, corbels, halfcap replacement), plus details redrawn after the timber bridge
   repair manual practice-note sheets PN30-xxxx (pile banding, welded pile repairs, pile strengthening, steel pile bearing,
   scour repair, wingwall extension, halfcap / fullcap replacement and widening, stringer strengthening and bolting,
   concrete overlay, kerb, joints, sill beam and expansion angles). Each generator returns entities in
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
  def('atA', 'Abutments', 'Abutment pile top connection – Type A', '1330-0014', [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('X', "Dimension 'X' (mm)", 60, { num: 1 }), P('hc', 'Halfcap / fullcap depth (mm)', 300, { num: 1 })], (p) => {
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

  // ================================================================== additional details (second set)
  const ellP = (cx, cy, rx, ry, n) => Array.from({ length: n || 28 }, (_, i) => { const a = 2 * PI * i / (n || 28); return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
  // channel seen in elevation (web face), horizontal from x0..x1, top at yt
  function pfcElevH(v, x0, x1, yt, s, L) { v.rect(x0, yt - s.d, x1 - x0, s.d, L || 'S-NEW'); v.line(x0, yt - s.tf, x1, yt - s.tf, L || 'S-NEW'); v.line(x0, yt - s.d + s.tf, x1, yt - s.d + s.tf, L || 'S-NEW'); }
  // timber cap / packer in section (rectangle with diagonal cross = "timber" convention)
  function timberX(v, x, y, w, h, L) { v.rect(x, y, w, h, L || 'S-EXIST'); v.line(x, y, x + w, y + h, L || 'S-EXIST'); v.line(x, y + h, x + w, y, L || 'S-EXIST'); }
  // auto layout for the second set: each view is drawn about its own origin, then views are flowed left to right
  // (top aligned, wrapping at maxW paper mm) with the view title under each, notes last and captions under all.
  function shiftE(e, dx, dy) { const f = q => [q[0] + dx, q[1] + dy]; if (e.a) e.a = f(e.a); if (e.b) e.b = f(e.b); if (e.c) e.c = f(e.c); if (e.p) e.p = Array.isArray(e.p[0]) ? e.p.map(f) : f(e.p); }
  function Lay(maxW) { this.G = []; this.cap = []; this.nt = null; this.maxW = maxW || 470; }
  Lay.prototype.view = function (s) { const g = { B: new Builder(), t: null }; this.G.push(g); return new View(g.B, s, 0, 0); };
  Lay.prototype.title = function (s, scale, sub) { const g = this.G[this.G.length - 1]; if (!g || g.t) this.cap.push([s, scale, sub]); else g.t = [s, scale, sub]; };
  Lay.prototype.notes = function (lines, w) { this.nt = [lines, min(w || 120, 170)]; };
  Lay.prototype.done = function () {
    const out = [], gap = 24; let x = 0, y = 0, rowH = 0;
    const parts = this.G.map(g => { const E = g.B.E; if (g.t) { const bb = bbox(E), tb = new Builder(); tb.title((bb.x0 + bb.x1) / 2, bb.y0 - 9, g.t[0], g.t[1], g.t[2]); E.push(...tb.E); } return E; });
    if (this.nt) { const nb = new Builder(); nb.notes(0, 0, this.nt[0], this.nt[1]); parts.push(nb.E); }
    parts.forEach(E => { if (!E.length) return; const bb = bbox(E), w = bb.x1 - bb.x0, h = bb.y1 - bb.y0; if (x > 0 && x + w > this.maxW) { y -= rowH + gap; x = 0; rowH = 0; } E.forEach(e => shiftE(e, x - bb.x0, y - bb.y1)); out.push(...E); x += w + gap; rowH = max(rowH, h); });
    const ob = bbox(out); let cy = ob.y0 - 12; this.cap.forEach(c => { const tb = new Builder(); tb.title((ob.x0 + ob.x1) / 2, cy, c[0], c[1], c[2]); out.push(...tb.E); cy -= 14; });
    return out;
  };
  // log stringer / pile seen end-on (circle with existing linetype)
  const logEnd = (v, x, y, r) => v.circ(x, y, r, 'S-EXIST');

  // 22 TIMBER SHEETING REPAIR TYPES 2 / 2A / 3 (1330-0010)
  def('sht2', 'Sheeting', 'Timber sheeting repair – Types 2 / 2A / 3 (steel pile or concrete)', '1330-0010', [P('type', 'Type', '2', { opts: ['2', '2A', '3'] }), P('n', 'Number of boards replaced', 3, { num: 1 }), P('uc', 'Existing steel pile', '250UC73', { opts: UCs })], (p) => {
    const LY = new Lay(), t = String(p.type), n = max(1, min(8, +p.n || 3)), s = SEC[p.uc] || SEC['250UC73'], v = LY.view(10), conc = t === '3';
    // PLAN — sheeting front face y = 0, back face y = 75, fill behind
    v.line(-700, 75, 900, 75, 'S-EXIST'); v.line(-700, 0, -150 - s.b / 2, 0, 'S-EXIST'); v.ground(-600, 800, 75 + 2);
    if (!conc) {
      const yf = t === '2' ? -50 : -55, xh = -150 + 20; iSec(v, -150, yf - s.d / 2, s, 0, 'S-EXIST');
      if (t === '2') { timberX(v, -150 - s.b / 2, -50, s.b / 2 + 10, 50); v.rect(xh - 20, yf, 20, 150, 'S-NEW'); }
      aSec(v, xh, yf, 100, 150, t === '2' ? 8 : 10, -1, 1, 'S-NEW'); v.rect(xh + 10, 0, 900 - xh - 10, 75, 'S-NEW');
      v.line(xh - 50, yf + 25, xh - 50, yf - s.tf - 20, 'S-BOLT'); v.line(xh - 15, 37, xh + 85, 37, 'S-BOLT');
      v.dim(-150 - s.b / 2 - 40, 0, -150 - s.b / 2 - 40, yf, 6, String(-yf));
      v.leader(xh - 50, yf - s.tf - 15, -16, -12, 'M12 BOLT'); v.leader(-150, yf - s.d + 20, -16, -10, 'EXISTING STEEL PILE (TYP.)'); v.leader(xh + 5, yf + 120, -8, 22, (t === '2' ? '150x100x8 UA' : '150x100x10 UA') + (t === '2' ? '\n100x20FL x LENGTH TO SUIT REPAIR' : ''));
      if (t === '2') v.leader(-150 - s.b / 4, -25, -18, 14, 'EXISTING TIMBER PACKER\n(PACK TO SUIT WITH STEEL SHIMS)');
    } else {
      v.rect(-650, -600, 650, 600, 'S-EXIST'); v.line(0, 0, 0, 75, 'S-EXIST'); aSec(v, 0, 0, 150, 90, 8, 1, -1, 'S-NEW'); v.rect(0, 0, 900, 75, 'S-NEW');
      v.line(-120, -45, 8, -45, 'S-BOLT'); v.line(90, -8, 90, 60, 'S-BOLT'); v.dim(0, -130, 90, -130, -6, '90'); v.dim(0, 120, 55, 120, 6, '55');
      v.leader(-300, -600, -16, -8, 'EXISTING CONCRETE PILE REPAIR'); v.leader(4, -70, 18, -14, '150x90x8 UA (GALV.)\nLENGTH TO SUIT');
    }
    v.leader(600, 37, 14, 18, 'PROPOSED 225x75 THICK\nSEASONED JARRAH SHEETING (TYP.)'); v.leader(-500, 75, -6, 14, 'EXISTING ABUTMENT\nTIMBER SHEETING');
    LY.title('PLAN', 10);
    // ELEVATION
    const w = LY.view(10), H = (n + 2) * 225;
    for (let i = 0; i <= n + 2; i++) w.line(-650, -i * 225, 800, -i * 225, i >= 1 && i <= n + 1 ? 'S-NEW' : 'S-EXIST');
    if (!conc) { iElevFlange(w, -150, -H - 80, 80, s, 'S-EXIST'); w.rect(-130, -(n + 1) * 225, 10, n * 225, 'S-NEW'); for (let i = 0; i < n; i++) { const y = -(i + 1) * 225 - 112; boltSym(w, -150, y, 14); w.circ(-100, y, 7, 'S-BOLT'); w.line(-112, y, -60, y, 'S-BOLT'); } w.cl(-150, 120, -150, -H - 120, 'PILE'); w.dim(-150, 60, -100, 60, 6, '30'); }
    else { w.rect(-650, -H - 60, 650, H + 120, 'S-EXIST'); w.rect(0, -(n + 1) * 225, 90, n * 225, 'S-NEW'); for (let i = 0; i < n; i++) { const y = -(i + 1) * 225 - 112; boltSym(w, 30, y - 30, 14); w.circ(55, y + 20, 7, 'S-BOLT'); } w.dim(0, 60, 55, 60, 6, '55'); w.dim(0, 110, 90, 110, 6, '90'); }
    w.dim(820, -225, 820, -450, -6, '225 (TYP.)');
    w.hatch(ellP(420, -337, 140, 45, 24), 'ansi31', 'S-HATCH'); w.pl(ellP(420, -337, 140, 45, 24), true, 'S-TEXT'); w.leader(560, -337, 16, -6, 'REPAIR LOCATION (TYP.)');
    if (!conc) { w.leader(-150, -337, -16, 10, 'M12 BOLT (TYP.)'); w.leader(-100, -(n) * 225 - 112, 14, -18, 'M12x75 LONG\nCOACH SCREW (TYP.)'); }
    else { w.leader(30, -367, -18, 8, 'M12x75 LONG BLUE-TIP SCREW BOLT\nAT 225 CRS (OR SIMILAR APPROVED)'); w.leader(55, -(n) * 225 - 92, 14, -18, 'M12x75 LONG COACH SCREW FIXED\nCENTRALLY IN PROPOSED SHEET (1 PER SHEET)'); }
    LY.title('TYPE ' + t + (t === '2' ? ' - STEEL PILE CONNECTION WITH EXISTING TIMBER PACKER' : t === '2A' ? ' - STEEL PILE CONNECTION' : ' - CONCRETE CONNECTION'), 10, 'ELEVATION');
    LY.notes(['LOCATIONS AND EXTENT OF REPAIRS SHALL BE CONFIRMED ON SITE BY THE CONTRACTOR TO THE APPROVAL OF THE SUPERINTENDENT.', 'PROPOSED SHEETING 225x75 SEASONED JARRAH, TRIMMED TO SUIT EXISTING PILE. STEEL SHIMS TO SUIT.', 'ALL STEELWORK HOT-DIP GALVANISED AFTER FABRICATION.'], 100);
    return LY.done();
  }, 'Abutment / wing wall sheeting replacement where the piles are steel (Types 2, 2A) or have a concrete pile repair (Type 3).');

  // 23 ABUTMENT TOP CONNECTION TYPES B / C (1330-0015)
  def('atBC', 'Abutments', 'Abutment top connection – Types B / C (UC corbel)', '1330-0015', [P('type', 'Type', 'B', { opts: ['B', 'C'] }), P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(), s = SEC[p.uc] || SEC['200UC52'], hc = +p.hc || 300, full = p.type !== 'C', v = LY.view(10), cw = full ? 300 : 170;
    // ELEVATION (section through abutment): sheeting at x = 0..-75, pile & corbel in front
    v.line(0, -900, 0, hc + 60, 'S-EXIST'); v.line(-75, -900, -75, hc + 600, 'S-EXIST');
    iElevWebV(v, s.d / 2, -900, -s.d, s); const cl = s.d + 220; iElevWebH(v, 0, cl, -s.d / 2, s); v.line(s.d, -s.d, cl, 0, 'S-NEW'); // mitre
    v.line(s.d / 2 - 6, -s.d, s.d / 2 - 6, 0, 'S-NEW'); v.line(s.d / 2 + 6, -s.d, s.d / 2 + 6, 0, 'S-NEW');
    timberX(v, 20, 0, cw, hc); cSec(v, 20 + cw, hc / 2, SEC['150PFC'], 1, 'S-NEW'); rod(v, 0, hc * 0.3, 20 + cw + 120, hc * 0.3, 65); rod(v, 0, hc * 0.72, 20 + cw + 120, hc * 0.72, 65);
    v.circ(20 + cw / 2 + 200, hc + 340, 240, 'S-EXIST'); v.line(-75, hc + 600, cl + 600, hc + 600, 'S-EXIST'); v.line(-75, hc + 700, cl + 600, hc + 700, 'S-EXIST');
    v.circ(s.d / 2 + 60, -s.d / 2, 230, 'S-TEXT'); v.mark(s.d / 2 + 60 + 230 * 0.7, -s.d / 2 - 230 * 0.7 - 50, '2');
    v.dim(20 + cw, hc + 40, 20 + cw + 20, hc + 40, 6, '20'); v.dim(cl + 60, -20, cl + 60, 0, -6, '20');
    v.leader(-75, -500, -14, 6, 'EXISTING TIMBER\nSHEETING'); v.leader(s.d / 2, -700, 18, -6, 'PROPOSED UC PILE ' + secName(p.uc)); v.leader(cl - 40, -s.d / 2, 22, -10, 'PROPOSED UC CORBEL TO MATCH PROPOSED\nUC PILE SIZE, LENGTH TO SUIT'); v.leader(s.d / 2 + 6, -s.d + 30, 26, -30, '12PL STIFFENER (TYP.)');
    v.leader(20 + cw * 0.5, hc * 0.5, 20, 26, 'EXISTING TIMBER ' + (full ? 'FULL-CAP' : 'HALF-CAP (TYP.)')); v.leader(20, hc * 0.1, -18, 16, 'PROVIDE GALV. STEEL SHIMS IF\nREQUIRED TO ENSURE TIGHT FIT'); v.leader(20 + cw / 2 + 200, hc + 500, 24, 10, 'EXISTING TIMBER STRINGER / DECKING');
    LY.title('ABUTMENT TOP CONNECTION DETAIL - TYPE ' + (full ? 'B' : 'C'), 10, 'ELEVATION');
    // VIEW (along the cap)
    const w = LY.view(10); w.rect(-500, 0, 1000, hc, 'S-EXIST'); w.circ(0, hc + 340, 240, 'S-EXIST'); w.line(-500, hc + 600, 500, hc + 600, 'S-EXIST');
    iElevFlange(w, 0, -900, -s.d, s); w.rect(-s.b / 2, -s.d, s.b, s.d, 'S-NEW'); w.rect(-35, -10, 70, hc - 10, 'S-NEW'); [hc * 0.3, hc * 0.72].forEach(y => boltSym(w, 0, y, 20));
    w.leader(-35, hc * 0.5, -20, 14, 'REFER TO HALF-CAP / FULL-CAP\nCONNECTION CHANNEL - TYPE 1'); w.leader(0, hc * 0.72, 18, 14, 'φ20 THREADED ROD WITH 65x5FLx65\nWASHER TO TIMBER FACE (TYP.)'); w.leader(-s.b / 2, -s.d / 2, -16, -10, '20 CHAMFER TO STIFFENERS\nTO CLEAR UC PILE RADIUS'); w.dim(s.b / 2, -s.d - 60, s.b / 2 + 10, -s.d - 60, -6, '10');
    LY.title('VIEW ' + (full ? 'E' : 'G'), 10);
    // DETAIL 2 (mitre)
    const d = LY.view(5); iElevWebV(d, 0, -260, -s.d, s); iElevWebH(d, -s.d / 2, 220, -s.d / 2, s); d.line(s.d / 2, -s.d, 220, 0, 'S-NEW'); d.hatch([[s.d / 2 - 2, -s.d], [s.d / 2 + 30, -s.d], [220, -2], [220, 0], [190, 0]], 'ansi31', 'S-HATCH');
    d.leader(110, -s.d / 2, 16, 10, 'MITRE CUT'); d.leader(-s.d / 2 + 10, -s.d - 100, -14, -8, '90° OUTSIDE CORNER\nFILLET WELD'); d.text(230, -s.d / 2, '6', 2.4);
    LY.title('DETAIL 2', 5);
    LY.notes(['TIMBER HALF-CAPS / FULL-CAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL POSITIONS.', 'STEEL SHIMS (3, 5, 8, 10 OR 12 FL) WIDTH AND LENGTH TO SUIT. TACK WELD TOGETHER ONCE IN PLACE.', 'IF A TIMBER PACKER IS REQUIRED BETWEEN THE PROPOSED UC PILE AND THE EXISTING SHEETING REFER TO THE TIMBER PACKING OPTION.'], 125);
    return LY.done();
  });

  // 24 HALF-CAP / FULL-CAP CONNECTION CHANNEL TYPES 1 / 2 + TIMBER PACKING OPTION (1330-0015 / 0017)
  def('hcch1', 'Halfcaps', 'Half-cap / full-cap connection channel – Types 1 / 2', '1330-0015', [P('type', 'Type', 1, { opts: [1, 2], num: 1 }), P('pfc', 'PFC size', '150PFC', { opts: ['125PFC', '150PFC', '180PFC', '200PFC'] }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(), t = +p.type || 1, s = SEC[p.pfc] || SEC['150PFC'], hc = +p.hc || 300, e = s.d <= 125 ? 35 : 45, v = LY.view(10);
    const top = t === 2 ? hc + 180 : hc - 20, bot = t === 2 ? -75 : -100; // Type 2 extends to underside of spiking rail
    v.rect(0, bot, s.b, top - bot, 'S-NEW'); v.line(s.tw, bot, s.tw, top, 'S-NEW'); [t === 2 ? hc - 100 : hc - 80, t === 2 ? 0 : 0].forEach((y, i) => v.circ(e, i ? y + 40 : y, 11, 'S-BOLT'));
    v.line(-180, 0, 250, 0, 'S-TEXT'); v.wl(-150, 0, 'UNDERSIDE OF HALF-CAP / FULL-CAP'); if (t === 2) { v.line(-180, hc + 180, 250, hc + 180, 'S-TEXT'); v.wl(-150, hc + 180, 'UNDERSIDE OF SPIKING RAIL'); } else { v.line(-180, hc, 250, hc, 'S-TEXT'); v.wl(-150, hc, 'TOP OF HALF-CAP / FULL-CAP'); }
    v.dim(0, top + 40, e, top + 40, 6, e + ' (' + secName(p.pfc) + ')'); v.dim(s.b + 30, 0, s.b + 30, t === 2 ? 0 - 75 : -100, -6, t === 2 ? '75' : '100'); v.dim(s.b + 30, top - (t === 2 ? 100 : 80), s.b + 30, top, -6, t === 2 ? '100' : '80');
    if (t === 1) v.dim(s.b + 70, hc - 20, s.b + 70, hc, -6, '20 BELOW TOP');
    v.leader(e, 40, 18, -12, 'φ22 HOLE (TYP.)'); v.leader(s.b, bot + 40, 18, -10, '125, 150, 180 OR 200 PFC\nLENGTH TO SUIT');
    LY.title('HALF-CAP / FULL-CAP CONNECTION CHANNEL - TYPE ' + t, 10, 'ELEVATION');
    // TIMBER PACKING OPTION
    const w = LY.view(10), S2 = SEC['200UC52']; iElevWebV(w, 0, -500, -S2.d, S2); w.line(-S2.d / 2 - 75, -500, -S2.d / 2 - 75, 400, 'S-EXIST'); w.line(-S2.d / 2 - 150, -500, -S2.d / 2 - 150, 400, 'S-EXIST');
    timberX(w, -S2.d / 2 - 75, -500, 75, 500 - 20, 'S-NEW'); iElevWebH(w, -S2.d / 2, 250, -S2.d / 2, S2); w.rect(-S2.d / 2, 0, 180, 300, 'S-NEW'); w.rect(60, 0, 50, 380, 'S-NEW');
    w.dim(-S2.d / 2 - 75, -20, -S2.d / 2 - 75, 0, 6, '20'); w.leader(-S2.d / 2 - 37, -300, -16, -6, 'PROPOSED\nTIMBER PACKER'); w.leader(60, 300, 14, 12, 'HALF-CAP / FULL-CAP CONNECTION\nCHANNEL, TYPE 1 OR TYPE 2'); w.leader(-S2.d / 2 + 90, 150, -18, 22, '180 PFC'); w.leader(250, -S2.d / 2, 16, -8, 'ABUTMENT TOP CONNECTION\nTYPE B, C, E OR F');
    LY.title('PILE CONNECTION - TIMBER PACKING OPTION', 10);
    LY.notes(['TYPE 1: 20 BELOW TOP OF CAP. TYPE 2: CHANNEL EXTENDS TO THE UNDERSIDE OF THE SPIKING RAIL.', '35 EDGE DISTANCE FOR 125 PFC; 45 FOR 150, 180 OR 200 PFC.', 'CHANNEL SHIMMED TO FIT THE GAP BETWEEN THE EXISTING TIMBER CAP AND THE PROPOSED CORBEL. 6mm FILLET WELD ALL ROUND.'], 120);
    return LY.done();
  });

  // 25 ABUTMENT TOP CONNECTION TYPES D / E (1330-0016)
  def('atDE', 'Abutments', 'Abutment top connection – Types D / E', '1330-0016', [P('type', 'Type', 'D', { opts: ['D', 'E'] }), P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('X', "Packing 'X' (mm)", 40, { num: 1 }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(), s = SEC[p.uc] || SEC['200UC52'], hc = +p.hc || 300, X = max(0, +p.X || 0), E = p.type === 'E', v = LY.view(10), pf = SEC['300PFC'];
    v.line(0, -900, 0, hc + 700, 'S-EXIST'); v.line(-75, -900, -75, hc + 700, 'S-EXIST'); const xc = X + s.d / 2;
    if (X) timberX(v, 0, -900, X, 900 + hc, 'S-NEW');
    if (!E) { // Type D: UC pile up to the cap; PFC half-cap; corbel 200 long under
      iElevWebV(v, xc, -900, hc + 100, s); pfcElevH(v, X + s.d, X + s.d + 700, hc, pf, 'S-NEW'); timberX(v, X + s.d, hc, 400, 0.01); iElevWebH(v, X + s.d, X + s.d + 200, -s.d / 2 + 0, s);
      [hc - 75, hc - 175].forEach(y => { v.line(X - 20, y, X + s.d + 120, y, 'S-BOLT'); }); v.circ(X + s.d + 80, hc + 300, 240, 'S-EXIST'); v.line(-75, hc + 560, X + s.d + 900, hc + 560, 'S-EXIST'); v.line(-75, hc + 660, X + s.d + 900, hc + 660, 'S-EXIST');
      v.dim(X + s.d + 260, hc + 0, X + s.d + 260, hc + 20, -6, '20'); v.leader(xc, -600, 18, -6, 'PROPOSED UC PILE ' + secName(p.uc)); v.leader(X + s.d + 400, hc - pf.d / 2, 18, -8, 'EXISTING OR PROPOSED PFC HALF-CAP'); v.leader(X + s.d + 100, -s.d / 2, 18, -16, 'PROPOSED UC CORBEL TO MATCH\nPROPOSED UC PILE SIZE x200 LONG\n2x10FL WEB STIFFENERS NEAR AND FAR FACE');
      v.leader(X + s.d + 120, hc - 75, 26, 20, '2 No. φ20 THREADED RODS WITH\n65x5FLx65 WASHER, SITE DRILL');
    } else { // Type E: PFC packer from spiking rail to corbel; timber halfcap
      const yk = hc + 450; timberX(v, 0, yk, 200, 180); v.rect(0, yk + 180, 260, 120, 'S-EXIST'); cSec(v, 75, hc - 60 + (yk - hc) / 2, Object.assign({}, SEC['200PFC'], { d: yk - (-s.d) + 0 }), 1, 'S-NEW');
      iElevWebV(v, xc + 80, -900, -s.d, s); iElevWebH(v, 75, xc + 80 + s.d / 2 + 150, -s.d / 2, s); timberX(v, 75 + 75, 0, 170, hc); rod(v, 50, hc * 0.3, 75 + 75 + 170 + 40, hc * 0.3, 65); rod(v, 50, hc * 0.72, 75 + 75 + 170 + 40, hc * 0.72, 65);
      v.leader(100, yk + 90, 20, 18, 'EXISTING SPIKING RAIL'); v.leader(130, yk + 240, 20, 10, 'EXISTING TIMBER CAPPING'); v.leader(75, hc + 200, -18, 10, 'PROPOSED PFC PACKER'); v.leader(75 + 160, hc * 0.5, 22, 4, 'EXISTING TIMBER HALF-CAP (TYP.)'); v.leader(xc + 80, -600, 18, -6, 'PROPOSED UC PILE ' + secName(p.uc)); v.leader(xc + 80 + s.d / 2 + 100, -s.d / 2, 18, -12, 'PROPOSED UC CORBEL TO MATCH PILE,\nLENGTH TO SUIT; 12PL STIFFENERS');
      v.dim(75 + 75 + 170, hc + 40, 75 + 75 + 170 + 20, hc + 40, 6, '20');
    }
    v.leader(-75, -400, -14, 6, 'EXISTING TIMBER\nSHEETING'); if (X) { v.dim(0, -980, X, -980, -6, "'X'"); v.leader(X / 2, -250, -18, -16, "TIMBER OR STEEL PACKING - REFER\nDIMENSION 'X' ON TYPE A DETAIL"); }
    LY.title('ABUTMENT TOP CONNECTION DETAIL - TYPE ' + (E ? 'E' : 'D'), 10, 'ELEVATION');
    // SECTION through cap
    const w = LY.view(10); w.rect(-450, hc, 900, 75, 'S-EXIST'); if (!E) { pfcElevH(w, -450, 450, hc, pf, 'S-EXIST'); iSec(w, 0, hc - pf.d - s.b / 2 - 10, s, 1, 'S-NEW'); [-45, 45].forEach(x => boltSym(w, x, hc - pf.d + 10, 20)); w.leader(0, hc - pf.d - s.b / 2, 18, -14, 'PROPOSED UC PILE'); w.leader(-300, hc - pf.d / 2, -14, -12, 'EXISTING OR PROPOSED\nPFC HALF-CAP'); w.leader(45, hc - pf.d + 10, 20, 8, '2 No. φ22 HOLES TO SUIT\nM20 BOLTS, SITE DRILL'); w.dim(-460, hc - pf.d - s.b, -460, hc, 6, 'GAP VARIES'); }
    else { w.rect(-170 - 70, 0, 170, hc, 'S-EXIST'); w.rect(70, 0, 170, hc, 'S-EXIST'); w.rect(-70, 20, 140, hc - 20, 'S-NEW'); cSec(w, -SEC['150PFC'].b / 2, hc / 2, SEC['150PFC'], 1); iSec(w, 0, -s.b / 2, s, 1, 'S-NEW'); w.leader(0, hc / 2, 18, 18, '125 - 200 PFC SHIMMED TO FIT GAP\nBETWEEN TIMBER HALF-CAP AND\nPROPOSED CONNECTION CHANNEL'); w.leader(0, -s.b / 2, 18, -10, 'PROPOSED UC CORBEL'); }
    LY.title('SECTION ' + (E ? 'N' : 'L'), 10);
    LY.notes(['TIMBER HALF-CAPS / FULL-CAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL POSITIONS.', 'STEEL SHIMS (3, 5, 8, 10 OR 12 FL) WIDTH AND LENGTH TO SUIT. TACK WELD TOGETHER ONCE IN PLACE.', E ? 'FOR TYPE E, IF A TIMBER PACKER IS REQUIRED BETWEEN THE UC PILE AND THE SHEETING REFER TIMBER PACKING OPTION (1330-0015).' : 'FOR TYPE D PROVIDE 2x10FL WEB STIFFENERS TO NEAR AND FAR FACE OF THE CORBEL.'], 125);
    return LY.done();
  });

  // 26 ABUTMENT TOP CONNECTION TYPES F / G (1330-0017)
  def('atFG', 'Abutments', 'Abutment top connection – Types F / G (spiking rail)', '1330-0017', [P('type', 'Type', 'F', { opts: ['F', 'G'] }), P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(), s = SEC[p.uc] || SEC['200UC52'], hc = +p.hc || 300, G2 = p.type === 'G', v = LY.view(10), yk = hc + 450;
    v.line(0, -900, 0, yk + 300, 'S-EXIST'); v.line(-75, -900, -75, yk + 300, 'S-EXIST'); timberX(v, 0, yk, 200, 180); v.rect(-40, yk + 180, 300, 120, 'S-EXIST');
    if (!G2) { timberX(v, 0, -100, 80, yk + 100 - 0, 'S-EXIST'); cSec(v, 80, (yk + 0) / 2, Object.assign({}, SEC['200PFC'], { d: yk }), 1, 'S-NEW'); timberX(v, 80 + 75, 0, 170, hc); rod(v, 60, hc * 0.3, 80 + 75 + 170 + 40, hc * 0.3, 65); rod(v, 60, hc * 0.72, 80 + 75 + 170 + 40, hc * 0.72, 65);
      iElevWebV(v, 80 + s.d / 2, -900, -s.d, s); iElevWebH(v, 80, 80 + s.d + 220, -s.d / 2, s); v.line(80 + s.d, -s.d, 80 + s.d + 220, 0, 'S-NEW');
      v.leader(40, yk - 300, -18, 6, 'TIMBER PACKER'); v.leader(130, yk - 150, 22, 12, 'PROPOSED PFC PACKER (15° TOP CUT)'); v.leader(80 + 160, hc * 0.5, 22, 4, 'EXISTING TIMBER HALF-CAP (TYP.)'); v.leader(80 + s.d + 120, -s.d / 2, 18, -12, 'PROPOSED UC CORBEL TO MATCH PILE,\nLENGTH TO SUIT; MITRE CUT; 12PL STIFFENERS');
    } else { iElevWebV(v, s.d / 2, -900, yk, s); pfcElevH(v, s.d, s.d + 700, hc, SEC['300PFC'], 'S-EXIST'); iElevWebH(v, s.d, s.d + 200, -s.d / 2 + 0 - 0, s); [hc - 60, hc - 200].forEach(y => v.line(s.d - 20, y, s.d + 120, y, 'S-BOLT'));
      v.leader(s.d + 400, hc - 150, 18, -8, 'EXISTING PFC HALF-CAP'); v.leader(s.d + 100, -s.d / 2, 18, -16, 'PROPOSED UC CORBEL TO MATCH\nPROPOSED UC PILE SIZE x200 LONG\n2x10FL WEB STIFFENERS NEAR AND FAR FACE'); v.leader(s.d - 20, hc - 60, -22, 18, "TIMBER OR STEEL PACKING - REFER\nDIMENSION 'X' ON TYPE A DETAIL"); }
    v.leader(100, yk + 90, 20, 18, 'EXISTING SPIKING RAIL'); v.leader(150, yk + 240, 20, 10, 'EXISTING TIMBER CAPPING'); v.leader(-75, -400, -14, 6, 'EXISTING TIMBER\nSHEETING'); v.leader(G2 ? s.d / 2 : 80 + s.d / 2, -650, 18, -6, 'PROPOSED UC PILE ' + secName(p.uc));
    v.text(G2 ? s.d + 30 : 130, yk + 20, '15°', 2.2);
    LY.title('ABUTMENT TOP CONNECTION DETAIL - TYPE ' + (G2 ? 'G' : 'F'), 10, 'ELEVATION');
    const w = LY.view(10); if (!G2) { w.rect(-240, 0, 170, hc, 'S-EXIST'); w.rect(70, 0, 170, hc, 'S-EXIST'); w.rect(-70, 20, 140, hc + 40, 'S-NEW'); iSec(w, 0, -s.b / 2, s, 1, 'S-NEW'); w.leader(0, hc / 2, 18, 18, '125 - 200 PFC PACKER SHIMMED TO FIT\nGAP BETWEEN TIMBER HALF-CAP AND\nHALF-CAP CONNECTION CHANNEL'); w.leader(0, -s.b / 2, 18, -10, 'PROPOSED UC CORBEL'); w.dim(-250, 20, -250, hc + 60, 6, 'GAP VARIES'); }
    else { w.rect(-400, hc, 800, 75, 'S-EXIST'); pfcElevH(w, -400, 400, hc, SEC['300PFC'], 'S-EXIST'); iSec(w, 0, hc - 300 - s.b / 2 - 10, s, 1, 'S-NEW'); [-45, 45].forEach(x => boltSym(w, x, hc - 290, 20)); w.leader(0, hc - 300 - s.b / 2, 18, -14, 'PROPOSED UC PILE'); w.leader(-300, hc - 150, -14, -12, 'EXISTING PFC HALF-CAP'); w.dim(-410, hc - 300 - s.b, -410, hc, 6, 'GAP VARIES'); w.leader(-s.b / 2, hc - 300, -16, 14, '20 CHAMFER TO STIFFENERS\nTO CLEAR UC PILE RADIUS'); }
    LY.title('SECTION ' + (G2 ? 'S' : 'Q'), 10);
    LY.notes(['TIMBER HALF-CAPS / FULL-CAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL POSITIONS.', 'STEEL SHIMS (3, 5, 8, 10 OR 12 FL) WIDTH AND LENGTH TO SUIT. TACK WELD TOGETHER ONCE IN PLACE.', 'HALF-CAP / FULL-CAP CONNECTION CHANNEL TYPE 2 EXTENDS TO THE UNDERSIDE OF THE SPIKING RAIL.', 'FOR TYPE F, IF A TIMBER PACKER IS REQUIRED REFER TO THE TIMBER PACKING OPTION (1330-0015).'], 125);
    return LY.done();
  });

  // 27 PIER HALF-CAP TO PILE CONNECTION TYPE 2 (1330-0019)
  def('phc2', 'Halfcaps', 'Pier half-cap to pile connection – Type 2 (PFC both faces)', '1330-0019', [P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('hc', 'Halfcap depth (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(), s = SEC[p.pfc] || SEC['300PFC'], D = +p.D || 380, hc = +p.hc || 300, v = LY.view(10);
    // PLAN — two timber halfcaps either side of the pier centre line, PFC under the outer face of each
    [-1, 1].forEach(k => { v.rect(-700, k > 0 ? 70 : -240, 1400, 170, 'S-EXIST'); v.rect(-700, k > 0 ? 240 - s.b : -240, 1400, s.b, 'S-NEW'); }); v.circ(0, 0, D / 2, 'S-EXIST'); v.cl(-750, 0, 760, 0); v.text(780, 0, '℄ PIER', 2.2, 'l', 'm');
    [-150, 150].forEach(x => v.line(x, -300, x, 300, 'S-BOLT')); v.rect(-150, -D / 2 - 10, 300, D + 20, 'S-NEW');
    v.leader(-150, 300, -24, 10, 'φ20 THREADED ROD (TYP.)'); v.leader(-600, -240 + s.b / 2, -12, -16, 'PFC HALF-CAP\nSTRENGTHENING (TYP.)'); v.leader(150, -D / 2, 18, -16, 'SHIM PLATES (TYP.)');
    LY.title('PLAN', 10);
    // ELEVATION
    const e = LY.view(10); e.rect(-700, 0, 1400, hc, 'S-EXIST'); pfcElevH(e, -700, 700, 0, s, 'S-NEW'); pileElev(e, 0, -s.d - 700, -s.d - 25, D); e.rect(-150, -s.d - 25, 300, 25, 'S-NEW'); e.line(-D / 2, -s.d - 100, D / 2, -s.d - 100, 'S-NEW'); e.line(-D / 2, -s.d - 160, D / 2, -s.d - 160, 'S-NEW');
    [[-100, hc * 0.35], [100, hc * 0.7]].forEach(q => boltSym(e, q[0], q[1], 20)); [-150, 150].forEach(x => e.circ(x, -s.d / 2, 11, 'S-BOLT'));
    e.dim(-150, -s.d - 220, 150, -s.d - 220, -6, '300 SHIM PLATE'); e.dim(260, -s.d - 25, 260, -s.d, -6, '25 NOTCH'); e.dim(-280, -s.d, -280, -s.d - 100, 6, '100');
    e.leader(-600, hc, -10, 10, 'EXISTING TIMBER HALF-CAP'); e.leader(-150, -s.d - 12, -20, -10, 'SHIM PLATES'); e.leader(-D / 2, -s.d - 130, -18, -14, 'PILE BAND - REFER NOTE 2'); e.leader(500, -s.d / 2, 16, -10, 'PFC HALF-CAP STRENGTHENING');
    LY.title('ELEVATION', 10);
    // SECTION B
    const w = LY.view(10); pileElev(w, 0, -s.d - 700, -s.d - 25, D); timberX(w, -240, 0, 170, hc); timberX(w, 70, 0, 170, hc); cSec(w, -240, -s.d / 2, s, 1); cSec(w, 240, -s.d / 2, s, -1);
    w.line(-280, -s.d / 2, 280, -s.d / 2, 'S-BOLT'); [-1, 1].forEach(k => rod(w, k * 155, -s.d - 10, k * 155, hc + 50, 65));
    w.dim(240 - s.b, hc + 120, 240 - s.b + 50, hc + 120, 6, '50 MIN.'); w.cl(0, -s.d - 760, 0, hc + 200, 'PILE');
    w.leader(-155, hc + 50, -16, 10, 'φ20 THREADED ROD WITH 65x5FLx65\nWASHER TO TIMBER FACE (TYP.)'); w.leader(240, hc / 2, 16, 14, 'EXISTING TIMBER\nHALF-CAP (TYP.)'); w.leader(280, -s.d / 2, 16, -8, 'φ20 THREADED ROD\nTHROUGH φ22 HOLE IN PFC'); w.leader(-240, -s.d + 20, -14, -12, 'PFC HALF-CAP\nSTRENGTHENING (TYP.)'); w.leader(-150, -s.d - 12, -16, -20, 'STEEL OR TIMBER\nPACKER IF REQUIRED'); w.leader(0, -s.d - 400, 16, -6, 'EXISTING TIMBER PILE');
    LY.title('SECTION B', 10);
    LY.title('HALF-CAP TO PILE CONNECTION DETAIL - TYPE 2');
    LY.notes(['RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED HALF-CAP REPAIRS. RE-USE EXISTING PILE BANDS WHERE POSSIBLE.', 'PROP STRINGERS AND CORBELS PRIOR TO INSTALLING HALF-CAP STRENGTHENING. INSTALL BY JACKING AGAINST THE TIMBER HALF-CAP TO REMOVE ALL BOWS AND DEFLECTIONS.', 'MAKE GOOD DAMAGED GALV. SURFACE BY APPLYING COLD GALV. OR SIMILAR APPROVED.'], 260);
    return LY.done();
  }, 'Used with the pier half-cap strengthening where both halfcaps are strengthened: rod through both PFCs and the pile.');

  // 28 ABUTMENT HALF-CAP / FULL-CAP STRENGTHENING (1330-0020)
  def('ahs', 'Abutments', 'Abutment half-cap / full-cap strengthening (PFC)', '1330-0020', [P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('piles', 'Pile spacings (mm, comma)', '1800, 1800, 1800', {}), P('ns', 'Number of stringers', 7, { num: 1 }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('hc', 'Cap depth (mm)', 300, { num: 1 }), P('pack', 'Packing option', 'RHS', { opts: ['RHS', 'timber', 'none'] })], (p) => {
    const LY = new Lay(), s = SEC[p.pfc] || SEC['300PFC'], sp = String(p.piles).split(/[ ,;]+/).map(Number).filter(x => x > 0), D = +p.D || 380, hc = +p.hc || 300, ns = max(2, +p.ns || 7), pk = p.pack;
    const xp = [0]; sp.forEach(d => xp.push(xp[xp.length - 1] + d)); const W = xp[xp.length - 1], x0 = -400, x1 = W + 400, v = LY.view(20), yb = hc - s.d;
    v.rect(x0, 0, x1 - x0, hc, 'S-EXIST'); v.rect(x0 + 100, yb, x1 - x0 - 200, s.d, 'S-NEW'); v.line(x0 + 100, yb + s.tf, x1 - 100, yb + s.tf, 'S-NEW'); v.line(x0 + 100, yb + s.d - s.tf, x1 - 100, yb + s.d - s.tf, 'S-NEW');
    xp.forEach((x, i) => { pileElev(v, x, yb - 1300, yb - 25, D); v.rect(x - 150, yb - 25, 300, 25, 'S-NEW'); v.line(x - D / 2, yb - 120, x + D / 2, yb - 120, 'S-NEW'); v.cl(x, yb - 1400, x, hc + 950); if (i > 0 && i < xp.length - 1) v.line(x, yb + s.d / 2, x, yb - 80, 'S-BOLT'); });
    const ys = Array.from({ length: ns }, (_, i) => x0 + 200 + i * (x1 - x0 - 400) / (ns - 1)); ys.forEach(x => { v.circ(x, hc + 260, 260, 'S-EXIST'); v.line(x, 40, x, hc + 200, 'S-BOLT'); });
    v.line(x0 - 200, hc + 520, x1 + 200, hc + 520, 'S-EXIST'); v.line(x0 - 200, hc + 640, x1 + 200, hc + 640, 'S-EXIST');
    for (let x = x0 + 250; x < x1 - 150; x += 900) boltSym(v, x, yb + s.d / 2, 20);
    v.dim(x0 + 100, yb - 200, xp[0] - D / 2, yb - 200, -6, '100 MIN.-300 MAX.'); sp.forEach((d, i) => v.dim(xp[i], yb - 1450, xp[i + 1], yb - 1450, -6, String(d)));
    v.leader(x0 + 250, yb + s.d / 2, -10, -16, 'φ20 THREADED RODS AT 900 MAXIMUM CRS.\nTHROUGH φ22 HOLE IN PFC WITH 65x5FLx65\nWASHER TO TIMBER FACE (TYP.)'); v.leader(xp[1] + 300, yb + 10, 18, -12, secName(p.pfc) + ' HALF-CAP / FULL-CAP\nSTRENGTHENING'); v.leader(xp[0] + D / 2, yb - 120, 18, -18, 'PILE BAND (TYP.)'); v.leader(ys[2], hc + 300, 10, 22, 'EXISTING TIMBER STRINGER (TYP.)'); v.leader(x1 - 300, hc / 2, 12, 22, 'EXISTING TIMBER HALF-CAP / FULL-CAP');
    v.leader(xp[0], yb - 40, -18, -28, 'HALF-CAP TO PILE CONNECTION - TYPE 1 (U-ROD)'); if (xp.length > 2) v.leader(xp[1], yb - 60, 14, -30, 'HALF-CAP TO PILE CONNECTION\nTYPE 2 OR 3 (1330-0021)'); v.leader(ys[1], hc + 100, -10, 34, 'REPLACE EXISTING SPLICE BOLTS WHERE POSSIBLE\nUSING φ20 THREADED RODS WITH 65x5FLx65 WASHERS');
    LY.title('ABUTMENT HALF-CAP / FULL-CAP STRENGTHENING DETAIL', 20, pk === 'none' ? 'NO PACKER OPTION' : 'PACKER OPTION');
    // DETAIL 1 — packing option at a pile
    const w = LY.view(10); w.pl([[-60, 400], [-60, -900]], false, 'S-EXIST'); w.arc(-60 + D / 2, -250, D / 2, 90, 270, 'S-EXIST'); w.line(-60 + D / 2, -250 + D / 2, D, -250 + D / 2, 'S-EXIST');
    cSec(w, 55 + 60, -s.d / 2, s, -1); if (pk === 'RHS') { w.rect(60, -40, 50, 100, 'S-NEW'); w.leader(85, 60, 14, 10, '100x50x5.0 RHS PACKER\n(5 FILLET 50-300)'); } else if (pk === 'timber') { timberX(w, 60, -40, 50, 150, 'S-NEW'); w.leader(85, 110, 14, 10, '150x50 MIN. SEASONED JARRAH\nTIMBER PACKER, 1 No. φ20 ROD\nPER PACKER'); }
    w.rect(55 + 60 - s.b, -s.d - 10, 130, 10, 'S-NEW'); w.line(-120, -s.d / 2, 140, -s.d / 2, 'S-BOLT');
    w.dim(60, 140, 115, 140, 6, '55'); w.dim(55 + 60 - s.b + 20, -s.d - 80, 115 - 0, -s.d - 80, -6, '70 / 90 MIN. BEARING');
    w.leader(-60, -600, -16, -6, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED PFC'); w.leader(55 + 60 - s.b + 60, -s.d - 5, 18, -14, '130x(6,8,10 OR 12FL)x300 LONG\nGALV STEEL SHIM IF REQUIRED');
    LY.title('DETAIL 1', 10, (pk === 'timber' ? 'TIMBER' : 'RHS') + ' PACKING OPTION');
    LY.notes(['RELOCATE EXISTING PILE BANDS AS REQUIRED. RE-USE EXISTING PILE BANDS WHERE POSSIBLE.', 'PROP STRINGERS AND CORBELS PRIOR TO INSTALLING THE STRENGTHENING; INSTALL BY JACKING AGAINST THE TIMBER CAP TO REMOVE ALL BOWS AND DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT.', 'STEEL SHIMS TACK WELDED TOGETHER AFTER PLACEMENT. MAKE GOOD DAMAGED GALV. SURFACE WITH COLD GALV.', 'IF EXISTING BEARING IS LESS THAN THE REQUIRED MIN. (70 FOR PILES > φ340, 90 FOR PILES ≤ φ340) REFER PILE - HALF-CAP BEARING DETAILS (1330-0022).', 'TRIM EXISTING STRINGER / CORBEL HOLDING DOWN BOLTS TO SUIT IF REQUIRED, WITH 65x5FLx65 WASHER TO TIMBER FACE.'], 230);
    return LY.done();
  }, 'PFC on the front face of the abutment cap with rods at 900 crs, drawn for the pile spacings and stringer count you enter.');

  // 29 ABUTMENT HALF-CAP TO PILE CONNECTION TYPES 2 / 3 (1330-0021)
  def('ahc', 'Abutments', 'Abutment half-cap to pile connection – Types 2 / 3', '1330-0021', [P('type', 'Type', 2, { opts: [2, 3], num: 1 }), P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(), t = +p.type || 2, s = SEC[p.pfc] || SEC['300PFC'], D = +p.D || 380, hc = +p.hc || 300, v = LY.view(10), steel = t === 3, S2 = SEC['250UC73'];
    // SECTION — sheeting at x = -75..0, halfcap over pile, PFC on the front face
    v.line(-75, -900, -75, hc + 400, 'S-EXIST'); v.line(0, -900, 0, hc + 400, 'S-EXIST'); v.ground(-450, -80, hc + 200);
    timberX(v, 0, 0, 170, hc); cSec(v, 170 + 55 + s.b, hc - s.d / 2 - 0, s, -1); rod(v, 170 + 55 + s.b - 20, hc + 60, 170 + 55 + s.b - 20, hc - 300 - 0, 65);
    if (!steel) { pileElev(v, 100, -900, hc - s.d - 10, D); aSec(v, 170 + 55 + s.b - s.tw, hc - s.d - 10, 150, 100, 10, -1, 1, 'S-NEW'); v.line(-40, hc - s.d + 50, 170 + 55 + s.b + 20, hc - s.d + 50, 'S-BOLT'); v.circ(170 + 55 + s.b - 80, hc - s.d + 50, 20, 'S-TEXT');
      v.leader(170 + 55 + s.b - 60, hc - s.d + 10, 22, -14, '150x100x10UA CLEAT'); v.leader(-40, hc - s.d + 50, -16, -14, 'M20 x 250 LG COACH SCREW\n(SITE DRILL φ22 HOLE IN PFC)'); v.leader(100 - D / 2, -400, -16, -8, 'NOTCH PILE TO SUIT'); v.leader(100, -700, 16, -6, 'EXISTING TIMBER PILE'); }
    else { iElevWebV(v, 100 + S2.d / 2 - 60, -900, hc - s.d - 10, S2, 'S-EXIST'); v.rect(170 + 55 + s.b - s.tw - 12, hc - s.d - 200, 12, 200, 'S-NEW'); [hc - s.d - 60, hc - s.d - 150].forEach(y => v.line(60, y, 170 + 55 + s.b + 20, y, 'S-BOLT')); timberX(v, 0, hc - s.d - 250, 60, 240, 'S-NEW');
      v.leader(170 + 55 + s.b - s.tw - 6, hc - s.d - 100, 22, -12, '-10FL WEB STIFFENERS\nNEAR AND FAR FACE'); v.leader(60, hc - s.d - 60, -16, -16, 'STEEL PACKERS 250x(6,8,10 OR 12FL)\nx HEIGHT TO SUIT PFC'); v.leader(170 + 55 + s.b + 20, hc - s.d - 150, 16, -10, 'M20 BOLT (TYP.)'); v.leader(100, -700, 16, -6, 'EXISTING STEEL PILE'); }
    v.dim(170, hc + 120, 170 + 55, hc + 120, 6, '55'); v.dim(170 + 55 + s.b - 20, hc + 180, 170 + 55 + s.b + 30, hc + 180, 6, '50 MIN.');
    v.leader(-75, -300, -14, 6, 'EXISTING TIMBER\nSHEETING'); v.leader(85, hc * 0.6, -6, 30, 'EXISTING TIMBER HALF-CAP'); v.leader(170 + 55 + s.b / 2, hc - 30, 20, 16, 'STEEL OR TIMBER PACKER IF REQUIRED'); v.leader(170 + 55 + s.b, hc - s.d / 2, 18, 0, secName(p.pfc) + ' HALF-CAP STRENGTHENING');
    LY.title('SECTION ' + (steel ? 'C' : 'B'), 10);
    // ELEVATION
    const e = LY.view(10); e.rect(-500, 0, 1000, hc, 'S-EXIST'); pfcElevH(e, -500, 500, hc, s, 'S-NEW');
    if (!steel) { pileElev(e, 0, -900, hc - s.d - 25, D); e.rect(-150, hc - s.d - 25, 300, 25, 'S-NEW'); e.rect(-150, hc - s.d - 10 - 0, 300, 10, 'S-NEW'); [[-110, hc - s.d + 50], [110, hc - s.d + 50], [-110, hc - 60], [110, hc - 60]].forEach(q => boltSym(e, q[0], q[1], 20)); boltSym(e, 0, hc - s.d / 2, 20); e.dim(-150, hc - s.d - 120, 150, hc - s.d - 120, -6, '300 SHIM PLATE'); e.dim(260, hc - s.d - 25, 260, hc - s.d - 125, -6, '100'); }
    else { iElevFlange(e, 0, -900, hc - s.d - 10, S2, 'S-EXIST'); e.rect(-70, hc - s.d - 10, 140, 10, 'S-NEW'); [hc - 60, hc - s.d + 50].forEach(y => boltSym(e, 0, y, 20)); e.dim(-70, hc + 120, 70, hc + 120, 6, '140'); e.dim(260, hc - s.d - 75 - 0, 260, hc - s.d, -6, '75 (TYP.)'); e.leader(0, hc - s.d - 5, 20, -16, 'REMOVE EXISTING HALF-CAP SUPPORT AND RELOCATE\nTO SUIT PROPOSED PFC; MAKE GOOD GALV.'); }
    e.cl(0, -960, 0, hc + 180, 'PILE'); e.leader(-400, hc / 2, -12, 14, 'EXISTING TIMBER HALF-CAP'); e.leader(400, hc - s.d / 2, 14, -12, 'PFC HALF-CAP\nSTRENGTHENING');
    LY.title('ELEVATION', 10);
    LY.title('HALF-CAP TO PILE CONNECTION DETAIL - TYPE ' + t, null, steel ? 'STEEL PILE' : 'TIMBER PILE');
    LY.notes(['RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED HALF-CAP REPAIRS.', 'PROP STRINGERS AND CORBELS PRIOR TO INSTALLING HALF-CAP STRENGTHENING.', 'TYPE 2: TRIM EXISTING TIMBER PILE TO SUIT PROPOSED 300 PFC; 70 MIN. BEARING FOR PILES φ>340 OR 90 MIN. FOR φ≤340. 130x(6,8,10 OR 12FL)x300 LONG GALV STEEL SHIM IF REQUIRED.', 'IF EXISTING BEARING IS LESS THAN REQUIRED MIN. REFER PILE - HALF-CAP BEARING DETAILS (1330-0022).'], 250);
    return LY.done();
  });

  // ------------------------------------------------------------------ details after the repair-manual practice-note sheets (PN30-xxxx)
  // 30 PILE BANDING TYPE 3 (PN30-2102)
  def('pb3', 'Piles', 'Pile banding – Type 3 (welded band)', 'PN30-2102', [P('D', 'Pile dia. (mm)', 400, { num: 1 }), P('nb', 'Bands (top / middle / bottom)', 3, { num: 1 })], (p) => {
    const LY = new Lay(), D = +p.D || 400, nb = max(1, min(6, +p.nb || 3)), v = LY.view(5);
    v.circ(0, 0, D / 2, 'S-EXIST'); v.circ(0, 0, D / 2 + 5, 'S-NEW'); v.arc(0, 0, D / 2 + 10, 20, 50, 'S-NEW'); v.line(-D / 2 - 60, 0, D / 2 + 60, 0, 'S-CL'); v.line(0, -D / 2 - 60, 0, D / 2 + 60, 'S-CL');
    v.pl([[D * 0.1, -D * 0.1], [D * 0.25, D * 0.05], [D * 0.18, D * 0.2]], false, 'S-EXIST');
    v.leader((D / 2 + 5) * Math.cos(-0.6), (D / 2 + 5) * Math.sin(-0.6), 18, -12, '50x5FL BAND'); v.leader((D / 2 + 10) * Math.cos(0.6), (D / 2 + 10) * Math.sin(0.6), 18, 12, '4mm FILLET WELD CLOSE (SITE)'); v.leader(-D * 0.15, D * 0.1, -20, 14, 'PILE CORE'); v.leader(D * 0.2, D * 0.05, -6, -30, 'SPLIT');
    LY.title('PILE BANDING DETAIL - TYPE 3', null, 'PLAN (N.T.S.)');
    // elevation with band positions
    const w = LY.view(20), L = 3000; pileElev(w, 0, -L, 0, D); w.line(-D / 2, 0, D / 2, 0, 'S-EXIST'); w.pl([[20, -400], [-10, -900], [30, -1500], [0, -2200]], false, 'S-EXIST');
    for (let i = 0; i < nb; i++) { const y = -300 - i * (L - 800) / max(1, nb - 1); w.rect(-D / 2 - 5, y - 25, D + 10, 50, 'S-NEW'); }
    w.dim(D / 2 + 60, -300, D / 2 + 60, -300 - (L - 800) / max(1, nb - 1), -6, nb > 2 ? '600 MAX. (MULTI-BAND)' : 'TO SUIT'); w.leader(D / 2, -300, 16, 10, 'BAND AT TOP OF SPLIT'); w.leader(25, -900, -18, -6, 'SPLIT IN PILE');
    LY.title('ELEVATION', 20);
    LY.notes(['REMOVE ANY FOREIGN MATTER FROM TIMBER PILE GAPS.', 'PRECOMPRESS PILE RADIALLY TO CLOSE ALL GAPS USING CHAIN AND RATCHET.', 'INSTALL STEEL BAND THEN FILLET WELD CLOSE WHILE APPLYING TENSION FROM A SECOND CHAIN AND RATCHET WHICH IS TACK WELDED TO THE BAND.', 'THIS IS THE NON-PREFERRED BANDING METHOD. FOR THE PREFERRED METHOD REFER TO THE STANDARD PILE BAND DRAWING (BOLTED BAND WITH CURVED WASHERS).', '"M" IN THE PILE BANDING TABLE = MULTI-BANDS AT 600 MAX. CENTRES FOR THE LENGTH OF THE SPLIT.'], 120);
    return LY.done();
  }, 'Welded 50x5 flat band for split timber piles (non-preferred method).');

  // 31 PIER PILE REPAIR TYPES 1 / 2 / 3 / 6 (welded stub pile in pot) (PN30-2103 / 2105 / 2107 / 2114)
  def('pp1', 'Piles', 'Pier pile repair – Types 1 / 2 / 3 / 6 (welded base plate)', 'PN30-2103', [P('type', 'Type', '1', { opts: ['1', '2', '3', '6'] }), P('D', 'Existing pile dia. (mm)', 400, { num: 1 }), P('rake', 'Rake X (Type 3, X in 1)', 6, { num: 1 }), P('above', 'Height above G.L. (mm)', 1800, { num: 1 })], (p) => {
    const t = String(p.type), LY = new Lay(), s = t === '6' ? SEC['310UC97'] : SEC['200UC52'], D = +p.D || 400, R = 450, H = 1250, Hs = max(600, +p.above || 1800), bp = t === '6' ? 325 : 250;
    const v = LY.view(20), top = 150, cut = top - 250, rk = t === '3' ? 1 / max(2, +p.rake || 6) : 0, X = y => (y - cut) * rk;
    concBox(v, [[-R, top - H], [R, top - H], [R, top], [-R, top]]); v.ground(-R - 450, -R, 0); v.ground(R, R + 450, 0); v.wl(R + 700, 0, 'EXISTING G.L. OR PERMANENT W.L. OR HIGH TIDE - WHICHEVER IS HIGHER');
    pileElev(v, 0, top - H - 600, cut, D); v.rect(-bp / 2, cut, bp, 12, 'S-NEW'); v.line(0, cut - 250, 0, cut, 'S-BOLT'); v.line(-60, cut + 12, -60, cut + 100, 'S-BOLT');
    const yt = top + Hs; v.pl([[-s.b / 2, cut + 12], [-s.b / 2 + X(yt), yt], [s.b / 2 + X(yt), yt], [s.b / 2, cut + 12]], true, 'S-NEW'); v.line(-s.tw / 2, cut + 12, -s.tw / 2 + X(yt), yt, 'S-EXIST'); v.line(s.tw / 2, cut + 12, s.tw / 2 + X(yt), yt, 'S-EXIST');
    [top - H + 75, top - 75].forEach(y => v.line(-R + 75, y, R - 75, y, 'S-REO')); v.line(-R + 75, top - H + 75, -R + 75, top - 75, 'S-REO'); v.line(R - 75, top - H + 75, R - 75, top - 75, 'S-REO');
    if (t === '1') { v.rect(-170 / 2 - 0 + X(yt) - 200, yt - 0, 170, 300, 'S-EXIST'); v.rect(X(yt) + 30, yt, 170, 300, 'S-EXIST'); v.rect(X(yt) - s.b / 2, yt - 12, s.b, 12, 'S-NEW'); [[-1], [1]].forEach(([k]) => v.rect(X(yt) + k * (s.b / 2 + 10) - (k < 0 ? 75 : 0), yt - 200, 75, 1050 - 750, 'S-NEW')); v.line(X(yt) - 250, yt - 100, X(yt) + 250, yt - 100, 'S-BOLT'); v.line(X(yt) - 250, yt - 200 + 300 - 0, X(yt) + 250, yt + 100, 'S-BOLT');
      v.leader(X(yt) + 230, yt - 60, 18, 10, '200 PFC (TYP.) WITH φ20 THREADED RODS IN\nHEAVY DUTY PVC SLEEVE PACKED WITH DENSO PASTE'); v.leader(X(yt) - 120, yt - 6, -20, 10, '250x12FLx250 CAP PLATE WITH\n2-φ12 HOLES FOR SPIKES'); }
    else { v.rect(-300 + X(yt), yt, 600, 300, 'S-EXIST'); v.leader(X(yt) + 250, yt + 150, 18, 6, t === '3' ? 'FIXING TO HALF-CAP: STEEL PIER PILE /\nTIMBER HALF-CAP BEARING TYPE 3' : 'REFER PIER HALF-CAP REPAIRS (WITH\nSTEEL PILE) AND PILE BEARING DETAILS'); }
    v.dim(-R, top - H, -R, top, 8, '1250 MIN.'); v.dim(R, 0, R, top, -8, '150 MIN.'); v.dim(R, cut, R, 0, -16, '250 MIN.'); v.dim(-R + 75, cut - 375, -R + 75, cut + 375, 18, '750');
    if (t === '3') v.text(X(yt) + s.b / 2 + 40, yt - 400, Math.round(1 / rk) + ' : 1', 2.6);
    v.leader(X(top + 700), top + 700, 22, 6, 'PROPOSED ' + secName(t === '6' ? '310UC97' : '200UC52') + (t === '3' ? ' RAKED' : '') + ' PILE (CUT BASE PLATE END ON SITE)'); v.leader(-bp / 2, cut + 6, -26, 16, bp + 'x12FLx' + bp + ' BASE PLATE WITH 2-φ12 HOLES\nFOR SPIKES; SHIM 90x90 x THICKNESS TO SUIT'); v.leader(0, cut - 200, -28, -16, 'φ10 x 250 LONG SPIKE (TYP.)'); v.leader(-D / 2, cut - 60, -22, -26, 'CUT OUT UNSOUND TIMBER - 250 MIN\nBELOW EXISTING G.L.'); v.leader(R - 75, top - 300, 20, -10, 'N16 HOOP BARS AT TOP\n& BOTTOM, 500 LAP; SL81 FABRIC'); v.leader(-R, top - H + 100, -14, -10, '75 CLEAR COVER (TYP.)');
    LY.title('PIER PILE REPAIR DETAIL - TYPE ' + t + (t === '3' ? ' (RAKED PILE)' : ''), 20, 'WELDED OPTION' + (t === '6' ? ' - USE ONLY WHERE TYPES 2 / 2A ARE INADEQUATE' : ''));
    // SECTION B (plan at the base plate)
    const w = LY.view(10); w.circ(0, 0, R, 'S-CONC'); w.circ(0, 0, R - 75, 'S-REO'); w.circ(0, 0, D / 2, 'S-EXIST'); w.rect(-bp / 2, -bp / 2, bp, bp, 'S-NEW'); iSec(w, 0, 0, s, 0); [-1, 1].forEach(k => w.circ(k * 60, k * -60, 6, 'S-BOLT'));
    w.leader(-R * 0.7, R * 0.7, -18, 10, 'SL81 FABRIC, 300 LAP (TYP.)'); w.leader(bp / 2, -bp / 2, 18, -12, 'φ10x100 LONG SPIKE (TYP.)'); w.leader(-R, 0, -16, 0, 'φ900 CONCRETE\nFOOTING'); w.text(R + 30, R - 40, 'FLOW ▶', 2.4);
    LY.title('SECTION B', 10);
    LY.notes(['HALF-CAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL POSITIONS UNTIL CONCRETE HAS BEEN PLACED A MINIMUM OF 3 DAYS.', 'TYPE 1 IS GENERALLY FOR PILES < 3 m HIGH ABOVE GROUND - OTHERWISE USE TYPE 2.', 'PROVIDE UNIFORM SEATING SQUARE TO AXIS OF PILE. SHIM BETWEEN BASE PLATE AND TIMBER PILE TO ENSURE TIGHT FIT.', 'END AND UP TO 100 ABOVE CUT SURFACE OF PILE SHALL BE SEALED WITH TWO COATS OF BITUMINOUS PAINT.', 'ENGINEER SHALL DECIDE WHICH OPTION (WELDED OR BOLTED) TO USE.'], 115);
    return LY.done();
  }, 'Welded steel stub pile on a base plate over the cut-back timber pile in a 900 mm pot; Type 1 with halfcap PFC fixing, Type 3 raked, Type 6 heavy (310UC97).');

  // 32 PIER PILE STRENGTHENING (PN30-2116)
  def('pps', 'Piles', 'Pier pile strengthening – UC alongside pile', 'PN30-2116', [P('uc', 'Strengthening UC', '250UC73', { opts: UCs }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('L', 'Halfcap to waler (mm)', 2400, { num: 1 })], (p) => {
    const LY = new Lay(), s = SEC[p.uc] || SEC['250UC73'], D = +p.D || 380, L = +p.L || 2400, v = LY.view(20), xu = D / 2 + 10 + s.d / 2, hc = 300;
    // elevation (pile vertical, halfcap at top, waler and brace below)
    pileElev(v, 0, -L - 900, 0, D); v.rect(-450, 0, 900 + xu, hc, 'S-EXIST'); pfcElevH(v, -450, 450 + xu, hc, SEC['300PFC'], 'S-NEW'); iElevWebV(v, xu, -L - 900, hc + 400, s);
    v.rect(-500, -L - 80, 1100 + xu, 160, 'S-EXIST'); v.line(-450, -L + 500, 450 + xu, -L - 700, 'S-EXIST'); v.line(-450, -L + 700, 450 + xu, -L - 500, 'S-EXIST');
    [[hc - 120, 400, 'H'], [-L, 450, 'W'], [-L - 600, 450, 'B']].forEach(([y, l]) => { v.rect(xu - s.d / 2 - 200, y - l / 2, 200, l, 'S-NEW'); v.circ(xu - s.d / 2 - 100, y + l / 4, 10, 'S-BOLT'); v.circ(xu - s.d / 2 - 100, y - l / 4, 10, 'S-BOLT'); });
    timberX(v, D / 2, hc - 675, 10 + 0, 675); v.dim(xu + s.d / 2 + 60, hc - 120 - 200, xu + s.d / 2 + 60, hc - 120 + 200, -6, '400'); v.dim(xu - s.d / 2 - 200, -L - 300, xu - s.d / 2, -L - 300, -6, '200');
    v.leader(xu, -L / 2, 22, 6, 'PROPOSED ' + secName(p.uc) + ' PIER PILE STRENGTHENING'); v.leader(xu - s.d / 2 - 100, hc - 120 + 100, -22, 24, '200x200x13 EA x400 LONG CLEAT\nM10x150 LONG COACH SCREW (TYP.)\nφ22x107 LONG SLOTTED HOLE'); v.leader(xu - s.d / 2 - 100, -L + 112, -22, 16, '200x200x13 EA x450 LONG CLEAT\nM10x100 LONG COACH SCREW (TYP.)\nφ22x112 LONG SLOTTED HOLE');
    v.leader(-300, hc / 2, -12, 18, 'EXISTING TIMBER HALF-CAPS'); v.leader(300, hc - 150, 22, 18, 'PROPOSED 300 PFC HALF-CAP\nSTRENGTHENING'); v.leader(-400, -L, -14, 8, 'EXISTING TIMBER WALER'); v.leader(-350, -L + 450, -14, 14, 'EXISTING TIMBER BRACE'); v.leader(0, -L - 800, -16, -8, 'EXISTING TIMBER PILE'); v.leader(D / 2 + 5, hc - 500, -20, -24, '200x675 TIMBER PACKER (RECESS\nFOR WASHER AND NUT)');
    LY.title('PIER PILE STRENGTHENING DETAILS', 20, 'ELEVATION');
    // SECTION C at the waler
    const w = LY.view(10); w.circ(0, 0, D / 2, 'S-EXIST'); iSec(w, -(D / 2 + 10 + s.d / 2), 0, s, 1); w.line(-500, D / 2 + 40, 500, D / 2 + 40, 'S-EXIST'); w.line(-500, D / 2 + 120, 500, D / 2 + 120, 'S-EXIST');
    w.pl([[-D / 2 - 10, -80], [0, -80]], false, 'S-BOLT'); w.arc(0, 0, D / 2 + 10, -90, 90, 'S-NEW'); w.pl([[-D / 2 - 10, 80], [0, 80]], false, 'S-BOLT'); [-1, 1].forEach(k => { w.rect(-(D / 2 + 10) - 0, k * 100 - (k > 0 ? 0 : 100), 100, 100, 'S-NEW'); });
    w.leader(D / 2 + 10, 0, 16, -12, '65x5FL STRAP AROUND PILE\n(5 FILLET) WITH φ20 THREADED ROD'); w.leader(-(D / 2 + 10 + s.d / 2), -s.b / 2, -16, -14, 'PROPOSED ' + secName(p.uc)); w.leader(-D / 2 - 10, 100, -18, 20, '200x200x13 EA x450 LONG CLEAT WITH\nSLOTTED HOLES FOR THREADED RODS'); w.dim(-D / 2 - 10, -D / 2 - 60, -D / 2, -D / 2 - 60, -6, '10');
    LY.title('SECTION C (AT WALER)', 10);
    LY.notes(['DESIGN ENGINEER TO ASSESS SUITABILITY OF THE STRENGTHENING MEMBER SHOWN ON THE DETAILS.', 'TRIM TOP OF PROPOSED UC TO SUIT DECK.', 'DRILL ON SITE φ22 HOLES IN PFC FOR THREADED RODS. 6mm FILLET WELDS (TYP.).'], 120);
    return LY.done();
  }, 'An additional steel UC beside a weak timber pile, cleated to the halfcap strengthening, walers and braces.');

  // 33 STEEL PIER PILE / TIMBER HALFCAP BEARING TYPES 1 / 2 / 3 (PN30-2117)
  def('spb', 'Piles', 'Steel pier pile / timber halfcap bearing – Types 1 / 2 / 3', 'PN30-2117', [P('type', 'Type', 1, { opts: [1, 2, 3], num: 1 }), P('hc', 'Halfcap depth (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(), t = +p.type || 1, hc = +p.hc || 300, s = SEC['200UC52'], v = LY.view(20);
    v.rect(-700, 0, 1400, hc, 'S-EXIST'); [-350, 350].forEach(x => v.circ(x, hc + 240, 240, 'S-EXIST')); v.line(-750, hc + 480, 750, hc + 480, 'S-EXIST'); v.line(-750, hc + 580, 750, hc + 580, 'S-EXIST');
    const r = t === 3 ? 1 / 6 : 0; v.pl([[-s.b / 2 - 1100 * r, -1100], [-s.b / 2, -(t === 1 ? s.d : 16)], [s.b / 2, -(t === 1 ? s.d : 16)], [s.b / 2 - 1100 * r, -1100]], false, 'S-NEW');
    if (t === 1) { iElevWebH(v, -275, 275, -s.d / 2, s); [-s.tw / 2 - 6, s.tw / 2 + 6].forEach(x => v.line(x, -s.d, x, 0, 'S-NEW')); v.leader(275, -s.d / 2, 18, -6, '200 UC 52 x550 HEAD'); v.leader(-s.b / 2, -s.d + 20, -20, -12, '12FL STIFFENER (TYP.)'); }
    else if (t === 2) { v.rect(-275, -16, 550, 16, 'S-NEW'); [-1, 1].forEach(k => v.pl([[k * s.b / 2, -16], [k * (s.b / 2 + 100), -16], [k * s.b / 2, -216]], true, 'S-NEW')); v.leader(275, -8, 18, -6, '250x550x16PL CAP PLATE'); v.leader(s.b / 2 + 40, -60, 18, -18, '150x10FLx200 STIFFENER (TYP.)'); }
    else { v.rect(-250, -12, 500, 12, 'S-NEW'); [-1, 1].forEach(k => v.rect(k > 0 ? 100 : -110, -212, 10, 200, 'S-NEW')); v.leader(250, -6, 18, -6, '300x12FLx500 CAP PLATE'); v.leader(105, -150, 18, -18, '200x10FLx500 STIFFENER (TYP.)'); v.text(-s.b / 2 - 1100 * r - 30, -900, '6 : 1', 2.6); v.leader(-s.b / 2 - 600 * r, -600, -16, -10, '15 CHAMFER (PILE FLANGES)'); }
    v.rect(-35, 10, 70, hc - 20, 'S-NEW'); boltSym(v, 0, hc * 0.35, 20); boltSym(v, 0, hc * 0.72, 20);
    v.leader(0, -700, 20, -6, 'PROPOSED 200 UC 52 PILE' + (t === 3 ? ' (RAKED)' : '')); v.leader(-600, hc / 2, -10, 18, 'EXISTING TIMBER HALFCAPS'); v.leader(-350, hc + 300, -12, 12, 'EXISTING TIMBER STRINGER'); v.leader(0, hc * 0.72, 22, 22, 'REFER HALFCAP CONNECTION DETAILS;\nφ20 THREADED ROD WITH 1-65x5FLx65 WASHER');
    LY.title('STEEL PIER PILE / TIMBER HALFCAP BEARING DETAIL - TYPE ' + t, 20, t === 1 ? 'PREFERRED OPTION' : 'NON-PREFERRED - ENGINEER SHALL CHOOSE OPTION TO SUIT');
    // VIEW A
    const w = LY.view(20); w.rect(-170 - 70, 0, 170, hc, 'S-EXIST'); w.rect(70, 0, 170, hc, 'S-EXIST'); iElevWebV(w, 0, -900, -(t === 1 ? s.d : 16), s); if (t === 1) iElevWebH(w, -s.b / 2, s.b / 2, -s.d / 2, Object.assign({}, s, { d: s.d })); else w.rect(-125, -16, 250, 16, 'S-NEW');
    rod(w, -280, hc * 0.35, 280, hc * 0.35, 65); rod(w, -280, hc * 0.72, 280, hc * 0.72, 65); w.dim(240, hc + 60, 240 + 75, hc + 60, 6, '75');
    LY.title('VIEW A', 20);
    LY.notes(['TIMBER HALFCAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL POSITIONS.', 'PROPOSED PILE SIZE WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS. 200 UC 52 PILE DRAWN.', 'READ IN CONJUNCTION WITH THE PIER STEEL PILE / TIMBER HALFCAP CONNECTION DETAILS (150 PFC x300 CONNECTION CHANNEL).', 'WELDS 6mm FILLET (TYPE 1), 8mm FILLET (TYPES 2 AND 3) UNO.'], 120);
    return LY.done();
  });

  // 34 ABUTMENT PILE REPAIR TYPE 2 (PN30-2124)
  def('ap2', 'Piles', 'Abutment pile repair – Type 2 (PFC in pot, h ≤ 1000)', 'PN30-2124', [P('D', 'Existing pile dia. (mm)', 350, { num: 1 }), P('h', 'Height G.L. to cap (mm)', 900, { num: 1 })], (p) => {
    const LY = new Lay(), D = +p.D || 350, h = min(1000, +p.h || 900), s = SEC['150PFC'], v = LY.view(20), top = 150, H = 1250;
    v.line(0, -H - 400, 0, h + 600, 'S-EXIST'); v.line(-75, -H - 400, -75, h + 600, 'S-EXIST'); v.ground(-500, -80, h + 300);
    concBox(v, [[0, top - H], [600, top - H], [600, top], [0, top]]); v.ground(600, 1100, 0); pileElev(v, 300, -H - 500, top - 400, D); v.rect(300 - s.d / 2, top - 750, s.d, h + 750 - top, 'S-NEW');
    v.rect(300 - 82, h - 10, 165, 10, 'S-NEW'); timberX(v, 50, h, 500, 300); [[300 - 120], [300 + 120]].forEach(([x]) => timberX(v, x - 100 + (x > 300 ? 0 : 0), top + 20, 200, h - top - 30, 'S-NEW')); v.line(300, h - 20, 300, h + 330, 'S-BOLT');
    [top - H + 75, top - 75].forEach(y => v.line(75, y, 525, y, 'S-REO')); [-1, 1].forEach(k => v.line(300 + k * 120, top - H + 75, 300 + k * 120, top - 75 - 0 + 0, 'S-REO'));
    v.dim(600, top - H, 600, top, -8, '1250 MIN.'); v.dim(0, h + 40, 600, h + 40, 8, '600'); v.dim(650, 0, 650, h, -6, h + ' (1000 MAX.)'); v.dim(650, -400 - 375, 650, -400 + 375 - 0, -14, '750');
    v.leader(300, top - 600, 26, -8, '150 PFC WITH 90x10FLx165 END PLATE'); v.leader(300, h + 200, 26, 14, 'φ20 THREADED ROD WITH 65x5FLx65 WASHER;\n2 SOLID TIMBER PACKERS x200 WIDE EACH SIDE'); v.leader(150, h + 150, -24, 22, 'EXISTING TIMBER FULLCAP'); v.leader(300 - D / 2, -H - 200, -20, -6, 'CUT BACK EXISTING TIMBER PILE TO\nSOUND TIMBER - 250 MIN BELOW G.L.');
    v.leader(450, top - H + 75, 22, -10, '4-N20 x1500 LONG (650 MIN LAP);\nSL81 FABRIC; N16 500 LAP'); v.leader(0, top - H + 50, -16, -6, 'PERMANENT FORMWORK'); v.leader(-75, -300, -14, 6, 'EXISTING TIMBER\nSHEETING');
    LY.title('ABUTMENT PILE REPAIR DETAIL - TYPE 2', 20, 'ELEVATION');
    const w = LY.view(10); concBox(w, [[-450, 0], [450, 0], [450, 750], [-450, 750]]); w.line(-600, 0, 600, 0, 'S-EXIST'); w.circ(0, 375, D / 2, 'S-EXIST'); cSec(w, -s.b / 2, 375, s, 1); w.circ(-350, 75 + 20, 12, 'S-REO'); w.circ(350, 75 + 20, 12, 'S-REO'); w.circ(-350, 655, 12, 'S-REO'); w.circ(350, 655, 12, 'S-REO');
    w.dim(-450, 800, 450, 800, 6, '900'); w.dim(-500, 0, -500, 750, 6, '750'); w.leader(0, 375 - s.d / 2, 18, -18, '150 PFC'); w.leader(350, 95, 18, -10, 'N20'); w.leader(-450, 375, -14, 8, 'SL81 FABRIC (TYP.)'); w.leader(0, 0, 16, -14, 'EXISTING TIMBER SHEETING');
    LY.title('SECTION A', 10);
    LY.notes(['THIS DETAIL ONLY TO BE USED WHERE THE HEIGHT FROM G.L. TO THE UNDERSIDE OF THE FULLCAP IS 1000 OR LESS.', 'FULLCAPS SHALL BE PROPPED DURING CONSTRUCTION AND ABUTMENT SHEETING SAFELY PROPPED; PROPS REMOVED ONLY AFTER CONCRETE HAS BEEN PLACED A MIN. OF THREE DAYS.', 'IF TIMBER SHEETING OCCURS AT THE CONCRETE POT, CUT AND KEY-IN TIMBER INTO CONCRETE. 75 CLEAR COVER (TYP.), 95 COVER TO SHEETING FACE.'], 120);
    return LY.done();
  });

  // 35 ABUTMENT PILE RESTRAINT (PN30-2129)
  def('prs', 'Abutments', 'Abutment pile restraint (headroom > 1750, no overlay)', 'PN30-2129', [P('uc', 'Steel pile', '200UC52', { opts: UCs })], (p) => {
    const LY = new Lay(), s = SEC[p.uc] || SEC['200UC52'], v = LY.view(10);
    v.line(-500, 0, 500, 0, 'S-EXIST'); v.line(-500, 75, 500, 75, 'S-EXIST'); v.brk(-500, -20, -500, 95); iElevWebV(v, -s.d / 2 - 10, -900, 0 - 13 - 200, s, 'S-NEW'); aSec(v, -10, -13, 200, 200, 13, 1, -1, 'S-NEW');
    v.circ(250, -260, 260, 'S-EXIST'); v.line(-10, -110, -s.d - 30, -110, 'S-BOLT'); v.line(60, -13, 60, 70, 'S-BOLT'); v.line(160, -13, 160, 70, 'S-BOLT');
    v.dim(-s.d - 10 - 60, 0, -10, 0, 8, '75 MAX.'); v.dim(-10, 120, 40, 120, 6, '50'); v.dim(-10, -330, 90, -330, -6, '100'); v.dim(60, 140, 160, 140, 6, '175 CRS'.slice(0, 3) + ' CRS');
    v.leader(100, -6, 22, 10, '200x200x13 EA x250 LONG WITH 2-M10x75 LONG COACH SCREWS\nAT 175 CRS AND 2-φ18x75 LONG SLOTTED HOLES FOR M16 BOLTS'); v.leader(-10, -110, -24, -12, '2-M16 BOLTS AT GAUGE OF UC PILE'); v.leader(300, 40, 20, 14, 'EXISTING TIMBER DECK'); v.leader(250, -480, 18, -6, 'EXISTING TIMBER STRINGER'); v.leader(-s.d / 2 - 10, -700, -18, -6, 'PROPOSED ' + secName(p.uc) + ' PILE');
    LY.title('ABUTMENT PILE RESTRAINT DETAIL', 10);
    LY.notes(['PROVIDE WHERE HEADROOM EXCEEDS 1750 AND THERE IS NO CONCRETE OVERLAY.', 'PROPOSED PILE SIZE WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS. 200 UC 52 PILE DRAWN.', 'FULLCAP DETAILS NOT SHOWN - REFER TO THE RELEVANT SECTION.'], 110);
    return LY.done();
  });

  // 36 DRIVEN STEEL PILE SPLICE & DRIVING NOTES (PN30-2130 / 2131)
  def('dsp', 'Piles', 'Driven steel pile – butt splice & driving notes', 'PN30-2130', [P('uc', 'Driven pile', '250UC73', { opts: UCs }), P('set', 'Min. set (blows / 250 mm)', 'XX', {}), P('kJ', 'Energy per blow (kJ)', 'XX', {})], (p) => {
    const LY = new Lay(), s = SEC[p.uc] || SEC['250UC73'], v = LY.view(10);
    iElevFlange(v, 0, -700, -1, s); iElevFlange(v, 0, 1, 700, s); v.line(-s.b / 2 - 60, 0, s.b / 2 + 60, 0, 'S-TEXT');
    v.ground(-500, -s.b / 2 - 20, 900); v.dim(s.b / 2 + 120, 0, s.b / 2 + 120, 700, -8, '3000 MIN. BELOW G.L.');
    v.leader(s.b / 2, 0, 20, 10, 'FULL PENETRATION BUTT WELD SPLICE'); v.leader(0, -400, 18, -8, 'SECTION BELOW SPLICE MAY BE BLACK (UNGALVANISED)'); v.leader(0, 400, 18, 8, 'GALVANISE TO AS/NZS 4680 FROM 3 m\nBELOW G.L. TO TOP OF PILE');
    LY.title('STEEL PILE SPLICE', 10, 'ELEVATION');
    const w = LY.view(2), t = s.tf; w.pl([[-60, t / 2], [-2 - t * 0, t / 2], [-1, -t / 2 + 2], [-1, -t / 2], [-60, -t / 2]], true, 'S-NEW'); w.pl([[60, t / 2], [1 + t, t / 2], [1, -t / 2 + 2], [1, -t / 2], [60, -t / 2]], true, 'S-NEW');
    w.hatch([[-2, t / 2], [1 + t, t / 2], [1, -t / 2 + 2], [-1, -t / 2 + 2]], 'ansi31', 'S-HATCH'); w.dim(-1, -t / 2 - 6, 1, -t / 2 - 6, -6, '2 GAP'); w.dim(70, -t / 2, 70, -t / 2 + 2, -6, '2 LAND'); w.text(t + 8, t / 2 + 6, '45°', 2.2);
    LY.title('BUTT WELD PREPARATION', 2, 'FLANGES AND WEB');
    LY.notes(['PILE DRIVING TOLERANCES: DEVIATION FROM VERTICAL ±15 mm IN A 3 m TEMPLATE; PLAN POSITION 50 mm IN ANY DIRECTION; CUT-OFF LEVEL ±5 mm.', 'DIESEL HAMMER HELMET INTERNAL DIAMETER NOT MORE THAN PILE SIZE + 20 mm.', 'PILES SHALL BE DRIVEN TO A SET DETERMINED BY THE HILEY FORMULA, CONSIDERING TEMPORARY COMPRESSION. ONE TEMPORARY COMPRESSION GRAPH PER GROUP OF SIMILAR PILES AT FINAL SET.', 'ANTICIPATED MIN. SET ' + p.set + ' BLOWS / 250 mm AT ' + p.kJ + ' kJ PER BLOW (ENGINEER TO CONFIRM).', 'SPLICES SHALL BE AT LEAST 3000 BELOW GROUND LEVEL.'], 130);
    return LY.done();
  });

  // 37 ABUTMENT / WINGWALL SCOUR REPAIR (PN30-2203)
  def('scr', 'Sheeting', 'Abutment / wingwall scour repair (concrete apron)', 'PN30-2203', [P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('L', 'Width of scour hole (mm)', 1200, { num: 1 })], (p) => {
    const LY = new Lay(), D = +p.D || 380, L = +p.L || 1200, v = LY.view(10);
    v.line(-200, 0, -200, 600, 'S-EXIST'); v.line(-275, 0, -275, 600, 'S-EXIST'); v.ground(-700, -280, 450);
    v.pl([[-200, 450], [-200, 0]], false, 'S-CONC'); concBox(v, [[-200, 300], [L, 300], [L, 100], [-200, 100]]); v.line(-125, 175, L - 75, 175, 'S-REO');
    v.pl([[L + 150, 450], [L + 50, 300], [L - 150, -200], [600, -500], [-200, -700]], false, 'S-GROUND'); v.hatch([[-200, 100], [L, 100], [L - 150, -200], [600, -500], [-200, -700]], 'earth', 'S-HATCH');
    for (let x = -100; x < L - 100; x += 200) v.line(x, 175, x, 330, 'S-BOLT'); v.line(-200, 175, -50, 175, 'S-BOLT');
    v.dim(-200, -20, L, -20, -6, 'TO SUIT'); v.dim(L + 40, 300, L + 40, 450, -6, '150'); v.dim(-100, 360, 100, 360, 6, '200 (TYP.)'); v.dim(-200, 100, -125, 100, -6, '75');
    v.leader(400, 175, 20, -6, 'SL81 FABRIC'); v.leader(100, 320, 18, 16, 'φ10x250 LONG SPIKE (TYP.)'); v.leader(300, -300, 18, -12, 'REINSTATE SCOUR HOLE WITH\nCOMPACTED SELECTED FILL'); v.leader(L - 150, -200, 18, -8, 'SCOUR LINE'); v.leader(-275, 500, -16, 6, 'EXISTING SHEETING'); v.text(L / 2, 310, 'U1', 2.2, 'c');
    LY.title('SECTION A', 10);
    const w = LY.view(10); w.line(-700, 300, 900, 300, 'S-EXIST'); w.line(-700, 225, 900, 225, 'S-EXIST'); [-D / 2 - 200, 600].forEach(x => w.circ(x, 225 - D / 2, D / 2, 'S-EXIST'));
    concBox(w, [[-D / 2 - 200 + D / 2, 225], [600 - D / 2, 225], [600 - D / 2, 225 - L], [-D / 2 - 200 + D / 2, 225 - L]]); for (let y = 125; y > 225 - L; y -= 200) w.line(-100, y, 400, y, 'S-BOLT'); w.dim(0, 225 - L - 60, 600 - D / 2, 225 - L - 60, -6, 'DIMENSION VARIES');
    w.leader(-200, 225 - D / 2 - 120, -18, -10, 'EXISTING PILE (TYP.)'); w.leader(500, 300, 14, 14, 'EXISTING TIMBER SHEETING'); w.leader(200, -100, 18, -16, '75 COVER (TYP.); N12x300 LONG AT 200 CRS\nSITE WELDED TO STEEL PILES WHERE PRESENT');
    LY.title('PLAN', 10);
    LY.title('ABUTMENT / WINGWALL SCOUR REPAIR DETAIL');
    return LY.done();
  });

  // 38 WINGWALL EXTENSION TYPES 1 / 2 (PN30-2204 / 2205)
  def('wwx', 'Wing walls', 'Wingwall extension – Types 1 / 2 (concrete)', 'PN30-2204', [P('type', 'Type', 1, { opts: [1, 2], num: 1 }), P('L', 'Extension length on slope (mm)', 2400, { num: 1 })], (p) => {
    const LY = new Lay(), t = +p.type || 1, Lx = +p.L || 2400, v = LY.view(20), fw = t === 1 ? 1200 : 700, emb = t === 1 ? 1200 : 600;
    // ELEVATION — sloping extension along the existing wingwall
    for (let i = 0; i < 4; i++) { const x = 1300 + i * 600; pileElev(v, x, -emb - 300, 400, 300); }
    v.line(1000, 400, 3400, 400, 'S-EXIST'); v.line(1000, 250, 3400, 250, 'S-EXIST');
    v.pl([[1100, 550], [0, 550 - 0], [-Lx * 0.7, 550 - Lx * 0.7], [-Lx * 0.7, -emb], [-Lx * 0.7 + 350, -emb], [-Lx * 0.7 + 350, 550 - Lx * 0.7 - 120], [1100, 400]], true, 'S-CONC');
    v.line(-Lx * 0.7 - 300, -50, 1500, -50, 'S-GROUND'); v.ground(-Lx * 0.7 - 300, -Lx * 0.7, -50); v.rect(-Lx * 0.7 - (fw - 350) / 2, -emb - 300, fw, 300, 'S-CONC'); v.hatch([[-Lx * 0.7 - (fw - 350) / 2, -emb - 300], [-Lx * 0.7 - (fw - 350) / 2 + fw, -emb - 300], [-Lx * 0.7 - (fw - 350) / 2 + fw, -emb], [-Lx * 0.7 - (fw - 350) / 2, -emb]], 'conc', 'S-HATCH');
    v.dim(-Lx * 0.7 - 400, -emb, -Lx * 0.7 - 400, -50, 8, emb + ' MIN.'); v.dim(800, 550, 1100, 550, 8, '900 PERP. TO ℄ ROAD'); v.text(-Lx * 0.35, 550 - Lx * 0.35 + 140, 'WINGWALL SLOPE TO MATCH EXISTING', 2.2, 'c', 'b', 'S-TEXT', 45);
    v.leader(-Lx * 0.5, 550 - Lx * 0.5 - 100, -20, 12, 'SL81 FABRIC NF AND FF'); v.leader(-Lx * 0.7 + 175, -emb + 100, 22, -16, 'G1-X-N12-200 NF / FF STARTER BARS'); v.leader(1100, 480, 14, 14, 'TRIM TOP OF EXISTING TIMBER\nWINGWALL TO SUIT; DETAIL 1');
    LY.title('WINGWALL EXTENSION DETAIL - TYPE ' + t, 20, t === 1 ? 'WHERE SCOURING OF WINGWALL HAS OCCURRED OR IS A POSSIBILITY' : 'WHERE NO SCOURING IS EVIDENT');
    // SECTION A
    const w = LY.view(20); concBox(w, [[-fw / 2, -emb - 300], [fw / 2, -emb - 300], [fw / 2, -emb], [175, -emb], [175, 300], [-175, 300], [-175, -emb], [-fw / 2, -emb]]); w.line(-fw / 2 - 200, 0, -175, 0, 'S-GROUND'); w.line(175, 0, fw / 2 + 200, 0, 'S-GROUND');
    w.line(-100, -emb - 220, -100, 230, 'S-REO'); w.line(100, -emb - 220, 100, 230, 'S-REO'); w.pl([[-100, 230], [-100, 260], [100, 260], [100, 230]], false, 'S-REO');
    w.dim(-175, 340, 175, 340, 6, '350'); w.dim(-fw / 2, -emb - 360, fw / 2, -emb - 360, -6, String(fw) + ' *'); w.dim(fw / 2 + 60, -emb - 300, fw / 2 + 60, -emb, -6, '300'); w.dim(fw / 2 + 60, -emb, fw / 2 + 60, 0, -6, emb + ' MIN.');
    w.leader(-100, 0, -16, 6, 'SL81 FABRIC'); w.leader(100, -emb + 100, 16, -6, 'STARTER BARS'); w.leader(-175, -emb + 200, -18, -8, 'CONSTRUCTION JOINT'); w.text(0, 310, 'U2', 2.2, 'c');
    LY.title('SECTION A', 20);
    // DETAIL 1 joint to overlay
    const d = LY.view(10); d.rect(-400, 0, 400, 200, 'S-CONC'); d.rect(20, 0, 400, 200, 'S-CONC'); d.rect(0, 0, 20, 200, 'S-TEXT'); d.rect(-400, -150, 820, 150, 'S-EXIST'); d.line(-75, -150, -75, 0, 'S-BOLT');
    d.leader(10, 150, 14, 14, '20 THICK SILICONE\nRUBBER SEALANT'); d.leader(10, 60, 16, -12, 'BITUMEN IMPREGNATED FIBRE BOARD'); d.leader(-75, -100, -14, -8, 'M8x175 LONG COACH SCREW'); d.leader(-300, 100, -10, 14, 'WINGWALL EXTENSION'); d.leader(300, 100, 10, 14, 'CONCRETE OVERLAY');
    LY.title('DETAIL 1', 10);
    LY.notes(['IF SCOURING OF THE WINGWALL IS NOT EVIDENT THE DESIGN ENGINEER SHALL CONSULT WITH THE WATERWAYS ENGINEER TO DETERMINE IF THERE IS A POSSIBILITY OF SCOURING OCCURRING IN THE FUTURE.', '* DENOTES DIMENSIONS TO BE CHECKED BY THE ENGINEER.', 'EXISTING WINGWALL CAPPING SHALL BE REMOVED; EXISTING TIMBER SHEETING SHALL REMAIN. 75 COVER (TYP.).'], 150);
    return LY.done();
  });

  // 39 SHEETING / SPIKING RAIL SUPPORT BRACKET (PN30-2207)
  def('srb', 'Sheeting', 'Sheeting / spiking rail support bracket', 'PN30-2207', [], (p) => {
    const LY = new Lay(), v = LY.view(10);
    v.rect(0, 0, 450, 100, 'S-NEW'); v.line(0, 100 - 7.5 - 0, 450, 100 - 7.5, 'S-NEW'); v.line(0, 0, 20, -20, 'S-NEW'); v.rect(450, -35, 10, 135, 'S-NEW'); v.rect(460, 85, 115, 10 + 5, 'S-NEW'); v.rect(450, -35, 185, 10, 'S-NEW');
    [[225, 50], [400, 50]].forEach(q => v.circ(q[0], q[1], 9, 'S-BOLT')); v.pl([[560, 25], [610, 25], [610, 43], [560, 43]], true, 'S-BOLT');
    v.dim(0, 160, 450, 160, 6, '450'); v.dim(450, 160, 635, 160, 6, '185'); v.dim(0, 130, 225, 130, 6, '225'); v.dim(225, 130, 400, 130, 6, '175'); v.dim(460, 120, 575, 120, 6, '115'); v.dim(680, -35, 680, 100, -6, '135');
    v.leader(5, -10, -16, -10, '20 CHAMFER (TYP.)'); v.leader(200, 0, -4, -16, '100 PFC'); v.leader(455, 40, 14, -26, '100 x 10FL'); v.leader(600, 34, 14, -8, 'φ18 x 50 LONG SLOTTED HOLE'); v.leader(225, 50, -8, 20, 'φ18 HOLE (TYP.)');
    LY.title('SHEETING / SPIKING RAIL BRACKET DETAIL', 10);
    const w = LY.view(20); w.rect(-150, 0, 150, 180, 'S-EXIST'); timberX(w, -150, 180, 300, 120, 'S-EXIST'); w.line(0, -900, 0, 180, 'S-EXIST'); w.line(-75, -900, -75, 180, 'S-EXIST'); w.rect(0, 120, 450, 100, 'S-NEW'); w.line(-140, 160, 120, 160, 'S-BOLT'); w.circ(250, -200, 240, 'S-EXIST');
    w.leader(-75, 90, -16, 10, 'EXISTING TIMBER SPIKING RAIL'); w.leader(0, 240, 0, 18, 'EXISTING WINGWALL CAPPING'); w.leader(-140, 160, -18, -12, 'φ16 x150 LONG COACH SCREW'); w.leader(300, 170, 16, 10, 'SHEETING / SPIKING RAIL BRACKET,\n2-φ16x75 COACH SCREWS TO SHEETING'); w.leader(-40, -400, -16, -8, 'EXISTING WINGWALL TIMBER SHEETING'); w.leader(0, 120, 20, -18, 'PACK WITH 100x100 STEEL SHIM PLATES\nAS REQUIRED');
    LY.title('SHEETING / SPIKING RAIL SUPPORT DETAIL', 20, 'SECTION A');
    return LY.done();
  });

  // 40 PIER HALFCAPS REPLACEMENT (PN30-2301)
  def('phr', 'Halfcaps', 'Pier halfcaps replacement (PFC) & stringer bracket', 'PN30-2301', [P('pfc', 'Replacement PFC', '300PFC', { opts: ['300PFC', '380PFC'] }), P('piles', 'Pile spacings (mm, comma)', '1800, 1800', {}), P('ns', 'Number of stringers', 6, { num: 1 }), P('D', 'Pile dia. (mm)', 380, { num: 1 })], (p) => {
    const LY = new Lay(), s = SEC[p.pfc] || SEC['300PFC'], sp = String(p.piles).split(/[ ,;]+/).map(Number).filter(x => x > 0), D = +p.D || 380, ns = max(2, +p.ns || 6);
    const xp = [0]; sp.forEach(d => xp.push(xp[xp.length - 1] + d)); const W = xp[xp.length - 1], x0 = -500, x1 = W + 500, v = LY.view(20);
    pfcElevH(v, x0, x1, 0, s, 'S-NEW'); xp.forEach(x => { pileElev(v, x, -s.d - 1300, -s.d - 25, D); v.rect(x - 150, -s.d - 25, 300, 25, 'S-NEW'); v.cl(x, -s.d - 1350, x, 900); });
    const ys = Array.from({ length: ns }, (_, i) => x0 + 220 + i * (x1 - x0 - 440) / (ns - 1)); ys.forEach(x => { timberX(v, x - 120, 0, 240, 260); v.circ(x, 260 + 230, 230, 'S-EXIST'); v.rect(x - 150, -60, 30, 200, 'S-NEW'); v.rect(x + 120, -60, 30, 200, 'S-NEW'); });
    v.line(x0 - 200, 720, x1 + 200, 720, 'S-EXIST'); sp.forEach((d, i) => v.dim(xp[i], -s.d - 1450, xp[i + 1], -s.d - 1450, -6, String(d)));
    v.leader(x1 - 200, -s.d / 2, 14, -10, secName(p.pfc) + ' HALFCAP REPLACEMENT'); v.leader(ys[0] - 135, 40, -16, 18, 'STRINGER / CORBEL BRACKET (TYP.)'); v.leader(xp[0] + 150, -s.d - 12, 14, -18, 'SHIM PLATES / BEARING PLATES\nFOR HALFCAPS WITH BEARING < 70'); v.leader(ys[1], 130, 10, 30, 'EXISTING TIMBER CORBEL'); v.leader(ys[2], 490, 10, 20, 'EXISTING TIMBER STRINGER');
    LY.title('PIER HALFCAPS REPLACEMENT DETAIL', 20, 'ELEVATION');
    // STRINGER / CORBEL BRACKET DETAILS (1:5)
    const b = LY.view(5); aSec(b, 0, 0, 75, 200, 10, 1, 1, 'S-NEW'); b.pl([[10, 35], [10 + 130 * 0.7, 35 + 130 * 0.7]], false, 'S-NEW'); b.pl([[0, 200], [125, 200]], false, 'S-NEW'); b.line(0, 0, -20, -20, 'S-NEW');
    b.dim(-30, 0, -30, 200, 6, '200'); b.dim(-60, 35, -60, 165, 6, '130'); b.dim(0, 230, 5, 230, 6, '5'); b.leader(100, 200, 16, 10, '125x75x10UA'); b.leader(40, 5, 16, -14, '75x75x10 EA, TRIM VERTICAL LEG TO SUIT'); b.leader(-10, -10, -14, -8, '20x20 CHAMFER');
    LY.title('STRINGER / CORBEL BRACKET', 5, '2 BRACKETS PER STRINGER / CORBEL CONNECTION\n(1 AS DRAWN, 1 OPPOSITE HAND)');
    LY.notes(['REMOVE EXISTING TIMBER HALFCAPS ONLY AFTER PROPPING STRINGERS AND CORBELS.', 'BRACKETS FIXED TO CORBELS WITH φ20 THREADED ROD WITH 65x5FLx65 WASHER TO TIMBER FACE, AND TO THE PFC HALFCAP WITH 2-M20 BOLTS IN SITE DRILLED φ22 HOLES. NOTCH CORBEL TO SUIT.', '70 MIN. BEARING ON THE TRIMMED PILE. IF BEARING IS < 70 REFER HALFCAP / FULLCAP TO PILE BEARING DETAILS. GAP BETWEEN PILE RECESS AND 300 PFC: 100x(10 OR 20FL)x300 LONG GALV. STEEL SHIMS.', 'HALFCAP CHANNELS WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS. RELOCATE PILE BANDS AS REQUIRED.'], 250);
    return LY.done();
  });

  // 41 PIER HALFCAPS STRENGTHENING & WIDENING (stub column) (PN30-2311)
  def('phw', 'Halfcaps', 'Pier halfcap strengthening & widening (stub column)', 'PN30-2311', [P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('ub', 'Proposed stringer', '410UB54', { opts: UBs }), P('cor', 'Proposed corbel', '310UB46', { opts: ['310UB46', '310UC97'] }), P('ext', 'Widening beyond last pile (mm)', 900, { num: 1 }), P('D', 'Pile dia. (mm)', 380, { num: 1 })], (p) => {
    const LY = new Lay(), s = SEC[p.pfc] || SEC['300PFC'], u = SEC[p.ub] || SEC['410UB54'], c = SEC[p.cor] || SEC['310UB46'], D = +p.D || 380, ext = +p.ext || 900, v = LY.view(20), hc = 300;
    const xs = ext - 50; v.rect(-1500, 0, 1500, hc, 'S-EXIST'); pfcElevH(v, -1500, xs - 150, 0, s, 'S-NEW'); [-1200, 0].forEach(x => { pileElev(v, x, -s.d - 1100, -s.d - 25, D); v.rect(x - 150, -s.d - 25, 300, 25, 'S-NEW'); });
    [-1100, -400].forEach(x => { v.circ(x, hc + 260, 240, 'S-EXIST'); v.circ(x, hc + 260 + 480, 240, 'S-EXIST'); }); v.line(-1550, hc + c.d + u.d + 10, ext + 400, hc + c.d + u.d + 10, 'S-EXIST');
    iElevWebV(v, xs, -s.d - 900, hc - 12, SEC['250UC73'], 'S-NEW'); v.rect(xs - 150, hc - 12, 300, 12, 'S-NEW'); iElevWebH(v, xs - 500, xs + 500, hc + c.d / 2, c); iElevWebH(v, xs - 1000, xs + 500, hc + c.d + u.d / 2, u);
    v.leader(xs, -s.d - 600, 20, -8, '250 UC 73 STUB COLUMN, LENGTH TO SUIT'); v.leader(xs + 150, hc - 6, 18, -18, '300x12FLx300 LONG CAP PLATE');
    v.leader(xs + 400, hc + c.d / 2, 18, 4, 'PROPOSED ' + secName(p.cor) + ' CORBEL'); v.leader(xs + 400, hc + c.d + u.d / 2, 18, 10, 'PROPOSED ' + secName(p.ub) + ' STRINGER'); v.leader(-800, -s.d / 2, -10, -18, 'PROPOSED ' + secName(p.pfc) + ' HALFCAP STRENGTHENING'); v.leader(-1200 + D / 2, -s.d - 100, -16, -24, '25 NOTCH (TYP.); SHIM PLATES / BEARING\nPLATES FOR HALFCAPS WITH BEARING < 70'); v.leader(-1100, hc + 260, -10, 16, 'EXISTING TIMBER CORBEL (TYP.)'); v.leader(-1300, hc / 2, -12, 10, 'EXISTING TIMBER HALFCAPS');
    v.dim(0, -s.d - 1150, xs, -s.d - 1150, -6, String(xs));
    LY.title('PIER HALFCAPS STRENGTHENING & WIDENING DETAIL', 20, 'ELEVATION');
    const w = LY.view(20); iElevWebV(w, 0, -s.d - 600, -12, SEC['250UC73'], 'S-NEW'); w.rect(-150, -12, 300, 12, 'S-NEW'); iElevWebH(w, -c.b * 1.6, c.b * 1.6, c.d / 2, Object.assign({}, c, { d: c.d })); iSec(w, 0, c.d + u.d / 2, u, 0);
    [-45, 45].forEach(x => boltSym(w, x, c.d + 8, 18)); [-50, 50].forEach(x => boltSym(w, x, 6, 18)); w.cl(0, -s.d - 650, 0, c.d + u.d + 120, 'PIER'); w.dim(-50, c.d + u.d + 60, 0, c.d + u.d + 60, 6, '50'); w.dim(0, c.d + u.d + 60, 50, c.d + u.d + 60, 6, '50');
    w.leader(-45, c.d + 8, -16, 10, 'M20 8.8S BOLTS (TYP.)'); w.leader(150, -6, 16, -10, '300x12FLx300 CAP PLATE'); w.leader(0, -400, 16, -8, 'STUB COLUMN');
    LY.title('VIEW B', 20);
    LY.notes(['PROP STRINGERS AND CORBELS PRIOR TO INSTALLING HALFCAP STRENGTHENING. INSTALL BY JACKING AGAINST THE TIMBER HALFCAP TO REMOVE ALL BOWS AND DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT.', 'RECESS EXISTING TIMBER HALFCAP AND SHORTEN EXISTING BOLT TO CLEAR PROPOSED STRENGTHENING; PROVIDE NEW 65x5FLx65 WASHER AND TIGHTEN BOLT.', 'φ20 THREADED RODS AT 900 CRS MAXIMUM WITH 65x5FLx65 WASHER TO TIMBER FACE. 75x10FL STIFFENERS AT PILES. 6mm FILLET WELDS (TYP.).', 'THIS DETAIL IS ONLY TO BE USED WHERE THERE IS NO SIGNIFICANT PERMANENT BOWING OR CRUSHING IN THE UNDERSIDE OF THE EXISTING TIMBER HALFCAP (ENGINEER TO DETERMINE).'], 250);
    return LY.done();
  });

  // 42 ABUTMENT FULLCAP REPLACEMENT (PN30-2325)
  def('afr', 'Abutments', 'Abutment fullcap replacement (PFC, U-rod)', 'PN30-2325', [P('pfc', 'Replacement PFC', '300PFC', { opts: ['300PFC', '380PFC'] }), P('D', 'Pile dia. (mm)', 380, { num: 1 })], (p) => {
    const LY = new Lay(), s = SEC[p.pfc] || SEC['300PFC'], D = +p.D || 380, v = LY.view(10);
    // SECTION A: sheeting, pile, PFC fullcap on the pile with U-rod, stringer bracket
    v.line(-75, -900, -75, 600, 'S-EXIST'); v.line(0, -900, 0, 600, 'S-EXIST'); v.ground(-450, -80, 450); pileElev(v, D / 2, -900, -s.d - 25, D);
    cSec(v, 0, -s.d / 2, s, 1); v.rect(10, -s.d - 25, 300, 25, 'S-NEW'); v.pl([[-30, -s.d / 2], [D + 60, -s.d / 2]], false, 'S-BOLT'); v.arc(D + 60, -s.d / 2, 0.5, 0, 1, 'S-BOLT'); v.circ(D / 2, 230, 230, 'S-EXIST'); aSec(v, s.b + 10, 0, 125, 200, 10, 1, 1, 'S-NEW'); v.line(s.b + 60, 100, D / 2, 100, 'S-BOLT');
    v.dim(s.b, 520, s.b + 55, 520, 6, '55 (TYP.)'); v.leader(0, -s.d / 2 + 60, -18, 14, 'PROPOSED ' + secName(p.pfc) + ' FULLCAP REPLACEMENT'); v.leader(D + 60, -s.d / 2, 16, -6, 'φ20 \'U\' THREADED ROD (TYP.)'); v.leader(s.b + 60, 150, 20, 18, 'STRINGER / CORBEL BRACKET FIXED TO STRINGER WITH φ20\nTHREADED ROD AND TO PFC WITH 2-M20 BOLTS'); v.leader(D / 2, 400, 18, 10, 'EXISTING TIMBER STRINGER (NOTCH TO SUIT)'); v.leader(D / 2, -700, 18, -6, 'EXISTING TIMBER PILE');
    LY.title('SECTION A', 10);
    const w = LY.view(20); pfcElevH(w, -1400, 1400, 0, s, 'S-NEW'); [-900, 900].forEach(x => { pileElev(w, x, -s.d - 900, -s.d - 25, D); w.rect(x - 150, -s.d - 25, 300, 25, 'S-NEW'); }); [-600, 0, 600].forEach(x => { w.circ(x, 230, 230, 'S-EXIST'); w.rect(x - 150, -60, 30, 200, 'S-NEW'); w.rect(x + 120, -60, 30, 200, 'S-NEW'); }); w.line(-1450, 470, 1450, 470, 'S-EXIST');
    w.dim(-900 - 150, -s.d - 120, -900 + 150, -s.d - 120, -6, '300'); w.dim(-900 + 200, -s.d - 25, -900 + 200, -s.d, -6, '25 NOTCH');
    w.leader(900 + 150, -s.d - 12, 14, -16, 'SHIM PLATES / BEARING PLATES FOR\nFULLCAPS WITH BEARING < 70'); w.leader(0, 230, 10, 20, 'EXISTING TIMBER STRINGER (TYP.)'); w.leader(-1200, -s.d / 2, -12, -14, 'PROPOSED ' + secName(p.pfc) + ' FULLCAP');
    LY.title('ELEVATION', 20);
    LY.title('ABUTMENT FULLCAP REPLACEMENT DETAIL');
    LY.notes(['REMOVE EXISTING TIMBER FULLCAP ONLY AFTER PROPPING STRINGERS. RELOCATE EXISTING PILE BANDS AS REQUIRED.', 'TRIM EXISTING TIMBER PILE TO SUIT PROPOSED PFC; 70 MIN. BEARING. IF BEARING IS < 70 REFER HALFCAP / FULLCAP TO PILE BEARING DETAILS.', '130x(6,8,10 OR 12FL)x300 LONG GALV. STEEL SHIMS IF REQUIRED (380 PFC); 100x(10 OR 20FL)x300 (300 PFC). TACK WELD SHIMS TOGETHER; MAKE GOOD GALV.', 'FULLCAP REPLACEMENT CHANNEL WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS.'], 250);
    return LY.done();
  });

  // 43 PIER STRINGER & CORBEL STRENGTHENING (PN30-3110)
  def('scs', 'Stringers', 'Pier stringer & corbel strengthening (steel)', 'PN30-3110', [P('ub', 'Proposed stringer', '410UB54', { opts: UBs }), P('cor', 'Proposed corbel', '310UB46', { opts: ['310UB46', '310UC97'] })], (p) => {
    const LY = new Lay(), u = SEC[p.ub] || SEC['410UB54'], c = SEC[p.cor] || SEC['310UB46'], v = LY.view(20), hc = 300;
    v.rect(-200, -hc, 400, hc, 'S-EXIST'); v.line(-200, -hc, 200, 0, 'S-EXIST'); v.line(-200, 0, 200, -hc, 'S-EXIST');
    iElevWebH(v, -500, 500, c.d / 2 + 13, c); aSec(v, -175, 13, 200, 200, 13, 1, -1, 'S-NEW'); v.rect(-175, 0, 350, 13, 'S-NEW');
    iElevWebH(v, 10, 2200, c.d + 13 + u.d / 2, u); iElevWebH(v, -2200, -10, c.d + 13 + u.d / 2, u); const yd = c.d + 13 + u.d; v.rect(60, c.d + 13, 300, 12, 'S-NEW');
    v.line(-2300, yd + 5, 2300, yd + 5, 'S-EXIST'); v.line(-2300, yd + 80, 2300, yd + 80, 'S-EXIST'); [-1, 1].forEach(k => [k * 120, k * 480].forEach(x => v.line(x, c.d + 13 - 20, x, c.d + 13 + 20, 'S-BOLT')));
    for (let x = -1800; x <= 1800; x += 600) v.line(x, yd - 20, x, yd + 100, 'S-BOLT'); v.cl(0, -hc - 100, 0, yd + 250, 'PIER');
    v.dim(-10, yd + 180, 0, yd + 180, 6, '10'); v.dim(-175, -hc - 60, 175, -hc - 60, -6, '350'); v.dim(-60, c.d + 13 + 100, -10, c.d + 13 + 100, 6, '50'); v.dim(10, c.d + 13 + 100, 60, c.d + 13 + 100, 6, '50');
    v.leader(-400, c.d / 2, -14, -10, 'PROPOSED STEEL CORBEL ' + secName(p.cor) + ' x1000 LONG'); v.leader(1500, c.d + 13 + u.d / 2, 14, -10, 'PROPOSED STEEL STRINGER ' + secName(p.ub)); v.leader(200, c.d + 19, 16, -26, '200x(6,8,10 OR 12FL)x300 LONG STEEL PACKERS USED TO\nWEDGE STEEL STRINGER TIGHT AGAINST EXISTING DECKING'); v.leader(-1200, yd + 40, -10, 14, 'EXISTING TIMBER DECK; FIX LOOSE PLANKS WITH φ10x200 SPIKE'); v.leader(-120, -hc / 2, -20, -10, 'EXISTING TIMBER HALFCAP (TYP.)');
    LY.title('PIER - STRINGER & CORBEL STRENGTHENING DETAIL', 20, 'ELEVATION');
    const w = LY.view(20); w.rect(-300, -hc, 600, hc, 'S-EXIST'); aSec(w, -100, 13, 100, 0.01, 13, -1, -1, 'S-NEW'); w.rect(-100, 0, 200, 13, 'S-NEW'); iSec(w, 0, 13 + c.d / 2, c, 0); iSec(w, 0, 13 + c.d + u.d / 2, u, 0); w.line(-300, yd + 5, 300, yd + 5, 'S-EXIST');
    w.circ(350, 13 + c.d / 2, 240, 'S-EXIST'); w.circ(350, 13 + c.d + 240, 240, 'S-EXIST'); [-45, 45].forEach(x => w.line(x, yd - 10, x, yd + 60, 'S-BOLT')); [-1, 1].forEach(k => w.circ(k * 60, 6, 9, 'S-BOLT'));
    w.dim(-100, -hc - 60, 0, -hc - 60, -6, '100'); w.dim(0, -hc - 60, 100, -hc - 60, -6, '100'); w.dim(-45, yd + 120, 0, yd + 120, 6, '45');
    w.leader(-45, yd + 60, -14, 10, 'THREADED ROD EVERY THIRD DECK PLANK\n(TACK WELD OR CENTRE PUNCH THREAD)'); w.leader(-100, 6, -16, -12, '200x200x13 EA x300 LONG (TYP.)'); w.leader(0, 13 + c.d / 2, -18, 4, '10FL STIFFENER (TYP.); M20 BOLT (TYP.)');
    LY.title('SECTIONAL ELEVATION A', 20);
    LY.notes(['GAP BETWEEN STRINGER AND DECK SHALL BE SUITABLY PACKED - REFER STEEL STRINGER PACKING DETAIL.', 'STRINGER AND CORBEL SIZE WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS. 410 UB 54 STRINGER AND 310 UB 46 CORBEL DRAWN.', 'φ20 THREADED RODS WITH 65x5FLx65 WASHER TO TIMBER FACE. TACK WELD STEEL PACKERS TO CORBEL AFTER PLACEMENT.'], 250);
    return LY.done();
  }, 'Additional steel stringer on a steel corbel beside the existing timber, seated on the halfcap with angles.');

  // 44 ABUTMENT STRINGER REPLACEMENT TYPE 1 (PN30-3113)
  def('asr', 'Stringers', 'Abutment stringer replacement – Type 1 (modified flange)', 'PN30-3113', [P('ub', 'Proposed stringer', '410UB54', { opts: UBs }), P('L', 'Seat length on fullcap (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(), u = SEC[p.ub] || SEC['410UB54'], Ls = max(200, +p.L || 300), v = LY.view(20), hc = 300;
    v.line(0, -1200, 0, u.d + 100, 'S-EXIST'); v.line(-75, -1200, -75, u.d + 100, 'S-EXIST'); timberX(v, 0, -hc, 300, hc); pileElev(v, 150, -1200, -hc, 350);
    iElevWebH(v, 30, 2200, u.d / 2 + 16, u); v.rect(30, 0, Ls + 50, 16, 'S-NEW'); timberX(v, 2, 16, 26, u.d, 'S-NEW'); v.rect(100, u.d + 16, 300, 12, 'S-NEW');
    v.line(-75, u.d + 30, 2300, u.d + 30, 'S-EXIST'); v.line(-75, u.d + 105, 2300, u.d + 105, 'S-EXIST'); [180, 290].forEach(x => v.line(x, -hc - 20, x, 30, 'S-BOLT')); for (let x = 300; x < 2100; x += 600) v.line(x, u.d - 10, x, u.d + 130, 'S-BOLT');
    v.dim(30, -hc - 100, 30 + Ls, -hc - 100, -6, Ls + ' MIN.'); v.dim(-120, u.d + 30, -120, u.d - 270, 8, '300 MIN. *'); v.dim(330, u.d + 200, 380, u.d + 200, 6, '50');
    v.leader(1500, u.d / 2 + 16, 14, -10, 'PROPOSED STEEL STRINGER ' + secName(p.ub)); v.leader(15, u.d / 2, -18, 18, 'SEASONED JARRAH TIMBER PACKER\nOR STEEL SHIMS TO SUIT'); v.leader(250, u.d + 22, 16, 22, '200x(6,8,10 OR 12FL)x300 LONG STEEL PACKERS (TACK WELD)'); v.leader(150, 8, 20, -22, 'MODIFIED FLANGE - REFER DETAIL; 6 BOTH SIDES OF WEB'); v.leader(235, -hc - 10, 18, -14, 'φ20 THREADED ROD WITH 65x5FLx65 WASHER (TYP.)'); v.leader(150, -hc / 2, -18, -10, 'EXISTING TIMBER FULLCAP'); v.leader(-75, -800, -14, 6, 'EXISTING TIMBER\nABUTMENT SHEETING');
    LY.title('ABUTMENT - STRINGER REPLACEMENT DETAIL - TYPE 1', 20, 'ELEVATION');
    const w = LY.view(10); w.rect(0, 0, Ls + 50, 200, 'S-NEW'); w.rect(Ls, 100 - 5, 50, 10, 'S-NEW'); w.line(0, 95, Ls - 20, 95, 'S-EXIST'); w.rect(Ls - 20 - 0 + 0, 50 - 50, 50, 300, 'S-TEXT');
    w.dim(0, -40, Ls, -40, -6, String(Ls)); w.dim(Ls, -40, Ls + 50, -40, -6, '50'); w.dim(-40, 0, -40, 200, 6, '200'); w.dim(-70, 95, -70, 105, 6, '10'); w.leader(30, 180, -10, 16, '200x16FL'); w.leader(Ls + 25, 250, 14, 10, 'STEEL PACKER 200 x 300');
    LY.title('MODIFIED FLANGE DETAILS', 10, '* DIMENSIONS SITE MEASURED PRIOR TO FABRICATION');
    LY.notes(['STEEL STRINGER SHALL BE FABRICATED TO ALLOW ADEQUATE CLEARANCE FROM THE ABUTMENT SHEETING TO FACILITATE INSTALLATION.', 'THREADED ROD EVERY THIRD DECK PLANK ON ALTERNATING SIDES OF WEB (45 / 45 FROM ℄ STRINGER). FIX LOOSE PLANKS TO ADJACENT BOLTED PLANKS WITH φ10x200 LONG SPIKES.', 'SEAT: 150x150x10 EA x300 LONG WITH M20 BOLTS. TIMBER PACKER OR STEEL SHIMS FIXED TO SHEETING WITH φ3.2 CLOUT HEAD NAILS.', '300 MIN. MAY BE REDUCED SUBJECT TO THE ENGINEER\'S ASSESSMENT AND VERIFICATION.'], 140);
    return LY.done();
  });

  // 45 TIMBER STRINGER BOLTING (split repair) (PN30-3121 / 3122)
  def('stb', 'Stringers', 'Timber stringer bolting – split repair', 'PN30-3121', [P('L', 'Length of horizontal split (mm)', 1600, { num: 1 }), P('D', 'Stringer dia. (mm)', 450, { num: 1 })], (p) => {
    const LY = new Lay(), Ls = max(600, +p.L || 1600), D = +p.D || 450, v = LY.view(20), xe = 2400;
    v.line(-400, 0, xe, 0, 'S-EXIST'); v.line(-400, -D, xe - 300, -D, 'S-EXIST'); v.pl([[xe - 300, -D], [xe - 150, -D - 250], [xe + 400, -D - 250]], false, 'S-EXIST'); v.line(-400, 70, xe + 400, 70, 'S-EXIST'); v.line(-400, 220, xe + 400, 220, 'S-CONC');
    v.rect(200, 70, 2000, 150, 'S-NEW'); v.cl(xe + 150, -D - 700, xe + 150, 400, 'PIER'); timberX(v, xe - 50, -D - 650, 400, 400);
    const ys = -D * 0.45, xs0 = xe - 300 - Ls; v.pl(Array.from({ length: 12 }, (_, i) => [xs0 + i * Ls / 11, ys + (i % 2 ? 8 : -8)]), false, 'S-TEXT');
    const xr = [xs0 + 100, xs0 + 100 + 500, xs0 + 100 + 1000].filter(x => x < xe - 150); xr.forEach(x => { v.line(x, -D - 60, x, 120, 'S-BOLT'); v.rect(x - 40, -D - 60, 80, 20, 'S-BOLT'); }); v.line(xs0 - 500, -D - 40, xs0 - 500, 120, 'S-BOLT');
    v.rect(xs0 + 300, ys - 50, 60, 160, 'S-NEW'); v.rect(xs0 + 800, ys - 50, 60, 160, 'S-NEW');
    v.dim(xr[0], -D - 160, xr[1] || xr[0] + 500, -D - 160, -6, '500'); if (xr[2]) v.dim(xr[1], -D - 160, xr[2], -D - 160, -6, '500'); v.dim(xe - 300, -D - 160, xe - 150, -D - 160, -6, '150 MIN.'); v.dim(xs0 - 500, 280, xs0 + 100, 280, 6, '500 *');
    v.leader(xr[0], -D - 50, -18, -16, 'φ24 THREADED RODS (TYP. UNO); CURVED WASHER WITH\nSHOP DRILLED φ28 HOLE (STANDARD PILE BAND DRAWING)'); v.leader(xs0 + Ls / 3, ys, -16, -30, 'HORIZONTAL SPLIT IN STRINGER'); v.leader(1000, 145, 10, 18, '150 PFC x2000 LONG NOM. *'); v.leader(xs0 - 500, 100, -16, 16, 'φ20 THREADED ROD - PROVIDE IF HORIZONTAL\nSPLIT EXTENDS 500 BEYOND φ24 BOLT'); v.leader(xe + 600, 220, 10, 10, 'PROPOSED CONCRETE DECK'); v.leader(xe + 150, -D - 450, 16, -8, 'EXISTING TIMBER HALFCAP'); v.leader(xe - 150, -D - 200, 16, -18, 'EXISTING TIMBER CORBEL');
    LY.title('PIER - TIMBER STRINGER BOLTING DETAILS', 20, 'ELEVATION');
    const w = LY.view(10); w.circ(0, 0, D / 2, 'S-EXIST'); w.line(-D / 2 - 60, D / 2, D / 2 + 60, D / 2, 'S-EXIST'); [[0, -D / 2 - 30, 0, D / 2 + 40, 'V'], [-D / 2 * 0.7 - 30, -D / 2 * 0.7 - 30, D / 2 * 0.7 + 30, D / 2 * 0.7 + 30, 'D'], [-D / 2 - 30, 0, D / 2 + 30, 0, 'H']].forEach(([a, b2, c2, d2, k]) => { w.line(a, b2, c2, d2, 'S-BOLT'); w.text(c2 + 10, d2, k, 2.4); });
    w.leader(-D / 4, 30, -22, 18, 'SPLIT (TYP.) - ROD AT 90° ±15° TO SPLIT');
    LY.title('BOLT DIRECTIONS', 10, 'V VERTICAL · D DIAGONAL · C CROSS · H HORIZONTAL');
    LY.notes(['THIS DETAIL IS ONLY APPLICABLE FOR BRIDGE MAINTENANCE WHERE A CONCRETE OVERLAY IS INTENDED; REFER TO THE BOLTING REQUIREMENT TABLE.', 'ALL BOLTS φ20 THREADED ROD COATED WITH DENSO PASTE UNO, AT 600 CENTRES FOR SPLITS > 5 mm WIDE. JACK SPLIT CLOSED BEFORE DRILLING.', 'PROVIDE VERTICAL BOLTS IF VERTICAL SPLITS TO THE STRINGER END EXCEED 1500 LENGTH.', '* DIMENSIONS SITE MEASURED PRIOR TO FABRICATION AND CONSTRUCTION.'], 150);
    return LY.done();
  }, 'Closing horizontal / vertical splits in timber stringers with rods and a PFC on the deck before a concrete overlay.');

  // 46 CONCRETE OVERLAY – TYPICAL CROSS SECTION (PN30-3201)
  def('ovl', 'Deck & overlay', 'Concrete deck overlay – typical cross section', 'PN30-3201', [P('ns', 'Number of stringers', 7, { num: 1 }), P('Wk', 'Width between kerbs (mm)', 6000, { num: 1 }), P('t', 'Slab thickness (mm)', 130, { num: 1 }), P('xf', 'Crossfall (%)', 3, { num: 1 })], (p) => {
    const LY = new Lay(), ns = max(2, +p.ns || 7), Wk = +p.Wk || 6000, t = max(130, +p.t || 130), xf = (+p.xf || 3) / 100, v = LY.view(25), W = Wk + 600, x0 = -W / 2;
    const sp = (Wk - 400) / (ns - 1); for (let i = 0; i < ns; i++) { const x = -Wk / 2 + 200 + i * sp; v.circ(x, -230, 230, 'S-EXIST'); v.text(x, -230, String(i + 1), 2.4, 'c', 'm'); }
    v.line(x0, 0, -x0, 0, 'S-EXIST'); v.line(x0, -0 + 0, x0, -0 - 75, 'S-EXIST');
    const yTop = x => t + (Wk / 2 - abs(x)) * xf; const pts = [[x0, 0], [x0, t + 100 + 30], [x0 + 300, t + 100 + 30], [-Wk / 2, yTop(-Wk / 2)], [0, yTop(0)], [Wk / 2, yTop(Wk / 2)], [-x0 - 300, t + 130], [-x0, t + 130], [-x0, 0]];
    v.pl(pts, true, 'S-CONC'); v.hatch(pts, 'conc', 'S-HATCH'); v.line(x0 + 75, 40, -x0 - 75, 40, 'S-REO'); v.line(x0 + 75, t - 40, -x0 - 75, t - 40, 'S-REO');
    [x0 + 150, -x0 - 150].forEach(x => { v.line(x, t + 130, x, -350, 'S-BOLT'); }); v.line(0, 0, 0, yTop(0) + 0, 'S-TEXT');
    v.dim(x0, t + 600, -x0, t + 600, 8, 'OVERALL ' + W); v.dim(-Wk / 2, t + 450, Wk / 2, t + 450, 8, Wk + ' BETWEEN KERBS'); v.dim(-x0 + 150, 0, -x0 + 150, t, -6, t + ' MIN.');
    v.text(-Wk / 4, yTop(-Wk / 4) + 60, (xf * 100).toFixed(1) + '%', 2.4, 'c'); v.text(Wk / 4, yTop(Wk / 4) + 60, (xf * 100).toFixed(1) + '%', 2.4, 'c'); v.text(-Wk / 3, t / 2 + 20, 'U3 (BROOM FINISH)', 2.2, 'c');
    v.leader(0, yTop(0) / 2, 14, 26, 'CONSTRUCTION JOINT; 500 WIDE BITUTHENE\nOR SIMILAR APPROVED WHERE ROAD SEAL APPLIES'); v.leader(x0 + 150, -200, -12, -10, 'POST ANCHOR RODS AT 2000 CRS'); v.leader(-Wk / 2 + 200 + sp, -10, 8, -24, 'EXISTING TIMBER DECK COVERED WITH ONE LAYER OF 1800 WIDE\n280 g (10 oz) HESSIAN FIXED AT 1 m SQUARE INTERVALS'); v.leader(-x0 - 150, t + 60, 14, 12, '150 WIDE INSITU KERB');
    LY.title('CONCRETE OVERLAY - TYPICAL SECTION', 25);
    LY.notes(['CONCRETE CLASS S40 MIN. 130 SLAB; SL81 DECK FABRIC TYPE X, KERB FABRIC TYPE 4, LAP FABRIC TYPE 8 (300 LAP).', 'SAWN CONTRACTION JOINTS SHALL EXTEND THE FULL WIDTH OF THE BRIDGE AT EACH PIER. OVERLAY CONSTRUCTED IN TWO HALVES WITH ONE LANE OPEN.', 'STENCIL BRIDGE NUMBER ON TOP OF KERB AT APPROACH ENDS USING 75mm LETTERING. ONE DOWNPIPE PER SIDE NEAR MID-SPAN (TWO-WAY CROSSFALL) OR ON THE LOW SIDE (SUPERELEVATION), 500 MIN FROM POST ANCHOR RODS.'], W / 25);
    return LY.done();
  }, 'Reinforced concrete overlay on the existing timber deck, drawn for the stringer count, kerb width, slab depth and crossfall you enter.');

  // 47 KERB & DOWNPIPE DETAILS (PN30-3204)
  def('kdp', 'Deck & overlay', 'Kerb & downpipe details', 'PN30-3204', [P('str', 'Stringer under downpipe', 'timber', { opts: ['timber', 'steel'] }), P('elbow', 'Downpipe', 'straight', { opts: ['straight', '45° elbow'] })], (p) => {
    const LY = new Lay(), steel = p.str === 'steel', elb = p.elbow !== 'straight', v = LY.view(10);
    const kerb = [[-700, 0], [-700, 130], [-60, 130], [-40, 150], [-40, 230], [-20, 250], [240, 250], [260, 230], [260, 0]]; v.pl(kerb, true, 'S-CONC'); v.hatch(kerb, 'conc', 'S-HATCH');
    v.line(-900, 0, 300, 0, 'S-EXIST'); v.line(-900, -125, 300, -125, 'S-EXIST'); v.line(-700, 60, 200, 60, 'S-REO'); v.pl([[-20, 200], [220, 200], [220, 60]], false, 'S-REO');
    if (steel) { iSec(v, 80, -125 - SEC['410UB54'].d / 2, SEC['410UB54'], 0, 'S-NEW'); v.rect(-120, -60, 2, 60, 'S-NEW'); } else v.circ(80, -125 - 230, 230, 'S-EXIST');
    const px = steel ? -150 : -80; if (!elb) { v.rect(px - 50, -650, 100, 790, 'S-NEW'); } else { v.rect(px - 50, -150, 100, 290, 'S-NEW'); v.pl([[px - 50, -150], [px - 50 - 120, -400], [px - 50 - 20, -460], [px + 50, -150]], true, 'S-NEW'); }
    v.rect(260, 0, 10, 250, 'S-TEXT'); v.line(80, -125, 80, -10, 'S-BOLT');
    v.dim(-40, 300, 260, 300, 6, '300'); v.dim(-40, 280, -15, 280, 6, '25'); v.dim(320, 130, 320, 250, -6, '100'); v.dim(320, 0, 320, 130, -6, '130 MIN.'); v.dim(-700, -170, -700 + 0, -125, 6, ''); v.dim(px - 50, -720, px + 50, -720, -6, '100');
    v.wl(-500, 130, 'RUNNING SURFACE'); v.leader(265, 120, 14, 8, '10 THICK EXPANDED FOAM\n(EXPANDAFOAM OR SIMILAR)'); v.leader(-20, 250, -12, 14, '20x20 CHAMFER (TYP.)'); v.leader(px, -300, -20, -8, 'φ100 UPVC DOWNPIPE' + (elb ? ' WITH 45° ELBOW' : '') + '\nWITH FIXING STRAP; 100 MIN. BELOW STRINGER'); v.leader(80, -60, 18, -18, 'φ10x200 LONG SPIKE AT 400 CRS'); v.leader(-600, -60, -10, -14, 'EXISTING TIMBER DECKING TO BE TRIMMED TO SUIT'); v.leader(80, -125 - (steel ? 200 : 230), 22, -8, steel ? '410 UB 54 PROPOSED STRINGER; 1mm BONDEK\nPERMANENT FORMWORK' : 'EXISTING TIMBER STRINGER (100 BEARING)'); v.leader(-500, 30, -10, 12, 'HESSIAN');
    LY.title('KERB & DOWNPIPE DETAILS', 10, steel ? 'STEEL STRINGER' : 'TIMBER STRINGER');
    LY.notes(['NEVER CUT / TRIM STRINGER TO ACCOMMODATE DOWNPIPE. SHAPE UPVC DOWNPIPE TO SUIT (IF REQUIRED).', 'IF ROOM PERMITS, LOCATE DOWNPIPE ON KERB SIDE OF STRINGER.', 'BASED ON THE CONCRETE DECK AS THE RUNNING SURFACE: 130 MIN SLAB, 125 TIMBER DECKING AND 165 FOR GUARDRAILING CONNECTION PLATE BEARING (265 MIN).', 'φ10 x 200 DECK SPIKE - MIN. 1 PER PLANK (EXISTING OR NEW).'], 120);
    return LY.done();
  });

  // 48 CONTRACTION JOINTS (PN30-3211)
  def('cj', 'Deck & overlay', 'Overlay contraction joints at piers', 'PN30-3211', [P('t', 'Deck depth (mm)', 150, { num: 1 })], (p) => {
    const LY = new Lay(), t = +p.t || 150, deep = t >= 200, v = LY.view(10), pd = deep ? 50 : 32;
    const sl = [[-800, 0], [800, 0], [800, t], [-800, t]]; v.pl(sl, true, 'S-CONC'); v.hatch(sl, 'conc', 'S-HATCH'); v.line(-800, 0, 800, 0, 'S-EXIST'); v.line(-800, -125, 800, -125, 'S-EXIST'); for (let x = -750; x <= 750; x += 250) v.line(x, -125, x, 0, 'S-EXIST');
    v.line(-780, 40, 780, 40, 'S-REO'); if (deep) { v.line(-780, t - 40, -50, t - 40, 'S-REO'); v.line(50, t - 40, 780, t - 40, 'S-REO'); } v.circ(0, deep ? 25 + 0 : 25, pd / 2, 'S-NEW'); v.rect(-3.5, t - 30, 7, 30, 'S-TEXT'); v.cl(0, -200, 0, t + 150, deep ? 'PIER & CJ' : 'PIER');
    v.leader(0, 25, 18, -18, 'φ' + pd + ' PVC PIPE TO FULL WIDTH OF BRIDGE, PLACED\nCENTRALLY UNDER CONTRACTION JOINT, FIXED TO DECK FABRIC'); v.leader(-400, 40, -14, -14, 'SL81 DECK FABRIC TYPE X' + (deep ? '' : ' - CUT EVERY SECOND BAR')); v.leader(400, -60, 14, -14, 'EXISTING TIMBER DECKING'); v.leader(500, 0, 12, 22, 'HESSIAN'); if (deep) v.dim(-50, t + 60, 50, t + 60, 6, '100');
    LY.title('SECTION A - TYPICAL ALL PIERS', 10, 'DECK DEPTH ' + (deep ? '200+' : '130 - 200'));
    const w = LY.view(1); w.rect(-40, -60, 80, 60, 'S-CONC'); w.rect(-3.5, -30, 7, 30, 'S-TEXT'); w.rect(-3.5, -10, 7, 10, 'S-NEW'); w.hatch([[-3.5, -10], [3.5, -10], [3.5, 0], [-3.5, 0]], 'ansi31', 'S-HATCH'); w.circ(0, -15, 5, 'S-NEW');
    w.dim(-3.5, 8, 3.5, 8, 6, '7'); w.dim(10, -10, 10, 0, -6, '10'); w.dim(24, -30, 24, 0, -6, '30'); w.leader(0, -15, -18, -10, 'φ10 POLYETHYLENE FOAM BACKING ROD'); w.leader(0, -5, 18, 10, 'GUN GRADE SILICONE\n(DOW CORNING 888 OR SIMILAR)');
    LY.title('DETAIL 1', 1);
    LY.notes(['CONTRACTION JOINT (CJ) SAWN OR FORMED, CLEAN AND DRY PRIOR TO APPLICATION OF SILICONE.', 'PIER CONTRACTION JOINTS MAY BE RELOCATED LEFT OR RIGHT OF ℄ PIER BY UP TO 200 TO AVOID POST ANCHOR RODS IF REQUIRED.', 'AT THE KERB, THE JOINT IS FORMED 30 DEEP x 7 WIDE; φ50 PVC PIPE WHERE \'X\' > 200 OR φ32 WHERE \'X\' < 200, WITH END CAPS.'], 120);
    return LY.done();
  });

  // 49 SILL BEAM / OVERLAY END AT ABUTMENT (PN30-3213)
  def('slb', 'Deck & overlay', 'Overlay end at abutment – sill beam', 'PN30-3213', [P('pf', 'Formwork', 'galv sheet', { opts: ['galv sheet', 'Bondek'] })], (p) => {
    const LY = new Lay(), v = LY.view(10);
    v.line(0, -900, 0, 300, 'S-EXIST'); v.line(-75, -900, -75, 300, 'S-EXIST'); const pts = [[0, 300], [0, -600], [340, -600], [340, 0], [1200, 0], [1200, 160], [0, 160]]; const ov = [[340, 160], [340, 300], [1200, 300], [1200, 160]];
    const sb = [[0, 300 + 0], [0, -375], [340, -375], [340, 300]]; v.pl(sb, true, 'S-CONC'); v.hatch(sb, 'conc', 'S-HATCH'); v.pl(ov, true, 'S-CONC'); v.hatch(ov, 'conc', 'S-HATCH');
    for (let i = 0; i < 4; i++) v.rect(340 + i * 225, 35, 225, 125, 'S-EXIST'); v.line(340, -375, 340, 300, p.pf === 'Bondek' ? 'S-NEW' : 'S-NEW'); v.rect(-10, -375, 10, 675, 'S-TEXT');
    v.line(40, -335, 300, -335, 'S-REO'); v.line(40, 260, 1150, 260, 'S-REO'); v.line(40, -335, 40, 260, 'S-REO'); v.line(300, -335, 300, 260, 'S-REO'); v.ground(-500, -80, 300);
    v.dim(0, 380, 340, 380, 6, '340'); v.dim(-120, -375, -120, 300, 8, '675'); v.dim(1250, 160, 1250, 300, -6, 'SLAB'); v.dim(340, -460, 1240, -460, -6, '900 NOM. (4 DECK PLANKS)');
    v.leader(-5, -200, -18, -8, 'EXPANDED FOAM (EXPANDAFOAM\nOR SIMILAR APPROVED)'); v.leader(340, -200, 18, -14, (p.pf === 'Bondek' ? '1mm BONDEK PERMANENT FORMWORK' : '2 THICK GALV. SHEET') + '; U/S DECK IS HORIZONTAL'); v.leader(170, 0, 4, 34, 'N12 BARS; SL81 STANDARD FABRIC TYPE 9'); v.leader(800, 100, 12, -26, 'EXISTING DECK'); v.leader(-75, -600, -14, 6, 'EXISTING SHEETING');
    LY.title('SECTION A - OVERLAY END AT ABUTMENT (SILL BEAM)', 10);
    LY.notes(['LENGTH OF CONCRETE DOWNSTAND SUBJECT TO ENGINEERING REQUIREMENTS AND DECK CONDITION (900 NOM = 4 DECK PLANKS).', 'DEPTH VARIES ACCORDING TO ASPHALT THICKNESS - ENGINEER TO CONFIRM. FOR APPROACH SLAB DETAILS REFER TO THE PROJECT DRAWING.', 'FOR GROUND TREATMENT REFER TO SPECIFICATION. EXPANSION ANGLE REFER TO EXPANSION ANGLE DETAIL.'], 110);
    return LY.done();
  });

  // 50 EXPANSION ANGLE (PN30-4208)
  def('exa', 'Deck & overlay', 'Expansion angle – Types 1 / 2', 'PN30-4208', [P('Wk', 'Width between kerbs (mm)', 7200, { num: 1 }), P('type', 'Type', 1, { opts: [1, 2], num: 1 })], (p) => {
    const LY = new Lay(), Wk = +p.Wk || 7200, L = Math.round(Wk / 2 + 10), t = +p.type || 1, v = LY.view(20), n = max(2, Math.floor((L - 210) / 200) + 1);
    v.rect(0, 0, L, 90, 'S-NEW'); v.line(0, 12, L, 12, 'S-NEW'); for (let i = 0; i < n; i++) { const x = (t === 1 ? 60 : 150) + i * (L - 210) / (n - 1); v.line(x, 0, x, -400, 'S-NEW'); v.line(x + 20, 0, x + 20, -400, 'S-NEW'); if (i % 3 === 1) v.circ(x + 10, 45, 5, 'S-BOLT'); }
    v.circ(t === 1 ? L - 220 : 220, 45, 12, 'S-BOLT');
    v.dim(0, 160, L, 160, 8, 'XXXX = ' + L); v.dim(0, -460, t === 1 ? 60 : 150, -460, -6, t === 1 ? '60' : '150'); v.dim(L - (t === 1 ? 150 : 60), -460, L, -460, -6, t === 1 ? '150' : '60');
    v.leader(L * 0.4, 45, 4, 22, 'φ10 TAPPED HOLE (TYP.) - SEE NOTE 2'); v.leader(t === 1 ? L - 220 : 220, 45, 10, 20, 'φ25 AIR RELEASE HOLE'); v.leader(L / 2, -300, 10, -10, 'ANCHOR STRAPS TYPE A & B AT 200 CRS MAX.'); v.leader(L * 0.1, 0, -6, -24, '150x90x12 UA');
    LY.title('EXPANSION ANGLE - TYPE ' + t, 20, '4 No. REQUIRED');
    const w = LY.view(5), A = 150, Bb = 90; aSec(w, 0, 0, Bb, A, 12, 1, -1, 'S-NEW'); w.pl([[12, -40], [40, -40], [60, -60], [400, -60]], false, 'S-NEW'); w.pl([[12, -110], [500, -110]], false, 'S-NEW'); w.line(-40, 0, 300, 0, 'S-TEXT'); w.wl(250, 0, 'RUNNING SURFACE');
    w.dim(0, 40, 30, 40, 6, '30'); w.dim(30, 70, 70, 70, 6, '40'); w.dim(0, -160, 500, -160, -6, '500'); w.leader(300, -60, 10, 8, '20x10 FL ANCHOR STRAP TYPE A (400 LONG, 20 RAD)'); w.leader(400, -110, 10, -8, '20x10 FL ANCHOR STRAP TYPE B'); w.leader(45, -12, -16, 14, '150x90x12 UA');
    LY.title('SECTION A', 5);
    LY.notes(['XXXX = (WIDTH BETWEEN KERBS / 2) + 10 WHERE SYMMETRICAL ABOUT ℄ BRIDGE. 5 GAP AT ℄ BRIDGE.', 'THE M10 TAPPED HOLES SHALL BE UTILISED TO ACCURATELY LOCATE AND FIX THE EXPANSION JOINT ANGLES DURING CONSTRUCTION; THESE HOLES SHALL BE TAPED TO PREVENT THE INGRESS OF CONCRETE DURING POURING.', 'EXPANSION ANGLES DRAWN FOR A BRIDGE WITH CROSSFALL ONLY; SIMILAR FOR SUPERELEVATION. 3 mm AND 5 mm FILLET WELDS.'], 140);
    return LY.done();
  });

  function generate(id, params) { const d = DEF.find(q => q.id === id); if (!d) return []; const p = {}; d.params.forEach(q => { p[q.k] = params && params[q.k] != null ? params[q.k] : q.v; }); return GEN[id](p); }
  function bbox(E) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    E.forEach(e => { if (e.t === 'line') { add(...e.a); add(...e.b); } else if (e.t === 'pl' || e.t === 'hatch' || e.t === 'solid') e.p.forEach(q => add(...q)); else if (e.t === 'circle' || e.t === 'arc') { add(e.c[0] - e.r, e.c[1] - e.r); add(e.c[0] + e.r, e.c[1] + e.r); } else if (e.t === 'text') { const w = e.s.length * e.h * 0.72, x = e.al === 'c' ? e.p[0] - w / 2 : e.al === 'r' ? e.p[0] - w : e.p[0]; add(x, e.p[1] - e.h); add(x + w, e.p[1] + e.h); } });
    return x0 > x1 ? { x0: 0, y0: 0, x1: 1, y1: 1 } : { x0, y0, x1, y1 }; }
  // repair families suggested by the timber assessment
  const SUGGEST = { stringer: ['sbf', 'stf', 'scs', 'asr', 'stb', 'ssp', 'cr1'], pierPile: ['pp2a', 'pp1', 'pp4', 'pp4c', 'pps', 'spb', 'pb3', 'pphc1'], abutPile: ['ap1a', 'ap2', 'atA', 'atBC', 'atDE', 'atFG', 'ahc', 'prs'], halfcap: ['phs', 'phc2', 'phr', 'phw', 'ahs', 'afr', 'hcr', 'hcb', 'hcch1'], bearing: ['hcb', 'phs', 'spb', 'phc2'], wing: ['ww1', 'ww2', 'ww3', 'wwx'], sheeting: ['shc', 'sht1', 'sht2', 'scr', 'srb', 'srr'], planks: ['stf', 'ovl', 'kdp', 'cj', 'slb', 'exa'] };
  G.TDET = { DEF, generate, bbox, LAYERS, SEC, SUGGEST, Builder };
})(typeof window !== 'undefined' ? window : globalThis);
