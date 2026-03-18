import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ExecutionModule } from '../execution/execution.module';
import { Workflow, WorkflowSchema } from '../workflow/workflow.schema';
import { WorkflowSchedulerService } from './workflow-scheduler.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: Workflow.name, schema: WorkflowSchema }]),
    ExecutionModule,
  ],
  providers: [WorkflowSchedulerService],
})
export class SchedulerModule {}
