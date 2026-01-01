FROM python:3.13-slim

# ---- OS deps (psql client + build essentials for psycopg2/cryptography if needed)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     postgresql-client \
     ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY repo/cloud/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY repo/cloud /app/app

# scripts get copied into the image so cloud-bootstrap can run them
COPY deploy/scripts /deploy/scripts
RUN chmod +x /deploy/scripts/*.sh

EXPOSE 8000
