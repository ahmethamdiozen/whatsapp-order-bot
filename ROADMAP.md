# WhatsApp Order Bot — Deployment Roadmap

**Target subdomain**: `wa-bot.ahmethamdiozen.site` (landing + simulator + admin)
**Deploy order in pipeline**: 3rd
**Status**: 86 tests green, admin panel done, Stripe/Claude/Redis wired. Needs prod deploy compose, WhatsApp simulator for public interactive demo, and production hardening.

---

## North Star

A visitor lands on `wa-bot.ahmethamdiozen.site`, reads the pitch, clicks **"Try the demo"**, and a **WhatsApp-like chat UI** opens in the browser. They type "hey", the bot replies with language choice, branch selection, interactive menu, cart, promo codes, Stripe **test-mode** checkout, order confirmation — **same backend pipeline as real WhatsApp**, just a different transport. Admin panel (`/admin`) is public read-only with seeded data so visitors see the operator side too. The simulator proves you can abstract messaging transports — a strong engineering signal beyond "I used WhatsApp API".

---

## Phase 0 — Deploy Blockers

### Production compose

- [ ] **Write `docker-compose.prod.yaml`** — today only `docker-compose.yml` for local. Prod compose: API container + admin panel build (served by API or as static) + Postgres + Redis + reverse proxy.
- [ ] **Multi-stage Dockerfile** for API — build TS, install prod deps only, non-root user.
- [ ] **Admin panel build target** — currently `admin-panel/` is dev-only. Either (a) static build served by API `/admin/*`, or (b) separate Coolify static service.
- [ ] **Run `prisma migrate deploy` on API startup** — not `migrate dev`.

### Security

- [ ] **Env validation on boot** — `src/index.ts` must verify all required env (WHATSAPP_TOKEN, ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ADMIN_TOKEN, DATABASE_URL, REDIS_HOST/PORT) before starting. No silent fallbacks.
- [ ] **Stripe webhook signature verification** — confirm `payment.router.ts` verifies `stripe-signature` header against `STRIPE_WEBHOOK_SECRET`. Reject unsigned.
- [ ] **WhatsApp webhook verification** — confirm `VERIFY_TOKEN` check on GET and payload hash verification on POST.
- [ ] **ADMIN_TOKEN rotation plan** — documented; or move admin auth to JWT like other projects (recommended — consistency with clinic/ecommerce).
- [ ] **Sentry DSN in prod** — already supported in code, ensure env set.

### WhatsApp demo strategy (chosen Option B)

- [ ] **Abstract `messenger.ts`** — today it talks directly to WhatsApp Graph API. Extract an interface:
  ```ts
  interface MessageTransport {
    sendText(to: string, text: string): Promise<void>;
    sendInteractiveList(...): Promise<void>;
    sendQuickActions(...): Promise<void>;
    sendPostOrderActions(...): Promise<void>;
  }
  ```
  Two implementations: `WhatsAppCloudTransport` (existing) and `HttpSseTransport` (new, for simulator).
- [ ] **Handler decoupling** — `webhook/handler.ts` currently receives Meta-shaped payloads. Normalize to an internal `IncomingMessage` type; Meta webhook and simulator HTTP both map to it.

### Demo data

- [ ] **Seed: 2 branches, 15 menu items each** across 3 categories (Burgers, Drinks, Desserts), 1 active promo code `DEMO20`, starter loyalty balance for demo phone number.
- [ ] **Pre-populated admin sample orders** for the read-only admin view.

---

## Phase 1 — Post-Deploy MVP Gaps

### The WhatsApp Web Simulator (the big feature)

- [ ] **Backend `/demo/*` routes** — new Express router:
  - `POST /demo/session` → creates a temp session ID, associates with a demo phone (e.g., `demo:<uuid>`)
  - `POST /demo/message` → accepts `{ sessionId, text }` or `{ sessionId, buttonId }`, feeds into same handler as Meta webhook, returns `{ messages: [...] }` (all bot replies for this turn)
  - `GET /demo/stream?sessionId=...` → Server-Sent Events for async bot updates (status changes from admin panel)
- [ ] **React chat UI** — new page in `admin-panel/src/pages/Demo.tsx` or a fresh package `demo-web/`. WhatsApp-style:
  - Header: demo bot avatar + "typing..." indicator
  - Bubbles: user right-aligned, bot left-aligned
  - Interactive list rendering (tap-to-select)
  - Quick action buttons
  - Typing delay simulation (300-800ms per bot message)
  - Session reset button
- [ ] **Stripe test-mode only in demo** — demo sessions always use `STRIPE_SECRET_KEY_TEST`; real WhatsApp flows use live key. Flag via `DEMO_MODE` in session metadata.
- [ ] **Demo session TTL** — 30 minutes; cleanup cron every hour.
- [ ] **Rate limit per IP** — 60 messages/hour per IP on `/demo/*`.

### Public admin read-only mode

- [ ] **`/admin` public tab** — no login, shows last 20 orders (anonymized phone), menu, stats charts. Read-only (no mutations).
- [ ] **Authenticated admin at `/admin/manage`** — full panel with create/update/delete.

### Landing page

- [ ] **`wa-bot.ahmethamdiozen.site/` landing** — single page: tagline, "Try in browser →" button (to `/demo`), "Real WhatsApp number" section with QR + link, "Peek at admin →" (to `/admin`), 60s video embed, tech-stack icons.

### Existing roadmap items from README.md

- [ ] **Admin panel WebSocket for real-time order updates** (already in README roadmap)
- [ ] **PDF sales reports (weekly/monthly)** (README)
- [ ] **Estimated preparation time** (README)
- [ ] **CI/CD pipeline — GitHub Actions** (README)

### Reliability

- [ ] **WhatsApp send retry** — messenger currently fire-and-forget. Wrap in retry with backoff; on permanent failure, log to Sentry and mark order `notification_failed`.
- [ ] **Redis session expiry handling** — on TTL expiry mid-conversation, gracefully send "session expired, say hi to restart" instead of error.
- [ ] **Claude API rate limit & retry** — anthropic SDK retry config; on 429, send fallback "sorry, try again" rather than crashing.

---

## Phase 2 — Polish / Portfolio Readiness

- [ ] **Screenshot pack**: landing page, simulator in mid-conversation, admin dashboard, Stripe checkout, order confirmation.
- [ ] **90s demo video** — screen record: landing → simulator → place order → Stripe checkout (test card) → confirmation → admin panel updates in real-time.
- [ ] **Portfolio card**:
  - Title: "WhatsApp AI Ordering Bot (with in-browser demo)"
  - Tech: WhatsApp Cloud API, Claude, Stripe, Redis, Postgres, 86 Jest tests
  - Links: simulator, admin, GitHub, video
  - TR + EN copy
- [ ] **Engineering blog post (optional)**: "How I abstracted WhatsApp transport to make my bot testable in a browser" — strong recruiter-bait.
- [ ] **README upgrade** — add simulator architecture section, architecture diagram showing transport abstraction.
- [ ] **Increase test coverage** — add simulator transport unit tests; should hit 95+ tests total.

### CI/CD

- [ ] **GitHub Actions**: lint + type-check + `npm test` (86 tests) on PR. Coolify webhook on main.
- [ ] **Smoke test job** — on deploy, hit `/health` + `/demo/session` + `/admin` (public endpoints) and fail if any non-200.

---

## Phase 3 — Stretch

- [ ] **Multi-tenant restaurants** — a second `/r/<slug>` entry point lets another restaurant plug in. Share infra, tenant-scoped menu/orders. Stripe Connect for payouts.
- [ ] **Meta Business Verification** — real public WhatsApp number anyone can message. Long process, only after the above is deploy-stable.
- [ ] **Analytics dashboard** — hourly order distribution, popular items, AOV, abandoned-cart rate.
- [ ] **Voice ordering** — patch-in Vapi from `clinic-appointment` for voice-initiated orders.
- [ ] **Real email notifications** — SendGrid/Resend for order receipts.
- [ ] **Admin mobile app (PWA)** — kitchen staff marks orders ready from a phone.

---

## Deploy Checklist (Coolify)

1. DNS: A record for `wa-bot.ahmethamdiozen.site`.
2. Coolify Postgres + Redis resources.
3. API service: new `Dockerfile.prod`, port 3000, env vars set (incl. `DEMO_MODE=true` flag if needed).
4. Domain: `wa-bot.ahmethamdiozen.site` → API container (API serves `/`, `/demo`, `/admin`, `/webhook`, `/payment/*`).
5. Stripe Dashboard: add webhook `https://wa-bot.ahmethamdiozen.site/payment/stripe-webhook`.
6. Meta App Dashboard: update webhook URL to `https://wa-bot.ahmethamdiozen.site/webhook` (once production-verified).
7. Run seed script.
8. Smoke test: open `/demo`, place order, Stripe test card `4242 4242 4242 4242`, confirm admin panel updates.

---

## Demo Setup

- Landing: `wa-bot.ahmethamdiozen.site/`
- Simulator: `wa-bot.ahmethamdiozen.site/demo`
- Public admin (read-only): `wa-bot.ahmethamdiozen.site/admin`
- Authenticated admin: `wa-bot.ahmethamdiozen.site/admin/manage` — `admin@demo` / `demo1234`
- Real WhatsApp: `[TBD]` (documented as "coming soon — currently test numbers only")
- Stripe test card: `4242 4242 4242 4242` (any expiry, any CVC)
