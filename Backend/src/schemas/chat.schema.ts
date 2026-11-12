import { z } from 'zod';

const userIdField = z.string().trim().min(1, 'userId is required').max(128, 'userId is too long');
const messageIdField = z.string().trim().min(1, 'messageId is required').max(128, 'messageId is too long');
const uuidField = z.string().uuid('Invalid chatId UUID format');

export const createChatBodySchema = z.object({
  userAId: userIdField,
  userBId: userIdField,
});

export const createGroupChatBodySchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(255),
  creatorId: userIdField,
  memberIds: z.array(userIdField).min(1, 'At least one memberId is required').max(200),
});

export const chatIdParamSchema = z.object({
  chatId: uuidField,
});

export const chatMemberParamSchema = z.object({
  chatId: uuidField,
  userId: userIdField,
});

export const messageParamSchema = z.object({
  chatId: uuidField,
  messageId: messageIdField,
});

export const sendMessageBodySchema = z.object({
  senderId: userIdField,
  text: z.string().trim().min(1, 'Message text cannot be empty').max(10_000),
});

export const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  order: z.enum(['asc', 'desc']).default('asc'),
  before: messageIdField.optional(),
});

export const markMessageReadBodySchema = z.object({
  userId: userIdField,
});

export const updateLastSeenBodySchema = z.object({
  userId: userIdField,
  messageId: messageIdField,
});

export const addGroupMembersBodySchema = z.object({
  userIds: z.array(userIdField).min(1, 'At least one userId is required').max(100),
  requesterId: userIdField.optional(),
});

export const removeGroupMemberBodySchema = z
  .object({
    requesterId: userIdField.optional(),
  })
  .optional();

export const editMessageBodySchema = z.object({
  senderId: userIdField,
  text: z.string().trim().min(1, 'Message text cannot be empty').max(10_000),
});

export const deleteMessageBodySchema = z
  .object({
    senderId: userIdField.optional(),
  })
  .optional();

export type CreateChatBody = z.infer<typeof createChatBodySchema>;
export type CreateGroupChatBody = z.infer<typeof createGroupChatBodySchema>;
export type ChatIdParams = z.infer<typeof chatIdParamSchema>;
export type ChatMemberParams = z.infer<typeof chatMemberParamSchema>;
export type MessageParams = z.infer<typeof messageParamSchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;
export type MarkMessageReadBody = z.infer<typeof markMessageReadBodySchema>;
export type UpdateLastSeenBody = z.infer<typeof updateLastSeenBodySchema>;
export type AddGroupMembersBody = z.infer<typeof addGroupMembersBodySchema>;
export type RemoveGroupMemberBody = z.infer<typeof removeGroupMemberBodySchema>;
export type EditMessageBody = z.infer<typeof editMessageBodySchema>;
export type DeleteMessageBody = z.infer<typeof deleteMessageBodySchema>;
