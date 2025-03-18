import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TikTokSearchService {
  async search(keyword: string): Promise<{
    success: boolean;
    keyword: string;
    results: any[] | null;
    error?: string;
  }> {
    try {
      const baseUrl =
        'https://ads.tiktok.com/creative_radar_api/v1/top_ads/v2/list?period=30&page=1&limit=20&order_by=like';
      const url = new URL(baseUrl);
      // url.searchParams.set('keyword', keyword);
      console.log(url.toString());
      const headers = {
        accept: 'application/json, text/plain, */*',
        cookie:
          'cookie-consent={%22optional%22:true%2C%22ga%22:true%2C%22af%22:true%2C%22fbp%22:true%2C%22lip%22:true%2C%22bing%22:true%2C%22ttads%22:true%2C%22reddit%22:true%2C%22hubspot%22:true%2C%22version%22:%22v10%22}; passport_csrf_token=925f0378e32fc18f0eb39c6183cba516; passport_csrf_token_default=925f0378e32fc18f0eb39c6183cba516',
        referer:
          'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'x-csrftoken': 'D9Pq8bk7eLviNVFMT2Nth8Q9rRfZs422',
        'accept-language': 'en-US',
        'anonymous-user-id': '564a0c32-3600-4b61-b27c-4fdac8ca86fb',
        lang: 'en',
        'sec-ch-ua':
          '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        timestamp: '1742311399',
        'user-sign': 'cb76907b3dfcebd9',
      };

      const response = await axios.get<any>(url.toString(), { headers });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = response.data;
      // console.log(data);
      return {
        success: true,
        keyword,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        results: data,
      };
    } catch (error: unknown) {
      return {
        success: false,
        keyword,
        results: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
