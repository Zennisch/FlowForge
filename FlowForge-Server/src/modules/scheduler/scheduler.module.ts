import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ExecutionModule } from '../execution/execution.module';
import { Workflow, WorkflowSchema } from '../workflow/workflow.schema';
import { SchedulerLock, SchedulerLockSchema } from './scheduler-lock.schema';
import { WorkflowSchedulerService } from './workflow-scheduler.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Workflow.name, schema: WorkflowSchema },
      { name: SchedulerLock.name, schema: SchedulerLockSchema },
    ]),
    ExecutionModule,
  ],
  providers: [WorkflowSchedulerService],
})
export class SchedulerModule {}
