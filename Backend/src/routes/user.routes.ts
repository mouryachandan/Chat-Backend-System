import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { validate } from '../middleware/validate';
import { upsertUserBodySchema, userIdParamSchema } from '../schemas/user.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post(
  '/',
  validate({ body: upsertUserBodySchema }),
  asyncHandler(userController.upsertUser)
);

router.get(
  '/:userId',
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.getUserById)
);

router.get(
  '/:userId/chats',
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.listUserChats)
);

export default router;

