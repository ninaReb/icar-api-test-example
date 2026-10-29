import { test, expect } from '../../src/fixtures/api.fixture';
import { OrderBuilder } from '../../src/builders/order.builder';
import { OrderSchema, parseWith } from '../../src/contracts/order.schema';
import { expectStatus } from '../../src/support/assertions';

/**
 * Risk covered: the entry point of the most business-critical flow.
 * Creation must persist exactly what was sent, start in Draft, and be scoped to
 * the authenticated dealership.
 */
test.describe('Vehicle Ordering API: create and read', () => {
  test('creates a draft order and returns the same order on read', { tag: '@smoke' }, async ({ dealerA }) => {
    const payload = OrderBuilder.anOrder().build();

    const created = await test.step('POST /orders', async () => {
      const res = await dealerA.create(payload);
      await expectStatus(res, 201);

      const order = parseWith(OrderSchema, await res.json(), 'POST /orders response');
      dealerA.track(order.id);

      expect(res.headers()['location'], 'Location header points to the new resource').toMatch(
        new RegExp(`/orders/${order.id}$`),
      );
      expect(order).toMatchObject({
        vehicleId: payload.vehicleId,
        supplierId: payload.supplierId,
        requestedDeliveryDate: payload.requestedDeliveryDate,
        notes: payload.notes,
        status: 'Draft',
      });
      return order;
    });

    await test.step('GET /orders/{id} returns what was created', async () => {
      const res = await dealerA.get(created.id);
      await expectStatus(res, 200);
      const fetched = parseWith(OrderSchema, await res.json(), 'GET /orders/{id} response');
      expect(fetched).toEqual(created);
    });
  });
});
