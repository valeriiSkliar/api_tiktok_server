import { Module } from '@nestjs/common';
import { TikTokSearchController } from '@src/tiktok-search/tiktok-search.controller';
import { TikTokSearchService } from '@src/tiktok-search/tiktok-search.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TikTokSearchController],
  providers: [TikTokSearchService],
})
export class TikTokSearchModule {}
