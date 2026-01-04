FROM python:3.13-slim

WORKDIR /cloud

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1001 -s /usr/sbin/nologin appuser

# Install deps
COPY cloud/requirements.txt /cloud/requirements.txt
RUN pip install --no-cache-dir -r /cloud/requirements.txt

# App code
COPY cloud /cloud

# Deploy scripts
COPY deploy/scripts /deploy/scripts
RUN chmod +x /deploy/scripts/*.sh

ENV PYTHONPATH=/cloud

RUN chown -R appuser:appuser /cloud /deploy

USER appuser

ENTRYPOINT ["/usr/bin/tini","--"]
