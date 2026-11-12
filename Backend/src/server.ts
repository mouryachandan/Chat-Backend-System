import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { getDb } from './config/firebase';
import { closePostgres, initPostgresSchema } from './config/postgres';

async function bootstrap(): Promise<void> {
  await initPostgresSchema();
  console.log('PostgreSQL schema verified.');

  getDb();
  console.log('Firebase Firestore initialized.');

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    console.log(`Chat Backend listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string): void => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      void closePostgres()
        .then(() => {
          console.log('PostgreSQL pool closed.');
          process.exit(0);
        })
        .catch((err: unknown) => {
          console.error('Error closing PostgreSQL pool:', err);
          process.exit(1);
        });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start Chat Backend:', error);
  process.exit(1);
});

