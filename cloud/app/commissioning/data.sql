-- 🚀 Insert Sample Data for Solar Array Monitoring

-- Insert Equipment Manufacturer
INSERT INTO equipment (manufacturer, model)
VALUES ('SolarMax', 'SMX-4000');

-- Insert Inverter
INSERT INTO inverters (serial_number, manufacturer_id)
VALUES ('INV-001', 1);

-- Insert Strings
INSERT INTO strings (name, inverter_id)
VALUES ('S1', 1);

-- Insert Monitors
INSERT INTO monitors (mac_address, node_id, string_id, string_position) VALUES
('00:1A:C2:7B:00:01', 'O1', 1, 1),
('00:1A:C2:7B:00:02', 'O2', 1, 2),
('00:1A:C2:7B:00:03', 'O3', 1, 3),
('00:1A:C2:7B:00:04', 'O4', 1, 4);

-- Insert Panels
INSERT INTO panels (serial_number, name, monitor_id, inverter_id, equipment_id) VALUES
('PANEL-001', 'P1-O1-S1-INV1', 1, 1, 1),
('PANEL-002', 'P1-O2-S1-INV1', 2, 1, 1),
('PANEL-003', 'P1-O3-S1-INV1', 3, 1, 1),
('PANEL-004', 'P1-O4-S1-INV1', 4, 1, 1);

-- Insert Gateway
INSERT INTO gateways (mac_address, ip_address)
VALUES ('00:1A:C2:7B:FF:FF', '192.168.1.100');

-- Insert Sample Real-Time Data
INSERT INTO real_time_data (node_id, voltage, current, power) VALUES
('O1', 38.5, 5.2, 200.2),
('O2', 37.8, 5.3, 199.5),
('O3', 38.2, 5.4, 205.0),
('O4', 37.5, 5.1, 190.1);

-- Insert Sample Faults
INSERT INTO faults (node_id, fault_type, description) VALUES
('O1', 'Low Voltage', 'Voltage dropped below 35V'),
('O3', 'Overcurrent', 'Current exceeded 6A threshold');

-- Insert Sample Performance History
INSERT INTO performance_history (node_id, voltage_avg, current_avg, power_avg) VALUES
('O1', 38.4, 5.2, 200.5),
('O2', 38.3, 5.3, 202.0),
('O3', 38.2, 5.4, 205.1),
('O4', 38.1, 5.1, 198.7);

-- Insert Command Log Entries
INSERT INTO command_log (command, issued_by, status) VALUES
('Calibrate Monitors', 'admin', 'completed'),
('Reboot Inverter', 'admin', 'pending');

