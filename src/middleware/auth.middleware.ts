import { Request, Response, NextFunction } from 'express';
import { authService } from '../auth/services/auth.service';
import { prisma } from '../lib/prisma';
import logger from '../utils/logger';

/**
 * Middleware to authenticate JWT token from cookies.
 * On success, attaches `req.user` with id/email/role/isVerified.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ error: 'Unauthorized: No refresh token provided' });
      return;
    }

    let payload;
    try {
      payload = authService.verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ error: 'Unauthorized: Invalid refresh token' });
      return;
    }

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userId: payload.userId,
        expiresAt: { gt: new Date() },
        revoked: false,
      },
    });
    if (!storedToken) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired refresh token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
      },
    });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
