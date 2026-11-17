import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_ID_HEADER } from './clientId';
import { fetchSearchMovies } from './movies';

const BASE = 'https://api.example.test';
const CLIENT = '0a11ce00-0000-4000-8000-000000000001';

const PAGE = { movies: [{ id: 1, title: 'Dune', posterUrl: null, year: 2021, overview: null }], page: 1, totalPages: 1, totalResults: 1 };

interface Sent {
  url: string;
  init: RequestInit | undefined;
}

/** Runs `body` with `fetch` replaced by `handler`, and gives back what was sent. Always puts fetch back. */
async function withFetch(handler: () => Response, body: (sent: Sent[]) => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  const sent: Sent[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    sent.push({ url: String(input), init });
    return handler();
  }) as typeof fetch;
  try {
    await body(sent);
  } finally {
    globalThis.fetch = original;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---- X-Client-Id on search (traffic slice 5c, ADR 0016) --------------------------------------------

test('search sends the install id as X-Client-Id, so the per-user search limit can apply', async () => {
  await withFetch(
    () => json(200, PAGE),
    async (sent) => {
      await fetchSearchMovies('  Dune ', 1, undefined, BASE, CLIENT);
      assert.equal(sent.length, 1);
      assert.equal(sent[0]!.url, `${BASE}/movies/search?q=dune&page=1`, 'the URL is unchanged');
      assert.equal((sent[0]!.init?.headers as Record<string, string>)[CLIENT_ID_HEADER], CLIENT);
      assert.equal(sent[0]!.init?.method, undefined, 'still a plain GET');
      assert.equal(sent[0]!.init?.body, undefined);
    }
  );
});

test('search with no install id is the plain GET it always was: no headers at all', async () => {
  await withFetch(
    () => json(200, PAGE),
    async (sent) => {
      await fetchSearchMovies('dune', 1, undefined, BASE);
      assert.deepEqual(Object.keys(sent[0]!.init ?? {}).sort(), ['signal']);
    }
  );
});

test('an install id that is not a UUID is never sent (the server answers a malformed one with a 400)', async () => {
  for (const bad of ['', 'not-a-uuid', `${CLIENT} `, '0a11ce00-0000-9000-8000-000000000001']) {
    await withFetch(
      () => json(200, PAGE),
      async (sent) => {
        await fetchSearchMovies('dune', 1, undefined, BASE, bad);
        assert.deepEqual(Object.keys(sent[0]!.init ?? {}).sort(), ['signal'], `"${bad}"`);
      }
    );
  }
});
