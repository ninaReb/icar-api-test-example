import { test, expect } from '../../src/fixtures/api.fixture';
import { OrderBuilder } from '../../src/builders/order.builder';
import { OrderSchema, parseWith } from '../../src/contracts/order.schema';
import { expectProblem, expectStatus } from '../../src/support/assertions';

/**
 * Risk covered: data isolation between dealerships. Orders hold commercial data;
 * one dealer must never read, change or delete another dealer's order, and
 * unauthenticated calls must be refused.
 *
 * ASSUMPTION: another dealer's order answers 404 (existence is not leaked).
 * If the API returns 403 instead, change the expected status in one place below.
 */
const FOREIGN_ORDER_STATUS = 404;

test.describe('Vehicle Ordering API: access control', () => {
  test('protects an order from anonymous and cross-dealer access', { tag: ['@smoke', '@security'] }, async ({
    dealerA,
    dealerB,
    anonymous,
  }) => {
    const order = await dealerA.createOk(OrderBuilder.anOrder().build());

    await test.step('anonymous caller is refused (401)', async () => {
      await expectProblem(await anonymous.get(order.id), 401);
      await expectProblem(await anonymous.create(OrderBuilder.anOrder().build()), 401);
    });

    await test.step(`another dealer cannot read, change or delete it (${FOREIGN_ORDER_STATUS})`, async () => {
      await expectProblem(await dealerB.get(order.id), FOREIGN_ORDER_STATUS);
      await expectProblem(await dealerB.update(order.id, { notes: 'hijacked' }), FOREIGN_ORDER_STATUS);
      await expectProblem(await dealerB.remove(order.id), FOREIGN_ORDER_STATUS);
    });

    await test.step('the owner still sees the order, unchanged', async () => {
      const res = await dealerA.get(order.id);
      await expectStatus(res, 200);
      const current = parseWith(OrderSchema, await res.json(), 'GET /orders/{id} response');
      expect(current).toEqual(order);
    });
  });
});
