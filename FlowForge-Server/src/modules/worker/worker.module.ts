import { Module } from '@nestjs/common';
import { PubSubModule } from '../../infra/pubsub/pubsub.provider';
import { ExecutionModule } from '../execution/execution.module';
import { ConsumerService } from './consumer.service';
import { BranchHandler } from './handlers/branch.handler';
import { HttpHandler } from './handlers/http.handler';
import { StoreHandler } from './handlers/store.handler';
import { TransformHandler } from './handlers/transform.handler';
import { StepExecutorService } from './step-executor.service';

@Module({
  imports: [PubSubModule, ExecutionModule],
  providers: [
    ConsumerService,
    StepExecutorService,
    HttpHandler,
    TransformHandler,
    StoreHandler,
    BranchHandler,
  ],
})
export class WorkerModule {}
