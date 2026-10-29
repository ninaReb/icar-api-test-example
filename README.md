# iCar Vehicle Ordering API tests

Playwright `APIRequestContext` tests for `POST/GET/PATCH/DELETE /orders` (take-home, Part 3).

## Run

```bash
npm install
npm test                 # all tests, against the built-in mock server
npm run test:smoke       # @smoke only (what a PR gate would run)
npm run test:regression  # @regression only
npm run report           # open the HTML report
```

No browser install needed: these are API tests.

### Against the real API

```bash
BASE_URL=https://<test-env>/api/v1 \
TOKEN_DEALER_A=... TOKEN_DEALER_B=... SUPPLIER_ID=... \
npm test
```

See `.env.example`. With `BASE_URL` unset, Playwright starts `mock-server/server.js` itself.

### Prove the tests catch real defects

The mock can inject bugs. Each one should fail exactly one test:

```bash
MOCK_BUG=cross-dealer-read  npm test   # dealer B can read dealer A's order
MOCK_BUG=illegal-transition npm test   # Submitted -> Draft accepted
MOCK_BUG=accept-past-date   npm test   # past delivery date accepted
```

## The five tests

| Test | Tag | Risk it covers |
| --- | --- | --- |
| Create a draft order and read it back | `@smoke` | Entry point of the critical flow: data persists as sent, starts in Draft, schema holds |
| Reject invalid payloads (table-driven, 4 cases) | `@regression` | Bad data entering the ordering, purchase and invoice chain |
| Anonymous and cross-dealer access | `@smoke @security` | Data isolation between dealerships; 401 without credentials |
| Update a draft and enforce status transitions | `@regression` | Order lifecycle rules, illegal transitions refused without side effects |
| Delete only drafts | `@regression` | Removing an order that already left the dealership |

## Structure and decisions

```
src/
  clients/orders.client.ts     thin client; raw responses for assertions, createOk() for setup, cleanup()
  builders/order.builder.ts    valid-by-default test data; tests state only what matters
  contracts/order.schema.ts    zod schemas for Order and ProblemDetails (non-strict: additive changes are OK)
  fixtures/api.fixture.ts      dealerA / dealerB / anonymous clients, own context each, auto cleanup
  support/assertions.ts        status and ProblemDetails assertions that print the body on failure
tests/orders/                  one spec per behaviour area
mock-server/server.js          in-memory mock built from the assumed rules, with fault injection
.github/workflows/api-tests.yml  PR smoke gate + post-merge/nightly regression
```

- **Independent tests.** Each test creates its own order through the API and cleans up after itself. No ordering, no shared state, safe to run in parallel.
- **Contract in one place.** Response shape is validated with zod on every call that matters. A removed or retyped field fails with a readable list of violations.
- **Errors are part of the API.** Failures are asserted as RFC 7807 `application/problem+json` (what ASP.NET Core returns), not just a status code.
- **Test steps.** `test.step` splits multi-stage scenarios, so a failure names the exact stage in the report.
- **No retries.** `retries: 0` on purpose; a retry hides flakiness.
- **Relative request paths.** The base URL always ends with `/` and paths have no leading slash, so a base like `/api/v1` keeps its prefix.

## Assumptions to confirm with the team

The real contract was not provided. These were assumed and are isolated so they are cheap to change:

1. Request body: `vehicleId`, `supplierId`, `requestedDeliveryDate` (yyyy-MM-dd), optional `notes`. The dealer comes from the auth token.
2. Auth: `Authorization: Bearer <token>`, one token per dealership.
3. Statuses: `Draft`, `Submitted`, `Confirmed`, `Invoiced`, `Cancelled`. Allowed moves: Draft to Submitted, Draft to Cancelled, Submitted to Cancelled. `Confirmed` and `Invoiced` are set by other flows, so they are not covered here.
4. `DELETE` is allowed on Draft only (204); otherwise 409.
5. Another dealer's order answers 404 (`FOREIGN_ORDER_STATUS` in `order-access.spec.ts`).
6. Validation errors are 400 `application/problem+json` with an `errors` map; key casing is ignored.
7. `PATCH` accepts `application/json`. If the API requires JSON Merge Patch, set `application/merge-patch+json` in `OrdersClient.update`.

## What I would add next

- Generate the zod schemas from the service's OpenAPI spec.
- Invoice endpoints and the supplier/OEM integration contracts (the other two escape sources).
- Concurrency (`If-Match` / ETag) and idempotency checks on `POST /orders`.
- Reaching `Confirmed` and `Invoiced` states through a test-support hook or seeded data, to cover the immutable states.
