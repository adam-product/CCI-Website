# Deployment and operations

## Local setup

Requires Node 22.13 or newer and npm. Use the committed lockfile:

```sh
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_warm_bastion.sql
npm run dev -- --hostname 127.0.0.1
```

Apply each pending SQL file once, in order. Local data is stored under ignored `.wrangler/state`. For local Worker development, use an ignored `.dev.vars` file for the bootstrap settings described below.

## Verification

```sh
npm run typecheck
npm run build
npm test
npm run build:vercel
```

The integration suite starts the built Worker on localhost with disposable database and media bindings. It checks administrator setup, password sessions and resets, draft publishing, media uploads, enquiries, audit history and route responses.

## Vercel

Deploy the checkout as a Next.js project with Node 22. Configure the server-side variables in `.env.example` in the Vercel project.

### Supabase

1. In Supabase, select **Connect → Transaction pooler** and copy the connection string. Replace the password placeholder with the database password, URL-encoding characters such as `@` if needed. Save it in Vercel as `POSTGRES_URL`.
2. Save the Supabase project URL as `SUPABASE_URL`. From **Project Settings → API Keys → Secret keys**, save a server key as `SUPABASE_SECRET_KEY`. Set both the connection string and secret key as Vercel secrets and select the Production environment for all three values.
3. The next production build prepares the private `cci` database schema and the `cci-media` bucket. The database installer is additive and can also be run with `npm run db:supabase` using those same variables.

For a new database, the application starts with its bundled public content. If transferring an existing CMS, import the selected records and their media using the same IDs before serving production traffic. Treat drafts, enquiries, uploaded originals and passwords as sensitive. Accounts that previously signed in through the host must receive new CCI credentials.

### Cloudflare

For Cloudflare storage, provide a Cloudflare API token scoped to D1 for the account and R2 credentials scoped to the private media bucket.

Connect the original database and bucket if the operator has direct credentials. Otherwise, apply the versioned SQL migrations to an operator-owned D1 database and transfer the approved database export and referenced R2 objects before launch. Preserve content and object IDs so existing image links and publication state carry over. Use separate resources for previews that may receive write access. The Vercel deployment accepts new images up to 4 MB.

### First administrator

1. Run `node --experimental-strip-types scripts/create-portal-credential.mjs` in a private interactive terminal.
2. Set `CCI_ADMIN_EMAIL` to the first administrator’s address and `CCI_ADMIN_PASSWORD_HASH` to the generated hash in protected runtime settings. Publish the configuration before signing in.
3. Give the temporary password privately to the administrator. They open `/admin` and replace it on first sign-in.
4. After setup, remove the bootstrap hash from the deployment settings. The account’s permanent credential is stored in D1. Keep the email configured if the account should stay deployment-managed.

Use the parallel `CCI_TEST_ADMIN_EMAIL` and `CCI_TEST_ADMIN_PASSWORD_HASH` settings only when a second deployment-managed administrator is needed. For ordinary access, use Staff Access so a Super Administrator can later disable it. Removing a bootstrap hash does not revoke a provisioned account. An operator can rotate a deployment-managed account by arranging a new bootstrap hash and removing only that account’s credential row during an approved maintenance operation.

## Hosted release

`.openai/hosting.json` declares D1 binding `DB` and R2 binding `BUCKET`. Configure the project ID in the authorized deployment checkout when publishing through Sites. Use the Sites source workflow to apply Drizzle migrations and publish the Worker. Configure the initial administrator following the setup above.

The first deployment is a private review Site, not a public CCI-domain launch. The website's search indexing setting is independent of hosting access. A second, independent staging Site is not provisioned by this release. To create one, use a new project ID with separate D1/R2 resources and environment variables; never copy live visitor records or credentials into staging.

## Security and monitoring

- CCI verifies staff passwords on the server, stores session token digests and checks each staff API permission against the current role.
- React renders text safely; arbitrary HTML and script execution are not supported content types.
- Mutations require a matching Origin. Public enquiries use atomic DB counters, bounded fields and a honeypot.
- Uploaded images have bounded size, allowed MIME types and signature checks. SVG/HTML are rejected. R2 objects are served through the app with nosniff headers and draft authorization.
- Public APIs expose published content only and remove internal sources/hidden sections.
- Production sets CSP, nosniff, strict transport, referrer and permissions policies. Inline scripts remain enabled for framework hydration; tightening to nonces is a future hardening task.
- Administrative changes are stored in audit history. Provider Worker errors can be inspected in hosting logs. No external alerting/uptime account or analytics tracker has been configured.

Agree the enquiry retention period, deletion policy, privacy text, monitoring contacts and incident response owner before public use. Database encryption, regional placement, provider backups, MFA and session policies should be assessed against the client’s chosen production hosting and identity account. No independent penetration test has been performed.

## Backup and recovery

Backups are an operator responsibility, not a completed scheduled service. Configure provider-supported D1 recovery/exports and R2 versioning or snapshots where available. Keep encrypted exports outside source control, restrict their access, define retention and test restoration. Never commit exports containing enquiries.

For local development, stop the server and copy `.wrangler/state` to a protected backup. For a hosted restore, create an isolated database, apply the versioned schema, import the approved export, restore referenced R2 objects and verify content, staff permissions, audit entries and contact handling before switching traffic. Do not overwrite the live database during a recovery rehearsal. Deploying an older code version does not undo database migrations; use additive schema changes and a reviewed forward repair.

## Pending launch decisions

Approved organization mission/vision/background; all final English/Myanmar body copy; native review of proposed Myanmar UI; official contacts and social URLs; community photography and reuse permissions; final privacy wording and retention; approved partners/testimonials; impact figures and evidence; public domain/DNS; business email and notification provider; production audience; staging environment; backup/monitoring ownership; and LMS destination/status. These are not invented or silently finalized.
