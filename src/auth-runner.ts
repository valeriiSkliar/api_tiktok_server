// src/auth-runner.ts
import { Log } from 'crawlee';
import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import { AuthenticatorFactory } from './auth/factories/AuthenticatorFactory';
import { AuthCredentials } from './auth/models/AuthCredentials';
import { Env } from '@lib/Env';

// Load environment variables
dotenv.config();

/**
 * Ensure directory exists
 * @param dirPath Directory path to create
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.ensureDir(dirPath);
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Main function to run the authenticator
 */
async function runAuthenticator() {
  const logger = new Log({ prefix: 'AuthRunner' });
  logger.info('Starting TikTok authenticator runner');
  const headless = Env.HEADLESS;
  logger.info('Headless mode:', { mode: headless });
  logger.info('Captcha resolution mode:', { mode: Env.CAPTCHA_RESOLVE_MODE });

  // Ensure sessions directory exists
  const sessionStoragePath =
    process.env.SESSION_STORAGE_PATH || './storage/sessions';
  await ensureDirectoryExists(sessionStoragePath);

  try {
    // Create authenticator using the factory
    const authenticator = AuthenticatorFactory.createTikTokAuthenticator(
      logger,
      {
        sessionStoragePath,
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

    await authenticator.runAuthenticator(credentials);

    // Set up cleanup on process termination
    // process.on('SIGINT', () => {
    //   logger.info('Received SIGINT, stopping authenticator...');
    //   // Dispose the authenticator to clean up resources
    //   void authenticator.dispose().then(() => {
    //     process.exit(0);
    //   });
    // });

    // process.on('SIGTERM', () => {
    //   logger.info('Received SIGTERM, stopping authenticator...');
    //   // Dispose the authenticator to clean up resources
    //   void authenticator.dispose().then(() => {
    //     process.exit(0);
    //   });
    // });
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
