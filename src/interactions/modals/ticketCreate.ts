import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler, ExtendedClient, TicketCategory } from '../../types';
import { GuildModel } from '../../models/Guild';
import { ticketService } from '../../services/ticket.service';
import { logger } from '../../utils/logger';

const handler: ModalHandler = {
  customId: /^ticket:modal:/,

  async execute(client: ExtendedClient, interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ Sunucu hatası.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const category = interaction.customId.replace('ticket:modal:', '') as TicketCategory;
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const description = interaction.fields.getTextInputValue('ticket_description');

    try {
      const guildConfig = await GuildModel.findOne({ guildId: interaction.guildId });
      if (!guildConfig) {
        await interaction.editReply({ content: '❌ Sunucu yapılandırması bulunamadı.' });
        return;
      }

      const { ticket, channel } = await ticketService.createTicket(
        interaction.guild,
        interaction.user,
        category,
        subject,
        description,
        guildConfig,
      );

      await interaction.editReply({
        content: `✅ Ticketınız oluşturuldu! → <#${channel.id}>\n**ID:** \`${ticket.ticketId}\``,
      });
    } catch (error: any) {
      logger.error('Ticket oluşturma hatası', { error, userId: interaction.user.id });
      await interaction.editReply({
        content: `❌ ${error.message || 'Ticket oluşturulurken bir hata oluştu.'}`,
      });
    }
  },
};

export default handler;
