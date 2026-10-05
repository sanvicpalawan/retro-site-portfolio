# Neon backend setup

This project uses **PostgreSQL via Drizzle ORM**, so it runs on Neon without
code changes. Everything reads `DATABASE_URL` from `.env`.

Neon project: `crimson-recipe-10425940` · branch: `production`

---

## 1. Install the Neon CLI and link the project

Run these from the project root after downloading:

```bash
npm i -g neon@latest && neon login
neon skills -y
neon mcp -y
neon link --project-id crimson-recipe-10425940 --branch production -y
neon config init
```

`neon config init` installs `@neon/config` and generates/validates `neon.ts`,
which is already committed here as:

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({});
```

Optional — install Neon skills for your assistant:

```bash
npx neon@latest skills -s neon -s neon-postgres -y
```

## 2. Point the app at Neon

```bash
cp .env.example .env
neon connection-string production
```

Paste the result into `.env`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
ADMIN_PASSKEY=5309
```

Keep `?sslmode=require`. `src/db/index.ts` enables TLS automatically for any
non-local host, and local development still works without TLS.

## 3. Create the tables on Neon

```bash
npm install
npx drizzle-kit push
```

`drizzle.config.ts` reads `DATABASE_URL`, so this applies the schema to
whichever database that variable points at.

## 4. Run and deploy

```bash
npm run dev     # http://localhost:3000
npm run build
neon deploy
```

---

## Data model (`src/db/schema.ts`)

| Table | Purpose |
| --- | --- |
| `sites` | Project records: name, primary URL, **`backend_url`**, description, category, owner, status, tech stack, notes |
| `site_links` | Multiple labeled URLs per project: live, development, staging, **backend**, **database**, GitHub, Vercel, docs, other |
| `site_images` | Per-project images (up to 20), stored as base64 text |
| `site_settings` | Homepage copy, logo, and all footer details |
| `footer_links` | Footer social, resource, and legal links |
| `admin_sessions` | Hashed admin session tokens with expiry and revocation |
| `site_media` | Shared homepage gallery images |

## Backend URL per site

Each project has a dedicated **Backend / API base URL** field in the admin
project editor. It is stored in `sites.backend_url`, shown on the project card,
and mirrored into `site_links` as a `backend` link so it appears with the other
environment buttons. You can also add a `database` link (for example, the Neon
branch console URL) from the same editor.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon connection string (keep `sslmode=require`) |
| `ADMIN_PASSKEY` | Recommended | Admin sign-in passkey; defaults to `5309` |
| `DATABASE_POOL_MAX` | No | Connection pool size, defaults to `10` |

> Change `ADMIN_PASSKEY` before going live. Changing it signs out existing
> admin sessions, which is expected.
