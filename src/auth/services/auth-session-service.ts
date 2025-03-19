// /* eslint-disable @typescript-eslint/no-unsafe-member-access */
// /* eslint-disable @typescript-eslint/no-unsafe-call */
// /* eslint-disable @typescript-eslint/no-unsafe-assignment */

// import { Injectable } from '@nestjs/common';
// import { PrismaService } from '../../prisma.service';
// import { Log } from 'crawlee';
// import {
//   AuthSession,
//   AuthSessionStatus,
//   BrowserStorageState,
//   CreateAuthSessionParams,
//   FindAuthSessionParams,
//   UpdateAuthSessionParams,
// } from '../models/AuthSession';
// import { Session } from '@prisma/client';
// import * as fs from 'fs-extra';
// import * as path from 'path';

// @Injectable()
// export class AuthSessionService {
//   private readonly logger: Log;
//   private readonly DEFAULT_SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
//   private readonly BACKUP_DIRECTORY = 'storage/session-backups';

//   constructor(
//     private readonly prisma: PrismaService,
//     logger: Log,
//   ) {
//     this.logger = logger;
//     this.ensureBackupDirectory();
//   }

//   /**
//    * Создает новую сессию авторизации
//    */
//   async createSession(params: CreateAuthSessionParams): Promise<AuthSession> {
//     try {
//       this.logger.info('Creating new auth session', { email: params.email });

//       // Устанавливаем дату истечения, если не указана
//       const expiresIn = params.expiresIn || this.DEFAULT_SESSION_EXPIRY;
//       const expiresAt = new Date(Date.now() + expiresIn);

//       // Создаем запись в базе данных
//       const session = await this.prisma.session.create({
//         data: {
//           email: params.email,
//           session_data: params.storageState as any,
//           proxy_id: params.proxyId,
//           expires_at: expiresAt,
//           user_agent: params.userAgent,
//           instance_id: params.instanceId,
//           metadata: params.metadata as any,
//         },
//       });

//       // Создаем резервную копию состояния
//       await this.backupSessionState(session.id.toString(), params.storageState);

//       this.logger.info('Auth session created successfully', {
//         sessionId: session.id.toString(),
//         email: params.email,
//         expiresAt,
//       });

//       return this.mapDbSessionToModel(session);
//     } catch (error) {
//       this.logger.error('Failed to create auth session', {
//         email: params.email,
//         error: error instanceof Error ? error.message : String(error),
//       });
//       throw error;
//     }
//   }

//   /**
//    * Находит сессию авторизации по параметрам
//    */
//   async findSession(
//     params: FindAuthSessionParams,
//   ): Promise<AuthSession | null> {
//     try {
//       const where: any = {};

//       // Построение условий поиска
//       if (params.id) where.id = parseInt(params.id);
//       if (params.email) where.email = params.email;
//       if (params.proxyId) where.proxy_id = parseInt(params.proxyId);
//       if (params.instanceId) where.instance_id = parseInt(params.instanceId);

//       // Обработка статуса
//       if (params.status) {
//         if (Array.isArray(params.status)) {
//           where.status = { in: params.status };
//         } else {
//           where.status = params.status;
//         }
//       }

//       // Проверка срока действия
//       if (params.minExpiresAt) {
//         where.expires_at = { gte: params.minExpiresAt };
//       }

//       // Поиск в базе данных
//       const session = await this.prisma.session.findFirst({
//         where,
//         orderBy: { last_activity_timestamp: 'desc' }, // Сначала последние использованные
//       });

//       if (!session) {
//         this.logger.info('No auth session found', params);
//         return null;
//       }

//       this.logger.info('Found auth session', {
//         sessionId: session.id.toString(),
//         email: session.email,
//         status: session.status,
//       });

//       return this.mapDbSessionToModel(session);
//     } catch (error) {
//       this.logger.error('Error finding auth session', {
//         params,
//         error: error instanceof Error ? error.message : String(error),
//       });
//       throw error;
//     }
//   }

//   /**
//    * Обновляет сессию авторизации
//    */
//   async updateSession(
//     id: string,
//     params: UpdateAuthSessionParams,
//   ): Promise<AuthSession> {
//     try {
//       this.logger.info('Updating auth session', { sessionId: id });

//       // Если передано storageState, создаем резервную копию
//       if (params.storageState) {
//         await this.backupSessionState(id, params.storageState);
//       }

//       // Обновляем запись в базе данных
//       const updatedSession = await this.prisma.session.update({
//         where: { id: parseInt(id) },
//         data: {
//           ...(params.storageState && {
//             session_data: params.storageState as any,
//           }),
//           ...(params.status && { status: params.status }),
//           ...(params.expiresAt && { expires_at: params.expiresAt }),
//           ...(params.refreshCount !== undefined && {
//             refresh_count: params.refreshCount,
//           }),
//           ...(params.failCount !== undefined && {
//             fail_count: params.failCount,
//           }),
//           ...(params.metadata && { metadata: params.metadata as any }),
//           ...(params.lastUsedAt && {
//             last_activity_timestamp: params.lastUsedAt,
//           }),
//           ...(params.lastRefreshAt && {
//             last_refresh_at: params.lastRefreshAt,
//           }),
//         },
//       });

//       this.logger.info('Auth session updated successfully', {
//         sessionId: id,
//         status: updatedSession.status,
//       });

//       return this.mapDbSessionToModel(updatedSession);
//     } catch (error) {
//       this.logger.error('Failed to update auth session', {
//         sessionId: id,
//         error: error instanceof Error ? error.message : String(error),
//       });
//       throw error;
//     }
//   }

//   /**
//    * Отмечает сессию как активную и обновляет lastUsedAt
//    */
//   async markSessionAsUsed(id: string): Promise<AuthSession> {
//     return this.updateSession(id, {
//       last_activity_timestamp: new Date(),
//       status: AuthSessionStatus.ACTIVE,
//     });
//   }

//   /**
//    * Отмечает сессию как недействительную
//    */
//   async markSessionAsInvalid(
//     id: string,
//     reason?: string,
//   ): Promise<AuthSession> {
//     const session = await this.findSession({ id });
//     if (!session) {
//       throw new Error(`Session with id ${id} not found`);
//     }

//     const metadata = {
//       ...session.metadata,
//       lastError: reason || 'Session marked as invalid',
//       invalidatedAt: new Date().toISOString(),
//     };

//     return this.updateSession(id, {
//       status: AuthSessionStatus.INVALID,
//       metadata,
//     });
//   }

//   /**
//    * Находит все активные сессии для заданного email
//    */
//   async findActiveSessionsByEmail(email: string): Promise<AuthSession[]> {
//     try {
//       const sessions = await this.prisma.session.findMany({
//         where: {
//           email,
//           status: AuthSessionStatus.ACTIVE,
//           expires_at: { gte: new Date() },
//         },
//         orderBy: { last_activity_timestamp: 'desc' },
//       });

//       return sessions.map((session) => this.mapDbSessionToModel(session));
//     } catch (error) {
//       this.logger.error('Error finding active sessions for email', {
//         email,
//         error: error instanceof Error ? error.message : String(error),
//       });
//       throw error;
//     }
//   }

//   /**
//    * Выполняет проверку и обновление статусов устаревших сессий
//    */
//   async cleanupExpiredSessions(): Promise<number> {
//     try {
//       const now = new Date();

//       // Находим и обновляем истекшие сессии
//       const result = await this.prisma.session.updateMany({
//         where: {
//           expires_at: { lt: now },
//           status: { not: AuthSessionStatus.EXPIRED },
//         },
//         data: {
//           status: AuthSessionStatus.EXPIRED,
//         },
//       });

//       this.logger.info(`Updated ${result.count} expired sessions`);
//       return result.count;
//     } catch (error) {
//       this.logger.error('Error cleaning up expired sessions', {
//         error: error instanceof Error ? error.message : String(error),
//       });
//       throw error;
//     }
//   }

//   /**
//    * Удаляет сессию по ID
//    */
//   async deleteSession(id: string): Promise<void> {
//     try {
//       await this.prisma.session.delete({
//         where: { id: parseInt(id) },
//       });

//       // Удаляем резервную копию, если она существует
//       this.deleteBackupSessionState(id);

//       this.logger.info('Auth session deleted successfully', { sessionId: id });
//     } catch (error) {
//       this.logger.error('Failed to delete auth session', {
//         sessionId: id,
//         error: error instanceof Error ? error.message : String(error),
//       });
//       throw error;
//     }
//   }

//   /**
//    * Получает информацию о распределении сессий по статусам
//    */
//   async getSessionStats(): Promise<Record<string, number>> {
//     try {
//       // Группировка по статусу с подсчетом
//       const stats = await this.prisma.session.groupBy({
//         by: ['status'],
//         _count: true,
//       });

//       // Преобразование результатов в удобный формат
//       const result: Record<string, number> = {};
//       stats.forEach((item) => {
//         result[item.status] = item._count;
//       });

//       // Добавляем общее количество сессий
//       const totalCount = await this.prisma.session.count();
//       result.TOTAL = totalCount;

//       return result;
//     } catch (error) {
//       this.logger.error('Error getting session stats', {
//         error: error instanceof Error ? error.message : String(error),
//       });
//       throw error;
//     }
//   }

//   // Вспомогательные методы

//   /**
//    * Преобразует запись из БД в модель AuthSession
//    */
//   private mapDbSessionToModel(dbSession: Session): AuthSession {
//     return {
//       id: dbSession.id.toString(),
//       email: dbSession.email,
//       storageState: dbSession.session_data as BrowserStorageState,
//       proxyId: dbSession.proxy_id.toString(),
//       status: dbSession.status as AuthSessionStatus,
//       createdAt: dbSession.created_at,
//       expiresAt: dbSession.expires_at,
//       lastUsedAt: dbSession.last_activity_timestamp,
//       invalidationReason:
//         dbSession.status === 'INVALID' ? 'Session invalidated' : null,
//     };
//   }

//   /**
//    * Извлекает важные данные из состояния сессии TikTok
//    * @param session Сессия авторизации
//    * @returns Объект с ключевыми данными сессии TikTok
//    */
//   extractTikTokSessionData(session: AuthSession): {
//     msToken?: string;
//     ttwid?: string;
//     csrftoken?: string;
//     sessionid?: string;
//     passport_csrf_token?: string;
//     userId?: string;
//     anonymousUserId?: string;
//   } {
//     if (!session.storageState?.cookies) {
//       return {};
//     }

//     const result: Record<string, string | undefined> = {};

//     // Извлечь важные куки
//     const cookieNames = [
//       'msToken',
//       'ttwid',
//       'csrftoken',
//       'sessionid_ads',
//       'passport_csrf_token',
//     ];

//     for (const name of cookieNames) {
//       const cookie = session.storageState.cookies.find((c) => c.name === name);
//       if (cookie) {
//         result[name] = cookie.value;
//       }
//     }

//     // Извлечь данные из localStorage
//     if (session.storageState.origins) {
//       for (const origin of session.storageState.origins) {
//         if (
//           origin.origin.includes('tiktok.com') ||
//           origin.origin.includes('ads.tiktok.com')
//         ) {
//           // Найти userId и anonymousUserId в localStorage
//           for (const item of origin.localStorage) {
//             // Поиск SLARDARcc, который содержит userId
//             if (item.name === 'SLARDARcc' && item.value) {
//               try {
//                 const parsed = JSON.parse(item.value);
//                 if (parsed.userId) {
//                   result.userId = parsed.userId;
//                 }
//               } catch (e) {
//                 this.logger.debug('Failed to parse SLARDARcc', { error: e });
//               }
//             }

//             // Поиск anonymous-user-id
//             if (item.name === 'anonymous-user-id' && item.value) {
//               result.anonymousUserId = item.value;
//             }
//           }
//         }
//       }
//     }

//     return result;
//   }

//   /**
//    * Проверяет, активна ли сессия TikTok, основываясь на наличии необходимых куков
//    * @param session Сессия авторизации
//    * @returns Boolean, указывающий на активность сессии
//    */
//   isTikTokSessionActive(session: AuthSession): boolean {
//     if (!session.storageState?.cookies) {
//       return false;
//     }

//     // Проверяем наличие необходимых куков
//     const requiredCookies = ['sessionid_ads', 'ttwid', 'msToken'];

//     for (const cookieName of requiredCookies) {
//       const cookie = session.storageState.cookies.find(
//         (c) => c.name === cookieName,
//       );
//       if (!cookie) {
//         return false;
//       }

//       // Проверяем срок действия куки, если он указан
//       if (cookie.expires && cookie.expires < Date.now() / 1000) {
//         return false;
//       }
//     }

//     return true;
//   }

//   /**
//    * Создает резервную копию состояния в файловой системе
//    */
//   private async backupSessionState(
//     sessionId: string,
//     state: BrowserStorageState,
//   ): Promise<void> {
//     try {
//       const backupPath = path.join(this.BACKUP_DIRECTORY, `${sessionId}.json`);
//       await fs.writeJson(backupPath, state, { spaces: 2 });
//       this.logger.debug('Created session state backup', {
//         sessionId,
//         path: backupPath,
//       });
//     } catch (error) {
//       this.logger.error('Failed to backup session state', {
//         sessionId,
//         error: error instanceof Error ? error.message : String(error),
//       });
//     }
//   }

//   /**
//    * Удаляет резервную копию состояния
//    */
//   private deleteBackupSessionState(sessionId: string): void {
//     try {
//       const backupPath = path.join(this.BACKUP_DIRECTORY, `${sessionId}.json`);
//       if (fs.existsSync(backupPath)) {
//         fs.unlinkSync(backupPath);
//         this.logger.debug('Deleted session state backup', {
//           sessionId,
//           path: backupPath,
//         });
//       }
//     } catch (error) {
//       this.logger.warning('Failed to delete session state backup', {
//         sessionId,
//         error: error instanceof Error ? error.message : String(error),
//       });
//     }
//   }

//   /**
//    * Проверяет существование директории для резервных копий и создает ее при необходимости
//    */
//   private ensureBackupDirectory(): void {
//     try {
//       if (!fs.existsSync(this.BACKUP_DIRECTORY)) {
//         fs.mkdirSync(this.BACKUP_DIRECTORY, { recursive: true });
//         this.logger.info('Created backup directory', {
//           path: this.BACKUP_DIRECTORY,
//         });
//       }
//     } catch (error) {
//       this.logger.error('Failed to create backup directory', {
//         path: this.BACKUP_DIRECTORY,
//         error: error instanceof Error ? error.message : String(error),
//       });
//     }
//   }
// }
