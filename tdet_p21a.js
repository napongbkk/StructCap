/* StructCap Timber — repair details: Timber bridge repair manual PN30-2101 … 2116 (pile banding, pier pile repairs, strengthening).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions.
   Each detail reproduces its source sheet: views are placed where the sheet has them (sheet positions are measured on the
   low-res page image, 819 px across an A3 sheet, and converted to paper mm by K), drawn at the sheet scale. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ sheet helpers
  const K = 297 / 819; // paper mm per low-res sheet pixel
  const disc = (add, c, r, L) => { for (let i = 0; i < 20; i++) { const a0 = 2 * PI * i / 20, a1 = 2 * PI * (i + 1) / 20; add({ t: 'solid', p: [c, [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0)], [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)]], L: L || 'S-TITLE' }); } };
  // F = enlargement of the sheet layout (the A3 sheets are reductions: F = 20 / effective scale of a 1:20 view on the sheet)
  function Pg(land, F) {
    F = F || 1; const H = land ? 819 : 1158, B = new Builder(), add = e => B.E.push(e);
    const S = (x, y) => [x * K * F, (H - y) * K * F];
    const g = { B, S, F, add, pv: B.view(1, 0, 0), h: TH };
    g.view = (s, x, y) => B.view(s, ...S(x, y));
    // leader from model point to the shoulder at sheet px (sx, sy)
    // (sx, sy) = sheet px where the note text starts (left edge for text right of the arrow, right edge for text on the left), first line middle
    const sh = (v, x, y, sx, sy) => { const a = v.P(x, y), T = S(sx, sy), k = T[0] >= a[0] ? 1 : -1; return [T[0] - k * 3.5 - a[0], T[1] - a[1]]; };
    g.ld = (v, x, y, sx, sy, txt, opt) => { const d = sh(v, x, y, sx, sy); return v.leader(x, y, d[0], d[1], txt, Object.assign({ h: g.h }, opt || {})); };
    g.lds = (v, pts, sx, sy, txt, opt) => { const d = sh(v, pts[0][0], pts[0][1], sx, sy); return v.leaders(pts, d[0], d[1], txt, Object.assign({ h: g.h }, opt || {})); };
    g.wld = (v, x, y, sx, sy, o) => { const a = v.P(x, y), b = S(sx, sy); v.weld(x, y, b[0] - a[0], b[1] - a[1], o); };
    // note box with explicit line breaks (as on the sheet): dashed designer's note, or solid: true for a construction note.
    // (sx, sy) = top-left in sheet px; opt: h, w (paper width, default fits the longest line), c (centre the text)
    g.box = (sx, sy, txt, opt) => { opt = opt || {}; const p = S(sx, sy), h = opt.h || TH, L = String(txt).split('\n'), w = opt.w || max(...L.map(l => l.length)) * h * 0.7 + 5, Hh = L.length * h * 1.6 + 2.4;
      add({ t: 'pl', p: [p, [p[0] + w, p[1]], [p[0] + w, p[1] - Hh], [p[0], p[1] - Hh]], closed: true, L: opt.solid ? 'S-TEXT' : 'S-NOTE' });
      L.forEach((l, i) => add({ t: 'text', p: [opt.c ? p[0] + w / 2 : p[0] + 2.2, p[1] - 1.4 - h - i * h * 1.6], s: l, h, al: opt.c ? 'c' : 'l', v: 'b', ang: 0, L: 'S-TEXT' })); return [w, Hh]; };
    g.text = (sx, sy, s, h, al, v) => g.pv.text(...S(sx, sy), s, h || TH, al, v);
    g.mtext = (sx, sy, s, h, al) => g.pv.mtext(...S(sx, sy), s, h || TH, al);
    // view title centred at sheet px: underlined word, letter in a circle ('SECTION A'), scale and sub-lines under it
    g.title = (sx, sy, s, scale, sub, h) => { h = h || 3.4; const m = /^(SECTION|VIEW|DETAIL)\s+([A-Z0-9]{1,2})$/.exec(s), word = m ? m[1] : s, tw = word.length * h * 0.7, cw = m ? 9 : 0, c = S(sx, sy), x0 = c[0] - (tw + cw) / 2, y = c[1];
      add({ t: 'text', p: [x0, y], s: word, h, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); add({ t: 'line', a: [x0, y - 1.1], b: [x0 + tw, y - 1.1], L: 'S-TITLE' });
      if (m) { add({ t: 'circle', c: [x0 + tw + 5.2, y + h / 2], r: 3.1, L: 'S-TITLE' }); add({ t: 'text', p: [x0 + tw + 5.2, y + h / 2], s: m[2], h: 3.2, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); }
      let yy = y - 4.4; String(sub || '').split('\n').filter(Boolean).concat(scale ? ['1:' + scale] : []).forEach(l => { add({ t: 'text', p: [x0, yy], s: l, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.4; }); };
    // dashed leader (designer's note pointing at something): from sheet px (x1,y1) to an arrow at (x2,y2)
    g.dl = (x1, y1, x2, y2) => { const a = S(x1, y1), b = S(x2, y2); add({ t: 'line', a, b, L: 'S-NOTE' }); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); add({ t: 'solid', p: [b, [b[0] - 2.4 * Math.cos(ang) - 0.8 * Math.sin(ang), b[1] - 2.4 * Math.sin(ang) + 0.8 * Math.cos(ang)], [b[0] - 2.4 * Math.cos(ang) + 0.8 * Math.sin(ang), b[1] - 2.4 * Math.sin(ang) - 0.8 * Math.cos(ang)]], L: 'S-TEXT' }); };
    // main detail title (MRWA): symbol, underlined title, project drawing ref, sub-lines; (sx, sy) = start of the title text baseline
    g.main = (sx, sy, s, sym, ref, subs, h) => {
      h = h || 3.6; const p = S(sx, sy), tw = s.length * h * 0.7, c = [p[0] - 6, p[1] + h / 2];
      add({ t: 'text', p, s, h, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); add({ t: 'line', a: [p[0], p[1] - 1.2], b: [p[0] + tw, p[1] - 1.2], L: 'S-TITLE' });
      const ln = (x1, y1, x2, y2) => add({ t: 'line', a: [c[0] + x1, c[1] + y1], b: [c[0] + x2, c[1] + y2], L: 'S-TITLE' }), ci = r => add({ t: 'circle', c, r, L: 'S-TITLE' });
      if (sym === 'dcirc') { ci(2.6); ci(1.7); }
      else if (sym === 'xcirc') { ci(2.4); ln(-1.7, -1.7, 1.7, 1.7); ln(-1.7, 1.7, 1.7, -1.7); }
      else if (sym === 'target') { ci(2.0); ln(-3.4, 0, 3.4, 0); ln(0, -3.4, 0, 3.4); }
      else if (sym === 'cbar') { ci(2.2); ln(-4.4, 0, 4.4, 0); }
      else if (sym === 'ldot') { disc(add, c, 2.2); ln(-4.6, 0, 4.6, 0); }
      else if (sym === 'hdot') { disc(add, c, 2.0); ln(-4.6, 0, 4.6, 0); ln(-4.6, -2, -4.6, 2); ln(4.6, -2, 4.6, 2); }
      else if (sym === 'idot') { disc(add, [c[0] + 1.2, c[1]], 2.0); ln(-5.6, -2, -5.6, 2); ln(-6.8, 2, -4.4, 2); ln(-6.8, -2, -4.4, -2); }
      else if (sym !== 'none') disc(add, c, 2.0);
      if (ref) add({ t: 'text', p: [p[0] + tw + 4, p[1]], s: ref, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
      let yy = p[1] - 4.8; (subs || []).forEach(l => { add({ t: 'text', p: [p[0], yy], s: l, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); yy -= 3.4; });
      return [p[0] + tw + 4, p[1]];
    };
    g.done = () => B.E;
    return g;
  }
  // SL81 fabric seen edge-on: heavy line with small cross-wire dots
  function fab(v, x1, y1, x2, y2, sp) { v.line(x1, y1, x2, y2, 'S-REO'); const L = Math.hypot(x2 - x1, y2 - y1), n = max(1, Math.round(L / (sp || 200))); for (let i = 0; i <= n; i++) { const p = v.P(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n); v.add({ t: 'solid', p: [[p[0] - 0.3, p[1] - 0.3], [p[0] + 0.3, p[1] - 0.3], [p[0] + 0.3, p[1] + 0.3], [p[0] - 0.3, p[1] + 0.3]], L: 'S-REO' }); } }
  // tick mark (check) centred at paper point
  const tick = (g, x, y) => g.add({ t: 'pl', p: [[x - 1.4, y + 0.2], [x - 0.5, y - 0.9], [x + 1.5, y + 1.3]], closed: false, L: 'S-TEXT' });
  const DRG = 'DRG NUMBER - REFER TO\nPLAN DRAWING';
  const READ = 'THIS PAGE SHALL BE READ IN CONJUNCTION\nWITH:-\n• PIER HALFCAP REPAIRS (WITH STEEL PILE)\n• PILE BEARING';
  const GLBOX = 'EXISTING GENERAL G.L. OR PERMANENT W.L. OR HIGH TIDE - WHICH EVER IS HIGHER.';
  const PROP = 'NOTE: HALFCAPS SHALL BE PROPPED DURING CONSTRUCTION TO THEIR ORIGINAL POSITIONS AND UNTIL CONCRETE HAS BEEN PLACED A MINIMUM OF 3 DAYS.';
  const ENG = 'ENGINEER SHALL DECIDE WHICH\nOPTION TO USE';

  // ================================================================== PN30-2101 PILE BANDING TABLE
  def('pn2101', 'Piles', 'Pile banding table', 'PN30-2101', [P('rows', 'Blank table rows', 2, { num: 1 })], (p) => {
    const g = Pg(false), add = g.add, nb = max(0, min(8, Math.round(isFinite(+p.rows) ? +p.rows : 2)));
    g.box(418, 118, 'PLEASE PLACE A TICK\nIN THE APPROPRIATE\nLOCATION & NUMBER OFF\n(E.G. ✓✓ OR ✓x2)', { h: 2.8 });
    // table (sheet px): columns 55 197 295 397 499 601 705; header 307-350-395; rows 33 px
    const X = [55, 197, 295, 397, 499, 601, 705].map(x => x * K), y0 = g.S(0, 307)[1], y1 = g.S(0, 350)[1], y2 = g.S(0, 395)[1], rh = 33 * K;
    const rows = [['ABUT N° 1', 'X', 1, 2, 3, 'XXX'], ['PIER N° 1', 'X', '', 'M', '', 'XXX'], ['PIER N° X', 'X', '', '', '', 'XXX']];
    for (let i = 0; i < nb; i++) rows.push(['', '', '', '', '', '']);
    rows.push(['ABUT N° 2', '', '', '', '', 'XXX']);
    const yb = y2 - rows.length * rh, L = (a, b) => add({ t: 'line', a, b, L: 'S-TEXT' }), T = (x, y, s, h) => add({ t: 'text', p: [x, y], s, h: h || 2.8, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' });
    add({ t: 'pl', p: [[X[0], y0], [X[6], y0], [X[6], yb], [X[0], yb]], closed: true, L: 'S-TEXT' });
    L([X[0], y2], [X[6], y2]); L([X[2], y1], [X[5], y1]);
    [1, 2, 5].forEach(i => L([X[i], y0], [X[i], yb])); [3, 4].forEach(i => L([X[i], y1], [X[i], yb]));
    rows.forEach((r, i) => { const yc = y2 - (i + 0.5) * rh; if (i) L([X[0], y2 - i * rh], [X[6], y2 - i * rh]);
      r.forEach((c, j) => { const xc = (X[j] + X[j + 1]) / 2; if (typeof c === 'number') { for (let k = 0; k < c; k++) tick(g, xc + (k - (c - 1) / 2) * 4.2, yc - 0.3); } else if (c) T(xc, yc, c); }); });
    T((X[0] + X[1]) / 2, y0 - 6, 'SUPPORT'); T((X[1] + X[2]) / 2, y0 - 6, 'PILE N°'); T((X[2] + X[5]) / 2, (y0 + y1) / 2, 'LOCATION & N° OFF BANDS');
    T((X[2] + X[3]) / 2, (y1 + y2) / 2, 'TOP', 2.3); T((X[3] + X[4]) / 2, (y1 + y2) / 2, 'MIDDLE', 2.3); T((X[4] + X[5]) / 2, (y1 + y2) / 2, 'BOTTOM', 2.3);
    T((X[5] + X[6]) / 2, y0 - 5, 'NOM.'); T((X[5] + X[6]) / 2, y0 - 9.6, 'DIA. ✱'); T((X[5] + X[6]) / 2, y0 - 14.2, '(mm)');
    const yn = yb - 12; g.pv.mtext(150 * K, yn, 'M - DENOTES MULTI BANDS AT 600 MAX. CENTRES\nFOR LENGTH OF SPLIT.\n✱ DIAMETERS SHOWN ARE TAKEN FROM THE "DETAILED\nINSPECTION REPORT" AND SHALL BE VERIFIED ON SITE AT\nSPLIT LOCATIONS.', 2.4);
    // the two alternative captions with the designer's note between them
    const cap = (y, sub) => { const sx = 180, c = [sx * K - 6, y + 2.2]; add({ t: 'circle', c, r: 3.4, L: 'S-TITLE' }); add({ t: 'circle', c, r: 2.4, L: 'S-TITLE' }); add({ t: 'text', p: [sx * K, y], s: 'PILE BANDING TABLE', h: 4.4, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); add({ t: 'line', a: [sx * K, y - 1.4], b: [sx * K + 18 * 4.4 * 0.7, y - 1.4], L: 'S-TITLE' }); add({ t: 'text', p: [sx * K, y - 7], s: sub, h: 2.8, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); };
    const yt1 = yn - 30; cap(yt1, 'REFER TO STANDARD DRG. N° 9530-0072'); cap(yt1 - 62, 'REFER TO PILE BEARING DETAIL - TYPE 3 (XX30-XXXX)');
    const bx = 140, by = yt1 - 22; g.box(bx / K, 1158 - by / K, 'REFER TO STANDARD DRG\nOR RELEVANT PROJECT DRG.', { h: 2.6 });
    const dl = (a, b) => { add({ t: 'line', a, b, L: 'S-NOTE' }); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); add({ t: 'solid', p: [b, [b[0] - 2.4 * Math.cos(ang) - 0.8 * Math.sin(ang), b[1] - 2.4 * Math.sin(ang) + 0.8 * Math.cos(ang)], [b[0] - 2.4 * Math.cos(ang) + 0.8 * Math.sin(ang), b[1] - 2.4 * Math.sin(ang) - 0.8 * Math.cos(ang)]], L: 'S-TEXT' }); };
    dl([bx + 22, by], [bx - 10, yt1 - 9.5]); dl([bx + 20, by - 12.2], [bx - 12, yt1 - 58]);
    return g.done();
  }, 'Pile banding schedule (support, pile, band locations top / middle / bottom, nominal diameter) to go with the standard banding drawing or pile banding Type 3.');

  // ================================================================== PN30-2102 PILE BANDING DETAIL - TYPE 3
  def('pb3', 'Piles', 'Pile banding – Type 3 (welded band)', 'PN30-2102', [P('D', 'Pile dia. (mm)', 400, { num: 1 }), P('nb', 'Bands (see banding table)', 3, { num: 1 })], (p) => {
    const g = Pg(false), D = max(200, min(600, +p.D || 400)), R = D / 2, v = g.view(5, 283, 560);
    g.box(85, 150, 'NOTE:\nREMOVE ANY FOREIGN MATTER FROM TIMBER PILE\nGAPS.\nPRECOMPRESS PILE RADIALLY TO CLOSE ALL\nGAPS USING CHAIN AND RATCHET.\nINSTALL STEEL BAND THEN FILLET WELD CLOSE\nWHILE APPLYING TENSION FROM A SECOND CHAIN\nAND RATCHET WHICH IS TACK WELDED TO BAND.', { solid: true, h: 3.2 });
    v.circ(0, 0, R, 'S-EXIST'); v.arc(0, 0, R + 5, 100, 450, 'S-NEW'); v.arc(0, 0, R + 10, 100, 450, 'S-NEW');
    // band end lapping inside, and the closing weld at the lap
    v.arc(0, 0, R + 1, 150, 178, 'S-NEW'); v.arc(0, 0, R + 15, 70, 100, 'S-NEW'); v.arc(0, 0, R + 12, 70, 100, 'S-NEW');
    v.line(-R - 60, 0, R + 70, 0, 'S-CL'); v.line(0, -R - 70, 0, R + 70, 'S-CL');
    const pa = a => [(R + 15) * Math.cos(a * PI / 180), (R + 15) * Math.sin(a * PI / 180)], w = pa(80), b = pa(42);
    const a0 = v.P(w[0], w[1]), e = g.S(440, 350); v.weld(w[0], w[1], e[0] - a0[0], e[1] - a0[1], { size: '4', site: true });
    const bb = [(R + 10) * Math.cos(42 * PI / 180), (R + 10) * Math.sin(42 * PI / 180)]; g.ld(v, bb[0], bb[1], 465, 428, '50x5FL\nBAND', { h: 3.2 });
    g.ld(v, 0.25 * R, -0.12 * R, 472, 663, 'PILE CORE', { dot: true, h: 3.2 });
    g.title(283, 765, 'PLAN');
    g.main(180, 852, 'PILE BANDING DETAIL - TYPE 3', 'dcirc', null, ['N.T.S'], 4.4);
    g.box(85, 925, 'NOTE:\nTHIS IS THE NON-PREFERRED BANDING METHOD.\nFOR THE PREFERRED BANDING METHOD REFER\nTO STANDARD DRAWING N° 9530-0072.', { h: 3.2 });
    return g.done();
  }, 'Non-preferred banding of a split timber pile with a site-welded 50x5 flat band (preferred method: standard drawing 9530-0072).');

  // ================================================================== PIER PILE REPAIRS TYPES 1/1A, 2/2A, 3/3A, 6/6A (shared drawing)
  // local model coordinates: x across the pile, y up, y = 0 at existing G.L.; Type 3 is drawn in a rotated view (raked pile).
  const POT = { R: 450, te: 150, tc: 170, cut: -550, bot: -1300 };
  function rotView(v, deg, cx, cy) { const r = Object.create(v), a = deg * PI / 180, c = Math.cos(a), s = Math.sin(a);
    r.P = function (x, y) { const dx = x - cx, dy = y - cy; return v.P(cx + dx * c - dy * s, cy + dx * s + dy * c); };
    r.arc = function (x, y, R, a0, a1, L) { const q = this.P(x, y), pp = v.P(0, 0); return v.add({ t: 'arc', c: q, r: R / v.s, a0: a0 + deg, a1: a1 + deg, L: L || 'S-NEW' }); };
    return r; }
  // solid wedge marker (left end of a section line) at paper point, and the circle marker at the right end
  function secLine(v, x1, x2, y, ch) { const a = v.P(x1, y), b = v.P(x2, y), add = e => v.add(e);
    add({ t: 'line', a: [a[0] - 9, a[1]], b: [a[0] + 2, a[1]], L: 'S-TITLE' }); add({ t: 'solid', p: [[a[0] - 8, a[1]], [a[0] - 1, a[1]], [a[0] - 4.5, a[1] - 2.4]], L: 'S-TITLE' });
    add({ t: 'line', a: [b[0] - 2, b[1]], b: [b[0] + 6, b[1]], L: 'S-TITLE' }); const c = [b[0] + 9, b[1]]; add({ t: 'circle', c, r: 3, L: 'S-TITLE' }); add({ t: 'text', p: c, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); add({ t: 'solid', p: [[c[0] - 1.6, c[1] - 2.5], [c[0] + 1.6, c[1] - 2.5], [c[0], c[1] - 4.6]], L: 'S-TITLE' }); }
  // view marker pointing left (circle with a pointer) at paper point
  function viewMark(v, x, y, ch) { const c = v.P(x, y); v.add({ t: 'circle', c, r: 3, L: 'S-TITLE' }); v.add({ t: 'text', p: c, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); v.add({ t: 'solid', p: [[c[0] - 2.5, c[1] + 1.6], [c[0] - 2.5, c[1] - 1.6], [c[0] - 4.6, c[1]]], L: 'S-TITLE' }); }
  // "U2" surface finish tick on the pot top
  function u2(v, x, y) { const p = v.P(x, y); v.add({ t: 'pl', p: [[p[0] - 1.6, p[1] + 2.2], p, [p[0] + 2.6, p[1] + 3.6]], closed: false, L: 'S-TEXT' }); v.add({ t: 'text', p: [p[0] + 0.4, p[1] + 3.4], s: 'U2', h: 2.0, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); }
  // "<4" weld note on the fabric (paper offset to the right of the model point)
  function w4(v, x, y) { const p = v.P(x, y); v.add({ t: 'pl', p: [[p[0] + 3, p[1] + 2.2], p, [p[0] + 3, p[1] - 2.2]], closed: false, L: 'S-TEXT' }); v.add({ t: 'text', p: [p[0] + 2.4, p[1] - 0.8], s: '4', h: 2.0, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }
  // hoop bar sketch with the 500 lap, top-left at paper point
  function hoop(add, x, y) { const c = [x + 3.4, y - 3.4]; add({ t: 'arc', c, r: 3.2, a0: -70, a1: 250, L: 'S-REO' }); add({ t: 'arc', c, r: 3.6, a0: -110, a1: -60, L: 'S-REO' });
    add({ t: 'line', a: [c[0] - 0.6, c[1] - 3.4], b: [c[0] - 0.6, c[1] - 7.6], L: 'S-TEXT' }); add({ t: 'line', a: [c[0] + 0.6, c[1] - 3.4], b: [c[0] + 0.6, c[1] - 7.6], L: 'S-TEXT' });
    const yy = c[1] - 6; add({ t: 'line', a: [c[0] - 5.5, yy], b: [c[0] - 0.6, yy], L: 'S-DIM' }); add({ t: 'line', a: [c[0] + 0.6, yy], b: [c[0] + 5.5, yy], L: 'S-DIM' });
    add({ t: 'solid', p: [[c[0] - 0.6, yy], [c[0] - 2.6, yy + 0.6], [c[0] - 2.6, yy - 0.6]], L: 'S-DIM' }); add({ t: 'solid', p: [[c[0] + 0.6, yy], [c[0] + 2.6, yy + 0.6], [c[0] + 2.6, yy - 0.6]], L: 'S-DIM' });
    add({ t: 'text', p: [c[0] - 6, yy + 0.8], s: '500', h: 2.0, al: 'r', v: 'b', ang: 0, L: 'S-DIM' }); add({ t: 'line', a: [c[0] - 11, yy + 0.3], b: [c[0] - 6, yy + 0.3], L: 'S-DIM' }); add({ t: 'text', p: [c[0] - 6, yy - 0.8], s: 'LAP', h: 2.0, al: 'r', v: 't', ang: 0, L: 'S-DIM' }); }
  // concrete aggregate marks (few triangles and dots) about a model point
  function agg(v, x, y, k) { k = k || 1; [[0, 0], [40, 30], [-35, 25], [20, -35], [-25, -30], [55, -10]].forEach(([dx, dy], i) => { const p = v.P(x + dx * k, y + dy * k); if (i % 2) v.add({ t: 'circle', c: p, r: 0.25, L: 'S-HATCH' }); else v.add({ t: 'pl', p: [[p[0] - 0.7, p[1] - 0.5], [p[0] + 0.7, p[1] - 0.5], [p[0], p[1] + 0.7]], closed: true, L: 'S-HATCH' }); }); }
  // horizontal "75 CLEAR COVER" note under the pot (model x of the pot face xf, inside face xf+k*75; k = +1 left face)
  function cover(v, xf, k, yb, lbl) { const y = yb - 230; v.line(xf, yb - 40, xf, y - 60, 'S-DIM'); v.line(xf + k * 75, yb - 40, xf + k * 75, y - 60, 'S-DIM');
    const a = v.P(xf, y), b = v.P(xf + k * 75, y), add = e => v.add(e), s = -k;
    add({ t: 'line', a: [a[0] + s * 16, a[1]], b: a, L: 'S-DIM' }); add({ t: 'solid', p: [a, [a[0] + s * 2.2, a[1] + 0.7], [a[0] + s * 2.2, a[1] - 0.7]], L: 'S-DIM' });
    add({ t: 'line', a: [b[0] - s * 5, b[1]], b, L: 'S-DIM' }); add({ t: 'solid', p: [b, [b[0] - s * 2.2, b[1] + 0.7], [b[0] - s * 2.2, b[1] - 0.7]], L: 'S-DIM' });
    const L = lbl.split('\n'); add({ t: 'text', p: [a[0] + s * 8, a[1] + 0.8], s: L[0], h: TH, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); add({ t: 'text', p: [a[0] + s * 8, a[1] - 0.8], s: L[1], h: TH, al: 'c', v: 't', ang: 0, L: 'S-TEXT' }); }
  // existing general G.L. label in its dashed box with the level triangle; returns the paper box corners
  function glLabel(v, x, txt) { const p = v.P(x, 0), w = txt.length * TH * 0.62 + 4; v.wl(x, 0, txt); v.add({ t: 'pl', p: [[p[0] - 5, p[1] + 1], [p[0] - 5 + w + 2, p[1] + 1], [p[0] - 5 + w + 2, p[1] + 7.6], [p[0] - 5, p[1] + 7.6]], closed: true, L: 'S-NOTE' }); return [p[0] - 5, p[1] + 1, p[0] - 3 + w, p[1] + 7.6]; }

  // elevation of the repair. o: { t: '1'|'2'|'3'|'6', bolted, D, s (UC), bp (base plate), side (view on the UC web), hoop: -1|1, top (UC top, types 2/3/6) }
  function pierElev(v, o) {
    const { R, te, tc, cut, bot } = POT, D = o.D, s = o.s, t = o.t, side = !!o.side, w = side ? s.d : s.b, hw = w / 2, q = {};
    const big = D >= 350, ucb = o.bolted ? cut + (big ? 10 : 0) + 6 : cut + 12, ytop = t === '1' ? tc - 12 : (o.top || 900);
    // concrete pot (open where the pile and the UC pass)
    const tw = t === '1' ? D / 2 + 75 : hw;
    v.pl([[-D / 2, bot], [-R, bot], [-R, te], [-tw, te + (R - tw) / R * 20 * 0 + 20 * (1 - (R - tw) / R) + 0]], false, 'S-CONC');
    v.pl([[D / 2, bot], [R, bot], [R, te], [tw, te + 20 * (1 - (R - tw) / R)]], false, 'S-CONC');
    v.line(-tw, te + 20 * (1 - (R - tw) / R), tw, te + 20 * (1 - (R - tw) / R), 'S-HIDDEN');
    // reinforcement: SL81 fabric both faces, N16 hoops top and bottom, radial spikes into the timber
    const rf = R - 75; fab(v, -rf, bot + 75, -rf, te - 75, 100); fab(v, rf, bot + 75, rf, te - 75, 100);
    const hx = (o.hoop || -1) * (rf - 18); [te - 85, bot + 85].forEach(y => { v.circ(hx, y, 22, 'S-REO'); v.barEnd(hx + (o.hoop || -1) * 8, y, 16); });
    const ys = cut - 375; v.spike(-rf, ys, -rf + 250, ys); v.spike(rf, ys, rf - 250, ys); v.circ(0, ys, 5, 'S-CL');
    q.spikeH = [rf - 120, ys]; q.fab = [rf, ys + 150]; q.fabL = [-rf, bot + 250]; q.hoop = [hx, te - 85]; q.hoopB = [hx, bot + 85];
    // existing timber pile stump (cut surface, sides, break) and centre line
    const tl = o.tail || 420; v.line(-D / 2, cut, D / 2, cut, 'S-EXIST'); pileElev(v, 0, bot - tl, cut, D); v.line(0, bot - tl - 100, 0, ytop + 120, 'S-CL');
    q.cut = [D / 2 - 10, cut]; q.pile = [D / 2, bot - min(200, tl / 2)];
    // steel pile
    if (o.bolted) {
      if (big) v.rect(-75, cut, 150, 10, 'S-NEW'); v.rect(-45, cut + (big ? 10 : 0), 90, 6, 'S-HIDDEN');
      if (side) { const t2 = o.ea ? 12 : 10, lv = o.ea ? 150 : 100, lh = o.ea ? 150 : 150;
        [-1, 1].forEach(k => { const x0 = k * hw; if (big && !o.ea) v.pl([[x0, cut + lv], [x0 + k * t2, cut + lv], [x0 + k * t2, cut + t2], [x0 + k * lh, cut + t2], [x0 + k * lh, cut], [x0, cut]], true, 'S-NEW');
          else v.pl([[x0, cut + lv], [x0 + k * t2, cut + lv], [x0 + k * t2, cut], [x0 - k * (lh - t2) , cut], [x0 - k * (lh - t2), cut + t2], [x0, cut + t2]], true, 'S-NEW');
          v.bolt(x0 + k * (t2 + 2), cut + (o.ea ? 90 : 60), x0 - k * (o.ea ? s.tf : s.tf) - k * 2, cut + (o.ea ? 90 : 60), 20);
          const sx = big && !o.ea ? x0 + k * 95 : x0 - k * 55; v.spike(sx, cut + t2, sx, cut - 100); });
        q.ang = [hw + 12, cut + 60]; q.bp = [40, cut + 5]; q.sp100 = [big ? hw + 95 : hw - 55, cut - 60]; q.shim = [10, cut + (big ? 13 : 3)];
      } else { const lv = o.ea ? 150 : 100, L = 300; v.rect(-L / 2, cut, L, lv, 'S-NEW'); [-70, 70].forEach(x => v.circ(x, cut + (o.ea ? 90 : 60), 11, 'S-BOLT')); q.ang = [L / 2, cut + lv * 0.6]; }
    } else { v.rect(-o.bp / 2, cut, o.bp, 12, 'S-NEW'); [-50, 50].forEach(x => v.spike(x, cut, x, cut - 100)); q.bp = [o.bp / 2 - 20, cut + 6]; q.sp100 = [50, cut - 50]; }
    if (side) iElevWebV(v, 0, ucb, ytop, s); else iElevFlange(v, 0, ucb, ytop, s);
    q.uc = [hw, (ucb + min(ytop, 600)) / 2 + (t === '1' ? -120 : 200)]; q.ucb = [hw, ucb + 30];
    if (t !== '1') { v.brk(-hw - 20, ytop, hw + 20, ytop, 'S-NEW'); }
    else { // cap plate, timber pile above, 4-200 PFC clamps with φ20 rods in PVC sleeves
      v.rect(-125, tc - 12, 250, 12, 'S-NEW'); v.spike(-60, tc, -60, tc + 100); q.cap = [110, tc - 6];
      pileElev(v, 0, tc, tc + 1150, D, 'S-EXIST'); v.pileEnd(0, tc + 1150, D, 'S-EXIST'); v.line(-D / 2, cut, -D / 2, tc, 'S-EXIST'); v.line(D / 2, cut, D / 2, tc, 'S-EXIST');
      const c = SEC['200PFC'], o1 = side ? 50 : 0, o2 = side ? 0 : 50, b1 = tc - 500 + o1, b2 = tc - 500 + o2;
      pfcElevV(v, -D / 2, b1, b1 + 1050, c, -1); pfcElevV(v, D / 2, b1, b1 + 1050, c, 1);
      v.rect(-100, b2, 200, 1050, 'S-NEW'); v.line(-100 + c.tf, b2, -100 + c.tf, b2 + 1050, 'S-NEW'); v.line(100 - c.tf, b2, 100 - c.tf, b2 + 1050, 'S-NEW');
      [b1 + 950, b1 + 650].forEach(y => v.bolt(-D / 2 - c.tw, y, D / 2 + c.tw, y, 20)); [b2 + 950, b2 + 650].forEach(y => v.circ(0, y, 11, 'S-BOLT'));
      q.pfc = [D / 2 + c.b, b1 + 1000]; q.seal = [0, tc + 2]; q.b1 = b1; q.b2 = b2;
    }
    u2(v, R - 70, te + 20 * 70 / R); w4(v, R + 4, cut + 60);
    return q;
  }
  // standard dimensions on the left of the elevation (x0 = model x of the dimension lines)
  function pierDims(v, o, xa, xb, xe) { const { R, te, tc, cut, bot } = POT;
    v.dim(xa, bot, xa, te, 0, o.t === '6' ? '1250 MINIMUM' : '1250 MIN' + (o.t === '3' ? '.' : ''), o.t === '6' ? { sub: 'φ900 CONCRETE PILE POT' } : null);
    v.line(-R - 40, bot, xa - 40, bot, 'S-DIM'); v.line(-R - 40, te, xa - 40, te, 'S-DIM');
    v.dim(xb, bot, xb, cut, 0, '750'); v.dimChain([[xe, bot], [xe, cut - 375], [xe, cut]], 0, ['=', '=']); v.line(-D2(o) - 30, cut, min(xb, xe) - 40, cut, 'S-DIM'); v.line(-R - 30, cut - 375, xe - 40, cut - 375, 'S-DIM'); }
  const D2 = o => o.D / 2;
  // pot section at the base (plan): o as above; marks q
  function potPlan(v, o) {
    const { R } = POT, D = o.D, s = o.s, rf = R - 75, q = {};
    v.circ(0, 0, R, 'S-CONC'); v.circ(0, 0, rf, 'S-REO'); if (o.lapR) { v.arc(0, 0, rf - 12, 30, 68, 'S-REO'); v.arc(0, 0, rf - 12, 210, 248, 'S-REO'); } else { v.arc(0, 0, rf - 12, 112, 150, 'S-REO'); v.arc(0, 0, rf - 12, 292, 330, 'S-REO'); }
    for (let a = 0; a < 360; a += 12) { const p = v.P((rf - 8) * Math.cos(a * PI / 180), (rf - 8) * Math.sin(a * PI / 180)); v.add({ t: 'solid', p: [[p[0] - 0.3, p[1] - 0.3], [p[0] + 0.3, p[1] - 0.3], [p[0] + 0.3, p[1] + 0.3], [p[0] - 0.3, p[1] + 0.3]], L: 'S-REO' }); }
    v.circ(0, 0, D / 2, 'S-EXIST');
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => v.spike(a * rf, b * rf, a * (rf - 250), b * (rf - 250)));
    if (o.bolted) {
      const big = D >= 350; iSec(v, 0, 0, s, 0); v.rect(-45, -45, 90, 90, 'S-HIDDEN');
      if (o.ea) { [-1, 1].forEach(k => { v.rect(-150, k > 0 ? 0 : -s.d / 2 + s.tf, 300, s.d / 2 - s.tf, 'S-HIDDEN'); [-70, 70].forEach(x => v.bolt(x, k * (s.d / 2 - s.tf - 2), x, k * (s.d / 2 + 14), 20)); v.circ(110, k * 90, 6, 'S-BOLT'); }); q.ea = [150, s.d / 4]; }
      else { if (big) v.rect(-75, -75, 150, 150, 'S-HIDDEN'); [-1, 1].forEach(k => { const y0 = k * s.d / 2, y1 = big ? y0 + k * 150 : y0 - k * 150; v.rect(-150, min(y0, y1), 300, 150, big ? 'S-NEW' : 'S-HIDDEN'); [-70, 70].forEach(x => v.bolt(x, y0 - k * (s.tf + 2), x, y0 + k * 12, 20)); v.circ(0, y0 + k * (big ? 110 : -60), 6, 'S-BOLT'); }); q.ang = [150, s.d / 2 + 75]; }
      q.uc = [s.b / 2, 0]; q.shim = [30, 30];
    } else { v.rect(-o.bp / 2, -o.bp / 2, o.bp, o.bp, 'S-NEW'); iSec(v, 0, 0, s, 0); v.fill(...[[[-s.b / 2, s.d / 2], [s.b / 2, s.d / 2], [s.b / 2, s.d / 2 - s.tf], [-s.b / 2, s.d / 2 - s.tf]]]); v.fill([[-s.b / 2, -s.d / 2], [s.b / 2, -s.d / 2], [s.b / 2, -s.d / 2 + s.tf], [-s.b / 2, -s.d / 2 + s.tf]]); v.rect(-45, -45, 90, 90, 'S-HIDDEN'); [-1, 1].forEach(k => v.circ(k * (s.b / 2 - 35), k * 0, 6, 'S-BOLT')); q.bp = [o.bp / 2, -o.bp / 2 + 30]; q.uc = [s.b / 2, s.d / 2]; q.sp100 = [s.b / 2 - 35, 0]; }
    q.fab = [rf * Math.cos(-0.5), rf * Math.sin(-0.5)]; q.pot = [R * Math.cos(-2.3), R * Math.sin(-2.3)]; q.sp250 = [-rf + 60, 0]; q.shim = q.shim || [20, -20];
    // 300 LAP (TYP) on the fabric lap
    const r2 = R + 140, a0 = o.lapR ? 30 : 112, a1 = o.lapR ? 68 : 150, P2 = a => [r2 * Math.cos(a * PI / 180), r2 * Math.sin(a * PI / 180)];
    v.arc(0, 0, r2, a0, a1, 'S-DIM'); [a0, a1].forEach(a => { const c = Math.cos(a * PI / 180), sn = Math.sin(a * PI / 180); v.line((rf - 10) * c, (rf - 10) * sn, (r2 + 30) * c, (r2 + 30) * sn, 'S-DIM'); });
    [[a0, 1], [a1, -1]].forEach(([a, k]) => { const p = v.P(...P2(a)), t = (a + 90 * k) * PI / 180; v.add({ t: 'solid', p: [p, [p[0] + 2.2 * Math.cos(t) - 0.7 * Math.sin(t), p[1] + 2.2 * Math.sin(t) + 0.7 * Math.cos(t)], [p[0] + 2.2 * Math.cos(t) + 0.7 * Math.sin(t), p[1] + 2.2 * Math.sin(t) - 0.7 * Math.cos(t)]], L: 'S-DIM' }); });
    const am = (a0 + a1) / 2, pm = v.P(...P2(am)), ta = am - 90; v.add({ t: 'text', p: [pm[0] + 1.0 * Math.cos(am * PI / 180), pm[1] + 1.0 * Math.sin(am * PI / 180)], s: '300 LAP', h: 2.2, al: 'c', v: 'b', ang: ta, L: 'S-DIM' }); v.add({ t: 'text', p: [pm[0] - 1.0 * Math.cos(am * PI / 180), pm[1] - 1.0 * Math.sin(am * PI / 180)], s: '(TYP)', h: 2.2, al: 'c', v: 't', ang: ta, L: 'S-DIM' });
    return q;
  }
  function flow(v, x, y, left) { const p = v.P(x, y); if (left === 'down') { v.add({ t: 'solid', p: [[p[0] - 1.3, p[1]], [p[0] + 1.3, p[1]], [p[0], p[1] - 4.5]], L: 'S-TITLE' }); v.add({ t: 'text', p: [p[0] + 1.0, p[1] + 1], s: 'FLOW', h: 2.4, al: 'l', v: 'b', ang: 90, L: 'S-TITLE' }); return; } if (left) { v.add({ t: 'solid', p: [[p[0], p[1] + 1.2], [p[0] - 4.5, p[1] + 1.2 - 1.2], [p[0], p[1] - 1.2]], L: 'S-TITLE' }); v.add({ t: 'text', p: [p[0] + 0.8, p[1] - 1.1], s: 'FLOW', h: 2.4, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); } else { v.add({ t: 'text', p: [p[0] - 0.8, p[1] - 1.1], s: 'FLOW', h: 2.4, al: 'r', v: 'b', ang: 0, L: 'S-TITLE' }); v.add({ t: 'solid', p: [[p[0], p[1] + 1.2], [p[0] + 4.5, p[1]], [p[0], p[1] - 1.2]], L: 'S-TITLE' }); } }
  // section A of Types 1 / 1A: the PFC clamp above the cap plate
  function capPlan(v, o) { const D = o.D, s = o.s, c = SEC['200PFC'], q = {};
    v.circ(0, 0, D / 2, 'S-HIDDEN'); v.rect(-125, -125, 250, 250, 'S-HIDDEN'); iSec(v, 0, 0, s, 0, 'S-HIDDEN');
    cSec(v, -D / 2, 0, c, -1); cSec(v, D / 2, 0, c, 1); cSecH(v, 0, D / 2, c, 1); cSecH(v, 0, -D / 2, c, -1);
    v.bolt(-D / 2 - c.tw, 0, D / 2 + c.tw, 0, 20); v.bolt(0, -D / 2 - c.tw, 0, D / 2 + c.tw, 20);
    v.circ(60, 60, 6, 'S-BOLT'); v.circ(-60, -60, 6, 'S-BOLT'); q.cap = [-110, 125]; q.rod = [D / 2 + c.tw + 30, 0]; q.sp = [-60, -60];
    return q; }

  // bearing arrangement for piles < φ350 (1:10): UC end on the inward-turned angle legs, pot shown broken
  function bearSmall(g, v, o) { const s = o.s, hw = s.d / 2, D = 300, c0 = 0, q = {}, tl = 10, lh = 100, lv = 100;
    // pot (broken all round) with aggregate
    const X0 = -300, X1 = 330, Y0 = -170, Y1 = 230; v.line(X0, Y0 + 40, X0, Y1, 'S-CONC'); v.line(X1, Y0, X1, Y1 - 10, 'S-CONC'); v.line(X0, Y1, -hw - 20, Y1, 'S-CONC'); v.line(hw + 20, Y1, X1, Y1, 'S-CONC'); v.line(X0, Y0, -D / 2, Y0, 'S-CONC'); v.line(D / 2, Y0, X1, Y0, 'S-CONC');
    v.brk(X0, Y1, -hw - 20, Y1, 'S-CONC'); v.brk(hw + 20, Y1, X1, Y1, 'S-CONC'); v.brk(X0, Y0, -D / 2, Y0, 'S-CONC'); v.brk(D / 2, Y0, X1, Y0, 'S-CONC'); v.brk(X0, Y0 + 40, X0, Y1, 'S-CONC'); v.brk(X1, Y0, X1, Y1 - 10, 'S-CONC');
    agg(v, -210, 50, 0.9); agg(v, 230, -50, 0.9);
    // timber pile below the cut (φ < 350)
    v.line(-D / 2, 0, D / 2, 0, 'S-EXIST'); v.line(-D / 2, 0, -D / 2, -290, 'S-EXIST'); v.line(D / 2, 0, D / 2, -290, 'S-EXIST'); v.pileEnd(0, -290, D, 'S-EXIST');
    // angles: vertical legs outside the flanges, horizontal legs turned in under the UC; shim; UC above
    [-1, 1].forEach(k => { const x0 = k * hw; v.pl([[x0 + k * tl, lv], [x0, lv], [x0, tl + 0], [x0 - k * (lh - tl), tl], [x0 - k * (lh - tl), 0], [x0 + k * tl, 0]], true, 'S-NEW');
      v.bolt(x0 + k * (tl + 2), 65, x0 - k * (s.tf + 2), 65, 20); v.spike(x0 - k * 55, tl, x0 - k * 55, -100); });
    v.rect(-45, tl, 90, 6, 'S-NEW'); iElevWebV(v, 0, tl + 6, 420, s); v.brk(-hw - 15, 420, hw + 15, 420, 'S-NEW');
    if (o.t === '1') [-1, 1].forEach(k => { v.rect(k > 0 ? 150 : -225, 160, 75, 260, 'S-NEW'); v.line(k > 0 ? 156 : -156, 160, k > 0 ? 156 : -156, 420, 'S-HIDDEN'); v.brk(k > 0 ? 140 : -235, 420, k > 0 ? 235 : -140, 420, 'S-NEW'); });
    v.dim(-D / 2, -150, -hw + 55, -150, 0, '55', { sub: '(TYP)' }); v.dim(-D / 2, -400, D / 2, -400, 0, 'φ < 350');
    q.shim = [10, tl + 3]; q.uc = [hw, 300]; q.ang = [-hw - tl, 40]; q.pot = [200, 150]; q.sp = [hw - 55, -60]; q.pile = [D / 2 - 20, -160];
    return q; }
  // the common text blocks on the Type 1 – 6 sheets
  function pierBoxes(g, at) { if (at.read) g.box(...at.read, READ, { h: g.h }); if (at.prop) g.box(...at.prop, PROP.replace(/^NOTE: HALFCAPS SHALL BE PROPPED /, 'NOTE: HALFCAPS SHALL BE PROPPED\n').replace('CONSTRUCTION TO THEIR ', 'CONSTRUCTION TO THEIR\n').replace('POSITIONS AND UNTIL ', 'POSITIONS AND UNTIL\n').replace('PLACED A ', 'PLACED A\n'), { solid: true, h: g.h });
    if (at.opt) g.box(...at.opt[0], at.opt[1], { h: 3.4, w: at.opt[2], c: 1 }); if (at.eng) g.box(...at.eng, ENG, { h: g.h }); }
  const ucName = p => secName(SEC[p.uc] ? p.uc : '200UC52');

  // ---------------------------------------------------------------- PN30-2103 / 2104 TYPE 1 (welded) / 1A (bolted)
  function sheetT1(p, bolted) {
    const g = Pg(bolted, bolted ? 1.45 : 1.1), s = SEC[p.uc] || SEC['200UC52'], D = max(250, min(500, +p.D || 400)), o = { t: '1', bolted, D, s, bp: 250, hoop: -1 }, un = ucName(p);
    g.h = 2.5; const L = bolted ? { A: [243, 52], Bs: [250, 240], E: [252, 464] } : { A: [360, 182], Bs: [360, 415], E: [361, 723] };
    // SECTION A (PFC clamp)
    const va = g.view(20, ...L.A), qa = capPlan(va, o);
    if (bolted) { g.ld(va, ...qa.cap, 212, 39, 'CAP PLATE'); g.ld(va, ...qa.rod, 300, 22, 'φ20 THREADED ROD TO\nBE PLACED IN HEAVY DUTY\nPVC SLEEVE AND PACKED\nWITH DENSO PASTE (TYP)'); g.ld(va, ...qa.sp, 203, 92, 'φ10x100 LONG\nSPIKE (TYP)'); g.title(243, 130, 'SECTION A', 20); }
    else { g.ld(va, ...qa.cap, 290, 148, 'CAP PLATE'); g.ld(va, ...qa.rod, 405, 160, 'φ20 THREADED ROD TO\nBE PLACED IN HEAVY DUTY\nPVC SLEEVE AND PACKED\nWITH DENSO PASTE (TYP)'); g.ld(va, ...qa.sp, 282, 213, 'φ10x100 LONG\nSPIKE (TYP)'); g.title(360, 250, 'SECTION A', 20); }
    // SECTION B (pot)
    const vb = g.view(20, ...L.Bs), qb = potPlan(vb, o);
    if (bolted) {
      g.ld(vb, -60, s.d / 2 + 110, 180, 205, 'BEARING PLATE\n(FOR PILE > φ350)'); flow(vb, -640, 0, false); g.ld(vb, ...qb.pot, 172, 280, 'φ900 CONCRETE\nFOOTING');
      g.ld(vb, 375 * Math.cos(1.1), 375 * Math.sin(1.1), 282, 185, 'SL81 FABRIC\nTYP'); g.ld(vb, ...qb.shim, 325, 220, "SHIM BETWEEN UC AND BEARING PLATE\nFOR PILE > φ350 OR BETWEEN UC AND\nUA's FOR PILE < φ350 TO ENSURE A\nTIGHT FIT BETWEEN CUT PILE FACES"); g.ld(vb, 0, -s.d / 2 - 110, 325, 276, 'φ10x100 LONG\nSPIKE (TYP)');
      g.title(250, 315, 'SECTION B', 20);
    } else {
      g.ld(vb, -30, 30, 238, 383, 'SHIM 90x90x\nTHICKNESS TO\nSUIT (TYP)'); g.ld(vb, ...qb.pot, 232, 460, 'φ900 CONCRETE\nFOOTING'); g.ld(vb, -s.b / 2 + 35, 0, 248, 490, 'φ10x100 LONG\nSPIKE (TYP)');
      g.ld(vb, 0, 160, 405, 322, 'φ10x250 LONG\nSPIKE (TYP)'); g.ld(vb, ...qb.fab, 445, 398, 'SL81 FABRIC\n(TYP)'); g.ld(vb, ...qb.bp, 445, 445, '250x12FLx250 BASE PLATE\nWITH 2-φ12 HOLES FOR SPIKES.\nPROVIDE UNIFORM SEATING\nSQUARE TO AXIS OF PILE.\nSHIM BETWEEN BASE PLATE AND\nTIMBER PILE TO ENSURE TIGHT\nFIT BETWEEN CUT PILE FACES.');
      g.wld(vb, s.b / 2, s.d / 2 - 5, 427, 363, { size: '6', all: true, site: true, tail: 'TYP' }); flow(vb, 0, 640, 'down');
      g.title(360, 522, 'SECTION B', 20);
    }
    // ELEVATION
    const v = g.view(20, ...L.E), q = pierElev(v, o), { R, te, tc, cut, bot } = POT;
    v.ground(-R - 520, -R, 0); v.ground(R, R + 1100, 0); glLabel(v, R + 560, 'EXISTING GENERAL G.L.');
    pierDims(v, o, -1160, -890, -650);
    v.dim(-1540, q.b1, -1540, q.b1 + 1050, 0, '1050', { sub: 'TYP' }); v.dim(-890, tc, -890, q.b1, 0, '500'); v.dim(-1290, q.b1 + 650, -1290, tc, 0, '150');
    v.dimChain([[-890, q.b1 + 650], [-890, q.b1 + 950], [-890, q.b1 + 1050]], 0, ['300', '100'], { sub: 'TYP' });
    v.dim(-490, q.b1 + 1050, -490, q.b2 + 1050, 0, '50', { sub: 'TYP' });
    [q.b1, q.b1 + 1050].forEach(y => v.line(-D / 2 - 80, y, -1580, y, 'S-DIM')); [q.b1 + 650, q.b1 + 950].forEach(y => v.line(-D / 2 - 80, y, -1330, y, 'S-DIM')); v.line(-R - 30, tc, -930, tc, 'S-DIM'); v.line(-120, q.b2 + 1050, -530, q.b2 + 1050, 'S-DIM');
    v.dim(R + 120, te, R + 120, tc, 0, '20'); v.dim(R + 120, 0, R + 120, te, 0, '150', { sub: 'MIN' }); v.line(D / 2 + 85, tc, R + 160, tc, 'S-DIM');
    secLine(v, -R - 140, R + 280, tc + 60, 'A'); secLine(v, -R - 140, R + 280, bolted ? cut + 50 : (cut + q.b1) / 2 + 20, 'B');
    if (bolted) { v.dim(-70, cut - 160, 70, cut - 160, 0, '140'); v.dim(230, cut + 60, 230, cut + 100, 0, '60'); viewMark(v, R + 950, cut + 50, 'C'); }
    cover(v, -R, 1, bot, '75 CLEAR\nCOVER (TYP)'); hoop(g.add, ...(bolted ? g.S(62, 525) : g.S(95, 815)));
    v.title = null;
    if (bolted) {
      g.ld(v, ...q.seal, 310, 347, 'END AND UP TO 100 ABOVE\nCUT SURFACE OF PILE SHALL\nBE SEALED WITH TWO COATS\nOF BITUMINOUS PAINT.'); g.ld(v, ...q.pfc, 310, 393, '200 PFC (TYP)'); g.ld(v, ...q.cap, 310, 409, '250x12FLx250 CAP PLATE WITH\n2-φ12 HOLES FOR SPIKES.');
      g.ld(v, ...q.ucb, 336, 470, un + ' (CUT SHIM END\nOF UC ON SITE TO SUIT)'); g.ld(v, ...q.ang, 323, 537, '150x100x10 UAx300 LONG\nWITH 1-φ12 HOLE FOR\nSPIKE, LOCATION OF HOLE\nTO SUIT ANGLE POSITION.');
      g.ld(v, ...q.fab, 325, 590, 'SL81 FABRIC'); g.ld(v, ...q.pile, 304, 612, 'EXISTING TIMBER PILE, CUT\nOUT SECTION OF UNSOUND\nTIMBER - 250 MIN BELOW\nEXISTING G.L.');
      g.lds(v, [q.hoop, q.hoopB], 103, 507, 'N16 HOOP BARS\nAT TOP & BOTTOM'); g.wld(v, -40, tc - 6, 190, 480, { size: '6', all: true });
      g.title(253, 657, 'ELEVATION');
    } else {
      g.ld(v, ...q.seal, 440, 565, 'END AND UP TO 100 ABOVE\nCUT SURFACE OF PILE SHALL\nBE SEALED WITH TWO COATS\nOF BITUMINOUS PAINT.'); g.ld(v, ...q.pfc, 440, 627, '200 PFC (TYP)'); g.ld(v, ...q.cap, 440, 646, '250x12FLx250 CAP PLATE WITH\n2-φ12 HOLES FOR SPIKES.');
      g.ld(v, ...q.fab, 446, 746, 'SL81 FABRIC'); g.ld(v, s.b / 2, cut + 120, 446, 801, un + ' (CUT BASE PLATE\nEND ON SITE TO SUIT)'); g.ld(v, ...q.bp, 450, 842, 'BASE PLATE'); g.ld(v, ...q.spikeH, 446, 877, 'φ10x250 LONG\nSPIKE (TYP)');
      g.ld(v, ...q.pile, 440, 915, 'EXISTING TIMBER PILE, CUT\nOUT SECTION OF UNSOUND\nTIMBER - 250 MIN BELOW\nEXISTING G.L.'); g.lds(v, [q.hoop, q.hoopB], 170, 779, 'N16 HOOP BARS\nAT TOP & BOTTOM'); g.wld(v, -40, tc - 6, 250, 778, { size: '6', all: true });
      g.title(361, 972, 'ELEVATION');
    }
    // boxes, captions
    if (bolted) {
      g.box(327, 96, 'THIS REPAIR IS GENERALLY FOR\nPILES <3m HIGH ABOVE GROUND.\n- OTHERWISE USE PIER - TYPE 2\n(PN30-2105 & PN30-2106)', { h: g.h }); pierBoxes(g, { read: [340, 153], prop: [383, 272], opt: [[181, 712], 'BOLTED OPTION', 52], eng: [188, 745] });
      g.box(458, 398, 'EXISTING GENERAL G.L. OR\nPERMANENT W.L. OR HIGH\nTIDE - WHICH EVER IS\nHIGHER.', { h: g.h }); const e = v.P(R + 250, 0); g.add({ t: 'line', a: g.S(458, 420), b: [e[0] + 40, e[1] + 6], L: 'S-NOTE' });
      const r = g.main(143, 686, 'PIER PILE REPAIR DETAIL - TYPE 1A', 'none', 'XX30-XXXX', ['PIER N° X - PILE N° X', '1:20']); g.box(415, 636, DRG, { h: g.h }); g.dl(410, 652, ...[r[0] + 20, r[1] + 3].map((z, i) => i ? 819 - z / (K * g.F) : z / (K * g.F)));
      // BEARING ARRANGEMENT FOR PILES < φ350 (1:10)
      const vs = g.view(10, 697, 143), qs = bearSmall(g, vs, o);
      g.ld(vs, ...qs.shim, 660, 23, 'SHIM 90x90x\nTHICKNESS\nTO SUIT'); g.ld(vs, s.d / 2, 380, 750, 23, 'PROPOSED UC PILE\nSEGMENT'); g.ld(vs, ...qs.pot, 802, 85, 'PROPOSED CONCRETE\nPOT', { dot: true }); g.ld(vs, ...qs.sp, 802, 112, 'φ10x100 LONG SPIKE\n(TYP)');
      g.ld(vs, ...qs.ang, 597, 104, '150x100x10 UA\nx300 LONG (TYP)'); g.ld(vs, ...qs.pile, 756, 227, 'EXISTING TIMBER\nPILE', { dot: true });
      const t0 = g.S(617, 274); g.B.E.push({ t: 'text', p: t0, s: 'BEARING ARRANGEMENT FOR', h: 3.4, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }, { t: 'line', a: [t0[0], t0[1] - 1.1], b: [t0[0] + 23 * 3.4 * 0.7, t0[1] - 1.1], L: 'S-TITLE' }, { t: 'text', p: [t0[0], t0[1] - 6], s: 'PILES < φ350', h: 3.4, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }, { t: 'line', a: [t0[0], t0[1] - 7.1], b: [t0[0] + 12 * 3.4 * 0.7, t0[1] - 7.1], L: 'S-TITLE' });
      g.mtext(617, 296, 'PIER N° X - PILE N° X\nPIER N° X - PILE N° X\n1:10', 2.2);
      // VIEW C
      const vc = g.view(20, 699, 465), qc = pierElev(vc, Object.assign({}, o, { side: true, hoop: 1 })); vc.ground(-R - 500, -R, 0); vc.ground(R, R + 600, 0);
      g.ld(vc, ...qc.shim, 641, 412, 'SHIM 90x90x\nTHICKNESS\nTO SUIT'); g.ld(vc, ...qc.ang, 589, 487, '4-M20 BOLTS\n(SITE DRILL HOLES IN PILE\nAFTER SHIM IS IN PLACE\nTO SUIT)');
      g.mtext(488, 533, 'NOTE: ANGLES SHALL\nBEAR ON SOLID TIMBER.\nIF PILE < φ350 THEN\nANGLE LEGS SHALL BE\nTURNED INWARDS UNDER\nUC PILE AS SHOWN IN\nDETAIL ABOVE', g.h);
      g.ld(vc, ...qc.sp100, 770, 541, 'φ10x100 LONG\nSPIKE (TYP)'); g.ld(vc, ...qc.bp, 773, 589, '150x10FLx150\nBEARING PLATE\n(FOR PILE > φ350)'); g.ld(vc, -qc.spikeH[0], qc.spikeH[1], 652, 617, 'φ10x250 LONG\nSPIKE (TYP)');
      g.title(699, 673, 'VIEW C', 20);
    } else {
      g.box(468, 218, READ, { h: g.h }); g.box(525, 310, 'THIS REPAIR IS GENERALLY FOR\nPILES <3m HIGH ABOVE GROUND.\n- OTHERWISE USE PIER - TYPE 2\n(PN30-2105 & PN30-2106)', { h: g.h });
      pierBoxes(g, { prop: [55, 258], opt: [[288, 1043], 'WELDED OPTION', 48], eng: [275, 1085] });
      g.box(640, 655, 'EXISTING GENERAL G.L. OR\nPERMANENT W.L. OR HIGH\nTIDE - WHICH EVER IS\nHIGHER.', { h: g.h }); const e = v.P(R + 560, 0); g.add({ t: 'line', a: g.S(640, 675), b: [e[0] + 40, e[1] + 6], L: 'S-NOTE' });
      const r = g.main(232, 1010, 'PIER PILE REPAIR DETAIL - TYPE 1', 'dot', 'XX30-XXXX', ['PIER N° X - PILE N° X', '1:20']); g.box(577, 948, DRG, { h: g.h }); g.dl(590, 972, ...[r[0] + 22, r[1] + 3].map((z, i) => i ? 1158 - z / (K * g.F) : z / (K * g.F)));
    }
    return g.done();
  }
  def('pp1', 'Piles', 'Pier pile repair – Type 1 (welded) / 1A (bolted)', 'PN30-2103 / 2104', [P('type', 'Type', '1', { opts: ['1', '1A'] }), P('uc', 'Proposed UC pile', '200UC52', { opts: UCs }), P('D', 'Existing pile dia. (mm)', 400, { num: 1 }), P('rake', 'Rake X (X in 1, Type 3)', 6, { num: 1 }), P('above', 'Height above G.L. (mm)', 1800, { num: 1 })], (p) => {
    const t = String(p.type).toUpperCase();
    if (t === '1' || t === '1A') return sheetT1(p, t === '1A');
    const m = /^([236])(A?)$/.exec(t); return m ? pierSheet(m[1], !!m[2], p) : sheetT1(p, false);
  }, 'Short steel UC stub on a base plate (Type 1) or bolted angles (Type 1A) replacing a pile section rotted at ground level, in a φ900 concrete pot, clamped to the sound pile above with 200 PFCs; generally for piles < 3 m high above ground.');

  // ---------------------------------------------------------------- PN30-2105 … 2108, 2114, 2115: TYPES 2 / 2A, 3 / 3A, 6 / 6A
  function secLineR(v, x1, x2, y, ch) { // circle marker on the LEFT, wedge on the right (sheets 2107 / 2108)
    const a = v.P(x1, y), b = v.P(x2, y), add = e => v.add(e); const c = [a[0] - 9, a[1]]; add({ t: 'circle', c, r: 3, L: 'S-TITLE' }); add({ t: 'text', p: c, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); add({ t: 'solid', p: [[c[0] - 1.6, c[1] - 2.5], [c[0] + 1.6, c[1] - 2.5], [c[0], c[1] - 4.6]], L: 'S-TITLE' }); add({ t: 'line', a: [a[0] - 6, a[1]], b: [a[0] + 2, a[1]], L: 'S-TITLE' });
    add({ t: 'line', a: [b[0] - 2, b[1]], b: [b[0] + 9, b[1]], L: 'S-TITLE' }); add({ t: 'solid', p: [[b[0] + 1, b[1]], [b[0] + 8, b[1]], [b[0] + 4.5, b[1] - 2.4]], L: 'S-TITLE' }); }
  function rakeSym(g, sx, sy) { const p = g.S(sx, sy); g.add({ t: 'pl', p: [[p[0], p[1]], [p[0], p[1] + 7], [p[0] - 1.2, p[1]]], closed: false, L: 'S-TEXT' }); g.add({ t: 'text', p: [p[0] + 1.6, p[1] + 2.6], s: 'X', h: 2.6, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); g.add({ t: 'text', p: [p[0] - 0.4, p[1] - 1.4], s: '1', h: 2.6, al: 'c', v: 't', ang: 0, L: 'S-TEXT' }); }
  function fallWedge(g, sx, sy, w) { const p = g.S(sx, sy); g.add({ t: 'solid', p: [[p[0], p[1]], [p[0] + w, p[1] + 1.3], [p[0] + w, p[1]]], L: 'S-TITLE' }); g.add({ t: 'line', a: [p[0] + w, p[1]], b: [p[0] + w + 7, p[1]], L: 'S-TEXT' }); }
  const BPN = (bp, end) => (bp === 325 ? '325x325x12PL' : '250x12FLx250') + ' BASE PLATE\nWITH 2-φ12 HOLES FOR SPIKES.\nPROVIDE UNIFORM SEATING\nSQUARE TO AXIS OF PILE.\nSHIM BETWEEN BASE PLATE' + end;
  const SHIMN = "SHIM BETWEEN UC AND BEARING PLATE\nFOR PILE > φ350 OR BETWEEN UC AND\nUA's FOR PILE < φ350 TO ENSURE A\nTIGHT FIT BETWEEN CUT PILE FACE\nAND HALFCAPS";
  const ANGN = 'NOTE: ANGLES SHALL\nBEAR ON SOLID TIMBER.\nIF PILE < φ350 THEN\nANGLE LEGS SHALL BE\nTURNED INWARDS UNDER\nUC PILE AS SHOWN\nABOVE.';
  const ONLY = 'TO BE USED ONLY WHEN PIER PILE\nREPAIR TYPES 2 AND 2A ARE FOUND\nTO HAVE INADEQUATE CAPACITIES\nFROM DETAIL DESIGN ANALYSIS';
  const SIZE = 'SIZE OF PROPOSED PILE\nIS TO BE DETERMINED BY\nENGINEERING ANALYSIS.\n310 UC 97 DRAWN.';
  const T3N = 'NOTE :- FIXING OF STEEL PILE TO EXISTING\nTIMBER HALFCAPS MUST BE PIER STEEL PILE\n/TIMBER HALFCAP BEARING - TYPE 3 AS\nPER PN30-2117';
  function pierSheet(t, bolted, p) {
    const six = t === '6', three = t === '3', defUC = six ? '310UC97' : '200UC52', s = SEC[p.uc] || SEC[defUC], un = secName(SEC[p.uc] ? p.uc : defUC), D = max(250, min(500, +p.D || 400));
    const X = max(3, min(20, +p.rake || 6)), deg = three ? -Math.atan(1 / X) * 180 / PI : 0, land = six && bolted;
    const F = { '2': bolted ? 1.3 : 1.1, '3': bolted ? 1.3 : 1.0, '6': bolted ? 1.25 : 1.0 }[t], g = Pg(land, F); g.h = 2.5;
    const o = { t, bolted, D, s, tail: three ? 320 : 420, lapR: three && !bolted, bp: six ? 325 : 250, hoop: t === '2' && !bolted ? 1 : (three ? 1 : -1), ea: six && bolted, top: { '2': bolted ? 700 : 780, '3': bolted ? 1000 : 1100, '6': bolted ? 870 : 980 }[t] }, { R, te, tc, cut, bot } = POT;
    const L = { // sheet positions (low-res px): section A centre, elevation origin (pile ℄ at G.L.), view B origin, bearing arrangement origin
      '2': bolted ? { A: [180, 531], E: [180, 747], VB: [614, 745], BA: [614, 450] } : { A: [283, 262], E: [278, 620] },
      '3': bolted ? { A: [250, 450], E: [229, 716], VB: [615, 757], BA: [615, 368] } : { A: [398, 240], E: [401, 624] },
      '6': bolted ? { A: [285, 111], E: [285, 393], VB: [646, 394] } : { A: [330, 175], E: [330, 568] } }[t];
    // ---- SECTION A (pot plan)
    const va = g.view(20, ...L.A), qa = potPlan(va, o), rf = R - 75;
    if (!bolted) {
      if (t === '2') { g.ld(va, ...qa.sp250, 187, 213, 'φ10x250 LONG\nSPIKE (TYP)'); flow(va, -760, -60, false); g.ld(va, ...qa.pot, 207, 300, 'φ900 CONCRETE\nFOOTING'); g.ld(va, -rf * 0.6, -rf * 0.8, 207, 345, 'SL81 FABRIC\n(TYP)'); g.ld(va, -20, -30, 217, 392, 'SHIM 90x90x THICKNESS\nTO SUIT');
        g.ld(va, ...qa.sp100, 363, 228, 'φ10x100 LONG\nSPIKE (TYP)'); g.ld(va, ...qa.bp, 363, 285, BPN(250, ' AND\nTIMBER PILE TO ENSURE TIGHT\nFIT BETWEEN CUT PILE FACE\nAND HALFCAPS.')); g.wld(va, s.b / 2, s.d / 2 - 5, 345, 183, { size: '6', all: true, site: true, tail: 'TYP' }); g.title(265, 440, 'SECTION A', 20); }
      if (three) { g.wld(va, -s.b / 2, s.d / 2 - 5, 342, 173, { size: '6', all: true, site: true, tail: 'TYP' }); g.ld(va, -rf * 0.92, rf * 0.4, 288, 228, 'SL81 FABRIC\n(TYP)'); g.ld(va, ...[-o.bp / 2, -o.bp / 2 + 30], 305, 285, '250x12FL.x250 BASE\nPLATE WITH 2-φ12 HOLES.\nPROVIDE UNIFORM SEATING\nSQUARE TO AXIS OF PILE.\nSHIM BETWEEN BASE PLATE\nAND CUT PILE TO ENSURE A\nTIGHT FIT BETWEEN CUT PILE\nFACE AND HALFCAPS.');
        flow(va, 640, -80, true); g.ld(va, R * Math.cos(-0.5), R * Math.sin(-0.5), 470, 273, 'φ900 CONCRETE\nFOOTING'); g.ld(va, ...qa.sp100, 475, 310, 'φ10x100 LONG\nSPIKE (TYP)'); g.ld(va, 0, -rf + 60, 428, 342, 'φ10x250 LONG\nSPIKE (TYP)'); g.title(385, 412, 'SECTION A', 20); }
      if (six) { g.ld(va, 0, s.d / 2 + 40, 358, 35, 'φ10x100 LONG\nSPIKE (TYP)'); g.wld(va, s.b / 2, s.d / 2 - 5, 385, 92, { size: '6', all: true, site: true }); g.ld(va, rf * 0.8, rf * 0.6, 415, 125, 'SL81 FABRIC\n(TYP)'); flow(va, 640, -40, true);
        g.ld(va, -rf + 60, 0, 235, 150, 'φ10x250 LONG\nSPIKE (TYP)'); g.ld(va, ...qa.pot, 232, 210, 'φ900 CONCRETE\nFOOTING'); g.ld(va, -30, -30, 262, 255, 'SHIM 90x90x\nTHICKNESS TO\nSUIT'); g.ld(va, ...qa.bp, 415, 212, BPN(325, '\nAND TIMBER PILE TO ENSURE\nA TIGHT FIT BETWEEN CUT\nPILE FACE AND HALFCAPS.'));
        va.dimChain([[-75, -R - 120], [0, -R - 120], [75, -R - 120]], 0, ['', '']); [[-110, '75'], [110, '75']].forEach(([x, tx]) => va.text(x, -R - 100, tx, 2.2, 'c')); va.line(0, -R - 60, 0, -R - 260, 'S-CL'); const c = va.P(0, -R - 300); g.add({ t: 'text', p: c, s: '℄ PILE', h: g.h, al: 'c', v: 't', ang: 0, L: 'S-TEXT' }); g.title(330, 352, 'SECTION A', 20); }
    } else {
      const big = D >= 350;
      if (six) { g.ld(va, ...qa.shim, 350, 22, "SHIM BETWEEN UC PILE AND\nEA's TO ENSURE A TIGHT FIT\nBETWEEN CUT PILE FACE AND\nHALFCAPS"); g.ld(va, rf * 0.8, rf * 0.6, 350, 78, 'SL81 FABRIC\n(TYP)'); flow(va, 700, 40, true); g.ld(va, -rf + 60, 0, 215, 95, 'φ10x250 LONG\nSPIKE (TYP)'); g.ld(va, ...qa.pot, 223, 160, 'φ900 CONCRETE\nFOOTING'); g.ld(va, 110, -90, 352, 186, 'φ10x100 LONG\nSPIKE (TYP)');
        va.dim(R + 250, 0, R + 250, -90, 0, '90', { sub: '(TYP)' }); va.line(110, -90, R + 290, -90, 'S-DIM'); va.line(0, 0, R + 290, 0, 'S-DIM'); va.dimChain([[-70, -R - 100], [0, -R - 100], [70, -R - 100]], 0, ['', '']); [[-110, '70'], [110, '70']].forEach(([x, tx]) => va.text(x, -R - 80, tx, 2.2, 'c')); va.line(0, -R - 40, 0, -R - 240, 'S-CL'); const c = va.P(0, -R - 280); g.add({ t: 'text', p: c, s: '℄ PILE', h: g.h, al: 'c', v: 't', ang: 0, L: 'S-TEXT' }); g.title(275, 240, 'SECTION A', 20); }
      else { const ty = t === '2' ? [113, 500, 122, 531, 124, 579, 229, 468, 247, 501, 247, 572, 175, 617] : [158, 415, 128, 438, 155, 498, 235, 385, 300, 422, 300, 490, 200, 530];
        g.ld(va, -60, s.d / 2 + 110, ty[0], ty[1], 'BEARING PLATE\n(FOR PILE > φ350)'); flow(va, -680, 40, false); g.ld(va, ...qa.pot, ty[4], ty[5], 'φ900 CONCRETE\nFOOTING'); g.ld(va, rf * Math.cos(1.2), rf * Math.sin(1.2), ty[6], ty[7], 'SL81 FABRIC\nTYP');
        g.ld(va, ...qa.shim, ty[8], ty[9], SHIMN + (t === '2' ? '.' : '')); g.ld(va, 0, -s.d / 2 - 110, ty[10], ty[11], 'φ10x100 LONG\nSPIKE (TYP)'); g.title(ty[12], ty[13], 'SECTION A', 20); }
    }
    // ---- ELEVATION
    const v0 = g.view(20, ...L.E), v = three ? rotView(v0, deg, 0, 0) : v0, q = pierElev(v, o);
    const gl = { '2': bolted ? [-R - 420, R + 900, 990] : [-R - 450, R + 800, R + 330], '3': bolted ? [-R - 600, R + 500, -R - 520] : [-R - 800, R + 600, -R - 520], '6': bolted ? [-R - 450, R + 700, R + 330] : [-R - 450, R + 800, R + 300] }[t];
    v0.ground(gl[0], -R - (three ? 60 : 0), 0); v0.ground(R + (three ? 60 : 0), gl[1], 0); const gb = glLabel(v0, gl[2], 'EXISTING GENERAL G.L.');
    if (!three) { const dx = { '2': bolted ? [-1305, -930, -705, -825, -825] : [-1595, -1117, -774, -995, -995], '6': [-2020, -970, -754, -1630, -830] }[t];
      pierDims(v, o, dx[0], dx[1], dx[2]); v.dim(dx[3], 0, dx[3], te, 0, '150', { sub: 'MIN' + (six ? '.' : '') }); v.dim(dx[4], te, dx[4], tc, 0, '20'); v.line(-R - 30, 0, dx[3] - 40, 0, 'S-DIM'); v.line(-s.b / 2 - 30, tc, min(dx[3], dx[4]) - 40, tc, 'S-DIM'); }
    else { // dimensions on the right, square to the raked pile; 150 MIN vertical
      v.dim(R + 520, te, R + 520, bot, 0, '1250 MIN.'); v.dim(R + 300, cut, R + 300, bot, 0, '750'); v.dimChain([[R + 120, cut], [R + 120, cut - 375], [R + 120, bot]], 0, ['=', '=']);
      [te, cut, bot].forEach(y => v.line(R + 30, y, R + 560, y, 'S-DIM')); v.line(D / 2 + 20, cut, R + 30, cut, 'S-DIM');
      const pt = v.P(R, te), pg = v0.P(R + 700, 0), ex = (pt[0] - pg[0]) * 20; v0.dim(R + 700 + ex, 0, R + 700 + ex, (pt[1] - pg[1]) * 20, 0, '150', { sub: 'MIN.' }); v0.line(R + 60, 0, R + 740 + ex, 0, 'S-DIM'); }
    cover(v, three ? R : -R, three ? -1 : 1, bot, three ? '75 CLEAR\nCOVER (TYP)' : (bolted ? '75 CLEAR\nCOVER (TYP)' : '75 CLEAR\nCOVER'));
    if (bolted && !six) { v.dim(-70, cut + 140, 70, cut + 140, 0, '140'); v.dim(-230, cut + 60, -230, cut + 100, 0, '60'); }
    if (three) { secLineR(v, -R - 120, R + 80, cut + 200, 'A'); if (bolted) viewMark(v0, R + 1350, cut + 230, 'B'); }
    else { const ya = bolted ? cut + 120 : (six ? cut + 130 : cut + 320); secLine(v, -R - 120, R + 80, ya, 'A'); if (bolted) viewMark(v, six ? 1100 : 1420, ya, 'B'); }
    // elevation notes
    const cutN = six ? 'CUT EXISTING TIMBER PILE\nTO SOUND TIMBER - 250 MIN.\nBELOW EXISTING G.L.' : 'CUTBACK EXISTING TIMBER\nPILE TO SOUND TIMBER -\n250 MIN BELOW EXISTING G.L.';
    if (t === '2' && !bolted) { g.ld(v, ...q.bp, 205, 541, 'BASE PLATE'); g.ld(v, s.b / 2, 650, 350, 525, un + ' PILE (CUT\nPOT END OF PILE ON\nSITE TO SUIT)'); g.ld(v, ...q.fabL, 173, 671, 'SL81 FABRIC'); g.ld(v, ...q.cut, 401, 681, cutN); g.lds(v, [q.hoop, q.hoopB], 401, 749, 'N16 HOOP BARS\nAT TOP\n& BOTTOM.'); hoop(g.add, ...g.S(470, 752)); g.ld(v, -100, cut - 375, 340, 846, 'φ10x250 LONG SPIKE (TYP)'); g.title(278, 905, 'ELEVATION'); }
    if (t === '2' && bolted) { g.ld(v, s.b / 2, 500, 221, 690, un + ' PILE'); g.ld(v, ...q.ang, 253, 826, '150x100x10 UAx300 LONG\nWITH 1-φ12 HOLE FOR\nSPIKE, LOCATION OF HOLE\nTO SUIT ANGLE POSITION.'); g.ld(v, ...q.fab, 251, 881, 'SL81 FABRIC'); g.ld(v, ...q.cut, 239, 908, 'CUTBACK EXISTING TIMBER\nPILE TO SOUND TIMBER -\n250 MIN BELOW EXISTING G.L.'); g.title(178, 970, 'ELEVATION'); }
    if (three) { const ty = bolted ? [192, 572, 328, 606, 299, 743, 147, 791, 157, 873] : [363, 479, 0, 0, 270, 789, 283, 700, 312, 820];
      g.ld(v, -s.b / 2, 800, ty[0], ty[1], un + ' PILE' + (bolted ? '' : ' (CUT\nBASE PLATE END OF\nPILE ON SITE TO SUIT)'));
      if (bolted) g.ld(v, ...q.ang, ty[2], ty[3], '150x100x10 UAx300 LONG\nWITH 1-φ12 HOLE FOR\nSPIKE, LOCATION OF HOLE\nTO SUIT ANGLE POSITION\nRELATIVE TO PILE.');
      else { g.ld(v, ...q.hoop, 519, 491, 'N16 HOOP BARS\nAT TOP AND\nBOTTOM'); hoop(g.add, ...g.S(580, 508)); g.ld(v, ...q.bp, 485, 653, 'BASE PLATE'); g.ld(v, 0, cut + 13, 585, 760, 'SHIM 90x90x\nTHICKNESS\nTO SUIT'); }
      g.ld(v, ...(bolted ? q.fab : q.fabL), ty[4], ty[5], 'SL81 FABRIC'); g.ld(v, -D / 2 + 10, cut, ty[6], ty[7], 'CUTBACK EXISTING\nTIMBER PILE TO\nSOUND TIMBER -\n250 MIN' + (bolted ? '' : '.') + ' BELOW\nEXISTING G.L.'); g.ld(v, -rf + 120, cut - 375, ty[8], ty[9], 'φ10x250 LONG\nSPIKE (TYP)');
      rakeSym(g, bolted ? 259 : 437, bolted ? 646 : 540); g.mtext(bolted ? 164 : 290, bolted ? 657 : 545, bolted ? '20 mm MIN.\nFALL FROM\nHORIZ. (TYP)' : '20 mm MIN. FALL\nFROM HORIZ. (TYP)', g.h); fallWedge(g, bolted ? 122 : 262, bolted ? 679 : 570, 22);
      g.title(bolted ? 210 : 410, bolted ? 908 : 870, 'ELEVATION'); }
    if (six) { const ty = bolted ? [350, 318, 361, 415, 204, 417, 361, 474, 361, 519, 285, 600] : [392, 470, 432, 597, 230, 595, 440, 678, 390, 775, 330, 852];
      const pu = g.ld(v, s.b / 2, 700, ty[0], ty[1], 'PROPOSED ' + un + ' PILE\n(CUT POT END OF PILE\nON SITE TO SUIT)'); g.ld(v, ...q.fab, ty[2], ty[3], 'SL81 FABRIC'); g.lds(v, [q.hoop, q.hoopB], ty[4], ty[5], 'N16 HOOP BARS\nAT TOP & BOTTOM'); hoop(g.add, ...g.S(bolted ? 122 : 128, bolted ? 436 : 640));
      g.ld(v, ...q.cut, ty[6], ty[7], bolted ? 'CUT BACK EXISTING TIMBER\nPILE TO SOUND TIMBER - 250\nMIN BELOW EXISTING G.L.' : cutN); g.ld(v, rf - 120, cut - 375, ty[8], ty[9], 'φ10x250 LONG\nSPIKE (TYP)'); if (!bolted) g.ld(v, ...q.bp, 255, 478, 'BASE PLATE');
      agg(v, 300, -60); agg(v, -330, -700); g.title(ty[10], ty[11], 'ELEVATION');
      const ts = g.S(ty[0], ty[1]), x1 = ts[0] + ('PROPOSED '.length) * g.h * 0.58, x2 = x1 + un.length * g.h * 0.58; g.add({ t: 'pl', p: [[x1 - 0.6, ts[1] + 2.3], [x2 + 0.6, ts[1] + 2.3], [x2 + 0.6, ts[1] - 2.0], [x1 - 0.6, ts[1] - 2.0]], closed: true, L: 'S-NOTE' });
      const sb = bolted ? [420, 228] : [595, 465]; g.box(...sb, SIZE, { h: 2.4 }); const sp = g.S(sb[0], sb[1] + 18); g.add({ t: 'line', a: [x2 + 0.6, ts[1]], b: sp, L: 'S-NOTE' }); }
    // ---- VIEW B and the bearing arrangement (bolted options)
    if (bolted) {
      const vb = g.view(20, ...L.VB), qb = pierElev(vb, Object.assign({}, o, { side: true, hoop: 1, top: six ? 870 : 650, tail: 300 })); vb.ground(-R - 450, -R, 0); vb.ground(R, R + 500, 0);
      if (six) { g.ld(vb, s.d / 2, 600, 690, 337, 'PROPOSED UC PILE'); g.ld(vb, ...qb.shim, 560, 413, 'SHIM 90x90x\nTHICKNESS\nTO SUIT'); g.ld(vb, ...qb.ang, 720, 423, '150x150x12 EA x 300 LONG\n2-M20 BOLTS PER EA\nSITE DRILLED HOLES IN\nPROPOSED UC PILE AFTER\nSHIM IS IN PLACE TO SUIT\n(TYP)'); g.ld(vb, 40, cut + 3, 720, 497, 'NOTE: ANGLES SHALL\nBEAR ON SOLID TIMBER');
        vb.dim(-R - 120, cut, -R - 120, cut + 90, 0, '90'); vb.line(-s.d / 2 - 20, cut + 90, -R - 160, cut + 90, 'S-DIM'); vb.line(-D / 2 - 10, cut, -R - 160, cut, 'S-DIM'); agg(vb, 300, -60); agg(vb, -320, -700); g.title(632, 628, 'VIEW B', 20); }
      else { const ty = t === '2' ? [546, 700, 668, 703, 520, 777, 420, 820, 670, 768, 700, 790, 670, 830, 670, 855, 552, 917, 605, 968] : [568, 670, 668, 670, 535, 772, 432, 815, 690, 765, 720, 787, 690, 828, 690, 855, 563, 885, 615, 940];
        g.ld(vb, ...qb.shim, ty[0], ty[1], 'SHIM 90x90x\nTHICKNESS' + (t === '2' ? '\n' : ' ') + 'TO SUIT'); g.ld(vb, s.d / 2, 450, ty[2], ty[3], un + ' PILE (CUT\nPOT END OF PILE ON\nSITE TO SUIT)');
        g.ld(vb, -qb.ang[0], qb.ang[1], ty[4], ty[5], t === '2' ? '4-M20 BOLTS\n(SITE DRILL HOLES IN PILE\nAFTER SHIM IS IN PLACE\nTO SUIT)' : '4-M20 BOLTS\n(SITE DRILL HOLES IN\nPILE AFTER SHIM IS\nIN PLACE TO SUIT)'); g.mtext(ty[6], ty[7], t === '2' ? ANGN : ANGN.replace('UC PILE AS SHOWN\nABOVE.', 'UC PILE AS SHOWN IN\nDETAIL ABOVE'), g.h);
        g.lds(vb, [qb.hoop, qb.hoopB], ty[8], ty[9], 'N16 HOOP BARS\nAT TOP\n& BOTTOM.'); hoop(g.add, ...g.S(ty[10], ty[11])); g.ld(vb, ...qb.sp100, ty[12], ty[13], 'φ10x100 LONG\nSPIKE (TYP)'); g.ld(vb, ...qb.bp, ty[14], ty[15], (t === '2' ? '150x10FLx150' : '150x10FL.x150') + '\nBEARING PLATE\n(FOR PILE > φ350)');
        g.ld(vb, -qb.spikeH[0], qb.spikeH[1], ty[16], ty[17], 'φ10x250 LONG\nSPIKE (TYP)'); g.title(ty[18], ty[19], 'VIEW B', 20);
        const vs = g.view(10, ...L.BA), qs = bearSmall(g, vs, o), b2 = t === '2' ? [585, 355, 668, 366, 730, 410, 730, 455, 520, 415, 692, 543, 528, 595] : [575, 330, 668, 342, 730, 385, 730, 430, 520, 390, 692, 520, 528, 570];
        g.ld(vs, ...qs.shim, b2[0], b2[1], 'SHIM 90x90x\nTHICKNESS\nTO SUIT'); g.ld(vs, s.d / 2, 380, b2[2], b2[3], 'PROPOSED UC PILE'); g.ld(vs, ...qs.pot, b2[4], b2[5], 'PROPOSED\nCONCRETE\nPOT', { dot: true }); g.ld(vs, ...qs.sp, b2[6], b2[7], 'φ10x100 LONG\nSPIKE (TYP)');
        g.ld(vs, ...qs.ang, b2[8], b2[9], '150x100x10 UA\nx300 LONG (TYP)'); g.ld(vs, ...qs.pile, b2[10], b2[11], 'EXISTING TIMBER\nPILE', { dot: true });
        const t0 = g.S(b2[12], b2[13]); g.B.E.push({ t: 'text', p: t0, s: 'BEARING ARRANGEMENT FOR', h: 3.4, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }, { t: 'line', a: [t0[0], t0[1] - 1.1], b: [t0[0] + 23 * 3.4 * 0.7, t0[1] - 1.1], L: 'S-TITLE' }, { t: 'text', p: [t0[0], t0[1] - 6.4], s: 'PILES < φ350', h: 3.4, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }, { t: 'line', a: [t0[0], t0[1] - 7.5], b: [t0[0] + 12 * 3.4 * 0.7, t0[1] - 7.5], L: 'S-TITLE' });
        g.mtext(b2[12], b2[13] + 22, 'PIER N° X - PILE N° X\nPIER N° X - PILE N° X\n1:10', 2.2); }
    }
    // ---- boxes and captions (sheet positions)
    const H = land ? 819 : 1158, back = (pp) => [pp[0] / (K * g.F), H - pp[1] / (K * g.F)], glb = (bx, by) => { g.box(bx, by, 'EXISTING GENERAL G.L. OR\nPERMANENT W.L. OR HIGH\nTIDE - WHICH EVER IS\nHIGHER.', { h: g.h }); const a = g.S(bx, by), bb = [gb[2], (gb[1] + gb[3]) / 2]; g.add({ t: 'line', a: [a[0] + (a[0] > bb[0] ? 0 : 35), a[1] - 8], b: [a[0] > bb[0] ? gb[2] : gb[0] + 10, a[0] > bb[0] ? (gb[1] + gb[3]) / 2 : gb[3]], L: 'S-NOTE' }); };
    const C = {
      '2': bolted ? { main: [62, 985], sym: 'ldot', opt: [95, 1028, 62], eng: [95, 1078], drg: [397, 940], read: [440, 1022], glb: [418, 732], prop: [257, 598] } : { main: [122, 945], sym: 'ldot', opt: [182, 1015, 48], eng: [160, 1057], drg: [520, 870], read: [455, 965], glb: [590, 553], prop: [362, 418] },
      '3': bolted ? { main: [95, 957], sym: 'cbar', opt: [155, 1020, 50], eng: [155, 1062], drg: [340, 903], read: [238, 222], glb: [25, 614], prop: [293, 515], t3: [238, 300] } : { main: [255, 927], sym: 'cbar', opt: [205, 985, 48], eng: [188, 1030], drg: [553, 852], read: [415, 957], glb: [40, 498], prop: [512, 138], t3: [482, 385] },
      '6': bolted ? { main: [155, 632], sym: 'hdot', opt: [210, 697, 50], eng: [210, 742], drg: [408, 600], read: [436, 690], glb: [478, 305], prop: [40, 212], only: [470, 125] } : { main: [150, 885], sym: 'hdot', opt: [225, 950, 50], eng: [205, 995], drg: [575, 825], read: [460, 930], glb: [615, 560], prop: [507, 82], only: [470, 350] } }[t];
    pierBoxes(g, { read: C.read, prop: C.prop, opt: [[C.opt[0], C.opt[1]], bolted ? 'BOLTED OPTION' : 'WELDED OPTION', C.opt[2]], eng: C.eng }); glb(...C.glb);
    if (C.t3) g.box(...C.t3, T3N, { h: g.h }); if (C.only) g.box(...C.only, ONLY, { h: 3.6 });
    const r = g.main(C.main[0], C.main[1], 'PIER PILE REPAIR DETAIL - TYPE ' + t + (bolted ? 'A' : ''), C.sym, 'XX30-XXXX', ['PIER N° X - PILE N° X', '1:20']);
    g.box(C.drg[0], C.drg[1], DRG, { h: g.h }); const dp = g.S(C.drg[0] + 25, C.drg[1] + 18); g.dl(...back(dp), ...back([r[0] + 18, r[1] + 3.5]));
    return g.done();
  }
  const pierParams = (t, d) => [P('opt', 'Option', t + ' (WELDED)', { opts: [t + ' (WELDED)', t + 'A (BOLTED)'] }), P('uc', 'Proposed UC pile', d, { opts: UCs }), P('D', 'Existing pile dia. (mm)', 400, { num: 1 })];
  def('pn2105', 'Piles', 'Pier pile repair – Type 2 (welded) / 2A (bolted)', 'PN30-2105 / 2106', pierParams('2', '200UC52'), (p) => pierSheet('2', /A/.test(String(p.opt)), p),
    'Steel UC pile from a φ900 concrete pot on the cut-back timber pile up to the halfcaps (base plate welded, or bolted angles); read with the pier halfcap repair and pile bearing details.');
  def('pn2107', 'Piles', 'Pier pile repair – Type 3 (welded) / 3A (bolted), raked pile', 'PN30-2107 / 2108', pierParams('3', '200UC52').concat([P('rake', 'Rake X (X in 1)', 6, { num: 1 })]), (p) => pierSheet('3', /A/.test(String(p.opt)), p),
    'As Type 2 for a raked pier pile (X in 1); the fixing to the timber halfcaps must be the steel pile / halfcap bearing Type 3 (PN30-2117).');
  def('pn2114', 'Piles', 'Pier pile repair – Type 6 (welded) / 6A (bolted), heavy UC', 'PN30-2114 / 2115', pierParams('6', '310UC97'), (p) => pierSheet('6', /A/.test(String(p.opt)), p),
    'Heavier UC pile (310 UC 97 drawn, size by engineering analysis) on a 325 base plate or 150x150x12 EA bearing; only where Types 2 / 2A have inadequate capacity.');

  // ================================================================== PN30-2116 PIER PILE STRENGTHENING DETAILS
  function slotH(v, x, y, len, w) { const r = w / 2, h = len / 2 - r; v.line(x - h, y + r, x + h, y + r, 'S-BOLT'); v.line(x - h, y - r, x + h, y - r, 'S-BOLT'); v.arc(x - h, y, r, 90, 270, 'S-BOLT'); v.arc(x + h, y, r, -90, 90, 'S-BOLT'); v.fill([[x - 12, y - 6], [x + 12, y - 6], [x + 12, y + 6], [x - 12, y + 6]], 'S-BOLT'); }
  function zz(v, x, y0, y1) { v.brk(x, y0, x, y1, 'S-EXIST'); } // vertical break across a band
  function band(v, x0, x1, y0, y1, brk) { v.line(x0, y0, x1, y0, 'S-EXIST'); v.line(x0, y1, x1, y1, 'S-EXIST'); if (brk !== false) { v.brk(x0, y0, x0, y1, 'S-EXIST'); v.brk(x1, y0, x1, y1, 'S-EXIST'); } }
  // waler segment of the elevation (origin: UC ℄, waler ℄), returns key points
  function walerSeg(v, o, ground) { const s = o.s, hd = s.d / 2, D = o.D, q = {};
    pileElev(v, 0, ground ? -720 : -780, 780, D, 'S-EXIST', true); v.line(0, ground ? -820 : -820, 0, 820, 'S-CL');
    band(v, -800, 800, -112, 112); // waler
    const ang = 32 * PI / 180; // existing timber brace rising to the right
    const bl = (dy) => { const x0 = -hd - 40, y0 = 260 + dy, x1 = 640, y1 = y0 + (x1 - x0) * Math.tan(ang); v.line(x0, y0, x1, y1, 'S-EXIST'); return [x1, y1]; }; const e1 = bl(-70), e2 = bl(70); v.brk(e1[0], e1[1], e2[0], e2[1], 'S-EXIST');
    const yb = ground ? -225 : -225, top = 820; v.line(-hd, ground ? yb : -820, -hd, top, 'S-NEW'); v.line(-hd + s.tf, ground ? yb : -820, -hd + s.tf, top, 'S-NEW'); v.line(hd, ground ? yb : -820, hd, top, 'S-NEW'); v.line(hd - s.tf, ground ? yb : -820, hd - s.tf, top, 'S-NEW');
    v.brk(-hd - 20, top, hd + 20, top, 'S-NEW'); if (!ground) v.brk(-hd - 20, -820, hd + 20, -820, 'S-NEW'); else v.line(-hd, yb, hd, yb, 'S-NEW');
    [-1, 1].forEach(k => { v.rect(k > 0 ? hd : -hd - 200, -225, 200, 450, 'S-NEW'); [-175, 175].forEach(y => { slotH(v, k * (hd + 90), y, 112, 22); v.rect(k * (hd + 90) - 50, y - 6, 100, 12, 'S-NEW'); }); v.circ(k * (hd + 120), 0, 8, 'S-BOLT'); });
    q.brace = [-hd - 40 + 60, 260 - 70 + 100 * Math.tan(ang) - 30]; q.screw = [-hd - 120, 0]; q.cleat = [hd + 200, 225]; q.waler = [-500, -112]; q.pl = [hd + 140, 175]; q.slot = [hd + 90 + 30, -175]; q.uc = [-hd, -500]; q.pile = [-D / 2, 520];
    return q; }
  def('pps', 'Piles', 'Pier pile strengthening – UC alongside pile', 'PN30-2116', [P('uc', 'Strengthening UC', '250UC73', { opts: UCs }), P('D', 'Pile dia. (mm)', 380, { num: 1 }), P('L', 'Halfcap to waler (mm)', 2400, { num: 1 })], (p) => {
    const g = Pg(false, 1.3), s = SEC[p.uc] || SEC['250UC73'], un = secName(SEC[p.uc] ? p.uc : '250UC73'), D = max(250, min(500, +p.D || 380)), R = D / 2, hd = s.d / 2, o = { s, D }; g.h = 2.4;
    const UCN = 'PROPOSED ' + un + '\nPIER PILE STRENGTHENING';
    // ---- ELEVATION: top segment at the halfcaps (origin UC ℄ / underside of the halfcap strengthening)
    const v = g.view(20, 215, 266);
    band(v, -705, 720, 1305, 1410); [765, 1125].forEach(y => v.circ(90, y, 180, 'S-EXIST'));
    band(v, -915, 990, 0, 585); // existing timber halfcaps (broken)
    const c = SEC['300PFC']; [[0, 'S-NEW'], [c.tf, 'S-NEW'], [300 - c.tf, 'S-NEW'], [300, 'S-NEW']].forEach(([y, L]) => { v.line(-915, y, -hd - 200, y, L); v.line(hd + 200, y, 990, y, L); });
    pileElev(v, 0, -680, 0, D, 'S-EXIST'); v.line(0, -760, 0, 700, 'S-CL');
    const yt = 440, yb0 = 40; v.line(-hd, -740, -hd, yt, 'S-NEW'); v.line(-hd + s.tf, -740, -hd + s.tf, yt, 'S-NEW'); v.line(hd, -740, hd, yt, 'S-NEW'); v.line(hd - s.tf, -740, hd - s.tf, yt, 'S-NEW'); v.line(-hd, yt, hd, yt, 'S-NEW'); v.brk(-hd - 20, -740, hd + 20, -740, 'S-NEW');
    v.rect(-300, yt - 75, 600, 75, 'S-HIDDEN'); v.rect(-337, yb0, 675, 200, 'S-HIDDEN');
    [-1, 1].forEach(k => { v.rect(k > 0 ? hd : -hd - 200, yb0, 200, 400, 'S-NEW'); v.line(k * hd, yt - 75, k * (hd + 200), yt - 75, 'S-NEW'); v.circ(k * (hd + 110), yt - 37, 8, 'S-BOLT'); slotH(v, k * (hd + 85), 150, 107, 22); });
    g.ld(v, 0, yt, 300, 62, 'TRIM TO SUIT DECK END\nOF ' + UCN.replace('\n', ' ').replace('PROPOSED ', 'PROPOSED ').replace(' PIER', '\nPIER'));
    g.ld(v, 20, yt - 40, 217, 146, '75x600 TIMBER\nPACKER'); g.ld(v, hd + 85, 150, 280, 146, 'φ22x107 LONG\nSLOTTED HOLE\n(TYP)'); g.ld(v, -hd - 110, yt - 37, 140, 176, 'M10x150 LONG COACH\nSCREW (TYP)'); g.ld(v, 650, 585, 331, 183, 'EXISTING TIMBER\nHALFCAPS');
    g.ld(v, -337, yb0 + 10, 140, 291, '200x675 TIMBER\nPACKER'); g.ld(v, -hd - 140, yb0, 169, 326, '200x200x13 EAx\n400 LONG CLEAT\n(TYP)'); g.ld(v, 700, 0, 308, 319, 'PROPOSED\n300 PFC HALFCAP\nSTRENGTHENINGS');
    v.dim(-hd, 760, 0, 760, 0, '120', { sub: '(TYP)' }); v.dim(-560, yt, -560, yt - 75, 0, '75', { sub: '(TYP)' }); v.dim(-700, yt - 75, -700, 150, 0, '200'); v.line(-hd - 200, yt - 75, -740, yt - 75, 'S-DIM'); v.line(-hd - 200, yt, -600, yt, 'S-DIM'); v.line(-hd - 200, 150, -740, 150, 'S-DIM');
    v.dim(820, yb0, 820, yt, 0, '400', { sub: '(TYP)' }); v.line(hd + 200, yb0, 860, yb0, 'S-DIM'); v.line(hd + 200, yt, 860, yt, 'S-DIM');
    v.dim(560, 150, 560, yb0, 0, '110', { sub: '(TYP)' }); v.dim(960, 150, 960, 0, 0, '150', { sub: '(TYP)' }); v.line(hd + 85, 150, 1000, 150, 'S-DIM');
    v.dim(hd - 50, -330, hd, -330, 0, '50', { sub: '(TYP)' }); v.dim(hd, -470, hd + 85, -470, 0, '85', { sub: '(TYP)' }); v.line(hd + 85, 150, hd + 85, -510, 'S-DIM');
    secLineR(v, -1250, 1250, yt - 37, 'A'); secLineR(v, -1250, 1250, 150, 'B');
    // middle (waler) and bottom (waler at ground) segments
    const w1 = g.view(20, 215, 487), q1 = walerSeg(w1, o, false), w2 = g.view(20, 215, 732), q2 = walerSeg(w2, o, true);
    w2.ground(-800, 800, -325); w2.dim(820, -225, 820, -325, 0, '100', { sub: '(TYP)' }); w2.line(hd + 200, -225, 860, -225, 'S-DIM');
    g.ld(w1, ...q1.brace, 124, 406, 'EXISTING TIMBER\nBRACE'); g.ld(w1, ...q1.screw, 131, 439, 'M10x100 LONG COACH\nSCREW (TYP)'); g.ld(w1, ...q1.cleat, 286, 436, '200x200x13 EAx\n450 LONG CLEAT\n(TYP)'); g.ld(w1, ...q1.waler, 120, 533, 'EXISTING TIMBER\nWALER');
    g.ld(w1, ...q1.pl, 290, 515, '65x5FLx100 LONG\n(TYP)'); g.ld(w1, ...q1.slot, 293, 547, 'φ22x112 LONG\nSLOTTED HOLE\n(TYP)'); g.ld(w1, ...q1.uc, 167, 570, UCN);
    w1.dim(-hd, 400, 0, 400, 0, '120', { sub: '(TYP)' }); w1.dim(-560, -225, -560, -175, 0, '50', { sub: '(TYP)' }); w1.line(-hd - 200, -175, -600, -175, 'S-DIM'); w1.line(-hd - 200, -225, -600, -225, 'S-DIM');
    w1.dim(hd - 50, -420, hd, -420, 0, '50', { sub: '(TYP)' }); w1.dim(hd, -560, hd + 90, -560, 0, '90', { sub: '(TYP)' }); w1.line(hd + 90, -175, hd + 90, -600, 'S-DIM');
    secLineR(w1, -1250, 1250, 150, 'C'); secLineR(w1, -1050, 1250, 0, 'D'); secLineR(w2, -1250, 1250, 150, 'C'); secLineR(w2, -1050, 1250, 0, 'D');
    g.ld(w2, -R, 560, 166, 651, 'EXISTING TIMBER\nPILE'); g.ld(w2, ...q2.brace, 154, 689, 'EXISTING TIMBER\nBRACE'); g.ld(w2, ...q2.cleat, 296, 670, '200x200x13 EAx450 LONG\nCLEAT. FOR DETAILS OF\nCLEAT AND FIXINGS REFER\nTO DETAIL AT WALER ABOVE.\n(TYP)'); g.ld(w2, -450, -112, 140, 789, 'EXISTING TIMBER\nWALER');
    g.title(208, 826, 'ELEVATION');
    // ---- SECTIONS (plans) on the right
    const cleat = (vv, y0, L, holes) => [-1, 1].forEach(k => { vv.pl([[k * hd, y0], [k * (hd + 200), y0], [k * (hd + 200), y0 - 13], [k * (hd + 13), y0 - 13], [k * (hd + 13), y0 - 200], [k * hd, y0 - 200]], true, 'S-NEW'); });
    const ucP = (vv, y0) => { iSec(vv, 0, y0 - 10 - s.b / 2, s, 1); };
    // SECTION A (at the halfcaps)
    const va = g.view(20, 605, 119); band(va, -470, 540, 105, 270); band(va, -470, 540, -255, -75); va.arc(0, 15, R * 0.75, 100, 260, 'S-EXIST'); va.arc(0, 15, R * 0.75, -80, 80, 'S-EXIST');
    va.rect(-300, -330, 600, 75, 'S-NEW'); cleat(va, -330, 400); ucP(va, -343); [-1, 1].forEach(k => va.spike(k * (hd + 110), -343, k * (hd + 110), -193));
    g.lds(va, [[-300, 270], [-250, -75]], 557, 60, 'EXISTING TIMBER\nHALFCAPS'); g.ld(va, 60, 20, 638, 60, 'EXISTING TIMBER\nPILE', { dot: true }); g.ld(va, -hd - 110, -250, 536, 110, 'M10x150 LONG COACH\nSCREW (TYP)'); g.ld(va, -hd - 180, -343, 557, 169, '200x200x13 EAx\n400 LONG CLEAT\n(TYP)');
    g.ld(va, 280, -300, 673, 169, '75x600 TIMBER\nPACKER'); g.ld(va, -hd, -343 - 10 - s.b * 0.8, 612, 208, UCN); g.wld(va, -hd, -343 - 10 - s.b * 0.3, 540, 224, { size: '6', all: true, site: true, tail: 'TYP' });
    va.dim(30, -343, 30, -353, 0, '10', { sub: '(TYP)' }); g.title(600, 251, 'SECTION A', 20);
    // SECTION B (at the PFC strengthening and threaded rods)
    const vb = g.view(20, 605, 360); band(vb, -470, 540, 30, 230); band(vb, -470, 540, -230, -30); vb.circ(0, 0, R, 'S-HIDDEN');
    vb.rect(-330, 230, 660, 8, 'S-NEW'); vb.rect(-470, -238, 1010, 8, 'S-NEW'); vb.rect(-337, -438, 675, 200, 'S-NEW'); cleat(vb, -438, 400); ucP(vb, -451);
    [-1, 1].forEach(k => { vb.bolt(k * (R + 25), 238, k * (R + 25), -451, 20); });
    vb.dim(R, 320, R + 25, 320, 0, '25', { sub: '(TYP)' });
    g.ld(vb, -300, 238, 557, 312, 'PROPOSED 300 PFC HALFCAP\nSTRENGTHENING'); g.lds(vb, [[-R - 25, 238], [-R - 25, -238]], 527, 344, 'DRILL ON SITE φ22\nHOLES IN PFC FOR\nTHREADED RODS\n(TYP)'); g.lds(vb, [[-337, -300], [-337, -420]], 531, 402, '200x675 TIMBER PACKER\n(PROVIDE RECESSES FOR\nWASHER AND NUT)');
    g.ld(vb, 50, 30, 646, 302, 'EXISTING TIMBER\nPILE', { dot: true }); g.ld(vb, R + 25, 120, 678, 329, 'φ20 THREADED ROD\n(TYP)'); g.ld(vb, hd + 150, -451, 663, 407, '200x200x13 EAx400 LONG\nCLEAT WITH SLOTTED HOLE\nFOR THREADED ROD\n(TYP)');
    g.ld(vb, -hd, -451 - 10 - s.b * 0.8, 612, 466, UCN); g.wld(vb, -hd, -451 - 10 - s.b * 0.3, 540, 458, { size: '6', all: true, site: true, tail: 'TYP' }); g.title(600, 498, 'SECTION B', 20);
    // SECTION C (1:10, at the waler): strap round the pile, rods, plates, cleats, UC
    const vc = g.view(10, 605, 638), yw = -R, yl = yw - 150;
    band(vc, -620, 620, R, R + 150); band(vc, -620, 620, yl, yw); vc.circ(0, 0, R, 'S-EXIST');
    vc.arc(0, 0, R + 3, 0, 180, 'S-NEW'); vc.arc(0, 0, R + 8, 0, 180, 'S-NEW'); [-1, 1].forEach(k => { vc.line(k * (R + 3), 0, k * (R + 3), -100, 'S-NEW'); vc.line(k * (R + 8), 0, k * (R + 8), -100, 'S-NEW');
      vc.bolt(k * (R + 18), 30, k * (R + 18), yl - 13, 20, 'none'); vc.rect(k * (R + 18) - 50, yl, 100, 65, 'S-NEW'); vc.spike(k * (R + 75), yl - 13, k * (R + 75), yl + 87); });
    cleat(vc, yl, 450); ucP(vc, yl - 13);
    vc.dim(10, 0, 10, -100, 0, '100'); vc.line(-20, 0, -R + 5, 0, 'S-DIM'); vc.dim(25, yl - 13, 25, yl - 23, 0, '10', { sub: '(TYP)' }); vc.dim(-R - 68, yl - 110, -R + 32, yl - 110, 0, '100');
    g.ld(vc, -R * 0.4, R * 0.92 + 5, 558, 543, '65x5FL\n(TYP)'); g.ld(vc, 40, 40, 656, 543, 'EXISTING TIMBER\nPILE', { dot: true }); g.ld(vc, -R - 18, -30, 520, 594, 'φ20 THREADED ROD'); g.wld(vc, -R - 8, -60, 533, 633, { size: '5', tail: 'TYP' });
    g.lds(vc, [[300, R + 150], [350, yw]], 693, 633, 'EXISTING TIMBER\nWALER'); g.ld(vc, -R - 18 - 50, yl + 40, 511, 660, '65x5FLx100 LONG\n(TYP)'); g.ld(vc, R + 75, yl + 80, 721, 673, 'M10x100 LONG COACH\nSCREW (TYP)'); g.wld(vc, -R - 68, yl, 530, 726, { size: '5', tail: 'TYP' });
    g.ld(vc, hd + 200, yl - 13, 685, 728, '200x200x13 EAx450 LONG\nCLEAT WITH SLOTTED HOLES\nFOR THREADED RODS\n(TYP)'); g.wld(vc, -hd, yl - 13 - 10 - s.b * 0.4, 544, 771, { size: '6', all: true, site: true, tail: 'TYP' }); g.ld(vc, hd, yl - 23 - s.b * 0.9, 646, 787, UCN);
    g.title(600, 827, 'SECTION C', 10);
    // SECTION D (at the lower waler)
    const vd = g.view(20, 605, 927); band(vd, -620, 620, R, R + 150); band(vd, -620, 620, yl, yw); vd.circ(0, 0, R, 'S-EXIST'); vd.arc(0, 0, R + 5, 0, 180, 'S-NEW'); [-1, 1].forEach(k => { vd.line(k * (R + 5), 0, k * (R + 5), yl - 13, 'S-NEW'); vd.line(k * (R + 18), 0, k * (R + 18), yl - 50, 'S-BOLT'); }); cleat(vd, yl, 450); ucP(vd, yl - 13);
    g.ld(vd, 40, 40, 635, 870, 'EXISTING TIMBER\nPILE', { dot: true }); g.lds(vd, [[-400, R + 150], [-350, yw]], 528, 929, 'EXISTING TIMBER\nWALER'); g.ld(vd, R + 5, -60, 677, 924, 'FIXING AS DETAILED ON\nSECT C ABOVE'); g.ld(vd, -hd - 150, yl - 13, 551, 977, '200x200x13 EAx\n450 LONG CLEAT\n(TYP)');
    g.ld(vd, -hd, yl - 23 - s.b * 0.85, 612, 1012, UCN); g.wld(vd, -hd, yl - 13 - 10 - s.b * 0.4, 540, 1032, { size: '6', all: true, site: true, tail: 'TYP' }); g.title(600, 1063, 'SECTION D', 20);
    // captions
    const r = g.main(95, 887, 'PIER PILE STRENGTHENING DETAILS', 'idot', 'XX30-XXXX', ['PIER N° X - PILE N° X', '1:20']);
    g.box(370, 848, DRG, { h: g.h }); const dp = g.S(385, 866); g.add({ t: 'line', a: dp, b: [r[0] + 22, r[1] + 3.5], L: 'S-NOTE' });
    g.box(105, 925, 'NOTE :-\nDESIGN ENGINEER TO ASSESS\nSUITABILITY OF STRENGTHENING\nMEMBER SHOWN ON DETAILS', { h: g.h });
    return g.done();
  }, 'A steel UC fixed alongside a weak timber pier pile with angle cleats to the strengthened halfcaps (through 300 PFCs and timber packers) and to each waler (strap round the pile); member to be checked by the design engineer.');

  // ================================================================== PN30-2109 PIER PILE REPAIR - TYPE 4 TABLE
  def('pn2109', 'Piles', 'Pier pile repair – Type 4 table (piers × piles)', 'PN30-2109', [P('piers', 'Number of piers', 5, { num: 1 }), P('piles', 'Piles per pier', 6, { num: 1 })], (p) => {
    const g = Pg(false), add = g.add, np = max(1, min(12, Math.round(+p.piers || 5))), nk = max(1, min(10, Math.round(+p.piles || 6)));
    const x0 = 38 * K, x1 = 157 * K, W = (725 - 157) * K, cw = W / nk, y0 = g.S(0, 512)[1], y1 = g.S(0, 555)[1], y2 = g.S(0, 600)[1], y3 = g.S(0, 643)[1], rh = 34 * K, yb = y3 - np * rh;
    const L = (a, b) => add({ t: 'line', a, b, L: 'S-TEXT' }), T = (x, y, t, h) => add({ t: 'text', p: [x, y], s: t, h: h || 3.0, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' });
    add({ t: 'pl', p: [[x0, y0], [x1 + W, y0], [x1 + W, yb], [x0, yb]], closed: true, L: 'S-TEXT' }); L([x1, y0], [x1, yb]); L([x1, y1], [x1 + W, y1]); L([x1, y2], [x1 + W, y2]); L([x0, y3], [x1 + W, y3]);
    for (let j = 1; j < nk; j++) L([x1 + j * cw, y2], [x1 + j * cw, yb]);
    T((x0 + x1) / 2, (y0 + y3) / 2, 'PIER N°'); T(x1 + W / 2, (y0 + y1) / 2, 'REPAIR TYPE 4 VARIATIONS (4A, 4B, 4C OR 4D)'); T(x1 + W / 2, (y1 + y2) / 2, 'PILE N°');
    for (let j = 0; j < nk; j++) T(x1 + (j + 0.5) * cw, (y2 + y3) / 2, String(j + 1));
    for (let i = 0; i < np; i++) { if (i) L([x0, y3 - i * rh], [x1 + W, y3 - i * rh]); T((x0 + x1) / 2, y3 - (i + 0.5) * rh, String(i + 1)); }
    const yt = yb - 24, t0 = 105 * K; add({ t: 'text', p: [t0, yt], s: 'PIER PILE REPAIR - TYPE 4 TABLE', h: 4.6, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); add({ t: 'line', a: [t0, yt - 1.4], b: [t0 + 31 * 4.6 * 0.6, yt - 1.4], L: 'S-TITLE' });
    add({ t: 'text', p: [t0 + 31 * 4.6 * 0.7 + 8, yt], s: 'XX30-XXXX', h: 3.0, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
    add({ t: 'text', p: [t0, yt - 8], s: 'PILE REPAIR TYPE SHALL BE CONFIRMED ON SITE ONLY', h: 2.8, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); add({ t: 'text', p: [t0, yt - 13], s: 'AFTER THOROUGH WATER BLASTING/CLEANING.', h: 2.8, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); add({ t: 'line', a: [t0, yt - 13.8], b: [t0 + 5 * 2.8 * 0.68, yt - 13.8], L: 'S-TEXT' });
    const bx = 175, by = yt - 26; g.box(bx / K, 1158 - by / K, DRG, { h: 2.8 }); g.dl(205 / K + 0 * bx, 1158 - by / K, (t0 + 31 * 4.6 * 0.7 + 26) / K, 1158 - (yt + 4) / K);
    return g.done();
  }, 'Schedule of Type 4 pier pile repair variations (4A – 4D) by pier and pile, confirmed on site only after thorough water blasting.');

  // ================================================================== PN30-2110 TABLE OF TYPES OF PIER PILE REPAIRS - TYPE 4
  // section sketch of a pile with reduced section; kind 'A' | 'B' | 'C' | 'D' (paper-scale view about its centre)
  function t4sketch(v, kind) { const Rp = 190, sl = kind === 'C' || kind === 'D', Rs = sl ? 265 : 190;
    const piece = pts => { v.pl(pts, true, 'S-EXIST'); v.hatch(pts, 'timber', 'S-HATCH', 0.6); };
    const arcPts = (r0, r1, a0, a1) => { const P = []; for (let i = 0; i <= 12; i++) { const a = (a0 + (a1 - a0) * i / 12) * PI / 180; P.push([r1 * Math.cos(a), r1 * Math.sin(a)]); } for (let i = 12; i >= 0; i--) { const a = (a0 + (a1 - a0) * i / 12) * PI / 180; P.push([r0 * Math.cos(a), r0 * Math.sin(a)]); } return P; };
    if (sl) { v.circ(0, 0, Rs, 'S-NEW'); v.hatch(ringPts(Rp + 8, Rs), 'gravel', 'S-HATCH', 0.5); v.hatch([[-95, -95], [95, -95], [95, 95], [-95, 95]], 'gravel', 'S-HATCH', 0.5); v.arc(0, 0, Rp, 150, 210, 'S-HIDDEN'); v.arc(0, 0, Rp, -30, 30, 'S-HIDDEN');
      [1, -1].forEach(k => { v.line(-12, k * (Rs + 15), -12, k * (Rs + 55), 'S-NEW'); v.line(12, k * (Rs + 15), 12, k * (Rs + 55), 'S-NEW'); v.line(-30, k * (Rs + 30), 30, k * (Rs + 30), 'S-NEW'); v.line(-30, k * (Rs + 40), 30, k * (Rs + 40), 'S-NEW'); }); }
    if (kind === 'A') { v.circ(0, 0, Rp + 25, 'S-HIDDEN'); piece(arcPts(95, Rp, 30, 150)); piece(arcPts(95, Rp, 210, 330)); const r = [[-160, -90], [160, -90], [160, 90], [-160, 90]]; piece(r); [40, 80, 120].forEach(rr => v.circ(0, 0, rr, 'S-HIDDEN')); v.circ(0, 0, 12, 'S-EXIST'); }
    if (kind === 'B') { v.circ(0, 0, Rp + 15, 'S-NEW'); v.hatch(ringPts(Rp - 2, Rp + 15), 'gravel', 'S-HATCH', 0.5); v.hatch([[-110, -80], [110, -80], [110, 80], [-110, 80]], 'gravel', 'S-HATCH', 0.5); piece(arcPts(100, Rp, 25, 155)); piece(arcPts(100, Rp, 205, 335)); piece([[-150, -70], [-75, -70], [-55, -30], [-55, 30], [-75, 70], [-150, 70]]); piece([[150, -70], [80, -70], [55, -25], [55, 25], [80, 70], [150, 70]]); }
    if (kind === 'C' || kind === 'D') { piece(arcPts(110, 185, 35, 145)); piece(arcPts(110, 185, 215, 325)); piece([[-185, -75], [-120, -80], [-115, 0], [-125, 85], [-180, 80]]); if (kind === 'C') piece([[185, -75], [125, -80], [115, 0], [120, 85], [180, 80]]);
      if (kind === 'D') { v.fill([[-100, -120], [-80, -120], [-80, 120], [-100, 120]], 'S-NEW'); v.fill([[100, -120], [80, -120], [80, 120], [100, 120]], 'S-NEW'); v.fill([[-80, -5], [80, -5], [80, 5], [-80, 5]], 'S-NEW'); } } }
  def('pn2110', 'Piles', 'Pier pile repair – Type 4 selection table (4A – 4D)', 'PN30-2110', [], () => {
    const g = Pg(true), add = g.add, X = [35, 135, 342, 548, 755, 958].map(x => x * K), Y = [20, 255, 277, 343, 447, 520, 602].map(y => g.S(0, y)[1]);
    const L = (a, b) => add({ t: 'line', a, b, L: 'S-TEXT' }), hb = 1.9;
    add({ t: 'pl', p: [[X[1], Y[0]], [X[5], Y[0]], [X[5], Y[6]], [X[0], Y[6]], [X[0], Y[1]], [X[1], Y[1]]], closed: true, L: 'S-TEXT' }); L([X[1], Y[0]], [X[1], Y[6]]); for (let j = 2; j < 5; j++) L([X[j], Y[0]], [X[j], Y[6]]); for (let i = 2; i < 6; i++) L([X[0], Y[i]], [X[5], Y[i]]); L([X[0], Y[1]], [X[5], Y[1]]);
    ['A', 'B', 'C', 'D'].forEach((k, j) => { const v = g.B.view(10, (X[j + 1] + X[j + 2]) / 2, (Y[0] + Y[1]) / 2); t4sketch(v, k); add({ t: 'text', p: [(X[j + 1] + X[j + 2]) / 2, (Y[1] + Y[2]) / 2], s: '4' + k, h: 3.0, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); });
    const head = ['TYPE', 'EXISTING\nTIMBER\nCONDITION', 'TIMBER\nCROSS\nSECTIONAL\nAREA', 'TIMBER\nSECTION\nSTABILITY', 'WORK\nREQUIRED'];
    head.forEach((t, i) => { const ls = t.split('\n'), yc = (Y[i + 1] + Y[i + 2]) / 2; ls.forEach((l, k) => add({ t: 'text', p: [i ? X[0] + 4 : (X[0] + X[1]) / 2, yc + ((ls.length - 1) / 2 - k) * 5.2], s: l, h: 3.0, al: i ? 'l' : 'c', v: 'm', ang: 0, L: 'S-TEXT' })); });
    const C = [
      ['PILE TIMBER IN GOOD CONDITION.\nNUMEROUS SURFACE SPLITS. WIDTH AT\nFACE TYPICALLY 5mm TO 15mm AND\nREDUCING QUICKLY WITH DEPTH. SPLITS\nNOT INTERCONNECTING.', '90% ORIGINAL CROSS SECTIONAL AREA\nOF TIMBER CAPABLE OF CARRYING\nLOADING.', 'GOOD', 'HIGH PRESSURE WATER JET PREPARATION.\nPLUG ONE END OF EXISTING BOLT HOLES\nAND FILL HOLE WITH EPIGEN 301 MRD\nEPOXY OR SIMILAR APPROVED.\nSEAL INDIVIDUAL SPLITS >10mm WIDTH\nWITH EPIGEN 1614 OR SIMILAR APPROVED.'],
      ["SIMILAR TO '4A' BUT MORE SIGNIFICANT\nLOSS OF SECTION AT WALER BOLT\nLOCATIONS φ50 HOLES AND CENTRAL\nPIPE. TIMBER ANNULUS >90mm.", '70% ORIGINAL CROSS SECTIONAL AREA\nOF TIMBER CAPABLE OF CARRYING\nLOADING.', 'ADEQUATE', 'HIGH PRESSURE WATER JET PREPARATION\nTHEN WRAP WITH 0.8 mm THICK CLEAR\nACRYLIC BEFORE APPLYING EPIGEN 301\nMRD EPOXY OR SIMILAR APPROVED.'],
      ["SIMILAR TO '4B'. EVEN GREATER LOSS\nOF SECTION AT WALER BOLT LOCATIONS,\nSOME INTERCONNECTED. LARGER CENTRAL\nPIPE. SOME SPLITS JOIN WITH PIPE VOID.\nTIMBER ANNULUS <80mm.", 'CAPABLE OF CARRYING AXIAL DEAD LOAD\nONLY DURING REPAIR PROCEDURE. NEED\nFOR STEEL SLEEVE TO SUPPLEMENT\nTIMBER STRENGTH. MINIMUM AREA OF\nGOOD TIMBER AVAILABLE SHALL BE\nEQUIVALENT TO 250 x 250mm\nSYMMETRICALLY LOCATED ABOUT THE\nPILE.', "CONSIDERATION FOR PILE STABILITY\nDURING THE WORKS. i.e. REMOVAL OF\nUNACCEPTABLE MATERIAL MAY REVEAL\nTHE CONDITION '4D'.", 'HIGH PRESSURE WATER JET CLEAN,\nTHEN FIT STEEL SLEEVE AND FILL WITH\nCONBEXTRA UW GROUT OR SIMILAR\nAPPROVED.'],
      ["SIMILAR TO '4C'. SIGNIFICANT LOSS OF\nSECTION AND OR NON-SYMMETRY OF\nTIMBER RETAINED.", 'INCAPABLE OF CARRYING DEAD LOADS IN\nAXIAL COMPRESSION. AREA OF GOOD\nTIMBER AVAILABLE LESS THAN 250 x\n250mm AND/OR NOT SYMMETRICALLY\nLOCATED ABOUT PILE.', 'ALTERNATIVE SUPPORT FOR PILE LOAD\nDURING THE WORK IS REQUIRED.', 'HIGH PRESSURE WATER JET PREPARATION\nCUT AWAY DETERIORATION ZONE AND\nADD UC SECTION, THEN FIT STEEL SLEEVE\nAND FILL WITH CONBEXTRA UW GROUT\nOR SIMILAR APPROVED.']];
    C.forEach((col, j) => col.forEach((t, i) => t.split('\n').forEach((l, k) => add({ t: 'text', p: [X[j + 1] + 2, Y[i + 2] - 2.2 - hb - k * hb * 1.55], s: l, h: hb, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }))));
    const t0 = g.S(180, 675); ['TABLE OF TYPES OF PIER PILE REPAIRS - TYPE 4 (INFORMATION FOR DETERMINING', 'TYPE OF REPAIR TO PIER PILES WITH REDUCED SECTION)'].forEach((l, i) => { add({ t: 'text', p: [t0[0], t0[1] - i * 8], s: l, h: 3.6, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); add({ t: 'line', a: [t0[0], t0[1] - i * 8 - 1.2], b: [t0[0] + l.length * 3.6 * 0.66, t0[1] - i * 8 - 1.2], L: 'S-TITLE' }); });
    return g.done();
  }, 'Selection criteria for the Type 4 repairs of pier piles with reduced section: existing condition, remaining area, stability and work required for 4A to 4D.');

  // ================================================================== PN30-2111 PIER PILE REPAIR DETAIL - TYPE 4 (4A, 4B, 4C, 4D)
  function grain(v, x0, x1, y0, y1, n) { for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i + 0.5) / n, a = (i % 3 - 1) * 18, P = []; for (let k = 0; k <= 6; k++) { const y = y0 + (y1 - y0) * k / 6; P.push([x + a * Math.sin(k * 1.1 + i), y]); } v.pl(P, false, 'S-HATCH'); } }
  // pile outline (existing) from y0 to y1 with S-breaks; notch: [ya, yb, depth] = waler notch cut in both sides
  function pileN(v, D, y0, y1, notch) { const R = D / 2; v.pileEnd(0, y0, D, 'S-EXIST'); v.pileEnd(0, y1, D, 'S-EXIST');
    [-1, 1].forEach(k => { if (notch) v.pl([[k * R, y0], [k * R, notch[0]], [k * (R - notch[2]), notch[0]], [k * (R - notch[2]), notch[1]], [k * R, notch[1]], [k * R, y1]], false, 'S-EXIST'); else v.line(k * R, y0, k * R, y1, 'S-EXIST'); }); }
  def('pn2111', 'Piles', 'Pier pile repair – Type 4 (4A seal, 4B wrap, 4C sleeve, 4D UC + sleeve)', 'PN30-2111', [P('D', 'Pile dia. (mm)', 400, { num: 1 }), P('zone', 'Deterioration zone (mm)', 850, { num: 1 })], (p) => {
    const g = Pg(true), D = max(250, min(500, +p.D || 400)), R = D / 2, Z = max(400, min(1500, +p.zone || 850)), H = 2720, za = 150 + 750, zb = za + Z, ztop = zb + 750; g.h = 2.5;
    // TYPE 4A
    const a = g.view(20, 115, 490); pileN(a, D, 0, H, [1536, 1790, 58]); grain(a, -R + 30, R - 30, 300, 2500, 5); a.line(0, 0, 0, 0, 'S-CL');
    g.ld(a, R, 1085, 188, 301, 'SEAL INDIVIDUAL SPLITS\n>10mm WIDTH.\nFILL EXISTING BOLT\nHOLES WITH APPROVED\nEPOXY.'); g.title(115, 532, "TYPE '4A'", null, null, 3.6);
    // TYPE 4B
    const b = g.view(20, 402, 490), hi = 1628, lo = 1097, wt = lo - 300; pileN(b, D, 0, H, [1536, 1790, 58]); grain(b, -R + 30, R - 30, 300, 2500, 5);
    b.rect(-R - 6, wt, D + 12, 1790 - wt, 'S-NEW'); b.rect(-R - 12, wt + 45, D + 24, 45, 'S-NEW'); [-1, 1].forEach(k => b.pl([[k * (R - 5), 1790], [k * (R - 5), 1720], [k * (R - 63), 1720], [k * (R - 63), 1536]], false, 'S-HIDDEN'));
    [[1790, 320], [hi, 360], [lo, 360], [wt, 360]].forEach(([y, x]) => b.line(R + 40, y, R + x, y, 'S-DIM')); b.line(-R - 220, hi, R + 10, hi, 'S-DIM'); b.line(-R - 220, lo, R + 10, lo, 'S-DIM');
    b.dim(R + 480, hi, R + 480, lo, 0, 'TIDAL', { sub: 'RANGE' }); b.dim(R + 480, lo, R + 480, wt, 0, '300'); 
    g.ld(b, R + 280, 1790, 485, 189, 'TO BE ABOVE WALER\nNOTCH AND A 100 MIN\nABOVE W.L. (HIGH)', {});
    [[hi, 'W.L.   (HIGH)'], [lo, 'W.L.   (LOW)']].forEach(([y, t]) => { b.water(R + 1000, y); b.text(R + 820, y + 120, t, g.h); });
    g.ld(b, -R - 6, 1790, 326, 208, 'WRAP PILE WITH\n0.8 mm THICK CLEAR\nACRYLIC & FILL WITH\nAPPROVED EPOXY.'); g.ld(b, -R - 12, wt + 60, 340, 416, 'CONTAINMENT BY\nTOURNIQUET TAPE\nOR SIMILAR APPROVED.'); g.title(402, 532, "TYPE '4B'", null, null, 3.6);
    // TYPE 4C / 4D: sleeve with grout, 750 overlap each end of the deterioration zone
    const sleeve = (v) => { [-1, 1].forEach(k => { v.line(k * 250, 150, k * 250, ztop, 'S-NEW'); v.line(k * 245, 150, k * 245, ztop, 'S-NEW'); [150, za, zb, ztop].forEach(y => { v.line(k * 250, y, k * 290, y, 'S-NEW'); v.line(k * 290, y - 15, k * 290, y + 15, 'S-NEW'); }); });
      [[150, za, '750', 'OVERLAP WITH SOUND TIMBER'], [za, zb, 'DETERIORATION', 'ZONE'], [zb, ztop, '750', 'OVERLAP WITH SOUND TIMBER']].forEach(([y0, y1, t, sub]) => v.dim(560, y0, 560, y1, 0, t, { sub }));
      [150, za, zb, ztop].forEach(y => v.line(300, y, 600, y, 'S-DIM')); };
    const c = g.view(20, 687, 490); sleeve(c); [-1, 1].forEach(k => c.pl([[k * R, 0], [k * R, za], [k * (R - 40), za + 80], [k * (R - 25), zb - 120], [k * (R - 70), zb - 90], [k * (R - 70), zb], [k * R, zb], [k * R, H]], false, 'S-EXIST')); c.pileEnd(0, 0, D, 'S-EXIST'); c.pileEnd(0, H, D, 'S-EXIST'); grain(c, -R + 40, R - 40, 300, 2500, 6);
    g.ld(c, -235, ztop - 150, 603, 124, 'CONBEXTRA UW\nCEMENTITIOUS\nGROUT', { dot: true }); g.ld(c, -250, 700, 595, 436, 'FOR SLEEVE DETAILS\nREFER TO DETAIL\n(TYP)'); g.title(687, 532, "TYPE '4C'", null, null, 3.6);
    const d = g.view(20, 983, 490), s = SEC['200UC52']; sleeve(d);
    [-1, 1].forEach(k => { d.pl([[k * R, 0], [k * R, za - 80], [k * (R - 30), za]], false, 'S-EXIST'); d.pl([[k * (R - 30), zb], [k * R, zb + 80], [k * R, H]], false, 'S-EXIST'); });
    d.line(-R + 30, za, R - 30, za, 'S-EXIST'); d.line(-R + 30, zb, R - 30, zb, 'S-EXIST'); d.pileEnd(0, 0, D, 'S-EXIST'); d.pileEnd(0, H, D, 'S-EXIST'); grain(d, -R + 40, R - 40, 200, za - 120, 5); grain(d, -R + 40, R - 40, zb + 120, 2550, 5);
    d.rect(-125, za, 250, 12, 'S-NEW'); d.rect(-125, zb - 12, 250, 12, 'S-NEW'); iElevWebV(d, 0, za + 12, zb - 12, s); [[za, -1], [zb, 1]].forEach(([y, k]) => { d.spike(-30, y, -30, y - k * 100); d.spike(30, y, 30, y - k * 100); });
    g.ld(d, -235, ztop - 40, 917, 110, 'CONBEXTRA UW\nCEMENTITIOUS\nGROUT', { dot: true }); g.ld(d, 30, zb + 70, 912, 182, '2-φ10x100\nLONG SPIKES\n(TYP)'); g.ld(d, -s.d / 2, (za + zb) / 2 + 200, 903, 245, '200 UC 52\nLENGTH TO\nSUIT'); g.wld(d, -s.d / 2, za + 14, 925, 326, { size: '6', all: true, tail: 'TYP' }); g.ld(d, -80, za + 6, 918, 447, '250x12FLx250\n(TYP)');
    g.title(983, 532, "TYPE '4D'", null, null, 3.6);
    const r = g.main(440, 580, 'PIER PILE REPAIR DETAIL - TYPE 4', 'target', 'XX30-XXXX', ['1:20']);
    g.box(850, 607, DRG, { h: g.h }); g.dl(860, 607, (r[0] + 20) / K, 819 - (r[1] + 3) / K);
    g.box(75, 605, 'THE FOLLOWING DETAILS NEED TO BE INCLUDED\nWITH THIS DETAIL :-\n• SLEEVE DETAIL (PN30-2112)\n• REPAIR INFORMATION FOR PIER PILES WITH\n   REDUCED SECTION (PN30-2110)', { h: g.h });
    const t0 = g.S(440, 625); g.add({ t: 'text', p: t0, s: 'PREPARATION OF PILE SURFACE FOR GROUTING', h: 2.6, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); g.add({ t: 'line', a: [t0[0], t0[1] - 0.9], b: [t0[0] + 40 * 2.6 * 0.62, t0[1] - 0.9], L: 'S-TEXT' });
    g.mtext(440, 643, '1.   CLEAN OUT DEBRIS AND DECOMPOSED TIMBER WITH HIGH\n      PRESSURE WATER JETTING.\n2.   EXPOSED TIMBER SURFACES WITH A \'CORK LIKE\' DENSITY\n      SHALL BE REMOVED TO EXPOSE A QUALITY OF WOOD\n      WHICH WHEN DRILLED PRODUCES TIMBER PARTICLES WITH\n      A DEGREE OF CONTINUITY OF 2-3mm LENGTH, NOT A POWDER.', 2.5);
    return g.done();
  }, 'Pier piles with reduced section: 4A seal splits and fill bolt holes, 4B acrylic wrap and epoxy over the tidal range, 4C steel sleeve with grout, 4D replace the deteriorated zone with a UC inside the sleeve.');

  // ================================================================== PN30-2112 SLEEVE DETAIL - PIER PILE REPAIR TYPE 4C & 4D
  function pileRings(v, R) { [0.25, 0.45, 0.65, 0.85].forEach((k, i) => { for (let a = i * 20; a < 360; a += 70) v.arc(0, 0, R * k, a, a + 40, 'S-EXIST'); }); v.circ(0, 0, R * 0.12, 'S-EXIST');
    [[0, 0, -10, 40, 5, 85, 15, 130], [0, 0, 40, -20, 70, -60, 95, -110], [0, 0, -50, -10, -80, -55, -100, -100]].forEach(c => v.pl([[c[0], c[1]], [c[2], c[3]], [c[4], c[5]], [c[6], c[7]]], false, 'S-EXIST')); }
  function jointEA(v, k, t) { // pair of 50x50 angles at the sleeve joint on side k (plan, 1:10)
    const x0 = k * 205; [1, -1].forEach(m => v.pl([[x0, m * 7.5], [x0 + k * 50, m * 7.5], [x0 + k * 50, m * (7.5 + t)], [x0 + k * t, m * (7.5 + t)], [x0 + k * t, m * 57.5], [x0, m * 57.5]], true, 'S-NEW'));
    v.line(x0 + k * 28, -30, x0 + k * 28, 30, 'S-BOLT'); v.rect(x0 + k * 20, 20, 16 * k, 12, 'S-BOLT'); v.rect(x0 + k * 20, -32, 16 * k, 12, 'S-BOLT'); }
  def('pn2112', 'Piles', 'Sleeve detail – pier pile repair Types 4C & 4D', 'PN30-2112', [P('rot', 'Rot zone length (mm)', 500, { num: 1 })], (p) => {
    const g = Pg(false, 1.15), Z = max(300, min(800, +p.rot || 500)), Rp = 150, Rs = 200; g.h = 2.4;
    // SECTION B (1:10) at the coach screws
    const vb = g.view(10, 258, 172); vb.circ(0, 0, Rs, 'S-NEW'); vb.circ(0, 0, Rs + 5, 'S-NEW'); vb.hatch(ringPts(Rp + 4, Rs), 'gravel', 'S-HATCH', 0.4); vb.circ(0, 0, Rp, 'S-HIDDEN'); pileRings(vb, Rp); jointEA(vb, 1, 6); jointEA(vb, -1, 6);
    [150, 30, 270].forEach(a => { const c = Math.cos(a * PI / 180), sn = Math.sin(a * PI / 180); vb.spike((Rs + 20) * c, (Rs + 20) * sn, (Rs - 180) * c, (Rs - 180) * sn); });
    vb.circ(255, 0, 75, 'S-TEXT'); vb.dim(220, 120, 240, 120, 0, '20', { sub: '(TYP)' });
    g.ld(vb, (Rs + 15) * Math.cos(2.62), (Rs + 15) * Math.sin(2.62), 185, 95, '3-φ16x200 LONG COACH SCREWS\nWITH NEOPRENE WASHERS TO\nSUPPORT SLEEVE (TOP &\nBOTTOM) SCREWS ARE TO BE\nEQUALLY SPACED AROUND\nSLEEVE (TYP)'); g.ld(vb, -235, -15, 160, 210, 'M16 8.8s BOLT\n(TYP)'); g.ld(vb, (Rs + 5) * Math.cos(1.1), (Rs + 5) * Math.sin(1.1), 328, 112, '5PL (ROLLED STEEL)');
    g.ld(vb, 260, -40, 345, 205, '50x50x6 EA'); g.ld(vb, 40, -70, 310, 252, 'EXISTING TIMBER\nPILE', { dot: true }); const m3 = vb.P(330, 20); g.add({ t: 'circle', c: [m3[0] + 22, m3[1] + 1], r: 3, L: 'S-TITLE' }); g.add({ t: 'text', p: [m3[0] + 22, m3[1] + 1], s: '3', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); g.add({ t: 'line', a: m3, b: [m3[0] + 19, m3[1] + 1], L: 'S-TEXT' }); g.add({ t: 'text', p: [m3[0] + 26, m3[1] + 0], s: '(TYP)', h: g.h, al: 'l', v: 'm', ang: 0, L: 'S-TEXT' });
    g.title(258, 296, 'SECTION B', 10);
    // SECTION A (1:10) at the ring angles
    const va = g.view(10, 255, 434); va.circ(0, 0, Rs, 'S-NEW'); va.circ(0, 0, Rs + 5, 'S-NEW'); va.circ(0, 0, Rs + 55, 'S-NEW'); va.hatch(ringPts(Rp + 4, Rs), 'gravel', 'S-HATCH', 0.4); va.circ(0, 0, Rp, 'S-HIDDEN'); pileRings(va, Rp); jointEA(va, 1, 6); jointEA(va, -1, 6); va.circ(255, 0, 75, 'S-TEXT');
    flow(va, -330, 0, false); g.wld(va, (Rs + 5) * Math.cos(2.2), (Rs + 5) * Math.sin(2.2), 175, 370, { size: '5', tail: 'TYP' }); g.ld(va, (Rs + 5) * Math.cos(1.35), (Rs + 5) * Math.sin(1.35), 290, 368, '5PL (ROLLED STEEL)'); g.ld(va, (Rs + 55) * Math.cos(0.7), (Rs + 55) * Math.sin(0.7), 320, 393, '50x50x5 EA');
    g.ld(va, 275, -40, 345, 465, 'ANGLE'); g.ld(va, -Rs + 25, -60, 177, 487, 'CEMENTITIOUS GROUT CONBEXTRA\nUW BY FOSROC (OR SIMILAR\nAPPROVED) MIN 40mm THICK,\nMAX 75mm THICK BETWEEN PILE\nAND SLEEVE (TYP)'); g.ld(va, 30, -60, 300, 510, 'EXISTING TIMBER\nPILE', { dot: true });
    const m2 = va.P(330, 20); g.add({ t: 'circle', c: [m2[0] + 22, m2[1] + 1], r: 3, L: 'S-TITLE' }); g.add({ t: 'text', p: [m2[0] + 22, m2[1] + 1], s: '2', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); g.add({ t: 'line', a: m2, b: [m2[0] + 19, m2[1] + 1], L: 'S-TEXT' }); g.add({ t: 'text', p: [m2[0] + 26, m2[1]], s: '(TYP)', h: g.h, al: 'l', v: 'm', ang: 0, L: 'S-TEXT' });
    g.title(258, 568, 'SECTION A', 10); g.mtext(128, 600, 'NOTE:  SITE MEASURE AND FABRICATE SLEEVE WITH\n            DIAMETERS TO SUIT GROUT THICKNESSES IN\n            THE RANGE 40 MIN TO 75 MAX AROUND PILES.', g.h);
    // SLEEVE DETAIL (1:20)
    const L = 1500 + Z, ve = g.view(20, 255, 945); pileElev(ve, 0, -250, L + 250, 2 * Rp, 'S-EXIST', true); ve.line(-Rs, 0, -Rs, L, 'S-NEW'); ve.line(Rs, 0, Rs, L, 'S-NEW');
    [-1, 1].forEach(k => { ve.rect(k > 0 ? Rs + 5 : -Rs - 55, 0, 50, L, 'S-NEW'); ve.line(k * (Rs + 30), 0, k * (Rs + 30), L, 'S-CL');
      [0, 750, 750 + Z, L].forEach((y, i) => { const ys = i === 0 ? [30, 95, 160] : i === 3 ? [L - 30, L - 95, L - 160] : [y - 90, y - 25, y + 25, y + 90]; ys.forEach(yy => ve.circ(k * (Rs + 30), yy, 9, 'S-BOLT')); });
      [375, 750 + Z / 2, 750 + Z + 375].forEach(y => ve.circ(k * (Rs + 30), y, 9, 'S-BOLT')); });
    [20, 750, 750 + Z, L - 20].forEach(y => { ve.line(-Rs, y - 6, Rs, y - 6, 'S-NEW'); ve.line(-Rs, y + 6, Rs, y + 6, 'S-NEW'); });
    [250, L - 250].forEach(y => { ve.line(-40, y, 40, y, 'S-BOLT'); ve.line(0, y - 40, 0, y + 40, 'S-BOLT'); });
    const xd = Rs + 200; [[0, 750, '750'], [750, 750 + Z, 'ROT ZONE'], [750 + Z, L, '750']].forEach(([a, b, t]) => ve.dim(xd + 200, a, xd + 200, b, 0, t)); ve.dim(xd + 380, 0, xd + 380, L, 0, 'LENGTH TO SUIT'); [0, 750, 750 + Z, L].forEach(y => ve.line(Rs + 60, y, xd + 420, y, 'S-DIM'));
    ve.dimChain([[xd + 50, L - 160], [xd + 50, L - 455], [xd + 50, L - 750]], 0, ['=', '=']); ve.dim(xd + 50, 0, xd + 50, 250, 0, '250'); ve.dim(Rs - 60, L, Rs - 60, L - 250, 0, '250'); ve.dim(-Rs - 150, L, -Rs - 150, L - 20, 0, '20');
    secLineR(ve, -Rs - 260, Rs + 900, L - 250, 'B'); secLineR(ve, -Rs - 260, Rs + 900, 50, 'A'); const e1 = ve.P(-Rs - 30, 90); g.add({ t: 'pl', p: ellP(e1[0], e1[1], 4, 7, 24), closed: true, L: 'S-TEXT' }); g.add({ t: 'circle', c: [e1[0] - 4, e1[1] + 11], r: 3, L: 'S-TITLE' }); g.add({ t: 'text', p: [e1[0] - 4, e1[1] + 11], s: '1', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' });
    flow(ve, -Rs - 450, 450, false);
    g.ld(ve, 0, L - 300, 197, 669, 'SITE MEASURE AND FABRICATE\n5PL SLEEVE, ROLLED TO SUIT', { dot: true }); g.ld(ve, Rp, L + 80, 318, 680, 'EXISTING TIMBER\nPILE', { dot: true }); g.ld(ve, -Rs - 30, L - 450, 181, 770, 'M16 BOLTS\n(TYP)'); g.ld(ve, -Rs - 55, 750 + Z / 2 + 100, 159, 806, '2-50x50x6 EA BOTH\nSIDES. SEE DETAIL 2');
    g.ld(ve, -Rs - 55, 750 + Z, 177, 842, '3-M16 8.8s BOLTS WITH\n40x5 FLx40 WASHERS\n(TYP)'); g.ld(ve, 0, 250, 218, 977, 'COACH SCREW\n(TYP)'); g.ld(ve, Rs, 14, 307, 962, '50x50x5 EA TOP, BOTTOM &\nEACH END OF ROT ZONE\n(750 MAX CRS)');
    g.title(255, 1040, 'SLEEVE DETAIL', 20); g.box(405, 1000, 'NOTE :  FOR CORROSION\nPROTECTION OF SLEEVES\nREFER TO SPECIFICATION', { solid: true, h: g.h });
    // DETAIL 3 (1:2.5): bolted joint of the sleeve
    const d3 = (v, ring) => { [1, -1].forEach(m => { const y0 = m * 7.5; v.pl([[0, y0], [50, y0], [50, y0 + m * 6], [6, y0 + m * 6], [6, y0 + m * 50], [0, y0 + m * 50]], true, 'S-NEW'); v.hatch([[0, y0], [50, y0], [50, y0 + m * 6], [6, y0 + m * 6], [6, y0 + m * 50], [0, y0 + m * 50]], 'ansi31', 'S-HATCH', 0.15); v.line(6, y0 + m * 50, 50, y0 + m * 12, 'S-NEW'); v.line(50, y0 + m * 6, 50, y0 + m * 12, 'S-NEW');
      v.pl([[-5, y0], [-5, y0 + m * 50], [-12, y0 + m * 80]], false, 'S-NEW'); v.pl([[0, y0 + m * 50], [-6, y0 + m * 82]], false, 'S-NEW'); v.fill([[18, y0], [32, y0], [32, y0 + m * 6], [18, y0 + m * 6]], 'S-NEW'); v.fill([[0, y0], [5, y0], [0, y0 + m * 5]], 'S-NEW'); });
      v.line(25, -70, 25, 70, 'S-CL'); v.pl([[-12, 80], [-60, 30], [-55, 25], [-75, 0], [-60, -30], [-55, -25], [-12, -80]], false, 'S-EXIST'); if (ring) { v.arc(-260, 0, 330, -12, 12, 'S-NEW'); v.arc(-260, 0, 335, -12, 12, 'S-NEW'); } };
    const v3 = g.view(2.5, 622, 222); d3(v3, false); v3.dim(25, 57.5, 50, 57.5, 3, '20'); v3.dim(-25, -7.5, -25, 7.5, 0, '15'); v3.dim(70, -13.5, 70, -7.5, 0, '10');
    g.wld(v3, 0, 50, 563, 152, { size: '4', all: true, tail: 'TYP' }); g.ld(v3, -5, 30, 538, 177, '5PL SLEEVE'); g.ld(v3, 50, 10, 665, 197, '50x50x6 EA\n(TYP)'); g.wld(v3, 48, -9, 690, 268, { size: '4', all: true, tail: 'TYP' });
    g.ld(v3, 2, -9, 635, 300, '5 CHAMFER TO ALLOW\nFOR WELD SINGLE BEVEL\nWELD GROUND FLUSH\n(TYP)'); g.ld(v3, 10, -57.5, 638, 345, '5FL (TYP)'); g.wld(v3, -5, -50, 560, 320, { size: '4', tail: 'TOP, BOTTOM & SIDE (TYP)' });
    const c3 = v3.P(25, 70); g.add({ t: 'text', p: [c3[0] - 1, c3[1] + 3], s: '℄ φ18 HOLE', h: g.h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); g.title(600, 375, 'DETAIL 3', '2.5');
    // DETAIL 2 (1:2.5): joint with the 50x50x5 ring angle
    const v2 = g.view(2.5, 622, 520); d3(v2, true); v2.dim(-25, -7.5, -25, 7.5, 0, '15'); v2.dim(70, -13.5, 70, -7.5, 0, '10');
    const c2 = v2.P(25, 70); g.add({ t: 'text', p: [c2[0] - 1, c2[1] + 3], s: '℄ φ18 HOLE', h: g.h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); g.wld(v2, 40, 14, 720, 455, { size: '5', tail: 'TOP AND\nBOTTOM OF\nANGLE (TYP)' });
    g.ld(v2, -5, 35, 538, 485, '5PL SLEEVE'); g.ld(v2, 50, 10, 700, 510, '50x50x6 EA (FOR\nDETAILS OF WELDING\nREFER TO DETAIL 3\nABOVE (TYP)'); g.ld(v2, 72, -40, 700, 590, '50x50x5 EA\n(TYP)'); g.wld(v2, -6, -60, 720, 640, { size: '5', tail: 'TYP' }); g.title(575, 690, 'DETAIL 2', '2.5');
    // DETAIL 1 (1:5): bottom of the sleeve
    const v1 = g.view(5, 608, 874); v1.rect(0, 0, 50, 260, 'S-NEW'); v1.brk(0, 260, 50, 260, 'S-NEW'); [37.5, 102.5, 167.5].forEach(y => { v1.rect(8, y - 25, 34, 50, 'S-NEW'); v1.circ(25, y, 9, 'S-BOLT'); v1.circ(25, y, 6, 'S-BOLT'); });
    [5, 70, 135, 200].forEach(y => v1.line(0, y, 50, y, 'S-NEW')); v1.line(55, 0, 55, 280, 'S-NEW'); v1.line(60, 5, 60, 280, 'S-NEW'); v1.hatch([[60, 5], [110, 5], [110, 220], [60, 220]], 'gravel', 'S-HATCH', 0.3); v1.line(110, 0, 110, 220, 'S-HIDDEN');
    v1.line(160, -60, 160, 220, 'S-EXIST'); v1.brk(110, 220, 160, 220, 'S-EXIST'); v1.brk(110, -60, 160, -60, 'S-EXIST'); v1.rect(0, 0, 60, 5, 'S-NEW'); v1.line(0, -3, 110, -3, 'S-NEW'); v1.fill([[102, -3], [112, -3], [112, 5], [102, 5]], 'S-NEW');
    v1.dimChain([[-40, 0], [-40, 5], [-40, 70], [-40, 135], [-40, 200], [-40, 205]], 0, ['5', '65', '65', '65', '5']);
    g.ld(v1, 0, 240, 572, 735, 'ANGLE'); g.ld(v1, 57, 270, 667, 735, '5PL SLEEVE'); g.ld(v1, 85, 120, 703, 783, 'CONBEXTRA UW\nCEMENTITIOUS\nGROUT', { dot: true }); g.ld(v1, 135, 40, 703, 853, 'EXISTING TIMBER\nPILE', { dot: true });
    g.ld(v1, 2, 3, 552, 832, '50x50x5 EA TOP,\nBOTTOM & EACH\nEND OF ROT ZONE\n(750 MAX CRS)\n(TYP)'); g.ld(v1, 30, -3, 575, 909, 'PLYWOOD TEMPLATES\nMAY BE USED AS\nTEMPORARY SEAL\nAROUND BOTTOM OF\nSLEEVE'); g.ld(v1, 107, -3, 668, 932, 'COMPRIBAND OR SIMILAR\nAPPROVED SEAL AROUND\nBOTTOM OF TEMPLATE.\n(TYP)');
    g.title(642, 1000, 'DETAIL 1', 5);
    const t0 = g.S(190, 1083), tt = 'SLEEVE DETAIL - PIER PILE REPAIR - TYPE 4C & 4D'; g.add({ t: 'text', p: t0, s: tt, h: 3.4, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); g.add({ t: 'line', a: [t0[0], t0[1] - 1.2], b: [t0[0] + tt.length * 3.4 * 0.62, t0[1] - 1.2], L: 'S-TITLE' });
    return g.done();
  }, 'Site-measured 5 mm rolled steel sleeve with bolted 50x50x6 EA joints, 50x50x5 EA rings and coach screws, grouted with CONBEXTRA UW (40 – 75 mm) round the pile, for Type 4C / 4D repairs.');

  // ================================================================== PN30-2113 PIER PILE REPAIR DETAIL - TYPE 5 (DENSO WRAP)
  def('pn2113', 'Piles', 'Pier pile repair – Type 5 (Denso wrap)', 'PN30-2113', [P('D', 'Pile dia. (mm)', 400, { num: 1 })], (p) => {
    const g = Pg(true, 1.0), D = max(250, min(600, +p.D || 400)), R = D / 2, hw = 1300, wt = hw + 300, wb = -500; g.h = 2.5;
    const v = g.view(20, 395, 400);
    pileElev(v, 0, -1150, 2250, D, 'S-EXIST', true); v.line(0, -1300, 0, 2400, 'S-CL');
    v.rect(-R, wb, D, wt - wb, 'S-NEW'); for (let y = wb + 60; y < wt; y += 110) v.line(-R, y, R, y + 45, 'S-NEW');
    v.line(-R - 120, hw, R + 1600, hw, 'S-EXIST'); v.wl(R + 1150, hw, 'HIGH WATER LEVEL');
    v.pl([[-R - 1200, 10], [-R, 0], [R, -20], [R + 300, 15], [R + 1300, 0]], false, 'S-GROUND'); v.ground(-R - 1200, -R - 300, 8); v.ground(R + 300, R + 1300, 12);
    v.dim(-R - 600, wb, -R - 600, wt, 0, "'X'"); v.line(-R - 10, wt, -R - 660, wt, 'S-DIM'); v.line(-R - 10, wb, -R - 660, wb, 'S-DIM');
    v.dim(-R - 300, hw, -R - 300, wt, 0, '300'); v.dim(R + 300, -0, R + 300, wb, 0, '500 MIN.'); v.line(R + 10, wb, R + 360, wb, 'S-DIM');
    g.ld(v, 20, wt - 40, 513, 42, 'DENSO WRAP "SEASHIELD SERIES 60 SYSTEM"\nOR SIMILAR APPROVED TO BE APPLIED ACCORDING\nTO MANUFACTURER\'S SPECIFICATION, BY\nMANUFACTURER\'S PRE QUALIFIED SUBCONTRACTORS.\nDETAILS OF PREQUALIFICATION OR MANUFACTURER\'S\nENDORSEMENT OF THE SUBCONTRACTOR TO BE\nPROVIDED TO SUPERINTENDENT PRIOR TO\nCOMMENCEMENT OF WORKS');
    g.box(35, 35, "DIMENSION 'X' SHALL BE\nDETERMINED BY ENGINEER", { h: g.h });
    const r = g.main(235, 625, 'PIER PILE REPAIR DETAIL - TYPE 5', 'xcirc', 'XX30-XXXX', ['PIER N° X - PILE N° X', '1:20'], 4.0);
    g.box(748, 478, DRG, { h: g.h }); g.dl(790, 515, (r[0] + 18) / (K * g.F), 819 - (r[1] + 4) / (K * g.F));
    return g.done();
  }, 'Denso "Seashield Series 60" wrap of a timber pier pile from 300 above high water level to at least 500 below ground level, applied by a pre-qualified subcontractor.');
})(typeof window !== 'undefined' ? window : globalThis);
