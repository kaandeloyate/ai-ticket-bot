import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../config';
import { JWTPayload } from '../../../types';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token =
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.cookies?.token as string | undefined);

  if (!token) {
    res.status(401).json({ error: 'Yetkilendirme gerekli' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JWTPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin yetkisi gerekli' });
    return;
  }
  next();
}
