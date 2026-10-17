# Contributing to Fernleaf

How we build and ship changes. It's short on purpose.

## Sprints

We run two-week sprints: planning on day one, a quick stand-up each morning, then a demo and retro at the end. Each ticket names the module it touches (catalogue, cart, checkout, orders or admin) and has acceptance criteria written as things a shopper or admin can do, e.g. "a customer can't cancel an order that has shipped". Those criteria become test cases.

## Branches

- `main` is always deployable. CI deploys every green push to it, so nothing is committed there directly.
- Branch off `main` for each ticket:
  - `feature/cart-quantity-limit`
  - `fix/checkout-postcode-trim`
  - `chore/upgrade-mongoose`
- Keep branches short-lived (a few days at most). Rebase on `main` if it has moved on.

## Commits

Use small commits with messages in the present tense that say *why*, not just *what*:

```
cart: block quantities above stock when updating a line

Previously only "add" checked stock, so a shopper could
raise the quantity in the basket and fail at checkout instead.
```

## Pull requests

1. Push your branch and open a PR into `main`. The template asks which module it touches and how you tested it.
2. CI must pass: all server tests, all client tests, and the production build.
3. **At least one approving review from a teammate who didn't write the code.** We rotate reviewers so everyone ends up knowing every module, not just their own.
4. Squash-merge once it's approved. The deploy runs automatically.

### What reviewers check

- Does it do what the ticket asked? Run it locally if it's a UI change (`npm run demo` + `npm run dev:client`).
- Is there a test that would fail without this change? Bug fixes should come with the test that reproduces the bug.
- Is business logic in `server/src/services/` rather than spread across controllers or React components?
- Are errors friendly and specific? Does the UI handle the failure case, not just the happy path?
- Money in pence, no trusting prices from the browser, and permissions checked on the server.

Leave comments as questions or suggestions ("what happens if the basket is empty here?"), and approve once you're happy. Small nitpicks shouldn't block a merge.

## Running things locally

```bash
npm run install:all
npm run demo          # API on :5000 with a seeded in-memory DB
npm run dev:client    # shop on :5173
npm test              # the whole suite, the same as CI
```
