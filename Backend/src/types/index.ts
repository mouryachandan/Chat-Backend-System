export type ChatType = 'direct' | 'group';
export type MemberRole = 'admin' | 'member';
export type MessageOrder = 'asc' | 'desc';

export interface User {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMember {
  chatId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

export interface Chat {
  chatId: string;
  type: ChatType;
  name: string | null;
  memberIds: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrGetChatResult extends Chat {
  isNew: boolean;
}

export interface ChatMessage {
  messageId: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  updatedAt: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  deletedAt: string | null;
  readBy: Record<string, string>;
}

export interface ReadReceipt {
  chatId: string;
  messageId: string;
  userId: string;
  readAt: string;
}

export interface LastSeenRecord {
  chatId: string;
  userId: string;
  lastSeenMessageId: string;
  messageCreatedAt: string | null;
  updatedAt: string;
}

