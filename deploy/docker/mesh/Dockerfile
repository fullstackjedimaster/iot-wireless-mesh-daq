# docker/mesh/Dockerfile
FROM python:3.13-slim

WORKDIR /mesh

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1001 -s /usr/sbin/nologin appuser

# Install deps FIRST for caching, from the repo context
COPY --from=repo mesh/requirements.txt /mesh/requirements.txt
RUN pip install --no-cache-dir -r /mesh/requirements.txt

# Force known-good redis for Python 3.13+
RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel \
 && python -m pip uninstall -y redis || true \
 && python -m pip install --no-cache-dir --force-reinstall "redis==4.5.5" packaging \
 && python -c "import redis,sys; from packaging.version import Version; print('PY',sys.version); print('REDIS',redis.__version__,redis.__file__); assert Version(redis.__version__)>=Version('4.5.5'), 'redis-py too old'"

# Copy ONLY the mesh app code from the repo context
COPY --from=repo mesh/ /mesh/

ENV PYTHONPATH=/mesh

RUN chown -R appuser:appuser /mesh

USER appuser

ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["python","-u","rundaq.py"]
