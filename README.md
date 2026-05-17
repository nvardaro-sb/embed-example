# Superblocks embed examples

Minimal **React** app plus a small **Node** server: the server swaps your Superblocks **embed token** for a short-lived **session token**; the UI loads the embed with `@superblocksteam/embed-react`.

**Needs:** Node.js **18+**, npm **7+** (workspaces).

## Try it locally

1. **Clone** this repo and `cd` into the project root.
2. **`cp .env.example .env`**
3. **Edit `.env`** at the repo root and set:
   - **`SB_EMBED_TOKEN`** — your Superblocks embed token (never commit `.env`).
   - **`REACT_APP_SUPERBLOCKS_EMBED_SRC`** — the full embed URL from Superblocks. It must include **`/embed/applications/`** in the path (the normal app URL without `embed` will not work).
   - **`DATABASE_URL`** — NeonDB pooled connection string. Used to look up the user's `sys_id` from `external.users` by email, which is passed to Superblocks as `metadata.sysId`.
4. **`npm install`** then **`npm start`**
5. Open **http://localhost:3000** — UI on **3000**, token API on **3001** (the React dev server **proxies** `/api/*` to 3001).

Change `.env`? Stop the dev servers and run **`npm start`** again so env is picked up.

## Optional: Okta sign-in

**Skip Okta (no login):** leave **`REACT_APP_AUTH_MODE`** unset, or set it to anything **except** `okta`.

**Use Okta (login required before the app):**

1. **Root `.env`** — set **`REACT_APP_AUTH_MODE=okta`**, **`REACT_APP_OKTA_ISSUER`**, and **`REACT_APP_OKTA_CLIENT_ID`** (see `.env.example`). Restart **`npm start`** after changes.
2. **Okta org** — use an existing tenant or create a free one: [Okta Developer / Integrator signup](https://developer.okta.com/signup/).
3. **Create an app in Okta** (Admin Console):
   - Application type: **OIDC** → **Single-Page App**.
   - **Sign-in redirect URI:** `http://localhost:3000/login/callback`
   - **Sign-out redirect URI:** `http://localhost:3000`
   - **Trusted origins:** add `http://localhost:3000` (needed for CORS and redirects).
   - Assign at least one **user** to the application.
   - Copy the **Client ID** into **`REACT_APP_OKTA_CLIENT_ID`**.
4. **Issuer (not the Admin URL)** — in **Security → API → Authorization Servers**, open the **`default`** server and copy the **Issuer URI** into **`REACT_APP_OKTA_ISSUER`**.
5. **Access policy on `default`** — on that same **`default`** authorization server, add an **access policy** and a **rule** that allows the **Authorization Code** grant. New orgs often ship with **no** policies; without one, **`/authorize`** fails.
6. **Optional:** if your access token’s **`aud`** is not **`api://default`**, set **`REACT_APP_OKTA_AUDIENCE`** to match.

**Sanity checks (Okta mode on):**

1. Open **http://localhost:3000/secret** in an **incognito** window — you should hit **Okta** before seeing app content.
2. Run **`curl -i http://localhost:3001/api/superblocks/token`** with **no** `Authorization` header — expect **401**.

## If something breaks

- **Port 3001 in use:** `lsof -ti :3001 | xargs kill -9` then `npm start` again.
- **`500` on `/api/superblocks/token`:** server not running, bad **`SB_EMBED_TOKEN`** / **`SUPERBLOCKS_TOKEN_URL`** (EU, etc.), or DB error — check server logs for `relation "external.users" does not exist` (wrong schema) or connection errors (bad `DATABASE_URL`).
- **Invalid embed URL:** fix **`REACT_APP_SUPERBLOCKS_EMBED_SRC`** (`…/embed/applications/…`).
- **Okta policy / `access_denied`:** add **Access Policies** on **`default`** (rule with **Authorization Code**); assign user to the SPA; issuer = **Issuer URI** on **`default`**.

## Security

Local demo only. Without **`REACT_APP_AUTH_MODE=okta`**, the token route is **not** protected — do not expose it on the internet. With Okta, the route checks a JWT, but this is still not a full production setup.

**`react/build/` is not committed** (production bundles would embed your `REACT_APP_*` values). Run **`npm run build`** from the repo root after **`cp .env.example .env`** and filling in values if you need a local build.

`npm run build` / `npm test` run the React workspace.
