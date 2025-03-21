import { Controller, Post, Logger } from '@nestjs/common';
import { SessionRefreshService } from './session-refresh.service';

@Controller('session')
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(private readonly sessionRefreshService: SessionRefreshService) {}

  @Post('refresh')
  async refreshSession() {
    this.logger.log('Manual session refresh requested');
    const result = await this.sessionRefreshService.refreshActiveSession();

    return {
      success: result,
      timestamp: new Date().toISOString(),
      message: result
        ? 'Session refresh completed successfully'
        : 'Failed to refresh session, check logs for details',
    };
  }
}
