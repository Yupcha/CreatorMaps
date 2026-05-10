// PGlite — client-side Postgres for persistent caching
// Lazy-loaded to avoid 3MB blocking the initial render

import type { PGlite } from '@electric-sql/pglite';

let db: PGlite | null = null;
let initPromise: Promise<PGlite> | null = null;

/**
 * Lazy-initialize PGlite with IndexedDB persistence.
 * Returns the same instance on subsequent calls.
 */
export async function getDB(): Promise<PGlite> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { PGlite: PGliteClass } = await import('@electric-sql/pglite');
    db = new PGliteClass('idb://yupcha-map');

    // Create cache table if not exists
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cached_api_responses (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        fetched_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    return db;
  })();

  return initPromise;
}

/**
 * Get cached data by key. Returns null if not found or expired.
 */
export async function getCachedData<T>(key: string, maxAgeMs = 30 * 60 * 1000): Promise<T | null> {
  try {
    const pg = await getDB();
    const result = await pg.query<{ data: T; fetched_at: string }>(
      `SELECT data, fetched_at FROM cached_api_responses WHERE key = $1`,
      [key]
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const age = Date.now() - new Date(row.fetched_at).getTime();
    if (age > maxAgeMs) return null;

    return row.data;
  } catch {
    return null;
  }
}

/**
 * Store data in the PGlite cache.
 */
export async function setCachedData<T>(key: string, data: T): Promise<void> {
  try {
    const pg = await getDB();
    await pg.exec(
      `INSERT INTO cached_api_responses (key, data, fetched_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $2, fetched_at = NOW()`,
      // PGlite parameterized query
    );
    // Use query method for parameterized queries
    await pg.query(
      `INSERT INTO cached_api_responses (key, data, fetched_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, fetched_at = NOW()`,
      [key, JSON.stringify(data)]
    );
  } catch (e) {
    console.warn('[PGlite] Cache write failed:', e);
  }
}

/**
 * Clear all cached data.
 */
export async function clearCache(): Promise<void> {
  try {
    const pg = await getDB();
    await pg.exec('DELETE FROM cached_api_responses');
  } catch {
    // silently fail
  }
}
