"use strict";

const { z } = require("zod");
const validate = require("../validate");

const bodySchema = z.object({ name: z.string().min(1) }).strict();

function run(req, schemas) {
  return new Promise((resolve) => {
    const middleware = validate(schemas);
    middleware(req, {}, (err) => resolve(err));
  });
}

describe("validate", () => {
  test("400 con detalles cuando el body es invalido", async () => {
    const req = { body: { name: "" } };
    const err = await run(req, { body: bodySchema });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("ROUTE_VALIDATION_FAILED");
    expect(Array.isArray(err.details)).toBe(true);
  });

  test("almacena el valor saneado en req.valid", async () => {
    const req = { body: { name: "Ruta", extra: "x" } };
    const err = await run(req, { body: z.object({ name: z.string() }).strip() });
    expect(err).toBeUndefined();
    expect(req.valid.body).toEqual({ name: "Ruta" });
  });

  test("valida params", async () => {
    const req = { params: { id: "no-uuid" } };
    const err = await run(req, { params: z.object({ id: z.uuid() }) });
    expect(err.statusCode).toBe(400);
  });

  test("ignora partes sin schema", async () => {
    const req = { body: { name: "Ruta" } };
    const err = await run(req, { params: z.object({ id: z.uuid() }).optional() });
    expect(err).toBeUndefined();
  });
});
