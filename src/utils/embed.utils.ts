import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ITicket } from '../models/Ticket';
import { COLORS, EMOJIS } from '../config';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  AIAnalysis,
} from '../types';

// ─── Ticket Panel Embed ────────────────────────────────────────────────────
export function buildTicketPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`${EMOJIS.TICKET} Destek Sistemi`)
    .setDescription(
      '**Bir destek talebi oluşturmak için aşağıdan kategori seçin.**\n\n' +
        `${EMOJIS.BUG} **Bug** — Hata bildirimi\n` +
        `${EMOJIS.SUPPORT} **Destek** — Genel yardım\n` +
        `${EMOJIS.SUGGESTION} **Öneri** — Fikir veya istek\n` +
        `${EMOJIS.OTHER} **Diğer** — Diğer konular`,
    )
    .setColor(COLORS.PRIMARY)
    .setFooter({ text: 'Her kullanıcı aynı anda en fazla 3 ticket açabilir.' })
    .setTimestamp();
}

export function buildTicketPanelCategorySelect(): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket:category_select')
      .setPlaceholder('📂 Kategori seçin...')
      .addOptions([
        {
          label: 'Bug Bildirimi',
          description: 'Bir hata veya arıza bildirin',
          value: TicketCategory.BUG,
          emoji: '🐛',
        },
        {
          label: 'Destek',
          description: 'Genel yardım ve destek alın',
          value: TicketCategory.SUPPORT,
          emoji: '💬',
        },
        {
          label: 'Öneri',
          description: 'Fikir veya istek bildirin',
          value: TicketCategory.SUGGESTION,
          emoji: '💡',
        },
        {
          label: 'Diğer',
          description: 'Diğer konular için',
          value: TicketCategory.OTHER,
          emoji: '📌',
        },
      ]),
  );
}

// ─── Ticket Oluşturuldu Embed ──────────────────────────────────────────────
export function buildTicketCreatedEmbed(
  ticket: ITicket,
  userId: string,
): EmbedBuilder {
  const categoryEmoji = getCategoryEmoji(ticket.category);
  const priorityEmoji = getPriorityEmoji(ticket.priority);

  return new EmbedBuilder()
    .setTitle(`${categoryEmoji} Ticket Açıldı`)
    .setDescription(
      `<@${userId}> hoş geldiniz!\n\n` +
        `**Konu:** ${ticket.subject}\n` +
        `**Kategori:** ${categoryEmoji} ${ticket.category}\n` +
        `**Öncelik:** ${priorityEmoji} ${ticket.priority}\n` +
        `**ID:** \`${ticket.ticketId}\`\n\n` +
        `Destek ekibimiz en kısa sürede ilgilenecek. Sorununuzu detaylandırmak için mesaj yazabilirsiniz.`,
    )
    .setColor(COLORS.SUCCESS)
    .setTimestamp()
    .setFooter({
      text: `SLA: ${new Date(ticket.slaDeadline).toLocaleString('tr-TR')} • ${ticket.ticketId}`,
    });
}

export function buildTicketCreatedButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Ticket Kapat')
      .setEmoji(EMOJIS.CLOSE)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket:claim')
      .setLabel('Üstlen')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket:priority')
      .setLabel('Öncelik Değiştir')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ─── AI Yanıt Embed ──────────────────────────────────────────────────────
export function buildAIResponseEmbed(
  response: string,
  analysis: AIAnalysis,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${EMOJIS.AI} AI Asistan`)
    .setDescription(response)
    .setColor(COLORS.AI)
    .setTimestamp()
    .setFooter({ text: `AI Analizi • Güven: %${Math.round(analysis.confidence * 100)}` });

  // Tags varsa ekle
  if (analysis.tags.length) {
    embed.addFields({
      name: '🏷️ Etiketler',
      value: analysis.tags.map((t) => `\`${t}\``).join(' '),
      inline: false,
    });
  }

  return embed;
}

// ─── AI Analiz Embed (Admin için) ────────────────────────────────────────
export function buildAIAnalysisEmbed(analysis: AIAnalysis): EmbedBuilder {
  const priorityEmoji = getPriorityEmoji(analysis.priority);
  const sentimentEmoji = getSentimentEmoji(analysis.sentiment);

  return new EmbedBuilder()
    .setTitle(`${EMOJIS.AI} AI Analiz Raporu`)
    .setColor(getSentimentColor(analysis.sentiment))
    .addFields(
      {
        name: '📊 Kategori',
        value: `${getCategoryEmoji(analysis.category)} ${analysis.category}`,
        inline: true,
      },
      {
        name: '⚡ Öncelik',
        value: `${priorityEmoji} ${analysis.priority}`,
        inline: true,
      },
      {
        name: '😊 Duygu',
        value: `${sentimentEmoji} ${analysis.sentiment}`,
        inline: true,
      },
      {
        name: '🌐 Dil',
        value: analysis.language.toUpperCase(),
        inline: true,
      },
      {
        name: '🎯 Güven',
        value: `%${Math.round(analysis.confidence * 100)}`,
        inline: true,
      },
      {
        name: '🚨 Uyarılar',
        value: [
          analysis.isSpam ? '⚠️ Spam' : '',
          analysis.isToxic ? '🔴 Toksik' : '',
          !analysis.isSpam && !analysis.isToxic ? '✅ Temiz' : '',
        ]
          .filter(Boolean)
          .join('\n'),
        inline: true,
      },
      {
        name: '📝 Özet',
        value: analysis.summary || 'Yok',
        inline: false,
      },
    )
    .setTimestamp();
}

// ─── Ticket Kapatma Embed ────────────────────────────────────────────────
export function buildTicketClosedEmbed(
  ticket: ITicket,
  closedByTag: string,
): EmbedBuilder {
  const duration = ticket.closedAt
    ? formatDuration(
        new Date(ticket.closedAt).getTime() - new Date(ticket.createdAt).getTime(),
      )
    : 'Bilinmiyor';

  return new EmbedBuilder()
    .setTitle(`${EMOJIS.CLOSE} Ticket Kapatıldı`)
    .setColor(COLORS.DANGER)
    .addFields(
      { name: 'Ticket ID', value: ticket.ticketId, inline: true },
      { name: 'Açan', value: ticket.userTag, inline: true },
      { name: 'Kapatan', value: closedByTag, inline: true },
      { name: 'Kategori', value: ticket.category, inline: true },
      { name: 'Öncelik', value: ticket.priority, inline: true },
      { name: 'Süre', value: duration, inline: true },
      {
        name: 'Mesaj Sayısı',
        value: String(ticket.messages.length),
        inline: true,
      },
      {
        name: 'Neden',
        value: ticket.closedReason || 'Belirtilmedi',
        inline: false,
      },
    )
    .setTimestamp();
}

// ─── DM Embed ─────────────────────────────────────────────────────────────
export function buildTicketClosedDMEmbed(ticket: ITicket): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`${EMOJIS.TICKET} Ticketınız Kapatıldı`)
    .setDescription(
      `**${ticket.ticketId}** numaralı ticketınız kapatıldı.\n\n` +
        `**Konu:** ${ticket.subject}\n` +
        `**Sebep:** ${ticket.closedReason || 'Belirtilmedi'}\n\n` +
        'Transcript dosyası ekli olarak gönderilmiştir.',
    )
    .setColor(COLORS.NEUTRAL)
    .setTimestamp();
}

// ─── SLA Uyarı Embed ──────────────────────────────────────────────────────
export function buildSLAWarningEmbed(ticket: ITicket): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`${EMOJIS.WARNING} SLA Uyarısı`)
    .setDescription(
      `<@${ticket.assignedTo || ticket.userId}> **Bu ticket SLA süresine yaklaşıyor!**\n\n` +
        `**Ticket:** ${ticket.ticketId}\n` +
        `**Konu:** ${ticket.subject}\n` +
        `**Son Tarih:** <t:${Math.floor(ticket.slaDeadline.getTime() / 1000)}:R>`,
    )
    .setColor(COLORS.WARNING)
    .setTimestamp();
}

// ─── Modal ────────────────────────────────────────────────────────────────
export function buildTicketModal(category: TicketCategory): ModalBuilder {
  const titles: Record<TicketCategory, string> = {
    [TicketCategory.BUG]: '🐛 Bug Bildirimi',
    [TicketCategory.SUPPORT]: '💬 Destek Talebi',
    [TicketCategory.SUGGESTION]: '💡 Öneri',
    [TicketCategory.OTHER]: '📌 Diğer',
  };

  return new ModalBuilder()
    .setCustomId(`ticket:modal:${category}`)
    .setTitle(titles[category])
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket_subject')
          .setLabel('Konu')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Kısaca sorununuzu belirtin')
          .setMaxLength(100)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket_description')
          .setLabel('Açıklama')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder(
            category === TicketCategory.BUG
              ? 'Hatayı adım adım açıklayın. Ne zaman oluştu? Nasıl tekrarlanır?'
              : 'Sorununuzu veya önerinizi detaylı açıklayın.',
          )
          .setMinLength(20)
          .setMaxLength(2000)
          .setRequired(true),
      ),
    );
}

// ─── Utility Functions ────────────────────────────────────────────────────
export function getCategoryEmoji(category: TicketCategory): string {
  const map: Record<TicketCategory, string> = {
    [TicketCategory.BUG]: EMOJIS.BUG,
    [TicketCategory.SUPPORT]: EMOJIS.SUPPORT,
    [TicketCategory.SUGGESTION]: EMOJIS.SUGGESTION,
    [TicketCategory.OTHER]: EMOJIS.OTHER,
  };
  return map[category] || EMOJIS.TICKET;
}

export function getPriorityEmoji(priority: TicketPriority): string {
  const map: Record<TicketPriority, string> = {
    [TicketPriority.LOW]: EMOJIS.LOW,
    [TicketPriority.MEDIUM]: EMOJIS.MEDIUM,
    [TicketPriority.HIGH]: EMOJIS.HIGH,
    [TicketPriority.CRITICAL]: EMOJIS.CRITICAL,
  };
  return map[priority] || EMOJIS.MEDIUM;
}

function getSentimentEmoji(sentiment: string): string {
  const map: Record<string, string> = {
    positive: '😊',
    neutral: '😐',
    negative: '😞',
    toxic: '🤬',
  };
  return map[sentiment] || '😐';
}

function getSentimentColor(sentiment: string): number {
  const map: Record<string, number> = {
    positive: COLORS.SUCCESS,
    neutral: COLORS.NEUTRAL,
    negative: COLORS.WARNING,
    toxic: COLORS.DANGER,
  };
  return map[sentiment] || COLORS.NEUTRAL;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}d ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa ${minutes % 60}d`;
  const days = Math.floor(hours / 24);
  return `${days}g ${hours % 24}sa`;
}
