/**
 * The caller's identity until real auth exists (ADR 0015). The app makes one random UUID per install and sends it
 * as `X-Client-Id`; the server treats it as the OWNER of a seat hold, so the same install can release or
 * re-acquire its own holds and nobody else can.
 *
 * It is a bearer value, not authentication: whoever learns the id can act as it. That is acceptable while
 * payments are fake, and it is why the id is kept in secure storage rather than AsyncStorage (AGENTS.md).
 * Real auth replaces this file; nothing else needs to change.
 *
 * Pure on purpose: storage and the UUID generator are passed in, so the rules (generate once, reuse, repair,
 * fall back) are unit-tested without native modules. The real wiring is in clientIdNative.ts.
 */

/** The header the server reads (matinee-server/src/http/clientId.ts). */
export const CLIENT_ID_HEADER = 'X-Client-Id';

export function clientIdHeaders(clientId: string): Record<string, string> {
  return { [CLIENT_ID_HEADER]: clientId };
}

/** The secure-storage key. Letters, digits, dots, dashes and underscores only (a SecureStore rule). */
export const CLIENT_ID_STORAGE_KEY = 'matinee.clientId';

// The same shape the server's Zod `uuid()` accepts: versions 1 to 8 and an RFC variant.
const CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isClientId(value: unknown): value is string {
  return typeof value === 'string' && CLIENT_ID_PATTERN.test(value);
}

export interface ClientIdStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

export interface ClientIdDeps {
  /** `null` where there is no secure storage (the web): the id then lives for the session only. */
  storage: ClientIdStorage | null;
  generate: () => string;
}

/**
 * Returns `getClientId()`:
 *
 * - The first call reads storage. A valid stored id is used. Nothing stored, or a stored value that is not a
 *   UUID (corrupt), makes a fresh id which is stored.
 * - Many calls at once share ONE lookup, so two screens asking at start-up cannot create two ids.
 * - The answer is remembered, so storage is read once per run.
 * - If storage cannot be READ (a locked or broken keystore), the id is made in memory and storage is left
 *   alone (a good id that merely failed to read is not overwritten). It is the same for the whole run, so holds
 *   still work; the cost is that a hold from before an app restart cannot be released and simply times out.
 * - If storage cannot be WRITTEN, the id is used anyway.
 * - Ids are lower-case, like the server's.
 */
export function createClientIdProvider(deps: ClientIdDeps): () => Promise<string> {
  let pending: Promise<string> | null = null;

  async function resolve(): Promise<string> {
    let readFailed = false;
    if (deps.storage) {
      try {
        const stored = await deps.storage.read();
        if (isClientId(stored)) return stored.toLowerCase();
      } catch {
        readFailed = true;
      }
    }

    const fresh = deps.generate().toLowerCase();
    if (!isClientId(fresh)) throw new Error('The UUID generator returned something that is not a UUID.');

    if (deps.storage && !readFailed) {
      try {
        await deps.storage.write(fresh);
      } catch {
        // Not stored: this run still has a stable id.
      }
    }
    return fresh;
  }

  return () => {
    pending ??= resolve().catch((error: unknown) => {
      pending = null; // a failure is not remembered: the next call tries again
      throw error;
    });
    return pending;
  };
}
