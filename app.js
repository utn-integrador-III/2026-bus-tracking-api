"use strict";

const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { env } = require("./config/env");
const { openapiDocument } = require("./config/openapi");
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

  app.get("/api/docs.json", (_req, res) => {
    res.status(200).json(openapiDocument);
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument, { explorer: true }));

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = buildApp;
