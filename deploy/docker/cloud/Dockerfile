FROM python:3.13-slim

# We run bootstrap via: bash -lc "...", so bash must exist.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     bash \
     ca-certificates \
     curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies
COPY repo/cloud/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# App code
COPY repo/cloud /app/app

# Deploy scripts (bootstrap, etc)
COPY deploy/scripts /deploy/scripts
RUN chmod +x /deploy/scripts/*.sh

# Make sure imports match your proven runtime layout:
# /app/app/main.py, and uvicorn runs "app.main:app"
ENV PYTHONPATH=/app

EXPOSE 8000
