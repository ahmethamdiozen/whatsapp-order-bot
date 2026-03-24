# WhatsApp AI Ordering Bot

An AI-powered restaurant ordering system built on WhatsApp Cloud API. Customers place orders through WhatsApp in natural language — the bot understands intent, manages a cart via session, handles payments via Stripe, and saves confirmed orders to a database.

Built as a portfolio project to demonstrate real-world integration of messaging APIs, AI, payments, and distributed backend systems.

---

## Features

- **Natural language ordering** — customers type freely, Claude parses intent and extracts items
- **Multi-location support** — customers select a branch before ordering; menu is scoped per location
- **Interactive menu** — WhatsApp list UI with category grouping and cart summary
- **Cart management** — add, remove, clear items; quantity tracking
- **Session management** — conversation state tracked in Redis with 1-hour TTL
- **Order persistence** — confirmed orders saved to PostgreSQL with full item breakdown
- **Stripe payments** — payment link sent after order confirmation; webhook updates payment status
- **Order status notifications** — WhatsApp push notification when kitchen updates order status
- **Admin API** — token-protected REST API for kitchen staff to manage orders
- **Order history** — customers can view their last 5 orders with timestamps

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Web framework | Express |
| Messaging | WhatsApp Cloud API (Meta Graph API v19.0) |
| AI | Anthropic Claude API (`claude-sonnet-4-5`) |
| Database | PostgreSQL + Prisma 7 |
| Session store | Redis (ioredis) |
| Payments | Stripe Checkout |
| Infrastructure | Docker Compose |
| Testing | Jest + ts-jest + Supertest |

---

## Architecture

```
Customer (WhatsApp)
       │
       ▼
Meta Webhook  POST /webhook
       │
       ▼
Session Check (Redis)
       │
       ├── selecting_location  → show branch list
       ├── browsing_menu       → interactive menu, cart management
       ├── awaiting_confirmation → YES/NO confirmation
       └── post_order          → New Order / My Orders

       On order confirmation:
              │
              ├── Order saved to PostgreSQL
              ├── Stripe Checkout Session created
              └── Payment link sent via WhatsApp

Kitchen (Admin API)
       │
       ▼
PATCH /admin/orders/:id/status
       │
       └── WhatsApp push notification → Customer
```

---

## Conversation Flow

```
User:  Hey
Bot:   Welcome! Please select a branch:
       1. Downtown — 123 Main St
       2. Airport — 456 Airport Rd

User:  1
Bot:   Selected: Downtown
       [Interactive menu with categories]
       [Checkout | Clear Cart | Menu buttons]

User:  [taps Burger]
Bot:   Burger added! (1x in cart)
       [Updated menu with cart summary]

User:  [taps Checkout]
Bot:   Order Summary:
       1x Burger — $9.99
       Total: $9.99
       Type YES to confirm or BACK to return.

User:  YES
Bot:   Your order has been confirmed! Order #42
       Please complete your payment: https://checkout.stripe.com/...
       [New Order | My Orders buttons]
```

---

## API Endpoints

### Webhook
| Method | Path | Description |
|---|---|---|
| GET | `/webhook` | Meta webhook verification |
| POST | `/webhook` | Incoming WhatsApp messages |

### Payment
| Method | Path | Description |
|---|---|---|
| POST | `/payment/stripe-webhook` | Stripe payment events |
| GET | `/payment/success` | Payment success page |
| GET | `/payment/cancel` | Payment cancel page |

### Admin (requires `x-admin-token` header)
| Method | Path | Description |
|---|---|---|
| GET | `/admin/orders` | List last 50 orders |
| PATCH | `/admin/orders/:id/status` | Update order status |

**Valid statuses:** `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `DELIVERED`, `CANCELLED`

Updating to `PREPARING`, `READY`, `DELIVERED`, or `CANCELLED` automatically sends a WhatsApp notification to the customer.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker + Docker Compose
- Meta Developer account with WhatsApp Cloud API access
- Anthropic API key
- Stripe account

### Setup

**1. Clone the repo**

```bash
git clone https://github.com/ahmethamdiozen/whatsapp-order-bot
cd whatsapp-order-bot
npm install
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

Fill in `.env`:

```env
PORT=3000
WHATSAPP_TOKEN=           # Permanent System User token from Meta Business Suite
PHONE_NUMBER_ID=          # Meta App Dashboard > WhatsApp > API Setup
WABA_ID=                  # WhatsApp Business Account ID
VERIFY_TOKEN=             # Any string — used for webhook verification
ANTHROPIC_API_KEY=        # console.anthropic.com
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wporderbot
REDIS_HOST=localhost
REDIS_PORT=6379
STRIPE_SECRET_KEY=sk_test_  # dashboard.stripe.com/apikeys
STRIPE_WEBHOOK_SECRET=whsec_ # dashboard.stripe.com/webhooks
APP_URL=https://your-ngrok-url.ngrok.io
ADMIN_TOKEN=              # Any strong secret string
```

**3. Start infrastructure**

```bash
docker compose up -d
```

**4. Run database migrations and seed**

```bash
npx prisma migrate dev
npx prisma db seed
```

**5. Start the server**

```bash
npm run dev
```

**6. Expose webhook with ngrok**

```bash
ngrok http 3000
```

Register the ngrok URL in your Meta App Dashboard:
- Callback URL: `https://your-ngrok-url/webhook`
- Verify Token: value from your `.env`

**7. Configure Stripe webhook**

In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks):
- Endpoint URL: `https://your-ngrok-url/payment/stripe-webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`
- Copy the signing secret to `STRIPE_WEBHOOK_SECRET` in `.env`

---

## Project Structure

```
src/
├── app.ts                  # Express app (exported for testing)
├── index.ts                # Entry point — starts server
├── webhook/
│   └── handler.ts          # Incoming message router + state machine
├── bot/
│   ├── ai.ts               # Claude API integration
│   ├── messenger.ts        # WhatsApp message senders
│   └── types.ts            # Shared AI types
├── menu/
│   └── menu.service.ts     # Menu queries
├── order/
│   └── order.service.ts    # Order CRUD
├── payment/
│   ├── payment.service.ts  # Stripe Checkout Session creation
│   └── payment.router.ts   # Payment webhook + success/cancel pages
├── admin/
│   └── admin.router.ts     # Admin API (order management)
└── lib/
    ├── prisma.ts            # Prisma client
    ├── redis.ts             # Redis client
    └── session.ts           # Session management
prisma/
├── schema.prisma            # Data models
├── seed.ts                  # Seed data
└── config.ts                # Prisma 7 config
tests/
├── unit/
│   ├── session.test.ts
│   ├── menu.service.test.ts
│   ├── order.service.test.ts
│   ├── payment.service.test.ts
│   └── ai.test.ts
└── integration/
    ├── webhook.test.ts
    ├── admin.test.ts
    └── payment.router.test.ts
```

---

## Data Models

- **Location** — restaurant branches (name, address, phone, isActive)
- **MenuItem** — items scoped per location (name, description, price, category, isAvailable)
- **Order** — customer orders with `OrderStatus` and `PaymentStatus` tracking
- **OrderItem** — line items linking orders to menu items

**OrderStatus:** `PENDING` → `CONFIRMED` → `PREPARING` → `READY` → `DELIVERED` / `CANCELLED`

**PaymentStatus:** `UNPAID` → `PAID` / `FAILED`

---

## Testing

```bash
npm test                 # run all tests
npm run test:watch       # watch mode
npm run test:coverage    # with coverage report
```

79 tests across 8 test suites covering all services and HTTP endpoints.

| Suite | Type | Tests |
|---|---|---|
| session.test.ts | Unit | 3 |
| menu.service.test.ts | Unit | 7 |
| order.service.test.ts | Unit | 9 |
| payment.service.test.ts | Unit | 2 |
| ai.test.ts | Unit | 6 |
| webhook.test.ts | Integration | 34 |
| admin.test.ts | Integration | 10 |
| payment.router.test.ts | Integration | 8 |

---

## Roadmap

- [x] WhatsApp Cloud API setup and webhook verification
- [x] Incoming message handling (text + interactive)
- [x] Claude AI order parsing
- [x] Multi-location support
- [x] Interactive menu with category grouping
- [x] Cart management (add, remove, clear)
- [x] Session management via Redis
- [x] Order confirmation flow
- [x] Order persistence to PostgreSQL
- [x] Post-order flow with New Order / My Orders
- [x] Order history with timestamps
- [x] Stripe payment link after order confirmation
- [x] Stripe webhook — payment status tracking
- [x] Admin API — order status management
- [x] WhatsApp push notifications on status change
- [x] Comprehensive test suite (79 tests)
- [ ] Production deployment — Hetzner VPS + Nginx + Docker + SSL
- [ ] CI/CD pipeline — GitHub Actions
- [ ] Error handling improvements — retry logic for failed WhatsApp sends

---

## Author

**Ahmet Hamdi Özen**
GitHub: [@ahmethamdiozen](https://github.com/ahmethamdiozen)
