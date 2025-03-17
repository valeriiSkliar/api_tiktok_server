import { Log } from 'crawlee';
import { Locator, Page } from 'playwright';

/**
 * Type for API response data
 * This is a generic type that can be specialized by the callback function
 */
export interface ApiResponseData {
  [key: string]: unknown;
}

/**
 * Singleton service class that encapsulates browser helper functions
 * for use in authentication and scraping operations
 */
export class BrowserHelperService {
  private static instance: BrowserHelperService;
  private logger: Log | null = null;

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {}

  /**
   * Gets the singleton instance of the BrowserHelperService
   * @returns The singleton instance
   */
  public static getInstance(): BrowserHelperService {
    if (!BrowserHelperService.instance) {
      BrowserHelperService.instance = new BrowserHelperService();
    }
    return BrowserHelperService.instance;
  }

  /**
   * Sets the logger for the service
   * @param logger The logger instance to use
   */
  public setLogger(logger: Log): void {
    this.logger = logger;
  }

  /**
   * Waits for a specified amount of time
   * @param ms - Time to wait in milliseconds
   * @returns Promise that resolves after the specified time
   */
  public async delay(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }

  /**
   * Generates a random delay within a specified range
   * @param min - Minimum delay in milliseconds
   * @param max - Maximum delay in milliseconds
   * @returns A random number between min and max
   */
  public randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Types text into an input field with random delays between keystrokes to simulate human typing
   * @param page - Playwright page object
   * @param element - The input element to type into
   * @param text - The text to type
   */
  public async typeWithHumanDelay(
    page: Page,
    element: Locator,
    text: string,
  ): Promise<void> {
    // Clear the field first
    await element.fill('');

    // Type each character with a random delay
    for (const char of text) {
      await element.press(char);
      // Random delay between keystrokes (between 50ms and 250ms)
      await page.waitForTimeout(this.randomBetween(50, 250));
    }
  }

  /**
   * Checks if the user is logged in to TikTok
   * @param page - Playwright page object
   * @returns Promise resolving to boolean indicating login status
   */
  public async isLoggedIn(page: Page): Promise<boolean> {
    if (!this.logger) {
      console.warn('Logger not set in BrowserHelperService');
    }

    await page.waitForTimeout(5000);
    // Check for elements that are only visible after login
    this.logger?.info('Checking if logged in...');

    const loggedInSelectors = [
      'div[data-testid="cc_header_userInfo"]',
      '.UserDropDown_trigger__Ian3g',
      '.DefaultAvatar_wrapper__NpgQV',
      'div[id="HeaderLoginUserProfile"]',
      'div[class*="UserDropDown_trigger"]',
      'div[class*="DefaultAvatar_wrapper"]',
      'img[class*="avatar"]',
      'div[class*="avatar"]',
    ];

    for (const selector of loggedInSelectors) {
      const isVisible = await page
        .isVisible(selector, { timeout: 2000 })
        .catch(() => false);
      if (isVisible) {
        this.logger?.info('Logged in successfully');
        return true;
      }
    }

    return false;
  }

  /**
   * Scrolls the page to the bottom
   * @param page - Playwright page object
   */
  public async scrollToBottom(page: Page): Promise<void> {
    await page.evaluate(() => {
      window.scrollTo({
        top: document.body.scrollHeight - 200,
        behavior: 'smooth',
      });
    });
  }

  /**
   * Performs natural scrolling to simulate human behavior
   * @param page - Playwright page object
   * @param maxScrolls - Maximum number of scroll actions (default: 10)
   * @param minScrollPixels - Minimum pixels to scroll each time (default: 100)
   * @param maxScrollPixels - Maximum pixels to scroll each time (default: 300)
   * @param minDelay - Minimum delay between scrolls in ms (default: 500)
   * @param maxDelay - Maximum delay between scrolls in ms (default: 1500)
   * @param bottomMargin - Margin from bottom of page to stop scrolling (default: 200)
   */
  public async scrollNaturally(
    page: Page,
    maxScrolls: number = 10,
    minScrollPixels: number = 100,
    maxScrollPixels: number = 300,
    minDelay: number = 500,
    maxDelay: number = 1500,
    bottomMargin: number = 200,
  ): Promise<void> {
    this.logger?.info('Starting natural scrolling simulation');

    let scrollCount = 0;
    let reachedBottom = false;

    while (scrollCount < maxScrolls && !reachedBottom) {
      // Get current scroll position and page height
      const { scrollTop, scrollHeight, clientHeight } = await page.evaluate(
        () => {
          return {
            scrollTop: document.documentElement.scrollTop,
            scrollHeight: document.documentElement.scrollHeight,
            clientHeight: document.documentElement.clientHeight,
          };
        },
      );

      // Calculate if we're near the bottom
      if (scrollTop + clientHeight >= scrollHeight - bottomMargin) {
        this.logger?.info('Reached bottom of page');
        reachedBottom = true;
        break;
      }

      // Calculate a random scroll amount
      const scrollAmount = this.randomBetween(minScrollPixels, maxScrollPixels);

      // Perform the scroll
      await page.evaluate((amount) => {
        window.scrollBy({ top: amount, behavior: 'smooth' });
      }, scrollAmount);

      // Wait a random amount of time before next scroll
      const delayTime = this.randomBetween(minDelay, maxDelay);
      await this.delay(delayTime);

      scrollCount++;
    }

    this.logger?.info(`Completed natural scrolling (${scrollCount} scrolls)`);
  }

  /**
   * Sets up request interception for capturing API responses
   * This is a simplified version - for full functionality use the dedicated service
   * @param page - Playwright page object
   * @param urlPattern - URL pattern to match for interception
   * @param callback - Callback function to process intercepted responses
   */
  public async setupBasicRequestInterception<
    T extends ApiResponseData = ApiResponseData,
  >(
    page: Page,
    urlPattern: string,
    callback: (responseData: T) => void,
  ): Promise<void> {
    if (!this.logger) {
      console.warn('Logger not set in BrowserHelperService');
    }

    this.logger?.info('Setting up basic request interception', { urlPattern });

    await page.route(urlPattern, async (route) => {
      // Allow the request to continue
      await route.continue();
    });

    // Listen for responses matching the pattern
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes(urlPattern)) {
        try {
          // Use type assertion with the generic type parameter
          const responseData = (await response.json()) as T;
          this.logger?.info('Intercepted API response', { url });
          callback(responseData);
        } catch (error) {
          this.logger?.error('Error processing intercepted response', {
            url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  }
}

// Export a convenience function to get the singleton instance
export const getBrowserHelperService = (): BrowserHelperService => {
  return BrowserHelperService.getInstance();
};
