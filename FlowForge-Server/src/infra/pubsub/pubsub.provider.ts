import { Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub, Subscription } from '@google-cloud/pubsub';

@Injectable()
export class PubSubService implements OnModuleDestroy {
  private readonly client: PubSub;
  private readonly jobsTopicName: string;
  private readonly eventsTopicName: string;
  private readonly eventsSubName: string;
  private readonly jobsSubName: string;

  constructor(private readonly config: ConfigService) {
    this.client = new PubSub({
      projectId: config.getOrThrow<string>('GOOGLE_CLOUD_PROJECT'),
    });
    this.jobsTopicName = config.getOrThrow<string>('PUBSUB_JOBS_TOPIC');
    this.eventsTopicName = config.getOrThrow<string>('PUBSUB_EVENTS_TOPIC');
    this.eventsSubName = config.getOrThrow<string>('PUBSUB_EVENTS_SUBSCRIPTION');
    this.jobsSubName = config.getOrThrow<string>('PUBSUB_JOBS_SUBSCRIPTION');
  }

  async publishJob(payload: unknown): Promise<void> {
    const data = Buffer.from(JSON.stringify(payload));
    await this.client.topic(this.jobsTopicName).publishMessage({ data });
  }

  async publishResult(payload: unknown): Promise<void> {
    const data = Buffer.from(JSON.stringify(payload));
    await this.client.topic(this.eventsTopicName).publishMessage({ data });
  }

  getJobsSubscription(): Subscription {
    return this.client.subscription(this.jobsSubName);
  }

  getEventsSubscription(): Subscription {
    return this.client.subscription(this.eventsSubName);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}

@Module({
  providers: [PubSubService],
  exports: [PubSubService],
})
export class PubSubModule {}

