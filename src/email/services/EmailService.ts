import {
  ImapFlow,
  ImapFlowOptions,
  FetchMessageObject,
  FetchQueryObject,
  MailboxObject,
} from 'imapflow';
import { PrismaClient, EmailVerificationStatus } from '@prisma/client';
import {
  IEmailService,
  EmailVerificationCodeType,
} from '../interfaces/IEmailService';
import { extractVerificationCode } from '../utils/verificationCodeExtractor';
import { Log } from 'crawlee';
import { Env } from '../../../lib/Env';

export class EmailService implements IEmailService {
  private prisma: PrismaClient;
  private logger: Log;
  private imapConfig: ImapFlowOptions;

  constructor(prisma: PrismaClient, logger: Log) {
    this.prisma = prisma;
    this.logger = logger;
    this.imapConfig = {
      host: Env.UKR_NET_IMAP_HOST,
      port: 993,
      secure: true,
      auth: {
        user: Env.UKR_NET_EMAIL,
        pass: Env.UKR_NET_APP_PASSWORD,
      },
      logger: false,
      tls: {
        rejectUnauthorized: true,
      },
    };
  }

  private getImapClient(): ImapFlow {
    return new ImapFlow(this.imapConfig);
  }

  async getLatestVerificationCode(): Promise<EmailVerificationCodeType | null> {
    const client = this.getImapClient();
    const senderEmail = 'creativecenter@tiktok-for-business.com';
    let latestMessage: FetchMessageObject | null = null;
    let latestDate = new Date(0);

    try {
      await client.connect();
      this.logger.info('Connected to IMAP server');

      const lock = await client.getMailboxLock('INBOX');
      try {
        const fetchQuery: FetchQueryObject = {
          envelope: true,
          source: true,
          uid: true,
        };

        for await (const message of client.fetch('1:*', fetchQuery)) {
          if (
            message.envelope?.from?.[0]?.address?.toLowerCase() ===
            senderEmail.toLowerCase()
          ) {
            const messageDate = new Date(message.envelope.date);
            if (messageDate > latestDate) {
              latestDate = messageDate;
              latestMessage = message;
            }
          }
        }
      } finally {
        lock.release();
      }

      if (latestMessage && latestMessage.source) {
        const emailBody = latestMessage.source.toString();
        const code = extractVerificationCode(emailBody);

        if (code) {
          const savedCode = (await this.prisma.emailVerificationCode.create({
            data: {
              code,
              messageId: latestMessage.uid.toString(),
              senderEmail,
              receivedAt: latestDate,
              emailBody,
              status: EmailVerificationStatus.UNUSED,
              additionalInfo: JSON.stringify({
                subject: latestMessage.envelope.subject,
                from: latestMessage.envelope.from[0].address,
              }),
            },
          })) as EmailVerificationCodeType;

          return savedCode;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error retrieving verification code:', error);
      throw error;
    } finally {
      await client.logout();
    }
  }

  async waitForVerificationCode(
    email: string,
    timeoutMs = 60000,
    pollIntervalMs = 5000,
  ): Promise<string | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const verificationCode = await this.getLatestVerificationCode();
        if (
          verificationCode &&
          verificationCode.status === EmailVerificationStatus.UNUSED
        ) {
          return verificationCode.code;
        }
      } catch (error) {
        this.logger.error('Error while polling for verification code:', error);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return null;
  }

  async markCodeAsUsed(code: string): Promise<EmailVerificationCodeType> {
    const result = (await this.prisma.emailVerificationCode.findFirst({
      where: { code },
    })) as EmailVerificationCodeType;

    if (!result) {
      throw new Error(`Verification code ${code} not found`);
    }

    return (await this.prisma.emailVerificationCode.update({
      where: {
        id: result.id,
      },
      data: {
        status: EmailVerificationStatus.USED,
        usedAt: new Date(),
      },
    })) as EmailVerificationCodeType;
  }

  async getCodeStatus(code: string): Promise<EmailVerificationCodeType | null> {
    return (await this.prisma.emailVerificationCode.findFirst({
      where: { code },
    })) as EmailVerificationCodeType;
  }

  /**
   * Tests the connection to the email server
   * @returns Promise resolving to connection status details
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  }> {
    const client = this.getImapClient();

    try {
      this.logger.info('Testing connection to IMAP server...');
      await client.connect();

      // Try to open the INBOX to verify full connection capabilities
      const lock = await client.getMailboxLock('INBOX');
      try {
        const mailbox = client.mailbox as MailboxObject | null;

        return {
          success: true,
          message: 'Successfully connected to email server',
          details: {
            host: this.imapConfig.host,
            user: this.imapConfig.auth.user,
            mailbox: mailbox
              ? {
                  path: mailbox.path,
                  exists: mailbox.exists,
                  total: mailbox.exists,
                }
              : 'No mailbox information available',
          },
        };
      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error('Failed to connect to email server:', {
        error: error instanceof Error ? error.message : String(error),
        host: this.imapConfig.host,
        user: this.imapConfig.auth.user,
      });

      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          host: this.imapConfig.host,
          user: this.imapConfig.auth.user,
        },
      };
    } finally {
      try {
        await client.logout();
      } catch (error: unknown) {
        this.logger.error('Failed to logout from email server:', { error });
      }
    }
  }
}
