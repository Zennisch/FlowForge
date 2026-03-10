import { Module } from '@nestjs/common';
import { AppConfigModule } from './infra/config/config.module';
import { DatabaseModule } from './infra/database/mongoose.provider';

@Module({
  imports: [AppConfigModule, DatabaseModule],
})
export class AppModule {}

