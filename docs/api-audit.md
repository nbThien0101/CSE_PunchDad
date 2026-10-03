# Backend API audit and normalization

Audit baseline: `4921aab2d030494e30516031d99246c6cebcc3b9` (2026-10-03). This analysis was written before application code changes. Sources: `server/src/app.js`, all five route modules, all seven controllers, all middleware, `payos.service.js`, Prisma schema, every fetch and API-wrapper consumer in `client/`. No database or external payment operation was executed.

## A. Problems found

1. Partial session, vote, guest, profile, tier and goalkeeper updates use PUT. Team configuration, avatar and QR replacement genuinely replace a subresource, so PUT remains appropriate.
2. Session-owned vote/payment lists use inverted `/votes/session/:sessionId` and `/payments/session/:sessionId` paths.
3. Generic `:id` obscures session, vote, payment and QR-owner identifiers. Renaming placeholders is documentation-only for callers, but requires controller updates.
4. Current-user endpoints (`/users/profile`, `/users/avatar`, `/users/qr-code`, `/users/change-password`) lack a consistent `/users/me` scope. `/users/members` duplicates the users collection concept.
5. DELETE session actually cancels and retains the record; `/force` really deletes it and cascades related records. Keep hard deletion explicitly separate; introduce POST cancel rather than change the meaning of DELETE for existing callers.
6. Payment mark-paid and confirm are commands with timestamps; confirm may complete a session. POST is more accurate than replacement PUT. Keep named domain actions and separate authorization rules.
7. Success payloads are named objects (`sessions`, `session`, `vote`, `members`, etc.); errors use string `error`, validator array `errors`, and extra context. Only the webhook uses `success`. Client consumers explicitly depend on these shapes and call `res.json()` after deletes. Team suggestions also has an existing branch-dependent shape: `[2]` below 10 players, otherwise `{recommended,available}`; document the union instead of silently changing it.
8. Statuses are mostly coherent: registration/session/guest creation return 201, other successful operations return 200. Vote cast and attendance are upserts, so retaining 200 is intentional. Domain state errors commonly use 400 rather than 409. Deletes retain message/session bodies, so do not switch them to 204 in this migration.
9. GET PayOS status can reconcile provider state into the DB and complete a session. It has JWT but no owner check; other authenticated members can poll any payment. GET attendance is authenticated-user accessible despite an Admin comment. Team suggestions and session vote lists do not check parent existence (unknown session returns empty data). These are existing behaviors, not silently tightened here.
10. Webhook verifies via `payos.webhooks.verify` before DB writes. It intentionally acknowledges internal processing failures with HTTP 200 `{success:false,error}` and unknown orders with HTTP 200. It inherits global throttling. Amount reconciliation, payment-state regression in mark-paid, webhook retry behavior, OTP atomicity and refresh lifecycle merit a separate security/payment review; route normalization must not change them.
11. Validation is uneven: no universal UUID/path validation, most PATCH-like handlers validate only selected fields, and some invalid types reach Prisma or string operations. Express has no JSON catch-all 404 (unmatched endpoints fall back to Express HTML). Existing verification scripts cover admin vote adjustment and unpaid-vote behavior, but the `server` npm test command was a placeholder and did not run them.

Fix now: route/method consistency, meaningful parameter names, simultaneous client migration, explicit backward-compatible deprecation, contract tests. Keep now: response bodies/statuses, security middleware order, rate limits, domain actions, provider webhook URL, deletion separation. Migrate later: full response envelope and error codes, systematic input schemas, JSON route-not-found, explicit payment reconciliation command and independently reviewed security fixes.

Proposed later envelope: success `{success:true,data:{...existingNamedFields}}`; pagination, only when implemented, `{page,limit,total,totalPages}` beside data; failure `{success:false,error:{code,message,details?}}`. Do not advertise pagination now: no endpoint implements it. Migrate client error handling and payload access plus external consumers before enabling this envelope; preserve debt/lock/retry metadata. A future error catalog should distinguish resource missing, invalid input, duplicate and state conflict; no machine error codes exist today.

## B. Complete current inventory and proposed endpoint map

All paths below include `/api`. Each row is one of the **49 existing operations**; NEW includes the proposed method. `JWT` means an existing authenticated ADMIN or MEMBER account. Additional constraints are enforced inside controllers unless explicitly listed as Admin. Parameter-only changes are marked `PARAM` and have no wire-path impact. Changed wire paths/methods retain deprecated aliases.

| METHOD | CURRENT ENDPOINT | AUTH | ROLE / CONSTRAINT | PURPOSE | NEW | KEEP/CHANGE | REASON |
|---|---|---|---|---|---|---|---|
| GET | /api/health | Public | — | Health/time | GET /api/health | KEEP | Stable operational consumer |
| POST | /api/auth/register | Public | Email verification token | Register | POST /api/auth/register | KEEP | Recognizable auth action |
| POST | /api/auth/login | Public | Credentials | Login | POST /api/auth/login | KEEP | Auth action |
| POST | /api/auth/refresh | Public | Refresh token in body | Rotate token pair | POST /api/auth/refresh | KEEP | Token operation |
| GET | /api/auth/me | JWT | Any | Current account | GET /api/auth/me | KEEP | Existing authentication identity |
| POST | /api/auth/send-otp | Public | — | Registration OTP email | POST /api/auth/send-otp | KEEP | Clear existing workflow |
| POST | /api/auth/verify-otp | Public | Email + OTP | Registration proof | POST /api/auth/verify-otp | KEEP | Domain verification |
| POST | /api/auth/forgot-password/send-otp | Public | — | Recovery email | POST /api/auth/forgot-password/send-otp | KEEP | Existing recovery workflow |
| POST | /api/auth/forgot-password/verify-otp | Public | Email + OTP | Recovery proof | POST /api/auth/forgot-password/verify-otp | KEEP | Domain verification |
| POST | /api/auth/forgot-password/reset | Public | Reset token | Reset password | POST /api/auth/forgot-password/reset | KEEP | Token-authorized command |
| GET | /api/users/members | JWT | Any | Members collection | GET /api/users | CHANGE | Plural collection |
| PUT | /api/users/:userId/tier | JWT | Admin | Set tier | PATCH /api/users/:userId/tier | CHANGE | Partial account update |
| PUT | /api/users/:userId/goalkeeper | JWT | Admin | Set goalkeeper flag | PATCH /api/users/:userId/goalkeeper | CHANGE | Partial account update |
| PUT | /api/users/profile | JWT | Self | Edit own profile | PATCH /api/users/me | CHANGE | Consistent identity + partial update |
| PUT | /api/users/change-password | JWT | Self + current password | Change password | PUT /api/users/me/password | CHANGE | Replace password subresource |
| PUT | /api/users/avatar | JWT | Self | Replace avatar | PUT /api/users/me/avatar | CHANGE | Explicit current-user scope |
| DELETE | /api/users/avatar | JWT | Self | Remove avatar | DELETE /api/users/me/avatar | CHANGE | Same subresource |
| PUT | /api/users/qr-code | JWT | Self | Replace QR image | PUT /api/users/me/qr-code | CHANGE | Explicit current-user scope |
| GET | /api/users/:id/qr-code | JWT | Any | Read member QR | GET /api/users/:userId/qr-code | PARAM | Meaningful owner identifier |
| DELETE | /api/users/qr-code | JWT | Self | Remove QR image | DELETE /api/users/me/qr-code | CHANGE | Same subresource |
| DELETE | /api/users/:userId | JWT | Admin; not self/another admin | Delete member/related data | DELETE /api/users/:userId | KEEP | Resource deletion |
| GET | /api/sessions | JWT | Any | List sessions | GET /api/sessions | KEEP | Collection |
| GET | /api/sessions/:id | JWT | Any | Session details | GET /api/sessions/:sessionId | PARAM | Meaningful identifier |
| POST | /api/sessions | JWT | Admin | Create session | POST /api/sessions | KEEP | Resource creation |
| PUT | /api/sessions/:id | JWT | Admin | Edit/book session | PATCH /api/sessions/:sessionId | CHANGE | Partial update |
| DELETE | /api/sessions/:id | JWT | Admin | Cancel (not hard delete) | POST /api/sessions/:sessionId/cancel | CHANGE | Command accurately names cancellation |
| DELETE | /api/sessions/:id/force | JWT | Admin | Permanent cascade deletion | DELETE /api/sessions/:sessionId/force | PARAM | Preserve explicit destructive distinction |
| GET | /api/sessions/:id/teams/suggestions | JWT | Any | Team count suggestions | GET /api/sessions/:sessionId/teams/suggestions | PARAM | Meaningful parent |
| POST | /api/sessions/:id/teams/generate | JWT | Admin | Compute balanced teams | POST /api/sessions/:sessionId/teams/generate | PARAM | Keep domain command |
| PUT | /api/sessions/:id/teams | JWT | Admin | Replace saved team configuration | PUT /api/sessions/:sessionId/teams | PARAM | Whole subresource replacement |
| DELETE | /api/sessions/:id/teams | JWT | Admin | Clear saved teams | DELETE /api/sessions/:sessionId/teams | PARAM | Resource removal |
| GET | /api/sessions/:id/attendance | JWT | Any | Matchday dashboard | GET /api/sessions/:sessionId/attendance | PARAM | Actual access, not Admin comment |
| POST | /api/sessions/:id/lock-vote | JWT | Admin | Set/toggle voting lock | POST /api/sessions/:sessionId/lock-vote | PARAM | Preserve toggle command |
| POST | /api/sessions/:id/attendance | JWT | Admin | Upsert member check-in/vote | POST /api/sessions/:sessionId/attendance | PARAM | May create JOIN vote |
| POST | /api/sessions/:id/attendance/bulk | JWT | Admin | Update all JOIN check-ins | PATCH /api/sessions/:sessionId/attendance | CHANGE | Partial collection update; JOIN scope retained |
| POST | /api/sessions/:id/guests | JWT | Admin | Add guest | POST /api/sessions/:sessionId/guests | PARAM | Resource creation |
| PUT | /api/sessions/:id/guests/:guestId | JWT | Admin | Edit guest/check-in/payment flag | PATCH /api/sessions/:sessionId/guests/:guestId | CHANGE | Partial guest update |
| DELETE | /api/sessions/:id/guests/:guestId | JWT | Admin | Remove guest | DELETE /api/sessions/:sessionId/guests/:guestId | PARAM | Existing parent membership check |
| POST | /api/sessions/:id/recalculate-payments | JWT | Admin | Recompute attended-member debts | POST /api/sessions/:sessionId/recalculate-payments | PARAM | Keep domain command |
| POST | /api/votes | JWT | Self | Upsert own vote | POST /api/votes | KEEP | Existing sessionId body is unambiguous |
| POST | /api/votes/admin/adjust | JWT | Admin | Add/edit/delete another vote | POST /api/votes/admin/adjust | KEEP | Multi-mode privileged domain command |
| PUT | /api/votes/:id | JWT | Vote owner | Update vote | PATCH /api/votes/:voteId | CHANGE | Partial vote update |
| GET | /api/votes/session/:sessionId | JWT | Any | Session votes/summary | GET /api/sessions/:sessionId/votes | CHANGE | Natural parent-child collection |
| GET | /api/payments/session/:sessionId | JWT | Any | Session payments/summary | GET /api/sessions/:sessionId/payments | CHANGE | Natural parent-child collection |
| PUT | /api/payments/:id/mark-paid | JWT | Payment owner only | Claim manual transfer | POST /api/payments/:paymentId/mark-paid | CHANGE | Timestamped domain command |
| PUT | /api/payments/:id/confirm | JWT | Session payer or Admin | Confirm receipt/complete session | POST /api/payments/:paymentId/confirm | CHANGE | Multi-resource domain command |
| POST | /api/payments/:id/payos-link | JWT | Payment owner or Admin | Create/reuse provider link | POST /api/payments/:paymentId/payos-link | PARAM | Keep provider operation |
| GET | /api/payments/:id/payos-status | JWT | Any (existing behavior) | Poll/reconcile provider status | GET /api/payments/:paymentId/payos-status | PARAM | Preserve polling consumer; side effects documented |
| POST | /api/payments/payos-webhook | Public/signature | PayOS external service | Receive verified notification | POST /api/payments/payos-webhook | KEEP | Do not alter configured provider URL/security |

Do not consolidate admin tier/goalkeeper into a new generic PATCH user in this task: their existing response projections/messages differ, while the self-profile endpoint has a different field allowlist. Combining these now adds authorization and response migration work without a material documentation benefit. Separate field-scoped PATCH operations remain explicit; reconsider consolidation alongside a unified user response contract.

## C. Breaking changes and consumer migration

Every wire change is additive on the server. Old paths/methods invoke the same handlers without redirecting bodies or tokens, and respond with `X-API-Deprecated: true` and `Link: <canonical-path>; rel="alternate"`. No sunset date is promised. Parameter-only changes require no aliases. New canonical routes have identical authentication, admin checks, validation and throttling. Do not remove aliases until deployed web clients and any untracked consumers have migrated; repository search cannot prove external/mobile usage is absent.

All application fetches are centralized in `client/src/services/api.js`; update that file while keeping its public wrapper functions unchanged. `client/api/keepalive.js` calls only `/api/health` (unchanged). Repository consumer locations:

| Changed operation | API wrapper | All UI consumers |
|---|---|---|
| Member list | usersAPI.getMembers | pages/Members.jsx; components/Vote/AdminAdjustVoteModal.jsx |
| Tier | usersAPI.updateTier | pages/Members.jsx |
| Goalkeeper | usersAPI.updateGoalkeeper | pages/Members.jsx; components/Attendance/AttendanceDashboardModal.jsx |
| Profile/password/avatar/own QR mutations | usersAPI.updateProfile/changePassword/uploadAvatar/deleteAvatar/uploadQRCode/deleteQRCode | pages/Profile.jsx |
| Session PATCH | sessionsAPI.update | pages/SessionDetail.jsx (booking and editing) |
| Session cancel | sessionsAPI.delete (name retained for UI compatibility) | pages/SessionDetail.jsx |
| Guest PATCH | attendanceAPI.updateGuest | pages/SessionDetail.jsx; components/Attendance/AttendanceDashboardModal.jsx |
| Bulk attendance PATCH | attendanceAPI.bulkCheckIn | components/Attendance/AttendanceDashboardModal.jsx |
| Payment list/mark/confirm | paymentsAPI.getBySession/markAsPaid/confirm | pages/SessionDetail.jsx |
| Vote PATCH/list | votesAPI.update/getBySession | No current UI invocation found; wrappers still migrated |

Consumer paths in this table are relative to `client/src/`. Other unchanged calls appear in Dashboard, CreateSession, Register, ForgotPassword, AuthContext, TeamGeneratorModal, PayOSModal and SessionDetail. No raw API fetch bypasses the wrapper except keepalive. Imports of a wrapper object alone are not evidence of a call.

Bodies and status codes remain unchanged, including JSON DELETE responses, mandatory profile displayName and vote status, and bulk attendance's JOIN-only scope. Browser CORS currently does not expose the new deprecation headers to JavaScript; they are visible to HTTP/native consumers and network inspection. No CORS policy change is required for functionality.

## D. Recommended final API structure

Canonical operations are precisely those in NEW above. Tags: Auth (`/auth/*`); Users (`/users`, `/users/me*`, admin field PATCH and user QR/delete); Sessions (list/detail/create/PATCH/cancel/force); Votes (`/votes`, vote PATCH, admin adjust, session vote list); Attendance (session attendance GET/POST/PATCH, lock-vote); Teams (session teams suggestions/generate/PUT/DELETE); Guests (session guest POST/PATCH/DELETE); Payments (session payment list, mark-paid, confirm, session recalculation); PayOS (payment link/status and unchanged webhook); Health (health). Guests/teams are read through session detail and attendance; do not invent redundant GET endpoints.

Keep `/api` without automatically introducing `/api/v1`. No deployed mobile consumer is established from this repository, additive aliases make the normalization compatible, and a version prefix would migrate every endpoint and provider URL without fixing a contract issue. Establish a versioned contract before a published mobile SDK or deliberate incompatible envelope/auth change; inventory external consumers first, support both prefixes during that migration and coordinate webhook configuration explicitly.

## E. Implementation plan

1. Routes: change `session.routes.js`, `vote.routes.js`, `payment.routes.js`, `user.routes.js`; nest session vote/payment list handlers on the existing authenticated session router. Auth routes and `app.js` stay unchanged.
2. Small shared deprecation middleware in `server/src/middleware/deprecation.middleware.js` marks only legacy wire operations; no redirects, new dependencies or new router framework.
3. Controllers: replace generic parameter bindings and route comments in session/attendance/vote/payment/user controllers only. Keep local `id` aliases to minimize business-code diff. No services, schema, permission logic, token logic or payment calculations change.
4. Client: update only URLs/methods inside `client/src/services/api.js`, preserving bodies and wrapper names.
5. Node built-in tests exercise canonical and legacy routing, parameter delivery, frontend request contracts, JWT/Admin/owner/payer gates, webhook verification failure and rate-limit placement without live DB/email/payment traffic. Replace placeholder server test script. Run syntax checks, tests and client production build; inspect diff before acceptance.
6. Record scope and verification in `.agents/state/HANDOFF.md` for independent review of auth/payment-sensitive route wiring. No deployment, push or provider reconfiguration is part of this task.
7. Correct README's stale API summaries after source audit, linking this complete inventory rather than treating old README endpoints as authoritative.

## OPENAPI READINESS

The tables below describe handler code, including its exceptional branches. They are a documentation contract inventory, not proof that production database/provider behavior has been exercised. No Swagger dependency or annotations were added.

### Shared schema and security notes

`JWT` is HTTP bearer access-token security; `Admin` additionally requires `req.user.role === 'ADMIN'`. `Owner` checks payment/vote ownership; `Payer/Admin` checks session.payerId or ADMIN. Auth recovery/registration tokens are request-body proofs, not access-token security. Webhook has an empty JWT security requirement and a verified provider signature in the JSON body. Do not mark it bearer-protected. Role enum: ADMIN/MEMBER.

Path parameters are required string IDs, generated as UUIDs by Prisma. Do not claim server-side UUID validation; none exists. `sessionId`, `userId`, `voteId`, `paymentId`, `guestId` occur exactly where the canonical path shows them. Only GET sessions consumes a query parameter (`status`, uppercased before filtering); all other operations have **no consumed query parameters**. There is no pagination. PayOS return/cancel URL query `payment_status` is a frontend navigation parameter, not a backend API query.

All errors below are in addition to applicable middleware errors: JWT routes 401; Admin routes 403; all API operations except health can return global 429, and all operations inherit slowdown except health. Auth limits: register/login/verify-otp/recovery verify/reset 15 per 15 min; OTP send operations 5 per 15 min, plus controller email cooldown; team generation 20 per minute. Infrastructure/unhandled controller errors can return 500. Prisma P2002 maps to 409 `{error,field}` and P2025 maps to 404 `{error}` through the existing error handler. Validation arrays use `{errors:[...]}`, other errors generally `{error:string}` plus endpoint-specific metadata. Malformed/oversized bodies and unknown paths need a separate transport-error schema audit; do not label all errors as the proposed future envelope.

Response object definitions must preserve endpoint-specific `select`/`include` projections rather than blindly exporting complete Prisma models:

- Auth user: id, username, email, displayName, phone, bankInfo, role, tier, isGoalkeeper, avatar; registration additionally createdAt. Never passwordHash. Tokens: accessToken and refreshToken strings.
- Member list: id, username, displayName, role, tier, isGoalkeeper, phone, avatar, createdAt, `_count.votes` (JOIN count).
- Session scalar fields: id, title, playDate, startTime, endTime, location, googleMapsUrl, minPlayers, maxPlayers, totalCost, splitCount, status, cancellationNote, teams, voteDeadline, isVoteLocked, voteLockedAt, createdById, payerId, selectedTimeSlotId, createdAt, updatedAt. Status enum VOTING/CONFIRMED/BOOKED/COMPLETED/CANCELLED. Relations vary per operation. Nullable fields follow Prisma schema.
- Session list relations: createdBy, payer, votes with user, timeSlots with JOIN counts, `_count.votes`. Detail additionally includes vote timeSlotVotes, timeSlots with JOIN voters, guests, absenceLogs with user, payments with user, and `unpaidPreviousPayment` (null or hasUnpaid/count/totalDebt/latestPaymentId/sessionId/sessionTitle/playDate/amount/errorMessage). Update includes createdBy/payer/timeSlots with counts; creation includes createdBy/timeSlots. Team save/delete include createdBy/payer/votes with user.
- Vote scalars: id, status, votedAt, isCheckedIn, checkedInAt, checkInNote, sessionId, userId; user/timeSlotVotes included in self voting/list. Vote enum JOIN/DECLINE/MAYBE, but self voting accepts only JOIN/DECLINE. Admin adjustment additionally accepts NONE/DELETE as deletion commands. Returned `absenceLog` is nullable, and some branches omit it.
- Payment scalars: id, amount, status, orderCode, checkoutUrl, paymentLinkId, paidAt, confirmedAt, sessionId, userId. Enum PENDING/PAID/CONFIRMED. `amount`/`totalCost` Prisma Decimal values serialize as JSON strings in actual Prisma responses; computed arithmetic summaries are numbers. `orderCode` serializes as number via app.js BigInt hook; provider codes are intended within safe-integer range. Test doubles are not authoritative Decimal serialization examples.
- Guest scalars: id, sessionId, name, phone, tier, isGoalkeeper, status, isCheckedIn, checkedInAt, note, isPaid, addedAt. RESERVE/PLAYING are intended states, but the database/controller does not enforce a status enum. Do not falsely advertise exhaustive enforced validation.
- Team configuration is currently unrestricted JSON (`teams`). Generation `result`: generatedAt, teamCount, totalVoters, activePlayersCount, reservesCount, teams, reserves, variance. Each generated team has id, name, color, bg, goalkeeper, players, totalTierScore, averageTierScore. Player fields: userId, displayName, avatar, tier, tierScore, isGoalkeeper, votedAt, voteOrder; field-player entries may additionally carry role/isGoalkeeperOriginal. Goalkeepers carry role GK, isShared?, sharedFrom?; rotating placeholders have isPlaceholder true and may omit votedAt/voteOrder. Reserves have userId, displayName, avatar, tier, isGoalkeeper, votedAt, reserveOrder. Suggestions is `[2]` when total players is below 10, otherwise `{recommended,available:number[]}`. Profile, tier and goalkeeper projections differ; see their individual operations.

### Endpoint readiness matrix

In this matrix every path is relative to `/api`. The path itself specifies all required path parameters. `—` body means the handler consumes no request body. Query is `—` everywhere except GET sessions (`status`). Summaries are ready to use as OpenAPI operation summaries. JSON property notation lists accepted fields; `?` means optional in controller behavior, not a blanket guarantee of input validation.

| Tag | Canonical operation / summary | Authentication | Query | Request body | Success status and response | Controller-specific common errors |
|---|---|---|---|---|---|---|
| Health | GET /health — Check service health | Public | — | — | 200 `{status:'ok',timestamp}` | Transport failures |
| Auth | POST /auth/register — Register verified account | Public + verificationToken | — | username (3–30 alphanumeric), password (min 6), displayName (2–50), email, verificationToken; phone? (Vietnam number) | 201 `{message,user,accessToken,refreshToken}` | 400 validation/missing or expired verification; 409 duplicate |
| Auth | POST /auth/login — Login with username or email | Public + credentials | — | username, password (nonempty) | 200 `{message,user,accessToken,refreshToken}` | 400 validator errors; 401 invalid credentials |
| Auth | POST /auth/refresh — Refresh token pair | Public + refreshToken | — | refreshToken | 200 `{accessToken,refreshToken}` | 400 missing token; 401 invalid token |
| Auth | GET /auth/me — Read current account | JWT | — | — | 200 `{user}` from auth middleware projection | 401 missing/expired/invalid token or deleted user |
| Auth | POST /auth/send-otp — Send registration OTP | Public | — | email; phone?, username? | 200 `{message,email}` normalized email | 400 missing/invalid email/phone; 409 duplicate username/email; 429 email cooldown `{error,retryAfter}`; 500 email failure |
| Auth | POST /auth/verify-otp — Verify registration OTP | Public + email/OTP | — | email, otp | 200 `{message,verificationToken,email}` | 400 missing/expired/used OTP |
| Auth | POST /auth/forgot-password/send-otp — Send recovery OTP | Public | — | emailOrUsername | 200 `{message,email,maskedEmail}` | 400 missing input; 404 account not found; 429 cooldown; 500 email failure |
| Auth | POST /auth/forgot-password/verify-otp — Verify recovery OTP | Public + email/OTP | — | email, otp | 200 `{message,resetToken,email}` | 400 missing/invalid/expired OTP |
| Auth | POST /auth/forgot-password/reset — Reset forgotten password | Public + resetToken | — | email, resetToken, newPassword (min 6) | 200 `{message}` | 400 missing/expired token/short password; 404 user |
| Users | GET /users — List club members | JWT | — | — | 200 `{members:[Member]}` | Shared errors |
| Users | PATCH /users/:userId/tier — Set member tier | JWT + Admin | — | tier? (trimmed string or null; missing clears tier) | 200 `{message,user:{id,username,displayName,role,tier}}` | 404 user; invalid type can reach 500 |
| Users | PATCH /users/:userId/goalkeeper — Set goalkeeper flag | JWT + Admin | — | isGoalkeeper? (Boolean coercion; missing becomes false) | 200 `{message,user:{id,username,displayName,role,tier,isGoalkeeper}}` | 404 user |
| Users | PATCH /users/me — Edit own profile | JWT + Self | — | displayName (required, nonblank, max 50); phone?, bankInfo?, isGoalkeeper? | 200 `{message,user}` auth user projection | 400 invalid displayName/phone |
| Users | PUT /users/me/password — Replace own password | JWT + Self/current password | — | currentPassword, newPassword (min 6, different) | 200 `{message}` | 400 missing/wrong current or invalid new password; 404 user |
| Users | PUT /users/me/avatar — Replace own avatar | JWT + Self | — | avatar: data:image/(png/jpeg/webp/jpg);base64,..., decoded max 2 MiB | 200 `{message,avatar}` | 400 missing/format/size; global JSON body max 3 MB |
| Users | DELETE /users/me/avatar — Remove own avatar | JWT + Self | — | — | 200 `{message}` | Shared errors |
| Users | PUT /users/me/qr-code — Replace own bank QR | JWT + Self | — | qrCodeImage: accepted Base64 image prefixes, decoded max 2 MiB | 200 `{message}` | 400 missing/format/size; global body limit |
| Users | GET /users/:userId/qr-code — Read member QR | JWT (any member) | — | — | 200 `{userId,displayName,qrCodeImage}` nullable image | 404 user |
| Users | DELETE /users/me/qr-code — Remove own QR | JWT + Self | — | — | 200 `{message}` | Shared errors |
| Users | DELETE /users/:userId — Delete member | JWT + Admin | — | — | 200 `{message}`; deletes payments/votes/account and unsets payer | 400 self deletion; 403 other admin; 404 user; relational failure may return 500 |
| Sessions | GET /sessions — List sessions | JWT | status? (SessionStatus, controller uppercases) | — | 200 `{sessions:[SessionList]}` | Invalid enum currently reaches Prisma/500 |
| Sessions | GET /sessions/:sessionId — Read session detail | JWT | — | — | 200 `{session:SessionDetail}` including current user's debt context | 404 session |
| Sessions | POST /sessions — Create voting session | JWT + Admin | — | title (3–100), playDate (ISO), startTime/endTime (HH:mm), location, minPlayers/maxPlayers (2–30); googleMapsUrl?, voteDeadline?, timeSlots? [{startTime,endTime}] (1–20 unique valid increasing slots) | 201 `{message,session}` | 400 validation/invalid maps URL/time slots |
| Sessions | PATCH /sessions/:sessionId — Edit or book session | JWT + Admin | — | Optional allowlisted title, playDate, startTime, endTime, location, googleMapsUrl, minPlayers, maxPlayers, totalCost, payerId, status, voteDeadline, splitCount, cancellationNote, timeSlots; selectedTimeSlotId? used for BOOKED | 200 `{message,session}`; BOOKED + totalCost can create debts | 400 cancellation note/maps/time slots/slot not in session/slot change after booking; 404 session |
| Sessions | POST /sessions/:sessionId/cancel — Cancel session | JWT + Admin | — | cancellationNote (trimmed required, max 500) | 200 `{message,session}` with CANCELLED | 400 missing/long note; 404 missing record via Prisma |
| Sessions | DELETE /sessions/:sessionId/force — Permanently delete session | JWT + Admin | — | — | 200 `{message}`; cascades related records | 404 session |
| Teams | GET /sessions/:sessionId/teams/suggestions — Suggest team counts | JWT | — | — | 200 `{totalJoin,memberCount,guestCount,suggestions}` | Missing session returns empty-derived suggestions, not 404 |
| Teams | POST /sessions/:sessionId/teams/generate — Generate balanced teams | JWT + Admin | — | teamCount?, goalkeeperOverrides?, useAttendedOnly? | 200 `{result}` (team algorithm contract below) | 404 session; algorithm failure currently 500 |
| Teams | PUT /sessions/:sessionId/teams — Replace saved team configuration | JWT + Admin | — | teams: JSON (no dedicated schema validation) | 200 `{message,session}` | 404 session |
| Teams | DELETE /sessions/:sessionId/teams — Clear saved teams | JWT + Admin | — | — | 200 `{message,session}` with teams null | 404 session |
| Attendance | GET /sessions/:sessionId/attendance — Read matchday dashboard | JWT (any member) | — | — | 200 `{session,joined,maybe,declined,guests,absenceLogs,warnings:{lateCancellations,noShows},summary}` | 404 session |
| Attendance | POST /sessions/:sessionId/lock-vote — Set or toggle vote lock | JWT + Admin | — | isLocked?; omitted toggles current state | 200 `{message,isVoteLocked,voteLockedAt,session}` | 404 session |
| Attendance | POST /sessions/:sessionId/attendance — Upsert member check-in | JWT + Admin | — | userId; isCheckedIn?, checkInNote?; flag Boolean-coerced | 200 `{message,vote}` with user; can create JOIN vote if absent | 400 missing userId; no explicit parent/user existence checks before Prisma |
| Attendance | PATCH /sessions/:sessionId/attendance — Set check-in for all JOIN votes | JWT + Admin | — | isCheckedIn? (Boolean coercion, missing false) | 200 `{message,count}` | Missing session returns count 0 |
| Guests | POST /sessions/:sessionId/guests — Add guest | JWT + Admin | — | name (nonblank); phone?, tier?, isGoalkeeper?, note?, status?, isCheckedIn? | 201 `{message,guest}`; defaults tier C, status RESERVE | 400 missing name; 404 session |
| Guests | PATCH /sessions/:sessionId/guests/:guestId — Edit guest | JWT + Admin | — | Optional name, phone, tier, isGoalkeeper, status, isCheckedIn, note, isPaid | 200 `{message,guest}` | 404 guest missing or belongs to another session |
| Guests | DELETE /sessions/:sessionId/guests/:guestId — Remove guest | JWT + Admin | — | — | 200 `{message}` | 404 guest missing/wrong session |
| Payments | POST /sessions/:sessionId/recalculate-payments — Recompute attended debts | JWT + Admin | — | — | 200 `{message,amountPerPerson,totalAttendees,attendedMembersCount,attendedGuestsCount,payments}` | 404 session; 400 no positive cost/no attendees |
| Votes | POST /votes — Upsert own session vote | JWT + Self | — | sessionId, status (JOIN/DECLINE); reason?, timeSlotIds? [] | 200 `{message,vote,sessionConfirmed,joinCount,absenceLog?}` | 400 invalid fields/slots/state/lock/deadline/debt; 404 session; locked includes isVoteLocked, debt includes unpaidPayment |
| Votes | POST /votes/admin/adjust — Adjust another member's vote | JWT + Admin | — | sessionId, userId, status (JOIN/DECLINE/MAYBE/NONE/DELETE, normalized uppercase); reason? | 200 `{message,vote,joinCount,sessionConfirmed?,absenceLog?,deleted?}`; deletion returns vote null/deleted true | 400 invalid fields/status/cancelled session; 404 session/user |
| Votes | PATCH /votes/:voteId — Update own vote | JWT + Owner | — | status required (JOIN/DECLINE); reason?, timeSlotIds? [] | 200 `{message,vote,absenceLog}` | 400 invalid status/slots/state/lock/deadline/debt; 403 other owner; 404 vote |
| Votes | GET /sessions/:sessionId/votes — List session votes | JWT | — | — | 200 `{votes,summary:{join,decline,maybe,total}}` | Missing session returns empty list/zero summary |
| Payments | GET /sessions/:sessionId/payments — List session debts | JWT | — | — | 200 `{session:{id,totalCost,status,payer},payments,summary:{totalCost,pending,paid,confirmed,total}}` | 404 session |
| Payments | POST /payments/:paymentId/mark-paid — Claim manual transfer | JWT + Owner (Admin has no override) | — | — | 200 `{message,payment}` with PAID/paidAt | 403 wrong owner; 404 payment; no state-regression guard today |
| Payments | POST /payments/:paymentId/confirm — Confirm received payment | JWT + Payer/Admin | — | — | 200 `{message,payment,sessionCompleted}`; can set session COMPLETED | 403 wrong payer/non-admin; 404 payment |
| PayOS | POST /payments/:paymentId/payos-link — Create or reuse payment link | JWT + Owner/Admin | — | — | 200 `{payment,orderCode,checkoutUrl,qrCode,amount,description,accountName,accountNumber,bin}` OR `{status:'CONFIRMED',message,payment}` if existing provider order paid | 403 wrong owner/non-admin; 404 payment; 400 already confirmed/config/provider error |
| PayOS | GET /payments/:paymentId/payos-status — Poll and reconcile payment status | JWT (any member, existing rule) | — | — | 200 `{status,payment,isPaid,payosStatus?}`; PAID provider order can write CONFIRMED | 404 payment; provider lookup failures are caught and return DB fallback |
| PayOS | POST /payments/payos-webhook — Process signed PayOS notification | Public + provider signature | — | PayOS webhook JSON including signature and data; verified SDK data uses code, orderCode, amount, desc | 200 `{success:true,message}`; unknown order also 200; internal errors 200 `{success:false,error}` | 400 invalid signature/config verification; global 429 |

Profile PATCH still requires displayName; vote PATCH still requires status and defaults absent timeSlotIds to empty. PATCH names describe partial resource updates, not newly permissive field validation. Missing tier/goalkeeper/bulk flags keep their historical clearing behavior; new clients should send these explicitly.

Attendance summary fields: totalVoters, joinedCount, maybeCount, declinedCount, attendedMembersCount, unattendedMembersCount, attendedGuestsCount, totalGuestsCount, reserveGuestsCount, playingGuestsCount, totalAttendedOnPitch, lateCancellationsCount, noShowsCount, totalWarningsCount, isMatchStarted, isVoteLocked, voteLockedAt, matchStartTime, minutesToMatch. No-show entries contain userId, user, votedAt, type and message. AbsenceLog is the Prisma absence model (id/sessionId/userId/reason/reportedAt/isLate/minutesBeforeMatch); dashboard adds user.

Legacy operations use the same tag, security, bodies and status schemas as their canonical counterpart, with `deprecated: true` in future OpenAPI. Their deprecation headers point to the canonical path. Parameter-only historical `:id` names are not separate URL operations.

Remaining readiness work before publishing a formal spec: expand algorithm/provider payloads into exact nested schemas, model all response branch variants, define validated input types rather than documenting intended-only coercions as guarantees, resolve error-envelope/404 strategy, and perform separately approved integration checks against a test database and PayOS sandbox. This task documents observed code contracts without issuing real transactions.

### Verification and review outcome

- All 49 canonical operations and 18 deprecated wire aliases are exercised by the route contract test. Changed frontend wrapper URLs/methods and existing body fields are verified.
- `npm test --prefix server`: 9/9 Node test-runner entries passed (7 new contract checks and 2 existing script files, whose internal assertions total 13). Selected real controllers use mocked infrastructure; other exhaustive routing checks stub controllers.
- `npm run build` in client: passed, 57 modules transformed. `node --check` across backend source/new test and `git diff --check`: passed. Prisma client generated from unchanged schema; no migration or live integration performed.
- Independent Codex review `punchdad-api-review-20261003`, linked to implementation `punchdad-api-codex-20261003`, found no introduced blockers and independently reran tests/diff checks. It verified JWT/Admin/owner/payer boundaries, webhook signature-first access, cancellation vs hard deletion, and client compatibility.
- Antigravity's isolated attempt stopped on CLI command permission refusal and its partial helper was not integrated. Codex completed the bounded implementation under user policy. No new dependency, response envelope, API version, schema change or general update-user abstraction was introduced.
- Formal runtime-ledger acceptance is not recorded: installed MCP exposes the old JSON interface, without the updated SQLite lifecycle/linked-review tools required by the latest user policy. The independent review evidence is preserved in HANDOFF; restart/update MCP before recording formal telemetry acceptance. No deployment or release gate is bypassed.
