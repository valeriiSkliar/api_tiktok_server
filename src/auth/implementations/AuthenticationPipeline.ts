// src/auth/implementations/AuthenticationPipeline.ts
import { Page } from 'playwright';
import { Log } from 'crawlee';
import {
  AuthStepType,
  IAuthenticationStep,
} from '../interfaces/IAuthenticationStep';
import { AuthCredentials, AuthResult } from '../models';

export class AuthenticationPipeline {
  private steps: IAuthenticationStep[] = [];
  private logger: Log;
  private sessionRestored = false;

  constructor(logger: Log) {
    this.logger = logger;
  }

  addStep(step: IAuthenticationStep): AuthenticationPipeline {
    this.steps.push(step);
    return this;
  }

  setSessionRestored(restored: boolean): void {
    this.sessionRestored = restored;
  }

  async execute(page: Page, credentials: AuthCredentials): Promise<AuthResult> {
    for (const step of this.steps) {
      // Skip login steps if session was restored, unless it's a POST_SESSION step
      if (this.sessionRestored && step.getType() === AuthStepType.LOGIN) {
        this.logger.info(
          `Skipping login step ${step.getName()} as session was restored`,
        );
        continue;
      }

      this.logger.info(`Executing authentication step: ${step.getName()}`);

      try {
        const success = await step.execute(page, credentials);
        if (!success) {
          return {
            success: false,
            error: `Failed at authentication step: ${step.getName()}`,
          };
        }

        // If this is the session restore step and it succeeded, mark session as restored
        if (step.getType() === AuthStepType.PRE_SESSION && success) {
          this.setSessionRestored(true);
        }
      } catch (error) {
        this.logger.error(`Error in authentication step: ${step.getName()}`, {
          error: error instanceof Error ? error.message : String(error),
        });

        return {
          success: false,
          error: `Error in authentication step ${step.getName()}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    return { success: true };
  }
}
