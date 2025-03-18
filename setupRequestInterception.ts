import { Page } from 'playwright';
import { Log } from 'crawlee';
import { RequestCaptureService } from './src/auth/services/RequestCapture';

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
 * Sets up request interception for TikTok API requests
 *
 * @param page - Playwright page instance
 * @param options - Interception options
 */
export const setupRequestInterception = async (
  page: Page,
  options: RequestInterceptionOptions = {},
) => {
  const { log, onFirstRequest } = options;
  const requestCapture = new RequestCaptureService(log);
  let isFirstRequest = true;

  await page.route(
    '**/creative_radar_api/v1/top_ads/v2/list**',
    async (route, request) => {
      try {
        // Capture request details
        await requestCapture.captureRequest(request);

        if (isFirstRequest) {
          isFirstRequest = false;
          // Call the onFirstRequest callback if provided
          if (onFirstRequest) {
            await onFirstRequest();
          }
        }

        // Continue request processing as usual
        await route.continue();
      } catch (error) {
        if (log) {
          log.error('Error processing request:', {
            error: (error as Error).message,
          });
        }
        await route.continue();
      }
    },
  );
};
