import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../../Auth/auth.types';
import { debugLog } from '../utils/debug';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    debugLog('Auth', 'Missing or invalid Authorization header:', authHeader ?? 'none');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as JwtPayload;
    debugLog('Auth', 'Token verified - userId:', decoded.id, 'email:', decoded.email);
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    next();
  } catch (err) {
    debugLog('Auth', 'Token verification failed:', (err as Error).message);
    res.status(401).json({ error: 'Unauthorized' });
  }
}
