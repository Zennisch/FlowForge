# Execution Query Guide

This document describes production-ready query capabilities for execution operations.

## Endpoints

### `GET /executions`
Owner-scoped execution listing with validated filters and cursor pagination.

Supported query params:
- `status`: comma-separated or repeated values (`pending,running,failed,cancelled,completed,compensating`)
- `workflow_id`: workflow Mongo ObjectId
- `trigger_type`: comma-separated or repeated values (`manual,webhook,schedule`)
- `started_from`, `started_to`: ISO-8601 range for `started_at`
- `completed_from`, `completed_to`: ISO-8601 range for `completed_at`
- `has_errors`: `true` or `false`
- `q`: exact search against `idempotency_key`, and `_id` when ObjectId format is provided
- `cursor`: opaque cursor returned by the previous page
- `limit`: integer from 1 to 100 (default 20)

Guardrails:
- Unfiltered queries are capped at limit 50.
- Date ranges must be valid and cannot exceed 31 days.

Sort order:
- `created_at desc`, then `_id desc` (deterministic ordering).

Response shape:
```json
{
  "items": [
    {
      "_id": "...",
      "status": "running"
    }
  ],
  "page_info": {
    "limit": 20,
    "cursor": null,
    "next_cursor": "eyJjcmVhdGVkX2F0Ijoi...",
    "has_next_page": true
  }
}
```

Example:
```http
GET /executions?status=running,failed&trigger_type=manual&limit=20
Authorization: Bearer <token>
```

Next page example:
```http
GET /executions?status=running,failed&trigger_type=manual&limit=20&cursor=<next_cursor>
Authorization: Bearer <token>
```

### `GET /executions/summary`
Returns execution counts grouped by status for operations dashboards.

Supported query params:
- `workflow_id`: optional workflow Mongo ObjectId
- `started_from`, `started_to`: optional ISO-8601 range for `started_at`

Response shape:
```json
{
  "counts": {
    "pending": 0,
    "running": 12,
    "completed": 245,
    "failed": 4,
    "cancelled": 3,
    "compensating": 1
  },
  "total": 265
}
```

Example:
```http
GET /executions/summary?workflow_id=65f0d3fbd1d2a4b4b8f16c11&started_from=2026-03-01T00:00:00.000Z&started_to=2026-03-22T00:00:00.000Z
Authorization: Bearer <token>
```

### `GET /executions/:id/events`
Owner-scoped event timeline query with cursor pagination and optional filters.

Supported query params:
- `type`: comma-separated or repeated event types (`execution.started,step.failed,...`)
- `step_id`: exact step id
- `occurred_from`, `occurred_to`: ISO-8601 range for `occurred_at`
- `cursor`: opaque cursor returned by the previous page
- `limit`: integer from 1 to 200 (default 50)

Sort order:
- `occurred_at asc`, then `_id asc`.

Response shape:
```json
{
  "items": [
    {
      "type": "step.started",
      "step_id": "step-1"
    }
  ],
  "page_info": {
    "limit": 50,
    "cursor": null,
    "next_cursor": "eyJvY2N1cnJlZF9hdCI6IjIwMjYtMDMtMjJUMDA6MDA6MDAuMDAwWiIsImlkIjoiLi4uIn0",
    "has_next_page": true
  }
}
```

### `POST /executions/:id/legal-hold`
Places a legal hold for an execution. Optional body:

```json
{
  "reason": "audit investigation 2026-03"
}
```

### `DELETE /executions/:id/legal-hold`
Releases legal hold and resumes retention lifecycle according to policy.

## Operational Notes

- All queries are owner-scoped via JWT identity.
- Compound indexes in `execution.schema.ts` optimize owner-scoped list and summary queries.
- Event timeline queries are backed by `execution_events` indexes on `(execution_id, occurred_at, _id)` and `(execution_id, type, occurred_at)`.
- Expired hot events are eligible for archival when `EVENT_ARCHIVE_ENABLED=true`; archive jobs move eligible records to `execution_events_archive` before deleting from `execution_events`.
- Legal-hold lifecycle and policy matrix are documented in `docs/event-governance.md`.
- For high-volume investigations, prefer narrow windows (status + workflow_id + started range).
- `cursor` is opaque and should be treated as a token, not parsed by clients.
