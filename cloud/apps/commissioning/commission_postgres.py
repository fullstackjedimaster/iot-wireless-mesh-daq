import json
from datetime import date
from util.config import  (get_postgres_conn, load_config)

pg = get_postgres_conn()
cur = pg.cursor()

# Clear old data
cur.execute("DELETE FROM ss.site_graph")
cur.execute("DELETE FROM ss.monitors")
cur.execute("DELETE FROM ss.panels")
cur.execute("DELETE FROM ss.strings")
cur.execute("DELETE FROM ss.inverters")
cur.execute("DELETE FROM ss.gateways")
cur.execute("DELETE FROM ss.site_array")
cur.execute("DELETE FROM ss.site")

# Create site
cur.execute("INSERT INTO ss.site (sitename) VALUES (%s) RETURNING id", ('TEST',))
site_id = cur.fetchone()[0]

# Create site array
cur.execute("INSERT INTO ss.site_array (site_id, label, timezone, commission_date) VALUES (%s, %s, %s, %s) RETURNING id",
            (site_id, 'Site Array TEST', 'America/Chicago', date.today()))
sitearray_id = cur.fetchone()[0]

# Create gateway
cur.execute("INSERT INTO ss.gateways (label, mac_address, ip_address) VALUES (%s,  %s, %s) RETURNING id",
            ('Gateway 1', 'aa:bb:cc:dd:ee:ff', '192.168.1.1'))
gateway_id = cur.fetchone()[0]

# Create inverter
cur.execute("INSERT INTO ss.inverters (serial_number, label, gateway_id) VALUES (%s, %s, %s) RETURNING id",
            ('INV-7281-9321', 'Inverter 1', gateway_id))
inverter_id = cur.fetchone()[0]

# Create string
cur.execute("INSERT INTO ss.strings (label, inverter_id) VALUES (%s, %s) RETURNING id", ('String 1', inverter_id))
string_id = cur.fetchone()[0]


# Create 4 panels
panels = [
    ('PNL-1-SN', 'PNL-1', string_id, 0, 50, 50),
    ('PNL-2-SN', 'PNL-2', string_id, 1, 150, 50),
    ('PNL-3-SN', 'PNL-3', string_id, 2, 50, 120),
    ('PNL-4-SN', 'PNL-4', string_id, 3, 150, 120)
]
cur.executemany(
    "INSERT INTO ss.panels (serial_number, label, string_id, string_position, x, y) VALUES (%s, %s, %s, %s, %s, %s)",
    [(sn, label, string_id, pos, x, y) for sn, label, string_id, pos, x, y in panels]
)
cur.execute("SELECT id FROM ss.panels WHERE string_id = %s ORDER BY string_position", (string_id,))
panel_ids = [row[0] for row in cur.fetchall()]

# Add monitors
monitors = [
    ('fa:29:eb:6d:87:01', 'Monitor 1', 'M-000001', panel_ids[0]),
    ('fa:29:eb:6d:87:02', 'Monitor 2','M-000002', panel_ids[1]),
    ('fa:29:eb:6d:87:03', 'Monitor 3','M-000003', panel_ids[2]),
    ('fa:29:eb:6d:87:04', 'Monitor 4','M-000004', panel_ids[3])
]
cur.executemany(
    "INSERT INTO ss.monitors (mac_address, label, node_id, panel_id) VALUES (%s, %s, %s, %s)",
    monitors
)

# Prepare panel + monitor combined input nodes
panel_nodes = []
for i, (mac, label, node_id, panel_id) in enumerate(monitors):
    pnl = panels[i]
    panel_label = pnl[1]
    x = pnl[4]
    y = pnl[5]
    panel_nodes.append({
        "id": f"P-{panel_id:06d}",
        "devtype": "P",
        "label": panel_label,
        "x": x,
        "y": y,
        "inputs": [{
            "id": node_id,
            "devtype": "SPM",
            "macaddr": mac
        }]
    })

site_graph = {
    "sitearray": {
        "id": f"SA-{sitearray_id:06d}",
        "devtype": "SA",
        "label": "Site Array TEST",
        "timezone": "America/Chicago",    
        "inputs": [{
            "id": f"I-{inverter_id:06d}",
            "devtype": "I",
            "label": "Inverter 1",
            "serial": "INV-7281-9321",
            "inputs": [{
                "id": f"S-{string_id:06d}",
                "devtype": "S",
                "label": "String 1",
                "inputs": panel_nodes
            }]
        }]
    }
}

cur.execute("INSERT INTO ss.site_graph (sitearray_id, json) VALUES (%s, %s)", (sitearray_id, json.dumps(site_graph)))

pg.commit()
cur.close()
pg.close()
print("Commissioning complete.")
