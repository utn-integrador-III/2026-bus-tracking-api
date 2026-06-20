"use strict";

const express = require("express");
const cors = require("cors");
const { env } = require("./config/env");
const apiRouter = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

function buildApp() {
  const app = express();

  app.disable("x-powered-by");

  const corsOptions =
    env.corsOrigins.length > 0 ? { origin: env.corsOrigins } : {};
  app.use(cors(corsOptions));

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = buildApp;
