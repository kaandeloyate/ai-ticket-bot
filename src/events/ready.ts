import { ActivityType } from 'discord.js';
import { EventHandler, ExtendedClient } from '../types';
import { GuildModel } from '../models/Guild';
import { ticketService } from '../services/ticket.service';
import { logger } from '../utils/logger';

const event: EventHandler = {
  name: 'ready',
  once: true,

  async execute(client: ExtendedClient): Promise<void> {
    logger.info(`✅ ${client.user?.tag} olarak giriş yapıldı`);
    logger.info(`📡 ${client.guilds.cache.size} sunucuda aktif`);

    // Status
    client.user?.setActivity('Mutlu Was Here!', { type: ActivityType.Watching });

    // Sunucuları kayıt et
    for (const guild of client.guilds.cache.values()) {
      try {
        await GuildModel.findOrCreate(guild.id, guild.name);
      } catch (err) {
        logger.error('Guild kayıt hatası', { err, guildId: guild.id });
      }
    }

    // Periyodik görevler
    // SLA kontrolü: her 30 dakika
    setInterval(
      async () => {
        await ticketService.checkSLABreaches(client).catch((e) =>
          logger.error('SLA kontrol hatası', { e }),
        );
      },
      30 * 60 * 1000,
    );

    // Otomatik kapama: her saat
    setInterval(
      async () => {
        await ticketService.autoCloseInactiveTickets(client).catch((e) =>
          logger.error('Otomatik kapama hatası', { e }),
        );
      },
      60 * 60 * 1000,
    );

    logger.info('🚀 Bot hazır');
  },
};

export default event;
