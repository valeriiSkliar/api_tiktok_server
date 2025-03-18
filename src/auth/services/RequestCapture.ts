/* eslint-disable @typescript-eslint/require-await */
import fs from 'fs';
import { Request } from 'playwright';
import { Log } from 'crawlee';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: string;
}

export class RequestCaptureService {
  private static CAPTURES_DIR = 'storage/request-captures';

  constructor(private log?: Log) {
    this.ensureCapturesDirectory();
  }

  private ensureCapturesDirectory() {
    if (!fs.existsSync(RequestCaptureService.CAPTURES_DIR)) {
      fs.mkdirSync(RequestCaptureService.CAPTURES_DIR, { recursive: true });
    }
  }

  async captureRequest(request: Request): Promise<void> {
    try {
      const capturedRequest: CapturedRequest = {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData() || undefined,
        timestamp: new Date().toISOString(),
      };

      const fileName = this.generateFileName(request);
      const filePath = `${RequestCaptureService.CAPTURES_DIR}/${fileName}`;

      fs.writeFileSync(filePath, JSON.stringify(capturedRequest, null, 2));

      this.log?.info('Captured request details', {
        url: request.url(),
        file: fileName,
      });

      // Also save a curl command for easy testing
      const curlCommand = this.generateCurlCommand(capturedRequest);
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

  private generateFileName(request: Request): string {
    const url = new URL(request.url());
    const params = Object.fromEntries(url.searchParams.entries());
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `request_${params.adLanguage || 'unknown'}_page${params.page || '0'}_${timestamp}.json`;
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
