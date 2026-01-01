# MeshDAQ – Docker Deployment Wrapper

This repository contains **deployment-only artifacts** for the
iot-wireless-mesh-daq platform.

## What lives here
- Docker Compose stack
- Dockerfiles
- Bootstrap & seeding scripts
- Health-gating services

## What does NOT live here
- Application source code
- Runtime data volumes

## Expected host layout

/opt/stacks/iot-wireless-mesh-daq/
  repo/     # git clone of source repo
  deploy/   # this repo
  data/     # persistent volumes (NOT in git)

## Bring-up

docker compose up -d --build
