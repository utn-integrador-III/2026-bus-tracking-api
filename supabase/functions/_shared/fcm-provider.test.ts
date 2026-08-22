import { assertEquals } from "@std/assert";
import {
  buildFcmMessage,
  classifyFcmFailure,
  normalizeFcmData,
} from "./fcm-provider.ts";

Deno.test("normalizes every FCM data value to a string", () => {
  assertEquals(normalizeFcmData({
    trip_id: "trip-1",
    delayed: true,
    minutes: 12,
    missing: undefined,
    "google.internal": "reserved",
  }), {
    trip_id: "trip-1",
    delayed: "true",
    minutes: "12",
    missing: "",
    custom_google_internal: "reserved",
  });
});

Deno.test("targets a current Firebase installation ID", () => {
  const message = buildFcmMessage(
    { targetType: "fid", targetValue: "installation-id", platform: "ios" },
    { title: "Departure", body: "Departed", data: {} },
  );
  assertEquals(message.fid, "installation-id");
});

Deno.test("builds a high-priority Android and Apple message", () => {
  const message = buildFcmMessage(
    { targetType: "registration_token", targetValue: "target", platform: "android" },
    { title: "Delay", body: "Delayed", data: { trip_id: "trip-1" } },
  );
  assertEquals(message.token, "target");
  assertEquals(message.android.priority, "high");
  assertEquals(message.data.trip_id, "trip-1");
});

Deno.test("classifies unavailable responses as retryable", () => {
  const result = classifyFcmFailure(503, "UNAVAILABLE", "Unavailable", null, 1);
  assertEquals(result.retryable, true);
  assertEquals(result.disableDevice, false);
});

Deno.test("classifies unregistered targets as permanent and disables them", () => {
  const result = classifyFcmFailure(404, "UNREGISTERED", "Not registered", null, 1);
  assertEquals(result.retryable, false);
  assertEquals(result.disableDevice, true);
});
