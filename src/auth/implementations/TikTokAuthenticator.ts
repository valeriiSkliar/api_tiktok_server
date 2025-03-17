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
   * @returns Promise resolving to an object indicating success or failure
   */
  async handleCookieConsent(
    page: Page,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.info('Handling cookie consent banner');
    await page.waitForTimeout(2000);
    const allowAllButton = page.locator(
      'div.tiktok-cookie-banner button:has-text("Allow all")',
    );

    try {
      // Look for the "Allow all" button within the cookie banner

      // Check if the button exists and click it
      if ((await allowAllButton.count()) > 0) {
        this.logger.info('Clicking "Allow all" button');
        await allowAllButton.click();
        this.logger.info('Successfully clicked "Allow all" button');

        // Wait a moment for the banner to disappear
        await page.waitForTimeout(2000);

        return { success: true };
      } else {
        this.logger.warning(
          'Could not find "Allow all" button in the cookie banner',
        );
        // No cookie banner found, which is not an error - might be already accepted
        return { success: true };
      }
    } catch (error: unknown) {
      // Take a screenshot to help debug
      await page.screenshot({
        path: 'storage/screenshots/cookie-consent-error.png',
      });
      this.logger.error('Error handling cookie consent:', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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
