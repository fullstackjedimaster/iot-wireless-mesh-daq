import psycopg2
import json

conn = psycopg2.connect(
    dbname="ss",
    user="pmikol",
    password="LeartPee1138?",
    host="localhost",
    port="5432"
)
cur = conn.cursor()

cur.execute("SELECT json FROM ss.site_graph WHERE id = 1")  # Or use WHERE sitearray_id = ...
site_graph_json = cur.fetchone()[0]

with open("site_graph_TEST.json", "w") as f:
    f.write(site_graph_json)

cur.close()
conn.close()
print("site_graph_TEST.json written.")
