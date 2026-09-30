import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { currentUser, login, signup } from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.get('/me', requireAuth, currentUser);

export default router;