"use strict";

function presentAdminTrip(row) {
  return {
    id: row.id,
    route_id: row.route_id,
    bus_id: row.bus_id,
    driver_id: row.driver_id,
    departure_time: row.departure_time,
    arrival_time: row.arrival_time,
    status: row.status,
    created_at: row.created_at,
    started_at: row.started_at,
    ended_at: row.ended_at,
  };
}

function presentAdminTrips(rows) {
  return rows.map(presentAdminTrip);
}

function presentConsumerTrip(row) {
  return {
    id: row.id,
    route_id: row.route_id,
    bus_id: row.bus_id,
    departure_time: row.departure_time,
    arrival_time: row.arrival_time,
    status: row.status,
  };
}

function presentConsumerTrips(rows) {
  return rows.map(presentConsumerTrip);
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

function reactivated() {
  return { reactivated: true };
}

module.exports = {
  presentAdminTrip,
  presentAdminTrips,
  presentConsumerTrip,
  presentConsumerTrips,
  created,
  updated,
  deleted,
  reactivated,
};
