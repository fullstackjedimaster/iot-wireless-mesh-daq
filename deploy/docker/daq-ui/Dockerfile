FROM node:22

WORKDIR /app

COPY repo/daq-ui/package*.json ./
RUN npm ci

COPY repo/daq-ui ./

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]
