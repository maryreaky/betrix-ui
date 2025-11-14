FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV NODE_ENV=production
EXPOSE (process.env.PORT || (process.env.PORT || 10000))
CMD ["node","server.orig.js"]
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:(process.env.PORT || (process.env.PORT || 10000))/_health || exit 1
