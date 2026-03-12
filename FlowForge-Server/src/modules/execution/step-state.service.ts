import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventService } from '../event/event.service';
import { StepExecution, StepExecutionDocument } from './step-execution.schema';

@Injectable()
export class StepStateService {
  constructor(
    @InjectModel(StepExecution.name)
    private readonly stepExecutionModel: Model<StepExecutionDocument>,
    private readonly eventService: EventService,
  ) {}

  async markRunning(stepExecutionId: string): Promise<StepExecutionDocument> {
    const stepExecution = await this.stepExecutionModel
      .findById(stepExecutionId)
      .exec();
    if (!stepExecution) throw new NotFoundException('StepExecution not found');

    stepExecution.status = 'running';
    stepExecution.started_at = new Date();
    await stepExecution.save();

    await this.eventService.append(
      stepExecution.execution_id.toHexString(),
      'step.started',
      { attempt: stepExecution.attempt },
      stepExecution.step_id,
    );

    return stepExecution;
  }

  async markCompleted(
    stepExecutionId: string,
    output: Record<string, unknown>,
  ): Promise<StepExecutionDocument> {
    const stepExecution = await this.stepExecutionModel
      .findById(stepExecutionId)
      .exec();
    if (!stepExecution) throw new NotFoundException('StepExecution not found');

    stepExecution.status = 'completed';
    stepExecution.output = output;
    stepExecution.completed_at = new Date();
    await stepExecution.save();

    await this.eventService.append(
      stepExecution.execution_id.toHexString(),
      'step.completed',
      { output },
      stepExecution.step_id,
    );

    return stepExecution;
  }

  async markFailed(
    stepExecutionId: string,
    error: string,
  ): Promise<StepExecutionDocument> {
    const stepExecution = await this.stepExecutionModel
      .findById(stepExecutionId)
      .exec();
    if (!stepExecution) throw new NotFoundException('StepExecution not found');

    stepExecution.status = 'failed';
    stepExecution.error = error;
    stepExecution.completed_at = new Date();
    await stepExecution.save();

    await this.eventService.append(
      stepExecution.execution_id.toHexString(),
      'step.failed',
      { error, attempt: stepExecution.attempt },
      stepExecution.step_id,
    );

    return stepExecution;
  }
}

