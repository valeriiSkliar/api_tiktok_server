import { Session } from '../../models';
import { ISessionManager } from '../../interfaces';

export class SessionStateManager {
  private sessionManager: ISessionManager;
  private currentSession: Session | null = null;

  constructor(sessionManager: ISessionManager) {
    this.sessionManager = sessionManager;
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  setCurrentSession(session: Session): void {
    this.currentSession = session;
  }

  async saveCurrentSession(): Promise<void> {
    if (this.currentSession) {
      await this.sessionManager.saveSession(this.currentSession);
    }
  }

  // Add more session state management methods
}
