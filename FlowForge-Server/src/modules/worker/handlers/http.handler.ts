import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { StepJob } from '../../../shared/interfaces/step-job.interface';

@Injectable()
export class HttpHandler {
  private readonly logger = new Logger(HttpHandler.name);

  async execute(job: StepJob): Promise<Record<string, unknown>> {
    const config = job.stepConfig as unknown as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      timeoutMs?: number;
    };

    this.logger.log(`HTTP ${config.method ?? 'GET'} ${config.url}`);

    const response = await axios.request({
      url: config.url,
      method: (config.method ?? 'GET').toLowerCase(),
      headers: config.headers ?? {},
      data: config.body,
      timeout: config.timeoutMs ?? 30_000,
    });

    return { status: response.status, data: response.data as unknown };
  }
}

