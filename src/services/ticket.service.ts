import {
  Guild,
  TextChannel,
  PermissionFlagsBits,
  ChannelType,
  CategoryChannel,
  AttachmentBuilder,
  User,
} from 'discord.js';
import * as fs from 'fs';
import { TicketModel, ITicket } from '../models/Ticket';
import { GuildModel, IGuild } from '../models/Guild';
import { UserModel } from '../models/User';
import { aiService } from './ai.service';
import { config, TICKET_CONFIG } from '../config';
import { logger } from '../utils/logger';
import { generateTranscript } from '../utils/transcript.utils';
import {
  buildTicketCreatedEmbed,
  buildTicketCreatedButtons,
  buildAIResponseEmbed,
  buildAIAnalysisEmbed,
  buildTicketClosedEmbed,
  buildTicketClosedDMEmbed,
} from '../utils/embed.utils';
import {
  TicketCategory,
  TicketStatus,
  TicketMessage,
  ExtendedClient,
} from '../types';

export class TicketService {
  // ─── Ticket Oluştur ────────────────────────────────────────────────────
  async createTicket(
    guild: Guild,
    user: User,
    category: TicketCategory,
    subject: string,
    description: string,
    guildConfig: IGuild,
  ): Promise<{ ticket: ITicket; channel: TextChannel }> {
    // Kullanıcı kontrolü
    const dbUser = await UserModel.findOrCreate(user.id, guild.id, user.tag);
    if (dbUser.isBanned) {
      throw new Error(`Ticket sistemi erişiminiz kısıtlanmıştır. Sebep: ${dbUser.banReason}`);
    }

    // Açık ticket limiti kontrolü
    const openTickets = await TicketModel.countDocuments({
      guildId: guild.id,
      userId: user.id,
      status: { $in: [TicketStatus.OPEN, TicketStatus.PENDING] },
    });

    if (openTickets >= guildConfig.ticketConfig.maxOpenTickets) {
      throw new Error(
        `Aynı anda en fazla **${guildConfig.ticketConfig.maxOpenTickets}** ticket açabilirsiniz. Lütfen mevcut ticketlarınızı kapatın.`,
      );
    }

    // Ticket ID üret
    const ticketId = await (TicketModel as any).generateTicketId(guild.id, user.username);

    // Kanal oluştur
    const channel = await this.createTicketChannel(guild, ticketId, user, guildConfig);

    // SLA hesapla
    const slaDeadline = new Date(
      Date.now() + guildConfig.ticketConfig.slaHours * 60 * 60 * 1000,
    );

    // Ticket kaydet
    const ticket = await TicketModel.create({
      ticketId,
      guildId: guild.id,
      channelId: channel.id,
      userId: user.id,
      userTag: user.tag,
      category,
      subject,
      slaDeadline,
      messages: [
        {
          authorId: user.id,
          authorTag: user.tag,
          content: description,
          isAI: false,
          timestamp: new Date(),
        },
      ],
    });

    // Kullanıcı istatistiklerini güncelle
    await UserModel.findOneAndUpdate(
      { userId: user.id, guildId: guild.id },
      { $inc: { ticketCount: 1 }, $set: { lastTicketAt: new Date() } },
    );

    // Guild istatistiklerini güncelle
    await GuildModel.findOneAndUpdate(
      { guildId: guild.id },
      { $inc: { 'stats.totalTickets': 1 } },
    );

    // Kanal'a açılış mesajı gönder
    const welcomeEmbed = buildTicketCreatedEmbed(ticket, user.id);
    const buttons = buildTicketCreatedButtons();
    await channel.send({ embeds: [welcomeEmbed], components: [buttons] });

    // Kullanıcının yazdığı mesajı gönder
    await channel.send({
      content: `**${user.tag}:**\n${description}`,
    });

    // AI Analizi başlat (async, beklemiyoruz)
    this.runAIAnalysis(ticket, description, subject, user.id, guild, channel, guildConfig).catch(
      (err) => logger.error('AI analiz hatası', { err, ticketId }),
    );

    logger.info('Ticket oluşturuldu', {
      ticketId,
      userId: user.id,
      guildId: guild.id,
      category,
    });

    return { ticket, channel };
  }

  // ─── AI Analiz & İlk Yanıt ────────────────────────────────────────────
  private async runAIAnalysis(
    ticket: ITicket,
    description: string,
    subject: string,
    userId: string,
    guild: Guild,
    channel: TextChannel,
    guildConfig: IGuild,
  ): Promise<void> {
    try {
      const dbUser = await UserModel.findOne({ userId, guildId: guild.id });
      const userHistory = dbUser
        ? { ticketCount: dbUser.ticketCount, hasWarnings: dbUser.warnings.length > 0 }
        : undefined;

      // AI analizi
      const analysis = await aiService.analyzeTicket(
        subject,
        description,
        userId,
        userHistory,
      );

      // Ticket güncelle
      await TicketModel.findByIdAndUpdate(ticket._id, {
        aiAnalysis: analysis,
        priority: analysis.priority,
        category: analysis.category,
        tags: analysis.tags,
      });

      // Spam veya toxic kontrol
      if (analysis.isSpam || analysis.isToxic) {
        await channel.send({
          content:
            `${analysis.isToxic ? '🔴 **Uyarı:** Zararlı içerik tespit edildi.' : '⚠️ **Uyarı:** Bu mesaj spam olarak işaretlendi.'}\n` +
            `Lütfen kurallara uygun davranın.`,
        });
        await this.notifyAdmins(guild, guildConfig, ticket, analysis.isToxic ? 'toxic' : 'spam');
      }

      // AI ilk yanıtı
      if (!analysis.isSpam) {
        const aiResponse = await aiService.generateInitialResponse(
          subject,
          description,
          analysis.category,
          analysis.language,
        );

        const aiEmbed = buildAIResponseEmbed(aiResponse, analysis);
        await channel.send({ embeds: [aiEmbed] });

        // AI mesajını kaydet
        await TicketModel.findByIdAndUpdate(ticket._id, {
          $push: {
            messages: {
              authorId: 'AI',
              authorTag: 'AI Asistan',
              content: aiResponse,
              isAI: true,
              timestamp: new Date(),
            },
          },
        });

        // Benzer çözüm kontrolü
        const recentSummaries = await TicketModel.find(
          {
            guildId: guild.id,
            status: TicketStatus.CLOSED,
            'aiAnalysis.category': analysis.category,
          },
          { 'aiAnalysis.summary': 1 },
          { limit: 5, sort: { closedAt: -1 } },
        ).lean();

        const summaries = recentSummaries
          .map((t) => t.aiAnalysis?.summary)
          .filter(Boolean) as string[];

        if (summaries.length > 0) {
          const similarSolution = await aiService.findSimilarSolution(
            subject,
            description,
            summaries,
          );

          if (similarSolution) {
            await channel.send({
              embeds: [
                {
                  title: '💡 Benzer Çözüm Bulundu',
                  description: `Bu sorun daha önce çözülmüş olabilir:\n\n${similarSolution}`,
                  color: 0xfee75c,
                },
              ],
            });
          }
        }
      }

      // Admin log kanalına AI analizi gönder
      if (guildConfig.ticketConfig.logChannelId) {
        const logChannel = guild.channels.cache.get(
          guildConfig.ticketConfig.logChannelId,
        ) as TextChannel;
        if (logChannel) {
          await logChannel.send({ embeds: [buildAIAnalysisEmbed(analysis)] });
        }
      }
    } catch (error) {
      logger.error('AI analizi çalışırken hata', { error, ticketId: ticket.ticketId });
    }
  }

  // ─── Ticket Kapat ─────────────────────────────────────────────────────
  async closeTicket(
    ticketId: string,
    closedByTag: string,
    closedById: string,
    reason: string | undefined,
    guild: Guild,
    guildConfig: IGuild,
    client: ExtendedClient,
  ): Promise<void> {
    const ticket = await TicketModel.findOne({
      guildId: guild.id,
      $or: [{ ticketId }, { channelId: ticketId }],
    });

    if (!ticket) throw new Error('Ticket bulunamadı');
    if (ticket.status === TicketStatus.CLOSED) throw new Error('Bu ticket zaten kapatılmış');

    // Kapanış öncesi AI özeti
    let aiSummary: string | undefined;
    if (ticket.messages.length > 1) {
      try {
        const summary = await aiService.generateTicketSummary(ticket.messages);
        aiSummary = summary.summary;

        // Mevcut analizi güncelle
        if (ticket.aiAnalysis) {
          ticket.aiAnalysis.summary = summary.summary;
          await ticket.save();
        }
      } catch (err) {
        logger.warn('Ticket özeti oluşturulamadı', { err });
      }
    }

    // Ticket kapat
    await ticket.close(closedById, reason);

    // Transcript oluştur
    let transcriptPath: string | undefined;
    try {
      transcriptPath = await generateTranscript(ticket);
      ticket.transcriptUrl = transcriptPath;
      await ticket.save();
    } catch (err) {
      logger.error('Transcript hatası', { err });
    }

    // Kullanıcıya DM gönder
    try {
      const user = await client.users.fetch(ticket.userId);
      const dmEmbed = buildTicketClosedDMEmbed(ticket);
      const dmPayload: Parameters<typeof user.send>[0] = { embeds: [dmEmbed] };

      if (transcriptPath && fs.existsSync(transcriptPath)) {
        const attachment = new AttachmentBuilder(transcriptPath, {
          name: `${ticket.ticketId}-transcript.html`,
        });
        (dmPayload as any).files = [attachment];
      }

      await user.send(dmPayload).catch(() => {
        logger.warn('DM gönderilemedi', { userId: ticket.userId });
      });
    } catch (err) {
      logger.warn('Kullanıcıya DM gönderme hatası', { err });
    }

    // Log kanalına gönder
    if (guildConfig.ticketConfig.logChannelId) {
      try {
        const logChannel = guild.channels.cache.get(
          guildConfig.ticketConfig.logChannelId,
        ) as TextChannel;
        if (logChannel) {
          const closedEmbed = buildTicketClosedEmbed(ticket, closedByTag);
          const logPayload: Parameters<typeof logChannel.send>[0] = {
            embeds: [closedEmbed],
          };

          if (transcriptPath && fs.existsSync(transcriptPath)) {
            const attachment = new AttachmentBuilder(transcriptPath, {
              name: `${ticket.ticketId}-transcript.html`,
            });
            (logPayload as any).files = [attachment];
          }

          await logChannel.send(logPayload);
        }
      } catch (err) {
        logger.error('Log kanalı hatası', { err });
      }
    }

    // Transcript kanalına gönder (ayrı)
    if (
      guildConfig.ticketConfig.transcriptChannelId &&
      guildConfig.ticketConfig.transcriptChannelId !== guildConfig.ticketConfig.logChannelId
    ) {
      try {
        const transcriptChannel = guild.channels.cache.get(
          guildConfig.ticketConfig.transcriptChannelId,
        ) as TextChannel;
        if (transcriptChannel && transcriptPath && fs.existsSync(transcriptPath)) {
          const attachment = new AttachmentBuilder(transcriptPath, {
            name: `${ticket.ticketId}-transcript.html`,
          });
          await transcriptChannel.send({
            content: `📋 **${ticket.ticketId}** transcript`,
            files: [attachment],
          });
        }
      } catch (err) {
        logger.warn('Transcript kanalı hatası', { err });
      }
    }

    // Kanalı sil (5 saniye gecikmeyle)
    const channel = guild.channels.cache.get(ticket.channelId);
    if (channel) {
      await channel
        .send({
          embeds: [
            {
              title: '🔒 Kapatılıyor',
              description: 'Bu ticket 5 saniye içinde silinecek.',
              color: 0xed4245,
            },
          ],
        })
        .catch(() => {});

      setTimeout(async () => {
        await channel.delete('Ticket kapatıldı').catch(() => {});
      }, 5000);
    }

    // Kullanıcı istatistiklerini güncelle
    await UserModel.findOneAndUpdate(
      { userId: ticket.userId, guildId: guild.id },
      { $inc: { closedTicketCount: 1 } },
    );

    await GuildModel.findOneAndUpdate(
      { guildId: guild.id },
      { $inc: { 'stats.closedTickets': 1 } },
    );

    logger.info('Ticket kapatıldı', {
      ticketId: ticket.ticketId,
      closedBy: closedById,
      guildId: guild.id,
    });
  }

  // ─── Ticket Kanal Oluştur ─────────────────────────────────────────────
  private async createTicketChannel(
    guild: Guild,
    ticketId: string,
    user: User,
    guildConfig: IGuild,
  ): Promise<TextChannel> {
    const overwrites: any[] = [
      {
        id: guild.roles.everyone,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    // Destek rollerini ekle
    for (const roleId of [
      ...guildConfig.ticketConfig.supportRoleIds,
      ...guildConfig.ticketConfig.adminRoleIds,
    ]) {
      overwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      });
    }

    // Bot'un kendisi
    if (guild.members.me) {
      overwrites.push({
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      });
    }

    const channelOptions: any = {
      name: ticketId,
      type: ChannelType.GuildText,
      topic: `Ticket: ${user.tag} | ${ticketId}`,
      permissionOverwrites: overwrites,
    };

    if (guildConfig.ticketConfig.categoryId) {
      const category = guild.channels.cache.get(
        guildConfig.ticketConfig.categoryId,
      ) as CategoryChannel;
      if (category) channelOptions.parent = category.id;
    }

    return guild.channels.create(channelOptions) as Promise<TextChannel>;
  }

  // ─── Admin Bildirim ───────────────────────────────────────────────────
  private async notifyAdmins(
    guild: Guild,
    guildConfig: IGuild,
    ticket: ITicket,
    type: 'toxic' | 'spam',
  ): Promise<void> {
    if (!guildConfig.ticketConfig.logChannelId) return;
    const logChannel = guild.channels.cache.get(
      guildConfig.ticketConfig.logChannelId,
    ) as TextChannel;
    if (!logChannel) return;

    const supportPing = guildConfig.ticketConfig.adminRoleIds
      .map((id) => `<@&${id}>`)
      .join(' ');

    await logChannel.send({
      content: `${supportPing} ${type === 'toxic' ? '🔴 **TOKSİK İÇERİK**' : '⚠️ **SPAM'}: <#${ticket.channelId}> kanalında tespit edildi!`,
    });
  }

  // ─── SLA Kontrolü ─────────────────────────────────────────────────────
  async checkSLABreaches(client: ExtendedClient): Promise<void> {
    const now = new Date();
    const warningTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 saat öncesi

    const tickets = await TicketModel.find({
      status: { $in: [TicketStatus.OPEN, TicketStatus.PENDING] },
      slaDeadline: { $lte: now },
      slaBreached: false,
    });

    for (const ticket of tickets) {
      try {
        await TicketModel.findByIdAndUpdate(ticket._id, { slaBreached: true });

        const guild = client.guilds.cache.get(ticket.guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(ticket.channelId) as TextChannel;
        if (!channel) continue;

        const guildConfig = await GuildModel.findOne({ guildId: ticket.guildId });
        if (!guildConfig) continue;

        // Destek ekibi ve kullanıcıya ping
        const supportPing = guildConfig.ticketConfig.supportRoleIds
          .map((id) => `<@&${id}>`)
          .join(' ');

        await channel.send({
          content: `${supportPing} ⚠️ **Bu ticket SLA süresini aştı!** Lütfen hemen ilgilenin.`,
          embeds: [
            {
              title: '⏰ SLA İhlali',
              description: `**${ticket.ticketId}** numaralı ticket SLA süresini geçti!`,
              color: 0xed4245,
              fields: [
                { name: 'Ticket', value: ticket.ticketId, inline: true },
                { name: 'Kullanıcı', value: ticket.userTag, inline: true },
                {
                  name: 'Açılış',
                  value: new Date(ticket.createdAt).toLocaleString('tr-TR'),
                  inline: true,
                },
              ],
            },
          ],
        });

        logger.warn('SLA ihlali', { ticketId: ticket.ticketId });
      } catch (err) {
        logger.error('SLA kontrol hatası', { err, ticketId: ticket.ticketId });
      }
    }
  }

  // ─── Otomatik Kapama ──────────────────────────────────────────────────
  async autoCloseInactiveTickets(client: ExtendedClient): Promise<void> {
    const configs = await GuildModel.find({ 'ticketConfig.enabled': true });

    for (const guildConfig of configs) {
      if (!guildConfig.ticketConfig.autoCloseAfterHours) continue;

      const cutoff = new Date(
        Date.now() - guildConfig.ticketConfig.autoCloseAfterHours * 60 * 60 * 1000,
      );

      const staleTickets = await TicketModel.find({
        guildId: guildConfig.guildId,
        status: { $in: [TicketStatus.OPEN, TicketStatus.PENDING] },
        lastActivityAt: { $lte: cutoff },
      });

      for (const ticket of staleTickets) {
        try {
          const guild = client.guilds.cache.get(ticket.guildId);
          if (!guild) continue;

          await this.closeTicket(
            ticket.ticketId,
            'Auto-Close System',
            client.user!.id,
            `${guildConfig.ticketConfig.autoCloseAfterHours} saat aktivite yok`,
            guild,
            guildConfig,
            client,
          );

          logger.info('Otomatik ticket kapandı', { ticketId: ticket.ticketId });
        } catch (err) {
          logger.error('Otomatik kapama hatası', { err });
        }
      }
    }
  }

  // ─── AI Mesaj Yanıtı ──────────────────────────────────────────────────
  async handleAIReply(
    ticket: ITicket,
    newMessage: string,
    authorId: string,
    authorTag: string,
    channel: TextChannel,
  ): Promise<void> {
    // Toxic kontrol
    const toxicCheck = await aiService.checkToxicity(newMessage);
    if (toxicCheck.isToxic && toxicCheck.severity !== 'low') {
      await channel.send({
        content: `<@${authorId}> ⚠️ **Uyarı:** Mesajınız uygunsuz içerik içeriyor (${toxicCheck.reason || 'kural ihlali'}). Lütfen saygılı bir dil kullanın.`,
      });
      return;
    }

    // Mesajı kaydet
    const message: TicketMessage = {
      authorId,
      authorTag,
      content: newMessage,
      isAI: false,
      timestamp: new Date(),
    };
    await ticket.addMessage(message);

    // Her 3 user mesajında bir AI yanıtı ver
    const userMessages = ticket.messages.filter(
      (m) => !m.isAI && m.authorId !== 'system',
    );
    if (userMessages.length % 3 !== 0) return;

    try {
      const aiResponse = await aiService.generateContextualResponse(
        ticket.messages,
        ticket.category,
        ticket.aiAnalysis?.language || 'tr',
      );

      await channel.send({
        embeds: [
          {
            title: '🤖 AI Asistan',
            description: aiResponse,
            color: 0x00b0f4,
            footer: { text: 'AI otomatik yanıt' },
          },
        ],
      });

      await TicketModel.findByIdAndUpdate(ticket._id, {
        $push: {
          messages: {
            authorId: 'AI',
            authorTag: 'AI Asistan',
            content: aiResponse,
            isAI: true,
            timestamp: new Date(),
          },
        },
      });
    } catch (err) {
      logger.error('AI mesaj yanıtı hatası', { err });
    }
  }
}

export const ticketService = new TicketService();
