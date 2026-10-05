/* StructCap Timber — repair details: PN30-2306 … 2317 (halfcap strengthening and widening, steel pile / halfcap replacement,
   abutment fullcap strengthening). Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js
   for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, bbox, shiftE, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ shared geometry (model mm)
  const HC = 300, HW = 200, LOGD = 470, CORH = 300, STRH = 360, DECK = 130, PACK = 50;
  const PF = k => SEC[k] || SEC['300PFC'];
  const pfcLbl = k => (PF(k) === SEC['380PFC'] ? '380' : String(k).replace(/PFC$/, ''));
  const rodOff = k => (PF(k).d >= 380 ? 60 : 55);
  const UC = k => SEC[k] || SEC['200UC52'];

  // log (round timber) cut flat top and bottom between yb..yt, centred at x: two side arcs (+ flats when asked)
  function logCut(v, x, yb, yt, D, flats) {
    const R = D / 2, yc = (yb + yt) / 2, h = min((yt - yb) / 2, R * 0.999), th = Math.asin(h / R) * 180 / PI, w = sq(R * R - h * h);
    v.arc(x, yc, R, -th, th, 'S-EXIST'); v.arc(x, yc, R, 180 - th, 180 + th, 'S-EXIST');
    if (flats) { v.line(x - w, yb, x + w, yb, 'S-EXIST'); v.line(x - w, yt, x + w, yt, 'S-EXIST'); }
    return w;
  }
  // existing bolt hidden in timber (double dashed line) with small washer/nut blocks at the ends
  function exBolt(v, x, y0, y1, recess) {
    v.line(x - 9, y0, x - 9, y1, 'S-HIDDEN'); v.line(x + 9, y0, x + 9, y1, 'S-HIDDEN');
    v.rect(x - 30, y1 - 14, 60, 14, 'S-EXIST'); v.rect(x - 14, y1 - 26, 28, 12, 'S-EXIST');
    if (recess) { v.pl([[x - 45, y0], [x - 45, y0 + 45], [x + 45, y0 + 45], [x + 45, y0]], false, 'S-NEW'); v.rect(x - 32, y0 + 32, 64, 6, 'S-NEW'); v.rect(x - 14, y0 + 14, 28, 18, 'S-BOLT'); }
    else { v.rect(x - 30, y0, 60, 14, 'S-EXIST'); v.rect(x - 14, y0 + 14, 28, 12, 'S-EXIST'); }
  }
  // proposed vertical threaded rod: washer on the timber top (yt), nut under the steel flange (yf); hidden inside timber yb..yt
  function vRod(v, x, yt, yb, yf) {
    v.line(x - 10, yb, x - 10, yt, 'S-HIDDEN'); v.line(x + 10, yb, x + 10, yt, 'S-HIDDEN');
    v.line(x, yt + 40, x, yt, 'S-BOLT'); v.line(x, yb, x, yf - 40, 'S-BOLT');
    v.fill([[x - 32, yt], [x + 32, yt], [x + 32, yt + 6], [x - 32, yt + 6]], 'S-BOLT'); v.rect(x - 16, yt + 6, 32, 18, 'S-BOLT');
    v.rect(x - 16, yf - 18, 32, 18, 'S-BOLT');
  }
  // big solid half-arrow at the end of a section cut line (as on the sheets)
  function cutArrow(v, x, y, len, dir) { const k = dir || 1, s = v.s; v.line(x, y, x, y - len, 'S-TITLE'); v.fill([[x, y - len * 0.45], [x + k * 2.2 * s, y - len * 0.72], [x, y - len]], 'S-TITLE'); }
  // a boxed parameter value such as [300] in a note (dashed box round the given paper-space text)
  function boxTxt(v, px, py, s) { const w = s.length * TH * 0.66 + 1.2; v.add({ t: 'pl', p: [[px - 0.6, py - 0.8], [px + w - 0.6, py - 0.8], [px + w - 0.6, py + TH + 0.8], [px - 0.6, py + TH + 0.8]], closed: true, L: 'S-NOTE' }); v.add({ t: 'text', p: [px, py], s, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); }

  // ------------------------------------------------------------------ elevation: pier halfcap (or abutment fullcap) strengthening
  // o: s (PFC), pile 'uc' | 'timber', D, packer, rod 'thru' | 'u' | 'none', fullcap, stiff (75x10FL stiffener at piles), bracketLbl, labels
  function strElev(v, o) {
    const s = o.s, d = s.d, D = o.D || 350, yb = o.packer ? PACK : 0, yt = yb + HC, fc = !!o.fullcap;
    const yc = yt + (fc ? 0 : CORH), ys = yc + STRH, PX = [0, 1800], SX = [-650, 400, 1450], RX = fc ? [-900, -150, 700, 1200, 2050] : [-400, 130, 680, 1200, 2050];
    const x0 = -1100, x1 = 2300;
    // deck
    v.line(x0 - 50, ys, x1 - 100, ys, 'S-EXIST'); v.line(x0 - 50, ys + DECK, x1 - 100, ys + DECK, 'S-EXIST');
    v.brk(x0 - 50, ys - 20, x0 - 50, ys + DECK + 20); v.brk(x1 - 100, ys - 20, x1 - 100, ys + DECK + 20);
    // logs: corbels + stringers (or stringers only on a fullcap)
    SX.forEach(x => {
      if (!fc) { const w1 = logCut(v, x, yt, yc, LOGD); const w2 = logCut(v, x, yc, ys, LOGD); v.line(x - min(w1, w2), yc, x + min(w1, w2), yc, 'S-EXIST'); }
      else logCut(v, x, yt, ys, LOGD);
      if (!fc) { exBolt(v, x + 22, yt, ys); exBolt(v, x - 22, yb, yc, true); } else exBolt(v, x, yb, ys, true);
    });
    // halfcap (existing)
    v.line(x0, yt, x1, yt, 'S-EXIST'); v.line(x0, yb, x1, yb, 'S-EXIST'); v.brk(x0, yb - 20, x0, yt + 20); v.brk(x1, yb - 20, x1, yt + 20);
    // packers (RHS 100x50x5.0) centred on each rod
    if (o.packer) RX.forEach(x => v.rect(x - 220, 0, 440, PACK, 'S-NEW'));
    // PFC strengthening
    const xa = x0 - 100, xb = x1 + 100; pfcElevH(v, xa, xb, 0, s, 'S-NEW'); v.brk(xa, -d - 20, xa, 20); v.brk(xb, -d - 20, xb, 20);
    RX.forEach(x => { vRod(v, x, yt, yb, -s.tf); v.line(x, -d - 25, x, -d + 25, 'S-NEW'); });
    // piles
    const yP = -d - 1300;
    PX.forEach((px, i) => {
      if (o.pile === 'uc') {
        const u = SEC['200UC52'], yB = -d - u.d;
        iSec(v, px, -d - u.d / 2, u, 0, 'S-NEW');
        v.line(px - u.b / 2, yB, px - u.b / 2, yP, 'S-EXIST'); v.line(px + u.b / 2, yB, px + u.b / 2, yP, 'S-EXIST'); v.line(px, yB, px, yP, 'S-HIDDEN');
        v.brk(px - u.b / 2 - 20, yP, px + u.b / 2 + 20, yP);
        // existing pile + trimmed UC bracket behind the PFC, existing cleat on the halfcap
        v.line(px - u.b / 2, -d, px - u.b / 2, 0, 'S-EXIST'); v.line(px + u.b / 2, -d, px + u.b / 2, 0, 'S-EXIST');
        v.pl([[px - u.b / 2, -150], [px - 10, -150], [px - 10, -200], [px + 10, -200], [px + 10, -150], [px + u.b / 2, -150]], false, 'S-EXIST');
        v.rect(px - 10, yb + 20, 75, 260, 'S-EXIST'); [yb + 70, yb + 220].forEach(y => { v.circ(px + 28, y, 22, 'S-EXIST'); v.circ(px + 28, y, 11, 'S-EXIST'); });
        [-40, -250].forEach(y => { v.boltEnd(px + 25, y, 22); v.fill(circP(px + 25, y, 8, 12), 'S-BOLT'); });
        if (i === 0) v.dim(px + 340, -250, px + 340, -d, 3, '50', { sub: '(TYP)' });
      } else {
        v.line(px - D / 2, -d, px - D / 2, yP, 'S-EXIST'); v.line(px + D / 2, -d, px + D / 2, yP, 'S-EXIST'); v.pileEnd(px, yP, D);
        v.line(px, -d - 60, px, yP - 60, 'S-CL');
        // pile top hidden behind PFC / halfcap
        v.pl([[px - D / 2, -d], [px - D / 2, yt - 40], [px + D / 2, yt - 40], [px + D / 2, -d]], false, 'S-HIDDEN'); v.line(px, -d, px, yt + 20, 'S-CL');
        // shim / bearing plate, pile band, notch line
        v.fill([[px - 150, -d - 12], [px + 150, -d - 12], [px + 150, -d], [px - 150, -d]], 'S-NEW');
        v.rect(px - D / 2 - 8, -d - 160, D + 16, 50, 'S-EXIST');
        v.line(px + D / 2 - 25, -d - 12, px + D / 2 - 25, -d - 300, 'S-HIDDEN');
        if (o.rod === 'thru' || o.rod === 'u') { [-1, 1].forEach(k => { v.circ(px + k * D / 2, -d / 2 - 15, 20, 'S-BOLT'); v.fill(circP(px + k * D / 2, -d / 2 - 15, 9, 12), 'S-BOLT'); }); if (o.rod === 'u') { v.line(px - D / 2 + 20, -d / 2 - 5, px + D / 2 - 20, -d / 2 - 5, 'S-HIDDEN'); v.line(px - D / 2 + 20, -d / 2 - 25, px + D / 2 - 20, -d / 2 - 25, 'S-HIDDEN'); } }
        if (o.stiff) { v.fill([[px - D / 2 - 5, -d + s.tf], [px - D / 2 + 5, -d + s.tf], [px - D / 2 + 5, -s.tf], [px - D / 2 - 5, -s.tf]], 'S-NEW'); }
        if (i === 0) v.dim(px + D / 2 - 25, -d - 330, px + D / 2, -d - 330, 0, '25 NOTCH', { sub: o.typ2 || '(TYP)' });
        if (i === 1) v.dim(px - 150, -d - 330, px + 150, -d - 330, 0, '300', { sub: '(TYP)' });
      }
    });
    // section mark A, cut arrow
    if (fc) { v.mark(-180, ys + DECK + 330, 'A', 270); v.line(-180, ys + DECK + 270, -180, ys + DECK + 120, 'S-TITLE'); } else v.mark(-120, yc - 40, 'A', 0, 9);
    cutArrow(v, -330, -d - 300, 520, 1);
    return { d, yb, yt, yc, ys, PX, SX, RX, x0, x1, xa, xb, D, yP };
  }
  // the standard leader notes of the strengthening elevation
  function strElevLabels(v, g, o) {
    const cap = o.fullcap ? 'FULLCAP' : 'HALFCAP', lbl = o.lbl || {};
    const L = (k, ...a) => { if (lbl[k] !== false) v.leader(...a); };
    L('str', g.SX[0] + 120, g.ys - 120, 10, 22, 'EXISTING TIMBER\nSTRINGER (TYP)', { dot: true });
    L('deck', 900, g.ys + DECK, 14, 20, 'EXISTING TIMBER\nDECKING');
    if (!o.fullcap) L('cor', g.SX[0] - 220, g.yt + 120, -16, 12, 'EXISTING TIMBER\nCORBEL (TYP)');
    L('hc', g.x0 + 60, g.yt, -14, 6, 'EXISTING TIMBER\n' + cap);
    L('pfc', g.x0 + 150, -g.d, -12, -14, 'PROPOSED ' + o.pl + ' PFC\n' + cap + '\nSTRENGTHENING');
    L('rod', g.RX[4], g.yt + 6, 10, 24, o.packer ? 'φ20 THREADED RODS\nAT 900 CRS MAXIMUM\n(A MINIMUM OF 1 - φ20\nROD PER PACKER) WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP)' : 'φ20 THREADED RODS\nAT 900 CRS MAXIMUM\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP)');
    L('rec', g.SX[2] - 22, g.yb + 10, -6, -50, 'RECESS EXISTING TIMBER ' + cap + ' AND\nSHORTEN EXISTING BOLT TO CLEAR\nPROPOSED ' + cap + ' STRENGTHENING.\nPROVIDE NEW 65x5FLx65 WASHER\nAND TIGHTEN BOLT. (TYP)');
    if (o.packer) L('pk', 950, PACK / 2, -14, -40, '100x50x5.0 RHS STEEL\nPACKER (TYP)');
    if (o.pile === 'uc') { L('pile', g.PX[1] + 102, g.yP + 400, 14, 0, 'EXISTING UC\nPILE (TYP)'); if (o.bracketLbl) L('brk', g.PX[1] + 102, -g.d - 60, 14, 0, 'UC SUPPORT BRACKET\n(TYP)'); }
    else {
      L('pile', g.PX[1] + g.D / 2, g.yP + 300, 14, 0, 'EXISTING TIMBER\nPILE (TYP)');
      if (lbl.shim !== false) { const x = g.PX[1] + 150, y = -g.d - 6; v.leader(x, y, 14, -14, 'SHIM PLATES'); vbox(v, x + 16.5 * v.s, y - 16.6 * v.s, 'BEARING PLATES FOR HALFCAPS WITH BEARING < 70', 36); }
    }
  }

  // ------------------------------------------------------------------ section A through the halfcaps (1:20)
  // o: s, pile 'uc' | 'timber', D, packer, both (PFC both sides), rod 'thru' | 'u', abut (fullcap against sheeting)
  function strSecA(v, o) {
    const s = o.s, d = s.d, D = o.D || 350, yb = o.packer ? PACK : 0, yt = yb + HC, uc = o.pile === 'uc', ab = !!o.abut;
    const g = uc ? 80 : (ab ? 40 : 75), wx = uc ? 102 : g - 5, rx = wx + rodOff(o.pfcKey), yP = -d - 950;
    const sides = ab ? [1] : [-1, 1];
    // halfcaps
    sides.forEach(k => timberX(v, k > 0 ? g : -g - HW, yb, HW, HC));
    if (ab) { // abutment: fullcap only on the pile, sheeting behind, decking + stringer over
      const xs = -D / 2 - 30;
      v.line(xs, yt + 420, xs, yP + 250, 'S-EXIST'); v.line(xs - 40, yt + 420, xs - 40, yP + 250, 'S-EXIST');
      for (let y = yt + 300; y > yP + 300; y -= 260) v.line(xs, y, xs + 60, y, 'S-EXIST');
      v.hatch([[xs - 40, yt + 420], [xs - 100, yt + 420], [xs - 100, yP + 400], [xs - 40, yP + 400]], 'ansi31');
      v.brk(xs - 60, yP + 250, xs + 20, yP + 250);
      v.line(xs, yt + 400, 1100, yt + 400, 'S-EXIST'); v.line(xs, yt + 400 + DECK, 1100, yt + 400 + DECK, 'S-EXIST'); v.line(xs - 40, yt + 400 + DECK, xs, yt + 400 + DECK, 'S-EXIST');
      for (let x = xs + 180; x < 1100; x += 200) v.line(x, yt + 400, x, yt + 400 + DECK, 'S-EXIST');
      v.brk(1100, yt + 380, 1100, yt + 400 + DECK + 20);
      v.line(xs, yt, 900, yt, 'S-EXIST'); v.pileEnd(900, yt + 200, 400, 'S-EXIST', 1); v.line(xs, yt + 400, xs, yt, 'S-EXIST');
    }
    // pile
    if (uc) {
      v.line(-102, yb, -102, yP, 'S-EXIST'); v.line(102, yb, 102, yP, 'S-EXIST'); v.brk(-130, yP, 130, yP);
      // existing UC bracket (trimmed) under the halfcaps, existing through bolts
      v.pl([[-g - HW + 20, yb], [-g - HW + 20, yb - 180], [-g - HW + 40, yb - 180]], false, 'S-EXIST'); v.line(-g - HW + 20, yb - 15, g + HW - 20, yb - 15, 'S-EXIST'); v.line(-g - HW + 20, yb - 180, 102, yb - 180, 'S-EXIST');
      [yb + 75, yt - 75].forEach(y => { v.line(-g - HW - 25, y, g + HW + 25, y, 'S-EXIST'); [-g - HW - 10, -g + 10, g - 10, g + HW + 10].forEach(x => v.rect(x - 8, y - 22, 16, 44, 'S-EXIST')); });
    } else {
      v.line(-D / 2, -d - 40, -D / 2, yP, 'S-EXIST'); v.line(D / 2, -d - 40, D / 2, yP, 'S-EXIST'); v.pileEnd(0, yP, D);
      if (o.both) v.line(-D / 2, -d - 40, -wx - s.b, -d - 40, 'S-EXIST'); v.line(D / 2, -d - 40, wx + s.b, -d - 40, 'S-EXIST');
      if (!o.both) v.line(-D / 2, -d - 40, -D / 2, yb, 'S-EXIST');
      v.line(-g, yb, -g, yt, 'S-EXIST'); v.line(g, yb, g, yt, 'S-EXIST'); if (!ab) v.line(-g, yt, g, yt, 'S-EXIST');
      v.line(0, yt + 60, 0, yP - 80, 'S-CL');
      v.rect(-D / 2 - 10, -d - 150, D + 20, 45, 'S-EXIST'); // pile band
      if (!ab) [-1, 1].forEach(k => { v.line(k * D / 2, -d - 40, k * D / 2, -d - 40); });
    }
    // PFCs (cut, solid) + packers + rods
    const pfcs = uc ? [1] : (o.both ? [-1, 1] : [1]);
    pfcs.forEach(k => {
      const pts = [[0, -d], [s.b, -d], [s.b, -d + s.tf], [s.tw, -d + s.tf], [s.tw, -s.tf], [s.b, -s.tf], [s.b, 0], [0, 0]].map(p => [k * (wx + p[0]), p[1]]);
      v.pl(pts, true, 'S-NEW'); v.fill(pts.slice(0, 4), 'S-NEW'); v.fill([pts[0], pts[3], pts[4], pts[7]], 'S-NEW'); v.fill(pts.slice(4, 8), 'S-NEW');
      if (o.packer) { rhsSec(v, k * (wx + 50), PACK / 2, 100, 50, 5, 'S-NEW'); }
      const x = k * rx; v.line(x, yt + 40, x, -s.tf - 40, 'S-BOLT'); v.fill([[x - 32, yt], [x + 32, yt], [x + 32, yt + 6], [x - 32, yt + 6]], 'S-BOLT'); v.rect(x - 16, yt + 6, 32, 18, 'S-BOLT'); v.rect(x - 16, -s.tf - 18, 32, 18, 'S-BOLT');
    });
    if (!uc) {
      const yr = -d / 2;
      if (o.rod === 'thru') { const xl = pfcs.length > 1 ? -wx - s.tw : -D / 2 - 40; v.line(xl - 40, yr, wx + s.tw + 40, yr, 'S-BOLT'); v.line(xl - 40, yr + 10, wx + s.tw + 40, yr + 10, 'S-BOLT'); v.rect(wx + s.tw, yr - 20, 18, 50, 'S-BOLT'); if (pfcs.length > 1) v.rect(-wx - s.tw - 18, yr - 20, 18, 50, 'S-BOLT'); }
      if (o.rod === 'u') { v.line(-D / 2 - 30, yr, wx + s.tw + 40, yr, 'S-BOLT'); v.line(-D / 2 - 30, yr + 10, wx + s.tw + 40, yr + 10, 'S-BOLT'); v.rect(wx + s.tw, yr - 20, 18, 50, 'S-BOLT'); }
    } else {
      // support bracket 200 UC 52 x 100 long welded to the pile; M20 bolts PFC to trimmed bracket
      v.rect(102, -d - 206, 100, 206, 'S-NEW'); v.line(102 + 12, -d - 206, 102 + 12, -d, 'S-NEW'); v.fill(circP(150, -d - 110, 10, 10), 'S-NEW');
      [-30, -d + 30].forEach(y => { v.rect(70, y - 18, 32, 36, 'S-BOLT'); v.line(60, y, 102 + s.tw + 20, y, 'S-BOLT'); });
    }
    return { d, yb, yt, g, wx, rx, yP, D };
  }
  function secALabels(v, g, o) {
    const cap = o.abut ? 'FULLCAP' : 'HALFCAP';
    v.dim(g.g, g.yt + 260, g.rx, g.yt + 260, 0, (o.min50 || ['50'])[0], { sub: (o.min50 || ['', 'MIN'])[1] });
    if (o.det1) { v.circ(g.wx + 60, -g.d / 2, 240, 'S-TEXT'); const c = v.P(g.wx + 60 + 240 * 0.7, -g.d / 2 - 240 * 0.7), m = [c[0] + 7, c[1] - 7]; v.add({ t: 'line', a: c, b: [m[0] - 2.1, m[1] + 2.1], L: 'S-TEXT' }); v.add({ t: 'circle', c: m, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p: m, s: '1', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
    v.line(g.g, g.yt + 280, g.g, g.yt, 'S-DIM'); v.line(g.rx, g.yt + 280, g.rx, g.yt + 40, 'S-DIM');
    // boxed 55 dim between PFC web and rod + dashed note box
    const yy = g.yt - 50; v.dim(g.wx, yy, g.rx, yy, 0, ' '); const p = v.P(g.rx, yy); boxTxt(v, p[0] + 4, p[1] - 1, String(rodOff(o.pfcKey)));
    v.add({ t: 'line', a: [p[0] + 9, p[1]], b: [p[0] + 15, p[1]], L: 'S-TEXT' }); v.arrow(g.rx + 8.5 * v.s, yy, 180);
    v.noteBox(g.rx + 15 * v.s, yy + 2.5 * v.s, '55 - 300 PFC\n60 - 380 PFC', 25);
    v.leader(g.rx, g.yt + 24, o.abut ? 22 : 16, o.abut ? 32 : 20, o.rodLbl || 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE');
    if (!o.abut) v.leader(-g.g - HW / 2 - 40, g.yt - 40, -14, 16, 'EXISTING TIMBER\n' + cap + ' (TYP)');
  }

  // ------------------------------------------------------------------ DETAIL 1 (1:10): PFC on the trimmed timber pile
  function det1(v, o) {
    const s = o.s, d = s.d, b = s.b, tf = s.tf, tw = s.tw, yb = o.packer ? PACK : 0, cap = o.fullcap ? 'FULLCAP' : 'HALFCAP';
    // pile (existing) — irregular break outline on the left, trimmed face at the PFC, 70 min bearing under the flange
    v.pl([[90, yb + 230], [-30, yb + 230], [-120, yb + 150], [-170, 0], [-185, -120], [-150, -230], [-170, -300], [-120, -d - 30], [-30, -d - 70], [70, -d - 70], [70, -d - 12]], false, 'S-EXIST');
    v.line(0, -d, 0, yb, 'S-EXIST');
    // halfcap (existing) above
    v.pl([[-40, yb + 230], [-40, yb], [170, yb], [170, yb + 230]], false, 'S-EXIST'); v.line(-40, yb, 60, yb + 230, 'S-EXIST'); v.line(170, yb, 70, yb + 230, 'S-EXIST');
    // PFC (cut, hatched)
    const pts = [[0, -d], [b, -d], [b, -d + tf], [tw, -d + tf], [tw, -tf], [b, -tf], [b, 0], [0, 0]];
    v.pl(pts, true, 'S-NEW'); v.hatch(pts, 'ansi31');
    if (o.packer) { v.rect(-5, 0, 100, PACK, 'S-NEW'); v.rect(0, 5, 90, PACK - 10, 'S-NEW'); }
    // vertical threaded rod + nut, lag through web
    const rx = rodOff(o.pfcKey); v.line(rx, yb + 200, rx, -tf - 35, 'S-BOLT'); v.line(rx - 10, yb, rx - 10, yb + 200, 'S-HIDDEN'); v.line(rx + 10, yb, rx + 10, yb + 200, 'S-HIDDEN'); v.rect(rx - 17, -tf - 20, 34, 20, 'S-BOLT');
    const yr = -d / 2 + 20; v.line(-130, yr - 10, tw + 25, yr - 10, 'S-BOLT'); v.line(-130, yr + 10, tw + 25, yr + 10, 'S-BOLT'); v.rect(tw, yr - 25, 10, 50, 'S-BOLT'); v.rect(tw + 10, yr - 16, 18, 32, 'S-BOLT');
    // shim
    v.fill([[0, -d - 12], [130, -d - 12], [130, -d], [0, -d]], 'S-NEW');
    // dims
    v.dim(0, -d - 160, 70, -d - 160, 0, '', {}); const pd = v.P(0, -d - 160);
    v.add({ t: 'line', a: [pd[0] - 26, pd[1] + 2.2], b: [pd[0] - 1, pd[1] + 2.2], L: 'S-DIM' });
    boxTxt(v, pd[0] - 25, pd[1] + 3, '70'); v.add({ t: 'text', p: [pd[0] - 18.5, pd[1] + 3], s: 'MINIMUM BEARING', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
    v.line(200, -d - 6, 320, -d - 6, 'S-DIM'); v.dim(300, -d - 12, 300, -d, 0, ' ');
    // leaders
    v.leader(-110, -60, -8, 8, 'EXISTING\nTIMBER PILE', { dot: true });
    if (o.packer) v.weld(95, yb - 5, 16, 6, { size: '6', len: '50-300', both: true });
    v.weld(b + 2, -d + 4, 12, 18, { size: '4', site: true });
    v.leader(310, -d - 6, 4, 10, '130x(6,8,10 OR 12FL)x300 LONG\nGALV STEEL SHIM IF REQUIRED.\nTACK WELD STEEL SHIMS\nTOGETHER AFTER PLACEMENT.\nMAKE GOOD GALV. SURFACE\nBY APPLYING COLD GALV', { noArrow: true });
    v.leader(70, -d - 30, 14, -12, 'TRIM EXISTING TIMBER PILE\nTO SUIT PROPOSED ' + o.pl + ' PFC.');
    vbox(v, -30 - 45 * v.s, -d - 205, 'IF BEARING IS <70 THEN REFER TO "' + cap + ' OR FULLCAP TO PILE BEARING DETAILS" ON DRG N° XX30-XXX', 46);
  }
  // the DETAIL 1 view titled with its PFC box
  function det1View(LY, o) { const v = LY.view(10); det1(v, o); ttlIn(v, ['DETAIL 1'], 10, o.pl + ' PFC'); }
  // view title(s) drawn inside the view's own builder (so a boxed PFC size can sit under it)
  function ttlIn(v, lines, scale, boxS) {
    const bb = bbox(v.B.E), x = (bb.x0 + bb.x1) / 2; let y = bb.y0 - 8;
    lines.forEach((l, i) => { v.B.title(x, y, l, i === lines.length - 1 ? scale : null); y -= 5.6; });
    y -= scale ? 1.5 : -2; if (boxS) v.B.noteBox(x - 11, y, boxS, 22, { h: 2.8 });
  }

  // ------------------------------------------------------------------ typical steel packer to PFC welding detail (1:10)
  function packWeld(v, k) {
    const s = PF(k), d = s.d, b = s.b, tf = s.tf, tw = s.tw, pts = [[0, -d], [b, -d], [b, -d + tf], [tw, -d + tf], [tw, -tf], [b, -tf], [b, 0], [0, 0]];
    v.pl(pts, true, 'S-NEW'); v.hatch(pts, 'ansi31');
    v.rect(-5, 0, 100, 50, 'S-NEW'); v.rect(0, 5, 90, 40, 'S-NEW'); v.fill([[-5, 0], [-5, -8], [3, 0]], 'S-NEW'); v.fill([[95, 0], [b, -8], [b, 0]], 'S-NEW');
    v.leader(-5, 30, -14, 6, '100x50x5.0 RHS\nSTEEL PACKER');
    v.leader(0, -d * 0.6, -14, -2, pfcLbl(k) + ' PFC');
    v.weld(95, 2, 14, -4, { size: '6', len: '50-300', both: true });
  }

  // ------------------------------------------------------------------ note texts
  const N_VARY = (cap) => 'NOTE: ' + cap + ' STRENGTHENING CHANNELS WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS.\n300 PFC ' + cap + ' DRAWN. THIS DETAIL IS ONLY TO BE USED WHERE THERE IS NO SIGNIFICANT PERMANENT BOWING OR CRUSHING IN THE UNDERSIDE OF THE EXISTING TIMBER ' + cap + '. (ENGINEER TO DETERMINE)';
  const N_PROP = (pl) => 'NOTE: PROP STRINGERS & CORBELS PRIOR TO INSTALLING ' + pl + ' STRENGTHENING. INSTALL ' + pl + ' STRENGTHENING BY JACKING AGAINST TIMBER HALFCAP TO REMOVE ALL BOWS, DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT TO THE EXISTING TIMBER HALFCAP.';
  const N_MORE = (cap, ref) => 'NOTE: IF ' + cap + ' CHANNEL IS SUPPORTED BY MORE THAN 2 PILES THEN DRG REQUIRES BOXED NOTE & PILE BEARING DETAILS ' + (ref || 'PN30-2328 &/OR 2329');
  const N_ENG = 'ENGINEER TO DETERMINE IF 70 MINIMUM BEARING GIVES SUFFICIENT BEARING AREA FOR PILE DIAMETERS AND LOADINGS';
  const N_BANDS = (cap) => 'NOTE: RELOCATE EXISTING PILE BANDS AS REQUIRED TO SUIT PROPOSED ' + cap + ' REPAIRS';
  const N_DRG = 'DRG NUMBER - REFER TO PLAN DRAWING';
  // pre-wrap note text with a realistic glyph width (the core wraps a little optimistically) then draw the box
  function wrap(s, w, h) { const out = []; String(s).split('\n').forEach(par => { let cur = ''; par.split(' ').forEach(wd => { if ((cur + ' ' + wd).length * (h || TH) * 0.72 > w - 5 && cur) { out.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; }); out.push(cur); }); return out.join('\n'); }
  const nbox = (LY, s, w, solid) => LY.block(B => B.noteBox(0, 0, wrap(s, w), w, solid ? { solid: true } : {}));
  const vbox = (v, x, y, s, w, opt) => v.noteBox(x, y, wrap(s, w, opt && opt.h), w, opt);
  // titles: the core estimates glyph width at 0.64 h; the drawn font is wider — stretch underlines and push the
  // lettered circle / drawing ref to the right so nothing overlaps
  function fixTitles(E) { return E; // core titles now measure text correctly
    E.filter(e => e.t === 'text' && e.L === 'S-TITLE' && e.al === 'l').forEach(t => {
      const est = t.s.length * t.h * 0.7, real = t.s.length * t.h * 0.73, dd = real - est;
      if (dd <= 0) return; const x0 = t.p[0], y0 = t.p[1], xe = x0 + est;
      E.forEach(e => {
        if (e === t) return;
        if (e.t === 'line' && e.L === 'S-TITLE' && abs(e.a[0] - x0) < 0.01 && abs(e.a[1] - e.b[1]) < 0.01 && e.a[1] < y0 && e.a[1] > y0 - 1.5) { e.b = [e.b[0] + dd, e.b[1]]; return; }
        const q = e.c || e.p; if (!q || Array.isArray(q[0])) return;
        if (q[0] > xe - 0.5 && q[0] < xe + 60 && abs(q[1] - y0) < 4.5 && (e.t === 'circle' || e.t === 'text')) { if (e.c) e.c = [e.c[0] + dd, e.c[1]]; else e.p = [e.p[0] + dd, e.p[1]]; }
      });
    });
    return E;
  }

  const pfcP = () => P('pfc', 'PFC strengthening', '300PFC', { opts: ['300PFC', '380PFC'] });
  const dP = (v) => P('D', 'Pile dia. (mm)', v || 350, { num: 1 });

  // generic halfcap / fullcap strengthening sheet: detail 1 (380 + 300 PFC) or packer welding details, note boxes,
  // section A, elevation, notes, caption
  function strSheet(p, o) {
    const s = PF(p.pfc), D = +p.D || 350, pl = pfcLbl(p.pfc), cap = o.fullcap ? 'FULLCAP' : 'HALFCAP', base = Object.assign({ s, D, pl, pfcKey: p.pfc }, o);
    const LY = new Lay(760);
    if (o.det1) {
      ['380PFC', '300PFC'].forEach(k => det1View(LY, Object.assign({}, base, { s: PF(k), pl: pfcLbl(k), pfcKey: k })));
      nbox(LY, N_MORE(cap, o.moreRef), 50); nbox(LY, N_ENG, 50);
    }
    if (o.packW) ['300PFC', '380PFC'].forEach(k => { const a = LY.view(10); packWeld(a, k); ttlIn(a, ['TYPICAL STEEL PACKER', 'TO PFC WELDING DETAIL'], null, pfcLbl(k) + ' PFC'); });
    if (o.det1 || o.packW) LY.break();
    nbox(LY, N_VARY(cap), 76);
    if (o.det1 || o.bands) nbox(LY, N_BANDS(cap), 56, true);
    if (o.pre) o.pre(LY, base, p);
    LY.break();
    const a = LY.view(20), ga = strSecA(a, base); secALabels(a, ga, base); (o.secLbl || (() => 0))(a, ga, base);
    LY.title('SECTION A', 20);
    if (o.preElev) o.preElev(LY, base, p);
    const e = LY.view(20), ge = strElev(e, base); strElevLabels(e, ge, base); (o.elevLbl || (() => 0))(e, ge, base);
    LY.title('ELEVATION');
    nbox(LY, o.propNote || N_PROP(o.plural ? 'HALFCAPS' : 'HALFCAP'), 78, true);
    nbox(LY, N_DRG, 42);
    LY.caption(o.title || 'PIER HALFCAP STRENGTHENING DETAIL', 20, o.sub || 'PIER N° X', { ref: 'XX30-XXXX' });
    return fixTitles(LY.done());
  }

  // ================================================================== PN30-2306: at existing UC piles
  def('pn2306', 'Halfcaps', 'Pier halfcap strengthening – at existing UC piles', 'PN30-2306', [pfcP()], (p) => strSheet(p, {
    pile: 'uc', min50: ['50', 'MIN'], rodLbl: 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE. (TYP)',
    secLbl: (v, g) => {
      v.leader(102, -g.d / 2 - 20, -22, 14, 'TRIM EXISTING UC\nBRACKET TO FACE\nOF EXISTING UC PILE');
      v.leader(70, -g.d + 30, -22, 0, 'M20 BOLTS');
      v.leader(150, -g.d - 110, -26, -10, 'SUPPORT BRACKET\n200 UC 52 x 100 LONG', { dot: true });
      v.leader(-102, g.yP + 250, -16, 0, 'EXISTING UC PILE');
      v.leader(g.wx + 60, -5, 18, -2, 'PROPOSED PFC HALFCAP\nSTRENGTHENING');
      ucWelds(v, g);
    }
  }), 'Strengthen a pier timber halfcap on existing UC piles with a PFC on 200 UC 52 support brackets, where there is no significant permanent bowing or crushing of the halfcap.');
  function ucWelds(v, g) { v.weld(150, -g.d + 2, 16, -12, { site: true, tail: 'TYP' }); v.weld(102, -g.d - 60, 16, -18, { size: '6', both: true, site: true, tail: 'TYP' }); v.weld(102, -g.d - 200, 16, -24, { site: true, tail: 'TYP', other: true }); }

  // ================================================================== PN30-2307: timber piles, RHS packer, rod through pile
  def('pn2307', 'Halfcaps', 'Pier halfcaps strengthening – RHS packer, threaded rod through pile', 'PN30-2307', [pfcP(), dP()], (p) => strSheet(p, {
    pile: 'timber', packer: true, both: true, rod: 'thru', det1: true, bands: true, plural: true, min50: ['50 MIN', 'TYP'], title: 'PIER HALFCAPS STRENGTHENING DETAIL',
    secLbl: (v, g) => {
      v.leader(-g.wx - 50, PACK / 2, -18, -4, 'RHS STEEL\nPACKER\nTYP');
      v.leader(-g.wx - 30, -g.d / 2, -18, -8, 'THREADED ROD');
      v.leader(-g.D / 2, g.yP + 300, -16, 0, 'EXISTING TIMBER\nPILE');
      v.leader(g.wx + 20, -g.d / 2 - 60, 22, 8, 'PROPOSED PFC HALFCAP\nSTRENGTHENING (TYP)');
    }
  }), 'Strengthen a pier timber halfcap on timber piles with PFCs and 100x50 RHS packers, rods through the halfcap and through the pile, where there is no significant permanent bowing or crushing.');

  // ================================================================== PN30-2308: timber piles, RHS packer, 'U' rod round pile
  def('pn2308', 'Halfcaps', "Pier halfcap strengthening – RHS packer, 'U' threaded rod", 'PN30-2308', [pfcP(), dP()], (p) => strSheet(p, {
    pile: 'timber', packer: true, both: false, rod: 'u', det1: true, bands: true, min50: ['50 MIN', 'TYP'], moreRef: 'PN30-2328',
    secLbl: (v, g) => {
      v.leader(g.wx + 50, PACK / 2, 16, -4, 'RHS STEEL\nPACKER');
      v.leader(-g.D / 2 - 20, -g.d / 2, -16, -6, "'U'-THREADED\nROD");
      v.leader(-g.D / 2, g.yP + 300, -16, 0, 'EXISTING TIMBER\nPILE');
      v.leader(g.wx + 20, -g.d + 40, 22, -4, 'PROPOSED PFC HALFCAP\nSTRENGTHENING (TYP)');
    }
  }), "Strengthen a pier timber halfcap on timber piles with a PFC and RHS packers fixed with a 'U' threaded rod round the pile, where there is no significant permanent bowing or crushing.");

  // ================================================================== PN30-2309 / 2310: existing UC piles with RHS packer
  const ucPackSec = (v, g) => {
    v.leader(102, -g.d / 2 - 20, -22, 14, 'TRIM EXISTING UC\nBRACKET TO FACE\nOF EXISTING UC PILE\n(TYP)');
    v.leader(70, -g.d + 30, -22, 0, 'M20 BOLTS (TYP)');
    v.leader(150, -g.d - 110, -26, -10, 'SUPPORT BRACKET\n200 UC 52 x 100 LONG\n(TYP)', { dot: true });
    v.leader(-102, g.yP + 250, -16, 0, 'EXISTING UC PILE');
    v.leader(g.wx + 50, PACK / 2, 18, -1, 'RHS STEEL PACKER (TYP)');
    v.leader(g.wx + 60, -10, 18, -7, 'PROPOSED PFC\nSTRENGTHENING (TYP)');
    ucWelds(v, g);
  };
  def('pn2309', 'Halfcaps', 'Pier halfcaps strengthening – at existing UC piles, RHS packer', 'PN30-2309', [pfcP()], (p) => strSheet(p, {
    pile: 'uc', packer: true, packW: true, bracketLbl: true, plural: true, title: 'PIER HALFCAPS STRENGTHENING DETAIL', rodLbl: 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE. (TYP)', secLbl: ucPackSec
  }), 'Strengthen a pier timber halfcap on existing UC piles with a PFC on 200 UC 52 support brackets and 100x50 RHS steel packers, where there is no significant permanent bowing or crushing.');
  def('pn2310', 'Halfcaps', 'Pier halfcap strengthening – at existing UC piles, abutment side', 'PN30-2310', [pfcP()], (p) => strSheet(p, {
    pile: 'uc', packer: true, packW: true, bracketLbl: true, rodLbl: 'THREADED ROD WITH\n65x5FLx65 WASHER\nTO TIMBER FACE. (TYP)', secLbl: ucPackSec, sub: 'PIER N° X - ABUTMENT N° X SIDE',
    propNote: 'NOTE: INSTALL HALFCAPS STRENGTHENING BY JACKING AGAINST TIMBER HALFCAP AND PACKER TO REMOVE ALL BOWS, DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT TO THE EXISTING TIMBER HALFCAP.'
  }), 'Strengthen the abutment-side pier timber halfcap on existing UC piles with a PFC, UC support brackets and RHS packers, jacked against the halfcap and packer.');

  // ================================================================== PN30-2311 / 2312: strengthening & widening (stub column)
  // widening fragment: PFC extension with 250 UC 73 stub column, cap plate, proposed corbel and stringer (1:20)
  function widenFrag(v, o) {
    const s = o.s, d = s.d, c = SEC[o.cor] || SEC['310UB46'], u = SEC[o.ub] || SEC['410UB54'], uc = SEC['250UC73'], H = 420;
    pfcElevH(v, -350, 450, 0, s, 'S-NEW'); v.brk(450, -d - 20, 450, 20);
    v.rect(-uc.b / 2 + 40, 0, uc.b - 80, H, 'S-NEW'); v.line(0, -d, 0, H, 'S-HIDDEN');
    v.rect(-150, H, 300, 12, 'S-NEW');
    const yc = H + 12 + c.d / 2; v.rect(-c.b / 4, H + 12, c.b / 2, c.d, 'S-NEW'); v.line(0, H + 12, 0, H + 12 + c.d, 'S-HIDDEN');
    [-45, 45].forEach(x => { [H + 12 + 20, H + 12 + c.d - 20].forEach(y => { v.fill(circP(x, y, 16, 12), 'S-BOLT'); v.line(x, y - 40, x, y + 40, 'S-BOLT'); }); });
    const yt = H + 12 + c.d; v.line(0, yt, 0, yt + u.d - 15, 'S-NEW'); v.fill([[-u.b / 2, yt + u.d - 15], [u.b / 2, yt + u.d - 15], [u.b / 2, yt + u.d], [-u.b / 2, yt + u.d]], 'S-NEW');
    v.mark(-600, H - 120, 'B', 0);
    v.leader(-20, yt + u.d - 120, -18, 6, 'PROPOSED\nSTRINGER');
    v.leader(-c.b / 4, yc, -20, 6, 'PROPOSED\nCORBEL');
    v.leader(-150, H + 6, -16, 4, 'CAP PLATE');
    v.leaders([[-uc.b / 2 + 40, H * 0.5], [0, -d / 2]], -24, -18, '250 UC 73\nSTUB COLUMN\nLENGTH TO SUIT');
    return { d };
  }
  function widenViewB(v, o) {
    const s = o.s, d = s.d, c = SEC[o.cor] || SEC['310UB46'], u = SEC[o.ub] || SEC['410UB54'], H = 380, yc0 = H + 12, yu0 = yc0 + c.d;
    [-1, 1].forEach(k => { const pts = [[0, -d], [s.b, -d], [s.b, -d + s.tf], [s.tw, -d + s.tf], [s.tw, -s.tf], [s.b, -s.tf], [s.b, 0], [0, 0]].map(q => [k * (127 + q[0]), q[1]]); v.pl(pts, true, 'S-NEW'); });
    v.line(-127, 0, -127, H, 'S-NEW'); v.line(127, 0, 127, H, 'S-NEW'); v.line(-127 + 14, 0, -127 + 14, H, 'S-NEW'); v.line(127 - 14, 0, 127 - 14, H, 'S-NEW'); v.line(0, -d, 0, H, 'S-HIDDEN');
    v.rect(-150, H, 300, 12, 'S-NEW');
    iElevWebH(v, -520, 520, yc0 + c.d / 2, c, 'S-NEW'); v.line(-60, yc0, -60, yu0, 'S-NEW'); v.line(60, yc0, 60, yu0, 'S-NEW');
    iElevWebH(v, -760, -10, yu0 + u.d / 2, u, 'S-NEW'); iElevWebH(v, 10, 760, yu0 + u.d / 2, u, 'S-NEW'); v.brk(-760, yu0 - 20, -760, yu0 + u.d + 20); v.brk(760, yu0 - 20, 760, yu0 + u.d + 20);
    [-470, -60, 60, 470].forEach(x => { v.fill(circP(x, yu0, 18, 12), 'S-BOLT'); v.line(x, yu0 - 40, x, yu0 + 40, 'S-BOLT'); });
    [-40, 40].forEach(x => { v.fill(circP(x, yc0, 18, 12), 'S-BOLT'); v.line(x, yc0 - 40, x, yc0 + 40, 'S-BOLT'); });
    v.cl(0, -d - 80, 0, yu0 + u.d + 380, 'PIER');
    v.dim(0, yu0 + u.d + 150, 10, yu0 + u.d + 150, 0, '10', { sub: '(TYP)' });
    v.dim(-520, yu0 + 120, -470, yu0 + 120, 0, '50', { sub: '(TYP)' }); v.dim(10, yu0 + 120, 60, yu0 + 120, 0, '50', { sub: '(TYP)' });
    v.leader(400, yu0 + u.d, 14, 12, 'PROPOSED\nSTRINGER');
    v.leader(520, yc0 + c.d / 2, 16, 0, 'PROPOSED\nCORBEL');
    v.leader(-470, yu0, -22, -10, 'M20 8.8S BOLTS\n(TYP)');
    v.leader(150, H + 6, 18, -8, '300x12FLx300 LONG\nCAP PLATE');
    v.leader(127, H * 0.45, 18, -6, 'STUB COLUMN');
    v.weld(-150, H + 2, -10, -8, { size: '6', all: true });
    v.weld(-127, -40, -14, -14, { size: '6', all: true, site: true, tail: 'TYP' });
  }
  const widenP = () => [pfcP(), P('ub', 'Proposed stringer', '410UB54', { opts: UBs }), P('cor', 'Proposed corbel', '310UB46', { opts: ['310UB46', '310UC97'] }), P('ext', 'Widening beyond last pile (mm)', 900, { num: 1 }), dP()];
  const widenOpt = (packer) => ({
    pile: 'timber', packer, both: true, rod: 'thru', det1: true, bands: true, plural: true, stiff: true, min50: ['50 MIN', '(TYP)'], title: 'PIER HALFCAPS STRENGTHENING & WIDENING DETAIL', typ2: '(TYP)',
    pre: (LY, b, p) => { const w = LY.view(20); widenViewB(w, Object.assign({}, b, { ub: p.ub, cor: p.cor })); LY.title('VIEW B', 20); },
    preElev: (LY, b, p) => { const w = LY.view(20); widenFrag(w, Object.assign({}, b, { ub: p.ub, cor: p.cor })); },
    secLbl: (v, g) => {
      if (packer) v.leader(-g.wx - 50, PACK / 2, -18, -4, 'RHS STEEL\nPACKER\nTYP');
      v.leader(-g.wx - 50, -g.d / 2 - 60, -18, -6, 'PROPOSED PFC\nHALFCAP\nSTRENGTHENING' + (packer ? '\nTYP' : ''));
      v.leader(-g.wx - 30, -g.d / 2, -18, -30, 'THREADED ROD');
      v.leader(g.D / 2, g.yP + 300, 16, 0, 'EXISTING TIMBER\nPILE');
    },
    elevLbl: (v, g) => { v.leader(g.PX[0] - g.D / 2, -g.d / 2, -14, -22, '75x10FL\nSTIFFENER'); v.weld(g.PX[0] - g.D / 2, -g.d + 30, -10, -6, { size: '6', all: true }); }
  });
  def('phw', 'Halfcaps', 'Pier halfcaps strengthening & widening (stub column)', 'PN30-2311', widenP(), (p) => strSheet(p, widenOpt(false)), 'Strengthen pier timber halfcaps with PFCs and widen the pier with a 250 UC 73 stub column, cap plate, steel corbel and steel stringer on the PFC.');
  def('pn2312', 'Halfcaps', 'Pier halfcaps strengthening & widening – RHS packer', 'PN30-2312', widenP(), (p) => strSheet(p, widenOpt(true)), 'As PN30-2311 with 100x50x5.0 RHS steel packers between the PFC and the halfcap (a minimum of one φ20 rod per packer).');

  // ================================================================== PN30-2317: abutment fullcap strengthening
  function secBplan(v, o) {
    const D = o.D || 350, s = o.s, r = D / 2, ys = r + 40, yw = -r + 25, yf = yw - s.b;
    v.line(-900, ys, 900, ys, 'S-EXIST'); v.line(-900, ys + 50, 900, ys + 50, 'S-EXIST'); v.brk(-900, ys - 20, -900, ys + 70); v.brk(900, ys - 20, 900, ys + 70);
    [[-850, -250], [250, 850]].forEach(([a, b]) => v.hatch([[a, ys + 50], [b, ys + 50], [b, ys + 110], [a, ys + 110]], 'ansi31'));
    v.arc(0, -r * 0.2, r, 200, 340, 'S-HIDDEN'); v.arc(0, -r * 0.2, r, 20, 160, 'S-EXIST');
    // 'U' rod
    const R = r + 20; v.arc(0, yw + 120, R, 0, 180, 'S-BOLT'); v.arc(0, yw + 120, R - 20, 0, 180, 'S-BOLT');
    [-1, 1].forEach(k => { v.line(k * R, yw + 120, k * R, yw - 30, 'S-BOLT'); v.line(k * (R - 20), yw + 120, k * (R - 20), yw - 30, 'S-BOLT'); v.rect(k * (R - 10) - 22, yw - 10, 44, 10, 'S-BOLT'); });
    // PFC (plan: web + toes), shim plates
    v.line(-900, yw, 900, yw, 'S-NEW'); v.line(-900, yw - s.tw, 900, yw - s.tw, 'S-HIDDEN'); v.line(-900, yf, 900, yf, 'S-NEW'); v.brk(-900, yf - 20, -900, yw + 20); v.brk(900, yf - 20, 900, yw + 20);
    v.rect(-150, yf, 300, 12, 'S-HIDDEN');
    v.leader(-60, ys, -18, 14, "'U' THREADED\nROD");
    v.leader(200, ys + 50, 10, 14, 'EXISTING TIMBER\nSHEETING');
    v.leader(-150, yf + 6, -14, -12, 'SHIM PLATES');
    v.leader(400, yf, 14, -12, 'PROPOSED ' + o.pl + ' PFC\nFULLCAP\nSTRENGTHENING');
  }
  def('pn2317', 'Halfcaps', 'Abutment fullcap strengthening (PFC, U-rod)', 'PN30-2317', [pfcP(), dP()], (p) => strSheet(p, {
    pile: 'timber', fullcap: true, abut: true, rod: 'u', det1: true, bands: true, min50: ['50 MIN', '(TYP)'],
    title: 'ABUTMENT FULLCAP STRENGTHENING DETAIL', sub: 'ABUTMENT N° X - PILE N° X\nABUTMENT N° X - PILE N° X',
    propNote: 'NOTE: PROP STRINGERS PRIOR TO INSTALLING FULLCAP STRENGTHENING. INSTALL FULLCAP STRENGTHENING BY JACKING AGAINST TIMBER FULLCAP TO REMOVE ALL BOWS, DEFLECTIONS AND PROVIDE CONTINUOUS SUPPORT TO THE EXISTING TIMBER FULLCAP.',
    pre: (LY, b) => { const w = LY.view(20); secBplan(w, b); LY.title('SECTION B', 20); },
    secLbl: (v, g) => {
      v.leader(g.g + 40, g.yb + 200, -30, 8, 'EXISTING TIMBER\nFULLCAP', { dot: true });
      v.leader(-g.D / 2 - 10, -g.d / 2 + 5, -20, 10, "φ20 'U' THREADED\nROD (TYP)");
      v.leader(g.D / 2, g.yP + 300, 16, 0, 'EXISTING TIMBER\nPILE');
      v.leader(g.wx + 20, -g.d / 2 - 40, 22, -4, 'PROPOSED PFC FULLCAP\nSTRENGTHENING');
    },
    elevLbl: (v, g) => { v.mark(g.xb + 300, -g.d / 2, 'B', 180); v.line(g.xb - 100, -g.d / 2, g.xb + 150, -g.d / 2, 'S-TITLE'); v.fill([[900, -g.d / 2], [1250, -g.d / 2], [1150, -g.d / 2 - 50]], 'S-TITLE'); }
  }), 'Strengthen an abutment timber fullcap with a PFC on the pile side (no PFC on the sheeting side) fixed with φ20 \'U\' threaded rods round the piles.');

  // ================================================================== PN30-2313 … 2316: steel pier pile / pier halfcaps replacement
  // stringer / corbel bracket (75x75x10 EA + 125x75x10 UA) — plan and elevation at 1:5, drawn in one view
  function bracketDet(v) {
    // PLAN (origin 0,300)
    const py = 330;
    v.rect(0, py, 200, 75, 'S-NEW'); v.line(-20, py + 37.5, 220, py + 37.5, 'S-CL'); [35, 165].forEach(x => v.circ(x, py + 37.5, 11, 'S-NEW'));
    v.rect(-8, py - 125, 100, 137.5, 'S-NEW'); v.line(5, py - 125, 5, py, 'S-HIDDEN'); v.line(80, py - 125, 80, py, 'S-HIDDEN');
    v.pl([[2, py - 87.5], [2, py - 37.5]], false, 'S-NEW'); v.arc(13, py - 37.5, 11, 0, 180, 'S-NEW'); v.arc(13, py - 87.5, 11, 180, 360, 'S-NEW'); v.line(24, py - 87.5, 24, py - 37.5, 'S-NEW'); v.line(-20, py - 62.5, 40, py - 62.5, 'S-CL');
    v.dim(-30, py + 37.5, -30, py + 12.5, 0, '25'); v.dim(-30, py - 87.5, -30, py - 37.5, 4, '50'); v.dim(-55, py - 125, -55, py + 12.5, 4, '100');
    v.dim(250, py, 250, py + 37.5, 0, '='); v.dim(250, py + 37.5, 250, py + 75, 0, '='); v.dim(300, py, 300, py + 75, 0, '75');
    v.leader(165, py + 37.5, 14, 14, 'φ22 HOLE (TYP)');
    v.leader(13, py - 75, 14, -12, 'φ22 x 50 LONG\nSLOTTED HOLE');
    const pp = v.P(100, py - 190); v.B.title(pp[0], pp[1], 'PLAN', null, null, { h: 2.4 });
    // ELEVATION (origin 0,0)
    v.line(-30, 0, 200, 0, 'S-NEW'); v.line(0, 10, 200, 10, 'S-NEW');
    v.pl([[45, 75], [180, 75], [200, 55], [200, 0]], false, 'S-NEW');
    v.pl([[-6, -2], [40, 80], [52, 74], [6, -2]], true, 'S-NEW'); v.pl([[45, 75], [140, 10], [128, 4], [40, 68]], false, 'S-NEW');
    [35, 165].forEach(x => { v.line(x - 11, 0, x - 11, 10, 'S-HIDDEN'); v.line(x + 11, 0, x + 11, 10, 'S-HIDDEN'); v.line(x, -12, x, 22, 'S-CL'); });
    v.dim(-30, 0, -30, -5, 0, '5'); v.dim(0, -30, 35, -30, 0, '35'); v.dim(35, -30, 165, -30, 0, '130'); v.dim(0, -60, 200, -60, 0, '200');
    v.dim(-6, -2, 40, 80, 8, '45'); v.dim(40, 80, 52, 74, 6, '5');
    v.leader(90, 45, 12, 20, '125x75x10UA');
    v.weld(100, 40, 10, 14, { size: '6', all: true });
    v.leader(200, 55, 14, 4, '20 x 20\nCHAMFER');
    v.leader(200, 0, 12, -10, '75x75x10 EA\nTRIM VERTICAL\nLEG TO SUIT');
    const pe = v.P(100, -105); v.B.title(pe[0], pe[1], 'ELEVATION', null, null, { h: 2.4 });
    const pt = v.P(100, -105); v.B.title(pt[0] - 10, pt[1] - 11, 'STRINGER/CORBEL BRACKET', null, null, { h: 3.4 }); v.B.title(pt[0] - 10, pt[1] - 17, 'DETAILS', '5', '', { h: 3.4 });
    ['2 - BRACKETS REQUIRED PER STRINGER OR', 'CORBEL CONNECTION :-', '1 - AS DRAWN', '1 - OPPOSITE HAND'].forEach((l, i) => v.B.E.push({ t: 'text', p: [pt[0] - 26, pt[1] - 27 - i * 3.4], s: l, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }));
  }
  // halfcap connection channel (150 PFC x 300 long) elevation at 1:10
  function connChan(v) {
    v.rect(0, 0, 75, 300, 'S-NEW'); v.line(9.5, 0, 9.5, 300, 'S-HIDDEN');
    [75, 225].forEach(y => { v.line(20, y + 11, 60, y + 11, 'S-NEW'); v.line(20, y - 11, 60, y - 11, 'S-NEW'); v.arc(20, y, 11, 90, 270, 'S-NEW'); v.arc(60, y, 11, -90, 90, 'S-NEW'); v.line(-30, y, 140, y, 'S-CL'); v.line(40, y - 20, 40, y + 20, 'S-CL'); });
    v.dim(0, 330, 40, 330, 0, '40'); v.dim(40, -30, 75, -30, 0, '40');
    v.dimChain([[150, 0], [150, 75], [150, 225], [150, 300]], 0, ['75', '150', '75']); v.dim(230, 0, 230, 300, 0, '300');
    v.leader(0, 160, -14, 4, '150 PFC'); v.leader(60, 75, 14, -4, 'φ22x40 LONG\nSLOTTED HOLE\n(TYP)');
    const pe = v.P(37, -80); v.B.title(pe[0], pe[1], 'ELEVATION', null, null, { h: 2.4 });
    v.B.title(pe[0] + 8, pe[1] - 9, 'HALFCAP CONNECTION CHANNEL', '10', null, { h: 3.4 });
  }
  // a small stringer/corbel bracket seen in the elevation (dir +1: base runs +x from xi)
  function bracketElev(v, xi, dir, s) {
    const X = t => xi + dir * t; v.pl([[X(-10), 0], [X(-10), 10], [X(40), 75], [X(185), 75], [X(200), 60], [X(200), 0]], false, 'S-NEW');
    v.fill([[X(-10), 0], [X(60), 0], [X(5), 60]], 'S-NEW'); v.line(X(40), 75, X(140), 12, 'S-NEW');
    [35, 165].forEach(t => { v.rect(X(t) - 16, -s.tf - 16, 32, 16, 'S-BOLT'); v.line(X(t), 10, X(t), -s.tf - 30, 'S-BOLT'); v.circ(X(t), -s.tf - 30, 8, 'S-BOLT'); });
  }
  function repElev(v, o) {
    const s = PF(o.pfc), d = s.d, u = UC(o.pile), CX = [-600, 600], yc = CORH, ys = yc + STRH, t = o.type;
    const xl = t === '3' ? -600 - 181 - 210 - 20 : -1150, xr = 1150;
    pfcElevH(v, xl, xr, 0, s, 'S-NEW'); if (t !== '3') v.brk(xl, -d - 20, xl, 20); v.brk(xr, -d - 20, xr, 20);
    v.line(-1150, ys, xr, ys, 'S-EXIST'); v.line(-1150, ys + DECK, xr, ys + DECK, 'S-EXIST'); v.brk(-1150, ys - 20, -1150, ys + DECK + 20); v.brk(xr, ys - 20, xr, ys + DECK + 20);
    CX.forEach(cx => {
      const w0 = logCut(v, cx, 0, yc, LOGD); logCut(v, cx, yc, ys, LOGD); v.line(cx - w0, yc, cx + w0, yc, 'S-EXIST'); v.line(cx - w0, 0, cx + w0, 0, 'S-EXIST');
      bracketElev(v, cx - w0 + 20, -1, s); bracketElev(v, cx + w0 - 20, 1, s);
      [[-1, 1], [1, -1]].forEach(([a, b]) => { const p0 = [cx + a * (w0 - 30), 45], p1 = [cx + b * 215, yc - 50]; [-8, 8].forEach(o2 => v.line(p0[0], p0[1] + o2, p1[0], p1[1] + o2, 'S-HIDDEN')); v.fill(circP(p0[0], p0[1], 14, 10), 'S-BOLT'); v.fill(circP(p1[0], p1[1], 14, 10), 'S-BOLT'); });
    });
    const yP = -d - 1250, H = u.d;
    if (t === '1' || t === '3') {
      iSec(v, 0, -d - H / 2, u, 0, 'S-NEW'); v.line(-u.b / 2, -d - H / 2, u.b / 2, -d - H / 2, 'S-NEW');
      if (t === '1') iElevFlange(v, 0, yP, -d - H, u, 'S-NEW'), v.brk(-u.b / 2 - 20, yP, u.b / 2 + 20, yP);
      else { const k = 1 / 8, L = 1100; v.pl([[-u.b / 2, -d - H], [-u.b / 2 - L * k, -d - H - L]], false, 'S-NEW'); v.pl([[u.b / 2, -d - H], [u.b / 2 - L * k, -d - H - L]], false, 'S-NEW'); v.line(0, -d - H, -L * k, -d - H - L, 'S-HIDDEN'); v.brk(-u.b / 2 - L * k - 20, -d - H - L, u.b / 2 - L * k + 20, -d - H - L); v.line(260, -d - H - 600, 260 - 300 * k, -d - H - 900, 'S-TEXT'); v.line(260, -d - H - 600, 260, -d - H - 900, 'S-TEXT'); v.line(260 - 300 * k, -d - H - 900, 260, -d - H - 900, 'S-TEXT'); v.text(285, -d - H - 700, 'X', TH); v.text(240, -d - H - 980, '1', TH); }
      v.rect(-37, -d, 74, d, 'S-HIDDEN'); [[12, -75], [12, -225]].forEach(q => v.fill(circP(q[0], q[1], 18, 12), 'S-BOLT'));
    } else {
      // pile runs up between the halfcaps to the PFC top
      v.rect(-u.b / 2, -d, u.b, d, 'S-HIDDEN'); v.line(-u.b / 2, -d, -u.b / 2, yP, 'S-NEW'); v.line(u.b / 2, -d, u.b / 2, yP, 'S-NEW'); v.line(0, -d + 10, 0, yP, 'S-HIDDEN'); v.brk(-u.b / 2 - 20, yP, u.b / 2 + 20, yP);
      [[-u.b / 2 + 30, -40], [u.b / 2 - 30, -225]].forEach(q => v.fill(circP(q[0], q[1], 18, 12), 'S-BOLT'));
      v.dim(-70, 60, 70, 60, 6, '140');
      v.dim(170, -225, 170, -d, 0, '75', { sub: '(TYP)' });
      if (t === '1A') { v.rect(-200, -d - 200, 400, 200, 'S-NEW'); v.line(-200, -d - 13, 200, -d - 13, 'S-NEW'); v.fill([[-5, -d - 13], [5, -d - 13], [5, -d - 195], [-5, -d - 195]], 'S-NEW'); }
      else { [-1, 1].forEach(k => { v.pl([[k * u.b / 2, -d - 13], [k * (u.b / 2 + 180), -d - 13], [k * (u.b / 2 + 180), -d - 45], [k * (u.b / 2 + 45), -d - 180], [k * u.b / 2, -d - 180]], false, 'S-NEW'); v.line(k * u.b / 2, -d - 13, k * (u.b / 2 + 200), -d - 13, 'S-NEW'); v.line(k * (u.b / 2 + 200), -d - 13, k * (u.b / 2 + 200), -d, 'S-NEW'); }); v.line(u.b / 2 - 30, -d - 200, u.b / 2 - 30, -d - 500, 'S-HIDDEN'); v.dim(u.b / 2 - 30, -d - 400, u.b / 2, -d - 400, 0, '30', { sub: '(TYP)' }); }
    }
    // markers
    if (t === '1') { v.mark(-1150 - 120, yc - 20, 'C', 270); v.line(-1150 - 60, yc - 20, -1150 + 80, yc - 20, 'S-TITLE'); v.mark(-1150 - 20, yc - 230, 'B', 0); v.mark(-650, -d - 60, 'A', 0); }
    else { v.mark(xl - 120, yc - 20, 'B', 270); v.line(xl - 60, yc - 20, xl + 80, yc - 20, 'S-TITLE'); v.mark(xl - 120, 20, 'A', 0); }
    v.line(-150, yc - 20, 150, yc - 20, 'S-TITLE'); v.fill([[0, yc - 20], [150, yc - 20], [100, yc - 70]], 'S-TITLE');
    if (t === '3') v.dim(xl, yc + 40, xl + 20, yc + 40, 0, '20');
    return { d, u, yc, ys, yP, xl, xr };
  }
  function repElevLabels(v, g, o) {
    const t = o.type, pfcTxt = 'PROPOSED ' + pfcLbl(o.pfc) + ' PFC\nHALFCAP REPLACEMENT', u = g.u, un = secName(o.pile);
    if (t === '1' || t === '3') {
      v.leader(800, -g.d, 14, -16, pfcTxt + '\n(REMOVE EXISTING TIMBER\nHALFCAPS ONLY AFTER\nPROPPING STRINGERS &\nCORBELS)');
      v.leader(-60, -g.d - 60, -18, -10, '12FL STIFFENER\n(TYP)', { dot: true });
      if (t === '1') { v.leader(12, -75, 14, -36, '2-M20 BOLTS\n(TYP)'); v.leader(-u.b / 2, -g.d - u.d - 300, -18, -6, un); v.leader(u.b / 2, -g.d - u.d - 500, 16, 0, 'PROPOSED\nPILE'); }
      else { v.leader(30, -225, 16, -24, 'HALFCAP CONNECTION\nCHANNEL WELDED TO\n' + un + ' WITH 6 FILLET\nWELD ALL ROUND'); v.leader(-u.b / 2 - 80, -g.d - u.d - 650, -18, -6, un + ' PILE'); }
    } else {
      v.leader(800, -g.d, 14, -12, pfcTxt);
      v.leader(-u.b / 2, -g.d - 700, -16, -8, 'PROPOSED\n' + un + ' PILE');
      if (t === '1A') { v.leader(-200, -g.d - 150, -14, -12, '200x200x13 EA\nx400 LONG'); v.leader(0, -g.d - 120, 18, -14, 'STIFFENER', { dot: true }); v.weld(-150, -g.d - 2, -14, -14, { size: '8', tail: 'TYP' }); v.weld(5, -g.d - 60, 22, -6, { size: '8', all: true }); }
      else { v.leader(-u.b / 2 - 60, -g.d - 60, -16, -14, '180x10FLx180\nSTIFFENERS\n(TYP)'); v.weld(u.b / 2 + 2, -g.d - 120, 30, -14, { size: '8', tail: 'TYP' }); }
    }
  }
  // corbel end view (VIEW B on 2313, VIEW A on the others), 1:20
  function repView(v, o) {
    const s = PF(o.pfc), d = s.d, u = UC(o.pile), t = o.type, gw = (t === '1' || t === '3') ? 55 : u.d / 2, yc = CORH, ys = yc + STRH;
    // stringer (log seen along its length) + decking, corbel with chamfered bottom corners
    v.line(-1100, ys, 1100, ys, 'S-EXIST'); v.line(-1100, ys + DECK, 1100, ys + DECK, 'S-EXIST'); for (let x = -1000; x <= 1000; x += 220) v.line(x, ys, x, ys + DECK, 'S-EXIST'); v.brk(-1080, ys - 20, -1080, ys + DECK + 20); v.brk(1080, ys - 20, 1080, ys + DECK + 20);
    v.pl([[-1150, ys - 30], [-1150, yc + 40], [-500, yc + 20], [-400, yc]], false, 'S-EXIST'); v.pl([[1150, ys - 30], [1150, yc + 40], [500, yc + 20], [400, yc]], false, 'S-EXIST');
    v.pileEnd(-1150, (ys + yc) / 2 + 10, 340, 'S-EXIST', 1); v.pileEnd(1150, (ys + yc) / 2 + 10, 340, 'S-EXIST', 1);
    v.pl([[-400, yc], [-400, 90], [-310, 0], [310, 0], [400, 90], [400, yc]], false, 'S-EXIST'); v.line(-400, yc, 400, yc, 'S-EXIST');
    v.line(0, ys, 0, yc - 20, 'S-HIDDEN'); v.line(12, ys, 12, yc - 20, 'S-HIDDEN');
    // halfcap PFCs (cut), toes outward
    [-1, 1].forEach(k => {
      const pts = [[0, -d], [s.b, -d], [s.b, -d + s.tf], [s.tw, -d + s.tf], [s.tw, -s.tf], [s.b, -s.tf], [s.b, 0], [0, 0]].map(q => [k * (gw + q[0]), q[1]]); v.pl(pts, true, 'S-NEW');
      // brackets seen end-on in notches of the corbel + the rod / bolts
      [[k * (gw + 90), 45], [k * (gw + 90), 190]].forEach(([x, y]) => { v.rect(x - 38, y - 32, 76, 64, 'S-NEW'); v.rect(x - 22, y - 18, 44, 36, 'S-NEW'); v.fill(circP(x, y, 12, 10), 'S-BOLT'); });
      v.line(k * (gw + 30), 10, k * (gw + 30), -s.tf - 30, 'S-BOLT'); v.rect(k * (gw + 30) - 16, -s.tf - 18, 32, 18, 'S-BOLT');
    });
    v.dim(-gw, ys - 120, 0, ys - 120, 0, '55', { sub: '(TYP)' });
    const yP = -d - 1000;
    if (t === '1' || t === '3') {
      // connection channel + packers + 2 bolts, 550 long head, pile
      v.rect(-37, -d, 12, d, 'S-NEW'); v.rect(25, -d, 12, d, 'S-NEW'); v.rect(-gw, -d + 30, gw - 37, d - 60, 'S-NEW'); v.rect(37, -d + 30, gw - 37, d - 60, 'S-NEW');
      [-75, -225].forEach(y => { v.line(-gw - s.tw - 30, y, gw + s.tw + 30, y, 'S-BOLT'); [-1, 1].forEach(k => v.rect(k * (gw + s.tw) + (k > 0 ? 0 : -18), y - 22, 18, 44, 'S-BOLT')); });
      v.rect(-275, -d - u.d, 550, u.d, 'S-NEW'); v.line(-275, -d - u.tf, 275, -d - u.tf, 'S-NEW'); v.line(-275, -d - u.d + u.tf, 275, -d - u.d + u.tf, 'S-NEW');
      v.line(-u.d / 2, -d - u.d, -u.d / 2, yP, 'S-NEW'); v.line(u.d / 2, -d - u.d, u.d / 2, yP, 'S-NEW'); v.line(-u.d / 2 + u.tf, -d - u.d, -u.d / 2 + u.tf, yP, 'S-NEW'); v.line(u.d / 2 - u.tf, -d - u.d, u.d / 2 - u.tf, yP, 'S-NEW'); v.brk(-u.d / 2 - 20, yP, u.d / 2 + 20, yP);
    } else {
      v.line(-u.d / 2, 0, -u.d / 2, yP, 'S-NEW'); v.line(u.d / 2, 0, u.d / 2, yP, 'S-NEW'); v.line(-u.d / 2 + u.tf, -10, -u.d / 2 + u.tf, yP, 'S-NEW'); v.line(u.d / 2 - u.tf, -10, u.d / 2 - u.tf, yP, 'S-NEW'); v.brk(-u.d / 2 - 20, yP, u.d / 2 + 20, yP);
      [-75, -225].forEach(y => { v.line(-gw - s.tw - 30, y, gw + s.tw + 30, y, 'S-BOLT'); [-1, 1].forEach(k => v.rect(k * (gw + s.tw) + (k > 0 ? 0 : -18), y - 22, 18, 44, 'S-BOLT')); });
      if (t === '1A') [-1, 1].forEach(k => { v.pl([[k * u.d / 2, -d - 13], [k * (u.d / 2 + 200), -d - 13], [k * (u.d / 2 + 200), -d], [k * (u.d / 2 + 13), -d], [k * (u.d / 2 + 13), -d - 200]], false, 'S-NEW'); v.pl([[k * (u.d / 2 + 13), -d - 13], [k * (u.d / 2 + 180), -d - 13], [k * (u.d / 2 + 180), -d - 40], [k * (u.d / 2 + 50), -d - 180], [k * (u.d / 2 + 13), -d - 180]], false, 'S-NEW'); });
      else { v.rect(-u.d / 2 - 200, -d - 200, u.d + 400, 200, 'S-NEW'); v.line(-u.d / 2 - 200, -d - 13, u.d / 2 + 200, -d - 13, 'S-NEW'); v.line(0, -d - 13, 0, -d - 200, 'S-HIDDEN'); }
      if (t === '1A') v.dim(u.d / 2, -d - 400, u.d / 2 + 30, -d - 400, 0, '30', { sub: '(TYP)' });
    }
    // labels
    v.leader(-500, ys, -10, 18, 'EXISTING TIMBER\nSTRINGER');
    v.leader(-360, 50, -16, -4, 'EXISTING TIMBER\nCORBEL');
    v.leaders([[gw + 90 + 38, 190], [gw + 90 + 38, 45]], 30, 34, 'NOTCH CORBEL\nTO SUIT (TYP)');
    v.leader(-gw - 90, 15, -30, -40, 'STRINGER/CORBEL BRACKET FIXED\nTO CORBELS WITH φ20 THREADED\nROD WITH 65x5FLx65 WASHER TO\nTIMBER FACE AND FIXED TO PFC\nHALFCAP WITH 2 - M20 BOLTS IN\nSITE DRILLED φ22 HOLES (TYP)');
    const un = secName(o.pile);
    if (t === '1' || t === '3') {
      v.leader(37, -10, 26, 14, 'HALFCAP CONNECTION\nCHANNEL WELDED TO\n' + un + ' WITH 6 FILLET\nWELD ALL ROUND');
      v.leader(gw - 5, -75, 24, 2, 'PROVIDE STEEL\nPACKERS AS\nREQUIRED (TYP)');
      v.leader(275, -d - 150, 14, -12, un + '\nx 550 LONG');
      v.weld(-37, -d - 30, -20, -10, { size: '6', both: true, tail: 'TYP' });
      v.weld(37, -d - u.d / 2, 24, -2, { site: true, tail: 'TYP', other: true });
      v.weld(-u.d / 2, -d - u.d - 60, -14, -18, { site: true });
      if (t === '3') { v.leader(-gw - s.tw - 30, -150, -16, 0, 'M20 BOLTS'); v.leader(u.d / 2, -d - u.d - 500, 14, 0, 'PROPOSED\nPILE'); }
    } else {
      v.leader(gw + s.tw + 18, -75, 18, -6, '2-M20 BOLTS\n(TYP)');
      if (t === '1A') v.leader(u.d / 2 + 120, -d - 90, 22, -18, '180x10FLx180\nSTIFFENER\n(TYP)');
      else { v.leader(u.d / 2 + 200, -d - 100, 14, -6, '200x200x13 EA\nx400 LONG'); v.leader(-u.d / 2 - 100, -d - 120, -16, -64, 'STIFFENER', { dot: true }); }
    }
  }
  // SECTION C / B (plan through the corbel) 1:20
  function repPlan(v, o) {
    const s = PF(o.pfc), u = UC(o.pile), t = o.type, gw = (t === '1' || t === '3') ? 55 : u.d / 2;
    v.rect(-100, -320, 200, 640, 'S-EXIST');
    [-1, 1].forEach(k => {
      const y0 = k * gw, y1 = k * (gw + s.b); v.line(-480, y0, 480, y0, 'S-NEW'); v.line(-480, y1, 480, y1, 'S-NEW'); v.line(-480, k * (gw + s.tw), 480, k * (gw + s.tw), 'S-HIDDEN');
      v.brk(-480, y0 - k * 20, -480, y1 + k * 20); v.brk(480, y0 - k * 20, 480, y1 + k * 20);
      [-1, 1].forEach(j => {
        const xa = j * 100; v.rect(min(xa - j * 160, xa + j * 40), min(k * (gw + 10), k * (gw + 85)), 200, 75, 'S-NEW');
        [xa - j * 125, xa + j * 5].forEach(x => { v.fill(circP(x, k * (gw + 47), 12, 10), 'S-BOLT'); v.line(x - 25, k * (gw + 47), x + 25, k * (gw + 47), 'S-CL'); });
        v.rect(min(xa - j * 75, xa + j * 25), min(k * (gw + 85), k * (gw + 160)), 100, 75, 'S-NEW');
      });
      const yr = k * (gw + 122); [-8, 8].forEach(dd => v.line(-80, yr + dd, 80, yr + dd, 'S-HIDDEN')); [-80, 80].forEach(x => v.circ(x, yr, 10, 'S-BOLT'));
    });
    if (t === '1' || t === '3') {
      v.rect(560, -275, 200, 550, 'S-NEW'); v.line(660, -275, 660, 275, 'S-HIDDEN');
      v.rect(640, -gw + 2, 40, 2 * gw - 4, 'S-NEW'); [[660, -20], [660, 20]].forEach(q => { v.fill(circP(q[0], q[1], 14, 10), 'S-BOLT'); v.line(q[0], -gw - 20, q[0], gw + 20, 'S-BOLT'); });
      v.leader(680, 0, 16, 14, '150 PFC x 300 LONG\nHALFCAP CONNECTION\nCHANNEL (REFER TO\nDETAIL) SHIMMED TO FIT\nBETWEEN HALFCAPS');
      v.weld(640, gw - 20, 14, 20, { size: '6', all: true });
    }
    v.leader(-300, -gw, -16, 30, 'PROPOSED\nHALFCAP\nREPLACEMENT');
    v.leader(30, -230, 16, -12, 'EXISTING TIMBER\nCORBEL', { dot: true });
  }
  const N_HCV = 'NOTE: HALFCAP CHANNELS WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS\n300 PFC HALFCAP DRAWN';
  function repSheet(p, o) {
    const LY = new Lay(700), t = o.type, base = Object.assign({ pfc: p.pfc, pile: p.pile }, o);
    const b = LY.view(5); bracketDet(b);
    if (t !== '1A' && t !== '2') { const c = LY.view(10); connChan(c); }
    nbox(LY, 'SUBJECT TO CORBEL CONDITION\nREFER ENGINEER', 46);
    const pl = LY.view(20); repPlan(pl, base); LY.title(t === '1' ? 'SECTION C' : 'SECTION B', 20);
    LY.break();
    const va = LY.view(20); repView(va, base); LY.title(t === '1' ? 'VIEW B' : 'VIEW A', 20);
    const e = LY.view(20), g = repElev(e, base); repElevLabels(e, g, base); LY.title('ELEVATION');
    LY.break();
    nbox(LY, N_HCV, 52);
    if (o.quote) nbox(LY, o.quote, 96);
    if (o.optNote) LY.block(B => B.noteBox(0, 0, o.optNote, o.optNote.length * 3.2 * 0.72 + 6, { h: 3.2 }));
    if (o.siteNote) nbox(LY, o.siteNote, 62);
    nbox(LY, N_DRG, 42);
    LY.caption('STEEL PIER PILE/PIER HALFCAPS REPLACEMENT DETAIL - TYPE ' + t, 20, 'PIER N° X - PILE N° X', { ref: 'XX30-XXXX' });
    return fixTitles(LY.done());
  }
  const repP = () => [P('pfc', 'PFC halfcap', '300PFC', { opts: ['300PFC', '380PFC'] }), P('pile', 'Steel pile', '200UC52', { opts: ['200UC52', '250UC73', '250UC90'] })];
  const Q = (w) => '"NOTE THESE DETAILS ARE ONLY APPLICABLE WHERE BOTH HALFCAPS AND ' + w + ' PIER PILES ARE REPLACED BY STEEL SECTIONS - BECAUSE GAP BETWEEN PROPOSED STEEL HALFCAPS HAS TO MATCH THE SIZE OF THE PROPOSED STEEL PILE"';
  def('pn2313', 'Halfcaps', 'Steel pier pile / pier halfcaps replacement – Type 1 (preferred)', 'PN30-2313', repP(), (p) => repSheet(p, { type: '1', optNote: 'PREFERRED OPTION' }),
    'Replace a pier pile and both halfcaps in steel: 200 UC 52 pile with a 550 long head and 150 PFC connection channel bolted to 300 PFC halfcaps, stringers / corbels fixed with angle brackets (preferred option).');
  def('pn2314', 'Halfcaps', 'Steel pier pile / pier halfcaps replacement – Type 1A (non preferred)', 'PN30-2314', repP(), (p) => repSheet(p, { type: '1A', optNote: 'NON PREFERRED OPTION', quote: Q('ALL') }),
    'Steel pile between steel halfcaps on a 200x200x13 EA seat angle with 180x10 stiffeners — only where both halfcaps and all pier piles are replaced by steel sections.');
  def('pn2315', 'Halfcaps', 'Steel pier pile / pier halfcaps replacement – Type 2 (not preferred)', 'PN30-2315', repP(), (p) => repSheet(p, { type: '2', quote: Q('').replace('AND  PIER', 'AND PIER'), siteNote: 'NOTE\nNOT A PREFERRED OPTION DUE TO REQUIRED SITE WELDING OF ANGLES TO PILES' }),
    'Steel pile between steel halfcaps on site-welded 200x200x13 EA seat angles with 180x10FLx180 stiffeners — not preferred because of the site welding to the piles.');
  def('pn2316', 'Halfcaps', 'Steel pier pile / pier halfcaps replacement – Type 3 (raked pile)', 'PN30-2316', repP(), (p) => repSheet(p, { type: '3' }),
    'As Type 1 for a raked steel pile: 200 UC 52 x 550 long head with 12FL stiffeners and a 150 PFC halfcap connection channel welded all round.');
})(typeof window !== 'undefined' ? window : globalThis);
