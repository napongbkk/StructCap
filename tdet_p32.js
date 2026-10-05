/* StructCap Timber — repair details: PN30-3201 … 3214 (concrete overlay, reinforcement, kerb, drainage, joints, sill beam).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ local helpers
  const BASED = 'BASED ON THE CONCRETE DECK AS\nTHE RUNNING SURFACE, 130 MIN\nSLAB, 125 TIMBER DECKING AND\n165 FOR GUARDRAILING CONNECTION\nPLATE BEARING.';
  const FOAM10 = '10 THICK EXPANDED FOAM (FOSROC\nEXPANDAFOAM SHEET/STRIP BY\nPARCHEM CONSTRUCTION PRODUCTS\nOR SIMILAR APPROVED)';
  // arc drawn as a polyline (keeps the extent tight: the core bbox counts an arc as its full circle)
  function arcPL(v, x, y, r, a0, a1, L) { const pts = []; for (let i = 0; i <= 16; i++) { const a = (a0 + (a1 - a0) * i / 16) * PI / 180; pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); } v.pl(pts, false, L || 'S-EXIST'); }
  // left / right offset polylines of a pipe centreline (model pts), half width r
  function pipeEdges(cl, r) {
    const L = [], R = [];
    cl.forEach((p, i) => {
      const a = cl[max(0, i - 1)], b = cl[min(cl.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      L.push([p[0] + nx * r, p[1] + ny * r]); R.push([p[0] - nx * r, p[1] - ny * r]);
    });
    return [L, R];
  }
  // surface finish mark (U2 / U3): text over a small V touching the surface at (x,y)
  function finishMark(v, x, y, s) { const p = v.P(x, y); v.add({ t: 'pl', p: [[p[0] - 1.3, p[1] + 1.4], [p[0], p[1]], [p[0] + 1.3, p[1] + 1.4]], closed: false, L: 'S-TEXT' }); v.add({ t: 'text', p: [p[0], p[1] + 1.9], s, h: 2.0, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); }
  // slope mark: chevron pointing at (x,y) from direction ang (deg, paper) with the number next to it
  function slopeMark(v, x, y, ang, s) { const p = v.P(x, y), a = ang * PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux; v.add({ t: 'pl', p: [[p[0] + ux * 1.6 + nx * 1.3, p[1] + uy * 1.6 + ny * 1.3], [p[0], p[1]], [p[0] + ux * 1.6 - nx * 1.3, p[1] + uy * 1.6 - ny * 1.3]], closed: false, L: 'S-TEXT' }); v.add({ t: 'text', p: [p[0] + ux * 3, p[1] + uy * 3], s: s || '2', h: 2.0, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
  // horizontal line from x1 to x2 at y, skipping the [a,b] gaps
  function gapLine(v, x1, x2, y, gaps, L) { let x = x1; gaps.slice().sort((p, q) => p[0] - q[0]).forEach(g => { if (g[0] > x) v.line(x, y, min(g[0], x2), y, L); x = max(x, g[1]); }); if (x < x2) v.line(x, y, x2, y, L); }
  // little filled square (rivet / screw head) at a model point, paper size s
  function dotSq(v, x, y, s) { const p = v.P(x, y), h = (s || 1) / 2; v.add({ t: 'solid', p: [[p[0] - h, p[1] - h], [p[0] + h, p[1] - h], [p[0] + h, p[1] + h], [p[0] - h, p[1] + h]], L: 'S-NEW' }); }
  // note box sized to its (pre-broken) lines so the text never wraps or overruns the box
  function nbox(B, x, y, s, opt) { opt = opt || {}; const h = opt.h || TH, w = max(...String(s).split('\n').map(l => l.length)) * h * 0.72 + 6; return { H: B.noteBox(x, y, s, w, opt), w }; }
  // "insert appropriate detail" placeholder frame used on the general arrangement sheets
  function placeholder(B, x, y, w, h, title, ref, scale, sub, head) {
    if (head) B.E.push({ t: 'text', p: [x + 2, y - 4], s: head, h: 1.8, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
    B.E.push({ t: 'pl', p: [[x, y], [x + w, y], [x + w, y - h], [x, y - h]], closed: true, L: 'S-NOTE' });
    B.E.push({ t: 'line', a: [x, y - h], b: [x + w, y], L: 'S-NOTE' });
    const ang = Math.atan2(h, w) * 180 / PI; B.E.push({ t: 'text', p: [x + w / 2, y - h / 2 + 1.5], s: 'INSERT APPROPRIATE DETAIL', h: 2.6, al: 'c', v: 'b', ang, L: 'S-TEXT' }); B.E.push({ t: 'text', p: [x + w / 2, y - h / 2 - 1.5], s: 'REFER ' + ref, h: 2.6, al: 'c', v: 't', ang, L: 'S-TEXT' });
    B.title(x + w / 2, y - h - 7, title, scale, sub);
  }

  // ================================================================== PN30-3204 / 3205 KERB & DOWNPIPE DETAILS
  // one view: o.v = 'a' raking past timber stringer, 'b' steel stringer + Bondek, 'c' 45° elbow, 'd' vertical beside timber stringer; o.pf = kerb permanent formwork (3205)
  function kerbDP(LY, o) {
    const v = LY.view(10), pf = !!o.pf, V = o.v, yDt = -130, yDb = -255, yKb = pf ? -255 : -265, xL = V === 'b' ? -1000 : V === 'd' ? -800 : -650;
    const st = V === 'a' ? { x: -30 } : V === 'c' ? { x: -85 } : V === 'd' ? { x: -345 } : { x: -712 }, R = 215; st.y = yDb - R;
    const xd = V === 'a' ? -20 : V === 'c' ? -115 : V === 'd' ? -330 : -730; // decking edge (foam on the kerb side of it)
    const ub = V === 'b' ? SEC['410UB54'] : null, ubx = -218;
    // pipe centre line
    let cl, pBot;
    if (V === 'a') { const a = 63 * PI / 180, c0 = [-95, -20]; pBot = yDb - 2 * R - 100; const L = (c0[1] - pBot) / Math.sin(a); cl = [c0, [c0[0] - L * Math.cos(a), pBot]]; }
    else if (V === 'c') { const c0 = [-85, -20], d = 240, Rb = 160, p1 = [c0[0] - d, c0[1] - d], cc = [p1[0] + Rb / sq(2), p1[1] - Rb / sq(2)]; pBot = yDb - 2 * R - 100; cl = [c0, p1]; for (let i = 1; i <= 6; i++) { const t = (135 + i * 45 / 6) * PI / 180; cl.push([cc[0] + Rb * Math.cos(t), cc[1] + Rb * Math.sin(t)]); } cl.push([cc[0] - Rb, pBot]); }
    else if (V === 'b') { pBot = yDb - ub.d - 100; cl = [[-55, -20], [-55, pBot]]; }
    else { pBot = yDb - 2 * R - 100; cl = [[-75, -20], [-75, pBot]]; }
    const [pl, pr] = pipeEdges(cl, 50), xAt = (E, y) => { for (let i = 0; i + 1 < E.length; i++) { const a = E[i], b = E[i + 1]; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); } return null; };
    const gapAt = y => { const a = xAt(pl, y), b = xAt(pr, y); return a == null || b == null ? null : [min(a, b), max(a, b)]; };
    // concrete: slab + kerb
    const top = x => (x < -150 ? (-150 - x) * 0.02 + 3 : 3);
    const conc = [[xL, top(xL)], [-150, 3], [-125, -20], [-25, -20], [0, 0], [6, 70], [26, 90], [280, 100], [300, 80], [300, yKb + 10], [290, yKb]];
    if (!pf) conc.push([262, yKb], [256, yKb + 10], [246, yKb + 10], [240, yKb]);
    conc.push([10, yKb], [0, yDb], [xd, yDb], [xd, yDt], [xL, yDt]);
    v.pl(conc, true, 'S-CONC'); v.hatch(conc, 'conc', 'S-HATCH');
    // existing decking (dash-dot) with foam strip at its edge, hessian on top, trimmed around a raking pipe
    const gT = gapAt(yDt), gB = gapAt(yDb), gaps = y => { const g = gapAt(y); return g && g[1] > xL && g[0] < xd ? [g] : []; };
    gapLine(v, xL, xd - 10, yDt - 3, gaps(yDt - 3), 'S-HIDDEN'); gapLine(v, xL, xd - 10, yDb, gaps(yDb), 'S-EXIST');
    v.line(xd - 10, yDt, xd - 10, yDb, 'S-EXIST'); v.rect(xd - 10, yDb, 10, yDt - yDb - 3, 'S-NEW'); v.hatch([[xd - 10, yDb], [xd, yDb], [xd, yDt - 3], [xd - 10, yDt - 3]], 'ansi31', 'S-HATCH', 0.4);
    v.brk(xL, yDb - 10, xL, yDt + 30);
    if (V === 'b') { v.line(xd, yDb, 0, yDb, 'S-NEW'); for (let x = xd + 120; x < -20; x += 200) v.pl([[x - 25, yDb], [x - 15, yDb + 18], [x + 15, yDb + 18], [x + 25, yDb]], false, 'S-NEW'); }
    if (pf) { // 2 thick PGI kerb formwork (outer face, soffit) with the lap of the upper sheet; Bondek / PGI under the slab
      v.pl([[284, 100], [303, 100], [303, yKb - 3], [150, yKb - 3], [150, yKb + 7]], false, 'S-NEW'); v.pl([[303, -100], [290, -100], [290, -112]], false, 'S-NEW');
      [200, 260].forEach(x => dotSq(v, x, yKb - 4, 1.0)); if (V !== 'b') v.line(xd, yDb - 3, 150, yDb - 3, 'S-NEW');
    }
    // stringer
    if (ub) { iSec(v, ubx, yDb - ub.d / 2, ub, 0, 'S-NEW'); v.fill([[ubx - ub.b / 2, yDb - ub.d], [ubx + ub.b / 2, yDb - ub.d], [ubx + ub.b / 2, yDb - ub.d + ub.tf], [ubx - ub.b / 2, yDb - ub.d + ub.tf]]); v.fill([[ubx - ub.b / 2, yDb - ub.tf], [ubx + ub.b / 2, yDb - ub.tf], [ubx + ub.b / 2, yDb], [ubx - ub.b / 2, yDb]]);
      [ubx - 45, ubx + 45].forEach(x => { v.line(x - 6, yDb - 40, x - 6, yDb + 110, 'S-BOLT'); v.line(x + 6, yDb - 40, x + 6, yDb + 110, 'S-BOLT'); v.nut(x, yDb + 3, 0, 1, 12); v.nut(x, yDb - ub.tf, 0, -1, 12); v.rect(x - 8, yDb + 95, 16, 12, 'S-BOLT'); });
      logEnd(v, -712, yDb - R, R); }
    else logEnd(v, st.x, st.y, R);
    // pipe (part behind the stringer hidden)
    const hid = q => !ub && Math.hypot(q[0] - st.x, q[1] - st.y) < R + 2 && V === 'c';
    [pl, pr].forEach(E => { for (let i = 0; i + 1 < E.length; i++) v.line(E[i][0], E[i][1], E[i + 1][0], E[i + 1][1], hid([(E[i][0] + E[i + 1][0]) / 2, (E[i][1] + E[i + 1][1]) / 2]) ? 'S-HIDDEN' : 'S-NEW'); });
    v.line(pl[pl.length - 1][0], pl[pl.length - 1][1], pr[pr.length - 1][0], pr[pr.length - 1][1], 'S-NEW');
    if (V === 'c') { [1, 7].forEach(i => { const a = pipeEdges(cl, 62); v.line(a[0][i][0], a[0][i][1], a[1][i][0], a[1][i][1], 'S-NEW'); }); const a = pipeEdges(cl, 62); v.pl([a[0][1], a[1][1], a[1][1].map((q, k) => q + (cl[2][k] - cl[1][k]) * 0.0)], false, 'S-NEW'); v.rect(cl[cl.length - 1][0] - 60, -650, 120, 35, 'S-NEW'); }
    // strap
    const ys = V === 'a' ? -330 : V === 'c' ? -560 : V === 'b' ? -520 : -470, gs = gapAt(ys); if (gs && V !== 'b') { v.line(gs[0] - 25, ys, gs[1] + 25, ys - (V === 'a' ? 40 : 0), 'S-NEW'); }
    // spikes / nails
    const dsx = V === 'a' ? -66 : V === 'c' ? -160 : V === 'd' ? -410 : xd - 86;
    v.spike(dsx, yDt + 2, dsx, yDt - 200, 'S-HIDDEN');
    const s4 = V === 'a' ? 50 : V === 'c' ? -30 : V === 'd' ? -255 : xd + 70;
    v.spike(s4, yDt - 35, s4 - 25, yDb - 110, 'S-BOLT'); if (pf || V === 'b') v.spike(s4 - 45, yDb + 10, s4 - 45, yDb - 50, 'S-BOLT');
    // dimensions
    v.dim(6, 100, 300, 100, 14 + 5, '300'); v.dim(0, 100, 25, 100, 9, '25');
    v.dim(-40, 90, -40, 100, 2, '10');
    v.dim(360, 0, 360, 100, -2, '100'); v.dim(360, yKb, 360, 0, -2, (pf ? '255' : '265'), { sub: 'MIN' });
    v.dim(-200, 3, -200, -20, 4, '20', { sub: 'NOM.' });
    if (!pf) { v.dim(240, yKb - 35, 300, yKb - 35, -1, '60'); v.dim(240, yKb + 10, 220, yKb + 10, 0, '20'); v.dim(330, yKb, 330, yKb + 10, -1, '10'); }
    const bx = ub ? -730 : st.x + (V === 'd' ? 15 : V === 'a' ? 10 : -30); v.dim(V === 'b' ? xd : xd, yDb - 120, V === 'b' ? xd + 100 : xd + 100, yDb - 120, 0, '100'); v.text((xd + xd + 100) / 2, yDb - 165, 'BEARING', 2.2, 'c', 'b');
    const sb = ub ? yDb - ub.d : st.y - R; v.dim(cl[cl.length - 1][0] + 110, sb, cl[cl.length - 1][0] + 110, pBot, -2, '100', { sub: 'MIN.' });
    finishMark(v, 150, 98, 'U2'); slopeMark(v, 6, 50, 0, '2'); slopeMark(v, 300, 50, 0, '2'); if (!pf) slopeMark(v, 150, yKb, -90, '2');
    v.wl(420, 0, 'RUNNING SURFACE');
    // labels
    const lab = [];
    v.leader(290, 98, 10, 10, pf ? 'KERB PERMANENT\nFORMWORK' : '20x20 CHAMFER\n(TYP)');
    if (pf) v.leader(16, 82, -8, 18, '20x20 CHAMFER\n(TYP)');
    v.leader(xd - 5, yDt - 50, -24, V === 'b' || (pf && V === 'd') ? 34 : 30, FOAM10);
    v.leader(xL + 150, yDt - 2, -12, V === 'b' || (pf && V === 'd') ? 6 : 10, 'HESSIAN');
    v.leader(xL + 200, yDt - 60, -14, 0, 'EXISTING TIMBER\nDECKING TO BE\nTRIMMED TO SUIT', { dot: true });
    v.leader(dsx, yDt - 120, -18, -8, 'φ10 x 200 LONG\nDECK SPIKE -\nMIN. 1 PER PLANK\n(EXISTING OR NEW)');
    const up = V === 'b' || V === 'd'; if (pf || V === 'b') v.leaders([[s4 - 45, yDb - 20], [s4 - 15, yDt - 90]], up ? -14 : 24, up ? 54 : -14, 'φ3.2x60 LONG CLOUT HEAD NAIL AT\n400 CRS, ALTERNATE WITH φ10x200\nLONG SPIKE AT 400 CRS.' + (V === 'b' ? ' (MID RIB)' : ''));
    else v.leader(s4 - 15, yDt - 100, 22, -14, 'φ10x200 LONG SPIKE AT\n400 CRS.');
    v.leader((ub ? -712 : st.x) + R * 0.7 * (V === 'a' ? 1 : -1), st.y - R * 0.7, (V === 'a' ? 16 : -16), -10, 'EXISTING TIMBER\nSTRINGER');
    if (ub) v.leader(ubx, yDb - ub.d, 6, -12, '410 UB 54 PROPOSED\nSTRINGER');
    if (V === 'b') { if (pf) { v.leader(150, yDb - 3, 14, -20, 'FORMWORK SHALL\nBE PROPPED (TYP)'); v.leader(60, yDb, 22, -36, '1mm THICK BONDEK\nPERMANENT FORMWORK\nOR SIMILAR APPROVED'); } else v.leader(-100, yDb, -14, -40, '1mm THICK BONDEK\nPERMANENT FORMWORK'); }
    if (pf && V === 'd') { v.leader(150, yDb - 3, 14, -20, 'FORMWORK SHALL\nBE PROPPED (TYP)'); v.leader(60, yDb, 22, -36, '1mm THICK BONDEK\nPERMANENT FORMWORK\nOR SIMILAR APPROVED'); }
    if (pf) { if (V === 'b' || V === 'd') v.leader(260, yKb - 4, 10, -8, 'POP RIVET OR SELF TAPPING\nSCREWS AT 200 CRS. (TYP)'); else v.leaders([[200, yKb - 4], [80, yDb - 3]], 12, -8, '2 THICK P.G.I. - POP RIVET OR SELF\nTAPPING SCREWS AT 200 CRS'); }
    const mid = cl[cl.length - 1], pm = [(cl[0][0] + mid[0]) / 2, (cl[0][1] + mid[1]) / 2];
    if (V === 'c') { v.leader(cl[3][0] + 62, cl[3][1], 24, 0, 'φ100x45° UPVC ELBOW'); v.leader(mid[0] + 60, -632, 22, -2, 'FIXING STRAP'); v.leader(mid[0] + 50, -720, 22, -2, 'φ100 UPVC DOWNPIPE\n(TIMBER STRINGER NOT\nTO BE CUT OR TRIMMED)'); }
    else if (V === 'a') { v.leader(gs[0] - 10, ys, -26, -24, 'FIXING STRAP'); v.leader(pm[0] - 30, pm[1] - 120, -20, -22, 'φ100 UPVC DOWNPIPE', { dot: true }); }
    else if (V === 'b') v.leader(mid[0] + 50, -600, 14, 0, 'φ100 UPVC\nDOWNPIPE');
    else { v.leader(mid[0] + 50, pBot + 60, 10, -8, 'φ100 UPVC DOWNPIPE'); v.leader(mid[0] - 50, ys, -3, -44, 'FIXING\nSTRAP', { dot: true }); }
    { const q = v.P(700, 60); const t = new Builder(); nbox(t, 0, 0, BASED); t.E.forEach(e => { A.shiftE(e, q[0], q[1] + 34); v.add(e); }); }
    const NOTE1 = 'NOTE:\nIF ROOM PERMITS, LOCATE DOWNPIPE\nON KERB SIDE OF STRINGER.', NOTE2 = 'NOTE:\nNEVER CUT/TRIM STRINGER TO\nACCOMMODATE DOWNPIPE.\nSHAPE UPVC DOWNPIPE TO SUIT\n(IF REQUIRED).';
    { const yb = min(pBot, -800), t = new Builder(); let x = 0; if (V === 'a' || V === 'c') x += nbox(t, 0, 0, NOTE1).w + 6; if (!pf || V === 'a') nbox(t, x, 0, V === 'c' ? 'NOTE:\nNEVER CUT/TRIM STRINGER TO\nACCOMMODATE DOWNPIPE.' : NOTE2, { solid: true }); const q = v.P(xL, yb); t.E.forEach(e => { A.shiftE(e, q[0], q[1] - 8); v.add(e); }); }
    LY.title('KERB & DOWNPIPE DETAILS', 10);
    return v;
  }
  def('kdp', 'Deck & overlay', 'Kerb & downpipe details', 'PN30-3204 / 3205', [
    P('str', 'Stringer under downpipe', 'timber', { opts: ['timber', 'steel'] }), P('elbow', 'Downpipe', 'straight', { opts: ['straight', '45° elbow', 'vertical'] }),
    P('pf', 'Kerb formwork', 'none (PN30-3204)', { opts: ['none (PN30-3204)', 'kerb permanent formwork (PN30-3205)'] }), P('show', 'Views', 'all four (as sheet)', { opts: ['all four (as sheet)', 'selected only'] })], (p) => {
    const LY = new Lay(560), pf = /permanent/.test(p.pf), all = !/selected/.test(p.show);
    const pick = p.str === 'steel' ? 'b' : p.elbow === '45° elbow' ? 'c' : p.elbow === 'vertical' ? 'd' : 'a';
    (all ? ['a', 'b', 'c', 'd'] : [pick]).forEach((V, i) => {
      if (all && i === 2) LY.break();
      kerbDP(LY, { v: V, pf });
    });
    if (pf) LY.block(B => nbox(B, 0, 0, 'NOTE:\nPERMANENT FORMWORK SHOWN IS NON-PREFERRED\nOPTION. REFER TO KERB CONCRETE & DOWNPIPE\nDETAILS - SHEET PN30-3204 FOR ALTERNATIVE.'));
    LY.caption('KERB & DOWNPIPE DETAILS' + (pf ? ' - KERB PERMANENT FORMWORK' : ''), null, pf ? 'PN30-3205' : 'PN30-3204');
    return LY.done();
  }, 'Insitu kerb on the concrete overlay with the φ100 UPVC deck downpipe passing a timber or steel stringer (raking, 45° elbow or vertical); never cut or trim the stringer. PN30-3205 option: kerb permanent formwork (non-preferred).');

  // ================================================================== PN30-3201 CONCRETE OVERLAY GENERAL ARRANGEMENT
  // boxed placeholder text ("XXX" values the designer completes)
  function boxT(v, x, y, s, al, h) { h = h || TH; const p = v.P(x, y), w = s.length * h * 0.72 + 1.6, x0 = al === 'r' ? p[0] - w : al === 'c' ? p[0] - w / 2 : p[0]; v.add({ t: 'pl', p: [[x0, p[1] - 0.9], [x0 + w, p[1] - 0.9], [x0 + w, p[1] + h + 0.9], [x0, p[1] + h + 0.9]], closed: true, L: 'S-TEXT' }); v.add({ t: 'text', p: [x0 + w / 2, p[1]], s, h, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); return w; }
  // fall arrow (solid wedge) on plan / section, paper length 9, pointing dir (+1 right / -1 left)
  function fallW(v, x, y, dir) { const p = v.P(x, y); v.add({ t: 'solid', p: [[p[0] - dir * 4.5, p[1]], [p[0] + dir * 4.5, p[1]], [p[0] - dir * 4.5, p[1] + 1.3]], L: 'S-TEXT' }); }
  // rock protection: semicircle (flat side towards the drain) with gravel fill
  function rockP(v, x, y, r, up) { const k = up ? 1 : -1, pts = [[x - r, y]]; for (let i = 0; i <= 16; i++) { const a = PI * i / 16; pts.push([x - r * Math.cos(a), y + k * r * Math.sin(a)]); } v.pl(pts, true, 'S-NEW'); v.hatch(pts, 'gravel', 'S-HATCH', 0.6); }
  def('ovl', 'Deck & overlay', 'Concrete overlay – general arrangement', 'PN30-3201', [P('ns', 'Number of timber stringers', 7, { num: 1 }), P('Wk', 'Width between kerbs (mm)', 6000, { num: 1 }), P('t', 'Slab thickness (mm)', 130, { num: 1 }), P('xf', 'Crossfall (%)', 3, { num: 1 }),
    P('nsp', 'Number of spans', 4, { num: 1 }), P('Ls', 'Span (mm)', 6000, { num: 1 }), P('wid', 'Outer stringer (widening)', 'steel UB', { opts: ['steel UB', 'none'] })], (p) => {
    const LY = new Lay(740), ns = max(2, min(14, Math.round(+p.ns || 7))), Wk = max(3000, +p.Wk || 6000), t = max(130, +p.t || 130), xf = (+p.xf || 3) / 100, nsp = max(1, min(8, Math.round(+p.nsp || 4))), Ls = max(3000, +p.Ls || 6000), Lb = nsp * Ls, W2 = Wk / 2 + 150, steel = p.wid !== 'none';
    // ---------------- PLAN 1:100
    const psc = Lb > 32000 ? 200 : 100, v = LY.view(psc), ye = 300;
    v.rect(0, -W2, Lb, 2 * W2, 'S-NEW'); v.line(0, Wk / 2, Lb, Wk / 2, 'S-NEW'); v.line(0, -Wk / 2, Lb, -Wk / 2, 'S-NEW');
    v.rect(600, ye - (Wk / 2 - 450), Lb - 900, 2 * (Wk / 2 - 450), 'S-HIDDEN');
    v.line(-3000, ye, Lb + 3200, ye, 'S-CL'); v.line(-3000, 0, Lb + 3200, 0, 'S-CL'); v.text(Lb + 3300, ye, '℄ EXISTING BRIDGE', 2.2, 'l', 'm'); v.text(Lb + 3300, -50, '℄ PROPOSED BRIDGE', 2.2, 'l', 't');
    const sup = [0].concat(Array.from({ length: nsp - 1 }, (_, i) => (i + 1) * Ls), [Lb]);
    sup.forEach((x, i) => { v.cl(x, -W2 - 1600, x, W2 + 4300, i === 0 ? 'ABUTMENT N° 1' : i === nsp ? 'ABUTMENT N° 2' : 'PIER N° ' + i); if (i > 0 && i < nsp) v.line(x, -W2, x, W2, 'S-NEW'); });
    // approach slab (abutment 1) and construction joint
    v.rect(-3000, -W2, 3000, 2 * W2, 'S-NEW'); v.rect(-2800, -W2 + 200, 2500, 2 * W2 - 400, 'S-HIDDEN'); v.line(-100, -W2, -100, W2, 'S-NEW');
    // kerb returns, spoon drains, rock protection, cement stabilised gravel
    [[-3000, -1], [Lb, 1]].forEach(([x0, k]) => [1, -1].forEach(s => {
      const xr = x0 + k * 1500, r = 600, pts = []; for (let i = 0; i <= 8; i++) { const a = PI / 2 * i / 8; pts.push([xr + k * r * Math.sin(a), s * (W2 + r - r * Math.cos(a))]); }
      const P1 = [[x0, s * W2]].concat(pts, [[xr + k * r, s * (W2 + 3000)]]); v.pl(P1, false, 'S-NEW'); v.pl(P1.map(q => [q[0] + k * 150 * (q === P1[0] ? 0 : 1) * 0 + 0, q[1] + s * 150]).map((q, i) => i === 0 ? [x0, s * (W2 + 150)] : i > pts.length ? [xr + k * (r - 150), s * (W2 + 3000)] : [xr + k * (r - 150) * Math.sin(PI / 2 * (i - 1) / 8), s * (W2 + 150 + (r - 150) - (r - 150) * Math.cos(PI / 2 * (i - 1) / 8))]), false, 'S-NEW');
      if (k < 0) { const g = [[x0, s * (W2 + 150)], [xr, s * (W2 + 150)], [xr, s * (W2 + 400)], [x0, s * (W2 + 400)]]; v.hatch(g, 'gravel', 'S-HATCH', 0.5); v.pl(g, true, 'S-TEXT'); }
      v.brk(xr + k * r - 250, s * (W2 + 1900), xr + k * r + 250, s * (W2 + 1900)); rockP(v, xr + k * (r - 75), s * (W2 + 3000), 450, s > 0);
    }));
    // post anchor rods, downpipes, falls, markers
    for (let x = 1000; x < Lb; x += 2000) [1, -1].forEach(s => { const q = v.P(x, s * (W2 - 75)); v.add({ t: 'line', a: [q[0] - 0.9, q[1]], b: [q[0] + 0.9, q[1]], L: 'S-BOLT' }); v.add({ t: 'line', a: [q[0], q[1] - 0.9], b: [q[0], q[1] + 0.9], L: 'S-BOLT' }); });
    for (let i = 0; i < nsp; i++) [1, -1].forEach(s => v.circ(i * Ls + Ls / 2 + 500, s * (Wk / 2 - 120), 60, 'S-NEW'));
    for (let i = 0; i < nsp; i++) { fallW(v, i * Ls + Ls * 0.35, Wk / 4, 1); fallW(v, i * Ls + Ls * 0.7, -Wk / 4, 1); }
    fallW(v, -1800, 600, -1); boxT(v, -1800, 900, 'X', 'c'); fallW(v, Lb + 1600, -200 + 1700, 1); boxT(v, Lb + 1000, 2000, 'X', 'c'); v.text(Lb + 1500, 1550, '(+ve chainage)', 2.0, 'l', 't');
    v.mark(2000, W2 + 1700, 'A', -90, 0); v.mark(2000, -W2 - 1700, 'A', 90, 0); v.line(2000, W2 + 1400, 2000, W2 + 700, 'S-TITLE'); v.line(2000, -W2 - 1400, 2000, -W2 - 700, 'S-TITLE');
    v.mark(Ls * 1.75, ye + 700, 'B', 180); v.mark(1700, Wk / 2 - 900, 'C', 180); v.mark(Lb + 1100, ye - 400, 'C', 180); v.mark(Ls * 1.45, -W2 - 1700, 'D', 90); v.mark(Lb + 1100, -W2 - 1300, 'E', 0);
    { const q = v.P(Ls * 1.5, W2 + 2600); v.add({ t: 'pl', p: [[q[0] - 2, q[1] - 6], [q[0] + 2, q[1] - 6], [q[0] + 2, q[1] + 6], [q[0] - 2, q[1] + 6]], closed: true, L: 'S-TEXT' }); v.add({ t: 'solid', p: [[q[0], q[1] - 5], [q[0] - 1.3, q[1] - 2], [q[0] + 1.3, q[1] - 2]], L: 'S-TEXT' }); v.add({ t: 'text', p: [q[0] + 0.7, q[1] + 1], s: 'FLOW', h: 1.8, al: 'c', v: 'm', ang: 90, L: 'S-TEXT' }); }
    { const q = v.P(-6800, W2 + 2600); v.add({ t: 'solid', p: [[q[0], q[1] + 8], [q[0] - 1.5, q[1] - 6], [q[0], q[1] - 3]], L: 'S-TEXT' }); v.add({ t: 'pl', p: [[q[0], q[1] + 8], [q[0] + 1.5, q[1] - 6], [q[0], q[1] - 3]], closed: true, L: 'S-TEXT' }); v.add({ t: 'text', p: [q[0], q[1] - 10], s: 'N', h: 3, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); }
    v.text(-5850, 0, 'SEALED ROAD', 2.2, 'c', 'b', 'S-TEXT', 90); v.dim(-5600, -W2 - 150, -5600, W2 + 150, 0, '');
    // dimensions
    v.dim(-3000, -W2 - 2400, 0, -W2 - 2400, 0, ''); boxT(v, -1500, -W2 - 2250, 'XXXX', 'c');
    v.dim(0, -W2 - 1200, 700, -W2 - 1200, 0, ''); boxT(v, 800, -W2 - 1350, 'XXX', 'l'); v.text(1500, -W2 - 1350, 'NOM.', 2.2, 'l', 'b');
    v.dim(0, -W2 - 2900, Lb, -W2 - 2900, 0, ''); boxT(v, Lb / 2, -W2 - 2750, 'XXXXX', 'c'); v.text(Lb / 2 + 1000, -W2 - 2750, 'NOM.', 2.2, 'l', 'b');
    v.dim(Lb, -W2 - 2400, Lb + 1500, -W2 - 2400, 0, ''); boxT(v, Lb + 750, -W2 - 2250, 'XXXX', 'c');
    v.dim(Lb + 2700, -W2 - 2950, Lb + 2700, -W2 - 600, 0, ''); boxT(v, Lb + 2550, -W2 - 1800, 'X', 'r');
    v.dim(-200, W2 + 1500, 0, W2 + 1500, 0, ''); boxT(v, -300, W2 + 1400, 'XXX', 'r');
    // labels
    v.leader(-2500, W2 + 75, 4, 36, 'STENCIL BRIDGE NUMBER\nON TOP OF KERB AT\nAPPROACH ENDS OF\nBRIDGE USING 75mm\nLETTERING');
    v.leader(-3500, W2 + 280, -14, -14, '150 THICK CEMENT\nSTABILISED GRAVEL.\nFALLS TO SUIT (TYP)');
    v.leader(-100, -W2 + 400, -30, 12, 'CONSTRUCTION JOINT\n(TYP.)');
    v.leader(-4500, -W2 - 300, -10, -2, 'REINSTATE APPROACH TO\nPROVIDE SMOOTH TRANSITION\n(GRADE 1:200 MAX) BETWEEN\nBRIDGE & EXISTING ROADWAY');
    v.leader(-1500, -W2 + 900, 4, -34, 'APPROACH SLAB\nFOR DETAILS REFER\nTO DRG XX30-XXXX', { dot: true });
    v.leader(-3900, -W2 - 1800, -12, -4, 'SPOON DRAIN\n(TYP)'); v.leader(-3900, -W2 - 3300, 8, -6, 'GROUTED ROCK PROTECTION\n(300 DEEP x φ900 SEMI CIRCLE)\n(TYP)');
    v.leaders([[Ls * 2 + 1000, W2 - 75], [Ls * 2 + 3000, W2 - 75]], 6, 22, 'Xx2 POST ANCHOR RODS\nCAST IN AT 2000 CRS BOTH\nSIDES OF BRIDGE DECK');
    v.cl(Ls * 1.5 + 500, W2 - 300, Ls * 1.5 + 500, W2 + 1200, 'POST'); v.circ(Ls * 1.5 + 500, W2 + 900, 80, 'S-NEW');
    v.leader(Ls * 2, -W2 + 300, 8, -20, 'SAWN CONTRACTION JOINTS\nSHALL EXTEND THE FULL\nWIDTH OF BRIDGE. (TYP)');
    v.leader(Lb + 900, -W2 - 150, 6, 6, '150 WIDE INSITU KERB\nPROFILED TO SUIT (TYP)');
    v.leader(Ls / 2 + 500, -Wk / 2 + 120, 4, -26, '', { noArrow: false });
    { const q = v.P(Ls / 2 + 500, -Wk / 2 + 120), B = new Builder(); nbox(B, 0, 0, 'UPVC DOWNPIPE LOCATE\nIN MID-SPAN AVOIDING\nPOST ANCHOR RODS BY\n500 MIN (TYP)', { solid: true }); nbox(B, 4, -16, 'REFER TO\nPN30-3203'); B.E.forEach(e => { A.shiftE(e, q[0] + 6, q[1] - 24); v.add(e); }); }
    { const B = new Builder(); nbox(B, 0, 0, 'BRIDGE WITH APPROACH\nSLAB AND EXISTING SEAL', { h: 2.6 }); nbox(B, 120, 0, 'DIMENSION FOR GUARDRAIL POST, SEE\nALSO GUARDRAIL DRAWING.'); const q = v.P(-4500, W2 + 6800); B.E.forEach(e => { A.shiftE(e, q[0], q[1]); v.add(e); }); }
    { const B = new Builder(); nbox(B, 0, 0, 'BRIDGE WITHOUT APPROACH\nSLAB AND EXISTING SEAL', { h: 2.6 }); const q = v.P(Lb - 4500, W2 + 6800); B.E.forEach(e => { A.shiftE(e, q[0], q[1]); v.add(e); }); }
    { const B = new Builder(); nbox(B, 0, 0, 'A DETAIL MAY BE REQUIRED TO\nSHOW TRIMMING OF PART OF THE\nWINGWALL/ABUTMENT TO SUIT\nPROPOSED CONCRETE OVERLAY'); const q = v.P(Lb - Ls * 1.3, W2 - 500); B.E.forEach(e => { A.shiftE(e, q[0], q[1]); v.add(e); }); }
    { const B = new Builder(); nbox(B, 0, 0, 'DIMENSION XXX SHALL BE:-\n1. 1000 MIN. FROM END OF WINGWALL\n    OR AS ADVISED BY ENGINEER.\n2. APPROXIMATELY CENTRED BETWEEN\n    TRAFFIC BARRIER POSTS.'); const q = v.P(Lb - 6500, -W2 - 3400); B.E.forEach(e => { A.shiftE(e, q[0], q[1]); v.add(e); }); }
    { const B = new Builder(); nbox(B, 0, 0, 'DIMENSION X SHALL\nBE DETERMINED BY\nENGINEER'); const q = v.P(Lb + 3300, -W2 - 1200); B.E.forEach(e => { A.shiftE(e, q[0], q[1]); v.add(e); }); }
    v.text(Lb + 2400, -W2 - 3700, '℄ SPOON DRAIN (TYP)', 2.2, 'c', 't');
    LY.title('PLAN', psc);
    // placeholders column (sections D, B, detail 1)
    LY.block(B => { placeholder(B, 0, 0, 120, 60, 'SECTION D', 'PN30-3211', 10); placeholder(B, 0, -78, 80, 50, 'SECTION B', 'PN30-3211', 10); placeholder(B, 90, -78, 30, 50, 'DETAIL 1', 'PN30-3211', 1); B.E.push({ t: 'text', p: [30, -84], s: '℄ PIER   ℄ CONTRACTION JOINT', h: 1.8, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); });
    LY.break();
    // ---------------- SECTION A 1:25
    const w = LY.view(25), Wo = Wk / 2 + 300, yDb = -125, yTop = x => t + (Wk / 2 - abs(x)) * xf, kb = yDb - 10, xs = steel ? Wk / 2 - 150 : Wk / 2;
    const sp = (2 * xs - 600 - (steel ? 400 : 0)) / (ns - 1), sx = i => -xs + 300 + i * sp;
    const slab = [[-Wo, kb], [-Wo, t + 100], [-Wk / 2 - 20, t + 100], [-Wk / 2, t + 80], [-Wk / 2 + 6, yTop(-Wk / 2)], [0, yTop(0)], [Wk / 2 - 6, yTop(Wk / 2)], [Wk / 2, t + 80], [Wk / 2 + 20, t + 100], [Wo, t + 100], [Wo, kb], [Wk / 2 - 60, kb]];
    const xdR = steel ? sx(ns - 1) + 100 : Wk / 2 - 60; if (steel) slab.push([Wk / 2 - 60, yDb], [xdR, yDb], [xdR, 0]); else slab.push([Wk / 2 - 60, 0]);
    slab.push([-Wk / 2 + 300, 0], [-Wk / 2 + 300, yDb], [-Wk / 2 + 60, yDb], [-Wk / 2 + 60, kb]);
    w.pl(slab, true, 'S-CONC'); w.hatch(slab, 'conc', 'S-HATCH');
    w.line(-Wk / 2 + 300, -3, xdR, -3, 'S-HIDDEN'); w.line(-Wk / 2 + 300, yDb, xdR, yDb, 'S-EXIST');
    for (let i = 0; i < ns; i++) { logEnd(w, sx(i), yDb - 230, 230); w.text(sx(i), yDb - 230, String(i + 1), 2.6, 'c', 'm'); }
    if (steel) { const ub = SEC['410UB54'], ux = Wk / 2 - 200; iSec(w, ux, yDb - ub.d / 2, ub, 0, 'S-NEW'); w.text(ux - 140, yDb - 200, String(ns + 1), 2.6, 'c', 'm'); w.rect(Wk / 2 - 50, kb - 500, 100, 500 + 30, 'S-NEW'); w.line(-Wk / 2 + 300, yDb, Wk / 2, yDb, 'S-NEW'); }
    { const a = 80 * PI / 180, x0 = -Wk / 2 + 120, L = 900; w.pl([[x0 - 50, 30], [x0 - 50 - L * Math.cos(a), 30 - L * Math.sin(a)], [x0 + 50 - L * Math.cos(a), 30 - L * Math.sin(a)], [x0 + 50, 30]], false, 'S-NEW'); }
    w.line(0, yDb, 0, yTop(0), 'S-NEW'); w.fill([[-250, yTop(-250)], [250, yTop(250)], [250, yTop(250) + 12], [-250, yTop(-250) + 12]]);
    w.cl(0, yTop(0) + 20, 0, t + 1950, 'PROPOSED BRIDGE'); w.cl(-300, yDb - 300, -300, t + 1250, 'EXISTING BRIDGE');
    const dl = (y, b, s) => { const tw = s.length * TH * 0.8 * 25; w.text(-200, y, s, TH, 'r', 'b'); boxT(w, -200 - tw - 40, y, b, 'r'); };
    w.dim(-Wo, t + 100, Wo, t + 100, 2450 / 25, ''); dl(t + 2580, 'XXXX', 'OVERALL');
    w.dim(-Wk / 2, t + 80, 0, t + 80, 1620 / 25, '='); w.dim(0, t + 80, Wk / 2, t + 80, 1620 / 25, '='); dl(t + 1750, 'XXXX', 'PROPOSED WIDTH BETWEEN KERBS');
    const exL = -Wk / 2 + 250, exR = Wk / 2 - 850; w.dim(exL, 0, exR, 0, (t + 920) / 25, ''); dl(t + 1000, 'XXXX', 'EXISTING WIDTH BETWEEN KERBS'); w.text(-450, t + 1000, '', TH);
    w.dim(-300, yTop(0), 0, yTop(0), 650 / 25, ''); boxT(w, -150, yTop(0) + 720, 'XXX', 'c'); w.dim(-250, yTop(0), 0, yTop(0), 300 / 25, '=', { h: 1.8 }); w.dim(0, yTop(0), 250, yTop(0), 300 / 25, '=', { h: 1.8 });
    finishMark(w, -Wk / 3, yTop(-Wk / 3), 'U3'); w.text(-Wk / 3 + 150, yTop(-Wk / 3) + 60, '(BROOM FINISH)', 2.2, 'l', 'b');
    [[-Wk / 7, -1], [Wk / 6, 1]].forEach(([x, k]) => { fallW(w, x, yTop(x) + 150, k); w.text(x - k * 50, yTop(x) + 260, 'X%', 2.2, 'c', 'b'); });
    w.leader(-Wk / 2 + 200, t - 20, -6, 14, '130 MIN'); w.leader(Wk / 2 - 200, t - 20, 6, 14, '130 MIN');
    w.leader(150, yTop(150) + 12, 12, 26, ''); { const q = w.P(150, yTop(150) + 12), B = new Builder(); nbox(B, 0, 0, '500 WIDE BITUTHENE XXXX BY\nW.R. GRACE OR SIMILAR APPROVED'); B.E.forEach(e => { A.shiftE(e, q[0] + 14.5, q[1] + 28.5); w.add(e); }); }
    w.leader(0, -60, 10, -22, ''); { const q = w.P(0, -60), B = new Builder(); nbox(B, 0, 0, 'CONSTRUCTION JOINT'); nbox(B, 60, -4, 'FOR CONCRETE OVERLAYS WITH ROAD SEAL AND\nCONSTRUCTED IN TWO STAGES USING THE\nCONSTRUCTION JOINT OPTION, BITUTHENE SHALL\nBE PLACED OVER JOINT PRIOR TO ROAD SEAL\nBEING APPLIED.\nFOR BRIDGES WITH NO ROAD SEAL A SEALED\nJOINT IS REQUIRED REFER TO PN30-3210.'); B.E.push({ t: 'line', a: [52, -3], b: [60, -8], L: 'S-NOTE' }); B.E.forEach(e => { A.shiftE(e, q[0] + 12.5, q[1] - 19); w.add(e); }); }
    { const q = w.P(-Wk / 2 + 600, yDb - 560), B = new Builder(); nbox(B, 0, 0, 'NOTE\nEXISTING TIMBER DECK SHALL BE COVERED\nWITH ONE LAYER OF 1800 WIDE 280g (10oz)\nHESSIAN, FIXED TO TIMBER DECK AT\n1 METRE SQUARE INTERVALS.', { solid: true }); B.E.forEach(e => { A.shiftE(e, q[0], q[1]); w.add(e); }); }
    LY.title('SECTION A', 25);
    LY.block(B => { placeholder(B, 0, 0, 110, 50, 'SECTION C', 'PN30-3213 OR PN30-3213A', 10); B.E.push({ t: 'text', p: [30, -4], s: 'BRIDGE WITH APPROACH SLAB', h: 2, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); placeholder(B, 118, 0, 50, 50, 'SECTION C', 'PN30-3212', 10); B.E.push({ t: 'text', p: [120, -4], s: 'BRIDGE WITHOUT APPROACH SLAB', h: 1.8, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); });
    LY.break();
    LY.block(B => placeholder(B, 0, 0, 170, 60, 'KERB AND DOWNPIPE DETAILS', 'PN30-3204 AND PN30-3205', 10));
    LY.block(B => { placeholder(B, 0, 0, 120, 62, 'SECTION E', 'PN30-4206', null);
      const t2 = (x, y, s) => B.E.push({ t: 'text', p: [x, y], s, h: 1.9, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' });
      B.E.push({ t: 'pl', p: [[8, -12], [20, -12]], L: 'S-GROUND' }, { t: 'pl', p: [[38, -12], [50, -12]], L: 'S-GROUND' }, { t: 'pl', p: [[20, -12], [20, -22], [38, -22], [38, -12]], closed: false, L: 'S-NEW' });
      B.E.push({ t: 'arc', c: [29, -12], r: 6, a0: 180, a1: 360, L: 'S-NEW' }, { t: 'line', a: [20, -12], b: [23, -12], L: 'S-NEW' }, { t: 'line', a: [35, -12], b: [38, -12], L: 'S-NEW' });
      t2(36, -6, '125 ✱ (INSITU OPTION)'); t2(54, -26, '225 x 600 CONCRETE SURFACE'); t2(54, -29.5, 'DRAIN (BY GALVINS OR SIMILAR'); t2(54, -33, 'APPROVED) OR ✱ APPROVED'); t2(54, -36.5, 'INSITU CONSTRUCTION.'); B.E.push({ t: 'line', a: [38, -22], b: [53, -26], L: 'S-TEXT' });
      ['✱ APPROVED INSITU CONSTRUCTION OF', '   A MASS CONCRETE DRAIN REQUIRES', '   REINFORCING (MINIMUM REINF RL41', '   FABRIC WITH 50 MINIMUM COVER TOP', '   AND BOTTOM) RL81 OFFCUTS CAN BE', '   USED. LAP MESH AS REQUIRED.'].forEach((l, i) => t2(54, -42 - i * 3.3, l)); });
    LY.notes(['FOR GENERAL NOTES REFER TO DRG N° XXXX-XXXX.'], 110);
    LY.block(B => { B.E.push({ t: 'text', p: [0, 0], s: 'THIS DRAWING SHALL BE READ IN CONJUNCTION WITH DRG N° XX30-XXXX', h: 2.8, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); B.E.push({ t: 'pl', p: [[-2, -2], [125, -2], [125, 5], [-2, 5]], closed: true, L: 'S-TEXT' }); });
    LY.caption('CONCRETE OVERLAY GENERAL ARRANGEMENT', null, 'PN30-3201');
    return LY.done();
  }, 'Plan and typical section of the reinforced concrete overlay on the existing timber deck (approach slab, kerbs, post anchor rods, downpipes, sawn contraction joints at piers, construction joint on the bridge centre line) with references to the kerb, joint and abutment-end details.');
  // ================================================================== PN30-3202 CONCRETE OVERLAY REINFORCEMENT
  // fabric extent line (MRWA fabric layout): line with end ticks, circle at the sheet centre point c
  function extLine(v, x1, y1, x2, y2, c) { v.line(x1, y1, x2, y2, 'S-TEXT'); const a = v.P(x1, y1), b = v.P(x2, y2), h = abs(b[0] - a[0]) > abs(b[1] - a[1]);[a, b].forEach(q => v.add({ t: 'line', a: h ? [q[0], q[1] - 1.2] : [q[0] - 1.2, q[1]], b: h ? [q[0], q[1] + 1.2] : [q[0] + 1.2, q[1]], L: 'S-TEXT' })); if (c) v.add({ t: 'circle', c: v.P(c[0], c[1]), r: 0.8, L: 'S-TEXT' }); }
  function fabSheet(v, x, y, w, h, pat, sc) { const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; v.pl(pts, true, 'S-REO'); v.hatch(pts, pat || 'ansi31', 'S-HATCH', sc || 1); }
  function vbox(v, x, y, s, opt) { const B = new Builder(), r = nbox(B, 0, 0, s, opt), q = v.P(x, y); B.E.forEach(e => { A.shiftE(e, q[0], q[1]); v.add(e); }); return r; }
  def('pn3202', 'Deck & overlay', 'Concrete overlay – reinforcement layout', 'PN30-3202', [P('wid', 'Outer stringer (widening)', 'steel UB', { opts: ['steel UB', 'none'] })], (p) => {
    const LY = new Lay(740), Wk = 6000, W2 = Wk / 2 + 150, xE = -750, xP = 4300, gap = 2200, xQ = 7600, xA = xQ + 4300, xF = xA + 400, steel = p.wid !== 'none';
    const v = LY.view(50);
    // deck outline (two parts with a break between pier 1 and pier X)
    [[xE, 5300], [6600, xF]].forEach(([a, b]) => { v.line(a, W2, b, W2, 'S-NEW'); v.line(a, -W2, b, -W2, 'S-NEW'); v.line(a, Wk / 2, b, Wk / 2, 'S-HIDDEN'); v.line(a, -Wk / 2, b, -Wk / 2, 'S-HIDDEN'); });
    v.line(xE, -W2, xE, W2, 'S-NEW'); v.line(xF, -W2, xF, W2, 'S-NEW'); [5300, 6600].forEach(x => v.brk(x, -W2 - 300, x, W2 + 300)); v.rect(xE - 2000, -W2 - 150, 2000, 2 * W2 + 300, 'S-HIDDEN');
    v.line(xE - 900, 300, xF + 1800, 300, 'S-CL'); v.line(xE - 900, 0, xF + 1800, 0, 'S-CL'); v.text(xF + 1900, 300, '℄ EXISTING BRIDGE', 2.2, 'l', 'm'); v.text(xF + 1900, -60, '℄ PROPOSED BRIDGE', 2.2, 'l', 't');
    [[0, 'ABUTMENT N° 1'], [xP, 'PIER N° 1'], [xQ, 'PIER N° X'], [xA, 'ABUTMENT N° 2']].forEach(([x, l]) => v.cl(x, -W2 - 600, x, W2 + 2600, l));
    // fabric sheets
    fabSheet(v, xE + 150, W2 - 150, 3700 - xE, 150, 'ansi31', 0.7); fabSheet(v, xQ + 500, W2 - 200, xF - xQ - 500, 200, 'ansi31', 0.7); fabSheet(v, xQ + 400, -W2, xF - xQ - 400, 200, 'ansi31', 0.7);
    fabSheet(v, 250, 0, 450, W2 - 200, 'ansi31', 1.4); fabSheet(v, xE + 150, -W2, 600 + 300 - 150, W2, 'ansi31', 1.4); fabSheet(v, 450, -W2, 3800, 1150, 'ansi31', 0.8); fabSheet(v, 250, -W2, 200, 1150, 'ansi37', 0.5);
    fabSheet(v, xP - 150, 0, 900, W2 - 200, 'ansi31', 1.4); v.line(xP + 750, 0, xP + 750, W2 - 200, 'S-REO'); fabSheet(v, xQ + 400, -100, xF - xQ - 550, 350, 'ansi31', 0.8);
    fabSheet(v, xF - 250, -W2, 220, W2 - 100, 'ansi31', 0.6); fabSheet(v, xF - 250, -W2, 220, 200, 'ansi37', 0.5); fabSheet(v, xF - 250, -100, 220, 200, 'ansi37', 0.5);
    [[475, W2 / 2], [-300, -W2 / 2], [2000, -W2 + 575], [xP + 300, W2 / 2]].forEach(([x, y]) => { const q = v.P(x, y); [-0.6, 0.6].forEach(o => { v.add({ t: 'line', a: [q[0] + o, q[1] - 1.5], b: [q[0] + o, q[1] + 1.5], L: 'S-TEXT' }); v.add({ t: 'line', a: [q[0] - 1.5, q[1] + o], b: [q[0] + 1.5, q[1] + o], L: 'S-TEXT' }); }); });
    // existing bridge (dashed) and post anchors
    v.line(xE + 800, W2 - 600, 5300, W2 - 600, 'S-HIDDEN'); v.line(6600, W2 - 600, xA, W2 - 600, 'S-HIDDEN'); v.line(xE + 800, -W2 + 1200, 5300, -W2 + 1200, 'S-HIDDEN'); v.line(6600, -W2 + 1200, xA - 300, -W2 + 1200, 'S-HIDDEN'); v.line(xA - 300, -W2 + 1200, xA - 300, W2 - 600, 'S-HIDDEN');
    v.cl(5000, W2 - 300, 5000, W2 + 1100, 'POST'); v.circ(5000, W2 + 800, 60, 'S-NEW'); [W2 - 50, W2 - 250].forEach(y => v.rect(4970, y - 60, 60, 120, 'S-BOLT'));
    // fabric extent lines
    extLine(v, xE - 50, W2 + 1700, xP - 900, W2 + 1700, [1800, W2 + 1700]); extLine(v, 7000, W2 + 1700, xA + 700, W2 + 1700); v.brk(5800, W2 + 1700, 5900, W2 + 1700);
    extLine(v, 6900, W2 + 1150, xA + 1000, W2 + 1150, [10500, W2 + 1150]); extLine(v, 6900, W2 + 600, xA - 700, W2 + 600);
    extLine(v, xE + 150, W2 - 500, xP + 1100, W2 - 500); extLine(v, 6900, W2 - 500, xF, W2 - 500); extLine(v, xE + 150, -W2 / 2 + 1000, xP + 1100, -W2 / 2 + 1000); extLine(v, 6900, -1200, xF, -1200, [10300, -1200]);
    extLine(v, -2200, -W2, -2200, W2, [-2200, -W2 / 2 - 400]); extLine(v, -1900, -W2, -1900, W2, [-1900, W2 / 2 + 300]); extLine(v, xF + 1200, -W2, xF + 1200, W2, [xF + 1200, -W2 / 2 - 400]);
    extLine(v, xE + 1400, -W2 - 1100, xA, -W2 - 1100, [2000, -W2 - 1100]); extLine(v, xE + 150, -W2 - 1800, xA + 450, -W2 - 1800, [10300, -W2 - 1800]);
    // markers, falls
    v.mark(1600, W2 + 3000, 'A', -90); v.line(1600, W2 + 2700, 1600, W2 + 2100, 'S-TITLE'); v.mark(1600, -W2 - 2900, 'A', 90); v.line(1600, -W2 - 2600, 1600, -W2 - 2100, 'S-TITLE');
    v.mark(2300, W2 - 1000, 'B', 90); v.line(1700, W2 - 1000, 2150, W2 - 1000, 'S-TITLE'); v.mark(xF + 2000, -600, 'B', 90); v.line(xF + 1550, -600, xF + 1850, -600, 'S-TITLE');
    v.mark(xQ + 1700, 1000, 'C', -90); v.line(xQ + 1100, 1000, xQ + 1550, 1000, 'S-TITLE'); v.mark(-1000, -W2 + 1200, 'D', 0); v.line(-2600, -W2 + 1200, -1150, -W2 + 1200, 'S-TITLE');
    fallW(v, -1300, W2 - 1000, -1); fallW(v, xQ - 500, 1000, -1); fallW(v, xA - 1100, -700, -1); fallW(v, xF + 2500, W2 - 1600, 1); boxT(v, xF + 1800, W2 - 900, 'X', 'c'); v.text(xF + 2200, W2 - 1000, '(+ve chainage)', 2.0, 'l', 't');
    fallW(v, -4800, -W2 + 1000, -1); boxT(v, -4800, -W2 + 1200, 'X', 'c');
    { const q = v.P(xQ - 1300, W2 + 2600); v.add({ t: 'pl', p: [[q[0] - 2, q[1] - 6], [q[0] + 2, q[1] - 6], [q[0] + 2, q[1] + 6], [q[0] - 2, q[1] + 6]], closed: true, L: 'S-TEXT' }); v.add({ t: 'solid', p: [[q[0], q[1] - 5], [q[0] - 1.3, q[1] - 2], [q[0] + 1.3, q[1] - 2]], L: 'S-TEXT' }); v.add({ t: 'text', p: [q[0] + 0.7, q[1] + 1], s: 'FLOW', h: 1.8, al: 'c', v: 'm', ang: 90, L: 'S-TEXT' }); }
    // labels
    v.leader(1800, W2 + 1700, 2, 14, 'SL81 KERB FABRIC\nTYPE 4 (T)\n(TYP BOTH SIDES)', { dot: true });
    v.leader(xP + 750, W2 - 500, 4, 25, 'SL81 DECK FABRIC\nTYPE X (T)\n(TYP BOTH SIDES)', { dot: true });
    v.leader(-2200, -W2 / 2 - 400, -10, 0, 'SL81 FABRIC\nTYPE 9 (B)', { dot: true }); v.leader(-1900, W2 / 2 + 300, -16, 0, 'SL81 FABRIC\nTYPE 9', { dot: true });
    v.leader(2000, -W2 - 1800, 1, -10, 'SL81 FABRIC\nTYPE 9 (B)', { dot: true });
    v.leader(10500, W2 + 1150, 1, 14, 'SL81 FABRIC\nTYPE 9 (B)', { dot: true });
    v.leader(10300, -1200 + 1500, 22, 12, 'SL81 LAP FABRIC\nTYPE 8 (T)', { dot: true });
    v.leader(xF + 1200, -W2 / 2 - 400, 12, 0, 'SL81 DROP PANEL FABRIC\nTYPE X\n(TYP)', { dot: true });
    v.leader(10300, -W2 - 1800, 1, -10, 'SL81 DROP PANEL FABRIC\nTYPE 7 (B)\n(TYP BOTH SIDES)', { dot: true });
    v.leaders([[6000, W2 + 1700], [6000, W2 + 1150], [6000, W2 + 600]], -8, 12, 'Xx2 POST ANCHOR RODS\nCAST IN AT 2000 CRS BOTH\nSIDES OF BRIDGE DECK', { noArrow: true });
    v.dim(-200, W2 + 2100, 0, W2 + 2100, 0, ''); boxT(v, -300, W2 + 2300, 'XXX', 'r');
    vbox(v, -6200, W2 + 2600, 'DIMENSION FOR GUARDRAIL POST, SEE\nALSO GUARDRAIL DRAWING.'); vbox(v, -5800, W2 + 1500, 'BRIDGE WITH\nAPPROACH SLAB', { h: 2.6 }); vbox(v, xQ + 500, W2 + 3900, 'BRIDGE WITHOUT\nAPPROACH SLAB', { h: 2.6 });
    vbox(v, 2700, -W2 - 2500, 'NOTE: FABRIC TYPE 9 SHALL\nBE CUT ON SITE TO SUIT', { solid: true }); vbox(v, 5700, -W2 - 2500, 'NOTE: FOR STANDARD FABRIC DETAILS\n(FABRIC TYPES 1 TO 12) REFER TO\nDRG N° 9030-0243', { solid: true });
    LY.title('PLAN', 50);
    LY.block(B => { placeholder(B, 0, 0, 75, 65, 'TYPICAL DECK FABRIC LAP', 'PN30-3210', 10); placeholder(B, 0, -85, 75, 110, 'KERB CONTRACTION JOINT DETAIL', 'PN30-3208', 10, 'KERB FABRIC SPLICE DETAIL / SECTION E'); });
    LY.block(B => { placeholder(B, 0, 0, 100, 55, 'SECTION C', 'PN30-3211', 10, 'TYPICAL ALL PIERS', 'PIER CONTRACTION JOINT DETAIL REFER MANUAL');
      placeholder(B, 0, -85, 100, 75, 'SECTION B', 'PN30-3213 OR PN30-3213A', 10, null, 'SILL BEAM DETAIL REFER MANUAL'); placeholder(B, 106, -85, 42, 75, 'SECTION B', 'PN30-3212', 10, null, 'DROP PANEL DETAIL'); });
    LY.break();
    // ---------------- SECTION A 1:25 (fabric)
    const w = LY.view(25), t = 130, Wo = Wk / 2 + 300, yDb = -125, yTop = x => t + (Wk / 2 - abs(x)) * 0.03, kb = yDb - 10, ns = 7, xs = steel ? Wk / 2 - 150 : Wk / 2, sp = (2 * xs - 600 - (steel ? 400 : 0)) / (ns - 1), sx = i => -xs + 300 + i * sp;
    const slab = [[-Wo, kb], [-Wo, t + 100], [-Wk / 2 - 20, t + 100], [-Wk / 2, t + 80], [-Wk / 2 + 6, yTop(-Wk / 2)], [0, yTop(0)], [Wk / 2 - 6, yTop(Wk / 2)], [Wk / 2, t + 80], [Wk / 2 + 20, t + 100], [Wo, t + 100], [Wo, kb], [Wk / 2 - 60, kb]];
    const xdR = steel ? sx(ns - 1) + 100 : Wk / 2 - 60; if (steel) slab.push([Wk / 2 - 60, yDb], [xdR, yDb], [xdR, 0]); else slab.push([Wk / 2 - 60, 0]);
    slab.push([-Wk / 2 + 400, 0], [-Wk / 2 + 400, yDb], [-Wk / 2 + 60, yDb], [-Wk / 2 + 60, kb]);
    w.pl(slab, true, 'S-CONC'); w.line(-Wk / 2 + 400, yDb, xdR, yDb, 'S-EXIST');
    for (let i = 0; i < ns; i++) logEnd(w, sx(i), yDb - 230, 230);
    if (steel) { const ub = SEC['410UB54']; iSec(w, Wk / 2 - 200, yDb - ub.d / 2, ub, 0, 'S-NEW'); }
    // top deck fabric (dashed in section), lap fabric at the centre line, kerb fabric loops, type 9 at the kerb downstands
    const fy = x => yTop(x) - 45; [[-Wk / 2 + 60, -150], [150, Wk / 2 - 60]].forEach(([a, b]) => { const pts = []; for (let x = a; x <= b + 1; x += (b - a) / 10) pts.push([x, fy(x)]); w.pl(pts, false, 'S-REO'); });
    w.pl([[-500, fy(-500) - 12], [0, fy(0) - 12], [500, fy(500) - 12]], false, 'S-REO'); w.fill([[-250, fy(-250) - 16], [250, fy(250) - 16], [250, fy(250) - 8], [-250, fy(-250) - 8]]);
    [-1, 1].forEach(k => { const x0 = k * (Wk / 2 + 150); w.pl([[x0 - 110, t + 60], [x0 + 110, t + 60], [x0 + 110, kb + 40], [x0 - 110, kb + 40], [x0 - 110, t + 60]], false, 'S-REO'); w.line(x0 - 110 * k - k * 300, kb + 55, x0 + 120 * k, kb + 55, 'S-REO'); });
    w.cl(0, yTop(0) + 20, 0, t + 900, 'PROPOSED BRIDGE'); w.cl(-300, yDb - 300, -300, t + 500, 'EXISTING BRIDGE');
    w.circ(0, fy(0) - 10, 380, 'S-TEXT'); w.mark(400, t + 700, '1'); w.line(250, fy(0) + 270, 330, t + 640, 'S-TEXT');
    { const q = w.P(Wk / 2 + 50, yTop(Wk / 2) - 60); w.add({ t: 'pl', p: ellP(q[0], q[1], 26, 9, 36).concat([ellP(q[0], q[1], 26, 9, 36)[0]]), closed: true, L: 'S-TEXT' }); } w.mark(Wk / 2 - 200, t + 900, '2'); w.line(Wk / 2 - 260, t + 780, Wk / 2 - 400, yTop(Wk / 2 - 400) + 160, 'S-TEXT');
    w.leader(-Wk / 4, fy(-Wk / 4), -10, 16, 'SL81 DECK FABRIC\nTYPE X'); w.leader(Wk / 4, fy(Wk / 4), 6, 16, 'SL81 DECK FABRIC\nTYPE X'); w.leader(150, fy(150) - 14, 12, -16, 'SL81 LAP FABRIC\nTYPE 8');
    w.leader(-Wk / 2 + 60, kb + 55, -8, -12, 'SL81 FABRIC\nTYPE 9'); w.leader(Wk / 2 + 150, t + 60, 8, 14, 'SL81 KERB FABRIC\nTYPE 4\n(TYP)'); w.leader(Wk / 2 + 40, kb + 40, 12, -8, 'SL81 DROP PANEL FABRIC\nTYPE X (CUT VERTICAL\nLEG TO SUIT)\n(TYP)'); w.leader(Wk / 2 - 600, yDb + 15, -2, -16, 'RF81 FABRIC\nTYPE 9');
    LY.title('SECTION A', 25);
    LY.block(B => { placeholder(B, 0, 0, 70, 45, 'DETAIL 1', 'PN30-3210', 10, null, 'DECK FABRIC LAP DETAIL REFER MANUAL'); placeholder(B, 78, 0, 110, 55, 'DETAIL 2', 'PN30-3207', 10, null, 'KERB FABRIC DETAIL REFER MANUAL');
      placeholder(B, 0, -75, 188, 50, 'VIEW D', 'PN30-3213 OR PN30-3213A', 20, 'EXPANSION ANGLE OMITTED', 'SILLBEAM REINFORCEMENT DETAIL REFER MANUAL'); });
    LY.notes(['FOR GENERAL NOTES REFER TO DRG N° XXXX-XXXX.'], 110);
    LY.block(B => { B.E.push({ t: 'text', p: [0, 0], s: 'THIS DRAWING SHALL BE READ IN CONJUNCTION WITH DRG N° XX30-XXXX', h: 2.8, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }); B.E.push({ t: 'pl', p: [[-2, -2], [125, -2], [125, 5], [-2, 5]], closed: true, L: 'S-TEXT' }); });
    LY.caption('CONCRETE OVERLAY REINFORCEMENT', null, 'PN30-3202');
    return LY.done();
  }, 'Fabric layout for the reinforced concrete overlay: SL81 kerb fabric Type 4, deck fabric Type X at piers, lap fabric Type 8 on the centre line, Type 9 at the abutment ends and drop panel fabric, with references to the fabric details.');

  // ================================================================== PN30-3203 DOWNPIPE & SCUPPERS (notes sheet)
  def('pn3203', 'Deck & overlay', 'Downpipes & scuppers – layout notes', 'PN30-3203', [], () => {
    const LY = new Lay(); LY.block(B => {
      const T = (x, y, s, h, L) => B.E.push({ t: 'text', p: [x, y], s, h: h || 3.2, al: 'l', v: 'b', ang: 0, L: L || 'S-TEXT' }), U = (x, y, s) => { T(x, y, s, 5, 'S-TITLE'); B.E.push({ t: 'line', a: [x - 1, y - 1.6], b: [x + s.length * 5 * 0.72, y - 1.6], L: 'S-TITLE' }); };
      U(0, 0, 'DOWNPIPE'); T(0, -14, '1.'); T(8, -14, 'BRIDGE WITH TWO WAY CROSSFALL :-'); T(8, -24, '1.1.'); T(20, -24, 'ONE DOWNPIPE ON EACH SIDE IN APPROXIMATELY'); T(20, -30, 'THE CENTRE OF EACH SPAN.');
      T(0, -42, '2.'); T(8, -42, 'BRIDGE WITH SUPER ELEVATION :-'); T(8, -52, '2.1.'); T(20, -52, 'ONE DOWNPIPE ON LOW SIDE IN APPROXIMATELY'); T(20, -58, 'THE CENTRE OF EACH SPAN.');
      T(0, -72, '3.'); T(8, -72, 'REFER KERB CONCRETE & DOWNPIPE DETAILS - PRACTICE'); T(8, -78, 'NOTES PN30-3204 & PN30-3205.');
      U(0, -96, 'SCUPPERS (EXISTING)'); T(0, -110, '1.'); T(8, -110, 'REFER EXISTING SCUPPER REPAIR DETAIL - PRACTICE'); T(8, -116, 'NOTES PN30-3206.');
    });
    LY.caption('DOWNPIPE & SCUPPERS', null, 'PN30-3203'); return LY.done();
  }, 'Downpipe locations (one each side near mid-span for two-way crossfall, low side only for superelevation) and the reference to the scupper repair detail.');

  // ================================================================== PN30-3206 SCUPPER PLATE DETAIL
  def('pn3206', 'Deck & overlay', 'Scupper plate detail', 'PN30-3206', [], () => {
    const LY = new Lay();
    // oblique sketch (no scale): plate 300 wide with 20 downturn flap, hole with sealant
    const s = LY.view(6), u = [0.82, 0.48], k = [-0.45, 0.3], O = (a, b, c) => [a * u[0] + c * k[0], a * u[1] - b + c * k[1]];
    const H = 380; s.pl([O(0, 0, 0), O(300, 0, 0), O(300, H, 0), O(0, H - 60, 0)], false, 'S-NEW'); s.line(...O(0, 0, 0), ...O(0, H - 60, 0), 'S-NEW');
    s.pl([O(0, 0, 0), O(0, 0, 20), O(300, 0, 20), O(300, 0, 0)], false, 'S-NEW'); s.line(...O(300, 0, 20), ...O(300, H, 20), 'S-NEW'); s.line(...O(300, H, 20), ...O(300, H, 0), 'S-NEW'); s.line(...O(0, 0, 20), ...O(0, 20, 20), 'S-NEW');
    s.pl([O(0, H - 60, 0), O(120, H - 60 + 25, 0), O(130, H - 30, 0), O(150, H - 60 + 40, 0), O(300, H, 0)].map((q, i) => q), false, 'S-TEXT');
    const hole = [O(70, 60, 0), O(260, 60, 0), O(260, 120, 0), O(70, 120, 0)]; s.pl(hole, true, 'S-NEW'); s.hatch([O(85, 70, 0), O(245, 70, 0), O(245, 110, 0), O(85, 110, 0)], 'ansi31', 'S-HATCH', 0.6); s.pl([O(55, 45, 0), O(275, 45, 0), O(275, 135, 0), O(55, 135, 0)], true, 'S-HIDDEN');
    s.dim(...O(0, 0, 20), ...O(0, 0, 0), 6, '20'); s.dim(...O(0, 0, 0), ...O(300, 0, 0), 8, '300'); s.dim(...O(0, 0, 0), ...O(0, 20, 0), -6, '20');
    s.leader(...O(260, 70, 0), 16, 18, ''); { const q = s.P(...O(260, 70, 0)), B = new Builder(); nbox(B, 0, 0, 'NOTE:\nAPPLY SILICON SEALANT\nTO DOWNTURN FLAP AND\nPERIMETER OF HOLE', { solid: true, h: 2.6 }); B.E.forEach(e => { A.shiftE(e, q[0] + 18.5, q[1] + 30); s.add(e); }); }
    s.leader(...O(300, 250, 20), 10, 6, 'GALV. 0.8 THICK\nPGI SHEET'); s.leader(...O(150, 110, 0), -18, -26, 'HOLE SIZE TO MATCH\nEXISTING SCUPPER SIZE');
    // section 1:20
    const v = LY.view(20), yT = 0, yB = -150, R = 200, sy = yB - R, yE = sy - R - 100;
    v.rect(-20, 0, 20, 75, 'S-EXIST'); v.rect(0, 0, 150, 75, 'S-EXIST'); v.hatch([[0, 0], [150, 0], [150, 75], [0, 75]], 'ansi31', 'S-HATCH', 0.6);
    [0, -75, yB].forEach(y => v.line(0, y, 1100, y, 'S-EXIST')); v.brk(1100, -75, 1100, 75); v.brk(1180, yB, 1180, -75);
    logEnd(v, 300, sy, R); v.rect(-24, yE, 16, 75 - yE, 'S-NEW');
    [-40, sy].forEach(y => v.line(-30, y, 30, y, 'S-BOLT'));
    v.dim(-150, sy - R, -150, yE, 4, '100');
    v.leader(-24, 50, -12, 0, 'SCUPPER PLATE'); v.leaders([[-8, -40], [-8, sy]], -18, -16, '2-30x2.8 CLOUT\nHEAD NAILS (GALV)\n(4 NAILS TOTAL)'); v.leader(150, 50, 20, 18, 'EXISTING\nSCUPPER'); v.leader(600, -75, 22, 12, 'EXISTING\nTIMBER DECK'); v.leader(300 + R, sy, 14, 0, 'EXISTING\nSTRINGER');
    LY.title('SCUPPER PLATE DETAIL', 20, 'TYPICAL ALL SCUPPERS');
    LY.block(B => nbox(B, 0, 0, 'NOTE:\nINSTALL SCUPPER PLATES AT\nALL EXISTING SCUPPER LOCATIONS\nONLY AFTER CLEARING', { solid: true, h: 2.6 }));
    LY.caption('SCUPPER PLATE DETAIL', null, 'PN30-3206'); return LY.done();
  }, 'Galvanised 0.8 PGI scupper plate fitted at every existing scupper after clearing, extending 100 below the stringer, sealed and nailed.');

  // ================================================================== PN30-3209 KERB PERMANENT FORMWORK
  def('pn3209', 'Deck & overlay', 'Kerb permanent formwork (non-preferred)', 'PN30-3209', [P('H', 'Formwork height (mm, ≤ 500)', 450, { num: 1 })], (p) => {
    const LY = new Lay(), H = max(260, min(500, +p.H || 450)), v = LY.view(5);
    v.pl([[-120, 10], [-120, 0], [0, 0], [0, 230], [-30, 230], [-30, 220]], false, 'S-NEW');
    v.pl([[6, 20], [6, H], [-24, H], [-24, H - 10]], false, 'S-NEW');
    [45, 120, 195].forEach(y => { v.line(6, y, 22, y, 'S-BOLT'); v.line(22, y - 6, 22, y + 6, 'S-BOLT'); });
    v.dim(-30, H, 6, H, 14, '30'); v.dim(-30, 230, 6, 230, 30, '30'); v.dim(-120, 0, 0, 0, -10, '120');
    v.dim(-50, H, -50, H - 10, 6, '10'); v.dim(-50, 230, -50, 220, 6, '10'); v.dim(-140, 10, -140, 0, -2, '10');
    v.dim(-140, 0, -140, 230, 6, '230'); v.dim(-30, 20, -30, 45, 4, '25', { sub: '(TYP)' }); v.dim(60, 45, 60, 230, -4, '100 MIN.'); v.dim(110, 0, 110, H, -4, 'VARIES - 500 MAXIMUM');
    v.leaders([[6, H - 80], [0, 150]], -30, 10, '2 THICK GALV SHEET\n2000 LONG'); v.leader(22, 45, 18, -16, 'POP RIVET OR SELF\nTAPPER SCREW AT\n250 CRS STAGGERED\n(TYP)');
    const q = v.P(8, H - 150); v.add({ t: 'line', a: [q[0] + 1.5, q[1]], b: [q[0] + 12, q[1]], L: 'S-NEW' }); v.add({ t: 'solid', p: [[q[0], q[1]], [q[0] + 3.5, q[1] + 1.2], [q[0] + 3.5, q[1] - 1.2]], L: 'S-NEW' }); v.leader(8, H - 150, 14, 34, 'PROP FORMWORK\nTO SUIT', { noArrow: true });
    LY.title('KERB PERMANENT FORMWORK', 5, '(NON-PREFERRED OPTION)');
    LY.block(B => nbox(B, 0, 0, 'NOTE:\nNOT FOR LOCATIONS WITHIN 50km OF THE COAST\nAND SALT RIVER OR LAKE ENVIRONMENTS.\nAT PRELIMINARY DESIGN STAGE CHECK PREFERRED\nOPTION WITH PROJECT MANAGER PRIOR TO\nDOCUMENTATION.', { h: 2.6 }));
    LY.caption('KERB PERMANENT FORMWORK', null, 'PN30-3209'); return LY.done();
  }, 'Folded 2 thick galvanised sheet kerb formwork, riveted at 250 crs staggered and propped; non-preferred and not for coastal (within 50 km) or salt river / lake sites.');

  // ================================================================== PN30-3214 FABRIC SCHEDULE TABLE
  def('pn3214', 'Deck & overlay', 'Fabric schedule table', 'PN30-3214', [P('qty', 'N° off for types 1–12 (comma list)', 'X,X,X,X,X,X,X,X,X,X,X,X')], (p) => {
    const LY = new Lay(), q = String(p.qty || '').split(',').map(s => s.trim() || 'X');
    LY.block(B => B.table(0, 0, [{ n: 'FABRIC\nTYPE', w: 56 }, { n: 'N° OFF', w: 56 }], Array.from({ length: 12 }, (_, i) => [String(i + 1), q[i] || 'X']), 3.2));
    LY.caption('FABRIC SCHEDULE TABLE', null, 'REFER DRAWING N° 9030-0243\nPN30-3214'); return LY.done();
  }, 'Schedule of the number of standard fabric sheets (types 1 to 12 to drawing 9030-0243) for the overlay.');

  // ================================================================== PN30-3210A DECK CONSTRUCTION JOINT (no road seal)
  def('pn3210a', 'Deck & overlay', 'Deck construction joint – bridge with no road seal', 'PN30-3210A', [], () => {
    const LY = new Lay();
    const d = LY.view(1), L = [[-3.5, 0], [3.5, 0]];
    [[-45, -3.5], [3.5, 45]].forEach(([a, b]) => { const pts = [[a, -60], [b, -60], [b, 2], [a, 2]]; d.pl([[a, 2], [b, 2]], false, 'S-CONC'); d.hatch(pts, 'conc', 'S-HATCH', 0.6); });
    d.line(-3.5, 2, -3.5, -60, 'S-CONC'); d.line(3.5, 2, 3.5, -25, 'S-CONC'); d.line(-3.5, -25, 3.5, -25, 'S-CONC'); d.line(3.5, -25, 3.5, -60, 'S-CONC'); d.brk(-45, -10, -45, -50); d.brk(45, -10, 45, -50); d.brk(-30, -60, 30, -60);
    d.fill([[-3.5, 2], [3.5, 2], [3.5, -8], [-3.5, -8]]); d.add({ t: 'pl', p: ellP(d.P(0, -14)[0], d.P(0, -14)[1], 3.5, 6, 28), closed: true, L: 'S-NEW' });
    d.line(0, -62, 0, 18, 'S-CL'); d.text(-2, 24, '℄ BRIDGE & CONSTRUCTION', 2.2, 'l', 'b'); d.text(1.5, 20.6, 'JOINT', 2.2, 'l', 'b');
    d.dim(-3.5, 2, 3.5, 2, 10, '7'); d.dim(12, 2, 12, -8, -2, '10'); d.dim(24, 2, 24, -25, -2, '25');
    d.leader(-1, -14, -16, 4, 'φ10 POLYETHYLENE\nFOAM BACKING ROD'); d.leader(1, -2, 26, 24, 'SEALANT JOINT (FORMED) SHALL\nBE CLEAN AND DRY PRIOR TO\nAPPLICATION OF GUN GRADE\nSILICON (e.g. DOW CORNING 888\nOR SIMILAR APPROVED).');
    LY.title('DETAIL 1', 1);
    const v = LY.view(10), t = 150;
    const sl = [[-1000, -3], [1000, -3], [1000, t], [0, t + 8], [-1000, t]]; v.pl(sl, true, 'S-CONC'); v.line(0, -3, 0, t + 8, 'S-NEW'); v.line(-1000, -6, 1000, -6, 'S-HIDDEN'); v.line(-1000, -125, 1000, -125, 'S-EXIST');
    v.brk(-1000, -130, -1000, t + 10); v.brk(1000, -130, 1000, t + 10); v.circ(0, t + 4, 60, 'S-TEXT'); v.mark(-120, t + 450, '1'); v.line(-90, t + 420, -40, t + 50, 'S-TEXT');
    v.line(0, -3, 0, t + 700, 'S-CL'); v.text(-20, t + 760, '℄ BRIDGE & CONSTRUCTION', 2.2, 'l', 'b'); v.text(15, t + 726, 'JOINT', 2.2, 'l', 'b');
    v.leader(-500, -125, -10, -10, 'EXISTING TIMBER\nDECKING'); v.leader(600, -6, 14, -14, 'HESSIAN');
    { const q = v.P(-250, t + 900), B = new Builder(); nbox(B, 0, 0, 'BRIDGE WITH NO ROAD SEAL'); B.E.forEach(e => { A.shiftE(e, q[0], q[1] + 8); v.add(e); }); }
    LY.title('DECK CONSTRUCTION JOINT DETAIL', 10);
    LY.caption('DECK CONSTRUCTION JOINT DETAIL - BRIDGE WITH NO ROAD SEAL', null, 'PN30-3210A'); return LY.done();
  }, 'Formed 7 x 25 sealant joint (10 deep gun grade silicone on a φ10 backing rod) at the construction joint on the bridge centre line where there is no road seal.');

  // ================================================================== PN30-3207 KERB FABRIC DETAIL 2
  // kerb (inner toe at x = 0, running surface y = 0) with SL81 kerb fabric loops and the post anchor rod; returns nothing
  function kerbFabric(v, kb, opt) {
    opt = opt || {};
    v.pl([[0, 0], [6, 70], [26, 90], [280, 100], [300, 80], [300, kb + 20], [280, kb]], false, 'S-CONC');
    v.pl([[40, 75], [250, 75], [262, 63], [262, kb + 45], [250, kb + 33], [40, kb + 33], [28, kb + 45], [28, 63], [40, 75]], false, 'S-REO');
    if (opt.type7) v.pl([[-80, kb + 25], [248, kb + 25], [248, 60]], false, 'S-REO'); else v.pl([[245, 60], [245, kb + 50]], false, 'S-REO');
    [[40, 75], [250, 75], [250, kb + 33], [40, kb + 33]].forEach(q => v.barEnd(q[0], q[1] - (q[1] > 0 ? 12 : -12), 8));
    v.line(-700, -70, 350, -70, 'S-HIDDEN'); v.line(-700, -85, 350, -85, 'S-HIDDEN'); v.line(-700, -70, -700, -85, 'S-HIDDEN'); v.pl([[350, -70], [380, -70], [380, -85], [350, -85]], false, 'S-HIDDEN');
    v.dim(300, 100, 300, -78, 6, '180');
    v.leader(150, 75, 10, 18, 'SL81 KERB FABRIC\nTYPE 4');
    v.leader(380, -80, 10, -8, 'ANCHOR ROD FOR POST\nCONNECTION FOR DETAILS\nREFER TO DRG N° XX30-XXXX');
    if (opt.type7) v.leader(248, kb + 25, 18, -18, 'SL81 FABRIC TYPE 7\nTRIM VERTICAL TO SUIT'); else v.leader(150, kb + 33, 14, -16, 'SL81 KERB FABRIC\nTYPE 4\nTRIM VERTICAL TO SUIT');
  }
  function kerb3207(LY, V) {
    const v = LY.view(10), deep = V !== '130-199', ov = V === 'overhang', yDt = deep ? -200 : -140, yDb = yDt - 135, kb = yDb, xL = ov ? -2700 : -1000, top = x => (x < -40 ? (-40 - x) * 0.025 + 5 : 5);
    const xd = ov ? -1330 : -130; // decking edge
    const C = [[xL, top(xL)], [-40, 5], [0, 0]]; v.pl(C, false, 'S-CONC'); v.line(xd, yDb, 280, yDb, 'S-CONC');
    kerbFabric(v, kb, { type7: ov });
    v.line(xL, yDt, xd, yDt, 'S-HIDDEN'); v.line(xL, yDb, xd, yDb, 'S-EXIST'); v.line(xd, yDt, xd, yDb, 'S-CONC'); v.rect(xd - 10, yDb, 10, yDt - yDb, 'S-NEW'); v.hatch([[xd - 10, yDb], [xd, yDb], [xd, yDt], [xd - 10, yDt]], 'ansi31', 'S-HATCH', 0.4);
    v.brk(xL, yDb - 20, xL, top(xL) + 20);
    const arcS = x => { arcPL(v, x, yDb - 230, 230, 35, 145, 'S-EXIST'); v.line(x - 240, yDb - 100, x + 240, yDb - 100, 'S-TEXT'); v.brk(x - 40, yDb - 100, x + 40, yDb - 100); };
    const fy = x => top(x) - 40;
    v.fabric(xL + 20, fy(xL + 20), 230, fy(230) - 5, 200);
    if (!ov) { arcS(xd + 80); if (deep) { v.fabric(xL + 20, yDt + 35, 250, yDt + 35, 200); v.dim(xL - 60, yDt, xL - 60, yDt + 35, 4, '30'); } v.leader(-350, fy(-350), -10, 14, 'SL81 DECK\nFABRIC'); }
    else {
      arcS(-2390); arcS(xd + 20); v.fabric(-2390, yDt + 40, -955, yDt + 40, 200); v.fabric(-1280, yDb + 90, 265, yDb + 90, 200);
      const ub = SEC['410UB54'], ux = -220; v.line(ux - ub.b / 2, yDb, ux + ub.b / 2, yDb, 'S-NEW'); v.fill([[ux - ub.b / 2, yDb - 12], [ux + ub.b / 2, yDb - 12], [ux + ub.b / 2, yDb], [ux - ub.b / 2, yDb]]); v.line(ux, yDb - 12, ux, yDb - 140, 'S-NEW'); v.line(ux + 4, yDb - 12, ux + 4, yDb - 140, 'S-NEW');
      [ux - 45, ux + 45].forEach(x => { v.line(x, yDb - 40, x, yDb + 110, 'S-BOLT'); v.nut(x, yDb + 2, 0, 1, 12); v.nut(x, yDb - 12, 0, -1, 12); });
      v.dim(-1280, top(-1280) + 30, -955, top(-955) + 30, 12, '300 LAP'); v.dim(xL - 60, yDt, xL - 60, yDt + 30, 4, '30'); v.dim(xd + 160, yDb, xd + 160, yDb + 90, -4, '30');
      v.leader(-600, fy(-600), 6, 12, 'SL81 DECK FABRIC'); v.leaders([[-700, yDb + 90], [-1000, yDt + 40]], 6, -16, 'SL81 DECK FABRIC\nTYPE 9');
      v.line(ux, yDb - 160, ux, yDb - 420, 'S-NOTE'); v.line(300, yDb - 40, 300, yDb - 420, 'S-NOTE'); v.dim(ux, yDb - 420, 300, yDb - 420, 0, ''); v.text(40, yDb - 230, 'IF >500 REFER TO ENG.', 2.0, 'c', 'b'); v.text(40, yDb - 300, 'FOR REINF. DESIGN', 2.0, 'c', 'b');
    }
    LY.title('DETAIL 2', 10, 'POST OMITTED');
    const lbl = V === '130-199' ? 'DECK DEPTH AT KERB FACE 130-199' : V === '200+' ? 'DECK DEPTH AT KERB FACE 200+' : 'DECK DEPTH "X" 130+';
    { const B = new Builder(); nbox(B, 0, 0, lbl); const q = v.P(xL + (ov ? 1500 : 300), yDb - 280); B.E.forEach(e => { A.shiftE(e, q[0], q[1] - 10); v.add(e); }); }
  }
  def('pn3207', 'Deck & overlay', 'Kerb fabric detail (post omitted)', 'PN30-3207', [P('dd', 'Deck depth at kerb face', 'all (as sheet)', { opts: ['all (as sheet)', '130-199', '200+', 'overhang (x 130+)'] })], (p) => {
    const LY = new Lay(520), V = p.dd || 'all (as sheet)', list = /all/.test(V) ? ['130-199', '200+', 'overhang'] : [/over/.test(V) ? 'overhang' : V];
    list.forEach((q, i) => { if (i === 2) LY.break(); kerb3207(LY, q); });
    LY.caption('KERB FABRIC DETAIL', null, 'PN30-3207'); return LY.done();
  }, 'SL81 kerb fabric Type 4 closed loops in the insitu kerb with the post anchor rod, for deck depths 130-199, 200+ and the overhang over a widening stringer (refer to engineer if the overhang exceeds 500).');

  // ================================================================== PN30-3210 DECK FABRIC LAP AT CONSTRUCTION JOINT
  function lapDetail(LY, deep) {
    const v = LY.view(10), t = deep ? 250 : 165, W = 390, top = x => t + 8 - abs(x) * 0.02;
    v.pl([[-W, top(-W)], [0, top(0)], [W, top(W)]], false, 'S-CONC'); v.line(-W, -3, W, -3, 'S-HIDDEN'); v.line(-W, 0, W, 0, 'S-CONC'); v.line(-W, -125, W, -125, 'S-EXIST');
    v.brk(-W, -125, -W, t); v.brk(W, -125, W, t); v.line(0, 0, 0, top(0) - 5, 'S-NEW');
    const layer = y0 => { v.fabric(-W + 5, y0 - 2, -50, y0, 100); v.fabric(50, y0, W - 5, y0 - 2, 100); v.line(-250, y0 - 8, 250, y0 - 8, 'S-REO'); v.line(-250, y0 - 11, 250, y0 - 11, 'S-REO'); };
    layer(top(0) - 45); if (deep) layer(70);
    v.rect(-20, top(0) - 35, 40, 35, 'S-NOTE'); v.line(0, top(0) - 40, 0, top(0) + 420, 'S-CL'); v.text(-2, top(0) + 440, '℄ BRIDGE & CONSTRUCTION', 2.2, 'l', 'b'); v.text(30, top(0) + 406, 'JOINT', 2.2, 'l', 'b');
    v.line(40, top(0) + 5, 160, top(0) + 160, 'S-TEXT'); v.line(70, top(0) + 5, 190, top(0) + 160, 'S-TEXT');
    v.dim(200, top(0) + 160, 200, top(0) + 200, -3, ''); v.leader(205, top(0) + 270, 6, 4, '40 COVER TO SUIT\n32NB x 2.0 PIPE SCREED', { noArrow: true });
    v.dim(-50, -70, 50, -70, 0, '100');
    v.leader(-150, top(0) - 56, -14, 14, 'SL81 LAP FABRIC\nTYPE 8'); v.leader(200, top(0) - 45, 10, 20, 'SL81 DECK FABRIC\n(TYP)'); v.leader(-150, -125, -12, -10, 'EXISTING DECKING'); v.leader(250, -3, 12, -14, 'HESSIAN');
    { const B = new Builder(); nbox(B, 0, 0, 'BRIDGE WITH NO ROAD SEAL\nONLY. REFER PN30-3210A'); B.E.push({ t: 'line', a: [B.E[0].p[1][0] - 8, B.E[0].p[2][1]], b: [B.E[0].p[1][0] + 12, B.E[0].p[2][1] - 18], L: 'S-NOTE' }); const q = v.P(-W - 50, top(0) + 380); B.E.forEach(e => { A.shiftE(e, q[0] - 10, q[1]); v.add(e); }); }
    LY.title('DETAIL 1', 10, 'XXXX-XXXX');
    { const B = new Builder(); nbox(B, 0, 0, deep ? 'DECK DEPTH >200' : 'DECK DEPTH <200'); const q = v.P(-100, -125); B.E.forEach(e => { A.shiftE(e, q[0], q[1] - 28); v.add(e); }); }
  }
  def('pn3210', 'Deck & overlay', 'Deck fabric lap at centre line construction joint', 'PN30-3210', [P('dd', 'Deck depth', 'both (as sheet)', { opts: ['both (as sheet)', '<200', '>200'] })], (p) => {
    const LY = new Lay(560), dd = p.dd || 'both (as sheet)';
    if (dd !== '>200') lapDetail(LY, false); if (dd !== '<200') lapDetail(LY, true);
    LY.break();
    const v = LY.view(10);
    for (let k = 0; k < 5; k++) { const y = 20 + k * 100; v.line(-620, y, 20, y, 'S-REO'); v.line(-620, y + 6, 20, y + 6, 'S-REO'); }
    for (let x = -560; x <= 0; x += 100) { v.line(x, 0, x, 420, 'S-REO'); v.line(x + 6, 0, x + 6, 420, 'S-REO'); }
    for (let k = 0; k < 4; k++) { const y = 60 + k * 100; v.line(-300, y, 650, y, 'S-REO'); v.line(-300, y + 3, 650, y + 3, 'S-REO'); }
    for (let x = -300; x <= 650; x += 100) v.line(x, 0, x, 420, 'S-REO');
    v.line(-640, 0, 670, 0, 'S-TEXT'); v.line(-640, 420, 670, 420, 'S-TEXT'); v.brk(-640, 0, -640, 420); v.brk(670, 0, 670, 420); v.brk(-80, 420, -40, 420); v.brk(-80, 0, -40, 0);
    v.dim(-300, 0, 0, 0, -12, '300 LAP'); v.leader(-500, 26, -6, -16, 'SL81 DECK FABRIC'); v.leader(150, 60, 10, -14, 'SL81 DECK FABRIC');
    v.text(0, -260, 'PLAN', 2.6, 'c', 'b'); v.line(-60, -270, 60, -270, 'S-TEXT');
    const e = -480; v.line(-620, e, 0, e, 'S-REO'); v.line(-620, e - 4, 0, e - 4, 'S-REO'); for (let x = -560; x < 0; x += 100) v.circ(x, e + 8, 5, 'S-REO');
    v.line(0, e, 650, e, 'S-REO'); v.line(0, e + 3, 650, e + 3, 'S-REO'); v.line(0, e - 3, 650, e - 3, 'S-REO'); for (let x = 0; x < 650; x += 100) v.barEnd(x, e + 10, 6); v.line(80, e - 3, 150, e - 20, 'S-REO');
    v.leaders([[-40, e + 3], [10, e + 6]], -6, 12, 'SL81 DECK FABRIC'); v.text(0, e - 220, 'ELEVATION', 2.6, 'c', 'b'); v.line(-90, e - 230, 90, e - 230, 'S-TEXT');
    LY.title('TYPICAL DECK FABRIC LAP', 10);
    LY.caption('DECK FABRIC LAP DETAILS', null, 'PN30-3210');
    return LY.done();
  }, 'SL81 lap fabric Type 8 across the centre line construction joint (deck fabric stopped 100 apart, one or two layers by deck depth) and the typical 300 lap of deck fabric.');

  // ================================================================== PN30-3208 KERB CONTRACTION JOINT / KERB FABRIC SPLICE
  // kerb fabric elevation between x0..x1 (longitudinal wires as thin double lines, verticals at 100 crs from xv0)
  function kerbFabElev(v, x0, x1, xv0, xv1) {
    [0, -38, -136, -237].forEach(y => { v.line(x0, y, x1, y, 'S-REO'); v.line(x0, y - 7, x1, y - 7, 'S-REO'); });
    for (let x = xv0; x <= xv1 + 1; x += 100) { v.line(x - 3, 8, x - 3, -245, 'S-REO'); v.line(x + 3, 8, x + 3, -245, 'S-REO'); v.arc(x, 8, 3, 0, 180, 'S-REO'); }
  }
  def('pn3208', 'Deck & overlay', 'Kerb contraction joint & kerb fabric splice', 'PN30-3208', [], () => {
    const LY = new Lay(470);
    LY.block(B => nbox(B, 0, 0, 'NOTE\nPIER CONTRACTION JOINTS MAY BE RELOCATED\nLEFT OR RIGHT OF PIER ℄ BY UPTO 200 mm TO\nAVOID ANCHOR RODS.', { solid: true, h: 2.6 }));
    LY.break();
    const v = LY.view(10);
    kerbFabElev(v, -560, -50, -450, -150); kerbFabElev(v, 50, 560, 150, 450); v.line(-50, -245, -50, 8, 'S-REO'); v.line(50, -245, 50, 8, 'S-REO');
    v.brk(-560, -237, -560, 0); v.brk(560, -237, 560, 0); v.line(0, -280, 0, 120, 'S-CL'); v.text(-6, 135, '℄ CONTRACTION JOINT', 2.4, 'l', 'b');
    v.dim(0, -245, 50, -245, -8, '40 MIN.', { sub: '100 MAX.' }); v.leader(100, -245, 14, -14, 'SL81 KERB FABRIC\nTYPE 4 (TYP)');
    v.text(0, -470, 'ELEVATION', 2.6, 'c', 'b'); v.line(-90, -480, 90, -480, 'S-TEXT');
    LY.title('KERB CONTRACTION JOINT DETAIL', 10);
    LY.break();
    const s = LY.view(10);
    s.pl([[0, -250], [0, -10], [10, 0], [190, 0], [200, -10], [200, -250]], false, 'S-REO'); s.pl([[8, -250], [8, -14], [14, -8], [186, -8], [192, -14], [192, -250]], false, 'S-REO');
    [[20, -20], [180, -20], [185, -220]].forEach(q => { s.circ(q[0], q[1], 18, 'S-TEXT'); s.barEnd(q[0], q[1], 12); }); [[45, -12], [120, -12], [12, -80], [190, -50], [190, -150]].forEach(q => s.circ(q[0], q[1], 4, 'S-REO'));
    s.leaders([[20, -20], [180, -20], [185, -220]], -14, -32, '3-N12 BARS\n(TYP)');
    LY.title('SECTION A', 10);
    const e = LY.view(10);
    kerbFabElev(e, -560, -10, -500, -100); kerbFabElev(e, 10, 560, 100, 500); e.brk(-560, -237, -560, 0); e.brk(560, -237, 560, 0); e.line(0, -260, 0, 30, 'S-CL');
    [-10, -228].forEach(y => e.fill([[-300, y - 6], [300, y - 6], [300, y + 6], [-300, y + 6]], 'S-REO'));
    e.dim(0, 30, 300, 30, 12, '300', { sub: '(TYP)' }); e.line(300, 30, 300, -2, 'S-DIM'); e.dim(-50, -245, 50, -245, -12, '100');
    e.leader(-150, -4, 8, 26, 'N12 BAR (TYP)'); e.leader(70, -245, 12, -14, 'SL81 KERB FABRIC\nTYPE 4 (TYP)');
    e.mark(-200, 160, 'A', 0); e.line(-200, 130, -200, 70, 'S-TITLE'); e.line(-200, -330, -200, -420, 'S-TITLE'); { const q = e.P(-200, -420); e.add({ t: 'solid', p: [[q[0], q[1]], [q[0], q[1] + 7], [q[0] + 2.4, q[1] + 3.5]], L: 'S-TEXT' }); }
    e.text(0, -540, 'ELEVATION', 2.6, 'c', 'b'); e.line(-90, -550, 90, -550, 'S-TEXT');
    LY.title('KERB FABRIC SPLICE DETAIL', 10);
    LY.caption('KERB CONTRACTION JOINT & FABRIC SPLICE DETAILS', null, 'PN30-3208'); return LY.done();
  }, 'Kerb fabric stopped 40 min / 100 max each side of a kerb contraction joint, and the kerb fabric splice with 600 long N12 bars (300 each side) at the top and bottom wires.');

  // ================================================================== PN30-3211 CONTRACTION JOINT DETAILS
  function cjSectionA(LY, deep) {
    const v = LY.view(10), t = deep ? 250 : 150, W = 700;
    v.line(-W, t, W, t, 'S-CONC'); v.line(-W, 0, W, 0, 'S-CONC'); v.line(-W, -3, W, -3, 'S-HIDDEN'); v.line(-W, -125, W, -125, 'S-EXIST'); for (let x = -W + 60; x < W; x += 160) v.line(x, -3, x, -125, 'S-EXIST');
    v.brk(-W, -125, -W, t); v.brk(W, -125, W, t); v.line(0, -170, 0, t + 380, 'S-CL'); v.text(-6, t + 400, deep ? '℄ PIER & CJ' : '℄ PIER', 2.4, 'l', 'b');
    v.rect(-3.5, t - 30, 7, 30, 'S-NEW'); v.circ(0, t - 15, 30, 'S-TEXT'); { const q = v.P(70, t + 180); v.add({ t: 'circle', c: q, r: 3, L: 'S-TEXT' }); v.add({ t: 'text', p: q, s: '1', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); } v.line(15, t + 12, 55, t + 150, 'S-TEXT');
    if (!deep) { v.fabric(-W + 20, t - 40, W - 20, t - 40, 100); v.circ(0, 16, 16, 'S-NEW');
      v.leaders([[-40, t - 40], [30, t - 55]], 28, 34, 'CUT EVERY\nSECOND BAR', { noArrow: false }); v.leader(-200, t - 40, -14, 18, 'SL81 DECK FABRIC\nTYPE X'); v.leader(320, -3, 4, 34, 'HESSIAN');
      v.leader(-10, 10, -18, -26, 'φ32 PVC PIPE TO FULL WIDTH\nOF BRIDGE, PLACED CENTRALLY\nUNDER CONTRACTION JOINT\nAND FIX TO DECK'); }
    else { v.fabric(-W + 20, t - 40, -50, t - 40, 100); v.fabric(50, t - 40, W - 20, t - 40, 100); v.fabric(-W + 20, 30, W - 20, 30, 100); v.circ(0, 65, 25, 'S-NEW');
      v.dim(-50, t, 0, t, 10, '='); v.dim(0, t, 50, t, 10, '='); v.text(0, t + 210, '100', 2.0, 'c', 'b', 'S-DIM'); v.dim(W + 60, 0, W + 60, 30, 3, '30');
      v.leaders([[-50, t - 40], [10, t - 60]], -20, 22, 'TERMINATE TOP REINF\nEACH SIDE OF CJ\n(TYP)'); v.leaders([[300, t - 40], [-300, 30]], 12, 26, 'SL81 DECK FABRIC\nTYPE X'); v.leader(-500, 30, -10, 22, 'SL81 DECK FABRIC\nTYPE X'); v.leader(450, -3, 6, 30, 'HESSIAN');
      v.leader(-10, 50, -18, -28, 'φ50 PVC PIPE TO FULL WIDTH\nOF BRIDGE, PLACED CENTRALLY\nUNDER CONTRACTION JOINT\nAND FIX TO DECK FABRIC'); }
    v.leader(300, -125, 8, -12, 'EXISTING TIMBER DECKING');
    LY.title('SECTION A', 10, 'TYPICAL ALL PIERS');
    { const B = new Builder(); nbox(B, 0, 0, deep ? 'DECK DEPTH 200+' : 'DECK DEPTH 130-200'); const q = v.P(-200, -125); B.E.forEach(e => { A.shiftE(e, q[0], q[1] - 22); v.add(e); }); }
  }
  // longitudinal section along a contraction joint at the kerb (hatched band = sawn / formed joint)
  function kerbCJ(LY, pf, Xd) {
    const v = LY.view(10), xL = -1150, top = x => (x < -40 ? (-40 - x) * 0.03 + 5 : 5), yb = -265, ub = SEC['410UB54'], ux = -340;
    const outline = [[xL, top(xL)], [-40, 5], [0, 0], [6, 70], [26, 90], [280, 100], [300, 80], [300, yb + 10], [290, yb], [xL + 400, yb]];
    v.pl(outline, false, 'S-CONC'); v.line(xL, -130, xL + 380, -130, 'S-CONC'); v.line(xL, yb, xL + 380, yb, 'S-EXIST'); v.rect(xL + 380, yb, 10, 135, 'S-NEW'); v.hatch([[xL + 380, yb], [xL + 390, yb], [xL + 390, -130], [xL + 380, -130]], 'ansi31', 'S-HATCH', 0.4); v.line(xL + 390, yb, xL + 390, -130, 'S-CONC');
    v.brk(xL, yb, xL, top(xL) + 10);
    const band = []; for (let x = xL; x <= -75; x += 50) band.push([x, top(x)]); const bp = band.concat(band.slice().reverse().map(q => [q[0], q[1] - 30])); v.hatch(bp, 'ansi31', 'S-HATCH', 0.5); v.pl(band.map(q => [q[0], q[1] - 30]), false, 'S-TEXT');
    const fm = [[-75, top(-75)], [0, 0], [6, 70], [26, 90], [280, 100], [300, 80], [300, -100], [270, -100], [270, 65], [260, 72], [40, 65], [32, 45], [-75, top(-75) - 30]]; v.hatch(fm, 'ansi31', 'S-HATCH', 0.5); v.pl(fm.slice(6), false, 'S-TEXT');
    v.line(xL, top(xL) - 45, 240, top(240) - 45 - 0, 'S-HIDDEN'); v.pl([[40, -230], [40, 60], [240, 60], [240, -230], [40, -230]], false, 'S-HIDDEN');
    v.line(xL, -95, xL + 300, -95, 'S-NEW'); v.line(xL, -127, xL + 300, -127, 'S-NEW'); v.rect(xL + 300, -127, 15, 32, 'S-NEW');
    v.line(xL + 430, -195, 270, -195, 'S-NEW'); v.line(xL + 430, -245, 270, -245, 'S-NEW'); v.rect(xL + 410, -245, 20, 50, 'S-NEW'); v.rect(270, -245, 20, 50, 'S-NEW'); v.line(xL + 400, -255, 290, -255, 'S-HIDDEN');
    arcPL(v, xL + 650, yb - 230, 230, 40, 140, 'S-EXIST'); v.brk(xL + 700, yb - 120, xL + 760, yb - 120);
    v.fill([[ux - ub.b / 2, yb - 12], [ux + ub.b / 2, yb - 12], [ux + ub.b / 2, yb], [ux - ub.b / 2, yb]]); v.line(ux, yb - 12, ux, yb - 120, 'S-NEW'); v.line(ux + 4, yb - 12, ux + 4, yb - 120, 'S-NEW');
    [ux - 45, ux + 45].forEach(x => { v.line(x, yb - 40, x, yb + 110, 'S-BOLT'); v.nut(x, yb + 2, 0, 1, 12); v.nut(x, yb - 12, 0, -1, 12); });
    if (pf) { v.pl([[284, 100], [303, 100], [303, yb - 3], [150, yb - 3]], false, 'S-NEW'); }
    v.dim(xL + 0, top(xL) + 30, xL + 300, top(xL + 300) + 30, 8, '300'); v.dim(-700, top(-700), -700, -111, -4, "'X'");
    v.dim(300, 100, 300, -100, -10, '200'); v.dim(300, yb, 340, yb, -6, '40'); v.dim(-75, top(-75) + 150, 0, top(-75) + 150, 4, '75');
    const yE = 380; v.line(xL, yE, -75, yE, 'S-DIM'); v.arrow(xL, yE, 180, 'S-DIM'); v.arrow(-75, yE, 0, 'S-DIM'); v.text(-700, yE + 20, 'EXTENT OF SAWN CONTRACTION JOINT', 2.2, 'c', 'b'); v.line(-75, yE + 40, -75, top(-75) + 10, 'S-DIM');
    const arcP = [[-75, yE]]; for (let i = 0; i <= 10; i++) { const a = PI / 2 * i / 10; arcP.push([380 + 150 * Math.sin(a) - 150, yE - 150 + 150 * Math.cos(a)]); } arcP.push([380, -100]); v.pl(arcP, false, 'S-DIM'); v.arrow(-75, yE, 180, 'S-DIM'); v.arrow(380, -100, -90, 'S-DIM'); v.line(330, -100, 400, -100, 'S-DIM');
    v.leader(200, yE, 10, 14, 'EXTENT OF FORMED 30 DEEPx\n7 WIDE CONTRACTION JOINT', { dot: true });
    v.leader(xL + 300, -100, 10, 30, "φ50 PVC PIPE WHERE\n'X'>200 OR φ32 PVC\nPIPE WHERE 'X'<200\nWITH END CAPS TO SUIT"); v.leader(-700, -245, 4, -14, 'φ50 PVC PIPE');
    LY.title('KERB CONTRACTION JOINT DETAIL', 10, pf ? 'PERMANENT FORMWORK OPTION' : null);
  }
  def('cj', 'Deck & overlay', 'Overlay contraction joints at piers', 'PN30-3211', [P('t', 'Deck depth (mm)', 150, { num: 1 }), P('show', 'Section A', 'both (as sheet)', { opts: ['both (as sheet)', 'by deck depth'] })], (p) => {
    const LY = new Lay(700), t = +p.t || 150, both = !/depth/.test(p.show || '');
    if (both || t < 200) cjSectionA(LY, false); if (both || t >= 200) cjSectionA(LY, true);
    const d = LY.view(1);
    [[-40, -3.5], [3.5, 40]].forEach(([a, b]) => { d.line(a, 0, b, 0, 'S-CONC'); d.hatch([[a, -55], [b, -55], [b, 0], [a, 0]], 'conc', 'S-HATCH', 0.5); });
    d.pl([[-3.5, 0], [-3.5, -30], [3.5, -30], [3.5, 0]], false, 'S-CONC'); d.brk(-40, -10, -40, -50); d.brk(40, -10, 40, -50); d.brk(-25, -55, 25, -55);
    d.fill([[-3.5, 0], [3.5, 0], [3.5, -10], [-3.5, -10]]); d.add({ t: 'pl', p: ellP(d.P(0, -16)[0], d.P(0, -16)[1], 3.5, 6, 28), closed: true, L: 'S-NEW' });
    d.line(0, -60, 0, 20, 'S-CL'); d.text(-2, 22, '℄ PIER', 2.2, 'l', 'b');
    d.dim(-3.5, 0, 3.5, 0, 12, '7'); d.dim(10, 0, 10, -10, -2, '10'); d.dim(22, 0, 22, -30, -2, '30');
    d.leader(-1, -16, -14, 4, 'φ10 POLYETHYLENE\nFOAM BACKING ROD'); d.leader(1, -3, 22, 20, 'CONTRACTION JOINT (CJ) - SAWN\nOR FORMED, SHALL BE CLEAN AND\nDRY PRIOR TO APPLICATION OF GUN\nGRADE SILICON (e.g. DOW CORNING\n888 OR SIMILAR APPROVED).');
    LY.title('DETAIL 1', 1);
    LY.block(B => nbox(B, 0, 0, 'NOTE\nPIER CONTRACTION JOINTS MAY BE\nRELOCATED LEFT OR RIGHT OF PIER\n℄ BY UPTO 200 TO AVOID POST\nANCHOR RODS IF REQUIRED.', { solid: true }));
    LY.break();
    const v = LY.view(10), W = 400;
    const tp = x => 250 - (x + W) * 0.05; v.pl([[-W, tp(-W)], [W, tp(W)]], false, 'S-CONC'); v.line(-W, 0, W, 0, 'S-CONC'); v.line(-W, -125, W, -125, 'S-EXIST'); v.brk(-W, 0, -W, 250); v.brk(W, 0, W, 250); v.brk(-W, -125, -W, 0); v.brk(W, -125, W, 0);
    const bd = [[-W, tp(-W)], [W, tp(W)], [W, tp(W) - 30], [-W, tp(-W) - 30]]; v.hatch(bd, 'ansi31', 'S-HATCH', 0.5); v.line(-W, tp(-W) - 30, W, tp(W) - 30, 'S-TEXT');
    v.line(-W, tp(-W) - 45, W, tp(W) - 45, 'S-HIDDEN'); v.line(-W, 140, 300, 140, 'S-NEW'); v.line(-W, 105, 300, 105, 'S-NEW'); v.rect(300, 105, 15, 35, 'S-NEW');
    v.line(-W, 75, -40, 75, 'S-HIDDEN'); v.line(0, 75, W, 75, 'S-NEW'); v.line(0, 50, W, 50, 'S-NEW'); v.rect(0, 50, 12, 25, 'S-NEW'); v.line(0, 40, W, 40, 'S-HIDDEN');
    v.line(0, -40, 0, 330, 'S-TEXT'); v.line(-40, -40, -40, 75, 'S-TEXT');
    v.dim(0, 330, 300, 330, 4, '300'); v.dim(-40, -40, 0, -40, -4, '40');
    v.leader(-150, tp(-150), -14, 14, 'SAWN CONTRACTION\nJOINT'); v.leader(315, 130, 10, 24, 'φ50 PVC PIPE WITH\nEND CAPS TO SUIT'); v.leader(150, 50, 10, -18, 'φ32 PVC PIPE WITH\nEND CAPS TO SUIT');
    LY.title('CONTRACTION JOINT AT TERMINATION OF', 10, 'BOTTOM DECK REINFORCEMENT DETAIL');
    kerbCJ(LY, false, t); kerbCJ(LY, true, t);
    LY.caption('CONTRACTION JOINT DETAILS', null, 'PN30-3211');
    return LY.done();
  }, 'Sawn contraction joint over every pier (φ32 or φ50 PVC crack inducer under the joint, top fabric cut or terminated), the sealed joint detail, the joint at the end of the bottom reinforcement and the formed joint through the kerb; joints may move up to 200 off the pier centre line to clear post anchor rods.');

  // ================================================================== PN30-3212 SECTION B – OVERLAY END AT ABUTMENT WITHOUT APPROACH SLAB
  function secB(LY, V) {
    const v = LY.view(10), yDt = V === 'conc' ? -175 : -150, yDb = yDt - 130, yBot = yDb - 675, xF = 230, xL = -380;
    const C = [[xL, 0], [xF, 0], [xF, yBot], [30, yBot], [30, yDt], [xL, yDt]]; v.pl(V === 'conc' ? [[xF, yBot], [30, yBot], [30, yDt], [xL, yDt], [xL, 0], [xF, 0]] : C, V !== 'conc', 'S-CONC'); v.hatch(C, 'conc', 'S-HATCH', 0.8);
    v.line(xL, yDt - 3, 30, yDt - 3, 'S-HIDDEN'); v.line(xL, yDb, -75, yDb, 'S-EXIST'); v.line(-220, yDt, -220, yDb, 'S-EXIST'); v.brk(xL, yDb, xL, 0);
    v.rect(0, yBot, 30, yDt - yBot, 'S-NEW'); v.hatch([[0, yBot], [30, yBot], [30, yDt], [0, yDt]], 'ansi37', 'S-HATCH', 0.5);
    v.line(-75, yDb, -75, yBot - 150, 'S-EXIST'); v.line(-5, yDb, -5, yBot - 150, 'S-EXIST'); [yDb - 220, yDb - 420].forEach(y => v.line(-75, y, -5, y, 'S-EXIST')); v.brk(-75, yBot - 150, -5, yBot - 150); v.line(-75, yBot, -5, yBot, 'S-EXIST');
    if (V === 'conc') {
      const wav = []; for (let y = 0; y >= yBot; y -= 60) wav.push([xF + (Math.round(-y / 60) % 2 ? 6 : -4), y]); v.pl(wav, false, 'S-CONC'); v.line(xF, 0, xF, -100, 'S-NEW'); v.line(xF + 3, 0, xF + 3, -100, 'S-NEW');
      v.hatch([[xF + 4, -40], [xF + 30, -40], [xF + 30, yDb - 30], [xF + 4, yDb - 30]], 'ansi31', 'S-HATCH', 0.6); v.line(xF + 30, 0, xF + 120, 0, 'S-CONC');
      v.dim(xF, 0, xF, -100, 8, '100'); v.dim(xF, yDb, xF, yBot, 14, '675'); v.dim(xF, 0, xF, yBot, 26, 'VARIES'); v.dim(30, yBot, xF, yBot, -6, '200', { sub: 'MIN' });
      v.leader(xF, -20, 10, 18, 'EXISTING ROAD PAVEMENT SHALL\nBE SAW CUT TO MIN. DEPTH OF\n100 mm PRIOR TO EXCAVATION.'); v.leader(xF + 3, yBot + 60, 10, -12, 'EXCAVATED\nFACE');
      v.leader(-200, yDt - 3, -6, 22, 'HESSIAN');
    } else {
      v.line(xF, 0, xF, yBot, 'S-CONC'); const d2 = V === 'double', fx = 150, top = -30, lo = yDt + 25;
      v.fabric(xL + 10, top, fx - 30, top, 120); v.bar([[-80, top - 8], [fx - 40, top - 8], [fx, top - 48], [fx, -400]]);
      if (d2) { v.fabric(xL + 10, lo, fx - 70, lo, 120); v.bar([[-80, lo - 8], [fx - 80, lo - 8], [fx - 40, lo - 48], [fx - 40, -520]]); }
      v.line(d2 ? fx - 10 : fx - 20, -230, d2 ? fx - 10 : fx - 20, yBot + 75, 'S-REO'); v.line(d2 ? fx - 4 : fx - 14, -230, d2 ? fx - 4 : fx - 14, yBot + 75, 'S-REO'); for (let y = -300; y > yBot + 80; y -= 90) v.circ(d2 ? fx - 1 : fx - 11, y, 5, 'S-REO');
      const xm = d2 ? fx - 7 : fx - 17; v.dim(xF, yBot + 75, xF, yBot, 16, '75'); v.line(xm, yBot + 70, xm, yBot - 130, 'S-DIM'); v.dim(30, yBot - 100, xm, yBot - 100, 0, '='); v.dim(xm, yBot - 100, xF, yBot - 100, 0, '=');
      v.leader(xL + 40, top, 4, 18, 'SL81 DECK FABRIC\nTYPE X'); v.leaders(d2 ? [[fx, -200], [fx - 40, -350]] : [[fx, -200]], 16, 8, 'SL81 DROP\nPANEL FABRIC\nTYPE X'); v.leader(xm - 3, -420, -24, -10, 'SL81 FABRIC');
      if (d2) v.leader(-250, lo, -6, -30, 'SL81 DECK FABRIC\nTYPE X');
    }
    if (V === 'conc') v.leader(-300, yDb, -10, -10, 'EXISTING DECK');
    if (V === 'conc') { v.leader(-75, yDb - 100, -18, -10, 'EXISTING SHEETING'); v.leader(0, yDb - 300, -14, -6, '30 THICK EXPANDED FOAM\n(FOSROC EXPANDAFOAM\nSHEET/STRIP BY PARCHEM\nCONSTRUCTION PRODUCTS)\nOR SIMILAR APPROVED'); }
    LY.title('SECTION B', 10);
    { const B = new Builder(); nbox(B, 0, 0, V === 'conc' ? 'FOR CONCRETE\nOVERLAY DRG' : 'FOR REINFORCED\nOVERLAY DRG'); const q = v.P(-120, yBot - 150); B.E.forEach(e => { A.shiftE(e, q[0], q[1] - 4); v.add(e); }); }
  }
  def('pn3212', 'Deck & overlay', 'Overlay end at abutment – no approach slab (Section B)', 'PN30-3212', [P('type', 'Overlay', 'all (as sheet)', { opts: ['all (as sheet)', 'concrete overlay', 'reinforced - single layer', 'reinforced - double layer'] })], (p) => {
    const LY = new Lay(520), T = p.type || 'all (as sheet)', all = /all/.test(T);
    if (all || /concrete/.test(T)) secB(LY, 'conc'); if (all) LY.break(); if (all || /single/.test(T)) secB(LY, 'single'); if (all || /double/.test(T)) secB(LY, 'double');
    LY.caption('OVERLAY END AT ABUTMENT - BRIDGE WITHOUT APPROACH SLAB', null, 'PN30-3212'); return LY.done();
  }, 'End of the overlay at an abutment without an approach slab: overlay turned down 675 behind the existing sheeting with 30 thick expanded foam against the sheeting, road pavement saw cut 100 deep; reinforced versions with drop panel fabric.');

  // ================================================================== PN30-3213 / 3213A SILL BEAM (overlay end at abutment with approach slab)
  // small bar-shape sketch in paper mm next to a bar mark (pts relative to the model point)
  function shapeAt(v, x, y, pts, labels) { const q = v.P(x, y); v.add({ t: 'pl', p: pts.map(a => [q[0] + a[0], q[1] + a[1]]), closed: false, L: 'S-REO' }); (labels || []).forEach(l => v.add({ t: 'text', p: [q[0] + l[0], q[1] + l[1]], s: l[2], h: 2.0, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' })); }
  function sillSection(LY, o) {
    const v = LY.view(10), reo = o.reo, bk = o.bondek, wm = o.wm && !reo;
    const xL = -1250, xd = -914, yDt = -148, yS = -273, x0s = wm ? 260 : 20, x1s = x0s + 500, xa = x0s + 300, ySt = -160, ySb = -500, yW = yS - 675, xE = wm ? 200 : 220;
    // concrete outline: slab + downstand + sill (+ wall for the reinforced overlay)
    const C = [[xL, 0], [xa, 0], [xa, ySt], [x1s, ySt], [x1s, ySb]];
    if (reo) C.push([xE, ySb], [xE, yW], [20, yW], [20, yS]); else C.push([x0s, ySb], [x0s, yS]);
    C.push([xd, yS], [xd, yDt], [xL, yDt]); v.pl(C, true, 'S-CONC'); v.hatch(C, 'conc', 'S-HATCH', 0.9);
    // existing deck, hessian, deck-end foam, sheeting
    v.line(xL, yDt - 3, xd - 10, yDt - 3, 'S-HIDDEN'); v.line(xL, yS, xd - 10, yS, 'S-EXIST'); v.line(xd - 230, yDt, xd - 230, yS, 'S-EXIST'); v.brk(xL, yS, xL, 0);
    v.rect(xd - 10, yS, 10, yDt - yS, 'S-NEW'); v.hatch([[xd - 10, yS], [xd, yS], [xd, yDt], [xd - 10, yDt]], 'ansi31', 'S-HATCH', 0.4);
    [-75, 0].forEach(x => v.line(x, yS, x, yW - 120, 'S-EXIST')); [yS - 250, yS - 500].forEach(y => v.line(-75, y, 0, y, 'S-EXIST')); v.brk(-75, yW - 120, 0, yW - 120);
    // foam against the sheeting (or against the weak mix), weak mix block
    const fx = wm ? x0s - 20 : 0, fy1 = reo ? yW : ySb; v.rect(fx, fy1, 20, yS - fy1, 'S-NEW'); v.hatch([[fx, fy1], [fx + 20, fy1], [fx + 20, yS], [fx, yS]], 'ansi37', 'S-HATCH', 0.4);
    if (wm) { const W = [[0, yS], [fx, yS], [fx, ySb], [0, ySb]]; v.pl(W, true, 'S-CONC'); v.hatch(W, 'gravel', 'S-HATCH', 0.6); }
    // excavated face, ground treatment, soil behind the sill
    const wav = []; for (let y = ySb, k = 0; y >= yW - 60; y -= 60, k++) wav.push([xE + (k % 2 ? 6 : -4), y]); v.pl(wav, false, 'S-CONC');
    for (let x = xE + 30; x < x1s - 10; x += 40) v.line(x, ySb - 2, x - 25, ySb - 27, 'S-GROUND'); for (let y = ySt - 30; y > ySb; y -= 40) v.line(x1s + 2, y, x1s + 27, y - 25, 'S-GROUND');
    // galv sheet closing the void (concrete overlay) / Bondek
    if (!reo && !wm) { v.line(20, ySb - 3, xE + 5, ySb - 3, 'S-NEW'); v.line(xE + 5, ySb - 3, xE + 5, ySb + 22, 'S-NEW'); }
    if (wm) { v.line(-60, yS - 3, fx, yS - 3, 'S-NEW'); v.line(fx, yS - 3, fx, yS + 22, 'S-NEW'); }
    if (bk) { v.line(xd, yS, reo ? 20 : x0s, yS, 'S-NEW'); for (let x = xd + 120; x < -40; x += 200) v.pl([[x - 25, yS], [x - 15, yS + 18], [x + 15, yS + 18], [x + 25, yS]], false, 'S-NEW'); }
    // expansion angle and approach slab (dashed)
    v.fill([[xa - 75, -10], [xa, -10], [xa, 0], [xa - 75, 0]]); v.fill([[xa - 10, -150], [xa, -150], [xa, 0], [xa - 10, 0]]);
    v.pl([[xa + 10, 0], [xa + 80, 0], [xa + 80, 15], [x1s + 280, 15], [x1s + 280, 0]], false, 'S-HIDDEN'); v.pl([[xa + 10, -150], [xa + 10, ySt], [x1s + 280, ySt]], false, 'S-HIDDEN'); v.brk(x1s + 280, ySt, x1s + 280, 15);
    finishMark(v, (x0s + xa) / 2 + 60, 0, 'U2'); finishMark(v, xa + 120, ySt, 'U2'); slopeMark(v, x1s, ySt - 60, 0, '4'); if (!reo) slopeMark(v, xd + 120, yS, -90, '2');
    // reinforcement
    if (reo) {
      v.fabric(xL + 10, -30, xa - 40, -30, 120); v.bar([[xa - 40, -30], [xa - 40, -110]]); v.fabric(-1100, -55, -400, -55, 120);
      v.fabric(xL + 10, yDt + 25, xd + 300, yDt + 25, 120); v.fabric(xd + 20, yS + (bk ? 45 : 25), x0s + 60, yS + (bk ? 45 : 25), 120);
      v.pl([[x0s + 70, -205], [x1s - 70, -205], [x1s - 50, -225], [x1s - 50, ySb + 75], [x1s - 70, ySb + 55], [x0s + 70, ySb + 55], [x0s + 50, ySb + 75], [x0s + 50, -225], [x0s + 70, -205]], false, 'S-REO');
      [[x0s + 70, -225], [x1s - 70, -225], [x0s + 70, ySb + 75], [x1s - 70, ySb + 75]].forEach(q => v.barEnd(q[0], q[1], 16));
      v.bar([[x0s + 120, -50], [x0s + 120, ySb + 90], [x1s - 120, ySb + 90]]); v.bar([[xa - 70, -45], [xa - 70, -230], [x1s - 90, -230]]); v.bar([[x0s + 90, ySb + 120], [x0s + 150, ySb + 180]]);
      v.line(120, ySb - 40, 120, yW + 75, 'S-REO'); v.line(126, ySb - 40, 126, yW + 75, 'S-REO'); for (let y = ySb - 80; y > yW + 80; y -= 100) v.circ(123, y, 6, 'S-REO');
      v.dim(-260, 0, -260, -30, 4, '30', { sub: 'COVER' }); v.dim(xd, yDt + 60, xd + 300, yDt + 60, -16, '300 LAP');
      v.dim(x1s + 60, ySb + 75, x1s + 60, ySb, -4, '75'); v.dim(xE + 40, yW + 75, xE + 40, yW, 6, '75'); v.line(123, yW - 10, 123, yW - 120, 'S-DIM'); v.dim(20, yW - 100, 123, yW - 100, 0, '='); v.dim(123, yW - 100, xE, yW - 100, 0, '=');
      v.leader(-900, -55, -8, 20, '700 LONG'); v.leader(-500, -30, 0, 18, 'SL81 DECK FABRIC\nTYPE X'); v.leader(xa - 40, 0, 14, 22, 'EXPANSION ANGLE\nREFER TO DRG N°\nXX30-XXXX');
      v.leaders([[-1000, yDt + 25], [-700, yS + (bk ? 45 : 25)]], -10, -16, 'SL81 STANDARD\nFABRIC TYPE 9');
      v.leader(x0s + 120, -120, -24, -22, 'DX'); shapeAt(v, x0s + 120, -120, [[-36, -26.5], [-26, -26.5], [-26, -31]], [[-36, -26], [-24.5, -31, '200']].map(l => l.length === 3 ? l : [l[0], l[1], ''])); v.text(x0s + 120, -120, '', 2);
      { const q = v.P(x0s + 120, -120); v.add({ t: 'text', p: [q[0] - 36, q[1] - 26], s: '500', h: 2.0, al: 'l', v: 't', ang: 0, L: 'S-TEXT' }); }
      v.leaders([[x1s - 70, -225], [x1s - 70, ySb + 75]], 16, 4, 'DX (TYP)'); v.leader(x1s - 50, ySb + 160, 22, -20, 'DX'); shapeAt(v, x1s - 50, ySb + 160, [[30, -18.5], [36, -18.5], [36, -22.5], [30, -22.5], [30, -18.5]]);
      v.leaders([[x0s + 150, ySb + 180], [xa - 70, -230]], 14, -36, bk ? 'DX TO DX' : 'DX'); shapeAt(v, x0s + 150, ySb + 180, [[22, -40], [28, -40], [28, -47], [34, -47]], [[22, -39.5, '200'], [33, -50, '200']]);
      v.leader(123, ySb - 200, -24, -6, 'SL81 STANDARD\nFABRIC TYPE 9');
      if (bk) { v.leader(-300, yS, -8, -16, '1mm BONDEK\nPERMANENT\nFORMWORK'); v.dim(xa + 120, 0, xa + 120, -10, 3, '10', { sub: 'COVER' }); }
      v.mark(x1s + 200, -70, 'B', 180);
      LY.title('SECTION A', 10);
      { const B = new Builder(); nbox(B, 0, 0, bk ? 'FOR REINFORCED OVERLAY (WITH\nPERMANENT FORMWORK) DRG' : 'FOR REINFORCED\nOVERLAY DRG'); const q = v.P(-300, yW - 150); B.E.forEach(e => { A.shiftE(e, q[0], q[1] - 4); v.add(e); }); }
      return;
    }
    // concrete overlay: dimensions and notes
    v.dim(xd, 0, 20, 0, 14, ''); { const B = new Builder(); nbox(B, 0, 0, '900 NOM. (4 DECK PLANKS)'); const q = v.P((xd + 20) / 2, 0); B.E.forEach(e => { A.shiftE(e, q[0] - 22, q[1] + 22); v.add(e); }); }
    { const B = new Builder(); nbox(B, 0, 0, 'NOTE :- LENGTH OF CONCRETE DOWNSTAND\nSUBJECT TO ENGINEERING REQUIREMENTS &\nDECK CONDITION'); const q = v.P(xL, 0); B.E.forEach(e => { A.shiftE(e, q[0], q[1] + 42); v.add(e); }); }
    v.dim(x0s + 10, 0, xa, 0, 12, '300'); v.dim(xa - 150, 0, xa - 150, ySt, -3, '160'); v.dim(x1s + 80, ySt, x1s + 80, ySb, -4, '340'); v.dim(x0s, ySb - 120, x1s, ySb - 120, 0, '500'); v.dim(xE - 120, yS, xE - 120, yW, 4, '675'); v.dim(0, yW - 60, xE, yW - 60, -4, '200');
    v.dim(xa + 40, 0, xa + 40, -30, -2, ''); boxT(v, xa + 110, 60, 'X', 'l');
    { const B = new Builder(); nbox(B, 0, 0, 'VARIES ACCORDING TO\nASPHALT THICKNESS.\nENGINEER TO CONFIRM.'); const q = v.P(xa - 400, 0); B.E.forEach(e => { A.shiftE(e, q[0] - 28, q[1] + 30); v.add(e); }); }
    v.wl(xd + 300, yS - 30, ''); v.text(xd + 300 + 30, yS - 90, 'U/S DECK IS', 2.2, 'l', 't'); v.text(xd + 330, yS - 125, 'HORIZONTAL', 2.2, 'l', 't');
    v.leader(xL + 150, yDt - 3, -10, 16, 'HESSIAN'); v.leader(xL + 150, yDt - 70, -6, -18, 'EXISTING\nDECK', { dot: true });
    v.leader(xd - 5, yS + 40, -6, -30, FOAM10);
    v.leader(fx + 10, yS - 120, -16, -20, 'X THICK EXPANDED FOAM\n(FOSROC EXPANDAFOAM\nSHEET/STRIP BY PARCHEM\nCONSTRUCTION PRODUCTS\nOR SIMILAR APPROVED)');
    v.leader(-75, yW + 80, -14, -4, 'EXISTING SHEETING'); v.leader(xE, yW + 20, 10, -12, 'EXCAVATED\nFACE');
    if (wm) { v.leaders([[-40, yS - 3], [fx - 10, yS - 3]], -6, 30, '2 THICK GALV\nSHEET'); v.leader(fx / 2, yS - 120, 6, 34, 'WEAK MIX CONCRETE\nOPTIONAL', { dot: true }); shapeAt(v, -40, yS - 3, [[-22, 24], [-14, 24], [-14, 21.5]], [[-22, 25, '200'], [-12, 20.5, '25']]); }
    else { v.leaders([[100, ySb - 3], [xE + 5, ySb + 10]], 14, -20, '2 THICK GALV\nSHEET'); shapeAt(v, 100, ySb - 3, [[30, -21], [38, -21], [38, -23.5]], [[30, -20, '200'], [40, -24.5, '25']]); }
    v.leader(x1s - 150, ySb - 20, 14, -6, 'FOR GROUND TREATMENT\nREFER TO SPECIFICATION', { dot: true });
    v.leader(x1s + 100, ySt + 80, 10, 22, 'FOR APPROACH SLAB\nDETAILS REFER TO\nDRG N° XX30-XXXX', { dot: true });
    if (bk) v.leader(-650, yS, -2, -12, '1mm BONDEK PERMANENT\nFORMWORK');
    LY.title('SECTION A', 10);
    { const B = new Builder(); nbox(B, 0, 0, bk ? 'FOR REINFORCED OVERLAY (WITH\nPERMANENT FORMWORK) DRG' : 'FOR CONCRETE\nOVERLAY DRG'); const q = v.P(-300, yW - 150); B.E.forEach(e => { A.shiftE(e, q[0], q[1] - 4); v.add(e); }); }
  }
  // VIEW B: elevation of the sill beam reinforcement across the bridge
  function sillViewB(LY) {
    const v = LY.view(25), W = 7600, h = W / 2, top = x => 80 - abs(x) / h * 80, ySt = -160, ySb = -500, yW = -948;
    v.pl([[-h, ySb + 100], [-h, 130], [-h + 250, 130], [-h + 270, 110], [-h + 270, top(-h + 270)], [0, top(0)], [h - 270, top(h - 270)], [h - 270, 110], [h - 250, 130], [h, 130], [h, ySb + 100]], false, 'S-CONC');
    v.pl([[-h, ySb + 100], [-h, yW + 300], [h, yW + 300], [h, ySb + 100]], false, 'S-CONC');
    const crown = (dy, x0, x1, L) => v.pl([[x0, top(x0) + dy], [0, top(0) + dy], [x1, top(x1) + dy]], false, L || 'S-REO');
    v.pl([[-h + 60, top(-h + 60) - 40], [-60, top(-60) - 40]], false, 'S-REO'); v.line(-h + 60, top(-h + 60) - 40, -h + 60, top(-h + 60) - 120, 'S-REO');
    crown(-30, -h + 80, h - 80, 'S-HIDDEN'); crown(-60, -h + 80, h - 80, 'S-HIDDEN');
    v.line(-h, -40, h, -40, 'S-CONC'); v.line(-h + 50, -80, h - 50, -80, 'S-REO'); v.line(-h + 50, -100, h - 50, -100, 'S-HIDDEN'); v.line(-h + 50, -180, h - 50, -180, 'S-REO'); v.line(-h + 50, -200, h - 50, -200, 'S-HIDDEN'); v.line(-h + 50, -250, h - 50, -250, 'S-REO');
    v.line(-400, -150, 0, -150 + 0, 'S-REO'); v.fill([[-400, -158], [0, -152], [0, -146], [-400, -154]]);
    [-h + 1300, -h + 1800, -h + 2800, h - 2700, h - 1600].forEach((x, i) => { v.line(x, i === 3 ? -40 : -60, x, -260, 'S-REO'); v.line(x - 30, i === 3 ? -40 : -60, x + 30, i === 3 ? -40 : -60, 'S-REO'); v.circ(x, -150, 25, 'S-REO'); });
    v.line(1300, -40, 1300, -260, 'S-REO'); v.line(1340, -40, 1340, -260, 'S-REO');
    [[-h + 50, -2, -380], [-600, h - 50, -460]].forEach(([a, b, y]) => { extLine(v, a, y, b, y); });
    [[-h + 2300, -380], [1100, -460]].forEach(([x, y]) => { const q = v.P(x, y); [-0.6, 0.6].forEach(o => { v.add({ t: 'line', a: [q[0] + o, q[1] - 2], b: [q[0] + o, q[1] + 2], L: 'S-TEXT' }); v.add({ t: 'line', a: [q[0] - 2, q[1] + o], b: [q[0] + 2, q[1] + o], L: 'S-TEXT' }); }); v.add({ t: 'line', a: [q[0], q[1] - 4], b: [q[0], q[1] + 4], L: 'S-TEXT' }); });
    v.line(0, -560, 0, 400, 'S-CL'); v.text(0, 420, '℄ BRIDGE', 2.2, 'c', 'b');
    v.dim(-400, top(-400), 0, top(0), 9, '400', { sub: 'LAP' }); v.dim(0, top(0), 50, top(50), 9, '50', { sub: 'TYP' });
    v.leader(-h + 1800, -65, -4, 16, 'DX-1-N12 NF\nDX-1-N12 FF'); v.leader(h - 1600, -65, 6, 14, 'DX-1-N12 NF\nDX-1-N12 FF'); v.leader(1320, -40, 8, 20, 'DX-X-N12-200 NF\nDX-X-N12-200 FF\nIN PAIRS');
    v.leader(-h + 900, -380, -2, -16, 'SL81 STANDARD\nFABRIC TYPE 9', { dot: true }); v.leader(-h + 1300, -150, 2, -26, 'DX-X-N12-200'); v.leader(-h + 2000, -100, 4, -20, 'DX-X-N12-200');
    v.leader(-h + 2800, -150, 6, -18, 'DX-5-N12. REFER TO\nSECTION A FOR\nBAR LOCATIONS'); v.leader(2600, -460, 4, -12, 'SL81 STANDARD\nFABRIC TYPE 9', { dot: true }); v.leader(h - 2700, -150, 8, -20, 'DX-5-N12. REFER\nTO SECTION A FOR\nBAR LOCATIONS');
    LY.title('VIEW B', 25, 'EXPANSION ANGLE NOT SHOWN');
    { const B = new Builder(); nbox(B, 0, 0, 'FOR REINFORCED\nOVERLAY DRG'); const q = v.P(-600, yW + 300); B.E.forEach(e => { A.shiftE(e, q[0], q[1] - 32); v.add(e); }); }
  }
  def('slb', 'Deck & overlay', 'Overlay end at abutment – sill beam', 'PN30-3213 / 3213A', [P('pf', 'Formwork', 'both (as sheet)', { opts: ['both (as sheet)', 'galv sheet', 'Bondek'] }),
    P('wm', 'Weak mix concrete infill (PN30-3213A)', 'no (PN30-3213)', { opts: ['no (PN30-3213)', 'yes (PN30-3213A)'] }), P('show', 'Sections', 'all (as sheet)', { opts: ['all (as sheet)', 'reinforced overlay', 'concrete overlay'] })], (p) => {
    const LY = new Lay(760), pf = p.pf || 'both (as sheet)', wm = /yes/.test(p.wm || ''), sh = p.show || 'all (as sheet)';
    const opts = /both/.test(pf) ? [false, true] : [pf === 'Bondek'];
    if (!/concrete/.test(sh)) { sillViewB(LY); LY.break(); opts.forEach(b => sillSection(LY, { reo: true, bondek: b, wm })); LY.break(); }
    if (!/reinforced/.test(sh)) opts.forEach(b => sillSection(LY, { reo: false, bondek: b, wm }));
    LY.caption('SILL BEAM DETAILS - OVERLAY END AT ABUTMENT WITH APPROACH SLAB', null, wm ? 'PN30-3213A (WEAK MIX CONCRETE OPTION)' : 'PN30-3213');
    return LY.done();
  }, 'Sill beam at the abutment end of the overlay under the approach slab: 900 nom downstand over the last 4 deck planks, 500 x 340 sill with N12 ties, expansion angle, expanded foam against the sheeting; PN30-3213A option with weak mix concrete infill behind the sill.');
})(typeof window !== 'undefined' ? window : globalThis);
