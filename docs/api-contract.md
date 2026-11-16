# API Contract — HMK Hackathon Logistics

All routes are under `/api`. Authentication uses an HttpOnly `sid` cookie set by
`POST /api/auth/login` (a `Authorization: Bearer <token>` header is also accepted).
Mutating cookie requests must come from the site origin (or `FRONTEND_URL`).

Errors: `{ "error": "message" }` with 400/422 invalid input, 401 no session,
403 forbidden, 404 not found, 409 state/stock conflict, 429 rate limit, 5xx server.

## Public / session
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | public | DB connectivity check |
| GET | `/config` | public | `{ eventEndsAt }` for the countdown |
| POST | `/auth/login` | public | `{ username, password }` → session cookie + `{ user }` |
| POST | `/auth/logout` | signed in | Revoke current session |
| GET | `/auth/me` | signed in | `{ user: { id, username, role, teamId, teamName } }` |
| GET | `/components` | public | Active catalogue with `availableQuantity`, `reservedQuantity`, `onLoanQuantity`, `imageUrl`, `nameEn` |

## Team
| Method | Path | Purpose |
|---|---|---|
| GET | `/requests` | Team's requests (items with requested/approved/delivered/returned/outstanding, `returnStatus`) |
| POST | `/requests` | `{ projectName, projectDescription, items:[{componentId, quantity}] }` (one pending per team) |
| GET | `/requests/:id` | Own request details |
| POST | `/requests/:id/cancel` | Cancel while Pending |
| GET | `/team/custody` | Aggregated custody `{ items, lines, totals, custodyClosed }` |
| GET | `/chat/status` | `{ aiEnabled }` |
| POST | `/chat/messages` | `{ messages:[{role, content}] }` → `{ reply, recommendations, mode }` (read-only) |
| GET | `/chat/inventory-search?q=` | Read-only inventory search |

## Admin
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/dashboard` (`/admin/reports/dashboard`) | Totals, requests by status, custody, pending count |
| GET | `/admin/components` | All components incl. disabled, with reserved/available/on-loan |
| POST | `/components` | Create `{ name, category, description, workingQuantity, brokenQuantity, imageReference? }` |
| PATCH | `/components/:id` | Update fields/quantities/status/`imageReference` (logs movements + audit) |
| POST | `/components/:id/image` | Multipart `image` (WEBP ≤ 4 MB) → Supabase Storage |
| DELETE | `/components/:id` | Hard delete if no history, otherwise disable |
| GET | `/requests?archived=1` | All requests (archived teams optional) |
| POST | `/admin/requests/:id/approve` | Approve whole request + reserve stock |
| POST | `/admin/requests/:id/reject` | `{ note? }` reject whole request |
| POST | `/requests/:id/deliveries` | `{ items:[{ requestItemId, deliveredQuantity }] }` partial/full delivery |
| POST | `/deliveries/:deliveryItemId/returns` | `{ workingQuantity, brokenQuantity }` |
| GET | `/admin/deliveries/outstanding` | Open custody lines per team |
| GET | `/admin/reports/inventory` · `/custody` · `/movements` | Reports |
| GET | `/admin/audit-logs?limit&offset` | Audit log |
| GET/POST | `/admin/users` | List / create `{ username, password, accountType: TEAM|ADMIN, teamName }` |
| PATCH | `/admin/users/:id/status` | `{ isActive }` freeze/unfreeze (revokes sessions) |
| POST | `/admin/users/:id/reset-password` | `{ password }` (revokes sessions) |
| POST | `/admin/users/:id/sessions/revoke` | End all sessions |
| GET | `/admin/reset-hackathon-data/check` | Reset pre-conditions |
| POST | `/admin/reset-hackathon-data` | `{ confirmation: "DELETE DATA", password }` |
| GET | `/admin/hackathon-summaries` | Saved post-reset summaries |
