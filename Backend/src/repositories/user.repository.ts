import type { PoolClient } from 'pg';
import { query } from '../config/postgres';
import type { User } from '../types';

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function upsertUser(input: {
  id: string;
  name: string;
  email?: string | null;
}): Promise<User> {
  const result = await query<UserRow>(
    `INSERT INTO users (id, name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           email = COALESCE(EXCLUDED.email, users.email),
           updated_at = NOW()
     RETURNING id, name, email, created_at, updated_at`,
    [input.id, input.name, input.email ?? null]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to upsert user');
  }
  return mapUserRow(row);
}

export async function findUserById(userId: string): Promise<User | null> {
  const result = await query<UserRow>(
    `SELECT id, name, email, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  const row = result.rows[0];
  return row ? mapUserRow(row) : null;
}

export async function ensureUsersExist(
  userIds: readonly string[],
  client?: PoolClient
): Promise<void> {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) {
    return;
  }

  const sql = `
    INSERT INTO users (id, name)
    SELECT u_id, u_name
    FROM UNNEST($1::varchar[], $2::varchar[]) AS t(u_id, u_name)
    ON CONFLICT (id) DO NOTHING
  `;
  const params = [uniqueIds, uniqueIds];

  if (client) {
    await client.query(sql, params);
  } else {
    await query(sql, params);
  }
}

