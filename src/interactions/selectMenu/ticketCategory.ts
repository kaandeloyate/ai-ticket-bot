import { TicketCategory, SelectMenuHandler, ExtendedClient } from '../../types';
import { StringSelectMenuInteraction } from 'discord.js';
import { GuildModel } from '../../models/Guild';
import { buildTicketModal } from '../../utils/embed.utils';
import { checkSpam } from '../../utils/rateLimit.utils';

const handler: SelectMenuHandler = {
  customId: 'ticket:category_select',

  async execute(client: ExtendedClient, interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    // Spam kontrolü
    if (checkSpam(interaction.user.id)) {
      await interaction.reply({
        content: '⚠️ Çok hızlı işlem yapıyorsunuz. Lütfen bekleyin.',
        ephemeral: true,
      });
      return;
    }

    const guildConfig = await GuildModel.findOne({ guildId: interaction.guildId });
    if (!guildConfig?.ticketConfig.enabled) {
      await interaction.reply({
        content: '❌ Ticket sistemi bu sunucuda aktif değil.',
        ephemeral: true,
      });
      return;
    }

    const category = interaction.values[0] as TicketCategory;

    if (!guildConfig.ticketConfig.allowedCategories.includes(category)) {
      await interaction.reply({
        content: '❌ Bu kategori bu sunucuda kullanılabilir değil.',
        ephemeral: true,
      });
      return;
    }

    // Modal göster
    const modal = buildTicketModal(category);
    await interaction.showModal(modal);
  },
};

export default handler;
