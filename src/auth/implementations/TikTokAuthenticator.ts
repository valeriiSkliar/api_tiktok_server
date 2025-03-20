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
import {
  CaptchaVerificationStep,
  CookieConsentStep,
  FillLoginFormStep,
  LoginButtonStep,
  SaveSessionStep,
  SelectPhoneEmailLoginStep,
  SubmitLoginFormStep,
  EmailVerificationStep,
} from './steps';
import { BrowserHelperService } from '../services';
import { EmailService } from '../services';
import { SessionRestoreService } from '../services';
import { PrismaClient } from '@prisma/client';
import { SessionRestoreStep } from './steps/SessionRestoreStep';
import { RequestInterceptionSetupStep } from './steps/RequestInterceptionSetupStep';

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
  private prisma: PrismaClient;
  private sessionRestoreStep: SessionRestoreStep;
  private requestInterceptionStep: RequestInterceptionSetupStep;

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
    sessionManager: ISessionManager,
    crawlerOptions: Partial<PlaywrightCrawlerOptions> = {},
    emailService: EmailService,
  ) {
    this.authPipeline = new AuthenticationPipeline(logger);
    this.logger = logger;

    this.captchaSolver = captchaSolver;
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

    // Initialize steps that need to be accessed outside the pipeline
    this.sessionRestoreStep = new SessionRestoreStep(
      logger,
      this.sessionRestoreService,
      this.sessionStoragePath,
    );
    this.requestInterceptionStep = new RequestInterceptionSetupStep(logger);

    // Add all steps to the pipeline
    this.authPipeline
      .addStep(this.sessionRestoreStep)
      .addStep(this.requestInterceptionStep)
      .addStep(new CookieConsentStep(logger))
      .addStep(new LoginButtonStep(logger))
      .addStep(new SelectPhoneEmailLoginStep(logger))
      .addStep(new FillLoginFormStep(logger))
      .addStep(new SubmitLoginFormStep(logger))
      .addStep(new CaptchaVerificationStep(logger, captchaSolver))
      .addStep(new EmailVerificationStep(logger, emailService))
      .addStep(
        new SaveSessionStep(logger, sessionManager, this.sessionStoragePath),
      );

    this.prisma = new PrismaClient();
  }

  async runAuthenticator(credentials: AuthCredentials): Promise<void> {
    this.crawler = await this.initCrawler(credentials);
    try {
      await this.crawler?.run([this.loginUrl]);
    } catch (error) {
      this.logger.error('Error running authenticator:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      await this.prisma.$disconnect();
      // await this.crawler?.teardown();
    }
  }

  /**
   * Initialize the crawler with the appropriate request handlers
   * @private
   */
  private async initCrawler(
    credentials: AuthCredentials,
  ): Promise<PlaywrightCrawler> {
    if (this.crawler) {
      return this.crawler;
    }

    this.logger.info(
      'Initializing PlaywrightCrawler for TikTok authentication',
    );

    // Define the session state path based on credentials
    let sessionStatePath = '';
    let validSessionId: number | null = null;

    // Get valid session from database
    try {
      const validSession = await this.prisma.session.findFirst({
        where: {
          email: credentials.email,
          is_valid: true,
          expires_at: {
            gt: new Date(), // Not expired
          },
          status: 'ACTIVE',
        },
        orderBy: {
          last_activity_timestamp: 'desc', // Get the most recently used session
        },
      });

      this.logger.info('Valid session found:', {
        email: credentials.email,
        session: validSession,
      });

      if (validSession?.session_data && validSession.storage_path) {
        // Ensure storage_path is a string before assigning
        const storagePath = String(validSession.storage_path);
        if (storagePath) {
          sessionStatePath = storagePath;
        }
        validSessionId = validSession.id;
      }
    } catch (error) {
      this.logger.error('Error getting valid session:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    this.router.addDefaultHandler(async (ctx) => {
      try {
        this.logger.info('Starting authentication process');

        // Используем шаг для настройки перехвата запросов
        if (validSessionId) {
          this.requestInterceptionStep.setSessionId(validSessionId);
        }
        await this.requestInterceptionStep.execute(ctx.page);

        // Используем шаг для восстановления сессии
        const sessionRestored = await this.sessionRestoreStep.execute(
          ctx.page,
          {
            ...credentials,
            sessionPath: sessionStatePath,
          },
        );

        if (sessionRestored) {
          // Получаем восстановленную сессию
          this.currentSession = this.sessionRestoreStep.getRestoredSession();

          // Настраиваем перехват запросов еще раз после восстановления сессии
          await this.requestInterceptionStep.execute(ctx.page);
        } else {
          this.logger.info(
            'Session restoration failed or expired, proceeding with new login',
          );
          // Если сессия не была восстановлена, запускаем аутентификационный пайплайн
          await this.authPipeline.execute(ctx.page, credentials);
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
