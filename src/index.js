

const PORT = process.env.PORT || process.env.RENDER_PORT || process.env.PORT || 3000;
if (typeof app !== "undefined" && app && app.listen) {
  app.listen(PORT, () => console.log(`SERVER: listening on port ${PORT}`));
} else if (typeof server !== "undefined" && server && server.listen) {
  server.listen(PORT, () => console.log(`SERVER: listening on port ${PORT}`));
}
