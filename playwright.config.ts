import { defineConfig } from '@playwright/test';

/**
 * BASE_URL unset  -> tests run against the local mock server (mock-server/server.js),
 *                    which Playwright starts automatically.
 * BASE_URL set    -> tests run against the real iCar API (test environment).
 *
 * Trailing slash is forced on purpose: the client uses relative paths ('orders'),
 * so a base like https://host/api/v1 keeps its /api/v1 prefix. A leading '/' in a
 * request path would silently drop it.
 */
const MOCK_PORT = 4010;
// GitHub Actions sets a missing repo variable to an EMPTY STRING (not "unset"), and `??` does
// not fall back on ''. So treat empty/blank as "not provided".
const rawBaseUrl = process.env.BASE_URL?.trim();
const useMock = !rawBaseUrl;
const baseURL = (rawBaseUrl || `http://localhost:${MOCK_PORT}`).replace(/\/?$/, '/');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries on purpose: a retry hides flakiness. A failing API test is a signal, not noise.
  retries: 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'results/junit.xml' }],
  ],
  use: {
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json' },
    trace: 'retain-on-failure',
  },
  webServer: useMock
    ? {
        command: 'node mock-server/server.js',
        url: `http://localhost:${MOCK_PORT}/health`,
        reuseExistingServer: !process.env.CI,
        env: { MOCK_PORT: String(MOCK_PORT), MOCK_BUG: process.env.MOCK_BUG ?? '' },
      }
    : undefined,
});
