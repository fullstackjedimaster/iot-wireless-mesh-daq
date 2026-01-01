FROM python:3.13-slim

WORKDIR /mesh

COPY repo/mesh/requirements.txt /mesh/requirements.txt
RUN pip install --no-cache-dir -r /mesh/requirements.txt

COPY repo/mesh /mesh

ENV PYTHONPATH=/mesh

# default command overridden by compose
