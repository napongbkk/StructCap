/* ============================================================
   StructCap — Reinforced Concrete Beam calculator
   Major/minor axis flexure & shear, torsion, combined checks,
   auto bar placement, multi-leg links, full calculation trace.
   ============================================================ */
"use strict";

const BeamPage = (() => {
  const { el, numberField, selectField, statTile, verdictPill, fmt, uid, solveFlexure, drawBeamSection, clamp } = StructCap;
  const area = (dia) => Math.PI * (dia / 2) ** 2;

  function defaultState(codeId) {
    const C = Codes[codeId];
    return {
      b: 300, h: 600, cover: 40,
      fc: 32, fy: 500,
      topBar: { dia: 16, n: 2 },
      bottomBar: { dia: 20, n: 4 },
      sideBar: { dia: 12, nPerSide: 1 },
      outerLink: { dia: 10, spacing: 150 },
      internalLinks: { count: 0, dia: 10 },
      fyt: 500,
      theta: C.thetaDefault,
      gammaC: C.gammaC || 1.5, gammaS: C.gammaS || 1.15,
      Mmaj: 250, Mmin: 20, Vmaj: 180, Vmin: 30, Tu: 15,
      Ms: 160, exposure: "moderate",
      showFullCalc: false,
    };
  }

  /* ---------- geometry engine: auto bar placement ---------- */
  function makeBars(s) {
    const ld = s.outerLink.dia;
    const yTop = s.cover + ld + s.topBar.dia / 2;
    const yBottom = s.h - s.cover - ld - s.bottomBar.dia / 2;
    const xLT = s.cover + ld + s.topBar.dia / 2, xRT = s.b - xLT;
    const xLB = s.cover + ld + s.bottomBar.dia / 2, xRB = s.b - xLB;
    const xLS = s.cover + ld + s.sideBar.dia / 2, xRS = s.b - xLS;
    const bars = [];
    const addRow = (n, y, xL, xR, dia, role) => {
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? (xL + xR) / 2 : xL + ((xR - xL) * i) / (n - 1);
        bars.push({ x, y, dia, role });
      }
    };
    if (s.topBar.n > 0 && s.topBar.dia > 0) addRow(s.topBar.n, yTop, xLT, xRT, s.topBar.dia, "top");
    if (s.bottomBar.n > 0 && s.bottomBar.dia > 0) addRow(s.bottomBar.n, yBottom, xLB, xRB, s.bottomBar.dia, "bottom");
    if (s.sideBar.nPerSide > 0 && s.sideBar.dia > 0) {
      for (let k = 1; k <= s.sideBar.nPerSide; k++) {
        const y = yTop + ((yBottom - yTop) * k) / (s.sideBar.nPerSide + 1);
        bars.push({ x: xLS, y, dia: s.sideBar.dia, role: "side" });
        bars.push({ x: xRS, y, dia: s.sideBar.dia, role: "side" });
      }
    }
    return { bars, yTop, yBottom };
  }

  /* ---------- axis-agnostic flexure solve ---------- */
  function solveAxis(codeId, s, bars, axis, steps) {
    const C = Codes[codeId];
    const coord = axis === "major" ? (bar) => bar.y : (bar) => bar.x;
    const width = axis === "major" ? s.b : s.h;
    const depth = axis === "major" ? s.h : s.b;
    const layers = bars.map(bar => ({ y: coord(bar), As: area(bar.dia) }));
    let flex, fyEff, ecu;
    const p = codeId === "EC" ? C.flexureParams(s.fc, s.gammaC) : C.flexureParams(s.fc);
    if (codeId === "EC") { fyEff = s.fy / s.gammaS; ecu = C.ecu2; }
    else { fyEff = s.fy; ecu = C.ecu; }
    flex = solveFlexure({ b: width, h: depth, layers, fc: s.fc, fy: fyEff, Es: C.Es, ecu, alpha: p.alpha, betaOf: p.betaOf });
    const phiFlex = codeId === "EC" ? 1.0 : C.phi.flexure;
    const MnPhi = phiFlex * flex.Mn / 1e6;
    if (steps) {
      steps.push(`— Flexure, ${axis} axis (${axis === "major" ? "width b × depth h" : "width h × depth b"}) —`);
      if (codeId === "EC") steps.push(`Design strengths: fcd = fck/γC = ${fmt(s.fc, 0)}/${fmt(s.gammaC, 2)} = ${fmt(s.fc / s.gammaC, 2)} MPa; fyd = fyk/γS = ${fmt(s.fy, 0)}/${fmt(s.gammaS, 2)} = ${fmt(fyEff, 1)} MPa.`);
      steps.push(`Trial section: width = ${fmt(width, 0)} mm, depth = ${fmt(depth, 0)} mm, ${layers.length} bar(s) considered.`);
      steps.push(`Equilibrium solved for neutral-axis depth c = ${fmt(flex.c, 1)} mm → stress-block depth a = β·c = ${fmt(flex.beta, 3)} × ${fmt(flex.c, 1)} = ${fmt(flex.a, 1)} mm.`);
      steps.push(`Concrete compression Cc = stress × width × a = ${fmt(flex.stress, 2)} × ${fmt(width, 0)} × ${fmt(flex.a, 1)} = ${fmt(flex.Cc / 1e3, 1)} kN.`);
      steps.push(`Nominal moment Mn = ${fmt(flex.Mn / 1e6, 1)} kN·m; design capacity = ${codeId === "EC" ? "Mn (materials already factored)" : `φ·Mn = ${fmt(phiFlex, 2)} × ${fmt(flex.Mn / 1e6, 1)}`} = ${fmt(MnPhi, 1)} kN·m.`);
    }
    return { flex, MnPhi };
  }

  /* ---------- shear (major or minor) ---------- */
  function solveShear(codeId, s, bars, axis, steps) {
    const C = Codes[codeId];
    const coord = axis === "major" ? (bar) => bar.y : (bar) => bar.x;
    const lim = axis === "major" ? s.h : s.b;
    const width = axis === "major" ? s.b : s.h;
    const tension = bars.filter(bar => coord(bar) > lim / 2);
    const Ast = tension.reduce((a, bar) => a + area(bar.dia), 0) || area(s.bottomBar.dia) * Math.max(1, s.bottomBar.n);
    const d = tension.length ? tension.reduce((a, bar) => a + area(bar.dia) * coord(bar), 0) / Ast : lim * 0.9;
    const nLegs = 2 + (s.internalLinks.count || 0);
    const Asv = 2 * area(s.outerLink.dia) + (s.internalLinks.count || 0) * area(s.internalLinks.dia);
    const theta = s.theta;

    let Vmax, Vc, Vs, VnPhi;
    if (codeId === "AS") {
      Vc = C.Vuc({ b: width, d, fc: s.fc, Ast });
      Vs = s.outerLink.spacing > 0 ? C.Vus({ Asv, fsy_v: s.fyt, d, s: s.outerLink.spacing, theta }) : 0;
      Vmax = C.VuMax({ b: width, d, fc: s.fc });
      VnPhi = C.phi.shear * Math.min(Vc + Vs, Vmax) / 1e3;
      if (steps) steps.push(`Shear (${axis}): φ=${C.phi.shear}, V_uc=${fmt(Vc / 1e3, 1)} kN, V_us=${fmt(Vs / 1e3, 1)} kN (θ=${fmt(theta, 1)}°), V_u,max=${fmt(Vmax / 1e3, 1)} kN → φV_u=${fmt(VnPhi, 1)} kN.`);
    } else if (codeId === "EC") {
      const z = 0.9 * d;
      const fywd = s.fyt / s.gammaS;
      Vc = C.VRdc({ b: width, d, fck: s.fc, Asl: Ast, Ac: width * lim, gammaC: s.gammaC });
      Vs = s.outerLink.spacing > 0 ? C.VRds({ Asw: Asv, s: s.outerLink.spacing, z, fywd, theta }) : 0;
      Vmax = C.VRdmax({ b: width, z, fck: s.fc, theta, gammaC: s.gammaC });
      VnPhi = Math.min(Vs > 0 ? Math.max(Vc, Vs) : Vc, Vmax) / 1e3;
      if (steps) steps.push(`Shear (${axis}): V_Rd,c=${fmt(Vc / 1e3, 1)} kN, V_Rd,s=${fmt(Vs / 1e3, 1)} kN (θ=${fmt(theta, 1)}°), V_Rd,max=${fmt(Vmax / 1e3, 1)} kN → V_Rd=${fmt(VnPhi, 1)} kN.`);
    } else {
      Vc = C.Vc({ b: width, d, fc: s.fc });
      Vs = s.outerLink.spacing > 0 ? C.Vs({ Av: Asv, fyt: s.fyt, d, s: s.outerLink.spacing, theta }) : 0;
      Vmax = Vc + C.VsMax({ b: width, d, fc: s.fc });
      VnPhi = C.phi.shear * Math.min(Vc + Vs, Vmax) / 1e3;
      if (steps) steps.push(`Shear (${axis}): φ=${C.phi.shear}, Vc=${fmt(Vc / 1e3, 1)} kN, Vs=${fmt(Vs / 1e3, 1)} kN (θ=${fmt(theta, 1)}°), Vmax=${fmt(Vmax / 1e3, 1)} kN → φVn=${fmt(VnPhi, 1)} kN.`);
    }
    return { Vc: Vc / 1e3, Vs: Vs / 1e3, Vmax: Vmax / 1e3, VnPhi, Ast, d, Asv, nLegs };
  }

  /* ---------- torsion ---------- */
  function solveTorsion(codeId, s, steps) {
    const C = Codes[codeId];
    const x = Math.min(s.b, s.h), y = Math.max(s.b, s.h);
    const Jt = C.Jt ? C.Jt({ x, y }) : x * x * y * (1 / 3 - 0.21 * (x / y) * (1 - Math.pow(x, 4) / (12 * Math.pow(y, 4))));
    const At = area(s.outerLink.dia); // one leg of closed outer link
    const ph = 2 * (s.b - 2 * s.cover - s.outerLink.dia) + 2 * (s.h - 2 * s.cover - s.outerLink.dia); // perimeter of link centreline
    const theta = s.theta;
    let Tmax, TReo, TnPhi, Al, extra = {};
    if (codeId === "AS") {
      const Tuc = C.Tuc({ Jt, fc: s.fc });
      Tmax = C.phi.torsion * C.TuMax({ Jt, fc: s.fc }) / 1e6;
      const Aoh = (s.b - 2 * s.cover - s.outerLink.dia) * (s.h - 2 * s.cover - s.outerLink.dia);
      const Ao = 0.85 * Aoh;
      const Tus = s.outerLink.spacing > 0 ? C.Tus({ At: Ao, Asw: At, fsy_v: s.fyt, s: s.outerLink.spacing, theta }) : 0;
      TReo = C.phi.torsion * Tus / 1e6;
      const needsTorsionReo = s.Tu * 1e6 > Tuc;
      TnPhi = needsTorsionReo ? C.phi.torsion * Tus / 1e6 : C.phi.torsion * Tuc / 1e6;
      Al = needsTorsionReo ? C.Al({ Asw: At, s: s.outerLink.spacing, ph, fsy_v: s.fyt, fsy: s.fy, theta }) : 0;
      extra.threshold = Tuc / 1e6; extra.reoRequired = needsTorsionReo;
      if (steps) steps.push(`Torsion: J_t≈${fmt(Jt / 1e6, 2)}×10⁶ mm³, T_uc(threshold)=${fmt(Tuc / 1e6, 2)} kN·m, φT_u,max=${fmt(Tmax, 2)} kN·m, φT_us=${fmt(TReo, 2)} kN·m (θ=${fmt(theta, 1)}°).`);
    } else if (codeId === "EC") {
      const u = 2 * (s.b + s.h);
      const A0 = s.b * s.h;
      const tef = Math.max(A0 / u, 2 * (s.cover + s.outerLink.dia / 2));
      const Ak = (s.b - tef) * (s.h - tef);
      const uk = 2 * ((s.b - tef) + (s.h - tef));
      const TRdmax = C.TRdmax({ Ak, tef, fck: s.fc, theta, gammaC: s.gammaC });
      const TRds = s.outerLink.spacing > 0 ? C.TRds({ Ak, Asw: At, s: s.outerLink.spacing, fywd: s.fyt / s.gammaS, theta }) : 0;
      Tmax = TRdmax / 1e6; TReo = TRds / 1e6; TnPhi = Math.min(TRdmax, TRds || TRdmax) / 1e6;
      Al = C.Asl({ TEd: s.Tu * 1e6, uk, Ak, fyd: s.fy / s.gammaS, theta });
      extra.Ak = Ak; extra.uk = uk;
      if (steps) steps.push(`Torsion: t_ef=${fmt(tef, 1)} mm, A_k=${fmt(Ak / 1e3, 1)}×10³ mm², T_Rd,max=${fmt(Tmax, 2)} kN·m, T_Rd,s=${fmt(TReo, 2)} kN·m (θ=${fmt(theta, 1)}°).`);
    } else {
      const Acp = s.b * s.h, pcp = 2 * (s.b + s.h);
      const Aoh = (s.b - 2 * s.cover - s.outerLink.dia) * (s.h - 2 * s.cover - s.outerLink.dia);
      const Ao = 0.85 * Aoh;
      const Tc = C.Tc({ Acp, pcp, fc: s.fc });
      Tmax = C.phi.torsion * C.TuMax({ Acp, pcp, fc: s.fc }) / 1e6;
      const Ts = s.outerLink.spacing > 0 ? C.Ts({ Ao, At, fyt: s.fyt, s: s.outerLink.spacing, theta }) : 0;
      TReo = C.phi.torsion * Ts / 1e6;
      const needsTorsionReoTH = s.Tu * 1e6 > Tc;
      TnPhi = needsTorsionReoTH ? C.phi.torsion * Ts / 1e6 : C.phi.torsion * Tc / 1e6;
      Al = needsTorsionReoTH ? C.Al({ At, s: s.outerLink.spacing, ph, fyt: s.fyt, fy: s.fy, theta }) : 0;
      extra.threshold = Tc / 1e6; extra.reoRequired = needsTorsionReoTH;
      if (steps) steps.push(`Torsion: Acp=${fmt(Acp / 1e3, 1)}×10³ mm², Tc(threshold)=${fmt(Tc / 1e6, 2)} kN·m, φTmax=${fmt(Tmax, 2)} kN·m, φTs=${fmt(TReo, 2)} kN·m (θ=${fmt(theta, 1)}°).`);
    }
    return { Tmax, TReo, TnPhi, Al, Jt, At, ph, ...extra };
  }

  /* ---------- full ULS assembly ---------- */
  function computeULS(codeId, s) {
    const C = Codes[codeId];
    const steps = s.showFullCalc ? [] : null;
    const { bars } = makeBars(s);

    const major = solveAxis(codeId, s, bars, "major", steps);
    const minor = solveAxis(codeId, s, bars, "minor", steps);
    const shearMaj = solveShear(codeId, s, bars, "major", steps);
    const shearMin = solveShear(codeId, s, bars, "minor", steps);
    const torsion = solveTorsion(codeId, s, steps);

    // combined shear + torsion interaction (web crushing)
    let combinedOK = true, combinedNote = "", combinedRatio = 0;
    if (codeId === "AS") {
      combinedOK = C.combinedOK({ V: s.Vmaj, phiVuMax: shearMaj.Vmax, T: s.Tu, phiTuMax: torsion.Tmax });
      combinedRatio = Math.pow(s.Vmaj / shearMaj.Vmax, 2) + Math.pow(s.Tu / torsion.Tmax, 2);
      combinedNote = `(V*/φVu,max)² + (T*/φTu,max)² = ${fmt(combinedRatio, 2)} ≤ 1.0`;
    } else if (codeId === "EC") {
      combinedOK = C.combinedOK({ T: s.Tu, TRdmax: torsion.Tmax, V: s.Vmaj, VRdmax: shearMaj.Vmax });
      combinedRatio = s.Tu / torsion.Tmax + s.Vmaj / shearMaj.Vmax;
      combinedNote = `(TEd/TRd,max) + (VEd/VRd,max) = ${fmt(combinedRatio, 2)} ≤ 1.0`;
    } else {
      const Aoh = (s.b - 2 * s.cover - s.outerLink.dia) * (s.h - 2 * s.cover - s.outerLink.dia);
      combinedOK = C.combinedOK({ V: s.Vmaj * 1e3, bw: s.b, d: shearMaj.d, T: s.Tu * 1e6, ph: torsion.ph, Aoh, fc: s.fc, phiShear: C.phi.shear });
      const stress = Math.sqrt(Math.pow((s.Vmaj * 1e3) / (s.b * shearMaj.d), 2) + Math.pow((s.Tu * 1e6 * torsion.ph) / (1.7 * Aoh * Aoh), 2));
      const limit = C.phi.shear * (0.17 * Math.sqrt(s.fc) + 0.66 * Math.sqrt(s.fc));
      combinedRatio = stress / limit;
      combinedNote = "ตรวจสอบหน่วยแรงรวม √((Vu/bwd)² + (Tu·ph/1.7Aoh²)²) ≤ φ(Vc/bwd + 0.66√fc)";
    }
    if (steps) steps.push(`— Combined shear + torsion — ${combinedNote} → ${combinedOK ? "OK" : "EXCEEDS LIMIT"}.`);

    // minimum reinforcement checks
    const AstProvided = bars.filter(b => b.y > s.h / 2).reduce((a, b) => a + area(b.dia), 0);
    let AstMinReq, AsvMinReq;
    if (codeId === "AS") {
      AstMinReq = C.AstMin({ b: s.b, d: shearMaj.d, D: s.h, fc: s.fc, fsy: s.fy });
      AsvMinReq = C.AsvMin({ b: s.b, fc: s.fc, fsy_v: s.fyt }) * s.outerLink.spacing;
    } else if (codeId === "EC") {
      AstMinReq = C.AsMin({ b: s.b, d: shearMaj.d, fck: s.fc, fyk: s.fy });
      AsvMinReq = C.AsvMin({ b: s.b, fck: s.fc, fyk: s.fyt }) * s.outerLink.spacing;
    } else {
      AstMinReq = C.AsMin({ b: s.b, d: shearMaj.d, fc: s.fc, fy: s.fy });
      AsvMinReq = C.AvMin({ b: s.b, fc: s.fc, fyt: s.fyt }) * s.outerLink.spacing;
    }
    const minReo = {
      flexOK: AstProvided >= AstMinReq, AstProvided, AstMinReq,
      shearOK: shearMaj.Asv >= AsvMinReq, AsvProvided: shearMaj.Asv, AsvMinReq,
    };
    if (steps) {
      steps.push(`— Minimum reinforcement —`);
      steps.push(`Ast,provided = ${fmt(AstProvided, 0)} mm² vs Ast,min = ${fmt(AstMinReq, 0)} mm² → ${minReo.flexOK ? "OK" : "NOT SATISFIED"}.`);
      steps.push(`Asv,provided = ${fmt(shearMaj.Asv, 0)} mm² (all legs) vs Asv,min = ${fmt(AsvMinReq, 0)} mm² per spacing → ${minReo.shearOK ? "OK" : "NOT SATISFIED"}.`);
    }

    return { major, minor, shearMaj, shearMin, torsion, combinedOK, combinedNote, combinedRatio, minReo, bars, steps };
  }

  // AS 3600:2018 Table 8.6.1(A)/(B) — deemed-to-comply crack control by bar diameter / spacing vs steel stress
  const AS_CRACK_TABLE = [
    { fs: 200, db: 32, spacing: 300 },
    { fs: 250, db: 32, spacing: 300 },
    { fs: 300, db: 25, spacing: 250 },
    { fs: 350, db: 20, spacing: 200 },
    { fs: 400, db: 16, spacing: 150 },
    { fs: 450, db: 12, spacing: 100 },
    { fs: 500, db: 10, spacing: 50 },
  ];
  function interpTable(table, key, fs) {
    if (fs <= table[0].fs) return table[0][key];
    for (let i = 0; i < table.length - 1; i++) {
      if (fs >= table[i].fs && fs <= table[i + 1].fs) {
        const t = (fs - table[i].fs) / (table[i + 1].fs - table[i].fs);
        return table[i][key] + t * (table[i + 1][key] - table[i][key]);
      }
    }
    return table[table.length - 1][key];
  }

  /* ---------- SLS (major axis service check) ---------- */
  function computeSLS(codeId, s) {
    const C = Codes[codeId];
    const { bars } = makeBars(s);
    const Ec = 4700 * Math.sqrt(s.fc);
    const n = C.Es / Ec;
    const tension = bars.filter(b => b.y > s.h / 2);
    const Ast = tension.reduce((a, b) => a + area(b.dia), 0);
    const d = Ast ? tension.reduce((a, b) => a + area(b.dia) * b.y, 0) / Ast : s.h * 0.9;
    const A = s.b / 2, B = n * Ast, Cc = -n * Ast * d;
    const x = (-B + Math.sqrt(B * B - 4 * A * Cc)) / (2 * A);
    const Icr = (s.b * Math.pow(x, 3)) / 3 + n * Ast * Math.pow(d - x, 2);
    const Ms = s.Ms * 1e6;
    const fs = (n * Ms * (d - x)) / Icr;
    const mainLayer = tension.reduce((best, b) => (!best || area(b.dia) > area(best.dia) ? b : best), null) || { y: d, dia: s.bottomBar.dia };
    const barsAtLayer = tension.filter(b => Math.abs(b.y - mainLayer.y) < 1).length || Math.max(1, s.bottomBar.n);
    const dc = s.h - mainLayer.y + mainLayer.dia / 2;
    const Aeff = (2 * dc * s.b) / barsAtLayer;
    const beta = (s.h - x) / (d - x);
    const w = 0.011 * C.crackWidthFactor * beta * fs * Math.cbrt(dc * Aeff) * 1e-3;
    const limits = { moderate: 0.3, aggressive: 0.2, mild: 0.4 };
    const wLimit = limits[s.exposure] ?? 0.3;

    let as = null;
    if (codeId === "AS") {
      const bottomBars = bars.filter(b => b.role === "bottom").sort((a, b) => a.x - b.x);
      const actualDb = s.bottomBar.dia;
      const actualSpacing = bottomBars.length > 1 ? (bottomBars[1].x - bottomBars[0].x) : null;
      const dbMax = interpTable(AS_CRACK_TABLE, "db", fs);
      const spacingMax = interpTable(AS_CRACK_TABLE, "spacing", fs);
      as = {
        actualDb, actualSpacing, dbMax, spacingMax,
        okDb: actualDb <= dbMax,
        okSpacing: actualSpacing === null ? true : actualSpacing <= spacingMax,
      };
    }
    return { fs, w, wLimit, x, Icr, d, n, dc, bars, as };
  }

  /* ---------- small input-row builder ---------- */
  function triNumber(idPrefix, labels, values, units, onChange) {
    return el("div", { class: "field-grid-3" }, labels.map((lab, i) => {
      const input = el("input", { type: "number", id: idPrefix + i, value: values[i], class: "field-input" });
      input.addEventListener("input", () => onChange(i, +input.value || 0));
      return el("label", { class: "field", for: idPrefix + i }, [
        el("span", { class: "field-label" }, lab),
        el("div", { class: "field-row" }, [input, units[i] ? el("span", { class: "field-unit" }, units[i]) : null])
      ]);
    }));
  }

  function render(container, codeId) {
    const C = Codes[codeId];
    const th = codeId === "TH";
    const s = defaultState(codeId);
    const T = th ? TH_STR : {
      geometry: "Beam Geometry", width: "Width b", depth: "Overall depth h", cover: "Cover to link",
      concreteGrade: `Concrete ${C.fcLabel}`, steelGrade: `Rebar yield ${C.fyLabel}`,
      calculate: "Calculate", pass: "OK", fail: "FAIL",
      serviceLoads: "Service (SLS) moment", crackWidth: "Crack width", steelStress: "Steel stress",
      disclaimer: "Preliminary design tool. Simplified methods — a qualified engineer must independently verify all results before use.",
      major: "Major axis", minor: "Minor axis", topBar: "Top bars", bottomBar: "Bottom bars", sideBar: "Side bars (per face)",
      outerLink: "Outer link", internalLink: "Internal links", theta: "Strut angle θ",
      fullCalc: "Show full calculation", hideCalc: "Hide full calculation",
      vmax: "V max", vc: "V concrete", vs: "V steel", tmax: "T max", treo: "T reinforcement",
      combined: "Shear + torsion interaction", longTorsion: "Longitudinal torsion steel", minReo: "Minimum reinforcement",
    };

    container.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [
        el("h1", {}, C.strings.beamTitle),
        el("p", { class: "muted" }, C.strings.refConcrete)
      ]),
      el("div", { class: "tabs", id: "beamTabs" }, [
        el("button", { class: "tab active", "data-tab": "uls" }, C.strings.uls),
        el("button", { class: "tab", "data-tab": "sls" }, C.strings.sls),
      ])
    ]));

    const grid = el("div", { class: "beam-grid" });
    container.appendChild(grid);
    const form = el("div", { class: "panel form-panel" });
    grid.appendChild(form);

    /* geometry */
    form.appendChild(el("h3", {}, T.geometry));
    form.appendChild(el("div", { class: "field-grid-3" }, [
      numberField({ id: "b", label: T.width, value: s.b, unit: "mm" }),
      numberField({ id: "h", label: T.depth, value: s.h, unit: "mm" }),
      numberField({ id: "cover", label: T.cover, value: s.cover, unit: "mm" }),
    ]));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "fc", label: T.concreteGrade, value: s.fc, unit: "MPa" }),
      numberField({ id: "fy", label: T.steelGrade, value: s.fy, unit: "MPa" }),
    ]));
    if (codeId === "EC") {
      form.appendChild(el("div", { class: "field-grid-2" }, [
        numberField({ id: "gammaC", label: "Partial factor γC", value: s.gammaC, unit: "", hint: "EN 1992-1-1 Table 2.1N — persistent/transient 1.5" }),
        numberField({ id: "gammaS", label: "Partial factor γS", value: s.gammaS, unit: "", hint: "persistent/transient 1.15" }),
      ]));
      form.appendChild(el("p", { class: "field-hint", id: "fcdFydNote" }, `Design strengths: fcd = fck/γC = ${fmt(s.fc / s.gammaC, 2)} MPa · fyd = fyk/γS = ${fmt(s.fy / s.gammaS, 1)} MPa`));
    }

    /* longitudinal bars */
    form.appendChild(el("h3", {}, th ? "เหล็กเสริมตามยาว" : "Longitudinal Reinforcement"));
    const barBlock = (label, key, extra) => {
      const nId = key + (extra === "nPerSide" ? "NperSide" : "N");
      return el("div", { class: "bar-row" }, [
        el("span", { class: "bar-row-label" }, label),
        el("input", { type: "number", id: key + "Dia", value: s[key].dia, class: "cell-input", style: "width:56px" }),
        el("span", { class: "field-unit" }, "⌀mm"),
        el("input", { type: "number", id: nId, value: s[key][extra], class: "cell-input", style: "width:48px" }),
        el("span", { class: "field-unit" }, extra === "nPerSide" ? (th ? "เส้น/ด้าน" : "per face") : (th ? "เส้น" : "bars")),
      ]);
    };
    form.appendChild(barBlock(T.topBar, "topBar", "n"));
    form.appendChild(barBlock(T.bottomBar, "bottomBar", "n"));
    form.appendChild(barBlock(T.sideBar, "sideBar", "nPerSide"));
    form.appendChild(el("p", { class: "field-hint" }, th ? "ตำแหน่งเหล็กคำนวณอัตโนมัติจากระยะหุ้มคอนกรีตและปลอก" : "Bar positions are calculated automatically from cover + link diameter."));

    /* shear links */
    form.appendChild(el("h3", {}, T.stirrups || (th ? "เหล็กปลอก" : "Shear Links")));
    form.appendChild(el("div", { class: "field-grid-3" }, [
      numberField({ id: "olDia", label: T.outerLink, value: s.outerLink.dia, unit: "mm", hint: th ? "2 ขา (อัตโนมัติ)" : "2 legs (auto)" }),
      numberField({ id: "olSpc", label: th ? "ระยะห่าง s" : "Spacing s", value: s.outerLink.spacing, unit: "mm" }),
      numberField({ id: "fyt", label: th ? "กำลังคราก fyt" : "Link yield fyt", value: s.fyt, unit: "MPa" }),
    ]));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "ilCount", label: T.internalLink, value: s.internalLinks.count, unit: th ? "ขา" : "extra legs" }),
      numberField({ id: "ilDia", label: th ? "ขนาดปลอกภายใน" : "Internal link ⌀", value: s.internalLinks.dia, unit: "mm" }),
    ]));
    const [tMin, tMax] = C.thetaRange;
    form.appendChild(numberField({ id: "theta", label: T.theta, value: s.theta, unit: "°", hint: `${th ? "ช่วง" : "range"} ${tMin}–${tMax}°` }));

    /* ULS actions */
    const ulsBlock = el("div", { id: "ulsInputs" }, [
      el("h3", {}, th ? "แรงกระทำที่สภาวะประลัย (ULS)" : "ULS design actions"),
      el("p", { class: "field-hint sub-hint" }, T.major),
      el("div", { class: "field-grid-2" }, [
        numberField({ id: "Mmaj", label: th ? "โมเมนต์ Mu (แกนหลัก)" : "M* major axis", value: s.Mmaj, unit: "kN·m" }),
        numberField({ id: "Vmaj", label: th ? "แรงเฉือน Vu (แกนหลัก)" : "V* major axis", value: s.Vmaj, unit: "kN" }),
      ]),
      el("p", { class: "field-hint sub-hint" }, T.minor),
      el("div", { class: "field-grid-2" }, [
        numberField({ id: "Mmin", label: th ? "โมเมนต์ Mu (แกนรอง)" : "M* minor axis", value: s.Mmin, unit: "kN·m" }),
        numberField({ id: "Vmin", label: th ? "แรงเฉือน Vu (แกนรอง)" : "V* minor axis", value: s.Vmin, unit: "kN" }),
      ]),
      numberField({ id: "Tu", label: th ? "แรงบิด Tu" : "T* torsion", value: s.Tu, unit: "kN·m" }),
    ]);
    const slsBlock = el("div", { id: "slsInputs", class: "hidden" }, [
      el("h3", {}, th ? "แรงกระทำที่สภาวะใช้งาน (SLS)" : "Service (SLS) actions"),
      numberField({ id: "Ms", label: th ? "โมเมนต์ใช้งาน Ms" : "Ms (service moment)", value: s.Ms, unit: "kN·m" }),
      selectField({
        id: "exposure", label: th ? "สภาวะแวดล้อม" : "Exposure classification", value: s.exposure,
        options: [
          { value: "mild", label: th ? "ทั่วไป (0.4 mm)" : "Mild (0.4 mm limit)" },
          { value: "moderate", label: th ? "ปานกลาง (0.3 mm)" : "Moderate (0.3 mm limit)" },
          { value: "aggressive", label: th ? "รุนแรง (0.2 mm)" : "Aggressive (0.2 mm limit)" },
        ]
      })
    ]);
    form.appendChild(ulsBlock);
    form.appendChild(slsBlock);

    /* right panel */
    const right = el("div", { class: "panel result-panel" });
    grid.appendChild(right);
    const diagramHost = el("div", { class: "diagram-host" });
    const resultsHost = el("div", { class: "results-host" });
    right.appendChild(el("h3", {}, th ? "รูปตัด" : "Section"));
    right.appendChild(diagramHost);
    right.appendChild(resultsHost);

    container.appendChild(el("p", { class: "disclaimer" }, "⚠ " + T.disclaimer));

    /* ---------- binding ---------- */
    function bindNumber(id, setter) {
      const i = container.querySelector("#" + id);
      i.addEventListener("input", () => { setter(+i.value || 0); recompute(); });
    }
    bindNumber("b", v => s.b = v);
    bindNumber("h", v => s.h = v);
    bindNumber("cover", v => s.cover = v);
    bindNumber("fc", v => s.fc = v);
    bindNumber("fy", v => s.fy = v);
    if (codeId === "EC") {
      bindNumber("gammaC", v => s.gammaC = v || 1.5);
      bindNumber("gammaS", v => s.gammaS = v || 1.15);
    }
    bindNumber("topBarDia", v => s.topBar.dia = v);
    bindNumber("topBarN", v => s.topBar.n = v);
    bindNumber("bottomBarDia", v => s.bottomBar.dia = v);
    bindNumber("bottomBarN", v => s.bottomBar.n = v);
    bindNumber("sideBarDia", v => s.sideBar.dia = v);
    bindNumber("sideBarNperSide", v => s.sideBar.nPerSide = v);
    bindNumber("olDia", v => s.outerLink.dia = v);
    bindNumber("olSpc", v => s.outerLink.spacing = v);
    bindNumber("fyt", v => s.fyt = v);
    bindNumber("ilCount", v => s.internalLinks.count = Math.max(0, Math.round(v)));
    bindNumber("ilDia", v => s.internalLinks.dia = v);
    bindNumber("theta", v => s.theta = clamp(v, tMin, tMax));
    bindNumber("Mmaj", v => s.Mmaj = v);
    bindNumber("Vmaj", v => s.Vmaj = v);
    bindNumber("Mmin", v => s.Mmin = v);
    bindNumber("Vmin", v => s.Vmin = v);
    bindNumber("Tu", v => s.Tu = v);
    bindNumber("Ms", v => s.Ms = v);
    container.querySelector("#exposure").addEventListener("change", (e) => { s.exposure = e.target.value; recompute(); });

    let activeTab = "uls";
    container.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
      container.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      activeTab = t.dataset.tab;
      container.querySelector("#ulsInputs").classList.toggle("hidden", activeTab !== "uls");
      container.querySelector("#slsInputs").classList.toggle("hidden", activeTab !== "sls");
      recompute();
    }));

    function recompute() {
      if (codeId === "EC") {
        const note = container.querySelector("#fcdFydNote");
        if (note) note.textContent = `Design strengths: fcd = fck/γC = ${fmt(s.fc / s.gammaC, 2)} MPa · fyd = fyk/γS = ${fmt(s.fy / s.gammaS, 1)} MPa`;
      }
      diagramHost.innerHTML = "";
      resultsHost.innerHTML = "";
      let naMaj = null, naMin = null;
      try {
        if (activeTab === "uls") {
          const r = computeULS(codeId, s);
          naMaj = r.major.flex.c; naMin = r.minor.flex.c;
          const okMmaj = s.Mmaj <= r.major.MnPhi, okMmin = s.Mmin <= r.minor.MnPhi;
          const okVmaj = s.Vmaj <= r.shearMaj.VnPhi, okVmin = s.Vmin <= r.shearMin.VnPhi;
          const okT = s.Tu <= r.torsion.TnPhi;

          resultsHost.appendChild(el("h3", { class: "results-h" }, th ? "โมเมนต์ดัด" : "Moment capacity"));
          resultsHost.appendChild(el("div", { class: "stat-grid" }, [
            statTile({ label: T.major, value: fmt(r.major.MnPhi), unit: "kN·m", tone: okMmaj ? "good" : "bad" }),
            statTile({ label: T.minor, value: fmt(r.minor.MnPhi), unit: "kN·m", tone: okMmin ? "good" : "bad" }),
          ]));
          resultsHost.appendChild(checkRow(th ? "โมเมนต์หลัก" : "Major moment", s.Mmaj, r.major.MnPhi, "kN·m", okMmaj, T));
          resultsHost.appendChild(checkRow(th ? "โมเมนต์รอง" : "Minor moment", s.Mmin, r.minor.MnPhi, "kN·m", okMmin, T));

          resultsHost.appendChild(el("h3", { class: "results-h" }, th ? "แรงเฉือน" : "Shear capacity"));
          [["major", r.shearMaj, okVmaj, s.Vmaj], ["minor", r.shearMin, okVmin, s.Vmin]].forEach(([axKey, sh, ok, demand]) => {
            resultsHost.appendChild(el("p", { class: "axis-label" }, axKey === "major" ? T.major : T.minor));
            resultsHost.appendChild(el("div", { class: "stat-grid stat-grid-3" }, [
              statTile({ label: T.vmax, value: fmt(sh.Vmax), unit: "kN" }),
              statTile({ label: T.vc, value: fmt(sh.Vc), unit: "kN" }),
              statTile({ label: T.vs, value: fmt(sh.Vs), unit: "kN" }),
            ]));
            resultsHost.appendChild(checkRow(axKey === "major" ? (th ? "แรงเฉือนหลัก" : "Major shear") : (th ? "แรงเฉือนรอง" : "Minor shear"), demand, sh.VnPhi, "kN", ok, T));
          });

          resultsHost.appendChild(el("h3", { class: "results-h" }, th ? "แรงบิด" : "Torsion capacity"));
          resultsHost.appendChild(el("div", { class: "stat-grid stat-grid-3" }, [
            statTile({ label: T.tmax, value: fmt(r.torsion.Tmax), unit: "kN·m" }),
            statTile({ label: T.treo, value: fmt(r.torsion.TReo), unit: "kN·m" }),
            statTile({ label: T.longTorsion, value: fmt(r.torsion.Al, 0), unit: "mm²" }),
          ]));
          resultsHost.appendChild(checkRow(th ? "แรงบิด" : "Torsion", s.Tu, r.torsion.TnPhi, "kN·m", okT, T));

          resultsHost.appendChild(el("h3", { class: "results-h" }, T.combined));
          resultsHost.appendChild(el("p", { class: "formula-note" }, r.combinedNote));
          resultsHost.appendChild(checkRow(th ? "ผลรวม" : "Combined", r.combinedRatio, 1.0, "", r.combinedOK, T, 2));

          resultsHost.appendChild(el("h3", { class: "results-h" }, T.minReo));
          resultsHost.appendChild(checkRow(th ? "เหล็กดัดขั้นต่ำ" : "Min. flexural steel", r.minReo.AstMinReq, r.minReo.AstProvided, "mm²", r.minReo.flexOK, T, 0));
          resultsHost.appendChild(checkRow(th ? "เหล็กปลอกขั้นต่ำ" : "Min. shear steel", r.minReo.AsvMinReq, r.minReo.AsvProvided, "mm²", r.minReo.shearOK, T, 0));

          resultsHost.appendChild(calcToggle(s, recompute, th));
          if (s.showFullCalc && r.steps) {
            resultsHost.appendChild(el("div", { class: "calc-trace" }, r.steps.map(line => el("p", {}, line))));
          }
        } else if (codeId === "AS") {
          const r = computeSLS(codeId, s);
          naMaj = r.x;
          resultsHost.appendChild(el("div", { class: "stat-grid stat-grid-3" }, [
            statTile({ label: T.steelStress, value: fmt(r.fs), unit: "MPa" }),
            statTile({ label: "Max bar ⌀ (db,max)", value: fmt(r.as.dbMax, 1), unit: "mm", tone: r.as.okDb ? "good" : "bad" }),
            statTile({ label: "Max spacing", value: r.as.actualSpacing === null ? "N/A" : fmt(r.as.spacingMax, 0), unit: r.as.actualSpacing === null ? "" : "mm", tone: r.as.okSpacing ? "good" : "bad" }),
          ]));
          resultsHost.appendChild(checkRow("Bar diameter (deemed-to-comply)", r.as.actualDb, r.as.dbMax, "mm", r.as.okDb, T, 0));
          if (r.as.actualSpacing !== null) {
            resultsHost.appendChild(checkRow("Bar spacing (deemed-to-comply)", r.as.actualSpacing, r.as.spacingMax, "mm", r.as.okSpacing, T, 0));
          } else {
            resultsHost.appendChild(el("p", { class: "formula-note" }, "Only one bottom bar — spacing limit not applicable; diameter check governs."));
          }
          resultsHost.appendChild(el("p", { class: "formula-note" }, `AS 3600:2018 Table 8.6.1(A)/(B) — crack control for tension, interpolated at fs = ${fmt(r.fs, 0)} MPa (values linearly interpolated between the standard table points; deemed-to-comply route, no direct crack-width calculation required by AS3600).`));
        } else {
          const r = computeSLS(codeId, s);
          naMaj = r.x;
          const okW = r.w <= r.wLimit;
          resultsHost.appendChild(el("div", { class: "stat-grid" }, [
            statTile({ label: T.steelStress, value: fmt(r.fs), unit: "MPa" }),
            statTile({ label: T.crackWidth, value: fmt(r.w, 3), unit: "mm", tone: okW ? "good" : "bad" }),
            statTile({ label: th ? "ขีดจำกัด" : "Limit", value: fmt(r.wLimit, 2), unit: "mm" }),
          ]));
          resultsHost.appendChild(checkRow(T.crackWidth, r.w, r.wLimit, "mm", okW, T, 3));
          resultsHost.appendChild(el("p", { class: "formula-note" }, (th ? "สมการ Gergely–Lutz (โดยประมาณ): " : "Gergely–Lutz indicative estimate: ") + `w = 0.011·β·fs·(dc·A)^⅓ · n = ${fmt(r.n, 2)}, x = ${fmt(r.x, 0)} mm, dc = ${fmt(r.dc, 0)} mm`));
        }
      } catch (e) {
        resultsHost.appendChild(el("p", { class: "formula-note" }, "Could not solve section — check inputs (" + e.message + ")"));
      }

      const { bars } = makeBars(s);
      diagramHost.appendChild(drawBeamSection({
        b: s.b, h: s.h, cover: s.cover, bars,
        outerLink: s.outerLink, internalLinks: s.internalLinks,
        neutralAxisMajor: naMaj, neutralAxisMinor: naMin
      }));
    }

    recompute();
  }

  function checkRow(label, demand, capacity, unit, ok, T, dec = 1) {
    const ur = capacity > 0 ? demand / capacity : NaN;
    return el("table", { class: "check-table" }, el("tbody", {}, el("tr", {}, [
      el("td", {}, label),
      el("td", {}, `${fmt(demand, dec)} / ${fmt(capacity, dec)} ${unit}`),
      el("td", { class: "ur-cell" }, el("span", { class: "ur-pill" + (ur > 1 ? " ur-over" : "") }, "UR " + fmt(ur, 2))),
      el("td", {}, verdictPill(ok, T.pass, T.fail))
    ])));
  }

  function calcToggle(s, recompute, th) {
    const btn = el("button", { class: "btn-secondary calc-toggle-btn" }, s.showFullCalc ? (th ? "ซ่อนการคำนวณ" : "Hide full calculation") : (th ? "แสดงการคำนวณแบบเต็ม" : "Show full calculation"));
    btn.addEventListener("click", () => { s.showFullCalc = !s.showFullCalc; recompute(); });
    return btn;
  }

  return { render, defaultState, computeULS, computeSLS, makeBars };
})();
