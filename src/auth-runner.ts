import { Log } from 'crawlee';
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
    // Create authenticator using the factory
    const authenticator = AuthenticatorFactory.createTikTokAuthenticator(
      logger,
      {
        sessionStoragePath:
          process.env.SESSION_STORAGE_PATH || './storage/sessions',
        captchaSolverApiKey: process.env.SAD_CAPTCHA_API_KEY || '',
        emailApiBaseUrl:
          process.env.EMAIL_API_BASE_URL || 'http://localhost:3000',
        crawlerOptions: {
          headless,
        },
      },
    );

    // Check if credentials are provided
    const email = process.env.TIKTOK_EMAIL;
    const password = process.env.TIKTOK_PASSWORD;

    if (!email || !password) {
      logger.error('TikTok credentials not provided in environment variables');
      return;
    }

    // Perform login
    const credentials: AuthCredentials = {
      email,
      password,
    };

    logger.info('Attempting to login to TikTok', {
      email: credentials.email,
    });

    const result = await authenticator.login(credentials);

    if (result.success) {
      logger.info('Login successful', {
        sessionId: result.session?.id,
      });

      // Set up interval to verify and refresh session periodically
      const sessionMaintenanceInterval = setInterval(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async () => {
          try {
            logger.info('Verifying session...');
            const isValid = await authenticator.verifySession();

            if (isValid) {
              logger.info('Session is valid');
            } else {
              logger.warning('Session is invalid, attempting to refresh');
              const refreshed = await authenticator.refreshSession();

              if (refreshed) {
                logger.info('Session refreshed successfully');
              } else {
                logger.error(
                  'Failed to refresh session, attempting to login again',
                );
                const loginResult = await authenticator.login(credentials);

                if (loginResult.success) {
                  logger.info('Re-login successful');
                } else {
                  logger.error('Re-login failed', {
                    error: loginResult.error,
                  });
                }
              }
            }
          } catch (error: unknown) {
            logger.error('Error in session maintenance', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
        30 * 60 * 1000,
      );

      // Keep the process running indefinitely
      await new Promise(() => {
        // This promise never resolves, keeping the process alive
        // The process will be terminated by SIGINT or SIGTERM signals
      });

      // This code is unreachable but included for completeness
      clearInterval(sessionMaintenanceInterval);
    } else {
      logger.error('Login failed', { error: result.error });
    }

    // Set up cleanup on process termination
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, stopping authenticator...');
      // Dispose the authenticator to clean up resources
      void authenticator.dispose().then(() => {
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, stopping authenticator...');
      // Dispose the authenticator to clean up resources
      void authenticator.dispose().then(() => {
        process.exit(0);
      });
    });
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
