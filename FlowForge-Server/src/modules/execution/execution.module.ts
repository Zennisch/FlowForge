import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PubSubModule } from '../../infra/pubsub/pubsub.provider';
import { EventRouterService } from '../event/event-router.service';
import { EventModule } from '../event/event.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { CompensateService } from './compensate.service';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { Execution, ExecutionSchema } from './execution.schema';
import { ExecutionWatchdogService } from './execution-watchdog.service';
import { StepExecution, StepExecutionSchema } from './step-execution.schema';
import { StepStateService } from './step-state.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Execution.name, schema: ExecutionSchema },
      { name: StepExecution.name, schema: StepExecutionSchema },
    ]),
    WorkflowModule,
    EventModule,
    PubSubModule,
  ],
  controllers: [ExecutionController, WebhookController],
  providers: [
    ExecutionService,
    StepStateService,
    CompensateService,
    EventRouterService,
    ExecutionWatchdogService,
  ],
  exports: [ExecutionService, StepStateService, CompensateService],
})
export class ExecutionModule {}

