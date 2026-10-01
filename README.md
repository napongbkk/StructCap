# StructCap

Structural design and analysis in the browser: reinforced concrete beams, columns and pile caps (including a 3D strut-and-tie check), steel cantilever sign gantries and limestone block retaining walls, to

- **Eurocode 2** — EN 1992-1-1:2023, Design of concrete structures
- **Australian Standard** — AS 3600:2018, Concrete structures
- **Thai EIT Standard** — The Engineering Institute of Thailand under H.M. The King's Patronage (วสท.), strength design method

English / Thai interface, Free and Pro plans (Pro: USD 0.99 / month on the English page, 30 THB / month on the Thai page),
self-registration with email + password (the email is the sign-in) and payment-slip upload, member page, contact and feedback form, administrator panel,
full calculation report with PDF export.

© 2026 StructCap · Developed by NS

## Files

| Path | Purpose |
|---|---|
| `index.html` | Page shell and styles |
| `engine.js` | RC calculation engine (section fibre analysis, shear, torsion, SLS, pile caps) |
| `stm3d.js` | 3D strut-and-tie check of pile caps to AS 3600 Section 7 (space truss, struts, ties, nodes, anchorage) |
| `wall.js` | Limestone block gravity wall to AS 4678: trial-wedge earth pressure, overturning, sliding, shear between blocks, bearing |
| `gantry.js` | Steel sign gantry engine: AS/NZS 1163 sections, AS 4100 members and connections, AS/NZS 1170.2 wind, AS 4100 §11 fatigue |
| `view3d.js` | Dependency-free 3D canvas renderer: gantry model with fatigue stress-range contours, pile cap strut-and-tie model |
| `app.js` | Interface, sign-in, admin panel, reports and PDF |
| `config.js` | Supabase API address and publishable key |
| `supabase/migrations/` | Database tables (accounts, members, payments, settings) |
| `supabase/functions/api/` | Edge Function: sign-in, admin actions, password hashing |

## Hosting (GitHub Pages)

Settings → Pages → Build and deployment → Source: **Deploy from a branch**, Branch: **main**, folder **/ (root)**.
The site is then served at `https://napongbkk.github.io/StructCap/`.

## Database (Supabase)

Project `StructCap` (ap-southeast-1). The tables have row-level security switched on with no policies, so the
browser cannot read or write them directly. Everything goes through the `api` Edge Function, which uses the
service role after checking the caller:

- `settings` — public: reads the "Pro for free" switch
- `login` / `adminLogin` — check passwords (PBKDF2-SHA256) and return a signed session token
- `register` — new Free account; with `plan: pro` also a Pro application with the payment slip (private `slips` bucket)
- `contact` — contact / feedback message
- `me`, `changePassword`, `updateProfile`, `applyPro` — member token required
- `list`, `saveUser`, `deleteUser`, `extend`, `savePayment`, `deletePayment`, `setPromo`, `setPayInfo`, `decide`
  (approve / reject a Pro application — approving turns Pro on and records the payment), `slipUrl`,
  `readMessage`, `deleteMessage`, `reset` — administrator token required

### Emails

Members receive: a registration confirmation, a "payment slip received" email when they apply for Pro, and a
"Pro is now active" email when the administrator approves (or a note if the payment could not be confirmed).
These need Resend with a verified sending domain: set `RESEND_API_KEY` and `MAIL_FROM` (e.g.
`StructCap <no-reply@yourdomain.com>`), optionally `SITE_URL`, in Supabase → Edge Functions → Secrets.

#### Email to the administrator

Registrations, Pro applications (with the slip attached) and contact / feedback messages are emailed to
napong.subanpong@outlook.com. Server email uses [Resend](https://resend.com): create a free account with that
address, make an API key, then in Supabase → Edge Functions → Secrets add `RESEND_API_KEY` (optionally `MAIL_FROM`
once a sending domain is verified). Until then the browser relays a summary through FormSubmit (no slip, no password);
confirm the address once from FormSubmit's first email. Everything is also listed in the admin panel.

Optional: set a separate signing secret with `supabase secrets set STRUCTCAP_TOKEN_SECRET=<long random string>`.

To run without the database (local test mode), remove `apiUrl` from `config.js`.
