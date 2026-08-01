"use strict";

const ExpoPushService = require("../push.service");
const { isExpoPushToken } = require("../push.service");

const TOKEN = "ExponentPushToken[abcdef123456]";

function buildService(overrides = {}) {
  return new ExpoPushService({
    passengerRepository: {
      findPassengerById: jest.fn().mockResolvedValue({ expo_push_token: TOKEN }),
    },
    fetchImpl: jest.fn().mockResolvedValue({ ok: true, status: 200 }),
    endpoint: "https://push.test/send",
    ...overrides,
  });
}

describe("isExpoPushToken", () => {
  it("accepts Expo tokens and rejects anything else", () => {
    expect(isExpoPushToken(TOKEN)).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xyz]")).toBe(true);
    expect(isExpoPushToken("fcm-registration-token")).toBe(false);
    expect(isExpoPushToken(null)).toBe(false);
  });
});

describe("ExpoPushService.sendAlert", () => {
  it("posts an audible high priority notification to the Expo push API", async () => {
    const service = buildService();

    const result = await service.sendAlert("user-1", "bus_approaching", {
      trip_id: "trip-1",
      stop_id: "stop-1",
    });

    expect(result).toBe(true);
    expect(service.fetchImpl).toHaveBeenCalledTimes(1);

    const [url, options] = service.fetchImpl.mock.calls[0];
    expect(url).toBe("https://push.test/send");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.to).toBe(TOKEN);
    expect(body.sound).toBe("default");
    expect(body.priority).toBe("high");
    expect(body.data).toEqual({
      event: "bus_approaching",
      trip_id: "trip-1",
      stop_id: "stop-1",
    });
  });

  it("does not dispatch when the passenger has no Expo token stored", async () => {
    const service = buildService({
      passengerRepository: {
        findPassengerById: jest.fn().mockResolvedValue({ expo_push_token: null }),
      },
    });
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(service.sendAlert("user-1", "bus_approaching", {})).resolves.toBe(false);

    expect(service.fetchImpl).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not dispatch when the stored token is not an Expo token", async () => {
    const service = buildService({
      passengerRepository: {
        findPassengerById: jest.fn().mockResolvedValue({ expo_push_token: "fcm-token" }),
      },
    });
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(service.sendAlert("user-1", "bus_passed", {})).resolves.toBe(false);

    expect(service.fetchImpl).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reports a failure instead of throwing when the token lookup fails", async () => {
    const service = buildService({
      passengerRepository: {
        findPassengerById: jest.fn().mockRejectedValue(new Error("db down")),
      },
    });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(service.sendAlert("user-1", "bus_approaching", {})).resolves.toBe(false);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reports a failure instead of throwing when the Expo API rejects the request", async () => {
    const service = buildService({
      fetchImpl: jest.fn().mockResolvedValue({ ok: false, status: 400 }),
    });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(service.sendAlert("user-1", "bus_approaching", {})).resolves.toBe(false);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("ignores unknown alert events", async () => {
    const service = buildService();

    await expect(service.sendAlert("user-1", "unknown_event", {})).resolves.toBe(false);
    expect(service.fetchImpl).not.toHaveBeenCalled();
  });
});
