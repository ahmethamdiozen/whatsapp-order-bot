# CLAUDE.md — WhatsApp AI Ordering Bot

## Project Overview

An AI-powered restaurant ordering system built on WhatsApp Cloud API. Customers place orders through WhatsApp in natural language. The bot understands intent, presents an interactive menu, manages a cart via session, and saves confirmed orders to a database.

---

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **Messaging**: WhatsApp Cloud API (Meta Graph API v19.0)
- **AI**: Anthropic Claude API (`claude-sonnet-4-5`)
- **Database**: PostgreSQL + Prisma 7
- **Session Store**: Redis (ioredis)
- **Infrastructure**: Docker Compose

---

## Project Structure

```
src/
├── index.ts                  # Entry point — dotenv must be loaded first
├── webhook/
│   └── handler.ts            # Main message router — all conversation logic lives here
├── bot/
│   ├── ai.ts                 # Claude API integration — parses natural language orders
│   ├── messenger.ts          # WhatsApp message senders (text, interactive list, buttons)
│   └── types.ts              # Shared AI types (ParsedOrder, OrderItem)
├── menu/
│   └── menu.service.ts       # Menu queries — getMenuByLocation, findMenuItemByName, getMenuGroupedByCategory, getAllLocations
├── order/
│   └── order.service.ts      # Order creation and history — createOrder, getOrdersByPhone
└── lib/
    ├── prisma.ts              # Prisma client with PrismaPg adapter (Prisma 7 requires driver adapter)
    ├── redis.ts               # Redis client (ioredis)
    └── session.ts             # Session management — get/set/clear session in Redis
prisma/
├── schema.prisma              # Data models
├── seed.ts                    # Seed data — 3 locations, 5 menu items each
└── config.ts                  # Prisma 7 config — datasource URL lives here, not in schema
```

---

## Environment Variables (.env)

```env
PORT=3000
WHATSAPP_TOKEN=           # Permanent System User token from Meta Business Suite
PHONE_NUMBER_ID=          # From Meta App Dashboard > WhatsApp > API Setup
WABA_ID=                  # WhatsApp Business Account ID
VERIFY_TOKEN=             # Any string — used for webhook verification
ANTHROPIC_API_KEY=        # From console.anthropic.com
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wporderbot
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Infrastructure

Start with Docker Compose:

```bash
docker compose up -d
```

Services:
- **postgres** — port 5432, database: `wporderbot`, user/pass: `postgres`
- **redis** — port 6379

---

## Database

### Prisma 7 Notes
- Prisma 7 requires a **driver adapter** — `PrismaPg` from `@prisma/adapter-pg`
- `DATABASE_URL` lives in `prisma.config.ts`, NOT in `schema.prisma`
- Always import `PrismaClient` from `@prisma/client`

### Models
- **Location** — restaurant branches (name, address, phone, isActive)
- **MenuItem** — items scoped per location (name, description, price, category, isAvailable)
- **Order** — customer orders (customerPhone, locationId, totalPrice, status)
- **OrderStatus** enum: `PENDING | CONFIRMED | PREPARING | READY | DELIVERED | CANCELLED`
- **OrderItem** — line items linking Order to MenuItem (quantity, price)

### Commands
```bash
npx prisma migrate dev --name <name>   # Run migrations
npx prisma generate                     # Regenerate client after schema changes
npx prisma db seed                      # Seed locations and menu items
```

---

## Conversation Flow & Session States

Session is stored in Redis with 1 hour TTL. Key: `session:{phoneNumber}`

```
OrderSession {
  locationId?: number
  items: { name, quantity, price, menuItemId }[]
  total: number
  status: 'selecting_location' | 'browsing_menu' | 'awaiting_confirmation' | 'post_order'
}
```

### State Machine

```
[New message, no session]
        ↓
  selecting_location
  → User types 1/2/3 to pick branch
        ↓
  browsing_menu
  → Interactive list menu shown with cart summary
  → User taps item → added to cart, menu refreshed
  → User taps Checkout button → moves to awaiting_confirmation
  → REMOVE [item] → removes one from cart
  → CLEAR → empties cart
        ↓
  awaiting_confirmation
  → Order summary shown
  → YES → order saved to DB, moves to post_order
  → BACK/NO → returns to browsing_menu
        ↓
  post_order
  → "New Order" button → back to selecting_location
  → "My Orders" button → shows last 5 orders with date/time
  → Any text → re-shows post_order buttons
```

---

## WhatsApp Message Types Used

### 1. Text message
```typescript
sendMessage(to, text)
```

### 2. Interactive List (menu)
```typescript
sendInteractiveList(to, bodyText, buttonLabel, sections)
// sections: [{ title: string, rows: [{ id, title, description }] }]
// Max 10 sections, 10 rows each
// Row id format: "item_{menuItemId}"
```

### 3. Interactive Buttons (quick actions)
```typescript
sendQuickActions(to, hasItems)
// hasItems=true: Checkout | Clear Cart | Menu
// hasItems=false: nothing sent
```

```typescript
sendPostOrderActions(to)
// Buttons: New Order | My Orders
```

### Incoming message types to handle
- `message.type === 'text'` → `message.text.body`
- `message.type === 'interactive'`
  - `message.interactive.button_reply.id` → button tapped
  - `message.interactive.list_reply.id` → list item selected

---

## AI Integration

Claude parses natural language into structured order data:

```typescript
// Input: "1 burger and 2 cokes please"
// Output:
{
  intent: 'order' | 'question' | 'cancel' | 'other',
  items: [{ name: string, quantity: number, notes?: string }],
  rawMessage: string
}
```

**Important**: Claude sometimes wraps JSON in markdown code blocks (` ```json ``` `). Strip them before parsing:
```typescript
const clean = text.replace(/```json\n?|\n?```/g, '').trim();
```

---

## Known Issues & Gotchas

1. **dotenv must load before all imports** in `index.ts` — other modules read env at import time
2. **Prisma 7 adapter** — `new PrismaClient({ adapter })` is required, plain `new PrismaClient()` throws
3. **WhatsApp token expiry** — temporary tokens expire in 24h; use permanent System User token from Meta Business Suite
4. **ngrok for local dev** — Meta requires HTTPS webhook URL; use `ngrok http 3000`
5. **Homebrew PostgreSQL conflict** — if port 5432 is in use, stop it: `brew services stop postgresql`
6. **Interactive list body text limit** — max 1024 characters; keep cart summary concise

---

## What's Done

- [x] WhatsApp Cloud API setup and webhook verification
- [x] Incoming message handling (text + interactive)
- [x] Claude AI order parsing
- [x] Multi-location support with branch selection
- [x] Interactive menu with category grouping
- [x] Cart management (add, remove, clear)
- [x] Session management via Redis
- [x] Order confirmation flow
- [x] Order persistence to PostgreSQL
- [x] Post-order flow with New Order / My Orders buttons
- [x] Order history with date/time

---

## What's Next (Roadmap)

- [ ] Order history — add date/time formatting to `getOrdersByPhone` display
- [ ] Stripe payment link — send payment URL after order confirmation
- [ ] Order status updates — PREPARING → READY push notification to customer
- [ ] Admin webhook or dashboard — update order status from kitchen side
- [ ] Production deployment — Hetzner VPS + Nginx + Docker Compose + SSL
- [ ] CI/CD pipeline — GitHub Actions → auto deploy on push
- [ ] Error handling improvements — retry logic for failed WhatsApp sends