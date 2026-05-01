import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashCommand, ExtendedClient } from '../../types';
import { GuildModel } from '../../models/Guild';
import {
  buildTicketPanelEmbed,
  buildTicketPanelCategorySelect,
} from '../../utils/embed.utils';
import { isAdmin } from '../../utils/permissions.utils';
import { COLORS } from '../../config';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket sistemi komutları')
    .addSubcommand((sub) =>
      sub.setName('panel').setDescription('Ticket açma panelini gönder'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Mevcut ticketi kapat')
        .addStringOption((opt) =>
          opt.setName('sebep').setDescription('Kapatma sebebi').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Tickete kullanıcı ekle')
        .addUserOption((opt) =>
          opt.setName('kullanici').setDescription('Eklenecek kullanıcı').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('Mevcut ticket bilgilerini göster'),
    ) as SlashCommandBuilder,

  async execute(client: ExtendedClient, interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ Sunucu hatası.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildConfig = await GuildModel.findOne({ guildId: interaction.guildId });

    if (!guildConfig) {
      await interaction.reply({
        content: '❌ Bu sunucu henüz yapılandırılmamış. `/setup` komutunu kullanın.',
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as import('discord.js').GuildMember;

    switch (subcommand) {
      case 'panel': {
        if (!isAdmin(member, guildConfig)) {
          await interaction.reply({
            content: '❌ Bu komutu kullanmak için admin yetkisi gerekiyor.',
            ephemeral: true,
          });
          return;
        }

        const embed = buildTicketPanelEmbed();
        const selectRow = buildTicketPanelCategorySelect();
        await interaction.channel!.send({ embeds: [embed], components: [selectRow] });
        await interaction.reply({ content: '✅ Panel gönderildi.', ephemeral: true });
        break;
      }

      case 'info': {
        const { TicketModel } = await import('../../models/Ticket');
        const ticket = await TicketModel.findOne({ channelId: interaction.channelId });

        if (!ticket) {
          await interaction.reply({
            content: '❌ Bu kanal bir ticket değil.',
            ephemeral: true,
          });
          return;
        }

        const { buildAIAnalysisEmbed } = await import('../../utils/embed.utils');

        await interaction.reply({
          embeds: [
            {
              title: `🎫 Ticket Bilgisi — ${ticket.ticketId}`,
              color: COLORS.PRIMARY,
              fields: [
                { name: 'Durum', value: ticket.status, inline: true },
                { name: 'Kategori', value: ticket.category, inline: true },
                { name: 'Öncelik', value: ticket.priority, inline: true },
                { name: 'Kullanıcı', value: ticket.userTag, inline: true },
                { name: 'Mesaj Sayısı', value: String(ticket.messages.length), inline: true },
                {
                  name: 'Açılış',
                  value: `<t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>`,
                  inline: true,
                },
                {
                  name: 'SLA',
                  value: ticket.slaBreached
                    ? '🔴 İhlal edildi'
                    : `<t:${Math.floor(ticket.slaDeadline.getTime() / 1000)}:R>`,
                  inline: true,
                },
              ],
            },
            ...(ticket.aiAnalysis ? [buildAIAnalysisEmbed(ticket.aiAnalysis)] : []),
          ],
          ephemeral: true,
        });
        break;
      }

      case 'add': {
        const { isSupport } = await import('../../utils/permissions.utils');
        if (!isSupport(member, guildConfig)) {
          await interaction.reply({ content: '❌ Yetkiniz yok.', ephemeral: true });
          return;
        }

        const { TicketModel: TM } = await import('../../models/Ticket');
        const ticket = await TM.findOne({ channelId: interaction.channelId });
        if (!ticket) {
          await interaction.reply({ content: '❌ Bu kanal bir ticket değil.', ephemeral: true });
          return;
        }

        const user = interaction.options.getUser('kullanici', true);
        await interaction.channel!.permissionOverwrites.create(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });

        await interaction.reply({
          content: `✅ <@${user.id}> tickete eklendi.`,
        });
        break;
      }
    }
  },
};

export default command;
