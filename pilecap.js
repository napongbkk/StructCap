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
      Nu: 3000,
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
    const Pi = s.Nu / n; // kN per pile, equal distribution (no moment)
    const d = s.h - s.cover - Math.max(s.xBar.dia, s.yBar.dia) - Math.min(s.xBar.dia, s.yBar.dia) / 2;
    if (steps) {
      steps.push(`— Geometry & pile reactions —`);
      steps.push(`Cap plan: L = ${fmt(L, 0)} mm × W = ${fmt(W, 0)} mm, ${n} piles, effective depth d ≈ ${fmt(d, 0)} mm.`);
      steps.push(`Pile reaction (equal share, axial load only) Pi = Nu/n = ${fmt(s.Nu, 0)}/${n} = ${fmt(Pi, 1)} kN.`);
    }

    /* ---- one-way (beam) shear, each direction ---- */
    const critXoff = s.cx / 2 + d, critYoff = s.cy / 2 + d;
    const Vx = piles.filter(p => p.x > critXoff).reduce((a) => a + Pi, 0); // shear across width W, spanning L
    const Vy = piles.filter(p => p.y > critYoff).reduce((a) => a + Pi, 0);

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

    /* ---- punching shear around column ---- */
    let punchV, punchCap, punchNote, u;
    const NuOut = s.Nu; // conservative — assumes no piles fall inside the critical perimeter
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
    punchV = NuOut;
    const punchOK = punchV <= punchCap;
    if (steps) { steps.push(`— Punching shear (column) —`); steps.push(`VEd = Nu = ${fmt(punchV, 1)} kN (conservative — no pile reduction assumed). ${punchNote}`); }

    /* ---- flexure, each direction (reuse beam flexure engine) ---- */
    function flexureCheck(bars, bWidth, spanCoordKey, critOff) {
      const M = piles.filter(p => p[spanCoordKey] > critOff).reduce((a, p) => a + Pi * (p[spanCoordKey] - critOff) / 1000, 0); // kN·m (Pi in kN, arm in mm → /1000)
      const dia = bars.dia, nBars = bars.n;
      const yEff = s.h - s.cover - dia / 2;
      const layers = [{ y: yEff, As: nBars * area(dia) }];
      const p = C.flexureParams ? C.flexureParams(s.fc, s.gammaC) : null;
      let fyEff, ecu;
      if (codeId === "EC") { fyEff = s.fy / (s.gammaS || C.gammaS); ecu = C.ecu2; } else { fyEff = s.fy; ecu = C.ecu; }
      const flex = solveFlexure({ b: bWidth, h: s.h, layers, fc: s.fc, fy: fyEff, Es: C.Es, ecu, alpha: p.alpha, betaOf: p.betaOf });
      const phiFlex = codeId === "EC" ? 1.0 : C.phi.flexure;
      const MnPhi = phiFlex * flex.Mn / 1e6;
      return { M, MnPhi, ok: M <= MnPhi, As: nBars * area(dia), d: yEff };
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

    return { piles, L, W, d, Pi, n, shearXres, shearYres, punchV, punchCap, punchOK, punchNote, u, flexX, flexY, minReo, steps };
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
    form.appendChild(numberField({ id: "Nu", label: "Nu (column axial load)", value: s.Nu, unit: "kN", hint: "axial only — moment not yet supported" }));

    const right = el("div", { class: "panel result-panel" });
    grid.appendChild(right);
    const diagramHost = el("div", { class: "diagram-host" });
    const resultsHost = el("div", { class: "results-host" });
    right.appendChild(el("h3", {}, "Plan"));
    right.appendChild(diagramHost);
    right.appendChild(resultsHost);

    container.appendChild(el("p", { class: "disclaimer" }, "⚠ Preliminary design tool. Equal pile-load distribution (no applied moment), no pile-reduction credit on punching shear. Simplified methods — a qualified engineer must independently verify all results before use."));

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
        statTile({ label: "Reaction per pile", value: fmt(r.Pi, 1), unit: "kN" }),
      ]));

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
