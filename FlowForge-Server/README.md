# FlowForge Server

NestJS backend for FlowForge. The server exposes REST APIs, persists workflow
and execution state in MongoDB, sends auth emails through Resend, orchestrates
workflow execution through Google Pub/Sub, and runs worker/scheduler services in
the same modular NestJS application.

## Stack

- NestJS 11 and TypeScript
- MongoDB with Mongoose
- JWT authentication with Passport
- Google Cloud Pub/Sub for workflow jobs and step results
- Resend email API for verification and password-reset messages
- Jest and Supertest for testing

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/main.ts` | Nest bootstrap, CORS, request logging in development, and global validation. |
| `src/app.module.ts` | Module composition for API, scheduler, and worker capabilities. |
| `src/infra/config/` | Global `.env` loading and runtime validation. |
| `src/infra/database/` | Mongoose connection provider. |
| `src/infra/mail/` | Resend mail client. |
| `src/infra/pubsub/` | Google Pub/Sub provider. |
| `src/modules/auth/` | Registration, login, email verification, reset flows, JWT strategy, and guard. |
| `src/modules/users/` | User persistence and password lifecycle updates. |
| `src/modules/workflow/` | Workflow CRUD, DAG validation, quotas, and step config validation. |
| `src/modules/execution/` | Triggering, execution state, cancellation, legal hold, events, and watchdogs. |
| `src/modules/event/` | Event routing, immutable event log, retention, archiving, and governance. |
| `src/modules/scheduler/` | Cron-based workflow triggers. |
| `src/modules/worker/` | Pub/Sub consumers and step handlers. |
| `src/shared/` | Shared Pub/Sub contracts and utilities. |

## Environment

Create `.env` from `.env.tmp`:

```bash
cp .env.tmp .env
```

Core variables:

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development` or `production`. |
| `PORT` | Optional HTTP port, defaults to `3000`. |
| `CORS_ORIGINS` | Semicolon-separated allowed origins, for example `http://localhost:3000;http://localhost:3001`. |
| `MONGODB_URI` | MongoDB connection string. |
| `JWT_SECRET` | Secret used to sign JWTs. |
| `JWT_EXPIRES_IN` | Access token TTL, for example `7d`. |
| `FRONTEND_URL` | Frontend base URL used by email link templates. |
| `VERIFY_EMAIL_URL_TEMPLATE` | Verification link template containing `{token}` or `{{token}}`. |
| `RESET_PASSWORD_URL_TEMPLATE` | Reset-password link template containing `{token}` or `{{token}}`. |
| `RESEND_API_KEY` | Resend API key for transactional email. |
| `MAIL_FROM` | Verified sender address. |
| `MAIL_HTTP_TIMEOUT_MS` | Optional Resend HTTP timeout in milliseconds. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the GCP service-account JSON file. |
| `GOOGLE_CLOUD_PROJECT` | GCP project id. |
| `PUBSUB_JOBS_TOPIC` | Topic for step jobs. |
| `PUBSUB_JOBS_SUBSCRIPTION` | Subscription consumed by workers. |
| `PUBSUB_EVENTS_TOPIC` | Topic for step results. |
| `PUBSUB_EVENTS_SUBSCRIPTION` | Subscription consumed by the event router. |

Runtime limits and governance variables:

| Variable | Description |
| --- | --- |
| `TRIGGER_PAYLOAD_MAX_BYTES` | Max trigger payload size. |
| `TRIGGER_RATE_LIMIT_WINDOW_SECONDS` | Trigger rate-limit window. |
| `TRIGGER_RATE_LIMIT_MAX_REQUESTS` | Max trigger requests per window. |
| `TENANT_MAX_RUNNING_EXECUTIONS` | Max pending/running executions per tenant. |
| `WORKFLOW_MAX_RUNNING_EXECUTIONS` | Max pending/running executions per workflow. |
| `WORKFLOW_MAX_PER_TENANT` | Max workflows per tenant. |
| `WORKFLOW_MAX_STEPS_PER_WORKFLOW` | Max steps per workflow definition. |
| `WORKFLOW_MAX_EDGES_PER_WORKFLOW` | Max edges per workflow definition. |
| `WORKFLOW_MAX_ACTIVE_SCHEDULE_PER_TENANT` | Max active schedule triggers per tenant. |
| `WORKFLOW_MAX_ACTIVE_WEBHOOK_PER_TENANT` | Max active webhook triggers per tenant. |
| `WORKFLOW_MAX_DEFINITION_BYTES` | Max serialized workflow definition size. |
| `HTTP_STEP_ALLOWED_HOSTS` | Optional allowlist for HTTP step targets. |
| `HTTP_STEP_ALLOW_PRIVATE_NETWORK_TARGETS` | Whether HTTP steps can call private/local network targets. |
| `EVENT_RETENTION_DAYS_OPERATIONAL` | Optional operational event retention days. |
| `EVENT_RETENTION_DAYS_SECURITY` | Optional security event retention days. |
| `EVENT_RETENTION_DAYS_COMPLIANCE` | Optional compliance event retention days. |
| `EVENT_ARCHIVE_ENABLED` | Enable event archiving. |
| `EVENT_ARCHIVE_INTERVAL_MS` | Archive scan interval. |
| `EVENT_ARCHIVE_BATCH_SIZE` | Max events archived per batch. |

Do not commit real `.env` files, service-account credentials, or generated
Terraform state.

## Install

```bash
pnpm install
```

## Development

```bash
pnpm run start:dev
```

The server reads `.env` through `@nestjs/config`. In development,
`src/main.ts` enables Morgan request logging. CORS is disabled unless
`CORS_ORIGINS` contains one or more semicolon-separated origins.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm run build` | Compile the NestJS app into `dist/`. |
| `pnpm run start` | Start NestJS normally. |
| `pnpm run start:dev` | Start in watch mode. |
| `pnpm run start:debug` | Start in debug watch mode. |
| `pnpm run start:prod` | Run `node dist/main`. |
| `pnpm run lint` | Run ESLint with auto-fix. |
| `pnpm test` | Run Jest unit tests. |
| `pnpm run test:watch` | Run Jest in watch mode. |
| `pnpm run test:cov` | Run Jest with coverage. |
| `pnpm run test:e2e` | Run e2e tests from `test/jest-e2e.json` if present. |

## API Endpoints

### Auth

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Register user and send verification email. |
| `POST` | `/auth/login` | Public | Login and return `{ access_token }`. |
| `POST` | `/auth/verify-email` | Public | Verify email with one-time token. |
| `POST` | `/auth/resend-verification` | Public | Send a new verification email. |
| `POST` | `/auth/forgot-password` | Public | Send password reset email. |
| `POST` | `/auth/reset-password` | Public | Reset password with one-time token. |

### Workflows

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/workflows` | JWT | List owner-scoped workflows. |
| `GET` | `/workflows/insights` | JWT | Return workflow summary and recent execution insight data. |
| `GET` | `/workflows/:id` | JWT | Get workflow detail. |
| `POST` | `/workflows` | JWT | Create workflow. |
| `PATCH` | `/workflows/:id` | JWT | Update workflow. |
| `DELETE` | `/workflows/:id` | JWT | Delete workflow. |
| `POST` | `/workflows/:workflowId/trigger` | JWT | Trigger a workflow manually. |

### Executions

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/executions` | JWT | List executions with filters and cursor pagination. |
| `GET` | `/executions/summary` | JWT | Return aggregate execution counts. |
| `GET` | `/executions/:id` | JWT | Get execution detail and step state. |
| `POST` | `/executions/:id/cancel` | JWT | Cancel a running execution. |
| `GET` | `/executions/:id/events` | JWT | List immutable execution events. |
| `GET` | `/executions/:id/legal-hold` | JWT | Read legal-hold state. |
| `POST` | `/executions/:id/legal-hold` | JWT | Place legal hold, optionally with a reason. |
| `DELETE` | `/executions/:id/legal-hold` | JWT | Release legal hold. |

### Webhooks

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/webhook/:userId/:path` | Timestamp/nonce and optional HMAC | Trigger webhook workflows. |

Webhook requests support `x-webhook-timestamp`, `x-webhook-nonce`, optional
`x-webhook-secret`, and optional `x-webhook-signature` headers. Do not sign
webhooks from a public browser client when a workflow secret is required.

## Workflow Model

Workflows contain:

- `trigger`: `manual`, `webhook`, or `schedule`
- `steps`: `http`, `transform`, `store`, or `branch`
- `edges`: directed links between steps, optionally with a condition
- optional retry policy with `fixed` or `exponential` backoff
- optional compensation policy for supported step types

The workflow service validates DAG shape, quotas, trigger limits, step config,
and serialized definition size before persisting changes.

## Execution Model

Manual, scheduled, and webhook triggers create execution records. The engine
publishes step jobs to Pub/Sub, workers execute handlers, and results are routed
back through Pub/Sub events. Execution and step transitions are persisted and
recorded as immutable events for monitoring, governance, and retention.
