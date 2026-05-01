import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { SlashCommand, ExtendedClient } from '../../types';
import { GuildModel } from '../../models/Guild';
import { COLORS, EMOJIS } from '../../config';

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Ticket sistemini yapılandır')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('init')
        .setDescription('İlk kurulumu gerçekleştir')
        .addChannelOption((opt) =>
          opt
            .setName('log_kanali')
            .setDescription('Log kanalı')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('transcript_kanali')
            .setDescription('Transcript kanalı')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName('kategori')
            .setDescription('Ticket kategorisi (klasör)')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false),
        )
        .addRoleOption((opt) =>
          opt.setName('destek_rolu').setDescription('Destek ekibi rolü').setRequired(false),
        )
        .addRoleOption((opt) =>
          opt.setName('admin_rolu').setDescription('Admin rolü').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('Yapılandırmayı görüntüle / güncelle')
        .addIntegerOption((opt) =>
          opt
            .setName('max_ticket')
            .setDescription('Kullanıcı başına max açık ticket')
            .setMinValue(1)
            .setMaxValue(10),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('sla_saat')
            .setDescription('SLA süresi (saat)')
            .setMinValue(1)
            .setMaxValue(168),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('auto_kapat')
            .setDescription('Otomatik kapanma (saat, 0=devre dışı)')
            .setMinValue(0)
            .setMaxValue(720),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Ticket sistemini aç/kapat')
        .addBooleanOption((opt) =>
          opt.setName('aktif').setDescription('Aktif mi?').setRequired(true),
        ),
    ) as SlashCommandBuilder,

  adminOnly: true,

  async execute(client: ExtendedClient, interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    // Sunucu kaydı oluştur/getir
    let guild = await GuildModel.findOne({ guildId: interaction.guildId! });
    if (!guild) {
      guild = await GuildModel.create({
        guildId: interaction.guildId!,
        guildName: interaction.guild.name,
      });
    }

    switch (subcommand) {
      case 'init': {
        const logChannel = interaction.options.getChannel('log_kanali');
        const transcriptChannel = interaction.options.getChannel('transcript_kanali');
        const category = interaction.options.getChannel('kategori');
        const supportRole = interaction.options.getRole('destek_rolu');
        const adminRole = interaction.options.getRole('admin_rolu');

        await GuildModel.findOneAndUpdate(
          { guildId: interaction.guildId! },
          {
            $set: {
              'ticketConfig.logChannelId': logChannel?.id,
              'ticketConfig.transcriptChannelId': transcriptChannel?.id || logChannel?.id,
              'ticketConfig.categoryId': category?.id || null,
              'ticketConfig.supportRoleIds': supportRole ? [supportRole.id] : [],
              'ticketConfig.adminRoleIds': adminRole ? [adminRole.id] : [],
              'ticketConfig.enabled': true,
            },
          },
          { new: true },
        );

        await interaction.editReply({
          embeds: [
            {
              title: `${EMOJIS.SUCCESS} Kurulum Tamamlandı`,
              color: COLORS.SUCCESS,
              fields: [
                { name: 'Log Kanalı', value: logChannel ? `<#${logChannel.id}>` : 'Yok', inline: true },
                {
                  name: 'Transcript',
                  value: transcriptChannel ? `<#${transcriptChannel.id}>` : 'Log kanalı',
                  inline: true,
                },
                { name: 'Kategori', value: category ? category.name : 'Yok', inline: true },
                {
                  name: 'Destek Rolü',
                  value: supportRole ? `<@&${supportRole.id}>` : 'Yok',
                  inline: true,
                },
                {
                  name: 'Admin Rolü',
                  value: adminRole ? `<@&${adminRole.id}>` : 'Yok',
                  inline: true,
                },
              ],
              footer: { text: '/ticket panel komutuyla paneli gönderebilirsiniz.' },
            },
          ],
        });
        break;
      }

      case 'config': {
        const maxTicket = interaction.options.getInteger('max_ticket');
        const slaHours = interaction.options.getInteger('sla_saat');
        const autoClose = interaction.options.getInteger('auto_kapat');

        const updateData: Record<string, unknown> = {};
        if (maxTicket !== null) updateData['ticketConfig.maxOpenTickets'] = maxTicket;
        if (slaHours !== null) updateData['ticketConfig.slaHours'] = slaHours;
        if (autoClose !== null) updateData['ticketConfig.autoCloseAfterHours'] = autoClose;

        const updated = await GuildModel.findOneAndUpdate(
          { guildId: interaction.guildId! },
          { $set: updateData },
          { new: true },
        );

        const cfg = updated!.ticketConfig;
        await interaction.editReply({
          embeds: [
            {
              title: `${EMOJIS.INFO} Mevcut Yapılandırma`,
              color: COLORS.PRIMARY,
              fields: [
                { name: 'Aktif', value: cfg.enabled ? '✅' : '❌', inline: true },
                { name: 'Max Ticket', value: String(cfg.maxOpenTickets), inline: true },
                { name: 'SLA (saat)', value: String(cfg.slaHours), inline: true },
                {
                  name: 'Otomatik Kapat (saat)',
                  value: cfg.autoCloseAfterHours ? String(cfg.autoCloseAfterHours) : 'Kapalı',
                  inline: true,
                },
                { name: 'Log Kanalı', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'Yok', inline: true },
                { name: 'Destek Rolleri', value: cfg.supportRoleIds.map((r) => `<@&${r}>`).join(', ') || 'Yok', inline: true },
              ],
            },
          ],
        });
        break;
      }

      case 'status': {
        const active = interaction.options.getBoolean('aktif', true);
        await GuildModel.findOneAndUpdate(
          { guildId: interaction.guildId! },
          { $set: { 'ticketConfig.enabled': active } },
        );

        await interaction.editReply({
          content: `${active ? '✅ Ticket sistemi **aktif** edildi.' : '❌ Ticket sistemi **devre dışı** bırakıldı.'}`,
        });
        break;
      }
    }
  },
};

export default command;
