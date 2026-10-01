/* StructCap 3D — dependency-free canvas renderer (painter's algorithm, flat shading)
   and the sign-gantry scene with a nominal fatigue stress-range contour.
   World axes: x along the arm, y = wind direction, z up. Model units: metres. */
(function (G) {
  'use strict';
  const PI = Math.PI;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // ------------------------------------------------------------------ colour maps
  const STOPS = [[0, [38, 84, 196]], [0.25, [30, 170, 214]], [0.5, [52, 190, 110]], [0.75, [245, 200, 40]], [1, [226, 60, 50]]];
  function ramp(t) {
    if (!(t >= 0)) t = 0;
    if (t > 1.0001) return [200, 40, 190];
    for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i], k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map(j => c0[j] + (c1[j] - c0[j]) * k);
    }
    return STOPS[STOPS.length - 1][1];
  }
  const hex = h => { h = h.trim().replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

  // ------------------------------------------------------------------ mesh
  class Mesh {
    constructor() { this.t = []; this.l = []; this.tag = ''; this.alpha = null; }
    tri(a, b, c, col, sa, sb, sc) { const t = { p: [a, b, c], col, s: sa == null ? null : [sa, sb, sc], tag: this.tag }; if (this.alpha != null) t.a = this.alpha; this.t.push(t); }
    line(a, b, col, w) { this.l.push({ p: [a, b], col, w: w || 1.2 }); }
    // cylinder between two points (radius r), scalar s for colouring and picking
    rod(a, b, r, col, s, n) {
      const d = norm(sub(b, a)), ref = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], e1 = norm(cross(d, ref)), e2 = cross(d, e1), v = sub(b, a);
      this.tube(circle(r, n || 10), [0, 1], (u, w, t) => [0, 1, 2].map(k => a[k] + t * v[k] + u * e1[k] + w * e2[k]), col, s ? () => s : null, true);
    }
    // bottle-shaped strut: circular section, radius r0 at a, r1 at b, bulging by rb at mid-length
    bottle(a, b, r0, r1, rb, col, s, nst, nseg) {
      nst = nst || 14; nseg = nseg || 18;
      const d = norm(sub(b, a)), ref = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], e1 = norm(cross(d, ref)), e2 = cross(d, e1), v = sub(b, a);
      const rows = [];
      for (let i = 0; i <= nst; i++) {
        const t = i / nst, r = r0 * (1 - t) + r1 * t + rb * Math.sin(PI * t);
        rows.push(Array.from({ length: nseg }, (_, j) => { const an = 2 * PI * j / nseg, c = r * Math.cos(an), w = r * Math.sin(an); return [0, 1, 2].map(k => a[k] + t * v[k] + c * e1[k] + w * e2[k]); }));
      }
      for (let i = 0; i < nst; i++) for (let j = 0; j < nseg; j++) { const k = (j + 1) % nseg; this.quad(rows[i][j], rows[i][k], rows[i + 1][k], rows[i + 1][j], col, s, s, s, s); }
      [0, nst].forEach(i => { for (let j = 0; j < nseg; j++) this.tri(i ? b : a, rows[i][j], rows[i][(j + 1) % nseg], col, s, s, s); });
    }
    // octahedron marker
    blob(c, r, col, s) {
      const P = [[r, 0, 0], [-r, 0, 0], [0, r, 0], [0, -r, 0], [0, 0, r], [0, 0, -r]].map(q => [c[0] + q[0], c[1] + q[1], c[2] + q[2]]);
      [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]].forEach(([i, j, k]) => this.tri(P[i], P[j], P[k], col, s, s, s));
    }
    quad(a, b, c, d, col, sa, sb, sc, sd) { this.tri(a, b, c, col, sa, sb, sc); this.tri(a, c, d, col, sa, sc, sd); }
    // extrude closed profile [[a,b],...] along stations; place(a,b,t) -> [x,y,z]; sf(x,y,z) -> scalar|null
    tube(prof, stations, place, col, sf, caps) {
      const n = prof.length, rows = stations.map(t => prof.map(([a, b]) => place(a, b, t)));
      const sv = sf ? rows.map(r => r.map(p => sf(p))) : null;
      for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < n; j++) {
        const k = (j + 1) % n;
        if (sv) this.quad(rows[i][j], rows[i][k], rows[i + 1][k], rows[i + 1][j], col, sv[i][j], sv[i][k], sv[i + 1][k], sv[i + 1][j]);
        else this.quad(rows[i][j], rows[i][k], rows[i + 1][k], rows[i + 1][j], col);
      }
      if (caps) [0, rows.length - 1].forEach(i => { const c = rows[i].reduce((m, p) => [m[0] + p[0] / n, m[1] + p[1] / n, m[2] + p[2] / n], [0, 0, 0]); for (let j = 0; j < n; j++) this.tri(c, rows[i][j], rows[i][(j + 1) % n], col); });
    }
    // subdivided box (large faces split so the depth sort stays correct)
    slab(c, h, col, n) {
      const P = (i, j, k) => [c[0] + i * h[0], c[1] + j * h[1], c[2] + k * h[2]];
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        const i0 = -1 + 2 * a / n, i1 = -1 + 2 * (a + 1) / n, j0 = -1 + 2 * b / n, j1 = -1 + 2 * (b + 1) / n;
        this.quad(P(i0, j0, 1), P(i1, j0, 1), P(i1, j1, 1), P(i0, j1, 1), col);
        this.quad(P(i0, j0, -1), P(i1, j0, -1), P(i1, j1, -1), P(i0, j1, -1), col);
      }
      for (let a = 0; a < n; a++) {
        const t0 = -1 + 2 * a / n, t1 = -1 + 2 * (a + 1) / n;
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([sx, sy]) => sx ? this.quad(P(sx, t0, -1), P(sx, t1, -1), P(sx, t1, 1), P(sx, t0, 1), col) : this.quad(P(t0, sy, -1), P(t1, sy, -1), P(t1, sy, 1), P(t0, sy, 1), col));
      }
    }
    // disc (cylinder) centred at c, radius R, half height hz; faces split into rings / sectors for the depth sort
    disc(c, R, hz, col, nr, nt) {
      nr = nr || 4; nt = nt || 40;
      const P = (rr, k, z) => [c[0] + rr * Math.cos(2 * PI * k / nt), c[1] + rr * Math.sin(2 * PI * k / nt), c[2] + z];
      for (let i = 0; i < nr; i++) for (let k = 0; k < nt; k++) {
        const r0 = R * i / nr, r1 = R * (i + 1) / nr;
        [hz, -hz].forEach(z => i === 0 ? this.tri([c[0], c[1], c[2] + z], P(r1, k, z), P(r1, k + 1, z), col) : this.quad(P(r0, k, z), P(r1, k, z), P(r1, k + 1, z), P(r0, k + 1, z), col));
      }
      for (let k = 0; k < nt; k++) this.quad(P(R, k, -hz), P(R, k + 1, -hz), P(R, k + 1, hz), P(R, k, hz), col);
    }
    // convex polygon poly [[r,z],...] in the plane spanned by nr (horizontal) and z, extruded ±th/2 along nt
    prism(o, nr, nt, poly, th, col, sf) {
      const P = ([rr, zz], k) => [o[0] + rr * nr[0] + k * th / 2 * nt[0], o[1] + rr * nr[1] + k * th / 2 * nt[1], o[2] + zz];
      const A = poly.map(p => P(p, -1)), B = poly.map(p => P(p, 1)), n = poly.length;
      const S = sf ? [A.map(p => sf(p)), B.map(p => sf(p))] : null;
      for (let i = 1; i < n - 1; i++) {
        if (S) { this.tri(A[0], A[i], A[i + 1], col, S[0][0], S[0][i], S[0][i + 1]); this.tri(B[0], B[i + 1], B[i], col, S[1][0], S[1][i + 1], S[1][i]); }
        else { this.tri(A[0], A[i], A[i + 1], col); this.tri(B[0], B[i + 1], B[i], col); }
      }
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; S ? this.quad(A[i], A[j], B[j], B[i], col, S[0][i], S[0][j], S[1][j], S[1][i]) : this.quad(A[i], A[j], B[j], B[i], col); }
    }
    // box from centre, half sizes along its local axes ex, ey, ez (unit vectors)
    box(c, h, ex, ey, ez, col, sf) {
      const P = (i, j, k) => [0, 1, 2].map(d => c[d] + i * h[0] * ex[d] + j * h[1] * ey[d] + k * h[2] * ez[d]);
      const v = [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)];
      const s = sf ? v.map(p => sf(p)) : null, F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
      F.forEach(f => s ? this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], col, s[f[0]], s[f[1]], s[f[2]], s[f[3]]) : this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], col));
    }
  }
  const circle = (r, n) => Array.from({ length: n }, (_, i) => [r * Math.cos(2 * PI * i / n), r * Math.sin(2 * PI * i / n)]);
  function roundRect(w, h, r, nc) {
    const pts = [], cx = [w / 2 - r, -w / 2 + r, -w / 2 + r, w / 2 - r], cy = [h / 2 - r, h / 2 - r, -h / 2 + r, -h / 2 + r];
    for (let q = 0; q < 4; q++) for (let i = 0; i <= nc; i++) { const a = q * PI / 2 + i * PI / 2 / nc; pts.push([cx[q] + r * Math.cos(a), cy[q] + r * Math.sin(a)]); }
    return pts;
  }
  const hexP = s => circle(s / Math.sqrt(3), 6);                        // hexagon, s = width across flats
  const FAST = d => ({ s: Math.max(1.5 * d, d + 0.008), m: 0.8 * d, mj: 0.5 * d, wd: 1.85 * d, wt: Math.max(0.003, 0.11 * d), k: 0.65 * d });
  // stack of fastener parts along a bolt axis: place(a, b, t) maps profile (a,b) and axial t
  function stack(m, place, t0, dir, parts, colNut, colW, sf) {
    let t = t0;
    parts.forEach(([kind, len, size]) => {
      const t1 = t + dir * len, prof = kind === 'w' ? circle(size / 2, 14) : hexP(size);
      m.tube(prof, dir > 0 ? [t, t1] : [t1, t], place, kind === 'w' ? colW : colNut, sf, true);
      t = t1;
    });
    return t;
  }
  const profileOf = (sec, n) => sec.shape === 'CHS' ? circle(sec.D / 2e3, n) : roundRect(sec.B / 1e3, sec.D / 1e3, Math.max(sec.ro, 0.001) / 1e3, Math.max(2, Math.round(n / 8)));

  // ------------------------------------------------------------------ viewer
  class Viewer {
    constructor(canvas, cam) {
      this.cv = canvas; this.mesh = null; this.cam = Object.assign({ yaw: -1.0, pitch: 0.3, dist: 12, tx: 0, ty: 0, tz: 3 }, cam || {});
      this.bg = [255, 255, 255]; this.lineCol = null; this.onchange = null;
      if (canvas.addEventListener) this.bind();
    }
    bind() {
      const cv = this.cv, pts = new Map();
      let mode = null, lx = 0, ly = 0, pd = 0, sx = 0, sy = 0, moved = false;
      cv.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; moved = pts.size > 0; cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); mode = (e.button === 2 || e.shiftKey || pts.size === 2) ? 'pan' : 'rot'; lx = e.clientX; ly = e.clientY; if (pts.size === 2) { const [a, b] = [...pts.values()]; pd = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
      cv.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        if (Math.hypot(e.clientX - sx, e.clientY - sy) > 4) moved = true;
        if (!moved) return;
        if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd) this.zoom(pd / d); pd = d; return; }
        const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
        if (mode === 'rot') { this.cam.yaw -= dx * 0.008; this.cam.pitch = Math.max(-1.45, Math.min(1.45, this.cam.pitch + dy * 0.008)); }
        else this.pan(dx, dy);
        this.draw();
      });
      const up = e => {
        const click = e.type === 'pointerup' && !moved && pts.size === 1 && mode === 'rot';
        pts.delete(e.pointerId);
        if (!pts.size) { mode = null; pd = 0; if (click) { const b = cv.getBoundingClientRect(); this.pick(e.clientX - b.left, e.clientY - b.top); } else if (this.onchange) this.onchange(this.cam); }
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.0012)); if (this.onchange) this.onchange(this.cam); }, { passive: false });
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('keydown', e => {
        const k = e.key, c = this.cam;
        if (k === 'ArrowLeft') c.yaw += 0.1; else if (k === 'ArrowRight') c.yaw -= 0.1; else if (k === 'ArrowUp') c.pitch = Math.min(1.45, c.pitch + 0.1); else if (k === 'ArrowDown') c.pitch = Math.max(-1.45, c.pitch - 0.1);
        else if (k === '+' || k === '=') this.zoom(0.85); else if (k === '-') this.zoom(1.18); else return;
        e.preventDefault(); this.draw(); if (this.onchange) this.onchange(this.cam);
      });
    }
    basis() {
      const c = this.cam, t = [c.tx, c.ty, c.tz];
      const pos = [t[0] + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw), t[1] + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), t[2] + c.dist * Math.sin(c.pitch)];
      const f = norm(sub(t, pos)), r = norm(cross(f, [0, 0, 1])), u = cross(r, f);
      return { pos, f, r, u };
    }
    pick(px, py) {
      const L = this.last || [];
      let hit = null;
      for (let i = L.length - 1; i >= 0 && !hit; i--) {
        const [a, b, c] = L[i].q, d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(d) < 1e-9) continue;
        const w0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d, w1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d, w2 = 1 - w0 - w1;
        if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) {
          const t = L[i].t, w = [w0, w1, w2], p = [0, 1, 2].map(k => w[0] * t.p[0][k] + w[1] * t.p[1][k] + w[2] * t.p[2][k]);
          const s = t.s ? { mpa: w[0] * t.s[0].mpa + w[1] * t.s[1].mpa + w[2] * t.s[2].mpa, ur: w[0] * t.s[0].ur + w[1] * t.s[1].ur + w[2] * t.s[2].ur } : null;
          hit = { p, s, tag: t.tag };
        }
      }
      this.sel = hit;
      this.draw();
      if (this.onpick) this.onpick(hit);
    }
    pin(ctx, q, lines, kind, W, H) {
      const col = kind === 'max' ? '#d42a6b' : kind === 'maxu' ? '#b35a00' : '#14213a';
      ctx.save();
      ctx.font = '600 11.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      const tw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14, th = lines.length * 15 + 8;
      let bx = q[0] + 16, by = q[1] - th - 18;
      if (bx + tw > W - 4) bx = q[0] - 16 - tw;
      if (by < 4) by = q[1] + 18;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(bx + (bx > q[0] ? 0 : tw), by + (by < q[1] ? th : 0)); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, tw, th, 6) : ctx.rect(bx, by, tw, th); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; lines.forEach((l, i) => ctx.fillText(l, bx + 7, by + 16 + i * 15));
      ctx.beginPath(); ctx.arc(q[0], q[1], 5.5, 0, 2 * PI); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(q[0], q[1], 2.5, 0, 2 * PI); ctx.fillStyle = col; ctx.fill();
      ctx.restore();
    }
    zoom(k) { this.cam.dist = Math.max(0.2, Math.min(200, this.cam.dist * k)); this.draw(); }
    pan(dx, dy) { const { r, u } = this.basis(), s = this.cam.dist * 0.0016; ['tx', 'ty', 'tz'].forEach((k, i) => { this.cam[k] += (-dx * r[i] + dy * u[i]) * s; }); }
    draw(w, h) {
      const cv = this.cv, dpr = w ? 1 : Math.min(2, G.devicePixelRatio || 1);
      const W = w || cv.clientWidth || 600, H = h || cv.clientHeight || 400;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgb(' + this.bg.join(',') + ')'; ctx.fillRect(0, 0, W, H);
      if (!this.mesh) return;
      const { pos, f, r, u } = this.basis(), foc = H / (2 * Math.tan(20 * PI / 180)), near = 0.05;
      const L = norm([-0.35 * r[0] + 0.55 * u[0] - 0.75 * f[0], -0.35 * r[1] + 0.55 * u[1] - 0.75 * f[1], -0.35 * r[2] + 0.55 * u[2] - 0.75 * f[2]]);
      const list = [];
      for (const t of this.mesh.t) {
        const q = new Array(3); let zs = 0, ok = true;
        for (let i = 0; i < 3; i++) {
          const d = sub(t.p[i], pos), z = dot(d, f);
          if (z < near) { ok = false; break; }
          q[i] = [W / 2 + foc * dot(d, r) / z, H / 2 - foc * dot(d, u) / z]; zs += z;
        }
        if (!ok) continue;
        const nrm = norm(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0])));
        const sh = 0.42 + 0.58 * Math.abs(dot(nrm, L));
        let col = t.col;
        if (t.s && this.color) col = this.color(t.s);
        const rgb = Math.round(col[0] * sh) + ',' + Math.round(col[1] * sh) + ',' + Math.round(col[2] * sh);
        list.push({ q, z: zs / 3, t, c: t.a != null ? 'rgba(' + rgb + ',' + t.a + ')' : 'rgb(' + rgb + ')', a: t.a != null });
      }
      for (const l of (this.mesh.l || [])) {
        const q = [], d0 = sub(l.p[0], pos), d1 = sub(l.p[1], pos), z0 = dot(d0, f), z1 = dot(d1, f);
        if (z0 < near || z1 < near) continue;
        q.push([W / 2 + foc * dot(d0, r) / z0, H / 2 - foc * dot(d0, u) / z0], [W / 2 + foc * dot(d1, r) / z1, H / 2 - foc * dot(d1, u) / z1]);
        list.push({ q, z: (z0 + z1) / 2 - 0.02, line: true, w: l.w, c: 'rgb(' + l.col.join(',') + ')' });
      }
      list.sort((a, b) => b.z - a.z);
      this.last = list.filter(t => !t.line && !(t.t.a != null && t.t.a < 0.5));
      ctx.lineJoin = 'round';
      for (const t of list) {
        if (t.line) { ctx.lineWidth = t.w; ctx.strokeStyle = t.c; ctx.beginPath(); ctx.moveTo(t.q[0][0], t.q[0][1]); ctx.lineTo(t.q[1][0], t.q[1][1]); ctx.stroke(); continue; }
        ctx.beginPath(); ctx.moveTo(t.q[0][0], t.q[0][1]); ctx.lineTo(t.q[1][0], t.q[1][1]); ctx.lineTo(t.q[2][0], t.q[2][1]); ctx.closePath();
        ctx.fillStyle = t.c; ctx.fill();
        if (!t.a) { ctx.lineWidth = 0.6; ctx.strokeStyle = t.c; ctx.stroke(); }
      }
      // pins: maximum markers and the picked point
      const proj = p => { const d = sub(p, pos), z = dot(d, f); return z < near ? null : [W / 2 + foc * dot(d, r) / z, H / 2 - foc * dot(d, u) / z]; };
      (this.marks || []).forEach(mk => { const q = proj(mk.p); if (q) this.pin(ctx, q, mk.lines, mk.kind, W, H); });
      if (this.sel && this.fmtPick) { const q = proj(this.sel.p); if (q) this.pin(ctx, q, this.fmtPick(this.sel), 'pick', W, H); }
      // axis triad
      const ax = [[1, 0, 0, 'x'], [0, 1, 0, 'y'], [0, 0, 1, 'z']], o = [36, H - 30];
      ctx.lineWidth = 2; ctx.font = '600 11px ui-monospace, monospace';
      ax.forEach(([a, b, c, lb], i) => { const v = [a, b, c], px = o[0] + 22 * dot(v, r), py = o[1] - 22 * dot(v, u); ctx.strokeStyle = ctx.fillStyle = ['#e04b3c', '#2f9e59', '#3a6bff'][i]; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(px, py); ctx.stroke(); ctx.fillText(lb, px + 3, py + 3); });
    }
  }

  // ------------------------------------------------------------------ gantry scene
  // opts: { stress: case id | null, mode: 'ur' | 'mpa', view }
  function gantryScene(r, opts, theme) {
    const m = new Mesh(), g = r.geo, col = r.col, arm = r.arm, b = r.base, cn = r.conn, x = r.input.base, mm = v => v / 1000;
    const steel = theme.steel, dark = theme.dark, concrete = theme.concrete, signC = theme.sign, boltC = theme.bolt;
    const fat = r.fat, cs = opts.stress && fat && fat.caseObjs ? fat.caseObjs.find(c => c.id === opts.stress) : null;
    const plainCap = fat && fat.phi ? fat.phi * 0.737 * 140 : 72;
    const colTop = g.H + arm.D / 2, SI = b.SI, Lr0 = g.L, hs = x.stiff ? x.hs : 0;
    let smax = 0, maxM = null, maxU = null;
    const byTag = {};
    const track = (s, p) => {
      if (!s) return s;
      if (s.mpa > smax) smax = s.mpa;
      if (p && (!maxM || s.mpa > maxM.s.mpa)) maxM = { p: p.slice(), s, tag: m.tag };
      if (p && (!maxU || s.ur > maxU.s.ur)) maxU = { p: p.slice(), s, tag: m.tag };
      if (p) { const k = m.tag, e = byTag[k] || (byTag[k] = { m: null, u: null }); if (!e.m || s.mpa > e.m.s.mpa) e.m = { p: p.slice(), s, tag: k }; if (!e.u || s.ur > e.u.s.ur) e.u = { p: p.slice(), s, tag: k }; }
      return s;
    };
    // stress functions (N, mm → MPa); return {mpa, ur}
    const colS = !cs ? null : p => {
      const X = p[0] * 1e3, Y = p[1] * 1e3, Z = Math.max(0, p[2] * 1e3);
      const Mop = cs.Fs * Math.max(0, g.zs - Z) + cs.wa * Lr0 * Math.max(0, g.H - Z) + cs.wc * Math.pow(Math.max(0, g.H - Z), 2) / 2, Mip = cs.Fz * cs.xz;
      const stiffZone = x.stiff && Z < hs;
      const Iop = stiffZone ? SI.Iop : col.Ix, Iip = stiffZone ? SI.Iip : col.Iy;
      const s = Math.abs(Mop * Y / Iop + Mip * X / Iip);
      let cap = plainCap;
      if (Z <= 40) cap = fat.caps.fB || plainCap; else if (x.stiff && Math.abs(Z - hs) <= 60) cap = fat.caps.fS || plainCap;
      return track({ mpa: s, ur: s / cap }, p);
    };
    const armS = !cs ? null : p => {
      const X = p[0] * 1e3, Y = p[1] * 1e3, Z = p[2] * 1e3 - g.H;
      const Mv = cs.Fz * Math.max(0, cs.xz - X), Mh = cs.Fs * Math.max(0, g.xsw - X) + cs.wa * Math.pow(Math.max(0, Lr0 - X), 2) / 2;
      const s = Math.abs(Mv * Z / arm.Ix + Mh * Y / arm.Iy);
      let cap = plainCap;
      if (X - g.x0 <= 40) cap = fat.caps.fR || plainCap;
      else if (cn.type === 'bolt' && Math.abs(X - (g.x0 + cn.Lst)) <= 40) cap = fat.caps.fE || plainCap;
      return track({ mpa: s, ur: s / cap }, p);
    };
    const boltS = (u, v, grpPts, Mu, Mv, As, cap, p) => {
      const Su = grpPts.reduce((a, q) => a + q.u * q.u, 0), Sv = grpPts.reduce((a, q) => a + q.v * q.v, 0);
      const s = Math.abs((Su ? Mu * u / Su : 0) + (Sv ? Mv * v / Sv : 0)) / As;
      return track({ mpa: s, ur: s / cap }, p);
    };
    // ---- ground and foundation
    const P = mm(b.plateSide), fz = -mm(x.tp) - 0.05;
    m.tag = 'found';
    const circP = b.shape === 'circle';
    if (circP) m.disc([0, 0, fz - 0.3], P * 0.95, 0.3, concrete, 6, 48); else m.slab([0, 0, fz - 0.3], [P * 0.95, P * 0.95, 0.3], concrete, 10);
    // ---- base plate
    m.tag = 'plate';
    if (circP) m.disc([0, 0, -mm(x.tp) / 2], P / 2, mm(x.tp) / 2, dark, 5, 48); else m.slab([0, 0, -mm(x.tp) / 2], [P / 2, P / 2, mm(x.tp) / 2], dark, 8);
    // ---- anchor bolts (with nuts)
    const bd = +x.db.slice(1) / 1000, BO = G.GANTRY.BOLTS;
    const Mop0 = cs ? cs.Fs * g.zs + cs.wa * Lr0 * g.H + cs.wc * g.H * g.H / 2 : 0, Mip0 = cs ? cs.Fz * cs.xz : 0;
    const F = FAST(bd), tp0 = mm(x.tp), washer = theme.washer || [196, 202, 212];
    b.bolts.pts.forEach(q => {
      m.tag = 'anchor';
      const sval = cs ? boltS(q.u, q.v, b.bolts.pts, Mip0, Mop0, BO[x.db][0], fat.caps.fA || 30, [mm(q.u), mm(q.v), 0]) : null;
      const sf = sval ? () => sval : null, pl = (a, c, t) => [mm(q.u) + a, mm(q.v) + c, t];
      const top = F.wt + F.m + F.mj + 0.35 * bd;
      m.tube(circle(bd / 2, 10), [fz, top], pl, boltC, sf, true);
      // levelling nut + washer under the plate
      stack(m, pl, -tp0, -1, [['w', F.wt, F.wd], ['n', F.m, F.s]], dark, washer, sf);
      // washer, nut and lock nut on top
      stack(m, pl, 0, 1, [['w', F.wt, F.wd], ['n', F.m, F.s], ['n', F.mj, F.s]], dark, washer, sf);
    });
    // ---- stiffeners
    const Ls0 = mm(b.Ls), hs0 = mm(x.hs), stiffPoly = trapStiff(Ls0, hs0);
    m.tag = 'stiff';
    b.stiff.forEach(st => {
      const o = [mm(st.u), mm(st.v), 0];
      m.prism(o, [st.nu, st.nv, 0], [-st.nv, st.nu, 0], stiffPoly, mm(x.ts), steel, colS ? p => colS([o[0], o[1], p[2]]) : null);
    });
    // ---- column (dense near base / stiffener top)
    const zst = [];
    const dense = (a, bnd, step) => { for (let z = a; z < bnd; z += step) zst.push(z); };
    dense(0, 0.12, 0.02); if (hs) dense(Math.max(0.12, mm(hs) - 0.12), mm(hs) + 0.14, 0.02);
    dense(zst.length ? zst[zst.length - 1] + 0.02 : 0, mm(colTop), 0.25); zst.push(mm(colTop));
    const zs2 = [...new Set(zst.map(z => +z.toFixed(4)))].sort((a, c) => a - c);
    const cprof = profileOf(col, 36);
    m.tag = 'col';
    m.tube(cprof, zs2, (a, c, t) => [a, c, t], steel, colS, true);
    m.tag = 'bweld';
    // base weld ring
    m.tube(cprof.map(([a, c]) => [a * 1.035, c * 1.035]), [0, 0.012], (a, c, t) => [a, c, t], dark, colS);
    // ---- arm (and stub / flange)
    const xr = mm(g.x0), xE = mm(Lr0), xs1 = [];
    for (let xx = xr; xx < xr + 0.14; xx += 0.02) xs1.push(xx);
    const xf = cn.type === 'bolt' ? mm(g.x0 + cn.Lst) : null;
    if (xf) for (let xx = xf - 0.1; xx < xf + 0.14; xx += 0.02) xs1.push(xx);
    for (let xx = xr + 0.16; xx < xE; xx += 0.25) xs1.push(xx);
    xs1.push(xE);
    const xs2 = [...new Set(xs1.map(v => +v.toFixed(4)))].sort((a, c) => a - c);
    const aprof = profileOf(arm, 36), H = mm(g.H);
    const placeArm = (a, c, t) => [t, a, H + c];
    if (xf) {
      const tp = mm(cn.tep);
      m.tag = 'stub';
      m.tube(aprof, xs2.filter(v => v <= xf - tp), placeArm, steel, armS, true);
      m.tag = 'arm';
      m.tube(aprof, [xf + tp].concat(xs2.filter(v => v > xf + tp)), placeArm, steel, armS, true);
      const pl0 = r.flange.plate || { shape: 'square', size: 2 * (Math.max(...r.flange.pts.map(q => Math.max(Math.abs(q.u), Math.abs(q.v)))) + 45) }, ext = pl0.size / 2;
      m.tag = 'eplate';
      if (pl0.shape === 'circle') [-1, 1].forEach(sg => { const x0 = xf + (sg < 0 ? -tp : 0); m.tube(circle(mm(ext), 40), [x0, x0 + tp], (a, c, t) => [t, a, H + c], dark, null, true); });
      else [-1, 1].forEach(sg => m.box([xf + sg * tp / 2, 0, H], [tp / 2, mm(ext), mm(ext)], [1, 0, 0], [0, 1, 0], [0, 0, 1], dark));
      const fb = +cn.fb.slice(1) / 1000, Mh0 = cs ? cs.Fs * Math.max(0, g.xsw - (g.x0 + cn.Lst)) + cs.wa * Math.pow(Lr0 - g.x0 - cn.Lst, 2) / 2 : 0, Mv0 = cs ? cs.Fz * Math.max(0, cs.xz - g.x0 - cn.Lst) : 0;
      const FF = FAST(fb), washer = theme.washer || [196, 202, 212];
      r.flange.pts.forEach(q => {
        m.tag = 'fbolt';
        const sval = cs ? boltS(q.u, q.v, r.flange.pts, Mh0, Mv0, BO[cn.fb][0], fat.caps.fF || 30, [xf, mm(q.u), H + mm(q.v)]) : null, sf = sval ? () => sval : null;
        const pl = (a, c, t) => [t, mm(q.u) + a, H + mm(q.v) + c];
        m.tube(circle(fb / 2, 8), [xf - tp - FF.wt - FF.k * 0.3, xf + tp + FF.wt + FF.m + FF.mj + 0.3 * fb], pl, boltC, sf, true);
        stack(m, pl, xf - tp, -1, [['w', FF.wt, FF.wd], ['n', FF.k, FF.s]], dark, washer, sf);
        stack(m, pl, xf + tp, 1, [['w', FF.wt, FF.wd], ['n', FF.m, FF.s], ['n', FF.mj, FF.s]], dark, washer, sf);
      });
    } else { m.tag = 'arm'; m.tube(aprof, xs2, placeArm, steel, armS, true); }
    m.tag = 'aweld';
    m.tube(aprof.map(([a, c]) => [a * 1.04, c * 1.04]), [xr, xr + 0.012], placeArm, dark, armS);
    // ---- sign panel and brackets
    const sx0 = mm(g.xs - g.Bs / 2), sx1 = mm(g.xs + g.Bs / 2), sz0 = mm(g.zs - g.Hs / 2), sz1 = mm(g.zs + g.Hs / 2), sy = mm(g.ey);
    m.tag = 'sign';
    m.box([(sx0 + sx1) / 2, sy, (sz0 + sz1) / 2], [(sx1 - sx0) / 2, 0.02, (sz1 - sz0) / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1], signC);
    [sx0 + (sx1 - sx0) * 0.2, sx1 - (sx1 - sx0) * 0.2].forEach(bx => {
      m.tag = 'bracket';
      m.box([bx, sy / 2, H], [0.03, Math.abs(sy) / 2, 0.03], [1, 0, 0], [0, 1, 0], [0, 0, 1], dark);
      m.box([bx, sy - Math.sign(sy || 1) * 0.04, (sz0 + sz1) / 2], [0.03, 0.02, (sz1 - sz0) / 2 * 0.95], [1, 0, 0], [0, 1, 0], [0, 0, 1], dark);
    });
    return { mesh: m, smax, cs, maxM, maxU, byTag };
  }
  // stiffener outline (r from tube face, z up): full height at the tube, short flat top, chamfer to a low outer edge
  function trapStiff(Ls, hs) {
    const top = Math.min(Ls * 0.45, Math.max(Ls * 0.3, 0.025)), out = Math.min(hs * 0.6, Math.max(hs * 0.3, 0.025));
    return [[0, 0], [Ls, 0], [Ls, out], [top, hs], [0, hs]];
  }
  // ------------------------------------------------------------------ pile cap strut-and-tie scene (mm → m)
  // opts: { mode: 'ur' | 'type' }; members carry s = { mpa: |N| kN, ur, m: index } for colour and picking
  function stmScene(r, opts, theme) {
    const m = new Mesh(), mm = v => v / 1000, H = mm(r.H), P = r.poly.map(([x, y]) => [mm(x), mm(y)]), n = P.length;
    const g = r.input.geo, edge = theme.edge || [120, 130, 150];
    // translucent cap
    m.tag = 'cap'; m.alpha = 0.13;
    for (let i = 1; i < n - 1; i++) { m.tri([P[0][0], P[0][1], 0], [P[i][0], P[i][1], 0], [P[i + 1][0], P[i + 1][1], 0], theme.concrete); m.tri([P[0][0], P[0][1], H], [P[i][0], P[i][1], H], [P[i + 1][0], P[i + 1][1], H], theme.concrete); }
    P.forEach((p, i) => { const q = P[(i + 1) % n]; m.quad([p[0], p[1], 0], [q[0], q[1], 0], [q[0], q[1], H], [p[0], p[1], H], theme.concrete); });
    m.alpha = null;
    P.forEach((p, i) => { const q = P[(i + 1) % n]; [0, H].forEach(z => m.line([p[0], p[1], z], [q[0], q[1], z], edge, 1.2)); m.line([p[0], p[1], 0], [p[0], p[1], H], edge, 1.2); });
    // column stub and piles
    const cx = mm(g.cx) / 2, cy = mm(g.cy) / 2, ch = Math.max(0.5, H * 0.5);
    m.tag = 'column'; m.alpha = 0.35;
    m.box([0, 0, H + ch / 2], [cx, cy, ch / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1], theme.steel);
    m.alpha = null;
    [[-cx, -cy], [cx, -cy], [cx, cy], [-cx, cy]].forEach(([x, y], i, a) => { const [x2, y2] = a[(i + 1) % 4]; m.line([x, y, H], [x2, y2, H], edge, 1); m.line([x, y, H + ch], [x2, y2, H + ch], edge, 1); m.line([x, y, H], [x, y, H + ch], edge, 1); });
    m.tag = 'pile';
    const pl = Math.max(0.6, H * 0.6);
    r.piles.forEach(p => m.tube(circle(mm(g.Dp) / 2, 18), [-pl, 0.05], (a, b, t) => [mm(p.x) + a, mm(p.y) + b, t], theme.pile || [176, 168, 150], null, true));
    // members
    const Nmax = Math.max(...r.members.map(e => Math.abs(e.N)), 1), rmin = 0.012, rmax = Math.max(0.035, mm(g.Dp) * 0.12);
    const nodeP = i => [mm(r.nodes[i].x), mm(r.nodes[i].y), mm(r.nodes[i].z)];
    let maxU = null;
    const bottle = opts.shape !== 'line', Ast = (g.tN || 1) * Math.PI * Math.pow(g.tD || 20, 2) / 4;
    r.members.forEach((e, k) => {
      m.tag = 'm' + k;
      const s = { mpa: Math.abs(e.N), ur: e.ur, m: k }, rr = rmin + (rmax - rmin) * Math.sqrt(Math.abs(e.N) / Nmax);
      const col = e.type === 'tie' ? (e.N > 0 ? theme.tie : theme.idle) : e.type === 'top' ? theme.top : theme.strut;
      if (bottle && e.type === 'strut' && e.Atop && e.Abot) {
        // end radii from the strut sections used in the check; bottle bulge ≈ L/6 (1:2 spread), at most the larger end radius
        const r0 = mm(Math.sqrt(e.Atop / Math.PI)), r1 = mm(Math.sqrt(e.Abot / Math.PI)), rb = Math.min(mm(e.L) / 12, 0.5 * Math.max(r0, r1));
        m.alpha = 0.78; m.bottle(nodeP(e.a), nodeP(e.b), r0, r1, rb, col, s); m.alpha = null;
      } else if (bottle && e.type === 'top' && e.Ac > 0) {
        // prismatic strut in the compression zone: depth h_t, width min(c_x, c_y)/2
        const A0 = nodeP(e.a), B0 = nodeP(e.b), dx = B0[0] - A0[0], dy = B0[1] - A0[1], l = Math.hypot(dx, dy) || 1;
        const w = mm(Math.min(g.cx, g.cy) / 2), hh = mm(e.Ac) / 1000 / w;
        m.box([(A0[0] + B0[0]) / 2, (A0[1] + B0[1]) / 2, A0[2]], [l / 2, w / 2, hh / 2], [dx / l, dy / l, 0], [-dy / l, dx / l, 0], [0, 0, 1], col, () => s);
      } else if (bottle && e.type === 'tie') m.rod(nodeP(e.a), nodeP(e.b), Math.max(0.012, mm(Math.sqrt(4 * Ast / Math.PI)) / 2 * 1.6), col, s, 12);
      else m.rod(nodeP(e.a), nodeP(e.b), rr, col, s, 12);
      if (!maxU || e.ur > maxU.e.ur) maxU = { e, k, p: nodeP(e.a).map((v, i) => (v + nodeP(e.b)[i]) / 2) };
    });
    m.tag = 'node';
    r.nodes.forEach(q => m.blob([mm(q.x), mm(q.y), mm(q.z)], bottle ? 0.03 : rmax * 1.25, theme.node || [40, 48, 66]));
    return { mesh: m, maxU };
  }
  function stmPreset(r) {
    const mm = v => v / 1000, L = Math.max(mm(r.Lx), mm(r.Ly));
    return { yaw: -1.05, pitch: 0.42, dist: 1.9 * L + 2.2, tx: 0, ty: 0, tz: mm(r.H) * 0.45 };
  }
  function presets(r) {
    const g = r.geo, mm = v => v / 1000, P = mm(r.base.plateSide);
    return {
      overall: { yaw: -1.15, pitch: 0.2, dist: 1.75 * Math.max(mm(g.zs + g.Hs / 2), mm(g.L)) + 3, tx: mm(g.L) * 0.45, ty: 0, tz: mm(g.zs + g.Hs / 2) * 0.5 },
      base: { yaw: -0.85, pitch: 0.42, dist: Math.max(1.6, P * 4.2), tx: 0, ty: 0, tz: 0.15 },
      arm: { yaw: -0.7, pitch: 0.3, dist: Math.max(1.4, mm(r.arm.D) * 7.5), tx: mm(g.x0 + (r.conn.type === 'bolt' ? r.conn.Lst * 0.6 : 150)), ty: 0, tz: mm(g.H) }
    };
  }
  G.SC3D = { Viewer, Mesh, gantryScene, stmScene, stmPreset, presets, ramp, hex, trapStiff, FAST };
})(typeof window !== 'undefined' ? window : globalThis);
