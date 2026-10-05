/* StructCap Timber — repair details: MRWA project standard drawings 1330-0012 … 0027.
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;


  // ==================================================================== sheet-faithful redraw (1330-0012 … 0027)
  // Every detail is laid out like its A3 source sheet, enlarged to the A1 sheet the scales refer to:
  // positions are given in source-sheet pixels (A3 at 100 dpi, 1 px = 0.508 A1 paper mm) so views, notes and titles
  // sit where the sheet has them. Views are drawn in model mm at their own scale about an origin placed on the sheet.
  const KX = 0.508;
  const X = px => px * KX, Y = py => -py * KX;
  // view with its model origin at sheet pixel (px, py)
  function vw(B, s, px, py) { const v = B.view(s, X(px), Y(py)); return v; }
  // leader: arrow at model (x, y), shoulder at sheet pixel (spx, spy); text on the side away from the arrow
  function ld(v, x, y, spx, spy, s, o) { const a = v.P(x, y); return v.leader(x, y, X(spx) - a[0], Y(spy) - a[1], s, o); }
  // one note, several arrows: pts model points; shoulder at sheet pixel
  function lds(v, pts, spx, spy, s, o) { const a = v.P(pts[0][0], pts[0][1]); v.leaders(pts, X(spx) - a[0], Y(spy) - a[1], s, o); }
  // weld symbol with its knee at sheet pixel; extra arrows (more model points) from the knee
  function wd(v, pts, kpx, kpy, o) {
    const a = v.P(pts[0][0], pts[0][1]), kx = X(kpx), ky = Y(kpy); v.weld(pts[0][0], pts[0][1], kx - a[0], ky - a[1], o || {});
    pts.slice(1).forEach(q => { const b = v.P(q[0], q[1]); v.add({ t: 'line', a: [kx, ky], b, L: 'S-TEXT' }); v.arrow(q[0], q[1], Math.atan2(b[1] - ky, b[0] - kx) * 180 / PI); });
  }
  // plain text at a sheet pixel (left aligned unless al)
  function tx(B, px, py, s, h, al) { String(s).split('\n').forEach((l, i) => B.E.push({ t: 'text', p: [X(px), Y(py) - i * (h || TH) * 1.55], s: l, h: h || TH, al: al || 'l', v: 'b', ang: 0, L: 'S-TEXT' })); }
  // view title centred at sheet pixel; main (bullet) caption centred at sheet pixel; notes at sheet pixel
  function vt(B, px, py, s, sc, sub) { B.title(X(px), Y(py), s, sc, sub); }
  function mt(B, px, py, s, sc, sub, ref) { B.mainTitle(X(px), Y(py), s, sc, sub, ref ? { ref } : {}); }
  function nt(B, px, py, lines, wpx) { return B.notes(X(px), Y(py), lines, (wpx || 270) * KX); }
  const GN = 'FOR GENERAL NOTES REFER DRAWING No. 1330-0001.';
  const SHIM = 'STEEL SHIMS TO BE (3, 5, 8, 10, OR 12 FL) WIDTH AND LENGTH TO SUIT. TACK WELD TOGETHER ONCE IN PLACE.';
  const PROP = 'TIMBER HALF-CAPS/FULL-CAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL POSITIONS.';
  // section marker with a drawing reference beside it
  function mk(v, x, y, ch, dir, ref) { v.mark(x, y, ch, dir); if (ref) { const p = v.P(x, y); v.add({ t: 'text', p: [p[0] + 4, p[1] - 1], s: ref, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); } }
  // detail call-out circle (dash-dot outline) with a numbered bubble on a leader
  function callout(v, x, y, r, n, bx, by, ref) { v.circ(x, y, r, 'S-TEXT'); const a = v.P(x + r * 0.7, y - r * 0.7), b = v.P(bx, by); v.add({ t: 'line', a, b: [b[0] - 2.2, b[1] + 2.2], L: 'S-TEXT' }); v.add({ t: 'circle', c: b, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p: b, s: String(n), h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); if (ref) { const lf = b[0] < a[0]; v.add({ t: 'text', p: [b[0] + (lf ? -4.5 : 4.5), b[1] - 1], s: ref, h: TH, al: lf ? 'r' : 'l', v: 'b', ang: 0, L: 'S-TEXT' }); } }
  // timber section box (existing): rectangle with diagonals
  const tbx = (v, x, y, w, h) => timberX(v, x, y, w, h, 'S-EXIST');
  // horizontal timber member in elevation (existing): two dash-dot lines with break lines at both ends
  function tbeam(v, x0, x1, y0, y1, noBrk) { v.line(x0, y0, x1, y0, 'S-EXIST'); v.line(x0, y1, x1, y1, 'S-EXIST'); if (!noBrk) { zz(v, x0, y0, y1); zz(v, x1, y0, y1); } }
  // vertical break line (Z) at x between y0..y1
  function zz(v, x, y0, y1, L) { const m = (y0 + y1) / 2, z = 2 * v.s; v.pl([[x, y0], [x, m - z], [x - z, m - z * 0.3], [x + z, m + z * 0.3], [x, m + z], [x, y1]], false, L || 'S-TEXT'); }
  // horizontal break line (Z) at y between x0..x1
  function zh(v, y, x0, x1, L) { const m = (x0 + x1) / 2, z = 2 * v.s; v.pl([[x0, y], [m - z, y], [m - z * 0.3, y - z], [m + z * 0.3, y + z], [m + z, y], [x1, y]], false, L || 'S-TEXT'); }
  // log (round timber) seen end-on, existing, with S-break bulge on one side for stringer elevations
  function logX(v, x, y, r) { v.circ(x, y, r, 'S-EXIST'); }
  // log stringer in elevation ending in an S-break at x0 (towards -x)
  function logElev(v, x0, x1, yb, D) { v.line(x0, yb, x1, yb, 'S-EXIST'); v.line(x0, yb + D, x1, yb + D, 'S-EXIST'); v.pileEnd(x0, yb + D / 2, D, 'S-EXIST', 1); }
  // bolt hole with square washer seen end-on
  function bw(v, x, y, w) { v.boltEnd(x, y, 22); v.rect(x - (w || 65) / 2, y - (w || 65) / 2, w || 65, w || 65, 'S-BOLT'); }
  // threaded rod side-on with dashed shank inside timber between xa..xb and nuts at both ends (horizontal)
  function rodH(v, x1, x2, y, d) { d = d || 20; v.line(x1 - 30, y + d / 2, x2 + 30, y + d / 2, 'S-HIDDEN'); v.line(x1 - 30, y - d / 2, x2 + 30, y - d / 2, 'S-HIDDEN'); v.nut(x1, y, -1, 0, d); v.nut(x2, y, 1, 0, d); }
  function rodV(v, x, y1, y2, d) { d = d || 20; v.line(x + d / 2, y1 - 30, x + d / 2, y2 + 30, 'S-HIDDEN'); v.line(x - d / 2, y1 - 30, x - d / 2, y2 + 30, 'S-HIDDEN'); v.nut(x, y1, 0, -1, d); v.nut(x, y2, 0, 1, d); }
  // UC corbel end-on (I section, flanges horizontal) with top at y
  const ucEnd = (v, x, yt, s, L) => iSec(v, x, yt - s.d / 2, s, 0, L);
  // UC seen on the web, vertical between y0..y1 (flange lines both sides)
  const ucWebV = (v, x, y0, y1, s, L) => iElevWebV(v, x, y0, y1, s, L);
  // filled weld triangle (fillet seen in section) at corner (x,y), legs a along +dx / +dy
  function fw(v, x, y, a, dx, dy) { v.fill([[x, y], [x + dx * a, y], [x, y + dy * a]]); }
  // PFC section with existing (dash-dot) layer helper
  const pfcX = (v, cx, cy, s, dir, L) => cSec(v, cx, cy, s, dir, L);
  // circle filled bullet (MRWA weld-all-round / site dot on leaders)
  function dot(v, x, y) { const p = v.P(x, y); v.add({ t: 'circle', c: p, r: 0.9, L: 'S-TEXT' }); }
  // level marker: filled triangle on the level at model (x, y), stem up to a shoulder at sheet pixel (spx, spy), label beside it
  function lvl(v, x, y, spx, spy, s) {
    const p = v.P(x, y), sx = X(spx), sy = Y(spy), left = sx < p[0];
    v.add({ t: 'solid', p: [p, [p[0] - 1.6, p[1] + 2.6], [p[0] + 1.6, p[1] + 2.6]], L: 'S-TEXT' });
    v.add({ t: 'pl', p: [[p[0], p[1] + 2.6], [p[0], sy], [sx, sy]], closed: false, L: 'S-TEXT' });
    String(s).split('\n').forEach((l, i) => v.add({ t: 'text', p: [sx + (left ? -1 : 1), sy - TH / 2 - i * TH * 1.55], s: l, h: TH, al: left ? 'r' : 'l', v: 'b', ang: 0, L: 'S-TEXT' }));
  }
  // hatched thin plate (shim / packer) rectangle
  function shim(v, x, y, w, h) { v.rect(x, y, w, h, 'S-NEW'); v.hatch([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 'ansi31', 'S-HATCH', 0.5); }
  // existing deck + log stringer seen in elevation above a cap whose top is at y0; stringer from xl (abuts sheeting) to xr (log S-break)
  function deckStr(v, xl, xd, xr, y0, Ds, td, nPl) {
    const yt = y0 + Ds; v.pl([[xl, y0], [xr - Ds / 4, y0]], false, 'S-EXIST'); v.pl([[xl, yt], [xr - Ds / 4, yt]], false, 'S-EXIST'); v.pileEnd(xr - Ds / 4, y0 + Ds / 2, Ds, 'S-EXIST', 1);
    v.line(xd, yt, xr, yt, 'S-EXIST'); v.line(xd, yt + td, xr, yt + td, 'S-EXIST'); v.line(xd, yt, xd, yt + td, 'S-EXIST'); zz(v, xr, yt, yt + td);
    const n = nPl || 4; for (let i = 1; i <= n; i++) { const x = xd + (xr - xd) * i / (n + 1); v.line(x, yt, x, yt + td, 'S-EXIST'); }
  }
  // section-cut pair: filled wedge at the left end, circled letter (pointer down) at the right end, at model level y
  function cutLR(v, x1, x2, y, ch) { const a = v.P(x1, y), b = v.P(x2, y); v.add({ t: 'solid', p: [[a[0] - 8, a[1] + 0.2], [a[0], a[1] + 0.2], [a[0] - 4, a[1] - 1.6]], L: 'S-TEXT' }); v.add({ t: 'line', a: [a[0] - 8, a[1] + 0.2], b: [a[0] + 2, a[1] + 0.2], L: 'S-TITLE' }); v.add({ t: 'line', a: [b[0] - 6, b[1]], b: [b[0] - 3, b[1]], L: 'S-TITLE' }); v.mark(x2, y, ch, 270); }
  // re-origin a finished detail: ax / ay = fraction of the extent placed left of / below the origin (0.5 = centred)
  function reorigin(E, ax, ay) { const b = A.bbox(E), dx = -(b.x0 + (b.x1 - b.x0) * ax), dy = -(b.y0 + (b.y1 - b.y0) * ay); E.forEach(e => A.shiftE(e, dx, dy)); return E; }

  // ---------------------------------------------------------------- 1330-0012 PIER PILE REPAIR TOP DETAILS - SHEET 1 OF 2 (TYPE 1 / TYPE 4)
  // channel between two timber half-caps sitting on a UC corbel: view across the half-caps (VIEW B / C)
  function hcPair(v, hc, g, hw, s, pfc) {
    tbx(v, -g / 2 - hw, 0, hw, hc); tbx(v, g / 2, 0, hw, hc);
    v.rect(-g / 2, 0, g, hc - 20, 'S-NEW'); v.line(-g / 2 + pfc.tf, 0, -g / 2 + pfc.tf, hc - 20, 'S-NEW'); v.line(g / 2 - pfc.tf, 0, g / 2 - pfc.tf, hc - 20, 'S-NEW');
    [hc - 75, 75].forEach(y => { rodH(v, -g / 2 - hw, -g / 2 + pfc.tf, y); rodH(v, g / 2 - pfc.tf, g / 2 + hw, y); });
  }
  // half-cap seen along its length with the connection channel and two bolts (ELEVATION)
  function hcAlong(v, hc, xl, xr, pfc) {
    tbeam(v, xl, xr, 0, hc); v.rect(-pfc.b / 2 + 10, 0, pfc.b, hc - 20, 'S-HIDDEN'); [hc - 75, 75].forEach(y => bw(v, 10, y, 65));
  }
  def('pphc1', 'Halfcaps', 'Pier pile repair – half-cap bearing Types 1 & 4', '1330-0012', [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('hc', 'Halfcap depth (mm)', 300, { num: 1 }), P('gap', 'Gap between halfcaps (mm)', 140, { num: 1 }), P('pfc', 'Connection channel', '150PFC', { opts: ['125PFC', '150PFC', '180PFC', '200PFC'] })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], hc = max(200, +p.hc || 300), g = max(100, +p.gap || 140), hw = 200, pc = SEC[p.pfc] || SEC['150PFC'], d = s.d, b = s.b;
    // ---- TYPE 1 : ELEVATION
    let v = vw(B, 10, 243, 209);
    hcAlong(v, hc, -520, 520, pc); ucEnd(v, 0, 0, s); v.rect(-b / 2, -d, b, d, 'S-NEW'); iElevFlange(v, 0, -d - 360, -d, s); zh(v, -d - 360, -b / 2 - 30, b / 2 + 30);
    v.cl(0, -d - 420, 0, hc + 120, 'PILE'); mk(v, 180, hc + 300, 'A', 270, '1330-0013'); v.mark(270, -190, 'B', 180);
    ld(v, -115, hc, 179, 93, 'EXISTING TIMBER\nHALF-CAP'); ld(v, -b / 2, -d / 2 + 30, 211, 251, '90 x 12FL STIFFENER WITH\n20 CHAMFER TO CLEAR UC\nRADIUS (TYP.)'); ld(v, b / 2, -d - 120, 284, 290, 'PROPOSED\nUC PILE');
    vt(B, 238, 360, 'ELEVATION');
    // ---- TYPE 1 : VIEW B
    v = vw(B, 10, 584, 210); const Lc = d / 2 + 200;
    hcPair(v, hc, g, hw, s, pc); iElevWebH(v, -Lc, Lc, -d / 2, s); [-1, 1].forEach(k => v.rect(k > 0 ? d / 2 - 12 : -d / 2, -d + s.tf, 12, d - 2 * s.tf, 'S-NEW'));
    ucWebV(v, 0, -d - 330, -d, s); zh(v, -d - 330, -d / 2 - 30, d / 2 + 30);
    v.dim(-Lc, -d, -d / 2, -d, -9, '200'); v.dim(d / 2, -d, Lc, -d, -9, '200');
    ld(v, 0, hc - 20, 606, 91, 'REFER TO HALF-CAP\nCONNECTION CHANNEL\n- TYPE A\nON DRG N° 1330-0013'); ld(v, g / 2 + hw + 30, hc - 75, 711, 138, 'φ20 THREADED ROD WITH\n1-65x5FLx65 WASHER TO\nTIMBER FACE (TYP.)');
    ld(v, Lc, -d, 663, 275, 'UC CORBEL SIZE TO MATCH\nPROPOSED UC PILE');
    wd(v, [[-d / 2 + 6, -d / 2]], 511, 244, { size: '6', both: true, tail: 'TYP.' }); wd(v, [[d / 2, -12], [d / 2, -d + 12]], 618, 229, { tail: 'TYP.' }); wd(v, [[-d / 2, -d], [d / 2, -d]], 545, 280, {});
    vt(B, 590, 360, 'VIEW B');
    mt(B, 418, 403, 'PIER PILE REPAIR HALF-CAP BEARING DETAIL - TYPE 1', 10);
    // ---- TYPE 4 : ELEVATION
    const pk = 75, pd = 300, yl = -pk - pd; // existing timber packer and PFC strengthening under the half-cap
    v = vw(B, 10, 271, 701);
    hcAlong(v, hc, -460, 460, pc); v.line(-460, -pk, 460, -pk, 'S-EXIST'); v.line(-460, -pk - 16, 460, -pk - 16, 'S-EXIST'); v.line(-460, yl + 16, 460, yl + 16, 'S-EXIST'); v.line(-460, yl, 460, yl, 'S-EXIST'); zz(v, -460, yl, -pk); zz(v, 460, yl, -pk);
    v.rect(-b / 2, -d - 520, b, d + 520, 'S-NEW'); v.line(0, 0, 0, -d, 'S-NEW'); v.line(0, -d, 0, -d - 520, 'S-HIDDEN'); [-d, yl, yl - d].forEach(y => { v.line(-b / 2, y, b / 2, y, 'S-NEW'); v.line(-b / 2, y - 12, b / 2, y - 12, 'S-NEW'); }); zh(v, -d - 520, -b / 2 - 30, b / 2 + 30);
    v.boltEnd(-60, -150, 22); v.boltEnd(60, -300, 22);
    v.dim(-g / 2, hc, g / 2, hc, 14, String(g)); v.text(-g / 4, hc + 60, '=', 2, 'c'); v.text(g / 4, hc + 60, '=', 2, 'c');
    v.cl(0, -d - 560, 0, hc + 230, 'PILE'); mk(v, 0, hc + 380, 'A', 270, '1330-0013'); v.mark(760, -350, 'C', 180);
    ld(v, -180, hc, 180, 601, 'EXISTING TIMBER\nHALF-CAP'); ld(v, -400, -36, 130, 730, 'EXISTING\nTIMBER\nPACKER', { dot: true }); ld(v, -300, yl, 200, 798, 'EXISTING PFC HALF-CAP\nSTRENGTHENING'); ld(v, -b / 2, -700, 168, 856, 'PROPOSED UC PILE');
    vt(B, 275, 915, 'ELEVATION');
    // ---- TYPE 4 : VIEW C
    v = vw(B, 10, 646, 704); const tf = s.tf, yc = yl; // lower corbel top
    hcPair(v, hc, g, hw, s, pc);
    v.pl([[d / 2, 0], [-d / 2 - 200, 0], [-d / 2 - 200, -d], [-d / 2, -d]], false, 'S-NEW'); v.line(-d / 2 - 200, -tf, d / 2 - tf, -tf, 'S-NEW'); v.line(-d / 2 - 200, -d + tf, -d / 2 + tf, -d + tf, 'S-NEW'); v.line(d / 2, 0, -d / 2, -d, 'S-NEW');
    v.line(-d / 2, -d, -d / 2, -d - 470, 'S-NEW'); v.line(d / 2, 0, d / 2, -d - 470, 'S-NEW'); v.line(-d / 2 + tf, -d + tf, -d / 2 + tf, -d - 470, 'S-NEW'); v.line(d / 2 - tf, -tf, d / 2 - tf, -d - 470, 'S-NEW'); zh(v, -d - 470, -d / 2 - 30, d / 2 + 30);
    v.rect(-d / 2, -d + tf, 12, d - 2 * tf, 'S-NEW');
    [-d, yc, yc - d].forEach(y => v.rect(-d / 2 + tf, y - 6, d - 2 * tf, 12, 'S-NEW'));
    iElevWebH(v, d / 2, d / 2 + 200, yc - d / 2, s);
    tbx(v, d / 2 + 10, -pk, hw - 10, pk); v.rect(d / 2, yl, 8, pd + pk - pk, 'S-NEW'); cSec(v, d / 2 + 8, yl + pd / 2, SEC['300PFC'], 1, 'S-EXIST');
    [-pk - 70, yl + 70].forEach(y => v.bolt(d / 2 - tf, y, d / 2 + 8 + 8, y, 20));
    v.dim(d / 2 + 200, -pk, d / 2 + 200, yl, -12, 'REFER\nNOTE 2.'.replace('\n', ' '));
    v.dim(-d / 2 - 200, -d, -d / 2, -d, -10, '200');
    ld(v, 0, hc - 20, 609, 584, 'REFER TO HALF-CAP\nCONNECTION CHANNEL\n- TYPE A\nON DRG N° 1330-0013'); ld(v, -d / 4, -d / 4 - d / 4, 577, 681, 'MITRE CUT UC SECTION LENGTH\nTO SUIT PROPOSED UC PILE');
    ld(v, -d / 2 + 6, -d / 2 - 40, 549, 700, '90 x 12FL STIFFENERS\nBOTH SIDES OF WEB'); ld(v, -d / 2 - 200, -d / 2, 531, 721, 'UC CORBEL SIZE TO\nMATCH PROPOSED PILE');
    ld(v, g / 2 + hw + 30, hc - 75, 759, 622, 'φ20 THREADED ROD WITH 1-65x5FLx65\nWASHER TO TIMBER FACE (TYP.)'); ld(v, d / 2 + 30, -pk - 70, 759, 675, 'M20 BOLT (TYP.) DRILL φ22 HOLES\nON SITE TO SUIT');
    ld(v, d / 2 + 4, yl + 40, 765, 817, 'GALV. STEEL SHIM\n(IF REQUIRED)\nREFER NOTE 3.'); ld(v, d / 2 + 200, yc - d / 2, 763, 868, 'UC CORBEL SIZE TO\nMATCH PROPOSED PILE\nx 200 LONG');
    ld(v, 20, yc - d, 638, 868, '3 - 90 x 12FL STIFFENERS\n(TYP. BOTH SIDES OF WEB)');
    vt(B, 655, 918, 'VIEW C');
    // ---- TYPE 4 : VIEW C (FABRICATION DETAILS)
    v = vw(B, 10, 1162, 705);
    v.pl([[-g / 2, hc - 20], [-g / 2, 0]], false, 'S-NEW'); v.pl([[g / 2, hc - 20], [g / 2, 0]], false, 'S-NEW'); v.line(-g / 2 + pc.tf, 0, -g / 2 + pc.tf, hc - 20, 'S-NEW'); v.line(g / 2 - pc.tf, 0, g / 2 - pc.tf, hc - 20, 'S-NEW'); v.line(-g / 2, hc - 20, g / 2, hc - 20, 'S-NEW');
    v.pl([[d / 2, 0], [-d / 2 - 200, 0], [-d / 2 - 200, -d], [-d / 2, -d]], false, 'S-NEW'); v.line(-d / 2 - 200, -tf, d / 2 - tf, -tf, 'S-NEW'); v.line(-d / 2 - 200, -d + tf, -d / 2 + tf, -d + tf, 'S-NEW'); v.line(d / 2, 0, -d / 2, -d, 'S-NEW');
    v.line(-d / 2, -d, -d / 2, -d - 470, 'S-NEW'); v.line(d / 2, 0, d / 2, -d - 470, 'S-NEW'); v.line(-d / 2 + tf, -d + tf, -d / 2 + tf, -d - 470, 'S-NEW'); v.line(d / 2 - tf, -tf, d / 2 - tf, -d - 470, 'S-NEW'); zh(v, -d - 470, -d / 2 - 30, d / 2 + 30);
    v.rect(-d / 2, -d + tf, 12, d - 2 * tf, 'S-NEW'); [-d, yc, yc - d].forEach(y => v.rect(-d / 2 + tf, y - 6, d - 2 * tf, 12, 'S-NEW')); iElevWebH(v, d / 2, d / 2 + 200, yc - d / 2, s);
    v.circ(d / 2 - 10, -10, 40, 'S-TEXT'); v.circ(-d / 2 + 10, -d + 10, 40, 'S-TEXT');
    // enlarged circles: outside corner (top right) and stiffener crossing (left)
    const big = (cx, cy, r, corner) => {
      v.circ(cx, cy, r, 'S-TEXT');
      if (corner) { v.line(cx - r * 0.95, cy + 40, cx + 40, cy + 40, 'S-NEW'); v.line(cx - r * 0.9, cy + 10, cx + 10, cy + 10, 'S-NEW'); v.line(cx + 40, cy + 40, cx + 40, cy - r * 0.95, 'S-NEW'); v.line(cx + 10, cy + 10, cx + 10, cy - r * 0.9, 'S-NEW'); v.line(cx + 40, cy + 40, cx - r * 0.6, cy - r * 0.6, 'S-NEW'); v.fill([[cx + 10, cy + 10], [cx + 40, cy + 10], [cx + 40, cy + 40], [cx + 10, cy + 40]]);
        for (let t = 0.1; t < 0.95; t += 0.06) { const x = cx + 40 - t * (r * 0.6 + 40), y = cy + 40 - t * (r * 0.6 + 40); v.line(x, y, x - 14, y + 14, 'S-NEW'); } }
      else { v.line(cx - 15, cy + r * 0.95, cx - 15, cy - r * 0.95, 'S-NEW'); v.line(cx + 15, cy + r * 0.95, cx + 15, cy - r * 0.95, 'S-NEW'); v.line(cx - r * 0.95, cy - 15, cx + r * 0.95, cy - 15, 'S-NEW'); v.line(cx - r * 0.95, cy + 15, cx + r * 0.95, cy + 15, 'S-NEW'); v.line(cx, cy, cx + r * 0.6, cy + r * 0.6, 'S-NEW'); v.fill([[cx - 15, cy - 15], [cx + 15, cy - 15], [cx + 15, cy + 15], [cx - 15, cy + 15]]);
        for (let t = 0.15; t < 0.95; t += 0.07) { const x = cx + t * r * 0.6, y = cy + t * r * 0.6; v.line(x, y, x + 14, y - 14, 'S-NEW'); } }
    };
    big(440, 360, 175, true); big(-800, -340, 205, false);
    v.line(d / 2 + 25, 20, 440 - 120, 360 - 125, 'S-TEXT'); v.line(-d / 2 - 25, -d + 5, -800 + 200, -340 + 30, 'S-TEXT');
    ld(v, 440 - 60, 360 - 60, 1218, 590, 'MITRE CUT'); ld(v, 440 + 25, 360 + 25, 1280, 598, '90° OUTSIDE\nCORNER FILLET\nWELD');
    ld(v, -800 + 80, -340 + 80, 991, 694, 'MITRE CUT'); ld(v, -815, -340 + 120, 993, 718, 'STIFFENER'); ld(v, -800 + 150, -340 + 15, 1039, 761, 'STIFFENER'); ld(v, -800 - 10, -340 - 10, 996, 823, '90° OUTSIDE\nCORNER FILLET\nWELD');
    wd(v, [[-g / 2 + 30, 0]], 1107, 665, { size: '6', all: true }); wd(v, [[-d / 2, -20], [-d / 2, -d + 20]], 1100, 727, { tail: 'TYP.' });
    wd(v, [[d / 2 - tf, -d]], 1227, 717, { size: '6', both: true, tail: 'TYP.' }); wd(v, [[d / 2, yc]], 1225, 754, {}); wd(v, [[d / 2, yc - 30], [d / 2, yc - d + 20]], 1225, 846, { size: '6', both: true });
    wd(v, [[0, yc - d]], 1107, 864, { size: '6', both: true, all: true, tail: 'TYP.' });
    wd(v, [[440 - 40, 360 - 40]], 1155, 608, {}); wd(v, [[-815, -340 + 60]], 950, 713, {}); wd(v, [[-800 + 5, -340 - 30]], 1048, 803, {});
    vt(B, 1160, 920, 'VIEW C', null, '(FABRICATION DETAILS)');
    mt(B, 707, 986, 'PIER PILE REPAIR HALF-CAP BEARING DETAIL - TYPE 4', 10);
    nt(B, 1095, 1050, [GN, 'DIMENSION TO BE MEASURED ON SITE PRIOR TO FABRICATION AND CONSTRUCTION', SHIM.replace('10, OR', '10, OR')], 270);
    return B.E;
  }, 'UC pile repair under a pier half-cap: Type 1 UC corbel under both half-caps; Type 4 mitred UC corbel where an existing PFC half-cap strengthening is retained (after MRWA 1330-0012).');
  // ---------------------------------------------------------------- 1330-0013 PIER PILE REPAIR TOP DETAILS - SHEET 2 OF 2 (TYPE 5 / TYPE 6, VIEW A, CHANNELS TYPE A / B)
  // half-cap, packer and existing PFC strengthening seen along the half-cap (y = 0 at the underside of the PFC strengthening)
  function elevPFC(v, hc, pk, pd, xl, xr) {
    const yh = pd + pk; tbeam(v, xl, xr, yh, yh + hc); v.line(xl, yh, xr, yh, 'S-EXIST');
    [pd, pd - 16, 16, 0].forEach(y => v.line(xl, y, xr, y, 'S-EXIST')); zz(v, xl, 0, pd); zz(v, xr, 0, pd);
  }
  // channel Type A / B elevation (x = 0 at the channel back, y = 0 at the underside of the timber half-cap)
  function chanElev(v, hc, typeB, pfc) {
    const bot = typeB ? -400 : 0, e = 45; v.rect(0, bot, pfc.b, hc - 20 - bot, 'S-NEW'); v.line(pfc.tw, bot, pfc.tw, hc - 20, 'S-HIDDEN');
    const holes = typeB ? [hc - 75, 75, -175, -325] : [hc - 75, 75]; holes.forEach(y => v.circ(e, y, 11, 'S-BOLT'));
    v.line(-430, hc, typeB ? 300 : 380, hc, 'S-TEXT'); v.line(-430, 0, typeB ? 0 : 380, 0, 'S-TEXT');
    if (typeB) { v.line(150, -100, 750, -100, 'S-TEXT'); v.line(150, -400, 750, -400, 'S-TEXT'); }
    v.line(0, hc + 20, 0, hc + 260, 'S-DIM'); v.line(e, hc - 75, e, hc + 260, 'S-DIM');
    v.dim(0, hc + 220, e, hc + 220, 0, '35 (125 PFC)', { sub: '45 (150, 180 OR 200 PFC)' });
    v.dim(pfc.b + 150, hc - 20, pfc.b + 150, hc, 0, '20'); v.line(pfc.b, hc - 20, pfc.b + 180, hc - 20, 'S-DIM');
    v.dim(-130, hc - 75, -130, hc - 20, 0, '55'); v.dim(-130, 0, -130, 75, 0, '75'); v.line(-160, hc - 75, e, hc - 75, 'S-DIM'); v.line(-160, 75, e, 75, 'S-DIM'); v.line(-160, hc - 20, 0, hc - 20, 'S-DIM');
    if (typeB) { v.dim(400, -175, 400, -100, 0, '75'); v.dim(400, -400, 400, -325, 0, '75'); [-175, -325].forEach(y => v.line(e, y, 430, y, 'S-DIM')); }
  }
  function viewDE(v, hc, pk, pd, s, pc, g, hw, through) {
    const d = s.d, sh = 8, pf = SEC['300PFC'], xw = through ? d / 2 + sh : g / 2 + sh, yh = pd + pk, tf = s.tf;
    tbx(v, -g / 2 - hw, yh, hw, hc); tbx(v, g / 2, yh, hw, hc);
    [-1, 1].forEach(k => { tbx(v, k > 0 ? xw : -xw - 150, pd, 150, pk); cSec(v, k * xw, pd / 2, { d: pd, b: pf.b, tf: pf.tf, tw: pf.tw }, k, 'S-EXIST'); shim(v, k > 0 ? xw - sh : -xw, through ? 0 : 0, sh, pd); [pd - 110, 70].forEach(y => v.bolt(k * (xw - sh - (through ? tf : pc.tf)), y, k * (xw + pf.tw), y, 20)); });
    const top = yh + hc - 20, cb = through ? pd + 12 : 0;
    v.rect(-g / 2, cb, g, top - cb, 'S-NEW'); v.line(-g / 2 + pc.tf, cb, -g / 2 + pc.tf, top, 'S-NEW'); v.line(g / 2 - pc.tf, cb, g / 2 - pc.tf, top, 'S-NEW');
    [yh + hc - 75, yh + 75].forEach(y => { rodH(v, -g / 2 - hw, -g / 2 + pc.tf, y); rodH(v, g / 2 - pc.tf, g / 2 + hw, y); });
    const Lc = d / 2 + 200;
    if (through) {
      v.rect(-d / 2 - sh, pd, d + 2 * sh, 12, 'S-NEW'); ucWebV(v, 0, -d - 330, pd, s); [-1, 1].forEach(k => iElevWebH(v, k > 0 ? d / 2 : -Lc, k > 0 ? Lc : -d / 2, -d / 2, s));
      [-tf, -d + tf].forEach(y => v.rect(-d / 2 + tf, y - 6, d - 2 * tf, 12, 'S-NEW'));
    } else {
      iElevWebH(v, -Lc, Lc, -d / 2, s); [-1, 1].forEach(k => v.rect(k > 0 ? d / 2 - 12 : -d / 2, -d + tf, 12, d - 2 * tf, 'S-NEW')); ucWebV(v, 0, -d - 330, -d, s);
    }
    zh(v, -d - 330, -d / 2 - 30, d / 2 + 30);
    return { Lc, xw, yh, top };
  }
  def('hcch', 'Halfcaps', 'Pier pile repair – half-cap bearing Types 5 & 6, connection channels A / B', '1330-0013', [P('type', 'Show', 'ALL', { opts: ['ALL', 'A', 'B'] }), P('pfc', 'PFC size', '150PFC', { opts: ['125PFC', '150PFC', '180PFC', '200PFC'] }), P('hc', 'Timber halfcap depth (mm)', 300, { num: 1 }), P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('gap', 'Gap between halfcaps (mm)', 140, { num: 1 })], (p) => {
    const B = new Builder(), pc = SEC[p.pfc] || SEC['150PFC'], hc = max(200, +p.hc || 300), s = SEC[p.uc] || SEC['200UC52'], d = s.d, b = s.b, g = max(100, +p.gap || 140), hw = 190, pk = 75, pd = 300, all = !/^[AB]$/.test(p.type);
    const chans = (only) => {
      // VIEW A (plan on the channel)
      let v = vw(B, 10, 258, 851); const W = g / 2 + hw;
      [-1, 1].forEach(k => { v.line(-210, k * g / 2, 210, k * g / 2, 'S-EXIST'); v.line(-210, k * W, 210, k * W, 'S-EXIST'); zz(v, -210, k * g / 2, k * W); zz(v, 210, k * g / 2, k * W); });
      v.rect(-100, -W, 205, 2 * W, 'S-HIDDEN'); cSec(v, -5, 0, { d: g, b: pc.b, tf: pc.tf, tw: pc.tw }, 1, 'S-NEW');
      rodV(v, 40, -W, -g / 2 + pc.tf); rodV(v, 40, g / 2 - pc.tf, W);
      v.dim(-390, -g / 2, -390, g / 2, 0, 'GAP VARIES');
      ld(v, -5, 20, 213, 777, 'HALF-CAP CONNECTION\nCHANNEL'); ld(v, 160, W - 80, 325, 790, 'EXISTING TIMBER HALF-CAP\n(TYP.)', { dot: true }); ld(v, 70, -g / 2 + 10, 327, 841, '125 - 200 PFC SHIMMED TO FIT\nGAP BETWEEN TIMBER OR STEEL\nHALF-CAPS. REFER NOTE 3.');
      ld(v, 105, -W, 286, 932, 'UC CORBEL OR\nCAP PLATE'); wd(v, [[0, -g / 2]], 207, 941, { size: '6', all: true });
      vt(B, 262, 968, 'VIEW A', 10);
      if (only !== 'B') { // TYPE A
        v = vw(B, 10, 696, 878); chanElev(v, hc, false, pc);
        lvl(v, -400, hc, 586, 787, 'TOP OF TIMBER\nHALF-CAP'); lvl(v, -400, 0, 586, 851, 'UNDERSIDE OF TIMBER\nHALF-CAP');
        ld(v, 45 + 10, hc - 85, 727, 848, 'φ22 HOLE\n(TYP.)'); ld(v, pc.b, 0, 724, 894, '125, 150, 180 OR 200 PFC\nLENGTH TO SUIT.\nREFER NOTE 2.');
        vt(B, 655, 951, 'ELEVATION'); mt(B, 670, 970, 'HALF-CAP CONNECTION CHANNEL - TYPE A', 10);
      }
      if (only !== 'A') { // TYPE B
        v = vw(B, 10, 1099, 833); chanElev(v, hc, true, pc);
        lvl(v, -390, hc, 990, 745, 'TOP OF TIMBER\nHALF-CAP'); lvl(v, -390, 0, 990, 808, 'UNDERSIDE OF TIMBER\nHALF-CAP');
        lvl(v, 530, -100, 1222, 825, 'TOP OF STEEL\nHALF-CAP'); lvl(v, 530, -400, 1222, 882, 'UNDERSIDE OF STEEL\nHALF-CAP');
        ld(v, 45 + 10, hc - 85, 1137, 803, 'φ22 HOLE (TYP.)'); ld(v, 0, -250, 1093, 884, '125, 150, 180 OR 200 PFC\nLENGTH TO SUIT.\nREFER NOTE 2.');
        vt(B, 1128, 952, 'ELEVATION'); mt(B, 1140, 970, 'HALF-CAP CONNECTION CHANNEL - TYPE B', 10);
      }
    };
    if (!all) { chans(p.type); nt(B, 1095, 1055, [GN, 'DIMENSION TO BE MEASURED ON SITE PRIOR TO FABRICATION AND CONSTRUCTION', SHIM]); return B.E; }
    // ---- TYPE 5 : ELEVATION
    let v = vw(B, 10, 297, 326);
    elevPFC(v, hc, pk, pd, -470, 470); v.rect(-b / 2, 0, b, pd + pk, 'S-HIDDEN'); [[-69, 226], [69, 226], [-69, 76], [69, 76]].forEach(q => v.boltEnd(q[0], q[1], 22));
    v.rect(-pc.b / 2 + 15, pd + 12, pc.b, pk + hc - 32, 'S-HIDDEN'); [pd + pk + hc - 75, pd + pk + 75].forEach(y => bw(v, 15, y, 65));
    ucEnd(v, 0, 0, s); v.rect(-b / 2, -d, b, d, 'S-NEW'); iElevFlange(v, 0, -d - 380, -d, s); zh(v, -d - 380, -b / 2 - 30, b / 2 + 30);
    v.dim(-70, pd + pk + hc, 70, pd + pk + hc, 12, '140'); v.text(-35, pd + pk + hc + 50, '=', 2, 'c'); v.text(35, pd + pk + hc + 50, '=', 2, 'c');
    v.cl(0, -d - 420, 0, pd + pk + hc + 200, 'PILE'); v.mark(10, pd + pk + hc + 400, 'A', 270); v.mark(400, -60, 'D', 180);
    ld(v, -150, pd + pk + hc, 176, 125, 'EXISTING TIMBER\nHALF-CAP'); ld(v, -350, pd + pk / 2, 176, 256, 'EXISTING TIMBER\nPACKER', { dot: true });
    ld(v, -260, 0, 241, 350, 'EXISTING PFC\nHALF-CAP\nSTRENGTHENING'); ld(v, -b / 2, -d - 150, 220, 401, 'PROPOSED\nUC PILE');
    vt(B, 297, 468, 'ELEVATION');
    // ---- TYPE 5 : VIEW D
    v = vw(B, 10, 638, 297); let r = viewDE(v, hc, pk, pd, s, pc, g, hw, true);
    ld(v, -20, r.top, 560, 112, 'REFER TO HALF-CAP\nCONNECTION CHANNEL\n- TYPE A'); ld(v, 0, pd + 12, 663, 112, '12 PL TO SUIT DIMENSIONS\nOF PROPOSED PILE');
    ld(v, g / 2 + hw + 30, r.yh + hc - 75, 726, 160, 'φ20 THREADED ROD WITH\n1-65x5FLx65 WASHER TO\nTIMBER FACE (TYP.)'); ld(v, -d / 2 - 4, pd - 40, 531, 206, 'GALV. STEEL\nSHIMS\n(IF REQUIRED)\nREFER NOTE 3');
    ld(v, -r.xw - 30, 70, 547, 284, 'M20 BOLT (TYP.)\nDRILL φ22 HOLES ON\nSITE TO SUIT'); ld(v, r.Lc, -d / 2, 724, 320, 'UC CORBEL SIZE TO\nMATCH PROPOSED PILE\nx 200 LONG (TYP.)');
    ld(v, 10, -d + 6, 579, 421, '2 - 90 x 12FL STIFFENERS\n(TYP. BOTH SIDES OF WEB)', {});
    wd(v, [[-d / 2 + 20, -s.tf]], 550, 368, { size: '6', both: true, all: true, tail: 'TYP.' }); wd(v, [[d / 2, -12]], 703, 368, { tail: 'TYP.', other: true }); wd(v, [[d / 2, -s.tf - 6], [d / 2, -d + 6]], 703, 401, { size: '6', both: true, tail: 'TYP.' });
    vt(B, 650, 467, 'VIEW D');
    mt(B, 460, 502, 'PIER PILE REPAIR HALF-CAP BEARING DETAIL - TYPE 5', 10);
    // ---- TYPE 6 : ELEVATION
    v = vw(B, 10, 1036, 306);
    elevPFC(v, hc, pk, pd, -470, 470); v.rect(-pc.b / 2 + 15, 0, pc.b, pd + pk + hc - 20, 'S-HIDDEN'); [pd + pk + hc - 75, pd + pk + 75].forEach(y => bw(v, 15, y, 65)); [pd - 110, 70].forEach(y => v.boltEnd(15, y, 22));
    ucEnd(v, 0, 0, s); v.rect(-b / 2, -d, b, d, 'S-NEW'); iElevFlange(v, 0, -d - 380, -d, s); zh(v, -d - 380, -b / 2 - 30, b / 2 + 30);
    v.cl(0, -d - 420, 0, pd + pk + hc + 180, 'PILE'); v.mark(10, pd + pk + hc + 380, 'A', 270); v.mark(700, pd + 30, 'E', 180);
    ld(v, -100, pd + pk + hc, 912, 114, 'EXISTING TIMBER\nHALF-CAP'); ld(v, -400, pd + pk / 2, 884, 232, 'EXISTING TIMBER\nPACKER (TYP.)', { dot: true });
    ld(v, -330, 0, 968, 330, 'EXISTING PFC\nHALF-CAP\nSTRENGTHENING'); ld(v, b / 2, -d / 2, 1097, 345, '90 x 12FL STIFFENER WITH\n20 CHAMFER TO CLEAR UC\nRADIUS (TYP.)'); ld(v, -b / 2, -d - 150, 960, 421, 'PROPOSED\nUC PILE');
    vt(B, 1040, 469, 'ELEVATION');
    // ---- TYPE 6 : VIEW E
    v = vw(B, 10, 1403, 301); r = viewDE(v, hc, pk, pd, s, pc, max(g, 180), hw, false);
    ld(v, 0, r.top, 1367, 117, 'REFER TO HALF-CAP\nCONNECTION CHANNEL\n- TYPE B'); ld(v, -max(g, 180) / 2 - hw - 30, r.yh + hc - 75, 1312, 167, 'φ20 THREADED ROD WITH\n1-65x5FLx65 WASHER TO\nTIMBER FACE (TYP.)');
    ld(v, -r.xw - 75, pd + 30, 1302, 226, 'EXISTING TIMBER\nPACKER (TYP.)'); ld(v, -r.xw - 30, 70, 1302, 278, 'M20 BOLT (TYP.)\nDRILL φ22 HOLES\nON SITE TO SUIT'); ld(v, r.Lc, -d / 2, 1468, 355, 'UC CORBEL SIZE TO\nMATCH PROPOSED\nUC PILE');
    wd(v, [[-d / 2 + 6, -d / 2]], 1290, 338, { size: '6', both: true, tail: 'TYP.' }); wd(v, [[d / 2, -12], [d / 2, -d + 12]], 1497, 323, { tail: 'TYP.' }); wd(v, [[-d / 2, -d], [d / 2, -d]], 1335, 375, {});
    v.dim(-r.Lc, -d, -d / 2, -d, -10, '200'); v.dim(d / 2, -d, r.Lc, -d, -10, '200');
    vt(B, 1405, 467, 'VIEW E');
    mt(B, 1215, 502, 'PIER PILE REPAIR HALF-CAP BEARING DETAIL - TYPE 6', 10);
    chans('ALL');
    nt(B, 1095, 1055, [GN, 'DIMENSION TO BE MEASURED ON SITE PRIOR TO FABRICATION AND CONSTRUCTION', SHIM]);
    return B.E;
  }, 'UC pile repair under pier half-caps that carry an existing PFC strengthening (Type 5 pile through, Type 6 corbel under), with the half-cap connection channels Type A / B (after MRWA 1330-0013).');
  // ---------------------------------------------------------------- 1330-0014 ABUTMENT PILE REPAIR - TOP DETAILS - SHEET 1 OF 4 (TYPE A)
  // abutment top connection Type A seen across the abutment: x = 0 at the sheeting-side face of the UC pile, y = 0 at the half-cap underside
  // o.X = timber packer between sheeting and pile (0 = none); o.pk = steel pack between pile and half-cap; o.Lc corbel length
  function abutA(v, s, hc, hw, o) {
    const d = s.d, tf = s.tf, X = o.X || 0, pk = o.pk || 0, xs = -X - 75, xh = d + pk, dc = d, gs = 12;
    v.line(xs, -560, xs, hc + 330, 'S-EXIST'); v.line(-X, -560, -X, hc, 'S-EXIST'); zh(v, -560, xs - 40, -X + 40);
    if (X) v.rect(-X, -250, X, hc + 230, 'S-NEW');
    v.rect(0, -470, d, hc - 20 + 470, 'S-NEW'); v.line(tf, -470, tf, hc - 20, 'S-NEW'); v.line(d - tf, -470, d - tf, hc - 20, 'S-NEW'); zh(v, -470, -40, d + 40);
    if (pk) shim(v, d, 0, pk, hc - 20);
    tbx(v, xh, 0, hw, hc); deckStr(v, -X, xs, xh + hw + 420, hc, 330, 125, 4);
    [hc - 100, hc - 225].forEach(y => rodH(v, d - tf, xh + hw, y));
    shim(v, d, -gs, o.Lc, gs); iElevWebH(v, d, d + o.Lc, -gs - dc / 2, s); [-gs - tf / 2, -gs - dc + tf / 2].forEach(y => v.rect(tf, y - 5, d - 2 * tf, 10, 'S-NEW'));
    v.dim(-90, hc - 20, -90, hc, 0, '20'); v.line(-110, hc, 0, hc, 'S-DIM');
    return { xs, xh, gs };
  }
  // View A / C: looking at the half-cap face, x = 0 on the pile centre line, y = 0 at the half-cap underside
  function abutAView(v, s, hc, hatchPk) {
    const b = s.b, d = s.d; tbeam(v, -360, 640, 0, hc); v.line(-360, hc + 330, 640, hc + 330, 'S-EXIST'); v.line(-360, hc + 455, 640, hc + 455, 'S-EXIST'); zz(v, -360, hc + 330, hc + 455); zz(v, 640, hc + 330, hc + 455);
    v.circ(380, hc + 165, 160, 'S-EXIST');
    v.rect(-b / 2, -470, b, hc - 20 + 470, 'S-NEW'); v.line(0, hc - 20, 0, -470, 'S-HIDDEN'); v.line(-b / 2, -2, b / 2, -2, 'S-NEW'); v.line(-b / 2, -12, b / 2, -12, 'S-NEW'); ucEnd(v, 0, -12, s); v.line(-b / 2, -12 - d, b / 2, -12 - d, 'S-NEW'); zh(v, -470, -b / 2 - 30, b / 2 + 30);
    if (hatchPk) v.hatch([[-b / 2, 0], [b / 2, 0], [b / 2, hc - 20], [-b / 2, hc - 20]], 'ansi31', 'S-HATCH', 1.4);
    bw(v, -70, hc - 100, 65); bw(v, 70, hc - 225, 65);
    v.dim(-70, hc + 40, 70, hc + 40, 8, '140'); v.text(-35, hc + 75, '=', 2, 'c'); v.text(35, hc + 75, '=', 2, 'c'); v.line(-70, hc - 100, -70, hc + 120, 'S-DIM'); v.line(70, hc - 225, 70, hc + 120, 'S-DIM');
    v.dim(-430, hc - 100, -430, hc, 0, '100', { sub: '(TYP.)' }); v.line(-460, hc - 100, -90, hc - 100, 'S-DIM');
    v.cl(0, -500, 0, hc + 560, 'PILE'); cutLR(v, -560, 900, hc - 130, hatchPk ? 'D' : 'B');
  }
  function abutASec(v, s, hw, X, steel) {
    const b = s.b, d = s.d, tf = s.tf, pk = steel ? 25 : 0, yp = pk, ys = pk + d + (steel ? 0 : X);
    tbeam(v, -440, 440, -hw, 0); v.rect(-b / 2 - 15, -hw - 40, b + 30, hw + 40, 'S-HIDDEN');
    iSec(v, 0, yp + d / 2, s, 0); [-1, 1].forEach(k => { v.line(k * (b / 2 - 10), yp + tf, k * (b / 2 - 10), yp + d - tf, 'S-NEW'); });
    v.fill([[-s.tw / 2, yp + d - tf], [-30, yp + d - tf], [-s.tw / 2, yp + d - tf - 20]]); v.fill([[s.tw / 2, yp + d - tf], [30, yp + d - tf], [s.tw / 2, yp + d - tf - 20]]); v.fill([[-s.tw / 2, yp + tf], [-30, yp + tf], [-s.tw / 2, yp + tf + 20]]); v.fill([[s.tw / 2, yp + tf], [30, yp + tf], [s.tw / 2, yp + tf + 20]]);
    if (steel) shim(v, -b / 2 - 30, 0, b + 60, pk); else tbx(v, -b / 2 - 25, yp + d, b + 50, X);
    tbeam(v, -440, 440, ys, ys + 75);
    [-62, 62].forEach(x => rodV(v, x, -hw, yp + tf));
    v.dim(-b / 2, yp + d / 2 + 10, -b / 2 + 10, yp + d / 2 + 10, 0, '10', { sub: '(TYP.)' });
    v.dim(-480, 0, -480, ys, 0, 'GAP VARIES');
    return { yp, ys };
  }
  def('atA', 'Abutments', 'Abutment pile top connection – Type A', '1330-0014', [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('X', "Dimension 'X' (mm)", 60, { num: 1 }), P('hc', 'Halfcap / fullcap depth (mm)', 300, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], hc = max(200, +p.hc || 300), X = max(50, +p.X || 60), d = s.d, b = s.b, hw = 200;
    // ---- TYPE A (X ≥ 50): ELEVATION
    let v = vw(B, 10, 289, 280); let r = abutA(v, s, hc, hw, { X, Lc: 200 });
    v.dim(-X, -470, 0, -470, -6, "'X'"); callout(v, d - 10, -12 - d / 2, 235, 1, 380, -540); v.mark(540, 80, 'A', 180);
    ld(v, 220, hc + 165, 268, 97, 'EXISTING TIMBER\nSTRINGER', { dot: true }); ld(v, r.xs, hc + 390, 254, 142, 'EXISTING TIMBER\nDECKING'); ld(v, 100, 120, 223, 236, 'PROPOSED\nUC PILE', { dot: true });
    ld(v, -X / 2, 20, 261, 276, 'TIMBER PACKER\nMIN. 50 THICK'); ld(v, r.xs, -180, 252, 316, 'EXISTING TIMBER\nSHEETING'); ld(v, d / 2, -12 - s.tf, 234, 389, 'PROPOSED WEB\nSTIFFENERS\n(TYP.)');
    ld(v, r.xh + 80, hc * 0.75, 411, 229, 'EXISTING TIMBER HALF-CAP\nSHOWN FOR PFC REFER\nEXISTING/PROPOSED PFC\nCONNECTION DETAIL', { dot: true }); ld(v, d + 100, -6, 411, 287, 'PROVIDE GALV. STEEL SHIMS\nIF REQUIRED TO ENSURE TIGHT FIT\nREFER NOTE 5.');
    ld(v, d + 200, -12 - d / 2, 411, 347, 'PROPOSED UC CORBEL TO MATCH\nPROPOSED UC PILE SIZE x200 LONG');
    vt(B, 320, 435, 'ELEVATION', null, "(REPAIR TO BE USED WHERE DIMENSION 'X' ≥ 50mm)");
    mt(B, 352, 476, 'ABUTMENT TOP CONNECTION DETAIL - TYPE A', 10);
    // ---- VIEW A
    v = vw(B, 10, 705, 290); abutAView(v, s, hc, false);
    ld(v, 70 + 20, hc - 245, 751, 316, 'φ20 THREADED ROD WITH 65x5FLx65\nWASHER TO TIMBER FACE SITE DRILL\nHOLES TO SUIT (TYP.)'); ld(v, -b / 2, -380, 653, 371, 'PROPOSED\nUC PILE');
    vt(B, 713, 425, 'VIEW A', 10);
    // ---- SECTION B
    v = vw(B, 10, 1074, 237); r = abutASec(v, s, hw, X, false);
    ld(v, 150, r.ys + 75, 1015, 103, 'EXISTING TIMBER\nSHEETING'); ld(v, -60, r.ys - X / 2, 1012, 139, 'TIMBER PACKER'); ld(v, 30, r.ys - s.tf - 15, 1176, 140, '20 CHAMFER TO\nSTIFFENERS TO CLEAR\nUC PILE RADIUS (TYP.)');
    ld(v, s.tw / 2, d / 2, 1180, 211, 'PROPOSED UC PILE'); ld(v, 200, -hw / 2, 1137, 285, 'EXISTING TIMBER\nHALF-CAP OR FULL-CAP', { dot: true }); ld(v, 60, -hw - 40, 1137, 311, 'PROPOSED\nUC CORBEL');
    vt(B, 1070, 322, 'SECTION B', 10);
    // ---- EXISTING / PROPOSED PFC CONNECTION
    v = vw(B, 10, 1383, 226); const pf = SEC['250PFC'];
    v.pl([[-140, 0], [-140, 250], [-80, 270], [-20, 254], [0, 256]], false, 'S-TEXT'); v.line(0, 256, 0, -60, 'S-NEW'); v.line(-12, 250, -12, -60, 'S-NEW'); v.line(-140, 0, 200, 0, 'S-NEW'); v.line(-140, -12, 200, -12, 'S-NEW'); v.pl([[200, 0], [200, -60]], false, 'S-TEXT'); v.pl([[-140, -12], [-140, -60]], false, 'S-TEXT');
    shim(v, 0, 0, 8, 250); cSec(v, 8, 125, { d: 250, b: pf.b, tf: pf.tf, tw: pf.tw }, 1, 'S-NEW'); [190, 70].forEach(y => v.bolt(-12, y, 8 + pf.tw, y, 20));
    ld(v, pf.b + 8, 250, 1440, 158, 'EXISTING/PROPOSED PFC\nHALF-CAP REPLACEMENT/\nSTRENGTHENING'); ld(v, 30, 150, 1440, 212, 'REFER SECTION (L) ON DRG\nN° 1330-0016 FOR\nCONNECTION DETAILS'); ld(v, -70, -35, 1317, 216, 'PROPOSED\nUC PILE REPAIR', { dot: true });
    vt(B, 1407, 297, 'ELEVATION'); mt(B, 1412, 320, 'EXISTING/PROPOSED PFC CONNECTION', 10);
    // ---- TYPE A (X < 50): ELEVATION
    v = vw(B, 10, 273, 710); r = abutA(v, s, hc, hw, { X: 0, pk: 25, Lc: 250 });
    callout(v, d, -12 - d / 2, 285, 1, 460, -560); v.mark(716, -122, 'C', 180);
    ld(v, 300, hc + 165, 268, 517, 'EXISTING TIMBER\nSTRINGER', { dot: true }); ld(v, r.xs, hc + 390, 254, 562, 'EXISTING TIMBER\nDECKING'); ld(v, 100, 150, 223, 650, 'PROPOSED\nUC PILE', { dot: true });
    ld(v, d + 12, 50, 227, 684, 'PACK WITH\n250x6,8,10 OR 12FL.\nx LENGTH TO SUIT\nUC PILE IF REQUIRED'); ld(v, r.xs, -250, 252, 758, 'EXISTING TIMBER\nSHEETING'); ld(v, d / 2, -12 - s.tf, 234, 821, 'PROPOSED WEB\nSTIFFENERS\n(TYP.)');
    ld(v, r.xh + 80, hc * 0.75, 386, 648, 'EXISTING TIMBER HALF-CAP\nSHOWN FOR PFC REFER\nEXISTING/PROPOSED PFC\nCONNECTION DETAIL', { dot: true }); ld(v, d + 120, -6, 393, 707, 'PROVIDE GALV. STEEL SHIMS\nIF REQUIRED TO ENSURE TIGHT FIT\nREFER NOTE 5.');
    ld(v, d + 250, -12 - d / 2, 395, 768, 'PROPOSED UC CORBEL TO MATCH\nPROPOSED UC PILE SIZE x250 LONG');
    vt(B, 322, 849, 'ELEVATION', null, "(REPAIR TO BE USED WHERE DIMENSION 'X' < 50mm)");
    mt(B, 352, 890, 'ABUTMENT TOP CONNECTION DETAIL - TYPE A', 10);
    // ---- VIEW C
    v = vw(B, 10, 706, 710); abutAView(v, s, hc, true);
    ld(v, -b / 2 + 10, 150, 667, 759, 'DENOTES LOCATION\nOF STEEL PACKER\nBEHIND PFC'); ld(v, 70 + 20, hc - 245, 755, 759, 'φ20 THREADED ROD WITH 65x5FLx65\nWASHER TO TIMBER FACE SITE DRILL\nHOLES TO SUIT (TYP.)'); ld(v, -b / 2, -380, 653, 808, 'PROPOSED\nUC PILE');
    vt(B, 708, 836, 'VIEW C', 10);
    // ---- SECTION D
    v = vw(B, 10, 1075, 658); r = abutASec(v, s, hw, 0, true);
    ld(v, 150, r.ys + 75, 994, 572, 'EXISTING TIMBER\nSHEETING'); ld(v, 30, r.ys - s.tf - 15, 1135, 571, '20 CHAMFER TO\nSTIFFENERS TO CLEAR\nUC PILE RADIUS (TYP.)'); ld(v, s.tw / 2, r.yp + d / 2, 1137, 632, 'PROPOSED UC PILE');
    v.dim(b / 2 + 260, 0, b / 2 + 260, 25, 0, ''); ld(v, b / 2 + 260, 0, 1152, 677, '50 MAX. PACKING', { noArrow: true });
    ld(v, 200, -hw / 2, 1132, 704, 'EXISTING TIMBER\nHALF-CAP OR FULL-CAP', { dot: true }); ld(v, 60, -hw - 40, 1132, 732, 'PROPOSED\nUC CORBEL');
    vt(B, 1057, 744, 'SECTION D', 10);
    // ---- DETAIL 1
    v = vw(B, 10, 1094, 876); const tf = s.tf;
    v.rect(-d / 2, -440, d, 470, 'S-NEW'); v.line(-d / 2 + tf, -440, -d / 2 + tf, 30, 'S-NEW'); v.line(d / 2 - tf, -440, d / 2 - tf, 30, 'S-NEW'); zh(v, 30, -d / 2 - 30, d / 2 + 30); zh(v, -440, -d / 2 - 30, d / 2 + 30);
    v.pl([[d / 2, 0], [d / 2 + 400, 0], [d / 2 + 400, -d], [d / 2, -d]], false, 'S-NEW'); v.line(d / 2, -tf, d / 2 + 400, -tf, 'S-NEW'); v.line(d / 2, -d + tf, d / 2 + 400, -d + tf, 'S-NEW');
    [-tf / 2, -d + tf / 2].forEach(y => v.rect(-d / 2 + tf, y - 5, d - 2 * tf, 10, 'S-NEW'));
    lds(v, [[0, -tf / 2 + 5], [d / 2 - 30, -d + tf / 2 - 5]], 1046, 858, 'PROVIDE 2 N° 10 PL\nWEB STIFFENERS TO\nBOTH FACES. LENGTH\nTO SUIT'); ld(v, -d / 2, -330, 1011, 956, 'PROPOSED\nUC PILE');
    wd(v, [[d / 2, 0]], 1176, 868, { other: true }); wd(v, [[d / 2, -d / 2]], 1172, 898, { size: '6', both: true }); wd(v, [[d / 2, -d]], 1172, 934, { size: '8', both: true });
    wd(v, [[-d / 2 + tf + 10, -tf - 30]], 1170, 949, { size: '8', both: true, all: true, tail: 'TYP.' });
    vt(B, 1095, 998, 'DETAIL 1', 10);
    nt(B, 1137, 1062, [GN, PROP, SHIM], 250);
    return B.E;
  }, "Abutment UC pile repair top connection with a 200 / 250 long UC corbel under the half-cap: timber packer where 'X' ≥ 50, steel pack where 'X' < 50 (after MRWA 1330-0014).");
  // ---------------------------------------------------------------- 1330-0015 ABUTMENT PILE REPAIR - TOP DETAILS - SHEET 2 OF 4 (TYPE B / C, CHANNEL TYPE 1, DETAIL 2, TIMBER PACKING)
  // x = 0 at the sheeting inner face (= sheeting-side face of the UC pile), y = 0 at the corbel top (cap underside)
  // two: second (back) half-cap between the sheeting and the channel (Type C); else full-cap only (Type B)
  function abutBC(v, s, hc, two, o) {
    o = o || {}; const d = s.d, tf = s.tf, g = 140, sh = 10, hb = two ? 150 : 0, xc = hb, xcap = xc + g + sh, hw = two ? 170 : 220, xe = xcap + hw + 20, Ds = 400;
    v.line(-75, -560, -75, hc + Ds, 'S-EXIST'); v.line(0, -560, 0, hc + Ds, 'S-EXIST'); zh(v, -560, -110, 30); [-150, -330, hc * 0.4, hc + 120].forEach(y => v.line(-75, y, 0, y, 'S-EXIST'));
    deckStr(v, 0, -75, xe + 420, hc, Ds, 125, 4);
    if (two) { tbx(v, 0, 0, hb, hc); shim(v, xc, 0, sh, hc - 20); }
    const c0 = xc + (two ? sh : 0); v.rect(c0, 0, g, hc - 20, 'S-NEW'); v.line(c0 + 9.5, 0, c0 + 9.5, hc - 20, 'S-NEW'); v.line(c0 + g - 9.5, 0, c0 + g - 9.5, hc - 20, 'S-NEW');
    shim(v, c0 + g, 0, sh, hc - 20); tbx(v, c0 + g + sh, 0, hw, hc);
    [hc - 75, 75].forEach(y => rodH(v, c0 + g - 9.5, c0 + g + sh + hw, y));
    // pile mitred into the corbel
    v.line(0, 0, 0, -470, 'S-NEW'); v.line(tf, -tf, tf, -470, 'S-NEW'); v.line(d, -d, d, -470, 'S-NEW'); v.line(d - tf, -d, d - tf, -470, 'S-NEW'); zh(v, -470, -30, d + 30);
    v.pl([[0, 0], [xe, 0], [xe, -d], [d, -d]], false, 'S-NEW'); v.line(tf, -tf, xe, -tf, 'S-NEW'); v.line(d, -d + tf, xe, -d + tf, 'S-NEW'); v.line(0, 0, d, -d, 'S-NEW');
    v.rect(d - 12, -d + tf, 12, d - 2 * tf, 'S-NEW'); v.rect(tf, -d - 6, d - 2 * tf, 12, 'S-NEW');
    v.dim(two ? xe - 20 + 60 : -200, hc - 20, two ? xe - 20 + 60 : -200, hc, 0, '20'); v.line(two ? c0 : -220, hc - 20, two ? xe + 80 : c0, hc - 20, 'S-DIM');
    v.dim(xe - 20, -30, xe, -30, 0, '20');
    return { d, c0, g, xcap: c0 + g + sh, hw, xe, Ds };
  }
  // View E / G: looking at the cap face; x = 0 on the pile / channel centre line, y = 0 at the cap underside
  function abutBCView(v, s, hc) {
    const b = s.b, d = s.d; tbeam(v, -400, 640, 0, hc); v.line(-400, hc + 400, 640, hc + 400, 'S-EXIST'); v.line(-400, hc + 525, 640, hc + 525, 'S-EXIST'); zz(v, -400, hc + 400, hc + 525); zz(v, 640, hc + 400, hc + 525);
    v.circ(300, hc + 200, 195, 'S-EXIST');
    v.rect(-45, 0, 90, hc - 20, 'S-HIDDEN'); bw(v, 0, hc - 75, 65); bw(v, 0, 75, 65);
    v.line(-b / 2 - 10, 0, b / 2 + 10, 0, 'S-NEW'); ucEnd(v, 0, 0, s); v.rect(-b / 2, -d, b, d, 'S-NEW'); [-1, 1].forEach(k => v.line(k * (b / 2 - 10), -s.tf, k * (b / 2 - 10), -d + s.tf, 'S-NEW'));
    iElevFlange(v, 0, -d - 360, -d, s); zh(v, -d - 360, -b / 2 - 30, b / 2 + 30);
    v.dim(b / 2 - 10, -d / 2, b / 2, -d / 2, 0, '10', { sub: '(TYP.)' });
  }
  // plan section through the cap(s) and the channel (Section F / H): y = 0 at the (front) cap face, +y towards the sheeting
  function abutBCSec(v, two, hw) {
    const g = 140, pc = SEC['150PFC']; tbeam(v, -230, 220, -hw, 0); const yb = g + (two ? 150 : 0); if (two) tbeam(v, -230, 220, g, g + 150); tbeam(v, -230, 220, yb, yb + 75);
    v.rect(-104, -hw - 30, 196, yb + 30 + hw, 'S-HIDDEN'); cSec(v, 0, g / 2, { d: g, b: pc.b, tf: pc.tf, tw: pc.tw }, 1, 'S-NEW'); shim(v, 0, -0, pc.b, 8);
    rodV(v, 40, -hw, pc.tf + 8); v.dim(-330, 0, -330, g, 0, 'GAP VARIES');
  }
  // fabricated mitre corner (DETAIL 2): x = 0 on the pile centre line, y = 0 at the corbel top; corbel towards +x
  function mitreFab(v, s, up, Lc) {
    const d = s.d, tf = s.tf; v.rect(-d / 2, 0, d, up, 'S-NEW'); v.line(-d / 2 + tf, 0, -d / 2 + tf, up, 'S-NEW'); v.line(d / 2 - tf, 0, d / 2 - tf, up, 'S-NEW');
    v.line(-d / 2, 0, -d / 2, -d - 330, 'S-NEW'); v.line(-d / 2 + tf, -tf, -d / 2 + tf, -d - 330, 'S-NEW'); v.line(d / 2, -d, d / 2, -d - 330, 'S-NEW'); v.line(d / 2 - tf, -d, d / 2 - tf, -d - 330, 'S-NEW'); zh(v, -d - 330, -d / 2 - 30, d / 2 + 30);
    v.pl([[-d / 2, 0], [d / 2 + Lc, 0], [d / 2 + Lc, -d], [d / 2, -d]], false, 'S-NEW'); v.line(-d / 2 + tf, -tf, d / 2 + Lc, -tf, 'S-NEW'); v.line(d / 2, -d + tf, d / 2 + Lc, -d + tf, 'S-NEW'); v.line(-d / 2, 0, d / 2, -d, 'S-NEW');
    v.rect(d / 2 - 12, -d + tf, 12, d - 2 * tf, 'S-NEW'); v.rect(-d / 2 + tf, -d - 6, d - 2 * tf, 12, 'S-NEW');
    v.circ(-d / 2 + 15, -10, 40, 'S-TEXT'); v.circ(d / 2 - 10, -d + 10, 40, 'S-TEXT');
  }
  // enlarged weld circle: corner = outside corner of the mitre (sx, sy = direction of the corner), else stiffener crossing
  function weldCircle(v, cx, cy, r, corner, sx, sy) {
    v.circ(cx, cy, r, 'S-TEXT'); const a = 40, c = 12;
    if (corner) { // outside corner at (cx + sx*a, cy + sy*a)
      const X0 = cx + sx * a, Y0 = cy + sy * a; v.line(X0, Y0, X0 - sx * r * 0.95, Y0, 'S-NEW'); v.line(X0 - sx * 30, Y0 - sy * 30, X0 - sx * r * 0.9, Y0 - sy * 30, 'S-NEW'); v.line(X0, Y0, X0, Y0 - sy * r * 0.95, 'S-NEW'); v.line(X0 - sx * 30, Y0 - sy * 30, X0 - sx * 30, Y0 - sy * r * 0.9, 'S-NEW');
      v.fill([[X0, Y0], [X0 - sx * 30, Y0], [X0 - sx * 30, Y0 - sy * 30], [X0, Y0 - sy * 30]]); v.line(X0, Y0, cx - sx * r * 0.6, cy - sy * r * 0.6, 'S-NEW');
      for (let t = 0.12; t < 0.95; t += 0.06) { const x = X0 - t * (X0 - (cx - sx * r * 0.6)), y = Y0 - t * (Y0 - (cy - sy * r * 0.6)); v.line(x, y, x + sx * 12, y - sy * 12, 'S-NEW'); }
    } else {
      v.line(cx - 15, cy + r * 0.95, cx - 15, cy - r * 0.95, 'S-NEW'); v.line(cx + 15, cy + r * 0.95, cx + 15, cy - r * 0.95, 'S-NEW'); v.line(cx - r * 0.95, cy - 15, cx + r * 0.95, cy - 15, 'S-NEW'); v.line(cx - r * 0.95, cy + 15, cx + r * 0.95, cy + 15, 'S-NEW');
      v.fill([[cx - 15, cy - 15], [cx + 15, cy - 15], [cx + 15, cy + 15], [cx - 15, cy + 15]]); v.line(cx, cy, cx - sx * r * 0.6, cy + sy * r * 0.6, 'S-NEW');
      for (let t = 0.15; t < 0.95; t += 0.07) { const x = cx - sx * t * r * 0.6, y = cy + sy * t * r * 0.6; v.line(x, y, x - sx * 12, y - sy * 12, 'S-NEW'); }
    }
  }
  function chanType1(B, px, py, hc, type2) {
    const v = vw(B, 10, px, py), pc = SEC['150PFC'], top = type2 ? hc + 160 : hc - 20, h1 = type2 ? hc - 100 : top - 80, h2 = type2 ? 75 : 100;
    v.rect(0, 0, pc.b, top, 'S-NEW'); v.line(pc.tw, 0, pc.tw, top, 'S-HIDDEN'); [h1, h2].forEach(y => { v.circ(45, y, 11, 'S-BOLT'); v.line(-60, y, 45, y, 'S-DIM'); });
    v.line(-400, 0, pc.b + 40, 0, 'S-TEXT'); v.line(-320, top, pc.b, top, 'S-DIM');
    v.line(0, top + 20, 0, top + 200, 'S-DIM'); v.line(45, h1, 45, top + 200, 'S-DIM'); v.dim(0, top + 160, 45, top + 160, 0, '35 (125 PFC)', { sub: '45 (150, 180 OR 200 PFC)' });
    v.dim(-40, h1, -40, type2 ? hc : top, 0, type2 ? '100' : '80'); v.dim(-40, h2, -40, h1, 0, 'VARIES'); v.dim(-40, 0, -40, h2, 0, type2 ? '75' : '100'); if (type2) v.line(-60, hc, 400, hc, 'S-TEXT');
    v.dim(-280, 0, -280, top, 0, type2 ? 'TO UNDERSIDE OF SPIKING RAIL' : '20 BELOW TOP OF HALF-CAP/FULL-CAP');
    return v;
  }
  def('atBC', 'Abutments', 'Abutment top connection – Types B / C (mitred UC corbel)', '1330-0015', [P('type', 'Show', 'ALL', { opts: ['ALL', 'B', 'C'] }), P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], hc = max(200, +p.hc || 300), d = s.d, b = s.b, t = String(p.type);
    if (t !== 'C') { // ---- TYPE B
      let v = vw(B, 10, 230, 251), r = abutBC(v, s, hc, false);
      callout(v, d - 30, -d / 2, 290, 2, 374, -520); v.mark(582, -12, 'E', 180);
      ld(v, -75, hc + r.Ds + 60, 176, 52, 'EXISTING TIMBER\nDECKING'); ld(v, 115, hc + 250, 190, 107, 'EXISTING TIMBER\nSTRINGER', { dot: true });
      lds(v, [[r.c0 + r.g + 5, hc * 0.45], [r.c0 + r.g + 5, -4]], 188, 216, 'PROVIDE GALV.\nSTEEL SHIMS\nIF REQUIRED TO\nENSURE TIGHT FIT\nREFER NOTE 3.');
      ld(v, r.xcap + 80, hc * 0.6, 358, 236, 'EXISTING TIMBER\nFULL-CAP', { dot: true }); ld(v, d - 6, -d / 2 + 20, 183, 284, '12PL. STIFFENER\n(TYP.)');
      ld(v, -75, -330, 192, 322, 'EXISTING TIMBER\nSHEETING'); ld(v, 90, -420, 183, 360, 'PROPOSED UC PILE', { dot: true });
      ld(v, r.xe, -d / 2 + 30, 358, 276, 'PROPOSED UC CORBEL\nTO MATCH PROPOSED\nUC PILE SIZE, LENGTH TO SUIT'); ld(v, d * 0.6, -d * 0.6, 354, 333, 'MITRE CUT UC SECTION LENGTH\nTO SUIT PROPOSED UC PILE');
      vt(B, 277, 388, 'ELEVATION'); mt(B, 277, 410, 'ABUTMENT TOP CONNECTION DETAIL - TYPE B', 10);
      v = vw(B, 10, 699, 251); abutBCView(v, s, hc); cutLR(v, -560, 900, 30, 'F');
      ld(v, -40, hc - 20, 686, 165, 'REFER TO HALF-CAP/FULL-CAP\nCONNECTION CHANNEL - TYPE 1'); ld(v, 20, 75, 722, 272, 'φ20 THREADED ROD WITH 65x5FLx65\nWASHER TO TIMBER FACE (TYP.)');
      ld(v, -s.tw / 2 - 10, -s.tf - 15, 656, 254, '20 CHAMFER TO\nSTIFFENERS TO CLEAR\nUC PILE RADIUS (TYP.)'); ld(v, -b / 4, -d / 2, 656, 308, '12PL STIFFENER\n(TYP.)', { dot: true }); ld(v, -b / 2, -d - 250, 656, 351, 'PROPOSED UC PILE');
      vt(B, 708, 403, 'VIEW E', 10);
      B.noteBox(X(778), Y(385), 'NOTE:\nFOR PILE REPAIR TYPES B & C. IF TIMBER PACKER\nIS REQUIRED BETWEEN PROPOSED UC PILE AND\nEXISTING TIMBER SHEETING REFER TO TIMBER\nPACKING OPTION.', 112, { solid: true });
      v = vw(B, 10, 1089, 186); abutBCSec(v, false, 220);
      ld(v, 60, 140 + 40, 1141, 119, 'EXISTING TIMBER\nSHEETING', { dot: true }); ld(v, 58, 10, 1144, 157, '125 - 200 PFC SHIMMED TO FIT\nGAP BETWEEN EXISTING TIMBER\nFULL-CAP AND PROPOSED\nFULL-CAP CONNECTION CHANNEL\nREFER NOTE 3.');
      ld(v, 139, -108, 1144, 233, 'EXISTING TIMBER\nFULL-CAP (TYP.)', { dot: true }); ld(v, 92, -250, 1144, 260, 'PROPOSED\nUC CORBEL');
      vt(B, 1074, 302, 'SECTION F', 10);
    }
    if (t !== 'B') { // ---- TYPE C
      let v = vw(B, 10, 229, 641), r = abutBC(v, s, hc, true);
      callout(v, d, -d / 2, 280, 2, 381, -543); v.mark(843, -53, 'G', 180);
      ld(v, -75, hc + r.Ds + 60, 176, 465, 'EXISTING TIMBER\nDECKING'); ld(v, 647, hc + 190, 424, 442, 'EXISTING TIMBER\nSTRINGER', { dot: true });
      lds(v, [[150 + 5, hc * 0.7], [r.c0 + r.g + 5, hc * 0.2]], 183, 545, 'PROVIDE GALV.\nSTEEL SHIMS\nIF REQUIRED TO\nENSURE TIGHT FIT\nREFER NOTE 3.');
      ld(v, 0, 127, 186, 616, 'EXISTING TIMBER\nSHEETING'); ld(v, r.xcap + 60, 150, 349, 618, 'EXISTING TIMBER\nHALF-CAP (TYP.)', { dot: true });
      ld(v, d - 6, -d / 2 + 20, 174, 672, '12PL. STIFFENER\n(TYP.)'); ld(v, 104, -370, 147, 714, 'PROPOSED\nUC PILE', { dot: true });
      ld(v, r.xe, -d / 2 + 30, 349, 672, 'PROPOSED UC CORBEL\nTO MATCH PROPOSED\nUC PILE SIZE, LENGTH TO SUIT'); ld(v, d * 0.6, -d * 0.6, 349, 721, 'MITRE CUT UC SECTION LENGTH\nTO SUIT PROPOSED UC PILE');
      vt(B, 287, 803, 'ELEVATION'); mt(B, 288, 830, 'ABUTMENT TOP CONNECTION DETAIL - TYPE C', 10);
      v = vw(B, 10, 699, 648); abutBCView(v, s, hc); cutLR(v, -560, 900, 30, 'H');
      ld(v, -40, hc - 20, 686, 542, 'REFER TO HALF-CAP/FULL-CAP\nCONNECTION CHANNEL - TYPE 1'); ld(v, 20, 75, 722, 669, 'φ20 THREADED ROD WITH 65x5FLx65\nWASHER TO TIMBER FACE (TYP.)');
      ld(v, -s.tw / 2 - 10, -s.tf - 15, 656, 666, '20 CHAMFER TO\nSTIFFENERS TO CLEAR\nUC PILE RADIUS (TYP.)'); ld(v, -b / 4, -d / 2, 656, 720, '12PL STIFFENER\n(TYP.)', { dot: true }); ld(v, -b / 2, -d - 250, 656, 765, 'PROPOSED UC PILE');
      vt(B, 708, 800, 'VIEW G', 10);
      v = vw(B, 10, 1093, 633); abutBCSec(v, true, 170);
      ld(v, 58, 139, 1155, 574, '125 - 200 PFC SHIMMED TO FIT GAP\nBETWEEN EXISTING TIMBER\nHALF-CAP AND PROPOSED\nHALF-CAP CONNECTION CHANNEL\nREFER NOTE 3.'); ld(v, 132, -85, 1152, 679, 'EXISTING TIMBER\nHALF-CAP (TYP.)', { dot: true }); ld(v, 81, -200, 1152, 708, 'PROPOSED\nUC CORBEL');
      vt(B, 1080, 740, 'SECTION H', 10);
    }
    // ---- HALF-CAP / FULL-CAP CONNECTION CHANNEL - TYPE 1
    let v = chanType1(B, 275, 1031, hc, false);
    lvl(v, -330, 0, 191, 977, 'UNDERSIDE OF\nHALF-CAP/\nFULL-CAP'); ld(v, 55, hc - 110, 311, 966, 'φ22 HOLE\n(TYP.)'); ld(v, 75, 0, 311, 1039, '125, 150, 180 OR\n200 PFC LENGTH\nTO SUIT');
    vt(B, 266, 1072, 'ELEVATION'); mt(B, 270, 1096, 'HALF-CAP/FULL-CAP CONNECTION CHANNEL - TYPE 1', 10);
    // ---- DETAIL 2
    v = vw(B, 10, 608, 962); mitreFab(v, s, 290, 200);
    weldCircle(v, -571, 145, 150, true, -1, 1); weldCircle(v, 815, -513, 205, false, 1, 1);
    v.line(-d / 2 + 5, 10, -571 + 140, 145 - 55, 'S-TEXT'); v.line(d / 2 + 25, -d + 5, 815 - 195, -513 + 60, 'S-TEXT');
    ld(v, -571 - 35, 145 + 35, 464, 892, '90° OUTSIDE\nCORNER FILLET\nWELD'); ld(v, -571 + 40, 145 - 40, 543, 890, 'MITRE CUT');
    ld(v, 815 - 60, -513 + 60, 777, 973, 'MITRE CUT'); ld(v, 815 - 15, -513 - 100, 721, 1039, 'STIFFENER'); ld(v, 815 + 120, -513 + 15, 810, 990, 'STIFFENER'); ld(v, 815 + 10, -513 - 10, 808, 1088, '90° OUTSIDE\nCORNER FILLET\nWELD');
    wd(v, [[-d / 2 + 10, 5]], 662, 892, { size: '6', other: true }); wd(v, [[d / 2 - 5, 30]], 662, 917, { size: '6', both: true }); wd(v, [[d / 2, 0]], 662, 941, { size: '6', other: true });
    wd(v, [[d / 2 + 40, -s.tf], [d / 2 + 40, -d + 30]], 688, 977, { tail: 'TYP.' }); wd(v, [[0, -d - 6]], 576, 1025, { size: '6', both: true, tail: 'TYP.' });
    wd(v, [[-571 - 60, 145 - 80]], 470, 984, {}); wd(v, [[815 - 60, -513 + 140]], 805, 1006, {}); wd(v, [[815 - 70, -513 - 80]], 727, 1093, {});
    vt(B, 600, 1087, 'DETAIL 2', 10);
    // ---- PILE CONNECTION - TIMBER PACKING OPTION (1:5)
    const p18 = SEC['180PFC'];
    v = vw(B, 5, 917, 879);
    v.rect(-40, 0, 80, 105, 'S-NEW'); v.line(0, 0, 0, 105, 'S-HIDDEN'); zh(v, 105, -60, 60); cSecH(v, 0, 0, p18, -1); v.line(-p18.d / 2, 0, p18.d / 2, 0, 'S-NEW');
    v.rect(-p18.d / 2 + p18.tf, -205, p18.d - 2 * p18.tf, 205 - p18.tw, 'S-NEW'); v.line(-60, -p18.tw, -60, -205, 'S-HIDDEN'); v.line(60, -p18.tw, 60, -205, 'S-HIDDEN'); v.line(0, -p18.tw, 0, -205, 'S-HIDDEN'); v.line(-90, -165, 90, -165, 'S-HIDDEN'); v.line(-90, -178, 90, -178, 'S-HIDDEN'); zh(v, -205, -110, 110);
    wd(v, [[-40, 0]], 878, 858, { other: true }); wd(v, [[p18.d / 2, -p18.b + 10]], 979, 933, { size: '6', both: true, tail: 'TYP.' }); v.mark(380, -100, 'J', 0);
    vt(B, 927, 1007, 'VIEW J', 5);
    v = vw(B, 5, 1179, 879); const gp = 75;
    v.rect(-gp, -40, gp, 40, 'S-NEW'); v.line(-gp, -8, 0, -8, 'S-HIDDEN'); v.rect(-gp, -230, gp, 190 - 20, 'S-NEW'); v.line(-gp, -60, 0, -60, 'S-NEW'); zh(v, -230, -gp - 20, 20);
    v.rect(0, 0, 75, 130, 'S-NEW'); zh(v, 130, -20, 95);
    v.line(0, 0, 0, -260, 'S-NEW'); v.line(d, -d, d, -260, 'S-NEW'); v.line(d - 12, -d, d - 12, -260, 'S-NEW'); zh(v, -260, -20, d + 20);
    v.line(0, 0, 330, 0, 'S-NEW'); v.line(0, -12, 330, -12, 'S-NEW'); v.line(d, -d, 330, -d, 'S-NEW'); v.line(d, -d + 12, 330, -d + 12, 'S-NEW'); v.line(0, 0, d, -d, 'S-NEW'); v.rect(d - 12, -d + 12, 12, d - 24, 'S-NEW'); zz(v, 330, -d, 0);
    v.dim(-gp, 75, 0, 75, 0, ''); ld(v, -gp, 75, 1110, 828, 'LENGTH TO SUIT GAP', { noArrow: true }); v.dim(-gp - 40, -60, -gp - 40, -40, 0, '20');
    ld(v, -gp + 10, -20, 1113, 888, '180 PFC'); ld(v, -40, -175, 1126, 949, 'PROPOSED\nTIMBER\nPACKER', { dot: true }); ld(v, 60, 60, 1240, 838, 'HALF-CAP/FULL-CAP\nCONNECTION CHANNEL,\nTYPE 1 OR TYPE 2'); ld(v, 120, -150, 1295, 972, 'ABUTMENT TOP\nCONNECTION\nTYPE B,C,E OR F', { dot: true });
    mt(B, 1057, 1042, 'PILE CONNECTION - TIMBER PACKING OPTION', 5);
    nt(B, 1137, 1065, [GN, PROP, SHIM], 250);
    return B.E;
  }, 'Abutment UC pile repair where the pile top is mitred into a UC corbel under a full-cap (Type B) or two half-caps (Type C), with the Type 1 connection channel and the timber packing option (after MRWA 1330-0015).');
  def('hcch1', 'Halfcaps', 'Half-cap / full-cap connection channel – Types 1 / 2', '1330-0015 / 1330-0017', [P('type', 'Type', 1, { opts: [1, 2], num: 1 }), P('pfc', 'PFC size', '150PFC', { opts: ['125PFC', '150PFC', '180PFC', '200PFC'] }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const B = new Builder(), hc = max(200, +p.hc || 300), t2 = +p.type === 2, v = chanType1(B, 100, 120, hc, t2);
    if (t2) { lvl(v, 130, hc - 20 + 180, 140, 18, 'TOP OF\nHALF-CAP/FULL-CAP'); lvl(v, -330, 0, 20, 70, 'UNDERSIDE OF\nHALF-CAP/\nFULL-CAP'); }
    else lvl(v, -330, 0, 20, 66, 'UNDERSIDE OF\nHALF-CAP/\nFULL-CAP');
    ld(v, 55, (t2 ? hc + 160 - 100 : hc - 100) - 10, 140, 50, 'φ22 HOLE\n(TYP.)'); ld(v, 75, 0, 140, 128, '125, 150, 180 OR\n200 PFC LENGTH\nTO SUIT');
    vt(B, 95, 160, 'ELEVATION'); mt(B, 95, 182, 'HALF-CAP/FULL-CAP CONNECTION CHANNEL - TYPE ' + (t2 ? 2 : 1), 10, null);
    nt(B, 20, 205, [GN, SHIM], 250);
    return B.E;
  }, 'PFC (125 – 200) shimmed into the gap between the cap and the proposed connection, holes for φ20 rods; Type 2 runs up to the underside of the spiking rail (after MRWA 1330-0015 / 0017).');
  // ---------------------------------------------------------------- 1330-0016 ABUTMENT PILE REPAIR - TOP DETAILS - SHEET 3 OF 4 (TYPE D / E)
  const PACKX = "FOR TIMBER OR STEEL PACKING\nREQUIREMENT REFER DIMENSION\n'X' ON ABUTMENT TOP\nCONNECTION DETAIL TYPE - A\nON DRG N° 1330-0014";
  // Type E / F / G style (spiking rail at the top): x = 0 at the sheeting inner face, y = 0 at the corbel top.
  // o.pfcPk: proposed PFC packer up to the spiking rail (Type E/F); o.pfcCap: existing PFC half-cap instead of timber (Type G); o.tp: timber packer behind the PFC packer (F)
  function abutRail(v, s, hc, o) {
    const d = s.d, tf = s.tf, g = 140, sh = 10, hw = 210, xr = g, top = o.top || 836, xe = g + sh + hw + 20;
    v.line(-75, -560, -75, top + 230, 'S-EXIST'); v.line(0, -560, 0, top, 'S-EXIST'); zh(v, -560, -110, 30); [-200, 150, 450, 700].forEach(y => v.line(-75, y, 0, y, 'S-EXIST'));
    v.rect(-75, top + 226, g + 75, 70, 'S-EXIST'); tbx(v, 0, top, g, 226);
    if (o.tp) { v.rect(0, 0, 60, top, 'S-EXIST'); }
    const c0 = o.tp ? 60 : 0;
    if (o.pfcCap) { // pile runs up to the spiking rail; PFC half-cap bolted to its flange
      v.rect(0, 0, d, top - 20, 'S-NEW'); v.line(tf, 0, tf, top - 20, 'S-NEW'); v.line(d - tf, 0, d - tf, top - 20, 'S-NEW');
    } else { v.rect(c0, 0, g - c0 + (o.tp ? 0 : 0), top, 'S-NEW'); v.line(c0 + 9.5, 0, c0 + 9.5, top, 'S-NEW'); v.line(g - 9.5, 0, g - 9.5, top, 'S-NEW'); }
    return { g, sh, hw, xe, top, c0 };
  }
  function abutD(v, s, hc) { // Type D: x = 0 at the pile face (sheeting side), y = 0 at the corbel top
    const d = s.d, tf = s.tf, X = 90, pd = 250, pf = SEC['250PFC'], hw = 150, yh = pd;
    v.line(-X - 75, -540, -X - 75, yh + hc + 400, 'S-EXIST'); v.line(-X, -540, -X, yh + hc, 'S-EXIST'); zh(v, -540, -X - 110, -X + 30); [-300, 0, 250, 450].forEach(y => v.line(-X - 75, y, -X, y, 'S-EXIST'));
    deckStr(v, -X, -X - 75, d + hw + 420, yh + hc, 400, 125, 4);
    v.rect(0, -430, d, yh + hc - 20 + 430, 'S-NEW'); v.line(tf, -430, tf, yh + hc - 20, 'S-NEW'); v.line(d - tf, -430, d - tf, yh + hc - 20, 'S-NEW'); zh(v, -430, -30, d + 30);
    tbx(v, d + 8, yh, hw, hc); [yh + hc - 100, yh + 75].forEach(y => rodH(v, d - tf, d + 8 + hw, y));
    shim(v, d, 0, 8, pd); cSec(v, d + 8, pd / 2, pf, 1, 'S-EXIST'); [pd - 75, 75].forEach(y => v.bolt(d - tf, y, d + 8 + pf.tw, y, 20));
    iElevWebH(v, d, d + 200, -d / 2, s); [-tf / 2, -d + tf / 2].forEach(y => v.rect(tf, y - 5, d - 2 * tf, 10, 'S-NEW'));
    v.dim(-140, yh + hc - 20, -140, yh + hc, 0, '20'); v.line(-160, yh + hc, 0, yh + hc, 'S-DIM');
    return { X, pd, yh, hw };
  }
  def('atDE', 'Abutments', 'Abutment top connection – Types D / E', '1330-0016', [P('type', 'Show', 'ALL', { opts: ['ALL', 'D', 'E'] }), P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('X', "Packing 'X' (mm)", 40, { num: 1 }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], hc = max(200, +p.hc || 300), d = s.d, b = s.b, t = String(p.type);
    if (t !== 'E') { // ---- TYPE D
      let v = vw(B, 10, 264, 333), r = abutD(v, s, hc);
      callout(v, d - 10, -d / 2, 245, 1, 508, -443, '1330-0014');
      v.mark(508, 1243, 'K', 180); v.line(508, 1243 - 30, 508, 1110, 'S-TITLE'); { const q = v.P(508, -605); v.add({ t: 'solid', p: [[q[0] - 0.2, q[1] + 8], [q[0] - 0.2, q[1]], [q[0] + 1.6, q[1] + 4]], L: 'S-TEXT' }); v.add({ t: 'line', a: [q[0] - 0.2, q[1] + 10], b: [q[0] - 0.2, q[1]], L: 'S-TITLE' }); }
      ld(v, 346, r.yh + hc + 240, 248, 96, 'EXISTING TIMBER\nSTRINGER', { dot: true }); ld(v, -r.X - 75, r.yh + hc + 470, 191, 153, 'EXISTING TIMBER\nDECKING'); ld(v, 81, 411, 169, 237, 'PROPOSED\nUC PILE', { dot: true });
      lds(v, [[-46, 192], [d + 4, r.pd + 30]], 212, 269, PACKX); ld(v, -r.X - 75, 76, 191, 339, 'EXISTING TIMBER\nSHEETING');
      ld(v, 115, -s.tf, 230, 395, 'PROVIDE 2x10FL WEB STIFFENERS\nTO NEAR FACE AND FAR FACE.'); ld(v, d + 60, 4, 369, 301, 'PROVIDE GALV. STEEL SHIMS\nIF REQUIRED TO ENSURE TIGHT FIT'); ld(v, d + 200, -d / 2, 371, 374, 'PROPOSED UC CORBEL TO MATCH\nPROPOSED UC PILE SIZE x200 LONG');
      vt(B, 288, 469, 'ELEVATION'); mt(B, 307, 497, 'ABUTMENT TOP CONNECTION DETAIL - TYPE D', 10);
      // SECTION K
      v = vw(B, 10, 783, 332); const pd = r.pd;
      tbeam(v, -400, 690, pd, pd + hc); [pd, pd - 16, 16, 0].forEach(y => v.line(-400, y, 690, y, 'S-EXIST')); zz(v, -400, 0, pd); zz(v, 690, 0, pd);
      v.line(-400, pd + hc + 390, 690, pd + hc + 390, 'S-EXIST'); v.line(-400, pd + hc + 510, 690, pd + hc + 510, 'S-EXIST'); zz(v, -400, pd + hc + 390, pd + hc + 510); zz(v, 690, pd + hc + 390, pd + hc + 510); v.circ(323, pd + hc + 190, 200, 'S-EXIST');
      v.rect(-b / 2, 0, b, pd + hc - 20, 'S-HIDDEN'); v.line(0, 0, 0, pd + hc - 20, 'S-HIDDEN');
      bw(v, 69, pd + hc - 100, 65); bw(v, -65, pd + 75, 65); v.boltEnd(69, pd - 75, 22); v.boltEnd(-65, 75, 22);
      v.dim(-70, pd + hc + 40, 70, pd + hc + 40, 8, '140'); v.text(-35, pd + hc + 75, '=', 2, 'c'); v.text(35, pd + hc + 75, '=', 2, 'c');
      v.dim(-470, pd + hc - 100, -470, pd + hc, 0, '100'); v.dim(-470, pd, -470, pd + 75, 0, '75'); v.dim(-270, 0, -270, 75, 0, '75', { sub: '(TYP.)' }); [[pd + hc - 100, 69], [pd + 75, -65], [75, -65]].forEach(q => v.line(-490, q[0], q[1], q[0], 'S-DIM'));
      ucEnd(v, 0, 0, s); v.rect(-b / 2, -d, b, d, 'S-NEW'); iElevFlange(v, 0, -d - 360, -d, s); zh(v, -d - 360, -b / 2 - 30, b / 2 + 30);
      v.cl(0, -d - 400, 0, pd + hc + 620, 'PILE'); cutLR(v, -640, 900, 432, 'B'); { const q = v.P(900, 432); B.E.push({ t: 'text', p: [q[0] + 4.5, q[1] - 1], s: '1330-0014', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); } cutLR(v, -640, 900, 88, 'L');
      ld(v, 69, pd + hc - 100, 712, 159, '2 N°. φ20 THREADED RODS\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE.\nSITE DRILL HOLES TO SUIT'); ld(v, 589, pd + hc * 0.6, 942, 188, 'EXISTING TIMBER\nHALF-CAP', { dot: true });
      ld(v, 531, 81, 942, 271, 'EXISTING OR PROPOSED\nPFC HALF-CAP', { dot: true }); ld(v, b / 2, -335, 851, 444, 'PROPOSED UC PILE');
      vt(B, 790, 480, 'SECTION K', 10);
      // SECTION L
      v = vw(B, 10, 1266, 317); const Xp = 92;
      tbeam(v, -430, 440, -104, -12); shim(v, -130, -12, 260, 12); iSec(v, 0, d / 2, s, 0); tbx(v, -150, d, 300, Xp); tbeam(v, -430, 440, d + Xp, d + Xp + 80);
      [-62, 62].forEach(x => rodV(v, x, -12, s.tf, 20)); v.dim(-370, 0, -370, d + Xp, 0, 'GAP VARIES');
      lds(v, [[-69, d + 30], [-127, 6]], 1223, 181, PACKX); ld(v, 231, d + Xp + 80, 1332, 208, 'EXISTING TIMBER\nSHEETING'); ld(v, s.tw / 2, d / 2, 1314, 283, 'PROPOSED UC PILE');
      ld(v, -80, -12, 1228, 369, '2 N°. φ22 HOLES TO SUIT\nM20 BOLTS. SITE DRILL TO SUIT'); ld(v, 46, -53, 1307, 360, 'EXISTING OR PROPOSED\nPCF HALF-CAP\nSTRENGTHENING/REPLACEMENT', { dot: true });
      vt(B, 1253, 410, 'SECTION L', 10);
    }
    if (t !== 'D') { // ---- TYPE E
      let v = vw(B, 10, 283, 800), r = abutRail(v, s, hc, {}); const tf = s.tf;
      shim(v, r.g, 0, r.sh, hc); tbx(v, r.g + r.sh, 0, r.hw, hc); [hc - 75, 75].forEach(y => rodH(v, r.g - 9.5, r.g + r.sh + r.hw, y));
      v.line(0, 0, 0, -470, 'S-NEW'); v.line(tf, -tf, tf, -470, 'S-NEW'); v.line(d, -d, d, -470, 'S-NEW'); v.line(d - tf, -d, d - tf, -470, 'S-NEW'); zh(v, -470, -30, d + 30);
      v.pl([[0, 0], [r.xe, 0], [r.xe, -d], [d, -d]], false, 'S-NEW'); v.line(tf, -tf, r.xe, -tf, 'S-NEW'); v.line(d, -d + tf, r.xe, -d + tf, 'S-NEW'); v.line(0, 0, d, -d, 'S-NEW'); v.rect(d - 12, -d + tf, 12, d - 2 * tf, 'S-NEW'); v.rect(tf, -d - 6, d - 2 * tf, 12, 'S-NEW');
      v.dim(r.xe - 20, -30, r.xe, -30, 0, '20');
      callout(v, d - 10, -d / 2 - 30, 290, 2, 423, -612, '1330-0015'); v.mark(705, 370, 'M', 180);
      ld(v, -75, r.top + 260, 224, 585, 'EXISTING TIMBER\nCAPPING'); ld(v, 70, r.top + 120, 349, 585, 'EXISTING SPIKING\nRAIL'); ld(v, 70, 547, 349, 657, 'PROPOSED PFC\nPACKER', { dot: true });
      lds(v, [[r.g + 5, hc + 10], [r.g + 5, 30]], 192, 686, 'PROVIDE GALV.\nSTEEL SHIMS\nIF REQUIRED TO\nENSURE TIGHT FIT\nREFER NOTE 3.'); ld(v, -75, 104, 251, 777, 'EXISTING TIMBER\nSHEETING');
      ld(v, 300, 173, 404, 777, 'EXISTING TIMBER\nHALF-CAP (TYP.)', { dot: true }); ld(v, d - 6, -99, 233, 830, '12PL. STIFFENER\n(TYP.)'); ld(v, r.xe, -d / 2 + 30, 404, 844, 'PROPOSED UC CORBEL\nTO MATCH PROPOSED\nUC PILE SIZE, LENGTH TO SUIT');
      ld(v, d * 0.6, -d * 0.6, 404, 895, 'MITRE CUT UC SECTION LENGTH\nTO SUIT PROPOSED UC PILE'); ld(v, 92, -434, 215, 873, 'PROPOSED\nUC PILE', { dot: true });
      vt(B, 282, 940, 'ELEVATION'); mt(B, 311, 971, 'ABUTMENT TOP CONNECTION DETAIL - TYPE E', 10);
      B.noteBox(X(510), Y(928), 'NOTE:\nFOR PILE REPAIR TYPE E. IF TIMBER PACKER IS\nREQUIRED BETWEEN PROPOSED UC PILE AND\nEXISTING TIMBER SHEETING REFER TO TIMBER\nPACKING OPTION ON DRG N° 1330-0015', 100, { solid: true });
      // VIEW M
      v = vw(B, 10, 786, 800);
      tbeam(v, -420, 330, 0, hc); v.pl([[-420, 735], [-60, 735], [-60, 1067], [-380, 1067], [-420, 1040]], false, 'S-EXIST'); v.rect(-60, 838, 425, 290, 'S-EXIST'); zz(v, -420, 735, 900); zz(v, 365, 838, 1128);
      v.rect(-39, 0, 74, 836, 'S-NEW'); bw(v, 0, hc - 75, 65); bw(v, 0, 75, 65);
      v.line(-b / 2 - 10, 0, b / 2 + 10, 0, 'S-NEW'); ucEnd(v, 0, 0, s); v.rect(-b / 2, -d, b, d, 'S-NEW'); iElevFlange(v, 0, -d - 340, -d, s); zh(v, -d - 340, -b / 2 - 30, b / 2 + 30);
      v.dim(b / 2 - 10, -d / 2, b / 2, -d / 2, 0, '10', { sub: '(TYP.)' }); cutLR(v, -620, 515, 159, 'N');
      ld(v, -252, 887, 692, 579, 'EXISTING DECK', { dot: true }); ld(v, -39, 432, 710, 683, 'REFER TO HALF-CAP/ FULL-CAP\nCONNECTION CHANNEL - TYPE 2\nREFER DRG N° 1330-0017');
      ld(v, -275, 108, 692, 835, 'EXISTING TIMBER\nHALF-CAP (TYP.)', { dot: true }); ld(v, -85, -145, 730, 871, '12PL STIFFENER\n(TYP.)', { dot: true }); ld(v, 20, 75, 851, 823, 'φ22 HOLE TO SUIT\nφ20 THREADED ROD\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP.)');
      vt(B, 788, 943, 'VIEW M', 10);
      // SECTION N
      v = vw(B, 10, 1085, 733); abutBCSec(v, false, 190);
      ld(v, -65, 140, 1026, 663, 'PROPOSED UC PILE'); ld(v, 120, 190, 1147, 664, 'EXISTING TIMBER\nSHEETING OR PACKER'); ld(v, 62, 12, 1147, 698, '125 - 200 PFC SHIMMED TO FIT GAP\nBETWEEN EXISTING TIMBER\nFULL-CAP AND PROPOSED\nFULL-CAP CONNECTION CHANNEL\nREFER NOTE 3.');
      ld(v, 189, -145, 1147, 797, 'EXISTING TIMBER\nFULL-CAP (TYP.)'); wd(v, [[30, 4]], 1038, 780, { size: '6', all: true });
      vt(B, 1080, 838, 'SECTION N', 10);
    }
    nt(B, 1137, 1065, [GN, PROP, SHIM], 250);
    return B.E;
  }, 'Abutment UC pile repair: Type D where an existing / proposed PFC half-cap strengthening is bolted to the pile; Type E with a PFC packer up to the spiking rail and a mitred corbel (after MRWA 1330-0016).');
  // ---------------------------------------------------------------- 1330-0017 ABUTMENT PILE REPAIR - TOP DETAILS - SHEET 4 OF 4 (TYPE F / G, CHANNEL TYPE 2)
  function slope15(v, x0, x1, y) { const dy = (x1 - x0) * Math.tan(15 * PI / 180); v.line(x0, y, x1, y - dy, 'S-NEW'); v.line(x1, y - dy, x1 + 40, y - dy - 11, 'S-DIM'); v.line(x1 + 10, y + 60, x1 + 10, y - dy - 5, 'S-DIM'); const p = v.P(x1 + 30, y - 5); v.add({ t: 'text', p, s: '15°', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-DIM' }); }
  def('atFG', 'Abutments', 'Abutment top connection – Types F / G (spiking rail)', '1330-0017', [P('type', 'Show', 'ALL', { opts: ['ALL', 'F', 'G'] }), P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], hc = max(200, +p.hc || 300), d = s.d, b = s.b, tf = s.tf, t = String(p.type);
    if (t !== 'G') { // ---- TYPE F
      let v = vw(B, 10, 263, 313); const tp = 150, g = 140, sh = 10, hw = 150, c0 = tp, xh = c0 + g + sh, xe = xh + hw + 20, top = 838;
      v.line(-75, -560, -75, top + 230, 'S-EXIST'); v.line(0, -560, 0, top, 'S-EXIST'); zh(v, -560, -110, 30); [-200, 150, 450, 700].forEach(y => v.line(-75, y, 0, y, 'S-EXIST'));
      v.pl([[-75, top + 226], [-75, top + 306], [tp + 20, top + 306], [tp + 20, top + 226], [-75, top + 226]], false, 'S-EXIST'); tbx(v, 0, top, tp, 226);
      v.rect(0, 0, tp, top, 'S-NEW'); v.line(0, 0, tp, top, 'S-HIDDEN');
      v.pl([[c0, 0], [c0, top], [c0 + g, top - g * Math.tan(15 * PI / 180)], [c0 + g, 0]], false, 'S-NEW'); v.line(c0 + 9.5, 0, c0 + 9.5, top - 3, 'S-NEW'); v.line(c0 + g - 9.5, 0, c0 + g - 9.5, top - 35, 'S-NEW'); slope15(v, c0, c0 + g, top);
      shim(v, c0 - sh, 0, sh, hc); shim(v, c0 + g, 0, sh, hc); tbx(v, xh, 0, hw, hc); [hc - 75, 75].forEach(y => rodH(v, c0 + g - 9.5, xh + hw, y));
      v.line(0, 0, 0, -470, 'S-NEW'); v.line(tf, -tf, tf, -470, 'S-NEW'); v.line(d, -d, d, -470, 'S-NEW'); v.line(d - tf, -d, d - tf, -470, 'S-NEW'); zh(v, -470, -30, d + 30);
      v.pl([[0, 0], [xe, 0], [xe, -d], [d, -d]], false, 'S-NEW'); v.line(tf, -tf, xe, -tf, 'S-NEW'); v.line(d, -d + tf, xe, -d + tf, 'S-NEW'); v.line(0, 0, d, -d, 'S-NEW'); v.rect(d - 12, -d + tf, 12, d - 2 * tf, 'S-NEW'); v.rect(tf, -d - 6, d - 2 * tf, 12, 'S-NEW');
      v.dim(xe - 20, -30, xe, -30, 0, '20');
      callout(v, d - 10, -d / 2 - 20, 335, 2, 416, -578, '1330-0015'); v.mark(866, 381, 'P', 180);
      ld(v, tp + 20, top + 306, 329, 59, 'EXISTING TIMBER\nCAPPING'); ld(v, 46, top + 76, 329, 105, 'EXISTING SPIKING RAIL', { dot: true }); ld(v, 46, 670, 236, 161, 'TIMBER PACKER', { dot: true }); ld(v, c0 + 70, 434, 368, 177, 'PROPOSED PFC PACKER', { dot: true });
      lds(v, [[c0 - 5, hc + 10], [c0 + g + 5, 20]], 209, 219, 'PROVIDE GALV.\nSTEEL SHIMS\nIF REQUIRED TO\nENSURE TIGHT FIT\nREFER NOTE 3.'); ld(v, -75, 120, 241, 289, 'EXISTING TIMBER\nSHEETING');
      ld(v, xh + 50, 185, 388, 290, 'EXISTING TIMBER\nHALF-CAP (TYP.)', { dot: true }); ld(v, d - 6, -58, 252, 340, '12PL. STIFFENER\n(TYP.)'); ld(v, xe, -d / 2 + 30, 388, 355, 'PROPOSED UC CORBEL\nTO MATCH PROPOSED\nUC PILE SIZE, LENGTH TO SUIT');
      ld(v, d * 0.6, -d * 0.6, 388, 404, 'MITRE CUT UC SECTION LENGTH\nTO SUIT PROPOSED UC PILE'); ld(v, 92, -439, 179, 399, 'PROPOSED\nUC PILE', { dot: true });
      vt(B, 288, 455, 'ELEVATION'); mt(B, 310, 487, 'ABUTMENT TOP CONNECTION DETAIL - TYPE F', 10);
      B.noteBox(X(495), Y(446), 'NOTE:\nFOR PILE REPAIR TYPE F. IF TIMBER PACKER IS\nREQUIRED BETWEEN PROPOSED UC PILE AND\nEXISTING TIMBER SHEETING REFER TO TIMBER\nPACKING OPTION ON DRG N° 1330-0015', 100, { solid: true });
      // VIEW P
      v = vw(B, 10, 760, 313);
      tbeam(v, -690, 160, 0, hc); v.circ(-381, hc + 185, 200, 'S-EXIST'); v.pl([[-540, 700], [-80, 700], [-80, 1040], [-300, 1040], [-320, 1000], [-540, 1000]], false, 'S-EXIST'); v.rect(-80, 770, 420, 330, 'S-EXIST'); zz(v, -540, 700, 900); zz(v, 340, 770, 1100);
      v.rect(-35, 0, 70, 800, 'S-NEW'); bw(v, 0, hc - 75, 65); bw(v, 0, 75, 65);
      v.line(-b / 2 - 10, 0, b / 2 + 10, 0, 'S-NEW'); ucEnd(v, -20, 0, s); v.rect(-20 - b / 2, -d, b, d, 'S-NEW'); iElevFlange(v, -20, -d - 340, -d, s); zh(v, -d - 340, -20 - b / 2 - 30, -20 + b / 2 + 30);
      v.dim(-20 + b / 2 - 10, -d / 2, -20 + b / 2, -d / 2, 0, '10', { sub: '(TYP.)' }); cutLR(v, -820, 377, 108, 'Q');
      ld(v, -219, 905, 660, 106, 'EXISTING DECK', { dot: true }); ld(v, -381, hc + 185, 612, 155, 'EXISTING TIMBER\nSTRINGER', { dot: true }); ld(v, 35, 397, 805, 198, 'REFER TO HALF-CAP/FULL-CAP\nCONNECTION CHANNEL - TYPE 2');
      ld(v, -162, 185, 680, 348, 'EXISTING TIMBER\nHALF-CAP', { dot: true }); ld(v, -101, -152, 712, 384, '12PL STIFFENER\n(TYP.)', { dot: true }); ld(v, 20, 75, 821, 329, 'φ22 HOLE SITE DRILLED TO SUIT\nφ20 THREADED ROD\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP.)');
      vt(B, 735, 465, 'VIEW P', 10);
      // SECTION Q
      v = vw(B, 10, 1069, 305); abutBCSec(v, true, 170);
      ld(v, 35, 157, 1124, 184, '125 - 200 PFC PACKER\nSHIMMED TO FIT GAP\nBETWEEN EXISTING\nTIMBER HALF-CAP AND\nPROPOSED HALF-CAP\nCONNECTION CHANNEL\nREFER NOTE 3.'); ld(v, 139, -99, 1121, 371, 'EXISTING TIMBER\nHALF-CAP (TYP.)', { dot: true }); ld(v, 69, -200, 1121, 398, 'PROPOSED UC CORBEL');
      wd(v, [[0, 4]], 1024, 349, { size: '6', all: true });
      vt(B, 1063, 385, 'SECTION Q', 10);
      // CHANNEL TYPE 2
      v = chanType1(B, 1417, 282, hc, true);
      lvl(v, -439, 0, 1326, 261, 'UNDERSIDE OF\nHALF-CAP/\nFULL-CAP'); lvl(v, 185, hc, 1462, 194, 'TOP OF\nHALF-CAP/FULL-CAP'); ld(v, 55, hc - 110, 1442, 252, 'φ22 HOLE\n(TYP.)'); ld(v, 75, 0, 1442, 290, '125, 150, 180 OR\n200 PFC LENGTH\nTO SUIT');
      vt(B, 1403, 324, 'ELEVATION'); mt(B, 1372, 343, 'HALF-CAP/FULL-CAP CONNECTION CHANNEL - TYPE 2', 10);
    }
    if (t !== 'F') { // ---- TYPE G
      let v = vw(B, 10, 286, 836); const Xp = 110, pd = 230, pf = SEC['230PFC'], top = 728;
      v.line(-Xp - 75, -560, -Xp - 75, top + 293, 'S-EXIST'); v.line(-Xp, -560, -Xp, top, 'S-EXIST'); zh(v, -560, -Xp - 110, -Xp + 30); [-200, 150, 450].forEach(y => v.line(-Xp - 75, y, -Xp, y, 'S-EXIST'));
      v.pl([[-Xp - 75, top + 219], [-Xp - 75, top + 293], [58, top + 293], [58, top + 219], [-Xp - 75, top + 219]], false, 'S-EXIST'); tbx(v, -Xp, top, Xp, 219);
      v.line(0, -470, 0, top, 'S-NEW'); v.line(tf, -470, tf, top, 'S-NEW'); v.line(d - tf, -470, d - tf, top - 50, 'S-NEW'); v.line(d, -470, d, top - d * Math.tan(15 * PI / 180), 'S-NEW'); slope15(v, 0, d, top); zh(v, -470, -30, d + 30);
      shim(v, d, 0, 8, pd); cSec(v, d + 8, pd / 2, pf, 1, 'S-EXIST'); [pd - 70, 58].forEach(y => v.bolt(d - tf, y, d + 8 + pf.tw, y, 20));
      iElevWebH(v, d, d + 200, -d / 2, s); [-tf / 2, -d + tf / 2].forEach(y => v.rect(tf, y - 5, d - 2 * tf, 10, 'S-NEW'));
      callout(v, d, -d / 2 + 20, 225, 1, 497, -589, '1330-0014'); v.mark(993, 196, 'R', 180);
      ld(v, -Xp - 75, top + 280, 183, 611, 'EXISTING TIMBER\nCAPPING'); ld(v, -55, top + 110, 197, 652, 'EXISTING SPIKING\nRAIL', { dot: true }); ld(v, 81, 520, 199, 712, 'PROPOSED UC PILE', { dot: true });
      lds(v, [[-69, 196], [d + 4, pd - 20]], 222, 761, PACKX); ld(v, -Xp - 75, -12, 201, 852, 'EXISTING TIMBER\nSHEETING'); ld(v, 139, -tf, 240, 890, 'PROVIDE 2x10FL WEB\nSTIFFENERS\nTO NEAR FACE\nAND FAR FACE.');
      ld(v, d + 8, 115, 404, 776, 'EXISTING PFC\nHALF-CAP'); ld(v, d + 200, -d / 2, 404, 830, 'PROPOSED UC CORBEL\nTO MATCH PROPOSED\nUC PILE SIZE x200 LONG');
      vt(B, 300, 975, 'ELEVATION'); mt(B, 302, 1005, 'ABUTMENT TOP CONNECTION DETAIL - TYPE G', 10);
      // VIEW R
      v = vw(B, 10, 765, 838);
      [pd, pd - 16, 16, 0].forEach(y => v.line(-704, y, 208, y, 'S-EXIST')); zz(v, -704, 0, pd);
      v.circ(-462, pd + 200, 210, 'S-EXIST'); v.pl([[-704, 640], [-150, 640], [-150, 960], [-420, 960], [-440, 920], [-704, 920]], false, 'S-EXIST'); v.rect(-150, 710, 290, 290, 'S-EXIST'); zz(v, -704, 640, 900);
      v.rect(-b / 2, 0, b, 710, 'S-NEW'); v.line(0, 0, 0, 710, 'S-HIDDEN'); v.boltEnd(-74, 69, 22); v.boltEnd(65, 173, 22);
      ucEnd(v, 0, 0, s); v.rect(-b / 2, -d, b, d, 'S-NEW'); iElevFlange(v, 0, -d - 330, -d, s); zh(v, -d - 330, -b / 2 - 30, b / 2 + 30);
      v.dim(-70, 710 + 60, 70, 710 + 60, 8, '140'); v.text(-35, 800, '=', 2, 'c'); v.text(35, 800, '=', 2, 'c'); v.dim(300, 173, 300, pd + 18, 0, '75', { sub: '(TYP.)' }); v.line(65, 173, 330, 173, 'S-DIM');
      v.cl(0, -d - 380, 0, 1080, 'PILE'); cutLR(v, -980, 439, 92, 'S');
      ld(v, -185, 127, 676, 871, 'EXISTING PFC HALF-CAP', { dot: true }); ld(v, 65, 173, 812, 871, '2 N°. φ22 HOLES\nTO SUIT M20 BOLTS.\nSITE DRILL TO SUIT');
      vt(B, 753, 975, 'VIEW R', 10);
      // SECTION S
      v = vw(B, 10, 1069, 772);
      tbeam(v, -240, 220, -88, -8); shim(v, -127, -8, 230, 8); v.rect(-115, -130, 240, 122, 'S-NEW'); iSec(v, 0, d / 2, s, 0); [-1, 1].forEach(k => v.line(k * (b / 2 - 10), tf, k * (b / 2 - 10), d - tf, 'S-NEW'));
      tbx(v, -150, d + 10, 300, 85); tbeam(v, -370, 220, d + 105, d + 185); [-62, 62].forEach(x => rodV(v, x, -8, tf, 20));
      v.dim(-b / 2, d + 230, -b / 2 + 10, d + 230, 0, '10', { sub: '(TYP.)' }); v.dim(-460, 0, -460, d + 10, 0, 'GAP VARIES');
      ld(v, 30, d - tf - 15, 1105, 659, '20 CHAMFER TO\nSTIFFENERS TO CLEAR\nUC PILE RADIUS (TYP.)'); lds(v, [[150, d + 50], [110, -4]], 1146, 736, PACKX); ld(v, 115, -69, 1146, 815, 'EXISTING PFC\nHALF-CAP', { dot: true });
      vt(B, 1060, 860, 'SECTION S', 10);
    }
    nt(B, 1137, 1065, [GN, PROP, SHIM], 250);
    return B.E;
  }, 'Abutment UC pile repair under a spiking rail: Type F with timber packer and PFC packer on a mitred corbel; Type G with the UC pile run up to the spiking rail and the existing PFC half-cap bolted to it (after MRWA 1330-0017).');
  // ---------------------------------------------------------------- 1330-0018 … 0021 HALF-CAP STRENGTHENING (shared drawing functions)
  const HSN = {
    pile: 'RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED HALF-CAP REPAIRS. RE-USE EXISTING PILE BANDS WHERE POSSIBLE TO THE SATISFACTION OF THE SUPERINTENDENT\'S REPRESENTATIVE.',
    prop: 'PROP STRINGERS AND CORBELS PRIOR TO INSTALLING HALF-CAP STRENGTHENING. INSTALL HALF-CAP STRENGTHENING BY JACKING AGAINST TIMBER HALF-CAP TO REMOVE ALL BOWS, DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT TO THE EXISTING TIMBER HALF-CAP.',
    galv: 'MAKE GOOD DAMAGED GALV. SURFACE BY APPLYING COLD GALV. OR SIMILAR APPROVED IN ACCORDANCE WITH SPECIFICATION 835.',
    brg: 'IF EXISTING BEARING IS LESS THAN REQUIRED MIN. REFER TO DRG N°s 1330-0022'
  };
  const BRG = '70 MIN. BEARING FOR\nPILES WITH DIA.\nGREATER THAN 340\nOR 90 MIN. BEARING FOR\nPILES WITH DIA. 340 OR\nLESS. REFER NOTE 5.';
  const SHIM130 = '130x(6,8,10 OR 12FL)x300 LONG\nGALV STEEL SHIM IF REQUIRED.\nTACK WELD STEEL SHIMS\nTOGETHER AFTER PLACEMENT.\nREFER NOTE 4.';
  // title + main caption written under a view drawn on a Lay view (paper coords relative to the view's own builder)
  function capUnder(v, t, main, sc, sub) { const bb = A.bbox(v.B.E), cx = (bb.x0 + bb.x1) / 2; let y = bb.y0 - 8; if (t) { v.B.title(cx, y, t); y -= 9; } if (main) v.B.mainTitle(cx, y - 4, main, sc, sub); }
  // rounded rectangle (connection call-out boundary on the strengthening elevations)
  function rrect(v, x, y, w, h, r) { const P0 = []; [[x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180], [x + w - r, y + r, 270]].forEach(c => { for (let i = 0; i <= 6; i++) { const a = (c[2] + i * 15) * PI / 180; P0.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } }); v.pl(P0, true, 'S-TEXT'); }
  // strengthening elevation (1:20): y = 0 at the PFC underside; xp = pile centres
  function hsElev(v, o) {
    const s = o.s, D = o.D, hc = o.hc, pk = o.packer ? 50 : 0, pd = s.d, yh = pd + pk, xp = o.xp, W = xp[xp.length - 1];
    const xa = -D / 2 - 200, xb = W + D / 2 + 200, x0 = xa - 500, x1 = xb + 500, Dl = 420, nl = o.abut ? 1 : 2, yc = yh + hc + Dl / 2, ys = yc + (nl - 1) * Dl, yd = yh + hc + nl * Dl;
    tbeam(v, x0, x1, yh, yh + hc); tbeam(v, x0, x1, yd, yd + 120);
    if (pk) { v.rect(xa, pd, xb - xa, pk, 'S-NEW'); v.hatch([[xa, pd], [xb, pd], [xb, pd + pk], [xa, pd + pk]], 'ansi31', 'S-HATCH', 1.5); }
    pfcElevH(v, xa, xb, pd, s, 'S-NEW');
    const xs = Array.from({ length: o.ns }, (_, i) => x0 + 350 + i * (x1 - x0 - 700) / max(1, o.ns - 1));
    xs.forEach(x => { v.circ(x, yc, Dl / 2, 'S-EXIST'); if (nl > 1) v.circ(x, ys, Dl / 2, 'S-EXIST'); v.line(x - 8, yh, x - 8, yd, 'S-HIDDEN'); v.line(x + 8, yh, x + 8, yd, 'S-HIDDEN'); v.rect(x - 30, yd - 8, 60, 8, 'S-BOLT'); v.rect(x - 30, yh + hc, 60, 8, 'S-BOLT'); if (nl > 1) v.rect(x - 30, ys - Dl / 2, 60, 8, 'S-BOLT'); });
    // rods at 900 max. crs
    const rods = []; const n = Math.ceil((xb - xa - 100) / 900); for (let i = 0; i <= n; i++) { const x = xa + 50 + i * (xb - xa - 100) / n; if (xp.every(q => abs(q - x) > D / 2 + 40) && xs.every(q => abs(q - x) > 60)) rods.push(x); }
    rods.forEach(x => { v.line(x, pd - s.tf - 30, x, yh + hc + 30, 'S-BOLT'); v.rect(x - 32, yh + hc, 64, 6, 'S-BOLT'); v.rect(x - 18, yh + hc + 6, 36, 16, 'S-BOLT'); v.rect(x - 18, pd - s.tf - 16, 36, 16, 'S-BOLT'); });
    // splice in the half-cap between the first two piles (existing bolts replaced)
    if (xp.length > 1) { const xm = (xp[0] + xp[1]) / 2; v.line(xm - 250, yh + hc, xm + 250, yh, 'S-EXIST'); }
    xp.forEach((x, i) => {
      if (o.abut && i === 1 && xp.length > 2) { // existing steel pile (Type 3): UC hidden behind the PFC, half-cap support angles
        const u = SEC['250UC73']; v.line(x - u.b / 2, -560, x - u.b / 2, yh + hc - 20, 'S-HIDDEN'); v.line(x + u.b / 2, -560, x + u.b / 2, yh + hc - 20, 'S-HIDDEN'); v.line(x, -560, x, yh + hc - 20, 'S-HIDDEN'); zh(v, -560, x - u.b / 2 - 30, x + u.b / 2 + 30);
        [[x - 60, yh + hc * 0.35], [x + 60, yh + hc * 0.7]].forEach(q => bw(v, q[0], q[1], 65)); [pd * 0.25, pd * 0.5, pd * 0.75].forEach(y => v.boltEnd(x + 60, y, 20));
        rrect(v, x - u.b / 2 - 50, -230, u.b + 100, yh + hc - 40 + 230, 80); return;
      }
      if (o.abut && i === xp.length - 1 && xp.length > 2) { [-1, 1].forEach(k => { v.rect(x + k * 75 - 50, 15, 100, pd - 30, 'S-HIDDEN'); v.boltEnd(x + k * 105, pd * 0.3, 20); v.boltEnd(x + k * 105, pd * 0.7, 20); }); v.circ(x, pd / 2, 12, 'S-BOLT'); }
      v.line(x - D / 2, -560, x - D / 2, 0, 'S-EXIST'); v.line(x + D / 2, -560, x + D / 2, 0, 'S-EXIST'); v.pileEnd(x, -560, D, 'S-EXIST'); v.line(x - D / 2, 0, x - D / 2, yh, 'S-HIDDEN'); v.line(x + D / 2, 0, x + D / 2, yh, 'S-HIDDEN');
      v.rect(x - D / 2 - 15, -150, D + 30, 35, 'S-EXIST'); [-1, 1].forEach(k => { const p = v.P(x + k * 90, pd / 2); v.add({ t: 'circle', c: p, r: 0.6, L: 'S-BOLT' }); v.fill([[x + k * 90 - 12, pd / 2 - 12], [x + k * 90 + 12, pd / 2 - 12], [x + k * 90 + 12, pd / 2 + 12], [x + k * 90 - 12, pd / 2 + 12]], 'S-BOLT'); });
      bw(v, x - 60, yh + hc * 0.35, 65); bw(v, x + 60, yh + hc * 0.7, 65); v.rect(x - 150, -10, 300, 10, 'S-NEW');
      rrect(v, x - D / 2 - 30, -230, D + 60, yh + hc - 40 + 230, 80);
    });
    v.cl(xp[0], -640, xp[0], yd + 250);
    return { xa, xb, x0, x1, yh, yd, yc, ys, xs, rods, pd, pk, Dl };
  }
  // DETAIL 1 packing options (1:10): x = 0 at the trimmed pile face (PFC web back), y = 0 at the PFC underside
  function packOpt(v, s, timber, D) {
    const pd = s.d, b = s.b, pk = 50, top = pd + pk, Dp = D || 380;
    v.pl([[-70, -160], [-70, -10], [0, -10], [0, top]], false, 'S-EXIST'); v.pl([[0, top], [Dp - 170, top], ...Array.from({ length: 7 }, (_, i) => { const a = (90 - i * 15) * PI / 180; return [Dp - 170 + 100 * Math.cos(a), top - 100 + 100 * Math.sin(a)]; }), [Dp - 70, -60], ...Array.from({ length: 7 }, (_, i) => { const a = (-i * 15) * PI / 180; return [Dp - 170 + 100 * Math.cos(a), -60 + 100 * Math.sin(a)]; }), [Dp - 170, -160], [-70, -160]], false, 'S-EXIST');
    cSec(v, 0, pd / 2, s, -1); shim(v, -b, -10, b, 10);
    if (timber) tbx(v, -130, pd, 150, pk); else { rhsSec(v, -50, pd + 25, 100, 50, 5); }
    v.rect(-150, top, 260, 110, 'S-EXIST'); v.line(-150, top, 110, top + 110, 'S-EXIST'); v.line(-150, top + 110, 110, top, 'S-EXIST'); zh(v, top + 110, -170, 130);
    rodV(v, -55, pd - s.tf, top + 90, 20); v.line(10, pd / 2 + 10, 260, pd / 2 + 10, 'S-HIDDEN'); v.line(10, pd / 2 - 10, 260, pd / 2 - 10, 'S-HIDDEN'); v.nut(-s.tw, pd / 2, -1, 0, 20);
    v.dim(-55, top + 160, 0, top + 160, 0, '55', { sub: '(TYP.)' }); v.line(-55, top + 110, -55, top + 190, 'S-DIM'); v.line(0, top + 110, 0, top + 190, 'S-DIM');
    v.dim(-70, -130, 0, -130, 0, ''); v.line(-70, -160, -70, -150, 'S-DIM');
    v.dim(-b - 30, -10, -b - 30, 0, 0, '');
    return { pd, top };
  }
  // DETAIL 2 / 3: corbel holding-down bolt at the packer (1:10)
  function det23(v, hc, pk, w) {
    const pd = 300, yh = pd + pk; tbeam(v, -280, 280, yh, yh + 180, false); v.line(-280, yh + 180, 280, yh + 180, 'S-EXIST');
    if (pk) { v.line(-280, pd + pk, 280, pd + pk, 'S-HIDDEN'); v.line(-280, pd, 280, pd, 'S-HIDDEN'); v.line(-w / 2, pd, -w / 2, pd + pk, 'S-HIDDEN'); v.line(w / 2, pd, w / 2, pd + pk, 'S-HIDDEN'); }
    v.line(-280, pd, 280, pd, 'S-NEW'); v.line(-280, pd - 16, 280, pd - 16, 'S-NEW'); v.line(-280, 16, 280, 16, 'S-NEW'); v.line(-280, 0, 280, 0, 'S-NEW'); zz(v, -280, 0, pd); zz(v, 280, 0, pd);
    v.line(-8, yh, -8, yh + 260, 'S-HIDDEN'); v.line(8, yh, 8, yh + 260, 'S-HIDDEN'); zh(v, yh + 260, -30, 30); v.rect(-32, yh - 6, 64, 6, 'S-BOLT'); v.rect(-16, yh - 22, 32, 16, 'S-BOLT');
    v.dim(-w / 2, yh - 60, w / 2, yh - 60, 0, String(w)); v.text(-w / 4, yh - 100, '=', 2, 'c'); v.text(w / 4, yh - 100, '=', 2, 'c'); v.line(0, yh - 150, 0, yh - 40, 'S-CL');
    return { pd, yh };
  }
  // Type 1 / 2 connection elevation (1:10): x = 0 on the pile, y = 0 at the PFC underside
  function hcConnElev(v, s, hc, D, pk) {
    const pd = s.d, yh = pd + pk; tbeam(v, -600, 450, yh, yh + hc); if (pk) v.line(-600, pd + pk, 450, pd + pk, 'S-NEW');
    [pd, pd - s.tf, s.tf, 0].forEach(y => v.line(-600, y, 450, y, 'S-NEW')); zz(v, -600, 0, pd); zz(v, 450, 0, pd);
    v.rect(-D / 2 + 50, -10, D - 100, yh + hc - 40 + 10, 'S-HIDDEN'); v.line(-D / 2, -560, -D / 2, -10, 'S-EXIST'); v.line(D / 2, -560, D / 2, -10, 'S-EXIST'); v.pileEnd(0, -560, D, 'S-EXIST');
    bw(v, -100, yh + hc * 0.35, 65); bw(v, 90, yh + hc * 0.75, 65); [-1, 1].forEach(k => { v.circ(k * D / 2 * 0.86, pd / 2, 18, 'S-BOLT'); v.circ(k * D / 2 * 0.86, pd / 2, 9, 'S-BOLT'); }); v.line(-D / 2 * 0.86, pd / 2 + 10, D / 2 * 0.86, pd / 2 + 10, 'S-HIDDEN'); v.line(-D / 2 * 0.86, pd / 2 - 10, D / 2 * 0.86, pd / 2 - 10, 'S-HIDDEN');
    shim(v, -150, -10, 300, 10); v.rect(-D / 2 - 15, -145, D + 30, 35, 'S-EXIST');
    v.dim(-150, -270, 150, -270, 0, '300', { sub: 'SHIM PLATE' }); v.line(-150, -10, -150, -290, 'S-DIM'); v.line(150, -10, 150, -290, 'S-DIM');
    v.dim(D / 2 + 150, -110, D / 2 + 150, -10, 0, '100'); v.line(D / 2 + 20, -110, D / 2 + 170, -110, 'S-DIM');
    v.dim(D / 2 - 25, -330, D / 2, -330, 0, '25', { sub: 'NOTCH' });
    v.cl(0, -620, 0, yh + hc + 150, 'PILE');
  }
  // Section A / B (1:10): x = 0 on the pile, y = 0 at the PFC underside; both: PFC on both faces (Type 2)
  function hcConnSec(v, s, hc, D, both, steelPile) {
    const pd = s.d, pk = 50, yh = pd + pk, xw = D / 2 - 70, g = 124, hw = 180;
    tbx(v, -g / 2 - hw, yh, hw, hc); tbx(v, g / 2, yh, hw, hc); v.line(-g / 2, yh + hc, g / 2, yh + hc, 'S-EXIST');
    if (!steelPile) { v.pl([[-D / 2, -400], [-D / 2, -10], [-xw, -10], [-xw, yh]], false, 'S-EXIST'); v.pl([[D / 2, -400], [D / 2, both ? -10 : yh]], false, 'S-EXIST'); if (both) v.pl([[D / 2, -10], [xw, -10], [xw, yh]], false, 'S-EXIST'); v.pileEnd(0, -400, D, 'S-EXIST'); v.rect(-D / 2 - 15, -145, D + 30, 35, 'S-EXIST'); }
    [-1].concat(both ? [1] : []).forEach(k => { cSec(v, k * xw, pd / 2, s, k); shim(v, k > 0 ? xw : -xw - s.b, -10, s.b, 10); rhsSec(v, k * (xw + 50), pd + 25, 100, 50, 5); rodV(v, k * (xw + 55), pd - s.tf, yh + hc, 20); });
    if (both) { v.line(-xw - 30, pd / 2 + 10, xw + 30, pd / 2 + 10, 'S-BOLT'); v.line(-xw - 30, pd / 2 - 10, xw + 30, pd / 2 - 10, 'S-BOLT'); v.nut(-xw - s.tw, pd / 2, -1, 0, 20); v.nut(xw + s.tw, pd / 2, 1, 0, 20); }
    else { v.line(-xw + 10, pd / 2 + 10, D / 2 + 60, pd / 2 + 10, 'S-BOLT'); v.line(-xw + 10, pd / 2 - 10, D / 2 + 60, pd / 2 - 10, 'S-BOLT'); v.nut(-xw - s.tw, pd / 2, -1, 0, 20); }
    v.dim(-xw - 55, yh + hc + 120, -g / 2, yh + hc + 120, 0, '50 MIN.', { sub: '(TYP.)' }); v.line(-g / 2, yh + hc, -g / 2, yh + hc + 140, 'S-DIM'); v.line(-xw - 55, yh + hc + 30, -xw - 55, yh + hc + 140, 'S-DIM');
    v.cl(0, -460, 0, yh + hc + 260, 'PILE');
    return { xw, yh, pd, g, hw };
  }
  // PLAN at a pile (1:10): x along the half-cap, y = 0 on the half-cap / pier centre line; both: PFC both sides
  function hcPlan(v, s, D, both, abut) {
    const b = s.b, hw = 180, yf = -hw / 2;
    v.line(-520, yf, 520, yf, 'S-NEW'); v.line(-520, yf - b, 520, yf - b, 'S-NEW'); v.line(-520, yf + s.tw, 520, yf + s.tw, 'S-HIDDEN'); zz(v, -520, yf - b, yf); zz(v, 520, yf - b, yf);
    if (both) { v.line(-520, -yf, 520, -yf, 'S-NEW'); v.line(-520, -yf + b, 520, -yf + b, 'S-NEW'); v.line(-520, -yf - s.tw, 520, -yf - s.tw, 'S-HIDDEN'); zz(v, -520, -yf, -yf + b); zz(v, 520, -yf, -yf + b); }
    v.circ(0, 0, D / 2, 'S-HIDDEN'); v.line(-560, 0, 560, 0, 'S-CL'); { const p = v.P(560, 0); v.add({ t: 'text', p: [p[0] + 2, p[1] - 1], s: abut ? '℄ ABUTMENT' : '℄ PIER', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
    v.rect(-130, yf - b - 60, 260, 60, 'S-NEW'); if (both) v.rect(-130, -yf + b, 260, 60, 'S-NEW');
    if (both) [-1, 1].forEach(k => { v.line(k * 145 - 10, yf - 30, k * 145 - 10, -yf + 30, 'S-BOLT'); v.line(k * 145 + 10, yf - 30, k * 145 + 10, -yf + 30, 'S-BOLT'); v.nut(k * 145, yf, 0, -1, 20); v.nut(k * 145, -yf, 0, 1, 20); });
    else { const r = 145; [-1, 1].forEach(k => { v.line(k * r - 10, yf - 20, k * r - 10, 0, 'S-BOLT'); v.line(k * r + 10, yf - 20, k * r + 10, 0, 'S-BOLT'); v.nut(k * r, yf, 0, -1, 20); }); v.arc(0, 0, r - 10, 0, 180, 'S-BOLT'); v.arc(0, 0, r + 10, 0, 180, 'S-BOLT'); }
    if (abut) { v.line(-520, hw / 2 + 120, 520, hw / 2 + 120, 'S-EXIST'); v.line(-520, hw / 2 + 200, 520, hw / 2 + 200, 'S-EXIST'); v.hatch([[-120, hw / 2 + 200], [120, hw / 2 + 200], [120, hw / 2 + 240], [-120, hw / 2 + 240]], 'earth', 'S-HATCH'); }
    return { yf };
  }
  function hsTitle(v, isAbut, packer) { capUnder(v, 'ELEVATION', (isAbut ? 'ABUTMENT' : 'PIER') + ' HALF-CAP STRENGTHENING DETAIL', 20, packer ? 'PACKER OPTION' : 'NO PACKER OPTION'); }
  // whole strengthening sheet (1330-0018 pier / 1330-0020 abutment)
  function hsSheet(p, isAbut) {
    const LY = new Lay(790), s = SEC[p.pfc] || SEC['300PFC'], sp = String(p.piles).split(/[ ,;]+/).map(Number).filter(x => x > 0), D = max(200, +p.D || 380), hc = max(200, +p.hc || 300), ns = max(2, min(20, +p.ns || 7));
    const xp = [0]; (sp.length ? sp : [2000]).forEach(d => xp.push(xp[xp.length - 1] + d));
    const opt = String(isAbut ? p.pack : p.packer), both = /both|ALL/i.test(opt), list = both ? [true, false] : [!/no|none/i.test(opt)];
    const elev = (packer) => {
      const v = LY.view(20), r = hsElev(v, { s, D, hc, ns, xp, packer, abut: isAbut }), xr = r.x1;
      v.dim(r.xa, -330, r.rods[0] || r.xa + 50, -330, 0, '50 MIN.', { sub: '(TYP.)' }); v.dim(r.xa, -500, xp[0] - D / 2, -500, 0, '100 MIN. - 300 MAX.', { sub: '(TYP.)' });
      v.leader(r.x0 + 300, r.yd + 60, -14, 18, 'EXISTING TIMBER\nDECK', {}); v.leader(r.rods[0] || r.xa + 50, r.yh + hc + 20, -18, 20, 'φ20 THREADED RODS\nAT 900 MAXIMUM CRS.\nTHROUGH φ22 HOLE IN\nPFC WITH 65x5FLx65\nWASHER TO TIMBER FACE\n(TYP.)');
      if (xp.length > 1) { const xm = (xp[0] + xp[1]) / 2; v.leaders([[xm - 130, r.yh + hc], [xm + 60, r.yh + hc]], 6, (r.yd + 300 - r.yh - hc) / 20, 'REPLACE EXISTING SPLICE BOLTS\nWHERE POSSIBLE USING\nφ20 THREADED RODS WITH\n65x5FLx65 WASHER TO TIMBER FACES'); }
      v.leader(r.xa, r.pd + 20, -14, -10, packer ? 'STEEL OR TIMBER\nPACKER. STEEL\nSHOWN REFER\nDETAIL 1' : 'PFC HALF-CAP\nSTRENGTHENING');
      if (packer) v.leader(xp[0] + D, 0, 12, -14, 'PFC HALF-CAP\nSTRENGTHENING');
      v.leader(xp[0] + D / 2 + 30, -150, 12, -18, 'REFER HALFCAP TO PILE\nCONNECTION - TYPE 1');
      if (xp.length > 1) { v.leader(xp[1] + D / 2 + 30, -150, 12, -18, isAbut ? 'REFER HALFCAP TO PILE\nCONNECTION - TYPE 3\nON DRG N° 1330-0021' : 'REFER HALFCAP TO PILE\nCONNECTION - TYPE 2\nON DRG N° 1330-0019'); v.leader(xp[1] + 300, r.pd / 2, 6, -10, 'φ22 HOLE (TYP.)'); }
      if (isAbut && xp.length > 2) v.leader(xp[xp.length - 1] - D / 2 - 15, -150, -8, -18, 'REFER HALFCAP TO PILE\nCONNECTION - TYPE 2\nON DRG N° 1330-0021');
      const xl = xp[xp.length - 1]; v.leader(xl + D / 2 + 15, -130, 14, -2, 'PILE BAND (TYP.)'); v.leader(xl + D / 2, -380, 14, -4, 'EXISTING TIMBER\nPILE (TYP.)');
      const xsl = r.xs[r.xs.length - 1]; v.leader(xsl + r.Dl / 4, r.ys + 40, 14, 14, 'EXISTING TIMBER\nSTRINGER (TYP.)'); if (!isAbut) v.leader(xsl + r.Dl / 4, r.yc, 14, 8, 'EXISTING TIMBER\nCORBEL (TYP.)'); v.leader(xr - 200, r.yh + hc, 12, 2, isAbut ? 'EXISTING TIMBER\nHALF-CAP (TYP.)' : 'EXISTING TIMBER\nHALF-CAP');
      const xm2 = xp.length > 2 ? (xp[1] + xp[2]) / 2 : (xp[0] + xp[xp.length - 1]) / 2, xc = r.xs.reduce((a, x) => abs(x - xm2) < abs(a - xm2) ? x : a, r.xs[0]);
      v.circ(xc, r.yh, 110, 'S-TEXT'); { const a = v.P(xc + 60, r.yh - 95), bb = v.P(xc + 260, r.yh - 420); v.add({ t: 'line', a, b: [bb[0], bb[1] + 3], L: 'S-TEXT' }); v.add({ t: 'circle', c: bb, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p: bb, s: packer ? '2' : '3', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
      hsTitle(v, isAbut, packer);
    };
    const plan = () => { const v = LY.view(10); hcPlan(v, s, D, false, isAbut); v.leader(-145, 120, -14, 16, "φ20 THREADED 'U' ROD"); v.leader(-300, -90 - s.b, -12, -14, 'PFC HALF-CAP\nSTRENGTHENING.'); v.leader(60, -90 - s.b - 60, -10, -10, 'SHIM PLATES'); if (isAbut) v.leader(200, 90 + 200, 10, 8, 'EXISTING TIMBER\nSHEETING'); capUnder(v, 'PLAN'); };
    const det1 = (tim) => {
      const v = LY.view(10), r = packOpt(v, s, tim, D);
      if (tim) v.leader(-80, r.pd + 25, -16, 14, (isAbut ? 'φ20 THREADED ROD\n' : '') + '150x50 MIN. SEASONED\nJARRAH TIMBER PACKER, 1 N°\nφ20 THREADED ROD REQUIRED\nPER TIMBER PACKER TYPICAL');
      else { v.leader(-80, r.pd + 45, -16, 14, '100x50x5.0 RHS\nPACKER'); v.weld(-100, r.pd + 10, -10, -2, { size: '5', len: '50-300', both: true }); }
      v.leader(140, r.top - 40, 18, 16, 'EXISTING\nTIMBER PILE', { dot: true }); v.weld(-s.b, -5, -14, 10, { size: '4', site: true });
      v.leader(-s.b - 30, -10, -20, -10, SHIM130); v.leader(-35, -10, -10, -40, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED PFC.'); v.mtext(30, -150, BRG, TH, 'l');
      capUnder(v, tim ? 'TIMBER PACKING OPTION.' : 'RHS PACKING OPTION.', tim ? 'DETAIL 1' : null, 10);
    };
    const t1 = () => {
      let v = LY.view(10); hcConnElev(v, s, hc, D, 50); v.mark(320, 700 + s.d, 'A', 180); v.line(320, 640 + s.d, 320, 560 + s.d, 'S-TITLE');
      v.leader(-300, s.d + 50 + hc, -14, 12, 'EXISTING TIMBER\nHALF-CAP'); v.leader(-120, -10, -18, -6, 'SHIM PLATES'); v.leader(-D / 2 - 15, -128, -16, -12, 'PILE BAND\nREFER NOTE 2');
      capUnder(v, 'ELEVATION');
      v = LY.view(10); const q = hcConnSec(v, s, hc, D, false, false); callout(v, -q.xw - 30, q.pd / 2 + 40, 230, 1, -q.xw - 400, q.pd / 2 + 120);
      v.leader(-q.xw - 55, q.yh + hc + 30, -14, 12, 'φ20 THREADED ROD\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE'); v.leader(q.g / 2 + q.hw, q.yh + hc * 0.6, 14, 6, 'EXISTING TIMBER\nHALF-CAP (TYP.)'); v.leader(D / 2 + 50, q.pd / 2, 14, 10, "φ20 THREADED\n'U' ROD");
      v.leader(-q.xw - 50, q.pd + 40, -20, 10, 'STEEL OR TIMBER\nPACKER IF\nREQUIRED'); v.leader(-q.xw - s.tw, q.pd / 3, -20, -10, 'PFC HALF-CAP\nSTRENGTHENING'); v.leader(-D / 2, -380, -18, -8, 'EXISTING TIMBER\nPILE');
      if (isAbut) { v.line(D / 2 + 120, -500, D / 2 + 120, q.yh + hc, 'S-EXIST'); v.line(D / 2 + 200, -500, D / 2 + 200, q.yh + hc, 'S-EXIST'); v.leader(D / 2 + 160, -300, 12, -6, 'EXISTING TIMBER\nSHEETING'); v.leader(D / 2 - 10, q.pd / 2 - 40, 14, -16, "NOTCH EXISTING PILE FACE\nTO ALLOW INSTALLATION\nOF THREADED 'U'-ROD"); }
      capUnder(v, 'SECTION A', 'HALF-CAP TO PILE CONNECTION DETAIL - TYPE 1', 10);
    };
    const d23 = (pk, w, n) => {
      const v = LY.view(10), r = det23(v, hc, pk, w);
      v.leader(-6, r.yh + 200, -16, 14, 'EXISTING TIMBER\n' + (isAbut && n === '3' ? 'STRINGER TO HALFCAP' : 'COBEL TO HALFCAP') + '\nHOLDING DOWN BOLT'); v.leader(-200, r.yh + 120, -10, 0, 'EXISTING TIMBER\nHALFCAP', { dot: true });
      if (pk) v.leader(-120, r.pd + 25, -14, -18, 'STEEL OR TIMBER\nPACKER.'); v.leader(16, r.yh - 14, 16, -10, 'TRIM BOLT TO SUIT IF\nREQUIRED. 65x5FLx65\nWASHER\nTO TIMBER FACE'); v.leader(100, 0, 12, -8, 'PFC HALF-CAP\nSTRENGTHENING');
      capUnder(v, 'DETAIL ' + n, null);
    };
    if (both) { elev(true); det1(false); det1(true); LY.break(); elev(false); plan(); d23(50, 100, '2'); LY.break(); t1(); d23(0, 75, '3'); }
    else { elev(list[0]); det1(false); det1(true); LY.break(); plan(); t1(); d23(50, 100, '2'); d23(0, 75, '3'); }
    LY.notes([GN, HSN.pile, HSN.prop, HSN.galv, HSN.brg], 150);
    return LY.done();
  }
  def('phs', 'Halfcaps', 'Pier half-cap strengthening (PFC)', '1330-0018', [P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('piles', 'Pile spacings (mm, comma)', '2000, 2000, 2000', {}), P('ns', 'Number of stringers', 7, { num: 1 }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('hc', 'Halfcap depth (mm)', 300, { num: 1 }), P('packer', 'Packer option', 'both', { opts: ['both', 'yes', 'no'] })], (p) => hsSheet(p, false),
    'PFC half-cap strengthening under a pier half-cap, rods at 900 crs, drawn for the pile spacings and stringer count you enter, with the packing options, Type 1 pile connection and Details 1 – 3 (after MRWA 1330-0018).');
  // ---------------------------------------------------------------- 1330-0019 PIER HALF-CAP STRENGTHENING - SHEET 2 OF 2 (CONNECTION TYPE 2)
  def('phc2', 'Halfcaps', 'Pier half-cap to pile connection – Type 2 (PFC both faces)', '1330-0019', [P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('hc', 'Halfcap depth (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(560), s = SEC[p.pfc] || SEC['300PFC'], D = max(200, +p.D || 380), hc = max(200, +p.hc || 300);
    let v = LY.view(10); hcPlan(v, s, D, true, false);
    v.leader(-145, 100, -16, 14, 'φ20 THREADED ROD\n(TYP.)'); v.leader(-300, -90 - s.b, -12, -14, 'PFC HALF-CAP\nSTRENGTHENING\n(TYP.)'); v.leader(60, -90 - s.b - 60, -10, -10, 'SHIM PLATES\n(TYP.)'); capUnder(v, 'PLAN');
    v = LY.view(10); const q = hcConnSec(v, s, hc, D, true, false); callout(v, -q.xw - 30, q.pd / 2 + 40, 230, 1, -q.xw - 400, q.pd / 2 + 60, '1330-0018');
    v.leader(-q.xw - 55, q.yh + hc + 30, -14, 12, 'φ20 THREADED ROD\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP.)'); v.leader(q.g / 2 + q.hw, q.yh + hc * 0.6, 14, 6, 'EXISTING TIMBER\nHALF-CAP (TYP.)'); v.leader(q.xw - 40, q.pd / 2 + 10, 16, 18, 'φ20 THREADED ROD\nTHROUGH φ22 HOLE\nIN PFC');
    v.leader(-q.xw - 50, q.pd + 40, -20, 10, 'STEEL OR TIMBER\nPACKER IF\nREQUIRED'); v.leader(-q.xw - s.tw, q.pd / 3, -20, -10, 'PFC HALF-CAP\nSTRENGTHENING\n(TYP.)'); v.leader(-D / 2, -300, -18, -8, 'EXISTING TIMBER\nPILE');
    capUnder(v, 'SECTION B', null, 10);
    LY.break();
    v = LY.view(10); hcConnElev(v, s, hc, D, 50); v.mark(320, 700 + s.d, 'B', 180); v.line(320, 640 + s.d, 320, 560 + s.d, 'S-TITLE');
    v.leader(-300, s.d + 50 + hc, -14, 12, 'EXISTING TIMBER\nHALF-CAP'); v.leader(-120, -10, -18, -6, 'SHIM PLATES'); v.leader(-D / 2 - 15, -128, -16, -12, 'PILE BAND\nREFER NOTE 2');
    capUnder(v, 'ELEVATION', 'HALF-CAP TO PILE CONNECTION DETAIL - TYPE 2', 10);
    LY.notes([GN, HSN.pile, HSN.prop, HSN.galv], 150);
    return LY.done();
  }, 'Half-cap to pile connection where PFC strengthening is fitted to both faces of the pier half-cap: two φ20 rods through both PFCs either side of the pile (after MRWA 1330-0019).');
  // ---------------------------------------------------------------- 1330-0020 ABUTMENT HALF-CAP STRENGTHENING DETAILS - SHEET 1 OF 2
  def('ahs', 'Abutments', 'Abutment half-cap / full-cap strengthening (PFC)', '1330-0020', [P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('piles', 'Pile spacings (mm, comma)', '1800, 1800, 1800', {}), P('ns', 'Number of stringers', 7, { num: 1 }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('hc', 'Cap depth (mm)', 300, { num: 1 }), P('pack', 'Packing option', 'both', { opts: ['both', 'RHS', 'timber', 'none'] })], (p) => hsSheet(p, true),
    'PFC strengthening on the front face of an abutment half-cap with Type 1 / 2 / 3 pile connections, packing options and Details 1 – 3 (after MRWA 1330-0020).');
  // ---------------------------------------------------------------- 1330-0021 ABUTMENT HALF-CAP STRENGTHENING DETAILS - SHEET 2 OF 2 (CONNECTION TYPES 2 / 3)
  // section through the abutment cap at a pile: x = 0 on the pile centre, sheeting at -x, y = 0 at the PFC underside
  function abSec(v, s, hc, D, steel) {
    const pd = s.d, pk = 50, yh = pd + pk, xf = steel ? 125 : D / 2 - 70, hw = 170, xs = steel ? -125 - 20 : -D / 2 - 30;
    v.line(xs - 80, -400, xs - 80, yh + hc + 60, 'S-EXIST'); v.line(xs, -400, xs, yh + hc + 60, 'S-EXIST'); zh(v, yh + hc + 60, xs - 100, xs + 20); [-250, -60, 150, yh + 60].forEach(y => v.line(xs - 80, y, xs, y, 'S-EXIST'));
    v.hatch([[xs - 140, -60], [xs - 80, -60], [xs - 80, 200], [xs - 140, 200]], 'earth', 'S-HATCH', 0.8);
    tbx(v, xf - 40, yh, hw, hc); v.pl([[xs, yh + hc], [xf - 40, yh + hc]], false, 'S-EXIST');
    rodV(v, xf + 55, pd - s.tf, yh + hc, 20); if (steel) [yh + hc * 0.3, yh + hc * 0.7].forEach(y => rodH(v, xs - 80, xf - 40 + hw, y));
    cSec(v, xf, pd / 2, s, 1); rhsSec(v, xf + 50, pd + 25, 100, 50, 5);
    if (!steel) {
      v.pl([[-D / 2, -400], [-D / 2, yh]], false, 'S-EXIST'); v.pl([[D / 2, -400], [D / 2, -10], [xf, -10], [xf, yh]], false, 'S-EXIST'); v.pileEnd(0, -400, D, 'S-EXIST'); v.rect(-D / 2 - 15, -145, D + 30, 35, 'S-EXIST');
      shim(v, xf, -10, s.b, 10);
      // UA cleat with coach screw into the pile
      v.rect(xf - 10, 30, 10, 230, 'S-NEW'); v.rect(xf - 100, 30, 90, 230, 'S-NEW'); [65, 225].forEach(y => { v.circ(xf - 60, y, 14, 'S-BOLT'); v.circ(xf - 60, y, 7, 'S-BOLT'); }); [90, 210].forEach(y => v.bolt(xf - 10, y, xf + s.tw, y, 20, 'nut'));
      v.line(xf - 10, 150 + 10, xf - 250, 150 + 10, 'S-HIDDEN'); v.line(xf - 10, 150 - 10, xf - 250, 150 - 10, 'S-HIDDEN'); v.nut(xf + s.tw, 150, 1, 0, 20);
    } else {
      const u = SEC['250UC73']; v.line(-u.d / 2, -400, -u.d / 2, yh + hc - 20, 'S-EXIST'); v.line(u.d / 2, -400, u.d / 2, yh, 'S-EXIST'); v.line(-u.d / 2 + u.tf, -400, -u.d / 2 + u.tf, yh + hc - 20, 'S-EXIST'); v.line(u.d / 2 - u.tf, -400, u.d / 2 - u.tf, yh, 'S-EXIST'); zh(v, -400, -u.d / 2 - 30, u.d / 2 + 30);
      v.line(-u.d / 2, yh + hc - 20, u.d / 2 + 20, yh + hc - 20, 'S-EXIST');
      shim(v, u.d / 2, 0, xf - u.d / 2, pd); [pd * 0.25, pd * 0.75].forEach(y => v.bolt(u.d / 2 - u.tf, y, xf + s.tw, y, 20));
      v.rect(u.d / 2, -260, 180, 250, 'S-EXIST'); v.line(u.d / 2, -20, u.d / 2 + 180, -20, 'S-EXIST'); v.line(u.d / 2, -160, u.d / 2 + 180, -160, 'S-EXIST');
      [-20, -160].forEach(y => v.rect(u.d / 2 - 10, y - 5, -u.d + 2 * u.tf + 10, 10, 'S-NEW'));
    }
    v.dim(xf + 55, yh + hc + 120, xf + 105, yh + hc + 120, 0, '50 MIN.', { sub: '(TYP.)' }); v.dim(xf, yh + hc * 0.55, xf + 55, yh + hc * 0.55, 0, '55');
    v.cl(0, -460, 0, yh + hc + 260, 'PILE');
    return { xf, yh, pd, xs, hw };
  }
  function abPlan(v, s, steel) {
    const b = s.b, yf = -60; v.line(-560, 150, 560, 150, 'S-EXIST'); v.line(-560, 230, 560, 230, 'S-EXIST'); zz(v, -560, 150, 230); zz(v, 560, 150, 230); v.hatch([[-150, 230], [150, 230], [150, 280], [-150, 280]], 'earth', 'S-HATCH');
    v.line(-560, yf, 560, yf, 'S-NEW'); v.line(-560, yf - b, 560, yf - b, 'S-NEW'); v.line(-560, yf - s.tw, 560, yf - s.tw, 'S-HIDDEN'); zz(v, -560, yf - b, yf); zz(v, 560, yf - b, yf);
    v.line(-600, 0, 600, 0, 'S-CL'); { const p = v.P(600, 0); v.add({ t: 'text', p: [p[0] + 2, p[1] - 1], s: '℄ ABUTMENT', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
    if (!steel) { v.circ(0, 40, 190, 'S-HIDDEN'); v.rect(-130, yf - b - 60, 260, 60, 'S-NEW'); [-1, 1].forEach(k => { aSec(v, k * 160, yf, 100, 150, 10, -k, 1); v.nut(k * 210, yf, 0, -1, 20); }); v.line(-160, 12, 160, 12, 'S-BOLT'); v.line(-160, -8, 160, -8, 'S-BOLT'); v.nut(-160, 2, -1, 0, 20); v.nut(160, 2, 1, 0, 20); v.dim(-210, yf - b - 100, -160, yf - b - 100, 0, '55', { sub: '(TYP.)' }); }
    else { const u = SEC['250UC73']; iSec(v, 0, 150 - u.d / 2 - 10, { d: u.d - 0, b: u.b, tf: u.tf, tw: u.tw }, 1, 'S-EXIST'); v.rect(-100, yf, 200, 30, 'S-NEW'); [-60, 60].forEach(x => { v.line(x - 10, yf - b - 20, x - 10, 150 - 20, 'S-BOLT'); v.line(x + 10, yf - b - 20, x + 10, 150 - 20, 'S-BOLT'); v.nut(x, yf - b + s.tf, 0, -1, 20); }); }
  }
  def('ahc', 'Abutments', 'Abutment half-cap to pile connection – Types 2 / 3', '1330-0021', [P('type', 'Type', 'ALL', { opts: ['ALL', 2, 3] }), P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('hc', 'Cap depth (mm)', 300, { num: 1 })], (p) => {
    const LY = new Lay(760), s = SEC[p.pfc] || SEC['300PFC'], D = max(260, +p.D || 380), hc = max(200, +p.hc || 300), t = String(p.type), pd = s.d, yh = pd + 50;
    const elev = (steel) => {
      const v = LY.view(10); tbeam(v, -470, 470, yh, yh + hc); [pd, pd - s.tf, s.tf, 0].forEach(y => v.line(-470, y, 470, y, 'S-NEW')); zz(v, -470, 0, pd); zz(v, 470, 0, pd);
      if (!steel) { v.rect(-D / 2 + 30, -10, D - 60, yh + hc - 40 + 10, 'S-HIDDEN'); v.line(-D / 2, -500, -D / 2, -10, 'S-EXIST'); v.line(D / 2, -500, D / 2, -10, 'S-EXIST'); v.pileEnd(0, -500, D, 'S-EXIST');
        [-1, 1].forEach(k => { v.rect(k * 115 - 50, 30, 100, 230, 'S-HIDDEN'); [65, 225].forEach(y => { v.circ(k * 115 + k * 15, y, 14, 'S-BOLT'); v.circ(k * 115 + k * 15, y, 7, 'S-BOLT'); }); [90, 210].forEach(y => v.boltEnd(k * 75, y, 20)); }); v.circ(0, 150, 12, 'S-BOLT');
        shim(v, -150, -10, 300, 10); v.rect(-D / 2 - 15, -145, D + 30, 35, 'S-EXIST');
        v.dim(-150, -270, 150, -270, 0, '300', { sub: 'SHIM PLATE' }); v.dim(D / 2 + 140, -110, D / 2 + 140, -10, 0, '100'); v.line(D / 2 + 20, -110, D / 2 + 160, -110, 'S-DIM');
        v.leader(-300, yh + hc, -14, 12, 'EXISTING TIMBER\nHALF-CAP'); v.leader(-120, -10, -18, -6, 'SHIM PLATES'); v.leader(-D / 2 - 15, -128, -16, -12, 'PILE BAND\nREFER NOTE 2'); v.leader(300, 0, 14, -10, 'PFC HALF-CAP\nSTRENGTHENING');
      } else { const u = SEC['250UC73']; v.rect(-u.b / 2, -500, u.b, yh + hc - 20 + 500, 'S-HIDDEN'); v.line(0, -500, 0, yh + hc - 20, 'S-HIDDEN'); zh(v, -500, -u.b / 2 - 30, u.b / 2 + 30);
        bw(v, -40, yh + hc * 0.3, 65); bw(v, 40, yh + hc * 0.75, 65); [pd * 0.25, pd * 0.75].forEach(y => v.boltEnd(-40, y, 22)); v.boltEnd(40, pd * 0.5, 22); v.rect(-u.b / 2, -170, u.b, 12, 'S-HIDDEN'); v.rect(-u.b / 2, -30, u.b, 12, 'S-HIDDEN');
        v.dim(-70, yh + hc + 40, 70, yh + hc + 40, 8, '140'); v.dim(320, pd * 0.75, 320, pd, 0, '75', { sub: '(TYP.)' }); v.line(40, pd * 0.75, 340, pd * 0.75, 'S-DIM');
        v.leader(-300, yh + hc, -14, 12, 'EXISTING TIMBER\nHALF-CAP'); v.leader(-u.b / 2, -160, -18, -6, 'REMOVE EXISTING HALF-CAP\nSUPPORT AND RELOCATE\nTO SUIT PROPOSED PFC\nSTRENGTHENING MAKE\nGOOD GALV. SURFACE.\nREFER DETAIL 4'); v.leader(250, 0, 14, -10, 'PFC HALF-CAP\nSTRENGTHENING');
      }
      v.cl(0, -560, 0, yh + hc + 150, 'PILE'); v.mark(-220, yh + hc + 260, steel ? 'C' : 'B', 0);
      capUnder(v, 'ELEVATION', 'HALF-CAP TO PILE CONNECTION DETAIL - TYPE ' + (steel ? 3 : 2), 10);
    };
    const plan = (steel) => { const v = LY.view(10); abPlan(v, s, steel); v.leader(-100, 230, -14, 12, 'EXISTING TIMBER\nSHEETING'); if (!steel) { v.leader(100, 12, 18, 18, 'φ20 THREADED ROD'); v.leader(80, -60 - s.b - 60, 16, -10, 'SHIM PLATES'); } v.leader(-400, -60 - s.b, -12, -14, 'PFC HALF-CAP\nSTRENGTHENING.'); capUnder(v, 'PLAN'); };
    const sec = (steel) => {
      const v = LY.view(10), r = abSec(v, s, hc, D, steel); callout(v, r.xf, r.pd / 2 + 30, 210, steel ? 4 : 5, r.xf + 300, steel ? -320 : -250);
      v.leader(r.xs - 80, r.yh + hc - 40, -14, 10, 'EXISTING TIMBER\nSHEETING'); v.leader(r.xf + 100, r.pd + 40, 16, 6, 'STEEL OR TIMBER\nPACKER IF REQUIRED.');
      if (!steel) { v.leader(-D / 2 + 20, 200, -16, 6, 'NOTCH PILE\nTO SUIT'); v.leader(r.xf - 90, 40, -18, -14, '150x100x10UA\nCLEAT'); v.leader(r.xf - 40, 150, 18, -18, 'M20 x 250 LG COACH\nSCREW (SITE DRILL\nφ22 HOLE IN PFC)\n(TYP.)'); v.leader(D / 2, -250, 14, -6, 'EXISTING TIMBER PILE'); }
      else { v.leader(r.xf - 20, r.pd * 0.6, -24, 4, 'STEEL PACKERS\n250x(6,8,10 OR 12FL) x\nHEIGHT TO SUIT PFC\nSTRENGTHENING'); v.leader(r.xf + s.tw + 30, r.pd * 0.25, 18, -12, 'M20 BOLT (TYP.)'); v.leaders([[0, -20], [0, -160]], -40, -8, 'PROVIDE -10FL\nWEB STIFFENERS\nNEAR AND FAR FACE'); v.leader(125, -300, 14, -6, 'EXISTING STEEL\nPILE'); }
      capUnder(v, steel ? 'SECTION C' : 'SECTION B', null, 10);
    };
    const det5 = () => {
      const v = LY.view(10), xf = 0; v.pl([[-120, 330], [-120, -30], [-60, -60], [200, -60]], false, 'S-EXIST'); v.arc(0, 140, 290, 100, 150, 'S-EXIST'); cSec(v, xf, s.d / 2, s, 1); shim(v, 0, -10, s.b, 10); rhsSec(v, 50, s.d + 25, 100, 50, 5); v.rect(20, s.d + 50, 160, 70, 'S-EXIST');
      v.rect(-10, 30, 10, 230, 'S-NEW'); v.rect(-100, 30, 90, 230, 'S-NEW'); [65, 225].forEach(y => { v.circ(-60, y, 14, 'S-BOLT'); v.circ(-60, y, 7, 'S-BOLT'); }); [90, 210].forEach(y => v.bolt(-10, y, s.tw, y, 20, 'nut')); v.line(-10, 160, -250, 160, 'S-HIDDEN'); v.line(-10, 140, -250, 140, 'S-HIDDEN');
      v.dim(-160, 30, -160, 260, 0, '230'); v.dim(-160, 225, -160, 260, 12, '35', { sub: 'TYP' }); v.dim(100, 90, 100, 210, 0, '120'); v.dim(-100, 330, 0, 330, 0, '100');
      v.leader(-60, 225, -14, 22, 'φ20 THREADED RODS'); v.leader(-90, 150, -20, 4, 'EXISTING\nTIMBER PILE', { dot: true }); v.leader(-40, 30, -16, -10, '150x100x10UA\nCLEAT'); v.leader(25, 210, 18, 12, '2 - M20 BOLTS (SITE DRILL\nφ22 HOLES IN PFC)');
      v.weld(s.b, -5, 12, 8, { size: '4', site: true }); v.leader(s.b + 10, -10, 12, -10, '130x(6,8,10 OR 12FL)x300\nLONG GALV STEEL SHIM IF\nREQUIRED. TACK WELD\nSTEEL SHIMS TOGETHER\nAFTER PLACEMENT. REFER\nNOTE 4.'); v.leader(10, -60, 10, -30, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED 300 PFC.');
      v.mtext(-330, -230, BRG.replace('LESS. REFER', 'LESS REFER.'), TH, 'l');
      capUnder(v, 'DETAIL 5', null);
    };
    const det4 = () => {
      const v = LY.view(10), u = SEC['250UC73']; v.line(-u.d / 2, -150, -u.d / 2, 150, 'S-EXIST'); v.line(-u.d / 2 + u.tf, -150, -u.d / 2 + u.tf, 150, 'S-EXIST'); v.line(u.d / 2, -150, u.d / 2, 150, 'S-EXIST'); v.line(u.d / 2 - u.tf, -150, u.d / 2 - u.tf, 150, 'S-EXIST'); zh(v, 150, -u.d / 2 - 30, u.d / 2 + 30); zh(v, -150, -u.d / 2 - 30, u.d / 2 + 30);
      shim(v, u.d / 2, 60, 25, 90); aSec(v, u.d / 2 + 25, 60, 120, 80, 10, 1, 1); v.rect(u.d / 2, -100, 180, 160, 'S-EXIST');
      [55, -95].forEach(y => v.rect(-u.d / 2 + u.tf, y - 5, u.d - 2 * u.tf, 10, 'S-NEW'));
      v.weld(u.d / 2 + 30, 60, 30, 14, { other: true, site: true }); v.weld(u.d / 2, 55, 30, -4, { size: '6', both: true, site: true }); v.weld(u.d / 2, -95, 30, -14, { site: true }); v.weld(-u.d / 2 + u.tf, -40, -24, 0, { size: '6', both: true, all: true, tail: 'TYP.' });
      capUnder(v, 'DETAIL 4', null);
    };
    if (t !== '3') { plan(false); sec(false); elev(false); det5(); LY.break(); }
    if (t !== '2') { plan(true); sec(true); elev(true); det4(); }
    LY.notes([GN, HSN.pile, HSN.prop, HSN.galv, HSN.brg], 150);
    return LY.done();
  }, 'Abutment PFC half-cap strengthening connected to a timber pile with UA cleats and coach screws (Type 2) or bolted to an existing steel pile through steel packers (Type 3) (after MRWA 1330-0021).');
  // ---------------------------------------------------------------- 1330-0022 PILE - HALF-CAP BEARING DETAILS
  const BRG_ROWS = [[1, '≥ 340', 70, '50-70'], [1, '< 340', 90, '70-90'], [2, '≥ 340', 70, '35-50'], [2, '< 340', 90, '55-70'], [3, '≥ 340', 70, '0-35'], [3, '< 340', 90, '0-55'], [4, '≥ 340', 70, '0-35'], [4, '< 340', 90, '0-55'], [5, '≥ 340', 70, '-'], [5, '< 340', 90, '-']];
  // sectional elevation through pile + half-cap: pile from x = -D .. 0 (face of pile at x = 0), y = 0 at the top of the bearing plate seat
  function brgElev(v, t, D, s) {
    const pf = s, pd = pf.d, A = t === 1 ? 60 : t === 2 ? 45 : t === 5 ? 0 : 25, xw = -A, ytop = 20, hw = 170, yb = -440;
    v.line(-D, yb, -D, ytop + pd + 60, 'S-EXIST'); v.pileEnd(-D / 2, yb, D, 'S-EXIST'); zh(v, ytop + pd + 60, -D - 40, -D + 120, 'S-TEXT');
    const pileTopY = t === 5 ? 20 : ytop + pd;
    if (t === 5) { // timber cap straight on the pile with a bearing plate
      v.line(0, yb, 0, 0, 'S-EXIST'); v.rect(-D / 2 - 90, 0, 180, 20, 'S-NEW'); tbx(v, -D / 2 - 100, 20, 200, 240); v.spike(-D / 2, 0, -D / 2, 150, 'S-BOLT'); v.rect(-D - 15, -145, D + 30, 35, 'S-EXIST');
      v.dim(-D / 2 - 100, 20, -D / 2 + 100, 20, 0, ''); return { A: 0, xw: -D / 2, pd: 0 };
    }
    // pile face: notched (types 1/2) to the web back, or full (types 3/4) with a bracket on the face
    if (t <= 2) { v.pl([[0, yb], [0, 0], [xw, 0], [xw, ytop + pd + 60]], false, 'S-EXIST'); }
    else v.pl([[0, yb], [0, ytop + pd + 60]], false, 'S-EXIST');
    v.rect(-D - 15, t >= 3 ? -470 : -145, D + 30, 35, 'S-EXIST');
    let yc = 0; // underside of the bearing plate
    if (t === 3) { const p2 = SEC['200PFC']; yc = -300; v.rect(0, -280, p2.b, 260, 'S-NEW'); v.line(p2.tw, -280, p2.tw, -20, 'S-HIDDEN'); v.rect(-5, -20, 150, 20, 'S-NEW'); v.rect(-5, -300, 130, 20, 'S-NEW'); [-90, -210].forEach(y => { v.line(-150, y + 10, p2.tw + 30, y + 10, 'S-HIDDEN'); v.line(-150, y - 10, p2.tw + 30, y - 10, 'S-HIDDEN'); v.nut(p2.tw, y, 1, 0, 20); }); }
    if (t === 4) { v.rect(0, -320, 12, 320, 'S-NEW'); v.pl([[12, -20], [150, -20], [90, -300], [12, -300]], false, 'S-NEW'); v.line(12, -150, 110, -150, 'S-NEW'); v.rect(12, -20, 140, 20, 'S-NEW'); v.rect(12, -320, 100, 20, 'S-NEW'); [-60, -250].forEach(y => v.spike(12, y, -130, y, 'S-BOLT')); }
    const y0 = t >= 3 ? 0 : 0; const xr = t >= 3 ? 0 : xw; v.rect(t >= 3 ? -A : xw, y0, 130, ytop, 'S-NEW');
    cSec(v, t >= 3 ? -A : xw, ytop + pd / 2, pf, 1); if (t === 2) v.rect(xw + pf.tw, ytop + pf.tf, 10, pd - 2 * pf.tf, 'S-NEW');
    // timber half-cap and rod into it
    tbx(v, (t >= 3 ? -A : xw) - hw, ytop + pd - 30, hw, 180); v.line(-D, ytop + pd - 30, (t >= 3 ? -A : xw) - hw, ytop + pd - 30, 'S-EXIST');
    v.line(-160, ytop + pd / 2 + 10, (t >= 3 ? -A : xw) + pf.tw + 25, ytop + pd / 2 + 10, 'S-HIDDEN'); v.line(-160, ytop + pd / 2 - 10, (t >= 3 ? -A : xw) + pf.tw + 25, ytop + pd / 2 - 10, 'S-HIDDEN'); v.nut((t >= 3 ? -A : xw) + pf.tw, ytop + pd / 2, 1, 0, 20);
    if (t <= 2) v.rect(-D - 15, -145, D + 30, 35, 'S-EXIST');
    return { A, xw: t >= 3 ? -A : xw, pd, ytop };
  }
  function brgPlan(v, t, D) { // sectional plan at the bearing (x across pile face, y along the half-cap)
    const L = t >= 3 ? 600 : 300; v.arc(-D / 2 + 60, 0, D / 2, 90, 270, 'S-EXIST'); v.line(-D / 2 + 60, D / 2, 0, D / 2, 'S-EXIST'); v.line(-D / 2 + 60, -D / 2, 0, -D / 2, 'S-EXIST');
    v.rect(0, -L / 2 - 120, 16, L + 240, 'S-NEW'); zh(v, L / 2 + 120, -10, 40); zh(v, -L / 2 - 120, -10, 40); v.line(16, -L / 2 - 120, 16, L / 2 + 120, 'S-NEW'); v.line(90, -L / 2 - 120, 90, L / 2 + 120, 'S-NEW');
    if (t <= 2) { v.rect(16, -150, 114, 300, 'S-NEW'); v.line(-30, -150, -30, 150, 'S-HIDDEN'); if (t === 2) v.rect(16, -5, 74, 10, 'S-NEW'); v.dim(160, -150, 160, 150, 0, '300'); }
    else if (t === 3) { v.rect(16, -150, 100, 300, 'S-NEW'); cSecH(v, 50, -60, { d: 200, b: 75, tf: 12, tw: 6 }, 1, 'S-HIDDEN'); v.dim(160, -150, 160, 150, 0, '300'); }
    else { v.rect(-12, -300, 12, 600, 'S-NEW'); v.rect(16, -300, 110, 600, 'S-NEW'); v.dim(170, -300, 170, 300, 0, '600'); }
  }
  def('hcb', 'Halfcaps', 'Pile – half-cap bearing details & table', '1330-0022', [P('type', 'Bearing type shown', 'ALL', { opts: ['ALL', 1, 2, 3, 4, 5] }), P('D', 'Pile dia. (mm)', 360, { num: 1 }), P('pfc', 'PFC half-cap', '300PFC', { opts: ['300PFC', '380PFC'] })], (p) => {
    const LY = new Lay(800), D = max(240, +p.D || 360), s = SEC[p.pfc] || SEC['300PFC'], all = !/^[1-5]$/.test(String(p.type)), types = all ? [1, 2, 3, 4, 5] : [+p.type];
    const PLN = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'F' };
    types.forEach(t => {
      // sectional plan
      let v = LY.view(10); brgPlan(v, t, D);
      if (t <= 2) { v.leader(16, -150, 14, -10, 'BEARING PLATE'); v.leader(90, -200, 14, -18, 'HALF-CAP\nSTRENGTHENING'); v.weld(16, 120, 14, 14, { size: '4', site: true, tail: 'TYP.' }); if (t === 2) v.leader(60, 5, 14, 16, '75x10FL STIFFENER\n(TYP.)'); }
      if (t === 3) { v.leader(90, 250, 14, 6, 'HALF-CAP\nSTRENGTHENING'); v.leader(60, 60, 18, 10, '200 PFC UNDER'); v.leader(116, -150, 14, -8, 'BEARING PLATE'); v.leader(40, -150, 18, -16, 'SEATING PLATE'); }
      if (t === 4) { v.leader(-12, -250, -16, -8, 'BACK PLATE'); v.leader(126, 250, 12, 6, 'SEATING PLATE'); v.leader(60, 200, -18, 10, 'BEARING PLATE'); v.leader(90, -320, 12, -8, 'HALF-CAP\nSTRENGTHENING'); }
      if (t === 5) { v.leader(10, 250, 14, 6, '180x20FLx600 LONG\nBEARING PLATE'); v.leader(8, 260, -16, 16, 'φ20x130 LONG COACH\nSCREW (GALV.) THROUGH\nφ22 HOLE'); v.boltEnd(8, 260, 22); v.boltEnd(8, -260, 22); }
      capUnder(v, 'SECTIONAL PLAN ' + PLN[t], null);
      // sectional elevation
      v = LY.view(10); const r = brgElev(v, t, D, s);
      if (t !== 5) {
        v.leader(r.xw - 80, r.ytop + r.pd + 60, -10, 16, 'EXISTING TIMBER\nHALF-CAP', { dot: true }); v.leader(r.xw + s.b, r.ytop + r.pd, 14, 10, 'PFC HALF-CAP');
        v.cut(-D - 60, r.ytop - 5, 220, r.ytop - 5, PLN[t], 270);
        v.dim(-D, -420, 0, -420, 0, '', {}); v.leader(-D / 2, -420, 16, 0, 'MIN. BEARING REQUIRED\n(REFER TABLE)', { noArrow: true });
        if (t <= 2) { v.dim(r.xw, -360, 0, -360, 0, "'A'"); v.leader(r.xw, 40, -18, 14, 'NOTCHED FACE\nOF PILE', { noArrow: true }); v.leader(r.xw + 60, 10, 18, -8, '130x20FLx300 LONG\nBEARING PLATE'); v.weld(r.xw + s.b, r.ytop + 4, 14, 10, { size: '4', site: true }); if (t === 2) v.weld(r.xw + 30, 120, 18, 22, { size: '6', both: true, all: true }); }
        else { v.dim(r.xw, r.ytop + r.pd + 140, 0, r.ytop + r.pd + 140, 0, "'A' (REFER TABLE)"); v.leader(0, -200, 18, -6, t === 3 ? '200 PFC REFER TO\nPFC BEARING\nPLATE DETAIL' : 'REFER TO BEARING\nPLATE DETAIL'); v.leader(-20, -40, -24, 18, 'FACE OF PILE\nRECESS'); if (t === 4) v.leader(90, -240, 18, -14, 'TRIM EXISTING TIMBER PILE TO SUIT\nPROPOSED SUPPORT BRACKET'); v.weld(10, 0, 18, 6, { size: '4', site: true }); }
        v.leader(-D - 15, -128, -16, -8, 'EXISTING/PROPOSED PILE\nBAND REFER NOTE 2.'); v.leader(0, -300, 14, -26, 'EXISTING TIMBER PILE\n(REFER TABLE FOR PILE DIA.)');
      } else {
        v.leader(-D / 2 + 60, 200, 16, 10, 'EXISTING TIMBER\nHALF-CAP'); v.cut(-D - 60, 10, 120, 10, 'F', 270); v.leader(-D - 15, -128, -16, -8, 'EXISTING/PROPOSED PILE\nBAND REFER NOTE 2.'); v.leader(0, -300, 14, -26, 'EXISTING TIMBER PILE\n(REFER TABLE FOR PILE DIA.)');
        v.dim(-D, -420, 0, -420, 0, ''); v.leader(-D / 2, -420, 16, 0, 'MIN. BEARING REQUIRED\n(REFER TABLE)', { noArrow: true });
      }
      capUnder(v, 'SECTIONAL ELEVATION', 'TYPE ' + t, null, t === 3 ? '(PIER REPAIR ONLY)' : null);
    });
    if (all || [3, 4].includes(+p.type)) {
      // SECTIONAL PLAN D (NOTE 3 / NOTE 4), SECTION E
      [false, true].forEach(both => {
        const v = LY.view(10); v.circ(both ? 0 : 0, 0, 180, 'S-HIDDEN');
        const side = k => { v.rect(k * 190 - (k > 0 ? 0 : 12), -300, 12, 600, 'S-NEW'); v.rect(k > 0 ? 202 : -310, -300, 108, 600, 'S-NEW'); v.line(k * 220, -360, k * 220, 360, 'S-NEW'); v.line(k * 300, -360, k * 300, 360, 'S-NEW'); [-1, 1].forEach(j => v.rect(k > 0 ? 202 : -262, j * 100 - 5, 60, 10, 'S-NEW')); };
        side(-1); if (both) { side(1); [-1, 1].forEach(j => { v.line(-190, j * 220 + 10, 190, j * 220 + 10, 'S-BOLT'); v.line(-190, j * 220 - 10, 190, j * 220 - 10, 'S-BOLT'); v.nut(-190, j * 220, -1, 0, 20); v.nut(190, j * 220, 1, 0, 20); }); }
        else { [-1, 1].forEach(j => { v.line(-190, j * 220 + 10, 0, j * 220 + 10, 'S-BOLT'); v.line(-190, j * 220 - 10, 0, j * 220 - 10, 'S-BOLT'); v.nut(-190, j * 220, -1, 0, 20); }); v.arc(0, 0, 210, -90, 90, 'S-BOLT'); v.arc(0, 0, 230, -90, 90, 'S-BOLT'); }
        [-1].concat(both ? [1] : []).forEach(k => v.spike(k * 190, 0, k * 60, 0, 'S-BOLT'));
        v.dim(-400, -300, -400, 300, 0, '600');
        v.leader(-300, 300, -14, 10, 'SEATING PLATE'); v.leader(-262, -100, -18, 10, 'BEARING PLATE'); v.leader(-196, -260, -16, -10, 'BACK PLATE'); v.leader(-300, -360, -12, -10, 'HALF-CAP\nSTRENGTHENING');
        if (both) v.leader(190, 220, 14, 18, 'φ20 THREADED\nROD (TYP.)'); else v.leader(230, 0, 14, 8, "φ20 THREADED\n'U' ROD (TYP.)");
        capUnder(v, null, 'SECTIONAL PLAN D', 10, both ? '(REFER NOTE 4.)' : '(REFER NOTE 3.)');
      });
      let v = LY.view(10); v.circ(-180, 0, 180, 'S-EXIST'); v.rect(0, -210, 12, 420, 'S-NEW'); [-1, 1].forEach(k => { v.rect(12, k * 100 - (k > 0 ? 0 : 10), 75, 10, 'S-NEW'); v.fill([[12, k * 110], [32, k * 110], [12, k * 200]]); }); v.line(-400, 0, 200, 0, 'S-CL');
      v.dim(-2, 230, 12, 230, 0, '12'); v.dim(12, 230, 87, 230, 0, '75'); v.dim(160, 100, 160, 210, 0, '110'); v.dim(160, -100, 160, 100, 0, '200'); v.dim(160, -210, 160, -100, 0, '110'); v.dim(0, -260, 90, -260, 0, '90');
      v.leader(-200, -40, -14, -16, 'EXISTING\nTIMBER PILE', { dot: true }); v.leader(6, -180, -16, -20, 'BACK PLATE'); { const q = v.P(200, 0); v.add({ t: 'text', p: [q[0] + 2, q[1] - 1], s: '℄ PILE', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
      capUnder(v, 'SECTION E', null);
    }
    // VIEW G (type 3), PFC BEARING PLATE DETAIL, VIEW H (type 4), BEARING PLATE DETAIL
    if (all || +p.type === 3) {
      let v = LY.view(10); const p2 = SEC['200PFC']; tbeam(v, -350, 350, 0, s.d); v.line(-350, s.d + 150, 350, s.d + 150, 'S-EXIST'); v.line(-350, s.d - s.tf, 350, s.d - s.tf, 'S-NEW'); v.line(-350, s.tf, 350, s.tf, 'S-NEW'); v.rect(-260, 60, 520, s.d - 60 - s.tf, 'S-HIDDEN'); [-220, 220].forEach(x => v.boltEnd(x, s.d / 2, 22));
      v.rect(-130, -20, 260, 20, 'S-NEW'); v.rect(-p2.b / 2 - 10, -280, p2.b + 20, 260, 'S-NEW'); v.line(-p2.b / 2 - 10 + p2.tf, -280, -p2.b / 2 - 10 + p2.tf, -20, 'S-NEW'); v.line(p2.b / 2 + 10 - p2.tf, -280, p2.b / 2 + 10 - p2.tf, -20, 'S-NEW'); v.rect(-130, -300, 260, 20, 'S-NEW'); [-90, -210].forEach(y => v.boltEnd(0, y, 22));
      v.line(-D / 2, -540, -D / 2, -300, 'S-EXIST'); v.line(D / 2, -540, D / 2, -300, 'S-EXIST'); v.pileEnd(0, -540, D, 'S-EXIST'); v.rect(-D / 2 - 15, -480, D + 30, 35, 'S-EXIST'); v.dim(-p2.b / 2 - 10, -560, 0, -560, 0, '='); v.dim(0, -560, p2.b / 2 + 10, -560, 0, '=');
      v.leader(130, -10, 16, 6, 'SEATING PLATE'); v.leader(p2.b / 2 + 10, -150, 16, -2, '200 PFC'); v.leader(130, -290, 16, -6, 'BEARING PLATE'); v.leader(-D / 2 - 15, -462, -16, -8, 'EXISTING/PROPOSED\nPILE BAND REFER\nNOTE 2.');
      capUnder(v, 'VIEW G', null);
      v = LY.view(10); v.rect(-150, 0, 300, 20, 'S-NEW'); v.rect(-150, 280, 300, 20, 'S-NEW'); v.rect(-50, 20, 100, 260, 'S-NEW'); v.line(-40, 20, -40, 280, 'S-NEW'); v.line(40, 20, 40, 280, 'S-NEW'); [90, 210].forEach(y => v.boltEnd(0, y, 22));
      v.dim(260, 0, 260, 20, 0, ''); v.dim(260, 20, 260, 280, 0, '260'); v.dim(330, 0, 330, 50, 0, '50'); v.dim(330, 250, 330, 300, 0, '50');
      v.leader(80, 300, 14, 14, '150x20FLx300 LONG\nSEATING PLATE'); v.leader(0, 210, -16, 14, 'φ22 HOLE TO SUIT\nφ20 THREADED ROD\n(TYP.)'); v.leader(-50, 150, -18, 0, '200 PFC'); v.leader(60, 0, 10, -14, '130x20FLx300 LONG\nBEARING PLATE'); v.weld(-50, 280, -14, 6, { size: '4', all: true }); v.weld(-50, 20, -14, -6, { size: '4', all: true, site: true });
      capUnder(v, null, 'PFC BEARING PLATE DETAIL', 10);
    }
    if (all || +p.type === 4) {
      let v = LY.view(10); tbeam(v, -400, 400, 0, s.d); v.line(-400, s.d + 150, 400, s.d + 150, 'S-EXIST'); v.line(-400, s.d - s.tf, 400, s.d - s.tf, 'S-NEW'); v.line(-400, s.tf, 400, s.tf, 'S-NEW'); [-200, 200].forEach(x => v.boltEnd(x, s.d / 2, 22)); v.line(-200, s.d / 2 + 10, 200, s.d / 2 + 10, 'S-HIDDEN'); v.line(-200, s.d / 2 - 10, 200, s.d / 2 - 10, 'S-HIDDEN');
      v.pl([[-300, 0], [300, 0], [200, -300], [-200, -300]], true, 'S-NEW'); v.rect(-300, -20, 600, 20, 'S-NEW'); v.rect(-200, -320, 400, 20, 'S-NEW'); [-1, 1].forEach(k => { v.rect(k * 75 - 6, -300, 12, 280, 'S-NEW'); v.line(k * 75, -150, k * 220, -150, 'S-NEW'); v.boltEnd(k * 200, -100, 22); });
      v.circ(-50, -220, 14, 'S-BOLT'); v.line(-D / 2, -540, -D / 2, -320, 'S-EXIST'); v.line(D / 2, -540, D / 2, -320, 'S-EXIST'); v.pileEnd(0, -540, D, 'S-EXIST'); v.rect(-D / 2 - 15, -480, D + 30, 35, 'S-EXIST');
      v.dim(380, -280, 380, -20, 0, '260'); v.dim(-80, -560, 0, -560, 0, '='); v.dim(0, -560, 80, -560, 0, '='); v.dim(150, 120, 175, 120, 0, '25 NOTCH', { sub: '(TYP.)' }); { const q = v.P(430, -150); v.add({ t: 'text', p: [q[0] + 2, q[1] - 1], s: '℄ STIFFENER', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
      v.leader(-250, -150, -16, -10, '12 THICK BACK PLATE'); v.leader(-50, -220, -18, -20, 'PRE-DRILLED φ22 HOLE\nIN BACK PLATE TO SUIT\nφ20x130 LONG COACH\nSCREW (GALV.)'); v.leader(D / 2 + 15, -462, 16, -8, 'EXISTING/PROPOSED\nPILE BAND\nREFER NOTE 2.'); v.leader(D / 2, -560, 16, -16, 'EXISTING\nTIMBER PILE');
      capUnder(v, 'VIEW H', null);
      v = LY.view(10); v.rect(-300, 0, 600, 20, 'S-NEW'); v.pl([[-300, 0], [-160, -280], [160, -280], [300, 0]], false, 'S-NEW'); v.rect(-160, -300, 320, 20, 'S-NEW'); [-1, 1].forEach(k => { v.rect(k * 75 - 6, -280, 12, 280, 'S-NEW'); v.line(k * 81, -150, k * 230, -150, 'S-NEW'); v.circ(k * 200, -60, 11, 'S-BOLT'); }); v.circ(0, -220, 11, 'S-BOLT');
      v.dim(-200, 120, 200, 120, 0, 'TO SUIT', { sub: 'PILE DIAMETER' }); v.dim(-75, -360, 0, -360, 0, '='); v.dim(0, -360, 75, -360, 0, '='); v.dim(340, -300, 340, -250, 0, '50', { sub: '(TYP.)' });
      v.leader(250, 20, 16, 12, '150x20FLx600 LONG\nSEATING PLATE'); v.leader(200, -60, 18, 4, 'φ22 HOLE TO SUIT\nφ20 THREADED ROD\n(TYP.)'); v.leader(-150, -200, -18, -8, '12 THICK BACK\nPLATE'); v.leader(140, -300, 14, -12, '130x20FLx300 LONG\nBEARING PLATE'); v.weld(81, -150, 24, -14, { size: '6', all: true, tail: 'TYP.' });
      capUnder(v, null, 'BEARING PLATE DETAIL', 10);
    }
    LY.block(B => { const y = B.table(0, 0, [{ n: 'PILE TYPE', w: 22 }, { n: 'PILE DIAMETER\n(mm)', w: 30 }, { n: 'MIN. BEARING REQUIRED\n(mm)', w: 46 }, { n: "HALFCAP SEATING\n'A' (mm)", w: 38 }], BRG_ROWS.map(r => r.map(String)), 1.8); B.title(68, y - 8, 'PILE BEARING TABLE'); B.mainTitle(68, y - 20, 'HALF-CAP TO PILE BEARING DETAILS'); });
    LY.notes([GN, 'RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED HALF-CAP REPAIRS. NEW PILE BANDS AS PER DRG N° 9530-0072.', 'REPAIR SUITABLE AT ABUTMENT PILES AND PIER PILES THAT REQUIRE REPAIR ON A SINGLE FACE ONLY.', 'REPAIR SUITABLE AT PIER PILES THAT REQUIRE REPAIR AT BOTH FACES OF PILE ONLY.'], 140);
    return reorigin(LY.done(), 0, 0.5);
  }, 'Restores the minimum pile – half-cap bearing (70 for piles > φ340, 90 for ≤ φ340): Types 1 – 2 notched seat, Type 3 PFC bracket (pier), Type 4 welded bracket, Type 5 bearing plate, with the pile bearing table (after MRWA 1330-0022).');
  // ---------------------------------------------------------------- 1330-0023 STRINGER REPLACEMENT - BOTTOM FLANGE CONNECTION DETAILS
  const SHIMTXT = (s, ab) => s + ' LONG STEEL SHIMS, USED TO PACK STEEL STRINGER TIGHT AGAINST EXISTING DECKING. TACK WELD STEEL SHIMS TO STRINGER AFTER PLACEMENT' + (ab === null ? '.' : ' AS SHOWN IN ' + (ab ? 'ABUTMENT' : 'PIER') + ' MODIFIED FLANGE DETAIL' + (ab ? 'S.' : '.'));
  const wrapT = (t, n) => { const out = []; let c = ''; t.split(' ').forEach(w => { if ((c + ' ' + w).length > n && c) { out.push(c); c = w; } else c = c ? c + ' ' + w : w; }); out.push(c); return out.join('\n'); };
  // UB stringer seen side-on, bottom flange at y = yb, from x0..x1, with a Z break at x1
  function ubSide(v, x0, x1, yb, s) { v.pl([[x1, yb], [x0, yb], [x0, yb + s.d], [x1, yb + s.d]], false, 'S-NEW'); v.line(x0, yb + s.tf, x1, yb + s.tf, 'S-NEW'); v.line(x0, yb + s.d - s.tf, x1, yb + s.d - s.tf, 'S-NEW'); zz(v, x1, yb, yb + s.d, 'S-NEW'); }
  // abutment end: sheeting face at x = 0 (stringer to +x), half-cap top at y = 0; t3 = angle cleat (Type 3) else modified flange (Type 1)
  function abBF(v, s, t3) {
    const hw = 200, xc = 60, yb = t3 ? 60 : 50; v.line(-75, -650, -75, yb + s.d + 40, 'S-EXIST'); v.line(0, -650, 0, -10, 'S-EXIST'); v.hatch([[-140, -350], [-75, -350], [-75, -60], [-140, -60]], 'earth', 'S-HATCH', 0.8);
    v.pl([[0, yb], [0, yb + s.d + 40]], false, 'S-EXIST'); shim(v, 0, yb, 25, s.d);
    tbx(v, xc, -hw, hw, hw); v.line(-75, 0, xc, 0, 'S-EXIST'); v.line(xc + hw / 2 - D0 / 2, -hw, xc + hw / 2 - D0 / 2, -650, 'S-EXIST'); v.line(xc + hw / 2 + D0 / 2, -hw, xc + hw / 2 + D0 / 2, -650, 'S-EXIST'); v.pileEnd(xc + hw / 2, -650, D0, 'S-EXIST');
    v.line(-75 - 30, -hw / 2, xc + hw + 30, -hw / 2, 'S-BOLT'); v.nut(-75, -hw / 2, -1, 0, 20); v.nut(xc + hw, -hw / 2, 1, 0, 20);
    ubSide(v, 25, 1050, yb, s); v.cl(xc + hw / 2, -720, xc + hw / 2, yb + s.d + 120, 'PILE');
    if (t3) { shim(v, xc + 30, 0, 350, yb - 10 - 0); v.pl([[xc + 30, yb - 10], [xc + 30 + 350, yb - 10]], false, 'S-NEW'); v.rect(xc + 250, yb - 10 - 150, 10, 150, 'S-NEW'); v.rect(xc + 250, yb - 10, 150, 10, 'S-NEW'); v.bolt(xc + 300, yb + s.tf, xc + 300, yb - 10, 20); v.dim(25, yb + s.d - 60, xc + 30 + 350, yb + s.d - 60, 0, '350'); v.dim(xc + 300 - 50, yb + s.d - 140, xc + 300, yb + s.d - 140, 0, '50'); v.dim(xc + 400 + 120, yb - 10, xc + 400 + 120, yb + 40, 0, '50'); }
    else { shim(v, xc + 40, 0, 130, yb); v.rect(xc + 300, yb - 16, 700, 16, 'S-NEW'); v.line(xc + 170, yb, xc + 300, yb, 'S-NEW'); v.bolt(xc + 230, yb + s.tf, xc + 230, -hw, 20); v.dim(xc + 230, yb + s.d + 40, xc + 300 - 20, yb + s.d + 40, 0, '50'); v.dim(xc + 170, yb + 60, xc + 230 - 10, yb + 60, 0, '50'); v.dim(1100, yb - 16, 1100, yb + 34, 0, '50', { sub: 'MIN.' }); v.dim(1250, yb, 1250, yb + 300, 0, '300 MIN.', { sub: 'REFER NOTE 5' }); }
    return { xc, hw, yb };
  }
  const D0 = 330;
  def('sbf', 'Stringers', 'Stringer replacement – bottom flange connections (abutment & pier)', '1330-0023', [P('ub', 'Proposed stringer', '410UB54', { opts: UBs })], (p) => {
    const LY = new Lay(800), s = SEC[p.ub] || SEC['410UB54'], nm = secName(p.ub);
    const secAC = (t3, ch) => { // sectional elevation A / C: stringer end-on on the half-cap with angle cleats
      const v = LY.view(20); tbx(v, -100, -200, 200, 200); iSec(v, 0, 60 + s.d / 2, s, 0); shim(v, -100, 0, 200, 50);
      if (t3) { [-1, 1].forEach(k => { aSec(v, k * 5, 50, 150, 150, 10, k, -1); v.boltEnd(k * 45, 55, 20); }); v.rect(-100, -350 + 150, 200, 150, 'S-EXIST'); } else { v.rect(-100, 50, 200, 10, 'S-NEW'); }
      [-1, 1].forEach(k => v.line(k * 45, 60 + s.tf, k * 45, 0, 'S-BOLT')); v.line(-200, -100, 200, -100, 'S-EXIST'); zz(v, -200, -100, -200); zz(v, 200, -100, -200);
      v.dim(0, -330, 45, -330, 0, '45', { sub: '(TYP.)' }); v.dim(-50, -420, 50, -420, 0, '100', { sub: '(TYP.)' }); v.dim(-260, -50, -260, 0, 0, '50'); v.cl(0, -460, 0, 60 + s.d + 80, 'STRINGER');
      v.leader(100, 60 + s.d - 40, 16, 6, 'STEEL SHIMS FIXED\nTO TIMBER SHEETING\nWITH 4 N° Ø3.2\nCLOUT HEAD NAILS.'); v.leader(30, 60 + s.d / 2, 16, -8, 'PROPOSED STEEL\nSTRINGER'); v.leader(45, 30, 18, -14, 'M20 BOLT IN\nφ22 HOLE (TYP.)'); if (t3) v.leader(60, -10, 18, -24, '150x10 EA\nx300 LONG');
      capUnder(v, 'SECTIONAL ELEVATION ' + ch, null);
    };
    // ABUTMENT TYPE 3
    let v = LY.view(20), r = abBF(v, s, true); v.mark(xcm(r) + 130, r.yb + s.d + 230, 'A', 180);
    v.leader(-75, r.yb + s.d, -18, 10, 'SOUND TIMBER SHEETING\nBEHIND SHIMS'); v.leader(0, r.yb + s.d / 2, -22, 4, '250x(6,8,10 OR 12FL)xLENGTH\nTO SUIT STEEL SHIMS. ENSURE\nTIGHT FIT BETWEEN STEEL\nSTRINGER AND EXISTING TIMBER\nSHEETING.');
    v.leader(-75, -60, -16, 0, 'EXISTING TIMBER ABUTMENT\nSHEETING'); v.leader(-60, -r.hw / 2, -18, -10, 'φ20 THREADED ROD WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP.)'); v.leader(r.xc + r.hw / 2 - 40, -400, -16, -12, 'EXISTING TIMBER\nPILE', { dot: true });
    v.leader(r.xc + 60, 20, 30, -14, wrapT(SHIMTXT('300x(6,8,10 OR 12FL)x350', null), 40)); v.leader(r.xc + r.hw / 2, -r.hw, 16, -36, 'EXISTING TIMBER\nHALF-CAP / FULL-CAP');
    capUnder(v, 'ELEVATION', 'ABUTMENT BOTTOM FLANGE CONNECTION DETAIL - TYPE 3', 20);
    secAC(true, 'A');
    // PIER TYPE 2A (steel corbel)
    v = LY.view(20); { const c = SEC['310UC97']; v.pl([[-450, 0], [450, 0], [450, -c.d], [-450, -c.d]], true, 'S-NEW'); v.line(-450, -c.tf, 450, -c.tf, 'S-NEW'); v.line(-450, -c.d + c.tf, 450, -c.d + c.tf, 'S-NEW'); zz(v, -450, -c.d, 0, 'S-NEW'); zz(v, 450, -c.d, 0, 'S-NEW'); v.rect(-5, -c.d + c.tf, 10, c.d - 2 * c.tf, 'S-NEW'); }
    v.rect(-500, 0, 490, 16, 'S-NEW'); ubSide(v, -10, -1100, 16, s); v.line(-10, 16, -10, 16 + s.d, 'S-NEW');
    v.rect(10, 0, 500, 16, 'S-EXIST'); v.line(10, 16, 510, 16, 'S-EXIST'); v.rect(10, 16, 500, 280, 'S-EXIST'); zz(v, 510, 16, 296); [-450, -60, 60, 450].forEach(x => v.bolt(x, 16 + s.tf, x, -SEC['310UC97'].tf, 20));
    v.cl(0, -400, 0, s.d + 200, 'PIER'); v.mark(-150, s.d + 200, 'B', 0);
    v.dim(0, s.d + 120, 10, s.d + 120, 0, '10'); v.dim(-500, -60, -450, -60, 0, '50', { sub: '(TYP.)' }); v.dim(450, s.d + 60, 500, s.d + 60, 0, '50', { sub: '(TYP.)' }); v.dim(-1150, 0, -1150, 16 + s.d, 0, '300 MIN', { sub: 'REFER NOTE 5' });
    v.leader(-250, 8, -14, 22, 'MODIFIED FLANGE\nREFER DETAIL'); v.leader(400, 200, 16, 8, 'EXISTING\nSTRINGER'); v.leader(300, -200, 14, -12, 'STEEL CORBEL', { dot: true }); v.weld(-700, 16 + s.tf, -18, -18, { size: '6', both: true, all: true, tail: 'BOTH SIDES OF WEB (TYP.)' });
    capUnder(v, 'ELEVATION', 'PIER BOTTOM FLANGE CONNECTION DETAIL - TYPE 2A', 20);
    // SECTION B
    v = LY.view(20); iSec(v, 0, -SEC['310UC97'].d / 2, SEC['310UC97'], 0); v.rect(-100, 0, 200, 16, 'S-NEW'); iSec(v, 0, 16 + s.d / 2, s, 0); [-45, 45].forEach(x => v.bolt(x, 16 + s.tf, x, -SEC['310UC97'].tf, 20)); zh(v, -SEC['310UC97'].d, -180, 180);
    v.dim(0, -400, 45, -400, 0, '45', { sub: '(TYP.)' }); v.cl(0, -440, 0, 16 + s.d + 100, 'STRINGER'); v.leader(0, 16 + s.d, 16, 10, 'PROPOSED STEEL\nSTRINGER'); v.leader(-45, 20, -16, 6, 'M20 BOLT IN\nφ22 HOLE (TYP.)');
    capUnder(v, 'SECTIONAL ELEVATION B', null);
    LY.break();
    // ABUTMENT TYPE 1
    v = LY.view(20); r = abBF(v, s, false); v.mark(xcm(r) + 150, r.yb + s.d + 230, 'C', 180);
    v.leader(0, r.yb + s.d + 20, -18, 12, '250x(6,8,10,12 OR 25 FL)xLENGTH\nTO SUIT STEEL SHIMS. ENSURE\nTIGHT FIT BETWEEN STEEL\nSTRINGER AND EXISTING TIMBER\nSHEETING.'); v.leader(-75, r.yb + 100, -18, -4, 'SOUND TIMBER SHEETING\nBEHIND SHIMS');
    v.leader(-75, -60, -16, -4, 'EXISTING TIMBER ABUTMENT\nSHEETING'); v.leader(-60, -r.hw / 2, -18, -14, 'φ20 THREADED ROD WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP.)'); v.leader(r.xc + r.hw / 2 - 40, -400, -16, -12, 'EXISTING TIMBER\nPILE', { dot: true });
    v.leader(r.xc + 100, 20, 30, -14, wrapT(SHIMTXT('200x(6,8,10,12,16,20 OR 25FL)x300', true), 44)); v.leader(r.xc + r.hw / 2, -r.hw, 16, -40, 'EXISTING TIMBER\nHALF-CAP / FULL-CAP');
    v.leader(r.xc + 500, r.yb - 8, 14, 22, 'MODIFIED FLANGE\nREFER DETAILS'); v.weld(r.xc + 330, r.yb + s.tf, 4, 26, { size: '6', both: true, all: true, tail: 'BOTH SIDES OF WEB' });
    capUnder(v, 'ELEVATION', 'ABUTMENT BOTTOM FLANGE CONNECTION DETAIL - TYPE 1', 20);
    secAC(true, 'C');
    // PIER TYPE 1 (timber corbel)
    v = LY.view(20); { const Dl = 330, yc = -Dl; v.line(-1100, 16, -20, 16, 'S-EXIST'); v.line(-1100, 16 + Dl, 0, 16 + Dl, 'S-EXIST'); v.pileEnd(-1100, 16 + Dl / 2, Dl, 'S-EXIST', 1);
      v.pl([[-700, 0], [500, 0]], false, 'S-EXIST'); v.pl([[-650, -300], [450, -300]], false, 'S-EXIST'); v.arc(-650, -150, 150, 90, 270, 'S-EXIST'); v.arc(450, -150, 150, 270, 450, 'S-EXIST');
      tbx(v, -200, -300 - 200, 180, 200); tbx(v, 20, -300 - 200, 180, 200); v.line(-200, -500, -200, -700, 'S-EXIST'); v.line(200, -500, 200, -700, 'S-EXIST'); v.pileEnd(0, -700, 400, 'S-EXIST'); }
    shim(v, 10, 0, 130, 16); shim(v, 300, 0, 130, 16); v.rect(440, 0, 600, 16, 'S-NEW'); v.line(140, 16, 300, 16, 'S-NEW'); ubSide(v, 10, 1100, 16, s); v.line(10, 16, 10, 16 + s.d, 'S-NEW');
    v.bolt(220, 16 + s.tf, 220, -300, 20); v.cl(0, -760, 0, 16 + s.d + 200, 'PIER'); v.mark(150, 16 + s.d + 220, 'D', 180);
    v.dim(0, 16 + s.d + 120, 10, 16 + s.d + 120, 0, '10'); v.dim(390, 16 + s.d - 40, 440, 16 + s.d - 40, 0, '50'); v.dim(1150, 0, 1150, 50, 0, '50', { sub: 'MIN.' }); v.dim(1300, 16, 1300, 316, 0, '300 MIN.', { sub: 'REFER NOTE 5' });
    v.leader(-700, 200, -14, -10, 'EXISTING\nTIMBER\nSTRINGER', { dot: true }); v.leader(-400, -150, -14, -12, 'EXISTING TIMBER\nCORBEL', { dot: true }); v.leader(-110, -400, -16, -10, 'EXISTING TIMBER\nHALF-CAP (TYP.)', { dot: true });
    v.leader(80, 8, 30, -28, wrapT(SHIMTXT('200x(6,8,10,12,16,20 OR 25FL)x300', false), 36)); v.leader(600, 8, 12, 24, 'MODIFIED FLANGE\nDETAIL'); v.weld(470, 16 + s.tf, 0, 30, { size: '6', both: true, all: true, tail: 'BOTH SIDES OF WEB' });
    capUnder(v, 'ELEVATION', 'PIER BOTTOM FLANGE CONNECTION DETAIL - TYPE 1', 20);
    // SECTION D
    v = LY.view(20); v.circ(0, -165, 165, 'S-EXIST'); v.line(-260, -330, 260, -330, 'S-EXIST'); v.line(-260, -500, 260, -500, 'S-EXIST'); zz(v, -260, -330, -500); zz(v, 260, -330, -500); v.rect(-100, 0, 200, 16, 'S-NEW'); iSec(v, 0, 16 + s.d / 2, s, 0);
    [-1, 1].forEach(k => { v.rect(k * 50 - 37, 16 + s.tf, 75, 8, 'S-NEW'); v.line(k * 50 - 10, 16 + s.tf + 40, k * 50 - 10, -360, 'S-BOLT'); v.line(k * 50 + 10, 16 + s.tf + 40, k * 50 + 10, -360, 'S-BOLT'); }); v.rect(-150, -340, 300, 10, 'S-NEW');
    v.dim(-50, -560, 50, -560, 0, '100'); v.cl(0, -600, 0, 16 + s.d + 100, 'STRINGER');
    v.leader(0, 16 + s.d, 14, 12, 'PROPOSED STEEL\nSTRINGER'); v.leader(50, 16 + s.tf + 8, 18, 6, '75x8FLx100 LONG\nWASHER WITH\nφ22 HOLE TO SUIT\nTHREADED ROD\n(TYP. BOTH SIDES)'); v.leader(100, 8, 18, -10, 'MODIFIED\nFLANGE'); v.leader(150, -335, 16, -6, '100x10FLx300\nWASHER'); v.leader(60, -300, 16, -18, 'φ20 THREADED\nROD (TYP.)');
    capUnder(v, 'SECTIONAL ELEVATION D', null);
    LY.break();
    // MODIFIED FLANGE DETAILS (1:10)
    v = LY.view(10); v.rect(0, -100, 520, 200, 'S-NEW'); v.rect(170, -150, 150, 300, 'S-HIDDEN'); v.rect(320, -(s.tw + 2) / 2, 200, s.tw + 2, 'S-NEW'); v.weld(250, -150, 40, -16, { size: '6', len: '', tail: '30 LONG (TYP.)' });
    v.dim(0, 220, 520, 220, 0, 'REFER NOTE 5'); v.dim(220, 150, 320, 150, 0, '50'); v.dim(320, 150, 520, 150, 0, '300'); v.dim(-80, -150, -80, 150, 0, '300'); v.dim(-30, -100, -30, 100, 0, '200'); v.dim(170, -200, 320, -200, 0, '200');
    v.leader(400, 100, 12, 14, '16FL'); v.leader(170, -130, -16, -14, 'STEEL PACKER'); v.leader(520, 0, 14, 22, 'SLOT WIDTH TO BE EQUAL TO\nPROPOSED STEEL STRINGER\nWEB THICKNESS +2mm');
    capUnder(v, null, 'ABUTMENT MODIFIED FLANGE DETAIL', 10, 'STRINGER REPLACEMENT ON TIMBER HALF-CAP');
    v = LY.view(10); v.rect(0, -100, 1100, 200, 'S-NEW'); [0, 600].forEach(x => v.rect(x, -150, 200, 300, 'S-HIDDEN')); v.rect(800, -(s.tw + 2) / 2, 300, s.tw + 2, 'S-NEW'); [-30, 30].forEach(y => { v.circ(365, y, 11, 'S-BOLT'); v.rect(345, y - 11, 40, 22, 'S-BOLT'); });
    v.dim(0, 220, 1100, 220, 0, 'REFER NOTE 5'); v.dim(0, 150, 365, 150, 0, '365'); v.dim(700, 150, 800, 150, 0, '100'); v.dim(800, 150, 1100, 150, 0, '300'); v.dim(-80, -150, -80, 150, 0, '300', { sub: '(TYP.)' }); v.dim(-30, -100, -30, 100, 0, '200'); v.dim(0, -200, 200, -200, 0, '200', { sub: '(TYP.)' }); v.dim(300, -30, 300, 30, 0, '40', { sub: '(TYP.)' });
    v.leader(0, 150, -12, 8, 'STEEL PACKER\n(TYP.)'); v.leader(450, 100, 10, 14, '16 FL'); v.leader(365, -30, 12, -18, 'φ22x40 LONG\nSLOTTED HOLE (TYP.)'); v.leader(1100, 0, 14, 22, 'SLOT WIDTH TO BE EQUAL TO\nPROPOSED STEEL STRINGER\nWEB THICKNESS +2mm'); v.weld(700, -150, 30, -10, { size: '6', tail: '30 LONG (TYP.)' });
    capUnder(v, null, 'PIER MODIFIED FLANGE DETAIL', 10, 'STRINGER REPLACEMENT ON TIMBER CORBEL');
    v = LY.view(10); v.rect(0, -100, 840, 200, 'S-NEW'); v.rect(0, -(s.tw + 2) / 2, 400, s.tw + 2, 'S-NEW'); [400, 790].forEach(x => [-45, 45].forEach(y => v.boltEnd(x, y, 22)));
    v.dim(0, -180, 400, -180, 0, '400'); v.dim(400, -180, 790, -180, 0, '390'); v.dim(300, -240, 840, -240, 0, '540'); v.dim(0, -300, 840, -300, 0, '840'); v.dim(790, 160, 840, 160, 0, '50'); v.dim(900, 45, 900, 100, 0, '55', { sub: '(TYP.)' }); v.dim(960, -100, 960, 100, 0, '200');
    v.leader(400, 45, -16, 18, 'φ22 HOLE\n(TYP)'); v.leader(500, 100, 10, 14, '200x16FL');
    capUnder(v, null, 'PIER MODIFIED FLANGE DETAIL', 10, 'STRINGER REPLACEMENT ON STEEL CORBEL');
    LY.notes([GN, 'GAP BETWEEN STRINGER AND DECK SHALL BE SUITABLY PACKED. REFER TO STEEL STRINGER PACKING DETAIL DRG N° 1330-0025.', 'DIMENSION SHALL BE SITE MEASURED PRIOR TO FABRICATION & CONSTRUCTION'], 150);
    return LY.done();
  }, 'Steel stringer (' + 'UB) replacing a timber stringer: bottom flange connections at abutments (Types 1 / 3) and piers (Types 1 / 2A) with the modified flange details (after MRWA 1330-0023).');
  const xcm = r => r.xc + r.hw / 2;
  // ---------------------------------------------------------------- 1330-0024 STRINGER REPLACEMENT/INSTALLATION - TOP FLANGE CONNECTION DETAILS
  // plan of deck planks across a stringer (1:20): planks along y, stringer along x on y = 0
  function plankPlan(v, n, pw, half, s, o) {
    o = o || {}; const L = n * pw, W = 450; for (let i = 0; i <= n; i++) { const x = i * pw; if (o.form && !half) continue; v.line(x, o.form ? -W : -W, x, o.form ? 0 : W, 'S-EXIST'); if (!half) { } }
    if (o.ribs) for (let x = 0; x <= L; x += 50) v.line(x, 0, x, W, 'S-TEXT'), v.line(x, 0, x, -W, 'S-EXIST');
    if (!o.ribs && o.form !== true) { v.line(0, -W, L, -W, 'S-EXIST'); v.line(0, W, L, W, 'S-EXIST'); }
    v.line(0, -s.b / 2, L, -s.b / 2, 'S-HIDDEN'); v.line(0, s.b / 2, L, s.b / 2, 'S-HIDDEN'); zz(v, L * 0.55, -W, W); v.line(-400, 0, L + 80, 0, 'S-CL'); { const q = v.P(-400, 0); v.add({ t: 'text', p: [q[0] - 1, q[1] - 1], s: '℄ STRINGER', h: TH, al: 'r', v: 'b', ang: 0, L: 'S-TEXT' }); }
    return { L, W };
  }
  function secTF(v, s, kind) { // sectional elevation (1:10) on the stringer centre line, deck soffit at y = 0
    const top = kind === 'A' ? 225 : kind === 'B' ? 200 : 200; iSec(v, 0, -s.d / 2, s, 0); v.cl(0, -s.d - 40, 0, top + 120, 'STRINGER');
    const deck = (x0, x1) => { v.line(x0, 0, x1, 0, 'S-EXIST'); v.line(x0, 100, x1, 100, 'S-EXIST'); zz(v, x0, 0, 100); zz(v, x1, 0, 100); };
    const ovl = (x0, x1, y0, y1, L) => { v.line(x0, y0, x1, y0, L || 'S-EXIST'); v.line(x0, y1, x1, y1, L || 'S-EXIST'); zz(v, x0, y0, y1); zz(v, x1, y0, y1); v.hatch([[x0 + 60, y0 + 5], [x0 + 160, y0 + 5], [x0 + 160, y1 - 5], [x0 + 60, y1 - 5]], 'conc', 'S-HATCH', 0.6); v.hatch([[x1 - 160, y0 + 5], [x1 - 60, y0 + 5], [x1 - 60, y1 - 5], [x1 - 160, y1 - 5]], 'conc', 'S-HATCH', 0.6); };
    if (kind === 'A') { deck(-420, 420); ovl(-420, 420, 100, 225); [-45, 45].forEach(x => { v.line(x - 10, -s.tf, x - 10, 90, 'S-BOLT'); v.line(x + 10, -s.tf, x + 10, 90, 'S-BOLT'); v.pl([[x - 10, 90], [x, 115], [x + 10, 90]], false, 'S-BOLT'); v.rect(x - 16, -s.tf - 16, 32, 16, 'S-BOLT'); }); }
    if (kind === 'B' || kind === 'D') { if (kind === 'D') deck(-420, 420); else { v.line(-420, 0, 420, 0, 'S-EXIST'); } ovl(-420, 420, kind === 'D' ? 100 : 0, kind === 'D' ? 225 : 150); [-45, 45].forEach(x => { v.line(x - 10, -s.tf - 20, x - 10, 90 + (kind === 'D' ? 0 : 0), 'S-BOLT'); v.line(x + 10, -s.tf - 20, x + 10, 90, 'S-BOLT'); v.rect(x - 16, -s.tf - 16, 32, 16, 'S-BOLT'); }); v.dim(330, 0, 330, 90, 0, ''); }
    if (kind === 'C') { v.line(-420, 0, 0, 0, 'S-EXIST'); v.line(-420, 100, 0, 100, 'S-EXIST'); zz(v, -420, 0, 100); v.line(-420, 120, 420, 120, 'S-NEW'); v.line(-420, 250, 420, 250, 'S-NEW'); zz(v, -420, 120, 250, 'S-NEW'); zz(v, 420, 0, 250, 'S-NEW'); v.line(0, 0, 420, 0, 'S-NEW'); v.line(0, 70, 420, 70, 'S-HIDDEN'); v.line(-420, 180, 420, 180, 'S-HIDDEN');
      v.hatch([[130, 140], [230, 140], [230, 230], [130, 230]], 'conc', 'S-HATCH', 0.6); v.bolt(-45, -s.tf, -45, 120, 20); v.line(45 - 8, -s.tf - 20, 45 - 8, 80, 'S-BOLT'); v.line(45 + 8, -s.tf - 20, 45 + 8, 80, 'S-BOLT'); }
    v.dim(-45, top + 40, 0, top + 40, 0, '45'); v.dim(0, top + 40, 45, top + 40, 0, '45');
  }
  def('stf', 'Stringers', 'Stringer replacement / installation – top flange connections (Types A – D)', '1330-0024', [P('ub', 'Proposed stringer', '410UB54', { opts: UBs }), P('np', 'Deck planks shown', 9, { num: 1 })], (p) => {
    const LY = new Lay(800), s = SEC[p.ub] || SEC['410UB54'], n = max(5, min(16, +p.np || 9)), pw = 160;
    // TYPE A
    let v = LY.view(20), r = plankPlan(v, n, pw, false, s); for (let i = 1; i < n; i += 3) v.boltEnd(i * pw + pw / 2, i % 2 ? 45 : -45, 22);
    v.dim(pw * 1 + pw / 2, r.W + 60, pw * 4 + pw / 2, r.W + 60, 0, 'EVERY THIRD DECK PLANK', { sub: '(TYP.)' }); v.dim(pw * 4, -r.W - 60, pw * 4 + pw / 2, -r.W - 60, 0, '='); v.dim(pw * 4 + pw / 2, -r.W - 60, pw * 5, -r.W - 60, 0, '='); v.mark(pw * 4 + pw / 2, r.W + 300, 'A', 180);
    v.leader(80, 300, -14, 16, 'EXISTING TIMBER\nDECK', { dot: true }); v.leader(0, -s.b / 2, -14, -16, 'PROPOSED STEEL\nSTRINGER'); v.leader(pw * 7 + pw / 2, -45, 18, -18, 'φ22 HOLE TO SUIT\nφ20x130 LONG COACH\nSCREW');
    capUnder(v, null, 'TOP FLANGE CONNECTION DETAIL - TYPE A', 20);
    v = LY.view(10); secTF(v, s, 'A'); v.leader(-200, 160, -16, 14, 'EXISTING CONCRETE\nOVERLAY', { dot: true }); v.leader(250, 50, 16, -12, 'EXISTING TIMBER\nDECK', { dot: true }); v.leader(45, -s.d + 4, 18, -6, 'φ22 HOLE (TYP.)'); capUnder(v, 'SECTIONAL ELEVATION A', null);
    // TYPE B
    v = LY.view(20); r = plankPlan(v, n, pw, false, s); for (let i = 0; i * 400 < n * pw - 50; i++) v.boltEnd(150 + i * 400, i % 2 ? 45 : -45, 22);
    v.dim(150, r.W + 60, 950, r.W + 60, 0, '1000 NOM.'); v.dim(950, r.W + 60, 1350, r.W + 60, 0, '400 CRS. MAX.', { sub: '(TYP.)' }); v.mark(1350, r.W + 300, 'B', 180);
    v.leader(300, 0, -16, -16, 'PROPOSED STEEL\nSTRINGER', { dot: true }); v.leader(950, 45, 16, 26, 'φ22 HOLE TO SUIT\nM20 CONCRETE ANCHOR'); v.leader(n * pw - 60, -300, 12, -14, 'EXISTING PERMANENT\nFORMWORK / CONCRETE\nDECK SOFFIT');
    capUnder(v, null, 'TOP FLANGE CONNECTION DETAIL - TYPE B', 20);
    v = LY.view(10); secTF(v, s, 'B'); v.leader(-200, 100, -16, 14, 'EXISTING CONCRETE\nOVERLAY', { dot: true }); v.leader(330, 90, 12, 14, '80 MIN.\nREFER NOTE 5.', { noArrow: true }); v.leader(-45, -s.tf - 10, -18, -10, 'M20 CONCRETE ANCHOR RAMSET\nTRUBOLT OR SIMILAR APPROVED.\nLOCK NUT TO THREAD USING\nLOCTITE 248 OR SIMILAR\nAPPROVED.'); v.leader(300, 0, 14, -10, 'EXISTING PERMANENT\nFORMWORK / CONCRETE\nDECK SOFFIT'); v.leader(45, -s.d + 4, 18, -6, 'φ22 HOLE (TYP.)');
    capUnder(v, 'SECTIONAL ELEVATION B', null);
    LY.break();
    // TYPE C1 / C2 (half formwork, half timber deck)
    ['C1', 'C2'].forEach(t => {
      const v = LY.view(20), L = n * pw, W = 450; for (let x = 0; x <= L; x += 50) v.line(x, s.b / 2, x, W, 'S-NEW'); v.line(0, W, L, W, 'S-NEW');
      for (let i = 0; i <= n; i++) v.line(i * pw, -W, i * pw, -s.b / 2, 'S-EXIST'); v.line(0, -W, L, -W, 'S-EXIST'); v.line(0, -s.b / 2, L, -s.b / 2, 'S-NEW'); v.line(0, s.b / 2, L, s.b / 2, 'S-NEW'); zz(v, L * 0.55, -W, W); v.line(-300, 0, L + 80, 0, 'S-CL'); { const q = v.P(-300, 0); v.add({ t: 'text', p: [q[0] - 1, q[1] - 1], s: '℄ STRINGER', h: TH, al: 'r', v: 'b', ang: 0, L: 'S-TEXT' }); }
      for (let x = 150; x < L; x += 400) v.boltEnd(x, 45, 18); for (let i = 1; i < n; i += 3) { v.boltEnd(i * pw + pw / 2, -45, 22); if (t === 'C1') v.rect(i * pw + pw / 2 - 32, -45 - 32, 65, 65, 'S-BOLT'); } if (t === 'C2') v.rect(0, -45 - 32, L, 65, 'S-NEW');
      v.dim(150, W + 60, 950, W + 60, 0, '1000 NOM.'); v.dim(950, W + 60, 1350, W + 60, 0, '400 CRS MAX.', { sub: '(TYP.)' }); v.dim(pw / 2, -W - 60, pw * 1.5, -W - 60, 0, 'EVERY THIRD DECK', { sub: 'PLANK (TYP.)' }); v.mark(1350, W + 300, 'C', 180);
      v.leader(350, 45, -18, 34, '2 N°. 12mm BUILDEX WAFER\nHEAD TAPTITE SCREWSx25mm\nLONG OR SIMILAR APPROVED\nAT 400 CRS MAX. IN\nPRE-DRILLED φ12 HOLES'); v.leader(0, s.b / 2, -14, 4, 'PROPOSED STEEL\nSTRINGER');
      v.leader(L - 100, 300, 12, 14, 'PROPOSED PERMANENT\nFORMWORK OR SIMILAR\nAPPROVED', { dot: true }); v.leader(1350, 45, 22, 4, 'φ18 HOLES AT 400 CRS MAX.\nTO SUIT ANCHOR BOLT -\nM16x150 LONG BOLT WITH 30\nO.D. x 3 THICK WASHER AND\nNUT (TYP.)');
      v.leader(pw * 4 + pw / 2, -45, 18, -18, 'φ22 HOLES TO SUIT\nφ20 THREADED ROD\nEVERY THIRD DECK PLANK'); v.leader(L - 80, -300, 12, -24, 'EXISTING TIMBER DECK', { dot: true }); v.leader(pw + pw / 2, t === 'C1' ? -77 : -60, -18, -10, t === 'C1' ? '65x5FLx65 WASHER' : '65x5FL FULL LENGTH\nOF PROPOSED STEEL\nSTRINGER');
      if (t === 'C1') { // elevation of planks (washer arrangement)
        capUnder(v, 'PLAN', null);
        const e = LY.view(20); e.line(0, 0, L, 0, 'S-NEW'); e.line(0, -s.d * 0.3, L, -s.d * 0.3, 'S-NEW'); zz(e, L, -s.d * 0.3, 0, 'S-NEW'); for (let i = 0; i < n; i++) tbx(e, i * pw + 2, 0, pw - 4, 100); for (let i = 1; i < n; i += 3) e.bolt(i * pw + pw / 2, -10, i * pw + pw / 2, 100, 20);
        for (let i = 0; i < n; i++) if ((i - 1) % 3) e.spike(i * pw + pw / 2 + 40, 100, i * pw + pw / 2 - 60, 20, 'S-BOLT'); callout(e, 4 * pw + pw / 2, 50, 110, 1, 3.5 * pw, 330);
        e.leader(0, 100, -16, 10, 'EXISTING TIMBER DECK'); e.leader(150, -s.d * 0.3, -16, -8, 'PROPOSED STEEL\nSTRINGER', { dot: true }); e.leader(6 * pw, 80, 20, 20, 'FIX LOOSE PLANKS TO\nADJACENT BOLTED PLANKS\nWITH φ10x200 LONG SPIKE\n(TYP)');
        capUnder(e, 'ELEVATION', 'TOP FLANGE CONNECTION DETAIL - TYPE C1', 20, 'WASHER ARRANGEMENT');
      } else capUnder(v, null, 'TOP FLANGE CONNECTION DETAIL - TYPE C2', 20, 'LONG FLAT ARRANGEMENT');
    });
    v = LY.view(10); secTF(v, s, 'C'); v.leader(-45, 100, -24, 14, 'CENTRE PUNCH BOLT\nTHREAD TO NUT TO\nPREVENT UNDOING OF\nNUT. (TYP.)'); v.leader(10, 300, 6, 22, 'CUT BACK EXISTING TIMBER\nDECKING FOR FULL LENGTH OF\nPROPOSED STEEL STRINGER TO\nTHE ℄ OF PROPOSED STRINGER', { noArrow: true });
    v.leader(330, 200, 14, 2, 'PROPOSED CONCRETE\nOVERLAY', { dot: true }); v.leader(330, 40, 14, -2, 'PROPOSED PERMANENT\nFORMWORK OR SIMILAR\nAPPROVED', { dot: true }); v.leader(-300, 0, -14, -10, 'EXISTING TIMBER\nDECK'); v.leader(-45, -s.tf - 10, -16, -24, '65x5FLx65 WASHER OR\n65x5FL FULL LENGTH\nOF PROPOSED STEEL\nSTRINGER (TYP.)'); v.leader(53, -s.tf - 10, 16, -12, 'ANCHOR BOLT'); v.leader(45, -s.d + 4, 16, -6, 'φ22 HOLE');
    capUnder(v, 'SECTIONAL ELEVATION C', null);
    // DETAIL 1 (1:5)
    v = LY.view(5); v.line(-200, 0, 200, 0, 'S-NEW'); v.line(-200, -12, 200, -12, 'S-NEW'); zz(v, -200, -12, 0, 'S-NEW'); v.line(-200, 110, 200, 110, 'S-TEXT'); v.line(-200, 0, -200, 110, 'S-TEXT'); v.pl([[-200, 1], [-90, 1], [-80, 60], [-60, 60], [-50, 1], [60, 1], [70, 60], [90, 60], [100, 1], [200, 1]], false, 'S-NEW');
    v.line(-200, 80, 200, 80, 'S-REO'); [-150, 30, 150].forEach(x => v.circ(x, 76, 4, 'S-REO')); v.line(-200, 170, 200, 170, 'S-CONC'); zz(v, 200, -12, 170); v.hatch([[-190, 120], [-130, 120], [-130, 160], [-190, 160]], 'conc', 'S-HATCH', 0.4);
    v.line(-8, -60, -8, 90, 'S-BOLT'); v.line(8, -60, 8, 90, 'S-BOLT'); v.nut(0, -12, 0, -1, 16); v.nut(0, 1, 0, 1, 16); v.dim(-240, 0, -240, 110, 0, '110'); v.dim(240, 80, 240, 110, 0, '30', { sub: 'COVER' });
    v.leader(-8, 60, -20, 26, 'ANCHOR BOLT - M16x150 LONG BOLT\nWITH 30 O.D. x 3 THICK WASHER\nEACH SIDE OF STRINGER FLANGE.'); v.leader(100, 80, 10, 22, 'DECK FABRIC'); v.leader(80, 60, 30, 12, '1mm BONDEK\nPERMANENT\nFORMWORK');
    v.leader(-100, -12, -16, -14, 'PROPOSED STRINGER\nFLANGE'); v.leader(10, -6, 20, -18, 'DRILL φ18 HOLE IN STRINGER\nFLANGE AND BONDEK\n(TYP)');
    capUnder(v, 'DETAIL 1', null);
    LY.break();
    // TYPE D
    v = LY.view(20); r = plankPlan(v, n, pw, false, s); for (let i = 0; i * 400 < n * pw - 50; i++) v.boltEnd(150 + i * 400, 45, 22); for (let i = 1; i < n; i += 3) v.boltEnd(i * pw + pw / 2, -45, 22);
    v.dim(150, r.W + 60, 950, r.W + 60, 0, '1000 NOM.'); v.dim(950, r.W + 60, 1350, r.W + 60, 0, '400 CRS. MAX.', { sub: '(TYP.)' }); v.dim(pw / 2, -r.W - 60, pw * 1.5, -r.W - 60, 0, 'EVERY THIRD DECK', { sub: 'PLANK (TYP.)' }); v.mark(n * pw - 100, r.W + 300, 'D', 180);
    v.leader(30, 300, -14, 16, 'EXISTING PERMANENT\nFORMWORK', { dot: true }); v.leader(40, s.b / 2, -14, 6, 'PROPOSED STEEL\nSTRINGER', { dot: true }); v.leader(pw + pw / 2, -45, -20, -16, 'φ22 HOLES TO SUIT\nφ20 x 130 LONG\nCOACH SCREW (TYP.)');
    v.leader(1350, 45, 24, 22, 'φ22 HOLES AT 400 CRS MAX. TO\nSUIT M20 CONCRETE ANCHOR\n(TYP.)'); v.leader(n * pw - 80, -300, 12, -12, 'EXISTING\nTIMBER DECK', { dot: true });
    capUnder(v, null, 'TOP FLANGE CONNECTION DETAIL - TYPE D', 20);
    v = LY.view(10); secTF(v, s, 'D'); v.leader(330, 90, 12, 26, '80 MIN. REFER NOTE 5.', { noArrow: true }); v.leader(250, 160, 16, 12, 'EXISTING CONCRETE\nOVERLAY', { dot: true }); v.leader(250, 100, 16, -4, 'EXISTING PERMANENT\nFORMWORK');
    v.leader(-300, 0, -14, -6, 'EXISTING TIMBER\nDECK'); v.leader(-45, -s.tf - 10, -18, -16, 'φ20 x 130 LONG\nCOACH SCREW'); v.leader(45, -s.tf - 10, 18, -18, 'M20 CONCRETE ANCHOR RAMSET\nTRUBOLT OR SIMILAR APPROVED.\nLOCK NUT TO THREAD\nUSING LOCTITE 248 OR SIMILAR\nAPPROVED (TYP.)'); v.leader(-45, -s.d + 4, -16, -8, 'φ22 HOLE');
    capUnder(v, 'SECTIONAL ELEVATION D', null);
    LY.notes([GN, 'DETAILS SHOWN ARE ONLY APPLICABLE FOR UB STRINGERS 250 UB31.4 OR HEAVIER.', 'GAP BETWEEN STRINGER AND DECK SHALL BE SUITABLY PACKED. REFER TO STEEL STRINGER PACKING DETAIL DRG N° 1330-0025.', 'CONCRETE ANCHORS TO PASS THROUGH FLAT BASE OF BONDEK AND NOT AT RE-ENTRANT RIBS.', 'EMBEDMENT DEPTH TO SUIT PROPOSED ANCHOR AS OUTLINED IN MANUFACTURERS SPECIFICATIONS'], 150);
    return reorigin(LY.done(), 0.5, 0.5);
  }, 'Fixing a replacement / new UB stringer to the deck: coach screws (A, D), concrete anchors (B, D) or threaded rods with washers / long flat under new permanent formwork (C1 / C2) (after MRWA 1330-0024).');
  // ---------------------------------------------------------------- 1330-0025 STRINGER REPLACEMENT - SPLICE JOINT, PACKING & POST CONNECTION DETAILS
  def('ssp', 'Stringers', 'Steel stringer splice joint, packing & post connection', '1330-0025', [P('ub', 'Stringer', '410UB54', { opts: UBs })], (p) => {
    const LY = new Lay(700), s = SEC[p.ub] || SEC['410UB54'], nm = secName(p.ub), H = 530, ep = 25;
    // STRINGER POST CONNECTION - TYPE A (1:10)
    let v = LY.view(10); const pf = { d: 150, b: 75, tf: 9.5, tw: 6 };
    iSec(v, 0, -s.d / 2 * 0.6, { d: s.d * 0.6, b: s.b * 0.6, tf: s.tf, tw: s.tw }, 0);
    const yt = 0; v.line(-350, yt, 900, yt, 'S-EXIST'); v.line(-350, yt + 100, 900, yt + 100, 'S-EXIST'); v.line(-350, yt + 160, 900, yt + 160, 'S-EXIST'); zz(v, -350, yt, yt + 160); zz(v, 900, yt, yt + 160);
    v.rect(s.tw / 2, -200, 10, 160, 'S-NEW'); v.line(s.tw / 2 + 10, -80, 650, -80, 'S-HIDDEN'); v.line(s.tw / 2 + 10, -160, 650, -160, 'S-HIDDEN'); v.line(s.tw / 2 + 10, -120, 650, -120, 'S-CL');
    v.rect(650, -300, pf.b, 500, 'S-NEW'); v.line(650 + pf.tw, -300, 650 + pf.tw, 200, 'S-NEW'); v.boltEnd(700, -100, 22); v.boltEnd(680, -150, 22); v.bolt(s.tw / 2 + 10, -120, -s.tw / 2, -120, 20);
    v.dim(820, -100, 820, -55, 0, '45', { sub: '(TYP.)' }); v.dim(650, -350, 695, -350, 0, '45', { sub: '(TYP.)' }); v.mark(80, -420, 'E', 0);
    v.leader(-150, 130, -16, 14, 'EXISTING PERMANENT\nFORMWORK', { dot: true }); v.leader(-200, 50, -14, -4, 'EXISTING TIMBER\nDECKING', { dot: true }); v.leader(-s.tw / 2, -120, -18, -6, 'φ22 HOLE (SITE DRILL)'); v.leader(-s.b * 0.3, -s.d * 0.6, -14, -10, 'PROPOSED STRINGER\nREPLACEMENT');
    v.leader(350, -120, -2, 38, 'PROPOSED OR EXISTING OUTRIGGER\nSITE MEASURE TO SUIT', { dot: true }); v.leader(560, 130, 16, 10, 'EXISTING\nOVERLAY', { dot: true }); v.leader(690, 0, 14, 8, 'GUARDRAIL POST', { dot: true }); v.leaders([[680, -150], [10, -120]], 10, -22, 'M20 BOLTS\n(TYP.)');
    capUnder(v, null, 'STRINGER POST CONNECTION DETAIL - TYPE A', 10, 'REFER NOTES 9 & 10');
    // SECTION E
    v = LY.view(10); v.rect(0, 0, 250, 200, 'S-NEW'); v.line(0, 25, 250, 25, 'S-HIDDEN'); v.line(0, 175, 250, 175, 'S-HIDDEN'); v.line(-300, 25, 0, 25, 'S-HIDDEN'); v.line(-300, 175, 0, 175, 'S-HIDDEN'); v.line(-300, 100, 0, 100, 'S-CL');
    cSec(v, 125 - 25, 100, pf, 1); [50, 200].forEach(x => v.boltEnd(x, 100, 22)); v.line(125, -60, 125, 260, 'S-CL');
    v.dim(0, 260, 250, 260, 0, '250'); v.dim(0, 220, 50, 220, 0, '50'); v.dim(200, 220, 250, 220, 0, '50'); v.dim(-340, 0, -340, 200, 0, '200'); v.dim(-260, 175, -260, 200, 0, '25'); v.dim(-260, 0, -260, 25, 0, '25'); v.dim(100, -40, 125, -40, 0, '25');
    v.weld(100, 150, 20, 14, { size: '6', all: true }); v.leader(200, 100, 18, 10, 'φ22 HOLE TO SUIT\nM20 BOLTS. RE-DRILL\nEXISTING φ20 HOLE\nTO φ22 IF REQUIRED'); v.leader(250, 60, 18, -4, '10 FL.'); v.leader(175, 0, 16, -14, '150x75x18 PFC.\nLENGTH TO SUIT\nSITE MEASUREMENT');
    capUnder(v, 'SECTION E', null, null, '(PROPOSED DIMENSIONS SHOWN)');
    LY.break();
    // SPLICE JOINT ELEVATION (1:10)
    v = LY.view(10); ubSide(v, -ep, -700, -s.d, s); v.line(-ep, -s.d, -ep, 0, 'S-NEW'); ubSide(v, ep, 500, -s.d, s); v.line(ep, -s.d, ep, 0, 'S-NEW');
    v.rect(-ep, -s.d - (H - s.d) + 55, ep, H, 'S-NEW'); v.rect(0, -s.d - (H - s.d) + 55, ep, H, 'S-NEW');
    const yb0 = -s.d - (H - s.d) + 55; [45, 205, 340, 475].map(y => yb0 + H - y).forEach(y => { v.rect(-ep - 15, y - 13, 2 * ep + 30, 26, 'S-BOLT'); v.fill([[-ep - 15, y - 13], [ep + 15, y - 13], [ep + 15, y - 6], [-ep - 15, y - 6]], 'S-BOLT'); });
    v.dim(-700, 120, -ep, 120, 0, '1200 MAX.'); zz(v, -400, 90, 150, 'S-DIM'); v.weld(-ep, -40, -10, 60, { size: '6', both: true, tail: 'SP (TYP)' }); v.weld(-ep, -s.d + 20, -40, -40, { size: '6', both: true, tail: 'TYP' });
    v.leader(-ep - 15, yb0 + 40, -18, -18, 'SPLICE PLATES WITH\n8 - M24 8.8TF BOLTS'); v.leader(200, -s.d, 14, -24, 'PROPOSED STRINGER\nREFER NOTE 8');
    capUnder(v, 'ELEVATION', 'STEEL STRINGER SPLICE JOINT DETAIL', 10, 'REFER NOTES 2, 3, 4 & 8');
    // SPLICE PLATE DETAIL
    v = LY.view(10); v.rect(-100, 0, 200, H, 'S-NEW'); iSec(v, 0, H - 55 - s.d / 2, s, 0); v.cl(0, -40, 0, H + 120, 'STRINGER'); [45, 205, 340, 475].forEach(y => [-55, 55].forEach(x => v.boltEnd(x, y, 26)));
    v.dim(-100, H + 60, 100, H + 60, 0, '200'); v.dim(-55, H + 20, 55, H + 20, 0, '110'); v.dim(-300, 0, -300, H, 0, '530'); v.dimChain([[-200, 0], [-200, 45], [-200, 205], [-200, 340], [-200, 475], [-200, H]], 0, ['45', '160', '135', '135', '55']);
    v.leader(55, H - 45, 18, 0, 'φ26 HOLE\nTYP'); v.leader(s.tw, H - 200, 18, -6, 'PROPOSED ' + nm.replace(' UB ', '\nUB ').replace('UB', 'UB') + ' STRINGER\nREFER NOTE 8'); v.leader(100, 20, 14, -10, '200 x 25 FL\nSPLICE PLATE');
    capUnder(v, null, 'SPLICE PLATE DETAIL', 10);
    // PACKING DETAIL
    v = LY.view(10); v.line(-200, 0, 200, 0, 'S-EXIST'); v.line(-200, 100, 200, 100, 'S-EXIST'); zz(v, -200, 0, 100); zz(v, 200, 0, 100); shim(v, -s.b / 2, -20, s.b, 20); iSec(v, 0, -20 - s.d / 2, s, 0);
    v.leader(-150, 60, -16, -16, 'EXISTING TIMBER\nDECKING', { dot: true }); v.leader(s.b / 2, -10, 16, -6, 'REFER NOTES 6 & 7'); v.leader(0, -20 - s.d / 2, -24, -10, 'PROPOSED STRINGER\nREPLACEMENT');
    capUnder(v, null, 'STEEL STRINGER PACKING DETAIL', 10, '(ALL DECK PLANKS REQUIRE BEARING ON\nSTRINGER AS SHOWN)');
    LY.notes([GN, 'STRINGER SPLICE TO BE SHOP FABRICATED AND PRE-ASSEMBLED.', 'CONTACT FACES OF SPLICE PLATES TO BE GRIT BLASTED BACK TO BRIGHT STEEL PRIOR TO INSTALLATION.', 'SPLICE JOINT TO BE COLD GALVANISED AFTER STRINGER INSTALLATION.', 'GAP BETWEEN STRINGER AND DECK SHALL BE SUITABLY PACKED.',
      'WHERE GAP BETWEEN DECK PLANKS AND STRINGER IS SMALLER THAN 20mm, PACK GAPS WITH STEEL SHIMS (TACK WELD TO UB STRINGER).',
      'WHERE GAP BETWEEN DECK PLANKS AND STRINGER IS LARGER THAN 20mm BUT LESS THAN 40mm, PACK GAPS WITH "EMACO S88C" GROUT IN ACCORDANCE WITH MANUFACTURER\'S INSTRUCTIONS (MASTER BUILDERS TECHNOLOGIES) OR SIMILAR APPROVED. PROVIDE FORM TO ONE FACE OF UB TO PREVENT GROUT LEAKAGE. TROWEL FINISH OPPOSITE FACE. WHERE GAP IS LARGER THAN 40mm ENGINEERING INPUT WILL BE REQUIRED.',
      'SPLICE DETAILS ONLY APPROPRIATE FOR 410 UB 54 OR SMALLER MEMBER.', 'TO REMOVE THE EXISTING OUTRIGGERS, THE WELDS BETWEEN THE EXISTING PFC GUARDRAIL POST AND OUTRIGGER SHALL BE GROUND OFF. UNBOLT OUTRIGGER WITH PFC ATTACHED TO CONNECTOR PLATE.',
      'MAKE GOOD DAMAGED SURFACES AND SURFACES OF REMOVED WELDS BY APPLICATION OF APPROVED COLD GALVANISATION IN ACCORDANCE WITH SPECIFICATION 835.', 'SITE MEASURE LOCATION OF GUARDRAIL POST CONNECTION BRACKET PRIOR TO FABRICATION OF PROPOSED STRINGER REPLACEMENT.'], 150);
    return LY.done();
  }, 'Shop-fabricated end-plate splice for UB stringers (410 UB 54 or smaller) within 1200 of a support, steel shim / grout packing under the deck and the guardrail post connection (after MRWA 1330-0025).');
  // ---------------------------------------------------------------- 1330-0026 CORBEL REPLACEMENT AND REPAIR DETAILS
  // corbel elevation (1:10): x = 0 on the pier pile, corbel top at y = 0
  function corbElev(v, c, s, type2) {
    const L = 1000, hw = 140, g = 350, ya = -c.d - 13;
    v.rect(-L / 2, -c.d, L, c.d, 'S-NEW'); v.line(-L / 2, -c.tf, L / 2, -c.tf, 'S-NEW'); v.line(-L / 2, -c.d + c.tf, L / 2, -c.d + c.tf, 'S-NEW'); [-120 - 20, 120 + 20].forEach(x => v.rect(x - 5, -c.d + c.tf, 10, c.d - 2 * c.tf, 'S-NEW')); v.line(-g / 2 + 0, -c.d, -g / 2, -c.d, 'S-NEW');
    [-1, 1].forEach(k => { const xi = k * g / 2; tbx(v, k > 0 ? xi - 0 : xi - hw, ya - 300, hw, 300); aSec(v, xi, -c.d, 200 * 0.9, 13, 13, -k, -1); v.rect(k > 0 ? xi - 13 : xi, -c.d - 200, 13, 200 - 13, 'S-NEW'); shim(v, k > 0 ? xi - 13 - 120 : xi + 13, -c.d - 40, 120, 40);
      v.bolt(k * (g / 2 + 160), 0 - c.tf, k * (g / 2 + 160), -c.d - 13, 20); v.line(xi - k * 300, -c.d - 120, xi + k * 40, -c.d - 120, 'S-BOLT'); v.nut(xi - k * hw, -c.d - 120, -k, 0, 20); v.nut(xi + k * 13, -c.d - 120, k, 0, 20); });
    v.cl(0, -c.d - 500, 0, s.d + 200, 'PIER PILE');
    // stringers: proposed steel to the right; left existing timber (type 1) / proposed steel (type 2)
    ubSide(v, 10, 900, 0, s); v.line(10, 0, 10, s.d, 'S-NEW'); v.rect(10 - 0, -0, 0, 0);
    [-450, 50, 450].forEach(x => v.bolt(x, s.tf, x, -c.tf, 20));
    if (!type2) { v.line(-900, 120, -10, 120, 'S-EXIST'); v.line(-900, 120 + 330, -10, 450, 'S-EXIST'); v.pileEnd(-900, 285, 330, 'S-EXIST', 1); v.line(-10, 0, -10, 450, 'S-EXIST'); tbx(v, -500, 0, 490, 120); v.rect(-470, 120, 60, 120, 'S-NEW'); v.boltEnd(-440, 180, 20); }
    else { ubSide(v, -10, -900, 0, s); v.line(-10, 0, -10, s.d, 'S-NEW'); v.line(-900, -16, -10, -16, 'S-NEW'); v.line(510, -s.tf - 20, 900, -s.tf - 20, 'S-EXIST'); }
    v.dim(-L / 2, s.d + 120, L / 2, s.d + 120, 0, '1000'); v.dim(0, s.d + 60, 10, s.d + 60, 0, '10'); v.dim(-g / 2, -c.d - 460, g / 2, -c.d - 460, 0, '350'); v.dim(400, 60, 450, 60, 0, '50', { sub: '(TYP.)' }); v.dim(10, 120, 60, 120, 0, '50', { sub: '(TYP.)' }); v.dim(380, -c.d + 60, 500, -c.d + 60, 0, '120', { sub: '(TYP.)' }); v.dim(560, -c.d - 120, 560, -c.d - 20, 0, '100', { sub: 'MIN.' });
    return { ya };
  }
  function corbSec(v, c, s, ub) { // section A / C: corbel end-on under the stringer
    const sh = ub ? { d: c.d, b: 160, tf: c.tf, tw: c.tw } : c; iSec(v, 0, -sh.d / 2, sh, 0); iSec(v, 0, s.d / 2, s, 0); zh(v, s.d, -60, 60, 'S-NEW');
    [-1, 1].forEach(k => { v.line(k * (sh.b / 2 - 10), -sh.tf, k * (sh.b / 2 - 10), -sh.d + sh.tf, 'S-NEW'); aSec(v, k * 5, -sh.d, 100, 130, 13, k, -1); v.boltEnd(k * 100, -sh.d - 70, 22); });
    [-45, 45].forEach(x => { v.bolt(x, s.tf, x, -sh.tf, 20); v.bolt(x, -sh.d + sh.tf, x, -sh.d - 13, 20); }); tbeam(v, -280, 280, -sh.d - 300 - 13, -sh.d - 13);
    v.dim(-45, s.d + 60, 0, s.d + 60, 0, '45'); v.dim(0, s.d + 60, 45, s.d + 60, 0, '45'); v.dim(-100, -sh.d - 400, 0, -sh.d - 400, 0, '100'); v.dim(0, -sh.d - 400, 100, -sh.d - 400, 0, '100'); v.dim(260, -sh.d - 110, 260, -sh.d - 70, 0, '40', { sub: '(TYP.)' }); v.cl(0, -sh.d - 450, 0, s.d + 120, 'STRINGER');
    v.leader(45, s.tf + 20, -22, 14, 'M20 BOLT\n(TYP.)'); v.leader(s.b / 2, s.d / 2, 18, 10, 'PROPOSED\nSTRINGER'); v.leader(s.tw / 2, -sh.d / 2, 18, 0, ub ? 'PROPOSED UB\nCORBEL' : 'PROPOSED UC\nCORBEL'); v.leader(-(sh.b / 2 - 10), -sh.d / 2, -18, -2, '10FL STIFFENER\n(TYP.)');
    v.weld(0, -sh.tf - 10, -16, 4, { size: '6', all: true, tail: 'TYP.' }); v.leader(-60, -sh.d - 13, -18, -6, '200x200x13 EA\nx300 LONG (TYP.)'); v.leader(-100, -sh.d - 70, -16, -16, 'φ22 HOLE TO\nSUIT M20 BOLT\n(TYP.)');
  }
  def('cr1', 'Stringers', 'Corbel replacement & repair – Types 1 / 2 and timber corbel strengthening', '1330-0026', [P('uc', 'Proposed UC corbel', '310UC97', { opts: UCs }), P('ub', 'Proposed stringer', '410UB54', { opts: UBs })], (p) => {
    const LY = new Lay(760), c = SEC[p.uc] || SEC['310UC97'], s = SEC[p.ub] || SEC['410UB54'];
    // SECTION B: existing timber corbel strengthening (timber stringer on two steel angles)
    let v = LY.view(10); { const R = 160; v.arc(0, 220, R, 20, 160, 'S-EXIST'); v.line(-R * 0.94, 275, -R * 0.94, 220, 'S-EXIST'); v.line(R * 0.94, 275, R * 0.94, 220, 'S-EXIST'); timberX(v, -60, 0, 120, 50, 'S-NEW'); iSec(v, 0, -s.d * 0.45 / 2, { d: s.d * 0.45, b: 130, tf: s.tf, tw: s.tw }, 0);
      [-1, 1].forEach(k => { v.pl([[k * 65, -s.d * 0.45], [k * 160, 230], [k * 190, 220], [k * 85, -s.d * 0.45]], true, 'S-NEW'); }); v.line(-150, 280, 150, 120, 'S-BOLT'); v.line(150, 280, -150, 120, 'S-BOLT'); v.line(-130, 300, 130, 160, 'S-BOLT');
      tbeam(v, -230, 230, -s.d * 0.45 - 220, -s.d * 0.45); [-45, 45].forEach(x => v.bolt(x, -s.d * 0.45 + s.tf, x, -s.d * 0.45 - 12, 20)); [-100, 100].forEach(x => v.boltEnd(x, -s.d * 0.45 - 80, 22));
      v.dim(-100, -s.d * 0.45 - 330, 0, -s.d * 0.45 - 330, 0, '100'); v.dim(0, -s.d * 0.45 - 330, 100, -s.d * 0.45 - 330, 0, '100'); v.dim(-300, -s.d * 0.45 - 80, -300, -s.d * 0.45 - 40, 0, '40', { sub: '(TYP.)' }); v.cl(0, -s.d * 0.45 - 360, 0, 420, 'TIMBER STRINGER');
      v.leader(-30, 40, -24, 40, 'CONTINUOUS TIMBER PACKERS\n(F11 SEASONED JARRAH) TO\nACHIEVE TIGHT FIT BETWEEN\nCORBEL AND EXISTING\nSTRINGER'); v.leader(30, 230, 10, 26, 'φ20 THREADED\nROD (TYP.)'); v.leader(150, 290, 16, 10, 'CURVED WASHER (TYP.) REFER\nDRG N° 9530-0072. TRIM\nWASHER EDGE AS REQUIRED\nTO OBTAIN SNUG FIT TO PILE\nAND AVOID CLASH WITH EA.');
      v.leader(-160, 160, -24, -4, 'NOTCH FACE OF EXISTING TIMBER\nSTRINGER OR PACK GAP BETWEEN\nANGLE AND STRINGER FACE WITH\n100x(5,6,8,10,12 OR 16FL)x100 STEEL\nPACKERS AS REQUIRED. TACK\nWELD STEEL PACKERS TO ANGLE\nAFTER PLACEMENT'); v.leader(170, 150, 18, 2, '75x75x8 EA (TYP.)');
      v.weld(40, -40, 22, -8, { size: '6', both: true, tail: 'TYP.' }); v.weld(70, -s.d * 0.45 + 5, 22, -10, { size: '6', all: true, tail: 'TYP.' }); }
    capUnder(v, 'SECTION B', null);
    // TYPE 1
    v = LY.view(10); corbElev(v, c, s, false); v.mark(350, s.d + 280, 'A', 180); v.mark(-470, s.d + 280, 'B', 0);
    v.leader(-700, 300, -12, 16, 'EXISTING TIMBER\nSTRINGER', { dot: true }); v.leader(-400, -c.d, -16, -12, 'PROPOSED STEEL\nCORBEL'); v.leader(-310, -c.d - 250, -14, -22, 'EXISTING TIMBER\nHALFCAP (TYP.)'); v.leader(-440, -c.d - 120, -22, -6, 'φ20 THREADED ROD WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP.)');
    v.leader(400, s.d / 2, 14, 16, 'PROPOSED STEEL\nSTRINGER', { dot: true }); v.leader(120, -c.d - 20, 22, -26, '200x(6,8,10 OR 12FL)x300 LONG\nSTEEL SHIMS. REFER NOTE 2.');
    capUnder(v, 'ELEVATION', 'CORBEL REPLACEMENT DETAIL - TYPE 1', 10);
    v = LY.view(10); corbSec(v, c, s, false); capUnder(v, 'SECTION A', null);
    LY.break();
    v = LY.view(10); corbSec(v, c, s, true); capUnder(v, 'SECTION C', null);
    v = LY.view(10); corbElev(v, c, s, true); v.mark(-400, s.d + 280, 'C', 180);
    v.leader(-480, s.d - 20, -14, 18, 'PROPOSED STEEL\nSTRINGER'); v.leader(-400, -c.d / 2, -16, -6, 'PROPOSED STEEL\nCORBEL', { dot: true }); v.leader(-310, -c.d - 200, -16, -14, 'EXISTING TIMBER\nHALF-CAP\n(TYP.)');
    v.leader(600, -s.tf - 20, 14, -14, 'EXISTING OR PROPOSED\nSTEEL STRINGER'); v.leader(120, -c.d - 20, 30, -24, '200x(6,8,10 OR 12FL)x490 LONG STEEL\nSHIMS. REFER NOTE 2'); v.leader(200, -c.d - 120, 24, -34, 'φ20 THREADED ROD WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP.)');
    capUnder(v, 'ELEVATION', 'CORBEL REPLACEMENT DETAIL - TYPE 2', 10);
    LY.notes([GN, 'STEEL SHIMS USED TO PACK STEEL STRINGER TIGHT AGAINST EXISTING DECKING AND ACHIEVE FULL BEARING. TACK WELD STEEL PACKERS TO CORBEL AFTER PLACEMENT.'], 140);
    return LY.done();
  }, 'Replaces a failed timber corbel with a 1000 long UC / UB steel corbel on 200x200x13 angles bolted to the half-caps (Type 1 under a steel + timber stringer, Type 2 under steel stringers), or strengthens a timber corbel with angles (Section B) (after MRWA 1330-0026).');
  // ---------------------------------------------------------------- 1330-0027 HALF-CAP REPLACEMENT DETAILS
  def('hcr', 'Halfcaps', 'Half-cap replacement (PFC) & pile connections Types 1 / 2', '1330-0027', [P('pfc', 'PFC halfcap', '300PFC', { opts: ['300PFC', '380PFC'] }), P('D', 'Pile dia. (mm)', 360, { num: 1 })], (p) => {
    const LY = new Lay(760), s = SEC[p.pfc] || SEC['300PFC'], D = max(240, +p.D || 360), pd = s.d;
    // ELEVATION (1:20): y = 0 at the PFC underside; deck above; four supports
    let v = LY.view(20); const yt = pd, Dl = 330, top = yt + 2 * Dl + 40;
    v.line(-400, yt, 4600, yt, 'S-NEW'); v.line(-400, yt - s.tf, 4600, yt - s.tf, 'S-NEW'); v.line(-400, s.tf, 4600, s.tf, 'S-NEW'); v.line(-400, 0, 4600, 0, 'S-NEW'); zz(v, -400, 0, yt, 'S-NEW'); zz(v, 4600, 0, yt, 'S-NEW');
    v.line(-400, top, 4600, top, 'S-EXIST'); v.line(-400, top + 60, 4600, top + 60, 'S-EXIST'); v.line(-400, top + 200, 4600, top + 200, 'S-CONC'); zz(v, -400, top, top + 200); zz(v, 4600, top, top + 200); zh(v, top + 200, 1800, 2000);
    v.hatch([[-150, top + 80], [200, top + 80], [200, top + 180], [-150, top + 180]], 'conc', 'S-HATCH', 0.8);
    // permanent formwork / steel stringer at left
    iSec(v, -200, yt + (top - yt) / 2, { d: top - yt, b: 150, tf: 12, tw: 8 }, 0); v.rect(-260, yt + 220, 120, 16, 'S-NEW'); v.rect(-260, yt + 190, 120, 16, 'S-NEW');
    const piles = [400, 1600, 2700], xs = [1000, 1600];
    piles.forEach((x, i) => { v.line(x - D / 2, -1200, x - D / 2, -10, 'S-EXIST'); v.line(x + D / 2, -1200, x + D / 2, -10, 'S-EXIST'); v.pileEnd(x, -1200, D, 'S-EXIST'); v.rect(x - D / 2 - 15, -150, D + 30, 35, 'S-EXIST'); shim(v, x - 150, -10, 300, 10); });
    // steel pile (Type 2)
    v.line(3300 - 100, -1200, 3300 - 100, -10, 'S-HIDDEN'); v.line(3300 + 100, -1200, 3300 + 100, -10, 'S-HIDDEN'); v.line(3300, -1200, 3300, 300, 'S-HIDDEN'); zh(v, -1200, 3150, 3450); v.rect(2950, -16, 700, 16, 'S-NEW'); [130, 220].forEach(y => v.boltEnd(3300, y, 20));
    xs.forEach(x => { v.circ(x, yt + Dl / 2, Dl / 2, 'S-EXIST'); v.circ(x, yt + Dl * 1.5, Dl / 2, 'S-EXIST'); v.line(x - 8, 0, x - 8, top, 'S-HIDDEN'); v.line(x + 8, 0, x + 8, top, 'S-HIDDEN'); });
    v.circ(4000, yt + Dl * 1.4, Dl / 2, 'S-EXIST'); timberX(v, 3820, yt, 360, 200); [-1, 1].forEach(k => v.line(4000 + k * 170, yt + 40, 4000 - k * 120, yt + 200, 'S-BOLT'));
    [400, 1600].forEach(x => { v.boltEnd(x - 160, yt / 2, 20); v.boltEnd(x + 160, yt / 2, 20); }); [3850, 4150].forEach(x => v.boltEnd(x, yt / 2, 20));
    const rr = (x0, y0, w, h) => rrect(v, x0, y0, w, h, 100); rr(150, -400, 500, yt + 400 + 60); rr(750, -60, 500, top - 0); rr(1350, -400, 500, top + 80); rr(2900, -500, 800, yt + 560); rr(3700, -400, 600, yt + 450);
    v.dim(4300, -460, 4600, -460, 0, '150 MIN', { sub: '300 MAX (TYP.)' }); v.line(4300, -400, 4300, -480, 'S-DIM');
    v.leader(-200, top, -18, 4, 'PERMANENT\nFORMWORK'); v.leader(-200, yt, -18, -12, 'REFER CORBEL/ STRINGER\nBOTTOM FLANGE\nCONNECTION\nDETAIL TYPE 3 ON\nDRG N° 1330-0029');
    v.leader(900, top, -16, 24, 'REFER TO HALFCAP TO\nCORBEL/ STRINGER\nCONNECTION TYPE 1\nON DRG N° 1330-0028'); v.leader(1700, top, 16, 24, 'REFER TO HALFCAP TO\nCORBEL/ STRINGER\nCONNECTION TYPE 2\nON DRG N° 1330-0028');
    v.leader(150, -300, -14, -12, 'REFER TO HALFCAP\nTO PILE CONNECTION\nDETAIL TYPE 1'); v.leader(400 - D / 2, -700, -14, -14, 'EXISTING TIMBER\nPILE (TYP.)'); v.leaders([[500, -10], [500, -132]], 16, -26, 'SHIM PLATES\n(TYP.)'); v.leader(600, -150, 22, -40, 'PROPOSED\nPILE BAND\n(TYP.)');
    v.leader(2950, -400, -14, -30, 'REFER TO HALFCAP\nTO PILE CONNECTION\nDETAIL TYPE 2');
    v.leader(4000, yt + Dl * 1.6, 14, 26, 'EXISTING TIMBER\nSTRINGER (TYP.)', { dot: true }); v.leader(4300, yt + 300, 14, 14, 'REFER TO HALFCAP TO\nCORBEL/ STRINGER\nCONNECTION TYPE 4\nON DRG N° 1330-0029'); v.leader(4100, yt + 120, 16, -2, 'EXISTING TIMBER\nCORBEL (TYP.)', { dot: true });
    v.leader(4400, yt, 14, -10, 'PROPOSED STEEL\nPFC HALFCAP'); v.leader(4150, yt / 2, 14, -22, "THREADED ROD\nOR 'U' ROD\n(TYP.)");
    capUnder(v, 'ELEVATION');
    // PLANS (1:20)
    v = LY.view(20); { const w = 180; [-1, 1].forEach(k => { v.line(-700, k * w / 2, 700, k * w / 2, k > 0 ? 'S-EXIST' : 'S-NEW'); }); v.line(-700, -w / 2 - s.b, 700, -w / 2 - s.b, 'S-NEW'); v.line(-700, w / 2 + 80, 700, w / 2 + 80, 'S-EXIST'); v.hatch([[-200, w / 2 + 80], [200, w / 2 + 80], [200, w / 2 + 140], [-200, w / 2 + 140]], 'earth', 'S-HATCH');
      zz(v, -700, -w / 2 - s.b, w / 2 + 80); zz(v, 700, -w / 2 - s.b, w / 2 + 80); v.circ(0, 0, D / 2, 'S-HIDDEN'); v.arc(0, 0, 150, 0, 180, 'S-BOLT'); v.arc(0, 0, 170, 0, 180, 'S-BOLT'); [-160, 160].forEach(x => { v.line(x - 10, 0, x - 10, -w / 2 - 20, 'S-BOLT'); v.line(x + 10, 0, x + 10, -w / 2 - 20, 'S-BOLT'); v.nut(x, -w / 2 - s.b + s.tw, 0, -1, 20); });
      v.rect(-120, -w / 2 - s.b - 60, 240, 60, 'S-NEW'); v.line(-900, 0, 700, 0, 'S-CL'); { const q = v.P(-900, 0); v.add({ t: 'text', p: [q[0] - 1, q[1] - 1], s: '℄ ABUT.', h: TH, al: 'r', v: 'b', ang: 0, L: 'S-TEXT' }); }
      v.leader(0, w / 2 + 100, -18, 14, 'EXISTING TIMBER\nSHEETING'); v.leader(-150, 60, -22, 8, "φ20 THREADED\n'U' ROD"); v.leader(-400, -w / 2 - s.b, -12, -14, 'PFC STEEL\nHALFCAP\nREPLACEMENT'); }
    capUnder(v, 'ABUTMENT PLAN');
    v = LY.view(20); { const w = 180; [-1, 1].forEach(k => { v.line(-700, k * w / 2, 700, k * w / 2, 'S-NEW'); v.line(-700, k * (w / 2 + s.b), 700, k * (w / 2 + s.b), 'S-NEW'); zz(v, -700, k * w / 2, k * (w / 2 + s.b)); zz(v, 700, k * w / 2, k * (w / 2 + s.b)); v.rect(-120, k > 0 ? w / 2 + s.b : -w / 2 - s.b - 60, 240, 60, 'S-NEW'); });
      v.circ(0, 0, D / 2, 'S-HIDDEN'); [-160, 160].forEach(x => { v.line(x - 10, -w / 2 - s.b, x - 10, w / 2 + s.b, 'S-BOLT'); v.line(x + 10, -w / 2 - s.b, x + 10, w / 2 + s.b, 'S-BOLT'); }); v.line(-700, 0, 900, 0, 'S-CL'); { const q = v.P(900, 0); v.add({ t: 'text', p: [q[0] + 1, q[1] - 1], s: '℄ PIER', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
      v.leader(160, w / 2 + s.b, 14, 14, 'φ20 THREADED ROD\n(TYP.)'); v.leaders([[-300, -w / 2 - s.b], [-400, w / 2 + s.b]], -14, -14, 'PFC STEEL\nHALFCAP\nREPLACEMENT'); v.leader(100, -w / 2 - s.b - 60, 16, -12, 'SHIM PLATES\n(TYP.)'); }
    capUnder(v, 'PIER PLAN', 'HALFCAP REPLACEMENT DETAIL', 20);
    LY.break();
    // TYPE 1 (1:10)
    v = LY.view(10); v.rect(-450, 0, 1100, pd, 'S-NEW'); v.line(-450, s.tf, 650, s.tf, 'S-NEW'); v.line(-450, pd - s.tf, 650, pd - s.tf, 'S-NEW'); zz(v, -450, 0, pd, 'S-NEW'); zz(v, 650, 0, pd, 'S-NEW');
    v.line(-D / 2, -500, -D / 2, -10, 'S-EXIST'); v.line(D / 2, -500, D / 2, -10, 'S-EXIST'); v.pileEnd(0, -500, D, 'S-EXIST'); v.line(-D / 2 + 25, -500, -D / 2 + 25, pd, 'S-HIDDEN'); v.line(D / 2 - 25, -500, D / 2 - 25, pd, 'S-HIDDEN');
    shim(v, -150, -10, 300, 10); v.rect(-D / 2 - 15, -135, D + 30, 35, 'S-EXIST'); [-D / 2 + 25, D / 2 - 25].forEach(x => v.circ(x, pd / 2, 14, 'S-BOLT')); v.line(-D / 2 + 25, pd / 2 + 10, D / 2 - 25, pd / 2 + 10, 'S-HIDDEN'); v.line(-D / 2 + 25, pd / 2 - 10, D / 2 - 25, pd / 2 - 10, 'S-HIDDEN');
    v.dim(-150, -560, 150, -560, 0, '300'); v.dim(-D / 2 - 120, -100, -D / 2 - 120, 0, 0, '100'); v.dim(-D / 2, -300, -D / 2 + 25, -300, 0, '25 NOTCH', { sub: '(TYP.)' }); v.dim(700, 0, 700, pd / 2, 0, '='); v.dim(700, pd / 2, 700, pd, 0, '=');
    v.cl(0, -600, 0, pd + 120, 'PILE'); v.mark(-D / 2 - 60, pd + 160, 'A', 0);
    v.leader(400, 0, 16, -12, 'PROPOSED STEEL\nPFC HALFCAP'); v.leader(100, -10, 30, -20, 'SHIM PLATE'); v.leader(150, -118, 30, -24, 'PILE BAND'); v.leader(D / 2, -300, 26, -18, 'EXISTING TIMBER\nPILE');
    capUnder(v, null, 'HALFCAP TO PILE CONNECTION DETAIL - TYPE 1', 10);
    // SECTION A
    v = LY.view(10); { const xw = 0; v.pl([[xw, -500], [xw, -10], [xw - 70, -10], [xw - 70, pd + 100]], false, 'S-EXIST'); v.line(xw - D, -500, xw - D, pd + 100, 'S-EXIST'); zh(v, pd + 100, xw - D - 20, xw - 50); v.pileEnd(xw - D / 2, -500, D, 'S-EXIST');
      cSec(v, xw - 70, pd / 2, s, -1); v.fill([[xw - 70, 0], [xw - 70 + 0, s.tf], [xw - 70 - s.b, s.tf], [xw - 70 - s.b, 0]]); shim(v, xw - 70 - s.b, -10, s.b, 10); v.rect(xw - D - 15, -135, D + 30, 35, 'S-EXIST');
      v.line(xw - 70 - s.tw, pd * 0.65 + 10, xw - D - 60, pd * 0.65 + 10, 'S-HIDDEN'); v.line(xw - 70 - s.tw, pd * 0.65 - 10, xw - D - 60, pd * 0.65 - 10, 'S-HIDDEN'); v.nut(xw - 70 + 0, pd * 0.65, 1, 0, 20);
      v.dim(xw - 70, -560, xw, -560, 0, ''); v.mtext(xw - 340, -600, BRG.replace('LESS. REFER NOTE 5.', 'LESS. REFER NOTE 2.'), TH, 'l');
      v.leader(xw - 140, pd * 0.65, -14, 18, "φ20 THREADED ROD\nOR φ20 'U' ROD"); v.weld(xw - 70 - s.b + 10, 5, 20, 22, { size: '6', site: true }); v.leader(xw - 70 - s.b / 2, -10, 24, -10, SHIM130.replace('NOTE 4.', 'NOTE 2.'));
      v.leader(xw - 40, -10, 26, -34, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED PFC.'); v.leader(xw, -300, 20, -14, 'EXISTING TIMBER\nPILE'); }
    capUnder(v, 'SECTION A', null);
    // TYPE 2 (steel pile)
    v = LY.view(10); { const u = SEC['250UC73']; v.rect(-500, 0, 1100, pd, 'S-NEW'); v.line(-500, s.tf, 600, s.tf, 'S-NEW'); v.line(-500, pd - s.tf, 600, pd - s.tf, 'S-NEW'); zz(v, -500, 0, pd, 'S-NEW'); zz(v, 600, 0, pd, 'S-NEW');
      v.rect(-u.b / 2, -600, u.b, 600 - 16, 'S-HIDDEN'); v.line(0, -600, 0, pd, 'S-HIDDEN'); zh(v, -600, -u.b / 2 - 20, u.b / 2 + 20); v.rect(-400, -16, 850, 16, 'S-NEW'); v.rect(-u.b / 2, -16, u.b, 0, 'S-NEW'); shim(v, -u.b / 2, -16 - 0, u.b, 0.1);
      v.rect(30, 0, 70, pd, 'S-HIDDEN'); [120, 230].forEach(y => v.boltEnd(65, y, 20)); v.dim(-400, pd + 60, -100, pd + 60, 0, '300', { sub: '(TYP.)' }); v.dim(-100, pd + 80, -50, pd + 80, 0, '50', { sub: '(TYP.)' }); v.dim(-620, -16, -620, pd, 0, 'REFER NOTE 4.'); v.dim(-560, -66, -560, -16, 0, '50', { sub: 'MIN.' });
      v.cl(0, -660, 0, pd + 120, 'PILE'); v.mark(-80, pd + 220, 'B', 0);
      v.leader(-200, -8, -30, 40, '100x16FL MODIFIED\nFLANGE LENGTH TO\nSUIT.'); v.leader(300, pd, 14, 20, 'PROPOSED STEEL\nPFC HALFCAP'); v.leader(100, 200, 24, 22, 'PFC TO PILE CONNECTION\nTO SUIT EXISTING\nCONNECTION. REFER NOTE\n5.'); v.leader(u.b / 2, -16, 18, -14, 'SHIM PLATES'); v.leader(-u.b / 2, -400, -16, -6, 'EXISTING\nSTEEL PILE'); }
    capUnder(v, null, 'HALFCAP TO PILE CONNECTION DETAIL - TYPE 2', 10);
    // SECTION B
    v = LY.view(10); { const u = SEC['250UC73']; v.line(-u.d / 2, -500, -u.d / 2, pd - 20, 'S-EXIST'); v.line(-u.d / 2 + u.tf, -500, -u.d / 2 + u.tf, pd - 20, 'S-EXIST'); v.line(u.d / 2, -500, u.d / 2, -20, 'S-EXIST'); v.line(u.d / 2 - u.tf, -500, u.d / 2 - u.tf, -20, 'S-EXIST'); zh(v, -500, -u.d / 2 - 20, u.d / 2 + 20);
      cSec(v, -u.d / 2 + u.tf + 10, pd / 2, s, 1); v.hatch([[-u.d / 2, 0], [-u.d / 2 + 10, 0], [-u.d / 2 + 10, pd], [-u.d / 2, pd]], 'ansi31', 'S-HATCH', 0.5); v.rect(-u.d / 2 + u.tf + 10, -16, 110, 16, 'S-NEW'); shim(v, -u.d / 2 + u.tf + 10 + 15, 0, 80, 10);
      v.circ(-u.d / 2 + u.tf + 20, 0, 50, 'S-TEXT'); weldCircle(v, -u.d / 2 + 260, pd + 200, 110, true, -1, 1); v.line(-u.d / 2 + u.tf + 50, 30, -u.d / 2 + 200, pd + 110, 'S-TEXT');
      v.leader(-u.d / 2 + u.tf + 10 + s.b, pd, -26, 18, 'PROPOSED STEEL\nPFC HALFCAP'); v.leader(-u.d / 2 + u.tf + 80, -8, 30, 28, 'MODIFIED\nFLANGE'); v.weld(-u.d / 2 + u.tf + 100, 5, 20, 12, { size: '4', site: true, tail: '(TYP.)' }); v.leader(-u.d / 2 + u.tf + 100, -16, 22, -16, '130x(6,8,10 OR 12 FL)\nGALV. STEEL SHIM\nPLATES AS REQUIRED.\nTACK WELD SHIM PLATES\nTOGETHER AFTER\nPLACEMENT. MAKE GOOD\nGALV. SURFACE\nBY APPLYING COLD CALV.'); }
    capUnder(v, 'SECTION B', null);
    LY.notes(['FOR GENERAL NOTES REFER DRAWING N°. 1330-0001.', 'MAKE GOOD DAMAGED GALV. SURFACE BY APPLYING COLD GALV. OR SIMILAR APPROVED IN ACCORDANCE WITH SPECIFICATION 835', "IF EXISTING BEARING IS LESS THAN REQUIRED MIN. REFER DRG N°'S 1330-0022", 'MINIMUM DISTANCE BETWEEN MODIFIED FLANGE AND PFC FLANGE TO BE DETERMINED BY ENGINEER.', 'PROPOSED PFC TO BE DRILLED ON SITE AND NEW BOLTS TO BE PROVIDED TO SUIT EXISTING PILE CONNECTION.'], 150);
    return LY.done();
  }, 'Replaces a timber half-cap with a PFC half-cap each side of the piles: Type 1 seat on a trimmed timber pile with U-rods / rods, Type 2 on a modified flange over an existing steel pile (after MRWA 1330-0027).');
})(typeof window !== 'undefined' ? window : globalThis);
