/** Realistic mock props for the gallery. No network, no server. Film names are invented. */
export const MOCK_TITLES = {
  short: 'Hope',
  regular: 'The Lantern Road',
  long: 'The Extraordinarily Long Title of a Film That Keeps Going and Going',
} as const;

export const MOCK_META = {
  regular: 'Drama · 2h 14m',
  long: '2026 · A quiet journey across a country that is changing faster than the people who live in it can follow.',
  year: '2026',
} as const;

export const MOCK_SHOWTIMES = ['19:30', '20:15', '21:00', '21:45'] as const;
export const MOCK_DATES = ['Fri 14', 'Sat 15', 'Sun 16'] as const;

export const MOCK_CINEMA = {
  name: 'Orpheum Central',
  showing: 'Screen 3, Saturday 14 November, 19:30',
  ticketNote: 'Seats F7, F8',
} as const;

export const MOCK_TOASTS = {
  info: 'Seats held for 10 minutes.',
  success: 'Booking confirmed.',
  error: 'Payment failed.',
  long: 'We could not reach the server, so your seats were not held. Check your connection and try again.',
} as const;

/** The showing on the waiting-room frames (Figma 56:6607). */
export const MOCK_WAITING_ROOM = {
  title: 'The Lantern Road',
  showing: 'Sat 14 Nov · 20:00 · IMAX',
} as const;
