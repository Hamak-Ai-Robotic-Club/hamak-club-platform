Tarek Daher 

## API

The Express API is started from this directory with `npm start`. It listens on
`PORT` (default `3000`) and reads `DATABASE_URL` from the environment or a local
`.env` file.

### Authentication and requests

Team accounts and administrators sign in through `POST /api/auth/login`. The
API creates opaque, HttpOnly session cookies and stores only SHA-256 token
hashes. Team accounts can have one active session; administrators may have
multiple sessions. Browsers must send requests with credentials enabled. A
team account can submit one pending request at a time; requests are associated
with the signed-in account's team, not a team name supplied by the client.

### Direct Node.js deployment

1. Use a Node.js release supported by the `engines` field in `package.json`.
2. Create a PostgreSQL database and copy `.env.example` to `.env`. Set
   `DATABASE_URL` to the database connection string and `FRONTEND_URL` to the
   exact frontend origin. Keep `.env` private and out of version control.
3. From this directory, install dependencies with `npm ci`, then run
   `npm run db:deploy` to apply migrations and generate the Prisma client.
4. Provision the first administrator and team accounts on the server by setting
   `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_ACCOUNT_TYPE` (`ADMIN` or `TEAM`)
   in the process environment and running `npm run auth:create-user`. For team
   accounts, also set `AUTH_TEAM_NAME`. Passwords must be at least 12
   characters. The command creates accounts; it does not reset existing ones.
5. Start the API with `npm start`, or configure the hosting provider's process
   manager to run that command. Set `PORT` to the port assigned by the host.
6. Ensure `uploads/components` is on persistent storage if uploaded images must
   survive server restarts or redeployments. The API creates this directory
   automatically when it starts.
7. Verify the deployment with `GET /api/health`; a healthy database connection
   returns `{"status":"ok"}`.

`FRONTEND_URL` allows browser requests only from that exact HTTP(S) origin and
is also checked on cookie-authenticated mutations to prevent cross-site request
forgery. No session signing secret is needed because the API creates random
session tokens and persists their hashes. For a cross-site frontend, set
`SESSION_COOKIE_SAME_SITE=none` and serve the API over HTTPS; the browser client
must use `credentials: "include"`.

The login attempt limiter is process-local; use a shared rate-limit store if
the API is deployed with multiple instances.

- `GET /api/health` checks the database connection.
- `GET /api/config` returns the configured event end time, if any.
- `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me`
  create, revoke, and inspect a session.
- `GET /api/components` lists active catalog items, including zero-stock items
  and their current working, broken, available, and on-loan quantities.
- `POST /api/requests`, `GET /api/requests`, `GET /api/requests/:id`, and
  `POST /api/requests/:id/cancel` are available to team accounts; each team
  sees only its own requests. `PATCH /api/requests/:id` returns a conflict
  because submitted requests are immutable.
- `GET /api/requests` also returns all submitted requests for administrators.
- `POST /api/admin/requests/:id/approve` checks and reserves available stock
  atomically; `POST /api/admin/requests/:id/reject` rejects a pending request.
- `POST /api/components`, `PATCH /api/components/:id`, and
  `DELETE /api/components/:id` create, update, and deactivate components.
- `POST /api/components/:id/image` uploads the component image using the
  multipart field `image`. WEBP files are limited to 5 MB.
- `POST /api/requests/:requestId/deliveries` records one or more partial delivery
  items.
- `POST /api/deliveries/:deliveryItemId/returns` records a partial return.

Administrative routes accept the HttpOnly session cookie or the existing
`Authorization: Bearer <session-token>` header. The API hashes the opaque token
with SHA-256 and checks it against a non-revoked, non-expired `sessions` row
belonging to an active user whose `account_type` is `ADMIN`.
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
- Added authenticated team request APIs and direct Node.js deployment
  instructions.
- Added PostgreSQL-backed login/logout, team-to-account relationships,
  team-scoped request APIs, cancellation, administration, and atomic stock
  reservation on approval.
- Added the countable Arduino and ESP32 kit inventory from the supplied Excel
  workbooks through a SQL migration. Arduino counts use the actual-total column;
  ESP32 counts sum the kit columns, treating marked-missing entries as zero.
  The workbooks do not report broken quantities, so imported counts start in
  working stock. Non-numeric group entries and the two end-of-course projects
  are not imported as individual components.
- Validated the Prisma schema and client generation; all database and API tests pass.
- Production deployment against a live PostgreSQL service remains to be
  verified. A hackathon reset operation is not implemented.