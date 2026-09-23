/* ============================================================
   StructCap — Pile Cap Design
   Rigid-cap pile reactions, one-way shear, punching shear,
   flexural design (reuses the beam flexure/shear engine).
   AS 3600:2018 Cl 8.2/9.1/9.2 · EN 1992-1-1 Cl 6.2/6.4/9.2
   ============================================================ */
"use strict";

const PileCapPage = (() => {
  const { el, numberField, selectField, statTile, verdictPill, fmt, uid, solveFlexure, clamp } = StructCap;
  const area = (dia) => Math.PI * (dia / 2) ** 2;

  function defaultState() {
    return {
      layout: "4", spacing: 900, spacingY: 900, pileDia: 450, edge: 300,
      h: 900, cover: 75,
      fc: 32, fy: 500,
      cx: 450, cy: 450,
      Nu: 3000, Mmajor: 0, Mminor: 0, Vmajor: 0, Vminor: 0,
      xBar: { dia: 20, n: 8 }, yBar: { dia: 20, n: 8 },
      theta: 45,
      showFullCalc: false,
    };
  }

  /* ---------- pile layout generator ---------- */
  function pileLayout(s) {
    let piles = [];
    if (s.layout === "2") {
      piles = [{ x: -s.spacing / 2, y: 0 }, { x: s.spacing / 2, y: 0 }];
    } else if (s.layout === "3") {
      const R = s.spacing / Math.sqrt(3);
      piles = [
        { x: 0, y: R },
        { x: -s.spacing / 2, y: -R / 2 },
        { x: s.spacing / 2, y: -R / 2 },
      ];
    } else { // "4"
      piles = [
        { x: -s.spacing / 2, y: -s.spacingY / 2 }, { x: s.spacing / 2, y: -s.spacingY / 2 },
        { x: -s.spacing / 2, y: s.spacingY / 2 }, { x: s.spacing / 2, y: s.spacingY / 2 },
      ];
    }
    const maxX = Math.max(...piles.map(p => Math.abs(p.x)));
    const maxY = Math.max(...piles.map(p => Math.abs(p.y)));
    const L = Math.max(2 * maxX + 2 * s.edge, s.pileDia + 2 * s.edge);
    const W = Math.max(2 * maxY + 2 * s.edge, s.pileDia + 2 * s.edge);
    return { piles, L, W };
  }

  /* ---------- main ULS design ---------- */
  function computeULS(codeId, s) {
    const C = Codes[codeId];
    const steps = s.showFullCalc ? [] : null;
    const { piles, L, W } = pileLayout(s);
    const n = piles.length;
    const Pavg = s.Nu / n; // kN per pile, equal share (axial-only component)
    const d = s.h - s.cover - Math.max(s.xBar.dia, s.yBar.dia) - Math.min(s.xBar.dia, s.yBar.dia) / 2;

    /* ---- rigid-cap elastic pile reactions, incl. major/minor axis moments ---- */
    // Major axis moment (Mmajor) bends about Y → reaction varies with pile x; minor axis (Mminor) → varies with pile y.
    const Sxx = piles.reduce((a, p) => a + p.x * p.x, 0);
    const Syy = piles.reduce((a, p) => a + p.y * p.y, 0);
    // Mmajor [kN·m], x [mm], Sxx [mm²]: (kN·m)·(mm)/(mm²) = kN·m/mm → ×1000 mm/m gives kN.
    piles.forEach(p => {
      p.P = Pavg + (Sxx > 0 ? (s.Mmajor * 1000 * p.x) / Sxx : 0) + (Syy > 0 ? (s.Mminor * 1000 * p.y) / Syy : 0);
    });
    const Pmax = Math.max(...piles.map(p => p.P));
    const Pmin = Math.min(...piles.map(p => p.P));
    if (steps) {
      steps.push(`— Geometry & pile reactions —`);
      steps.push(`Cap plan: L = ${fmt(L, 0)} mm × W = ${fmt(W, 0)} mm, ${n} piles, effective depth d ≈ ${fmt(d, 0)} mm.`);
      steps.push(`Rigid-cap elastic distribution: Pi = Nu/n + Mmajor·xi/Σxi² + Mminor·yi/Σyi² (Σxi² = ${fmt(Sxx, 0)} mm², Σyi² = ${fmt(Syy, 0)} mm²).`);
      piles.forEach((p, i) => steps.push(`Pile ${i + 1} (x=${fmt(p.x, 0)}, y=${fmt(p.y, 0)}): Pi = ${fmt(p.P, 1)} kN.`));
      steps.push(`Governing range: Pmin = ${fmt(Pmin, 1)} kN, Pmax = ${fmt(Pmax, 1)} kN.`);
    }

    /* ---- one-way (beam) shear, each direction ---- */
    const critXoff = s.cx / 2 + d, critYoff = s.cy / 2 + d;
    const Vx = piles.filter(p => p.x > critXoff).reduce((a, p) => a + p.P, 0); // shear across width W, spanning L
    const Vy = piles.filter(p => p.y > critYoff).reduce((a, p) => a + p.P, 0);

    function shearCheck(V, bWidth) {
      let Vc, VnPhi, note;
      const AstDummy = 0.01 * bWidth * d; // assumed min tension steel ratio ~1% for Vuc estimate (conservative placeholder)
      if (codeId === "AS") {
        Vc = C.Vuc({ b: bWidth, d, fc: s.fc, Ast: AstDummy });
        VnPhi = C.phi.shear * Vc / 1e3;
        note = `φVuc = ${fmt(C.phi.shear, 2)} × ${fmt(Vc / 1e3, 1)} kN (Cl 8.2.7, no shear reinforcement assumed in pile caps)`;
      } else {
        Vc = C.VRdc({ b: bWidth, d, fck: s.fc, Asl: AstDummy, Ac: bWidth * s.h });
        VnPhi = Vc / 1e3;
        note = `VRd,c = ${fmt(VnPhi, 1)} kN (6.2.2, no shear reinforcement assumed)`;
      }
      return { V, VnPhi, ok: V <= VnPhi, note };
    }
    const shearXres = shearCheck(Vx, W);
    const shearYres = shearCheck(Vy, L);
    if (steps) {
      steps.push(`— One-way shear —`);
      steps.push(`X-direction: critical section at x = cx/2+d = ${fmt(critXoff, 0)} mm; piles beyond → V = ${fmt(Vx, 1)} kN; capacity (b=W=${fmt(W, 0)} mm) → ${shearXres.note} = ${fmt(shearXres.VnPhi, 1)} kN.`);
      steps.push(`Y-direction: critical section at y = cy/2+d = ${fmt(critYoff, 0)} mm; piles beyond → V = ${fmt(Vy, 1)} kN; capacity (b=L=${fmt(L, 0)} mm) → ${shearYres.note} = ${fmt(shearYres.VnPhi, 1)} kN.`);
    }

    /* ---- punching shear around column, with simplified moment-transfer amplification ---- */
    let punchV, punchCap, punchNote, u;
    const NuOut = s.Nu; // conservative — assumes no piles fall inside the critical perimeter
    // simplified eccentricity amplification (β = 1 + 1.5·|e|/b, common simplified alternative to the full Jc/polar-shear method)
    const bx = s.cx + d, by = s.cy + d;
    const ex = s.Nu !== 0 ? s.Mmajor / s.Nu : 0, ey = s.Nu !== 0 ? s.Mminor / s.Nu : 0; // m
    const betaEcc = 1 + 1.5 * (Math.abs(ex) * 1000 / bx) + 1.5 * (Math.abs(ey) * 1000 / by);
    if (codeId === "AS") {
      u = 2 * (s.cx + d) + 2 * (s.cy + d);
      const betaH = Math.max(s.cx, s.cy) / Math.min(s.cx, s.cy);
      const vuc = C.vucPunch({ fc: s.fc, betaH });
      punchCap = C.phi.shear * vuc * u * d / 1e3;
      punchNote = `u = 2(cx+d)+2(cy+d) = ${fmt(u, 0)} mm at d/2 from column face; vuc = ${fmt(vuc, 3)} MPa (Cl 9.2.3, βh=${fmt(betaH, 2)}); φVuc = φ·vuc·u·d = ${fmt(punchCap, 1)} kN.`;
    } else {
      u = 2 * (s.cx + s.cy) + 4 * Math.PI * d;
      const rho1 = 0.01;
      const v = C.vRdcStress({ d, fck: s.fc, rho1 });
      punchCap = v * u * d / 1e3;
      punchNote = `u1 = 2(cx+cy)+4πd = ${fmt(u, 0)} mm at 2d from column face; vRd,c = ${fmt(v, 3)} MPa (6.4.4); VRd,c = vRd,c·u1·d = ${fmt(punchCap, 1)} kN.`;
    }
    punchV = NuOut * betaEcc;
    const punchOK = punchV <= punchCap;
    if (steps) {
      steps.push(`— Punching shear (column) —`);
      steps.push(`Eccentricity from applied moments: ex = Mmajor/Nu = ${fmt(ex * 1000, 0)} mm, ey = Mminor/Nu = ${fmt(ey * 1000, 0)} mm. Amplification β = 1 + 1.5(|ex|/bx + |ey|/by) = ${fmt(betaEcc, 2)} (simplified eccentric-shear allowance).`);
      steps.push(`VEd = β·Nu = ${fmt(betaEcc, 2)} × ${fmt(s.Nu, 0)} = ${fmt(punchV, 1)} kN (conservative — no pile reduction assumed). ${punchNote}`);
    }

    /* ---- flexure, each direction (reuse beam flexure engine) ---- */
    function flexureCheck(bars, bWidth, spanCoordKey, critOff) {
      const M = piles.filter(p => p[spanCoordKey] > critOff).reduce((a, p) => a + p.P * (p[spanCoordKey] - critOff) / 1000, 0); // kN·m (P in kN, arm in mm → /1000)
      const dia = bars.dia, nBars = bars.n;
      const yEff = s.h - s.cover - dia / 2;
      const layers = [{ y: yEff, As: nBars * area(dia) }];
      const p = C.flexureParams ? C.flexureParams(s.fc, s.gammaC) : null;
      let fyEff, ecu;
      if (codeId === "EC") { fyEff = s.fy / (s.gammaS || C.gammaS); ecu = C.ecu2; } else { fyEff = s.fy; ecu = C.ecu; }
      const flex = solveFlexure({ b: bWidth, h: s.h, layers, fc: s.fc, fy: fyEff, Es: C.Es, ecu, alpha: p.alpha, betaOf: p.betaOf });
      const phiFlex = codeId === "EC" ? 1.0 : C.phi.flexure;
      const MnPhi = phiFlex * flex.Mn / 1e6;
      const z = yEff - flex.a / 2; // internal lever arm (mm), for strut-and-tie tie force
      return { M, MnPhi, ok: M <= MnPhi, As: nBars * area(dia), d: yEff, a: flex.a, z };
    }
    const flexX = flexureCheck(s.xBar, W, "x", s.cx / 2);
    const flexY = flexureCheck(s.yBar, L, "y", s.cy / 2);
    if (steps) {
      steps.push(`— Flexure —`);
      steps.push(`X-direction bars resist bending from piles beyond the column face: M = Σ Pi·(xi−cx/2) = ${fmt(flexX.M, 1)} kN·m; capacity (${s.xBar.n}-${s.xBar.dia} bars, b=W) = ${fmt(flexX.MnPhi, 1)} kN·m.`);
      steps.push(`Y-direction bars: M = Σ Pi·(yi−cy/2) = ${fmt(flexY.M, 1)} kN·m; capacity (${s.yBar.n}-${s.yBar.dia} bars, b=L) = ${fmt(flexY.MnPhi, 1)} kN·m.`);
    }

    /* ---- minimum reinforcement ---- */
    let AstMinX, AstMinY;
    if (codeId === "AS") {
      AstMinX = C.AstMin({ b: W, d: flexX.d, D: s.h, fc: s.fc, fsy: s.fy });
      AstMinY = C.AstMin({ b: L, d: flexY.d, D: s.h, fc: s.fc, fsy: s.fy });
    } else {
      AstMinX = C.AsMin({ b: W, d: flexX.d, fck: s.fc, fyk: s.fy });
      AstMinY = C.AsMin({ b: L, d: flexY.d, fck: s.fc, fyk: s.fy });
    }
    const minReo = {
      xOK: flexX.As >= AstMinX, xProvided: flexX.As, xMin: AstMinX,
      yOK: flexY.As >= AstMinY, yProvided: flexY.As, yMin: AstMinY,
    };
    if (steps) {
      steps.push(`— Minimum reinforcement —`);
      steps.push(`X: As,provided = ${fmt(flexX.As, 0)} mm² vs As,min = ${fmt(AstMinX, 0)} mm².`);
      steps.push(`Y: As,provided = ${fmt(flexY.As, 0)} mm² vs As,min = ${fmt(AstMinY, 0)} mm².`);
    }

    /* ---- strut-and-tie model (STM) — struts, nodes, ties ---- */
    const strutLimit = C.stmStrutLimit(s.fc, s.gammaC);
    const nodeCCC = C.stmNodeCCC(s.fc, s.gammaC);
    const nodeCCT = C.stmNodeCCT(s.fc, s.gammaC);
    const zAvg = (flexX.z + flexY.z) / 2; // internal lever arm (mm), averaged across both directions

    const strutPiles = piles.map((p) => {
      const avx = Math.max(0, Math.abs(p.x) - s.cx / 2);
      const avy = Math.max(0, Math.abs(p.y) - s.cy / 2);
      const r = Math.hypot(avx, avy); // horizontal distance, column face to pile centre
      const thetaRad = Math.atan2(zAvg, Math.max(r, 1));
      const thetaDeg = thetaRad * 180 / Math.PI;
      const Fstrut = r > 0 ? p.P / Math.sin(thetaRad) : p.P; // kN — uses this pile's own (moment-adjusted) reaction
      const Astrut = area(s.pileDia) * Math.pow(Math.sin(thetaRad), 2); // projected strut area at pile node, mm²
      const sigmaStrut = (Fstrut * 1e3) / Astrut; // MPa
      return { r, thetaDeg, Fstrut, sigmaStrut, P: p.P };
    });
    const govStrut = strutPiles.reduce((a, b) => (b.sigmaStrut > a.sigmaStrut ? b : a), strutPiles[0]);

    const sigmaNodeCol = (s.Nu * 1e3) / (s.cx * s.cy); // CCC node under column (axial only — governing case)
    const sigmaNodePile = (Pmax * 1e3) / area(s.pileDia); // CCT node at the most heavily loaded pile head

    const gS = s.gammaS || C.gammaS;
    const tieCapX = codeId === "AS" ? (C.phiStm * flexX.As * s.fy) / 1e3 : (flexX.As * (s.fy / gS)) / 1e3; // kN
    const tieCapY = codeId === "AS" ? (C.phiStm * flexY.As * s.fy) / 1e3 : (flexY.As * (s.fy / gS)) / 1e3;
    const tieDemandX = flexX.z > 0 ? flexX.M / (flexX.z / 1000) : 0; // kN (M in kN·m, z in mm → m)
    const tieDemandY = flexY.z > 0 ? flexY.M / (flexY.z / 1000) : 0;

    const stm = {
      strutLimit, nodeCCC, nodeCCT, zAvg,
      strutSigma: govStrut.sigmaStrut, strutOK: govStrut.sigmaStrut <= strutLimit, strutTheta: govStrut.thetaDeg, strutForce: govStrut.Fstrut,
      nodeColSigma: sigmaNodeCol, nodeColOK: sigmaNodeCol <= nodeCCC,
      nodePileSigma: sigmaNodePile, nodePileOK: sigmaNodePile <= nodeCCT,
      tieX: { demand: tieDemandX, cap: tieCapX, ok: tieDemandX <= tieCapX },
      tieY: { demand: tieDemandY, cap: tieCapY, ok: tieDemandY <= tieCapY },
    };
    if (steps) {
      steps.push(`— Strut-and-tie model —`);
      steps.push(`Internal lever arm z ≈ (zx+zy)/2 = ${fmt(zAvg, 0)} mm (z = d − a/2 from the flexure solve, each direction). Strut angle to each pile: θ = atan(z/av), av = horizontal distance from column face to pile centre.`);
      strutPiles.forEach((sp, i) => steps.push(`Pile ${i + 1}: Pi = ${fmt(sp.P, 1)} kN, av = ${fmt(sp.r, 0)} mm, θ = ${fmt(sp.thetaDeg, 1)}°, strut force Fst = Pi/sinθ = ${fmt(sp.Fstrut, 1)} kN, σstrut ≈ Fst/(Apile·sin²θ) = ${fmt(sp.sigmaStrut, 2)} MPa.`));
      steps.push(`Governing strut: σstrut = ${fmt(stm.strutSigma, 2)} MPa vs limit 0.6ν'fc${codeId === "EC" ? "d" : " (×φ=0.6)"} = ${fmt(strutLimit, 2)} MPa.`);
      steps.push(`Node at column (CCC): σ = Nu/(cx·cy) = ${fmt(sigmaNodeCol, 2)} MPa vs limit = ${fmt(nodeCCC, 2)} MPa.`);
      steps.push(`Node at most-loaded pile head (CCT): σ = Pmax/Apile = ${fmt(sigmaNodePile, 2)} MPa vs limit = ${fmt(nodeCCT, 2)} MPa.`);
      steps.push(`Tie force X = Mx/z = ${fmt(tieDemandX, 1)} kN vs capacity ${fmt(tieCapX, 1)} kN. Tie force Y = My/z = ${fmt(tieDemandY, 1)} kN vs capacity ${fmt(tieCapY, 1)} kN.`);
    }

    /* ---- horizontal shear-friction check at column/cap interface ---- */
    const Vres = Math.hypot(s.Vmajor, s.Vminor); // resultant column shear, kN
    const frictionCap = C.frictionMu * Math.max(s.Nu, 0); // kN — compression-only shear friction, μ·N
    const frictionOK = Vres <= frictionCap;
    const hshear = { Vmajor: s.Vmajor, Vminor: s.Vminor, Vres, cap: frictionCap, ok: frictionOK, mu: C.frictionMu };
    if (steps) {
      steps.push(`— Horizontal shear (column/cap interface) —`);
      steps.push(`Resultant column shear Vres = √(Vmajor²+Vminor²) = ${fmt(Vres, 1)} kN. Shear-friction capacity = μ·Nu = ${fmt(C.frictionMu, 2)} × ${fmt(s.Nu, 0)} = ${fmt(frictionCap, 1)} kN (concrete-to-concrete interface friction only — add dowels/shear keys if this governs).`);
    }

    return { piles, L, W, d, Pavg, Pmax, Pmin, n, shearXres, shearYres, punchV, punchCap, punchOK, punchNote, u, betaEcc, flexX, flexY, minReo, stm, hshear, steps };
  }

  /* ---------- plan-view diagram ---------- */
  function drawPlan({ L, W, piles, pileDia, cx, cy }) {
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
    const pad = 50;
    const scale = Math.min(360 / L, 360 / W);
    const Wpx = 400 + pad * 2, Hpx = W * scale + pad * 2;
    const svg = mk("svg", { viewBox: `0 0 ${Wpx} ${Hpx}`, style: "width:100%;height:auto;display:block", role: "img", "aria-label": "Pile cap plan" });
    const ox = Wpx / 2, oy = Hpx / 2;
    const col = { concrete: "var(--diag-concrete)", edge: "var(--diag-edge)", bar: "var(--diag-bar)", dim: "var(--diag-dim)", text: "var(--diag-text)", pile: "var(--diag-stirrup)" };

    svg.appendChild(mk("rect", { x: ox - (L * scale) / 2, y: oy - (W * scale) / 2, width: L * scale, height: W * scale, fill: col.concrete, stroke: col.edge, "stroke-width": 2, rx: 4 }));
    svg.appendChild(mk("rect", { x: ox - (cx * scale) / 2, y: oy - (cy * scale) / 2, width: cx * scale, height: cy * scale, fill: "none", stroke: col.bar, "stroke-width": 2, "stroke-dasharray": "5 3" }));
    piles.forEach(p => {
      svg.appendChild(mk("circle", { cx: ox + p.x * scale, cy: oy + p.y * scale, r: (pileDia * scale) / 2, fill: "none", stroke: col.pile, "stroke-width": 2 }));
      svg.appendChild(mk("circle", { cx: ox + p.x * scale, cy: oy + p.y * scale, r: 2.4, fill: col.pile }));
      if (p.P !== undefined) {
        const lbl = mk("text", { x: ox + p.x * scale, y: oy + p.y * scale + (pileDia * scale) / 2 + 13, fill: p.P < 0 ? "var(--diag-na)" : col.text, "font-size": 10, "text-anchor": "middle", "font-family": "var(--font-mono)" });
        lbl.textContent = fmt(p.P, 0) + " kN";
        svg.appendChild(lbl);
      }
    });
    // dimensions
    const dimY = oy + (W * scale) / 2 + 22;
    svg.appendChild(mk("line", { x1: ox - (L * scale) / 2, y1: dimY, x2: ox + (L * scale) / 2, y2: dimY, stroke: col.dim, "stroke-width": 1 }));
    const lLbl = mk("text", { x: ox, y: dimY + 16, fill: col.text, "font-size": 11, "text-anchor": "middle", "font-family": "var(--font-mono)" });
    lLbl.textContent = "L = " + fmt(L, 0) + " mm";
    svg.appendChild(lLbl);
    const dimX = ox + (L * scale) / 2 + 26;
    svg.appendChild(mk("line", { x1: dimX, y1: oy - (W * scale) / 2, x2: dimX, y2: oy + (W * scale) / 2, stroke: col.dim, "stroke-width": 1 }));
    const wLbl = mk("text", { x: dimX + 14, y: oy, fill: col.text, "font-size": 11, "text-anchor": "middle", "font-family": "var(--font-mono)", transform: `rotate(90 ${dimX + 14} ${oy})` });
    wLbl.textContent = "W = " + fmt(W, 0) + " mm";
    svg.appendChild(wLbl);
    return svg;
  }

  function checkRow(label, demand, capacity, unit, ok, dec = 1) {
    const ur = capacity > 0 ? demand / capacity : NaN;
    return el("table", { class: "check-table" }, el("tbody", {}, el("tr", {}, [
      el("td", {}, label),
      el("td", {}, `${fmt(demand, dec)} / ${fmt(capacity, dec)} ${unit}`),
      el("td", { class: "ur-cell" }, el("span", { class: "ur-pill" + (ur > 1 ? " ur-over" : "") }, "UR " + fmt(ur, 2))),
      el("td", {}, verdictPill(ok, "OK", "FAIL"))
    ])));
  }

  function render(container, codeId) {
    const C = Codes[codeId];
    const s = defaultState();
    s.gammaC = C.gammaC || 1.5; s.gammaS = C.gammaS || 1.15;

    container.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [
        el("h1", {}, "Pile Cap Design"),
        el("p", { class: "muted" }, C.strings.refConcrete)
      ])
    ]));

    const grid = el("div", { class: "beam-grid" });
    container.appendChild(grid);
    const form = el("div", { class: "panel form-panel" });
    grid.appendChild(form);

    form.appendChild(el("h3", {}, "Pile Layout"));
    form.appendChild(selectField({
      id: "layout", label: "Configuration", value: s.layout,
      options: [{ value: "2", label: "2 piles (single row)" }, { value: "3", label: "3 piles (triangular)" }, { value: "4", label: "4 piles (2×2 grid)" }]
    }));
    const spacingRow = el("div", { class: "field-grid-3" }, [
      numberField({ id: "spacing", label: "Pile spacing (X)", value: s.spacing, unit: "mm" }),
      numberField({ id: "spacingY", label: "Pile spacing (Y)", value: s.spacingY, unit: "mm", hint: "4-pile layout only" }),
      numberField({ id: "pileDia", label: "Pile diameter", value: s.pileDia, unit: "mm" }),
    ]);
    form.appendChild(spacingRow);
    form.appendChild(numberField({ id: "edge", label: "Edge distance (pile centre to cap edge)", value: s.edge, unit: "mm" }));

    form.appendChild(el("h3", {}, "Cap & Column"));
    form.appendChild(el("div", { class: "field-grid-3" }, [
      numberField({ id: "h", label: "Cap thickness h", value: s.h, unit: "mm" }),
      numberField({ id: "cover", label: "Cover", value: s.cover, unit: "mm" }),
    ]));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "cx", label: "Column size cx", value: s.cx, unit: "mm" }),
      numberField({ id: "cy", label: "Column size cy", value: s.cy, unit: "mm" }),
    ]));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "fc", label: `Concrete ${C.fcLabel}`, value: s.fc, unit: "MPa" }),
      numberField({ id: "fy", label: `Rebar ${C.fyLabel}`, value: s.fy, unit: "MPa" }),
    ]));
    if (codeId === "EC") {
      form.appendChild(el("div", { class: "field-grid-2" }, [
        numberField({ id: "gammaC", label: "Partial factor γC", value: s.gammaC, unit: "" }),
        numberField({ id: "gammaS", label: "Partial factor γS", value: s.gammaS, unit: "" }),
      ]));
    }

    form.appendChild(el("h3", {}, "Bottom Reinforcement"));
    const barBlock = (label, key) => el("div", { class: "bar-row" }, [
      el("span", { class: "bar-row-label" }, label),
      el("input", { type: "number", id: key + "Dia", value: s[key].dia, class: "cell-input", style: "width:56px" }),
      el("span", { class: "field-unit" }, "⌀mm"),
      el("input", { type: "number", id: key + "N", value: s[key].n, class: "cell-input", style: "width:48px" }),
      el("span", { class: "field-unit" }, "bars"),
    ]);
    form.appendChild(barBlock("X-direction mat", "xBar"));
    form.appendChild(barBlock("Y-direction mat", "yBar"));

    form.appendChild(el("h3", {}, "ULS Column Load"));
    form.appendChild(numberField({ id: "Nu", label: "Nu (column axial load)", value: s.Nu, unit: "kN" }));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "Mmajor", label: "M-major (varies pile load along X)", value: s.Mmajor, unit: "kN·m" }),
      numberField({ id: "Mminor", label: "M-minor (varies pile load along Y)", value: s.Mminor, unit: "kN·m" }),
    ]));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "Vmajor", label: "V-major (column shear, X)", value: s.Vmajor, unit: "kN" }),
      numberField({ id: "Vminor", label: "V-minor (column shear, Y)", value: s.Vminor, unit: "kN" }),
    ]));

    const right = el("div", { class: "panel result-panel" });
    grid.appendChild(right);
    const diagramHost = el("div", { class: "diagram-host" });
    const resultsHost = el("div", { class: "results-host" });
    right.appendChild(el("h3", {}, "Plan"));
    right.appendChild(diagramHost);
    right.appendChild(resultsHost);

    container.appendChild(el("p", { class: "disclaimer" }, "⚠ Preliminary design tool. Rigid-cap elastic pile reactions (Nu/n ± M·c/Σc²) assume linear-elastic pile stiffness and no tension capacity check on piles — verify uplift separately if M is large relative to Nu. Punching-shear moment transfer uses a simplified eccentricity amplification, not a full Jc/polar-shear method. No pile-reduction credit on punching shear. Strut-and-tie model idealises a single diagonal strut from the column node to each pile — verify node geometry, strut width and bearing detailing independently. Simplified methods — a qualified engineer must independently verify all results before use."));

    function bindNumber(id, setter) {
      const i = container.querySelector("#" + id);
      if (!i) return;
      i.addEventListener("input", () => { setter(+i.value || 0); recompute(); });
    }
    bindNumber("spacing", v => s.spacing = v);
    bindNumber("spacingY", v => s.spacingY = v);
    bindNumber("pileDia", v => s.pileDia = v);
    bindNumber("edge", v => s.edge = v);
    bindNumber("h", v => s.h = v);
    bindNumber("cover", v => s.cover = v);
    bindNumber("cx", v => s.cx = v);
    bindNumber("cy", v => s.cy = v);
    bindNumber("fc", v => s.fc = v);
    bindNumber("fy", v => s.fy = v);
    bindNumber("gammaC", v => s.gammaC = v || 1.5);
    bindNumber("gammaS", v => s.gammaS = v || 1.15);
    bindNumber("xBarDia", v => s.xBar.dia = v);
    bindNumber("xBarN", v => s.xBar.n = v);
    bindNumber("yBarDia", v => s.yBar.dia = v);
    bindNumber("yBarN", v => s.yBar.n = v);
    bindNumber("Nu", v => s.Nu = v);
    bindNumber("Mmajor", v => s.Mmajor = v);
    bindNumber("Mminor", v => s.Mminor = v);
    bindNumber("Vmajor", v => s.Vmajor = v);
    bindNumber("Vminor", v => s.Vminor = v);
    container.querySelector("#layout").addEventListener("change", (e) => { s.layout = e.target.value; recompute(); });

    function recompute() {
      diagramHost.innerHTML = "";
      resultsHost.innerHTML = "";
      let r;
      try {
        r = computeULS(codeId, s);
      } catch (e) {
        resultsHost.appendChild(el("p", { class: "formula-note" }, "Could not solve — check inputs (" + e.message + ")"));
        return;
      }

      resultsHost.appendChild(el("h3", { class: "results-h" }, "Pile Reactions"));
      resultsHost.appendChild(el("div", { class: "stat-grid" }, [
        statTile({ label: "Piles", value: String(r.n), unit: "" }),
        statTile({ label: "Reaction (avg)", value: fmt(r.Pavg, 1), unit: "kN" }),
        statTile({ label: "Reaction (min)", value: fmt(r.Pmin, 1), unit: "kN", tone: r.Pmin < 0 ? "bad" : "" }),
        statTile({ label: "Reaction (max)", value: fmt(r.Pmax, 1), unit: "kN" }),
      ]));
      if (r.Pmin < 0) {
        resultsHost.appendChild(el("p", { class: "formula-note" }, "⚠ Minimum pile reaction is negative — this pile is in net uplift under the applied moment; check pile tension capacity and cap-to-pile connection separately (not covered by this tool)."));
      }

      resultsHost.appendChild(el("h3", { class: "results-h" }, "One-way Shear"));
      resultsHost.appendChild(checkRow("X-direction", r.shearXres.V, r.shearXres.VnPhi, "kN", r.shearXres.ok));
      resultsHost.appendChild(checkRow("Y-direction", r.shearYres.V, r.shearYres.VnPhi, "kN", r.shearYres.ok));

      resultsHost.appendChild(el("h3", { class: "results-h" }, "Punching Shear"));
      resultsHost.appendChild(checkRow("Column punching", r.punchV, r.punchCap, "kN", r.punchOK));
      resultsHost.appendChild(el("p", { class: "formula-note" }, r.punchNote));

      resultsHost.appendChild(el("h3", { class: "results-h" }, "Flexure"));
      resultsHost.appendChild(checkRow("X-direction moment", r.flexX.M, r.flexX.MnPhi, "kN·m", r.flexX.ok));
      resultsHost.appendChild(checkRow("Y-direction moment", r.flexY.M, r.flexY.MnPhi, "kN·m", r.flexY.ok));

      resultsHost.appendChild(el("h3", { class: "results-h" }, "Minimum Reinforcement"));
      resultsHost.appendChild(checkRow("X-direction", r.minReo.xMin, r.minReo.xProvided, "mm²", r.minReo.xOK, 0));
      resultsHost.appendChild(checkRow("Y-direction", r.minReo.yMin, r.minReo.yProvided, "mm²", r.minReo.yOK, 0));

      resultsHost.appendChild(el("h3", { class: "results-h" }, "Strut-and-Tie Check"));
      resultsHost.appendChild(checkRow("Strut (governing pile)", r.stm.strutSigma, r.stm.strutLimit, "MPa", r.stm.strutOK, 2));
      resultsHost.appendChild(el("p", { class: "formula-note" }, `θ = ${fmt(r.stm.strutTheta, 1)}° from horizontal, strut force Fst = ${fmt(r.stm.strutForce, 1)} kN, lever arm z ≈ ${fmt(r.stm.zAvg, 0)} mm.`));
      resultsHost.appendChild(checkRow("Node — column (CCC)", r.stm.nodeColSigma, r.stm.nodeCCC, "MPa", r.stm.nodeColOK, 2));
      resultsHost.appendChild(checkRow("Node — pile head (CCT)", r.stm.nodePileSigma, r.stm.nodeCCT, "MPa", r.stm.nodePileOK, 2));
      resultsHost.appendChild(checkRow("Tie — X-direction", r.stm.tieX.demand, r.stm.tieX.cap, "kN", r.stm.tieX.ok));
      resultsHost.appendChild(checkRow("Tie — Y-direction", r.stm.tieY.demand, r.stm.tieY.cap, "kN", r.stm.tieY.ok));
      resultsHost.appendChild(el("p", { class: "formula-note" }, "Strut-and-tie model per " + (codeId === "AS" ? "AS 3600:2018 Section 7 (φ = 0.6 blanket factor, ν' = 1 − fc/250)" : "EN 1992-1-1 Cl 6.5 (k1 = 1.0 CCC, k2 = 0.85 CCT, ν' = 1 − fck/250)") + " — idealised single strut per pile; verify node geometry and bearing details."));

      resultsHost.appendChild(el("h3", { class: "results-h" }, "Horizontal Shear (Column Base)"));
      resultsHost.appendChild(checkRow("Shear-friction (column/cap)", r.hshear.Vres, r.hshear.cap, "kN", r.hshear.ok));
      resultsHost.appendChild(el("p", { class: "formula-note" }, `Vmajor = ${fmt(r.hshear.Vmajor, 1)} kN, Vminor = ${fmt(r.hshear.Vminor, 1)} kN, resultant Vres = ${fmt(r.hshear.Vres, 1)} kN. Capacity = μ·Nu, μ = ${fmt(r.hshear.mu, 2)} (concrete-to-concrete interface friction only — add dowels/shear keys if this governs).`));

      resultsHost.appendChild(calcToggle(s, recompute));
      if (s.showFullCalc && r.steps) {
        resultsHost.appendChild(el("div", { class: "calc-trace" }, r.steps.map(line => el("p", {}, line))));
      }

      diagramHost.appendChild(drawPlan({ L: r.L, W: r.W, piles: r.piles, pileDia: s.pileDia, cx: s.cx, cy: s.cy }));
    }

    recompute();
  }

  function calcToggle(s, recompute) {
    const btn = el("button", { class: "btn-secondary calc-toggle-btn" }, s.showFullCalc ? "Hide full calculation" : "Show full calculation");
    btn.addEventListener("click", () => { s.showFullCalc = !s.showFullCalc; recompute(); });
    return btn;
  }

  return { render };
})();
