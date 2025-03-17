import { Log } from 'crawlee';
import { AuthCredentials, AuthResult } from '../models';
import { TikTokAuthenticator } from './TikTokAuthenticator';
import {
  ICaptchaSolver,
  IEmailVerificationHandler,
  ISessionManager,
} from '../interfaces';

export class TikTokAuthFacade {
  private authenticator: TikTokAuthenticator;

  constructor(
    logger: Log,
    captchaSolver: ICaptchaSolver,
    emailVerifier: IEmailVerificationHandler,
    sessionManager: ISessionManager,
  ) {
    this.authenticator = new TikTokAuthenticator(
      logger,
      captchaSolver,
      emailVerifier,
      sessionManager,
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
