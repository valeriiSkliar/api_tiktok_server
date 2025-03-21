/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { SessionRefreshService } from './session-refresh.service';

export interface TikTokSearchOptions {
  period?: 7 | 30 | 180;
  page?: number;
  orderBy?: 'like' | 'ctr';
  countryCode?: string;
  keyword?: string;
}

@Injectable()
export class TikTokSearchService {
  private readonly logger = new Logger(TikTokSearchService.name);

  constructor(
    private prisma: PrismaService,
    private sessionRefreshService: SessionRefreshService,
  ) {}

  private async getValidApiConfig(forceRefresh = false) {
    if (forceRefresh) {
      this.logger.log('Forcing refresh of API configuration');
      await this.sessionRefreshService.refreshActiveSession();
    }
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const config = await this.prisma.apiConfiguration.findFirst({
      where: {
        is_active: true,
        updated_at: {
          gt: oneHourAgo,
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    if (!config && !forceRefresh) {
      this.logger.warn('No valid API configuration found, attempting refresh');
      return this.getValidApiConfig(true);
    }

    if (!config) {
      throw new Error(
        'No valid API configuration found even after refresh attempt',
      );
    }

    return config;
  }

  async search(options: TikTokSearchOptions = {}): Promise<{
    success: boolean;
    query: TikTokSearchOptions;
    results: any[] | null;
    error?: string;
  }> {
    try {
      const config = await this.getValidApiConfig();
      const params = config.parameters as {
        url: string;
        method: string;
        headers: Record<string, string>;
      };

      const url = new URL(params.url);
      if (options.keyword) {
        url.searchParams.set('keyword', options.keyword);
      }

      if (options.period) {
        url.searchParams.set('period', options.period.toString());
      }
      if (options.page) {
        url.searchParams.set('page', options.page.toString());
      }
      if (options.orderBy) {
        url.searchParams.set('order_by', options.orderBy);
      }
      if (options.countryCode) {
        url.searchParams.set('country_code', options.countryCode);
      }

      const response = await axios.get<any>(url.toString(), {
        headers: params.headers,
      });

      const data = response.data;
      return {
        success: true,
        query: options,
        results: data,
      };
    } catch (error: unknown) {
      return {
        success: false,
        query: options,
        results: null,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
