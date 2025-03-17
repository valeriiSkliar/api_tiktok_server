import { Page } from 'playwright';
import { Log } from 'crawlee';
import {
  IAuthenticator,
  ICaptchaSolver,
  IEmailVerificationHandler,
  ISessionManager,
} from '../interfaces';
import {
  TikTokAuthenticator,
  SadCaptchaSolver,
  TikTokEmailVerificationHandler,
  FileSystemSessionManager,
} from '../implementations';
import { EmailApiService } from '../services';

/**
 * Factory for creating authenticator instances
 */
export class AuthenticatorFactory {
  /**
   * Creates a TikTok authenticator with all necessary dependencies
   * @param page Playwright page object
   * @param logger Logger instance
   * @param options Additional options for authenticator creation
   * @returns TikTokAuthenticator instance
   */
  static createTikTokAuthenticator(
    page: Page,
    logger: Log,
    options: {
      sessionStoragePath?: string;
      captchaSolverApiKey?: string;
      emailApiBaseUrl?: string;
    } = {},
  ): IAuthenticator {
    // Set default options
    const sessionStoragePath =
      options.sessionStoragePath ||
      process.env.SESSION_STORAGE_PATH ||
      './storage/sessions';
    const captchaSolverApiKey =
      options.captchaSolverApiKey || process.env.SAD_CAPTCHA_API_KEY || '';
    const emailApiBaseUrl =
      options.emailApiBaseUrl ||
      process.env.EMAIL_API_BASE_URL ||
      'http://localhost:3000';

    // Create dependencies
    const sessionManager = AuthenticatorFactory.createSessionManager(
      sessionStoragePath,
      logger,
    );
    const captchaSolver = AuthenticatorFactory.createCaptchaSolver(
      captchaSolverApiKey,
      logger,
    );
    const emailVerifier = AuthenticatorFactory.createEmailVerificationHandler(
      emailApiBaseUrl,
      logger,
    );

    // Create and return the authenticator
    return new TikTokAuthenticator(
      page,
      logger,
      captchaSolver,
      emailVerifier,
      sessionManager,
    );
  }

  /**
   * Creates a session manager instance
   * @param storagePath Path to session storage directory
   * @param logger Logger instance
   * @returns ISessionManager implementation
   */
  private static createSessionManager(
    storagePath: string,
    logger: Log,
  ): ISessionManager {
    return new FileSystemSessionManager(storagePath, logger);
  }

  /**
   * Creates a captcha solver instance
   * @param apiKey API key for the captcha solving service
   * @param logger Logger instance
   * @returns ICaptchaSolver implementation
   */
  private static createCaptchaSolver(
    apiKey: string,
    logger: Log,
  ): ICaptchaSolver {
    return new SadCaptchaSolver(logger, apiKey);
  }

  /**
   * Creates an email verification handler instance
   * @param apiBaseUrl Base URL for the email API service
   * @param logger Logger instance
   * @returns IEmailVerificationHandler implementation
   */
  private static createEmailVerificationHandler(
    apiBaseUrl: string,
    logger: Log,
  ): IEmailVerificationHandler {
    // Create the email API service first
    const emailApiService = new EmailApiService(apiBaseUrl, logger);

    // Then create the email verification handler with the service
    return new TikTokEmailVerificationHandler(emailApiService, logger);
  }
}
