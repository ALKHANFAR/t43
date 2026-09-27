FROM node:22-alpine
WORKDIR /app
COPY . .
CMD ["node", "lab-server.mjs"]
