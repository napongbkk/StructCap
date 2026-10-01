// StructCap API — the only way the website reads or writes accounts, members, payments, requests and messages.
// Tables have RLS on with no policies, so the browser cannot touch them directly; this function uses
// the service role after checking who is calling. Passwords are hashed here (PBKDF2-SHA256).
// Email to the administrator goes through Resend when the RESEND_API_KEY secret is set (optional MAIL_FROM).
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_USER = "NapongBKK";
const ADMIN_SALT = "42291376d78531243c221a49fc292654";
const ADMIN_HASH = "50fe235505d5b364014ed3586017ecf2b44c84a8998af37bc64c8c44f4a77ffb";
const ADMIN_ITER = 210000;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "napong.subanpong@outlook.com";
const USER_ITER = 120000;
const USER_RE = /^[A-Za-z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,24}$/;
const PRICE: Record<string, number> = { USD: 0.99, THB: 30 };
const SLIP_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" };

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SIGN_KEY = Deno.env.get("STRUCTCAP_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const enc = new TextEncoder();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const b64u = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const str = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);
const uid = (p: string) => p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

async function pbkdf2(pass: string, salt: string, iter: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: iter }, key, 256));
}
async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(SIGN_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
async function issue(role: string, sub: string, hours: number) {
  const p = b64u(JSON.stringify({ role, sub, exp: Date.now() + hours * 3600e3 }));
  return p + "." + (await hmac(p));
}
async function verify(token: string | undefined) {
  if (!token || !token.includes(".")) return null;
  const [p, sig] = token.split(".");
  if (!same(sig, await hmac(p))) return null;
  try { const c = JSON.parse(unb64u(p)); return c.exp > Date.now() ? c : null; } catch { return null; }
}
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const salt = () => hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
const fail = (msg: string, status = 400) => json({ error: msg }, status);
const check = (r: { error: unknown }) => { if (r.error) throw r.error; return r; };

async function getSettings() {
  const { data } = await db.from("settings").select("value").eq("id", "global").maybeSingle();
  return (data?.value || {}) as Record<string, any>;
}
async function putSettings(patch: Record<string, unknown>) {
  const v = { ...(await getSettings()), ...patch };
  check(await db.from("settings").upsert({ id: "global", value: v, updated: new Date().toISOString() }));
  return v;
}
async function extend(username: string, days: number) {
  const { data: a } = await db.from("accounts").select("expiry,start,plan").eq("username", username).maybeSingle();
  if (!a) return;
  const base = a.plan === "pro" && a.expiry && a.expiry >= today() ? a.expiry : today();
  check(await db.from("accounts").update({ plan: "pro", status: "active", expiry: addDays(base, days), start: a.start || today(), updated: new Date().toISOString() }).eq("username", username));
}

// ---------- email to the administrator (Resend)
async function mail(subject: string, rows: [string, unknown][], extra: { text?: string; replyTo?: string; attach?: { filename: string; content: string } } = {}) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  const html = `<div style="font:14px/1.5 system-ui,sans-serif;color:#14213a"><h2 style="margin:0 0 12px">${esc(subject)}</h2>
    <table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#667">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join("")}</table>
    ${extra.text ? `<p style="white-space:pre-wrap;border-left:3px solid #f2387a;padding:8px 12px;background:#fafafa">${esc(extra.text)}</p>` : ""}
    <p style="color:#889;font-size:12px">StructCap · ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC — review in the StructCap admin panel.</p></div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: Deno.env.get("MAIL_FROM") || "StructCap <onboarding@resend.dev>", to: [ADMIN_EMAIL], subject: "[StructCap] " + subject, html, reply_to: extra.replyTo && EMAIL_RE.test(extra.replyTo) ? extra.replyTo : undefined, attachments: extra.attach ? [extra.attach] : undefined }),
    });
    if (!r.ok) console.error("resend", r.status, await r.text());
    return r.ok;
  } catch (e) { console.error("resend", e); return false; }
}

// ---------- payment slip upload (base64 from the browser, max 5 MB)
async function saveSlip(username: string, id: string, slip: any) {
  if (!slip || !slip.data) return null;
  const type = String(slip.type || ""), ext = SLIP_TYPES[type];
  if (!ext) throw new Error("slipType");
  const b64 = String(slip.data).replace(/^data:[^,]*,/, "");
  if (b64.length > 7_000_000) throw new Error("slipSize");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `${username}/${id}.${ext}`;
  check(await db.storage.from("slips").upload(path, bytes, { contentType: type, upsert: true }));
  return { path, name: str(slip.name, 120) || `${id}.${ext}`, b64 };
}
async function createRequest(username: string, b: any) {
  const pro = b.pro || {}, cur = pro.currency === "THB" ? "THB" : "USD", months = Math.min(36, Math.max(1, pro.months | 0 || 1));
  const id = uid("req"), slip = await saveSlip(username, id, pro.slip);
  if (!slip) throw new Error("slipMissing");
  const amount = Math.round(PRICE[cur] * months * 100) / 100;
  check(await db.from("requests").insert({ id, username, months, amount, currency: cur, method: str(pro.method, 40) || null, ref: str(pro.ref, 120) || null, slip_path: slip.path, slip_name: slip.name, status: "pending", note: str(pro.note, 1000) || null }));
  return { id, months, amount, currency: cur, slip };
}
async function account(username: string) {
  const [{ data: a }, { data: m }, { data: rq }] = await Promise.all([
    db.from("accounts").select("username,name,plan,status,start,expiry").eq("username", username).maybeSingle(),
    db.from("members").select("email,phone,company,country,registered").eq("username", username).maybeSingle(),
    db.from("requests").select("id,months,amount,currency,status,created,decided").eq("username", username).order("created", { ascending: false }).limit(10),
  ]);
  if (!a) return null;
  const expired = a.plan === "pro" && !!a.expiry && a.expiry < today();
  return { ...a, plan: expired ? "free" : a.plan, expired: expired ? a.expiry : null, ...(m || {}), requests: rq || [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("POST only", 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const a = body.action;
  try {
    // ---------- public
    if (a === "settings") {
      const s = await getSettings();
      return json({ proFree: !!s.proFree, payInfo: s.payInfo || { en: "", th: "" }, price: PRICE });
    }
    if (a === "adminLogin") {
      const h = await pbkdf2(String(body.username) + "\u0000" + String(body.password), ADMIN_SALT, ADMIN_ITER);
      if (body.username !== ADMIN_USER || !same(h, ADMIN_HASH)) return json({ ok: false });
      return json({ ok: true, token: await issue("admin", ADMIN_USER, 12) });
    }
    if (a === "login") {
      const u = String(body.username || "");
      if (!USER_RE.test(u)) return json({ ok: false, err: "bad" });
      const { data: acc } = await db.from("accounts").select("*").eq("username", u).maybeSingle();
      if (!acc || !same(await pbkdf2(String(body.password || ""), acc.salt, acc.iter), acc.hash)) return json({ ok: false, err: "bad" });
      if (acc.status !== "active") return json({ ok: false, err: "suspended" });
      return json({ ok: true, account: await account(u), token: await issue("user", u, 24) });
    }
    if (a === "register") {
      if (body.website) return json({ ok: true }); // honeypot
      const u = str(body.username, 32), pw = String(body.password || ""), email = str(body.email, 254);
      if (!USER_RE.test(u)) return fail("Invalid username");
      if (u.toLowerCase() === ADMIN_USER.toLowerCase()) return fail("Username taken", 409);
      if (pw.length < 8 || pw.length > 128) return fail("Password too short");
      if (!EMAIL_RE.test(email)) return fail("Invalid email");
      const name = str(body.name, 120);
      if (!name) return fail("Name required");
      const { data: taken } = await db.from("accounts").select("username").ilike("username", u.replace(/[\\%_]/g, (c) => "\\" + c)).maybeSingle();
      if (taken) return fail("Username taken", 409);
      const s = salt();
      check(await db.from("accounts").insert({ username: u, name, plan: "free", status: "active", start: today(), expiry: null, salt: s, hash: await pbkdf2(pw, s, USER_ITER), iter: USER_ITER, updated: new Date().toISOString() }));
      check(await db.from("members").insert({ username: u, email, phone: str(body.phone, 40) || null, company: str(body.company, 120) || null, country: str(body.country, 60) || null, note: str(body.note, 500) || null }));
      let rq: any = null;
      if (body.plan === "pro") {
        try { rq = await createRequest(u, body); } catch (e) { console.error(e); rq = { error: String((e as Error).message || e) }; }
      }
      const rows: [string, unknown][] = [["Username", u], ["Name", name], ["Email", email], ["Phone", body.phone], ["Company", body.company], ["Country", body.country], ["Plan", body.plan === "pro" ? "Pro (application)" : "Free"]];
      if (rq && !rq.error) rows.push(["Pro period", rq.months + " month(s)"], ["Amount", rq.amount + " " + rq.currency], ["Method / ref.", (body.pro?.method || "") + " " + (body.pro?.ref || "")]);
      const emailed = await mail(body.plan === "pro" ? "New registration + Pro application: " + u : "New registration: " + u, rows, { replyTo: email, text: str(body.note, 500), attach: rq?.slip ? { filename: rq.slip.name, content: rq.slip.b64 } : undefined });
      await db.from("messages").insert({ id: uid("msg"), kind: body.plan === "pro" ? "pro" : "register", name, email, username: u, message: (body.plan === "pro" ? "Registered and applied for Pro" + (rq && !rq.error ? ` (${rq.months} month(s), ${rq.amount} ${rq.currency})` : " — slip upload failed") : "Registered (Free)") + (body.note ? " — " + str(body.note, 500) : "") });
      return json({ ok: true, emailed, request: rq && !rq.error ? { id: rq.id, months: rq.months, amount: rq.amount, currency: rq.currency } : null, slipError: rq?.error || null, account: await account(u), token: await issue("user", u, 24) });
    }
    if (a === "contact") {
      if (body.website) return json({ ok: true });
      const msg = str(body.message, 5000), email = str(body.email, 254), kind = body.kind === "feedback" ? "feedback" : "contact";
      if (msg.length < 2) return fail("Message required");
      if (email && !EMAIL_RE.test(email)) return fail("Invalid email");
      const claim = await verify(body.token);
      const user = claim?.role === "user" ? claim.sub : null;
      check(await db.from("messages").insert({ id: uid("msg"), kind, name: str(body.name, 120) || null, email: email || null, username: user, message: msg }));
      const emailed = await mail((kind === "feedback" ? "Feedback" : "Contact") + " from " + (str(body.name, 120) || email || user || "a visitor"), [["Name", body.name], ["Email", email], ["Username", user], ["Type", kind]], { text: msg, replyTo: email });
      return json({ ok: true, emailed });
    }

    const claim = await verify(body.token);
    if (!claim) return fail("Not signed in", 401);

    // ---------- signed-in member
    if (claim.role === "user") {
      const u = claim.sub;
      if (a === "me") { const acc = await account(u); return acc ? json({ ok: true, account: acc }) : fail("Not signed in", 401); }
      if (a === "changePassword") {
        const { data: acc } = await db.from("accounts").select("salt,hash,iter").eq("username", u).maybeSingle();
        if (!acc || !same(await pbkdf2(String(body.old || ""), acc.salt, acc.iter), acc.hash)) return json({ ok: false, err: "bad" });
        const pw = String(body.password || "");
        if (pw.length < 8 || pw.length > 128) return fail("Password too short");
        const s = salt();
        check(await db.from("accounts").update({ salt: s, hash: await pbkdf2(pw, s, USER_ITER), iter: USER_ITER, updated: new Date().toISOString() }).eq("username", u));
        return json({ ok: true });
      }
      if (a === "updateProfile") {
        const email = str(body.email, 254);
        if (email && !EMAIL_RE.test(email)) return fail("Invalid email");
        if (body.name !== undefined) check(await db.from("accounts").update({ name: str(body.name, 120) || null, updated: new Date().toISOString() }).eq("username", u));
        check(await db.from("members").upsert({ username: u, email: email || null, phone: str(body.phone, 40) || null, company: str(body.company, 120) || null, country: str(body.country, 60) || null }));
        return json({ ok: true, account: await account(u) });
      }
      if (a === "applyPro") {
        const { data: open } = await db.from("requests").select("id").eq("username", u).eq("status", "pending");
        if (open && open.length >= 3) return fail("Too many pending applications");
        let rq;
        try { rq = await createRequest(u, body); } catch (e) { const m = String((e as Error).message); return fail(m === "slipType" || m === "slipSize" || m === "slipMissing" ? m : "Upload failed"); }
        const acc = await account(u);
        const emailed = await mail("Pro application: " + u, [["Username", u], ["Name", acc?.name], ["Email", (acc as any)?.email], ["Pro period", rq.months + " month(s)"], ["Amount", rq.amount + " " + rq.currency], ["Method / ref.", (body.pro?.method || "") + " " + (body.pro?.ref || "")]], { replyTo: (acc as any)?.email, text: str(body.pro?.note, 1000), attach: { filename: rq.slip.name, content: rq.slip.b64 } });
        await db.from("messages").insert({ id: uid("msg"), kind: "pro", name: acc?.name || null, email: (acc as any)?.email || null, username: u, message: `Applied for Pro (${rq.months} month(s), ${rq.amount} ${rq.currency})` });
        return json({ ok: true, emailed, request: { id: rq.id, months: rq.months, amount: rq.amount, currency: rq.currency }, account: acc });
      }
      return fail("Unknown action");
    }

    // ---------- administrator only
    if (claim.role !== "admin") return fail("Not signed in as administrator", 401);
    if (a === "list") {
      const [acc, mem, pay, rq, msg, set] = await Promise.all([
        db.from("accounts").select("username,name,plan,status,start,expiry,updated"),
        db.from("members").select("*"),
        db.from("payments").select("*").order("date", { ascending: false }),
        db.from("requests").select("*").order("created", { ascending: false }).limit(500),
        db.from("messages").select("*").order("created", { ascending: false }).limit(500),
        getSettings(),
      ]);
      [acc, mem, pay, rq, msg].forEach(check);
      return json({ accounts: acc.data, members: mem.data, payments: pay.data, requests: rq.data, messages: msg.data, proFree: !!set.proFree, payInfo: set.payInfo || { en: "", th: "" }, mail: !!Deno.env.get("RESEND_API_KEY") });
    }
    if (a === "saveUser") {
      const u = body.user || {}, m = body.member || {}, pw = body.password ? String(body.password) : "";
      if (!USER_RE.test(u.username || "")) return fail("Invalid username");
      if (u.username.toLowerCase() === ADMIN_USER.toLowerCase()) return fail("Reserved username");
      const { data: old } = await db.from("accounts").select("salt,hash,iter").eq("username", u.username).maybeSingle();
      if (body.isNew && old) return fail("Username taken", 409);
      if (!old && pw.length < 8) return fail("Password too short");
      if (pw && pw.length < 8) return fail("Password too short");
      let s = old?.salt, h = old?.hash, it = old?.iter || USER_ITER;
      if (pw) { s = salt(); it = USER_ITER; h = await pbkdf2(pw, s, it); }
      check(await db.from("accounts").upsert({ username: u.username, name: u.name || null, plan: u.plan === "free" ? "free" : "pro", status: u.status === "suspended" ? "suspended" : "active", start: u.start || null, expiry: u.expiry || null, salt: s, hash: h, iter: it, updated: new Date().toISOString() }));
      check(await db.from("members").upsert({ username: u.username, email: m.email || null, phone: m.phone || null, company: m.company || null, country: m.country || null, note: m.note || null }));
      return json({ ok: true });
    }
    if (a === "deleteUser") {
      const u = String(body.username);
      const { data: files } = await db.storage.from("slips").list(u);
      if (files && files.length) await db.storage.from("slips").remove(files.map((x) => `${u}/${x.name}`));
      check(await db.from("accounts").delete().eq("username", u)); return json({ ok: true });
    }
    if (a === "extend") { await extend(String(body.username), Math.max(0, body.days | 0)); return json({ ok: true }); }
    if (a === "savePayment") {
      const p = body.payment || {}, id = body.id || uid("pay");
      check(await db.from("payments").upsert({ id, username: p.username, date: p.date || today(), amount: Math.max(0, +p.amount || 0), currency: p.currency === "THB" ? "THB" : "USD", method: p.method || null, ref: p.ref || null, days: Math.max(0, p.days | 0), status: ["paid", "pending", "refunded"].includes(p.status) ? p.status : "paid" }));
      if (body.extend && p.status === "paid" && (p.days | 0) > 0) await extend(p.username, p.days | 0);
      return json({ ok: true, id });
    }
    if (a === "deletePayment") { check(await db.from("payments").delete().eq("id", String(body.id))); return json({ ok: true }); }
    if (a === "setPromo") { await putSettings({ proFree: !!body.on }); return json({ ok: true }); }
    if (a === "setPayInfo") { await putSettings({ payInfo: { en: str(body.en, 2000), th: str(body.th, 2000) } }); return json({ ok: true }); }
    if (a === "decide") {
      const { data: r } = await db.from("requests").select("*").eq("id", String(body.id)).maybeSingle();
      if (!r) return fail("Not found", 404);
      if (r.status !== "pending") return fail("Already decided");
      const approve = !!body.approve, days = Math.max(1, (body.days | 0) || r.months * 30);
      check(await db.from("requests").update({ status: approve ? "approved" : "rejected", note: str(body.note, 1000) || r.note, decided: new Date().toISOString() }).eq("id", r.id));
      if (approve) {
        await extend(r.username, days);
        check(await db.from("payments").insert({ id: uid("pay"), username: r.username, date: today(), amount: r.amount, currency: r.currency, method: r.method || "bank", ref: r.ref || r.slip_name, days, status: "paid" }));
      }
      return json({ ok: true });
    }
    if (a === "slipUrl") {
      const { data: r } = await db.from("requests").select("slip_path").eq("id", String(body.id)).maybeSingle();
      if (!r?.slip_path) return fail("Not found", 404);
      const { data, error } = await db.storage.from("slips").createSignedUrl(r.slip_path, 600);
      if (error) throw error;
      return json({ ok: true, url: data.signedUrl });
    }
    if (a === "readMessage") { check(await db.from("messages").update({ status: body.unread ? "new" : "read" }).eq("id", String(body.id))); return json({ ok: true }); }
    if (a === "deleteMessage") { check(await db.from("messages").delete().eq("id", String(body.id))); return json({ ok: true }); }
    if (a === "reset") {
      const { data: dirs } = await db.storage.from("slips").list("");
      for (const d of dirs || []) { const { data: files } = await db.storage.from("slips").list(d.name); if (files?.length) await db.storage.from("slips").remove(files.map((x) => `${d.name}/${x.name}`)); }
      check(await db.from("messages").delete().neq("id", ""));
      check(await db.from("payments").delete().neq("id", ""));
      check(await db.from("accounts").delete().neq("username", ""));
      return json({ ok: true });
    }
    return fail("Unknown action");
  } catch (e) {
    console.error(e);
    return fail("Server error", 500);
  }
});
