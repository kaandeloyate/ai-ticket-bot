import { Router, Response } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import { TicketModel } from '../../../models/Ticket';
import { UserModel } from '../../../models/User';
import { GuildModel } from '../../../models/Guild';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { TicketStatus, TicketCategory, TicketPriority } from '../../../types';
import { logger } from '../../../utils/logger';

const router = Router();
router.use(authMiddleware);

// GET /tickets — Tüm ticketları listele (filtreli)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      category,
      priority,
      page = '1',
      limit = '20',
      search,
      userId,
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = { guildId: req.user!.guildId };

    if (status && Object.values(TicketStatus).includes(status as TicketStatus)) {
      filter.status = status;
    }
    if (category && Object.values(TicketCategory).includes(category as TicketCategory)) {
      filter.category = category;
    }
    if (priority && Object.values(TicketPriority).includes(priority as TicketPriority)) {
      filter.priority = priority;
    }
    if (userId) filter.userId = userId;
    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { userTag: { $regex: search, $options: 'i' } },
        { ticketId: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [tickets, total] = await Promise.all([
      TicketModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-messages') // Mesajları liste görünümünde döndürme
        .lean(),
      TicketModel.countDocuments(filter),
    ]);

    res.json({
      tickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Ticket liste hatası', { error });
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// GET /tickets/stats — İstatistikler
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const guildId = req.user!.guildId;

    const [
      totalTickets,
      openTickets,
      closedTickets,
      pendingTickets,
      slaBreached,
      byCategory,
      byPriority,
      recentActivity,
    ] = await Promise.all([
      TicketModel.countDocuments({ guildId }),
      TicketModel.countDocuments({ guildId, status: TicketStatus.OPEN }),
      TicketModel.countDocuments({ guildId, status: TicketStatus.CLOSED }),
      TicketModel.countDocuments({ guildId, status: TicketStatus.PENDING }),
      TicketModel.countDocuments({ guildId, slaBreached: true }),
      TicketModel.aggregate([
        { $match: { guildId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      TicketModel.aggregate([
        { $match: { guildId } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      TicketModel.find({ guildId })
        .sort({ lastActivityAt: -1 })
        .limit(10)
        .select('ticketId status userId userTag category lastActivityAt')
        .lean(),
    ]);

    // Ortalama yanıt süresi
    const avgResponse = await TicketModel.aggregate([
      { $match: { guildId, firstResponseAt: { $ne: null } } },
      {
        $project: {
          responseTime: {
            $subtract: ['$firstResponseAt', '$createdAt'],
          },
        },
      },
      { $group: { _id: null, avg: { $avg: '$responseTime' } } },
    ]);

    res.json({
      totalTickets,
      openTickets,
      closedTickets,
      pendingTickets,
      slaBreached,
      avgResponseTimeMs: avgResponse[0]?.avg || 0,
      byCategory: Object.fromEntries(byCategory.map((b) => [b._id, b.count])),
      byPriority: Object.fromEntries(byPriority.map((b) => [b._id, b.count])),
      recentActivity,
    });
  } catch (error) {
    logger.error('İstatistik hatası', { error });
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// GET /tickets/:id — Ticket detay
router.get(
  '/:id',
  [param('id').isString().trim().notEmpty()],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const ticket = await TicketModel.findOne({
        guildId: req.user!.guildId,
        $or: [{ ticketId: req.params.id }, { _id: req.params.id }],
      }).lean();

      if (!ticket) {
        res.status(404).json({ error: 'Ticket bulunamadı' });
        return;
      }

      // Kullanıcı geçmişi
      const userHistory = await UserModel.findOne({
        userId: ticket.userId,
        guildId: req.user!.guildId,
      }).lean();

      res.json({ ticket, userHistory });
    } catch (error) {
      logger.error('Ticket detay hatası', { error });
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  },
);

// PATCH /tickets/:id — Ticket güncelle (öncelik, atama vb.)
router.patch(
  '/:id',
  [param('id').isString().trim().notEmpty()],
  async (req: AuthRequest, res: Response) => {
    try {
      const allowedUpdates = ['priority', 'assignedTo', 'tags', 'status'];
      const updates: Record<string, unknown> = {};

      for (const key of allowedUpdates) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      const ticket = await TicketModel.findOneAndUpdate(
        { guildId: req.user!.guildId, ticketId: req.params.id },
        { $set: updates },
        { new: true },
      );

      if (!ticket) {
        res.status(404).json({ error: 'Ticket bulunamadı' });
        return;
      }

      res.json({ ticket });
    } catch (error) {
      logger.error('Ticket güncelleme hatası', { error });
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  },
);

// GET /tickets/user/:userId — Kullanıcı ticket geçmişi
router.get('/user/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const tickets = await TicketModel.find({
      guildId: req.user!.guildId,
      userId: req.params.userId,
    })
      .sort({ createdAt: -1 })
      .select('-messages')
      .lean();

    const user = await UserModel.findOne({
      userId: req.params.userId,
      guildId: req.user!.guildId,
    }).lean();

    res.json({ tickets, user });
  } catch (error) {
    logger.error('Kullanıcı ticket hatası', { error });
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
