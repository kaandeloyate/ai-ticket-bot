import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { initializeSocket } from './socket';
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';

export function createDashboard(): { app: Application; httpServer: ReturnType<typeof createServer>; io: SocketIOServer } {
  const app: Application = express();
  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin:
        config.nodeEnv === 'production'
          ? 'https://your-dashboard-domain.com'
          : 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ─── Middleware ──────────────────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: config.nodeEnv === 'production' }));
  app.use(
    cors({
      origin:
        config.nodeEnv === 'production'
          ? 'https://your-dashboard-domain.com'
          : 'http://localhost:3000',
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Global rate limiter
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Çok fazla istek. Lütfen bekleyin.' },
    }),
  );

  // Request logger
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
    next();
  });

  // ─── Routes ──────────────────────────────────────────────────────────────
  app.use('/auth', authRoutes);
  app.use('/tickets', ticketRoutes);

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Static frontend (production)
  if (config.nodeEnv === 'production') {
    const frontendPath = path.join(__dirname, '../frontend/dist');
    app.use(express.static(frontendPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Express hatası', { err });
    res.status(500).json({ error: 'Sunucu hatası' });
  });

  // Socket.io
  initializeSocket(io);

  return { app, httpServer, io };
}
