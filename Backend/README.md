Tarek Daher 

## API

The Express API is started from this directory with `npm start`. It listens on
`PORT` (default `3000`) and reads `DATABASE_URL` from the environment or a local
`.env` file.

### Public request API

The API accepts guest requests through `POST /api/requests`. Requests include a
team, project name, and requested components; they are created as `PENDING` and
limited to 8 submissions per IP per 15-minute window in a single API process.
Protect this public route with a persistent distributed rate limiter and
moderation before using it for a large public event. This project serves API
endpoints only; a separate client can consume them.

### Direct Node.js deployment

1. Use a Node.js release supported by the `engines` field in `package.json`.
2. Create a PostgreSQL database and copy `.env.example` to `.env`. Set
   `DATABASE_URL` to the database connection string and `FRONTEND_URL` to the
   exact frontend origin. Keep `.env` private and out of version control.
3. From this directory, install dependencies with `npm ci`, then run
   `npm run db:deploy` to apply migrations and generate the Prisma client.
4. Start the API with `npm start`, or configure the hosting provider's process
   manager to run that command. Set `PORT` to the port assigned by the host.
5. Ensure `uploads/components` is on persistent storage if uploaded images must
   survive server restarts or redeployments. The API creates this directory
   automatically when it starts.
6. Verify the deployment with `GET /api/health`; a healthy database connection
   returns `{"status":"ok"}`.

`FRONTEND_URL` allows browser requests only from that exact HTTP(S) origin. No
session secret is currently used: the trusted authentication service must issue
opaque bearer tokens and manage their hashed session records in PostgreSQL.

- `GET /api/health` checks the database connection.
- `GET /api/config` returns the configured event end time, if any.
- `GET /api/components` lists active catalog items, including zero-stock items
  and their current working, broken, available, and on-loan quantities.
- `POST /api/requests` accepts a guest team's project and requested components.
- `POST /api/components`, `PATCH /api/components/:id`, and
  `DELETE /api/components/:id` create, update, and deactivate components.
- `POST /api/components/:id/image` uploads the component image using the
  multipart field `image`. WEBP files are limited to 5 MB.
- `POST /api/requests/:requestId/deliveries` records one or more partial delivery
  items.
- `POST /api/deliveries/:deliveryItemId/returns` records a partial return.

Administrative routes require `Authorization: Bearer <session-token>`. The API
hashes the opaque token with SHA-256 and checks it against a non-revoked,
non-expired `sessions` row belonging to an active user whose `account_type` is
`ADMIN` (case-insensitive). Session issuance/login is not part of this API; an
existing trusted authentication flow must create and manage these sessions.
Uploaded images are served under `/uploads/components/`.

Inventory changes are recorded as append-only inventory movements. Database
triggers apply delivery and return movements to component balances, so the API
does not separately update stock for those operations.

The API source and route modules are in `src/app.js` and `src/routes/`.

## Database Implementation Summary

- Built a PostgreSQL database layer with Prisma, SQL migrations, and a synthetic development seed.
- Added models for users, sessions, teams, requests and request items, delivery batches and items, returns and return items, inventory movements, audit logs, and hackathon summaries.
- Added foreign-key and quantity constraints, a partial unique index limiting each team to one pending request, and transaction-safe delivery and return checks.
- Used database triggers to record inventory movements and update component balances within the same transaction.
- Added request and inventory services, append-only auditing, hackathon summary snapshots, and reports for inventory balances, movements, request statuses, and outstanding custody.
- Added related synthetic seed data that skips an existing demo dataset and does not delete or update records.
- Added a guest request API and direct Node.js deployment instructions.
- Added the countable Arduino and ESP32 kit inventory from the supplied Excel
  workbooks through a SQL migration. Arduino counts use the actual-total column;
  ESP32 counts sum the kit columns, treating marked-missing entries as zero.
  The workbooks do not report broken quantities, so imported counts start in
  working stock. Non-numeric group entries and the two end-of-course projects
  are not imported as individual components.
- Validated the Prisma schema and client generation; all database and API tests pass.
- Production deployment against a live PostgreSQL service remains to be verified. Inventory reservation during request approval and a hackathon reset operation are not implemented.