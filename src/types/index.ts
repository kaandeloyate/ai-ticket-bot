import {
  Client,
  Collection,
  CommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionResolvable,
} from 'discord.js';

// ─── Extended Client ─────────────────────────────────────────────────────────
export interface ExtendedClient extends Client {
  commands: Collection<string, SlashCommand>;
  buttons: Collection<string, ButtonHandler>;
  modals: Collection<string, ModalHandler>;
  selectMenus: Collection<string, SelectMenuHandler>;
  cooldowns: Collection<string, Collection<string, number>>;
}

// ─── Command Types ────────────────────────────────────────────────────────────
export interface SlashCommand {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (client: ExtendedClient, interaction: ChatInputCommandInteraction) => Promise<void>;
  permissions?: PermissionResolvable[];
  cooldown?: number; // seconds
  adminOnly?: boolean;
}

export interface ButtonHandler {
  customId: string | RegExp;
  execute: (client: ExtendedClient, interaction: ButtonInteraction) => Promise<void>;
}

export interface ModalHandler {
  customId: string | RegExp;
  execute: (client: ExtendedClient, interaction: ModalSubmitInteraction) => Promise<void>;
}

export interface SelectMenuHandler {
  customId: string | RegExp;
  execute: (client: ExtendedClient, interaction: StringSelectMenuInteraction) => Promise<void>;
}

export interface EventHandler {
  name: string;
  once?: boolean;
  execute: (client: ExtendedClient, ...args: unknown[]) => Promise<void>;
}

// ─── Ticket Types ─────────────────────────────────────────────────────────────
export enum TicketCategory {
  BUG = 'bug',
  SUPPORT = 'support',
  SUGGESTION = 'suggestion',
  OTHER = 'other',
}

export enum TicketStatus {
  OPEN = 'open',
  PENDING = 'pending',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum MessageSentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
  TOXIC = 'toxic',
}

export interface TicketMessage {
  authorId: string;
  authorTag: string;
  content: string;
  isAI: boolean;
  timestamp: Date;
  attachments?: string[];
}

export interface AIAnalysis {
  category: TicketCategory;
  priority: TicketPriority;
  sentiment: MessageSentiment;
  summary: string;
  suggestedResponse: string;
  isSpam: boolean;
  isToxic: boolean;
  tags: string[];
  language: 'tr' | 'en' | 'other';
  confidence: number;
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────
export interface JWTPayload {
  userId: string;
  guildId: string;
  role: 'admin' | 'moderator';
  iat?: number;
  exp?: number;
}

export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  avgResponseTime: number;
  ticketsByCategory: Record<string, number>;
  ticketsByPriority: Record<string, number>;
  recentActivity: RecentActivity[];
}

export interface RecentActivity {
  type: 'opened' | 'closed' | 'message';
  ticketId: string;
  userId: string;
  timestamp: Date;
}

// ─── Config Types ─────────────────────────────────────────────────────────────
export interface BotConfig {
  token: string;
  clientId: string;
  guildId: string;
  mongoUri: string;
  redisUrl?: string;
  openaiApiKey: string;
  openaiModel: string;
  dashboardPort: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  adminPassword: string;
  discordClientSecret: string;
  discordCallbackUrl: string;
  nodeEnv: string;
  logLevel: string;
}

export interface GuildTicketConfig {
  enabled: boolean;
  categoryId?: string;
  logChannelId?: string;
  transcriptChannelId?: string;
  supportRoleIds: string[];
  adminRoleIds: string[];
  maxOpenTickets: number;
  autoCloseAfterHours: number;
  slaHours: number;
  welcomeMessage: string;
  closeMessage: string;
  allowedCategories: TicketCategory[];
}
