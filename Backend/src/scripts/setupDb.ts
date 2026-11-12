import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { env } from '../config/env';

async function setupDatabase(): Promise<void> {
  const dbUrl = new URL(env.DATABASE_URL);
  const targetDbName = decodeURIComponent(dbUrl.pathname.replace(/^\//, ''));

  if (!targetDbName || !/^[a-zA-Z0-9_-]+$/.test(targetDbName)) {
    throw new Error(`Invalid PostgreSQL database name in DATABASE_URL: "${targetDbName}"`);
  }

  const adminUrl = new URL(env.DATABASE_URL);
  adminUrl.pathname = '/postgres';

  const adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();
  try {
    const existing = await adminClient.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
      [targetDbName]
    );
    if (!existing.rows[0]?.exists) {
      await adminClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`Created PostgreSQL database "${targetDbName}".`);
    } else {
      console.log(`PostgreSQL database "${targetDbName}" already exists.`);
    }
  } finally {
    await adminClient.end();
  }

  const targetClient = new Client({ connectionString: env.DATABASE_URL });
  await targetClient.connect();
  try {
    const schemaPath = path.resolve(__dirname, '../../sql/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await targetClient.query(schemaSql);
    console.log('Applied PostgreSQL schema successfully.');
  } finally {
    await targetClient.end();
  }
}

setupDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });

