// src/auth/implementations/SadCaptchaSolver.ts

import { Log } from 'crawlee';
import { ICaptchaSolver } from '../interfaces';
import { CaptchaDetectionResult } from '../models';
import { Page } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';
import path from 'path';
import { BrowserHelperService } from '../services';

interface SadCaptchaResponse {
  pointOneProportionX: number;
  pointOneProportionY: number;
  pointTwoProportionX: number;
  pointTwoProportionY: number;
}

/**
 * Implementation of ICaptchaSolver using SadCaptcha service
 * Handles detection and solving of captchas on TikTok
 */
export class SadCaptchaSolver implements ICaptchaSolver {
  private readonly baseUrl = 'https://www.sadcaptcha.com/api/v1';
  private readonly logger: Log;
  private readonly apiKey: string;
  private readonly screenshotsDir: string;
  private browserHelperService: BrowserHelperService;

  /**
   * Creates a new SadCaptchaSolver instance
   * @param logger Logger instance
   * @param apiKey SadCaptcha API key
   * @param screenshotsDir Directory to store captcha screenshots
   */
  constructor(
    logger: Log,
    apiKey: string,
    screenshotsDir = 'storage/screenshots',
  ) {
    this.logger = logger;
    this.apiKey = apiKey;
    this.screenshotsDir = screenshotsDir;
    this.browserHelperService = BrowserHelperService.getInstance();
    this.browserHelperService.setLogger(logger);
    // Ensure screenshots directory exists
    this.ensureDirectoryExists(this.screenshotsDir);
  }

  /**
   * Detects the presence of a captcha on the page
   * @param page Playwright page object
   * @returns Promise resolving to captcha detection result
   */
  async detect(page: Page): Promise<CaptchaDetectionResult> {
    this.logger.info('Detecting captcha', { url: page.url() });

    try {
      // Common captcha selectors for TikTok
      const captchaSelectors = [
        // TikTok shape captcha
        'div.captcha_verify_container',
        'div.captcha-verify-container',
        'div[class*="captcha"]',
        // Slide captcha
        'div.secsdk-captcha-drag-wrapper',
        'div.captcha_verify_slide',
        // General captcha containers
        'iframe[src*="captcha"]',
        'div[id*="captcha"]',
      ];

      // Check for captcha elements
      for (const selector of captchaSelectors) {
        const isVisible = await page.isVisible(selector).catch(() => false);

        if (isVisible) {
          this.logger.info(`Captcha detected with selector: ${selector}`);

          // Take a screenshot of the captcha
          const timestamp = Date.now();
          const screenshotPath = path.join(
            this.screenshotsDir,
            `captcha-${timestamp}.png`,
          );

          // Get the element handle
          const element = await page.$(selector);

          // Take a screenshot of the captcha element
          if (element) {
            await element.screenshot({ path: screenshotPath });
          } else {
            // Fallback to full page screenshot
            await page.screenshot({ path: screenshotPath });
          }

          // Determine captcha type
          let captchaType = 'unknown';

          if (selector.includes('slide')) {
            captchaType = 'tiktok-slide';
          } else if (selector.includes('verify')) {
            captchaType = 'tiktok-shape';
          }

          return {
            detected: true,
            type: captchaType,
            element,
            selector,
            screenshotPath,
          };
        }
      }

      // No captcha detected
      return {
        detected: false,
        type: null,
        element: null,
      };
    } catch (error) {
      this.logger.error('Error detecting captcha:', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        detected: false,
        type: null,
        element: null,
      };
    }
  }

  /**
   * Attempts to solve the detected captcha
   * @param page Playwright page object
   * @param detectionResult Result from the captcha detection
   * @returns Promise resolving to boolean indicating success
   */
  async solve(
    page: Page,
    detectionResult: CaptchaDetectionResult,
  ): Promise<boolean> {
    if (
      !detectionResult.detected ||
      !detectionResult.element ||
      !detectionResult.screenshotPath
    ) {
      this.logger.info('No captcha to solve or missing required information');
      return false;
    }

    this.logger.info('Solving captcha', {
      type: detectionResult.type,
      selector: detectionResult.selector,
    });

    try {
      // Use the solveCaptcha method to solve the captcha
      return await this.solveCaptcha(
        page,
        detectionResult.selector || 'div[class*="captcha"]',
        detectionResult.screenshotPath,
      );
    } catch (error) {
      this.logger.error('Error solving captcha:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Solves a captcha using the SadCaptcha API
   * @param page Playwright page object
   * @param captchaImageSelector Selector for the captcha image
   * @param screenshotPath Path to the captcha screenshot
   * @returns Promise resolving to boolean indicating success
   */
  private async solveCaptcha(
    page: Page,
    captchaImageSelector: string,
    screenshotPath: string,
  ): Promise<boolean> {
    try {
      if (!screenshotPath) {
        this.logger.error('No screenshot path provided for captcha solving');
        return false;
      }

      await page.waitForTimeout(1000);

      // Read the existing screenshot
      const buffer = await fs.promises.readFile(screenshotPath);
      const imageBase64 = buffer.toString('base64');

      // Get the captcha element
      this.logger.info('Getting captcha element', {
        selector: captchaImageSelector,
      });
      const captchaElement = await page.$(captchaImageSelector);
      if (!captchaElement) {
        this.logger.error('Captcha element not found');
        return false;
      }

      // Get solution from SadCaptcha API
      const solution = await this.getSolution(imageBase64);
      if (!solution) {
        return false;
      }
      this.logger.info('Captcha solution received', { solution });

      // Get element dimensions
      const boundingBox = await captchaElement.boundingBox();
      this.logger.info('Captcha element dimensions', { boundingBox });
      if (!boundingBox) {
        this.logger.error('Could not get captcha element dimensions');
        return false;
      }

      // Calculate actual click coordinates
      const clickPoints = [
        {
          x: boundingBox.width * solution.pointOneProportionX,
          y: boundingBox.height * solution.pointOneProportionY,
        },
        {
          x: boundingBox.width * solution.pointTwoProportionX,
          y: boundingBox.height * solution.pointTwoProportionY,
        },
      ];
      this.logger.info('Click points calculated', { clickPoints });

      // Click the points
      for (const point of clickPoints) {
        await page.waitForTimeout(
          this.browserHelperService.randomBetween(1000, 3000),
        );

        this.logger.info('Clicking point:', { x: point.x, y: point.y });
        await page.mouse.move(
          boundingBox.x +
            point.x +
            this.browserHelperService.randomBetween(-5, 5),
          boundingBox.y +
            point.y +
            this.browserHelperService.randomBetween(-5, 5),
          { steps: this.browserHelperService.randomBetween(5, 10) },
        );
        await page.waitForTimeout(500);
        await captchaElement.click({
          position: {
            x: point.x,
            y: point.y,
          },
        });
        // Wait a bit between clicks to simulate human behavior
        await page.waitForTimeout(500);
      }

      this.logger.info('Captcha solution applied');

      // Attempt to click the confirmation button if it exists
      return await this.attemptCaptchaConfirmation(page, captchaImageSelector);
    } catch (error) {
      this.logger.error('Error solving captcha:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Attempts to click the CAPTCHA confirm button and verify success
   * @param page - Playwright page object
   * @param selector - CAPTCHA selector to check for removal
   * @returns Promise<boolean> - Whether verification was successful
   */
  private async attemptCaptchaConfirmation(
    page: Page,
    selector: string,
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
        this.logger.info(
          `CAPTCHA solved, clicking confirm button (${confirmSelector})...`,
        );
        try {
          await confirmButton.click();
          await page.waitForTimeout(2000);

          // First check if email verification appeared
          if (await this.checkEmailVerification(page)) {
            this.logger.info('Email verification form detected after CAPTCHA');
            return true;
          }

          // Then check if CAPTCHA is gone
          const captchaStillPresent = await page.$(selector).catch(() => null);
          if (!captchaStillPresent) {
            this.logger.info('CAPTCHA verification completed successfully');
            return true;
          }
        } catch (error) {
          this.logger.warning('Failed to click confirm button:', {
            selector: confirmSelector,
            error: (error as Error).message,
          });
        }
      }
    }

    return false;
  }

  /**
   * Check for email verification form
   * @param page - Playwright page object
   * @returns Promise<boolean> - Whether email verification form is present
   */
  private async checkEmailVerification(page: Page): Promise<boolean> {
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
   * Gets a solution from the SadCaptcha API
   * @param imageBase64 Base64-encoded image data
   * @returns Promise resolving to SadCaptcha response
   */
  private async getSolution(
    imageBase64: string,
  ): Promise<SadCaptchaResponse | null> {
    try {
      const response = await axios.post<SadCaptchaResponse>(
        `${this.baseUrl}/shapes`,
        { imageB64: imageBase64 },
        {
          params: {
            licenseKey: this.apiKey,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Error getting captcha solution:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Ensures that a directory exists, creating it if necessary
   * @param directory Directory path
   */
  private ensureDirectoryExists(directory: string): void {
    try {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
        this.logger.info(`Created directory: ${directory}`);
      }
    } catch (error) {
      this.logger.error(`Error creating directory ${directory}:`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
