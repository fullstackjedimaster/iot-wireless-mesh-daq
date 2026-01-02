FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Keep mesh app in /mesh inside the container
WORKDIR /mesh

# Copy requirements first (better cache behavior)
COPY repo/mesh/requirements.txt /mesh/requirements.txt

# Install ALL deps, then force-correct redis, then verify
RUN python -m pip install --upgrade pip setuptools wheel \
 && python -m pip install --no-cache-dir -r /mesh/requirements.txt \
 && python -m pip uninstall -y redis || true \
 && python -m pip install --no-cache-dir --force-reinstall "redis==4.5.5" \
 && python -c "import redis; print('redis', redis.__version__, redis.__file__)" \
 && python -c "import sys; print('python', sys.version)"

# Copy the mesh app code
COPY repo/mesh /mesh

# Ensure imports resolve from the app root
ENV PYTHONPATH=/mesh

CMD ["python", "rundaq.py"]
