import { BranchHandler } from './branch.handler';

describe('BranchHandler', () => {
  let handler: BranchHandler;

  beforeEach(() => {
    handler = new BranchHandler();
  });

  it('returns matched next step when case value matches', async () => {
    await expect(
      handler.execute({
        executionId: 'exec-1',
        stepId: 'branch-1',
        stepExecutionId: 'step-exec-1',
        stepConfig: {
          type: 'branch',
          field: 'order.status',
          cases: [{ value: 'approved', next: 'step-approve' }],
        },
        context: { order: { status: 'approved' } },
        attempt: 0,
      }),
    ).resolves.toEqual({ _branch_next: 'step-approve' });
  });

  it('falls back to default when no case matches', async () => {
    await expect(
      handler.execute({
        executionId: 'exec-1',
        stepId: 'branch-1',
        stepExecutionId: 'step-exec-1',
        stepConfig: {
          type: 'branch',
          field: 'order.status',
          cases: [{ value: 'approved', next: 'step-approve' }],
          default: 'step-review',
        },
        context: { order: { status: 'pending' } },
        attempt: 0,
      }),
    ).resolves.toEqual({ _branch_next: 'step-review' });
  });

  it('throws when no case matches and default path is missing', async () => {
    await expect(
      handler.execute({
        executionId: 'exec-1',
        stepId: 'branch-1',
        stepExecutionId: 'step-exec-1',
        stepConfig: {
          type: 'branch',
          field: 'order.status',
          cases: [{ value: 'approved', next: 'step-approve' }],
        },
        context: { order: { status: 'pending' } },
        attempt: 0,
      }),
    ).rejects.toThrow(
      'Branch step "branch-1" has no matching case for field "order.status" and no default path',
    );
  });
});
