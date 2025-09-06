# IoT Wireless Mesh DAQ: cloud

This service provides the FastAPI interface and real-time data viewer using Redis and PostgreSQL.

## Features

- FastAPI backend
- Real-time panel status endpoints
- Jinja2 templates + SVG map UI
- Fault injection API

## Railway Deployment

```bash
railway init
railway up
```

Start command: `python3 run_cloud.py`
