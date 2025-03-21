// src/tiktok-search/tiktok-search.module.ts
import { Module } from '@nestjs/common';
import { TikTokSearchController } from './tiktok-search.controller';
import { TikTokSearchService } from './tiktok-search.service';
import { SessionRefreshService } from './session-refresh.service';
import { SessionController } from './session.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionScheduleService } from './session-schedule.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [TikTokSearchController, SessionController],
  providers: [
    TikTokSearchService,
    SessionRefreshService,
    SessionScheduleService,
  ],
  exports: [TikTokSearchService],
})
export class TikTokSearchModule {}
