import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_ID_HEADER, clientIdHeaders, createClientIdProvider, isClientId, type ClientIdStorage } from './clientId';

const ID_1 = '0a11ce00-0000-4000-8000-000000000001';
const ID_2 = '0b0b0000-0000-4000-8000-000000000002';

function fakeStorage(initial: string | null = null) {
  const calls = { read: 0, write: [] as string[] };
  const state = { value: initial, failRead: false, failWrite: false };
  const storage: ClientIdStorage = {
    async read() {
      calls.read += 1;
      await Promise.resolve();
      if (state.failRead) throw new Error('keystore locked');
      return state.value;
    },
    async write(value) {
      calls.write.push(value);
      if (state.failWrite) throw new Error('disk full');
      state.value = value;
    },
  };
  return { storage, calls, state };
}

function generator(...ids: string[]) {
  let i = 0;
  const calls = { count: 0 };
  return {
    calls,
    generate: () => {
      calls.count += 1;
      return ids[Math.min(i++, ids.length - 1)]!;
    },
  };
}

test('the header name and shape match the server', () => {
  assert.equal(CLIENT_ID_HEADER, 'X-Client-Id');
  assert.deepEqual(clientIdHeaders(ID_1), { 'X-Client-Id': ID_1 });
});

test('isClientId accepts a UUID and rejects everything else the server would', () => {
  assert.equal(isClientId(ID_1), true);
  assert.equal(isClientId(ID_1.toUpperCase()), true);
  for (const bad of ['', 'nope', ID_1 + 'x', ID_1.replaceAll('-', ''), null, undefined, 7, '00000000-0000-0000-0000-000000000000']) {
    assert.equal(isClientId(bad), false, String(bad));
  }
});

test('the first call makes an id and stores it; the next call reads storage once and reuses the answer', async () => {
  const { storage, calls } = fakeStorage(null);
  const gen = generator(ID_1);
  const getClientId = createClientIdProvider({ storage, generate: gen.generate });

  assert.equal(await getClientId(), ID_1);
  assert.equal(await getClientId(), ID_1);
  assert.deepEqual(calls.write, [ID_1]);
  assert.equal(calls.read, 1, 'storage is read once per run');
  assert.equal(gen.calls.count, 1);
});

test('a stored id survives: a "new launch" (a new provider on the same storage) gets the same one', async () => {
  const { storage, calls } = fakeStorage(null);
  const first = createClientIdProvider({ storage, generate: generator(ID_1).generate });
  assert.equal(await first(), ID_1);

  const gen2 = generator(ID_2);
  const second = createClientIdProvider({ storage, generate: gen2.generate });
  assert.equal(await second(), ID_1, 'the stored id is reused, not replaced');
  assert.equal(gen2.calls.count, 0, 'nothing new is generated');
  assert.deepEqual(calls.write, [ID_1], 'and nothing is rewritten');
});

test('many callers at the same moment share ONE id (two screens asking at start-up)', async () => {
  const { storage, calls } = fakeStorage(null);
  const gen = generator(ID_1, ID_2);
  const getClientId = createClientIdProvider({ storage, generate: gen.generate });

  const ids = await Promise.all([getClientId(), getClientId(), getClientId(), getClientId()]);
  assert.deepEqual(new Set(ids).size, 1);
  assert.equal(gen.calls.count, 1);
  assert.equal(calls.write.length, 1);
});

test('a stored value that is not a UUID is corrupt: it is replaced, not sent', async () => {
  const { storage, calls } = fakeStorage('hello world');
  const getClientId = createClientIdProvider({ storage, generate: generator(ID_1).generate });
  assert.equal(await getClientId(), ID_1);
  assert.deepEqual(calls.write, [ID_1]);
});

test('ids are lower-case, like the server compares them', async () => {
  const { storage } = fakeStorage(ID_1.toUpperCase());
  const getClientId = createClientIdProvider({ storage, generate: generator(ID_2).generate });
  assert.equal(await getClientId(), ID_1);

  const { storage: empty } = fakeStorage(null);
  const fresh = createClientIdProvider({ storage: empty, generate: generator(ID_2.toUpperCase()).generate });
  assert.equal(await fresh(), ID_2);
});

test('storage that cannot be READ: the id lives in memory for the run, and a possibly-good stored id is not overwritten', async () => {
  const { storage, calls, state } = fakeStorage(ID_2);
  state.failRead = true;
  const getClientId = createClientIdProvider({ storage, generate: generator(ID_1).generate });

  assert.equal(await getClientId(), ID_1);
  assert.equal(await getClientId(), ID_1, 'stable for the whole run');
  assert.deepEqual(calls.write, [], 'the unreadable stored id is left alone');
});

test('storage that cannot be WRITTEN: the id is still used, and stable for the run', async () => {
  const { storage, state } = fakeStorage(null);
  state.failWrite = true;
  const getClientId = createClientIdProvider({ storage, generate: generator(ID_1, ID_2).generate });
  assert.equal(await getClientId(), ID_1);
  assert.equal(await getClientId(), ID_1);
});

test('no storage at all (the web): an in-memory id, stable for the run', async () => {
  const gen = generator(ID_1, ID_2);
  const getClientId = createClientIdProvider({ storage: null, generate: gen.generate });
  assert.equal(await getClientId(), ID_1);
  assert.equal(await getClientId(), ID_1);
  assert.equal(gen.calls.count, 1);
});

test('a failure is not remembered: if generating throws once, the next call tries again', async () => {
  const { storage } = fakeStorage(null);
  let attempts = 0;
  const getClientId = createClientIdProvider({
    storage,
    generate: () => {
      attempts += 1;
      if (attempts === 1) throw new Error('native module missing');
      return ID_1;
    },
  });
  await assert.rejects(() => getClientId(), /native module missing/);
  assert.equal(await getClientId(), ID_1);
});

test('a generator that returns something that is not a UUID is refused, never stored or sent', async () => {
  const { storage, calls } = fakeStorage(null);
  const getClientId = createClientIdProvider({ storage, generate: () => 'not-a-uuid' });
  await assert.rejects(() => getClientId(), /not a UUID/);
  assert.deepEqual(calls.write, []);
});
