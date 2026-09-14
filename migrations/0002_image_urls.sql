-- Upgrade databases created from the earlier R2-oriented schema.
-- Existing records and image-key columns are preserved.
ALTER TABLE products ADD COLUMN front_image_url TEXT;
ALTER TABLE products ADD COLUMN back_image_url TEXT;
