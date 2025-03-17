// src/auth/interfaces/IAuthenticationStep.ts
import { Page } from 'playwright';
import { AuthCredentials } from '../models';

export interface IAuthenticationStep {
  /**
   * Execute this authentication step
   * @param page Playwright page object
   * @param credentials Authentication credentials
   * @returns Promise resolving to a boolean indicating success
   */
  execute(page: Page, credentials?: AuthCredentials): Promise<boolean>;

  /**
   * Get the name of this step for logging purposes
   */
  getName(): string;
}
