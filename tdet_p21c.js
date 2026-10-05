/* StructCap Timber — repair details: PN30-2125 … 2133 (abutment / wingwall piles, restraint, driven piles).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions.
   Layout: every view is placed where it sits on the source sheet. Sheet positions are given in "sheet px" (the A3 page
   at 819 px wide) and mapped to paper mm with K, which makes the 1:20 views match the true scale of the sheet's drawings. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ local helpers (sheet px -> paper mm)
  const K = 0.495, X = px => px * K, Y = py => -py * K;
  // view at scale s whose model origin sits at sheet px (px, py)
  const V = (B, s, px, py) => B.view(s, X(px), Y(py));
  // leader from model point (x,y) to a knee at sheet px (kx,ky); text continues beyond the knee
  const lab = (v, x, y, kx, ky, s, o) => { const a = v.P(x, y); return v.leader(x, y, X(kx) - a[0], Y(ky) - a[1], s, o); };
  const labs = (v, pts, kx, ky, s, o) => { const a = v.P(pts[0][0], pts[0][1]); v.leaders(pts, X(kx) - a[0], Y(ky) - a[1], s, o); };
  // weld symbol: arrow at model point, reference line starting at sheet px (kx,ky)
  const weldAt = (v, x, y, kx, ky, o) => { const a = v.P(x, y); v.weld(x, y, X(kx) - a[0], Y(ky) - a[1], o); };
  // plain text at sheet px (multi-line)
  const txt = (B, px, py, s, h, al, L) => { h = h || TH; String(s).split('\n').forEach((l, i) => B.E.push({ t: 'text', p: [X(px), Y(py) - i * h * 1.55], s: l, h, al: al || 'l', v: 'b', ang: 0, L: L || 'S-TEXT' })); };
  // dashed designer's note box: top-left at sheet px, width in sheet px
  const nbox = (B, px, py, s, wpx, o) => B.noteBox(X(px), Y(py), s, wpx * K, o);
  // view title centred at sheet px
  function ttl(B, px, py, s, scale, sub, o) {
    o = o || {}; const m = /^(SECTION|VIEW|DETAIL|ELEVATION|PLAN)\s+([A-Z0-9]{1,2})$/.exec(s), h = o.h || 3.2, word = m ? m[1] : s, tw = word.length * h * 0.68, cw = m ? 9 : 0, x0 = o.left ? X(px) : X(px) - (tw + cw) / 2, y = Y(py);
    B.E.push({ t: 'text', p: [x0, y], s: word, h, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); B.E.push({ t: 'line', a: [x0, y - 1.1], b: [x0 + tw, y - 1.1], L: 'S-TITLE' });
    if (m) { B.E.push({ t: 'circle', c: [x0 + tw + 5.5, y + h / 2], r: 3, L: 'S-TITLE' }); B.E.push({ t: 'text', p: [x0 + tw + 5.5, y + h / 2], s: m[2], h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); }
    let yy = y - 4.4; if (sub) String(sub).split('\n').forEach(l => { B.E.push({ t: 'text', p: [x0, yy], s: l, h: TH * 0.95, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.4; });
    if (scale) B.E.push({ t: 'text', p: [x0, yy], s: typeof scale === 'string' ? scale : '1:' + scale, h: TH * 0.95, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
  }
  // main detail title as on the PN30 sheets: pile-type symbol (sq / tri / otri / dia / none), underlined title, drawing ref, sub-lines
  function mainT(B, px, py, s, sub, sym, o) {
    o = o || {}; const h = o.h || 3.6, x = X(px), y = Y(py), lines = String(s).split('\n'), tw = max(...lines.map(l => l.length)) * h * 0.7;
    lines.forEach((l, i) => { const yy = y - i * h * 1.7; B.E.push({ t: 'text', p: [x, yy], s: l, h, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); B.E.push({ t: 'line', a: [x, yy - 1.2], b: [x + l.length * h * 0.7, yy - 1.2], L: 'S-TITLE' }); });
    const yl = y - (lines.length - 1) * h * 1.7, c = [x - 5, y + h / 2], r = 1.9;
    if (sym === 'sq') B.E.push({ t: 'solid', p: [[c[0] - r, c[1] - r], [c[0] + r, c[1] - r], [c[0] + r, c[1] + r], [c[0] - r, c[1] + r]], L: 'S-TITLE' });
    if (sym === 'tri') B.E.push({ t: 'solid', p: [[c[0] - r * 1.1, c[1] - r], [c[0] + r * 1.1, c[1] - r], [c[0], c[1] + r * 1.1]], L: 'S-TITLE' });
    if (sym === 'otri') B.E.push({ t: 'pl', p: [[c[0] - r * 1.1, c[1] - r], [c[0] + r * 1.1, c[1] - r], [c[0], c[1] + r * 1.1]], closed: true, L: 'S-TITLE' });
    if (sym === 'dia') B.E.push({ t: 'solid', p: [[c[0], c[1] - r * 1.2], [c[0] + r * 1.2, c[1]], [c[0], c[1] + r * 1.2], [c[0] - r * 1.2, c[1]]], L: 'S-TITLE' });
    B.E.push({ t: 'text', p: [x + tw + 4, yl], s: o.ref || 'XX30-XXXX', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
    let yy = yl - 4.6; String(sub || '').split('\n').filter(Boolean).forEach(l => { B.E.push({ t: 'text', p: [x, yy], s: l, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.4; });
    if (o.scale) B.E.push({ t: 'text', p: [x, yy], s: '1:' + o.scale, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
    return { x: x + tw + 4 + 10, top: yl + TH + 0.8, bot: yl - 1.2 };
  }
  // "DRG NUMBER - REFER TO PLAN DRAWING" box with its dashed pointer to the XX30-XXXX reference
  function drgBox(B, px, py, wpx, r, o) {
    const a = Y(py) > r.top ? [r.x, r.top] : [r.x, r.bot];
    const H = nbox(B, px, py, 'DRG NUMBER - REFER TO\nPLAN DRAWING', wpx, o), cs = [[X(px), Y(py)], [X(px) + wpx * K, Y(py)], [X(px), Y(py) - H], [X(px) + wpx * K, Y(py) - H]], b = cs.sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]))[0];
    B.E.push({ t: 'line', a: b, b: a, L: 'S-NOTE' }); const g = Math.atan2(a[1] - b[1], a[0] - b[0]);
    B.E.push({ t: 'solid', p: [a, [a[0] - 2.2 * Math.cos(g) + 0.7 * Math.sin(g), a[1] - 2.2 * Math.sin(g) - 0.7 * Math.cos(g)], [a[0] - 2.2 * Math.cos(g) - 0.7 * Math.sin(g), a[1] - 2.2 * Math.sin(g) + 0.7 * Math.cos(g)]], L: 'S-TEXT' });
  }
  // MRWA earth / fill hatching: a strip of short crossing strokes on the left of the direction (x1,y1)->(x2,y2) (side -1: right)
  function soil(v, x1, y1, x2, y2, side, L) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, k = side || 1, nx = -uy * k, ny = ux * k, st = 1.25 * v.s, w = 2.0 * v.s;
    let i = 0; for (let t = st * 0.5; t + w * 0.6 <= len; t += st, i++) { const x = x1 + ux * t, y = y1 + uy * t; if (i % 2) v.line(x, y, x + nx * w + ux * w * 0.6, y + ny * w + uy * w * 0.6, L || 'S-GROUND'); else v.line(x + ux * w * 0.6, y + uy * w * 0.6, x + nx * w, y + ny * w, L || 'S-GROUND'); }
    v.line(x1, y1, x2, y2, L || 'S-GROUND');
  }
  // timber break symbol across a member end ("-/\/-" with short return ticks), centred on (x,y), member running along angle ang (deg)
  function tbrk(v, x, y, w, ang, L) {
    const a = (ang == null ? 90 : ang) * PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, z = 1.4 * v.s, h = w / 2 + 1.6 * v.s;
    const pt = (t, n) => [x + nx * t + ux * n, y + ny * t + uy * n];
    v.pl([pt(-h, 0), pt(-z * 0.6, 0), pt(-z * 0.25, z * 1.4), pt(z * 0.25, -z * 0.6), pt(z * 0.6, 0), pt(h, 0)], false, L || 'S-TEXT');
  }
  // bar seen end-on drawn as a ring with a dot (N16 / N20 at the scale of the sheets)
  const barRing = (v, x, y) => { v.circ(x, y, 1.3 * v.s, 'S-REO'); v.barEnd(x, y, 8); };
  // section marker as on the PN30 elevations: circle + letter with a solid pointer under it, short line to the right
  function secMk(v, x, y, ch, len) { const p = v.P(x, y); v.add({ t: 'circle', c: p, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); v.add({ t: 'solid', p: [[p[0] - 1.6, p[1] - 2.5], [p[0] + 1.6, p[1] - 2.5], [p[0], p[1] - 4.6]], L: 'S-TEXT' }); v.add({ t: 'line', a: [p[0] + 3, p[1]], b: [p[0] + 3 + (len || 12), p[1]], L: 'S-TITLE' }); }
  // the matching flag at the other end of a section line: heavy line with a solid wedge under it
  function secFlag(v, x, y, len, left) { const p = v.P(x, y), l = len || 16, k = left ? -1 : 1; v.add({ t: 'line', a: p, b: [p[0] + k * l, p[1]], L: 'S-TITLE' }); v.add({ t: 'solid', p: [[p[0] + k * l * 0.45, p[1]], [p[0] + k * l, p[1]], [p[0] + k * l * 0.72, p[1] - 1.6]], L: 'S-TEXT' }); }
  // U2 / U3 finish tick mark on a surface at model point
  function finish(v, x, y, s) { const p = v.P(x, y); v.add({ t: 'pl', p: [[p[0] - 1.3, p[1] + 1.6], [p[0], p[1]], [p[0] + 1.6, p[1] + 2.2]], closed: false, L: 'S-TEXT' }); v.add({ t: 'text', p: [p[0], p[1] + 2.6], s, h: 2.0, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); }
  // small bar-shape icon (square with a gap) as printed after the N16 notes
  function barIcon(B, px, py) { const x = X(px), y = Y(py); B.E.push({ t: 'pl', p: [[x + 0.8, y + 3.4], [x, y + 3.4], [x, y], [x + 3.4, y], [x + 3.4, y + 3.4], [x + 1.6, y + 3.4]], closed: false, L: 'S-TEXT' }); B.E.push({ t: 'pl', p: [[x + 0.7, y + 2.6], [x + 0.7, y + 0.7], [x + 2.7, y + 0.7]], closed: false, L: 'S-TEXT' }); }
  // filled rectangle (formwork, plates at small scale)
  const frect = (v, x0, y0, x1, y1, L) => v.fill([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], L || 'S-NEW');

  // ---- views in full-resolution sheet px (220 dpi page, y DOWN): model unit = 1 px, origin offset (ox, oy) for crops
  const kF = K / 3.1416, F = q => q / 3.1416;
  function FV(B, ox, oy, mx) { const v = B.view(1 / kF, 0, 0); ox = ox || 0; oy = oy || 0; v.mir = mx != null; v.P = (x, y) => [(v.mir ? mx - x : x + ox) * kF, -(y + oy) * kF]; return v; }
  const lb = (v, x, y, kx, ky, s, o) => { const a = v.P(x, y), b = v.P(kx, ky); return v.leader(x, y, b[0] - a[0], b[1] - a[1], s, o); };
  const lbs = (v, pts, kx, ky, s, o) => { const a = v.P(pts[0][0], pts[0][1]), b = v.P(kx, ky); v.leaders(pts, b[0] - a[0], b[1] - a[1], s, o); };
  const wld = (v, x, y, kx, ky, o) => { const a = v.P(x, y), b = v.P(kx, ky); v.weld(x, y, b[0] - a[0], b[1] - a[1], o); };
  // horizontal dim x1<x2, extension from yref, dimension line at y (all in view px); vertical dim y1<y2 from xref, line at x
  const dH = (v, x1, x2, yref, y, t, o) => v.mir ? v.dim(x2, yref, x1, yref, (yref - y) * kF, t, o) : v.dim(x1, yref, x2, yref, (yref - y) * kF, t, o);
  // short horizontal dim whose text sits outside, left (left = true) or right of the arrows
  const dHs = (v, x1, x2, yref, y, t, l0) => { dH(v, x1, x2, yref, y, ''); const p = v.P(l0 ? x1 : x2, y), left = !!l0 !== !!v.mir; v.add({ t: 'text', p: [p[0] + (left ? -5.5 : 5.5), p[1] + 0.7], s: t, h: 2.0, al: left ? 'r' : 'l', v: 'b', ang: 0, L: 'S-DIM' }); };
  // short vertical dim with its (rotated) text below (below = true) or above the arrows
  const dVs = (v, y1, y2, xref, x, t, below) => { dV(v, y1, y2, xref, x, ''); const p = v.P(x, below ? y2 : y1), n = t.length * 2.0 * 0.62 / 2 + 5.5; v.add({ t: 'text', p: [p[0] - 0.7, p[1] + (below ? -n : n)], s: t, h: 2.0, al: 'c', v: 'b', ang: 90, L: 'S-DIM' }); };
  const dV = (v, y1, y2, xref, x, t, o) => v.dim(xref, y1, xref, y2, (x - xref) * kF * (v.mir ? -1 : 1), t, o);
  // text in a view at view px (multi-line), and rotated text
  const vt = (v, x, y, s, h, al, L) => { const p = v.P(x, y); h = h || TH; String(s).split('\n').forEach((l, i) => v.add({ t: 'text', p: [p[0], p[1] - i * h * 1.55], s: l, h, al: al || 'l', v: 'b', ang: 0, L: L || 'S-TEXT' })); };
  // dashed heavy line (rods drawn dashed on the sheets), dash / gap in paper mm
  function dashL(v, x1, y1, x2, y2, L, d, g) { const a = v.P(x1, y1), b = v.P(x2, y2), len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]; d = d || 1.6; g = g || 0.7; for (let t = 0; t < len; t += d + g) { const e = min(len, t + d); v.add({ t: 'line', a: [a[0] + u[0] * t, a[1] + u[1] * t], b: [a[0] + u[0] * e, a[1] + u[1] * e], L: L || 'S-BOLT' }); } }
  // threaded rod drawn as on the PN30 plans: heavy dashed with solid arrow-like nuts at both ends
  function rodD(v, x1, y1, x2, y2) { dashL(v, x1, y1, x2, y2, 'S-BOLT'); const a = v.P(x1, y1), b = v.P(x2, y2), g = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / PI; v.arrow(x1, y1, g + 180, 'S-BOLT'); v.arrow(x2, y2, g, 'S-BOLT'); }
  // rounded rectangle (fabric cages), radius r in view units
  function rrect(v, x0, y0, x1, y1, r, L) { const P0 = [], arc = (cx, cy, a0) => { for (let i = 0; i <= 4; i++) { const a = (a0 + i * 22.5) * PI / 180; P0.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } }; arc(x1 - r, y0 + r, 270); arc(x1 - r, y1 - r, 0); arc(x0 + r, y1 - r, 90); arc(x0 + r, y0 + r, 180); v.pl(P0, true, L || 'S-REO'); }
  // left / right section markers in a sheet-px view
  function secMkL(v, x, y, ch, len) { const p = v.P(x, y); v.add({ t: 'circle', c: p, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); v.add({ t: 'solid', p: [[p[0] - 1.6, p[1] - 2.5], [p[0] + 1.6, p[1] - 2.5], [p[0], p[1] - 4.6]], L: 'S-TEXT' }); v.add({ t: 'line', a: [p[0] - 3, p[1]], b: [p[0] - 3 - (len || 10), p[1]], L: 'S-TITLE' }); }
  // concrete stipple patch
  const stip = (v, pts) => v.hatch(pts, 'conc', 'S-HATCH', 0.6);

  // ================================================================== PN30-2125 ABUTMENT / WINGWALL PILE REPAIR TYPE 1 (WELDED)
  def('pn2125', 'Abutments', 'Abutment / wingwall pile repair – Type 1 (welded)', 'PN30-2125',
    [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('D', 'Existing pile dia. (mm)', 400, { num: 1 }), P('H', 'Pot depth (mm)', 1250, { num: 1 })], (p) => {
      const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], D = min(max(+p.D || 400, 250), 520), R = D / 2, H = max(+p.H || 1250, 1000), un = secName(p.uc);
      const pc = -100; // pile centre from pot centre (pile face against the sheeting face at -300)
      // ---------------- SECTION B (plan at the base plate), origin = pot centre
      let v = V(B, 20, 205, 204);
      v.rect(-450, -450, 900, 900, 'S-CONC');
      soil(v, 150, 450, -80, 450, -1); soil(v, -150, -450, 120, -450, -1); soil(v, 450, 35, 450, -280, -1); soil(v, -450, 260, -450, 400, -1);
      v.line(-400, -470, -400, 990, 'S-EXIST'); v.line(-300, -470, -300, 990, 'S-EXIST'); tbrk(v, -350, 990, 100, 90);
      v.line(-400, 110, -860, -350, 'S-EXIST'); v.line(-400, -30, -760, -390, 'S-EXIST'); tbrk(v, -820, -380, 141, 225); soil(v, -560, -50, -800, -290, -1);
      v.pl([[-260, 357], [-360, 357], [-360, -343], [-260, -343]], false, 'S-HIDDEN');
      v.fabric(-260, 357, 375, 357, 110); v.fabric(375, 357, 375, -375, 110); v.fabric(375, -375, -260, -375, 110); v.fabric(-260, -375, -260, 357, 110);
      v.line(-45, 370, 145, 370, 'S-REO'); v.line(-45, -388, 145, -388, 'S-REO');
      v.circ(pc, 0, R, 'S-EXIST'); v.rect(pc - 125, -125, 250, 250, 'S-NEW'); iSec(v, pc, 0, s, 90); v.rect(pc - 32, -32, 65, 65, 'S-NEW');
      v.circ(pc, 85, 12, 'S-BOLT'); v.barEnd(pc, 85, 6); v.circ(pc, -85, 12, 'S-HIDDEN');
      v.dim(-300, 450, 450, 450, 21.8, '750'); v.dim(-300, 450, pc - s.d / 2, 450, 8.5, '60 MIN *');
      lab(v, -400, 730, 138, 110.8, 'EXISTING ABUTMENT\nTIMBER SHEETING'); lab(v, -540, -30, 138, 176, 'EXISTING WINGWALL\nTIMBER SHEETING');
      lab(v, -360, -234, 144, 266.8, 'SL81 FABRIC (GALV)\n25 COVER'); lab(v, pc - 10, -30, 161, 296.7, 'SHIM 65x65x THICKNESS\nTO SUIT');
      lab(v, pc + 9, 93, 264, 157.6, 'φ10x100 LONG\nSPIKE (TYP)');
      lab(v, pc + 125, 55, 264, 182.4, '250x12FLx250 BASE PLATE\nWITH 2-φ12 HOLES FOR SPIKES.\nPROVIDE UNIFORM SEATING\nSQUARE TO AXIS OF PILE.\nSHIM BETWEEN BASE PLATE\nAND TIMBER PILE TO ENSURE\nA TIGHT FIT BETWEEN CUT\nPILE AND HALFCAPS');
      weldAt(v, pc + 125, -125, 253, 276.3, { size: 6, all: true, site: true });
      ttl(B, 207, 337, 'SECTION B', 20);
      txt(B, 286, 64.5, '*'); txt(B, 291, 64.5, 'IF LESS THAN 60, THEN RELOCATE SL81\nFABRIC, 4 - N20 VERTICAL BARS AND\nTOP N16 PERIMETER BAR TO INSIDE\nOF FLANGE. TRIM FABRIC TO SUIT.\nPROVIDE φ60 HOLES AT 200 CRS\nVERTICALLY IN WEB FOR N16 AND\nADDITIONAL N12 x 650 LONG BARS.');
      // ---------------- * detail (fabric relocated inside the flange), origin = UC centre
      v = V(B, 20, 495.5, 96);
      iSec(v, 0, 0, s, 90);
      v.fabric(-32, 367, 450, 367, 110); v.fabric(450, 367, 450, -373, 110); v.fabric(450, -373, -32, -373, 110); v.line(-32, -373, -32, 367, 'S-REO');
      [320, 195, -168, -293].forEach(y => v.barEnd(-12, y, 8)); v.line(32, 380, 347, 380, 'S-REO'); v.line(32, -386, 347, -386, 'S-REO'); v.line(-20, -330, -20, 330, 'S-REO');
      lab(v, -5, 5, 520, 36, 'φ60 HOLES AT 200 CRS'); lab(v, -20, -140, 563, 124, 'ADDITIONAL N12 x\n650 LONG BARS.');
      // ---------------- SECTION C (above the pot), origin = front face of the abutment sheeting
      v = V(B, 20, 521, 204);
      v.line(-100, -300, -100, 470, 'S-EXIST'); v.line(0, -300, 0, 470, 'S-EXIST'); v.line(-100, -300, 0, -300, 'S-EXIST'); tbrk(v, -50, 470, 100, 90); soil(v, -100, 100, -100, 460, -1);
      v.line(-100, 60, -560, -400, 'S-EXIST'); v.line(-100, -80, -470, -450, 'S-EXIST'); tbrk(v, -515, -425, 141, 225); soil(v, -360, -200, -540, -380, -1);
      v.rect(0, -160, 100, 320, 'S-NEW'); iSec(v, 100 + s.d / 2, 0, s, 90);
      v.line(-42, 129, 38, 176, 'S-BOLT'); v.line(-42, -129, 38, -176, 'S-BOLT');
      lab(v, -200, -40, 486, 169, 'EXISTING\nTIMBER\nSHEETING'); lab(v, 100 + s.d, 90, 573.5, 174.4, un);
      labs(v, [[38, -176], [100, -150]], 549.6, 248.3, 'PACK WITH SOLID TIMBER FOR FULL\nHEIGHT OF REPLACED TIMBER PILE\nABOVE CONCRETE SURROUND.\nSECURE PACKER TO TIMBER SHEETING');
      ttl(B, 540, 322, 'SECTION C', 20);
      nbox(B, 311, 275.5, 'FULLCAPS SHALL BE PROPPED DURING\nCONSTRUCTION TO THEIR ORIGINAL\nPOSITIONS AND ABUTMENT SHEETING\nIS TO BE SAFELY PROPPED.\nDO NOT REMOVE PROPS UNTIL\nPROPOSED PILE IS IN POSITION AND\nCONCRETE HAS BEEN PLACED A\nMINIMUM OF THREE DAYS.', 168, { solid: true });
      // ---------------- SECTION A (plan in the pile zone), origin = pot centre
      v = V(B, 20, 204, 507);
      v.rect(-450, -450, 900, 900, 'S-CONC'); frect(v, -462, -455, -450, 455);
      soil(v, 160, 450, -40, 450, -1); soil(v, -40, -450, 160, -450, -1); soil(v, 450, 120, 450, -260, -1);
      v.line(-400, 410, -400, 680, 'S-EXIST'); v.line(-300, 410, -300, 680, 'S-EXIST'); v.line(-400, 410, -300, 410, 'S-EXIST'); tbrk(v, -350, 680, 100, 90);
      v.line(-462, 90, -800, -250, 'S-EXIST'); v.line(-462, -50, -700, -290, 'S-EXIST'); tbrk(v, -760, -280, 141, 225); soil(v, -560, -10, -740, -190, -1);
      v.fabric(-361, 366, 379, 366, 110); v.fabric(379, 366, 379, -366, 110); v.fabric(379, -366, -361, -366, 110); v.fabric(-361, -366, -361, 366, 110);
      v.line(-50, 378, 297, 378, 'S-REO'); v.line(-50, -378, 297, -378, 'S-REO');
      v.circ(pc, 0, R, 'S-EXIST'); v.cl(pc - R - 30, 0, pc + R + 30, 0); v.cl(pc, -R - 30, pc, R + 30); v.barEnd(pc, 0, 8);
      v.spike(pc, R + 130, pc, 85); v.spike(pc, -R - 130, pc, -85); v.spike(pc + R + 130, 0, pc + 10, 0);
      [[-243, 203], [-243, -203], [43, 203], [43, -203]].forEach(q => v.barEnd(q[0], q[1], 16)); v.circ(-243, -203, 20, 'S-REO');
      { const ux = -0.576, uy = -0.817, p1 = [pc + ux * R, uy * R], p2 = [-243 - ux * 10, -203 - uy * 10]; v.dim(p1[0], p1[1], p2[0], p2[1], -16, '40', { sub: 'COVER' }); }
      v.dim(-450, -450, 450, -450, -30, '900'); v.dim(450, -450, 450, 450, -18.8, '900'); v.dim(-450, 450, -300, 450, 21.8, '150');
      v.dim(-400, 450, -400, 410, -10.25, '40'); v.dim(-450, 450, -450, 366, -23, '95 CLEAR', { sub: 'COVER' });
      v.line(-300, 690, -300, 1000, 'S-DIM');
      lab(v, -300, 990, 142, 382.6, 'EXTERNAL FACE OF\nEXISTING TIMBER\nSHEETING');
      lab(v, -300, 430, 216, 392.8, 'IF TIMBER SHEETING OCCURS AT\nCONCRETE POT CUT AND KEY-IN\nTIMBER INTO CONCRETE AS SHOWN.\nAPPLIES SECTION (A) ONLY.\n(TYP)');
      lab(v, pc, 0, 123, 489.75, 'EXISTING TIMBER PILE', { dot: true }); lab(v, -243, -203, 126, 507, '4-N20');
      lab(v, -456, -440, 132, 584.2, 'PERMANENT FORMWORK\nTO STABILISE EXCAVATION');
      lab(v, 379, 114, 310, 474.1, 'SL81 FABRIC (TYP) MESH\nCAN BE PREFABRICATED\nIN 2400 LENGTHS AND\nCUT TO SUIT ON SITE'); lab(v, pc + R + 130, 0, 264, 576, 'φ10x250 LONG\nSPIKE (TYP)');
      ttl(B, 198, 646, 'SECTION A', 20);
      // ---------------- ELEVATION, origin = pot centre line / existing G.L.
      v = V(B, 20, 202.5, 774);
      const top = 150, bot = top - H, cut = bot + 750, rear = cut + 112, ucx = pc;
      v.pl([[-300, top + 20], [450, top], [450, bot], [-450, bot], [-450, rear], [-300, rear]], false, 'S-CONC'); frect(v, -462, bot, -450, rear);
      v.line(-450, rear, -462, rear, 'S-CONC');
      v.line(-400, rear, -400, 770, 'S-EXIST'); v.line(-300, rear, -300, 770, 'S-EXIST'); tbrk(v, -350, 770, 100, 90); soil(v, -400, -25, -400, 340, -1);
      iElevWebV(v, ucx, cut + 12, 860, s); tbrk(v, ucx, 860, s.d, 90);
      v.rect(-300, top + 20, ucx - s.d / 2 + 300, 860 - top - 20, 'S-NEW');
      v.rect(ucx - 125, cut, 250, 12, 'S-NEW'); v.line(ucx, cut, ucx, cut - 100, 'S-BOLT');
      pileElev(v, pc, -1690 + (1250 - H) * 0, cut, D); v.cl(pc, cut - 20, pc, -1800);
      v.spike(pc + R + 130, cut - 375 - 140, pc - 20, cut - 375 - 140);
      v.fabric(375, top - 75, 375, bot + 75, 100); v.fabric(-375, cut, -375, bot + 75, 100); v.fabric(-275, top - 25, -275, rear + 20, 100); v.line(-240, cut - 15, -240, bot + 75, 'S-REO');
      [[375, top - 75], [375, cut - 15], [375, bot + 75], [-375, cut - 15], [-375, bot + 75], [-275, top - 75]].forEach(q => barRing(v, q[0], q[1]));
      v.ground(450, 1100, 0); soil(v, 120, bot, 360, bot, -1); v.wl(1460, 0, 'EXISTING G.L.');
      finish(v, 290, top + 7, 'U2');
      v.dim(560, top + 20, 560, top, 0, '20'); v.dim(560, 0, 560, top, -4, '150'); v.dim(1252 - 0, bot, 1252, top, 0, '1250 MIN.');
      v.dim(-450, cut, -450, rear, 14.5, ''); v.text(-450 - 15.5 * 20, cut - 140, '100 MIN', 2.0, 'c', 'b', 'S-DIM', 90); v.dim(-1024, bot, -1024, cut, 0, '750'); v.dimChain([[-755, bot], [-755, bot + 375], [-755, cut]], 0, ['=', '=']);
      v.dim(375, bot, 450, bot, -12, '75 CLEAR COVER', { sub: 'U.O.N. (TYP)' });
      secMk(v, -1435, 537, 'C'); secMk(v, -1435, -323, 'B'); secMk(v, -1435, -812, 'A'); secFlag(v, 1570, 537, 16); secFlag(v, 1550, -323, 16); secFlag(v, 1550, -812, 16);
      lab(v, -250, 600, 130, 696, 'SOLID TIMBER\nPACKER', { dot: true }); lab(v, -350, 390, 143, 734.9, 'EXISTING TIMBER\nSHEETING', { dot: true });
      lab(v, -275, -60, 132, 773.4, 'SL81 FABRIC (GALV)\n25 COVER'); lab(v, ucx + s.d / 2, 555, 229.3, 696, 'PROPOSED ' + un + ' PILE');
      labs(v, [[-275, top - 75], [375, top - 75]], 261.8, 721.2, 'N16 (500 LAP)'); barIcon(B, 311, 726);
      lab(v, ucx + 125, cut + 6, 261.8, 796, 'BASE PLATE');
      labs(v, [[375, cut - 15], [375, bot + 75], [-375, cut - 15], [-375, bot + 75]], 270.5, 858, 'N16\n(500 LAP)'); barIcon(B, 282, 875);
      lab(v, -456, bot + 100, 136, 914, 'PERMANENT\nFORMWORK'); lab(v, -240, bot + 140, 148, 940, '4-N20');
      lab(v, pc + R, -1570, 245.7, 947.3, 'EXISTING TIMBER PILE, CUTBACK\nTO SOUND TIMBER - 250 MIN\nBELOW EXISTING G.L.');
      ttl(B, 190.75, 982, 'ELEVATION');
      nbox(B, 447, 881, 'THIS DETAIL SHALL BE READ IN CONJUNCTION WITH\nTHE STEEL ABUTMENT PILE/TIMBER FULLCAP BEARING\nDETAILS.\n\nPROPOSED PILE & POT SIZE WILL VARY ACCORDING\nTO ENGINEERING REQUIREMENTS INCLUDING HEIGHT OF\nPILE ABOVE GROUND (' + un + ' SHOWN).', 262);
      const rf = mainT(B, 52, 1016, 'ABUTMENT/WINGWALL PILE REPAIR DETAIL - TYPE 1', 'ABUTMENT N° X - PILE N° X', 'sq', { scale: 20 });
      drgBox(B, 445.7, 1034.7, 125, rf);
      nbox(B, 117, 1047.7, 'WELDED OPTION', 128, { h: 3.4 }); nbox(B, 122, 1077, 'ENGINEER SHALL DECIDE WHICH\nOPTION TO USE', 129);
      return B.E;
    }, 'Abutment or wingwall timber pile rotted at ground level: cut back and replace with a UC stub on a welded base plate in a 900 square reinforced concrete pot.');

  // ================================================================== PN30-2126 WINGWALL PILE REPAIR TYPE 1 (UB alongside the pile)
  // View C (detail at the top of the repair member under the sloping capping); variant 1 pile remains, 2 sheeting butts, 3 pile removed
  function viewC(B, dx, dy, variant, mem, mx, tp) {
    const v = FV(B, dx, dy, mx), pf = mem === 'PFC';
    v.line(1620, 2550, 1832, 2550, 'S-EXIST'); v.line(1620, 2605, 1832, 2605, 'S-EXIST'); tbrk(v, 1620, 2577, 55, 90); tbrk(v, 1834, 2577, 55, 90);
    v.line(1615, 2616, 1840, 2616, 'S-EXIST'); v.line(1615, 2611, 1615, 2621, 'S-EXIST'); v.line(1840, 2611, 1840, 2621, 'S-EXIST');
    v.line(1622, 2412, 1834, 2510, 'S-EXIST'); v.line(1622, 2485, 1834, 2583, 'S-EXIST'); v.line(1640, 2430, 1834, 2525, 'S-HIDDEN');
    v.rect(1662.5, 2470, 41.5, 110, 'S-NEW'); v.line(1681.5, 2457.5, 1681.5, 2470, 'S-NEW'); dashL(v, 1681.5, 2470, 1681.5, 2587, 'S-NEW', 1.4, 0.6); tbrk(v, 1683, 2585, 42, 90);
    v.rect(1649, 2460, 13.5, 27.5, 'S-NEW'); v.line(1662.5, 2457.5, 1684, 2457.5, 'S-NEW'); v.line(1655.5, 2465, 1655.5, 2482, 'S-BOLT'); v.arrow(1655.5, 2465, 90, 'S-BOLT'); v.arrow(1655.5, 2482, -90, 'S-BOLT');
    [[1713.5, 2486.5], [1740, 2500]].forEach(q => { v.rect(q[0] - 3.5, q[1] - 3.5, 7, 7, 'S-BOLT'); v.barEnd(q[0], q[1], 2); });
    const xr = variant === 1 ? 1780 : 1790; rodD(v, 1676, 2522.5, xr, 2522.5);
    if (variant >= 2) { v.rect(1750, 2513, 40, 78, 'S-NEW'); v.rect(1794, 2533, 12, 30, 'S-NEW'); v.line(1800, 2537, 1800, 2559, 'S-BOLT'); dV(v, 2506, 2576, 1806, 1877, pf ? '150' : '90'); }
    if (variant !== 3) { v.line(1682.5, 2500, 1682.5, 2637, 'S-EXIST'); v.line(1772.5, 2500, 1772.5, 2637, 'S-EXIST'); v.arc(1727.5, 2470, 52, 210, 330, 'S-EXIST'); v.pileEnd(1727.5, 2637, 90, 'S-EXIST'); }
    else stip(v, [[1705, 2500], [1750, 2500], [1750, 2575], [1705, 2575]]);
    v.cl(1727.5, 2340, 1727.5, 2660); vt(v, 1722, 2330, variant === 3 ? (pf ? '℄ EXISTING\nPILE' : '℄ EXISTING PILE') : '℄ PILE');
    wld(v, 1662, 2458, 1679, 2390, { size: 6, all: true });
    dV(v, 2466, 2493, 1649, 1512, '125'); dV(v, 2466, 2481, 1649, 1562, '25', { sub: '(TYP)' });
    lb(v, 1652, 2460, 1597, 2293, '150x100x10 UA x 125 LONG\nWITH φ12 HOLES AT 75\nCRS FOR 2-M10 x 100 LONG\nCOACH SCREWS' + (pf && variant > 1 ? ' (TYP)' : ''));
    const mp = pf ? (variant === 3 ? 'PROPOSED PFC REPAIR\nWITH CONCRETE INFILL' : 'PROPOSED PFC\nREPAIR (TYP)') : (variant === 3 ? 'PROPOSED UB REPAIR\nWITH CONCRETE INFILL' : variant === 2 ? 'PROPOSED UB\nREPAIR' : 'PROPOSED UB\nREPAIR (TYP)');
    if (variant === 1) lb(v, 1702, 2476, 1807, 2372, mp); else lbs(v, variant === 3 ? [[1702, 2476], [1727, 2540], [1770, 2515]] : [[1702, 2476], [1770, 2515]], 1807, 2372, mp);
    lb(v, 1777, 2484, 1822, 2446, pf && variant === 1 ? 'EXISTING\nTIMBER\nCAPPING' : 'EXISTING TIMBER\nCAPPING'); lb(v, 1645, 2500, 1582, 2541, 'EXISTING TIMBER\nSPIKING RAIL');
    const sub = ['WHERE EXISTING TIMBER PILE ABOVE\nROTTEN SECTION IS TO REMAIN', 'WHERE EXISTING TIMBER SHEETING\nBUTTS AT THE TIMBER PILE REPAIR', 'WHERE EXISTING TIMBER SHEETING BUTTS\nAT THE TIMBER PILE REPAIR & TOP SECTION\nOF TIMBER PILE IS REMOVED'][variant - 1];
    const sb = pf && variant === 2 ? 'WHERE EXISTING TIMBER SHEETING BUTTS\nAT THE TIMBER PILE REPAIR & TOP SECTION\nOF TIMBER PILE REMAINS' : sub;
    ttl(B, F(tp ? tp[0] : 1639 + dx), F(tp ? tp[1] : 2716 + dy), pf ? 'VIEW D' : 'VIEW C', 20, sb, { left: true });
  }
  function wwB1(B, oy, mx, T) {
      const v = FV(B, 0, oy, mx), m = T.m;
      v.line(472.5, 1690, 472.5, 1782.5, 'S-EXIST'); v.line(495, 1690, 495, 1782.5, 'S-EXIST'); tbrk(v, 484, 1690, 23, 90); v.pl([[461, 1772.5], [461, 1782.5], [495, 1782.5]], false, 'S-EXIST');
      v.line(472.5, 1952, 472.5, 1995, 'S-EXIST'); v.line(495, 1952, 495, 1995, 'S-EXIST'); tbrk(v, 484, 1995, 23, 90); v.pl([[461, 1952], [495, 1952]], false, 'S-EXIST');
      v.rect(461, 1772.5, 179, 186.5, 'S-CONC'); soil(v, 461, 1805, 461, 1942, -1); rrect(v, 484, 1792.5, 626.5, 1937.5, 8);
      v.line(517, 1788.5, 595, 1788.5, 'S-REO'); v.line(517, 1941, 595, 1941, 'S-REO');
      { const pts = []; for (let a = 0; a <= 360; a += 6) { const x = 540 + 44 * Math.cos(a * PI / 180), y = 1845 + 44 * Math.sin(a * PI / 180); pts.push([x, min(y, 1882.5)]); } v.pl(pts, true, 'S-EXIST'); }
      { const pts = [[491, 1920], [491, 1842]]; for (let a = 180; a <= 360; a += 15) pts.push([540 + 49 * Math.cos(a * PI / 180), 1842 + 49 * Math.sin(a * PI / 180)]); pts.push([589, 1920]); v.pl(pts, false, 'S-BOLT'); }
      v.rect(495, 1892.5, 100, 23.5, 'S-NEW'); v.line(495, 1886, 495, 1918, 'S-NEW'); v.line(595, 1886, 595, 1918, 'S-NEW');
      [[487.5, 1912.5, 1], [602.5, 1912.5, -1]].forEach(q => { v.pl([[q[0], q[1]], [q[0], q[1] + 13], [q[0] + q[2] * 12, q[1] + 13]], false, 'S-NEW'); });
      [[493, 1920], [592, 1920]].forEach(q => { v.line(q[0] - 5, q[1], q[0] + 5, q[1], 'S-BOLT'); v.line(q[0], q[1] - 5, q[0], q[1] + 5, 'S-BOLT'); });
      stip(v, [[496, 1872], [512, 1872], [512, 1890], [496, 1890]]); stip(v, [[572, 1872], [588, 1872], [588, 1890], [572, 1890]]);
      dHs(v, 461, 495, 1772.5, 1725, '150', true); dH(v, 495, 640, 1772.5, 1725, '650');
      dV(v, 1772.5, 1792.5, 461, 372.5, '95 COVER'); dVs(v, 1772.5, 1782.5, 461, 425, '40', true);
      dV(v, 1772.5, 1805, 640, 700, '150'); dV(v, 1805, 1892.5, 640, 700, 'VARIES'); dV(v, 1892.5, 1959, 640, 700, '300');
      dHs(v, 485.5, 495, 1959, 2015, '30', true); dH(v, 495, 595, 1959, 2015, '440'); dHs(v, 595, 604.5, 1959, 2015, '30'); dH(v, 485.5, 604.5, 1959, 2068, '500');
      if (T.fab3) lb(v, 615, 1790, 630, 1660, 'SL81 FABRIC\n75 COVER\n(TYP)'); else { lb(v, 615, 1790, 630, 1660, 'SL81 FABRIC (TYP)'); lb(v, 624, 1792, 700, 1712, '75 COVER'); } lb(v, 588, 1882, 760, 1815, 'ENSURE CONCRETE\nIN THIS AREA (TYP)');
      lb(v, 589, 1900, 760, 1928, T.rod || "THREADED 'U' ROD"); lb(v, 600, 1926, 712, 2013, '75x75x10 EAx500 LONG\nWELDED TO ' + m + '.\nPROVIDE φ22 HOLES\nFOR THREADED ' + (T.ea || "'U' ROD.\n(TYP)"));
      lb(v, 540, 1880, 415, 1882, 'TRIM EXISTING TIMBER PILE\nTO PROVIDE 75 MIN.\nBEARING FACE WITH WEB\nOF ' + m + '.' + (T.typ ? ' (TYP)' : ''));
      lb(v, 470, 1960, 380, 2010, 'IF TIMBER SHEETING OCCURS\nAT CONCRETE POT CUT\nAND KEY-IN TIMBER INTO\nCONCRETE AS SHOWN.\nAPPLIES SECTION (' + (T.sec || 'B') + ') ONLY.\n(TYP)');
  }
  function wwB2(B, oy, mx, T) {
      const v = FV(B, 0, oy, mx), m = T.m;
      v.line(1327.5, 1640, 1327.5, 1730, 'S-EXIST'); v.line(1347.5, 1640, 1347.5, 1730, 'S-EXIST'); tbrk(v, 1337.5, 1640, 20, 90); v.pl([[1317.5, 1720], [1317.5, 1730], [1347.5, 1730]], false, 'S-EXIST');
      v.line(1327.5, 1932.5, 1327.5, 1975, 'S-EXIST'); v.line(1350, 1932.5, 1350, 1975, 'S-EXIST'); tbrk(v, 1338.5, 1975, 22, 90); v.line(1317.5, 1932.5, 1350, 1932.5, 'S-EXIST');
      v.rect(1317.5, 1720, 177.5, 220, 'S-CONC'); soil(v, 1315, 1750, 1315, 1900, -1); rrect(v, 1337.5, 1741, 1477.5, 1907.5, 8);
      v.line(1372.5, 1738, 1445, 1738, 'S-REO'); v.line(1372.5, 1911, 1445, 1911, 'S-REO');
      v.rect(1350, 1755, 92.5, 31, 'S-NEW'); v.rect(1350, 1872.5, 92.5, 27.5, 'S-NEW');
      v.circ(1395, 1830, 46, 'S-EXIST'); [[1344, 1755], [1445, 1755], [1344, 1900], [1445, 1900]].forEach(q => { v.line(q[0] - 5, q[1], q[0] + 5, q[1], 'S-BOLT'); v.line(q[0], q[1] - 5, q[0], q[1] + 5, 'S-BOLT'); });
      dashL(v, 1344, 1758, 1344, 1897, 'S-BOLT'); dashL(v, 1445, 1758, 1445, 1897, 'S-BOLT');
      [[1352, 1792], [1424, 1792], [1352, 1858], [1424, 1858]].forEach(q => stip(v, [[q[0], q[1]], [q[0] + 16, q[1]], [q[0] + 16, q[1] + 12], [q[0], q[1] + 12]]));
      dHs(v, 1317.5, 1347.5, 1720, 1675, '150', true); dH(v, 1347.5, 1495, 1720, 1675, '650');
      dV(v, 1720, 1741, 1317.5, 1213, '95 COVER'); dVs(v, 1720, 1730, 1317.5, 1233, '40', true);
      dV(v, 1720, 1786, 1495, 1555, '300'); dV(v, 1786, 1872.5, 1495, 1555, 'VARIES'); dV(v, 1872.5, 1940, 1495, 1555, '300');
      dHs(v, 1339, 1350, 1940, 2002.5, '30', true); dH(v, 1350, 1442.5, 1940, 2002.5, '440'); dHs(v, 1442.5, 1452.5, 1940, 2002.5, '30'); dH(v, 1339, 1452.5, 1940, 2050, '500');
      if (T.fab3) lb(v, 1445, 1741, 1493, 1612, 'SL81 FABRIC\n75 COVER\n(TYP)'); else { lb(v, 1445, 1741, 1493, 1612, 'SL81 FABRIC (TYP)'); lb(v, 1477.5, 1745, 1538, 1660, '75 COVER'); } lb(v, 1436, 1862, 1603, 1798, 'ENSURE CONCRETE\nIN THIS AREA (TYP)');
      lb(v, 1445, 1882, 1603, 1910, T.rod2 || "THREADED 'U' ROD"); lb(v, 1452.5, 1902.5, 1573, 1995, '75x75x10 EAx500 LONG\nWELDED TO ' + m + '.\nPROVIDE φ22 HOLES\nFOR THREADED ROD.\n(TYP)');
      lb(v, 1395, 1868, 1300, 1815, 'TRIM EXISTING TIMBER\nPILE TO PROVIDE 75 MIN.\nBEARING FACE WITH WEB\nOF ' + m + '. (TYP)');
      lb(v, 1317.5, 1935, 1285, 1963, 'IF TIMBER SHEETING OCCURS\nAT CONCRETE POT CUT\nAND KEY-IN TIMBER INTO\nCONCRETE AS SHOWN.\nAPPLIES SECTION (' + (T.sec || 'B') + ') ONLY.\n(TYP)');
  }
  def('pn2126', 'Wing walls', 'Wingwall pile repair – Type 1 (UB alongside the pile)', 'PN30-2126', [P('ub', 'Repair UB', '410UB54', { opts: ['410UB54', '360UB51', '460UB67'] })], (p) => {
    const B = new Builder(), un = secName(p.ub);
    // ---- SECTION A (4 variants)
    const secA = (oy, pile) => {
      const v = FV(B, 0, oy);
      v.line(470, 255, 470, 495, 'S-EXIST'); v.line(490, 255, 490, 495, 'S-EXIST'); tbrk(v, 480, 252, 20, 90); tbrk(v, 480, 498, 20, 90); soil(v, 470, 312, 470, 452, -1);
      v.rect(495, 275, 145, 220, 'S-CONC'); rrect(v, 512, 292, 625, 452, 10);
      v.line(497, 380, 497, 420, 'S-NEW'); v.line(497, 400, 583, 400, 'S-NEW'); v.line(583, 380, 583, 420, 'S-NEW');
      if (pile) { v.circ(540, 362, 45, 'S-EXIST'); rodD(v, 540, 312, 540, 410); lb(v, 535, 350, 430, 335, 'φ20 THREADED RODS WITH\n1-65x5FLx65 WASHER ABOVE\nCONCRETE POT (TYP)'); lb(v, 585, 375, 685, 398, 'EXISTING TIMBER\nPILE'); }
      lb(v, 625, pile ? 340 : 325, 685, pile ? 322 : 312, 'SL81 FABRIC'); lb(v, 588, 420, 685, pile ? 478 : 440, 'PROPOSED UB\nREPAIR');
      ttl(B, F(485), F(oy + 578), 'SECTION A', 20, 'WHERE EXISTING TIMBER PILE ABOVE\nROTTEN SECTION IS TO ' + (pile ? 'REMAIN' : 'BE REMOVED'), { left: true });
    };
    secA(502, false); secA(952, true);
    const secA2 = (oy, pile) => {
      const v = FV(B, 0, oy);
      v.line(1322, 642, 1322, 885, 'S-EXIST'); v.line(1346, 642, 1346, 885, 'S-EXIST'); tbrk(v, 1334, 640, 24, 90); tbrk(v, 1334, 927, 24, 90); v.line(1322, 885, 1322, 927, 'S-EXIST'); v.line(1346, 885, 1346, 927, 'S-EXIST');
      v.rect(1346, 669, 146, 218, 'S-CONC'); v.pl([[1364, 724], [1364, 689], [1476, 689], [1476, 872], [1364, 872], [1364, 827]], false, 'S-REO');
      [737, 823].forEach(y => { v.line(1346, y, 1434, y, 'S-NEW'); v.line(1434, y - 20, 1434, y + 15, 'S-NEW'); });
      if (pile) { v.circ(1394, 777, 44, 'S-EXIST'); rodD(v, 1394, 727, 1394, 828); }
      else { v.line(1399, 741, 1399, 814, 'S-REO'); rodD(v, 1392.6, 728, 1392.6, 829); stip(v, [[1352, 757], [1386, 757], [1386, 801], [1352, 801]]); v.pl([[1453, 774], [1440, 788], [1453, 802]], false, 'S-TEXT'); vt(v, 1457, 795, '3'); }
      lb(v, 1392, 734, 1292, 672, 'φ20 THREADED RODS\nABOVE CONCRETE\nPOT (TYP)'); lb(v, 1346, 782, 1250, 842, 'EXISTING TIMBER\nSHEETING BUTTS');
      lb(v, 1476, 802, 1542, 820 + (pile ? -95 : 0), 'SL81 FABRIC'); lb(v, 1434, 838, 1542, 890, 'PROPOSED UB\nREPAIR (TYP)');
      if (pile) lb(v, 1438, 780, 1542, 800, 'EXISTING TIMBER\nPILE');
      else { lb(v, 1412, 747, 1439, 560, 'CONCRETE ABOVE CONCRETE POT, TOP OF\nCONCRETE TO HAVE U3 FINISH. CONCRETE\nTO BE POURED A MINIMUM OF 1 DAY AFTER\nPOT REPAIR.'); lb(v, 1399, 800, 1542, 697, 'SL81 FABRIC (ABOVE\nCONCRETE POT) EMBEDDED\n300 INTO PILE POT'); }
      ttl(B, F(1322), F(oy + 994), 'SECTION A', 20, 'WHERE EXISTING TIMBER SHEETING BUTTS\nAT THE TIMBER PILE REPAIR & TOP SECTION\nOF TIMBER PILE ' + (pile ? 'REMAINS' : 'IS REMOVED'), { left: true });
    };
    secA2(0, false); secA2(490, true);
    // ---- SECTION B (2 variants)
    wwB1(B, 0, null, { m: 'UB' }); ttl(B, F(470), F(2165), 'SECTION B', 20, null, { left: true });
    nbox(B, F(80), F(1710), 'PROPOSED UB REPAIR\nSHALL BE PLACED ON\nTHE HIGHER SIDE OF\nWINGWALL PILE', F(240), { solid: true });
    wwB2(B, 0, null, { m: 'UB' }); ttl(B, F(1438), F(2150), 'SECTION B', 20, 'WHERE EXISTING TIMBER SHEETING\nBUTTS AT THE TIMBER PILE REPAIR', { left: true });
    nbox(B, F(835), F(2170), 'ENSURE WINGWALL SHEETING IS\nSAFELY PROPPED.\nDO NOT REMOVE PROPS UNTIL\nPROPOSED PILE IS IN POSITION &\nCONCRETE HAS BEEN PLACED A\nMINIMUM OF 3 DAYS.', F(362), { solid: true });
    // ---- ELEVATION (crop coordinates, origin offset 2199)
    {
      const v = FV(B, 0, 2199);
      v.line(465, 130, 465, 595, 'S-EXIST'); soil(v, 465, 455, 465, 585, -1); tbrk(v, 465, 128, 12, 90);
      v.line(478, 130, 478, 370, 'S-HIDDEN'); v.line(560, 225, 560, 370, 'S-HIDDEN'); v.line(478, 130, 497, 130, 'S-HIDDEN');
      v.pl([[497, 370], [497, 148], [540, 148], [582, 160], [582, 370]], false, 'S-NEW'); v.pl([[497, 405], [497, 780], [582, 780], [582, 405]], false, 'S-NEW');
      tbrk(v, 539.5, 370, 85, 90); tbrk(v, 539.5, 405, 85, 90); tbrk(v, 478, 370, 30, 90);
      timberX(v, 497, 152, 23, 60); v.rect(520, 150, 20, 30, 'S-NEW');
      [[540, 215], [540, 350], [540, 448]].forEach(q => { v.line(q[0] - 7, q[1], q[0] + 7, q[1], 'S-BOLT'); v.line(q[0], q[1] - 7, q[0], q[1] + 7, 'S-BOLT'); v.barEnd(q[0], q[1], 4); });
      v.pl([[582, 462], [628, 462], [640, 474], [640, 800], [460, 800], [460, 590], [497, 590]], false, 'S-CONC'); frect(v, 455, 590, 460, 800);
      v.fabric(625, 480, 625, 785, 28); barRing(v, 625, 610); barRing(v, 625, 780); stip(v, [[598, 482], [614, 482], [614, 500], [598, 500]]); stip(v, [[593, 697], [609, 697], [609, 715], [593, 715]]);
      [632, 745].forEach(y => { v.rect(485, y, 115, 13, 'S-NEW'); v.rect(485, y - 3, 10, 19, 'S-BOLT'); v.rect(590, y - 3, 10, 19, 'S-BOLT'); });
      v.line(497, 607, 497, 865, 'S-EXIST'); v.line(585, 607, 585, 865, 'S-EXIST'); v.pileEnd(541, 865, 88, 'S-EXIST'); v.line(497, 607, 585, 607, 'S-HIDDEN');
      v.ground(640, 900, -(497 + 2199) * 0 + 497); v.pl([[652, 592], [662, 585], [662, 600], [652, 592]], false, 'S-TEXT'); vt(v, 666, 600, '4');
      finish(v, 606, 462, 'U2'); vt(v, 600, 418, '2%'); v.line(600, 422, 660, 422, 'S-TEXT'); v.arrow(660, 422, 0);
      secFlag(v, 355, 520, 14, true); secFlag(v, 355, 650, 14, true); secMkL(v, 1095, 517, 'A', 10); secMkL(v, 1095, 640, 'B', 10);
      v.mark(695, 180, 'C', 200);
      dH(v, 497, 535, 150, 45, '175'); dH(v, 535, 571, 150, 70, '298'); dHs(v, 520, 525, 150, 98, '5 GAP', true); dV(v, 150, 160, 540, 553, '10');
      dH(v, 540, 590, 215, 248, '100'); dV(v, 215, 350, 497, 435, "600 (TYP)", { sub: "IF 'h' > 1500" });
      dV(v, 127, 462, 640, 755, "'h'"); dV(v, 405, 462, 640, 705, '50'); dV(v, 462, 497, 640, 815, '150'); dV(v, 470, 800, 640, 1005, '1500 MIN.'); dV(v, 775, 800, 640, 850, '100');
      dV(v, 590, 607, 460, 345, '100', { sub: 'MIN' }); dV(v, 607, 640, 460, 395, '150'); dV(v, 640, 752, 460, 410, '500', { sub: 'MIN' }); dV(v, 752, 800, 460, 395, '100');
      dH(v, 625, 640, 800, 852, '75 CLEAR', { sub: 'COVER (TYP)' }); dH(v, 463, 497, 800, 910, '150');
      vt(v, 640, 168, '15°'); v.line(590, 128, 640, 165, 'S-DIM');
      lb(v, 510, 185, 378, 140, 'RETAIN EXISTING SPIKING\nRAIL (REPLACE IF REQUIRED\nWITH SAME SIZE).\nNOTCH UB PILE TO SUIT.'); lb(v, 565, 292, 620, 265, un, { dot: true });
      lb(v, 465, 432, 400, 432, 'EXISTING TIMBER\nSHEETING'); lb(v, 555, 607, 690, 541, 'WHERE NOTED ABOVE\nCUTBACK PILE TO SOUND\nTIMBER - 250 MIN BELOW\nEXISTING GROUND LEVEL');
      lbs(v, [[625, 610], [625, 780]], 695, 662, 'N16, 500 LAP\nTOP & BOTTOM'); barIcon(B, F(865), F(2199 + 670)); lb(v, 625, 700, 695, 738, 'SL81 FABRIC');
      lb(v, 460, 735, 370, 745, 'PERMANENT\nFORMWORK'); lb(v, 553, 758, 370, 862, '75x75x10 EA\nx500 LONG'); lb(v, 565, 758, 620, 920, "THREADED 'U' ROD OR 2-THREADED\nRODS SEE SECTIONS (A) & (B) (TYP)");
      vt(v, 812, 203, "IF 'h' < 1500 -"); vt(v, 962, 203, 'a)'); vt(v, 1002, 203, 'REMOVE EXISTING TIMBER PILE\nABOVE ROTTEN SECTION OR'); vt(v, 962, 253, 'b)'); vt(v, 1002, 253, 'WHERE EXISTING TIMBER SHEETING\nBUTTS AT THE TIMBER PILE REPAIR\nEXISTING TIMBER PILE ABOVE\nROTTEN SECTION SHALL REMAIN.');
      vt(v, 812, 377, "IF 'h' > 1500 -"); vt(v, 1002, 377, 'EXISTING TIMBER PILE ABOVE\nROTTEN SECTION SHALL REMAIN.');
      ttl(B, F(488), F(2199 + 990), 'ELEVATION', null, null, { left: true });
      const rf = mainT(B, F(360), F(2199 + 1075), 'WINGWALL PILE REPAIR DETAIL - TYPE 1', 'ABUTMENT N° X - PILE N° X', 'none', { scale: 20 });
      drgBox(B, F(665), F(2199 + 960), F(280), rf);
    }
    viewC(B, 0, 0, 1, 'UB'); viewC(B, -180, 535, 2, 'UB'); viewC(B, 460, 532, 3, 'UB');
    return B.E;
  }, 'Wingwall timber pile rotted at ground level: a UB placed on the higher side of the pile is cast into a reinforced concrete pot and fixed to the pile / spiking rail.');

  // ================================================================== PN30-2127 WINGWALL PILE REPAIR TYPE 2 (pile retained, anchor strap)
  def('pn2127', 'Wing walls', 'Wingwall pile repair – Type 2 (pile retained in pot, anchor strap)', 'PN30-2127', [], (p) => {
    const B = new Builder();
    { // SECTION A
      const v = FV(B, 200, 550);
      v.line(370, 332, 870, 332, 'S-EXIST'); v.line(370, 376, 548, 376, 'S-EXIST'); v.line(548, 376, 870, 376, 'S-HIDDEN'); v.line(870, 332, 870, 376, 'S-EXIST'); tbrk(v, 375, 354, 44, 90 + 90);
      soil(v, 485, 332, 710, 332, 1); v.rect(515, 332, 328, 281, 'S-CONC'); v.line(548, 230, 548, 332, 'S-DIM');
      v.circ(680, 450, 72, 'S-EXIST'); v.circ(680, 450, 37, 'S-EXIST'); v.hatch(ringPts(37, 72).map(q => [680 + q[0], 450 + q[1]]), 'ansi31', 'S-HATCH');
      rrect(v, 548, 405, 600, 580, 10); rrect(v, 760, 405, 815, 580, 10);
      { const pts = [[607, 578], [607, 452]]; for (let a = 180; a <= 360; a += 15) pts.push([680 + 72.5 * Math.cos(a * PI / 180), 452 + 72.5 * Math.sin(a * PI / 180)]); pts.push([753, 578]); v.pl(pts, false, 'S-NEW'); }
      dashL(v, 600, 562, 760, 562, 'S-BOLT'); [[597, 562], [765, 562]].forEach(q => { v.line(q[0] - 7, q[1], q[0] + 7, q[1], 'S-BOLT'); v.line(q[0], q[1] - 7, q[0], q[1] + 7, 'S-BOLT'); });
      v.line(610, 578, 625, 578, 'S-NEW'); v.line(735, 578, 750, 578, 'S-NEW');
      stip(v, [[558, 450], [592, 450], [592, 500], [558, 500]]); stip(v, [[765, 505], [805, 505], [805, 560], [765, 560]]);
      dH(v, 548, 870, 332, 78, 'SECTION OF', { sub: 'TIMBER SHEETING' }); vt(v, 709, 116, 'TO BE REMOVED', 2.0, 'c', 'S-DIM');
      dHs(v, 515, 548, 332, 242, '90'); dV(v, 376, 613, 515, 432, '650'); dH(v, 515, 843, 613, 715, '900');
      lb(v, 430, 332, 375, 218, 'EXISTING TIMBER\nSHEETING'); lb(v, 700, 400, 800, 218, 'MIN. 100 ANNULAR\nSOLID TIMBER'); lb(v, 758, 495, 930, 420, 'ANCHOR STRAP\nREFER DETAIL');
      lb(v, 730, 515, 930, 560, 'EXISTING PILE'); lb(v, 818, 583, 930, 650, 'SL81 FABRIC'); lb(v, 585, 565, 450, 690, 'φ20 THREADED ROD');
      ttl(B, F(740), F(550 + 845), 'SECTION A', 20, null, { left: true });
    }
    { // SECTION B
      const v = FV(B, 1350, 550);
      v.line(395, 327, 852, 327, 'S-EXIST'); v.line(852, 327, 852, 412, 'S-EXIST'); v.line(270, 372, 497, 372, 'S-EXIST'); v.line(497, 372, 825, 372, 'S-HIDDEN'); v.line(825, 372, 852, 372, 'S-EXIST');
      v.line(270, 412, 497, 412, 'S-EXIST'); v.line(497, 412, 852, 412, 'S-CONC'); tbrk(v, 395, 350, 46, 180); tbrk(v, 270, 392, 40, 180); soil(v, 465, 327, 690, 327, 1);
      v.line(497, 372, 497, 412, 'S-HIDDEN'); v.line(825, 372, 825, 412, 'S-HIDDEN'); v.pl([[497, 412], [497, 608], [825, 608], [825, 412]], false, 'S-CONC');
      v.circ(660, 445, 72, 'S-HIDDEN');
      v.pl([[520, 425], [520, 562], [533, 575], [782, 575], [795, 562], [795, 425]], false, 'S-REO');
      v.fabric(520, 470, 520, 560, 30); v.fabric(540, 575, 780, 575, 30); v.fabric(795, 560, 795, 440, 30);
      stip(v, [[540, 440], [575, 440], [575, 495], [540, 495]]); stip(v, [[745, 500], [790, 500], [790, 560], [745, 560]]);
      dVs(v, 412, 427, 862, 940, '40', true);
      lb(v, 350, 372, 285, 215, 'EXISTING\nSPIKING\nRAIL'); lb(v, 760, 327, 845, 170, 'EXISTING TIMBER\nSHEETING'); lb(v, 518, 425, 430, 490, 'TRIM FABRIC\nTO SUIT (TYP)');
      lb(v, 650, 518, 565, 688, 'EXISTING PILE'); lb(v, 800, 575, 905, 650, 'SL81 FABRIC');
      ttl(B, F(1350 + 525), F(550 + 840), 'SECTION B', 20, null, { left: true });
    }
    { // ELEVATION
      const v = FV(B, 0, 1450);
      v.line(553, 160, 553, 1040, 'S-EXIST'); [375, 770].forEach(y => v.pl([[548, y - 4], [558, y], [548, y + 4]], false, 'S-EXIST'));
      [310, 390, 470, 550, 630, 790, 950, 1030].forEach(y => { const xs = 553; v.line(xs, y, 1072, y, 'S-EXIST'); });
      v.line(1072, 430, 1072, 860, 'S-HIDDEN'); v.line(1072, 945, 1072, 1025, 'S-HIDDEN'); v.line(1045, 860, 1072, 860, 'S-HIDDEN'); v.line(1045, 945, 1072, 945, 'S-HIDDEN');
      v.line(553, 178, 1072, 432, 'S-EXIST'); v.line(553, 205, 1072, 460, 'S-EXIST'); v.line(553, 295, 1072, 550, 'S-HIDDEN');
      v.pl([[720, 1078], [720, 285], [1045, 444], [1045, 1078]], true, 'S-CONC');
      v.pl([[745, 320], [745, 1060], [1020, 1060], [1020, 452]], false, 'S-REO'); v.fabric(745, 330, 745, 1050, 40); v.fabric(1020, 460, 1020, 1050, 40);
      v.pl([[810, 1140], [810, 460], [955, 460], [955, 1140]], false, 'S-HIDDEN'); v.pileEnd(882.5, 1140, 145, 'S-EXIST'); v.cl(882, 110, 882, 1160);
      v.rect(808, 878, 147, 37, 'S-HIDDEN'); dashL(v, 800, 897, 965, 897, 'S-BOLT'); [[800, 897], [965, 897]].forEach(q => { v.line(q[0] - 7, q[1], q[0] + 7, q[1], 'S-BOLT'); v.line(q[0], q[1] - 7, q[0], q[1] + 7, 'S-BOLT'); });
      stip(v, [[778, 580], [828, 580], [828, 630], [778, 630]]);
      v.ground(450, 720, 722); v.ground(1045, 1220, 722); v.wl(1150, 722, 'NATURAL G.L.');
      finish(v, 850, 330, 'U2'); [[575, '2'], [800, '4']].forEach(q => { v.pl([[1065, q[0]], [1050, q[0] + 13], [1065, q[0] + 26]], false, 'S-TEXT'); vt(v, 1066, q[0] + 22, q[1]); });
      secMk(v, 350, 195, 'B', 0); v.line(380, 195, 525, 225, 'S-TITLE'); secMk(v, 105, 905, 'A', 14);
      v.pl([[1100, 510], [1160, 540], [1305, 540]], false, 'S-TITLE'); v.add({ t: 'solid', p: [v.P(1235, 540), v.P(1305, 540), v.P(1270, 560)], L: 'S-TEXT' });
      v.line(1160, 893, 1305, 893, 'S-TITLE'); v.add({ t: 'solid', p: [v.P(1235, 893), v.P(1305, 893), v.P(1270, 913)], L: 'S-TEXT' });
      dV(v, 335, 890, 900, 1425, ''); ["'H' (1500 MAX) - IF 'H' EXCEEDS", '1500 THEN WINGWALL PILE REPAIR', 'DETAIL - TYPE 1, TO BE USED', 'WITH THE ENGINEERS APPROVAL'].forEach((l, i) => { const p = v.P(1418 + i * 40, 612); v.add({ t: 'text', p, s: l, h: 2.2, al: 'c', v: 'b', ang: 90, L: 'S-DIM' }); });
      v.line(1330, 890, 1440, 890, 'S-DIM');
      dVs(v, 862, 898, 320, 500, '100'); dV(v, 898, 1078, 720, 500, '500 MIN'); dV(v, 862, 1255, 320, 348, 'MIN. 100 ANNULAR', { sub: 'SOLID TIMBER' }); v.line(320, 862, 1060, 862, 'S-DIM');
      dH(v, 720, 745, 1078, 1178, ''); vt(v, 532, 1165, '75 CLEAR\nCOVER\n(TYP)');
      lb(v, 605, 195, 570, 82, 'EXISTING TIMBER\nCAPPING'); lb(v, 605, 275, 495, 295, 'EXISTING TIMBER\nSPIKING RAIL', { dot: true }); lb(v, 750, 345, 485, 430, 'TRIM FABRIC TO\nCLEAR EXISTING\nSPIKING RAIL (TYP)');
      lb(v, 745, 588, 495, 615, 'SL81 FABRIC'); lb(v, 928, 460, 1028, 200, 'CUT BACK TOP OF PILE.\n100 MIN. CONCRETE COVER'); lb(v, 1065, 918, 1135, 968, 'REMOVE SECTION OF\nTIMBER SHEETING\nAT ANCHOR STRAP\nLOCATION');
      vt(v, 875, 135, '℄ PILE'); ttl(B, F(808), F(1450 + 1262), 'ELEVATION', null, null, { left: true });
      vt(v, 575, 1342, 'EXTENT OF DETERIORATED TIMBER\nPILE (SHALL BE DETERMINED ON\nSITE BY DRILLING)');
      const rf = mainT(B, F(510), F(1450 + 1520), 'WINGWALL PILE REPAIR DETAIL - TYPE 2', 'ABUTMENT N° X - PILE N° X', 'none', { scale: 20 });
      drgBox(B, F(1656), F(2743), F(490), rf);
    }
    { // ANCHOR STRAP DETAIL 1:10
      const v = FV(B, 1550, 1500);
      const pts = [[352, 130], [352, 95], [615, 95]]; for (let a = -90; a <= 90; a += 10) pts.push([615 + 145 * Math.cos(a * PI / 180), 240 + 145 * Math.sin(a * PI / 180)]); pts.push([352, 385], [352, 350]); v.pl(pts, false, 'S-NEW');
      v.line(388, 45, 388, 135, 'S-CL'); v.line(388, 345, 388, 435, 'S-CL');
      dV(v, 95, 385, 352, 165, 'TO SUIT PILE', { sub: 'DIAMETER' }); dVs(v, 95, 130, 352, 275, '50 (TYP)', true); dH(v, 352, 755, 385, 482, '550');
      lb(v, 735, 150, 790, 100, '100x5FL\nANCHOR\nSTRAP'); ttl(B, F(1550 + 558), F(1500 + 528), 'PLAN');
      v.rect(352, 592, 403, 71, 'S-NEW'); v.circ(388, 628, 8, 'S-NEW'); v.line(388, 570, 388, 690, 'S-CL'); v.line(300, 628, 420, 628, 'S-CL');
      dV(v, 592, 628, 352, 312, ''); dV(v, 628, 663, 352, 312, ''); [610, 646].forEach(y => { const q = v.P(312, y); v.add({ t: 'text', p: [q[0] - 2.5, q[1]], s: '=', h: 2.0, al: 'c', v: 'm', ang: 90, L: 'S-DIM' }); }); dVs(v, 592, 663, 755, 805, '100', true);
      dH(v, 352, 388, 663, 765, ''); vt(v, 433, 755, '50', 2.0, 'c', 'S-DIM'); vt(v, 450, 795, '(TYP)', 2.0, 'c', 'S-DIM');
      lb(v, 395, 635, 515, 738, 'φ24 HOLE'); ttl(B, F(1550 + 545), F(1500 + 893), 'ELEVATION');
      ttl(B, F(1550 + 295), F(1500 + 975), 'ANCHOR STRAP DETAIL', '1:10', null, { left: true, h: 3.6 });
    }
    return B.E;
  }, 'Wingwall pile with at least 100 mm of sound annular timber and H ≤ 1500: pile retained, cut back and encased in a 900 x 650 reinforced pot tied back with an anchor strap.');

  // ================================================================== PN30-2128 WINGWALL PILE REPAIR TYPE 3 (300 PFC alongside the pile)
  def('pn2128', 'Wing walls', 'Wingwall pile repair – Type 3 (1 or 2 – 300 PFC alongside the pile)', 'PN30-2128', [], (p) => {
    const B = new Builder(), pfc = (v, x0, x1, y, up) => v.pl([[x0, y + (up ? -12 : 12)], [x0, y], [x1, y], [x1, y + (up ? -12 : 12)]], false, 'S-NEW');
    const sheet = (v, x, y0, y1) => { v.line(x, y0, x, y1, 'S-EXIST'); v.line(x + 22, y0, x + 22, y1, 'S-EXIST'); tbrk(v, x + 11, y0, 22, 90); tbrk(v, x + 11, y1, 22, 90); };
    const nut = (v, x, y) => { v.line(x - 6, y, x + 6, y, 'S-BOLT'); v.line(x, y - 6, x, y + 6, 'S-BOLT'); v.barEnd(x, y, 3); };
    { // small sections (C, B) where the sheeting does not butt / butts
      let v = FV(B, 0, 550);
      v.rect(538, 277, 142, 185, 'S-CONC'); sheet(v, 682, 235, 495); v.circ(636, 370, 44, 'S-EXIST'); pfc(v, 615, 680, 402, false); v.arc(636, 370, 52, 55, 125, 'S-NEW'); rodD(v, 636, 305, 636, 402); nut(v, 636, 402);
      v.cl(636, 160, 636, 270); vt(v, 630, 177, '℄ EXISTING TIMBER\n   PILE');
      lb(v, 615, 315, 565, 222, 'CURVED WASHER. REFER\nDRG N° 9530-0072'); lb(v, 592, 355, 490, 355, 'EXISTING TIMBER\nPILE'); lb(v, 612, 409, 510, 409, 'PROPOSED 300 PFC\nREPAIR');
      lb(v, 645, 337, 745, 337, 'φ20 THREADED ROD\nAT 600 CRS VERTICAL'); lb(v, 707, 455, 745, 455, 'EXISTING TIMBER\nSHEETING');
      ttl(B, F(522), F(550 + 562), 'SECTION C', 20, 'WHERE EXISTING TIMBER SHEET DOES\nNOT BUTT AT THE TIMBER PILE REPAIR.', { left: true });
      v.rect(538, 710, 142, 185, 'S-CONC'); sheet(v, 682, 668, 930); rrect(v, 555, 727, 665, 877, 8); v.fabric(555, 745, 555, 860, 30); v.circ(636, 780, 44, 'S-EXIST'); pfc(v, 615, 680, 830, false);
      stip(v, [[565, 738], [595, 738], [595, 765], [565, 765]]); stip(v, [[565, 812], [595, 812], [595, 838], [565, 838]]);
      lb(v, 555, 740, 460, 740, 'SL81 FABRIC'); lb(v, 592, 787, 455, 787, 'EXISTING TIMBER\nPILE'); lb(v, 612, 838, 510, 842, 'PROPOSED 300 PFC REPAIR\nSHALL BE PLACED ON THE\nHIGHER SIDE OF WINGWALL\nPILE'); lb(v, 707, 888, 745, 888, 'EXISTING TIMBER\nSHEETING');
      ttl(B, F(522), F(550 + 997), 'SECTION B', 20, 'WHERE EXISTING TIMBER SHEET DOES\nNOT BUTT AT THE TIMBER PILE REPAIR.', { left: true });
      v = FV(B, 1000, 550);
      v.rect(365, 155, 140, 217, 'S-CONC'); sheet(v, 507, 120, 410); v.circ(463, 265, 45, 'S-EXIST'); pfc(v, 440, 505, 212, true); pfc(v, 440, 505, 320, false); rodD(v, 463, 212, 463, 320); nut(v, 463, 212); nut(v, 463, 320);
      v.cl(463, 70, 463, 170); vt(v, 457, 87, '℄ EXISTING TIMBER\n   PILE');
      lb(v, 425, 230, 320, 193, 'EXISTING TIMBER\nPILE'); lb(v, 455, 265, 340, 283, 'φ20 THREADED ROD\nAT 600 CRS VERTICAL'); lb(v, 445, 325, 305, 380, 'PROPOSED 300 PFC\nREPAIR (TYP)'); lb(v, 515, 265, 555, 335, 'EXISTING TIMBER\nSHEETING BUTTS');
      ttl(B, F(1345), F(550 + 470), 'SECTION C', 20, 'WHERE EXISTING TIMBER SHEETING BUTTS\nAT THE TIMBER PILE REPAIR & TOP SECTION\nOF TIMBER PILE REMAINS', { left: true });
      v.rect(1095, 150, 145, 218, 'S-CONC'); sheet(v, 1240, 115, 405); pfc(v, 1170, 1240, 212, true); pfc(v, 1170, 1240, 318, false); v.line(1190, 225, 1190, 300, 'S-REO'); rodD(v, 1196, 212, 1196, 318); nut(v, 1196, 212); nut(v, 1196, 318);
      stip(v, [[1200, 225], [1235, 225], [1235, 265], [1200, 265]]); v.cl(1192, 60, 1192, 150); vt(v, 1186, 77, '℄ EXISTING TIMBER\n   PILE');
      lb(v, 1225, 228, 1090, 78, "CONCRETE ABOVE CONCRETE POT, TOP OF\nCONCRETE TO HAVE U3 FINISH AND  PROFILE\nTO MATCH PFC's. CONCRETE TO POURED A\nMINIMUM OF 1 DAY AFTER POT REPAIR.");
      lb(v, 1190, 270, 1045, 237, 'SL81 FABRIC (ABOVE\nCONCRETE POT)\nEMBEDDED 300 INTO\nPILE POT'); lb(v, 1175, 322, 1035, 377, 'PROPOSED 300 PFC\nREPAIR (TYP)');
      lb(v, 1250, 260, 1335, 180, 'EXISTING TIMBER\nSHEETING BUTTS'); lb(v, 1205, 272, 1305, 275, 'φ20 THREADED ROD\nAT 600 CRS VERTICAL'); lb(v, 1262, 362, 1305, 362, 'EXISTING TIMBER\nSHEETING');
      ttl(B, F(2078), F(550 + 468), 'SECTION C', 20, 'WHERE EXISTING TIMBER SHEETING BUTTS\nAT THE TIMBER PILE REPAIR & TOP SECTION\nOF TIMBER PILE IS REMOVED', { left: true });
      v.rect(365, 638, 140, 217, 'S-CONC'); sheet(v, 507, 598, 890); rrect(v, 380, 655, 495, 838, 8); v.circ(463, 745, 45, 'S-EXIST'); pfc(v, 440, 505, 698, true); pfc(v, 440, 505, 795, false);
      stip(v, [[390, 700], [420, 700], [420, 725], [390, 725]]); stip(v, [[390, 770], [420, 770], [420, 795], [390, 795]]);
      lb(v, 380, 687, 318, 687, 'SL81 FABRIC'); lb(v, 420, 745, 322, 735, 'EXISTING TIMBER\nPILE'); lb(v, 440, 800, 340, 800, 'PROPOSED 300 PFC\nREPAIR (TYP)'); lb(v, 530, 847, 570, 847, 'EXISTING TIMBER\nSHEETING');
      ttl(B, F(1345), F(550 + 950), 'SECTION B', 20, 'WHERE EXISTING TIMBER SHEETING BUTTS\nAT THE TIMBER PILE REPAIR', { left: true });
    }
    // SECTION A (mirror of the Type 1 pot sections, PFC instead of UB)
    wwB1(B, -9, 1180, { m: 'PFC', sec: 'A', fab3: true, rod: "φ20 THREADED 'U' ROD", ea: 'ROD.', typ: true });
    ttl(B, F(522), F(2155), 'SECTION A', 20, 'WHERE EXISTING TIMBER SHEET DOES\nNOT BUTT AT THE TIMBER PILE REPAIR.', { left: true });
    wwB2(B, 10, 2863, { m: 'PFC', sec: 'A', fab3: true, rod2: 'THREADED ROD\n(TYP)' });
    ttl(B, F(1348), F(2155), 'SECTION A', 20, 'WHERE EXISTING TIMBER SHEET BUTTS\nAT THE TIMBER PILE REPAIR.', { left: true });
    nbox(B, F(75), F(2125), 'ENSURE WINGWALL SHEETING IS\nADEQUATELY PROPPED.\nDO NOT REMOVE PROPS UNTIL\nPROPOSED PFC REPAIR IS IN\nPOSITION AND CONCRETE HAS BEEN\nPLACED A MINIMUM OF 3 DAYS.', F(360), { solid: true });
    nbox(B, F(1105), F(2270), 'NOTE: PFC PILE SIZE WILL VARY\nACCORDING TO ENGINEERING\nREQUIREMENTS', F(490), { h: 3.0 });
    { const tb = new Builder(); tb.table(0, 0, [{ n: 'WITHOUT SURCHARGE', w: 41 }, { n: "'h' MAX", w: 28 }], [['1 - 300 PFC', '≤ 3000'], ['2 - 300 PFC', '≤ 4000'], ['WITH 20 kPa SURCHARGE', "'h' MAX"], ['1 - 300 PFC', '≤ 2500'], ['2 - 300 PFC', '≤ 3500']]); tb.E.forEach(e => { A.shiftE(e, X(F(1133)), Y(F(2425))); if (e.t === 'text' && /SURCHARGE|'h' MAX/.test(e.s)) e.L = 'S-TITLE'; }); B.E.push(...tb.E); }
    ttl(B, F(1120), F(2668), 'MAXIMUM HEIGHT OF PFC WINGWALL PILE REPAIR', null, null, { left: true, h: 2.4 });
    { // ELEVATION
      const v = FV(B, 0, 2250);
      v.line(595, 135, 595, 398, 'S-EXIST'); v.line(700, 135, 700, 398, 'S-EXIST'); v.pileEnd(647.5, 400, 105, 'S-EXIST'); v.line(595, 445, 595, 930, 'S-EXIST'); v.line(700, 445, 700, 930, 'S-EXIST'); v.pileEnd(647.5, 443, 105, 'S-EXIST'); v.pileEnd(647.5, 932, 105, 'S-EXIST');
      v.line(708, 130, 708, 640, 'S-EXIST'); tbrk(v, 708, 128, 14, 90);
      v.pl([[618, 375], [618, 158], [660, 152], [685, 152], [685, 375]], false, 'S-NEW'); v.pl([[618, 475], [618, 825], [685, 825], [685, 475]], false, 'S-NEW'); tbrk(v, 651.5, 375, 67, 90); tbrk(v, 651.5, 475, 67, 90);
      timberX(v, 662, 160, 23, 55); v.rect(642, 160, 20, 25, 'S-NEW');
      [[640, 222], [640, 352], [640, 515]].forEach(q => nut(v, q[0], q[1]));
      v.pl([[618, 540], [555, 540], [540, 555], [540, 868], [718, 868], [718, 640], [685, 640]], false, 'S-CONC'); frect(v, 718, 640, 724, 868);
      v.fabric(555, 560, 555, 845, 28); barRing(v, 555, 655); barRing(v, 555, 840); stip(v, [[562, 552], [582, 552], [582, 572], [562, 572]]); stip(v, [[572, 760], [592, 760], [592, 780], [572, 780]]);
      [683, 795].forEach(y => { v.rect(585, y, 105, 13, 'S-NEW'); v.rect(583, y - 3, 10, 19, 'S-BOLT'); v.rect(682, y - 3, 10, 19, 'S-BOLT'); });
      v.line(595, 655, 700, 655, 'S-HIDDEN'); v.ground(290, 540, 578); v.ground(700, 910, 158);
      finish(v, 575, 540, 'U2'); vt(v, 562, 485, '2%'); v.line(530, 490, 590, 490, 'S-TEXT'); v.arrow(530, 490, 180);
      v.pl([[532, 660], [520, 672], [532, 684]], false, 'S-TEXT'); vt(v, 514, 680, '4', TH, 'r');
      [488, 605, 685].forEach(y => secFlag(v, 440, y, 14, true)); [['C', 485], ['B', 602], ['A', 680]].forEach(q => { secMk(v, 905, q[1], q[0], 0); v.line(840, q[1], 885, q[1], 'S-TITLE'); });
      v.mark(455, 187, 'D', 0);
      { const a = v.P(465, 340); B.E.push({ t: 'pl', p: [[a[0] - 1, a[1] - 1.6], [a[0] + 16, a[1] - 1.6], [a[0] + 16, a[1] + 3.4], [a[0] - 1, a[1] + 3.4]], closed: true, L: 'S-TEXT' }); B.E.push({ t: 'text', p: [a[0] + 0.5, a[1]], s: '300 PFC', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); const b = v.P(635, 302); B.E.push({ t: 'line', a: [a[0] + 16, a[1] + 1], b, L: 'S-TEXT' }); B.E.push({ t: 'circle', c: b, r: 0.45, L: 'S-TEXT' }); }
      dH(v, 640, 685, 155, 45, '175'); dHs(v, 635, 640, 155, 98, '5 GAP', true); dVs(v, 150, 160, 618, 600, '10'); vt(v, 520, 178, '15°'); v.line(533, 182, 578, 196, 'S-DIM');
      dH(v, 578, 618, 215, 265, '100'); dV(v, 222, 375, 685, 750, "IF 'h' > 1500", { sub: '600 (TYP)' });
      dV(v, 158, 540, 540, 272, "'h' MAXIMUM", { sub: '(REFER TABLE)' }); v.line(700, 158, 910, 158, 'S-DIM'); dV(v, 540, 868, 540, 272, '1500 MIN.');
      dV(v, 540, 578, 540, 462, '150'); dV(v, 490, 540, 555, 505, '50');
      dV(v, 555, 655, 718, 790, '100', { sub: 'MIN' }); dV(v, 655, 690, 718, 770, '150'); dV(v, 690, 800, 718, 790, '500', { sub: 'MIN' }); dV(v, 825, 868, 718, 770, '100'); dV(v, 825, 868, 540, 438, '100', { sub: 'MIN' });
      dH(v, 540, 555, 868, 945, ''); vt(v, 470, 925, '75 CLEAR\nCOVER (TYP)'); dHs(v, 685, 718, 868, 960, '150');
      lb(v, 670, 190, 790, 58, 'RETAIN EXISTING SPIKING\nRAIL (REPLACE IF REQUIRED\nWITH SAME SIZE).\nNOTCH PFC PILE TO SUIT.'); lb(v, 708, 532, 765, 532, 'EXISTING TIMBER\nSHEETING');
      lb(v, 645, 655, 500, 635, 'LIMIT OF SOUND\nTIMBER'); lb(v, 555, 745, 460, 716, 'SL81 FABRIC'); lbs(v, [[555, 655], [555, 840]], 505, 765, 'N16, 500 LAP\nTOP & BOTTOM'); barIcon(B, F(300), F(2250 + 785));
      lb(v, 724, 810, 815, 810, 'PERMANENT\nFORMWORK'); lb(v, 600, 805, 815, 902, '75x75x10 EA\nx 500 LONG\n(TYP)'); lb(v, 617, 808, 560, 985, "4-THREADED RODS OR\n2-THREADED 'U' RODS\nSEE SECTIONS (A)");
      ttl(B, F(588), F(2250 + 1055), 'ELEVATION', null, null, { left: true });
      const rf = mainT(B, F(390), F(2250 + 1098), 'WINGWALL PILE REPAIR DETAIL - TYPE 3', 'ABUTMENT N° X - PILE N° X', 'otri', { scale: 20 });
      drgBox(B, F(1058), F(2250 + 1110), F(265), rf);
    }
    viewC(B, 0, 470.5, 1, 'PFC', 3007.5, [1238, 3190]); viewC(B, 0, -99.5, 3, 'PFC', 3739.5, [1968, 2622]); viewC(B, 0, 510.5, 2, 'PFC', 3739.5, [1968, 3230]);
    return B.E;
  }, 'Wingwall pile repair with 1 or 2 – 300 PFC on the higher side of the pile, rodded at 600 crs and cast into a reinforced pot; h limited by the table (with / without 20 kPa surcharge).');

  // ================================================================== PN30-2129 ABUTMENT PILE RESTRAINT
  def('prs', 'Abutments', 'Abutment pile restraint (headroom > 1750, no overlay)', 'PN30-2129', [P('uc', 'Steel pile', '200UC52', { opts: UCs })], (p) => {
    const B = new Builder(), un = secName(p.uc), v = FV(B, 150, 1700), o = { h: 3.0 };
    v.pl([[300, 845], [300, 450], [975, 450]], false, 'S-EXIST'); v.line(300, 522, 1090, 522, 'S-EXIST'); [435, 570, 705, 840, 972].forEach(x => v.line(x, 450, x, 522, 'S-HIDDEN'));
    v.pl([[985, 430], [985, 480], [960, 492], [1035, 478], [985, 500], [985, 530]], false, 'S-TEXT');
    v.line(345, 522, 345, 660, 'S-HIDDEN'); [660, 790].forEach(y => v.line(300, y, 345, y, 'S-EXIST'));
    v.pl([[345, 845], [345, 570], [530, 570], [530, 845]], false, 'S-NEW'); v.line(405, 570, 405, 845, 'S-NEW'); v.line(410, 570, 410, 845, 'S-NEW'); v.line(522, 570, 522, 845, 'S-NEW');
    v.pl([[275, 848], [305, 848], [318, 812], [330, 888], [345, 848], [360, 848], [372, 812], [384, 888], [398, 848], [450, 848], [462, 812], [474, 888], [486, 848], [552, 848]], false, 'S-TEXT');
    v.pl([[525, 645], [525, 540], [530, 528], [540, 522], [650, 522], [650, 535], [544, 535], [537, 542], [537, 645]], true, 'S-NEW');
    v.spike(598, 535, 598, 465); v.line(492, 600, 552, 600, 'S-BOLT'); v.nut(537, 600, 1, 0, 14); v.rect(503, 592, 12, 16, 'S-BOLT');
    v.line(415, 745, 630, 745, 'S-HIDDEN'); v.pl([[630, 745], [795, 800], [1090, 800]], false, 'S-EXIST');
    { const L = []; for (let a = -90; a <= 90; a += 12) L.push([1090 + 45 * Math.cos(a * PI / 180), 591 + 69 * Math.sin(a * PI / 180)]); v.pl(L, false, 'S-EXIST'); const M = []; for (let a = -90; a <= 90; a += 12) M.push([1090 + 45 * Math.cos(a * PI / 180), 731 + 69 * Math.sin(a * PI / 180)]); v.pl(M, false, 'S-EXIST'); const N = []; for (let a = 90; a <= 270; a += 12) N.push([1090 + 45 * Math.cos(a * PI / 180), 591 + 69 * Math.sin(a * PI / 180)]); v.pl(N, false, 'S-EXIST'); }
    v.line(545, 575, 760, 575, 'S-CL'); v.line(570, 645, 760, 645, 'S-DIM'); vt(v, 768, 600, '℄ SLOTTED\n   HOLE', 2.6);
    v.line(130, 522, 300, 522, 'S-DIM'); v.line(130, 570, 345, 570, 'S-DIM');
    dVs(v, 522, 570, 300, 155, '75 MAX', true); dVs(v, 570, 600, 345, 380, '50'); dVs(v, 575, 645, 560, 730, '100', true);
    lb(v, 518, 487, 325, 195, 'EXISTING\nTIMBER\nDECK', Object.assign({ dot: true }, o)); lbs(v, [[600, 465], [650, 528]], 770, 97, '200x200x13 EA x250 LONG\nWITH 2-M10 x 75 LONG\nCOACH SCREWS AT 175 CRS\nAND 2-φ18x75 LONG SLOTTED\nHOLES FOR M16 BOLTS', o);
    lb(v, 1035, 693, 1200, 478, 'EXISTING TIMBER\nSTRINGER', Object.assign({ dot: true }, o)); lb(v, 550, 615, 720, 940, '2-M16 BOLTS AT\nGAUGE OF UC PILE', o);
    const rf = mainT(B, F(377), F(2875), 'ABUTMENT PILE RESTRAINT DETAIL', 'ABUTMENT N° X - PILE N° X', 'none', { scale: 20, h: 4.2 });
    nbox(B, F(534), F(1027), 'PROPOSED PILE SIZE WILL\nVARY ACCORDING TO\nENGINEERING REQUIREMENTS.\n' + un + ' PILE DRAWN\n\nFULLCAP DETAILS NOT SHOWN\nREFER TO RELEVANT SECTION.', F(858), { h: 3.8 });
    drgBox(B, F(1640), F(2595), F(738), rf, { h: 3.6 }); nbox(B, F(540), F(3236), 'HEADROOM EXCEEDS 1750 &\nNO OVERLAY', F(810), { h: 3.8 });
    return B.E;
  }, 'Restrains the top of a steel abutment pile to the timber deck with a 200x200x13 EA cleat where headroom exceeds 1750 and there is no concrete overlay.');

  // ================================================================== PN30-2130 PILE SPLICE (driven steel pile)
  // weld symbol helpers for the splice details: bevel / double-bevel butt symbols on a reference line with a site flag
  function buttRef(v, ax, ay, kx, ky, len, dbl) {
    const a = v.P(ax, ay), b = v.P(kx, ky), c = [b[0] + len, b[1]], g = Math.atan2(a[1] - b[1], a[0] - b[0]); v.add({ t: 'pl', p: [a, b, c], closed: false, L: 'S-TEXT' });
    v.add({ t: 'solid', p: [a, [a[0] - 2.4 * Math.cos(g) - 0.8 * Math.sin(g), a[1] - 2.4 * Math.sin(g) + 0.8 * Math.cos(g)], [a[0] - 2.4 * Math.cos(g) + 0.8 * Math.sin(g), a[1] - 2.4 * Math.sin(g) - 0.8 * Math.cos(g)]], L: 'S-TEXT' });
    v.add({ t: 'line', a: b, b: [b[0], b[1] + 7.5], L: 'S-TEXT' }); v.add({ t: 'solid', p: [[b[0], b[1] + 7.5], [b[0], b[1] + 4.5], [b[0] + 2.8, b[1] + 6]], L: 'S-TEXT' });
    const sx = b[0] + 15; v.add({ t: 'line', a: [sx, b[1]], b: [sx, b[1] - 4.5], L: 'S-TEXT' }); v.add({ t: 'line', a: [sx, b[1]], b: [sx + 4.5, b[1] - 4.5], L: 'S-TEXT' });
    if (dbl) { v.add({ t: 'line', a: [sx, b[1]], b: [sx, b[1] + 4.5], L: 'S-TEXT' }); v.add({ t: 'line', a: [sx, b[1]], b: [sx + 4.5, b[1] + 4.5], L: 'S-TEXT' }); }
  }
  const zig = (v, x0, x1, y, xm, L) => v.pl([[x0, y], [xm - 8, y], [xm - 2, y - 55], [xm + 6, y + 50], [xm + 10, y], [x1, y]], false, L || 'S-TEXT');
  def('dsp', 'Piles', 'Driven steel pile – butt splice', 'PN30-2130', [P('uc', 'Driven pile', '200UC52', { opts: UCs }), P('set', 'Min. set (blows / 250 mm)', 'XX', {}), P('kJ', 'Energy per blow (kJ)', 'XX', {})], (p) => {
    const B = new Builder(), un = secName(p.uc);
    { // SECTION A (web) and DETAIL 1 (flange), N.T.S.
      const v = FV(B, 150, 100);
      v.pl([[280, 120], [280, 645], [300, 645], [490, 458], [490, 120]], false, 'S-NEW'); zig(v, 245, 525, 120, 385); v.line(300, 405, 300, 645, 'S-NEW');
      v.pl([[278, 912], [278, 670], [487, 670], [487, 912]], false, 'S-NEW'); zig(v, 240, 520, 912, 380);
      dHs(v, 280, 300, 405, 428, '2', true); v.arc(370, 645, 105, 0, 45, 'S-DIM'); v.arrow(470, 645, -90, 'S-DIM'); v.arrow(445, 571, 135, 'S-DIM'); vt(v, 470, 585, '45°');
      v.line(445, 645, 697, 645, 'S-DIM'); v.line(505, 670, 697, 670, 'S-DIM'); dVs(v, 645, 670, 697, 672, '2');
      lb(v, 490, 270, 605, 270, 'WEB', { noArrow: false }); buttRef(v, 370, 585, 578, 842, 37, false);
      v.pl([[1105, 128], [1105, 492], [1262, 650], [1280, 650], [1437, 492], [1437, 128]], false, 'S-NEW'); zig(v, 1070, 1473, 128, 1265); v.line(1262, 415, 1262, 640, 'S-NEW'); v.line(1280, 415, 1280, 640, 'S-NEW');
      v.pl([[1100, 913], [1100, 673], [1435, 673], [1435, 913]], false, 'S-NEW'); zig(v, 1065, 1468, 913, 1275);
      dHs(v, 1262, 1280, 415, 437, '2'); v.arc(1255, 650, 170, 135, 180, 'S-DIM'); v.arrow(1085, 650, -90, 'S-DIM'); v.arrow(1135, 530, 45, 'S-DIM'); vt(v, 1010, 585, '45°');
      v.line(1060, 650, 1240, 650, 'S-DIM'); v.line(1425, 650, 1755, 650, 'S-DIM'); v.line(1450, 673, 1755, 673, 'S-DIM'); dVs(v, 650, 673, 1755, 1730, '2');
      lb(v, 1437, 300, 1570, 300, 'FLANGE\n(TYP)'); buttRef(v, 1348, 590, 1593, 963, 37, true);
      ttl(B, F(150 + 200), F(100 + 1140), 'SECTION A', 'N.T.S.', null, { left: true, h: 4 }); ttl(B, F(150 + 1080), F(100 + 1140), 'DETAIL 1', 'N.T.S.', null, { left: true, h: 4 });
    }
    { // PILE SPLICE elevation 1:10
      const v = FV(B, 0, 0);
      [[1601, 2213.5], [2224.5, 2712], [2802, 3134]].forEach(r => { v.line(805, r[0], 805, r[1], 'S-NEW'); v.line(1045, r[0], 1045, r[1], 'S-NEW'); v.line(819.5, r[0], 819.5, r[1], 'S-NEW'); v.line(1031, r[0], 1031, r[1], 'S-NEW'); });
      v.pl([[805, 2213.5], [812, 2219], [1038, 2219], [1045, 2213.5]], false, 'S-NEW'); v.line(805, 2224.5, 1045, 2224.5, 'S-NEW'); v.line(805, 3134, 1045, 3134, 'S-NEW');
      zig(v, 794, 1065, 1601, 929); zig(v, 786, 1058, 2712, 924); zig(v, 786, 1058, 2802, 924); v.line(929.5, 1476, 929.5, 3187, 'S-CL');
      v.line(904, 1900, 904, 2130, 'S-TITLE'); v.add({ t: 'solid', p: [v.P(907, 1898), v.P(907, 2010), v.P(938, 1955)], L: 'S-TEXT' });
      v.line(904, 2290, 904, 2406, 'S-TITLE'); { const c = v.P(904, 2463); v.add({ t: 'circle', c, r: 3.6, L: 'S-TEXT' }); v.add({ t: 'text', p: c, s: 'A', h: 3.6, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); v.add({ t: 'solid', p: [[c[0] + 3.4, c[1] + 1.8], [c[0] + 3.4, c[1] - 1.8], [c[0] + 5.6, c[1]]], L: 'S-TEXT' }); }
      v.circ(1031, 2213.5, 93.5, 'S-TEXT'); v.line(1105, 2153, 1303, 2041, 'S-TEXT'); { const c = v.P(1351, 1981); v.add({ t: 'circle', c, r: 3.6, L: 'S-TEXT' }); v.add({ t: 'text', p: c, s: '1', h: 3.6, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
      v.line(233, 2219, 790, 2219, 'S-TEXT'); vt(v, 239, 2185, 'PILE SPLICE', 3.2); vt(v, 311, 2268, '(TYP)', 3.2); v.line(1061, 2213.5, 1617, 2213.5, 'S-DIM');
      dV(v, 1601, 2219, 805, 583, ''); [['(X GALVANISED', 545], ['LENGTH OF PILE)', 627]].forEach(q => { const c = v.P(q[1], 1910); v.add({ t: 'text', p: c, s: q[0], h: 3.0, al: 'c', v: 'b', ang: 90, L: 'S-DIM' }); });
      dV(v, 2219, 3134, 805, 583, ''); [['X', 545, 2680], ['(BLACK)', 627, 2680]].forEach(q => { const c = v.P(q[1], q[2]); v.add({ t: 'text', p: c, s: q[0], h: 3.0, al: 'c', v: 'b', ang: 90, L: 'S-DIM' }); });
      v.pl([[583, 2880], [560, 2885], [600, 2895], [583, 2900]], false, 'S-DIM');
      dV(v, 1700, 2213.5, 1504, 1595, ''); { const c = v.P(1560, 1945); v.add({ t: 'text', p: c, s: '≥ 3000', h: 3.0, al: 'c', v: 'b', ang: 90, L: 'S-DIM' }); } v.pl([[1595, 2100], [1575, 2105], [1615, 2115], [1595, 2120]], false, 'S-DIM');
      v.line(1504, 1700, 2073, 1700, 'S-GROUND'); soil(v, 2045, 1700, 1683, 1700, -1); v.wl(1672, 1700, 'GROUND LEVEL');
      v.line(1061, 3134, 1468, 3134, 'S-DIM'); v.line(555, 3134, 786, 3134, 'S-DIM'); v.wl(1320, 3134, 'PILE TOE R.L.');
      lb(v, 1045, 2448, 1218, 2448, ''); { const a = v.P(1218, 2408), b = v.P(1515, 2488); B.E.push({ t: 'pl', p: [a, [b[0], a[1]], b, [a[0], b[1]]], closed: true, L: 'S-NOTE' }); B.E.push({ t: 'text', p: [a[0] + 2, b[1] + 3.6], s: un, h: 3.4, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); B.E.push({ t: 'text', p: [a[0] + 2, b[1] - 4], s: 'DRIVEN PILE', h: 3.4, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
      nbox(B, F(1706), F(2156), 'NOTE: PILE SIZE WILL VARY\nACCORDING TO ENGINEERING\nREQUIREMENTS.\n' + un + ' PILE DRAWN', F(672), { h: 3.4 }); B.E.push({ t: 'line', a: v.P(1706, 2296), b: v.P(1515, 2440), L: 'S-NOTE' });
      ttl(B, F(889), F(3336), 'PILE SPLICE', 10, null, { left: true, h: 4 });
    }
    return B.E;
  }, 'Full-penetration butt splice of a driven steel UC pile, at least 3000 below ground; galvanised length above the splice, black below (see pile driving notes PN30-2131).');

  // ================================================================== PN30-2131 PILE DRIVING NOTES
  def('pn2131', 'Piles', 'Pile driving notes (driven steel piles)', 'PN30-2131', [P('set', 'Min. set (blows / 250 mm)', 'XX', {}), P('kJ', 'Hammer energy (kJ / blow)', 'XX', {})], (p) => {
    const B = new Builder(), h = 3.0, x0 = X(F(130)), y0 = Y(F(1610)), L = [];
    const box = (x, y, t) => { const w = t.length * h * 0.7 + 1.2; B.E.push({ t: 'pl', p: [[x - 0.6, y - 1], [x + w, y - 1], [x + w, y + h + 0.8], [x - 0.6, y + h + 0.8]], closed: true, L: 'S-NOTE' }); B.E.push({ t: 'text', p: [x, y], s: t, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); return w; };
    B.E.push({ t: 'text', p: [x0, y0], s: 'PILE DRIVING NOTES', h: 4.2, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); B.E.push({ t: 'line', a: [x0, y0 - 1.4], b: [x0 + 18 * 4.2 * 0.7, y0 - 1.4], L: 'S-TITLE' });
    const T = (n, x, lines) => { let y = L.length ? L[L.length - 1] : y0 - 4; lines.forEach((l, i) => { y -= (i ? h * 1.75 : h * 2.4); if (!i && n) B.E.push({ t: 'text', p: [x0, y], s: n, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); if (l) B.E.push({ t: 'text', p: [x0 + x, y], s: l, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }); L.push(y); return y; };
    T('1.', 8, ['ALL WORKS SHALL BE CARRIED OUT IN ACCORDANCE WITH THE SPECIFICATION.']);
    T('2.', 8, ['PILE DRIVING TOLERANCES SHALL BE:-']);
    T('', 16, ['a)  DEVIATION FROM VERTICAL IN A 3 METRE TEMPLATE ±15mm.']); L[L.length - 1] += h * 0.65; T('', 16, ['b)  DEVIATION FROM PLAN POSITION 50mm IN ANY DIRECTION.']); L[L.length - 1] += h * 0.65; T('', 16, ['c)  MAXIMUM VARIATION FROM SPECIFIED CUT OFF LEVEL ±5mm.']);
    T('3.', 8, ['WHERE PILES ARE DRIVEN WITH A DIESEL HAMMER - THE DRIVING HELMET', 'INTERNAL DIAMETER SHALL NOT EXCEED THE PILE SIZE BY MORE THAN 20mm.']);
    T('4.', 8, ["PILES MUST BE DRIVEN TO A REQUIRED SET TO BE DETERMINED ON SITE", "USING THE 'HILEY' FORMULA AND BY CONSIDERING THE TEMPORARY COMPRESSION."]);
    const y5 = T('5.', 8, ['ONE REPRESENTATIVE TEMPORARY COMPRESSION GRAPH MUST BE TAKEN FOR', 'EACH GROUP OF SIMILAR PILES (-i.e. PILES OF SIMILAR SIZE) AT']);
    { const s1 = 'EACH GROUP OF SIMILAR PILES (-i.e. PILES OF SIMILAR SIZE) AT ', xs = x0 + 8 + s1.length * h * 0.68; B.E.push({ t: 'text', p: [xs, y5], s: 'FINAL SET.', h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); B.E.push({ t: 'line', a: [xs, y5 - 0.9], b: [xs + 9.5 * h * 0.7, y5 - 0.9], L: 'S-TEXT' }); }
    T('6.', 8, ['ALL STEEL PILING TO 3 METRES BELOW GROUND LEVEL AND UP TO TOP OF PILES', 'SHALL BE HOT DIP GALVANISED IN ACCORDANCE WITH AS/NZS 4680. ALL PILING', 'BURIED MORE THAN 3 METRES BELOW GROUND MAY BE LEFT BLACK (UNTREATED).']);
    const y7 = T('7.', 8, ['', 'OF A PILE DRIVING UNIT (HAMMER RATED ENERGY OF', 'ON THE RESULTS REQUIRED FOR 3 & 4 - TO BE CONFIRMED ONCE TEMPORARY', 'COMPRESSION GRAPHS REQUIRED IN 4 HAVE BEEN SUBMITTED TO THE DESIGN', 'ENGINEER.']);
    { const yA = y7 + 4 * h * 1.75, yB = yA - h * 1.75; let x = x0 + 8; const t1 = 'ANTICIPATED MINIMUM SET REQUIREMENTS ARE APPROXIMATELY '; B.E.push({ t: 'text', p: [x, yA], s: t1, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); x += t1.length * h * 0.7 + 1.5; x += box(x, yA, String(p.set)) + 0.8; B.E.push({ t: 'text', p: [x, yA], s: 'BLOWS/250mm', h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
      x = x0 + 8 + 'OF A PILE DRIVING UNIT (HAMMER RATED ENERGY OF '.length * h * 0.7; x += box(x, yB, String(p.kJ)) + 0.8; B.E.push({ t: 'text', p: [x, yB], s: 'kJ PER BLOW) DEPENDING', h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
    { const yy = y7 - h * 3.2; box(x0 + 8, yy, 'XX'); B.E.push({ t: 'text', p: [x0 + 22, yy], s: 'ENGINEER TO CONFIRM FROM DESIGN.', h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
    return B.E;
  }, 'Driving tolerances, hammer helmet, Hiley set, temporary compression graphs and galvanising requirements for driven steel piles; the anticipated set and hammer energy are entered by the designer.');

  // ================================================================== PN30-2132 PIER PILE / TIMBER HALFCAP BEARING (driven steel pile)
  const xmark = (v, x, y, r) => { r = r || 7; v.line(x - r, y, x + r, y, 'S-BOLT'); v.line(x, y - r, x, y + r, 'S-BOLT'); v.circ(x, y, r * 0.45, 'S-BOLT'); };
  def('pn2132', 'Halfcaps', 'Pier pile / timber halfcap bearing – driven steel pile', 'PN30-2132', [P('uc', 'Driven pile', '200UC52', { opts: UCs })], (p) => {
    const B = new Builder(), un = secName(p.uc);
    { // SECTION C 1:10 and DETAIL 1 1:10
      const v = FV(B, 350, 450);
      v.rect(208, 158, 304, 130, 'S-NEW'); v.rect(207, 446, 303, 128, 'S-NEW');
      [[215, 283, 270], [437, 505, 450]].forEach(q => { v.rect(q[0], 177, q[1] - q[0], 380, 'S-HIDDEN'); v.line(q[2], 177, q[2], 557, 'S-HIDDEN'); });
      [213, 275, 437, 505].forEach(x => v.line(x, 288, x, 446, 'S-NEW'));
      v.pl([[283, 295], [437, 295], [437, 303], [362, 303], [362, 429], [437, 429], [437, 437], [283, 437], [283, 429], [355, 429], [355, 303], [283, 303]], true, 'S-NEW');
      dH(v, 207, 510, 574, 685, '400');
      lb(v, 507, 375, 630, 298, '2-250 PFC\nx 500 LONG'); lb(v, 512, 480, 630, 527, '2-400x170x16PL');
      ttl(B, F(350 + 240), F(450 + 830), 'SECTION C', 10, null, { left: true, h: 3.6 });
      // DETAIL 1
      v.line(278, 962, 278, 1040, 'S-NEW'); v.line(433, 962, 433, 1040, 'S-NEW'); v.line(278, 1040, 278, 1147, 'S-HIDDEN'); v.line(433, 1040, 433, 1147, 'S-HIDDEN'); v.line(278, 1147, 278, 1493, 'S-NEW'); v.line(433, 1147, 433, 1493, 'S-NEW');
      v.line(351, 962, 351, 1493, 'S-HIDDEN'); v.line(357, 962, 357, 1493, 'S-HIDDEN'); zig(v, 265, 450, 962, 355, 'S-TEXT'); zig(v, 265, 450, 1493, 355, 'S-TEXT');
      v.line(0, 1040, 555, 1040, 'S-EXIST'); v.line(0, 1147, 540, 1147, 'S-EXIST'); tbrk(v, 540, 1093, 107, 0);
      v.rect(205, 1147, 302, 13, 'S-NEW');
      [[1, 278], [-1, 433]].forEach(([k, x]) => { v.pl([[x, 1160], [x - k * 53, 1160], [x - k * 53, 1172], [x - k * 15, 1172], [x - k * 15, 1323], [x - k * 68, 1323], [x - k * 68, 1335], [x, 1335]], true, 'S-NEW'); v.rect(min(x, x - k * 70), 1337, 70, 13, 'S-NEW'); });
      { const a = v.P(205, 1160), b = v.P(45, 1270); v.add({ t: 'line', a: b, b: v.P(240, 1162), L: 'S-TEXT' }); } wld(v, 205, 1160, 45, 1270, { size: 4, site: true, tail: 'TYP' });
      wld(v, 275, 1357, 45, 1478, { size: 8, site: true, tail: 'TYP' }); wld(v, 283, 1320, 530, 1473, { size: 8, site: true, tail: 'TYP' });
      v.add({ t: 'solid', p: [v.P(240, 1162), v.P(232, 1170), v.P(229, 1164)], L: 'S-TEXT' });
      secFlag(v, 580, 1153, 24); secMk(v, -237, 1150, 'C', 14);
      ttl(B, F(350 + 240), F(450 + 1630), 'DETAIL 1', 10, null, { left: true, h: 3.6 });
    }
    nbox(B, F(1400), F(1085), 'PROPOSED PILE SIZE WILL\nVARY ACCORDING TO\nENGINEERING REQUIREMENTS.\n' + un + ' PILE DRAWN', F(495), { h: 3.2 });
    { // SECTION B 1:20 and VIEW A 1:20
      const v = FV(B, 1250, 1050);
      [[532, 597], [652, 717]].forEach(q => { v.line(305, q[0], 548, q[0], 'S-EXIST'); v.line(305, q[1], 548, q[1], 'S-EXIST'); tbrk(v, 305, (q[0] + q[1]) / 2, 65, 90 + 0); tbrk(v, 550, (q[0] + q[1]) / 2, 65, 90); });
      v.fill([[447, 587], [525, 587], [525, 594], [447, 594]]); v.fill([[447, 657], [525, 657], [525, 664], [447, 664]]); v.fill([[482, 594], [488, 594], [488, 657], [482, 657]]);
      [460, 512].forEach(x => { dashL(v, x, 515, x, 735, 'S-BOLT', 1.0, 0.5); [522, 597, 655, 725].forEach(y => xmark(v, x, y, 7)); });
      lb(v, 520, 525, 640, 437, 'EXISTING TIMBER\nHALFCAP'); lb(v, 500, 600, 640, 675, 'NOTCH BOTH HALFCAPS\nEQUALLY TO SUIT');
      ttl(B, F(1250 + 290), F(1050 + 905), 'SECTION B', 20, null, { left: true, h: 3.6 });
      // VIEW A
      v.cl(485, 1075, 485, 2000); vt(v, 478, 1095, '℄ PROPOSED\n   DRIVEN PILE', 2.6);
      v.line(530, 1220, 845, 1220, 'S-EXIST'); v.line(530, 1265, 845, 1265, 'S-EXIST'); tbrk(v, 530, 1242, 45, 90); tbrk(v, 845, 1242, 45, 90);
      v.pl(ellP(705, 1335, 95, 70, 36).concat([ellP(705, 1335, 95, 70, 36)[0]]), false, 'S-EXIST'); v.pl(ellP(705, 1470, 90, 65, 36).concat([ellP(705, 1470, 90, 65, 36)[0]]), false, 'S-EXIST');
      v.line(300, 1535, 835, 1535, 'S-EXIST'); v.line(300, 1667, 835, 1667, 'S-EXIST'); tbrk(v, 300, 1601, 132, 90); tbrk(v, 835, 1601, 132, 90);
      v.pl([[570, 1975], [570, 1548], [722, 1548], [722, 1975]], false, 'S-HIDDEN'); v.pileEnd(646, 1975, 152, 'S-EXIST');
      v.pl([[445, 1990], [445, 1465], [522, 1465], [522, 1990]], false, 'S-NEW'); zig(v, 435, 532, 1990, 485, 'S-TEXT');
      [[457, 1567], [510, 1640]].forEach(q => { v.rect(q[0] - 10, q[1] - 10, 20, 20, 'S-BOLT'); v.circ(q[0], q[1], 5, 'S-BOLT'); }); [[605, 1580], [685, 1637]].forEach(q => xmark(v, q[0], q[1], 22));
      v.rect(405, 1665, 160, 11, 'S-NEW'); [[1, 440], [-1, 530]].forEach(([k, x]) => { v.rect(min(x, x + k * 8), 1676, 8, 89, 'S-NEW'); v.rect(min(x, x - k * 25), 1676, 33, 8, 'S-NEW'); v.rect(min(x, x - k * 25), 1757, 33, 8, 'S-NEW'); });
      v.circ(475, 1735, 100, 'S-TEXT'); v.line(258, 1785, 375, 1745, 'S-TEXT'); { const c = v.P(220, 1795); v.add({ t: 'circle', c, r: 3.4, L: 'S-TEXT' }); v.add({ t: 'text', p: c, s: '1', h: 3.2, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
      secMkL(v, 160, 1565, 'B', 0); v.line(185, 1565, 275, 1565, 'S-TITLE'); secFlag(v, 550, 1565, 22);
      dHs(v, 445, 485, 1465, 1362, '70', true); dHs(v, 485, 522, 1465, 1362, '70'); dVs(v, 1535, 1567, 300, 350, '75 (TYP)');
      lb(v, 790, 1218, 910, 1103, 'EXISTING TIMBER\nDECKING'); lb(v, 745, 1310, 910, 1310, 'EXISTING TIMBER\nSTRINGER', { dot: true }); lb(v, 745, 1450, 910, 1450, 'EXISTING TIMBER\nCORBEL', { dot: true });
      lb(v, 775, 1640, 850, 1745, 'EXISTING TIMBER\nHALFCAP', { dot: true }); lb(v, 722, 1860, 850, 1880, 'EXISTING TIMBER\nPILE');
      ttl(B, F(1722), F(3157), 'VIEW A', 20, null, { left: true, h: 3.6 });
    }
    { // ELEVATION 1:20
      const v = FV(B, 100, 2100);
      v.line(175, 172, 1055, 172, 'S-EXIST'); v.line(175, 218, 1055, 218, 'S-EXIST'); [235, 320, 405, 490, 575, 660, 745, 830, 915, 995].forEach(x => v.line(x, 172, x, 218, 'S-HIDDEN')); tbrk(v, 175, 195, 46, 90); tbrk(v, 1055, 195, 46, 90);
      v.pl([[170, 378], [255, 378], [305, 358], [900, 358], [975, 378], [1055, 378]], false, 'S-EXIST'); v.line(612, 218, 612, 358, 'S-HIDDEN'); v.line(620, 218, 620, 358, 'S-HIDDEN');
      [175, 1055].forEach(x => { v.pl(ellP(x, 260, 22, 40, 24).concat([ellP(x, 260, 22, 40, 24)[0]]), false, 'S-EXIST'); v.pl(ellP(x, 335, 22, 40, 24).slice(0, 14), false, 'S-EXIST'); });
      v.pl([[330, 358], [330, 425], [390, 492], [838, 492], [895, 435], [895, 358]], false, 'S-EXIST');
      v.pl([[577, 945], [577, 415], [655, 415], [655, 945]], false, 'S-NEW'); v.line(585, 415, 585, 630, 'S-NEW'); v.line(647, 415, 647, 630, 'S-NEW'); v.line(585, 722, 585, 945, 'S-NEW'); v.line(647, 722, 647, 945, 'S-NEW'); zig(v, 565, 667, 945, 615, 'S-TEXT');
      v.line(577, 630, 577, 722, 'S-HIDDEN'); v.line(655, 630, 655, 722, 'S-HIDDEN');
      timberX(v, 520, 492, 65, 128); timberX(v, 640, 492, 70, 128);
      [520, 592].forEach(y => { rodD(v, 500, y, 720, y); });
      v.rect(512, 620, 206, 8, 'S-NEW'); v.rect(520, 628, 190, 94, 'S-NEW'); v.line(518, 714, 710, 714, 'S-NEW');
      { const c = v.P(1060, 733); v.add({ t: 'circle', c, r: 3.4, L: 'S-TEXT' }); v.add({ t: 'text', p: c, s: 'A', h: 3.2, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); v.add({ t: 'solid', p: [[c[0] - 3.2, c[1] + 1.8], [c[0] - 3.2, c[1] - 1.8], [c[0] - 5.6, c[1]]], L: 'S-TEXT' }); }
      lb(v, 608, 415, 365, 540, 'PILE CUT OFF'); lb(v, 715, 580, 795, 545, 'φ20 THREADED ROD\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP)'); lb(v, 512, 627, 375, 675, '2-400x170x16PL');
      lb(v, 712, 708, 795, 708, '250 PFC'); lb(v, 655, 875, 795, 875, 'PROPOSED ' + un + '\nDRIVEN PILE');
      const rf = mainT(B, F(230), F(3230), 'PIER PILE/TIMBER HALFCAP BEARING DETAIL', 'PIER N° X - PILE N° X', 'none', { scale: 20 });
      drgBox(B, F(1351), F(3211), F(440), rf);
    }
    return B.E;
  }, 'Driven steel UC pile passing between notched timber halfcaps: 2-250 PFC x 500 with 2-400x170x16 plates welded to the pile cap and rodded through the halfcaps.');

  // ================================================================== PN30-2133 ABUTMENT PILE / TIMBER FULLCAP BEARING (driven steel pile)
  def('pn2133', 'Abutments', 'Abutment pile / timber fullcap bearing – driven steel pile', 'PN30-2133', [P('uc', 'Driven pile', '200UC52', { opts: UCs }), P('cap', 'Bearing stub', '250UC90', { opts: ['250UC90', '250UC73', '310UC97'] })], (p) => {
    const B = new Builder(), un = secName(p.uc), cn = secName(p.cap);
    { // DETAIL 1 1:10
      const v = FV(B, 300, 1500);
      [272, 280, 428, 438].forEach(x => v.line(x, 128, x, 507, 'S-NEW')); v.pl([[258, 128], [345, 128], [352, 105], [360, 150], [366, 128], [500, 128], [507, 105], [515, 150], [521, 128], [590, 128]], false, 'S-TEXT'); v.line(580, 128, 580, 210, 'S-EXIST');
      zig(v, 258, 440, 507, 355, 'S-TEXT');
      v.rect(438, 210, 162, 210, 'S-NEW'); v.line(438, 222, 600, 222, 'S-NEW'); v.line(438, 408, 600, 408, 'S-NEW'); v.rect(280, 210, 148, 12, 'S-NEW'); v.rect(280, 408, 148, 12, 'S-NEW');
      wld(v, 330, 225, 180, 345, { size: 8, both: true, all: true, site: true, tail: 'TYP' }); 
      { const a = v.P(440, 225), k = v.P(515, 278), b2 = v.P(640, 110), c = [b2[0] + 26, b2[1]]; v.add({ t: 'pl', p: [a, k, b2, c], closed: false, L: 'S-TEXT' }); v.arrow(440, 225, Math.atan2(a[1] - k[1], a[0] - k[0]) * 180 / PI); v.add({ t: 'line', a: b2, b: [b2[0], b2[1] + 7.5], L: 'S-TEXT' }); v.add({ t: 'solid', p: [[b2[0], b2[1] + 7.5], [b2[0], b2[1] + 4.5], [b2[0] + 2.8, b2[1] + 6]], L: 'S-TEXT' }); v.add({ t: 'line', a: [b2[0] + 11, b2[1]], b: [b2[0] + 11, b2[1] - 4.5], L: 'S-TEXT' }); v.add({ t: 'line', a: [b2[0] + 11, b2[1] - 4.5], b: [b2[0] + 15.5, b2[1] - 9], L: 'S-TEXT' }); }
      wld(v, 445, 280, 645, 428, { size: 8, both: true, site: true }); wld(v, 445, 425, 645, 578, { size: 8, both: true, site: true });
      ttl(B, F(300 + 255), F(1500 + 690), 'DETAIL 1', 10, null, { left: true, h: 3.6 });
    }
    nbox(B, F(1270), F(1795), 'DETAIL FOR DRIVEN STEEL\nPILE.\n\nPROPOSED PILE SIZE WILL\nVARY ACCORDING TO\nENGINEERING REQUIREMENTS.\n' + un + ' PILE DRAWN', F(570), { h: 3.2 });
    { // ELEVATION 1:20
      const v = FV(B, 0, 2250);
      v.line(555, 215, 555, 605, 'S-EXIST'); v.line(583, 215, 583, 605, 'S-EXIST'); tbrk(v, 569, 215, 28, 90); tbrk(v, 569, 605, 28, 90); [245, 350, 450, 550].forEach(y => v.line(555, y, 583, y, 'S-EXIST')); soil(v, 555, 320, 555, 500, -1);
      v.rect(583, 295, 42, 305, 'S-NEW');
      [625, 633, 700, 708].forEach(x => v.line(x, 290, x, 690, 'S-NEW')); v.line(625, 290, 708, 290, 'S-NEW'); zig(v, 615, 718, 690, 665, 'S-TEXT');
      v.line(720, 295, 860, 295, 'S-EXIST'); v.line(775, 300, 775, 440, 'S-HIDDEN');
      v.rect(633, 440, 157, 105, 'S-NEW'); v.line(633, 448, 790, 448, 'S-NEW'); v.line(633, 537, 790, 537, 'S-NEW');
      [337, 398].forEach(y => rodD(v, 680, y, 800, y));
      v.circ(708, 490, 110, 'S-TEXT'); v.line(488, 555, 600, 525, 'S-TEXT'); { const c = v.P(448, 563); v.add({ t: 'circle', c, r: 3.6, L: 'S-TEXT' }); v.add({ t: 'text', p: c, s: '1', h: 3.2, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
      { const c = v.P(785, 100); v.add({ t: 'circle', c, r: 3.6, L: 'S-TEXT' }); v.add({ t: 'text', p: c, s: 'A', h: 3.2, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); v.add({ t: 'solid', p: [[c[0] - 3.4, c[1] + 1.8], [c[0] - 3.4, c[1] - 1.8], [c[0] - 5.8, c[1]]], L: 'S-TEXT' }); }
      v.line(785, 140, 785, 220, 'S-TITLE'); v.line(785, 650, 785, 815, 'S-TITLE'); v.add({ t: 'solid', p: [v.P(785, 730), v.P(785, 805), v.P(760, 768)], L: 'S-TEXT' });
      v.line(720, 290, 895, 290, 'S-DIM'); v.line(720, 298, 895, 298, 'S-DIM'); dVs(v, 290, 298, 895, 875, '20 NOM.');
      lb(v, 603, 350, 472, 248, 'JARRAH PACKER\nTO SUIT', { dot: true }); lb(v, 745, 368, 895, 370, 'EXISTING TIMBER\nFULLCAP', { dot: true }); lb(v, 770, 545, 895, 615, cn + ' x 200\nLONG');
      lb(v, 645, 540, 500, 700, 'PROVIDE 2-10FL WEB\nSTIFFENERS NEAR FACE\n& FAR FACE OF PROPOSED\nUC PILE IF ACCESS PERMITS.');
      const rf = mainT(B, F(405), F(2250 + 985), 'ABUTMENT PILE/TIMBER\nFULLCAP BEARING DETAIL', 'ABUTMENT N° X - PILE N° X\nABUTMENT N° X - PILE N° X', 'none', { scale: 20 });
      drgBox(B, F(1015), F(2250 + 812), F(505), rf);
    }
    { // SECTION A 1:20
      const v = FV(B, 1100, 1500);
      v.line(565, 1043, 1350, 1043, 'S-EXIST'); v.line(565, 1187, 1350, 1187, 'S-EXIST'); tbrk(v, 575, 1115, 144, 90); tbrk(v, 1350, 1115, 144, 90);
      v.pl(circP(1153, 985, 82, 40).concat([circP(1153, 985, 82, 40)[0]]), false, 'S-EXIST');
      v.pl([[722, 1545], [722, 1035], [808, 1035], [808, 1545]], false, 'S-NEW'); v.line(765, 1035, 765, 1545, 'S-HIDDEN'); zig(v, 712, 818, 1545, 770, 'S-TEXT');
      v.rect(712, 1187, 106, 6, 'S-NEW'); v.rect(712, 1283, 106, 7, 'S-NEW'); v.line(762, 1193, 762, 1283, 'S-NEW'); v.line(770, 1193, 770, 1283, 'S-NEW');
      [[793, 1083], [737, 1143]].forEach(q => { v.rect(q[0] - 12, q[1] - 12, 24, 24, 'S-BOLT'); v.circ(q[0], q[1], 6, 'S-BOLT'); v.barEnd(q[0], q[1], 3); });
      v.pl([[835, 1520], [835, 1055], [1000, 1055], [1000, 1520]], false, 'S-HIDDEN'); v.pileEnd(917.5, 1525, 165, 'S-EXIST'); [[875, 1088], [955, 1148]].forEach(q => { v.circ(q[0], q[1], 12, 'S-EXIST'); v.circ(q[0], q[1], 6, 'S-EXIST'); });
      v.line(630, 1083, 760, 1083, 'S-DIM'); dVs(v, 1043, 1083, 722, 645, '100 (TYP)');
      lb(v, 725, 1155, 595, 1265, 'φ20 THREADED ROD\nWITH 65x5FLx65\nWASHER (TYP)'); lb(v, 720, 1500, 595, 1500, 'PROPOSED PILE'); lb(v, 1000, 1428, 1085, 1428, 'EXISTING TIMBER\nPILE');
      ttl(B, F(1835), F(3220), 'SECTION A', 20, null, { left: true, h: 3.6 });
    }
    return B.E;
  }, 'Driven steel UC pile at the abutment sheeting: a short UC stub welded across the pile top bears under the timber fullcap, rodded through the fullcap, jarrah packer to the sheeting.');

})(typeof window !== 'undefined' ? window : globalThis);
