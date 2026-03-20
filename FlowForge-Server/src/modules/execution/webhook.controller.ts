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
import { ExecutionService, WebhookSecurityContext } from './execution.service';

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
    const security = this.buildSecurityContext(req, path, providedSecret);

    return this.executionService.triggerByWebhook(userId, path, {
      body: sanitizedBody,
      query: req.query as Record<string, unknown>,
      headers: req.headers as Record<string, unknown>,
      webhook: {
        user_id: userId,
        path,
        received_at: new Date().toISOString(),
      },
    }, security);
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

  private buildSecurityContext(
    req: Request,
    path: string,
    providedSecret?: string,
  ): WebhookSecurityContext {
    return {
      providedSecret,
      signature: this.readHeader(req, 'x-webhook-signature'),
      timestamp: this.readHeader(req, 'x-webhook-timestamp'),
      nonce: this.readHeader(req, 'x-webhook-nonce'),
      method: req.method,
      path,
      ip: this.extractRequestIp(req),
    };
  }

  private readHeader(req: Request, headerName: string): string | undefined {
    const value = req.headers[headerName];
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value) && value.length > 0) {
      return value[0];
    }
    return undefined;
  }

  private extractRequestIp(req: Request): string | undefined {
    const forwardedFor = this.readHeader(req, 'x-forwarded-for');
    if (forwardedFor) {
      const firstHop = forwardedFor.split(',')[0]?.trim();
      if (firstHop) {
        return firstHop;
      }
    }

    return req.ip;
  }
}
