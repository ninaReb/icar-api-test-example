import { expect, type APIResponse } from '@playwright/test';
import { ProblemDetailsSchema, parseWith, type Problem } from '../contracts/order.schema';

/** Status assertion that puts the response body in the failure message. */
export async function expectStatus(res: APIResponse, expected: number): Promise<void> {
  const body = await res.text();
  expect(
    res.status(),
    `${res.url()} returned ${res.status()}, expected ${expected}\n${body}`,
  ).toBe(expected);
}

/** Expects an RFC 7807 error: status, media type and body shape. */
export async function expectProblem(res: APIResponse, status: number): Promise<Problem> {
  await expectStatus(res, status);
  expect(res.headers()['content-type'] ?? '').toContain('application/problem+json');
  const problem = parseWith(ProblemDetailsSchema, await res.json(), 'Error response');
  expect(problem.status).toBe(status);
  return problem;
}

/** Field names in a validation error, lower-cased (ASP.NET key casing is configurable). */
export function errorFields(problem: Problem): string[] {
  return Object.keys(problem.errors ?? {}).map((k) => k.toLowerCase());
}
