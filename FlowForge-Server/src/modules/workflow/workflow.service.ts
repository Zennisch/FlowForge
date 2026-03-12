import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { ValidateDagService } from './validate-dag.service';
import { Workflow, WorkflowDocument } from './workflow.schema';

@Injectable()
export class WorkflowService {
  constructor(
    @InjectModel(Workflow.name)
    private readonly workflowModel: Model<WorkflowDocument>,
    private readonly validateDagService: ValidateDagService,
  ) {}

  findAll(ownerId: string): Promise<WorkflowDocument[]> {
    return this.workflowModel
      .find({ owner_id: new Types.ObjectId(ownerId) })
      .exec();
  }

  async findOne(id: string, ownerId: string): Promise<WorkflowDocument> {
    const workflow = await this.workflowModel.findById(id).exec();
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }
    if (workflow.owner_id.toString() !== ownerId) {
      throw new ForbiddenException('Access denied');
    }
    return workflow;
  }

  async create(
    ownerId: string,
    dto: CreateWorkflowDto,
  ): Promise<WorkflowDocument> {
    const steps = dto.steps ?? [];
    const edges = dto.edges ?? [];
    this.validateDagService.validate(steps, edges);

    const workflow = new this.workflowModel({
      ...dto,
      owner_id: new Types.ObjectId(ownerId),
    });
    return workflow.save();
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateWorkflowDto,
  ): Promise<WorkflowDocument> {
    const workflow = await this.findOne(id, ownerId);

    const steps = dto.steps ?? workflow.steps;
    const edges = dto.edges ?? workflow.edges;
    this.validateDagService.validate(steps, edges);

    Object.assign(workflow, dto);
    return workflow.save();
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this.findOne(id, ownerId);
    await this.workflowModel.findByIdAndDelete(id).exec();
  }
}

