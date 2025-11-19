FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --production
# Let Render use Docker Command (node src/worker.js)
