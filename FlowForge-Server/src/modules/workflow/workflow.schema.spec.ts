import { model, Types } from 'mongoose';
import { Workflow, WorkflowSchema } from './workflow.schema';

describe('WorkflowSchema', () => {
  const buildModel = () => {
    const modelName = `WorkflowSchemaValidation_${Date.now()}_${Math.random()}`;
    return model<Workflow>(modelName, WorkflowSchema);
  };

  it('allows valid step configs at persistence level', async () => {
    const WorkflowModel = buildModel();

    const doc = new WorkflowModel({
      owner_id: new Types.ObjectId(),
      name: 'Valid Workflow',
      trigger: { type: 'manual', config: {} },
      steps: [
        {
          id: 'http-step',
          type: 'http',
          config: { url: 'https://example.com', method: 'POST' },
        },
        {
          id: 'branch-step',
          type: 'branch',
          config: {
            field: 'payload.status',
            cases: [{ value: 'ok', next: 'next-step' }],
            default: 'next-step',
          },
        },
      ],
      edges: [],
    });

    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it('rejects invalid http step config at persistence level', async () => {
    const WorkflowModel = buildModel();

    const doc = new WorkflowModel({
      owner_id: new Types.ObjectId(),
      name: 'Invalid HTTP Workflow',
      trigger: { type: 'manual', config: {} },
      steps: [{ id: 'http-step', type: 'http', config: { method: 'GET' } }],
      edges: [],
    });

    await expect(doc.validate()).rejects.toThrow(
      "Step 'http-step' http requires config.url",
    );
  });

  it('rejects invalid branch step config at persistence level', async () => {
    const WorkflowModel = buildModel();

    const doc = new WorkflowModel({
      owner_id: new Types.ObjectId(),
      name: 'Invalid Branch Workflow',
      trigger: { type: 'manual', config: {} },
      steps: [{ id: 'branch-step', type: 'branch', config: {} }],
      edges: [],
    });

    await expect(doc.validate()).rejects.toThrow(
      "Step 'branch-step' branch requires config.field",
    );
  });
});
