# Database package

This package owns the PostgreSQL Prisma schema, SQL migrations, synthetic development seed, and inventory reports.

## Setup

1. Install dependencies from this directory with `npm install`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to a development PostgreSQL database. Do not commit `.env`.
3. Validate and generate the client with `npm run db:validate` and `npm run db:generate`.
4. Apply additive migrations with `npm run db:migrate:deploy`.
5. Add synthetic sample records with `npm run db:seed`.
6. Run database migration-integration and report/unit tests with `npm test`.

Prisma 7.10.1 requires Node.js 20.19+, 22.12+, or 24.x. The package checks this before Prisma commands and refuses unsupported runtimes; it does not change system settings or install a global Node version. Use a project runtime manager to select a supported version. If only Node 26 is available, a temporary project-scoped runtime can invoke Prisma without changing the system installation:

```powershell
npm exec --yes --package=node@24 -- node node_modules\prisma\build\index.js validate
```

Prisma 7 uses a PostgreSQL driver adapter; the seed initializes it from `DATABASE_URL`. The seed creates synthetic records only, skips the demo graph if its identifying component already exists, and never deletes or updates records. The migration/deploy command does not reset the database. Test migrations run against embedded PGlite and do not require a live database; they are not a substitute for deployment tests against the target PostgreSQL service.

Schema details that depend on pending coach decisions are intentionally left unconstrained; see `../docs/Database-Implementation.md`.
## Database Implementation Summary

- Built a PostgreSQL database layer with Prisma, SQL migrations, and a synthetic development seed.
- Added models for users, sessions, teams, requests and request items, delivery batches and items, returns and return items, inventory movements, audit logs, and hackathon summaries.
- Added foreign-key and quantity constraints, a partial unique index limiting each team to one pending request, and transaction-safe delivery and return checks.
- Used database triggers to record inventory movements and update component balances within the same transaction.
- Added request and inventory services, append-only auditing, hackathon summary snapshots, and reports for inventory balances, movements, request statuses, and outstanding custody.
- Added related synthetic seed data that skips an existing demo dataset and does not delete or update records.
- Validated the Prisma schema and client generation; all 16 local PGlite tests passed.
- Production deployment against a live PostgreSQL service remains to be verified. Inventory reservation during request approval and a hackathon reset operation are not implemented.