/* StructCap Connection — component checks (analytical / component method) for AS 4100, EN 1993-1-8 and AISC 360.
   check(J, g, load) → { checks: [{ grp, item, name, Ed, Rd, unit, util, ref, expr }], util, ok }
   Demands come from the load effect on the connected member (N + tension, Vz + downward, My + hogging / top flange in tension).
   Units inside: N, mm, MPa; reported in kN, kNm, mm, MPa. */
(function (G) {
  'use strict';
  const C = G.CONN, PI = Math.PI, sq = Math.sqrt, max = Math.max, min = Math.min, abs = Math.abs;
  // resistance factors (φ for AS / AISC) or partial factors (γ for EN)
  const FAC = {
    AS: { bolt: 0.8, ply: 0.9, weld: 0.8, yld: 0.9, rup: 0.9, shr: 0.9, bs: 0.75, conc: 0.6, anc: 0.8, ancC: 1 / 1.5, mu: 0.2 },
    EN: { M0: 1.0, M1: 1.0, M2: 1.25, c: 1.5, Mc: 1.5, mu: 0.2 },
    AISC: { bolt: 0.75, ply: 0.75, weld: 0.75, yld: 0.9, rup: 0.75, shr: 1.0, shrR: 0.75, bs: 0.75, conc: 0.65, anc: 0.75, ancV: 0.65, ancC: 0.70, mu: 0.41 }
  };
  const kN = v => v / 1e3, kNm = v => v / 1e6;

  // ------------------------------------------------------------------ basic resistances (N)
  function R(code) {
    const f = FAC[code];
    return {
      code, f,
      // shear resistance of one bolt, per shear plane (threads in the shear plane)
      boltV(B) { if (code === 'EN') { const av = /10\.9|4\.8|5\.8|6\.8/.test(B.grade) ? 0.5 : 0.6; return { v: av * B.fu * B.As / f.M2, x: 'α_v·f_ub·A_s/γ_M2 = ' + av + '·' + B.fu + '·' + B.As + '/' + f.M2, ref: 'EN 1993-1-8 Tab 3.4' }; }
        if (code === 'AS') return { v: f.bolt * 0.62 * B.fu * B.Ac, x: 'φ·0.62·f_uf·k_r·A_c = 0.8·0.62·' + B.fu + '·' + B.Ac, ref: 'AS 4100 §9.2.2.1' };
        return { v: f.bolt * B.FnvN * B.Ao, x: 'φ·F_nv·A_b = 0.75·' + B.FnvN + '·' + B.Ao.toFixed(0), ref: 'AISC J3.6' }; },
      boltT(B) { if (code === 'EN') return { v: 0.9 * B.fu * B.As / f.M2, x: 'k_2·f_ub·A_s/γ_M2 = 0.9·' + B.fu + '·' + B.As + '/' + f.M2, ref: 'EN 1993-1-8 Tab 3.4' };
        if (code === 'AS') return { v: f.bolt * B.As * B.fu, x: 'φ·A_s·f_uf = 0.8·' + B.As + '·' + B.fu, ref: 'AS 4100 §9.2.2.2' };
        return { v: f.bolt * B.Fnt * B.Ao, x: 'φ·F_nt·A_b = 0.75·' + B.Fnt + '·' + B.Ao.toFixed(0), ref: 'AISC J3.6' }; },
      // interaction of shear V and tension T in one bolt (value ≤ 1)
      boltVT(B, V, T, Vr, Tr) { if (code === 'EN') return { u: V / Vr + T / (1.4 * Tr), x: 'F_v/F_v,Rd + F_t/(1.4·F_t,Rd)', ref: 'EN 1993-1-8 Tab 3.4' };
        if (code === 'AS') return { u: (V / Vr) ** 2 + (T / Tr) ** 2, x: '(V*/φV_f)² + (N*/φN_tf)²', ref: 'AS 4100 §9.2.2.3' };
        const frv = V / B.Ao, Fp = min(B.Fnt, 1.3 * B.Fnt - B.Fnt / (f.bolt * B.FnvN) * frv), Rn = f.bolt * max(0, Fp) * B.Ao; return { u: T > 0 ? max(T / max(Rn, 1), V / Vr) : V / Vr, x: "F'_nt = 1.3F_nt − F_nt·f_rv/(φF_nv) ≤ F_nt", ref: 'AISC J3.7' }; },
      // bearing of one bolt on a ply of thickness t: e1 end distance (in the force direction), p1 pitch, e2 edge, p2 gauge
      bear(B, t, fu, e1, p1, e2, p2) { if (code === 'EN') { const d0 = B.d0, ad = min(e1 / (3 * d0), p1 ? p1 / (3 * d0) - 0.25 : 9), ab = min(ad, B.fu / fu, 1), k1 = min(e2 ? 2.8 * e2 / d0 - 1.7 : 2.5, p2 ? 1.4 * p2 / d0 - 1.7 : 2.5, 2.5); return { v: max(0, k1) * ab * fu * B.d * t / f.M2, x: 'k_1·α_b·f_u·d·t/γ_M2 = ' + max(0, k1).toFixed(2) + '·' + ab.toFixed(2) + '·' + fu + '·' + B.d + '·' + t + '/' + f.M2, ref: 'EN 1993-1-8 Tab 3.4' }; }
        if (code === 'AS') { const v1 = 3.2 * B.d * t * fu, v2 = e1 * t * fu; return { v: f.ply * min(v1, v2), x: 'φ·min(3.2·d_f·t_p·f_up, a_e·t_p·f_up) = 0.9·min(' + (v1 / 1e3).toFixed(0) + ', ' + (v2 / 1e3).toFixed(0) + ') kN', ref: 'AS 4100 §9.2.2.4' }; }
        const lc = min(e1 - B.d0 / 2, p1 ? p1 - B.d0 : 1e9), v1 = 1.2 * lc * t * fu, v2 = 2.4 * B.d * t * fu; return { v: f.ply * min(v1, v2), x: 'φ·min(1.2·l_c·t·F_u, 2.4·d·t·F_u), l_c = ' + lc.toFixed(1), ref: 'AISC J3.10' }; },
      punch(B, t, fu) { if (code !== 'EN') return null; const dm = 1.077 * B.s; return { v: 0.6 * PI * dm * t * fu / f.M2, x: '0.6·π·d_m·t_p·f_u/γ_M2, d_m = ' + dm.toFixed(1), ref: 'EN 1993-1-8 Tab 3.4' }; },
      // fillet weld: force per unit length components fn (normal to the face plate), ft (transverse in the face), fl (along the weld); sides = 1 or 2
      fillet(a, sides, fn, ft, fl, fu, bw) { const Aw = sides * a;
        if (code === 'EN') { const sp = sq(fn * fn + ft * ft) / (Math.SQRT2 * Aw), tl = fl / Aw, se = sq(sp * sp + 3 * (sp * sp + tl * tl)), Rd = fu / (bw * f.M2); return { u: max(se / Rd, sp / (0.9 * fu / f.M2)), s: se, Rd, x: '√(σ⊥² + 3(τ⊥² + τ∥²)) ≤ f_u/(β_w·γ_M2) = ' + Rd.toFixed(0) + ' MPa (σ⊥ = τ⊥ = ' + sp.toFixed(0) + ', τ∥ = ' + tl.toFixed(0) + ')', ref: 'EN 1993-1-8 §4.5.3.2' }; }
        const res = sq(fn * fn + ft * ft + fl * fl) / sides; if (code === 'AS') { const Rd = f.weld * 0.6 * fu * a; return { u: res / Rd, s: res / a, Rd: Rd / a, x: 'v*_w ≤ φ·0.6·f_uw·t_t = 0.8·0.6·' + fu + '·' + a + ' = ' + (Rd).toFixed(0) + ' N/mm', ref: 'AS 4100 §9.6.3.10' }; }
        const st = res > 0 ? sq(fn * fn + ft * ft) / sides / res : 0, k = 1 + 0.5 * Math.pow(st, 1.5), Rd = f.weld * 0.6 * fu * k * a; return { u: res / Rd, s: res / a, Rd: Rd / a, x: 'φ·0.6·F_EXX·(1 + 0.5·sin^1.5θ)·t_e = 0.75·0.6·' + fu + '·' + k.toFixed(2) + '·' + a + ' N/mm', ref: 'AISC J2.4' }; },
      // plate in shear: gross yield
      shearY(A, fy) { if (code === 'EN') return { v: A * fy / (sq(3) * f.M0), x: 'A_v·f_y/(√3·γ_M0)', ref: 'EN 1993-1-1 §6.2.6' }; if (code === 'AS') return { v: f.shr * 0.6 * fy * A, x: 'φ·0.6·f_y·A_v', ref: 'AS 4100 §5.11' }; return { v: f.shr * 0.6 * fy * A, x: 'φ·0.6·F_y·A_gv', ref: 'AISC J4.2' }; },
      shearR(An, fu) { if (code === 'EN') return { v: An * fu / (sq(3) * f.M2), x: 'A_nv·f_u/(√3·γ_M2)', ref: 'EN 1993-1-8 §3.10' }; if (code === 'AS') return { v: 0.75 * 0.6 * fu * An, x: 'φ·0.6·f_u·A_nv (φ = 0.75)', ref: 'AS 4100 §9.1.9' }; return { v: f.shrR * 0.6 * fu * An, x: 'φ·0.6·F_u·A_nv', ref: 'AISC J4.2' }; },
      tensY(A, fy) { if (code === 'EN') return { v: A * fy / f.M0, x: 'A·f_y/γ_M0', ref: 'EN 1993-1-1 §6.2.3' }; if (code === 'AS') return { v: f.yld * A * fy, x: 'φ·A_g·f_y', ref: 'AS 4100 §7.2' }; return { v: f.yld * A * fy, x: 'φ·F_y·A_g', ref: 'AISC J4.1' }; },
      tensR(An, fu, U) { U = U || 1; if (code === 'EN') return { v: 0.9 * An * U * fu / f.M2, x: '0.9·A_net·f_u/γ_M2' + (U < 1 ? ' (U = ' + U.toFixed(2) + ')' : ''), ref: 'EN 1993-1-1 §6.2.3' }; if (code === 'AS') return { v: f.rup * 0.85 * U * An * fu, x: 'φ·0.85·k_t·A_n·f_u (k_t = ' + U.toFixed(2) + ')', ref: 'AS 4100 §7.2' }; return { v: f.rup * U * An * fu, x: 'φ·F_u·A_e, U = ' + U.toFixed(2), ref: 'AISC J4.1 / D3' }; },
      block(Agv, Anv, Ant, fy, fu, ecc) { const k = ecc ? 0.5 : 1;
        if (code === 'EN') return { v: k * fu * Ant / f.M2 + fy * Anv / (sq(3) * f.M0), x: (ecc ? '0.5·' : '') + 'f_u·A_nt/γ_M2 + f_y·A_nv/(√3·γ_M0)', ref: 'EN 1993-1-8 §3.10.2' };
        const a = 0.6 * fu * Anv + k * fu * Ant, b = 0.6 * fy * Agv + k * fu * Ant; return { v: (code === 'AS' ? 0.75 : f.bs) * min(a, b), x: 'φ·min(0.6·f_u·A_nv + k·f_u·A_nt, 0.6·f_y·A_gv + k·f_u·A_nt)', ref: code === 'AS' ? 'AS 4100 §9.1.9' : 'AISC J4.3' }; },
      bend(t, h, fy) { if (code === 'EN') return { v: fy * t * h * h / 6 / f.M0, x: 'W_el·f_y/γ_M0', ref: 'EN 1993-1-1 §6.2.5' }; return { v: 0.9 * fy * t * h * h / 4, x: 'φ·f_y·Z_p (plastic)', ref: code === 'AS' ? 'AS 4100 §5.2' : 'AISC F11' }; },
      // compression resistance of a plate strip (gusset, cover plate): length le, radius r
      comp(A, fy, E, le, r) { const lam = le / r;
        if (code === 'EN') { const l1 = PI * sq(E / fy), lb = lam / l1, ph = 0.5 * (1 + 0.49 * (lb - 0.2) + lb * lb), chi = min(1, 1 / (ph + sq(max(0, ph * ph - lb * lb)))); return { v: chi * A * fy / f.M1, x: 'χ·A·f_y/γ_M1, curve c, λ̄ = ' + lb.toFixed(2) + ', χ = ' + chi.toFixed(3), ref: 'EN 1993-1-1 §6.3.1' }; }
        if (code === 'AS') { const ln = lam * sq(fy / 250), aa = 2100 * (ln - 13.5) / (ln * ln - 15.3 * ln + 2050), l2 = ln + aa * 0.5, et = max(0, 0.00326 * (l2 - 13.5)), xi = ((l2 / 90) ** 2 + 1 + et) / (2 * (l2 / 90) ** 2), ac = min(1, xi * (1 - sq(max(0, 1 - (90 / (xi * l2)) ** 2)))); return { v: 0.9 * ac * A * fy, x: 'φ·α_c·A·f_y, λ_n = ' + ln.toFixed(1) + ', α_b = 0.5, α_c = ' + ac.toFixed(3), ref: 'AS 4100 §6.3.3' }; }
        const Fe = PI * PI * E / (lam * lam), Fcr = lam <= 4.71 * sq(E / fy) ? Math.pow(0.658, fy / Fe) * fy : 0.877 * Fe; return { v: 0.9 * Fcr * A, x: 'φ·F_cr·A_g, KL/r = ' + lam.toFixed(1) + ', F_cr = ' + Fcr.toFixed(0) + ' MPa', ref: 'AISC E3 / J4.4' }; },
      // concrete bearing strength (MPa) under a plate of area A1 on a support area A2
      bearC(fc, A1, A2) { const r = min(2, sq(max(1, A2 / A1))); if (code === 'EN') { const a = min(3, sq(max(1, A2 / A1))), v = (2 / 3) * a * fc / f.c; return { v, x: 'f_jd = β_j·α·f_ck/γ_c = 0.67·' + a.toFixed(2) + '·' + fc + '/1.5', ref: 'EN 1993-1-8 §6.2.5' }; }
        if (code === 'AS') return { v: f.conc * 0.85 * fc * r, x: 'φ·0.85·f\'c·√(A2/A1) = 0.6·0.85·' + fc + '·' + r.toFixed(2), ref: 'AS 3600 §12.6' };
        return { v: f.conc * min(0.85 * fc * r, 1.7 * fc), x: 'φ·0.85·f\'c·√(A2/A1) ≤ φ·1.7f\'c = 0.65·0.85·' + fc + '·' + r.toFixed(2), ref: 'AISC J8 / DG1' }; },
      // anchors: concrete cone breakout of a group (tension), pullout of one headed anchor
      cone(fc, hef, sx, sy, n) { const s = 3 * hef, Ac = (min(sx, s) + s) * (min(sy, s) + s), A0 = s * s;
        if (code === 'AISC') { const s2 = 1.5 * hef * 2, Ac2 = (min(sx, s2) + s2) * (min(sy, s2) + s2), A02 = s2 * s2, Nb = 10 * sq(fc) * Math.pow(hef, 1.5); return { v: FAC.AISC.ancC * Ac2 / A02 * Nb, x: 'φ·(A_Nc/A_Nco)·k_c·λ·√f\'c·h_ef^1.5, k_c = 10 (cast-in)', ref: 'ACI 318-19 §17.6.2' }; }
        const N0 = 7.7 * sq(fc) * Math.pow(hef, 1.5), g = code === 'EN' ? 1 / FAC.EN.Mc : FAC.AS.ancC; return { v: g * Ac / A0 * N0, x: '(A_c,N/A⁰_c,N)·k_1·√f_ck·h_ef^1.5/γ_Mc, k_1 = 7.7 (cracked)', ref: code === 'EN' ? 'EN 1992-4 §7.2.1.4' : 'AS 5216 §6.2.3' }; },
      pull(fc, d) { const Ah = 2 * PI * d * d; if (code === 'AISC') return { v: FAC.AISC.ancC * 8 * Ah * fc, x: 'φ·8·A_brg·f\'c (head/washer Ø 3d)', ref: 'ACI 318-19 §17.6.3' }; const g = code === 'EN' ? 1 / FAC.EN.Mc : FAC.AS.ancC; return { v: g * 6 * Ah * fc, x: '6·A_h·f_ck/γ_Mp (head Ø 3d)', ref: code === 'EN' ? 'EN 1992-4 §7.2.1.5' : 'AS 5216 §6.2.4' }; },
      ancT(A) { if (code === 'AISC') return { v: FAC.AISC.anc * A.As * A.fu, x: 'φ·A_se·f_uta', ref: 'ACI 318-19 §17.6.1' }; return this.boltT(A); },
      ancV(A) { if (code === 'AISC') return { v: FAC.AISC.ancV * 0.6 * A.As * A.fu * 0.8, x: 'φ·0.6·A_se·f_uta·0.8 (grout pad)', ref: 'ACI 318-19 §17.7.1' }; return this.boltV(A); },
      ancVT(n, v) { if (code === 'AISC') return { u: Math.pow(n, 5 / 3) + Math.pow(v, 5 / 3), x: '(N/φN_n)^5/3 + (V/φV_n)^5/3', ref: 'ACI 318-19 §17.8' }; return { u: n * n + v * v, x: '(N/N_Rd)² + (V/V_Rd)²', ref: code === 'EN' ? 'EN 1992-4 §7.2.3' : 'AS 5216 §6.4' }; }
    };
  }

  // ------------------------------------------------------------------ helpers
  function out() {
    const list = [];
    return { list, add(grp, item, name, Ed, Rd, unit, ref, expr, extra) { const u = Rd > 0 ? abs(Ed) / Rd : abs(Ed) > 1e-9 ? 9.99 : 0; list.push(Object.assign({ grp, item, name, Ed, Rd, unit, util: u, ref, expr }, extra || {})); return u; },
      addU(grp, item, name, u, ref, expr, extra) { list.push(Object.assign({ grp, item, name, Ed: null, Rd: null, unit: '', util: u, ref, expr }, extra || {})); return u; } };
  }
  const LD = l => ({ N: (+l.N || 0) * 1e3, Vy: (+l.Vy || 0) * 1e3, Vz: (+l.Vz || 0) * 1e3, Mx: (+l.Mx || 0) * 1e6, My: (+l.My || 0) * 1e6, Mz: (+l.Mz || 0) * 1e6 });
  const st = (grade, t) => C.steel(grade, t);
  // elastic bolt group: forces in the plane (H along x, V along z, M about the normal) → max bolt resultant
  function group(pts, H, Vv, M) { const n = pts.length; if (!n) return { F: 0, n: 0 }; const cx = pts.reduce((a, p) => a + p[0], 0) / n, cz = pts.reduce((a, p) => a + p[1], 0) / n, Ip = pts.reduce((a, p) => a + (p[0] - cx) ** 2 + (p[1] - cz) ** 2, 0) || 1; let F = 0, Fh = 0, Fv = 0; pts.forEach(p => { const fx = H / n - M * (p[1] - cz) / Ip, fz = Vv / n + M * (p[0] - cx) / Ip, r = Math.hypot(fx, fz); if (r > F) { F = r; Fh = fx; Fv = fz; } }); return { F, Fh, Fv, n, Ip }; }

  // ------------------------------------------------------------------ joint checks
  function check(J, g, l) {
    const code = J.code, r = R(code), o = out(), P = J.p, L = LD(l || {}), mat = J.mat;
    const col = J.mem.col ? C.dims(J.mem.col) : null, bm = J.mem.beam ? C.dims(J.mem.beam) : null, B = C.bolt(code, mat.bolt, P.bolt || 'M20');
    const pl = id => g.plates.find(p => p.id === id) || {};
    const fyP = t => st(mat.steel, t).fy, fuP = t => st(mat.steel, t).fu, bwP = st(mat.steel, 10).bw || 1, E = st(mat.steel, 10).E;
    const wm = C.weldMetal(code, mat.weld, fuP(10)), wfu = wm.fu;
    const T = J.type;
    if (T === 'ep' || T === 'wld') epChecks(); else if (T === 'fin') finChecks(); else if (T === 'hdr') hdrChecks(); else if (T === 'clt') cltChecks(); else if (T === 'base') baseChecks(); else if (T === 'spl') splChecks(); else if (T === 'spe') speChecks(); else if (T === 'gus') gusChecks();
    const util = o.list.reduce((a, c) => max(a, c.util), 0);
    return { checks: o.list, util, ok: util <= 1.0001 };

    // ---- moment end plate / welded beam–column joint / tube joint
    function epChecks() {
      const M = abs(L.My), Nt = L.N, V = abs(L.Vz), hog = L.My >= 0;
      if (T === 'wld' && g.tube) return tubeChecks();
      const z = bm.d - (hog ? bm.tf2 : bm.tf) / 2 - (hog ? bm.tf : bm.tf2) / 2, Ff = M / z + Nt / 2, Fc = M / z - Nt / 2;
      const tfc = col.tf, twc = col.tw, rc = col.r || 0, dwc = col.d - 2 * (tfc + rc), fyc = fyP(tfc), fyb = fyP(bm.tf), Avc = max(col.A - 2 * col.bf * tfc + (twc + 2 * rc) * tfc, col.d * twc), stiff = !!P.stiff, ts = +P.ts || 12;
      const tfb = hog ? bm.tf2 : bm.tf, Wpl = bm.bf * bm.tf * (bm.d - bm.tf) + bm.tw * (bm.d - 2 * bm.tf) ** 2 / 4, Mcb = code === 'EN' ? Wpl * fyb / FAC.EN.M0 : 0.9 * Wpl * fyb;
      // compression side
      const sp = T === 'ep' ? 2 * (+P.tp || 20) : 0, af = +P.af || 10, aw = +P.aw || 6;
      if (code === 'EN') {
        const beffc = tfb + 2 * Math.SQRT2 * af + 5 * (tfc + rc) + sp, w1 = 1 / sq(1 + 1.3 * (beffc * twc / Avc) ** 2), lp = 0.932 * sq(beffc * dwc * fyc / (E * twc * twc)), rho = lp <= 0.72 ? 1 : (lp - 0.2) / (lp * lp);
        const Fcwc = stiff ? (beffc * twc + 2 * ((col.bf - twc) / 2 - 10) * ts) * fyc / FAC.EN.M0 : w1 * rho * beffc * twc * fyc / FAC.EN.M1;
        const Vwp = 0.9 * fyc * Avc / (sq(3) * FAC.EN.M0), Fcfb = Mcb / (bm.d - bm.tf);
        o.add('Column', 'CWC', 'Column web in transverse compression' + (stiff ? ' (with stiffeners)' : ''), Fc, Fcwc, 'kN', 'EN 1993-1-8 §6.2.6.2', stiff ? '(b_eff·t_wc + 2·b_s·t_s)·f_y/γ_M0' : 'ω·ρ·b_eff,c,wc·t_wc·f_y/γ_M1, b_eff = ' + beffc.toFixed(0) + ', ρ = ' + rho.toFixed(2) + ', ω = ' + w1.toFixed(2));
        o.add('Column', 'CWS', 'Column web panel in shear', M / z, Vwp, 'kN', 'EN 1993-1-8 §6.2.6.1', '0.9·f_y·A_vc/(√3·γ_M0), A_vc = ' + Avc.toFixed(0) + ' mm²');
        o.add('Beam', 'BFC', 'Beam flange and web in compression', Fc, Fcfb, 'kN', 'EN 1993-1-8 §6.2.6.7', 'M_c,Rd/(h − t_fb), M_c,Rd = W_pl·f_y = ' + kNm(Mcb).toFixed(0) + ' kNm');
        if (T === 'ep') {
          // bolt rows: equivalent T-stubs of the end plate and the column flange
          const ep = g.ep, tp = +P.tp || 20, bp = ep.bp, gg = ep.g, fyp = fyP(tp), Bt = r.boltT(B).v, zc = hog ? -(bm.d / 2 - tfb / 2) : bm.d / 2 - tfb / 2;
          const rows = ep.rows.map(zr => (hog ? zr : -zr)).map((zr, i) => ({ i, z: zr })).filter(q => q.z > 0).sort((a, b) => b.z - a.z);
          const zFlTop = bm.d / 2, zFlIn = bm.d / 2 - (hog ? bm.tf : bm.tf2), zEdge = hog ? ep.zt : -ep.zb, ew = 1.077 * B.s / 4;
          let Fsum = 0, Mj = 0; const cap = min(stiff ? 1e12 : Infinity, 1e15);
          const Fcmax = min(Fcfb, stiff ? 1e12 : Infinity);
          const rowRes = rows.map((q, k) => {
            let mE, eE, nE, leE1, leE2, where;
            const e = (bp - gg) / 2;
            if (q.z > zFlTop) { mE = q.z - zFlTop - 0.8 * af * Math.SQRT2; const ex = zEdge - q.z; nE = min(ex, 1.25 * mE); leE1 = min(2 * PI * mE, PI * mE + gg, PI * mE + 2 * e); leE2 = min(4 * mE + 1.25 * ex, e + 2 * mE + 0.625 * ex, 0.5 * bp, 0.5 * gg + 2 * mE + 0.625 * ex); where = 'extension'; }
            else { mE = (gg - bm.tw) / 2 - 0.8 * aw * Math.SQRT2; nE = min(e, 1.25 * mE); const first = !rows.slice(0, k).some(qq => qq.z <= zFlTop); leE1 = min(2 * PI * mE, first ? 4.45 * mE : 4 * mE + 1.25 * e); leE2 = first ? 4.45 * mE : 4 * mE + 1.25 * e; where = first ? 'first row below flange' : 'inner row'; }
            mE = max(mE, 5);
            const tstub = (m, n, l1, l2, t, fy) => { const M1 = 0.25 * l1 * t * t * fy, M2 = 0.25 * l2 * t * t * fy, F1 = 4 * M1 / m, F2 = (2 * M2 + n * 2 * Bt) / (m + n), F3 = 2 * Bt; return { F: min(F1, F2, F3), F1, F2, F3, mode: F1 <= min(F2, F3) ? 1 : F2 <= F3 ? 2 : 3 }; };
            const tE = tstub(mE, nE, leE1, leE2, tp, fyp);
            const mC = max(5, (gg - twc) / 2 - 0.8 * rc), eC = (col.bf - gg) / 2, nC = min(eC, 1.25 * mC), lC1 = stiff && abs(q.z - (bm.d / 2 - tfb / 2)) < 120 ? min(2 * PI * mC, 4.45 * mC) : min(2 * PI * mC, 4 * mC + 1.25 * eC), lC2 = stiff ? 4.45 * mC : 4 * mC + 1.25 * eC;
            const tC = tstub(mC, nC, lC1, lC2, tfc, fyc), beff = min(lC1, lC2), wt = 1 / sq(1 + 1.3 * (beff * twc / Avc) ** 2), Fwc = stiff ? Infinity : wt * beff * twc * fyc / FAC.EN.M0, Fwb = where === 'extension' ? Infinity : min(leE1, leE2) * bm.tw * fyb / FAC.EN.M0;
            let F = min(tE.F, tC.F, Fwc, Fwb); const gov = F === tE.F ? 'end plate T-stub mode ' + tE.mode : F === tC.F ? 'column flange T-stub mode ' + tC.mode : F === Fwc ? 'column web in tension' : 'beam web in tension';
            return { q, F, gov, h: q.z - zc, tE, tC, mE, mC, where };
          });
          // equilibrium with the compression side: Σ F_tr ≤ F_c,Rd and ≤ V_wp,Rd
          const lim = min(Fcwc, Fcfb, Vwp);
          rowRes.forEach(rr => { const room = max(0, lim - Fsum), F = min(rr.F, room); rr.Feff = F; Fsum += F; Mj += F * rr.h; });
          const MjRd = Mj;
          o.add('Joint', 'MJ', 'Design moment resistance M_j,Rd = Σ h_r·F_tr,Rd', M, MjRd, 'kNm', 'EN 1993-1-8 §6.2.7.2', rowRes.map((rr, i) => 'row ' + (i + 1) + ': ' + kN(rr.Feff).toFixed(0) + ' kN × ' + rr.h.toFixed(0) + ' mm (' + rr.gov + ')').join('; '), { kNm: true });
          if (abs(Nt) > 0.05 * bm.A * fyb) o.addU('Joint', 'MN', 'Moment + axial force', M / MjRd + abs(Nt) / max(1, Fsum), 'EN 1993-1-8 §6.2.7.1(3)', 'M_j,Ed/M_j,Rd + N_j,Ed/N_j,Rd');
          rowRes.forEach((rr, i) => o.add('Plates', 'R' + (i + 1), 'Bolt row ' + (i + 1) + ' tension resistance (' + rr.where + ')', rr.Feff * (M / max(MjRd, 1)), rr.F, 'kN', 'EN 1993-1-8 §6.2.4–6.2.6', 'min(end plate T-stub ' + kN(rr.tE.F).toFixed(0) + ', column flange T-stub ' + kN(rr.tC.F).toFixed(0) + ' kN) → ' + rr.gov, { info: true }));
          // bolts: tension from the row forces (plastic distribution scaled to the demand), shear shared by all bolts
          const nb = g.bolts.length, Vb = r.boltV(B), Bv = Vb.v, Ftmax = rowRes.reduce((a, rr) => max(a, rr.Feff * min(1, M / max(MjRd, 1)) / 2), 0);
          const nT = rowRes.length * 2, nC2 = nb - nT, VRd = nC2 * Bv + nT * 0.4 / 1.4 * Bv;
          o.add('Bolts', 'BV', 'Bolt group in shear (tension rows at 0.4/1.4)', V, VRd, 'kN', 'EN 1993-1-8 Tab 3.4 / §6.2.2', (nC2) + '·F_v,Rd + ' + nT + '·0.4/1.4·F_v,Rd, F_v,Rd = ' + kN(Bv).toFixed(1) + ' kN');
          o.add('Bolts', 'BT', 'Most loaded bolt in tension', Ftmax, Bt, 'kN', 'EN 1993-1-8 Tab 3.4', r.boltT(B).x);
          o.addU('Bolts', 'BVT', 'Bolt shear + tension', r.boltVT(B, V / nb, Ftmax, Bv, Bt).u, 'EN 1993-1-8 Tab 3.4', 'F_v,Ed/F_v,Rd + F_t,Ed/(1.4·F_t,Rd)');
          const bp1 = r.bear(B, tp, fuP(tp), 50, 0, (bp - gg) / 2, gg), bp2 = r.bear(B, tfc, fuP(tfc), 50, 0, (col.bf - gg) / 2, gg);
          o.add('Bolts', 'BB', 'Bearing on end plate / column flange', V / nb, min(bp1.v, bp2.v), 'kN', 'EN 1993-1-8 Tab 3.4', bp1.v <= bp2.v ? bp1.x : bp2.x);
          const pu = r.punch(B, min(tp, tfc), fuP(min(tp, tfc))); if (pu) o.add('Bolts', 'BP', 'Punching shear (thinner ply)', Ftmax, pu.v, 'kN', pu.ref, pu.x);
        }
        // welds: flange weld carries the flange force, web weld the shear
        const tw = r.fillet(af, 2, Ff / bm.bf, 0, 0, wfu, bwP);
        if (!P.butt || T === 'ep') o.addU('Welds', 'WF', 'Tension flange weld (a = ' + af + ' mm)', tw.u, tw.ref, tw.x + ', f = F_f/b_f = ' + (Ff / bm.bf).toFixed(0) + ' N/mm (double fillet)');
        else o.add('Welds', 'WF', 'Tension flange butt weld (full penetration = flange)', Ff, bm.bf * tfb * fyb, 'kN', 'EN 1993-1-8 §4.7.1', 'b_f·t_f·f_y');
        const hw = bm.d - bm.tf - bm.tf2, ww = r.fillet(aw, 2, 0, 0, V / hw, wfu, bwP);
        o.addU('Welds', 'WW', 'Web weld in shear (a = ' + aw + ' mm)', ww.u, ww.ref, ww.x);
        if (T === 'wld') { const k = min(tfc * fyc / (tfb * fyb), 1), beff = twc + 2 * rc + 7 * k * tfc, Ffc = beff * tfb * fyb / FAC.EN.M0; o.add('Column', 'CFT', 'Column flange (effective breadth of beam flange)', Ff, stiff ? Infinity : Ffc, 'kN', 'EN 1993-1-8 §6.2.6.4.3 / §4.10', 'b_eff·t_fb·f_yb/γ_M0, b_eff = t_w + 2s + 7k·t_fc = ' + beff.toFixed(0)); const Mc = Mcb; o.add('Beam', 'BM', 'Beam bending resistance at the column face', M, Mc, 'kNm', 'EN 1993-1-1 §6.2.5', 'W_pl·f_y/γ_M0', { kNm: true }); }
      } else {
        // AS 4100 / AISC 360: yield-line end plate (AISC DG16 / ASI DG10), column web local yielding and crippling, panel zone
        const phiY = code === 'AS' ? 0.9 : 1.0, k = tfc + rc, Nb = tfb + 2 * af, Rwy = phiY * fyc * twc * (5 * k + Nb), Rcr = 0.75 * 0.8 * twc * twc * (1 + 3 * (Nb / col.d) * Math.pow(twc / tfc, 1.5)) * sq(E * fyc * tfc / twc), Rpz = 0.9 * 0.6 * fyc * col.d * twc;
        const Ast = stiff ? 2 * ((col.bf - twc) / 2 - 10) * ts : 0, Rst = 0.9 * fyP(ts) * Ast;
        o.add('Column', 'CWY', 'Column web local yielding' + (stiff ? ' + stiffeners' : ''), Ff, Rwy + Rst, 'kN', code === 'AS' ? 'AS 4100 §5.13.3' : 'AISC J10.2', 'φ·F_y·t_w·(5k + l_b), k = ' + k.toFixed(1) + ', l_b = ' + Nb.toFixed(0) + (stiff ? ' + φ·f_y·A_st' : ''));
        o.add('Column', 'CWC', 'Column web crippling (compression flange)' + (stiff ? ' + stiffeners' : ''), Fc, Rcr + Rst, 'kN', code === 'AS' ? 'AS 4100 §5.13.4' : 'AISC J10.3', '0.75·0.80·t_w²·[1 + 3(l_b/d)(t_w/t_f)^1.5]·√(E·F_y·t_f/t_w)');
        o.add('Column', 'CWS', 'Column panel zone shear', M / z, Rpz, 'kN', code === 'AS' ? 'AS 4100 §5.11' : 'AISC J10.6', 'φ·0.6·F_y·d_c·t_w');
        o.add('Beam', 'BM', 'Beam bending resistance at the connection', M, Mcb, 'kNm', code === 'AS' ? 'AS 4100 §5.2' : 'AISC F2', 'φ·F_y·Z_x', { kNm: true });
        if (T === 'ep') {
          const ep = g.ep, tp = +P.tp || 20, bp = ep.bp, gg = ep.g, fyp = fyP(tp), zc = hog ? -(bm.d / 2 - tfb / 2) : bm.d / 2 - tfb / 2;
          const rows = ep.rows.map(zr => (hog ? zr : -zr)).filter(zr => zr > 0).sort((a, b) => b - a), zFl = bm.d / 2, zIn = bm.d / 2 - tfb;
          const outR = rows.filter(zr => zr > zFl), inR = rows.filter(zr => zr <= zFl), s = 0.5 * sq(bp * gg);
          let Yp, hs;
          if (outR.length && inR.length) { const h0 = outR[0] - zc, h1 = inR[0] - zc, pfo = outR[0] - zFl, pfi = min(zIn - inR[0], s); Yp = bp / 2 * (h1 * (1 / pfi + 1 / s) + h0 / pfo - 0.5) + 2 / gg * h1 * (pfi + s); hs = [h0, h1]; }
          else if (inR.length >= 2) { const h1 = inR[0] - zc, h2 = inR[1] - zc, pfi = min(zIn - inR[0], s), pb = inR[0] - inR[1]; Yp = bp / 2 * (h1 * (1 / pfi + 1 / s) + h2 / s - 0.5) + 2 / gg * (h1 * (pfi + 0.75 * pb) + h2 * (s + 0.25 * pb)) + gg / 2; hs = [h1, h2]; }
          else { const h1 = (inR[0] || outR[0] || zFl) - zc, pfi = max(10, min(abs(zIn - (inR[0] || zIn - 50)), s)); Yp = bp / 2 * (h1 * (1 / pfi + 1 / s) - 0.5) + 2 / gg * h1 * (pfi + s); hs = [h1]; }
          Yp = max(Yp, 1); const Mpl = 0.9 * fyp * tp * tp * Yp, Pt = code === 'AS' ? 0.8 * B.As * B.fu : 0.75 * B.Fnt * B.Ao, Mnp = 2 * Pt * hs.reduce((a, h) => a + h, 0), treq = sq(1.11 * M / (0.9 * fyp * max(Yp, 1)));
          o.add('Plates', 'EPY', 'End plate flexural yielding (yield-line)', M, Mpl, 'kNm', code === 'AS' ? 'ASI DG10 / AS 4100' : 'AISC DG16 Eq. 2.1', 'φ·F_yp·t_p²·Y_p, Y_p = ' + Yp.toFixed(0) + ' mm, t_p,req = ' + treq.toFixed(1) + ' mm', { kNm: true });
          o.add('Bolts', 'BTR', 'Bolt rupture without prying (thick plate)', M, Mnp, 'kNm', code === 'AS' ? 'AS 4100 §9.2.2.2' : 'AISC DG16 Eq. 3.1', 'φ·2·P_t·Σh_i, P_t = ' + kN(Pt / (code === 'AS' ? 0.8 : 0.75)).toFixed(0) + ' kN', { kNm: true });
          const c = outR.length && inR.length ? outR[0] - inR[0] : 0, sc = 0.5 * sq(col.bf * gg), h0 = hs[0], h1 = hs[1] || 0;
          const Yc = stiff ? col.bf / 2 * (h1 * (1 / sc + 2 / max(10, c - ts)) + h0 * (1 / sc + 2 / max(10, c - ts))) + 2 / gg * (h1 * (sc + (c - ts) / 2) + h0 * (sc + (c - ts) / 2)) : col.bf / 2 * (h1 / sc + h0 / sc) + 2 / gg * (h1 * (sc + 0.75 * c) + h0 * (sc + 0.25 * c) + c * c / 2) + gg / 2;
          o.add('Column', 'CFB', 'Column flange flexural yielding (yield-line)', M, 0.9 * fyc * tfc * tfc * Yc, 'kNm', code === 'AS' ? 'ASI DG10' : 'AISC DG16 Eq. 3.24', 'φ·F_yc·t_cf²·Y_c, Y_c = ' + Yc.toFixed(0) + ' mm' + (stiff ? ' (stiffened)' : ''), { kNm: true });
          const nb = g.bolts.length, Vb = r.boltV(B).v, Tb = M / max(1, hs.reduce((a, h) => a + h, 0)) / 2;
          o.add('Bolts', 'BV', 'Bolts in shear (compression-side bolts)', V, max(2, nb - 2 * hs.length) * Vb, 'kN', code === 'AS' ? 'AS 4100 §9.2.2.1' : 'AISC J3.6', r.boltV(B).x);
          o.addU('Bolts', 'BVT', 'Bolt shear + tension (most loaded bolt)', r.boltVT(B, V / nb, Tb, Vb, r.boltT(B).v).u, code === 'AS' ? 'AS 4100 §9.2.2.3' : 'AISC J3.7', r.boltVT(B, 1, 1, 1, 1).x);
          const b1 = r.bear(B, tp, fuP(tp), 50, 0), b2 = r.bear(B, tfc, fuP(tfc), 50, 0); o.add('Bolts', 'BB', 'Bearing on end plate / column flange', V / nb, min(b1.v, b2.v), 'kN', b1.ref, b1.v <= b2.v ? b1.x : b2.x);
        }
        if (!P.butt || T === 'ep') { const wf = r.fillet(af, 2, Ff / bm.bf, 0, 0, wfu); o.addU('Welds', 'WF', 'Tension flange weld (a = ' + af + ' mm)', wf.u, wf.ref, wf.x); }
        else o.add('Welds', 'WF', 'Tension flange CJP weld (= flange)', Ff, 0.9 * bm.bf * tfb * fyb, 'kN', code === 'AS' ? 'AS 4100 §9.6.2.7' : 'AISC J2.4 Tab J2.5', 'φ·b_f·t_f·F_y');
        const hw = bm.d - bm.tf - bm.tf2, ww = r.fillet(aw, 2, 0, 0, V / hw, wfu); o.addU('Welds', 'WW', 'Web weld in shear (a = ' + aw + ' mm)', ww.u, ww.ref, ww.x);
        if (T === 'wld' && !stiff) o.add('Column', 'CFL', 'Column flange local bending (tension flange)', Ff, 0.9 * 6.25 * fyc * tfc * tfc, 'kN', code === 'AS' ? 'AS 4100 / AISC J10.1' : 'AISC J10.1', 'φ·6.25·F_yf·t_f²');
      }
      // beam shear at the connection
      const Av = bm.d * bm.tw, vb = r.shearY(Av, fyb); o.add('Beam', 'BV', 'Beam web shear', V, vb.v, 'kN', vb.ref, vb.x);
    }
    // ---- tube branch welded to a tube chord (T-joint): CIDECT / EN 1993-1-8 Ch. 7 / AISC Ch. K
    function tubeChecks() {
      const ch = col, br = bm, th = g.tube.theta, s = Math.sin(th), Nb = abs(L.N), Mb = abs(L.My), fy0 = st(mat.steel, ch.t).fy;
      if (ch.kind === 'CHS') {
        const d1 = br.D || br.bf, beta = d1 / ch.D, gam = ch.D / (2 * ch.t);
        const Nrd = code === 'EN' ? Math.pow(gam, 0.2) * fy0 * ch.t * ch.t * (2.8 + 14.2 * beta * beta) / s / 1.0 : 0.9 * fy0 * ch.t * ch.t * (3.1 + 15.6 * beta * beta) * Math.pow(gam, 0.2) / s;
        o.add('Chord', 'CP', 'Chord plastification (CHS T-joint)', Nb, Nrd, 'kN', code === 'EN' ? 'EN 1993-1-8 Tab 7.2' : 'AISC K2.1 Tab K2.1', code === 'EN' ? 'γ^0.2·k_p·f_y0·t_0²·(2.8 + 14.2β²)/sinθ, β = ' + beta.toFixed(2) + ', γ = ' + gam.toFixed(1) : 'φ·F_y·t²·(3.1 + 15.6β²)·γ^0.2·Q_f/sinθ');
        const Mrd = (code === 'EN' ? 4.85 : 0.9 * 5.39) * fy0 * ch.t * ch.t * Math.sqrt(gam) * beta * d1 / s;
        if (Mb > 0) o.add('Chord', 'CM', 'Chord plastification under branch in-plane moment', Mb, Mrd, 'kNm', code === 'EN' ? 'EN 1993-1-8 Tab 7.5' : 'AISC K4', '4.85·f_y0·t_0²·√γ·β·d_1/sinθ', { kNm: true });
      } else {
        const b1 = br.B || br.bf, h1 = br.D || br.d, beta = b1 / ch.B, eta = h1 / ch.B, sb = sq(1 - min(0.999, beta));
        const Nrd = code === 'EN' ? fy0 * ch.t * ch.t / ((1 - min(0.999, beta)) * s) * (2 * eta / s + 4 * sb) : 0.9 * fy0 * ch.t * ch.t * (2 * eta / (1 - min(0.999, beta)) + 4 / sb) / s;
        o.add('Chord', 'CF', 'Chord face failure (RHS T-joint, β ≤ 0.85)', Nb, Nrd, 'kN', code === 'EN' ? 'EN 1993-1-8 Tab 7.11' : 'AISC K3.1 Tab K3.1', 'f_y0·t_0²/((1 − β)·sinθ)·(2η/sinθ + 4√(1 − β)), β = ' + beta.toFixed(2));
        if (beta > 0.85) { const bw = ch.D, Nsw = (code === 'EN' ? 1 : 0.9) * fy0 * ch.t * 2 * (h1 / s + 5 * ch.t) / s; o.add('Chord', 'CW', 'Chord side wall (β > 0.85)', Nb, Nsw, 'kN', code === 'EN' ? 'EN 1993-1-8 Tab 7.11' : 'AISC K3.1', 'f_y0·t_0·(2h_1/sinθ + 10t_0)/sinθ'); }
        if (Mb > 0) { const Mrd = (code === 'EN' ? 1 : 0.9) * fy0 * ch.t * ch.t * h1 * (1 / (2 * eta) + 2 / sb + eta / (1 - min(0.999, beta))); o.add('Chord', 'CM', 'Chord face under branch moment', Mb, Mrd, 'kNm', code === 'EN' ? 'EN 1993-1-8 Tab 7.14' : 'AISC K4', 'f_y0·t_0²·h_1·(1/(2η) + 2/√(1−β) + η/(1−β))', { kNm: true }); }
      }
      const a = +P.af || 8, per = br.kind === 'CHS' ? PI * br.D : 2 * ((br.B || br.bf) + (br.D || br.d)), fw = Nb / per + Mb / (br.kind === 'CHS' ? PI * br.D * br.D / 4 : (br.D || br.d) * (br.B || br.bf) + (br.D || br.d) ** 2 / 3);
      const w = r.fillet(a, 1, fw, 0, abs(L.Vz) / per, wfu, bwP); o.addU('Welds', 'WB', 'Branch perimeter weld (a = ' + a + ' mm)', w.u, w.ref, w.x);
      const Ab = br.A, ty = r.tensY(Ab, fyP(br.t || br.tf)); o.add('Member', 'BN', 'Branch axial resistance', Nb, ty.v, 'kN', ty.ref, ty.x);
    }
    // ---- fin plate (shear tab)
    function finChecks() {
      const f = g.fin, V = abs(L.Vz), N = L.N, tp = f.tp, fyp = fyP(tp), fup = fuP(tp), twb = bm.tw, fyb = fyP(twb), fub = fuP(twb), n = f.n, p = f.pitch, e1 = (f.hp - (n - 1) * p) / 2;
      const pts = Array.from({ length: n }, (_, i) => [0, ((n - 1) / 2 - i) * p]), G0 = group(pts, N, V, V * f.e);
      const bv = r.boltV(B); o.add('Bolts', 'BV', 'Most loaded bolt in shear (eccentric group, e = ' + f.e + ' mm)', G0.F, bv.v, 'kN', bv.ref, bv.x + '; F = √(F_h² + F_v²), F_v = V/n, F_h = N/n + V·e·z/Σz²');
      const b1 = r.bear(B, tp, fup, min(e1, f.e2), p, f.e2, 0), b2 = r.bear(B, twb, fub, min(f.e - f.gap, e1 + 200), p, 999, 0);
      o.add('Bolts', 'BB1', 'Bearing on fin plate', G0.F, b1.v, 'kN', b1.ref, b1.x); o.add('Bolts', 'BB2', 'Bearing on beam web', G0.F, b2.v, 'kN', b2.ref, b2.x);
      const Ag = f.hp * tp, An = (f.hp - n * B.d0) * tp, sy = r.shearY(Ag, fyp), sr = r.shearR(An, fup);
      o.add('Plates', 'FPV', 'Fin plate shear (gross)', V, code === 'EN' ? sy.v / 1.27 : sy.v, 'kN', sy.ref + (code === 'EN' ? ' / SCI P358' : ''), sy.x + (code === 'EN' ? ' /1.27' : ''));
      o.add('Plates', 'FPN', 'Fin plate shear (net)', V, sr.v, 'kN', sr.ref, sr.x);
      const bsF = r.block((f.hp - e1) * tp, ((f.hp - e1) - (n - 0.5) * B.d0) * tp, (f.e2 - 0.5 * B.d0) * tp, fyp, fup, true); o.add('Plates', 'FPB', 'Fin plate block shear', V, bsF.v, 'kN', bsF.ref, bsF.x);
      const bnd = r.bend(tp, f.hp, fyp); o.add('Plates', 'FPM', 'Fin plate bending at the bolt line (V·e)', V * f.e, bnd.v, 'kNm', bnd.ref, bnd.x, { kNm: true });
      const hw = bm.d - bm.tf - bm.tf2, Avw = bm.d * twb, sw = r.shearY(Avw, fyb); o.add('Beam', 'BV', 'Beam web shear', V, sw.v, 'kN', sw.ref, sw.x);
      const bsW = r.block((e1 + (n - 1) * p + 40) * twb, ((e1 + (n - 1) * p + 40) - (n - 0.5) * B.d0) * twb, (f.e - f.gap - 0.5 * B.d0) * twb, fyb, fub, true); o.add('Beam', 'BWB', 'Beam web block shear', V, bsW.v, 'kN', bsW.ref, bsW.x);
      const a = +P.a || 8, M = V * f.e, fl = V / f.hp, fn = abs(N) / f.hp + 6 * M / (f.hp * f.hp), w = r.fillet(a, 2, fn, 0, fl, wfu, bwP);
      o.addU('Welds', 'W1', 'Fin plate to column weld (double fillet a = ' + a + ' mm)', w.u, w.ref, w.x);
      if (code === 'EN') o.addU('Welds', 'W1d', 'Weld ductility (full strength: a ≥ 0.5·t_p for S275, 0.55·t_p for S355)', (fyp > 300 ? 0.55 : 0.5) * tp / a, 'SCI P358', 'a ≥ ' + ((fyp > 300 ? 0.55 : 0.5) * tp).toFixed(1) + ' mm');
    }
    // ---- flexible end plate (header)
    function hdrChecks() {
      const h = g.hdr, V = abs(L.Vz), N = L.N, tp = h.tp, fyp = fyP(tp), fup = fuP(tp), n = h.n * 2, faceT = J.p.to === 'web' ? col.tw : col.tf, e1 = (h.hp - (h.n - 1) * h.pitch) / 2, e2 = (h.bp - h.g) / 2;
      const bv = r.boltV(B), bt = r.boltT(B); o.add('Bolts', 'BV', 'Bolts in shear (' + n + ' bolts)', V / n, bv.v, 'kN', bv.ref, bv.x);
      if (N > 0) { o.add('Bolts', 'BT', 'Bolts in tension (tying)', N / n, bt.v, 'kN', bt.ref, bt.x); o.addU('Bolts', 'BVT', 'Shear + tension', r.boltVT(B, V / n, N / n, bv.v, bt.v).u, r.boltVT(B, 1, 1, 1, 1).ref, r.boltVT(B, 1, 1, 1, 1).x); }
      const b1 = r.bear(B, tp, fup, e1, h.pitch, e2, h.g), b2 = r.bear(B, faceT, fuP(faceT), 50, h.pitch, 999, h.g); o.add('Bolts', 'BB', 'Bearing on end plate / support', V / n, min(b1.v, b2.v), 'kN', b1.ref, b1.v <= b2.v ? b1.x : b2.x);
      const sy = r.shearY(2 * h.hp * tp, fyp), sr = r.shearR(2 * (h.hp - h.n * B.d0) * tp, fup); o.add('Plates', 'EPV', 'End plate shear (gross, 2 planes)', V, code === 'EN' ? sy.v / 1.27 : sy.v, 'kN', sy.ref, sy.x); o.add('Plates', 'EPN', 'End plate shear (net, 2 planes)', V, sr.v, 'kN', sr.ref, sr.x);
      const bs = r.block(2 * (h.hp - e1) * tp, 2 * ((h.hp - e1) - (h.n - 0.5) * B.d0) * tp, 2 * (e2 - 0.5 * B.d0) * tp, fyp, fup, false); o.add('Plates', 'EPB', 'End plate block shear', V, bs.v, 'kN', bs.ref, bs.x);
      const a = +P.a || 6, Lw = 2 * (h.hp - 2 * a), w = r.fillet(a, 1, abs(N) / Lw, 0, V / Lw, wfu, bwP); o.addU('Welds', 'W1', 'Beam web to end plate (2 × fillet a = ' + a + ' mm)', w.u, w.ref, w.x);
      const sw = r.shearY(h.hp * bm.tw, fyP(bm.tw)); o.add('Beam', 'BV', 'Beam web shear over the plate depth', V, sw.v, 'kN', sw.ref, sw.x);
    }
    // ---- double angle cleats
    function cltChecks() {
      const c = g.clt, V = abs(L.Vz), n = c.n, ta = c.ta, fya = fyP(ta), fua = fuP(ta), e1 = (c.hp - (n - 1) * c.pitch) / 2;
      const pts = Array.from({ length: n }, (_, i) => [0, ((n - 1) / 2 - i) * c.pitch]), ecc = c.la - c.e + 0, G0 = group(pts, 0, V, V * (c.la - c.e - (c.gap || 0)));
      const bv = r.boltV(B); o.add('Bolts', 'BVW', 'Web bolts in double shear (eccentric, e = ' + (c.la - c.e).toFixed(0) + ' mm)', G0.F / 2, bv.v, 'kN', bv.ref, bv.x + ' per plane');
      o.add('Bolts', 'BVC', 'Column bolts in single shear', V / (2 * n), bv.v, 'kN', bv.ref, bv.x);
      const b1 = r.bear(B, bm.tw, fuP(bm.tw), 999, c.pitch), b2 = r.bear(B, ta, fua, e1, c.pitch, c.e, 0); o.add('Bolts', 'BB1', 'Bearing on beam web', G0.F, b1.v, 'kN', b1.ref, b1.x); o.add('Bolts', 'BB2', 'Bearing on cleat', G0.F / 2, b2.v, 'kN', b2.ref, b2.x);
      const sy = r.shearY(2 * c.hp * ta, fya), sr = r.shearR(2 * (c.hp - n * B.d0) * ta, fua); o.add('Plates', 'CLV', 'Cleats in shear (gross)', V, sy.v, 'kN', sy.ref, sy.x); o.add('Plates', 'CLN', 'Cleats in shear (net)', V, sr.v, 'kN', sr.ref, sr.x);
      const bs = r.block(2 * (c.hp - e1) * ta, 2 * (c.hp - e1 - (n - 0.5) * B.d0) * ta, 2 * (c.e - 0.5 * B.d0) * ta, fya, fua, true); o.add('Plates', 'CLB', 'Cleat block shear', V, bs.v, 'kN', bs.ref, bs.x);
      const sw = r.shearY(bm.d * bm.tw, fyP(bm.tw)); o.add('Beam', 'BV', 'Beam web shear', V, sw.v, 'kN', sw.ref, sw.x);
    }
    // ---- column base plate (rectangular bearing stress block; anchors take the uplift)
    function baseChecks() {
      const b = g.base, cc = g.conc, Pu = -L.N, M = abs(L.My), Vx = abs(L.Vz), Vy = abs(L.Vy), tp = b.tp, fyp = fyP(tp), Lp = b.L, Bp = b.B, A = b.A, fc = cc.fc;
      const fb = r.bearC(fc, Lp * Bp, cc.pedB * cc.pedL), qmax = fb.v * Bp, xa = Lp / 2 - b.ex, nT = b.pos.filter(q => q[0] > 0.1).length || 2, nA = b.pos.length;
      let Y, T = 0, q;
      if (Pu > 0) { const e = M / Pu, ecrit = Lp / 2 - Pu / (2 * qmax); if (e <= ecrit) { Y = Lp - 2 * e; q = Pu / Y; } else { const k = (xa + Lp / 2) ** 2 - 2 * Pu * (e + xa) / qmax; Y = k >= 0 ? (xa + Lp / 2) - sq(k) : Lp; q = qmax; T = max(0, q * Y - Pu); if (k < 0) o.addU('Concrete', 'CB', 'Base plate too small for the moment', 9.99, 'AISC DG1 §3.4', '(f + N/2)² < 2P(e + f)/q_max'); } }
      else { const Pt = -Pu; T = Pt / nA * nT + M / (2 * xa); Y = M > 0 ? max(10, (T - Pt / nA * nT) / qmax) : 0; q = M > 0 ? qmax : 0; }
      if (q) o.add('Concrete', 'CB', 'Concrete bearing (stress block Y = ' + (Y || 0).toFixed(0) + ' mm)', q / Bp, fb.v, 'MPa', fb.ref, fb.x, { mpa: true });
      const isI = col.kind === 'I' || col.kind === 'BU', dc = col.d || col.D, bfc = col.bf || col.B || col.D, m = (Lp - 0.95 * dc) / 2, nn = (Bp - 0.8 * bfc) / 2, lam = isI ? sq(dc * bfc) / 4 : 0, l = max(m, nn, lam), fp = q ? q / Bp : 0;
      const tC = fp ? (Y >= l ? l * sq(2 * fp / (0.9 * fyp)) : sq(2 * fp * Y * (l - Y / 2) / (0.9 * fyp))) : 0, xT = xa - dc / 2 + (col.tf || col.t || 10) / 2, tT = T > 0 ? sq(4 * T * max(0, xT) / (0.9 * Bp * fyp)) : 0, treq = max(tC, tT);
      o.add('Plates', 'BPT', 'Base plate bending (required thickness)', treq, tp, 'mm', code === 'AISC' ? 'AISC DG1 Eq. 3.3.14' : code === 'AS' ? 'ASI DG7 / AS 4100' : 'EN 1993-1-8 §6.2.5 (T-stub, plastic)', 't_req = max(compression side ' + tC.toFixed(1) + ', tension side ' + tT.toFixed(1) + ') mm; t = l·√(2f_p/(φF_y)), l = max(m, n, λn\') = ' + l.toFixed(0), { mm: true });
      const at = r.ancT(A), av = r.ancV(A), Ta = nT ? T / nT : 0, Vfr = Pu > 0 ? FAC[code].mu * Pu : 0, Va = max(0, sq(Vx * Vx + Vy * Vy) - Vfr) / nA;
      o.add('Anchors', 'AT', 'Anchor tension (most loaded)', Ta, at.v, 'kN', at.ref, at.x);
      o.add('Anchors', 'AV', 'Anchor shear' + (Vfr ? ' (after friction ' + kN(Vfr).toFixed(0) + ' kN)' : ''), Va, av.v, 'kN', av.ref, av.x);
      if (Ta > 0 || Va > 0) { const iv = r.ancVT(Ta / at.v, Va / av.v); o.addU('Anchors', 'ATV', 'Anchor tension + shear (steel)', iv.u, iv.ref, iv.x); }
      if (T > 0) { const sy = 2 * (Bp / 2 - b.ey), cone = r.cone(fc, b.hef, 0, sy, nT), po = r.pull(fc, A.d); o.add('Anchors', 'ACC', 'Concrete cone breakout (tension anchors)', T, cone.v, 'kN', cone.ref, cone.x); o.add('Anchors', 'ACP', 'Anchor pullout', Ta, po.v, 'kN', po.ref, po.x); }
      // column to base plate welds
      const a = +P.a || 8, Aw = isI ? 2 * (2 * col.bf - col.tw) * a + 2 * (dc - 2 * col.tf) * a : (col.kind === 'CHS' ? PI * col.D : 2 * (col.B + col.D)) * a, Sw = isI ? 2 * col.bf * a * (dc - col.tf) : (col.kind === 'CHS' ? PI * col.D * col.D / 4 : col.B * col.D + col.D * col.D / 3) * a;
      const fnw = (abs(L.N) / Aw + M / Sw) * a, flw = (Vx / Aw) * a, w = r.fillet(a, 1, fnw, 0, flw, wfu, bwP); o.addU('Welds', 'WC', 'Column to base plate welds (a = ' + a + ' mm)', w.u, w.ref, w.x);
    }
    // ---- bolted cover-plate splice of an I-section
    function splChecks() {
      const s = g.spl, M = abs(L.My), N = L.N, V = abs(L.Vz), d = bm.d, Af = bm.bf * bm.tf, Aw = (d - 2 * bm.tf) * bm.tw, A = bm.A, I = bm.Iy || (2 * Af * ((d - bm.tf) / 2) ** 2 + bm.tw * (d - 2 * bm.tf) ** 3 / 12), Iw = bm.tw * (d - 2 * bm.tf) ** 3 / 12;
      const Mw = M * Iw / I, Mf = M - Mw, Ff = Mf / (d - bm.tf) + abs(N) * Af / A, nfb = 2 * s.nf, Fb = Ff / nfb, bv = r.boltV(B);
      o.add('Bolts', 'FBV', 'Flange bolts in single shear', Fb, bv.v, 'kN', bv.ref, bv.x);
      const b1 = r.bear(B, bm.tf, fuP(bm.tf), s.ef, s.pf, (bm.bf - s.gf) / 2, s.gf), b2 = r.bear(B, s.tfp, fuP(s.tfp), s.ef, s.pf, (s.bfp - s.gf) / 2, s.gf); o.add('Bolts', 'FBB', 'Flange bolts bearing (flange / cover plate)', Fb, min(b1.v, b2.v), 'kN', b1.ref, b1.v <= b2.v ? b1.x : b2.x);
      const fyp = fyP(s.tfp), fup = fuP(s.tfp), ty = r.tensY(s.bfp * s.tfp, fyp), tr = r.tensR((s.bfp - 2 * B.d0) * s.tfp, fup); o.add('Plates', 'FPY', 'Flange cover plate gross yielding', Ff, ty.v, 'kN', ty.ref, ty.x); o.add('Plates', 'FPR', 'Flange cover plate net section', Ff, tr.v, 'kN', tr.ref, tr.x);
      const cp = r.comp(s.bfp * s.tfp, fyp, E, 0.65 * (s.gap + 2 * s.ef), s.tfp / sq(12)); o.add('Plates', 'FPC', 'Flange cover plate in compression (between bolts)', Ff, cp.v, 'kN', cp.ref, cp.x);
      const tf = r.tensR((bm.bf - 2 * B.d0) * bm.tf, fuP(bm.tf)); o.add('Beam', 'BFN', 'Beam flange net section at the splice', Ff, tf.v, 'kN', tf.ref, tf.x);
      const bsF = r.block(2 * ((s.nf - 1) * s.pf + s.ef) * s.tfp, 2 * ((s.nf - 1) * s.pf + s.ef - (s.nf - 0.5) * B.d0) * s.tfp, (s.gf - B.d0) * s.tfp, fyp, fup, false); o.add('Plates', 'FPBS', 'Cover plate block shear', Ff, bsF.v, 'kN', bsF.ref, bsF.x);
      const ew = s.gap / 2 + 40 + (s.cw - 1) * s.pc / 2, pts = []; for (let c = 0; c < s.cw; c++) for (let i = 0; i < s.nw; i++) pts.push([c * s.pc, ((s.nw - 1) / 2 - i) * s.pw]); const Gw = group(pts, abs(N) * Aw / A, V, Mw + V * ew);
      o.add('Bolts', 'WBV', 'Web bolts in double shear (eccentric group)', Gw.F / 2, bv.v, 'kN', bv.ref, bv.x + ' per plane, e = ' + ew.toFixed(0) + ' mm');
      const b3 = r.bear(B, bm.tw, fuP(bm.tw), 40, s.pw), b4 = r.bear(B, s.twp, fuP(s.twp), 40, s.pw); o.add('Bolts', 'WBB', 'Web bolts bearing (web / plates)', Gw.F, min(b3.v, 2 * b4.v), 'kN', b3.ref, b3.v <= 2 * b4.v ? b3.x : '2 × ' + b4.x);
      const wv = r.shearY(2 * s.hwp * s.twp, fyP(s.twp)), wm2 = r.bend(2 * s.twp, s.hwp, fyP(s.twp)); o.add('Plates', 'WPV', 'Web plates in shear', V, wv.v, 'kN', wv.ref, wv.x); o.add('Plates', 'WPM', 'Web plates in bending', Mw + V * ew, wm2.v, 'kNm', wm2.ref, wm2.x, { kNm: true });
    }
    // ---- end-plate splice (I or hollow section)
    function speChecks() {
      const s = g.spe, M = abs(L.My), N = L.N, V = sq(L.Vz ** 2 + L.Vy ** 2), tp = s.tp, fyp = fyP(tp), fup = fuP(tp), H = bm.d || bm.D, nb = s.pos.length;
      const zc = -(H / 2) + (s.tube ? (bm.t || 10) / 2 : (bm.tf2 || 10) / 2), hs = s.pos.map(q => q[1] - zc).filter(h => h > H * 0.25), sum2 = hs.reduce((a, h) => a + h * h, 0) || 1;
      const Tb = M * max(...hs, 1) / sum2 + max(0, N) / nb, bt = r.boltT(B), bv = r.boltV(B);
      // prying (AISC Manual Part 9): b' = distance bolt → wall − d/2, p = tributary width
      const wall = s.tube ? (s.pos.length ? abs(abs(s.pos[0][1]) - H / 2) : 40) : max(30, (s.pos[0] ? s.pos[0][1] : H / 2) - H / 2), bp_ = max(5, wall - B.d / 2), p = s.tube ? (bm.kind === 'CHS' ? PI * (H + wall) / nb : s.W / 2) : s.W / 2, tc = sq(4 * bt.v / (0.9 * p * fup) * bp_);
      const alpha = tp >= tc ? 0 : min(1, max(0, ((tc / tp) ** 2 - 1) / (1 + (1 - B.d0 / p)))), Q = 1 + alpha * (1 - B.d0 / p) * (tp / tc) ** 2;
      o.add('Bolts', 'BT', 'Most loaded bolt in tension' + (alpha > 0 ? ' (with prying)' : ''), Tb * (tp >= tc ? 1 : 1 + 0.3 * alpha), bt.v, 'kN', bt.ref, bt.x);
      o.add('Bolts', 'BV', 'Bolt shear', V / nb, bv.v, 'kN', bv.ref, bv.x); o.addU('Bolts', 'BVT', 'Shear + tension', r.boltVT(B, V / nb, Tb, bv.v, bt.v).u, r.boltVT(B, 1, 1, 1, 1).ref, r.boltVT(B, 1, 1, 1, 1).x);
      const treq = sq(4 * Tb * bp_ / (0.9 * p * fyp)); o.add('Plates', 'EPT', 'End plate bending (required thickness, no prying)', treq, tp, 'mm', code === 'AISC' ? 'AISC Manual Part 9' : code === 'EN' ? 'EN 1993-1-8 §6.2.4 (T-stub mode 1)' : 'ASI DG / AS 4100', 't_req = √(4·T·b\'/(φ·p·F_y)), b\' = ' + bp_.toFixed(0) + ', p = ' + p.toFixed(0), { mm: true });
      const a = +P.a || 8, per = s.tube ? (bm.kind === 'CHS' ? PI * bm.D : 2 * (bm.B + bm.D)) : 2 * (2 * bm.bf - bm.tw) + 2 * (bm.d - 2 * bm.tf), Sw = s.tube ? (bm.kind === 'CHS' ? PI * bm.D * bm.D / 4 : bm.B * bm.D + bm.D * bm.D / 3) : 2 * bm.bf * (bm.d - bm.tf);
      const w = r.fillet(a, 1, abs(N) / per + M / Sw, 0, V / per, wfu, bwP); o.addU('Welds', 'W', 'Member to end plate welds (a = ' + a + ' mm)', w.u, w.ref, w.x);
    }
    // ---- brace to gusset plate
    function gusChecks() {
      const gu = g.gus, br = C.dims(J.mem.brace), N = L.N, Na = abs(N), tg = gu.tg, fyg = fyP(tg), fug = fuP(tg), tb = br.t || br.tf || 8, fyb = fyP(tb), fub = fuP(tb);
      if (!gu.angle) {
        const slot = tg + 2, An = br.A - 2 * slot * tb, xb = br.kind === 'CHS' ? br.D / PI : ((br.B || br.bf) ** 2 + 2 * (br.B || br.bf) * (br.D || br.d)) / (4 * ((br.B || br.bf) + (br.D || br.d))), U = max(0.5, 1 - xb / gu.Lw);
        const ty = r.tensY(br.A, fyb), tr = r.tensR(An, fub, code === 'EN' ? 1 : U); if (N > 0) { o.add('Brace', 'BTY', 'Brace gross yielding', Na, ty.v, 'kN', ty.ref, ty.x); o.add('Brace', 'BTR', 'Brace net section at the slot (shear lag)', Na, tr.v, 'kN', tr.ref, tr.x); }
        const a = +P.a || 6, w = r.fillet(a, 1, 0, 0, Na / (4 * gu.Lw), wfu, bwP); o.addU('Welds', 'WB', 'Brace to gusset welds (4 × ' + gu.Lw + ' mm, a = ' + a + ')', w.u, w.ref, w.x);
        const ww = 2 * gu.Lw * Math.tan(PI / 6) + gu.Wb, wy = r.tensY(ww * tg, fyg); o.add('Plates', 'GWY', 'Gusset Whitmore section (w = ' + ww.toFixed(0) + ' mm)' + (N > 0 ? ' yielding' : ''), Na, N > 0 ? wy.v : r.comp(ww * tg, fyg, E, 0.65 * max(60, gu.Hg / 2 / Math.sin(gu.th) - gu.Lw / 2), tg / sq(12)).v, 'kN', N > 0 ? wy.ref : 'AISC J4.4 / buckling', N > 0 ? wy.x : r.comp(ww * tg, fyg, E, 0.65 * max(60, gu.Hg / 2 / Math.sin(gu.th) - gu.Lw / 2), tg / sq(12)).x);
        if (N > 0) { const bs = r.block(2 * gu.Lw * tg, 2 * gu.Lw * tg, gu.Wb * tg, fyg, fug, false); o.add('Plates', 'GBS', 'Gusset block shear', Na, bs.v, 'kN', bs.ref, bs.x); }
      } else {
        const nb = Math.max(1, +P.nb | 0), bv = r.boltV(B); o.add('Bolts', 'BV', 'Bolts in single shear', Na / nb, bv.v, 'kN', bv.ref, bv.x);
        const b1 = r.bear(B, tb, fub, 40, +P.pb || 70), b2 = r.bear(B, tg, fug, 40, +P.pb || 70); o.add('Bolts', 'BB', 'Bearing (angle / gusset)', Na / nb, min(b1.v, b2.v), 'kN', b1.ref, b1.v <= b2.v ? b1.x : b2.x);
        const xb = (br.b2 * br.b2 + (br.b1 - br.t) * br.t) / (2 * (br.b1 + br.b2 - br.t)), Lc = (nb - 1) * (+P.pb || 70), U = nb > 1 ? max(0.4, 1 - xb / max(1, Lc)) : 0.4, tr = r.tensR(br.A - B.d0 * tb, fub, U);
        if (N > 0) o.add('Brace', 'BTR', 'Angle net section (shear lag U = ' + U.toFixed(2) + ')', Na, tr.v, 'kN', tr.ref, tr.x);
        const ww = 2 * Lc * Math.tan(PI / 6) + 0.1, wy = r.tensY(max(ww, B.d * 3) * tg, fyg); o.add('Plates', 'GWY', 'Gusset Whitmore section', Na, wy.v, 'kN', wy.ref, wy.x);
      }
      // gusset to member weld: brace components and the moment of their offset from the weld centre
      const H = Na * Math.cos(gu.th), Vv = Na * Math.sin(gu.th), Mw = H * gu.Hg / 2, Lg = gu.Lg, a = +P.a || 6, fn = Vv / Lg + 6 * Mw / (Lg * Lg), fl = H / Lg, w = r.fillet(a, 2, fn, 0, fl, wfu, bwP);
      o.addU('Welds', 'WG', 'Gusset to beam flange weld (double fillet a = ' + a + ', L = ' + Lg.toFixed(0) + ' mm)', w.u, w.ref, w.x);
    }
  }

  C.check = check; C.R = R; C.FAC = FAC; C.group = group;
})(typeof window !== 'undefined' ? window : globalThis);
