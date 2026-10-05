/* StructCap Timber — repair details: PN30-3113 … 3123 (abutment stringers, widening, packing, bolting, splicing).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ local helpers
  const OVL = ['NO OVERLAY', 'EXISTING CONCRETE OVERLAY'];
  const isOvl = p => /CONCRETE/.test(String(p.ovl));
  // view title with the letter / number in a circle after it (MRWA 'SECTIONAL ELEVATION (A)', 'DETAIL (1)')
  function ttl(B, x, y, s, ch, scale, sub) {
    const h = 3.2, tw = s.length * h * 0.71, cw = ch ? 8 : 0, x0 = x - (tw + cw) / 2;
    B.title(x0 + s.length * h * 0.32, y, s, scale, sub);
    if (ch) { B.E.push({ t: 'circle', c: [x0 + tw + 5, y + h / 2], r: 3, L: 'S-TITLE' }); B.E.push({ t: 'text', p: [x0 + tw + 5, y + h / 2], s: ch, h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TITLE' }); }
  }
  // 'DRG NUMBER - REFER TO PLAN DRAWING' designer box with its pointer to the XX30-XXXX reference of a main title
  function drgBox(B, x, y, px, py) { nbox(B, x, y, 'DRG NUMBER - REFER TO\nPLAN DRAWING'); B.E.push({ t: 'line', a: [x, y - 3], b: [px, py], L: 'S-NOTE' }); }
  // note box with the sheet's own line breaks (no re-wrapping); dashed designer box, or { solid: true } construction box; returns [w, H]
  function nbox(B, x, y, s, opt) { opt = opt || {}; const h = opt.h || TH, L = String(s).split('\n'), w = opt.w || max(...L.map(l => l.length)) * h * 0.75 + 4, H = L.length * h * 1.55 + 2.6;
    B.E.push({ t: 'pl', p: [[x, y], [x + w, y], [x + w, y - H], [x, y - H]], closed: true, L: opt.solid ? 'S-TEXT' : 'S-NOTE' });
    L.forEach((l, i) => { B.E.push({ t: 'text', p: [x + 2, y - 1.6 - h - i * h * 1.55], s: l, h, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); if (!i && opt.u) B.E.push({ t: 'line', a: [x + 2, y - 2.4 - h], b: [x + 2 + l.length * h * 0.7, y - 2.4 - h], L: 'S-TEXT' }); });
    return [w, H]; }
  // arrowhead at paper point b on a line from a
  function arrowTo(B, a, b) { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), al = 2.4, aw = 0.8; B.E.push({ t: 'solid', p: [b, [b[0] - al * Math.cos(ang) - aw * Math.sin(ang), b[1] - al * Math.sin(ang) + aw * Math.cos(ang)], [b[0] - al * Math.cos(ang) + aw * Math.sin(ang), b[1] - al * Math.sin(ang) - aw * Math.cos(ang)]], L: 'S-TEXT' }); }
  // main bullet title with the XX30-XXXX project reference after it and the DRG NUMBER designer box under the reference
  function mainT(B, x, y, s, scale, sub) {
    B.mainTitle(x, y, s, scale, sub); const tw = s.length * 3.6 * 0.7, x0 = x - tw / 2 + 4, xr = x0 + s.length * 3.6 * 0.7 + 4;
    B.E.push({ t: 'text', p: [xr, y], s: 'XX30-XXXX', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }); drgBox(B, xr + 8, y - 6, xr + 6, y - 1);
  }
  // small dimension whose text sits outside, beyond x1 (side -1) or x2 (side 1): used for 45 / 45, 50 / 50 pairs
  function sdim(v, x1, x2, y, txt, side, opt) { v.dim(x1, y, x2, y, 0, ' ', opt); const p = v.P(side < 0 ? x1 : x2, y); v.add({ t: 'text', p: [p[0] + side * 3, p[1] + 0.7], s: txt, h: 2.0, al: side < 0 ? 'r' : 'l', v: 'b', ang: 0, L: 'S-DIM' }); }
  // short vertical dimension (arrows outside) with the text rotated beside it on the left
  function sdimV(v, x, y1, y2, txt, sub) { v.dim(x, y1, x, y2, 0, ' '); const p = v.P(x, (y1 + y2) / 2); v.add({ t: 'text', p: [p[0] - 1, p[1]], s: txt, h: 2.0, al: 'c', v: 'b', ang: 90, L: 'S-DIM' }); if (sub) v.add({ t: 'text', p: [p[0] + 1, p[1]], s: sub, h: 1.8, al: 'c', v: 't', ang: 90, L: 'S-DIM' }); }
  // "*" site-measured marker (asterisk) at paper point
  function star(B, x, y, r) { r = r || 1.4; for (let i = 0; i < 4; i++) { const a = i * PI / 4; B.E.push({ t: 'line', a: [x - r * Math.cos(a), y - r * Math.sin(a)], b: [x + r * Math.cos(a), y + r * Math.sin(a)], L: 'S-TEXT' }); } }
  const vstar = (v, x, y) => { const p = v.P(x, y); star(v.B, p[0], p[1]); };
  // dashed leader line (designer note pointer) between model point and paper point
  const dashTo = (v, x, y, px, py) => { const a = v.P(x, y); v.add({ t: 'line', a, b: [px, py], L: 'S-NOTE' }); };
  // timber deck planks seen in section (existing, dash-dot): top/bottom lines with plank joints; optional concrete overlay
  function deckX(v, x0, x1, y0, t, w, ovl, to) {
    v.line(x0, y0, x1, y0, 'S-EXIST'); v.line(x0, y0 + t, x1, y0 + t, 'S-EXIST');
    for (let x = x0 + w; x < x1 - 20; x += w) v.line(x, y0, x, y0 + t, 'S-EXIST');
    if (ovl) { const tc = to || 150; v.line(x0, y0 + t + tc, x1, y0 + t + tc, 'S-EXIST'); for (let x = x0 + 250; x < x1 - 200; x += 700) v.hatch([[x, y0 + t + 25], [x + 200, y0 + t + 20], [x + 230, y0 + t + 125], [x + 20, y0 + t + 130]], 'conc', 'S-HATCH', 0.8); }
  }
  // break line (vertical) across a member at x between y0..y1
  const vbrk = (v, x, y0, y1, L) => v.brk(x, y0, x, y1, L || 'S-EXIST');
  // modified flange plan (MODIFIED FLANGE DETAILS 1:10) — origin at slot end of the plate, plate centred on y = 0
  function modFlange(B, ox, oy, Lmf) {
    const v = B.view(10, ox, oy), x0 = -300, x1 = x0 + Lmf, xp = 50; // plate 200 wide; packer 200 x 300 starting 50 past the slot end
    v.rect(x0, -100, Lmf, 200, 'S-NEW'); v.pl([[x0, 5], [0, 5], [0, -5], [x0, -5]], false, 'S-NEW');
    v.line(xp, 100, xp, 150, 'S-NEW'); v.line(xp, 150, xp + 200, 150, 'S-NEW'); v.line(xp + 200, 150, xp + 200, 100, 'S-NEW');
    v.line(xp, -100, xp, -150, 'S-NEW'); v.line(xp, -150, xp + 200, -150, 'S-NEW'); v.line(xp + 200, -150, xp + 200, -100, 'S-NEW');
    v.line(xp, -100, xp, 100, 'S-HIDDEN'); v.line(xp + 200, -100, xp + 200, 100, 'S-HIDDEN');
    [[100, 1], [-100, -1]].forEach(([y, k]) => { for (let i = 0; i < 3; i++) v.line(xp + 70 + i * 12, y, xp + 80 + i * 12, y + k * 12, 'S-NEW'); });
    v.dim(x0, 100, x0, -100, -12, '200'); v.dim(x0, -5, x0, 5, 5, '10'); v.dim(x1, 150, x1, -150, 9, '300');
    v.dim(x0, -100, 0, -100, -9, '300'); v.dim(xp, -100, xp - 50, -100, 9, '50'); v.dim(xp, 150, xp + 200, 150, 7, '200');
    v.dim(x0, -100, x1, -100, -20, ' '); { const p = v.P((x0 + x1) / 2, -100); star(B, p[0], p[1] - 23); }
    v.leader(x0, -100, -6, -5, '200x16FL'); v.leader(xp + 200, 150, 8, 8, 'STEEL PACKER');
    v.weld(xp + 80, 105, -14, 13, { size: '6', site: true, tail: '30 LONG (TYP)' });
    return v;
  }

  // 44 ABUTMENT STRINGER REPLACEMENT TYPE 1 (PN30-3113 no overlay / 3114 existing concrete overlay)
  function abutT1(p, str) {
    const u = SEC[p.ub] || SEC['410UB54'], ovl = isOvl(p), He = max(250, +p.L || 300), B = new Builder();
    // ---- ELEVATION 1:20 (origin: top of fullcap / centre of pile)
    const v = B.view(20, 270, 150), D = 450, fcL = -280, fcR = -80, xe = 165, yM = 10, yMt = 26, yT = yMt + He, yB = yT - u.d, tf = u.tf, tp = 130, xs = -1700, xL = fcL - 350, Lmf = xe - xL;
    pileElev(v, 0, -1050, 0, D); v.line(-D / 2, 0, -D / 2, yT, 'S-EXIST'); v.line(D / 2, 0, D / 2, yT, 'S-EXIST');
    v.rect(fcL, -350, fcR - fcL, 350, 'S-EXIST'); v.dim; // fullcap
    v.line(D / 2 + 75, -950, D / 2 + 75, yT + tp, 'S-EXIST'); v.line(D / 2, yT, D / 2, yT + tp, 'S-EXIST'); vbrk(v, D / 2 + 37, -950, -950);
    v.hatch([[D / 2 + 75, -650], [D / 2 + 115, -650], [D / 2 + 115, -150], [D / 2 + 75, -150]], 'ansi31', 'S-HATCH', 0.7);
    deckX(v, xs, D / 2 + 75, yT, tp, 230, ovl); vbrk(v, xs, yT - 10, yT + tp + (ovl ? 160 : 10));
    // steel stringer with modified flange at the notched end
    v.line(xs, yT, xe, yT); v.line(xs, yT - tf, xe, yT - tf); v.line(xs, yB, fcL, yB); v.line(xs, yB + tf, fcL, yB + tf);
    v.line(fcL, yB, fcL, yM); v.line(xe, yT, xe, yM); vbrk(v, xs, yB - 10, yT - tf + 10, 'S-NEW');
    v.rect(xL, yM, Lmf, 16, 'S-NEW'); v.rect(fcL, 0, fcR - fcL, yM, 'S-NEW');
    timberX(v, xe, yM, D / 2 - xe, yT - yM, 'S-NEW');
    aSec(v, fcL, yB, 150, 150, 10, -1, -1); v.bolt(fcL - 90, yB - 10, fcL - 90, yB + tf, 20);
    rod(v, fcL - 10, yB - 120, fcR, yB - 120, 65);
    // deck fixings: rods (or coach screws) every third plank, spikes to loose planks
    const xr = [-1475, -785, -95];
    xr.forEach((x, i) => {
      if (ovl) v.spike(x + (i % 2 ? 45 : -45), yT - tf - 10, x + (i % 2 ? 45 : -45), yT + 120);
      else { v.bolt(x, yT - tf, x, yT + tp, 20); v.spike(x - 30, yT + tp, x - 200, yT + 30); v.spike(x + 30, yT + tp, x + 200, yT + 30); }
    });
    // section A cut
    const yA = yT + tp + (ovl ? 150 : 0) + 260; v.mark(-700, yA, 'A', 0); v.line(-700, yA - 60, -700, yA - 200, 'S-TITLE');
    v.line(-700, -1050, -700, -1300, 'S-TITLE'); { const q = v.P(-700, -1300); B.E.push({ t: 'solid', p: [[q[0], q[1]], [q[0], q[1] + 6], [q[0] + 2.2, q[1] + 3]], L: 'S-TITLE' }); }
    // dimensions
    v.dim(xs - 20, yMt, xs - 20, yT, 4, String(He), { sub: He === 300 ? 'MIN' : '' }); vstar(v, xs - 230, (yMt + yT) / 2);
    sdimV(v, -400, yB, yM, '50', 'MIN'); sdim(v, fcL - 100, fcL - 50, yT - 60, '50', -1); sdim(v, fcL - 50, fcL, yT - 60, '50', 1);
    // leaders
    const ty = yT + tp + (ovl ? 150 : 0);
    v.leader(-1150, yT + tp - 20, -10, 22, 'EXISTING TIMBER\nDECK');
    if (ovl) v.leader(-200, yT + tp + 100, 18, 14, 'EXISTING CONCRETE\nOVERLAY');
    else { v.leader(-95 - 150, yT + tp - 40, 20, 34, 'FIX LOOSE PLANKS TO ADJACENT\nBOLTED PLANKS WITH φ10x200 LONG\nSPIKE (TYP)'); v.leader(-95, yT + tp + 10, 18, 12, '65x5FLx65 STEEL\nWASHER (TYP)'); }
    v.leader(0, yT - 120, 30 + 0, 12, 'PROPOSED STEEL STRINGER');
    v.leader(D / 2 - 30, yT - 200, 21, 4, 'SEASONED JARRAH TIMBER\nPACKER OR STEEL SHIMS TO SUIT');
    v.leader(D / 2 + 75, yM - 30, 13, -2, 'EXISTING TIMBER\nABUTMENT SHEETING');
    v.leader(fcR, yM / 2, 30, -16, '200x(6,8,10 OR 12FL)x300 LONG\nSTEEL PACKERS, USED TO\nWEDGE STEEL STRINGER TIGHT\nAGAINST EXISTING DECKING. TACK\nWELD STEEL PACKERS TO\nSTRINGER AFTER PLACEMENT');
    v.leader(D / 2, -850, 13, 0, 'EXISTING TIMBER PILE');
    if (!str) v.leader(fcR - 40, yB - 120, 20, -41, 'φ20 THREADED ROD WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP)');
    v.leader(fcL + 50, -250, -16, -26, 'EXISTING TIMBER\nFULLCAP');
    v.leader(-340, yMt, -18, -24, 'MODIFIED FLANGE\nREFER TO DETAIL');
    v.weld(xL + 60, yMt, -12, -18, { size: '6', both: true, all: true, tail: ' ' }); { const q = v.P(xL + 60, yMt); B.E.push({ t: 'text', p: [q[0] - 12 - 14 - 4.5, q[1] - 18 + 0.3], s: 'BOTH SIDES', h: TH, al: 'r', v: 'b', ang: 0, L: 'S-TEXT' }, { t: 'text', p: [q[0] - 12 - 14 - 4.5, q[1] - 18 - 3.4], s: 'OF WEB', h: TH, al: 'r', v: 'b', ang: 0, L: 'S-TEXT' }); }
    const pe = v.P(0, -1050);
    B.title(pe[0] - 6, pe[1] - 14, 'ELEVATION', null);
    // ---- SECTIONAL ELEVATION A 1:20 (origin: top of fullcap at CL stringer)
    const s = B.view(20, str ? 92 : 70, 150), bf = u.b, tw = u.tw;
    s.rect(-520, -350, 1040, 350, 'S-EXIST'); vbrk(s, -520, -360, 10); vbrk(s, 520, -360, 10);
    deckX(s, -520, 520, yT, tp, 2000, ovl); vbrk(s, -520, yT - 10, yT + tp + (ovl ? 160 : 10)); vbrk(s, 520, yT - 10, yT + tp + (ovl ? 160 : 10));
    const xpk0 = str ? -128 : -190, xpk1 = str ? 157 : 190, rx = str ? [45] : [-45, 45], yd = yT + tp + (ovl ? 150 : 0);
    s.rect(xpk0, yMt, xpk1 - xpk0, yT - yMt, 'S-NEW'); // timber packer beyond
    if (str) { const r = (yT + 85) / 2; s.circ(-tw / 2 - 130 - r, yT - r, r, 'S-EXIST'); s.fill(circP(-tw / 2 - 130 - r, yT - r, 9, 8), 'S-TEXT'); s.leader(-tw / 2 - 130 - r, yT - r, -20, -6, 'EXISTING TIMBER STRINGER', { noArrow: true }); }
    iSec(s, 0, (yT + yB) / 2, u, 0); s.rect(-150, 0, 300, yM); s.rect(-100, yM, 200, 16); s.fill([[-100, yM], [100, yM], [100, yMt], [-100, yMt]]);
    s.rect(-150, yB - 150, 300, 150, 'S-NEW'); s.line(0, yB - 160, 0, yB - 300, 'S-CL');
    [-100, 100].forEach(x => { s.circ(x, yB - 120, 14, 'S-BOLT'); s.fill(circP(x, yB - 120, 10, 12), 'S-BOLT'); });
    [-45, 45].forEach(x => s.bolt(x, yB - 10, x, yB + tf, 20));
    if (ovl) rx.forEach(x => s.spike(x, yT - tf - 10, x, yT + 120)); else rx.forEach(x => s.bolt(x, yT - tf, x, yT + tp, 20));
    s.cl(0, yB - 300, 0, yd + 260, 'STRINGER');
    if (!str) sdim(s, -45, 0, yd + 120, '45', -1); sdim(s, 0, 45, yd + 120, '45', 1);
    if (!ovl) sdimV(s, str ? -150 : -280, yT + tp, yT + tp + 50, '50', str ? '' : '(TYP)');
    sdim(s, -100, 0, yB - 360, '100', -1); sdim(s, 0, 100, yB - 360, '100', 1);
    sdimV(s, 330, yB - 150, yB - 120, '30');
    if (str) {
      if (ovl) s.leader(45, yT + 80, 16, 24, 'φ20x130 LONG COACH\nSCREW EVERY THIRD\nDECK PLANK'); else s.leader(45, yT + tp + 20, 18, 14, 'THREADED ROD EVERY\nTHIRD DECK PLANK');
      s.leader(-45, yB - 20, -24, -6, 'M20 BOLT (TYP)');
      s.leader(0, yT - 100, -30, 30, secName(p.ub) + '\nSTRINGER');
      s.leader(xpk0, yT - 150, -34, 12, 'TIMBER PACKER OR STEEL\nSHIMS FIXED TO SHEETING\nWITH φ3.2 CLOUT HEAD\nNAILS');
      s.leader(-150, yB - 150, -12, -12, '150x150x10 EA\nx300 LONG (TYP)');
      s.leader(100, yB - 120, 16, -14, 'φ20 THREADED ROD WITH\n65x5FLx65 WASHER TO\nTIMBER FACE');
    } else {
    if (ovl) s.leader(-45, yT + 60, -22, 30, 'φ20x130 LONG COACH\nSCREW EVERY THIRD\nDECK PLANK ON\nALTERNATING SIDES OF\nWEB');
    else s.leader(45, yT + tp + 20, 18, 16, 'THREADED ROD EVERY\nTHIRD DECK PLANK ON\nALTERNATING SIDES OF\nWEB');
    s.leader(-45, yB - 20, -16, 12, 'M20 BOLT (TYP)');
    s.leader(tw / 2, yT - 120, 20, 0, secName(p.ub) + '\nSTRINGER');
    s.leader(190, yT - 160, 14, -30, 'TIMBER PACKER OR STEEL\nSHIMS FIXED TO SHEETING\nWITH φ3.2 CLOUT\nHEAD NAILS.');
    s.leader(-150, yB - 150, -10, -12, '150x150x10 EA\nx300 LONG');
    }
    const ps = s.P(0, yB - 360); ttl(B, ps[0], ps[1] - 16, 'SECTIONAL ELEVATION', 'A', 20);
    // ---- MODIFIED FLANGE DETAILS 1:10
    modFlange(B, 420, 165, Lmf); B.title(440, 120, 'MODIFIED FLANGE DETAILS', 10);
    // ---- notes / designer boxes
    nbox(B, 180, 222, 'NOTE:\nSTEEL STRINGER SHALL BE FABRICATED TO\nALLOW ADEQUATE CLEARANCE FROM ABUTMENT\nSHEETING TO FACILITATE INSTALLATION.', { solid: true });
    const tl = s.P(-45, yT + tp + 5);
    if (str) { const tu = s.P(-tw / 2, yT - 40); const bx = s.P(320, 0)[0]; nbox(B, bx, 164, 'UB STRINGER SHALL BE\nPLACED AS CLOSE AS\nPOSSIBLE TO EXISTING\nTIMBER STRINGER', { solid: true }); B.E.push({ t: 'line', a: [bx, 156], b: tu, L: 'S-TEXT' }); }
    if (!ovl) { const tb = str ? 'TACK WELD OR CENTRE\nPUNCH BOLT THREAD\nTO NUT TO PREVENT\nUNDOING OF NUT. (TYP)' : 'TACK WELD OR\nCENTRE PUNCH BOLT\nTHREAD TO NUT\nTO PREVENT UNDOING\nOF NUT. (TYP)'; nbox(B, 20, 222, tb, { solid: true }); B.E.push({ t: 'line', a: [40, 222 - (str ? 16 : 19.6)], b: tl, L: 'S-TEXT' }); }
    { const nx = str ? 158 : 150; nbox(B, nx, 135, '      NOTE:\n300 MIN CAN BE REDUCED\nSUBJECT TO ENGINEER\'S\nASSESSMENT & VERIFICATION', { h: 1.8 }); dashTo(v, xs - 140, yMt, nx + 28, 135); }
    nbox(B, 112, 106, 'NOTE:\nGAP BETWEEN STRINGER\nAND DECK SHALL BE\nSUITABLY PACKED REFER\nTO STEEL STRINGER\nPACKING DETAIL', { solid: true, u: 1 });
    nbox(B, 425, 110, 'NOTE:\nDIMENSIONS DENOTED THUS *\nSHALL BE SITE MEASURED\nPRIOR TO FABRICATION &\nCONSTRUCTION.', { solid: true });
    if (str) nbox(B, 20, 92, 'NOTE:  STRINGER STRENGTHENING\nSIZE WILL VARY ACCORDING TO\nENGINEERING REQUIREMENTS\n' + secName(p.ub) + ' STRINGER STRENGTHENING\nDRAWN', { h: 1.8 });
    else nbox(B, 350, 100, 'NOTE:  STRINGER SIZE WILL\nVARY ACCORDING TO ENGINEERING\nREQUIREMENTS\n' + secName(p.ub) + ' STRINGER DRAWN', { h: 1.8 });
    mainT(B, 290, 74, str ? 'ABUTMENT - STRINGER STRENGTHENING DETAIL' : 'ABUTMENT - STRINGER REPLACEMENT DETAIL - TYPE 1', 20, 'ABUTMENT N° X - STRINGER N° X');
    return B.E;
  }
  const T1P = () => [P('ub', 'Proposed stringer', '410UB54', { opts: UBs }), P('L', 'Notched end depth (300 MIN) (mm)', 300, { num: 1 }), P('ovl', 'Deck', OVL[0], { opts: OVL })];
  def('asr', 'Stringers', 'Abutment stringer replacement – Type 1 (modified flange)', 'PN30-3113 / 3114', T1P(), p => abutT1(p, false),
    'Replacing an abutment timber stringer with a UB whose notched end (modified flange) seats on the timber fullcap via steel packers and a bolted seat angle — with or without an existing concrete overlay.');
  def('pn3117', 'Stringers', 'Abutment stringer strengthening (additional UB stringer)', 'PN30-3117 / 3118', T1P(), p => abutT1(p, true),
    'Strengthening an abutment span by adding a UB stringer placed as close as possible to the existing timber stringer, seated on the fullcap with a modified flange — with or without an existing concrete overlay.');

  // deck fixings over a steel stringer in elevation: rods + spikes (no overlay) or coach screws (overlay); xr = rod positions
  function deckFix(v, xr, yT, tf, tp, ovl) {
    xr.forEach((x, i) => {
      if (ovl) v.spike(x, yT - tf - 10, x, yT + 120);
      else { v.bolt(x, yT - tf, x, yT + tp, 20); v.spike(x - 30, yT + tp, x - 200, yT + 30); v.spike(x + 30, yT + tp, x + 200, yT + 30); }
    });
  }
  // section-cut pointer pair of an elevation (marker at the top, arrowhead at the bottom), looking +x
  function cutA(v, x, yTop, yBot, ch) { v.mark(x, yTop, ch || 'A', 0); v.line(x, yTop - 60, x, yTop - 200, 'S-TITLE'); v.line(x, yBot + 250, x, yBot, 'S-TITLE'); const q = v.P(x, yBot); v.add({ t: 'solid', p: [[q[0], q[1]], [q[0], q[1] + 6], [q[0] + 2.2, q[1] + 3]], L: 'S-TITLE' }); }
  const CLEAT = ["'U' THREADED ROD (PN30-2317)", '150x100x10 EA CLEAT (PN30-2317A)'];

  // ABUTMENT STRINGER REPLACEMENT TYPE 2 — steel stringer on a notched timber fullcap with a PFC fullcap strengthener
  // (PN30-3115 no overlay, 3115A cleat variant, 3116 existing concrete overlay, 3116A overlay + cleat)
  def('pn3115', 'Stringers', 'Abutment stringer replacement – Type 2 (notched fullcap, PFC strengthener)', 'PN30-3115 / 3115A / 3116 / 3116A', [P('ub', 'Proposed stringer', '410UB54', { opts: UBs }), P('pfc', 'PFC fullcap strengthener', '300PFC', { opts: PFCs }), P('ovl', 'Deck', OVL[0], { opts: OVL }), P('cl', 'PFC support', CLEAT[0], { opts: CLEAT })], (p) => {
    const u = SEC[p.ub] || SEC['410UB54'], c = SEC[p.pfc] || SEC['300PFC'], ovl = isOvl(p), clt = /CLEAT/.test(String(p.cl)), B = new Builder();
    const D = 470, fcL = -277, fcR = -91, yB = -70, yT = yB + u.d, tf = u.tf, tp = 130, xs = -1500, xe = 180, yP = -360, yPb = yP - c.d, xw = -148, to = ovl ? 150 : 0;
    // ---- ELEVATION 1:20 (origin: top of fullcap at ℄ pile)
    const v = B.view(20, 325, 168);
    v.line(D / 2, -1300, D / 2, yB, 'S-EXIST'); v.line(-D / 2, -1300, -D / 2, -790, 'S-EXIST'); v.pileEnd(0, -1300, D);
    v.rect(-D / 2, -835, D, 45, 'S-EXIST');
    v.line(D / 2 + 70, -1150, D / 2 + 70, yT + tp + to, 'S-EXIST'); v.line(D / 2, yT, D / 2, yT + tp + to, 'S-EXIST'); vbrk(v, D / 2 + 35, -1150, -1150);
    if (ovl) { v.line(D / 2 + 70, yT + tp + to, D / 2 + 160, yT + tp + to, 'S-EXIST'); v.line(D / 2 + 160, yT + tp + to, D / 2 + 160, yB, 'S-EXIST'); }
    deckX(v, xs, D / 2 + 70, yT, tp, 230, ovl); vbrk(v, xs, yT - 10, yT + tp + to + 10);
    v.pl([[fcL, yB - 20], [fcL, yP], [fcR, yP], [fcR, 0], [xe - 40, 0]], false, 'S-EXIST'); v.line(fcL, yB, fcL, yB + 5, 'S-EXIST');
    iElevWebH(v, xs, xe, (yT + yB) / 2, u); vbrk(v, xs, yB - 10, yT + 10, 'S-NEW'); v.line(xe, yB, xe, yT);
    timberX(v, xe, yB, D / 2 - xe, yT - yB, 'S-NEW');
    aSec(v, fcL, yB, 150, 150, 10, -1, -1); v.bolt(fcL - 90, yB - 10, fcL - 90, yB + tf, 20); rod(v, fcL - 10, yB - 120, fcR, yB - 120, 65);
    cSec(v, xw, (yP + yPb) / 2, c, -1); v.fill([[xw - 10, yP], [xw, yP], [xw, yPb], [xw - 10, yPb]]);
    v.rect(xw - c.b, yPb - 40, c.b, 40, 'S-NEW'); v.hatch([[xw - c.b, yPb - 40], [xw, yPb - 40], [xw, yPb], [xw - c.b, yPb]], 'ansi31', 'S-HATCH', 0.5);
    v.bolt(-200, yP - c.tf, -200, 0, 20);
    if (clt) { v.pl([[xw, yP - 20], [xw + 100, yP - 20], [xw + 100, yPb + 20], [xw, yPb + 20]], false, 'S-NEW'); v.line(xw + 10, yP - 20, xw + 10, yPb + 20, 'S-HIDDEN'); v.arc(xw + 100, yP - 20 - 50, 50, -90, 90, 'S-EXIST'); [yP - 70, yPb + 70].forEach(y => { v.rect(xw + 20, y - 25, 50, 50, 'S-BOLT'); v.circ(xw + 45, y, 14, 'S-BOLT'); v.line(xw - 30, y, xw + 20, y, 'S-BOLT'); }); }
    else { v.line(xw - 40, (yP + yPb) / 2, D / 2 + 40, (yP + yPb) / 2, 'S-BOLT'); v.nut(xw - c.tw, (yP + yPb) / 2, -1, 0, 20); }
    deckFix(v, [-1350, -660, 30], yT, tf, tp, ovl);
    cutA(v, -800, yT + tp + to + 300, -1600);
    sdim(v, fcL - 90, fcL, yB + 140, '90', -1);
    // designer region (fullcap strengthening detail varies)
    v.pl([[-1700, yP - 0], [D / 2 + 150, yP], [D / 2 + 150, -1500], [-1700, -1500]], true, 'S-NOTE');
    { const a = v.P(-D / 2, -1050), b = v.P(xw, -1050); v.add({ t: 'line', a: [a[0] - 34, a[1]], b: a, L: 'S-DIM' }); v.arrow(-D / 2, -1050, 0, 'S-DIM'); v.add({ t: 'line', a: b, b: [b[0] + 5, b[1]], L: 'S-DIM' }); v.arrow(xw, -1050, 180, 'S-DIM');
      v.add({ t: 'text', p: [a[0] - 17, a[1] + 1], s: '70 MINIMUM', h: TH, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); ['IF BEARING < 70', 'REFER TO FULLCAP', 'BEARING SUPPORTS', 'DETAILS'].forEach((l, i) => v.add({ t: 'text', p: [a[0] - 17, a[1] - 3.6 - i * 3.4], s: l, h: TH, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' })); }
    // leaders
    const yd = yT + tp + to;
    if (ovl) { v.leader(-600, yT + tp - 10, 8, 30, 'EXISTING\nTIMBER\nDECK'); v.leader(0, yT - 120, 14, 22, 'PROPOSED STEEL STRINGER\nREPLACEMENT'); }
    else {
      v.leader(-1150, yT + tp - 20, -10, 20, 'EXISTING TIMBER\nDECK');
      v.leader(-660 + 150, yT + tp - 40, 16, 50, 'FIX LOOSE PLANKS TO\nADJACENT BOLTED PLANKS\nWITH φ10x200 LONG SPIKE\n(TYP)'); v.leader(30, yT + tp + 10, 14, 30, '65x5FLx65 STEEL\nWASHER (TYP)');
      v.leader(0, yT - 120, 14, 22, 'PROPOSED STEEL\nSTRINGER');
    }
    v.leader(D / 2, yT - 100, 15, 0, 'SEASONED JARRAH TIMBER\nPACKER OR STEEL SHIMS TO SUIT');
    v.leader(fcR - 30, yB - 120, 20, 8, 'φ20 THREADED ROD WITH\n65x5FLx65 WASHER TO\nTIMBER FACE (TYP)');
    v.leader(D / 2 + 70, yP - 60, 13, 0, 'EXISTING TIMBER\nABUTMENT SHEETING');
    if (clt) { v.leader(xw + 100, yP - 120, 22, -16, 'NOTCH PILE\nTO SUIT'); v.leader(xw + 60, yPb + 50, 26, -26, '150x100x10EA'); }
    else v.text(D / 2 + 300, (yP + yPb) / 2 - 300, "φ20 'U' THREADED ROD");
    v.leader(0, -1150, 18, -5, 'EXISTING TIMBER PILE');
    v.leader(fcL + 40, yP + 30, -13, 3, 'EXISTING TIMBER\nFULLCAP');
    v.leader(xw - c.b, yPb + 20, -12, 4, '* PROPOSED ' + secName(p.pfc) + '\nFULLCAP STRENGTHENER');
    { const q = v.P(0, -1600); B.title(q[0] + 14, q[1] - 6, 'ELEVATION', null); }
    // ---- SECTIONAL ELEVATION A 1:20 (origin: top of fullcap at ℄ stringer)
    const s = B.view(20, 112, 168), xp = -670;
    s.line(-1330, 0, 610, 0, 'S-EXIST'); s.line(-1330, -30, -1330, yP, 'S-EXIST'); vbrk(s, -1330, yP + 20, 0); vbrk(s, 610, yP + 20, 0);
    pfcElevH(s, -1330, 610, yP, c); vbrk(s, -1330, yPb - 10, yP + 10, 'S-NEW'); vbrk(s, 610, yPb - 10, yP + 10, 'S-NEW');
    s.line(xp - D / 2, -30, xp - D / 2, yPb, 'S-HIDDEN'); s.line(xp + D / 2, -30, xp + D / 2, yPb, 'S-HIDDEN'); s.line(xp - D / 2, -30, xp + D / 2, -30, 'S-HIDDEN');
    s.line(xp - D / 2, yPb - 40, xp - D / 2, -1300, 'S-EXIST'); s.line(xp + D / 2, yPb - 40, xp + D / 2, -1300, 'S-EXIST'); s.pileEnd(xp, -1300, D); s.rect(xp - D / 2, -835, D, 45, 'S-EXIST');
    s.rect(xp - 160, yPb - 40, 320, 40, 'S-NEW'); s.hatch([[xp - 160, yPb - 40], [xp + 160, yPb - 40], [xp + 160, yPb], [xp - 160, yPb]], 'ansi31', 'S-HATCH', 0.5);
    [[xp - 130, -110], [xp + 130, -290]].forEach(([x, y]) => { s.rect(x - 22, y - 22, 44, 44, 'S-BOLT'); s.circ(x, y, 12, 'S-BOLT'); });
    if (clt) { s.rect(xp - D / 2, yP - 40, D, c.d - 80, 'S-HIDDEN'); [[xp - D / 2 + 20, yP - 60], [xp + D / 2 - 20, yP - 60], [xp - D / 2 + 20, yPb + 60], [xp + D / 2 - 20, yPb + 60]].forEach(([x, y]) => s.rect(x - 15, y - 12, 30, 24, 'S-BOLT')); s.circ(xp, (yP + yPb) / 2, 18, 'S-BOLT'); [yP - 100, yPb + 100].forEach(y => { s.circ(xp + D / 2 + 50, y, 22, 'S-BOLT'); s.circ(xp + D / 2 + 50, y, 12, 'S-BOLT'); }); }
    else { s.line(xp - 200, (yP + yPb) / 2, xp + 200, (yP + yPb) / 2, 'S-HIDDEN'); [xp - 200, xp + 200].forEach(x => { s.circ(x, (yP + yPb) / 2, 22, 'S-BOLT'); s.circ(x, (yP + yPb) / 2, 10, 'S-BOLT'); }); }
    s.bolt(-1070, yP - c.tf, -1070, 0, 20);
    deckX(s, -400, 400, yT, tp, 2000, ovl); vbrk(s, -400, yT - 10, yT + tp + to + 10); vbrk(s, 400, yT - 10, yT + tp + to + 10);
    s.rect(-175, yB, 350, yT - yB, 'S-NEW'); iSec(s, 0, (yT + yB) / 2, u, 0);
    s.rect(-150, yB - 150, 300, 150, 'S-NEW'); s.line(0, yB - 160, 0, yB - 330, 'S-CL');
    [-100, 100].forEach(x => { s.circ(x, yB - 120, 14, 'S-BOLT'); s.fill(circP(x, yB - 120, 10, 12), 'S-BOLT'); });
    [-45, 45].forEach(x => s.bolt(x, yB - 10, x, yB + tf, 20));
    if (ovl) [-45, 45].forEach(x => s.spike(x, yT - tf - 10, x, yT + 120)); else [-45, 45].forEach(x => s.bolt(x, yT - tf, x, yT + tp, 20));
    s.cl(0, yB - 330, 0, yd + 300, 'STRINGER');
    sdim(s, -45, 0, yd + 150, '45', -1); sdim(s, 0, 45, yd + 150, '45', 1);
    if (!ovl) sdimV(s, -330, yT + tp, yT + tp + 50, '50', '(TYP)');
    sdim(s, -100, 0, yB - 330, '100', -1); sdim(s, 0, 100, yB - 330, '100', 1); sdimV(s, 230, yB - 150, yB - 120, '30');
    if (ovl) { s.leader(-45, yT + 60, -24, 36, 'φ20x130 LONG COACH SCREW\nEVERY THIRD DECK PLANK ON\nALTERNATING SIDES OF WEB'); s.leader(150, yT + tp + 60, 10, 26, 'EXISTING\nCONCRETE\nOVERLAY'); }
    else s.leader(45, yT + tp + 20, 18, 14, 'THREADED ROD EVERY\nTHIRD DECK PLANK ON\nALTERNATING SIDES OF\nWEB');
    s.leader(-175, yT - 60, -22, 18, 'TIMBER PACKER OR STEEL\nSHIMS FIXED TO SHEETING\nWITH φ3.2 CLOUT\nHEAD NAILS.');
    s.leader(-45, yB - 5, -18, 10, 'M20 BOLT (TYP)');
    s.leader(u.tw / 2, yT - 140, 22, 0, secName(p.ub) + ' STRINGER REPLACEMENT');
    s.leader(150, yB + 10, 26, -6, '* EXISTING TIMBER FULLCAP\n   NOTCHED TO SUIT');
    s.leader(150, yB - 150, 30, -28, '150x150x10 EA\nx300 LONG (TYP)');
    s.leader(-1150, -150, -10, 0, 'EXISTING TIMBER\nFULLCAP', { dot: true });
    s.leader(-1000, yPb, -10, -18, (ovl ? '' : '* ') + 'PFC FULLCAP\nSTRENGTHENER');
    s.leader(xp + 160, yPb - 30, 14, -8, 'STEEL\nPACKERS');
    s.leader(xp + D / 2, -1100, 14, -6, 'EXISTING TIMBER\nPILE (TYP)');
    { const q = s.P(-200, -1500); ttl(B, q[0], q[1] - 4, 'SECTIONAL ELEVATION', 'A', 20); }
    // ---- notes and designer boxes
    const tl = s.P(-45, yT + tp + 5);
    if (!ovl) { nbox(B, 52, 262, 'TACK WELD OR\nCENTRE PUNCH BOLT\nTHREAD TO NUT\nTO PREVENT UNDOING\nOF NUT. (TYP)', { solid: true }); B.E.push({ t: 'line', a: [80, 262 - 19.6], b: tl, L: 'S-TEXT' }); }
    nbox(B, ovl ? 190 : 120, ovl ? 252 : 274, 'NOTE:\nSTEEL STRINGER SHALL BE FABRICATED TO\nALLOW ADEQUATE CLEARANCE FROM ABUTMENT\nSHEETING TO FACILITATE INSTALLATION.', { solid: true });
    nbox(B, ovl ? 190 : 165, ovl ? 278 : 252, '* PFC CHANNEL FULLCAP STRENGTHENER\n   MUST BE INSTALLED IF EXISTING TIMBER\n   FULLCAP HAS TO BE NOTCHED TO\n   ACCOMMODATE NEW UB STEEL STRINGER.', { solid: true });
    nbox(B, 300, 278, 'NOTE:\nGAP BETWEEN STRINGER AND DECK\nSHALL BE SUITABLY PACKED REFER\nTO STEEL STRINGER PACKING DETAIL', { solid: true, u: 1 });
    nbox(B, 160, 70, 'NOTE: REFER TO VARIOUS FULLCAP STRENGTHENING\nDETAILS (PN30-2317 TO 2327) FOR APPROPRIATE\nDETAIL TO BE INCLUDED ON DRAWINGS. (PN30-2317' + (clt ? 'A' : '') + '\nWAS USED FOR THIS EXAMPLE)'); { const q = v.P(-1700, -1500); B.E.push({ t: 'line', a: q, b: [228, 70], L: 'S-NOTE' }); }
    nbox(B, 160, 46, 'THIS DETAIL SHALL BE USED ONLY\nWHEN STEEL FULLCAP STRINGER\nREPLACEMENT AND NOTCHING OF\nEXISTING TIMBER FULLCAP OCCURS.\nFOR FURTHER STRINGER DETAILS\nREFER TO RELEVANT DETAILS.');
    nbox(B, 395, 82, 'NOTE: PROPOSED STRINGER REPLACEMENT\nAND PFC FULLCAP STRENGTHENER SIZE\nWILL VARY ACCORDING TO ENGINEERING\nREQUIREMENTS.\n' + secName(p.ub).replace(/ /g, '') + ' STRINGER REPLACEMENT DRAWN\n' + secName(p.pfc) + ' FULLCAP STRENGTHENER DRAWN');
    mainT(B, 330, 52, 'ABUTMENT - STRINGER REPLACEMENT DETAIL - TYPE 2', 20, 'ABUTMENT N° X - STRINGER N° X\nABUTMENT N° X - STRINGER N° X');
    return B.E;
  }, 'Abutment stringer replacement where the timber fullcap must be notched for the new UB: the UB seats on a bolted angle and a PFC fullcap strengthener (PN30-2317 / 2317A) is installed under the fullcap.');

  // ABUTMENT WIDENING & ADDITIONAL STRINGER (PN30-3119)
  def('pn3119', 'Stringers', 'Abutment widening & additional stringer', 'PN30-3119', [P('ub', 'Proposed additional stringer', '410UB54', { opts: UBs }), P('pfc', 'Stub column / fullcap PFC', '300PFC', { opts: PFCs })], (p) => {
    const u = SEC[p.ub] || SEC['410UB54'], c = SEC[p.pfc] || SEC['300PFC'], B = new Builder(), d = u.d, tf = u.tf, pf = secName(p.pfc);
    // ---- PLAN 1:20 (origin: ℄ abutment at the deck edge)
    const v = B.view(20, 140, 312);
    v.line(-1950, 867, -1133, 317, 'S-CONC'); v.line(-2140, 740, -1800, 300, 'S-CONC'); v.line(-2045, 803, -1470, 310, 'S-CL'); v.brk(-2140, 740, -1950, 867, 'S-TEXT');
    v.pl([[-1800, 300], [-517, -983], [-517, -1567]], false, 'S-CONC'); v.pl([[-1133, 317], [-283, -533], [-283, -800]], false, 'S-CONC');
    v.line(-1700, 300, -1394, 0, 'S-CONC'); // joint through kerb (75 from the wingwall face)
    [[-1600, 150], [-1300, 0]].forEach(([x, y], i) => v.line(x + 70, y + 0, x + 70 + 800, y - 800, 'S-HIDDEN'));
    v.line(-1800, 300, 540, 300, 'S-CONC'); v.line(-2300, 0, 780, 0, 'S-CONC'); v.line(-2300, 150, -1650, 150, 'S-CONC'); vbrk(v, -2300, -20, 170, 'S-TEXT'); vbrk(v, 780, -140, 20, 'S-TEXT');
    v.line(540, 300, 540, -1567, 'S-CONC'); vbrk(v, 540, -420, -360, 'S-TEXT'); vbrk(v, 540, -1100, -1040, 'S-TEXT'); v.line(-517, -1567, 540, -1567, 'S-CONC');
    v.line(-1483, 83, 780, 83, 'S-HIDDEN'); v.line(-1483, -117, 780, -117, 'S-HIDDEN'); v.line(-1483, 83, -1483, -117, 'S-HIDDEN');
    v.line(-583, -733, 540, -733, 'S-HIDDEN'); for (let x = -767; x < 540; x += 200) if (x > -560) { v.line(x, -117, x, -733, 'S-HIDDEN'); v.line(x + 30, -117, x + 30, -733, 'S-HIDDEN'); }
    v.line(117, 170, 117, -1567, 'S-HIDDEN'); v.line(217, 170, 217, -1567, 'S-HIDDEN'); v.rect(117, 130, 100, 40, 'S-NEW');
    v.line(-317, -600, -317, -1567, 'S-HIDDEN'); v.line(-283, -600, -283, -1567, 'S-HIDDEN');
    v.circ(-750, -50, 200, 'S-EXIST'); v.circ(0, -800, 200, 'S-EXIST');
    v.cl(0, -1800, 0, 1150, 'ABUTMENT'); vbrk(v, 0, -1600, -1530, 'S-TEXT');
    [-1057, -657, -257, 143].forEach(x => v.boltEnd(x, -57, 25));
    v.dim(-1250, 800, -250, 800, 0, '1000 (NOM.)'); v.line(-1250, 800, -1250, 0, 'S-DIM'); v.line(-250, 800, -250, 0, 'S-DIM');
    v.dimChain([[-367, 500], [-257, 500], [-167, 500]], 0, ['=', '=']); sdimV(v, -833, -57, 0, '45', '(TYP)');
    v.dim(-2150, 0, -2150, 300, 0, ' '); v.dim(-2033, 0, -2033, 150, 0, ' ');
    { const ux = 0.707, uy = 0.707; v.dim(-1700 + 0, 300, -1700 + 53, 300 - 53, 0, ' '); const q = v.P(-1640, 200); v.add({ t: 'text', p: [q[0] - 3, q[1] - 6], s: '75', h: 2.0, al: 'c', v: 'b', ang: 45, L: 'S-DIM' }); }
    v.mark(-2650, -67, 'A', 90); v.line(-2500, -67, -2350, -67, 'S-TITLE'); v.line(950, -67, 1400, -67, 'S-TITLE'); v.fill([[1100, -67], [1400, -67], [1300, 0], [1200, 0]], 'S-TITLE');
    v.leader(-1650, 650, 10, 24, 'REFER TO WINGWALL\nEXTENSION DETAILS');
    v.leader(-2100, 300, -8, 8, 'KERB'); v.leader(-1560, 160, -16, -16, 'JOINT THROUGH\nKERB');
    v.leader(-480, -330, -22, -16, "BUILDEX WAFER HEAD TAPTITE SCREW\nOR SIMILAR APPROVED AT 400 CRS IN\nPREDRILLED HOLE TO MANUFACTURER'S\nDETAILS");
    v.leader(170, 170, 8, 30, 'PROPOSED\nSTUB COLUMN'); v.leader(143, -57, 22, 22, 'ANCHOR BOLT M16\nx150 LONG AT 400\nCRS (TYP)');
    v.leader(700, -117, 10, -8, 'PROPOSED\nADDITIONAL\nSTRINGER'); v.leader(467, -500, 14, -12, '1mm BONDEK\nPERMANENT\nFORMWORK');
    v.leader(217, -1000, 22, -8, 'PROPOSED\nFULLCAP\nREPLACEMENT'); v.leader(330, -1450, 14, -10, 'PROPOSED\nR.C. OVERLAY', { dot: true });
    { const q = v.P(-600, -1700); B.title(q[0], q[1], 'PLAN', null); }
    mainT(B, 90, 214, 'ABUTMENT - WIDENING & ADDITIONAL STRINGER DETAIL', 20, 'STRINGER N° X');
    // ---- DETAIL 1 1:5 (origin: anchor bolt at the top of the stringer flange)
    const w = B.view(5, 345, 262);
    w.line(-260, 0, 260, 0); w.line(-260, -15, 260, -15); w.line(-260, -100, 260, -100); vbrk(w, -260, -110, 10, 'S-NEW'); vbrk(w, 260, -110, 10, 'S-NEW');
    w.line(-200, 1, 206, 1, 'S-NEW'); [-101, 98].forEach(x => w.pl([[x - 8, 1], [x - 15, 55], [x + 15, 55], [x + 8, 1]], false, 'S-NEW'));
    w.pl([[-202, 0], [-202, 178], [206, 178], [206, 0]], false, 'S-CONC'); w.brk(0, 178, 0, 178, 'S-CONC');
    w.hatch([[-170, 140], [-110, 140], [-110, 175], [-170, 175]], 'conc', 'S-HATCH', 0.8); w.hatch([[-190, 20], [-130, 20], [-130, 60], [-190, 60]], 'conc', 'S-HATCH', 0.8);
    w.line(-202, 82, 206, 82, 'S-REO'); [-160, -60, 40, 140].forEach(x => w.circ(x, 76, 4, 'S-REO'));
    w.bolt(0, -15, 0, 112, 16); w.fill([[-12, -15], [12, -15], [12, 0], [-12, 0]], 'S-BOLT');
    w.dim(-270, 0, -270, 110, 0, '110'); w.line(-270, 110, -10, 110, 'S-DIM');
    sdimV(w, 300, 55, 82, '30', 'COVER'); w.line(210, 55, 310, 55, 'S-DIM'); w.line(210, 82, 310, 82, 'S-DIM');
    w.leader(3, 125, -4, 28, 'ANCHOR BOLT - M16x150 LONG BOLT\nWITH 30 O.D. x 3 THICK WASHER\nANCHOR BOLTS ARE AT 400 CRS');
    w.leader(80, 82, 14, 44, 'DECK FABRIC'); w.leader(105, 55, 20, 30, '1mm BONDEK\nPERMANENT\nFORMWORK');
    w.leader(-15, -8, -10, -26, 'DRILL φ18 HOLE IN STRINGER\nFLANGE AND BONDEK SHEETING\n(TYP)'); w.leader(100, -15, 12, -26, 'PROPOSED\nSTRINGER\nFLANGE');
    B.title(345, 226, 'DETAIL 1', 5);
    // ---- SECTIONAL ELEVATION A 1:20 (origin: top of the stringer at ℄ abutment)
    const s = B.view(20, 150, 132);
    iElevWebH(s, -1374, 820, -d / 2, u); vbrk(s, 820, -d - 20, 20, 'S-NEW');
    s.pl([[550, 390], [-1482, 390], [-1482, -690], [-1185, -690]], false, 'S-CONC'); vbrk(s, 550, 200, 390, 'S-CONC'); s.line(550, 0, 550, 200, 'S-CONC');
    s.hatch([[-900, 250], [-760, 250], [-760, 350], [-900, 350]], 'conc', 'S-HATCH', 0.8); s.hatch([[-1460, -300], [-1390, -300], [-1390, -50], [-1460, -50]], 'conc', 'S-HATCH', 0.8);
    s.rect(-1185, -690, 45, 690, 'S-NEW'); s.hatch([[-1185, -690], [-1140, -690], [-1140, 0], [-1185, 0]], 'ansi37', 'S-HATCH', 0.5);
    s.line(-1140, -690, -1140, -1450, 'S-EXIST'); s.line(-1015, -10, -1015, -1450, 'S-EXIST'); s.hatch([[-1240, -800], [-1140, -800], [-1140, -1300], [-1240, -1300]], 'ansi31', 'S-HATCH', 0.8); vbrk(s, -1080, -1450, -1450);
    s.line(-997, -440, -997, -1500, 'S-EXIST'); s.line(-583, -440, -583, -1500, 'S-EXIST'); s.pileEnd(-790, -1500, 414);
    for (let x = -1000; x < 560; x += 200) s.pl([[x - 15, 40], [x + 15, 40], [x, 0]], true, 'S-NEW');
    [-266, 162].forEach(x => s.bolt(x, -tf, x, 150, 16));
    s.circ(-266, 72, 190, 'S-TEXT'); s.circ(126, -403, 200, 'S-TEXT');
    { const a = s.P(-266, 72), b = s.P(-540, 620); s.add({ t: 'line', a: [a[0] - 3, a[1] + 8.5], b: [b[0] + 1.5, b[1] - 2.6], L: 'S-TEXT' }); s.add({ t: 'circle', c: b, r: 3, L: 'S-TEXT' }); s.add({ t: 'text', p: b, s: '1', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' });
      const e = s.P(126, -403), f = s.P(600, -270); s.add({ t: 'line', a: [e[0] + 9.8, e[1] + 2], b: [f[0] - 3, f[1] - 0.5], L: 'S-TEXT' }); s.add({ t: 'circle', c: f, r: 3, L: 'S-TEXT' }); s.add({ t: 'text', p: f, s: '2', h: 3, al: 'c', v: 'm', ang: 0, L: 'S-TEXT' }); }
    s.rect(115, -d + tf, 10, d - 2 * tf, 'S-NEW'); s.rect(60, -d - 12, 160, 12, 'S-NEW'); [80, 170].forEach(x => s.bolt(x, -d - 12, x, -d + tf, 20));
    s.rect(119, -d - 12 - 340, c.b, 340, 'S-NEW'); cSec(s, 119, -d - 352 - c.d / 2, c, 1);
    s.cl(0, -900, 0, 640, 'ABUTMENT'); s.mark(-2090, 70, 'B', 0); s.mark(-223, -745, 'C', 0);
    s.leader(-1160, -600, -14, -10, '30 THICK EXPANDED FOAM\n(FOSROC EXPANDAFOAM\nSHEET/STRIP BY PARCHEM\nCONSTRUCTION PRODUCTS)\nOR SIMILAR APPROVED');
    s.leader(760, 0, 12, 22, 'PROPOSED\nADDITIONAL\nSTRINGER'); s.leader(119 + c.b, -620, 18, -4, 'PROPOSED\nSTUB COLUMN'); s.leader(119, -d - 352 - c.d, 14, -12, 'PROPOSED\nFULLCAP\nREPLACEMENT');
    { const q = s.P(-400, -1550); ttl(B, q[0], q[1] - 12, 'SECTIONAL ELEVATION', 'A', 20); }
    nbox(B, 196, 56, 'NOTE FOR STRINGER DETAILS\nREFER TO SUPERSTRUCTURE\nSECTION, DRG N° PN30-3119');
    // ---- VIEW B 1:20 (origin: top of the additional stringer at its ℄)
    const b = B.view(20, 300, 130);
    b.pl([[-820, 552], [-355, 552], [-338, 535], [-338, -483], [-820, -672]], false, 'S-CONC'); b.line(-820, 17, -338, 224, 'S-HIDDEN'); vbrk(b, -820, -672, 552, 'S-TEXT');
    b.rect(-338, -483, 24, 1018, 'S-NEW'); b.hatch([[-338, -483], [-314, -483], [-314, 535], [-338, 535]], 'ansi31', 'S-HATCH', 0.4);
    b.pl([[-314, 483], [-28, 483], [7, 397], [1186, 397]], false, 'S-CONC'); b.pl([[-314, 483], [-314, -707], [1186, -707]], false, 'S-CONC'); b.line(1017, 397, 1017, -707, 'S-CONC'); vbrk(b, 1186, -707, 397, 'S-TEXT');
    b.pl([[0, 10], [730, 10], [730, 69]], false, 'S-HIDDEN'); b.rect(730, 0, 287, 138, 'S-EXIST'); b.line(1017, 0, 1186, 0, 'S-EXIST'); b.line(1017, 138, 1186, 138, 'S-EXIST');
    iSec(b, 0, -d / 2, u, 0, 'S-HIDDEN'); b.ground(200, 700, -707);
    b.leader(-560, 552, -8, 10, 'PROPOSED\nWINGWALL\nEXTENSION'); b.leader(400, 10, -6, 34, 'PROPOSED\nBONDEK\nSHEETING'); b.leader(880, 120, 4, 26, 'EXISTING\nTIMBER\nDECKING');
    b.leader(-30, -d + 10, -12, -16, 'PROPOSED\nADDITIONAL\nSTRINGER');
    B.title(300, 82, 'VIEW B', 20);
    // ---- DETAIL 2 1:10 and VIEW C 1:20 in the dashed region
    B.E.push({ t: 'pl', p: [[388, 218], [472, 218], [472, 46], [388, 46]], closed: true, L: 'S-NOTE' });
    const e = B.view(10, 432, 192);
    e.line(-290, 0, 290, 0); e.line(-290, tf, 290, tf); vbrk(e, -290, -10, 120, 'S-NEW'); vbrk(e, 290, -10, 120, 'S-NEW'); e.line(-290, 110, 290, 110, 'S-TEXT'); vbrk(e, 5, 110, 110, 'S-TEXT');
    e.line(-100, tf, -100, 110); e.line(100, tf, 100, 110); e.line(-4, tf, -4, 110); e.line(4, tf, 4, 110);
    e.rect(-100, -12, 200, 12, 'S-NEW'); [-45, 45].forEach(x => e.bolt(x, -12, x, tf, 20));
    e.line(-95, -12, -95, -160); e.line(35, -12, 35, -160); e.line(0, -12, 0, -160, 'S-HIDDEN'); vbrk(e, -30, -160, -160, 'S-TEXT');
    e.dim(-100, 110, 100, 110, 12, '200'); sdim(e, -45, 45, 150, '90', 1); e.line(-45, 30, -45, 160, 'S-DIM'); e.line(45, 30, 45, 160, 'S-DIM'); sdim(e, -95, 0, -100, '95', -1);
    e.leader(45, 25, 10, 14, 'M20 BOLTS\n(TYP)'); e.leader(-100, -6, -10, -8, '200x12FLx320 LONG\nCAP PLATE'); e.weld(35, -14, 8, -8, { size: '6', all: true });
    B.title(432, 166, 'DETAIL 2', 10);
    const g = B.view(20, 420, 94);
    pfcElevH(g, -100, 1050, 0, c); vbrk(g, 1050, -c.d - 10, 10, 'S-NEW');
    g.line(0, 0, 0, -c.d, 'S-HIDDEN'); g.line(c.d, 0, c.d, -c.d, 'S-HIDDEN');
    g.rect(0, 0, c.d, 360); g.line(c.tf, 0, c.tf, 360, 'S-HIDDEN'); g.line(c.d - c.tf, 0, c.d - c.tf, 360, 'S-HIDDEN');
    g.rect(-10, 360, c.d + 20, 12); iSec(g, 150, 372 + d / 2, u, 0); [105, 195].forEach(x => g.bolt(x, 360, x, 372 + tf, 20)); g.bolt(195, 372 + d - tf, 195, 372 + d + 100, 16);
    sdim(g, 150 + u.b / 2, 150 + u.b / 2 + 90, 372 + d * 0.7, '90', 1);
    g.dim(-100, -c.d - 60, 0, -c.d - 60, 0, '100');
    g.weld(c.d, 0, 10, 10, { size: '6', both: true, tail: 'TYP' });
    g.leader(150 - u.b / 2, 372 + d - 5, -10, 8, 'PROPOSED\nSTRINGER'); g.leader(0, 250, -14, 12, pf + ' STUB\nCOLUMN (LENGTH\nTO SUIT)'); g.leader(10, -150, -14, 2, 'STIFFENER\nPLATE (BEHIND)\n(TYP)');
    g.leader(560, -c.d, -2, -8, 'PROPOSED ' + pf + '\nFULLCAP\nSTRENGTHENING');
    B.title(430, 52, 'VIEW C', 20);
    nbox(B, 300, 46, 'NOTE THESE DETAILS ARE NOT NEEDED\nIF ALREADY DRAWN FOR PIER HALFCAPS\nSTRENGTHENING AND WIDENING DETAILS\n- ALTER SECTION & DETAIL REFERENCING\nTO SUIT'); B.E.push({ t: 'line', a: [378, 38], b: [388, 50], L: 'S-NOTE' });
    return B.E;
  }, 'Widening an abutment with an additional UB stringer on a PFC stub column and fullcap, Bondek permanent formwork and a reinforced concrete overlay.');

  // STEEL STRINGER PACKING DETAIL (PN30-3120)
  def('pn3120', 'Stringers', 'Steel stringer packing detail', 'PN30-3120', [P('ub', 'Proposed UB stringer', '410UB54', { opts: UBs })], (p) => {
    const u = SEC[p.ub] || SEC['410UB54'], B = new Builder(), v = B.view(10, 60, 100), d = u.d, b = u.b, tp = 125, g = 20, yT = d + g;
    v.line(-b / 2, d, b / 2, d); v.line(-b / 2, d - u.tf, b / 2, d - u.tf); v.line(-b / 2, d, -b / 2, d - u.tf); v.line(b / 2, d, b / 2, d - u.tf);
    v.line(-u.tw / 2, d - u.tf, -u.tw / 2, u.tf); v.line(u.tw / 2, d - u.tf, u.tw / 2, u.tf);
    v.line(-b / 2, 0, b / 2, 0); v.line(-b / 2, u.tf, b / 2, u.tf); v.line(-b / 2, 0, -b / 2, u.tf); v.line(b / 2, 0, b / 2, u.tf);
    [[d - u.tf, d], [0, u.tf]].forEach(([y0, y1]) => v.hatch([[-b / 2, y0], [b / 2, y0], [b / 2, y1], [-b / 2, y1]], 'ansi31', 'S-HATCH', 0.25));
    [0, 1, 2].forEach(i => v.rect(-b / 2, d + i * g / 3, b, g / 3, 'S-NEW'));
    v.line(-250, yT, 250, yT, 'S-EXIST'); v.line(-250, yT + tp, 250, yT + tp, 'S-EXIST'); vbrk(v, -250, yT - 15, yT + tp + 15); vbrk(v, 250, yT - 15, yT + tp + 15);
    v.leader(0, yT + tp / 2, -14, 22, 'EXISTING TIMBER\nDECKING', { dot: true });
    v.leader(u.tw / 2, d * 0.45, -14, 6, 'PROPOSED UB\nSTEEL STRINGER');
    const L = ['THE FOLLOWING IS APPLICABLE :-', 'WHERE GAP BETWEEN DECK PLANKS AND', 'STRINGER IS LESS THAN 20mm PACK GAPS', 'WITH STEEL SHIMS (TACK WELD TO UB', 'STRINGER)', 'WHERE GAP BETWEEN DECK PLANKS AND', 'STRINGER IS MORE THAN 20mm PACK GAPS', 'WITH "EMACO S88C" GROUT IN ACCORDANCE', "WITH MANUFACTURER'S INSTRUCTIONS", '(MASTER BUILDERS TECHNOLOGIES) OR', 'SIMILAR APPROVED. PROVIDE FORM TO ONE', 'FACE OF UB TO PREVENT GROUT LEAKAGE.', 'TROWEL FINISH OPPOSITE FACE.'];
    v.leader(b / 2 + 5, d + g, 20, -6, L.join('\n'));
    { const q = v.P(b / 2 + 5, d + g), x0 = q[0] + 20 + 3.5, y0 = q[1] - 6 - TH / 2, cw = TH * 0.68; [[2, 12, 4], [6, 12, 4]].forEach(([ln, c0, n]) => B.E.push({ t: 'line', a: [x0 + c0 * cw, y0 - ln * TH * 1.55 - 0.6], b: [x0 + (c0 + n) * cw, y0 - ln * TH * 1.55 - 0.6], L: 'S-TEXT' })); }
    B.title(70, 78, 'STEEL STRINGER PACKING DETAIL', 10, '(ALL DECK PLANKS REQUIRE BEARING ON\nSTRINGER AS SHOWN)');
    return B.E;
  }, 'Packing the gap between deck planks and a new UB stringer: steel shims below 20 mm, EMACO S88C grout above 20 mm, so every plank bears on the stringer.');

  // STEEL STRINGER SPLICE JOINT DETAIL (PN30-3123)
  def('pn3123', 'Stringers', 'Steel stringer splice joint', 'PN30-3123', [P('ub', 'Stringer', '410UB54', { opts: UBs }), P('Ls', 'Splice from ℄ abutment / pier (1200 MAX) (mm)', 1200, { num: 1 })], (p) => {
    const u = SEC[p.ub] || SEC['410UB54'], B = new Builder(), d = u.d, tf = u.tf, Ls = min(1200, max(800, +p.Ls || 1200)), xs = Ls, Hp = max(520, Math.round(d + 110));
    const rows = [55, 55 + 270, Hp - 35].map(y => -y);
    // ---- ELEVATION 1:10 (origin: ℄ abutment / pier at the top of the stringer)
    const v = B.view(10, 40, 210);
    v.line(0, 380, 0, -600, 'S-CL'); v.text(0, 520, '℄ ABUTMENT OR', TH * 1.1, 'l'); v.text(25, 480, 'PIER', TH * 1.1, 'l');
    v.pl([[xs - 25, 0], [12, 0], [12, -341], [xs - 70, -341], [xs - 70, -325], [12, -325]], false); v.line(12, -tf, xs - 25, -tf); v.line(12, -325, 12, 0);
    v.pl([[xs - 375, -341], [xs - 375, -d], [xs - 25, -d]], false); v.line(xs - 375, -d + tf, xs - 25, -d + tf);
    v.line(xs + 25, 0, xs + 300, 0); v.line(xs + 25, -tf, xs + 300, -tf); v.line(xs + 25, -d, xs + 300, -d); v.line(xs + 25, -d + tf, xs + 300, -d + tf); v.line(xs + 300, 60, xs + 300, -d - 60); vbrk(v, xs + 300, -d / 2 - 20, -d / 2 + 20, 'S-NEW');
    v.rect(xs - 25, -Hp, 25, Hp); v.rect(xs, -Hp, 25, Hp);
    rows.forEach(y => { v.fill([[xs - 25, y - 12], [xs + 25, y - 12], [xs + 25, y + 12], [xs - 25, y + 12]], 'S-BOLT'); v.line(xs - 45, y, xs + 45, y, 'S-CL'); });
    [[380, 0], [380, -325]].forEach(([x, y]) => { v.fill([[x - 15, y - 8], [x + 15, y - 8], [x + 15, y + 8], [x - 15, y + 8]], 'S-BOLT'); v.line(x, y + 60, x, y - 60, 'S-CL'); });
    v.rect(xs - 135, -8, 12, 8, 'S-NEW'); v.line(xs - 129, 50, xs - 129, -60, 'S-CL');
    v.dim(0, 300, xs, 300, 0, '1200 MAX'); v.line(xs, 300, xs, 10, 'S-DIM');
    v.mark(xs + 25, 560, 'A', 180); v.line(xs + 25, 530, xs + 25, 400, 'S-TITLE'); v.line(xs + 25, -Hp - 30, xs + 25, -Hp - 200, 'S-TITLE'); { const q = v.P(xs + 25, -Hp - 200); B.E.push({ t: 'solid', p: [[q[0], q[1]], [q[0], q[1] + 6], [q[0] - 2.4, q[1] + 2]], L: 'S-TITLE' }); }
    v.weld(xs + 25, 0, 10, 10, { size: '6', both: true, tail: 'SP (TYP)' });
    v.weld(xs - 25, -330 + 100, -12, -40, { size: '6', both: true, tail: 'TYP' }); { const a = v.P(xs - 25, -330 + 100), r = [a[0] - 12, a[1] - 40]; [[xs - 25, -d]].forEach(([x, y]) => { const t = v.P(x, y); B.E.push({ t: 'line', a: r, b: t, L: 'S-TEXT' }); }); }
    v.leaders([[380, -20], [560, -341]], -12, -34, 'FOR DETAILS OF STRINGER END\nAND CONNECTION TO EXISTING\nDECKING REFER TO DRG\nN° XX30-XXXX');
    v.leader(xs - 15, -Hp, -12, -16, 'SPLICE PLATES WITH\n6 - M24 8.8TF BOLTS'); v.leader(xs + 110, -d, 8, -10, 'PROPOSED\nSTEEL\nSTRINGER');
    { const q = v.P(500, -Hp - 300); B.title(q[0], q[1], 'ELEVATION', null); }
    // ---- SPLICE PLATE DETAIL 1:10 (origin: ℄ stringer at the top of the plate)
    const w = B.view(10, 250, 210);
    w.rect(-100, -Hp, 200, Hp); iSec(w, 0, -d / 2, u, 0);
    rows.forEach(y => [-55, 55].forEach(x => { w.circ(x, y, 13, 'S-NEW'); w.line(x - 22, y, x + 22, y, 'S-CL'); w.line(x, y - 22, x, y + 22, 'S-CL'); }));
    w.cl(0, -Hp - 50, 0, 380, 'STRINGER');
    w.dim(-100, 0, 100, 0, 18, '200'); w.dim(-55, 80, 55, 80, 0, '110'); w.line(-55, 20, -55, 90, 'S-DIM'); w.line(55, 20, 55, 90, 'S-DIM');
    w.dim(-100, -Hp, -100, 0, 26, String(Hp)); w.dim(-150, rows[1], -150, rows[0], 0, '270'); w.dim(-150, rows[2], -150, rows[1], 0, String(rows[1] - rows[2])); rows.forEach(y => w.line(-160, y, -70, y, 'S-DIM'));
    sdimV(w, -150, rows[0], 0, '55'); w.line(-160, 0, -105, 0, 'S-DIM');
    w.leader(55, rows[1], 18, -6, 'φ26 HOLE\nTYP'); w.leader(u.b / 2, -d + 5, 16, -14, secName(p.ub) + '\nSTRINGER'); w.leader(-90, -Hp, -8, -12, '200 x 25 PL\nSPLICE PLATE');
    B.title(255, 125, 'SPLICE PLATE DETAIL', 10);
    nbox(B, 222, 112, 'NOTE:\n1.  STRINGER SPLICE TO BE SHOP FABRICATED\n     AND PRE-ASSEMBLED.\n2.  CONTACT FACES OF SPLICE PLATES TO BE\n     SANDBLASTED BACK TO BRIGHT STEEL\n     PRIOR TO INSTALLATION.\n3.  SPLICE JOINT TO BE COLD GALVANISED\n     AFTER STRINGER INSTALLATION.', { solid: true });
    nbox(B, 48, 76, 'NOTE:  STRINGER SIZE, SPLICE PLATE\nCONNECTION & SPLICE PLATE LOCATION\nWILL VARY ACCORDING TO ENGINEERING\nREQUIREMENTS.\n' + secName(p.ub) + ' STRINGER DRAWN', { h: 1.8 });
    mainT(B, 100, 96, 'STEEL STRINGER SPLICE JOINT DETAIL', null, 'SPAN N° X - STRINGER N° X - ABUT N° END OR PIER N° END');
    return B.E;
  }, 'Shop-fabricated end-plate splice of a steel stringer within 1200 of the abutment or pier centre line (200x25 plates, 6-M24 8.8/TF bolts).');

  // 45 PIER TIMBER STRINGER BOLTING (horizontal split repair before a concrete overlay) (PN30-3121)
  def('stb', 'Stringers', 'Pier – timber stringer bolting (horizontal split)', 'PN30-3121', [P('L', 'Length of horizontal split (mm)', 1600, { num: 1 }), P('D', 'Stringer dia. (mm)', 500, { num: 1 })], (p) => {
    const B = new Builder(), D = max(300, min(700, +p.D || 500)), L = max(400, min(3000, +p.L || 1600)), v = B.view(20, 210, 120);
    const xT = -1209, xr = [], nR = max(1, Math.ceil((L - 100) / 500)); for (let i = 0; i < nR; i++) xr.unshift(xT - 100 - 500 * i);
    const x0 = min(-3086, xr[0] - 800), yd = D, tp = 127, tc = 150, ys = D * 0.35, xpf = xr[0] - 150;
    // existing stringers (dash-dot) seated on the corbel, deck, proposed concrete deck
    v.pl([[x0, 0], [xT, 0], [-801, 130], [801, 130], [1225, 0], [1338, 0]], false, 'S-EXIST'); v.line(x0, D, 1338, D, 'S-EXIST'); v.pileEnd(x0, D / 2, D, 'S-EXIST', 1); v.pileEnd(1338, D / 2, D, 'S-EXIST', 1);
    for (let x = x0 - 100; x < 1450; x += 450) v.line(x, D / 2, min(x + 300, 1450), D / 2, 'S-HIDDEN');
    v.line(-12, D, -12, 130, 'S-EXIST'); v.line(12, D, 12, 130, 'S-EXIST');
    deckX(v, x0 + 120, 1258, D, tp, 235, false); v.line(x0 + 120, D + tp + tc, 1258, D + tp + tc, 'S-CONC'); vbrk(v, x0 + 120, D - 10, D + tp + tc + 10); vbrk(v, 1258, D - 10, D + tp + tc + 10);
    [-200, 650].forEach(x => v.hatch([[x, D + tp + 30], [x + 220, D + tp + 30], [x + 220, D + tp + 120], [x, D + tp + 120]], 'conc', 'S-HATCH', 0.8));
    // corbel, halfcaps, pile
    v.pl([[-737, 130], [-737, -63], [-590, -217], [600, -217], [737, -63], [737, 130]], false, 'S-EXIST');
    v.rect(-215, -517, 147, 300, 'S-EXIST'); v.rect(79, -517, 147, 300, 'S-EXIST'); v.line(-195, -517, -195, -820, 'S-EXIST'); v.line(205, -517, 205, -820, 'S-EXIST'); v.pileEnd(5, -820, 400);
    v.cl(0, -900, 0, D + tp + tc + 420, 'PIER');
    // horizontal split
    const sp = []; for (let x = xT - L; x <= -801; x += 60) sp.push([x, ys + 18 * Math.sin(x / 140) + (x > -1300 ? (x + 1300) * 0.05 : 0)]); sp.push([-801, 130]); v.pl(sp, false, 'S-TEXT');
    // proposed: PFC on the deck, φ24 rods with curved washers, φ20 cross rods with washers
    v.rect(xpf, D + tp, 2000, 75, 'S-NEW'); v.line(xpf, D + tp + 8, xpf + 2000, D + tp + 8, 'S-HIDDEN');
    xr.forEach(x => { v.line(x - 12, -40, x - 12, D + tp + 110, 'S-BOLT'); v.line(x + 12, -40, x + 12, D + tp + 110, 'S-BOLT'); v.rect(x - 50, -25, 100, 25, 'S-BOLT'); v.rect(x - 22, -55, 44, 30, 'S-BOLT'); v.rect(x - 22, D + tp + 75, 44, 30, 'S-BOLT'); });
    const xf = xr[0] - 460; v.line(xf - 10, -40, xf - 10, D + tp + 40, 'S-BOLT'); v.line(xf + 10, -40, xf + 10, D + tp + 40, 'S-BOLT'); v.rect(xf - 50, -25, 100, 25, 'S-BOLT'); v.rect(xf - 35, D + tp, 70, 10, 'S-BOLT'); v.rect(xf - 18, D + tp + 10, 36, 25, 'S-BOLT');
    const xw = xr.slice(1).map((x, i) => (x + xr[i]) / 2); xw.forEach(x => { v.rect(x - 50, 134, 100, 250, 'S-NEW'); v.circ(x, 258, 14, 'S-BOLT'); v.line(x - 400, 258, x + 400, 258, 'S-BOLT'); });
    // dimensions
    v.dim(xpf, D + tp + 75, xr[0], D + tp + 75, 10, '150');
    xr.slice(1).forEach((x, i) => v.dim(xr[i], -50, x, -50, -16, '500'));
    if (xw.length) { v.dim(xr[0], -50, xw[0], -50, -9, '='); v.dim(xw[0], -50, xr[1], -50, -9, '='); v.line(xw[0], 134, xw[0], -230, 'S-DIM'); }
    sdim(v, xr[nR - 1], xT, -320, '100', 1, {}); v.dim(xT, -50, -737, -50, -9, ' '); { const q = v.P((xT - 737) / 2, -50); star(B, q[0], q[1] - 6.5); }
    v.line(xT, 0, xT, -360, 'S-DIM'); v.line(-737, -63, -737, -360, 'S-DIM'); v.line(-590, -217, -590, -360, 'S-DIM');
    sdim(v, -737, -590, -320, '150', 1); { const q = v.P(-590, -320); v.add({ t: 'text', p: [q[0] + 3, q[1] - 0.8], s: 'MIN', h: 1.9, al: 'l', v: 't', ang: 0, L: 'S-DIM' }); }
    // leaders and notes
    v.leader(xr[nR - 1], D + tp + 100, 16, 16, 'φ24 THREADED\nRODS (TYP UNO)'); v.leader(xr[0] + 900, D + tp + 75, -6, 34, '150 PFC x 2000\nLONG NOM. *');
    v.leader(-1150, ys + 6, 4, 70, 'HORIZONTAL SPLIT\nIN STRINGER'); v.leader(-500, D + tp + tc, 22, 40, 'PROPOSED\nCONCRETE DECK'); v.leader(150, D + tp, 22, 30, 'EXISTING TIMBER\nDECKING');
    v.leader(x0 + 200, D / 2 - 120, -12, -8, 'EXISTING TIMBER\nSTRINGER', { dot: true });
    v.leader(xr[0] - 10, -40, -16, -18, 'CURVED WASHER WITH A SHOP\nDRILLED φ28 HOLE INSTEAD OF\nTHE STANDARD φ24 HOLE FOR\nALL φ24 THREADED RODS.\nFOR CURVED WASHER REFER TO\nDRG 9530-0072');
    v.leader(650, -150, 16, -16, 'EXISTING TIMBER\nCORBEL'); v.leader(226, -500, 10, -14, 'EXISTING TIMBER\nHALFCAP');
    { const a = v.P(xf, D + tp + 40); nbox(B, a[0] - 28, a[1] + 32, 'φ20 THREADED ROD\nREFER TO "STRINGER\n& CORBEL BOLTING\nDETAILS"'); B.E.push({ t: 'line', a: [a[0] - 28 + 32, a[1] + 32 - 3], b: a, L: 'S-TEXT' }); arrowTo(B, [a[0] - 28 + 32, a[1] + 32 - 3], a);
      nbox(B, a[0] - 34, a[1] + 56, 'PROVIDE IF HORIZONTAL SPLIT\nEXTENDS 500 BEYOND φ24 BOLT'); B.E.push({ t: 'line', a: [a[0] - 6, a[1] + 32], b: [a[0] - 2, a[1] + 46.6], L: 'S-NOTE' }); }
    if (xw.length) { const a = v.P(xw[xw.length - 1], 134); nbox(B, a[0] + 2, a[1] - 28, 'φ20 THREADED ROD\nAND WASHER REFER\nTO "STRINGER AND\nCORBEL BOLTING\nDETAILS"'); B.E.push({ t: 'line', a: [a[0] + 2, a[1] - 30], b: a, L: 'S-TEXT' }); arrowTo(B, [a[0] + 2, a[1] - 30], a);
      nbox(B, a[0] + 62, a[1] - 54, '(PROVIDE IF VERTICAL SPLITS\nTO STRINGER END EXCEEDS 1500\nLENGTH)'); B.E.push({ t: 'line', a: [a[0] + 33, a[1] - 40], b: [a[0] + 62, a[1] - 58], L: 'S-NOTE' }); }
    nbox(B, 150, 228, 'NOTE: THIS DETAIL IS ONLY APPLICABLE\nFOR BRIDGE MAINTENANCE WHERE A\nPROPOSED CONCRETE OVERLAY IS INTENDED.\nTHIS DETAIL IS TO BE REFERRED TO IN THE\n"BOLTING REQUIREMENT TABLE".');
    nbox(B, 20, 60, 'NOTE:\nDIMENSIONS DENOTED THUS *\nSHALL BE SITE MEASURED\nPRIOR TO FABRICATION &\nCONSTRUCTION.', { solid: true });
    { const q = v.P(-1800, -1000); B.title(q[0], q[1] - 4, 'ELEVATION', null); }
    B.mainTitle(190, 50, 'PIER - TIMBER STRINGER BOLTING DETAILS', 20, 'SPAN N° X - STRINGER N° X - PIER N° X');
    return B.E;
  }, 'Closing a horizontal split in a pier timber stringer with φ24 rods through a 150 PFC on the deck before a concrete overlay is placed (referenced from the bolting requirement table).');

  // STRINGER & CORBEL BOLTING DETAILS + BOLTING REQUIREMENT TABLE (PN30-3122)
  def('pn3122', 'Stringers', 'Stringer & corbel bolting details – bolting requirement table', 'PN30-3122', [P('nP', 'Pier / corbel rows in table', 2, { num: 1 }), P('nS', 'Span / stringer rows in table', 3, { num: 1 })], (p) => {
    const B = new Builder(), R = 200, tp = 125, tc = 150, nP = max(1, min(12, Math.round(+p.nP || 2))), nS = max(1, min(12, Math.round(+p.nS || 3)));
    const log = (v) => v.circ(0, 0, R, 'S-EXIST');
    const deck = (v, y0, t, w, L) => { v.line(-w, y0, w, y0, L || 'S-EXIST'); v.line(-w, y0 + t, w, y0 + t, L || 'S-EXIST'); vbrk(v, -w, y0 - 15, y0 + t + 15); vbrk(v, w, y0 - 15, y0 + t + 15); };
    const split = (v, pts) => v.pl(pts, false, 'S-TEXT');
    const rodL = (v, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l * 10, ny = dx / l * 10; v.line(x1 + nx, y1 + ny, x2 + nx, y2 + ny, 'S-BOLT'); v.line(x1 - nx, y1 - ny, x2 - nx, y2 - ny, 'S-BOLT'); };
    const cw = (v, ang) => { const a = ang * PI / 180; [R + 8, R + 22].forEach(r => v.arc(0, 0, r, ang - 22, ang + 22, 'S-BOLT')); v.fill([[Math.cos(a) * (R + 22), Math.sin(a) * (R + 22)], [Math.cos(a) * (R + 50), Math.sin(a) * (R + 50)], [Math.cos(a + 0.1) * (R + 36), Math.sin(a + 0.1) * (R + 36)], [Math.cos(a - 0.1) * (R + 36), Math.sin(a - 0.1) * (R + 36)]], 'S-BOLT'); };
    const plate = (v, x, y, w, t) => v.fill([[x - w / 2, y], [x + w / 2, y], [x + w / 2, y + t], [x - w / 2, y + t]], 'S-BOLT');
    const tack = (x, y, a) => { nbox(B, x, y, 'NOTE:\nTACK WELD OR CENTRE PUNCH\nBOLT THREAD TO NUT TO\nPREVENT UNDOING OF NUT (TYP)', { solid: true }); B.E.push({ t: 'line', a: [x + 26, y - 16], b: a, L: 'S-TEXT' }); arrowTo(B, [x + 26, y - 16], a); };
    const sub = (x, y, t) => { B.E.push({ t: 'text', p: [x, y], s: t, h: TH, al: 'c', v: 'b', ang: 0, L: 'S-TEXT' }); B.E.push({ t: 'line', a: [x - t.length * TH * 0.35, y - 0.9], b: [x + t.length * TH * 0.35, y - 0.9], L: 'S-TEXT' }); };
    // 1 VERTICAL BOLT
    let v = B.view(20, 100, 470); log(v); deck(v, R, tp, 400); rodL(v, 0, -R - 22, 0, R + tp + 10); plate(v, 0, R + tp, 150, 12); cw(v, -90);
    split(v, [[-R, -20], [-120, -5], [-40, -15], [40, -2], [120, -8], [R, 0]]);
    tack(56, 520, v.P(0, R + tp + 12)); v.leader(-50, R + tp + 10, -14, 10, '150x10FLx150\nWASHER'); v.leader(150, R + tp + 5, 10, 20, 'EXISTING TIMBER\nDECK');
    v.leader(-170, -20, -12, 8, 'SPLIT IN\nTIMBER'); v.leader(10, -100, 20, 0, 'THREADED ROD'); v.leader(-60, -R - 15, -6, -10, 'CURVED WASHER'); sub(110, 440, 'VERTICAL BOLT');
    // 2 DIAGONAL BOLTS (proposed concrete deck)
    v = B.view(20, 220, 470); log(v); v.line(-400, R, 400, R, 'S-EXIST'); v.pl([[-400, R + tp], [0, R + tp], [0, R + tp + 40]], false, 'S-EXIST'); v.line(0, R + tp + 40, 400, R + tp + 40, 'S-EXIST'); vbrk(v, 400, R - 15, R + tp + 55);
    v.pl([[-400, R], [-400, R + tp + tc], [400, R + tp + tc], [400, R + tp + 40]], false, 'S-CONC'); v.hatch([[-330, R + 70], [-200, R + 70], [-200, R + 200], [-330, R + 200]], 'conc', 'S-HATCH', 0.8);
    { const a = 62 * PI / 180, x1 = -Math.cos(a) * (R + 22), y1 = -Math.sin(a) * (R + 22); rodL(v, x1, y1, 80, R + tp + 40); plate(v, 80, R + tp + 40, 150, 12); v.add({ t: 'line', a: v.P(x1, y1), b: v.P(x1 - 30, y1 - 50), L: 'S-BOLT' }); cw(v, 242); }
    split(v, [[-R, -20], [-100, -10], [-20, -18], [60, -5], [R, -8]]);
    tack(178, 532, v.P(80, R + tp + 52)); v.leader(30, R + tp + 52, -24, 12, '150x10FLx150\nWASHER'); v.leader(120, R + tp + tc, 8, 28, 'PROPOSED\nCONCRETE DECK'); v.leader(400, R + 40, 10, -10, 'EXISTING TIMBER\nDECK');
    v.leader(-150, -30, -14, 8, 'SPLIT IN\nTIMBER'); v.leader(-100, -R - 30, -10, -6, 'CURVED\nWASHER'); v.leader(-20, -110, 22, -14, 'THREADED ROD\n(TYP)'); sub(228, 440, 'DIAGONAL BOLTS');
    nbox(B, 168, 446, 'DRAWN WITH BITUMINOUS\nSEAL.\nIF NO BITUMINOUS SEAL\nRECESS INTO CONCRETE\n20mm AND REFILL WITH\nEPOXY SEAL.', { solid: true });
    // 3 VERTICAL BOLT – existing concrete overlay
    v = B.view(20, 105, 375); log(v); deck(v, R, tp, 400); deck(v, R + tp, tc, 400); v.line(-400, R + tp + tc + 30, 400, R + tp + tc + 30, 'S-EXIST'); v.hatch([[-380, R + tp + tc], [-30, R + tp + tc], [-30, R + tp + tc + 30], [-380, R + tp + tc + 30]], 'ansi31', 'S-HATCH', 0.4); v.hatch([[30, R + tp + tc], [380, R + tp + tc], [380, R + tp + tc + 30], [30, R + tp + tc + 30]], 'ansi31', 'S-HATCH', 0.4); v.hatch([[-200, R + tp + 30], [-60, R + tp + 30], [-60, R + tp + 120], [-200, R + tp + 120]], 'conc', 'S-HATCH', 0.8);
    rodL(v, 0, -R - 22, 0, R + tp + tc + 30); plate(v, 0, R + tp + tc + 5, 65, 10); cw(v, -90); split(v, [[-R, -10], [-120, 0], [-40, -12], [40, 0], [140, -5], [R, -15]]);
    tack(36, 442, v.P(0, R + tp + tc + 18)); v.leader(30, R + tp + tc + 20, 14, 26, '65x10FLx65 WASHER\nON EPOXY SEALANT.'); v.leader(-200, R + tp + tc + 20, -18, 8, 'EXISTING BITUMINOUS\nSEAL');
    v.leader(-250, R + tp + 70, -10, 0, 'EXISTING CONCRETE\nDECK', { dot: true }); v.leader(-300, R, -12, -10, 'EXISTING TIMBER\nDECK'); v.leader(-10, -130, -14, -12, 'THREADED ROD'); v.leader(100, -5, 12, -14, 'SPLIT IN TIMBER'); v.leader(30, -R - 30, 8, -6, 'CURVED WASHER');
    sub(112, 341, 'VERTICAL BOLT'); B.E.push({ t: 'text', p: [88, 335], s: 'WHERE BRIDGE HAS AN', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' }, { t: 'text', p: [88, 331], s: 'EXISTING CONCRETE OVERLAY', h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TITLE' });
    // 4 CROSS BOLTS
    v = B.view(20, 222, 380); log(v); deck(v, R, tp, 400); deck(v, R + tp, tc, 400); v.hatch([[-200, R + tp + 30], [-60, R + tp + 30], [-60, R + tp + 120], [-200, R + tp + 120]], 'conc', 'S-HATCH', 0.8);
    [40, 140].forEach(a => { const r = a * PI / 180, x = Math.cos(r) * (R + 22), y = Math.sin(r) * (R + 22); rodL(v, x, y, -x, -y); }); [40, 140, 220, 320].forEach(a => cw(v, a));
    split(v, [[-R, 10], [-100, 20], [0, 5], [100, 15], [R, 0]]);
    v.leader(150, R + tp + tc, 10, 14, 'EXISTING CONCRETE\nDECK'); v.leader(400, R, 10, -8, 'EXISTING TIMBER\nDECK'); v.leader(-170, 30, -14, 6, 'SPLIT IN\nTIMBER'); v.leader(R + 10, -100, 10, -6, 'CURVED WASHER\n(TYP)');
    v.leader(-100, -170, -10, -12, 'THREADED ROD\n(TYP)'); v.leader(40, -R - 30, 6, -10, 'JACK SPLIT CLOSED\nPRIOR TO DRILLING\nBOLT HOLE.', { noArrow: true }); sub(228, 337, 'CROSS BOLTS');
    // 5 HORIZONTAL BOLT
    v = B.view(20, 105, 290); log(v); rodL(v, -R - 22, 0, R + 22, 0); cw(v, 0); cw(v, 180); split(v, [[0, R], [15, 100], [-10, 0], [10, -100], [0, -R]]);
    v.leader(5, 150, -14, 10, 'SPLIT IN\nTIMBER'); v.leader(100, 0, 16, 18, 'THREADED ROD\n(ROD SHOULD BE AT\n90° TO SPLIT ±15°)'); v.leader(R + 25, -30, 10, -6, 'CURVED WASHER'); sub(112, 266, 'HORIZONTAL BOLT');
    // 6 DIAGONAL BOLT
    v = B.view(20, 225, 290); log(v); deck(v, R + 20, tp, 400);
    { const a = 140 * PI / 180, x = Math.cos(a) * (R + 22), y = Math.sin(a) * (R + 22); rodL(v, x, y, -x, -y); cw(v, 320); cw(v, 140); }
    split(v, [[-120, -R + 40], [-60, -100], [0, 0], [50, 90], [120, R - 40]]);
    v.leader(-100, R + tp + 20, 6, 14, 'EXISTING\nDECK'); v.leader(-60, 60, -14, 10, 'THREADED ROD\n(ROD SHOULD BE AT\n90° TO SPLIT ±15°)'); v.leader(80, 100, 16, -10, 'SPLIT IN\nTIMBER'); v.leader(-150, -R - 40, -12, -6, 'CURVED WASHER');
    sub(228, 262, 'DIAGONAL BOLT');
    B.title(150, 248, 'STRINGER & CORBEL BOLTING DETAILS', 20);
    // ---- BOLTING REQUIREMENT TABLE
    const tx = 75, cwid = [12, 18, 12, 12, 12], X = [tx]; cwid.forEach(w => X.push(X[X.length - 1] + w));
    const T = (x, y, s, h, L) => B.E.push({ t: 'text', p: [x, y], s, h: h || TH, al: 'c', v: 'm', ang: 0, L: L || 'S-TEXT' }), Ln = (x1, y1, x2, y2, L) => B.E.push({ t: 'line', a: [x1, y1], b: [x2, y2], L: L || 'S-TEXT' });
    let y = 228; const rh = 5, hh = 11;
    const block = (a, b, subs, n, merge) => {
      const y0 = y, y1 = y - hh, y2 = y1 - n * rh;
      Ln(X[0], y0, X[5], y0, 'S-TITLE'); Ln(X[0], y1, merge ? X[4] : X[5], y1); Ln(X[2], y0 - 4, X[5], y0 - 4);
      for (let i = 1; i < n; i++) Ln(X[0], y1 - i * rh, merge ? X[4] : X[5], y1 - i * rh);
      [0, 1, 2].forEach(i => Ln(X[i], y0, X[i], y2)); Ln(X[3], y0 - 4, X[3], y2); Ln(X[4], y0 - 4, X[4], merge ? y0 - 4 - 7 : y2); if (merge) Ln(X[4], y0 - 4, X[4], y2); Ln(X[5], y0, X[5], y2, 'S-TITLE'); Ln(X[0], y0, X[0], y2, 'S-TITLE');
      T((X[0] + X[1]) / 2, y0 - 3.5, a[0]); T((X[0] + X[1]) / 2, y0 - 7.5, a[1]); T((X[1] + X[2]) / 2, y0 - 3.5, b[0]); T((X[1] + X[2]) / 2, y0 - 7.5, b[1]);
      T((X[2] + X[5]) / 2, y0 - 2, 'LOCATION/DIRECTION', 1.8, 'S-TITLE'); subs.forEach((t, i) => { if (!t) return; const L2 = t.split('\n'); L2.forEach((l, k) => T((X[2 + i] + X[3 + i]) / 2, y0 - 5.8 - k * 2.6, l, 1.6)); });
      y = y2;
    };
    block(['PIER', 'N°'], ['CORBEL', 'N°'], ['ABUT 1\nEND', 'ABUT 2\nEND', ''], nP, true); if (true) { Ln(X[4], y, X[5], y); }
    block(['SPAN', 'N°'], ['STRINGER', 'N°'], ['ABUT 1\nEND', 'MIDDLE', 'ABUT 2\nEND'], nS, false); Ln(X[0], y, X[5], y, 'S-TITLE');
    const ny = B.notes(60, y - 10, ['STRINGERS & CORBELS ARE NUMBERED FROM LEFT TO RIGHT IN INCREASING CHAINAGE.', "ALL BOLTS USED SHALL BE φ20 THREADED ROD UNLESS OTHERWISE NOTED AND COATED WITH 'DENSO' PASTE BEFORE INSTALLATION.", 'BOLTS SHALL BE AT 600 CENTRES FOR LENGTH OF SPLITS GREATER THAN 5mm WIDE.', 'BOLT DIRECTION ABBREVIATIONS USED:'], 88, 'NOTE:');
    ['H - HORIZONTAL', 'V - VERTICAL', 'D - DIAGONAL', 'C - CROSS'].forEach((l, i) => B.E.push({ t: 'text', p: [85, ny - i * 3.4], s: l, h: TH, al: 'l', v: 'b', ang: 0, L: 'S-TEXT' }));
    B.title(102, ny - 18, 'BOLTING REQUIREMENT TABLE', null);
    nbox(B, 165, 232, 'NOTE:\nFOR CURVED WASHER DETAILS\nREFER TO DRG N° 9530-0072', { solid: true });
    nbox(B, 160, 214, "DRG N° 9530-0072 CAN BE FOUND IN THE\nPILES SECTION OF THE 'STRUCTURES\nENGINEERING STANDARD DRAWINGS MANUAL'");
    return B.E;
  }, 'Bolt types (vertical, diagonal, cross, horizontal) for closing splits in timber stringers and corbels, with the bolting requirement table that lists bolt location and direction per pier / span.');
})(typeof window !== 'undefined' ? window : globalThis);
