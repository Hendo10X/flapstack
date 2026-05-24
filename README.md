# FlapStack

Platform for creating, storing, organizing, searching, and sharing code snippets, notes, logs, configs, commands, markdown, and AI prompts.

## Stack

- **Backend**: Go 1.25, chi router, GORM, PostgreSQL (Neon-friendly)
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **AI**: Vercel AI SDK + Groq (free tier)
- **Billing**: Polar (scaffolded)

## Layout

```
cmd/server/                    # main entrypoint
internal/
  config/                      # env loader
  handlers/                    # HTTP handlers (snippets, AI usage, Polar webhook)
  models/                      # GORM models
  store/                       # DB open + automigrate
  auth/                        # JWT middleware (stub)
web/                           # Next.js app
  app/
    api/ai/explain/route.ts    # Groq streaming endpoint
    checkout/success/page.tsx  # Polar checkout callback
    new/                       # Create snippet page
    share-env/                 # Specialized .env-sharing flow
    s/[id]/                    # View snippet page
  components/
    ai-explain.tsx             # Explain-with-AI button + stream
    paywall.tsx                # Upgrade dialog
    snippet-actions.tsx        # Copy / curl / VS Code / QR actions
    ui/                        # shadcn components
```

## Run

Backend:
```sh
cp .env.example .env
make tidy
make run
```

Frontend:
```sh
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

Backend on `:8080`, frontend on `:3000`.

## Features

- Snippets with title, language, visibility (public/unlisted/private)
- **Expiration** — 1h / 1d / 1w / 30d / never; server auto-deletes after
- **Burn after read** — one-time-view snippets, deleted on first fetch
- **Password protect** — bcrypt-hashed passphrase, server gates the content
- **Markdown live preview** when language = Markdown
- **Quick actions** on view page — copy, raw URL, curl, Open in VS Code, QR code
- **/share-env** — purpose-built flow for sharing `.env` files (burn-after-read + password by default)
- **AI explain** — Groq-powered streaming code explanations. 5 free uses per IP per month, then Polar paywall.

## API

| Method | Path                                       | Notes                                            |
| ------ | ------------------------------------------ | ------------------------------------------------ |
| GET    | `/healthz`                                 |                                                  |
| GET    | `/api/v1/snippets`                         | Lists public, unlocked, non-burn, non-expired   |
| POST   | `/api/v1/snippets`                         | `{title, content, language, visibility, ttl, burnAfterRead, password}` |
| GET    | `/api/v1/snippets/{id}`                    | Hides content if password-locked                 |
| POST   | `/api/v1/snippets/{id}/verify`             | `{password}` → returns content if correct        |
| PUT    | `/api/v1/snippets/{id}`                    |                                                  |
| DELETE | `/api/v1/snippets/{id}`                    |                                                  |
| POST   | `/api/v1/ai/usage/claim`                   | Increments per-IP counter, 402 if over limit     |
| GET    | `/api/v1/billing/me`                       | `{pro, remaining, limit}`                        |
| POST   | `/api/v1/billing/polar/webhook`            | HMAC-verified, creates `ProToken` on subscribe   |

The Next.js side adds:

| Method | Path                       | Notes                                       |
| ------ | -------------------------- | ------------------------------------------- |
| POST   | `/api/ai/explain`          | Streams Groq output as plain text           |
| GET    | `/checkout/success?token=` | Stores Pro token in localStorage            |

## Wiring up Polar

The Polar integration is scaffolded but inert until you configure it:

1. Create a Polar sandbox account and a "FlapStack Pro" product.
2. Generate an access token and a webhook secret.
3. Fill in the backend `.env`:
   ```
   POLAR_WEBHOOK_SECRET=...
   POLAR_ACCESS_TOKEN=...
   POLAR_PRODUCT_ID=...
   ```
4. Add the webhook endpoint in Polar's dashboard:
   `https://<your-backend>/api/v1/billing/polar/webhook`
5. In Polar's checkout, set the success URL to:
   `https://<your-frontend>/checkout/success?token={the_token_returned_by_the_webhook}`
6. Fill in `web/.env.local`:
   ```
   NEXT_PUBLIC_POLAR_CHECKOUT_URL=https://<polar-checkout-link>
   ```

The webhook handler in `internal/handlers/ai_billing.go` validates the HMAC and creates a `ProToken` row. The browser stores it in localStorage and sends it as `X-FlapStack-Pro` on every AI call.

## Wiring up Groq

Free tier: https://console.groq.com → API keys → create one → paste into `web/.env.local`:
```
GROQ_API_KEY=gsk_...
```
The default model is `llama-3.3-70b-versatile` (set in `web/app/api/ai/explain/route.ts`).
