-- DROP EXISTING TABLES
DROP TABLE IF EXISTS ss.site_graph CASCADE;
DROP TABLE IF EXISTS ss.panels CASCADE;
DROP TABLE IF EXISTS ss.monitors CASCADE;
DROP TABLE IF EXISTS ss.strings CASCADE;
DROP TABLE IF EXISTS ss.inverters CASCADE;
DROP TABLE IF EXISTS ss.gateways CASCADE;
DROP TABLE IF EXISTS ss.equipment CASCADE;
DROP TABLE IF EXISTS ss.site_array CASCADE;
DROP TABLE IF EXISTS ss.site CASCADE;

-- CREATE NEW TABLES
CREATE TABLE ss.site (
                         id serial PRIMARY KEY,
                         integrator VARCHAR(32),
                         owner VARCHAR(32),
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
                              manufacturer VARCHAR(255),
                              model VARCHAR(255)
);

CREATE TABLE ss.gateways (
                             id serial PRIMARY KEY,
                             equipment_id INTEGER REFERENCES ss.equipment(id),
                             site_array_id INTEGER NOT NULL REFERENCES ss.site_array(id),
                             mac_address VARCHAR(17) ,
                             ip_address VARCHAR(45) ,
                             label VARCHAR(32)
);

CREATE TABLE ss.inverters (
                              id serial PRIMARY KEY,
                              equipment_id INTEGER REFERENCES ss.equipment(id),
                              gateway_id INTEGER NOT NULL REFERENCES ss.gateways(id),
                              label VARCHAR(32)
);

CREATE TABLE ss.strings (
                            id serial PRIMARY KEY,
                            equipment_id INTEGER REFERENCES ss.equipment(id),
                            inverter_id INTEGER NOT NULL REFERENCES ss.inverters(id),
                            label VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE ss.monitors (
                             id serial PRIMARY KEY,
                             equipment_id INTEGER REFERENCES ss.equipment(id),
                             string_id INTEGER NOT NULL REFERENCES ss.strings(id),
                             mac_address VARCHAR(17) NOT NULL UNIQUE,
                             node_id VARCHAR(50) NOT NULL UNIQUE,
                             string_position INTEGER NOT NULL
);

CREATE TABLE ss.panels (
                           id serial PRIMARY KEY,
                           equipment_id INTEGER REFERENCES ss.equipment(id),
                           monitor_id INTEGER NOT NULL UNIQUE REFERENCES ss.monitors(id),
                           label VARCHAR(255) NOT NULL UNIQUE,
                           x INTEGER NOT NULL,
                           y INTEGER NOT NULL

);


CREATE TABLE ss.site_graph (
                               id serial PRIMARY KEY,
                               sitearray_id INTEGER REFERENCES ss.site_array(id),
                               r_graph_id VARCHAR(12),
                               json TEXT
);

