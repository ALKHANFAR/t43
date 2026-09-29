FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --omit=dev
ENV NODE_ENV=production
CMD ["node", "server.mjs"]
