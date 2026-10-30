import { Router } from 'express';
import { zibalService } from '../services/zibal.service';

const router = Router();

router.get('/zibal/callback', async (req, res) => {
  const destination = await zibalService.handleCallback({
    success: typeof req.query.success === 'string' ? req.query.success : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    trackId: typeof req.query.trackId === 'string' ? req.query.trackId : undefined,
    orderId: typeof req.query.orderId === 'string' ? req.query.orderId : undefined,
  });
  res.redirect(destination);
});

export default router;
