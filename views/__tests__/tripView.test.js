"use strict";

const tripView = require("../tripView");

const row = {
  id: "uuid-1",
  route_id: "uuid-r",
  bus_id: "uuid-b",
  driver_id: "uuid-d",
  departure_time: "2026-06-21T08:00:00.000Z",
  arrival_time: "2026-06-21T10:00:00.000Z",
  status: "Scheduled",
  created_at: "2026-06-20T12:00:00.000Z",
  started_at: null,
  ended_at: null,
};

describe("presentAdminTrip", () => {
  test("expone todos los campos administrativos", () => {
    expect(tripView.presentAdminTrip(row)).toEqual({
      id: "uuid-1",
      route_id: "uuid-r",
      bus_id: "uuid-b",
      driver_id: "uuid-d",
      departure_time: "2026-06-21T08:00:00.000Z",
      arrival_time: "2026-06-21T10:00:00.000Z",
      status: "Scheduled",
      created_at: "2026-06-20T12:00:00.000Z",
      started_at: null,
      ended_at: null,
    });
  });
});

describe("presentConsumerTrip", () => {
  test("no expone driver_id ni campos de auditoria", () => {
    const out = tripView.presentConsumerTrip(row);
    expect(out).not.toHaveProperty("driver_id");
    expect(out).not.toHaveProperty("created_at");
    expect(out).not.toHaveProperty("started_at");
    expect(out).not.toHaveProperty("ended_at");
  });

  test("expone los campos visibles para el consumidor", () => {
    expect(tripView.presentConsumerTrip(row)).toEqual({
      id: "uuid-1",
      route_id: "uuid-r",
      bus_id: "uuid-b",
      departure_time: "2026-06-21T08:00:00.000Z",
      arrival_time: "2026-06-21T10:00:00.000Z",
      status: "Scheduled",
    });
  });
});

describe("envelopes de mutacion", () => {
  test("created devuelve solo el id", () => {
    expect(tripView.created(row)).toEqual({ id: "uuid-1" });
  });

  test("updated devuelve updated true", () => {
    expect(tripView.updated()).toEqual({ updated: true });
  });

  test("deleted devuelve deleted true", () => {
    expect(tripView.deleted()).toEqual({ deleted: true });
  });

  test("reactivated devuelve reactivated true", () => {
    expect(tripView.reactivated()).toEqual({ reactivated: true });
  });
});
