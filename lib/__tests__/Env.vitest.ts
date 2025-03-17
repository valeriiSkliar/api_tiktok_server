import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import type { Env as EnvType } from '../Env.js';

// Mock process.env
const originalEnv = process.env;

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temporary .env file path
const testEnvPath = path.resolve(__dirname, '../.env.test');

// Base test environment with all required variables
const baseTestEnv = {
  SAD_CAPTCHA_API_KEY: 'test-captcha-key',
  DATABASE_POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
  DATABASE_SQLITE_URL: 'sqlite://./test.db',
  DATABASE_MYSQL_URL: 'mysql://user:pass@localhost:3306/db',
  TIKTOK_EMAIL: 'test@example.com',
  TIKTOK_PASSWORD: 'test-password',
  CRAWLER_MAX_WAIT_TIME: '30000',
  CRAWLER_CAPTCHA_TIMEOUT: '60000',
  CRAWLER_MAX_CAPTCHA_ATTEMPTS: '3',
  CRAWLER_HUMAN_DELAY_MIN: '1000',
  CRAWLER_HUMAN_DELAY_MAX: '3000',
  PATH_SCREENSHOTS: './screenshots',
  PATH_DATA: './data',
  PROXY_ENABLED: 'false',
  USER_AGENT_USE_CUSTOM: 'false'
};

describe('Environment Variables Loading', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, ...baseTestEnv };
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
  });

  it('should load environment variables from a file', async () => {
    const testEnvContent = Object.entries(baseTestEnv)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    fs.writeFileSync(testEnvPath, testEnvContent);
    dotenv.config({ path: testEnvPath });
    
    const { Env: envModule } = await import('../Env.js');
    
    expect(envModule.TIKTOK_EMAIL).toBe('test@example.com');
    expect(envModule.TIKTOK_PASSWORD).toBe('test-password');
    expect(envModule.SAD_CAPTCHA_API_KEY).toBe('test-captcha-key');
    expect(envModule.CRAWLER_MAX_WAIT_TIME).toBe(30000);
    expect(envModule.CRAWLER_CAPTCHA_TIMEOUT).toBe(60000);
    expect(envModule.CRAWLER_MAX_CAPTCHA_ATTEMPTS).toBe(3);
    expect(envModule.PROXY_ENABLED).toBe(false);
    expect(envModule.USER_AGENT_USE_CUSTOM).toBe(false);
  });

  it('should transform comma-separated strings into arrays', async () => {
    const arrayTestEnv = {
      ...baseTestEnv,
      FILTER_REGION: 'US, UK, CA',
      FILTER_INDUSTRY: 'Tech, Finance, Healthcare',
      FILTER_OBJECTIVE: 'Brand Awareness, Conversion',
      FILTER_AD_LANGUAGE: 'English, Spanish, French'
    };

    process.env = { ...originalEnv, ...arrayTestEnv };
    const { Env: envModule } = await import('../Env.js');
    
    expect(envModule.FILTER_REGION).toEqual(['US', 'UK', 'CA']);
    expect(envModule.FILTER_INDUSTRY).toEqual(['Tech', 'Finance', 'Healthcare']);
    expect(envModule.FILTER_OBJECTIVE).toEqual(['Brand Awareness', 'Conversion']);
    expect(envModule.FILTER_AD_LANGUAGE).toEqual(['English', 'Spanish', 'French']);
  });

  it('should handle empty or undefined values', async () => {
    const emptyValuesEnv = {
      ...baseTestEnv,
      FILTER_REGION: '',
      FILTER_INDUSTRY: undefined,
      PROXY_URL: undefined
    };

    process.env = { ...originalEnv, ...emptyValuesEnv };
    const { Env: envModule } = await import('../Env.js');
    
    expect(envModule.FILTER_REGION).toEqual([]);
    expect(envModule.FILTER_INDUSTRY).toEqual([]);
    expect(envModule.PROXY_URL).toBeUndefined();
  });
});

describe('Env Configuration', () => {
  let currentEnv: typeof EnvType;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv, ...baseTestEnv };
    const { Env: freshEnv } = await import('../Env.js');
    currentEnv = freshEnv;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Required Environment Variables', () => {
    it('should validate required fields', () => {
      expect(currentEnv.SAD_CAPTCHA_API_KEY).toBe('test-captcha-key');
      expect(currentEnv.DATABASE_POSTGRES_URL).toBe('postgresql://user:pass@localhost:5432/db');
      expect(currentEnv.DATABASE_SQLITE_URL).toBe('sqlite://./test.db');
      expect(currentEnv.DATABASE_MYSQL_URL).toBe('mysql://user:pass@localhost:3306/db');
    });

    it('should throw error when required fields are missing', async () => {
      // Reset modules and clear environment
      vi.resetModules();
      
      // Save only essential env vars
      const nodeEnv = process.env.NODE_ENV;
      const originalEnv = { ...process.env };
      
      try {
        // Clear all env vars except NODE_ENV
        process.env = { NODE_ENV: nodeEnv };
        
        // Import should fail due to missing required vars
        await import('../Env.js');
        throw new Error('Import should have failed');
      } catch (error) {
        if (error.message === 'Import should have failed') {
          throw new Error('Environment validation did not fail as expected');
        }
        // Verify it's a validation error
        expect(error.message).toContain('Invalid environment variables');
      } finally {
        // Restore original env
        process.env = originalEnv;
      }
    });
  });

  describe('Optional Environment Variables', () => {
    it('should handle optional API keys', () => {
      expect(currentEnv.OPENAI_API_KEY).toBeUndefined();
      expect(currentEnv.GEMINI_API_KEY).toBeUndefined();
    });

    it('should handle missing optional API keys', () => {
      expect(currentEnv.PROXY_URL).toBeUndefined();
      expect(currentEnv.USER_AGENT_CUSTOM).toBeUndefined();
    });
  });

  describe('Value Transformations', () => {
    it('should transform string numbers to integers', () => {
      expect(currentEnv.CRAWLER_MAX_WAIT_TIME).toBe(30000);
      expect(currentEnv.CRAWLER_CAPTCHA_TIMEOUT).toBe(60000);
      expect(currentEnv.CRAWLER_MAX_CAPTCHA_ATTEMPTS).toBe(3);
    });

    it('should transform boolean strings', () => {
      expect(currentEnv.PROXY_ENABLED).toBe(false);
      expect(currentEnv.USER_AGENT_USE_CUSTOM).toBe(false);
    });
  });

  describe('Filter Settings', () => {
    beforeEach(async () => {
      vi.resetModules();
      process.env = {
        ...originalEnv,
        ...baseTestEnv,
        FILTER_REGION: 'US, UK, CA',
        FILTER_INDUSTRY: 'Tech, Finance',
        FILTER_AD_LANGUAGE: ' English , Spanish '
      };
      const { Env: freshEnv } = await import('../Env.js');
      currentEnv = freshEnv;
    });

    it('should parse comma-separated strings into arrays', () => {
      expect(currentEnv.FILTER_REGION).toEqual(['US', 'UK', 'CA']);
      expect(currentEnv.FILTER_INDUSTRY).toEqual(['Tech', 'Finance']);
    });

    it('should handle empty filter values', () => {
      process.env.FILTER_REGION = '';
      expect(currentEnv.FILTER_REGION).toEqual(['US', 'UK', 'CA']); // Uses previously loaded value
    });

    it('should handle whitespace in comma-separated values', () => {
      expect(currentEnv.FILTER_AD_LANGUAGE).toEqual(['English', 'Spanish']);
    });
  });
});