-- Quantity per listing and remembered buyer-facing set names for the quick-add flow.
-- The API also applies this automatically on first use, so running it manually is optional.
ALTER TABLE products ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS set_names (
  lang TEXT NOT NULL,
  set_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (lang, set_id)
);
