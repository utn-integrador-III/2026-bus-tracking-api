"use strict";

const requireRole = require("../requireRole");
const { ROLES } = require("../../constants/roles");

function runGuard(auth, allowed) {
  return new Promise((resolve) => {
    const req = { auth };
    const guard = requireRole(...allowed);
    guard(req, {}, (err) => resolve(err));
  });
}

describe("requireRole", () => {
  test("401 cuando no hay req.auth", async () => {
    const err = await runGuard(undefined, [ROLES.ADMIN]);
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(401);
  });

  test("403 cuando el rol no esta permitido", async () => {
    const err = await runGuard({ role: ROLES.PASSENGER }, [ROLES.ADMIN]);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN_ROLE");
  });

  test("continua sin error cuando el rol esta permitido", async () => {
    const err = await runGuard({ role: ROLES.ADMIN }, [ROLES.ADMIN]);
    expect(err).toBeUndefined();
  });

  test("acepta cualquiera de varios roles permitidos", async () => {
    const err = await runGuard({ role: ROLES.DRIVER }, [
      ROLES.PASSENGER,
      ROLES.DRIVER,
      ROLES.ADMIN,
    ]);
    expect(err).toBeUndefined();
  });
});
