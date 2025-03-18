/* eslint-disable @typescript-eslint/require-await */
// src/auth/implementations/TikTokAuthenticator.ts (обновлённый)

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
import {
  CaptchaVerificationStep,
  CookieConsentStep,
  FillLoginFormStep,
  LoginButtonStep,
  SelectPhoneEmailLoginStep,
  SubmitLoginFormStep,
} from './steps';
import { BrowserHelperService } from '../services';
import { EmailService } from '../../email/services/EmailService';
import { EmailVerificationStep } from './steps/EmailVerificationStep';
import * as path from 'path';
import { SessionRestoreService } from '../services';

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
  private sessionRestoreService: SessionRestoreService;
  private currentSession: Session | null = null;
  private crawlerOptions: PlaywrightCrawlerOptions;
  private authPipeline: AuthenticationPipeline;
  private browserHelperService: BrowserHelperService;
  private emailService: EmailService;
  private loginUrl =
    'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en';
  private sessionStoragePath = 'storage/sessions';

  /**
   * Creates a new TikTokAuthenticator instance
   * @param logger Logger instance
   * @param captchaSolver Captcha solver implementation
   * @param emailVerifier Email verification handler implementation
   * @param sessionManager Session manager implementation
   * @param crawlerOptions Options for the PlaywrightCrawler
   * @param emailService Email service implementation
   */
  constructor(
    logger: Log,
    captchaSolver: ICaptchaSolver,
    emailVerifier: IEmailVerificationHandler,
    sessionManager: ISessionManager,
    crawlerOptions: Partial<PlaywrightCrawlerOptions> = {},
    emailService: EmailService,
  ) {
    this.authPipeline = new AuthenticationPipeline(logger);
    this.logger = logger;

    this.captchaSolver = captchaSolver;
    this.emailVerifier = emailVerifier;
    this.sessionManager = sessionManager;
    this.emailService = emailService;
    this.sessionRestoreService = new SessionRestoreService(logger);
    this.router = createPlaywrightRouter();

    // Initialize browser helper service
    this.browserHelperService = BrowserHelperService.getInstance();
    this.browserHelperService.setLogger(logger);

    // Set default crawler options
    this.crawlerOptions = {
      headless: process.env.HEADLESS === 'true',
      ...crawlerOptions,
    };

    // Configure authentication pipeline with steps
    this.authPipeline
      .addStep(new CookieConsentStep(logger))
      .addStep(new LoginButtonStep(logger))
      .addStep(new SelectPhoneEmailLoginStep(logger))
      .addStep(new FillLoginFormStep(logger))
      .addStep(new SubmitLoginFormStep(logger))
      .addStep(new CaptchaVerificationStep(logger, captchaSolver))
      .addStep(new EmailVerificationStep(logger, emailService));
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

    // Define the session state path based on credentials
    const sessionStateFilename = `tiktok_${credentials.email.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const sessionStatePath = path.join(
      this.sessionStoragePath,
      sessionStateFilename,
    );

    this.router.addDefaultHandler(async (ctx) => {
      try {
        this.logger.info('Starting authentication process');

        // Attempt to restore session
        const sessionRestored = await this.sessionRestoreService.restoreSession(
          ctx.page,
          sessionStatePath,
        );

        if (sessionRestored) {
          this.logger.info('Successfully restored previous session!');
          // Create a session object from the restored state
          const state = await ctx.page.context().storageState();
          this.currentSession = {
            id: `tiktok_${credentials.email}_${Date.now()}`,
            userId: credentials.email,
            cookies: state.cookies,
            headers: {
              'User-Agent': await ctx.page.evaluate(() => navigator.userAgent),
              'Accept-Language': 'en-US,en;q=0.9',
              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            },
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            lastUsedAt: new Date(),
            proxyConfig: credentials.proxyConfig,
          };

          // Save the restored session via the session manager
          await this.sessionManager.saveSession(this.currentSession);
        } else {
          this.logger.info(
            'Session restoration failed or expired, proceeding with new login',
          );
          // Run the authentication pipeline if session restoration fails
          await this.authPipeline.execute(ctx.page, credentials);

          // Save the new session state after successful login
          const isLoggedIn = await this.browserHelperService.isLoggedIn(
            ctx.page,
          );
          if (isLoggedIn) {
            await ctx.page.context().storageState({ path: sessionStatePath });
            this.logger.info('New session state saved successfully');

            // Create and save the new session
            const state = await ctx.page.context().storageState();
            this.currentSession = {
              id: `tiktok_${credentials.email}_${Date.now()}`,
              userId: credentials.email,
              cookies: state.cookies,
              headers: {
                'User-Agent': await ctx.page.evaluate(
                  () => navigator.userAgent,
                ),
                'Accept-Language': 'en-US,en;q=0.9',
                Accept:
                  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              },
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
              lastUsedAt: new Date(),
              proxyConfig: credentials.proxyConfig,
            };

            await this.sessionManager.saveSession(this.currentSession);
          } else {
            this.logger.error(
              'Login verification failed after authentication pipeline',
            );
          }
        }
      } catch (error) {
        this.logger.error('Error during authentication process:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Take a screenshot to help debug the error
        await ctx.page.screenshot({
          path: `storage/screenshots/auth-error-${new Date().getTime()}.png`,
        });
      }
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
   * Cleans up resources used by the authenticator
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing TikTok authenticator');

    if (this.crawler) {
      await this.crawler.teardown();
      this.crawler = null;
    }
  }

  /**
   * Set the session storage path
   * @param path Path to store session files
   */
  setSessionStoragePath(path: string): void {
    this.sessionStoragePath = path;
  }
}
