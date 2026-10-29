import { test as base, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test';
import { OrdersClient } from '../clients/orders.client';
import { env } from '../config/env';

type Clients = {
  /** Authenticated as dealer A. Owns the orders most tests create. */
  dealerA: OrdersClient;
  /** Authenticated as dealer B. Used to prove data isolation between dealerships. */
  dealerB: OrdersClient;
  /** No credentials. */
  anonymous: OrdersClient;
};

async function newClient(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string | undefined,
  token?: string,
): Promise<{ client: OrdersClient; context: APIRequestContext }> {
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return { client: new OrdersClient(context), context };
}

/**
 * Each fixture creates its own isolated request context and, after the test,
 * cleans up the orders it created. Tests never share state.
 */
export const test = base.extend<Clients>({
  dealerA: async ({ playwright, baseURL }, use) => {
    const { client, context } = await newClient(playwright, baseURL, env.tokens.dealerA);
    await use(client);
    await client.cleanup();
    await context.dispose();
  },
  dealerB: async ({ playwright, baseURL }, use) => {
    const { client, context } = await newClient(playwright, baseURL, env.tokens.dealerB);
    await use(client);
    await client.cleanup();
    await context.dispose();
  },
  anonymous: async ({ playwright, baseURL }, use) => {
    const { client, context } = await newClient(playwright, baseURL);
    await use(client);
    await context.dispose();
  },
});

export { expect } from '@playwright/test';
