# Comment Please — Meta DM Automation Backend

Production-ready Node.js backend for automating Instagram and Facebook messaging workflows using Meta Graph APIs.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Database | MongoDB Atlas (Mongoose) |
| Queue | BullMQ + Redis |
| Meta APIs | Graph API v18, Webhooks |
| Auth | JWT (RS256-style) + Meta OAuth |
| Encryption | AES-256-GCM |
| Logging | Winston |
| Deployment | Docker + Nginx |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# → Fill in all values in .env

# 3. Start the API server (dev mode)
npm run dev

# 4. Start the worker process (separate terminal)
npm run worker:dev

# 5. Run token refresh cron (once per day)
npm run cron:tokens
```

---

## Project Structure

```
backend/
├── src/
│   ├── config/         # DB, Redis, BullMQ queues, env validation
│   ├── modules/
│   │   ├── auth/       # Registration, login, JWT, Meta OAuth
│   │   ├── webhook/    # Webhook controller, service, routes
│   │   ├── automation/ # CRUD + keyword matching engine
│   │   ├── messaging/  # Graph API DM & comment senders
│   │   ├── analytics/  # Stats aggregation
│   │   └── token/      # Token encryption, cache, refresh
│   ├── workers/        # BullMQ workers (webhook, message, analytics)
│   ├── middleware/     # Auth, validation, rate limiting, errors
│   ├── utils/          # Logger, crypto, helpers, signature validator
│   ├── cron/           # Scheduled jobs (token refresh)
│   ├── app.js          # Express app setup
│   └── server.js       # Server entry point
├── workers/
│   └── index.js        # Worker process entry point
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| GET | `/api/auth/meta` | Start Meta OAuth flow |
| GET | `/api/auth/meta/callback` | Meta OAuth callback |

### Automations
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/automations` | List automations |
| POST | `/api/automations` | Create automation |
| PATCH | `/api/automations/:id/toggle` | Enable/disable |
| DELETE | `/api/automations/:id` | Delete automation |

### Webhooks (called by Meta)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/webhooks/instagram` | Verification challenge |
| POST | `/api/webhooks/instagram` | Instagram events |
| GET | `/api/webhooks/facebook` | Verification challenge |
| POST | `/api/webhooks/facebook` | Facebook events |

### Analytics
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/analytics/stats` | Message stats |
| GET | `/api/analytics/volume` | Daily volume chart |
| GET | `/api/analytics/top-automations` | Top automations |

### Tokens
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/tokens` | List connected pages |
| DELETE | `/api/tokens/:pageId` | Disconnect a page |

---

## Queue Architecture

Three BullMQ queues, all backed by Redis:

| Queue | Concurrency | Retries | Purpose |
|-------|-------------|---------|---------|
| `webhook-events` | 20 | 5 (exponential) | Parse Meta webhook payloads |
| `outbound-messages` | 50 | 3 (exponential) | Send DMs via Graph API |
| `analytics-events` | 5 | 2 (fixed) | Async stats increments |
| `dead-letter-queue` | 1 | 0 (manual) | Exhausted jobs for review |

---

## Docker

```bash
# Start everything (API + Worker + Nginx + Redis)
docker-compose up -d

# Scale message workers
docker-compose up -d --scale worker=3
```

---

## Environment Variables

See `.env.example` for the full list. Required keys:

- `MONGO_URI` — MongoDB Atlas connection string
- `META_APP_ID` + `META_APP_SECRET` — From Meta Developer Console
- `META_WEBHOOK_VERIFY_TOKEN` — Your custom webhook verify token
- `ENCRYPTION_KEY` — Exactly 32 characters (for AES-256-GCM)
- `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` — Min 32 chars each

---

## Security Highlights

- All Meta access tokens stored AES-256-GCM encrypted
- Webhook payloads validated with HMAC-SHA256 (timing-safe)
- JWT refresh tokens stored in httpOnly, secure, SameSite cookies
- Redis-backed rate limiting per user + per IP
- Zod schema validation on all API inputs
- Helmet.js HTTP security headers
