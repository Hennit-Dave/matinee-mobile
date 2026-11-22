import { clientIdHeaders } from './clientId';
import { readApiBaseUrl } from './config';
import { fetchApiJson } from './movies';

/**
 * Mirrors matinee-server's `GET /tickets` (ADR 0021): the caller's ticket-bearing orders, for the Tickets tab.
 * Each item is the `ticket` object (the QR-ticket fields) plus `reference` and `status`. `failed` is never present.
 * The status -> badge and upcoming/past split are pure and unit-tested here, so the screen just renders.
 */

export type TicketStatus = 'requires_payment' | 'succeeded' | 'refunded';

export interface TicketItem {
  reference: string;
  status: TicketStatus;
  movieId: number;
  movieTitle: string;
  cinemaName: string;
  screenName: string;
  format: string;
  startsAt: string; // ISO datetime
  time: string; // UTC HH:MM
  seats: { row: string; number: number }[];
  totalFormatted: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSeat(value: unknown): value is { row: string; number: number } {
  return isRecord(value) && typeof value.row === 'string' && typeof value.number === 'number';
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return value === 'requires_payment' || value === 'succeeded' || value === 'refunded';
}

export function isTicketItem(value: unknown): value is TicketItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.reference === 'string' &&
    isTicketStatus(value.status) &&
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

export function isTicketsResponse(value: unknown): value is TicketItem[] {
  return Array.isArray(value) && value.every(isTicketItem);
}

export async function fetchTickets(
  clientId: string,
  signal?: AbortSignal,
  baseUrl: string = readApiBaseUrl()
): Promise<TicketItem[]> {
  const { data } = await fetchApiJson(`${baseUrl}/tickets`, isTicketsResponse, signal, {
    headers: clientIdHeaders(clientId),
  });
  return data;
}

// ---- The upcoming / past split and the status badge (pure) --------------------------------------

export type TicketBadgeTone = 'success' | 'info' | 'warning' | 'neutral';
export interface TicketBadge {
  label: 'Ready' | 'Confirming' | 'Refunded' | 'Watched';
  tone: TicketBadgeTone;
}

/** A refunded ticket is never "upcoming" — its show is gone even when the date is still ahead. */
export function isUpcomingTicket(status: TicketStatus, startsAt: string, now: number): boolean {
  if (status === 'refunded') return false;
  return new Date(startsAt).getTime() >= now;
}

/** The badge word carries the meaning; the tone only reinforces it. */
export function ticketBadge(status: TicketStatus, startsAt: string, now: number): TicketBadge {
  if (status === 'refunded') return { label: 'Refunded', tone: 'warning' };
  if (status === 'requires_payment') return { label: 'Confirming', tone: 'info' };
  return new Date(startsAt).getTime() >= now ? { label: 'Ready', tone: 'success' } : { label: 'Watched', tone: 'neutral' };
}

/**
 * The per-card note, varying by status (Figma 63:14006). `null` for a Watched (past, succeeded) ticket, where the
 * badge stands alone. The refund note stays generic on purpose: we don't promise a timeframe we can't guarantee.
 */
export function ticketNote(status: TicketStatus, startsAt: string, now: number): string | null {
  if (status === 'refunded') return 'Refund on its way';
  if (status === 'requires_payment') return 'Ticket appears here soon';
  return new Date(startsAt).getTime() >= now ? 'Saved on this phone' : null;
}
