-- Migration: Add route_cache table for persistent server-side Naver Cloud Driving API segment caching
-- Date: 2026-08-11

CREATE TABLE IF NOT EXISTS route_cache (
  cache_key TEXT PRIMARY KEY,
  start_lat DOUBLE PRECISION NOT NULL,
  start_lng DOUBLE PRECISION NOT NULL,
  goal_lat DOUBLE PRECISION NOT NULL,
  goal_lng DOUBLE PRECISION NOT NULL,
  route_option TEXT NOT NULL DEFAULT 'trafast',
  distance_meter INTEGER NOT NULL,
  duration_ms BIGINT NOT NULL,
  path JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL DEFAULT 'naver',
  source TEXT NOT NULL DEFAULT 'naver'
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_route_cache_expires ON route_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_route_cache_coords ON route_cache(start_lat, start_lng, goal_lat, goal_lng);
