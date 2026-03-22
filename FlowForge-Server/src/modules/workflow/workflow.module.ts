import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ValidateDagService } from './validate-dag.service';
import { Workflow, WorkflowSchema } from './workflow.schema';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workflow.name, schema: WorkflowSchema },
    ]),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, ValidateDagService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
