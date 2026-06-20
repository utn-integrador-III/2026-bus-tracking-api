"use strict";

const { statusFromActive } = require("../constants/routeStatus");

function presentAdminRoute(row) {
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

function presentAdminRoutes(rows) {
  return rows.map(presentAdminRoute);
}

function presentConsumerRoute(row) {
  return {
    id: row.id,
    name: row.name,
    origin: row.origin,
    destination: row.destination,
    status: statusFromActive(row.is_active),
    geometry_geojson: row.geometry_geojson,
  };
}

function presentConsumerRoutes(rows) {
  return rows.map(presentConsumerRoute);
}

function created(row) {
  return { id: row.id };
}

function updated() {
  return { updated: true };
}

function deleted() {
  return { deleted: true };
}

module.exports = {
  presentAdminRoute,
  presentAdminRoutes,
  presentConsumerRoute,
  presentConsumerRoutes,
  created,
  updated,
  deleted,
};
