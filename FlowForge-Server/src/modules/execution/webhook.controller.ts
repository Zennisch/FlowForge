import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ExecutionService } from './execution.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post(':userId/:path')
  @HttpCode(HttpStatus.CREATED)
  triggerWebhook(
    @Param('userId') userId: string,
    @Param('path') path: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.executionService.triggerByWebhook(userId, path, {
      body: this.normalizeBody(body),
      query: req.query as Record<string, unknown>,
      headers: req.headers as Record<string, unknown>,
      webhook: {
        user_id: userId,
        path,
        received_at: new Date().toISOString(),
      },
    });
  }

  private normalizeBody(body: unknown): Record<string, unknown> {
    if (!body) {
      return {};
    }

    if (typeof body === 'object' && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }

    return { value: body };
  }
}
