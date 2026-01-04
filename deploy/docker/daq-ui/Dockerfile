# ---- build ----
FROM node:22-alpine AS build
WORKDIR /daq-ui

COPY daq-ui/package*.json ./
RUN npm ci

COPY daq-ui ./

# Fix common "next: Permission denied" when host mode bits are wrong
RUN chmod -R a+x node_modules/.bin || true

RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /daq-ui

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache tini

RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nextjs -G nodejs

COPY --from=build /daq-ui/package*.json ./
COPY --from=build /daq-ui/node_modules ./node_modules
COPY --from=build /daq-ui/.next ./.next
COPY --from=build /daq-ui/public ./public

RUN chown -R nextjs:nodejs /daq-ui

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/sbin/tini","--"]
CMD ["./node_modules/.bin/next","start","-p","3000"]
