import { validateAppEnv } from './config.module';

describe('validateAppEnv', () => {
  it('accepts empty quota env values (use runtime defaults)', () => {
    expect(() =>
      validateAppEnv({
        TRIGGER_PAYLOAD_MAX_BYTES: '',
        WORKFLOW_MAX_PER_TENANT: undefined,
      }),
    ).not.toThrow();
  });

  it('accepts valid positive integer quota env values', () => {
    expect(() =>
      validateAppEnv({
        TRIGGER_PAYLOAD_MAX_BYTES: '262144',
        TRIGGER_RATE_LIMIT_WINDOW_SECONDS: '60',
        TRIGGER_RATE_LIMIT_MAX_REQUESTS: '120',
        TENANT_MAX_RUNNING_EXECUTIONS: '100',
        WORKFLOW_MAX_RUNNING_EXECUTIONS: '50',
        WORKFLOW_MAX_PER_TENANT: '200',
        WORKFLOW_MAX_STEPS_PER_WORKFLOW: '100',
        WORKFLOW_MAX_EDGES_PER_WORKFLOW: '300',
        WORKFLOW_MAX_ACTIVE_SCHEDULE_PER_TENANT: '50',
        WORKFLOW_MAX_ACTIVE_WEBHOOK_PER_TENANT: '100',
        WORKFLOW_MAX_DEFINITION_BYTES: '262144',
      }),
    ).not.toThrow();
  });

  it('throws when quota env is not a positive integer', () => {
    expect(() =>
      validateAppEnv({
        WORKFLOW_MAX_PER_TENANT: 'abc',
      }),
    ).toThrow(
      "Invalid env WORKFLOW_MAX_PER_TENANT: expected a positive integer, received 'abc'",
    );
  });

  it('throws when quota env is zero or negative', () => {
    expect(() =>
      validateAppEnv({
        WORKFLOW_MAX_STEPS_PER_WORKFLOW: '0',
      }),
    ).toThrow(
      "Invalid env WORKFLOW_MAX_STEPS_PER_WORKFLOW: expected a positive integer, received '0'",
    );

    expect(() =>
      validateAppEnv({
        WORKFLOW_MAX_STEPS_PER_WORKFLOW: '-1',
      }),
    ).toThrow(
      "Invalid env WORKFLOW_MAX_STEPS_PER_WORKFLOW: expected a positive integer, received '-1'",
    );
  });

  it('throws when workflow running quota exceeds tenant running quota', () => {
    expect(() =>
      validateAppEnv({
        TENANT_MAX_RUNNING_EXECUTIONS: '10',
        WORKFLOW_MAX_RUNNING_EXECUTIONS: '11',
      }),
    ).toThrow(
      'Invalid env WORKFLOW_MAX_RUNNING_EXECUTIONS: must be less than or equal to TENANT_MAX_RUNNING_EXECUTIONS',
    );
  });
});
