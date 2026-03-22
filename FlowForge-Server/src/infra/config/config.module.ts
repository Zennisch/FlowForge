import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

const POSITIVE_INTEGER_ENV_KEYS = [
  'TRIGGER_PAYLOAD_MAX_BYTES',
  'TRIGGER_RATE_LIMIT_WINDOW_SECONDS',
  'TRIGGER_RATE_LIMIT_MAX_REQUESTS',
  'TENANT_MAX_RUNNING_EXECUTIONS',
  'WORKFLOW_MAX_RUNNING_EXECUTIONS',
  'WORKFLOW_MAX_PER_TENANT',
  'WORKFLOW_MAX_STEPS_PER_WORKFLOW',
  'WORKFLOW_MAX_EDGES_PER_WORKFLOW',
  'WORKFLOW_MAX_ACTIVE_SCHEDULE_PER_TENANT',
  'WORKFLOW_MAX_ACTIVE_WEBHOOK_PER_TENANT',
  'WORKFLOW_MAX_DEFINITION_BYTES',
] as const;

type AppEnv = Record<string, unknown>;

export function validateAppEnv(config: AppEnv): AppEnv {
  for (const key of POSITIVE_INTEGER_ENV_KEYS) {
    const rawValue = config[key];

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      continue;
    }

    const parsed = Number(String(rawValue).trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      throw new Error(
        `Invalid env ${key}: expected a positive integer, received '${String(rawValue)}'`,
      );
    }
  }

  const tenantMaxRunning = Number(config.TENANT_MAX_RUNNING_EXECUTIONS);
  const workflowMaxRunning = Number(config.WORKFLOW_MAX_RUNNING_EXECUTIONS);
  if (
    Number.isFinite(tenantMaxRunning) &&
    Number.isFinite(workflowMaxRunning) &&
    workflowMaxRunning > tenantMaxRunning
  ) {
    throw new Error(
      'Invalid env WORKFLOW_MAX_RUNNING_EXECUTIONS: must be less than or equal to TENANT_MAX_RUNNING_EXECUTIONS',
    );
  }

  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      expandVariables: true,
      validate: validateAppEnv,
    }),
  ],
})
export class AppConfigModule {}

