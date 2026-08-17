"use strict";

jest.mock("../../database/supabaseClient", () => ({ getServiceClient: jest.fn() }));

const { getServiceClient } = require("../../database/supabaseClient");
const { createSupabaseMock } = require("../../testUtils/supabaseMock");
const repository = require("../userRepository");

function setup(responses) {
  const mock = createSupabaseMock(responses);
  getServiceClient.mockReturnValue(mock.client);
  return mock;
}

const user = { id: "user-1", name: "Ada" };
const role = { user_id: "user-1", role: "Driver" };

describe("userRepository", () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ["findUserByEmail", "ada@example.test", "email"],
    ["findUserById", "user-1", "id"],
  ])("finds and attaches the primary role in %s", async (method, value, column) => {
    const { queries } = setup([
      { data: user, error: null },
      { data: role, error: null },
    ]);

    await expect(repository[method](value)).resolves.toEqual({ ...user, role: "Driver" });
    expect(queries[0].eq).toHaveBeenCalledWith(column, value);
    expect(queries[1].order).toHaveBeenCalledWith("assigned_at", { ascending: false });
  });

  test("returns null without querying roles when the user does not exist", async () => {
    const { client } = setup([{ data: null, error: null }]);
    await expect(repository.findUserById("missing")).resolves.toBeNull();
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  test("attaches a null role when no primary role exists", async () => {
    setup([
      { data: user, error: null },
      { data: null, error: null },
    ]);
    await expect(repository.findUserByEmail("ada@example.test")).resolves.toEqual({
      ...user,
      role: null,
    });
  });

  test("maps user and role lookup errors", async () => {
    setup([{ error: { message: "user failed" } }]);
    await expect(repository.findUserById("user-1")).rejects.toMatchObject({
      code: "DATABASE_ERROR",
      details: "user failed",
    });

    setup([
      { data: user, error: null },
      { error: { message: "role failed" } },
    ]);
    await expect(repository.findUserById("user-1")).rejects.toMatchObject({
      code: "DATABASE_ERROR",
      details: "role failed",
    });
  });

  test("creates a profile and upserts all optional role fields", async () => {
    const { queries } = setup([
      { data: user, error: null },
      { data: role, error: null },
    ]);

    await expect(repository.createUserProfile({
      ...user,
      role: "Driver",
      license_number: "LIC-1",
      employee_code: "EMP-1",
    })).resolves.toEqual({ ...user, role: "Driver" });

    expect(queries[0].upsert).toHaveBeenCalledWith(user, { onConflict: "id" });
    expect(queries[1].upsert).toHaveBeenCalledWith({
      user_id: "user-1",
      role: "Driver",
      license_number: "LIC-1",
      employee_code: "EMP-1",
    }, { onConflict: "user_id,role" });
  });

  test("creates a profile without a role or optional fields", async () => {
    const { client } = setup([{ data: user, error: null }]);
    await expect(repository.createUserProfile(user)).resolves.toEqual({ ...user, role: null });
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  test("omits undefined role metadata", async () => {
    const { queries } = setup([
      { data: user, error: null },
      { data: role, error: null },
    ]);
    await repository.createUserProfile({ ...user, role: "Driver" });
    expect(queries[1].upsert).toHaveBeenCalledWith(
      { user_id: "user-1", role: "Driver" },
      { onConflict: "user_id,role" },
    );
  });

  test("maps profile and role upsert errors", async () => {
    setup([{ error: { message: "profile failed" } }]);
    await expect(repository.createUserProfile(user)).rejects.toMatchObject({
      code: "DATABASE_ERROR",
      details: "profile failed",
    });

    setup([
      { data: user, error: null },
      { error: { message: "upsert role failed" } },
    ]);
    await expect(repository.createUserProfile({ ...user, role: "Driver" }))
      .rejects.toMatchObject({ code: "DATABASE_ERROR", details: "upsert role failed" });
  });

  test("updates user data and role data together", async () => {
    const { queries } = setup([
      { data: user, error: null },
      { data: role, error: null },
    ]);
    await expect(repository.updateUserProfile("user-1", {
      name: "Grace",
      role: "Admin",
      employee_code: null,
    })).resolves.toEqual({ ...user, role: "Admin" });
    expect(queries[0].update).toHaveBeenCalledWith({ name: "Grace" });
    expect(queries[1].upsert).toHaveBeenCalledWith({
      user_id: "user-1",
      role: "Admin",
      employee_code: null,
    }, { onConflict: "user_id,role" });
  });

  test("loads the current user when an update contains only role data", async () => {
    const { queries } = setup([
      { data: user, error: null },
      { data: role, error: null },
      { data: { role: "Passenger" }, error: null },
    ]);
    await expect(repository.updateUserProfile("user-1", { role: "Passenger" }))
      .resolves.toEqual({ ...user, role: "Passenger" });
    expect(queries[0].eq).toHaveBeenCalledWith("id", "user-1");
  });

  test("returns null from an empty update and maps update errors", async () => {
    setup([{ data: null, error: null }]);
    await expect(repository.updateUserProfile("user-1", { name: "Nobody" }))
      .resolves.toBeNull();

    setup([{ error: { message: "update failed" } }]);
    await expect(repository.updateUserProfile("user-1", { name: "Nobody" }))
      .rejects.toMatchObject({ code: "DATABASE_ERROR", details: "update failed" });
  });

  test("activates and deactivates a user", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-02-03T04:05:06.000Z"));
    const inactive = setup([
      { data: user, error: null },
      { data: null, error: null },
    ]);
    await repository.setUserActive("user-1", false);
    expect(inactive.queries[0].update).toHaveBeenCalledWith({
      is_active: false,
      deactivated_at: "2026-02-03T04:05:06.000Z",
    });

    const active = setup([
      { data: user, error: null },
      { data: null, error: null },
    ]);
    await repository.setUserActive("user-1", true);
    expect(active.queries[0].update).toHaveBeenCalledWith({
      is_active: true,
      deactivated_at: null,
    });
    jest.useRealTimers();
  });

  test("maps activation errors and handles an empty result", async () => {
    setup([{ error: { message: "activation failed" } }]);
    await expect(repository.setUserActive("user-1", true)).rejects.toMatchObject({
      code: "DATABASE_ERROR",
      details: "activation failed",
    });

    const empty = setup([{ data: null, error: null }]);
    await expect(repository.setUserActive("user-1", true)).resolves.toBeNull();
    expect(empty.client.from).toHaveBeenCalledTimes(1);
  });
});
