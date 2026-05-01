import { ButtonInteraction } from 'discord.js';
import { ButtonHandler, ExtendedClient } from '../../types';
import { GuildModel } from '../../models/Guild';
import { TicketModel } from '../../models/Ticket';
import { isSupport } from '../../utils/permissions.utils';
import { COLORS } from '../../config';

const handler: ButtonHandler = {
  customId: 'ticket:claim',

  async execute(client: ExtendedClient, interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) return;

    const guildConfig = await GuildModel.findOne({ guildId: interaction.guildId });
    if (!guildConfig) return;

    const member = interaction.member as import('discord.js').GuildMember;
    if (!isSupport(member, guildConfig)) {
      await interaction.reply({
        content: '❌ Bu işlemi yapma yetkiniz yok.',
        ephemeral: true,
      });
      return;
    }

    const ticket = await TicketModel.findOne({ channelId: interaction.channelId });
    if (!ticket) {
      await interaction.reply({ content: '❌ Ticket bulunamadı.', ephemeral: true });
      return;
    }

    if (ticket.assignedTo) {
      await interaction.reply({
        content: `⚠️ Bu ticket zaten <@${ticket.assignedTo}> tarafından üstlenilmiş.`,
        ephemeral: true,
      });
      return;
    }

    await TicketModel.findByIdAndUpdate(ticket._id, { assignedTo: interaction.user.id });

    await interaction.reply({
      embeds: [
        {
          title: '🙋 Ticket Üstlenildi',
          description: `<@${interaction.user.id}> bu ticketi üstlendi.`,
          color: COLORS.SUCCESS,
        },
      ],
    });
  },
};

export default handler;
