# docker/mesh/Dockerfile
FROM python:3.13-slim

WORKDIR /mesh

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/mesh

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1001 --shell /usr/sbin/nologin appuser

COPY --from=repo mesh/requirements.txt /mesh/requirements.txt

RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel \
    && python -m pip install --no-cache-dir -r /mesh/requirements.txt \
    && python -m pip uninstall -y redis || true \
    && python -m pip install --no-cache-dir --force-reinstall \
        "redis==4.5.5" \
        packaging \
    && python -c "import redis, sys; from packaging.version import Version; print('PY', sys.version); print('REDIS', redis.__version__, redis.__file__); assert Version(redis.__version__) >= Version('4.5.5'), 'redis-py too old'"

COPY --from=repo mesh/ /mesh/
COPY scripts/run-with-log.sh /usr/local/bin/run-with-log.sh

RUN sed -i 's/\r$//' /usr/local/bin/run-with-log.sh \
    && chmod 0755 /usr/local/bin/run-with-log.sh \
    && mkdir -p /logs \
    && chown -R appuser:appuser /mesh /logs

USER appuser

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "-u", "rundaq.py"]
