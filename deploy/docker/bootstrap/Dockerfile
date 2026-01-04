FROM python:3.12-bookworm

WORKDIR /cloud

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends postgresql-client; \
    rm -rf /var/lib/apt/lists/*; \
    command -v psql; \
    psql --version; \
    python -V

RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel
RUN python -m pip install --no-cache-dir "psycopg[binary]" redis fastapi uvicorn

# ADD THESE:
COPY deploy/scripts /deploy/scripts
RUN chmod +x /deploy/scripts/*.sh

CMD ["python", "-c", "print('bootstrap image ready')"]
