# API normalization on latest main

Baseline: acc70aa560ebf5244271b37c38f9b05863aaa035. Working branch: gbao-api-normalization. Scope: route names/methods/parameters, client requests, Swagger and submitted documentation site.

## Contract

`docs/api-endpoints.json` inventories all 57 router operations before changes and their canonical replacements, handlers and route-level permissions. Health and two existing public webhook aliases in app.js are unchanged. Twenty wire operations retain deprecated aliases. Parameter-name-only updates do not create separate wire endpoints.

- Partial session/vote/guest/profile/tier/goalkeeper/membership-decision/feedback updates use PATCH.
- Session vote/payment collections use `/api/sessions/:sessionId/votes` and `/payments`.
- Self profile and media/password resources use `/api/users/me`.
- Mark-paid/confirm/cancel remain distinct POST domain commands. Explicit DELETE `/sessions/:sessionId/force` remains hard deletion.
- PUT teams/avatar/QR/password replaces whole subresources. Attendance POST may create a JOIN vote; bulk PATCH only changes existing JOIN check-ins.
- New params are sessionId, userId, voteId, paymentId, guestId, feedbackId. Aliases dispatch to the same handlers without redirects.

All frontend API calls remain centralized in `client/src/services/api.js`, including new membership and feedback wrappers. Their callers keep the same wrapper functions and payloads. Existing mobile/web consumers can continue using aliases, with `X-API-Deprecated: true` and Link to the canonical URL. Removing aliases needs a separate consumer migration decision.

Response bodies, status codes, validation requirements and business logic are preserved. In particular, profile PATCH still requires displayName, vote PATCH requires status, and 200 JSON delete responses remain. No database schema, authVersion/token lifecycle, membership policy, PayOS verification/calculations or rate-limit thresholds change. The known submitted docs origin is explicitly added to CORS; arbitrary Vercel domains remain denied. No `/v1` or generic user-update authorization layer is introduced.

## OpenAPI / publish

User and Payment are the two documented business collections. Auth/login is added so users can obtain a token from Swagger. Canonical and deprecated variants are documented with accurate renamed path parameters; public webhook explicitly has `security: []`. Single source: `server/src/docs/swagger.json`; the tiny swaggerDoc.js wrapper and `npm run docs:sync` keep runtime/static views aligned. `npm run docs:check` detects stale static output.

Fixed submission site: https://swaggerdocsmockhitdad.vercel.app/. See `docs/swagger-web/README.md` for the coordinated backend/static rollout. JSON can be hosted and consumed by Swagger UI or imported into SwaggerHub; it is not an API server. Official Swagger UI configuration documents `url` for a JSON/YAML definition: https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/.

## Verification and limits

New regression tests exercise all router operations and aliases over local HTTP, actual JWT/membership middleware, selected real controllers, owner/payer/admin restrictions, cancellation versus hard deletion, webhook signature-before-DB ordering, throttling, submitted-origin CORS, frontend request bodies and Swagger references/copies. Infrastructure boundaries are mocked. Existing membership/Excel tests are adapted to the new route middleware and isolated from real persistence; time-slot tests use sessionId.

Production deployment status must be verified separately; code/test completion does not establish public rollout. No real account, database mutation, payment or provider configuration call is performed by the test suite. Optional dedicated PostgreSQL security integration stays skipped when unconfigured.
