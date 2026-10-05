/* StructCap Timber — repair details: PN30-2201 … 2305 (sheeting, scour, wingwall extension, retaining wall, spiking rail, halfcap replacement / strengthening).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ local helpers
  // earth "tuft" symbol (MRWA): a short run of crossing diagonal strokes on the line (x1..x2, y); side +1 above, -1 below
  function earth(v, x1, x2, y, side) { const s = v.s, st = 1.6 * s, h = 1.5 * s * (side || 1); let k = 0; for (let x = x1; x + st * 0.7 <= x2; x += st * 0.7, k++) { if (k % 4 === 3) v.line(x, y, x + st * 0.7, y + h, 'S-GROUND'); else v.line(x + st * 0.7, y, x, y + h, 'S-GROUND'); } }
  // the same on a vertical face (x, y1..y2); side +1 to the right, -1 to the left
  function earthV(v, x, y1, y2, side) { const s = v.s, st = 1.6 * s, h = 1.5 * s * (side || 1); let k = 0; for (let y = y1; y + st * 0.7 <= y2; y += st * 0.7, k++) { if (k % 4 === 3) v.line(x, y + st * 0.7, x + h, y, 'S-GROUND'); else v.line(x, y, x + h, y + st * 0.7, 'S-GROUND'); } }
  // natural surface line with tufts on it (as the elevations draw the ground)
  function gl(v, x1, x2, y, side) { v.line(x1, y, x2, y, 'S-GROUND'); earth(v, x1, x2, y, side || 1); }
  // concrete surface finish symbol: tick (V) with its point on the surface at (x,y); ang = direction from the surface outwards (deg)
  function fin(v, x, y, s, ang) { const a = (ang == null ? 90 : ang) * PI / 180, p = v.P(x, y), u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]], L = 2.2;
    v.add({ t: 'pl', p: [[p[0] + u[0] * L + n[0] * L, p[1] + u[1] * L + n[1] * L], p, [p[0] + u[0] * L - n[0] * L, p[1] + u[1] * L - n[1] * L]], closed: false, L: 'S-TEXT' });
    const q = [p[0] + u[0] * (L + 2.2), p[1] + u[1] * (L + 2.2)]; v.add({ t: 'text', p: q, s, h: 2.2, al: abs(u[0]) > 0.5 ? (u[0] > 0 ? 'l' : 'r') : 'c', v: abs(u[0]) > 0.5 ? 'm' : (u[1] > 0 ? 'b' : 't'), ang: 0, L: 'S-TEXT' }); }
  // designer / construction note box (as View.noteBox, but wrapping with the rendered character width so text stays inside the box)
  function nb(t, x, y, str, w, opt) { opt = opt || {}; const v = t instanceof A.View ? t : new A.View(t, 1, 0, 0), p = v.P(x, y), h = opt.h || TH, lines = [];
    String(str).split('\n').forEach(par => { let cur = ''; par.split(' ').forEach(wd => { if ((cur + ' ' + wd).length * h * 0.74 > w - 4 && cur) { lines.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; }); lines.push(cur); });
    const H = lines.length * h * 1.55 + 2.6; v.add({ t: 'pl', p: [[p[0], p[1]], [p[0] + w, p[1]], [p[0] + w, p[1] - H], [p[0], p[1] - H]], closed: true, L: opt.solid ? 'S-TEXT' : 'S-NOTE' });
    lines.forEach((l, i) => v.add({ t: 'text', p: [p[0] + 2, p[1] - 1.6 - h - i * h * 1.55], s: l, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' })); return H; }
  // "DRG NUMBER – REFER TO PLAN DRAWING" designer box (free block)
  function drgBox(LY) { LY.block(B => { nb(B, 0, 0, 'DRG NUMBER - REFER TO\nPLAN DRAWING', 46); }); }
  // section marker on a cut line: circle with letter + pointer at (x,y), filled half-arrow at (x2,y2), line between
  function secMark(v, x, y, x2, y2, ch, dir) { v.mark(x, y, ch, dir); const a = v.P(x, y), b = v.P(x2, y2), d = Math.sign(b[1] - a[1]) || 1; v.add({ t: 'line', a: [a[0], a[1] + 3 * d], b: [a[0], a[1] + 8 * d], L: 'S-TITLE' }); v.add({ t: 'line', a: b, b: [b[0], b[1] - 5 * d], L: 'S-TITLE' }); const k = (dir || 0) === 180 ? -1 : 1; v.add({ t: 'solid', p: [[b[0], b[1]], [b[0], b[1] - 4 * d], [b[0] + k * 1.6, b[1] - 2 * d]], L: 'S-TITLE' }); }
  // points on an arc (deg, ccw from a0 to a1)
  const arcP = (cx, cy, r, a0, a1, n) => Array.from({ length: (n || 16) + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / (n || 16)) * PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  // existing timber pile seen in plan (dash-dot circle) / steel UC in plan with web at x (depth along y)
  const pileC = (v, x, y, D) => v.circ(x, y, D / 2, 'S-EXIST');
  // spike seen in plan / section (head at a, point at b) drawn as a long slender spike
  function spikeL(v, x1, y1, x2, y2) { const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy * 5, ny = ux * 5, t = 25; v.pl([[x1, y1 + 0], [x1 + nx, y1 + ny], [x2 - ux * t + nx, y2 - uy * t + ny], [x2, y2], [x2 - ux * t - nx, y2 - uy * t - ny], [x1 - nx, y1 - ny], [x1, y1]], false, 'S-BOLT'); v.line(x1 + nx * 1.8, y1 + ny * 1.8, x1 - nx * 1.8, y1 - ny * 1.8, 'S-BOLT'); }
  // spike seen end-on (circle with a cross)
  function spikeE(v, x, y) { const r = 0.9 * v.s; v.circ(x, y, r, 'S-BOLT'); v.line(x - r * 1.7, y, x + r * 1.7, y, 'S-BOLT'); v.line(x, y - r * 1.7, x, y + r * 1.7, 'S-BOLT'); }
  // SL fabric line with cross-wire dots offset to one side (k = ±1 normal side), spacing sp
  function fab(v, x1, y1, x2, y2, sp, k) { v.line(x1, y1, x2, y2, 'S-REO'); const L = Math.hypot(x2 - x1, y2 - y1), n = max(1, Math.round(L / (sp || 100))), nx = -(y2 - y1) / L, ny = (x2 - x1) / L, o = 0.9 * v.s * (k || 1); for (let i = 0; i <= n; i++) { const t = i / n; v.circ(x1 + (x2 - x1) * t + nx * o, y1 + (y2 - y1) * t + ny * o, 0.3 * v.s, 'S-REO'); } }
  // sheeting in section (vertical planks between y0..y1, face at x, thickness t towards -x), plank joints at pitch
  function sheetSec(v, x, y0, y1, t, pitch) { v.line(x - t, y0, x - t, y1, 'S-EXIST'); for (let y = y0; y <= y1 + 1; y += pitch) v.line(x - t, y, x, y, 'S-EXIST'); }

  // ================================================================== PN30-2201 sheeting repair (concrete infill)
  def('pn2201', 'Sheeting', 'Abutment / wingwall sheeting repair – concrete infill', 'PN30-2201', [P('D', 'Pile dia. (mm)', 320, { num: 1 }), P('H', 'Wall height above G.L. (mm)', 600, { num: 1 })], (p) => {
    const LY = new Lay(560), D = +p.D || 320, H = +p.H || 600;
    // ---- SECTION A 1:10 — x = 0 back face of concrete (front face of sheeting), y = 0 natural G.L.
    const v = LY.view(10), yb = -600, yt = H;
    v.line(0, yb - 300, 0, yt + 330, 'S-EXIST'); v.line(D, yb - 300, D, yt + 330, 'S-EXIST'); v.pileEnd(D / 2, yt + 330, D, 'S-EXIST'); v.pileEnd(D / 2, yb - 300, D, 'S-EXIST');
    sheetSec(v, 0, yb - 60, yt + 230, 75, 182); v.line(-75, yt + 230, -75, yt + 330, 'S-EXIST'); v.brk(-110, yt + 300, 30, yt + 300);
    earthV(v, -75, yt - 470, yt - 100, -1);
    const sec = [[0, yb], [D, yb], [D, -150], [200, -150], [200, yt - 70], [150, yt - 20], [0, yt]]; concBox(v, sec);
    v.line(0, yb, D, yb, 'S-CONC'); gl(v, 200, D + 30, 0, -1);
    fab(v, 125, yb + 75, 125, yt - 50, 100, -1);
    for (let y = yb + 100; y < yt - 60; y += 200) spikeE(v, 75, y);
    fin(v, 85, yt - 11, 'U2', 90); fin(v, (200 + D) / 2, -150, 'U1', 90); fin(v, 200, 260, '2', 0); fin(v, D, -380, '4', 0);
    v.dim(0, yt + 150, 200, yt + 150, 6, '200');
    v.dim(D + 120, yt - 20, D + 120, yt, -2, '20'); v.line(150, yt - 20, D + 130, yt - 20, 'S-DIM'); v.line(210, yt, D + 260, yt, 'S-DIM');
    v.dim(D + 200, 0, D + 200, yt, -1, '✱'); v.dim(D + 200, yb, D + 200, 0, -1, '600 (MIN.)'); v.line(D + 20, yb, D + 210, yb, 'S-DIM');
    v.dim(D + 120, -150, D + 120, 0, -1, '150'); v.line(D + 10, -150, D + 130, -150, 'S-DIM'); v.line(D + 40, 0, D + 210, 0, 'S-DIM');
    v.dim(D + 120, yb, D + 120, yb + 75, -1, '75'); v.line(135, yb + 75, D + 130, yb + 75, 'S-DIM');
    v.dim(-200, yb + 100, -200, yb + 300, 4, '200', { sub: 'TYP' }); v.line(-210, yb + 100, 60, yb + 100, 'S-DIM'); v.line(-210, yb + 300, 60, yb + 300, 'S-DIM');
    v.dim(125, 450 - 600 + yt, 200, 450 - 600 + yt, 0.1, '75 COVER');
    v.wl(D + 260, 0, 'NATURAL G.L.');
    v.leader(-75, yt + 40, -8, 6, 'EXISTING\nSHEETING'); v.leader(175, yt - 45, 18, 22, '50 CHAMFER'); v.leader(125, -50, -24, 8, 'SL81 FABRIC'); v.leader(75, yb + 300, -24, 14, 'SPIKE (TYP)');
    const vt = v.P(D + 330, yt * 0.55); v.add({ t: 'pl', p: [[vt[0], vt[1]], [vt[0] + 42, vt[1]], [vt[0] + 42, vt[1] + 7], [vt[0], vt[1] + 7]], closed: true, L: 'S-TEXT' }); v.add({ t: 'text', p: [vt[0] + 2, vt[1] + 2.3], s: '✱ DIMENSION TO SUIT', h: 2.2, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
    LY.title('SECTION A', 10);
    LY.break();
    // ---- PLAN 1:10 — y = 0 front face of sheeting, -y towards the creek
    const w = LY.view(10), c1 = 400 + D / 2, wb = c1 + D / 2 + 650, c2 = wb + 75 + D / 2, xe = c2 + D / 2 + 280, x0 = -420;
    w.line(x0, 75, xe, 75, 'S-EXIST'); w.line(x0, 0, xe, 0, 'S-EXIST'); w.brk(x0, 75, x0, -40); w.brk(xe, 75, xe, -40); earth(w, c1 - 60, c1 + 200, 75, 1); earth(w, c2 - 60, c2 + 200, 75, 1);
    // existing concrete pile repair
    w.pl([[0, 0], [-250, 0], [-250, -520], [0, -520]], true, 'S-EXIST'); w.hatch([[0, 0], [-250, 0], [-250, -520], [0, -520]], 'conc', 'S-HATCH', 0.8);
    // new concrete panel: upper wall 200, lower part to the back of the piles (D)
    const a1 = c1 - D / 2, a2 = c1 + D / 2, fl = 70;
    concBox(w, [[0, 0], [a1, 0], [a1, -D], [0, -D]]); concBox(w, [[a2, 0], [wb - 4, 0], [wb - 4, -D], [a2, -D]]); concBox(w, [[c2 + D / 2, 0], [xe, 0], [xe, -D], [c2 + D / 2, -D]]);
    w.line(0, -200, a1, -200, 'S-CONC'); w.line(a2, -200, wb - 4, -200, 'S-CONC'); w.line(c2 + D / 2, -200, xe, -200, 'S-CONC');
    w.line(a1, -D, c1 - 100, -D, 'S-CONC'); w.line(c1 + 100, -D, a2, -D, 'S-CONC'); w.line(c1 - 100, -D, c1 - 100, -D + 25, 'S-CONC'); w.line(c1 + 100, -D, c1 + 100, -D + 25, 'S-CONC');
    pileC(w, c1, -D / 2, D); pileC(w, c2, -D / 2, D);
    // existing steel pile (UC, web normal to the sheeting)
    w.rect(wb - fl, -4, 2 * fl, 8, 'S-EXIST'); w.rect(wb - fl, -D - 4, 2 * fl, 8, 'S-EXIST'); w.line(wb - 4, -4, wb - 4, -D + 4, 'S-EXIST'); w.line(wb + 4, -4, wb + 4, -D + 4, 'S-EXIST');
    // dowels, spikes, fabric, bars
    w.rect(-200, -82, 400, 10, 'S-REO'); w.fill([[-200, -82], [0, -82], [0, -72], [-200, -72]], 'S-REO');
    spikeL(w, a1 - 125, -75, a1 + 125, -75); spikeL(w, a2 + 125, -75, a2 - 125, -75); spikeL(w, c2 + D / 2 + 125, -75, c2 + D / 2 - 125, -75);
    fab(w, 60, -125, a1 - 75, -125, 100, 1); fab(w, a2 + 75, -125, wb - fl - 10, -125, 100, 1); fab(w, c2 + D / 2 + 75, -125, xe, -125, 100, 1);
    w.rect(wb - 300 - 4, -70, 300, 12, 'S-REO');
    // dimensions
    w.dim(-200, -170, 0, -170, 4, '200'); w.dim(a1 - 75, -260, a1, -260, 0.1, '75 COVER', { sub: 'TYP' }); w.dim(0, -D - 90, a1, -D - 90, 0.1, 'DIMENSION VARIES');
    w.dim(c1 - 100, -D - 90, c1 + 100, -D - 90, 0.1, '200', { sub: 'TYP' }); w.dim(c1, -125, c1, -200, 0.1, '75');
    w.dim(a1 - 125, 75, a1, 75, 9, '='); w.dim(a1, 75, a1 + 125, 75, 9, '='); w.line(a1, 80, a1, -75, 'S-DIM'); w.line(a1 - 125, 80, a1 - 125, -65, 'S-DIM'); w.line(a1 + 125, 80, a1 + 125, -65, 'S-DIM');
    w.weld(wb - 4, -64, -18, -16, { size: '6', site: true, all: true });
    // section A
    secMark(w, 255, 300, 255, -D - 380, 'A', 0); w.line(255, 270, 255, 140, 'S-TITLE');
    // notes
    w.leader(-20, 0, -26, 14, 'EXISTING TIMBER\nSHEETING'); w.leader(-30, -77, -32, 4, 'N12 x 500 LONG DOWELS\nAT 200 CRS EMBEDDED &\nEPOXY GROUTED INTO\nφ20 HOLES IN EXISTING\nCONCRETE REPAIR');
    w.leader(a1 - 100, -75, -4, 22, 'φ10x250 LONG\nSPIKE (TYP)'); w.leader(a2 + 400, -125, -6, 26, 'SL81 FABRIC\n(TYP)'); w.leader(wb - 30, -64, 4, 30, 'N12 x 300 LONG AT 200 CRS\nSITE WELDED TO STEEL PILE\n(TYP)');
    w.leader(c1 + 40, -D / 2 - 40, 12, -18, 'EXISTING TIMBER\nPILE\n(TYP)', { dot: true }); w.leader(wb + 20, -D - 4, 6, -12, 'EXISTING STEEL\nPILE'); w.leader(-120, -520, -10, -10, 'EXISTING CONCRETE\nPILE REPAIR');
    LY.title('PLAN', 10);
    drgBox(LY);
    LY.caption('ABUTMENT/ WINGWALL SHEETING REPAIR DETAIL', 10, null, { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Concrete infill panel cast against deteriorated abutment / wingwall sheeting between piles, spiked to the sheeting and doweled to existing concrete pile repairs.');

  // ================================================================== PN30-2202 / 2202A / 2202B timber plank sheeting repairs
  // plan frame helpers: local (a, b) about the cleat origin O; e1 = unit vector from the span towards the pile, e2 = towards the back (earth)
  const fr = (O, e1, e2) => (a, b) => [O[0] + a * e1[0] + b * e2[0], O[1] + a * e1[1] + b * e2[1]];
  // coach screw (side view) from head (x1,y1) to point (x2,y2); washer under the head
  function cscrew(v, x1, y1, x2, y2, d) { d = d || 12; const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux, r = d / 2, t = 18;
    v.pl([[x1 + nx * r, y1 + ny * r], [x2 - ux * t + nx * r, y2 - uy * t + ny * r], [x2, y2], [x2 - ux * t - nx * r, y2 - uy * t - ny * r], [x1 - nx * r, y1 - ny * r]], false, 'S-BOLT');
    v.pl([[x1 + nx * 16, y1 + ny * 16], [x1 - ux * 4 + nx * 16, y1 - uy * 4 + ny * 16], [x1 - ux * 4 - nx * 16, y1 - uy * 4 - ny * 16], [x1 - nx * 16, y1 - ny * 16]], true, 'S-BOLT');
    v.pl([[x1 - ux * 4 + nx * 10, y1 - uy * 4 + ny * 10], [x1 - ux * 12 + nx * 10, y1 - uy * 12 + ny * 10], [x1 - ux * 12 - nx * 10, y1 - uy * 12 - ny * 10], [x1 - ux * 4 - nx * 10, y1 - uy * 4 - ny * 10]], true, 'S-BOLT'); }
  // timber pile trimmed flat at the cleat face (plan): full dash-dot circle + trim chord
  function trimPile(v, f, D) { const c = f(D / 2 - 40, -D / 2), h = sq(D * D / 4 - (D / 2 - 40) * (D / 2 - 40)); v.circ(c[0], c[1], D / 2, 'S-EXIST'); const p1 = f(0, -D / 2 + h), p2 = f(0, -D / 2 - h); v.line(p1[0], p1[1], p2[0], p2[1], 'S-EXIST'); return c; }
  // 150x90x8 UA cleat at a trimmed timber pile face (plan) with its two coach screws
  function cleatT(v, f) { v.pl([f(-90, -75), f(0, -75), f(0, -225), f(-8, -225), f(-8, -83), f(-90, -83)], true, 'S-NEW'); const s1 = f(-55, -87), s2 = f(-55, -10), s3 = f(-14, -160), s4 = f(70, -160); cscrew(v, ...s1, ...s2); cscrew(v, ...s3, ...s4); }
  // plank 230x75 in plan between local a = a0 .. 0 (front face b = -75)
  function plankP(v, f, a0, brk) { const q = [f(a0, 0), f(0, 0), f(0, -75), f(a0, -75)]; v.line(...q[0], ...q[1], 'S-NEW'); v.line(...q[1], ...q[2], 'S-NEW'); v.line(...q[2], ...q[3], 'S-NEW'); if (brk) v.brk(...q[0], ...q[3], 'S-NEW'); }
  // plan dimensions at a trimmed timber pile cleat (55 / 90 / 70 MIN BEARING / 40 MAX - TRIM)
  // dimension with its text placed freely: text lines at paper offset (dx,dy) from the dimension's second point (rot: rotated 90°)
  function dimx(v, x1, y1, x2, y2, off, lines, dx, dy, opt) { opt = opt || {}; v.dim(x1, y1, x2, y2, off, ' '); const p = v.P(x2, y2), L = String(lines).split('\n'), h = 2.0;
    L.forEach((l, i) => v.add({ t: 'text', p: opt.rot ? [p[0] + dx + i * h * 1.5, p[1] + dy] : [p[0] + dx, p[1] + dy - i * h * 1.5], s: l, h, al: opt.al || 'c', v: 'b', ang: opt.rot ? 90 : 0, L: 'S-DIM' }));
    if (opt.ul) { const w = max(...L.map(l => l.length)) * h * 0.72, x0 = (opt.al === 'r' ? p[0] + dx - w : opt.al === 'l' ? p[0] + dx : p[0] + dx - w / 2); v.add({ t: 'line', a: [x0, p[1] + dy - 0.8], b: [x0 + w, p[1] + dy - 0.8], L: 'S-DIM' }); } }
  // plan dimensions at a trimmed timber pile cleat (55 / 90 / 70 MIN BEARING / 40 MAX - TRIM); k = +1 pile to the right of the face
  function cleatDims(v, f, k, D) { const P = f; let a = P(-55, 150), b = P(0, 150); v.dim(a[0], a[1], b[0], b[1], 0.1, ' '); const tb = v.P(...b); v.ptext(tb[0] + k * 6, tb[1] + 0.8, '55', 2, 'c'); v.ptext(tb[0] + k * 6, tb[1] - 0.8, 'TYP', 2, 'c', 't', 'S-DIM'); v.add({ t: 'line', a: [tb[0] + k * 2, tb[1]], b: [tb[0] + k * 10, tb[1]], L: 'S-DIM' });
    [[-55, 90], [0, 90]].forEach(q => { const a1 = P(q[0], -60), b1 = P(q[0], q[1] + 80); v.line(a1[0], a1[1], b1[0], b1[1], 'S-DIM'); });
    a = P(70, -75); b = P(70, -160); v.dim(a[0], b[1], a[0], a[1], 0.1, ' '); let t = v.P(a[0], a[1]); v.add({ t: 'text', p: [t[0] + 3.0, t[1] + 4], s: 'TYP', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' }); v.add({ t: 'text', p: [t[0] - 0.4, t[1] + 4], s: '90', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' }); 
    a = P(120, -75); b = P(120, -225); v.dim(a[0], b[1], a[0], a[1], 0.1, ' '); t = v.P(b[0], b[1]); v.add({ t: 'text', p: [t[0] - 0.4, t[1] - 22], s: '70 MIN BEARING', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' }); v.add({ t: 'text', p: [t[0] + 3.0, t[1] - 22], s: 'TYP', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' }); v.add({ t: 'line', a: [t[0], t[1]], b: [t[0], t[1] - 22], L: 'S-DIM' });
    [[-75, 140], [-160, 90], [-225, 140]].forEach(q => { const p1 = P(20, q[0]), p2 = P(q[1], q[0]); v.line(p1[0], p1[1], p2[0], p2[1], 'S-DIM'); });
    a = P(-40, -D - 70); b = P(0, -D - 70); v.dim(a[0], a[1], b[0], b[1], 0.1, ' '); t = v.P(...a); const tx = t[0] - k * 20; v.add({ t: 'line', a: [t[0] - k * 2, t[1]], b: [tx - k * 14, t[1]], L: 'S-DIM' }); v.ptext(tx, t[1] + 0.8, '40 MAX - TRIM', 2, 'c', 'b', 'S-DIM'); v.ptext(tx, t[1] - 0.8, 'EXISTING PILE', 2, 'c', 't', 'S-DIM'); v.ptext(tx, t[1] - 3.9, 'TO SUIT (TYP)', 2, 'c', 't', 'S-DIM');
    const e1 = P(-40, -D / 2), e2 = P(-40, -D - 80), e3 = P(0, -230), e4 = P(0, -D - 80); v.line(e1[0], e1[1], e2[0], e2[1], 'S-DIM'); v.line(e3[0], e3[1], e4[0], e4[1], 'S-DIM'); }
  // existing sheeting band in plan (y 0..75) from x1 to x2, broken ends, earth tufts behind
  function sheetPlan(v, x1, x2, tufts) { v.line(x1, 75, x2, 75, 'S-EXIST'); v.line(x1, 0, x2, 0, 'S-EXIST'); (tufts || []).forEach(t => earth(v, t, t + 230, 75, 1)); }
  // elevation: existing sheeting joints (dash-dot) at 230 pitch, panel limits with break lines
  function sheetElev(v, x1, x2, y1, y2, gaps) { for (let y = y2 - 115; y > y1 + 50; y -= 230) v.line(x1, y, x2, y, 'S-EXIST'); const seg = (y) => { let xs = x1; (gaps || []).concat([[x2, x2]]).forEach(g => { if (g[0] > xs) { v.line(xs, y, g[0], y, 'S-EXIST'); v.brk((xs + g[0]) / 2 - 1, y, (xs + g[0]) / 2 + 1, y, 'S-EXIST'); } xs = g[1]; }); }; seg(y1); seg(y2); v.line(x1, y1, x1, y2, 'S-EXIST'); v.line(x2, y1, x2, y2, 'S-EXIST'); v.brk(x1, (y1 + y2) / 2 - 1, x1, (y1 + y2) / 2 + 1, 'S-EXIST'); v.brk(x2, (y1 + y2) / 2 - 1, x2, (y1 + y2) / 2 + 1, 'S-EXIST'); }
  // pile in elevation with S-breaks top and bottom
  function pileV(v, x, D, y1, y2) { v.line(x - D / 2, y1, x - D / 2, y2, 'S-EXIST'); v.line(x + D / 2, y1, x + D / 2, y2, 'S-EXIST'); v.pileEnd(x, y1, D, 'S-EXIST'); v.pileEnd(x, y2, D, 'S-EXIST'); }
  // replaced planks in elevation: n planks of 230 from y = 0 down, between x1..x2 (solid), joints solid
  function planksE(v, x1, x2, n) { v.rect(x1, -230 * n, x2 - x1, 230 * n, 'S-NEW'); for (let i = 1; i < n; i++) v.line(x1, -230 * i, x2, -230 * i, 'S-NEW'); }
  // 150x90x8 UA cleat in elevation (90 leg seen) at face x, inward direction k (−1 = cleat to the left of the face); screws at 100 / 225 crs; side screws into the pile
  function cleatE(v, x, k, n, side) { const y0 = -10, y1 = -230 * n + 10; v.rect(min(x, x + k * 90), y1, 90, y0 - y1, 'S-NEW'); v.rect(min(x, x + k * 8), y1 - 8, 8, y0 - y1 + 16, 'S-NEW'); const ys = []; for (let y = -100; y > -230 * n + 60; y -= 225) ys.push(y); ys.forEach(y => { v.circ(x + k * 55, y, 7, 'S-BOLT'); if (side !== false) cscrew(v, x + k * 4, y, x - k * 70, y, 12); }); return ys; }
  // rotten area of sheeting (hatched blob) centred at (x,y)
  function rot(v, x, y, w, h) { const pts = []; for (let i = 0; i < 24; i++) { const a = 2 * PI * i / 24, r = 1 + 0.12 * Math.sin(3 * a + 1) + 0.08 * Math.cos(2 * a); pts.push([x + w / 2 * r * Math.cos(a) * (Math.cos(a) > 0 ? 1 : 1.05), y + h / 2 * r * Math.sin(a) * (Math.sin(a) > 0 ? 0.85 : 1.1)]); } v.pl(pts, true, 'S-EXIST'); v.hatch(pts, 'ansi31', 'S-HATCH', 0.8); }
  // UC steel pile in plan: flanges parallel to the sheeting, web along b; web face (span side) at local a = 0, outer flange face at b = -5
  function ucPlan(v, f, s) { const tw = s.tw, bf = s.b, d = s.d, tf = s.tf, ac = tw / 2; const Q = [[ac - bf / 2, -5], [ac + bf / 2, -5], [ac + bf / 2, -5 - tf], [ac + tw / 2, -5 - tf], [ac + tw / 2, -5 - d + tf], [ac + bf / 2, -5 - d + tf], [ac + bf / 2, -5 - d], [ac - bf / 2, -5 - d], [ac - bf / 2, -5 - d + tf], [ac - tw / 2, -5 - d + tf], [ac - tw / 2, -5 - tf], [ac - bf / 2, -5 - tf]]; v.pl(Q.map(q => f(q[0], q[1])), true, 'S-EXIST'); return { tip: ac - bf / 2 }; }
  // 150x90x8 UA cleat welded to the UC web (plan) + coach screw into the plank
  function cleatS(v, f) { v.pl([f(-90, -75), f(0, -75), f(0, -160), f(-8, -160), f(-8, -83), f(-90, -83)], true, 'S-NEW'); const s1 = f(-55, -87), s2 = f(-55, -10); cscrew(v, ...s1, ...s2); }
  // earth tufts along an arbitrary line p0→p1 (model points), on the left-hand side of the direction
  function earthLine(v, p0, p1) { const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), ux = (p1[0] - p0[0]) / L, uy = (p1[1] - p0[1]) / L, nx = -uy, ny = ux, st = 1.1 * v.s, h = 1.5 * v.s; let k = 0; for (let t = 0; t + st <= L; t += st, k++) { const x = p0[0] + ux * t, y = p0[1] + uy * t; if (k % 4 === 3) v.line(x, y, x + ux * st + nx * h, y + uy * st + ny * h, 'S-GROUND'); else v.line(x + ux * st, y + uy * st, x + nx * h, y + ny * h, 'S-GROUND'); } }
  // boxed label (paper point, centred)
  function boxT(v, px, py, s) { const w = s.length * 2.4 * 0.7 + 3; v.add({ t: 'pl', p: [[px - w / 2, py - 2.4], [px + w / 2, py - 2.4], [px + w / 2, py + 2.4], [px - w / 2, py + 2.4]], closed: true, L: 'S-TEXT' }); }
  const SHT_NOTE = '150x90x8 UA, φ12 x 75\nLONG COACH SCREWS\nWITH WASHERS (TYP)';

  def('pn2202', 'Sheeting', 'Abutment / wingwall sheeting repair – Type 1 (timber planks)', 'PN30-2202', [P('D', 'Pile dia. (mm)', 320, { num: 1 }), P('S', 'Clear span between trimmed piles (mm)', 1100, { num: 1 }), P('n', 'Planks replaced', 3, { num: 1 })], (p) => {
    const LY = new Lay(560), D = +p.D || 320, S = +p.S || 1100, n = max(1, min(6, Math.round(+p.n || 3)));
    // ---- PLAN 1:10
    const v = LY.view(10), XL = 0, XR = S, fR = fr([XR, 0], [1, 0], [0, 1]), fL = fr([XL, 0], [-1, 0], [0, 1]);
    const cL = XL - (D / 2 - 40); sheetPlan(v, cL - 260, XR + D + 300, [S * 0.45]); v.brk(XR + D + 300, 75, XR + D + 300, -10); v.line(cL - 260, 0, cL - 260, 75, 'S-EXIST');
    trimPile(v, fR, D); trimPile(v, fL, D); plankP(v, fR, -S); cleatT(v, fR); cleatT(v, fL);
    cleatDims(v, fR, 1, D);
    // wingwall at 45° from the corner above the left pile
    const u = [-Math.SQRT1_2, Math.SQRT1_2], nn = [Math.SQRT1_2, Math.SQRT1_2], Q0 = [cL + 40, 0], Wf = fr(Q0, u, nn);
    const wl = (a1, a2, b, L) => { const p1 = Wf(a1, b), p2 = Wf(a2, b); v.line(...p1, ...p2, L); };
    wl(0, 470, 75, 'S-EXIST'); wl(560, 1250, 75, 'S-EXIST'); wl(40, 470, 0, 'S-NEW'); wl(560, 1250, 0, 'S-NEW'); wl(40, 470, -75, 'S-NEW'); wl(560, 1250, -75, 'S-NEW');
    [[470, 1], [560, 1]].forEach(q => { const a = Wf(q[0], 90), b = Wf(q[0], -95); v.brk(...a, ...b, 'S-TEXT'); });
    for (let a = 120; a < 1200; a += 330) { if (a > 380 && a < 600) continue; const p0 = Wf(a, 75), p1 = Wf(a + 230, 75); earthLine(v, p0, p1); }
    const cW = Wf(1000, -75 - D / 2 - 5); v.circ(cW[0], cW[1], D / 2, 'S-EXIST');
    // corner cleats (on the wingwall pile and on the left pile, wingwall side)
    const fw = fr(Wf(1000 - 120, -75), [-u[0], -u[1]], nn); v.pl([fw(-90, 0), fw(0, 0), fw(0, -150), fw(-8, -150), fw(-8, -8), fw(-90, -8)], true, 'S-NEW'); cscrew(v, ...fw(-55, -12), ...fw(-55, 63)); cscrew(v, ...fw(-14, -90), ...fw(70, -90));
    const fc = fr(Wf(130, -75), u, nn); v.pl([fc(-90, 0), fc(0, 0), fc(0, -150), fc(-8, -150), fc(-8, -8), fc(-90, -8)], true, 'S-NEW'); cscrew(v, ...fc(-55, -12), ...fc(-55, 63)); cscrew(v, ...fc(-14, -90), ...fc(70, -90));
    const lw = v.P(...Wf(900, 260)); v.ptext(lw[0], lw[1], 'WINGWALL', 2.4, 'c', 'm'); boxT(v, lw[0], lw[1], 'WINGWALL');
    v.ptext(...v.P(S * 0.6, 460), 'ABUTMENT', 2.4, 'c', 'm'); boxT(v, ...v.P(S * 0.6, 460), 'ABUTMENT');
    let q = Wf(700, 75); v.leader(q[0], q[1], 14, 10, 'EXISTING WINGWALL\nTIMBER SHEETING'); v.leader(S * 0.3, 75, 12, 16, 'EXISTING ABUTMENT\nTIMBER SHEETING');
    v.leader(cL - 260, 0, -10, -16, 'TRIM ABUTMENT TIMBER\nSHEETING TO SUIT TIMBER\nPLANK REPAIRS'); v.leader(S * 0.25, -75, -14, -42, '230x75 THICK TIMBER\nPLANK (TYP)');
    q = fR(-70, -83); v.leader(q[0], q[1], -16, -14, SHT_NOTE); q = fR(D / 2 - 40, -D / 2 - 60); v.leader(q[0], q[1], 14, -14, 'EXISTING TIMBER\nPILE (TYP)', { dot: true });
        LY.title('PLAN', null);
    LY.break();
    // ---- ELEVATION 1:10 (looking at the sheeting from the creek)
    const w = LY.view(10), cl = cL, cr = XR + (D / 2 - 40), yT = 460, yB = -230 * n - 300;
    sheetElev(w, cl - D / 2 - 360, cr + D / 2 + 120, yB, yT, [[cl - D / 2, cl + D / 2], [cr - D / 2, cr + D / 2]]);
    pileV(w, cl, D, yB - 280, yT + 200); pileV(w, cr, D, yB - 280, yT + 200);
    w.rect(XL - 25, -230 * n - 20, S + 50, 230 * n + 40, 'S-HIDDEN'); planksE(w, XL - 8, XR + 8, n);
    rot(w, S * 0.48, -230 * n * 0.62, S * 0.42, 230 * n * 0.33);
    cleatE(w, XL, 1, n); cleatE(w, XR, -1, n);
    // wingwall sheeting beyond the left pile (seen obliquely) with its hidden cleat
    const xw = cl - D / 2; for (let y = 230; y > -230 * n - 1; y -= 230) w.line(xw - 230, y, xw, y, 'S-NEW'); w.line(xw - 230, 230, xw - 230, -230 * n, 'S-NEW');
    w.rect(xw + 30, -230 * n - 10, 75, 230 * n + 245, 'S-HIDDEN'); w.rect(xw + 30 - 20, -230 * n - 10, 130, 230 * n + 245, 'S-HIDDEN');
    for (let y = 120; y > -230 * n; y -= 230) { w.rect(xw + 45, y - 7, 12, 14, 'S-BOLT'); w.pl([[xw + 57, y + 6], [xw + 80, y + 6], [xw + 90, y], [xw + 80, y - 6], [xw + 57, y - 6]], false, 'S-BOLT'); }
    w.dim(S * 0.25, 0, S * 0.25, -100, 0.1, '100', { sub: 'TYP' }); w.dim(S * 0.25, -100, S * 0.25, -325, 0.1, '225', { sub: 'TYP' });
    w.leader(S * 0.25, 0, 18, 46, '230x75 THICK TIMBER\nPLANK (TYP)'); w.leader(S * 0.2, -230 * n - 115, 0, -30, 'EXISTING\nTIMBER\nSHEETING'.replace(/\n/g, ' ')); w.leader(S * 0.5, -230 * n * 0.62 - 230 * n * 0.18, 8, -38, 'ROTTEN AREA\nOF EXISTING\nSHEETING\nTYP');
    LY.title('ELEVATION', null);
    drgBox(LY);
    LY.caption('ABUTMENT/ WINGWALL SHEETING REPAIR DETAIL - TYPE 1', 10, 'ABUTMENT N° X - BETWEEN PILE N° X & N° X', { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Replace rotten timber sheeting between timber piles with 230x75 planks held by 150x90x8 UA cleats coach-screwed to the trimmed piles.');

  // UC steel pile in plan, flanges parallel to the sheeting, outer face of the front... (local frame f: a = 0 at the span-side flange tips, UC on +a, top flange outer face at b = bt)
  function ucP(v, f, s, bt, stiff) { const bf = s.b, d = s.d, tf = s.tf, tw = s.tw, m = bf / 2; const Q = [[0, bt], [bf, bt], [bf, bt - tf], [m + tw / 2, bt - tf], [m + tw / 2, bt - d + tf], [bf, bt - d + tf], [bf, bt - d], [0, bt - d], [0, bt - d + tf], [m - tw / 2, bt - d + tf], [m - tw / 2, bt - tf], [0, bt - tf]]; v.pl(Q.map(q => f(q[0], q[1])), true, 'S-EXIST');
    if (stiff) [[0, 10], [bf - 10, bf]].forEach(r => v.pl([f(r[0], bt - tf), f(r[1], bt - tf), f(r[1], bt - d + tf), f(r[0], bt - d + tf)], true, 'S-NEW')); }
  // M12 chemical anchor (heavy short rod) from (x1,y1) (nut end) to (x2,y2)
  function anchor(v, x1, y1, x2, y2) { const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L * 6, ny = (x2 - x1) / L * 6; v.fill([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], 'S-BOLT'); }

  def('pn2202a', 'Sheeting', 'Abutment sheeting repair – Type 2 (at steel piles / concrete pile repairs)', 'PN30-2202A', [P('uc', 'Existing steel pile', '200UC52', { opts: UCs }), P('D', 'Timber pile dia. (mm)', 320, { num: 1 }), P('S', 'Clear span (mm)', 1000, { num: 1 }), P('n', 'Planks replaced', 3, { num: 1 })], (p) => {
    const LY = new Lay(600), s = SEC[p.uc] || SEC['200UC52'], D = +p.D || 320, S = +p.S || 1000, n = max(1, min(6, Math.round(+p.n || 3))), bf = s.b, d = s.d, bt = -85;
    // ---- PLAN (left: steel pile at the wingwall corner, right: timber pile)
    const v = LY.view(10), fL = fr([0, 0], [-1, 0], [0, 1]), XR = S, fR = fr([XR, 0], [1, 0], [0, 1]);
    sheetPlan(v, -bf - 40, XR + D + 250, [S * 0.4]); v.brk(XR + D + 250, 75, XR + D + 250, -10);
    ucP(v, fL, s, bt, true); plankP(v, fR, -S); trimPile(v, fR, D); cleatT(v, fR); cleatDims(v, fR, 1, D);
    v.pl([[0, 0], [0, bt - d + 15], [8, bt - d + 15], [8, -83], [90, -83], [90, -75], [8, -75], [8, 0]], true, 'S-NEW'); cscrew(v, 55, -87, 55, -10);
    v.pl([[-bf + 10, bt + 2], [-bf + 10 + 65, bt + 2], [-bf + 10 + 65, bt + 12], [-bf + 20, bt + 12], [-bf + 20, bt + 70], [-bf + 10, bt + 70]], true, 'S-NEW');
    // wingwall at 45° from the corner over the steel pile
    const u = [-Math.SQRT1_2, Math.SQRT1_2], nn = [Math.SQRT1_2, Math.SQRT1_2], C = [-bf + 30, 0], Wf = fr(C, u, nn), wl = (a1, a2, b, L) => { const p1 = Wf(a1, b), p2 = Wf(a2, b); v.line(p1[0], p1[1], p2[0], p2[1], L); };
    wl(0, 520, 75, 'S-EXIST'); wl(20, 520, 0, 'S-NEW'); wl(110, 520, -75, 'S-NEW'); const b1 = Wf(520, 90), b2 = Wf(520, -90); v.brk(b1[0], b1[1], b2[0], b2[1], 'S-TEXT'); earthLine(v, Wf(140, 75), Wf(420, 75));
    const fw = fr(Wf(110, -75), [-u[0], -u[1]], nn); v.pl([fw(-150, 0), fw(0, 0), fw(0, -90), fw(-8, -90), fw(-8, -8), fw(-150, -8)], true, 'S-NEW'); cscrew(v, ...fw(-60, -12), ...fw(-60, 63));
    v.line(-bf + 30, 0, -bf - 40, 0, 'S-EXIST');
    dimx(v, -bf, 230, -bf + 50, 230, 0.1, '50', -4, 1.2); [[-bf, 240], [-bf + 50, 240]].forEach(q => v.line(q[0], q[1], q[0], q[0] === -bf ? bt - d : -30, 'S-DIM'));
    const pW = v.P(...Wf(330, -330)); v.ptext(pW[0] - 8, pW[1], 'WINGWALL', 2.4, 'c', 'm'); boxT(v, pW[0] - 8, pW[1], 'WINGWALL'); const pA = v.P(S * 0.55, 420); v.ptext(pA[0], pA[1], 'ABUTMENT', 2.4, 'c', 'm'); boxT(v, pA[0], pA[1], 'ABUTMENT');
    let q = Wf(420, 75); v.leader(q[0], q[1], 14, 16, 'EXISTING WINGWALL\nTIMBER SHEETING'); v.leaders([[-bf + 30, 5], [-bf - 20, -2]], 18, 44, 'TRIM EXISTING TIMBER PACKER,\nABUTMENT & WINGWALL TIMBER\nSHEETING TO SUIT');
    v.weld(-bf + 5, bt - 15, -22, 6, { size: '6', len: '75-225', site: true }); v.weld(-bf + 10, bt - d + 80, -30, -4, { size: '6', site: true, tail: 'TYP' });
    v.weld(0, bt - 30, 20, -6, { size: '6', site: true, tail: 'T&B' }); v.weld(8, bt - d + 60, 20, -14, { size: '6', site: true }); v.weld(0, bt - d, 22, -24, { site: true, tail: 'TYP' });
    v.leader(-bf, bt - d + 40, -20, -16, '10FL STIFFENERS AT 500 CRS\nMAX (MIN 2 PER 150x90x8 UA)'); v.leader(-bf / 2, bt - d, -12, -38, 'EXISTING STEEL PILE\nTYP'); v.leader(-bf + 40, bt + 6, 2, -60, '75x75x10EA CLEATS\nAT 200 CRS MAX');
    v.leader(S * 0.25, -75, 6, -40, '230x75 THICK\nTIMBER PLANK\n(TYP)'); q = fR(-70, -83); v.leader(q[0], q[1], 2, 62, SHT_NOTE); q = fR(-14, -160); v.leader(q[0], q[1], -30, -55, '150x90x8 UA,\nφ12 x 75 LONG\nCOACH SCREWS\nWITH WASHERS\nTYP');
    q = fR(D / 2 - 40, -D / 2 - 60); v.leader(q[0], q[1], 12, -10, 'EXISTING TIMBER\nPILE (TYP)', { dot: true }); v.leader(XR + D, 0, 10, -10, 'EXISTING ABUTMENT\nTIMBER SHEETING');
    LY.title('PLAN', null);
    // ---- PLAN at a steel pile in an existing concrete pile repair
    const w = LY.view(10), cx0 = -420, cx1 = 420, fS = fr([0, 0], [-1, 0], [0, 1]);
    sheetPlan(w, cx0 - 120, cx1 + 380, [cx1 + 40]); w.brk(cx0 - 120, 75, cx0 - 120, -10); w.brk(cx1 + 380, 75, cx1 + 380, -10);
    w.pl([[cx0, 0], [cx0, -560], [cx1, -560], [cx1, 0]], false, 'S-EXIST'); ucP(w, fS, s, bt, false);
    w.rect(-bf - 40, -75, bf + 40, 75, 'S-EXIST'); plankP(w, fr([cx1 + 380, 0], [1, 0], [0, 1]), -(cx1 + 380), true);
    w.pl([[0, 0], [0, bt - d], [8, bt - d], [8, -83], [90, -83], [90, -75], [8, -75], [8, 0]], true, 'S-NEW'); cscrew(w, 55, -87, 55, -10);
    w.pl([[cx1, -75], [cx1 + 90, -75], [cx1 + 90, -83], [cx1 + 8, -83], [cx1 + 8, -110], [cx1, -110]], true, 'S-NEW'); cscrew(w, cx1 + 55, -87, cx1 + 55, -10); anchor(w, cx1 + 20, -100, cx1 - 105, -100);
    dimx(w, cx1 + 400, -100, cx1 + 400, -75, 0.1, '55', 3, -12, { rot: true }); w.add({ t: 'text', p: [w.P(cx1 + 400, -100)[0] + 3.4, w.P(cx1 + 400, -100)[1] - 12], s: 'TYP', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' }); w.line(cx1 + 30, -100, cx1 + 420, -100, 'S-DIM');
    w.leader(-bf / 2, 75, 12, 18, 'EXISTING ABUTMENT\nTIMBER SHEETING'); w.leader(-30, 0, 30, 18, 'TRIM EXISTING TIMBER\nPACKER TO SUIT'); w.leader(cx0, -150, -14, -6, 'EXISTING ABUTMENT\nTIMBER SHEETING'.split('\n')[0] === '' ? '' : 'EXISTING TIMBER\nPILE (TYP)');
    w.leader(-bf, bt - d, 4, -14, 'EXISTING STEEL\nPILE'); w.leader(150, -75, 30, -30, '230x75 THICK TIMBER\nPLANK (TYP)'); w.leader(0, -400, 4, -20, 'EXISTING CONCRETE\nPILE REPAIR (TYP)', { dot: true });
    LY.title('PLAN', null);
    LY.break();
    // ---- ELEVATIONS
    const e = LY.view(10), yT = 450, yB = -230 * n - 260, xL = -bf - 260, xR = S + D + 160, cr = S + D / 2 - 40;
    sheetElev(e, xL, xR, yB, yT, [[-bf - 60, 60], [cr - D / 2, cr + D / 2]]);
    e.line(-bf, yB - 120, -bf, yT + 140, 'S-EXIST'); e.line(0, yB - 120, 0, yT + 140, 'S-EXIST'); e.line(-bf / 2 - 4, yB - 120, -bf / 2 - 4, yT + 140, 'S-EXIST'); e.line(-bf / 2 + 4, yB - 120, -bf / 2 + 4, yT + 140, 'S-EXIST'); e.brk(-bf - 30, yT + 140, 30, yT + 140); e.brk(-bf - 30, yB - 120, 30, yB - 120);
    pileV(e, cr, D, yB - 280, yT + 200);
    planksE(e, 8, S + 8, n); cleatE(e, 8, 1, n, false); cleatE(e, S, -1, n); rot(e, S * 0.5, -230 * n * 0.62, S * 0.4, 230 * n * 0.3);
    for (let i = 0; i < 3; i++) { const y = -60 - i * 230 * n / 3; e.pl([[-25, y + 40], [-25, y + 50], [-10, y + 50], [-10, y], [-2, y]], false, 'S-NEW'); }
    e.rect(-bf - 18, -230 * n + 30, 10, 230 * n - 60, 'S-NEW'); e.rect(-bf - 250, -230 * n + 30, 232, 230 * n - 60, 'S-EXIST');
    [-60, -230 * n + 70].forEach(y => { e.line(-bf - 8, y, -bf / 2 - 4, y, 'S-HIDDEN'); e.line(-bf - 8, y - 10, -bf / 2 - 4, y - 10, 'S-HIDDEN'); });
    dimx(e, -40, -230 * n - 10, -40, -230 * n + 10, 0.1, '20', -1, -22, { rot: true }); e.add({ t: 'text', p: [e.P(-40, 0)[0] + 2.6, e.P(-40, -230 * n - 10)[1] - 22], s: 'TYP', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' });
    e.dim(S * 0.3, 0, S * 0.3, -100, 0.1, '100', { sub: 'TYP' }); e.dim(S * 0.3, -100, S * 0.3, -325, 0.1, '225', { sub: 'TYP' });
    e.leader(-bf - 18, -150, -20, 8, '150x90x8 UA'); e.leader(-bf - 8, -230 * n + 70, -20, -10, '10FL STIFFENERS\nTYP'); e.leader(-10, -230 * n * 0.45, -36, -14, '75x75x10 EA CLEATS');
    e.leaders([[S * 0.5, 0], [-bf - 150, -230 * n + 30]], 14, 44, '230x75 THICK TIMBER\nPLANK (TYP)'); e.leader(S * 0.25, -230 * n - 115, 4, -26, 'EXISTING\nTIMBER\nSHEETING'); e.leader(S * 0.55, -230 * n * 0.77, 8, -32, 'ROTTEN\nAREA OF\nEXISTING\nSHEETING');
    LY.title('ELEVATION', null);
    // elevation at the concrete pile repair
    const g = LY.view(10), gx0 = -420, gx1 = 420, gT = 450, gB = -230 * n - 300, ys = -230 * (n - 1);
    sheetElev(g, gx0 - 300, gx1 + 380, gB, gT, [[-bf - 60, 60]]); g.line(-bf, gB - 100, -bf, gT + 160, 'S-EXIST'); g.line(0, gB - 100, 0, gT + 160, 'S-EXIST'); g.line(-bf / 2 - 4, gB - 100, -bf / 2 - 4, gT + 160, 'S-EXIST'); g.line(-bf / 2 + 4, gB - 100, -bf / 2 + 4, gT + 160, 'S-EXIST'); g.brk(-bf - 30, gT + 160, 30, gT + 160);
    g.pl([[gx0, ys + 60], [gx0, gB - 60], [gx1, gB - 60], [gx1, ys - 40], [10, ys - 40], [10, ys + 60]], false, 'S-EXIST'); g.line(-bf, ys + 60, gx0, ys + 60, 'S-EXIST'); g.brk(-40, gB - 60, 40, gB - 60);
    g.rect(10, ys + 20, gx1 + 360, 230 * (n - 1) - 20 + 10, 'S-NEW'); for (let i = 1; i < n - 1; i++) g.line(10, -230 * i, gx1 + 370, -230 * i, 'S-NEW'); g.rect(10, ys - 30, 80, 230 * (n - 1) - 0, 'S-NEW'); [ys + 100, ys + 200].forEach(y => g.circ(55, y, 7, 'S-BOLT'));
    g.rect(gx1, ys - 40 - 230, gx1 * 0 + 370, 230, 'S-NEW'); g.rect(gx1 + 4, ys - 40 - 250, 80, 240, 'S-NEW'); [ys - 90, ys - 225].forEach(y => { g.circ(gx1 + 50, y, 7, 'S-BOLT'); anchor(g, gx1 + 10, y, gx1 - 115, y); });
    g.line(gx1, ys - 40 - 230, gx1, gB + 40, 'S-EXIST'); rot(g, gx1 + 290, ys - 70, 220, 260);
    dimx(g, gx1 - 160, ys - 90, gx1 - 160, ys - 40, 0.1, '100 MIN', -0.4, -26, { rot: true }); g.add({ t: 'text', p: [g.P(gx1 - 160, 0)[0] + 2.6, g.P(0, ys - 90)[1] - 26], s: 'TYP', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' });
    g.leader(10, ys - 40, -18, -16, '65 x 10FL\nCLEAT'); g.leader(gx1 + 120, ys - 40, 6, 36, 'TRIM 230x75 THICK TIMBER\nPLANK TO CLEAR EXISTING\nCONCRETE PILE REPAIR'); g.leader(gx1 - 60, ys - 225, 8, -40, 'M12 CHEMICAL ANCHOR\nIN φ14 x 125 DEEP HOLE\nAT 225 CRS MAX (TYP)'); g.leader(-150, gB, -10, -14, 'EXISTING CONCRETE\nPILE REPAIR (TYP)', { dot: true });
    LY.title('ELEVATION', null);
    drgBox(LY);
    LY.caption('ABUTMENT SHEETING REPAIR DETAIL - TYPE 2', 10, 'ABUTMENT N° X - BETWEEN PILE N° X & N° X', { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Plank replacement where the sheeting spans to existing steel piles or concrete pile repairs: cleats welded to the UC piles, chemical anchors into the concrete.');

  def('pn2202b', 'Sheeting', 'Abutment / wingwall sheeting repair – Type 3 (timber & steel piles)', 'PN30-2202B', [P('uc', 'Existing steel piles', '200UC52', { opts: UCs }), P('D', 'Timber pile dia. (mm)', 320, { num: 1 }), P('n', 'Planks replaced', 3, { num: 1 })], (p) => {
    const LY = new Lay(640), s = SEC[p.uc] || SEC['200UC52'], D = +p.D || 320, n = max(1, min(6, Math.round(+p.n || 3))), bf = s.b, d = s.d, tw = s.tw;
    // ---- PLAN at a timber pile (planks both sides)
    const v = LY.view(10), XL = -(D / 2 - 40), XR = D / 2 - 40, fL = fr([XL, 0], [1, 0], [0, 1]), fR = fr([XR, 0], [-1, 0], [0, 1]), L0 = -650, L1 = 900;
    sheetPlan(v, L0 - 60, L1 + 60, [L0 + 60, 120]); v.brk(L0 - 60, 75, L0 - 60, -10); v.brk(L1 + 60, 75, L1 + 60, -10);
    trimPile(v, fL, D); trimPile(v, fR, D); plankP(v, fL, -(XL - L0), true); plankP(v, fR, -(L1 - XR), true); cleatT(v, fL); cleatT(v, fR); cleatDims(v, fL, 1, D);
    let q = fL(-70, -83); v.leader(q[0], q[1], -16, -12, SHT_NOTE); q = fR(D / 2 - 40, -D / 2 - 60); v.leader(q[0], q[1], 14, -12, 'EXISTING TIMBER\nPILE (TYP)', { dot: true });
    v.leader(L1 - 120, 75, 10, 16, 'EXISTING WINGWALL\nTIMBER SHEETING'); v.leader(L1 - 200, -75, 12, -12, '230x75 THICK TIMBER\nPLANK (TYP)');
    LY.title('PLAN', null);
    // ---- PLAN at a timber pile between two steel piles in a concrete pile repair
    const w = LY.view(10), g = D / 2 + 10, u1 = -g, u2 = g, cx0 = u1 - bf / 2 - 120, cx1 = u2 + bf / 2 + 120, M0 = cx0 - 500, M1 = cx1 + 450, bt = -5;
    sheetPlan(w, M0 - 60, M1 + 60, [M0 + 40, M1 - 260]); w.brk(M0 - 60, 75, M0 - 60, -10); w.brk(M1 + 60, 75, M1 + 60, -10); w.line(0, 0, 0, 75, 'S-EXIST');
    w.pl([[cx0, 0], [cx0, -D - 240], [cx1, -D - 240], [cx1, 0]], false, 'S-EXIST'); pileC(w, 0, -D / 2 - 30, D);
    ucP(w, fr([u1 - bf / 2, 0], [1, 0], [0, 1]), s, bt, false); ucP(w, fr([u2 - bf / 2, 0], [1, 0], [0, 1]), s, bt, false);
    plankP(w, fr([u1 - bf / 2 - 5, 0], [1, 0], [0, 1]), -(u1 - bf / 2 - 5 - M0), true); plankP(w, fr([M1, 0], [1, 0], [0, 1]), -(M1 - u2 - bf / 2 - 5), true);
    const wl1 = u1 - tw / 2, wr2 = u2 + tw / 2;
    w.pl([[wl1, -75], [wl1 - 90, -75], [wl1 - 90, -83], [wl1 - 8, -83], [wl1 - 8, -150], [wl1, -150]], true, 'S-NEW'); cscrew(w, wl1 - 55, -87, wl1 - 55, -10);
    w.pl([[wr2, -75], [wr2 + 90, -75], [wr2 + 90, -83], [wr2 + 8, -83], [wr2 + 8, -150], [wr2, -150]], true, 'S-NEW'); cscrew(w, wr2 + 55, -87, wr2 + 55, -10);
    [[wl1, -1], [wr2, 1]].forEach(([x, k]) => w.pl([[x + k * 0, -10], [x + k * 0, -18], [x - k * 40, -18], [x - k * 40, -40], [x - k * 48, -40], [x - k * 48, -10]], true, 'S-NEW'));
    w.pl([[cx1, -75], [cx1 + 90, -75], [cx1 + 90, -83], [cx1 + 8, -83], [cx1 + 8, -120], [cx1, -120]], true, 'S-NEW'); cscrew(w, cx1 + 55, -87, cx1 + 55, -10); anchor(w, cx1 + 20, -110, cx1 - 105, -110);
    w.line(cx1 + 30, -110, cx1 + 420, -110, 'S-DIM'); dimx(w, cx1 + 400, -110, cx1 + 400, -75, 0.1, '55', -0.4, -12, { rot: true }); w.add({ t: 'text', p: [w.P(cx1 + 400, 0)[0] + 3, w.P(0, -110)[1] - 12], s: 'TYP', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' });
    w.weld(wl1, -120, -20, -12, { size: '6', site: true, tail: 'T&B' }); w.weld(wl1, -145, -26, -26, { size: '6', len: '75-225', site: true, tail: 'TYP' });
    w.leader(wl1 - 70, -83, 6, 30, SHT_NOTE); w.leader(M0 + 200, -75, -10, -14, '230x75 THICK TIMBER\nPLANK (TYP)');
    LY.title('PLAN', null);
    LY.break();
    // ---- ELEVATION at the timber pile
    const e = LY.view(10), yT = 460, yB = -230 * n - 300;
    sheetElev(e, L0 - 60, L1 + 60, yB, yT, [[-D / 2, D / 2]]); pileV(e, 0, D, yB - 280, yT + 200);
    planksE(e, L0, XL, n); planksE(e, XR, L1, n); e.line(L0, 0, L0, -230 * n, 'S-NEW'); cleatE(e, XL, -1, n); cleatE(e, XR, 1, n); rot(e, XR + 420, -230 * n * 0.6, 420, 230 * n * 0.3);
    e.dim(XR + 160, 0, XR + 160, -100, 0.1, '100', { sub: 'TYP' }); e.dim(XR + 160, -100, XR + 160, -325, 0.1, '225', { sub: 'TYP' });
    e.leader(XR + 600, 0, 12, 40, '230x75 THICK TIMBER\nPLANK (TYP)'); e.leader(L0 + 300, -230 * n - 115, -6, -26, 'EXISTING\nTIMBER\nSHEETING'); e.leader(XR + 450, -230 * n * 0.75, 6, -36, 'ROTTEN AREA\nOF EXISTING\nSHEETING\nTYP');
    LY.title('ELEVATION', null);
    // ---- ELEVATION at the steel piles / concrete pile repair
    const h = LY.view(10), hT = 460, hB = -230 * n - 420, ys = -230 * (n - 1), cB = hB + 20;
    sheetElev(h, M0 - 60, M1 + 60, hB, hT, [[u1 - bf / 2 - 30, u2 + bf / 2 + 30]]);
    [u1, u2].forEach(x => { h.line(x - bf / 2, ys - 40, x - bf / 2, hT + 140, 'S-EXIST'); h.line(x + bf / 2, ys - 40, x + bf / 2, hT + 140, 'S-EXIST'); h.line(x, ys - 40, x, hT + 140, 'S-HIDDEN'); });
    h.line(-D / 2, ys - 40, -D / 2, hT + 280, 'S-EXIST'); h.line(D / 2, ys - 40, D / 2, hT + 280, 'S-EXIST'); h.pileEnd(0, hT + 280, D, 'S-EXIST'); h.brk(u1 - bf / 2 - 30, hT + 140, u1 + bf / 2 + 10, hT + 140); h.brk(u2 - bf / 2 - 10, hT + 140, u2 + bf / 2 + 30, hT + 140);
    h.pl([[cx0, ys - 40], [cx0, cB], [cx1, cB], [cx1, ys - 40], [cx0, ys - 40]], false, 'S-EXIST'); h.brk(-40, cB, 40, cB);
    planksE(h, M0, u1 - bf / 2 - 5, n); h.line(M0, 0, M0, -230 * n, 'S-NEW'); cleatE(h, u1 - bf / 2 - 5, -1, n, false); rot(h, M0 + 250, -230 * n * 0.45, 500, 230 * n * 0.38);
    h.rect(u2 + bf / 2 + 5, ys, M1 - u2 - bf / 2 - 5, 230 * (n - 1), 'S-NEW'); for (let i = 1; i < n - 1; i++) h.line(u2 + bf / 2 + 5, -230 * i, M1, -230 * i, 'S-NEW'); h.rect(u2 + bf / 2 + 5, ys + 10, 80, 230 * (n - 1) - 20, 'S-NEW'); h.circ(u2 + bf / 2 + 50, ys + 115, 7, 'S-BOLT');
    h.rect(cx1, ys - 40 - 230, M1 - cx1, 230, 'S-NEW'); h.rect(cx1 + 4, ys - 40 - 245, 80, 245, 'S-NEW'); [ys - 90, ys - 225].forEach(y => { h.circ(cx1 + 50, y, 7, 'S-BOLT'); anchor(h, cx1 + 10, y, cx1 - 115, y); }); rot(h, M1 - 150, ys - 140, 300, 240);
    dimx(h, cx1 - 160, ys - 90, cx1 - 160, ys - 40, 0.1, '100 MIN', -0.4, -26, { rot: true }); h.add({ t: 'text', p: [h.P(cx1 - 160, 0)[0] + 2.6, h.P(0, ys - 90)[1] - 26], s: 'TYP', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' });
    h.dim(M0 + 120, 0, M0 + 120, -100, 0.1, '100', { sub: 'TYP' }); h.dim(M0 + 120, -100, M0 + 120, -325, 0.1, '225', { sub: 'TYP' });
    h.leader(M0 + 80, 0, -10, 30, '230x75 THICK TIMBER\nPLANK (TYP)'); h.leader(cx1 + 160, ys - 40, 8, 36, 'TRIM 230x75 THICK TIMBER\nPLANK TO CLEAR EXISTING\nCONCRETE PILE REPAIR'); h.leader(cx1 - 60, ys - 225, -6, -52, 'M12 CHEMICAL ANCHOR\nIN φ14 x 125 DEEP HOLE\nAT 225 CRS MAX (TYP)'); h.leader(M1 - 100, hB + 115, 8, -40, 'EXISTING\nTIMBER\nSHEETING');
    LY.title('ELEVATION', null);
    drgBox(LY);
    LY.caption('ABUTMENT/WINGWALL SHEETING REPAIR DETAIL (TIMBER & STEEL PILES) - TYPE 3', 10, 'ABUTMENT N° X - BETWEEN PILE N° X & N° X', { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Plank replacement on a sheeting run with both timber piles and steel piles (concrete pile repairs): coach-screwed cleats on timber, welded cleats on steel, chemical anchors into concrete.');

  // ================================================================== PN30-2203 scour repair
  def('scr', 'Sheeting', 'Abutment / wingwall scour repair', 'PN30-2203', [P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('L', 'Depth U1 to scour line (mm)', 900, { num: 1 })], (p) => {
    const LY = new Lay(600), D = +p.D || 380, L = max(400, +p.L || 900);
    // ---- SECTION A 1:10 — x = 0 front face of sheeting, y = 0 top of reinstated fill
    const v = LY.view(10), yU = -150, yb = yU - L, sb = yU - L * 0.58;
    v.line(0, yb - 250, 0, 330, 'S-EXIST'); v.line(D, yb - 250, D, 330, 'S-EXIST'); v.line(D / 2, yb - 280, D / 2, 360, 'S-CL'); v.pileEnd(D / 2, 330, D, 'S-EXIST'); v.pileEnd(D / 2, yb - 250, D, 'S-EXIST');
    v.line(-75, sb, -75, 280, 'S-EXIST'); for (let y = sb; y < 260; y += 195) v.line(-75, y, 0, y, 'S-EXIST'); v.line(-75, sb, 0, sb, 'S-EXIST'); v.brk(-110, 270, 30, 270);
    earthV(v, -75, sb + 260, yU - 20, -1);
    // reinstated fill (stippled) between the surface and the scour line
    const fillP = [[D, 0], [D + 230, 0], [D + 900, 5], [D + 1000, 0], [D + 700, -330], [D + 500, -650], [D + 260, yb + 30], [D, yb]];
    v.pl([[0, 0], [D + 230, 0], [D + 900, 5], [D + 1150, 8]], false, 'S-GROUND'); v.hatch([[0, 0], ...fillP.slice(1), [D, yU], [0, yU]], 'gravel', 'S-HATCH', 0.6); earth(v, D / 2, D + 30, 0, -1);
    v.pl([[D + 1000, 0], [D + 700, -330], [D + 500, -650], [D + 260, yb + 30], [D + 160, yb - 20]], false, 'S-HIDDEN');
    // new concrete: wall between the piles below U1, flowing under the sheeting into the scour hole
    const cp = [[0, yU], [D, yU], [D, yb], [-150, yb], [-230, yb + 60], [-250, yb + 200], [-200, sb - 30], [-75, sb], [0, sb]]; concBox(v, cp);
    v.pl([[-250, yb + 80], [-260, yb + 30], [-180, yb + 3], [0, yb]], false, 'S-GROUND');
    fab(v, D / 2 + 15, yb + 75, D / 2 + 15, yU - 75, 100, 1); for (let y = yU - 90; y > yb + 100; y -= 200) spikeE(v, D / 2, y);
    fin(v, D / 2 + 100, yU, 'U1', 90); fin(v, D, (yU + yb) / 2 + 60, '4', 0);
    v.dim(D + 230, yU, D + 230, 0, -1, '150'); v.line(D + 10, yU, D + 240, yU, 'S-DIM'); v.dim(D + 230, yb, D + 230, yU, -1, 'TO SUIT'); v.line(D + 10, yb, D + 260, yb, 'S-DIM');
    v.dim(D + 120, yb, D + 120, yb + 75, -1, '75'); v.line(D / 2 + 30, yb + 75, D + 130, yb + 75, 'S-DIM');
    v.dim(-320, yU - 290, -320, yU - 490, -4, '200', { sub: 'TYP' }); v.line(-330, yU - 290, D / 2 - 30, yU - 290, 'S-DIM'); v.line(-330, yU - 490, D / 2 - 30, yU - 490, 'S-DIM');
    v.leader(-75, 150, -8, 6, 'EXISTING\nSHEETING'); v.leader(D / 2, yU - 90, -40, 12, 'SPIKE (TYP)'); v.leader(D / 2 + 15, yb + 75, 26, -12, 'SL81 FABRIC'); v.leader(-180, yb + 3, -12, -8, 'SCOUR LINE');
    v.leader(D + 550, -600, 14, -8, 'SCOUR LINE'); v.leader(D + 600, -220, -2, 30, 'REINSTATE SCOUR HOLE\nWITH COMPACTED\nSELECTED FILL.', { dot: true });
    LY.title('SECTION A', 10);
    LY.break();
    // ---- PLAN 1:10 — y = 0 front face of sheeting
    const w = LY.view(10), s = SEC['200UC52'], xs = 0, c1 = xs + s.b / 2 + D / 2 + 10, c2 = c1 + D + 520, xe = c2 + D / 2 + 340, x0 = xs - 380;
    w.line(x0, 75, xe, 75, 'S-EXIST'); w.line(x0, 0, xe, 0, 'S-CONC'); w.brk(x0, 75, x0, -10); w.brk(xe, 75, xe, -10); w.brk(x0, -D / 2 + 20, x0, -D / 2 - 20); w.brk(xe, -D / 2 + 20, xe, -D / 2 - 20);
    w.pl([[x0, 140], [x0 + 220, 145], [x0 + 520, 205], [c1 + 220, 225], [c2 - 200, 225], [c2 + 60, 225], [c2 + 400, 160], [xe, 140]], false, 'S-HIDDEN'); earth(w, (c1 + c2) / 2 - 20, (c1 + c2) / 2 + 220, 225, 1);
    // existing steel pile (UC, web normal to the sheeting) and timber piles
    w.rect(xs - s.b / 2, -6, s.b, 10, 'S-EXIST'); w.rect(xs - s.b / 2, -D - 4, s.b, 10, 'S-EXIST'); w.line(xs - 4, -6, xs - 4, -D + 6, 'S-EXIST'); w.line(xs + 4, -6, xs + 4, -D + 6, 'S-EXIST');
    pileC(w, c1, -D / 2, D); pileC(w, c2, -D / 2, D);
    const segs = [[x0, xs - 6, true], [c1 + D / 2, c2 - D / 2, false], [c2 + D / 2, xe, false]];
    concBox(w, [[x0, 0], [xs - 6, 0], [xs - 6, -D], [x0, -D]]); const R = D / 2, t0 = Math.acos(100 / R) * 180 / PI, yc = -R;
    concBox(w, [...arcP(c1, yc, R, -t0, 90), ...arcP(c2, yc, R, 90, 180 + t0), [c2 - 100, -D], [c1 + 100, -D]]); concBox(w, [...arcP(c2, yc, R, -t0, 90), [xe, 0], [xe, -D], [c2 + 100, -D]]);
    w.line(x0, -D, xs - s.b / 2, -D, 'S-CONC'); w.line(c1 + 100, -D, c2 - 100, -D, 'S-CONC'); w.line(c2 + 100, -D, xe, -D, 'S-CONC'); [c1 + 100, c2 - 100, c2 + 100].forEach(x => w.line(x, -D, x, -D + 30, 'S-CONC'));
    spikeL(w, c1 + D / 2 + 125, -D / 2, c1 + D / 2 - 125, -D / 2); spikeL(w, c2 - D / 2 - 125, -D / 2, c2 - D / 2 + 125, -D / 2); spikeL(w, c2 + D / 2 + 125, -D / 2, c2 + D / 2 - 125, -D / 2);
    fab(w, x0 + 10, -D / 2 - 25, xs - 70, -D / 2 - 25, 100, 1); fab(w, c1 + D / 2 + 75, -D / 2 - 25, c2 - D / 2 - 75, -D / 2 - 25, 100, 1); fab(w, c2 + D / 2 + 75, -D / 2 - 25, xe, -D / 2 - 25, 100, 1);
    w.rect(xs - 4 - 300, -D / 2 + 2, 300, 12, 'S-REO');
    w.weld(xs - 4, -D / 2 + 8, -12, -16, { size: '6', site: true, all: true });
    w.dim(c1 - 100, -D - 90, c1 + 100, -D - 90, 0.1, '200', { sub: 'TYP' }); w.line(c1 - 100, -D - 110, c1 - 100, -D + 10, 'S-DIM'); w.line(c1 + 100, -D - 110, c1 + 100, -D, 'S-DIM');
    w.dim(c1 + D / 2, -D - 90, c2 - D / 2, -D - 90, 0.1, 'DIMENSION VARIES'); w.line(c1 + D / 2, -D - 110, c1 + D / 2, -D / 2, 'S-DIM'); w.line(c2 - D / 2, -D - 110, c2 - D / 2, -D / 2, 'S-DIM');
    w.dim(c2 - D / 2 - 75, -D / 2 - 90, c2 - D / 2, -D / 2 - 90, 0.1, ' '); const pc = w.P(c2 - D / 2 - 75, -D / 2 - 90); w.add({ t: 'line', a: [pc[0] - 30, pc[1]], b: [pc[0], pc[1]], L: 'S-DIM' }); w.ptext(pc[0] - 15, pc[1] + 0.8, '75 COVER (TYP)', 2, 'c', 'b', 'S-DIM');
    w.dim(c2 - D / 2 - 125, 75, c2 - D / 2, 75, 9, '='); w.dim(c2 - D / 2, 75, c2 - D / 2 + 125, 75, 9, '='); [c2 - D / 2 - 125, c2 - D / 2, c2 - D / 2 + 125].forEach(x => w.line(x, 80, x, -D / 2 + 10, 'S-DIM'));
    w.dim(xe + 120, -D, xe + 120, -D / 2, 0.1, '='); w.dim(xe + 120, -D / 2, xe + 120, 0, 0.1, '='); [0, -D / 2, -D].forEach(y => w.line(xe + 20, y, xe + 140, y, 'S-DIM'));
    secMark(w, (c1 + c2) / 2 + 160, 330, (c1 + c2) / 2 + 160, -D - 380, 'A', 0);
    w.leader(x0 + 250, 75, 4, 30, 'EXISTING TIMBER\nSHEETING'); w.leader(c2 - 120, 225, 12, 10, 'SCOUR LINE'); w.leader(xs - 150, -D / 2 + 12, -12, 34, 'N12 x 300 LONG AT\n200 CRS SITE WELDED\nTO STEEL PILE\n(TYP)');
    w.leader(c2 - D / 2 - 120, -D / 2, -20, 26, 'φ10x250 LONG\nSPIKE (TYP)'); w.leader(xs + 50, -D - 4, -10, -16, 'EXISTING STEEL\nPILE\n(TYP)'); w.leader(c2, -D / 2 - 60, 2, -26, 'EXISTING PILE\n(TYP)', { dot: true }); w.leader(xe - 100, -D / 2 - 25, 8, -26, 'SL81 FABRIC\n(TYP)');
    LY.title('PLAN', null);
    drgBox(LY);
    LY.caption('ABUTMENT/ WINGWALL SCOUR REPAIR DETAIL', 10, null, { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Where the abutment / wingwall has been undermined: concrete wall between the piles cast into the scour hole, spiked to the piles, and the hole reinstated with compacted fill.');

  // ================================================================== PN30-2204 / 2205 wingwall extension
  // fabric seen in section: heavy dashed polyline (dash / gap in paper mm)
  function fabD(v, pts, dl, gp) { dl = (dl || 2.2) * v.s; gp = (gp || 1.1) * v.s; let on = true, rest = dl; for (let i = 0; i + 1 < pts.length; i++) { let [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1]; let L = Math.hypot(x2 - x1, y2 - y1); const ux = (x2 - x1) / (L || 1), uy = (y2 - y1) / (L || 1); while (L > 1e-6) { const st = min(rest, L); if (on) v.line(x1, y1, x1 + ux * st, y1 + uy * st, 'S-REO'); x1 += ux * st; y1 += uy * st; L -= st; rest -= st; if (rest <= 1e-6) { on = !on; rest = on ? dl : gp; } } } }
  // rounded U (bar bend) polyline helper: points of a U from (x1,y) to (x2,y) bulging by r in direction dy
  const uPts = (x1, x2, y, dy, r) => { const pts = [[x1, y]]; const cx = (x1 + x2) / 2, w = (x2 - x1) / 2; for (let i = 0; i <= 10; i++) { const a = PI - PI * i / 10; pts.push([cx + w * Math.cos(a), y + dy * (r || w) * Math.sin(a)]); } return pts.slice(1); };
  def('wwx', 'Wing walls', 'Wingwall extension – Types 1 / 2 (concrete)', 'PN30-2204 / 2205', [P('type', 'Type (1 = scour possible, 2 = no scour)', 1, { opts: [1, 2], num: 1 }), P('L', 'Extension length on slope (mm)', 1200, { num: 1 }), P('D', 'Pile dia. (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(700), t = +p.type === 2 ? 2 : 1, Xs = max(600, +p.L || 1200), D = +p.D || 300;
    const emb = t === 1 ? 1200 : 600, fw = t === 1 ? 1200 : 700;
    // ---- SECTION A 1:20 (through the end post) — x = 0 left (earth) face of the wall, y = 0 top of footing
    const a = LY.view(20), yGL = emb - 300, yTop = yGL + 300, yGLl = yTop - 100;
    const toeL = t === 1 ? 575 : 350, fx0 = -toeL + (t === 1 ? 0 : 0), fx1 = t === 1 ? 350 + 275 : 350;
    concBox(a, [[fx0, -300], [fx1, -300], [fx1, 0], [350, 0], [350, yTop - 20], [330, yTop], [20, yTop], [0, yTop - 20], [0, 0], [fx0, 0]]); a.line(0, 0, 350, 0, 'S-CONC');
    gl(a, -500, 0, yGLl, 1); gl(a, 350, 350 + 450, yGL - 0, 1);
    // reinforcement: fabric both faces, U over the top, starter bars, footing fabric loops
    fabD(a, [[75, 120], [75, yTop - 110], ...uPts(75, 275, yTop - 110, 1, 35).slice(0, -1), [275, yTop - 110], [275, 120]]);
    a.bar([[95, 40], [95, 460], [95, -230], [-toeL + 75 + 120, -230]]); a.bar([[255, 460], [255, -230], [fx1 - 75 - (t === 1 ? 0 : 0), -230]]);
    fabD(a, [[fx0 + 220, -75], [fx0 + 75, -75], ...uPts(fx0 + 75, fx0 + 75, -75, 0, 0), [fx0 + 75, -225], [fx0 + 220 + (t === 1 ? 260 : 120), -225]]);
    if (t === 1) fabD(a, [[350 + 30, -75], [fx1 - 75, -75], [fx1 - 75, -225], [350 + 30, -225]]); else fabD(a, [[fx0 + 75, -75], [275, -75]]);
    fin(a, 175, yTop, 'U2', 90); fin(a, fx0 + 150, 0, 'U1', 90); if (t === 1) fin(a, 350 + 150, 0, 'U1', 90); fin(a, fx1, -150, '4', 0); fin(a, 350, yTop - 400, '2', 0); fin(a, 0, t === 1 ? 300 : yTop - 200, '4', 180);
    a.dim(0, yTop + 200, 350, yTop + 200, 6, '350'); dimx(a, 275, yTop + 120, 350, yTop + 120, 0.1, '75 COVER', 14, 1, { ul: true }); a.ptext(a.P(350, 0)[0] + 14, a.P(0, yTop + 120)[1] - 3.2, '(TYP)', 2, 'c', 'b', 'S-DIM');
    const lx = t === 1 ? -200 : -560; a.dim(lx, yTop - 375, lx, yTop - 75, 4, '300', { sub: '(TYP)' }); a.line(lx - 10, yTop - 75, 60, yTop - 75, 'S-DIM'); a.line(lx - 10, yTop - 375, 60, yTop - 375, 'S-DIM');
    a.dim(fx1 + 150, -300, fx1 + 150, 0, -2, '300'); a.dim(fx1 + 150, 0, fx1 + 150, 500, -2, '500', { sub: 'MIN' }); a.line(265, 500, fx1 + 160, 500, 'S-DIM'); a.dim(fx1 + 350, -300, fx1 + 350, yGL, -2, emb + (t === 1 ? ' MIN' : ''));
    a.dim(fx0, -520, fx1, -520, -4, fw + (t === 1 ? ' ✱' : '')); a.dim(fx0, -400, fx0 + 300, -400, -2, '300', { sub: '(TYP)' }); a.dim(fx0, 260, fx0 + 300, 260, 2, '300', { sub: '(TYP)' });
    if (t === 1) { a.dim(fx0, 600, 0, 600, 4, '575 ✱'); a.dim(350, 360, fx1, 360, 4, '275 ✱'); }
    a.leader(175, yTop - 60, -26, 12, 'SL81 FABRIC'); a.leader(330, yTop, 20, -8, '20x20 CHAMFER\n(TYP)'); a.leaders([[275, yTop - 450], [75, 300]], 20, 0, 'SL81 FABRIC');
    if (t === 1) { a.leaders([[95, 200], [255, 200]], -26, 22, 'STARTER BARS'); a.leader(0, 0, -26, 14, 'CONSTRUCTION\nJOINT'); }
    else { a.leaders([[95, -230], [255, -100]], 26, -16, 'G1 STARTER\nBARS'); a.leaders([[fx0 + 120, -225], [fx0 + 75, -150]], -16, -12, 'SL81 FABRIC'); a.leader(0, 0, -30, 26, 'CONSTRUCTION\nJOINT'); }
    LY.title('SECTION A', 20);
    // ---- SECTION B 1:20 (through the sloping wall over the existing sheeting) — y = 0 top
    const b = LY.view(20), rD = 300;
    concBox(b, [[0, -900], [150, -900], [150, -rD], [350, -rD], [350, -20], [330, 0], [20, 0], [0, -20]]);
    b.line(150, -rD, 150, -1500, 'S-EXIST'); b.line(225, -rD, 225, -1500, 'S-EXIST'); for (let y = -rD - 200; y > -1500; y -= 200) b.line(150, y, 225, y, 'S-EXIST'); b.brk(130, -1500, 245, -1500);
    timberX(b, 225, -rD - 200, 125, 200); pileElev(b, 500, -1600, -rD, 300); b.arc(500, -rD + 40, 150, 195, 345, 'S-EXIST');
    gl(b, -450, 0, -300, 1); gl(b, 650, 1050, -1250, 1); earthV(b, 0, -700, -460, -1);
    fabD(b, [[75, -820], [75, -75 - 60], ...uPts(75, 275, -75 - 60, 1, 60).slice(0, -1), [275, -135], [275, -rD + 75]]); fabD(b, [[75 + 20, -rD + 40], [95, -480]]);
    fin(b, 175, 0, 'U2', 90); fin(b, 350, -150, '3', 0); fin(b, 0, -400, '4', 180);
    b.dim(0, 150, 350, 150, 6, '350'); b.dim(-150, -300, -150, 0, 4, '300', { sub: 'MIN' }); b.dim(-150, -900, -150, -300, 4, '600', { sub: 'MIN' }); b.line(-160, -900, 0, -900, 'S-DIM'); b.line(-160, 0, 0, 0, 'S-DIM');
    dimx(b, 360 + 140, -rD, 360 + 140, 0, 0.1, 'VARIES', -0.4, -12, { rot: true }); const pb = b.P(500, -rD); b.add({ t: 'text', p: [pb[0] + 5.2, pb[1] + 1], s: '150 MIN', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' }); b.add({ t: 'text', p: [pb[0] + 7.8, pb[1] + 1], s: '600 MAX', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' }); b.line(360, 0, 520, 0, 'S-DIM'); b.line(360, -rD, 520, -rD, 'S-DIM');
    dimx(b, 0, -1000, 75, -1000, 0.1, '75 COVER', -16, 1, { ul: true }); b.line(75, -1010, 75, -820, 'S-DIM'); dimx(b, 0, -1150, 150, -1150, 0.1, '150', -14, 1, { ul: true }); b.line(0, -1160, 0, -900, 'S-DIM'); b.line(150, -1160, 150, -900, 'S-DIM');
    b.leaders([[95, -100], [75, -250]], -22, 14, 'SL81 FABRIC'); b.leader(300, -120, 20, 34, 'EXISTING WINGWALL\nCAPPING SHALL BE\nREMOVED'); b.leader(350, -rD - 150, 22, -6, 'EXISTING TIMBER\nSPIKING RAIL'); b.leader(650, -900, 12, -4, 'EXISTING TIMBER\nPILE'); b.leader(150, -1350, -16, 0, 'EXISTING WINGWALL\nTIMBER SHEETING\nSHALL REMAIN');
    LY.title('SECTION B', 20);
    // ---- ELEVATION 1:20 — x along the wingwall from its free end, y = 0 natural G.L. at the end post
    const e = LY.view(20), Ys = 300 + 0.67 * Xs, Xf = Xs + 600, top = x => x <= Xs ? 300 + 0.67 * x : Ys, fb = -emb, ps = [450, 950, 1450, 1950].filter(x => x < Xf + 400);
    for (let i = 0; i < 6; i++) { const x = 450 + i * 500; if (x > Xf + 300) break; if (ps.indexOf(x) < 0) ps.push(x); }
    const bot = x => top(x) - 200;
    e.pl([[0, fb], [0, 300], [Xs, Ys], [Xf, Ys], [Xf, Ys - 200]], false, 'S-CONC'); e.pl([[300, fb], [300, 300], [Xs + 60, bot(Xs + 60)]], false, 'S-CONC'); e.line(0, fb, 300, fb, 'S-CONC'); e.line(0, fb + 300, 300, fb + 300, 'S-CONC');
    e.pl([[300, top(300) - 600], [Xf - 120, top(Xf - 120) - 600 > Ys - 600 ? Ys - 600 : top(Xf - 120) - 600], [Xf - 120, Ys - 600], [Xf, Ys - 600], [Xf, Ys - 200]], false, 'S-HIDDEN');
    ps.forEach(x => { const yt = x < Xs ? bot(x) - 40 : Ys - 230; e.line(x - D / 2, -emb - 150, x - D / 2, yt, 'S-EXIST'); e.line(x + D / 2, -emb - 150, x + D / 2, yt, 'S-EXIST'); e.pileEnd(x, -emb - 150, D, 'S-EXIST'); e.arc(x, yt + D * 0.55, D * 0.62, 235, 305, 'S-EXIST'); });
    e.line(Xs - 150, Ys - 230, Xf + 900, Ys - 230, 'S-EXIST'); e.rect(Xs + 200, Ys - 230 + 4, Xf - Xs - 200, 26, 'S-NEW'); e.hatch([[Xs + 200, Ys - 226], [Xf, Ys - 226], [Xf, Ys - 200], [Xs + 200, Ys - 200]], 'ansi37', 'S-HATCH', 0.6);
    // abutment beyond: halfcap, stringer, overlay
    e.rect(Xf - 50, Ys - 1050, 950, 300, 'S-EXIST'); e.circ(Xf + 200, Ys - 950, 22, 'S-EXIST'); e.circ(Xf + 320, Ys - 1000, 22, 'S-EXIST'); e.brk(Xf + 900, Ys - 1050, Xf + 900, Ys - 750); e.circ(Xf + 600, Ys - 520, 220, 'S-EXIST');
    e.pl([[Xf + 20, Ys - 300], [Xf + 20, Ys - 50], [Xf + 480, Ys - 50], [Xf + 560, Ys - 120], [Xf + 900, Ys - 120]], false, 'S-EXIST'); e.pl([[Xf + 20, Ys - 300], [Xf + 900, Ys - 300]], false, 'S-EXIST'); e.line(Xf + 20, Ys - 230, Xf + 20, Ys - 300, 'S-EXIST'); e.brk(Xf + 900, Ys - 300, Xf + 900, Ys - 120);
    // detail 1 callout (stadium) + bubble
    const cx = Xf + 10, cpts = []; for (let i = 0; i <= 12; i++) { const an = PI * i / 12; cpts.push([cx + 90 * Math.cos(an), Ys + 60 + 90 * Math.sin(an)]); } for (let i = 0; i <= 12; i++) { const an = PI + PI * i / 12; cpts.push([cx + 90 * Math.cos(an), Ys - 340 + 90 * Math.sin(an)]); } e.pl(cpts, true, 'S-TEXT'); const pc = e.P(cx + 220, Ys + 200); e.add({ t: 'circle', c: pc, r: 3, L: 'S-TEXT' }); e.add({ t: 'text', p: pc, s: '1', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); const pq = e.P(cx + 80, Ys + 120); e.add({ t: 'line', a: [pc[0] - 2.4, pc[1] - 1.8], b: pq, L: 'S-TEXT' });
    // ground
    gl(e, -700, 600, 0, -1); e.line(600, 0, Xf + 500, -emb + 100, 'S-GROUND');
    // reinforcement marks
    const o = 75 / Math.cos(Math.atan(0.67)), f1 = [60, top(60) - o], f2 = [Xs + 20, Ys - 75]; e.line(f1[0], f1[1], f2[0], f2[1], 'S-REO'); e.line(f2[0], f2[1], Xf - 75, Ys - 75, 'S-REO'); e.arrow(f1[0], f1[1], 214, 'S-TEXT');
    e.line(150, fb + 75, 150, 820, 'S-REO'); e.line(110, 820, 190, 820, 'S-REO'); e.line(110, fb + 75, 190, fb + 75, 'S-REO');
    e.line(40, 0 + 200, 640, 200, 'S-REO'); e.rect(130, 180, 40, 40, 'S-REO'); e.circ(150, 200, 14, 'S-REO');
    e.line(60, -300 - (t === 1 ? 300 : 0), 240, -300 - (t === 1 ? 300 : 0), 'S-REO'); e.circ(150, -300 - (t === 1 ? 300 : 0), 14, 'S-REO'); e.line(60, -340 - (t === 1 ? 300 : 0), 60, -260 - (t === 1 ? 300 : 0), 'S-REO'); e.line(240, -340 - (t === 1 ? 300 : 0), 240, -260 - (t === 1 ? 300 : 0), 'S-REO');
    e.line(150 - 60, -200, 150 - 60, fb + 100, 'S-REO'); e.line(40, fb + 150, 260, fb + 150, 'S-REO'); e.line(40, fb + 130, 40, fb + 170, 'S-REO'); e.line(260, fb + 130, 260, fb + 170, 'S-REO');
    if (t === 2) { fabD(e, [[30, fb + 260], [270, fb + 260]], 1.6, 0.9); fabD(e, [[30, fb + 60], [270, fb + 60]], 1.6, 0.9); }
    e.line(Xf - 140, Ys - 75, Xf - 140, Ys - 360, 'S-REO'); e.circ(Xf - 230, Ys - 75, 18, 'S-REO');
    const sm = [Xs * 0.68, top(Xs * 0.68) - 75]; e.circ(sm[0], sm[1], 18, 'S-REO'); e.line(sm[0] - 30, sm[1] + 40, sm[0] + 60, sm[1] - 80, 'S-REO');
    fin(e, 0, -150, '2', 180);
    // section cuts
    secMark(e, 120, 1000, 120, fb - 350, 'A', 0); secMark(e, Xs * 0.55, Ys + 220, Xs * 0.55, -250, 'B', 0);
    // dims
    e.dim(-150, 0, -150, 300, 4, '300', { sub: 'MIN' }); e.dim(-150, fb, -150, 0, 4, emb + ' MIN'.slice(0, t === 1 ? 4 : 0)); e.line(-160, fb, 0, fb, 'S-DIM'); e.line(-160, 300, 0, 300, 'S-DIM');
    e.dim(Xs - 300, Ys - 200, Xs - 300, Ys, 4, '150', { sub: 'MIN' }); e.line(Xs - 310, Ys, Xs, Ys, 'S-DIM'); e.line(Xs - 310, Ys - 200, Xs - 180, Ys - 200, 'S-DIM');
    e.dim(Xs, Ys + 150, Xf, Ys + 150, 4, ' '); const pp = e.P((Xs + Xf) / 2, Ys + 150); e.ptext(pp[0] - 21, pp[1] + 0.8, '900 PERPENDICULAR', 2, 'l', 'b', 'S-DIM'); e.ptext(pp[0] - 21, pp[1] - 0.8, 'TO ℄ OF ROAD (TYP)', 2, 'l', 't', 'S-DIM');
    // leaders
    e.leader(Xs * 0.6, top(Xs * 0.6), -20, 26, 'WINGWALL SLOPE\nTO MATCH EXISTING\n(TYP)'); e.leader(Xs * 0.8, top(Xs * 0.8) - 75, 14, -22, 'SL81 FABRIC'); e.leader(Xf - 230, Ys - 75, -50, 42, 'SL81 FABRIC');
    e.leader(150, 800, -30, 0, 'SL81 FABRIC NF\nSL81 FABRIC FF\nSEE SECTIONS\nA & B', { dot: true }); e.leader(150, -300 - (t === 1 ? 300 : 0), -30, 8, 'G1-X-N12-200 NF\nG1-X-N12-200 FF\nSTARTER BARS', { dot: true });
    e.leader(40, fb + 150, -10, -16, 'SL81 FABRIC\n(TYP)'); e.leader(150, fb + 150, 6, -26, t === 1 ? 'SL81 FABRIC NF\nSL81 FABRIC FF' : 'SL81 FABRIC NF', { dot: true }); e.leader(Xs + 400, Ys - 215, 36, 36, 'TRIM TOP OF\nEXISTING TIMBER\nWINGWALL TO SUIT');
    LY.title('ELEVATION', null);
    // ---- DETAIL 1 1:10 — joint to the concrete overlay
    const d = LY.view(10);
    concBox(d, [[-420, -230], [-420, 0], [-20, 0], [0, -20], [0, -230]]); d.brk(-420, -230, -420, 0); d.line(0, -230, 0, -560, 'S-EXIST');
    d.line(-420, -230, 0, -230, 'S-EXIST'); d.line(-420, -400, 0, -400, 'S-EXIST'); d.line(-420, -680, 0, -680, 'S-EXIST'); d.line(-300, -230, -300, -400, 'S-EXIST'); d.brk(-420, -680, -420, -400, 'S-EXIST'); d.line(0, -560, 0, -680, 'S-EXIST');
    concBox(d, [[20, -50], [400, -50], [400, -560], [20, -560]]); d.brk(400, -560, 400, -50); d.fill([[0, -50], [20, -50], [20, -90], [0, -90]], 'S-NEW'); d.rect(0, -560, 20, 470, 'S-NEW'); d.hatch([[0, -90], [20, -90], [20, -560], [0, -560]], 'ansi31', 'S-HATCH', 0.5);
    d.circ(160, -680, 130, 'S-EXIST'); d.boltEnd(-75, -300, 12); d.line(-75, -330, -75, -500, 'S-HIDDEN');
    d.dim(0, 60, 20, 60, 6, '20'); d.dim(80, -50, 80, 0, -1, '50'); d.line(20, 0, 120, 0, 'S-DIM'); d.dim(-75, -380, 0, -380, 0.1, ' '); const p7 = d.P(-75, -380); d.add({ t: 'line', a: [p7[0] - 10, p7[1]], b: p7, L: 'S-DIM' }); d.ptext(p7[0] - 6, p7[1] + 0.8, '75', 2, 'c', 'b', 'S-DIM');
    d.leader(10, -70, -14, 22, '20 THICK SILICONE\nRUBBER SEALANT'); d.leader(-300, -60, -16, 10, 'WINGWALL\nEXTENSION', { dot: true }); d.leader(-300, -320, -16, 6, 'EXISTING TIMBER\nSPIKING RAIL', { dot: true }); d.leader(-75, -300, -22, -14, 'M8 x 175 LONG\nCOACH SCREW');
    d.leader(-150, -540, -10, -22, 'EXISTING TIMBER\nSHEETING', { dot: true }); d.leader(200, -200, 14, 4, 'CONCRETE\nOVERLAY', { dot: true }); d.leaders([[10, -200], [10, -450]], 30, -16, 'BITUMEN IMPREGNATED\nFIBRE BOARD BETWEEN\nCONCRETE OVERLAY &\nWINGWALL EXTENSION/\nEXISTING TIMBER SHEETING'); d.leader(200, -720, 14, -8, 'EXISTING TIMBER\nPILE', { dot: true });
    LY.title('DETAIL 1', 10);
    LY.break();
    LY.block(B => { nb(B, 0, 0, '✱ DENOTES: DIMENSIONS SHALL BE CHECKED BY ENGINEER', 70); });
    LY.block(B => { nb(B, 0, 0, 'NOTE :- IF SCOURING OF WINGWALL IS NOT EVIDENT THEN DESIGN ENGINEER SHALL CONSULT WITH THE WATERWAYS ENGINEER TO DETERMINE IF THERE IS A POSSIBILITY OF SCOURING OCCURRING IN THE FUTURE', 92, { h: 2.6 }); });
    LY.block(B => { nb(B, 0, 0, t === 1 ? 'TYPE 1 - WHERE SCOURING OF WINGWALL HAS OCCURRED OR IS A POSSIBILITY.' : 'TYPE 2 - WHERE THERE IS NO POSSIBILITY OF SCOURING TO WINGWALL OCCURRING.', 80, { h: 2.6 }); });
    drgBox(LY);
    LY.caption('WINGWALL EXTENSION DETAIL - TYPE ' + t, 20, 'ABUTMENT N° X - XHS ONLY', { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Concrete extension cast over / in front of a deteriorated timber wingwall; Type 1 (deep 1200 footing) where scour has occurred or is possible, Type 2 (600 embedment) where it is not.');

  // ================================================================== PN30-2206 abutment retaining wall (example)
  // offset a polyline by d to its left (mitred corners)
  function offPath(pts, d) { const n = pts.length, N = []; for (let i = 0; i + 1 < n; i++) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dy); N.push([-dy / L, dx / L]); }
    return pts.map((q, i) => { if (i === 0) return [q[0] + N[0][0] * d, q[1] + N[0][1] * d]; if (i === n - 1) return [q[0] + N[n - 2][0] * d, q[1] + N[n - 2][1] * d]; const m = [N[i - 1][0] + N[i][0], N[i - 1][1] + N[i][1]], ml = Math.hypot(m[0], m[1]), c = (m[0] * N[i][0] + m[1] * N[i][1]) / ml; return [q[0] + m[0] / ml * d / c, q[1] + m[1] / ml * d / c]; }); }
  // point at chainage s along a polyline, offset d to the left; also returns the unit tangent
  function atPath(pts, s, d) { for (let i = 0; i + 1 < pts.length; i++) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dy); if (s <= L || i + 2 === pts.length) { const u = [dx / L, dy / L]; return { p: [pts[i][0] + u[0] * s - u[1] * (d || 0), pts[i][1] + u[1] * s + u[0] * (d || 0)], u }; } s -= L; } }
  // retaining wall section (A between piles / B at a pile under the halfcap); x = 0 front face of sheeting, y = 0 top of footing
  function rwSec(v, B, D) { const T = D + 150, F = T + 1500, Hw = 1800;
    const top = B ? Hw : 2300, brk = B ? null : [1300, 1500];
    const wall = [[0, -300], [F, -300], [F, -600], [F - 200, -600], [F - 200, -300 + 0.01]]; concBox(v, [[0, -300], [F - 200, -300], [F - 200, -600], [F, -600], [F, 0], [T, 0], [T, top - 20], [T - 20, top], [0, top]]);
    v.line(0, 0, T, 0, 'S-CONC'); v.hatch([[0, -300], [F - 200, -300], [F - 200, -350], [0, -350]], 'gravel', 'S-HATCH', 0.35); v.pl([[0, -350], [F - 200, -350]], false, 'S-CONC'); v.line(0, -300, 0, -350, 'S-CONC'); v.line(F - 200, -300, F - 200, -350, 'S-CONC');
    if (brk) brk.forEach(y => v.brk(-130, y, T + 60, y, 'S-TEXT'));
    // existing sheeting, pile, earth
    v.line(-75, -600, -75, top + (B ? 400 : 0), 'S-EXIST'); for (let y = -500; y < top + (B ? 380 : 0); y += 160) v.line(-75, y, 0, y, 'S-EXIST'); v.line(-75, -600, 0, -600, 'S-EXIST');
    v.line(0, -650, 0, top, 'S-EXIST'); v.line(D, -650, D, top - 300, 'S-EXIST'); v.pileEnd(D / 2, -650, D, 'S-EXIST'); earthV(v, -75, B ? 900 : 700, B ? 1400 : 1150, -1); earthV(v, -75, B ? 1500 : 2000, B ? 1750 : 2250, -1);
    if (!B) { v.pl([[-75, top], [-500, top + 200], [-900, top + 260]], false, 'S-GROUND'); earthLine(v, [-140, top + 30], [-480, top + 190]); }
    // reinforcement
    fabD(v, [[60, 120], [60, top - 75]]); fabD(v, [[T - 60, 120], [T - 60, top - 75]]); v.bar([[85, 750], [85, -225], [F - 200 - 75, -225]]); v.bar([[T - 70, 400], [T - 70, -225], [T - 70 + 300, -225]]);
    fabD(v, [[50, -75], [F - 75, -75], [F - 75, -525]]); v.circ(85, -225, 25, 'S-REO'); v.circ(F - 200 - 75, -225, 25, 'S-REO');
    for (let y = 400; y < top - 200; y += 300) if (!brk || y < brk[0] - 50 || y > brk[1] + 50) v.line(-60, y, 60, y, 'S-BOLT');
    fin(v, T + 400, 0, 'U', 90); fin(v, T, 600, '2', 0); fin(v, F, -450, '4', 0);
    // dimensions
    v.dim(T, -800, F, -800, 0.1, ' '); v.dim(D, top + 250, T, top + 250, 6, B ? ' ' : '150'); v.dim(T + 500, 0, F - 200, 0, 0, ' ');
    v.dim(T, 1200, F, 1200, 4, '1500 ✱'); v.line(F, 1210, F, 0, 'S-DIM');
    dimx(v, F - 75, 900, F, 900, 0.1, '75 COVER', -16, 1, { ul: true }); v.ptext(v.P(F, 0)[0] - 16, v.P(0, 900)[1] - 3, '(TYP)', 2, 'c', 'b', 'S-DIM'); v.line(F - 75, 910, F - 75, -70, 'S-DIM');
    v.dim(F + 220, 0, F + 220, 150, -1, '150', { sub: '(MIN)' }); v.dim(F + 220, -75, F + 220, 0, -1, '75', { sub: '(TYP)' }); v.dim(F + 450, -600, F + 450, 0, -2, '600');
    v.dim(-500, -300, -500, 0, 4, '300'); v.dim(-280, 0, -280, 400, 4, '400'); v.dim(-500, 0, -500, B ? 1500 : 750, 4, B ? '1500' : '750'); v.line(-510, -300, 0, -300, 'S-DIM'); v.line(-510, 0, 0, 0, 'S-DIM'); v.line(-290, 400, T - 60, 400, 'S-DIM'); v.line(-510, B ? 1500 : 750, 80, B ? 1500 : 750, 'S-DIM');
    v.dim(-280, 1000, -280, 1300 - (B ? 0 : 0), 4, '300', { sub: '(TYP)' }); v.line(-290, 1000, 0, 1000, 'S-DIM'); v.line(-290, 1300, 0, 1300, 'S-DIM');
    v.dim(T - 70, -500, T + 230, -500, -2, '300', { sub: '(TYP)' }); v.dim(0, -900, F - 200, -900, -2, B ? 'A2-A8' : 'A22-A28'); v.dim(F - 200, -900, F, -900, -2, '200');
    if (!B) { v.dim(T + 200, top - 20, T + 200, top, -1, '20'); v.line(T, top - 20, T + 210, top - 20, 'S-DIM'); v.line(T, top, T + 210, top, 'S-DIM'); }
    gl(v, T, F + 300, 150, 1); gl(v, F + 600, F + 1200, 150, 1); v.wl(F + 750, 150, 'NATURAL GL');
    v.leader(-75, B ? 1600 : 1800, -14, 8, 'EXISTING\nSHEETING'); v.leader(60, 1050, -20, 8, 'φ10x250 LONG\nSPIKE (TYP)'); v.leaders([[60, 1800 - (B ? 500 : 650)], [T - 60, 1800 - (B ? 500 : 650)]], 20, 18, 'A11');
    v.leader(T - 70 + 200, -225, 14, 22, 'A9'); v.leader(T + 400, -75, 10, 16, 'A10'); v.leader(T + 700, -225, 8, -10, B ? 'A1' : 'A12'); v.leader(0, 20, -16, -20, 'CONSTRUCTION\nJOINT'); v.leader(F - 600, -350, 8, -24, '50 BLINDING\nLAYER');
    return { T, F, top }; }

  def('pn2206', 'Abutments', 'Abutment retaining wall (example)', 'PN30-2206', [P('D', 'Pile dia. (mm)', 350, { num: 1 })], (p) => {
    const LY = new Lay(700), D = +p.D || 350, T = D + 150, F = T + 1500;
    // ---- PLAN 1:50
    const v = LY.view(50), path = [[-1900, 3650], [0, 1750], [0, -1750], [-1900, -3650]], O = d => offPath(path, d);
    v.pl(O(-75), false, 'S-EXIST'); v.pl(O(0), false, 'S-EXIST'); v.pl(O(T), false, 'S-CONC'); v.pl(O(F), false, 'S-CONC'); v.pl(O(F - 200), false, 'S-HIDDEN');
    [0, 3].forEach(i => { const a = O(-75)[i], b = O(F)[i]; v.line(a[0], a[1], b[0], b[1], 'S-CONC'); });
    fabD(v, O(60), 1.6, 0.9); fabD(v, O(T - 60), 1.6, 0.9); fabD(v, O(F - 75), 1.6, 0.9);
    const L1 = Math.hypot(1900, 1900), st = [L1 * 0.35, L1 * 0.72, L1 + 150, L1 + 1300, L1 + 2350, L1 + 3350, L1 + 3500 + L1 * 0.28, L1 + 3500 + L1 * 0.65];
    st.forEach((s0, i) => { const q = atPath(path, s0, D / 2).p; v.circ(q[0], q[1], D / 2, 'S-EXIST'); v.text(q[0], q[1], String(i + 1), 2.2, 'c', 'm'); });
    // transverse bars (representative) and spikes
    [L1 * 0.2, L1 * 0.55, L1 * 0.9, L1 + 900, L1 + 1700, L1 + 2600, L1 + 3500 + L1 * 0.15, L1 + 3500 + L1 * 0.5, L1 + 3500 + L1 * 0.85].forEach((s0, i) => { const a = atPath(path, s0, 85).p, b = atPath(path, s0, F - 120).p, u = atPath(path, s0, 0).u; v.line(a[0], a[1], b[0], b[1], 'S-REO'); [a, b].forEach(q => v.line(q[0] - u[0] * 60, q[1] - u[1] * 60, q[0] + u[0] * 60, q[1] + u[1] * 60, 'S-REO')); const m = atPath(path, s0, (i % 2 ? 0.55 : 0.75) * F).p; v.circ(m[0], m[1], 50, 'S-REO'); });
    [L1 + 600, L1 + 1100, L1 + 1600, L1 + 2100, L1 + 2600, L1 + 3100].forEach(s0 => { const a = atPath(path, s0, -40).p, b = atPath(path, s0, 120).p; v.line(a[0], a[1], b[0], b[1], 'S-BOLT'); });
    [2, 5].forEach(i => { const q = atPath(path, st[i], D + 40).p; v.rect(q[0] - 30, q[1] - 75, 60, 150, 'S-NEW'); });
    v.text(...atPath(path, L1 + 2000, D * 0.5 + 60).p, '', 2);
    // section cuts
    const cb = atPath(path, L1 + 1950, 0).p; v.mark(-500, cb[1], 'B', 90); v.line(-360, cb[1], -150, cb[1], 'S-TITLE'); v.mark(F + 650, cb[1], 'B', 90); v.line(F + 510, cb[1], F + 300, cb[1], 'S-TITLE');
    const ca = atPath(path, L1 + 3500 + L1 * 0.45, -900).p; v.mark(ca[0], ca[1], 'A', 45); const ca2 = atPath(path, L1 + 3500 + L1 * 0.45, F + 600).p; v.mark(ca2[0], ca2[1], 'A', 45);
    // dimensions
    const d3 = atPath(path, st[2], -900).p, d4 = atPath(path, st[3], -900).p; v.dim(d3[0], d3[1], d4[0], d4[1], -4, 'DIM VARIES'); [st[2], st[3]].forEach(s0 => { const q1 = atPath(path, s0, -1000).p, q2 = atPath(path, s0, D / 2).p; v.line(q1[0], q1[1], q2[0], q2[1], 'S-DIM'); }); const c3 = atPath(path, st[3] - 75, -300).p; v.dim(c3[0], c3[1], c3[0], c3[1] - 75, 0.1, ' '); v.ptext(v.P(...c3)[0] - 9, v.P(...c3)[1] - 2, '75 COVER', 2, 'r', 'b', 'S-DIM'); v.ptext(v.P(...c3)[0] - 9, v.P(...c3)[1] - 2.8, '(TYP)', 2, 'r', 't', 'S-DIM'); v.add({ t: 'line', a: [v.P(...c3)[0] - 9, v.P(...c3)[1] - 2.4], b: [v.P(...c3)[0], v.P(...c3)[1] - 2.4], L: 'S-DIM' });
    const e1 = atPath(path, 2 * L1 + 3500 - 400, -250).p, e2 = atPath(path, 2 * L1 + 3500, -250).p; v.dim(e1[0], e1[1], e2[0], e2[1], -3, '400', { sub: '(TYP)' });
    // labels
    const lab = (s0, d, ry, t, cx, o) => { const q = atPath(path, s0, d).p, pq = v.P(q[0], q[1]), sh = v.P(cx == null ? F + 900 : cx, ry); v.leader(q[0], q[1], sh[0] - pq[0], sh[1] - pq[1], t, o || { dot: true }); };
    lab(L1 * 0.25, F - 75, 4300, 'A13-A19-1x7-N12-300 B'); lab(L1 * 0.4, T + 300, 3800, 'A9-XX-N12-200 B'); lab(L1 * 0.55, F * 0.6, 3300, 'A12-XX-N16-150 B');
    lab(L1 + 60, F - 300, 2300, 'A20-7-N12-300 B'); lab(L1 + 150, F - 100, 1950, 'A21-4-N16-300 B'); lab(L1 + 450, F, 1600, 'CONCRETE FOOTING'); lab(st[2], D + 40, 1250, '150 PFC FULLCAP SUPPORT\nAT TOP OF WALL\nSEE SECTION B');
    lab(L1 + 2200, T - 60, 350, 'A10-SL81 FABRIC'); lab(L1 + 2550, T + 100, 0, 'A9-XX-N12-200 B'); lab(L1 + 2850, F * 0.55, -350, 'A1-XX-N16-150 B'); lab(L1 + 3250, F - 50, -700, 'A2-A8-1x7-N12-300 B');
    lab(L1 + 3420, F - 100, -1050, 'A21-4-N16-300 B'); lab(L1 + 3500 + 60, F - 300, -1400, 'A20-7-N12-300 B'); lab(L1 + 3500 + L1 * 0.55, F * 0.55, -3100, 'A12-XX-N16-150 B'); lab(L1 + 3500 + L1 * 0.72, T + 300, -3600, 'A9-XX-N12-200 B'); lab(L1 + 3500 + L1 * 0.9, F - 75, -4300, 'A22-A28-1x7-N12-300 B');
    lab(L1 * 0.6, 60, 2400, 'A11-SL81 FABRIC\n(TYP)', -2600, {}); lab(L1 + 1500, 0, 900, 'φ10x250 LONG SPIKE\nAT 300 CRS\n(TYP)', -1300, {}); lab(L1 + 2900, D * 0.6, -500, 'CONCRETE INFILL\nBETWEEN PILES\n(TYP)', -1300, { dot: true }); lab(L1 + 3300, -40, -1350, 'EXISTING TIMBER\nSHEETING (TYP)', -1300, {}); lab(L1 + 3500 + L1 * 0.15, D / 2, -1750, 'EXISTING TIMBER\nPILE (TYP)', -1300, {});
    LY.title('PLAN', null);
    // ---- SECTIONS A and B 1:20
    const a = LY.view(20); rwSec(a, false, D); a.leader(T, 2280, 20, -2, '20x20 CHAMFER\n(TYP)');
    LY.title('SECTION A', 20);
    const b = LY.view(20), r = rwSec(b, true, D), Hw = r.top;
    timberX(b, -60, Hw, 300, 320); timberX(b, D + 10, Hw, 300 - 10, 320); b.rect(D - 140 + 60, Hw - 300, 75, 300 + 190, 'S-NEW'); b.line(D - 110, Hw - 300, D - 110, Hw + 190, 'S-HIDDEN'); rod(b, -60, Hw + 115, D + 300, Hw + 115, 65);
    b.rect(-75, Hw + 320, 1300, 220, 'S-EXIST'); for (let x = 50; x < 1300; x += 150) b.line(x, Hw + 320, x, Hw + 540, 'S-EXIST'); b.brk(1225, Hw + 300, 1225, Hw + 560); b.arc(1250, Hw + 250, 180, 200, 340, 'S-EXIST'); b.arc(1250, Hw + 50, 120, 20, 160, 'S-EXIST');
    b.dim(D + 450, Hw + 115, D + 450, Hw + 320, -2, '125'); b.dim(D + 450, Hw - 300, D + 450, Hw, -2, '300'); b.line(D + 310, Hw + 320, D + 470, Hw + 320, 'S-DIM'); b.line(D + 100, Hw - 300, D + 470, Hw - 300, 'S-DIM'); b.line(D + 300, Hw + 115, D + 470, Hw + 115, 'S-DIM');
    b.dim(r.F + 1100, 150, r.F + 1100, Hw, -2, 'SITE MEASURE ✱'); b.line(D + 300, Hw, r.F + 1120, Hw, 'S-DIM');
    b.leader(D - 100, Hw + 190, 4, 40, '150 PFC x 500 LONG\nADJACENT TO EACH\nABUTMENT WALL PILE'); b.leader(300, Hw + 430, -32, 6, 'EXISTING DECKING', { dot: true }); b.leader(-60, Hw + 160, -20, 0, 'EXISTING TIMBER\nHALFCAP (TYP)');
    b.leader(1250, Hw + 100, 18, 16, 'EXISTING STRINGER', { dot: true }); b.leader(D + 250, Hw + 115, 26, -8, 'THREADED ROD WITH 65x5FLx65\nWASHER TO TIMBER FACE.');
    LY.title('SECTION B', 20);
    LY.break();
    LY.block(B => { nb(B, 0, 0, 'EXAMPLE ONLY\nFOR ABUT N° 2 RETAINING WALL CHANGE BAR MARK PREFIX FROM \'A\' TO \'B\'.\nNUMBERS OF BARS ARE TO BE DETERMINED TO SUIT INDIVIDUAL EXISTING BRIDGE ABUTMENTS.', 70); });
    LY.block(B => { const h = nb(B, 0, 0, '✱ DENOTES:\nDIMENSION SHALL BE DETERMINED BY ENGINEER. REINFORCEMENT WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS.\n ', 92); B.E.push({ t: 'text', p: [2, -h - 0.5], s: 'THE ABOVE DETAILS SHALL NOT BE USED', h: 3, al: 'l', v: 't', ang: 0, L: 'S-TITLE' }, { t: 'text', p: [2, -h - 5.2], s: 'IN LOCATIONS SUBJECT TO SCOUR.', h: 3, al: 'l', v: 't', ang: 0, L: 'S-TITLE' }); B.E.push({ t: 'pl', p: [[0, -h], [92, -h], [92, -h - 10.5], [0, -h - 10.5]], closed: false, L: 'S-NOTE' }); });
    drgBox(LY);
    LY.caption('ABUTMENT - RETAINING WALL DETAIL', 50, null, { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'EXAMPLE ONLY – reinforced concrete retaining wall and footing cast against the abutment sheeting, with 150 PFC fullcap supports; not for locations subject to scour.');

  // ================================================================== PN30-2207 sheeting / spiking rail support
  def('srb', 'Sheeting', 'Sheeting / spiking rail support bracket', 'PN30-2207', [], (p) => {
    const LY = new Lay(600);
    // ---- BRACKET DETAIL 1:10 — side view (x = 0 back of PFC web, y = 0 top of the PFC / underside of the top plate)
    const v = LY.view(10);
    v.pl([[0, 0], [50, 0], [50, -430], [30, -450], [0, -450]], true, 'S-NEW'); v.line(6, 0, 6, -450, 'S-HIDDEN'); v.rect(0, 0, 135, 10, 'S-NEW'); v.rect(115, 10, 10, 185, 'S-NEW');
    v.line(115, 100, 125, 100, 'S-HIDDEN'); v.line(115, 150, 125, 150, 'S-HIDDEN'); [-175, -400].forEach(y => { v.line(-25, y, 30, y, 'S-CL'); });
    v.line(100, 125, 140, 125, 'S-CL');
    v.dim(0, 300, 115, 300, 0.1, '115'); v.line(0, 310, 0, 12, 'S-DIM'); v.line(115, 310, 115, 200, 'S-DIM');
    v.dim(-150, 10, -150, 195, 4, '185'); v.dim(-150, -450, -150, 10, 4, '450'); v.line(-160, 195, 110, 195, 'S-DIM'); v.line(-160, -450, -5, -450, 'S-DIM'); v.line(-160, 10, -5, 10, 'S-DIM');
    v.dim(-60, 10, -60, 125, 4, '115'); v.line(-70, 125, 100, 125, 'S-DIM'); v.dim(-60, -175, -60, 0, 4, '175'); v.dim(-60, -400, -60, -175, 4, '225'); v.line(-70, -175, -25, -175, 'S-DIM'); v.line(-70, -400, -25, -400, 'S-DIM');
    v.dim(260, 150, 260, 100, 0.1, ' '); const p5 = v.P(260, 150); v.ptext(p5[0] - 0.8, p5[1] + 6, '', 2); v.add({ t: 'text', p: [p5[0] - 0.6, p5[1] + 3], s: '50', h: 2, al: 'l', v: 'b', ang: 90, L: 'S-DIM' }); v.line(135, 150, 280, 150, 'S-DIM'); v.line(135, 100, 280, 100, 'S-DIM');
    v.dim(0, -60, 135, -60, 0.1, '135');
    v.leader(125, 195, 10, 10, '100 x 10FL'); v.leader(135, 0, 14, -8, '100 x 10FL'); v.leader(50, -250, 12, -2, '100 PFC'); v.leader(40, -440, 6, -8, '20 CHAMFER\nTYP');
    // front view
    const fx = 650; v.rect(fx - 50, 0, 100, -450, 'S-NEW'); v.line(fx - 42, 0, fx - 42, -450, 'S-HIDDEN'); v.line(fx + 42, 0, fx + 42, -450, 'S-HIDDEN'); v.rect(fx - 50, 0, 100, 10, 'S-NEW'); v.rect(fx - 50, 10, 100, 185, 'S-NEW');
    v.pl([[fx - 9, 105], [fx - 9, 145], [fx, 154], [fx + 9, 145], [fx + 9, 105], [fx, 96]], true, 'S-NEW'); v.line(fx, 80, fx, 170, 'S-CL'); v.line(fx - 25, 125, fx + 25, 125, 'S-CL');
    [-175, -400].forEach(y => v.boltEnd(fx, y, 18)); v.line(fx, 210, fx, 300, 'S-CL');
    v.dim(fx - 50, 280, fx, 280, 0.1, '='); v.dim(fx, 280, fx + 50, 280, 0.1, '='); v.line(fx - 50, 290, fx - 50, 200, 'S-DIM'); v.line(fx + 50, 290, fx + 50, 200, 'S-DIM');
    v.weld(fx - 40, 5, -24, -14, { size: '6', tail: 'TYP' }); v.weld(fx + 30, 5, 20, -12, { size: '6' }); v.weld(fx + 40, 12, 22, 10, { other: true });
    v.leader(fx, 135, 14, 16, 'φ18 x 50 LONG\nSLOTTED HOLE'); v.leader(fx + 9, -175, 14, -10, 'φ18 HOLE\nTYP');
    LY.title('SHEETING/SPIKING RAIL BRACKET DETAIL', 10);
    LY.break();
    // ---- SECTION A 1:20 — x = 0 front face of sheeting, y = 0 underside of the spiking rail
    const s = LY.view(20);
    s.line(-75, -1350, -75, 300, 'S-EXIST'); for (let y = -1300; y < 0; y += 200) s.line(-75, y, 0, y, 'S-EXIST'); s.line(0, -1350, 0, 0, 'S-EXIST'); s.brk(-110, -1350, 30, -1350);
    timberX(s, 0, 0, 150, 200); s.rect(-75, 200, 450, 120, 'S-EXIST'); s.pl([[375, 320], [1700, 320]], false, 'S-EXIST'); s.line(150, 200, 1700, 200, 'S-HIDDEN'); s.line(150, 60, 1700, 60, 'S-HIDDEN'); s.line(150, -10, 1700, -10, 'S-NEW'); s.brk(1700, 320, 1700, -40);
    pileElev(s, 900 - 150, -1550, -10, 300); s.rect(600 - 170, -900, 170, 400, 'S-EXIST'); s.pl([[600, -500], [700, -500], [1000, -600], [1600, -600]], false, 'S-EXIST'); s.arc(1650, -350, 250, 280, 80, 'S-EXIST');
    s.line(-600, 320, -75, 320, 'S-GROUND'); earth(s, -500, -200, 320, -1); earthV(s, -75, -950, -650, -1);
    // bracket: top plate under the rail with shims, vertical plate on the rail face, PFC down the sheeting
    s.rect(0, -25, 175, 10, 'S-NEW'); s.rect(0, -15, 150, 15, 'S-NEW'); s.rect(150, -15, 10, 200, 'S-NEW'); s.pl([[0, -25], [50, -25], [50, -455], [30, -475], [0, -475]], true, 'S-NEW');
    cscrew(s, 175, 100, 25, 100, 16); [-200, -425].forEach(y => cscrew(s, 50, y, -60, y, 16));
    s.leader(75, 120, -6, 36, 'EXISTING TIMBER\nSPIKING RAIL'); s.leader(370, 320, 10, 16, 'EXISTING WINGWALL\nCAPPING'); s.leader(100, 100, -34, 20, 'φ16 x 150 LONG\nCOACH SCREW'); s.leader(0, -15, -24, 0, 'PACK WITH 100x100\nSTEEL SHIM PLATES\nAS REQUIRED');
    s.leaders([[50, -300], [50, -425]], -26, -12, 'SHEETING/SPIKING RAIL\nBRACKET, 2-φ16 x 75\nLONG COACH SCREWS TO\nTIMBER SHEETING'); s.leader(-75, -1150, -14, -8, 'EXISTING WINGWALL\nTIMBER SHEETING'); s.leader(600, -900, 10, -8, 'EXISTING TIMBER\nPILE'); s.leader(600, -1300, 10, -14, 'EXISTING TIMBER\nPILE');
    LY.title('SECTION A', 20);
    // ---- ELEVATION 1:20 — x along the wingwall, y = 0 underside of the spiking rail
    const e = LY.view(20), bx = 0;
    for (let y = -1300; y <= 0; y += 200) e.line(-1300, y, 1500, y, 'S-EXIST'); e.line(-1300, -1450, 1500, -1450, 'S-EXIST'); e.line(-1300, -1450, -1300, 400, 'S-EXIST'); e.brk(-1300, -600, -1300, -800);
    e.pl([[-1300, 50], [-850, 350], [-650, 350], [bx + 100, 350]], false, 'S-EXIST'); e.pl([[-1300, -200], [-850, 120], [-650, 120], [bx - 50, 120]], false, 'S-EXIST'); e.arc(-500, 200, 230, 200, 340, 'S-EXIST');
    pileElev(e, -650, -1500, 120, 300); pileElev(e, 600, -1500, -400, 300);
    e.pl([[bx + 100, 350], [bx + 100, -10], [1500, -10]], false, 'S-NEW'); e.pl([[bx + 100, 350], [bx + 450, 350], [bx + 500, 280], [1500, 290]], false, 'S-NEW'); e.pl([[bx + 100, 0], [bx + 100, 0]], false, 'S-NEW'); e.rect(bx + 900, -10, 600, 200, 'S-NEW'); e.brk(1500, 350, 1500, -10); e.circ(900, -350, 330, 'S-EXIST');
    e.rect(bx + 100, -700, 1300, 300, 'S-EXIST'); e.circ(bx + 400, -500, 22, 'S-EXIST'); e.circ(bx + 550, -560, 22, 'S-EXIST'); e.brk(1500, -700, 1500, -400);
    e.rect(bx - 50, -15, 100, 210, 'S-NEW'); e.rect(bx - 50, -475, 100, 450, 'S-NEW'); e.rect(bx - 50, -25, 100, 10, 'S-NEW'); [100, -200, -425].forEach(y => e.boltEnd(bx, y, 16));
    e.dim(bx + 50, 600, bx + 100, 600, 0.1, ' '); const p75 = e.P(bx + 100, 600); e.add({ t: 'line', a: p75, b: [p75[0] + 8, p75[1]], L: 'S-DIM' }); e.ptext(p75[0] + 5, p75[1] + 0.8, '75', 2, 'c', 'b', 'S-DIM'); e.line(bx + 50, 610, bx + 50, 200, 'S-DIM'); e.line(bx + 100, 610, bx + 100, 360, 'S-DIM');
    secMark(e, bx - 300, 800, bx - 300, -1700, 'A', 0);
    LY.title('ELEVATION', null);
    drgBox(LY);
    LY.caption('SHEETING/SPIKING RAIL SUPPORT DETAIL', 20, 'ABUTMENT N° X - XHS ONLY', { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Steel 100 PFC bracket coach-screwed to the wingwall sheeting to support a sagging timber spiking rail / capping.');

  // ================================================================== PN30-2301 … 2305 pier halfcap replacement / strengthening
  const SHIM380 = '130x(6,8,10 OR 12FL)x300 LONG\nGALV STEEL SHIM IF REQUIRED.\nTACK WELD STEEL SHIMS\nTOGETHER AFTER PLACEMENT.\nMAKE GOOD GALV. SURFACE\nBY APPLYING COLD GALV';
  const SHIM300 = 'GAP BETWEEN RECESS IN EXISTING\nPILE AND 300 PFC VARIES, PROVIDE\n100x(10 OR 20FL)x300 LONG GALV\nSTEEL SHIM PLATES AS REQUIRED.\nTACK WELD SHIM PLATES TOGETHER\nAFTER PLACEMENT. MAKE GOOD GALV\nSURFACE BY APPLYING COLD GALV.';
  const BEAR_NOTE = 'IF BEARING IS <70 THEN REFER TO "HALFCAP OR FULLCAP TO PILE BEARING DETAILS" ON DRG N° XX30-XXX';
  // DETAIL 1 (at pile) 1:10 for a 300 or 380 PFC: str = strengthening (existing timber halfcap over the PFC)
  function det1(LY, key, str) {
    const s = SEC[key], d = s.d, b = s.b, v = LY.view(10), sh = key === '380PFC' ? 10 : 20, sw = key === '380PFC' ? 130 : 100;
    cSec(v, 0, -d / 2, s, 1, 'S-NEW'); v.fill([[0, 0], [b, 0], [b, -s.tf], [0, -s.tf]], 'S-NEW'); v.fill([[0, -d], [b, -d], [b, -d + s.tf], [0, -d + s.tf]], 'S-NEW'); v.fill([[0, 0], [s.tw, 0], [s.tw, -d], [0, -d]], 'S-NEW');
    // pile, trimmed to a recess with a ledge under the channel
    const yl = -d - sh; v.pl([[-110, str ? 0 : 0], [-170, -80], [-180, -d * 0.5], [-150, -d - 60], [-60, -d - 110], [0, -d - 120]], false, 'S-EXIST'); v.line(-110, 0, 0, 0, 'S-EXIST');
    v.line(0, -d, 0, yl - 140, 'S-EXIST'); v.line(70, yl, 70, yl - 140, 'S-EXIST'); v.line(0, yl, 70, yl, 'S-EXIST');
    if (key === '380PFC' || str) { v.rect(0, yl, sw, sh, 'S-NEW'); v.hatch([[0, yl], [sw, yl], [sw, -d], [0, -d]], 'ansi31', 'S-HATCH', 0.5); }
    else { v.rect(0, yl, sw, sh, 'S-NEW'); v.line(0, yl + sh / 2, sw, yl + sh / 2, 'S-NEW'); v.hatch([[0, yl], [sw, yl], [sw, -d], [0, -d]], 'ansi31', 'S-HATCH', 0.5); }
    v.line(-140, -d * 0.36, 40, -d * 0.36, 'S-BOLT'); v.line(-140, -d * 0.36 - 8, 20, -d * 0.36 - 8, 'S-HIDDEN'); v.rect(s.tw, -d * 0.36 - 22, 6, 44, 'S-BOLT'); v.rect(s.tw + 6, -d * 0.36 - 15, 14, 30, 'S-BOLT');
    if (str) { v.rect(-60, 0, 300, 170, 'S-EXIST'); v.line(-60, 0, 240, 170, 'S-EXIST'); v.line(-60, 170, 240, 0, 'S-EXIST'); v.line(55, -50, 55, 200, 'S-BOLT'); v.line(65, -50, 65, 200, 'S-BOLT'); v.rect(35, -s.tf - 6, 50, 6, 'S-BOLT'); v.rect(40, -s.tf - 20, 40, 14, 'S-BOLT'); v.line(-60, 170, -110, 170, 'S-EXIST'); }
    // 70 minimum bearing
    v.line(0, yl - 20, 0, yl - 150, 'S-DIM'); v.line(70, yl - 20, 70, yl - 150, 'S-DIM'); v.dim(0, yl - 130, 70, yl - 130, 0.1, ' '); const pb = v.P(0, yl - 130);
    v.add({ t: 'line', a: [pb[0] - 42, pb[1]], b: pb, L: 'S-DIM' }); v.ptext(pb[0] - 40, pb[1] + 0.8, '70', 2.2, 'l', 'b'); v.add({ t: 'pl', p: [[pb[0] - 40.6, pb[1] + 0.3], [pb[0] - 36, pb[1] + 0.3], [pb[0] - 36, pb[1] + 3.6], [pb[0] - 40.6, pb[1] + 3.6]], closed: true, L: 'S-TEXT' }); v.ptext(pb[0] - 35, pb[1] + 0.8, 'MINIMUM BEARING', 2.2, 'l', 'b');
    nb(v, -48 * 10 + 0, yl - 150, BEAR_NOTE, 46);
    v.weld(b, -d + 4, 12, 26, { size: '4', site: true });
    const t = key === '380PFC' || str ? SHIM380 : SHIM300; v.dim(b + 160, -d, b + 160, yl, -1, ' '); v.line(b + 20, -d, b + 180, -d, 'S-DIM'); v.line(sw + 10, yl, b + 180, yl, 'S-DIM');
    v.leader(b + 160, -d + 60, 4, 0.1, t, { noArrow: true });
    if (key === '380PFC' || str) v.leader(70, yl, 8, -16, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED ' + (key === '380PFC' ? '380' : '300') + ' PFC' + (str ? '.' : ''));
    v.leader(-120, -60, -10, 10, 'EXISTING\nTIMBER PILE', { dot: true });
    LY.title('DETAIL 1', 10, (str ? '' : '(AT PILE)\n') + '[ ' + secName(key) + ' ]');
  }
  function bearingNotes(LY) {
    LY.block(B => { const h = nb(B, 0, 0, 'NOTE: IF HALFCAP CHANNEL IS SUPPORTED BY MORE THAN 2 PILES THEN DRG REQUIRES BOXED NOTE & PILE BEARING DETAILS PN30-2328 &/OR 2329', 56); nb(B, 0, -h - 6, 'ENGINEER TO DETERMINE IF 70 MINIMUM BEARING GIVES SUFFICIENT BEARING AREA FOR PILE DIAMETERS AND LOADINGS', 56); });
  }
  // stringer / corbel bracket 1:5 (plan + elevation)
  function bracket(LY) {
    const v = LY.view(5);
    // elevation: 75x75x10 EA (vertical leg trimmed) with a 125x75x10 UA at 45°
    v.pl([[0, 0], [200, 0], [200, 10], [0, 10]], true, 'S-NEW'); v.pl([[60, 10], [60, 75], [180, 75], [200, 55], [200, 10]], false, 'S-NEW');
    const c = Math.SQRT1_2; v.pl([[0, 5], [5 + 125 * c, 5 + 125 * c], [5 + 125 * c + 10 * c, 5 + 125 * c - 10 * c], [10 * c + 10, 5 - 10 * c + 10]], true, 'S-NEW'); v.pl([[15, 10], [15 + 75 * c, 10 + 75 * c], [15 + 75 * c + 75 * c, 10 + 75 * c - 75 * c + 0]], false, 'S-NEW');
    v.line(35, 0, 35, -20, 'S-DIM'); v.line(165, 0, 165, -20, 'S-DIM'); v.dim(35, -40, 165, -40, -1, '130'); v.dim(0, -40, 35, -40, -1, '35'); v.dim(0, -80, 200, -80, -1, '200'); v.dim(-25, -5, -25, 0, 0.1, ' '); v.ptext(v.P(-25, 0)[0] - 3, v.P(0, -3)[1], '5', 2, 'r', 'm', 'S-DIM');
    v.arc(0, 5, 60, 0, 45, 'S-DIM'); v.text(70, 30, '45°', 2, 'l', 'm', 'S-DIM'); v.dim(5 + 125 * c - 10 * c, 5 + 125 * c + 10 * c, 5 + 125 * c, 5 + 125 * c, 5, '5');
    v.weld(150, 30, 10, 12, { size: '6', all: true }); v.leader(110, 110, 14, 16, '125x75x10UA'); v.leader(195, 60, 14, 2, '20 x 20\nCHAMFER'); v.leader(200, 5, 14, -14, '75x75x10 EA\nTRIM VERTICAL\nLEG TO SUIT');
    LY.title('ELEVATION', null);
    const w = LY.view(5);
    w.rect(0, 0, 200, 100, 'S-NEW'); w.line(10, 0, 10, 100, 'S-HIDDEN'); w.line(60, 0, 60, 100, 'S-HIDDEN'); w.line(170, 0, 170, 100, 'S-HIDDEN');
    w.rect(0, 100, 150, 75, 'S-NEW'); [37.5, 112.5].forEach(x => w.boltEnd(x, 137.5, 22)); w.line(10, 137.5, 140, 137.5, 'S-CL');
    w.pl([[20, 30], [20, 70], [31, 81], [42, 70], [42, 30], [31, 19]], true, 'S-NEW'); w.line(31, 10, 31, 90, 'S-CL');
    w.dim(-40, 0, -40, 100, 4, '100'); w.dim(-15, 25, -15, 75, 4, '50'); w.dim(-15, 100, -15, 175, 4, '25'); w.dim(190, 100, 190, 175, -4, '75'); w.dim(220, 100, 220, 137.5, -2, '='); w.dim(220, 137.5, 220, 175, -2, '=');
    w.leader(112.5, 137.5, 12, 14, 'φ22 HOLE (TYP)'); w.leader(31, 30, 10, -16, 'φ22 x 50 LONG\nSLOTTED HOLE');
    LY.title('PLAN', null);
  }
  // pier elevation pieces (1:20): decking, stringers on corbels, piles; y = 0 top of the halfcap
  function stringersE(v, x0, x1, ns, y0) { const xs = Array.from({ length: ns }, (_, i) => x0 + 250 + i * (x1 - x0 - 500) / max(1, ns - 1)); v.rect(x0 - 100, y0 + 650, x1 - x0 + 200, 100, 'S-EXIST'); v.brk(x0 - 100, y0 + 640, x0 - 100, y0 + 760); v.brk(x1 + 100, y0 + 640, x1 + 100, y0 + 760);
    xs.forEach(x => { v.circ(x, y0 + 470, 175, 'S-EXIST'); v.circ(x, y0 + 160, 160, 'S-EXIST'); }); return xs; }

  def('phr', 'Halfcaps', 'Pier halfcap replacement (PFC) – both sides / one side', 'PN30-2301 / 2302', [P('pfc', 'Replacement PFC', '300PFC', { opts: ['300PFC', '380PFC'] }), P('piles', 'Pile spacings (mm, comma)', '1800', {}), P('ns', 'Number of stringers', 3, { num: 1 }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('side', 'Halfcaps replaced', 'BOTH SIDES (2301)', { opts: ['BOTH SIDES (2301)', 'ONE SIDE (2302)'] })], (p) => {
    const LY = new Lay(700), s = SEC[p.pfc] || SEC['300PFC'], D = +p.D || 380, ns = max(2, min(8, Math.round(+p.ns || 3))), one = /ONE/.test(p.side || '');
    const sp = String(p.piles).split(/[ ,;]+/).map(Number).filter(x => x > 0); const xp = [0]; (sp.length ? sp : [1800]).forEach(d => xp.push(xp[xp.length - 1] + d));
    det1(LY, '380PFC', false); det1(LY, '300PFC', false); bearingNotes(LY); bracket(LY); LY.block(B => B.mainTitle(60, 0, 'STRINGER/CORBEL BRACKET DETAILS', 5, '2 - BRACKETS REQUIRED PER STRINGER OR\nCORBEL CONNECTION :-\n1 - AS DRAWN\n1 - OPPOSITE HAND'));
    LY.break();
    // ---- VIEW A 1:20 (looking along the halfcap) — x = 0 pile centre, y = 0 top of halfcap
    const a = LY.view(20), d = s.d, b = s.b, g = D / 2 - 30;
    a.line(-D / 2, -d - 600, -D / 2, -d - 20, 'S-EXIST'); a.line(D / 2, -d - 600, D / 2, -d - 20, 'S-EXIST'); a.pileEnd(0, -d - 600, D, 'S-EXIST'); a.rect(-D / 2, -d - 50, D, 30, 'S-NEW');
    const sides = one ? [1] : [-1, 1];
    sides.forEach(k => { cSec(a, k * g, -d / 2, s, k, 'S-NEW'); timberX(a, k > 0 ? 0 : -g, -d, g, d - 10); a.fill([[k * g + k * s.tw, -d], [k * (g + b), -d], [k * (g + b), -d - 15], [k * g + k * s.tw, -d - 15]], 'S-NEW'); });
    if (one) { a.rect(-g - 300, -d, 300, d, 'S-EXIST'); a.line(-g - 300, -d, -g, 0, 'S-EXIST'); a.line(-g - 300, 0, -g, -d, 'S-EXIST'); timberX(a, -g, -d, g, d - 10); }
    rod(a, -g - (one ? 330 : b + 30), -d * 0.6, g + b + 30, -d * 0.6, 65);
    // corbel, stringers, decking
    a.pl([[-700, 30], [-650, 230], [650, 230], [700, 30], [600, -40], [-600, -40]], true, 'S-EXIST'); a.line(-1100, 230, 1100, 230, 'S-EXIST'); [-1, 1].forEach(k => { a.arc(k * 1100, 400, 170, k > 0 ? 270 : 90, k > 0 ? 90 : 270, 'S-EXIST'); }); a.line(-1100, 570, 1100, 570, 'S-EXIST'); a.line(0, 230, 0, 570, 'S-EXIST'); a.line(20, 230, 20, 570, 'S-EXIST');
    a.rect(-1150, 570, 2300, 120, 'S-EXIST'); for (let x = -1050; x < 1150; x += 180) a.line(x, 570, x, 690, 'S-EXIST'); a.brk(-1150, 560, -1150, 700); a.brk(1150, 560, 1150, 700);
    // brackets
    sides.forEach(k => { [[k * (g + 60), 0], [k * (g + 60), 130]].forEach(([x, y], i) => { a.rect(x - 40, y + 5, 80, 60, 'S-NEW'); a.boltEnd(x, y + 35, 20); }); });
    a.circ(g + b / 2 + 20, -d * 0.45, 260, 'S-TEXT'); const pc = a.P(g + b + 320, -d * 0.6); a.add({ t: 'circle', c: pc, r: 3, L: 'S-TEXT' }); a.add({ t: 'text', p: pc, s: '1', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' });
    a.dim(20, 470, 20 + 55 * 2, 470, 0.1, ' '); const p55 = a.P(130, 470); a.ptext(p55[0] + 3, p55[1] + 0.8, '55', 2, 'l', 'b', 'S-DIM'); a.ptext(p55[0] + 1, p55[1] - 0.8, '(TYP)', 2, 'l', 't', 'S-DIM');
    a.leader(-500, 600, -12, 14, 'EXISTING TIMBER\nSTRINGER'); a.leader(-640, 150, -14, 4, 'EXISTING TIMBER\nCORBEL'); a.leaders([[g + 60, 200], [g + 100, 50]], 30, 2, 'NOTCH CORBEL\nTO SUIT (TYP)');
    a.leader(-(g + 40), 30, -26, -6, 'STRINGER/CORBEL BRACKET FIXED\nTO CORBELS WITH φ20 THREADED\nROD WITH 65x5FLx65 WASHER TO\nTIMBER FACE AND FIXED TO PFC\nHALFCAP WITH 2 - M20 BOLTS IN\nSITE DRILLED φ22 HOLES (TYP)');
    a.leader(-g, -d + 40, -24, -40, one ? 'REMOVE EXISTING TIMBER\nHALFCAP ONLY AFTER\nPROPPING STRINGERS &\nCORBELS' : 'REMOVE EXISTING TIMBER HALFCAPS\nONLY AFTER PROPPING STRINGERS\n& CORBELS'); if (one) a.leader(-g - 330, -d * 0.6, -10, -20, 'φ20 THREADED ROD\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP)');
    LY.title('VIEW A', 20);
    // ---- ELEVATION 1:20
    const e = LY.view(20), X0 = -700, X1 = xp[xp.length - 1] + 700;
    pfcElevH(e, X0, X1, 0, s, 'S-NEW', true); e.brk(X1, 20, X1, -d - 20);
    const xs = stringersE(e, X0, X1, ns, 0);
    xs.forEach(x => { [-110, 110].forEach(o => { e.pl([[x + o - 60, 0], [x + o - 60, 50], [x + o + 60, 50], [x + o + 60, 0]], false, 'S-NEW'); e.circ(x + o - 30, 25, 12, 'S-BOLT'); e.circ(x + o + 30, 25, 12, 'S-BOLT'); }); e.line(x - 110, 50, x + 110, 300, 'S-HIDDEN'); e.line(x + 110, 50, x - 110, 300, 'S-HIDDEN'); });
    xp.forEach(x => { e.line(x - D / 2, -d - 900, x - D / 2, -d - 20, 'S-EXIST'); e.line(x + D / 2, -d - 900, x + D / 2, -d - 20, 'S-EXIST'); e.pileEnd(x, -d - 900, D, 'S-EXIST'); e.rect(x - 150, -d - 20, 300, 20, 'S-NEW'); e.hatch([[x - 150, -d - 20], [x + 150, -d - 20], [x + 150, -d], [x - 150, -d]], 'ansi31', 'S-HATCH', 0.4); e.line(x - D / 2, -d + 60, x - D / 2 + 30, -d + 30, 'S-EXIST'); });
    e.dim(xp[0] - 150, -d - 250, xp[0] + 150, -d - 250, 0.1, '300'); e.line(xp[0] - 150, -d - 260, xp[0] - 150, -d - 25, 'S-DIM'); e.line(xp[0] + 150, -d - 260, xp[0] + 150, -d - 25, 'S-DIM');
    for (let i = 0; i + 1 < xp.length; i++) e.dim(xp[i], -d - 1000, xp[i + 1], -d - 1000, -6, String(xp[i + 1] - xp[i]));
    e.mark(X0 - 350, 300, 'A', 0);
    // existing steel pile alternative (boxed)
    const sx = X1 + 900; e.rect(sx - 400, 0, 800, -d, 'S-NEW'); e.line(sx - 400, -s.tf, sx + 400, -s.tf, 'S-HIDDEN'); e.brk(sx - 400, 20, sx - 400, -d - 20); e.brk(sx + 400, 20, sx + 400, -d - 20);
    e.line(sx - 100, -d, sx - 100, -d - 900, 'S-EXIST'); e.line(sx + 100, -d, sx + 100, -d - 900, 'S-EXIST'); e.line(sx - 90, -d, sx - 90, -d - 900, 'S-EXIST'); e.brk(sx - 140, -d - 900, sx + 140, -d - 900, 'S-EXIST'); e.rect(sx - 30, -d + 20, 60, d - 40, 'S-HIDDEN'); [-d * 0.3, -d * 0.7].forEach(y => e.boltEnd(sx, y, 20));
    const bp = e.P(sx - 560, 450), bq = e.P(sx + 1750, -d - 1050); e.add({ t: 'pl', p: [bp, [bq[0], bp[1]], bq, [bp[0], bq[1]]], closed: true, L: 'S-NOTE' });
    e.leader(sx, -d * 0.3, 16, 30, 'DRILL HOLES ON SITE TO\nSUIT EXISTING HALFCAP\nCONNECTION, PROVIDE ' + (one ? 'THREADED RODS.' : 'M20\nBOLTS.')); e.leader(sx + 30, -d * 0.4, 16, 8, 'EXISTING\nHALFCAP\nCONNECTION'); e.leaders([[sx + 30, -d * 0.6], [sx + 100, -d - 60]], 16, -10, 'PROVIDE STEEL\nPACKERS TO\nSUIT'); e.leader(sx + 100, -d - 500, 16, -4, 'EXISTING STEEL\nPILE');
    nb(e, sx + 300, 750, 'REMOVE IF ALL PILES\nARE TIMBER', 40);
    e.leader(X0 + 400, -d, -10, -16, '[' + secName(p.pfc).replace(' PFC', '') + '] PFC HALFCAP\nREPLACEMENT'); e.leader(xp[0] + 100, -d - 20, 18, -14, 'SHIM PLATES'); nb(e, xp[0] + 100 + 20 * 18 + 40, -d - 20 - 300, 'BEARING PLATES FOR\nHALFCAPS WITH\nBEARING < 70', 36);
    LY.title('ELEVATION', null);
    LY.break();
    LY.block(B => { nb(B, 0, 0, 'NOTE: HALFCAP CHANNELS WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS\n300 PFC HALFCAP DRAWN', 66); });
    LY.block(B => { nb(B, 0, 0, 'SUBJECT TO CORBEL CONDITION REFER ENGINEER', 66); });
    drgBox(LY);
    LY.caption('PIER HALFCAP' + (one ? '' : 'S') + ' REPLACEMENT DETAIL', 20, one ? 'PIER N° X - ABUTMENT N° 1 SIDE\nPIER N° X - ABUTMENT N° 2 SIDE' : 'PIER N° X', { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Replace decayed pier timber halfcaps with steel PFC halfcaps (both sides, PN30-2301, or the abutment side only, PN30-2302) with stringer / corbel brackets.');

  // ---------------- halfcap strengthening (PN30-2303 / 2304 / 2304A / 2305)
  const STR_NOTE1 = 'NOTE: HALFCAP STRENGTHENING CHANNELS WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS.\n300 PFC HALFCAP DRAWN. THIS DETAIL IS ONLY TO BE USED WHERE THERE IS NO SIGNIFICANT PERMANENT BOWING OR CRUSHING IN THE UNDERSIDE OF THE EXISTING TIMBER HALFCAP. (ENGINEER TO DETERMINE)';
  const STR_NOTE2 = 'NOTE: PROP STRINGERS & CORBELS PRIOR TO INSTALLING HALFCAPS STRENGTHENING. INSTALL HALFCAPS STRENGTHENING BY JACKING AGAINST TIMBER HALFCAP TO REMOVE ALL BOWS, DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT TO THE EXISTING TIMBER HALFCAP.';
  const STR_NOTE3 = 'NOTE: RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED HALFCAP REPAIRS';
  const pilesOf = (p) => { const sp = String(p.piles || '').split(/[ ,;]+/).map(Number).filter(x => x > 0), xp = [0]; (sp.length ? sp : [1800]).forEach(d => xp.push(xp[xp.length - 1] + d)); return xp; };
  // strengthening elevation (1:20), y = 0 underside of the existing halfcap / top of the PFC
  function strElev(LY, p, o) {
    const e = LY.view(20), s = SEC[p.pfc] || SEC['300PFC'], d = s.d, D = +p.D || 380, xp = pilesOf(p), X0 = -900, X1 = xp[xp.length - 1] + 900, ns = max(2, min(8, Math.round(+p.ns || 3)));
    e.rect(X0, 0, X1 - X0, 250, 'S-EXIST'); e.brk(X0, -20, X0, 270); e.brk(X1, -20, X1, 270); pfcElevH(e, X0 + 40, X1 - 40, 0, s, 'S-NEW', true); e.brk(X1 - 40, 20, X1 - 40, -d - 20); e.brk(X0 + 40, 20, X0 + 40, -d - 20);
    const xs = Array.from({ length: ns }, (_, i) => X0 + 500 + i * (X1 - X0 - 1000) / max(1, ns - 1));
    xs.forEach(x => { e.circ(x, 400, 150, 'S-EXIST'); e.circ(x, 725, 175, 'S-EXIST'); e.line(x - 6, -15, x - 6, 900, 'S-HIDDEN'); e.line(x + 6, -15, x + 6, 900, 'S-HIDDEN'); e.rect(x - 25, -12, 50, 12, 'S-EXIST'); });
    e.rect(X0 + 100, 900, X1 - X0 - 200, 90, 'S-EXIST'); e.brk(X0 + 100, 880, X0 + 100, 1010); e.brk(X1 - 100, 880, X1 - 100, 1010);
    // vertical rods at 900 crs max between the stringers
    const rods = []; for (let x = X0 + 200; x < X1 - 150; x += 450) { if (xs.some(q => abs(q - x) < 230) || xp.some(q => abs(q - x) < D / 2 + 60)) continue; rods.push(x); }
    rods.forEach(x => { e.line(x, -d - 30, x, 290, 'S-BOLT'); e.rect(x - 32, 250, 64, 6, 'S-BOLT'); e.rect(x - 32, -d - 6, 64, 6, 'S-BOLT'); e.rect(x - 15, 256, 30, 25, 'S-BOLT'); e.rect(x - 15, -d - 31, 30, 25, 'S-BOLT'); });
    // piles
    xp.forEach(x => { if (o.uc) { const u = SEC['200UC52']; e.line(x - u.b / 2, -d - 1100, x - u.b / 2, -d - 120, 'S-EXIST'); e.line(x + u.b / 2, -d - 1100, x + u.b / 2, -d - 120, 'S-EXIST'); e.line(x, -d - 1100, x, -d - 120, 'S-EXIST'); e.brk(x - u.b / 2 - 30, -d - 1100, x + u.b / 2 + 30, -d - 1100); iSec(e, x, -d - 70, { d: 100, b: u.b, tf: u.tf, tw: u.tw }, 0, 'S-NEW'); e.rect(x - 40, -d - 20, 80, 20, 'S-NEW'); [-d * 0.35, -d * 0.7].forEach(y => e.boltEnd(x, y, 20)); }
      else { e.line(x - D / 2, -d - 1000, x - D / 2, -d - 40, 'S-EXIST'); e.line(x + D / 2, -d - 1000, x + D / 2, -d - 40, 'S-EXIST'); e.pileEnd(x, -d - 1000, D, 'S-EXIST'); e.line(x - D / 2 + 25, -d - 40, x - D / 2 + 25, 200, 'S-HIDDEN'); e.line(x + D / 2 - 25, -d - 40, x + D / 2 - 25, 200, 'S-HIDDEN'); e.line(x - D / 2 + 25, 200, x + D / 2 - 25, 200, 'S-HIDDEN'); e.rect(x - 150, -d - 40, 300, 40, 'S-NEW'); e.line(x - 150, -d - 20, x + 150, -d - 20, 'S-NEW'); e.line(x, -d - 1000, x, 260, 'S-CL'); [x - D / 2 + 25, x + D / 2 - 25].forEach(q => e.circ(q, -d / 2, 14, 'S-BOLT')); } });
    // dims / marks
    const x0 = xp[0], x1 = xp[min(1, xp.length - 1)];
    if (o.uc) { e.dim(x0 + 180, -d, x0 + 180, -d - 50, -1, '50', { sub: '(TYP)' }); }
    else { e.dim(x0 + D / 2 - 25, -d - 300, x0 + D / 2, -d - 300, 0.1, ' '); const pn = e.P(x0 + D / 2, -d - 300); e.add({ t: 'line', a: pn, b: [pn[0] + 14, pn[1]], L: 'S-DIM' }); e.ptext(pn[0] + 7, pn[1] + 0.8, '25 NOTCH', 2, 'c', 'b', 'S-DIM'); e.ptext(pn[0] + 7, pn[1] - 0.8, '(TYP)', 2, 'c', 't', 'S-DIM');
      e.dim(x1 - 150, -d - 200, x1 + 150, -d - 200, 0.1, '300', { sub: '(TYP)' }); e.line(x1 - 150, -d - 210, x1 - 150, -d - 45, 'S-DIM'); e.line(x1 + 150, -d - 210, x1 + 150, -d - 45, 'S-DIM'); }
    const mx = (xs[0] + xs[1]) / 2; e.mark(xs[0] + 300, 640, 'A', 0); e.line(xs[0] + 300, 580, xs[0] + 300, 500, 'S-TITLE'); 
    if (o.abc) { e.mark(mx, 640, 'B', 0); e.mark(xs[ns - 1] - 250, 640, 'C', 0); }
    // labels
    e.leader(xs[0] + 60, 860, 0, 18, 'EXISTING TIMBER\nSTRINGER (TYP)', { dot: true }); e.leader(X0 + 1300, 990, 10, 14, 'EXISTING TIMBER\nDECKING'); e.leader(xs[0] - 140, 450, -16, 8, 'EXISTING TIMBER\nCORBEL (TYP)'); e.leader(X0 + 200, 250, -16, 6, 'EXISTING TIMBER\nHALFCAP');
    if (o.abc) e.leader(rods[0] || X0 + 300, 280, -4, 62, '1 - φ20 THREADED\nROD PER SPAN WITH\n65x5FLx65 WASHER\nTO TIMBER FACE (TYP)'); else e.leader(rods[rods.length - 1] || X1 - 300, 280, 16, 24, 'φ20 THREADED RODS\nAT 900 CRS MAXIMUM\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP)');
    e.leader(X0 + 600, -d, -12, -16, 'PROPOSED [' + secName(p.pfc).replace(' PFC', '') + '] PFC\nHALFCAP\nSTRENGTHENING');
    if (o.uc) e.leader(xp[xp.length - 1] + 100, -d - 600, 16, 0, 'EXISTING UC\nPILE (TYP)');
    else { e.leader(x0 + D / 2, -d - 600, 12, 0, 'EXISTING TIMBER\nPILE (TYP)'); e.leader(x1 + 150, -d - 20, 16, -12, 'SHIM PLATES'); const sp = e.P(x1 + 150, -d - 20); e.add({ t: 'pl', p: [[sp[0] + 18, sp[1] - 13.2], [sp[0] + 58, sp[1] - 13.2], [sp[0] + 58, sp[1] - 24.6], [sp[0] + 18, sp[1] - 24.6]], closed: true, L: 'S-NOTE' }); ['BEARING PLATES FOR', 'HALFCAPS WITH', 'BEARING < 70'].forEach((t, i) => e.ptext(sp[0] + 19.5, sp[1] - 16.2 - i * 3.4, t, 2.2)); }
    e.leader(xs[ns - 1] - 25, -12, o.abc ? 4 : 2, -48, o.abc ? 'SHORTEN EXISTING BOLT TO\nCLEAR PROPOSED HALFCAP\nSTRENGTHENING. (TYP)' : 'RECESS EXISTING TIMBER HALFCAP' + (o.uc ? ' AND\nSHORTEN EXISTING BOLT TO CLEAR\nPROPOSED HALFCAP STRENGTHENING.\nPROVIDE NEW 65x5FLx65 WASHER\nAND TIGHTEN BOLT. (TYP)' : '\nAND SHORTEN EXISTING BOLT TO CLEAR\nPROPOSED HALFCAP STRENGTHENING.\nPROVIDE NEW 65x5FLx65 WASHER\nAND TIGHTEN BOLT. (TYP)'));
    if (o.abc) e.leader(xs[0] + 120, -5, -30, -52, 'ENSURE 200 MIN BEARING\nDIRECTLY UNDER STRINGERS.\nIF REQUIRED INSTALL STEEL\nSHIMS SIMILAR TO DETAIL 1\nABOVE (TYP).');
    LY.title('ELEVATION', null);
    return { e, s, d, D };
  }
  // strengthening cross-section (SECTION A) 1:20 — x = 0 pile centre, y = 0 top of the PFC (underside of the existing halfcaps)
  function strSec(LY, p, mode, title) {
    const v = LY.view(20), s = SEC[p.pfc] || SEC['300PFC'], d = s.d, b = s.b, D = +p.D || 380, hw = 200, hh = 300, gx = mode === 'uc' ? 103 : D / 2 - 25, both = mode !== 'u';
    const hcx = k => k * (gx + (mode === 'uc' ? 40 : 60)); // existing halfcap centre
    [-1, 1].forEach(k => { timberX(v, hcx(k) - hw / 2, 0, hw, hh); });
    if (mode === 'uc') { const u = SEC['200UC52']; [-1, 1].forEach(k => { v.line(k * u.d / 2, -d - 900, k * u.d / 2, hh - 20, 'S-EXIST'); v.line(k * (u.d / 2 - u.tf), -d - 900, k * (u.d / 2 - u.tf), hh - 20, 'S-EXIST'); }); v.line(-u.d / 2, hh - 20, u.d / 2, hh - 20, 'S-EXIST'); v.brk(-u.d / 2 - 30, -d - 900, u.d / 2 + 30, -d - 900);
      [-1, 1].forEach(k => { const x0 = min(k * u.d / 2, k * (u.d / 2 + 100)); v.rect(x0, -d - 230, 100, 200, 'S-NEW'); v.line(x0 + 12, -d - 230, x0 + 12, -d - 30, 'S-NEW'); v.line(x0 + 88, -d - 230, x0 + 88, -d - 30, 'S-NEW'); v.rect(k > 0 ? gx : -gx - b, -d - 30, b, 30, 'S-NEW'); v.hatch([[k > 0 ? gx : -gx - b, -d - 30], [k > 0 ? gx + b : -gx, -d - 30], [k > 0 ? gx + b : -gx, -d], [k > 0 ? gx : -gx - b, -d]], 'ansi31', 'S-HATCH', 0.4); });
      v.weld(u.d / 2 + 100, -d - 30, 26, -10, { site: true, other: true, tail: 'TYP' }); v.weld(u.d / 2 + 100, -d - 120, 26, -18, { size: '6', both: true, site: true, tail: 'TYP' }); v.weld(u.d / 2, -d - 225, 26, -26, { site: true, tail: 'TYP' });
    } else { v.line(-D / 2, -d - 900, -D / 2, -40, 'S-EXIST'); v.line(D / 2, -d - 900, D / 2, -40, 'S-EXIST'); v.pileEnd(0, -d - 900, D, 'S-EXIST'); v.line(-D / 2, -d - 40, D / 2, -d - 40, 'S-NEW'); v.line(-D / 2, -d - 20, D / 2, -d - 20, 'S-NEW'); v.line(-D / 2, -40, D / 2, -40, 'S-EXIST'); v.line(0, -d - 950, 0, hh + 200, 'S-CL'); v.text(0, hh + 230, '℄ PILE', 2.2, 'c', 'b'); }
    const ks = both ? [-1, 1] : [1];
    ks.forEach(k => { cSec(v, k * gx, -d / 2, s, k, 'S-NEW'); v.line(hcx(k) + k * 0, -d - 40, hcx(k), hh + 60, 'S-BOLT'); v.rect(hcx(k) - 32, hh, 64, 6, 'S-BOLT'); v.rect(hcx(k) - 15, hh + 6, 30, 25, 'S-BOLT'); v.rect(hcx(k) - 32, -d - 6, 64, 6, 'S-BOLT'); v.rect(hcx(k) - 15, -d - 31, 30, 25, 'S-BOLT'); });
    if (mode === 'u') { v.pl([[gx + s.tw + 25, -d * 0.45], [-D / 2 - 40, -d * 0.45]], false, 'S-BOLT'); v.arc(-D / 2 - 40, -d * 0.45 + 40, 40, 90, 270, 'S-BOLT'); v.line(-D / 2 - 40, -d * 0.45 + 80, gx + s.tw + 25, -d * 0.45 + 80, 'S-HIDDEN'); v.nut(gx + s.tw, -d * 0.45, 1, 0, 18); v.circ(gx + b / 2 + 30, -d / 2, 190, 'S-TEXT'); }
    else if (mode !== 'uc') { rod(v, -gx - s.tw, -d / 2, gx + s.tw, -d / 2, 65); v.circ(gx + b / 2, -d / 2, 200, 'S-TEXT'); }
    else { [-1, 1].forEach(k => { v.line(k * 30, -d * 0.4, k * (gx + 30), -d * 0.4, 'S-BOLT'); v.line(k * 30, -d * 0.7, k * (gx + 30), -d * 0.7, 'S-BOLT'); }); }
    if (mode !== 'uc') { const pc = v.P(gx + b + 200, -d - 220); v.add({ t: 'circle', c: pc, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p: pc, s: '1', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); const q = v.P(gx + b + 120, -d / 2 - 140); v.add({ t: 'line', a: [pc[0] - 2.2, pc[1] + 2], b: q, L: 'S-TEXT' }); }
    // dims
    const hx = hcx(1) - hw / 2; v.dim(hx - 50, hh + 120, hx, hh + 120, 0.1, ' '); const p5 = v.P(hx, hh + 120); v.add({ t: 'line', a: p5, b: [p5[0] + 8, p5[1]], L: 'S-DIM' }); v.ptext(p5[0] + 5, p5[1] + 0.8, '50', 2, 'c', 'b', 'S-DIM'); v.ptext(p5[0] + 5, p5[1] - 0.8, 'MIN', 2, 'c', 't', 'S-DIM'); v.line(hx - 50, hh + 130, hx - 50, hh, 'S-DIM'); v.line(hx, hh + 130, hx, hh + 10, 'S-DIM');
    const pb = v.P(hcx(1) + hw / 2 + 10, hh * 0.45); v.add({ t: 'line', a: [pb[0], pb[1] + 1], b: [pb[0] + 6, pb[1] + 1], L: 'S-DIM' }); v.add({ t: 'pl', p: [[pb[0] + 6, pb[1] - 1], [pb[0] + 11, pb[1] - 1], [pb[0] + 11, pb[1] + 3], [pb[0] + 6, pb[1] + 3]], closed: true, L: 'S-TEXT' }); v.ptext(pb[0] + 6.5, pb[1] - 0.3, '55', 2, 'l', 'b', 'S-DIM');
    v.add({ t: 'line', a: [pb[0] + 11, pb[1] + 1], b: [pb[0] + 15, pb[1] + 1], L: 'S-DIM' }); v.add({ t: 'pl', p: [[pb[0] + 15, pb[1] - 3.5], [pb[0] + 36, pb[1] - 3.5], [pb[0] + 36, pb[1] + 5.4], [pb[0] + 15, pb[1] + 5.4]], closed: true, L: 'S-NOTE' }); v.ptext(pb[0] + 16, pb[1] + 1.6, '55 - 300 PFC', 2.2); v.ptext(pb[0] + 16, pb[1] - 2.4, '60 - 380 PFC', 2.2);
    // labels
    if (mode !== 'uc') v.leader(hcx(-1) - hw / 2, hh, -16, 6, 'EXISTING TIMBER\nHALFCAP (TYP)'); v.leader(hcx(1), hh + 40, 18, 22, 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE' + (mode === 'uc' ? '. (TYP)' : ''));
    if (mode === 'u') { v.leader(-D / 2 - 20, -d * 0.45, -16, 4, "'U'-THREADED\nROD"); v.leader(gx + b, -d * 0.2, 18, -8, 'PROPOSED PFC\nHALFCAP\nSTRENGTHENING'); v.leader(-D / 2, -d - 500, -14, 0, 'EXISTING TIMBER\nPILE'); }
    else if (mode === 'uc') { const col = v.P(-gx - b - 260, 0)[0], row = (x, y, ry, t, o) => { const q = v.P(x, y); v.leader(x, y, col - q[0], v.P(0, ry)[1] - q[1], t, o); };
      row(-30, hh * 0.6, hh + 380, 'PROVIDE STEEL\nPACKERS AS\nREQUIRED (TYP)'); row(hcx(-1) - 100, hh * 0.8, hh + 50, 'EXISTING TIMBER\nHALFCAP (TYP)'); row(-gx, -40, -150, 'TRIM EXISTING UC\nBRACKET TO FACE\nOF EXISTING UC PILE\n(TYP)'); row(-gx - 20, -d * 0.7, -d - 140, 'M20 BOLTS (TYP)');
      row(-SEC['200UC52'].d / 2 - 50, -d - 150, -d - 300, 'SUPPORT BRACKET\n200 UC 52 x 100 LONG', { dot: true }); row(-SEC['200UC52'].d / 2, -d - 600, -d - 560, 'EXISTING UC PILE'); v.leader(gx + b, -10, 14, -8, 'PROPOSED PFC\nHALFCAP STRENGTHENING'); }
    else { v.leader(-gx - b, -d * 0.3, -16, -2, 'PROPOSED PFC HALFCAP\nSTRENGTHENING (TYP)'); v.leader(-gx - s.tw - 40, -d / 2 - 30, -16, -12, 'THREADED ROD'); v.leader(D / 2, -d - 500, 12, 0, 'EXISTING TIMBER\nPILE'); }
    LY.title(title || 'SECTION A', 20);
  }
  function strNotes(LY) { LY.block(B => { nb(B, 0, 0, STR_NOTE1, 80); }); LY.block(B => { nb(B, 0, 0, STR_NOTE2, 76, { solid: true }); }); LY.block(B => { nb(B, 0, 0, STR_NOTE3, 64, { solid: true }); }); }

  def('pn2303', 'Halfcaps', 'Pier halfcap strengthening – PFC beside timber halfcaps (rod through / U-rod)', 'PN30-2303 / 2304', [P('pfc', 'Strengthening PFC', '300PFC', { opts: ['300PFC', '380PFC'] }), P('piles', 'Pile spacings (mm, comma)', '1800', {}), P('ns', 'Number of stringers', 3, { num: 1 }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('rod', 'Connection at pile', 'THROUGH PILE (2303)', { opts: ['THROUGH PILE (2303)', 'U-ROD AROUND PILE (2304)'] })], (p) => {
    const LY = new Lay(700), u = /U-ROD/.test(p.rod || '');
    det1(LY, '380PFC', true); det1(LY, '300PFC', true); bearingNotes(LY);
    LY.break();
    strSec(LY, p, u ? 'u' : 'thru'); strElev(LY, p, {});
    LY.break(); strNotes(LY); drgBox(LY);
    LY.caption(u ? 'PIER HALFCAP STRENGTHENING DETAIL' : 'PIER HALFCAPS STRENGTHENING DETAIL', 20, 'PIER N° X', { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Strengthen sound but under-capacity pier timber halfcaps with PFCs jacked up under them and rodded through (PN30-2303) or with a U-rod round the pile (PN30-2304).');

  def('pn2304a', 'Halfcaps', 'Pier halfcap strengthening – with stringer / corbel angle supports', 'PN30-2304A', [P('pfc', 'Strengthening PFC', '300PFC', { opts: ['300PFC', '380PFC'] }), P('piles', 'Pile spacings (mm, comma)', '1800', {}), P('ns', 'Number of stringers', 3, { num: 1 }), P('D', 'Pile dia. (mm)', 380, { num: 1 })], (p) => {
    const LY = new Lay(760), s = SEC[p.pfc] || SEC['300PFC'], d = s.d, b = s.b, D = +p.D || 380;
    det1(LY, '380PFC', true); det1(LY, '300PFC', true); bearingNotes(LY);
    LY.break();
    strSec(LY, p, 'u');
    // SECTION B (between piles)
    const v = LY.view(20), gx = 60; [-1, 1].forEach(k => timberX(v, k * (gx + 60) - 100, 0, 200, 300)); cSec(v, gx, -d / 2, s, 1, 'S-NEW'); v.line(gx + 60, -d - 40, gx + 60, 360, 'S-BOLT'); v.rect(gx + 28, 300, 64, 6, 'S-BOLT'); v.rect(gx + 28, -d - 6, 64, 6, 'S-BOLT');
    const hx = gx + 60 - 100; v.dim(hx - 50, 420, hx, 420, 0.1, ' '); const p5 = v.P(hx, 420); v.add({ t: 'line', a: p5, b: [p5[0] + 8, p5[1]], L: 'S-DIM' }); v.ptext(p5[0] + 5, p5[1] + 0.8, '50', 2, 'c', 'b', 'S-DIM'); v.ptext(p5[0] + 5, p5[1] - 0.8, 'MIN', 2, 'c', 't', 'S-DIM');
    const pb = v.P(-200, 150); v.add({ t: 'pl', p: [[pb[0] - 26, pb[1] - 3.5], [pb[0] - 5, pb[1] - 3.5], [pb[0] - 5, pb[1] + 5.4], [pb[0] - 26, pb[1] + 5.4]], closed: true, L: 'S-NOTE' }); v.ptext(pb[0] - 25, pb[1] + 1.6, '55 - 300 PFC', 2.2); v.ptext(pb[0] - 25, pb[1] - 2.4, '60 - 380 PFC', 2.2); v.ptext(v.P(gx - 20, 150)[0], pb[1] - 0.3, '55', 2, 'r', 'b', 'S-DIM');
    v.leader(gx + 60, 330, 18, 10, 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE'); v.leader(gx, -d * 0.8, 16, -12, 'PROPOSED PFC\nHALFCAP\nSTRENGTHENING');
    LY.title('SECTION B', 20);
    // SECTION C (at a stringer / corbel: 75x75x10 EA support)
    const c = LY.view(20), cy = 300; timberX(c, -100, 0, 200, 300); c.pl([[-450, cy + 40], [-350, cy], [350, cy], [450, cy + 40], [450, cy + 260], [-450, cy + 260]], true, 'S-EXIST'); [-1, 1].forEach(k => c.arc(k * 750, cy + 400, 140, k > 0 ? 270 : 90, k > 0 ? 90 : 270, 'S-EXIST')); c.line(-750, cy + 260, 750, cy + 260, 'S-EXIST'); c.line(-750, cy + 540, 750, cy + 540, 'S-EXIST');
    c.rect(-800, cy + 540, 1600, 110, 'S-EXIST'); for (let x = -700; x < 800; x += 160) c.line(x, cy + 540, x, cy + 650, 'S-EXIST'); c.brk(-800, cy + 530, -800, cy + 660); c.brk(800, cy + 530, 800, cy + 660);
    cSec(c, 100, -d / 2, s, 1, 'S-NEW'); aSec(c, 110, -d + 10, 75, 75, 10, 1, 1, 'S-NEW'); c.rect(100 - 10, -d * 0.2, 10, cy + 25 + d * 0.2, 'S-NEW'); c.pl([[90, cy + 25], [165, cy + 25], [165, cy + 15], [100, cy + 15]], false, 'S-NEW');
    c.line(100, cy, 100, cy + 25, 'S-NEW'); c.boltEnd(130, -d * 0.55, 20); rod(c, -150, 150, 200, 150, 65); c.line(130, cy - 40, 130, cy + 120, 'S-BOLT'); c.circ(130, cy + 50, 45, 'S-TEXT');
    c.dim(100, cy + 380, 145, cy + 380, 0.1, '45', { sub: '(TYP)' }); c.dim(-200, cy - 65, -200, cy, 4, '65'); c.dim(-200, -d, -200, -d + 130, 4, '130');
    c.leader(130, cy + 25, 8, 34, 'NOTCH EXISTING TIMBER (25\nMAX DEPTH) TO PROVIDE 130\nBEARING FOR ANGLE.'); c.leaders([[200, 150], [130, cy + 70]], 26, 10, 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE');
    c.leader(-100, 200, -16, 4, 'NOTCH TIMBER\nHALFCAP TO\nSUIT ANGLE'); c.leader(130, -d * 0.55, 18, -10, '1-M20 BOLT'); c.leader(100, -d * 0.8, 14, -24, 'PROPOSED PFC\nHALFCAP\nSTRENGTHENING'); c.leader(110, -d + 10, -16, -16, '75x75x10 EA\nPROVIDE 25 x\n25 CHAMFER');
    LY.title('SECTION C', 20);
    strElev(LY, p, { abc: true });
    LY.break(); strNotes(LY); drgBox(LY);
    LY.caption('PIER HALFCAP STRENGTHENING DETAIL', 20, 'PIER N° X', { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Halfcap strengthening where the stringers / corbels also need support: 75x75x10 EA seats bolted to the PFC under each stringer (200 min bearing).');

  def('pn2305', 'Halfcaps', 'Pier halfcap strengthening – at existing UC piles', 'PN30-2305', [P('pfc', 'Strengthening PFC', '300PFC', { opts: ['300PFC', '380PFC'] }), P('piles', 'Pile spacings (mm, comma)', '1800', {}), P('ns', 'Number of stringers', 3, { num: 1 })], (p) => {
    const LY = new Lay(700);
    strSec(LY, p, 'uc'); strElev(LY, p, { uc: true });
    LY.break(); strNotes(LY); drgBox(LY);
    LY.caption('PIER HALFCAPS STRENGTHENING DETAIL', 20, 'PIER N° X', { ref: 'XX30-XXXX' });
    return LY.done();
  }, 'Halfcap strengthening on piers with steel UC piles: PFCs seated on 200 UC 52 x 100 support brackets welded to the piles.');

})(typeof window !== 'undefined' ? window : globalThis);
