# StructCap

Structural design and analysis in the browser: reinforced concrete beams, columns and pile caps (including a 3D strut-and-tie check), steel cantilever sign gantries and limestone block retaining walls, plus a 3D frame / truss analysis module, to

- **Eurocode 2** — EN 1992-1-1:2023, Design of concrete structures
- **Australian Standard** — AS 3600:2018, Concrete structures
- **Thai EIT Standard** — The Engineering Institute of Thailand under H.M. The King's Patronage (วสท.), strength design method

English / Thai interface, Free and Pro plans (Pro: USD 0.99 / month on the English page, 30 THB / month on the Thai page),
self-registration with email + password (the email is the sign-in) and payment-slip upload, member page, contact and feedback form, administrator panel,
full calculation report with PDF export.

### Analysis module (Free up to 80 members; Pro: larger models, P-Delta, modal, buckling, report)

- Model tree workflow: 0 design standard → 1 materials → 2 sections → 3 nodes → 4 elements → 5 supports & end releases → 6 load cases → 7 loads → 8 load combinations → 9 run analysis → 10 results
- Concrete grades with E per AS 3600 / EN 1992-1-1 / EIT (ACI); steel grades per AS/NZS 3679.1 & 1163, EN 10025, TIS 1227 / ASTM; standard sections UB, UC, IPE, HEA, HEB, JIS / TIS H, CHS, SHS, RHS; rectangles and circles
- Load combination builder (pick load cases, give factors) and standard sets: AS/NZS 1170.0, EN 1990, EIT 1008 / ACI 318, ASCE 7
- 3D frame and truss members (or 2D frames in the X–Z plane), member end hinges, β rotation, fixed / pinned / roller / custom supports and springs
- Edit in 3D: click to select, Shift-click / Ctrl-drag box selection, inspector panel, draw members node to node, place nodes on a snapped grid in plan or elevation, replicate / extrude, split, undo / redo
- Rectangle, I, circle, CHS / SHS / RHS and user sections; steel, concrete and timber materials
- Load cases (G, Q, W, E, other) with self-weight; nodal forces and moments; uniform / trapezoidal / partial / point / moment member loads in global, projected or local directions
- Combinations generated to AS/NZS 1170.0, EN 1990 or ASCE 7 (editable), ULS / SLS envelopes
- Results: deflected shape, N / Vy / Vz / T / My / Mz diagrams in 3D, reactions, member forces and deflections, storey drift in X and Y, mode shapes with mass participation in X / Y / Z, buckling factors λcr
- Templates: 3D building frame, 3D steel portal shed with bracing, 2D portal frame, continuous beam, Pratt / Howe / Warren truss; models save and open as JSON (older 2D models are converted)

© 2026 StructCap · Developed by NS

## Files

| Path | Purpose |
|---|---|
| `index.html` | Page shell and styles |
| `engine.js` | RC calculation engine (section fibre analysis, shear, torsion, SLS, pile caps) |
| `stm3d.js` | 3D strut-and-tie check of pile caps to AS 3600 Section 7 (space truss, struts, ties, nodes, anchorage) |
| `wall.js` | Limestone block gravity wall to AS 4678: trial-wedge earth pressure, overturning, sliding, shear between blocks, bearing |
| `gantry.js` | Steel sign gantry engine: AS/NZS 1163 sections, AS 4100 members and connections, AS/NZS 1170.2 wind, AS 4100 §11 fatigue |
| `steelsec.js` | Design standards for analysis: concrete and steel grades (AS, Eurocode, Thai EIT / TIS), standard I / H section tables (UB, UC, IPE, HEA, HEB, JIS / TIS H) with computed properties |
| `frame.js` | 3D frame and truss analysis engine (6 DOF per node, local axes with β rotation): stiffness method with exact member-load fixed-end actions, end releases, springs, skyline solver with RCM ordering, load combinations and envelopes, P-Delta, modal (consistent mass) and elastic buckling; optional 2D mode in the X–Z plane |
| `analysis.js` | Analysis page: interactive 3D view (orbit, plan, elevations, levels), click to select and edit nodes / members, draw members, box select, replicate / extrude, split, undo / redo, templates, tables, AS / EC / ASCE combination generator, 3D diagrams, results, report, send member forces to RC design |
| `tests/frame.test.js` | Engine checks against closed-form results (`node tests/frame.test.js`) |
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
