// import { Page } from 'playwright';
import { AuthCredentials } from '../models';
import { AuthResult } from '../models';

/**
 * Interface for authentication services
 * Defines the contract for any authentication implementation
 */
export interface IAuthenticator {
  /**
   * Performs login with the provided credentials
   * @param credentials User credentials for authentication
   * @returns Promise resolving to authentication result
   */
  login(credentials: AuthCredentials): Promise<AuthResult>;

  /**
   * Verifies if the current session is valid
   * @returns Promise resolving to boolean indicating session validity
   */
  verifySession(): Promise<boolean>;

  /**
   * Refreshes the current session to extend its validity
   * @returns Promise resolving to boolean indicating success
   */
  refreshSession(): Promise<boolean>;

  /**
   * Performs logout, invalidating the current session
   * @returns Promise resolving when logout is complete
   */
  logout(): Promise<void>;
}
