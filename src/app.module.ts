import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SearchRequestModule } from './search-request/search-request.module';
import { TikTokSearchModule } from './tiktok-search/tiktok-search.module';

@Module({
  imports: [SearchRequestModule, TikTokSearchModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
