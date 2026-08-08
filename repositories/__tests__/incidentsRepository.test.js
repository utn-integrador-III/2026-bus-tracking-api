"use strict";

const mockFindIncidentsByTripId = jest.fn();
const mockCreatePassengerIncident = jest.fn();

jest.mock(
  "../../src/modules/passenger-incidents/infrastructure/SupabasePassengerIncidentRepository",
  () =>
    class {
      constructor() {
        this.findIncidentsByTripId = mockFindIncidentsByTripId;
        this.createPassengerIncident = mockCreatePassengerIncident;
      }
    },
);

const incidentsRepository = require("../incidentsRepository");
const { incidentWindowStart } = require("../../constants/incidentWindow");

const validTripId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function incidentAt(id, timestamp) {
  return { id, trip_id: validTripId, type: "Traffic_Congestion", timestamp };
}

describe("incidentsRepository.findIncidentsByTripId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("keeps only the incidents inside the window", async () => {
    const now = Date.now();
    const recent = incidentAt("recent", new Date(now - 5 * 60 * 1000).toISOString());
    const stale = incidentAt("stale", new Date(now - 6 * 60 * 60 * 1000).toISOString());

    mockFindIncidentsByTripId.mockResolvedValue([recent, stale]);

    const result = await incidentsRepository.findIncidentsByTripId(validTripId, {
      since: incidentWindowStart(now),
    });

    expect(result).toEqual([recent]);
  });

  test("returns every incident when no window is given", async () => {
    const stale = incidentAt("stale", "2020-01-01T00:00:00.000Z");

    mockFindIncidentsByTripId.mockResolvedValue([stale]);

    const result = await incidentsRepository.findIncidentsByTripId(validTripId);

    expect(result).toEqual([stale]);
  });

  test("returns an empty list when the underlying repository returns nothing", async () => {
    mockFindIncidentsByTripId.mockResolvedValue(null);

    const result = await incidentsRepository.findIncidentsByTripId(validTripId, {
      since: incidentWindowStart(),
    });

    expect(result).toEqual([]);
  });
});
