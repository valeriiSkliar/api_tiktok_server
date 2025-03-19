/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */
import fs from 'fs';
import { Request } from 'playwright';
import { Log } from 'crawlee';
import { PrismaClient, Prisma } from '@prisma/client';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: string;
  apiVersion?: string;
  parameters?: Record<string, any>;
}

interface ApiRequestMetadata {
  url: string;
  method: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  cookies: Record<string, string>;
  timestamp: string;
  userAgent: string;
  referer?: string;
  csrfToken?: string;
  lang?: string;
  extraHeaders?: Record<string, string>;
}

export class RequestCaptureService {
  private static CAPTURES_DIR = 'storage/request-captures';
  private prisma: PrismaClient;

  constructor(private log?: Log) {
    this.ensureCapturesDirectory();
    this.prisma = new PrismaClient();
  }

  private ensureCapturesDirectory() {
    if (!fs.existsSync(RequestCaptureService.CAPTURES_DIR)) {
      fs.mkdirSync(RequestCaptureService.CAPTURES_DIR, { recursive: true });
    }
  }

  async captureRequest(request: Request, sessionId?: number): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const url = new URL(request.url());
      const headers = request.headers();

      // Extract all request metadata
      const requestMetadata: ApiRequestMetadata = {
        url: request.url(),
        method: request.method(),
        headers: headers,
        queryParams: Object.fromEntries(url.searchParams.entries()),
        cookies: this.parseCookies(headers.cookie || ''),
        timestamp,
        userAgent: headers['user-agent'] || '',
        referer: headers.referer,
        csrfToken: headers['x-csrftoken'],
        lang: headers.lang,
        extraHeaders: {
          'anonymous-user-id': headers['anonymous-user-id'],
          timestamp: headers.timestamp,
          'user-sign': headers['user-sign'],
          'sec-ch-ua': headers['sec-ch-ua'],
          'sec-ch-ua-mobile': headers['sec-ch-ua-mobile'],
          'sec-ch-ua-platform': headers['sec-ch-ua-platform'],
        },
      };

      // Extract API version and create parameters object with all necessary data
      const apiVersion = this.extractApiVersion(url);
      const parameters = {
        ...Object.fromEntries(url.searchParams.entries()),
        headers: {
          ...requestMetadata.extraHeaders,
          'user-agent': requestMetadata.userAgent,
          referer: requestMetadata.referer,
          'x-csrftoken': requestMetadata.csrfToken,
          cookie: headers.cookie,
        },
        metadata: {
          timestamp: requestMetadata.timestamp,
          cookies: requestMetadata.cookies,
          lang: requestMetadata.lang,
        },
      };

      // Save API configuration to database
      if (apiVersion) {
        const apiConfig = await this.saveApiConfiguration(
          apiVersion,
          parameters,
        );

        // Update session with the new API configuration if sessionId is provided
        if (sessionId && apiConfig) {
          await this.updateSessionApiConfig(sessionId, apiConfig.id);
        }
      }

      const fileName = this.generateFileName(request, timestamp);
      const filePath = `${RequestCaptureService.CAPTURES_DIR}/${fileName}`;

      // Save complete request metadata
      fs.writeFileSync(
        filePath,
        JSON.stringify(
          {
            ...requestMetadata,
            apiVersion,
            parameters,
          },
          null,
          2,
        ),
      );

      this.log?.info('Captured request details', {
        url: request.url(),
        file: fileName,
      });

      // Also save a curl command for easy testing
      const curlCommand = this.generateCurlCommand({
        url: requestMetadata.url,
        method: requestMetadata.method,
        headers: requestMetadata.headers,
        postData: request.postData() || undefined,
        timestamp: requestMetadata.timestamp,
      });

      fs.writeFileSync(
        `${RequestCaptureService.CAPTURES_DIR}/${fileName}.sh`,
        curlCommand,
      );
    } catch (error) {
      this.log?.error('Error capturing request:', {
        error: (error as Error).message,
      });
    }
  }

  private parseCookies(cookieString: string): Record<string, string> {
    return cookieString.split(';').reduce(
      (cookies, cookie) => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          try {
            cookies[name] = decodeURIComponent(value);
          } catch {
            cookies[name] = value;
          }
        }
        return cookies;
      },
      {} as Record<string, string>,
    );
  }

  private async saveApiConfiguration(
    apiVersion: string,
    parameters: Record<string, any>,
  ) {
    try {
      // Convert parameters to a JSON string for comparison
      const parametersJson = JSON.stringify(parameters);

      // Check if this configuration already exists using string comparison
      const existingConfig = await this.prisma.apiConfiguration.findFirst({
        where: {
          api_version: apiVersion,
          parameters: {
            equals: parametersJson as Prisma.InputJsonValue,
          },
          is_active: true,
        },
      });

      if (existingConfig) {
        return existingConfig;
      }

      // Create new configuration
      return await this.prisma.apiConfiguration.create({
        data: {
          api_version: apiVersion,
          parameters: parameters as Prisma.InputJsonValue,
          update_frequency: 3600, // Default 1 hour update frequency
          is_active: true,
        },
      });
    } catch (error) {
      this.log?.error('Error saving API configuration:', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  private async updateSessionApiConfig(sessionId: number, apiConfigId: number) {
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { api_config_id: apiConfigId },
      });
    } catch (error) {
      this.log?.error('Error updating session API config:', {
        error: (error as Error).message,
      });
    }
  }

  private extractApiVersion(url: URL): string {
    // Extract API version from URL or headers
    const pathParts = url.pathname.split('/');
    const versionMatch = pathParts.find((part) => part.match(/^v\d+/));
    return versionMatch || 'v1';
  }

  private generateFileName(request: Request, timestamp: string): string {
    const url = new URL(request.url());
    const params = Object.fromEntries(url.searchParams.entries());
    return `request_${params.adLanguage || 'unknown'}_page${params.page || '0'}_${timestamp.replace(/[:.]/g, '-')}.json`;
  }

  private generateCurlCommand(request: CapturedRequest): string {
    const headerString = Object.entries(request.headers)
      .map(([key, value]) => `-H '${key}: ${value}'`)
      .join(' ');

    const dataString = request.postData ? `-d '${request.postData}'` : '';

    return `#!/bin/bash
curl -X ${request.method} \\
${headerString} \\
${dataString} \\
'${request.url}'`;
  }
}
