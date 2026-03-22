import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { MailService } from '../../infra/mail/mail.service';
import { UsersService } from '../users/users.service';
import {
  AuthToken,
  AuthTokenDocument,
  AuthTokenType,
} from './auth-token.schema';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Injectable()
export class AuthService {
  private readonly verifyTokenTtlMs = 24 * 60 * 60 * 1000;
  private readonly resetTokenTtlMs = 15 * 60 * 1000;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectModel(AuthToken.name)
    private readonly authTokenModel: Model<AuthTokenDocument>,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const user = await this.usersService.create({
      ...dto,
      emailVerified: false,
    });
    const userId = this.toUserId(user._id);

    const token = await this.generateToken(userId, AuthTokenType.VerifyEmail);
    const verifyUrlTemplate = this.configService.getOrThrow<string>(
      'VERIFY_EMAIL_URL_TEMPLATE',
    );
    const verifyUrl = this.buildActionUrl(verifyUrlTemplate, token);

    await this.sendVerificationEmail(user.email, verifyUrl);

    return {
      message:
        'Registration successful. Please verify your email before logging in.',
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const authToken = await this.consumeToken(
      dto.token,
      AuthTokenType.VerifyEmail,
    );
    if (!authToken) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersService.markEmailVerified(authToken.user_id.toString());

    return { message: 'Email verified successfully' };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.email_verified) {
      return {
        message:
          'If the account exists and is unverified, a verification email has been sent.',
      };
    }

    const userId = this.toUserId(user._id);
    const token = await this.generateToken(userId, AuthTokenType.VerifyEmail);
    const verifyUrlTemplate = this.configService.getOrThrow<string>(
      'VERIFY_EMAIL_URL_TEMPLATE',
    );
    const verifyUrl = this.buildActionUrl(verifyUrlTemplate, token);
    await this.sendVerificationEmail(user.email, verifyUrl);

    return {
      message:
        'If the account exists and is unverified, a verification email has been sent.',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return {
        message: 'If the account exists, a password reset email has been sent.',
      };
    }

    const userId = this.toUserId(user._id);
    const token = await this.generateToken(userId, AuthTokenType.ResetPassword);
    const resetUrlTemplate = this.configService.getOrThrow<string>(
      'RESET_PASSWORD_URL_TEMPLATE',
    );
    const resetUrl = this.buildActionUrl(resetUrlTemplate, token);

    await this.sendResetPasswordEmail(user.email, resetUrl);

    return {
      message: 'If the account exists, a password reset email has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const authToken = await this.consumeToken(
      dto.token,
      AuthTokenType.ResetPassword,
    );
    if (!authToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.usersService.updatePassword(
      authToken.user_id.toString(),
      dto.password,
    );

    await this.authTokenModel.updateMany(
      {
        user_id: authToken.user_id,
        type: AuthTokenType.ResetPassword,
        consumed_at: null,
        _id: { $ne: authToken._id },
      },
      {
        $set: {
          consumed_at: new Date(),
        },
      },
    );

    return { message: 'Password reset successful' };
  }

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.email_verified) {
      throw new ForbiddenException('Email not verified');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: this.toUserId(user._id),
      email: user.email,
    };
    return { access_token: this.jwtService.sign(payload) };
  }

  private toUserId(id: Types.ObjectId | string): string {
    return id.toString();
  }

  private async generateToken(
    userId: string,
    type: AuthTokenType,
  ): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const expiresAt =
      type === AuthTokenType.VerifyEmail
        ? new Date(Date.now() + this.verifyTokenTtlMs)
        : new Date(Date.now() + this.resetTokenTtlMs);

    try {
      await this.authTokenModel.create({
        user_id: new Types.ObjectId(userId),
        type,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
    } catch {
      throw new InternalServerErrorException('Could not generate auth token');
    }

    return rawToken;
  }

  private async consumeToken(
    rawToken: string,
    type: AuthTokenType,
  ): Promise<AuthTokenDocument | null> {
    const tokenHash = this.hashToken(rawToken);
    return this.authTokenModel.findOneAndUpdate(
      {
        token_hash: tokenHash,
        type,
        consumed_at: null,
        expires_at: { $gt: new Date() },
      },
      {
        $set: {
          consumed_at: new Date(),
        },
      },
      {
        returnDocument: 'after',
      },
    );
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private buildActionUrl(template: string, token: string): string {
    if (template.includes('{{token}}')) {
      return template.replace('{{token}}', encodeURIComponent(token));
    }
    if (template.includes('{token}')) {
      return template.replace('{token}', encodeURIComponent(token));
    }

    try {
      const url = new URL(template);
      url.searchParams.set('token', token);
      return url.toString();
    } catch {
      throw new InternalServerErrorException('Invalid URL template in env');
    }
  }

  private async sendVerificationEmail(
    email: string,
    verifyUrl: string,
  ): Promise<void> {
    await this.mailService.sendMail({
      to: email,
      subject: 'Verify your FlowForge account',
      text: `Welcome to FlowForge. Verify your email: ${verifyUrl}`,
      html: `<p>Welcome to FlowForge.</p><p>Verify your email: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
  }

  private async sendResetPasswordEmail(
    email: string,
    resetUrl: string,
  ): Promise<void> {
    await this.mailService.sendMail({
      to: email,
      subject: 'FlowForge password reset',
      text: `Reset your password: ${resetUrl}`,
      html: `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }
}
