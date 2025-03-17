import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

// Helper function to parse comma-separated string into array
const parseCommaSeparated = (str: string | undefined): string[] => {
  if (!str) return [];
  return str.split(',').map(item => item.trim()).filter(Boolean);
};

// Don't add NODE_ENV into T3 Env, it changes the tree-shaking behavior
export const Env = createEnv({
  /**
   * Client-side environment variables schema
   */
  client: {
    // No client-side env vars for now
  },
  /**
   * Server-side environment variables schema
   */
  server: {
    // API Keys
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    SAD_CAPTCHA_API_KEY: z.string(),
    CHAPTCHA_RESOLVE_MODE: z.enum(['manual', 'api']).default('manual'),
    
    // Database URLs
    DATABASE_POSTGRES_URL: z.string().min(1),
    DATABASE_SQLITE_URL: z.string().min(1),
    DATABASE_MYSQL_URL: z.string().min(1),    
    // TikTok Credentials
    TIKTOK_EMAIL: z.string(),
    TIKTOK_PASSWORD: z.string(),
    // Crawler Settings
    CRAWLER_MAX_WAIT_TIME: z.string().transform(val => parseInt(val, 10)),
    CRAWLER_CAPTCHA_TIMEOUT: z.string().transform(val => parseInt(val, 10)),
    CRAWLER_MAX_CAPTCHA_ATTEMPTS: z.string().transform(val => parseInt(val, 10)),
    CRAWLER_HUMAN_DELAY_MIN: z.string().transform(val => parseInt(val, 10)),
    CRAWLER_HUMAN_DELAY_MAX: z.string().transform(val => parseInt(val, 10)),
    
    // Storage Paths
    PATH_SCREENSHOTS: z.string(),
    PATH_DATA: z.string(),
    
    // Proxy Settings
    PROXY_ENABLED: z.string().transform(val => val.toLowerCase() === 'true'),
    PROXY_URL: z.string().optional(),
    
    // Filter Settings
    FILTER_REGION: z.string().optional().transform(parseCommaSeparated),
    FILTER_INDUSTRY: z.string().optional().transform(parseCommaSeparated),
    FILTER_OBJECTIVE: z.string().optional().transform(parseCommaSeparated),
    FILTER_PERIOD: z.string().optional(),
    FILTER_AD_LANGUAGE: z.string().optional().transform(parseCommaSeparated),
    FILTER_AD_FORMAT: z.string().optional(),
    FILTER_LIKES: z.string().optional().transform(parseCommaSeparated),
    
    // User Agent Settings
    USER_AGENT_USE_CUSTOM: z.string().transform(val => val.toLowerCase() === 'true'),
    USER_AGENT_CUSTOM: z.string().optional(),
  },
  /**
   * Specify your client-side environment variables schema here
   */
  clientPrefix: '',
  /**
   * Environment variables available on the client and server
   */
  runtimeEnv: {
    // API Keys
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    SAD_CAPTCHA_API_KEY: process.env.SAD_CAPTCHA_API_KEY,
    CHAPTCHA_RESOLVE_MODE: process.env.CHAPTCHA_RESOLVE_MODE,
    
    // Database URLs
    DATABASE_POSTGRES_URL: process.env.DATABASE_POSTGRES_URL,
    DATABASE_SQLITE_URL: process.env.DATABASE_SQLITE_URL,
    DATABASE_MYSQL_URL: process.env.DATABASE_MYSQL_URL,
    
    // TikTok Credentials
    TIKTOK_EMAIL: process.env.TIKTOK_EMAIL,
    TIKTOK_PASSWORD: process.env.TIKTOK_PASSWORD,
    // Crawler Settings
    CRAWLER_MAX_WAIT_TIME: process.env.CRAWLER_MAX_WAIT_TIME,
    CRAWLER_CAPTCHA_TIMEOUT: process.env.CRAWLER_CAPTCHA_TIMEOUT,
    CRAWLER_MAX_CAPTCHA_ATTEMPTS: process.env.CRAWLER_MAX_CAPTCHA_ATTEMPTS,
    CRAWLER_HUMAN_DELAY_MIN: process.env.CRAWLER_HUMAN_DELAY_MIN,
    CRAWLER_HUMAN_DELAY_MAX: process.env.CRAWLER_HUMAN_DELAY_MAX,
    
    // Storage Paths
    PATH_SCREENSHOTS: process.env.PATH_SCREENSHOTS,
    PATH_DATA: process.env.PATH_DATA,
    
    // Proxy Settings
    PROXY_ENABLED: process.env.PROXY_ENABLED,
    PROXY_URL: process.env.PROXY_URL,
    
    // Filter Settings
    FILTER_REGION: process.env.FILTER_REGION,
    FILTER_INDUSTRY: process.env.FILTER_INDUSTRY,
    FILTER_OBJECTIVE: process.env.FILTER_OBJECTIVE,
    FILTER_PERIOD: process.env.FILTER_PERIOD,
    FILTER_AD_LANGUAGE: process.env.FILTER_AD_LANGUAGE,
    FILTER_AD_FORMAT: process.env.FILTER_AD_FORMAT,
    FILTER_LIKES: process.env.FILTER_LIKES,
    
    // User Agent Settings
    USER_AGENT_USE_CUSTOM: process.env.USER_AGENT_USE_CUSTOM,
    USER_AGENT_CUSTOM: process.env.USER_AGENT_CUSTOM,
  },
});
