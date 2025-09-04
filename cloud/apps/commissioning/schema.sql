
CREATE TABLE equipment (
    id SERIAL PRIMARY KEY,
    manufacturer VARCHAR(255) NOT NULL,
    model VARCHAR(255) NOT NULL
);


CREATE TABLE inverters (
    id SERIAL PRIMARY KEY,
    serial_number VARCHAR(255) UNIQUE NOT NULL,
    manufacturer_id INTEGER NOT NULL,
    FOREIGN KEY (manufacturer_id) REFERENCES equipment(id) ON DELETE CASCADE
);


CREATE TABLE strings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    inverter_id INTEGER NOT NULL,
    FOREIGN KEY (inverter_id) REFERENCES inverters(id) ON DELETE CASCADE
);


CREATE TABLE monitors (
    id SERIAL PRIMARY KEY,
    mac_address VARCHAR(17) UNIQUE NOT NULL,
    node_id VARCHAR(50) UNIQUE NOT NULL,
    string_id INTEGER NOT NULL,
    string_position INTEGER NOT NULL,
    FOREIGN KEY (string_id) REFERENCES strings(id) ON DELETE CASCADE
);


CREATE TABLE panels (
    id SERIAL PRIMARY KEY,
    serial_number VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    monitor_id INTEGER UNIQUE NOT NULL,
    inverter_id INTEGER NOT NULL,
    equipment_id INTEGER NOT NULL,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
    FOREIGN KEY (inverter_id) REFERENCES inverters(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);


CREATE TABLE gateways (
    id SERIAL PRIMARY KEY,
    mac_address VARCHAR(17) UNIQUE NOT NULL,
    ip_address VARCHAR(45) UNIQUE NOT NULL
);


CREATE TABLE real_time_data (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) REFERENCES monitors(node_id),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    voltage FLOAT,
    current FLOAT,
    power FLOAT
);


CREATE TABLE faults (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) REFERENCES monitors(node_id),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fault_type VARCHAR(50),
    description TEXT,
    resolved BOOLEAN DEFAULT FALSE
);


CREATE TABLE performance_history (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) REFERENCES monitors(node_id),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    voltage_avg FLOAT,
    current_avg FLOAT,
    power_avg FLOAT
);


CREATE TABLE command_log (
    id SERIAL PRIMARY KEY,
    command VARCHAR(100),
    issued_by VARCHAR(50),
    issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20)
);

