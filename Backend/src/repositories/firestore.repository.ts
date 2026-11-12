import {
  FieldValue,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase-admin/firestore';
import { getDb } from '../config/firebase';
import type { ChatMessage, LastSeenRecord, MessageOrder, ReadReceipt } from '../types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

function messagesCollection(chatId: string): CollectionReference<DocumentData> {
  return getDb().collection('chats').doc(chatId).collection('messages');
}

function lastSeenCollection(chatId: string): CollectionReference<DocumentData> {
  return getDb().collection('chats').doc(chatId).collection('lastSeen');
}

function timestampToIso(value: unknown): string | null {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function mapReadBy(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [userId, ts] of Object.entries(raw as Record<string, unknown>)) {
    const iso = timestampToIso(ts);
    if (iso) {
      result[userId] = iso;
    }
  }
  return result;
}

function mapMessageDoc(doc: DocumentSnapshot<DocumentData>, fallbackChatId: string): ChatMessage {
  const data = doc.data() ?? {};
  const createdAt = timestampToIso(data['createdAt']) ?? new Date().toISOString();

  return {
    messageId: doc.id,
    chatId: typeof data['chatId'] === 'string' ? data['chatId'] : fallbackChatId,
    senderId: typeof data['senderId'] === 'string' ? data['senderId'] : '',
    text: typeof data['text'] === 'string' ? data['text'] : '',
    createdAt,
    updatedAt: timestampToIso(data['updatedAt']),
    isEdited: Boolean(data['isEdited']),
    isDeleted: Boolean(data['isDeleted']),
    deletedAt: timestampToIso(data['deletedAt']),
    readBy: mapReadBy(data['readBy']),
  };
}

export async function createMessage(input: {
  chatId: string;
  senderId: string;
  text: string;
}): Promise<ChatMessage> {
  const col = messagesCollection(input.chatId);
  const msgRef = col.doc();

  await msgRef.set({
    chatId: input.chatId,
    senderId: input.senderId,
    text: input.text,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: null,
    isEdited: false,
    isDeleted: false,
    deletedAt: null,
    readBy: {
      [input.senderId]: FieldValue.serverTimestamp(),
    },
  });

  const saved = await msgRef.get();
  return mapMessageDoc(saved, input.chatId);
}

export async function getMessages(input: {
  chatId: string;
  limit: number;
  order: MessageOrder;
  beforeMessageId?: string;
}): Promise<ChatMessage[]> {
  const col = messagesCollection(input.chatId);
  let queryRef = col.orderBy('createdAt', 'desc').limit(input.limit);

  if (input.beforeMessageId) {
    const cursorSnap = await col.doc(input.beforeMessageId).get();
    if (!cursorSnap.exists) {
      throw new NotFoundError(`Cursor message ${input.beforeMessageId} not found in chat ${input.chatId}`);
    }
    queryRef = queryRef.startAfter(cursorSnap);
  }

  const snapshot = await queryRef.get();
  const docs = input.order === 'asc' ? [...snapshot.docs].reverse() : snapshot.docs;
  return docs.map((doc) => mapMessageDoc(doc, input.chatId));
}

export async function markMessageRead(input: {
  chatId: string;
  messageId: string;
  userId: string;
}): Promise<ReadReceipt> {
  const db = getDb();
  const msgRef = messagesCollection(input.chatId).doc(input.messageId);
  const msgSnap = await msgRef.get();

  if (!msgSnap.exists) {
    throw new NotFoundError(`Message ${input.messageId} not found in chat ${input.chatId}`);
  }

  const receiptRef = msgRef.collection('readReceipts').doc(input.userId);
  const batch = db.batch();

  batch.set(
    msgRef,
    {
      readBy: {
        [input.userId]: FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );

  batch.set(
    receiptRef,
    {
      chatId: input.chatId,
      messageId: input.messageId,
      userId: input.userId,
      readAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  const receiptSnap = await receiptRef.get();
  const receiptData = receiptSnap.data() ?? {};

  return {
    chatId: input.chatId,
    messageId: input.messageId,
    userId: input.userId,
    readAt: timestampToIso(receiptData['readAt']) ?? new Date().toISOString(),
  };
}

export async function updateLastSeen(input: {
  chatId: string;
  userId: string;
  messageId: string;
}): Promise<LastSeenRecord> {
  const msgSnap = await messagesCollection(input.chatId).doc(input.messageId).get();
  if (!msgSnap.exists) {
    throw new NotFoundError(`Message ${input.messageId} not found in chat ${input.chatId}`);
  }

  const msgData = msgSnap.data() ?? {};
  const lastSeenRef = lastSeenCollection(input.chatId).doc(input.userId);

  await lastSeenRef.set(
    {
      chatId: input.chatId,
      userId: input.userId,
      lastSeenMessageId: input.messageId,
      messageCreatedAt: msgData['createdAt'] ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const saved = await lastSeenRef.get();
  const savedData = saved.data() ?? {};

  return {
    chatId: input.chatId,
    userId: input.userId,
    lastSeenMessageId: input.messageId,
    messageCreatedAt: timestampToIso(savedData['messageCreatedAt']),
    updatedAt: timestampToIso(savedData['updatedAt']) ?? new Date().toISOString(),
  };
}

export async function getChatLastSeen(chatId: string): Promise<LastSeenRecord[]> {
  const snapshot = await lastSeenCollection(chatId).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      chatId,
      userId: typeof data['userId'] === 'string' ? data['userId'] : doc.id,
      lastSeenMessageId:
        typeof data['lastSeenMessageId'] === 'string' ? data['lastSeenMessageId'] : '',
      messageCreatedAt: timestampToIso(data['messageCreatedAt']),
      updatedAt: timestampToIso(data['updatedAt']) ?? new Date().toISOString(),
    };
  });
}

export async function editMessage(input: {
  chatId: string;
  messageId: string;
  senderId: string;
  text: string;
}): Promise<ChatMessage> {
  const msgRef = messagesCollection(input.chatId).doc(input.messageId);
  const snap = await msgRef.get();

  if (!snap.exists) {
    throw new NotFoundError(`Message ${input.messageId} not found in chat ${input.chatId}`);
  }

  const data = snap.data() ?? {};
  if (data['senderId'] !== input.senderId) {
    throw new ForbiddenError('Only the original sender can edit this message');
  }
  if (data['isDeleted'] === true) {
    throw new BadRequestError('Cannot edit a deleted message');
  }

  await msgRef.update({
    text: input.text,
    isEdited: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updated = await msgRef.get();
  return mapMessageDoc(updated, input.chatId);
}

export async function deleteMessage(input: {
  chatId: string;
  messageId: string;
  senderId: string;
}): Promise<ChatMessage> {
  const msgRef = messagesCollection(input.chatId).doc(input.messageId);
  const snap = await msgRef.get();

  if (!snap.exists) {
    throw new NotFoundError(`Message ${input.messageId} not found in chat ${input.chatId}`);
  }

  const data = snap.data() ?? {};
  if (data['senderId'] !== input.senderId) {
    throw new ForbiddenError('Only the original sender can delete this message');
  }

  if (data['isDeleted'] !== true) {
    await msgRef.update({
      text: '',
      isDeleted: true,
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const updated = await msgRef.get();
  return mapMessageDoc(updated, input.chatId);
}

