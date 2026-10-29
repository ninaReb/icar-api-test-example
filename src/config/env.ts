/**
 * Environment-driven settings. Defaults match the local mock server so the suite
 * runs out of the box; real environments override them via env vars / CI secrets.
 */
export const env = {
  tokens: {
    dealerA: process.env.TOKEN_DEALER_A ?? 'mock-token-dealer-a',
    dealerB: process.env.TOKEN_DEALER_B ?? 'mock-token-dealer-b',
  },
  // The supplier/OEM the builder uses by default.
  supplierId: process.env.SUPPLIER_ID ?? 'oem-001',
};
