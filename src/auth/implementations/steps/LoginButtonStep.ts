import { Page } from 'playwright';
import { Log } from 'crawlee';
import { IAuthenticationStep } from '../../interfaces/IAuthenticationStep';

export class LoginButtonStep implements IAuthenticationStep {
  private logger: Log;

  constructor(logger: Log) {
    this.logger = logger;
  }

  getName(): string {
    return 'Login Button Click';
  }

  async execute(page: Page): Promise<boolean> {
    this.logger.info('Attempting to click on login button');
    try {
      // Wait for the login button to be visible
      await page.waitForSelector('div[data-testid="cc_header_login"]', {
        timeout: 10000,
      });

      // Find the login button using the data-testid attribute
      const loginButton = page.locator('div[data-testid="cc_header_login"]');

      // Check if the button exists and click it
      if ((await loginButton.count()) > 0) {
        this.logger.info('Clicking login button');
        await loginButton.click();
        this.logger.info('Successfully clicked login button');

        // Wait a moment for the login page/modal to load
        // await page.waitForTimeout(3000);
      } else {
        // Try alternative selector if the first one doesn't work
        const altLoginButton = page.locator(
          'div.FixedHeaderPc_loginBtn__lL73Y',
        );

        if ((await altLoginButton.count()) > 0) {
          this.logger.info(
            'Clicking login button (using alternative selector)',
          );
          await altLoginButton.click();
          this.logger.info('Successfully clicked login button');

          // Wait a moment for the login page/modal to load
          await page.waitForTimeout(3000);
        } else {
          this.logger.warning('Could not find login button');
          return false;
        }
      }

      return true;
    } catch (error: unknown) {
      // Take a screenshot to help debug
      await page.screenshot({
        path: 'storage/screenshots/login-button-error.png',
      });
      this.logger.error('Error clicking login button:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
