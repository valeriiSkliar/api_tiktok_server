/* eslint-disable @typescript-eslint/require-await */
import {
  createPlaywrightRouter,
  Log,
  PlaywrightCrawler,
  PlaywrightCrawlerOptions,
} from 'crawlee';
import {
  IAuthenticator,
  ICaptchaSolver,
  IEmailVerificationHandler,
  ISessionManager,
} from '../interfaces';
import { AuthCredentials, AuthResult, Session } from '../models';
import { Page } from 'playwright';

/**
 * TikTok authenticator implementation
 * Handles the authentication process for TikTok
 */
export class TikTokAuthenticator implements IAuthenticator {
  private crawler: PlaywrightCrawler | null = null;
  private router: ReturnType<typeof createPlaywrightRouter> =
    createPlaywrightRouter();
  private logger: Log;
  private captchaSolver: ICaptchaSolver;
  private emailVerifier: IEmailVerificationHandler;
  private sessionManager: ISessionManager;
  private currentSession: Session | null = null;
  private crawlerOptions: PlaywrightCrawlerOptions;
  private loginUrl =
    'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en';

  /**
   * Creates a new TikTokAuthenticator instance
   * @param logger Logger instance
   * @param captchaSolver Captcha solver implementation
   * @param emailVerifier Email verification handler implementation
   * @param sessionManager Session manager implementation
   * @param crawlerOptions Options for the PlaywrightCrawler
   */
  constructor(
    logger: Log,
    captchaSolver: ICaptchaSolver,
    emailVerifier: IEmailVerificationHandler,
    sessionManager: ISessionManager,
    crawlerOptions: Partial<PlaywrightCrawlerOptions> = {},
  ) {
    this.logger = logger;
    this.captchaSolver = captchaSolver;
    this.emailVerifier = emailVerifier;
    this.sessionManager = sessionManager;
    this.router = createPlaywrightRouter();

    // Set default crawler options
    this.crawlerOptions = {
      headless: process.env.HEADLESS === 'true',
      ...crawlerOptions,
    };
  }
  async runAuthenticator(credentials: AuthCredentials): Promise<void> {
    this.initCrawler(credentials);
    await this.crawler?.run([this.loginUrl]);
  }

  /**
   * Initialize the crawler with the appropriate request handlers
   * @private
   */
  private initCrawler(credentials: AuthCredentials): PlaywrightCrawler {
    if (this.crawler) {
      return this.crawler;
    }

    this.logger.info(
      'Initializing PlaywrightCrawler for TikTok authentication',
    );
    this.router.addDefaultHandler(async (ctx) => {
      // ctx.log.info('addDefaultHandler');
      await this.handleCookieConsent(ctx.page);
      await this.login(credentials);
    });

    this.crawler = new PlaywrightCrawler({
      ...this.crawlerOptions,
      requestHandler: this.router,

      // Define the request handler for authentication
      // async requestHandler({ page, log }) {
      //   log.info('Starting TikTok authentication flow', {
      //     url: page.url(),
      //   });

      //   // Authentication logic will be implemented here
      //   // This will be called by the login method
      // },

      // Handle failures
      failedRequestHandler({ request, log, error }) {
        log.error(`Request ${request.url} failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });

    return this.crawler;
  }

  /**
   * Performs login with the provided credentials
   * @param credentials User credentials for authentication
   * @returns Promise resolving to authentication result
   */
  async login(credentials: AuthCredentials): Promise<AuthResult> {
    this.logger.info('Logging in to TikTok', {
      email: credentials.email,
    });

    return {
      success: false,
      error: 'Login method not fully implemented yet',
    };
  }

  /**
   * Verifies if the current session is valid
   * @returns Promise resolving to boolean indicating session validity
   */
  async verifySession(): Promise<boolean> {
    if (!this.currentSession) {
      this.logger.info('No active session to verify');
      return false;
    }

    this.logger.info('Verifying TikTok session', {
      sessionId: this.currentSession.id,
    });

    // TODO: Implement session verification logic

    return false;
  }

  /**
   * Refreshes the current session to extend its validity
   * @returns Promise resolving to boolean indicating success
   */
  async refreshSession(): Promise<boolean> {
    if (!this.currentSession) {
      this.logger.info('No active session to refresh');
      return false;
    }

    this.logger.info('Refreshing TikTok session', {
      sessionId: this.currentSession.id,
    });

    // TODO: Implement session refresh logic

    return false;
  }

  /**
   * Performs logout, invalidating the current session
   * @returns Promise resolving when logout is complete
   */
  async logout(): Promise<void> {
    if (!this.currentSession) {
      this.logger.info('No active session to logout from');
      return;
    }

    this.logger.info('Logging out from TikTok', {
      sessionId: this.currentSession.id,
    });

    // TODO: Implement logout logic

    // Clean up the crawler when logging out
    if (this.crawler) {
      await this.crawler.teardown();
      this.crawler = null;
    }

    this.currentSession = null;
  }

  /**
   * Handles the TikTok cookie consent banner by clicking the "Allow all" button
   * @param page - Playwright page object
   * @returns Promise resolving to an object indicating success or failure
   */
  async handleCookieConsent(
    page: Page,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.info('Handling cookie consent banner');

    try {
      // Check if the cookie banner is present with a reasonable timeout
      const cookieBannerSelector = 'div.tiktok-cookie-banner';
      const allowButtonSelector = 'button:has-text("Allow all")';

      await page.waitForTimeout(2000);

      // First check if the cookie banner exists at all
      const cookieBanner = await page.$(cookieBannerSelector);

      // If no cookie banner is found, it might be already accepted or not shown yet
      if (!cookieBanner) {
        this.logger.info('No cookie banner found - might be already accepted');
        return { success: true };
      }

      this.logger.info('Cookie banner found, looking for Allow button');

      try {
        // Wait for the Allow button with a timeout
        const allowAllButton = await page.waitForSelector(
          `${cookieBannerSelector} ${allowButtonSelector}`,
          { timeout: 5000, state: 'visible' },
        );

        if (allowAllButton) {
          // Take a screenshot before clicking for debugging purposes
          await page.screenshot({
            path: 'storage/screenshots/before-cookie-consent.png',
          });

          this.logger.info('Clicking "Allow all" button');
          await allowAllButton.click();
          this.logger.info('Successfully clicked "Allow all" button');

          // Wait a moment for the banner to disappear and take another screenshot
          await page.waitForTimeout(2000);
          await page.screenshot({
            path: 'storage/screenshots/after-cookie-consent.png',
          });

          // Verify the banner disappeared
          const bannerAfterClick = await page.$(cookieBannerSelector);
          if (bannerAfterClick) {
            this.logger.warning(
              'Cookie banner still present after clicking "Allow all"',
            );
          } else {
            this.logger.info('Cookie banner successfully dismissed');
          }

          return { success: true };
        }
      } catch (buttonError) {
        // If we can't find the allow button specifically, log it but don't fail
        this.logger.warning(
          'Could not find "Allow all" button in the cookie banner',
          {
            error:
              buttonError instanceof Error
                ? buttonError.message
                : String(buttonError),
          },
        );

        // Try to find any button in the cookie banner as a fallback
        const anyButton = await cookieBanner.$('button');
        if (anyButton) {
          this.logger.info(
            'Trying to click alternative button in cookie banner',
          );
          await anyButton.click();
          await page.waitForTimeout(2000);
        }

        // Even if we couldn't click a specific button, return success
        // as this is not critical to the main authentication flow
        return { success: true };
      }

      // If we reach here, we found the banner but couldn't handle it properly
      this.logger.warning('Cookie banner handling completed with warnings');
      return { success: true };
    } catch (error: unknown) {
      // Take a screenshot to help debug the error state
      try {
        await page.screenshot({
          path: 'storage/screenshots/cookie-consent-error.png',
          fullPage: true,
        });
      } catch (screenshotError) {
        this.logger.error('Failed to take error screenshot', {
          error:
            screenshotError instanceof Error
              ? screenshotError.message
              : String(screenshotError),
        });
      }

      // Log detailed error information
      this.logger.error('Error handling cookie consent:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url: page.url(),
      });

      return {
        success: false,
        error: `Failed to handle cookie consent: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Cleans up resources used by the authenticator
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing TikTok authenticator');

    if (this.crawler) {
      await this.crawler.teardown();
      this.crawler = null;
    }
  }
}
