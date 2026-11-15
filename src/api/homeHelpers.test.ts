import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import {
  HERO_CYCLE_INTERVAL_MS,
  HERO_HEIGHT_COMPACT,
  HERO_HEIGHT_TALL,
  HERO_MAX_SLIDES,
  composeFeaturedMeta,
  nextHeroIndex,
  pickDetail,
  resolveHeroHeight,
  resolveHeroImageCandidates,
  resolveHeroIndex,
  scheduleHeroAdvance,
  selectFeaturedMovie,
  selectHeroSlides,
  shouldAutoCycleHero,
  waitForImageReady,
} from './homeHelpers';
import type { Movie, MovieDetail } from './movies';

const SAMPLE_MOVIE: Movie = {
  id: 101,
  title: 'The Lantern Road',
  posterUrl: 'https://image.tmdb.org/t/p/w500/lantern.jpg',
  year: 2026,
  overview: 'A quiet journey.',
};

const SAMPLE_DETAIL: MovieDetail = {
  id: 101,
  title: 'The Lantern Road',
  overview: 'A quiet journey.',
  posterUrl: 'https://image.tmdb.org/t/p/w500/lantern.jpg',
  backdropUrl: 'https://image.tmdb.org/t/p/w780/lantern-bg.jpg',
  year: 2026,
  releaseDate: '2026-10-12',
  runtimeMinutes: 134,
  genres: ['Drama', 'Mystery'],
  rating: 7.8,
  tagline: null,
  certification: '12A',
  language: 'English',
  director: 'Jane Doe',
  cast: ['Actor One'],
};

test('resolveHeroHeight matches compact (448) and tall (512) Figma frames', () => {
  assert.equal(resolveHeroHeight(800), HERO_HEIGHT_COMPACT);
  assert.equal(resolveHeroHeight(879), HERO_HEIGHT_COMPACT);
  assert.equal(resolveHeroHeight(880), HERO_HEIGHT_TALL);
  assert.equal(resolveHeroHeight(915), HERO_HEIGHT_TALL);
});

test('selectFeaturedMovie returns the first now-playing movie or null', () => {
  assert.equal(selectFeaturedMovie([]), null);
  assert.deepEqual(selectFeaturedMovie([SAMPLE_MOVIE]), SAMPLE_MOVIE);
});

test('composeFeaturedMeta uses genre and runtime when matching detail is available, otherwise year', () => {
  assert.equal(composeFeaturedMeta(SAMPLE_MOVIE), '2026 · Now playing');
  assert.equal(composeFeaturedMeta(SAMPLE_MOVIE, SAMPLE_DETAIL), 'Drama · 2h 14m · Now playing');
  assert.equal(
    composeFeaturedMeta({ ...SAMPLE_MOVIE, year: null }, null),
    'Now playing'
  );
  // Mismatched detail id must not leak into another featured movie.
  assert.equal(
    composeFeaturedMeta(SAMPLE_MOVIE, { ...SAMPLE_DETAIL, id: 999 }),
    '2026 · Now playing'
  );
});

test('resolveHeroImageCandidates prefers matching backdrop with poster fallback', () => {
  assert.deepEqual(resolveHeroImageCandidates(SAMPLE_MOVIE), {
    primaryUrl: 'https://image.tmdb.org/t/p/w500/lantern.jpg',
    fallbackUrl: null,
  });
  assert.deepEqual(resolveHeroImageCandidates(SAMPLE_MOVIE, SAMPLE_DETAIL), {
    primaryUrl: 'https://image.tmdb.org/t/p/w780/lantern-bg.jpg',
    fallbackUrl: 'https://image.tmdb.org/t/p/w500/lantern.jpg',
  });
});

function movieWith(id: number, posterUrl: string | null = `https://img/${id}.jpg`): Movie {
  return { id, title: `Movie ${id}`, posterUrl, year: 2026, overview: null };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('selectHeroSlides caps at HERO_MAX_SLIDES, keeps order and skips posterless movies', () => {
  const many = Array.from({ length: 12 }, (_, i) => movieWith(i + 1));
  assert.equal(HERO_MAX_SLIDES, 5);
  assert.deepEqual(
    selectHeroSlides(many).map((m) => m.id),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    selectHeroSlides([movieWith(1, null), movieWith(2), movieWith(3, null), movieWith(4)], 5).map((m) => m.id),
    [2, 4]
  );
  assert.deepEqual(selectHeroSlides(many, 2).map((m) => m.id), [1, 2]);
});

test('selectHeroSlides falls back to the first movie when none have a poster, and is empty for no movies', () => {
  assert.deepEqual(
    selectHeroSlides([movieWith(7, null), movieWith(8, null)]).map((m) => m.id),
    [7]
  );
  assert.deepEqual(selectHeroSlides([]), []);
  assert.deepEqual(selectHeroSlides([movieWith(1)], 0), []);
});

test('nextHeroIndex advances and wraps; one or zero slides stay at 0', () => {
  assert.equal(nextHeroIndex(0, 3), 1);
  assert.equal(nextHeroIndex(1, 3), 2);
  assert.equal(nextHeroIndex(2, 3), 0);
  assert.equal(nextHeroIndex(0, 1), 0);
  assert.equal(nextHeroIndex(0, 0), 0);
});

test('resolveHeroIndex keeps the index in range and pins to the first slide for reduced motion', () => {
  assert.equal(resolveHeroIndex(2, 5, false), 2);
  assert.equal(resolveHeroIndex(7, 5, false), 2);
  assert.equal(resolveHeroIndex(-1, 5, false), 4);
  assert.equal(resolveHeroIndex(4, 3, false), 1, 'list shrank from 5 to 3');
  assert.equal(resolveHeroIndex(3, 0, false), 0);
  assert.equal(resolveHeroIndex(3, 5, true), 0);
});

test('shouldAutoCycleHero needs 2+ slides, a focused screen and no reduced motion', () => {
  const ok = { count: 3, isFocused: true, reducedMotion: false };
  assert.equal(shouldAutoCycleHero(ok), true);
  assert.equal(shouldAutoCycleHero({ ...ok, count: 1 }), false);
  assert.equal(shouldAutoCycleHero({ ...ok, count: 0 }), false);
  assert.equal(shouldAutoCycleHero({ ...ok, isFocused: false }), false, 'paused when Home is not focused');
  assert.equal(shouldAutoCycleHero({ ...ok, reducedMotion: true }), false, 'static under reduced motion');
});

test('pickDetail returns only the detail whose id matches', () => {
  const a = { ...SAMPLE_DETAIL, id: 1 };
  const b = { ...SAMPLE_DETAIL, id: 2 };
  assert.equal(pickDetail([a, null, b], 2), b);
  assert.equal(pickDetail([a, undefined], 2), null);
  assert.equal(pickDetail([], 1), null);
});

test('waitForImageReady resolves after a successful prefetch and skips null urls', async () => {
  const calls: string[] = [];
  await waitForImageReady('https://img/a.jpg', async (url) => {
    calls.push(url);
    return true;
  });
  await waitForImageReady(null, async (url) => {
    calls.push(url);
    return true;
  });
  assert.deepEqual(calls, ['https://img/a.jpg']);
});

test('waitForImageReady fails soft when the prefetch rejects', async () => {
  await waitForImageReady('https://img/a.jpg', () => Promise.reject(new Error('offline')));
});

test('waitForImageReady gives up after the timeout when the prefetch never settles', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let settled = false;
    const pending = waitForImageReady('https://img/a.jpg', () => new Promise(() => {}), 2_000).then(() => {
      settled = true;
    });
    mock.timers.tick(1_999);
    await flush();
    assert.equal(settled, false);
    mock.timers.tick(1);
    await pending;
    assert.equal(settled, true);
  } finally {
    mock.timers.reset();
  }
});

test('scheduleHeroAdvance prepares then advances once per interval', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const events: string[] = [];
    scheduleHeroAdvance({
      intervalMs: HERO_CYCLE_INTERVAL_MS,
      prepare: async () => {
        events.push('prepare');
      },
      onAdvance: () => events.push('advance'),
    });
    mock.timers.tick(HERO_CYCLE_INTERVAL_MS - 1);
    await flush();
    assert.deepEqual(events, [], 'nothing before the interval elapses');
    mock.timers.tick(1);
    await flush();
    assert.deepEqual(events, ['prepare', 'advance']);
  } finally {
    mock.timers.reset();
  }
});

test('scheduleHeroAdvance cancel stops a pending timer', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let advanced = 0;
    const cancel = scheduleHeroAdvance({
      intervalMs: HERO_CYCLE_INTERVAL_MS,
      prepare: async () => {},
      onAdvance: () => {
        advanced += 1;
      },
    });
    cancel();
    mock.timers.tick(HERO_CYCLE_INTERVAL_MS * 3);
    await flush();
    assert.equal(advanced, 0, 'blurring Home or enabling reduced motion cancels the advance');
  } finally {
    mock.timers.reset();
  }
});

test('scheduleHeroAdvance cancel during prepare prevents the advance, and a failed prepare still advances', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let advanced = 0;
    let finishPrepare: () => void = () => {};
    const cancel = scheduleHeroAdvance({
      intervalMs: 10,
      prepare: () =>
        new Promise<void>((resolve) => {
          finishPrepare = resolve;
        }),
      onAdvance: () => {
        advanced += 1;
      },
    });
    mock.timers.tick(10);
    cancel();
    finishPrepare();
    await flush();
    assert.equal(advanced, 0);

    scheduleHeroAdvance({
      intervalMs: 10,
      prepare: () => Promise.reject(new Error('prefetch blew up')),
      onAdvance: () => {
        advanced += 1;
      },
    });
    mock.timers.tick(10);
    await flush();
    assert.equal(advanced, 1);
  } finally {
    mock.timers.reset();
  }
});
