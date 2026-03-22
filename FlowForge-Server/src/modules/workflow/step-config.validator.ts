import { BadRequestException } from '@nestjs/common';

type StepType = 'http' | 'transform' | 'store' | 'branch';

interface WorkflowStepLike {
  id: string;
  type: StepType;
  config?: Record<string, unknown>;
}

export function validateWorkflowStepConfigs(steps: WorkflowStepLike[]): void {
  for (const step of steps) {
    switch (step.type) {
      case 'http':
        validateHttpStepConfig(step);
        break;
      case 'transform':
        validateTransformStepConfig(step);
        break;
      case 'store':
        validateStoreStepConfig(step);
        break;
      case 'branch':
        validateBranchStepConfig(step);
        break;
      default:
        throw new BadRequestException(
          `Step '${step.id}' has unsupported type '${String(step.type)}'`,
        );
    }
  }
}

function validateHttpStepConfig(step: WorkflowStepLike): void {
  const config = step.config ?? {};
  const url = config.url;

  if (typeof url !== 'string' || url.trim().length === 0) {
    throw new BadRequestException(`Step '${step.id}' http requires config.url`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new BadRequestException(
      `Step '${step.id}' http config.url is invalid`,
    );
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new BadRequestException(
      `Step '${step.id}' http config.url must use http or https`,
    );
  }

  const method = config.method;
  if (method !== undefined) {
    if (typeof method !== 'string') {
      throw new BadRequestException(
        `Step '${step.id}' http config.method must be a string`,
      );
    }

    const normalizedMethod = method.trim().toUpperCase();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
      throw new BadRequestException(
        `Step '${step.id}' http config.method is invalid`,
      );
    }
  }

  const headers = config.headers;
  if (headers !== undefined) {
    if (!isPlainObject(headers)) {
      throw new BadRequestException(
        `Step '${step.id}' http config.headers must be an object`,
      );
    }

    for (const [headerName, headerValue] of Object.entries(headers)) {
      if (typeof headerValue !== 'string') {
        throw new BadRequestException(
          `Step '${step.id}' http header '${headerName}' must be a string`,
        );
      }
    }
  }

  const timeoutMs = config.timeoutMs;
  if (timeoutMs !== undefined) {
    if (
      typeof timeoutMs !== 'number' ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0
    ) {
      throw new BadRequestException(
        `Step '${step.id}' http config.timeoutMs must be a positive number`,
      );
    }
  }
}

function validateTransformStepConfig(step: WorkflowStepLike): void {
  const config = step.config ?? {};
  const mapping = config.mapping;

  if (mapping === undefined) {
    return;
  }

  if (!isPlainObject(mapping)) {
    throw new BadRequestException(
      `Step '${step.id}' transform config.mapping must be an object`,
    );
  }

  for (const [outputKey, sourcePath] of Object.entries(mapping)) {
    if (typeof sourcePath !== 'string' || sourcePath.trim().length === 0) {
      throw new BadRequestException(
        `Step '${step.id}' transform mapping '${outputKey}' must be a non-empty string`,
      );
    }
  }
}

function validateStoreStepConfig(step: WorkflowStepLike): void {
  const config = step.config ?? {};
  const data = config.data;

  if (data !== undefined && !isPlainObject(data)) {
    throw new BadRequestException(
      `Step '${step.id}' store config.data must be an object`,
    );
  }
}

function validateBranchStepConfig(step: WorkflowStepLike): void {
  const config = step.config ?? {};
  const field = config.field;

  if (typeof field !== 'string' || field.trim().length === 0) {
    throw new BadRequestException(
      `Step '${step.id}' branch requires config.field`,
    );
  }

  const cases = config.cases;
  if (cases !== undefined) {
    if (!Array.isArray(cases)) {
      throw new BadRequestException(
        `Step '${step.id}' branch config.cases must be an array`,
      );
    }

    for (let index = 0; index < cases.length; index += 1) {
      const branchCase = cases[index];
      if (!isPlainObject(branchCase)) {
        throw new BadRequestException(
          `Step '${step.id}' branch config.cases[${index}] must be an object`,
        );
      }

      const next = branchCase.next;
      if (typeof next !== 'string' || next.trim().length === 0) {
        throw new BadRequestException(
          `Step '${step.id}' branch config.cases[${index}].next must be a non-empty string`,
        );
      }
    }
  }

  const defaultTarget = config.default;
  if (defaultTarget !== undefined) {
    if (
      typeof defaultTarget !== 'string' ||
      defaultTarget.trim().length === 0
    ) {
      throw new BadRequestException(
        `Step '${step.id}' branch config.default must be a non-empty string`,
      );
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
