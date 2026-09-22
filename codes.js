/* ============================================================
   StructCap — design-code parameter & formula modules
   AS 3600:2018 / AS 5100.5:2017 · EN 1992-1-1 (EC2) · Thai EIT 1008
   ============================================================ */
"use strict";

const Codes = {

  /* ================= AUSTRALIAN STANDARD — AS 3600:2018 / AS 5100.5:2017 / AS 4100:2020 ================= */
  AS: {
    id: "AS", name: "Australian Standard", short: "AS 3600 / AS 5100.5", enabled: true,
    lang: "en", fcLabel: "Fc", fyLabel: "fy",
    strings: {
      title: "Australian Standard",
      refConcrete: "AS 3600:2018 & AS 5100.5:2017 — Concrete Structures",
      refSteel: "AS 4100:2020 — Steel Structures",
      beamTitle: "Reinforced Concrete Beam", uls: "ULS Capacity", sls: "Crack Width / Steel Stress",
    },
    Es: 200000, ecu: 0.003,
    thetaRange: [30, 60], thetaDefault: 36,
    // AS3600 Cl 8.1.3 — rectangular stress block
    alpha2: (fc) => StructCap.clamp(1.0 - 0.003 * fc, 0.67, 0.85),
    gamma: (fc) => StructCap.clamp(1.05 - 0.007 * fc, 0.67, 0.85),
    phi: { flexure: 0.85, shear: 0.7, torsion: 0.7 },
    flexureParams(fc) { return { alpha: this.alpha2(fc), betaOf: (fcv) => this.gamma(fcv) }; },
    // Cl 8.2.7 simplified Vuc (concrete shear contribution)
    Vuc({ b, d, fc, Ast }) {
      const ratio = StructCap.clamp(Ast / (b * d), 0, 0.02);
      const beta1 = Math.max(1.1 * (1.6 - d / 1000), 1.1);
      const fcv = Math.min(fc, 65);
      return beta1 * b * d * Math.cbrt(ratio * fcv);
    },
    // Cl 8.2.10 truss shear reinforcement contribution (variable angle)
    Vus({ Asv, fsy_v, d, s, theta }) { return (Asv * fsy_v * d) / s / Math.tan(theta * Math.PI / 180); },
    VuMax({ b, d, fc }) { return 0.2 * fc * b * d; }, // Cl 8.2.6 web-crushing limit
    AsvMin({ b, fc, fsy_v }) { return (0.08 * Math.sqrt(fc) * b) / fsy_v; }, // Cl 8.2.1.7, per mm spacing (Asv/s)
    AstMin({ b, d, D, fc, fsy }) { return 0.20 * Math.pow(D / d, 2) * (0.6 * Math.sqrt(fc)) / fsy * b * d; }, // Cl 9.1.1 (simplified)
    // Cl 9.2.3 — punching shear concrete stress capacity
    vucPunch({ fc, betaH }) { return Math.min(0.17 * (1 + 2 / betaH) * Math.sqrt(fc), 0.34 * Math.sqrt(fc)); },
    // Cl 13.1.2 — tension development (anchorage) length
    Lsyt({ db, fsy, fc, k1, cd }) {
      const k2 = (132 - db) / 100;
      const k3 = StructCap.clamp(1 - 0.15 * (cd - db) / db, 0.7, 1.0);
      const L = (0.5 * k1 * k3 * fsy) / (k2 * Math.sqrt(fc)) * db;
      return { L: Math.max(L, 29 * k1 * db, 200), k2, k3 };
    },
    // Cl 13.1.3 — compression development length
    Lsyc({ db, fsy, fc }) { return Math.max((0.22 * fsy * db) / Math.sqrt(fc), 0.0435 * fsy * db, 200); },
    // Cl 13.2.2 — tension lap length
    lapFactorK7(reduced) { return reduced ? 1.0 : 1.25; },
    // Cl 8.3 torsion — thin-walled tube, closed stirrups required
    Jt({ x, y }) { return x * x * y * (1 / 3 - 0.21 * (x / y) * (1 - Math.pow(x, 4) / (12 * Math.pow(y, 4)))); },
    Tuc({ Jt, fc }) { return 0.33 * Math.sqrt(fc) * Jt; }, // Cl 8.3.3 cracking torque threshold
    TuMax({ Jt, fc }) { return 0.2 * fc * Jt; }, // approximate web-crushing torque limit companion to Tuc form
    Tus({ At, Asw, fsy_v, s, theta }) { return (2 * At * Asw * fsy_v) / s / Math.tan(theta * Math.PI / 180); },
    // Cl 8.3.6 additional longitudinal torsion steel
    Al({ Asw, s, ph, fsy_v, fsy, theta }) { return (Asw / s) * ph * (fsy_v / fsy) * Math.pow(1 / Math.tan(theta * Math.PI / 180), 2); },
    // Cl 8.3.4 combined shear + torsion web-crushing interaction
    combinedOK({ V, phiVuMax, T, phiTuMax }) { return Math.pow(V / phiVuMax, 2) + Math.pow(T / phiTuMax, 2) <= 1.0; },
    crackWidthFactor: 1.0,
    lapFactor: 1.3,
  },

  /* ================= EUROCODE — EN 1992-1-1:2004 & EN 1992-2:2005 (EC2) / EN 1993-1-1 (EC3) ================= */
  EC: {
    id: "EC", name: "Eurocode", short: "EN 1992-1-1 / EN 1992-2", enabled: true,
    lang: "en", fcLabel: "fck", fyLabel: "fyk",
    strings: {
      title: "Eurocode",
      refConcrete: "EN 1992-1-1:2004 & EN 1992-2:2005 — Concrete Structures & Concrete Bridges (Eurocode 2)",
      refSteel: "EN 1993-1-1:2005 — Steel Structures (Eurocode 3)",
      beamTitle: "Reinforced Concrete Beam", uls: "ULS Capacity", sls: "Crack Width / Steel Stress",
    },
    Es: 200000, ecu2: 0.0035,
    gammaC: 1.5, gammaS: 1.15, // defaults per EN 1992-1-1 Table 2.1N (persistent/transient) — editable on the beam page
    thetaRange: [21.8, 45], thetaDefault: 30,
    lambda(fck) { return fck <= 50 ? 0.8 : 0.8 - (fck - 50) / 400; },
    eta(fck) { return fck <= 50 ? 1.0 : 1.0 - (fck - 50) / 200; },
    flexureParams(fck, gammaC = this.gammaC) {
      const fcd = fck / gammaC;
      return { alpha: this.eta(fck) * fcd / fck, betaOf: (f) => this.lambda(f) };
    },
    VRdc({ b, d, fck, Asl, NEd = 0, Ac, gammaC = this.gammaC }) {
      const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
      const rho1 = Math.min(Asl / (b * d), 0.02);
      const CRdc = 0.18 / gammaC;
      const sigmaCp = Ac ? Math.min(NEd / Ac, 0.2 * fck / gammaC) : 0;
      const k1 = 0.15;
      const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);
      const term1 = (CRdc * k * Math.pow(100 * rho1 * fck, 1 / 3) + k1 * sigmaCp) * b * d;
      const term2 = (vmin + k1 * sigmaCp) * b * d;
      return Math.max(term1, term2);
    },
    VRds({ Asw, s, z, fywd, theta }) { return (Asw / s) * z * fywd / Math.tan(theta * Math.PI / 180); },
    VRdmax({ b, z, fck, theta, gammaC = this.gammaC }) {
      const nu1 = 0.6 * (1 - fck / 250);
      const fcd = fck / gammaC;
      const t = theta * Math.PI / 180;
      return (b * z * nu1 * fcd) / (1 / Math.tan(t) + Math.tan(t));
    },
    AsvMin({ b, fck, fyk }) { return (0.08 * Math.sqrt(fck) / fyk) * b; }, // 9.2.2, Asw/s
    AsMin({ b, d, fck, fyk }) { return Math.max(0.26 * (0.3 * Math.pow(fck, 2 / 3)) / fyk, 0.0013) * b * d; }, // 9.2.1.1
    // 6.4.4 — punching shear stress capacity (no axial credit)
    vRdcStress({ d, fck, rho1, gammaC = this.gammaC }) {
      const k = Math.min(1 + Math.sqrt(200 / d), 2.0);
      const CRdc = 0.18 / gammaC;
      const vmin = 0.035 * Math.pow(k, 1.5) * Math.sqrt(fck);
      return Math.max(CRdc * k * Math.pow(100 * Math.min(rho1, 0.02) * fck, 1 / 3), vmin);
    },
    // 8.4.2 — basic required anchorage length
    lbRqd({ db, fyd, fck, eta1, gammaC = this.gammaC }) {
      const fctm = fck <= 50 ? 0.3 * Math.pow(fck, 2 / 3) : 2.12 * Math.log(1 + (fck + 8) / 10);
      const fctd = (0.7 * fctm) / gammaC;
      const eta2 = db <= 32 ? 1.0 : (132 - db) / 100;
      const fbd = 2.25 * eta1 * eta2 * fctd;
      return { lb: (db / 4) * (fyd / fbd), fbd, fctd };
    },
    alpha2({ cd, db }) { return StructCap.clamp(1 - 0.15 * (cd - db) / db, 0.7, 1.0); },
    // 8.3, Table 8.3 — lap-length multiplier by % of bars lapped at one section
    alpha6(pctLapped) {
      const table = [[25, 1.0], [33, 1.15], [50, 1.4], [100, 1.5]];
      if (pctLapped <= table[0][0]) return table[0][1];
      for (let i = 0; i < table.length - 1; i++) {
        if (pctLapped >= table[i][0] && pctLapped <= table[i + 1][0]) {
          const t = (pctLapped - table[i][0]) / (table[i + 1][0] - table[i][0]);
          return table[i][1] + t * (table[i + 1][1] - table[i][1]);
        }
      }
      return table[table.length - 1][1];
    },
    TRdmax({ Ak, tef, fck, theta, gammaC = this.gammaC }) {
      const nu = 0.6 * (1 - fck / 250);
      const fcd = fck / gammaC;
      return 2 * nu * fcd * Ak * tef * Math.sin(theta * Math.PI / 180) * Math.cos(theta * Math.PI / 180);
    },
    TRds({ Ak, Asw, s, fywd, theta }) { return (2 * Ak * Asw * fywd) / s / Math.tan(theta * Math.PI / 180); },
    // 6.3.2(3) additional longitudinal torsion steel force -> area
    Asl({ TEd, uk, Ak, fyd, theta }) { return (TEd * uk * (1 / Math.tan(theta * Math.PI / 180))) / (2 * Ak * fyd); },
    // 6.3.2(4) combined interaction
    combinedOK({ T, TRdmax, V, VRdmax }) { return (T / TRdmax) + (V / VRdmax) <= 1.0; },
    crackWidthFactor: 1.0,
    lapFactor: 1.4,
  },

  /* ================= THAI STANDARD — EIT 1008 (ACI 318-derived, USD) — disabled for now ================= */
  TH: {
    id: "TH", name: "มาตรฐานไทย", short: "วสท. 1008 (วิธีกำลัง)", enabled: false,
    lang: "th", fcLabel: "Fc", fyLabel: "fy",
    strings: {
      title: "มาตรฐานไทย (วสท. 1008)",
      refConcrete: "วสท. 1008-38 — วิธีหน่วยแรงประลัย (อ้างอิง ACI 318)",
      refSteel: "วสท. — โครงสร้างเหล็ก",
      beamTitle: "คานคอนกรีตเสริมเหล็ก", uls: "กำลังรับแรงที่สภาวะประลัย (ULS)", sls: "ความกว้างรอยร้าว / หน่วยแรงเหล็ก",
    },
    Es: 200000, ecu: 0.003,
    thetaRange: [30, 60], thetaDefault: 45,
    beta1(fc) { return StructCap.clamp(0.85 - 0.05 * ((fc - 28) / 7), 0.65, 0.85); },
    phi: { flexure: 0.9, shear: 0.75, torsion: 0.75 },
    flexureParams(fc) { return { alpha: 0.85, betaOf: (f) => this.beta1(f) }; },
    Vc({ b, d, fc }) { return 0.17 * Math.sqrt(fc) * b * d; },
    Vs({ Av, fyt, d, s, theta }) { return (Av * fyt * d) / s / Math.tan(theta * Math.PI / 180); },
    VsMax({ b, d, fc }) { return 0.66 * Math.sqrt(fc) * b * d; },
    AvMin({ b, fc, fyt }) { return Math.max(0.062 * Math.sqrt(fc) / fyt, 0.35 / fyt) * b; }, // Av/s
    AsMin({ b, d, fc, fy }) { return Math.max((0.25 * Math.sqrt(fc)) / fy, 1.4 / fy) * b * d; },
    Tc({ Acp, pcp, fc }) { return 0.083 * Math.sqrt(fc) * (Acp * Acp) / pcp; },
    TuMax({ Acp, pcp, fc }) { return 0.33 * Math.sqrt(fc) * (Acp * Acp) / pcp; }, // approx practical torque ceiling
    Ts({ Ao, At, fyt, s, theta }) { return (2 * Ao * At * fyt) / s / Math.tan(theta * Math.PI / 180); },
    Al({ At, s, ph, fyt, fy, theta }) { return (At / s) * ph * (fyt / fy) * Math.pow(1 / Math.tan(theta * Math.PI / 180), 2); },
    combinedOK({ V, bw, d, T, ph, Aoh, fc, phiShear }) {
      const stress = Math.sqrt(Math.pow(V / (bw * d), 2) + Math.pow((T * ph) / (1.7 * Aoh * Aoh), 2));
      const limit = phiShear * (0.17 * Math.sqrt(fc) + 0.66 * Math.sqrt(fc));
      return stress <= limit;
    },
    crackWidthFactor: 1.15,
    lapFactor: 1.3,
  }
};

/* ---------- Thai UI dictionary (used across Thai-standard pages) ---------- */
const TH_STR = {
  welcomeTitle: "โปรแกรมคำนวณกำลังรับน้ำหนักโครงสร้าง",
  welcomeSub: "เลือกประเภทโครงสร้างและมาตรฐานที่ต้องการคำนวณ",
  concrete: "โครงสร้างคอนกรีต",
  steel: "โครงสร้างเหล็ก",
  back: "ย้อนกลับ",
  home: "หน้าแรก",
  geometry: "รูปตัดคาน",
  width: "ความกว้าง b",
  depth: "ความลึก h",
  cover: "ระยะหุ้มคอนกรีต",
  concreteGrade: "กำลังอัดคอนกรีต Fc",
  steelGrade: "กำลังครากเหล็กเสริม fy",
  rebarLayers: "ชั้นเหล็กเสริมตามยาว",
  addLayer: "เพิ่มชั้นเหล็ก",
  stirrups: "เหล็กปลอก",
  loads: "แรงกระทำที่สภาวะประลัย (ULS)",
  moment: "โมเมนต์ดัด Mu",
  shear: "แรงเฉือน Vu",
  torsion: "แรงบิด Tu",
  calculate: "คำนวณ",
  momentCapacity: "กำลังรับโมเมนต์ดัด",
  shearCapacity: "กำลังรับแรงเฉือน",
  torsionCapacity: "กำลังรับแรงบิด",
  status: "ผลการตรวจสอบ",
  pass: "ผ่าน", fail: "ไม่ผ่าน",
  serviceLoads: "แรงกระทำที่สภาวะใช้งาน (SLS)",
  crackWidth: "ความกว้างรอยร้าว",
  steelStress: "หน่วยแรงในเหล็กเสริม",
  comingSoon: "โมดูลนี้อยู่ระหว่างการพัฒนา",
  disclaimer: "ผลลัพธ์นี้ใช้สำหรับการออกแบบเบื้องต้นเท่านั้น วิศวกรผู้เชี่ยวชาญต้องตรวจสอบและรับรองก่อนนำไปใช้งานจริง",
  major: "แกนหลัก (Major)", minor: "แกนรอง (Minor)",
  topBar: "เหล็กบน", bottomBar: "เหล็กล่าง", sideBar: "เหล็กข้าง",
  outerLink: "ปลอกรอบนอก", internalLink: "ปลอกภายใน",
  theta: "มุมโครงถัก θ", fullCalc: "แสดงการคำนวณแบบเต็ม", hideCalc: "ซ่อนการคำนวณ",
  vmax: "แรงเฉือนสูงสุด Vmax", vc: "แรงเฉือนคอนกรีต Vc", vs: "แรงเฉือนเหล็กปลอก Vs",
  tmax: "แรงบิดสูงสุด Tmax", treo: "เหล็กเสริมรับแรงบิด",
  combined: "ผลรวมแรงเฉือนและแรงบิด", longTorsion: "เหล็กตามยาวรับแรงบิด",
  minReo: "ตรวจสอบเหล็กเสริมขั้นต่ำ",
  notAvailable: "ยังไม่เปิดใช้งาน",
  footer: "© " + new Date().getFullYear() + " StructCap — พัฒนาโดย NS สงวนลิขสิทธิ์",
};

const FOOTER_EN = "© " + new Date().getFullYear() + " StructCap — Developed by NS. All rights reserved.";
