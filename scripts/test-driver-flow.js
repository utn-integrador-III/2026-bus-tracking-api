"use strict";

const http = require("http");
const { getServiceClient } = require("../database/supabaseClient");

const BASE = "http://localhost:8000";
const ADMIN_EMAIL = "sqada2804@gmail.com";
const ADMIN_PASSWORD = "Admin12345";

let createdIds = { driverId: null, tripId: null, routeId: null, busId: null };

function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, BASE);
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: { "Content-Type": "application/json" },
    };
    if (token) opts.headers["Authorization"] = "Bearer " + token;
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(label, condition, detail) {
  if (!condition) {
    console.error("  FAIL:", label, detail || "");
    process.exit(1);
  }
  console.log("  PASS:", label);
}

async function main() {
  console.log("\n=== TEST: Flujo completo de Driver ===");
  const c = getServiceClient();

  console.log("\n[1] Login como admin...");
  const loginRes = await api("POST", "/api/auth/admin/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  assert("POST /api/auth/admin/login → 200", loginRes.status === 200, JSON.stringify(loginRes.body));
  const adminToken = loginRes.body.access_token;
  assert("access_token presente", !!adminToken);
  assert("role = Admin", loginRes.body.user.role === "Admin");

  console.log("\n[2] Creando ruta y bus de prueba...");
  const routeRes = await c.from("routes").insert({
    name: "Ruta Test E2E",
    origin: "San José",
    destination: "Alajuela",
    geometry_geojson: { type: "LineString", coordinates: [[-84.08, 9.93], [-84.22, 10.02]] },
  }).select().single();
  assert("Ruta creada", !routeRes.error, routeRes.error?.message);
  createdIds.routeId = routeRes.data.id;

  const busRes = await c.from("buses").insert({
    plate_number: "E2E-999",
    capacity: 40,
    status: "active",
  }).select().single();
  assert("Bus creado", !busRes.error, busRes.error?.message);
  createdIds.busId = busRes.data.id;

  console.log("\n[3] Creando driver (POST /api/admin/drivers)...");
  const driverEmail = "driver.e2e." + Date.now() + "@test.com";
  const createDriverRes = await api("POST", "/api/admin/drivers", {
    name: "Conductor E2E",
    email: driverEmail,
    password: "Password123",
    license_number: "LIC-E2E-001",
  }, adminToken);
  assert("POST /admin/drivers → 201", createDriverRes.status === 201, JSON.stringify(createDriverRes.body));
  const driverUserId = createDriverRes.body.user_id;
  createdIds.driverId = driverUserId;
  assert("user_id presente", !!driverUserId);
  assert("role = Driver", createDriverRes.body.role === "Driver");

  console.log("\n[4] Creando trip (POST /api/admin/trips)...");
  const departure = new Date(Date.now() + 3600000).toISOString();
  const createTripRes = await api("POST", "/api/admin/trips", {
    route_id: createdIds.routeId,
    bus_id: createdIds.busId,
    driver_id: driverUserId,
    departure_time: departure,
  }, adminToken);
  assert("POST /admin/trips → 201", createTripRes.status === 201, JSON.stringify(createTripRes.body));
  const tripId = createTripRes.body.id;
  createdIds.tripId = tripId;
  assert("trip id presente", !!tripId);

  console.log("\n[5] Login como driver...");
  const driverLoginRes = await api("POST", "/api/auth/driver/login", {
    email: driverEmail,
    password: "Password123",
  });
  assert("POST /api/auth/driver/login → 200", driverLoginRes.status === 200, JSON.stringify(driverLoginRes.body));
  const driverToken = driverLoginRes.body.access_token;
  assert("access_token presente", !!driverToken);
  assert("role = Driver", driverLoginRes.body.user.role === "Driver");

  console.log("\n[6] Start trip...");
  const startRes = await api("POST", "/api/driver/trips/" + tripId + "/start", null, driverToken);
  assert("POST /driver/trips/{id}/start → 200", startRes.status === 200, JSON.stringify(startRes.body));
  assert("status = In_Progress", startRes.body.status === "In_Progress");

  console.log("\n[7] Get active trip...");
  const activeRes = await api("GET", "/api/driver/trips/active", null, driverToken);
  assert("GET /driver/trips/active → 200", activeRes.status === 200, JSON.stringify(activeRes.body));
  assert("trip activo retornado", !!activeRes.body);
  assert("status = In_Progress", activeRes.body.status === "In_Progress");

  console.log("\n[8] Report location...");
  const locRes = await api("POST", "/api/driver/trips/" + tripId + "/location", {
    latitude: 9.9355,
    longitude: -84.0875,
    speed: 45.2,
    heading: 180,
    recorded_at: new Date().toISOString(),
  }, driverToken);
  assert("POST /driver/trips/{id}/location → 201", locRes.status === 201, JSON.stringify(locRes.body));
  assert("location id presente", locRes.body && !!locRes.body.id);

  console.log("\n[9] Complete trip...");
  const completeRes = await api("POST", "/api/driver/trips/" + tripId + "/complete", null, driverToken);
  assert("POST /driver/trips/{id}/complete → 200", completeRes.status === 200, JSON.stringify(completeRes.body));
  assert("status = Completed", completeRes.body.status === "Completed");

  console.log("\n[10] Verify no active trip...");
  const activeAfterRes = await api("GET", "/api/driver/trips/active", null, driverToken);
  if (activeAfterRes.body === null || activeAfterRes.body === "") {
    console.log("  PASS: No active trip (null)");
  } else {
    assert("Body is null or empty", false, JSON.stringify(activeAfterRes.body));
  }

  console.log("\n=== Cleanup ===");
  await c.from("locations").delete().eq("trip_id", tripId);
  await c.from("trips").delete().eq("id", tripId);
  await c.from("user_roles").delete().eq("user_id", driverUserId);
  await c.from("users").delete().eq("id", driverUserId);
  if (createdIds.busId) await c.from("buses").delete().eq("id", createdIds.busId);
  if (createdIds.routeId) await c.from("routes").delete().eq("id", createdIds.routeId);
  const { data: users } = await c.auth.admin.listUsers();
  const u = users?.users?.find(x => x.email === driverEmail);
  if (u) await c.auth.admin.deleteUser(u.id).catch(() => {});

  console.log("\n✓ TODOS LOS TESTS PASARON\n");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
