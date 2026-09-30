import express from 'express';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '32kb' }));
  app.use((request, _response, next) => {
    request.io = app.locals.io;
    next();
  });

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.get('/api/config', (_request, response) => {
    response.json({ allowedEmailDomains: process.env.ALLOWED_EMAIL_DOMAINS.split(',').map((domain) => domain.trim()).filter(Boolean) });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/data', requireAuth, dataRoutes);
  app.use(errorHandler);
  return app;
}