module.exports = {
  apps: [
    {
      name: "betrix-web",
      script: "./src/boot.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "betrix-worker",
      script: "./worker.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY || 2
      }
    }
  ]
};
