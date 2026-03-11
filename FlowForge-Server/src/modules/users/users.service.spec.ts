import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { User } from './user.schema';
import { UsersService } from './users.service';

const mockSave = jest.fn();

// Cast to `any` so TypeScript accepts static method props alongside the constructor mock
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUserModel: any = jest
  .fn()
  .mockImplementation((dto: Record<string, unknown>) => ({
    ...dto,
    save: mockSave,
  }));

mockUserModel.findOne = jest.fn();
mockUserModel.findById = jest.fn();

describe('UsersService', () => {
  let service: UsersService;

  const existingUser = {
    _id: 'user-id-123',
    email: 'test@example.com',
    password: 'hashed_password',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('should hash the password and save the user', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockSave.mockResolvedValue({ ...existingUser, password: 'hashed_pw' });
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_pw' as never);

      const result = await service.create({
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
      expect(mockSave).toHaveBeenCalled();
      expect(result).toMatchObject({ password: 'hashed_pw' });
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUserModel.findOne.mockResolvedValue(existingUser);

      await expect(
        service.create({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);

      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should return the user when found', async () => {
      mockUserModel.findOne.mockResolvedValue(existingUser);

      const result = await service.findByEmail('TEST@EXAMPLE.COM');

      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
      expect(result).toEqual(existingUser);
    });

    it('should return null when user does not exist', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return the user by id', async () => {
      mockUserModel.findById.mockResolvedValue(existingUser);

      const result = await service.findById('user-id-123');

      expect(mockUserModel.findById).toHaveBeenCalledWith('user-id-123');
      expect(result).toEqual(existingUser);
    });

    it('should return null when id does not exist', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });
});
