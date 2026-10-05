/* StructCap Timber — repair details: PN30-4101 … 4109 (traffic barrier).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ local helpers
  const R = (n) => Math.round(n);
  // clip a convex polygon to the rectangle x0..x1, y0..y1 (Sutherland–Hodgman)
  function clipRect(P0, x0, y0, x1, y1) {
    let out = P0;
    const edges = [[p => p[0] >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; }],
      [p => p[0] <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + t * (b[1] - a[1])]; }],
      [p => p[1] >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y0]; }],
      [p => p[1] <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y1]; }]];
    edges.forEach(([ins, cut]) => { const inp = out; out = []; for (let i = 0; i < inp.length; i++) { const a = inp[i], b = inp[(i + 1) % inp.length]; if (ins(b)) { if (!ins(a)) out.push(cut(a, b)); out.push(b); } else if (ins(a)) out.push(cut(a, b)); } });
    return out;
  }
  // MRWA ground hatch ("tufts") under a polyline: groups of short 45° strokes on side s (+1 left of the direction of travel, -1 right)
  function tufts(v, pts, s, sp, len) {
    sp = sp || 7 * v.s; len = len || 2 * v.s; s = s || -1;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy * s, ny = ux * s;
      let g = 0;
      for (let d = sp * 0.15; d + len * 1.6 < L; d += sp * 0.5, g++) { const dir = g % 2 ? 1 : -1; for (let k = 0; k < 3; k++) {
        const x = a[0] + ux * (d + k * len * 0.42), y = a[1] + uy * (d + k * len * 0.42);
        v.line(x, y, x + (nx + ux * dir) * len * 0.7, y + (ny + uy * dir) * len * 0.7, 'S-GROUND');
      } }
    }
  }
  // embankment slope symbols (tapered spikes) along a polyline, pointing to side s; alternate long / short
  function spikes(v, pts, s, sp, Lg, Ls, w) {
    let n = 0, next = sp / 2, acc = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy * s, ny = ux * s;
      while (next <= acc + L) { const d = next - acc, x = a[0] + ux * d, y = a[1] + uy * d, l = n++ % 2 ? Ls : Lg; v.fill([[x - ux * w / 2, y - uy * w / 2], [x + ux * w / 2, y + uy * w / 2], [x + nx * l, y + ny * l]], 'S-GROUND'); next += sp; }
      acc += L;
    }
  }
  // corrugated beam profile seen in section: valley (back) line at x = xv, ridges towards dir (-1 = -x), top at yt.
  // thrie: 3 ridges / 2 valleys over 508; W: 2 ridges / 1 valley over 310
  function beamProfile(v, xv, yt, dir, thrie, L) {
    const d = 85, H = thrie ? 506 : 310, per = thrie ? 185 : 154, r0 = thrie ? 67 : 78, rid = thrie ? [67, 252, 437] : [78, 232], val = thrie ? [165, 350] : [155], pts = [[xv, yt]];
    for (let s = 0; s <= H + 0.1; s += 6) pts.push([xv + dir * d * (0.5 + 0.5 * Math.cos(2 * PI * (s - r0) / per)), yt - s]);
    pts.push([xv, yt - H]);
    v.pl(pts, false, L || 'S-NEW');
    return { ridges: rid.map(r => yt - r), valleys: val.map(q => yt - q), xr: xv + dir * d };
  }
  // dashed "INSERT APPROPRIATE DETAIL" placeholder (as on the layout sheet): dashed box, dashed diagonal and the stamp text
  function stamp(B, x, y, w, h, ref, title, sub, fr) {
    fr = fr || 0.5;
    B.E.push({ t: 'pl', p: [[x, y], [x + w, y], [x + w, y - h], [x, y - h]], closed: true, L: 'S-NOTE' });
    B.E.push({ t: 'line', a: [x + 2, y - h + 2], b: [x + w - 2, y - 2], L: 'S-NOTE' });
    const ang = Math.atan2(h - 4, w - 4) * 180 / PI, cx = x + 2 + (w - 4) * fr, cy = y - h + 2 + (h - 4) * fr, a = ang * PI / 180, o = 1.6;
    B.E.push({ t: 'text', p: [cx - Math.sin(a) * o, cy + Math.cos(a) * o], s: 'INSERT APPROPRIATE DETAIL', h: 2.4, al: 'c', v: 'b', ang, L: 'S-TEXT' });
    B.E.push({ t: 'text', p: [cx + Math.sin(a) * o, cy - Math.cos(a) * o], s: 'REFER ' + ref, h: 2.4, al: 'c', v: 't', ang, L: 'S-TEXT' });
    if (title) { B.E.push({ t: 'text', p: [x + 4, y - h + 9], s: title, h: 2.8, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); B.E.push({ t: 'line', a: [x + 4, y - h + 8], b: [x + 4 + title.length * 2.8 * 0.7, y - h + 8], L: 'S-TITLE' }); if (sub) B.E.push({ t: 'text', p: [x + 4, y - h + 4], s: sub, h: 2.0, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
  }
  // text block with an underlined heading
  function headed(B, x, y, head, lines, h) { h = h || TH; B.E.push({ t: 'text', p: [x, y], s: head, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); B.E.push({ t: 'line', a: [x, y - 0.8], b: [x + head.length * h * 0.7, y - 0.8], L: 'S-TEXT' }); lines.forEach((l, i) => B.E.push({ t: 'text', p: [x, y - 0.6 - (i + 1) * h * 1.55], s: l, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' })); return y - (lines.length + 1) * h * 1.55; }
  const txt = (B, x, y, s, h, al, L, ang) => B.E.push({ t: 'text', p: [x, y], s, h: h || TH, al: al || 'l', v: 'b', ang: ang || 0, L: L || 'S-TEXT' });
  const callout = (v, x, y, ch) => { const p = v.P(x, y); v.add({ t: 'circle', c: p, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); };
  const ln = (B, x1, y1, x2, y2, L) => B.E.push({ t: 'line', a: [x1, y1], b: [x2, y2], L: L || 'S-TEXT' });

  // ================================================================== PN30-4101 TYPICAL BRIDGE TRAFFIC BARRIER LAYOUT
  def('pn4101', 'Barrier', 'Bridge traffic barrier – typical layout (plan & elevation)', 'PN30-4101', [], () => {
    const LY = new Lay(700), SC = 125, K = 29.64, v = LY.view(SC), B = v.B;
    // the plan and elevation are traced from the sheet: Q maps sheet pixels (220 dpi) to model mm (origin ℄ abutment 1, ℄ road)
    const Q = (x, y) => [(x - 1360) * K, (670 - y) * K], q = pts => pts.map(p => Q(...p));
    const L = (pts, Ly) => v.pl(q(pts), false, Ly || 'S-NEW'), T = (x, y, s, al, h, ang) => v.text(...Q(x, y), s, h || 2.2, al || 'l', 'b', 'S-TEXT', ang || 0);
    const offs = (pts, d) => pts.map((p, i) => { const a = pts[max(0, i - 1)], b = pts[min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / l * d, p[1] + (b[0] - a[0]) / l * d]; });
    const curveR = (x0, x1, y0, sgn, st) => { const P0 = []; for (let x = x0; x <= x1 + 0.1; x += st || 15) P0.push([x, y0 + sgn * Math.pow(max(0, x - 2230), 2) / 3374]); return P0; };
    const arcP = (cx, cy, r, a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; });
    const ldr = (pts, s, al) => { const P0 = q(pts); v.pl(P0, false, 'S-TEXT'); const a = P0[P0.length - 1], b = P0[P0.length - 2]; const pa = v.P(...a), pb = v.P(...b); v.add({ t: 'solid', p: [pa, [pa[0] - 2.2 * Math.cos(Math.atan2(pa[1] - pb[1], pa[0] - pb[0])) - 0.7 * Math.sin(Math.atan2(pa[1] - pb[1], pa[0] - pb[0])), pa[1] - 2.2 * Math.sin(Math.atan2(pa[1] - pb[1], pa[0] - pb[0])) + 0.7 * Math.cos(Math.atan2(pa[1] - pb[1], pa[0] - pb[0]))], [pa[0] - 2.2 * Math.cos(Math.atan2(pa[1] - pb[1], pa[0] - pb[0])) + 0.7 * Math.sin(Math.atan2(pa[1] - pb[1], pa[0] - pb[0])), pa[1] - 2.2 * Math.sin(Math.atan2(pa[1] - pb[1], pa[0] - pb[0])) - 0.7 * Math.cos(Math.atan2(pa[1] - pb[1], pa[0] - pb[0]))]], L: 'S-TEXT' }); };
    // ---------------- PLAN ----------------
    // hazard free zones (hatched, dash-dot boundary)
    const batTL = [[570, 482], [650, 488], [1048, 515], [1345, 524]], batBL = [[570, 855], [1048, 830], [1345, 818]], batBR = [[1765, 815]].concat(curveR(2230, 2615, 815, 1, 35));
    const yAt = (pts, x) => { for (let i = 0; i + 1 < pts.length; i++) if (x >= pts[i][0] && x <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts[pts.length - 1][1]; };
    const hz = (poly) => v.hatch(q(poly), 'ansi31', 'S-HATCH', 4.6);
    hz([[570, 335], [845, 335], [845, yAt(batTL, 845)], [650, 488], [570, 482]]); hz([[845, 335], [1070, 335], [1070, 368], [845, 368]]); hz([[845, 447], [1070, 447], [1070, yAt(batTL, 1070)], [1048, 515], [845, yAt(batTL, 845)]]);
    hz([[1070, 335], [1345, 335], [1345, 524], [1070, yAt(batTL, 1070)]]);
    hz([[570, 1005], [1345, 1005], [1345, 818], [1048, 830], [570, 855]]);
    hz([[1765, 1005], [2615, 1005], [2615, yAt(batBR, 2615)]].concat(batBR.slice().reverse()));
    L([[570, 335], [1345, 335], [1345, 1005], [570, 1005], [570, 335]], 'S-EXIST'); L([[1765, 815], [1765, 1005], [2615, 1005], [2615, 862]], 'S-EXIST');
    v.pl(q([[845, 368], [1070, 368], [1070, 447], [845, 447]]), true, 'S-TEXT'); T(855, 390, 'HAZARD FREE ZONE, REMOVE'); T(855, 413, 'ALL TREES GREATER THAN'); T(855, 436, '100 DIA (TYP)');
    // road: centre line, seal edges, side road
    L([[120, 670], [1730, 670]], 'S-CL'); L([[1820, 670]].concat(curveR(2230, 2700, 670, 1, 30)), 'S-CL'); T(1740, 676, '℄ BRIDGE'); T(2690, 762, '℄ ROAD');
    L([[420, 565], [1340, 565]], 'S-GROUND'); L([[420, 775], [1340, 775]], 'S-GROUND');
    L([[1765, 577], [2270, 577]].concat(arcP(2270, 360, 217, -90, 0, 10).slice(1), [[2462, 60]]), 'S-GROUND');
    L([[1765, 768]].concat(curveR(2230, 2720, 768, 1, 30)), 'S-GROUND');
    L([[2560, 60], [2600, 350], [2625, 470], [2660, 560], [2720, 630]], 'S-GROUND');
    // batters with slope symbols
    L([[430, 488]].concat(batTL), 'S-GROUND'); spikes(v, q([[430, 488]].concat(batTL)), 1, 50 * K, 70 * K, 32 * K, 6 * K);
    L(batBL.concat([]), 'S-GROUND'); L([[430, 852], [570, 855]], 'S-GROUND'); spikes(v, q([[430, 852]].concat(batBL)), -1, 50 * K, 70 * K, 32 * K, 6 * K);
    const batTR = [[1765, 527], [2270, 527]].concat(arcP(2270, 360, 167, -90, 0, 12).slice(1), [[2410, 110]]);
    L(batTR, 'S-GROUND'); spikes(v, q(batTR), 1, 50 * K, 70 * K, 32 * K, 6 * K);
    L(batBR, 'S-GROUND'); spikes(v, q(batBR), -1, 50 * K, 70 * K, 32 * K, 6 * K);
    L([[430, 488], [480, 540], [555, 545]], 'S-GROUND'); L([[535, 532], [535, 548]], 'S-NEW');
    // the barriers (rail as a double line), broken at the bridge break
    const railL = [[555, 505], [1075, 533], [1540, 535]], railL2 = [[1575, 535], [2270, 535]].concat(arcP(2270, 360, 175, -90, 0, 12).slice(1), [[2402, 140]]);
    const railR = [[555, 835], [1075, 807], [1540, 805]], railR2 = [[1575, 805]].concat(curveR(2230, 2612, 805, 1, 30));
    [railL, railL2, railR, railR2].forEach((pts, i) => { const Pm = q(pts); v.pl(Pm, false, 'S-NEW'); v.pl(offs(Pm, (i < 2 ? 1 : -1) * 100), false, 'S-NEW'); });
    [[555, 505], [555, 835]].forEach(([x, y]) => { v.rect(...Q(x - 5, y + 6), 22 * K, 12 * K, 'S-NEW'); L([[x - 5, y - 6], [x + 17, y + 6]], 'S-NEW'); });
    v.circ(...Q(2402, 132), 8 * K, 'S-NEW'); v.circ(...Q(2620, 850), 8 * K, 'S-NEW');
    [[1370, 535], [1735, 535], [1370, 805], [1735, 805]].forEach(([x, y]) => v.circ(...Q(x, y), 15 * K, 'S-TEXT'));
    // posts and their types
    const post = (x, y, lbl, ly, al) => { v.rect(...Q(x - 3, y + 4), 6 * K, 8 * K, 'S-NEW'); v.fill(q([[x - 3, y - 4], [x + 3, y - 4], [x + 3, y + 4], [x - 3, y + 4]])); if (lbl) T(x, ly, lbl, al || 'c', 2.0); };
    const left = [[700], [765], [832], [898], [965], [1030], [1095, 'PT5'], [1145, 'PT7'], [1185, 'PT5'], [1250, 'PT3'], [1283, 'PT5'], [1318, 'PT3'], [1394, 'PT1'], [1461, 'PT1'], [1529, 'PT1'], [1588, 'PT1'], [1649, 'PT1'], [1716, 'PT1'], [1785, 'PT1'], [1820, 'PT6'], [1855, 'PT3'], [1905, 'PT5'], [1945, 'PT7'], [2018, 'PT5'], [2085, 'PT5'], [2152, 'PT5'], [2219, 'PT5'], [2286, 'PT5']];
    left.forEach(([x, l]) => { post(x, yAt(railL.concat(railL2.slice(0, 2)), x), l, 563); post(x, yAt(railR.concat([[1575, 805], [2230, 805]]), x), l, 796); });
    [[2330, 533], [2372, 517], [2408, 488], [2432, 445]].forEach(([x, y]) => post(x, y));
    [[2438, 330, 'PT8'], [2428, 250, 'PT8'], [2414, 170, 'PT8']].forEach(([x, y, l]) => { post(x, y); T(x - 12, y + 6, l, 'r', 2.0); });
    [[2353, 'PT5'], [2420, 'PT5'], [2480, 'PT8'], [2548, 'PT8'], [2604, 'PT8']].forEach(([x, l]) => { const y = 805 + Math.pow(x - 2230, 2) / 3374; post(x, y, l, y - 9); });
    // toprail extents (outside) and beam types (inside)
    const ticks = (xs, y0, y1) => xs.forEach(x => L([[x, y0], [x, y1]], 'S-TEXT'));
    L([[1165, 452], [1540, 452]], 'S-TEXT'); L([[1575, 452], [1870, 452]], 'S-TEXT'); ticks([1170, 1215, 1245, 1360, 1750, 1810, 1870], 445, 530);
    [[1192, 'TR2'], [1230, 'TR3'], [1302, 'TR5'], [1450, '1-TR4'], [1670, '2-TR5'], [1788, 'TR3'], [1840, 'TR7']].forEach(([x, s]) => T(x, 446, s, 'c', 2.0));
    L([[1165, 888], [1540, 888]], 'S-TEXT'); L([[1575, 888], [1870, 888]], 'S-TEXT'); ticks([1170, 1215, 1245, 1360, 1750, 1810, 1870], 812, 895);
    [[1192, 'TR1'], [1230, 'TR3'], [1302, 'TR5'], [1450, '1-TR4'], [1670, '2-TR5'], [1788, 'TR3'], [1840, 'TR8']].forEach(([x, s]) => T(x, 882, s, 'c', 2.0));
    ticks([1213, 1250, 1300, 1345, 1765, 1810, 1865, 2000], 540, 625); ticks([1213, 1250, 1300, 1345, 1765, 1810, 1865, 2000, 2210], 715, 800); ticks([2300], 540, 625);
    [[1150, 'WB4'], [1270, 'TB1'], [1322, 'TB2'], [1440, 'TB3'], [1670, 'TB3'], [1787, 'TB2'], [1838, 'TB1'], [1932, 'WB5'], [2350, '4-WB3']].forEach(([x, s]) => T(x, 610, s, 'c', 2.0));
    [[1150, 'WB4'], [1270, 'TB1'], [1322, 'TB2'], [1440, 'TB3'], [1670, 'TB3'], [1787, 'TB2'], [1838, 'TB1'], [1932, 'WB5'], [2120, '3-WB3']].forEach(([x, s]) => T(x, 738, s, 'c', 2.0));
    v.dim(...Q(1213, 588), ...Q(1250, 588), 0.01, '500'); v.dim(...Q(1213, 752), ...Q(1250, 752), 0.01, '500'); v.dim(...Q(2210, 697), ...Q(2240, 697), 0.01, '500');
    v.dim(...Q(1360, 440), ...Q(1371, 440), 0.01, '325'); v.dim(...Q(1739, 440), ...Q(1750, 440), 0.01, '325'); v.dim(...Q(1360, 962), ...Q(1371, 962), 0.01, '325');
    v.dim(...Q(1470, 1005), ...Q(1470, 805), 0.01, ' '); v.text(...Q(1462, 978), '6000', 2.0, 'c', 'b', 'S-DIM', 90); v.text(...Q(1484, 978), '(TYP)', 2.0, 'c', 'b', 'S-DIM', 90);
    v.dim(...Q(520, 885), ...Q(555, 885), 0.01, '1000'); L([[520, 815], [520, 895]], 'S-DIM'); L([[555, 845], [555, 895]], 'S-DIM');
    T(470, 527, '1', 'c', 2.0); L([[485, 522], [555, 522]], 'S-TEXT'); T(520, 541, '20', 'c', 2.0);
    T(470, 806, '1', 'c', 2.0); L([[485, 801], [555, 801]], 'S-TEXT'); T(520, 796, '20', 'c', 2.0);
    v.dim(...Q(472, 385), ...Q(565, 385), 0.01, ' '); L([[472, 385], [472, 470]], 'S-DIM'); L([[565, 385], [565, 478]], 'S-DIM'); T(518, 378, '4:1 SLOPE', 'c', 2.0); T(518, 404, '(TYP)', 'c', 2.0);
    // labels
    T(1520, 522, 'LHS', 'c', 3.2); T(1520, 838, 'RHS', 'c', 3.2);
    T(1550, 598, 'THRIEBEAM EXPANSION JOINT', 'c', 2.0); ldr([[1440, 594], [1390, 594], [1374, 552]]); ldr([[1660, 594], [1712, 594], [1730, 552]]);
    T(1550, 752, 'THRIEBEAM EXPANSION JOINT', 'c', 2.0); ldr([[1440, 748], [1390, 748], [1374, 788]]); ldr([[1660, 748], [1712, 748], [1730, 788]]);
    T(1080, 664, "CURVE IN 'W' BEAM", 'c', 2.0); ldr([[1150, 662], [1211, 540]]); ldr([[1150, 680], [1211, 800]]);
    L([[555, 512], [555, 598], [1060, 622]], 'S-TEXT'); T(850, 598, 'EXTRUDER TYPE END TERMINAL', 'c', 2.0); T(850, 622, 'REFER TO NOTE 2', 'c', 2.0);
    L([[555, 842], [555, 948], [1060, 928]], 'S-TEXT'); T(800, 926, 'EXTRUDER TYPE END TERMINAL', 'c', 2.0); T(800, 950, 'REFER TO NOTE 2', 'c', 2.0);
    T(530, 700, 'TO PERTH', 'c', 2.4); v.fill(q([[470, 712], [590, 708], [590, 718]]), 'S-TEXT');
    T(2370, 690, 'TO GERALDTON', 'c', 2.4); T(2370, 708, '(+ve CHAINAGE)', 'c', 2.0); v.fill(q([[2440, 722], [2305, 716], [2305, 727]]), 'S-TEXT');
    ldr([[690, 690], [660, 690], [622, 772]]); T(695, 694, 'EDGE OF ROAD SEAL'); T(695, 716, '(TYP)');
    T(500, 222, 'TRANSITION FORMATION BACK'); T(500, 245, 'TO EXISTING ROAD FORMATION'); T(500, 268, 'AT 15:1 (TYP)'); ldr([[495, 218], [485, 218], [478, 470]]);
    T(440, 140, 'WIDTH MARKER TO LINE'); T(440, 163, 'WITH ROAD SIDE FACE OF'); T(440, 186, 'BRIDGE KERB (TYP)'); ldr([[435, 136], [425, 136], [452, 470], [530, 532]]);
    T(1125, 908, 'POST @', 'c', 2.0); T(1125, 930, '2000 CRS', 'c', 2.0); T(1228, 908, 'POSTS @', 'c', 2.0); T(1228, 930, '1000 CRS', 'c', 2.0); T(1520, 908, 'POSTS @ 2000 CRS', 'c', 2.0);
    T(1885, 908, 'POSTS @', 'c', 2.0); T(1885, 930, '1000 CRS', 'c', 2.0); T(2100, 908, 'POSTS @ 2000 CRS', 'c', 2.0);
    v.text(...Q(2250, 745), "CURVED 'W' BEAM  RAD. 50000", 2.0, 'l', 'b', 'S-TEXT', -4);
    v.text(...Q(2395, 545), "CURVE 'W' BEAM's TO", 2.0, 'l', 'b', 'S-TEXT', 52); v.text(...Q(2425, 560), 'MATCH ROAD EDGE', 2.0, 'l', 'b', 'S-TEXT', 52);
    [[2318, 812, 2318, 832, '500'], [2350, 816, 2350, 846, '900']].forEach(([a, b, c2, d, s]) => v.dim(...Q(a, d), ...Q(c2, b), 0.01, s, { sub: '(TYP)' }));
    v.dim(...Q(2420, 868), ...Q(2480, 882), 9, '2500'); v.dim(...Q(2480, 882), ...Q(2548, 893), 9, '2600');
    v.dim(...Q(2575, 775), ...Q(2600, 781), 6, '1000'); v.dim(...Q(2605, 795), ...Q(2620, 850), -8, '625'); v.dim(...Q(2670, 470), ...Q(2700, 520), -6, '550');
    v.dim(...Q(2402, 130), ...Q(2440, 132), 8, '1130'); v.dim(...Q(2450, 280), ...Q(2480, 282), 6, '790');
    v.text(...Q(2455, 92), 'WB1', 2.0, 'l', 'b', 'S-TEXT', -80); v.text(...Q(2480, 215), 'WB2', 2.0, 'l', 'b', 'S-TEXT', -80); T(2505, 725, 'WB2', 'c', 2.0); T(2600, 745, 'WB1', 'c', 2.0);
    // north point, view marker
    v.fill(q([[420, 880], [428, 1070], [412, 1070]]), 'S-TEXT'); T(445, 1060, 'N', 'l', 3.6);
    v.mark(...Q(1560, 985), 'A', -90);
    // designer's placeholder frame for the plan & elevation
    const F0 = Q(100, 30), F1 = Q(2760, 1490);
    v.pl([F0, [F1[0], F0[1]], F1, [F0[0], F1[1]]], true, 'S-NOTE'); v.line(F0[0], F1[1], F1[0], F0[1], 'S-NOTE');
    const ang = Math.atan2(F0[1] - F1[1], F1[0] - F0[0]) * 180 / PI, mid = Q(1300, 0); v.text(mid[0], F1[1] + (mid[0] - F0[0]) * (F0[1] - F1[1]) / (F1[0] - F0[0]) + 2.5 * SC, 'DRAW PLAN & ELEVATION OF BRIDGE TRAFFIC BARRIER', 3.0, 'c', 'b', 'S-TEXT', ang);
    { const a = v.P(...Q(1580, 70)), b = v.P(...Q(2245, 240)); stamp(B, a[0], a[1], b[0] - a[0], a[1] - b[1], 'PN30-4108', 'GUARDRAIL BEAM LAPPING DETAIL', 'N.T.S', 0.62); }
    { const a = v.P(...Q(1560, 1070)); B.title(a[0], a[1], 'PLAN', SC); }
    // ---------------- ELEVATION A ----------------
    L([[380, 1295], [1305, 1295]], 'S-GROUND'); L([[1770, 1295], [2700, 1295]], 'S-GROUND');
    [[1100, 1170], [1880, 1960], [2385, 2440], [2590, 2660]].forEach(([a, b]) => tufts(v, q([[a, 1295], [b, 1295]]), -1, 9 * K, 5 * K));
    L([[1305, 1300], [1540, 1300]], 'S-EXIST'); L([[1575, 1300], [1770, 1300]], 'S-EXIST'); L([[1305, 1312], [1540, 1312]], 'S-EXIST'); L([[1575, 1312], [1770, 1312]], 'S-EXIST');
    [[1310, 1325], [1755, 1768]].forEach(([a, b]) => { L([[a, 1312], [a, 1385]], 'S-EXIST'); L([[b, 1312], [b, 1385]], 'S-EXIST'); v.arc(...Q((a + b) / 2, 1385), (b - a) / 2 * K, 180, 360, 'S-EXIST'); });
    // W-beam, transitions, Thriebeam and toprail
    L([[575, 1270], [1180, 1270], [1230, 1262], [1540, 1262]]); L([[575, 1285], [1180, 1285], [1230, 1290], [1540, 1290]]);
    L([[1575, 1262], [1835, 1262], [1890, 1270], [2600, 1270]]); L([[1575, 1290], [1835, 1290], [1890, 1285], [2600, 1285]]);
    L([[1175, 1282], [1230, 1250], [1540, 1250]]); L([[1575, 1250], [1835, 1250], [1895, 1282]]);
    L([[1540, 1245], [1540, 1300]], 'S-TEXT'); L([[1575, 1245], [1575, 1300]], 'S-TEXT');
    v.rect(...Q(575, 1287), 25 * K, 19 * K, 'S-NEW'); L([[575, 1287], [600, 1268]]); L([[2600, 1278], [2640, 1293]], 'S-BOLT');
    L([[530, 1250], [530, 1295]]); L([[518, 1295], [542, 1295]]); L([[2662, 1250], [2662, 1295]]); L([[2650, 1295], [2674, 1295]]);
    const epost = (x, yb) => { v.rect(...Q(x - 2.5, yb), 5 * K, (yb - 1262) * K, 'S-NEW'); };
    [590, 625].concat(left.map(p => p[0])).forEach(x => { if (x > 1300 && x < 1770) epost(x, 1312); else epost(x, 1345); });
    [2353, 2420, 2480, 2548].forEach(x => epost(x, 1345)); epost(2604, 1352); L([[2590, 1352], [2620, 1352]]);
    v.circ(...Q(1370, 1272), 14 * K, 'S-TEXT'); v.circ(...Q(1735, 1272), 14 * K, 'S-TEXT');
    // post types
    const ep = [[1095, 1310, 'PT5'], [1145, 1335, 'PT7'], [1185, 1335, 'PT5'], [1250, 1345, 'PT3'], [1283, 1328, 'PT5'], [1318, 1312, 'PT3'], [1394, 1312, 'PT1'], [1461, 1312, 'PT1'], [1529, 1312, 'PT1'], [1588, 1312, 'PT1'], [1649, 1312, 'PT1'], [1716, 1312, 'PT1'], [1785, 1312, 'PT3'], [1820, 1312, 'PT5'], [1855, 1345, 'PT3'], [1880, 1330, 'PT5'], [1945, 1310, 'PT7'], [2018, 1310, 'PT5'], [2085, 1310, 'PT5'], [2152, 1310, 'PT5'], [2219, 1310, 'PT5'], [2286, 1310, 'PT5'], [2353, 1310, 'PT5'], [2420, 1310, 'PT8'], [2480, 1310, 'PT8'], [2604, 1310, 'PT8']];
    ep.forEach(([x, y, s]) => T(x + 4, y, s, 'l', 2.0));
    [[1150, 1240, 'TR1', 22], [1215, 1245, 'TR3'], [1290, 1245, 'TR5'], [1495, 1245, 'TR4'], [1600, 1245, 'TR4'], [1800, 1245, 'TR3'], [1872, 1238, 'TR8', -18]].forEach(([x, y, s, a]) => v.text(...Q(x, y), s, 2.0, 'c', 'b', 'S-TEXT', a || 0));
    v.dim(...Q(1394, 1335), ...Q(1461, 1335), 0.01, '2000', { sub: '(TYP)' });
    L([[550, 1190], [1180, 1190]], 'S-TEXT'); L([[550, 1180], [550, 1270]], 'S-TEXT'); L([[1180, 1180], [1180, 1268]], 'S-TEXT'); v.arrow(...Q(550, 1190), 180);
    T(865, 1184, 'FOR DETAILS OF GUARDRAIL COMPONENTS', 'c', 2.0); T(865, 1210, 'REFER TO MANUFACTURERS SPECIFICATIONS', 'c', 2.0);
    v.leader(...Q(860, 1272), 6, 10, "'W' BEAM"); v.leader(...Q(2050, 1272), 6, 10, "'W' BEAM");
    v.leader(...Q(515, 1250), -6, 8, 'WIDTH\nMARKER\n(TYP)');
    v.leader(...Q(1230, 1266), -4, 15, "'TRANSITION\nBEAM' TB1"); v.leader(...Q(1835, 1266), 6, 15, "'TRANSITION\nBEAM' TB1"); v.leader(...Q(1525, 1258), 6, 10, "'THRIEBEAM'");
    callout(v, ...Q(1395, 1205), '7'); T(1425, 1214, '0230-0006', 'l', 2.0); L([[1390, 1222], [1376, 1258]], 'S-TEXT');
    v.leader(...Q(1430, 1268), -26, -22, "'THRIEBEAM' STIFFENER PLATE, REFER\nTO DETAIL (9) ON DRG N° 0430-0773\n(TYP)");
    v.leader(...Q(2355, 1272), -10, 20, "'W' BEAM STIFFENER PLATE, REFER\nTO DETAIL (8) ON DRG N° 0430-0773\n(TYP)");
    v.leader(...Q(2152, 1320), -6, -14, 'FOR POST DETAILS REFER\nTO DRAWING N° 0430-0774\n(TYP)');
    { const a = v.P(...Q(1510, 1440)); B.title(a[0], a[1], 'ELEVATION A', SC); }
    LY.break();
    // ---------------- placeholders for the details from the other sheets, notes ----------------
    LY.block(B2 => {
      stamp(B2, 0, 0, 215, 62, 'PN30-4102', 'TABLE OF QUANTITIES');
      stamp(B2, 225, 0, 150, 62, 'PN30-4105', 'FORMATION WIDENING DETAILS', "THRIEBEAM & TRANSITION BEAM / 'W' BEAM  1:20");
      stamp(B2, 385, 0, 110, 62, 'PN30-4109', 'WIDTH MARKER DETAILS', 'WIDTH MARKER D4-3B(R) - SHOWN  1:20');
      stamp(B2, 505, 0, 118, 28, 'PN30-4103', 'THRIEBEAM EXPANSION JOINT KEY PLAN', 'N.T.S.', 0.72);
      stamp(B2, 505, -34, 118, 28, 'PN30-4104', 'POST CONNECTION DETAILS', 'VIEW B / SECTIONAL ELEVATION  1:10', 0.72);
      // notes (designer's dashed boxes)
      const nx = 0, ny = -70; B2.E.push({ t: 'pl', p: [[nx, ny], [nx + 300, ny], [nx + 300, ny - 22], [nx, ny - 22]], closed: true, L: 'S-NOTE' });
      const nb = new Builder(); nb.notes(nx + 3, ny - 5, ['FOR GENERAL NOTES REFER TO DRAWING N° XX30-XXXX.', "EXTRUDER TYPE END TERMINALS SHALL MEET WITH THE REQUIREMENTS OF NCHRP-350 TEST LEVEL 3. END TERMINAL TYPES TO BE SUBMITTED FOR SUPERINTENDENT'S APPROVAL."], 294); B2.E.push(...nb.E);
      B2.noteBox(315, ny, "THESE NOTES ARE PART OF PRACTICE NOTE\nPN30-4108.  IF TABLE OF QUANTITIES IS NOT\nON THE SAME DRAWING AS THESE NOTES\nTHEN THE NOTE '8 POST END TERMINALS ETC'\nNEEDS TO BE INCLUDED IN THESE NOTES.", 100);
      ln(B2, 300, ny - 12, 315, ny - 12, 'S-NOTE');
      const by = ny - 28; B2.E.push({ t: 'pl', p: [[0, by], [300, by], [300, by - 15], [0, by - 15]], closed: true, L: 'S-TITLE' });
      txt(B2, 3, by - 6, 'THIS DRAWING SHALL BE READ IN CONJUNCTION WITH DRG N° XX30-XXXX', 3.0, 'l', 'S-TITLE'); txt(B2, 3, by - 12, 'AND STANDARD DRAWING N°s 0430-0772 TO 0430-0777.', 3.0, 'l', 'S-TITLE');
      B2.noteBox(315, by - 4, 'REFER TO APPROPRIATE DRAWINGS FROM STANDARD DRAWING MANUAL\nIN THE RAILING AND BALUSTRADE SECTION', 140); ln(B2, 300, by - 8, 315, by - 8, 'S-NOTE');
      const ey = by - 25; txt(B2, 0, ey, "ENGINEER'S NOTE :", 3.4, 'l', 'S-TITLE'); ln(B2, 0, ey - 1.2, 3.4 * 0.7 * 17, ey - 1.2, 'S-TITLE');
      ["THIS PRACTICE NOTE IS AN EXAMPLE OF A 'LOW PERFORMANCE LEVEL BARRIER'.", 'BRIDGE TRAFFIC BARRIERS SHALL BE EXTENDED BEYOND THE BRIDGE ABUTMENTS TO DISTANCES AS', 'REQUIRED, SPECIFIC TO EACH SITE, TO ADEQUATELY PROTECT ERRANT VEHICLES FROM ALL BRIDGE', 'RELATED HAZARDS AND STEEP EMBANKMENTS. ALSO REFER TO STANDARD DRAWINGS 0330-1646,', '0530-0686 AND 0430-0768 TO 0430-0777.'].forEach((s, i) => txt(B2, 0, ey - 6 - i * 4.6, s, 2.8, 'l', 'S-TITLE'));
    });
    return LY.done();
  }, 'Example layout of a low performance level bridge traffic barrier (Thriebeam on the bridge, transitions, W-beam and extruder end terminals on the approaches) to adapt for each site.');

  // ================================================================== PN30-4102 TABLE OF QUANTITIES
  def('pn4102', 'Barrier', 'Traffic barrier – table of quantities', 'PN30-4102', [], () => {
    const LY = new Lay(700);
    LY.block(B => {
      const k = 0.24, X = [97, 175, 237, 342, 402, 520, 578, 698, 756, 851, 910, 1030, 1090].map(x => (x - 97) * k), Y = [133, 213, 253, 293, 333, 373, 413, 453, 493, 533, 573].map(y => -(y - 133) * k), h = 2.4;
      const cell = (c0, c1, r0, r1, s, hh) => { const L = String(s).split('\n'), cx = (X[c0] + X[c1]) / 2, cy = (Y[r0] + Y[r1]) / 2; L.forEach((l, i) => B.E.push({ t: 'text', p: [cx, cy + (L.length - 1) * (hh || h) * 0.75 - i * (hh || h) * 1.5], s: l, h: hh || h, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' })); };
      // outer frame and grid of the main table (rows 0..7), lower part (rows 7..10) over columns 0..6 only
      ln(B, X[0], Y[0], X[12], Y[0]); ln(B, X[0], Y[0], X[0], Y[10]); ln(B, X[12], Y[0], X[12], Y[7]); ln(B, X[0], Y[10], X[4], Y[10]); ln(B, X[4], Y[10], X[4] + (658 - 402) * k, Y[10]);
      for (let r = 1; r <= 7; r++) { const full = r === 1 || r === 7; [[0, 6], [8, 12]].forEach(([a, b]) => ln(B, X[a], Y[r], X[b], Y[r])); if (full || r % 2 === 1) ln(B, X[6], Y[r], X[8], Y[r]); }
      for (let r = 8; r <= 9; r++) { ln(B, X[0], Y[r], X[2], Y[r]); ln(B, X[2], Y[r], X[4], Y[r]); ln(B, X[4], Y[r], X[4] + (658 - 402) * k, Y[r]); }
      for (let c = 1; c <= 11; c++) ln(B, X[c], Y[0], X[c], c <= 4 ? Y[10] : Y[7]);
      const xs = X[4] + (578 - 402) * k, xe = X[4] + (658 - 402) * k; ln(B, xs, Y[7], xs, Y[10]); ln(B, xe, Y[7], xe, Y[10]);
      const H = ['POST\nTYPE', 'N°\nOFF', "'W' BEAM\nTYPE", 'N°\nOFF', 'THRIEBEAM\nTYPE', 'N°\nOFF', 'BLOCKOUT\nTYPE', 'N°\nOFF', 'TOPRAIL\nTYPE', 'N°\nOFF', 'TOPRAIL\nCONNECTOR\nTYPE', 'N°\nOFF'];
      H.forEach((s, c) => cell(c, c + 1, 0, 1, s));
      for (let r = 1; r <= 6; r++) { cell(0, 1, r, r + 1, 'PT' + r); cell(1, 2, r, r + 1, 'X'); cell(2, 3, r, r + 1, 'WB' + r); cell(3, 4, r, r + 1, 'X'); cell(4, 5, r, r + 1, 'TB' + r); cell(5, 6, r, r + 1, 'X'); cell(8, 9, r, r + 1, 'TR' + r); cell(9, 10, r, r + 1, 'X'); cell(10, 11, r, r + 1, 'TC' + r); cell(11, 12, r, r + 1, 'X'); }
      [["'W' BEAM", 1], ['THRIEBEAM', 3], ['TRANSITION\n(MID)', 5]].forEach(([s, r]) => { cell(6, 7, r, r + 2, s); cell(7, 8, r, r + 2, 'X'); });
      [7, 8, 9].forEach(r => { cell(0, 1, r, r + 1, 'PT' + r); cell(1, 2, r, r + 1, 'X'); });
      cell(2, 3, 7, 8, 'WB7'); cell(3, 4, 7, 8, 'X');
      const c2 = (s, r, a, b) => B.E.push({ t: 'text', p: [(a + b) / 2, (Y[r] + Y[r + 1]) / 2], s, h, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' });
      c2('STIFFENER PLATE', 7, X[4], xs); c2('N° OFF', 7, xs, xe); c2('THRIEBEAM', 8, X[4], xs); c2('X', 8, xs, xe); c2("'W' BEAM", 9, X[4], xs); c2('X', 9, xs, xe);
      ['NOTE :-  THESE QUANTITIES DO NOT', 'INCLUDE EXTRUDER TYPE END TERMINAL', 'COMPONENTS.  THE QUANTITIES ARE', 'BASED ON 8 POST END TERMINALS', 'BEING INSTALLED.'].forEach((s, i) => txt(B, (753 - 97) * k, -(490 - 133) * k - i * 3.6, s, 2.4));
    });
    LY.title('TABLE OF QUANTITIES');
    return LY.done();
  }, 'Quantity schedule for the barrier layout (posts, W-beams, Thriebeams, blockouts, toprails and connectors); fill in the numbers for the job.');

  // ================================================================== PN30-4103 THRIEBEAM EXPANSION JOINT LOCATIONS
  def('pn4103', 'Barrier', 'Traffic barrier – Thriebeam expansion joint locations', 'PN30-4103', [], () => {
    const LY = new Lay(700);
    LY.block(B => {
      const c = 8.5, r = 0.9, fl = 8;
      const diagram = (x0, yT, n, exp, lead) => { // yT = top rail line; spans as square cells
        const W = n * c, yB = yT - c, add = e => B.E.push(e);
        add({ t: 'line', a: [x0, yT], b: [x0 + W, yT], L: 'S-NEW' }); add({ t: 'line', a: [x0, yB], b: [x0 + W, yB], L: 'S-NEW' });
        const mid = n > 6 ? (n % 2 ? x0 + W / 2 : x0 + (n / 2) * c) : null;
        for (let i = 0; i <= n; i++) { const x = x0 + i * c; add({ t: 'line', a: [x, yT], b: [x, yB], L: 'S-NEW' }); }
        const J = [x0, x0 + W].concat(mid != null ? [mid] : []);
        J.forEach(x => [yT, yB].forEach(y => { add({ t: 'circle', c: [x, y], r, L: 'S-TEXT' }); }));
        [[x0, yT, -1, 1], [x0, yB, -1, -1], [x0 + W, yT, 1, 1], [x0 + W, yB, 1, -1]].forEach(([x, y, sx, sy]) => add({ t: 'line', a: [x + sx * r * 0.7, y + sy * r * 0.7], b: [x + sx * fl, y + sy * fl], L: 'S-NEW' }));
        txt(B, x0 + W + 9, yT - 2.5, 'EXPANSION AT JOINTS', 2.0); txt(B, x0 + W + 9, yT - 5.8, '= ' + exp + 'mm', 2.0);
        const tb = new Builder(); tb.title(x0 + W / 2, yB - (lead ? 15 : 9), n + ' SPANS', null, null, { h: 2.8 }); B.E.push(...tb.E);
        if (lead) { const y = yB - 4.2; txt(B, x0 + W / 2, y - 1, 'THRIEBEAM EXPANSION', 2.0, 'c'); txt(B, x0 + 6, y - 4.2, 'JOINTS', 2.0); add({ t: 'pl', p: [[x0 + 5.5, y], [x0 + 3, y], [x0 + r * 0.8, yB - r * 0.8]], closed: false, L: 'S-TEXT' }); add({ t: 'pl', p: [[x0 + W - 5.5, y], [x0 + W - 3, y], [x0 + W - r * 0.8, yB - r * 0.8]], closed: false, L: 'S-TEXT' }); }
      };
      // left column 4 … 8 spans, right column 9 … 12 spans (as the sheet)
      const L = [[4, '5.8'], [5, '7.2'], [6, '8.6'], [7, '5.0'], [8, '5.8']], Rr = [[9, '6.5'], [10, '7.2'], [11, '8.0'], [12, '8.6']];
      L.forEach(([n, e], i) => diagram(26, -22 - i * 33, n, e, n === 4));
      Rr.forEach(([n, e], i) => diagram(160, -6 - i * 33, n, e, false));
      B.noteBox(18, -2, 'NOTE: NO EXPANSION JOINTS REQUIRED FOR\nBRIDGES UP TO 3 SPANS (4.3mm PER JOINT).', 70, { solid: true });
      // the dashed engineer's note on the left (rotated, reading downwards as on the sheet)
      const nb = ['NOTE :- THESE REQUIREMENTS ARE FOR', "ENGINEER'S REFERENCE ONLY - ENGINEER", 'TO CHOOSE & HAVE DRAWN ON TRAFFIC', 'BARRIER LAYOUT DRAWING.'];
      B.E.push({ t: 'pl', p: [[-2, -40], [14, -40], [14, -134], [-2, -134]], closed: true, L: 'S-NOTE' });
      nb.forEach((s, i) => txt(B, 11.5 - i * 3.4, -43, s, 2.2, 'l', 'S-TEXT', -90));
      // rules for more than 12 spans
      const y0 = -142; txt(B, 150, y0, 'OVER 12 SPANS, THRIEBEAM EXPANSION JOINTS SHALL BE PLACED AT:-', 2.2);
      ['13 SPANS: ABUTMENT N° 1, PIER N° 4, PIER N° 8 & ABUTMENT N° 2 (IE 1/3 POINTS APPROX)', '14 SPANS: ABUTMENT N° 1, PIER N° 4, PIER N° 9 & ABUTMENT N° 2 (IE 1/3 POINTS APPROX)', '15 SPANS: ABUTMENT N° 1, PIER N° 5, PIER N° 10 & ABUTMENT N° 2 (IE 1/3 POINTS APPROX)'].forEach((s, i) => txt(B, 150, y0 - 6 - i * 3.6, s, 2.0));
      const bx = 150 + 86 * 2.0 * 0.62 + 2; B.E.push({ t: 'pl', p: [[bx, y0 - 4], [bx + 1.5, y0 - 4.6], [bx + 1.5, y0 - 8.6], [bx + 3, y0 - 9.6], [bx + 1.5, y0 - 10.6], [bx + 1.5, y0 - 14.6], [bx, y0 - 15.2]], closed: false, L: 'S-TEXT' });
      txt(B, bx + 5, y0 - 8.6, 'ETC UP TO 18 SPANS', 2.0); txt(B, bx + 5, y0 - 12.2, 'THEN 1/4 POINTS APPROX', 2.0);
      const nx = 196, ny = y0 - 22, w = 92; B.E.push({ t: 'pl', p: [[nx, ny], [nx + w, ny], [nx + w, ny - 13], [nx, ny - 13]], closed: true, L: 'S-TEXT' });
      headed(B, nx + 2, ny - 3.6, 'NOTE:', ['TOP RAIL EXPANSION JOINTS TO BE LOCATED SIMILARLY,', 'DESIGN ENGINEER TO DETERMINE SPECIFIC REQUIREMENTS.'], 2.0);
    });
    LY.caption('THRIEBEAM EXPANSION JOINT LOCATIONS', null, 'KEY PLANS - N.T.S.');
    return LY.done();
  }, 'Where to place Thriebeam (and top rail) expansion joints for bridges of 4 to 12 spans and beyond, with the expansion per joint.');

  // ================================================================== PN30-4107 RHS POST FOOTING
  def('pn4107', 'Barrier', 'RHS guardrail & balustrade post footing', 'PN30-4107', [], () => {
    const LY = new Lay(), v = LY.view(10);
    const D = 600, H = 900, top = -250, pw = 100;
    // ground and footing
    v.line(-650, 0, -60, 0, 'S-GROUND'); v.line(60, 0, 560, 0, 'S-GROUND'); tufts(v, [[-600, 0], [-80, 0]], -1, 90, 35); tufts(v, [[80, 0], [540, 0]], -1, 90, 35);
    const F = [[-D / 2, top], [D / 2, top], [D / 2, top - H], [-D / 2, top - H]]; v.pl(F, true, 'S-CONC');
    v.hatch([[-250, -290], [-110, -290], [-110, -470], [-250, -470]], 'conc', 'S-HATCH', 1.6); v.hatch([[110, -800], [270, -800], [270, -980], [110, -980]], 'conc', 'S-HATCH', 1.6);
    tufts(v, [[-D / 2, -290], [-D / 2, -560]], 1, 90, 35); tufts(v, [[D / 2, -560], [D / 2, -290]], 1, 90, 35); tufts(v, [[-150, top - H], [150, top - H]], -1, 90, 35);
    // RHS post: embedded 600 into the footing, broken off above ground
    const yb = top - 600, yt = 130; v.line(-pw / 2, yb, -pw / 2, yt, 'S-NEW'); v.line(pw / 2, yb, pw / 2, yt, 'S-NEW'); v.line(-pw / 2, yb, pw / 2, yb, 'S-NEW');
    v.line(-pw / 2 + 9, yb + 9, -pw / 2 + 9, yt - 20, 'S-HIDDEN'); v.line(pw / 2 - 9, yb + 9, pw / 2 - 9, yt - 20, 'S-HIDDEN');
    v.pl([[-pw / 2, yt], [0, yt - 25], [pw / 2, yt]], false, 'S-NEW'); v.pl([[-pw / 2 + 9, yt - 4], [0, yt - 27], [pw / 2 - 9, yt - 4]], false, 'S-NEW');
    v.line(0, top - H + 120, 0, 380, 'S-CL'); v.text(0, 395, '℄', 2.6, 'c'); v.text(25, 395, 'RHS BALUSTRADE POST OR', 2.2, 'l'); v.text(25, 395 - 34, '100x100x9.0 RHS GUARDRAIL', 2.2, 'l'); v.text(25, 395 - 68, 'POST', 2.2, 'l');
    v.wl(170, 0, 'NOMINAL FGL');
    // dimensions (left)
    v.line(-640, top, -D / 2 - 10, top, 'S-DIM'); v.line(-640, top - H, -D / 2 - 10, top - H, 'S-DIM'); v.line(-420, yb, -pw / 2 - 10, yb, 'S-DIM'); v.line(-640, 0, -620, 0, 'S-DIM');
    v.dim(-640, top, -640, 0, 0.01, '250'); v.text(-640 + 45, top / 2, '(NOM)', 2.0, 'c', 'b', 'S-DIM', 90);
    v.dim(-640, top - H, -640, top, 0.01, '900'); v.dim(-420, yb, -420, top, 0.01, '600'); v.text(-420 + 45, top - 300, 'NOMINAL', 2.0, 'c', 'b', 'S-DIM', 90);
    v.leader(D / 2, top - 600 + 15, 22, 0, 'φ600 MASS\nCONCRETE\nFOOTING');
    LY.title('RHS GUARDRAIL & BALUSTRADE POST FOOTING DETAIL', 10);
    LY.break(); LY.block(B => B.noteBox(0, 0, 'NOTE :- THIS DETAIL IS TO BE USED FOR RHS\nBALUSTRADE POSTS & FOR MAINTENANCE OF\nEXISTING RHS GUARDRAIL POSTS.', 92));
    return LY.done();
  }, 'Mass concrete footing for an RHS balustrade post, and for maintenance of existing RHS guardrail posts (100x100x9.0 RHS embedded 600).');

  // ================================================================== PN30-4108 GUARDRAIL BEAM LAPPING / END TERMINAL NOTES
  def('pn4108', 'Barrier', 'Guardrail beam lapping detail & end terminal notes', 'PN30-4108', [], () => {
    const LY = new Lay(700);
    LY.block(B => {
      const add = e => B.E.push(e), xL = 0, xA = 62, xB = 191, xR = 260, gap0 = 125, gap1 = 133;
      // dimension-style extent arrows top and bottom
      const ext = (y, sgn) => { [[xL, xA, 'END TERMINAL'], [xA, xB, 'BRIDGE RAIL'], [xB, xR, 'END TERMINAL']].forEach(([a, b, s]) => { add({ t: 'line', a: [a + 0.4, y], b: [b - 0.4, y], L: 'S-DIM' }); [[a, 0], [b, PI]].forEach(([x, ang]) => add({ t: 'solid', p: [[x, y], [x + 2.6 * Math.cos(ang) - 0.0, y + 0.7], [x + 2.6 * Math.cos(ang), y - 0.7]], L: 'S-DIM' })); txt(B, (a + b) / 2, y + 1.6 * sgn - (sgn < 0 ? 2.2 : 0), s, 2.2, 'c'); }); [xL, xA, xB, xR].forEach(x => add({ t: 'line', a: [x, y + 2 * sgn], b: [x, y - 10 * sgn], L: 'S-DIM' })); };
      ext(0, 1); ext(-56, -1);
      // shingled beam segments (each lapped in the direction of traffic): top barrier traffic → right, bottom barrier traffic ← left
      const seg = (x1, y1, x2, y2) => add({ t: 'line', a: [x1, y1], b: [x2, y2], L: 'S-NEW' });
      const row = (y, tilt) => { // segments rise steadily along the barrier; each one tilts so that it laps over the next in the traffic direction
        let i = 0; const sl = 16.5;
        [[xL, gap0 - 1], [gap1 + 1, xR]].forEach(([s0, s1]) => { for (let a = s0; a < s1 - 4; a += sl - 3, i++) { const b = min(a + sl, s1), yi = y + i * 0.55; if (b - a > 6) seg(a, yi + (tilt > 0 ? -0.5 : 0.9), b, yi + (tilt > 0 ? 0.9 : -0.5)); } });
      };
      row(-13, -1); row(-50, 1);
      // bridge break
      [gap0, gap1].forEach((x, k) => { add({ t: 'pl', p: [[x, -8], [x, -26], [x - 1.5 * (k ? 1 : -1), -27], [x + 1.5 * (k ? 1 : -1), -28.4], [x, -29.4], [x, -48]], closed: false, L: 'S-NEW' }); });
      add({ t: 'line', a: [gap0, -8], b: [gap0 - 8, -8], L: 'S-NEW' }); add({ t: 'line', a: [gap1, -8], b: [gap1 + 6, -8], L: 'S-NEW' }); add({ t: 'line', a: [gap0, -48], b: [gap0 - 8, -48], L: 'S-NEW' }); add({ t: 'line', a: [gap1, -48], b: [gap1 + 6, -48], L: 'S-NEW' });
      // traffic arrows
      txt(B, 6, -19, 'TRAFFIC', 2.2); add({ t: 'pl', p: [[6, -21.5], [40, -21.5], [21, -23.6], [21, -21.5]], closed: false, L: 'S-TEXT' });
      txt(B, 224, -33, 'TRAFFIC', 2.2); add({ t: 'pl', p: [[236, -35.5], [202, -35.5], [221, -37.6], [221, -35.5]], closed: false, L: 'S-TEXT' });
      const tb = new Builder(); tb.title(92, -70, 'GUARDRAIL BEAM LAPPING DETAIL', null, 'NTS', { h: 3.4 }); B.E.push(...tb.E);
      let y = headed(B, 275, -4, 'END TERMINAL', ["LAP 'W' BEAMS OVER LENGTH OF", 'EXTRUDER TYPE TERMINAL TO SUIT', "AN 'END IMPACT'.", 'POST AND COMPONENT ORIENTATION', 'MAY HAVE TO BE ADJUSTED TO', 'MEET SPECIFIC REQUIREMENTS OF THE', "TERMINAL'S MANUFACTURER."], 2.0);
      headed(B, 275, y - 4, 'BRIDGE RAIL', ["LAP 'W' BEAMS & 'THRIEBEAMS'", 'IN DIRECTION OF TRAFFIC.'], 2.0);
    });
    LY.break();
    LY.notes(['FOR GENERAL NOTES REFER TO DRAWING N° XX30-XXXX.', 'EXTRUDER TYPE END TERMINALS SHALL MEET WITH THE REQUIREMENTS OF NCHRP-350 TEST LEVEL 3. END TERMINAL TYPES TO BE SUBMITTED TO THE SUPERINTENDENT FOR APPROVAL. 8 POST END TERMINALS OF APPROX LENGTH 15.2 - 15.8m ARE SHOWN IF A LESSER LENGTH OF END TERMINAL IS SUBMITTED THEN DETAILS OF ADDITIONAL \'W\' BEAM & GUARDRAIL POSTS ARE REQUIRED.'], 190);
    return LY.done();
  }, 'Lapping of W-beams and Thriebeams in the direction of traffic over the bridge rail and end terminals, with the end terminal notes.');

  // ================================================================== PN30-4109 WIDTH MARKER
  def('pn4109', 'Barrier', 'Width marker details', 'PN30-4109', [P('side', 'Width marker shown', 'D4-3B(R)', { opts: ['D4-3B(R)', 'D4-3B(L)'] })], (p) => {
    const LY = new Lay();
    LY.block(B => B.noteBox(0, 0, 'NOTE\nWHERE GUARDRAILING IS STRAIGHT WIDTH MARKERS\n(STD SIGNS) D4-3B(L) - LHS ROAD & D4-3B(R) - RHS\nROAD CAN BE ATTACHED TO END OF GUARDRAILING.', 112));
    LY.break();
    const v = LY.view(20), Rt = p.side !== 'D4-3B(L)', sw = 450, sh = 900, yb = 300, rr = 40, pw = 76;
    // ground, footing and post
    v.line(-1350, 0, -280, 0, 'S-GROUND'); v.line(-1350, 12, -620, 12, 'S-GROUND'); v.line(100, 0, 1050, 0, 'S-GROUND'); v.line(-100, 0, 100, 0, 'S-GROUND');
    tufts(v, [[-1300, 0], [-420, 0]], -1, 140, 45); tufts(v, [[130, 0], [1000, 0]], -1, 140, 45);
    v.rect(-100, -600, 200, 600, 'S-CONC');
    v.line(-pw / 2, -580, -pw / 2, 0, 'S-HIDDEN'); v.line(pw / 2, -580, pw / 2, 0, 'S-HIDDEN'); v.line(-pw / 2, -580, pw / 2, -580, 'S-HIDDEN');
    v.line(-pw / 2, 0, -pw / 2, yb, 'S-NEW'); v.line(pw / 2, 0, pw / 2, yb, 'S-NEW'); v.line(-pw / 2, yb, -pw / 2, yb + sh, 'S-HIDDEN'); v.line(pw / 2, yb, pw / 2, yb + sh, 'S-HIDDEN');
    // sign with diagonal black bands (sloping down towards the traffic side)
    const x0 = -sw / 2, x1 = sw / 2, y0 = yb, y1 = yb + sh, per = 300, bw = 150, k = Rt ? 1 : -1;
    const arcPts = (cx, cy, a0, a1) => Array.from({ length: 7 }, (_, i) => { const a = (a0 + (a1 - a0) * i / 6) * PI / 180; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; });
    v.pl([].concat(arcPts(x1 - rr, y0 + rr, -90, 0), arcPts(x1 - rr, y1 - rr, 0, 90), arcPts(x0 + rr, y1 - rr, 90, 180), arcPts(x0 + rr, y0 + rr, 180, 270)), true, 'S-NEW');
    for (let c = -sw - per * 2; c < sh + sw + per; c += per) {
      // band between the lines y = k*x + c and y = k*x + c + bw (in sign coords, origin at the sign's bottom-left)
      const band = [[-sw, k > 0 ? c - sw : c + sw], [2 * sw, k > 0 ? c + 2 * sw : c - 2 * sw], [2 * sw, k > 0 ? c + 2 * sw + bw : c - 2 * sw + bw], [-sw, k > 0 ? c - sw + bw : c + sw + bw]].map(q => [q[0] + x0, q[1] + y0 + (k < 0 ? -sw : 0)]);
      const cp = clipRect(band, x0 + 4, y0 + 4, x1 - 4, y1 - 4); if (cp.length >= 3) v.fill(cp, 'S-NEW');
    }
    v.line(x1 + 20, yb, 900, yb, 'S-DIM'); v.dim(820, 0, 820, yb, 0.01, '300'); v.text(820 + 110, yb / 2, 'NOM.', 2.0, 'c', 'b', 'S-DIM', 90);
    v.line(-pw / 2, -620, -pw / 2, -780, 'S-DIM'); v.line(pw / 2, -620, pw / 2, -780, 'S-DIM'); v.dim(-pw / 2, -760, pw / 2, -760, 0.01, '76');
    v.leader(x0, y0 + 360, -22, 14, 'WIDTH MARKER (STD\nSIGNS) D4-3B(L) - LHS\nROAD & D4-3B(R) -\nRHS ROAD');
    v.leader(-100, -170, -22, -8, 'POST FOOTING (FOR\nDETAILS REFER TO\nMRWA DRAWING\nN° 9548-106)');
    v.leader(pw / 2 - 10, -170, 22, -14, '76x38x2.0RHS\nPOST');
    LY.title('WIDTH MARKER DETAILS', 20, 'WIDTH MARKER ' + (Rt ? 'D4-3B(R)' : 'D4-3B(L)') + ' - SHOWN');
    return LY.done();
  }, 'Width marker sign on a 76x38x2.0 RHS post at the ends of the barrier (right or left hand version).');

  // ================================================================== PN30-4104 POST CONNECTION DETAILS
  def('pn4104', 'Barrier', 'Traffic barrier – post connection to kerb', 'PN30-4104', [P('pt', 'Post types', 'PT1 & PT2')], (p) => {
    const LY = new Lay(), M = 24;
    // ---- VIEW A (plan on top of the kerb)
    const a = LY.view(10);
    const yT = 411, yB = -371, xL = -1228;
    a.line(xL, yT, 0, yT, 'S-CONC'); a.line(xL, yB, 0, yB, 'S-CONC'); a.line(0, yT, 0, yB, 'S-CONC'); a.line(-280, yT, -280, yB, 'S-CONC');
    a.brk(xL, yB, xL, yT, 'S-CONC');
    [-312, -298].forEach((x, i) => a.pl([[x, yT + 40], [x, yT - 10], [x - 12, yT - 30], [x + 12, yT - 50], [x, yT - 70], [x, yB + 70], [x - 12, yB + 50], [x + 12, yB + 30], [x, yB + 10], [x, yB - 40]], false, 'S-CONC'));
    [85, -85].forEach(y => {
      a.line(-1159, y + M / 2, 0, y + M / 2, 'S-HIDDEN'); a.line(-1159, y - M / 2, 0, y - M / 2, 'S-HIDDEN'); a.rect(-1159, y - 18, 14, 36, 'S-HIDDEN');
      a.line(-1185, y, 420, y, 'S-CL'); a.line(14, y + M / 2, 65, y + M / 2, 'S-BOLT'); a.line(14, y - M / 2, 65, y - M / 2, 'S-BOLT'); a.nut(14, y, 1, 0, M);
    });
    a.rect(0, -118, 14, 235, 'S-NEW');
    // post (channel) seen from above, bolted through the web
    a.pl([[25, 45], [175, 45], [175, -45], [25, -45], [25, -37], [165, -37], [165, 37], [25, 37]], true, 'S-NEW');
    a.bolt(14, 0, 175, 0, 20); a.line(-20, 0, 210, 0, 'S-CL');
    a.dimChain([[258, 85], [258, 0], [258, -85]], 0.01, ['=', '=']); a.dim(363, 85, 363, -85, 0.01, '170');
    a.line(0, -125, 0, -260, 'S-DIM'); a.line(65, -105, 65, -260, 'S-DIM'); a.dim(0, -237, 65, -237, 0.01, '65');
    a.leader(-63, 305, 22, 26, 'KERB', { dot: true }); a.leader(7, 118, 20, 22, 'POST CONNECTION\nPLATE');
    LY.title('VIEW A', 10);
    LY.break();
    // ---- SECTIONAL ELEVATION
    const v = LY.view(10);
    const kerb = [[-1030, 18], [-296, 0], [-278, 69], [-255, 88], [-20, 99], [0, 82], [0, -248], [-18, -266], [-55, -266], [-62, -257], [-70, -266], [-287, -266], [-287, -143], [-1030, -143]];
    v.pl(kerb.slice(0, 13).concat([[-287, -143]]), false, 'S-CONC'); v.line(-1030, -143, -296, -143, 'S-CONC');
    v.hatch([[-930, -10], [-640, -10], [-640, -125], [-930, -125]], 'conc', 'S-HATCH', 1.5); v.hatch([[-240, -150], [-100, -150], [-100, -250], [-240, -250]], 'conc', 'S-HATCH', 1.5);
    v.rect(-296, -266, 9, 123, 'S-NEW'); v.hatch([[-296, -266], [-287, -266], [-287, -143], [-296, -143]], 'ansi31', 'S-HATCH', 0.4);
    v.line(-1030, -132, -296, -132, 'S-HIDDEN'); v.line(-1030, -266, -296, -266, 'S-EXIST');
    v.brk(-1030, -143, -1030, 30, 'S-CONC'); v.brk(-1030, -275, -1030, -143, 'S-EXIST');
    v.circ(-299, -486, 219, 'S-EXIST');
    // anchor rod cast into the kerb / overlay, clamping the post connection plate; bolt through the post
    const yr = -81; v.line(-934, yr + M / 2, 0, yr + M / 2, 'S-HIDDEN'); v.line(-934, yr - M / 2, 0, yr - M / 2, 'S-HIDDEN'); v.rect(-944, yr - 20, 10, 40, 'S-HIDDEN'); v.line(-975, yr, 260, yr, 'S-CL');
    v.rect(0, -248, 10, 236, 'S-NEW'); v.nut(10, yr, 1, 0, M);
    const x0 = 25, x1 = 175, yb = -262, yt = 770;
    v.line(x0, yb, x0, yt, 'S-NEW'); v.line(x0 + 9, yb, x0 + 9, yt, 'S-NEW'); v.line(x1, yb, x1, yt, 'S-NEW'); v.line(x1 - 9, yb, x1 - 9, yt, 'S-NEW'); v.line(x0, yb, x1, yb, 'S-NEW');
    v.brk(x0 - 15, yt, x1 + 25, yt); v.line(x0 + 9, 25, x1 - 9, 25, 'S-NEW'); v.line(x0 + 9, -123, x1 - 9, -123, 'S-NEW');
    v.line(10, yr + M / 2, x1, yr + M / 2, 'S-HIDDEN'); v.line(10, yr - M / 2, x1, yr - M / 2, 'S-HIDDEN'); v.nut(x1, yr, 1, 0, M);
    v.line(-30, -229, x0 + 9, -229, 'S-BOLT'); v.line(-30, -237, x0 + 9, -237, 'S-BOLT'); v.rect(x0 + 9, -243, 8, 20, 'S-BOLT');
    // blockout and Thriebeam
    v.rect(-123, 293, 148, 551, 'S-NEW'); v.line(-108, 293, -108, 844, 'S-HIDDEN'); v.line(10, 293, 10, 844, 'S-HIDDEN');
    const pr = beamProfile(v, -123, 818, -1, true);
    pr.valleys.forEach(y => { v.arc(-123, y, 14, 90, 270, 'S-BOLT'); v.line(-123, y, -80, y, 'S-BOLT'); v.nut(-108, y, 1, 0, 16); });
    [696, 441].forEach(y => { v.fill([[x0, y - 40], [x0 + 9, y - 40], [x0 + 9, y + 40], [x0, y + 40]]); v.line(-5, y, x0 + 40, y, 'S-BOLT'); v.nut(x0 + 9, y, 1, 0, 16); v.nut(10, y, -1, 0, 16); });
    // dimensions
    v.line(-1000, 818, -140, 818, 'S-DIM'); v.dim(-546, 6, -546, 818, 0.01, '820 ± 10');
    v.line(-420, 99, -265, 99, 'S-DIM'); v.dim(-384, 2, -384, 99, 0.01, '100');
    v.line(5, 99, 470, 99, 'S-DIM'); v.line(200, yr, 470, yr, 'S-DIM'); v.dim(435, -81, 435, 99, 0.01, '180');
    v.wl(-897, 16, 'TOP OF\nRUNNING\nSURFACE');
    v.mark(-352, 349, 'A', -90);
    v.leader(-527, -93, -28, -48, 'ANCHOR ROD'); v.leader(x0 + 17, -233, 30, -12, 'SET SCREW'); v.leader(x1 + 30, yr - 10, 22, -8, 'BOLT');
    v.leader(x1, 460, 22, 22, 'POSTS TYPE\n' + (p.pt || 'PT1 & PT2'));
    v.pl([[-69, -160], [74, -160], [74, -280], [-69, -280]], true, 'S-NOTE'); v.line(40, -280, 150, -470, 'S-NOTE');
    v.noteBox(150, -470, 'NOTE: ENGINEER TO CHECK THAT\nCONNECTION PLATE FITS ABOVE\nBOTTOM CHAMFER (OR BOTTOM\nOF KERB PERMANENT FORMWORK)\nTHICKEN OVERLAY AS REQUIRED\nTO SUIT.', 66);
    LY.title('SECTIONAL ELEVATION');
    LY.caption('POST CONNECTION DETAILS', 10);
    return LY.done();
  }, 'Connection of the barrier posts (types PT1 & PT2) to the concrete kerb: post connection plate on the kerb face, two anchor rods at 170 crs.');

  // ================================================================== PN30-4105 FORMATION WIDENING
  def('pn4105', 'Barrier', 'Traffic barrier – formation widening details', 'PN30-4105', [], () => {
    const LY = new Lay();
    // ---- THRIEBEAM & TRANSITION BEAM (traced from the sheet: image units ix, iy at 1:20)
    const v = LY.view(20), I = (ix, iy) => [((100 + ix / 0.6) - 1105) * 1.76, (888 - (100 + iy / 0.6)) * 1.76], L1 = (pts, Ly) => v.pl(pts.map(q => I(...q)), false, Ly || 'S-GROUND');
    const base = [[330, 473], [550, 473], [550, 527], [330, 527]].map(q => I(...q)); v.line(...base[0], ...base[1], 'S-CONC'); v.line(...base[3], ...base[2], 'S-CONC'); v.hatch(base, 'gravel', 'S-HATCH', 1.5);
    v.pl([[550, 527], [550, 466], [557, 450], [570, 440], [603, 440], [603, 527]].map(q => I(...q)), true, 'S-CONC');
    tufts(v, [I(440, 527), I(550, 527)], -1, 110, 40);
    L1([[603, 473], [620, 473], [700, 476], [830, 472], [870, 488], [930, 510], [1000, 535], [1060, 560], [1140, 598], [1185, 612]], 'S-NEW');
    tufts(v, [I(690, 475), I(850, 475)], -1, 110, 40);
    L1([[620, 473], [700, 505], [890, 578], [1015, 632], [1140, 686], [1185, 700]], 'S-EXIST');
    L1([[620, 476], [620, 578], [888, 578], [888, 685], [1140, 685]]); L1([[1145, 685], [1145, 700]]);
    // post, blockout and Thriebeam (real sizes)
    const yt = 820, xb = 5, xp = 153, xq = 303, yb = I(0, 925)[1];
    v.rect(xp, yb, xq - xp, yt - yb, 'S-NEW'); v.line(xp + 10, yb, xp + 10, yt, 'S-HIDDEN'); v.line(xq - 10, yb, xq - 10, yt, 'S-HIDDEN');
    v.rect(xb, yt - 551 + 25, xp - xb, 551, 'S-NEW'); beamProfile(v, xb, yt, -1, true);
    [696, 441].forEach(y => { v.line(xb + 110, y, xp + 50, y, 'S-BOLT'); v.line(xp - 4, y - 20, xp - 4, y + 20, 'S-BOLT'); });
    [653, 468].forEach(y => v.line(xb - 30, y, xb + 40, y, 'S-BOLT'));
    // dimensions and notes
    v.line(-640, yt, -30, yt, 'S-DIM'); v.line(-640, 0, -600, 0, 'S-DIM'); v.dim(-567, 0, -567, yt, 0.01, '820 ± 10');
    v.text(-567 + 130, yt / 2, 'ABOVE ADJACENT', 2.2, 'c', 'b', 'S-DIM', 90); v.text(-567 + 200, yt / 2, 'ROAD SURFACE', 2.2, 'c', 'b', 'S-DIM', 90);
    const yd = I(0, 405)[1], xe = I(832, 0)[0]; v.line(xe, yd + 30, xe, I(0, 470)[1], 'S-DIM'); v.dim(0, yd, xe, yd, 0.01, ' '); v.text(xq + 40, yd + 25, '600', 2.2, 'l', 'b', 'S-DIM'); v.text(xq + 40, yd - 25, 'MIN', 2.2, 'l', 't', 'S-DIM');
    const yg = I(0, 527)[1]; v.dim(-567, yg - 140, -567, yg, 0.01, ''); v.dim(-567, 140, -567, 0, 0.01, ''); v.text(-567 + 45, yg - 250, '150 MIN', 2.2, 'c', 'b', 'S-DIM', 90);
    const xbch = I(545, 0)[0], y1 = I(0, 578)[1], y2 = I(0, 685)[1]; v.line(I(530, 0)[0], y1, I(605, 0)[0], y1, 'S-DIM'); v.line(I(530, 0)[0], y2, I(880, 0)[0], y2, 'S-DIM');
    v.dim(xbch, y2, xbch, y1, 0.01, ''); v.line(xbch, y2, xbch, I(0, 745)[1], 'S-DIM');
    v.leader(xbch, I(0, 745)[1], -6, 0, '300 MAX\nBENCH', { noArrow: true });
    const xk = I(553, 0)[0], xr = -88, ydt = I(0, 35)[1]; v.line(xk, ydt + 30, xk, I(0, 445)[1], 'S-DIM'); v.line(xr, ydt + 30, xr, yt + 15, 'S-DIM');
    v.dim(xk, ydt, xr, ydt, 0.01, ' '); v.leader(xr + 70, ydt, 6, 0, 'DIMENSION TO MATCH THAT\nBETWEEN BRIDGE KERB AND\nBARRIER', { noArrow: true });
    v.leader(...I(370, 512), -22, -22, '150 THICK CEMENT\nSEAL STABILISED\nGRAVEL (WHERE\nAPPLICABLE)', { dot: true });
    v.leader(...I(872, 488), 14, 26, 'PROPOSED BATTER'); v.leader(...I(1015, 632), -14, -22, 'EXISTING\nBATTER');
    LY.title('THRIEBEAM & TRANSITION BEAM');
    LY.break();
    // ---- 'W' BEAM
    const w = LY.view(20), J = (ix, iy) => [((500 + ix * 1.5) - 1105) * 1.76, (2335 - (1800 + iy * 1.5)) * 1.76], L2 = (pts, Ly) => w.pl(pts.map(q => J(...q)), false, Ly || 'S-GROUND');
    L2([[75, 357], [455, 357]]); tufts(w, [J(75, 357), J(290, 357)], -1, 110, 40);
    L2([[515, 357], [760, 355], [800, 365], [900, 395], [1015, 420]], 'S-NEW'); tufts(w, [J(545, 357), J(740, 357)], -1, 110, 40);
    L2([[660, 359], [660, 475], [960, 475], [960, 590], [1015, 590]]);
    const wt = 725, wb = -9, wp = J(458, 0)[0], wq = J(518, 0)[0], wyb = J(0, 778)[1];
    w.rect(wp, wyb, wq - wp, wt + 27 - wyb, 'S-NEW'); w.line(wp + 10, wyb, wp + 10, wt + 27, 'S-HIDDEN'); w.line(wq - 10, wyb, wq - 10, wt + 27, 'S-HIDDEN');
    w.rect(wb, wt - 350, wp - wb, 377, 'S-NEW'); beamProfile(w, wb, wt, -1, false);
    [699, 435].forEach(y => { w.line(wb + 110, y, wp + 50, y, 'S-BOLT'); w.line(wp - 4, y - 20, wp - 4, y + 20, 'S-BOLT'); }); w.line(wb - 30, wt - 155, wb + 40, wt - 155, 'S-BOLT');
    const xm = J(150, 0)[0]; w.line(xm - 60, wt, -30, wt, 'S-DIM'); w.dim(xm, 0, xm, wt, 0.01, '725 ± 10 ABOVE');
    w.text(xm + 130, wt / 2, 'ADJACENT', 2.2, 'c', 'b', 'S-DIM', 90); w.text(xm + 200, wt / 2, 'ROAD SURFACE', 2.2, 'c', 'b', 'S-DIM', 90);
    const xt = J(760, 0)[0], yd2 = J(0, 277)[1]; w.line(wb, wt - 350, wb, yd2 - 40, 'S-DIM'); w.line(xt, 20, xt, yd2 + 40, 'S-DIM'); w.dim(wb, yd2, xt, yd2, 0.01, '1000 TO 1800');
    w.leader(...J(800, 365), 14, 26, 'PROPOSED BATTER\n1:4');
    LY.title("'W' BEAM");
    LY.caption('FORMATION WIDENING DETAILS', 20);
    return LY.done();
  }, 'Formation widening behind the Thriebeam / transition beam and the W-beam on the approaches (600 min / 1000 to 1800 to the batter, benching into the existing batter).');

  // ================================================================== PN30-4106 GUARDRAIL & BALUSTRADE POST SOCKETS
  def('pn4106', 'Barrier', 'Guardrail & balustrade post sockets', 'PN30-4106', [], () => {
    const LY = new Lay(560);
    // trace helper: full-resolution sheet coordinates → model mm about an origin (cx, cy) at K mm per pixel
    const T = (K, cx, cy) => (x, y) => [(x - cx) * K, (cy - y) * K];
    const poly = (v, F, pts, closed, L) => v.pl(pts.map(q => F(...q)), closed, L);
    const cross = (v, x, y, r) => { v.line(x - r, y, x + r, y, 'S-BOLT'); v.line(x, y - r, x, y + r, 'S-BOLT'); v.fill([[x - r * 0.35, y - r * 0.35], [x + r * 0.35, y - r * 0.35], [x + r * 0.35, y + r * 0.35], [x - r * 0.35, y + r * 0.35]], 'S-BOLT'); };
    const stadium = (v, x0, y0, x1, y1) => { const r = (x1 - x0) / 2, cx = (x0 + x1) / 2, P0 = []; for (let i = 0; i <= 12; i++) { const a = PI * i / 12; P0.push([cx + r * Math.cos(a), y1 - r + r * Math.sin(a)]); } for (let i = 0; i <= 12; i++) { const a = PI + PI * i / 12; P0.push([cx + r * Math.cos(a), y0 + r + r * Math.sin(a)]); } v.pl(P0, true, 'S-TEXT'); };
    const railBox = (v, F, x0, y0, x1, y1, xb) => { poly(v, F, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true, 'S-NEW'); poly(v, F, [[x0 + 5, y0 + 5], [x1 - 5, y0 + 5], [x1 - 5, y1 - 5], [x0 + 5, y1 - 5]], true, 'S-NEW'); v.line(...F(xb, y0 - 15), ...F(xb, y1 + 18), 'S-BOLT'); const p = F(xb, y1 + 8); v.nut(p[0], p[1] - 4, 0, -1, 12); };
    // ---- BRIDGE CROSS SECTION 1:50 (image units of the sheet crop)
    const c = LY.view(50), H = (ix, iy) => [((350 + ix / 0.7) - 1450) * 9.8, (967 - (500 + iy / 0.7)) * 9.8], hp = (pts, cl, L) => c.pl(pts.map(q => H(...q)), cl, L);
    const deck = [[160, 318], [205, 318], [210, 330], [388, 338], [770, 327], [1150, 344], [1186, 330], [1196, 330], [1196, 358], [1188, 362], [990, 357], [985, 470], [915, 470], [910, 358], [770, 352], [440, 366], [435, 478], [365, 478], [360, 353], [178, 352], [160, 345]];
    hp(deck, true, 'S-CONC'); c.hatch([[372, 372], [428, 372], [428, 420], [372, 420]].map(q => H(...q)), 'conc', 'S-HATCH', 1.2); c.hatch([[920, 420], [978, 420], [978, 460], [920, 460]].map(q => H(...q)), 'conc', 'S-HATCH', 1.2);
    hp([[392, 340], [770, 329], [1150, 346]], false, 'S-NEW');
    hp([[178, 340], [178, 232], [186, 232], [186, 340]], true, 'S-NEW'); hp([[367, 340], [367, 266], [373, 266], [373, 340]], true, 'S-NEW'); hp([[1165, 344], [1165, 242], [1171, 242], [1171, 344]], true, 'S-NEW');
    [[373, 268], [373, 292]].forEach(([x, y]) => hp([[x, y], [x + 12, y], [x + 12, y + 12], [x, y + 12]], true, 'S-NEW')); [[1153, 268], [1153, 292]].forEach(([x, y]) => hp([[x, y], [x + 12, y], [x + 12, y + 12], [x, y + 12]], true, 'S-NEW'));
    hp([[165, 302], [190, 300], [205, 318]], false, 'S-CONC'); hp([[388, 338], [410, 330], [410, 322]], false, 'S-CONC'); hp([[1150, 344], [1135, 330], [1180, 322], [1196, 330]], false, 'S-CONC');
    [[170, 333, 32, '1', 118, 265], [377, 322, 30, '2', 318, 255], [1166, 335, 38, '3', 1232, 265]].forEach(([x, y, r, ch, lx, ly]) => { c.circ(...H(x, y), r / 0.7 * 9.8, 'S-TEXT'); callout(c, ...H(lx, ly), ch); const a = H(lx, ly), b = H(x, y), d = Math.hypot(b[0] - a[0], b[1] - a[1]); c.line(a[0] + (b[0] - a[0]) * 150 / d, a[1] + (b[1] - a[1]) * 150 / d, b[0] - (b[0] - a[0]) * (r / 0.7 * 9.8) / d, b[1] - (b[1] - a[1]) * (r / 0.7 * 9.8) / d, 'S-TEXT'); });
    [[182, 140, 232, 'BALUSTRADE'], [370, 140, 262, 'GUARDRAIL'], [675, 75, 300, 'BRIDGE'], [770, 130, 327, 'CARRIAGEWAY'], [1168, 140, 240, 'GUARDRAIL']].forEach(([x, y0, y1, s]) => { c.line(...H(x, y0 + 8), ...H(x, y1), 'S-CL'); c.text(...H(x - 4, y0), '℄ ' + s, 2.2, 'l'); });
    c.dim(...H(182, 207), ...H(370, 207), 0.01, 'D.U.P.'); c.line(...H(410, 205), ...H(410, 325), 'S-DIM'); c.line(...H(1130, 205), ...H(1130, 330), 'S-DIM'); c.dim(...H(410, 207), ...H(1130, 207), 0.01, 'CARRIAGEWAY');
    const wedge = (x0, x1, y, toR) => { const a = H(x0, y), b = H(x1, y); c.fill(toR ? [[a[0], a[1]], [b[0], b[1]], [a[0], a[1] + 70]] : [[b[0], b[1]], [a[0], a[1]], [b[0], b[1] + 70]], 'S-TEXT'); };
    wedge(270, 322, 305, true); c.text(...H(232, 297), '2%', 2.2, 'l'); wedge(615, 670, 312, false); c.text(...H(675, 306), '3%', 2.2, 'l'); wedge(870, 915, 312, true); c.text(...H(843, 306), '3%', 2.2, 'l');
    c.wl(...H(966, 330), 'TOP OF RUNNING\nSURFACE');
    LY.title('BRIDGE CROSS SECTION', 50);
    LY.break();
    // ---- DETAIL 1 (balustrade post in a non-standard parapet panel)
    const K1 = 1.96;
    { const v = LY.view(10), F = T(K1, 530, 1855);
      poly(v, F, [[380, 2095], [365, 1815], [395, 1778], [650, 1795], [665, 1812], [665, 1950], [615, 1955], [615, 1840], [600, 1832], [425, 1830], [420, 2095]], true, 'S-CONC');
      poly(v, F, [[665, 1855], [775, 1855]], false, 'S-CONC'); poly(v, F, [[420, 2048], [775, 2072]], false, 'S-CONC'); v.brk(...F(775, 2072), ...F(775, 1855), 'S-CONC');
      poly(v, F, [[615, 1955], [665, 1955]], false, 'S-CONC'); v.hatch([[615, 1840], [632, 1840], [632, 1950], [615, 1950]].map(q => F(...q)), 'conc', 'S-HATCH', 0.6);
      [[430, 1850, 470, 1890], [578, 1870, 610, 1905], [670, 1880, 720, 1915], [430, 2020, 470, 2045], [720, 2030, 760, 2060]].forEach(([a, b, d, e]) => v.hatch([[a, b], [d, b], [d, e], [a, e]].map(q => F(...q)), 'conc', 'S-HATCH', 1));
      [[497, 505], [555, 563]].forEach(([a, b]) => v.fill([[a, 1950], [b, 1950], [b, 1792], [a, 1792]].map(q => F(...q)))); v.fill([[497, 1950], [563, 1950], [563, 1942], [497, 1942]].map(q => F(...q)));
      [[493, 1790, 505, 1815], [555, 1790, 567, 1815]].forEach(([a, b, d, e]) => v.hatch([[a, b], [d, b], [d, e], [a, e]].map(q => F(...q)), 'gravel', 'S-HATCH', 0.4));
      poly(v, F, [[507, 1625], [507, 1942]], false, 'S-NEW'); poly(v, F, [[553, 1625], [553, 1942]], false, 'S-NEW'); poly(v, F, [[512, 1725], [548, 1725], [548, 1750], [512, 1750]], true, 'S-NEW'); v.brk(...F(500, 1625), ...F(560, 1625));
      [[518, 1880], [542, 1880], [518, 1915], [542, 1915]].forEach(q => cross(v, ...F(...q), 12));
      v.line(...F(530, 1545), ...F(530, 2010), 'S-CL'); v.text(...F(526, 1530), '℄ POST', 2.2, 'l');
      stadium(v, ...F(470, 2030), ...F(590, 1770)); callout(v, ...F(640, 1708), '4'); v.text(...F(675, 1714), 'SIMILAR', 2.2, 'l'); v.line(...F(625, 1722), ...F(585, 1772), 'S-TEXT');
      v.leader(...F(503, 1680), -18, 12, 'BALUSTRADE\nPOST'); v.leader(...F(372, 1970), -14, 5, 'PARAPET PANEL\n(NON-STANDARD)');
    }
    LY.title('DETAIL 1', 10);
    // ---- DETAIL 2 (guardrail post in the deck kerb)
    { const v = LY.view(10), F = T(K1, 1075, 1945);
      poly(v, F, [[900, 1868], [1250, 1868], [1335, 1918], [1335, 1945], [1450, 1945]], false, 'S-CONC'); poly(v, F, [[900, 2085], [1450, 2085]], false, 'S-CONC'); poly(v, F, [[900, 1965], [1450, 1965]], false, 'S-CONC'); poly(v, F, [[1335, 1945], [1335, 1965]], false, 'S-CONC');
      v.brk(...F(900, 2085), ...F(900, 1868), 'S-CONC'); v.brk(...F(1450, 2085), ...F(1450, 1945), 'S-CONC'); v.brk(...F(1130, 2085), ...F(1210, 2085), 'S-CONC');
      [[930, 1885, 985, 1930], [1155, 1905, 1205, 1945], [1235, 1880, 1280, 1915], [1280, 1925, 1325, 1955]].forEach(([a, b, d, e]) => v.hatch([[a, b], [d, b], [d, e], [a, e]].map(q => F(...q)), 'conc', 'S-HATCH', 1));
      [[1040, 1050], [1100, 1110]].forEach(([a, b]) => v.fill([[a, 1965], [b, 1965], [b, 1870], [a, 1870]].map(q => F(...q)))); v.fill([[1040, 1965], [1110, 1965], [1110, 1955], [1040, 1955]].map(q => F(...q)));
      poly(v, F, [[1050, 1585], [1050, 1868]], false, 'S-NEW'); poly(v, F, [[1100, 1585], [1100, 1868]], false, 'S-NEW'); poly(v, F, [[1056, 1600], [1056, 1955]], false, 'S-HIDDEN'); poly(v, F, [[1094, 1600], [1094, 1955]], false, 'S-HIDDEN'); v.brk(...F(1043, 1585), ...F(1107, 1585));
      [[1065, 1900], [1088, 1900], [1065, 1930], [1088, 1930]].forEach(q => cross(v, ...F(...q), 12));
      poly(v, F, [[1100, 1690], [1112, 1690]], false, 'S-NEW'); railBox(v, F, 1112, 1640, 1180, 1700, 1145);
      v.line(...F(1075, 1440), ...F(1075, 2040), 'S-CL'); v.text(...F(1071, 1425), '℄ POST', 2.2, 'l');
      v.circ(...F(1075, 1925), 125 * K1, 'S-TEXT'); callout(v, ...F(935, 1785), '5'); v.line(...F(952, 1805), ...F(1000, 1835), 'S-TEXT');
      v.line(...F(1335, 1545), ...F(1335, 1910), 'S-DIM'); v.dim(...F(1075, 1535), ...F(1335, 1535), 0.01, '500');
      v.line(...F(1190, 1695), ...F(1470, 1695), 'S-DIM'); v.dim(...F(1450, 1945), ...F(1450, 1695), 0.01, ' '); v.text(...F(1450, 1820).map((q, i) => q + (i ? 0 : -45)), '500 ABOVE ADJACENT', 2.0, 'c', 'b', 'S-DIM', 90); v.text(...F(1450, 1820).map((q, i) => q + (i ? 0 : 65)), 'RUNNING SURFACE', 2.0, 'c', 'b', 'S-DIM', 90);
      v.leader(...F(1050, 1690), -16, 10, 'GUARDRAIL\nPOST');
    }
    LY.title('DETAIL 2', 10);
    // ---- DETAIL 3 (guardrail post in a standard parapet panel)
    { const v = LY.view(10), F = T(K1, 2072, 1945);
      poly(v, F, [[1640, 1945], [1810, 1945], [1810, 1915], [1820, 1905], [1900, 1868], [1932, 1868]], false, 'S-CONC'); poly(v, F, [[1640, 1965], [1990, 1975]], false, 'S-CONC'); v.brk(...F(1640, 2073), ...F(1640, 1945), 'S-CONC'); poly(v, F, [[1640, 2073], [2180, 2066], [2190, 2056], [2190, 1905]], false, 'S-CONC');
      v.hatch([[1932, 1868], [1990, 1868], [1990, 1975], [1932, 1975]].map(q => F(...q)), 'gravel', 'S-HATCH', 0.4); poly(v, F, [[1932, 1868], [1932, 1975], [1990, 1975], [1990, 1882]], false, 'S-CONC');
      poly(v, F, [[1950, 1935], [1950, 1862], [1960, 1855], [2035, 1850]], false, 'S-CONC'); poly(v, F, [[1950, 1935], [1962, 1942], [1975, 1935], [1975, 1897], [1990, 1882], [2035, 1880]], false, 'S-CONC');
      poly(v, F, [[2110, 1845], [2200, 1838], [2228, 1860], [2215, 2090], [2200, 2105], [2188, 2100], [2190, 1905], [2180, 1893], [2120, 1893], [2110, 1880]], false, 'S-CONC');
      v.hatch([[2122, 1880], [2180, 1880], [2180, 1892], [2122, 1892]].map(q => F(...q)), 'gravel', 'S-HATCH', 0.4);
      [[1830, 1915, 1870, 1950], [1990, 1915, 2030, 1950], [2140, 2025, 2180, 2055], [1660, 1985, 1700, 2015]].forEach(([a, b, d, e]) => v.hatch([[a, b], [d, b], [d, e], [a, e]].map(q => F(...q)), 'conc', 'S-HATCH', 1));
      [[2040, 2050], [2095, 2105]].forEach(([a, b]) => v.fill([[a, 2000], [b, 2000], [b, 1852], [a, 1852]].map(q => F(...q)))); v.fill([[2038, 2003], [2108, 2003], [2108, 1993], [2038, 1993]].map(q => F(...q)));
      [[2034, 1850, 2052, 1876], [2093, 1850, 2111, 1876]].forEach(([a, b, d, e]) => v.hatch([[a, b], [d, b], [d, e], [a, e]].map(q => F(...q)), 'gravel', 'S-HATCH', 0.4));
      poly(v, F, [[2048, 1585], [2048, 1850]], false, 'S-NEW'); poly(v, F, [[2098, 1585], [2098, 1850]], false, 'S-NEW'); poly(v, F, [[2054, 1600], [2054, 1993]], false, 'S-HIDDEN'); poly(v, F, [[2092, 1600], [2092, 1993]], false, 'S-HIDDEN'); v.brk(...F(2041, 1585), ...F(2105, 1585));
      [[2058, 1935], [2087, 1935], [2058, 1965], [2087, 1965]].forEach(q => cross(v, ...F(...q), 12));
      poly(v, F, [[1995, 1690], [2010, 1690], [2010, 1715], [2048, 1715]], false, 'S-NEW'); railBox(v, F, 1925, 1640, 1995, 1690, 1960);
      v.line(...F(2072, 1450), ...F(2072, 2060), 'S-CL'); v.text(...F(2068, 1435), '℄ POST', 2.2, 'l');
      stadium(v, ...F(2012, 2040), ...F(2135, 1820)); callout(v, ...F(1965, 1765), '4'); v.line(...F(1980, 1782), ...F(2020, 1840), 'S-TEXT');
      v.line(...F(1815, 1550), ...F(1815, 1905), 'S-DIM'); v.dim(...F(1815, 1540), ...F(2072, 1540), 0.01, '500');
      v.line(...F(1915, 1690), ...F(1610, 1690), 'S-DIM'); v.line(...F(1805, 1945), ...F(1610, 1945), 'S-DIM'); v.dim(...F(1630, 1945), ...F(1630, 1690), 0.01, ' ');
      v.text(...F(1630, 1820).map((q, i) => q + (i ? 0 : -45)), '500 ABOVE ADJACENT', 2.0, 'c', 'b', 'S-DIM', 90); v.text(...F(1630, 1820).map((q, i) => q + (i ? 0 : 65)), 'RUNNING SURFACE', 2.0, 'c', 'b', 'S-DIM', 90);
      v.leader(...F(2098, 1680), 16, 12, 'GUARDRAIL\nPOST'); v.leader(...F(2212, 1960), 12, 4, 'PARAPET PANEL\n(STANDARD)');
    }
    LY.title('DETAIL 3', 10);
    LY.break();
    // ---- DETAIL 4 (socket type B / balustrade socket in a parapet panel) 1:5
    const K5 = 0.98;
    { const v = LY.view(5), F = T(K5, 527, 2525);
      poly(v, F, [[372, 2532], [455, 2522], [455, 2535]], false, 'S-CONC'); poly(v, F, [[600, 2512], [680, 2505]], false, 'S-CONC');
      poly(v, F, [[372, 2532], [375, 2590], [390, 2650], [400, 2720], [412, 2780], [430, 2840], [480, 2880], [525, 2890], [580, 2882], [622, 2855], [640, 2790], [652, 2720], [662, 2650], [676, 2590], [680, 2505]], false, 'S-CONC');
      poly(v, F, [[375, 2588], [455, 2582]], false, 'S-CONC'); poly(v, F, [[600, 2585], [628, 2585], [628, 2615], [670, 2615], [670, 2590], [678, 2590]], false, 'S-CONC');
      v.hatch([[630, 2590], [668, 2590], [668, 2613], [630, 2613]].map(q => F(...q)), 'gravel', 'S-HATCH', 0.6);
      [[395, 2615, 445, 2670], [598, 2640, 650, 2700]].forEach(([a, b, d, e]) => v.hatch([[a, b], [d, b], [d, e], [a, e]].map(q => F(...q)), 'conc', 'S-HATCH', 1.4));
      [[456, 2536, 476, 2582], [580, 2516, 600, 2582]].forEach(([a, b, d, e]) => { v.hatch([[a, b], [d, b], [d, e], [a, e]].map(q => F(...q)), 'gravel', 'S-HATCH', 0.6); poly(v, F, [[a, b], [d, b], [d, e], [a, e]], true, 'S-CONC'); });
      [[460, 470], [582, 592]].forEach(([a, b]) => v.fill([[a, 2845], [b, 2845], [b, 2582], [a, 2582]].map(q => F(...q)))); v.fill([[456, 2850], [596, 2850], [596, 2840], [456, 2840]].map(q => F(...q)));
      [[470, 478], [574, 582]].forEach(([a, b]) => v.hatch([[a, 2590], [b, 2590], [b, 2838], [a, 2838]].map(q => F(...q)), 'gravel', 'S-HATCH', 0.35));
      poly(v, F, [[478, 2440], [478, 2525]], false, 'S-NEW'); poly(v, F, [[575, 2440], [575, 2525]], false, 'S-NEW'); poly(v, F, [[478, 2525], [478, 2835]], false, 'S-HIDDEN'); poly(v, F, [[575, 2525], [575, 2835]], false, 'S-HIDDEN'); v.brk(...F(470, 2440), ...F(583, 2440));
      poly(v, F, [[484, 2830], [570, 2830]], false, 'S-HIDDEN'); v.hatch([[480, 2832], [573, 2832], [573, 2840], [480, 2840]].map(q => F(...q)), 'ansi31', 'S-HATCH', 0.3);
      [[497, 2705], [557, 2705], [497, 2765], [557, 2765]].forEach(q => cross(v, ...F(...q), 9));
      v.line(...F(527, 2420), ...F(527, 2900), 'S-CL');
      v.line(...F(400, 2522), ...F(455, 2522), 'S-DIM'); v.line(...F(400, 2557), ...F(456, 2557), 'S-DIM'); v.dim(...F(410, 2557), ...F(410, 2522), 0.01, ' '); v.text(...F(398, 2490), '35', 2.0, 'c', 'b', 'S-DIM', 90);
      v.leader(...F(468, 2552), -26, 6, 'CEMENT MORTAR'); v.leader(...F(590, 2516), 22, 26, 'FORM WITH A CONCRETE\nGROOVING TOOL & SEAL\nWITH SILICONE RUBBER\nJOINT SEALANT 5x10mm\nDEEP ALL AROUND');
      v.leader(...F(612, 2590), 22, 6, 'EPOXY MORTAR\n35 DEEP'); v.leader(...F(592, 2700), 22, 0, 'GUARDRAIL POST SOCKET TYPE B\n(REFER DRG N° 0030-0312)\nOR BALUSTRADE POST SOCKET\n(REFER DRG N° 0030-0312)');
      v.leader(...F(474, 2700), -26, -6, 'FINE DRY SAND'); v.leader(...F(480, 2846), -20, -6, 'LEVELLING PACKER\n(IF REQUIRED)');
    }
    LY.title('DETAIL 4', 5);
    LY.block(B => { B.E.push({ t: 'pl', p: [[0, 0], [72, 0], [72, -17], [0, -17]], closed: true, L: 'S-TEXT' }); headed(B, 2, -4, 'NOTE:', ['POST SOCKETS SHALL BE POSITIONED', 'SO THAT STUDS RUN IN THE DIRECTION', 'OF TRAFFIC (TYP. ALL SOCKETS)'], 2.2); });
    // ---- DETAIL 5 (guardrail post socket type A in the deck) 1:5
    { const v = LY.view(5), F = T(K5, 1808, 2550);
      const blob = [[1745, 2550], [1585, 2540], [1595, 2600], [1592, 2690], [1612, 2760], [1650, 2840], [1700, 2862], [1800, 2868], [1900, 2860], [1950, 2840], [1990, 2765], [2002, 2700], [2012, 2630], [2040, 2550], [1870, 2550]];
      poly(v, F, blob, false, 'S-CONC'); poly(v, F, [[1612, 2750], [1745, 2750]], false, 'S-CONC'); poly(v, F, [[1870, 2750], [1992, 2750]], false, 'S-CONC');
      [[1615, 2580, 1730, 2700], [1885, 2585, 1995, 2700], [1660, 2765, 1760, 2840], [1850, 2765, 1945, 2840]].forEach(([a, b, d, e]) => v.hatch([[a, b], [d, b], [d, e], [a, e]].map(q => F(...q)), 'conc', 'S-HATCH', 1.4));
      [[1745, 1757], [1858, 1870]].forEach(([a, b]) => v.fill([[a, 2747], [b, 2747], [b, 2555], [a, 2555]].map(q => F(...q)))); v.fill([[1745, 2747], [1870, 2747], [1870, 2737], [1745, 2737]].map(q => F(...q)));
      [[1757, 1764], [1851, 1858]].forEach(([a, b]) => v.hatch([[a, 2555], [b, 2555], [b, 2735], [a, 2735]].map(q => F(...q)), 'gravel', 'S-HATCH', 0.35));
      poly(v, F, [[1764, 2445], [1764, 2555]], false, 'S-NEW'); poly(v, F, [[1851, 2445], [1851, 2555]], false, 'S-NEW'); poly(v, F, [[1764, 2555], [1764, 2730]], false, 'S-HIDDEN'); poly(v, F, [[1851, 2555], [1851, 2730]], false, 'S-HIDDEN'); v.brk(...F(1757, 2445), ...F(1858, 2445));
      poly(v, F, [[1757, 2555], [1858, 2555]], false, 'S-HIDDEN'); poly(v, F, [[1757, 2590], [1858, 2590]], false, 'S-HIDDEN');
      v.hatch([[1764, 2728], [1851, 2728], [1851, 2737], [1764, 2737]].map(q => F(...q)), 'ansi31', 'S-HATCH', 0.3);
      [[1780, 2615], [1838, 2615], [1780, 2680], [1838, 2680]].forEach(q => cross(v, ...F(...q), 9));
      v.line(...F(1808, 2420), ...F(1808, 2900), 'S-CL');
      v.line(...F(1875, 2545), ...F(2040, 2545), 'S-DIM'); v.line(...F(1875, 2590), ...F(2060, 2590), 'S-DIM');
      v.dim(...F(1990, 2550), ...F(1990, 2545), 0.01, ' '); v.text(...F(1998, 2512), '5', 2.0, 'c', 'b', 'S-DIM', 90); v.dim(...F(2040, 2590), ...F(2040, 2555), 0.01, ' '); v.text(...F(2058, 2572), '35', 2.0, 'c', 'b', 'S-DIM', 90);
      v.leader(...F(1860, 2557), 18, 18, 'EPOXY MORTAR'); v.leader(...F(1872, 2690), 26, 0, 'GUARDRAIL POST\nSOCKET TYPE A\n(REFER DRG N° 0030-0312)');
      v.leader(...F(1748, 2672), -30, -14, 'FINE DRY SAND'); v.leader(...F(1760, 2742), -24, -16, 'LEVELLING PACKER\n(IF REQUIRED)');
    }
    LY.title('DETAIL 5', 5);
    return LY.done();
  }, 'Cast-in sockets for guardrail and balustrade posts in the deck kerb and parapet panels, set so the studs run in the direction of traffic.');

})(typeof window !== 'undefined' ? window : globalThis);
