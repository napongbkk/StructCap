/* ============================================================
   StructCap — Limestone Gravity Retaining Wall
   Coulomb active/at-rest earth pressure, overturning, sliding,
   bearing (soil + limestone crushing), intercourse shear at the
   base joint AND at every course-to-course joint (block-by-block
   stepped geometry), plus an optional AS 4678 Appendix I
   static-equivalent earthquake assessment.
   AS 4678:2002 (Earth-retaining structures)
   ============================================================ */
"use strict";

const RetainingWallPage = (() => {
  const { el, numberField, statTile, verdictPill, fmt } = StructCap;

  function defaultState() {
    return {
      blockMode: true,
      // block / course geometry (blockMode = true)
      blockL: 0.6, blockW: 0.37, blockH: 0.2, blockGamma: 24,
      courseBlocks: [6, 6, 5, 5, 4, 4, 3, 3], // bottom → top, blocks-in-row per course
      // manual smeared geometry (blockMode = false, legacy)
      H: 2.0, B: 1.2, rhoWall: 17.6,
      alpha: 90, embed: 0.3,
      slopeOn: false,
      beta: 10, phi: 36, deltaAuto: true, delta: 28.8, gammaSoil: 18,
      hw: 0, gammaWater: 10,
      q: 20, qConstr: 12,
      fms: 0.15, kv: 0.3, k1: 0.6, qLimestone: 550,
      phiOT: 0.55, phiBC: 0.45, Ee: 1.0, EeIc: 1.5,
      bearingTable: [{ w: 1, cap: 140 }, { w: 2, cap: 151 }, { w: 3, cap: 91 }, { w: 4, cap: 74 }, { w: 5, cap: 69 }],
      eqOn: false, magDL: 1.5, magLL: 1.5, redStab: 0.8,
      showFullCalc: false,
    };
  }

  function interpBearing(table, w) {
    const rows = [...table].sort((a, b) => a.w - b.w);
    if (w <= rows[0].w) return rows[0].cap;
    if (w >= rows[rows.length - 1].w) return rows[rows.length - 1].cap;
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      if (w >= a.w && w <= b.w) {
        const t = (w - a.w) / (b.w - a.w);
        return a.cap + t * (b.cap - a.cap);
      }
    }
    return rows[rows.length - 1].cap;
  }

  /* ---------- geometry: from individual block courses (bottom→top) ---------- */
  function courseGeom(s) {
    const rows = s.courseBlocks.map(n => Math.max(1, Math.round(n)));
    const N = rows.length;
    const widths = rows.map(n => n * s.blockW); // course width, front-face flush, m
    const weights = widths.map(w => w * s.blockH * s.blockGamma); // kN/m run, per course
    const H = N * s.blockH;
    const B = widths[0]; // bottom course = footprint width
    const Wtot = weights.reduce((a, b) => a + b, 0);
    const RMself = weights.reduce((a, w, i) => a + w * (widths[i] / 2), 0); // moment about toe (front face, x=0)
    return { rows, N, widths, weights, H, B, Wtot, RMself };
  }

  /* ---------- main ULS calc (global stability, one geometry) ---------- */
  function computeULS(s) {
    const C = Codes.AS;
    const steps = s.showFullCalc ? [] : null;
    const r = (d) => d * Math.PI / 180;
    const beta = s.slopeOn ? s.beta : 0;
    const delta = s.deltaAuto ? 0.8 * s.phi : s.delta;
    const mu = Math.tan(r(delta));
    const geom = s.blockMode ? courseGeom(s) : null;
    const H = s.blockMode ? geom.H : s.H;
    const B = s.blockMode ? geom.B : s.B;
    const W = s.blockMode ? geom.Wtot : s.rhoWall * s.B * s.H;
    const RMself = s.blockMode ? geom.RMself : W * (s.B / 2);

    const Ka = C.coulombKa({ alpha: s.alpha, phi: s.phi, delta, beta });
    const Ko = C.atRestKo({ phi: s.phi, beta });
    const HR = H; // total retained height (flat-top / limited-slope case)
    const hwEff = Math.min(s.hw, H);

    if (steps) {
      steps.push(`— Geometry —`);
      if (s.blockMode) {
        steps.push(`${geom.N} courses × block height ${fmt(s.blockH, 2)} m → H = ${fmt(H, 2)} m. Bottom course = ${geom.rows[0]} blocks × ${fmt(s.blockW, 2)} m → B = ${fmt(B, 2)} m.`);
        steps.push(`Self-weight W = Σ(course width × block height × γ_block) = ${fmt(W, 2)} kN/m. Moment about toe from self-weight = ${fmt(RMself, 2)} kNm/m.`);
      } else {
        steps.push(`Self-weight W = ρ·B·H = ${fmt(s.rhoWall, 1)} × ${fmt(s.B, 2)} × ${fmt(s.H, 2)} = ${fmt(W, 2)} kN/m.`);
      }
      steps.push(`— Earth pressure coefficients —`);
      steps.push(`Backfill slope β = ${s.slopeOn ? fmt(beta, 1) + "° (sloped backfill)" : "0° (level backfill — slope option off)"}.`);
      steps.push(`δ = ${s.deltaAuto ? "0.8φ = " : ""}${fmt(delta, 1)}°, μ = tan δ = ${fmt(mu, 3)}.`);
      steps.push(`Ka (Coulomb, AS 4678) = sin²(α+φ) / [sin²α·sin(α−δ)·(1+√(sin(φ+δ)sin(φ−β)/(sin(α−δ)sin(α+β))))²] = ${fmt(Ka, 4)}.`);
      steps.push(`Ko = (1−sinφ)/(1+sinβ) = ${fmt(Ko, 4)}.`);
    }

    // active earth pressure (global stability, active state)
    const Fa = 0.5 * Ka * s.gammaSoil * HR * HR; // kN/m
    const Fah = Fa * Math.cos(r(beta));
    const Fav = Fa * Math.sin(r(beta));
    // surcharge behind wall
    const Fqh = Ka * s.q * HR; // horizontal, lever HR/2
    const Wq = s.q * B; // vertical component, bearing only
    // water (optional)
    const Fw = s.gammaWater * 0.5 * hwEff * hwEff;
    const Uw = s.gammaWater * hwEff * B / 2; // simplified triangular uplift under base
    if (steps) {
      steps.push(`— Loads (per metre run) —`);
      steps.push(`Active force Fa = 0.5·Ka·γ·HR² = ${fmt(Fa, 2)} kN/m → Fah = Fa·cosβ = ${fmt(Fah, 2)} kN/m, Fav = Fa·sinβ = ${fmt(Fav, 2)} kN/m.`);
      steps.push(`Surcharge: Fqh = Ka·q·HR = ${fmt(Fqh, 2)} kN/m (lateral), Wq = q·B = ${fmt(Wq, 2)} kN/m (vertical, bearing only).`);
      if (hwEff > 0) steps.push(`Water: Fw = ½γw·hw² = ${fmt(Fw, 2)} kN/m, uplift Uw = ½γw·hw·B = ${fmt(Uw, 2)} kN/m.`);
    }

    /* ---- (1) Overturning ---- */
    const RM = RMself + Fav * B;
    const OTM = Fah * (HR / 3) + Fqh * (HR / 2) + Fw * (hwEff / 3) + Uw * (2 * B / 3);
    const RMf = s.phiOT * RM, OTMf = s.Ee * OTM;
    const otOK = RMf >= OTMf, otUR = OTMf / RMf;
    if (steps) {
      steps.push(`— (1) Overturning —`);
      steps.push(`Restoring moment RM = ΣWi·xi + Fav·B = ${fmt(RM, 2)} kNm/m. φOT·RM = ${fmt(RMf, 2)} kNm/m.`);
      steps.push(`Overturning moment OTM = Fah·HR/3 + Fqh·HR/2 + Fw·hw/3 + Uw·2B/3 = ${fmt(OTM, 2)} kNm/m. Ee·OTM = ${fmt(OTMf, 2)} kNm/m.`);
      steps.push(`Check: φOT·RM (${fmt(RMf, 2)}) ${otOK ? "≥" : "<"} Ee·OTM (${fmt(OTMf, 2)}) → ${otOK ? "OK" : "NOT OK"}.`);
    }

    /* ---- (2) Sliding ---- */
    const driving = s.Ee * (Fah + Fqh + Fw);
    const resisting = s.phiOT * mu * (W + Fav - Uw);
    const slOK = resisting >= driving, slUR = driving / resisting;
    if (steps) {
      steps.push(`— (2) Sliding —`);
      steps.push(`Driving force = Ee·(Fah+Fqh+Fw) = ${fmt(driving, 2)} kN/m.`);
      steps.push(`Resisting force = φOT·μ·(W+Fav−Uw) = ${fmt(resisting, 2)} kN/m.`);
      steps.push(`Check: resisting (${fmt(resisting, 2)}) ${slOK ? "≥" : "<"} driving (${fmt(driving, 2)}) → ${slOK ? "OK" : "NOT OK"}.`);
    }

    /* ---- (3) Bearing ---- */
    const Ntot = W + Fav + Wq - Uw;
    const RMbearing = RMself + Fav * B + Wq * (B / 2);
    const xbar = (RMbearing - OTM) / Ntot; // distance of resultant from toe
    const e = Math.abs(B / 2 - xbar);
    const midThird = e <= B / 6;
    const Beff = B - 2 * e;
    let qUniform = null, qMax, qMin;
    if (midThird) {
      qUniform = Ntot / Beff;
      qMax = qUniform; qMin = qUniform;
    } else {
      qMax = (2 * Ntot) / (3 * (B / 2 - e));
      qMin = 0;
    }
    const capSoil = interpBearing(s.bearingTable, Beff);
    const soilOK = capSoil >= qMax, soilUR = qMax / capSoil;
    const limeOK = s.qLimestone >= qMax, limeUR = qMax / s.qLimestone;
    if (steps) {
      steps.push(`— (3) Bearing —`);
      steps.push(`N = W+Fav+Wq−Uw = ${fmt(Ntot, 2)} kN/m. x̄ from toe = ΣM_toe/N = ${fmt(xbar, 3)} m. e = |B/2−x̄| = ${fmt(e, 3)} m ${midThird ? "(within middle third)" : "(OUTSIDE middle third — triangular distribution)"}.`);
      steps.push(`Effective width B' = B−2e = ${fmt(Beff, 3)} m. Bearing pressure ${midThird ? `q = N/B' = ${fmt(qUniform, 1)} kPa (uniform)` : `qmax = 2N/(3(B/2−e)) = ${fmt(qMax, 1)} kPa, qmin = 0`}.`);
      steps.push(`Design soil bearing capacity (interpolated at B'=${fmt(Beff, 2)} m) = ${fmt(capSoil, 1)} kPa. Check: ${soilOK ? "OK" : "NOT OK"}.`);
      steps.push(`Limestone block bearing/crushing capacity = ${fmt(s.qLimestone, 0)} kPa. Check: qmax (${fmt(qMax, 1)}) vs capacity → ${limeOK ? "OK" : "NOT OK"}.`);
    }

    /* ---- (4) Intercourse shear (base joint, per 1 m width) ---- */
    const Ad = B * 1;
    const Vo = s.k1 * s.fms * Ad * 1000; // kN
    const Nshear = W + Fav;
    const V1 = s.kv * 0.9 * Nshear;
    const capShear = Vo + V1;
    const Fcomp = Ka * s.qConstr * H;
    const Fo = 0.5 * Ko * s.gammaSoil * HR * HR;
    const vAtRest = s.EeIc * (Fo + Fcomp);
    const vActive = s.EeIc * (Fah + Fqh);
    const icAtRestOK = capShear >= vAtRest, icAtRestUR = vAtRest / capShear;
    const icActiveOK = capShear >= vActive, icActiveUR = vActive / capShear;
    if (steps) {
      steps.push(`— (4) Intercourse shear (base joint) —`);
      steps.push(`Ad = B×1m = ${fmt(Ad, 2)} m². Vo = k1·f'ms·Ad·1000 = ${fmt(Vo, 2)} kN/m. V1 = kv·0.9·N = ${fmt(V1, 2)} kN/m. Capacity Vo+V1 = ${fmt(capShear, 2)} kN/m.`);
      steps.push(`At-rest demand V* = Ee·(0.5·Ko·γ·HR² + Ka·qConstr·H) = ${fmt(vAtRest, 2)} kN/m → ${icAtRestOK ? "OK" : "NOT OK"}.`);
      steps.push(`Active demand V* = Ee·(Fah+Fqh) = ${fmt(vActive, 2)} kN/m → ${icActiveOK ? "OK" : "NOT OK"}.`);
    }

    /* ---- optional earthquake assessment (AS 4678 App I, static-equivalent) ---- */
    let eq = null;
    if (s.eqOn) {
      const RMeq = s.redStab * RM;
      const OTMeq = s.magDL * (Fah * (HR / 3)) + s.magLL * (Fqh * (HR / 2));
      const eqOtOK = RMeq >= OTMeq, eqOtUR = OTMeq / RMeq;
      const drivingEq = s.magLL * Fqh + s.magDL * Fah + Fw;
      const resistingEq = s.redStab * mu * (W + Fav);
      const eqSlOK = resistingEq >= drivingEq, eqSlUR = drivingEq / resistingEq;
      eq = { RMeq, OTMeq, eqOtOK, eqOtUR, drivingEq, resistingEq, eqSlOK, eqSlUR };
      if (steps) {
        steps.push(`— Earthquake assessment (AS 4678 Appendix I, static-equivalent) —`);
        steps.push(`Overturning: RM_eq = ${fmt(s.redStab, 2)}·RM = ${fmt(RMeq, 2)} kNm/m vs OTM_eq = ${fmt(s.magDL, 2)}·Fah·HR/3 + ${fmt(s.magLL, 2)}·Fqh·HR/2 = ${fmt(OTMeq, 2)} kNm/m → ${eqOtOK ? "OK" : "NOT OK"}.`);
        steps.push(`Sliding: driving_eq = ${fmt(drivingEq, 2)} kN/m vs resisting_eq = ${fmt(resistingEq, 2)} kN/m → ${eqSlOK ? "OK" : "NOT OK"}.`);
      }
    }

    return {
      geom, H, B, beta,
      Ka, Ko, delta, mu, W, Fah, Fav, Fqh, Wq, Fw, Uw,
      ot: { RM: RMf, OTM: OTMf, ok: otOK, ur: otUR },
      sl: { driving, resisting, ok: slOK, ur: slUR },
      br: { Ntot, e, Beff, midThird, qMax, qMin, qUniform, capSoil, soilOK, soilUR, limeOK, limeUR },
      ic: { capShear, vAtRest, icAtRestOK, icAtRestUR, vActive, icActiveOK, icActiveUR },
      eq, steps,
    };
  }

  /* ---------- capacity check between every course-to-course joint ---------- */
  function computeCourseJoints(s, res) {
    if (!s.blockMode || !res.geom || res.geom.N < 2) return [];
    const { widths, weights, N } = res.geom;
    const { Ka, Ko, beta, H } = res;
    const r = (d) => d * Math.PI / 180;
    const out = [];
    for (let i = 1; i < N; i++) { // joint above course i (1-based), below course i+1
      const z = i * s.blockH; // height of joint above base
      const hAbove = H - z; // retained height above this joint
      const weightAbove = weights.slice(i).reduce((a, b) => a + b, 0); // courses i+1..N
      const Fa_i = 0.5 * Ka * s.gammaSoil * hAbove * hAbove;
      const Fah_i = Fa_i * Math.cos(r(beta));
      const Fav_i = Fa_i * Math.sin(r(beta));
      const Fqh_i = Ka * s.q * hAbove;
      const FqhConstr_i = Ka * s.qConstr * hAbove;
      const Fo_i = 0.5 * Ko * s.gammaSoil * hAbove * hAbove;
      const N_i = weightAbove + Fav_i;
      const Ad_i = widths[i]; // footprint of the course above (narrower/equal, rests on this joint)
      const Vo_i = s.k1 * s.fms * Ad_i * 1000;
      const V1_i = s.kv * 0.9 * N_i;
      const capShear_i = Vo_i + V1_i;
      const vAtRest_i = s.EeIc * (Fo_i + FqhConstr_i);
      const vActive_i = s.EeIc * (Fah_i + Fqh_i);
      const shearOK_i = capShear_i >= Math.max(vAtRest_i, vActive_i);
      const shearUR_i = Math.max(vAtRest_i, vActive_i) / capShear_i;
      const stress_i = Ad_i > 0 ? N_i / Ad_i : 0;
      const bearingOK_i = s.qLimestone >= stress_i;
      const bearingUR_i = stress_i / s.qLimestone;
      out.push({
        joint: i, z, hAbove, N: N_i, Ad: Ad_i,
        capShear: capShear_i, vAtRest: vAtRest_i, vActive: vActive_i, shearOK: shearOK_i, shearUR: shearUR_i,
        stress: stress_i, bearingOK: bearingOK_i, bearingUR: bearingUR_i,
      });
    }
    return out.reverse(); // show top joint first
  }

  /* ---------- wall cross-section diagram ---------- */
  function drawSection(s, res) {
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
    const H = res.H, B = res.B;
    const pad = 46;
    const scale = 260 / Math.max(H + 0.6, B + 1.5);
    const Wpx = 420, Hpx = (H + s.embed + 0.9) * scale + pad * 2;
    const svg = mk("svg", { viewBox: `0 0 ${Wpx} ${Hpx}`, style: "width:100%;height:auto;display:block", role: "img", "aria-label": "Retaining wall cross-section" });
    const col = { concrete: "var(--diag-concrete)", edge: "var(--diag-edge)", bar: "var(--diag-bar)", dim: "var(--diag-dim)", text: "var(--diag-text)", soil: "var(--diag-stirrup)" };
    const baseY = Hpx - pad - s.embed * scale;
    const toeX = pad + 40;
    const Bpx = B * scale, Hwpx = H * scale;

    if (s.blockMode && res.geom) {
      // stepped courses, front face flush at toeX
      const { widths, N } = res.geom;
      let y = baseY;
      widths.forEach((w, i) => {
        const wpx = w * scale, hpx = s.blockH * scale;
        svg.appendChild(mk("rect", { x: toeX, y: y - hpx, width: wpx, height: hpx, fill: col.concrete, stroke: col.edge, "stroke-width": 1.3 }));
        y -= hpx;
      });
    } else {
      const backTopOffset = H / Math.tan(s.alpha * Math.PI / 180) * scale;
      const pts = `${toeX},${baseY} ${toeX + Bpx},${baseY} ${toeX + Bpx + backTopOffset},${baseY - Hwpx} ${toeX},${baseY - Hwpx}`;
      svg.appendChild(mk("polygon", { points: pts, fill: col.concrete, stroke: col.edge, "stroke-width": 2 }));
    }

    // backfill surface (sloped, if slope option on)
    const beta = res.beta;
    const backX = toeX + Bpx;
    const slopeRun = 140, slopeRise = slopeRun * Math.tan(beta * Math.PI / 180);
    svg.appendChild(mk("line", { x1: backX, y1: baseY - Hwpx, x2: backX + slopeRun, y2: baseY - Hwpx - slopeRise, stroke: col.soil, "stroke-width": 2 }));
    svg.appendChild(mk("line", { x1: toeX - 30, y1: baseY, x2: backX + slopeRun, y2: baseY, stroke: col.dim, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    // surcharge arrows
    for (let i = 0; i < 4; i++) {
      const ax = backX + 10 + i * 32;
      svg.appendChild(mk("line", { x1: ax, y1: baseY - Hwpx - 22 - i * (slopeRise / 4), x2: ax, y2: baseY - Hwpx - 6 - i * (slopeRise / 4), stroke: col.dim, "stroke-width": 1.4 }));
    }
    const qLbl = mk("text", { x: backX + 60, y: baseY - Hwpx - 30, fill: col.text, "font-size": 10, "text-anchor": "middle", "font-family": "var(--font-mono)" });
    qLbl.textContent = "q = " + fmt(s.q, 0) + " kPa";
    svg.appendChild(qLbl);
    // dimensions
    const dimY = baseY + 20;
    svg.appendChild(mk("line", { x1: toeX, y1: dimY, x2: toeX + Bpx, y2: dimY, stroke: col.dim, "stroke-width": 1 }));
    const bLbl = mk("text", { x: toeX + Bpx / 2, y: dimY + 14, fill: col.text, "font-size": 10, "text-anchor": "middle", "font-family": "var(--font-mono)" });
    bLbl.textContent = "B = " + fmt(B, 2) + " m";
    svg.appendChild(bLbl);
    const hLbl = mk("text", { x: toeX - 16, y: baseY - Hwpx / 2, fill: col.text, "font-size": 10, "text-anchor": "middle", "font-family": "var(--font-mono)", transform: `rotate(-90 ${toeX - 16} ${baseY - Hwpx / 2})` });
    hLbl.textContent = "H = " + fmt(H, 2) + " m";
    svg.appendChild(hLbl);
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

  function jointTable(rows) {
    if (!rows.length) return el("p", { class: "formula-note" }, "Single-course wall — no course-to-course joints to check.");
    const head = el("tr", {}, ["Joint (top of course)", "Height above", "N", "Shear UR", "Bearing UR", ""].map(h => el("th", {}, h)));
    const body = rows.map(row => {
      const ok = row.shearOK && row.bearingOK;
      return el("tr", {}, [
        el("td", {}, "#" + row.joint),
        el("td", {}, fmt(row.hAbove, 2) + " m"),
        el("td", {}, fmt(row.N, 1) + " kN/m"),
        el("td", {}, el("span", { class: "ur-pill" + (row.shearUR > 1 ? " ur-over" : "") }, fmt(row.shearUR, 2))),
        el("td", {}, el("span", { class: "ur-pill" + (row.bearingUR > 1 ? " ur-over" : "") }, fmt(row.bearingUR, 2))),
        el("td", {}, verdictPill(ok, "OK", "FAIL")),
      ]);
    });
    return el("div", { class: "table-scroll" }, el("table", { class: "joint-table" }, [el("thead", {}, head), el("tbody", {}, body)]));
  }

  function calcToggle(s, recompute) {
    const btn = el("button", { class: "btn-secondary calc-toggle-btn" }, s.showFullCalc ? "Hide full calculation" : "Show full calculation");
    btn.addEventListener("click", () => { s.showFullCalc = !s.showFullCalc; recompute(); });
    return btn;
  }

  function render(container, codeId) {
    if (codeId !== "AS") {
      container.appendChild(el("div", { class: "page-head" }, [
        el("h1", {}, "Limestone Gravity Retaining Wall"),
        el("p", { class: "muted" }, "This module currently implements AS 4678 (Earth-retaining structures) only. Switch to the AS 3600 / AS 5100.5 standard to use it."),
      ]));
      return;
    }
    const s = defaultState();

    container.appendChild(el("div", { class: "page-head" }, [
      el("div", {}, [
        el("h1", {}, "Limestone Gravity Retaining Wall"),
        el("p", { class: "muted" }, "AS 4678:2002 — Earth-Retaining Structures"),
      ])
    ]));

    const grid = el("div", { class: "beam-grid" });
    container.appendChild(grid);
    const form = el("div", { class: "panel form-panel" });
    grid.appendChild(form);

    form.appendChild(el("h3", {}, "Wall Geometry"));
    form.appendChild(el("label", { class: "check-row" }, [
      el("input", { type: "checkbox", id: "blockMode", checked: s.blockMode ? "" : undefined }),
      el("span", {}, "Model as individual limestone block courses (recommended)"),
    ]));

    const blockHost = el("div", {});
    const manualHost = el("div", {});
    form.appendChild(blockHost);
    form.appendChild(manualHost);

    manualHost.appendChild(el("div", { class: "field-grid-3" }, [
      numberField({ id: "H", label: "Wall height H", value: s.H, unit: "m" }),
      numberField({ id: "B", label: "Base width B", value: s.B, unit: "m" }),
      numberField({ id: "rhoWall", label: "Wall composite density ρ", value: s.rhoWall, unit: "kN/m³", hint: "limestone + fill above, smeared" }),
    ]));

    const blockDimsHost = el("div", {});
    const courseTableHost = el("div", { class: "course-table" });
    blockHost.appendChild(el("div", { class: "field-grid-3" }, [
      numberField({ id: "blockL", label: "Block length (along wall)", value: s.blockL, unit: "m", hint: "informational — cancels out per m run" }),
      numberField({ id: "blockW", label: "Block width (thickness)", value: s.blockW, unit: "m" }),
      numberField({ id: "blockH", label: "Block height", value: s.blockH, unit: "m" }),
    ]));
    blockHost.appendChild(numberField({ id: "blockGamma", label: "Unit weight of limestone block", value: s.blockGamma, unit: "kN/m³" }));
    blockHost.appendChild(el("p", { class: "sub-hint" }, "Courses (bottom → top)"));
    blockHost.appendChild(courseTableHost);
    blockHost.appendChild(el("p", { class: "formula-note" }, "Front face is assumed flush/vertical (courses share the toe line); the back face steps in with each narrower course. Wall height H and base width B are computed from the block size and course counts below."));

    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "alpha", label: "Effective backface angle, α (Coulomb wedge)", value: s.alpha, unit: "°" }),
      numberField({ id: "embed", label: "Embedment", value: s.embed, unit: "m" }),
    ]));

    form.appendChild(el("h3", {}, "Backfill & Water"));
    form.appendChild(el("label", { class: "check-row" }, [
      el("input", { type: "checkbox", id: "slopeOn", checked: s.slopeOn ? "" : undefined }),
      el("span", {}, "Backfill has a slope at the top (rising ground behind the wall)"),
    ]));
    const betaHost = el("div", {});
    form.appendChild(betaHost);
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "phi", label: "Soil friction angle, φ", value: s.phi, unit: "°" }),
      numberField({ id: "gammaSoil", label: "Soil unit weight, γ", value: s.gammaSoil, unit: "kN/m³" }),
    ]));
    const deltaRow = el("div", { class: "field-grid-2" }, [
      el("label", { class: "check-row" }, [
        el("input", { type: "checkbox", id: "deltaAuto", checked: s.deltaAuto ? "" : undefined }),
        el("span", {}, "Auto δ = 0.8φ"),
      ]),
      numberField({ id: "delta", label: "Wall friction δ (if not auto)", value: s.delta, unit: "°" }),
    ]);
    form.appendChild(deltaRow);
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "hw", label: "Water height behind wall", value: s.hw, unit: "m", hint: "0 = no water" }),
      numberField({ id: "gammaWater", label: "Unit weight of water", value: s.gammaWater, unit: "kN/m³" }),
    ]));

    form.appendChild(el("h3", {}, "Surcharge"));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "q", label: "Design surcharge behind wall, q", value: s.q, unit: "kPa" }),
      numberField({ id: "qConstr", label: "Compaction surcharge (intercourse check)", value: s.qConstr, unit: "kPa" }),
    ]));

    form.appendChild(el("h3", {}, "Limestone Block / Masonry Properties"));
    form.appendChild(el("div", { class: "field-grid-3" }, [
      numberField({ id: "fms", label: "Char. shear bond strength, f'ms", value: s.fms, unit: "MPa" }),
      numberField({ id: "kv", label: "Shear friction coeff., kv", value: s.kv, unit: "" }),
      numberField({ id: "k1", label: "Bond strength reduction, k1", value: s.k1, unit: "" }),
    ]));
    form.appendChild(numberField({ id: "qLimestone", label: "Limestone block bearing/crushing capacity", value: s.qLimestone, unit: "kPa" }));

    form.appendChild(el("h3", {}, "Design Factors (AS 4678)"));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "phiOT", label: "φ — overturning & sliding", value: s.phiOT, unit: "" }),
      numberField({ id: "phiBC", label: "φ — bearing (informational)", value: s.phiBC, unit: "" }),
    ]));
    form.appendChild(el("div", { class: "field-grid-2" }, [
      numberField({ id: "Ee", label: "Ee — global stability action magnifier", value: s.Ee, unit: "" }),
      numberField({ id: "EeIc", label: "Ee — intercourse shear action magnifier", value: s.EeIc, unit: "" }),
    ]));

    form.appendChild(el("h3", {}, "Geotechnical Bearing Capacity (vs. effective width)"));
    const tableHost = el("div", { class: "bearing-table" });
    form.appendChild(tableHost);
    form.appendChild(el("p", { class: "formula-note" }, "Design (factored) geotechnical bearing capacity vs. effective width B′ — replace with your project's Geotechnical Design Report values. Default values below are illustrative."));

    form.appendChild(el("h3", {}, "Earthquake Assessment"));
    form.appendChild(el("label", { class: "check-row" }, [
      el("input", { type: "checkbox", id: "eqOn", checked: s.eqOn ? "" : undefined }),
      el("span", {}, "Include AS 4678 Appendix I static-equivalent earthquake case"),
    ]));
    const eqHost = el("div", { class: "field-grid-3" });
    form.appendChild(eqHost);

    const right = el("div", { class: "panel result-panel" });
    grid.appendChild(right);
    const diagramHost = el("div", { class: "diagram-host" });
    const resultsHost = el("div", { class: "results-host" });
    right.appendChild(el("h3", {}, "Section"));
    right.appendChild(diagramHost);
    right.appendChild(resultsHost);

    container.appendChild(el("p", { class: "disclaimer" }, "⚠ Preliminary design tool. Coulomb gravity-wall model. In block-course mode, self-weight and the toe moment are summed course-by-course from actual block geometry (front face assumed flush/vertical); in manual mode, self-weight uses a single composite-density rectangle. Passive resistance is ignored; water table and seismic inputs must be confirmed against a project-specific Geotechnical Design Memo. Course-to-course joint checks assume each course's footprint rests fully on the course below (no eccentric bedding) and a Coulomb wedge above the joint. Simplified methods — a qualified engineer must independently verify all results before use."));

    function renderBetaField() {
      betaHost.innerHTML = "";
      if (!s.slopeOn) { betaHost.appendChild(el("p", { class: "formula-note" }, "Level backfill assumed (β = 0°).")); return; }
      betaHost.appendChild(numberField({ id: "beta", label: "Backfill slope, β", value: s.beta, unit: "°" }));
      bindNumber("beta", v => s.beta = v);
    }

    function renderCourseTable() {
      courseTableHost.innerHTML = "";
      const hdr = el("div", { class: "course-row course-hdr" }, [
        el("span", {}, "Course"), el("span", {}, "Blocks in row"), el("span", {}, "Width"), el("span", {}, ""),
      ]);
      courseTableHost.appendChild(hdr);
      s.courseBlocks.forEach((n, i) => {
        const w = n * s.blockW;
        const rowEl = el("div", { class: "course-row" }, [
          el("span", {}, (i === 0 ? "1 (base)" : String(i + 1))),
          el("input", { type: "number", class: "cell-input", value: n, step: "1", min: "1", "data-idx": i }),
          el("span", { class: "course-width" }, fmt(w, 2) + " m"),
          el("button", { class: "btn-secondary", "data-remove": i }, "✕"),
        ]);
        courseTableHost.appendChild(rowEl);
      });
      const btnRow = el("div", { class: "course-btn-row" }, [
        el("button", { class: "btn-secondary" }, "+ Add course (top)"),
      ]);
      const addBtn = btnRow.firstChild;
      addBtn.addEventListener("click", () => {
        const last = s.courseBlocks[s.courseBlocks.length - 1] || 1;
        s.courseBlocks.push(last);
        renderCourseTable(); recompute();
      });
      courseTableHost.appendChild(btnRow);
      courseTableHost.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", () => {
          const idx = +inp.dataset.idx;
          s.courseBlocks[idx] = Math.max(1, Math.round(+inp.value || 1));
          renderCourseTable(); recompute();
        });
      });
      courseTableHost.querySelectorAll("[data-remove]").forEach(btn => {
        btn.addEventListener("click", () => {
          if (s.courseBlocks.length <= 1) return;
          s.courseBlocks.splice(+btn.dataset.remove, 1);
          renderCourseTable(); recompute();
        });
      });
    }

    function renderBearingTable() {
      tableHost.innerHTML = "";
      const hdr = el("div", { class: "bearing-row bearing-hdr" }, [
        el("span", {}, "B' (m)"), el("span", {}, "Design capacity (kPa)"), el("span", {}, ""),
      ]);
      tableHost.appendChild(hdr);
      s.bearingTable.forEach((row, i) => {
        const rowEl = el("div", { class: "bearing-row" }, [
          el("input", { type: "number", class: "cell-input", value: row.w, step: "0.1", "data-idx": i, "data-key": "w" }),
          el("input", { type: "number", class: "cell-input", value: row.cap, step: "1", "data-idx": i, "data-key": "cap" }),
          el("button", { class: "btn-secondary", "data-remove": i }, "✕"),
        ]);
        tableHost.appendChild(rowEl);
      });
      const addBtn = el("button", { class: "btn-secondary" }, "+ Add row");
      addBtn.addEventListener("click", () => { s.bearingTable.push({ w: s.bearingTable[s.bearingTable.length - 1].w + 1, cap: s.bearingTable[s.bearingTable.length - 1].cap }); renderBearingTable(); recompute(); });
      tableHost.appendChild(addBtn);
      tableHost.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("input", () => {
          const idx = +inp.dataset.idx, key = inp.dataset.key;
          s.bearingTable[idx][key] = +inp.value || 0;
          recompute();
        });
      });
      tableHost.querySelectorAll("[data-remove]").forEach(btn => {
        btn.addEventListener("click", () => {
          if (s.bearingTable.length <= 2) return;
          s.bearingTable.splice(+btn.dataset.remove, 1);
          renderBearingTable(); recompute();
        });
      });
    }
    renderBearingTable();
    renderCourseTable();
    renderBetaField();

    function renderEqInputs() {
      eqHost.innerHTML = "";
      if (!s.eqOn) return;
      eqHost.appendChild(numberField({ id: "magDL", label: "DL magnification factor", value: s.magDL, unit: "" }));
      eqHost.appendChild(numberField({ id: "magLL", label: "LL magnification factor", value: s.magLL, unit: "" }));
      eqHost.appendChild(numberField({ id: "redStab", label: "Stabilising DL reduction", value: s.redStab, unit: "" }));
      bindNumber("magDL", v => s.magDL = v);
      bindNumber("magLL", v => s.magLL = v);
      bindNumber("redStab", v => s.redStab = v);
    }

    function updateModeVisibility() {
      blockHost.hidden = !s.blockMode;
      manualHost.hidden = s.blockMode;
    }

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
    bindCheck("blockMode", v => { s.blockMode = v; updateModeVisibility(); recompute(); });
    bindNumber("H", v => s.H = v);
    bindNumber("B", v => s.B = v);
    bindNumber("rhoWall", v => s.rhoWall = v);
    bindNumber("blockL", v => s.blockL = v);
    bindNumber("blockW", v => { s.blockW = v; renderCourseTable(); recompute(); });
    bindNumber("blockH", v => s.blockH = v);
    bindNumber("blockGamma", v => s.blockGamma = v);
    bindNumber("alpha", v => s.alpha = v || 90);
    bindNumber("embed", v => s.embed = v);
    bindCheck("slopeOn", v => { s.slopeOn = v; renderBetaField(); recompute(); });
    bindNumber("phi", v => s.phi = v);
    bindNumber("gammaSoil", v => s.gammaSoil = v);
    bindCheck("deltaAuto", v => s.deltaAuto = v);
    bindNumber("delta", v => s.delta = v);
    bindNumber("hw", v => s.hw = v);
    bindNumber("gammaWater", v => s.gammaWater = v);
    bindNumber("q", v => s.q = v);
    bindNumber("qConstr", v => s.qConstr = v);
    bindNumber("fms", v => s.fms = v);
    bindNumber("kv", v => s.kv = v);
    bindNumber("k1", v => s.k1 = v);
    bindNumber("qLimestone", v => s.qLimestone = v);
    bindNumber("phiOT", v => s.phiOT = v);
    bindNumber("phiBC", v => s.phiBC = v);
    bindNumber("Ee", v => s.Ee = v);
    bindNumber("EeIc", v => s.EeIc = v);
    bindCheck("eqOn", v => { s.eqOn = v; renderEqInputs(); recompute(); });

    function recompute() {
      diagramHost.innerHTML = "";
      resultsHost.innerHTML = "";
      let r;
      try {
        r = computeULS(s);
      } catch (e) {
        resultsHost.appendChild(el("p", { class: "formula-note" }, "Could not solve — check inputs (" + e.message + ")"));
        return;
      }

      resultsHost.appendChild(el("h3", { class: "results-h" }, "Geometry & Earth Pressure"));
      resultsHost.appendChild(el("div", { class: "stat-grid-3" }, [
        statTile({ label: "Height, H", value: fmt(r.H, 2), unit: "m" }),
        statTile({ label: "Base width, B", value: fmt(r.B, 2), unit: "m" }),
        statTile({ label: "Self-weight, W", value: fmt(r.W, 1), unit: "kN/m" }),
      ]));
      resultsHost.appendChild(el("div", { class: "stat-grid" }, [
        statTile({ label: "Active, Ka", value: fmt(r.Ka, 4), unit: "" }),
        statTile({ label: "At-rest, Ko", value: fmt(r.Ko, 4), unit: "" }),
      ]));

      resultsHost.appendChild(el("h3", { class: "results-h" }, "(1) Overturning"));
      resultsHost.appendChild(checkRow("Overturning moment", r.ot.OTM, r.ot.RM, "kNm/m", r.ot.ok, 2));

      resultsHost.appendChild(el("h3", { class: "results-h" }, "(2) Sliding"));
      resultsHost.appendChild(checkRow("Sliding force", r.sl.driving, r.sl.resisting, "kN/m", r.sl.ok, 2));

      resultsHost.appendChild(el("h3", { class: "results-h" }, "(3) Bearing"));
      resultsHost.appendChild(checkRow("Soil bearing (governing pressure)", r.br.qMax, r.br.capSoil, "kPa", r.br.soilOK, 1));
      resultsHost.appendChild(checkRow("Limestone block crushing", r.br.qMax, s.qLimestone, "kPa", r.br.limeOK, 1));
      resultsHost.appendChild(el("p", { class: "formula-note" }, `e = ${fmt(r.br.e, 3)} m ${r.br.midThird ? "(within middle third)" : "(OUTSIDE middle third)"}, B' = ${fmt(r.br.Beff, 3)} m.`));

      resultsHost.appendChild(el("h3", { class: "results-h" }, "(4) Intercourse Shear (base joint)"));
      resultsHost.appendChild(checkRow("At-rest condition", r.ic.vAtRest, r.ic.capShear, "kN/m", r.ic.icAtRestOK, 2));
      resultsHost.appendChild(checkRow("Active condition", r.ic.vActive, r.ic.capShear, "kN/m", r.ic.icActiveOK, 2));

      if (s.blockMode) {
        resultsHost.appendChild(el("h3", { class: "results-h" }, "(5) Capacity Between Limestone Courses"));
        resultsHost.appendChild(el("p", { class: "formula-note" }, "Shear-friction (bond + friction) and crushing/bearing stress checked at every course-to-course joint, using the Coulomb wedge above that joint."));
        const joints = computeCourseJoints(s, r);
        resultsHost.appendChild(jointTable(joints));
      }

      if (r.eq) {
        resultsHost.appendChild(el("h3", { class: "results-h" }, "Earthquake Assessment (AS 4678 App. I)"));
        resultsHost.appendChild(checkRow("Overturning", r.eq.OTMeq, r.eq.RMeq, "kNm/m", r.eq.eqOtOK, 2));
        resultsHost.appendChild(checkRow("Sliding", r.eq.drivingEq, r.eq.resistingEq, "kN/m", r.eq.eqSlOK, 2));
      }

      resultsHost.appendChild(calcToggle(s, recompute));
      if (s.showFullCalc && r.steps) {
        resultsHost.appendChild(el("div", { class: "calc-trace" }, r.steps.map(line => el("p", {}, line))));
      }

      diagramHost.appendChild(drawSection(s, r));
    }

    updateModeVisibility();
    renderEqInputs();
    recompute();
  }

  return { render };
})();
