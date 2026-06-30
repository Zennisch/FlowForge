import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly from: string;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    this.from = this.configService.getOrThrow<string>('MAIL_FROM');
    this.httpClient = axios.create({
      baseURL: 'https://api.resend.com',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: Number(this.configService.get('MAIL_HTTP_TIMEOUT_MS', '30000')),
    });
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    await this.httpClient.post('/emails', {
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
