#!/usr/bin/env bash
set -e

echo "[bootstrap] Checking Postgres schema…"

psql "$DATABASE_URL" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT now()
);

INSERT INTO schema_version (version)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM schema_version WHERE version = 1);
SQL

echo "[bootstrap] Applying DDL if needed…"

psql "$DATABASE_URL" <<'SQL'
-- safe to re-run
CREATE TABLE IF NOT EXISTS site (
  id SERIAL PRIMARY KEY,
  name TEXT
);
SQL

echo "[bootstrap] Postgres ready."
