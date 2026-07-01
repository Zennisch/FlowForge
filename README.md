# FlowForge

FlowForge is a workflow automation platform composed of a Next.js client, a
NestJS API/worker service, and Terraform assets for Google Pub/Sub. It lets
users define workflows, trigger executions manually, by schedule, or by webhook,
and monitor execution state through an event log.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `FlowForge-Client/` | Next.js 14 App Router frontend for auth, workflow management, and execution monitoring. |
| `FlowForge-Server/` | NestJS backend with REST APIs, MongoDB persistence, Pub/Sub orchestration, scheduler, and worker handlers. |
| `Terraform/` | Google Cloud Pub/Sub topics and subscriptions used by the backend runtime. |

## Stack

- Package manager: pnpm 10.30.3
- Frontend: Next.js 14, React 18, TypeScript, TanStack Query, Zustand, React Flow, Vitest, Playwright
- Backend: NestJS 11, TypeScript, MongoDB/Mongoose, Google Cloud Pub/Sub, JWT auth, Resend email API, Jest
- Infrastructure: Terraform for GCP Pub/Sub

## Local Setup

Install dependencies separately in the client and server projects:

```bash
cd FlowForge-Server
pnpm install

cd ../FlowForge-Client
pnpm install
```

Create environment files from the templates:

```bash
cd FlowForge-Server
cp .env.tmp .env

cd ../FlowForge-Client
cp .env.tmp .env
```

Fill the server `.env` with MongoDB, JWT, frontend URL, Resend, and Google
Cloud Pub/Sub settings. Fill the client `.env` with the API URL:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Do not commit real secrets, service-account credentials, or Terraform state.

## Running Locally

Start the backend first:

```bash
cd FlowForge-Server
pnpm run start:dev
```

Start the client in another terminal:

```bash
cd FlowForge-Client
pnpm run dev
```

By default, the backend listens on `PORT` or `3000`. The client uses
`NEXT_PUBLIC_API_URL` to reach the backend.

## Useful Commands

| Project | Command | Purpose |
| --- | --- | --- |
| Client | `pnpm run dev` | Start the Next.js dev server. |
| Client | `pnpm run type-check` | Run TypeScript checks. |
| Client | `pnpm run build` | Build the production client. |
| Client | `pnpm test` | Run Vitest unit tests. |
| Client | `pnpm run test:e2e` | Run Playwright tests. |
| Server | `pnpm run start:dev` | Start NestJS in watch mode. |
| Server | `pnpm run build` | Build the backend. |
| Server | `pnpm test` | Run Jest unit tests. |
| Server | `pnpm run test:e2e` | Run backend e2e tests if configured. |

## Service Relationship

The client calls the backend through REST APIs. Public auth endpoints cover
registration, login, email verification, and password reset. Authenticated users
can manage workflows, trigger executions, inspect execution history, cancel
executions, view events, and manage legal hold state.

The backend stores users, workflows, executions, step state, and events in
MongoDB. Workflow execution is asynchronous: orchestration publishes jobs to
Google Pub/Sub, workers consume jobs, handlers run steps, and results are routed
back into the execution engine.

## Infrastructure

The `Terraform/` folder contains templates for:

- `workflow-jobs` topic and subscription
- `workflow-events` topic and subscription
- Google Pub/Sub API enablement

Copy the `.template` files to real Terraform files and provide project-specific
values before applying. Keep credentials and generated state out of source
control.

## More Documentation

- Client details: [`FlowForge-Client/README.md`](FlowForge-Client/README.md)
- Backend details: [`FlowForge-Server/README.md`](FlowForge-Server/README.md)
