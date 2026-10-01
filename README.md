# StructCap

Structural design and analysis in the browser: reinforced concrete beams, columns and pile caps (including a 3D strut-and-tie check), and steel cantilever sign gantries, to

- **Eurocode 2** — EN 1992-1-1:2023, Design of concrete structures
- **Australian Standard** — AS 3600:2018, Concrete structures
- **Thai EIT Standard** — The Engineering Institute of Thailand under H.M. The King's Patronage (วสท.), strength design method

English / Thai interface, Free and Pro plans, administrator panel, full calculation report with PDF export.

© 2026 StructCap · Developed by NS

## Files

| Path | Purpose |
|---|---|
| `index.html` | Page shell and styles |
| `engine.js` | RC calculation engine (section fibre analysis, shear, torsion, SLS, pile caps) |
| `stm3d.js` | 3D strut-and-tie check of pile caps to AS 3600 Section 7 (space truss, struts, ties, nodes, anchorage) |
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
- `list`, `saveUser`, `deleteUser`, `extend`, `savePayment`, `deletePayment`, `setPromo`, `reset` — administrator token required

Optional: set a separate signing secret with `supabase secrets set STRUCTCAP_TOKEN_SECRET=<long random string>`.

To run without the database (local test mode), remove `apiUrl` from `config.js`.
