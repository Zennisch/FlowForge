# FlowForge Server — Project Guidelines

> This file is maintained by AI to preserve project context and track progress. Update it as the project evolves.

---

## 1. Project Overview

**Name:** FlowForge  
**Type:** Backend API + Workflow Engine (Modular Monolith)  
**Version:** 1.0.0  
**Package Manager:** pnpm 10.x

**Summary:**  
FlowForge is a lightweight, event-driven workflow automation platform inspired by production-grade tools such as Temporal, Apache Airflow, and Zapier. It allows users to define, trigger, and observe multi-step business workflows processed asynchronously via a message-driven architecture.

---

## 2. Architecture

| Attribute       | Detail                          |
|-----------------|---------------------------------|
| Style           | Modular Monolith                |
| Processing      | Event-Driven Async              |
| Pattern         | Saga Orchestration              |
| Message Broker  | Google Pub/Sub                  |
| Database        | MongoDB (Atlas M0 free tier)    |
| Deployment      | Cloud Run (containerised)       |

### High-Level Component Flow

```
Browser / Client
      |
      | HTTPS / REST
      ▼
┌─────────────────────────────────────────────────┐
│            API Service (Cloud Run)              │
│  Auth | Workflow CRUD | Trigger | Query Status  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │  Workflow Engine       │
        │  (Modular Monolith)    │
        │                        │
        │  Workflow  | Execution │
        │  Module    | Module    │
        │            | Event     │
        │            | Module    │
        └──────┬─────────┬───────┘
               │         │
               ▼         ▼
         MongoDB      Google Pub/Sub
         (Atlas M0)   (workflow_jobs topic)
                           │
                           | subscribe
                           ▼
                     Worker Pool (1–N pods)
```

---

## 3. Technology Stack

- **Runtime:** Node.js 20 LTS — native async, large ecosystem
- **Language:** TypeScript 5 — type safety, better IDE support, self-documenting interfaces
- **Framework:** NestJS — opinionated structure with a built-in DI container, well-suited for a modular monolith
- **Message Broker:** Google Pub/Sub — fully managed, scalable, no-ops alternative to self-hosted RabbitMQ
- **HTTP Client:** Axios — interceptor support, straightforward timeout configuration
- **ORM / ODM:** Mongoose — schema validation at the app layer, clean model definitions
- **Auth:** jsonwebtoken + bcrypt — standard JWT access tokens with hashed passwords
- **Logging:** pino — fastest structured JSON logger available for Node.js
- **Testing:** Jest + Supertest — covers unit, integration, and HTTP endpoint tests
- **Containerisation:** Docker + Docker Compose — local dev environment; multi-stage Dockerfile for production builds
- **IaC:** Terraform 1.x — reproducible GCP + MongoDB Atlas infrastructure
- **CI/CD:** GitHub Actions — native GitHub integration, generous free tier
- **Load Testing:** k6 — JavaScript-based test scripts with cloud execution and metrics export

---

## 4. Core Features

### 4.1 Authentication
- User registration & login (email + password)
- JWT-based stateless auth (access token)
- Password hashing with bcrypt

### 4.2 Workflow Management (CRUD)
- Create, read, update, delete workflow definitions
- Each workflow defines an ordered list of **steps** (name, type, config, retry policy)
- Workflows are owned by a user (tenant-scoped)

### 4.3 Workflow Execution Engine
- Trigger a workflow by ID → creates an **Execution** record
- Orchestrator publishes step jobs to Google Pub/Sub
- Worker(s) subscribe, execute each step, publish result events back
- Saga Orchestration pattern: orchestrator drives step transitions (not choreography)
- Supports: sequential steps, retry with backoff, terminal states (`completed`, `failed`, `cancelled`)

### 4.4 Event / Status System
- Every state transition is recorded as an immutable **Event** document
- API exposes `GET /executions/:id` and `GET /executions/:id/events` for real-time observability
- Step-level status tracked inside the Execution document

### 4.5 Trigger Support
- Manual trigger via REST (`POST /workflows/:id/trigger`)
- (Planned) Scheduled trigger via cron
- (Planned) Webhook trigger

---

## 5. Module Structure (NestJS Modular Monolith)

```
src/
├── modules/
│   ├── auth/                        # JWT issuance, validation, guards
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   ├── jwt-auth.guard.ts
│   │   └── dto/
│   │       ├── register.dto.ts
│   │       └── login.dto.ts
│   │
│   ├── users/                       # User entity, registration, passwords
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   ├── user.schema.ts
│   │   └── dto/
│   │       └── create-user.dto.ts
│   │
│   ├── workflow/                    # Workflow CRUD + DAG validation
│   │   ├── workflow.module.ts
│   │   ├── workflow.controller.ts
│   │   ├── workflow.service.ts      # CRUD orchestration
│   │   ├── validate-dag.service.ts  # Cycle detection (topological sort)
│   │   ├── workflow.schema.ts
│   │   └── dto/
│   │       ├── create-workflow.dto.ts
│   │       └── update-workflow.dto.ts
│   │
│   ├── execution/                   # Execution lifecycle management
│   │   ├── execution.module.ts
│   │   ├── execution.controller.ts
│   │   ├── execution.service.ts     # Trigger, cancel, status queries
│   │   ├── step-state.service.ts    # Step status transitions & retries
│   │   ├── compensate.service.ts    # Saga compensation logic
│   │   ├── execution.schema.ts
│   │   ├── step-execution.schema.ts
│   │   └── dto/
│   │       └── trigger-execution.dto.ts
│   │
│   ├── event/                       # Immutable event log
│   │   ├── event.module.ts
│   │   ├── event.service.ts         # Append-only event writes
│   │   ├── event-router.service.ts  # Route Pub/Sub result messages
│   │   └── execution-event.schema.ts
│   │
│   └── worker/                      # Job consumer + step executor
│       ├── worker.module.ts
│       ├── consumer.service.ts      # Pub/Sub subscriber
│       ├── step-executor.service.ts # Dispatch to correct handler
│       └── handlers/                # One file per step type
│           ├── http.handler.ts
│           ├── transform.handler.ts
│           ├── store.handler.ts
│           └── branch.handler.ts
│
├── shared/                          # Cross-module DTOs, interfaces, utils
│   ├── interfaces/
│   │   ├── step-job.interface.ts
│   │   └── step-result.interface.ts
│   └── utils/
│       └── backoff.util.ts
│
└── infra/                           # Infrastructure wiring
    ├── database/
    │   └── mongoose.provider.ts
    ├── pubsub/
    │   └── pubsub.provider.ts
    └── config/
        └── config.module.ts
```

### Design Decisions

- **`auth/` vs `users/`**: `auth` handles JWT issuance and guards only. All user entity logic (creation, password hashing) lives in `users/`.
- **`workflow.service.ts`** (single file): CRUD is straightforward; only DAG validation is extracted to `validate-dag.service.ts` because it is a non-trivial algorithm.
- **`event/` module**: Append-only, never mutates. Serves `GET /executions/:id/events` and is written to on every execution/step state transition.
- **`worker/` module**: Can be disabled / scaled independently in a future split. Handlers follow a strategy pattern — each implements a common `StepHandler` interface.

---

## 6. Data Models (Mongoose)

### 6.1 `users`

```json
{
  "_id":        "ObjectId",
  "email":      "String (unique, lowercase)",
  "password":   "String (bcrypt hash)",
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

### 6.2 `workflows`

```json
{
  "_id":         "ObjectId",
  "owner_id":    "ObjectId (ref: users)",
  "name":        "String",
  "description": "String",
  "status":      "active | inactive",
  "trigger": {
    "type":   "manual | webhook | schedule",
    "config": "Object (cron expression / webhook secret / etc.)"
  },
  "steps": [
    {
      "id":     "String (user-defined, unique within workflow)",
      "type":   "http | transform | store | branch",
      "config": "Object (type-specific)",
      "retry":  { "maxAttempts": 3, "backoff": "exponential | fixed" }
    }
  ],
  "edges": [
    { "from": "String", "to": "String", "condition": "String (optional, for branch steps)" }
  ],
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

> **Note:** `edges` encodes the DAG adjacency list. For MVP, all workflows must be acyclic (validated by `validate-dag.service.ts` on create/update). Simple linear workflows are expressed as a chain of edges with no branching.

### 6.3 `workflow_executions`

```json
{
  "_id":              "ObjectId",
  "workflow_id":      "ObjectId (ref: workflows)",
  "owner_id":         "ObjectId (ref: users)",
  "status":           "pending | running | completed | failed | cancelled | compensating",
  "trigger_type":     "manual | webhook | schedule",
  "trigger_payload":  "Object (raw incoming payload)",
  "context":          "Object (shared mutable state passed between steps)",
  "idempotency_key":  "String (dedup key, unique index)",
  "started_at":       "ISODate",
  "completed_at":     "ISODate | null"
}
```

> **`context`**: Typed as `Record<string, unknown>` in TypeScript. Steps read from and write to this object; the orchestrator merges step output into it after each successful step.

> **`compensating`**: Terminal-direction status for Saga rollback. Transitions: `running → compensating → failed`.

### 6.4 `step_executions`

```json
{
  "_id":          "ObjectId",
  "execution_id": "ObjectId (ref: workflow_executions)",
  "step_id":      "String (ref: workflow.steps[].id)",
  "status":       "queued | running | completed | failed | skipped",
  "attempt":      "Number (current retry count, 0-based)",
  "input":        "Object (snapshot of context at step start)",
  "output":       "Object | null (step output snapshot)",
  "error":        "String | null",
  "started_at":   "ISODate | null",
  "completed_at": "ISODate | null"
}
```

> This collection is the **current-state snapshot** per step. It is updated in-place on retries (incrementing `attempt`).

### 6.5 `execution_events` (Immutable Audit Log)

```json
{
  "_id":          "ObjectId",
  "execution_id": "ObjectId (ref: workflow_executions)",
  "step_id":      "String | null (null for execution-level events)",
  "type":         "execution.started | execution.completed | execution.failed | execution.cancelled | execution.compensating | step.queued | step.started | step.completed | step.failed | step.skipped | step.retrying",
  "payload":      "Object (event-specific data: output, error, attempt, etc.)",
  "occurred_at":  "ISODate"
}
```

> Records are **never updated or deleted** — only inserted. This collection serves `GET /executions/:id/events` and provides a full immutable audit trail of every state transition.

---

## 7. API Endpoints (Planned)

### Auth
| Method | Path              | Description         |
|--------|-------------------|---------------------|
| POST   | /auth/register    | Register user       |
| POST   | /auth/login       | Login, return JWT   |

### Workflows
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| GET    | /workflows                  | List user's workflows     |
| POST   | /workflows                  | Create workflow           |
| GET    | /workflows/:id              | Get workflow              |
| PATCH  | /workflows/:id              | Update workflow           |
| DELETE | /workflows/:id              | Delete workflow           |
| POST   | /workflows/:id/trigger      | Trigger execution         |

### Executions
| Method | Path                        | Description               |
|--------|-----------------------------|---------------------------|
| GET    | /executions                 | List executions           |
| GET    | /executions/:id             | Get execution + step status|
| GET    | /executions/:id/events      | Get event log             |
| POST   | /executions/:id/cancel      | Cancel running execution  |

---

## 8. Google Pub/Sub Topology

| Resource          | Purpose                                      |
|-------------------|----------------------------------------------|
| `workflow-jobs`   | Orchestrator → Worker: publish step jobs     |
| `workflow-events` | Worker → Orchestrator: publish step results  |

**Message envelope (step job):**
```json
{
  "executionId": "...",
  "stepIndex": 0,
  "stepConfig": { "type": "http", "url": "...", "method": "POST" }
}
```

**Message envelope (step result):**
```json
{
  "executionId": "...",
  "stepIndex": 0,
  "status": "completed" | "failed",
  "output": { ... },
  "error": "..."
}
```

---

## 9. Important Commands

```bash
# Install dependencies
pnpm install

# Start development server (watch mode)
pnpm run start:dev

# Build for production
pnpm run build

# Start production server
pnpm run start:prod

# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Run e2e tests
pnpm run test:e2e

# Lint
pnpm run lint

# Format
pnpm run format

# Docker — build and start all services locally
docker compose up --build

# Docker — stop all services
docker compose down
```

---

## 10. Environment Variables

| Variable                    | Description                                      |
|-----------------------------|--------------------------------------------------|
| `NODE_ENV`                  | `development` / `production`                     |
| `PORT`                      | HTTP server port (default: `3000`)               |
| `MONGODB_URI`               | MongoDB Atlas connection string                  |
| `JWT_SECRET`                | Secret for signing JWT tokens                    |
| `JWT_EXPIRES_IN`            | Token expiry, e.g. `7d`                          |
| `GOOGLE_CLOUD_PROJECT`      | GCP project ID for Pub/Sub                       |
| `PUBSUB_JOBS_TOPIC`         | Pub/Sub topic for step jobs                      |
| `PUBSUB_EVENTS_TOPIC`       | Pub/Sub topic for step results                   |
| `PUBSUB_EVENTS_SUBSCRIPTION`| Subscription name for orchestrator               |

---

## 11. Development Workflow

1. **Feature branch** off `main` → `feat/<name>`
2. Implement feature inside the appropriate NestJS module
3. Write unit tests (`.spec.ts`) alongside the service/controller
4. Write e2e test in `test/` for new HTTP endpoints
5. Run `pnpm run lint && pnpm run test` — must pass before PR
6. Open PR → GitHub Actions runs lint + test + build
7. Merge to `main` → Docker image built and pushed to GCR
8. Cloud Run auto-deploys new revision

---

## 12. Progress Tracker

| Area                        | Status        | Notes                              |
|-----------------------------|---------------|------------------------------------|
| Project scaffold (NestJS)   | Done          | src/ structure + empty files created |
| MongoDB / Mongoose setup    | Done          | ConfigModule (global) + DatabaseModule with MongooseModule.forRootAsync; tsconfig, nest-cli, eslint, prettier configured |
| Auth module (JWT)           | Not started   |                                    |
| Users module                | Not started   |                                    |
| Workflows module (CRUD)     | Not started   |                                    |
| Executions module           | Not started   |                                    |
| Events module               | Not started   |                                    |
| Pub/Sub integration         | Not started   |                                    |
| Saga orchestrator           | Not started   |                                    |
| Worker / step runner        | Not started   |                                    |
| Docker Compose setup        | Not started   |                                    |
| CI/CD (GitHub Actions)      | Not started   |                                    |
| Terraform IaC               | Not started   |                                    |

---

*Last updated: 2026-03-11 — MongoDB/Mongoose setup complete. ConfigModule (global), DatabaseModule (MongooseModule.forRootAsync), main.ts, app.module.ts, tsconfig.json, tsconfig.build.json, nest-cli.json, .eslintrc.js, .prettierrc, and package.json scripts all configured. Build verified.*
