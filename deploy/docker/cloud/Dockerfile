FROM python:3.13-slim

WORKDIR /cloud

# Install deps
COPY repo/cloud/requirements.txt /cloudrequirements.txt
RUN pip install --no-cache-dir -r /cloud/requirements.txt

# App code
COPY repo/cloud /cloud

# Deploy scripts live OUTSIDE the repo, so copy from deploy/
COPY deploy/scripts /deploy/scripts
RUN chmod +x /deploy/scripts/*.sh

ENV PYTHONPATH=/cloud

# default command overridden by compose for cloud-api / cloud-bootstrap
