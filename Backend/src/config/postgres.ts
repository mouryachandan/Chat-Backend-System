import fs from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params ? [...params] : undefined);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function initPostgresSchema(): Promise<void> {
  const schemaPath = path.resolve(__dirname, '../../sql/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schemaSql);
}

export async function checkPostgresHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closePostgres(): Promise<void> {
  await pool.end();
}

