import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { UpsertUserBody, UserIdParams } from '../schemas/user.schema';
import * as chatService from '../services/chat.service';
import * as userService from '../services/user.service';

export async function upsertUser(
  req: Request<Record<string, never>, unknown, UpsertUserBody>,
  res: Response
): Promise<void> {
  const user = await userService.upsertUser({
    id: req.body.id ?? crypto.randomUUID(),
    name: req.body.name,
    email: req.body.email ?? null,
  });

  res.status(201).json(user);
}

export async function getUserById(
  req: Request<UserIdParams>,
  res: Response
): Promise<void> {
  const user = await userService.getUserById(req.params.userId);
  res.status(200).json(user);
}

export async function listUserChats(
  req: Request<UserIdParams>,
  res: Response
): Promise<void> {
  const chats = await chatService.listUserChats(req.params.userId);
  res.status(200).json({
    userId: req.params.userId,
    count: chats.length,
    chats,
  });
}

