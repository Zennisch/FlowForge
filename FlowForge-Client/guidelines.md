# FlowForge Client — Project Guidelines

> This file is maintained by AI to preserve project context and track progress. Update it as the project evolves.

---

## 1. Project Overview

**Name:** FlowForge Client  
**Type:** Frontend Web Application (SPA / SSR hybrid)  
**Version:** 1.0.0  
**Package Manager:** pnpm 10.x

**Summary:**  
FlowForge Client is the frontend interface for the FlowForge workflow automation platform. It allows users to register, log in, manage workflow definitions, trigger executions, and observe real-time step-level status via a reactive, polling-based dashboard.

---

## 2. Architecture

| Attribute  | Detail                                                            |
| ---------- | ----------------------------------------------------------------- |
| Style      | Feature-based component hierarchy                                 |
| Rendering  | SSR + CSR hybrid (Next.js App Router)                             |
| State      | Server state via TanStack Query; minimal client state via Zustand |
| API        | REST over HTTPS (FlowForge Server)                                |
| Deployment | Vercel / Cloud Run (containerised)                                |

### High-Level Component Flow

```
Browser
  │
  │ renders
  ▼
┌─────────────────────────────────────────────────┐
│          Next.js 14 (App Router)                │
│  Auth Pages | Dashboard | Workflow Editor       │
│  Execution Monitor | Event Log Viewer           │
└────────────────────┬────────────────────────────┘
                     │
                     │ HTTPS / REST (Axios)
                     ▼
        ┌────────────────────────┐
        │  FlowForge Server      │
        │  (NestJS — Cloud Run)  │
        │                        │
        │  /auth  /workflows     │
        │  /executions           │
        └────────────────────────┘
```

---

## 3. Technology Stack

- **Runtime:** Node.js 20 LTS — consistent with server, required for Next.js build tooling
- **Language:** TypeScript 5 — type safety, better IDE support, shared type discipline with server contracts
- **Framework:** Next.js 14 (App Router) — file-based routing, nested layouts, built-in SSR/CSR control
- **UI Library:** React 18 — concurrent features, Suspense boundaries
- **Styling:** Tailwind CSS — utility-first, no runtime CSS, consistent design tokens
- **API State:** TanStack Query (React Query v5) — server state management, caching, background refetch, polling for execution status
- **HTTP Client:** Axios — interceptor support for JWT injection and 401 auto-logout
- **Client State:** Zustand — minimal global state (auth token, user profile)
- **Form Handling:** React Hook Form + Zod — performant uncontrolled forms with schema-based validation
- **Testing:** Vitest + React Testing Library — fast unit tests for hooks and components; Playwright for E2E
- **CI/CD:** GitHub Actions — lint + type-check + test + build on every PR

---

## 4. Core Features

### 4.1 Authentication

- Register/login with email + password and verification-aware flow
- Public auth journey includes verify-email, resend verification, forgot password, reset password
- JWT stored in `localStorage` (access token)
- Axios request interceptor attaches `Authorization: Bearer <token>` on every protected request
- Axios response interceptor catches 401 on protected endpoints → clears token → redirects to `/login`
- Public auth endpoints (`/auth/login`, `/auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`) surface inline errors without forced redirect
- Route guard: protected routes redirect unauthenticated users to `/login`
- Root route (`/`) resolves auth state after Zustand hydration, then redirects to `/workflows` or `/login`
- Register success shows verification guidance; login success redirects to `/workflows`

### 4.2 Workflow List & Management

- Dashboard lists all workflows owned by the current user
- Create workflow → form with name, description, steps (ordered list), edges (DAG adjacency)
- Edit workflow → pre-populated form, PATCH to server
- Delete workflow → confirmation modal → DELETE to server
- Status badge (`active` / `inactive`) displayed inline

### 4.3 Workflow Execution

- Trigger execution button on workflow detail page
- Execution history list per workflow
- Global execution list (`/executions`) with status filter

### 4.4 Execution Monitor

- Real-time execution detail page polling `GET /executions/:id` every 3 seconds while status is `pending | running | compensating`
- Step-level status table showing each step's current state, attempt count, input/output snapshot
- Polling stops automatically once execution reaches a terminal state (`completed | failed | cancelled`)

### 4.5 Event Log Viewer

- `GET /executions/:id/events` rendered as an immutable, chronological timeline
- Event query supports server-side filters and cursor pagination (`type`, `step_id`, `occurred_from`, `occurred_to`, `cursor`, `limit`)
- Each event card displays type, step ID, payload, and timestamp
- Auto-scroll to latest event while execution is in progress

### 4.6 Operations & Governance

- Global execution dashboard consumes `GET /executions/summary` for status counters
- Execution detail supports legal hold lifecycle:
  - `GET /executions/:id/legal-hold` for current legal-hold state
  - `POST /executions/:id/legal-hold` to place hold
  - `DELETE /executions/:id/legal-hold` to release hold
- Execution detail header includes a legal-hold badge for quick state visibility

---

## 5. Folder Structure (Next.js App Router)

```
src/
├── app/                               # Next.js App Router (file-based routing)
│   ├── (auth)/                        # Auth route group (no dashboard layout)
│   │   ├── login/
│   │   │   └── page.tsx               # Login form
│   │   └── register/
│   │       └── page.tsx               # Register form
│   │
│   ├── (dashboard)/                   # Protected route group
│   │   ├── layout.tsx                 # Sidebar + header shell
│   │   ├── page.tsx                   # Dashboard home (redirect to /workflows)
│   │   │
│   │   ├── workflows/
│   │   │   ├── page.tsx               # Workflow list
│   │   │   ├── new/
│   │   │   │   └── page.tsx           # Create workflow form
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # Workflow detail + edit form
│   │   │       └── executions/
│   │   │           └── page.tsx       # Execution history for this workflow
│   │   │
│   │   └── executions/
│   │       ├── page.tsx               # All executions list
│   │       └── [id]/
│   │           └── page.tsx           # Execution detail + event log
│   │
│   ├── layout.tsx                     # Root layout (QueryClientProvider, fonts)
│   ├── page.tsx                       # Root redirect → /workflows or /login
│   └── globals.css                    # Tailwind base + global styles
│
├── components/                        # Reusable UI components
│   ├── primary/                       # Generic primitives
│   │
│   ├── ui/                            # Extra primitives
│   │   ├── Badge.tsx
│   │   ├── Spinner.tsx
│   │   └── Table.tsx
│   │
│   ├── layout/                        # Structural components
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── AuthGuard.tsx              # Client-side route protection
│   │
│   ├── workflow/                      # Workflow-domain components
│   │   ├── WorkflowCard.tsx
│   │   └── DeleteWorkflowModal.tsx
│   │
│   └── execution/                     # Execution-domain components
│       ├── ExecutionStatusBadge.tsx
│       ├── StepStatusTable.tsx        # Per-step status grid
│       └── EventTimeline.tsx          # Immutable event log timeline
│
├── lib/                               # Utilities and API clients
│   ├── api/                           # Axios instance + typed API functions
│   │   ├── client.ts                  # Axios instance + interceptors
│   │   ├── auth.api.ts                # register(), login()
│   │   ├── workflows.api.ts           # list(), get(), create(), update(), delete(), trigger()
│   │   └── executions.api.ts          # list(), get(), getEvents(), cancel()
│   │
│   └── utils/
│       └── cn.ts                      # clsx + tailwind-merge helper
│
├── hooks/                             # TanStack Query hooks (one file per domain)
│   ├── useAuth.ts                     # useMutation for login/register
│   ├── useWorkflows.ts                # useQuery (list, detail) + useMutation (CRUD, trigger)
│   └── useExecutions.ts               # useQuery (list, detail, events) + polling logic
│
├── store/                             # Zustand global state
│   └── auth.store.ts                  # token, user, setToken(), clearToken()
│
└── types/                             # TypeScript types mirroring server contracts
    ├── auth.types.ts
    ├── workflow.types.ts
    └── execution.types.ts
```

### Design Decisions

- **Route groups** `(auth)` and `(dashboard)`: isolate layouts — auth pages render a bare centred card, dashboard pages render a full sidebar shell.
- **`lib/api/`** (separate from hooks): raw API functions are plain async functions returning typed data. TanStack Query hooks compose over them — keeps API logic testable independently of React.
- **`hooks/useExecutions.ts`**: `refetchInterval` is set dynamically — active while status is `pending | running | compensating`, `false` otherwise. This avoids unnecessary polling in terminal states.
- **`store/auth.store.ts`**: Zustand is used only for the auth token and user profile. All server state (workflows, executions) lives exclusively in TanStack Query cache — no duplication.
- **`components/ui/`**: headless primitives styled with Tailwind. No third-party component library dependency, keeping the bundle lean and style control complete.
- **`components/layout/AuthGuard.tsx`**: dashboard route group is guarded client-side after persisted auth state hydration to prevent unauthorized flashes.
- **`lib/api/auth.api.ts`**: server returns `access_token` (snake_case); API layer normalizes to `{ accessToken }` for frontend hooks/store.
- **`app/globals.css`**: design tokens were updated from pink palette to FlowForge blue/slate palette while preserving variable names for compatibility.

---

## 6. API Contract (consumed from FlowForge Server)

### Base URL

`NEXT_PUBLIC_API_URL` (e.g., `http://localhost:3000` in development)

### Auth

| Method | Path                      | Request Body          | Response                                |
| ------ | ------------------------- | --------------------- | --------------------------------------- |
| POST   | /auth/register            | `{ email, password }` | verification-oriented register response |
| POST   | /auth/login               | `{ email, password }` | `{ access_token }`                      |
| POST   | /auth/verify-email        | `{ token }`           | success message                         |
| POST   | /auth/resend-verification | `{ email }`           | success message                         |
| POST   | /auth/forgot-password     | `{ email }`           | success message                         |
| POST   | /auth/reset-password      | `{ token, password }` | success message                         |

> Frontend API adapter (`lib/api/auth.api.ts`) maps `access_token` → `accessToken` before returning to hooks/components.

### Workflows

| Method | Path                   | Auth | Description           |
| ------ | ---------------------- | ---- | --------------------- |
| GET    | /workflows             | JWT  | List user's workflows |
| POST   | /workflows             | JWT  | Create workflow       |
| GET    | /workflows/:id         | JWT  | Get workflow detail   |
| PATCH  | /workflows/:id         | JWT  | Update workflow       |
| DELETE | /workflows/:id         | JWT  | Delete workflow       |
| POST   | /workflows/:id/trigger | JWT  | Trigger execution     |

### Executions

| Method | Path                       | Auth | Description                                                         |
| ------ | -------------------------- | ---- | ------------------------------------------------------------------- |
| GET    | /executions                | JWT  | List executions with validated filters + cursor pagination          |
| GET    | /executions/summary        | JWT  | Aggregate execution status summary                                  |
| GET    | /executions/:id            | JWT  | Get execution + step status                                         |
| POST   | /executions/:id/cancel     | JWT  | Cancel running execution                                            |
| GET    | /executions/:id/events     | JWT  | Get immutable event log with filters + cursor pagination            |
| GET    | /executions/:id/legal-hold | JWT  | Get legal-hold state (`active`, `reason`, `set_by_owner_id`, dates) |
| POST   | /executions/:id/legal-hold | JWT  | Place legal hold                                                    |
| DELETE | /executions/:id/legal-hold | JWT  | Release legal hold                                                  |

### Key TypeScript Types (mirroring server contracts)

```typescript
// execution.types.ts
type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'compensating';

type StepStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped';

type EventType =
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.cancelled'
  | 'execution.compensating'
  | 'step.queued'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.skipped'
  | 'step.retrying'
  | 'step.compensation.started'
  | 'step.compensation.completed'
  | 'step.compensation.failed';

export const ACTIVE_STATUSES: ExecutionStatus[] = ['pending', 'running', 'compensating'];
```

---

## 7. State Management Strategy

| State Type             | Tool            | Location                 |
| ---------------------- | --------------- | ------------------------ |
| Auth token / user      | Zustand         | `store/auth.store.ts`    |
| Workflow list / detail | TanStack Query  | `hooks/useWorkflows.ts`  |
| Execution list/detail  | TanStack Query  | `hooks/useExecutions.ts` |
| Event log              | TanStack Query  | `hooks/useExecutions.ts` |
| Form state             | React Hook Form | inside form components   |
| UI state (modals etc.) | `useState`      | inside components        |

**Polling strategy:**

```typescript
// hooks/useExecutions.ts
const ACTIVE_STATUSES = ['pending', 'running', 'compensating'];

export function useExecution(id: string) {
  return useQuery({
    queryKey: ['executions', id],
    queryFn: () => executionsApi.get(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_STATUSES.includes(status) ? 3000 : false;
    },
  });
}
```

---

## 8. Important Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Start production server (after build)
pnpm run start

# Type-check (no emit)
pnpm run type-check

# Lint
pnpm run lint

# Run unit tests (Vitest)
pnpm run test

# Run unit tests in watch mode
pnpm run test:watch

# Run E2E tests (Playwright)
pnpm run test:e2e

# Format
pnpm run format
```

---

## 9. Environment Variables

| Variable              | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | FlowForge Server base URL (e.g. `http://localhost:3000`) |
| `NODE_ENV`            | `development` / `production`                             |

> All variables exposed to the browser **must** be prefixed with `NEXT_PUBLIC_`.  
> Server-only variables (e.g., secrets) must never carry the `NEXT_PUBLIC_` prefix.

---

## 10. Development Workflow

1. **Feature branch** off `main` → `feat/<name>`
2. Implement feature inside the appropriate page / component / hook
3. Write unit tests for hooks and utility functions alongside the source file
4. Run `pnpm run type-check && pnpm run lint && pnpm run test` — all must pass before PR
5. Open PR → GitHub Actions runs type-check + lint + test + build
6. Merge to `main` → deployment triggered (Vercel or Cloud Run)

---

## 11. Coding Conventions

- **File naming:** `PascalCase` for components (`WorkflowCard.tsx`), `camelCase` for everything else (`useWorkflows.ts`, `client.ts`)
- **Component exports:** named exports only — no `export default` (easier to refactor + grep)
- **Query keys:** always an array: `['workflows']`, `['workflows', id]`, `['executions', id, 'events']`
- **Axios errors:** unwrap inside `lib/api/` — API functions throw plain `Error` objects with a human-readable message; hooks and components never inspect Axios internals
- **Tailwind:** no inline `style` props — all styling via Tailwind class names; use `cn()` utility for conditional classes
- **Forms:** all forms use React Hook Form + Zod schema; never use unvalidated `useState` for form fields

---

## 12. Progress Tracker

| Area                                | Status      | Notes                                                                                                                          |
| ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Project scaffold (Next.js 14)       | Done        | All files created (empty). Configs in place.                                                                                   |
| Tailwind CSS + global styles setup  | Done        | v4 via @tailwindcss/postcss + FlowForge blue/slate tokens in `globals.css`                                                     |
| Axios client + interceptors         | Done        | `lib/api/client.ts` — request (JWT) + protected-route 401 redirect, auth-endpoint inline error handling                        |
| Zustand auth store                  | Done        | `store/auth.store.ts` — token persisted to localStorage via `persist` middleware                                               |
| TanStack Query provider setup       | Done        | `app/providers.tsx` (client) wrapped in `app/layout.tsx`                                                                       |
| Auth pages (login / register)       | Done        | Implemented simple forms, inline API error, register→login redirect, login→workflows redirect                                  |
| Dashboard layout (sidebar / header) | Done        | Responsive shell completed with shared `Sidebar` + `Header` in dashboard route group                                           |
| Workflow list page                  | Done        | Implemented list query + loading/error/empty states + responsive cards                                                         |
| Workflow create / edit form         | Done        | Implemented reusable RHF+Zod form with dynamic steps/edges and create/update integration                                       |
| Workflow delete modal               | Done        | Added confirmation modal and wired delete mutation with query invalidation                                                     |
| Execution history page              | Done        | Added workflow-scoped history and global `/executions` list with status filter, refresh, and cancel actions.                   |
| Execution detail + polling          | Done        | Built `/executions/[id]` monitor with conditional 3s polling, cancel action, legal-hold controls, and header legal-hold badge. |
| Event log timeline                  | Done        | Added immutable event timeline rendering with live refresh, expanded event taxonomy support, and paginated response handling.  |
| E2E tests (Playwright)              | Not started |                                                                                                                                |
| CI/CD (GitHub Actions)              | Not started |                                                                                                                                |

---

_Last updated: 2026-03-23 — Guidelines aligned with backend contract for auth verification/reset and executions governance (summary, pagination, legal hold)._
