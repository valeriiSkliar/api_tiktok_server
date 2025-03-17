import { Page } from 'playwright';
import { Log } from 'crawlee';
import { IAuthenticationStep } from '../../interfaces/IAuthenticationStep';
import { AuthCredentials } from '../../models';
import { BrowserHelperService } from '../../services';

export class SelectPhoneEmailLoginStep implements IAuthenticationStep {
  private logger: Log;
  private browserHelper: BrowserHelperService;

  constructor(logger: Log) {
    this.logger = logger;
    this.browserHelper = BrowserHelperService.getInstance();
  }

  getName(): string {
    return 'Select Phone/Email Login';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(page: Page, _credentials?: AuthCredentials): Promise<boolean> {
    this.logger.info(
      'Waiting for login modal and selecting phone/email login option',
    );

    try {
      // Wait for the login modal to be visible
      await page.waitForSelector('div.LoginModal_main__I3imq', {
        timeout: 10000,
      });
      this.logger.info('Login modal is visible');

      // Try different selectors for the "Log in with phone/email" button
      // First try with text content
      const phoneEmailButton = page.locator(
        'div.Button_loginBtn__ImwTi:has-text("Log in with phone/email")',
      );

      if ((await phoneEmailButton.count()) > 0) {
        this.logger.info('Clicking "Log in with phone/email" button');
        await phoneEmailButton.click();
        this.logger.info(
          'Successfully clicked "Log in with phone/email" button',
        );
        return true;
      }

      // Try alternative selector with image alt text
      const altPhoneEmailButton = page
        .locator('div.Button_loginBtn__ImwTi img[alt="Phone/Email Login"]')
        .first();

      if ((await altPhoneEmailButton.count()) > 0) {
        this.logger.info(
          'Clicking "Log in with phone/email" button (using image selector)',
        );
        // Click the parent div of the image
        await altPhoneEmailButton.locator('..').click();
        this.logger.info(
          'Successfully clicked "Log in with phone/email" button',
        );
        return true;
      }

      // Try one more selector based on the structure
      const lastLoginButton = page
        .locator(
          'div.LoginSelection_loginSelection__PL6fP div.Button_loginBtn__ImwTi',
        )
        .last();

      if ((await lastLoginButton.count()) > 0) {
        this.logger.info(
          "Clicking last login button (assuming it's phone/email)",
        );
        await lastLoginButton.click();
        this.logger.info(
          'Successfully clicked what should be the phone/email login button',
        );
        return true;
      }

      this.logger.warning('Could not find "Log in with phone/email" button');
      return false;
    } catch (error: unknown) {
      // Take a screenshot to help debug
      await page.screenshot({
        path: 'storage/screenshots/phone-email-login-error.png',
      });
      this.logger.error('Error selecting phone/email login:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
