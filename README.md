# Retro Site Portfolio

A retro-styled collective portfolio and project directory. One dashboard to browse every
project — live sites, dev/staging environments, backends, databases, repos, deployments,
docs, and handoff notes — with a passkey-protected admin UI for managing sites, homepage
copy, media, and footer links.

The GitHub repository is the source of truth for this codebase. All changes flow through
GitHub; deployments build from the code committed here.

## Features

- **Project directory** — searchable, filterable cards for every site with status, owner,
  category, tech stack, and notes.
- **Environment links per project** — live, development, staging, backend/API, database,
  GitHub, Vercel, docs, and custom URLs (up to 25 per site).
- **Dedicated backend URL** — a first-class Backend / API field, mirrored as a `backend`
  link so it appears alongside the other environment buttons.
- **Per-project gallery** — up to 20 images per site, optimized in the browser on upload.
- **Editable homepage** — badge, hero, collection headings, about text, logo, and all
  footer details, managed through the admin UI and stored in PostgreSQL.
- **Shared media library** — homepage gallery images with validation and alt text.
- **Footer link manager** — social, resource, and legal links grouped and ordered.
- **Admin access** — passkey sign-in issuing a long-lived signed session token stored
  hashed in PostgreSQL, with cookie + bearer/header auth and revocation on sign-out.
- **Health check** — `GET /api/health` verifies database connectivity.
- **Dual clocks + retro terminal aesthetic** — Manila × Texas time, custom dashboard UI.

## Tech Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Framework  | [Next.js 16](https://nextjs.org/) (App Router)          |
| UI         | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/) |
| Icons      | [Lucide React](https://lucide.dev/)                     |
| Language   | [TypeScript 5](https://www.typescriptlang.org/) (strict) |
| Database   | [PostgreSQL](https://www.postgresql.org/) (Neon-compatible) |
| ORM        | [Drizzle ORM](https://orm.drizzle.team/) + [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) |
| Driver     | [`pg` connection pool](https://node-postgres.com/) with auto TLS for remote hosts |
| Validation | Hand-rolled server-side parsers (`src/lib/*-validation.ts`) |
| Linting    | [ESLint 9](https://eslint.org/) with `eslint-config-next` |

**Runtime:** Node.js 20+.

## Project Structure

```
retro-site-portfolio/
├── README.md                  # This file — overview, setup, and reference
├── NEON.md                    # Neon backend setup guide (link, env, schema, deploy)
├── .env.example               # Example environment variables (copy to .env)
├── drizzle.config.ts          # Drizzle Kit config (reads DATABASE_URL)
├── neon.ts                    # Neon tooling config (@neon/config)
├── next.config.ts             # Next.js config
├── postcss.config.mjs         # PostCSS + Tailwind CSS 4 plugin
├── eslint.config.mjs          # ESLint flat config (Next.js core-web-vitals)
├── tsconfig.json              # TypeScript config (strict, @/* → ./src/*)
├── package.json               # Scripts and dependencies
│
└── src/
    ├── app/
    │   ├── layout.tsx         # Root layout + metadata
    │   ├── page.tsx           # Homepage (server component, force-dynamic)
    │   ├── globals.css        # Tailwind + retro theme styles
    │   └── api/
    │       ├── health/route.ts                    # GET  /api/health
    │       ├── admin/auth/route.ts                # GET/POST/DELETE /api/admin/auth
    │       ├── sites/route.ts                     # GET /api/sites, POST /api/sites (admin)
    │       ├── sites/[id]/route.ts                # PATCH/DELETE /api/sites/:id (admin)
    │       ├── sites/[id]/images/route.ts         # GET/POST site images
    │       ├── sites/[id]/images/[imageId]/route.ts # GET/DELETE one site image
    │       ├── settings/route.ts                  # GET/PUT homepage + footer content
    │       ├── media/route.ts                     # GET/POST shared gallery media
    │       ├── media/[id]/route.ts                # GET/DELETE one media item
    │       ├── footer-links/route.ts              # GET/POST footer links
    │       └── footer-links/[id]/route.ts         # PATCH/DELETE one footer link
    │
    ├── components/
    │   ├── collective-dashboard.tsx  # Main dashboard UI (search, filters, cards, admin)
    │   ├── site-editor.tsx           # Create/edit project form + image uploads
    │   ├── site-footer.tsx           # Public footer rendering
    │   ├── footer-editor.tsx         # Admin footer content + links editor
    │   └── brand-icons.tsx           # Brand/social SVG icon set
    │
    ├── db/
    │   ├── index.ts           # pg Pool + Drizzle client (singleton in dev, auto TLS)
    │   └── schema.ts          # Tables + inferred types (see Data Model)
    │
    └── lib/
        ├── admin-auth.ts       # Passkey sessions: sign, store, verify, revoke
        ├── site-validation.ts  # Site + link input parsing/validation
        ├── site-content.ts     # Homepage/footer content type + defaults + parser
        ├── footer-links.ts     # Footer link platforms, groups, parser
        └── media-validation.ts # Image upload validation (types, sizes, limits)
```

## Getting Started

### Prerequisites

- Node.js 20 or newer (`node --version`)
- A PostgreSQL database (local Postgres or a hosted provider such as Neon)

### 1. Clone and install

```bash
git clone <your-github-repo-url> retro-site-portfolio
cd retro-site-portfolio
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Then edit `.env`:

| Variable            | Required    | Default | Description                                          |
| ------------------- | ----------- | ------- | ---------------------------------------------------- |
| `DATABASE_URL`      | Yes         | —       | PostgreSQL connection string (keep `?sslmode=require` for hosted DBs) |
| `ADMIN_PASSKEY`     | Recommended | `5309`  | Passkey for the admin sign-in dialog                 |
| `DATABASE_POOL_MAX` | No          | `10`    | `pg` pool size                                       |

> Change `ADMIN_PASSKEY` before going live. Changing it signs out existing admin
> sessions, which is expected.

### 3. Create the tables

```bash
npx drizzle-kit push
```

`drizzle.config.ts` reads `DATABASE_URL`, so this applies the schema in
`src/db/schema.ts` to whichever database that variable points at. For Neon-specific
steps (linking the project, connection strings, deploy), see [`NEON.md`](./NEON.md).

### 4. Run the app

```bash
npm run dev     # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

## Scripts

| Script            | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start the Next.js dev server             |
| `npm run build`   | Production build                         |
| `npm start`       | Serve the production build               |
| `npm run lint`    | Run ESLint                               |
| `npm run typecheck` | Type-check with `tsc --noEmit`         |
| `npm run db:push` | Push Drizzle schema to the database      |
| `npm run db:generate` | Generate SQL migrations from the schema |
| `npm run db:studio` | Open Drizzle Studio                     |

## Admin Access

1. Click **Admin sign in** (or triple-click the logo).
2. Enter the `ADMIN_PASSKEY`.
3. Manage projects, homepage copy, media, and footer links inline.

Sessions are signed tokens (`HMAC-SHA256` over the passkey) with a one-year expiry,
stored as SHA-256 hashes in `admin_sessions`. Auth is accepted via the
`palawan_collective_admin` HTTP-only cookie, an `Authorization: Bearer` header, or the
`x-admin-session` header. Sign-out revokes the session server-side. Legacy session
formats are migrated transparently on first use.

## API Reference

All mutating routes require admin auth (see above). Validation errors return `400`
with a human-readable `error` message; unauthenticated requests return `401`.

| Method & Path | Auth | Description |
| --- | --- | --- |
| `GET /api/health` | No | Database connectivity check → `{ ok: true }` |
| `GET /api/admin/auth` | Optional | Returns `{ authenticated, sessionToken }` |
| `POST /api/admin/auth` | Passkey body | Sign in with `{ passkey }` |
| `DELETE /api/admin/auth` | Yes | Sign out (revokes session) |
| `GET /api/sites` | No | List all sites with links + image summaries |
| `POST /api/sites` | Yes | Create a site (see `SiteInput`) |
| `PATCH /api/sites/:id` | Yes | Update a site |
| `DELETE /api/sites/:id` | Yes | Delete a site (cascades links + images) |
| `GET /api/sites/:id/images` | No | List a site's image summaries |
| `POST /api/sites/:id/images` | Yes | Upload a site image (base64 data URL, ≤ 20 per site) |
| `GET /api/sites/:id/images/:imageId` | No | Fetch one site image |
| `DELETE /api/sites/:id/images/:imageId` | Yes | Delete one site image |
| `GET /api/settings` | No | Homepage + footer content |
| `PUT /api/settings` | Yes | Update homepage + footer content |
| `GET /api/media` | No | Shared gallery summaries |
| `POST /api/media` | Yes | Upload shared media (≤ 12 items) |
| `GET /api/media/:id` | No | Fetch one media item |
| `DELETE /api/media/:id` | Yes | Delete one media item |
| `GET /api/footer-links` | No | List footer links (ordered) |
| `POST /api/footer-links` | Yes | Create a footer link (≤ 24 total) |
| `PATCH /api/footer-links/:id` | Yes | Update a footer link |
| `DELETE /api/footer-links/:id` | Yes | Delete a footer link |

**Site statuses:** `in-development` · `live` · `maintenance` · `archived`

**Link kinds:** `development` · `staging` · `live` · `backend` · `database` ·
`github` · `vercel` · `docs` · `other`

**Footer platforms:** `github` · `vercel` · `instagram` · `x` · `linkedin` ·
`youtube` · `email` · `docs` · `link`, grouped as `social` · `resource` · `legal`

## Data Model (`src/db/schema.ts`)

| Table            | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `sites`          | Project records: name, URL, `backend_url`, description, category, owner, status, tech stack, notes |
| `site_links`     | Labeled URLs per project (cascades on site delete)             |
| `site_images`    | Per-project images, base64 text (up to 20 per site)            |
| `site_settings`  | Single-row homepage copy, logo, and footer details (`id = 1`)  |
| `footer_links`   | Footer social / resource / legal links with sort order         |
| `admin_sessions` | Hashed session tokens with expiry + revocation                 |
| `site_media`     | Shared homepage gallery images, base64 text (up to 12)         |

## Deployment

Any platform that runs Next.js with a `DATABASE_URL` works (Vercel, Neon, self-hosted):

1. Set `DATABASE_URL` and `ADMIN_PASSKEY` in the hosting provider's environment.
2. Run `npx drizzle-kit push` against the production database (or apply generated migrations).
3. Build with `npm run build` and start with `npm start`.
4. Verify with `GET /api/health`.

The `pg` pool enables TLS automatically for non-local hosts, so hosted databases work
without code changes. Keep the pool small (`DATABASE_POOL_MAX`) on serverless-style
platforms to avoid exhausting connection limits.

## Contributing

1. Create a feature branch from `main`.
2. Make focused commits; run `npm run lint` and `npm run typecheck` before pushing.
3. Open a pull request against this GitHub repository — it is the source of truth,
   so review and merge happen here.
