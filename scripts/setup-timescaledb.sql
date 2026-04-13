-- ─────────────────────────────────────────────────────────────────────────────
-- TimescaleDB Setup for MarketSync
-- Run this AFTER installing TimescaleDB and restarting PostgreSQL.
--
-- Usage:
--   psql -U postgres -d marketsync -f scripts/setup-timescaledb.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable the extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- 2. Register integer_now function (our "time" column is Unix seconds)
CREATE OR REPLACE FUNCTION unix_now()
RETURNS INTEGER LANGUAGE SQL STABLE AS $$
  SELECT EXTRACT(EPOCH FROM NOW())::INTEGER;
$$;

-- 3. Convert the Candle table into a TimescaleDB hypertable
--    chunk_time_interval = 30 days in seconds (2_592_000)
--    migrate_data = TRUE preserves existing rows
SELECT create_hypertable(
  '"Candle"',
  'time',
  chunk_time_interval => 2592000,
  migrate_data        => TRUE
);

-- 4. Register the integer_now function so retention/compression policies work
SELECT set_integer_now_func('"Candle"', 'unix_now');

-- 5. Enable chunk compression (compress chunks older than 7 days)
ALTER TABLE "Candle" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'market, symbol, interval'
);
SELECT add_compression_policy('"Candle"', compress_after => 604800); -- 7 days in seconds

-- 6. Optional: auto-drop candle data older than 2 years
-- SELECT add_retention_policy('"Candle"', drop_after => 63072000); -- 730 days in seconds

-- ─── Verify ───────────────────────────────────────────────────────────────────
SELECT hypertable_name, num_chunks
FROM timescaledb_information.hypertables
WHERE hypertable_name = 'Candle';

SELECT * FROM timescaledb_information.compression_settings
WHERE hypertable_name = 'Candle';
