"use strict";

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const DRIVER_EMAIL = "driver.demo@bustrack.test";

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  }

  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const driverRow = await db
    .from("users")
    .select("id, email")
    .eq("email", DRIVER_EMAIL)
    .single();

  if (driverRow.error) {
    throw new Error("No se encontro el chofer: " + driverRow.error.message);
  }

  const driverId = driverRow.data.id;

  const route = await db
    .from("routes")
    .insert({
      name: "Ruta Demo Centro",
      origin: "San José",
      destination: "Alajuela",
      geometry_geojson: {
        type: "LineString",
        coordinates: [
          [-84.0907, 9.9281],
          [-84.1116, 9.9387],
          [-84.1431, 9.9583],
          [-84.19, 9.99],
          [-84.22, 10.02],
        ],
      },
    })
    .select()
    .single();

  if (route.error) {
    throw new Error("Error creando ruta: " + route.error.message);
  }

  const bus = await db
    .from("buses")
    .insert({ plate_number: "DEMO-" + Date.now(), capacity: 40, status: "active" })
    .select()
    .single();

  if (bus.error) {
    throw new Error("Error creando bus: " + bus.error.message);
  }

  const departure = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const trip = await db
    .from("trips")
    .insert({
      route_id: route.data.id,
      bus_id: bus.data.id,
      driver_id: driverId,
      departure_time: departure,
      status: "Scheduled",
    })
    .select()
    .single();

  if (trip.error) {
    throw new Error("Error creando trip: " + trip.error.message);
  }

  console.log(
    JSON.stringify(
      {
        driver_id: driverId,
        route_id: route.data.id,
        bus_id: bus.data.id,
        trip_id: trip.data.id,
        status: trip.data.status,
        departure_time: trip.data.departure_time,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("SEED_ERROR:", error.message);
  process.exit(1);
});
