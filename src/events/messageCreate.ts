import { Message, TextChannel } from 'discord.js';
import { EventHandler, ExtendedClient } from '../types';
import { TicketModel } from '../models/Ticket';
import { ticketService } from '../services/ticket.service';
import { checkSpam } from '../utils/rateLimit.utils';
import { logger } from '../utils/logger';
import { TicketStatus } from '../types';

const event: EventHandler = {
  name: 'messageCreate',

  async execute(client: ExtendedClient, message: Message): Promise<void> {
    // Bot mesajlarını, DM'leri ve sistem mesajlarını atla
    if (message.author.bot || !message.guild || message.system) return;

    // Bu kanal bir ticket mi?
    const ticket = await TicketModel.findOne({
      channelId: message.channelId,
      status: { $in: [TicketStatus.OPEN, TicketStatus.PENDING] },
    });

    if (!ticket) return;

    // Spam kontrolü
    if (checkSpam(message.author.id)) {
      await message
        .reply('⚠️ Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz bekleyin.')
        .catch(() => {});
      return;
    }

    // AI mesaj yanıtı
    try {
      await ticketService.handleAIReply(
        ticket,
        message.content,
        message.author.id,
        message.author.tag,
        message.channel as TextChannel,
      );
    } catch (error) {
      logger.error('Mesaj işleme hatası', { error, channelId: message.channelId });
    }
  },
};

export default event;
