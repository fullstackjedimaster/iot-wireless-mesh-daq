# docker/daq-ui/Dockerfile

FROM node:22-alpine AS build
WORKDIR /daq-ui

COPY --from=repo daq-ui/package*.json ./
RUN npm ci

COPY --from=repo daq-ui/ ./


RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /daq-ui

ENV NODE_ENV=production \
    PORT=3000

RUN apk add --no-cache tini \
    && addgroup --gid 1001 --system nodejs \
    && adduser --uid 1001 --system nextjs --ingroup nodejs

COPY --from=build /daq-ui/package*.json ./
COPY --from=build /daq-ui/node_modules ./node_modules
COPY --from=build /daq-ui/.next ./.next
COPY --from=build /daq-ui/public ./public

RUN chown -R nextjs:nodejs /daq-ui

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
