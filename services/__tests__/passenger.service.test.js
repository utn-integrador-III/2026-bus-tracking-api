"use strict";

jest.mock("../../repositories/incidentsRepository", () => ({
  createPassengerIncident: jest.fn(),
  findIncidentsByTripId: jest.fn(),
}));

const passengerService = require("../passenger.service");
const incidentsRepository = require("../../repositories/incidentsRepository");

const validTripId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("passenger.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createPassengerIncident", () => {
    test("creates a passenger incident successfully", async () => {
      incidentsRepository.createPassengerIncident.mockResolvedValue({
        id: "incident-1",
        trip_id: validTripId,
        type: "traffic",
        description: "Traffic jam near the main stop.",
        latitude: 9.9763,
        longitude: -84.8384,
        timestamp: "2026-06-20T10:00:00Z",
      });

      const result = await passengerService.createPassengerIncident({
        trip_id: validTripId,
        user_id: "user-123",
        type: "traffic",
        description: "Traffic jam near the main stop.",
        latitude: 9.9763,
        longitude: -84.8384,
      });

      expect(incidentsRepository.createPassengerIncident).toHaveBeenCalledWith({
        trip_id: validTripId,
        user_id: "user-123",
        type: "traffic",
        description: "Traffic jam near the main stop.",
        latitude: 9.9763,
        longitude: -84.8384,
      });

      expect(result.id).toBe("incident-1");
      expect(result.type).toBe("traffic");
    });

    test("creates a passenger incident with null description when description is missing", async () => {
      incidentsRepository.createPassengerIncident.mockResolvedValue({
        id: "incident-2",
        trip_id: validTripId,
        type: "overcrowding",
        description: null,
        latitude: 9.9763,
        longitude: -84.8384,
        timestamp: "2026-06-20T10:00:00Z",
      });

      const result = await passengerService.createPassengerIncident({
        trip_id: validTripId,
        user_id: "user-456",
        type: "overcrowding",
        latitude: 9.9763,
        longitude: -84.8384,
      });

      expect(incidentsRepository.createPassengerIncident).toHaveBeenCalledWith({
        trip_id: validTripId,
        user_id: "user-456",
        type: "overcrowding",
        description: null,
        latitude: 9.9763,
        longitude: -84.8384,
      });

      expect(result.description).toBeNull();
    });
  });

  describe("listPassengerIncidents", () => {
    test("lists passenger incidents by trip id", async () => {
      incidentsRepository.findIncidentsByTripId.mockResolvedValue([
        {
          id: "incident-1",
          trip_id: validTripId,
          type: "traffic",
          description: "Traffic jam near the main stop.",
          latitude: 9.9763,
          longitude: -84.8384,
          timestamp: "2026-06-20T10:00:00Z",
        },
      ]);

      const result = await passengerService.listPassengerIncidents({
        trip_id: validTripId,
      });

      expect(incidentsRepository.findIncidentsByTripId).toHaveBeenCalledWith(validTripId);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("traffic");
    });

    test("returns an empty list when no incidents exist", async () => {
      incidentsRepository.findIncidentsByTripId.mockResolvedValue([]);

      const result = await passengerService.listPassengerIncidents({
        trip_id: validTripId,
      });

      expect(result).toEqual([]);
    });
  });
});