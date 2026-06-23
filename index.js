"use strict";

const buildApp = require("./app");
const { env } = require("./config/env");

const app = buildApp();

const server = app.listen(env.appPort, env.appHost, () => {
  console.log(`Bus Tracking API escuchando en http://${env.appHost}:${env.appPort}`);
});

function shutdown(signal) {
  console.log(`Recibida senal ${signal}, cerrando servidor...`);
  server.close(() => {
    console.log("Servidor cerrado correctamente.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = server;
