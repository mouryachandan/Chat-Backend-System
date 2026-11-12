import cors from 'cors';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { checkPostgresHealth } from './config/postgres';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import chatRoutes from './routes/chat.routes';
import userRoutes from './routes/user.routes';
import { asyncHandler } from './utils/asyncHandler';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get(
    '/health',
    asyncHandler(async (_req: Request, res: Response): Promise<void> => {
      const postgresHealthy = await checkPostgresHealth();
      const statusCode = postgresHealthy ? 200 : 503;

      res.status(statusCode).json({
        status: postgresHealthy ? 'ok' : 'degraded',
        services: {
          postgres: postgresHealthy ? 'connected' : 'disconnected',
        },
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.use('/chat', chatRoutes);
  app.use('/user', userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
