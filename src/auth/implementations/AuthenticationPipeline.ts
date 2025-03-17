// src/auth/implementations/AuthenticationPipeline.ts
import { Page } from 'playwright';
import { Log } from 'crawlee';
import { IAuthenticationStep } from '../interfaces/IAuthenticationStep';
import { AuthCredentials, AuthResult } from '../models';

export class AuthenticationPipeline {
  private steps: IAuthenticationStep[] = [];
  private logger: Log;

  constructor(logger: Log) {
    this.logger = logger;
  }

  addStep(step: IAuthenticationStep): AuthenticationPipeline {
    this.steps.push(step);
    return this;
  }

  async execute(page: Page, credentials: AuthCredentials): Promise<AuthResult> {
    for (const step of this.steps) {
      this.logger.info(`Executing authentication step: ${step.getName()}`);

      try {
        const success = await step.execute(page, credentials);
        if (!success) {
          return {
            success: false,
            error: `Failed at authentication step: ${step.getName()}`,
          };
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
