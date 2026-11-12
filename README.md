# Chat Backend System (Node.js + TypeScript + PostgreSQL + Firebase Firestore)

A strictly typed Node.js + TypeScript chat backend that stores **users, chats, and memberships** in **PostgreSQL**, and **messages, read receipts, and last-seen pointers** in **Firebase Firestore**.

## Tech Stack

- **Runtime & Language:** Node.js + TypeScript (`strict: true`)
- **Framework:** Express
- **Validation:** Zod
- **Relational DB:** PostgreSQL (`pg`) — users, 1:1 & group chats, chat members
- **NoSQL / Real-time Store:** Firebase Firestore (`firebase-admin`) — messages, read receipts, last seen tracking

---

## Architecture & Data Model

### PostgreSQL (`Backend/sql/schema.sql`)
- `users`: `id`, `name`, `email`, `created_at`, `updated_at`
- `chats`: `id (UUID)`, `type ('direct' | 'group')`, `name`, `direct_key (UNIQUE canonical pair key for 1:1 chats)`, `created_by`, `created_at`, `updated_at`
- `chat_members`: `(chat_id, user_id)` composite PK, `role ('admin' | 'member')`, `joined_at`

### Firebase Firestore
- `chats/{chatId}/messages/{messageId}` — message document (`chatId`, `senderId`, `text`, `createdAt`, `updatedAt`, `isEdited`, `isDeleted`, `deletedAt`, `readBy`)
- `chats/{chatId}/messages/{messageId}/readReceipts/{userId}` — per-user read receipt (`userId`, `chatId`, `messageId`, `readAt`)
- `chats/{chatId}/lastSeen/{userId}` — per-user last seen message pointer (`userId`, `chatId`, `lastSeenMessageId`, `messageCreatedAt`, `updatedAt`)

---

## Setup & Running Locally

### 1. Install Dependencies
```bash
cd Backend
npm install
```

### 2. Configure Environment (`Backend/.env`)
`Backend/.env` is already configured with PostgreSQL (`DATABASE_URL=postgres://postgres:1234@localhost:5432/chat_backend`).

Configure **one** Firebase option in `Backend/.env`:
1. **Service Account JSON:** Place `serviceAccountKey.json` in `Backend/` and keep `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json`.
2. **Inline Env Vars:** Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
3. **Local Firestore Emulator:** Set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `FIREBASE_PROJECT_ID=demo-chat-backend`.

### 3. Initialize PostgreSQL Database & Schema
```bash
cd Backend
npm run db:setup
```
*(This creates the `chat_backend` database if it doesn't exist and applies `sql/schema.sql`.)*

### 4. Typecheck, Build, and Run
```bash
npm run typecheck
npm run dev      # development with watch mode
# OR
npm run build && npm start
```

---

## API Endpoints

### Core APIs
| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/chat/create` | Create or get existing 1:1 chat (`{ userAId, userBId }`) |
| `POST` | `/chat/:chatId/message/send` | Send message (`{ senderId, text }`) |
| `GET` | `/chat/:chatId/messages?limit=50` | Get messages ordered by timestamp (`limit`, `order=asc\|desc`, `before`) |
| `POST` | `/chat/:chatId/message/:messageId/read` | Mark message as read (`{ userId }`) |
| `POST` | `/chat/:chatId/lastseen` | Update last seen message (`{ userId, messageId }`) |
| `GET` | `/user/:userId/chats` | List user's chats with member IDs from PostgreSQL |

### Bonus APIs (Group Chats, Message Edit/Delete, Users, Health)
| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/chat/group` | Create a group chat (`{ name, creatorId, memberIds }`) |
| `GET` | `/chat/:chatId` | Get chat metadata and member IDs |
| `POST` | `/chat/:chatId/members` | Add members to a group chat (`{ userIds, requesterId? }`) |
| `DELETE` | `/chat/:chatId/members/:userId` | Remove/leave member from a group chat |
| `GET` | `/chat/:chatId/lastseen` | Get last seen records for all users in a chat |
| `PATCH` | `/chat/:chatId/message/:messageId` | Edit message (`{ senderId, text }`) |
| `DELETE` | `/chat/:chatId/message/:messageId` | Soft-delete message (`{ senderId }` or `?senderId=...`) |
| `POST` | `/user` | Create or update a user (`{ id?, name, email? }`) |
| `GET` | `/user/:userId` | Get user details |
| `GET` | `/health` | Health check for server & PostgreSQL |

---

## Quick `curl` Examples

```bash
# 1. Create or get 1:1 chat
curl -X POST http://localhost:3000/chat/create \
  -H "Content-Type: application/json" \
  -d '{"userAId":"user_1","userBId":"user_2"}'

# 2. Send a message (replace <CHAT_ID>)
curl -X POST http://localhost:3000/chat/<CHAT_ID>/message/send \
  -H "Content-Type: application/json" \
  -d '{"senderId":"user_1","text":"Hello!"}'

# 3. Get messages ordered by timestamp
curl "http://localhost:3000/chat/<CHAT_ID>/messages?limit=50"

# 4. Mark message read (replace <MESSAGE_ID>)
curl -X POST http://localhost:3000/chat/<CHAT_ID>/message/<MESSAGE_ID>/read \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_2"}'

# 5. Update last seen message
curl -X POST http://localhost:3000/chat/<CHAT_ID>/lastseen \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_2","messageId":"<MESSAGE_ID>"}'

# 6. List user chats
curl http://localhost:3000/user/user_1/chats
```

