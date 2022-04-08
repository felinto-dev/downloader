import { bullConfig, BULL_QUEUES } from '@/configs/bull.config';
import { configModuleConfig } from '@/configs/config-module.config';
import { CONSUMERS } from '@/consumers';
import { CONTROLLERS } from '@/controllers';
import { PrismaService } from '@/prisma.service';
import { REPOSITORIES } from '@/repositories';
import { SERVICES } from '@/services';
import { BullModule } from '@nestjs/bull';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import * as redisStore from 'cache-manager-redis-store';
import { ADAPTERS } from './adapters';
import { ITERATORS } from './iterators';
import { MANAGERS } from './managers';
import { OBSERVERS } from './observers';
import { ORCHESTRATORS } from './orchestrators';
import { SCHEDULES } from './schedulers';

@Module({
  imports: [
    EventEmitterModule.forRoot({ maxListeners: 5 }),
    CacheModule.register({
      store: redisStore,
      host: process.env.CURRENT_DOWNLOADS_IN_PROGRESS_DB_HOST,
    }),
    ConfigModule.forRoot(configModuleConfig),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync(bullConfig),
    ...BULL_QUEUES,
  ],
  controllers: [...CONTROLLERS],
  providers: [
    PrismaService,
    ...ADAPTERS,
    ...CONSUMERS,
    ...SERVICES,
    ...REPOSITORIES,
    ...ORCHESTRATORS,
    ...SCHEDULES,
    ...ITERATORS,
    ...MANAGERS,
    ...OBSERVERS,
  ],
})
export class AppModule {}
