# AIBridge Backend

AIBridge is an AI Adoption Platform that helps small and medium businesses evaluate AI readiness, ingest their knowledge base (PDF / DOCX / TXT documents + crawled websites), and expose it through an embeddable chat widget backed by an external LLM service.

This repository contains the **backend** (Node.js / Express / TypeScript / Prisma / PostgreSQL / Redis).

---

## Table of contents

- [Stack](#stack)
- [Architecture](#architecture)
- [Folder layout](#folder-layout)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Authentication](#authentication)
- [Error format](#error-format)
- [API reference](#api-reference)
  - [Health](#health)
  - [Auth (`/api/auth`)](#auth-apiauth)
  - [Users (`/api/users`)](#users-apiusers)
  - [Business (`/api/business`)](#business-apibusiness)
  - [Business settings (`/api/business-settings`)](#business-settings-apibusiness-settings)
  - [Documents (`/api/documents`)](#documents-apidocuments)
  - [Website (`/api/website`)](#website-apiwebsite)
  - [Knowledge base (`/api/knowledge-base`)](#knowledge-base-apiknowledge-base)
  - [Chat (`/api/chat`)](#chat-apichat)
  - [Widget (`/api/widget`)](#widget-apiwidget)
  - [Analytics (`/api/analytics`)](#analytics-apianalytics)
  - [Notifications (`/api/notifications`)](#notifications-apinotifications)
  - [Audit (`/api/audit`)](#audit-apiaudit)
  - [Sync (`/api/sync`)](#sync-apisync)
  - [Jobs (`/api/jobs`)](#jobs-apijobs)
  - [Cache (`/api/cache`)](#cache-apicache)
- [External integrations](#external-integrations)
- [Scripts](#scripts)

---

## Stack

| Layer       | Tech                                                |
| ----------- | --------------------------------------------------- |
| Runtime     | Node.js ≥ 16, TypeScript 5                         |
| HTTP        | Express 4                                           |
| Validation  | Zod                                                |
| ORM         | Prisma 5 + PostgreSQL                              |
| Cache       | Redis (ioredis)                                    |
| Auth        | JWT (jsonwebtoken), bcryptjs                        |
| Logging      | Pino + pino-pretty                                  |
| Uploads     | Multer (disk storage, PDF / DOCX / TXT only)        |
| Crawling     | Cheerio + Axios                                     |
| WebSocket   | socket.io (optional, feature-flagged)              |
| Container   | Docker + docker-compose                            |

---

## Architecture

4-layer modular / event-driven design, repeated for every feature module:

```
HTTP request
   │
   ▼  (Transport)
routes → controllers → middleware (auth, validation, errors)
   │
   ▼  (Application)
services → validators (Zod)
   │
   ▼  (Domain)
events (immutable value objects) + listeners (side-effects)
   │
   ▼  (Infrastructure)
repositories → Prisma → PostgreSQL
            → ioredis → Redis
```

Each module under `src/<module>/` follows:

```
src/<module>/
  controllers/   ← Express request handlers (HTTP shape)
  routes/        ← Router wiring + validation middleware
  services/      ← Business logic (framework-agnostic)
  repositories/  ← Prisma data access
  validators/    ← Zod input schemas
  events/        ← Domain event value objects (optional)
  listeners/     ← Side-effect handlers (optional)
```

Cross-cutting infrastructure lives at:

```
src/lib/          prisma.ts, redis.ts        (DB / cache clients)
src/middleware/   auth, authorization, error, request, validation
src/types/        ambient .d.ts shims (cors, cookie-parser, etc.)
src/utils/        logger.ts, cookie.ts
```

---

## Folder layout

```
src/
  app.ts                         Express app composition
  server.ts                      HTTP + Socket.IO bootstrap
  express-rate-limit.ts          Wrapper module (typed)
  socket.io.ts                   Wrapper module (typed)

  config/
    index.ts                     env-driven config singleton

  lib/
    prisma.ts                    PrismaClient singleton + graceful shutdown
    redis.ts                     ioredis singleton + retry/connection logs

  middleware/
    auth.middleware.ts           JWT cookie authentication → req.user
    authorization.middleware.ts  Role-based guard (`authorize([Role.ADMIN])`)
    validation.middleware.ts     Zod-driven body/params/query validator
    error.middleware.ts          notFoundHandler + errorHandler (Zod/Prisma)
    request.middleware.ts        request/response logging

  utils/
    logger.ts                    pino singleton
    cookie.ts                    typed cookie helper

  types/
    express/index.d.ts           augments Express Request with `user`
    cors.d.ts / compression.d.ts / cookie-parser.d.ts /
    express-rate-limit.d.ts / socket.io.d.ts / bcryptjs.d.ts /
    jsonwebtoken.d.ts            ambient typings shims

  analytics/  audit/  auth/  business/  business-settings/  cache/
  chat/       documents/  health/  jobs/  knowledge-base/  notifications/
  sync/       users/  website/  widget/
```

---

## Setup

### Prerequisites

- Node.js ≥ 16
- PostgreSQL ≥ 13
- Redis ≥ 5
- npm or yarn

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env.development
# Edit .env.development with your DATABASE_URL, REDIS_*, JWT_* etc.
```

### Database

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### Run (development)

```bash
npm run dev
# Server listens on $PORT (default 3000) — http://localhost:3000
```

### Run (production)

```bash
npm run build      # tsc → dist/
npm start          # node dist/server.js
```

### Docker

```bash
docker compose up --build
```

---

## Environment variables

| Var                       | Required | Default                                  | Notes                                            |
| ------------------------- | -------- | ---------------------------------------- | ------------------------------------------------ |
| `NODE_ENV`                |          | `development`                           |                                                  |
| `PORT`                    |          | `3000`                                   |                                                  |
| `TRUST_PROXY`             |          | `false`                                  | Set `true` behind LB                             |
| `CORS_ORIGIN`             |          | `http://localhost:3000`                  |                                                  |
| `LOG_LEVEL`               |          | `info`                                   | `trace`/`debug`/`info`/`warn`/`error`/`fatal` |
| `RATE_LIMIT_WINDOW_MS`    |          | `900000` (15 min)                        |                                                  |
| `RATE_LIMIT_MAX`          |          | `100`                                    |                                                  |
| `DATABASE_URL`            | ✓        | —                                        | Postgres connection string                       |
| `REDIS_HOST`              | ✓        | `localhost`                             |                                                  |
| `REDIS_PORT`              |          | `6379`                                   |                                                  |
| `REDIS_PASSWORD`          |          | (empty)                                  |                                                  |
| `JWT_ACCESS_SECRET`       | ✓        | —                                        | HS256 signing secret                            |
| `JWT_REFRESH_SECRET`      | ✓        | —                                        |                                                  |
| `JWT_ACCESS_EXPIRES_IN`   |          | `15m`                                    |                                                  |
| `JWT_REFRESH_EXPIRES_IN`  |          | `7d`                                     |                                                  |
| `COOKIE_SECRET`           |          | —                                        | for signed cookies                              |
| `COOKIE_SECURE`           |          | `false`                                  | set `true` in HTTPS environments                |
| `UPLOAD_MAX_SIZE`         |          | `10mb`                                   |                                                  |
| `UPLOAD_DIR`              |          | `./uploads`                              |                                                  |
| `EXTERNAL_DOCUMENT_SERVICE_URL` |     | `http://localhost:8000`                  | FastAPI document processor                       |
| `EXTERNAL_LLM_SERVICE_URL`       |     | `http://localhost:8000`                  | FastAPI chat completions                         |
| `FEATURE_WEBSOCKET_ENABLED`    |     | `false`                                  | enables Socket.IO                               |

A full example lives in `.env.example`.

---

## Authentication

Most routes require an authenticated user. The auth flow:

1. `POST /api/auth/login` returns an **access token** (in the response body) and sets a **`refreshToken` HTTP-only cookie**.
2. Every protected route reads the refresh cookie, validates the JWT, looks up the matching non-revoked `RefreshToken` row, and attaches the user to `req.user`.
3. `POST /api/auth/refresh` rotates the refresh token (revokes the old one, issues a new pair).
4. `POST /api/auth/logout` revokes the current refresh token and clears the cookie.

The `authorize([Role.ADMIN, ...])` middleware guards admin-only routes.

### Cookie attributes

```
refreshToken: HttpOnly; SameSite=Strict; Path=/;
              Secure iff NODE_ENV === 'production';
              Max-Age = 7 days
```

### Authenticated request shape

`req.user` (set by `authenticate` middleware):

```ts
{
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'ADMIN' | 'BUSINESS_OWNER' | 'EMPLOYEE';
  isVerified?: boolean;
}
```

---

## Error format

All errors are returned as JSON:

```json
{
  "error": "Human-readable summary"
}
```

Validation errors include a `details` array:

```json
{
  "error": "Validation failed",
  "details": [
    { "path": "email", "message": "Invalid email" }
  ]
}
```

Special status codes used:

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 400  | Validation failure / malformed input                       |
| 401  | Missing / invalid refresh token                             |
| 403  | Authenticated but role / ownership not allowed               |
| 404  | Resource not found                                         |
| 409  | Unique constraint violation (Prisma `P2002`)              |
| 500  | Unhandled exception                                        |
| 503  | Health check failing (database or Redis down)             |

---

## API reference

> All endpoints are mounted under `/api`. Authenticated routes expect a valid `refreshToken` cookie unless stated otherwise. `🔒` = requires authentication, `👑` = requires `ADMIN` role, public routes have no marker.

---

### Health

#### `GET /health` — public
Full liveness probe (Postgres `SELECT 1` + Redis `PING`).

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "healthy",
  "timestamp": "2026-06-20T10:00:00.000Z",
  "version": "1.0.0",
  "uptime": 123,
  "checks": {
    "database": { "status": "healthy", "message": "Database connection OK", "responseTime": 4 },
    "redis":    { "status": "healthy", "message": "Redis connection OK",    "responseTime": 1 }
  }
```

#### `GET /health/history` 🔒
Returns in-memory health check history (currently always `[]`).

#### `GET /health/latest` 🔒
Returns latest cached health check or 404.

---

### Auth (`/api/auth`)

#### `GET /api/auth` — public
Health probe for the auth router.

#### `POST /api/auth/register` — public
Create a new user.

```json
// Request
{ "email": "you@example.com", "password": "Str0ng!Pass", "firstName": "Ada", "lastName": "Lovelace" }
```
```json
// 201
{ "message": "Registration successful. Please verify your email.", "user": { ... } }
```

#### `POST /api/auth/login` — public
Verify credentials, set refresh cookie, return access token.

```json
// Request
{ "email": "you@example.com", "password": "Str0ng!Pass" }
```
```json
// 200
{ "accessToken": "eyJ...", "user": { ... } }
```

Sets cookie: `refreshToken=<jwt>; HttpOnly; SameSite=Strict; Path=/`

#### `POST /api/auth/refresh` — public
Rotate the refresh token. Reads `refreshToken` cookie, revokes the old row, issues a new pair.

```json
// 200
{ "accessToken": "eyJ..." }
```

#### `POST /api/auth/logout` 🔒
Revoke the current refresh token and clear the cookie.

#### `GET /api/auth/verify-email?token=<jwt>` — public
Verify the email verification token from the registration email.

#### `POST /api/auth/forgot-password` — public
Request a password reset email. Returns `{ message, devResetToken? }` (devResetToken included in non-production).

```json
// Request
{ "email": "you@example.com" }
```

#### `POST /api/auth/reset-password` — public
Complete a password reset.

```json
// Request
{ "token": "<reset-token>", "password": "NewStr0ng!Pass" }
```

---

### Users (`/api/users`)

> All routes require authentication.

#### `GET /api/users/:id` 🔒
Get a user by ID. Self or admin only.

#### `GET /api/users` 👑
List users with pagination, filters.

```
?page=1&limit=10&role=BUSINESS_OWNER&isVerified=true&searchTerm=ada
```

```json
// 200
{
  "users": [ ... ],
  "pagination": { "page": 1, "limit": 10, "total": 42, "pages": 5 }
}
```

#### `PUT /api/users/:id` 🔒
Update own profile (or any user as admin). Only admins may change `role`.

```json
// Request (partial)
{ "firstName": "Grace", "lastName": "Hopper" }
```

#### `DELETE /api/users/:id` 🔒
Soft-delete a user. Self or admin only.

#### `PATCH /api/users/:id/verify` 👑
Mark a user as verified.

#### `PATCH /api/users/:id/password` 🔒
Change own password.

```json
// Request
{ "currentPassword": "OldStr0ng!Pass", "newPassword": "NewStr0ng!Pass" }
```

#### `GET /api/users/count` 👑
Returns `{ count }` of active users.

---

### Business (`/api/business`)

> All routes require authentication.

#### `POST /api/business` 🔒
Create the business profile for the authenticated user (one per user).

```json
// Request
{ "name": "Acme Co", "industry": "ECOMMERCE", "websiteUrl": "https://acme.example", "contactEmail": "ops@acme.example" }
```

#### `GET /api/business?page=&limit=&industry=&name=&isActive=` 🔒
List businesses (admin only). `industry` is one of the Prisma `Industry` enum.

#### `GET /api/business/mine` 🔒
Returns the business for the current user, or 404.

#### `GET /api/business/count` 🔒
Number of active businesses.

#### `GET /api/business/:id` 🔒
Fetch a business by ID.

#### `PUT /api/business/:id` 🔒
Owner or admin only. Partial update (any subset of `name`, `description`, `websiteUrl`, `industry`, `contactEmail`, `contactPhone`, `address`, `isActive`).

#### `DELETE /api/business/:id` 🔒
Soft-delete a business. Owner or admin only.

---

### Business settings (`/api/business-settings`)

> All routes require authentication.

#### `GET /api/business-settings/me`
Returns the current user's business settings (creates if missing).

#### `PUT /api/business-settings/me`
Update current user's business settings.

```json
// Request (partial)
{ "timezone": "Asia/Kolkata", "language": "en", "dataRetentionDays": 90 }
```

#### `GET /api/business-settings/:businessId` 👑
Admin view of another business's settings.

---

### Documents (`/api/documents`)

> All routes require authentication. Documents are scoped to the authenticated user's business.

#### `POST /api/documents/upload`
`multipart/form-data` with field `file` plus optional `description`.

- Allowed MIME types: PDF, DOCX, TXT
- Max size: 10 MB (configurable via `UPLOAD_MAX_SIZE`)
- On success, the file is stored under `UPLOAD_DIR` and forwarded to `EXTERNAL_DOCUMENT_SERVICE_URL` for chunking + embedding.

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Cookie: refreshToken=..." \
  -F "file=@./manual.pdf" \
  -F "description=Onboarding guide"
```
```json
// 201
{
  "message": "Document uploaded successfully",
  "document": { "id": "...", "filename": "...", "isProcessed": false, ... }
}
```

#### `GET /api/documents` 🔒
List documents for the current user's business.

#### `GET /api/documents/count` 🔒
Count documents.

#### `GET /api/documents/:id` 🔒
Fetch a single document.

#### `PUT /api/documents/:id` 🔒
Update description / processed flag.

#### `DELETE /api/documents/:id` 🔒
Soft-delete the document.

#### `POST /api/documents/:id/process` 🔒
Mark the document as processed with extracted text + chunk count.

```json
// Request
{ "extractedText": "...", "chunkCount": 12 }
```

---

### Website (`/api/website`)

> All routes require authentication.

#### `POST /api/website/url`
Set or update the website URL for the current user's business.

```json
// Request
{ "url": "https://acme.example" }
```

#### `GET /api/website`
Fetch the website record for the current user's business.

#### `PUT /api/website`
Update website metadata (title / description / faviconUrl). At least one field required.

#### `DELETE /api/website`
Delete the website record (and all crawled pages via cascade).

#### `POST /api/website/crawl`
Crawl the homepage with Cheerio, extract title/description/favicon, store one page.

```json
// 200
{ "message": "Website crawled successfully", "website": { ... }, "pagesCrawled": 1 }
```

#### `POST /api/website/recrawl`
Delete existing pages, then crawl.

#### `GET /api/website/pages`
List all crawled pages for the current user's website.

---

### Knowledge base (`/api/knowledge-base`)

> All routes require authentication. The knowledge base is lazily created on first read.

#### `GET /api/knowledge-base`
Fetch (or create) the knowledge base for the current user's business.

#### `POST /api/knowledge-base`
Explicitly create a knowledge base.

```json
// Request
{ "name": "Acme KB", "description": "Main KB" }
```

#### `PUT /api/knowledge-base`
Update name / description.

#### `DELETE /api/knowledge-base`
Delete the knowledge base.

#### `POST /api/knowledge-base/document` / `DELETE /api/knowledge-base/document`
Increment / decrement the document counter.

#### `POST /api/knowledge-base/page` / `DELETE /api/knowledge-base/page`
Increment / decrement the page counter.

#### `POST /api/knowledge-base/ready`
Mark the knowledge base as ready.

```json
{ "isReady": true }
```

#### `GET /api/knowledge-base/stats`
Returns counts, ready flag, and timestamps.

```json
{
  "knowledgeBase": {
    "id": "...", "name": "Default Knowledge Base",
    "documentCount": 3, "pageCount": 12, "chunkCount": 48,
    "isReady": true, "createdAt": "...", "updatedAt": "..."
  }
}
```

---

### Chat (`/api/chat`)

#### `POST /api/chat/session` — public (used by widget)
Create a new chat session. Either supply `businessId` explicitly or have an auth cookie (the controller resolves the business from the user).

```json
// Request (widget)
{ "visitorId": "optional-uuid-from-cookie" }
```
```json
// 201
{
  "message": "Chat session created successfully",
  "chatSession": {
    "id": "...", "sessionToken": "uuid", "startedAt": "..."
  }
}
```

#### `GET /api/chat/session/:sessionToken` — public
Look up a session by widget token.

#### `POST /api/chat/:chatSessionId/message` — public
Create a user message. When `isFromUser: true`, the service forwards to `EXTERNAL_LLM_SERVICE_URL` and persists the bot reply.

```json
// Request
{ "content": "What are your hours?", "isFromUser": true }
```

#### `GET /api/chat/:chatSessionId/messages` — public
List messages for a session (oldest first).

#### `POST /api/chat/:chatSessionId/end` — public
End the session with optional feedback.

```json
{ "satisfactionScore": 5, "feedback": "Helpful!" }
```

#### `GET /api/chat/business` 🔒
List chat sessions for the current user's business.

#### `GET /api/chat/visitor/:visitorId` 🔒
List sessions for a given visitor.

#### `GET /api/chat/active-sessions` 🔒
List sessions for the current business with `endedAt: null`.

---

### Widget (`/api/widget`)

> All routes require authentication.

#### `GET /api/widget`
Fetch the widget config for the current user's business (lazy-creates a default).

#### `POST /api/widget`
Create a widget. Fails with 409 if one already exists.

```json
// Request
{ "title": "Chat with us", "theme": "LIGHT", "position": "BOTTOM_RIGHT", "isEnabled": true }
```

#### `PUT /api/widget`
Partial update of widget config.

#### `DELETE /api/widget`
Delete the widget.

---

### Analytics (`/api/analytics`)

> All routes require authentication. Most write operations are admin-only.

#### `GET /api/analytics/:businessId?metricType=&limit=100` 🔒
List recent analytics rows for a business. `metricType` filter accepts any `MetricType` enum value.

#### `GET /api/analytics/:businessId/metric/:metricType` 🔒
List analytics rows for a specific metric.

#### `GET /api/analytics/:businessId/metric/:metricType/latest` 🔒
Return the latest row for a metric.

#### `GET /api/analytics/:businessId/count` 🔒
Total count.

#### `POST /api/analytics` 👑
Record a new analytics row.

```json
{ "businessId": "...", "metricType": "TOTAL_CHATS", "metricValue": 42, "labels": { "source": "widget" } }
```

#### `PUT /api/analytics/:id` 👑
Partial update of an analytics row.

#### `DELETE /api/analytics/:id` 👑
Delete an analytics row.

#### `POST /api/analytics/:businessId/retention` 👑
Delete analytics older than `daysToKeep`.

```json
{ "daysToKeep": 90 }
```

---

### Notifications (`/api/notifications`)

> All routes require authentication. Notifications are scoped to the authenticated user's business.

#### `POST /api/notifications` 🔒
Create a notification.

```json
{ "title": "Welcome", "message": "Your audit is ready.", "type": "AI_READINESS_REPORT" }
```

#### `GET /api/notifications` 🔒
List all notifications.

#### `GET /api/notifications/unread` 🔒
List unread notifications.

#### `GET /api/notifications/count` 🔒
Total count.

#### `GET /api/notifications/unread/count` 🔒
Unread count.

#### `GET /api/notifications/:id` 🔒
Fetch one notification.

#### `PUT /api/notifications/:id` 🔒
Update fields (title / message / type / isRead).

#### `DELETE /api/notifications/:id` 🔒
Delete a notification.

#### `POST /api/notifications/:id/read` 🔒
Mark one notification read.

#### `POST /api/notifications/:id/unread` 🔒
Mark one notification unread.

#### `POST /api/notifications/read-all` 🔒
Mark every notification read for the business.

---

### Audit (`/api/audit`)

> All routes require authentication.

#### `POST /api/audit` 🔒
Typically called by the AI service when an audit finishes.

```json
{
  "businessId": "...",
  "readinessScore": 78,
  "businessSummary": "...",
  "aiOpportunities": ["..."],
  "automationSuggestions": ["..."],
  "estimatedBenefits": { "annualSavings": 120000 },
  "strengths": ["..."], "weaknesses": ["..."],
  "suggestedSolutions": ["..."], "expectedRoi": { ... }
}
```

#### `GET /api/audit/:id` 🔒
Fetch a single audit.

#### `GET /api/audit/business/:businessId` 🔒
List audits for a business (most recent first).

#### `GET /api/audit/business/:businessId/latest` 🔒
Latest audit for a business.

#### `GET /api/audit/business/:businessId/count` 🔒
Count audits for a business.

#### `PUT /api/audit/:id` 🔒
Partial update.

#### `DELETE /api/audit/:id` 🔒
Delete an audit.

---

### Sync (`/api/sync`)

> All routes require authentication.

#### `POST /api/sync` 🔒
Create a sync job record (does not run it).

```json
{ "type": "website" }   // "website" | "document" | "knowledge_base"
```

#### `POST /api/sync/website` 🔒
Run a website sync: creates the job, starts it, crawls the site, marks the job completed with pages/documents counts. On failure marks the job failed and rethrows.

#### `POST /api/sync/document` 🔒
Run a document sync: counts unprocessed documents, marks them processed.

#### `POST /api/sync/knowledge-base` 🔒
Run a knowledge-base sync: flips ready=true and recomputes counts.

#### `GET /api/sync` 🔒
List sync jobs for the current user's business.

#### `GET /api/sync/count` 🔒
Count.

#### `GET /api/sync/status/:status` 🔒
Filter by status.

#### `GET /api/sync/type/:type/latest` 🔒
Latest sync job for a given type.

#### `PUT /api/sync/:id` 🔒
Partial update (status / errorMessage / counts).

#### `DELETE /api/sync/:id` 🔒
Delete a sync job.

---

### Jobs (`/api/jobs`)

> All routes require authentication.

#### `POST /api/jobs` 🔒
Create a background job.

```json
{
  "name": "Recompute embeddings",
  "type": "EMBEDDING_RECOMPUTE",
  "payload": { "documentIds": ["..."] },
  "scheduledAt": "2026-06-20T12:00:00.000Z"
}
```

#### `GET /api/jobs/:id` 🔒
Fetch by ID.

#### `GET /api/jobs/business` 🔒
List jobs for the current user's business.

#### `GET /api/jobs/type/:type` 🔒
List by type.

#### `GET /api/jobs/status/:status` 🔒
List by status. `status` accepts `PENDING` | `PROCESSING` | `COMPLETED` | `FAILED`.

#### `GET /api/jobs/pending?limit=10` 🔒
List pending jobs ready to run (scheduledAt is null or past).

#### `PUT /api/jobs/:id` 🔒
Partial update.

#### `DELETE /api/jobs/:id` 🔒
Hard delete a job.

#### `POST /api/jobs/:id/start` 🔒
Transition to PROCESSING and increment attempts.

#### `POST /api/jobs/:id/complete` 🔒
Transition to COMPLETED with completedAt.

#### `POST /api/jobs/:id/fail` 🔒
Transition to FAILED with errorMessage.

```json
{ "errorMessage": "AI service unreachable" }
```

#### `GET /api/jobs/count` 👑
Total job count.

#### `GET /api/jobs/business/count` 🔒
Count for the current user's business.

#### `GET /api/jobs/type/:type/count` 🔒
Count by type.

#### `GET /api/jobs/status/:status/count` 🔒
Count by status.

---

### Cache (`/api/cache`)

> All routes require authentication. Write/destructive operations require `Role.ADMIN`.

#### `POST /api/cache/set` 👑
Store a JSON-serializable value.

```json
// Request
{ "key": "user:42", "value": { "name": "Ada" }, "ttl": 300 }
```

#### `GET /api/cache/get/:key` 🔒
Retrieve (returns 404 on cache miss).

#### `DELETE /api/cache/del/:key` 👑
Delete a key.

#### `GET /api/cache/exists/:key` 🔒
Existence check.

#### `GET /api/cache/info` 👑
Redis INFO output.

#### `POST /api/cache/flushall` 👑
Destructive — flushes the entire Redis DB.

#### `GET /api/cache/ttl/:key` 🔒
TTL in seconds (`-2` = missing, `-1` = no expiry).

---

## External integrations

| Service                  | URL env var                          | Used by                                      |
| ------------------------ | ------------------------------------ | -------------------------------------------- |
| FastAPI document service | `EXTERNAL_DOCUMENT_SERVICE_URL`      | `document.service.uploadDocument` (chunk/embed) |
| FastAPI LLM service      | `EXTERNAL_LLM_SERVICE_URL`           | `chat.service.createMessage` (bot replies)  |
| Optional Socket.IO       | `FEATURE_WEBSOCKET_ENABLED=true`     | Real-time updates to the widget              |

---

## Scripts

| Script          | Purpose                                       |
| --------------- | --------------------------------------------- |
| `npm run dev`   | ts-node-dev with auto-reload                 |
| `npm run build` | Compile TypeScript to `dist/`                 |
| `npm start`     | Run compiled server                           |
| `npm test`      | Jest                                          |
| `npm run lint`  | ESLint over `src/`                            |
| `npm run test:cov` | Jest coverage                              |
| `npm run prisma:generate` | Re-generate Prisma client              |
| `npm run prisma:migrate`  | `prisma migrate dev`                  |
| `npm run prisma:studio`   | Prisma Studio                        |

---

## Operational notes

- **Graceful shutdown** — SIGINT / SIGTERM trigger `server.close()`, Prisma `$disconnect()`, and Redis `quit()`.
- **Logging** — All requests are logged with method, URL, status, duration, IP, and user-agent.
- **Rate limiting** — Global `express-rate-limit` (100 req / 15 min / IP). Override per env.
- **Validation** — All requests pass through `validateRequest(schema)` / `validateParams(schema)` / `validateQuery(schema)`. Failures become 400s with `details`.
- **Caching** — Single Redis instance, `keyPrefix: 'aibridge:'`. Suitable for `cache-aside` patterns.
- **Uploads** — Files are streamed to `EXTERNAL_DOCUMENT_SERVICE_URL` after persisting locally; failures are logged but don't roll back the upload.

---

## License

MIT — see [LICENSE](./LICENSE).

---

Built with ❤️ by the AIBridge Team
