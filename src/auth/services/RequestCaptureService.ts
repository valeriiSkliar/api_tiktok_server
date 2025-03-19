/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import fs from 'fs';
import { Request, Page } from 'playwright';
import { Log } from 'crawlee';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: string;
}

interface RequestInterceptionOptions {
  /**
   * Logger instance for logging messages.
   */
  log?: Log;
  /**
   * Callback to be called when first request is intercepted
   */
  onFirstRequest?: () => Promise<void>;
}

/**
 * Service that handles request interception and capture for TikTok API endpoints
 */
export class IntegratedRequestCaptureService {
  private static CAPTURES_DIR = 'storage/request-captures';
  private isFirstRequest = true;

  // Default API endpoints to intercept
  private static DEFAULT_ENDPOINTS = [
    '**/creative_radar_api/v1/top_ads/v2/list**',
  ];

  constructor(private log?: Log) {
    this.ensureCapturesDirectory();
  }

  /**
   * Ensure the captures directory exists
   */
  private ensureCapturesDirectory() {
    if (!fs.existsSync(IntegratedRequestCaptureService.CAPTURES_DIR)) {
      fs.mkdirSync(IntegratedRequestCaptureService.CAPTURES_DIR, {
        recursive: true,
      });
    }
  }

  /**
   * Capture and save request details
   */
  private async captureRequest(request: Request): Promise<void> {
    const capturedRequest: CapturedRequest = {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData() || undefined,
      timestamp: new Date().toISOString(),
    };

    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
    const filepath = `${IntegratedRequestCaptureService.CAPTURES_DIR}/${filename}`;

    await fs.promises.writeFile(
      filepath,
      JSON.stringify(capturedRequest, null, 2),
    );

    this.log?.debug('Request captured and saved', {
      url: request.url(),
      filepath,
    });
  }

  /**
   * Sets up request interception for the specified page
   */
  async setupInterception(
    page: Page,
    options: RequestInterceptionOptions = {},
  ): Promise<void> {
    const { log = this.log, onFirstRequest } = options;

    // Reset first request flag when setting up interception
    this.isFirstRequest = true;

    // Set up interception for the default endpoint
    await page.route(
      IntegratedRequestCaptureService.DEFAULT_ENDPOINTS[0],
      async (route, request) => {
        try {
          await this.captureRequest(request);

          if (this.isFirstRequest) {
            this.isFirstRequest = false;
            if (onFirstRequest) {
              await onFirstRequest();
            }
            log?.info('First API request intercepted and captured', {
              url: request.url(),
            });
          }

          await route.continue();
        } catch (error) {
          log?.error('Error processing request:', {
            error: (error as Error).message,
          });
          await route.continue();
        }
      },
    );
  }
}
