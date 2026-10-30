import { Router } from 'express';
import { prisma } from '../../db/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let db: 'up' | 'down' = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'up';
  } catch {
    db = 'down';
  }
  res.json({
    success: true,
    data: {
      service: 'hr-api',
      status: 'ok',
      db,
      timestamp: new Date().toISOString(),
    },
  });
});
