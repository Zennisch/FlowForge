import { Module } from '@nestjs/common';
import { AppConfigModule } from './infra/config/config.module';
import { DatabaseModule } from './infra/database/mongoose.provider';
import { AuthModule } from './modules/auth/auth.module';
import { EventModule } from './modules/event/event.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { UsersModule } from './modules/users/users.module';
import { WorkerModule } from './modules/worker/worker.module';
import { WorkflowModule } from './modules/workflow/workflow.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    WorkflowModule,
    EventModule,
    ExecutionModule,
    SchedulerModule,
    WorkerModule,
  ],
})
export class AppModule {}
