import { Log } from 'crawlee';
import { AuthCredentials, AuthResult } from '../models';
import { TikTokAuthenticator } from './TikTokAuthenticator';
import {
  ICaptchaSolver,
  // IEmailVerificationHandler,
  ISessionManager,
} from '../interfaces';
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../services';
import { PlaywrightCrawlerOptions } from 'crawlee';
import { EmailAccount } from '@src/email-account/entities/email-account.entity';

export class TikTokAuthFacade {
  private authenticator: TikTokAuthenticator;

  constructor(
    logger: Log,
    captchaSolver: ICaptchaSolver,
    // emailVerifier: IEmailVerificationHandler,
    sessionManager: ISessionManager,
    crawlerOptions: Partial<PlaywrightCrawlerOptions> = {},
    emailAccount: EmailAccount,
  ) {
    // Create prisma client and email service
    const prisma = new PrismaClient();
    const emailService = new EmailService(prisma, logger, emailAccount);

    this.authenticator = new TikTokAuthenticator(
      logger,
      captchaSolver,
      sessionManager,
      crawlerOptions,
      emailService,
    );
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      await this.authenticator.runAuthenticator(credentials);
      // Additional logic to determine success and return appropriate result
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async verifySession(): Promise<boolean> {
    return this.authenticator.verifySession();
  }

  async refreshSession(): Promise<boolean> {
    return this.authenticator.refreshSession();
  }

  async logout(): Promise<void> {
    return this.authenticator.logout();
  }

  async dispose(): Promise<void> {
    return this.authenticator.dispose();
  }
}
