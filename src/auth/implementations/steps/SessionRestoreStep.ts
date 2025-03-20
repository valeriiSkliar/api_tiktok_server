// src/auth/implementations/steps/SessionRestoreStep.ts
import { Page } from 'playwright';
import { Log } from 'crawlee';
import {
  AuthStepType,
  IAuthenticationStep,
} from '../../interfaces/IAuthenticationStep';
import { AuthCredentials, Session } from '../../models';
import { SessionRestoreService } from '../../services/session/SessionRestoreService';

export class SessionRestoreStep implements IAuthenticationStep {
  private readonly logger: Log;
  private readonly sessionRestoreService: SessionRestoreService;
  private readonly sessionStoragePath: string;
  private sessionId: string;
  private currentSession: Session | null = null;

  constructor(
    logger: Log,
    sessionRestoreService: SessionRestoreService,
    sessionStoragePath: string,
  ) {
    this.logger = logger;
    this.sessionRestoreService = sessionRestoreService;
    this.sessionStoragePath = sessionStoragePath;
    this.sessionId = '';
  }

  getName(): string {
    return 'Session Restore';
  }

  getType(): AuthStepType {
    return AuthStepType.PRE_SESSION;
  }

  async execute(page: Page, credentials?: AuthCredentials): Promise<boolean> {
    if (!credentials?.email) {
      this.logger.error('Missing email credentials for session restoration');
      return false;
    }

    // Generate session ID from credentials
    this.sessionId = `tiktok_${credentials.email}`;

    try {
      // Attempt to restore session
      const sessionRestored = await this.sessionRestoreService.restoreSession(
        page,
        credentials.sessionPath || this.sessionStoragePath,
      );

      if (sessionRestored) {
        this.logger.info('Successfully restored previous session!');
        // Create a session object from the restored state
        const state = await page.context().storageState();
        this.currentSession = {
          id: this.sessionId,
          userId: credentials.email,
          cookies: state.cookies,
          headers: {
            'User-Agent': await page.evaluate(() => navigator.userAgent),
            'Accept-Language': 'en-US,en;q=0.9',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          },
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          lastUsedAt: new Date(),
          proxyConfig: credentials.proxyConfig,
        };

        return true;
      }

      // Session restoration failed, but this is not a critical error
      // We'll proceed with normal authentication flow
      this.logger.info(
        'Session restoration failed or expired, proceeding with new login',
      );
      return false;
    } catch (error) {
      this.logger.error('Error during session restoration:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return false but don't fail the authentication process
      // because we can still try standard login
      return false;
    }
  }

  // Method to get the restored session if available
  getRestoredSession(): Session | null {
    return this.currentSession;
  }
}
