# deploy/docker/daq-ui/Dockerfile
FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /daq-ui

# Copy package manifests first for caching
COPY repo/daq-ui/package*.json ./
# If you use pnpm/yarn, swap accordingly
RUN npm ci

# Copy the rest of the app
COPY repo/daq-ui/ ./

# Build
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
