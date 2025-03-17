import { Page } from 'playwright';
import { Log } from 'crawlee';
import {
  IAuthenticator,
  ICaptchaSolver,
  IEmailVerificationHandler,
  ISessionManager,
} from '../interfaces';
import { AuthCredentials, AuthResult, Session } from '../models';

/**
 * TikTok authenticator implementation
 * Handles the authentication process for TikTok
 */
export class TikTokAuthenticator implements IAuthenticator {
  private page: Page;
  private logger: Log;
  private captchaSolver: ICaptchaSolver;
  private emailVerifier: IEmailVerificationHandler;
  private sessionManager: ISessionManager;
  private currentSession: Session | null = null;

  /**
   * Creates a new TikTokAuthenticator instance
   * @param page Playwright page object
   * @param logger Logger instance
   * @param captchaSolver Captcha solver implementation
   * @param emailVerifier Email verification handler implementation
   * @param sessionManager Session manager implementation
   */
  constructor(
    page: Page,
    logger: Log,
    captchaSolver: ICaptchaSolver,
    emailVerifier: IEmailVerificationHandler,
    sessionManager: ISessionManager,
  ) {
    this.page = page;
    this.logger = logger;
    this.captchaSolver = captchaSolver;
    this.emailVerifier = emailVerifier;
    this.sessionManager = sessionManager;
  }

  /**
   * Performs login with the provided credentials
   * @param credentials User credentials for authentication
   * @returns Promise resolving to authentication result
   */
  async login(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      this.logger.info('Starting TikTok login process', {
        email: credentials.email,
      });

      // Step 1: Navigate to the login page
      await this.navigateToLoginPage();

      // Step 2: Select login method (email/phone)
      await this.selectLoginMethod();

      // Step 3: Fill in the login form
      await this.fillLoginForm(credentials);

      // Step 4: Submit the login form
      await this.submitLoginForm();

      // Step 5: Handle captcha if present
      const captchaResult = await this.captchaSolver.detect(this.page);
      if (captchaResult.detected) {
        this.logger.info('Captcha detected, attempting to solve');
        const solved = await this.captchaSolver.solve(this.page, captchaResult);
        if (!solved) {
          this.logger.error('Failed to solve captcha');
          return { success: false, error: 'Failed to solve captcha' };
        }
        this.logger.info('Captcha solved successfully');
      }

      // Step 6: Handle email verification if needed
      const needsEmailVerification = await this.checkEmailVerification();
      if (needsEmailVerification) {
        this.logger.info('Email verification required');
        const code = await this.emailVerifier.waitForCode(credentials.email);
        if (!code) {
          this.logger.error('Failed to get verification code');
          return { success: false, error: 'Failed to get verification code' };
        }

        this.logger.info('Verification code received, submitting');
        const verified = await this.emailVerifier.submitCode(this.page, code);
        if (!verified) {
          this.logger.error('Failed to verify email code');
          return { success: false, error: 'Failed to verify email code' };
        }
        this.logger.info('Email verification successful');
      }

      // Step 7: Check if login was successful
      const isLoggedIn = await this.checkLoginSuccess();
      if (!isLoggedIn) {
        this.logger.error('Login failed after all steps');
        return { success: false, error: 'Login failed after all steps' };
      }

      // Step 8: Extract and save session data
      this.logger.info('Login successful, extracting session data');
      const session = await this.extractSessionData(credentials);
      await this.sessionManager.saveSession(session);
      this.currentSession = session;

      this.logger.info('Login process completed successfully');
      return { success: true, session };
    } catch (error) {
      this.logger.error('Login failed with exception', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Take a screenshot for debugging
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await this.page.screenshot({
          path: `storage/screenshots/login-error-${timestamp}.png`,
          fullPage: true,
        });
      } catch (screenshotError) {
        this.logger.error('Failed to take error screenshot', {
          error:
            screenshotError instanceof Error
              ? screenshotError.message
              : String(screenshotError),
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verifies if the current session is valid
   * @returns Promise resolving to boolean indicating session validity
   */
  async verifySession(): Promise<boolean> {
    try {
      if (!this.currentSession) {
        this.logger.warning('No current session to verify');
        return false;
      }

      this.logger.info('Verifying session validity');

      // Navigate to a page that requires authentication
      await this.page.goto(
        'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
      );

      // Check if we're still logged in
      const isLoggedIn = await this.checkLoginSuccess();

      if (isLoggedIn) {
        this.logger.info('Session is valid');

        // Update last used timestamp
        this.currentSession.lastUsedAt = new Date();
        await this.sessionManager.saveSession(this.currentSession);
      } else {
        this.logger.warning('Session is invalid');
      }

      return isLoggedIn;
    } catch (error) {
      this.logger.error('Error verifying session', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Refreshes the current session to extend its validity
   * @returns Promise resolving to boolean indicating success
   */
  async refreshSession(): Promise<boolean> {
    try {
      if (!this.currentSession) {
        this.logger.warning('No current session to refresh');
        return false;
      }

      this.logger.info('Refreshing session');

      // First verify if the session is still valid
      const isValid = await this.verifySession();
      if (!isValid) {
        this.logger.warning('Cannot refresh invalid session');
        return false;
      }

      // Perform some activity to keep the session alive
      await this.page.goto(
        'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
      );
      await this.page.waitForTimeout(2000); // Wait for page to load

      // Update session expiration time (extend by 24 hours)
      const currentExpiry = this.currentSession.expiresAt;
      const newExpiry = new Date(currentExpiry);
      newExpiry.setHours(newExpiry.getHours() + 24);

      this.currentSession.expiresAt = newExpiry;
      this.currentSession.lastUsedAt = new Date();

      // Save updated session
      await this.sessionManager.saveSession(this.currentSession);

      this.logger.info('Session refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('Error refreshing session', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Performs logout, invalidating the current session
   * @returns Promise resolving when logout is complete
   */
  async logout(): Promise<void> {
    try {
      if (!this.currentSession) {
        this.logger.warning('No current session to logout from');
        return;
      }

      this.logger.info('Logging out');

      // Navigate to TikTok
      await this.page.goto(
        'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
      );

      // Try to find and click the logout button
      try {
        // Look for common logout button selectors
        const logoutSelectors = [
          'a[href*="logout"]',
          'button:has-text("Logout")',
          'button:has-text("Log out")',
          'div[role="button"]:has-text("Logout")',
          'div[role="button"]:has-text("Log out")',
        ];

        // Try each selector
        for (const selector of logoutSelectors) {
          const logoutButton = await this.page.$(selector);
          if (logoutButton) {
            this.logger.info(`Found logout button with selector: ${selector}`);
            await logoutButton.click();
            await this.page.waitForTimeout(2000); // Wait for logout to process
            break;
          }
        }
      } catch (logoutError) {
        this.logger.warning('Could not find logout button', {
          error:
            logoutError instanceof Error
              ? logoutError.message
              : String(logoutError),
        });
        // Continue anyway to delete the session
      }

      // Delete the session from storage
      if (this.currentSession.id) {
        await this.sessionManager.deleteSession(this.currentSession.id);
      }

      // Clear the current session
      this.currentSession = null;

      this.logger.info('Logout completed');
    } catch (error) {
      this.logger.error('Error during logout', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Navigates to the TikTok login page
   * @private
   */
  private async navigateToLoginPage(): Promise<void> {
    this.logger.info('Navigating to TikTok login page');

    // Navigate to TikTok Ads Creative Center
    await this.page.goto(
      'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
    );

    // Wait for the page to load
    await this.page.waitForLoadState('networkidle');

    // Look for the login button
    const loginButtonSelectors = [
      'div[data-testid="cc_header_login"]',
      'div.FixedHeaderPc_loginBtn__lL73Y',
      'a:has-text("Log in")',
      'a:has-text("Login")',
      'button:has-text("Log in")',
      'button:has-text("Login")',
    ];

    let loginButtonFound = false;
    for (const selector of loginButtonSelectors) {
      try {
        const loginButton = await this.page.waitForSelector(selector, {
          timeout: 5000,
        });
        if (loginButton) {
          this.logger.info(`Found login button with selector: ${selector}`);
          await loginButton.click();
          loginButtonFound = true;
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }

    if (!loginButtonFound) {
      this.logger.warning(
        'Could not find login button with predefined selectors',
      );
      throw new Error('Could not find login button');
    }

    // Wait for login modal or page to appear
    await this.page.waitForTimeout(3000);
  }

  /**
   * Selects the email/phone login method
   * @private
   */
  private async selectLoginMethod(): Promise<void> {
    this.logger.info('Selecting email/phone login method');

    // Try different selectors for the "Log in with phone/email" button
    const phoneEmailSelectors = [
      'div.Button_loginBtn__ImwTi:has-text("Log in with phone/email")',
      'div.loginBtn:has-text("phone/email")',
      'button:has-text("phone/email")',
      'a:has-text("phone/email")',
    ];

    let methodSelected = false;
    for (const selector of phoneEmailSelectors) {
      try {
        const button = await this.page.waitForSelector(selector, {
          timeout: 3000,
        });
        if (button) {
          this.logger.info(
            `Found phone/email login button with selector: ${selector}`,
          );
          await button.click();
          methodSelected = true;

          // Wait for the login form to appear
          await this.page.waitForTimeout(2000);
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }

    if (!methodSelected) {
      // Check if we're already on the email/phone login form
      const emailInputSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="Email"]',
      ];

      for (const selector of emailInputSelectors) {
        const emailInput = await this.page.$(selector);
        if (emailInput) {
          this.logger.info('Already on email/phone login form');
          methodSelected = true;
          break;
        }
      }
    }

    if (!methodSelected) {
      this.logger.warning('Could not select email/phone login method');
      // We'll continue anyway, as the login form might already be visible
    }
  }

  /**
   * Fills in the login form with credentials
   * @param credentials User credentials
   * @private
   */
  private async fillLoginForm(credentials: AuthCredentials): Promise<void> {
    this.logger.info('Filling login form');

    // Find email input field
    const emailSelectors = [
      '#TikTok_Ads_SSO_Login_Email_Input',
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="Email"]',
      'input[placeholder*="email"]',
      'input[class*="email"]',
    ];

    let emailInput: any = null;
    for (const selector of emailSelectors) {
      try {
        emailInput = await this.page.waitForSelector(selector, {
          timeout: 2000,
        });
        if (emailInput) {
          this.logger.info(`Found email input with selector: ${selector}`);
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }

    if (!emailInput) {
      this.logger.error('Could not find email input field');
      throw new Error('Could not find email input field');
    }

    // Type email with human-like delays
    await this.typeWithHumanDelay(emailInput, credentials.email);

    // Find password input field
    const passwordSelectors = [
      '#TikTok_Ads_SSO_Login_Pwd_Input',
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="Password"]',
      'input[placeholder*="password"]',
      'input[class*="password"]',
    ];

    let passwordInput: any = null;
    for (const selector of passwordSelectors) {
      try {
        passwordInput = await this.page.waitForSelector(selector, {
          timeout: 2000,
        });
        if (passwordInput) {
          this.logger.info(`Found password input with selector: ${selector}`);
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }

    if (!passwordInput) {
      this.logger.error('Could not find password input field');
      throw new Error('Could not find password input field');
    }

    // Type password with human-like delays
    await this.typeWithHumanDelay(passwordInput, credentials.password);
  }

  /**
   * Submits the login form
   * @private
   */
  private async submitLoginForm(): Promise<void> {
    this.logger.info('Submitting login form');

    // Find and click the login button
    const loginButtonSelectors = [
      '#TikTok_Ads_SSO_Login_Btn',
      'button[name="loginBtn"]',
      'button.btn.primary',
      'button.tiktokads-common-login-form-submit',
      'button[data-e2e="login-button"]',
      'button[type="submit"]',
      'button:has-text("Log in")',
      'button:has-text("Login")',
      'button:has-text("Sign In")',
    ];

    let loginButton: any = null;
    for (const selector of loginButtonSelectors) {
      try {
        loginButton = await this.page.waitForSelector(selector, {
          timeout: 2000,
        });
        if (loginButton) {
          this.logger.info(
            `Found login submit button with selector: ${selector}`,
          );
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }

    if (!loginButton) {
      this.logger.error('Could not find login submit button');
      throw new Error('Could not find login submit button');
    }

    // Click the login button
    await loginButton.click();

    // Wait for navigation or response
    await this.page.waitForTimeout(5000);
  }

  /**
   * Checks if email verification is required
   * @returns Promise resolving to boolean indicating if verification is needed
   * @private
   */
  private async checkEmailVerification(): Promise<boolean> {
    this.logger.info('Checking for email verification requirement');

    // Email verification selectors
    const verificationSelectors = [
      'div.tiktokads-common-login-code-form',
      'input[placeholder="Enter verification code"]',
      'div:has-text("Verification code")',
      'div:has-text("For security reasons, a verification code has been sent to")',
      '#TikTok_Ads_SSO_Login_Code_Content',
    ];

    // Check for verification form presence
    for (const selector of verificationSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            this.logger.info(
              `Email verification required, detected with selector: ${selector}`,
            );
            return true;
          }
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    this.logger.info('No email verification required');
    return false;
  }

  /**
   * Checks if login was successful
   * @returns Promise resolving to boolean indicating success
   * @private
   */
  private async checkLoginSuccess(): Promise<boolean> {
    this.logger.info('Checking login success');

    // Method 1: Check for user avatar which is typically visible after login
    const avatarSelectors = [
      'img[data-e2e="user-avatar"]',
      '.tiktok-avatar',
      'img[class*="avatar"]',
      'div[class*="avatar"]',
      '.user-info',
      '.user-profile',
      '.account-info',
    ];

    for (const selector of avatarSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element && (await element.isVisible())) {
          this.logger.info(
            `Login successful, found avatar with selector: ${selector}`,
          );
          return true;
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    // Method 2: Check URL for successful redirect
    const currentUrl = this.page.url();
    const isRedirectedToHome =
      currentUrl.includes('/home') ||
      currentUrl.includes('/dashboard') ||
      !currentUrl.includes('/login');

    if (isRedirectedToHome) {
      this.logger.info(`Login successful, redirected to: ${currentUrl}`);
      return true;
    }

    // Method 3: Check for error messages
    const errorSelectors = [
      '.login-error',
      '.error-message',
      'div[class*="error"]',
      'span[class*="error"]',
      'p:has-text("incorrect")',
      'p:has-text("Invalid")',
      '.tiktokads-common-login-form-error',
      '[data-e2e="login-error"]',
    ];

    for (const selector of errorSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element && (await element.isVisible())) {
          const errorText = (await element.textContent()) || 'Unknown error';
          this.logger.error(`Login failed with error: ${errorText}`);
          return false;
        }
      } catch (error) {
        // Continue checking other selectors
      }
    }

    this.logger.warning('Login status unclear, assuming failure');
    return false;
  }

  /**
   * Extracts session data from the page
   * @param credentials User credentials used for login
   * @returns Promise resolving to session data
   * @private
   */
  private async extractSessionData(
    credentials: AuthCredentials,
  ): Promise<Session> {
    this.logger.info('Extracting session data');

    // Get cookies
    const cookies = await this.page.context().cookies();

    // Create a unique session ID
    const sessionId = `tiktok_${credentials.email}_${Date.now()}`;

    // Extract useful headers
    const headers: Record<string, string> = {
      'User-Agent': await this.page.evaluate(() => navigator.userAgent),
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    };

    // Set expiration time (24 hours from now)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create session object
    const session: Session = {
      id: sessionId,
      userId: credentials.email, // Using email as user ID
      cookies,
      headers,
      createdAt: now,
      expiresAt,
      lastUsedAt: now,
      proxyConfig: credentials.proxyConfig,
    };

    this.logger.info('Session data extracted successfully');
    return session;
  }

  /**
   * Types text with human-like delays
   * @param element Element to type into
   * @param text Text to type
   * @private
   */
  private async typeWithHumanDelay(element: any, text: string): Promise<void> {
    // Clear the field first
    await element.click({ clickCount: 3 }); // Triple click to select all
    await element.press('Backspace');

    // Type with random delays between keystrokes
    for (const char of text) {
      await element.type(char, { delay: this.randomBetween(100, 300) });
    }

    // Small pause after typing
    await this.page.waitForTimeout(this.randomBetween(300, 800));
  }

  /**
   * Generates a random number between min and max
   * @param min Minimum value
   * @param max Maximum value
   * @returns Random number
   * @private
   */
  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
}
