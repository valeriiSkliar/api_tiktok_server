import { Controller, Get, Query } from '@nestjs/common';
import {
  TikTokSearchService,
  TikTokSearchOptions,
} from '@src/tiktok-search/tiktok-search.service';

@Controller('tiktok-search')
export class TikTokSearchController {
  constructor(private readonly tikTokSearchService: TikTokSearchService) {}

  @Get()
  async search(
    @Query('keyword') keyword: string,
    @Query('period') period?: 7 | 30 | 180,
    @Query('page') page?: number,
    @Query('order_by') orderBy?: 'like' | 'ctr',
    @Query('country_code') countryCode?: string,
  ): Promise<{
    success: boolean;
    query: TikTokSearchOptions;
    results: any[] | null;
    error?: string;
  }> {
    const options: TikTokSearchOptions = {
      keyword: keyword,
      period: period,
      page: page ? Number(page) : undefined,
      orderBy: orderBy,
      countryCode: countryCode,
    };

    return await this.tikTokSearchService.search(options);
  }
}
