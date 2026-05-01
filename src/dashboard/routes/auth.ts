import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { config } from '../../../config';
import { logger } from '../../../utils/logger';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10,
  message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
});

// POST /auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { password, guildId } = req.body;

    if (!password || !guildId) {
      res.status(400).json({ error: 'Şifre ve guild ID gerekli' });
      return;
    }

    const isValid = await bcrypt.compare(password, await bcrypt.hash(config.adminPassword, 10)) ||
      password === config.adminPassword;

    if (!isValid) {
      logger.warn('Başarısız dashboard girişi', { guildId, ip: req.ip });
      res.status(401).json({ error: 'Geçersiz şifre' });
      return;
    }

    const payload: import('../../../types').JWTPayload = {
      userId: 'admin',
      guildId,
      role: 'admin',
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as any,
    });

    logger.info('Dashboard girişi başarılı', { guildId, ip: req.ip });

    res.json({ token, expiresIn: config.jwtExpiresIn });
  } catch (error) {
    logger.error('Auth hatası', { error });
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /auth/verify
router.post('/verify', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ valid: false });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    res.json({ valid: true, payload });
  } catch {
    res.status(401).json({ valid: false });
  }
});

export default router;
