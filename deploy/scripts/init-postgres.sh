#!/bin/sh
set -eu

# ------------------------------------------------------------
# Resolve Postgres connection
# Supports:
#   1) DATABASE_URL (legacy)
#   2) POSTGRES_HOST/POSTGRES_PORT/POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD
#   3) DATABASE_HOST/DATABASE_PORT + POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD
# ------------------------------------------------------------

DATABASE_URL="${DATABASE_URL:-}"

POSTGRES_HOST="${POSTGRES_HOST:-${DATABASE_HOST:-}}"
POSTGRES_PORT="${POSTGRES_PORT:-${DATABASE_PORT:-5432}}"
POSTGRES_DB="${POSTGRES_DB:-}"
POSTGRES_USER="${POSTGRES_USER:-}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

if [ -z "$DATABASE_URL" ]; then
  : "${POSTGRES_HOST:?POSTGRES_HOST (or DATABASE_HOST) is required}"
  : "${POSTGRES_PORT:?POSTGRES_PORT (or DATABASE_PORT) is required}"
  : "${POSTGRES_DB:?POSTGRES_DB is required}"
  : "${POSTGRES_USER:?POSTGRES_USER is required}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

  # Use libpq env for password so we don't echo it in process args.
  export PGPASSWORD="$POSTGRES_PASSWORD"
  DATABASE_URL="postgresql://${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
fi

# Seed config
SITE_NAME="${SITE_NAME:-TEST}"
SITEARRAY_LABEL="${SITEARRAY_LABEL:-Site Array TEST}"
TZ_NAME="${TZ_NAME:-America/Chicago}"

echo "[init-postgres] Using DB host='${POSTGRES_HOST:-<from DATABASE_URL>}' db='${POSTGRES_DB:-<from DATABASE_URL>}' user='${POSTGRES_USER:-<from DATABASE_URL>}'"
echo "[init-postgres] Waiting for Postgres and checking schema..."

i=1
while [ "$i" -le 60 ]; do
  out="$(psql "$DATABASE_URL" -tA -c "SELECT 1 FROM pg_namespace WHERE nspname='ss' LIMIT 1;" 2>/dev/null || true)"
  out="$(echo "$out" | tr -d '[:space:]')"

  if [ "$out" = "1" ]; then
    echo "[init-postgres] Postgres is ready. Schema 'ss' already exists. Skipping (only runs on fresh DB)."
    exit 0
  fi

  # Distinguish "psql failed (not ready)" from "ready but schema missing"
  if psql "$DATABASE_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
    echo "[init-postgres] Postgres is ready. Schema 'ss' not found; proceeding with initialization."
    break
  fi

  echo "[init-postgres] Not ready yet ($i/60); sleeping 1s..."
  sleep 1
  i=$((i + 1))
done

# Final hard fail if Postgres never came up
if ! psql "$DATABASE_URL" -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "[init-postgres] ERROR: Postgres never became ready."
  exit 1
fi

echo "[init-postgres] Creating schema/tables and seeding data..."

psql -v ON_ERROR_STOP=1 "$DATABASE_URL" <<SQL
BEGIN;

CREATE SCHEMA IF NOT EXISTS ss;

SET search_path TO ss;

-- -------------------------
-- DDL
-- -------------------------

CREATE TABLE IF NOT EXISTS ss.site (
    id SERIAL PRIMARY KEY,
    integrator VARCHAR(32),
    owner VARCHAR(32),
    sitename VARCHAR(32) NOT NULL UNIQUE,
    UNIQUE (integrator, owner, sitename)
);

CREATE TABLE IF NOT EXISTS ss.site_array (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES ss.site(id) ON DELETE CASCADE,
    label VARCHAR(32) NOT NULL UNIQUE,
    version VARCHAR(8),
    status VARCHAR(32),
    timezone VARCHAR(24),
    commission_date DATE,
    decommission_date DATE,
    last_service_date TIMESTAMP,
    last_cleaning_date TIMESTAMP,
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    offset_dir DOUBLE PRECISION,
    extent_hi_x INTEGER,
    extent_hi_y INTEGER,
    extent_lo_x INTEGER,
    extent_lo_y INTEGER,
    preferred_rotation INTEGER
);

CREATE TABLE IF NOT EXISTS ss.equipment (
    id SERIAL PRIMARY KEY,
    manufacturer VARCHAR(255),
    model VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS ss.gateways (
    id SERIAL PRIMARY KEY,
    label VARCHAR(255) NOT NULL UNIQUE,
    mac_address VARCHAR(17),
    ip_address VARCHAR(45),
    equipment_id INTEGER REFERENCES ss.equipment(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ss.inverters (
    id SERIAL PRIMARY KEY,
    serial_number VARCHAR(255),
    label VARCHAR(255) NOT NULL UNIQUE,
    gateway_id INTEGER NOT NULL REFERENCES ss.gateways(id) ON DELETE CASCADE,
    equipment_id INTEGER REFERENCES ss.equipment(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ss.strings (
    id SERIAL PRIMARY KEY,
    label VARCHAR(255) NOT NULL UNIQUE,
    inverter_id INTEGER REFERENCES ss.inverters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ss.panels (
    id SERIAL PRIMARY KEY,
    serial_number VARCHAR(255),
    label VARCHAR(255) NOT NULL UNIQUE,
    string_id INTEGER REFERENCES ss.strings(id) ON DELETE CASCADE,
    string_position INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    equipment_id INTEGER REFERENCES ss.equipment(id) ON DELETE CASCADE,
    UNIQUE (string_id, string_position)
);

CREATE TABLE IF NOT EXISTS ss.monitors (
    id SERIAL PRIMARY KEY,
    mac_address VARCHAR(17) NOT NULL UNIQUE,
    label VARCHAR(255),
    node_id VARCHAR(50) NOT NULL UNIQUE,
    panel_id INTEGER NOT NULL UNIQUE REFERENCES ss.panels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ss.site_graph (
    id SERIAL PRIMARY KEY,
    sitearray_id INTEGER NOT NULL REFERENCES ss.site_array(id) ON DELETE CASCADE,
    r_graph_id VARCHAR(12),
    json TEXT
);

CREATE TABLE IF NOT EXISTS ss.device_data (
    id SERIAL PRIMARY KEY,
    node_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    voltage REAL,
    current REAL,
    power REAL,
    status TEXT
);

-- -------------------------
-- DML (seed)
-- -------------------------

INSERT INTO ss.site (sitename)
VALUES ('${SITE_NAME}')
ON CONFLICT (sitename) DO NOTHING;

INSERT INTO ss.site_array (site_id, label, timezone, commission_date)
SELECT s.id, '${SITEARRAY_LABEL}', '${TZ_NAME}', CURRENT_DATE
FROM ss.site s
WHERE s.sitename='${SITE_NAME}'
ON CONFLICT (label) DO NOTHING;

INSERT INTO ss.equipment (manufacturer, model)
VALUES
  ('SolarSynapse', 'GW-Emu'),
  ('SolarSynapse', 'INV-Emu'),
  ('SolarSynapse', 'PNL-Emu')
ON CONFLICT DO NOTHING;

INSERT INTO ss.gateways (label, mac_address, ip_address, equipment_id)
SELECT
  'GW-1',
  'aa:bb:cc:dd:ee:ff',
  '192.168.1.1',
  (SELECT id FROM ss.equipment WHERE model='GW-Emu' LIMIT 1)
ON CONFLICT (label) DO NOTHING;

INSERT INTO ss.inverters (serial_number, label, gateway_id, equipment_id)
SELECT
  'INV-7281-9321',
  'INV-1',
  (SELECT id FROM ss.gateways WHERE label='GW-1' LIMIT 1),
  (SELECT id FROM ss.equipment WHERE model='INV-Emu' LIMIT 1)
ON CONFLICT (label) DO NOTHING;

INSERT INTO ss.strings (label, inverter_id)
SELECT
  'S-1',
  (SELECT id FROM ss.inverters WHERE label='INV-1' LIMIT 1)
ON CONFLICT (label) DO NOTHING;

-- Keep the demo tiny: 4 panels
INSERT INTO ss.panels (serial_number, label, string_id, string_position, x, y, equipment_id)
SELECT
  'PNL-SN-' || LPAD(gs::text, 6, '0'),
  'PNL-'    || LPAD(gs::text, 6, '0'),
  (SELECT id FROM ss.strings WHERE label='S-1' LIMIT 1),
  gs,
  50 + (gs-1)*50,
  50 + (gs-1)*50,
  (SELECT id FROM ss.equipment WHERE model='PNL-Emu' LIMIT 1)
FROM generate_series(1,4) gs
ON CONFLICT (label) DO NOTHING;

INSERT INTO ss.monitors (mac_address, label, node_id, panel_id)
SELECT
  'fa:29:eb:6d:87:' || LPAD(p.string_position::text, 2, '0'),
  'M-' || LPAD(p.string_position::text, 6, '0'),
  'M-' || LPAD(p.string_position::text, 6, '0'),
  p.id
FROM ss.panels p
ORDER BY p.string_position
ON CONFLICT (mac_address) DO NOTHING;

INSERT INTO ss.site_graph (sitearray_id, json)
SELECT
  sa.id,
  (
    json_build_object(
      'sitearray', json_build_object(
        'id', 'SA-' || LPAD(sa.id::text, 6, '0'),
        'devtype', 'SA',
        'label', '${SITEARRAY_LABEL}',
        'timezone', '${TZ_NAME}',
        'inputs', json_build_array(
          json_build_object(
            'id', 'I-' || LPAD(inv.id::text, 6, '0'),
            'devtype', 'I',
            'label', 'Inverter 1',
            'serial', inv.serial_number,
            'inputs', json_build_array(
              json_build_object(
                'id', 'S-' || LPAD(st.id::text, 6, '0'),
                'devtype', 'S',
                'label', 'String 1',
                'inputs',
                  (
                    SELECT json_agg(
                      json_build_object(
                        'id', 'P-' || LPAD(p.id::text, 6, '0'),
                        'devtype', 'P',
                        'label', p.label,
                        'x', p.x,
                        'y', p.y,
                        'inputs', json_build_array(
                          json_build_object(
                            'id', m.node_id,
                            'devtype', 'SPM',
                            'macaddr', m.mac_address
                          )
                        )
                      )
                      ORDER BY p.string_position
                    )
                    FROM ss.panels p
                    JOIN ss.monitors m ON m.panel_id = p.id
                  )
              )
            )
          )
        )
      )
    )::text
  )
FROM ss.site s
JOIN ss.site_array sa ON sa.site_id = s.id
JOIN ss.inverters inv ON inv.label='INV-1'
JOIN ss.strings st ON st.label='S-1'
WHERE s.sitename='${SITE_NAME}'
LIMIT 1
ON CONFLICT DO NOTHING;

COMMIT;
SQL

echo "[init-postgres] Done."
