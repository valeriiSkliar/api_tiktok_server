import { IEmailVerificationHandler } from '../interfaces';
import { Page } from 'playwright';
import { Log } from 'crawlee';
import { EmailApiService } from '../services';

export class TikTokEmailVerificationHandler
  implements IEmailVerificationHandler
{
  private logger: Log;
  private emailApiService: EmailApiService;

  constructor(emailApiService: EmailApiService, logger: Log) {
    this.logger = logger;
    this.emailApiService = emailApiService;
  }

  async waitForCode(email: string): Promise<string | null> {
    // Реализация ожидания кода верификации
    try {
      this.logger.info('Waiting for verification code', { email });
      return await this.emailApiService.waitForVerificationCode(email);
    } catch (error) {
      this.logger.error('Error waiting for verification code', {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async submitCode(page: Page, code: string): Promise<boolean> {
    // Реализация ввода кода верификации
    try {
      this.logger.info('Submitting verification code', { code });

      // Find the input field for the verification code
      const codeInput = await page.$('input[name="verificationCode"]');
      if (!codeInput) {
        this.logger.error('Verification code input field not found');
        return false;
      }

      // Clear any existing value
      await codeInput.click({ clickCount: 3 });
      await codeInput.press('Backspace');

      // Enter the code
      await codeInput.type(code, { delay: 100 });

      // Find and click the submit button
      const submitButton = await page.$('button[type="submit"]');
      if (!submitButton) {
        this.logger.error('Submit button not found');
        return false;
      }

      await submitButton.click();

      // Wait for navigation or success indicator
      await page.waitForNavigation({ timeout: 10000 }).catch(() => {
        // Ignore timeout errors, as sometimes there's no navigation
      });

      // Check for success (this will depend on TikTok's UI)
      const errorElement = await page.$('.error-message');
      if (errorElement) {
        const errorText = await errorElement.textContent();
        this.logger.error('Verification failed', { errorText });
        return false;
      }

      this.logger.info('Verification code submitted successfully');
      return true;
    } catch (error) {
      this.logger.error('Error submitting verification code', {
        code,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
