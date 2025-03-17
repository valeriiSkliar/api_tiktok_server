import { PlaywrightCrawlerOptions } from 'crawlee';

export class TikTokAuthConfig {
  readonly loginUrl: string;
  readonly crawlerOptions: PlaywrightCrawlerOptions;

  constructor(
    loginUrl: string = 'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
    crawlerOptions: Partial<PlaywrightCrawlerOptions> = {},
  ) {
    this.loginUrl = loginUrl;
    this.crawlerOptions = {
      headless: process.env.HEADLESS === 'true',
      ...crawlerOptions,
    };
  }
}
