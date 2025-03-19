// src/email-standalone.ts
import { Log } from 'crawlee';
import { PrismaClient } from '@prisma/client';
import { EmailService } from './email/services/EmailService';
import * as dotenv from 'dotenv';

// Define the mailbox info interface
interface MailboxInfo {
  path?: string;
  exists?: number;
  total?: number;
}

// Load environment variables
dotenv.config();

// Ensure database URL is provided
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable');
  process.exit(1);
}

// Setup logger
const logger = new Log({ prefix: 'EmailServiceCLI' });

// Setup Prisma client
const prisma = new PrismaClient();

// Create email service
const emailService = new EmailService(prisma, logger);

/**
 * Display help message
 */
function showHelp() {
  console.log(`
Email Service Test CLI

Usage:
  npm run email:test -- [command]

Commands:
  connection           Test connection to the email server
  latest-code          Get the latest verification code
  wait-code            Wait for a new verification code
  mark-used <code>     Mark a verification code as used
  status <code>        Check the status of a verification code
  help                 Show this help message

Examples:
  npm run email:test -- connection
  npm run email:test -- latest-code
  npm run email:test -- wait-code
  npm run email:test -- mark-used ABC123
  npm run email:test -- status ABC123
  `);
}

/**
 * Main function to run the CLI
 */
async function main() {
  try {
    const command = process.argv[2]?.toLowerCase();

    if (!command || command === 'help') {
      showHelp();
      return;
    }

    // Execute the appropriate command
    switch (command) {
      case 'connection':
        await testConnection();
        break;

      case 'latest-code':
        await getLatestCode();
        break;

      case 'wait-code':
        await waitForCode();
        break;

      case 'mark-used':
        const codeToMark = process.argv[3];
        if (!codeToMark) {
          logger.error('No code provided for mark-used command');
          console.log('Usage: npm run email:test -- mark-used <code>');
          return;
        }
        await markCodeAsUsed(codeToMark);
        break;

      case 'status':
        const codeToCheck = process.argv[3];
        if (!codeToCheck) {
          logger.error('No code provided for status command');
          console.log('Usage: npm run email:test -- status <code>');
          return;
        }
        await getCodeStatus(codeToCheck);
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        showHelp();
    }
  } catch (error) {
    logger.error('Error in CLI:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    // Clean up Prisma connection
    await prisma.$disconnect();
  }
}

/**
 * Test connection to the email server
 */
async function testConnection() {
  logger.info('Testing connection to email server...');

  const result = await emailService.testConnection();

  if (result.success) {
    logger.info(result.message, result.details);
    console.log('\n✅ Connection successful!');
    console.log(`- Host: ${result.details?.host}`);
    console.log(`- User: ${result.details?.user}`);
    if (result.details?.mailbox && typeof result.details.mailbox === 'object') {
      const mailboxInfo = result.details.mailbox as MailboxInfo;
      console.log(`- Mailbox: ${mailboxInfo.path || 'Unknown'}`);
      console.log(`- Messages: ${mailboxInfo.exists || 0}`);
    } else if (result.details?.mailbox) {
      console.log(`- Mailbox info: ${result.details.mailbox}`);
    }
  } else {
    logger.error(result.message, result.details);
    console.log('\n❌ Connection failed!');
    console.log(`- Error: ${result.message}`);
    console.log(`- Host: ${result.details?.host}`);
    console.log(`- User: ${result.details?.user}`);
  }
}

/**
 * Get the latest verification code
 */
async function getLatestCode() {
  logger.info('Retrieving latest verification code...');

  const verificationCode = await emailService.getLatestVerificationCode();

  if (verificationCode) {
    logger.info('Latest verification code:', {
      id: verificationCode.id,
      code: verificationCode.code,
      received_at: verificationCode.received_at,
      message_id: verificationCode.message_id,
      sender_email: verificationCode.sender_email,
      status: verificationCode.status,
    });
    console.log('\n✅ Verification code retrieved!');
    console.log(`- Code: ${verificationCode.code}`);
    console.log(`- Received at: ${verificationCode.received_at.toLocaleString()}`);
    console.log(`- Status: ${verificationCode.status}`);
    console.log(`- Message ID: ${verificationCode.message_id}`);
    console.log(`- Sender: ${verificationCode.sender_email}`);
  } else {
    logger.warning('No verification code found');
    console.log('\n⚠️ No verification code found in the mailbox');
  }
}

/**
 * Wait for a new verification code
 */
async function waitForCode() {
  const email = process.env.UKR_NET_EMAIL;
  if (!email) {
    logger.error('Missing UKR_NET_EMAIL environment variable');
    console.log('\n❌ No email address specified');
    return;
  }

  logger.info('Waiting for a verification code...', { email });
  console.log(`\n⏳ Waiting for verification code to arrive at ${email}...`);
  console.log('Press Ctrl+C to cancel');

  const timeoutMs = 60000; // 1 minute
  const pollIntervalMs = 5000; // 5 seconds

  console.log(
    `Timeout: ${timeoutMs / 1000} seconds, Polling every ${pollIntervalMs / 1000} seconds`,
  );

  const code = await emailService.waitForVerificationCode(
    email,
    timeoutMs,
    pollIntervalMs,
  );

  if (code) {
    logger.info('Successfully received verification code', { code });
    console.log('\n✅ Verification code received!');
    console.log(`- Code: ${code}`);
  } else {
    logger.warning('Timed out waiting for verification code');
    console.log('\n⚠️ Timed out waiting for verification code');
  }
}

/**
 * Mark a verification code as used
 */
async function markCodeAsUsed(code: string) {
  logger.info('Marking verification code as used', { code });

  try {
    const result = await emailService.markCodeAsUsed(code);

    logger.info('Successfully marked code as used', {
      code,
      id: result.id,
      status: result.status,
    });

    console.log('\n✅ Code marked as used!');
    console.log(`- Code: ${result.code}`);
    console.log(`- Status: ${result.status}`);
    console.log(`- Used at: ${result.used_at?.toLocaleString() || 'N/A'}`);
  } catch (error) {
    logger.error('Failed to mark code as used', {
      code,
      error: error instanceof Error ? error.message : String(error),
    });

    console.log('\n❌ Failed to mark code as used!');
    console.log(
      `- Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Check the status of a verification code
 */
async function getCodeStatus(code: string) {
  logger.info('Checking status of verification code', { code });

  const codeStatus = await emailService.getCodeStatus(code);

  if (codeStatus) {
    logger.info('Found verification code record', {
      code,
      status: codeStatus.status,
      id: codeStatus.id,
    });

    console.log('\n✅ Code found in database!');
    console.log(`- Code: ${codeStatus.code}`);
    console.log(`- Status: ${codeStatus.status}`);
    console.log(`- Received at: ${codeStatus.received_at.toLocaleString()}`);
    console.log(`- Used at: ${codeStatus.used_at?.toLocaleString() || 'Not used'}`);
    console.log(`- Sender: ${codeStatus.sender_email}`);
  } else {
    logger.warning('Verification code not found', { code });
    console.log('\n⚠️ Code not found in database');
  }
}

// Run the CLI
main().catch(console.error);
