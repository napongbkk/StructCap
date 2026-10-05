/* StructCap Timber — repair details: PN30-4201 … 4209 (project sheets, notes, legend, drainage, approach slab, expansion angles).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ local paper-space helpers (Builder B, paper mm)
  const CW = 0.69;                                  // rendered cap width / text height (for layout)
  const CWT = { ' ': 0.278, '.': 0.278, ',': 0.278, ':': 0.278, ';': 0.278, "'": 0.19, '"': 0.355, '-': 0.333, '(': 0.333, ')': 0.333, '/': 0.278, 'I': 0.278, 'J': 0.5, 'M': 0.833, 'W': 0.944, 'm': 0.833, 'i': 0.222, 'l': 0.222, 't': 0.278, 'f': 0.278, 'r': 0.333, '°': 0.4, '%': 0.889, '&': 0.667, '*': 0.389, 'φ': 0.6 };
  const tw = (s, h) => [...String(s)].reduce((a, c) => a + (CWT[c] != null ? CWT[c] : /[0-9]/.test(c) ? 0.556 : /[a-z]/.test(c) ? 0.5 : 0.69), 0) * (h || TH) * 1.38 * 0.86;
  // text (multi-line with \n); o: h, al, v, ang, L, ls (line pitch factor)
  function T(B, x, y, s, o) { o = o || {}; const h = o.h || TH; String(s).split('\n').forEach((l, i) => B.E.push({ t: 'text', p: [x, y - i * h * (o.ls || 1.55)], s: l, h, al: o.al || 'l', v: o.v || 'b', ang: o.ang || 0, L: o.L || 'S-TEXT' })); }
  function Ln(B, x1, y1, x2, y2, L) { B.E.push({ t: 'line', a: [x1, y1], b: [x2, y2], L: L || 'S-TEXT' }); }
  function PLn(B, pts, closed, L) { B.E.push({ t: 'pl', p: pts, closed: !!closed, L: L || 'S-TEXT' }); }
  function Box(B, x0, y0, x1, y1, L) { PLn(B, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true, L); }
  function Fill(B, pts, L) { for (let i = 1; i + 1 < pts.length; i++) B.E.push({ t: 'solid', p: [pts[0], pts[i], pts[i + 1]], L: L || 'S-TEXT' }); }
  function Arrow(B, x, y, ang, L, len, wid) { const a = ang * PI / 180, l = len || 2.4, w = wid || 0.8; B.E.push({ t: 'solid', p: [[x, y], [x - l * Math.cos(a) - w * Math.sin(a), y - l * Math.sin(a) + w * Math.cos(a)], [x - l * Math.cos(a) + w * Math.sin(a), y - l * Math.sin(a) - w * Math.cos(a)]], L: L || 'S-TEXT' }); }
  // underlined heading (left aligned at x, or centred when al 'c')
  function UT(B, x, y, s, h, al, L) { h = h || 3.2; const w = tw(s, h), x0 = al === 'c' ? x - w / 2 : x; T(B, x0, y, s, { h, L: L || 'S-TITLE' }); Ln(B, x0, y - h * 0.35, x0 + w, y - h * 0.35, L || 'S-TITLE'); }
  // text inside a dashed "designer variable" box; returns the box [x0, y0, x1, y1]
  function XB(B, x, y, s, o) { o = o || {}; const h = o.h || TH, w = tw(s, h), x0 = o.al === 'c' ? x - w / 2 : o.al === 'r' ? x - w : x; T(B, x0, y, s, { h, L: o.L }); const bx = [x0 - 0.8, y - 0.9, x0 + w + 0.8, y + h + 0.9]; Box(B, bx[0], bx[1], bx[2], bx[3], o.solid ? 'S-TEXT' : 'S-NOTE'); return bx; }
  // dashed note box from lines of text (top-left x,y); returns [x0,y0,x1,y1]
  function NB(B, x, y, lines, o) { o = o || {}; const h = o.h || TH, L = String(lines).split('\n'), w = o.w || max(...L.map(l => tw(l, h))) + 4, H = L.length * h * 1.55 + 2.4; Box(B, x, y, x + w, y - H, o.solid ? 'S-TEXT' : 'S-NOTE'); L.forEach((l, i) => T(B, o.al === 'c' ? x + w / 2 : x + 2, y - 1.4 - h - i * h * 1.55, l, { h, al: o.al === 'c' ? 'c' : 'l', L: o.L })); return [x, y - H, x + w, y]; }
  // view → paper helpers
  const VB = v => v.B;
  const vp = (v, x, y) => v.P(x, y);
  function vXB(v, x, y, s, o) { const p = v.P(x, y); return XB(v.B, p[0], p[1], s, o); }
  function vNB(v, x, y, s, o) { const p = v.P(x, y); return NB(v.B, p[0], p[1], s, o); }
  function dashTo(B, a, b) { Ln(B, a[0], a[1], b[0], b[1], 'S-NOTE'); }
  // north point (paper), centred at x,y, height hh
  function north(B, x, y, hh) { hh = hh || 26; Fill(B, [[x, y + hh / 2], [x - 1.4, y - hh / 2], [x + 1.4, y - hh / 2]], 'S-TEXT'); Ln(B, x - 4, y - 2, x + 4, y - 2); Ln(B, x - 3, y - 6, x - 3, y + 2); Ln(B, x - 3, y + 2, x + 3, y - 6); Ln(B, x + 3, y - 6, x + 3, y + 2); }
  // simple drawing-reference footer (boxed, as on the sheets)
  function readWith(B, x, y) { const s = "THIS DRAWING SHALL BE READ IN CONJUNCTION WITH DRG N°'s XX30-XXXX AND XX30-XXXX", h = 3.0; T(B, x + 2, y + 1.6, s, { h, L: 'S-TITLE' }); Ln(B, x, y, x + tw(s, h) + 4, y, 'S-TITLE'); Ln(B, x, y, x, y + h + 3.2, 'S-TITLE'); }
  // numbered paragraph with hanging indent: label at x, text lines at x + ind; returns y below
  function para(B, x, y, lab, lines, o) { o = o || {}; const h = o.h || TH, ls = o.ls || 3.5; if (lab) T(B, x, y, lab, { h, L: o.L }); String(lines).split('\n').forEach((l, i) => T(B, x + (o.ind || 8), y - i * ls, l, { h, L: o.L })); return y - String(lines).split('\n').length * ls - (o.gap == null ? 1.4 : o.gap); }
  // "check" finish symbol (V with class above)
  function finSym(B, x, y, lab) { Ln(B, x - 1.6, y + 2.2, x, y); Ln(B, x, y, x + 1.6, y + 2.2); T(B, x, y + 3.0, lab, { h: 2.0, al: 'c' }); }

  // ================================================================== PN30-4201 index / locality
  def('pn4201', 'Project sheets', 'Index and locality plan', 'PN30-4201', [P('br', 'Bridge No.', 'XXX'), P('town', 'Town', 'XXXX')], (p) => {
    const br = String(p.br || 'XXX'), LY = new Lay(760);
    LY.block(B => {
      // ---- locality plan (placeholder map)
      const mx = 60, my = 0, mw = 200, mh = 120;
      Box(B, mx, my, mx + mw, my - mh, 'S-TEXT');
      const road = (pts, w) => { const n = pts.length; const off = (k) => pts.map((q, i) => { const a = pts[max(0, i - 1)], b = pts[min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [mx + q[0] - k * dy / L, my - q[1] + k * dx / L]; }); PLn(B, off(w / 2), false, 'S-TEXT'); PLn(B, off(-w / 2), false, 'S-TEXT'); };
      [[[0, 30], [200, 30]], [[0, 70], [120, 60], [200, 48]], [[0, 100], [200, 85]], [[30, 0], [62, 120]], [[95, 0], [95, 120]], [[150, 0], [150, 120]], [[0, 52], [60, 52]], [[110, 30], [110, 120]]].forEach(r => road(r, 3.2));
      const rv = [[128, 0], [132, 20], [136, 40], [140, 56], [150, 74], [162, 96], [172, 120]];
      PLn(B, rv.map(q => [mx + q[0] - 1.6, my - q[1]]), false, 'S-NEW'); PLn(B, rv.map(q => [mx + q[0] + 1.6, my - q[1]]), false, 'S-NEW');
      T(B, mx + 160, my - 80, 'RIVER', { h: 2.4, ang: -60 });
      T(B, mx + 6, my - 10, 'TOWN OF ' + String(p.town || 'XXXX'), { h: 4.2, L: 'S-TITLE' });
      // bridge callout at the road / river crossing (138, 51)
      const bx = mx + 138, by = my - 51; B.E.push({ t: 'circle', c: [bx, by], r: 2.2, L: 'S-NEW' });
      Box(B, mx + 84, my - 32, mx + 116, my - 46, 'S-TITLE'); T(B, mx + 100, my - 38, 'BRIDGE', { h: 3, al: 'c', L: 'S-TITLE' }); T(B, mx + 100, my - 43.6, 'N° ' + br, { h: 3, al: 'c', L: 'S-TITLE' });
      Ln(B, mx + 116, my - 42, bx - 2, by + 1); Arrow(B, bx - 2, by + 1, Math.atan2(by + 1 - (my - 42), bx - 2 - (mx + 116)) * 180 / PI);
      north(B, mx + mw - 14, my - 30, 26);
      UT(B, mx + mw / 2, my - mh - 9, 'LOCALITY PLAN', 3.4, 'c'); T(B, mx + mw / 2 - tw('LOCALITY PLAN', 3.4) / 2, my - mh - 14, 'N.T.S.', { h: 2.0 });
      // ---- index table
      const x0 = 0, y0 = -150, h = 2.2, rh = 5.0, wl1 = 34, wl2 = 128, wr1 = 34, wr2 = 132, W = wl1 + wl2 + wr1 + wr2, xm = x0 + wl1 + wl2, xr = xm + wr1;
      const LEFT = [['9930-0425-3', 'INDEX & GENERAL INFORMATION']].concat(Array.from({ length: 13 }, (_, i) => [['9930-0426-1', '9930-0427-1', '9930-0428-2', '9930-0429-1', '9930-0430', '9930-0431-2', '9930-0432-1', '9930-0433-2', '9930-0434-1', '9930-0435-1', '9930-0436-1', '9930-0437-1', '9930-0438'][i], 'SUBSTRUCTURE & SUPERSTRUCTURE REPAIR DETAILS - SHEET N° ' + (i + 1)]),
        [['9930-0439', 'OVERLAY CONCRETE DETAILS - SHEET N° 1'], ['9930-0440', 'OVERLAY CONCRETE DETAILS - SHEET N° 2'], ['9930-0441', 'OVERLAY CONCRETE DETAILS - SHEET N° 3'], ['9930-0442', 'OVERLAY REINFORCEMENT DETAILS - SHEET N° 1'], ['9930-0443-1', 'OVERLAY REINFORCEMENT DETAILS - SHEET N° 2'], ['9930-0444', 'APPROACH SLAB CONCRETE AND REINFORCEMENT DETAILS'], ['9930-0445', 'EXPANSION JOINT DETAILS'], ['9930-0446-1', 'GUARDRAIL LAYOUT'], ['9930-0447', 'GUARDRAIL DETAILS'], ['9930-0448', 'FOOTPATH - DECK DETAILS - SHEET N° 1'], ['9930-0449', 'FOOTPATH - DECK DETAILS - SHEET N° 2'], ['9930-0450', 'FOOTPATH - BALUSTRADE ARRANGEMENT & DETAILS'], ['9930-0451-1', 'LIGHTING']]);
      const STD = [['9530-0072-5', 'PILE BAND AND CURVED WASHER FABRICATION DETAILS'], ['9030-0243-5', 'FABRIC DETAILS FOR R.C. OVERLAYS AND APPROACH SLABS'], ['9530-0216-6', 'POSTS AND COMPONENTS FABRICATION DETAILS'], ['9630-0703-3', 'FLEXBEAM DETAILS - SHEET N° 1'], ['9530-0217-5', 'FLEXBEAM DETAILS - SHEET N° 2'], ['9630-0147-5', 'TOPRAIL ASSEMBLY AND DETAILS'], ['9630-0148-4', 'TOPRAIL AND CONNECTOR FABRICATION DETAILS']];
      const INF = [['2260-3-1', 'PLAN (GENERAL ARRANGEMENT)'], ['2260-3-2', 'SECTIONS AND ELEVATIONS'], ['9230-1036-1', 'SUBSTRUCTURE REPAIR DETAILS - SHEET N° 1'], ['9230-1037-1', 'SUBSTRUCTURE REPAIR DETAILS - SHEET N° 2'], ['9230-1038-1', 'SUBSTRUCTURE REPAIR DETAILS - SHEET N° 3'], ['9530-0244', 'SUBSTRUCTURE REPAIR DETAILS - SHEET N° 1'], ['9530-0245', 'SUBSTRUCTURE REPAIR DETAILS - SHEET N° 2'], ['9530-0246', 'APPROACH SLAB DETAILS'], ['9530-0247', 'EXPANSION JOINT DETAILS'], ['0030-0308', 'PIER N° 5 - EMERGENCY REPAIRS - SHEET N° 1'], ['0030-0309', 'PIER N° 5 - EMERGENCY REPAIRS - SHEET N° 2']];
      const yH = y0 - 11, yD = yH - 7, yC = yD - 7, yb = yC - 2 - LEFT.length * rh - 1;
      Box(B, x0, y0, x0 + W, yb, 'S-TITLE');
      T(B, x0 + W / 2, y0 - 5.5, 'INDEX FOR BRIDGE N° ' + br, { h: 4.4, al: 'c', v: 'm', L: 'S-TITLE' }); Ln(B, x0, yH, x0 + W, yH, 'S-TITLE');
      T(B, x0 + W / 2, yH - 3.5, 'DRAWINGS', { h: 2.8, al: 'c', v: 'm', L: 'S-TITLE' }); Ln(B, x0, yD, x0 + W, yD, 'S-TITLE');
      T(B, x0 + wl1 / 2, yD - 3.5, 'DRAWING N°', { h: 2.6, al: 'c', v: 'm', L: 'S-TITLE' }); T(B, x0 + wl1 + wl2 / 2, yD - 3.5, 'DRAWING TITLE', { h: 2.6, al: 'c', v: 'm', L: 'S-TITLE' }); Ln(B, x0, yC, xm, yC, 'S-TITLE');
      Ln(B, x0 + wl1, yD, x0 + wl1, yb, 'S-TEXT'); Ln(B, xm, yD, xm, yb, 'S-TITLE');
      LEFT.forEach((r, i) => { const y = yC - 2 - (i + 0.5) * rh; T(B, x0 + wl1 / 2, y, r[0], { h, al: 'c', v: 'm' }); T(B, x0 + wl1 + 3, y, r[1], { h, v: 'm' }); });
      const rblock = (ytop, head, rows, nmin) => { T(B, xm + (wr1 + wr2) / 2, ytop - 3.5, head, { h: 2.8, al: 'c', v: 'm', L: 'S-TITLE' }); Ln(B, xm, ytop - 7, xm + wr1 + wr2, ytop - 7, 'S-TITLE'); T(B, xm + wr1 / 2, ytop - 10.5, 'DRAWING N°.', { h: 2.6, al: 'c', v: 'm', L: 'S-TITLE' }); T(B, xr + wr2 / 2, ytop - 10.5, 'DRAWING TITLE', { h: 2.6, al: 'c', v: 'm', L: 'S-TITLE' }); Ln(B, xm, ytop - 14, xm + wr1 + wr2, ytop - 14, 'S-TITLE'); rows.forEach((r, i) => { const y = ytop - 16 - (i + 0.5) * rh; T(B, xm + wr1 / 2, y, r[0], { h, al: 'c', v: 'm' }); T(B, xr + 3, y, r[1], { h, v: 'm' }); }); return ytop - 16 - max(nmin, rows.length) * rh - 2; };
      const ys = rblock(yD, 'STANDARD DRAWINGS', STD, 9); Ln(B, xr, yD - 7, xr, ys, 'S-TEXT'); Ln(B, xm, ys, xm + wr1 + wr2, ys, 'S-TITLE');
      rblock(ys, 'DRAWINGS FOR INFORMATION ONLY', INF, 0); Ln(B, xr, ys - 7, xr, yb, 'S-TEXT');
      // ---- placeholders for the notes and the design summary (filled in from PN30-4203 / 4202)
      const ph = (x, y, w, hh, head, l1, l2) => { Box(B, x, y, x + w, y - hh, 'S-NOTE'); UT(B, x + 4, y - 7, head, 3.0); Ln(B, x + 4, y - hh + 4, x + w - 4, y - 10, 'S-TEXT'); const a = Math.atan2(hh - 14, w - 8) * 180 / PI, cx = x + w / 2, cy = y - hh / 2 - 3; T(B, cx - 2.5 * Math.sin(a * PI / 180), cy + 2.5 * Math.cos(a * PI / 180), l1, { h: 4.2, al: 'c', ang: a }); T(B, cx + 4 * Math.sin(a * PI / 180), cy - 4 * Math.cos(a * PI / 180), l2, { h: 4.2, al: 'c', ang: a, v: 't' }); };
      ph(x0 + W + 18, 0, 150, 300, 'GENERAL NOTES', 'INSERT APPROPRIATE NOTES', 'REFER PN30-4203');
      ph(x0 + W + 186, 0, 132, 120, 'REFURBISHMENT DESIGN INFORMATION SUMMARY', 'INSERT APPROPRIATE SUMMARY', 'REFER PN30-4202');
    });
    return LY.done();
  }, 'Front sheet of a refurbishment drawing set: index of project, standard and information-only drawings with the locality plan; general notes and design summary come from PN30-4203 / 4202.');

  // ================================================================== PN30-4202 refurbishment design information summary
  def('pn4202', 'Project sheets', 'Refurbishment design information summary', 'PN30-4202', [P('code', 'Design code', 'AS 5100 BRIDGE DESIGN CODE 2004')], (p) => {
    const LY = new Lay(760);
    LY.block(B => {
      const h = 2.5, ls = 4.6, x0 = 0;
      UT(B, x0, 0, 'REFURBISHMENT DESIGN INFORMATION SUMMARY', 5.0);
      let y = -12; const L = (ind, s, o) => { T(B, x0 + 4 + ind, y, s, Object.assign({ h }, o || {})); const yy = y; y -= ls; return yy; };
      const code = String(p.code || 'AS 5100 BRIDGE DESIGN CODE 2004'), m = /^(.*?) (DESIGN CODE.*)$/.exec(code), c1 = m ? m[1] : code, c2 = m ? m[2] : '';
      L(0, '1.  DESIGN IN ACCORDANCE WITH ' + c1); if (c2) L(5, c2 + '.'); y -= 1.2;
      L(0, '2.  DEAD LOADS AS PER CODE.'); y -= 1.2;
      L(0, '3.  TRAFFIC LOADS :');
      L(3, '3.1.  DESIGN VEHICLES');
      L(12, 'T44  - XXX%'); const ySM = L(12, 'SM1600  - XXX%'); L(12, 'HLP320  - XXX%');
      [1, 2, 3, 4].forEach(k => L(12, 'GROUP 1 VEHICLE ' + k + '  - XXX%'));
      L(3, '3.2.  LOAD RATING DURING LANE RESTRICTIONS');
      const bxL = x0 + 12, bxR = x0 + 118;
      y -= 1; const yr0 = y + ls - 0.6; L(10, 'TYPE OF RESTRICTION  -      XXXXXXXXXXXXXXX'); L(17, 'XXXXXXXXXXXXXXXXX'); const yr1 = y + ls - 2.2; Box(B, bxL, yr0, bxR, yr1, 'S-NOTE'); y -= 1.2;
      L(12, 'T44 STANDARD LOADING  - XXX%'); y -= 1;
      const yn0 = y + ls - 0.6; L(12, 'HLP320 CONSTRUCTION versus HLP320 CENTRAL (PRE-'); L(12, 'REFURBISHMENT) = XXX%'); y -= 1.2; L(12, 'GROUP 2 VEHICLE 5 CONSTRUCTION versus GROUP 2'); L(12, 'VEHICLE 5 (PRE-REFURBISHMENT) = XXX%'); const yn1 = y + ls - 2.2; Box(B, bxL, yn0, bxR, yn1, 'S-NOTE'); y -= 1.6;
      y -= 1; const yt0 = y + ls - 0.6; L(12, 'HLP320 = XXX%'); y -= 1.2; L(12, 'GROUP 2 VEHICLE 5 = XXX%'); const yt1 = y + ls - 2.2; Box(B, bxL, yt0, bxR, yt1, 'S-NOTE');
      L(0, '4.  BARRIERS :'); L(5, 'AS 5100 XXXX PERFORMANCE LEVEL BARRIERS.');
      const ob = [x0, -7, x0 + 128, y + 1]; Box(B, ob[0], ob[1], ob[2], ob[3], 'S-NOTE');
      // SM1600 bracket and the right-hand designer callouts
      const smx = x0 + 16 - 0.6, smw = tw('SM1600', h) + 1.2; Box(B, smx, ySM - 1, smx + smw, ySM + h + 1, 'S-NOTE');
      const cx = ob[2] + 14, call = (yy, s, from) => { dashTo(B, [from, yy], [cx, yy]); NB(B, cx, yy + 2.6, s, { h, solid: false }); };
      dashTo(B, [smx + smw, ySM + h + 1], [smx + smw + 2, ySM + h + 1.6]); call(ySM + h + 1.6, 'CHANGE TO REFLECT\nCONTROLLING VEHICLE', smx + smw + 2); call((yr0 + yr1) / 2, 'REFER TO NOTE 2', bxR); call((yn0 + yn1) / 2, 'FOR NON-TIMBER STRUCTURES', bxR); call((yt0 + yt1) / 2, 'FOR TIMBER STRUCTURES', bxR);
      // engineer's note box under, linked by a dashed line
      const ny = ob[3] - 14, nx = x0 + 12; dashTo(B, [x0 + 60, ob[3]], [x0 + 60, ny]);
      const NL = ['ENGINEER TO PROVIDE ACTUAL DESIGN DATA FOR', 'EACH INDIVIDUAL BRIDGE & DELETE IRRELEVANT', 'INFORMATION.'];
      let yy = ny - 6; NL.forEach(s => { T(B, nx + 4, yy, s, { h }); yy -= ls; }); yy -= 1; UT(B, nx + 4, yy, 'NOTES :-', h, 'l', 'S-TEXT'); yy -= ls + 0.6;
      [['1.', 'VALUES FOR DESIGN VEHICLES ARE NOT TO\nEXCEED 100% (e.g. IF DESIGN T44 IS 132%\nTHEN T44 ABOVE TO BE NOTED 100%).'], ['2.', 'TYPE OF RESTRICTION MUST STATE THE\nCONSTRUCTION CONFIGURATION (e.g. TEMPORARY\nLANE 3.7m WIDE ADJACENT TO LHS OR RHS\nKERB).'], ['3.', 'FOR NON-TIMBER STRUCTURES, LOAD RATING\nDURING LANE RESTRICTIONS SHALL BE ACTUAL\nVALUES.'], ['4.', 'FOR TIMBER STRUCTURES, LOAD RATING DURING\nLANE RESTRICTIONS SHALL NOT EXCEED 100%.']].forEach(([n, s]) => { yy = para(B, nx + 5, yy, n, s, { h, ls, ind: 6, gap: 0.4 }); });
      Box(B, nx, ny, nx + 112, yy + 1, 'S-NOTE');
    });
    return LY.done();
  }, 'Design data summary for the front sheet: design code, traffic load ratings (design vehicles and during lane restrictions) and barrier level; the engineer completes it for each bridge.');

  // ================================================================== PN30-4203 general notes / general maintenance
  def('pn4203', 'Project sheets', 'General notes and general maintenance', 'PN30-4203', [P('lane', 'Lane open to traffic (m)', 'xxx', {})], (p) => {
    const LY = new Lay(760);
    LY.block(B => {
      const h = 2.3, ls = 3.4, X1 = 0, X2 = 200;
      const H = (x, y, s) => { T(B, x, y, s, { h: 2.5, L: 'S-TITLE' }); return y - 5.2; };
      const Pp = (x, y, n, s, ind) => para(B, x, y, n, s, { h, ls, ind: ind || 8, gap: 1.5 });
      // ---- left column
      UT(B, X1, 0, 'GENERAL NOTES', 5.4);
      let y = -12; y = H(X1 + 1, y, '1.   GENERAL');
      const y11 = y; y = Pp(X1 + 6, y, '1.1', 'ALL  WORKS SHALL BE CARRIED OUT IN ACCORDANCE WITH THE\nSPECIFICATION AND THE OCCUPATIONAL SAFETY AND HEALTH ACT 1984.');
      const ox = X1 + 14 + tw('SPECIFICATION AND THE ', h), oy = y11 - ls; Box(B, ox - 0.8, oy - 1, ox + tw('OCCUPATIONAL SAFETY AND HEALTH ACT 1984.', h) + 0.8, oy + h + 1, 'S-NOTE');
      y = Pp(X1 + 6, y, '1.2', 'NO CHANGES TO DESIGN DETAILS SHALL BE ADOPTED DURING CONSTRUCTION\nWITHOUT WRITTEN APPROVAL OF THE DESIGN ENGINEER.');
      y = Pp(X1 + 6, y, '1.3', 'THE BRIDGE SHALL RECEIVE PREVENTATIVE AND PRESERVATION MAINTENANCE IN\nACCORDANCE WITH THE SPECIFICATION.');
      y = Pp(X1 + 6, y, '1.4', 'DIMENSIONS SHALL NOT BE SCALED FROM THE DRAWINGS.');
      y -= 1.5; y = H(X1 + 1, y, '2.   CONCRETE');
      y = Pp(X1 + 6, y, '2.1', 'CONCRETE SHALL BE CLASS S40 IN ACCORDANCE WITH THE SPECIFICATION.');
      y = Pp(X1 + 6, y, '2.2', 'CONCRETE SURFACE FINISHES SHALL BE IN ACCORDANCE WITH THE SPECIFICATION.');
      T(B, X1 + 6, y, '2.3', { h }); T(B, X1 + 14, y, 'ABBREVIATIONS USED:-', { h });
      finSym(B, X1 + 62, y - 3.6, 'N°'); T(B, X1 + 70, y - 3.4, 'FORMED FINISH CLASS N°.', { h }); finSym(B, X1 + 62, y - 10.6, 'UN°'); T(B, X1 + 70, y - 10.4, 'UNFORMED FINISH CLASS N°.', { h }); y -= 17;
      y = H(X1 + 1, y, '3.   REINFORCEMENT');
      y = Pp(X1 + 6, y, '3.1', 'CLEAR COVER TO REINFORCEMENT SHALL BE 40 mm UNLESS OTHERWISE SHOWN.');
      y = Pp(X1 + 6, y, '3.2', 'BAR LAP LENGTH SHALL BE A MINIMUM OF 40D AND A MAXIMUM OF 40D+150\nUNLESS OTHERWISE SHOWN.');
      y = Pp(X1 + 6, y, '3.3', 'FABRIC OVERLAP SHALL BE A MINIMUM OF TWO CROSS WIRES ON BOTH SHEETS\nUNLESS OTHERWISE SHOWN.');
      y = Pp(X1 + 6, y, '3.4', 'ABBREVIATIONS USED:-', 8);
      [['NF', '- NEAR FACE'], ['FF', '- FAR FACE'], ['T', '- TOP'], ['B', '- BOTTOM'], ['ES', '- EQUALLY SPACED']].forEach(([a, b]) => { T(B, X1 + 56, y + 1.2, a, { h }); T(B, X1 + 64, y + 1.2, b, { h }); y -= ls; }); y -= 1;
      y = Pp(X1 + 6, y, '3.5', 'REINFORCEMENT SHALL CONFORM TO:-');
      [['SL', '- 500 MPa MESH TO AS/NZS 4671.'], ['N', '- 500 MPa REINFORCING BARS TO AS/NZS 4671.'], ['R', '- 250 MPa PLAIN BARS TO AS/NZS 4671.']].forEach(([a, b]) => { T(B, X1 + 56, y + 1.2, a, { h }); T(B, X1 + 64, y + 1.2, b, { h }); y -= ls; }); y -= 2;
      y = H(X1 + 1, y, '4.   STEELWORK');
      y = Pp(X1 + 6, y, '4.1', 'ALL WELDING SHALL BE STRUCTURAL PURPOSE IN ACCORDANCE WITH AS/NZS 1554\nAND THE SPECIFICATION.');
      y = Pp(X1 + 6, y, '4.2', 'ALL BOLTS AND THREADED RODS SHALL BE SUPPLIED WITH NUTS & WASHERS.\nHIGH STRENGTH GRADE 8.8 BOLTS, NUTS AND WASHERS SHALL BE IN ACCORDANCE\nWITH AS/NZS 1252.\nALL OTHER BOLTING, NUTS AND WASHERS SHALL BE COMMERCIAL GRADE (GRADE 4.6S)\nIN ACCORDANCE WITH AS 1111 AND AS 1112.');
      y = Pp(X1 + 6, y, '4.3', 'ALL THREADED ROD SHALL BE DIAMETER 20 UNLESS OTHERWISE SHOWN AND SHALL\nBE GRADE 300 IN ACCORDANCE WITH AS/NZS 3679.1.');
      y = Pp(X1 + 6, y, '4.4', 'AFTER FABRICATION STEELWORK SHALL BE HOT-DIP GALVANISED AS FOLLOWS:');
      y += 1.5; y = Pp(X1 + 14, y, '4.4.1', 'BOLTS, NUTS, COACH SCREWS, WASHERS, SPIKES AND THREADED RODS IN\nACCORDANCE WITH AS 1214. AFTER GALVANISING ALL THREADED COMPONENTS\nSHALL BE ABLE TO BE ASSEMBLED BY HAND.', 11); y += 1.5;
      y = Pp(X1 + 14, y, '4.4.2', 'ALL OTHER STEELWORK IN ACCORDANCE WITH AS/NZS 4680.', 11);
      y = Pp(X1 + 6, y, '4.5', 'DAMAGED GALVANISING SHALL BE TREATED BY A SUITABLE COLD GALVANISING\nPROCESS IN ACCORDANCE WITH THE SPECIFICATION, EXCEPT WHERE EMBEDED IN\nCONCRETE BY MORE THAN 50mm.');
      y = Pp(X1 + 6, y, '4.6', 'UNLESS OTHERWISE SPECIFIED ALL STRUCTURAL STEEL SECTIONS SHALL BE MINIMUM\nGRADE 300 IN ACCORDANCE WITH AS/NZS 3679.1.');
      y = Pp(X1 + 6, y, '4.7', 'ALL STRUCTURAL STEEL HOLLOW SECTIONS SHALL BE MINIMUM GRADE C350 IN\nACCORDANCE WITH AS 1163.');
      y = Pp(X1 + 6, y, '4.8', 'ALL STRUCTURAL STEEL PLATE SHALL BE MINIMUM GRADE 250 IN ACCORDANCE\nWITH AS/NZS 3678.');
      y = Pp(X1 + 6, y, '4.9', 'ALL STRUCTURAL STEEL FLAT (MERCHANT BAR) SHALL BE MINIMUM GRADE 300\nIN ACCORDANCE WITH AS/NZS 3679.1.');
      y = Pp(X1 + 6, y, '4.10', 'FABRICATION SHALL COMPLY WITH THE REQUIREMENTS OF AS 4100 SECTION 14 & 15\nSTEEL STRUCTURES.');
      y -= 1.5; y = H(X1 + 1, y, '5.   TIMBERWORK');
      y = Pp(X1 + 6, y, '5.1', 'ALL NEW BOLTS THROUGH TIMBER ELEMENTS SHALL BE COATED WITH DENSOPASTE\nAND ALL EXPOSED THREADS AND NUTS SHALL BE COATED WITH DENSOPASTE\nFOLLOWING TIGHTENING OF NUTS IN ACCORDANCE WITH THE SPECIFICATION.');
      // ---- right column
      const nb = NB(B, X2 - 26, 4, 'NOTE :-  THE DESIGNER IS REQUIRED TO\nPROVIDE AN O.S.H. RISK ASSESSMENT\nTHE CLIENT REFER, TO PN30-4213.', { h });
      dashTo(B, [nb[0], nb[1] + 5], [ox + tw('OCCUPATIONAL SAFETY AND HEALTH ACT 1984.', h) + 0.8, oy + h + 1]);
      y = -18; y = H(X2, y, '6.   EMBANKMENT FORMATION (WHERE WIDENING IS REQUIRED)');
      y = Pp(X2 + 5, y, '6.1', 'FORMATION WIDENING WHERE REQUIRED SHALL BE CONSTRUCTED IN ACCORDANCE\nWITH THE SPECIFICATION.');
      y = Pp(X2 + 5, y, '6.2', 'THE FACE OF EXISTING EMBANKMENT SHALL BE BENCHED.');
      y = Pp(X2 + 5, y, '6.3', 'THE FILL SHALL BE PLACED AND COMPACTED IN LAYERS AND FINAL BATTERS\nTRIMMED TO SPECIFIED TOLERANCES.');
      y = Pp(X2 + 5, y, '6.4', 'THE MINIMUM LEVEL OF COMPACTION SHALL NOT BE LESS THAN THAT GIVEN\nIN THE SPECIFICATION.');
      const b7 = y + 1; y -= 2.5; y = H(X2 + 3, y, '7.   TRAFFIC MANAGEMENT');
      const lane = String(p.lane || 'xxx'); y = Pp(X2 + 8, y, '7.1.', 'CONCRETE OVERLAY WORKS SHALL BE CONSTRUCTED IN TWO HALVES\nWITH ONE ' + lane + 'm LANE OPEN TO TRAFFIC AT ALL TIMES.', 9);
      const lx = X2 + 17 + tw('WITH ONE ', h), yl = y + 1.5 + ls; Box(B, lx - 0.7, yl - 0.9, lx + tw(lane + 'm', h) + 0.7, yl + h + 0.9, 'S-TEXT');
      const b72 = y + h + 1.2; y = Pp(X2 + 8, y, '7.2', 'THE CONTRACTOR SHALL ENSURE THAT THE TRAFFIC MANAGEMENT PLAN\nALLOWS FOR SPEED RESTRICTIONS TO ENSURE A MAXIMUM SPEED OF 40kph.', 9);
      const b72b = y + 1.5 + ls - 1.2, bR = X2 + 5 + 9 + tw('ALLOWS FOR SPEED RESTRICTIONS TO ENSURE A MAXIMUM SPEED OF 40kph.', h) + 3; Box(B, X2 + 6, b72, bR, b72b, 'S-NOTE');
      Box(B, X2, b7, bR + 6, b72b - 2.5, 'S-NOTE');
      const c1 = NB(B, bR + 16, b7 + 21, 'ONLY REQUIRED FOR CONCRETE\nOVERLAYS BRIDGE OPEN TO\nTRAFFIC DURING WORKS', { h }); dashTo(B, [c1[0] + 6, c1[1]], [bR + 3, b7]);
      const c2 = NB(B, bR + 16, b72b - 8, 'ONLY IF REQUIRED FOR STRUCTURAL\nREASONS I.E. CONCRETE CURING\nOR STRUCTURE STABILITY', { h }); dashTo(B, [c2[0] + 4, c2[3]], [bR, b72b + 1]);
      y = b72b - 28; UT(B, X2 + 8, y, 'GENERAL MAINTENANCE', 5.4); y -= 12;
      const M = (n, s) => { const y0 = y; y = para(B, X2 + 10, y, n, s, { h, ls, ind: 10, gap: 2.4 }); return y0; };
      M('1.', 'WHERE THE EXTENT OF DETERIORATION OF STRUCTURAL ELEMENTS IS\nFOUND ON SITE TO DIFFER FROM THE SCOPE SHOWN ON THE DRAWINGS,\nTHE CONTRACTOR SHALL ADVISE THE SUPERINTENDENT\'S REPRESENTATIVE\nIMMEDIATELY, SO THAT THE CONTRACTOR CAN BE ADVISED OF ANY\nADDITIONAL WORK REQUIRED TO BE CARRIED OUT.');
      const y2 = M('2.', 'GENERAL MAINTENANCE SHALL BE CARRIED OUT IN ACCORDANCE WITH THE\nSPECIFICATION AND FOR EXTENT OF WORK REFER TO THE "PREVENTATIVE\nMAINTENANCE WORK TABLE" ON DRAWING N° XX30-XXXX.');
      { const x = X2 + 20 + tw('MAINTENANCE WORK TABLE" ON DRAWING N° ', h); Box(B, x - 0.8, y2 - 2 * ls - 1, x + tw('XX30-XXXX.', h) + 0.8, y2 - 2 * ls + h + 1, 'S-NOTE'); }
      M('3.', 'ALL BOLTED AND THREADED ROD CONNECTIONS NOT COVERED BY CLAUSE\n850.30 SHALL BE TIGHTENED AND TREATED IN ACCORDANCE WITH CLAUSES\n850.34 & 850.35. WHEN FASTENERS HAVE \'FUSED\' ONTO THE THREAD AND\nCANNOT BE LOOSENED, FASTENER REPLACEMENT SHALL BE UNDERTAKEN IN\nACCORDANCE WITH CLAUSE 850.30.');
      M('4.', 'ALL HOLES WITHOUT BOLTS IN EXISTING TIMBER ELEMENTS WITHIN 1.5m OF\nGROUND LINE OR WATER LINE, SHALL BE FILLED WITH CONBEXTRA EP GROUT\nOR SIMILAR APPROVED.');
      M('5.', 'THE ENDS OF ALL NEWLY CUT SURFACES OF EXISTING TIMBER, SHALL\nRECEIVE END GRAIN TREATMENT IN ACCORDANCE WITH THE SPECIFICATION.');
      M('6.', 'INSTALL 4 NEW BRIDGE WIDTH MARKERS.');
      const bw = X2 + 20 + tw('EXISTING ROAD MARKINGS TO BE REPLACED ON PROPOSED BRIDGE WORKS', h) + 3;
      const y7 = M('7.', 'EXISTING ROAD MARKINGS TO BE REPLACED ON PROPOSED BRIDGE WORKS\nWITH MATCHING MARKINGS REFER TO SPECIFICATION.'); Box(B, X2 + 6, y7 + h + 1.2, bw, y7 - ls - 1.2, 'S-NOTE');
      const y8 = M('8.', 'INSTALL NEW SCUPPER FLASHINGS TO ALL EXISTING SCUPPERS,\nFOR DETAILS OF SCUPPER FLASHINGS REFER TO DRG N° XX30-XXXX.');
      { const x = X2 + 20 + tw('FOR DETAILS OF SCUPPER FLASHINGS REFER TO DRG N° XX3', h); Box(B, x, y8 - ls - 1, x + tw('0-XXXX.', h) + 2, y8 - ls + h + 1, 'S-NOTE'); }
      const y9 = M('9.', 'DISCARDED TIMBER AND STEELWORK (e.g. \'W\' BEAMS, PILE BANDS etc.) IN\nGOOD CONDITION SHALL BE TRANSPORTED TO M.R.W.A. BUNBURY DEPOT\nAND NEATLY STOCKPILED.'); Box(B, X2 + 6, y9 + h + 1.2, bw, y9 - 2 * ls - 1.2, 'S-NOTE');
      const c3 = NB(B, bw + 12, y7 - 1, 'ONLY REQUIRED FOR NEW\nCONCRETE OVERLAY WITH\nNO SEAL', { h }); dashTo(B, [bw, y7 - ls], [c3[0], c3[3] - 3]);
      const c4 = NB(B, bw + 12, y9 - ls + 3, 'SOUTH WEST REGION ONLY', { h }); dashTo(B, [bw, y9 - ls], [c4[0], (c4[1] + c4[3]) / 2]);
    });
    return LY.done();
  }, 'Project general notes (concrete, reinforcement, steelwork, timberwork, embankment, traffic management) and general maintenance requirements for a refurbishment drawing set.');

  // ================================================================== PN30-4204 preventative maintenance work table
  def('pn4204', 'Project sheets', 'Preventative maintenance work table', 'PN30-4204', [], () => {
    const LY = new Lay(760);
    LY.block(B => {
      const h = 2.3, ls = 3.5, c = [70, 60, 38], X = [0, c[0], c[0] + c[1], c[0] + c[1] + c[2]];
      const R = [['850.28\n(REPAIR OF SPLIT PILES)', 'PILES NOTED IN TABLE', '021'], ['850.29\n(REPAIR OF SPLIT STRINGERS\nAND CORBELS)', 'STRINGERS AND CORBELS\nNOTED IN TABLE', '022'], ['850.30\n(INSTALLATION OF\nBOLTED AND THREADED\nROD CONNECTIONS)', 'ALL NEW AND REPLACEMENT\nBOLTS AND THREADED RODS', '012'], ['850.34\n(FASTENER MAINTENANCE)\n850.35\n(BOLT TIGHTENING)', 'ALL EXISTING BOLTS AND\nFASTENERS', '012'], ['850.36\n(WALINGS AND BRACING)', 'ALL EXISTING WALINGS AND\nBRACING', '-'], ['850.41.07\n(PRESERVATION TREATMENT OF\nTIMBER DECKING)', 'ALL TIMBER DECK PLANKS', '014'], ['850.93.01\n(TIMBER END GRAIN SEALING)', 'ALL EXPOSED TIMBER END\nGRAIN AND ALL NEWLY CUT\nSURFACES OF EXISTING\nTIMBER', '011'], ['850.93.02\n(ROUTINE MAINTENANCE OF\nOUTSIDE TIMBER STRINGERS)', 'ALL OUTSIDE TIMBER\nSTRINGERS', '016'], ['850.93.03\n(FUNGICIDE TREATMENT\nOF TIMBER STRINGERS)', 'ALL INTERNAL STRINGERS', '015'], ['850.93.04\n(FUNGICIDE TREATMENT\nOF TIMBER PILES)', 'ALL PILES AT GROUND LINE\nOR 1.0m ABOVE WATER LINE', '013\n013a'], ['850.93.05\n(FUNGICIDE TREATMENT OF\nBEDLOGS AND BEARERS)', 'ALL BEDLOGS AND BEARERS', '018'], ['850.93.06\n(FUNGICIDE TREATMENT OF\nHALFCAPS)', 'ALL HALFCAPS', '-'], ['850.93.07\n(DECK DRAINAGE MAINTENANCE)', 'EXISTING DECK DRAINAGE', '032'], ['850.93.08\n(VEGETATION AND DEBRIS\nCLEARING UNDER BRIDGES)', 'CONTROL AREA AS SPECIFIED', '034'], ['850.93.09\n(TERMITE TREATMENT\nAND ERADICATION)', 'TREAT ENTIRE BRIDGE\nSTRUCTURE', '042'], ['850.43\n(SITE CLEAN-UP)', 'CLEAN-UP AT COMPLETION\nOF WORKS', '-'], ['850.93.11\n(TIMBER HANDRAIL\nMAINTENANCE)', 'ALL TIMBER HANDRAILS', '031']];
      const W = X[3]; let y = 0; Ln(B, 0, y, W, y, 'S-TITLE');
      const cell = (j, s, yc, al) => { const L = s.split('\n'); L.forEach((l, k) => T(B, al === 'l' ? X[j] + 3 : X[j] + c[j] / 2, yc + (L.length - 1) * ls / 2 - k * ls, l, { h, al: al || 'c', v: 'm' })); };
      const hh = 12; cell(0, 'CLAUSE NUMBER', y - hh / 2); cell(1, 'DESCRIPTION', y - hh / 2); cell(2, 'REFERENCE ACTIVITY\nCODE NUMBER  *', y - hh / 2); y -= hh; Ln(B, 0, y, W, y, 'S-TITLE');
      R.forEach(r => { const n = max(...r.map(s => s.split('\n').length)), rh = max(n, 2) * ls + 5; cell(0, r[0], y - rh / 2); cell(1, r[1], y - rh / 2, 'l'); cell(2, r[2], y - rh / 2); y -= rh; Ln(B, 0, y, W, y, 'S-TEXT'); });
      [X[1], X[2]].forEach(x => Ln(B, x, 0, x, y, 'S-TEXT'));
      T(B, 3, y - 4.5, "*  ACTIVITY CODE NUMBERS REFER TO THE ACTIVITIES LISTED IN THE MRWA\n    'TIMBER BRIDGE PREVENTATIVE MAINTENANCE STANDARDS' DOCUMENT\n    No. 6706/02/2226 WHICH IS AVAILABLE \"FOR INFORMATION ONLY\".", { h, ls: 1.5 });
      y -= 16; Box(B, 0, 0, W, y, 'S-TITLE');
      UT(B, W / 2, y - 14, 'PREVENTATIVE MAINTENANCE WORK TABLE', 4.0, 'c');
    });
    return LY.done();
  }, 'Maintenance specification clauses with the work they cover and the preventative-maintenance activity codes, for the general maintenance notes (PN30-4203 note 2).');

  // ================================================================== PN30-4205 legend of plan symbols
  def('pn4205', 'Project sheets', 'Legend – plan symbols for repairs', 'PN30-4205', [P('ref', 'Detail drawing ref', 'XX30-XXXX')], (p) => {
    const LY = new Lay(760), ref = String(p.ref || 'XX30-XXXX');
    LY.block(B => {
      const h = 2.8, sx = 16, tx = 30, dy = 14.5;
      const circ = (x, y, r, L) => B.E.push({ t: 'circle', c: [x, y], r, L: L || 'S-NEW' });
      const disc = (x, y, r) => { const n = 24, pts = Array.from({ length: n }, (_, i) => [x + r * Math.cos(2 * PI * i / n), y + r * Math.sin(2 * PI * i / n)]); Fill(B, pts, 'S-NEW'); circ(x, y, r); };
      const Ibeam = (x, y, s) => { Ln(B, x - s, y + s * 1.1, x + s, y + s * 1.1, 'S-NEW'); Ln(B, x - s, y - s * 1.1, x + s, y - s * 1.1, 'S-NEW'); Ln(B, x, y - s * 1.1, x, y + s * 1.1, 'S-NEW'); };
      const sw = 10, shh = 4.4, hrect = (x, y) => { const pts = [[x - sw / 2, y - shh / 2], [x + sw / 2, y - shh / 2], [x + sw / 2, y + shh / 2], [x - sw / 2, y + shh / 2]]; Box(B, pts[0][0], pts[2][1], pts[2][0], pts[0][1], 'S-NEW'); return pts; };
      const S = [
        ['PILE TO BE BANDED/MULTIBANDED', (x, y) => { circ(x, y, 2.6); circ(x, y, 1.8); circ(x, y, 1.2); }],
        ['PIER PILE REPAIR DETAIL - TYPE 1', (x, y) => disc(x, y, 2.4)],
        ['PIER PILE REPAIR DETAIL - TYPE 2', (x, y) => { disc(x, y, 2.4); Ln(B, x - 4.2, y, x + 4.2, y, 'S-NEW'); }],
        ['PIER PILE REPAIR DETAIL - TYPE 3', (x, y) => { circ(x, y, 2.4); Ln(B, x - 4.2, y, x + 4.2, y, 'S-NEW'); }],
        ['PIER PILE REPAIR DETAIL - TYPE 4', (x, y) => { circ(x, y, 2.4); Ln(B, x - 4.2, y, x + 4.2, y, 'S-NEW'); Ln(B, x, y - 4, x, y + 4, 'S-NEW'); }],
        ['PIER PILE REPAIR DETAIL - TYPE 5', (x, y) => { circ(x, y, 2.4); const k = 2.4 * Math.SQRT1_2; Ln(B, x - k, y - k, x + k, y + k, 'S-NEW'); Ln(B, x - k, y + k, x + k, y - k, 'S-NEW'); Ln(B, x - 1.2, y + 3, x + 1.2, y + 3, 'S-NEW'); }],
        ['PIER PILE STRENGTHENING DETAILS', (x, y) => { Ibeam(x - 3, y, 1.8); disc(x + 2, y, 2.4); }],
        ['ABUTMENT PILE REPAIR DETAIL - TYPE 1', (x, y) => Fill(B, [[x - 2.4, y - 2.4], [x + 2.4, y - 2.4], [x + 2.4, y + 2.4], [x - 2.4, y + 2.4]], 'S-NEW')],
        ['ABUTMENT PILE REPAIR DETAIL - TYPE 2', (x, y) => { Box(B, x - 2.2, y + 2.2, x + 2.2, y - 2.2, 'S-NEW'); Ln(B, x - 4.4, y, x + 4.4, y, 'S-NEW'); Ln(B, x, y - 4.2, x, y + 4.2, 'S-NEW'); }],
        ['WINGWALL PILE REPAIR DETAIL - TYPE 1', (x, y) => Fill(B, [[x - 2.6, y - 2.2], [x + 2.6, y - 2.2], [x, y + 2.6]], 'S-NEW')],
        ['WINGWALL PILE REPAIR DETAIL - TYPE 2', (x, y) => Fill(B, [[x, y - 3.2], [x + 1.8, y], [x, y + 3.2], [x - 1.8, y]], 'S-NEW')],
        ['WINGWALL PILE REPAIR DETAIL - TYPE 3', (x, y) => PLn(B, [[x - 2.6, y - 2.2], [x + 2.6, y - 2.2], [x, y + 2.6]], true, 'S-NEW')],
        ['PROPOSED DRIVEN STEEL PILE', (x, y) => Ibeam(x, y, 2.2)],
        ['ABUTMENT/WINGWALL SHEETING REPAIR DETAIL', (x, y) => { const pts = hrect(x, y); B.E.push({ t: 'hatch', p: pts, pat: 'ansi31', sc: 0.6, L: 'S-HATCH' }); }],
        ['ABUTMENT/WINGWALL SHEETING REPAIR DETAIL', (x, y) => { hrect(x, y); for (let k = 1; k < 10; k++) Ln(B, x - sw / 2 + k, y - shh / 2, x - sw / 2 + k, y + shh / 2, 'S-HATCH'); }],
        ['ABUTMENT/WINGWALL SCOUR REPAIR DETAIL', (x, y) => { const pts = hrect(x, y); B.E.push({ t: 'hatch', p: pts, pat: 'ansi37', sc: 0.6, L: 'S-HATCH' }); }],
        ['ROCK PROTECTION', (x, y) => { hrect(x, y); [[-3.4, 0.6], [-0.6, -0.8], [2.4, 0.7], [3.9, -1.0], [-2.2, -1.3], [0.9, 1.3]].forEach(([a, b], i) => B.E.push({ t: 'pl', p: ellP(x + a, y + b, 1.3 - (i % 2) * 0.3, 0.8, 8), closed: true, L: 'S-HATCH' })); }]
      ];
      const Hh = S.length * dy + 22, Ww = 150; Box(B, 0, 0, Ww, -Hh, 'S-TITLE');
      UT(B, 16, -10, 'LEGEND', 3.4, 'l', 'S-TEXT');
      S.forEach(([s, f], i) => { const y = -22 - i * dy; f(sx, y); T(B, tx, y - 0.6, s, { h }); T(B, tx, y - 5.6, ref, { h }); });
    });
    return LY.done();
  }, 'Legend of the plan symbols used on the general arrangement to locate each repair type, with the project drawing on which the detail is shown.');

  // ================================================================== PN30-4206 surface drain
  def('pn4206', 'Deck & overlay', 'Surface drain at abutment', 'PN30-4206', [P('X', 'Dimension X – kerb to toe of batter (mm)', 'X'), P('XX', 'Dimension XX – along kerb (mm)', 'XXXX')], (p) => {
    const LY = new Lay(520), v = LY.view(100), B = v.B, sX = String(p.X || 'X'), sXX = String(p.XX || 'XXXX');
    const yG = 4900, yC = 730, xK = 5600;
    // toe of batter (ground line, slightly wavy)
    v.pl([[-3800, yG - 40], [-2400, yG + 30], [-900, yG - 20], [0, yG + 10], [1400, yG - 40], [2800, yG + 20], [4300, yG - 30], [6200, yG + 20]], false, 'S-GROUND');
    // grouted rock protection, semicircle on the drain outlet
    const R = 700; v.pl(Array.from({ length: 25 }, (_, i) => [R * Math.cos(PI * i / 24), yG + R * 0.75 * Math.sin(PI * i / 24)]), false, 'S-NEW'); v.line(-R, yG, R, yG, 'S-NEW');
    [[-430, 160, 200, 130], [-80, 140, 190, 120], [300, 160, 190, 140], [-300, 430, 180, 110], [120, 420, 200, 110], [-560, 70, 110, 60], [560, 80, 110, 60], [0, 600, 160, 70]].forEach(([x, y, a, b]) => v.pl(ellP(x, yG + y, a, b, 7), true, 'S-NEW'));
    // spoon drain (with break) into the insitu kerb
    const seg = (y0, y1) => { [-280, -200, 200, 280].forEach(x => v.line(x, y0, x, y1, 'S-NEW')); };
    seg(yG, 3150); seg(2520, yC); v.line(0, yG + 900, 0, 2520, 'S-CL'); v.line(0, 2520, 0, -500, 'S-CL');
    v.brk(-380, 3150, 380, 3150); v.brk(-380, 2520, 380, 2520);
    v.text(0, yG + 1000, '℄', 2.6, 'c');
    const arc = Array.from({ length: 13 }, (_, i) => { const a = PI + PI / 2 * i / 12; return [1195 + 930 * Math.cos(a), yC + 930 * Math.sin(a)]; });
    const kp = [[-280, yC], [265, yC]].concat(arc).concat([[xK, -200], [xK, -830], [-280, -830]]);
    v.pl(kp, true, 'S-CONC'); v.hatch(kp, 'gravel', 'S-HATCH', 0.6); v.line(-280, yC, -280, -830, 'S-CONC');
    // traffic barrier (W-beam) and posts
    v.line(-3600, 0, 6300, 0, 'S-NEW'); v.line(-3600, 60, 6300, 60, 'S-NEW'); v.arrow(-3600, 30, 180); v.arrow(6300, 30, 0);
    const posts = [-3000, -1000, 1000, 3000, 5000]; posts.forEach(x => { v.line(x, 0, x, 300, 'S-NEW'); v.line(x, 300, x + 150, 300, 'S-NEW'); v.line(x, 200, x + 100, 200, 'S-NEW'); });
    // dimensions
    v.dimChain([[-1000, 0], [0, 0], [1000, 0]], -12, ['=', '=']);
    v.dim(0, -830, xK, -830, -16, ''); vXB(v, xK / 2 - 400, -2580, sXX, { al: 'c', h: 2.4 });
    v.line(xK, -830, xK, -2600, 'S-DIM'); { const a = v.P(xK, -2430), b = v.P(xK + 2400, -2430); Ln(B, a[0], a[1], b[0], b[1], 'S-DIM'); Arrow(B, b[0], b[1], 0, 'S-DIM', 2.2, 0.7); Arrow(B, a[0], a[1], 180, 'S-DIM', 2.2, 0.7); T(B, (a[0] + b[0]) / 2, a[1] + 1, 'DECK', { h: 2.4, al: 'c' }); }
    { const a = v.P(-1900, yG), b = v.P(-1900, yC); v.line(-1900, yG, -280, yG, 'S-DIM'); v.line(-1900, yC, -400, yC, 'S-DIM'); Ln(B, a[0], a[1], a[0], a[1] - 9, 'S-DIM'); PLn(B, [[a[0], a[1] - 9], [a[0] + 1, a[1] - 10], [a[0] - 1, a[1] - 11], [a[0], a[1] - 12]], false, 'S-DIM'); Ln(B, a[0], a[1] - 12, b[0], b[1], 'S-DIM'); Arrow(B, a[0], a[1], 90, 'S-DIM', 2.2, 0.7); Arrow(B, b[0], b[1], -90, 'S-DIM', 2.2, 0.7);
      const xb = XB(B, a[0], (a[1] + b[1]) / 2 - 3, sX, { al: 'c', h: 2.4 }); const nb = NB(B, a[0] - 34, a[1] + 14, 'DIMENSION  X  SHALL BE\nDETERMINED BY ENGINEER', { h: 2.4 }); dashTo(B, [nb[0] + 16, nb[1]], [xb[0], xb[3]]); }
    { const xb = v.P(xK / 2 + 300, -2420); const nb = NB(B, xb[0] + 14, xb[1] - 12, 'DIMENSION XX SHALL BE:-\n1.  1000 MIN. FROM END OF WINGWALL OR\n2.  AS ADVISED BY ENGINEER.', { h: 2.4 }); dashTo(B, [xb[0], xb[1] + 1], [nb[0] + 2, nb[1] + 4]); }
    // section A cut
    { const y = 1500; v.line(-4300, y, -2600, y, 'S-TITLE'); const a = v.P(-4300, y); Fill(B, [[a[0], a[1]], [a[0] + 7, a[1]], [a[0] + 3.5, a[1] + 2.2]], 'S-TITLE'); v.line(900, y, 1700, y, 'S-TITLE'); v.mark(2050, y, 'A', 90); }
    // notes
    v.leader(380, yG + 600, 8, 10, 'φ900 SEMICIRCLE\nGROUTED ROCK\nPROTECTION'); v.leader(4300, yG - 30, 8, 12, 'TOE OF\nBATTER');
    v.leader(200, 3700, 20, 0, 'SPOON DRAIN\n(TYP)'); v.leader(3000, 300, 8, 10, 'TRAFFIC BARRIER\nPOST (TYP)'); v.leader(3800, -600, 26, -3, '150 WIDE INSITU KERB\nPROFILED TO SUIT\nBRIDGE KERB (TYP)');
    LY.title('PART PLAN', 100);
    LY.break();
    const w = LY.view(20), Wb = 300, D = 225, r = 175;
    w.pl([[-Wb, 0], [-r, 0]], false, 'S-CONC'); w.pl([[r, 0], [Wb, 0], [Wb + 10, -D], [-Wb - 10, -D], [-Wb, 0]], false, 'S-CONC'); w.arc(0, 0, r, 180, 360, 'S-CONC');
    w.ground(-1150, -Wb, 0); w.ground(Wb, 1150, 0);
    w.dim(r, 0, Wb, 0, 12, '125 * (INSITU OPTION)');
    w.leader(Wb + 10, -D, 6, -8, '225 x 600 CONCRETE SURFACE\nDRAIN (BY GALVINS OR SIMILAR\nAPPROVED) OR * APPROVED INSITU\nCONSTRUCTION.', { h: 2.4 });
    w.mtext(320, -760, '* APPROVED INSITU CONSTRUCTION OF\n   A MASS CONCRETE DRAIN REQUIRES\n   REINFORCING (MINIMUM REINF SL41\n   FABRIC WITH 50 MINIMUM COVER TOP\n   AND BOTTOM) SL81 OFFCUTS CAN BE\n   USED. LAP MESH AS REQUIRED.', 2.4);
    LY.title('SECTION A', 20);
    return LY.done();
  }, 'Concrete surface drain (spoon drain) from the traffic barrier kerb down the batter to grouted rock protection at the toe, where deck run-off must be taken clear of the abutment.');

  // ================================================================== PN30-4207 approach slab
  // finish symbol (check mark with class) at a view point, pointing at the surface below (dir 'd') or sideways ('l' / 'r')
  function vFin(v, x, y, lab, dir) { const p = v.P(x, y), B = v.B; if (dir === 'l' || dir === 'r') { const k = dir === 'r' ? 1 : -1; Ln(B, p[0], p[1], p[0] + k * 2.2, p[1] + 1.6); Ln(B, p[0], p[1], p[0] + k * 2.2, p[1] - 1.6); T(B, p[0] + k * 2.8, p[1] - 1, lab, { h: 2.0, al: k > 0 ? 'l' : 'r' }); } else { Ln(B, p[0] - 1.6, p[1] + 2.2, p[0], p[1]); Ln(B, p[0], p[1], p[0] + 1.6, p[1] + 2.2); T(B, p[0], p[1] + 2.8, lab, { h: 2.0, al: 'c' }); } }
  // crossfall arrow (wedge) with a dashed-box value; dir +1 points right
  function vFall(v, x, y, dir, s) { const p = v.P(x, y), B = v.B, L = 13; Fill(B, [[p[0], p[1]], [p[0] + dir * L, p[1]], [p[0] + dir * L, p[1] + 1.6]].map((q, i) => i === 0 ? q : q), 'S-TEXT'); XB(B, p[0] + dir * (L + 1) + (dir > 0 ? 0 : 0), p[1] + 0.8, s, { al: dir > 0 ? 'l' : 'r', h: 2.2 }); }
  // leader whose first word sits in a dashed variable box (text to the right of the shoulder)
  function vLeadX(v, x, y, dx, dy, boxed, rest, h) { h = h || 2.2; const a = v.P(x, y), b = [a[0] + dx, a[1] + dy], k = dx >= 0 ? 1 : -1, c = [b[0] + k * 2.5, b[1]]; PLn(v.B, [a, b, c]); Arrow(v.B, a[0], a[1], Math.atan2(a[1] - b[1], a[0] - b[0]) * 180 / PI); const L = rest.split('\n'), w0 = tw(boxed, h) + 2.2, wt = max(w0 + tw(L[0], h), ...L.slice(1).map(l => tw(l, h))), x0 = k > 0 ? c[0] + 1 : c[0] - 1 - wt; XB(v.B, x0 + 0.8, c[1] - h / 2, boxed, { h }); T(v.B, x0 + w0, c[1] - h / 2, L[0], { h }); L.slice(1).forEach((l, i) => T(v.B, x0, c[1] - h / 2 - (i + 1) * h * 1.55, l, { h })); }
  function vBreakV(v, x, y0, y1) { v.brk(x, y0, x, y1, 'S-TEXT'); }
  def('pn4207', 'Deck & overlay', 'Approach slab', 'PN30-4207', [P('Wk', 'Width between kerbs (mm)', 7200, { num: 1 }), P('Ls', 'Approach slab length (mm, min 5000)', 5000, { num: 1 }), P('fab', 'Deck fabric type', 'X')], (p) => {
    const Wk = max(3000, +p.Wk || 7200), Ls = max(5000, +p.Ls || 5000), fab = String(p.fab || 'X'), Hw = Wk / 2 + 300, LY = new Lay(760);
    const TX = 'TYPE ' + fab;
    // ---------------- PLAN 1:100
    {
      const sP = Wk > 8000 ? Math.ceil(Wk / 8000 * 10) * 10 : 100, v = LY.view(sP), B = v.B, xa1 = 700, j2 = 5300, xa2 = j2 - 600, s2 = j2 + 60, e2 = s2 + Ls, hk = Hw - 300;
      // approach slab 1 (concrete outline) and 2 (reinforcement)
      [[-Ls, 0], [s2, e2]].forEach(([a, b]) => { v.rect(a, -Hw, b - a, 2 * Hw, 'S-CONC'); v.line(a, hk, b, hk, 'S-CONC'); v.line(a, -hk, b, -hk, 'S-CONC'); });
      v.rect(-Ls + 300, -hk + 100, Ls - 600, 2 * hk - 200, 'S-HIDDEN'); v.line(-150, -Hw, -150, Hw, 'S-NEW'); v.line(s2 + 150, -Hw, s2 + 150, Hw, 'S-NEW');
      // bridge deck between (broken)
      [[60, 2300], [3400, j2]].forEach(([a, b]) => { [Hw, hk, -hk, -Hw].forEach(y => v.line(a, y, b, y, 'S-EXIST')); });
      v.line(60, -Hw, 60, Hw, 'S-NEW'); v.line(j2, -Hw, j2, Hw, 'S-NEW'); vBreakV(v, 2300, -Hw, Hw); vBreakV(v, 3400, -Hw, Hw);
      // anchor rods (pairs) at 2000 crs
      const rods = [-500, -2500, -4500, 1500, s2 + 500, s2 + 2500, s2 + 4500, j2 - 1500].filter(x => (x > -Ls + 200 && x < 0) || (x > 60 && x < 2300) || (x > 3400 && x < j2) || (x > s2 && x < e2 - 200));
      rods.forEach(x => [Hw - 60, Hw - 260, -Hw + 60, -Hw + 260].forEach(y => v.fill([[x - 70, y - 60], [x + 70, y - 60], [x + 70, y + 60], [x - 70, y + 60]], 'S-BOLT')));
      // reinforcement zones in slab 2
      const hz = (pts, sc) => { v.pl(pts, true, 'S-REO'); v.hatch(pts, 'ansi31', 'S-HATCH', sc); };
      hz([[s2 + 100, hk], [e2 - 100, hk], [e2 - 100, Hw - 60], [s2 + 100, Hw - 60]], 0.6);
      hz([[e2 - 300, -hk], [e2 - 100, -hk], [e2 - 100, 250], [e2 - 300, 250]], 0.6);
      hz([[s2 + 100, -50], [e2 - 300, -50], [e2 - 300, 250], [s2 + 100, 250]], 0.4);
      hz([[s2 + Ls * 0.55, 250], [e2 - 300, 250], [e2 - 300, hk], [s2 + Ls * 0.55, hk]], 1.2);
      // centre lines
      v.line(-Ls - 2500, 0, e2 + 3600, 0, 'S-CL'); T(B, ...v.P(e2 + 3700, -100), '℄ BRIDGE', { h: 2.4 });
      [[xa1, 'ABUTMENT N° 1'], [xa2, 'ABUTMENT N° 2']].forEach(([x, s]) => { v.line(x, -Hw - 1200, x, Hw + 4300, 'S-CL'); T(B, ...v.P(x - 100, Hw + 4500), '℄ ' + s, { h: 2.4 }); });
      // flow box, north point
      { const c = v.P(2850, 600); Box(B, c[0] - 2.5, c[1] + 9, c[0] + 2.5, c[1] - 9, 'S-NOTE'); T(B, c[0] + 0.8, c[1] + 7, 'FLOW', { h: 2.0, ang: -90 }); Fill(B, [[c[0], c[1] - 8], [c[0] - 1.2, c[1] - 3], [c[0] + 1.2, c[1] - 3]]); }
      { const c = v.P(-Ls - 2600, 2400); Box(B, c[0] - 4, c[1] + 14, c[0] + 4, c[1] - 14, 'S-NOTE'); north(B, c[0], c[1], 24); }
      // chainage markers
      { const c = v.P(-Ls - 2900, -1600); Fill(B, [[c[0] - 7, c[1]], [c[0] + 7, c[1]], [c[0] + 7, c[1] + 1.6]]); Ln(B, c[0] + 7, c[1], c[0] + 13, c[1]); XB(B, c[0] + 1, c[1] + 2.4, 'X', { al: 'c' }); }
      { const c = v.P(e2 + 2400, -Hw - 1500); Fill(B, [[c[0] + 9, c[1]], [c[0] - 4, c[1]], [c[0] - 4, c[1] + 1.6]]); XB(B, c[0] - 3, c[1] + 6, 'X', { al: 'c' }); T(B, c[0] - 1, c[1] + 2.4, '(+ve chainage)', { h: 2.0 }); }
      // section markers
      v.line(e2, 2300, e2 + 700, 2300, 'S-TITLE'); v.mark(e2 + 1000, 2300, 'C', 180); v.line(e2, -1400, e2 + 700, -1400, 'S-TITLE'); v.mark(e2 + 1000, -1400, 'D', 180);
      [[s2 + 75, 'A'], [s2 + 1300, 'B']].forEach(([x, c]) => { v.line(x, -Hw - 200, x, -Hw - 1900, 'S-TITLE'); v.mark(x, -Hw - 2200, c, 0); v.line(x, Hw + 200, x, Hw + 1700, 'S-TITLE'); const q = v.P(x, Hw + 1700); Fill(B, [[q[0], q[1]], [q[0], q[1] - 3], [q[0] + 2.4, q[1] - 1.5]], 'S-TITLE'); });
      // dimensions
      v.dim(-4500, Hw, -2500, Hw, 9, '2000'); T(B, ...v.P(-3500, Hw + 1400), '(TYP)', { h: 2.0, al: 'c' });
      v.dim(-500, Hw, s2 + 500, Hw, 9, ' '); { const q = v.P((-500 + s2 + 500) / 2, Hw + 900); const bx = XB(B, q[0], q[1] + 1, 'XX000', { al: 'c' }); T(B, q[0], q[1] - 3.2, '(TYP)', { h: 2.0, al: 'c' }); const nb = NB(B, q[0] - 6, q[1] + 22, 'NOTE: THIS DIMENSION TO\nBE A MULTIPLE OF 2000', { h: 2.2 }); dashTo(B, [q[0] + 2, bx[3]], [nb[0] + 12, nb[1]]); }
      v.dim(-500, Hw - 1000, 0, Hw - 1000, 0, ' '); vXB(v, 700, Hw - 950, 'XXX', { h: 2.2 });
      v.dim(-Ls, -Hw, 0, -Hw, -9, ' '); { const q = v.P(-Ls / 2, -Hw - 900); const bx = XB(B, q[0], q[1] - 1, String(Ls), { al: 'c' }); T(B, q[0], q[1] - 5, '(TYP)', { h: 2.0, al: 'c' }); const nb = NB(B, q[0] - 40, q[1] - 15, 'LENGTH OF APPROACH SLAB TO BE\nA MINIMUM LENGTH OF 5000.', { h: 2.2 }); dashTo(B, [bx[0], bx[1]], [nb[0] + 26, nb[3]]); }
      v.dimChain([[-Ls, -Hw], [-Ls, 0], [-Ls, Hw]], 8, ['=', '=']);
      // notes
      { const q = v.P(-4500, Hw - 60); v.leaders([[-4500, Hw - 60], [-2500, Hw - 60]], -16, 14, '2 - TYPE ARX\nANCHOR RODS\n(TYP)', { h: 2.2 }); const nb = NB(B, q[0] - 46, q[1] + 30, 'TYPE TO BE SPECIFIED\nREFER DRG N° 0430-0775', { h: 2.2 }); dashTo(B, [nb[0] + 26, nb[1]], [q[0] - 22, q[1] + 16.5]); }
      v.leader(s2 + 2500, Hw - 150, 10, 16, 'SL81 KERB FABRIC\nTYPE 4 (T & B)\n(TYP)', { h: 2.2 });
      v.leader(s2 + Ls * 0.75, 1200, (e2 + 1500 - s2 - Ls * 0.75) / sP, -2, 'SL81 DECK FABRIC\n' + TX + '(TYP)\nTRIM TO SUIT', { h: 2.2 });
      v.leader(e2 - 200, -2400, 15, -2, 'SL81 DROP PANEL FABRIC\n' + TX + ' - T\nSL81 DOWNTURN FABRIC\n' + TX + ' - B', { h: 2.2 });
      v.leader(s2 + 1200, 100, -30, -52, 'SL81 LAP FABRIC\nTYPE 8 (CUT TO\nSUIT)', { h: 2.2 });
      { const q = v.P(e2 + 200, -Hw - 1200); NB(B, q[0], q[1], 'NOTE:\nFOR STANDARD FABRIC DETAILS\n(FABRIC TYPES 1 TO 12) REFER\nTO DRAWING N° 9030-0243.', { h: 2.2, solid: true }); }
      LY.title('PLAN', sP);
    }
    // ---------------- SECTION A 1:10 (along the expansion joint, broken)
    {
      const v = LY.view(15), B = v.B, W = Wk + 600, xc = W / 2, top = x => -0.025 * abs(x - xc), g = 240, pw = 750;
      const pieces = [[0, pw, 0], [xc - 500, xc + 500, -(xc - 500) + pw + g], [W - pw, W, -(W - pw) + pw + g + 1000 + g]];
      const kerb = (dx, k) => { const X = x => dx + (k > 0 ? x : W - x), ty = top(300); v.pl([[X(0), -150], [X(0), 250], [X(30), 290], [X(260), 290], [X(285), 250], [X(300), ty + 20], [X(300), ty]], false, 'S-CONC'); v.pl([[X(40), 60], [X(250), 25], [X(250), 10], [X(40), 45]], true, 'S-NEW'); const f = [[X(0), -150], [X(430), -150 + 0.025 * 0], [X(300), -360], [X(0), -360]]; v.hatch(f, 'ansi31', 'S-HATCH', 0.5); v.pl(f, true, 'S-HATCH'); };
      pieces.forEach(([a, b, dx], i) => {
        const pts = n => Array.from({ length: 9 }, (_, k) => { const x = (i === 0 ? 300 : a) + ((i === 2 ? W - 300 : b) - (i === 0 ? 300 : a)) * k / 8; return [x + dx, top(x) + n]; });
        v.pl(pts(0), false, 'S-NEW'); v.pl(pts(-20), false, 'S-HIDDEN'); v.pl(pts(-95), false, 'S-NEW'); v.pl(pts(-115), false, 'S-NEW'); v.pl(pts(-150), false, 'S-NEW');
        const x0 = a + dx, x1 = b + dx; v.pl([[x0, -650], [x1, -650]], false, 'S-HIDDEN');
        if (i === 0) { v.line(x0, -150, x0, -650, 'S-HIDDEN'); kerb(dx, 1); } else vBreakV(v, x0, top(a) + 40, -650);
        if (i === 2) { v.line(x1, -150, x1, -650, 'S-HIDDEN'); kerb(dx, -1); } else vBreakV(v, x1, top(b) + 40, -650);
        [[0.3, -330], [0.7, -480], [0.5, -580]].forEach(([t, y]) => { const x = x0 + (x1 - x0) * t; v.pl(ellP(x, y, 22, 14, 6), true, 'S-HATCH'); v.pl(ellP(x + 30, y - 18, 12, 9, 5), true, 'S-HATCH'); });
      });
      // centre line, gap, crossfall
      const cx = xc + pieces[1][2]; v.line(cx, top(xc) + 600, cx, -700, 'S-CL'); v.line(cx, top(xc), cx, -150, 'S-NEW'); T(B, ...v.P(cx + 30, top(xc) + 640), '℄ BRIDGE', { h: 2.4 });
      v.dim(cx - 2.5, -230, cx + 2.5, -230, 0, '5 GAP');
      vFall(v, cx - 60, top(xc) + 160, -1, 'X%'); vFall(v, cx + 60, top(xc) + 160, 1, 'X%');
      // width between kerbs
      const xl = 300, xr = W - 300 + pieces[2][2]; v.dim(xl, 290, xr, 290, 14, ' '); { const q = v.P((xl + xr) / 2, 290); XB(B, q[0] - 22, q[1] + 15, String(Wk), { h: 2.4 }); T(B, q[0] - 22 + tw(String(Wk), 2.4) + 2, q[1] + 15, 'WIDTH BETWEEN KERBS', { h: 2.4 }); }
      // labels
      { const q = v.P(700, top(700)); Arrow(B, q[0], q[1], -90); Ln(B, q[0], q[1] + 2, q[0], q[1] + 9); Ln(B, q[0], q[1] + 9, q[0] + 40, q[1] + 9); T(B, q[0] + 0.5, q[1] + 10, 'TOP OF RUNNING SURFACE', { h: 2.2 }); T(B, q[0] + 0.5, q[1] + 5.6, 'TOP OF EXPANSION ANGLE', { h: 2.2 }); }
      v.leader(cx - 300, -420, -12, -16, 'PROPOSED\nSILL BEAM', { h: 2.2 });
      vLeadX(v, W - 600 + pieces[2][2], -280, -20, -22, 'XX', 'THICK EXPANDED FOAM\n(FOSROC EPANDAFOAM SHEET\n/STRIP BY PARCHEM CONSTRUCTION\nPRODUCTS OR SIMILAR APPROVED)');
      { const q = v.P(0, -760); NB(B, q[0], q[1], 'NOTE:\nFOR DETAILS OF EXPANSION ANGLES\nREFER TO DRAWING N° XX30-XXXX', { h: 2.2, solid: true }); }
      LY.title('SECTION A', 15);
    }
    LY.break();
    // ---------------- SECTION B 1:25 (across the approach slab)
    {
      const sB = Wk > 8000 ? 50 : 25, v = LY.view(sB), B = v.B, W = Wk + 600, xc = W / 2, top = x => -0.025 * abs(x - xc), t = 200;
      const bot = x => { const d = min(x - 300, W - 300 - x); return top(x) - t - (d < 250 ? 250 - max(0, d) : 0); };
      const xs = Array.from({ length: 41 }, (_, i) => 300 + (W - 600) * i / 40);
      v.pl(xs.map(x => [x, top(x)]), false, 'S-CONC'); v.pl(xs.map(x => [x, bot(x)]), false, 'S-CONC');
      v.pl(xs.map(x => [x, bot(x) - 25]), false, 'S-HIDDEN');
      v.pl(xs.filter(x => abs(x - xc) > 160).map(x => [x, top(x) - 45]), false, 'S-REO'); xs.forEach(x => { if (abs(x - xc) > 160) { const q = v.P(x, top(x) - 45); B.E.push({ t: 'circle', c: q, r: 0.3, L: 'S-REO' }); } });
      v.pl([[xc - 450, top(xc - 450) - 70], [xc + 450, top(xc + 450) - 70]], false, 'S-REO');
      [0, 1].forEach(k => { const X = x => k ? W - x : x; v.pl([[X(0), top(300) + 300], [X(0), top(300) - 450], [X(300), top(300) - 450], [X(300), top(300) - 450]], false, 'S-CONC'); v.line(X(0), top(300) + 300, X(300), top(300) + 300, 'S-CONC'); v.line(X(300), top(300) + 300, X(300), top(300) + 60, 'S-CONC'); v.line(X(300), top(300) + 60, X(320), top(300), 'S-CONC');
        v.pl([[X(60), top(300) - 380], [X(60), top(300) + 230], [X(240), top(300) + 230], [X(240), top(300) - 380]], true, 'S-REO'); v.line(X(-150), top(300) - 30, X(300), top(300) - 30, 'S-NEW'); });
      [0.12, 0.3, 0.62, 0.8].forEach(t2 => { const x = W * t2; v.ground(x - 400, x + 400, bot(x) - 60); });
      v.line(xc, top(xc) + 900, xc, bot(xc) - 400, 'S-CL'); T(B, ...v.P(xc, top(xc) + 1000), '℄ BRIDGE & CONSTRUCTION JOINT', { h: 2.4, al: 'c' });
      v.dim(300, top(300) + 300, W - 300, top(300) + 300, 10, String(Wk) + ' WIDTH BETWEEN KERBS');
      vFall(v, xc - 1200, top(xc - 1200) + 180, -1, 'X%'); vFall(v, xc + 1200, top(xc + 1200) + 180, 1, 'X%');
      vFin(v, 1600, top(1600), 'U3 (BROOM FINISH)');
      // detail call-ups
      { const c = v.P(xc, top(xc) - 100); PLn(B, ellP(c[0], c[1], 15, 5, 30), true, 'S-TEXT'); B.E.push({ t: 'circle', c: [c[0] - 22, c[1] - 9], r: 2.6, L: 'S-TEXT' }); T(B, c[0] - 22, c[1] - 9, '1', { h: 2.6, al: 'c', v: 'm' }); Ln(B, c[0] - 20, c[1] - 7.6, c[0] - 12, c[1] - 3); }
      { const c = v.P(W - 150, top(300) - 50); B.E.push({ t: 'circle', c, r: 13, L: 'S-TEXT' }); B.E.push({ t: 'circle', c: [c[0] + 15, c[1] + 15], r: 2.6, L: 'S-TEXT' }); T(B, c[0] + 15, c[1] + 15, '2', { h: 2.6, al: 'c', v: 'm' }); }
      v.leader(1300, top(1300) - 45, -8, -12, 'SL81 DECK FABRIC\n' + TX + '\n(TYP)', { h: 2.2 }); v.leader(xc + 150, top(xc) - 70, 10, -12, 'SL81 LAP FABRIC\nTYPE 8', { h: 2.2 }); v.leader(W - 180, top(300) - 380, 6, -18, 'SL81 KERB FABRIC\nTYPE 4\n(TYP.)', { h: 2.2 });
      { const q = v.P(1700, top(1700) - 900); NB(B, q[0], q[1], 'SIMILAR FOR BRIDGE WITH\nSUPERELEVATION', { h: 2.2 }); }
      LY.title('SECTION B', sB);
    }
    // ---------------- SECTION C 1:10 (through the expansion joint)
    {
      const v = LY.view(25), B = v.B, g = 25, te = 200, xE = 2300, hb = 20;
      // bridge deck (left) and approach slab (right)
      const deck = [[-700, 0], [-g, 0], [-g, -te], [-700, -te]]; v.pl(deck.slice(1).concat([deck[0]]), false, 'S-CONC'); v.hatch(deck, 'conc', 'S-HATCH');
      const sl = [[g, 0], [xE, 0], [xE, -te], [g, -te]]; v.pl(sl, true, 'S-CONC'); v.hatch(sl, 'conc', 'S-HATCH'); vBreakV(v, -700, 60, -te - 40); vBreakV(v, 1100, 60, -te - 40);
      const asp = [[260, 0], [xE, 0], [xE, 30], [260, 30]]; v.pl(asp, true, 'S-NEW'); v.hatch(asp, 'ansi31', 'S-HATCH', 0.5);
      v.line(-700, 30, -g - 90, 30, 'S-NEW'); v.line(-700, 36, -g - 90, 36, 'S-NEW');
      // expansion angles (150x90x12 with straps)
      [[-1, -g], [1, g]].forEach(([k, x]) => { aSec(v, x, hb, 90, 150, 12, k, -1, 'S-NEW'); v.fill([[x, hb], [x + k * 12, hb], [x + k * 12, hb - 150], [x, hb - 150]], 'S-NEW'); v.pl([[x + k * 12, hb - 30], [x + k * 60, hb - 30], [x + k * 110, hb - 80], [x + k * 520, hb - 80]], false, 'S-NEW'); v.pl([[x + k * 12, hb - 110], [x + k * 520, hb - 110]], false, 'S-NEW'); });
      [[-1, -60], [1, -100]].forEach(([k, y]) => { v.fabric(k * 120, y, k * 680, y, 120); });
      v.fabric(150, -50, 1000, -50, 120); v.fabric(150, -140, 1000, -140, 120); v.fabric(1300, -50, xE - 60, -50, 120); v.fabric(1300, -140, xE - 60, -140, 120);
      // compression seal and polystyrene block
      v.pl(ellP(0, -50, g - 3, 35, 16), true, 'S-NEW'); const ps = [[-g, -120], [g, -120], [g, -te], [-g, -te]]; v.pl(ps, true, 'S-NEW'); v.hatch(ps, 'ansi37', 'S-HATCH', 0.4);
      // sill beam, bearing pad, foam, membrane, fill
      const sb = [[-500, -te], [260, -te], [260, -900], [-500, -900]]; v.pl([[-500, -900], [-500, -te], [260, -te], [260, -900]], false, 'S-HIDDEN'); v.hatch(sb, 'conc', 'S-HATCH'); vBreakV(v, -120, -900, -900);
      const bp = [[100, -te], [250, -te], [250, -te - 12], [100, -te - 12]]; v.fill(bp, 'S-NEW');
      const fm = [[260, -te - 12], [300, -te - 12], [300, -900], [260, -900]]; v.pl(fm, true, 'S-NEW'); v.hatch(fm, 'ansi37', 'S-HATCH', 0.35);
      v.pl([[300, -te - 15], [1700, -te - 15], [1950, -te - 265], [xE, -te - 265]], false, 'S-HIDDEN');
      const fill = [[300, -te - 20], [1700, -te - 20], [1950, -te - 270], [xE, -te - 270], [xE, -1200], [300, -1200]]; v.hatch(fill, 'gravel', 'S-HATCH', 0.7); v.line(xE, -te, xE, -1200, 'S-CONC'); v.ground(300, xE + 200, -1200);
      // dims & labels
      v.line(-g, 40, -g, 1060, 'S-DIM'); v.line(g, 40, g, 1060, 'S-DIM'); { const a = v.P(-g, 1000), b = v.P(g, 1000); Ln(B, a[0] - 5, a[1], a[0], a[1], 'S-DIM'); Arrow(B, a[0], a[1], 0, 'S-DIM', 2, 0.6); Ln(B, b[0], b[1], b[0] + 5, b[1], 'S-DIM'); Arrow(B, b[0], b[1], 180, 'S-DIM', 2, 0.6); T(B, b[0] + 6, a[1] + 1.2, 'EXPANSION JOINT GAP', { h: 2.2 }); T(B, b[0] + 6, a[1] - 3.4, 'REFER TO NOTE 3 & 4', { h: 2.2 }); Ln(B, b[0] + 5, a[1], b[0] + 6 + tw('EXPANSION JOINT GAP', 2.2), a[1], 'S-TEXT'); }
      { const a = v.P(-g - 20, 700), b = v.P(-700, 700); Ln(B, a[0], a[1], b[0], b[1], 'S-DIM'); Arrow(B, b[0], b[1], 180, 'S-DIM', 2.2, 0.7); T(B, (a[0] + b[0]) / 2, a[1] + 1, 'BRIDGE DECK', { h: 2.2, al: 'c' }); const c = v.P(g + 20, 700), d = v.P(xE, 700); Ln(B, c[0], c[1], d[0], d[1], 'S-DIM'); Arrow(B, c[0], c[1], 180, 'S-DIM', 2.2, 0.7); T(B, (c[0] + d[0]) / 2, c[1] + 1, 'APPROACH SLAB', { h: 2.2, al: 'c' }); }
      v.dim(xE + 150, -te, xE + 150, -1200, 0, '1000');
      v.leader(0, -40, -18, 14, 'COMPRESSION SEAL', { h: 2.2 });
      v.leader(g + 40, hb, 10, 22, 'EXPANSION ANGLE\nREFER DRG N° XX30-XXXX\nFOR FABRICATION DETAILS', { h: 2.2 });
      { const q = v.P(560, 30); Arrow(B, q[0], q[1], -90); Ln(B, q[0], q[1] + 2, q[0], q[1] + 10); Ln(B, q[0], q[1] + 10, q[0] + 3, q[1] + 10); T(B, q[0] + 4, q[1] + 9, 'TOP OF RUNNING SURFACE', { h: 2.2 }); }
      { const a = v.P(xE + 120, 0), b = v.P(xE + 120, 30); v.line(xE, 30, xE + 160, 30, 'S-DIM'); v.line(xE, 0, xE + 160, 0, 'S-DIM'); Arrow(B, b[0], b[1], -90, 'S-DIM', 2, 0.6); Arrow(B, a[0], a[1], 90, 'S-DIM', 2, 0.6); Ln(B, b[0], b[1], b[0], b[1] + 5, 'S-DIM'); Ln(B, a[0], a[1], a[0], a[1] - 4, 'S-DIM'); T(B, b[0] - 22, b[1] + 6, 'X THICK', { h: 2.2 }); const bx = XB(B, b[0] - 22 + tw('X THICK ', 2.2), b[1] + 6, 'ASPHALT', { h: 2.2 }); const n1 = NB(B, b[0] - 30, b[1] + 22, 'Varies according to road\nseal materials requirements', { h: 2.2 }); dashTo(B, [b[0] - 24, b[1] + 6], [b[0] - 24, n1[1]]); const n2 = NB(B, bx[2] + 4, bx[1] - 6, 'road seal\nmaterial', { h: 2.2 }); dashTo(B, [bx[2], bx[1] + 1], [n2[0] + 6, n2[3]]); }
      v.leader(-g, -160, -14, -18, 'POLYSTYRENE BLOCK\nPLACED AT THE TIME\nOF APPROACH SLAB\nPOUR AND REMOVED\nBEFORE PLACEMENT\nOF COMPRESSION SEAL', { h: 2.2 });
      v.leader(-300, -600, -8, -26, 'PROPOSED\nSILL BEAM', { h: 2.2 });
      v.leader(180, -te - 6, 6, -50, 'BEARING PAD 150 WIDE, FULL WIDTH OF\nBRIDGE. 5 THICK RUBBER COATED WITH\nTEFLON & STAINLESS STEEL HERCULES\nHSC-2-150-20 OR SIMILAR APPROVED.', { h: 2.2 });
      v.leader(900, -te - 15, 10, -8, 'PVC MEMBRANE', { h: 2.2 });
      vLeadX(v, 300, -420, 10, -4, 'XX', 'THICK EXPANDED FOAM (FOSROC\nEPANDAFOAM SHEET /STRIP BY PARCHEM\nCONSTRUCTION  PRODUCTS OR SIMILAR\nAPPROVED)');
      { const q = v.P(1900, -1000); v.leader(1900, -1000, (xE - 1900) / 25 + 12, 0, ''); NB(B, q[0] + (xE - 1900) / 25 + 15, q[1] + 4, 'CEMENT STABILISED FILL.\nREFER TO NOTE 5 BELOW.', { h: 2.2 }); }
      LY.title('SECTION C', 25);
    }
    LY.break();
    // ---------------- DETAIL 1 1:10 (construction joint)
    {
      const v = LY.view(10), B = v.B, top = x => -0.025 * abs(x), t = 200, xs = Array.from({ length: 17 }, (_, i) => -800 + 100 * i);
      v.pl(xs.map(x => [x, top(x)]), false, 'S-CONC'); v.line(-800, -t, 800, -t, 'S-CONC'); v.line(-800, -t - 20, 800, -t - 20, 'S-HIDDEN'); vBreakV(v, -800, 30, -t - 40); vBreakV(v, 800, 30, -t - 40);
      v.line(0, top(0), 0, -t, 'S-NEW'); v.line(0, 250, 0, -t - 60, 'S-CL');
      [-1, 1].forEach(k => { v.fabric(k * 25, -45, k * 760, -45 - 0.025 * 735, 100); v.line(k * 15, -75, k * 450, -75, 'S-REO'); });
      v.pl([[30, -40], [330, 250]], false, 'S-NEW'); v.pl([[60, -40], [360, 250]], false, 'S-NEW');
      v.dim(0, -t, 100, -t, -10, '100');
      v.leader(-10, top(0) - 2, -36, 26, 'CONSTRUCTION JOINT\n(WIRE BRUSH FACE TO\nEXPOSE AGGREGATE\nWHILE CONCRETE IS\nSTILL GREEN)', { h: 2.2 });
      v.leader(350, 230, 6, 6, '40 COVER TO SUIT\n32NB x 2.0 PIPE SCREED', { h: 2.2 }); v.leader(600, -60, 8, 18, 'SL81 DECK FABRIC\n' + TX + '(TYP)', { h: 2.2 }); v.leader(-300, -75, -10, -16, 'SL81 LAP FABRIC\nTYPE 8', { h: 2.2 });
      T(B, ...v.P(40, 330), '℄ BRIDGE &\nCONSTRUCTION JOINT', { h: 2.2 });
      LY.title('DETAIL 1', 10);
    }
    // ---------------- TYPICAL DECK FABRIC LAP 1:10
    {
      const v = LY.view(20), B = v.B, sp = 100;
      for (let x = -900; x <= 300; x += sp) v.line(x, 0, x, 900, 'S-REO'); for (let x = 0; x <= 1200; x += 2 * sp) v.line(x + 25, 0, x + 25, 900, 'S-REO');
      for (let y = 100; y <= 800; y += 200) { v.line(-900, y, 300, y, 'S-REO'); v.line(25, y + 20, 1225, y + 20, 'S-REO'); }
      vBreakV(v, -950, 0, 900); vBreakV(v, 1275, 0, 900); v.brk(-300, 950, 100, 950); v.brk(-300, -50, 100, -50);
      v.dim(0, 0, 300, 0, -10, '300 LAP');
      v.leader(-200, 300, -10, -30, 'SL81 DECK FABRIC\n' + TX, { h: 2.2 }); v.leader(700, 300, 10, -30, 'SL81 DECK FABRIC\n' + TX, { h: 2.2 });
      UT(B, ...v.P(150, -400), 'PLAN', 2.4, 'c', 'S-TEXT');
      const y0 = 850, dx = 2700; v.line(dx - 900, y0, dx + 1200, y0, 'S-CONC'); v.line(dx - 900, y0 - 200, dx + 1200, y0 - 200, 'S-CONC'); v.line(dx - 900, y0 - 230, dx + 1200, y0 - 230, 'S-HIDDEN'); vBreakV(v, dx - 900, y0 + 30, y0 - 240); vBreakV(v, dx + 1200, y0 + 30, y0 - 240);
      v.fabric(dx - 850, y0 - 45, dx + 300, y0 - 45, 200); v.fabric(dx, y0 - 60, dx + 1150, y0 - 60, 200);
      v.leaders([[dx - 300, y0 - 45], [dx + 400, y0 - 60]], -14, 14, 'SL81 DECK FABRIC\n' + TX + '(TYP)', { h: 2.2 }); v.leader(dx + 600, y0 - 230, 8, -10, 'PVC MEMBRANE', { h: 2.2 });
      UT(B, ...v.P(dx + 150, y0 - 560), 'ELEVATION', 2.4, 'c', 'S-TEXT');
      LY.title('TYPICAL DECK FABRIC LAP', 10);
    }
    // ---------------- DETAIL 2 (reinforcement / concrete) 1:10
    const kerbOutline = (v, L) => { v.pl([[-750, -85], [-300, -110], [-275, 0], [-10, 0], [0, -10], [0, -450], [-300, -450], [-495, -255], [-750, -255]], false, L || 'S-CONC'); vBreakV(v, -750, -60, -280); };
    {
      const v = LY.view(10), B = v.B; kerbOutline(v); v.pl([[-750, -275], [-505, -275], [-310, -470], [15, -470], [15, -20]], false, 'S-HIDDEN');
      const st = [[-245, -390], [-245, -50], [-60, -50], [-60, -390]]; v.pl(st, true, 'S-REO'); v.line(-210, -60, -210, -380, 'S-REO'); v.line(-95, -60, -95, -380, 'S-REO');
      v.fabric(-750, -140, -90, -150, 100); v.pl([[-650, -190], [-30, -190]], false, 'S-HIDDEN'); v.pl([[-650, -205], [20, -205]], false, 'S-HIDDEN');
      v.dim(0, 0, 0, -180, -12, '180'); v.dim(-60, -390, -60, -450, 0, ''); T(B, ...v.P(30, -440), '75 COVER', { h: 2.2 });
      v.leaders([[-280, -60], [-230, -110]], -10, 18, 'SL81 KERB FABRIC\nTYPE 4', { h: 2.2 }); v.leader(-500, -145, -18, 14, 'SL81 DECK FABRIC\n' + TX, { h: 2.2 }); v.leader(20, -195, 10, 28, 'FOR POST CONNECTION\nDETAILS SEE DRG N°\n9530-0216', { h: 2.2 });
      T(B, ...v.P(-470, -620), 'REINFORCEMENT', { h: 2.2, L: 'S-TITLE' });
      LY.title('DETAIL 2', 10, 'POST OMITTED');
    }
    {
      const v = LY.view(10), B = v.B; kerbOutline(v); v.pl([[-750, -275], [-505, -275], [-310, -470], [15, -470], [15, -20]], false, 'S-HIDDEN');
      v.dim(-300, 0, 0, 0, 14, '300'); v.dim(-300, 0, -275, 0, 8, '25'); v.dim(-330, 0, -330, -10, 6, '10'); v.dim(0, 0, 0, -450, -14, '450'); v.dim(-300, -450, 0, -450, -10, '300');
      vFin(v, -150, 0, 'U2'); vFin(v, -290, -60, '2', 'l'); vFin(v, 0, -260, '2', 'r');
      { const p0 = v.P(-450, -380); PLn(B, [[p0[0], p0[1]], [p0[0] + 4, p0[1]], [p0[0], p0[1] + 4]], true); T(B, p0[0] - 1.2, p0[1] + 4, '1', { h: 2.0, al: 'r' }); T(B, p0[0] + 2, p0[1] - 3, '1', { h: 2.0, al: 'c' }); }
      v.leader(-600, -262, -8, -12, 'PVC\nMEMBRANE', { h: 2.2 });
      { const a = v.P(40, 0), b = v.P(40, -100); Ln(B, a[0] - 4, a[1], a[0] + 1, a[1], 'S-DIM'); Ln(B, b[0] - 4, b[1], b[0] + 1, b[1], 'S-DIM'); Ln(B, a[0], a[1], b[0], b[1], 'S-DIM'); Arrow(B, a[0], a[1], 90, 'S-DIM', 2, 0.6); Arrow(B, b[0], b[1], -90, 'S-DIM', 2, 0.6); const bx = XB(B, a[0] + 2, (a[1] + b[1]) / 2 - 1, "'Y'", { h: 2.2 }); const nb = NB(B, bx[2] + 4, a[1] + 12, "100 ABOVE RUNNING\nSURFACE 'Y' = ('X'+100)", { h: 2.2 }); dashTo(B, [bx[2], bx[3]], [nb[0], nb[1] + 3]); }
      T(B, ...v.P(-470, -620), 'CONCRETE', { h: 2.2, L: 'S-TITLE' });
      LY.title('DETAIL 2', 10, 'POST OMITTED');
    }
    // ---------------- SECTION D 1:10 (end of the approach slab)
    {
      const v = LY.view(15), B = v.B, t = 200, xe = 1300;
      const o = [[0, 0], [xe, 0], [xe, -475], [xe - 300, -475], [xe - 575, -t], [0, -t]]; v.pl(o, false, 'S-CONC'); vBreakV(v, 0, 40, -t - 40);
      v.pl([[0, -t - 20], [xe - 583, -t - 20], [xe - 308, -495], [xe + 10, -495]], false, 'S-HIDDEN');
      v.fabric(0, -40, xe - 75, -40, 100); v.bar([[xe - 75, -40], [xe - 75, -400], [xe - 290, -400], [xe - 520, -170], [xe - 700, -170]]); [-150, -250, -350].forEach(y => v.barEnd(xe - 90, y, 10)); [[xe - 390, -310], [xe - 470, -230]].forEach(([x, y]) => v.barEnd(x, y, 10));
      v.fill([[xe, 0], [xe + 15, 0], [xe + 15, -100], [xe, -100]], 'S-NEW'); v.line(xe + 15, 0, xe + 700, 0, 'S-EXIST'); v.line(xe + 15, -100, xe + 700, -100, 'S-EXIST');
      vFin(v, 500, 0, 'U3 (BROOM FINISH)'); vFin(v, xe, -260, '3', 'r');
      v.dim(xe - 75, 0, xe, 0, 10, '75'); v.dim(xe, 0, xe, -400, -24, '400 (MIN)'); v.dim(xe, -400, xe, -475, -24, '75'); v.dim(xe - 300, -475, xe, -475, -12, '300'); v.dim(0, 0, 0, -150, 10, '150');
      { const p0 = v.P(xe - 560, -330); PLn(B, [[p0[0], p0[1]], [p0[0] + 4, p0[1]], [p0[0], p0[1] + 4]], true); T(B, p0[0] - 1.2, p0[1] + 4, '1', { h: 2.0, al: 'r' }); T(B, p0[0] + 2, p0[1] - 3, '1', { h: 2.0, al: 'c' }); }
      v.leader(300, -40, 6, 16, 'SL81 DECK FABRIC\n' + TX, { h: 2.2 }); v.leader(xe - 75, -60, 10, 20, 'SL81 DROP PANEL FABRIC\n' + TX, { h: 2.2 }); v.leader(xe - 450, -250, -26, -10, 'SL81 DOWNTURN\nFABRIC ' + TX, { h: 2.2 });
      v.leader(xe + 15, -50, 18, -4, 'EXISTING ROAD PAVEMENT\nEDGE SHALL BE SAWN CUT\nTO A MIN. DEPTH OF 100mm\nPRIOR TO EXCAVATION', { h: 2.2 });
      LY.title('SECTION D', 15);
    }
    // ---------------- notes
    LY.block(B => {
      UT(B, 0, 0, 'NOTES', 3.2); let y = -7; const h = 2.2, ls = 3.3;
      const N = [['1.', 'FOR GENERAL NOTES REFER TO DRG N° XX30-XXXX.'], ['2.', "AT EXPANSION ANGLES, CONCRETE SHALL BE COMPACTED AND VIBRATED\nTO ENSURE ALL AIR RELEASE HOLES IN ANGLES ARE FILLED WITH\nCONCRETE. AFTER CONCRETE HAS CURED FILL ANY REMAINING VOIDS WITH\nEPOXY RESIN 'EPIREZ 133' OR SIMILAR APPROVED."], ['3.', 'COMPRESSION SEAL SHALL BE XXX XXXXX (OR SIMILAR APPROVED)\nAND SHALL BE INSTALLED IN ACCORDANCE WITH THE MANUFACTURERS\nSPECIFICATIONS. THIS SEAL SHALL NOT BE USED FOR BRIDGES SKEWED\nGREATER THAN 15°.'], ['4.', 'EXPANSION JOINT GAP SHALL BE XX mm AT 25°C AMBIENT TEMPERATURE\nAND INCREASED BY 2mm FOR EACH 3°C FALL IN TEMPERATURE AND\nDECREASED BY 2mm FOR EACH 3°C RISE IN TEMPERATURE.'], ['5.', 'CEMENT STABILISED FILL SHALL COMPRISE SELECTED STABILISED\nFILL MATERIAL IN THE PROPORTION OF 100kg TYPE GP CEMENT TO 1 CUBIC\nMETRE OF SELECTED FILL.']];
      const ys = []; N.forEach(([n, s]) => { ys.push(y); y = para(B, 2, y, n, s, { h, ls, ind: 6, gap: 1.6 }); });
      const bx = (yy, pre, s) => { const x = 8 + tw(pre, h); Box(B, x - 0.6, yy - 1, x + tw(s, h) + 0.6, yy + h + 1, 'S-NOTE'); };
      bx(ys[0], 'FOR GENERAL NOTES REFER TO DRG N° ', 'XX30-XXXX.'); bx(ys[2], 'COMPRESSION SEAL SHALL BE ', 'XXX XXXXX'); bx(ys[3], 'EXPANSION JOINT GAP SHALL BE ', 'XX');
      const w5 = tw('FILL MATERIAL IN THE PROPORTION OF 100kg TYPE GP CEMENT TO 1 CUBIC', h) + 12; Box(B, 0, ys[4] + h + 1.4, w5, y + 0.4, 'S-NOTE');
      const nb = NB(B, w5 + 10, 0, 'The Design Engineer should consider\nwhere there has been considerable\nsettlement of the approach pavement\n& where there has been loss of fill by\nleakage between sheeting planks &/or\nsignificant bowing of sheeting planks\nwithin the top metre, then it is\nrecommended that cement stabilised\nfill be placed to a depth of 1m below\nthe underside of the approach slab.', { h: 2.2, al: 'c' }); dashTo(B, [w5, (ys[4] + y) / 2 + 2], [nb[0], (ys[4] + y) / 2 + 2]);
      readWith(B, 0, min(y, nb[1]) - 10);
    });
    return LY.done();
  }, 'Reinforced concrete approach slab (min 5000 long) on a cement stabilised fill with expansion angles, compression seal and bearing pad at the abutment, for bridges receiving a concrete overlay.');

  // ================================================================== PN30-4208 / 4209 expansion angles Types 1 and 2
  def('exa', 'Deck & overlay', 'Expansion angles – Types 1 and 2', 'PN30-4208 / 4209', [P('Wk', 'Width between kerbs (mm)', 7200, { num: 1 }), P('type', 'Angle type shown', '1 & 2', { opts: ['1 & 2', '1', '2'] }), P('seal', 'Road seal', 'Road seal (PN30-4208)', { opts: ['Road seal (PN30-4208)', 'No road seal (PN30-4209)'] })], (p) => {
    const Wk = max(3000, +p.Wk || 7200), L = Math.round(Wk / 2 + 10), ty = String(p.type == null ? '1 & 2' : p.type), noSeal = /^No/.test(String(p.seal || '')), n = Math.ceil((L - 210) / 200), LY = new Lay(760);
    const show1 = ty !== '2', show2 = ty !== '1';
    // ---------------- KEY PLAN (N.T.S., drawn in paper mm)
    {
      const v = LY.view(1), B = v.B, hw = 22;
      const grp = (x0, flip) => { // approach slab | angles | deck (flip: deck | angles | approach slab)
        const xs = flip ? [x0, x0 + 26, x0 + 32, x0 + 70] : [x0, x0 + 38, x0 + 44, x0 + 70];
        v.rect(xs[0], -hw, xs[1] - xs[0], 2 * hw, flip ? 'S-EXIST' : 'S-CONC'); v.rect(xs[2], -hw, xs[3] - xs[2], 2 * hw, flip ? 'S-CONC' : 'S-EXIST');
        [hw - 3, -hw + 3].forEach(y => { v.line(xs[0], y, xs[1], y, 'S-TEXT'); v.line(xs[2], y, xs[3], y, 'S-TEXT'); });
        [xs[1] - 1, xs[1], xs[2], xs[2] + 1].forEach(x => v.line(x, -hw, x, hw, 'S-NEW'));
        const brx = flip ? xs[0] : xs[3]; v.brk(brx, -hw + 4, brx, hw - 4);
        const xa = (xs[1] + xs[2]) / 2; v.line(xa, -hw - 6, xa, hw + 14, 'S-CL'); return { xs, xa };
      };
      const g1 = grp(0, false), g2 = grp(100, true);
      v.line(-8, 0, 182, 0, 'S-CL'); T(B, 184, -1, '℄ BRIDGE', { h: 2.2 });
      T(B, g1.xa - 1, hw + 16, '℄ ABUTMENT N° 1', { h: 2.2 }); T(B, g2.xa - 1, hw + 16, '℄ ABUTMENT N° 2', { h: 2.2 });
      const V = (x, y, lx, ly, s, al) => { Ln(B, x - 1.5, y, lx, ly); Ln(B, x - 1.5, y, x + 1.5, y - 3 * Math.sign(y)); Ln(B, lx, ly, lx + (al === 'r' ? -3 : 3), ly); T(B, lx + (al === 'r' ? -4 : 4), ly - 1, s, { h: 2.2, al: al || 'l' }); };
      [[g1, ['TYPE 2', 'TYPE 1'], ['TYPE 1', 'TYPE 2']], [g2, ['TYPE 2', 'TYPE 1'], ['TYPE 1', 'TYPE 2']]].forEach(([g, top, bot]) => { V(g.xs[1] - 0.5, 8, g.xs[1] - 10, hw + 7, top[0], 'r'); V(g.xs[2] + 0.5, 8, g.xs[2] + 10, hw + 7, top[1]); V(g.xs[1] - 0.5, -8, g.xs[1] - 10, -hw - 7, bot[0], 'r'); V(g.xs[2] + 0.5, -8, g.xs[2] + 10, -hw - 7, bot[1]); });
      v.leader(18, 5, -26, 8, 'APPROACH SLAB', { dot: true }); v.leader(52, 5, 6, 4, 'BRIDGE\nDECK', { dot: true }); v.leader(152, 5, 26, 8, 'APPROACH SLAB', { dot: true });
      v.mark(g2.xa, hw + 9, 'E', 0); v.line(g2.xa, hw + 6, g2.xa, hw, 'S-TITLE');
      Box(B, 81, -6, 87, -24, 'S-NOTE'); T(B, 84.8, -8, 'FLOW', { h: 2.0, ang: -90 }); Fill(B, [[84, -23], [82.8, -18], [85.2, -18]]);
      Box(B, -30, 2, -20, -32, 'S-NOTE'); north(B, -25, -15, 26);
      LY.title('KEY PLAN', null, 'N.T.S.');
    }
    // ---------------- expansion angle plan (1:10), k = 1 (Type 1: kerb end on the right) or 2
    const angle = k => {
      const sA = L > 4300 ? 20 : 10, v = LY.view(sA), B = v.B, kerbR = k === 1, X = x => kerbR ? x : L - x; // x measured from the end AWAY from the kerb
      v.rect(0, -90, L, 90, 'S-NEW'); v.line(0, -12, L, -12, 'S-HIDDEN'); v.line(0, -4, L, -4, 'S-NEW');
      const s0 = 60, s1 = L - 150, xs = Array.from({ length: n }, (_, i) => s0 + (s1 - s0) * i / max(1, n - 1));
      xs.forEach(x0 => { const x = X(x0); v.line(x - 10, -90, x - 10, -440, 'S-NEW'); v.line(x + 10, -90, x + 10, -440, 'S-NEW'); v.line(x - 10, -440, x + 10, -440, 'S-NEW'); v.line(x, -90, x, -150, 'S-HIDDEN'); v.line(x - 16, -330, x + 16, -330, 'S-NEW'); v.line(x - 10, -150, x + 10, -150, 'S-HIDDEN'); });
      // end plate and anchor straps type C at the kerb end
      const xe = X(L), dir = kerbR ? 1 : -1; v.rect(min(xe, xe + dir * 230), -12, 230, 12, 'S-NEW'); [70, 170].forEach(d => { const x = xe + dir * d; v.line(x - 10, -12, x - 10, -300, 'S-NEW'); v.line(x + 10, -12, x + 10, -300, 'S-NEW'); v.line(x - 10, -300, x + 10, -300, 'S-NEW'); v.line(x - 16, -220, x + 16, -220, 'S-NEW'); });
      // holes: φ25 air release / φ10 tapped (from the kerb end)
      const hole = (d, tap) => { const x = X(L - d); if (tap) { v.line(x - 30, -45, x + 30, -45, 'S-BOLT'); v.line(x, -75, x, -15, 'S-BOLT'); } else { v.circ(x, -45, 12.5, 'S-BOLT'); v.line(x - 22, -45, x + 22, -45, 'S-CL'); v.line(x, -67, x, -23, 'S-CL'); } };
      hole(80, false); let i = 0; for (let d = 300; d < L - 100; d += 300, i++) hole(d, i % 3 === 0);
      // dimensions
      v.dim(0, 0, L, 0, 16, ' '); vXB(v, L / 2, 175, noSeal ? String(L) : 'XXXX', { al: 'c', h: 2.4 });
      { const q = v.P(L / 2 + (kerbR ? -400 : 400), 330); const fb = [q[0] - 10, q[1] + 10]; Box(B, fb[0], fb[1], fb[0] + 96, fb[1] - 10, 'S-NOTE'); Ln(B, fb[0] + 58, fb[1], fb[0] + 58, fb[1] - 10, 'S-NOTE'); T(B, fb[0] + 2, fb[1] - 6, (noSeal ? String(L) : 'XXXX') + ' = (', { h: 2.2 }); const tx = fb[0] + 2 + tw((noSeal ? String(L) : 'XXXX') + ' = (', 2.2); T(B, tx, fb[1] - 4.2, 'WIDTH BETWEEN KERBS', { h: 2.0 }); Ln(B, tx, fb[1] - 4.8, tx + tw('WIDTH BETWEEN KERBS', 2.0), fb[1] - 4.8); T(B, tx + tw('WIDTH BETWEEN KERBS', 2.0) / 2, fb[1] - 8, '2', { h: 2.0, al: 'c' }); T(B, tx + tw('WIDTH BETWEEN KERBS', 2.0) + 0.6, fb[1] - 6, ') + 10', { h: 2.2 }); T(B, fb[0] + 60, fb[1] - 4.2, 'where symmetrical about ℄\nof bridge', { h: 2.0, ls: 1.5 }); dashTo(B, [fb[0] + 30, fb[1] - 10], [v.P(L / 2, 175)[0], v.P(L / 2, 175)[1] + 3.6]); }
      v.dim(X(0), -440, X(s0), -440, kerbR ? -10 : 10, '60'); v.dim(X(s1), -440, X(L), -440, kerbR ? -10 : 10, '150');
      { const a = v.P(min(X(s0), X(s1)), -440), b = v.P(max(X(s0), X(s1)), -440), y = a[1] - 10; Ln(B, a[0], y, b[0], y, 'S-DIM'); Arrow(B, a[0], y, 180, 'S-DIM', 2.2, 0.7); Arrow(B, b[0], y, 0, 'S-DIM', 2.2, 0.7); T(B, (a[0] + b[0]) / 2, y + 0.8, (noSeal ? n : 'XX') + ' - ANCHOR STRAPS TYPE A & B AT 200 CRS MAX', { h: 2.0, al: 'c', L: 'S-DIM' }); }
      v.dimChain([[X(L - 600), -90], [X(L - 300), -90], [X(L - 80), -90], [X(L), -90]].sort((a, b) => a[0] - b[0]).map(q => [q[0], 0]), 8, kerbR ? ['300', '220', '80'] : ['80', '220', '300']); T(B, ...v.P(X(L - 450), 0).map((c, j) => j ? c + 4 : c), 'TYP', { h: 2.0, al: 'c' });
      [0.3, 0.62].forEach(t => v.dim(X(L * t) + 40, -45, X(L * t) + 40, -90, -2, '45', { sub: 'TYP' }));
      v.leader(X(L - 1200), -45, kerbR ? -16 : 12, 12, 'φ10 TAPPED HOLE (TYP)\n(SEE NOTE 2)', { h: 2.2 }); v.leader(X(L - 600), -45, kerbR ? -14 : 14, 12, 'φ25 AIR RELEASE\nHOLE', { h: 2.2 }); v.leader(X(L * 0.82), -100, kerbR ? -10 : 10, -18, '150x90x12 UA', { h: 2.2 });
      // section A cut and end view marker
      const xm = X(L * 0.55); v.mark(xm, 230, 'A', -90); v.line(xm, 200, xm, 80, 'S-TITLE'); const q = v.P(xm, -250); Ln(B, q[0], q[1], q[0], q[1] - 7, 'S-TITLE'); Fill(B, [[q[0], q[1] - 7], [q[0], q[1] - 3], [q[0] + 2.2, q[1] - 5]], 'S-TITLE');
      v.mark(xe + dir * 420, 100, kerbR ? 'B' : 'C', kerbR ? 180 : 0);
      LY.title('EXPANSION ANGLE - TYPE ' + k, sA, '4 N° REQUIRED');
    };
    if (show1) angle(1);
    LY.break();
    // ---------------- SECTION A 1:5
    {
      const v = LY.view(5), B = v.B; const ang = [[0, 0], [90, 0], [90, -12], [12, -12], [12, -150], [0, -150]]; v.pl(ang, true, 'S-NEW'); v.hatch(ang, 'ansi31', 'S-HATCH', 0.25);
      v.pl([[12, -12], [40, -12], [52, -16], [92, -61], [104, -65], [500, -65], [500, -75], [100, -75], [86, -68], [46, -24], [38, -22], [12, -22]], true, 'S-NEW');
      v.pl([[12, -60], [22, -60], [22, -92], [26, -104], [40, -110], [500, -110], [500, -120], [36, -120], [18, -114], [12, -100]], true, 'S-NEW');
      v.line(-60, 0, 0, 0, 'S-TEXT'); v.line(90, 0, 170, 0, 'S-CONC'); v.line(170, 0, 170, -20, 'S-CONC'); v.line(170, -20, 380, -20, 'S-CONC'); v.line(470, 0, 560, 0, 'S-TEXT');
      v.wl(520, 0, 'RUNNING\nSURFACE');
      v.dim(0, 0, 40, 0, 26, '40'); v.dim(40, 0, 100, 0, 26, '60'); v.dim(100, 0, 500, 0, 26, '400'); v.dim(-30, 0, 0, 0, 14, '30');
      v.dim(-25, 0, -25, -60, 6, '60'); v.dim(-25, -60, -25, -100, 6, '40'); v.dim(12, -150, 42, -150, -6, '30'); v.dim(0, -150, 500, -150, -22, '500');
      v.dim(-110, 0, -110, -150, 6, 'DEPTH TO SUIT', { sub: 'COMPRESSION SEAL' });
      v.dim(560, -75, 560, -110, -6, '35'); v.dim(560, -110, 560, -120, -14, '10', { sub: 'TYP' });
      { const a = v.P(300, 0), b = v.P(300, -20); Ln(B, a[0], a[1] + 6, a[0], a[1], 'S-DIM'); Arrow(B, a[0], a[1], -90, 'S-DIM', 1.6, 0.5); Ln(B, b[0], b[1] - 6, b[0], b[1], 'S-DIM'); Arrow(B, b[0], b[1], 90, 'S-DIM', 1.6, 0.5); XB(B, a[0] + 2, a[1] + 2, '20', { h: 2.0 }); }
      { const a = v.P(610, 0), b = v.P(610, -75); Ln(B, a[0], a[1], b[0], b[1], 'S-DIM'); Arrow(B, a[0], a[1], 90, 'S-DIM', 1.8, 0.6); Arrow(B, b[0], b[1], -90, 'S-DIM', 1.8, 0.6); Ln(B, a[0] - 6, a[1], a[0] + 1, a[1], 'S-DIM'); Ln(B, b[0] - 6, b[1], b[0] + 1, b[1], 'S-DIM'); const bx = XB(B, a[0] + 2, (a[1] + b[1]) / 2 - 1, '75', { h: 2.0 }); NB(B, bx[2] + 4, (a[1] + b[1]) / 2 + 3.5, 'DRAWN FOR 20\nUPSTAND ONLY', { h: 2.0 }); dashTo(B, [bx[2], (a[1] + b[1]) / 2], [bx[2] + 4, (a[1] + b[1]) / 2]); }
      v.circ(17, -100, 22, 'S-TEXT'); { const c = v.P(-30, -125); B.E.push({ t: 'circle', c, r: 2.6, L: 'S-TEXT' }); T(B, c[0], c[1], '1', { h: 2.6, al: 'c', v: 'm' }); Ln(B, c[0] + 2.4, c[1] + 1, ...v.P(2, -110)); }
      v.leader(0, 0, -14, 8, '150x90x12 UA', { h: 2.2 }); v.leader(95, -66, 14, 26, '20 RAD\n(TYP)', { h: 2.2 }); v.leader(300, -65, 10, 28, '20x10 FL ANCHOR\nSTRAP TYPE A', { h: 2.2 }); v.leader(200, -120, 10, -8, '20x10 FL ANCHOR\nSTRAP TYPE B', { h: 2.2 });
      v.weld(70, -42, 10, -36, { size: '5', len: '40', both: true, tail: 'TYP' });
      LY.title('SECTION A', 5);
    }
    // ---------------- DETAIL 1 1:2
    {
      const v = LY.view(2), B = v.B; v.fill([[0, -60], [12, -60], [12, 60], [0, 60]], 'S-NEW'); v.brk(-4, 60, 16, 60); v.brk(-4, -60, 16, -60);
      const fl = [[-10, -10], [0, -10], [0, 10], [-10, 10]]; v.pl(fl, true, 'S-NEW'); v.hatch(fl, 'ansi31', 'S-HATCH', 0.3);
      v.weld(-6, 10, -10, 12, { size: '3', other: true }); v.weld(-6, -10, -10, -12, { size: '3' });
      v.leader(-10, 0, -16, 0, '20x10 FL', { h: 2.2 });
      LY.title('DETAIL 1', 2);
    }
    if (show2) angle(2);
    LY.break();
    // ---------------- VIEW B (VIEW C opposite hand) 1:5
    {
      const v = LY.view(5), B = v.B; const pl = [[0, -170], [0, 40], [280, 0], [280, -170]]; v.pl(pl, true, 'S-NEW');
      v.pl([[20, -55], [235, -90], [235, -100], [20, -65]], true, 'S-NEW'); v.rect(80, -30, 20, 8, 'S-NEW'); v.rect(180, -150, 20, 8, 'S-NEW');
      const seg = (a, b) => { v.line(a, 0, b, 0, 'S-NEW'); v.line(a, -12, b, -12, 'S-HIDDEN'); v.line(a, -95, b, -95, 'S-NEW'); v.line(a, -105, b, -105, 'S-NEW'); v.line(a, -150, b, -150, 'S-NEW'); };
      const xc = 1000; seg(280, 640); v.brk(640, 30, 640, -170); seg(720, xc); v.brk(720, 30, 720, -170);
      [430, 600, 800, 950].forEach(x => { v.rect(x - 10, -24, 20, 10, 'S-NEW'); v.pl([[x - 10, -100], [x - 10, -60], [x + 10, -60], [x + 10, -100]], false, 'S-NEW'); });
      [0, -12, -95, -150].forEach(y => v.line(xc + 5, y, xc + 180, y, 'S-HIDDEN')); v.line(xc + 5, 0, xc + 5, -150, 'S-HIDDEN'); v.brk(xc + 180, 30, xc + 180, -170);
      v.fill([[xc - 3, 0], [xc, 0], [xc, -150], [xc - 3, -150]], 'S-NEW'); v.line(xc + 2, 160, xc + 2, -260, 'S-CL'); T(B, ...v.P(xc + 10, 170), '℄ BRIDGE', { h: 2.2 });
      v.dim(xc, -150, xc + 5, -150, -10, '5', { sub: 'GAP' });
      vFall(v, xc - 60, 70, -1, 'X%'); vFall(v, xc + 70, 70, 1, 'X%');
      v.dim(0, 40, 280, 40, 30, '280'); v.dim(80, 40, 180, 40, 16, '100'); v.dim(180, 40, 280, 40, 16, '100'); v.dim(0, 40, 0, -170, 14, '200'); v.dim(230, -170, 280, -170, -10, '50');
      v.dim(80, -30, 80, -55, 8, '25'); v.dim(180, -142, 180, -170, 8, '25');
      v.mark(140, 330, 'D', -90); v.line(140, 300, 140, 120, 'S-TITLE');
      v.weld(280, -150, 10, -14, { size: '6', both: true });
      v.leader(60, -60, -12, -24, '20x10 FL x\n230 LONG', { h: 2.2 }); v.leader(190, -100, -12, -26, 'ANCHOR STRAP\nTYPE C', { h: 2.2 });
      v.leader(600, -20, 12, 30, 'ANCHOR STRAP\nTYPE A', { h: 2.2 }); v.leader(800, -80, 10, -26, 'ANCHOR STRAP\nTYPE B', { h: 2.2 });
      const t = v.P(500, -330); B.title(t[0], t[1], 'VIEW B', 5); B.title(t[0], t[1] - 15, 'VIEW C', 5, 'OPPOSITE HAND');
    }
    // ---------------- SECTION D 1:5
    {
      const v = LY.view(5), B = v.B; const pl = [[0, -160], [12, -160], [12, 30], [0, 30]]; v.pl(pl, true, 'S-NEW'); v.hatch(pl, 'ansi31', 'S-HATCH', 0.25);
      v.rect(12, -10, 488, 10, 'S-NEW'); v.rect(12, -120, 488, 10, 'S-NEW'); v.circ(6, -112, 22, 'S-TEXT');
      v.dim(12, 30, 500, 30, 14, '500'); v.dim(-60, 0, -60, -115, 6, 'DEPTH TO SUIT', { sub: 'COMPRESSION SEAL' });
      v.leader(0, 20, -14, 10, '12 FL', { h: 2.2 }); v.weld(12, 0, 16, 18, { size: '5', all: true, tail: 'TYP' });
      v.leaders([[250, -10], [200, -120]], 18, -26, '20x10 FL ANCHOR\nSTRAP TYPE C', { h: 2.2 });
      { const c = v.P(-20, -170); B.E.push({ t: 'circle', c, r: 2.6, L: 'S-TEXT' }); T(B, c[0], c[1], '1', { h: 2.6, al: 'c', v: 'm' }); T(B, c[0] + 3.6, c[1] - 1, 'SIMILAR', { h: 2.2 }); Ln(B, c[0] + 1.6, c[1] + 2, ...v.P(-6, -128)); }
      LY.title('SECTION D', 5);
    }
    // ---------------- SECTION E 1:5
    {
      const v = LY.view(5), B = v.B; const kb = [[0, -140], [0, 190], [25, 215], [205, 210], [228, 185], [240, 15], [250, 0]];
      v.pl(kb, false, 'S-CONC'); v.line(0, -140, 250, -146, 'S-CONC');
      v.pl([[20, 150], [190, 125], [190, 112], [20, 137]], true, 'S-NEW'); v.pl([[20, 40], [200, 5], [200, -8], [20, 27]], true, 'S-NEW'); v.rect(80, 90, 20, 8, 'S-NEW'); v.rect(150, -40, 20, 8, 'S-NEW');
      v.line(250, 0, 700, 10, 'S-NEW'); v.line(250, -12, 700, -2, 'S-HIDDEN'); v.line(250, -146, 700, -136, 'S-CONC'); v.line(250, -95, 700, -86, 'S-NEW'); v.line(250, -105, 700, -96, 'S-NEW'); v.brk(700, 30, 700, -150);
      [380, 580].forEach(x => { v.rect(x - 10, -22 + (x - 250) * 0.022, 20, 10, 'S-NEW'); v.pl([[x - 10, -100], [x - 10, -60], [x + 10, -60], [x + 10, -100]], false, 'S-NEW'); v.line(x, 30, x, -40, 'S-CL'); });
      v.dim(240, 215, 250, 215, 12, '10'); { const a = v.P(250, 215), b = v.P(700, 215); Ln(B, a[0], a[1] + 12, b[0], b[1] + 12, 'S-DIM'); Arrow(B, a[0], a[1] + 12, 180, 'S-DIM', 2.2, 0.7); T(B, (a[0] + b[0]) / 2 + 4, a[1] + 13, 'WIDTH BETWEEN', { h: 2.2, al: 'c' }); T(B, (a[0] + b[0]) / 2 + 4, a[1] + 8.6, 'KERBS', { h: 2.2, al: 'c' }); Ln(B, a[0], a[1], a[0], a[1] + 14, 'S-DIM'); }
      v.leader(400, 3, 10, 20, 'EXPANSION ANGLE AND\nTOP OF RUNNING\nSURFACE', { h: 2.2 }); v.leader(520, -140, -12, -14, 'TOP OF CONCRETE DECK OR\nAPPROACH SLAB', { h: 2.2 });
      LY.title('SECTION E', 5);
    }
    // ---------------- notes
    LY.block(B => {
      const nb0 = NB(B, 0, 0, 'NOTE:\nEXPANSION ANGLES DRAWN FOR\nBRIDGE WITH CROSSFALL ONLY.\nEXPANSION ANGLES SIMILAR FOR\nBRIDGE WITH SUPERELEVATION.', { h: 2.2 });
      const sn = noSeal ? Wk + ' BETWEEN KERBS - NO ROAD SEAL' : '10 NOM. SETDOWN FOR ROAD SEAL'; const nb1 = NB(B, 0, nb0[1] - 5, sn, { h: 2.6, solid: true });
      let y = nb1[1] - 10; UT(B, 0, y, 'NOTES', 3.2); y -= 7;
      const y1 = y; y = para(B, 2, y, '1.', 'FOR GENERAL NOTES REFER TO DRG N° XX30-XXXX.', { h: 2.2, ls: 3.3, ind: 6, gap: 2 }); { const x = 8 + tw('FOR GENERAL NOTES REFER TO DRG N° ', 2.2); Box(B, x - 0.6, y1 - 1, x + tw('XX30-XXXX.', 2.2) + 0.6, y1 + 3.2, 'S-NOTE'); }
      y = para(B, 2, y, '2.', 'THE M10 TAPPED HOLES SHALL BE UTILISED TO ACCURATELY\nLOCATE AND FIX THE EXPANSION JOINT ANGLES DURING\nCONSTRUCTION, THESE HOLES SHALL BE TAPED TO PREVENT THE\nINGRESS OF CONCRETE DURING POURING.', { h: 2.2, ls: 3.3, ind: 6 });
      readWith(B, 0, y - 8);
    });
    return LY.done();
  }, 'Steel expansion angles (150x90x12 UA with anchor straps, half bridge width each) at the deck / approach slab joint of a concrete overlay; Types 1 and 2 are the two halves either side of the bridge centreline.');

})(typeof window !== "undefined" ? window : globalThis);
