import { Log } from 'crawlee';
import { Page } from 'playwright';
import { IAuthenticationStep } from '../../interfaces/IAuthenticationStep';
import { ICaptchaSolver } from '../../interfaces/ICaptchaSolver';

/**
 * Authentication step for solving captchas during the login process
 * Uses the ICaptchaSolver implementation to detect and solve captchas
 */
export class SolveCaptchaStep implements IAuthenticationStep {
  private readonly logger: Log;
  private readonly captchaSolver: ICaptchaSolver;
  private maxRetries = 3;

  /**
   * Creates a new SolveCaptchaStep instance
   * @param logger Logger instance
   * @param captchaSolver Captcha solver implementation
   */
  constructor(logger: Log, captchaSolver: ICaptchaSolver) {
    this.logger = logger;
    this.captchaSolver = captchaSolver;
  }

  /**
   * Get the name of the step
   * @returns Name of the step
   */
  getName(): string {
    return 'SolveCaptchaStep';
  }

  /**
   * Execute the step
   * @param page Playwright page object
   * @param credentials Authentication credentials
   * @returns Promise resolving to boolean indicating success
   */
  async execute(page: Page): Promise<boolean> {
    this.logger.info('Executing SolveCaptchaStep');

    // Check for captcha presence
    const detectionResult = await this.captchaSolver.detect(page);

    if (!detectionResult.detected) {
      this.logger.info('No captcha detected, continuing');
      return true;
    }

    this.logger.info('Captcha detected', {
      type: detectionResult.type,
      selector: detectionResult.selector,
    });

    // Try to solve the captcha with multiple retries
    let retries = 0;
    let solved = false;

    while (retries < this.maxRetries && !solved) {
      this.logger.info(
        `Attempting to solve captcha (attempt ${retries + 1}/${this.maxRetries})`,
      );

      solved = await this.captchaSolver.solve(page, detectionResult);

      if (solved) {
        this.logger.info('Captcha solved successfully');

        // Wait for navigation or UI update after solving captcha
        await page.waitForTimeout(2000);

        // Check if we still have a captcha (sometimes solving one captcha leads to another)
        const newDetectionResult = await this.captchaSolver.detect(page);

        if (newDetectionResult.detected) {
          this.logger.info(
            'Another captcha detected after solving, continuing with retry',
          );
          solved = false;
        }
      } else {
        this.logger.warning('Failed to solve captcha, retrying');
      }

      retries++;

      if (!solved && retries < this.maxRetries) {
        // Wait before retrying
        await page.waitForTimeout(1000);
      }
    }

    if (!solved) {
      this.logger.error('Failed to solve captcha after maximum retries');
      return false;
    }

    return true;
  }
}
