# Click Cross Initiative

Responsive CCI public website and persistent administration CMS, built from the supplied CCI/Way Way Shaung requirements and brand assets.

## Included

- Home, About Us, Our Initiatives, initiative detail pages, Impact, Contact and Privacy Policy
- English/Myanmar routes and independent translation fields with an explicit missing-translation fallback
- Persistent draft/published content, image uploads, impact evidence fields and protected contact inbox
- Email and password sign-in, role-based staff access and administrative audit history
- Configurable Way Way Shaung status and launch link; Cyber Lotus coming soon
- D1 schema/migration, R2 storage binding, SEO routes, responsive navigation and reduced-motion support

The full Way Way Shaung LMS is a separate phase. No assessment, course, certificate or community module is claimed to be operational here.

## Run locally

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_warm_bastion.sql
npm run dev -- --hostname 127.0.0.1
```

Apply the remaining SQL migrations in order. Follow the deployment guide to configure the first administrator for local development, then open `/admin` and sign in with the configured email and temporary password.

Run `npm run build` followed by `npm test` to verify the Worker in a disposable database and media bucket. `npm run typecheck` checks TypeScript. `npm run build:vercel` builds the Next.js deployment.

## Documentation

- [Architecture, sitemap, database and role matrix](docs/ARCHITECTURE.md)
- [Staff editing and publishing guide](docs/ADMIN-GUIDE.md)
- [Deployment, migrations, recovery and pending decisions](docs/OPERATIONS.md)
- [Acceptance and QA record](docs/ACCEPTANCE.md)

Official organization copy, Myanmar translations, privacy policy, contacts, community photos and verified impact data are pending approval. The review banner remains on, optional claims are hidden, and enquiry collection stays closed until the privacy approval setting is published. Hosting is initially private. Public domain, staging, email notifications and scheduled backups require the client’s production configuration.
