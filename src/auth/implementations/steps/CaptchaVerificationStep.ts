// src/auth/implementations/steps/CaptchaVerificationStep.ts

import { Page } from 'playwright';
import { Log } from 'crawlee';
import {
  IAuthenticationStep,
  AuthStepType,
} from '../../interfaces/IAuthenticationStep';
import { ICaptchaSolver } from '../../interfaces/ICaptchaSolver';
import { Env } from '@lib/Env';

export class CaptchaVerificationStep implements IAuthenticationStep {
  private readonly logger: Log;
  private readonly captchaSolver: ICaptchaSolver;
  private readonly maxWaitTime: number = 3600000; // 1 hour in milliseconds
  private readonly maxAttempts: number = 360; // Check every 10 seconds for 1 hour

  constructor(logger: Log, captchaSolver: ICaptchaSolver) {
    this.logger = logger;
    this.captchaSolver = captchaSolver;
  }

  getName(): string {
    return 'Captcha Verification';
  }

  getType(): AuthStepType {
    return AuthStepType.LOGIN;
  }

  async execute(page: Page): Promise<boolean> {
    try {
      this.logger.info('Executing captcha verification step');

      // Detect captcha
      const detectionResult = await this.captchaSolver.detect(page);

      // If no captcha detected, return success
      if (!detectionResult.detected) {
        this.logger.info('No captcha detected, continuing');
        return true;
      }

      this.logger.warning('Captcha detected!', {
        type: detectionResult.type,
        selector: detectionResult.selector,
      });

      // Get captcha resolution mode from environment
      const captchaMode = Env.CAPTCHA_RESOLVE_MODE || 'manual';
      const startTime = Date.now();
      let attempts = 0;

      if (captchaMode === 'manual') {
        this.logger.info(
          'Manual captcha resolution mode. Waiting for user to solve...',
        );

        // Wait for user to solve captcha
        while (attempts < this.maxAttempts) {
          attempts++;

          try {
            // Take verification screenshot every 5 minutes for debugging
            if (attempts % 30 === 0) {
              const screenshotPath = `storage/screenshots/verification-state-${attempts}.png`;
              await page.screenshot({ path: screenshotPath }).catch((e) =>
                this.logger.warning('Failed to take verification screenshot:', {
                  error: e instanceof Error ? e.message : String(e),
                }),
              );
            }

            // Check if captcha is gone or email verification appeared
            const emailVerificationDetected =
              await this.checkForEmailVerification(page);
            if (emailVerificationDetected) {
              this.logger.info(
                'Email verification form detected after manual captcha handling',
              );
              return true;
            }

            // Check if captcha is still present
            const captchaStillPresent = await page
              .$(detectionResult.selector || '')
              .catch(() => null);
            if (!captchaStillPresent) {
              this.logger.info('Captcha appears to be solved manually');
              return true;
            }

            // Log progress every minute
            if (attempts % 6 === 0) {
              const minutesElapsed = Math.floor(
                (Date.now() - startTime) / 60000,
              );
              const minutesRemaining = Math.floor(
                (this.maxWaitTime - (Date.now() - startTime)) / 60000,
              );
              this.logger.info(
                `Waiting for manual verification... ${minutesElapsed}m elapsed, ${minutesRemaining}m remaining`,
              );
            }

            await page.waitForTimeout(10000); // Check every 10 seconds
          } catch (error) {
            this.logger.warning('Error checking verification state:', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        throw new Error(
          `Manual verification timed out after ${Math.floor(this.maxWaitTime / 60000)} minutes`,
        );
      } else {
        // API mode
        this.logger.info('API captcha resolution mode. Attempting to solve...');
        const solved = await this.captchaSolver.solve(page, detectionResult);

        if (solved) {
          this.logger.info('Captcha solved by API successfully!');
          return true;
        }

        // If solving failed, wait for potential manual intervention
        this.logger.warning(
          'API captcha solving failed, waiting for manual intervention or timeout',
        );

        while (attempts < this.maxAttempts) {
          attempts++;
          try {
            // Check if captcha is gone or email verification appeared
            const emailVerificationDetected =
              await this.checkForEmailVerification(page);
            if (emailVerificationDetected) {
              this.logger.info(
                'Email verification form detected after failed API captcha solving',
              );
              return true;
            }

            // Check if captcha is still present
            const captchaStillPresent = await page
              .$(detectionResult.selector || '')
              .catch(() => null);
            if (!captchaStillPresent) {
              this.logger.info(
                'Captcha appears to be solved (manually or delayed API success)',
              );
              return true;
            }

            // Log progress every minute
            if (attempts % 6 === 0) {
              const minutesElapsed = Math.floor(
                (Date.now() - startTime) / 60000,
              );
              const minutesRemaining = Math.floor(
                (this.maxWaitTime - (Date.now() - startTime)) / 60000,
              );
              this.logger.info(
                `Waiting for captcha resolution... ${minutesElapsed}m elapsed, ${minutesRemaining}m remaining`,
              );
            }

            await page.waitForTimeout(10000); // Check every 10 seconds
          } catch (error) {
            this.logger.warning('Error checking verification state:', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        throw new Error(
          `Captcha verification timed out after ${Math.floor(this.maxWaitTime / 60000)} minutes`,
        );
      }
    } catch (error) {
      this.logger.error('Critical error in captcha verification step:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check for email verification form
   * @param page - Playwright page object
   * @returns Promise<boolean> - Whether email verification form is present
   */
  private async checkForEmailVerification(page: Page): Promise<boolean> {
    const emailSelectors = [
      'div.tiktokads-common-login-code-form-item',
      '#TikTok_Ads_SSO_Login_Code_FormItem',
      'input[name="code"][placeholder="Enter verification code"]',
    ];

    for (const selector of emailSelectors) {
      const element = await page.$(selector).catch(() => null);
      if (element) {
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) return true;
      }
    }

    return false;
  }
}
