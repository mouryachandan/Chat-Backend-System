import * as chatRepo from '../repositories/chat.repository';
import * as firestoreRepo from '../repositories/firestore.repository';
import type {
  Chat,
  ChatMessage,
  ChatType,
  CreateOrGetChatResult,
  LastSeenRecord,
  MemberRole,
  MessageOrder,
  ReadReceipt,
} from '../types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors';

async function assertChatMembership(
  chatId: string,
  userId: string
): Promise<{ chatType: ChatType; role: MemberRole }> {
  const membership = await chatRepo.checkChatMembership(chatId, userId);
  if (!membership.chatExists || !membership.chatType) {
    throw new NotFoundError(`Chat ${chatId} not found`);
  }
  if (!membership.isMember || !membership.role) {
    throw new ForbiddenError(`User ${userId} is not a member of chat ${chatId}`);
  }
  return { chatType: membership.chatType, role: membership.role };
}

async function assertChatExists(chatId: string): Promise<Chat> {
  const chat = await chatRepo.getChatById(chatId);
  if (!chat) {
    throw new NotFoundError(`Chat ${chatId} not found`);
  }
  return chat;
}

export async function createOrGetDirectChat(
  userAId: string,
  userBId: string
): Promise<CreateOrGetChatResult> {
  if (userAId === userBId) {
    throw new BadRequestError('userAId and userBId must be different users');
  }
  return chatRepo.getOrCreateDirectChat(userAId, userBId);
}

export async function createGroupChat(input: {
  name: string;
  creatorId: string;
  memberIds: string[];
}): Promise<Chat> {
  return chatRepo.createGroupChat(input);
}

export async function getChatById(chatId: string): Promise<Chat> {
  return assertChatExists(chatId);
}

export async function addGroupMembers(input: {
  chatId: string;
  userIds: string[];
  requesterId?: string;
}): Promise<Chat> {
  if (input.requesterId) {
    const { role } = await assertChatMembership(input.chatId, input.requesterId);
    if (role !== 'admin') {
      throw new ForbiddenError('Only group admins can add members');
    }
  }
  return chatRepo.addMembersToGroupChat(input.chatId, input.userIds);
}

export async function removeGroupMember(input: {
  chatId: string;
  userId: string;
  requesterId?: string;
}): Promise<Chat> {
  if (input.requesterId && input.requesterId !== input.userId) {
    const { role } = await assertChatMembership(input.chatId, input.requesterId);
    if (role !== 'admin') {
      throw new ForbiddenError('Only group admins can remove other members');
    }
  }
  return chatRepo.removeMemberFromGroupChat(input.chatId, input.userId);
}

export async function listUserChats(userId: string): Promise<Chat[]> {
  return chatRepo.listUserChats(userId);
}

export async function sendMessage(input: {
  chatId: string;
  senderId: string;
  text: string;
}): Promise<ChatMessage> {
  await assertChatMembership(input.chatId, input.senderId);
  const message = await firestoreRepo.createMessage(input);
  await chatRepo.touchChatUpdatedAt(input.chatId);
  return message;
}

export async function getMessages(input: {
  chatId: string;
  limit: number;
  order: MessageOrder;
  beforeMessageId?: string;
}): Promise<ChatMessage[]> {
  await assertChatExists(input.chatId);
  return firestoreRepo.getMessages(input);
}

export async function markMessageRead(input: {
  chatId: string;
  messageId: string;
  userId: string;
}): Promise<ReadReceipt> {
  await assertChatMembership(input.chatId, input.userId);
  return firestoreRepo.markMessageRead(input);
}

export async function updateLastSeen(input: {
  chatId: string;
  userId: string;
  messageId: string;
}): Promise<LastSeenRecord> {
  await assertChatMembership(input.chatId, input.userId);
  return firestoreRepo.updateLastSeen(input);
}

export async function getChatLastSeen(chatId: string): Promise<LastSeenRecord[]> {
  await assertChatExists(chatId);
  return firestoreRepo.getChatLastSeen(chatId);
}

export async function editMessage(input: {
  chatId: string;
  messageId: string;
  senderId: string;
  text: string;
}): Promise<ChatMessage> {
  await assertChatMembership(input.chatId, input.senderId);
  return firestoreRepo.editMessage(input);
}

export async function deleteMessage(input: {
  chatId: string;
  messageId: string;
  senderId: string;
}): Promise<ChatMessage> {
  await assertChatMembership(input.chatId, input.senderId);
  return firestoreRepo.deleteMessage(input);
}

