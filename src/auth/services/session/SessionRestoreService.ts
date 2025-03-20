/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Page } from 'playwright';
import { Log } from 'crawlee';
import * as fs from 'fs-extra';
import { BrowserHelperService } from '..';

/**
 * Service for restoring saved browser sessions
 */
export class SessionRestoreService {
  private logger: Log;
  private browserHelperService: BrowserHelperService;

  /**
   * Creates a new SessionRestoreService instance
   * @param logger Logger instance
   */
  constructor(logger: Log) {
    this.logger = logger;
    this.browserHelperService = BrowserHelperService.getInstance();
  }

  /**
   * Attempts to restore a previously saved session state
   * @param page - Playwright Page instance
   * @param sessionPath - Path to the session state file
   * @returns Promise<boolean> - True if session was restored successfully
   */
  async restoreSession(page: Page, sessionPath: string): Promise<boolean> {
    try {
      await fs.access(sessionPath);
      this.logger.info(
        '[SessionRestoreService] Found saved session state, attempting to restore...',
        {
          sessionPath,
        },
      );

      // Clear existing storage before restoring
      await page.context().clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie.split(';').forEach((c) => {
          document.cookie = c
            .replace(/^ +/, '')
            .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
        });
      });

      // Restore the stored state
      const sessionState = JSON.parse(await fs.readFile(sessionPath, 'utf-8'));

      try {
        // Add cookies first
        await page.context().addCookies(sessionState.cookies);

        // First navigate to a simple page to initialize context
        try {
          await page.goto('about:blank', { timeout: 5000 });
        } catch (error: unknown) {
          const initError = error as Error;
          this.logger.debug(
            '[SessionRestoreService] Initial navigation to blank page failed:',
            {
              error: initError.message,
            },
          );
        }

        // Restore localStorage for each origin with retry logic
        if (sessionState.origins) {
          for (const { origin, localStorage } of sessionState.origins) {
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
              try {
                // Navigate to each origin to set its localStorage
                await page.goto(origin, {
                  waitUntil: 'domcontentloaded', // Less strict wait condition
                  timeout: 15000,
                });

                // Set localStorage items
                await page.evaluate((storageItems) => {
                  for (const [key, value] of Object.entries(storageItems)) {
                    try {
                      window.localStorage.setItem(key, value as string);
                    } catch (e) {
                      console.warn(
                        '[SessionRestoreService] Failed to set localStorage item: ${key}',
                        e,
                      );
                    }
                  }
                }, localStorage);

                break; // Success, exit retry loop
              } catch (error: unknown) {
                const navError = error as Error;
                retryCount++;
                if (retryCount === maxRetries) {
                  this.logger.warning(
                    '[SessionRestoreService] Failed to restore localStorage for origin ${origin} after ${maxRetries} attempts',
                    { error: navError.message },
                  );
                } else {
                  await this.browserHelperService.delay(
                    this.browserHelperService.randomBetween(2000, 3000),
                  );
                }
              }
            }
          }
        }

        // Verify cookie state
        const currentState = await page.context().storageState();
        if (!currentState.cookies || currentState.cookies.length === 0) {
          throw new Error(
            '[SessionRestoreService] State restoration verification failed: No cookies present',
          );
        }

        // Navigate to the main page with retry logic
        let loginSuccess = false;
        for (let i = 0; i < 3; i++) {
          try {
            // Try navigation with increasing timeouts
            await page.goto(
              'https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en',
              {
                waitUntil: 'domcontentloaded',
                timeout: 20000 + i * 5000,
              },
            );

            // Wait for network to be relatively idle
            await page
              .waitForLoadState('networkidle', { timeout: 10000 })
              .catch(() =>
                this.logger.debug(
                  '[SessionRestoreService] NetworkIdle wait timed out, continuing...',
                ),
              );

            await this.browserHelperService.delay(
              this.browserHelperService.randomBetween(2000, 3000),
            );

            // Verify login status
            loginSuccess = await this.browserHelperService.isLoggedIn(page);
            if (loginSuccess) break;

            // If not logged in, wait and retry
            await this.browserHelperService.delay(
              this.browserHelperService.randomBetween(3000, 5000),
            );
          } catch (error) {
            this.logger.warning(
              '[SessionRestoreService] Navigation attempt failed:',
              { error: (error as Error).message },
            );
            if (i === 2) throw error;
            await this.browserHelperService.delay(
              this.browserHelperService.randomBetween(3000, 5000),
            );
          }
        }

        if (!loginSuccess) {
          this.logger.warning(
            '[SessionRestoreService] Session restored but login check failed',
          );
          return false;
        }

        // Save the verified state back
        await page.context().storageState({ path: sessionPath });

        this.logger.info(
          '[SessionRestoreService] Session state restored and verified successfully',
        );
        return true;
      } catch (error) {
        this.logger.error(
          '[SessionRestoreService] Failed to restore session state:',
          { error: (error as Error).message },
        );
        // Clear everything on failure
        await page.context().clearCookies();
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        throw error;
      }
    } catch (err: unknown) {
      this.logger.error(
        '[SessionRestoreService] Error restoring session state:',
        { error: (err as Error).message },
      );
      this.logger.info(
        '[SessionRestoreService] No saved session found or error restoring session, proceeding with normal login',
      );
      return false;
    }
  }
}
