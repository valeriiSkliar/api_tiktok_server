import { PlaywrightCrawler, Log } from 'crawlee';
import * as dotenv from 'dotenv';
import { AuthenticatorFactory } from './auth/factories/AuthenticatorFactory';
import { AuthCredentials } from './auth/models/AuthCredentials';
import { Env } from '../lib/Env';

// Load environment variables
dotenv.config();

/**
 * Main function to run the authenticator
 */
async function runAuthenticator() {
  const logger = new Log({ prefix: 'AuthRunner' });
  logger.info('Starting TikTok authenticator runner');
  const headless = Env.HEADLESS;
  logger.info('Headless mode: ' + headless);
  try {
    // Create a PlaywrightCrawler instance
    const crawler = new PlaywrightCrawler({
      // Use headless mode based on environment variable
      headless,

      // Define the request handler - this is where we'll implement our authentication logic
      async requestHandler({ page, log }) {
        log.info('Starting authentication flow');

        // Create authenticator using the factory
        const authenticator = AuthenticatorFactory.createTikTokAuthenticator(
          page,
          log,
          {
            sessionStoragePath:
              process.env.SESSION_STORAGE_PATH || './storage/sessions',
            captchaSolverApiKey: process.env.SAD_CAPTCHA_API_KEY || '',
            emailApiBaseUrl:
              process.env.EMAIL_API_BASE_URL || 'http://localhost:3000',
          },
        );

        // Check if credentials are provided
        const email = process.env.TIKTOK_EMAIL;
        const password = process.env.TIKTOK_PASSWORD;

        if (!email || !password) {
          log.error('TikTok credentials not provided in environment variables');
          return;
        }

        // Perform login
        const credentials: AuthCredentials = {
          email,
          password,
        };

        log.info('Attempting to login to TikTok', {
          email: credentials.email,
        });

        const result = await authenticator.login(credentials);

        if (result.success) {
          log.info('Login successful', {
            sessionId: result.session?.id,
          });

          // Set up interval to verify and refresh session periodically
          // const sessionMaintenanceInterval = setInterval(
          //   async () => {
          //     try {
          //       log.info('Verifying session...');
          //       const isValid = await authenticator.verifySession();

          //       if (isValid) {
          //         log.info('Session is valid');
          //       } else {
          //         log.warning('Session is invalid, attempting to refresh');
          //         const refreshed = await authenticator.refreshSession();

          //         if (refreshed) {
          //           log.info('Session refreshed successfully');
          //         } else {
          //           log.error(
          //             'Failed to refresh session, attempting to login again',
          //           );
          //           const loginResult = await authenticator.login(credentials);

          //           if (loginResult.success) {
          //             log.info('Re-login successful');
          //           } else {
          //             log.error('Re-login failed', {
          //               error: loginResult.error,
          //             });
          //           }
          //         }
          //       }
          //     } catch (error: unknown) {
          //       log.error('Error in session maintenance', {
          //         error: error instanceof Error ? error.message : String(error),
          //       });
          //     }
          //   },
          //   30 * 60 * 1000,
          // );

          // Keep the crawler running indefinitely
          await new Promise(() => {
            // This promise never resolves, keeping the process alive
            // The crawler will be terminated by SIGINT or SIGTERM signals
          });

          // This code is unreachable but included for completeness
          // clearInterval(sessionMaintenanceInterval);
        } else {
          log.error('Login failed', { error: result.error });
        }
      },

      // Handle failures
      failedRequestHandler({ request, log, error }) {
        log.error(`Request ${request.url} failed`, {
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });

    // Set up cleanup on process termination
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, stopping crawler...');
      void crawler.teardown().then(() => {
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, stopping crawler...');
      void crawler.teardown().then(() => {
        process.exit(0);
      });
    });

    // Run the crawler with a single start URL (TikTok login page)
    await crawler.run(['https://www.tiktok.com/login']);
  } catch (error: unknown) {
    logger.error('Error in authenticator runner', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Run the authenticator
runAuthenticator().catch((error: unknown) => {
  console.error('Unhandled error in runAuthenticator:', error);
  process.exit(1);
});
