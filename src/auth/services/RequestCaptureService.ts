// // src/auth/services/RequestCaptureService.ts

// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository, LessThan } from 'typeorm';
// import { v4 as uuidv4 } from 'uuid';
// import { RequestSession } from '../entities/RequestSession.entity';
// import { AuthData } from '../entities/AuthData.entity';
// import { CookieDetail } from '../entities/CookieDetail.entity';

// @Injectable()
// export class RequestCaptureService {
//   constructor(
//     @InjectRepository(RequestSession)
//     private requestSessionRepository: Repository<RequestSession>,
//     @InjectRepository(AuthData)
//     private authDataRepository: Repository<AuthData>,
//     @InjectRepository(CookieDetail)
//     private cookieDetailRepository: Repository<CookieDetail>,
//   ) {}

//   /**
//    * Capture and store request data from an intercepted TikTok API request
//    * @param requestData The captured request data
//    */
//   async captureRequest(requestData: any): Promise<RequestSession> {
//     // Extract URL and parse endpoint
//     const url = new URL(requestData.url);
//     const endpoint = url.pathname;

//     // Extract query parameters
//     const parameters = {};
//     url.searchParams.forEach((value, key) => {
//       parameters[key] = value;
//     });

//     // Create session entity with 1-hour expiration
//     const now = new Date();
//     const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour

//     const requestSession = this.requestSessionRepository.create({
//       id: uuidv4(),
//       endpoint,
//       method: requestData.method,
//       parameters: JSON.stringify(parameters),
//       timestamp: now,
//       expiresAt,
//       isValid: true,
//       responseStatus: 200, // Default if not available
//       proxyId: null, // Will be set if proxy info is available
//       accountId: null, // Will be set if account info is available
//     });

//     await this.requestSessionRepository.save(requestSession);

//     // Extract and store auth data
//     if (requestData.headers) {
//       const authData = this.authDataRepository.create({
//         id: uuidv4(),
//         sessionId: requestSession.id,
//         csrfToken: requestData.headers['x-csrftoken'] || '',
//         cookies: requestData.headers.cookie || '',
//         userSign: requestData.headers['user-sign'] || null,
//         timestamp: requestData.headers.timestamp || null,
//         additionalHeaders: JSON.stringify(
//           this.extractAuthHeaders(requestData.headers),
//         ),
//       });

//       await this.authDataRepository.save(authData);

//       // Parse and store individual cookies for detailed analysis
//       if (authData.cookies) {
//         await this.parseCookies(authData.cookies, authData.id);
//       }
//     }

//     return requestSession;
//   }

//   /**
//    * Extract authentication-related headers
//    */
//   private extractAuthHeaders(
//     headers: Record<string, string>,
//   ): Record<string, string> {
//     const authHeaders = {};
//     const authHeaderPrefixes = [
//       'x-',
//       'authorization',
//       'cookie',
//       'user-',
//       'anonymous-',
//       'passport_',
//       'sso_',
//       'sid_',
//       'uid_',
//       'sessionid',
//       'msToken',
//       'ttwid',
//     ];

//     Object.keys(headers).forEach((key) => {
//       if (
//         authHeaderPrefixes.some((prefix) =>
//           key.toLowerCase().startsWith(prefix),
//         )
//       ) {
//         authHeaders[key] = headers[key];
//       }
//     });

//     return authHeaders;
//   }

//   /**
//    * Parse individual cookies and store them
//    */
//   private async parseCookies(
//     cookieString: string,
//     authDataId: string,
//   ): Promise<void> {
//     const cookies = cookieString.split(';').map((cookie) => cookie.trim());

//     for (const cookie of cookies) {
//       const [name, ...valueParts] = cookie.split('=');
//       const value = valueParts.join('='); // Rejoin in case value contains =

//       if (name && value) {
//         const cookieDetail = this.cookieDetailRepository.create({
//           id: uuidv4(),
//           authDataId,
//           name: name.trim(),
//           value: value.trim(),
//           domain: null, // Could be extracted with more complex parsing
//           path: null,
//           expiresAt: null,
//         });

//         await this.cookieDetailRepository.save(cookieDetail);
//       }
//     }
//   }

//   /**
//    * Retrieve valid request parameters for a specific endpoint
//    * @param endpoint The API endpoint
//    * @returns Valid request session or null if not found
//    */
//   async getValidRequestParameters(
//     endpoint: string,
//   ): Promise<RequestSession | null> {
//     const now = new Date();

//     // Find most recent valid session for the endpoint
//     const validSession = await this.requestSessionRepository.findOne({
//       where: {
//         endpoint,
//         expiresAt: LessThan(now),
//         isValid: true,
//       },
//       order: {
//         timestamp: 'DESC',
//       },
//       relations: ['authData'],
//     });

//     return validSession;
//   }

//   /**
//    * Mark expired sessions as invalid
//    * This should be run periodically (e.g., every minute)
//    */
//   async invalidateExpiredSessions(): Promise<void> {
//     const now = new Date();

//     await this.requestSessionRepository.update(
//       {
//         expiresAt: LessThan(now),
//         isValid: true,
//       },
//       {
//         isValid: false,
//       },
//     );
//   }

//   /**
//    * Get statistics on request data
//    */
//   async getRequestDataStatistics(): Promise<any> {
//     const now = new Date();
//     const total = await this.requestSessionRepository.count();
//     const valid = await this.requestSessionRepository.count({
//       where: {
//         expiresAt: LessThan(now),
//         isValid: true,
//       },
//     });

//     // Group by endpoint to see which endpoints we have data for
//     const endpointStats = await this.requestSessionRepository
//       .createQueryBuilder('session')
//       .select('session.endpoint')
//       .addSelect('COUNT(*)', 'count')
//       .groupBy('session.endpoint')
//       .getRawMany();

//     return {
//       totalRequests: total,
//       validRequests: valid,
//       endpointCoverage: endpointStats,
//     };
//   }
// }
