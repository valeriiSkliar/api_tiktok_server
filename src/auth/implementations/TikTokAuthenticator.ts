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
import { AuthCredentials, Session } from '../models';
import { AuthenticationPipeline } from './AuthenticationPipeline';
import { CookieConsentStep } from './steps/CookieConsentStep';
import { LoginButtonStep } from './steps/LoginButtonStep';

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
  private authPipeline: AuthenticationPipeline;
  private loginUrl =
    'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en';

  /**
   * Creates a new TikTokAuthenticator instance
   * @param logger Logger instance
   * @param captchaSolver Captcha solver implementation
   * @param emailVerifier Email verification handler implementation
   * @param sessionManager Session manager implementation
   * @param crawlerOptions Options for the PlaywrightCrawler
   *
   */
  constructor(
    logger: Log,
    captchaSolver: ICaptchaSolver,
    emailVerifier: IEmailVerificationHandler,
    sessionManager: ISessionManager,
    crawlerOptions: Partial<PlaywrightCrawlerOptions> = {},
  ) {
    this.authPipeline = new AuthenticationPipeline(logger);
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

    // Configure authentication pipeline with steps
    this.authPipeline
      .addStep(new CookieConsentStep(logger))
      .addStep(new LoginButtonStep(logger));
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
      await this.authPipeline.execute(ctx.page, credentials);
    });

    this.crawler = new PlaywrightCrawler({
      ...this.crawlerOptions,
      requestHandler: this.router,

      // Handle failures
      failedRequestHandler({ request, log, error }) {
        log.error(`Request ${request.url} failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });

    return this.crawler;
  }

  // /**
  //  * Performs login with the provided credentials
  //  * @param credentials User credentials for authentication
  //  * @param page Page for context
  //  * @returns Promise resolving to authentication result
  //  */
  // async login(credentials: AuthCredentials, page: Page): Promise<AuthResult> {
  //   this.logger.info('Logging in to TikTok', {
  //     email: credentials.email,
  //   });

  //   return this.authPipeline.execute(page, credentials);
  // }

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

  // /**
  //  * Handles the TikTok cookie consent banner by clicking the "Allow all" button
  //  * @param page - Playwright page object
  //  * @returns Promise resolving to an object indicating success or failure
  //  */
  // handleCookieConsent(
  //   page: Page,
  // ): Promise<{ success: boolean; error?: string }> {
  //   // Use the CookieConsentStep from the pipeline
  //   const cookieConsentStep = new CookieConsentStep(this.logger);
  //   return cookieConsentStep
  //     .execute(page, {} as AuthCredentials)
  //     .then((success) => ({
  //       success,
  //       error: success ? undefined : 'Failed to handle cookie consent',
  //     }));
  // }

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
