import type { EmailVerificationStatus } from '@prisma/client';

export interface EmailVerificationCodeType {
  id: number;
  code: string;
  messageId: string;
  senderEmail: string;
  receivedAt: Date;
  emailBody: string | null;
  status: EmailVerificationStatus;
  usedAt: Date | null;
  additionalInfo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailService {
  /**
   * Retrieves the latest verification code from emails
   * @returns Promise with the verification code or null if not found
   */
  getLatestVerificationCode(): Promise<EmailVerificationCodeType | null>;

  /**
   * Waits for a verification code to arrive for a specific email
   * @param email Email address to wait for code
   * @param timeoutMs Timeout in milliseconds
   * @param pollIntervalMs Polling interval in milliseconds
   * @returns Promise resolving to verification code or null if timeout
   */
  waitForVerificationCode(
    email: string,
    timeoutMs?: number,
    pollIntervalMs?: number,
  ): Promise<string | null>;

  /**
   * Marks a verification code as used
   * @param code The verification code to mark as used
   * @returns Promise resolving to the updated code record
   */
  markCodeAsUsed(code: string): Promise<EmailVerificationCodeType>;

  /**
   * Gets the status of a verification code
   * @param code The verification code to check
   * @returns Promise resolving to the code record or null if not found
   */
  getCodeStatus(code: string): Promise<EmailVerificationCodeType | null>;
}
