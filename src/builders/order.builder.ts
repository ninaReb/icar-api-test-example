import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import type { NewOrder } from '../contracts/order.schema';

/** yyyy-MM-dd, UTC, `days` from today. Negative = past. */
export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Test data builder. `anOrder()` is always valid; each test states only what it
 * cares about, so intent stays visible and a contract change is fixed in one place.
 *
 * Every order is tagged in `notes` so leftovers in a shared environment can be
 * found and swept ("qa-auto/<run id>").
 */
export class OrderBuilder {
  private data: NewOrder = {
    vehicleId: `VEH-${randomUUID().slice(0, 8)}`,
    supplierId: env.supplierId,
    requestedDeliveryDate: daysFromNow(30),
    notes: `qa-auto/${process.env.GITHUB_RUN_ID ?? 'local'}`,
  };

  static anOrder(): OrderBuilder {
    return new OrderBuilder();
  }

  with(overrides: Partial<NewOrder>): this {
    this.data = { ...this.data, ...overrides };
    return this;
  }

  build(): NewOrder {
    return { ...this.data };
  }

  /** A deliberately invalid payload: valid order with the given fields removed. */
  buildWithout(...fields: (keyof NewOrder)[]): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...this.data };
    for (const f of fields) delete copy[f];
    return copy;
  }
}
