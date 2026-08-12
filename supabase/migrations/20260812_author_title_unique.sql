-- =============================================================
-- Migration: Add normalized_title and normalized_author_name to plans
-- Description: Enforce unique constraint for (normalized_author_name, normalized_title)
-- =============================================================

-- 1. Check duplicate entries before applying migration
SELECT
  LOWER(TRIM(REGEXP_REPLACE(COALESCE(author_name, '익명'), '\s+', ' ', 'g'))) AS normalized_author_name,
  LOWER(TRIM(REGEXP_REPLACE(COALESCE(title, '제목 없음'), '\s+', ' ', 'g'))) AS normalized_title,
  COUNT(*)
FROM plans
GROUP BY
  LOWER(TRIM(REGEXP_REPLACE(COALESCE(author_name, '익명'), '\s+', ' ', 'g'))),
  LOWER(TRIM(REGEXP_REPLACE(COALESCE(title, '제목 없음'), '\s+', ' ', 'g')))
HAVING COUNT(*) > 1;

-- 2. Add columns if not exist
ALTER TABLE plans ADD COLUMN IF NOT EXISTS normalized_title TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS normalized_author_name TEXT;

-- 3. Populate normalized values for existing records
UPDATE plans
SET
  normalized_title = LOWER(TRIM(REGEXP_REPLACE(COALESCE(title, '제목 없음'), '\s+', ' ', 'g'))),
  normalized_author_name = LOWER(TRIM(REGEXP_REPLACE(COALESCE(author_name, '익명'), '\s+', ' ', 'g')))
WHERE normalized_title IS NULL OR normalized_author_name IS NULL;

-- 4. Create Unique Index
CREATE UNIQUE INDEX IF NOT EXISTS plans_author_title_unique
ON plans (normalized_author_name, normalized_title);
