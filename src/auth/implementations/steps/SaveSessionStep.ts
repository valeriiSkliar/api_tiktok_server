// src/auth/implementations/steps/SaveSessionStep.ts

import { Page } from 'playwright';
import { Log } from 'crawlee';
import { IAuthenticationStep } from '../../interfaces/IAuthenticationStep';
import { AuthCredentials } from '../../models';
import { ISessionManager } from '../../interfaces/ISessionManager';
import { BrowserHelperService } from '../../services';
import * as path from 'path';

export class SaveSessionStep implements IAuthenticationStep {
  private readonly logger: Log;
  private readonly sessionManager: ISessionManager;
  private readonly browserHelper: BrowserHelperService;
  private readonly sessionStoragePath: string;

  constructor(
    logger: Log,
    sessionManager: ISessionManager,
    sessionStoragePath: string = 'storage/sessions',
  ) {
    this.logger = logger;
    this.sessionManager = sessionManager;
    this.browserHelper = BrowserHelperService.getInstance();
    this.sessionStoragePath = sessionStoragePath;
  }

  getName(): string {
    return 'Save Session';
  }

  async execute(page: Page, credentials?: AuthCredentials): Promise<boolean> {
    try {
      if (!credentials) {
        this.logger.error('Missing credentials for session saving');
        return false;
      }

      this.logger.info('Verifying successful login before saving session');

      // Check if we're actually logged in
      const isLoggedIn = await this.browserHelper.isLoggedIn(page);

      if (!isLoggedIn) {
        this.logger.error('Login check failed, not saving session');
        return false;
      }

      // Generate a safe filename from the email
      const sessionId = `tiktok_${credentials.email}`;
      const sessionStateFilename = `${sessionId}.json`;
      const sessionStatePath = path.join(
        this.sessionStoragePath,
        sessionStateFilename,
      );

      // Save browser storage state (cookies, localStorage, etc.)
      this.logger.info('Saving browser storage state', {
        path: sessionStatePath,
      });
      const state = await page.context().storageState();

      // Create and save the session in our session manager
      this.logger.info('Creating session object in session manager');

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

      const session = {
        id: sessionId,
        userId: credentials.email,
        cookies: state.cookies,
        headers: {
          'User-Agent': await page.evaluate(() => navigator.userAgent),
          'Accept-Language': 'en-US,en;q=0.9',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        },
        createdAt: now,
        expiresAt: expiresAt,
        lastUsedAt: now,
        proxyConfig: credentials.proxyConfig,
      };

      await this.sessionManager.saveSession(session);

      // Take a screenshot of the authenticated state for verification purposes
      await page.screenshot({
        path: `storage/screenshots/auth-success-${sessionId}.png`,
      });

      this.logger.info('Session successfully saved', {
        sessionId: session.id,
        expires: expiresAt,
        statePath: sessionStatePath,
      });

      return true;
    } catch (error) {
      this.logger.error('Error saving session:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return false;
    }
  }
}
