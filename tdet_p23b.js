/* StructCap Timber — repair details: PN30-2317A … 2321A (halfcap / fullcap strengthening).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;
  const bbox = A.bbox, shiftE = A.shiftE;

  // ------------------------------------------------------------------ small paper helpers
  // approximate rendered width of a string (Arial, as drawn by tdraw: font 1.38h, x-scale 0.86)
  const CW = { ' ': .278, '.': .278, ',': .278, ':': .278, ';': .278, '-': .333, '(': .333, ')': .333, '/': .278, '\'': .191, '"': .355, 'I': .278, 'J': .5, 'L': .556, 'F': .611, 'T': .611, 'M': .833, 'W': .944, 'x': .5, '°': .4, '<': .584, '>': .584, '=': .584, '&': .667, '℄': .7, 'φ': .6 };
  const tw = (s, h) => [...String(s)].reduce((a, c) => a + (CW[c] != null ? CW[c] : /[0-9]/.test(c) ? .556 : /[a-z]/.test(c) ? .52 : .7), 0) * 1.187 * (h || TH);
  const T = (B, x, y, s, h, al, v, L) => B.E.push({ t: 'text', p: [x, y], s: String(s), h: h || TH, al: al || 'l', v: v || 'b', ang: 0, L: L || 'S-TEXT' });
  const LN = (B, x1, y1, x2, y2, L) => B.E.push({ t: 'line', a: [x1, y1], b: [x2, y2], L: L || 'S-TEXT' });
  const PL = (B, pts, closed, L) => B.E.push({ t: 'pl', p: pts, closed: !!closed, L: L || 'S-TEXT' });
  const RC = (B, x, y, w, h, L) => PL(B, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, L);
  function arrowAt(B, a, ang) { const al = 2.4, aw = 0.8; B.E.push({ t: 'solid', p: [a, [a[0] - al * Math.cos(ang) - aw * Math.sin(ang), a[1] - al * Math.sin(ang) + aw * Math.cos(ang)], [a[0] - al * Math.cos(ang) + aw * Math.sin(ang), a[1] - al * Math.sin(ang) - aw * Math.cos(ang)]], L: 'S-TEXT' }); }
  // text lines in a box (top-left x,y). opt: dashed (designer's note, S-NOTE), center, h, pad, w (fixed width). 'NOTE' / 'NOTE:' at the start is underlined.
  function boxT(B, x, y, lines, opt) {
    opt = opt || {}; const h = opt.h || TH, pad = opt.pad == null ? 1.6 : opt.pad, W = opt.w || max(...lines.map(l => tw(l, h))) + 2 * pad, H = lines.length * h * 1.55 + pad * 1.4;
    RC(B, x, y - H, W, H, opt.dashed ? 'S-NOTE' : 'S-TEXT');
    lines.forEach((l, i) => { const yy = y - pad - h - i * h * 1.55 + 0.25; if (opt.center) T(B, x + W / 2, yy, l, h, 'c'); else T(B, x + pad, yy, l, h); });
    if (!opt.center && /^NOTE/.test(lines[0])) LN(B, x + pad, y - pad - h - 0.6, x + pad + tw('NOTE', h), y - pad - h - 0.6);
    return { x0: x, x1: x + W, y0: y - H, y1: y, h: H, w: W };
  }
  // box around a number written inside a text line (paper: left x of the number, baseline y)
  const numBox = (B, x, y, s, h, L) => RC(B, x - 0.5, y - 0.7, tw(s, h || TH) + 1, (h || TH) + 1.4, L || 'S-NOTE');
  // dashed connector polyline with an arrow at the last point
  function conn(B, pts) { PL(B, pts, false, 'S-NOTE'); const n = pts.length, a = pts[n - 1], b = pts[n - 2]; arrowAt(B, a, Math.atan2(a[1] - b[1], a[0] - b[0])); }
  // leader where a number in the text is boxed: '[300]' marks the boxed part (single line with the box)
  function leadB(v, x, y, dx, dy, s, opt) {
    const plain = s.replace(/\[|\]/g, ''); v.leader(x, y, dx, dy, plain, opt);
    const a = v.P(x, y), right = dx >= 0, h = (opt && opt.h) || TH, cx = a[0] + dx + (right ? 2.5 : -2.5);
    s.split('\n').forEach((l, i) => { const m = /\[([^\]]+)\]/.exec(l); if (!m) return; const pre = l.slice(0, m.index).replace(/\[|\]/g, ''), post = l.slice(m.index + m[0].length).replace(/\[|\]/g, ''), xn = right ? cx + 1 + tw(pre, h) : cx - 1 - tw(m[1] + post, h); numBox(v.B, xn, a[1] + dy - h / 2 - i * h * 1.55, m[1], h); });
  }
  // custom "arrows outside" dimension for small values: horizontal (x1<x2 at y) with label to the left/right
  function dimH(v, x1, x2, y, ext1, ext2, txt, side, opt) {
    opt = opt || {}; const a = v.P(x1, y), b = v.P(x2, y), B = v.B;
    if (ext1 != null) LN(B, a[0], v.P(0, ext1)[1], a[0], a[1] - 1.2, 'S-DIM'); if (ext2 != null) LN(B, b[0], v.P(0, ext2)[1], b[0], b[1] - 1.2, 'S-DIM');
    const L = b[0] - a[0];
    if (L > 9 && !opt.out) { LN(B, a[0], a[1], b[0], b[1], 'S-DIM'); arrowAt(B, a, PI); arrowAt(B, b, 0); if (txt) T(B, (a[0] + b[0]) / 2, a[1] + 0.7, txt, 2.0, 'c', 'b', 'S-DIM'); if (opt.sub) T(B, (a[0] + b[0]) / 2, a[1] - 0.9, opt.sub, 1.8, 'c', 't', 'S-DIM'); return; }
    const tl = txt ? tw(txt, 2.0) + 2 : 4;
    LN(B, a[0] - (side === 'l' ? tl + 6 : 5), a[1], a[0], a[1], 'S-DIM'); LN(B, b[0], b[1], b[0] + (side === 'r' ? tl + 6 : 5), b[1], 'S-DIM'); arrowAt(B, a, 0); arrowAt(B, b, PI);
    if (txt) { const tx = side === 'l' ? a[0] - 3 - tl / 2 : b[0] + 3 + tl / 2; T(B, tx, a[1] + 0.7, txt, 2.0, 'c', 'b', 'S-DIM'); if (opt.sub) T(B, tx, a[1] - 0.9, opt.sub, 1.8, 'c', 't', 'S-DIM'); if (opt.box) numBox(B, tx - tw(txt, 2) / 2, a[1] + 0.7, txt, 2.0); }
  }
  // vertical small dim (y1<y2 at x), label rotated, arrows outside when small
  function dimV(v, x, y1, y2, txt, sub, opt) {
    opt = opt || {}; const a = v.P(x, y1), b = v.P(x, y2), B = v.B, L = b[1] - a[1];
    const rt = (px, py, s, h, vv) => B.E.push({ t: 'text', p: [px, py], s, h, al: 'c', v: vv, ang: 90, L: 'S-DIM' });
    if (opt.ext1 != null) LN(B, v.P(opt.ext1, 0)[0], a[1], a[0] + (opt.ext1 > x ? 1.2 : -1.2), a[1], 'S-DIM');
    if (opt.ext2 != null) LN(B, v.P(opt.ext2, 0)[0], b[1], b[0] + (opt.ext2 > x ? 1.2 : -1.2), b[1], 'S-DIM');
    if (L > 9) { LN(B, a[0], a[1], b[0], b[1], 'S-DIM'); arrowAt(B, a, -PI / 2); arrowAt(B, b, PI / 2); const m = (a[1] + b[1]) / 2; if (txt) rt(a[0] - 0.7, m, txt, 2.0, 'b'); if (sub) rt(a[0] + 0.9, m, sub, 1.8, 't'); return; }
    LN(B, a[0], a[1] - 5, a[0], a[1], 'S-DIM'); LN(B, b[0], b[1], b[0], b[1] + 9, 'S-DIM'); arrowAt(B, a, PI / 2); arrowAt(B, b, -PI / 2);
    const m = b[1] + 4 + tw(txt, 2) / 2; if (txt) rt(a[0] - 0.7, m, txt, 2.0, 'b'); if (sub) rt(a[0] + 0.9, m, sub, 1.8, 't');
  }
  // section-cut pointer: vertical tick with a filled half-arrow (MRWA "cut" end), at a model point, arrow pointing dir (+1 right / -1 left)
  function cutTick(v, x, y, len, dir) { const a = v.P(x, y), B = v.B; LN(B, a[0], a[1], a[0], a[1] - len, 'S-TITLE'); B.E.push({ t: 'solid', p: [[a[0], a[1] - len * 0.35], [a[0], a[1] - len], [a[0] + (dir || 1) * 2.2, a[1] - len * 0.62]], L: 'S-TITLE' }); }
  // section marker letter with pointer and a tick line (as on the elevations): circle at paper offset (0, up) above the model point
  function cutMark(v, x, y, ch, dir, len) { const a = v.P(x, y), B = v.B, L = len || 7; LN(B, a[0], a[1], a[0], a[1] + L, 'S-TITLE'); v.B.E.push({ t: 'circle', c: [a[0], a[1] + L + 3], r: 3, L: 'S-TEXT' }); T(B, a[0], a[1] + L + 3, ch, 3, 'c', 'm'); const d = (dir == null ? 0 : dir) * PI / 180, c = [a[0], a[1] + L + 3]; B.E.push({ t: 'solid', p: [[c[0] + 5.2 * Math.cos(d), c[1] + 5.2 * Math.sin(d)], [c[0] + 2.4 * Math.cos(d + 1.1), c[1] + 2.4 * Math.sin(d + 1.1)], [c[0] + 2.4 * Math.cos(d - 1.1), c[1] + 2.4 * Math.sin(d - 1.1)]], L: 'S-TEXT' }); }
  // view title with optional dashed '380 PFC' box under the scale
  function vtitle(B, x, y, s, scale, tag) {
    const m = /^(SECTION|VIEW|DETAIL)\s+(\S+)$/.exec(s), h = 3.2, word = m ? m[1] : s, ww = tw(word, h), x0 = x - (ww + (m ? 9 : 0)) / 2;
    T(B, x0, y, word, h, 'l', 'b', 'S-TITLE'); LN(B, x0, y - 1.1, x0 + ww, y - 1.1, 'S-TITLE');
    if (m) { B.E.push({ t: 'circle', c: [x0 + ww + 5, y + h / 2], r: 3, L: 'S-TITLE' }); T(B, x0 + ww + 5, y + h / 2, m[2], 3, 'c', 'm', 'S-TITLE'); }
    if (scale) T(B, x0, y - 4.4, '1:' + scale, TH * 0.95); if (tag) { const w = tw(tag, 3) + 6; RC(B, x - w / 2 + 6, y - 13.5, w, 6, 'S-NOTE'); T(B, x + 6, y - 11.3, tag, 3, 'c'); } }
  // detail call-out tag: circle with number at paper offset from a model point on a circle boundary
  function tagC(v, x, y, dx, dy, n) { const a = v.P(x, y), B = v.B, c = [a[0] + dx, a[1] + dy], L = Math.hypot(dx, dy); LN(B, a[0], a[1], c[0] - dx / L * 3, c[1] - dy / L * 3); B.E.push({ t: 'circle', c, r: 3, L: 'S-TEXT' }); T(B, c[0], c[1], n, 3, 'c', 'm'); }
  // place a group so its bbox top-left lands at (x, y); returns its bbox after the move
  function put(out, E, x, y) { const b = bbox(E); E.forEach(e => shiftE(e, x - b.x0, y - b.y1)); out.push(...E); return { x0: x, y1: y, x1: x + b.x1 - b.x0, y0: y - (b.y1 - b.y0), w: b.x1 - b.x0, h: b.y1 - b.y0 }; }
  const gap = (s) => (s.d >= 380 ? 60 : 55);
  const pfcOf = (p) => SEC[p.pfc] || SEC['300PFC'];
  // channel section polygon: web back face at x, top at yt, toes towards +x*k
  const cPts = (x, yt, s, k) => { k = k || 1; const d = s.d, b = s.b, tf = s.tf, w = s.tw; return [[0, 0], [b, 0], [b, -tf], [w, -tf], [w, -d + tf], [b, -d + tf], [b, -d], [0, -d]].map(q => [x + k * q[0], yt + q[1]]); };
  function pfcSec(v, x, yt, s, k, fill) { const pts = cPts(x, yt, s, k); v.pl(pts, true, 'S-NEW'); if (fill === 'solid') { const kk = k || 1, f = (x0, y0, x1, y1) => v.fill([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]); f(x, yt, x + kk * s.b, yt - s.tf); f(x, yt - s.d + s.tf, x + kk * s.b, yt - s.d); f(x, yt, x + kk * s.tw, yt - s.d); } else if (fill !== false) v.hatch(pts, 'ansi31', 'S-HATCH', 0.35); }

  // ================================================================== DETAIL — fullcap channel at a TIMBER pile (1:10)
  // kind: 'cleat' (150x100x10UA cleat, rods through pile, 2-M20 bolts, coach screw) | 'plain' ('U' rod) | 'ea' ('U' rod through 75x75x6 EA bracket)
  // origin: x = PFC web back face, y = underside of the timber fullcap. Returns nothing; draws into view v (scale 10).
  function detPile(v, s, kind, o) {
    o = o || {}; const d = s.d, b = s.b, tf = s.tf, w = s.tw, g = gap(s), pk = o.rhs ? 50 : 0, yT = -pk, yB = yT - d, yc = yT - d / 2, cl = kind === 'cleat';
    // existing fullcap above (part, timber X), cloud boundary of the detail
    const fx0 = -30, fx1 = g + 95, fy = 115; v.line(fx0, 0, fx1, 0, 'S-EXIST'); v.line(fx0, 0, fx0, fy, 'S-EXIST'); v.line(fx1, 0, fx1, fy, 'S-EXIST'); v.line(fx0, 0, fx1, fy, 'S-EXIST'); v.line(fx0, fy, fx1, 0, 'S-EXIST');
    const L = cl ? 300 : 240, cloud = [[fx1 + 15, fy + 25], [fx1 - 40, fy + 40], [-40, fy + 30], [-L * 0.55, fy - 5], [-L * 0.85, 30], [-L, -60], [-L * 0.98, yc], [-L * 0.92, yB + 30], [-L * 0.7, yB - 40], [-L * 0.3, yB - 75], [20, yB - 95], [70, yB - 100]];
    v.pl(cloud, false, 'S-TEXT');
    // channel, shim, threaded rod
    pfcSec(v, 0, yT, s, 1);
    v.rect(0, yB - 10, 130, 10, 'S-NEW'); v.line(b, yB - 5, 130, yB - 5, 'S-NEW');
    v.line(g - 10, yT - tf - 45, g - 10, fy, 'S-BOLT'); v.line(g + 10, yT - tf - 45, g + 10, fy, 'S-BOLT'); v.nut(g, yT - tf, 0, -1, 20);
    if (o.rhs) { rhsSec(v, 50, -25, 100, 50, 5); v.line(g - 10, 0, g - 10, -50, 'S-HIDDEN'); v.weld(100, -50, 14, 9, { size: '6', both: true, len: '50-300' }); }
    else v.nut(g, 0, 0, -1, 20);
    // trimmed pile face under the channel
    v.line(70, yB - 10, 70, yB - 135, 'S-EXIST');
    if (cl) {
      const c0 = yc - 115, c1 = yc + 115; v.rect(-150, c0, 150, 230, 'S-NEW'); v.line(-10, c0, -10, c1, 'S-NEW'); v.line(-140, c0, -140, c1, 'S-HIDDEN');
      [yc + 80, yc - 80].forEach(y => { v.circ(-100, y, 10, 'S-BOLT'); v.circ(-100, y, 17, 'S-BOLT'); v.rect(-132.5, y - 32.5, 65, 65, 'S-HIDDEN'); });
      [yc + 60, yc - 60].forEach(y => v.bolt(-10, y, w, y, 20));
      v.line(-205, yc, w, yc, 'S-HIDDEN'); v.pl([[-205, yc + 8], [-235, yc], [-205, yc - 8]], false, 'S-HIDDEN'); v.nut(w, yc, 1, 0, 20);
      v.dim(-100, c1 + 70, 0, c1 + 70, 0, '100'); v.line(-100, c1 + 85, -100, yc + 100, 'S-DIM'); v.line(0, c1 + 85, 0, yT + 10, 'S-DIM');
      dimV(v, -200, yc + 80, c1, '35', 'TYP', { ext1: -100, ext2: -160 }); v.dim(-200, c0, -200, c1, 0, '230'); v.line(-160, c0, -210, c0, 'S-DIM');
      v.dim(b + 40, yc - 60, b + 40, yc + 60, 0, '120'); v.line(w + 50, yc - 60, b + 48, yc - 60, 'S-DIM'); v.line(w + 50, yc + 60, b + 48, yc + 60, 'S-DIM');
      v.leader(-100, yc + 80 + 10, -14, 22, 'φ20 THREADED RODS\nWITH 65x5FLx65\nWASHER TO TIMBER\nFACE');
      v.leader(w + 40, yc + 60, 18, 15, '2 - M20 BOLTS (SITE DRILL\nφ22 HOLES IN PFC)');
      v.leader(-100, c0, -16, -2, '150x100x10UA\nCLEAT');
      v.leader(-170, yc + 20, -12, 4, 'EXISTING\nTIMBER PILE', { dot: true });
    } else {
      const yr = yT - d * 0.32; v.line(-L + 20, yr + 10, w + 30, yr + 10, 'S-BOLT'); v.line(-L + 20, yr - 10, w + 30, yr - 10, 'S-BOLT'); v.nut(w, yr, 1, 0, 20);
      if (kind === 'ea') { aSec(v, w, yr + 45, 75, 80, 6, 1, -1); v.arc(w + 6, yr, 26, -60, 60, 'S-NEW'); }
      v.leader(-150, yr + 70, -12, 6, 'EXISTING\nTIMBER PILE', { dot: true });
    }
    // weld to shim, shim note
    v.weld(b - 4, yB - 2, 14, 16, { size: '4', site: true });
    const sx = 175; v.line(135, yB, sx + 6, yB, 'S-DIM'); v.line(135, yB - 10, sx + 6, yB - 10, 'S-DIM'); v.line(sx, yB + 40, sx, yB, 'S-DIM'); v.line(sx, yB - 10, sx, yB - 45, 'S-DIM'); v.arrow(sx, yB, -90, 'S-DIM'); v.arrow(sx, yB - 10, 90, 'S-DIM');
    const sp = v.P(sx, yB + 40); LN(v.B, sp[0], sp[1], sp[0] + 3, sp[1]);
    ['130x(6,8,10 OR 12FL)x300 LONG', 'GALV STEEL SHIM IF REQUIRED.', 'TACK WELD STEEL SHIMS', 'TOGETHER AFTER PLACEMENT.', 'MAKE GOOD GALV. SURFACE', 'BY APPLYING COLD GALV'].forEach((l, i) => T(v.B, sp[0] + 4, sp[1] - 1.1 - i * TH * 1.55, l));
    v.leader(70, yB - 75, 0.01, -16, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED ' + secName(o.name || '300PFC') + (s.d >= 380 ? '' : '.'));
    // 70 MINIMUM BEARING + note box
    const yd = yB - 130; dimH(v, 0, 70, yd, yB - 2, yB - 12, null, 'l');
    const a = v.P(0, yd), lbl = 'MINIMUM BEARING', x70 = a[0] - 8 - tw('70 ' + lbl, TH);
    T(v.B, x70, a[1] + 0.8, '70'); numBox(v.B, x70, a[1] + 0.8, '70'); T(v.B, x70 + tw('70 ', TH), a[1] + 0.8, lbl);
    const nb = boxT(v.B, a[0] - 70, a[1] - 1.5, ['IF BEARING IS <70 THEN REFER', 'TO "HALFCAP OR FULLCAP TO', 'PILE BEARING DETAILS" ON', 'DRG N° XX30-XXX'], { dashed: true, center: true });
    return { p70: [x70 - 1, a[1] + 1.8], nb };
  }
  // column with DETAIL n for 380 PFC (in a dashed frame) above the same detail for 300 PFC, plus the two dashed designer notes left of them
  function detCol(kind, o) {
    o = o || {}; const B = new Builder(), n = o.n || '1', X = 112;
    const v1 = B.view(10, X, 0); const r1 = detPile(v1, SEC['380PFC'], kind, Object.assign({ name: '380PFC' }, o));
    vtitle(B, X + 6, r1.nb.y0 - 8, 'DETAIL ' + n, 10, '380 PFC');
    const b1 = bbox(B.E), fr = [b1.x0 - 4, b1.y0 - 3, b1.x1 + 4, b1.y1 + 4]; RC(B, fr[0], fr[1], fr[2] - fr[0], fr[3] - fr[1], 'S-NOTE');
    const Y2 = fr[1] - 24 - (o.rhs ? 3 : 0) - (kind === 'cleat' ? 9 : 0);
    const v2 = B.view(10, X, Y2); const r2 = detPile(v2, SEC['300PFC'], kind, Object.assign({ name: '300PFC' }, o));
    vtitle(B, X + 6, r2.nb.y0 - 8, 'DETAIL ' + n, 10, '300 PFC');
    // designer's notes and their connectors
    const nx = min(fr[0], r2.nb.x0) - 66;
    const n1 = boxT(B, nx, r2.p70[1] + 34, ['NOTE: IF ' + (o.half ? 'HALFCAP' : 'FULLCAP') + ' CHANNEL', 'IS SUPPORTED BY MORE THAN', '2 PILES THEN DRG REQUIRES', 'BOXED NOTE & PILE BEARING', 'DETAILS PN30-2328 &/OR 2329'], { dashed: true });
    const n2 = boxT(B, nx - 10, r2.nb.y0 - 6, ['ENGINEER TO DETERMINE IF', '70 MINIMUM BEARING GIVES', 'SUFFICIENT BEARING AREA', 'FOR PILE DIAMETERS AND', 'LOADINGS'], { dashed: true });
    const xa = nx - 4; conn(B, [[n2.x0 + 2, n2.y1], [n2.x0 + 2, r1.p70[1]], [r1.p70[0] - 1, r1.p70[1]]]); conn(B, [[n2.x0 + 2, r2.p70[1]], [r2.p70[0] - 1, r2.p70[1]]]);
    const xb = n1.x0 + n1.w * 0.55; conn(B, [[xb, n1.y1], [xb, r1.nb.y0 + 3], [r1.nb.x0, r1.nb.y0 + 3]]); conn(B, [[xb, n1.y0], [xb, r2.nb.y0 + 3], [r2.nb.x0, r2.nb.y0 + 3]]);
    return B.E;
  }
  // leader with its shoulder at an absolute paper point (sx, sy)
  function lab(v, x, y, sx, sy, s, opt) { const a = v.P(x, y); (/\[/.test(s) ? leadB : (vv, ...r) => vv.leader(...r))(v, x, y, sx - a[0], sy - a[1], s, opt); }
  // retaining-earth hatch: vertical line with oblique ticks on the left (model coords)
  function earth(v, x, y0, y1) { v.line(x, y0, x, y1, 'S-GROUND'); for (let y = y0 + 20; y < y1 - 40; y += 55) v.line(x, y, x - 40, y + 40, 'S-GROUND'); }
  const FC = { W: 250, D: 300, SD: 400, DK: 100 };

  // ================================================================== SECTION through an abutment fullcap at a TIMBER pile (1:20)
  // c: { cleat: 'UA' | 'EA' | null, rhs, urod, ea (2321 rod + curved washer), tag ('1'/'2'), sheet (label the sheeting), typ }
  function secTimber(v, s, D, c) {
    c = c || {}; const d = s.d, b = s.b, tf = s.tf, g = gap(s), pk = c.rhs ? 50 : 0, yT = -pk, yB = yT - d - 10, yc = yT - d / 2, fW = FC.W, fD = FC.D;
    const fx0 = g - fW / 2, fx1 = g + fW / 2, xpL = 70 - D, xp = 70 - D / 2, xs1 = xpL - 40, xs0 = xs1 - 75, xE = fx1 + 520, yS = fD + FC.SD, yD = yS + FC.DK, yP = -1250;
    // existing: fullcap (timber X), stringer, decking, sheeting, pile
    timberX(v, fx0, 0, fW, fD);
    v.pl([[xs1, yS], [xE, yS]], false, 'S-EXIST'); v.pl([[xs1, fD], [fx1 + 60, fD], [fx1 + 200, fD - 60], [xE, fD - 60]], false, 'S-EXIST'); v.line(xs1, fD, xs1, yS, 'S-EXIST'); v.pileEnd(xE, (yS + fD - 60) / 2, yS - fD + 60, 'S-EXIST', 1);
    v.rect(xs0, yS, xE + 40 - xs0, FC.DK, 'S-EXIST'); for (let x = xs0 + 150; x < xE; x += 160) v.line(x, yS, x, yD, 'S-EXIST'); v.brk(xE + 40, yS - 10, xE + 40, yD + 10);
    v.line(xs0, yP + 150, xs0, yD, 'S-EXIST'); v.line(xs1, yP + 150, xs1, yS, 'S-EXIST'); for (let y = yP + 300; y < yS; y += 260) v.line(xs1, y, xs1 - 30, y, 'S-EXIST'); v.brk(xs0, yP + 150, xs1, yP + 150);
    earth(v, xs0 - 5, yP + 250, yD);
    const xn = c.cleat ? -160 : 0;
    v.pl([[xpL, yP], [xpL, 0], [xn, 0], [xn, yB], [70, yB], [70, yP]], false, 'S-EXIST'); v.pileEnd(xp, yP, D, 'S-EXIST'); v.line(xp, yP - 100, xp, yD + 120, 'S-CL');
    v.rect(xpL - 12, yB - 200, D + 24, 30, 'S-EXIST');
    // proposed: PFC, shim, packer, rod
    pfcSec(v, 0, yT, s, 1, 'solid'); v.rect(0, yB, 130, 10, 'S-NEW');
    if (c.rhs) rhsSec(v, 50, -25, 100, 50, 5);
    v.line(g, yT - tf - 30, g, fD + 30, 'S-BOLT'); v.rect(g - 32, fD, 65, 6, 'S-BOLT'); v.fill([[g - 14, fD + 6], [g + 14, fD + 6], [g + 14, fD + 22], [g - 14, fD + 22]], 'S-BOLT'); v.fill([[g - 14, yT - tf], [g + 14, yT - tf], [g + 14, yT - tf - 18], [g - 14, yT - tf - 18]], 'S-BOLT');
    const yr = yT - d * 0.32;
    if (c.cleat) { v.rect(-150, yc - 115, 150, 230, 'S-NEW'); v.line(-10, yc - 115, -10, yc + 115, 'S-NEW'); [yc + 80, yc - 80].forEach(y => { v.circ(-100, y, 14, 'S-BOLT'); v.rect(-132, y - 32, 64, 64, 'S-HIDDEN'); }); [yc + 60, yc - 60].forEach(y => v.line(-10, y, 30, y, 'S-BOLT')); v.line(-200, yc, 0, yc, 'S-HIDDEN'); }
    else { v.line(xpL - 20, yr + 10, 30, yr + 10, 'S-HIDDEN'); v.line(xpL - 20, yr - 10, 30, yr - 10, 'S-HIDDEN'); v.fill([[8, yr - 15], [28, yr - 15], [28, yr + 15], [8, yr + 15]], 'S-BOLT');
      if (c.ea) { v.arc(xp, yr, D / 2 + 10, 150, 210, 'S-NEW'); v.rect(xpL - 70, yr - 38, 50, 76, 'S-NEW'); v.circ(xpL - 45, yr, 12, 'S-BOLT'); } }
    // detail circle and tag
    const R = max(230, d / 2 + 110), cx = c.cleat ? -30 : 40; v.circ(cx, yc, R, 'S-TEXT'); tagC(v, cx + R * 0.6, yc - R * 0.8, 5, -7, c.tag || '1');
    // dimensions
    const yd = yD + 200; dimH(v, fx0, g, yd, yD + 60, fD + 40, '50 MIN', 'r', { sub: '(TYP)', out: true });
    const y55 = fD * 0.35; dimH(v, 0, g, y55, null, null, String(g), 'r', { out: true, box: true }); v.line(0, y55 - 30, 0, y55 + 30, 'S-DIM');
    const p55 = v.P(g, y55), nb = boxT(v.B, p55[0] + 19, p55[1] - 3, ['55 - 300 PFC', '60 - 380 PFC'], { dashed: true, h: 2.6 }); conn(v.B, [[nb.x0, nb.y0 + nb.h * 0.45], [p55[0] + 9.5, p55[1] + 2.4]]);
    // labels
    const pl = v.P(xs0 - 60, 0)[0], pr = v.P(fx1 + 60, 0)[0];
    lab(v, g, fD + 26, v.P(g, 0)[0] + 22, v.P(0, yd)[1] + 2, 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE');
    lab(v, g - 70, fD * 0.6, pl, v.P(0, fD * 0.75)[1], 'EXISTING TIMBER\nFULLCAP' + (c.typ ? ' (TYP)' : ''), { dot: true });
    let ly = v.P(0, fD * 0.75)[1] - 9;
    if (c.sheet) { lab(v, xs0, -60, pl, ly - 4, 'EXISTING TIMBER\nSHEETING'); ly -= 10; }
    if (c.rhs) { lab(v, 20, -25, pl, ly - 4, 'RHS STEEL\nPACKER'); ly -= 10; }
    if (c.cleat) { lab(v, -150, yc + 90, pl, ly - 4, 'NOTCH PILE\nTO SUIT'); lab(v, -150, yc - 100, pl, ly - 20, '150x100x10' + c.cleat + '\nCLEAT'); }
    else if (!c.ea) lab(v, xpL - 20, yr, pl, ly - 6, 'φ20 \'U\' THREADED\nROD (TYP)');
    lab(v, 4, yc - 30, pr, v.P(0, yc - R * 0.6)[1], 'PROPOSED PFC FULLCAP\nSTRENGTHENING' + (c.typ ? ' (TYP)' : ''));
    lab(v, 70, yB - 650, pr, v.P(0, yB - 650)[1], 'EXISTING TIMBER\nPILE');
  }

  // ================================================================== ELEVATION of the abutment fullcap strengthening (1:20)
  // c: { cleat (UA cleat + coach screw at piles), urod, ea, scl (stringer angle cleats), rhs, rods: [...] (model x), mA, mB, mC (cut markers) }
  function elev(v, s, D, ps, c) {
    c = c || {}; const d = s.d, tf = s.tf, pk = c.rhs ? 50 : 0, yT = -pk, yB = yT - d - 10, yc = yT - d / 2, k = ps / 1700, fD = FC.D, R = 200, cy = fD + R - 40, yS = cy + R, yD = yS + FC.DK;
    const XL = -1080 * k, XR = ps + 470 * k, piles = [0, ps], sx = [-580, 390, 1360].map(x => x * k);
    // existing
    v.line(XL, 0, XR, 0, 'S-EXIST'); v.line(XL, fD, XR, fD, 'S-EXIST'); v.brk(XL, -20, XL, fD + 20); v.brk(XR, -20, XR, fD + 20);
    const a0 = Math.asin((fD - cy) / R) * 180 / PI; sx.forEach(x => { v.arc(x, cy, R, a0, 180 - a0, 'S-EXIST'); });
    v.line(XL - 30, yS, XR + 30, yS, 'S-EXIST'); v.line(XL - 30, yD, XR + 30, yD, 'S-EXIST'); v.brk(XL - 30, yS - 10, XL - 30, yD + 10); v.brk(XR + 30, yS - 10, XR + 30, yD + 10);
    sx.forEach(x => { v.line(x - 9, 25, x - 9, yS - 25, 'S-HIDDEN'); v.line(x + 9, 25, x + 9, yS - 25, 'S-HIDDEN'); v.rect(x - 25, yS - 22, 50, 10, 'S-EXIST'); v.rect(x - 15, yS - 12, 30, 12, 'S-EXIST'); v.rect(x - 25, 0, 50, 25, 'S-EXIST'); v.rect(x - 15, 5, 30, 14, 'S-EXIST'); });
    // proposed channel, packers, rods
    let XW = XL, xcol = 0;
    if (c.widen) { xcol = XL - 750; XW = xcol - 250; const xg = XL - 380; pfcElevH(v, XW, xg, yT, s, 'S-NEW'); v.line(XW, yT, XW, yT - d, 'S-NEW'); v.brk(xg, yT - d - 20, xg, yT + 20, 'S-NEW'); pfcElevH(v, xg + 70, XR, yT, s, 'S-NEW'); v.brk(xg + 70, yT - d - 20, xg + 70, yT + 20, 'S-NEW');
      const ub = SEC['360UB45']; v.rect(xcol - 150, yT, 300, fD - 12 - yT, 'S-NEW'); v.line(xcol - 150 + s.tf, yT, xcol - 150 + s.tf, fD - 12, 'S-NEW'); v.line(xcol + 150 - s.tf, yT, xcol + 150 - s.tf, fD - 12, 'S-NEW'); v.rect(xcol - 160, fD - 12, 320, 12, 'S-NEW'); iSec(v, xcol, fD + ub.d / 2, ub, 0, 'S-NEW');
      [-1, 1].forEach(kk => { v.fill([[xcol + kk * 45 - 10, fD - 12], [xcol + kk * 45 + 10, fD - 12], [xcol + kk * 45 + 10, fD + ub.tf + 15], [xcol + kk * 45 - 10, fD + ub.tf + 15]], 'S-BOLT'); v.line(xcol + kk * 150, yT - s.tf, xcol + kk * 150, yT - d + s.tf, 'S-NEW'); v.line(xcol + kk * 140, yT - s.tf, xcol + kk * 140, yT - d + s.tf, 'S-NEW'); });
      v.rect(-D / 2 - 85, yT - d + s.tf, 10, d - 2 * s.tf, 'S-NEW'); }
    else { pfcElevH(v, XL, XR, yT, s, 'S-NEW'); v.brk(XL, yT - d - 20, XL, yT + 20, 'S-NEW'); } v.brk(XR, yT - d - 20, XR, yT + 20, 'S-NEW');
    const rods = c.rods || [-790, -240, 600, 1115, 1920].map(x => x * k);
    if (c.rhs) { const cuts = [XL].concat(rods.slice(0, -1).map((x, i) => (x + rods[i + 1]) / 2), [XR]); cuts.forEach((x, i) => { if (i + 1 < cuts.length) v.rect(x + (i ? 15 : 0), -50, cuts[i + 1] - x - (i ? 15 : 0) - (i + 2 < cuts.length ? 15 : 0), 50, 'S-NEW'); }); }
    rods.forEach(x => { v.line(x, yT - tf - 20, x, fD + 25, 'S-BOLT'); v.line(x - 32, fD, x + 32, fD, 'S-BOLT'); v.fill([[x - 14, fD + 2], [x + 14, fD + 2], [x + 14, fD + 20], [x - 14, fD + 20]], 'S-BOLT'); v.fill([[x - 14, yT - tf], [x + 14, yT - tf], [x + 14, yT - tf - 18], [x - 14, yT - tf - 18]], 'S-BOLT'); });
    // piles (timber), shims, cleats / U rods
    if (c.steel) { const u = SEC[c.uc] || SEC['200UC52'], ub = SEC['250UC90']; piles.forEach(xp => {
      iSec(v, xp, yT - d - ub.d / 2, ub, 0, 'S-NEW'); iElevFlange(v, xp, yT - d - ub.d - 760, yT - d - ub.d, u, 'S-NEW'); v.brk(xp - u.b / 2, yT - d - ub.d - 760, xp + u.b / 2, yT - d - ub.d - 760, 'S-NEW');
      v.rect(xp - u.b / 2, yT - d, u.b, fD - yT + d, 'S-HIDDEN'); v.rect(xp - u.b / 2, fD, u.b, 20, 'S-NEW'); v.line(xp - u.tw / 2, fD, xp - u.tw / 2, fD + 20, 'S-HIDDEN'); v.line(xp + u.tw / 2, fD, xp + u.tw / 2, fD + 20, 'S-HIDDEN');
      const pk = [[xp - 125, yT - d], [xp + 125, yT - d], [xp + 125, yT], [xp - 125, yT]]; v.pl(pk, true, 'S-NEW'); v.hatch(pk, 'ansi31', 'S-HATCH', 2.5);
      [[xp - 80, yT - 60], [xp + 80, yT - d + 75]].forEach(q => v.fill(circP(q[0], q[1], 14, 12), 'S-BOLT')); });
      return { XL, XR, XW, xcol, yB: yT - d, yc, yT, yD, yS, sx, rods, piles, fD, R, cy, d, D, yLow: yT - d - 260 - 800 };
    }
    piles.forEach(xp => {
      v.line(xp - D / 2, yB, xp - D / 2, yB - 820, 'S-EXIST'); v.line(xp + D / 2, yB, xp + D / 2, yB - 820, 'S-EXIST'); v.pileEnd(xp, yB - 820, D, 'S-EXIST'); v.line(xp, yB - 870, xp, fD - 20, 'S-CL');
      v.rect(xp - D / 2, yT, D, fD - 30 - yT, 'S-HIDDEN'); v.rect(xp - D / 2 - 12, yB - 150, D + 24, 30, 'S-EXIST'); v.rect(xp - 150, yB, 300, 10, 'S-NEW');
      if (c.cleat) { v.rect(xp - D / 2 - 10, yc - 115, D / 2 + 60, 230, 'S-HIDDEN'); v.rect(xp - D / 2 - 10, yc - 115, 10, 230, 'S-NEW'); [yc + 80, yc - 80].forEach(y => { v.line(xp - D / 2, y, xp + D / 2 + 10, y, 'S-HIDDEN'); v.rect(xp + D / 2, y - 32, 10, 64, 'S-HIDDEN'); }); [yc + 55, yc - 55].forEach(y => { v.circ(xp - D / 2 + 30, y, 12, 'S-BOLT'); v.circ(xp - D / 2 + 30, y, 4, 'S-BOLT'); }); v.circ(xp, yc, 12, 'S-BOLT'); }
      if (c.urod) { [-1, 1].forEach(kk => { v.circ(xp + kk * (D / 2 + 20), yc, 14, 'S-BOLT'); v.fill([[xp + kk * (D / 2 + 20) - 5, yc - 5], [xp + kk * (D / 2 + 20) + 5, yc - 5], [xp + kk * (D / 2 + 20) + 5, yc + 5], [xp + kk * (D / 2 + 20) - 5, yc + 5]], 'S-BOLT'); }); v.line(xp - D / 2 - 6, yc, xp + D / 2 + 6, yc, 'S-HIDDEN'); }
      if (c.ea) [-1, 1].forEach(kk => { const x0 = xp + kk * (D / 2 + 50); v.rect(x0 - 38, yc - 20, 76, 76, 'S-NEW'); v.line(x0 + kk * 32, yc - 20, x0 + kk * 32, yc + 56, 'S-NEW'); v.circ(x0 - kk * 8, yc + 18, 13, 'S-BOLT'); });
    });
    if (c.scl) sx.forEach(x0 => {
      v.rect(x0 - 75, yc - 50, 150, 100, 'S-NEW');
      [-1, 1].forEach(kk => { const pb = [x0 + kk * 40, yc - 10], pt = [x0 + kk * (R + 5), cy + 10], L = Math.hypot(pt[0] - pb[0], pt[1] - pb[1]), u = [(pt[0] - pb[0]) / L, (pt[1] - pb[1]) / L], n = [kk * u[1], -kk * u[0]], q = (a, t, w) => [a[0] + u[0] * t + n[0] * w, a[1] + u[1] * t + n[1] * w];
        v.pl([q(pb, -40, -20), q(pb, L + 20, -20), q(pb, L + 20, 55), q(pb, -40, 55)], true, 'S-NEW'); v.line(...q(pb, -40, -10), ...q(pb, L + 20, -10), 'S-NEW');
        const h1 = q(pb, L - 20, 18), h0 = q(pb, 0, 18); v.circ(h1[0], h1[1], 12, 'S-BOLT'); v.circ(h0[0], h0[1], 12, 'S-BOLT'); v.circ(h0[0], h0[1], 4, 'S-BOLT');
        const e = [x0 - kk * R * 0.72, cy + R * 0.62]; v.line(h1[0], h1[1], e[0], e[1], 'S-BOLT'); const ue = [e[0] - h1[0], e[1] - h1[1]], le = Math.hypot(...ue); v.line(e[0] - ue[1] / le * 30, e[1] + ue[0] / le * 30, e[0] + ue[1] / le * 30, e[1] - ue[0] / le * 30, 'S-BOLT'); });
    });
    return { XL, XR, XW, xcol, yB, yc, yT, yD, yS, sx, rods, piles, fD, R, cy, d, D, yLow: yB - 820 - D / 2 };
  }
  // common labels, notes and markers of the elevation. c: { cleat, urod, rhs, scl, steel, coach (label text), recess (short text), jarrah }
  function elevLabels(v, s, D, r, c) {
    const B = v.B, Q = (x, y) => v.P(x, y), xl = Q(r.XL, 0)[0], xr = Q(r.XR, 0)[0], top = Q(0, r.yD)[1], bot = Q(0, r.yB)[1];
    if (c.scl) { lab(v, r.sx[1] - 40, r.yS - 60, Q(r.sx[1], 0)[0] - 8, top + 26, 'EXISTING TIMBER\nSTRINGER (TYP)'); lab(v, r.sx[0] - 120, r.yS - 110, xl + 12, top + 14, 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE'); lab(v, r.XR - 150, r.fD, xr + 2, Q(0, r.fD)[1] + 14, 'EXISTING TIMBER\nFULLCAP'); }
    else if (c.widen) lab(v, r.sx[1] - 60, (r.yS + r.fD) / 2, Q(r.sx[1], 0)[0] - 8, top + 20, 'EXISTING TIMBER\nSTRINGER (TYP)', { dot: true });
    else lab(v, r.sx[0] - 60, (r.yS + r.fD) / 2, xl - 4, top + 13, 'EXISTING TIMBER\nSTRINGER (TYP)', { dot: true });
    if (c.widen) lab(v, r.XL + 100, r.fD, xl - 2, top + 22, 'EXISTING\nTIMBER\nFULLCAP'); else lab(v, r.XL + 150, r.fD, xl - 4, Q(0, r.fD)[1] + 9, 'EXISTING TIMBER\nFULLCAP');
    { const xk = c.scl ? r.sx[2] : r.sx[1]; lab(v, xk + 300, r.yD, Q(xk, 0)[0] + 20, top + 14, 'EXISTING TIMBER\nDECKING'); }
    const rx = r.rods[r.rods.length - 1];
    lab(v, c.scl ? r.rods[1] : rx, r.fD + 22, c.scl ? Q(r.rods[1], 0)[0] + 3 : xr + 2, top + (c.scl ? 26 : 16), c.rhs ? 'φ20 THREADED RODS\nAT 900 CRS MAXIMUM\n(A MINIMUM OF 1 - φ20\nROD PER PACKER) WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP)' : c.scl ? '1 - φ20 THREADED\nROD PER SPAN WITH\n65x5FLx65 WASHER\nTO TIMBER FACE (TYP)' : 'φ20 THREADED RODS\nAT 900 CRS MAXIMUM\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP)');
    if (c.widen) lab(v, r.XL - 150, r.yT - s.d, Q(r.XL - 150, 0)[0] - 3, bot - 10, 'PROPOSED [' + secName(c.name).split(' ')[0] + '] PFC\nFULLCAP STRENGTHENING');
    else lab(v, r.XL + 450, r.yT - s.d, xl - 4, bot - 14, 'PROPOSED [' + secName(c.name).split(' ')[0] + '] PFC\nFULLCAP\nSTRENGTHENING');
    if (c.rhs && !c.jarrah) lab(v, r.XR - 120, r.yT + 25, xr + 2, Q(0, r.yT)[1] + 4, '100x50x5.0 RHS\nSTEEL PACKER\n(TYP)');
    if (c.coach) lab(v, 14, r.yc, Q(0, 0)[0] + 10, bot - 13, '1 - M20 x 250 LG COACH SCREW\n(SITE DRILL φ22 HOLE IN PFC)\n(TYP)');
    if (c.steel) { const u = SEC[c.uc] || SEC['200UC52'], yp = r.yB - 260 - 450; lab(v, u.b / 2, yp, Q(u.b / 2, 0)[0] + 9, Q(0, yp)[1], secName(c.uc || '200UC52') + ' PILE\n(TYP)'); lab(v, -80, r.yT - 60, Q(-80, 0)[0] - 7, bot - 14, '2-M20 BOLTS\n(TYP)'); lab(v, r.piles[1] + 60, r.yT - 150, xr + 2, bot + 2, 'DENOTES LOCATION OF\nSTEEL PACKER BEHIND\nPFC');
      dimH(v, -70, 70, r.fD + 140, r.fD + 20, r.fD + 20, '140', 'l', { out: true, sub: '(TYP)' }); dimV(v, r.piles[1] + 300, r.fD, r.fD + 20, '20', '(TYP)', { ext1: r.piles[1] + 100, ext2: r.piles[1] + 100 }); dimV(v, 200, r.yB, r.yB + 75, '75', '(TYP)', { ext1: 90, ext2: 90 }); }
    else lab(v, D / 2, r.yB - 520, Q(D / 2, 0)[0] + 9, Q(0, r.yB - 520)[1], 'EXISTING TIMBER\nPILE (TYP)');
    const sb = r.sx[2] + 9; lab(v, sb, 2, Q(sb, 0)[0] + 0.5, bot - 52, c.recess === 'short' ? 'SHORTEN EXISTING BOLT TO\nCLEAR PROPOSED FULLCAP\nSTRENGTHENING (TYP).' : 'RECESS EXISTING TIMBER FULLCAP\nAND SHORTEN EXISTING BOLT TO CLEAR\nPROPOSED FULLCAP STRENGTHENING.\nPROVIDE NEW 65x5FLx65 WASHER\nAND TIGHTEN BOLT. (TYP)');
    const p2 = r.piles[1];
    if (!c.steel) {
      lab(v, p2 + 150, r.yB, xr + 2, bot - 10, 'SHIM PLATES'); const sp = [xr + 5.5, bot - 10 - TH / 2]; LN(B, sp[0], sp[1] - 0.6, sp[0] + tw('SHIM PLATES'), sp[1] - 0.6);
      boxT(B, sp[0] - 1.5, sp[1] - 1.4, ['BEARING PLATES FOR', 'HALFCAPS WITH', 'BEARING < 70'], { dashed: true });
      v.dim(p2 - 150, r.yB - 330, p2 + 150, r.yB - 330, 0, '300', { sub: '(TYP)' }); v.line(p2 - 150, r.yB - 15, p2 - 150, r.yB - 360, 'S-DIM'); v.line(p2 + 150, r.yB - 15, p2 + 150, r.yB - 360, 'S-DIM');
    }
  }
  function capBlock(B, x, y, title, subs, ref) {
    const h = 3.6, ls = title.split('\n'), w = max(...ls.map(l => tw(l, h))), x0 = x - w / 2, bc = [x0 - 5, y + h / 2];
    for (let i = 0; i < 16; i++) { const a0 = 2 * PI * i / 16, a1 = 2 * PI * (i + 1) / 16; B.E.push({ t: 'solid', p: [bc, [bc[0] + 2 * Math.cos(a0), bc[1] + 2 * Math.sin(a0)], [bc[0] + 2 * Math.cos(a1), bc[1] + 2 * Math.sin(a1)]], L: 'S-TITLE' }); } LN(B, bc[0] - 4.5, bc[1], bc[0] - 2, bc[1], 'S-TITLE');
    ls.forEach((l, i) => { const yy = y + (ls.length - 1 - i) * h * 1.7; T(B, x0, yy, l, h, 'l', 'b', 'S-TITLE'); LN(B, x0, yy - 1.2, x0 + tw(l, h), yy - 1.2, 'S-TITLE'); });
    let yy = y - 4.8; (subs || '').split('\n').concat(['1:20']).forEach(l => { T(B, x0, yy, l); yy -= 3.4; });
    const xr = x0 + tw(ls[ls.length - 1], h) + 3;
    T(B, xr, y, ref || 'XX30-XXXX'); const bx = xr + 18, nb = boxT(B, bx, y - 7, ['DRG NUMBER - REFER TO', 'PLAN DRAWING'], { dashed: true }); LN(B, bx + 4, y - 7, xr + 8, y - 1.5); arrowAt(B, [xr + 8, y - 1.5], Math.atan2(5.5, xr + 4 - bx));
  }
  // note box under the elevation (left), 'ELEVATION' label under everything, the main caption and drawing-number note
  function elevFinish(B, ve, r, note, title, subs, nx) {
    const nb = boxT(B, ve.P(r.XL, 0)[0] + (nx || -2), ve.P(0, r.yLow)[1] - 3, note); const bb = bbox(B.E), cx = ve.P((r.XL + r.XR) / 2, 0)[0] + 10, y = bb.y0 - 5;
    T(B, cx, y, 'ELEVATION', 2.4, 'c'); LN(B, cx - tw('ELEVATION', 2.4) / 2, y - 0.8, cx + tw('ELEVATION', 2.4) / 2, y - 0.8);
    capBlock(B, cx, y - 10 - (title.split('\n').length - 1) * 6, title, subs);
  }
  const NOTE_PROP = ['NOTE: PROP STRINGERS PRIOR TO INSTALLING', 'FULLCAP STRENGTHENING. INSTALL FULLCAP', 'STRENGTHENING BY JACKING AGAINST TIMBER', 'FULLCAP TO REMOVE ALL BOWS, DEFLECTIONS', 'AND PROVIDE CONTINUOUS SUPPORT TO THE', 'EXISTING TIMBER FULLCAP.'];
  const NOTE_BANDS = (w) => ['NOTE: RELOCATE EXISTING PILE', 'BANDS AS REQUIRED TO SUIT', 'PROPOSED ' + (w || 'FULLCAP') + ' REPAIRS'];
  const NOTE_VARY = (pf) => ['NOTE: FULLCAP STRENGTHENING CHANNELS WILL VARY', 'ACCORDING TO ENGINEERING REQUIREMENTS.', secName(pf) + ' FULLCAP DRAWN. THIS DETAIL IS ONLY TO BE', 'USED WHERE THERE IS NO SIGNIFICANT PERMANENT', 'BOWING OR CRUSHING IN THE UNDERSIDE OF THE', 'EXISTING TIMBER FULLCAP (ENGINEER TO DETERMINE)'];
  const PRM = () => [P('pfc', 'PFC fullcap strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('D', 'Pile dia. (mm)', 350, { num: 1 }), P('ps', 'Pile spacing (mm)', 1700, { num: 1 })];
  const num = (x, dflt, lo, hi) => { x = +x; return isFinite(x) && x > 0 ? min(hi, max(lo, x)) : dflt; };

  // ================================================================== SECTION through the fullcap at a stringer, with stringer/fullcap angle cleat (1:20)
  function secStringer(v, s, c) {
    c = c || {}; const d = s.d, b = s.b, tf = s.tf, w = s.tw, g = gap(s), yT = 0, yc = -d / 2, fW = FC.W, fD = FC.D, fx0 = g - fW / 2, fx1 = g + fW / 2, xs1 = fx0 - 160, xs0 = xs1 - 75, xE = fx1 + 380, yS = fD + FC.SD, yD = yS + FC.DK;
    timberX(v, fx0, 0, fW, fD);
    v.pl([[xs1, yS], [xE, yS]], false, 'S-EXIST'); v.pl([[xs1, fD], [xE, fD]], false, 'S-EXIST'); v.line(xs1, fD, xs1, yS, 'S-EXIST'); v.pileEnd(xE, (yS + fD) / 2, yS - fD, 'S-EXIST', 1);
    v.rect(xs0, yS, xE + 40 - xs0, FC.DK, 'S-EXIST'); for (let x = xs0 + 150; x < xE; x += 160) v.line(x, yS, x, yD, 'S-EXIST'); v.brk(xE + 40, yS - 10, xE + 40, yD + 10);
    v.line(xs0, -d - 200, xs0, yD, 'S-EXIST'); v.line(xs1, -d - 200, xs1, yS, 'S-EXIST'); for (let y = -d - 100; y < yS; y += 260) v.line(xs1, y, xs1 - 30, y, 'S-EXIST'); v.brk(xs0, -d - 200, xs1, -d - 200); earth(v, xs0 - 5, -d - 120, yD - 300);
    pfcSec(v, 0, yT, s, 1, 'solid'); v.line(g, -tf - 25, g, fD + 25, 'S-BOLT'); v.rect(g - 32, fD, 65, 6, 'S-BOLT'); v.fill([[g - 14, fD + 6], [g + 14, fD + 6], [g + 14, fD + 22], [g - 14, fD + 22]], 'S-BOLT');
    // 150x100x10UA on the channel (outside the web), angle cleat up the stringer face, packer, bolts, rod through stringer
    const xc = -110; v.rect(xc, yc - 75, 100, 150, 'S-NEW'); v.line(xc, yc - 75, 0, yc - 75, 'S-NEW'); v.rect(-10, yc - 75, 10, 150, 'S-NEW');
    v.fill([[xc - 10, yc - 30], [xc, yc - 30], [xc, fD + 230], [xc - 10, fD + 230]], 'S-NEW'); v.rect(xc - 85, fD + 40, 75, 190, 'S-NEW');
    v.rect(xc - 20, yc - 32, 10, 65, 'S-NEW'); v.line(xc - 40, yc, xc + 30, yc, 'S-BOLT'); v.fill([[xc - 40, yc - 14], [xc - 22, yc - 14], [xc - 22, yc + 14], [xc - 40, yc + 14]], 'S-BOLT');
    v.line(xc - 40, fD + 180, fx1 + 30, fD + 180, 'S-BOLT'); v.rect(fx1 + 2, fD + 148, 6, 65, 'S-BOLT'); v.rect(xc - 30, fD + 160, 10, 40, 'S-BOLT');
    v.line(xc - 30, fD + 90, fx1 - 30, fD + 270, 'S-HIDDEN');
    dimH(v, -10, 40, -d - 70, -d + 20, -d - 20, '50', 'r', { out: true });
    const pl = v.P(xs0 - 60, 0)[0], pr = v.P(fx1 + 60, 0)[0];
    lab(v, fx0 + 40, fD * 0.7, v.P(fx0, 0)[0] - 2, v.P(0, yD + 150)[1], 'EXISTING TIMBER\nFULLCAP');
    lab(v, g, fD + 26, v.P(g, 0)[0] + 10, v.P(0, yD + 150)[1] + 4, 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE'); const p0 = v.P(g, 0), pq = v.P(g, yD + 150); [[fx1 + 8, fD + 180]].forEach(q => { const a = v.P(...q); LN(v.B, pq[0] + 10, pq[1] + 4, a[0], a[1]); arrowAt(v.B, a, Math.atan2(a[1] - pq[1] - 4, a[0] - pq[0] - 10)); });
    lab(v, xc - 30, fD + 180, pl, v.P(0, fD)[1], '65x10FLx65\nPACKER');
    lab(v, xc + 20, yc + 40, pl, v.P(0, yc + 40)[1], '150x100x10' + (c.ea ? 'EA' : 'UA') + '\nWITH φ22 HOLE\nDRILLED ON SITE\nFOR M20 BOLT');
    lab(v, xc - 10, fD + 100, pr, v.P(0, fD - 120)[1], 'STRINGER/FULLCAP\nANGLE CLEAT');
    lab(v, xc - 30, yc - 10, pr, v.P(0, yc - 50)[1], '1 - M20 BOLT (PACK\nBETWEEN ANGLE CLEAT\n& 150x100x10UA WITH 65\nx5FLx65 & 65x10FLx65\nWASHERS TO SUIT)');
    v.weld(xc + 50, yc - 75, -14, -12, { size: '6', all: true, tail: 'T&B' });
    lab(v, 40, -d, v.P(40, 0)[0] - 6, v.P(0, -d - 300)[1], 'PROPOSED\nPFC FULLCAP\nSTRENGTHENING');
  }
  // VIEW on the 125 leg of the angle cleat (slotted hole), 1:10
  function viewSlot(v) {
    v.line(0, 0, 125, 0, 'S-NEW'); v.line(0, 0, 0, -280, 'S-NEW'); v.line(125, 0, 125, -280, 'S-NEW'); v.line(115, 0, 115, -280, 'S-NEW'); v.brk(0, -280, 125, -280, 'S-NEW');
    v.line(25, -29, 60, -29, 'S-NEW'); v.line(25, -51, 60, -51, 'S-NEW'); v.arc(25, -40, 11, 90, 270, 'S-NEW'); v.arc(60, -40, 11, -90, 90, 'S-NEW');
    v.dim(0, 0, 125, 0, 14, '125'); dimH(v, 0, 60, 100, 2, 2, '60', 'l', { out: true }); dimH(v, 0, 25, 45, 2, 2, '25', 'l', { out: true });
    dimV(v, 160, -40, 0, '40', null, { ext1: 130, ext2: 130 }); v.leader(30, -45, -12, -14, 'φ22 x 60 LONG\nSLOTTED HOLE');
  }
  // plan of the 'U' threaded rod around the pile (1:20)
  function secURod(v, s, D, c) {
    const r = D / 2, b = s.b, yw = -r, W = 560;
    v.line(-W, r + 40, W, r + 40, 'S-EXIST'); v.line(-W, r + 115, W, r + 115, 'S-EXIST'); v.brk(-W, r + 30, -W, r + 125); v.brk(W, r + 30, W, r + 125); for (let x = -W * 0.55; x < W * 0.1; x += 55) v.line(x, r + 115, x + 40, r + 155, 'S-GROUND');
    v.arc(0, 0, r, 0, 180, 'S-EXIST'); v.arc(0, 0, r, 180, 360, 'S-HIDDEN');
    v.arc(0, 0, r + 12, 0, 180, 'S-BOLT'); v.arc(0, 0, r + 32, 0, 180, 'S-BOLT'); v.line(-r - 12, 0, -r - 12, yw - 60, 'S-BOLT'); v.line(-r - 32, 0, -r - 32, yw - 60, 'S-BOLT'); v.line(r + 12, 0, r + 12, yw - 60, 'S-BOLT'); v.line(r + 32, 0, r + 32, yw - 60, 'S-BOLT');
    v.line(-W, yw, W, yw, 'S-NEW'); v.line(-W, yw - 12, W, yw - 12, 'S-NEW'); v.line(-W, yw - b, W, yw - b, 'S-NEW'); v.brk(-W, yw - b - 10, -W, yw + 10, 'S-NEW'); v.brk(W, yw - b - 10, W, yw + 10, 'S-NEW');
    v.rect(-150, yw - b - 10, 300, 10, 'S-NEW'); [-r - 22, r + 22].forEach(x => v.fill([[x - 20, yw - 12], [x + 20, yw - 12], [x + 20, yw - 28], [x - 20, yw - 28]], 'S-BOLT'));
    v.leader(-r * 0.3, r + 10, -8, 16, '\'U\' THREADED\nROD'); v.leader(r * 0.4, r + 115, 10, 12, 'EXISTING TIMBER\nSHEETING');
    v.leader(-100, yw - b - 10, -10, -12, 'SHIM PLATES'); leadB(v, 160, yw - b, 14, -12, 'PROPOSED [' + secName(c.name).split(' ')[0] + '] PFC\nFULLCAP\nSTRENGTHENING');
  }
  // STRINGER/FULLCAP ANGLE CLEAT DETAILS, 1:5 (left and right hand)
  function cleatDetails(B, x, y, ch) {
    [[1, x], [-1, x + 120]].forEach(([k, ox]) => {
      const v = B.view(5, ox, y), X = q => k > 0 ? q : 75 - q, L = 680;
      v.pl([[X(25), L], [X(75), L], [X(75), 25], [X(50), 0], [X(0), 0], [X(0), L - 25]], true, 'S-NEW'); v.line(X(65), 0, X(65), L, 'S-NEW'); v.line(X(55), L - 40, X(85), L - 40, 'S-HIDDEN');
      [30, 365].forEach(yy => { v.circ(X(30), yy, 11, 'S-BOLT'); v.line(X(18), yy, X(42), yy, 'S-CL'); v.line(X(30), yy - 12, X(30), yy + 12, 'S-CL'); });
      const xd = k > 0 ? 150 : -75, xo = k > 0 ? 75 : 0; v.dim(xd, L, xd, 365, k > 0 ? 0 : 0, '315'); v.dim(xd, 365, xd, 30, 0, '335'); [L, 365, 30].forEach(yy => v.line(xo + k * 5, yy, xd + k * 10, yy, 'S-DIM'));
      dimV(v, k > 0 ? 110 : -35, L - 40, L, '40', null, { ext1: X(80), ext2: X(80) }); dimH(v, min(X(0), X(75)), max(X(0), X(75)), L + 80, L + 10, L + 10, '75', k > 0 ? 'r' : 'r', { out: true });
      dimH(v, min(X(30), X(75)), max(X(30), X(75)), -60, -10, -10, '45', k > 0 ? 'l' : 'r', { out: true });
      if (k < 0) { v.dim(-140, L, -140, 180, 0, '500'); v.line(-150, 180, X(70), 180, 'S-DIM'); v.line(-150, L, -10, L, 'S-DIM'); }
      v.leader(X(0), L - 4, k * -1 * 10, 6, '25 x 25\nCHAMFER'); v.leader(X(0), 450, k * -12, 4, '125x75x10 UA'); v.leaders([[X(30), 365], [X(30), 30]], k * -14, -12, 'φ22 HOLE');
      if (k > 0) v.leader(X(50), 0, 12, -6, '25 x 25\nCHAMFER');
      const mp = v.P(X(0) - k * 100, L - 120); B.E.push({ t: 'circle', c: mp, r: 3, L: 'S-TEXT' }); T(B, mp[0], mp[1], ch, 3, 'c', 'm'); const dd = k > 0 ? 0 : PI; B.E.push({ t: 'solid', p: [[mp[0] + 5.2 * Math.cos(dd), mp[1]], [mp[0] + 2.4 * Math.cos(dd + 1.1), mp[1] + 2.4 * Math.sin(dd + 1.1)], [mp[0] + 2.4 * Math.cos(dd - 1.1), mp[1] + 2.4 * Math.sin(dd - 1.1)]], L: 'S-TEXT' });
    });
    const ty = y - 26; T(B, x - 20, ty, 'STRINGER/FULLCAP ANGLE', 3.2, 'l', 'b', 'S-TITLE'); LN(B, x - 20, ty - 1.1, x - 20 + tw('STRINGER/FULLCAP ANGLE', 3.2), ty - 1.1, 'S-TITLE');
    T(B, x - 20, ty - 5.5, 'CLEAT DETAILS', 3.2, 'l', 'b', 'S-TITLE'); LN(B, x - 20, ty - 6.6, x - 20 + tw('CLEAT DETAILS', 3.2), ty - 6.6, 'S-TITLE'); T(B, x - 20, ty - 10.5, '1:5', TH * 0.95); T(B, x - 20, ty - 14, '1 OF EACH CLEAT REQUIRED PER STRINGER');
  }
  // horizontal cut marker at the right end of the channel, looking down
  function endMark(v, r, ch) { const a = v.P(r.XR + 60, r.yc); LN(v.B, a[0], a[1], a[0] + 8, a[1], 'S-TITLE'); v.B.E.push({ t: 'circle', c: [a[0] + 11, a[1]], r: 3, L: 'S-TEXT' }); T(v.B, a[0] + 11, a[1], ch, 3, 'c', 'm'); v.B.E.push({ t: 'solid', p: [[a[0] + 11, a[1] - 5.2], [a[0] + 11 - 2.2, a[1] - 1.2], [a[0] + 11 + 2.2, a[1] - 1.2]], L: 'S-TEXT' }); }
  // ================================================================== steel piles: DETAIL 1 (bracket welding, 1:10) and SECTION A (1:20)
  function detSteel(v, uc) {
    const u = SEC[uc] || SEC['200UC52'], b = SEC['250UC90'], W = u.d, f = u.tf;
    [-W, -W + f, -f, 0].forEach(x => v.line(x, -b.d - 150, x, 330, 'S-NEW')); v.brk(-W, 330, 0, 330, 'S-NEW'); v.brk(-W, -b.d - 150, 0, -b.d - 150, 'S-NEW');
    [0, -b.d].forEach(y => { v.line(-W + f, y - 5, -f, y - 5, 'S-NEW'); v.line(-W + f, y + 5, -f, y + 5, 'S-NEW'); });
    v.rect(0, -b.d, 200, b.d, 'S-NEW'); v.line(0, -b.tf, 200, -b.tf, 'S-NEW'); v.line(0, -b.d + b.tf, 200, -b.d + b.tf, 'S-NEW');
    const pk = [[0, 0], [25, 0], [25, 300], [0, 300]]; v.pl(pk, true, 'S-NEW'); v.hatch(pk, 'ansi37', 'S-HATCH', 0.5);
    v.fill([[25, 0], [115, 0], [115, 16], [25, 16]]); v.fill([[25, 0], [33, 0], [33, 130], [25, 130]]); v.brk(25, 135, 120, 135, 'S-NEW');
    v.weld(2, 0, 30, -8, { other: true }); v.weld(2, -b.d / 2, 34, -6, { size: '6', both: true }); v.weld(2, -b.d, 18, -14, {});
    v.weld(-W / 2, -b.d + 5, -22, -12, { size: '6', both: true, all: true, tail: 'TYP' });
  }
  function secSteel(v, s, c) {
    c = c || {}; const u = SEC[c.uc] || SEC['200UC52'], ub = SEC['250UC90'], d = s.d, g = gap(s), pk = c.rhs ? 50 : 0, yT = -pk, yB = yT - d, fD = FC.D, fx0 = -25, fx1 = fx0 + FC.W, xu1 = -25, xu0 = xu1 - u.d, xt0 = xu0 - 75, xs1 = xt0, xs0 = xs1 - 75, yS = fD + FC.SD, yD = yS + FC.DK, xE = fx1 + 520, yP = yB - ub.d - 500;
    timberX(v, fx0, 0, FC.W, fD);
    v.pl([[xs1, yS], [xE, yS]], false, 'S-EXIST'); v.pl([[xu0, fD + 30], [xs1, fD + 30]], false, 'S-EXIST'); v.pl([[xu1, fD + 30], [xu0, fD + 30]], false, 'S-EXIST'); v.pl([[fx0, fD], [fx1 + 60, fD], [fx1 + 200, fD - 60], [xE, fD - 60]], false, 'S-EXIST'); v.line(xs1, fD + 30, xs1, yS, 'S-EXIST'); v.pileEnd(xE, (yS + fD - 60) / 2, yS - fD + 60, 'S-EXIST', 1);
    v.rect(xs0, yS, xE + 40 - xs0, FC.DK, 'S-EXIST'); for (let x = xs0 + 150; x < xE; x += 160) v.line(x, yS, x, yD, 'S-EXIST'); v.brk(xE + 40, yS - 10, xE + 40, yD + 10);
    v.line(xs0, yP + 200, xs0, yD, 'S-EXIST'); v.line(xs1 - 75 + 75, yP + 200, xs1, fD + 30, 'S-EXIST'); for (let y = yP + 300; y < fD; y += 260) v.line(xs0, y, xs0 + 30, y, 'S-EXIST'); v.brk(xs0, yP + 200, xs1, yP + 200); earth(v, xs0 - 5, yP + 300, yD - 200);
    v.rect(xt0, yP + 150, 75, fD + 20 - yP - 150, 'S-EXIST'); v.brk(xt0, yP + 150, xt0 + 75, yP + 150);
    [xu0, xu0 + u.tf, xu1 - u.tf, xu1].forEach(x => v.line(x, yP, x, fD + 20, 'S-NEW')); v.line(xu0, fD + 20, xu1, fD + 20, 'S-NEW'); v.brk(xu0, yP, xu1, yP, 'S-NEW');
    v.rect(xu1, yB - ub.d, 200, ub.d, 'S-NEW'); v.line(xu1, yB - ub.tf, xu1 + 200, yB - ub.tf, 'S-NEW'); v.line(xu1, yB - ub.d + ub.tf, xu1 + 200, yB - ub.d + ub.tf, 'S-NEW');
    [yB, yB - ub.d].forEach(y => v.line(xu0 + u.tf, y + (y === yB ? -6 : 6), xu1 - u.tf, y + (y === yB ? -6 : 6), 'S-NEW'));
    const pkp = [[-25, yB], [0, yB], [0, yT], [-25, yT]]; v.pl(pkp, true, 'S-NEW'); v.hatch(pkp, 'ansi37', 'S-HATCH', 1.5);
    pfcSec(v, 0, yT, s, 1, 'solid'); if (c.rhs) rhsSec(v, 50, -25, 100, 50, 5);
    [yT - d * 0.25, yT - d * 0.75].forEach(y => { v.line(-60, y, 30, y, 'S-BOLT'); v.fill([[8, y - 13], [24, y - 13], [24, y + 13], [8, y + 13]], 'S-BOLT'); });
    v.line(g, yT - s.tf - 30, g, fD + 30, 'S-BOLT'); v.rect(g - 32, fD, 65, 6, 'S-BOLT'); v.fill([[g - 14, fD + 6], [g + 14, fD + 6], [g + 14, fD + 22], [g - 14, fD + 22]], 'S-BOLT'); v.fill([[g - 14, yT - s.tf], [g + 14, yT - s.tf], [g + 14, yT - s.tf - 18], [g - 14, yT - s.tf - 18]], 'S-BOLT');
    const Rc = 230, cx = xu1 + 60, cyc = yB - ub.d / 2; v.circ(cx, cyc, Rc, 'S-TEXT'); tagC(v, cx - Rc * 0.75, cyc - Rc * 0.66, -6, -7, '1');
    const yd = yD + 200; dimH(v, fx0, g, yd, yD + 60, fD + 40, '50 MIN', 'r', { sub: '(TYP)', out: true });
    const y55 = fD * 0.35; dimH(v, 0, g, y55, null, null, String(g), 'r', { out: true, box: true }); v.line(0, y55 - 30, 0, y55 + 30, 'S-DIM');
    const p55 = v.P(g, y55), nb = boxT(v.B, p55[0] + 19, p55[1] - 3, ['55 - 300 PFC', '60 - 380 PFC'], { dashed: true, h: 2.6 }); conn(v.B, [[nb.x0, nb.y0 + nb.h * 0.45], [p55[0] + 9.5, p55[1] + 2.4]]);
    const pl = v.P(xs0 - 60, 0)[0], pr = v.P(fx1 + 60, 0)[0], Y = y => v.P(0, y)[1];
    lab(v, g, fD + 26, v.P(g, 0)[0] + 22, Y(yd) + 2, 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE');
    lab(v, xs0, fD + 250, pl, Y(fD + 250), 'EXISTING TIMBER SHEETING');
    lab(v, fx0 + 60, fD * 0.6, pl, Y(fD * 0.6) + 2, 'EXISTING TIMBER FULLCAP', { dot: true });
    lab(v, xt0 + 37, 0, pl, Y(0) - 3, 'TIMBER PACKER', { dot: true });
    lab(v, -12, yT - d * 0.5, pl, Y(yT - d * 0.5) - 9, 'STEEL PACKERS\n250x(6,8,10 OR 12FL) x\nHEIGHT TO SUIT PFC');
    v.leaders([[xu0 + 50, yB - 6], [xu0 + 60, yB - ub.d + 6]], pl - v.P(xu0 + 50, 0)[0], Y(yB - ub.d) - 4 - Y(yB - 6), 'PROVIDE 2-10FL WEB\nSTIFFENERS NEAR AND\nFAR FACE IF ACCESS\nPERMITS');
    if (c.rhs) lab(v, 100, -25, pr, Y(yT) - 8, 'RHS STEEL PACKER');
    lab(v, 4, yT - d * 0.4, pr, Y(yT - d * 0.4) - 9, 'PROPOSED PFC FULLCAP\nSTRENGTHENING');
    lab(v, xu1 + 200, yB - ub.d * 0.7, pr, Y(yB - ub.d * 0.7) - 7, '250 UC 90\nx 200 LONG');
    lab(v, xu1, yP + 100, pr, Y(yP + 100), 'PROPOSED PILE');
  }
  // TYPICAL STEEL PACKER TO PFC WELDING DETAIL
  function weldDet(v, s) { pfcSec(v, 0, 0, s, 1); rhsSec(v, 50, 25, 100, 50, 5); v.weld(100, 0, 14, -8, { size: '6', both: true, len: '50-300' }); v.leader(10, 50, -18, -4, '100x50x5.0 RHS\nSTEEL PACKER'); v.leader(0, -s.d * 0.5, -16, -4, secName(s.name)); }
  function weldG(sn) { return () => { const s = Object.assign({ name: sn }, SEC[sn]), B = new Builder(); weldDet(B.view(10, 0, 0), s); const bb = bbox(B.E), x = (bb.x0 + bb.x1) / 2, y = bb.y0 - 10; ['TYPICAL STEEL PACKER', 'TO PFC WELDING DETAIL'].forEach((l, i) => { const w = tw(l, 3.2); T(B, x - w / 2, y - i * 6, l, 3.2, 'l', 'b', 'S-TITLE'); LN(B, x - w / 2, y - i * 6 - 1.1, x + w / 2, y - i * 6 - 1.1, 'S-TITLE'); }); const t = secName(sn), w = tw(t, 3) + 6; RC(B, x - w / 2, y - 20, w, 6, 'S-NOTE'); T(B, x, y - 17.8, t, 3, 'c'); return B.E; }; }
  // ================================================================== widening: SECTION C (rod + curved washer + EA bracket), DETAIL 1 (cap plate), VIEW A
  function secBracket(v, s, D) {
    const r = D / 2, xw = r + 10; v.circ(0, 0, r, 'S-EXIST'); v.line(-r - 60, -r - 120, -r - 60, r + 120, 'S-EXIST'); v.line(-r - 20, -r - 120, -r - 20, r + 120, 'S-EXIST'); v.brk(-r - 60, r + 120, -r - 20, r + 120); v.brk(-r - 60, -r - 120, -r - 20, -r - 120);
    v.rect(xw, -r - 140, s.tw, 2 * r + 280, 'S-NEW'); v.line(xw + s.b, -r - 140, xw + s.b, r + 140, 'S-HIDDEN'); v.brk(xw, r + 140, xw + s.b, r + 140, 'S-NEW'); v.brk(xw, -r - 140, xw + s.b, -r - 140, 'S-NEW');
    v.arc(0, 0, r + 8, 120, 240, 'S-NEW'); v.arc(0, 0, r + 22, 120, 240, 'S-NEW');
    [1, -1].forEach(k => { const a = [-(r + 8) * 0.5, k * (r + 8) * 0.866], e = [xw - 5, -k * r * 0.62]; v.line(a[0], a[1], e[0], e[1], 'S-BOLT'); v.pl([[xw, e[1] - 40], [xw - 45, e[1]], [xw, e[1] + 40]], true, 'S-NEW'); });
    v.circ(xw, 0, 20, 'S-HIDDEN');
    v.leader(xw, 18, -14, 26, 'φ40 HOLE TO PFC\nTO BE DRILLED ON\nSITE (TYP)'); v.leader(-(r + 22) * 0.9, (r + 22) * 0.4, -12, 4, 'CURVED WASHER\nREFER TO DRG\nN° 9530-0072'); v.leader(-r * 0.5, -r * 0.3, -14, -10, 'φ20 THREADED\nROD (TYP)');
    v.leader(xw - 20, r * 0.62, 12, 6, '75x75x6 EA x\n100 LONG WITH\nφ26 HOLE (TYP)'); v.weld(xw - 20, -r * 0.62 - 20, 10, -14, { size: '6', site: true, tail: 'TYP' });
  }
  function detCap(v) {
    const fl = 16; v.line(-260, 12, 260, 12, 'S-NEW'); v.line(-260, 12 + fl, 260, 12 + fl, 'S-NEW'); v.brk(-260, 0, -260, 40); v.brk(260, 0, 260, 40); v.line(-260, 250, 260, 250, 'S-EXIST'); v.brk(-260, 240, -260, 260); v.brk(260, 240, 260, 260);
    v.line(-4, 12 + fl, -4, 250, 'S-NEW'); v.line(4, 12 + fl, 4, 250, 'S-NEW');
    v.rect(-100, 0, 200, 12, 'S-NEW'); v.line(-5, 0, -5, -200, 'S-NEW'); v.line(85, 0, 85, -200, 'S-NEW'); v.line(5, 0, 5, -200, 'S-HIDDEN'); v.brk(-5, -200, 85, -200, 'S-NEW');
    [-45, 45].forEach(x => { v.line(x - 10, -20, x - 10, 50, 'S-BOLT'); v.line(x + 10, -20, x + 10, 50, 'S-BOLT'); v.rect(x - 16, 12 + fl, 32, 16, 'S-BOLT'); v.rect(x - 16, -16, 32, 16, 'S-BOLT'); });
    v.dim(-100, 60, 100, 60, 20, '200'); v.dim(-45, 60, 45, 60, 10, '90'); dimH(v, -100, -5, -110, -5, -40, '95', 'l', { out: true });
    v.leader(45, 30, 12, 26, 'M20 BOLTS\n(TYP)'); v.leader(-100, 6, -14, -16, '200x12FLx320 LONG\nCAP PLATE'); v.weld(85, -5, 18, -12, { size: '6', all: true });
  }
  function viewA(v) {
    const W = 500, f = 16; v.line(-W / 2, 0, W / 2, 0, 'S-NEW'); v.line(-W / 2, f, W / 2, f, 'S-NEW'); v.line(-W / 2, 352 - f, W / 2, 352 - f, 'S-NEW'); v.line(-W / 2, 352, W / 2, 352, 'S-NEW'); v.line(0, f, 0, 352 - f, 'S-NEW'); [-W / 2, W / 2].forEach(x => v.brk(x, -10, x, 362));
    v.rect(-100, -12, 200, 12, 'S-NEW'); v.rect(-45, -400, 90, 388, 'S-NEW'); v.line(-37, -400, -37, -12, 'S-NEW'); v.line(-45, -400, 45, -400, 'S-NEW');
    v.rect(45, -330, 10, 300, 'S-NEW'); [-45, 45].forEach(x => v.fill(circP(x / 3, 2, 10, 10), 'S-BOLT'));
    v.circ(0, 0, 110, 'S-TEXT'); tagC(v, 95, 55, 14, 8, '1'); v.cl(0, -460, 0, 470); T(v.B, v.P(0, 470)[0] + 1, v.P(0, 470)[1] + 1, '℄ PILE');
    v.leader(0, 352, 14, 10, 'PROPOSED\nSTRINGER'); v.leader(-100, -6, -14, -4, 'CAP PLATE'); v.leader(45, -100, 14, 6, 'STUB COLUMN'); v.leader(55, -200, 14, -2, '75x10FL STIFFENER\nTYP');
    v.weld(-45, -60, -18, -6, { size: '6', both: true }); v.weld(55, -320, 18, -10, { size: '6', all: true, tail: 'TYP' });
  }
  // groups built about their own origin, with title
  function grp(fn, title, scale, tag) { const B = new Builder(); fn(B); const bb = bbox(B.E); if (title) vtitle(B, (bb.x0 + bb.x1) / 2 - 6, bb.y0 - 8, title, scale, tag); return B.E; }
  // sheet composition: top row = detail column + extra groups; second row = sections + elevation (note boxes under the sections)
  function compose(p, cfg) {
    const s = pfcOf(p), D = num(p.D, 350, 250, 500), ps = num(p.ps, 1700, 1200, 2600), out = []; s.name = p.pfc;
    const g1 = put(out, cfg.det(s, D), 60, 0); let x = g1.x1 + 14, ylow = g1.y0;
    (cfg.top || []).forEach(fn => { const E = fn(s, D); const b = put(out, E, x, 0); x = b.x1 + 14; ylow = min(ylow, b.y0); });
    const y2 = ylow - 12; x = 0; let yl = 0;
    (cfg.secs || []).forEach(fn => { const b = put(out, fn(s, D), x, y2); x = b.x1 + 10; yl = min(yl, b.y0); });
    const nb = new Builder(); boxT(nb, 0, 0, cfg.vary || NOTE_VARY(p.pfc), { dashed: true }); const bn = put(out, nb.E, 6, yl - 6);
    const B = new Builder(), ve = B.view(20, 0, 0), r = elev(ve, s, D, ps, Object.assign({ name: p.pfc }, cfg.el || {}));
    elevLabels(ve, s, D, r, Object.assign({ name: p.pfc }, cfg.lb || {})); if (cfg.marks) cfg.marks(ve, r);
    if (cfg.bands !== false) { const bl = bbox(B.E); boxT(B, ve.P(r.XL, 0)[0] + 25, bl.y1 + 16, NOTE_BANDS(cfg.bands)); }
    if (cfg.elx) cfg.elx(B, ve, r);
    elevFinish(B, ve, r, cfg.prop || NOTE_PROP, cfg.title || 'ABUTMENT FULLCAP STRENGTHENING DETAIL', cfg.subs || 'ABUTMENT N° X - PILE N° X\nABUTMENT N° X - PILE N° X');
    put(out, B.E, x + 4, y2 + 6);
    return out;
  }
  const secG = (o, letter) => (s, D) => grp(B => secTimber(B.view(20, 0, 0), s, D, o), 'SECTION ' + (letter || 'A'), 20);

  // ------------------------------------------------------------------ PN30-2317A  abutment fullcap strengthening, timber pile cleats
  def('pn2317a', 'Abutments', 'Abutment fullcap strengthening – timber pile cleats', 'PN30-2317A', PRM(), (p) => compose(p, {
    det: () => detCol('cleat'), secs: [secG({ cleat: 'UA' })],
    el: { cleat: true }, lb: { coach: true }, marks: (v, r) => { cutMark(v, -290, r.yD + 40, 'A', 0, 8); cutTick(v, -290, r.yB - 200, 14, 1); }
  }), 'Abutment fullcap strengthening with a PFC under the existing timber fullcap, fixed to each timber pile with 150x100x10UA cleats, only where there is no significant permanent bowing or crushing of the fullcap.');

  // ------------------------------------------------------------------ PN30-2317B / 2317C  with stringer/fullcap angle cleats
  function sclSheet(p, pileCleat) {
    const ch = pileCleat ? 'C' : 'D';
    return compose(p, {
      det: () => detCol(pileCleat ? 'cleat' : 'plain'),
      top: [() => grp(B => viewSlot(B.view(10, 0, 0)), 'VIEW ' + ch, 10)].concat(pileCleat ? [] : [(s, D) => grp(B => secURod(B.view(20, 0, 0), s, D, { name: p.pfc }), 'SECTION C', 20)], [() => { const B = new Builder(); cleatDetails(B, 0, 0, ch); return B.E; }]),
      secs: [secG(pileCleat ? { cleat: 'EA' } : { urod: true }), (s) => grp(B => secStringer(B.view(20, 0, 0), s, { ea: false }), 'SECTION B', 20)],
      el: { scl: true, cleat: pileCleat, urod: !pileCleat, rods: [-910, 875] }, lb: { scl: true, coach: pileCleat, recess: pileCleat ? '' : 'short' },
      marks: (v, r) => { cutMark(v, r.sx[0] + 230, r.yD + 40, 'A', 0, 8); cutTick(v, r.sx[0] + 230, r.yB - 150, 14, 1); cutMark(v, r.sx[2] - 300, r.yS - 60, 'B', 0, 6); cutTick(v, r.sx[2] - 300, r.yB - 620, 14, 1);
        if (!pileCleat) endMark(v, r, 'C');
        const k = r.sx[0]; dimV(v, k + r.R + 70, r.fD, r.fD + 75, '75', 'NOM TYP', { ext1: k + r.R - 20, ext2: k + r.R - 20 }); dimH(v, k - 75, k + 75, r.yB - 110, r.yc - 55, r.yc - 55, '150', 'r', { out: true });
      }
    });
  }
  def('pn2317b', 'Abutments', 'Abutment fullcap strengthening – stringer/fullcap angle cleats, U-rods', 'PN30-2317B', PRM(), p => sclSheet(p, false),
    'Abutment fullcap strengthening with a PFC fixed to the piles with \'U\' threaded rods and to each stringer with a pair of 125x75x10UA stringer/fullcap angle cleats, where there is no significant permanent bowing or crushing of the fullcap.');
  def('pn2317c', 'Abutments', 'Abutment fullcap strengthening – stringer/fullcap angle cleats, pile cleats', 'PN30-2317C', PRM(), p => sclSheet(p, true),
    'As PN30-2317B but with the PFC fixed to each timber pile with 150x100x10 angle cleats and a coach screw instead of \'U\' rods.');



  // ------------------------------------------------------------------ PN30-2318 / 2320  steel abutment piles
  const NOTE_STEEL = (p) => ['FOR PILE RESTRAINTS', 'REFER TO RELEVANT DETAILS.', '', 'PROPOSED FULLCAP & PILE', 'SIZE WILL VARY ACCORDING TO', 'ENGINEERING REQUIREMENTS.', secName(p.pfc) + ' FULLCAP DRAWN', secName(p.uc || '200UC52') + ' PILE DRAWN', '', 'THESE DETAILS ARE RELEVANT', 'FOR NON DRIVEN PILES.'];
  const NOTE_INSTALL = ['NOTE: INSTALL FULLCAP STRENGTHENING', 'BY JACKING AGAINST TIMBER FULLCAP TO', 'REMOVE ALL BOWS, DEFLECTIONS AND', 'PROVIDE CONTINUOUS SUPPORT TO THE', 'EXISTING TIMBER FULLCAP.'];
  const PRS = () => [P('pfc', 'PFC fullcap strengthening', '300PFC', { opts: ['300PFC', '380PFC'] }), P('uc', 'Steel pile', '200UC52', { opts: ['150UC30', '200UC46', '200UC52', '200UC60', '250UC73'] }), P('ps', 'Pile spacing (mm)', 1700, { num: 1 })];
  function steelSheet(p, rhs) {
    const uc = SEC[p.uc] ? p.uc : '200UC52';
    return compose(p, {
      det: () => grp(B => detSteel(B.view(10, 0, 0), uc), 'DETAIL 1', 10),
      top: (rhs ? [weldG('300PFC'), weldG('380PFC')] : []).concat([() => { const B = new Builder(); boxT(B, 0, 0, NOTE_STEEL(Object.assign({}, p, { uc })), { dashed: true }); return B.E; }]),
      secs: [(s) => grp(B => secSteel(B.view(20, 0, 0), s, { uc, rhs }), 'SECTION A', 20)],
      el: { steel: true, uc, rhs }, lb: { steel: true, uc, rhs, jarrah: rhs }, bands: false, prop: rhs ? NOTE_PROP : NOTE_INSTALL,
      marks: (v, r) => { cutMark(v, -330, r.yD + 40, 'A', 0, 8); cutTick(v, -330, r.yB - 500, 14, 1); if (rhs) { const x = (r.rods[1] + r.rods[2]) / 2; v.leader(x, -25, 4, v.P(0, r.yB - 600)[1] - v.P(0, -25)[1], '175 WIDE x 75 THICK\nF11 SEASONED JARRAH\nTIMBER PACKER (TYP)'); } },
      title: 'STEEL ABUTMENT PILES/ABUTMENT\nFULLCAP STRENGTHENING DETAIL'
    });
  }
  def('pn2318', 'Abutments', 'Steel abutment piles – fullcap strengthening (250 UC 90 bearing)', 'PN30-2318', PRS(), p => steelSheet(p, false),
    'Abutment fullcap strengthening on proposed (non-driven) steel piles: PFC bearing on 250 UC 90 x 200 long brackets welded to the piles, steel packers between pile and PFC.');
  def('pn2320', 'Abutments', 'Steel abutment piles – fullcap strengthening with RHS packer', 'PN30-2320', PRS(), p => steelSheet(p, true),
    'As PN30-2318 with 100x50x5.0 RHS steel packers welded to the PFC and F11 seasoned jarrah timber packers between the PFC and the existing timber fullcap.');

  // ------------------------------------------------------------------ PN30-2319 / 2319A  with RHS steel packer
  const SUBS_TO = 'ABUTMENT N° X - PILE N° X TO PILE N° X\nABUTMENT N° X - PILE N° X TO PILE N° X';
  def('pn2319', 'Abutments', 'Abutment fullcap strengthening – RHS packer, U-rods', 'PN30-2319', PRM(), p => compose(p, {
    det: () => detCol('plain', { rhs: true }), top: [(s, D) => grp(B => secURod(B.view(20, 0, 0), s, D, { name: p.pfc }), 'SECTION B', 20)],
    secs: [secG({ rhs: true, sheet: true })], el: { rhs: true, urod: true }, lb: { rhs: true }, subs: SUBS_TO,
    marks: (v, r, s) => { cutMark(v, -290, r.yD + 40, 'A', 0, 8); cutTick(v, -290, r.yB - 200, 14, 1); endMark(v, r, 'B'); dimH(v, r.D / 2 - 25, r.D / 2, r.yB - 70, r.yB - 5, r.yB - 5, '25 NOTCH', 'r', { out: true, sub: 'TYP' }); }
  }), 'Abutment fullcap strengthening with a PFC and 100x50x5.0 RHS steel packers under the existing fullcap, fixed to the timber piles with \'U\' threaded rods.');
  def('pn2319a', 'Abutments', 'Abutment fullcap strengthening – RHS packer, timber pile cleats', 'PN30-2319A', PRM(), p => compose(p, {
    det: () => detCol('cleat', { rhs: true, half: true }), secs: [secG({ rhs: true, cleat: 'UA', sheet: true })], el: { rhs: true, cleat: true }, lb: { rhs: true, coach: true }, bands: 'HALFCAP', subs: SUBS_TO,
    marks: (v, r) => { cutMark(v, -290, r.yD + 40, 'A', 0, 8); cutTick(v, -290, r.yB - 200, 14, 1); }
  }), 'Abutment fullcap strengthening with a PFC and 100x50x5.0 RHS steel packers, fixed to each timber pile with 150x100x10UA cleats and a coach screw.');

  // ------------------------------------------------------------------ PN30-2321 / 2321A  strengthening & widening (stub column)
  function widenSheet(p, cleat) {
    const capG = () => { const B = new Builder(); detCap(B.view(10, 0, 0)); const bb = bbox(B.E); vtitle(B, (bb.x0 + bb.x1) / 2 - 6, bb.y0 - 8, 'DETAIL 1', 10); boxT(B, bb.x1 - 20, bb.y0 - 2, ['NOTE FOR STRINGER DETAILS', 'REFER TO SUPERSTRUCTURE', 'SECTION, DRG N° PN30-3119'], { dashed: true }); return B.E; };
    return compose(p, {
      det: () => detCol(cleat ? 'cleat' : 'ea', { n: '2' }),
      top: (cleat ? [] : [(s, D) => grp(B => secBracket(B.view(20, 0, 0), s, D), 'SECTION C', 20)]).concat([capG, () => grp(B => viewA(B.view(10, 0, 0)), 'VIEW A', 10)]),
      secs: [secG(cleat ? { cleat: 'UA', sheet: true, typ: true, tag: '2' } : { ea: true, sheet: true, typ: true, tag: '2' }, 'B')],
      el: { widen: true, ea: !cleat, cleat }, lb: { widen: true, coach: cleat }, bands: 'HALFCAP',
      title: 'ABUTMENT FULLCAP STRENGTHENING & WIDENING DETAIL', subs: 'ABUTMENT N° X\nABUTMENT N° X',
      marks: (v, r) => {
        const xc = r.xcol, Q = (x, y) => v.P(x, y), ub = SEC['360UB45'];
        cutMark(v, r.sx[0] - 50, r.yD + 40, 'B', 0, 8); cutTick(v, r.sx[0] + 300, r.yB - 520, 14, 1);
        const a = Q(xc - 330, r.yc); v.B.E.push({ t: 'circle', c: a, r: 3, L: 'S-TEXT' }); T(v.B, a[0], a[1], 'A', 3, 'c', 'm'); v.B.E.push({ t: 'solid', p: [[a[0] + 5.2, a[1]], [a[0] + 1.2, a[1] + 2.2], [a[0] + 1.2, a[1] - 2.2]], L: 'S-TEXT' });
        lab(v, xc - 150, (r.yT + r.fD) / 2, Q(xc - 150, 0)[0] - 8, Q(0, r.fD)[1] + 2, '300 PFC STUB\nCOLUMN (LENGTH\nTO SUIT)');
        lab(v, xc - 60, r.fD + ub.d - 10, Q(xc - 60, 0)[0] - 8, Q(0, r.fD + ub.d)[1] + 10, 'PROPOSED\nSTRINGER');
        lab(v, xc - 145, r.yc - 60, Q(xc - 150, 0)[0] - 12, Q(0, r.yB)[1] - 4, 'STIFFENER\nPLATE\nTYP');
        dimH(v, r.XW, xc - 150, r.yB - 70, r.yB, r.yB, '100', 'r', { out: true }); dimH(v, xc, xc + 90, r.fD + ub.d + 60, r.fD + ub.d, r.fD + ub.d, '90', 'r', { out: true });
        v.weld(xc + 150, r.yT, 14, 8, { size: '6', both: true, tail: 'TYP' });
        lab(v, -r.D / 2 - 80, r.yc - 80, Q(-r.D / 2 - 80, 0)[0] - 6, Q(0, r.yB)[1] - 14, '75x10FL STIFFENER\n(TO LAST PILE NEAREST\nTO WIDENING ONLY)'); v.weld(-r.D / 2 - 85, r.yB + 30, -14, -6, { size: '6', all: true, site: true });
        dimV(v, r.XR + 120, r.yT - 85, r.yT, '85', '(TYP)', { ext1: r.XR - 60, ext2: r.XR - 60 }); dimV(v, r.XR + 120, r.yB + 10, r.yB + 90, '80', '(TYP)', { ext1: r.XR - 60, ext2: r.XR - 60 });
      }
    });
  }
  def('pn2321', 'Abutments', 'Abutment fullcap strengthening & widening – stub column, U-rods', 'PN30-2321', PRM(), p => widenSheet(p, false),
    'Abutment fullcap strengthening (PFC fixed to the timber piles with φ20 rods, curved washers and 75x75x6 EA brackets) extended past the last pile as a 300 PFC stub column carrying a proposed widening stringer.');
  def('pn2321a', 'Abutments', 'Abutment fullcap strengthening & widening – stub column, pile cleats', 'PN30-2321A', PRM(), p => widenSheet(p, true),
    'As PN30-2321 with the PFC fixed to each timber pile with 150x100x10UA cleats and a coach screw.');

})(typeof window !== 'undefined' ? window : globalThis);
