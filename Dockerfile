FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --production
# No CMD/ENTRYPOINT here — Render will use Docker Command
