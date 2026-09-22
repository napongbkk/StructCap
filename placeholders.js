/* ============================================================
   StructCap — module registry + "coming soon" pages
   ============================================================ */
"use strict";

const MODULES = {
  concrete: [
    { key: "beam", en: "Beam Capacity", th: "กำลังรับน้ำหนักคาน", en_sub: "Moment / shear / torsion, ULS + crack width", th_sub: "โมเมนต์ / แรงเฉือน / แรงบิด และรอยร้าว", ready: true },
    { key: "column", en: "Column Capacity", th: "กำลังรับน้ำหนักเสา", en_sub: "Rectangular & circular, biaxial bending + shear (ULS)", th_sub: "หน้าตัดสี่เหลี่ยมและวงกลม แรงดัดสองแกน", ready: false },
    { key: "lap", en: "Lap & Anchorage Length", th: "ระยะทาบและระยะฝังยึด", en_sub: "Development, lap splice & anchorage lengths", th_sub: "ระยะฝังยึดและระยะทาบเหล็กเสริม", ready: true },
    { key: "pilecap", en: "Pile Cap Design", th: "ออกแบบฐานรากเสาเข็ม", en_sub: "Bending, one-way & punching shear", th_sub: "การดัด แรงเฉือนแบบเจาะทะลุ", ready: true },
    { key: "retaining", en: "Retaining Wall", th: "ออกแบบกำแพงกันดิน", en_sub: "Reinforcement design + stability (sliding/overturning/bearing)", th_sub: "ออกแบบเหล็กเสริมและตรวจสอบเสถียรภาพ", ready: false },
  ],
  steel: [
    { key: "open", en: "Standard Open Section", th: "หน้าตัดเหล็กรูปพรรณเปิด", en_sub: "I / H / channel / angle section capacity", th_sub: "หน้าตัด I / H / รางน้ำ / เหล็กฉาก", ready: false },
    { key: "closed", en: "Standard Closed Section", th: "หน้าตัดเหล็กรูปพรรณปิด", en_sub: "RHS / SHS / CHS section capacity", th_sub: "หน้าตัดกล่องสี่เหลี่ยมและท่อกลม", ready: false },
    { key: "builtup", en: "Built-up Box Section", th: "หน้าตัดกล่องประกอบ (Built-up)", en_sub: "Welded plate box-girder capacity", th_sub: "หน้าตัดกล่องเหล็กประกอบจากแผ่นเหล็ก", ready: false },
  ]
};

function renderPlaceholder(container, codeId, material, moduleKey) {
  const C = Codes[codeId];
  const th = codeId === "TH";
  const mod = MODULES[material].find(m => m.key === moduleKey);
  const title = th ? mod.th : mod.en;
  const refText = material === "steel" ? C.strings.refSteel : C.strings.refConcrete;
  container.appendChild(StructCap.el("div", { class: "empty-state" }, [
    StructCap.el("div", { class: "empty-icon" }, "🛠"),
    StructCap.el("h2", {}, title),
    StructCap.el("p", { class: "muted" }, refText),
    StructCap.el("p", {}, th ? TH_STR.comingSoon : "This module is on the build roadmap and not yet available."),
    StructCap.el("p", { class: "muted small" }, th ? "โมดูลนี้จะรวมแผนภาพหน้าตัด ตารางเหล็กเสริม และการตรวจสอบตามมาตรฐานฉบับเต็ม" : "It will follow the same pattern as the beam calculator: full input form, section diagram, and code-clause-referenced checks."),
  ]));
}
