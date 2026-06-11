-- Add status tracking to exports table
ALTER TABLE exports ALTER COLUMN storage_key DROP NOT NULL;
ALTER TABLE exports
  ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING'
  CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED'));
