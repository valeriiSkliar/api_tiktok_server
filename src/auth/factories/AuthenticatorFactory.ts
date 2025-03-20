// src/auth/factories/AuthenticatorFactory.ts

import { Log, PlaywrightCrawlerOptions } from 'crawlee';
import { IAuthenticator, ICaptchaSolver, ISessionManager } from '../interfaces';
import {
  TikTokAuthenticator,
  SadCaptchaSolverService,
  FileSystemSessionManager,
} from '../implementations';
import { Env } from '@lib/Env';
import { EmailService } from '../../email/services/EmailService';
import { PrismaClient } from '@prisma/client';

/**
 * Factory for creating authenticator instances
 */
export class AuthenticatorFactory {
  /**
   * Creates a TikTok authenticator with all necessary dependencies
   * @param logger Logger instance
   * @param options Additional options for authenticator creation
   * @returns TikTokAuthenticator instance
   */
  static createTikTokAuthenticator(
    logger: Log,
    options: {
      sessionStoragePath?: string;
      captchaSolverApiKey?: string;
      crawlerOptions?: Partial<PlaywrightCrawlerOptions>;
      emailAccountId?: string;
    } = {},
  ): IAuthenticator {
    // Set default options
    const sessionStoragePath =
      options.sessionStoragePath ||
      process.env.SESSION_STORAGE_PATH ||
      './storage/sessions';
    const captchaSolverApiKey =
      options.captchaSolverApiKey || process.env.SAD_CAPTCHA_API_KEY || '';
    const crawlerOptions = options.crawlerOptions || {};

    // Create dependencies
    const sessionManager = AuthenticatorFactory.createSessionManager(
      sessionStoragePath,
      logger,
    );
    const captchaSolver = AuthenticatorFactory.createCaptchaSolver(
      captchaSolverApiKey,
      logger,
    );
    // const emailVerifier = AuthenticatorFactory.createEmailVerificationHandler(
    //   prisma,
    //   logger,
    // );

    // Create prisma client and email service
    const prisma = new PrismaClient();
    const emailService = new EmailService(prisma, logger);

    // Create and set up the authenticator
    const authenticator = new TikTokAuthenticator(
      logger,
      captchaSolver,
      // emailVerifier,
      sessionManager,
      crawlerOptions,
      emailService,
    );

    // Set the session storage path explicitly
    authenticator.setSessionStoragePath(sessionStoragePath);

    return authenticator;
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
    const screenshotsDir =
      Env.CAPTCHA_SCREENSHOTS_DIR || 'storage/captcha-screenshots';
    return new SadCaptchaSolverService(logger, apiKey, screenshotsDir);
  }

  /**
   * Creates an email verification handler instance
   * @param prisma Prisma client instance
   * @param logger Logger instance
   * @returns EmailService implementation
   */
  private static createEmailVerificationHandler(
    prisma: PrismaClient,
    logger: Log,
  ): EmailService {
    // Create the email service first
    return new EmailService(prisma, logger);
  }
}
