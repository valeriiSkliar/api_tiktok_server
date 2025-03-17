# TikTok API Crawler Setup

This document provides instructions for setting up the dependencies required for the TikTok API crawler.

## Dependencies

The crawler requires the following dependencies:

- **Playwright**: For browser automation and web scraping
- **Crawlee**: For managing crawling sessions and data extraction
- **Axios**: For making HTTP requests
- **Cheerio**: For parsing HTML
- **Puppeteer**: Alternative browser automation library
- **JSDOM**: For DOM manipulation in Node.js
- **UUID**: For generating unique identifiers
- **FS-Extra**: Enhanced file system methods
- **Winston**: For logging
- **Dotenv**: For environment variable management

## Installation

To install all the required dependencies, run the following command:

```bash
npm install playwright crawlee axios cheerio puppeteer jsdom uuid fs-extra winston dotenv
```

For development dependencies:

```bash
npm install --save-dev @types/node @types/uuid @types/fs-extra @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint typescript ts-node tsconfig-paths
```

## Playwright Browser Installation

After installing Playwright, you need to install the browser binaries:

```bash
npx playwright install
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
# API Keys
SAD_CAPTCHA_API_KEY=your_sad_captcha_api_key

# Email Service
EMAIL_API_BASE_URL=http://localhost:3000

# Proxy Configuration (optional)
PROXY_HOST=
PROXY_PORT=
PROXY_USERNAME=
PROXY_PASSWORD=
PROXY_PROTOCOL=http

# Storage Paths
SESSION_STORAGE_PATH=./storage/sessions
SCREENSHOT_STORAGE_PATH=./storage/screenshots
```

## Directory Structure

Ensure the following directories exist:

```bash
mkdir -p storage/sessions storage/screenshots
```

## Usage

Once all dependencies are installed and configured, you can use the crawler by importing the necessary classes and interfaces from the `auth` module:

```typescript
import { IAuthenticator, AuthCredentials } from './src/auth';
import { TikTokAuthenticator } from './src/auth/implementations/TikTokAuthenticator';

// Example usage
async function main() {
  const authenticator = new TikTokAuthenticator(/* dependencies */);
  
  const credentials: AuthCredentials = {
    email: 'your_email@example.com',
    password: 'your_password'
  };
  
  const result = await authenticator.login(credentials);
  
  if (result.success) {
    console.log('Login successful!', result.session);
  } else {
    console.error('Login failed:', result.error);
  }
}

main().catch(console.error);
```
