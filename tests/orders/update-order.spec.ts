import { test, expect } from '../../src/fixtures/api.fixture';
import { OrderBuilder, daysFromNow } from '../../src/builders/order.builder';
import { OrderSchema, parseWith } from '../../src/contracts/order.schema';
import { expectProblem, expectStatus } from '../../src/support/assertions';

/**
 * Risk covered: order lifecycle rules. Status transitions decide what reaches
 * purchasing and invoicing, so legal moves must work and illegal ones must be
 * refused without changing the order.
 *
 * ASSUMED rules (confirm with the team): Draft -> Submitted -> Cancelled, and
 * Draft -> Cancelled. Going back from Submitted to Draft is illegal.
 */
test.describe('Vehicle Ordering API: update', () => {
  test('updates a draft order and enforces status transitions', { tag: '@regression' }, async ({ dealerA }) => {
    const order = await dealerA.createOk(OrderBuilder.anOrder().build());
    const newDate = daysFromNow(45);

    await test.step('PATCH changes editable fields and keeps the rest', async () => {
      const res = await dealerA.update(order.id, { requestedDeliveryDate: newDate, notes: 'updated by test' });
      await expectStatus(res, 200);
      const updated = parseWith(OrderSchema, await res.json(), 'PATCH /orders/{id} response');

      expect(updated).toMatchObject({
        id: order.id,
        vehicleId: order.vehicleId,
        status: 'Draft',
        requestedDeliveryDate: newDate,
        notes: 'updated by test',
      });
      expect(updated.updatedAt >= order.updatedAt, 'updatedAt moves forward').toBe(true);

      const persisted = parseWith(OrderSchema, await (await dealerA.get(order.id)).json(), 'GET after PATCH');
      expect(persisted).toEqual(updated);
    });

    await test.step('Draft -> Submitted is allowed', async () => {
      const res = await dealerA.update(order.id, { status: 'Submitted' });
      await expectStatus(res, 200);
      expect(parseWith(OrderSchema, await res.json(), 'PATCH response').status).toBe('Submitted');
    });

    await test.step('Submitted -> Draft is refused (409) and changes nothing', async () => {
      await expectProblem(await dealerA.update(order.id, { status: 'Draft' }), 409);

      const res = await dealerA.get(order.id);
      await expectStatus(res, 200);
      expect(parseWith(OrderSchema, await res.json(), 'GET response').status).toBe('Submitted');
    });
  });
});
