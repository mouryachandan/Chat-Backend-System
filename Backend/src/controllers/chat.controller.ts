import type { Request, Response } from 'express';
import type {
  AddGroupMembersBody,
  ChatIdParams,
  ChatMemberParams,
  CreateChatBody,
  CreateGroupChatBody,
  DeleteMessageBody,
  EditMessageBody,
  GetMessagesQuery,
  MarkMessageReadBody,
  MessageParams,
  RemoveGroupMemberBody,
  SendMessageBody,
  UpdateLastSeenBody,
} from '../schemas/chat.schema';
import * as chatService from '../services/chat.service';
import { BadRequestError } from '../utils/errors';

export async function createOrGetChat(
  req: Request<Record<string, never>, unknown, CreateChatBody>,
  res: Response
): Promise<void> {
  const result = await chatService.createOrGetDirectChat(req.body.userAId, req.body.userBId);
  res.status(result.isNew ? 201 : 200).json(result);
}

export async function createGroupChat(
  req: Request<Record<string, never>, unknown, CreateGroupChatBody>,
  res: Response
): Promise<void> {
  const chat = await chatService.createGroupChat(req.body);
  res.status(201).json(chat);
}

export async function getChatById(
  req: Request<ChatIdParams>,
  res: Response
): Promise<void> {
  const chat = await chatService.getChatById(req.params.chatId);
  res.status(200).json(chat);
}

export async function addGroupMembers(
  req: Request<ChatIdParams, unknown, AddGroupMembersBody>,
  res: Response
): Promise<void> {
  const chat = await chatService.addGroupMembers({
    chatId: req.params.chatId,
    userIds: req.body.userIds,
    requesterId: req.body.requesterId,
  });
  res.status(200).json(chat);
}

export async function removeGroupMember(
  req: Request<ChatMemberParams, unknown, RemoveGroupMemberBody>,
  res: Response
): Promise<void> {
  const requesterFromQuery =
    typeof req.query['requesterId'] === 'string' ? req.query['requesterId'] : undefined;

  const chat = await chatService.removeGroupMember({
    chatId: req.params.chatId,
    userId: req.params.userId,
    requesterId: req.body?.requesterId ?? requesterFromQuery,
  });
  res.status(200).json(chat);
}

export async function sendMessage(
  req: Request<ChatIdParams, unknown, SendMessageBody>,
  res: Response
): Promise<void> {
  const message = await chatService.sendMessage({
    chatId: req.params.chatId,
    senderId: req.body.senderId,
    text: req.body.text,
  });
  res.status(201).json(message);
}

export async function getMessages(
  req: Request<ChatIdParams>,
  res: Response
): Promise<void> {
  const query = res.locals['validatedQuery'] as GetMessagesQuery;
  const messages = await chatService.getMessages({
    chatId: req.params.chatId,
    limit: query.limit,
    order: query.order,
    beforeMessageId: query.before,
  });

  res.status(200).json({
    chatId: req.params.chatId,
    count: messages.length,
    messages,
  });
}

export async function markMessageRead(
  req: Request<MessageParams, unknown, MarkMessageReadBody>,
  res: Response
): Promise<void> {
  const receipt = await chatService.markMessageRead({
    chatId: req.params.chatId,
    messageId: req.params.messageId,
    userId: req.body.userId,
  });
  res.status(200).json(receipt);
}

export async function updateLastSeen(
  req: Request<ChatIdParams, unknown, UpdateLastSeenBody>,
  res: Response
): Promise<void> {
  const lastSeen = await chatService.updateLastSeen({
    chatId: req.params.chatId,
    userId: req.body.userId,
    messageId: req.body.messageId,
  });
  res.status(200).json(lastSeen);
}

export async function getChatLastSeen(
  req: Request<ChatIdParams>,
  res: Response
): Promise<void> {
  const lastSeen = await chatService.getChatLastSeen(req.params.chatId);
  res.status(200).json({
    chatId: req.params.chatId,
    lastSeen,
  });
}

export async function editMessage(
  req: Request<MessageParams, unknown, EditMessageBody>,
  res: Response
): Promise<void> {
  const updated = await chatService.editMessage({
    chatId: req.params.chatId,
    messageId: req.params.messageId,
    senderId: req.body.senderId,
    text: req.body.text,
  });
  res.status(200).json(updated);
}

export async function deleteMessage(
  req: Request<MessageParams, unknown, DeleteMessageBody>,
  res: Response
): Promise<void> {
  const senderFromQuery =
    typeof req.query['senderId'] === 'string' ? req.query['senderId'].trim() : undefined;
  const senderId = req.body?.senderId ?? senderFromQuery;

  if (!senderId) {
    throw new BadRequestError('senderId is required in request body or query');
  }

  const updated = await chatService.deleteMessage({
    chatId: req.params.chatId,
    messageId: req.params.messageId,
    senderId,
  });
  res.status(200).json(updated);
}
