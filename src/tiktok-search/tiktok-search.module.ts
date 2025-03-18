import { Module } from '@nestjs/common';
import { TikTokSearchController } from '@src/tiktok-search/tiktok-search.controller';
import { TikTokSearchService } from '@src/tiktok-search/tiktok-search.service';

@Module({
  controllers: [TikTokSearchController],
  providers: [TikTokSearchService],
})
export class TikTokSearchModule {}
