# Pinterest Ads MCP — setup guide

Connect your AI assistant (Cursor, Claude Desktop, etc.) to **one Pinterest ad account** so it can read performance data, run account audits, and make **guarded** changes (preview first, then confirm).

You do not need to write code. You will copy settings, run a few terminal commands, click through Pinterest login once, and paste a small JSON config into your AI tool.

**What this is:** a small web app plus an **MCP** (Model Context Protocol) bridge. MCP is how compatible AI apps call structured “tools” instead of guessing from screenshots.

**What this is not:** a multi-brand agency dashboard, billing manager, or delete-anything admin panel. One deployment = one ad account.

---

## Before you start — checklist

Gather these before installing:

| Requirement | Why you need it |
| --- | --- |
| **Pinterest Business account** | Ads API access is tied to business identity. |
| **Ad account** you will manage | This server is locked to a single `PINTEREST_AD_ACCOUNT_ID`. |
| **Ad account role: Admin or Campaign Manager** (Analyst is read-only) | Write tools need create/update permission; Analyst → 403 on applies. |
| **Valid ads billing** on the account (for live ads) | Pinterest may block creation or delivery without billing. |
| **Pinterest developer app** | OAuth client ID and secret for login. |
| **Node.js 20+** and **npm** | Runs the server locally ([nodejs.org](https://nodejs.org)). |
| **Terminal access** on your Mac/PC | For `npm install` and `npm run dev`. |

Optional later:

| Requirement | Why |
| --- | --- |
| **Vercel** (or similar) account | Host the app on a URL instead of only localhost. |
| **Strong secrets** | Protect OAuth and MCP endpoints in production. |

---

## Part 1 — Local setup (recommended first)

### Step 1 — Get the project on your machine

1. Clone or download this repository to a folder you will keep (e.g. `~/pinterest-ads-mcp`).
2. Open Terminal and go to that folder:
   ```bash
   cd /path/to/pinterest-ads-mcp
   ```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Create your environment file

1. Copy the template:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` in a text editor and fill in values (see **Environment variables** below).

Generate strong random secrets (run in Terminal, paste output into `.env.local`):

```bash
# 32+ characters — used to encrypt the Pinterest refresh token on disk
openssl rand -base64 32

# 16+ characters — protects the MCP HTTP endpoint
openssl rand -base64 24

# 16+ characters — signs OAuth “state” during login (CSRF protection)
openssl rand -base64 24
```

Use **different** values for `TOKEN_ENCRYPTION_KEY`, `MCP_AUTH_TOKEN`, and `OAUTH_STATE_SECRET`.

### Step 4 — Create a Pinterest developer app

1. Go to [Pinterest Developers](https://developers.pinterest.com/) and sign in with the **same business identity** that owns the ad account.
2. Create an app (or use an existing one).
3. Note the **App ID** → `PINTEREST_APP_ID` and **App secret** → `PINTEREST_APP_SECRET`.
4. Add an **OAuth redirect URI** that matches **exactly** (including `http` vs `https`, path, no trailing slash unless you configured one):

   | Where you run the app | Redirect URI to register |
   | --- | --- |
   | Local (default) | `http://localhost:3000/api/oauth/pinterest` |
   | Cloud host | `https://YOUR-DOMAIN/api/oauth/pinterest` |

   Mismatch is the most common setup failure (“redirect_uri mismatch”).

5. Enable / request access for the **Ads API** scopes your app needs (Pinterest’s developer console labels may vary; the server requests the list below at login).

### Step 5 — Required OAuth scopes

When you click **Start Pinterest OAuth** on `/connect`, the server asks Pinterest for these scopes (comma-separated in the authorize URL):

| Scope | Purpose |
| --- | --- |
| `user_accounts:read` | Confirm which user authorized the app. |
| `ads:read` | Read campaigns, ad groups, ads, analytics, audit data. |
| `ads:write` | Create/update campaigns, ads, keywords (via guarded tools). |
| `pins:read` | Read Pin metadata linked to ads. |
| `pins:write` | Create Pins when building new ads. |
| `boards:read` | Board context for Pins. |
| `boards:write` | Pin creation may require board access. |
| `catalogs:read` | Catalog / shopping audit evidence. |
| `catalogs:write` | Catalog-related writes if your workflows need them. |

If Pinterest shows fewer scopes after login, your developer app may not be approved for Ads API yet — fix that in the developer portal before expecting tools to work.

### Step 6 — Find your ad account ID

In [Pinterest Ads Manager](https://ads.pinterest.com/), open the ad account you want this server to use. The account ID is often visible in the URL or account settings (numeric string). Set:

```env
PINTEREST_AD_ACCOUNT_ID=your_numeric_ad_account_id
```

Use `pinterest_list_ad_accounts` later to confirm the ID matches the connected user.

### Step 7 — Start the server

```bash
npm run dev
```

You should see Next.js running on **http://localhost:3000**.

### Step 8 — Connect Pinterest (OAuth)

1. In a browser, open **http://localhost:3000/connect**.
2. Check the page:
   - **Sandbox mode** on/off should match `PINTEREST_USE_SANDBOX` in `.env.local` (see **Sandbox vs live**).
   - **Ad account id** should show your configured ID.
3. Click **Start Pinterest OAuth**.
4. Log in to Pinterest and **Allow** the requested permissions.
5. Pinterest sends you back to the app. **Success looks like:**
   - Green message: **“Pinterest connected successfully.”**
   - A **Stored connection** section with connected time and scope list.
   - **No** refresh token shown on the page (by design).

**Where tokens live:**

- After OAuth, an encrypted refresh token is saved in **`.data/oauth.json`** on the machine running the server.
- That file is **secret**. It is listed in `.gitignore` — **never commit it** or paste it into chat.
- Decryption uses `TOKEN_ENCRYPTION_KEY` from `.env.local`. If you lose the key, you must run `/connect` again after generating a new key (old file becomes unusable).

Alternative (advanced): put a plain `PINTEREST_REFRESH_TOKEN` or `PINTEREST_REFRESH_TOKEN_ENCRYPTED` in env instead of using `.data/oauth.json` — useful for cloud hosts without persistent disk.

---

## Part 2 — Connect your AI tool

Two supported paths. Pick **one** (HTTP is easier when the app stays running; stdio is fine for all-local setups).

### Option A — HTTP MCP (`/api/mcp`)

The server exposes MCP at:

```text
http://localhost:3000/api/mcp
```

**Authentication:**

- If `MCP_AUTH_TOKEN` is **unset**, anyone who can reach the URL can use your tools — only acceptable on a locked-down machine.
- If `MCP_AUTH_TOKEN` is **set**:
  - On **localhost**, requests without a token are still allowed (convenience for local dev).
  - On a **public URL** (e.g. Vercel), every request must include  
    `Authorization: Bearer YOUR_MCP_AUTH_TOKEN` or you get **401 Unauthorized**.

**Cursor `mcp.json` example** (adjust path and token):

```json
{
  "mcpServers": {
    "pinterest-ads": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

Keep `npm run dev` running while you use HTTP MCP locally.

For production URL:

```json
"url": "https://YOUR-DOMAIN/api/mcp"
```

Always use the `Authorization` header on non-localhost hosts.

### Option B — stdio MCP (`npm run stdio`)

Runs MCP over standard input/output — no browser URL. Your AI app launches the process.

**Cursor `mcp.json` example:**

```json
{
  "mcpServers": {
    "pinterest-ads": {
      "command": "npm",
      "args": ["run", "stdio"],
      "cwd": "/absolute/path/to/pinterest-ads-mcp",
      "env": {
        "PINTEREST_APP_ID": "…",
        "PINTEREST_APP_SECRET": "…",
        "PINTEREST_AD_ACCOUNT_ID": "…",
        "TOKEN_ENCRYPTION_KEY": "…",
        "PINTEREST_USE_SANDBOX": "true"
      }
    }
  }
}
```

stdio does **not** load `.env.local` automatically. Either:

- Put required variables in the `"env"` block (as above), or  
- Export them in your shell before Cursor starts.

OAuth for stdio: complete **`npm run dev`** once and visit `/connect`, **or** set `PINTEREST_REFRESH_TOKEN` in the `"env"` block after connecting elsewhere.

---

## Part 3 — Optional: deploy to Vercel (or similar)

Use cloud hosting when you want MCP available without keeping your laptop on.

1. Push the repo to GitHub (do **not** commit `.env.local` or `.data/`).
2. Import the project in [Vercel](https://vercel.com) as a Next.js app.
3. Set **all** environment variables from `.env.local` in the Vercel project settings.
4. Update:
   - `NEXT_PUBLIC_APP_URL` → `https://YOUR-DOMAIN`
   - `PINTEREST_REDIRECT_URI` → `https://YOUR-DOMAIN/api/oauth/pinterest`
5. Add the same redirect URI in the Pinterest developer app.
6. Deploy, then visit `https://YOUR-DOMAIN/connect` and complete OAuth **on the deployed site**.

**Important for cloud:**

- Serverless disks are **ephemeral**. `.data/oauth.json` may disappear on redeploy. Prefer storing `PINTEREST_REFRESH_TOKEN_ENCRYPTED` + `TOKEN_ENCRYPTION_KEY` in the host’s env after the first successful connect, or re-run `/connect` after each deploy if you rely on the file.
- Set a strong `MCP_AUTH_TOKEN` and **always** send the Bearer header from your AI client.
- Do not share the public MCP URL publicly without that token.

Build/start commands (if your host asks):

| Script | Command |
| --- | --- |
| Install | `npm install` |
| Build | `npm run build` |
| Start | `npm run start` |

---

## Environment variables

| Variable | Required when | What it is | If missing / wrong |
| --- | --- | --- | --- |
| `PINTEREST_APP_ID` | OAuth + API | Developer app ID | Cannot start OAuth or call API. |
| `PINTEREST_APP_SECRET` | OAuth + API | Developer app secret | Token exchange fails. |
| `PINTEREST_REDIRECT_URI` | OAuth | Must match Pinterest app setting | Redirect or token exchange errors. |
| `PINTEREST_AD_ACCOUNT_ID` | Most tools | Single ad account for this deployment | Tools error on account resolution. |
| `PINTEREST_USE_SANDBOX` | Always set explicitly | `true` / `false` — picks sandbox vs production **API** host | Wrong environment, confusing empty data or auth errors. |
| `TOKEN_ENCRYPTION_KEY` | Storing token in `.data/oauth.json` | 32+ char secret; encrypts refresh token on disk | Cannot save or read OAuth file. |
| `OAUTH_STATE_SECRET` | OAuth login | 16+ char HMAC secret for login CSRF | `/connect` shows “Set … OAUTH_STATE_SECRET”. |
| `MCP_AUTH_TOKEN` | Recommended | 16+ char Bearer token for `/api/mcp` | Open MCP on public URLs; localhost still works without header. |
| `DRAFT_SIGNING_SECRET` | Optional | Signs write “draft” tokens (defaults to `TOKEN_ENCRYPTION_KEY`) | Write previews fail if neither is set. |
| `NEXT_PUBLIC_APP_URL` | Links / redirects | Base URL of this app (e.g. `http://localhost:3000`) | Wrong redirect targets in some flows. |
| `PINTEREST_REFRESH_TOKEN` | Optional dev | Plain refresh token in env | Bypasses `.data/oauth.json`; dev-only risk. |
| `PINTEREST_REFRESH_TOKEN_ENCRYPTED` | Optional cloud | Encrypted token blob + `TOKEN_ENCRYPTION_KEY` | Used instead of file store. |

---

## Sandbox vs live (`PINTEREST_USE_SANDBOX`)

| Setting | Behavior |
| --- | --- |
| `PINTEREST_USE_SANDBOX=true` | API calls go to `api-sandbox.pinterest.com`. Use for testing without touching live spend. |
| `PINTEREST_USE_SANDBOX=false` | Production API and real ad account data. |

On `/connect`, you can toggle **sandbox OAuth** vs **production OAuth** via the link on the page. The token exchange uses that choice. **Keep `PINTEREST_USE_SANDBOX` aligned** with how you connected; otherwise refresh and API hosts may disagree.

Default in `.env.example` is sandbox (`true`) — switch to `false` only when you intend to manage live ads.

---

## What your AI can do — tools by use case

### Account & structure (read)

| Tool | Use |
| --- | --- |
| `pinterest_get_account` | Account details, user summary, terms-of-service state. |
| `pinterest_list_ad_accounts` | Confirm which ad accounts the login can see vs your configured ID. |
| `pinterest_list_campaigns` / `pinterest_get_campaign` | Campaign list and detail. |
| `pinterest_list_ad_groups` | Ad groups, optionally filtered by campaign. |
| `pinterest_list_ads` | Ads in the account. |
| `pinterest_list_keywords` | Keywords for ad groups. |

### Reporting & analytics

| Tool | Use |
| --- | --- |
| `pinterest_get_analytics` | Quick sync stats for **short** date ranges (≤31 days), ≤100 entities, not hourly. |
| `pinterest_create_report` | Start a **large** or slow report (custom body, or template). |
| `pinterest_get_report` | Poll report job status and download link. |
| `pinterest_list_metrics` | Valid metric column names for reports. |
| `pinterest_metrics_ready` | Whether conversion metrics are ready for a date. |

**Tip:** If sync analytics refuses the request or times out, use **`pinterest_create_report`** then **`pinterest_get_report`**.

### Audit & compliance evidence

| Tool | Use |
| --- | --- |
| `pinterest_audit_snapshot` | Read-only bundle for **ads-pinterest PN-*** style controls (tags, catalogs, campaigns, etc.). Observations only — no “health score.” |

### Targeting research

| Tool | Use |
| --- | --- |
| `pinterest_get_targeting_options` | Interests, locations, geos, audiences, etc. for planning ad groups. |

### Create & change ads (guarded writes)

Nothing deletes campaigns/ads via API here. New entities default to **PAUSED**.

**Workflow:** always **draft** → review preview → **apply** with `confirm: true`. Draft tokens expire in about **5 minutes**.

| Draft tool | Apply tool | What it does |
| --- | --- | --- |
| `pinterest_draft_campaign` | `pinterest_apply_campaign` | Create/update campaigns. **New campaigns:** objectives **`SALES`** or **`LEADS`** only. |
| `pinterest_draft_ad_group` | `pinterest_apply_ad_group` | Create/update ad groups. |
| `pinterest_draft_pin` | `pinterest_apply_pin` | Create a Pin (image URL or media id). |
| `pinterest_draft_ad` | `pinterest_apply_ad` | Create/update ads. |
| `pinterest_draft_keyword` | `pinterest_apply_keyword` | Keywords including negatives. |
| `pinterest_draft_entity_status` | `pinterest_apply_entity_status` | Set ACTIVE / PAUSED / ARCHIVED on campaign, ad group, or ad. |

**Money:** tool inputs/outputs use **major currency** (e.g. dollars); the server converts to Pinterest’s micro-currency internally.

**Objectives:** Pinterest is migrating to simplified objectives. You may still **see** legacy types (`CATALOG_SALES`, `WEB_CONVERSION`, `AWARENESS`, etc.) when reading old campaigns. **Creating** new campaigns through this server only allows **`SALES`** and **`LEADS`**. Ask your AI to map legacy setups to the new model when planning creates.

---

## Quick verification after setup

In your AI chat (with MCP connected), ask it to run these in order:

1. **List tools** — you should see about **25+** `pinterest_*` tools (read, report, audit, draft/apply).
2. **`pinterest_get_account`** — returns your ad account payload without “No Pinterest refresh token”.
3. **`pinterest_audit_snapshot`** — returns a JSON evidence bundle (may take a few seconds).

If all three succeed, reporting and draft tools are ready to use.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| **redirect_uri mismatch** | Pinterest app redirect ≠ `PINTEREST_REDIRECT_URI` | Copy the URI character-for-character into the developer app; redeploy if you changed domain. |
| **401 / 403** on ads tools | Missing scopes, app not approved for Ads API, or user lacks ad account role | Re-check scopes table; confirm you’re admin on `PINTEREST_AD_ACCOUNT_ID`; re-authorize at `/connect`. |
| **No Pinterest refresh token** / tools say not connected | Never finished OAuth, deleted `.data/oauth.json`, or wrong `TOKEN_ENCRYPTION_KEY` | Visit `/connect` and complete OAuth again. |
| **Token refresh failed** | Revoked app, expired refresh, sandbox/live mismatch | Re-run `/connect`; align `PINTEREST_USE_SANDBOX` with connection mode. |
| **401 Unauthorized MCP request** | Missing/wrong Bearer on a public URL, or wrong token on localhost | Add `Authorization: Bearer` matching `MCP_AUTH_TOKEN`. On localhost you can omit the header, but a **wrong** Bearer still fails. |
| **sync_request_too_large** / analytics timeout | Range too long, too many IDs, or hourly granularity | Use `pinterest_create_report` + `pinterest_get_report`. |
| **Invalid create objective** | Draft used `CATALOG_SALES`, `WEB_CONVERSION`, etc. | Use **`SALES`** or **`LEADS`** for new campaigns only. |
| **Apply failed / confirm required** | Skipped draft step or expired draft | Run `pinterest_draft_*` again, then apply within ~5 minutes with `confirm: true`. |
| **Set PINTEREST_APP_ID… on /connect** | Incomplete `.env.local` | Fill app ID, secret, redirect URI, `OAUTH_STATE_SECRET`; restart `npm run dev`. |
| stdio tools fail immediately | Env vars not visible to subprocess | Add `"env"` in `mcp.json` or export variables before launching Cursor. |

---

## Security notes (please read)

- **`.env.local`** holds app secrets. Do not email it, commit it to GitHub, or paste into Slack/ChatGPT.
- **`.data/oauth.json`** is as sensitive as a password. Back up only encrypted, store offline, never in git.
- **MCP HTTP URL** on the internet is a remote control for your ad account if `MCP_AUTH_TOKEN` is weak or missing. Use a long random token and HTTPS.
- **Do not paste** refresh tokens, `MCP_AUTH_TOKEN`, or app secrets into AI chats — even “private” threads.
- **Who can run writes:** anyone who can call your MCP server can run **apply** tools after a draft. Lock down network access and tokens.
- This project intentionally excludes agency/business-access APIs, billing APIs, and delete tools.

---

## NPM scripts reference

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local server + `/connect` + HTTP MCP at `/api/mcp` |
| `npm run stdio` | MCP over stdio for AI apps that launch a subprocess |
| `npm run build` | Production build (cloud deploy) |
| `npm run start` | Run production build |
| `npm test` | Automated tests (optional) |

---

## Out of scope

Multi-tenant token vaults, Pinterest Business Access / partner APIs, billing management, entity delete tools, and automated “account health scores.”

For technical architecture (OpenAPI version, libraries), see comments in the repository source.
