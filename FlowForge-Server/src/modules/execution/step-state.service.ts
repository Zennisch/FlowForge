import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventService } from '../event/event.service';
import { Execution, ExecutionDocument } from './execution.schema';
import { StepExecution, StepExecutionDocument } from './step-execution.schema';

@Injectable()
export class StepStateService {
  constructor(
    @InjectModel(Execution.name)
    private readonly executionModel: Model<ExecutionDocument>,
    @InjectModel(StepExecution.name)
    private readonly stepExecutionModel: Model<StepExecutionDocument>,
    private readonly eventService: EventService,
  ) {}

  async markRunning(stepExecutionId: string): Promise<StepExecutionDocument | null> {
    const stepExecution = await this.stepExecutionModel.findById(stepExecutionId).exec();
    if (!stepExecution) throw new NotFoundException('StepExecution not found');

    const execution = await this.executionModel
      .findById(stepExecution.execution_id)
      .exec();
    if (!execution) throw new NotFoundException('Execution not found');

    if (execution.status !== 'running') {
      return null;
    }

    const startedAt = new Date();
    const updated = await this.stepExecutionModel
      .findOneAndUpdate(
        { _id: stepExecutionId, status: 'queued' },
        { $set: { status: 'running', started_at: startedAt } },
        { new: true },
      )
      .exec();
    if (!updated) {
      return null;
    }

    await this.eventService.append(
      updated.execution_id.toHexString(),
      'step.started',
      { attempt: updated.attempt },
      updated.step_id,
    );

    return updated;
  }

  async markCompleted(
    stepExecutionId: string,
    output: Record<string, unknown>,
  ): Promise<StepExecutionDocument | null> {
    const completedAt = new Date();
    const stepExecution = await this.stepExecutionModel
      .findOneAndUpdate(
        { _id: stepExecutionId, status: 'running' },
        { $set: { status: 'completed', output, completed_at: completedAt } },
        { new: true },
      )
      .exec();
    if (!stepExecution) {
      const existing = await this.stepExecutionModel.findById(stepExecutionId).exec();
      if (!existing) throw new NotFoundException('StepExecution not found');
      return null;
    }

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
  ): Promise<StepExecutionDocument | null> {
    const completedAt = new Date();
    const stepExecution = await this.stepExecutionModel
      .findOneAndUpdate(
        { _id: stepExecutionId, status: 'running' },
        { $set: { status: 'failed', error, completed_at: completedAt } },
        { new: true },
      )
      .exec();
    if (!stepExecution) {
      const existing = await this.stepExecutionModel.findById(stepExecutionId).exec();
      if (!existing) throw new NotFoundException('StepExecution not found');
      return null;
    }

    await this.eventService.append(
      stepExecution.execution_id.toHexString(),
      'step.failed',
      { error, attempt: stepExecution.attempt },
      stepExecution.step_id,
    );

    return stepExecution;
  }
}

