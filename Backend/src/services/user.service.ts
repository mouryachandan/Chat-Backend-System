import * as userRepo from '../repositories/user.repository';
import type { User } from '../types';
import { NotFoundError } from '../utils/errors';

export async function upsertUser(input: {
  id: string;
  name: string;
  email?: string | null;
}): Promise<User> {
  return userRepo.upsertUser(input);
}

export async function getUserById(userId: string): Promise<User> {
  const user = await userRepo.findUserById(userId);
  if (!user) {
    throw new NotFoundError(`User ${userId} not found`);
  }
  return user;
}

