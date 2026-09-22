/* ============================================================
   StructCap — Lap & Anchorage Length calculator
   AS 3600:2018 Cl 13.1/13.2 · EN 1992-1-1 Cl 8.4/8.7
   ============================================================ */
"use strict";

const LapPage = (() => {
  const { el, numberField, selectField, statTile, fmt, clamp } = StructCap;

  function defaultState() {
    return {
      db: 20, fc: 32, fy: 500,
      cover: 40, clearSpacing: 60,
      topBar: false, goodBond: true,
      reducedLap: false, pctLapped: 50,
      showFullCalc: false,
    };
  }

  function compute(codeId, s) {
    const C = Codes[codeId];
    const cd = Math.min(s.cover, s.clearSpacing / 2);
    const steps = s.showFullCalc ? [] : null;
    let out = {};

    if (codeId === "AS") {
      const k1 = s.topBar ? 1.3 : 1.0;
      const t = C.Lsyt({ db: s.db, fsy: s.fy, fc: s.fc, k1, cd });
      const k7 = C.lapFactorK7(s.reducedLap);
      const lapT = Math.max(k7 * t.L, 300);
      const Lc = C.Lsyc({ db: s.db, fsy: s.fy, fc: s.fc });
      const lapC = Math.max(1.25 * Lc, 300);
      out = { anchorT: t.L, lapT, anchorC: Lc, lapC, k1, k2: t.k2, k3: t.k3, k7, cd };
      if (steps) {
        steps.push(`— Tension development length (Cl 13.1.2) —`);
        steps.push(`k1 = ${fmt(k1, 2)} (${s.topBar ? "top bar, >300 mm concrete cast below" : "other bar"}); cd = min(cover, spacing/2) = min(${fmt(s.cover, 0)}, ${fmt(s.clearSpacing / 2, 0)}) = ${fmt(cd, 0)} mm.`);
        steps.push(`k2 = (132 − db)/100 = (132 − ${s.db})/100 = ${fmt(t.k2, 3)}.`);
        steps.push(`k3 = 1 − 0.15(cd − db)/db, clamped [0.7, 1.0] = ${fmt(t.k3, 3)}.`);
        steps.push(`Lsy.t = 0.5·k1·k3·fsy / (k2·√fc) × db = 0.5×${fmt(k1, 2)}×${fmt(t.k3, 3)}×${s.fy} / (${fmt(t.k2, 3)}×√${s.fc}) × ${s.db} = ${fmt(t.L, 0)} mm (≥ 29·k1·db and ≥ 200 mm).`);
        steps.push(`— Tension lap length (Cl 13.2.2) —`);
        steps.push(`k7 = ${fmt(k7, 2)} (${s.reducedLap ? "≤50% of bars lapped at this section, staggered" : "standard case"}).`);
        steps.push(`Lsy.t.lap = k7 × Lsy.t = ${fmt(k7, 2)} × ${fmt(t.L, 0)} = ${fmt(lapT, 0)} mm (≥ 300 mm).`);
        steps.push(`— Compression development length (Cl 13.1.3) —`);
        steps.push(`Lsy.c = max(0.22·fsy·db/√fc, 0.0435·fsy·db, 200) = ${fmt(Lc, 0)} mm.`);
        steps.push(`Compression lap length = 1.25 × Lsy.c = ${fmt(lapC, 0)} mm (≥ 300 mm).`);
      }
    } else { // EC
      const fyd = s.fy / C.gammaS;
      const eta1 = s.goodBond ? 1.0 : 0.7;
      const rq = C.lbRqd({ db: s.db, fyd, fck: s.fc, eta1 });
      const a2t = C.alpha2({ cd, db: s.db });
      const a6 = C.alpha6(s.pctLapped);
      const anchorT = Math.max(a2t * rq.lb, 10 * s.db, 100);
      const lapT = Math.max(a2t * a6 * rq.lb, 15 * s.db, 200);
      const anchorC = Math.max(rq.lb, 10 * s.db, 100); // alpha2 = 1.0 in compression
      const lapC = Math.max(a6 * rq.lb, 15 * s.db, 200);
      out = { anchorT, lapT, anchorC, lapC, lbRqd: rq.lb, fbd: rq.fbd, a2t, a6, cd, fyd };
      if (steps) {
        steps.push(`— Basic required anchorage length lb,rqd (Cl 8.4.2) —`);
        steps.push(`fyd = fyk/γS = ${s.fy}/${fmt(C.gammaS, 2)} = ${fmt(fyd, 1)} MPa. η1 = ${fmt(eta1, 2)} (${s.goodBond ? "good bond conditions" : "poor bond conditions"}), η2 = ${s.db <= 32 ? "1.0" : "(132−db)/100"}.`);
        steps.push(`fbd = 2.25·η1·η2·fctd = ${fmt(rq.fbd, 2)} MPa.`);
        steps.push(`lb,rqd = (db/4)·(fyd/fbd) = (${s.db}/4)×(${fmt(fyd, 1)}/${fmt(rq.fbd, 2)}) = ${fmt(rq.lb, 0)} mm.`);
        steps.push(`— Design anchorage length (Cl 8.4.4) —`);
        steps.push(`cd = min(cover, spacing/2) = ${fmt(cd, 0)} mm; α2 = 1 − 0.15(cd−db)/db, clamped [0.7,1.0] = ${fmt(a2t, 3)} (tension; α2=1.0 in compression).`);
        steps.push(`lbd,tension = max(α2·lb,rqd, 10·db, 100) = ${fmt(anchorT, 0)} mm.`);
        steps.push(`lbd,compression = max(lb,rqd, 10·db, 100) = ${fmt(anchorC, 0)} mm.`);
        steps.push(`— Lap length (Cl 8.7.3) —`);
        steps.push(`α6 from Table 8.3 at ${fmt(s.pctLapped, 0)}% lapped at one section = ${fmt(a6, 2)}.`);
        steps.push(`l0,tension = max(α2·α6·lb,rqd, 15·db, 200) = ${fmt(lapT, 0)} mm.`);
        steps.push(`l0,compression = max(α6·lb,rqd, 15·db, 200) = ${fmt(lapC, 0)} mm.`);
      }
    }
    return { ...out, steps };
  }

  function barDiagram(anchorLen, lapLen, db, theme) {
    const scale = Math.min(1, 520 / Math.max(anchorLen, lapLen, 400));
    const W = 560, H = 170;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("style", "width:100%;height:auto;display:block");
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
    const barW = Math.max(3, db / 6);

    // lap: two overlapping bars
    const lapPx = clamp(lapLen * scale, 60, 500);
    const y1 = 46, y2 = 46 + 14;
    svg.appendChild(mk("line", { x1: 20, y1, x2: 20 + lapPx, y2: y1, stroke: "var(--diag-bar)", "stroke-width": barW, "stroke-linecap": "round" }));
    svg.appendChild(mk("line", { x1: 20 + lapPx - lapPx, y1: y2, x2: 20 + lapPx, y2, stroke: "var(--diag-bar)", "stroke-width": barW, "stroke-linecap": "round", opacity: 0.7 }));
    svg.appendChild(mk("line", { x1: 20, y1: 20, x2: 20, y2: 34, stroke: "var(--diag-dim)", "stroke-width": 1 }));
    svg.appendChild(mk("line", { x1: 20 + lapPx, y1: 20, x2: 20 + lapPx, y2: 34, stroke: "var(--diag-dim)", "stroke-width": 1 }));
    svg.appendChild(mk("line", { x1: 20, y1: 27, x2: 20 + lapPx, y2: 27, stroke: "var(--diag-dim)", "stroke-width": 1 }));
    const lbl1 = mk("text", { x: 20 + lapPx / 2, y: 18, fill: "var(--diag-text)", "font-size": 11, "text-anchor": "middle", "font-family": "var(--font-mono)" });
    lbl1.textContent = "lap length";
    svg.appendChild(lbl1);

    // anchorage: single bar into concrete block
    const ay = 120;
    const anchPx = clamp(anchorLen * scale, 60, 500);
    svg.appendChild(mk("rect", { x: 20, y: ay - 22, width: anchPx, height: 44, fill: "var(--diag-concrete)", stroke: "var(--diag-edge)", "stroke-width": 1.5 }));
    svg.appendChild(mk("line", { x1: 0, y1: ay, x2: 20 + anchPx, y2: ay, stroke: "var(--diag-bar)", "stroke-width": barW, "stroke-linecap": "round" }));
    svg.appendChild(mk("line", { x1: 20, y1: ay + 32, x2: 20, y2: ay + 46, stroke: "var(--diag-dim)", "stroke-width": 1 }));
    svg.appendChild(mk("line", { x1: 20 + anchPx, y1: ay + 32, x2: 20 + anchPx, y2: ay + 46, stroke: "var(--diag-dim)", "stroke-width": 1 }));
    svg.appendChild(mk("line", { x1: 20, y1: ay + 40, x2: 20 + anchPx, y2: ay + 40, stroke: "var(--diag-dim)", "stroke-width": 1 }));
    const lbl2 = mk("text", { x: 20 + anchPx / 2, y: ay + 56, fill: "var(--diag-text)", "font-size": 11, "text-anchor": "middle", "font-family": "var(--font-mono)" });
    lbl2.textContent = "anchorage length";
    svg.appendChild(lbl2);

    return svg;
  }

  function render(container, codeId) {
    const C = Codes[codeId];
    const s = defaultState();

    container.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [
        el("h1", {}, "Lap & Anchorage Length"),
        el("p", { class: "muted" }, C.strings.refConcrete)
      ])
    ]));

    const grid = el("div", { class: "beam-grid" });
    container.appendChild(grid);
    const form = el("div", { class: "panel form-panel" });
    grid.appendChild(form);

    form.appendChild(el("h3", {}, "Bar & Material"));
    form.appendChild(el("div", { class: "field-grid-3" }, [
      numberField({ id: "db", label: "Bar diameter db", value: s.db, unit: "mm" }),
      numberField({ id: "fc", label: `Concrete ${C.fcLabel}`, value: s.fc, unit: "MPa" }),
      numberField({ id: "fy", label: `Rebar ${C.fyLabel}`, value: s.fy, unit: "MPa" }),
    ]));
    if (codeId === "EC") {
      form.appendChild(el("div", { class: "field-grid-2" }, [
        numberField({ id: "gammaS", label: "Partial factor γS", value: s.gammaS ?? C.gammaS, unit: "" }),
      ]));
      s.gammaS = C.gammaS;
    }

    form.appendChild(el("h3", {}, "Cover & Spacing"));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "cover", label: "Cover to bar", value: s.cover, unit: "mm" }),
      numberField({ id: "clearSpacing", label: "Clear spacing between bars", value: s.clearSpacing, unit: "mm" }),
    ]));

    form.appendChild(el("h3", {}, "Bond Conditions"));
    const checkRow = (id, label, checked) => el("label", { class: "check-row" }, [
      el("input", { type: "checkbox", id, checked: checked ? "" : undefined }),
      el("span", {}, label)
    ]);
    if (codeId === "AS") {
      form.appendChild(checkRow("topBar", "Top bar — horizontal bar with > 300 mm concrete cast below (k1 = 1.3)", s.topBar));
      form.appendChild(checkRow("reducedLap", "≤ 50% of bars lapped at this section, staggered ≥ 1.3×lap length (k7 = 1.0)", s.reducedLap));
    } else {
      form.appendChild(checkRow("goodBond", "Good bond conditions (η1 = 1.0)", s.goodBond));
      form.appendChild(numberField({ id: "pctLapped", label: "% of bars lapped at this section", value: s.pctLapped, unit: "%" }));
    }

    const right = el("div", { class: "panel result-panel" });
    grid.appendChild(right);
    const diagramHost = el("div", { class: "diagram-host" });
    const resultsHost = el("div", { class: "results-host" });
    right.appendChild(el("h3", {}, "Bar Detail"));
    right.appendChild(diagramHost);
    right.appendChild(resultsHost);

    container.appendChild(el("p", { class: "disclaimer" }, "⚠ Preliminary design tool. Simplified methods — a qualified engineer must independently verify all results before use."));

    function bindNumber(id, setter) {
      const i = container.querySelector("#" + id);
      if (!i) return;
      i.addEventListener("input", () => { setter(+i.value || 0); recompute(); });
    }
    function bindCheck(id, setter) {
      const i = container.querySelector("#" + id);
      if (!i) return;
      i.addEventListener("change", () => { setter(i.checked); recompute(); });
    }
    bindNumber("db", v => s.db = v);
    bindNumber("fc", v => s.fc = v);
    bindNumber("fy", v => s.fy = v);
    bindNumber("cover", v => s.cover = v);
    bindNumber("clearSpacing", v => s.clearSpacing = v);
    bindNumber("gammaS", v => s.gammaS = v || 1.15);
    bindNumber("pctLapped", v => s.pctLapped = clamp(v, 0, 100));
    bindCheck("topBar", v => s.topBar = v);
    bindCheck("reducedLap", v => s.reducedLap = v);
    bindCheck("goodBond", v => s.goodBond = v);

    function recompute() {
      diagramHost.innerHTML = "";
      resultsHost.innerHTML = "";
      const r = compute(codeId, s);

      resultsHost.appendChild(el("h3", { class: "results-h" }, "Tension"));
      resultsHost.appendChild(el("div", { class: "stat-grid" }, [
        statTile({ label: "Anchorage / development length", value: fmt(r.anchorT, 0), unit: "mm" }),
        statTile({ label: "Lap length", value: fmt(r.lapT, 0), unit: "mm" }),
      ]));
      resultsHost.appendChild(el("h3", { class: "results-h" }, "Compression"));
      resultsHost.appendChild(el("div", { class: "stat-grid" }, [
        statTile({ label: "Development length", value: fmt(r.anchorC, 0), unit: "mm" }),
        statTile({ label: "Lap length", value: fmt(r.lapC, 0), unit: "mm" }),
      ]));

      resultsHost.appendChild(calcToggle(s, recompute));
      if (s.showFullCalc && r.steps) {
        resultsHost.appendChild(el("div", { class: "calc-trace" }, r.steps.map(line => el("p", {}, line))));
      }

      diagramHost.appendChild(barDiagram(r.anchorT, r.lapT, s.db));
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
