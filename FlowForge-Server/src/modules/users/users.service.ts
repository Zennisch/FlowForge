import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({
      email: dto.email.toLowerCase(),
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = new this.userModel({
      email: dto.email.toLowerCase(),
      password: hashed,
      email_verified: dto.emailVerified ?? true,
      email_verified_at: dto.emailVerified === false ? null : new Date(),
    });
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, {
      $set: {
        email_verified: true,
        email_verified_at: new Date(),
      },
    });
  }

  async updatePassword(id: string, password: string): Promise<void> {
    const hashed = await bcrypt.hash(password, 10);
    await this.userModel.findByIdAndUpdate(id, {
      $set: {
        password: hashed,
        password_changed_at: new Date(),
      },
    });
  }
}
