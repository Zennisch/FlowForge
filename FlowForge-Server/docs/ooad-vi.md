# FlowForge Server - OOAD (Object-Oriented Analysis & Design)

## 1. Mục tiêu tài liệu

Tài liệu này mô tả phân tích và thiết kế hướng đối tượng cho hệ thống FlowForge Server dựa trên:

- Yêu cầu nghiệp vụ trong `guidelines.md`
- Các schema Mongoose và service/controller đang tồn tại trong codebase

Mục tiêu:

- Chuẩn hóa mô hình domain, use case, state transition
- Làm rõ trách nhiệm giữa các module (Auth, Workflow, Execution, Event, Worker)
- Tạo cơ sở để mở rộng (schedule trigger, webhook trigger, scale worker)

## 2. Phạm vi hệ thống

FlowForge là một backend workflow engine theo mô hình modular monolith, xử lý bất đồng bộ qua Google Pub/Sub.

Hệ thống hiện tại đã hoàn thành:

- Auth đăng ký/đăng nhập + JWT
- CRUD workflow + validate DAG
- Trigger execution + theo dõi execution
- Worker xử lý step (http/transform/store/branch)
- Event router điều phối saga, retry với backoff, và compensation

## 3. Kiến trúc tổng quan

### 3.1 Kiến trúc logic

Hệ thống chia thành các bounded modules:

- Auth module: xác thực và cấp JWT
- Users module: quản lý user entity và password hashing
- Workflow module: CRUD workflow và kiểm tra DAG
- Execution module: vòng đời execution, step state, cancel, compensation
- Event module: immutable event log + event router (orchestrator)
- Worker module: consume job và execute step theo strategy
- Infra module: Config, MongoDB, Pub/Sub provider
- Shared: interfaces và utility (StepJob, StepResult, computeBackoffMs)

### 3.2 Kiến trúc runtime

- API layer nhận request REST
- Orchestrator tạo execution + phát sinh step job đầu tiên
- Worker nhận job từ `workflow-jobs`, execute, publish result sang `workflow-events`
- EventRouter consume result, cập nhật state, retry/compensate/dispatch step tiếp theo
- MongoDB lưu current state (`workflow_executions`, `step_executions`) + audit log (`execution_events`)

## 4. Use Case Analysis

### 4.1 Actors

- End User (đã đăng nhập): tạo workflow, trigger workflow, xem execution/event
- Worker Process: xử lý step jobs
- Orchestrator Process (EventRouter): quyết định luồng chạy tiếp theo

### 4.2 Use cases chính

1. Đăng ký tài khoản
2. Đăng nhập nhận access token
3. Tạo workflow (steps + edges)
4. Cập nhật workflow
5. Trigger workflow execution
6. Theo dõi execution status
7. Lấy immutable event log của execution
8. Hủy execution đang chạy

### 4.3 Use case: Trigger workflow

Preconditions:

- User hợp lệ (JWT)
- Workflow tồn tại và thuộc owner
- Workflow DAG hợp lệ (đảm bảo từ lúc create/update)

Main flow:

1. API nhận `POST /workflows/:workflowId/trigger`
2. `ExecutionService.trigger` tạo bản ghi `Execution` status `running`
3. Tạo `StepExecution` status `queued` cho từng step
4. Ghi sự kiện `execution.started`
5. Tìm entry steps (không có incoming edge)
6. Ghi `step.queued` và publish `StepJob` lên topic jobs

Alternative:

- Nếu workflow không có step: execution chuyển ngay `completed` + event `execution.completed`
- Nếu `idempotency_key` bị trùng: trả `409 Conflict`

Postconditions:

- Execution được tạo
- Job đầu tiên được đưa vào queue
- Event log có dấu vết khởi động

## 5. Domain Model (Analysis)

### 5.1 Entity và Value Object

1. User (Entity)
- identity: `_id`
- attrs: `email`, `password`, timestamps

2. Workflow (Entity)
- identity: `_id`
- attrs: `owner_id`, `name`, `description`, `status`, `trigger`, `steps`, `edges`
- gồm các value object:
	- WorkflowStep (`id`, `type`, `config`, `retry`)
	- WorkflowEdge (`from`, `to`, `condition?`)
	- RetryPolicy (`maxAttempts`, `backoff`)
	- WorkflowTrigger (`type`, `config`)

3. Execution (Entity)
- identity: `_id`
- attrs: `workflow_id`, `owner_id`, `status`, `trigger_type`, `trigger_payload`, `context`, `idempotency_key`, `started_at`, `completed_at`

4. StepExecution (Entity)
- identity: `_id`
- attrs: `execution_id`, `step_id`, `status`, `attempt`, `input`, `output`, `error`, `started_at`, `completed_at`

5. ExecutionEvent (Entity immutable)
- identity: `_id`
- attrs: `execution_id`, `step_id|null`, `type`, `payload`, `occurred_at`

### 5.2 Quan hệ

- User 1..* Workflow
- User 1..* Execution
- Workflow 1..* Execution
- Execution 1..* StepExecution
- Execution 1..* ExecutionEvent
- WorkflowStep liên kết qua WorkflowEdge để tạo DAG

### 5.3 Invariants nghiệp vụ

1. Mọi `WorkflowStep.id` phải unique trong workflow
2. Mọi edge (`from`, `to`) phải tham chiếu đến step tồn tại
3. Graph workflow phải acyclic (DAG)
4. User chỉ được thao tác resource của chính mình (owner check)
5. `idempotency_key` unique (sparse) trên `Execution`
6. Event log append-only, không update/delete

## 6. Static Design (Class-level)

### 6.1 Control classes (Application Services)

- `AuthService`
	- `register`, `login`
	- phối hợp `UsersService` + `JwtService` + bcrypt compare

- `WorkflowService`
	- CRUD workflow theo owner
	- gọi `ValidateDagService` trước create/update

- `ExecutionService`
	- trigger execution
	- list/find/cancel execution
	- truy vấn event log
	- publish entry jobs

- `StepStateService`
	- `markRunning`, `markCompleted`, `markFailed`
	- đồng bộ status StepExecution + ghi event

- `CompensateService`
	- chuyển execution sang `compensating`
	- đánh dấu queued/running steps thành failed
	- kết thúc execution với `failed`

- `EventRouterService`
	- consume `StepResult`
	- xử lý completed/failed
	- retry theo retry policy + backoff
	- dispatch next steps / completion / compensation

- `StepExecutorService`
	- strategy dispatcher theo `stepConfig.type`

### 6.2 Boundary classes (Controllers)

- `AuthController`
	- `POST /auth/register`
	- `POST /auth/login`

- `WorkflowController` (JWT guard)
	- `GET /workflows`
	- `GET /workflows/:id`
	- `POST /workflows`
	- `PATCH /workflows/:id`
	- `DELETE /workflows/:id`

- `ExecutionController` (JWT guard)
	- `POST /workflows/:workflowId/trigger`
	- `GET /executions`
	- `GET /executions/:id`
	- `POST /executions/:id/cancel`
	- `GET /executions/:id/events`

### 6.3 Entity/Persistence classes

- Mongoose schemas: `User`, `Workflow`, `Execution`, `StepExecution`, `ExecutionEvent`
- Repository style sử dụng `Model<T>` của Mongoose thông qua DI

### 6.4 Strategy classes cho step execution

- `HttpHandler`: gọi HTTP bằng axios, trả về `{status, data}`
- `TransformHandler`: map dữ liệu từ context theo dot-path
- `StoreHandler`: trả về dữ liệu literal từ config
- `BranchHandler`: trả về `_branch_next` dựa vào so khớp `cases`/`default`

## 7. Dynamic Design (Sequence)

### 7.1 Sequence: Trigger -> Completed

1. Client -> ExecutionController: trigger workflow
2. ExecutionController -> ExecutionService.trigger
3. ExecutionService:
	 - lấy workflow
	 - tạo execution + step executions
	 - append `execution.started`
	 - publish entry `StepJob`
4. ConsumerService nhận job:
	 - mark step running
	 - execute by StepExecutorService
	 - publish `StepResult(completed)`
5. EventRouterService nhận result:
	 - mark step completed
	 - merge output vào execution.context
	 - tìm out-edges
	 - publish jobs tiếp theo hoặc đóng execution
6. Nếu không còn edge: append `execution.completed`

### 7.2 Sequence: Step failed + retry

1. Worker execute step lỗi -> publish `StepResult(failed)`
2. EventRouterService:
	 - đọc retry policy (`maxAttempts`, `backoff`)
	 - nếu chưa vượt ngưỡng: append `step.retrying`
	 - delay theo `computeBackoffMs`
	 - set lại StepExecution sang `queued`, tăng `attempt`
	 - republish StepJob

### 7.3 Sequence: Step failed + exhausted -> compensation

1. EventRouterService nhận failed result và đã hết số lần retry
2. `StepStateService.markFailed`
3. `CompensateService.compensate`:
	 - execution -> `compensating` + event
	 - update queued/running steps -> failed
	 - execution -> `failed` + `completed_at`
	 - append `execution.failed` với lý do compensation

## 8. State Machine Design

### 8.1 Execution state machine

States:

- `pending` (có trong schema, hiện trigger tạo thẳng `running`)
- `running`
- `completed`
- `cancelled`
- `compensating`
- `failed`

Transitions:

- trigger: `pending/running` logic thực tế hiện bắt đầu ở `running`
- running -> completed (tất cả luồng đã xong)
- running -> cancelled (user cancel)
- running -> compensating (step fail hết retry)
- compensating -> failed

### 8.2 StepExecution state machine

States: `queued -> running -> completed`

Nhánh lỗi:

- `running -> failed` (hết retry)
- `running -> queued` (retry cycle, tăng attempt)
- `queued/running -> failed` (khi compensation)

## 9. Data Design và Mapping MongoDB

### 9.1 Collection `users`

- Email unique + lowercase
- Password đã hash bcrypt

### 9.2 Collection `workflows`

- Embedded subdocuments: trigger, steps, edges
- Step type enum: `http | transform | store | branch`
- Retry policy gắn từng step

### 9.3 Collection `workflow_executions`

- Snapshot mức cao của 1 lần run
- `context` là shared mutable state được merge output từng step
- `idempotency_key` unique sparse hỗ trợ dedup trigger

### 9.4 Collection `step_executions`

- Snapshot cấp step cho 1 execution
- retry update in-place trên 1 record (không tạo bản ghi mới)

### 9.5 Collection `execution_events`

- Audit trail immutable
- Ghi tất cả state transition quan trọng của execution và step

## 10. API Design notes

### 10.1 Security & ownership

- Tất cả endpoint workflow/execution đều qua JWT guard
- Service layer xác thực owner (`owner_id`) trước khi tra/ghi dữ liệu

### 10.2 Validation

- DTO validation bằng `class-validator`
- Workflow graph validation bằng `ValidateDagService` (duplicate id, unknown edge refs, cycle)

### 10.3 Error semantics

- `401 Unauthorized`: token không hợp lệ / credentials sai
- `403 Forbidden`: truy cập resource không thuộc owner
- `404 Not Found`: workflow/execution/stepExecution không tồn tại
- `409 Conflict`: idempotency key trùng, cancel execution không hợp lệ state
- `400 Bad Request`: workflow DAG invalid

## 11. Concurrency và Reliability

### 11.1 At-least-once messaging

- Pub/Sub có thể phát lại message
- Thiết kế hiện tại giảm double-dispatch bằng check `StepExecution.status === queued` trước publish next step

### 11.2 Retry model

- Retry theo per-step policy
- Backoff:
	- fixed: 1000ms
	- exponential: $1000 * 2^{attempt}$, giới hạn 30000ms

### 11.3 Consistency model

- Eventual consistency giữa worker và orchestrator
- Source of truth:
	- current state: `Execution` + `StepExecution`
	- audit: `ExecutionEvent`

## 12. Design Patterns đã áp dụng

1. Modular Monolith
2. Saga Orchestration
3. Strategy Pattern cho step handlers
4. Repository-like access qua Mongoose models
5. Event Sourcing light (audit log append-only, không replay full)

## 13. Constraint và trade-off hiện tại

1. Trigger type hiện đã set `manual` trong `ExecutionService.trigger`; webhook/schedule chưa mở rộng runtime flow
2. Context merge đang shallow (`{...old, ...output}`), không deep merge
3. Branch condition hiện support direct equality + `default`, chưa có expression engine
4. Retry delay đang dùng `setTimeout` trong process orchestrator (có thể cần external scheduler nếu scale lớn)

## 14. Mở rộng đề xuất (Design roadmap)

1. Thêm scheduler module cho trigger type `schedule`
2. Thêm webhook inbound verification và mapping payload
3. Bồi dưỡng idempotency toàn luồng (bao gồm publish-side dedup keys)
4. Thêm distributed lock/lease nếu scale orchestrator instance > 1
5. Bổ sung dead-letter handling cho Pub/Sub subscriptions
6. Chuẩn hóa context merge strategy (deep merge hoặc patch semantics)

## 15. Traceability matrix (Yêu cầu -> Thiết kế)

1. JWT auth
	 - AuthService, JwtStrategy, JwtAuthGuard
2. Workflow DAG CRUD
	 - WorkflowService + ValidateDagService + Workflow schema
3. Async execution
	 - ExecutionService + PubSubService + ConsumerService + EventRouterService
4. Retry/backoff
	 - EventRouterService + `computeBackoffMs`
5. Compensation
	 - CompensateService + Execution/StepExecution transitions
6. Event observability
	 - EventService + ExecutionEvent schema + `GET /executions/:id/events`

## 16. Kết luận

Thiết kế hiện tại đạt mục tiêu MVP cho một workflow orchestration engine hướng sự kiện:

- Domain model rõ ràng giữa Workflow definition và Runtime execution
- Luồng orchestration có retry và compensation theo Saga
- Khả năng quan sát tốt nhờ immutable event log

Tài liệu này phản ánh đúng implementation hiện có và có thể dùng làm baseline cho các phase mở rộng tiếp theo (scheduling, webhook, hardening reliability, và scale-out).

