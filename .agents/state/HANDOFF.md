# Latest-main API normalization review handoff

Baseline: acc70aa560ebf5244271b37c38f9b05863aaa035. Branch: gbao-api-normalization. Date: 2026-11-03.
Implementation ID: punchdad-normalize-20261103. Independent review ID: punchdad-review-20261103 (review_of punchdad-normalize-20261103).
Risk: auth/payment-sensitive route wiring and CORS whitelist; independent Codex review required. Profile1 AGENT_SYSTEM_MODE=1 permits direct Codex execution. API specialist is disabled and was not invoked.

## Goal and scope
User asked to normalize latest repo and publish on the immutable submitted URL https://swaggerdocsmockhitdad.vercel.app/. Code is ready locally; public deployment is not claimed.
Review docs/api-normalization.md and docs/api-endpoints.json for 57 audited router operations (plus unchanged app health/two webhook aliases) and 20 deprecated wire aliases. Six controllers only change parameter bindings/comments; five route modules add canonical methods/paths and preserve original auth/handler stacks. Client wrapper URLs/methods updated, same bodies. Partial updates PATCH; payment/cancel domain actions POST; hard delete remains explicit /force.
OpenAPI source is server/src/docs/swagger.json. swaggerDoc.js reexports JSON; docs:sync writes static openapi.json. User(15) and Payment(7) canonical operations plus Auth/login and deprecated aliases are documented. Login adds documentation only, not auth behavior. Static Vercel config intentionally disables framework/build/install, outputs '.', and aliases /swagger.json to /openapi.json. Backend Swagger UI loads /swagger.json. CORS adds only exact submitted origin; unrelated Vercel hosts remain denied. DB schema/token lifecycle/membership policy/payment logic/limits are unchanged.

## Evidence before review
Backend npm test: exit0, 63 entries:62 pass,1 optional PostgreSQL integration skipped (explicitly disabled); no live DB/provider/email calls. New tests cover all canonical/legacy router operations, actual JWT/membership middleware, admin/owner/payer denial, named controller params, member slot creation, cancellation vs force deletion, webhook verify-before-DB and known-order confirmation, rate limits, CORS+PATCH preflight, frontend wrapper bodies, JSON refs/path parameters/static copies and static UI config.
Client npm run build: exit0 (634 modules; preexisting bundle-size warning); node --test tests/attendance.test.js tests/team-balance.test.js tests/time-slots.test.js:10 pass.
node --check across server/src/scripts/tests and git diff --check passed. docs:check passed.
Existing membership route mock adapted to PATCH/deprecation helper; existing Excel export test now stubs persistence rather than querying a real DB, while using actual ExcelJS. Direct controller integration scripts use sessionId.

## Deployment state and authorization
Submitted URL and /openapi.json currently return HTTP500 FUNCTION_INVOCATION_FAILED. Root cause cannot be concluded from status alone. Render is healthy without Origin but rejects submitted docs Origin (500 CORS response); fixed exact whitelist requires backend rollout before docs promote.
User explicitly authorized using/updating the same Vercel URL, not creating a new hostname. Vercel CLI currently logged out. User replied they will log in, not yet confirmed complete. No production deployment, Git commit/push or main merge has occurred. Do not promote canonical docs against the still-legacy backend. Need verified access/project/domain plus coordinated backend deployment before public completion.
Current MCP lacks record_agent_execution/updated lifecycle tools; no old JSON writers/gates invoked and no ledger acceptance claimed. Evidence is manual in this handoff.

## Review request
Read-only independent review against baseline: introduced routing, authorization, payment/data-loss, CORS/security, Swagger/client compatibility, and deployment configuration regressions. Check canonical/alias coverage and direct controller/test adaptations. Return actionable findings (severity/file/line) or no introduced blockers with limits. Re-run targeted tests if useful; do not edit code, invoke real providers, access credentials, commit or deploy. Record evidence for append here; formal telemetry remains unavailable.

## Independent review outcome
Review ID punchdad-review-20261103, review_of punchdad-normalize-20261103. Reviewer /root/independent_api_review is distinct from implementer. Read-only diff review against acc70aa found no introduced blockers in routing, auth/payment boundaries, cancellation vs deletion, client compatibility, CORS, Swagger loading or static deployment configuration. Confirmed57 canonical router operations and20 aliases; token-purpose/authVersion/membership checks unchanged; webhook signature-before-DB; exact submitted-origin CORS.
Independent backend rerun (scoped elevated due sandbox loopback EACCES):62pass,1 optional PostgreSQL skip. docs:check and git diff --check pass. No real DB/payment/account/deployment. Existing Decimal-as-number Swagger schema remains a preexisting limitation.
Production completion remains pending verified Vercel login/project/domain and coordinated backend rollout. No accepted runtime-ledger execution is claimed because the lifecycle tools are not exposed.
User has been asked separately for main push/backend rollout authorization under AGENTS.md; docs publish to the fixed hostname was already authorized. Await explicit response; do not infer permission from elapsed time.

## Publication authorization
User explicitly authorized main rollout on 2026-11-03: 'deploy lên main đi'. Commit/push to main and existing deployment rollout are authorized. Independent review and automated checks above apply to this exact application diff. Vercel project access still must be verified; do not create a substitute hostname.
