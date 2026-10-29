import type { APIRequestContext, APIResponse } from '@playwright/test';
import { OrderSchema, parseWith, type NewOrder, type Order } from '../contracts/order.schema';
import { expectStatus } from '../support/assertions';

/**
 * Thin client over the Orders endpoints. Methods return the raw APIResponse so a
 * test can assert on status, headers and body; `createOk` is the setup shortcut.
 *
 * Paths are relative ('orders', no leading slash) so a base URL prefix is kept.
 */
export class OrdersClient {
  private readonly createdIds: string[] = [];

  constructor(private readonly api: APIRequestContext) {}

  create(payload: unknown): Promise<APIResponse> {
    return this.api.post('orders', { data: payload });
  }

  get(id: string): Promise<APIResponse> {
    return this.api.get(`orders/${id}`);
  }

  update(id: string, patch: unknown): Promise<APIResponse> {
    return this.api.patch(`orders/${id}`, { data: patch });
  }

  remove(id: string): Promise<APIResponse> {
    return this.api.delete(`orders/${id}`);
  }

  /** Test setup: create a valid order, assert the contract, remember it for cleanup. */
  async createOk(payload: NewOrder): Promise<Order> {
    const res = await this.create(payload);
    await expectStatus(res, 201);
    const order = parseWith(OrderSchema, await res.json(), 'POST /orders response');
    this.createdIds.push(order.id);
    return order;
  }

  /** Track an order created outside createOk (e.g. in a raw create assertion). */
  track(id: string): void {
    this.createdIds.push(id);
  }

  /**
   * Best-effort teardown so shared environments stay clean: delete drafts, cancel
   * anything the API refuses to delete. Never fails a test.
   */
  async cleanup(): Promise<void> {
    for (const id of this.createdIds.reverse()) {
      try {
        const res = await this.remove(id);
        if (res.status() === 409) await this.update(id, { status: 'Cancelled' });
      } catch {
        /* cleanup is best-effort */
      }
    }
  }
}
