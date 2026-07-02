"use strict";

jest.mock("../../repositories/tripsRepository");

const tripsRepository = require("../../repositories/tripsRepository");
const tripsService = require("../tripsService");
const { CONSUMER_VISIBLE_STATUSES } = require("../../constants/tripStatus");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("listAll / listVisible", () => {
  test("listAll pide todos los estados", async () => {
    tripsRepository.listTrips.mockResolvedValue([]);
    await tripsService.listAll();
    expect(tripsRepository.listTrips).toHaveBeenCalledWith({});
  });

  test("listVisible filtra por los estados visibles para el consumidor", async () => {
    tripsRepository.listTrips.mockResolvedValue([]);
    await tripsService.listVisible();
    expect(tripsRepository.listTrips).toHaveBeenCalledWith({
      statuses: CONSUMER_VISIBLE_STATUSES,
    });
  });
});

describe("getById", () => {
  test("lanza 404 cuando el viaje no existe", async () => {
    tripsRepository.getTripById.mockResolvedValue(null);
    await expect(tripsService.getById("id")).rejects.toMatchObject({
      statusCode: 404,
      code: "TRIP_NOT_FOUND",
    });
  });

  test("devuelve la fila cuando existe", async () => {
    tripsRepository.getTripById.mockResolvedValue({ id: "id" });
    await expect(tripsService.getById("id")).resolves.toEqual({ id: "id" });
  });
});

describe("create", () => {
  test("envia solo los campos permitidos al repositorio", async () => {
    tripsRepository.createTrip.mockResolvedValue({ id: "x" });
    await tripsService.create({
      route_id: "r",
      bus_id: "b",
      driver_id: "d",
      departure_time: "2026-06-21T08:00:00Z",
      hacker: true,
    });
    expect(tripsRepository.createTrip).toHaveBeenCalledWith({
      route_id: "r",
      bus_id: "b",
      driver_id: "d",
      departure_time: "2026-06-21T08:00:00Z",
    });
  });

  test("incluye arrival_time y status solo si vienen", async () => {
    tripsRepository.createTrip.mockResolvedValue({ id: "x" });
    await tripsService.create({
      route_id: "r",
      bus_id: "b",
      driver_id: "d",
      departure_time: "2026-06-21T08:00:00Z",
      arrival_time: "2026-06-21T10:00:00Z",
      status: "Pending",
    });
    expect(tripsRepository.createTrip).toHaveBeenCalledWith({
      route_id: "r",
      bus_id: "b",
      driver_id: "d",
      departure_time: "2026-06-21T08:00:00Z",
      arrival_time: "2026-06-21T10:00:00Z",
      status: "Pending",
    });
  });
});

describe("update", () => {
  test("lanza 404 cuando el viaje no existe", async () => {
    tripsRepository.getTripById.mockResolvedValue(null);
    await expect(tripsService.update("id", { status: "Delayed" })).rejects.toMatchObject({
      statusCode: 404,
      code: "TRIP_NOT_FOUND",
    });
    expect(tripsRepository.updateTrip).not.toHaveBeenCalled();
  });

  test("solo aplica los campos presentes", async () => {
    tripsRepository.getTripById.mockResolvedValue({ id: "id" });
    tripsRepository.updateTrip.mockResolvedValue({ id: "id" });
    await tripsService.update("id", { status: "Delayed" });
    expect(tripsRepository.updateTrip).toHaveBeenCalledWith("id", { status: "Delayed" });
  });
});

describe("deactivate / reactivate", () => {
  test("deactivate marca Cancelled", async () => {
    tripsRepository.getTripById.mockResolvedValue({ id: "id" });
    tripsRepository.setTripStatus.mockResolvedValue({ id: "id" });
    await tripsService.deactivate("id");
    expect(tripsRepository.setTripStatus).toHaveBeenCalledWith("id", "Cancelled");
  });

  test("reactivate marca Scheduled", async () => {
    tripsRepository.getTripById.mockResolvedValue({ id: "id" });
    tripsRepository.setTripStatus.mockResolvedValue({ id: "id" });
    await tripsService.reactivate("id");
    expect(tripsRepository.setTripStatus).toHaveBeenCalledWith("id", "Scheduled");
  });

  test("reactivate lanza 404 si no existe", async () => {
    tripsRepository.getTripById.mockResolvedValue(null);
    await expect(tripsService.reactivate("id")).rejects.toMatchObject({
      statusCode: 404,
      code: "TRIP_NOT_FOUND",
    });
    expect(tripsRepository.setTripStatus).not.toHaveBeenCalled();
  });
});
