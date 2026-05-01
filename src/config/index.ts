import * as dotenv from 'dotenv';
import { z } from 'zod';
import { BotConfig } from '../types';

dotenv.config();

const configSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN gerekli'),
  CLIENT_ID: z.string().min(1, 'CLIENT_ID gerekli'),
  GUILD_ID: z.string().optional().default(''),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI gerekli'),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY gerekli'),
  OPENAI_MODEL: z.string().optional().default('gpt-4o-mini'),
  DASHBOARD_PORT: z.string().optional().default('3001'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  JWT_EXPIRES_IN: z.string().optional().default('7d'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD en az 8 karakter olmalı'),
  DISCORD_CLIENT_SECRET: z.string().optional().default(''),
  DISCORD_CALLBACK_URL: z
    .string()
    .optional()
    .default('http://localhost:3001/auth/discord/callback'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  LOG_LEVEL: z.string().optional().default('info'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Geçersiz ortam değişkenleri:');
  parsed.error.issues.forEach((issue) => {
    console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

const env = parsed.data;

export const config: BotConfig = {
  token: env.DISCORD_TOKEN,
  clientId: env.CLIENT_ID,
  guildId: env.GUILD_ID,
  mongoUri: env.MONGODB_URI,
  redisUrl: env.REDIS_URL,
  openaiApiKey: env.OPENAI_API_KEY,
  openaiModel: env.OPENAI_MODEL,
  dashboardPort: parseInt(env.DASHBOARD_PORT, 10),
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  adminPassword: env.ADMIN_PASSWORD,
  discordClientSecret: env.DISCORD_CLIENT_SECRET,
  discordCallbackUrl: env.DISCORD_CALLBACK_URL,
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
};

// Ticket sistem sabitleri
export const TICKET_CONFIG = {
  MAX_TICKETS_PER_USER: 3,
  AUTO_CLOSE_HOURS: 48,
  SLA_WARNING_HOURS: 24,
  SLA_CRITICAL_HOURS: 48,
  TRANSCRIPT_DIR: './transcripts',
  MAX_MESSAGE_HISTORY: 50,
  AI_COOLDOWN_SECONDS: 10,
  SPAM_THRESHOLD: 5, // 5 mesaj / 30 saniye
  SPAM_WINDOW_SECONDS: 30,
} as const;

export const COLORS = {
  PRIMARY: 0x5865f2,
  SUCCESS: 0x57f287,
  WARNING: 0xfee75c,
  DANGER: 0xed4245,
  INFO: 0x5865f2,
  NEUTRAL: 0x99aab5,
  AI: 0x00b0f4,
} as const;

export const EMOJIS = {
  TICKET: '🎫',
  BUG: '🐛',
  SUPPORT: '💬',
  SUGGESTION: '💡',
  OTHER: '📌',
  AI: '🤖',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  CLOSE: '🔒',
  OPEN: '🔓',
  HIGH: '🔴',
  MEDIUM: '🟡',
  LOW: '🟢',
  CRITICAL: '⚡',
  CLOCK: '⏰',
  STAR: '⭐',
  TRASH: '🗑️',
  LOG: '📋',
  DM: '📨',
} as const;
