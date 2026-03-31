# WhatsApp AI Ordering Bot

An AI-powered restaurant ordering system built on WhatsApp Cloud API. Customers place orders through WhatsApp in natural language — the bot understands intent, manages a cart via session, handles payments via Stripe, and saves confirmed orders to a database.

Built as a portfolio project to demonstrate real-world integration of messaging APIs, AI, payments, and distributed backend systems.

---

## Features

- **Natural language ordering** — customers type freely, Claude parses intent and extracts items
- **Multi-language support** — English and Turkish; language selected on first message
- **Multi-location support** — customers select a branch before ordering; menu is scoped per location
- **Interactive menu** — WhatsApp list UI with category grouping and cart summary
- **Cart management** — add, remove, clear items; quantity tracking; special notes per item
- **Session management** — conversation state tracked in Redis with 1-hour TTL
- **Order persistence** — confirmed orders saved to PostgreSQL with full item breakdown
- **Stripe payments** — payment link sent after order confirmation; webhook updates payment status
- **Order status notifications** — WhatsApp push notification when kitchen updates order status
- **Promo codes** — percentage discount codes with expiry, usage limits, and admin management
- **Loyalty points** — 1 point per $1 spent; 100 points = $5 discount; redeemable in-chat
- **Rate limiting** — 30 messages per phone number per minute
- **Error logging** — Winston structured logging + Sentry error tracking
- **Admin API** — token-protected REST API for managing orders, menu items, promo codes, and loyalty
- **Admin panel** — React dashboard with order management, menu editor, stats, and charts
- **Order history** — customers can view their last 5 orders with timestamps
- **Quick reorder** — reload a previous order into the cart with one tap

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
| Logging | Winston + Sentry |
| Rate limiting | express-rate-limit |
| Infrastructure | Docker Compose |
| Testing | Jest + ts-jest + Supertest (86 tests) |
| Admin panel | React + Vite + Tailwind CSS + TanStack Query + Recharts |

---

## Architecture

```
Customer (WhatsApp)
       │
       ▼
Meta Webhook  POST /webhook
       │
       ▼
Rate Limiter (30 req/min per phone)
       │
       ▼
Session Check (Redis)
       │
       ├── selecting_language    → EN / TR choice
       ├── selecting_location    → show branch list
       ├── browsing_menu         → interactive menu, cart management
       ├── awaiting_confirmation → YES/NO, promo codes, loyalty redemption
       └── post_order            → New Order / Reorder / My Orders

       On order confirmation:
              │
              ├── Order saved to PostgreSQL
              ├── Loyalty points earned
              ├── Stripe Checkout Session created
              └── Payment link sent via WhatsApp

Kitchen (Admin API / Admin Panel)
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
Bot:   Welcome! Please select your language:
       1️⃣ English  2️⃣ Türkçe

User:  1
Bot:   Please select a branch:
       1. Downtown — 123 Main St
       2. Airport — 456 Airport Rd

User:  1
Bot:   Downtown selected. Here is our menu:
       [Interactive menu with categories]
       [Checkout | Clear Cart | Menu buttons]

User:  [taps Burger]
Bot:   1x Burger added! Cart total: $9.99
       [Updated menu with cart summary]

User:  NOTE Burger: no onions
Bot:   Note added to Burger: "no onions"

User:  POINTS
Bot:   ⭐ You have 42 points.
       Type REDEEM to use them (100 pts = $5 off).

User:  PROMO SUMMER20
Bot:   ✅ Promo code applied! Discount: -$2.00. New total: $7.99

User:  [taps Checkout]
Bot:   Order Summary:
       • 1x Burger — $9.99
         📝 no onions
       Promo discount: -$2.00
       Total: $7.99
       Type YES to confirm or BACK to return.

User:  YES
Bot:   🎉 Order #42 confirmed!
       ⭐ You earned 7 points! Your new balance: 49 points.
       💳 Pay for your order: https://checkout.stripe.com/...
       [New Order | Reorder | My Orders buttons]
```

---

## Bot Commands

| Command | Language | Description |
|---|---|---|
| `1` / `2` | — | Select English / Turkish |
| `REMOVE [item]` / `KALDIR [item]` | EN / TR | Remove item from cart |
| `NOTE [item]: [text]` / `NOT [item]: [metin]` | EN / TR | Add special instructions |
| `CART` / `SEPET` | EN / TR | Show cart contents |
| `MENU` / `MENÜ` | EN / TR | Show menu |
| `CLEAR` / `TEMİZLE` | EN / TR | Empty the cart |
| `CHECKOUT` / `SİPARİŞ` | EN / TR | Proceed to order summary |
| `YES` / `EVET` | EN / TR | Confirm order |
| `BACK` / `GERİ` | EN / TR | Return to menu |
| `PROMO [code]` | — | Apply a promo code |
| `POINTS` / `PUAN` | EN / TR | Check loyalty points balance |
| `REDEEM` / `KULLAN` | EN / TR | Redeem points for a discount |

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
| GET | `/admin/menu-items` | List all menu items |
| POST | `/admin/menu-items` | Create menu item |
| PATCH | `/admin/menu-items/:id` | Update menu item |
| DELETE | `/admin/menu-items/:id` | Delete menu item |
| GET | `/admin/locations` | List all locations |
| GET | `/admin/promo-codes` | List promo codes |
| POST | `/admin/promo-codes` | Create promo code |
| PATCH | `/admin/promo-codes/:code/toggle` | Enable / disable promo code |
| DELETE | `/admin/promo-codes/:code` | Delete promo code |
| GET | `/admin/loyalty` | Loyalty leaderboard |
| GET | `/admin/stats` | Revenue and order stats |

**Valid order statuses:** `PENDING` → `CONFIRMED` → `PREPARING` → `READY` → `DELIVERED` / `CANCELLED`

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
STRIPE_SECRET_KEY=        # dashboard.stripe.com/apikeys
STRIPE_WEBHOOK_SECRET=    # dashboard.stripe.com/webhooks
APP_URL=                  # Your public URL (e.g. ngrok HTTPS URL)
ADMIN_TOKEN=              # Any strong secret string
ADMIN_PANEL_URL=http://localhost:5173
SENTRY_DSN=               # Optional — sentry.io project DSN
LOG_LEVEL=info            # Optional — debug / info / warn / error
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

**6. Start the admin panel** (optional)

```bash
cd admin-panel
npm install
npm run dev
# Open http://localhost:5173
```

**7. Expose webhook with ngrok**

```bash
ngrok http 3000
```

Register the ngrok URL in your Meta App Dashboard:
- Callback URL: `https://your-ngrok-url/webhook`
- Verify Token: value from your `.env`

**8. Configure Stripe webhook**

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
│   └── admin.router.ts     # Admin REST API
├── promo/
│   └── promo.service.ts    # Promo code validation and management
├── loyalty/
│   └── loyalty.service.ts  # Loyalty points earn and redeem
└── lib/
    ├── prisma.ts            # Prisma client
    ├── redis.ts             # Redis client
    ├── session.ts           # Session management
    ├── i18n.ts              # EN/TR message strings
    ├── logger.ts            # Winston logger
    └── sentry.ts            # Sentry error capture
prisma/
├── schema.prisma            # Data models
├── seed.ts                  # Seed data
└── config.ts                # Prisma 7 config
admin-panel/
└── src/
    ├── pages/
    │   ├── Dashboard.tsx    # Stats and revenue charts
    │   ├── Orders.tsx       # Order list and status management
    │   └── Menu.tsx         # Menu item editor
    └── api/
        └── client.ts        # Admin API client
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
- **Order** — customer orders with `OrderStatus`, `PaymentStatus`, discount, and loyalty tracking
- **OrderItem** — line items linking orders to menu items, with optional special notes
- **PromoCode** — discount codes with percentage, expiry, and usage limits
- **LoyaltyAccount** — points balance and total earned per customer phone number

**OrderStatus:** `PENDING` → `CONFIRMED` → `PREPARING` → `READY` → `DELIVERED` / `CANCELLED`

**PaymentStatus:** `UNPAID` → `PAID` / `FAILED`

---

## Testing

```bash
npm test                 # run all tests
npm run test:watch       # watch mode
npm run test:coverage    # with coverage report
```

86 tests across 8 test suites covering all services and HTTP endpoints.

| Suite | Type | Tests |
|---|---|---|
| session.test.ts | Unit | 3 |
| menu.service.test.ts | Unit | 7 |
| order.service.test.ts | Unit | 9 |
| payment.service.test.ts | Unit | 2 |
| ai.test.ts | Unit | 6 |
| webhook.test.ts | Integration | 37 |
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
- [x] Special instructions (notes) per cart item
- [x] Session management via Redis
- [x] Order confirmation flow
- [x] Order persistence to PostgreSQL
- [x] Post-order flow with New Order / Reorder / My Orders
- [x] Order history with timestamps
- [x] Quick reorder from last order
- [x] Stripe payment link after order confirmation
- [x] Stripe webhook — payment status tracking
- [x] Admin API — order and menu management
- [x] Admin panel — React dashboard with stats and charts
- [x] WhatsApp push notifications on status change
- [x] Promo code / coupon system
- [x] Loyalty points system
- [x] Multi-language support (EN / TR)
- [x] Rate limiting (30 messages/min per phone)
- [x] Error logging — Winston + Sentry
- [x] Comprehensive test suite (86 tests)
- [ ] Admin panel WebSocket — real-time order updates
- [ ] PDF sales reports (weekly / monthly)
- [ ] Estimated preparation time
- [ ] Production deployment — Hetzner VPS + Nginx + Docker + SSL
- [ ] CI/CD pipeline — GitHub Actions

---

## Author

**Ahmet Hamdi Özen**
GitHub: [@ahmethamdiozen](https://github.com/ahmethamdiozen)
