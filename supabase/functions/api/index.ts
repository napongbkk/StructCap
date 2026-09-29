// StructCap API — the only way the website reads or writes accounts, members, payments and settings.
// Tables have RLS on with no policies, so the browser cannot touch them directly; this function uses
// the service role after checking who is calling. Passwords are hashed here (PBKDF2-SHA256).
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_USER = "NapongBKK";
const ADMIN_SALT = "42291376d78531243c221a49fc292654";
const ADMIN_HASH = "50fe235505d5b364014ed3586017ecf2b44c84a8998af37bc64c8c44f4a77ffb";
const ADMIN_ITER = 210000;
const USER_ITER = 120000;
const USER_RE = /^[A-Za-z0-9_.-]{3,32}$/;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SIGN_KEY = Deno.env.get("STRUCTCAP_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const enc = new TextEncoder();
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
const b64u = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

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

async function extend(username: string, days: number) {
  const { data: a } = await db.from("accounts").select("expiry,start").eq("username", username).maybeSingle();
  if (!a) return;
  const base = a.expiry && a.expiry >= today() ? a.expiry : today();
  check(await db.from("accounts").update({ plan: "pro", status: "active", expiry: addDays(base, days), start: a.start || today(), updated: new Date().toISOString() }).eq("username", username));
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
      const { data } = await db.from("settings").select("value").eq("id", "global").maybeSingle();
      return json({ proFree: !!data?.value?.proFree });
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
      if (acc.plan === "pro" && acc.expiry && acc.expiry < today()) return json({ ok: false, err: "expired", expiry: acc.expiry });
      return json({ ok: true, account: { username: acc.username, name: acc.name, plan: acc.plan, expiry: acc.expiry }, token: await issue("user", u, 24) });
    }

    // ---------- administrator only
    const claim = await verify(body.token);
    if (!claim || claim.role !== "admin") return fail("Not signed in as administrator", 401);

    if (a === "list") {
      const [acc, mem, pay, set] = await Promise.all([
        db.from("accounts").select("username,name,plan,status,start,expiry,updated"),
        db.from("members").select("*"),
        db.from("payments").select("*").order("date", { ascending: false }),
        db.from("settings").select("value").eq("id", "global").maybeSingle(),
      ]);
      [acc, mem, pay].forEach(check);
      return json({ accounts: acc.data, members: mem.data, payments: pay.data, proFree: !!set.data?.value?.proFree });
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
      check(await db.from("members").upsert({ username: u.username, email: m.email || null, phone: m.phone || null, note: m.note || null }));
      return json({ ok: true });
    }
    if (a === "deleteUser") { check(await db.from("accounts").delete().eq("username", String(body.username))); return json({ ok: true }); }
    if (a === "extend") { await extend(String(body.username), Math.max(0, body.days | 0)); return json({ ok: true }); }
    if (a === "savePayment") {
      const p = body.payment || {}, id = body.id || ("pay-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7));
      check(await db.from("payments").upsert({ id, username: p.username, date: p.date || today(), amount: Math.max(0, +p.amount || 0), currency: "USD", method: p.method || null, ref: p.ref || null, days: Math.max(0, p.days | 0), status: ["paid", "pending", "refunded"].includes(p.status) ? p.status : "paid" }));
      if (body.extend && p.status === "paid" && (p.days | 0) > 0) await extend(p.username, p.days | 0);
      return json({ ok: true, id });
    }
    if (a === "deletePayment") { check(await db.from("payments").delete().eq("id", String(body.id))); return json({ ok: true }); }
    if (a === "setPromo") { check(await db.from("settings").upsert({ id: "global", value: { proFree: !!body.on }, updated: new Date().toISOString() })); return json({ ok: true }); }
    if (a === "reset") {
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
