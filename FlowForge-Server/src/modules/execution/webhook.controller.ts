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
    const normalizedBody = this.normalizeBody(body);
    const providedSecret = this.extractProvidedSecret(req, normalizedBody);
    const sanitizedBody = this.removeSecretFromBody(normalizedBody);

    return this.executionService.triggerByWebhook(userId, path, {
      body: sanitizedBody,
      query: req.query as Record<string, unknown>,
      headers: req.headers as Record<string, unknown>,
      webhook: {
        user_id: userId,
        path,
        received_at: new Date().toISOString(),
      },
    }, providedSecret);
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

  private extractProvidedSecret(
    req: Request,
    body: Record<string, unknown>,
  ): string | undefined {
    const headerSecret = req.headers['x-webhook-secret'];
    if (typeof headerSecret === 'string' && headerSecret.trim().length > 0) {
      return headerSecret;
    }

    const bodySecret = body.secret;
    if (typeof bodySecret === 'string' && bodySecret.trim().length > 0) {
      return bodySecret;
    }

    return undefined;
  }

  private removeSecretFromBody(
    body: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!Object.prototype.hasOwnProperty.call(body, 'secret')) {
      return body;
    }

    const { secret: _removedSecret, ...rest } = body;
    return rest;
  }
}
