/* StructCap Timber — repair details: MRWA project standard drawings 1330-0001 … 0011.
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ---------------------------------------------------------------- local helpers
  // Layout follows the source sheet: positions are read off the 1330 sheets rendered at 220 dpi (sheet px) and mapped to
  // paper mm with K; a view of nominal scale 1:N is drawn at 1:(N*F) so that geometry keeps its place among the notes.
  const K = 0.22, F = 1.1;
  const X = px => px * K, Y = py => -py * K;
  const V = (B, N, px, py) => B.view(N * F, X(px), Y(py));
  // leader: arrow at model (x,y); text LEFT-aligned starting at sheet px tx, first line centred on ty. The shoulder joins the text
  // at its left end when the text lies right of the point, else at the right end of the first line (sheet practice).
  // o: h, dot, kink: [px, py] (sheet px of an explicit kink), extra: [[x,y],…] more arrow points from the same kink
  const tw = (s, h) => String(s).length * (h || TH) * 0.7;
  function L(v, x, y, tx, ty, s, o) {
    o = o || {}; const h = o.h || TH, a = v.P(x, y), lines = String(s).split('\n'), x0 = o.r ? X(tx) - max(...lines.map(l => tw(l, h))) : X(tx), yb = Y(ty), w1 = tw(lines[0], h), right = a[0] < x0 + w1 / 2;
    const sh = right ? [x0 - 1, yb] : [x0 + w1 + 1, yb], kk = o.kink ? [X(o.kink[0]), Y(o.kink[1])] : [sh[0] + (right ? -3 : 3), yb];
    v.add({ t: 'pl', p: o.kink ? [a, kk, sh] : [a, kk, sh], closed: false, L: 'S-TEXT' });
    const tip = (p, from) => { if (o.dot) { v.add({ t: 'circle', c: p, r: 0.5, L: 'S-TEXT' }); v.add({ t: 'solid', p: [[p[0] - 0.45, p[1] - 0.45], [p[0] + 0.45, p[1] - 0.45], [p[0] + 0.45, p[1] + 0.45], [p[0] - 0.45, p[1] + 0.45]], L: 'S-TEXT' }); return; } const ang = Math.atan2(p[1] - from[1], p[0] - from[0]), al = 2.4, aw = 0.75; v.add({ t: 'solid', p: [p, [p[0] - al * Math.cos(ang) - aw * Math.sin(ang), p[1] - al * Math.sin(ang) + aw * Math.cos(ang)], [p[0] - al * Math.cos(ang) + aw * Math.sin(ang), p[1] - al * Math.sin(ang) - aw * Math.cos(ang)]], L: 'S-TEXT' }); };
    tip(a, kk); (o.extra || []).forEach(q => { const p = v.P(q[0], q[1]); v.add({ t: 'line', a: kk, b: p, L: 'S-TEXT' }); tip(p, kk); });
    lines.forEach((l, i) => v.add({ t: 'text', p: [x0, yb - h / 2 - i * h * 1.55], s: l, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }));
  }
  // weld symbol whose tail note has several lines (drawn beside the tail)
  function weldT(v, x, y, dx, dy, o, s) { v.weld(x, y, dx, dy, Object.assign({}, o, { tail: ' ' })); const a = v.P(x, y), k = dx >= 0 ? 1 : -1, c = [a[0] + dx + k * 14, a[1] + dy]; String(s).split('\n').forEach((l, i) => v.add({ t: 'text', p: [c[0] + k * 3, c[1] - 1 - i * TH * 1.55], s: l, h: 2.0, al: k > 0 ? 'l' : 'r', v: 'b', ang: 0, L: 'S-TEXT' })); }
  // detail call-up: circle round the detail at model (x,y) radius r, line to a numbered circle at sheet px, '(TYP)' beside it
  function callup(v, x, y, r, npx, npy, n, typ) { v.circ(x, y, r, 'S-TEXT'); const c = [X(npx), Y(npy)], a = v.P(x + r, y); v.add({ t: 'line', a, b: [c[0] - 2.8, c[1]], L: 'S-TEXT' }); v.add({ t: 'circle', c, r: 2.8, L: 'S-TEXT' }); v.add({ t: 'text', p: c, s: String(n), h: 2.6, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); if (typ) v.add({ t: 'text', p: [c[0] + 4, c[1] - 1.1], s: typ, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
  const LL = (v, pts, tx, ty, s, o) => L(v, pts[0][0], pts[0][1], tx, ty, s, Object.assign({}, o || {}, { extra: pts.slice(1) }));
  // plain text at sheet px (left/centre/right at tx, baseline at ty)
  function T(B, tx, ty, s, h, al, L0) { String(s).split('\n').forEach((l, i) => B.E.push({ t: 'text', p: [X(tx), Y(ty) - i * (h || TH) * 1.55], s: l, h: h || TH, al: al || 'l', v: 'b', ang: 0, L: L0 || 'S-TEXT' })); }
  // view title with its left end at sheet px (tx, ty = baseline): underlined word, letter/number in a circle, sub-lines, scale
  function VT(B, tx, ty, s, scale, sub0) {
    const m = /^(SECTION|VIEW|DETAIL|ELEVATION|PLAN|SECTIONAL PLAN)\s+([A-Z0-9]{1,2})$/.exec(s), h = 3.2, word = m ? m[1] : s, w = word.length * h * 0.68, x0 = X(tx), y = Y(ty), E = B.E;
    E.push({ t: 'text', p: [x0, y], s: word, h, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); E.push({ t: 'line', a: [x0, y - 1.1], b: [x0 + w, y - 1.1], L: 'S-TITLE' });
    if (m) { E.push({ t: 'circle', c: [x0 + w + 5.5, y + h / 2], r: 3.1, L: 'S-TITLE' }); E.push({ t: 'text', p: [x0 + w + 5.5, y + h / 2], s: m[2], h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); }
    let yy = y - 4.4; if (sub0) String(sub0).split('\n').forEach(l => { E.push({ t: 'text', p: [x0, yy], s: l, h: TH * 0.95, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.3; });
    if (scale) E.push({ t: 'text', p: [x0, yy], s: '1:' + scale, h: TH * 0.9, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
  }
  // small underlined view label (PLAN / ELEVATION / SIDE ELEVATION under a view), centred at sheet px
  function UL(B, cx, ty, s, h) { h = h || 2.2; const w = s.length * h * 0.7; B.E.push({ t: 'text', p: [X(cx), Y(ty)], s, h, al: 'c', v: 'b', ang: 0, L: 'S-TITLE' }); B.E.push({ t: 'line', a: [X(cx) - w / 2, Y(ty) - 0.8], b: [X(cx) + w / 2, Y(ty) - 0.8], L: 'S-TITLE' }); }
  // main (bullet) title with its text starting at sheet px; mark: 'dot' (default) | 'tri' | 'sq' | 'dia' | 'cross' | 'hatch' | 'xbox'
  function MT(B, tx, ty, s, scale, sub, mark) {
    const h = 3.6, tw = s.length * h * 0.7, x0 = X(tx), y = Y(ty), c = [x0 - 6, y + h / 2], E = B.E, sol = p => E.push({ t: 'solid', p, L: 'S-TITLE' });
    E.push({ t: 'text', p: [x0, y], s, h, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); E.push({ t: 'line', a: [x0, y - 1.2], b: [x0 + tw, y - 1.2], L: 'S-TITLE' });
    mark = mark || 'dot';
    if (mark === 'dot') { for (let i = 0; i < 16; i++) { const a0 = 2 * PI * i / 16, a1 = 2 * PI * (i + 1) / 16; sol([c, [c[0] + 2 * Math.cos(a0), c[1] + 2 * Math.sin(a0)], [c[0] + 2 * Math.cos(a1), c[1] + 2 * Math.sin(a1)]]); } E.push({ t: 'line', a: [c[0] - 6, c[1]], b: [c[0] + 6, c[1]], L: 'S-TITLE' }); }
    else if (mark === 'tri') sol([[c[0] - 2.3, c[1] - 2], [c[0] + 2.3, c[1] - 2], [c[0], c[1] + 2.2]]);
    else if (mark === 'sq') { sol([[c[0] - 2, c[1] - 2], [c[0] + 2, c[1] - 2], [c[0] + 2, c[1] + 2]]); sol([[c[0] - 2, c[1] - 2], [c[0] + 2, c[1] + 2], [c[0] - 2, c[1] + 2]]); }
    else if (mark === 'dia') { sol([[c[0], c[1] - 2.6], [c[0] + 1.6, c[1]], [c[0], c[1] + 2.6]]); sol([[c[0], c[1] - 2.6], [c[0], c[1] + 2.6], [c[0] - 1.6, c[1]]]); }
    else if (mark === 'cross') { E.push({ t: 'circle', c, r: 1.6, L: 'S-TITLE' }); E.push({ t: 'line', a: [c[0] - 3, c[1]], b: [c[0] + 3, c[1]], L: 'S-TITLE' }); E.push({ t: 'line', a: [c[0], c[1] - 3], b: [c[0], c[1] + 3], L: 'S-TITLE' }); }
    else if (mark === 'xbox') { E.push({ t: 'pl', p: [[c[0] - 2, c[1] - 2], [c[0] + 2, c[1] - 2], [c[0] + 2, c[1] + 2], [c[0] - 2, c[1] + 2]], closed: true, L: 'S-TITLE' }); E.push({ t: 'line', a: [c[0] - 2, c[1] - 2], b: [c[0] + 2, c[1] + 2], L: 'S-TITLE' }); E.push({ t: 'line', a: [c[0] - 2, c[1] + 2], b: [c[0] + 2, c[1] - 2], L: 'S-TITLE' }); E.push({ t: 'line', a: [c[0] - 2, c[1]], b: [c[0] + 2, c[1]], L: 'S-TITLE' }); E.push({ t: 'line', a: [c[0], c[1] - 2], b: [c[0], c[1] + 2], L: 'S-TITLE' }); }
    else if (mark === 'hatch') { const r = [[c[0] - 4, c[1] - 1.5], [c[0] + 2, c[1] - 1.5], [c[0] + 2, c[1] + 1.5], [c[0] - 4, c[1] + 1.5]]; E.push({ t: 'pl', p: r, closed: true, L: 'S-TITLE' }); for (let i = 0; i < 5; i++) { const xa = c[0] - 4 + i * 1.5 - 1.5, xb = xa + 3; const a0 = [max(xa, c[0] - 4), c[1] - 1.5 + (max(xa, c[0] - 4) - xa)], b0 = [min(xb, c[0] + 2), c[1] + 1.5 - (xb - min(xb, c[0] + 2))]; if (b0[0] > a0[0]) E.push({ t: 'line', a: a0, b: b0, L: 'S-TITLE' }); } }
    let yy = y - 4.6; if (sub) String(sub).split('\n').forEach(l => { E.push({ t: 'text', p: [x0, yy], s: l, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.4; });
    if (scale) E.push({ t: 'text', p: [x0, yy], s: '1:' + scale, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
  }
  // NOTES block with hanging numbers at sheet px; lines given as on the sheet ('\n' = sheet line break)
  function NB(B, tx, ty, lines, h, pitch) { h = h || TH; const p = (pitch || 22) * K; B.E.push({ t: 'text', p: [X(tx), Y(ty)], s: 'NOTES:', h: h * 1.2, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); B.E.push({ t: 'line', a: [X(tx), Y(ty) - 0.9], b: [X(tx) + 6 * h * 1.2 * 0.7, Y(ty) - 0.9], L: 'S-TITLE' }); let y = Y(ty) - p * 1.7; lines.forEach((l, i) => { B.E.push({ t: 'text', p: [X(tx), y], s: (i + 1) + '.', h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); String(l).split('\n').forEach(r => { B.E.push({ t: 'text', p: [X(tx) + h * 2.4, y], s: r, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); y -= p; }); }); }
  const GN1 = 'FOR GENERAL NOTES REFER DRAWING No. 1330-0001.';
  // dimension text helper: value with a second line
  const sub = s => ({ sub: s });
  // level arrow (MRWA: solid down-pointing triangle sitting on a short line) at model point
  function lvl(v, x, y) { const p = v.P(x, y); v.add({ t: 'line', a: [p[0] - 4.5, p[1]], b: [p[0] + 4.5, p[1]], L: 'S-TEXT' }); v.add({ t: 'solid', p: [[p[0] - 3.5, p[1]], [p[0] + 3.5, p[1]], [p[0], p[1] - 2]], L: 'S-TEXT' }); }
  // view/section reference marker: letter in a circle with a solid pointer (dir deg) and an optional tail line to the left/right (paper mm)
  function mk(v, x, y, ch, dir, tail) { v.mark(x, y, ch, dir); if (tail) { const p = v.P(x, y); v.add({ t: 'line', a: [p[0] + (tail > 0 ? 3 : -3), p[1]], b: [p[0] + (tail > 0 ? 3 : -3) + tail, p[1]], L: 'S-TEXT' }); } }
  // number in a circle (detail call-up)
  function num(v, x, y, s) { const p = v.P(x, y); v.add({ t: 'circle', c: p, r: 2.8, L: 'S-TEXT' }); v.add({ t: 'text', p, s, h: 2.6, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
  // U2 / finish symbol: text over a tick
  function fin(v, x, y, s) { const p = v.P(x, y); v.add({ t: 'pl', p: [[p[0] - 2.4, p[1] + 2.4], [p[0], p[1]], [p[0] + 3.6, p[1] + 3.6]], closed: false, L: 'S-TEXT' }); v.add({ t: 'line', a: [p[0] - 2.4, p[1] + 2.4], b: [p[0] + 3.6, p[1] + 2.4], L: 'S-TEXT' }); v.add({ t: 'text', p: [p[0] + 0.6, p[1] + 2.9], s, h: 1.9, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); }
  // slope / chamfer triangle symbol ('4' over a small triangle) at model point, flipped with k
  function slope(v, x, y, s, k) { const p = v.P(x, y); k = k || 1; v.add({ t: 'pl', p: [[p[0], p[1]], [p[0] + k * 3, p[1]], [p[0], p[1] + 3]], closed: true, L: 'S-TEXT' }); v.add({ t: 'text', p: [p[0] + k * 1.3, p[1] + 1.5], s, h: 1.6, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
  // bar shape box symbol (small closed rectangle used beside bar labels)
  function barSym(v, px, py) { const B = v.B; B.E.push({ t: 'pl', p: [[X(px), Y(py)], [X(px) + 3.6, Y(py)], [X(px) + 3.6, Y(py) - 2.4], [X(px), Y(py) - 2.4]], closed: true, L: 'S-TEXT' }); }
  // timber pile end break (MRWA "S" break across a round pile) drawn existing (dash-dot)
  const pend = (v, x, y, D, L0) => v.pileEnd(x, y, D, L0 || 'S-EXIST');
  // zig-zag break line (paper size constant)
  const zz = (v, x1, y1, x2, y2) => v.brk(x1, y1, x2, y2, 'S-TEXT');
  // earth tufts along a line (sheet "////" hatching): from x1 to x2 at y, on side k (+1 above, -1 below)
  function tufts(v, x1, x2, y, k) { const s = v.s, st = 2.0 * s, n = Math.floor((x2 - x1) / st); for (let i = 0; i < n; i++) { const x = x1 + i * st; v.line(x, y, x + 1.2 * s, y + (k || 1) * 1.4 * s, 'S-HATCH'); } }

  // 1 GENERAL NOTES (1330-0001)
  def('gn', 'General', 'General notes & bar lap table', '1330-0001', [P('proj', 'Concrete class', 'S40'), P('cover', 'Clear cover (mm)', 40, { num: 1 })], (p) => {
    const B = new Builder(), h = 2.9, pt = 24;
    // columns (sheet px): heading number, heading text / item number, item text, sub-item text
    const put = (x, y, s, o) => B.E.push({ t: 'text', p: [X(x), Y(y)], s, h: (o && o.h) || h, al: 'l', v: 'b', ang: 0, L: (o && o.L) || 'S-TEXT' });
    function col(c0, c1, c2, c3, secs) {
      secs.forEach(([y0, n, head, items]) => {
        put(c0, y0, n, { L: 'S-TITLE' }); put(c1, y0, head, { L: 'S-TITLE' }); let y = y0 + pt * 1.45;
        items.forEach(it => {
          if (typeof it === 'number') { y += it * pt; return; }
          const [no, txt, ind] = it, lines = String(txt).split('\n');
          if (ind === 'sub') { put(c2, y, no); lines.forEach(l => { put(c3, y, l); y += pt; }); return; }
          if (ind != null && typeof ind === 'number') { if (no) put(c1, y, no); lines.forEach(l => { put(ind, y, l); y += pt; }); return; }
          if (no) put(c1, y, no); lines.forEach(l => { put(c2, y, l); y += pt; });
        });
      });
    }
    const cc = String(p.proj || 'S40'), cv = String(p.cover || 40);
    col(200, 260, 318, 376, [
      [187, '1.', 'GENERAL', [['1.1', 'ALL WORKS SHALL BE CARRIED OUT IN ACCORDANCE WITH THE  SPECIFICATION AND THE\nOCCUPATIONAL SAFETY AND HEALTH  ACT 1984.'], ['1.2', 'NO CHANGES TO DESIGN DETAILS SHALL BE ADOPTED DURING CONSTRUCTION WITHOUT\nWRITTEN APPROVAL OF THE ENGINEER.'], ['1.3', 'DIMENSIONS SHALL NOT BE SCALED FROM THE DRAWINGS.'], ['1.4', 'ALL DIMENSIONS GIVEN IN MILLIMETRES AND ALL LEVELS GIVEN IN METRES UNLESS NOTED\nOTHERWISE.']]],
      [420, '2.', 'CONCRETE', [['2.1', 'CONCRETE SHALL BE CLASS ' + cc + ' IN ACCORDANCE WITH THE SPECIFICATION UNLESS\nOTHERWISE SPECIFIED.'], ['2.2', 'CONCRETE SURFACE FINISHES SHALL BE IN ACCORDANCE WITH THE SPECIFICATION.'], ['2.3', 'BLINDING CONCRETE SHALL BE CLASS N20 IN ACCORDANCE WITH AS 1379, ALL OTHER\nCONCRETE SHALL BE ' + cc + ' IN ACCORDANCE WITH THE SPECIFICATION UNLESS OTHERWISE\nNOTED.'], ['2.4', 'ALL EXPOSED CORNERS OF CONCRETE SHALL HAVE A 20x20 CHAMFER UNLESS\nOTHERWISE NOTED.'], ['2.5', 'ABBREVATION USED:-'], 0.8, ['', 'FORMED FINISH CLASS N°.', 558], 1, ['', 'UNFORMED FINISH CLASS N°.', 558]]],
      [818, '3.', 'REINFORCEMENT', [['3.1', 'CLEAR COVER TO REINFORCEMENT SHALL BE ' + cv + 'mm UNLESS OTHERWISE SHOWN.'], ['3.2', 'BAR LAP LENGTHS SHALL BE IN ACCORDANCE WITH TABLE 1.'], ['3.3', 'FABRIC OVERLAP SHALL BE A MINIMUM OF THREE CROSS WIRES ON BOTH SHEETS UNLESS\nOTHERWISE SHOWN.'], ['3.4', 'ALL CUTTING AND BENDING OF FABRIC AND REINFORCEMENT TO BE IN ACCORDANCE WITH\nAS 3600.'], ['3.5', 'ABBREVIATIONS USED:-'], -1, ['', 'NF\nFF\nT\nB\nES', 558], -5, ['', '- NEAR FACE\n- FAR FACE\n- TOP\n- BOTTOM\n- EQUALLY SPACED', 600], 0.8, ['3.6', 'REINFORCEMENT SHALL CONFORM TO:-'], 0.4, ['', 'SL\nN\nR', 558], -3, ['', '- 500 MPa MESH TO AS/NZS 4671.\n- 500 MPa REINFORCING BARS TO AS/NZS 4671.\n- 250 MPa PLAIN BARS TO AS/NZS 4671.', 600]]],
      [1287, '4.', 'STEELWORK', [['4.1', 'ALL WELDING SHALL BE STRUCTURAL PURPOSE IN ACCORDANCE WITH AS/NZS 1554 AND\nTHE SPECIFICATION.'], ['4.2', 'ALL BOLTS AND THREADED RODS SHALL BE SUPPLIED WITH NUTS AND WASHERS\nUNLESS OTHERWISE SPECIFIED ALL BOLTS, NUTS AND WASHERS SHALL BE HIGH STRENGTH\nGRADE 8.8 IN ACCORDANCE WITH AS/NZS 1252.'], ['4.3', 'ALL THREADED RODS SHALL BE DIAMETER 20 UNLESS OTHERWISE SHOWN AND SHALL BE\nGRADE 300 IN ACCORDANCE WITH AS/NZS 3679.1.'], ['4.4', 'AFTER FABRICATION STEELWORK SHALL BE HOT-DIP GALVANISED AS FOLLOWS:'], ['4.4.1', 'BOLTS, NUTS, COACH SCREWS, WASHERS, SPIKES AND THREADED RODS SHALL BE IN\nACCORDANCE WITH AS 1214. AFTER GALVANISING ALL THREADED\nCOMPONENTS SHALL BE ABLE TO BE ASSEMBLED BY HAND.', 'sub'], ['4.4.2', 'ALL OTHER STEELWORK IS TO BE IN ACCORDANCE WITH AS/NZS 4680.', 'sub'], ['4.5', 'DAMAGED GALVANISING SHALL BE TREATED BY A SUITABLE COLD GALVANISING OR\nSIMILAR APPROVED PROCESS IN ACCORDANCE WITH THE SPECIFICATION, EXCEPT TO AREAS\nWHICH WILL BE PERMANENTLY EMBEDDED IN CONCRETE BY MORE THAN 50mm.'], ['4.6', 'UNLESS OTHERWISE SPECIFIED ALL STRUCTURAL STEEL SECTIONS SHALL BE MINIMUM\nGRADE 300 IN ACCORDANCE WITH AS/NZS 3679.1.'], ['4.7', 'ALL STRUCTURAL STEEL HOLLOW SECTIONS SHALL BE MINIMUM GRADE C350 IN\nACCORDANCE WITH AS/NZS 1163.'], ['4.8', 'ALL STRUCTURAL STEEL PLATE SHALL BE MINIMUM GRADE 250 IN ACCORDANCE WITH\nAS/NZS 3678.'], ['4.9', 'ALL STRUCTURAL STEEL FLAT (MERCHANT BAR) SHALL BE MINIMUM GRADE 300 IN\nACCORDANCE WITH AS/NZS 3679.1.'], ['4.10', 'FABRICATION SHALL COMPLY WITH THE REQUIREMENTS OF AS 4100.']]],
      [1998, '5.', 'TIMBERWORK', [['5.1', 'ALL NEW BOLTS THROUGH TIMBER ELEMENTS SHALL BE COATED WITH DENSOPASTE AND\nALL EXPOSED THREADS AND NUTS SHALL BE COATED WITH DENSOPASTE FOLLOWING\nTIGHTENING OF NUTS IN ACCORDANCE WITH THE SPECIFICATION.'], ['5.2', 'SPECIES AND STRUCTURAL GRADE OF ALL TIMBER SHALL BE IN ACCORDANCE WITH THE\nSPECIFICATION.']]],
      [2185, '6.', 'EMBANKMENT FORMATION (WHERE WIDENING IS REQUIRED)', [['6.1', 'FORMATION WIDENING WHERE REQUIRED SHALL BE CONSTRUCTED IN ACCORDANCE WITH THE\nSPECIFICATION.'], ['6.2', 'THE FACE OF EXISTING EMBANKMENT SHALL BE BENCHED.'], ['6.3', 'THE FILL SHALL BE PLACED AND COMPACTED IN LAYERS AND FINAL BATTERS TRIMMED TO\nSPECIFIED TOLERANCES DETAILED IN THE SPECIFICATION.'], ['6.4', 'THE MINIMUM LEVEL OF COMPACTION SHALL NOT BE LESS THAN THAT GIVEN IN THE\nSPECIFICATION.']]]
    ]);
    col(1142, 1200, 1259, 1318, [
      [185, '7.', 'GENERAL MAINTENANCE', [['7.1', "WHERE THE DETERIORATION OF STRUCTURAL ELEMENTS IS FOUND TO DIFFER FROM THE\nSCOPE SHOWN ON THE DRAWINGS OR AVAILABLE INSPECTION REPORTS, THE CONTRACTOR\nSHALL ADVISE THE SUPERINTENDENT'S REPRESENTATIVE IMMEDIATELY. ANY SUBSEQUENT\nCHANGES TO THE DESIGN WILL BE INSTRUCTED BY THE SUPERINTENDENT'S\nREPRESENTATIVE."], ['7.2', 'THE ENDS OF ALL NEWLY CUT SURFACES OF EXISTING TIMBER, SHALL RECEIVE END GRAIN\nTREATMENT IN ACCORDANCE WITH THE SPECIFICATION.'], ['7.3', 'ALL HOLES WITHOUT BOLTS IN EXISTING TIMBER ELEMENTS WITHIN 1.5m OF  GROUND LINE\nOR PERMANENT WATER LINE, SHALL BE FILLED WITH CONBEXTRA EP GROUT OR SIMILAR\nAPPROVED.'], ['7.4', 'GENERAL MAINTENANCE SHALL BE CARRIED OUT IN ACCORDANCE WITH THE SPECIFICATION.\nFOR EXTENT OF WORKS REFER TO PREVENTATIVE MAINTENANCE TABLE.'], ['7.5', "ALL BOLTED AND THREADED ROD CONNECTIONS NOT COVERED BY CLAUSE 850.30 OF THE\nSPECIFICATION SHALL BE TIGHTENED AND TREATED IN ACCORDANCE WITH CLAUSES 850.34\n& 850.35 OF THE SPECIFICATION. WHEN FASTENERS HAVE 'FUSED' ONTO THE THREAD AND\nCANNOT BE LOOSENED, FASTENER REPLACEMENT SHALL BE UNDERTAKEN IN\nACCORDANCE WITH CLAUSE 850.30 OF THE SPECIFICATION."]]],
      [669, '8.', 'PILE DRIVING', [['8.1', 'ALL WORKS SHALL BE CARRIED OUT IN ACCORDANCE WITH THE SPECIFICATION.'], ['8.2', 'PILE DRIVING TOLERANCES SHALL BE:-'], ['', 'a.) DEVIATION FROM VERTICAL IN A 3M TEMPLATE ± 15mm.\nb.) DEVIATION FROM PLAN POSITION 50mm IN ANY DIRECTION.\nc.) MAXIMUM VARIATION FROM SPECIFIED CUT OFF LEVEL ± 5mm.', 1318], ['8.3', 'WHERE PILES ARE DRIVEN WITH A DIESEL HAMMER - THE DRIVING HELMET INTERNAL\nDIAMETER SHALL NOT EXCEED THE PILE SIZE BY MORE THAN 20mm.'], ['8.4', "PILES MUST BE DRIVEN IN THE REQUIRED SET TO BE DETERMINED ON SITE USING THE 'HILEY'\nFORMULA AND BY CONSIDERING THE TEMPORARY COMPRESSION OF THE STEEL PILE."], ['8.5', 'ONE REPRESENTATIVE TEMPORARY COMPRESSION GRAPH MUST BE TAKEN FOR EACH\nGROUP OF SIMILAR PILES (i.e. PILES OF SIMILAR SIZE) AT FINAL SET.'], ['8.6', 'ALL STEEL PILING TO 3 METRES BELOW GROUND LEVEL UP TO TOP OF PILES SHALL BE HOT\nDIP DIP GALVANISED IN ACCORDANCE WITH AS/NZS 4680. ALL PILING BURIED MORE THAN\n3 METRES BELOW GROUND MAY BE LEFT BLACK (UNTREATED).'], ['8.7', 'APPROXIMATE ANTICIPATED MINIMUM SET REQUIREMENTS OF A PILE DRIVING UNIT (WITH A\nKNOWN HAMMER RATED ENERGY PER BLOW) ARE TO BE DETERMINED BY THE DESIGN\nENGINEER AND DETAILED ON THE DESIGN DRAWINGS.']]],
      [1168, '9.', 'CULVERTS', [['9.1', 'THE BASE SLAB DESIGN IS BASED ON A MAXIMUM APPLIED BEARING PRESSURE\n(UNFACTORED). AS DEFINED ON THE DESIGN DRAWINGS.\nIF GEOTECHNICAL INVESTIGATIONS HAVE NOT BEEN UNDERTAKEN AT THE CULVERT\nLOCATION, THE CONTRACTOR SHALL LIAISE WITH THE SUPERINTENDENT\'S\nREPRESENTATIVE TO ESTABLISH THE SITE GROUND CONDITIONS. WHERE GROUND\nCONDITIONS INDICATE THAT BEARING CAPACITY IS LESS THAN THAT SPECIFIED ON THE\nDESIGN DRAWINGS, GUIDANCE SHALL BE SOUGHT FROM THE ENGINEER.'], ['9.2', "BACKFILL MATERIAL IN THE 'ZONE OF SPECIAL COMPACTION' IS TO BE COMPACTED USING\nHAND EQUIPMENT TO 95% MAX DRY DENSITY.\nALL SELECTED FILL TO BE IN ACCORDANCE WITH THE SPECIFICATION."], ['9.3', 'PRECAST CONCRETE CULVERT CROWN SECTIONS AND LINK SLABS SHALL BE SUPPLIED IN\nACCORDANCE WITH THE SPECIFICATION FOR THE SUPPLY OF PRECAST CONCRETE BOX\nCULVERTS.'], ['9.4', 'PRECAST CONCRETE PIPE SECTIONS SHALL BE SUPPLIED IN ACCORDANCE WITH THE\nSPECIFICATION FOR THE SUPPLY OF PRECAST CONCRETE PIPE CULVERTS.'], ['9.5', "REFER TO MANUFACTURER'S SPECIFICATION FOR DETAILED DIMENSIONS AND\nPLACEMENT TOLERANCES FOR CULVERT UNITS TO DETERMINE OVERALL DIMENSIONS OF\nBASE SLAB, SHEAR KEY AND WING WALL LOCATIONS."], ['9.6', 'THE PRECAST UNITS SHALL BE INSTALLED SQUARE TO THE SLOPE OF THE BASE SLAB.\nEXTERNAL TRANSVERSE FACE JOINTS BETWEEN CULVERT UNITS SHALL BE PRIMED WITH\nBITAC PRIMER AND SEALED WITH 150 WIDE BITAC (OR SIMILAR APPROVED) PRIOR TO\nBACKFILLING.'], ['9.7', 'PLASTIC CEMENT MORTAR SHALL BE 0.4 W/C RATIO AND 3:1 SAND/CEMENT RATIO. DRY\nPACK CEMENT MORTAR SHALL HAVE 3:1 SAND/CEMENT RATIO.'], ['9.8', "THE CONTRACTOR SHALL REALIGN INLET AND OUTLET CHANNELS WITHIN THE VICINITY OF\nTHE CULVERT TO PROVIDE A SINGLE CHANNEL. THE EXTENT OF THE REALIGNMENT SHALL\nBE DEFINED ON SITE BY THE SUPERINTENDENT'S REPRESENTATIVE."]]]
    ]);
    // 'FINAL SET.' underlined (8.5)
    // surface finish symbols beside 2.5 (N° / UN° over a tick)
    const fv = B.view(1, 0, 0); [[497, 690, 'N°'], [497, 737, 'UN°']].forEach(([x, y, s]) => { const p = [X(x), Y(y)]; B.E.push({ t: 'pl', p: [[p[0] - 3, p[1] + 1], [p[0] - 0.6, p[1] - 0.2], [p[0] + 1.2, p[1] - 2.4], [p[0] + 3.4, p[1] + 1]], closed: false, L: 'S-TEXT' }); B.E.push({ t: 'line', a: [p[0] - 3, p[1] + 1], b: [p[0] + 3.4, p[1] + 1], L: 'S-TEXT' }); B.E.push({ t: 'text', p: [p[0] + 0.2, p[1] + 1.6], s, h: 2.4, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); });
    // title
    T(B, 200, 135, 'GENERAL NOTES', 3.6, 'l', 'S-TITLE'); B.E.push({ t: 'line', a: [X(200), Y(135) - 1.2], b: [X(200) + 13 * 3.6 * 0.7, Y(135) - 1.2], L: 'S-TITLE' });
    // TABLE 1 - BAR LAP LENGTHS
    const tx0 = 2140, tx1 = 2319, tx2 = 2649, tx3 = 2979, ty = [179, 276, 316, 348];
    [tx0, tx1, tx2, tx3].forEach(x => B.E.push({ t: 'line', a: [X(x), Y(ty[0])], b: [X(x), Y(ty[3])], L: 'S-TEXT' })); ty.forEach(y => B.E.push({ t: 'line', a: [X(tx0), Y(y)], b: [X(tx3), Y(y)], L: 'S-TEXT' }));
    const th = 2.5; T(B, 2148, 236, 'BAR DIAMETER, D', th); T(B, 2335, 200, 'MINIMUM LAP LENGTH FOR\nHORIZONTAL BARS WITH > 300mm\nOF CONCRETE CAST BELOW', th); T(B, 2668, 200, 'MINIMUM LAP LENGTH\nFOR OTHER CASES', th);
    T(B, 2229, 303, 'D ≤ 24mm', th, 'c'); T(B, 2484, 303, '60D', th, 'c'); T(B, 2814, 303, '45D', th, 'c'); T(B, 2229, 340, 'D > 24mm', th, 'c'); T(B, 2484, 340, '65D', th, 'c'); T(B, 2814, 340, '50D', th, 'c');
    T(B, 2560, 412, 'TABLE 1 - BAR LAP LENGTHS', 3.4, 'c', 'S-TITLE'); B.E.push({ t: 'line', a: [X(2560) - 13 * 3.4 * 0.7 * 1.0, Y(412) - 1.2], b: [X(2560) + 13 * 3.4 * 0.7 * 1.0, Y(412) - 1.2], L: 'S-TITLE' });
    return B.E;
  }, 'MRWA project standard general notes (concrete, reinforcement, steelwork, timberwork, maintenance, piling, culverts) with the bar lap table.');

  // dimensions with the dimension line at an absolute model coordinate: horizontal (x1<x2, objects at y0, line at yl) / vertical (y1<y2)
  const dh = (v, x1, x2, y0, yl, txt, o) => v.dim(x1, y0, x2, y0, (yl - y0) / v.s, txt, o);
  const dv = (v, y1, y2, x0, xl, txt, o) => v.dim(x0, y1, x0, y2, -(xl - x0) / v.s, txt, o);
  // solid I section (plan, flanges horizontal): outline + fill
  function iSolid(v, cx, cy, s) { iSec(v, cx, cy, s, 0); v.fill([[cx - s.b / 2, cy + s.d / 2], [cx + s.b / 2, cy + s.d / 2], [cx + s.b / 2, cy + s.d / 2 - s.tf], [cx - s.b / 2, cy + s.d / 2 - s.tf]]); v.fill([[cx - s.b / 2, cy - s.d / 2], [cx + s.b / 2, cy - s.d / 2], [cx + s.b / 2, cy - s.d / 2 + s.tf], [cx - s.b / 2, cy - s.d / 2 + s.tf]]); v.fill([[cx - s.tw / 2, cy - s.d / 2], [cx + s.tw / 2, cy - s.d / 2], [cx + s.tw / 2, cy + s.d / 2], [cx - s.tw / 2, cy + s.d / 2]]); }
  // nut + washer seen side-on in plan (bolt axis along y), sitting on the face at y, growing in direction k (+1 up / -1 down)
  function nutY(v, x, y, k, d) { d = d || 20; v.rect(x - d * 0.9, k > 0 ? y : y - 3, d * 1.8, 3, 'S-BOLT'); v.rect(x - d * 0.75, k > 0 ? y + 3 : y - 3 - d * 0.8, d * 1.5, d * 0.8, 'S-BOLT'); }
  // FLOW arrow text at sheet px
  function flow(B, tx, ty) { T(B, tx, ty, 'FLOW', 2.6); const x = X(tx) + 4 * 2.6 * 0.66 + 1.5, y = Y(ty) + 1.3; B.E.push({ t: 'solid', p: [[x, y - 1.3], [x + 5, y], [x, y + 1.3]], L: 'S-TEXT' }); B.E.push({ t: 'line', a: [x, y], b: [x + 5, y], L: 'S-TEXT' }); }
  // arc dimension (centre cx,cy radius r between angles a0<a1 deg) with extension lines from radius r0, text along the arc
  function adim(v, cx, cy, r0, r, a0, a1, txt, sub0) {
    const rad = d => d * PI / 180, P0 = (rr, a) => [cx + rr * Math.cos(rad(a)), cy + rr * Math.sin(rad(a))];
    [a0, a1].forEach(a => v.line(...P0(r0, a), ...P0(r + 30 * v.s / 10, a), 'S-DIM')); v.arc(cx, cy, r, a0, a1, 'S-DIM');
    [[a0, 1], [a1, -1]].forEach(([a, k]) => { const p = v.P(...P0(r, a)), t = rad(a) + k * PI / 2, al = 2.2, aw = 0.7; v.add({ t: 'solid', p: [p, [p[0] + al * Math.cos(t) - aw * Math.sin(t), p[1] + al * Math.sin(t) + aw * Math.cos(t)], [p[0] + al * Math.cos(t) + aw * Math.sin(t), p[1] + al * Math.sin(t) - aw * Math.cos(t)]], L: 'S-DIM' }); });
    const am = (a0 + a1) / 2, ang = am - 90, p = v.P(...P0(r, am)), u = [Math.cos(rad(am)), Math.sin(rad(am))];
    v.add({ t: 'text', p: [p[0] + u[0] * 0.8, p[1] + u[1] * 0.8], s: txt, h: 2.0, al: 'c', v: 'b', ang, L: 'S-DIM' }); if (sub0) v.add({ t: 'text', p: [p[0] - u[0] * 0.8, p[1] - u[1] * 0.8], s: sub0, h: 1.9, al: 'c', v: 't', ang, L: 'S-DIM' });
  }
  // fabric ring (SL81) in plan: circle of radius r with cross-wire dots and a lap (double arc) between angles
  function fabRing(v, r, laps) { v.circ(0, 0, r, 'S-REO'); for (let a = 5; a < 360; a += 14) v.barEnd(r * Math.cos(a * PI / 180), r * Math.sin(a * PI / 180), 6); (laps || []).forEach(([a0, a1]) => v.arc(0, 0, r - 8, a0, a1, 'S-REO')); }

  // 2 PIER PILE REPAIR FOUNDATION TYPE 2A (1330-0002)
  def('pp2a', 'Piles', 'Pier pile repair foundation – Type 2A', '1330-0002', [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('D', 'Existing pile dia. (mm)', 400, { num: 1 }), P('pot', 'Pot diameter (mm)', 900, { num: 1 }), P('depth', 'Pot depth (mm)', 1250, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], R = (+p.pot || 900) / 2, H = +p.depth || 1250, D = +p.D || 400, d = s.d, b = s.b, tf = s.tf;
    const Dbig = max(D, 400), Dsm = 300;
    // ---------------- SECTION A (both bearing arrangements), 1:10
    [[428, true], [1198, false]].forEach(([cy, big]) => {
      const v = V(B, 10, 615, cy), Dp = big ? Dbig : Dsm;
      v.circ(0, 0, R, 'S-CONC'); fabRing(v, R - 75, [[108, 150], [-75, -22]]); v.circ(0, 0, Dp / 2, 'S-EXIST');
      // radial spikes φ10 x 250 (from the fabric into the pile)
      [[-1, 0], [1, 0]].forEach(([kx]) => { v.line(kx * (R - 75), 0, kx * Dp / 2, 0, 'S-BOLT'); v.line(kx * Dp / 2, 0, kx * (R - 325 + 15), 0, 'S-HIDDEN'); v.pl([[kx * (R - 310), 6], [kx * (R - 325), 0], [kx * (R - 310), -6]], false, 'S-BOLT'); });
      [-1, 1].forEach(k => v.line(0, k * (R - 75), 0, k * (d / 2 + (big ? 100 : 10)), 'S-BOLT'));
      if (big) {
        [-1, 1].forEach(k => { v.rect(-150, k > 0 ? d / 2 : -d / 2 - 100, 300, 100, 'S-NEW'); v.line(-150, k * (d / 2 + 10), 150, k * (d / 2 + 10), 'S-NEW'); [-70, 70].forEach(x => { nutY(v, x, k * (d / 2 + 10), k); nutY(v, x, k * (d / 2 - tf), -k); }); v.circ(0, k * (d / 2 + 50), 6, 'S-BOLT'); v.fill([[-4, k * (d / 2 + 50) - 4], [4, k * (d / 2 + 50) - 4], [4, k * (d / 2 + 50) + 4], [-4, k * (d / 2 + 50) + 4]], 'S-BOLT'); });
        v.line(-75, -d / 2, -75, d / 2, 'S-NEW'); v.line(75, -d / 2, 75, d / 2, 'S-NEW'); v.rect(-45, -45, 90, 90, 'S-NEW'); iSolid(v, 0, 0, s);
      } else {
        [-1, 1].forEach(k => { v.rect(-150, k > 0 ? d / 2 - 90 : -d / 2 - 10, 300, 100, 'S-NEW'); v.line(-150, k * d / 2, 150, k * d / 2, 'S-NEW'); [-70, 70].forEach(x => { nutY(v, x, k * (d / 2 + 10), k); nutY(v, x, k * (d / 2 - tf), -k); }); [-1, 1].forEach(kx => { const hx = kx * (b / 2 + 26), hy = k * (d / 2 - 40); v.circ(hx, hy, 6, 'S-BOLT'); v.fill([[hx - 4, hy - 4], [hx + 4, hy - 4], [hx + 4, hy + 4], [hx - 4, hy + 4]], 'S-BOLT'); }); });
        iSolid(v, 0, 0, s);
      }
      // dimensions
      if (big) { dv(v, -d / 2 - 100, -d / 2 - 50, 0, -245, '50', sub('(TYP.)')); } else { dv(v, -d / 2 - 10, -d / 2 + 40, 0, -245, '50', sub('(TYP.)')); dh(v, b / 2, b / 2 + 20, -d / 2 + 40, -R - 40, '20 MIN.', sub('(TYP.)')); }
      dh(v, -70, 70, -d / 2, -R - 110, '140', sub('(TYP.)')); dh(v, -150, 150, big ? -d / 2 - 100 : -d / 2 - 10, -R - 290, '300', sub('(TYP.)'));
      adim(v, 0, 0, R - 70, R + 270, 108, 150, '300 LAP', '(TYP.)');
      // notes
      const o = big ? 0 : 770;
      L(v, 70, R - 75, 772, 188 + o - (big ? 0 : 28), 'SL81 FABRIC\n(TYP.)');
      if (big) { L(v, 30, 20, 876, 276, 'SHIM BETWEEN UC AND BEARING\nPLATE TO ENSURE A TIGHT FIT\nBETWEEN CUT PILE FACE AND\nHALF-CAPS.'); L(v, -75, 30, 240, 352, '10FL BEARING\nPLATE'); }
      else L(v, 20, d / 2 - 60, 876, 1060, 'SHIM BETWEEN UC AND UAs TO\nENSURE A TIGHT FIT BETWEEN\nCUT PILE FACE AND HALF-CAPS.');
      L(v, 150, big ? -d / 2 - 70 : -d / 2 + 30, 880, big ? 483 : 1258, 'ANGLE SHALL BEAR ON SOLID TIMBER\n(TYP.)');
      L(v, big ? 0 : b / 2 + 26, big ? -d / 2 - 50 : -d / 2 + 40, 880, big ? 559 : 1355, 'φ12 HOLE FOR\nφ10x100 LONG SPIKE\n(TYP.)');
      L(v, -R * 0.62, -R * 0.78, 222, big ? 586 : 1358, 'φ900 CONCRETE\nFOOTING'.replace('900', String(2 * R)));
      mk(v, R + 190, 0, big ? 'B' : 'C', 180);
      flow(B, 263, cy + 20);
      VT(B, 530, cy + 382, 'SECTION A', 10, 'BEARING ARRANGEMENT FOR PILES ' + (big ? '≥' : '<') + ' φ350');
    });
    // ---------------- VIEW B / VIEW C (1:10), origin at the top of the cut pile
    [[415, true], [1190, false]].forEach(([py, big]) => {
      const v = V(B, 10, 1680, py), Dp = big ? Dbig : Dsm, yb = 16, top = 520;
      pileElev(v, 0, -640, 0, Dp); v.line(-Dp / 2, 0, Dp / 2, 0, 'S-EXIST');
      iElevWebV(v, 0, yb, top, s); zz(v, -d / 2 - 20, top, d / 2 + 20, top);
      [-1, 1].forEach(k => {
        if (big) aSec(v, k * d / 2, 0, 100, 150, 10, k, 1, 'S-NEW'); else aSec(v, k * (d / 2 + 10), 0, 100, 150, 10, -k, 1, 'S-NEW');
        const xo = big ? d / 2 + 10 : d / 2 + 10; v.bolt(k * (d / 2 - tf), 90, k * xo, 90, 20);
        const sx = big ? k * (d / 2 + 50) : k * (d / 2 - 40); v.spike(sx, 10, sx, -95);
      });
      if (big) { v.rect(-75, 0, 150, 10, 'S-NEW'); v.rect(-45, 10, 90, 6, 'S-NEW'); v.hatch([[-45, 10], [45, 10], [45, 16], [-45, 16]], 'ansi31', 'S-HATCH', 0.3); }
      else { v.rect(-d / 2 + 5, 10, d - 10, 6, 'S-NEW'); v.hatch([[-d / 2 + 5, 10], [d / 2 - 5, 10], [d / 2 - 5, 16], [-d / 2 + 5, 16]], 'ansi31', 'S-HATCH', 0.3); }
      dv(v, 90, 150, d / 2 + 10, big ? 365 : 330, '60', sub('(TYP.)')); dv(v, 0, 150, d / 2 + 10, big ? 520 : 440, '150');
      dh(v, -Dp / 2, Dp / 2, -640, big ? -650 : -670, 'φ ' + (big ? '≥' : '<') + ' 400');
      const o = big ? 0 : 1;
      L(v, 0, 13, big ? 1378 : 1360, big ? 166 : 979, 'SHIM 90x90x THICKNESS\nTO SUIT');
      L(v, -d / 2 - 30, 90, big ? 1277 : 1276, big ? 285 : 1062, '4-M20 BOLTS(SITE DRILL\nHOLES IN UC PILE AFTER\nSHIM IS IN PLACE)');
      L(v, big ? -d / 2 - 10 : -d / 2 - 10, big ? 30 : 30, big ? 1277 : 1278, big ? 387 : 1162, '150x100x10 UAx300 LONG\n(TYP.)');
      L(v, d / 2, 380, big ? 1847 : 1850, big ? 216 : 980, 'PROPOSED UC PILE');
      L(v, big ? d / 2 + 50 : d / 2 - 40, -50, big ? 1890 : 1850, big ? 507 : 1250, 'φ10 x 100 LONG SPIKE\n(TYP.)');
      if (big) L(v, 20, 5, 1838, 600, '150x10FLx150 LONG\nBEARING PLATE'); else L(v, -Dp / 2, -250, 1278, 1288, 'EXISTING TIMBER PILE');
      VT(B, 1616, big ? 740 : 1540, big ? 'VIEW B' : 'VIEW C', 10);
    });
    // ---------------- BRACING & TIE CONNECTION DETAIL (1:10)
    {
      const v = V(B, 10, 2589, 474), P1 = SEC['150PFC'], yo = d / 2 + P1.b, ws = 6, wt = 100;
      iSolid(v, 0, 0, s);
      [-1, 1].forEach(k => {
        cSecH(v, 0, k * yo, P1, -k); v.rect(-75, k > 0 ? yo : -yo - ws, 150, ws, 'S-NEW'); v.hatch([[-75, k * yo], [75, k * yo], [75, k * (yo + ws)], [-75, k * (yo + ws)]], 'ansi31', 'S-HATCH', 0.3);
        const w0 = yo + ws, w1 = w0 + wt; v.line(-260, k * w0, 260, k * w0, 'S-EXIST'); v.line(-260, k * w1, 260, k * w1, 'S-EXIST'); zz(v, -230, k * (w0 - 20), -230, k * (w1 + 20)); zz(v, 240, k * (w0 - 20), 240, k * (w1 + 20));
        nutY(v, 0, k * w1, k, 20); nutY(v, 0, k * (yo - P1.tw), -k, 20);
      });
      const re = yo + ws + wt + 50; v.line(-10, -re, -10, re, 'S-BOLT'); v.line(10, -re, 10, re, 'S-BOLT');
      v.weld(-75, -d / 2 - 2, -16, -4, { size: '4', len: '50-75', site: true, tail: 'TYP.' });
      L(v, -40, yo + ws / 2, 2167, 276, '150x(6,8,10 OR 12FL)x300 LONG\nGALV STEEL SHIM IF REQUIRED.\nTACK WELD STEEL SHIMS\nTOGETHER AND TO PFC PACKER\nAFTER PLACEMENT. MAKE\nGOOD GALV. SURFACE BY\nAPPLYING COLD GALV. (TYP.)');
      L(v, 75, yo - 10, 2752, 329, '150 PFC PACKER\n(GALV)\n(TYP.)'); L(v, s.tw / 2, 20, 2752, 466, 'PROPOSED PILE');
      L(v, -170, -(yo + ws + wt / 2), 2281, 580, 'EXISTING TIMBER\nBRACING/WALER\n(TYP.)', { dot: true });
      L(v, -15, -(yo - P1.tw - 8), 2257, 679, 'TACK WELD NUT TO\nPFC PACKER (TYP.)'); L(v, 30, -(yo + ws + wt + 2), 2754, 664, 'φ20 THREADED ROD\nWITH 1-65x5FLx65\nWASHER TO TIMBER\nFACE (TYP.)');
      UL(B, 2591, 662, 'PLAN');
      const e = V(B, 10, 2589, 928);
      iElevFlange(e, 0, -280, 280, s); e.line(0, -280, 0, 280, 'S-HIDDEN'); zz(e, -b / 2 - 15, 280, b / 2 + 15, 280); zz(e, -b / 2 - 15, -280, b / 2 + 15, -280);
      e.rect(-75, -150, 150, 300, 'S-NEW'); [-120, 120].forEach(y => e.line(-380, y, 250, y, 'S-EXIST')); [-90, 90].forEach(y => e.line(-380, y, 250, y, 'S-HIDDEN')); zz(e, -350, -140, -350, 140); zz(e, 225, -140, 225, 140);
      e.circ(0, 0, 11, 'S-BOLT'); dv(e, -150, 150, -75, -245, '300'); dv(e, -150, 0, -75, -190, '='); dv(e, 0, 150, -75, -190, '=');
      L(e, -60, 150, 2291, 798, '150 PFC PACKER\n300 LONG (GALV)'); L(e, b / 2, 230, 2749, 818, 'PROPOSED PILE'); L(e, 8, 6, 2749, 888, 'φ22 HOLE TO SUIT\nTHREADED ROD'); L(e, 150, -120, 2749, 1039, 'EXISTING TIMBER\nBRACING/WALER');
      UL(B, 2589, 1098, 'ELEVATION');
      VT(B, 2412, 1172, 'BRACING & TIE CONNECTION DETAIL', 10, 'TYPICAL FOR ALL STEEL PILE\nREPLACEMENTS WHERE TIMBER\nBRACING/WALERS ARE TO BE RETAINED');
    }
    // ---------------- ELEVATION 1:20, origin at the cut pile top
    {
      const v = V(B, 20, 617, 2008), gl = 250, tp = 400, bt = tp - H;
      v.pl([[-R, bt], [R, bt], [R, tp], [0, tp + 20], [-R, tp]], true, 'S-CONC');
      v.ground(R, R + 350, gl); v.ground(-R - 350, -R, gl); v.line(R + 350, gl, R + 1500, gl, 'S-TEXT'); lvl(v, R + 830, gl); T(B, 863, 1878, 'EXISTING G.L., PERMANENT WATER\nLEVEL OR HIGH TIDE LEVEL');
      lvl(v, -R - 280, 140); v.line(-R - 420, 140, -R - 100, 140, 'S-TEXT');
      pileElev(v, 0, -H + 150, 0, D); v.line(-D / 2, 0, D / 2, 0, 'S-EXIST');
      iElevFlange(v, 0, 16, 1300, s); zz(v, -b / 2 - 15, 1300, b / 2 + 15, 1300); v.rect(-150, 0, 300, 150, 'S-NEW'); [-70, 70].forEach(x => { v.circ(x, 90, 14, 'S-BOLT'); }); v.line(0, 0, 0, -100, 'S-BOLT');
      [-1, 1].forEach(k => { v.line(k * (R - 75), bt + 75, k * (R - 75), tp - 75, 'S-REO'); v.barEnd(k * (R - 75 + 14), tp - 75, 16); v.barEnd(k * (R - 75 + 14), bt + 75, 16); v.line(k * (R - 75), -375, k * (R - 325), -375, 'S-BOLT'); });
      dv(v, bt, tp, -R, -1660, H + ' MIN.'); dv(v, -750, 0, -R, -1250, '750'); dv(v, -750, -375, -R, -830, '='); dv(v, -375, 0, -R, -830, '=');
      dv(v, gl, tp, -R, -1250, '150', sub('MIN.')); dv(v, tp, tp + 20, -R, -830, '20'); dv(v, 0, gl, R, R + 1000, '250', sub('MIN.'));
      dh(v, -R, -R + 75, bt, bt - 230, '75', sub('COVER (TYP.)'));
      slope(v, -R + 30, -180, '4'); fin(v, 230, tp + 40, 'U2'); mk(v, R + 590, 140, 'A', -90, -12);
      L(v, b / 2, 1000, 728, 1738, 'PROPOSED UC PILE'); L(v, D / 2 - 20, 0, 803, 1790, 'CUT BACK PILE TO\nSOUND TIMBER');
      LL(v, [[R - 75 + 14, tp - 75], [R - 75 + 14, bt + 75]], 803, 2051, 'N16 HOOP BARS AT\nTOP & BOTTOM.'); L(v, R - 75, -500, 803, 2140, 'SL81 FABRIC');
      L(v, -R + 160, -375, 327, 2305, 'φ10 x 250 LONG\nSPIKE (TYP.)', { kink: [590, 2305] });
      // hoop lap sketch
      const hp = V(B, 20, 1010, 2060); hp.arc(0, 0, 95, 100, 440, 'S-REO'); hp.line(30, -90, 30, -150, 'S-DIM'); hp.line(-30, -90, -30, -150, 'S-DIM'); T(B, 1018, 2088, '500', 2.0); T(B, 1018, 2110, 'LAP', 2.0);
      UL(B, 632, 2352, 'ELEVATION');
      MT(B, 358, 2405, 'PIER PILE REPAIR FOUNDATION DETAIL - TYPE 2A', 20);
    }
    NB(B, 2302, 2331, [GN1, 'BASE OF PROPOSED UC PILE SHALL BE TRIMMED ON SITE TO SUIT.', 'HALF-CAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL\nPOSITIONS AND UNTIL CONCRETE HAS BEEN PLACED A MINIMUM OF 7 DAYS\nOR DEMONSTRATES COMPRESIVE STRENGTH OF 30MPa.'], TH, 16);
    return B.E;
  }, 'Steel UC stub pile seated on the cut-back timber pile with bolted bearing angles and cast in a 900 mm concrete pot; bracing/walers retained with PFC packers.');

  // timber pile cross-section as sketched on 1330-0003 (growth rings, radial splits, centre pipe); voids: stippled bolt-hole voids
  function pileX(v, r, o) {
    o = o || {}; v.circ(0, 0, r, 'S-EXIST');
    for (let a = 0; a < 360; a += 9) { const c = Math.cos(a * PI / 180), s0 = Math.sin(a * PI / 180); v.line(c * r * 0.86, s0 * r * 0.86, c * r * 0.97, s0 * r * 0.97, 'S-HATCH'); }
    [0.55, 0.72].forEach(k => [[20, 70], [110, 160], [200, 250], [290, 340]].forEach(([a0, a1]) => v.arc(0, 0, r * k, a0, a1, 'S-EXIST')));
    v.circ(0, 0, r * (o.pipe || 0.1), 'S-EXIST'); [15, 95, 160, 220, 300].forEach(a => { const c = Math.cos(a * PI / 180), s0 = Math.sin(a * PI / 180); v.pl([[c * r * (o.pipe || 0.1), s0 * r * (o.pipe || 0.1)], [c * r * 0.3 + s0 * r * 0.05, s0 * r * 0.3 - c * r * 0.05], [c * r * 0.48, s0 * r * 0.48]], false, 'S-EXIST'); });
    if (o.band) { v.line(-r * 0.78, r * 0.28, r * 0.78, r * 0.28, 'S-EXIST'); v.line(-r * 0.78, -r * 0.28, r * 0.78, -r * 0.28, 'S-EXIST'); v.line(-r * 0.78, -r * 0.28, -r * 0.78, r * 0.28, 'S-EXIST'); v.line(r * 0.78, -r * 0.28, r * 0.78, r * 0.28, 'S-EXIST'); }
    (o.voids || []).forEach(k => { const P0 = [[k * r * 0.35, -r * 0.3], [k * r * 0.75, -r * 0.38], [k * r * 0.82, 0], [k * r * 0.75, r * 0.38], [k * r * 0.35, r * 0.3], [k * r * 0.42, 0]]; v.pl(P0, true, 'S-EXIST'); });
  }
  // water level mark with label (W.L. (HIGH) etc.): label over a line, solid triangle, water lines under
  function wlm(v, x, y, lbl) { const p = v.P(x, y); v.add({ t: 'line', a: [p[0] - 6, p[1]], b: [p[0] + 14, p[1]], L: 'S-TEXT' }); v.add({ t: 'solid', p: [[p[0] - 1.6, p[1]], [p[0] + 1.6, p[1]], [p[0], p[1] - 2.2]], L: 'S-TEXT' }); [[-14, 14, 1.2], [-10, 10, 2.2], [-6, 6, 3.2]].forEach(([a, b, d]) => v.add({ t: 'line', a: [p[0] + a, p[1] - d], b: [p[0] + b, p[1] - d], L: 'S-GROUND' })); v.add({ t: 'text', p: [p[0] - 3, p[1] + 0.8], s: lbl, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
  // a round timber pile in elevation with long split lines (existing)
  function pileSplits(v, x, y0, y1, D) { const n = 7; for (let i = 0; i < n; i++) { const xx = x - D * 0.35 + i * D * 0.7 / (n - 1), a = y0 + (y1 - y0) * (0.08 + 0.1 * (i % 3)), b = y1 - (y1 - y0) * (0.1 + 0.07 * (i % 4)); v.pl([[xx, a], [xx + D * 0.03, (a + b) / 2], [xx - D * 0.02, b]], false, 'S-HATCH'); } }
  const NOTES4 = [GN1, 'SITE MEASURE AND FABRICATE SLEEVE WITH DIAMETERS TO\nSUIT GROUT THICKNESS IN THE RANGE 40 MIN. TO 75 MAX.\nAROUND PILES.', 'FOR CORROSION PROTECTION OF SLEEVES REFER TO\nSPECIFICATION.', 'DENSO WRAP "SEASHIELD SERIES 60 SYSTEM" OR SIMILAR\nAPPROVED TO BE APPLIED ACCORDING TO MANUFACTURER\'S\nSPECIFICATION, BY MANUFACTURER\'S PRE-QUALIFIED\nSUBCONTRACTORS. DETAILS OF PRE-QUALIFICATION OR\nMANUFACTURER\'S ENDORSEMENT OF THE SUBCONTRACTOR\nTO BE PROVIDED TO SUPERINTENDENT PRIOR TO THE\nCOMMENCEMENT OF WORKS.', 'CLEAN OUT DEBRIS AND DECOMPOSED TIMBER WITH HIGH\nPRESSURE WATER JETTING.', "EXPOSED TIMBER SURFACES WITH A 'CORK LIKE' DENSITY\nSHALL BE REMOVED TO EXPOSE A QUALITY OF WOOD\nWHICH WHEN DRILLED PRODUCES TIMBER PARTICLES WITH A\nDEGREE OF CONTINUITY OF 2-3mm LENGTH, NOT A POWDER."];

  // 3 PIER PILE REPAIR TYPE 4 (4A/4B/4C) + TYPE 5 (1330-0003, left half of the sheet)
  def('pp4', 'Piles', 'Pier pile repair – Types 4A/4B/4C & 5', '1330-0003', [P('D', 'Pile diameter (mm)', 400, { num: 1 }), P('zone', 'Deterioration zone (mm)', 870, { num: 1 })], (p) => {
    const B = new Builder(), D = +p.D || 400, Z = max(300, +p.zone || 870);
    // ---- TABLE OF TYPES OF PIER PILE REPAIRS - TYPE 4
    const cx = [247, 387, 672, 962, 1246], ry = [104, 382, 406, 504, 647, 754, 862], ln = (x1, y1, x2, y2) => B.E.push({ t: 'line', a: [X(x1), Y(y1)], b: [X(x2), Y(y2)], L: 'S-TEXT' });
    ln(387, 104, 1246, 104); [387, 672, 962, 1246].forEach(x => ln(x, 104, x, 862)); ln(247, 382, 247, 862); ry.slice(1).forEach(y => ln(247, y, 1246, y));
    T(B, 317, 400, 'TYPE', 2.4, 'c'); T(B, 530, 400, '4A', 2.4, 'c'); T(B, 817, 400, '4B', 2.4, 'c'); T(B, 1104, 400, '4C', 2.4, 'c');
    const lab = [[436, 'EXISTING\nTIMBER\nCONDITION'], [553, 'TIMBER\nCROSS\nSECTIONAL\nAREA'], [680, 'TIMBER\nSECTION\nSTABILITY'], [788, 'WORK\nREQUIRED']];
    lab.forEach(([y, s]) => String(s).split('\n').forEach((l, i) => T(B, 262, y + i * 22, l, 2.5)));
    const cells = [
      ['PILE TIMBER IN GOOD CONDITION.\nNUMEROUS SURFACE SPLITS. WIDTH AT\nFACE TYPICALLY 5mm TO 15mm AND\nREDUCING QUICKLY WITH DEPTH. SPLITS\nNOT INTERCONNECTING.', "SIMILAR TO '4A' BUT MORE SIGNIFICANT\nLOSS OF SECTION AT WALER BOLT\nLOCATIONS φ50 HOLES AND CENTRAL\nPIPE. TIMBER ANNULUS >90mm.", "SIMILAR TO '4B'. EVEN GREATER LOSS\nOF SECTION AT WALER BOLT LOCATIONS,\nSOME INTERCONNECTED. LARGER CENTRAL\nPIPE. SOME SPLITS JOIN WITH PIPE VOID.\nTIMBER ANNULUS <80mm."],
      ['90% ORIGINAL CROSS SECTIONAL AREA\nOF TIMBER CAPABLE OF CARRYING\nLOADING.', '70% ORIGINAL CROSS SECTIONAL AREA\nOF TIMBER CAPABLE OF CARRYING\nLOADING.', 'CAPABLE OF CARRYING AXIAL DEAD LOAD\nONLY DURING REPAIR PROCEDURE. NEED\nFOR STEEL SLEEVE TO SUPPLEMENT\nTIMBER STRENGTH. MINIMUM AREA OF\nGOOD TIMBER AVAILABLE SHALL BE\nEQUIVALENT TO 250 x 250mm\nSYMMETRICALLY LOCATED ABOUT THE\nPILE.'],
      ['GOOD', 'ADEQUATE', "CONSIDERATION FOR PILE STABILITY\nDURING THE WORKS. i.e. REMOVAL OF\nUNACCEPTABLE MATERIAL MAY REVEAL\nTHE CONDITION '4D'."],
      ['HIGH PRESSURE WATER JET PREPARATION.\nPLUG ONE END OF EXISTING BOLT HOLES\nAND FILL HOLE WITH EPIGEN 301 MRD\nEPOXY OR SIMILAR APPROVED.\nSEAL INDIVIDUAL SPLITS >10mm WIDTH\nWITH EPIGEN 1614 OR SIMILAR APPROVED.', 'HIGH PRESSURE WATER JET PREPARATION\nTHEN WRAP WITH 0.8 mm THICK CLEAR\nACRYLIC BEFORE APPLYING EPIGEN 301\nMRD EPOXY OR SIMILAR APPROVED.', 'HIGH PRESSURE WATER JET CLEAN,\nTHEN FIT STEEL SLEEVE AND FILL WITH\nCONBEXTRA UW GROUT OR SIMILAR\nAPPROVED.']];
    cells.forEach((row, r) => row.forEach((c, k) => String(c).split('\n').forEach((l, i) => T(B, cx[k + 1] + 9, ry[r + 2] + 19 + i * 16.5, l, 1.75))));
    // pile sketches above the table
    [[529, 245, {}], [816, 245, { voids: [-1, 1] }], [1100, 250, { voids: [-1, 1], pipe: 0.16 }]].forEach(([x, y, o], k) => {
      const v = V(B, 10, x, y), r = 200; pileX(v, r, Object.assign({ band: k === 0 }, o));
      if (k === 0) v.circ(0, 0, r + 8, 'S-HIDDEN');
      if (k === 1) { v.circ(0, 0, r + 8, 'S-NEW'); [-1, 1].forEach(s0 => v.hatch([[s0 * r * 0.35, -r * 0.3], [s0 * r * 0.75, -r * 0.38], [s0 * r * 0.82, 0], [s0 * r * 0.75, r * 0.38], [s0 * r * 0.35, r * 0.3], [s0 * r * 0.42, 0]], 'conc', 'S-HATCH', 0.5)); }
      if (k === 2) { v.circ(0, 0, r + 60, 'S-NEW'); v.circ(0, 0, r + 66, 'S-NEW'); v.hatch(ringPts(r, r + 60), 'conc', 'S-HATCH', 0.5); [-1, 1].forEach(s0 => { v.line(-12, s0 * (r + 66), -12, s0 * (r + 110), 'S-NEW'); v.line(12, s0 * (r + 66), 12, s0 * (r + 110), 'S-NEW'); v.line(-26, s0 * (r + 92), 26, s0 * (r + 92), 'S-NEW'); }); }
    });
    T(B, 205, 948, 'TABLE OF TYPES OF PIER PILE REPAIRS - TYPE 4', 3.2, 'l', 'S-TITLE'); ln(205, 955, 205 + 44 * 3.2 * 0.68 / K, 955);
    // ---- PIER PILE REPAIR DETAIL - TYPE 4 (1:20), origin at the bottom of pile 4A
    {
      const v = V(B, 20, 257, 1600), top = 2720, x2 = 2100, x3 = 4200, nt = [1330, 1760];
      // 4A: notch at the waler
      [-1, 1].forEach(k => v.pl([[k * D / 2, 0], [k * D / 2, nt[0]], [k * (D / 2 - 40), nt[0]], [k * (D / 2 - 40), nt[1]], [k * D / 2, nt[1]], [k * D / 2, top]], false, 'S-EXIST'));
      pend(v, 0, 0, D); pend(v, 0, top, D); pileSplits(v, 0, 0, top, D);
      L(v, D * 0.25, 1340, 367, 1321, 'SEAL INDIVIDUAL SPLITS\n>10mm WIDTH.\nFILL EXISTING BOLT\nHOLES WITH APPROVED\nEPOXY.');
      // 4B: acrylic wrap from 100 above W.L.(HIGH) to 300 below W.L.(LOW)
      const wh = 1550, wl = 1080, wt = wh + 100, wb = wl - 300;
      [-1, 1].forEach(k => v.pl([[x2 + k * D / 2, 0], [x2 + k * D / 2, nt[0]], [x2 + k * (D / 2 - 40), nt[0]], [x2 + k * (D / 2 - 40), nt[1]], [x2 + k * D / 2, nt[1]], [x2 + k * D / 2, top]], false, 'S-EXIST'));
      pend(v, x2, 0, D); pend(v, x2, top, D); pileSplits(v, x2, 0, top, D);
      v.rect(x2 - D / 2 - 15, wb, D + 30, wt - wb, 'S-NEW'); v.rect(x2 - D / 2 - 25, wb, D + 50, 90, 'S-NEW');
      wlm(v, x2 + 1020, wh, 'W.L.   (HIGH)'); wlm(v, x2 + 1020, wl, 'W.L.   (LOW)');
      dv(v, wl, wh, x2 + D / 2 + 30, x2 + 630, 'TIDAL', sub('RANGE')); dv(v, wb, wl, x2 + D / 2 + 30, x2 + 630, '300');
      v.line(x2 + D / 2 + 30, wt, x2 + 660, wt, 'S-DIM'); v.line(x2 + 630, wt, x2 + 630, wt + 520, 'S-TEXT'); v.arrow(x2 + 630, wt, -90, 'S-DIM'); v.line(x2 + 630, wt + 520, x2 + 690, wt + 520, 'S-TEXT');
      T(B, 819, 1148, 'TO BE ABOVE WALER\nNOTCH AND A 100 MIN\nABOVE W.L. (HIGH)');
      L(v, x2 - D / 2 - 15, wt, 404, 1180, 'WRAP PILE WITH\n0.8 mm THICK CLEAR\nACRYLIC & FILL WITH\nAPPROVED EPOXY.'); L(v, x2 - D / 2 - 25, wb + 45, 396, 1496, 'CONTAINMENT BY\nTOURNIQUET TAPE\nOR SIMILAR APPROVED.');
      // 4C: steel sleeve with grout, 750 overlap with sound timber each side of the deterioration zone
      const sb = 120, z0 = sb + 750, z1 = z0 + Z, st = z1 + 750, g = 55, Rs = D / 2 + g;
      v.line(x3 - D / 2, 0, x3 - D / 2, top, 'S-EXIST'); v.line(x3 + D / 2, 0, x3 + D / 2, top, 'S-EXIST'); pend(v, x3, 0, D); pend(v, x3, top, D); pileSplits(v, x3, 0, top, D);
      v.rect(x3 - Rs, sb, 2 * Rs, st - sb, 'S-NEW'); [sb, z0, z1, st].forEach(y => { v.line(x3 - Rs - 40, y, x3 + Rs + 40, y, 'S-NEW'); v.line(x3 - Rs - 40, y + 25, x3 + Rs + 40, y + 25, 'S-HIDDEN'); });
      v.hatch([[x3 - Rs, sb], [x3 - D / 2, sb], [x3 - D / 2, st], [x3 - Rs, st]], 'conc', 'S-HATCH', 0.5); v.hatch([[x3 + D / 2, sb], [x3 + Rs, sb], [x3 + Rs, st], [x3 + D / 2, st]], 'conc', 'S-HATCH', 0.5);
      dv(v, sb, z0, x3 + Rs + 40, x3 + 560, '750'); dv(v, z0, z1, x3 + Rs + 40, x3 + 560, 'DETERIORATION', sub('ZONE')); dv(v, z1, st, x3 + Rs + 40, x3 + 560, '750');
      [[sb, z0], [z1, st]].forEach(([a, b0]) => { const pp = v.P(x3 + 760, (a + b0) / 2); v.add({ t: 'text', p: [pp[0], pp[1]], s: 'OVERLAP WITH', h: 2.0, al: 'c', v: 'b', ang: 90, L: 'S-TEXT' }); v.add({ t: 'text', p: [pp[0] + 3.2, pp[1]], s: 'SOUND TIMBER', h: 2.0, al: 'c', v: 'b', ang: 90, L: 'S-TEXT' }); });
      L(v, x3 - Rs + 25, st - 200, 859, 1050, 'CONBEXTRA UW\nCEMENTITIOUS\nGROUT'); L(v, x3 - Rs, 600, 804, 1526, 'FOR SLEEVE DETAILS\nREFER TO DETAIL\n(TYP)');
      UL(B, 257, 1669, "TYPE '4A'", 3); UL(B, 691, 1669, "TYPE '4B'", 3); UL(B, 1125, 1669, "TYPE '4C'", 3);
      MT(B, 525, 1744, 'PIER PILE REPAIR DETAIL - TYPE 4', 20, 'FOR PREPARATION OF PILE SURFACE FOR GROUTING REFER NOTES 5 & 6', 'cross');
    }
    // ---- PIER PILE REPAIR DETAIL - TYPE 5 (1:20), origin at the bottom of the wrap
    {
      const v = V(B, 20, 550, 2278), wt = 1330, pw = 1026, gl = 513;
      v.line(-D / 2, -260, -D / 2, 1600, 'S-EXIST'); v.line(D / 2, -260, D / 2, 1600, 'S-EXIST'); pend(v, 0, -260, D); pend(v, 0, 1600, D);
      v.rect(-D / 2, 0, D, wt, 'S-NEW'); for (let y = -60; y < wt; y += 70) v.line(-D / 2, max(0, y), D / 2, min(wt, y + 60), 'S-NEW');
      v.line(-1000, pw, 1300, pw, 'S-TEXT'); v.ground(-1200, -D / 2, gl); v.ground(D / 2, 1450, gl); v.line(1450, gl, 2000, gl, 'S-TEXT');
      lvl(v, 1170, pw); lvl(v, 1170, gl); T(B, 712, 2022, 'PERMANENT WATER LEVEL\nOR HIGH TIDE LEVEL'); T(B, 710, 2140, 'EXISTING GROUND LEVEL');
      dv(v, pw, wt, -D / 2, -1220, '300'); dv(v, 0, wt, -D / 2, -1780, "'X'"); { const pp = v.P(-1640, wt / 2); v.add({ t: 'text', p: pp, s: 'AS DETAILED ON', h: 2.1, al: 'c', v: 'b', ang: 90, L: 'S-TEXT' }); v.add({ t: 'text', p: [pp[0] + 3.4, pp[1]], s: 'BRIDGE DRAWING', h: 2.1, al: 'c', v: 'b', ang: 90, L: 'S-TEXT' }); }
      v.line(-1850, 0, -D / 2, 0, 'S-DIM'); v.line(-1850, wt, -D / 2, wt, 'S-DIM');
      dv(v, 0, gl, D / 2, 1010, '500 MIN.'); v.line(D / 2, 0, 1080, 0, 'S-DIM');
      L(v, 60, wt, 712, 1907, 'DENSO WRAP "SEASHIELD SERIES 60 SYSTEM"\nOR SIMILAR APPROVED. REFER NOTE 4.');
      MT(B, 402, 2381, 'PIER PILE REPAIR DETAIL - TYPE 5', 20, null, 'xbox');
    }
    NB(B, 1330, 2005, NOTES4, TH, 15.5);
    return B.E;
  }, 'Treatment of deteriorated timber pier piles by condition: epoxy fill and split sealing (4A), acrylic wrap and epoxy (4B), grouted steel sleeve (4C), and Denso wrap (Type 5).');

  // 4 SLEEVE DETAIL TYPE 4C (1330-0003, right half of the sheet)
  def('pp4c', 'Piles', "Pier pile repair – Type '4C' sleeve detail", '1330-0003', [P('D', 'Pile diameter (mm)', 400, { num: 1 }), P('g', 'Grout thickness (40–75 mm)', 50, { num: 1 }), P('rot', 'Rot zone length (mm)', 700, { num: 1 })], (p) => {
    const B = new Builder(), D = +p.D || 400, g = max(40, min(75, +p.g || 50)), Z = max(300, +p.rot || 700), Rs = D / 2 + g;
    // ---- SECTIONS B and A (1:10)
    [[248, 'B'], [728, 'A']].forEach(([py, ch]) => {
      const v = V(B, 10, 1900, py), r = D / 2;
      pileX(v, r, { pipe: 0.12 }); v.circ(0, 0, Rs, 'S-NEW'); v.circ(0, 0, Rs + 5, 'S-NEW'); v.hatch(ringPts(r, Rs), 'conc', 'S-HATCH', 0.5);
      [-1, 1].forEach(k => { v.rect(k > 0 ? Rs : -Rs - 50, -8, 50, 6, 'S-NEW'); v.rect(k > 0 ? Rs : -Rs - 50, 2, 50, 6, 'S-NEW'); v.line(k * (Rs + 25), -26, k * (Rs + 25), 26, 'S-BOLT'); v.rect(k * (Rs + 25) - 12, 8, 24, 12, 'S-BOLT'); v.rect(k * (Rs + 25) - 12, -20, 24, 12, 'S-BOLT'); });
      if (ch === 'B') { [135, 45].forEach(a => { const c = Math.cos(a * PI / 180), s0 = Math.sin(a * PI / 180); v.line(c * (Rs + 40), s0 * (Rs + 40), c * (Rs - 160), s0 * (Rs - 160), 'S-BOLT'); v.line(c * (Rs + 40) - s0 * 15, s0 * (Rs + 40) + c * 15, c * (Rs + 40) + s0 * 15, s0 * (Rs + 40) - c * 15, 'S-BOLT'); }); v.line(0, -Rs - 40, 0, -Rs + 160, 'S-HIDDEN');
        L(v, Math.cos(135 * PI / 180) * (Rs + 20), Math.sin(135 * PI / 180) * (Rs + 20), 1533, 142, '3-φ16x200 LONG COACH\nSCREWS WITH NEOPRENE\nWASHERS EVENLY SPACED\nTO  SUPPORT SLEEVE\n(TOP & BOTTOM)'); L(v, Rs * 0.5, Rs * 0.87, 2026, 126, '5PL SLEEVE (ROLLED STEEL)');
        callup(v, Rs + 30, 0, 55, 2109, 226, 3, '(TYP)');
        L(v, 30, -60, 1998, 384, 'EXISTING TIMBER\nPILE', { kink: [1972, 384] });
      } else {
        v.circ(0, 0, Rs + 55, 'S-NEW'); v.circ(0, 0, Rs + 50, 'S-NEW');
        v.weld(-(Rs + 5) * 0.62, (Rs + 5) * 0.78, -12, 8, { size: '5', tail: 'TYP' });
        L(v, 20, Rs + 3, 1955, 568, '5PL SLEEVE (ROLLED STEEL)'); L(v, (Rs + 55) * 0.82, (Rs + 55) * 0.57, 2051, 629, '50x50x5 EA');
        callup(v, Rs + 30, 0, 55, 2112, 715, 2, '(TYP)');
        L(v, -(D / 2 + g / 2) * 0.7, -(D / 2 + g / 2) * 0.7, 1467, 848, 'CEMENTITIOUS GROUT CONBEXTRA\nUW BY FOSROC (OR SIMILAR\nAPPROVED) MIN 40mm THICK,\nMAX 75mm THICK BETWEEN PILE\nAND SLEEVE (TYP)'); L(v, 30, -60, 1956, 891, 'EXISTING TIMBER\nPILE', { kink: [1935, 891] });
      }
      flow(B, 1596, py + 10); VT(B, 1818, ch === 'B' ? 472 : 980, 'SECTION ' + ch, 10);
    });
    // ---- DETAILS 3 and 2 (1:2.5): longitudinal joint of the sleeve halves
    [[2540, 340, 3], [2540, 960, 2]].forEach(([px, py, n]) => {
      const v = V(B, 2.5, px, py), t = 5, lg = 50, gp = 5, Rc = 260;
      // sleeve plates (arcs about a centre to the left), grout beyond
      [-1, 1].forEach(k => { v.pl(Array.from({ length: 9 }, (_, i) => { const a = k * (1 + i * 2.6) * PI / 180; return [-Rc + Rc * Math.cos(a), Rc * Math.sin(a)]; }), false, 'S-NEW'); v.pl(Array.from({ length: 9 }, (_, i) => { const a = k * (1 + i * 2.6) * PI / 180; return [-Rc + (Rc - t) * Math.cos(a), (Rc - t) * Math.sin(a)]; }), false, 'S-NEW'); });
      const gp0 = Array.from({ length: 13 }, (_, i) => { const a = (-28 + i * 56 / 12) * PI / 180; return [-Rc + (Rc - t) * Math.cos(a), (Rc - t) * Math.sin(a)]; }); v.hatch(gp0.concat([[-70, 115], [-75, -115]]), 'conc', 'S-HATCH', 0.25);
      v.pl([[-48, 118], [-62, 60], [-40, 20], [-80, 0], [-62, -60], [-48, -118]], false, 'S-TEXT');
      [-1, 1].forEach(k => { aSec(v, 0, k * gp, lg, lg, 6, 1, k, 'S-NEW'); v.fill([[30 - 9, k * (gp + 6)], [30 + 9, k * (gp + 6)], [30 + 9, k * (gp + 10)], [30 - 9, k * (gp + 10)]], 'S-BOLT'); });
      v.line(30, -gp - 16, 30, gp + 16, 'S-CL'); v.fill([[18, -gp + 0.5], [42, -gp + 0.5], [42, gp - 0.5], [18, gp - 0.5]], 'S-BOLT'); v.rect(-t, -10, t, 20, 'S-NEW');
      if (n === 2) { [-1, 1].forEach(k => v.pl(Array.from({ length: 9 }, (_, i) => { const a = k * (2 + i * 3.4) * PI / 180; return [-Rc + (Rc + 55) * Math.cos(a), (Rc + 55) * Math.sin(a)]; }), false, 'S-NEW')); v.line(52, 95, 52, -95, 'S-HIDDEN'); }
      const o = n === 3 ? 0 : 710;
      T(B, 2564, 132 + (n === 3 ? 0 : 597), '℄ φ18 HOLE'); v.line(30, gp + 20, 30, gp + 80, 'S-CL');
      dv(v, -gp, gp, 50, 90, '10'); dv(v, gp, gp + 15, -20, -55, '15');
      L(v, -6, 60, 2287, 225 + (n === 3 ? 0 : 573), 'SLEEVE');
      if (n === 3) {
        dh(v, 30, 50, gp + 6, gp + 60, '20');
        L(v, 50, gp + 6, 2706, 272, '50x50x6 EA\n(TYP)');
        v.weld(0, gp + 30, -6, 34, { size: '5', all: true, tail: 'TYP' }); v.weld(50, -gp - 3, 12, -14, { size: '5', all: true, tail: 'TYP' });
        weldT(v, -2, -60, -4, -30, { size: '5' }, 'TOP, BOTTOM\n& SIDE (TYP)');
        L(v, -t, -gp - 3, 2593, 527, '5FL (TYP)', { kink: [2580, 527] });
        // enlarged weld sketch
        const e = V(B, 1, 3002, 535); e.circ(0, 0, 27, 'S-TEXT'); e.rect(-10, -30, 3.5, 34, 'S-NEW'); e.line(-3, -32, -3, 18, 'S-NEW'); e.pl([[1, -32], [1, -4], [5, 0], [26, 0]], false, 'S-NEW'); e.line(-3, 4, 26, 4, 'S-NEW'); e.fill([[-3, 4], [1, 4], [-3, 0]], 'S-NEW');
        dh(e, -6.5, -3, 18, 26, '5'); dv(e, 0, 4, -10, -16, '5'); v.add({ t: 'line', a: v.P(0, 0), b: [X(2965), Y(538)], L: 'S-TEXT' });
        e.weld(-2, 3, 18, 20, { size: '' }); L(e, -6.5, -24, 2794, 622, '5PL SLEEVE'); L(e, 1, -20, 3070, 625, '50x50x6 EA');
        VT(B, 2469, 625, 'DETAIL 3', 2.5);
      } else {
        L(v, 50, gp + 6, 2729, 879, '50x50x6 EA (FOR\nDETAILS OF WELDING\nREFER TO DETAIL (3)\nABOVE (TYP)');
        weldT(v, 4, gp + 50, 30, 28, { size: '5' }, 'TOP AND\nBOTTOM OF\nANGLE (TYP)'); v.weld(-3, -80, 34, -28, { size: '', tail: 'TYP' });
        VT(B, 2469, 1213, 'DETAIL 2', 2.5);
      }
    });
    // ---- DETAIL 1 (1:5): bottom of the sleeve at the longitudinal joint
    {
      const v = V(B, 5, 2600, 1560), t = 5;
      v.rect(-60, 0, 50, 220, 'S-NEW'); v.line(-54, 0, -54, 220, 'S-HIDDEN'); v.rect(-10, 0, t, 260, 'S-NEW'); v.rect(-5, 0, g, 240, 'S-NEW'); v.hatch([[-5, 8], [g - 5, 8], [g - 5, 240], [-5, 240]], 'conc', 'S-HATCH', 0.4);
      v.line(85, -60, 85, 260, 'S-EXIST'); zz(v, -90, 250, 10, 250); zz(v, 40, 255, 110, 255); zz(v, 60, -55, 120, -55);
      [40, 105, 170].forEach(y => { v.rect(-50, y - 12, 32, 24, 'S-BOLT'); v.circ(-34, y, 9, 'S-BOLT'); });
      v.fill([[-60, 0], [g - 5, 0], [g - 5, 8], [-60, 8]], 'S-NEW'); v.fill([[-60, -10], [g - 5, -10], [g - 5, -4], [-60, -4]], 'S-TEXT');
      dv(v, 0, 5, -60, -115, '5'); dv(v, 5, 40, -60, -115, ''); dv(v, 40, 105, -60, -115, '65'); dv(v, 105, 170, -60, -115, '65'); dv(v, 170, 235, -60, -115, '65'); dv(v, 235, 240, -60, -115, '5');
      L(v, -55, 245, 2306, 1309, '2-50x50x6 EA BOTH\nSIDES.'); L(v, -8, 255, 2670, 1306, 'SLEEVE'); L(v, -25, 170, 2737, 1363, '3-M16 8.8 BOLTS WITH\n40x5 FLx40 WASHERS\n(TYP)'); L(v, 20, 60, 2737, 1453, 'CEMENTITIOUS\nGROUT'); L(v, 85, -40, 2737, 1531, 'EXISTING TIMBER\nPILE', { dot: true });
      L(v, -55, 4, 2302, 1486, '50x50x5 EA TOP,\nBOTTOM & EACH\nEND OF ROT ZONE\n(750 MAX CRS)\n(TYP)'); L(v, -40, -7, 2302, 1633, 'PLYWOOD FORMWORK\nMAY BE USED AS\nTEMPORARY SEAL\nAROUND BOTTOM OF\nSLEEVE'); L(v, 20, -7, 2630, 1663, 'COMPRIBAND OR SIMILAR\nAPPROVED SEAL AROUND\nBOTTOM OF FORMWORK\n(TYP)', { kink: [2612, 1663] });
      VT(B, 2537, 1803, 'DETAIL 1', 5);
    }
    // ---- SLEEVE DETAIL (1:20), origin at the bottom of the sleeve
    {
      const v = V(B, 20, 1900, 1676), st = 750 + Z + 750, f = Rs + 50;
      v.line(-D / 2, -200, -D / 2, st + 230, 'S-EXIST'); v.line(D / 2, -200, D / 2, st + 230, 'S-EXIST'); pend(v, 0, -200, D); pend(v, 0, st + 230, D);
      v.rect(-Rs, 0, 2 * Rs, st, 'S-NEW'); [-1, 1].forEach(k => { v.rect(k > 0 ? Rs : -f, 0, 50, st + 20, 'S-NEW'); for (let y = 30; y < st; y += 110) { v.circ(k * (Rs + 25), y, 9, 'S-BOLT'); v.fill([[k * (Rs + 25) - 5, y - 5], [k * (Rs + 25) + 5, y - 5], [k * (Rs + 25) + 5, y + 5], [k * (Rs + 25) - 5, y + 5]], 'S-BOLT'); } });
      [0, 750, 750 + Z, st].forEach(y => { v.rect(-f, y - 25, 2 * f, 25, 'S-NEW'); });
      v.line(0, 250, 0, 300, 'S-HIDDEN'); v.line(0, st - 250, 60, st - 250, 'S-HIDDEN');
      dv(v, 0, 750, f, f + 450, '750'); dv(v, 750, 750 + Z, f, f + 450, 'ROT ZONE'); dv(v, 750 + Z, st, f, f + 450, '750'); dv(v, 0, st, f, f + 950, 'LENGTH TO SUIT');
      dv(v, st - 750, st - 375, f, f + 270, '='); dv(v, st - 375, st, f, f + 270, '='); dv(v, st - 250, st, -f, -f - 280, '250'); dv(v, 0, 250, f, f + 210, '250'); dv(v, st, st + 20, -f, -f - 450, '20');
      mk(v, -f - 900, st - 250, 'B', -90, 12); mk(v, -f - 900, 0, 'A', -90, 12); lvl(v, 1590, st - 250); lvl(v, 1460, 0);
      v.add({ t: 'pl', p: ellP(-Rs - 25, 40, 70, 170, 24).map(q => v.P(q[0], q[1])), closed: true, L: 'S-TEXT' }); num(v, -f - 150, 400, '1');
      flow(B, 1598, 1495);
      L(v, 0, st - 400, 1551, 1173, 'SLEEVE. REFER NOTES 2 & 3', { kink: [1820, 1173] }); L(v, D / 2, st + 150, 2014, 1194, 'EXISTING TIMBER\nPILE'); L(v, -Rs - 25, st - 180, 1638, 1361, 'M16 8.8 BOLTS\n(TYP)');
      L(v, 0, 270, 1706, 1754, 'COACH SCREW\n(TYP)', { kink: [1853, 1754] }); L(v, Rs + 50, -20, 1995, 1728, '50x50x5 EA TOP, BOTTOM &\nEACH END OF ROT ZONE\n(750 MAX CRS)', { kink: [1975, 1728] });
      VT(B, 1806, 1826, 'SLEEVE DETAIL', 20);
      T(B, 1982, 1901, "SLEEVE DETAIL - PIER PILE REPAIR - TYPE '4C'", 3.4, 'l', 'S-TITLE'); B.E.push({ t: 'line', a: [X(1982), Y(1901) - 1.2], b: [X(1982) + 42 * 3.4 * 0.66, Y(1901) - 1.2], L: 'S-TITLE' });
    }
    NB(B, 2445, 2005, NOTES4, TH, 15.5);
    return B.E;
  }, 'Grouted rolled-steel sleeve (Type 4C) for a timber pier pile whose deteriorated zone can carry dead load only: sections, joint and base details.');

  // ---- shared pile-bearing helpers (UC on a cut timber pile, 1330-0002 / 0004)
  // I section in plan with the web horizontal (flanges vertical at x = ±d/2), solid
  function iSolidR(v, cx, cy, s) { iSec(v, cx, cy, s, 1); [-1, 1].forEach(k => v.fill([[cx + k * s.d / 2, cy - s.b / 2], [cx + k * (s.d / 2 - s.tf), cy - s.b / 2], [cx + k * (s.d / 2 - s.tf), cy + s.b / 2], [cx + k * s.d / 2, cy + s.b / 2]])); v.fill([[cx - s.d / 2, cy - s.tw / 2], [cx + s.d / 2, cy - s.tw / 2], [cx + s.d / 2, cy + s.tw / 2], [cx - s.d / 2, cy + s.tw / 2]]); }
  function nutX(v, x, y, k, d) { d = d || 20; v.rect(k > 0 ? x : x - 3, y - d * 0.9, 3, d * 1.8, 'S-BOLT'); v.rect(k > 0 ? x + 3 : x - 3 - d * 0.8, y - d * 0.75, d * 0.8, d * 1.5, 'S-BOLT'); }
  const hole = (v, x, y, r) => { v.circ(x, y, r || 6, 'S-BOLT'); v.fill([[x - 4, y - 4], [x + 4, y - 4], [x + 4, y + 4], [x - 4, y + 4]], 'S-BOLT'); };
  // bearing arrangement in plan, web horizontal: big = angles outside the flanges on a bearing plate (pile ≥ φ400); else angles under the UC
  function brgPlan(v, s, big, Dp) {
    const d = s.d, tf = s.tf; v.circ(0, 0, Dp / 2, 'S-EXIST');
    [-1, 1].forEach(k => {
      if (big) { v.rect(k > 0 ? d / 2 : -d / 2 - 100, -150, 100, 300, 'S-NEW'); v.line(k * (d / 2 + 10), -150, k * (d / 2 + 10), 150, 'S-NEW'); hole(v, k * (d / 2 + 55), 0); }
      else { v.rect(k > 0 ? d / 2 - 90 : -d / 2 - 10, -150, 100, 300, 'S-NEW'); v.line(k * d / 2, -150, k * d / 2, 150, 'S-NEW'); [-110, 110].forEach(y => hole(v, k * (d / 2 - 45), y)); }
      [-70, 70].forEach(y => { nutX(v, k * (d / 2 + 10), y, k); nutX(v, k * (d / 2 - tf), y, -k); });
    });
    if (big) { v.line(-d / 2 + tf, 75, d / 2 - tf, 75, 'S-NEW'); v.line(-d / 2 + tf, -75, d / 2 - tf, -75, 'S-NEW'); }
    v.rect(-45, -45, 90, 90, 'S-NEW'); iSolidR(v, 0, 0, s);
  }
  // bearing arrangement in elevation (flanges seen edge-on), origin at the top of the cut pile; returns spike x
  function brgElev(v, s, big, Dp, top) {
    const d = s.d, tf = s.tf; pileElev(v, 0, -480, 0, Dp); v.line(-Dp / 2, 0, Dp / 2, 0, 'S-EXIST');
    iElevWebV(v, 0, 16, top, s); zz(v, -d / 2 - 20, top, d / 2 + 20, top);
    [-1, 1].forEach(k => { if (big) aSec(v, k * d / 2, 0, 100, 150, 10, k, 1, 'S-NEW'); else aSec(v, k * (d / 2 + 10), 0, 100, 150, 10, -k, 1, 'S-NEW'); v.bolt(k * (d / 2 - tf), 90, k * (d / 2 + 10), 90, 20); const sx = big ? k * (d / 2 + 55) : k * (d / 2 - 45); v.spike(sx, 10, sx, -95); });
    if (big) { v.rect(-75, 0, 150, 10, 'S-NEW'); v.rect(-45, 10, 90, 6, 'S-NEW'); } else v.rect(-d / 2 + 5, 10, d - 10, 6, 'S-NEW');
    v.hatch([[-45, 10], [45, 10], [45, 16], [-45, 16]], 'ansi31', 'S-HATCH', 0.3);
  }
  // existing timber sheeting in plan: two dash-dot faces (front face at x0, thickness t going -x) between y0..y1 with break ticks
  function sheetV(v, x0, y0, y1, t) { t = t || 50; v.line(x0, y0, x0, y1, 'S-EXIST'); v.line(x0 - t, y0, x0 - t, y1, 'S-EXIST'); zz(v, x0 - t - 20, y1, x0 + 20, y1); zz(v, x0 - t - 20, y0, x0 + 20, y0); }
  // wing wall sheeting running off at angle a (deg) from (x,y), length l, with tufts on the fill side
  function wingS(v, x, y, a, l, t) { t = t || 50; const c = Math.cos(a * PI / 180), s0 = Math.sin(a * PI / 180), nx = -s0, ny = c; v.line(x, y, x + c * l, y + s0 * l, 'S-EXIST'); v.line(x + nx * t, y + ny * t, x + c * l + nx * t, y + s0 * l + ny * t, 'S-EXIST'); for (let i = 1; i < 7; i++) { const px = x + nx * t + c * l * i / 7, py = y + ny * t + s0 * l * i / 7; v.line(px, py, px + nx * 40 + c * 25, py + ny * 40 + s0 * 25, 'S-HATCH'); } v.line(x + c * l - nx * 20, y + s0 * l - ny * 20, x + c * l + nx * (t + 20), y + s0 * l + ny * (t + 20), 'S-TEXT'); }
  // earth tufts along an edge from (x1,y1) to (x2,y2) on the side n = (nx,ny)
  function tuftE(v, x1, y1, x2, y2, nx, ny) { const L0 = Math.hypot(x2 - x1, y2 - y1), n = max(2, Math.floor(L0 / (3 * v.s))); for (let i = 0; i <= n; i++) { const t = i / n, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t; v.line(px, py, px + nx * 1.6 * v.s + (y2 - y1) / L0 * 1.2 * v.s, py + ny * 1.6 * v.s + (x2 - x1) / L0 * 1.2 * v.s, 'S-HATCH'); } }
  // fabric square (cover c inside the rectangle x0..x1, y0..y1) with cross-wire dots and optional corner bars
  function fabRect(v, x0, y0, x1, y1, c, bars) { v.rect(x0 + c, y0 + c, x1 - x0 - 2 * c, y1 - y0 - 2 * c, 'S-REO'); const sp = 160; for (let x = x0 + c + sp / 2; x < x1 - c; x += sp) { v.barEnd(x, y0 + c + 8, 6); v.barEnd(x, y1 - c - 8, 6); } for (let y = y0 + c + sp / 2; y < y1 - c; y += sp) { v.barEnd(x0 + c + 8, y, 6); v.barEnd(x1 - c - 8, y, 6); } if (bars) [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y]) => v.barEnd(x + (x === x0 ? 1 : -1) * (c + 18), y + (y === y0 ? 1 : -1) * (c + 18), 20)); }

  // 5 ABUTMENT PILE REPAIR FOUNDATION TYPE 1A (1330-0004)
  def('ap1a', 'Piles', 'Abutment pile repair foundation – Type 1A', '1330-0004', [P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('D', 'Existing pile dia. (mm)', 400, { num: 1 }), P('depth', 'Pot depth (mm)', 1250, { num: 1 })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['200UC52'], D = +p.D || 400, H = +p.depth || 1250, d = s.d, b = s.b, nm = secName(p.uc);
    // ---- SECTION C (1:20) through the sheeting above the pot
    {
      const v = V(B, 20, 659, 203), xf = -d / 2 - 75;
      sheetV(v, xf, -420, 330, 45); wingS(v, xf - 45, -40, 225, 480, 45); v.rect(xf, -b / 2, 75, b, 'S-NEW'); iSolidR(v, 0, 0, s);
      [-60, 60].forEach(y => v.line(xf - 30, y, -d / 2 - 15, y, 'S-BOLT'));
      L(v, xf - 20, 250, 378, 112, 'EXISTING TIMBER\nSHEETING'); L(v, xf - 330, -320, 244, 199, 'EXISTING WING WALL\nTIMBER SHEETING\n(IF PROPOSED REPAIR IS\nAT CORNER PILE).');
      L(v, xf + 10, 70, 739, 108, 'M12 × 75 LONG COACH SCREWS\nAT 200 CRS. (TIMBER PACKER\nONLY)'); L(v, d / 2, 40, 739, 242, 'PROPOSED STEEL PILE', { kink: [700, 242] });
      L(v, xf + 30, -80, 739, 285, 'SEASONED JARRAH TIMBER PACKER 75mm\nMIN. THICK OR STEEL SHIMS TO ENSURE\nTIGHT FIT BETWEEN PROPOSED PILE AND\nEXISTING TIMBER SHEETING. REFER NOTE 5.');
      VT(B, 559, 401, 'SECTION C', 20);
    }
    // ---- SECTIONAL PLAN B (1:20)
    {
      const v = V(B, 20, 671, 662), xs = -330, x0 = -265, x1 = 485;
      sheetV(v, xs, -750, 650, 45); wingS(v, xs - 45, -120, 225, 520, 45);
      v.rect(x0, -450, x1 - x0, 900, 'S-CONC'); fabRect(v, x0, -450, x1, 450, 40, true);
      tuftE(v, x0 + 100, 450, x1 + 60, 450, 0, 1); tuftE(v, x0 + 100, -450, x1 + 60, -450, 0, -1); tuftE(v, x1, -440, x1, 440, 1, 0);
      v.circ(0, 0, D / 2, 'S-HIDDEN'); brgPlan(v, s, true, 0.01);
      dh(v, x0, x1, 450, 720, '750'); dv(v, -450, 450, x1, x1 + 350, '900');
      dh(v, xs, x0, -450, -820, '60 MIN.'); v.line(-1300, -870, -150, -870, 'S-DIM'); T(B, 476, 838, 'IF LESS THAN 60 REFER\nPILE MODIFICATION DETAIL', TH, 'c');
      L(v, xs, 450, 284, 509, 'EXISTING TIMBER\nSHEETING'); L(v, x0 + 40, 340, 239, 629, 'SL81 FABRIC (GALV.)'); L(v, xs - 450, -480, 246, 716, 'EXISTING WING WALL\nTIMBER SHEETING.\n(IF PROPOSED REPAIR IS\nAT CORNER PILE).');
      L(v, 0, 60, 875, 453, 'REFER PILE BEARING\nARRANGEMENT\nDETAILS', { kink: [852, 453] }); L(v, x1 - 40, -300, 876, 811, 'SL81 FABRIC', { kink: [852, 811] });
      VT(B, 556, 953, 'SECTIONAL PLAN B', 20);
    }
    // ---- SECTION A (1:20) through the pot
    {
      const v = V(B, 20, 676, 1304), x0 = -410, x1 = 490, y0 = -455, y1 = 445;
      v.rect(x0, y0, x1 - x0, y1 - y0, 'S-CONC'); v.rect(x0 - 20, y0 - 30, 20, y1 - y0 + 30, 'S-NEW'); v.fill([[x0 - 20, y0 - 30], [x0, y0 - 30], [x0, y1], [x0 - 20, y1]], 'S-NEW');
      v.line(x0 + 50, y1 + 200, x0 + 50, y1 - 60, 'S-EXIST'); v.line(x0 + 95, y1 + 200, x0 + 95, y1 - 60, 'S-EXIST'); v.line(x0 + 50, y1 - 60, x0 + 95, y1 - 60, 'S-EXIST'); zz(v, x0 + 30, y1 + 200, x0 + 115, y1 + 200);
      wingS(v, x0 - 20, -40, 225, 450, 45);
      v.rect(x0 + 40, y0 + 40, x1 - x0 - 135, y1 - y0 - 135, 'S-REO'); [[x0 + 58, y0 + 58], [x1 - 113, y0 + 58], [x1 - 113, y1 - 113], [x0 + 58, y1 - 113]].forEach(q => v.barEnd(q[0], q[1], 20));
      for (let x = x0 + 120; x < x1 - 95; x += 140) { v.barEnd(x, y0 + 48, 6); v.barEnd(x, y1 - 103, 6); }
      tuftE(v, x0 + 280, y1, x1 + 60, y1, 0, 1); tuftE(v, x0 + 280, y0, x1 + 60, y0, 0, -1);
      v.circ(0, 0, D / 2, 'S-HIDDEN'); v.spike(-50, 170, -50, -80); v.spike(260, -20, 10, -20);
      v.add({ t: 'text', p: v.P(x0 + 170, y1 + 170), s: '40', h: 2.0, al: 'c', v: 'b', ang: -45, L: 'S-DIM' }); v.add({ t: 'text', p: v.P(x0 + 230, y1 + 120), s: 'COVER', h: 2.0, al: 'c', v: 'b', ang: -45, L: 'S-DIM' }); v.line(x0 + 60, y1 - 20, x0 + 250, y1 + 170, 'S-DIM');
      dv(v, y1 - 95, y1, x0, -1080, '95 COVER', sub('(TYP.)')); dv(v, y1 - 40, y1, x0, -765, '40', sub('(TYP.)')); dv(v, y0, y1, x1, 915, '900');
      dh(v, x0, x0 + 150, y0, -750, '150'); dh(v, x0, x1, y0, -990, '900');
      L(v, x0 + 50, y1 + 100, 238, 1118, 'FRONT FACE OF EXISTING\nTIMBER SHEETING'); L(v, x0 + 90, y1 - 30, 741, 1038, 'IF TIMBER SHEETING OCCURS AT\nPROPOSED CONCRETE LOCATION,\nCUT TIMBER AND KEY INTO\nCONCRETE AS SHOWN\n(SECTION (A) ONLY) (TYP.)', { kink: [714, 1038] });
      L(v, x1 - 95, y1 - 140, 920, 1186, 'SL81 FABRIC (TYP.) MESH CAN BE\nPREFABRICATED INTO 2400\nLENGTHS AND CUT TO SUIT ON SITE'); L(v, D / 2, 30, 920, 1280, 'EXISTING TIMBER PILE');
      L(v, x0 - 20, -50, 218, 1382, 'TRIM EXISTING WINGWALL\nSHEETING AT FACE OF\nFORMWORK'); L(v, 260, -20, 920, 1453, 'φ10x250 LONG SPIKE\n(TYP.)', { kink: [888, 1453] });
      L(v, x0 - 20, y0, 355, 1508, 'PERMANENT\nFORMWORK'); L(v, x0 + 58, y0 + 58, 920, 1549, '4-N20', { kink: [888, 1549] });
      VT(B, 585, 1580, 'SECTION A', 20);
    }
    // ---- ELEVATION (1:20), origin at the cut pile top
    {
      const v = V(B, 20, 664, 2015), gl = 250, tp = 400, bt = tp - H, xr = 440, xl = -380, xs = -230;
      v.pl([[xs, tp], [0, tp + 20], [xr, tp], [xr, bt], [xl, bt], [xl, 200], [xs, 200]], true, 'S-CONC'); v.fill([[xl - 20, bt], [xl, bt], [xl, 200], [xl - 20, 200]], 'S-NEW');
      v.line(xs, 200, xs, 1500, 'S-EXIST'); v.line(xs - 45, 200, xs - 45, 1500, 'S-EXIST'); v.line(xs - 45, 200, xs, 200, 'S-EXIST'); zz(v, xs - 65, 1500, xs + 20, 1500);
      v.rect(xs, tp, -d / 2 - xs, 1100, 'S-NEW'); v.hatch([[xs, tp], [-d / 2, tp], [-d / 2, tp + 1100], [xs, tp + 1100]], 'timber', 'S-HATCH', 0.5);
      v.ground(xr, xr + 330, gl); v.line(xr + 330, gl, xr + 1150, gl, 'S-TEXT'); lvl(v, xr + 700, gl);
      pileElev(v, 0, bt - 350, 0, D); v.line(-D / 2, 0, D / 2, 0, 'S-EXIST');
      iElevFlange(v, 0, 16, 1700, s); zz(v, -b / 2 - 15, 1700, b / 2 + 15, 1700); v.rect(-150, 0, 300, 150, 'S-NEW'); [-70, 70].forEach(x => v.circ(x, 90, 14, 'S-BOLT'));
      v.line(xr - 75, bt + 75, xr - 75, tp - 75, 'S-REO'); v.line(xl + 75, bt + 75, xl + 75, 190, 'S-REO'); v.line(xs + 25, 210, xs + 25, tp - 40, 'S-REO');
      [tp - 75, 200, bt + 75].forEach(y => v.barEnd(xr - 75 + 14, y, 16)); v.line(xr - 75, -375, xr - 325, -375, 'S-BOLT');
      dv(v, bt, tp, xr, 1330, H + ' MIN.'); dv(v, 0, gl, xr, 1030, '250', sub('MIN.')); dv(v, gl, tp, xr, 1030, '150'); dv(v, tp, tp + 20, xr, 650, '20');
      dv(v, 0, 200, xl, -1100, '200'); dv(v, -750, 0, xl, -1100, '750'); dv(v, -750, -375, xl, -900, '='); dv(v, -375, 0, xl, -900, '=');
      dh(v, xs, xs + 25, tp + 700, tp + 1000, '25 COVER'); dh(v, xr - 75, xr, bt, bt - 300, '75 COVER', sub('(TYP.)')); dv(v, bt, bt + 75, xr, 640, '75 COVER', sub('(TYP.)'));
      slope(v, xr - 140, -240, '4'); fin(v, 380, tp + 30, 'U2');
      mk(v, -800, 1000, 'C', -90, 12); mk(v, -1390, 270, 'B', -90, 12); mk(v, -1390, -340, 'A', -90, 12); lvl(v, 520, 1000); [270, -340].forEach(y => v.line(1450, y, 1700, y, 'S-TEXT'));
      L(v, xs - 10, 1150, 253, 1699, 'TIMBER PACKER'); L(v, b / 2, 1250, 792, 1671, 'PROPOSED STEEL\nPILE'); L(v, D / 2 - 20, 0, 900, 1726, 'CUT BACK PILE TO\nSOUND TIMBER', { kink: [878, 1726] });
      L(v, xr + 700, gl + 10, 962, 1783, 'EXISTING G.L.,\nPERMANENT WATER LEVEL\nOR HIGH TIDE', { kink: [940, 1783] });
      L(v, xs - 20, 900, 253, 1832, 'EXISTING TIMBER\nSHEETING'); L(v, xs + 25, 330, 253, 1901, 'SL81 FABRIC (GALV.)');
      LL(v, [[xr - 75 + 14, tp - 75], [xr - 75 + 14, 200], [xr - 75 + 14, bt + 75]], 900, 2068, '2-N16 U-BAR\n(500 LAP)'); barSym(v, 935, 2112);
      L(v, xl - 20, bt + 200, 335, 2235, 'PERMANENT\nFORMWORK'); L(v, xl + 75, bt + 200, 432, 2297, '4-N20');
      UL(B, 669, 2359, 'ELEVATION'); MT(B, 335, 2411, 'ABUTMENT PILE REPAIR FOUNDATION DETAIL - TYPE 1A', 20, null, 'sq');
    }
    // ---- PILE MODIFICATION DETAIL (1:10), origin at the concrete top at the UC centre line
    {
      const v = V(B, 10, 1522, 415), ct = -505, xs = -d / 2 - 60;
      iElevWebV(v, 0, ct + 16, 650, s); zz(v, -d / 2 - 20, 650, d / 2 + 20, 650); [-65, -265].forEach(y => v.circ(0, y, 20, 'S-NEW'));
      [-1, 1].forEach(k => { aSec(v, k * (d / 2 + 10), ct, 100, 150, 10, -k, 1, 'S-NEW'); v.bolt(k * (d / 2 - s.tf), ct + 90, k * (d / 2 + 10), ct + 90, 20); v.spike(k * (d / 2 - 45), ct + 10, k * (d / 2 - 45), ct - 95); });
      v.rect(-d / 2 + 5, ct + 10, d - 10, 6, 'S-NEW'); v.line(-150, ct, -150, -690, 'S-EXIST'); v.line(150, ct, 150, -690, 'S-EXIST'); v.line(-150, ct, 150, ct, 'S-EXIST');
      v.pl([[d / 2, 0], [660, -30], [660, -690]], false, 'S-CONC'); v.line(-276, -690, 660, -690, 'S-CONC'); zz(v, 150, -690, 250, -690); v.fill([[-296, -315], [-276, -315], [-276, -690], [-296, -690]], 'S-NEW'); v.line(-276, -315, xs, -315, 'S-CONC');
      v.line(xs, 230, xs, -640, 'S-HIDDEN'); v.line(xs - 10, 230, xs - 10, -640, 'S-EXIST'); zz(v, xs - 30, 230, xs + 20, 230);
      dh(v, xs, -d / 2, 230, 300, '60'); dv(v, -65, 0, -d / 2, -400, '65'); dv(v, -265, -65, -d / 2, -400, '200', sub('(TYP.)'));
      mk(v, -570, -65, 'D', -90, 10); mk(v, -570, -265, 'E', -90, 10); [-65, -265].forEach(y => { v.line(680, y, 840, y, 'S-TEXT'); lvl(v, 830, y); });
      L(v, xs, 120, 1176, 292, 'EXISTING TIMBER\nSHEETING'); L(v, d / 2, 300, 1706, 245, 'PROPOSED UC PILE', { kink: [1683, 245] }); L(v, 8, -60, 1706, 286, 'SITE DRILL φ40 HOLE AT 200 CRS\nTHROUGH WEB OF UC PILE FOR\nFULL HEIGHT OF CONCRETE\nENCASEMENT', { kink: [1683, 286] });
      VT(B, 1412, 803, 'PILE MODIFICATION DETAIL', 10, 'REINFORCEMENT NOT SHOWN');
    }
    // ---- SECTIONS D and E (1:20) through the modified pile
    [[2390, 'D'], [3095, 'E']].forEach(([px, ch]) => {
      const v = V(B, 20, px, 457), x0 = -d / 2 - 10, x1 = x0 + 760, y0 = -475, y1 = 435;
      v.rect(x0, y0, x1 - x0, y1 - y0, 'S-CONC'); sheetV(v, x0 - 10, -620, 630, 40); wingS(v, x0 - 50, -40, 225, 420, 45);
      tuftE(v, x0 + 160, y1, x1 + 60, y1, 0, 1); tuftE(v, x0 + 160, y0, x1 + 60, y0, 0, -1); tuftE(v, x1, y0 + 20, x1, y1 - 20, 1, 0);
      fabRect(v, x0, y0, x1, y1, 40, false); v.barEnd(x0 + 70, y0 + 70, 20); iSolidR(v, 0, 0, s);
      if (ch === 'D') { v.bar([[x1 - 70, y1 - 60], [-40, y1 - 60], [-40, y0 + 60], [x1 - 70, y0 + 60]]); L(v, -40, 140, 2074, 253, 'N16 U-BAR THROUGH\nφ40 HOLE'); barSym(v, 2180, 280); L(v, x0 + 40, 180, 2077, 360, 'SL81 FABRIC\nTRIM TO SUIT'); L(v, x0 + 70, y0 + 70, 2074, 624, '4-N20 VERTICAL BARS'); L(v, -40, 0, 2546, 265, 'SITE DRILLED\nφ40 HOLE', { kink: [2516, 265] }); }
      else { v.line(-40, -325, -40, 325, 'S-REO'); L(v, -40, 200, 2733, 283, 'ADDITIONAL N12×650 LONG\nBAR THROUGH φ40 HOLE'); L(v, x0 + 40, 120, 2733, 363, 'SL81 FABRIC TRIM TO SUIT'); L(v, x0 + 70, y0 + 70, 2786, 624, '4-N20 VERTICAL BARS'); L(v, -40, 0, 3255, 268, 'SITE DRILLED\nφ40 HOLE', { kink: [3230, 268] }); }
      VT(B, px - 33, 683, 'SECTION ' + ch, 20);
    });
    // ---- PILE BEARING ARRANGEMENTS (1:10)
    [[1671, false], [2453, true]].forEach(([px, big]) => {
      const v = V(B, 10, px, 1243), Dp = big ? max(D, 400) : 300, o = big ? 782 : 0;
      brgPlan(v, s, big, Dp);
      if (big) { dh(v, d / 2, d / 2 + 55, 150, 330, '55', sub('(TYP.)')); dv(v, -150, 0, 160, 330, '='); dv(v, 0, 150, 160, 330, '='); }
      else { dh(v, d / 2 - 45, d / 2 + 10, 150, 330, '55', sub('(TYP.)')); dh(v, d / 2 - 90, d / 2 - 45, -110, -230, '45'); }
      dv(v, -70, 0, -d / 2, -330, '70'); dv(v, 0, 70, -d / 2, -330, '70');
      L(v, -d / 2 - 10, 70, 1371 + (big ? 779 : 0), 1153, 'PROPOSED UC PILE'); L(v, -d / 2 - 14, -70, 1371 + (big ? 779 : 0), 1343, 'M20 BOLT\n(TYP.)'); L(v, big ? -d / 2 - 100 : -d / 2 - 10, -150, 1371 + (big ? 779 : 0), 1421, '150x100x10 UA\n300 LONG (TYP.)');
      if (big) { L(v, 0, 75, 2504, 960, '150x10FLx150\nBEARING PLATE', { kink: [2485, 960] }); L(v, d / 2 + 100, 150, 2567, 1036, 'ANGLE SHALL BEAR ON\nSOLID TIMBER (TYP.)', { kink: [2539, 1036] }); L(v, d / 2 + 55, 0, 2613, 1124, 'φ10 x 100 LONG\nSPIKE (TYP.)'); L(v, d / 2 + 24, -70, 2614, 1334, 'SITE DRILLED φ22 HOLE IN UC PILE\nTO SUIT, FOLLOWING PLACEMENT\nOF SHIMS (TYP.)'); L(v, 10, -10, 2521, 1450, 'STEEL SHIM 90x90xTHICKNESS TO SUIT\nPLACED BETWEEN UC PILE AND BEARING PLATE\nTO ENSURE A TIGHT FIT BETWEEN PROPOSED\nSTEEL PILE AND HALF-CAPS/FULL-CAPS', { kink: [2500, 1450] }); }
      else { L(v, d / 2 - 45, 110, 1814, 1011, 'φ10 x 100 LONG\nSPIKE (TYP.)'); L(v, d / 2 + 10, 140, 1814, 1123, 'ANGLE SHALL BEAR ON\nSOLID TIMBER (TYP.)'); L(v, d / 2 + 24, 70, 1814, 1243, 'SITE DRILLED φ22 HOLE\nIN UC PILE TO SUIT,\nFOLLOWING PLACEMENT\nOF SHIMS (TYP.)'); L(v, 10, -10, 1686, 1421, 'STEEL SHIM 90x90xTHICKNESS TO SUIT\nPLACED BETWEEN UC PILE AND UAs\nTO ENSURE A TIGHT FIT BETWEEN PROPOSED\nSTEEL PILE AND HALF-CAPS/FULL-CAPS', { kink: [1665, 1421] }); }
      UL(B, px, 1581, 'PLAN');
      const e = V(B, 10, px, 1806); brgElev(e, s, big, Dp, 440);
      dv(e, 0, 150, -d / 2 - 10, -390, '150'); dv(e, 0, 90, -d / 2 - 10, -310, '90');
      dh(e, -Dp / 2, Dp / 2, -480, -560, ''); T(B, px + (big ? 166 : 86), 2020, 'EXISTING TIMBER PILE', TH, 'c'); T(B, px + (big ? 166 : 86), 2042, big ? 'φ EQUAL TO OR GREATER THAN 400' : 'φ LESS THAN 400', TH, 'c');
      L(e, -d / 2 - 30, 90, big ? 2196 : 1414, 1643, 'M20 BOLT\n(TYP.)'); L(e, 0, 13, big ? 2604 : 1829, 1637, 'STEEL SHIM'); L(e, big ? d / 2 + 55 : d / 2 - 45, -40, big ? 2614 : 1814, 1853, 'SPIKE (TYP.)', { kink: [big ? 2593 : 1793, 1853] });
      if (big) L(e, 40, 3, 2606, 1921, 'BEARING PLATE', { kink: [2586, 1921] });
      UL(B, px, 2102, 'ELEVATION');
      const tx = big ? 2270 : 1489, t1 = 'PILE BEARING ARRANGEMENT', t2 = 'FOR TIMBER PILES ' + (big ? '≥' : '<') + ' φ400'; T(B, tx, 2164, t1, 3.2, 'l', 'S-TITLE'); T(B, tx, 2196, t2, 3.2, 'l', 'S-TITLE'); [[2164, t1], [2196, t2]].forEach(([y, t]) => B.E.push({ t: 'line', a: [X(tx), Y(y) - 1.1], b: [X(tx) + t.length * 3.2 * 0.68, Y(y) - 1.1], L: 'S-TITLE' })); T(B, tx, 2220, '1:10', TH * 0.9);
    });
    NB(B, 2067, 2250, [GN1, 'REFER PILE REPAIR REQUIREMENTS TABLE ON BRIDGE SPECIFIC DRAWINGS FOR PILE TOP CONNECTION.', 'CUT BASE OF PROPOSED STEEL PILE TO SUIT ON SITE.', 'FULL-CAPS/HALF-CAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR INTENDED DESIGN\nPOSITIONS AND ABUTMENT SHEETING SHALL BE SAFELY PROPPED. PROPPING IS TO BE REMOVED\nONLY AFTER CONCRETE HAS BEEN PLACED A MINIMUM OF SEVEN DAYS OR DEMONSTRATES A MIN.\nCOMPRESSIVE STRENGTH OF 30MPa.', 'STEEL SHIM WIDTH TO SUIT PILE, HEIGHT AND THICKNESS TO SUIT AREA TO BE SHIMMED. SHIMS TO BE\nTACK WELDED TOGETHER AND TO STEEL PILE FLANGE.'], TH, 15.5);
    return B.E;
  }, 'Steel UC stub pile on the cut-back timber abutment pile, encased in a 900 x 750 concrete pot against the abutment sheeting, with pile modification where clearance to the sheeting is under 60 mm.');

  // ---- WING WALL PILE REPAIR TYPE WW1 (UB, 1330-0005) / WW3 (PFC, 1330-0007): the two sheets share one layout
  // member in cross-section with its web horizontal; bearing (inner) web face at y = wy, the pile on side k (+1 above)
  function membX(v, cx, wy, kind, s, k) { if (kind === 'UB') iSec(v, cx, wy - k * s.tw / 2, s, 1); else cSecH(v, cx, wy - k * s.tw, s, k); }
  function wwSheet(p, kind) {
    const B = new Builder(), s = SEC[kind === 'UB' ? p.ub : p.pfc] || SEC[kind === 'UB' ? '410UB54' : '300PFC'], d = s.d, D = +p.D || 350, M = kind, Hc = max(600, +p.H || 1800);
    const ub = kind === 'UB', mt = 'PROPOSED ' + (ub ? 'UB' : 'PFC');
    // ---- SECTION B (1:20): single pile / sheeting joint (double pile)
    [[661, 260, false], [1713, 248, true]].forEach(([px, py, dbl]) => {
      const v = V(B, 20, px, py), x0 = -325, x1 = 325, y0 = -435, y1 = 435, cx = x0 + d / 2 + 10;
      v.rect(x0, y0, x1 - x0, y1 - y0, 'S-CONC'); v.line(x0, y0 - 150, x0, y1 + 180, 'S-EXIST'); v.line(x0 - 45, y0 - 150, x0 - 45, y1 + 180, 'S-EXIST'); zz(v, x0 - 65, y1 + 180, x0 + 20, y1 + 180); zz(v, x0 - 65, y0 - 150, x0 + 20, y0 - 150); tuftE(v, x0 - 45, y0 - 100, x0 - 45, y1 + 130, -1, 0);
      if (dbl) { v.line(x0 - 45, 0, x0, 0, 'S-EXIST'); }
      v.rect(x0 + 75, y0 + 75, x1 - x0 - 150, y1 - y0 - 150, 'S-REO');
      const ys = dbl ? [203, -203] : [-150];
      ys.forEach((y, i) => membX(v, cx, y, M, s, dbl ? (i ? 1 : -1) : 1));
      v.bar(dbl ? [[x0 + 150, 330], [x0 + 85, 330], [x0 + 85, -330], [x0 + 150, -330]] : [[x0 + 160, 330], [x0 + 85, 330], [x0 + 85, -330], [x0 + 230, -330]]);
      if (!dbl) { L(v, x0 + 85, 40, 856, 140, 'N12 BAR AT 200 CRS, THROUGH\nφ40 HOLE SITE DRILLED THROUGH\nWEB OF PILES (TYP.)'); L(v, x1 - 75, 60, 856, 246, 'SL81 FABRIC'); L(v, cx + d / 4, -150, 856, 352, ub ? 'PROPOSED PILE' : 'PROPOSED PFC\nPILE', { kink: [819, 352] }); VT(B, 574, 462, 'SECTION B', 20); }
      else { LL(v, [[x0 + 85, 150], [x0 + 85, -150]], 1909, 141, 'N12 L-BARS AT 200 CRS, THROUGH\nφ40 HOLE SITE DRILLED THROUGH\nWEB OF PILES (TYP.)'); L(v, x1 - 75, 60, 1909, 246, 'SL81 FABRIC'); L(v, x0 - 20, 0, 1400, 306, 'EXISTING TIMBER\nSHEETING JOINT'); L(v, cx + d / 4, -203, 1909, 381, ub ? 'PROPOSED PILE\n(TYP.)' : 'PROPOSED PFC\nREPAIR (TYP.)', { kink: [1882, 381] }); VT(B, 1606, 465, 'SECTION B', 20, 'WHERE EXISTING TIMBER SHEETING ABUTS\nAT THE TIMBER PILE REPAIR'); }
    });
    // ---- SECTION A (1:20): pile held against the web(s) with threaded U-rod / rods
    [[650, 830, false], [1705, 843, true]].forEach(([px, py, dbl]) => {
      const v = V(B, 20, px, py), x0 = -325, x1 = 325, y1 = dbl ? D / 2 + 260 : D / 2 + 190, y0 = dbl ? -D / 2 - 260 : -D / 2 - 330, wy = -D / 2 + 40;
      v.rect(x0, y0, x1 - x0, y1 - y0, 'S-CONC'); v.fill([[x0 - 18, y0], [x0, y0], [x0, y1 - 40], [x0 - 18, y1 - 40]], 'S-NEW');
      v.line(x0, y1 - 40, x0, y1 + 320, 'S-EXIST'); v.line(x0 - 45, y1 - 40, x0 - 45, y1 + 320, 'S-EXIST'); v.line(x0 - 45, y1 - 40, x0, y1 - 40, 'S-EXIST'); zz(v, x0 - 65, y1 + 320, x0 + 20, y1 + 320); tuftE(v, x0 - 18, y0 + 20, x0 - 18, y1 - 60, -1, 0);
      v.line(x0 + 30, y0 - 150, x0 + 30, y0, 'S-EXIST'); v.line(x0 + 70, y0 - 150, x0 + 70, y0, 'S-EXIST'); v.rect(x0 + 75, y0 + 75, x1 - x0 - 150, y1 - y0 - 150, 'S-REO');
      // trimmed pile
      const r = D / 2, ch = Math.sqrt(r * r - wy * wy), pts = []; for (let a = -Math.asin(ch / r) * 180 / PI - 90; a <= Math.asin(ch / r) * 180 / PI - 90 + 360; a += 6) { const q = [r * Math.cos(a * PI / 180), r * Math.sin(a * PI / 180)]; if (q[1] >= wy - 1 && (!dbl || q[1] <= -wy + 1)) pts.push(q); }
      v.pl(pts.concat(dbl ? [] : []), true, 'S-EXIST');
      const ea = (y, k) => [-1, 1].forEach(kx => { aSec(v, kx * d / 2, y, 75, 75, 10, kx, -k, 'S-NEW'); });
      if (!dbl) { membX(v, 0, wy, M, s, 1); const ye = wy - (ub ? s.b / 2 + s.tw / 2 : s.tw); ea(ye, 1); const rr = d / 2 + 38; const U = [[-rr, ye - 30]]; for (let a = 180; a >= 0; a -= 10) U.push([rr * Math.cos(a * PI / 180), 40 + rr * Math.sin(a * PI / 180)]); U.push([rr, ye - 30]); v.pl(U, false, 'S-BOLT'); [-1, 1].forEach(kx => v.nut(kx * rr, ye - 10, 0, -1, 20)); }
      else { membX(v, 0, wy, M, s, 1); membX(v, 0, -wy, M, s, -1); const ye = wy - (ub ? s.b / 2 + s.tw / 2 : s.tw); ea(ye, 1); ea(-ye, -1); [-1, 1].forEach(kx => rod(v, kx * (d / 2 + 38), ye, kx * (d / 2 + 38), -ye, 50)); }
      v.weld(x0 - 18, y0 + 40, -14, -8, { size: '6' });
      dh(v, x0 - 150, x0, y1, y1 + 300, '150'); dh(v, x0, x1, y1, y1 + 300, '650'); dh(v, x1 - 150, x1 - 75, y1, y1 + 160, '75', sub('COVER'));
      dv(v, y1 - 95, y1, x0, x0 - 300, '95', sub('COVER')); dv(v, y1 - 135, y1 - 95, x0, x0 - 160, '40');
      dv(v, -r, r, x1, x1 + 200, 'PILE φ', sub('VARIES')); dv(v, r, y1, x1, x1 + 200, dbl ? '300' : '150'); dv(v, y0, -r, x1, x1 + 200, '300');
      dh(v, -d / 2 - 35, -d / 2, y0, y0 - 180, '35'); dh(v, d / 2, d / 2 + 35, y0, y0 - 180, '35');
      const tA = 'TRIM EXISTING TIMBER PILE TO\nPROVIDE 75 MIN. BEARING FACE\nWITH WEB OF ' + (ub ? 'UB.' : 'PFC.') + (dbl || !ub ? ' (TYP.)' : ''), tK = 'IF TIMBER SHEETING OCCURS AT\nPROPOSED CONCRETE LOCATION,\nCUT TIMBER AND KEY INTO\n' + (ub ? 'CONCRETE AS SHOWN (APPLIES\nTO SECTION (A) ONLY) (TYP.)' : 'CONCRETE AS SHOWN (SECTION\n(A) ONLY) (TYP.)');
      if (!dbl) {
        L(v, x0 - 18, y1 - 60, 250, 655, 'PERMANENT FORMWORK'); L(v, 0, wy, 210, 843, tA); L(v, x0 + 50, y0 + 20, 205, 990, tK);
        L(v, 60, D / 2 + 60, 857, 755, 'ENSURE NO VOIDS PRESENT\nIN THIS AREA (TYP.)'); L(v, d / 2 + 38, 40, 857, 886, "φ20 THREADED 'U'\nROD FLUSH WITH " + (ub ? 'UB\nFLANGES (TYP.)' : '\nPFC FLANGES (TYP.)')); L(v, x1 - 75, -150, 857, 972, 'SL81 FABRIC (TYP.)'); L(v, d / 2 + 40, wy - s.b / 2 - 10, 857, 1025, ub ? "EA WELDED TO UB.\nPROVIDE φ22 HOLES\nFOR THREADED 'U' ROD.\n(TYP.)" : "EA WELDED TO PFC.\nPROVIDE φ22 HOLES\nFOR THREADED 'U' ROD.\n(TYP.)");
        VT(B, 575, 1103, 'SECTION A', 20);
      } else {
        L(v, x0 - 18, 0, 1315, 828, 'PERMANENT FORMWORK'); L(v, 0, wy, 1252, 871, tA); L(v, x0 + 50, y0 + 20, 1244, 977, tK);
        L(v, d / 2 + 38, 120, 1909, 666, ub ? 'φ20 THREADED ROD\nFLUSH WITH UB FLANGES\n(TYP.)' : 'φ20 THREADED ROD\n(TYP.)'); L(v, 60, -wy + 60, 1909, 756, 'ENSURE NO VOIDS PRESENT\nIN THIS AREA (TYP.)'); L(v, x1 - 75, -60, 1909, 987, 'SL81 FABRIC\n(TYP.)'); L(v, d / 2 + 40, wy - s.b / 2 - 10, 1908, 1045, (ub ? 'EA WELDED TO UB.' : 'WELDED TO PFC.') + ' PROVIDE φ22\nHOLES FOR THREADED RODS.\n(TYP.)');
        VT(B, 1608, 1105, 'SECTION A', 20, 'WHERE EXISTING TIMBER SHEETING ABUTS\nAT THE TIMBER PILE REPAIR');
      }
    });
    // ---- DETAIL 1 (1:10): top of the pile at the spiking rail / capping
    {
      const v = V(B, 10, 2625, 330), xs = -200;
      v.line(xs, 150, xs, -420, 'S-EXIST'); v.line(xs - 40, 150, xs - 40, -420, 'S-EXIST'); tuftE(v, xs - 40, -400, xs - 40, 120, -1, 0); zz(v, xs - 60, -420, xs + 20, -420);
      timberX(v, xs, -80, 120, 150); v.rect(xs + 10, 70, 175, 190, 'S-EXIST'); v.line(xs + 10, 70, xs + 185, 260, 'S-EXIST'); v.line(xs + 10, 260, xs + 185, 70, 'S-EXIST');
      v.pl([[-80, -360], [-80, -80], [xs + 120, -80], [xs + 120, 70], [-40, 70], [330, -30], [330, -360]], false, 'S-NEW'); zz(v, -100, -360, 60, -360); zz(v, 200, -360, 350, -360);
      v.rect(-30, -70, 125, 150, 'S-NEW'); v.line(-20, -70, -20, 80, 'S-NEW'); hole(v, 30, 0, 7); hole(v, 60, -40, 7);
      v.line(-80, 70, 520, 70, 'S-DIM'); v.arc(-40, 70, 500, -15, 0, 'S-DIM'); v.text(470, 10, '15°', 2.0, 'l', 'b', 'S-DIM', 90);
      dh(v, xs + 10, xs + 185, 260, 330, '175'); dv(v, 70, 120, 185 - 15, 260, '50');
      L(v, xs + 120, 220, 2335, 150, 'EXISTING TIMBER\nCAPPING'); L(v, xs + 100, 0, 2335, 216, ub ? 'EXISTING TIMBER\nSPIKING RAIL.\nNOTCH UB PILE\nTO SUIT' : 'EXISTING TIMBER\nSPIKING RAIL.'); L(v, xs - 40, -250, 2335, 429, 'EXISTING TIMBER\nSHEETING'); L(v, 60, 60, 2735, 152, '150x150x10 EA\n125 LONG');
      VT(B, 2595, 540, 'DETAIL 1', 10);
    }
    // ---- DETAIL 2 (1:10): bent EA fabrication;  SECTION D (1:10)
    {
      const v = V(B, 10, 2487, 840);
      v.rect(-30, -55, 230, 110, 'S-NEW'); v.line(-30, -45, 200, -45, 'S-HIDDEN'); v.rect(-30, -55, 10, 110, 'S-NEW'); v.fill([[-30, -55], [-20, -55], [-20, 55], [-30, 55]], 'S-NEW');
      [[30, 25], [30, -25], [100, 25], [100, -25], [150, 25], [150, -25]].forEach(([x, y]) => { v.line(x - 8, y, x + 8, y, 'S-BOLT'); v.line(x, y - 8, x, y + 8, 'S-BOLT'); });
      v.line(-25, 130, -25, -150, 'S-CL'); v.mark(-25, 160, 'D', 0); v.arrow(-25, -170, -90, 'S-TEXT'); v.line(-160, 90, -40, 25, 'S-TEXT'); v.line(-160, 90, -80, 90, 'S-TEXT');
      dv(v, -55, 0, 200, 290, '55'); dv(v, 0, 55, 200, 290, '55'); dh(v, 20, 150, -55, -140, '130'); dh(v, 150, 200, -55, -140, '50');
      v.weld(-20, 50, 14, 12, { size: '6' }); L(v, 100, 55, 2575, 721, (ub ? '150x150x10 EA\nLENGHT TO SUIT' : '150x150x10 EA\nLENGHT TO SUIT')); L(v, -30, -30, 2210, 891, '10 THICK PL'); L(v, 30, -25, 2150, 927, 'φ12 HOLE TO SUIT\nM10 COACH SCREW\nx100 LONG GALV.\n(TYP.)');
      VT(B, 2400, 1029, 'DETAIL 2', 10);
      const w = V(B, 10, 2885, 828); w.pl([[-60, 55], [80, 55], [80, -40], [60, -60], [-60, -60]], true, 'S-NEW'); aSec(w, 80, 55, 150, 150, 10, -1, -1, 'S-HIDDEN'); w.line(-60, 55, -60, -60, 'S-NEW');
      [[0, 0], [60, -15]].forEach(([x, y]) => { w.line(x - 8, y, x + 8, y, 'S-BOLT'); w.line(x, y - 8, x, y + 8, 'S-BOLT'); });
      dh(w, 40, 80, 55, 120, '40', sub('(TYP.)')); dv(w, 15, 55, -60, -120, '40', sub('(TYP.)')); w.weld(70, -50, -14, -14, { size: '6' });
      LL(w, [[-40, -50], [40, -20]], 2694, 896, '140x10 PL\nx140 LONG'); L(w, 60, -15, 2951, 810, 'φ14 HOLE TO SUIT\nM12 BOLT (TYP.)'); if (!ub) L(w, 80, 20, 2951, 852, '150x150x10 EA');
      VT(B, 2816, 1029, 'SECTION D', 10);
    }
    // ---- SIDE ELEVATION (1:20), origin at the pile centre line, G.L.
    {
      const v = V(B, 20, 636, 1827), tp = 150, bt = tp - 1500, cut = -600, e1 = -750, e2 = -1250, xr = 440, xl = -368, xs = -237, top = Hc;
      v.pl([[xr, tp - 50], [xr - 50, tp], [d / 2, tp], [xl + 30, tp + 18], [xl + 30, bt], [xr, bt], [xr, tp - 50]], true, 'S-CONC'); v.fill([[xl, bt], [xl + 18, bt], [xl + 18, cut + 200], [xl, cut + 200]], 'S-NEW');
      v.line(xs, cut + 200, xs, top + 150, 'S-EXIST'); v.line(xs - 45, cut + 200, xs - 45, top + 150, 'S-EXIST'); tuftE(v, xs - 45, tp + 30, xs - 45, top, -1, 0);
      iElevWebV(v, 0, -1240, top - 60, s); [600, 680].forEach(y => zz(v, -d / 2 - 30, y, d / 2 + 30, y));
      [100, -100, -300].forEach(y => v.circ(-130, y, 20, 'S-NEW'));
      v.line(-D / 2, cut, -D / 2, -1950, 'S-EXIST'); v.line(D / 2, cut, D / 2, -1950, 'S-EXIST'); v.line(-D / 2, cut, D / 2, cut, 'S-EXIST'); pend(v, 0, -1950, D);
      [e1, e2].forEach(y => { v.rect(-d / 2 - 40, y - 10, d + 80, 10, 'S-NEW'); v.rect(-d / 2 - 40, y - 75, 10, 75, 'S-NEW'); v.line(-d / 2 - 40, y + 20, d / 2 + 40, y + 20, 'S-BOLT'); });
      v.ground(xr, xr + 300, 0); v.line(xr + 300, 0, xr + 1400, 0, 'S-TEXT'); lvl(v, xr + 1100, 0);
      v.line(xr - 75, bt + 75, xr - 75, tp - 75, 'S-REO'); v.barEnd(xr - 60, -550, 16); v.barEnd(xr - 60, bt + 75, 16);
      // capping / spiking rail at the top
      timberX(v, -d / 2 - 20, top - 160, 150, 160); v.rect(-d / 2 - 20, top, d + 120, 160, 'S-EXIST'); v.line(-d / 2, top - 60, d / 2 + 60, top - 160, 'S-NEW'); v.circ(-d / 2 + 40, top - 60, 180, 'S-TEXT'); num(v, 280, top - 500, '1'); v.line(-d / 2 + 160, top - 190, 250, top - 470, 'S-TEXT'); mk(v, 1000, top - 60, 'C', 180);
      fin(v, 120, tp + 10, 'U2'); v.text(40, tp + 80, '2%', 2.0); slope(v, 300, cut + 40, '4');
      dv(v, tp, top, xr, xr + 1320, 'HEIGHT TO SUIT UNDERSIDE OF', sub('TIMBER WING WALL CAPPING')); dv(v, bt, tp, xr, xr + 1320, '1500 MIN.'); dv(v, 0, tp, xr, xr + 1050, '150'); dv(v, cut, 0, xr, xr + 1050, '250', sub('MIN.'));
      dv(v, 400, 600, xl, -1200, '200', sub('NOM.')); dv(v, -100, 100, xl, -650, '200', sub('TYP.')); dv(v, cut, -300, xl, -1200, '100', sub('MIN.')); dv(v, -300, -100, xl, -870, '100');
      dv(v, e1, cut, xl, -1550, '150'); dv(v, e2, e1, xl, -1550, '500', sub('MIN.')); dv(v, bt, e2, xl, -1550, '100'); dv(v, e1 - 45, e1, xl, -1000, '45', sub('(TYP.)'));
      dh(v, xl, xs + 60, bt, bt - 150, '150'); dh(v, xr - 75, xr, bt, bt - 150, '75 COVER', sub('(TYP.)')); dv(v, bt - 100, bt, xr - 75, xr - 300, '100');
      mk(v, 1290, -200, 'B', 180); mk(v, 1290, -720, 'A', 180); lvl(v, -1800, -200); lvl(v, -1800, -720); v.line(-1900, -200, -1600, -200, 'S-TEXT'); v.line(-1900, -720, -1600, -720, 'S-TEXT');
      L(v, -d / 2 + 30, top - 80, 309, 1373, 'RETAIN EXISTING SPIKING\nRAIL (REPLACE IF REQUIRED\nWITH SAME SIZE). NOTCH\nUB PILE TO SUIT.'); L(v, 60, top + 100, 724, 1374, 'WING WALL CAPPING', { kink: [690, 1374] }); LL(v, [[-d / 2 + 60, top - 100], [-d / 2 + 110, top - 140]], 724, 1423, 'φ22 HOLES TO SUIT φ20\nTHREADED ROD' + (ub ? ' (TYP.)' : ''));
      L(v, xs - 20, top - 100, 284, 1523, 'EXISTING TIMBER\nSHEETING'); L(v, -900, 560, 244, 1607, '600 CRS FULL HEIGHT\nOF PILE (FOR DOUBLE\nPILES ONLY)', { noArrow: true }); zz(v, -950, 400, -850, 560);
      L(v, d / 2, 900, 757, 1705, mt + (ub ? ' PILE' : '')); L(v, xr - 25, tp - 25, 791, 1773, '50x50 CHAMFER'); L(v, D / 2 - 20, cut, 789, 1887, (ub ? 'CUT BACK' : 'CUTBACK') + ' PILE TO\nSOUND TIMBER');
      LL(v, [[xr - 60, -550], [xr - 60, bt + 75]], 800, 2010, 'N16, 500 LAP\nTOP & BOTTOM'); barSym(v, 1005, 2010); L(v, xr - 75, -1000, 800, 2066, 'SL81 FABRIC');
      L(v, xl, -1100, 253, 2174, 'PERMANENT FORMWORK'); L(v, -d / 2 - 35, e2 - 40, 260, 2245, '75x75x10 EA (TYP.) LENGTH TO\nSUIT TIMBER PILE DIMENSIONS\nAS SHOWN IN SECTION (A)'); L(v, d / 2, e2 + 20, 735, 2243, ub ? "THREADED 'U' ROD OR 2-THREADED\nRODS SEE SECTION (A) (TYP.)" : "THREADED 'U' ROD OR 2 N° THREADED\nRODS SEE SECTION (A) (TYP.)", { kink: [700, 2243] });
      L(v, xr + 1100, 10, 1091, 1799, 'EXISTING G.L., PERMANENT WATER\nLEVEL OR HIGH TIDE LEVEL', { noArrow: true });
      UL(B, 637, 2373, 'SIDE ELEVATION'); MT(B, 387, 2419, 'WING WALL PILE REPAIR DETAIL - TYPE ' + (ub ? 'WW1' : 'WW3'), 20, null, 'tri');
    }
    // ---- PLANS (1:10, wing wall capping not shown)
    {
      const v = V(B, 10, 1710, 1464), yt = 140;
      [336, 261, yt].forEach((y, i) => v.line(-420, y, 520, y, 'S-EXIST')); tuftE(v, -300, 336, 0, 336, 0, 1); tuftE(v, 100, 336, 300, 336, 0, 1); zz(v, -440, yt - 20, -440, 356); zz(v, 540, yt - 20, 540, 356);
      if (ub) { iSec(v, 0, yt - d / 2 * 0.7, Object.assign({}, s, { d: d * 0.7 }), 0); } else cSec(v, 0, yt - d / 2 * 0.7, Object.assign({}, s, { d: d * 0.7 }), 1);
      aSec(v, s.tw / 2 + 2, yt, 150, 150, 10, 1, -1, 'S-NEW'); [60, 110].forEach(x => v.line(x, yt, x, 300, 'S-HIDDEN'));
      L(v, -300, 336, 1437, 1256, 'EXISTING TIMBER\nSHEETING'); L(v, 350, 200, 1996, 1337, 'EXISTING TIMBER\nSPIKING RAIL', { dot: true }); L(v, 150, yt - 75, 1839, 1500, '150x150x10 EA\nLENGTH TO SUIT'); L(v, -40, yt - d * 0.7, 1487, 1587, ub ? 'PROPOSED UB\nPILE' : 'PROPOSED\nPFC PILE');
      UL(B, 1725, 1609, 'PLAN'); T(B, 1725, 1645, '(WING WALL CAPPING NOT SHOWN)', TH, 'c');
      const w = V(B, 10, 2567, 1442), xp = 210;
      [283, 208, 196].forEach(y => w.line(-520, y, 520, y, 'S-EXIST')); tuftE(w, -150, 283, 150, 283, 0, 1); zz(w, -540, 180, -540, 300); zz(w, 540, 180, 540, 300);
      [-1, 1].forEach(k => { if (ub) iSec(w, k * xp, 0, Object.assign({}, s, { d: 390 }), 0); else cSec(w, k * xp, 0, Object.assign({}, s, { d: 390 }), -k); });
      rod(w, -xp - 10, 0, xp + 10, 0, 50); w.fabric(-xp + 20, -170, xp - 20, -170, 80); for (let i = 0; i < 6; i++) w.pl([[-60 + i * 25, 150 - (i % 2) * 40], [-50 + i * 25, 170 - (i % 2) * 40], [-40 + i * 25, 150 - (i % 2) * 40]], true, 'S-HATCH');
      dv(w, -194, 0, xp + s.b / 2, 420, '='); dv(w, 0, 194, xp + s.b / 2, 420, ub ? '=' : "'D'"); if (!ub) dv(w, -194, -154, -xp - s.b / 2, -330, '40', sub('MIN.')); slope(w, 40, -190, '3');
      L(w, -200, 283, 2281, 1256, 'EXISTING TIMBER\nSHEETING'); L(w, -xp - 10, 0, 2212, 1479, ub ? 'φ22 HOLES TO SUIT\nφ20 THREADED RODS\n(TYP.)' : 'φ20 THREADED ROD'); L(w, 450, 240, 2827, 1480, 'EXISTING TIMBER\nSPIKING RAIL', { dot: true }); L(w, -40, -170, 2400, 1581, 'SL81 FABRIC\n(TYP.)'); L(w, xp + 60, -194, 2784, 1581, ub ? 'PROPOSED UB\nPILE (TYP.)' : 'PROPOSED PFC\nREPAIR (TYP.)');
      UL(B, 2585, 1615, 'PLAN'); T(B, 2585, 1650, '(WING WALL CAPPING NOT SHOWN)', TH, 'c');
    }
    // ---- VIEW C (1:10, front elevations)
    {
      const v = V(B, 10, 1710, 1909), wb = (x, y) => [x, y];
      [82, 0, -225].forEach(y => v.pl([[-450, y], [330, y], [330 + 500 * Math.cos(25 * PI / 180), y - 500 * Math.sin(25 * PI / 180)]], false, 'S-EXIST')); zz(v, -470, -245, -470, 100);
      v.rect(-s.b / 2, -620, s.b, 395, 'S-NEW'); v.line(0, -620, 0, -225, 'S-HIDDEN'); zz(v, -s.b / 2 - 20, -620, s.b / 2 + 20, -620);
      v.rect(-80, -190, 330, 150, 'S-NEW'); [[60, -80], [60, -150], [160, -80], [160, -150]].forEach(([x, y]) => hole(v, x, y, 8));
      dh(v, 330, 520, 82, 230, '50', sub(ub ? 'MIN.' : 'MIN.\n(TYP.)'.split('\n')[0]));
      L(v, 150, -40, 1487, 1759, '150x150x10 EA LENGTH\nTO SUIT. FOR FABRICATION\nDETAILS REFER DETAIL (2)'); L(v, -300, 40, 1321, 1985, 'EXISTING TIMBER\nCAPPING', { dot: true }); L(v, -300, -110, 1321, 2045, 'EXISTING TIMBER\nSPIKING RAIL', { dot: true }); L(v, -s.b / 2, -500, 1506, 2135, ub ? 'PROPOSED\nUB PILE' : 'PROPOSED\nPFC PILE');
      UL(B, 1725, 2194, 'FRONT ELEVATION'); VT(B, 1652, 2244, 'VIEW C', 10);
      const w = V(B, 10, 2565, 1900), sl = Math.tan(28 * PI / 180);
      [520, 400, 330, 180].forEach((y0, i) => w.line(-560, y0, 700, y0 - 1260 * sl, 'S-EXIST')); w.cl(0, 420, 0, -720);
      [[-250, 167], [250, -46]].forEach(([x, yt]) => { w.rect(x - s.b / 2, -700, s.b, yt + 700, 'S-NEW'); zz(w, x - s.b / 2 - 20, -700, x + s.b / 2 + 20, -700); });
      w.line(-250 + s.b / 2, 210, 250 - s.b / 2, -10, 'S-NEW'); w.line(-250 + s.b / 2, 230, 250 - s.b / 2, 10, 'S-NEW');
      w.rect(-370, 75, 70, 140, 'S-NEW'); hole(w, -335, 110, 7); hole(w, -335, 180, 7); w.rect(312, -271, 55, 126, 'S-NEW'); hole(w, 340, -185, 7); hole(w, 340, -245, 7);
      rod(w, -250 - s.b / 2, -85, 250 + s.b / 2, -85, 50);
      dv(w, 75, 215, -370, -760, '125'); dv(w, 50, 75, -370, -620, '25', sub('(TYP.)')); dv(w, -271, -181, 367, 720, ub ? '90' : '150');
      w.weld(-245, 230, -30, 40, { size: '6', all: true }); T(B, 2565 + 5, 1725, '℄ EXISTING\n  PILE');
      L(w, -420, 300, 2140, 1731, 'EXISTING TIMBER\nSPIKING RAIL', { dot: true }); L(w, 30, 100, 2647, 1781, 'TOP OF CONCRETE INFILL\nAT 2% SLOPE'); L(w, 420, 80, 2776, 1834, 'EXISTING TIMBER\nCAPPING');
      L(w, -335, 140, 2056, 2034, '150x150x10 EA x 125 LONG\nWITH φ12 HOLES AT 75\nCRS FOR 2-M10 x 100 LONG\nCOACH SCREWS' + (ub ? '' : ' (TYP)'));
      UL(B, 2571, 2197, 'FRONT ELEVATION'); VT(B, 2500, 2250, 'VIEW C', 10, 'WHERE EXISTING TIMBER SHEETING\nABUTS AT THE TIMBER PILE REPAIR');
    }
    NB(B, 2192, 2323, [GN1, 'WHERE SINGLE ' + (ub ? '' : 'PFC ') + 'PILE IS PROPOSED, PILE SHALL BE PLACED ON THE HIGHER SIDE OF\nEXISTING TIMBER WING WALL PILE UNLESS OTHERWISE SHOWN ON PROJECT DRAWINGS.', 'ENSURE WING WALL SHEETING IS SAFELY PROPPED. DO NOT REMOVE PROPS UNTIL\nPROPOSED PILE IS IN POSITION AND CONCRETE HAS BEEN PLACED A MINIMUM OF ' + (ub ? '7' : '3') + ' DAYS.'], TH, 16);
    return B.E;
  }

  // 6 WING WALL PILE REPAIR TYPE WW1 (1330-0005) — UB pile beside the timber pile, in a concrete pot
  def('ww1', 'Wing walls', 'Wing wall pile repair – Type WW1 (UB)', '1330-0005', [P('ub', 'Proposed UB pile', '410UB54', { opts: UBs }), P('H', 'Height to wing wall capping (mm)', 1800, { num: 1 }), P('D', 'Pile dia. (mm)', 350, { num: 1 })], p => wwSheet(p, 'UB'),
    'Wing wall pile replaced by a UB pile (single or double) against the trimmed timber pile with threaded U-rods, encased in a 650 wide concrete pot and fixed to the spiking rail / capping with EA cleats.');

  // 7 WING WALL PILE REPAIR TYPE WW2 (1330-0006) — deteriorated pile top encased in concrete, anchor strap to the sheeting
  def('ww2', 'Wing walls', 'Wing wall pile repair – Type WW2 (encasement)', '1330-0006', [P('H', 'H to underside of capping (≤1500)', 1500, { num: 1 }), P('D', 'Pile dia. (mm)', 400, { num: 1 })], (p) => {
    const B = new Builder(), H = max(600, min(1500, +p.H || 1500)), D = +p.D || 400, r = D / 2;
    // ---- SECTION B (1:20)
    {
      const v = V(B, 20, 794, 312);
      v.line(-900, 348, 500, 348, 'S-EXIST'); v.line(-900, 227, 500, 227, 'S-EXIST'); v.line(-700, 87, 500, 87, 'S-EXIST'); v.line(500, 87, 500, 348, 'S-EXIST'); tuftE(v, -300, 348, 50, 348, 0, 1); zz(v, -900, 160, -900, 400); zz(v, -700, 40, -700, 250);
      v.pl([[-450, 87], [-450, -455], [450, -455], [450, 87]], false, 'S-CONC'); v.pl([[-375, 60], [-375, -380], [375, -380], [375, 60]], false, 'S-REO'); v.circ(0, 0, r, 'S-EXIST');
      for (let i = 0; i < 6; i++) { v.pl([[-400 + (i % 3) * 18, -40 - i * 25], [-390 + (i % 3) * 18, -20 - i * 25], [-380 + (i % 3) * 18, -40 - i * 25]], true, 'S-HATCH'); v.pl([[340 - (i % 3) * 18, -200 - i * 25], [350 - (i % 3) * 18, -180 - i * 25], [360 - (i % 3) * 18, -200 - i * 25]], true, 'S-HATCH'); }
      dv(v, 0, 87, 450, 830, '40'); dv(v, -455, -380, 375, 260, '75 COVER', sub('(TYP.)'));
      L(v, -500, 150, 494, 163, 'EXISTING SPIKING\nRAIL', { kink: [644, 163] }); L(v, 300, 348, 965, 163, 'EXISTING TIMBER\nSHEETING', { kink: [943, 163] }); L(v, -375, -30, 491, 370, 'TRIM FABRIC TO\nSUIT (TYP.)'); L(v, -r * 0.7, -r * 0.7, 506, 475, 'EXISTING PILE'); L(v, 375, -300, 965, 456, 'SL81 FABRIC', { kink: [937, 456] });
      VT(B, 719, 585, 'SECTION B', 20);
    }
    // ---- SECTION A (1:20) at the anchor strap
    {
      const v = V(B, 20, 794, 987), ys = -276;
      v.line(-950, 227, 600, 227, 'S-EXIST'); v.line(-950, 194, 600, 194, 'S-EXIST'); tuftE(v, -150, 227, 300, 227, 0, 1); zz(v, -950, 150, -950, 280);
      v.pl([[-450, 194], [-450, -440], [450, -440], [450, 194]], false, 'S-CONC'); v.pl([[-375, 160], [-375, -365], [375, -365], [375, 160]], false, 'S-REO');
      v.circ(0, 0, r, 'S-EXIST'); v.circ(0, 0, r - 100, 'S-EXIST'); v.hatch(ringPts(r - 100, r), 'ansi31', 'S-HATCH', 0.6);
      const U = [[-r - 15, ys]]; for (let a = 180; a >= 0; a -= 10) U.push([(r + 15) * Math.cos(a * PI / 180), (r + 15) * Math.sin(a * PI / 180)]); U.push([r + 15, ys]); v.pl(U, false, 'S-NEW');
      rod(v, -r - 40, ys, r + 60, ys, 50);
      v.rect(-416, 227, 929, 950, 'S-TEXT'); T(B, 794 + 5, 773, 'SECTION OF EXISTING\nTIMBER SHEETING\nTO BE REMOVED', TH, 'c');
      dh(v, -506, -416, 227, 500, '90'); dv(v, -440, 194, -450, -740, '650'); dh(v, -450, 450, -440, -720, '900');
      L(v, -420, 227, 450, 840, 'EXISTING TIMBER\nSHEETING', { kink: [606, 840] }); L(v, r * 0.5, r * 0.6, 965, 840, 'MIN. 100 AVERAGE SOLID\nTIMBER ANNULUS REFER\nNOTE 3.', { kink: [943, 840] }); L(v, r + 15, 60, 965, 969, 'ANCHOR STRAP\nREFER DETAIL');
      L(v, r - 30, -120, 965, 1053, 'EXISTING PILE', { kink: [943, 1053] }); L(v, -r - 40, ys, 425, 1135, 'φ20 THREADED ROD', { kink: [638, 1135] }); L(v, 375, -250, 965, 1135, 'SL81 FABRIC', { kink: [943, 1135] });
      VT(B, 720, 1231, 'SECTION A', 20);
    }
    // ---- ANCHOR STRAP DETAIL (1:10)
    {
      const v = V(B, 10, 1585, 347), hw = r + 6, Ls = 550 - hw;
      const U = [[0, hw], [Ls, hw]]; for (let a = 90; a >= -90; a -= 10) U.push([Ls + hw * Math.cos(a * PI / 180), hw * Math.sin(a * PI / 180)]); U.push([0, -hw]); v.pl(U, false, 'S-NEW'); v.line(0, hw, 0, hw - 50, 'S-NEW'); v.line(0, -hw, 0, -hw + 50, 'S-NEW');
      dh(v, 0, 550, -hw, -hw - 280, '550'); dv(v, -hw, hw, 0, -380, 'TO SUIT PILE', sub('DIAMETER')); dv(v, hw - 50, hw, 0, -150, '50', sub('(TYP.)'));
      L(v, Ls + hw * 0.7, hw * 0.7, 1881, 269, '100x5FL ANCHOR STRAP'); UL(B, 1681, 591, 'PLAN');
      const e = V(B, 10, 1585, 827); e.rect(0, -50, 560, 100, 'S-NEW'); e.line(-100, 50, 0, 50, 'S-DIM'); e.circ(50, 0, 12, 'S-BOLT'); e.line(-60, 0, 0, 0, 'S-CL');
      dh(e, 0, 50, 50, 140, '50', sub('(TYP.)')); dv(e, -50, 0, 0, -140, '='); dv(e, 0, 50, 0, -140, '='); dv(e, -50, 50, 560, 700, '100');
      L(e, 50, -10, 1660, 894, 'φ24 HOLE', { kink: [1640, 894] }); UL(B, 1690, 1012, 'ELEVATION'); VT(B, 1566, 1115, 'ANCHOR STRAP DETAIL', 10);
    }
    // ---- ELEVATION (1:20), origin at the pile centre line, G.L.
    {
      const v = V(B, 20, 793, 1764), ya = -837, bt = ya - 500, cap = x => 663 + 230 - 0.476 * (x + 450), top = 470;
      v.pl([[-450, cap(-450)], [450, cap(450)], [450, bt], [-450, bt]], true, 'S-CONC');
      [150, 0, -150, -300].forEach((o, i) => v.line(-970, cap(-970) + o, i < 2 ? 520 : -450, cap(i < 2 ? 520 : -450) + o, 'S-EXIST'));
      for (let y = 600; y > bt; y -= 220) { v.line(-970, y, -450, y, 'S-EXIST'); v.line(-450, y, -100, y, 'S-HIDDEN'); } zz(v, -970, bt + 100, -970, 650);
      v.line(-r, top, -r, -1800, 'S-HIDDEN'); v.line(r, top, r, -1800, 'S-HIDDEN'); v.line(-r, top, r, top, 'S-HIDDEN'); pend(v, 0, -1800, D, 'S-HIDDEN'); v.cl(0, top - 100, 0, 1290); T(B, 793, 1440, '℄ PILE', TH, 'c');
      [-375, 375].forEach(x => v.line(x, bt + 75, x, cap(x) - 75, 'S-REO')); v.line(-375, bt + 75, 375, bt + 75, 'S-REO');
      v.rect(-r - 30, ya - 50, D + 90, 100, 'S-NEW'); rod(v, -r - 60, ya, r + 120, ya, 50);
      v.ground(-1000, -450, 0); v.ground(450, 900, 0); v.line(900, 0, 2300, 0, 'S-TEXT'); lvl(v, 1900, 0);
      fin(v, 0, cap(0) + 20, 'U2'); slope(v, 420, 330, '2'); slope(v, 420, -450, '4');
      mk(v, -1480, 1181, 'B', -90, 10); mk(v, -2150, ya, 'A', -90, 10); lvl(v, 1100, 310); v.line(830, 310, 1100, 310, 'S-TEXT'); lvl(v, 1100, ya); v.line(830, ya, 1100, ya, 'S-TEXT');
      dv(v, ya, cap(450) + 230 * 0 + 210, 450, 1620, "'H' (" + H + ' MAX.)', sub('REFER NOTE 3.')); dv(v, ya, ya + 100, -450, -1330, '100'); dv(v, bt, ya, -450, -1200, '500', sub('MIN.')); dv(v, bt - 160, ya + 100, -450, -1580, 'MIN. 100 AVERAGE', sub('SOLID TIMBER ANNULUS')); dh(v, -450, -375, bt, bt - 300, '75 COVER', sub('(TYP.)'));
      L(v, 140, cap(140) + 150, 987, 1451, 'EXISTING TIMBER\nCAPPING', { kink: [962, 1451] }); L(v, r, top, 987, 1527, 'CUT BACK TOP OF PILE.\n100 MIN. CONCRETE COVER', { kink: [962, 1527] });
      L(v, -700, cap(-700) - 150, 269, 1641, 'EXISTING TIMBER SPIKING\nRAIL'); L(v, -375, cap(-375) - 120, 276, 1723, 'NOTCH FABRIC TO CLEAR\nEXISTING SPIKING RAIL\n(TYP.)'); L(v, 375, 100, 987, 1871, 'SL81 FABRIC', { kink: [962, 1871] }); L(v, r + 60, ya, 987, 2013, 'REMOVE SECTION OF TIMBER\nSHEETING AT ANCHOR STRAP\nLOCATION', { kink: [962, 2013] });
      T(B, 1223, 1729, 'EXISTING G.L., PERMANENT WATER\nLEVEL OR HIGH TIDE LEVEL');
      UL(B, 796, 2260, 'ELEVATION'); MT(B, 540, 2317, 'WING WALL PILE REPAIR DETAIL - TYPE WW2', 20, null, 'dia');
    }
    NB(B, 2172, 2321, [GN1, 'EXTENT OF DETERIORATED TIMBER PILE SHALL BE DETERMINED ON SITE BY DRILLING.', 'IF MINIMUM 100 SOLID TIMBER ANNULUS NOT ACHIEVABLE WITHIN 1500 FROM TOP OF PILE,\nTHE ENGINEER IS TO PROVIDE AN ALTERNATE DESIGN.'], TH, 16);
    return B.E;
  }, 'Wing wall timber pile with a sound annulus (min 100) retained: top cut back and encased in a 900 x 650 concrete pot, tied to the sheeting with a 100x5 anchor strap and threaded rod.');

  // 8 WING WALL PILE REPAIR TYPE WW3 (1330-0007) — PFC pile(s), same layout as WW1
  def('ww3', 'Wing walls', 'Wing wall pile repair – Type WW3 (PFC)', '1330-0007', [P('pfc', 'Proposed PFC', '300PFC', { opts: PFCs }), P('D', 'Pile dia. (mm)', 350, { num: 1 }), P('H', 'Height to wing wall capping (mm)', 1800, { num: 1 })], p => wwSheet(p, 'PFC'),
    'Wing wall pile replaced by PFC section(s) bearing on the trimmed timber pile with threaded U-rods, encased in concrete and fixed to the spiking rail / capping with EA cleats.');

  // timber sheeting in elevation-section (vertical boards seen on edge, MRWA "XX" board symbol) from y0..y1 at face x, thickness t (going -x)
  function boardsV(v, x, y0, y1, t) { v.line(x, y0, x, y1, 'S-EXIST'); v.line(x - t, y0, x - t, y1, 'S-EXIST'); for (let y = y0; y + 2 * t <= y1; y += 2 * t) { v.line(x - t, y, x, y + t, 'S-EXIST'); v.line(x, y + t, x - t, y + 2 * t, 'S-EXIST'); } }
  // concrete sheeting (plan strip) with fabric and dowels — Types C1/C2
  function shPlan(v, x0, x1, yf, th, fab) { v.pl([[x0, yf], [x1, yf], [x1, yf - th], [x0, yf - th]], true, 'S-CONC'); fab.forEach(y => v.fabric(x0 + 30, y, x1 - 30, y, 150)); }

  // 9 CONCRETE SHEETING REPAIR (1330-0008)
  def('shc', 'Sheeting', 'Abutment / wing wall concrete sheeting repair', '1330-0008', [P('cap', 'Wing wall capping required', 'no', { opts: ['no', 'yes'] }), P('uc', 'Existing steel pile', '250UC73', { opts: UCs })], (p) => {
    const B = new Builder(), s = SEC[p.uc] || SEC['250UC73'], R = { r: true };
    // ---- ELEVATION (1:20), origin at G.L. at the first pile
    {
      const v = V(B, 20, 552, 502), px = [0, 2780], top = 1310, bot = -605, xe = 4075, pr = 460, rt = 145;
      px.forEach(x => { [-s.b / 2, s.b / 2].forEach(o => v.line(x + o, top + 200, x + o, rt, 'S-EXIST')); v.line(x - s.b / 2, rt, x + s.b / 2, rt, 'S-EXIST'); zz(v, x - s.b / 2 - 40, top + 200, x + s.b / 2 + 40, top + 200); });
      v.line(px[0] + s.b / 2, top, xe, top, 'S-EXIST'); v.line(xe, top, xe, -900, 'S-EXIST'); zz(v, xe, 50, xe, 51);
      for (let y = top - 160; y > 0; y -= 160) { v.line(px[0] + s.b / 2, y, px[0] + s.b / 2 + 280, y, 'S-HIDDEN'); v.line(px[1] - s.b / 2 - 280, y, px[1] + s.b / 2 + 280, y, 'S-HIDDEN'); }
      px.forEach(x => { v.pl([[x - pr, -900], [x - pr, rt], [x + pr, rt], [x + pr, -900]], false, 'S-EXIST'); zz(v, x - pr - 30, -900, x + pr + 30, -900); });
      v.pl([[px[0] + pr, 0], [px[0] + pr, bot], [px[1] - pr, bot], [px[1] - pr, 0]], false, 'S-NEW');
      for (let y = -80; y > bot; y -= 80) { v.line(px[0] + pr + 30, y, px[0] + pr + 450, y, 'S-HIDDEN'); v.line(px[1] - pr - 400, y, px[1] - pr + 20, y, 'S-HIDDEN'); }
      v.line(-1000, 0, xe + 100, 0, 'S-GROUND'); tuftE(v, -800, 0, -pr - 50, 0, 0, 1); tuftE(v, 1000, 0, 1600, 0, 0, 1); tuftE(v, px[1] + pr + 50, 0, xe - 100, 0, 0, 1);
      v.add({ t: 'pl', p: ellP(px[1] - pr, -150, 430, 430, 32).map(q => v.P(q[0], q[1])), closed: true, L: 'S-TEXT' }); num(v, px[1] - 450, -1000, '1'); v.line(px[1] - 470, -880, px[1] - 520, -560, 'S-TEXT');
      mk(v, 1360, top + 1000, 'A', -90); v.line(1360, top + 850, 1360, top + 500, 'S-TITLE'); v.line(1360, -800, 1360, -1150, 'S-TITLE'); v.fill([[1360, -1150], [1430, -1000], [1360, -1030]], 'S-TEXT');
      mk(v, -560, 460, 'B', -90, 14); mk(v, px[1] - 560, 460, 'C', -90, 14); [[300, 'B'], [px[1] + 300, 'C']].forEach(([x]) => { v.line(x - 500, 460, x + 600, 460, 'S-TEXT'); lvl(v, x + 350, 460); });
      L(v, -s.b / 2, 1100, 285, 180, 'EXISTING STEEL\nPILE (TYP.)', R); L(v, -pr, -1000, 216, 711, 'EXISTING CONCRETE\nPILE REPAIR (TYP.)', Object.assign({ dot: true }, R)); L(v, 1600, -300, 509, 774, 'PROPOSED CONCRETE\nSHEETING REPAIR', { dot: true });
      UL(B, 886, 862, 'ELEVATION'); MT(B, 622, 912, 'ABUTMENT/WINGWALL CONCRETE SHEETING REPAIR', 20, null, 'dot');
    }
    // ---- SECTION A (1:20) — capping not required / required; origin at the sheeting face, G.L.
    [[1806, false], [2603, true]].forEach(([px, cap]) => {
      const v = V(B, 20, px, 505), th = 200, top = cap ? 1360 : 1300, bt = -600, x0 = 0, tw2 = cap ? 230 : th;
      boardsV(v, x0, bt - 160, top - (cap ? 240 : 0), 45); zz(v, x0 - 60, bt - 160, x0 + 20, bt - 160);
      if (!cap) { v.pl([[x0, top], [th - 20, top], [th, top - 20], [th, bt], [x0, bt]], true, 'S-CONC'); v.bar([[75, top - 75], [75, bt + 75]]); }
      else { timberX(v, x0 - 45, top - 240, 140, 240); v.pl([[x0 - 120, top - 300], [x0 - 120, top - 20], [x0 - 100, top], [tw2 - 20, top], [tw2, top - 20], [tw2, bt], [x0, bt], [x0, top - 300]], true, 'S-CONC'); v.bar([[x0 - 45, top - 75], [tw2 - 75, top - 75], [tw2 - 75, bt + 75]]); v.bar([[x0 + 75, bt + 75], [x0 + 75, top - 300]]); dv(v, top - 375, top - 75, tw2, tw2 + 300, '300', sub('LAP')); dv(v, top - 150, top, x0 - 120, x0 - 330, '150'); slope(v, x0 - 100, top - 200, '2'); dh(v, x0 - 120, tw2, bt - 160, bt - 450, '300'); }
      v.ground(tw2, tw2 + 650, 0); v.line(tw2 + 650, 0, tw2 + 1500, 0, 'S-TEXT'); lvl(v, tw2 + 620, 0); slope(v, tw2 + 20, 700, '2'); fin(v, (cap ? 0 : 60), top + 10, 'U2');
      dh(v, tw2 - 75, tw2, top - 230, top - 230, '75 COVER'); dv(v, bt, bt + 75, tw2, tw2 + 250, '75', sub('COVER')); dv(v, bt, 0, tw2, tw2 + 620, '600', sub('MIN.'));
      if (!cap) { dh(v, x0, th, top, top + 330, '200'); L(v, th - 10, top, 1904, 197, '20 CHAMFER', { kink: [1883, 197] }); L(v, 75, 700, 1904, 332, 'SL81 FABRIC'); L(v, x0 - 30, 800, 1697, 286, 'EXISTING\nTIMBER\nSHEETING', R); T(B, 1950, 432, 'EXISTING G.L., PERMANENT WATER\nLEVEL OR HIGH-TIDE LEVEL'); VT(B, 1806, 781, 'SECTION A', 20, 'SHEETING WHERE WINGWALL CAPPING NOT REQUIRED'); }
      else { dh(v, x0 - 120, x0 + 75, -200, -200, '75 COVER'); L(v, x0 - 45, top - 75, 2550, 127, 'SL81 FABRIC CUT\nAND BEND TO SUIT', R); L(v, tw2 - 10, top, 2703, 154, '20 CHAMFER\n(TYP.)'); L(v, 30, top - 150, 2510, 321, 'EXISTING TIMBER\nSPIKING RAIL', R); L(v, x0 - 30, 500, 2454, 397, 'EXISTING\nTIMBER\nSHEETING', R); L(v, tw2 - 75, 700, 2703, 334, 'SL81 FABRIC\n(TYP.)'); T(B, 2797, 440, 'EXISTING G.L., PERMANENT WATER\nLEVEL OR HIGH-TIDE LEVEL'); VT(B, 2574, 783, 'SECTION A', 20, 'SHEETING WHERE WINGWALL CAPPING REQUIRED'); }
    });
    // ---- SECTIONS B / C (1:10): Types C1A, C1B (dowels welded to the pile web), C2A, C2B (dowels through the web)
    [[571, 1164, 'C1A', false], [571, 1893, 'C1B', true], [1439, 1164, 'C2A', false], [1464, 1896, 'C2B', true]].forEach(([px, py, ty, cap]) => {
      const v = V(B, 10, px, py), c2 = ty[1] === '2', xR = c2 ? 700 : 700, xL = c2 ? -700 : -s.b / 2 + 10, th = cap ? 280 : 160, yb = -45 - th;
      v.line(c2 ? -720 : -420, 0, xR, 0, 'S-EXIST'); v.line(c2 ? -720 : -420, -45, xR, -45, 'S-EXIST'); tuftE(v, 30, 0, 330, 0, 0, 1); zz(v, c2 ? -740 : -440, -60, c2 ? -740 : -440, 20); zz(v, xR + 20, -60, xR + 20, 20);
      v.line(-s.b / 2, -45, s.b / 2, -45, 'S-EXIST'); v.line(-s.tw, -45, -s.tw, -330, 'S-EXIST'); v.line(s.tw, -45, s.tw, -330, 'S-EXIST'); v.cl(0, 150, 0, -380);
      v.pl([[xL, -45], [xR, -45], [xR, yb], [xL, yb]], true, 'S-CONC'); zz(v, xR + 15, yb + 20, xR + 15, -60);
      const fy = cap ? [-45 - 55, yb + 40] : [yb + 40]; fy.forEach(y => { if (c2) { v.fabric(xL + 20, y, -s.tw - 15, y, 150); v.fabric(s.tw + 15, y, xR - 20, y, 150); } else v.fabric(s.tw + 15, y, xR - 20, y, 150); });
      const yd = cap ? (yb - 45 + (-45)) / 2 - 15 : yb + 75; if (c2) v.line(-300, yd, 300, yd, 'S-REO'); else { v.line(s.tw, yd, 330, yd, 'S-REO'); v.weld(s.tw + 5, yd - 8, 26, -14, { size: '6', all: true, site: true }); }
      dh(v, -s.b / 2 + 10, -s.b / 2 + 50, yb, yb - 160, cap || c2 ? '40 COVER' : '40', cap || c2 ? sub('(TYP.)') : sub('COVER'));
      if (!c2) L(v, 200, yd, 744, py - (cap ? 86 : 133), 'N12×300 LONG DOWEL AT\n200 CRS', { kink: [726, py - (cap ? 86 : 133)] });
      else L(v, 30, yd, cap ? 1571 : 1544, py - (cap ? 129 : 118), 'N12×600 LONG DOWEL AT\n200 CRS THROUGH φ40 SITE\nDRILLED HOLE THROUGH\nEXISTING STEEL PILE', { kink: [(cap ? 1571 : 1544) - 18, py - (cap ? 129 : 118)] });
      L(v, 450, fy[fy.length - 1], cap ? px + 272 : px + (c2 ? 240 : 237), cap ? py + 221 : (c2 ? py + 175 : py - 59), cap ? 'SL81 FABRIC\n(TYP.)' : 'SL81 FABRIC' + (c2 ? '\n(TYP.)' : ''));
      L(v, -s.tw, -280, c2 ? px - 160 : 407, cap ? py + 223 : py + (c2 ? 223 : 179), 'EXISTING STEEL PILE', R);
      if (cap || c2) L(v, c2 ? -250 : -200, 0, c2 ? px - 75 : 471, py - 83, 'EXISTING TIMBER SHEETING', R);
      const t1 = 'TYPE ' + ty, tx = px - 7; T(B, tx, py + 329, t1, 3.0, 'l', 'S-TITLE'); B.E.push({ t: 'line', a: [X(tx), Y(py + 329) - 1.1], b: [X(tx) + t1.length * 3 * 0.68, Y(py + 329) - 1.1], L: 'S-TITLE' }); T(B, tx, py + 358, cap ? 'SHEETING WHERE WINGWALL CAPPING IS REQUIRED' : 'SHEETING WHERE WINGWALL CAPPING NOT REQUIRED');
      VT(B, tx, py + 436, c2 ? 'SECTION C' : 'SECTION B', 10);
    });
    // ---- TYPE C3: PLAN and DETAIL 1 (1:10) — dowels into an existing concrete pile repair; origin at the concrete repair face
    {
      const v = V(B, 10, 2355, 1232), th = 130;
      v.line(-560, 0, 680, 0, 'S-EXIST'); v.line(-560, -130, 680, -130, 'S-EXIST'); tuftE(v, -320, 0, -120, 0, 0, 1); zz(v, -580, -80, -580, -40);
      v.pl([[-560, -130], [0, -130], [0, -130 - th - 30], [-560, -130 - th - 30]], false, 'S-CONC'); v.fabric(-540, -130 - th + 20, -10, -130 - th + 20, 150); v.line(-280, -175, 540, -175, 'S-REO');
      v.pl([[0, 0], [680, 0], [670, -150], [620, -380], [520, -560], [180, -580], [0, -590]], false, 'S-EXIST'); v.line(0, 0, 0, -600, 'S-EXIST');
      dh(v, -75, 0, -130 - th - 30, -130 - th - 300, '75 COVER', sub('(TYP.)'));
      L(v, 0, -60, 2060, 1078, 'LIGHTLY SCABBLE\nEXISTING CONCRETE'); L(v, -200, 0, 2000, 1160, 'EXISTING TIMBER\nSHEETING'); L(v, -380, -130 - th + 20, 2140, 1400, 'SL81 FABRIC\n(TYP.)', R); L(v, 300, -350, 2490, 1468, 'EXISTING CONCRETE', { dot: true, kink: [2470, 1468] });
      UL(B, 2330, 1546, 'PLAN');
      const w = V(B, 10, 2390, 1650), ys = [-310, -430, -550, -670].map(y => y + 0);
      w.line(-260, 0, 300, 0, 'S-EXIST'); lvl(w, 140, 0); w.pl([[300, 0], [300, -120], [250, -250], [170, -420], [80, -560], [40, -700]], false, 'S-EXIST'); w.line(-10, 0, -10, -720, 'S-EXIST'); w.ground(200, 500, -180); w.line(500, -180, 560, -180, 'S-GROUND');
      ys.forEach(y => w.bar([[-650, y], [180, y]]));
      dv(w, ys[3], ys[0], -650, -700, '4 DOWELS', sub('AT 100 CRS.')); dv(w, ys[0], ys[0] + 100, -650, -700, '100');
      T(B, 2443, 1629, 'TOP OF EXISTING\nCONCRETE PILE REPAIR'); L(w, -100, ys[3], 2519, 1914, 'N12 DOWEL x 600 LONG EMBEDDED 300 INTO\nEXISTING CONCRETE USING HILTI HIT-HY150\nOR SIMILAR APPROVED (TYP.)', { kink: [2496, 1914] });
      T(B, 2310, 1981, 'TYPE C3', 3.0, 'l', 'S-TITLE'); B.E.push({ t: 'line', a: [X(2310), Y(1981) - 1.1], b: [X(2310) + 7 * 3 * 0.68, Y(1981) - 1.1], L: 'S-TITLE' });
      VT(B, 2304, 2054, 'DETAIL 1', 10);
    }
    NB(B, 2281, 2171, [GN1, 'EXISTING DETAILS SHOWN ARE INDICATIVE ONLY AND INTENDED\nTO SET CONTEXT FOR THE REPAIR DETAIL. ACTUAL DETAILS\nTO BE CONFIRMED ON SITE.', "LOCATIONS AND EXTENT OF REPAIRS SHALL BE CONFIRMED ON\nSITE BY THE CONTRACTOR TO THE APPROVAL OF THE\nSUPERINTENDENT'S REPRESENTATIVE AND AS SHOWN ON THE\nPROJECT DRAWINGS.", 'FOR DOWELS WELDED TO STEEL PILE WEBS, ENSURE MINIMUM 10mm\nCLEARANCE BETWEEN DOWEL EDGE AND PILE FLANGE TO ALLOW WELDING.'], TH, 16);
    return B.E;
  }, 'Concrete sheeting cast against deteriorated abutment / wing wall timber sheeting, doweled to existing steel piles (Types C1, C2) or existing concrete pile repairs (Type C3).');

  // sheet-coordinate view: model units are sheet px (220 dpi), y given negative (down the sheet)
  const SV = B => B.view(1 / K, 0, 0);
  // repair-location ellipse (hatched) in a sheet-coordinate view
  const repLoc = (v, x, y, rx, ry) => { const P0 = ellP(x, y, rx, ry, 26).map((q, i) => [q[0] + (i % 3 === 0 ? 3 : 0), q[1]]); v.hatch(P0, 'ansi31', 'S-HATCH', 0.6); v.pl(P0, true, 'S-TEXT'); };
  // board joint lines (existing, dash-dot) across x0..x1 at the given ys
  const joints = (v, x0, x1, ys, L0) => ys.forEach(y => v.line(x0, y, x1, y, L0 || 'S-EXIST'));

  // 10 TIMBER SHEETING REPAIR TYPE 1 / 1A + PGI SHEETING REPAIR (1330-0009)
  def('sht1', 'Sheeting', 'Timber sheeting repair – Types 1 / 1A & PGI', '1330-0009', [P('n', 'Number of boards replaced', 3, { num: 1 }), P('D', 'Pile dia. (mm)', 350, { num: 1 })], (p) => {
    const B = new Builder(), v = SV(B), n = max(1, min(4, +p.n || 3)), bp = 93, R = { r: true };
    // ---- TYPE 1: PLAN (1:10)
    v.line(260, -410, 896, -410, 'S-EXIST'); v.line(260, -446, 896, -446, 'S-EXIST'); zz(v, 260, -400, 260, -456); zz(v, 896, -400, 896, -456); tuftE(v, 353, -410, 487, -410, 0, 1); tuftE(v, 713, -410, 833, -410, 0, 1);
    v.rect(560, -477, 207, 31, 'S-NEW'); zz(v, 767, -440, 767, -483); v.circ(497, -541, 69, 'S-EXIST');
    aSec(v, 560, -477, 40, 93, 4, 1, -1, 'S-NEW'); v.line(540, -523, 569, -523, 'S-BOLT'); v.rect(533, -527, 7, 8, 'S-BOLT');
    v.line(347, -523, 535, -523, 'S-DIM'); v.line(347, -545, 545, -545, 'S-DIM'); dv(v, -545, -523, 347, 347, '40', sub('MIN.')); dh(v, 560, 583, -446, -346, '55');
    L(v, 653, -410, 773, 338, 'EXISTING TIMBER SHEETING'); L(v, 667, -477, 757, 558, 'PROPOSED 225×75 THICK\nSEASONED JARRAH\nTIMBER SHEETING (TYP.)'); L(v, 566, -557, 757, 667, 'TRIM EXISTING TIMBER PILE FACE\nTO PROVIDE 70 MIN. BEARING TO ANGLE'); L(v, 500, -559, 757, 758, 'EXISTING TIMBER PILE', { dot: true });
    UL(B, 507, 706, 'PLAN');
    // ---- TYPE 1: ELEVATION (1:10)
    const y0 = 1317, ys = Array.from({ length: n + 1 }, (_, i) => -(y0 + i * bp)), yb = ys[n];
    joints(v, 293, 407, [-1271, ys[0], ...ys.slice(1, -1), yb, yb - 50].map(y => y)); joints(v, 593, 793, [-1271, yb - 50]); joints(v, 793 - 0, 793, []);
    [-1226, yb - 79].forEach(y => { v.line(293, y, 407, y, 'S-EXIST'); v.line(593, y, 793, y, 'S-EXIST'); }); zz(v, 293, -1226, 293, -1300); zz(v, 293, yb + 20, 293, yb - 79); zz(v, 793, -1226, 793, -1300); zz(v, 793, yb - 10, 793, yb - 79);
    v.line(407, -1226, 407, yb - 79, 'S-EXIST'); v.line(593, -1226, 593, yb - 79, 'S-EXIST'); pend(v, 500, -1226, 186); pend(v, 500, yb - 79, 186); v.cl(487, -1106, 487, yb - 100); T(B, 470, 1106, '℄ PILE');
    ys.forEach(y => v.line(593, y, 793, y, 'S-NEW')); v.line(793, ys[0], 793, yb, 'S-NEW'); v.rect(560, yb, 40, ys[0] - yb, 'S-NEW'); v.line(571, yb, 571, ys[0], 'S-NEW');
    for (let i = 0; i < n; i++) { const y = (ys[i] + ys[i + 1]) / 2 - 0; v.line(536, y, 600, y, 'S-BOLT'); v.rect(526, y - 4, 12, 8, 'S-BOLT'); v.circ(586, y, 4, 'S-BOLT'); v.line(593, y, 793, y, 'S-HIDDEN'); }
    dv(v, (ys[0] + ys[1]) / 2, ys[0], 640, 640, '='); dv(v, ys[1], (ys[0] + ys[1]) / 2, 640, 640, '=');
    const el = []; for (let i = 0; i < min(2, n); i++) { const y = (ys[i] + ys[i + 1]) / 2 - 10; repLoc(v, 729, y - 20, 57, 21); el.push([775, y - 20]); }
    L(v, 586, (ys[0] + ys[1]) / 2, 850, 1224, 'M12×75 LONG COACH SCREW FIXED CENTRALLY\nIN PROPOSED TIMBER SHEET (1 - PER SHEET\nFOR FULL HEIGHT OF REPAIR)'); LL(v, el, 850, 1441, 'REPAIR LOCATION\n(TYP.)'); L(v, 600, ys[n - 1] + 20, 850, 1594, '150×90×8 UA (GALV.)\nLENGTH TO SUIT'); L(v, 560, (ys[n - 1] + yb) / 2, 850, 1750, 'M12×75 LONG COACH SCREW INSTALLED AT\n225 CRS. TO SUIT PROPOSED SHEETING CRS.\nFULL HEIGHT OF REPAIR');
    UL(B, 517, 1869, 'ELEVATION'); VT(B, 443, 1939, 'TYPE 1', 10, 'TIMBER PILE CONNECTION');
    // ---- TYPE 1A: PLAN (1:10)
    v.line(1423, -421, 1697, -421, 'S-EXIST'); v.line(1423, -447, 1777, -447, 'S-EXIST'); zz(v, 1423, -410, 1423, -458); tuftE(v, 1557, -421, 1683, -421, 0, 1);
    v.line(1697, -421, 1897, -210, 'S-EXIST'); tuftE(v, 1810, -302, 1880, -228, -0.7, 0.7);
    v.line(1740, -421, 1925, -233, 'S-NEW'); v.line(1777, -447, 1955, -265, 'S-NEW'); v.line(1740, -421, 1777, -447, 'S-NEW'); v.line(1925, -233, 1955, -265, 'S-NEW'); v.line(1697, -421, 1777, -421, 'S-NEW');
    v.rect(1837, -447, 73, 26, 'S-EXIST'); v.hatch([[1837, -447], [1910, -447], [1910, -421], [1837, -421]], 'ansi31', 'S-HATCH', 0.5); v.circ(1743, -550, 83, 'S-EXIST');
    v.line(1828, -350, 1858, -382, 'S-BOLT'); v.rect(1820, -346, 8, 8, 'S-BOLT');
    v.dim(1777, -447, 1880, -550, -4, '250', sub('MAX.'));
    L(v, 1757, -421, 1443, 281, 'PROPOSED SHEETING\nTO ABUT EXISTING SOUND\nTIMBER SHEETING'); L(v, 1867, -314, 2034, 281, 'PROPOSED 225×75 THICK\nSEASONED JARRAH\nTIMBER SHEETING\n(TYP.)', { dot: true }); L(v, 1877, -439, 2034, 417, 'TRIM EXISTING ABUTMENT\nTIMBER SHEETING TO SUIT\nCOACH SCREW INSTALLATION', { dot: true });
    L(v, 1601, -447, 1370, 501, 'EXISTING SOUND\nTIMBER SHEETING'); L(v, 1717, -547, 1370, 607, 'EXISTING TIMBER/STEEL\nCORNER PILE\nTIMBER PILE SHOWN', { dot: true });
    UL(B, 1741, 707, 'PLAN');
    // ---- TYPE 1A: DEVELOPED ELEVATION (1:10)
    const ya = Array.from({ length: n + 1 }, (_, i) => -(1321 + i * bp)), yab = ya[n];
    [-1274, ...ya.slice(1, -1), yab - 47].forEach(y => v.line(1421, y, 1657, y, 'S-EXIST')); [-1231, yab - 76].forEach(y => { v.line(1421, y, 1657, y, 'S-EXIST'); v.line(1821, y, 2100, y, 'S-EXIST'); }); v.line(1421, -1274, 1421, yab - 47, 'S-TEXT'); zz(v, 1421, -1240, 1421, -1300); zz(v, 1421, yab, 1421, yab - 76);
    v.line(1657, -1231, 1657, yab - 76, 'S-EXIST'); v.line(1821, -1231, 1821, yab - 76, 'S-EXIST'); pend(v, 1739, -1231, 164); pend(v, 1739, yab - 76, 164); v.cl(1737, -1127, 1737, yab - 100); T(B, 1724, 1127, '℄ PILE');
    v.rect(1743, yab, 43, ya[0] - yab, 'S-EXIST'); v.hatch([[1743, yab], [1786, yab], [1786, ya[0]], [1743, ya[0]]], 'ansi31', 'S-HATCH', 0.6); v.line(1843, -1231, 1843, yab - 76, 'S-HIDDEN');
    v.rect(1846, yab, 40, ya[0] - yab, 'S-NEW'); ya.forEach(y => v.line(1786, y, 2100, y, 'S-NEW')); v.line(2100, ya[0], 2100, yab, 'S-NEW'); for (let i = 0; i < n; i++) v.line(1846, (ya[i] + ya[i + 1]) / 2, 2100, (ya[i] + ya[i + 1]) / 2, 'S-HIDDEN');
    [ya[0] - 26, yab + 26].forEach(y => { v.circ(1864, y, 4, 'S-BOLT'); v.line(1886, y, 2105, y, 'S-DIM'); }); dv(v, ya[0] - 26, ya[0], 2100, 2096, '60', sub('(TYP.)')); dv(v, yab, yab + 26, 2100, 2096, '60', sub('(TYP.)'));
    const ea = []; for (let i = 0; i < min(2, n); i++) { const y = (ya[i] + ya[i + 1]) / 2 - 10; repLoc(v, 1971, y - 15, 57, 21); ea.push([2010, y - 15]); }
    L(v, 1886, (ya[0] + ya[1]) / 2 - 40, 2154, 1390, '90×8 FL (GALV.)\nLENGTH TO SUIT'); LL(v, ea, 2154, 1507, 'REPAIR LOCATION\n(TYP.)'); L(v, 1864, yab + 26, 1979, 1747, 'M12×125 LONG\nCOACH SCREW\n(TYP.)');
    UL(B, 1803, 1870, 'DEVELOPED ELEVATION'); VT(B, 1647, 1939, 'TYPE 1A', 10, 'ABUTMENT CORNER PILE CONNECTION');
    // ---- PGI SHEETING REPAIR DETAIL (ELEVATION 1:20)
    [2679, 3103].forEach(x => { v.line(x - 42, -342, x - 42, -522, 'S-EXIST'); v.line(x + 42, -342, x + 42, -522, 'S-EXIST'); pend(v, x, -342, 84); pend(v, x, -522, 84); v.cl(x, -195, x, -560); T(B, x - 3, 185, '℄ PILE'); });
    [-342, -369, -418, -446, -501, -522].forEach((y, i) => { v.line(2603, y, 2637, y, 'S-EXIST'); v.line(2721, y, 3061, y, 'S-EXIST'); v.line(3144, y, 3172, y, 'S-EXIST'); });
    [[-397, -414], [-446, -462]].forEach(([a, b0]) => { [2603, 3144].forEach(x0 => v.rect(x0, b0, 28, a - b0, 'S-NEW')); v.rect(2717, b0, 330, a - b0, 'S-NEW'); for (let x = 2730; x < 3047; x += 32) v.circ(x, (a + b0) / 2, 1.6, 'S-BOLT'); });
    zz(v, 2603, -330, 2603, -535); zz(v, 3172, -330, 3172, -535); zz(v, 2845, -342, 2880, -342); zz(v, 2845, -522, 2880, -522);
    dh(v, 2679, 2717, -342, -258, '50'); dh(v, 3047, 3103, -342, -258, '50'); dh(v, 2717, 3047, -342, -258, ''); T(B, 2882, 252, '2.8×30 LONG GALV. CLOUTHEAD\nNAILS @ 200 MAX. CRS.', 2.0, 'c');
    L(v, 2846, -397, 2856, 311, '20 (TYP.)', { kink: [2846, 311] }); L(v, 3026, -394, 3173, 260, '0.8 THICK PGI STRIP\nREFER NOTE 3.'); L(v, 2686, -481, 2756, 587, 'EXISTING TIMBER\nPILE (TYP.)'); L(v, 2975, -483, 3054, 587, 'EXISTING TIMBER\nSHEETING (TYP.)', { dot: true });
    UL(B, 2911, 647, 'ELEVATION'); VT(B, 2731, 697, 'PGI SHEETING REPAIR DETAIL', 20);
    MT(B, 821, 2146, 'ABUTMENT/WING WALL TIMBER SHEETING REPAIR DETAILS', 20, null, 'hatch');
    NB(B, 2376, 2310, [GN1, "LOCATIONS AND EXTENT OF REPAIRS SHALL BE CONFIRMED ON SITE\nBY THE CONTRACTOR TO THE APPROVAL OF THE SUPERINTENDENT'S\nREPRESENTATIVE AND AS SHOWN ON THE PROJECT DRAWINGS.", 'PGI STRIPS SHALL BE PLACED OVER SHEETING JOINTS . STRIP SHALL\nBE 100 WIDE FOR GAPS ≤ 20mm AND 150 WIDE FOR GAPS >20mm.\nPGI REPAIRS NOT APPROPRIATE FOR GAPS EXCEEDING 70mm.'], TH, 17);
    return B.E;
  }, 'Replacement of deteriorated abutment / wing wall timber sheeting boards on timber piles (Type 1 with a UA cleat, Type 1A at corner piles with a flat), and PGI strips over open sheeting joints.');

  // 11 SPIKING RAIL RETAINER TYPES 1 / 2 (1330-0011) — drawn in sheet coordinates
  def('srr', 'Sheeting', 'Spiking rail retainer – Types 1 & 2', '1330-0011', [P('L', 'Type A plate length (mm)', 500, { num: 1 })], (p) => {
    const B = new Builder(), v = SV(B), R = { r: true }, Lp = max(400, min(800, +p.L || 500)), k = 0.416;
    const kerb = (dx, pts) => { const P0 = pts.map(q => [q[0] + dx, -q[1]]); v.pl(P0, true, 'S-CONC'); v.hatch(P0, 'conc', 'S-HATCH', 0.6); };
    // ---- PLANS (TYPE 1 at dx 0, TYPE 2 at dx 876)
    [[0, '330', 1], [876, '350', 2]].forEach(([dx, dl, ty]) => {
      const X0 = x => x + dx;
      v.line(X0(595), -190, X0(722), -317, 'S-EXIST'); v.line(X0(625), -160, X0(752), -287, 'S-EXIST'); zz(v, X0(585), -180, X0(635), -150);
      v.line(X0(570), -215, X0(697), -342, 'S-EXIST'); v.line(X0(595), -190, X0(570), -215, 'S-EXIST'); timberX(v, X0(590), -200, 1, 1, 'S-EXIST');
      v.line(X0(732), -300, X0(732), -529, 'S-EXIST');
      kerb(dx, [[746, 279], [800, 300], [850, 340], [871, 400], [860, 470], [820, 508], [760, 500], [746, 450]]);
      v.pl([[X0(615), -270], [X0(705), -360], [X0(732), -387], [X0(732), -452]], false, 'S-NEW'); v.pl([[X0(611), -274], [X0(701), -364], [X0(727), -390], [X0(727), -452]], false, 'S-NEW'); v.line(X0(727), -452, X0(732), -452, 'S-NEW');
      [[640, -295], [668, -323]].forEach(([x, y]) => { v.line(X0(x), y, X0(x - 25), y + 25, 'S-BOLT'); v.line(X0(x) + 4, y + 4, X0(x) - 4, y - 4, 'S-BOLT'); });
      [-394, -428].forEach(y => { v.line(X0(727), y, X0(770), y, 'S-BOLT'); v.rect(X0(720), y - 5, 7, 10, 'S-BOLT'); });
      v.dim(X0(615), -270, X0(705), -360, -14, dl); v.dim(X0(615), -270, X0(640), -295, 10, '30'); v.dim(X0(640), -295, X0(668), -323, 10, '90');
      dv(v, -428, -394, X0(732), X0(790), '90'); dv(v, -452, -428, X0(732), X0(790), '30');
      L(v, X0(600), -205, X0(304), 172, 'EXISTING TIMBER\nSPIKING RAIL', { dot: true }); L(v, X0(640), -295, X0(304), 256, 'M8 x 75 LONG GALV.\nCOACH SCREW (TYP.)' + (ty === 1 ? '\nFIXED TO SPIKING RAIL' : '')); L(v, X0(712), -382, X0(304), 351, 'ANGLE TO SUIT EXISTING\nGEOMETRY. TO BE SITE\nMEASURED PRIOR TO\nFABRICATION.');
      L(v, X0(745), -428, X0(304), 525, 'φ8 MASONRY ANCHOR (TYP.)\n(BTG875 BLUE-TIP SCREW\nBOLT BY POWERS FASTENERS\nOR SIMILAR APPROVED)'); L(v, X0(697), -265, X0(886), 161, 'EXISTING TIMBER\nSHEETING'); L(v, X0(781), -300, X0(886), 228, 'EXISTING OR PROPOSED\nCONCRETE KERB', { dot: true });
      if (ty === 1) LL(v, [[X0(760), -394], [X0(760), -428]], X0(886), 300, 'φ10 x 20 LONG\nSLOTTED HOLE');
      UL(B, X0(718), 575, 'PLAN');
    });
    // ---- ELEVATION TYPE 1
    v.line(586, -818, 794, -818, 'S-EXIST'); v.line(586, -853, 736, -853, 'S-EXIST'); v.line(586, -853, 586, -950, 'S-EXIST'); zz(v, 586, -820, 586, -870);
    v.rect(621, -925, 111, 56, 'S-EXIST'); v.rect(615, -930, 130, 66, 'S-NEW'); [642, 663].forEach(x => { v.circ(x, -897, 4, 'S-BOLT'); }); [739, 774].forEach(x => { v.rect(x - 7, -900, 14, 6, 'S-BOLT'); v.line(x - 10, -897, x + 10, -897, 'S-BOLT'); });
    kerb(0, [[736, 772], [797, 772], [797, 946], [736, 946]]); mk(v, 718, -714, 'C', -90); v.line(718, -735, 718, -770, 'S-TITLE'); v.line(718, -960, 718, -1000, 'S-TITLE'); v.fill([[718, -1000], [726, -1015], [718, -1030]], 'S-TEXT');
    L(v, 644, -828, 304, 749, 'EXISTING TIMBER\nWING WALL CAPPING', { dot: true }); L(v, 600, -879, 304, 851, 'EXISTING TIMBER\nSPIKING RAIL', { dot: true }); L(v, 649, -930, 304, 999, '8PL BENT TO SUIT WING WALL\nREFER FABRICATION DETAIL\n- TYPE A'); L(v, 781, -849, 872, 749, 'EXISTING OR PROPOSED\nCONCRETE OVERLAY', { dot: true });
    UL(B, 715, 1096, 'ELEVATION'); VT(B, 521, 1140, 'SPIKING RAIL RETAINER -TYPE 1', 10);
    // ---- ELEVATION TYPE 2 (sloping wing wall)
    const sl = (x0, y0, len) => [[x0, -y0], [x0 + len * 0.866, -(y0 - len * 0.5)]];
    [[1430, 905], [1430, 940], [1430, 990]].forEach(([x, y], i) => { const q = sl(x, y, 220); v.line(q[0][0], q[0][1], q[1][0], q[1][1], 'S-EXIST'); }); zz(v, 1430, -900, 1430, -1000);
    v.pl([[1500, -955], [1590, -903], [1612, -940], [1522, -992]], true, 'S-NEW'); v.line(1600, -922, 1622, -922, 'S-NEW'); v.rect(1612, -930, 10, 60, 'S-NEW'); [[1540, -950], [1565, -935]].forEach(([x, y]) => v.circ(x, y, 4, 'S-BOLT')); v.rect(1615, -904, 42, 6, 'S-BOLT');
    kerb(0, [[1622, 772], [1692, 772], [1692, 939], [1622, 939]]); mk(v, 1594, -714, 'C', -90); T(B, 1615, 722, 'SIMILAR'); v.line(1594, -735, 1594, -770, 'S-TITLE'); v.line(1594, -960, 1594, -1000, 'S-TITLE'); v.fill([[1594, -1000], [1602, -1015], [1594, -1030]], 'S-TEXT');
    L(v, 1511, -925, 1185, 711, 'ANGLE TO SUIT EXISTING\nGEOMETRY. TO BE SITE\nMEASURE PRIOR TO\nFABRICATION.'); L(v, 1525, -900, 1185, 839, 'EXISTING TIMBER\nWING WALL CAPPING', { dot: true }); L(v, 1483, -955, 1185, 917, 'EXISTING TIMBER\nSPIKING RAIL', { dot: true });
    L(v, 1532, -980, 1185, 1006, '8PL BENT TO SUIT\nWING WALL. REFER\nFABRICATION DETAIL\n- TYPE B'); L(v, 1664, -851, 1756, 751, 'EXISTING OR PROPOSED\nCONCRETE OVERLAY', { dot: true });
    UL(B, 1592, 1096, 'ELEVATION'); VT(B, 1397, 1140, 'SPIKING RAIL RETAINER -TYPE 2', 10);
    // ---- SECTION C (1:10)
    timberX(v, 2264, -851, 93, 31); timberX(v, 2264, -946, 32, 95); timberX(v, 2296, -946, 50, 95); zz(v, 2264, -970, 2300, -970);
    v.rect(2346, -930, 68, 62, 'S-NEW'); [2364, 2404].forEach(x => { v.pl([[x - 7, -899], [x, -895], [x + 7, -899], [x, -903]], true, 'S-BOLT'); }); v.line(2346, -899, 2414, -899, 'S-CL');
    dv(v, -930, -899, 2414, 2450, '='); dv(v, -899, -868, 2414, 2450, '='); dv(v, -930, -868, 2414, 2493, '150');
    L(v, 2264, -820, 2036, 759, 'EXISTING TIMBER\nWING WALL CAPPING', R); L(v, 2264, -890, 2036, 829, 'EXISTING TIMBER\nSHEETING', R); L(v, 2330, -946, 2138, 1016, 'EXISTING TIMBER\nSPIKING RAIL', R); LL(v, [[2364, -899], [2404, -899]], 2436, 1016, 'φ10 x 20 LONG\nSLOTTED HOLE');
    VT(B, 2257, 1120, 'SECTION C', 10);
    // ---- PLATE FABRICATION DETAIL - TYPE A (developed elevation)
    {
      const x0 = 600, W = Lp * k, xb = x0 + (Lp - 260) * k + 30 * k * 0 + 0, xs = [0, 30, 120, Lp - 170, Lp - 120, Lp - 30, Lp].map(m => x0 + m * k);
      v.rect(x0, -1503, W, 65, 'S-NEW'); v.line(xs[3], -1438, xs[3], -1503, 'S-HIDDEN');
      [xs[1], xs[2]].forEach(x => { v.line(x - 5, -1471, x + 5, -1471, 'S-BOLT'); v.line(x, -1466, x, -1476, 'S-BOLT'); }); [xs[4], xs[5]].forEach(x => v.pl([[x - 8, -1471], [x, -1467], [x + 8, -1471], [x, -1475]], true, 'S-BOLT'));
      v.dimChain(xs.map(x => [x, -1503]), -16, ['30', '90', String(Lp - 290), '50', '90', '30']); dh(v, xs[0], xs[6], -1503, -1615, String(Lp)); dv(v, -1503, -1438, xs[6], xs[6] + 80, '150'); dv(v, -1503, -1471, xs[6], xs[6] + 43, '='); dv(v, -1471, -1438, xs[6], xs[6] + 43, '=');
      L(v, xs[3], -1440, 474, 1292, 'PLATE BENT TO SUIT\nWING WALL ANGLE', { kink: [685, 1292] }); L(v, xs[2], -1471, 474, 1380, 'φ10 HOLE\n(TYP.)'); L(v, xs[4], -1471, 857, 1292, 'φ10 x 20 LONG\nSLOTTED HOLE\n(TYP.)'); L(v, xs[6], -1450, 857, 1391, '8FL');
      UL(B, 726, 1695, 'DEVELOPED ELEVATION'); VT(B, 492, 1742, 'PLATE FABRICATION DETAIL - TYPE A', 10);
    }
    // ---- PLATE FABRICATION DETAIL - TYPE B (developed elevation)
    {
      const c = [1596, -1454], u = [-0.766, -0.643], n0 = [0.643, -0.766], L0 = 229 * k, Wd = 150 * k;
      const e1 = [c[0] + u[0] * L0, c[1] + u[1] * L0], top = [1596, -1392], e2 = [top[0] + u[0] * L0 + 0, top[1] + u[1] * L0];
      v.pl([[1750, -1392], top, [top[0] + u[0] * L0, top[1] + u[1] * L0], [c[0] + u[0] * L0, c[1] + u[1] * L0], c, [1750, -1454]], true, 'S-NEW'); v.line(1596, -1392, 1596, -1454, 'S-HIDDEN');
      [[1558, -1438], [1540, -1470]].forEach(([x, y]) => { v.line(x - 5, y, x + 5, y, 'S-BOLT'); v.line(x, y - 5, x, y + 5, 'S-BOLT'); }); [1642, 1681].forEach(x => v.pl([[x - 8, -1423], [x, -1419], [x + 8, -1423], [x, -1427]], true, 'S-BOLT'));
      v.arc(1596, -1454, 254, 180, 360, 'S-TEXT'); v.arc(1596, -1454, 254, 150, 180, 'S-TEXT');
      dh(v, 1596 - 23 * 0, 1750, -1392, -1295, '275'); dh(v, 1679, 1750, -1392, -1338, '170'); dv(v, -1454, -1392, 1750, 1781, '150'); dv(v, -1454, -1423, 1750, 1765, '='); dv(v, -1423, -1392, 1750, 1765, '=');
      dh(v, 1575, 1596, -1454, -1541, '50'); dh(v, 1737, 1750, -1454, -1541, '30');
      v.dim(top[0], top[1], top[0] + u[0] * L0, top[1] + u[1] * L0, -8, '229'); v.dim(c[0] + u[0] * L0, c[1] + u[1] * L0, top[0] + u[0] * L0, top[1] + u[1] * L0, -10, '150'); v.dim(c[0], c[1], c[0] + u[0] * 37, c[1] + u[1] * 37, 10, '90');
      v.text(1496, -1460, '30', 2.0, 'c', 'b', 'S-DIM', 40); v.text(1504, -1466, 'MIN.', 1.8, 'c', 't', 'S-DIM', 40);
      L(v, 1596, -1400, 1238, 1257, 'PLATE BENT TO SUIT\nWING WALL ANGLE'); L(v, 1555, -1415, 1238, 1335, 'SLOPE TO MATCH\nSLOPE OF WING WALL'); L(v, 1642, -1423, 1768, 1303, 'φ10 x 20 LONG\nSLOTTED HOLE\n(TYP.)'); L(v, 1700, -1454, 1788, 1511, '8PL');
      L(v, 1540, -1470, 1442, 1597, 'φ10 HOLE\n(TYP.)', R); L(v, 1796, -1608, 1862, 1642, 'ANGLE TO SUIT EXISTING GEOMETRY\nTO BE SITE MEASURED PRIOR TO\nFABRICATION');
      UL(B, 1508, 1743, 'DEVELOPED ELEVATION'); VT(B, 1376, 1788, 'PLATE FABRICATION DETAIL - TYPE B', 10);
    }
    NB(B, 2385, 2354, [GN1, 'FOR PROPOSED OVERLAYS, CONCRETE TO BE CURED FOR MINIMUM\n7 DAYS PRIOR TO INSTALLATION OF MECHANICAL FASTENERS.'], TH, 17);
    return B.E;
  }, 'Bent 8 mm plate retainer holding the timber spiking rail to an existing or proposed concrete kerb / overlay at the wing wall (Type 1 square, Type 2 sloping wing wall).');

  // 22 TIMBER SHEETING REPAIR TYPES 2 / 2A / 3 (1330-0010)
  def('sht2', 'Sheeting', 'Timber sheeting repair – Types 2 / 2A / 3 (steel pile or concrete)', '1330-0010', [P('type', 'Type', '2', { opts: ['2', '2A', '3'] }), P('n', 'Number of boards replaced', 3, { num: 1 }), P('uc', 'Existing steel pile', '250UC73', { opts: UCs })], (p) => {
    const B = new Builder(), v = SV(B), n = max(1, min(4, +p.n || 3)), bp = 95, R = { r: true };
    const sheetTop = (x0, x1, tufts) => { v.line(x0, -397, x1, -397, 'S-EXIST'); v.line(x0, -434, x1, -434, 'S-EXIST'); zz(v, x0, -385, x0, -445); zz(v, x1, -385, x1, -445); tufts.forEach(([a, b0]) => tuftE(v, a, -397, b0, -397, 0, 1)); };
    // ---- TYPE 2 PLAN: existing UC pile with timber packer
    sheetTop(278, 822, [[294, 489], [662, 815]]); timberX(v, 407, -470, 90, 36); v.line(422, -470, 485, -470, 'S-EXIST'); v.line(422, -474, 485, -474, 'S-EXIST'); v.line(450, -474, 450, -545, 'S-EXIST'); v.line(455, -474, 455, -545, 'S-EXIST'); v.line(407, -547, 492, -547, 'S-EXIST'); v.line(407, -551, 492, -551, 'S-EXIST');
    v.rect(455, -517, 7, 47, 'S-NEW'); v.hatch([[455, -517], [462, -517], [462, -470], [455, -470]], 'ansi31', 'S-HATCH', 0.4); aSec(v, 462, -467, 60, 40, 4, 1, -1, 'S-NEW'); v.rect(497, -467, 291, 33, 'S-NEW'); zz(v, 788, -440, 788, -470);
    v.line(507, -440, 507, -477, 'S-BOLT'); v.rect(502, -481, 10, 4, 'S-BOLT'); v.line(440, -492, 470, -492, 'S-BOLT'); v.rect(436, -497, 5, 10, 'S-BOLT'); v.rect(466, -497, 5, 10, 'S-BOLT');
    dv(v, -494, -467, 520, 577, '55');
    L(v, 507, -445, 294, 265, 'PACK TO SUIT\nWITH STEEL SHIMS\nDRILL TO SUIT\nM12 COACH SCREW', { kink: [454, 265] }); L(v, 642, -408, 725, 310, 'EXISTING ABUTMENT\nTIMBER SHEETING', { dot: true }); L(v, 407, -452, 339, 471, 'EXISTING\nTIMBER\nPACKER', R);
    L(v, 440, -492, 336, 567, 'M12 BOLT', R); L(v, 425, -549, 343, 651, 'EXISTING STEEL\nPILE (TYP.)', R); L(v, 746, -467, 811, 524, '225x75 THICK PROPOSED\nSEASONED JARRAH\nTIMBER SHEETING (TYP.)'); L(v, 462, -480, 593, 574, '150x100x8 UA'); L(v, 459, -505, 593, 624, '100x20FL. x LENGTH TO SUIT\nREPAIR');
    UL(B, 465, 728, 'PLAN');
    // ---- TYPE 2A PLAN: UA bolted to the UC web
    sheetTop(1171, 1692, [[1192, 1344], [1539, 1678]]); v.line(1275, -446, 1361, -446, 'S-EXIST'); v.line(1275, -452, 1361, -452, 'S-EXIST'); v.line(1316, -452, 1316, -512, 'S-EXIST'); v.line(1321, -452, 1321, -512, 'S-EXIST'); v.line(1275, -512, 1361, -512, 'S-EXIST'); v.line(1275, -518, 1361, -518, 'S-EXIST');
    aSec(v, 1324, -469, 55, 41, 4, 1, -1, 'S-NEW'); v.line(1324, -436, 1324, -469, 'S-NEW'); v.rect(1379, -467, 278, 31, 'S-NEW'); zz(v, 1657, -440, 1657, -470); v.line(1303, -492, 1337, -492, 'S-BOLT'); v.rect(1299, -497, 5, 10, 'S-BOLT'); v.rect(1328, -497, 5, 10, 'S-BOLT');
    dv(v, -436, -397, 1171, 1171 - 40, '50', sub('MIN.')); dv(v, -494, -469, 1260, 1225, '55');
    L(v, 1351, -436, 1024, 240, 'TRIM PROPOSED 225x75 THICK\nTIMBER SHEETING TO SUIT\nEXISTING STEEL PILE', { kink: [1300, 240] }); L(v, 1514, -414, 1597, 311, 'EXISTING ABUTMENT\nTIMBER SHEETING', { dot: true }); L(v, 1303, -492, 1124, 533, 'M12 BOLT'); L(v, 1290, -518, 1068, 588, 'EXISTING STEEL\nPILE (TYP.)');
    L(v, 1335, -478, 1449, 575, '150x100x10 UA'); L(v, 1592, -467, 1653, 525, '225x75 THICK PROPOSED\nSEASONED JARRAH\nTIMBER SHEETING (TYP.)'); UL(B, 1335, 728, 'PLAN');
    // ---- TYPE 3 PLAN: UA fixed to an existing concrete pile repair
    sheetTop(2046, 2881, [[2228, 2353], [2679, 2797]]); v.pl([[2108, -436], [2108, -738], [2485, -738], [2485, -436]], false, 'S-EXIST');
    v.line(2253, -474, 2336, -474, 'S-EXIST'); v.line(2253, -480, 2336, -480, 'S-EXIST'); v.line(2292, -480, 2292, -551, 'S-EXIST'); v.line(2297, -480, 2297, -551, 'S-EXIST'); v.line(2253, -551, 2336, -551, 'S-EXIST'); v.line(2253, -557, 2336, -557, 'S-EXIST');
    aSec(v, 2485, -469, 37, 93, 4, 1, -1, 'S-NEW'); v.line(2485, -436, 2485, -469, 'S-NEW'); v.rect(2499, -464, 257, 28, 'S-NEW'); zz(v, 2756, -440, 2756, -466);
    v.line(2429, -508, 2494, -508, 'S-BOLT'); v.rect(2489, -513, 5, 10, 'S-BOLT'); v.pl([[2440, -504], [2429, -508], [2440, -512]], false, 'S-BOLT'); v.line(2508, -446, 2508, -474, 'S-BOLT');
    dv(v, -529, -508, 2494, 2554, '40');
    L(v, 2603, -400, 2717, 317, 'EXISTING TIMBER\nSHEETING'); L(v, 2631, -464, 2711, 536, 'PROPOSED 225×75 THICK\nSEASONED JARRAH\nTIMBER SHEETING (TYP.)'); L(v, 2485, -610, 2644, 676, 'EXISTING CONCRETE\nPILE REPAIR'); UL(B, 2283, 804, 'PLAN');
    // ---- ELEVATIONS (1:10)
    const ys = Array.from({ length: n + 1 }, (_, i) => -(1285 + i * bp)), yb = ys[n], mid = i => (ys[i] + ys[i + 1]) / 2, ext = [-1251, yb - 50];
    const bnd = (x0, x1, zx) => { v.line(x0, -1251, x1, -1251, 'S-EXIST'); v.line(x0, yb - 80, x1, yb - 80, 'S-EXIST'); for (let i = 0; i < n; i++) v.line(x0, mid(i), x1, mid(i), 'S-EXIST'); v.line(x0, yb - 45, x1, yb - 45, 'S-EXIST'); v.line(x0, -1251, x0, yb - 80, 'S-HIDDEN'); zz(v, zx, -1251, zx + 1, -1251); zz(v, zx, yb - 80, zx + 1, yb - 80); };
    // TYPE 2 / 2A
    [[454, false], [1327, true]].forEach(([cx, a2]) => {
      const fl = a2 ? 50 : 52, x0 = a2 ? 1150 : 277, x1 = a2 ? 1696 : 823, xr = a2 ? 1365 : 492;
      bnd(x0, x1, x0 + 60); v.line(cx - fl, -1208, cx - fl, -1746, 'S-HIDDEN'); v.line(cx + fl, -1208, cx + fl, -1746, 'S-HIDDEN'); zz(v, cx - fl - 15, -1208, cx + fl + 15, -1208); zz(v, cx - fl - 15, -1746, cx + fl + 15, -1746); v.cl(cx - 7, -1032, cx - 7, -1760);
      if (!a2) { v.rect(cx - 8, yb - 5, 23, ys[0] - yb + 10, 'S-EXIST'); v.hatch([[cx - 8, yb - 5], [cx + 15, yb - 5], [cx + 15, ys[0] + 5], [cx - 8, ys[0] + 5]], 'ansi31', 'S-HATCH', 0.5); }
      v.rect(cx - 3, yb - 6, 72, ys[0] - yb + 12, 'S-HIDDEN'); ys.forEach(y => v.line(xr, y, x1, y, 'S-NEW')); v.line(x1, ys[0], x1, yb, 'S-NEW'); zz(v, x1, mid(0) - 30, x1 + 1, mid(0) - 30);
      for (let i = 0; i < n; i++) { const y = mid(i); v.rect(cx + 6, y - 6, 8, 12, 'S-BOLT'); v.fill([[cx + 6, y - 6], [cx + 14, y - 6], [cx + 14, y + 6], [cx + 6, y + 6]], 'S-BOLT'); v.line(cx - 10, y, cx + 6, y, 'S-BOLT'); v.circ(cx + 57, y, 4, 'S-BOLT'); }
      dh(v, cx + 46, cx + 69, -1208, -1138, '30'); dv(v, mid(0), ys[0], cx + 100, cx + 100, '='); dv(v, ys[1], mid(0), cx + 100, cx + 100, '='); dv(v, mid(1), mid(0), cx + 141, cx + 141, '225', sub('(TYP.)'));
      repLoc(v, a2 ? 1588 : 715, mid(1) + 25, 100, 40);
      if (!a2) L(v, cx + 10, mid(0), 235, 1134, 'M12 BOLT\n(TYP.)'); else L(v, cx + 10, mid(0), 1100, 1162, 'M12 BOLT\n(TYP.)');
      L(v, (xr + x1) / 2 - 30, ys[0], a2 ? 1612 : 731, 1180, '225x75 THICK TIMBER\nPLANK (TYP.)'); L(v, (a2 ? 1588 : 715) + 50, mid(1) + 5, a2 ? 1753 : 885, 1543, 'REPAIR LOCATION\n(TYP.)'); L(v, cx + 57, mid(n - 1), a2 ? 1542 : 672, 1723, 'M12×75 LONG\nCOACH SCREW\n(TYP.)');
      UL(B, a2 ? 1412 : 542, 1826, 'ELEVATION'); VT(B, a2 ? 1332 : 460, 1903, a2 ? 'TYPE 2A' : 'TYPE 2', 10, a2 ? 'STEEL PILE CONNECTION' : 'STEEL PILE CONNECTION WITH EXISTING TIMBER PACKER');
    });
    // TYPE 3
    {
      const xa = 2485, x1 = 2731;
      v.pl([[2058, -1660], [2058, -1215], [xa, -1215], [xa, -1660]], false, 'S-EXIST'); zz(v, 2165, -1215, 2166, -1215); [2254, 2346].forEach(x => v.line(x, -1115, x, -1215, 'S-EXIST')); zz(v, 2240, -1115, 2360, -1115);
      [-1254, yb - 50].forEach(y => v.line(xa, y, x1, y, 'S-EXIST'));
      v.rect(xa, yb, 46, ys[0] - yb, 'S-NEW'); ys.forEach(y => v.line(xa + 46, y, x1, y, 'S-NEW')); v.line(x1, ys[0], x1, yb, 'S-NEW');
      for (let i = 0; i < n; i++) { const y = mid(i); v.line(2446, y, xa + 6, y, 'S-BOLT'); v.rect(xa - 14, y - 5, 14, 10, 'S-BOLT'); v.pl([[2456, y + 4], [2446, y], [2456, y - 4]], false, 'S-BOLT'); v.circ(xa + 27, y, 4, 'S-BOLT'); v.line(xa + 46, y, x1, y, 'S-HIDDEN'); }
      dh(v, 2408, xa, -1215, -1150, '55'); dh(v, xa, xa + 46, -1215, -1130, '90'); dv(v, mid(0), ys[0], xa + 84, xa + 84, '='); dv(v, ys[1], mid(0), xa + 84, xa + 84, '='); v.cl(2297, -1043, 2297, -1680);
      const el = []; for (let i = 0; i < min(2, n); i++) { repLoc(v, 2646, mid(i) - 10, 60, 22); el.push([2680, mid(i) - 15]); }
      L(v, xa + 27, mid(0), 2707, 1108, 'M12×75 LONG COACH SCREW\nFIXED CENTRALLY IN\nPROPOSED TIMBER SHEET\n(1 - PER SHEET FOR FULL\nHEIGHT OF REPAIR)'); LL(v, el, 2738, 1451, 'REPAIR LOCATION\n(TYP.)'); L(v, xa + 46, mid(n - 1) + 10, 2738, 1589, '150x90x8 UA (GALV.)\nLENGTH TO SUIT');
      L(v, 2450, mid(n - 1), 2638, 1731, 'M12 x 75 LONG BLUE-TIP\nSCREW BOLT (PART N° BTG875)\nBY POWERS FASTENERS\nOR SIMILAR APPROVED.\nINSTALLED AT 225 CRS. TO SUIT\nPROPOSED SHEETING CRS.\n(TYP.)');
      UL(B, 2269, 1826, 'ELEVATION'); VT(B, 2243, 1903, 'TYPE 3', 10, 'CONCRETE CONNECTION');
    }
    MT(B, 1270, 2162, 'ABUTMENT/WING WALL TIMBER SHEETING REPAIR DETAILS', 20, null, 'hatch');
    NB(B, 2377, 2377, [GN1, "LOCATIONS AND EXTENT OF REPAIRS SHALL BE CONFIRMED ON SITE\nBY THE CONTRACTOR TO THE APPROVAL OF THE SUPERINTENDENT'S\nREPRESENTATIVE AND AS SHOWN ON THE PROJECT DRAWINGS."], TH, 17);
    return B.E;
  }, 'Abutment / wing wall timber sheeting replacement where the piles are steel (Type 2 with existing timber packer, Type 2A bolted UA) or have a concrete pile repair (Type 3, blue-tip screw bolts).');
})(typeof window !== 'undefined' ? window : globalThis);
