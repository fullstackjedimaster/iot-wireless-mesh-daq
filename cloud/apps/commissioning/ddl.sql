BEGIN;

DROP SCHEMA IF EXISTS ss CASCADE;

CREATE SCHEMA ss AUTHORIZATION ss;

SET search_path TO ss;

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
    string_position INTEGER NOT NULL UNIQUE,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    equipment_id INTEGER REFERENCES ss.equipment(id) ON DELETE CASCADE
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

END;
