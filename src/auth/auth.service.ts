import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, Page } from 'playwright';
import { Log } from 'crawlee';
import { AuthenticatorFactory } from './factories';
import { IAuthenticator } from './interfaces';
import { AuthCredentials } from './models';

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private authenticator: IAuthenticator | null = null;
  private logger: Log;

  constructor(private configService: ConfigService) {
    this.logger = new Log({ prefix: 'AuthService' });
  }

  /**
   * Initialize the service when the module starts
   */
  async onModuleInit(): Promise<void> {
    this.logger.info('Initializing AuthService');

    try {
      // Launch browser
      this.browser = await chromium.launch({
        headless: this.configService.get<boolean>('HEADLESS', true),
      });

      // Create a new page
      this.page = await this.browser.newPage();

      // Create authenticator
      if (this.page) {
        this.authenticator = AuthenticatorFactory.createTikTokAuthenticator(
          this.logger,
          {
            sessionStoragePath: this.configService.get<string>(
              'SESSION_STORAGE_PATH',
              './storage/sessions',
            ),
            captchaSolverApiKey: this.configService.get<string>(
              'SAD_CAPTCHA_API_KEY',
              '',
            ),
          },
        );
      }

      this.logger.info('AuthService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AuthService', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Clean up resources when the module is destroyed
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.info('Cleaning up AuthService resources');

    try {
      // Close the page if it exists
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      // Close the browser if it exists
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      this.logger.info('AuthService resources cleaned up successfully');
    } catch (error) {
      this.logger.error('Error cleaning up AuthService resources', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Login to TikTok with the provided credentials
   * @param credentials Authentication credentials
   * @returns Authentication result
   */
  async login(credentials: AuthCredentials): Promise<void> {
    if (!this.authenticator) {
      this.logger.error('Authenticator not initialized');
      // return { success: false, error: 'Authenticator not initialized' };
    }

    try {
      this.logger.info('Attempting to login to TikTok', {
        email: credentials.email,
      });
      const result = await this.authenticator?.runAuthenticator(credentials);
      return result;
    } catch (error) {
      this.logger.error('Error during login', {
        error: error instanceof Error ? error.message : String(error),
      });
      // return {
      //   success: false,
      //   error: error instanceof Error ? error.message : String(error),
      // };
    }
  }

  /**
   * Verify if the current session is valid
   * @returns Boolean indicating if session is valid
   */
  async verifySession(): Promise<boolean> {
    if (!this.authenticator) {
      this.logger.error('Authenticator not initialized');
      return false;
    }

    try {
      this.logger.info('Verifying session');
      return await this.authenticator.verifySession();
    } catch (error) {
      this.logger.error('Error verifying session', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Refresh the current session
   * @returns Boolean indicating if refresh was successful
   */
  async refreshSession(): Promise<boolean> {
    if (!this.authenticator) {
      this.logger.error('Authenticator not initialized');
      return false;
    }

    try {
      this.logger.info('Refreshing session');
      return await this.authenticator.refreshSession();
    } catch (error) {
      this.logger.error('Error refreshing session', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Logout from the current session
   */
  async logout(): Promise<void> {
    if (!this.authenticator) {
      this.logger.error('Authenticator not initialized');
      return;
    }

    try {
      this.logger.info('Logging out');
      await this.authenticator.logout();
    } catch (error) {
      this.logger.error('Error during logout', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
