import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
} from 'discord.js';
import { ButtonHandler, ExtendedClient } from '../../types';
import { GuildModel } from '../../models/Guild';
import { TicketModel } from '../../models/Ticket';
import { ticketService } from '../../services/ticket.service';
import { isSupport } from '../../utils/permissions.utils';
import { logger } from '../../utils/logger';

const handler: ButtonHandler = {
  customId: 'ticket:close',

  async execute(client: ExtendedClient, interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) return;

    const guildConfig = await GuildModel.findOne({ guildId: interaction.guildId });
    if (!guildConfig) {
      await interaction.reply({ content: '❌ Yapılandırma bulunamadı.', ephemeral: true });
      return;
    }

    const ticket = await TicketModel.findOne({ channelId: interaction.channelId });
    if (!ticket) {
      await interaction.reply({ content: '❌ Bu kanal bir ticket değil.', ephemeral: true });
      return;
    }

    // Yetki: Ticket sahibi veya destek ekibi kapayabilir
    const member = interaction.member as import('discord.js').GuildMember;
    const canClose =
      ticket.userId === interaction.user.id || isSupport(member, guildConfig);

    if (!canClose) {
      await interaction.reply({
        content: '❌ Bu ticketi kapatma yetkiniz yok.',
        ephemeral: true,
      });
      return;
    }

    // Kapatma sebebi modalı
    const modal = new ModalBuilder()
      .setCustomId('ticket:close_modal')
      .setTitle('🔒 Ticket Kapat')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel('Kapatma Sebebi (opsiyonel)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Sorununuz çözüldü, genel temizlik vs.')
            .setRequired(false)
            .setMaxLength(200),
        ),
      );

    await interaction.showModal(modal);
  },
};

export default handler;
