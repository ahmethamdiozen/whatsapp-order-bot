[🇹🇷 Türkçe](README.md)

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

User:  PROMO DEMO20
Bot:   ✅ Promo applied! Discount: -$2.00. New total: $7.99

User:  [taps Checkout] → YES
Bot:   🎉 Order #42 confirmed!
       💳 Pay here: https://checkout.stripe.com/...
```

---

## Bot Commands

| Command | Language | Description |
|---|---|---|
| `REMOVE [item]` / `KALDIR [item]` | EN / TR | Remove item from cart |
| `NOTE [item]: [text]` / `NOT [item]: [metin]` | EN / TR | Add special instructions |
| `CART` / `SEPET` | EN / TR | Show cart contents |
| `MENU` / `MENÜ` | EN / TR | Show menu |
| `CLEAR` / `TEMİZLE` | EN / TR | Empty the cart |
| `PROMO [code]` | — | Apply a promo code |
| `POINTS` / `PUAN` | EN / TR | Check loyalty points balance |
| `REDEEM` / `KULLAN` | EN / TR | Redeem points for a discount |

---

## Getting Started

```bash
git clone https://github.com/ahmethamdiozen/whatsapp-order-bot
cd whatsapp-order-bot
npm install
cp .env.example .env   # fill in your values
docker compose up -d   # start Postgres + Redis
npx prisma migrate dev
npx prisma db seed
npm run dev
```

See [README.EN.md](README.EN.md) for full environment variable reference and external service setup (Meta, Stripe, Sentry).

---

## Testing

```bash
npm test              # 86 tests across 8 suites
npm run test:coverage
```

---

## Author

**Ahmet Hamdi Özen** · [@ahmethamdiozen](https://github.com/ahmethamdiozen)
