/* StructCap Timber — repair details: PN30-2322 … 2329 (fullcap strengthening and replacement, cap-to-pile bearing details).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ local helpers
  const sec = (k, d) => SEC[k] || SEC[d];
  // channel in section drawn solid (heavy, as on the sheets): web back at x, bottom at yb, toes towards dir
  function chanFill(v, x, yb, s, dir, L) {
    const k = dir || 1, X = t => x + k * t;
    v.fill([[X(0), yb], [X(s.tw), yb], [X(s.tw), yb + s.d], [X(0), yb + s.d]], L); v.fill([[X(0), yb], [X(s.b), yb], [X(s.b), yb + s.tf], [X(0), yb + s.tf]], L);
    v.fill([[X(0), yb + s.d - s.tf], [X(s.b), yb + s.d - s.tf], [X(s.b), yb + s.d], [X(0), yb + s.d]], L); cSec(v, x, yb + s.d / 2, s, k, L);
  }
  // channel lying with web horizontal, solid: web at y = yw, toes towards dir (+y / -y), centred on cx
  function chanFillH(v, cx, yw, s, dir) { const k = dir || 1, Y = t => yw + k * t, x0 = cx - s.d / 2, x1 = cx + s.d / 2; v.fill([[x0, Y(0)], [x1, Y(0)], [x1, Y(s.tw)], [x0, Y(s.tw)]]); v.fill([[x0, Y(0)], [x0 + s.tf, Y(0)], [x0 + s.tf, Y(s.b)], [x0, Y(s.b)]]); v.fill([[x1 - s.tf, Y(0)], [x1, Y(0)], [x1, Y(s.b)], [x1 - s.tf, Y(s.b)]]); cSecH(v, cx, yw, s, k); }
  // paper text at a model point
  const tx = (v, x, y, s, h, al, L) => v.text(x, y, s, h || TH, al || 'c', 'b', L || 'S-TEXT');
  // underlined (centred) text at a model point
  function utx(v, x, y, s, h, L) { h = h || TH; const p = v.P(x, y), w = s.length * h * 0.7; v.add({ t: 'text', p, s, h, al: 'c', v: 'b', ang: 0, L: L || 'S-TEXT' }); v.add({ t: 'line', a: [p[0] - w / 2, p[1] - 1], b: [p[0] + w / 2, p[1] - 1], L: L || 'S-TEXT' }); }
  // label written above and below a horizontal leader that ends with an arrow at model point (x,y); text centred at paper offset -dx
  function lineLbl(v, x, y, top, bot, dx) { const p = v.P(x, y), k = dx < 0 ? -1 : 1, x0 = p[0] - dx, w = max(top.length, (bot || '').length) * TH * 0.7 + 3; v.add({ t: 'line', a: [x0 - k * w / 2, p[1]], b: p, L: 'S-TEXT' }); v.add({ t: 'solid', p: [p, [p[0] - k * 2.4, p[1] + 0.8], [p[0] - k * 2.4, p[1] - 0.8]], L: 'S-TEXT' }); v.add({ t: 'text', p: [x0 - k * 0, p[1] + 1], s: top, h: TH, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); if (bot) v.add({ t: 'text', p: [x0, p[1] - 1], s: bot, h: TH, al: 'c', v: 't', ang: 0, L: 'S-TEXT' }); }
  // section cut on an elevation: heavy bar + solid arrow on the left, bar + lettered marker (pointer down) on the right
  function cutMk(v, xl, xr, y, ch) { const a = v.P(xl, y), b = v.P(xr, y); v.add({ t: 'line', a: [a[0] - 9, a[1]], b: a, L: 'S-TITLE' }); v.add({ t: 'solid', p: [[a[0] - 8, a[1]], [a[0] - 1, a[1]], [a[0] - 4.5, a[1] - 1.8]], L: 'S-TEXT' }); v.add({ t: 'solid', p: [[a[0] - 8, a[1] - 0.25], [a[0] - 1, a[1] - 0.25], [a[0] - 1, a[1] + 0.25], [a[0] - 8, a[1] + 0.25]], L: 'S-TEXT' }); v.add({ t: 'line', a: b, b: [b[0] + 6, b[1]], L: 'S-TITLE' }); const q = [b[0] + 9, b[1]]; v.add({ t: 'circle', c: q, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p: q, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); v.add({ t: 'solid', p: [[q[0], q[1] - 5.2], [q[0] - 2.2, q[1] - 2.1], [q[0] + 2.2, q[1] - 2.1]], L: 'S-TEXT' }); }
  // view marker: lettered circle with pointer, on a stalk (elevation key "B" / "A")
  function stalkMk(v, x, y, ch, dir, len) { const p = v.P(x, y); v.add({ t: 'line', a: p, b: [p[0], p[1] + (len || 6)], L: 'S-TITLE' }); const q = [p[0], p[1] + (len || 6) + 3]; v.add({ t: 'circle', c: q, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p: q, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); const a = (dir == null ? 0 : dir) * PI / 180; v.add({ t: 'solid', p: [[q[0] + 5.2 * Math.cos(a), q[1] + 5.2 * Math.sin(a)], [q[0] + 2.4 * Math.cos(a + 1.1), q[1] + 2.4 * Math.sin(a + 1.1)], [q[0] + 2.4 * Math.cos(a - 1.1), q[1] + 2.4 * Math.sin(a - 1.1)]], L: 'S-TEXT' }); }
  // hex nut seen on its face (with washer circle and centre lines)
  function hexNut(v, x, y, d) { d = d || 20; const r = d * 0.95, pts = []; for (let i = 0; i < 6; i++) { const a = PI / 6 + i * PI / 3; pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); } v.pl(pts, true, 'S-BOLT'); v.circ(x, y, d * 0.55, 'S-BOLT'); v.circ(x, y, d * 1.25, 'S-BOLT'); v.line(x - d * 1.7, y, x + d * 1.7, y, 'S-CL'); v.line(x, y - d * 1.7, x, y + d * 1.7, 'S-CL'); }
  // detail call-out: thin circle round an area + leader to a numbered circle
  function callout(v, x, y, r, ch, dx, dy) { v.circ(x, y, r, 'S-TEXT'); const p = v.P(x, y), rr = r / v.s, a = Math.atan2(dy, dx), e = [p[0] + rr * Math.cos(a), p[1] + rr * Math.sin(a)], q = [e[0] + dx, e[1] + dy]; v.add({ t: 'line', a: e, b: [q[0] - 3 * Math.cos(a), q[1] - 3 * Math.sin(a)], L: 'S-TEXT' }); v.add({ t: 'circle', c: q, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p: q, s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
  // boxed value (designer's choice) at a model point: '55' in a small dashed box
  function boxVal(v, x, y, s) { const p = v.P(x, y), w = s.length * TH * 0.66 + 1.4; v.add({ t: 'pl', p: [[p[0] - w / 2, p[1] - 0.8], [p[0] + w / 2, p[1] - 0.8], [p[0] + w / 2, p[1] + TH + 0.8], [p[0] - w / 2, p[1] + TH + 0.8]], closed: true, L: 'S-NOTE' }); v.add({ t: 'text', p, s, h: TH, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); }
  // pile band (strap with slot one end, bolt the other) across x0..x1 at y (top), 40 wide
  function band(v, x0, x1, y, side) { v.rect(x0, y - 40, x1 - x0, 40, 'S-NEW'); const xs = side === 'r' ? x1 - 110 : x0 + 15; v.line(xs, y - 14, xs + 90, y - 14, 'S-NEW'); v.line(xs, y - 26, xs + 90, y - 26, 'S-NEW'); v.arc(xs + 90, y - 20, 6, -90, 90, 'S-NEW'); v.arc(xs, y - 20, 6, 90, 270, 'S-NEW'); }
  // zigzag break (vertical) on a member edge at x between y0..y1 (model), paper zig size
  function zz(v, x, y0, y1) { v.brk(x, y0, x, y1, 'S-TEXT'); }
  // note box (dashed designer's note, or solid construction note) wrapping with the renderer's real glyph width; v = View or Builder
  function nbox(v, x, y, s, w, opt) {
    opt = opt || {}; if (!v.P) v = new A.View(v, 1, 0, 0); const p = v.P(x, y), h = opt.h || TH, lines = [];
    String(s).split('\n').forEach(par => { let cur = ''; par.split(' ').forEach(wd => { if ((cur + ' ' + wd).length * h * 0.74 > w - 4 && cur) { lines.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; }); lines.push(cur); });
    const H = lines.length * h * 1.55 + 2.6; v.add({ t: 'pl', p: [[p[0], p[1]], [p[0] + w, p[1]], [p[0] + w, p[1] - H], [p[0], p[1] - H]], closed: true, L: opt.solid ? 'S-TEXT' : 'S-NOTE' });
    lines.forEach((l, i) => { v.add({ t: 'text', p: [p[0] + 2, p[1] - 1.6 - h - i * h * 1.55], s: l, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); if (!i && /^NOTE/.test(l)) { const n = l.indexOf(':') >= 0 ? l.indexOf(':') : 4; v.add({ t: 'line', a: [p[0] + 2, p[1] - 1.6 - h - 0.8], b: [p[0] + 2 + n * h * 0.7, p[1] - 1.6 - h - 0.8], L: 'S-TEXT' }); } });
    return H;
  }

  // the core lays titles out with a 0.64·h glyph estimate; the renderer's glyphs are wider (≈0.72·h). Stretch title underlines and
  // push the lettered circle / drawing ref that follows a title clear of the text.
  function fixT(E) {
    for (let i = 0; i < E.length; i++) { const e = E[i]; if (e.t !== 'text' || e.L !== 'S-TITLE' || e.al !== 'l') continue; const u = E[i + 1]; if (!u || u.t !== 'line' || u.L !== 'S-TITLE' || abs(u.a[1] - (e.p[1] - 1.1)) > 0.2 && abs(u.a[1] - (e.p[1] - 1.2)) > 0.2) continue;
      const w = e.s.length * e.h * 0.72, d = e.p[0] + w - u.b[0]; if (d <= 0) continue; u.b = [u.b[0] + d, u.b[1]];
      for (let j = i + 2; j < min(E.length, i + 4); j++) { const f = E[j]; if ((f.t === 'circle' && f.L === 'S-TITLE') || (f.t === 'text' && f.L === 'S-TITLE' && f.al === 'c' && f.v === 'm') || (f.t === 'text' && f.L === 'S-TEXT' && abs(f.p[1] - e.p[1]) < 0.01)) { if (f.c) f.c = [f.c[0] + d + 1, f.c[1]]; else f.p = [f.p[0] + d + 1, f.p[1]]; } } }
    return E;
  }
  const NOTE_RELOC = 'NOTE: RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED HALFCAP REPAIRS';

  // ================================================================== PN30-2328 / 2329  HALFCAP OR FULLCAP TO PILE BEARING DETAILS
  function bearing(p, small) {
    const s = sec(p.pfc, '380PFC'), s2 = SEC['200PFC'], LY = new Lay(760);
    const T = small ? { a1: '70-90', a2: '55-70', a3: '0-55', mb: 90, seat: '180x20FLx300 LONG', L: 440, A1: 80, A2: 62, Fp: 90 } : { a1: '50-70', a2: '35-50', a3: '0-35', mb: 70, seat: '150x20FLx300 LONG', L: 260, A1: 60, A2: 42, Fp: 70 };
    const pfcN = secName(p.pfc || '380PFC');
    // ---- SECTIONS A / B / C (plan on the bearing, 1:10): cap web (heavy), toe line, pile arc, bearing plate 300 long
    const secV = (type) => {
      const v = LY.view(10), b = s.b, Ar = type === 3 ? 20 : type === 2 ? T.A2 : T.A1, R = 190;
      v.fill([[-5, -250], [5, -250], [5, 250], [-5, 250]]); v.line(-5, -250, -5, 250); v.line(5, -250, 5, 250);
      v.line(b, -250, b, 250, type === 2 ? 'S-HIDDEN' : 'S-NEW'); zz(v, b / 2 + 2, 250, 250); zz(v, b / 2 + 2, -250, -250);
      v.pl(Array.from({ length: 25 }, (_, i) => { const a = -62 + i * 124 / 24; return [Ar - R + R * Math.cos(a * PI / 180), R * Math.sin(a * PI / 180)]; }), false, 'S-EXIST');
      v.line(-200, -170, -200, 170, 'S-EXIST'); zz(v, -200, 0, 0);
      if (type === 3) {
        v.rect(-30, -150, 30, 300, 'S-NEW'); v.line(0, -150, b + 30, -150, 'S-HIDDEN'); v.line(0, 150, b + 30, 150, 'S-HIDDEN'); v.line(b + 30, -150, b + 30, 150, 'S-HIDDEN');
        v.pl([[5, 110], [55, 110], [55, 95], [20, 95], [20, -95], [55, -95], [55, -110], [5, -110]], false, 'S-HIDDEN');
        v.bolt(-170, 0, 5, 0, 20, 'none'); v.line(-260, 0, -170, 0, 'S-BOLT');
        v.dim(b + 80, -150, b + 80, 150, -6, '300');
        v.leader(0, 180, -16, 14, 'HALFCAP/\nFULLCAP'); v.leader(40, 102, 26, 26, '200 PFC\nUNDER'); v.leader(-60, 8, -18, 10, 'THREADED\nROD'); v.leader(-30, -110, -18, 4, 'BEARING\nPLATE'); v.leader(b + 30, -100, 14, -18, 'SEATING\nPLATE');
      } else {
        v.line(-10, -150, -10, 150, 'S-NEW'); v.line(b + 15, -150, b + 15, 150, 'S-NEW'); v.line(-10, -150, b + 40, -150, 'S-HIDDEN'); v.line(-10, 150, b + 40, 150, 'S-HIDDEN');
        if (type === 2) { v.line(5, 0, b - 4, 0, 'S-NEW'); v.line(5, 5, b - 4, 5, 'S-NEW'); v.leader(b - 25, 3, 22, 18, '75x10FL STIFFENER'); }
        v.dim(b + 70, -150, b + 70, 150, -6, '300');
        v.leader(0, 185, -16, 14, 'HALFCAP/\nFULLCAP'); v.leader(b + 15, -150, 16, -12, 'BEARING PLATE');
        v.weld(4, 120, 18, 20, { size: '4', site: true, tail: 'TYP' });
      }
      LY.title('SECTION ' + 'ABC'[type - 1], 10);
    };
    secV(1); secV(2); secV(3);
    LY.block(B => { const h = nbox(B, 0, 0, 'NOTE:\nHALFCAP/FULLCAP CHANNELS WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS (380 PFC HALFCAP/FULLCAP DRAWN).\nIF THE DESIGN IS REQUIRED FOR HLP 400 OR SM1600 THE ENGINEER SHALL DESIGN THE BEARING AREA REQUIRED ACCORDINGLY.' + (small ? '' : '\nFOR SMALLER PILE DIAMETERS ENGINEER TO CHECK BEARING AREAS REQUIRED, ALSO REFER TO PN30-2329.'), 92); nbox(B, 10, -h - 10, NOTE_RELOC, 74, { solid: true }); });
    LY.break();
    // ---- SECTIONAL ELEVATIONS TYPE 1 / 2 / 3 (1:10)
    const elev = (type) => {
      const v = LY.view(10), d = s.d, b = s.b;
      const recessTop = (x0, x1) => { v.line(x0, d + 15, x1, d + 15, 'S-EXIST'); };
      if (type < 3) {
        const Aa = type === 1 ? T.A1 : T.A2, pl = Aa - 270, yb = -440;
        v.line(pl, yb, pl, d + 15, 'S-EXIST'); recessTop(pl, 0); v.line(0, -20, 0, d + 15, 'S-EXIST'); v.line(Aa, -20, Aa, yb, 'S-EXIST'); v.pileEnd((pl + Aa) / 2, yb, Aa - pl, 'S-EXIST'); zz(v, pl, -40, -40);
        chanFill(v, 0, 0, s, 1); v.rect(-5, -20, 130, 20, 'S-NEW');
        if (type === 1) {
          v.pl([[pl + 15, d - 10], [-6, d - 10], [-6, 40], [pl + 60, 20], [pl + 15, 20]], true, 'S-EXIST');
          [d - 55, 75].forEach(y => { v.circ(pl + 50, y, 20, 'S-BOLT'); v.circ(pl + 50, y, 12, 'S-BOLT'); });
          [0.66, 0.34].forEach(f => v.bolt(-60, d * f, s.tw, d * f, 20, 'none')); v.line(pl + 90, d * 0.5, -10, d * 0.5, 'S-HIDDEN'); v.line(pl + 90, d * 0.5 + 8, -10, d * 0.5 + 8, 'S-HIDDEN'); v.nut(s.tw, d * 0.5, 1, 0, 20);
          v.leaders([[-20, d * 0.66], [-40, d * 0.5], [-20, d * 0.34]], -26, 6, '2 - M20 BOLTS &\nCOACH SCREW OR\nTHREADED ROD');
        } else {
          v.rect(s.tw, s.tf, b - s.tw - 8, d - 2 * s.tf, 'S-NEW'); v.line(pl + 60, d * 0.5, 0, d * 0.5, 'S-HIDDEN'); v.line(pl + 60, d * 0.5 + 8, 0, d * 0.5 + 8, 'S-HIDDEN'); v.bolt(-60, d * 0.5, s.tw, d * 0.5, 20, 'none');
          v.leader(-80, d * 0.5 + 4, -26, 12, 'THREADED ROD\nOR 2 - M20 BOLTS\n& COACH SCREW'); v.leader(b - 20, d * 0.62, 18, 2, '75x10FL STIFFENER', { dot: true }); v.weld(s.tw + 4, d * 0.3, 30, 10, { size: '6', both: true, all: true });
        }
        band(v, pl, Aa + 10, -120);
        if (type === 1) { v.line(125, -20, Aa + 170, -20, 'S-DIM'); v.line(Aa + 15, -120, Aa + 170, -120, 'S-DIM'); v.dim(Aa + 160, -20, Aa + 160, -120, 0, '100', { sub: 'TYP' }); }
        v.line(0, -25, 0, -360, 'S-DIM'); v.dim(0, -250, Aa, -250, 0, "'A'"); v.dim(Aa - T.mb, -340, Aa, -340, 0, T.mb + ' MINIMUM', { sub: 'BEARING REQUIRED' }); v.line(Aa - T.mb, -330, Aa - T.mb, -360, 'S-DIM');
        v.line(0, d, 0, d + 90, 'S-DIM'); lineLbl(v, 0, d + 70, 'FACE OF PILE', 'RECESS', 14);
        v.leader(b * 0.7, d, 12, 14, pfcN + '\nHALFCAP/FULLCAP');
        v.leader(-5, -12, -30, -8, '130x20FLx300 LONG\nBEARING PLATE'); v.leader(pl + 40, -150, -24, -10, type === 1 ? 'PILE BAND REFER TO\nDRG N° 9530-0072\nFOR DETAILS (TYP)' : 'PILE BAND'); v.leader(pl + 60, -330, -22, -6, 'EXISTING TIMBER\nPILE', { dot: true });
        v.weld(type === 1 ? b * 0.8 : 125, type === 1 ? 2 : -10, 22, type === 1 ? 38 : -20, { size: '4', site: true });
        cutMk(v, pl - 30, b + 60, s.tf + 25, type === 1 ? 'A' : 'B');
        const yt = yb - 150; utx(v, (pl + Aa) / 2, yt, 'SECTIONAL ELEVATION', 2.2); utx(v, (pl + Aa) / 2, yt - 75, 'TYPE ' + type, 3.4);
        tx(v, (pl + Aa) / 2, yt - 135, "( TO BE USED WHERE DIMENSION 'A' (FACE OF PILE )"); tx(v, (pl + Aa) / 2, yt - 170, 'TO WEB OF CHANNEL) IS BETWEEN ' + (type === 1 ? T.a1 : T.a2) + 'mm.');
      } else {
        // TYPE 3: pile recessed, 200 PFC under the cap channel between seating plate (top) and bearing plate (bottom)
        const Fp = T.Fp, Aw = 20, xw = Fp + Aw, pl = -200, L = T.L, ys = -20, yb = ys - L - 20, ylow = yb - 380;
        v.line(pl, ylow, pl, d + 15, 'S-EXIST'); recessTop(pl, xw); v.line(Fp, yb, Fp, ylow, 'S-EXIST'); v.line(0, ys, 0, yb, 'S-EXIST'); v.pileEnd((pl + Fp) / 2, ylow, Fp - pl, 'S-EXIST'); zz(v, pl, ys - 60, ys - 60);
        chanFill(v, xw, 0, s, 1); v.rect(0, ys, small ? 180 : 150, 20, 'S-NEW'); v.rect(-10, yb, 130, 20, 'S-NEW');
        // 200 PFC seen on its flange edge: web back against the recessed pile face
        v.rect(0, yb + 20, s2.b, L, 'S-NEW'); v.line(s2.tw, yb + 20, s2.tw, ys, 'S-HIDDEN');
        if (small) { v.pl([[s2.b, ys], [170, ys], [125, yb + 20], [s2.b, yb + 20]], true, 'S-NEW'); v.leader(150, (ys + yb) / 2 - 40, 18, -14, 'STIFFENER 12PL'); v.weld(s2.b, (ys + yb) / 2, 24, 0, { all: true, tail: 'TYP' }); }
        [ys - 50, yb + 70].forEach(y => { v.bolt(-70, y, s2.tw, y, 20, 'none'); v.line(pl + 40, y + 6, -70, y + 6, 'S-HIDDEN'); v.line(pl + 40, y - 6, -70, y - 6, 'S-HIDDEN'); });
        v.line(-90, d * 0.45, xw + s.tw, d * 0.45, 'S-HIDDEN'); v.bolt(xw - 60, d * 0.45, xw + s.tw, d * 0.45, 20, 'none'); v.line(pl + 40, d * 0.45 + 7, xw - 70, d * 0.45 + 7, 'S-HIDDEN');
        band(v, pl, Fp + 20, yb - 70);
        v.line(Fp, yb, Fp, yb - 20, 'S-DIM'); v.dim(0, yb - 110, Fp, yb - 110, 0, String(Fp));
        v.line(Fp, d, Fp, d + 120, 'S-DIM'); v.line(xw, d, xw, d + 70, 'S-DIM'); v.dim(Fp, d + 55, xw, d + 55, 0, "'A'"); lineLbl(v, Fp, d + 120, 'LINE OF FACE', 'OF PILE', 18);
        v.dim(0, s.tf + 30, xw, s.tf + 30, 0, T.a3); v.dim(xw, s.tf + 30, xw + 35, s.tf + 30, 0, '35'); v.line(0, ys, 0, s.tf + 45, 'S-DIM');
        v.leader(xw + b * 0.7, d, 12, 14, pfcN + '\nHALFCAP/FULLCAP'); v.leader(xw, d * 0.72, -46, 22, 'FACE OF PILE\nRECESS', { noArrow: false });
        v.leader(-90, d * 0.45 + 4, -22, 14, 'THREADED ROD\nOR 2 - M20 BOLTS\n& COACH SCREW'); v.leader(pl + 70, ys - 90, -18, 8, 'EXISTING TIMBER\nPILE', { dot: true });
        v.leader(small ? 175 : 140, ys + 6, 14, -10, (small ? '180' : '150') + 'x20FLx300 LONG\nSEATING PLATE'); if (!small) v.leader(s2.b, (ys + yb) / 2 - 30, 14, -8, '200 PFC'); else v.leader(10, (ys + yb) / 2 - 60, -18, -4, '200 PFC');
        v.leader(110, yb, 14, -10, '130x20FLx300 LONG\nBEARING PLATE'); v.leader(pl + 30, yb - 110, -18, -10, 'PILE BAND');
        v.weld(xw + b * 0.8, 2, 20, 36, { size: '4', site: true });
        cutMk(v, pl - 30, xw + b + 70, s.tf + 60, 'C'); stalkMk(v, xw + b + 40, d * 0.55, 'D', 180, 0.01);
        const yt = ylow - 150; utx(v, (pl + Fp) / 2, yt, 'SECTIONAL ELEVATION', 2.2); utx(v, (pl + Fp) / 2, yt - 75, 'TYPE 3', 3.4);
        tx(v, (pl + Fp) / 2, yt - 135, "( TO BE USED WHERE DIMENSION 'A' (FACE OF PILE )"); tx(v, (pl + Fp) / 2, yt - 170, 'TO WEB OF CHANNEL) IS BETWEEN ' + T.a3 + 'mm.');
      }
    };
    elev(1); elev(2); elev(3);
    // ---- VIEW D (1:10): looking on the toes of the cap channel at the Type 3 seat
    { const w = LY.view(10), d = s.d, L = T.L, ys = 0, yb = -L - 20, rp = 170;
      pfcElevH(w, -330, 330, d, s); zz(w, -330, d / 2, d / 2); zz(w, 330, d / 2, d / 2);
      w.pl([[-115, 0], [-115, d - 30], [115, d - 30], [115, 0]], false, 'S-HIDDEN'); [-115, 115].forEach(x => hexNut(w, x, d * 0.45, 18));
      w.rect(-150, -20, 300, 20, 'S-NEW'); w.rect(-s2.d / 2, yb + 20, s2.d, L - 20 + 0, 'S-NEW'); w.line(-s2.d / 2 + s2.tf, yb + 20, -s2.d / 2 + s2.tf, -20, 'S-NEW'); w.line(s2.d / 2 - s2.tf, yb + 20, s2.d / 2 - s2.tf, -20, 'S-NEW');
      w.rect(-150, yb, 300, 20, 'S-NEW'); [-20 - 50, yb + 20 + 50].forEach(y => hexNut(w, 0, y, 16));
      [-rp, rp].forEach(x => w.line(x, yb - 360, x, d - 30, 'S-EXIST')); band(w, -rp - 20, rp + 20, yb - 70, 'l'); hexNut(w, rp - 5, yb - 90, 10); w.pileEnd(0, yb - 360, 2 * rp, 'S-EXIST');
      w.line(-s2.d / 2, -20, -300, -20, 'S-DIM'); w.line(-s2.d / 2, yb + 20, -300, yb + 20, 'S-DIM'); w.dim(-290, -20, -290, yb + 20, 0, String(L));
      w.line(-20, -70, -230, -70, 'S-DIM'); w.line(-20, yb + 70, -230, yb + 70, 'S-DIM'); w.dim(-220, -20, -220, -70, 0, '50'); w.dim(-220, yb + 70, -220, yb + 20, 0, '50');
      w.dim(-s2.d / 2 + s2.tf, (yb) / 2, 0, yb / 2, 0, '='); w.dim(0, yb / 2, s2.d / 2 - s2.tf, yb / 2, 0, '=');
      w.weld(s2.d / 2, -25, 22, -8, { size: '4', all: true }); w.weld(150, yb + 20, 12, -10, { size: '4', all: true, site: true });
      LY.title('VIEW D', 10); }
    LY.title(small ? 'TIMBER PILE < φ340' : 'TIMBER PILE > OR = φ340', null, null, { h: 3.6 });
    LY.caption('HALFCAP OR FULLCAP TO PILE BEARING DETAILS', 10);
    return fixT(LY.done());
  }
  def('pn2328', 'Halfcaps', 'Halfcap / fullcap to pile bearing details – timber pile ≥ φ340', 'PN30-2328', [P('pfc', 'Cap channel', '380PFC', { opts: ['300PFC', '380PFC'] })], p => bearing(p, false),
    "Bearing plate (Type 1), stiffened channel (Type 2) or 200 PFC seat (Type 3) where a PFC halfcap / fullcap has less than 70 mm bearing on a timber pile of φ340 or more, chosen by dimension 'A'.");
  def('pn2329', 'Halfcaps', 'Halfcap / fullcap to pile bearing details – timber pile < φ340', 'PN30-2329', [P('pfc', 'Cap channel', '380PFC', { opts: ['300PFC', '380PFC'] })], p => bearing(p, true),
    "Bearing plate (Type 1), stiffened channel (Type 2) or stiffened 200 PFC seat (Type 3) where a PFC halfcap / fullcap has less than 90 mm bearing on a timber pile under φ340, chosen by dimension 'A'.");
  // leader with its shoulder given in MODEL coordinates (X, Y) — lets labels be stacked in tidy columns
  const lab = (v, x, y, X, Y, s, opt) => v.leader(x, y, (X - x) / v.s, (Y - y) / v.s, s, opt);

  // ================================================================== shared pieces for the abutment fullcap sheets (2322 … 2327)
  const UB = SEC['410UB54'], UC90 = SEC['250UC90'], S300 = SEC['300PFC'];
  const T_PROP = 'NOTE: PROP STRINGERS PRIOR TO INSTALLING FULLCAP STRENGTHENING. INSTALL FULLCAP STRENGTHENING BY JACKING AGAINST TIMBER FULLCAP TO REMOVE ALL BOWS, DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT TO THE EXISTING TIMBER FULLCAP.';
  const T_JACK = 'NOTE: INSTALL FULLCAP STRENGTHENING BY JACKING AGAINST TIMBER FULLCAP AND PACKERS TO REMOVE ALL BOWS, DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT TO THE EXISTING TIMBER FULLCAP.';
  const T_VARY = 'NOTE: FULLCAP STRENGTHENING CHANNELS WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS.\n300 PFC FULLCAP DRAWN. THIS DETAIL IS ONLY TO BE USED WHERE THERE IS NO SIGNIFICANT PERMANENT BOWING OR CRUSHING IN THE UNDERSIDE OF THE EXISTING TIMBER FULLCAP (ENGINEER TO DETERMINE)';
  const T_RESTR = 'FOR PILE RESTRAINTS REFER TO RELEVANT DETAILS.\nPROPOSED FULLCAP & PILE SIZE WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS.\n300 PFC FULLCAP DRAWN\n200 UC 52 PILE DRAWN\nTHESE DETAILS ARE RELEVANT FOR NON DRIVEN PILES.';
  const T_STR = 'NOTE FOR STRINGER DETAILS REFER TO SUPERSTRUCTURE SECTION, DRG N° PN30-3119';
  const T_MORE2 = 'NOTE: IF FULLCAP CHANNEL IS SUPPORTED BY MORE THAN 2 PILES THEN DRG REQUIRES BOXED NOTE & PILE BEARING DETAILS PN30-2328 &/OR 2329';
  const T_ENG = 'ENGINEER TO DETERMINE IF 70 MINIMUM BEARING GIVES SUFFICIENT BEARING AREA FOR PILE DIAMETERS AND LOADINGS';
  const T_IFB = 'IF BEARING IS <70 THEN REFER TO "HALFCAP OR FULLCAP TO PILE BEARING DETAILS" ON DRG N° XX30-XXX';
  const T_RELF = 'NOTE: RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED FULLCAP REPAIRS';
  const T_DRG = 'DRG NUMBER - REFER TO PLAN DRAWING';
  const T_SHIM = (s) => (s.d >= 380 ? '130x(6,8,10 OR 12FL)x300 LONG GALV STEEL SHIM IF REQUIRED. TACK WELD STEEL SHIMS TOGETHER AFTER PLACEMENT. MAKE GOOD GALV. SURFACE BY APPLYING COLD GALV' : '130x(6,8,10 OR 12FL)x300 LONG GALV STEEL SHIM IF REQUIRED. TACK WELD STEEL SHIMS TOGETHER AFTER PLACEMENT. MAKE GOOD GALV. SURFACE BY APPLYING COLD GALV');
  const wrap = (s, n) => { const out = []; String(s).split('\n').forEach(par => { let cur = ''; par.split(' ').forEach(w => { if ((cur + ' ' + w).length > n && cur) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); out.push(cur); }); return out.join('\n'); };

  // abutment cross-section background: earth + sheeting (x -75..0), decking (y yd..yd+75) running right to xr, stringer log on the cap, right-hand breaks
  function abutBg(v, ylo, yd, xr, xs0, xs1) {
    v.line(-75, ylo, -75, yd + 75, 'S-EXIST'); v.line(0, ylo, 0, yd, 'S-EXIST'); for (let y = ylo + 120; y < yd - 40; y += 230) v.line(-75, y, 0, y, 'S-EXIST');
    for (let y = ylo + 60; y < yd + 40; y += 260) for (let k = 0; k < 4; k++) v.line(-75, y + k * 30, -110, y + k * 30 - 30, 'S-GROUND');
    v.line(-75, yd + 75, xr, yd + 75, 'S-EXIST'); v.line(0, yd, xr, yd, 'S-EXIST'); for (let x = 120; x < xr - 60; x += 230) v.line(x, yd, x, yd + 75, 'S-EXIST'); zz(v, xr, yd + 37, yd + 37);
    // stringer: underside on the cap, then sloping down beyond it; double-lobe break at the right
    v.pl([[xs0, yd], [xs0, 0], [xs1, 0], [xs1 + 220, -70], [xr - 60, -70]], false, 'S-EXIST'); v.pileEnd(xr - 60, (yd - 70) / 2, yd + 70, 'S-EXIST', 1);
  }
  // curved/plain washer + nut on a vertical rod at (x,y) pointing up (k=1) or down (k=-1)
  const vNut = (v, x, y, k) => v.nut(x, y, 0, k, 20);

  // ---- SECTION B for the strengthening sheets (1:20). o: { steel, rhs, cleat: 'ea' | 'ua', s, D, fd }
  function secStrength(LY, o) {
    const v = LY.view(20), s = o.s, fd = o.fd, gap = s.d >= 380 ? 60 : 55, yd = 420;
    if (o.steel) {
      const xp = 75, xf = xp + 206, ylo = -1500, pk = 10, xw = xf + pk, ptop = -fd - (o.rhs ? 50 : 0), pb = ptop - s.d, xr = xw + gap;
      abutBg(v, ylo + 100, yd, 1150, 0, xf + 250);
      v.rect(0, ylo + 60, 75, -ylo - 60, 'S-NEW'); // timber packer
      v.line(xp, ylo, xp, 0, 'S-NEW'); v.line(xp + 12, ylo, xp + 12, 0, 'S-NEW'); v.line(xf - 12, ylo, xf - 12, 0, 'S-NEW'); v.line(xf, ylo, xf, 0, 'S-NEW'); v.line(xp, 0, xf, 0, 'S-NEW'); zz(v, (xp + xf) / 2, ylo, ylo);
      timberX(v, xf, -fd, 250, fd);
      v.rect(xf, pb + 20, pk, s.d - 40, 'S-NEW'); chanFill(v, xw, pb, s, 1);
      if (o.rhs) rhsSec(v, xw + 50, ptop + 25, 100, 50, 5);
      iElevWebH(v, xf, xf + 200, pb - UC90.d / 2, UC90); [pb - UC90.tf / 2, pb - UC90.d + UC90.tf / 2].forEach(y => v.rect(xp + 12, y - 5, 182, 10, 'S-NEW'));
      v.line(xr, ptop - s.tf - 40, xr, 40, 'S-BOLT'); vNut(v, xr, 0, 1); vNut(v, xr, ptop - s.tf, -1);
      [ptop - s.d * 0.3, ptop - s.d * 0.7].forEach(y => v.bolt(xf - 12, y, xw + s.tw, y, 20));
      v.cl((xp + xf) / 2, ylo - 40, (xp + xf) / 2, yd + 330, 'PILE');
      v.line(xf, 0, xf, yd + 260, 'S-DIM'); v.line(xr, 40, xr, yd + 260, 'S-DIM'); v.dim(xf, yd + 220, xr, yd + 220, 0, '50 MIN', { sub: '(TYP)' });
      v.dim(xw, -fd / 2, xr, -fd / 2, 0, ''); boxVal(v, xr + 90, -fd / 2 + 10, String(gap)); nbox(v, xr + 220, -fd / 2 + 40, '55 - 300 PFC\n60 - 380 PFC', 24);
      callout(v, xf + 30, pb - 120, 220, o.rhs ? '2' : '1', -14, -10);
      lab(v, -75, yd - 120, -300, 300, 'EXISTING TIMBER\nSHEETING'); lab(v, xf + 30, -40, -300, 100, 'EXISTING TIMBER\nFULLCAP', { dot: true }); lab(v, 30, -150, -300, -100, 'TIMBER PACKER', { dot: true });
      lab(v, xf + 3, ptop - s.d * 0.5, -300, -330, 'STEEL PACKERS\n250x(6,8,10 OR 12FL) x\nHEIGHT TO SUIT PFC'); v.leaders([[xp + 60, pb - 5], [xp + 60, pb - UC90.d + 8]], (-300 - xp - 60) / 20, (-620 - pb + 5) / 20, 'PROVIDE 2-10FL WEB\nSTIFFENERS NEAR AND\nFAR FACE IF ACCESS\nPERMITS');
      lab(v, xr, 30, 520, 960, 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE'); lab(v, xw + s.b - 10, ptop - s.d * 0.6, 640, -640, 'PROPOSED PFC FULLCAP\nSTRENGTHENING'); lab(v, xf + 200, pb - UC90.d + 20, 640, -880, '250 UC 90\nx 200 LONG'); lab(v, xf, ylo + 200, 640, ylo + 200, 'PROPOSED PILE');
      if (o.rhs) lab(v, xw + 100, ptop + 25, 640, -400, 'RHS STEEL PACKER');
      LY.title('SECTION B', 20);
      return;
    }
    // timber piles: PFC notched 25 into the front of the pile, RHS packer between the PFC and the timber fullcap
    const D = o.D, xw = D - 25, ptop = -fd - 50, pb = ptop - s.d, xr = xw + gap, ylo = -1250, xf0 = xw - 130;
    abutBg(v, ylo + 200, yd, 1000, 0, xf0 + 250);
    timberX(v, xf0, -fd, 250, fd); v.line(0, -fd, xf0, -fd, 'S-EXIST');
    v.line(0, ylo, 0, -fd, 'S-EXIST'); v.pl([[D, ylo], [D, pb - 10], [xw, pb - 10], [xw, -fd]], false, 'S-EXIST'); v.pileEnd(D / 2, ylo, D, 'S-EXIST');
    band(v, -10, D + 10, pb - 60);
    chanFill(v, xw, pb, s, 1); rhsSec(v, xw + 50, ptop + 25, 100, 50, 5); v.rect(xw - 5, pb - 10, 130, 10, 'S-NEW');
    v.line(xr, ptop - s.tf - 40, xr, 40, 'S-BOLT'); vNut(v, xr, 0, 1); vNut(v, xr, ptop - s.tf, -1);
    const ym = ptop - s.d / 2;
    if (o.cleat === 'ua') { v.rect(xw - 100, ym - 115, 100, 230, 'S-NEW'); [ym + 80, ym - 80].forEach(y => v.boltEnd(xw - 50, y, 20)); v.line(xw, ym, xw - 250, ym, 'S-HIDDEN'); v.pl([[xw - 230, ym + 8], [xw - 250, ym], [xw - 230, ym - 8]], false, 'S-HIDDEN'); }
    else { v.line(30, ym - 10, xw, ym - 10, 'S-HIDDEN'); v.line(30, ym + 10, xw, ym + 10, 'S-HIDDEN'); v.rect(-70, ym - 40, 70, 80, 'S-NEW'); v.boltEnd(-35, ym, 20); }
    v.cl(D / 2, ylo - 40, D / 2, yd + 330, 'PILE');
    v.line(xw, 0, xw, yd + 260, 'S-DIM'); v.line(xr, 40, xr, yd + 260, 'S-DIM'); v.dim(xw, yd + 220, xr, yd + 220, 0, '50 MIN', { sub: '(TYP)' });
    v.dim(xw, -fd / 2, xr, -fd / 2, 0, ''); boxVal(v, xr + 90, -fd / 2 + 10, String(gap)); nbox(v, xr + 220, -fd / 2 + 40, '55 - 300 PFC\n60 - 380 PFC', 24);
    callout(v, xw + 20, ptop - s.d / 2 + 20, 250, '2', 14, -14);
    lab(v, xf0 + 20, -fd + 30, -300, -150, 'EXISTING TIMBER\nFULLCAP (TYP)'); lab(v, -75, -fd - 120, -300, -380, 'EXISTING TIMBER\nSHEETING');
    if (o.cleat === 'ua') { lab(v, xw - 40, pb + 60, -300, -580, 'NOTCH PILE\nTO SUIT'); lab(v, xw - 100, ym - 100, -300, -800, '150x100x10UA\nCLEAT'); }
    else lab(v, -70, ym, -300, -600, 'CURVED WASHER\n(SEE SECTION C)');
    lab(v, 0, ylo + 150, -300, -1050, 'EXISTING TIMBER\nPILE');
    lab(v, xr, 30, 520, 960, 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE'); lab(v, xw + 100, ptop + 40, 640, -330, 'RHS STEEL PACKER'); lab(v, xw + s.b - 10, ptop - s.d * 0.7, 640, -720, 'PROPOSED PFC FULLCAP\nSTRENGTHENING (TYP)');
    cutMk(v, -170, xw + s.b + 200, ym, 'C');
    LY.title('SECTION B', 20);
  }

  // ---- VIEW A (1:10): proposed stringer on the stub column cap plate
  function viewA(LY, cn) {
    const v = LY.view(10), s = S300;
    v.rect(-320, 12, 640, UB.d, 'S-NEW'); v.line(-320, 12 + UB.tf, 320, 12 + UB.tf, 'S-NEW'); v.line(-320, 12 + UB.d - UB.tf, 320, 12 + UB.d - UB.tf, 'S-NEW'); v.line(-5, 12 + UB.tf, -5, 12 + UB.d - UB.tf, 'S-NEW'); v.line(5, 12 + UB.tf, 5, 12 + UB.d - UB.tf, 'S-NEW'); zz(v, -320, 12 + UB.d / 2, 12 + UB.d / 2); zz(v, 320, 12 + UB.d / 2, 12 + UB.d / 2);
    v.rect(-100, 0, 200, 12, 'S-NEW'); [-45, 45].forEach(x => v.bolt(x, -12 - 10, x, 12 + UB.tf + 10, 20));
    pfcElevV(v, 0, -560, 0, s, 1); v.pl([[s.tw, -150], [s.tw + 75, -150], [s.tw + 75, -500], [s.tw + 50, -540], [s.tw, -540]], true, 'S-NEW'); zz(v, s.b / 2, -560, -560);
    v.cl(-60, -620, -60, 12 + UB.d + 150, 'PILE');
    callout(v, 0, 10, 110, cn, 22, 8);
    lab(v, 150, 12 + UB.d, 300, 12 + UB.d + 150, 'PROPOSED\nSTRINGER'); lab(v, -100, 6, -420, -60, 'CAP PLATE'); lab(v, s.b, -80, 300, -80, 'STUB COLUMN'); lab(v, s.tw + 75, -260, 300, -220, '75x10FL STIFFENER\nTYP');
    v.weld(0, -10, -26, -18, { size: '6', both: true }); v.weld(s.tw + 60, -520, 20, -10, { size: '6', all: true, tail: 'TYP' });
    LY.title('VIEW A', 10);
  }
  // ---- cap plate detail (1:10): stringer on the 200x12FLx320 cap plate, 2 M20 bolts
  function capDet(LY, cn) {
    const v = LY.view(10);
    v.line(-330, 12, 330, 12, 'S-NEW'); v.line(-330, 12 + UB.tf, 330, 12 + UB.tf, 'S-NEW'); v.line(-330, 330, 330, 330, 'S-NEW'); v.line(0, 12 + UB.tf, 0, 330, 'S-NEW'); zz(v, -330, 170, 170); zz(v, 330, 170, 170);
    v.rect(-100, 0, 200, 12, 'S-NEW'); [-45, 45].forEach(x => { v.line(x - 10, -25, x - 10, 40, 'S-BOLT'); v.line(x + 10, -25, x + 10, 40, 'S-BOLT'); v.rect(x - 16, 12 + UB.tf, 32, 18, 'S-BOLT'); v.rect(x - 16, -30, 32, 18, 'S-BOLT'); });
    v.line(-5, 0, -5, -300, 'S-NEW'); v.line(5, 0, 5, -300, 'S-HIDDEN'); v.line(85, 0, 85, -300, 'S-NEW'); zz(v, 40, -300, -300);
    v.line(-100, 12, -100, 420, 'S-DIM'); v.line(100, 12, 100, 420, 'S-DIM'); v.dim(-100, 400, 100, 400, 0, '200'); v.line(-45, 40, -45, 360, 'S-DIM'); v.line(45, 40, 45, 360, 'S-DIM'); v.dim(-45, 340, 45, 340, 0, '90');
    v.line(-45, -40, -45, -200, 'S-DIM'); v.dim(-45, -170, 45 + 5, -170, 0, '95');
    v.leader(45, 30, 26, 28, 'M20 BOLTS\n(TYP)'); v.leader(-90, 0, -24, -14, '200x12FLx320 LONG\nCAP PLATE'); v.weld(90, -6, 18, -16, { size: '6', all: true });
    LY.title('DETAIL ' + cn, 10);
  }
  // ---- steel pile / 250 UC 90 seat detail (1:10)
  function seatDet(LY, cn) {
    const v = LY.view(10), u = UC90, s = S300;
    [-206, -194, -12, 0].forEach(x => v.line(x, -420, x, 300, 'S-NEW')); zz(v, -103, 300, 300); zz(v, -103, -420, -420);
    [-u.tf / 2, -u.d + u.tf / 2].forEach(y => v.rect(-194, y - 5, 182, 10, 'S-NEW'));
    iElevWebH(v, 0, 200, -u.d / 2, u);
    v.rect(0, 0, 10, 220, 'S-NEW'); v.hatch([[0, 0], [10, 0], [10, 220], [0, 220]], 'ansi31'); v.fill([[10, 0], [10 + s.b, 0], [10 + s.b, s.tf], [10, s.tf]]); v.fill([[10, 0], [10 + s.tw, 0], [10 + s.tw, 200], [10, 200]]);
    v.weld(-150, -u.tf, -40, -30, { size: '6', both: true, all: true, tail: 'TYP' }); v.weld(0, -u.d / 2, 40, -8, { size: '6', both: true }); v.weld(20, -u.tf, 40, 10, {}); v.weld(10, -u.d, 30, -14, {});
    LY.title('DETAIL ' + cn, 10);
  }
  // ---- ELEVATION (1:20) for the strengthening sheets. o: { steel, rhs, cleat }
  function elevStrength(LY, o) {
    const v = LY.view(20), s = o.s, fd = o.fd, H0 = o.rhs ? 50 : 0, Ht = H0 + fd, Hd = Ht + 330, X1 = 4590, piles = [2385, 4135];
    // widening end: PFC with stub column, cap plate and proposed stringer
    pfcElevH(v, 0, 1100, 0, s); zz(v, 1100, -s.d / 2, -s.d / 2); pfcElevH(v, 1250, X1, 0, s); zz(v, 1250, -s.d / 2, -s.d / 2); zz(v, X1, -s.d / 2, -s.d / 2);
    v.rect(100, 0, 300, 300, 'S-NEW'); v.line(100 + S300.tf, 0, 100 + S300.tf, 300, 'S-NEW'); v.line(400 - S300.tf, 0, 400 - S300.tf, 300, 'S-NEW'); v.rect(90, 300, 320, 12, 'S-NEW'); iSec(v, 250, 312 + UB.d / 2, UB, 0); [205, 295].forEach(x => { v.line(x, 290, x, 312 + UB.tf + 20, 'S-BOLT'); v.fill([[x - 12, 312 + UB.tf], [x + 12, 312 + UB.tf], [x + 12, 312 + UB.tf + 14], [x - 12, 312 + UB.tf + 14]], 'S-BOLT'); });
    [100, 400].forEach(x => v.rect(x - 5, -s.d + s.tf, 10, s.d - 2 * s.tf, 'S-NEW'));
    v.line(0, -s.d - 20, 0, -s.d - 160, 'S-DIM'); v.line(100, -s.d - 20, 100, -s.d - 160, 'S-DIM'); v.dim(0, -s.d - 140, 100, -s.d - 140, 0, '100'); v.dim(205, 312 + UB.d + 60, 295, 312 + UB.d + 60, 0, '90');
    v.mark(-170, -s.d / 2, 'A', 0); v.weld(400, 20, 26, 12, { size: '6', both: true, tail: 'TYP' });
    lab(v, 250, 312 + UB.d, -100, 900, 'PROPOSED\nSTRINGER'); lab(v, 110, 200, -100, 420, '300 PFC STUB\nCOLUMN (LENGTH\nTO SUIT)'); lab(v, 100, -s.d * 0.6, -60, -560, 'STIFFENER\nPLATE\nTYP');
    lab(v, 1600, -s.d, 1300, -560, 'PROPOSED ' + secName(o.pfc) + '\nFULLCAP STRENGTHENING');
    // existing fullcap, stringers, decking
    v.rect(1440, H0, X1 + 60 - 1440, fd, 'S-EXIST'); zz(v, X1 + 60, H0 + fd / 2, H0 + fd / 2);
    v.rect(1550, Hd, 2620, 140, 'S-EXIST'); zz(v, 4170, Hd + 70, Hd + 70);
    const sx = [1760, 2770, 3790], R = 230, yc = (Ht + Hd) / 2;
    sx.forEach(x => { const a = Math.asin((Hd - yc) / R) * 180 / PI; v.arc(x, yc, R, 180 - a, 180 + a, 'S-EXIST'); v.arc(x, yc, R, -a, a, 'S-EXIST'); [-8, 8].forEach(d => v.line(x + d, H0 - 5, x + d, Hd, 'S-HIDDEN')); v.rect(x - 30, Hd - 25, 60, 25, 'S-HIDDEN'); v.rect(x - 30, H0, 60, 25, 'S-NEW'); });
    if (o.rhs) for (let x = 1450; x < X1 - 60; x += 700) v.rect(x, 0, min(660, X1 - 40 - x), 50, 'S-NEW');
    // threaded rods at 900 max
    [1550, 2180, 3000, 3540, 4350].forEach(x => { v.line(x, -s.tf - 30, x, Ht + 20, 'S-BOLT'); v.fill([[x - 14, Ht], [x + 14, Ht], [x + 14, Ht + 14], [x - 14, Ht + 14]], 'S-BOLT'); v.fill([[x - 14, -s.tf - 14], [x + 14, -s.tf - 14], [x + 14, -s.tf], [x - 14, -s.tf]], 'S-BOLT'); });
    v.line(4350, Ht + 20, 4500, Ht + 20, 'S-DIM'); v.line(4380, Ht, 4500, Ht, 'S-DIM'); v.dim(4480, Ht + 20, 4480, Ht, 0, '20', { sub: '(TYP)' });
    // piles
    piles.forEach((pc, i) => {
      if (o.steel) {
        const b = 204; v.rect(pc - b / 2, 0, b, Ht, 'S-NEW'); v.line(pc - 4, 0, pc - 4, Ht, 'S-HIDDEN'); v.line(pc + 4, 0, pc + 4, Ht, 'S-HIDDEN');
        iElevFlange(v, pc, -s.d - 1050, -s.d - UC90.d, SEC['200UC52']); zz(v, pc, -s.d - 1050, -s.d - 1050); iSec(v, pc, -s.d - UC90.d / 2, UC90, 0);
        v.rect(pc - b / 2 - 10, -s.d, b + 20, s.d, 'S-HIDDEN'); v.hatch([[pc - b / 2 - 10, -s.d], [pc + b / 2 + 10, -s.d], [pc + b / 2 + 10, 0], [pc - b / 2 - 10, 0]], 'ansi31');
        v.boltEnd(pc - 70, -75, 20); v.boltEnd(pc + 70, -150, 20);
        if (!i) { v.rect(pc - b / 2 - 25, -s.d + s.tf, 10, s.d - 2 * s.tf, 'S-NEW'); v.line(pc - 70, 0, pc - 70, Ht + 120, 'S-DIM'); v.line(pc + 70, -150, pc + 70, Ht + 120, 'S-DIM'); v.dim(pc - 70, Ht + 90, pc + 70, Ht + 90, 0, '140', { sub: '(TYP)' });
          if (o.rhs) { v.line(pc + 90, -75, pc + 300, -75, 'S-DIM'); v.line(pc + 90, -150, pc + 300, -150, 'S-DIM'); v.dim(pc + 280, -150, pc + 280, -75, 0, '75', { sub: '(TYP)' }); } }
      } else {
        const r = 170; [-r, r].forEach(d => v.line(pc + d, -s.d - 900, pc + d, H0, 'S-EXIST')); v.pileEnd(pc, -s.d - 900, 2 * r, 'S-EXIST'); band(v, pc - r - 5, pc + r + 5, -s.d - 150);
        v.rect(pc - 150, -s.d - 20, 300, 20, 'S-NEW'); v.hatch([[pc - 150, -s.d - 20], [pc + 150, -s.d - 20], [pc + 150, -s.d], [pc - 150, -s.d]], 'ansi31');
        if (o.cleat === 'ua') { [pc - r - 30, pc + r].forEach(x => { v.rect(x, -s.d + 25, 30, s.d - 50, 'S-NEW'); v.boltEnd(x + 15, -70, 16); v.boltEnd(x + 15, -s.d + 70, 16); }); v.boltEnd(pc + 40, -s.d / 2 + 30, 20); }
        else { v.rect(pc - r + 10, -110, 75, 75, 'S-NEW'); v.boltEnd(pc - r + 47, -72, 16); v.rect(pc + r - 85, -130, 75, 75, 'S-NEW'); v.boltEnd(pc + r - 48, -92, 16); }
        if (!i) { v.rect(pc - r - 60, -s.d + s.tf, 10, s.d - 2 * s.tf, 'S-NEW'); if (o.cleat !== 'ua') { v.line(pc + r, -35, X1 + 250, -35, 'S-DIM'); v.line(pc + r, -110, X1 + 250, -110, 'S-DIM'); } }
        if (i) { v.line(pc - 150, -s.d - 30, pc - 150, -s.d - 260, 'S-DIM'); v.line(pc + 150, -s.d - 30, pc + 150, -s.d - 260, 'S-DIM'); v.dim(pc - 150, -s.d - 240, pc + 150, -s.d - 240, 0, '300', { sub: '(TYP)' }); }
      }
    });
    if (!o.steel && o.cleat !== 'ua') { v.line(X1, 0, X1 + 250, 0, 'S-DIM'); v.dim(X1 + 230, 0, X1 + 230, -85, 0, '85', { sub: '(TYP)' }); v.dim(X1 + 230, -110, X1 + 230, -190, 0, '80', { sub: '(TYP)' }); v.line(X1, -190, X1 + 250, -190, 'S-DIM'); }
    // markers & labels
    stalkMk(v, 2050, Hd + 150, 'B', 0, 6); const pm = v.P(piles[0] - 260, -s.d - 300); v.add({ t: 'line', a: [pm[0], pm[1] + 4], b: [pm[0], pm[1] - 6], L: 'S-TITLE' }); v.add({ t: 'solid', p: [[pm[0], pm[1] - 6], [pm[0], pm[1] - 12], [pm[0] + 2.6, pm[1] - 9]], L: 'S-TEXT' }); v.add({ t: 'line', a: [pm[0], pm[1] - 12], b: [pm[0], pm[1] - 15], L: 'S-TITLE' });
    lab(v, 1440, Ht, 1250, 640, 'EXISTING\nTIMBER\nFULLCAP'); lab(v, sx[0] + 40, yc, 2250, 1020, 'EXISTING TIMBER\nSTRINGER (TYP)'); lab(v, 3000, Hd + 140, 3150, 1020, 'EXISTING TIMBER\nDECKING');
    lab(v, 4350, Ht + 20, 4450, 1080, o.rhs && o.steel ? 'φ20 THREADED RODS AT 900 CRS\nMAXIMUM (A MINIMUM OF 1 - φ20\nROD PER PACKER) WITH 65x5FLx65\nWASHER TO TIMBER FACE (TYP)' : 'φ20 THREADED RODS\nAT 900 CRS MAXIMUM\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP)');
    lab(v, 3790, H0 + 5, 3820, -1300, 'RECESS EXISTING TIMBER FULLCAP\nAND SHORTEN EXISTING BOLT TO CLEAR\nPROPOSED FULLCAP STRENGTHENING.\nPROVIDE NEW 65x5FLx65 WASHER\nAND TIGHTEN BOLT. (TYP)');
    if (o.rhs) { if (o.steel) lab(v, 3300, 25, 3350, -420, '100x50x5.0 RHS\nSTEEL PACKER (TYP)'); else lab(v, 4450, 25, 4700, 320, '100x50x5.0 RHS\nSTEEL PACKER (TYP)'); }
    const p0 = piles[0];
    lab(v, p0 - 112, -s.d / 2, 1900, -760, o.steel ? '75x10FL STIFFENER\n(TO LAST PILE NEAREST\nTO WIDENING ONLY)' : '75x10FL STIFFENER' + (o.cleat === 'ua' ? '\n(TO LAST PILE NEAREST\nTO WIDENING ONLY)' : ''));
    v.weld(p0 - 115, -s.d + 30, -30, -12, { size: '6' });
    if (o.steel) {
      v.leaders([[p0 - 70, -75], [p0 + 70, -150]], (2600 - p0 + 70) / 20, (-420 + 75) / 20, '2-M20 BOLTS\n(TYP)'); lab(v, p0 + 102, -s.d - 700, 2700, -1000, '200 UC 52 PILE\n(TYP)'); lab(v, piles[1] + 112, -s.d * 0.6, 4450, -460, 'DENOTES LOCATION\nOF STEEL PACKER\nBEHIND PFC');
    } else {
      lab(v, p0 + 170, -s.d - 600, 2750, -1050, 'EXISTING TIMBER\nPILE (TYP)'); lab(v, piles[1] + 150, -s.d - 20, 4450, -450, 'SHIM PLATES'); const q = v.P(piles[1] + 150, -s.d - 20); nbox(v, 4490, -490, 'BEARING PLATES FOR\nHALFCAPS WITH\nBEARING < 70', 44);
      if (o.cleat === 'ua') lab(v, p0 + 40, -s.d / 2 + 30, 2750, -420, '1 - M20 x 250 LG COACH SCREW\n(SITE DRILL φ22 HOLE IN PFC)\n(TYP)');
    }
    LY.title('ELEVATION', 20);
  }

  // ---- DETAIL 2 for the timber pile strengthening sheets (1:10), one per channel size; ua = 150x100x10UA cleat version
  function det2(LY, s, ua) {
    const v = LY.view(10), xw = 0, ptop = 0, pb = -s.d, xr = (s.d >= 380 ? 60 : 55);
    // existing pile (irregular trimmed outline), fullcap above
    v.pl([[0, 60], [-150, 60], [-230, 0], [-260, -150], [-240, -280], [-170, pb - 10], [-40, pb - 30], [10, pb - 30], [10, pb - 80]], false, 'S-EXIST'); v.line(40, pb - 30, 40, pb - 120, 'S-EXIST');
    v.pl([[-20, 50], [-40, 170], [110, 170], [130, 50]], false, 'S-EXIST'); v.line(-20, 170, 10, 50, 'S-EXIST'); v.line(110, 170, 80, 50, 'S-EXIST');
    chanFill(v, xw, pb, s, 1); rhsSec(v, 50, 25, 100, 50, 5); v.rect(5, pb - 10, 130, 10, 'S-NEW'); v.hatch([[5, pb - 10], [135, pb - 10], [135, pb], [5, pb]], 'ansi31');
    v.line(xr, -s.tf - 40, xr, 120, 'S-BOLT'); vNut(v, xr, -s.tf, -1);
    if (ua) {
      v.rect(-100, -s.d / 2 - 115, 100, 230, 'S-NEW'); v.rect(-10, -s.d / 2 - 115, 10, 230, 'S-NEW'); [-s.d / 2 + 80, -s.d / 2 - 80].forEach(y => { v.circ(-50, y, 24, 'S-BOLT'); v.circ(-50, y, 11, 'S-BOLT'); }); [-s.d / 2 + 60, -s.d / 2 - 60].forEach(y => v.bolt(-10, y, s.tw, y, 20));
      v.line(-230, -s.d / 2, 0, -s.d / 2, 'S-HIDDEN'); v.pl([[-210, -s.d / 2 + 8], [-230, -s.d / 2], [-210, -s.d / 2 - 8]], false, 'S-HIDDEN');
      v.line(-100, -s.d / 2 + 115, -160, -s.d / 2 + 115, 'S-DIM'); v.line(-100, -s.d / 2 - 115, -160, -s.d / 2 - 115, 'S-DIM'); v.dim(-150, -s.d / 2 + 115, -150, -s.d / 2 - 115, 0, '230');
      v.line(0, 60, 0, 120, 'S-DIM'); v.line(-100, -s.d / 2 + 115, -100, 120, 'S-DIM'); v.dim(-100, 100, 0, 100, 0, '100');
      v.line(-10, -s.d / 2 + 115, -200, -s.d / 2 + 115, 'S-DIM'); v.dim(-190, -s.d / 2 + 115 + 35, -190, -s.d / 2 + 115, 0, '35', { sub: 'TYP' });
      v.line(s.b + 10, -s.d / 2 + 60, s.b + 80, -s.d / 2 + 60, 'S-DIM'); v.line(s.b + 10, -s.d / 2 - 60, s.b + 80, -s.d / 2 - 60, 'S-DIM'); v.dim(s.b + 70, -s.d / 2 + 60, s.b + 70, -s.d / 2 - 60, 0, '120');
      lab(v, -50, -s.d / 2 + 80, -420, 160, 'φ20 THREADED RODS\nWITH 65x5FLx65\nWASHER TO TIMBER\nFACE'); lab(v, -60, -s.d / 2 - 115, -420, -s.d / 2 - 200, '150x100x10UA\nCLEAT'); v.leaders([[s.tw + 30, -s.d / 2 + 60], [s.tw + 30, -s.d / 2 - 60]], (260 - s.tw - 30) / 10, (-40 + s.d / 2 - 60) / 10, '2 - M20 BOLTS (SITE DRILL\nφ22 HOLES IN PFC)');
    } else { v.line(-200, -s.d / 2, s.tw + 30, -s.d / 2, 'S-BOLT'); v.nut(s.tw, -s.d / 2, 1, 0, 20); v.rect(s.tw, -s.d / 2 + 15, 40, 40, 'S-NEW'); }
    v.weld(100, 20, 16, 8, { size: '6', len: '50-300', both: true }); v.weld(s.b * 0.7, pb + s.tf, (260 - s.b * 0.7) / 10, (-130 - pb - s.tf) / 10, { size: '4', site: true });
    v.line(5, pb - 15, 5, pb - 170, 'S-DIM'); v.line(40, pb - 120, 40, pb - 170, 'S-DIM'); v.dim(-25, pb - 150, 40, pb - 150, 0, ''); const q = v.P(-25, pb - 150); v.add({ t: 'line', a: [q[0] - 24, q[1]], b: q, L: 'S-DIM' }); boxVal(v, -330, pb - 165, '70'); tx(v, -300, pb - 165, 'MINIMUM BEARING', TH, 'l');
    nbox(v, -560, pb - 185, T_IFB, 48);
    v.line(135, pb - 5, 200, pb - 5, 'S-DIM'); v.line(135, pb - 10, 200, pb - 10, 'S-DIM'); lab(v, 170, pb - 5, 260, pb + 40, wrap(T_SHIM(s), 34)); 
    lab(v, -200, -60, -420, -20, 'EXISTING\nTIMBER PILE', { dot: true }); lab(v, 40, pb - 100, 260, pb - 200, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED ' + secName(s.d >= 380 ? '380PFC' : '300PFC') + '.');
    LY.title('DETAIL 2', 10, null); nbox(v, 60, pb - 250, (s.d >= 380 ? '380' : '300') + ' PFC', 20);
  }

  // ---- SECTION C (2323, 1:20): plan at the pile — φ20 rods crossing the pile to curved washers, 75x75x6 EA cleats on the PFC web
  function secC(LY) {
    const v = LY.view(20), R = 170, xw = R + 10;
    v.circ(0, 0, R, 'S-EXIST'); [-R - 60, -R - 20].forEach(x => v.line(x, -330, x, 330, 'S-EXIST')); zz(v, -R - 40, 330, 330); zz(v, -R - 40, -330, -330);
    v.fill([[xw, -330], [xw + 10, -330], [xw + 10, 330], [xw, 330]]); v.line(xw + 90, -330, xw + 90, 330, 'S-NEW'); zz(v, xw + 45, 330, 330); zz(v, xw + 45, -330, -330);
    [[1, 1], [1, -1]].forEach(([, k]) => { const yA = k * 120, yB = -k * 120; v.line(xw, yA, -R * 0.75, yB, 'S-BOLT'); aSec(v, xw, yA, 75, 75, 6, -1, k > 0 ? 1 : -1, 'S-NEW');
      const a0 = Math.atan2(yB, -R * 0.75) * 180 / PI; v.arc(0, 0, R + 12, a0 - 18, a0 + 18, 'S-NEW'); v.arc(0, 0, R + 20, a0 - 18, a0 + 18, 'S-NEW'); });
    v.leader(40, 300, 18, 14, 'φ40 HOLE TO PFC\nTO BE DRILLED ON\nSITE (TYP)'); v.leader(xw - 40, 160, 26, 4, '75x75x6 EA x\n100 LONG WITH\nφ26 HOLE (TYP)'); v.leader(-R - 8, 90, -30, 18, 'CURVED WASHER\nREFER TO DRG\nN° 9530-0072'); v.leader(-60, -40, -36, -4, 'φ20 THREADED\nROD (TYP)');
    v.weld(xw - 10, -150, 26, -22, { size: '6', site: true, tail: 'TYP' });
    LY.title('SECTION C', 20);
  }
  // ---- typical steel packer to PFC welding detail (2324, 1:10)
  function packerDet(LY, s) {
    const v = LY.view(10); chanFill(v, 0, -s.d, s, 1); rhsSec(v, 50, 25, 100, 50, 5); v.hatch([[0, -s.tf], [s.b, -s.tf], [s.b, 0], [0, 0]], 'ansi31');
    v.leader(5, 40, -26, 2, '100x50x5.0 RHS\nSTEEL PACKER'); v.leader(0, -s.d * 0.6, -20, 0, secName(s.d >= 380 ? '380PFC' : '300PFC')); v.weld(s.b, 5, 20, s.d >= 380 ? 8 : -6, { size: '6', len: '50-300', both: true });
    LY.title('TYPICAL STEEL PACKER TO PFC WELDING DETAIL', null, s.d >= 380 ? '380 PFC' : '300 PFC', { h: 2.8 });
  }

  // ================================================================== PN30-2322 / 2323 / 2323A / 2324  ABUTMENT FULLCAP STRENGTHENING & WIDENING
  function strengthen(p, sh) {
    const steel = sh === '2322' || sh === '2324', rhs = sh !== '2322', ua = sh === '2323A', s = sec(p.pfc, '300PFC'), fd = +p.fd || 300, D = +p.D || 340;
    const o = { steel, rhs, cleat: ua ? 'ua' : 'ea', s, fd, D, pfc: p.pfc }, LY = new Lay(780);
    if (sh === '2322') { seatDet(LY, '1'); capDet(LY, '2'); }
    else if (sh === '2324') { seatDet(LY, '2'); capDet(LY, '1'); }
    else { if (sh === '2323') secC(LY); capDet(LY, '1'); }
    LY.block(B => nbox(B, 0, 0, T_STR, 64));
    if (sh === '2324') { packerDet(LY, SEC['300PFC']); packerDet(LY, SEC['380PFC']); }
    if (!steel) { det2(LY, SEC['380PFC'], ua); det2(LY, SEC['300PFC'], ua); LY.block(B => { let y = 0; [T_MORE2, T_ENG].forEach(t => { y -= nbox(B, 0, y, t, 66) + 6; }); nbox(B, 0, y, T_RELF, 70, { solid: true }); }); }
    LY.break();
    secStrength(LY, o); viewA(LY, steel && sh === '2322' ? '2' : '1'); elevStrength(LY, o);
    LY.break();
    LY.block(B => { let x = 0; if (steel) { nbox(B, x, 0, T_RESTR, 76); x += 90; } nbox(B, x, 0, sh === '2324' ? T_JACK : T_PROP, 110, { solid: true }); nbox(B, x + 124, 0, T_VARY, 110); nbox(B, x + 248, 0, T_DRG, 46); });
    LY.caption(steel ? 'STEEL ABUTMENT PILES/ABUTMENT FULLCAP STRENGTHENING & WIDENING DETAIL' : 'ABUTMENT FULLCAP STRENGTHENING & WIDENING DETAIL', 20, steel ? 'ABUTMENT N° X - PILE N° X\nABUTMENT N° X - PILE N° X' : 'ABUTMENT N° X\nABUTMENT N° X', { ref: 'XX30-XXXX' });
    return fixT(LY.done());
  }
  const PS = [P('pfc', 'Fullcap strengthening PFC', '300PFC', { opts: ['300PFC', '380PFC'] }), P('fd', 'Timber fullcap depth (mm)', 300, { num: 1 })];
  def('pn2322', 'Abutments', 'Steel abutment piles – fullcap strengthening & widening (steel packers)', 'PN30-2322', PS, p => strengthen(p, '2322'),
    'PFC fullcap strengthening on 200 UC steel abutment piles with steel packers and 250 UC 90 seats, plus a stub-column widening; only where the timber fullcap has no significant permanent bowing or crushing.');
  def('pn2323', 'Abutments', 'Abutment fullcap strengthening & widening – timber piles (RHS packer, rods with curved washers)', 'PN30-2323', PS.concat([P('D', 'Pile dia. (mm)', 340, { num: 1 })]), p => strengthen(p, '2323'),
    'PFC fullcap strengthening on timber abutment piles with 100x50 RHS packers and φ20 rods with curved washers through the piles; only where the timber fullcap has no significant permanent bowing or crushing.');
  def('pn2323a', 'Abutments', 'Abutment fullcap strengthening & widening – timber piles (RHS packer, UA cleats)', 'PN30-2323A', PS.concat([P('D', 'Pile dia. (mm)', 340, { num: 1 })]), p => strengthen(p, '2323A'),
    'PFC fullcap strengthening on timber abutment piles with 100x50 RHS packers, 150x100x10 UA cleats rodded to the piles and an M20 coach screw per pile; only where the fullcap is not permanently bowed or crushed.');
  def('pn2324', 'Abutments', 'Steel abutment piles – fullcap strengthening & widening (RHS packers)', 'PN30-2324', PS, p => strengthen(p, '2324'),
    'PFC fullcap strengthening on 200 UC steel abutment piles with 100x50 RHS steel packers (one φ20 rod per packer minimum) and 250 UC 90 seats, plus a stub-column widening.');

  // ================================================================== PN30-2325 / 2325A / 2326 / 2327  ABUTMENT FULLCAP REPLACEMENT
  const T_REPV = 'NOTE: FULLCAP REPLACEMENT CHANNEL WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS.\n300 PFC FULLCAP DRAWN.';
  const T_BRK = 'STRINGER/CORBEL BRACKET FIXED TO CORBELS WITH φ20 THREADED ROD WITH 65x5FLx65 WASHER TO TIMBER FACE AND FIXED TO PFC FULLCAP WITH 2 - M20 BOLTS IN SITE DRILLED φ22 HOLES (TYP)';
  // stringer / corbel bracket in a section (small, 1:20): angle seat on the PFC top flange with the rod end
  function brk(v, x, y, k) { k = k || 1; v.pl([[x, y], [x + k * 110, y], [x + k * 110, y + 35], [x + k * 95, y + 55], [x + k * 15, y + 55], [x, y + 40]], true, 'S-NEW'); v.boltEnd(x + k * 60, y + 28, 22); }
  // stringer bracket seen in the elevation: seat angle on the flange, inclined rod up through the stringer to the far side
  function brkE(v, x, k) { v.pl([[x, 0], [x + k * 140, 0], [x + k * 140, 40], [x + k * 120, 60], [x + k * 30, 60]], false, 'S-NEW'); v.pl([[x + k * 10, 5], [x + k * 40, 70], [x + k * 50, 65], [x + k * 22, 5]], true, 'S-NEW'); [x + k * 60, x + k * 120].forEach(xx => { v.line(xx, 0, xx, -40, 'S-BOLT'); v.rect(xx - 14, -50, 28, 14, 'S-BOLT'); }); }

  // ---- DETAIL 1 (AT PILE) for the timber pile replacement sheets (1:10)
  function det1R(LY, s, ua) {
    const v = LY.view(10), pb = -s.d;
    v.pl([[0, 0], [-150, 0], [-220, -60], [-240, -200], [-200, pb + 40], [-120, pb - 20], [-40, pb - 40], [10, pb - 40], [10, pb - 90]], false, 'S-EXIST'); v.line(40, pb - 40, 40, pb - 130, 'S-EXIST');
    chanFill(v, 0, pb, s, 1); v.rect(5, pb - 10, 130, 10, 'S-NEW'); v.hatch([[5, pb - 10], [135, pb - 10], [135, pb], [5, pb]], 'ansi31');
    if (ua) {
      v.rect(-100, -s.d / 2 - 90, 100, 180, 'S-NEW'); v.rect(-10, -s.d / 2 - 90, 10, 180, 'S-NEW'); [-s.d / 2 + 50, -s.d / 2 - 50].forEach(y => { v.circ(-50, y, 24, 'S-BOLT'); v.circ(-50, y, 11, 'S-BOLT'); }); [-s.d / 2 + 60, -s.d / 2 - 60].forEach(y => v.bolt(-10, y, s.tw, y, 20));
      v.line(-230, -s.d / 2, 0, -s.d / 2, 'S-HIDDEN'); v.pl([[-210, -s.d / 2 + 8], [-230, -s.d / 2], [-210, -s.d / 2 - 8]], false, 'S-HIDDEN');
      v.line(-100, -s.d / 2 + 90, -170, -s.d / 2 + 90, 'S-DIM'); v.line(-100, -s.d / 2 - 90, -170, -s.d / 2 - 90, 'S-DIM'); v.dim(-160, -s.d / 2 + 90, -160, -s.d / 2 - 90, 0, '180'); v.line(-50, -s.d / 2 + 50, -150, -s.d / 2 + 50, 'S-DIM'); v.dim(-140, -s.d / 2 + 90, -140, -s.d / 2 + 50, 0, s.d >= 380 ? '90' : '50', s.d >= 380 ? {} : { sub: 'MIN' });
      v.line(0, 10, 0, 90, 'S-DIM'); v.line(-100, -s.d / 2 + 90, -100, 90, 'S-DIM'); v.dim(-100, 70, 0, 70, 0, '100');
      v.line(s.b + 10, -s.d / 2 + 60, s.b + 80, -s.d / 2 + 60, 'S-DIM'); v.line(s.b + 10, -s.d / 2 - 60, s.b + 80, -s.d / 2 - 60, 'S-DIM'); v.dim(s.b + 70, -s.d / 2 + 60, s.b + 70, -s.d / 2 - 60, 0, '120');
      lab(v, -50, -s.d / 2 + 50, -420, 140, 'φ20 THREADED RODS\nWITH 65x5FLx65\nWASHER TO TIMBER\nFACE'); lab(v, -60, -s.d / 2 - 90, -420, -s.d / 2 - 170, '150x100x10UA\nCLEAT'); v.leaders([[s.tw + 30, -s.d / 2 + 60], [s.tw + 30, -s.d / 2 - 60]], (260 - s.tw - 30) / 10, (60 + s.d / 2 - 60) / 10, '2 - M20 BOLTS (SITE DRILL\nφ22 HOLES IN PFC)');
    } else { v.line(-200, -s.d / 2, s.tw + 30, -s.d / 2, 'S-BOLT'); v.line(-200, -s.d / 2 + 8, -20, -s.d / 2 + 8, 'S-BOLT'); v.nut(s.tw, -s.d / 2, 1, 0, 20); }
    v.weld(s.b * 0.7, pb + s.tf, (260 - s.b * 0.7) / 10, (-60 - pb - s.tf) / 10, { size: '4', site: true });
    v.line(5, pb - 15, 5, pb - 170, 'S-DIM'); v.line(40, pb - 130, 40, pb - 170, 'S-DIM'); v.dim(-25, pb - 150, 40, pb - 150, 0, ''); const q = v.P(-25, pb - 150); v.add({ t: 'line', a: [q[0] - 24, q[1]], b: q, L: 'S-DIM' }); boxVal(v, -330, pb - 165, '70'); tx(v, -300, pb - 165, 'MINIMUM BEARING', TH, 'l');
    nbox(v, -560, pb - 185, T_IFB, 48);
    lab(v, 170, pb - 5, 260, pb + 30, s.d >= 380 ? wrap(T_SHIM(s), 34) : 'GAP BETWEEN RECESS IN\nEXISTING PILE AND 300 PFC\nVARIES, PROVIDE 100x(10 OR\n20FL)x300 LONG GALV STEEL\nSHIM PLATES AS REQUIRED.\nTACK WELD SHIM PLATES\nTOGETHER AFTER PLACEMENT.\nMAKE GOOD GALV. SURFACE\nBY APPLYING COLD GALV');
    v.line(135, pb - 5, 200, pb - 5, 'S-DIM');
    lab(v, -170, -60, -420, -10, 'EXISTING\nTIMBER PILE', { dot: true }); if (s.d >= 380) lab(v, 40, pb - 110, 260, pb - 260, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED 380 PFC.');
    LY.title('DETAIL 1', 10, '(AT PILE)'); nbox(v, 60, pb - 280, (s.d >= 380 ? '380' : '300') + ' PFC', 20);
  }
  // ---- STRINGER / CORBEL BRACKET DETAILS (1:5): plan + elevation
  function bracketDet(LY) {
    const v = LY.view(5);
    v.rect(0, 0, 200, 75); v.line(0, 4, 200, 4); [35, 165].forEach(x => v.circ(x, 37.5, 11, 'S-NEW')); v.line(-10, 37.5, 210, 37.5, 'S-CL');
    v.rect(-5, -100, 130, 100); v.line(40, -100, 40, 0, 'S-HIDDEN'); v.line(115, -100, 115, 0, 'S-HIDDEN'); v.line(5, -100, 5, 0, 'S-NEW');
    v.pl([[14, -25], [14, -75]], false, 'S-NEW'); v.arc(20, -25, 6, 0, 180); v.arc(20, -75, 6, 180, 360); v.line(26, -25, 26, -75); v.line(14, -25, 14, -75);
    v.line(-5, -100, -60, -100, 'S-DIM'); v.line(-5, 0, -60, 0, 'S-DIM'); v.dim(-50, 0, -50, -100, 0, '100'); v.line(14, -25, -35, -25, 'S-DIM'); v.line(14, -75, -35, -75, 'S-DIM'); v.dim(-25, -25, -25, -75, 0, '50'); v.line(0, 37.5, -35, 37.5, 'S-DIM'); v.dim(-25, 37.5 + 25, -25, 37.5, 0, '25');
    v.line(200, 0, 270, 0, 'S-DIM'); v.line(200, 75, 270, 75, 'S-DIM'); v.dim(260, 75, 260, 0, 0, '75'); v.dim(230, 75, 230, 37.5, 0, '='); v.dim(230, 37.5, 230, 0, 0, '=');
    lab(v, 165, 37.5, 260, 160, 'φ22 HOLE (TYP)'); lab(v, 20, -75, 70, -170, 'φ22 x 50 LONG\nSLOTTED HOLE');
    utx(v, 100, -230, 'PLAN', 2.2);
    // elevation
    const y0 = -420; v.pl([[0, y0], [200, y0], [200, y0 + 55], [180, y0 + 75], [35, y0 + 75]], false, 'S-NEW'); v.line(0, y0 + 10, 200, y0 + 10, 'S-HIDDEN');
    v.pl([[2, y0 + 2], [42, y0 + 72], [50, y0 + 67], [10, y0 - 2]], true, 'S-NEW'); v.pl([[42, y0 + 72], [150, y0 + 8], [144, y0 + 1], [46, y0 + 60]], false, 'S-NEW');
    v.line(0, y0, 0, y0 - 80, 'S-DIM'); v.line(35, y0 + 75, 35, y0 - 40, 'S-DIM'); v.line(165, y0 + 5, 165, y0 - 40, 'S-DIM'); v.line(200, y0, 200, y0 - 80, 'S-DIM'); v.dim(0, y0 - 30, 35, y0 - 30, 0, '35'); v.dim(35, y0 - 30, 165, y0 - 30, 0, '130'); v.dim(0, y0 - 70, 200, y0 - 70, 0, '200');
    v.dim(-40, y0 + 5, -40, y0, 0, '5'); v.dim(-20, y0 + 40, 15, y0 + 100, 0, '45'); v.dim(30, y0 + 120, 45, y0 + 128, 0, '5');
    lab(v, 90, y0 + 40, 200, y0 + 170, '125x75x10UA'); lab(v, 190, y0 + 65, 260, y0 + 100, '20 x 20\nCHAMFER'); lab(v, 200, y0, 260, y0 - 40, '75x75x10 EA\nTRIM VERTICAL\nLEG TO SUIT'); v.weld(110, y0 + 30, 12, 14, { size: '6', all: true });
    utx(v, 100, y0 - 140, 'ELEVATION', 2.2);
    LY.title('STRINGER/CORBEL BRACKET DETAILS', 5, '2 - BRACKETS REQUIRED PER STRINGER/\nCORBEL CONNECTION :-\n1 - AS DRAWN\n1 - OPPOSITE HAND', { h: 3.2 });
  }
  // ---- SECTION A (1:20) for the replacement sheets. o: { steel, angles2, ua, s, D }
  function secRepl(LY, o) {
    const v = LY.view(20), s = o.s, yd = 420, fd = 300;
    if (o.steel) {
      const xp = 75, xf = xp + 206, ylo = -1300, xw = xf, pb = -s.d;
      abutBg(v, ylo + 100, yd, 1150, 0, xf + 300);
      v.rect(0, ylo + 60, 75, -ylo - 60, 'S-NEW'); [xp, xp + 12, xf - 12, xf].forEach(x => v.line(x, ylo, x, 0, 'S-NEW')); v.line(xp, 0, xf, 0, 'S-NEW'); zz(v, (xp + xf) / 2, ylo, ylo);
      timberX(v, xf, -fd, 250, fd); chanFill(v, xw, pb, s, 1); [pb + s.d * 0.3, pb + s.d * 0.7].forEach(y => v.bolt(xf - 12, y, xw + s.tw, y, 20));
      if (o.angles2) { v.rect(xf, pb - 130, 200, 130, 'S-NEW'); v.line(xf, pb - 13, xf + 200, pb - 13, 'S-HIDDEN'); v.weld(xf + 40, pb - 100, -48, -22, { size: '8', both: true, tail: 'TYP' }); }
      else { aSec(v, xf, pb, 200, 200, 13, 1, -1, 'S-NEW'); v.line(xf + 13, pb - 200, xf + 190, pb - 13, 'S-NEW'); { const dx = (-200 - xf - 5) / 20, dy = (-650 - pb + 150) / 20; v.leaders([[xf + 5, pb - 150], [xf + 100, pb - 110]], dx, dy, '', { noArrow: true }); v.weld(xf + 5, pb - 150, dx, dy, { size: '8' }); } }
      brk(v, xw + 20, 0); brk(v, xw + 5, 190); v.line(xw + 60, 0, xw + 60, -30, 'S-BOLT');
      v.line(xw, 0, xw, yd + 260, 'S-DIM'); v.line(xw + 55, 60, xw + 55, yd + 260, 'S-DIM'); v.dim(xw, yd + 220, xw + 55, yd + 220, 0, '55', { sub: '(TYP)' });
      lab(v, -75, yd - 120, -320, 300, 'EXISTING TIMBER\nSHEETING'); lab(v, 30, -150, -320, 40, 'TIMBER PACKER', { dot: true }); lab(v, xf, pb - 60, -320, -400, '200x200x13 EA\nx 400 LONG');
      lab(v, xf, ylo + 150, -320, ylo + 150, 'PROPOSED PILE'); v.leaders([[xw + 20, 200 + 40], [xw + 40, 40]], (560 - xw - 20) / 20, (760 - 240) / 20, 'NOTCH STRINGER\nTO SUIT (TYP)');
      lab(v, xw + 110, 20, 560, -150, wrap(T_BRK, 30)); lab(v, xf + 170, -240, 560, -900, 'REMOVE EXISTING TIMBER\nFULLCAP ONLY AFTER\nPROPPING STRINGERS');
      LY.title('SECTION A', 20); return;
    }
    const D = o.D, xw = D - 25, pb = -s.d, ylo = -1300;
    abutBg(v, ylo + 200, yd, 1000, 0, xw + 300);
    timberX(v, xw, -fd, 250, fd); v.line(0, ylo, 0, 0, 'S-EXIST'); v.pl([[D, ylo], [D, pb - 10], [xw, pb - 10], [xw, 0]], false, 'S-EXIST'); v.line(0, 0, xw, 0, 'S-EXIST'); v.pileEnd(D / 2, ylo, D, 'S-EXIST'); band(v, -10, D + 10, pb - 90);
    chanFill(v, xw, pb, s, 1); v.rect(xw - 5, pb - 10, 130, 10, 'S-NEW'); v.hatch([[xw - 5, pb - 10], [xw + 125, pb - 10], [xw + 125, pb], [xw - 5, pb]], 'ansi31');
    const ym = -s.d / 2;
    if (o.ua) { v.rect(xw - 100, ym - 90, 100, 180, 'S-NEW'); [ym + 50, ym - 50].forEach(y => v.boltEnd(xw - 50, y, 20)); }
    else { v.line(-60, ym, xw + s.tw, ym, 'S-BOLT'); v.line(-60, ym + 8, xw - 20, ym + 8, 'S-BOLT'); v.nut(xw + s.tw, ym, 1, 0, 20); }
    brk(v, xw + 20, 0); brk(v, xw + 5, 190); v.line(xw + 60, 0, xw + 60, -30, 'S-BOLT');
    callout(v, xw + 40, ym, 230, '1', -16, 14);
    v.line(xw, 0, xw, yd + 260, 'S-DIM'); v.line(xw + 55, 60, xw + 55, yd + 260, 'S-DIM'); v.dim(xw, yd + 220, xw + 55, yd + 220, 0, '55', { sub: '(TYP)' });
    if (o.ua) { lab(v, xw - 60, ym + 60, -320, -60, 'NOTCH PILE\nTO SUIT'); lab(v, xw - 100, ym - 80, -320, -480, '150x100x10UA\nCLEAT'); }
    else lab(v, -40, ym, -320, -480, "φ20 'U' THREADED\nROD (TYP)");
    v.leaders([[xw + 20, 200 + 40], [xw + 40, 40]], (600 - xw - 20) / 20, (760 - 240) / 20, 'NOTCH STRINGER\nTO SUIT (TYP)');
    lab(v, xw + 110, 20, 600, -150, wrap(T_BRK, 30)); lab(v, xw + 200, -250, 600, -900, 'REMOVE EXISTING TIMBER\nFULLCAP ONLY AFTER\nPROPPING STRINGERS');
    LY.title('SECTION A', 20);
  }
  // ---- ELEVATION (1:20) for the replacement sheets
  function elevRepl(LY, o) {
    const v = LY.view(20), s = o.s, X0 = 0, X1 = 3100, Hd = 470, sx = o.steel ? [800, 2300] : [800, 2100], piles = o.steel ? [1550] : [550, 2550];
    pfcElevH(v, X0, X1, 0, s); zz(v, X0, -s.d / 2, -s.d / 2); zz(v, X1, -s.d / 2, -s.d / 2);
    v.rect(X0 + 150, Hd, X1 - 300, 140, 'S-EXIST'); zz(v, X0 + 150, Hd + 70, Hd + 70); zz(v, X1 - 150, Hd + 70, Hd + 70);
    sx.forEach(x => { const R = 235, yc = Hd / 2 + 10; v.arc(x, yc, R, 115, 245, 'S-EXIST'); v.arc(x, yc, R, -65, 65, 'S-EXIST'); brkE(v, x - 160, -1); brkE(v, x + 160, 1);
      [[-1, 1], [1, -1]].forEach(([a, b]) => { [-8, 8].forEach(d => v.line(x + a * 180 + d, 50, x + b * 120 + d, Hd - 40, 'S-HIDDEN')); v.circ(x + b * 120, Hd - 40, 14, 'S-BOLT'); v.circ(x + a * 180, 50, 14, 'S-BOLT'); }); });
    piles.forEach((pc, i) => {
      if (o.steel) {
        const u = SEC['200UC52']; v.line(pc - u.b / 2, -s.d, pc - u.b / 2, -s.d - 900); v.line(pc + u.b / 2, -s.d - 200, pc + u.b / 2, -s.d - 900); v.line(pc, -s.d, pc, -s.d - 900, 'S-HIDDEN'); zz(v, pc, -s.d - 900, -s.d - 900);
        v.pl([[pc - u.b / 2, 0], [pc - u.b / 2, -s.d]], false, 'S-HIDDEN'); v.pl([[pc + u.b / 2, 0], [pc + u.b / 2, -s.d]], false, 'S-HIDDEN'); v.rect(pc - 50, 0, 100, 20, 'S-NEW');
        if (o.angles2) { v.line(pc + u.b / 2 + 10, -s.d, pc + u.b / 2 + 10, -s.d - 900, 'S-HIDDEN'); }
        else { v.rect(pc - 15, -s.d - 200, 215, 200, 'S-NEW'); v.line(pc + 10, -s.d - 13, pc + 10, -s.d - 190, 'S-HIDDEN'); }
        v.boltEnd(pc - 70, -75, 20); v.boltEnd(pc + 70, -150, 20);
        v.line(pc - 70, -50, pc - 70, Hd - 140, 'S-DIM'); v.line(pc + 70, -130, pc + 70, Hd - 140, 'S-DIM'); v.dim(pc - 70, Hd - 160, pc + 70, Hd - 160, 0, '140');
        v.line(pc + 90, -75, pc + 400, -75, 'S-DIM'); v.line(pc + 90, -150, pc + 400, -150, 'S-DIM'); v.dim(pc + 380, -150, pc + 380, -75, 0, '75', { sub: '(TYP)' });
        v.leaders([[pc - 70, -75], [pc + 70, -150]], (pc - 600 - pc + 70) / 20, (-560 + 75) / 20, 'M20 BOLTS\n(TYP)'); lab(v, pc - u.b / 2, -s.d - 700, pc - 500, -s.d - 700, '200 UC 52 PILE');
        if (o.angles2) lab(v, pc + u.b / 2 + 10, -s.d - 400, pc + 500, -s.d - 560, '200x200x13 EA\n(TYP)'); else { lab(v, pc + 200, -s.d - 100, pc + 500, -s.d - 260, '200x200x13 EA'); lab(v, pc + 10, -s.d - 150, pc + 500, -s.d - 560, '180x10FLx180\nSTIFFENER'); v.weld(pc - 15, -s.d - 120, -30, -20, { size: '8' }); }
        const pm = v.P(pc - 260, -s.d - 300); v.add({ t: 'line', a: [pm[0], pm[1] + 4], b: [pm[0], pm[1] - 6], L: 'S-TITLE' }); v.add({ t: 'solid', p: [[pm[0], pm[1] - 6], [pm[0], pm[1] - 12], [pm[0] + 2.6, pm[1] - 9]], L: 'S-TEXT' }); v.add({ t: 'line', a: [pm[0], pm[1] - 12], b: [pm[0], pm[1] - 15], L: 'S-TITLE' });
      } else {
        const r = 170; [-r, r].forEach(d => { v.line(pc + d, -s.d - 30, pc + d, -s.d - 900, 'S-EXIST'); v.line(pc + d, 0, pc + d, -s.d, 'S-HIDDEN'); }); v.pileEnd(pc, -s.d - 900, 2 * r, 'S-EXIST'); band(v, pc - r - 5, pc + r + 5, -s.d - 150);
        v.rect(pc - 150, -s.d - 20, 300, 20, 'S-NEW'); v.hatch([[pc - 150, -s.d - 20], [pc + 150, -s.d - 20], [pc + 150, -s.d], [pc - 150, -s.d]], 'ansi31');
        if (o.ua) { [pc - r - 30, pc + r].forEach(x => { v.rect(x, -s.d + 25, 30, s.d - 50, 'S-NEW'); v.boltEnd(x + 15, -70, 16); v.boltEnd(x + 15, -s.d + 70, 16); }); v.boltEnd(pc, -s.d / 2, 20); }
        else { [-r - 20, r + 20].forEach(d => v.circ(pc + d, -s.d / 2, 16, 'S-BOLT')); [-10, 10].forEach(d => v.line(pc - r - 20, -s.d / 2 + d, pc + r + 20, -s.d / 2 + d, 'S-HIDDEN')); }
        if (!i) { v.line(pc + r, -s.d - 160, pc + r, -s.d - 330, 'S-DIM'); v.line(pc + r - 25, -s.d - 20, pc + r - 25, -s.d - 330, 'S-DIM'); v.dim(pc + r - 25, -s.d - 300, pc + r, -s.d - 300, 0, '25 NOTCH', { sub: '(TYP)' }); lab(v, pc + r, -s.d - 700, pc + 500, -s.d - 800, 'EXISTING TIMBER\nPILE (TYP)'); if (o.ua) lab(v, pc, -s.d / 2, pc + 600, -s.d - 450, '1 - M20 x 250 LG COACH SCREW\n(SITE DRILL φ22 HOLE IN PFC)\n(TYP)'); const pm = v.P(pc - 260, -s.d - 300); v.add({ t: 'line', a: [pm[0], pm[1] + 4], b: [pm[0], pm[1] - 6], L: 'S-TITLE' }); v.add({ t: 'solid', p: [[pm[0], pm[1] - 6], [pm[0], pm[1] - 12], [pm[0] + 2.6, pm[1] - 9]], L: 'S-TEXT' }); v.add({ t: 'line', a: [pm[0], pm[1] - 12], b: [pm[0], pm[1] - 15], L: 'S-TITLE' }); }
        else { v.line(pc - 150, -s.d - 30, pc - 150, -s.d - 260, 'S-DIM'); v.line(pc + 150, -s.d - 30, pc + 150, -s.d - 260, 'S-DIM'); v.dim(pc - 150, -s.d - 240, pc + 150, -s.d - 240, 0, '300', { sub: '(TYP)' }); lab(v, pc + 150, -s.d - 20, pc + 400, -s.d - 200, 'SHIM PLATES'); nbox(v, pc + 430, -s.d - 230, 'BEARING PLATES FOR\nFULLCAPS WITH\nBEARING < 70', 44); }
      }
    });
    stalkMk(v, o.steel ? 1450 : 380, Hd + 190, 'A', 0, 8);
    lab(v, sx[0] - 60, Hd / 2, sx[0] - 500, Hd + 380, 'EXISTING TIMBER\nSTRINGER (TYP)'); lab(v, X1 - 600, Hd + 140, X1 - 400, Hd + 380, 'EXISTING TIMBER\nDECKING');
    const pl = 'PROPOSED ' + secName(o.pfc) + ' FULLCAP REPLACEMENT';
    if (o.steel) lab(v, X1 - 300, -s.d, X1 - 100, -s.d - 200, 'PROPOSED ' + secName(o.pfc) + '\nFULLCAP REPLACEMENT'); else lab(v, X0 + 80, 0, X0 - 150, 300, 'PROPOSED ' + secName(o.pfc) + '\nFULLCAP\nREPLACEMENT');
    LY.title('ELEVATION', 20);
  }
  function replace(p, sh) {
    const steel = sh === '2326' || sh === '2327', ua = sh === '2325A', s = sec(p.pfc, '300PFC'), D = +p.D || 340, o = { steel, angles2: sh === '2327', ua, s, D, pfc: p.pfc }, LY = new Lay(760);
    if (!steel) { det1R(LY, SEC['380PFC'], ua); det1R(LY, SEC['300PFC'], ua); LY.block(B => { let y = 0; [T_MORE2, T_ENG].forEach(t => { y -= nbox(B, 0, y, t, 62) + 6; }); }); }
    else LY.block(B => nbox(B, 0, 0, T_RESTR, 80));
    bracketDet(LY);
    LY.break();
    secRepl(LY, o); elevRepl(LY, o);
    LY.break();
    LY.block(B => { let x = 0; if (!steel) { nbox(B, 0, 0, T_RELF, 66, { solid: true }); x = 80; nbox(B, x, 0, T_REPV, 84); x += 98; } nbox(B, x, 0, T_DRG, 46); });
    LY.caption(steel ? 'STEEL ABUTMENT PILE/ABUTMENT FULLCAP REPLACEMENT DETAIL - TYPE 1' : 'ABUTMENT FULLCAP REPLACEMENT DETAIL', 20, 'ABUTMENT N° 1 - PILE N° X\nABUTMENT N° 2 - PILE N° X', { ref: 'XX30-XXXX' });
    return fixT(LY.done());
  }
  const PR = [P('pfc', 'Replacement PFC', '300PFC', { opts: ['300PFC', '380PFC'] })];
  // 'afr' is the original id for PN30-2325 (kept: saved drawings and the timber app reference it)
  def('afr', 'Abutments', 'Abutment fullcap replacement – timber piles (PFC, U-rod)', 'PN30-2325', PR.concat([P('D', 'Pile dia. (mm)', 340, { num: 1 })]), p => replace(p, '2325'),
    "Replace a failed timber abutment fullcap with a PFC notched onto the timber piles and held by φ20 'U' rods, with stringer brackets; remove the timber fullcap only after propping the stringers.");
  def('pn2325a', 'Abutments', 'Abutment fullcap replacement – timber piles (PFC, UA cleats)', 'PN30-2325A', PR.concat([P('D', 'Pile dia. (mm)', 340, { num: 1 })]), p => replace(p, '2325A'),
    'Replace a timber abutment fullcap with a PFC fixed to each timber pile by 150x100x10 UA cleats, φ20 rods and an M20 coach screw, with stringer brackets; prop the stringers first.');
  def('pn2326', 'Abutments', 'Steel abutment pile – fullcap replacement Type 1 (seat angle + stiffener)', 'PN30-2326', PR, p => replace(p, '2326'),
    'Replace the abutment fullcap with a PFC bolted to non-driven 200 UC steel piles on a stiffened 200x200x13 EA seat, with stringer brackets; prop the stringers first.');
  def('pn2327', 'Abutments', 'Steel abutment pile – fullcap replacement (seat angles both sides)', 'PN30-2327', PR, p => replace(p, '2327'),
    'Replace the abutment fullcap with a PFC bolted to non-driven 200 UC steel piles seated on 200x200x13 EA angles each side of the pile, with stringer brackets; prop the stringers first.');
})(typeof window !== 'undefined' ? window : globalThis);
