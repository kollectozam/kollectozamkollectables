-- Cache for card-database lookups (PikaQian Simplified Chinese sets and card lists).
-- The API also applies this automatically on first use, so running it manually is optional.
CREATE TABLE IF NOT EXISTS lookup_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
