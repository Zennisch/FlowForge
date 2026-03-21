import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { MailService } from '../../infra/mail/mail.service';
import { UsersService } from '../users/users.service';
import { AuthToken, AuthTokenType } from './auth-token.schema';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<MailService>;
  let authTokenModel: {
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    updateMany: jest.Mock;
  };

  const mockUser = {
    _id: '507f191e810c19729de860ea',
    email: 'test@example.com',
    password: 'hashed_password',
    email_verified: true,
  };

  beforeEach(async () => {
    authTokenModel = {
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            markEmailVerified: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_access_token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'VERIFY_EMAIL_URL_TEMPLATE') {
                return 'https://app.local/verify?token={token}';
              }
              if (key === 'RESET_PASSWORD_URL_TEMPLATE') {
                return 'https://app.local/reset?token={token}';
              }
              throw new Error('Missing key');
            }),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
        {
          provide: getModelToken(AuthToken.name),
          useValue: authTokenModel,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
  });

  describe('register', () => {
    it('should create an unverified user and send verification email', async () => {
      usersService.create.mockResolvedValue(mockUser as any);
      authTokenModel.create.mockResolvedValue({ _id: 'token-id' });

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        emailVerified: false,
      });
      expect(authTokenModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AuthTokenType.VerifyEmail,
        }),
      );
      expect(mailService.sendMail).toHaveBeenCalled();
      expect(result).toEqual({
        message:
          'Registration successful. Please verify your email before logging in.',
      });
    });
  });

  describe('login', () => {
    it('should return an access_token on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: '507f191e810c19729de860ea',
        email: 'test@example.com',
      });
      expect(result).toEqual({ access_token: 'mock_access_token' });
    });

    it('should throw ForbiddenException when email is not verified', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        email_verified: false,
      } as any);

      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyEmail', () => {
    it('should consume token and mark user verified', async () => {
      authTokenModel.findOneAndUpdate.mockResolvedValue({
        _id: 'token-id',
        user_id: { toString: () => 'user-id-123' },
      });

      const result = await service.verifyEmail({ token: 'raw-token' });

      expect(usersService.markEmailVerified).toHaveBeenCalledWith('user-id-123');
      expect(result).toEqual({ message: 'Email verified successfully' });
    });

    it('should throw on invalid token', async () => {
      authTokenModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.verifyEmail({ token: 'invalid' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should return generic response when user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'none@example.com' });

      expect(mailService.sendMail).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'If the account exists, a password reset email has been sent.',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password and consume other reset tokens', async () => {
      authTokenModel.findOneAndUpdate.mockResolvedValue({
        _id: 'token-id',
        user_id: { toString: () => 'user-id-123' },
      });

      const result = await service.resetPassword({
        token: 'raw-token',
        password: 'new_password_123',
      });

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        'user-id-123',
        'new_password_123',
      );
      expect(authTokenModel.updateMany).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Password reset successful' });
    });
  });
});
