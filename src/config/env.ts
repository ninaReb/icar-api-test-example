/**
 * Environment-driven settings. Defaults match the local mock server so the suite
 * runs out of the box; real environments override them via env vars / CI secrets.
 *
 * `||` (not `??`) on purpose: GitHub Actions passes an undefined variable or secret as an
 * empty string, and an empty string must fall back to the default just like "unset".
 */
const pick = (value: string | undefined, fallback: string): string => value?.trim() || fallback;

export const env = {
  tokens: {
    dealerA: pick(process.env.TOKEN_DEALER_A, 'mock-token-dealer-a'),
    dealerB: pick(process.env.TOKEN_DEALER_B, 'mock-token-dealer-b'),
  },
  // The supplier/OEM the builder uses by default.
  supplierId: pick(process.env.SUPPLIER_ID, 'oem-001'),
};
