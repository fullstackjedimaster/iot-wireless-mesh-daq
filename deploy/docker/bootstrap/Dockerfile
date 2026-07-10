# docker/bootstrap/Dockerfile
FROM python:3.13-slim

WORKDIR /deploy

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        postgresql-client \
        redis-tools \
        tini; \
    rm -rf /var/lib/apt/lists/*; \
    command -v psql; \
    psql --version; \
    command -v pg_isready; \
    command -v redis-cli; \
    bash --version; \
    python -V

RUN useradd --create-home --uid 1001 --shell /usr/sbin/nologin appuser

RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel \
    && python -m pip install --no-cache-dir "psycopg[binary]" redis

COPY scripts/ /deploy/scripts/

RUN sed -i 's/\r$//' /deploy/scripts/*.sh \
    && chmod 0755 /deploy/scripts/*.sh \
    && chown -R appuser:appuser /deploy

USER appuser

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-c", "print('bootstrap image ready')"]
