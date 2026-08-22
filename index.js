"use strict";

const buildApp = require("./app");
const { env } = require("./config/env");
const { createProximityWorker } = require("./tasks/proximityWorker");

const app = buildApp();

let proximityWorker = null;
if (env.enableProximityWorker) {
  proximityWorker = createProximityWorker();
  proximityWorker.start();
  console.log(
    `ProximityWorker activo (cada ${env.proximityWorkerIntervalSeconds}s)`,
  );
}

const server = app.listen(env.appPort, env.appHost, () => {
  console.log(`Bus Tracking API escuchando en http://${env.appHost}:${env.appPort}`);
});

function shutdown(signal) {
  console.log(`Recibida senal ${signal}, cerrando servidor...`);
  if (proximityWorker) {
    proximityWorker.stop();
  }
  server.close(() => {
    console.log("Servidor cerrado correctamente.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = server;
