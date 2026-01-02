FROM python:3.13-slim

WORKDIR /app

RUN pip install --no-cache-dir psycopg[binary] fastapi uvicorn

# no code copied; wrapper mounts /scripts
CMD ["python", "-c", "print('bootstrap image ready')"]
