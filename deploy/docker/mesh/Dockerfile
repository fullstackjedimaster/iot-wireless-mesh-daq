FROM python:3.13-slim

WORKDIR /app

# Good hygiene: latest pip, no surprises
RUN python -m pip install --upgrade pip setuptools wheel

# Copy requirements and install
COPY repo/mesh/requirements.txt ./requirements.txt

# Force-remove any preexisting redis and then install requirements
RUN python -m pip uninstall -y redis || true \
 && python -m pip install  -r requirements.txt \
 && python -m pip show redis \
 && python -c "import redis; print('REDIS_VERSION=', redis.__version__, 'FROM=', redis.__file__)"

# Copy app
COPY repo/mesh ./

ENV PYTHONPATH=/mesh
