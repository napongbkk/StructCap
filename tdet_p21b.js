/* StructCap Timber — repair details: PN30-2117 … 2124 (steel pile bearings, halfcap connection, abutment piles).
   Registers into TDET (tdetails.js must load first). Paper mm, y up; see tdetails.js for the drafting conventions. */
(function (G) {
  'use strict';
  const A = G.TDET.api;
  const { PI, sq, abs, max, min, SEC, UCs, UBs, PFCs, secName, TH, Builder, Lay, def, P, bbox, shiftE, iSec, cSec, cSecH, aSec, rhsSec, iElevFlange, iElevWebV, iElevWebH, pfcElevH, pfcElevV, pileElev, rod, boltSym, concBox, ringPts, ellP, circP, timberX, logEnd } = A;

  // ------------------------------------------------------------------ local helpers
  const TW = (s, h) => String(s).length * (h || TH) * 0.68;
  // stack blocks of entities vertically (top-left aligned), gap in paper mm
  function stack(blocks, gap) { const out = []; let y = 0; blocks.forEach(E => { if (!E || !E.length) return; const b = bbox(E); E.forEach(e => shiftE(e, -b.x0, y - b.y1)); out.push(...E); y -= (b.y1 - b.y0) + (gap == null ? 18 : gap); }); return out; }
  // place blocks side by side (top aligned)
  function row(blocks, gap) { const out = []; let x = 0; blocks.forEach(E => { if (!E || !E.length) return; const b = bbox(E); E.forEach(e => shiftE(e, x - b.x0, -b.y1)); out.push(...E); x += (b.x1 - b.x0) + (gap == null ? 20 : gap); }); return out; }
  // paper text / lines on a builder
  const T1 = (B, x, y, s, h, al, L) => B.E.push({ t: 'text', p: [x, y], s: String(s), h: h || TH, al: al || 'l', v: 'b', ang: 0, L: L || 'S-TEXT' });
  const L1 = (B, x1, y1, x2, y2, L) => B.E.push({ t: 'line', a: [x1, y1], b: [x2, y2], L: L || 'S-TEXT' });
  // solid arrowhead in paper space at (x,y) pointing along ang (rad)
  const AR = (B, x, y, ang, L) => B.E.push({ t: 'solid', p: [[x, y], [x - 2.2 * Math.cos(ang) - 0.7 * Math.sin(ang), y - 2.2 * Math.sin(ang) + 0.7 * Math.cos(ang)], [x - 2.2 * Math.cos(ang) + 0.7 * Math.sin(ang), y - 2.2 * Math.sin(ang) - 0.7 * Math.cos(ang)]], L: L || 'S-TEXT' });
  // view title on the sheet: 'ELEVATION' (small underlined) or 'VIEW A' / 'SECTION B' / 'DETAIL 1' (circle letter), scale under
  function vtitle(B, x, y, s, scale, sub) { const m = /^(SECTION|VIEW|DETAIL)\s+(\w{1,2})$/.exec(s); if (m) B.title(x, y, s, scale, sub); else { const h = 2.4, w = TW(s, h); T1(B, x - w / 2, y, s, h); L1(B, x - w / 2, y - 0.9, x + w / 2, y - 0.9, 'S-TITLE'); if (scale) T1(B, x - w / 2, y - 4.2, '1:' + scale, TH * 0.9); } }
  // detail title (MRWA sheet style): underlined lines, 'XX30-XXXX' after the last line, sub lines, scale; dashed 'DRG NUMBER' box with a dashed leader to the ref
  function dtitle(B, x, y, lines, o) {
    o = o || {}; const h = 3.4; let yy = y, last = 0; const bx = o.bullet ? 6 : 0;
    if (o.bullet) { const c = [x + 1.8, y + h / 2]; if (o.bullet === 'cross') { B.E.push({ t: 'circle', c, r: 1.6, L: 'S-TITLE' }); L1(B, c[0] - 2.6, c[1], c[0] + 2.6, c[1], 'S-TITLE'); L1(B, c[0], c[1] - 2.6, c[0], c[1] + 2.6, 'S-TITLE'); } else B.E.push({ t: 'solid', p: [[c[0] - 1.6, c[1] - 1.6], [c[0] + 1.6, c[1] - 1.6], [c[0] + 1.6, c[1] + 1.6], [c[0] - 1.6, c[1] + 1.6]], L: 'S-TITLE' }); }
    lines.forEach((l, i) => { const w = TW(l, h); T1(B, x + bx, yy, l, h, 'l', 'S-TITLE'); L1(B, x + bx, yy - 1.1, x + bx + w, yy - 1.1, 'S-TITLE'); last = w; if (i < lines.length - 1) yy -= h * 1.75; });
    const rx = x + bx + last + 6; if (o.ref !== '') T1(B, rx, yy, o.ref || 'XX30-XXXX', 2.4);
    let sy = yy - 4.2;
    (o.sub || []).concat(['1:' + (o.scale || 20)]).forEach(s => { T1(B, x + bx, sy, s, 2.1); sy -= 3.2; });
    if (o.drg !== false) { const v1 = B.view(1, 0, 0), bxx = rx + 4, byy = yy - 8; v1.noteBox(bxx, byy, 'DRG NUMBER - REFER TO\nPLAN DRAWING', 38); L1(B, bxx + 12, byy, rx + 8, yy - 1.5, 'S-NOTE'); AR(B, rx + 8, yy - 1.5, Math.atan2(yy - 1.5 - byy, -4)); }
    return sy;
  }
  // dashed (designer) or solid (construction) note box at paper (x,y top-left)
  const nbox = (B, x, y, s, w, o) => B.view(1, 0, 0).noteBox(x, y, s, w, o);
  // big dashed 'option' box ('PREFERRED OPTION' etc.)
  function obox(B, x, y, s, h) { h = h || 3.0; const ls = String(s).split('\n'), w = max(...ls.map(l => String(l).length * h * 0.78)) + 5, H = ls.length * h * 1.6 + 2.6; B.E.push({ t: 'pl', p: [[x, y], [x + w, y], [x + w, y - H], [x, y - H]], closed: true, L: 'S-NOTE' }); ls.forEach((l, i) => T1(B, x + 2.5, y - 1.8 - h - i * h * 1.6, l, h)); return H; }
  // weld symbol with extra arrows from the same reference-line elbow
  function weldM(v, pts, dx, dy, o) { v.weld(pts[0][0], pts[0][1], dx, dy, o); const a0 = v.P(pts[0][0], pts[0][1]), b = [a0[0] + dx, a0[1] + dy]; pts.slice(1).forEach(q => { const a = v.P(q[0], q[1]); v.add({ t: 'line', a: b, b: a, L: 'S-TEXT' }); v.arrow(q[0], q[1], Math.atan2(a[1] - b[1], a[0] - b[0]) * 180 / PI); }); }
  // leader to several points with the note at the first one's shoulder
  const leaders = (v, pts, dx, dy, s, o) => v.leaders(pts, dx, dy, s, o);
  // washer + rod seen end-on (square washer w, hole)
  function rodEnd(v, x, y, w, L) { w = w || 65; v.rect(x - w / 2, y - w / 2, w, w, L || 'S-BOLT'); v.circ(x, y, 11, L || 'S-BOLT'); }
  // rod / bolt side-on: hidden shank between the faces (x1..x2 at y), nut + washer outside both faces
  function rodSide(v, x1, x2, y, d, vis) { v.line(x1 - 25, y, x2 + 25, y, vis ? 'S-BOLT' : 'S-HIDDEN'); v.nut(x2, y, 1, 0, d || 20); v.nut(x1, y, -1, 0, d || 20); }
  // log stringer seen end-on with trimmed flats (existing): centre (x,y), radius r, flats at ±f
  function logFlat(v, x, y, r, f) { const a = Math.asin(f / r) * 180 / PI; v.arc(x, y, r, a, 180 - a, 'S-EXIST'); v.arc(x, y, r, 180 + a, 360 - a, 'S-EXIST'); v.arc(x, y, r, -a, a, 'S-EXIST'); v.arc(x, y, r, 180 - a, 180 + a, 'S-EXIST'); }
  // log with flats top / bottom (true flat lines)
  function logF(v, x, y, r, f) { const a = Math.acos(f / r) * 180 / PI, dx = Math.sqrt(r * r - f * f); v.arc(x, y, r, -90 + a, 90 - a, 'S-EXIST'); v.arc(x, y, r, 90 + a, 270 - a, 'S-EXIST'); v.line(x - dx, y + f, x + dx, y + f, 'S-EXIST'); v.line(x - dx, y - f, x + dx, y - f, 'S-EXIST'); }

  // ================================================================== PN30-2117 / 2118 steel pier pile / timber halfcap bearing, Types 1 / 2 / 3
  const HW = 200, HG = 75; // halfcap width, half gap between halfcaps (150 PFC connection channel)
  function bearingType(t, o) {
    const B = new Builder(), s = SEC[o.uc] || SEC['200UC52'], un = secName(o.uc || '200UC52'), hc = o.hc, str = o.str, hs = SEC[o.hs] || SEC['250PFC'];
    const e = B.view(20, 0, 0), a = B.view(20, t === 3 ? 138 : 118, 0);
    const y0 = str ? hs.d : 0, yT = y0 + hc; // underside / top of the timber halfcap; steel bearing top at y = 0
    const xl = t === 3 ? -420 : -480, xr = t === 3 ? 820 : 480;
    // ---------------- ELEVATION
    e.line(xl, y0, xr, y0, 'S-EXIST'); e.line(xl, yT, xr, yT, 'S-EXIST');
    if (t === 3) e.line(xl, y0, xl, yT, 'S-EXIST'); else e.brk(xl, y0 - 40, xl, yT + 40, 'S-EXIST');
    e.brk(xr, y0 - 40, xr, yT + 40, 'S-EXIST');
    if (str) { // proposed halfcap strengthening (PFC seen on the web) + portion of the existing pile left in the halfcap
      pfcElevH(e, xl, xr, y0, hs, 'S-NEW', true); e.brk(xr, -30, xr, y0 + 30, 'S-NEW'); if (t !== 3) e.brk(xl, -30, xl, y0 + 30, 'S-NEW');
      const k = t === 3 ? 1 / (o.X || 6) : 0, pw = 150; [-1, 1].forEach(sg => e.line(sg * pw - k * 0 + 0, y0, sg * pw + k * hc, yT, 'S-EXIST'));
      rodEnd(e, -110 + k * hc * 0.4, y0 + hc * 0.35, 45); rodEnd(e, 110 + k * hc * 0.9, y0 + hc * 0.8, 45);
    }
    // halfcap connection channel between the halfcaps (hidden) with the rods end-on
    const cy = 0, chL = str ? min(300, hs.d) : 300; e.rect(-HG / 2, cy, HG, chL, 'S-HIDDEN'); [75, 225].filter(y => y < chL - 20).forEach(y => rodEnd(e, 0, cy + y, 52));
    if (t === 1) { iSec(e, 0, -s.d / 2, s, 0); [-1, 1].forEach(k => e.rect(k > 0 ? s.tw / 2 : -s.b / 2, -s.d + s.tf, s.b / 2 - s.tw / 2, s.d - 2 * s.tf, 'S-NEW')); iElevFlange(e, 0, -s.d - 500, -s.d, s); e.brk(-s.b / 2 - 20, -s.d - 500, s.b / 2 + 20, -s.d - 500, 'S-NEW'); }
    if (t === 2) { e.rect(-125, -16, 250, 16, 'S-NEW'); e.rect(-5, -216, 10, 200, 'S-NEW'); iElevFlange(e, 0, -16 - 560, -16, s); e.brk(-s.b / 2 - 20, -576, s.b / 2 + 20, -576, 'S-NEW'); }
    let pTop = null;
    if (t === 3) {
      e.rect(-150, -12, 300, 12, 'S-NEW');
      const X = o.X || 6, ux = -1 / sq(1 + X * X), uy = -X / sq(1 + X * X), nx = -uy, ny = ux, Lp = 820, h2 = s.b / 2;
      const P0 = [0, -12], Pb = [P0[0] + ux * Lp, P0[1] + uy * Lp];
      [-1, 1].forEach(k => { const top = [P0[0] + nx * h2 * k + (k * nx * h2 * 0) , -12]; const x0 = P0[0] + k * h2 / abs(uy) * 1; e.line(x0 - (k > 0 ? 15 : 15) * 0 , -12, Pb[0] + nx * h2 * k * 1, Pb[1] + ny * h2 * k, 'S-NEW'); });
      [-1, 1].forEach(k => e.line(P0[0] + k * s.tw / 2, -12, Pb[0] + nx * k * s.tw / 2, Pb[1] + ny * k * s.tw / 2, 'S-HIDDEN'));
      e.brk(Pb[0] - nx * (h2 + 20), Pb[1] - ny * (h2 + 20), Pb[0] + nx * (h2 + 20), Pb[1] + ny * (h2 + 20), 'S-NEW');
      e.rect(-5, -212, 10, 200, 'S-NEW'); pTop = { ux, uy, nx, ny, h2, Pb };
      // rake marker (X in 1)
      const q = e.P(260, -420); B.E.push({ t: 'pl', p: [[q[0], q[1]], [q[0], q[1] + 6], [q[0] + 1, q[1]]], closed: true, L: 'S-TEXT' }); T1(B, q[0] + 2, q[1] + 3.5, 'X', 2.2); T1(B, q[0] - 0.4, q[1] - 3.4, '1', 2.2);
      // existing decking and stringers
      const r = 190, f = 150, sy1 = yT + f, sy2 = yT + 3 * f; [-130, 520].forEach(x => { logF(e, x, sy1, r, f); logF(e, x, sy2, r, f); });
      const dk = yT + 4 * f; e.rect(-420, dk, 1240, 100, 'S-EXIST'); e.brk(820, dk - 30, 820, dk + 130, 'S-EXIST');
      e.leader(-60, dk + 100, -10, 10, 'EXISTING TIMBER\nDECKING'); e.leader(520, sy2, 4, 34, 'EXISTING TIMBER\nSTRINGER', { dot: true }); e.leader(700, yT, 6, 22, 'EXISTING\nTIMBER\nHALFCAPS');
    } else e.leader(380, yT, 10, 12, 'EXISTING TIMBER\nHALFCAP');
    // markers, welds, notes
    e.mark(0, yT + (t === 3 ? 110 : 200), 'B', -90); e.mark(t === 3 ? 380 : 700, y0 + (str ? -hs.d / 2 + 30 : hc / 2) + (str ? 0 : 0), 'A', 180);
    e.weld(-HG / 2, 0, -18, str ? 2 : 10, { size: '6', all: true });
    if (t === 2) e.weld(-5, -60, -16, -4, { size: '8', all: true, tail: 'TYP' });
    if (t === 1) { e.leader(-s.b / 4, -s.d / 2, -18, -2, '12FL STIFFENER\n(TYP)', { dot: true }); e.leader(-s.b / 2, -s.d - 150, -10, 4, secName(o.uc || '200UC52')); }
    if (t !== 3) e.leader(s.b / 2, -s.d - 260, 12, -8, 'PROPOSED PILE');
    if (str) { e.leader(-260, y0 - 8, -12, 34, 'PROPOSED HALFCAP\nSTRENGTHENING'); e.leader(150 + (t === 3 ? hc / (o.X || 6) * 0.5 : 0), y0 + hc * 0.6, 18, 8, t === 3 ? 'PORTION OF\nEXISTING TIMBER\nPILE TO REMAIN' : 'PORTION OF EXISTING\nTIMBER PILE TO REMAIN'); }
    if (t === 3) { const { ux, uy, nx, ny, h2 } = pTop; e.leader(-h2 + 30, -60, -10, -4, '15 CHAMFER\n(PILE FLANGES)'); e.leader(150, -12, 14, -6, 'CAP PLATE'); e.leader(5, -150, 18, -12, 'STIFFENER'); e.leader(-h2 - 60 + ux * 0, -560, -10, -2, un + ' PILE'); }
    // 'REFER TO HALFCAP CONNECTION DETAILS' box + (PN30-2119)
    { const q = e.P(0, 150), bx = t === 3 ? q[0] - 52 : q[0] + 6, by = t === 3 ? q[1] + 14 : q[1] - 9; const H = nbox(B, bx, by, 'REFER TO HALFCAP\nCONNECTION DETAILS', 33);
      const ex = t === 3 ? bx + 33 : bx, ey = by - 2.5; L1(B, ex, ey, ex + (t === 3 ? 1.5 : -1.5), ey); const tgt = e.P(HG / 2, 200); L1(B, ex + (t === 3 ? 1.5 : -1.5), ey, tgt[0], tgt[1]); AR(B, tgt[0], tgt[1], Math.atan2(tgt[1] - ey, tgt[0] - (ex + (t === 3 ? 1.5 : -1.5))));
      const px = t === 3 ? bx - 12 : bx + 22, py = by - H - 6; nbox(B, px, py, '(PN30-2119)', 19); L1(B, px + (t === 3 ? 19 : 9), py, bx + (t === 3 ? 10 : 20), by - H, 'S-NOTE'); }
    const nE = B.E.length;
    // ---------------- VIEW A
    const hx = [-HG - HW, HG]; // halfcap left edges
    if (t === 3) { // decking, stringer side-on, corbel over the halfcaps
      const top = yT, cb = top + 0, ch = 240, sb = cb + ch, sh = 220, dk = sb + sh;
      a.pl([[-420, cb + 80], [-370, cb], [370, cb], [420, cb + 80], [420, cb + ch], [-420, cb + ch]], true, 'S-EXIST');
      a.line(-720, sb, 720, sb, 'S-EXIST'); a.line(-720, sb + sh - 40, 720, sb + sh - 40, 'S-EXIST'); [-1, 1].forEach(k => { a.arc(k * 720, sb + sh / 2 - 20, (sh - 40) / 2, k > 0 ? -90 : 90, k > 0 ? 90 : 270, 'S-EXIST'); }); a.line(-12, sb, -12, dk, 'S-EXIST'); a.line(12, sb, 12, dk, 'S-EXIST');
      for (let x = -760; x < 760; x += 200) a.rect(x + 10, dk, 180, 100, 'S-EXIST'); a.brk(-780, dk - 20, -780, dk + 120, 'S-EXIST'); a.brk(780, dk - 20, 780, dk + 120, 'S-EXIST');
      hx.forEach(x => a.rect(x, y0, HW, hc, 'S-EXIST'));
    } else hx.forEach(x => a.rect(x, y0, HW, hc, 'S-EXIST'));
    if (str) {
      [-1, 1].forEach(k => cSec(a, k * HG, y0 / 2, hs, k)); a.line(-HG - hs.b, 0, HG + hs.b, 0, 'S-NEW');
      [75, 225].filter(y => y < hs.d - 20).forEach(y => rodSide(a, -HG - hs.tw, HG + hs.tw, y, 20, true));
      [0.3, 0.7].forEach(f => rodSide(a, -HG - HW, HG + HW, y0 + hc * f, 20));
      a.line(-HG, y0, -HG, yT, 'S-EXIST'); a.line(HG, y0, HG, yT, 'S-EXIST');
    } else { a.rect(-HG, 0, 2 * HG, 300, 'S-NEW'); [75, 225].forEach(y => rodSide(a, -HG - HW, HG + HW, y, 20)); }
    const xs = s.d / 2;
    if (t === 1) { iElevWebH(a, -275, 275, -s.d / 2, s); [-1, 1].forEach(k => a.rect(k * (xs - s.tf / 2) - 6, -s.d + s.tf, 12, s.d - 2 * s.tf, 'S-NEW')); iElevWebV(a, 0, -s.d - 420, -s.d, s); a.brk(-xs - 20, -s.d - 420, xs + 20, -s.d - 420, 'S-NEW'); }
    if (t === 2) { a.rect(-275, -16, 550, 16, 'S-NEW'); [-1, 1].forEach(k => a.pl([[k * xs, -16], [k * (xs + 150), -16], [k * (xs + 30), -216], [k * xs, -216]], true, 'S-NEW')); iElevWebV(a, 0, -16 - 480, -16, s); a.brk(-xs - 20, -496, xs + 20, -496, 'S-NEW'); }
    if (t === 3) { a.rect(-250, -12, 500, 12, 'S-NEW'); a.rect(-250, -212, 500, 200, 'S-NEW'); [-xs, -xs + s.tf, xs - s.tf, xs].forEach(x => a.line(x, -212, x, -12, 'S-HIDDEN')); iElevWebV(a, 0, -212 - 360, -212, s); a.brk(-xs - 20, -572, xs + 20, -572, 'S-NEW'); }
    // dims, leaders, welds
    const rx = t === 3 ? 330 : 360, yb = str ? 75 : 75; a.dim(rx, 0, rx, yb, -4, '75');
    const lrod = str ? 'M20 BOLTS\n(TYP)' : 'φ20 THREADED ROD WITH\n1-65x5' + (t === 3 ? ' ' : '') + 'FLx65 WASHER' + (t === 1 ? '' : '\n(TYP)');
    if (str) { a.leader(-HG - hs.tw - 12, 75, -18, 14, lrod); a.leader(-HG - HW + 40, yT, -12, 8, 'EXISTING TIMBER\nHALFCAP'); }
    else a.leader(-HG - HW - 60, 225, -14, 6, lrod);
    if (str) { const pts = [[0, y0 + hc * 0.72], [HG + HW + 40, y0 + hc * 0.3]]; a.leaders(pts, 20, 22, 'EXISTING TIMBER PILE TO\nBE TRIMMED FLUSH WITH\nUNDERSIDE OF EXISTING\nTIMBER HALFCAPS. EXISTING\nBOLTS TO REMAIN.', { dot: true }); }
    if (t === 1) { weldM(a, [[-xs + s.tf, -s.d / 2], [xs - 10, -s.d / 2 + 30]], -20, -6, { size: '6', both: true, tail: 'TYP' }); weldM(a, [[-xs, -s.d], [xs, -s.d]], -24, -24, {}); a.weld(xs + 6, -s.d / 2, 32, 0, { both: true, tail: 'TYP' }); a.leader(275, -s.d, 8, -12, secName(o.uc || '200UC52') + 'x550'); }
    if (t === 2) { a.dim(-xs - 150, -216, -xs - 150, -16, 6, '200'); a.dim(xs, -260, xs + 30, -260, -5, '30', { sub: '(TYP)' }); a.leader(-xs - 90, -80, -18, -10, '150x10FLx200\nSTIFFENER\n(TYP)'); a.leader(275, -16, 10, -10, '250x550x16PL\nCAP PLATE'); }
    if (t === 3) { a.weld(-250, -6, -16, -8, { size: '8', all: true }); weldM(a, [[-xs, -212], [-250, -150]], -26, -12, { size: '8' }); a.leader(250, -6, 10, -8, '300x12' + (str ? 'PL' : 'FL') + 'x500\nCAP PLATE'); a.leader(250, -212, 6, -10, '200x10FLx500\nSTIFFENER (TYP)'); }
    if (t === 3) { const q = a.P(-250, -212); T1(B, q[0] - 46, q[1] - 7, 'TYP. ALL VERTICAL', 2.2); T1(B, q[0] - 46, q[1] - 10.4, 'LEGS ON OUTSIDE', 2.2); T1(B, q[0] - 46, q[1] - 13.8, 'OF PILE.', 2.2); }
    // ---------------- titles and boxes
    const ebb = bbox(B.E.slice(0, nE)), abb = bbox(B.E.slice(nE)), ab = [a.P(0, 0)[0], abb.y0], ep = [e.P(0, 0)[0], ebb.y0];
    vtitle(B, ep[0], ep[1] - 6, 'ELEVATION');
    B.title(ab[0], ab[1] - 9, 'VIEW A', 20);
    const head = str ? ['STEEL PIER PILE/ HALFCAP STRENGTHENING', (t === 3 ? 'DETAIL - TYPE ' : 'BEARING DETAIL - TYPE ') + t] : (t === 3 ? ['STEEL PIER PILE/TIMBER HALFCAP BEARING', 'DETAIL - TYPE 3'] : ['STEEL PIER PILE/TIMBER HALFCAP', 'BEARING DETAIL - TYPE ' + t]);
    const ty = ep[1] - 18, tx = ep[0] - 40; const sy = dtitle(B, tx, ty, head, { sub: ['PIER N° X - PILE N° X', 'PIER N° X - PILE N° X'] });
    if (t === 1) obox(B, tx + 6, sy - 3, 'PREFERRED OPTION');
    if (t === 2) { const h1 = obox(B, tx + 8, sy - 3, str ? 'NON - PREFERRED OPTION' : 'NON PREFERRED'); obox(B, tx + 2, sy - 9 - h1, 'ENGINEER SHALL CHOOSE\nOPTION TO SUIT');
      nbox(B, tx + 72, sy - 4, 'PROPOSED PILE SIZE WILL VARY\nACCORDING TO\nENGINEERING REQUIREMENTS.\n' + un + ' PILE DRAWN\n \nTHIS PAGE SHALL BE READ IN CONJUNCTION WITH\nPIER-STEEL PILE/TIMBER HALFCAP CONNECTION', 82); }
    nbox(B, ab[0] - 24, ab[1] - 24, 'TIMBER HALFCAPS SHALL BE\nPROPPED DURING CONSTRUCTION\nTO THEIR ORIGINAL POSITIONS', 52, { solid: true });
    return B.E;
  }
  function bearing(p, str) {
    const ty = String(p.type).toUpperCase(), o = { uc: p.uc || '200UC52', hc: +p.hc || 300, str, hs: p.hs || '250PFC', X: +p.X || 6 };
    const ts = ty === 'ALL' ? [1, 2, 3] : [min(3, max(1, Math.round(+ty) || 1))];
    return stack(ts.map(t => bearingType(t, o)), 16);
  }
  def('spb', 'Piles', 'Steel pier pile / timber halfcap bearing – Types 1 / 2 / 3', 'PN30-2117',
    [P('type', 'Type', 'ALL', { opts: ['ALL', 1, 2, 3] }), P('hc', 'Halfcap depth (mm)', 300, { num: 1 }), P('uc', 'Steel pile', '200UC52', { opts: UCs }), P('X', 'Rake X (Type 3, X in 1)', 6, { num: 1 })],
    (p) => bearing(p, false),
    'Bearing of a new steel pier pile under existing timber halfcaps: Type 1 (UC head, preferred), Type 2 (cap plate) or Type 3 (raked pile); halfcaps propped during construction.');
  def('pn2118', 'Piles', 'Steel pier pile / halfcap strengthening bearing – Types 1 / 2 / 3', 'PN30-2118',
    [P('type', 'Type', 'ALL', { opts: ['ALL', 1, 2, 3] }), P('hc', 'Halfcap depth (mm)', 300, { num: 1 }), P('uc', 'Steel pile', '200UC52', { opts: UCs }), P('hs', 'Halfcap strengthening PFC', '250PFC', { opts: PFCs }), P('X', 'Rake X (Type 3, X in 1)', 6, { num: 1 })],
    (p) => bearing(p, true),
    'Steel pier pile bearing where the halfcaps are strengthened with PFCs: the existing timber pile is trimmed flush with the halfcap underside and its bolts remain.');

  // ================================================================== PN30-2119 halfcap connection details, Options 1 / 2
  function slot(v, x, y, len, w) { const r = w / 2, c = (len - w) / 2; v.arc(x - c, y, r, 90, 270, 'S-NEW'); v.arc(x + c, y, r, -90, 90, 'S-NEW'); v.line(x - c, y + r, x + c, y + r, 'S-NEW'); v.line(x - c, y - r, x + c, y - r, 'S-NEW'); v.line(x - len / 2 - 12, y, x + len / 2 + 12, y, 'S-CL'); v.line(x, y - r - 10, x, y + r + 10, 'S-CL'); }
  // plan: two halfcaps (existing) either side of a gap g, UC / cap plate under (b wide), centred on x = 0
  function hcPlan(v, g, ub) {
    const W = 200, xl = -230, xr = 230, yt = g / 2 + W, yb = -g / 2 - W;
    [[g / 2, yt], [yb, -g / 2]].forEach(([y1, y2]) => { v.line(xl, y1, xr, y1, 'S-EXIST'); v.line(xl, y2, xr, y2, 'S-EXIST'); v.brk(xl, y1 - 10, xl, y2 + 10, 'S-EXIST'); v.brk(xr, y1 - 10, xr, y2 + 10, 'S-EXIST'); });
    const e = W + g / 2 + 20; v.line(-ub / 2, e, ub / 2, e, 'S-NEW'); v.line(-ub / 2, -e, ub / 2, -e, 'S-NEW');
    [-ub / 2, ub / 2].forEach(x => { v.line(x, g / 2, x, -g / 2, 'S-NEW'); v.line(x, g / 2, x, e, 'S-HIDDEN'); v.line(x, -g / 2, x, -e, 'S-HIDDEN'); v.line(x, e - 20, x, e, 'S-NEW'); v.line(x, -e + 20, x, -e, 'S-NEW'); });
    return { yt, yb, e };
  }
  // rod in plan running in y between ya..yb (through a halfcap), nut + washer at both ends (ends given with outward direction)
  function rodPlan(v, x, y1, y2) { v.line(x, y1 - (y1 < y2 ? 40 : -40), x, y2 + (y1 < y2 ? 40 : -40), 'S-BOLT'); v.line(x - 10, y1, x - 10, y2, 'S-HIDDEN'); v.line(x + 10, y1, x + 10, y2, 'S-HIDDEN'); v.nut(x, y1, 0, y1 < y2 ? -1 : 1, 20); v.nut(x, y2, 0, y1 < y2 ? 1 : -1, 20); }
  def('pn2119', 'Halfcaps', 'Halfcap connection details – Options 1 / 2 (steel pier pile to timber halfcaps)', 'PN30-2119',
    [P('opt', 'Option', 'ALL', { opts: ['ALL', 1, 2] }), P('uc', 'Steel pile', '200UC52', { opts: UCs })], (p) => {
      const o = String(p.opt).toUpperCase(), s = SEC[p.uc] || SEC['200UC52'], un = secName(p.uc || '200UC52'), blocks = [];
      if (o === 'ALL' || o === '1') { // ---------------- OPTION 1: 150 PFC x 300 long between halfcaps
        const B = new Builder(), v = B.view(10, 0, 0), c = SEC['150PFC'], g = c.d, H = hcPlan(v, g, s.b);
        cSec(v, -10, 0, c, 1); rodPlan(v, 30, g / 2 - c.tf, H.yt); rodPlan(v, 30, -g / 2 + c.tf, H.yb);
        v.weld(-10, 30, -36, 0, { size: '6', all: true, tail: 'TYP' }); v.leader(c.b - 12, -g / 2 + 8, 22, 9, '150 PFC x 300 LONG,\nSHIMMED TO FIT\nBETWEEN HALFCAPS'); v.leader(s.b / 2, -H.e, 6, -6, un + ' OR CAP PLATE'); v.leader(-150, H.yb + 60, -2, -20, 'EXISTING TIMBER\nHALFCAP (TYP)', { dot: true });
        const vb = bbox(B.E); B.title(0, vb.y0 - 10, 'VIEW B', 10);
        const w = B.view(10, 130, 30); w.rect(0, 0, c.b, 300, 'S-NEW'); w.line(c.tw, 0, c.tw, 300, 'S-HIDDEN'); [75, 225].forEach(y => slot(w, 40, y, 40, 22));
        w.dim(0, 300, 40, 300, 8, '40'); w.dim(20, 0, 60, 0, -8, ' '); { const q = w.P(20, 0); T1(B, q[0] - 6, q[1] - 7.3, '40', 2.0, 'r', 'S-DIM'); }
        w.dim(c.b, 300, c.b, 225, 10, '75'); w.dim(c.b, 225, c.b, 75, 10, '150'); w.dim(c.b, 75, c.b, 0, 10, '75'); w.dim(c.b, 300, c.b, 0, 22, '300');
        w.leader(0, 150, -10, 4, '150 PFC'); w.leader(50, 70, 14, -14, 'φ22x40 LONG\nSLOTTED HOLE\n(TYP)');
        const wp = w.P(c.b / 2, -150); vtitle(B, wp[0], wp[1] - 8, 'ELEVATION'); const tx = wp[0] - 30; T1(B, tx, wp[1] - 20, 'HALFCAP CONNECTION CHANNEL', 3.4, 'l', 'S-TITLE'); L1(B, tx, wp[1] - 21.1, tx + TW('HALFCAP CONNECTION CHANNEL', 3.4), wp[1] - 21.1, 'S-TITLE'); T1(B, tx, wp[1] - 25, '1:10', 2.1);
        const oy = min(vb.y0 - 26, wp[1] - 34); T1(B, -10, oy, 'OPTION 1', 3.0); L1(B, -10, oy - 1.2, -10 + 8 * 3 * 0.72, oy - 1.2, 'S-TEXT'); T1(B, 12, oy, '(HALFCAPS > 150 APART)', 2.2); obox(B, 70, oy + 5, 'PREFERRED OPTION', 3.0);
        blocks.push(B.E);
      }
      if (o === 'ALL' || o === '2') { // ---------------- OPTION 2: angle cleat + halfcap connection angle
        const B = new Builder(), v = B.view(10, 0, 0), g = 140, H = hcPlan(v, g, s.b);
        aSec(v, 0, g / 2, 75, 125, 10, -1, -1); aSec(v, 0, -g / 2, 75, 125, 6, 1, 1);
        rodPlan(v, -45, g / 2 - 10, H.yt); rodPlan(v, 45, -g / 2 + 6, H.yb); v.bolt(-10, -5, 6, -5, 20); v.line(0, H.e + 60, 0, H.e, 'S-CL'); v.line(-45, H.e + 60, -45, H.e + 40, 'S-CL');
        v.dim(0, H.e + 70, -45, H.e + 70, 0, '45 (TYP)'); v.leader(s.b / 2, H.e, 6, 8, un + ' OR CAP PLATE');
        v.leader(-5, g / 2 - 60, 26, 26, '125x75x10 UA x 300 LONG\nANGLE CLEAT WELDED TO\nTOP OF ' + un + ' WITH\n6mm FILLET WELD.'); v.leader(14, -5, 26, 0, '2-M20 BOLTS'); v.leader(3, -20, -32, -8, '125x75x6 UA x 270\nLONG HALFCAP\nCONNECTION ANGLE'); v.leader(-120, H.yb, -4, -16, 'EXISTING TIMBER\nHALFCAP (TYP)');
        const vb = bbox(B.E); B.title(0, vb.y0 - 10, 'VIEW B', 10);
        const ang = (ox, Lg, t, e1, lbl, title) => { const w = B.view(10, ox, 25); w.rect(0, 0, 125, Lg, 'S-NEW'); w.line(t, 0, t, Lg, 'S-NEW'); [e1, Lg - e1].forEach(y => { slot(w, 75, y, 40, 22); w.fill([[0, y - 11], [t, y - 11], [t, y + 11], [0, y + 11]], 'S-NEW'); w.line(-15, y, t + 10, y, 'S-CL'); });
          w.dim(0, Lg, 125, Lg, 14, '125'); w.dim(0, Lg, 75, Lg, 7, '75'); w.dim(55, 0, 95, 0, -8, ' '); { const q = w.P(55, 0); T1(B, q[0] - 6, q[1] - 7.3, '40', 2.0, 'r', 'S-DIM'); } w.dim(0, 0, 0, Lg, 14, String(Lg)); [[Lg, Lg - e1, e1], [Lg - e1, e1, 150], [e1, 0, e1]].forEach(([y1, y2, tx]) => { w.dim(125, y1, 125, y2, 8, ' '); const q = w.P(125, (y1 + y2) / 2); B.E.push({ t: 'text', p: [q[0] + 6.6, q[1]], s: String(tx), h: 2.0, al: 'c', v: 'b', ang: 90, L: 'S-DIM' }); });
          w.leader(100, Lg - 30, 14, 22, lbl, { dot: true }); w.leader(0, e1, -12, -12, 'φ22 HOLE FOR\nTHREADED ROD\n(TYP)'); w.leader(85, e1 - 8, 12, -14, 'φ22x40 LONG\nSLOTTED HOLE\nFOR M20 BOLT\n(TYP)');
          const wp = w.P(62, -150); vtitle(B, wp[0], wp[1] - 13, 'ELEVATION'); const tx = wp[0] - TW(title, 3.4) / 2; T1(B, tx, wp[1] - 24, title, 3.4, 'l', 'S-TITLE'); L1(B, tx, wp[1] - 25.1, tx + TW(title, 3.4), wp[1] - 25.1, 'S-TITLE'); T1(B, tx, wp[1] - 29, '1:10', 2.1); return wp[1] - 29; };
        ang(118, 270, 6, 60, '125x75x6 UA x 270\nLONG HALFCAP\nCONNECTION\nANGLE', 'HALFCAP CONNECTION ANGLE'); const yl = ang(212, 300, 10, 75, '125x75x10 UA x 300\nLONG ANGLE CLEAT', 'ANGLE CLEAT');
        const oy = yl - 14; T1(B, 90, oy, 'OPTION 2', 3.0); L1(B, 90, oy - 1.2, 90 + 8 * 3 * 0.72, oy - 1.2, 'S-TEXT'); T1(B, 112, oy, '(HALFCAPS 130-160 APART)', 2.2);
        obox(B, 70, oy - 7, 'ENGINEER SHALL CHOOSE OPTION TO SUIT\nNOTE: STEEL HALFCAP OPTION NOT DRAWN', 3.0);
        blocks.push(B.E);
      }
      return stack(blocks, 14);
    }, 'Connection of a steel pier pile head to the timber halfcaps: Option 1 (150 PFC between halfcaps > 150 apart, preferred) or Option 2 (angle cleat and connection angle, halfcaps 130–160 apart).');

  // ================================================================== PN30-2120 / 2121 steel abutment pile / timber fullcap bearing, Options 1 / 2
  const FC = 300, FW = 250, PK = 75; // fullcap depth / width, timber packer thickness
  function abBearOpt(op, o) {
    const B = new Builder(), s = SEC[o.uc] || SEC['200UC52'], un = secName(o.uc || '200UC52'), bu = SEC[o.bu] || SEC['250UC90'], bn = secName(o.bu || '250UC90'), rail = o.rail;
    const v = B.view(20, 0, 0), x1 = PK, x2 = PK + s.d, yb = -FC, ybb = -FC - bu.d, yBot = -1050, Ht = rail ? 560 : 0;
    // ---------------- ELEVATION
    const sTop = rail ? Ht : 520; // sheeting (existing) with earth behind
    v.line(-75, yBot, -75, sTop, 'S-EXIST'); v.line(0, yBot + 40, 0, rail ? Ht - 200 : sTop - 100, 'S-EXIST'); for (let y = yBot + 150; y < sTop - 120; y += 150) v.line(-75, y, 0, y, 'S-EXIST');
    v.hatch([[-135, yBot + 200], [-75, yBot + 200], [-75, rail ? Ht - 120 : 20], [-135, rail ? Ht - 120 : 20]], 'ansi31', 'S-HATCH', 0.6); v.brk(-140, yBot + 40, 0, yBot + 40, 'S-EXIST');
    v.rect(0, yBot, PK, (rail ? Ht - 200 : 0) - yBot, 'S-NEW'); // timber packer
    if (rail) { // spiking rail at the top, pile cut at 15 degrees
      timberX(v, 0, Ht - 200, PK, 200, 'S-EXIST'); v.line(-75, Ht, PK, Ht, 'S-EXIST'); v.bolt(-75, Ht - 110, x1 + s.tf, Ht - 110, 20);
      const yR = Ht - s.d * Math.tan(15 * PI / 180); v.line(x1, yBot, x1, Ht, 'S-NEW'); v.line(x2, yBot, x2, yR, 'S-NEW'); v.line(x1 + s.tf, yBot, x1 + s.tf, Ht - 2, 'S-NEW'); v.line(x2 - s.tf, yBot, x2 - s.tf, yR + 2, 'S-NEW'); v.line(x1, Ht, x2, yR, 'S-NEW');
      v.dim(0, Ht + 40, PK, Ht + 40, 10, '75'); v.line(x2, yR, x2 + 260, yR - 70, 'S-DIM'); v.line(x2 + 120, Ht, x2 + 300, Ht, 'S-DIM'); v.text(x2 + 150, Ht - 60, '15°', 2.0, 'l', 'b', 'S-DIM'); v.dim(x2 + 330, Ht - 110, x2 + 330, Ht, -4, '110');
      v.leader(0, Ht - 60, -10, 10, 'RETAIN EXISTING SPIKING\nRAIL (REPLACE IF REQUIRED\nWITH SAME SIZE).'); v.leader(x1 + s.d / 2, Ht - 400, 18, -6, un + '\nPROPOSED PILE', { dot: true });
    } else {
      iElevWebV(v, x1 + s.d / 2, yBot, 0, s); v.line(x1, 0, x2, 0, 'S-NEW');
      // decking and stringer (existing)
      for (let x = -75; x < 900; x += 160) v.rect(x, 420, min(160, 900 - x), 100, 'S-EXIST'); v.brk(900, 400, 900, 540, 'S-EXIST');
      v.line(0, 20, 0, 420, 'S-EXIST'); v.line(0, 420, 900, 420, 'S-EXIST'); v.line(x2, 20, x2 + 120, 20, 'S-EXIST'); v.line(x2 + 120, 20, x2 + 200, -0, 'S-EXIST'); v.line(x2 + 200, 0, 860, 0, 'S-EXIST'); v.pileEnd(900, 210, 420, 'S-EXIST', 1); v.line(-75, 520, 0, 520, 'S-EXIST');
      v.dim(-110, 0, -110, 20, 8, '20'); v.leader(250, 520, -6, 18, 'EXISTING TIMBER\nDECKING'); v.leader(800, 420, 6, 24, 'EXISTING TIMBER\nSTRINGER'); v.leader(x1 + 40, 0, -40, 22, 'PROPOSED PILE');
    }
    v.brk(x1 - 10, yBot, x2 + 10, yBot, 'S-NEW');
    v.rect(x2, -FC, FW, FC, 'S-EXIST'); [-100, -200].forEach(y => rodSide(v, x2 - s.tf, x2 + FW, y, 20));
    if (op === 1) { v.rect(x2, ybb, bu.b / 2, bu.d, 'S-NEW'); v.line(x2, yb - bu.tf, x2 + bu.b / 2, yb - bu.tf, 'S-NEW'); v.line(x2, ybb + bu.tf, x2 + bu.b / 2, ybb + bu.tf, 'S-NEW'); [yb - bu.tf, ybb + bu.tf].forEach(y => v.rect(x1 + s.tf, y - 5, s.d - 2 * s.tf, 10, 'S-NEW'));
      const c = [x2 + 20, (yb + ybb) / 2]; v.circ(c[0], c[1], 230, 'S-TEXT'); const q = v.P(c[0] + 230 * 0.6, c[1] - 230 * 0.8); B.E.push({ t: 'circle', c: [q[0] + 4, q[1] - 4.5], r: 3, L: 'S-TEXT' }); T1(B, q[0] + 4, q[1] - 5.5, '1', 2.6, 'c'); L1(B, q[0], q[1], q[0] + 2.3, q[1] - 2.2);
      v.leader(x2 + 70, (yb + ybb) / 2, 22, -6, bn + '\nx200 LONG', { dot: true }); v.leader(x1 + s.d / 2, yb - bu.tf - 5, -36, -40, 'PROVIDE 2-110x10FL\nWEB STIFFENERS TO\nNEAR FACE AND FAR\nFACE.'); }
    else { aSec(v, x2, yb, 200, 200, 13, 1, -1); weldM(v, [[x2, yb - 150], [x2 + 13, yb - 40]], -36, -14, { size: '8', both: true, tail: 'TYP' }); v.leader(x2 + 200, yb - 13, 14, -12, '200x200x13 EA\n400 LONG'); }
    v.leader(PK / 2, rail ? Ht - 520 : (op === 2 ? -40 : -620), -20, -6, 'TIMBER PACKER', { dot: true });
    v.leader(-75, rail ? 50 : -150, -12, 8, 'EXISTING TIMBER\nSHEETING'); v.leader(x2 + FW / 2, -80, 22, -4, 'EXISTING TIMBER\nFULLCAP', { dot: true });
    // section A cut markers
    const cx = x2 + FW + (rail ? 260 : 130); v.mark(cx, (rail ? Ht : 520) + 260, 'A', 180); v.line(cx, (rail ? Ht : 520) + 200, cx, (rail ? Ht : 520) + 60, 'S-TITLE'); { const q = v.P(cx, yBot + 50); B.E.push({ t: 'solid', p: [[q[0], q[1]], [q[0], q[1] + 9], [q[0] - 2.4, q[1] + 2]], L: 'S-TEXT' }); L1(B, q[0], q[1] - 1, q[0], q[1] + 11, 'S-TITLE'); }
    const nE = B.E.length, eb = bbox(B.E);
    // ---------------- DETAIL 1 (Option 1)
    let d1 = null;
    if (op === 1) { const w = B.view(10, eb.x1 + 26, eb.y1 - 2), X1 = 0, X2 = s.d, Y0 = -150, Y1 = -FC - bu.d - 150;
      [X1, X1 + s.tf, X2 - s.tf, X2].forEach(x => w.line(x, Y1, x, Y0, 'S-NEW')); w.brk(X1 - 15, Y0, X2 + 15, Y0, 'S-NEW'); w.brk(X1 - 15, Y1, X2 + 15, Y1, 'S-NEW');
      w.line(X2, yb, X2 + 190, yb, 'S-EXIST'); w.line(X2 + 190, yb, X2 + 190, Y0 + 40, 'S-EXIST'); w.brk(X2 + 20, Y0, X2 + 190, Y0, 'S-EXIST');
      w.rect(X2, ybb, bu.b / 2, bu.d, 'S-NEW'); w.line(X2, yb - bu.tf, X2 + bu.b / 2, yb - bu.tf, 'S-NEW'); w.line(X2, ybb + bu.tf, X2 + bu.b / 2, ybb + bu.tf, 'S-NEW'); [yb - bu.tf, ybb + bu.tf].forEach(y => w.rect(X1 + s.tf, y - 5, s.d - 2 * s.tf, 10, 'S-NEW'));
      w.weld(X1 + 60, ybb + bu.tf + 5, -30, -9, { size: '8', both: true, all: true, tail: 'TYP' }); w.weld(X2 + 4, yb - bu.tf, 36, -10, {}); w.weld(X2 + 4, (yb + ybb) / 2, 34, -16, { size: '8', both: true }); w.weld(X2 + 4, ybb + bu.tf, 30, -22, { size: '8', both: true });
      d1 = w; }
    const db = d1 ? bbox(B.E.slice(nE)) : null; if (d1) B.title((db.x0 + db.x1) / 2 - 8, db.y0 - 8, 'DETAIL 1', 10);
    const nD = B.E.length;
    // ---------------- SECTION A
    const sx = d1 ? db.x0 + 6 : eb.x1 + 40, sy = d1 ? db.y0 - 22 : eb.y1 - 10, a = B.view(20, sx + 22 + (d1 ? 30 : 0), sy - (rail ? 30 : 26));
    const hb = s.b / 2, aTop = rail ? Ht : 0;
    a.line(-420, 0, 520, 0, 'S-EXIST'); a.line(-420, -FC, 520, -FC, 'S-EXIST'); a.brk(-420, -FC - 20, -420, 20, 'S-EXIST'); a.brk(520, -FC - 20, 520, 20, 'S-EXIST');
    a.circ(300, 200, 190, 'S-EXIST');
    if (rail) { a.line(-380, Ht, 300, Ht, 'S-EXIST'); a.line(-380, Ht - 200, 300, Ht - 200, 'S-EXIST'); a.line(-380, 420, -60, 420, 'S-EXIST'); a.brk(-380, 240, -380, Ht + 20, 'S-EXIST'); a.line(300, Ht, 300, 350, 'S-EXIST'); a.rect(300, 350, 300, 120, 'S-EXIST'); a.line(300, 420, 600, 420, 'S-EXIST'); a.brk(600, 330, 600, 490, 'S-EXIST');
      [[-30, Ht - 110], [30, Ht - 110]].forEach(([x, y]) => a.circ(x, y, 10, 'S-BOLT')); a.leaders([[-200, Ht - 60], [-80, Ht - 60]], 44, 12, 'EXISTING SPIKING\nRAIL', { dot: true }); }
    else { a.rect(-420, 420, 940, 100, 'S-EXIST'); a.brk(-420, 400, -420, 540, 'S-EXIST'); a.brk(520, 400, 520, 540, 'S-EXIST'); }
    a.line(-hb, yBot + 100, -hb, aTop, 'S-NEW'); a.line(hb, yBot + 100, hb, aTop, 'S-NEW'); a.line(-hb, aTop, hb, aTop, 'S-NEW'); a.line(-s.tw / 2, yBot + 100, -s.tw / 2, aTop, 'S-HIDDEN'); a.line(s.tw / 2, yBot + 100, s.tw / 2, aTop, 'S-HIDDEN'); a.brk(-hb - 15, yBot + 100, hb + 15, yBot + 100, 'S-NEW');
    rodEnd(a, 30, -100, 50); rodEnd(a, -30, -200, 50); a.dim(-hb - 150, -100, -hb - 150, 0, 8, '100', { sub: '(TYP)' }); a.line(-hb - 160, -100, -10, -100, 'S-DIM');
    if (op === 1) { [yb, ybb + bu.tf].forEach(y => a.rect(-100, y - bu.tf, 200, bu.tf, 'S-NEW')); a.leader(30, -110, 30, -26, 'φ20 THREADED ROD\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP)'); }
    else { a.rect(-200, yb - 13, 400, 13, 'S-NEW'); [-1, 1].forEach(k => a.rect(k > 0 ? hb : -hb - 13, yb - 200, 13, 187, 'S-NEW')); a.leader(-hb - 13, yb - 120, -18, -2, '200x200x13 EA\n(TYP)'); a.leader(-hb, yb - 400, -18, -2, 'PROPOSED PILE'); a.leaders([[30, -110], [-30, -210]], 30, -22, 'φ20 THREADED ROD\nWITH 65x5FLx65 WASHER\nTO TIMBER FACE (TYP)'); }
    const ab = bbox(B.E.slice(nD)); B.title((ab.x0 + ab.x1) / 2, ab.y0 - 8, 'SECTION A', 20); const propY = ab.y0 - 22, propX = (ab.x0 + ab.x1) / 2 - 24;
    // ---------------- titles / notes
    const ty = eb.y0 - 12, tx = eb.x0 + 26; const sy2 = dtitle(B, tx, ty, ['STEEL ABUTMENT PILE/TIMBER', 'FULLCAP BEARING DETAIL'], { sub: ['ABUTMENT N° X - PILE N° X', 'ABUTMENT N° X - PILE N° X'] });
    const h1 = obox(B, tx + 10, sy2 - 3, 'OPTION ' + op); if (op === 2 || o.one) obox(B, tx + 48, sy2 - 14, 'ENGINEER TO CHOOSE\nOPTION TO SUIT');
    nbox(B, propX, propY, 'FULLCAPS SHALL BE PROPPED\nDURING CONSTRUCTION TO\nTHEIR ORIGINAL POSITIONS' + (rail ? '' : '.'), 48, { solid: true });
    return B.E;
  }
  function abBear(p, rail) {
    const o = { uc: p.uc || '200UC52', bu: p.bu || '250UC90', rail }, op = String(p.opt).toUpperCase(), ops = op === 'ALL' ? [1, 2] : [op === '2' ? 2 : 1]; o.one = ops.length === 1;
    const blocks = ops.map(k => abBearOpt(k, o)), N = new Builder();
    nbox(N, 0, 0, 'FOR PILE POT DETAILS REFER TO RELEVANT DETAILS.\n \nPROPOSED PILE SIZE WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS INCLUDING HEIGHT OF PILE ABOVE GROUND (' + secName(o.uc) + ' SHOWN).' + (rail ? '' : '\n \nTHESE DETAILS ARE RELEVANT FOR NON DRIVEN PILES OCCURING IN AREA OF BRIDGE DECK ONLY.'), 96);
    const E = blocks.length > 1 ? stack([blocks[0], N.E, blocks[1]], 10) : stack([blocks[0], N.E], 10); return E;
  }
  const abP = [P('opt', 'Option', 'ALL', { opts: ['ALL', 1, 2] }), P('uc', 'Steel pile', '200UC52', { opts: UCs }), P('bu', 'Bearing UC (Option 1)', '250UC90', { opts: ['200UC52', '250UC73', '250UC90', '310UC97'] })];
  def('pn2120', 'Abutments', 'Steel abutment pile / timber fullcap bearing – Options 1 / 2', 'PN30-2120', abP, (p) => abBear(p, false),
    'Bearing of a new (non-driven) steel abutment pile under the timber fullcap in the area of the bridge deck: UC bearing (Option 1) or 200x200x13 EA seat (Option 2); fullcaps propped.');
  def('pn2121', 'Abutments', 'Steel abutment pile / timber fullcap bearing at spiking rail – Options 1 / 2', 'PN30-2121', abP, (p) => abBear(p, true),
    'As PN30-2120 where the pile rises to the existing spiking rail (retained or replaced with the same size); pile top cut at 15°.');

  // ================================================================== PN30-2122 / 2123 abutment pile repair Type 1 (welded) / Type 1A (bolted)
  // view block: draws with fn(v, B) at scale, then the view title under it
  function vblk(scale, fn, title, sub) { const B = new Builder(), v = B.view(scale, 0, 0); fn(v, B); if (title) { const b = bbox(B.E); const m = /^(SECTION|VIEW|DETAIL)\s/.test(title); if (m) B.title((b.x0 + b.x1) / 2, b.y0 - 9, title, scale, sub); else vtitle(B, (b.x0 + b.x1) / 2, b.y0 - 7, title); } return B.E; }
  const bar16 = (v, x, y) => { v.circ(x, y, 22, 'S-REO'); v.barEnd(x, y, 16); };
  const barIcon = (v, x, y) => { const p = v.P(x, y); v.add({ t: 'pl', p: [[p[0], p[1]], [p[0] + 3.6, p[1]], [p[0] + 3.6, p[1] + 3.6], [p[0], p[1] + 3.6]], closed: true, L: 'S-TEXT' }); v.add({ t: 'pl', p: [[p[0] + 0.8, p[1] + 3.6], [p[0] + 0.8, p[1] + 0.8], [p[0] + 3.6, p[1] + 0.8]], closed: false, L: 'S-TEXT' }); };
  const secMark = (v, x, y, ch) => { v.mark(x, y, ch, -90); const p = v.P(x, y); v.add({ t: 'line', a: [p[0] + 3, p[1]], b: [p[0] + 10, p[1]], L: 'S-TITLE' }); };
  const secArrow = (v, x, y) => { const p = v.P(x, y); v.add({ t: 'line', a: [p[0], p[1]], b: [p[0] + 12, p[1]], L: 'S-TITLE' }); v.add({ t: 'solid', p: [[p[0] + 5, p[1]], [p[0] + 12, p[1]], [p[0] + 9, p[1] - 1.6]], L: 'S-TEXT' }); };
  const eHatch = (v, x, y, w, h) => v.hatch([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 'ansi31', 'S-HATCH', 0.5);
  function abType1(p, bolt) {
    const s = SEC[p.uc] || SEC['200UC52'], un = secName(p.uc || '200UC52'), D = +p.D || 350, cv = 60, xc = cv + s.d / 2, yL = -350, yP = -450, yB = -1100;
    // ---------------- ELEVATION
    const elev = vblk(20, (v, B) => {
      v.line(-75, -1250, -75, 900, 'S-EXIST'); v.line(0, -1250, 0, 900, 'S-EXIST'); v.brk(-90, 900, 15, 900, 'S-EXIST'); eHatch(v, -125, -250, 50, 650);
      v.rect(0, 170, cv, 730, 'S-NEW'); // solid timber packer above the pot
      v.pl([[-150, yB], [750, yB], [750, 150], [0, 170], [0, yL], [-150, yL]], true, 'S-CONC'); v.fill([[-170, yB], [-150, yB], [-150, yL], [-170, yL]], 'S-NEW');
      v.ground(750, 1150, 0); v.ground(xc + D / 2, xc + D / 2 + 200, yB); v.wl(1180, 0, 'EXISTING G.L.');
      pileElev(v, xc, -1600, yP, D); v.line(xc - D / 2, yP, xc + D / 2, yP, 'S-EXIST'); v.line(xc, -1650, xc, yP, 'S-CL');
      if (bolt) { v.rect(xc - 75, yP, 150, 10, 'S-NEW'); [-1, 1].forEach(k => { aSec(v, xc + k * (s.d / 2), yP + 10, 100, 150, 10, k, 1); v.bolt(xc + k * (s.d / 2 - s.tf), yP + 80, xc + k * (s.d / 2 + 10), yP + 80, 20); }); v.circ(xc, yP + 40, 230, 'S-TEXT'); secMarkCirc(v, B, xc - 260, yP - 150, '1'); }
      else v.rect(xc - 125, yP, 250, 12, 'S-NEW');
      const yU = yP + (bolt ? 25 : 12); iElevWebV(v, xc, yU, 1000, s); v.brk(xc - s.d / 2 - 15, 1000, xc + s.d / 2 + 15, 1000, 'S-NEW');
      v.fabric(675, yB + 75, 675, 75, 110); v.fabric(25, yL - 20, 25, 75, 110); v.fabric(-75, yB + 75, -75, yL - 50, 110); v.bar([[40, yB + 50], [40, 100]]);
      [[675, 75], [675, yL - 90], [675, yB + 75], [25, 75], [-75, yL - 50], [-75, yB + 75]].forEach(q => bar16(v, ...q));
      v.spike(xc + 260, -725, xc + 20, -725);
      v.dim(-260, yB, -260, yL, 8, '750'); v.dimChain([[-190, yB], [-190, (yB + yL) / 2], [-190, yL]], 6, ['=', '=']); v.dim(-300, yP, -300, yL, 6, '100', { sub: 'MIN' });
      v.dim(950, yB, 950, 150, -6, '1250 MIN.'); v.dim(820, 0, 820, 150, -4, '150'); v.dim(820, 150, 820, 170, -4, '20'); v.text(390, 185, 'U2', 2.2, 'c'); v.line(370, 172, 390, 160, 'S-TEXT'); v.line(390, 160, 410, 172, 'S-TEXT');
      v.dim(675, yB - 120, 750, yB - 120, -2, ' '); { const q = v.P(780, yB - 120); T1(B, q[0] + 2, q[1] + 0.8, '75 CLEAR COVER', 2.2); L1(B, q[0] + 1, q[1], q[0] + 30, q[1]); T1(B, q[0] + 6, q[1] - 3.4, 'U.O.N. (TYP)', 2.2); }
      { const q = v.P(800, -300); T1(B, q[0] + 2, q[1] - 1, '4', 2.2); L1(B, q[0], q[1], q[0] + 1.6, q[1] + 1.6); L1(B, q[0], q[1], q[0] + 1.6, q[1] - 1.6); }
      secMark(v, -1150, 600, 'C'); secMark(v, -1150, yL - 50, 'B'); secMark(v, -1150, -750, 'A'); [600, yL - 50, -750].forEach(y => secArrow(v, 1250, y));
      v.leader(30, 760, -14, 4, 'SOLID TIMBER\nPACKER', { dot: true }); v.leader(-40, 560, -14, 0, 'EXISTING TIMBER\nSHEETING', { dot: true }); v.leader(25, 0, -18, 6, 'SL81 FABRIC (GALV)\n25 COVER'); v.leader(xc + s.d / 2, 860, 12, 6, 'PROPOSED ' + un + ' PILE');
      v.leaders([[25, 75], [675, 75]], 16, 18, 'N16 (500 LAP)'); barIcon(v, 840, 410); v.leaders([[675, yL - 90], [-75, yL - 50], [675, yB + 75], [-75, yB + 75]], 6, -14, 'N16\n(500 LAP)'); barIcon(v, 880, -940);
      v.leader(-160, yB + 150, -6, -10, 'PERMANENT\nFORMWORK'); v.leader(40, yB + 40, -10, -12, '4-N20'); v.leader(xc + D / 2, -1450, 14, -6, 'EXISTING TIMBER PILE, CUTBACK\nTO SOUND TIMBER - 250 MIN\nBELOW EXISTING G.L.');
      if (bolt) { v.leader(xc + 20, yP + 15, 22, 18, 'SHIM 90x90x\nTHICKNESS\nTO SUIT'); v.leader(xc, yP + 5, 34, -30, '150x10FLx150 BEARING PLATE\n(FOR PILE > φ350)'); } else v.leader(xc + 125, yP + 12, 24, 14, 'BASE PLATE');
    }, 'ELEVATION');
    // ---------------- SECTION A (plan at A)
    const secA = vblk(20, (v, B) => {
      v.rect(-150, -450, 900, 900, 'S-CONC'); v.fill([[-170, -450], [-150, -450], [-150, 450], [-170, 450]], 'S-NEW');
      [[450, 650], [-650, -450]].forEach(([y1, y2]) => { v.line(-75, y1, -75, y2, 'S-EXIST'); v.line(0, y1, 0, y2, 'S-EXIST'); }); v.rect(-75, 450, 75, 40, 'S-EXIST'); v.rect(-75, -490, 75, 40, 'S-EXIST'); v.brk(-90, 650, 15, 650, 'S-EXIST'); v.brk(-90, -650, 15, -650, 'S-EXIST');
      eHatch(v, 150, 450, 250, 40); eHatch(v, 150, -490, 250, 40); eHatch(v, 750, -200, 40, 400); eHatch(v, -210, -250, 40, 250);
      v.fabric(-75, -375, 675, -375, 100); v.fabric(-75, 375, 675, 375, 100); v.fabric(-75, -375, -75, 375, 100); v.fabric(675, -375, 675, 375, 100); v.bar([[180, 362], [450, 362]]); v.bar([[180, -362], [450, -362]]);
      v.circ(xc, 0, D / 2, 'S-EXIST'); v.spike(xc, D / 2 + 60, xc, 50); v.spike(xc, -D / 2 - 60, xc, -50); v.spike(xc + D / 2 + 70, 0, xc + 60, 0);
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([i, j]) => { v.circ(xc + i * 120, j * 160, 20, 'S-REO'); v.barEnd(xc + i * 120, j * 160, 20); });
      v.dim(-150, -450, 750, -450, -26, '900'); v.dim(750, -450, 750, 450, 12, '900'); v.dim(-150, -450, 0, -450, -14, '150'); v.dim(-260, 450, -260, 410, -4, '40'); v.dim(-340, 450, -340, 355, -6, '95 CLEAR', { sub: 'COVER' });
      v.line(750, -450, 690, -390, 'S-DIM'); v.text(820, -520, '40', 2.0, 'c'); v.text(820, -590, 'COVER', 2.0, 'c'); v.line(750, -450, 800, -500, 'S-DIM');
      v.leader(0, 650, -16, 20, 'EXTERNAL FACE OF\nEXISTING TIMBER\nSHEETING'); v.leader(-20, 470, 18, 26, 'IF TIMBER SHEETING OCCURS AT\nCONCRETE POT CUT AND KEY-IN\nTIMBER INTO CONCRETE AS SHOWN.\nAPPLIES TO SECTION (A) ONLY.\n(TYP)');
      v.leader(xc - 20, 0, -40, 4, 'EXISTING TIMBER PILE', { dot: true }); v.leader(-150, -150, -14, 6, 'PERMANENT FORMWORK\nTO STABILISE EXCAVATION'); v.leader(xc - 120, -160, -30, -12, '4-N20'); v.leader(xc + D / 2 + 20, 0, 22, -40, 'φ10x250' + ' LONG\nSPIKE (TYP)'); v.leader(750, 200, 16, 14, 'SL81 FABRIC (TYP) MESH\nCAN BE PREFABRICATED\n' + (bolt ? 'INTO' : 'IN') + ' 2400 LENGTHS AND\nCUT TO SUIT ON SITE');
    }, 'SECTION A');
    // ---------------- SECTION B (plan at the bearing)
    const secB = vblk(20, (v, B) => {
      v.rect(0, -450, 750, 900, 'S-CONC'); v.line(-75, -650, -75, 650, 'S-EXIST'); v.line(0, -650, 0, 650, 'S-EXIST'); v.brk(-90, 650, 15, 650, 'S-EXIST'); v.brk(-90, -650, 15, -650, 'S-EXIST'); eHatch(v, -125, -300, 50, 600); eHatch(v, 150, 450, 250, 40); eHatch(v, 150, -490, 250, 40); eHatch(v, 750, -200, 40, 400);
      v.fabric(25, -375, 675, -375, 100); v.fabric(25, 375, 675, 375, 100); v.fabric(25, -375, 25, 375, 100); v.fabric(675, -375, 675, 375, 100); v.bar([[300, 362], [480, 362]]); v.bar([[300, -362], [480, -362]]);
      v.circ(xc, 0, D / 2, 'S-HIDDEN'); iSec(v, xc, 0, s, 1);
      if (bolt) { [-1, 1].forEach(k => { const x0 = xc + k * s.d / 2; v.rect(min(x0, x0 + k * 100), -150, 100, 300, 'S-NEW'); [-70, 70].forEach(y => v.bolt(x0 - k * s.tf, y, x0 + k * 10, y, 20)); }); v.rect(xc - 75, -75, 150, 150, 'S-HIDDEN'); v.rect(xc - 45, -45, 90, 90, 'S-NEW'); v.circ(xc + s.d / 2 + 50, -40, 12, 'S-BOLT'); v.circ(xc - s.d / 2 - 50, 40, 12, 'S-BOLT');
        v.dim(-180, 0, -180, 70, 6, '70'); v.dim(-180, -70, -180, 0, 6, '70'); [70, 0, -70].forEach(y => v.line(-200, y, xc - s.d / 2 - 100, y, 'S-DIM'));
        v.leader(xc + s.d / 2 + 60, 100, 30, 6, ''); { const q = v.P(xc + s.d / 2 + 60, 100); nbox(B, q[0] + 32.5, q[1] + 16, '150x100x10 UAx300 LONG,\n2-M20 BOLTS.\nNOTE: ANGLES SHALL BEAR\nON SOLID TIMBER.\nIF PILE DIAMETER IS LESS\nTHAN 350 THEN ANGLE LEGS\nSHALL BE TURNED INWARDS\nUNDER UC PILE AS SHOWN\nIN DETAIL (1)', 50, { solid: true }); } v.leader(xc + s.d / 2 + 50, -40, 34, -26, 'φ10x100 LONG SPIKE (TYP)'); v.leader(xc - s.d / 2 - 100, -120, -16, -26, 'BEARING PLATE\n(FOR PILE > φ350)'); v.leader(xc + 20, -60, 6, -40, un + ' PILE WITH HOLES FOR\nM20 BOLTS DRILLED ON SITE\nAFTER SHIM IS IN PLACE.\nNOTE: CUT POT END OF PILE ON\nSITE TO SUIT.');
        v.leader(xc, 20, -24, 44, 'SHIM BETWEEN UC AND BEARING PLATE\nFOR PILE > φ350 OR BETWEEN UC AND\nUA\'s FOR PILE < φ350 TO ENSURE A\nTIGHT FIT BETWEEN CUT PILE FACE\nAND FULLCAPS.'); }
      else { v.rect(xc - 125, -125, 250, 250, 'S-NEW'); v.rect(xc - 45, -45, 90, 90, 'S-HIDDEN'); [[xc - 40, 60], [xc + 40, -60]].forEach(([x, y]) => { v.circ(x, y, 14, 'S-BOLT'); v.circ(x, y, 3, 'S-BOLT'); });
        v.leader(xc - 40, 60, 22, 18, 'φ10x100 LONG\nSPIKE (TYP)'); v.leader(xc + 125, 40, 22, 6, '250x12FLx250 BASE PLATE\nWITH 2-φ12 HOLES FOR SPIKES.\nPROVIDE UNIFORM SEATING\nSQUARE TO AXIS OF PILE.\nSHIM BETWEEN BASE PLATE\nAND TIMBER PILE TO ENSURE\nTIGHT FIT BETWEEN CUT PILE\nFACE AND FULLCAPS.'); v.leader(xc, -30, 8, -40, 'SHIM 90x90x\nTHICKNESS TO\nSUIT');
        v.weld(xc + 125, -125, 14, -26, { size: '6', all: true, site: true }); }
      v.dim(0, 450, 750, 450, 26, '750'); v.dim(0, 450, cv, 450, 14, '60 MIN *'); v.leader(25, bolt ? -150 : -250, -24, bolt ? -4 : -12, 'SL81 FABRIC (GALV)\n25 COVER'); v.leader(-75, -600, -14, bolt ? -16 : -4, 'EXISTING TIMBER\nSHEETING');
      v.text(330, 1500, '* IF LESS THAN 60, THEN RELOCATE SL81', 2.2); v.mtext(400, 1500 - 2.2 * 1.55 * 20, 'FABRIC, 4 - N20 VERTICAL BARS AND\nTOP N16 PERIMETER BAR TO INSIDE OF\nOF FLANGE. TRIM FABRIC TO SUIT.\nPROVIDE φ60 HOLES AT 200 CRS\nVERTICALLY IN WEB FOR N16 AND\nADDITIONAL N12 x 650 LONG BARS.', 2.2);
    }, 'SECTION B');
    // ---------------- φ60 holes sketch + SECTION C
    const holes = vblk(20, (v) => { v.rect(0, -270, 380, 540, 'S-CONC'); iSec(v, 40, 0, s, 1); v.fabric(70, -240, 70, 240, 90); v.bar([[70, 240], [70, 270 - 30], [200, 270 - 30]]); v.bar([[70, -240], [200, -240]]); v.bar([[150, -280], [150, 280]]); v.barEnd(70, 240, 12); v.barEnd(70, -240, 12);
      v.leader(80, 0, 14, 40, 'φ60 HOLES AT 200 CRS'); v.leader(150, -100, 34, -6, 'ADDITIONAL N12 x\n650 LONG BARS.'); });
    const secC = vblk(20, (v) => { v.line(-75, -420, -75, 420, 'S-EXIST'); v.line(0, -420, 0, 420, 'S-EXIST'); v.brk(-90, 420, 15, 420, 'S-EXIST'); v.brk(-90, -420, 15, -420, 'S-EXIST'); eHatch(v, -125, -300, 50, 600);
      v.rect(0, -150, cv, 300, 'S-NEW'); v.line(5, 165, 60, 210, 'S-NEW'); v.line(5, -165, 60, -210, 'S-NEW'); iSec(v, xc, 0, s, 1);
      v.leader(-40, 250, -14, 6, 'EXISTING\nTIMBER\nSHEETING'); v.leader(xc + s.d / 2, s.b / 2, 16, 14, un); v.leaders([[40, -190], [50, -150]], 20, -26, 'PACK WITH SOLID TIMBER FOR FULL\nHEIGHT OF REPLACED TIMBER PILE\nABOVE CONCRETE SURROUND.\nSECURE PACKER TO TIMBER SHEETING'); }, 'SECTION C');
    // ---------------- BEARING ARRANGEMENT FOR PILES < φ350 (Type 1A)
    let bear = null;
    if (bolt) { const B = new Builder(), v = B.view(10, 0, 0), Dp = 300, h = s.d / 2;
      v.line(-Dp / 2, -10, -Dp / 2, -700, 'S-EXIST'); v.line(Dp / 2, -10, Dp / 2, -700, 'S-EXIST'); v.line(-Dp / 2, -10, Dp / 2, -10, 'S-EXIST'); v.pileEnd(0, -760, Dp, 'S-EXIST');
      [-h, -h + s.tf, h - s.tf, h].forEach(x => v.line(x, 18, x, 700, 'S-NEW')); v.brk(-h - 15, 700, h + 15, 700, 'S-NEW'); v.rect(-45, 8, 90, 10, 'S-NEW');
      [-1, 1].forEach(k => { aSec(v, k * (h + 10), -2, 100 + 10, 150, 10, -k, 1); v.bolt(k * (h - s.tf), 90, k * (h + 10), 90, 20); v.spike(k * 50, 8, k * 50, -90); });
      v.dim(-Dp / 2, -860, Dp / 2, -860, -6, 'φ < 350'); v.dim(-Dp / 2, -300, -50, -300, -4, '55', { sub: '(TYP)' });
      v.line(-340, -700, -340, 500, 'S-EXIST'); v.line(-260, -200, -260, 500, 'S-EXIST'); v.line(-260, -200, -200, -200, 'S-EXIST'); v.line(-200, -200, -200, 500, 'S-EXIST'); v.fill([[-360, -700], [-340, -700], [-340, 150], [-360, 150]], 'S-NEW'); eHatch(v, -420, 50, 60, 400); eHatch(v, -420, -500, 60, 300);
      v.line(-h, 500, -200, 500, 'S-CONC'); v.line(h, 500, 700, 500, 'S-CONC'); v.line(Dp / 2, -700, 700, -700, 'S-CONC'); v.line(700, -700, 700, 500, 'S-CONC'); v.brk(700, -150, 700, -50, 'S-CONC'); v.brk(450, 500, 540, 500, 'S-CONC');
      v.hatch([[330, 80], [560, 80], [560, 300], [330, 300]], 'conc', 'S-HATCH'); v.hatch([[330, -480], [560, -480], [560, -260], [330, -260]], 'conc', 'S-HATCH');
      v.leader(10, 12, -10, 26, 'SHIM 90x90x\nTHICKNESS\nTO SUIT'); v.leader(h, 700, 12, 10, 'PROPOSED UC PILE'); v.leader(-h - 10, 140, -30, 8, '150x100x10 UA\nx300 LONG (TYP)'); v.leader(50, -60, 26, 3, 'φ10x100 LONG\nSPIKE (TYP)'); v.leader(480, 380, 10, 0, 'PROPOSED\nCONCRETE\nPOT', { dot: true }); v.leader(Dp / 2 - 20, -540, 14, -4, 'EXISTING TIMBER\nPILE', { dot: true });
      const b = bbox(B.E); dtitle(B, b.x0 + 20, b.y0 - 12, ['BEARING ARRANGEMENT FOR', 'PILES < φ350'], { ref: '', drg: false, scale: 10, sub: ['PIER N° X - PILE N° X', 'PIER N° X - PILE N° X'] }); bear = B.E; }
    // ---------------- notes / title
    const NB = new Builder();
    const h1 = nbox(NB, 0, 0, bolt ? 'FULLCAPS SHALL BE PROPPED DURING\nCONSTRUCTION TO THEIR ORIGINAL\nPOSITION AND ABUTMENT SHEETING IS\nTO BE SAFELY PROPPED.\nDO NOT REMOVE PROPS UNTIL\nPROPOSED PILE IS IN POSITION AND\nCONCRETE HAS BEEN PLACED FOR A\nMINIMUM OF 3 DAYS.' : 'FULLCAPS SHALL BE PROPPED\nDURING CONSTRUCTION TO THEIR\nORIGINAL POSITION AND\nABUTMENT SHEETING IS TO BE\nSAFELY PROPPED.\nDO NOT REMOVE PROPS UNTIL\nPROPOSED PILE IS IN POSITION\nAND CONCRETE HAS BEEN\nPLACED A MIN OF THREE DAYS.', 58, { solid: true });
    nbox(NB, 0, -h1 - 8, 'THIS DETAIL SHALL BE READ IN CONJUNCTION WITH THE STEEL ABUTMENT PILE/TIMBER FULLCAP BEARING DETAILS.\n \nPROPOSED PILE & POT SIZE WILL VARY ACCORDING TO ENGINEERING REQUIREMENTS INCLUDING HEIGHT OF PILE ABOVE GROUND (' + un + ' SHOWN).', 92);
    const TB = new Builder(); const sy = dtitle(TB, 0, 0, ['ABUTMENT PILE REPAIR DETAIL - TYPE ' + (bolt ? '1A' : '1')], { bullet: 'sq', sub: ['ABUTMENT N° X  -  PILE N° X'] });
    const hh = obox(TB, 30, sy - 4, bolt ? 'BOLTED OPTION' : 'WELDED OPTION', 3.0); nbox(TB, 26, sy - 10 - hh, 'ENGINEER SHALL DECIDE WHICH\nOPTION TO USE', 50);
    return stack([row([secB, stack([holes, secC], 10)], 24), row([secA, NB.E], 24), row([stack([elev, TB.E], 6)].concat(bear ? [bear] : []), 26)], 16);
  }
  function secMarkCirc(v, B, x, y, ch) { const p = v.P(x, y); B.E.push({ t: 'circle', c: p, r: 3, L: 'S-TEXT' }); T1(B, p[0], p[1] - 1.1, ch, 2.6, 'c'); }
  const t1P = [P('D', 'Existing pile dia. (mm)', 350, { num: 1 }), P('uc', 'Steel pile', '200UC52', { opts: UCs })];
  def('pn2122', 'Abutments', 'Abutment pile repair – Type 1 (welded base plate, concrete pot)', 'PN30-2122', t1P, (p) => abType1(p, false),
    'Abutment pile replaced by a steel UC on a welded base plate over the cut-back timber pile, cast in a 900 square reinforced concrete pot; fullcaps and sheeting propped.');
  def('pn2123', 'Abutments', 'Abutment pile repair – Type 1A (bolted angles, concrete pot)', 'PN30-2123', t1P, (p) => abType1(p, true),
    'Bolted option of PN30-2122: the UC bears on the timber pile through 150x100x10 angles and a bearing plate (angles turned inwards for piles < φ350).');

  // ================================================================== PN30-2124 abutment pile repair Type 2 (150 PFC in a concrete column / pot, h ≤ 1000)
  def('ap2', 'Abutments', 'Abutment pile repair – Type 2 (150 PFC in concrete pot, h ≤ 1000)', 'PN30-2124', [P('D', 'Existing pile dia. (mm)', 350, { num: 1 }), P('h', 'Height G.L. to underside of fullcap (mm)', 900, { num: 1 })], (p) => {
    const D = +p.D || 350, h = max(400, min(1000, +p.h || 900)), c = SEC['150PFC'], xw = -375, xp = -190, yB = -1250, yL = -500, yT = h - 20, pfT = h + 280, pfB = pfT - 600;
    // ---------------- SECTION A (through the column, above the lower pot)
    const secA = vblk(20, (v) => {
      v.rect(-750, -450, 750, 900, 'S-CONC'); v.line(0, -650, 0, 650, 'S-EXIST'); v.line(75, -650, 75, 650, 'S-EXIST'); v.brk(-15, 650, 90, 650, 'S-EXIST'); v.brk(-15, -650, 90, -650, 'S-EXIST'); eHatch(v, 75, 100, 50, 250); eHatch(v, 75, -350, 50, 250);
      v.fabric(-675, -375, -75, -375, 100); v.fabric(-675, 375, -75, 375, 100); v.fabric(-675, -375, -675, 375, 100); v.fabric(-75, -375, -75, 375, 100); v.bar([[-480, 362], [-260, 362]]); v.bar([[-480, -362], [-260, -362]]);
      cSec(v, xw, 0, c, 1); v.fill([[xw, -75], [xw + c.tw, -75], [xw + c.tw, 75], [xw, 75]], 'S-NEW'); v.circ(xp, 0, D / 2, 'S-HIDDEN'); v.circ(-100, -250, 22, 'S-REO'); v.barEnd(-100, -250, 20);
      v.dim(-1000, -450, -1000, 450, 8, '900'); v.dimChain([[-880, -450], [-880, 0], [-880, 450]], 6, ['=', '=']); v.line(-1200, 0, xw, 0, 'S-CL'); v.text(-1250, 0, '℄ 150 PFC & PILE', 2.4, 'c', 'b', 'S-TEXT', 90); v.dim(-750, -450, 0, -450, -18, '750');
      v.weld(xw, 75, -18, 22, { size: '6', all: true }); v.leader(75, 550, 12, 6, 'EXISTING TIMBER\nSHEETING'); v.leader(xp + D / 2, 80, 22, 12, 'LOCATION OF\nEXISTING PILE\nBELOW'); v.leader(xw + c.b, 0, 36, -4, '150 PFC'); v.leader(-100, -250, 30, -10, 'N20'); v.leader(-750, -450, -10, -10, 'SL81 FABRIC\n(TYP)');
    }, 'SECTION A');
    // ---------------- SECTION B (lower pot)
    const secB = vblk(20, (v) => {
      v.rect(-750, -450, 900, 900, 'S-CONC'); v.fill([[150, -450], [165, -450], [165, 450], [150, 450]], 'S-NEW');
      [[450, 650], [-650, -450]].forEach(([y1, y2]) => { v.line(0, y1, 0, y2, 'S-EXIST'); v.line(75, y1, 75, y2, 'S-EXIST'); }); v.rect(0, 450, 75, 40, 'S-EXIST'); v.rect(0, -490, 75, 40, 'S-EXIST'); v.brk(-15, 650, 90, 650, 'S-EXIST'); v.brk(-15, -650, 90, -650, 'S-EXIST');
      eHatch(v, -500, 450, 300, 40); eHatch(v, -500, -490, 300, 40); eHatch(v, -800, -350, 40, 700); eHatch(v, 165, -350, 40, 700);
      v.fabric(-675, -375, 75, -375, 100); v.fabric(-675, 375, 75, 375, 100); v.fabric(-675, -375, -675, 375, 100); v.fabric(75, -375, 75, 375, 100); v.bar([[-480, 362], [-260, 362]]); v.bar([[-480, -362], [-260, -362]]);
      v.circ(xp, 0, D / 2, 'S-EXIST'); v.spike(xp, D / 2 + 70, xp, 40); v.spike(xp, -D / 2 - 70, xp, -40); v.spike(xp - D / 2 - 70, 0, xp - 40, 0); v.circ(-100, -250, 22, 'S-REO'); v.barEnd(-100, -250, 20);
      v.dim(-750, -450, 150, -450, -22, '900'); v.dim(0, -450, 150, -450, -12, '150'); v.dim(-900, -450, -900, 450, 8, '900'); v.dim(300, 450, 300, 410, -4, '40'); v.dim(400, 450, 400, 355, -4, ' '); v.text(440, 330, '95 COVER', 2.2);
      v.line(-750, -450, -810, -510, 'S-DIM'); v.text(-700, -560, '40', 2.0, 'c'); v.text(-700, -630, 'COVER', 2.0, 'c');
      v.leader(0, 700, -14, 6, 'EXTERNAL FACE\nOF EXISTING\nTIMBER SHEETING'); v.leader(xp - 60, 0, -20, 28, 'φ10x250 LONG\nSPIKE (TYP)'); v.leader(60, 470, 16, 34, 'IF TIMBER SHEETING OCCURS\nAT CONCRETE POT CUT\nAND KEY-IN TIMBER INTO\nCONCRETE AS SHOWN.\nAPPLIES SECTION (B) ONLY.\n(TYPICAL)');
      v.leader(165, 0, 16, -4, 'PERMANENT FORMWORK TO\nSTABILISE EXCAVATION'); v.leader(-100, -250, 30, -12, 'N20'); v.leader(-750, -450, -10, -12, 'SL81 FABRIC\n(TYP)');
    }, 'SECTION B');
    // ---------------- ELEVATION
    const elev = vblk(20, (v, B) => {
      const fT = h + 300, dk = fT + 420;
      v.line(0, -1500, 0, dk + 100, 'S-EXIST'); v.line(75, -1500, 75, dk + 100, 'S-EXIST'); v.brk(-15, -1500, 90, -1500, 'S-EXIST'); eHatch(v, 75, -250, 50, 600);
      for (let x = -800; x < 75; x += 160) v.rect(x, dk, min(160, 75 - x), 100, 'S-EXIST'); v.brk(-800, dk - 20, -800, dk + 120, 'S-EXIST'); v.pileEnd(-560, (fT + dk) / 2, dk - fT, 'S-EXIST', 1); v.line(-560, fT, -300, fT, 'S-EXIST');
      v.rect(-300, h, 300, 300, 'S-EXIST'); v.rect(-130, h, 130, 300, 'S-NEW'); v.timberHatch([[-130, h], [0, h], [0, h + 300], [-130, h + 300]]);
      v.pl([[-750, yB], [150, yB], [150, yL], [0, yL], [0, yT], [-750, yT - 20]], true, 'S-CONC'); v.fill([[150, yB], [165, yB], [165, yL], [150, yL]], 'S-NEW');
      v.rect(xw, pfB, c.b, 600, 'S-NEW'); v.line(xw + c.tw, pfB, xw + c.tw, pfT, 'S-HIDDEN'); v.rect(xw - 8, pfB - 10, 90, 10, 'S-NEW'); [h + 190, h + 90].forEach(y => rodSide(v, xw, 0, y, 20));
      pileElev(v, xp, -1700, yL, D); v.line(xp - D / 2, yL, xp + D / 2, yL, 'S-EXIST'); v.ground(-1200, -750, 0); v.ground(-600, -300, yB);
      v.fabric(-675, yB + 75, -675, yT - 95, 110); [[-675, yB + 75], [-675, yT - 95]].forEach(q => bar16(v, ...q)); v.fabric(-75, -560, -75, yT - 75, 110); v.fabric(75, yB + 75, 75, yL - 60, 110); v.bar([[-110, yB + 70], [-110, yB + 1570]]);
      v.spike(-430, -875, -250, -875);
      v.dim(-1000, yB, -1000, 0, 8, '1250 MIN'); v.dim(-1000, 0, -1000, h, 8, '1000 MAX'); v.dim(-850, h, -850, pfT, 6, ' '); { const q = v.P(-850, (h + pfT) / 2); } v.dim(-900, pfB, -900, pfT, 6, '600'); v.dim(-800, pfB, -800, pfB + 400, 6, '400'); v.dim(-650, pfB, -650, yT, 6, '300'); v.dim(-560, yT - 20, -560, yT, 6, '20'); v.dim(-450, h + 280, -450, h + 330, -4, '50');
      v.dim(-850, yB, -850, yL, 8, '750'); v.dimChain([[-780, yB], [-780, (yB + yL) / 2], [-780, yL]], 5, ['=', '=']); v.dim(-60, yB + 1570, -60, yB + 920, 6, '650 MIN LAP'); v.dim(300, yL, 300, yL + 100, -4, ' ');
      v.dim(150, yB - 120, 75, yB - 120, 2, ' '); { const q = v.P(165, yB - 120); T1(B, q[0] + 2, q[1] + 0.8, '75 CLEAR', 2.2); L1(B, q[0] + 1, q[1], q[0] + 19, q[1]); T1(B, q[0] - 1, q[1] - 3.4, 'COVER (TYP)', 2.2); }
      v.text(-560, yT + 60, 'U2', 2.2, 'c'); v.line(-580, yT + 25, -560, yT + 5, 'S-TEXT'); v.line(-560, yT + 5, -540, yT + 25, 'S-TEXT'); { const q = v.P(-780, -700); T1(B, q[0] - 4, q[1] - 1, '4', 2.2); L1(B, q[0], q[1], q[0] - 1.6, q[1] + 1.6); L1(B, q[0], q[1], q[0] - 1.6, q[1] - 1.6); }
      [[420, 'A'], [-560, 'B']].forEach(([y, ch]) => { v.mark(1250, y, ch, -90); const pp = v.P(1250, y); v.add({ t: 'line', a: [pp[0] - 3, pp[1]], b: [pp[0] - 10, pp[1]], L: 'S-TITLE' }); const ql = v.P(-1650, y); v.add({ t: 'line', a: ql, b: [ql[0] + 12, ql[1]], L: 'S-TITLE' }); v.add({ t: 'solid', p: [[ql[0], ql[1]], [ql[0] + 7, ql[1]], [ql[0] + 3, ql[1] - 1.6]], L: 'S-TEXT' }); });
      v.leader(-400, dk + 100, -6, 14, 'EXISTING TIMBER\nDECK'); v.leader(-560, fT + 250, -14, 10, 'EXISTING TIMBER\nSTRINGER', { dot: true }); v.leader(75, dk, 12, 14, 'EXISTING TIMBER\nSHEETING'); v.leader(-250, h + 300, 26, 22, 'EXISTING TIMBER FULLCAP');
      v.leader(-80, h + 190, 22, 14, 'φ20 THREADED ROD\nWITH 65x5FLx65 WASHER\n(TYP)'); v.leader(-60, h + 150, 26, -2, 'PROVIDE 2 SOLID TIMBER\nPACKERS x 200 WIDE EACH\nSIDE OF THREADED RODS', { dot: true }); v.leaders([[xw + c.b, pfB + 100], [xw + c.b, pfB - 5]], 34, -22, '150 PFC WITH 90x10 FLx165 END\nPLATE');
      v.leader(-675, yT - 95, -12, -10, 'N16, 500 LAP'); barIcon(v, -560, yT - 470); v.leader(-675, -300, -14, -4, 'SL81 FABRIC\n(TYP)'); v.leader(-675, yB + 75, -12, -10, 'N16, 500 LAP'); barIcon(v, -560, yB - 260);
      v.leader(-110, 0, 26, 4, '4-N20x1500 LONG'); v.leader(165, -900, 12, -6, 'PERMANENT FORMWORK'); v.leader(xp + 40, yL, -24, -66, 'CUTBACK EXISTING TIMBER\nPILE TO SOUND TIMBER - 250\nMIN BELOW EXISTING G.L.');
      { const q = v.P(300, yL + 50); T1(B, q[0] + 3, q[1] + 4, '100 MIN. TO SUIT', 2.2); T1(B, q[0] + 3, q[1] + 0.6, 'EXISTING TIMBER', 2.2); T1(B, q[0] + 3, q[1] - 2.8, 'SHEETING', 2.2); }
      // designer's note box tied to the 1000 MAX dimension
      { const q = v.P(-1000, h / 2), bx = q[0] - 66; nbox(B, bx, q[1] + 20, 'THIS DETAIL ONLY TO\nBE USED WHERE THIS\nDIMENSION IS 1000 OR\nLESS', 36); B.E.push({ t: 'pl', p: [[q[0] - 12, q[1] - 8], [q[0] - 6.8, q[1] - 8], [q[0] - 6.8, q[1] + 8], [q[0] - 12, q[1] + 8]], closed: true, L: 'S-NOTE' }); L1(B, bx + 36, q[1] + 12, q[0] - 12, q[1] + 4, 'S-NOTE'); }
    }, 'ELEVATION');
    const NB = new Builder(); nbox(NB, 0, 0, 'FULLCAPS SHALL BE PROPPED\nDURING CONSTRUCTION TO\nTHEIR ORIGINAL POSITIONS\nAND ABUTMENT SHEETING IS\nTO BE SAFELY PROPPED.\nPROPPING IS TO BE REMOVED\nONLY AFTER CONCRETE HAS\nBEEN PLACED A MIN OF THREE\nDAYS.', 52, { solid: true });
    const TB = new Builder(); dtitle(TB, 0, 0, ['ABUTMENT PILE REPAIR DETAIL - TYPE 2'], { bullet: 'cross', sub: ['ABUTMENT N° X  -  PILE N° X'] });
    return stack([row([secA, secB], 24), row([stack([elev, TB.E], 6), NB.E], 20)], 16);
  }, 'Abutment pile repair where the height from ground to the fullcap underside is 1000 or less: a 150 PFC fixed to the fullcap is cast into a reinforced concrete pot over the cut-back pile.');
})(typeof window !== 'undefined' ? window : globalThis);
