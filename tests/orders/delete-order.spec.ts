import { randomUUID } from 'node:crypto';
import { test, expect } from '../../src/fixtures/api.fixture';
import { OrderBuilder } from '../../src/builders/order.builder';
import { OrderSchema, parseWith } from '../../src/contracts/order.schema';
import { expectProblem, expectStatus } from '../../src/support/assertions';

/**
 * Risk covered: removing an order that has already left the dealership. Only a
 * Draft may be deleted; a submitted order must be cancelled instead, so the
 * purchase trail stays intact.
 *
 * ASSUMED rule (confirm with the team): DELETE is allowed on Draft only.
 */
test.describe('Vehicle Ordering API: delete', () => {
  test('deletes only draft orders', { tag: '@regression' }, async ({ dealerA }) => {
    await test.step('a draft is deleted (204) and is gone (404)', async () => {
      const draft = await dealerA.createOk(OrderBuilder.anOrder().build());

      await expectStatus(await dealerA.remove(draft.id), 204);
      await expectProblem(await dealerA.get(draft.id), 404);
    });

    await test.step('a submitted order is refused (409) and stays intact', async () => {
      const order = await dealerA.createOk(OrderBuilder.anOrder().build());
      await expectStatus(await dealerA.update(order.id, { status: 'Submitted' }), 200);

      await expectProblem(await dealerA.remove(order.id), 409);

      const res = await dealerA.get(order.id);
      await expectStatus(res, 200);
      expect(parseWith(OrderSchema, await res.json(), 'GET response').status).toBe('Submitted');
    });

    await test.step('an unknown id answers 404', async () => {
      await expectProblem(await dealerA.remove(randomUUID()), 404);
    });
  });
});
