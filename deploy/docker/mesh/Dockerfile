  GNU nano 7.2                                                                   Dockerfile                                                                             
# deploy/docker/mesh/Dockerfile
FROM python:3.13-slim

WORKDIR /mesh

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# tini for PID1 process reaping
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*

# non-root user
RUN useradd -m -u 1001 -s /usr/sbin/nologin appuser

COPY mesh/requirements.txt /mesh/requirements.txt
RUN pip install --no-cache-dir -r /mesh/requirements.txt

COPY mesh /mesh

ENV PYTHONPATH=/mesh

# ensure app is readable by non-root
RUN chown -R appuser:appuser /mesh

USER appuser

ENTRYPOINT ["/usr/bin/tini","--"]
