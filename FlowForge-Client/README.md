# FlowForge Client

Next.js frontend for FlowForge. The client provides authentication screens,
workflow management, a visual workflow builder, execution history, execution
detail monitoring, event timelines, and legal-hold controls.

## Stack

- Next.js 14 App Router
- React 18 and TypeScript
- TanStack Query for server state
- Zustand for persisted auth state
- React Hook Form and Zod for forms
- React Flow plus CodeMirror/Monaco editor utilities for workflow editing
- Vitest, Testing Library, and Playwright for testing

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/app/` | App Router pages, route groups, layouts, and providers. |
| `src/components/auth/` | Auth page shells and form presentation components. |
| `src/components/layout/` | Dashboard shell, sidebar, header, and auth guard. |
| `src/components/workflow/` | Workflow list, actions, trigger panel, and builder UI. |
| `src/components/execution/` | Execution badges, visual trace, and step timeline UI. |
| `src/lib/api/` | Axios client and typed API adapters. |
| `src/hooks/` | TanStack Query hooks for auth-adjacent flows, workflows, and executions. |
| `src/store/` | Zustand auth store. |
| `src/types/` | Client-side contract types mirroring backend responses. |

## Environment

Create `.env` from `.env.tmp`:

```bash
cp .env.tmp .env
```

Required variables:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | FlowForge Server base URL, for example `http://localhost:3000`. |
| `PORT` | Optional Next.js dev/start port. |

## Install

```bash
pnpm install
```

## Development

```bash
pnpm run dev
```

The app uses `dotenv -e .env -- next dev`, so local values are loaded from the
project `.env` file.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm run dev` | Start the Next.js dev server. |
| `pnpm run build` | Build the production app. |
| `pnpm run start` | Start a built Next.js app with `.env` loaded. |
| `pnpm run type-check` | Run `tsc --noEmit`. |
| `pnpm run lint` | Run Next.js linting. |
| `pnpm test` | Run Vitest tests. |
| `pnpm run test:watch` | Run Vitest in watch mode. |
| `pnpm run test:e2e` | Run Playwright tests. |
| `pnpm run format` | Format the project with Prettier. |

## Routes

| Route | Purpose |
| --- | --- |
| `/login` | Login with email and password. |
| `/register` | Create an account and start email verification. |
| `/verify-email` | Verify an account with a one-time token. |
| `/resend-verification` | Request a new verification email. |
| `/forgot-password` | Request a password reset email. |
| `/reset-password` | Reset password with a one-time token. |
| `/workflows` | List workflows and summary insights. |
| `/workflows/new` | Create a workflow. |
| `/workflows/[id]` | Edit workflow metadata, trigger, steps, and edges. |
| `/workflows/[id]/executions` | View executions scoped to one workflow. |
| `/executions` | View global execution history. |
| `/executions/[id]` | Monitor execution detail, step state, events, cancellation, and legal hold. |

## API Contract

The Axios client is configured in `src/lib/api/client.ts` with:

- `baseURL: process.env.NEXT_PUBLIC_API_URL`
- `Content-Type: application/json`
- Bearer JWT injection from the Zustand auth store
- 401 handling that clears credentials and redirects protected requests to login

Primary adapters:

- `authApi`: `/auth/register`, `/auth/login`, `/auth/verify-email`,
  `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password`
- `workflowsApi`: workflow CRUD, `/workflows/insights`,
  `/workflows/:id/trigger`
- `executionsApi`: execution list/detail, summary, events, cancel, and legal hold

The client normalizes both snake_case and camelCase response fields where the
backend contract has evolved.

## Testing Notes

Vitest uses a `jsdom` environment with `@` mapped to `src`. Playwright is
configured to launch `pnpm run dev` and test against `http://localhost:3000`.
Run the backend separately when e2e tests require API calls.
