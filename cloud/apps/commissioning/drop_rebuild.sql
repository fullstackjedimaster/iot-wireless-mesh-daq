-- DROP EXISTING TABLES
DROP TABLE IF EXISTS ss.panels CASCADE;
DROP TABLE IF EXISTS ss.monitors CASCADE;
DROP TABLE IF EXISTS ss.strings CASCADE;
DROP TABLE IF EXISTS ss.inverters CASCADE;
DROP TABLE IF EXISTS ss.equipment CASCADE;
DROP TABLE IF EXISTS ss.site_graph CASCADE;
DROP TABLE IF EXISTS ss.site_data CASCADE;
DROP TABLE IF EXISTS ss.site_array CASCADE;
DROP TABLE IF EXISTS ss.gateways CASCADE;
DROP TABLE IF EXISTS ss.site CASCADE;

-- CREATE NEW TABLES
CREATE TABLE ss.site (
    id serial PRIMARY KEY,
    integrator VARCHAR(32) NOT NULL,
    owner VARCHAR(32) NOT NULL,
    sitename VARCHAR(32) NOT NULL UNIQUE
);

CREATE TABLE ss.site_array (
    id serial PRIMARY KEY,
    site_id INTEGER REFERENCES ss.site(id),
    label VARCHAR(32),
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

CREATE TABLE ss.equipment (
    id serial PRIMARY KEY,
    manufacturer VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL
);

CREATE TABLE ss.inverters (
    id serial PRIMARY KEY,
    serial_number VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE ss.strings (
    id serial PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    inverter_id INTEGER NOT NULL REFERENCES ss.inverters(id)
);

CREATE TABLE ss.monitors (
    id serial PRIMARY KEY,
    mac_address VARCHAR(17) NOT NULL UNIQUE,
    node_id VARCHAR(50) NOT NULL UNIQUE,
    string_id INTEGER NOT NULL REFERENCES ss.strings(id),
    string_position INTEGER NOT NULL
);

CREATE TABLE ss.panels (
    id serial PRIMARY KEY,
    serial_number VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    monitor_id INTEGER NOT NULL UNIQUE REFERENCES ss.monitors(id),
    inverter_id INTEGER NOT NULL REFERENCES ss.inverters(id),
    equipment_id INTEGER NOT NULL REFERENCES ss.equipment(id)
);

CREATE TABLE ss.gateways (
    id serial PRIMARY KEY,
    mac_address VARCHAR(17) NOT NULL UNIQUE,
    ip_address VARCHAR(45) NOT NULL UNIQUE
);

CREATE TABLE ss.site_data (
    id serial PRIMARY KEY,
    integrator VARCHAR(12),
    owner VARCHAR(16),
    sitename VARCHAR(12) UNIQUE,
    location VARCHAR(32),
    version VARCHAR(8),
    timezone VARCHAR(32),
    json TEXT,
    sa_node_id VARCHAR(12)
);

CREATE TABLE ss.site_graph (
    id serial PRIMARY KEY,
    sitearray_id INTEGER REFERENCES ss.site_array(id),
    r_graph_id VARCHAR(12),
    json TEXT
);

-- INSERT TEST SITE (used by commissioning script)
INSERT INTO ss.site (integrator, owner, sitename)
VALUES ('Zoot', 'Mikol', 'TEST');
