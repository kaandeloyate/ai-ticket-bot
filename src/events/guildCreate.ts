import { Guild } from 'discord.js';
import { EventHandler, ExtendedClient } from '../types';
import { GuildModel } from '../models/Guild';
import { logger } from '../utils/logger';

const event: EventHandler = {
  name: 'guildCreate',

  async execute(_client: ExtendedClient, guild: Guild): Promise<void> {
    try {
      await GuildModel.findOrCreate(guild.id, guild.name);
      logger.info(`Yeni sunucuya katıldı: ${guild.name} (${guild.id})`);
    } catch (error) {
      logger.error('Guild create hatası', { error, guildId: guild.id });
    }
  },
};

export default event;
