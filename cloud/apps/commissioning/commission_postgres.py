import json
from datetime import date
from util.config import get_postgres_conn, load_config

pg = get_postgres_conn()
cur = pg.cursor()

# Clear old data
cur.execute("DELETE FROM ss.site_graph")
cur.execute("DELETE FROM ss.panels")
cur.execute("DELETE FROM ss.monitors")
cur.execute("DELETE FROM ss.strings")
cur.execute("DELETE FROM ss.inverters")
cur.execute("DELETE FROM ss.gateways")
cur.execute("DELETE FROM ss.site_array")
cur.execute("DELETE FROM ss.site")

# Create site
cur.execute("INSERT INTO ss.site (sitename) VALUES (%s) RETURNING id", ('TEST',))
site_id = cur.fetchone()[0]

# Create site array
cur.execute(
    "INSERT INTO ss.site_array (site_id, label, timezone, commission_date) "
    "VALUES (%s, %s, %s, %s) RETURNING id",
    (site_id, 'Site Array TEST', 'America/Chicago', date.today())
)
site_array_id = cur.fetchone()[0]

# Create gateway
cur.execute(
    "INSERT INTO ss.gateways (site_array_id, mac_address, ip_address, name) "
    "VALUES (%s, %s, %s, %s) RETURNING id",
    (site_array_id, 'aa:bb:cc:dd:ee:ff', '192.168.1.1', 'GW-1')
)
gateway_id = cur.fetchone()[0]

# Create inverter
cur.execute(
    "INSERT INTO ss.inverters (gateway_id, name) VALUES (%s, %s) RETURNING id",
    (gateway_id, 'INV-1')
)
inverter_id = cur.fetchone()[0]

# Create string
cur.execute(
    "INSERT INTO ss.strings (inverter_id, name) VALUES (%s, %s) RETURNING id",
    (inverter_id, "S-1")
)
string_id = cur.fetchone()[0]

# Add monitors
monitors = [
    (string_id, "fa:29:eb:6d:87:01", "M-000001", 1),
    (string_id, "fa:29:eb:6d:87:02", "M-000002", 2),
    (string_id, "fa:29:eb:6d:87:03", "M-000003", 3),
    (string_id, "fa:29:eb:6d:87:04", "M-000004", 4),
]
cur.executemany(
    "INSERT INTO ss.monitors (string_id, mac_address, node_id, string_position) VALUES (%s, %s, %s, %s)",
    monitors
)

# Get monitor IDs
cur.execute(
    "SELECT id FROM ss.monitors WHERE string_id = %s ORDER BY string_position",
    (string_id,)
)
monitor_ids = [row[0] for row in cur.fetchall()]

# Add panels
panels = []
x, y = 50, 50
for i, monitor_id in enumerate(monitor_ids, start=1):
    label = f"PNL-{i:06d}"
    panels.append((monitor_id, label, x, y))
    x += 50
    y += 50

cur.executemany(
    "INSERT INTO ss.panels (monitor_id, label, x, y) VALUES (%s, %s, %s, %s)",
    panels
)

# Prepare panel + monitor combined input nodes
panel_nodes = []
for i, (string_id, mac, node_id, string_position) in enumerate(monitors):
    monitor_id, panel_label, x, y = panels[i]
    panel_nodes.append({
        "id": f"P-{monitor_id:06d}",
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
        "id": f"SA-{site_array_id:06d}",
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

cur.execute(
    "INSERT INTO ss.site_graph (sitearray_id, json) VALUES (%s, %s)",
    (site_array_id, json.dumps(site_graph))
)

pg.commit()
cur.close()
pg.close()
print("Commissioning complete.")
