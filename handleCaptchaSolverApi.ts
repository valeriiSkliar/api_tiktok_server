import { Page } from 'playwright';
import { Log } from 'crawlee';
import { checkForCaptcha } from './captcha-detection-step.js';
import { SadCaptchaService } from '@src/services/sadCaptchaService.js';
import { Env } from '@lib/Env.js';

declare global {
  interface Window {
    notifyContinue: () => void;
    notifyRefresh?: () => void;
  }
}

/**
 * Check for email verification form
 * @param page - Playwright page object
 * @returns Promise<boolean> - Whether email verification form is present
 */
async function checkEmailVerification(page: Page): Promise<boolean> {
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

/**
 * Attempts to click the CAPTCHA confirm button and verify success
 * @param page - Playwright page object
 * @param selector - CAPTCHA selector to check for removal
 * @param log - Logger instance
 * @returns Promise<boolean> - Whether verification was successful
 */
async function attemptCaptchaConfirmation(
  page: Page,
  selector: string,
  log: Log,
): Promise<boolean> {
  const confirmSelectors = [
    'div.verify-captcha-submit-button',
    'button.verify-captcha-submit',
    'button:has-text("Submit")',
    'button:has-text("Verify")',
    'div:has-text("Confirm")',
  ];

  for (const confirmSelector of confirmSelectors) {
    const confirmButton = await page.$(confirmSelector).catch(() => null);
    if (!confirmButton) continue;

    const isVisible = await confirmButton.isVisible().catch(() => false);
    const isEnabled = await confirmButton.isEnabled().catch(() => false);

    if (isVisible && isEnabled) {
      log.info(
        `CAPTCHA solved, clicking confirm button (${confirmSelector})...`,
      );
      try {
        await confirmButton.click();
        await page.waitForTimeout(2000);

        // First check if email verification appeared
        if (await checkEmailVerification(page)) {
          log.info('Email verification form detected after CAPTCHA');
          return true;
        }

        // Then check if CAPTCHA is gone
        const captchaStillPresent = await page.$(selector).catch(() => null);
        if (!captchaStillPresent) {
          log.info('CAPTCHA verification completed successfully');
          return true;
        }
      } catch (error) {
        log.warning('Failed to click confirm button:', {
          selector: confirmSelector,
          error: (error as Error).message,
        });
      }
    }
  }

  return false;
}

/**
 * Handle CAPTCHA and wait for user to solve it manually if detected
 * @param page - Playwright page object
 * @param log - Logger instance
 * @returns Promise<boolean> - Whether CAPTCHA was handled successfully
 */
export async function handleCaptchaSolverApi(
  page: Page,
  log: Log,
): Promise<boolean> {
  try {
    // Check for CAPTCHA presence
    const { detected, screenshotPath, selector } = await checkForCaptcha(
      page,
      log,
    );

    // If no CAPTCHA is detected, return early
    if (!detected || !screenshotPath || !selector) {
      log.info('No CAPTCHA detected, continuing process.');
      return false;
    }

    log.warning('CAPTCHA detected!');

    const captchaMode = Env.CHAPTCHA_RESOLVE_MODE;
    const maxWaitTime = 3600000; // 1 hour in milliseconds
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = 360; // Check every 10 seconds for 1 hour

    if (captchaMode === 'manual') {
      log.info('Manual CAPTCHA resolution mode. Waiting for user to solve...');

      // Wait for CAPTCHA to be solved and confirmed
      while (attempts < maxAttempts) {
        attempts++;

        try {
          // Take verification screenshot every 5 minutes for debugging
          if (attempts % 30 === 0) {
            const screenshotPath = `storage/screenshots/verification-state-${attempts}.png`;
            await page
              .screenshot({ path: screenshotPath })
              .catch((e) =>
                log.warning('Failed to take verification screenshot:', {
                  error: e.message,
                }),
              );
          }

          // First check for email verification form
          if (await checkEmailVerification(page)) {
            log.info('Email verification form detected during CAPTCHA wait');
            return true;
          }

          // Then check for successful CAPTCHA verification
          if (await attemptCaptchaConfirmation(page, selector, log)) {
            return true;
          }

          // Log progress every minute
          if (attempts % 6 === 0) {
            const minutesElapsed = Math.floor((Date.now() - startTime) / 60000);
            const minutesRemaining = Math.floor(
              (maxWaitTime - (Date.now() - startTime)) / 60000,
            );
            log.info(
              `Waiting for manual verification... ${minutesElapsed}m elapsed, ${minutesRemaining}m remaining`,
            );
          }

          await page.waitForTimeout(10000); // Check every 10 seconds
        } catch (error) {
          log.warning('Error checking verification state:', {
            error: (error as Error).message,
          });
          // Take error screenshot
          const errorScreenshotPath = `storage/screenshots/verification-error-${attempts}.png`;
          await page
            .screenshot({ path: errorScreenshotPath })
            .catch((e) =>
              log.warning('Failed to take error screenshot:', {
                error: e.message,
              }),
            );
        }
      }

      throw new Error(
        `Manual verification timed out after ${Math.floor(maxWaitTime / 60000)} minutes`,
      );
    }

    // API mode
    log.info('API CAPTCHA resolution mode. Attempting to solve...');
    const solver = new SadCaptchaService(log);
    const solved = await solver.solveCaptcha(page, selector, screenshotPath);

    if (solved) {
      log.info('CAPTCHA solved by API successfully!');
    }

    // Wait for confirmation in API mode
    while (attempts < maxAttempts) {
      attempts++;
      try {
        // First check for email verification form
        if (await checkEmailVerification(page)) {
          log.info('Email verification form detected during API verification');
          return true;
        }

        // Then check for successful CAPTCHA verification
        if (await attemptCaptchaConfirmation(page, selector, log)) {
          return true;
        }

        // Log progress every minute
        if (attempts % 6 === 0) {
          const minutesElapsed = Math.floor((Date.now() - startTime) / 60000);
          const minutesRemaining = Math.floor(
            (maxWaitTime - (Date.now() - startTime)) / 60000,
          );
          log.info(
            `Waiting for API verification... ${minutesElapsed}m elapsed, ${minutesRemaining}m remaining`,
          );
        }

        await page.waitForTimeout(10000); // Check every 10 seconds
      } catch (error) {
        log.warning('Error in API verification:', {
          error: (error as Error).message,
        });
      }
    }

    throw new Error(
      `API verification timed out after ${Math.floor(maxWaitTime / 60000)} minutes`,
    );
  } catch (error) {
    log.error('CRITICAL ERROR in CAPTCHA handling:', {
      error: (error as Error).message,
    });
    throw new Error(
      `CAPTCHA handling failed: ${(error as Error).message}. Process aborted.`,
    );
  }
}
