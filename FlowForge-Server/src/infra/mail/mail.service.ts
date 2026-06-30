import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve4 } from 'node:dns/promises';
import { isIP } from 'node:net';
import * as nodemailer from 'nodemailer';
import SMTPTransport = require('nodemailer/lib/smtp-transport');

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly from: string;
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get('SMTP_HOST', 'smtp.gmail.com');
    const port = Number(this.configService.get('SMTP_PORT', '587'));
    const user = this.configService.getOrThrow<string>('SMTP_USER');
    const pass = this.configService.getOrThrow<string>('SMTP_PASS');
    const forceIPv4 = this.configService.get('SMTP_FORCE_IPV4') === 'true';

    this.from = this.configService.get('MAIL_FROM', user);

    const transportOptions: SMTPTransport.Options = {
      host,
      port,
      secure: port === 465,
      connectionTimeout: Number(
        this.configService.get('SMTP_CONNECTION_TIMEOUT_MS', '30000'),
      ),
      greetingTimeout: Number(
        this.configService.get('SMTP_GREETING_TIMEOUT_MS', '30000'),
      ),
      auth: {
        user,
        pass,
      },
    };

    if (forceIPv4) {
      transportOptions.getSocket = async (options, callback) => {
        const smtpHost = options.host || host;

        if (isIP(smtpHost)) {
          callback(null, {});
          return;
        }

        try {
          const [address] = await resolve4(smtpHost);

          if (!address) {
            callback(new Error(`No IPv4 address found for ${smtpHost}`), null);
            return;
          }

          callback(null, {
            host: address,
            servername: smtpHost,
          });
        } catch (error) {
          callback(error as Error, null);
        }
      };
    }

    this.transporter = nodemailer.createTransport(transportOptions);
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
