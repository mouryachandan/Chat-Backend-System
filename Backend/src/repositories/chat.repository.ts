import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../config/postgres';
import type { Chat, ChatType, CreateOrGetChatResult, MemberRole } from '../types';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { ensureUsersExist } from './user.repository';

interface ChatRow {
  id: string;
  type: ChatType;
  name: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ChatWithMembersRow extends ChatRow {
  member_ids: string[] | null;
}

interface MembershipCheckRow {
  chat_id: string;
  type: ChatType;
  member_role: MemberRole | null;
}

function mapChatRow(row: ChatRow, memberIds: string[]): Chat {
  return {
    chatId: row.id,
    type: row.type,
    name: row.name,
    memberIds,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function fetchMemberIds(chatId: string, client?: PoolClient): Promise<string[]> {
  const sql = `
    SELECT user_id
    FROM chat_members
    WHERE chat_id = $1
    ORDER BY joined_at ASC, user_id ASC
  `;
  const result = client
    ? await client.query<{ user_id: string }>(sql, [chatId])
    : await query<{ user_id: string }>(sql, [chatId]);
  return result.rows.map((r) => r.user_id);
}

export async function getOrCreateDirectChat(
  userAId: string,
  userBId: string
): Promise<CreateOrGetChatResult> {
  const [firstId, secondId] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
  const directKey = JSON.stringify([firstId, secondId]);

  return withTransaction(async (client) => {
    await ensureUsersExist([firstId, secondId], client);

    const existing = await client.query<ChatRow>(
      `SELECT id, type, name, created_by, created_at, updated_at
       FROM chats
       WHERE direct_key = $1`,
      [directKey]
    );

    let chatRow = existing.rows[0];
    let isNew = false;

    if (!chatRow) {
      const chatId = crypto.randomUUID();
      const inserted = await client.query<ChatRow>(
        `INSERT INTO chats (id, type, direct_key, created_by)
         VALUES ($1, 'direct', $2, $3)
         ON CONFLICT (direct_key) DO NOTHING
         RETURNING id, type, name, created_by, created_at, updated_at`,
        [chatId, directKey, userAId]
      );

      if (inserted.rows[0]) {
        chatRow = inserted.rows[0];
        isNew = true;
        await client.query(
          `INSERT INTO chat_members (chat_id, user_id, role)
           VALUES ($1, $2, 'member'), ($1, $3, 'member')
           ON CONFLICT (chat_id, user_id) DO NOTHING`,
          [chatRow.id, firstId, secondId]
        );
      } else {
        const refetched = await client.query<ChatRow>(
          `SELECT id, type, name, created_by, created_at, updated_at
           FROM chats
           WHERE direct_key = $1`,
          [directKey]
        );
        chatRow = refetched.rows[0];
      }
    }

    if (!chatRow) {
      throw new Error('Failed to create or retrieve direct chat');
    }

    const memberIds = await fetchMemberIds(chatRow.id, client);
    return {
      ...mapChatRow(chatRow, memberIds),
      isNew,
    };
  });
}

export async function createGroupChat(input: {
  name: string;
  creatorId: string;
  memberIds: readonly string[];
}): Promise<Chat> {
  const uniqueMembers = Array.from(new Set([input.creatorId, ...input.memberIds]));

  return withTransaction(async (client) => {
    await ensureUsersExist(uniqueMembers, client);

    const chatId = crypto.randomUUID();
    const inserted = await client.query<ChatRow>(
      `INSERT INTO chats (id, type, name, direct_key, created_by)
       VALUES ($1, 'group', $2, NULL, $3)
       RETURNING id, type, name, created_by, created_at, updated_at`,
      [chatId, input.name, input.creatorId]
    );

    const chatRow = inserted.rows[0];
    if (!chatRow) {
      throw new Error('Failed to create group chat');
    }

    const chatIdsParam = uniqueMembers.map(() => chatId);
    const rolesParam: MemberRole[] = uniqueMembers.map((id) =>
      id === input.creatorId ? 'admin' : 'member'
    );

    await client.query(
      `INSERT INTO chat_members (chat_id, user_id, role)
       SELECT c_id, u_id, m_role
       FROM UNNEST($1::uuid[], $2::varchar[], $3::varchar[]) AS t(c_id, u_id, m_role)
       ON CONFLICT (chat_id, user_id) DO NOTHING`,
      [chatIdsParam, uniqueMembers, rolesParam]
    );

    const memberIds = await fetchMemberIds(chatId, client);
    return mapChatRow(chatRow, memberIds);
  });
}

export async function getChatById(chatId: string, client?: PoolClient): Promise<Chat | null> {
  const sql = `
    SELECT
      c.id,
      c.type,
      c.name,
      c.created_by,
      c.created_at,
      c.updated_at,
      COALESCE(
        ARRAY_AGG(cm.user_id ORDER BY cm.joined_at ASC, cm.user_id ASC)
        FILTER (WHERE cm.user_id IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS member_ids
    FROM chats c
    LEFT JOIN chat_members cm ON cm.chat_id = c.id
    WHERE c.id = $1
    GROUP BY c.id, c.type, c.name, c.created_by, c.created_at, c.updated_at
  `;

  const result = client
    ? await client.query<ChatWithMembersRow>(sql, [chatId])
    : await query<ChatWithMembersRow>(sql, [chatId]);

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return mapChatRow(row, row.member_ids ?? []);
}

export async function checkChatMembership(
  chatId: string,
  userId: string
): Promise<{ chatExists: boolean; chatType: ChatType | null; isMember: boolean; role: MemberRole | null }> {
  const result = await query<MembershipCheckRow>(
    `SELECT
       c.id AS chat_id,
       c.type AS type,
       cm.role AS member_role
     FROM chats c
     LEFT JOIN chat_members cm
       ON cm.chat_id = c.id AND cm.user_id = $2
     WHERE c.id = $1`,
    [chatId, userId]
  );

  const row = result.rows[0];
  if (!row) {
    return { chatExists: false, chatType: null, isMember: false, role: null };
  }

  return {
    chatExists: true,
    chatType: row.type,
    isMember: row.member_role !== null,
    role: row.member_role,
  };
}

export async function addMembersToGroupChat(
  chatId: string,
  userIds: readonly string[]
): Promise<Chat> {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) {
    throw new BadRequestError('At least one userId is required');
  }

  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string; type: ChatType }>(
      'SELECT id, type FROM chats WHERE id = $1 FOR UPDATE',
      [chatId]
    );
    const chat = existing.rows[0];
    if (!chat) {
      throw new NotFoundError(`Chat ${chatId} not found`);
    }
    if (chat.type !== 'group') {
      throw new BadRequestError('Members can only be added to group chats');
    }

    await ensureUsersExist(uniqueUserIds, client);

    const chatIdsParam = uniqueUserIds.map(() => chatId);
    const rolesParam = uniqueUserIds.map(() => 'member');
    await client.query(
      `INSERT INTO chat_members (chat_id, user_id, role)
       SELECT c_id, u_id, m_role
       FROM UNNEST($1::uuid[], $2::varchar[], $3::varchar[]) AS t(c_id, u_id, m_role)
       ON CONFLICT (chat_id, user_id) DO NOTHING`,
      [chatIdsParam, uniqueUserIds, rolesParam]
    );

    await client.query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);

    const updated = await getChatById(chatId, client);
    if (!updated) {
      throw new NotFoundError(`Chat ${chatId} not found`);
    }
    return updated;
  });
}

export async function removeMemberFromGroupChat(chatId: string, userId: string): Promise<Chat> {
  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string; type: ChatType }>(
      'SELECT id, type FROM chats WHERE id = $1 FOR UPDATE',
      [chatId]
    );
    const chat = existing.rows[0];
    if (!chat) {
      throw new NotFoundError(`Chat ${chatId} not found`);
    }
    if (chat.type !== 'group') {
      throw new BadRequestError('Members can only be removed from group chats');
    }

    const deleted = await client.query(
      'DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );
    if ((deleted.rowCount ?? 0) === 0) {
      throw new NotFoundError(`User ${userId} is not a member of chat ${chatId}`);
    }

    await client.query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);

    const updated = await getChatById(chatId, client);
    if (!updated) {
      throw new NotFoundError(`Chat ${chatId} not found`);
    }
    return updated;
  });
}

export async function listUserChats(userId: string): Promise<Chat[]> {
  const result = await query<ChatWithMembersRow>(
    `SELECT
       c.id,
       c.type,
       c.name,
       c.created_by,
       c.created_at,
       c.updated_at,
       ARRAY_AGG(all_cm.user_id ORDER BY all_cm.joined_at ASC, all_cm.user_id ASC) AS member_ids
     FROM chats c
     INNER JOIN chat_members user_cm
       ON user_cm.chat_id = c.id AND user_cm.user_id = $1
     INNER JOIN chat_members all_cm
       ON all_cm.chat_id = c.id
     GROUP BY c.id, c.type, c.name, c.created_by, c.created_at, c.updated_at
     ORDER BY c.updated_at DESC, c.created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => mapChatRow(row, row.member_ids ?? []));
}

export async function touchChatUpdatedAt(chatId: string): Promise<void> {
  await query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);
}

