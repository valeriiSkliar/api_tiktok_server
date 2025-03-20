/* eslint-disable @typescript-eslint/require-await */
// src/auth/implementations/steps/RequestInterceptionSetupStep.ts
import { Page } from 'playwright';
import { Log } from 'crawlee';
import {
  AuthStepType,
  IAuthenticationStep,
} from '../../interfaces/IAuthenticationStep';
import { IntegratedRequestCaptureService } from '../../services/RequestCaptureService';
import { NaturalScrollingStep } from './NaturalScrollingStep';

export class RequestInterceptionSetupStep implements IAuthenticationStep {
  private readonly logger: Log;
  private requestCaptureService: IntegratedRequestCaptureService;
  private sessionId?: number;
  private scrollingStep?: NaturalScrollingStep;

  constructor(
    logger: Log,
    sessionId?: number,
    scrollingStep?: NaturalScrollingStep,
  ) {
    this.logger = logger;
    this.sessionId = sessionId;
    this.requestCaptureService = new IntegratedRequestCaptureService(
      logger,
      sessionId,
    );
    this.scrollingStep = scrollingStep;
  }

  getName(): string {
    return 'Request Interception Setup';
  }

  getType(): AuthStepType {
    return AuthStepType.POST_SESSION;
  }
  setScrollingStep(scrollingStep: NaturalScrollingStep): void {
    this.scrollingStep = scrollingStep;
  }

  async execute(page: Page): Promise<boolean> {
    try {
      await this.requestCaptureService.setupInterception(page, {
        log: this.logger,
        sessionId: this.sessionId,
        page: page,
        onFirstRequest: async () => {
          // Callback for when first request is intercepted
          // You can implement additional logic here if needed
          this.logger.info('First API request intercepted');
          if (this.scrollingStep) {
            this.scrollingStep.notifyApiRequestCaptured();
          }
        },
      });

      this.logger.info('Request interception setup completed successfully');
      return true;
    } catch (error) {
      this.logger.error('Error setting up request interception:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // We'll consider this a non-critical failure - auth can proceed
      // even without request interception
      return true;
    }
  }

  setSessionId(sessionId: number): void {
    this.sessionId = sessionId;
    this.requestCaptureService = new IntegratedRequestCaptureService(
      this.logger,
      sessionId,
    );
  }
}
