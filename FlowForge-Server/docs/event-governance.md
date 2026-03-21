# Event Governance Guide

This document defines retention, archival, and legal-hold governance for execution events.

## 1. Retention Policy

Event retention class is resolved by event type when not explicitly provided:

- `security`: `execution.failed`, `execution.cancelled`, `step.failed`, `step.retrying`, `step.compensation.failed`
- `compliance`: `execution.completed`, `execution.compensating`, `step.compensation.started`, `step.compensation.completed`
- `operational`: all remaining event types

Retention windows are configurable by environment variables:

- `EVENT_RETENTION_DAYS_OPERATIONAL` (default: `90`)
- `EVENT_RETENTION_DAYS_SECURITY` (default: `90`)
- `EVENT_RETENTION_DAYS_COMPLIANCE` (default: `90`)

At write-time, each event stores:

- `retention_class`
- `expires_at`
- `payload_size_bytes`

## 2. Archive Policy

Archive pipeline behavior:

1. Scan expired records in `execution_events` where `expires_at <= now` and `legal_hold != true`.
2. Upsert each event into `execution_events_archive` by unique `source_event_id`.
3. Delete archived records from `execution_events`.

Controls:

- `EVENT_ARCHIVE_ENABLED` (`true`/`false`, default `false`)
- `EVENT_ARCHIVE_INTERVAL_MS` (default `60000`)
- `EVENT_ARCHIVE_BATCH_SIZE` (default `500`)

## 3. Legal Hold Workflow

Legal hold is execution-scoped and prevents retention lifecycle actions.

Endpoints:

- `POST /executions/:id/legal-hold` with optional `{ "reason": "..." }`
- `DELETE /executions/:id/legal-hold`

Behavior:

- When hold is active, existing and future events for that execution are marked with `legal_hold=true` and set to non-expiring horizon.
- Archive job skips all held events.
- Releasing hold recomputes `expires_at` from `occurred_at` + retention policy and re-enables lifecycle processing.

## 4. Operational Recommendations

- Restrict legal-hold endpoint access to trusted operators.
- Use reason strings for traceability and incident correlation.
- Monitor archive throughput and lag with periodic metrics on moved/deleted counts.

## 5. Deferred Hardening (Authorization)

Current implementation is owner-scoped and functional for project phase needs.

Planned hardening for future release:

- Introduce dedicated operator/admin roles for legal-hold actions.
- Enforce role-based access checks on `POST /executions/:id/legal-hold` and `DELETE /executions/:id/legal-hold`.
- Add immutable audit records for hold/release actor identity and approval context.

Status: documented and deferred by decision; not required for the current phase.
