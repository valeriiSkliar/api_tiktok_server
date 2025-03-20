import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TikTokSearchService {
  constructor(private prisma: PrismaService) {}

  private async getValidApiConfig() {
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

    if (!config) {
      throw new Error('No valid API configuration found');
    }

    return config;
  }

  async search(keyword: string): Promise<{
    success: boolean;
    keyword: string;
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
      if (keyword) {
        url.searchParams.set('keyword', keyword);
      }

      const response = await axios.get<any>(url.toString(), {
        headers: params.headers,
      });

      const data = response.data;
      return {
        success: true,
        keyword,
        results: data,
      };
    } catch (error: unknown) {
      return {
        success: false,
        keyword,
        results: null,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
