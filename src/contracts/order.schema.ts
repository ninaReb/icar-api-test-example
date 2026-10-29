import { z } from 'zod';

/**
 * Response contracts for the Vehicle Ordering API.
 *
 * Schemas are deliberately NOT strict: extra fields are allowed so additive,
 * backwards-compatible API changes do not break the suite. Removing a field,
 * renaming it or changing its type does.
 *
 * ASSUMPTION: the real contract was not provided. Align these with the OpenAPI
 * spec of the .NET service (ideally generate them from it).
 */
export const OrderStatusSchema = z.enum(['Draft', 'Submitted', 'Confirmed', 'Invoiced', 'Cancelled']);

export const OrderSchema = z.object({
  id: z.string().uuid(),
  dealerId: z.string().min(1),
  vehicleId: z.string().min(1),
  supplierId: z.string().min(1),
  requestedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable(),
  status: OrderStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** ASP.NET Core error body (RFC 7807 ProblemDetails / ValidationProblemDetails). */
export const ProblemDetailsSchema = z
  .object({
    title: z.string(),
    status: z.number(),
    type: z.string().optional(),
    detail: z.string().optional(),
    traceId: z.string().optional(),
    errors: z.record(z.array(z.string())).optional(),
  })
  .passthrough();

export type Order = z.infer<typeof OrderSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type Problem = z.infer<typeof ProblemDetailsSchema>;

/** Payload accepted by POST /orders. The dealer comes from the auth token, not the body. */
export interface NewOrder {
  vehicleId: string;
  supplierId: string;
  requestedDeliveryDate: string; // yyyy-MM-dd
  notes?: string;
}

/** Parse with a readable failure message that lists every contract violation. */
export function parseWith<T>(schema: z.ZodType<T>, data: unknown, what: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`${what} violates the contract:\n${issues.join('\n')}`);
  }
  return result.data;
}
