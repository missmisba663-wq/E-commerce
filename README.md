# 🌿 Fernleaf

Fernleaf is an online shop for houseplants, pots and plant-care supplies. It's a full-stack app (React, Node.js/Express, MongoDB) built in five modules: **catalogue, cart, checkout, order processing and admin**. Around 160 automated tests run on every push, and a GitHub Actions pipeline deploys automatically once they pass.

It's built to behave like a real small shop, not a tutorial. Prices are stored in pence, so there's no floating-point rounding. Stock is reserved atomically, so two people can't buy the last plant. A declined card puts everything back the way it was. Customers can cancel up until their order is packed.

---

## Try it in two minutes

You only need **Node.js 20+**. You don't need MongoDB installed: demo mode starts its own in-memory database, already seeded.

```bash
npm run install:all     # installs server + client dependencies
npm run demo            # terminal 1: API on http://localhost:5000
npm run dev:client      # terminal 2: shop on http://localhost:5173
```

| Log in as | Email                 | Password       |
| --------- | --------------------- | -------------- |
| Customer  | `sam@example.com`     | `Customer123!` |
| Admin     | `admin@fernleaf.test` | `Admin123!`    |

Payments run in sandbox mode. Use card `4242 4242 4242 4242` with any future expiry and any CVC. Card `4000 0000 0000 0002` is always declined, so you can see the failure path. Discount codes to try: `WELCOME10`, `FREESHIP`, and `GREEN5` (£5 off when you spend £30).

### Running against a real MongoDB

```bash
cp server/.env.example server/.env   # then set MONGO_URI and JWT_SECRET
npm run seed                         # wipes the database and loads the demo data
npm run dev:server                   # API with auto-reload
npm run dev:client
```

---

## From requirements to features

Each module started from a handful of plain-English requirements. This table shows where each one ended up, and which tests prove it works.

| Module | Requirement (what the customer asked for) | Where it lives | Proved by |
| --- | --- | --- | --- |
| **Catalogue** | Browse by category, search, sort by price, see what's in stock | `productController`, `CataloguePage`, `ProductPage` | `products.api.test.js`, `CataloguePage.test.jsx`, `ProductPage.test.jsx` |
| **Cart** | Add, change quantity, remove; never more than is in stock; always today's price | `cartController`, `CartContext`, `CartPage` | `cart.api.test.js`, `CartPage.test.jsx` |
| **Checkout** | Delivery address, discount codes, card payment, free delivery over £50 | `checkoutController`, `services/pricing`, `services/payment`, `services/inventory` | `pricing.test.js`, `payment.test.js`, `inventory.test.js`, `checkout.api.test.js`, `CheckoutPage.test.jsx` |
| **Orders** | Order history, order tracking, cancel before it's packed | `orderController`, `services/orderStatus`, `OrdersPage`, `OrderDetailPage` | `orderStatus.test.js`, `orders.api.test.js`, `Orders.test.jsx` |
| **Admin** | Add/edit/archive products, move orders through fulfilment, see sales and low stock | `adminController`, `pages/admin/*` | `admin.api.test.js`, `Admin.test.jsx` |

### Non-functional requirements

- **Security:** passwords hashed with bcrypt. JWT auth. Admin routes are role-checked on the server, and nobody can sign themselves up as an admin. Someone else's order returns 404, not 403, so we don't confirm it exists. Helmet headers are on, and regex characters in searches are escaped.
- **Data integrity:** money is stored as whole pence. Order lines freeze the name and price at the moment of purchase. Products are archived, never deleted, so old orders keep working.
- **Concurrency:** stock is taken with a conditional `$inc`, so it can never go negative. If any line in a basket fails, the lines already reserved are put back (see `services/inventory.js`).
- **Resilience:** every error comes back in the same `{ error: { message, details } }` shape, with field-level details the UI shows next to the right input.

---

## Architecture

```
fernleaf/
├── client/                  React 18 + Vite (the View)
│   └── src/
│       ├── api/             fetch wrapper + one function per endpoint
│       ├── context/         AuthContext, CartContext (shared state)
│       ├── components/      Header, ProductCard, TotalsTable, …
│       ├── pages/           one file per screen, admin/ for the back office
│       └── test/            test helpers (fake providers, fixtures)
├── server/                  Node.js + Express REST API
│   ├── src/
│   │   ├── models/          Mongoose schemas (the Model)
│   │   ├── controllers/     request handling (the Controller)
│   │   ├── services/        business rules: pricing, payments, stock, order states
│   │   ├── middleware/      auth, error handling
│   │   ├── routes/          URL → controller map
│   │   └── seed/ dev/       demo data and in-memory demo mode
│   └── tests/
│       ├── unit/            pure logic, no database
│       ├── integration/     services + models against a real (in-memory) MongoDB
│       └── api/             HTTP tests through the full Express stack
├── .github/workflows/ci.yml the CI/CD pipeline
└── render.yaml              deployment blueprint
```

The controllers stay thin. Rules like "free delivery over £50 after discounts" or "a shipped order can't be cancelled" live in `server/src/services/`. They're plain functions, so they're cheap to unit test and easy to change when requirements move.

In development, Vite proxies `/api` to Express. In production, Express serves the built React app too, so the whole shop deploys as one service.

### REST API

| Method | Endpoint | Auth | |
| --- | --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | – | returns `{ token, user }` |
| GET | `/api/auth/me` | user | |
| GET | `/api/products?search=&category=&sort=&minPrice=&maxPrice=&page=&limit=` | – | `sort`: `newest`, `price_asc`, `price_desc`, `name` |
| GET | `/api/products/categories` | – | counts per category |
| GET | `/api/products/:slugOrId` | – | |
| GET / DELETE | `/api/cart` | user | view / empty basket |
| POST | `/api/cart/items` | user | `{ productId, quantity }` |
| PATCH / DELETE | `/api/cart/items/:productId` | user | `{ quantity }` (0 removes) |
| POST | `/api/checkout/quote` | user | `{ discountCode? }` → totals |
| POST | `/api/checkout` | user | `{ shippingAddress, payment, discountCode? }` |
| GET | `/api/orders`, `/api/orders/:id` | user | your orders (admins can view any) |
| POST | `/api/orders/:id/cancel` | user | only while `paid` |
| GET | `/api/admin/stats` | admin | revenue, status counts, low stock |
| GET / POST | `/api/admin/products` | admin | |
| PUT / DELETE | `/api/admin/products/:id` | admin | DELETE archives |
| GET | `/api/admin/orders?status=` | admin | |
| PATCH | `/api/admin/orders/:id/status` | admin | `{ status, note? }` |

Order status flow: `paid → packed → shipped → delivered`, and `paid` or `packed` can also go to `cancelled` (stock is returned). The server rejects anything else with a 409.

---

## Tests

```bash
npm test                        # everything
cd server && npm run test:unit  # or test:integration / test:api / test:coverage
cd client && npm test           # React Testing Library UI tests
```

| Layer | Tool | What it covers |
| --- | --- | --- |
| Unit | Jest | Pricing and discount rules, VAT, shipping threshold, card validation (Luhn, expiry), order state machine, helpers |
| Integration | Jest + mongodb-memory-server | Stock reservation and rollback, a race for the last item, password hashing, slug generation, schema rules |
| API | Jest + Supertest | Every endpoint across all five modules, including auth, permissions, validation and failure paths (declined card, stock run out, illegal status change) |
| UI | Vitest + React Testing Library | Every page across all five modules: what the shopper sees, what gets sent to the API, error and empty states |

The API and integration tests use a real MongoDB engine that runs in memory. You don't install anything, the tests are isolated from each other, and the results match production behaviour (unique indexes and atomic updates included).

---

## CI/CD

`.github/workflows/ci.yml` runs on every push and every pull request into `main`:

1. **API job**: unit, integration and API tests, plus a coverage report you can download as an artifact.
2. **UI job**: UI tests, then a production build, so a broken build fails CI too.
3. **Deploy job**: runs only on `main`, only if both jobs above passed, and only once deployment has been switched on (`DEPLOY_ENABLED`). It triggers a Render deploy, then polls `/api/health` until the new version is live.

### Deployment setup (one time)

1. Create a free MongoDB Atlas cluster and copy its connection string.
2. On Render, choose **New → Blueprint** and point it at this repo. `render.yaml` sets up the service, and you paste in `MONGO_URI`. `autoDeploy` is off, so Render only deploys when CI tells it to.
3. In the Render service, go to **Settings → Deploy Hook** and copy the URL.
4. In GitHub, go to **Settings → Secrets and variables → Actions**:
   - Secret `RENDER_DEPLOY_HOOK_URL`: the hook URL
   - Variable `APP_URL`: e.g. `https://fernleaf.onrender.com` (used for the post-deploy health check)
   - Variable `DEPLOY_ENABLED`: `true`. Until this is set, the deploy job is **skipped** (not failed), so the pipeline stays green while there's nowhere to deploy to.
5. Add a `production` environment under **Settings → Environments** if you want manual approval before each deploy.

---

## How we work

The team works in short Scrum sprints with feature branches and pull requests. Every PR needs a passing CI run and a review from someone who didn't write it. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching model, commit style and review checklist.
