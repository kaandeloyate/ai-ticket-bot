import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import mongoose from 'mongoose';
import {
  ExtendedClient,
  SlashCommand,
  ButtonHandler,
  ModalHandler,
  SelectMenuHandler,
} from './types';
import { config } from './config';
import { logger } from './utils/logger';
import { loadCommands } from './handlers/command.handler';
import { loadEvents } from './handlers/event.handler';
import { createDashboard } from './dashboard/backend/app';
import * as fs from 'fs';

// ─── Client ─────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
}) as ExtendedClient;

// Collections
client.commands = new Collection<string, SlashCommand>();
client.buttons = new Collection<string, ButtonHandler>();
client.modals = new Collection<string, ModalHandler>();
client.selectMenus = new Collection<string, SelectMenuHandler>();
client.cooldowns = new Collection<string, Collection<string, number>>();

// ─── Transcript dizini ───────────────────────────────────────────────────────
if (!fs.existsSync('./transcripts')) fs.mkdirSync('./transcripts', { recursive: true });
if (!fs.existsSync('./logs')) fs.mkdirSync('./logs', { recursive: true });

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} alındı, kapatılıyor...`);
  client.destroy();
  await mongoose.connection.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  try {
    // MongoDB bağlantısı
    logger.info('MongoDB bağlanıyor...');
    await mongoose.connect(config.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('✅ MongoDB bağlandı');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB hatası', { err });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB bağlantısı kesildi, yeniden bağlanıyor...');
    });

    // Handler'ları yükle
    await loadCommands(client);
    await loadEvents(client);

    // Button/Modal/SelectMenu handler'larını yükle
    await loadInteractions(client);

    // Dashboard başlat
    const { httpServer } = createDashboard();
    httpServer.listen(config.dashboardPort, () => {
      logger.info(`📊 Dashboard: http://localhost:${config.dashboardPort}`);
    });

    // Discord'a bağlan
    await client.login(config.token);
  } catch (error) {
    logger.error('Bootstrap hatası', { error });
    process.exit(1);
  }
}

async function loadInteractions(client: ExtendedClient): Promise<void> {
  const { loadButtons } = await import('./handlers/button.handler');
  const { loadSelectMenus } = await import('./handlers/selectMenu.handler');

  // Inline olarak interaction handler'larını yükle
  // Button handler'ları
  const buttonFiles = [
    require('./interactions/buttons/ticketClose').default,
    require('./interactions/buttons/ticketClaim').default,
  ];
  for (const handler of buttonFiles) {
    client.buttons.set(String(handler.customId), handler);
  }

  // Modal handler'ları
  const modalFiles = [
    require('./interactions/modals/ticketCreate').default,
    require('./interactions/modals/ticketCloseModal').default,
  ];
  for (const handler of modalFiles) {
    client.modals.set(String(handler.customId), handler);
  }

  // SelectMenu handler'ları
  const selectMenuFiles = [require('./interactions/selectMenus/ticketCategory').default];
  for (const handler of selectMenuFiles) {
    client.selectMenus.set(String(handler.customId), handler);
  }

  logger.info('Interaction handler\'ları yüklendi');
}

bootstrap();
