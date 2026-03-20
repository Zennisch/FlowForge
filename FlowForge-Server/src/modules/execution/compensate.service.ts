import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventService } from '../event/event.service';
import { Execution, ExecutionDocument } from './execution.schema';
import { StepExecution, StepExecutionDocument } from './step-execution.schema';

@Injectable()
export class CompensateService {
  constructor(
    @InjectModel(Execution.name)
    private readonly executionModel: Model<ExecutionDocument>,
    @InjectModel(StepExecution.name)
    private readonly stepExecutionModel: Model<StepExecutionDocument>,
    private readonly eventService: EventService,
  ) {}

  async compensate(
    executionId: string,
    reason: 'compensation' | 'timeout' = 'compensation',
  ): Promise<ExecutionDocument> {
    const execution = await this.executionModel.findById(executionId).exec();
    if (!execution) throw new NotFoundException('Execution not found');

    const stepFailureMessage =
      reason === 'timeout' ? 'Execution timed out' : 'Execution compensated';

    execution.status = 'compensating';
    await execution.save();

    await this.eventService.append(executionId, 'execution.compensating');

    await this.stepExecutionModel
      .updateMany(
        {
          execution_id: new Types.ObjectId(executionId),
          status: { $in: ['queued', 'running'] },
        },
        {
          $set: {
            status: 'failed',
            error: stepFailureMessage,
            completed_at: new Date(),
          },
        },
      )
      .exec();

    execution.status = 'failed';
    execution.completed_at = new Date();
    await execution.save();

    await this.eventService.append(executionId, 'execution.failed', { reason });

    return execution;
  }
}

