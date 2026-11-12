import { z } from 'zod';

const nonEmptyId = z.string().trim().min(1, 'ID is required').max(128, 'ID is too long');

export const upsertUserBodySchema = z.object({
  id: nonEmptyId.optional(),
  name: z.string().trim().min(1, 'name is required').max(255),
  email: z.string().trim().email('Invalid email address').max(255).nullable().optional(),
});

export const userIdParamSchema = z.object({
  userId: nonEmptyId,
});

export type UpsertUserBody = z.infer<typeof upsertUserBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamSchema>;

