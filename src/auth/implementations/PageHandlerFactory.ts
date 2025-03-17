import { Page } from 'playwright';
import { Log } from 'crawlee';

export class PageHandlerFactory {
  private logger: Log;

  constructor(logger: Log) {
    this.logger = logger;
  }

  async takeScreenshot(page: Page, name: string): Promise<void> {
    try {
      await page.screenshot({
        path: `storage/screenshots/${name}.png`,
      });
    } catch (error) {
      this.logger.error(`Failed to take screenshot: ${name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async waitForSelector(
    page: Page,
    selector: string,
    options = { timeout: 5000, state: 'visible' as const },
  ): Promise<boolean> {
    try {
      await page.waitForSelector(selector, options);
      return true;
    } catch (error) {
      this.logger.warning(`Selector not found: ${selector}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // Add more page handling utilities as needed
}
