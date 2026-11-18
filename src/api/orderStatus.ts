import { clientIdHeaders } from './clientId';
import { readApiBaseUrl } from './config';
import { fetchApiJson } from './movies';

/**
 * Mirrors matinee-server/src/payments/orderStatus.ts (`GET /orders/:reference`, payments P2). The confirmation
 * poll: after the PaymentSheet returns success, the app polls this until the order resolves. `succeeded` carries
 * the ticket (everything the QR ticket screen shows); `refunded` carries the reason (the hold lapsed and the
 * money came back). A reference owned by another install is a 404, which the app treats as "not found".
 */

export type OrderStatus = 'requires_payment' | 'succeeded' | 'refunded' | 'failed';

export interface OrderTicket {
  movieId: number;
  movieTitle: string;
  cinemaName: string;
  screenName: string;
  format: string;
  startsAt: string;
  time: string;
  seats: { row: string; number: number }[];
  totalFormatted: string;
}

export interface OrderStatusResponse {
  reference: string;
  status: OrderStatus;
  ticket?: OrderTicket;
  refundReason?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSeat(value: unknown): value is { row: string; number: number } {
  return isRecord(value) && typeof value.row === 'string' && typeof value.number === 'number';
}

function isTicket(value: unknown): value is OrderTicket {
  if (!isRecord(value)) return false;
  return (
    typeof value.movieId === 'number' &&
    typeof value.movieTitle === 'string' &&
    typeof value.cinemaName === 'string' &&
    typeof value.screenName === 'string' &&
    typeof value.format === 'string' &&
    typeof value.startsAt === 'string' &&
    typeof value.time === 'string' &&
    Array.isArray(value.seats) &&
    value.seats.every(isSeat) &&
    typeof value.totalFormatted === 'string'
  );
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return value === 'requires_payment' || value === 'succeeded' || value === 'refunded' || value === 'failed';
}

export function isOrderStatusResponse(value: unknown): value is OrderStatusResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.reference === 'string' &&
    isOrderStatus(value.status) &&
    (value.ticket === undefined || isTicket(value.ticket)) &&
    (value.refundReason === undefined || typeof value.refundReason === 'string')
  );
}

export async function fetchOrderStatus(
  reference: string,
  clientId: string,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<OrderStatusResponse> {
  const { data } = await fetchApiJson(`${baseUrl}/orders/${reference}`, isOrderStatusResponse, signal, {
    headers: clientIdHeaders(clientId),
  });
  return data;
}
