FROM python:3.13-slim

WORKDIR /app

# Install deps
COPY repo/cloud/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# App code
COPY repo/cloud /app/app

# Deploy scripts live OUTSIDE the repo, so copy from deploy/
COPY deploy/scripts /deploy/scripts
RUN chmod +x /deploy/scripts/*.sh

ENV PYTHONPATH=/app

# default command overridden by compose for cloud-api / cloud-bootstrap
