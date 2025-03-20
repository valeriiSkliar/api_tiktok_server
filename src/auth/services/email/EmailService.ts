import {
  ImapFlow,
  ImapFlowOptions,
  FetchMessageObject,
  FetchQueryObject,
  MailboxObject,
} from 'imapflow';
import { PrismaClient } from '@prisma/client';
import {
  IEmailService,
  EmailVerificationCodeType,
} from '../../interfaces/email/IEmailService';
import { extractVerificationCode } from '../../utils/verificationCodeExtractor';
import { Log } from 'crawlee';
import { Env } from '@lib/Env';

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

  async getLatestVerificationCode(
    emailId: number,
    tiktokAccountId: number,
  ): Promise<EmailVerificationCodeType | null> {
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
          const savedCode = await this.prisma.verificationCode.create({
            data: {
              code,
              message_id: latestMessage.uid.toString(),
              sender_email: senderEmail,
              received_at: latestDate,
              email_body: emailBody,
              status: 'UNUSED',
              email_id: emailId,
              tiktok_account_id: tiktokAccountId,
            },
          });

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
        // First get the email and tiktok account IDs
        const emailRecord = await this.prisma.email.findFirst({
          where: { email_address: email },
          include: { tiktok_account: true },
        });

        if (!emailRecord || !emailRecord.tiktok_account) {
          throw new Error(
            `No email record or TikTok account found for ${email}`,
          );
        }

        const verificationCode = await this.getLatestVerificationCode(
          emailRecord.id,
          emailRecord.tiktok_account[0]?.id,
        );

        if (verificationCode && verificationCode.status === 'UNUSED') {
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
    const result = await this.prisma.verificationCode.findFirst({
      where: { code },
    });

    if (!result) {
      throw new Error(`Verification code ${code} not found`);
    }

    return await this.prisma.verificationCode.update({
      where: {
        id: result.id,
      },
      data: {
        status: 'USED',
        used_at: new Date(),
      },
    });
  }

  async getCodeStatus(code: string): Promise<EmailVerificationCodeType | null> {
    return await this.prisma.verificationCode.findFirst({
      where: { code },
    });
  }

  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  }> {
    const client = this.getImapClient();

    try {
      this.logger.info('Testing connection to IMAP server...');
      await client.connect();

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
      return {
        success: false,
        message: 'Failed to connect to email server',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    } finally {
      await client.logout();
    }
  }
}
