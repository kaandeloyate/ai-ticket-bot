import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler, ExtendedClient } from '../../types';
import { GuildModel } from '../../models/Guild';
import { TicketModel } from '../../models/Ticket';
import { ticketService } from '../../services/ticket.service';
import { logger } from '../../utils/logger';

const handler: ModalHandler = {
  customId: 'ticket:close_modal',

  async execute(client: ExtendedClient, interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('close_reason') || undefined;

    try {
      const guildConfig = await GuildModel.findOne({ guildId: interaction.guildId });
      if (!guildConfig) {
        await interaction.editReply({ content: '❌ Yapılandırma bulunamadı.' });
        return;
      }

      await ticketService.closeTicket(
        interaction.channelId, // channelId ile ara
        interaction.user.tag,
        interaction.user.id,
        reason,
        interaction.guild,
        guildConfig,
        client,
      );

      // Kanal silineceği için bu yanıt görüntülenmeyebilir
      await interaction.editReply({ content: '✅ Ticket kapatılıyor...' }).catch(() => {});
    } catch (error: any) {
      logger.error('Ticket kapatma hatası', { error });
      await interaction.editReply({
        content: `❌ ${error.message || 'Ticket kapatılırken hata oluştu.'}`,
      });
    }
  },
};

export default handler;
