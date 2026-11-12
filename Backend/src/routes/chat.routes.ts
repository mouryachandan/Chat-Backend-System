import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';
import { validate } from '../middleware/validate';
import {
  addGroupMembersBodySchema,
  chatIdParamSchema,
  chatMemberParamSchema,
  createChatBodySchema,
  createGroupChatBodySchema,
  deleteMessageBodySchema,
  editMessageBodySchema,
  getMessagesQuerySchema,
  markMessageReadBodySchema,
  messageParamSchema,
  removeGroupMemberBodySchema,
  sendMessageBodySchema,
  updateLastSeenBodySchema,
} from '../schemas/chat.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// 1:1 Direct Chat (Create or Get)
router.post(
  '/create',
  validate({ body: createChatBodySchema }),
  asyncHandler(chatController.createOrGetChat)
);

// Bonus: Group Chat Creation & Management
router.post(
  '/group',
  validate({ body: createGroupChatBodySchema }),
  asyncHandler(chatController.createGroupChat)
);

router.get(
  '/:chatId',
  validate({ params: chatIdParamSchema }),
  asyncHandler(chatController.getChatById)
);

router.post(
  '/:chatId/members',
  validate({ params: chatIdParamSchema, body: addGroupMembersBodySchema }),
  asyncHandler(chatController.addGroupMembers)
);

router.delete(
  '/:chatId/members/:userId',
  validate({ params: chatMemberParamSchema, body: removeGroupMemberBodySchema }),
  asyncHandler(chatController.removeGroupMember)
);

// Messages (Firestore)
router.post(
  '/:chatId/message/send',
  validate({ params: chatIdParamSchema, body: sendMessageBodySchema }),
  asyncHandler(chatController.sendMessage)
);

router.get(
  '/:chatId/messages',
  validate({ params: chatIdParamSchema, query: getMessagesQuerySchema }),
  asyncHandler(chatController.getMessages)
);

router.post(
  '/:chatId/message/:messageId/read',
  validate({ params: messageParamSchema, body: markMessageReadBodySchema }),
  asyncHandler(chatController.markMessageRead)
);

// Bonus: Message Edit & Soft Delete
router.patch(
  '/:chatId/message/:messageId',
  validate({ params: messageParamSchema, body: editMessageBodySchema }),
  asyncHandler(chatController.editMessage)
);

router.delete(
  '/:chatId/message/:messageId',
  validate({ params: messageParamSchema, body: deleteMessageBodySchema }),
  asyncHandler(chatController.deleteMessage)
);

// Last Seen Tracking (Firestore)
router.post(
  '/:chatId/lastseen',
  validate({ params: chatIdParamSchema, body: updateLastSeenBodySchema }),
  asyncHandler(chatController.updateLastSeen)
);

router.get(
  '/:chatId/lastseen',
  validate({ params: chatIdParamSchema }),
  asyncHandler(chatController.getChatLastSeen)
);

export default router;

