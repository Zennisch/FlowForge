# FlowForge Client — Frontend Readiness Backlog

> This file is maintained by AI to track frontend gaps against the latest backend production baseline.

---

## Scope

- Baseline used for comparison:
	- Backend hardening and API evolution documented up to 2026-03-22 (auth verification/reset flows, execution/event query governance, legal hold endpoints, execution summary endpoint).
- Objective:
	- Identify frontend gaps that prevent full compatibility or operational parity with the backend.

---

## P0 — Critical Contract Gaps

| Issue | Status | Related Files | Details | Notes |
|---|---|---|---|---|
| Auth flow is out of sync with backend verification model | Open | src/lib/api/auth.api.ts, src/hooks/useAuth.ts, src/lib/api/client.ts, src/types/auth.types.ts, src/app/(auth)/register/page.tsx, src/app/(auth)/login/page.tsx | Frontend still models register as token-returning auth success and only supports login/register endpoints. Backend now requires email verification before login and provides verify/resend/forgot/reset endpoints with one-time tokens. Missing UI/API support causes incomplete user journey and incorrect expectations after registration. | 2026-03-23: Must add API adapters + pages/forms for verify-email, resend verification, forgot password, reset password. Update register success UX to "check your email" flow. |
| Execution list/events contract does not support backend query governance and cursor pagination | Open | src/lib/api/executions.api.ts, src/hooks/useExecutions.ts, src/app/(dashboard)/executions/page.tsx, src/app/(dashboard)/workflows/[id]/executions/page.tsx | Frontend assumes array-only responses for executions/events and performs client-side filtering. Backend now exposes validated filters + cursor pagination (and operation-oriented querying), so current adapter/hook design risks breakage or partial data when response shape or volume requires cursor flow. | 2026-03-23: Add typed query params, paginated response models, cursor state, and server-side filtering in API calls instead of in-memory filtering. |
| Execution operations parity is incomplete (summary + legal hold endpoints absent) | Open | src/lib/api/executions.api.ts, src/hooks/useExecutions.ts, src/app/(dashboard)/executions/page.tsx, src/app/(dashboard)/executions/[id]/page.tsx | Backend provides `GET /executions/summary`, `POST /executions/:id/legal-hold`, and `DELETE /executions/:id/legal-hold`. Frontend has no API client methods, hooks, or UI actions for these operations, so ops/compliance capabilities are missing. | 2026-03-23: Add summary widgets on executions page and legal-hold controls in execution detail with proper permission/error states. |

## P1 — High Impact Functional Gaps

| Issue | Status | Related Files | Details | Notes |
|---|---|---|---|---|
| Event type model is stale vs hardened backend event taxonomy | Open | src/types/execution.types.ts, src/lib/api/executions.api.ts, src/components/execution/EventTimeline.tsx, src/app/(dashboard)/executions/[id]/page.tsx | Event type union currently only includes base execution/step events. Backend includes compensation and governance-related audit events introduced in production hardening. Narrow unions reduce type safety and can hide/ignore new event classes in UI rendering logic. | 2026-03-23: Expand EventType union and update timeline labeling/rendering for newly supported event kinds. |
| Workflow execution history relies on global fetch + local filter | Open | src/hooks/useExecutions.ts, src/app/(dashboard)/workflows/[id]/executions/page.tsx | `useWorkflowExecutions` currently calls global list and filters on client. This is inefficient and becomes incorrect with paginated backend data. | 2026-03-23: Replace with workflow-scoped execution query params at API layer. |
| Auth interceptor policy is too narrow for expanded public auth endpoints | Open | src/lib/api/client.ts | 401 handling excludes only `/auth/login` and `/auth/register`. New public auth endpoints (verify/resend/forgot/reset) may be treated like protected routes and force redirect behavior that breaks auth UX during error handling. | 2026-03-23: Introduce endpoint classification for public-auth routes and centralize auth error handling strategy. |

## P2 — Medium Priority Alignment / Quality Gaps

| Issue | Status | Related Files | Details | Notes |
|---|---|---|---|---|
| Frontend guideline contract section is outdated compared to backend | Open | guidelines.md, src/lib/api/auth.api.ts, src/lib/api/executions.api.ts | Client guideline still documents auth register as returning access token and does not reflect new auth/execution/legal-hold capabilities. This increases implementation drift risk. | 2026-03-23: Update client guidelines after API/client refactor is completed. |
| Missing tests for new backend-aligned API adapters and query behavior | Open | src/lib/api/*.ts, src/hooks/*.ts, vitest.config.ts, playwright.config.ts | No visible coverage for auth verification/reset flows, execution cursor pagination, event filtering, or legal-hold actions. | 2026-03-23: Add unit tests for adapters/hooks and E2E happy-paths for new auth journey. |

---

## Suggested Implementation Order

1. Auth contract refactor (P0)
2. Executions/events query contract refactor with cursor/filter support (P0)
3. Add summary + legal-hold features (P0)
4. Event taxonomy/type updates and workflow-scoped execution query fix (P1)
5. Docs and tests hardening (P2)

---

*Last updated: 2026-03-23 — Frontend readiness audit completed against backend production baseline.*
