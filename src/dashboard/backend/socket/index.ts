import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../../config';
import { TicketModel } from '../../../models/Ticket';
import { JWTPayload } from '../../../types';
import { logger } from '../../../utils/logger';

export function initializeSocket(io: SocketIOServer): void {
  // Auth middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) {
      next(new Error('Yetkilendirme gerekli'));
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as JWTPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Geçersiz token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as JWTPayload;
    logger.info('Dashboard bağlantısı', { userId: user.userId, guildId: user.guildId });

    // Guild odasına katıl
    socket.join(`guild:${user.guildId}`);

    socket.on('subscribe:ticket', async (ticketId: string) => {
      const ticket = await TicketModel.findOne({
        ticketId,
        guildId: user.guildId,
      }).lean();

      if (!ticket) {
        socket.emit('error', 'Ticket bulunamadı');
        return;
      }

      socket.join(`ticket:${ticketId}`);
      socket.emit('ticket:data', ticket);
    });

    socket.on('unsubscribe:ticket', (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`);
    });

    socket.on('disconnect', () => {
      logger.debug('Dashboard bağlantısı kesildi', { userId: user.userId });
    });
  });
}

// Event emitters (bot tarafından çağrılır)
export function emitTicketCreated(io: SocketIOServer, guildId: string, ticket: unknown): void {
  io.to(`guild:${guildId}`).emit('ticket:created', ticket);
}

export function emitTicketClosed(io: SocketIOServer, guildId: string, ticket: unknown): void {
  io.to(`guild:${guildId}`).emit('ticket:closed', ticket);
}

export function emitTicketMessage(
  io: SocketIOServer,
  ticketId: string,
  message: unknown,
): void {
  io.to(`ticket:${ticketId}`).emit('ticket:message', message);
}
