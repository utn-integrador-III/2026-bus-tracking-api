"use strict";

jest.mock("../../services/driver.service", () => ({
  listDrivers: jest.fn(),
  getDriverById: jest.fn(),
  createDriver: jest.fn(),
  updateDriver: jest.fn(),
  deactivateDriver: jest.fn(),
}));

const request = require("supertest");
const buildApp = require("../../app");
const driverService = require("../../services/driver.service");

const app = buildApp();
const validUserId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const driverResponse = {
  user_id: validUserId,
  name: "Carlos Gomez",
  email: "driver@example.com",
  role: "Driver",
  license_number: "B1-123456",
  isActive: true,
  created_at: "2026-06-20T10:00:00Z",
};

describe("admin driver routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/admin/drivers returns driver list", async () => {
    driverService.listDrivers.mockResolvedValue([driverResponse]);

    const response = await request(app).get("/api/admin/drivers");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([driverResponse]);
  });

  test("POST /api/admin/drivers creates a driver", async () => {
    driverService.createDriver.mockResolvedValue(driverResponse);

    const response = await request(app)
      .post("/api/admin/drivers")
      .send({
        name: "Carlos Gomez",
        email: "driver@example.com",
        password: "Password123",
        license_number: "B1-123456",
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(driverResponse);
  });

  test("GET /api/admin/drivers/:id returns one driver", async () => {
    driverService.getDriverById.mockResolvedValue(driverResponse);

    const response = await request(app).get(`/api/admin/drivers/${validUserId}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(driverResponse);
  });

  test("PUT /api/admin/drivers/:id updates a driver", async () => {
    driverService.updateDriver.mockResolvedValue({
      ...driverResponse,
      name: "Updated Driver",
      license_number: "B2-999999",
    });

    const response = await request(app)
      .put(`/api/admin/drivers/${validUserId}`)
      .send({
        name: "Updated Driver",
        license_number: "B2-999999",
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Updated Driver");
    expect(response.body.license_number).toBe("B2-999999");
  });

  test("DELETE /api/admin/drivers/:id deactivates a driver", async () => {
    driverService.deactivateDriver.mockResolvedValue({
      ...driverResponse,
      isActive: false,
    });

    const response = await request(app).delete(`/api/admin/drivers/${validUserId}`);

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);
  });

  test("POST /api/admin/drivers rejects invalid payload", async () => {
    const response = await request(app)
      .post("/api/admin/drivers")
      .send({
        name: "Carlos Gomez",
        email: "invalid-email",
        password: "123",
        license_number: "B1-123456",
      });

    expect(response.status).toBe(400);
    expect(driverService.createDriver).not.toHaveBeenCalled();
  });
});