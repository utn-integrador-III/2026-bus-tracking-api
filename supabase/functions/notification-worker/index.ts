import { withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendFcmMessage,
  type DeliveryResult,
  type PushTarget,
} from "../_shared/fcm-provider.ts";

declare const EdgeRuntime: {
  waitUntil<T>(promise: Promise<T>): Promise<T>;
};

type QueueMessage = {
  msg_id: number;
  message: {
    kind: string;
    event_id: string;
  };
};

type ClaimedDelivery = {
  delivery_id: string;
  notification_id: string;
  push_device_id: string;
  target_type: "fid" | "registration_token";
  target_value: string;
  platform: "android" | "ios" | "web";
  title: string;
  message: string;
  data: Record<string, unknown>;
  attempt_count: number;
};

type StoredDeliveryResult = {
  delivery_id: string;
  push_device_id: string;
  success: boolean;
  provider_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  retryable: boolean;
  retry_after_seconds: number;
  disable_device: boolean;
};

function integerEnv(name: string, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(Deno.env.get(name) || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => run()),
  );
  return results;
}

function toStoredResult(
  delivery: ClaimedDelivery,
  result: DeliveryResult,
): StoredDeliveryResult {
  return {
    delivery_id: delivery.delivery_id,
    push_device_id: delivery.push_device_id,
    success: result.success,
    provider_message_id: result.providerMessageId,
    error_code: result.errorCode,
    error_message: result.errorMessage,
    retryable: result.retryable,
    retry_after_seconds: result.retryAfterSeconds,
    disable_device: result.disableDevice,
  };
}

async function processDelivery(delivery: ClaimedDelivery): Promise<StoredDeliveryResult> {
  const target: PushTarget = {
    targetType: delivery.target_type,
    targetValue: delivery.target_value,
    platform: delivery.platform,
  };
  const data = {
    ...delivery.data,
    notification_id: delivery.notification_id,
    deep_link: delivery.data.deep_link || `bus-tracking://trips/${delivery.data.trip_id}`,
  };
  const result = await sendFcmMessage(
    target,
    {
      title: delivery.title,
      body: delivery.message,
      data,
    },
    delivery.attempt_count,
  );
  return toStoredResult(delivery, result);
}

async function processEvent(supabaseAdmin: SupabaseClient, eventId: string, workerId: string) {
  const maxAgeSeconds = integerEnv("NOTIFICATION_EVENT_MAX_AGE_SECONDS", 900, 86400);
  const expirationResult = await supabaseAdmin.rpc("expire_notification_event", {
    p_event_id: eventId,
    p_max_age_seconds: maxAgeSeconds,
  });
  if (expirationResult.error) throw expirationResult.error;
  if (expirationResult.data === true) {
    return {
      is_complete: true,
      pending_count: 0,
      sent_count: 0,
      failed_count: 0,
      expired: true,
    };
  }

  const prepareResult = await supabaseAdmin.rpc("prepare_notification_event", {
    p_event_id: eventId,
  });
  if (prepareResult.error) throw prepareResult.error;

  const batchSize = integerEnv("FCM_BATCH_SIZE", 500, 500);
  const maxConcurrency = integerEnv("FCM_MAX_CONCURRENCY", 20, 100);
  const maxBatches = integerEnv("FCM_MAX_BATCHES_PER_RUN", 4, 20);

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const claimResult = await supabaseAdmin.rpc("claim_notification_deliveries", {
      p_event_id: eventId,
      p_batch_size: batchSize,
      p_worker_id: workerId,
      p_lease_seconds: 600,
    });
    if (claimResult.error) throw claimResult.error;

    const deliveries = (claimResult.data || []) as ClaimedDelivery[];
    if (deliveries.length === 0) break;

    const results = await mapWithConcurrency(deliveries, maxConcurrency, processDelivery);
    const storeResult = await supabaseAdmin.rpc("record_notification_delivery_results", {
      p_results: results,
    });
    if (storeResult.error) throw storeResult.error;
  }

  const refreshResult = await supabaseAdmin.rpc("refresh_notification_event_status", {
    p_event_id: eventId,
  });
  if (refreshResult.error) throw refreshResult.error;
  return refreshResult.data as {
    is_complete: boolean;
    pending_count: number;
    sent_count: number;
    failed_count: number;
  };
}

async function drainQueue(supabaseAdmin: SupabaseClient) {
  const queueBatchSize = integerEnv("NOTIFICATION_QUEUE_BATCH_SIZE", 5, 20);
  const queueResult = await supabaseAdmin.rpc("read_core_notification_queue", {
    p_batch_size: queueBatchSize,
    p_visibility_timeout: 120,
  });
  if (queueResult.error) throw queueResult.error;

  const workerId = crypto.randomUUID();
  const messages = (queueResult.data || []) as QueueMessage[];
  const outcomes = [];

  for (const queueMessage of messages) {
    if (queueMessage.message.kind !== "event" || !queueMessage.message.event_id) {
      const archiveResult = await supabaseAdmin.rpc("archive_core_notification_message", {
        p_msg_id: queueMessage.msg_id,
      });
      if (archiveResult.error) throw archiveResult.error;
      outcomes.push({ msg_id: queueMessage.msg_id, ignored: true });
      continue;
    }

    try {
      const status = await processEvent(
        supabaseAdmin,
        queueMessage.message.event_id,
        workerId,
      );
      if (status.is_complete) {
        const archiveResult = await supabaseAdmin.rpc("archive_core_notification_message", {
          p_msg_id: queueMessage.msg_id,
        });
        if (archiveResult.error) throw archiveResult.error;
      }
      outcomes.push({
        msg_id: queueMessage.msg_id,
        event_id: queueMessage.message.event_id,
        ...status,
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: "notification_event_failed",
        event_id: queueMessage.message.event_id,
        message: error instanceof Error ? error.message : String(error),
      }));
      outcomes.push({
        msg_id: queueMessage.msg_id,
        event_id: queueMessage.message.event_id,
        error: true,
      });
    }
  }

  return outcomes;
}

export default {
  fetch: withSupabase({ auth: "secret" }, (_request, context) => {
    if (Deno.env.get("PUSH_NOTIFICATIONS_ENABLED") !== "true") {
      return Promise.resolve(
        Response.json(
          { accepted: false, reason: "push_notifications_disabled" },
          { status: 202 },
        ),
      );
    }

    const task = drainQueue(context.supabaseAdmin).catch((error) => {
      console.error(JSON.stringify({
        event: "notification_queue_failed",
        message: error instanceof Error ? error.message : String(error),
      }));
    });
    EdgeRuntime.waitUntil(task);
    return Promise.resolve(Response.json({ accepted: true }, { status: 202 }));
  }),
};
