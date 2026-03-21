# WhatsApp AI Ordering Bot

An AI-powered restaurant ordering system built on WhatsApp Cloud API. Customers can place orders through WhatsApp in natural language — the system understands their intent, matches items against a real menu, and confirms orders to a database.

Built as a portfolio project to demonstrate real-world integration of messaging APIs, AI, and distributed backend systems.

---

## Features

- **Natural language ordering** — customers type freely, Claude parses intent and extracts items
- **Multi-location support** — customers select a branch before ordering; menu and inventory are scoped per location
- **Session management** — conversation state is tracked in Redis across message turns
- **Order persistence** — confirmed orders are saved to PostgreSQL with full item breakdown
- **Confirmation flow** — customers review their order summary before committing
- **Menu validation** — items are matched against the real menu; unavailable items are flagged

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Web framework | Express |
| Messaging | WhatsApp Cloud API (Meta) |
| AI | Anthropic Claude API |
| Database | PostgreSQL + Prisma 7 |
| Session store | Redis |
| Infrastructure | Docker Compose |

---

## Architecture

```
Customer (WhatsApp)
       │
       ▼
Meta Webhook (POST /webhook)
       │
       ▼
Session Check (Redis)
       │
       ├── selecting_location → show branch list
       ├── awaiting_confirmation (no items) → parse order via Claude API
       ├── awaiting_confirmation (items present) → handle YES/NO
       └── new conversation → start location selection
              │
              ▼
       Claude API (intent + item extraction)
              │
              ▼
       Menu validation (PostgreSQL)
              │
              ▼
       Order saved to DB + confirmation sent via WhatsApp
```

---

## Conversation Flow

```
User:  Hey
Bot:   Welcome! Please select a branch:
       1. Downtown Branch — 123 Main St
       2. Airport Branch — 456 Airport Rd
       3. Mall Branch — 789 Mall Ave

User:  2
Bot:   📍 Selected: Airport Branch
       What would you like to order?

User:  1 burger and 2 cokes
Bot:   ✅ Your order summary:
       1x Burger — $12.99
       2x Coke — $5.98
       Total: $18.97
       Type YES to confirm or NO to cancel.

User:  YES
Bot:   🎉 Order #4 confirmed! Your order is being prepared.
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker + Docker Compose
- Meta Developer account with WhatsApp Cloud API access
- Anthropic API key

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

Edit `.env`:

```env
PORT=3000
WHATSAPP_TOKEN=your_meta_access_token
PHONE_NUMBER_ID=your_phone_number_id
WABA_ID=your_whatsapp_business_account_id
VERIFY_TOKEN=your_webhook_verify_token
ANTHROPIC_API_KEY=your_anthropic_api_key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wporderbot
REDIS_HOST=localhost
REDIS_PORT=6379
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

---

## Project Structure

```
src/
├── index.ts              # Entry point
├── webhook/
│   └── handler.ts        # Incoming message router
├── bot/
│   ├── ai.ts             # Claude API integration
│   ├── messenger.ts      # WhatsApp message sender
│   └── types.ts          # Shared types
├── menu/
│   └── menu.service.ts   # Menu queries
├── order/
│   └── order.service.ts  # Order creation
└── lib/
    ├── prisma.ts          # Prisma client
    ├── redis.ts           # Redis client
    └── session.ts         # Session management
prisma/
├── schema.prisma          # Data models
├── seed.ts                # Seed data
└── config.ts              # Prisma config
```

---

## Data Models

- **Location** — restaurant branches with menu items
- **MenuItem** — items scoped per location with price and availability
- **Order** — customer orders with status tracking (PENDING → CONFIRMED → PREPARING → READY → DELIVERED)
- **OrderItem** — line items linking orders to menu items

---

## Roadmap

- [ ] Stripe payment link integration
- [ ] Kitchen dashboard (real-time order status updates)
- [ ] Admin panel for menu management
- [ ] Multi-language support
- [ ] CI/CD pipeline + production deployment

---

## Author

**Ahmet Hamdi Özen**
GitHub: [@ahmethamdiozen](https://github.com/ahmethamdiozen)