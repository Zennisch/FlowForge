> This file is maintained by AI to track progress. Update it as the project evolves.

---

# Production Readiness Backlog

## P0 — Critical Risk

| Issue | Status | Related Files | Details | Notes |
|---|---|---|---|---|
| DAG fan-in (join) correctness is not guaranteed | Resolved | src/modules/event/event-router.service.ts, src/modules/event/event-router.service.spec.ts | Added fan-in gating in EventRouter: downstream step is dispatched only when all direct parent steps for that node are completed in the same execution. | 2026-03-20: Added regression tests for join dispatch blocking/unblocking. |
| Branch flow can leave execution stuck indefinitely | Resolved | src/modules/worker/handlers/branch.handler.ts, src/modules/event/event-router.service.ts | Added fail-fast branch validation (no match + no default throws) and dead-end routing compensation in EventRouter when branch output does not map to any outgoing edge. | 2026-03-20: Added regression tests in branch.handler.spec.ts and event-router.service.spec.ts. |
| Cancel does not fully stop in-flight processing | Resolved | src/modules/execution/execution.service.ts, src/modules/execution/step-state.service.ts, src/modules/event/event-router.service.ts, src/modules/worker/consumer.service.ts | Added hard cancellation guards across worker and orchestrator paths: cancel now marks queued/running step executions as skipped; worker drops stale jobs when step cannot transition to running; event router ignores late step results for non-running executions and blocks retries after cancellation. | 2026-03-20: Added regression tests in execution.service.spec.ts, step-state.service.spec.ts, and event-router.service.spec.ts. |
| Idempotency is not domain-safe under concurrency | Resolved | src/modules/execution/execution.service.ts, src/modules/execution/execution.schema.ts, src/modules/execution/execution.service.spec.ts | Replaced check-then-insert with atomic insert + duplicate key handling; scoped idempotency uniqueness to owner_id + workflow_id + idempotency_key via compound partial unique index; normalized incoming keys to avoid whitespace/empty-key inconsistencies. | 2026-03-20: Added regression tests for duplicate-key conflict and key normalization. |
| Running executions are affected by workflow edits | Open | src/modules/event/event-router.service.ts, src/modules/workflow/workflow.service.ts, src/modules/execution/execution.schema.ts | Event routing reads the current workflow definition at runtime, so in-flight executions may run against updated definitions instead of a pinned snapshot/version. | |
| Retry/backoff is process-memory based | Open | src/modules/event/event-router.service.ts | Retry delays use in-process timers. Process restart/crash can lose retry scheduling context and lead to inconsistent execution progression. | |

## P1 — High Risk

| Issue | Status | Related Files | Details | Notes |
|---|---|---|---|---|
| At-least-once delivery handling is incomplete | Open | src/modules/worker/consumer.service.ts, src/modules/event/event-router.service.ts, src/modules/execution/step-state.service.ts | Pub/Sub may redeliver messages, but state transitions are not fully idempotent, so duplicate jobs/events can trigger repeated side effects. | |
| Scheduled triggers can duplicate across multiple app instances | Open | src/modules/scheduler/workflow-scheduler.service.ts | Scheduler runs inside app instances without distributed lock/leader election, so the same schedule may fire more than once when scaled horizontally. | |
| Missing timeout/watchdog policies for stuck steps/executions | Open | src/modules/execution/execution.schema.ts, src/modules/execution/step-execution.schema.ts | No explicit domain timeout policy for step or execution lifecycle, increasing risk of indefinitely running or orphaned workflows. | |
| Compensation is generic and not business-action rollback | Open | src/modules/execution/compensate.service.ts | Compensation currently marks states as failed but does not perform domain-specific undo actions for previously completed side-effecting steps. | |
| Webhook security lacks anti-replay and abuse controls | Open | src/modules/execution/webhook.controller.ts, src/modules/execution/execution.service.ts | Secret validation exists, but no nonce/timestamp signature checks and no request throttling/quota controls for abuse prevention. | |
| HTTP step has SSRF/outbound policy risk | Open | src/modules/worker/handlers/http.handler.ts | Arbitrary URL calls are possible without allowlist/egress policy enforcement, exposing potential SSRF and uncontrolled outbound traffic. | |

## P2 — Medium Risk

| Issue | Status | Related Files | Details | Notes |
|---|---|---|---|---|
| Missing tenant quotas and business limits | Open | src/modules/execution/execution.controller.ts, src/modules/workflow/workflow.controller.ts | No domain limits for concurrent executions, trigger rate, or payload size per tenant/workflow, which can impact fairness and stability. | |
| Event retention and audit governance are not defined | Open | src/modules/event/event.service.ts, src/modules/event/execution-event.schema.ts | Event logs are append-only, but lifecycle policies (retention, indexing strategy, archival) and long-term query governance are not formalized. | |
| Step config contract validation is too generic | Open | src/modules/workflow/dto/create-workflow.dto.ts, src/modules/worker/step-executor.service.ts | DTOs validate general shape but do not enforce strict per-step-type config schemas (http/transform/store/branch), risking runtime misconfiguration. | |
| Execution query capabilities are limited for operations | Open | src/modules/execution/execution.controller.ts, src/modules/execution/execution.service.ts | Listing and retrieval endpoints lack production-grade filtering, pagination model, and operational search options for high-volume environments. | |
| Auth domain is still MVP-level | Open | src/modules/auth/auth.service.ts, src/modules/auth/jwt.strategy.ts | Missing refresh-token rotation, session revocation, and brute-force protections/lockout strategy for mature account security management. | |

---
