"use strict";

const express = require("express");
const { ROLES } = require("../../../constants/roles");
const { statusFromActive } = require("../../../constants/routeStatus");
const { HTTP_STATUS } = require("../../../constants/httpStatus");
const { ERROR_CODES } = require("../../../constants/errorCodes");
const AppError = require("../../../utils/AppError");
const asyncHandler = require("../../../utils/asyncHandler");
const validate = require("../../../middleware/validate");
const requireAuth = require("../../../middleware/requireAuth");
const requireRole = require("../../../middleware/requireRole");
const {
  createRouteSchema,
  updateRouteSchema,
  idParamSchema,
} = require("../../../models/routeSchema");
const SupabaseRouteRepository = require("./infrastructure/SupabaseRouteRepository");
const routesRepository = require("../../../repositories/routesRepository");

class RouteRepository {
  async listRoutes(_query) {
    throw new Error("RouteRepository.listRoutes must be implemented.");
  }

  async getRouteById(_id) {
    throw new Error("RouteRepository.getRouteById must be implemented.");
  }

  async createRoute(_payload) {
    throw new Error("RouteRepository.createRoute must be implemented.");
  }

  async updateRoute(_id, _payload) {
    throw new Error("RouteRepository.updateRoute must be implemented.");
  }

  async setRouteActive(_id, _isActive) {
    throw new Error("RouteRepository.setRouteActive must be implemented.");
  }
}

class RoutePresenter {
  presentAdminRoute(row) {
    return {
      id: row.id,
      name: row.name,
      origin: row.origin,
      destination: row.destination,
      geometry_geojson: row.geometry_geojson,
      is_active: row.is_active,
      created_at: row.created_at,
    };
  }

  presentAdminRoutes(rows) {
    return rows.map((row) => this.presentAdminRoute(row));
  }

  presentConsumerRoute(row) {
    return {
      id: row.id,
      name: row.name,
      origin: row.origin,
      destination: row.destination,
      status: statusFromActive(row.is_active),
      geometry_geojson: row.geometry_geojson,
    };
  }

  presentConsumerRoutes(rows) {
    return rows.map((row) => this.presentConsumerRoute(row));
  }

  created(row) {
    return { id: row.id };
  }

  updated() {
    return { updated: true };
  }

  deleted() {
    return { deleted: true };
  }

  reactivated() {
    return { reactivated: true };
  }
}

class RouteService {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
  }

  notFound() {
    return new AppError(
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODES.ROUTE_NOT_FOUND,
      "La ruta solicitada no existe.",
    );
  }

  async listAll() {
    return this.routeRepository.listRoutes({ includeInactive: true });
  }

  async listActive() {
    return this.routeRepository.listRoutes({ includeInactive: false });
  }

  async getById(id) {
    const existing = await this.routeRepository.getRouteById(id);
    if (!existing) {
      throw this.notFound();
    }
    return existing;
  }

  async create(payload) {
    return this.routeRepository.createRoute({
      name: payload.name,
      origin: payload.origin,
      destination: payload.destination,
      geometry_geojson: payload.geometry_geojson,
    });
  }

  async update(id, payload) {
    const existing = await this.routeRepository.getRouteById(id);
    if (!existing) {
      throw this.notFound();
    }

    const patch = {};
    if (payload.name !== undefined) {
      patch.name = payload.name;
    }
    if (payload.origin !== undefined) {
      patch.origin = payload.origin;
    }
    if (payload.destination !== undefined) {
      patch.destination = payload.destination;
    }
    if (payload.geometry_geojson !== undefined) {
      patch.geometry_geojson = payload.geometry_geojson;
    }

    const updated = await this.routeRepository.updateRoute(id, patch);
    if (!updated) {
      throw this.notFound();
    }
    return updated;
  }

  async deactivate(id) {
    const existing = await this.routeRepository.getRouteById(id);
    if (!existing) {
      throw this.notFound();
    }
    return this.routeRepository.setRouteActive(id, false);
  }

  async reactivate(id) {
    const existing = await this.routeRepository.getRouteById(id);
    if (!existing) {
      throw this.notFound();
    }
    return this.routeRepository.setRouteActive(id, true);
  }
}

class RouteController {
  constructor(routeService, routePresenter) {
    this.routeService = routeService;
    this.routePresenter = routePresenter;
    this.listAdminRoutes = asyncHandler(this.listAdminRoutes.bind(this));
    this.getRoute = asyncHandler(this.getRoute.bind(this));
    this.createRoute = asyncHandler(this.createRoute.bind(this));
    this.updateRoute = asyncHandler(this.updateRoute.bind(this));
    this.deactivateRoute = asyncHandler(this.deactivateRoute.bind(this));
    this.reactivateRoute = asyncHandler(this.reactivateRoute.bind(this));
    this.listConsumerRoutes = asyncHandler(this.listConsumerRoutes.bind(this));
  }

  async listAdminRoutes(_req, res) {
    const rows = await this.routeService.listAll();
    res.status(HTTP_STATUS.OK).json(this.routePresenter.presentAdminRoutes(rows));
  }

  async getRoute(req, res) {
    const row = await this.routeService.getById(req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(this.routePresenter.presentAdminRoute(row));
  }

  async createRoute(req, res) {
    const row = await this.routeService.create(req.valid.body);
    res.status(HTTP_STATUS.CREATED).json(this.routePresenter.created(row));
  }

  async updateRoute(req, res) {
    await this.routeService.update(req.valid.params.id, req.valid.body);
    res.status(HTTP_STATUS.OK).json(this.routePresenter.updated());
  }

  async deactivateRoute(req, res) {
    await this.routeService.deactivate(req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(this.routePresenter.deleted());
  }

  async reactivateRoute(req, res) {
    await this.routeService.reactivate(req.valid.params.id);
    res.status(HTTP_STATUS.OK).json(this.routePresenter.reactivated());
  }

  async listConsumerRoutes(_req, res) {
    const rows = await this.routeService.listActive();
    res.status(HTTP_STATUS.OK).json(this.routePresenter.presentConsumerRoutes(rows));
  }
}

function createRouteModule(dependencies = {}) {
  const routeRepository =
    dependencies.routeRepository ||
    (dependencies.useConcreteRepository ? new SupabaseRouteRepository() : routesRepository);
  const routePresenter = dependencies.routePresenter || new RoutePresenter();
  const routeService = dependencies.routeService || new RouteService(routeRepository);
  const routeController = dependencies.routeController || new RouteController(routeService, routePresenter);

  return {
    routeRepository,
    routePresenter,
    routeService,
    routeController,
  };
}

function createAdminRoutesRouter(dependencies = {}) {
  const { routeController } = createRouteModule(dependencies);
  const router = express.Router();

  router.use(requireAuth, requireRole(ROLES.ADMIN));

  router.get("/", routeController.listAdminRoutes);
  router.post("/", validate({ body: createRouteSchema }), routeController.createRoute);
  router.get("/:id", validate({ params: idParamSchema }), routeController.getRoute);
  router.put(
    "/:id",
    validate({ params: idParamSchema, body: updateRouteSchema }),
    routeController.updateRoute,
  );
  router.delete("/:id", validate({ params: idParamSchema }), routeController.deactivateRoute);
  router.post(
    "/:id/reactivate",
    validate({ params: idParamSchema }),
    routeController.reactivateRoute,
  );

  return router;
}

function createConsumerRoutesRouter(dependencies = {}) {
  const { routeController } = createRouteModule(dependencies);
  const router = express.Router();

  router.use(requireAuth);
  router.get("/", routeController.listConsumerRoutes);

  return router;
}

module.exports = {
  RouteRepository,
  SupabaseRouteRepository,
  RoutePresenter,
  RouteService,
  RouteController,
  createRouteModule,
  createAdminRoutesRouter,
  createConsumerRoutesRouter,
};