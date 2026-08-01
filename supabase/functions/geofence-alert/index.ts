// Edge Function: geofence-alert
// Triggered by the backend when a watched bus crosses the passenger's stop
// proximity threshold. Receives { passenger_id, distance_m, trip_id, stop_id },
// resolves the passenger's FCM device token, and dispatches an FCM HTTP v1 push.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { sendFcmMessage } from "../_shared/fcm.ts";

interface GeofenceAlertPayload {
  passenger_id?: string;
  distance_m?: number;
  trip_id?: string;
  stop_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let payload: GeofenceAlertPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const { passenger_id, distance_m, trip_id, stop_id } = payload;

  if (!passenger_id || typeof distance_m !== "number") {
    return jsonResponse(
      { error: "passenger_id and numeric distance_m are required" },
      400,
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: passenger, error } = await supabase
    .from("passengers")
    .select("user_id, fcm_token")
    .eq("user_id", passenger_id)
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: "db_error", detail: error.message }, 500);
  }

  if (!passenger || !passenger.fcm_token) {
    return jsonResponse({ skipped: true, reason: "no_token", passenger_id }, 200);
  }

  try {
    const result = await sendFcmMessage({
      token: passenger.fcm_token,
      title: "Tu autobús está llegando",
      body: `El autobús está a ${Math.round(distance_m)} m de tu parada.`,
      data: {
        type: "bus_approaching",
        passenger_id: String(passenger_id),
        distance_m: String(Math.round(distance_m)),
        trip_id: trip_id ? String(trip_id) : "",
        stop_id: stop_id ? String(stop_id) : "",
      },
    });

    return jsonResponse({ sent: true, passenger_id, distance_m, result }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "fcm_send_failed", detail: (err as Error).message },
      502,
    );
  }
});
