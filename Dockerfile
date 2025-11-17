FROM node:20-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node","server.orig.js"]
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1
