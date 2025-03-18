import { Controller, Get, Query } from '@nestjs/common';
import { TikTokSearchService } from '@src/tiktok-search/tiktok-search.service';

@Controller('tiktok-search')
export class TikTokSearchController {
  constructor(private readonly tikTokSearchService: TikTokSearchService) {}

  @Get()
  async search(@Query('keyword') keyword: string): Promise<{
    success: boolean;
    keyword: string;
    results: any[] | null;
    error?: string;
  }> {
    return await this.tikTokSearchService.search(keyword);
  }
}
