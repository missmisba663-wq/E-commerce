# ShopVerse by Misbah

**🔗 Live website: [https://shopverse-yph5.onrender.com](https://shopverse-yph5.onrender.com)**

> Hosted on Render's free plan: after about 15 minutes without visitors the site sleeps, and the first visit can take up to a minute to load. Accounts and orders reset when it restarts.

A full-stack e-commerce store with **138,882 real products** across 17 departments and 244 categories: fashion, electronics, computers, toys, video games, home & kitchen, beauty, baby, sports, pets, automotive, tools and more. Product titles, prices, discounts, ratings, best-seller flags and images come from a public Kaggle dataset of Amazon listings. Prices are shown in **Indian rupees (₹)**.

## Features

**Shopping**
- Full-text product search with autocomplete. Results are ranked by relevance and popularity, and category matches count, so "shoes" returns shoes rather than shoe racks.
- Browse by department or category, with category facets, price ranges, rating, on-sale, best-seller and in-stock filters, six sort orders, and pagination
- Product pages with highlights, stock status, delivery estimate, related products and "customers also bought"
- A cart that works for guests (stored in the browser) and merges into the account at sign-in
- Wishlist, saved addresses, profile and password management
- Checkout by card through **Stripe Checkout**, or **cash on delivery**. Stock is reserved atomically, so two shoppers can't buy the last unit.
- Order tracking with a status timeline. Customers can cancel before shipping (card payments are refunded automatically). Unpaid card orders release their stock after 60 minutes.
- Verified-purchase reviews: only customers whose order was delivered can review an item.

**Admin dashboard** (`/admin`)
- Revenue, order count, average order value, new customers, revenue-per-day chart, sales by department, top products
- Order fulfilment: confirm, ship (with tracking number), deliver, or cancel with a reason
- Product management: search, filter by stock or visibility, edit price, discount, stock and category, create new products
- Customer list with order counts, total spent, and role management

**Engineering**
- Security: JWT sessions in httpOnly cookies, bcrypt password hashing, zod validation on every input, rate limiting, Helmet security headers and Content-Security-Policy, and parameterised SQL throughout
- 22 API tests (Node test runner + supertest) and 8 UI tests (Vitest + Testing Library), run by GitHub Actions CI
- Responsive layout from phone to desktop

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, React Router, Vite, lucide icons, hand-written CSS |
| Backend | Node.js 24, Express 5, zod, Stripe SDK |
| Database | SQLite (Node's built-in `node:sqlite`) with an FTS5 full-text index; no native build tools needed |
| Tests / CI | node:test, supertest, Vitest, Testing Library, GitHub Actions |
| Deploy | Render blueprint (`render.yaml`) or Docker |

## Running locally

Requires **Node.js 22.13 or newer** (24 recommended).

```bash
npm install
npm run dev          # API on :4000, web app on http://localhost:5173
```

On first start the server creates `server/data/shopverse.db` and loads the full catalogue (about 20 seconds). It also creates the admin account **admin@shopverse.dev / Admin@12345**.

Optional extras:

```bash
npm run demo         # sample customers, ~120 orders over 60 days and some reviews, so the admin dashboard has data
npm test             # all server and client tests
npm run seed         # wipe the catalogue and orders, then reload products from the dataset
```

Demo customers sign in with e.g. `priya@demo.shopverse.dev` / `Demo12345`.

### Enabling card payments (Stripe test mode)

1. Create a free Stripe account and copy the **test** secret key from <https://dashboard.stripe.com/test/apikeys>.
2. Copy `.env.example` to `server/.env` and set `STRIPE_SECRET_KEY=sk_test_...`.
3. Restart the server. "Credit or debit card" becomes available at checkout. Pay with the test card `4242 4242 4242 4242`, any future expiry date and any CVC. Payments are charged in INR.

Webhooks are optional: when the shopper returns from Stripe, the order page asks Stripe for the payment status. For production, add a webhook endpoint at `https://<your-site>/api/payments/webhook` for `checkout.session.completed` and set `STRIPE_WEBHOOK_SECRET`.

## Deploying (make it live)

The server serves the built React app, so the whole store is **one web service**.

### Render (recommended)

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository. Render reads `render.yaml`.
3. Enter an `ADMIN_PASSWORD` (and optionally your Stripe keys) when prompted.

The blueprint uses Render's **free** plan. The product catalogue is loaded during the build, so the site starts quickly. Two things to know about the free plan:
- The site goes to sleep after about 15 minutes without visitors. The next visit wakes it, which takes up to a minute.
- Accounts, carts and orders are stored on temporary disk, so they reset whenever the service restarts, sleeps or is redeployed. The products and the admin account come back automatically.

To keep accounts and orders permanently, switch to a paid plan with a persistent disk: in `render.yaml` set `plan: starter`, add a `DB_PATH` variable with the value `/var/data/shopverse.db`, and add a disk:

```yaml
    disk:
      name: shopverse-data
      mountPath: /var/data
      sizeGB: 1
```

### Docker

```bash
docker build -t shopverse .
docker run -p 4000:4000 -v shopverse-data:/data \
  -e JWT_SECRET=$(openssl rand -hex 32) -e ADMIN_PASSWORD=choose-a-strong-one \
  -e PUBLIC_URL=http://localhost:4000 shopverse
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | production | Signs session cookies |
| `ADMIN_PASSWORD` / `ADMIN_EMAIL` | production / no | Admin account created on first start |
| `DB_PATH` | no | SQLite file location (point at a persistent disk) |
| `STRIPE_SECRET_KEY` | no | Enables card payments |
| `STRIPE_WEBHOOK_SECRET` | no | Verifies Stripe webhooks |
| `PUBLIC_URL` | no | Site URL for Stripe redirects (detected automatically on Render) |
| `USD_TO_INR` | no | Dollar-to-rupee rate used when loading the catalogue (default 85) |

## The dataset

Source: [Amazon Products Dataset 2023 (1.4M products)](https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products) by asaniczka on Kaggle.

`scripts/prepare_dataset.py` reads the 1.4M-row CSV and:
- groups Amazon's 248 categories into 17 departments (gift cards and a few non-product categories are excluded)
- keeps the most popular products per category: up to 1,200 in flagship categories such as clothing, shoes, headphones and toys, and 450 elsewhere. Products are ranked by monthly sales, then review count, and only priced, rated items with images are kept.
- writes `server/data/products.csv.gz` (8.7 MB, committed) and `server/data/catalog.json`

To rebuild it:

```bash
pip install kagglehub
python -c "import kagglehub; print(kagglehub.dataset_download('asaniczka/amazon-products-dataset-2023-1-4m-products'))"
python scripts/prepare_dataset.py <printed folder>
npm run seed
```

Notes:
- Images are loaded from Amazon's image CDN (`m.media-amazon.com`) using the URLs in the dataset.
- The dataset has no stock levels, so each product starts with a generated quantity (about 4% start sold out). From then on, orders and cancellations change stock for real.
- The dataset is priced in US dollars. When the catalogue is loaded, prices are converted to rupees at **₹85 = $1** (set `USD_TO_INR` to change it, then run `npm run seed`). They are rounded to retail price points ending in 9, so $12.99 becomes ₹1,099. Amounts are stored in paise.
- Prices are inclusive of GST, so no tax is added at checkout. Delivery is free over ₹499, otherwise ₹40.

## Project structure

```
scripts/prepare_dataset.py    Kaggle CSV → compact catalogue
server/
  data/                       catalogue files (+ the SQLite database at runtime)
  src/app.js                  Express app: security middleware, routes, SPA hosting
  src/db/                     schema, seeding, demo data
  src/lib/                    order lifecycle and Stripe, pricing, product formatting
  src/routes/                 auth, catalog, cart, account, orders, reviews, admin
  test/                       API tests
client/
  src/context/                auth, cart (guest + server), wishlist, toasts
  src/pages/                  storefront pages and pages/admin
  src/components/             layout, search box, product cards, shared UI
```

## API overview

| Method & path | Description |
| --- | --- |
| `GET /api/catalog/departments` | Department and category tree with counts |
| `GET /api/catalog/products?q=&department=&category=&minPrice=&maxPrice=&minRating=&sale=&bestseller=&inStock=&sort=&page=` | Search and browse |
| `GET /api/catalog/products/suggest?q=` | Autocomplete |
| `GET /api/catalog/products/:id` | Product details, related products |
| `GET/PUT/DELETE /api/catalog/products/:id/reviews` | Reviews |
| `POST /api/auth/register` · `login` · `logout`, `GET /api/auth/me` | Authentication |
| `GET /api/cart`, `POST /api/cart/items`, `PUT/DELETE /api/cart/items/:id`, `POST /api/cart/preview`, `POST /api/cart/merge` | Cart |
| `GET/PUT/DELETE /api/account/wishlist/:id`, `GET/POST/PUT/DELETE /api/account/addresses` | Wishlist and addresses |
| `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders/:id/cancel`, `POST /api/orders/:id/pay` | Orders |
| `GET /api/admin/stats`, `/api/admin/orders`, `/api/admin/products`, `/api/admin/users` | Admin |
