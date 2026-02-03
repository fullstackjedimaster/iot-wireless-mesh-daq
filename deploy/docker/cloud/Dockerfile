# docker/cloud/Dockerfile
FROM python:3.13-slim

WORKDIR /cloud

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1001 -s /usr/sbin/nologin appuser

# Install deps from repo context
COPY --from=repo cloud/requirements.txt /cloud/requirements.txt
RUN pip install --no-cache-dir -r /cloud/requirements.txt

# Copy ONLY app code from repo context
COPY --from=repo cloud/ /cloud/

# Copy deploy scripts used by cloud-bootstrap from deploy context
COPY scripts/ /deploy/scripts/
RUN chmod +x /deploy/scripts/*.sh

ENV PYTHONPATH=/cloud

RUN chown -R appuser:appuser /cloud /deploy

USER appuser

ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["python","-c","print('cloud image ready')"]
