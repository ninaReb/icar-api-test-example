/**
 * Minimal in-memory mock of the Vehicle Ordering API, written from ASSUMED rules.
 * It exists so the suite can run without the real service; point BASE_URL at the
 * real test environment to run against the real thing.
 *
 * Fault injection, to prove the tests catch real defects:
 *   MOCK_BUG=cross-dealer-read    GET returns another dealer's order
 *   MOCK_BUG=illegal-transition   Submitted -> Draft is accepted
 *   MOCK_BUG=accept-past-date     delivery date in the past is accepted
 */
const http = require('node:http');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.MOCK_PORT || 4010);
const BUG = process.env.MOCK_BUG || '';

const TOKENS = { 'mock-token-dealer-a': 'dealer-001', 'mock-token-dealer-b': 'dealer-002' };
const ALLOWED = {
  Draft: ['Submitted', 'Cancelled'],
  Submitted: ['Cancelled'],
  Confirmed: [],
  Invoiced: [],
  Cancelled: [],
};
if (BUG === 'illegal-transition') ALLOWED.Submitted.push('Draft');
const EDITABLE = new Set(['Draft', 'Submitted']);
const STATUSES = Object.keys(ALLOWED);

const orders = new Map();

function send(res, status, body, headers = {}) {
  const isProblem = status >= 400;
  res.writeHead(status, {
    'content-type': isProblem ? 'application/problem+json; charset=utf-8' : 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function problem(res, status, title, errors, headers) {
  send(
    res,
    status,
    { type: `https://httpstatuses.io/${status}`, title, status, traceId: randomUUID(), ...(errors ? { errors } : {}) },
    headers,
  );
}

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function validateDate(value, errors) {
  if (!isValidDate(value)) {
    errors.RequestedDeliveryDate = ['RequestedDeliveryDate must be a valid date (yyyy-MM-dd).'];
  } else if (BUG !== 'accept-past-date' && value < new Date().toISOString().slice(0, 10)) {
    errors.RequestedDeliveryDate = ['RequestedDeliveryDate cannot be in the past.'];
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (chunks.length === 0) return resolve({ ok: true, value: {} });
      try {
        resolve({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
      } catch {
        resolve({ ok: false });
      }
    });
  });
}

function findOrder(id, dealerId) {
  const order = orders.get(id);
  if (!order) return undefined;
  if (order.dealerId !== dealerId && BUG !== 'cross-dealer-read') return undefined;
  return order;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/\/+$/, '');

  if (path === '/health') return send(res, 200, { status: 'ok' });

  const match = path.match(/^\/orders(?:\/([^/]+))?$/);
  if (!match) return problem(res, 404, 'Not Found');
  const id = match[1];

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const dealerId = TOKENS[token];
  if (!dealerId) return problem(res, 401, 'Unauthorized', undefined, { 'www-authenticate': 'Bearer' });

  // POST /orders
  if (!id && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.ok || typeof body.value !== 'object' || body.value === null) {
      return problem(res, 400, 'Malformed JSON body.');
    }
    const b = body.value;
    const errors = {};
    if (typeof b.vehicleId !== 'string' || !b.vehicleId.trim()) errors.VehicleId = ['The VehicleId field is required.'];
    if (typeof b.supplierId !== 'string' || !b.supplierId.trim()) errors.SupplierId = ['The SupplierId field is required.'];
    validateDate(b.requestedDeliveryDate, errors);
    if (Object.keys(errors).length) return problem(res, 400, 'One or more validation errors occurred.', errors);

    const now = new Date().toISOString();
    const order = {
      id: randomUUID(),
      dealerId,
      vehicleId: b.vehicleId,
      supplierId: b.supplierId,
      requestedDeliveryDate: b.requestedDeliveryDate,
      notes: typeof b.notes === 'string' ? b.notes : null,
      status: 'Draft',
      createdAt: now,
      updatedAt: now,
    };
    orders.set(order.id, order);
    return send(res, 201, order, { location: `/orders/${order.id}` });
  }

  if (!id) return problem(res, 405, 'Method Not Allowed');

  const order = findOrder(id, dealerId);

  // GET /orders/{id}
  if (req.method === 'GET') {
    return order ? send(res, 200, order) : problem(res, 404, 'Order not found.');
  }

  // PATCH /orders/{id}
  if (req.method === 'PATCH') {
    if (!order) return problem(res, 404, 'Order not found.');
    const body = await readBody(req);
    if (!body.ok || typeof body.value !== 'object' || body.value === null) {
      return problem(res, 400, 'Malformed JSON body.');
    }
    const b = body.value;
    const errors = {};
    if (b.requestedDeliveryDate !== undefined) validateDate(b.requestedDeliveryDate, errors);
    if (b.notes !== undefined && b.notes !== null && typeof b.notes !== 'string') errors.Notes = ['Notes must be a string.'];
    if (b.status !== undefined && !STATUSES.includes(b.status)) errors.Status = [`Status must be one of: ${STATUSES.join(', ')}.`];
    if (Object.keys(errors).length) return problem(res, 400, 'One or more validation errors occurred.', errors);

    if (!EDITABLE.has(order.status)) return problem(res, 409, `A ${order.status} order cannot be modified.`);
    if (b.status !== undefined && b.status !== order.status && !ALLOWED[order.status].includes(b.status)) {
      return problem(res, 409, `Transition ${order.status} -> ${b.status} is not allowed.`);
    }

    if (b.requestedDeliveryDate !== undefined) order.requestedDeliveryDate = b.requestedDeliveryDate;
    if (b.notes !== undefined) order.notes = b.notes;
    if (b.status !== undefined) order.status = b.status;
    order.updatedAt = new Date().toISOString();
    return send(res, 200, order);
  }

  // DELETE /orders/{id}
  if (req.method === 'DELETE') {
    if (!order) return problem(res, 404, 'Order not found.');
    if (order.status !== 'Draft') return problem(res, 409, 'Only draft orders can be deleted. Cancel the order instead.');
    orders.delete(order.id);
    res.writeHead(204);
    return res.end();
  }

  return problem(res, 405, 'Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`iCar orders mock listening on :${PORT}${BUG ? ` (MOCK_BUG=${BUG})` : ''}`);
});
