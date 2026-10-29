import { test, expect } from '../../src/fixtures/api.fixture';
import { OrderBuilder, daysFromNow } from '../../src/builders/order.builder';
import { errorFields, expectProblem } from '../../src/support/assertions';

/**
 * Risk covered: bad data entering the ordering chain. A rejected order must fail
 * with a clear 400 that names the offending field. Otherwise bad data reaches
 * purchase and invoicing, where it is far more expensive to find.
 *
 * One test design, driven by a table: adding a rule is one row, not a new test.
 */
const invalidPayloads: { name: string; payload: () => Record<string, unknown>; field: string }[] = [
  {
    name: 'missing vehicleId',
    payload: () => OrderBuilder.anOrder().buildWithout('vehicleId'),
    field: 'vehicleid',
  },
  {
    name: 'missing supplierId',
    payload: () => OrderBuilder.anOrder().buildWithout('supplierId'),
    field: 'supplierid',
  },
  {
    name: 'delivery date in the past',
    payload: () => ({ ...OrderBuilder.anOrder().build(), requestedDeliveryDate: daysFromNow(-1) }),
    field: 'requesteddeliverydate',
  },
  {
    name: 'malformed delivery date',
    payload: () => ({ ...OrderBuilder.anOrder().build(), requestedDeliveryDate: '31/12/2030' }),
    field: 'requesteddeliverydate',
  },
];

test.describe('Vehicle Ordering API: validation', () => {
  for (const { name, payload, field } of invalidPayloads) {
    test(`rejects an order with ${name}`, { tag: '@regression' }, async ({ dealerA }) => {
      const res = await dealerA.create(payload());

      const problem = await expectProblem(res, 400);
      expect(errorFields(problem), 'error names the offending field').toContain(field);
    });
  }
});
