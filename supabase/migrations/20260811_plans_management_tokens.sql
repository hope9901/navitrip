-- Migration: Add token_hash column to plans table for secure plan management & deletion
-- Date: 2026-08-11

-- 1. Add token_hash column if it doesn't exist
ALTER TABLE plans
ADD COLUMN IF NOT EXISTS token_hash TEXT DEFAULT NULL;

-- 2. Create index on token_hash for faster verification
CREATE INDEX IF NOT EXISTS idx_plans_token_hash ON plans(token_hash);

-- 3. Comments & Strategy for Existing (Legacy) Plans:
-- For plans created prior to this migration (where token_hash IS NULL):
-- Server Route Handlers allow deletion if author_name matches the request author, OR
-- if SUPABASE_SERVICE_ROLE_KEY is used by an admin.
-- For all new plans, client generates a 32-character crypto token ('manageToken'),
-- stores plaintext in creator's browser localStorage, and saves SHA-256 hash in 'token_hash'.
