# docker/cloud/Dockerfile
FROM python:3.13-slim

WORKDIR /cloud

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/cloud

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1001 --shell /usr/sbin/nologin appuser

COPY --from=repo cloud/requirements.txt /cloud/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel \
    && python -m pip install --no-cache-dir -r /cloud/requirements.txt

COPY --from=repo cloud/ /cloud/
COPY scripts/run-with-log.sh /usr/local/bin/run-with-log.sh

RUN sed -i 's/\r$//' /usr/local/bin/run-with-log.sh \
    && chmod 0755 /usr/local/bin/run-with-log.sh \
    && mkdir -p /logs \
    && chown -R appuser:appuser /cloud /logs

USER appuser

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-c", "print('cloud image ready')"]
