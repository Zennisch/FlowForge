import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventModule } from '../event/event.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { CompensateService } from './compensate.service';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { Execution, ExecutionSchema } from './execution.schema';
import { StepExecution, StepExecutionSchema } from './step-execution.schema';
import { StepStateService } from './step-state.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Execution.name, schema: ExecutionSchema },
      { name: StepExecution.name, schema: StepExecutionSchema },
    ]),
    WorkflowModule,
    EventModule,
  ],
  controllers: [ExecutionController],
  providers: [ExecutionService, StepStateService, CompensateService],
  exports: [ExecutionService, StepStateService, CompensateService],
})
export class ExecutionModule {}

