import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { EventHandler, ExtendedClient } from '../types';
import { logger } from '../utils/logger';
import { COLORS } from '../config';

const event: EventHandler = {
  name: 'interactionCreate',

  async execute(client: ExtendedClient, interaction: Interaction): Promise<void> {
    try {
      // ─── Slash Command ──────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        // Cooldown kontrolü
        if (command.cooldown) {
          const cooldowns = client.cooldowns;
          if (!cooldowns.has(command.data.name)) {
            cooldowns.set(command.data.name, new (await import('discord.js')).Collection());
          }

          const now = Date.now();
          const timestamps = cooldowns.get(command.data.name)!;
          const cooldownMs = (command.cooldown || 3) * 1000;

          if (timestamps.has(interaction.user.id)) {
            const expiration = timestamps.get(interaction.user.id)! + cooldownMs;
            if (now < expiration) {
              const remaining = ((expiration - now) / 1000).toFixed(1);
              await interaction.reply({
                embeds: [
                  {
                    description: `⏳ \`${command.data.name}\` komutunu kullanmak için **${remaining}** saniye beklemelisiniz.`,
                    color: COLORS.WARNING,
                  },
                ],
                ephemeral: true,
              });
              return;
            }
          }

          timestamps.set(interaction.user.id, now);
          setTimeout(() => timestamps.delete(interaction.user.id), cooldownMs);
        }

        try {
          await command.execute(client, interaction as ChatInputCommandInteraction);
        } catch (error: any) {
          logger.error('Komut hatası', { error, command: interaction.commandName });
          const errorReply = {
            embeds: [
              {
                description: `❌ Komut çalıştırılırken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`,
                color: COLORS.DANGER,
              },
            ],
            ephemeral: true,
          };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorReply).catch(() => {});
          } else {
            await interaction.reply(errorReply).catch(() => {});
          }
        }
        return;
      }

      // ─── Button ─────────────────────────────────────────────────────
      if (interaction.isButton()) {
        // Tam eşleşme veya regex
        let handler = client.buttons.get(interaction.customId);
        if (!handler) {
          for (const [key, h] of client.buttons.entries()) {
            if (key instanceof RegExp && key.test(interaction.customId)) {
              handler = h;
              break;
            }
          }
        }
        if (!handler) return;

        try {
          await handler.execute(client, interaction);
        } catch (error) {
          logger.error('Button hatası', { error, customId: interaction.customId });
        }
        return;
      }

      // ─── Modal ──────────────────────────────────────────────────────
      if (interaction.isModalSubmit()) {
        let handler = client.modals.get(interaction.customId);
        if (!handler) {
          for (const [key, h] of client.modals.entries()) {
            if (key instanceof RegExp && key.test(interaction.customId)) {
              handler = h;
              break;
            }
          }
        }
        if (!handler) return;

        try {
          await handler.execute(client, interaction);
        } catch (error) {
          logger.error('Modal hatası', { error, customId: interaction.customId });
        }
        return;
      }

      // ─── Select Menu ─────────────────────────────────────────────────
      if (interaction.isStringSelectMenu()) {
        let handler = client.selectMenus.get(interaction.customId);
        if (!handler) {
          for (const [key, h] of client.selectMenus.entries()) {
            if (key instanceof RegExp && key.test(interaction.customId)) {
              handler = h;
              break;
            }
          }
        }
        if (!handler) return;

        try {
          await handler.execute(client, interaction);
        } catch (error) {
          logger.error('SelectMenu hatası', { error, customId: interaction.customId });
        }
      }
    } catch (error) {
      logger.error('InteractionCreate genel hata', { error });
    }
  },
};

export default event;
