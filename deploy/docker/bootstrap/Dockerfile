FROM python:3.13-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client \
 && rm -rf /var/lib/apt/lists/*


RUN pip install --no-cache-dir psycopg[binary] redis fastapi uvicorn

# no code copied; wrapper mounts /scripts
CMD ["python", "-c", "print('bootstrap image ready')"]
