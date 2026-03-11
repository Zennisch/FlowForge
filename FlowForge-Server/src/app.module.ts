import { Module } from '@nestjs/common';
import { AppConfigModule } from './infra/config/config.module';
import { DatabaseModule } from './infra/database/mongoose.provider';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, UsersModule, AuthModule],
})
export class AppModule {}

