/* StructCap Timber — repair details: PN30-3101 … 3112 (stringer and corbel replacement / strengthening).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;
  const bbox = A.bbox;

  // ================================================================== local helpers (common to the PN30-31xx sheets)
  const DT = 130;   // existing timber deck plank thickness
  const OV = 110;   // concrete overlay thickness
  const PW = 230;   // deck plank width
  const COR = ['310UB46', '310UC97', '360UB51', '410UB54', '250UC90'];
  const sec = (k, dflt) => SEC[k] || SEC[dflt];

  // view title in MRWA style: underlined words, optional letter in a circle, scale under; placed under the view's entities
  function ttl(v, s, ch, scale, opt) {
    opt = opt || {}; const E = v.B.E, bb = bbox(E), h = opt.h || 3.2, tw = s.length * h * 0.66, cw = ch ? 9 : 0, x0 = (bb.x0 + bb.x1) / 2 - (tw + cw) / 2 + (opt.dx || 0), y = bb.y0 - (opt.gap || 8);
    E.push({ t: 'text', p: [x0, y], s, h, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }, { t: 'line', a: [x0, y - 1.1], b: [x0 + tw, y - 1.1], L: 'S-TITLE' });
    if (ch) E.push({ t: 'circle', c: [x0 + tw + 5.5, y + h / 2], r: 3.2, L: 'S-TITLE' }, { t: 'text', p: [x0 + tw + 5.5, y + h / 2], s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' });
    if (scale) E.push({ t: 'text', p: [x0, y - 4.6], s: '1:' + scale, h: TH * 0.9, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
  }
  // note box: optional underlined heading, solid (construction note) or dashed (designer's note); top-left at PAPER offset from model point
  function nbox(v, x, y, head, body, w, opt) {
    opt = opt || {}; const h = opt.h || TH, txt = (head ? head + '\n' : '') + body, H = v.noteBox(x, y, txt, w, { solid: !opt.dashed, h });
    if (head && opt.ul !== false) { const p = v.P(x, y); v.add({ t: 'line', a: [p[0] + 2, p[1] - 1.6 - h - 0.8], b: [p[0] + 2 + head.length * h * 0.7, p[1] - 1.6 - h - 0.8], L: 'S-TEXT' }); }
    return H;
  }
  // leader whose first part (a section size) sits in a dashed "variable" box: e.g. [410 UB 54] STRINGER
  function secLeader(v, x, y, dx, dy, var1, rest, opt) {
    opt = opt || {}; const h = TH, a = v.P(x, y), right = dx >= 0, c = [a[0] + dx + (right ? 2.5 : -2.5), a[1] + dy];
    const s = var1 + rest; v.leader(x, y, dx, dy, s, opt);
    const cw = h * 0.6, tw = s.length * cw, t0 = right ? c[0] + 1 : c[0] - 1 - tw, bx0 = t0 - 0.6, bx1 = t0 + var1.length * cw + 0.2, yb = c[1] - h / 2 - 0.9, yt = yb + h + 1.6;
    v.add({ t: 'pl', p: [[bx0, yb], [bx1, yb], [bx1, yt], [bx0, yt]], closed: true, L: 'S-NOTE' });
  }
  // the dashed "DRG NUMBER - REFER TO PLAN DRAWING" box beside the XX30-XXXX reference of the main caption
  function drgBox(E) {
    const t = E.find(e => e.t === 'text' && e.s === 'XX30-XXXX'); if (!t) return E;
    const mt = E.find(e => e.t === 'text' && e.L === 'S-TITLE' && e.h === 3.6 && abs(e.p[1] - t.p[1]) < 0.01);
    if (mt) { const tw = mt.s.length * 3.6 * 0.7, ul = E.find(e => e.t === 'line' && e.L === 'S-TITLE' && abs(e.a[1] - (mt.p[1] - 1.2)) < 0.01 && abs(e.a[0] - mt.p[0]) < 0.01); if (ul) ul.b = [mt.p[0] + tw, ul.b[1]]; t.p = [mt.p[0] + tw + 4, t.p[1]]; }
    const x = t.p[0] + 'XX30-XXXX'.length * TH * 0.66 + 8, y = t.p[1] - 2, B = new Builder(), w = 52;
    B.noteBox(x, y, 'DRG NUMBER - REFER TO\nPLAN DRAWING', w);
    E.push(...B.E, { t: 'line', a: [x - 1, y - 4], b: [x - 6, y + 0.5], L: 'S-TEXT' }, { t: 'solid', p: [[x - 7, y + 1.4], [x - 4.3, y + 0.1], [x - 5.6, y - 1.2]], L: 'S-TEXT' });
    return E;
  }
  // section cut marker as on the sheets: circled letter with a pointer at the top end of a thin line, heavy arrow head at the bottom
  function cutV(v, x, yt, yb, ch, dir, ltop) {
    const p = v.P(x, yt), q = v.P(x, yb), k = dir === 180 ? -1 : 1;
    v.add({ t: 'circle', c: [p[0], p[1] + 3.5], r: 3.2, L: 'S-TEXT' }); v.add({ t: 'text', p: [p[0], p[1] + 3.5], s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' });
    v.add({ t: 'solid', p: [[p[0] + k * 5.6, p[1] + 3.5], [p[0] + k * 2.6, p[1] + 5.4], [p[0] + k * 2.6, p[1] + 1.6]], L: 'S-TEXT' });
    v.add({ t: 'line', a: [p[0], p[1] + 0.3], b: [p[0], p[1] - (ltop || 6)], L: 'S-TEXT' });
    v.add({ t: 'line', a: [q[0], q[1]], b: [q[0], q[1] - 7], L: 'S-TITLE' }); v.add({ t: 'solid', p: [[q[0], q[1] - 1], [q[0], q[1] - 7.5], [q[0] + k * 2.2, q[1] - 4.2]], L: 'S-TEXT' });
  }
  // horizontal section cut marker (letter at one end, arrow at the other) for a view cut horizontally
  function cutH(v, xl, xr, y, ch) {
    const p = v.P(xl, y), q = v.P(xr, y);
    v.add({ t: 'circle', c: [p[0] - 3.5, p[1]], r: 3.2, L: 'S-TEXT' }); v.add({ t: 'text', p: [p[0] - 3.5, p[1]], s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' });
    v.add({ t: 'solid', p: [[p[0] - 3.5, p[1] - 5.6], [p[0] - 5.4, p[1] - 2.6], [p[0] - 1.6, p[1] - 2.6]], L: 'S-TEXT' }); v.add({ t: 'line', a: [p[0] - 0.3, p[1]], b: [p[0] + 5, p[1]], L: 'S-TEXT' });
    v.add({ t: 'line', a: q, b: [q[0] + 7, q[1]], L: 'S-TITLE' }); v.add({ t: 'solid', p: [[q[0] + 1, q[1]], [q[0] + 7.5, q[1]], [q[0] + 4.2, q[1] - 2.2]], L: 'S-TEXT' });
  }
  // concrete aggregate cluster (the "stones" drawn in overlays): a few small triangles + dots around (x,y)
  function aggr(v, x, y, L) {
    const s = v.s, tri = (cx, cy, r) => v.pl([[cx - r, cy - r * 0.6], [cx + r, cy - r * 0.6], [cx, cy + r]], true, L || 'S-HATCH');
    [[0, 0], [1.6, 0.9], [-1.4, -0.6], [0.9, -1.2], [-0.4, 1.4], [2.2, -0.4]].forEach(([a, b]) => tri(x + a * s, y + b * s, 0.45 * s));
    [[-2, 0.4], [-0.8, -1.5], [1.2, 1.9], [2.8, 0.8], [0.3, 0.6], [-1.6, 1.4], [1.9, -1.6]].forEach(([a, b]) => v.circ(x + a * s, y + b * s, 0.12 * s, L || 'S-HATCH'));
  }
  // existing timber deck (dash-dot) in elevation from x0..x1, planks joints at PW, break lines at both ends; o.ovl existing overlay, o.prop proposed overlay
  function deckElev(v, x0, x1, o) {
    o = o || {}; v.line(x0, 0, x1, 0, 'S-EXIST'); v.line(x0, DT, x1, DT, 'S-EXIST');
    if (!o.cut) for (let x = Math.ceil((x0 + 60) / PW) * PW + (o.ph || 0); x < x1 - 60; x += PW) v.line(x, 0, x, DT, 'S-EXIST');
    let top = DT;
    if (o.ovl || o.prop) { top = DT + OV; v.line(x0, top, x1, top, o.prop ? 'S-CONC' : 'S-EXIST'); for (let x = x0 + 350; x < x1 - 250; x += o.ag || 1000) aggr(v, x, DT + OV / 2, o.prop ? 'S-HATCH' : 'S-HATCH'); }
    v.brk(x0, -25, x0, top + 25); v.brk(x1, -25, x1, top + 25);
    return top;
  }
  // deck cross-section (seen along the bridge) from x0..x1
  function deckSec(v, x0, x1, o) {
    o = o || {}; v.line(x0, 0, x1, 0, 'S-EXIST'); v.line(x0, DT, x1, DT, 'S-EXIST'); let top = DT;
    if (o.ovl || o.prop) { top = DT + OV; v.line(x0, top, x1, top, o.prop ? 'S-CONC' : 'S-EXIST'); if (o.ag !== false) { aggr(v, x0 + (x1 - x0) * 0.22, DT + OV / 2); aggr(v, x0 + (x1 - x0) * 0.72, DT + OV / 2); } }
    v.brk(x0, -25, x0, top + 25); v.brk(x1, -25, x1, top + 25); return top;
  }
  // vertical rod / bolt with nuts + washers: from yt (nut on top) to yb (nut under); hid = shaft drawn dashed
  function rodV(v, x, yt, yb, o) {
    o = o || {}; const r = 10, L = o.hid ? 'S-HIDDEN' : 'S-BOLT', pr = o.pr == null ? 24 : o.pr;
    v.line(x - r, yt + pr, x - r, yb - pr, L); v.line(x + r, yt + pr, x + r, yb - pr, L);
    if (o.top !== false) v.nut(x, yt, 0, 1, 20); if (o.bot !== false) v.nut(x, yb, 0, -1, 20);
  }
  // coach screw driven up from under the stringer flange: head + washer under y0, point at y1
  function coach(v, x, y0, y1, hid) {
    const L = hid ? 'S-HIDDEN' : 'S-BOLT'; v.line(x - 10, y0, x - 10, y1 - 15, L); v.line(x + 10, y0, x + 10, y1 - 15, L); v.pl([[x - 10, y1 - 15], [x, y1], [x + 10, y1 - 15]], false, L);
    v.rect(x - 32, y0 - 5, 64, 5, 'S-BOLT'); v.rect(x - 15, y0 - 19, 30, 14, 'S-BOLT');
  }
  // two diagonal spikes either side of a deck rod (fix loose planks to adjacent bolted planks)
  function spikes(v, x, hid) { const L = hid ? 'S-HIDDEN' : 'S-BOLT'; v.spike(x - 205, DT + 20, x - 40, DT - 85, L); v.spike(x + 205, DT + 20, x + 40, DT - 85, L); }
  // trimmed timber corbel log in elevation (dash-dot) top at yc, from xl..xr, depth dc with chamfered bottom corners
  function corbelLog(v, xl, xr, yc, dc) { v.pl([[xl, yc], [xr, yc], [xr, yc - dc * 0.55], [xr - 150, yc - dc], [xl + 150, yc - dc], [xl, yc - dc * 0.55]], true, 'S-EXIST'); }
  // twin halfcaps in elevation (section through the pier: two timber halfcaps either side of the pile)
  function halfcapsElev(v, yt, w, h, gap) { v.rect(-gap / 2 - w, yt - h, w, h, 'S-EXIST'); v.rect(gap / 2, yt - h, w, h, 'S-EXIST'); }
  // log seen end-on, trimmed flat top and bottom (corbel / stringer): centre (cx,cy), radius R, flats at half height hh
  function logTrim(v, cx, cy, R, hh, o) {
    o = o || {}; const a = Math.asin(min(0.999, hh / R)) * 180 / PI, c = sq(R * R - hh * hh);
    v.arc(cx, cy, R, -a, a, 'S-EXIST'); v.arc(cx, cy, R, 180 - a, 180 + a, 'S-EXIST');
    if (o.top !== false) v.line(cx - c, cy + hh, cx + c, cy + hh, 'S-EXIST'); if (o.bot !== false) v.line(cx - c, cy - hh, cx + c, cy - hh, 'S-EXIST');
  }
  function weldTail(v, x, y, dx, dy, o, tail) { v.weld(x, y, dx, dy, o); if (tail) { const a = v.P(x, y), k = dx >= 0 ? 1 : -1, c = [a[0] + dx + k * 14, a[1] + dy]; v.add({ t: 'line', a: c, b: [c[0] + k * 2.2, c[1] + 2.2], L: 'S-TEXT' }); v.add({ t: 'line', a: c, b: [c[0] + k * 2.2, c[1] - 2.2], L: 'S-TEXT' }); tail.split('\n').forEach((l, i) => v.add({ t: 'text', p: [c[0] + k * 3.2, c[1] - 1 - i * TH * 1.55], s: l, h: TH, al: k > 0 ? 'l' : 'r', v: 'b', ang: 0, L: 'S-TEXT' })); } }

  // small dimension with its text set outside next to end 'a' or 'b' (horizontal or vertical dims only)
  function dimO(v, x1, y1, x2, y2, off, txt, side, sub, ex) {
    v.dim(x1, y1, x2, y2, off, ' '); const a = v.P(x1, y1), b = v.P(x2, y2), vert = abs(a[0] - b[0]) < abs(a[1] - b[1]);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux, q = side === 'a' ? a : b, k = side === 'a' ? -1 : 1;
    const tw = String(txt).length * 2.0 * 0.62, e = tw / 2 + 3.5 + (ex || 0), p = [q[0] + nx * off + ux * k * e, q[1] + ny * off + uy * k * e];
    if (vert) { v.add({ t: 'text', p: [p[0] - 0.7, p[1]], s: txt, h: 2.0, al: 'c', v: 'b', ang: 90, L: 'S-DIM' }); if (sub) v.add({ t: 'text', p: [p[0] + 0.9, p[1]], s: sub, h: 1.8, al: 'c', v: 't', ang: 90, L: 'S-DIM' }); }
    else { v.add({ t: 'text', p: [p[0], p[1] + 0.7], s: txt, h: 2.0, al: 'c', v: 'b', ang: 0, L: 'S-DIM' }); if (sub) v.add({ t: 'text', p: [p[0], p[1] - 0.9], s: sub, h: 1.8, al: 'c', v: 't', ang: 0, L: 'S-DIM' }); }
  }
  // ================================================================== PN30-3101 / 3102  PIER - STRINGER REPLACEMENT DETAIL - TYPE 1
  // modified flange plan (1:10), x along the plate from the stringer end
  function modFlange(v, o) {
    o = o || {}; const L = 1129, xs = 829, xh = 365;
    v.line(0, 0, L, 0, 'S-NEW'); v.line(0, 200, L, 200, 'S-NEW'); v.line(0, 0, 0, 200, 'S-NEW'); v.line(L, 0, L, 95, 'S-NEW'); v.line(L, 105, L, 200, 'S-NEW');
    v.pl([[L, 95], [xs, 95], [xs, 105], [L, 105]], false, 'S-NEW');
    [0, 535].forEach(x => { v.pl([[x, 0], [x, -50], [x + 200, -50], [x + 200, 0]], false, 'S-NEW'); v.pl([[x, 200], [x, 250], [x + 200, 250], [x + 200, 200]], false, 'S-NEW'); if (x) v.line(x, 0, x, 200, 'S-HIDDEN'); v.line(x + 200, 0, x + 200, 200, 'S-HIDDEN');
      [[x + 95, 200, 1], [x + 95, 0, -1]].forEach(([wx, wy, k]) => [0, 12, 24].forEach(d => v.line(wx + d - 6, wy + k * 8, wx + d + 6, wy + k * 16, 'S-TEXT'))); });
    [35, 165].forEach(y => { v.rect(xh - 20, y - 12, 40, 24, 'S-HIDDEN'); v.arc(xh - 8, y, 12, 90, 270, 'S-NEW'); v.arc(xh + 8, y, 12, -90, 90, 'S-NEW'); v.line(xh - 8, y + 12, xh + 8, y + 12, 'S-NEW'); v.line(xh - 8, y - 12, xh + 8, y - 12, 'S-NEW'); v.line(xh - 30, y, xh + 30, y, 'S-CL'); });
    v.line(xh, -90, xh, 260, 'S-CL'); v.line(-15, 35, xh - 32, 35, 'S-DIM');
    v.dim(0, 250, 200, 250, 6, '200', { sub: '(TYP)' }); v.dim(-60, -50, -60, 250, 8, '300 (TYP)'); v.dim(-20, 0, -20, 35, 6, '35', { sub: '(TYP)' });
    v.dim(L + 80, 0, L + 80, 200, -6, '200'); dimO(v, L + 10, 95, L + 10, 105, -14, '10', 'a');
    v.dim(0, -120, xh, -120, -6, '365'); v.dim(735, -120, xs, -120, -6, '100'); v.dim(xs, -120, L, -120, -6, '300'); v.dim(0, -220, L, -220, -6, '*');
    v.leader(0, 250, -12, 12, 'STEEL PACKER\n(TYP)'); v.leader(xh - 10, 175, 20, 46, 'φ24x40 LONG\nSLOTTED HOLE (TYP)'); v.leader(xh + 30 + 420, 200, 22, 8, '200x16FL');
    weldTail(v, 625, 205, 12, 20, { size: '6', site: true }, '30 LONG (TYP)');
  }
  function stringerType1(p, ovl) {
    const LY = new Lay(560), u = sec(p.ub, '410UB54'), d = u.d, ubT = secName(p.ub);
    // ---- modified flange details 1:10
    const f = LY.view(10); modFlange(f); nbox(f, 1260, -60, '', 'NOTE:\nDIMENSIONS DENOTED THUS *\nSHALL BE SITE MEASURED\nPRIOR TO FABRICATION &\nCONSTRUCTION.', 56, { ul: false });
    ttl(f, 'MODIFIED FLANGE DETAILS', '', 10, { dx: -40 });
    LY.break();
    // ---- elevation 1:20  (x = 0 at ℄ pier, y = 0 at the underside of the deck)
    const v = LY.view(20), xe = 10, Lf = 1129, xn = xe + 829, xb = 1450, yPl = -d + 50, yPk = yPl - 16, yc = yPk - 12, dc = 320, xr = xe + 365, xa = 800;
    const top = deckElev(v, -1900, xb + 120, { ovl, ag: 1050 });
    // existing timber stringer (left span) on the existing corbel, end trimmed to the pier
    v.pl([[-1780, -470], [-950, -470], [-700, yc], [0, yc]], false, 'S-EXIST'); v.line(0, yc, 0, 0, 'S-EXIST'); v.pileEnd(-1780, -235, 470, 'S-EXIST', 1);
    corbelLog(v, -790, 790, yc, dc); halfcapsElev(v, yc - dc, 160, 320, 125);
    v.cl(0, yc - dc - 420, 0, top + 330, 'PIER');
    // proposed steel stringer: notched end on the modified flange
    v.line(xe, 0, xb, 0); v.line(xe, -u.tf, xb, -u.tf); v.line(xe, 0, xe, yPl); v.line(xe + 8, -u.tf, xe + 8, yPl); v.line(xe, yPl, xn, yPl); v.line(xn, yPl - 16, xn, -d); v.line(xn, -d, xb, -d); v.line(xn, -d + u.tf, xb, -d + u.tf);
    v.rect(xe, yPl - 16, Lf, 16); [xe, xe + 535].forEach(x => { v.rect(x, yc, 200, 12); v.hatch([[x, yc], [x + 200, yc], [x + 200, yc + 12], [x, yc + 12]], 'ansi31', 'S-HATCH', 0.5); });
    v.brk(xb, -d - 25, xb, 25);
    // rods: corbel rod through the slotted holes; deck rods (or coach screws) every third plank
    rodV(v, xr, yPl, yc - dc - 10, { hid: true }); v.rect(xr - 50, yc - dc - 10, 100, 10, 'S-BOLT');
    if (ovl) { coach(v, xr - 220, -u.tf, -u.tf + 130); coach(v, xr - 220 + 3 * PW, -u.tf, -u.tf + 130, true); }
    else { rodV(v, xr, DT, -u.tf); rodV(v, xr + 3 * PW, DT, -u.tf, { hid: true }); spikes(v, xr); spikes(v, xr + 3 * PW, true); }
    cutV(v, xa, top + 200, yc - dc - 350, 'A', 180, 7);
    // dimensions
    dimO(v, 0, top + 170, xe, top + 170, 6, '10', 'a'); v.dim(790, yc - dc - 300, xn, yc - dc - 300, -6, '50'); v.line(xn, yPl - 16, xn, yc - dc - 330, 'S-DIM');
    v.dim(xb + 260, yPl, xb + 260, 0, -10, '300', { sub: 'MIN' }); v.text(xb + 260 + 20 * 20, yPl / 2, '*', 3.5, 'c', 'm');
    v.dim(xb + 190, -d, xb + 190, yPl - 16, -6, '50', { sub: 'MIN' });
    // leaders
    v.leader(-1000, DT, -50, 22, 'EXISTING TIMBER\nDECK'); v.leader(-1200, -250, -42, 12, 'EXISTING TIMBER\nSTRINGER', { dot: true }); v.leader(-700, yc - dc + 60, -54, -8, 'EXISTING TIMBER\nCORBEL'); v.leader(-220, yc - dc - 160, -48, -10, 'EXISTING TIMBER\nHALFCAP (TYP)');
    if (!ovl) { v.leader(xr - 140, DT - 50, 12, 62, 'FIX LOOSE PLANKS TO\nADJACENT BOLTED PLANKS\nWITH φ10x200 LONG SPIKE\n(TYP)'); v.leader(xr + 30, DT + 8, 18, 38, '65x5FLx65 STEEL\nWASHER (TYP)'); }
    v.leader(940, yPl - 10, 10, -24, 'MODIFIED FLANGE\nREFER TO DETAIL'); v.leader(760, -180, 19, -46, 'PROPOSED\nSTEEL STRINGER', { dot: true });
    weldTail(v, 940, yPl - 4, 12, 34, { size: '6', both: true, all: true }, 'BOTH SIDES\nOF WEB');
    nbox(v, 2200, 100, 'NOTE:', 'GAP BETWEEN STRINGER\nAND DECK SHALL BE\nSUITABLY PACKED REFER\nTO STEEL STRINGER\nPACKING DETAIL', 50);
    const nb = v.P(1760, top + 700); v.noteBox(1760, top + 700, 'NOTE:\n300 MIN CAN BE REDUCED\nSUBJECT TO ENGINEER\'S\nASSESSMENT & VERIFICATION', 42, { h: 1.7 }); { const a = v.P(xb + 300, yPl / 2 + 60); v.add({ t: 'line', a: [nb[0] + 22, nb[1] - 13.5], b: [a[0] + 2, a[1]], L: 'S-NOTE' }); }
    v.noteBox(2200, -780, 'NOTE: STRINGER SIZE WILL\nVARY ACCORDING TO\nENGINEERING REQUIREMENTS\n' + ubT + ' STRINGER DRAWN', 46, { h: 1.8 });
    ttl(v, 'ELEVATION', '', null, { h: 2.6, dx: -20 });
    // ---- sectional elevation A 1:20 (x = 0 at ℄ stringer)
    const w = LY.view(20), R = 230, hh = dc / 2, cy = yc - hh;
    const wt = deckSec(w, -430, 430, { ovl });
    iSec(w, 0, -u.tf / 2, { d: u.tf, b: u.b, tf: u.tf / 2, tw: u.b }); w.rect(-u.tw / 2, yPl, u.tw, -u.tf - yPl); w.fill([[-u.tw / 2, yPl], [u.tw / 2, yPl], [u.tw / 2, -u.tf], [-u.tw / 2, -u.tf]]);
    w.rect(-100, yPl - 16, 200, 16); w.rect(-150, yc, 300, 12); logTrim(w, 0, cy, R, hh, { top: false }); w.line(-sq(R * R - hh * hh), yc, -150, yc, 'S-EXIST'); w.line(150, yc, sq(R * R - hh * hh), yc, 'S-EXIST');
    [-65, 65].forEach(x => rodV(w, x, yPl, yc - dc - 10)); w.rect(-150, yc - dc - 10, 300, 10, 'S-BOLT');
    if (ovl) { coach(w, -45, -u.tf, -u.tf + 130); coach(w, 45, -u.tf, -u.tf + 130, true); } else { rodV(w, -45, DT, -u.tf); rodV(w, 45, DT, -u.tf, { hid: true }); }
    w.cl(0, yc - dc - 120, 0, wt + 360, 'STRINGER');
    dimO(w, -45, wt + 160, 0, wt + 160, 6, '45', 'a'); dimO(w, 0, wt + 160, 45, wt + 160, 6, '45', 'b');
    if (!ovl) w.dim(-230, DT, -230, DT + 50, -6, '50', { sub: '(TYP)' });
    secLeader(w, u.tw / 2, -150, 34, 0, ubT, ' STRINGER');
    w.leader(-100, yPl - 6, -16, 10, 'MODIFIED\nFLANGE'); w.leader(140, yc + 12, 28, -8, '200x(6,8,10 OR 12FL)x300 LONG\nSTEEL PACKERS, USED TO\nWEDGE STEEL STRINGER TIGHT\nAGAINST EXISTING DECKING.\nTACK WELD STEEL PACKERS TO\nSTRINGER AFTER PLACEMENT.');
    w.leader(-65, yc - dc - 40, -12, -14, 'φ20 THREADED\nROD (TYP)'); w.leader(65, yc - dc - 10, 22, -28, '100x10FLx300 WASHER');
    if (ovl) { w.leader(-45, 110, -32, 50, 'φ20x130 LONG COACH\nSCREW EVERY THIRD\nDECK PLANK ON\nALTERNATE SIDES OF\nWEB'); w.leader(250, DT + OV / 2, 16, 36, 'EXISTING CONCRETE\nOVERLAY', { dot: true }); }
    else { w.leader(45, DT + 30, 26, 22, 'THREADED ROD EVERY\nTHIRD DECK PLANK ON\nALTERNATING SIDES OF\nWEB'); w.leader(-45, DT + 40, -28, 46, '', { noArrow: false }); nbox(w, -1500, DT + 1250, '', 'TACK WELD OR\nCENTRE PUNCH BOLT\nTHREAD TO NUT\nTO PREVENT UNDOING\nOF NUT. (TYP)', 44, { ul: false }); }
    ttl(w, 'SECTIONAL ELEVATION', 'A', 20);
    LY.caption('PIER - STRINGER REPLACEMENT DETAIL - TYPE 1', 20, 'SPAN N° X - STRINGER N° X', { ref: 'XX30-XXXX' });
    return drgBox(LY.done());
  }
  const pUB = () => P('ub', 'Proposed stringer', '410UB54', { opts: UBs });
  def('pn3101', 'Stringers', 'Pier stringer replacement – Type 1 (no overlay)', 'PN30-3101', [pUB()], p => stringerType1(p, false),
    'Replacing a pier stringer with a steel UB on a modified flange seated on the existing corbel, fixed to the deck with φ20 threaded rods every third plank (no concrete overlay).');
  def('pn3102', 'Stringers', 'Pier stringer replacement – Type 1 (existing overlay)', 'PN30-3102', [pUB()], p => stringerType1(p, true),
    'As Type 1 where an existing concrete overlay is present: stringer fixed to the deck with φ20x130 coach screws every third plank.');

  // ================================================================== PN30-3103  STRINGER REPLACEMENT DETAIL - TYPE 2 (on a timber bearer)
  // solid I section (small steel sections at 1:20 are drawn filled on the sheets)
  function iFill(v, cx, cy, s) { const { d, b, tf, tw } = s; iSec(v, cx, cy, s, 0); v.fill([[cx - b / 2, cy - d / 2], [cx + b / 2, cy - d / 2], [cx + b / 2, cy - d / 2 + tf], [cx - b / 2, cy - d / 2 + tf]]); v.fill([[cx - b / 2, cy + d / 2 - tf], [cx + b / 2, cy + d / 2 - tf], [cx + b / 2, cy + d / 2], [cx - b / 2, cy + d / 2]]); v.fill([[cx - tw / 2, cy - d / 2], [cx + tw / 2, cy - d / 2], [cx + tw / 2, cy + d / 2], [cx - tw / 2, cy + d / 2]]); }
  // horizontal rod through timber (shaft hidden inside), nut + washer each end
  function rodH(v, y, xl, xr, o) { o = o || {}; v.line(xl - 24, y + 10, xr + 24, y + 10, 'S-HIDDEN'); v.line(xl - 24, y - 10, xr + 24, y - 10, 'S-HIDDEN'); v.nut(xl, y, -1, 0, 20); v.nut(xr, y, 1, 0, 20); }
  // designer's dashed note under the main caption (left aligned with it)
  function capNote(E, txt, w) { const bb = bbox(E), t = E.find(e => e.t === 'text' && e.L === 'S-TITLE' && e.h === 3.6), B = new Builder(); B.noteBox(t ? t.p[0] : bb.x0, bb.y0 - 4, txt, w || 60, { h: 1.9 }); E.push(...B.E); return E; }
  def('pn3103', 'Stringers', 'Stringer replacement – Type 2 (on timber bearer)', 'PN30-3103', [pUB()], (p) => {
    const LY = new Lay(), u = sec(p.ub, '410UB54'), d = u.d, ubT = secName(p.ub), hb = 250, wb = 190;
    // ---- view along the stringer: bearer seen along its length, 250x10FLx170 plate on the stringer top flange
    const v = LY.view(20);
    v.line(-640, 0, 640, 0, 'S-EXIST'); v.line(-640, hb, 640, hb, 'S-EXIST'); v.brk(-640, -20, -640, hb + 20); v.brk(640, -20, 640, hb + 20);
    iFill(v, 0, -d / 2, u); v.rect(-85, 0, 170, hb); v.boltEnd(-25, hb - 75, 20); v.boltEnd(25, 75, 20); v.circ(-25, hb - 75, 16, 'S-BOLT'); v.circ(25, 75, 16, 'S-BOLT');
    v.dim(-85, hb, 85, hb, 14, '170'); dimO(v, -85, hb, -25, hb, 7, '60', 'a', '(TYP)');
    dimO(v, -560, hb - 75, -560, hb, 6, '75', 'a'); v.line(-560, hb - 75, -40, hb - 75, 'S-DIM'); dimO(v, 300, 0, 300, 75, -6, '75', 'a'); v.line(40, 75, 330, 75, 'S-DIM');
    v.leader(85, hb, 8, 22, '250x10FLx170'); v.leader(380, hb, 7, 13, 'EXISTING TIMBER BEARER');
    weldTail(v, -85, 6, -14, -14, { size: '6', both: true, site: true });
    secLeader(v, u.b / 2, -d, 18, -14, ubT, ' STRINGER\nREPLACEMENT');
    // ---- elevation of the stringer: bearer in cross-section, rods through the bearer and the plate
    const w = LY.view(20);
    iElevWebH(w, -580, 580, -d / 2, u); w.brk(-580, -d - 20, -580, 20); w.brk(580, -d - 20, 580, 20);
    timberX(w, -wb / 2, 0, wb, hb); w.rect(-wb / 2 - 10, 0, 10, hb); rodH(w, 75, -wb / 2 - 10, wb / 2); rodH(w, hb - 75, -wb / 2 - 10, wb / 2);
    w.leader(-30, hb, -10, 14, 'EXISTING TIMBER BEARER'); w.leader(10, hb + 30, 4, 24, 'φ20 THREADED ROD\n(TYP)'); w.leader(wb / 2 + 4, hb - 60, 9, 10, '65x5FLx65 STEEL\nWASHER (TYP)');
    w.leader(-300, -d, -10, -14, '', { noArrow: false });
    LY.caption('STRINGER REPLACEMENT DETAIL - TYPE 2', 20, 'SPAN N° X - STRINGER N° X', { ref: 'XX30-XXXX' });
    return capNote(drgBox(LY.done()), 'NOTE: STRINGER SIZE WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS\n' + ubT + ' STRINGER DRAWN', 66);
  }, 'Replacement steel stringer connected to an existing timber bearer with a 250x10FLx170 plate welded to the top flange and two φ20 threaded rods.');

  // ================================================================== PN30-3104 … 3111  PIER - STRINGER & CORBEL REPLACEMENT / STRENGTHENING
  // cfg.type: '1' (existing timber stringer retained on the left span, steel stringer on the right), '2' (steel stringers both spans),
  //           'S' (strengthening: additional steel stringer beside the retained timber stringer); cfg.ovl existing concrete overlay;
  //           cfg.cleat (3105: 75x75x8 EA cleats at the corbel end against the timber stringer)
  // M16x120 anchor bolt standing on the stringer top flange (elevation / section), head up in the overlay
  function anchorBolt(v, x) { v.line(x - 8, -u0tf - 30, x - 8, 75, 'S-BOLT'); v.line(x + 8, -u0tf - 30, x + 8, 75, 'S-BOLT'); v.rect(x - 13, 75, 26, 14, 'S-BOLT'); v.nut(x, 0, 0, 1, 16); v.nut(x, -u0tf, 0, -1, 16); }
  let u0tf = 10.9;
  // plan section A (type 3): deck cut back to ℄ stringer, φ20 rods every third plank one side, anchor bolts at 1000 crs the other side
  function planA(v, u, t3a) {
    const xl = -1750, xr = 1750, b2 = u.b / 2;
    v.line(xl - 150, b2, xr + 150, b2, 'S-HIDDEN'); v.line(xl - 150, -b2, xr + 150, -b2, 'S-HIDDEN'); v.line(xl, 0, xr, 0, 'S-NEW'); v.brk(xl - 150, -b2 - 20, xl - 150, b2 + 20); v.brk(xr + 150, -b2 - 20, xr + 150, b2 + 20);
    v.line(-10, -b2, -10, 30, 'S-NEW'); v.line(10, -b2, 10, 30, 'S-NEW');
    v.line(xl, 0, xl, 450, 'S-EXIST'); v.line(xr, 0, xr, 450, 'S-EXIST'); v.line(xl, 450, xr, 450, 'S-EXIST'); v.brk(xl, 50, xl, 400); v.brk(xr, 50, xr, 400); v.brk(-1250, 450, -850, 450); v.brk(250, 450, 650, 450);
    for (let x = xl + 120; x < xr - 60; x += PW * 0.8) v.line(x, 0, x, 450, 'S-EXIST');
    v.line(xl, -300, xr, -300, 'S-CONC'); v.line(xl, -b2, xl, -300, 'S-CONC'); v.line(xr, -b2, xr, -300, 'S-CONC'); v.brk(-1250, -300, -850, -300); v.brk(250, -300, 650, -300);
    const rx = [-1530, -900, -270, 360, 990, 1620].filter(x => abs(x) < xr - 60); rx.forEach(x => { v.rect(x - 32, 13, 64, 64, 'S-BOLT'); v.rect(x - 22, 23, 44, 44, 'S-BOLT'); v.circ(x, 45, 12, 'S-BOLT'); });
    [-1000, 1000].forEach(x => v.circ(x, -45, 16, 'S-BOLT'));
    v.cl(0, -330, 0, 600, 'PIER');
    v.dim(-1000, -420, 0, -420, -6, '1000', { sub: '(TYP)' }); v.dim(-2000, -420, -1000, -420, -6, 'ANCHOR BOLTS AT', { sub: '1000 CTS (TYP)' }); v.line(-1000, -60, -1000, -440, 'S-DIM');
    v.leader(-500, 250, -10, 22, 'EXISTING TIMBER\nDECKING', { dot: true }); v.leader(360, 60, 8, 36, 'φ20 THREADED ROD\nEVERY THIRD DECK\nPLANK'); v.leader(xl - 60, b2 - 10, -8, 18, 'PROPOSED STEEL\nSTRINGER'); v.leader(-1000, -55, -26, -12, 'ANCHOR BOLT -\nM16x120 LONG\nBOLT (TYP)');
    ttl(v, 'SECTION', 'A', 20);
  }
  // detail 1 (1:5): anchor bolt through the stringer flange into the proposed overlay
  function det1(v, u, w150) {
    const tf = u.tf, H = w150 ? 150 : 120, top = w150 ? 210 : 180;
    v.line(-330, 0, 330, 0); v.line(-330, -tf, 330, -tf); v.brk(-330, -tf - 10, -330, 10); v.brk(330, -tf - 10, 330, 10); v.line(-310, -100, 310, -100, 'S-EXIST'); v.brk(-310, -110, -310, -tf - 5); v.brk(310, -110, 310, -tf - 5);
    v.line(-300, top, 300, top, 'S-CONC'); v.line(-300, 0, -300, top, 'S-CONC'); v.line(300, 0, 300, top, 'S-CONC'); v.brk(-300, 20, -300, top - 20); v.brk(300, 20, 300, top - 20); v.brk(-30, top, 30, top);
    const yf = w150 ? 85 : 75; aggr(v, 170, w150 ? 175 : 140); v.fabric(-300, yf, 300, yf, 140); v.line(-300, yf + 6, 300, yf + 6, 'S-REO');
    if (w150) { aggr(v, -200, 35); v.line(-300, 1, 300, 1, 'S-NEW'); [-170, 170].forEach(x => v.pl([[x - 25, 1], [x - 18, 55], [x + 18, 55], [x + 25, 1]], false, 'S-NEW')); v.leader(190, 40, 30, 22, '1mm BONDEK\nPERMANENT\nFORMWORK'); dimO(v, 360, 55, 360, yf, -6, '30', 'a', 'COVER'); v.line(195, 55, 375, 55, 'S-DIM'); v.line(305, yf, 375, yf, 'S-DIM'); }
    const x = 0; v.line(x - 8, -tf - 45, x - 8, H - tf - 25, 'S-BOLT'); v.line(x + 8, -tf - 45, x + 8, H - tf - 25, 'S-BOLT'); v.rect(x - 14, H - tf - 25, 28, 12, 'S-BOLT'); v.rect(x - 13, H - tf - 13, 26, 10, 'S-BOLT'); v.nut(x, 0, 0, 1, 16); v.nut(x, -tf, 0, -1, 16); v.fill([[x - 9, -tf], [x + 9, -tf], [x + 9, 0], [x - 9, 0]], 'S-BOLT');
    if (w150) { v.dim(-360, 0, -360, 110, -6, '110'); v.line(-370, 110, -20, 110, 'S-DIM'); } else { v.dim(-360, 0, -360, 75, -6, '75'); v.line(-370, 75, -310, 75, 'S-DIM'); }
    v.leader(w150 ? 120 : -120, yf + 4, w150 ? 14 : -12, w150 ? 34 : 18, 'DECK FABRIC'); v.leader(w150 ? -14 : 14, H - tf - 20, w150 ? -4 : 8, w150 ? 40 : 22, 'ANCHOR BOLT - ' + (w150 ? 'M16x150 LONG BOLT\nWITH 30 O.D. x 3 THICK WASHER\nEACH SIDE OF STRINGER FLANGE.\nANCHOR BOLTS ARE AT 800 CRS\nON ALTERNATE SIDES OF WEB AS\nSHOWN IN ELEVATION' : 'M16x120\nLONG BOLT WITH 30 O.D.\nx 3 THICK WASHER'));
    v.leader(-150, -tf, -10, -18, 'PROPOSED\nSTRINGER\nFLANGE'); v.leader(9, -tf / 2, 14, -20, w150 ? 'DRILL φ18 HOLE IN STRINGER\nFLANGE AND BONDEK SHEETING\nON ALTERNATE SIDES OF WEB\n(TYP)' : 'DRILL φ18 HOLE IN\nSTRINGER FLANGE');
    ttl(v, 'DETAIL', '1', 5);
  }
  // modified flange detail (type 3A, 1:10)
  function modFlange3A(v) {
    v.line(0, 0, 840, 0); v.line(0, 200, 840, 200); v.line(0, 0, 0, 200); v.line(840, 0, 840, 95); v.line(840, 105, 840, 200); v.pl([[840, 95], [540, 95], [540, 105], [840, 105]], false, 'S-NEW');
    [50, 440].forEach(x => [55, 145].forEach(y => { v.circ(x, y, 12); v.line(x - 30, y, x + 30, y, 'S-CL'); v.line(x, y - 30, x, y + 30, 'S-CL'); }));
    v.dim(0, -60, 540, -60, -14, '540'); v.dim(0, -60, 840, -60, -24, '840'); dimO(v, 0, -60, 50, -60, -6, '50', 'a'); v.dim(50, -60, 440, -60, -6, '390'); v.line(50, 25, 50, -80, 'S-DIM'); v.line(440, 25, 440, -80, 'S-DIM');
    dimO(v, -40, 145, -40, 200, 6, '55', 'b', '(TYP)'); v.line(-50, 145, 20, 145, 'S-DIM'); dimO(v, 880, 95, 880, 105, -6, '10', 'a');
    v.leader(50, 157, 10, 24, 'φ24 HOLE (TYP)'); v.leader(700, 200, 8, 18, '200x16FL');
    ttl(v, 'MODIFIED FLANGE DETAIL - STRINGER', '', null); ttl(v, 'REPLACEMENT ON PROPOSED UC CORBEL', '', 10, { gap: 3 });
  }
  function corbelElev(v, p, cfg) {
    const t3 = cfg.type[0] === '3', t3a = cfg.type === '3A', u = sec(p.ub, '410UB54'); u0tf = u.tf; const c = sec(p.cor, cfg.type === '1' ? '310UC97' : '310UB46'), d = u.d, dc = c.d, yPl = -d + 50, ycT = t3a ? yPl - 28 : -d, ycB = ycT - dc, yh = ycB - 13, hh = 400, xb = 1560, xl = -1560;
    const ovl = cfg.ovl, t1 = cfg.type === '1', t2 = cfg.type === '2' || t3, ts = cfg.type === 'S';
    const top = deckElev(v, xl - 40 - (t1 ? 300 : 0), xb + 40, { ovl, prop: t3, ag: t3 ? 1240 : 1080 });
    // proposed steel corbel, stiffeners, seat angles, steel packers, halfcaps, halfcap rods
    iElevWebH(v, -500, 500, ycT - dc / 2, c); [-1, 1].forEach(k => { v.rect(k * 175 - 5, ycB + c.tf, 10, dc - 2 * c.tf); aSec(v, k * 265, ycB, 200, 200, 13, k, -1); v.rect(k > 0 ? 65 : -262, yh, 197, 13); v.hatch(k > 0 ? [[65, yh], [262, yh], [262, ycB], [65, ycB]] : [[-262, yh], [-65, yh], [-65, ycB], [-262, ycB]], 'ansi31', 'S-HATCH', 0.4); rodV(v, k * 385, ycB + c.tf, ycB - 13, { pr: 18 }); });
    halfcapsElev(v, yh, 200, hh, 130); { const yr = ycB - 170; v.line(-300, yr + 10, 300, yr + 10, 'S-HIDDEN'); v.line(-300, yr - 10, 300, yr - 10, 'S-HIDDEN'); [-278, -65].forEach(x => v.nut(x, yr, -1, 0, 20)); [65, 278].forEach(x => v.nut(x, yr, 1, 0, 20)); }
    v.cl(0, yh - hh - 60, 0, top + 360, 'PIER');
    // steel stringer(s) + stringer-to-corbel bolts
    const strg = (k) => { // k = 1 right span, -1 left span
      const X = x => k * x;
      if (t3a) { const xn = 550; v.line(X(10), 0, X(xb), 0); v.line(X(10), -u.tf, X(xb), -u.tf); v.line(X(10), 0, X(10), yPl); v.line(X(10), yPl, X(xn), yPl); v.line(X(xn), yPl - 16, X(xn), -d); v.line(X(xn), -d, X(xb), -d); v.line(X(xn), -d + u.tf, X(xb), -d + u.tf);
        v.rect(min(X(10), X(850)), yPl - 16, 840, 16); v.rect(min(X(10), X(500)), ycT, 490, 12); v.hatch([[X(10), ycT], [X(500), ycT], [X(500), ycT + 12], [X(10), ycT + 12]], 'ansi31', 'S-HATCH', 0.4); }
      else iElevWebH(v, min(X(10), X(xb)), max(X(10), X(xb)), -d / 2, u);
      v.brk(X(xb), -d - 25, X(xb), 25); [60, 450].forEach(x => rodV(v, X(x), t3a ? yPl : -d + u.tf, ycT - c.tf, { pr: 18 }));
    };
    strg(1); if (t2) { strg(-1); v.line(-10, 0, -10, top + 40, 'S-NEW'); v.line(10, 0, 10, top + 40, 'S-NEW'); }
    if (ts) v.line(10, 0, 10, top + 30, 'S-NEW');
    // deck fixings
    const rods = [392, 392 + 3 * PW * 1, ...(t2 ? [-305, -305 - 3 * PW] : [])];
    rods.forEach((x, i) => { const hid = !ts && (i % 2 === 1) !== (x < 0); if (ovl) coach(v, x, -u.tf, -u.tf + 130, hid); else { rodV(v, x, DT, -u.tf, { hid }); spikes(v, x, hid); } });
    // existing timber stringer (type 1): trimmed end on continuous timber packers over the corbel
    const yS = ycT + 60;
    if (t1) {
      v.pl([[xl - 300, -480], [-1000, -480], [-720, yS], [0, yS]], false, 'S-EXIST'); v.line(0, yS, 0, 0, 'S-EXIST'); v.pileEnd(xl - 300, -240, 480, 'S-EXIST', 1);
      v.rect(-500, ycT, 500, 60); for (let x = -500; x < 0; x += 100) { v.line(x, ycT, x + 100, yS, 'S-NEW'); v.line(x, yS, x + 100, ycT, 'S-NEW'); }
      if (cfg.cleat) { v.rect(-545, ycB, 45, dc + 220); v.rect(-570, -240, 90, 220); v.boltEnd(-525, -130, 20); v.line(-525, ycB - 30, -525, -20, 'S-HIDDEN'); }
      else { v.line(-433 - 10, top + 40, -433 - 10, ycT - c.tf - 30, 'S-HIDDEN'); v.line(-433 + 10, top + 40, -433 + 10, ycT - c.tf - 30, 'S-HIDDEN'); v.nut(-433, DT, 0, 1, 20); v.nut(-433, ycT - c.tf, 0, -1, 20); v.rect(-333, -300, 100, 240); v.boltEnd(-283, -180, 20); }
    }
    // section markers
    if (t3) { [-1000, 1000].forEach(x => anchorBolt(v, x)); v.circ(1000, 40, 100, 'S-TEXT'); { const q = v.P(1000, 40); v.add({ t: 'line', a: [q[0] - 2, q[1] + 4.6], b: [q[0] - 4, q[1] + 12], L: 'S-TEXT' }); v.add({ t: 'circle', c: [q[0] - 4.6, q[1] + 15.4], r: 3.2, L: 'S-TEXT' }); v.add({ t: 'text', p: [q[0] - 4.6, q[1] + 15.4], s: '1', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
      cutH(v, xl - 120, xb + 120, DT * 0.6, 'A'); cutV(v, -455, top + 260, ycB - 300, 'B', 0, 8); }
    else cutV(v, 1120, top + 260, ycB - 60, 'A', 180, 8);
    if (t1) cutV(v, -433, top + 260, yh - hh - 120, 'B', 0, 8);
    // dimensions
    if (t3) dimO(v, 0, top + 180, 10, top + 180, 6, '10', 'a', '(TYP)'); else if (t2) { dimO(v, -10, top + 180, 0, top + 180, 6, '10', 'a'); dimO(v, 0, top + 180, 10, top + 180, 6, '10', 'b'); } else dimO(v, 0, top + 180, 10, top + 180, 6, '10', 'a');
    dimO(v, 10, -d / 2 - 60, 60, -d / 2 - 60, 6, '50', 'a', '(TYP)'); dimO(v, 450, -d / 2 - 60, 500, -d / 2 - 60, 6, '50', 'b', '(TYP)'); v.line(60, -d + u.tf + 40, 60, -d / 2 - 60, 'S-DIM'); v.line(450, -d + u.tf + 40, 450, -d / 2 - 60, 'S-DIM'); v.line(500, ycT + 20, 500, -d / 2 - 60, 'S-DIM');
    dimO(v, 265, ycT - 170, 385, ycT - 170, 6, '120', 'b', '(TYP)', 4); v.line(385, ycB + c.tf + 20, 385, ycT - 170, 'S-DIM'); v.dim(-175, yh - hh - 160, 175, yh - hh - 160, 6, '350');
    if (cfg.cleat) { dimO(v, -545, -80, -525, -80, 6, '25', 'b'); dimO(v, -545, ycT - 100, -500, ycT - 100, 6, '45', 'a'); }
    // leaders
    if (t3) { v.leader(-560, top, -26, 46, 'PROPOSED CONCRETE\nOVERLAY'); v.leader(-780, DT - 20, -30, 32, 'EXISTING TIMBER\nDECK'); }
    else v.leader(-900, DT, -36, 30, 'EXISTING TIMBER\nDECK');
    if (t3a) { dimO(v, -500, ycB + 80, -550, ycB + 80, -6, '50', 'b', '(TYP)'); v.line(-550, yPl - 16, -550, ycB + 60, 'S-DIM');
      v.dim(xl - 160, yPl, xl - 160, 0, -6, '300', { sub: 'MIN' }); v.text(xl - 160 - 140, yPl / 2, '*', 3.5, 'c', 'm'); dimO(v, -1250, -d, -1250, yPl - 16, -6, '50', 'b', 'MIN');
      v.leader(-850, yPl - 8, -14, 34, 'MODIFIED FLANGE REFER\nTO DETAIL (TYP)'); weldTail(v, -560, yPl - 8, -60, -20, { size: '6', both: true }, 'BOTH SIDES OF\nWEB (TYP)');
      v.noteBox(xl - 1500, 300, 'NOTE:\n300 MIN CAN BE REDUCED\nSUBJECT TO ENGINEER\'S\nASSESSMENT & VERIFICATION', 46, { h: 1.8 });
      nbox(v, xl - 1700, ycB - 300, '', 'NOTE:\nDIMENSION DENOTED THUS *\nSHALL BE DETERMINED FROM\nSITE MEASUREMENT PRIOR TO\nFABRICATION.', 54, { ul: false }); } if (ovl) v.leader(300, DT + OV / 2, 30, 34, 'EXISTING CONCRETE\nOVERLAY', { dot: true });
    if (t1) v.leader(-1250, -230, -52, 16, 'EXISTING TIMBER\nSTRINGER', { dot: true });
    if (!ovl) { v.leader(392 - 150, DT - 40, ts ? -30 : 6, ts ? 70 : 74, 'FIX LOOSE PLANKS TO\nADJACENT BOLTED PLANKS\nWITH φ10x200 LONG SPIKE\n(TYP)'); v.leader(392 + 20, DT + 10, 16, 52, '65x5FLx65 STEEL\nWASHER (TYP)'); }
    v.leader(-500, ycT - dc / 2, -26, 0, 'PROPOSED STEEL\nCORBEL'); v.leader(1300, -d, 12, -14, 'PROPOSED STEEL\nSTRINGER' + (t1 ? '' : ' (TYP)'));
    v.leader(-200, yh - 250, -40, 4, 'EXISTING TIMBER\nHALFCAP (TYP)'); v.leader(-120, ycB - 170, -46, -22, 'φ20 THREADED ROD' + (ts ? 'S' : '') + ' WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP)');
    if (t3a) v.leader(300, ycT + 6, 30, -34, '200x(6,8,10 OR 12FL)x490 LONG\nSTEEL PACKERS WITH φ24 HOLES\nTO SUIT M20 BOLTS. USE PACKERS\nTO WEDGE STEEL STRINGER TIGHT\nAGAINST EXISTING DECKING.'); else v.leader(230, yh + 6, 34, -14, '200x(6,8,10 OR 12FL)x300 LONG\nSTEEL PACKERS, USED TO\nWEDGE STEEL STRINGER TIGHT\nAGAINST EXISTING DECKING.\nTACK WELD STEEL PACKERS\nTO CORBEL AFTER PLACEMENT');
    nbox(v, 1880, top + 300, 'NOTE:', 'GAP BETWEEN STRINGER\nAND DECK SHALL BE\nSUITABLY PACKED REFER\nTO STEEL STRINGER\nPACKING DETAIL', 50);
    ttl(v, 'ELEVATION', '', null, { h: 2.6 });
    return { u, c, d, dc, ycT, ycB, yh };
  }
  // sectional elevation A (x = 0 at ℄ stringer)
  function corbelSecA(w, p, cfg, g) {
    const { u, c, d, dc, ycT, ycB, yh } = g, ovl = cfg.ovl, ts = cfg.type === 'S', t3 = cfg.type[0] === '3', t3a = cfg.type === '3A', yPl = -d + 50;
    let wt;
    if (t3) { wt = DT + OV; w.line(-480, 0, 0, 0, 'S-EXIST'); w.line(-480, DT, 0, DT, 'S-EXIST'); w.line(-480, wt, 480, wt, 'S-CONC'); w.line(u.b / 2, 0, 480, 0, 'S-CONC'); w.brk(-480, -25, -480, wt + 25); w.brk(480, -25, 480, wt + 25); aggr(w, 230, DT); }
    else wt = deckSec(w, -480, 480, { ovl });
    if (t3a) { w.rect(-u.b / 2, -u.tf, u.b, u.tf); w.fill([[-u.b / 2, -u.tf], [u.b / 2, -u.tf], [u.b / 2, 0], [-u.b / 2, 0]]); w.fill([[-u.tw / 2, yPl], [u.tw / 2, yPl], [u.tw / 2, -u.tf], [-u.tw / 2, -u.tf]]); w.rect(-100, yPl - 16, 200, 16); w.rect(-100, ycT, 200, 12); w.hatch([[-100, ycT], [100, ycT], [100, ycT + 12], [-100, ycT + 12]], 'ansi31', 'S-HATCH', 0.4); }
    else iFill(w, 0, -d / 2, u); iSec(w, 0, ycT - dc / 2, c); w.rect(-c.b / 2 + 3, ycB + c.tf, c.b - 6, dc - 2 * c.tf, 'S-NEW'); w.line(-c.tw / 2, ycB + c.tf, -c.tw / 2, ycT - c.tf); w.line(c.tw / 2, ycB + c.tf, c.tw / 2, ycT - c.tf);
    [-1, 1].forEach(k => { rodV(w, k * (t3a ? 45 : 40), t3a ? yPl : -d + u.tf, ycT - c.tf, { pr: 18 }); rodV(w, k * 40, ycB + c.tf, ycB - 13, { pr: 18 }); });
    w.rect(-150, ycB - 200, 300, 200); w.line(-150, ycB - 13, 150, ycB - 13); [-100, 100].forEach(x => { w.circ(x, ycB - 170, 22, 'S-BOLT'); w.boltEnd(x, ycB - 170, 20); });
    w.line(-480, yh, -150, yh, 'S-EXIST'); w.line(150, yh, 480, yh, 'S-EXIST'); w.line(-480, yh - 400, 480, yh - 400, 'S-EXIST'); w.brk(-480, yh - 420, -480, yh + 20); w.brk(480, yh - 420, 480, yh + 20);
    if (ts) { w.arc(500, -265, 265, -62, 242, 'S-EXIST'); w.arc(500, ycT - 150, 235, 150, 390, 'S-EXIST'); }
    if (ovl) { coach(w, -45, -u.tf, -u.tf + 130); if (!ts) coach(w, 45, -u.tf, -u.tf + 130, true); } else { rodV(w, -45, DT, -u.tf); if (t3) anchorBolt(w, 45); else if (!ts) rodV(w, 45, DT, -u.tf, { hid: true }); }
    w.cl(0, ycB - 330, 0, wt + (t3 ? 1150 : 380), 'STRINGER'); if (t3) { w.leader(0, wt + 1000, 12, 0, 'CUT BACK EXISTING TIMBER\nDECKING FOR FULL LENGTH OF\nPROPOSED STEEL STRINGER\nTO THE ℄ OF PROPOSED STRINGER'); w.leader(55, 80, 16, 34, 'ANCHOR BOLT -\nM16x120 LONG BOLT'); }
    dimO(w, -45, wt + 170, 0, wt + 170, 6, '45', 'a'); if (!ts) dimO(w, 0, wt + 170, 45, wt + 170, 6, '45', 'b');
    if (!ovl) dimO(w, -260, DT, -260, DT + 50, -6, '50', 'b', '(TYP)');
    dimO(w, -100, ycB - 280, 0, ycB - 280, -6, '100', 'a'); dimO(w, 0, ycB - 280, 100, ycB - 280, -6, '100', 'b'); w.line(-100, ycB - 180, -100, ycB - 300, 'S-DIM'); w.line(100, ycB - 180, 100, ycB - 300, 'S-DIM');
    dimO(w, 250, ycB - 200, 250, ycB - 170, -6, '30', 'a'); w.line(130, ycB - 170, 270, ycB - 170, 'S-DIM');
    secLeader(w, u.tw / 2, -d / 2, ts ? 60 : 36, 0, secName(p.ub), ' STRINGER'); secLeader(w, c.tw / 2, ycT - dc / 2, ts ? 60 : 36, 0, secName(p.cor), ' CORBEL x\n1000 LONG');
    w.leader(-40, -d + u.tf + 10, -22, 14, 'M20 BOLT (TYP)'); w.leader(-c.b / 4, ycT - dc / 2, -30, -6, '10FL STIFFENER\n(TYP)', { dot: true }); w.leader(-150, ycB - 200, -18, -12, '200x200x13 EA\nx300 LONG (TYP)');
    weldTail(w, -c.tw / 2 - 2, ycT - c.tf - 30, -8, 8, { size: '6', all: true }, 'TYP');
    if (ovl) { w.leader(-45, 110, -32, 54, 'φ20x130 LONG COACH\nSCREW EVERY THIRD\nDECK PLANK' + (ts ? '' : ' ON\nALTERNATING SIDES OF\nWEB')); w.leader(260, DT + OV / 2, 18, 40, 'EXISTING CONCRETE\nOVERLAY', { dot: true }); }
    else { if (!t3) w.leader(ts ? -40 : 45, DT + 30, ts ? 30 : 26, 26, (cfg.type === '1' ? 'φ20 ' : '') + 'THREADED ROD EVERY\nTHIRD DECK PLANK' + (ts ? '' : ' ON\nALTERNATING SIDES OF\nWEB')); w.leader(-45, DT + 40, -26, 46, ''); nbox(w, -1440, DT + 1280, '', 'TACK WELD OR\nCENTRE PUNCH BOLT\nTHREAD TO NUT\nTO PREVENT UNDOING\nOF NUT. (TYP)', 44, { ul: false }); }
    w.noteBox(-1450, ycB - 640, 'NOTE: STRINGER & CORBEL\nSIZE WILL VARY ACCORDING\nTO ENGINEERING REQUIREMENTS\n' + secName(p.ub) + ' STRINGER DRAWN\n' + secName(p.cor) + ' CORBEL DRAWN', 46, { h: 1.8 });
    ttl(w, 'SECTIONAL ELEVATION', t3 ? 'B' : 'A', 20);
  }
  // section B through the retained timber stringer over the corbel (type 1)
  function corbelSecB(b, p, cfg, g) {
    const { c, d, dc, ycT, ycB, yh } = g, ovl = cfg.ovl, yS = ycT + 60, R = 240, cy = yS / 2, hh = -yS / 2;
    const wt = deckSec(b, -400, 400, { ovl });
    iSec(b, 0, ycT - dc / 2, c); b.rect(-150, ycB - 200, 300, 200); b.line(-150, ycB - 13, 150, ycB - 13); [-100, 100].forEach(x => b.boltEnd(x, ycB - 170, 20)); [-40, 40].forEach(x => rodV(b, x, ycB + c.tf, ycB - 13, { pr: 18 }));
    b.line(-400, yh, -150, yh, 'S-EXIST'); b.line(150, yh, 400, yh, 'S-EXIST'); b.line(-400, yh - 400, 400, yh - 400, 'S-EXIST'); b.brk(-400, yh - 420, -400, yh + 20); b.brk(400, yh - 420, 400, yh + 20);
    // continuous timber packer (grain across the stringer)
    b.rect(-240, ycT, 480, 60); for (let i = 1; i < 4; i++) b.pl(Array.from({ length: 9 }, (_, k) => [-230 + k * 57.5, ycT + i * 15 + (k % 2 ? 4 : -4)]), false, 'S-HATCH');
    if (!cfg.cleat) {
      logTrim(b, 0, cy, R, hh, { top: false, bot: false });
      const xs = c.b / 2 - 30; [[-60, xs], [60, -xs]].forEach(([x0, x1]) => { const yt = (ovl ? wt : DT), L = Math.hypot(x1 - x0, yt - (ycT - c.tf)), ux = (x1 - x0) / L, uy = ((ycT - c.tf) - yt) / L; b.line(x0 - uy * 10, yt + ux * 10 + 0, x1 - uy * 10, ycT - c.tf + ux * 10, 'S-BOLT'); b.line(x0 + uy * 10, yt - ux * 10, x1 + uy * 10, ycT - c.tf - ux * 10, 'S-BOLT'); b.nut(x0, yt, -ux, -uy, 20); b.nut(x1, ycT - c.tf, ux, uy, 20); });
      rodH(b, cy, -R - 12, R + 12); [-1, 1].forEach(k => { b.arc(0, cy, R + 4, k > 0 ? -25 : 155, k > 0 ? 25 : 205, 'S-NEW'); b.arc(0, cy, R + 14, k > 0 ? -25 : 155, k > 0 ? 25 : 205, 'S-NEW'); });
      b.leader(30, wt + 10, 18, 30, 'φ20 THREADED ROD WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP)'); b.leader(-200, ycT + 30, -26, 22, 'CONTINUOUS TIMBER\nPACKERS (F11 SEASONED\nJARRAH) TO WEDGE\nCORBEL AGAINST\nEXISTING STRINGER'); b.leader(R + 14, cy - 60, 26, -18, 'CURVED WASHER REFER\nDRG N° 9530-0072.\nINSTALL & TIGHTEN\nBEFORE CROSS BOLTS\nARE IN PLACE.');
      b.leader(-120, ycT + 15, -26, -22, 'GRAIN DIRECTION\nTO BE ACROSS\nSTRINGER');
    } else {
      // 75x75x8 EA cleats welded to the corbel flange tips, splayed against the stringer, with steel packers and curved washers
      const R2 = 200; logTrim(b, 0, cy, R2, hh, { top: false, bot: false });
      [-1, 1].forEach(k => { const x0 = k * c.b / 2, xt = k * (c.b / 2 + 95), yt = cy + 60, pts = [[x0, ycB + c.tf], [x0, ycT], [xt, yt]]; b.pl(pts, false, 'S-NEW'); b.pl(pts.map(q => [q[0] + k * 8, q[1]]), false, 'S-NEW');
        b.pl([[x0 - k * 2, ycT + 4], [xt - k * 70, yt - 30], [xt - k * 64, yt - 18]], false, 'S-NEW');
        b.rect(k > 0 ? 196 : -236, cy - 20, 40, 60, 'S-NEW');
        b.arc(0, cy, R2 + 4, k > 0 ? 5 : 140, k > 0 ? 40 : 175, 'S-NEW'); b.arc(0, cy, R2 + 14, k > 0 ? 5 : 140, k > 0 ? 40 : 175, 'S-NEW'); });
      const a1 = [-R2 * 0.94, cy + R2 * 0.34], a2 = [R2 * 0.94, cy - R2 * 0.05];
      [[a1, a2], [[-a1[0], a1[1]], [-a2[0], a2[1]]]].forEach(([q0, q1]) => { const L = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]), ux = (q1[0] - q0[0]) / L, uy = (q1[1] - q0[1]) / L; b.line(q0[0] - ux * 40, q0[1] - uy * 40, q1[0] + ux * 40, q1[1] + uy * 40, 'S-BOLT'); b.nut(q0[0] - ux * 14, q0[1] - uy * 14, -ux, -uy, 20); b.nut(q1[0] + ux * 14, q1[1] + uy * 14, ux, uy, 20); });
      b.leader(-120, ycT + 40, -10, 70, 'CONTINUOUS TIMBER PACKERS\n(F11 SEASONED JARRAH) TO\nWEDGE CORBEL AGAINST\nEXISTING STRINGER'); b.leader(20, cy, 18, 72, 'φ20 THREADED ROD\n(TYP)'); b.leader(60, ycT + 40, 24, 54, 'GRAIN DIRECTION TO\nBE ACROSS STRINGER');
      b.leader(-(c.b / 2 + 70), cy, -30, 4, 'NOTCH FACE OF EXISTING\nTIMBER STRINGER OR\nPACK GAP BETWEEN ANGLE\nAND STRINGER FACE WITH\n100x(5,6,8,10,12 OR 16FL)x100\nSTEEL PACKERS AS REQUIRED BY\nEXISTING STRINGER DIAMETER.\nTACK WELD STEEL PACKERS\nTO ANGLE AFTER PLACEMENT');
      b.leader(R, cy + 20, 26, 14, 'CURVED WASHER (TYP)\nREFER DRG N° 9530-0072.\nTRIM WASHER EDGE AS\nREQUIRED TO OBTAIN SNUG\nFITMENT.'); b.leader(c.b / 2 + 60, ycT + 60, 22, -6, '75x75x8 EA (TYP)');
      weldTail(b, c.b / 2 + 4, ycT - 40, 22, -14, { size: '6', all: true }, 'TYP'); weldTail(b, c.b / 2 - 4, ycB + 30, 6, -22, { size: '6', both: true }, 'TYP');
    }
    ttl(b, 'SECTION', 'B', 20);
  }
  function corbelDet(p, cfg) {
    if (cfg.type[0] === '3') return corbelDet3(p, cfg);
    const LY = new Lay(760); let g;
    if (cfg.type === '1') { const b = LY.view(20); g = { pending: b }; }
    const v = LY.view(20); g = corbelElev(v, p, cfg);
    if (cfg.type === '1') { const B = LY.G[0].B; corbelSecB(new A.View(B, 20, 0, 0), p, cfg, g); }
    const w = LY.view(20); corbelSecA(w, p, cfg, g);
    const tt = { '1': 'PIER - STRINGER & CORBEL REPLACEMENT DETAIL - TYPE 1', '2': 'PIER - STRINGER & CORBEL REPLACEMENT DETAIL - TYPE 2', 'S': 'PIER - STRINGER & CORBEL STRENGTHENING DETAIL' }[cfg.type];
    LY.caption(tt, 20, cfg.type === '2' ? 'SPAN N° X - PIER N° X - STRINGER N° X' : 'SPAN N° X - STRINGER N° X', { ref: 'XX30-XXXX' });
    return drgBox(LY.done());
  }
  function corbelDet3(p, cfg) {
    const LY = new Lay(700), u = sec(p.ub, '410UB54'), t3a = cfg.type === '3A';
    const B0 = new Builder(), v = B0.view(20); const g = corbelElev(v, p, cfg); // build first to get geometry, placed later
    const a = LY.view(20); planA(a, u, t3a);
    const d1 = LY.view(5); det1(d1, u);
    if (t3a) { const m = LY.view(10); modFlange3A(m); }
    LY.break();
    if (!t3a) { const w = LY.view(20); corbelSecA(w, p, cfg, g); }
    LY.G.push({ B: B0, t: null });
    if (t3a) { const w = LY.view(20); corbelSecA(w, p, cfg, g); }
    LY.caption('PIER - STRINGER & CORBEL REPLACEMENT DETAIL - TYPE ' + cfg.type, 20, 'SPAN N° X - PIER N° X - STRINGER N° X', { ref: 'XX30-XXXX' });
    return drgBox(LY.done());
  }
  const pCor = (v) => P('cor', 'Proposed corbel', v, { opts: COR });
  def('pn3104', 'Stringers', 'Pier stringer & corbel replacement – Type 1 (no overlay)', 'PN30-3104', [pUB(), pCor('310UC97')], p => corbelDet(p, { type: '1' }),
    'Replacing one span\'s stringer with a steel UB on a new steel corbel seated on the halfcaps, the retained timber stringer wedged on continuous jarrah packers and cross-bolted (no overlay).');
  def('pn3105', 'Stringers', 'Pier stringer & corbel replacement – Type 1 (existing overlay)', 'PN30-3105', [pUB(), pCor('310UC97')], p => corbelDet(p, { type: '1', ovl: true, cleat: true }),
    'As Type 1 where an existing concrete overlay is present: coach screws to the deck and 75x75x8 EA cleats with curved washers holding the retained timber stringer.');
  def('pn3106', 'Stringers', 'Pier stringer & corbel replacement – Type 2 (no overlay)', 'PN30-3106', [pUB(), pCor('310UB46')], p => corbelDet(p, { type: '2' }),
    'Replacing the stringers of both spans with steel UBs seated on a new steel corbel bolted to the halfcaps (no overlay).');
  def('pn3107', 'Stringers', 'Pier stringer & corbel replacement – Type 2 (existing overlay)', 'PN30-3107', [pUB(), pCor('310UB46')], p => corbelDet(p, { type: '2', ovl: true }),
    'As Type 2 where an existing concrete overlay is present: stringers fixed to the deck with φ20x130 coach screws every third plank.');
  def('scs', 'Stringers', 'Pier stringer & corbel strengthening (no overlay)', 'PN30-3110', [pUB(), pCor('310UB46')], p => corbelDet(p, { type: 'S' }),
    'Additional steel stringer on a steel corbel beside the retained timber stringer and corbel, seated on the halfcaps with 200x200x13 EA (no overlay).');
  def('pn3111', 'Stringers', 'Pier stringer & corbel strengthening (existing overlay)', 'PN30-3111', [pUB(), pCor('310UB46')], p => corbelDet(p, { type: 'S', ovl: true }),
    'As the strengthening detail where an existing concrete overlay is present: the additional stringer is fixed to the deck with φ20x130 coach screws.');
  def('pn3108', 'Stringers', 'Pier stringer & corbel replacement – Type 3 (proposed overlay)', 'PN30-3108', [pUB(), pCor('310UB46')], p => corbelDet(p, { type: '3' }),
    'Stringer and corbel replacement where a concrete overlay is proposed: decking cut back to the stringer ℄ and M16x120 anchor bolts at 1000 crs through the top flange into the overlay.');
  def('pn3109', 'Stringers', 'Pier stringer & corbel replacement – Type 3A (modified flange, proposed overlay)', 'PN30-3109', [pUB(), pCor('310UB46')], p => corbelDet(p, { type: '3A' }),
    'As Type 3 with notched stringer ends on 200x16FL modified flanges and 490 long steel packers bolted to the proposed corbel (300 MIN depth, site measured).');

  // ================================================================== PN30-3112  PIER - WIDENING & ADDITIONAL STRINGER DETAIL
  // Bondek sheeting on the stringer flange in elevation / section: sheet line + trapezoidal ribs every 200
  function bondek(v, x0, x1, ph) { v.line(x0, 2, x1, 2, 'S-NEW'); for (let x = x0 + (ph || 100); x < x1 - 20; x += 200) v.pl([[x - 25, 2], [x - 18, 55], [x + 18, 55], [x + 25, 2]], false, 'S-NEW'); }
  function fabDash(v, x0, x1, y) { for (let x = x0; x < x1; x += 160) v.line(x, y, min(x + 110, x1), y, 'S-REO'); }
  const OT = 230; // overlay top above the stringer flange (3112)
  def('pn3112', 'Stringers', 'Pier widening & additional stringer', 'PN30-3112', [pUB(), pCor('310UB46'), P('col', 'Stub column', '200UC52', { opts: UCs })], (p) => {
    const LY = new Lay(700), u = sec(p.ub, '410UB54'), c = sec(p.cor, '310UB46'), q = sec(p.col, '200UC52'), d = u.d, dc = c.d, ycT = -d, ycB = ycT - dc, ycp = ycB - 16, xb = 1560;
    u0tf = u.tf;
    // ---- plan
    const a = LY.view(20), b2 = u.b / 2, PX = 1270;
    a.line(-PX, 345, PX, 345, 'S-NEW'); a.line(-PX, -345, PX, -345, 'S-NEW'); a.brk(-PX, -365, -PX, 365); a.brk(PX, -365, PX, 365); a.brk(-30, 345, 30, 345); a.brk(-30, -345, 30, -345);
    for (let x = -PX + 150; x < PX - 40; x += 200) { a.line(x - 18, -345, x - 18, 345, 'S-NEW'); a.line(x + 18, -345, x + 18, 345, 'S-NEW'); }
    a.line(-PX - 40, b2, PX + 40, b2, 'S-HIDDEN'); a.line(-PX - 40, -b2, PX + 40, -b2, 'S-HIDDEN'); a.line(-PX - 120, 0, PX + 120, 0, 'S-CL'); a.text(PX + 150, 0, '℄ STRINGER', TH, 'l', 'm'); a.line(0, -470, 0, 640, 'S-CL'); a.text(0, 665, '℄ PIER', TH, 'c', 'b');
    [-1200, -800, -400, 0, 400, 800, 1200].forEach((x, i) => { const xx = x + (x < 0 ? -0 : 0), y = i % 2 ? -45 : 45; if (abs(x) >= 1000) { a.circ(x, y, 16, 'S-BOLT'); a.line(x - 26, y, x + 26, y, 'S-BOLT'); a.line(x, y - 26, x, y + 26, 'S-BOLT'); } else if (x) { a.line(x - 22, y, x + 22, y, 'S-BOLT'); a.line(x, y - 22, x, y + 22, 'S-BOLT'); a.circ(x, y, 5, 'S-BOLT'); } });
    dimO(a, -PX - 100, 0, -PX - 100, 45, 6, '45', 'b', '(TYP)'); dimO(a, -PX - 100, -45, -PX - 100, 0, 6, '45', 'a', '(TYP)');
    a.dim(0, 450, 600, 450, 6, '600 (NOM.)'); a.line(600, 60, 600, 470, 'S-DIM'); a.dim(-400, -560, 400, -560, -6, 'TAPPING SCREWS AT 400', { sub: 'CRS ALTERNATE SIDES OF' }); a.text(0, -560 - 11 * 20, 'STRINGER WEB', TH * 0.9, 'c', 't', 'S-DIM'); a.line(-400, 30, -400, -580, 'S-DIM'); a.line(400, -30, 400, -580, 'S-DIM');
    a.leader(-200, 45, -26, 40, 'BUILDEX WAFER HEAD TAPTITE SCREW\nOR SIMILAR APPROVED AT 400 CRS IN\nPREDRILLED HOLE TO MANUFACTURES\nDETAILS'); a.leader(820, b2, 10, 28, 'PROPOSED STEEL\nSTRINGER FLANGE\n(TYP)'); a.leader(-750 + 18, -300, -14, -14, '1mm BONDEK PERMANENT\nFORMWORK OR SIMILAR\nAPPROVED'); a.leader(1000, -45, 12, -16, 'ANCHOR BOLT\nM16x150 LONG\nBOLT (TYP)');
    ttl(a, 'PLAN', '', null, { h: 2.6 });
    const d1 = LY.view(5); det1(d1, u, true);
    LY.break();
    // ---- elevation
    const v = LY.view(20);
    v.line(-xb, OT, xb, OT, 'S-CONC'); v.line(-xb, 0, -xb, OT, 'S-CONC'); v.line(xb, 0, xb, OT, 'S-CONC'); v.brk(-xb, 20, -xb, OT - 20); v.brk(xb, 20, xb, OT - 20); aggr(v, -500, 150); aggr(v, 700, 150);
    fabDash(v, -xb, xb, 76); fabDash(v, -xb, xb, 185); bondek(v, -xb, xb);
    [-1, 1].forEach(k => { iElevWebH(v, min(k * 10, k * xb), max(k * 10, k * xb), -d / 2, u); v.brk(k * xb, -d - 25, k * xb, 25); [60, 450].forEach(x => rodV(v, k * x, -d + u.tf, ycT - c.tf, { pr: 18 })); rodV(v, k * 50, ycB + c.tf, ycp, { pr: 18 }); v.rect(k * q.b / 2 - 5, ycB + c.tf, 10, dc - 2 * c.tf); });
    v.line(-10, 0, -10, OT, 'S-NEW'); v.line(10, 0, 10, OT, 'S-NEW');
    iElevWebH(v, -500, 500, ycT - dc / 2, c); v.rect(-140, ycp, 280, 16); iElevWebV(v, 0, ycp - 520, ycp, q); v.brk(-q.d / 2 - 20, ycp - 520, q.d / 2 + 20, ycp - 520);
    [-1400, -1000, 1000, 1400].forEach(x => anchorBolt(v, x)); [-1200, -800, -400, 400, 800, 1200].forEach(x => { v.line(x - 6, 2, x - 6, -u.tf - 8, 'S-BOLT'); v.line(x + 6, 2, x + 6, -u.tf - 8, 'S-BOLT'); v.rect(x - 14, 2, 28, 6, 'S-BOLT'); });
    v.circ(-1000, 40, 110, 'S-TEXT'); { const qq = v.P(-1000, 40); v.add({ t: 'line', a: [qq[0] + 2.5, qq[1] + 4.8], b: [qq[0] + 4.5, qq[1] + 12], L: 'S-TEXT' }); v.add({ t: 'circle', c: [qq[0] + 5, qq[1] + 15.4], r: 3.2, L: 'S-TEXT' }); v.add({ t: 'text', p: [qq[0] + 5, qq[1] + 15.4], s: '1', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
    v.cl(0, ycp - 560, 0, OT + 420, 'PIER'); cutV(v, 1000, OT + 380, ycB - 60, 'A', 180, 8); cutH(v, -xb - 160, xb + 160, 100, 'B');
    v.dim(-1000, OT + 260, 0, OT + 260, 6, '1000 (NOM.)'); v.dim(0, OT + 260, 1000, OT + 260, 6, '1000 (NOM.)'); v.dim(1000, OT + 260, 1700, OT + 260, 6, 'ANCHOR BOLTS', { sub: '@ 400 CRS (TYP)' }); v.line(-1000, 120, -1000, OT + 280, 'S-DIM'); v.line(1000, 120, 1000, OT + 280, 'S-DIM');
    dimO(v, -1400, OT + 120, -1000, OT + 120, 6, '400', 'a', '(TYP)'); v.line(-1400, 120, -1400, OT + 140, 'S-DIM');
    dimO(v, -10, OT + 120, 0, OT + 120, 6, '10', 'a'); dimO(v, 0, OT + 120, 10, OT + 120, 6, '10', 'b');
    dimO(v, -60, -d / 2 - 40, -10, -d / 2 - 40, 6, '50', 'a', '(TYP)'); dimO(v, 450, -d / 2 - 40, 500, -d / 2 - 40, 6, '50', 'a', '(TYP)'); v.line(450, -d + u.tf + 30, 450, -d / 2 - 40, 'S-DIM'); v.line(500, ycT + 20, 500, -d / 2 - 40, 'S-DIM'); v.line(-60, -d + u.tf + 30, -60, -d / 2 - 40, 'S-DIM');
    v.leader(-700, 30, -10, 36, 'BONDEK\nSHEETING'); v.leader(-800, -u.tf, -8, -40, 'BUILDEX WAFER\nHEAD TAPTITE'); v.leader(1350, OT - 40, 12, -4, 'PROPOSED CONCRETE\nOVERLAY', { dot: true }); v.leader(1300, -200, 16, 0, 'PROPOSED STEEL\nSTRINGER (TYP)', { dot: true });
    v.leader(1000, -u.tf - 30, 14, -40, 'ANCHOR BOLT\n(TYP)'); v.leader(-q.d / 2, ycp - 300, -14, 0, 'PROPOSED STEEL\nSTUB COLUMN'); v.leader(300, ycB, 10, -26, 'PROPOSED STEEL\nCORBEL');
    v.noteBox(-xb - 600, ycp - 300, 'NOTE: STRINGER & CORBEL\nSIZE WILL VARY ACCORDING\nTO ENGINEERING REQUIREMENTS\n' + secName(p.ub) + ' STRINGER DRAWN\n' + secName(p.cor) + ' CORBEL DRAWN', 46, { h: 1.8 });
    v.noteBox(1100, ycp - 340, 'NOTE: FOR STUB COLUMN AND CAP PLATE\nDETAILS REFER TO PN30_2311 & 2312', 58, { h: 1.8 });
    ttl(v, 'ELEVATION', '', null, { h: 2.6 });
    // ---- sectional elevation A
    const w = LY.view(20);
    w.line(-400, OT, 400, OT, 'S-CONC'); w.brk(-400, -20, -400, OT + 20); w.brk(400, -20, 400, OT + 20); w.line(-400, 0, -b2, 0, 'S-CONC'); w.line(b2, 0, 400, 0, 'S-CONC'); fabDash(w, -400, 400, 76); fabDash(w, -400, 400, 185); w.line(-400, 2, 400, 2, 'S-NEW'); aggr(w, -230, 150);
    iFill(w, 0, -d / 2, u); [-45, 45].forEach(x => anchorBolt(w, x)); iSec(w, 0, ycT - dc / 2, c); w.rect(-c.b / 2 + 3, ycB + c.tf, c.b - 6, dc - 2 * c.tf); w.line(-c.tw / 2, ycB + c.tf, -c.tw / 2, ycT - c.tf); w.line(c.tw / 2, ycB + c.tf, c.tw / 2, ycT - c.tf);
    [-1, 1].forEach(k => { rodV(w, k * 40, -d + u.tf, ycT - c.tf, { pr: 18 }); rodV(w, k * 40, ycB + c.tf, ycp, { pr: 18 }); });
    w.rect(-140, ycp, 280, 16); iElevFlange(w, 0, ycp - 330, ycp, q); w.brk(-q.b / 2 - 20, ycp - 330, q.b / 2 + 20, ycp - 330);
    w.cl(0, ycp - 380, 0, OT + 380, 'STRINGER'); dimO(w, -45, OT + 180, 0, OT + 180, 6, '45', 'a', '(TYP)'); dimO(w, 0, OT + 180, 45, OT + 180, 6, '45', 'b', '(TYP)');
    secLeader(w, u.tw / 2, -d / 2, 36, 0, secName(p.ub), ' STRINGER'); secLeader(w, c.tw / 2, ycT - dc / 2, 36, 0, secName(p.cor), ' CORBEL x\n1000 LONG');
    w.leader(-40, -d + u.tf + 10, -22, 14, 'M20 BOLT (TYP)'); w.leader(-c.b / 4, ycT - dc / 2, -30, -6, '10 FL STIFFENER\n(TYP)', { dot: true }); weldTail(w, -c.tw / 2 - 2, ycT - c.tf - 30, -8, 8, { size: '6', all: true }, 'TYP');
    ttl(w, 'SECTIONAL ELEVATION', 'A', 20);
    LY.caption('PIER - WIDENING & ADDITIONAL STRINGER DETAIL', 20, 'SPAN N° X TO X - STRINGER N° X', { ref: 'XX30-XXXX' });
    return drgBox(LY.done());
  }, 'Widening the deck with an additional steel stringer on a steel corbel and stub column, with Bondek permanent formwork and M16x150 anchor bolts into a proposed concrete overlay.');
})(typeof window !== 'undefined' ? window : globalThis);
