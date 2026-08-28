import { JWT } from "google-auth-library";

export type PushTargetType = "fid" | "registration_token";

export type PushTarget = {
  targetType: PushTargetType;
  targetValue: string;
  platform: "android" | "ios" | "web";
};

export type NotificationPayload = {
  title: string;
  body: string;
  data: Record<string, unknown>;
};

export type DeliveryResult = {
  success: boolean;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  retryAfterSeconds: number;
  disableDevice: boolean;
};

type CachedAccessToken = {
  value: string;
  expiresAt: number;
};

let cachedAccessToken: CachedAccessToken | null = null;
let accessTokenPromise: Promise<CachedAccessToken> | null = null;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseRetryAfter(value: string | null): number {
  if (!value) return 60;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds)) return Math.max(10, seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return 60;
  return Math.max(10, Math.ceil((date - Date.now()) / 1000));
}

function calculateBackoff(attemptCount: number): number {
  const base = Math.min(3600, 10 * 2 ** Math.max(0, attemptCount - 1));
  const jitter = Math.floor(Math.random() * Math.max(1, Math.ceil(base * 0.25)));
  return base + jitter;
}

export function normalizeFcmData(data: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      const reserved = key === "from" || key === "message_type" ||
        key.startsWith("google.") || key.startsWith("gcm.notification.");
      const safeKey = reserved ? `custom_${key.replaceAll(".", "_")}` : key;
      const encoded = typeof value === "string"
        ? value
        : value === undefined
        ? ""
        : JSON.stringify(value) ?? "";
      return [safeKey, encoded];
    }),
  );
}

export function buildFcmMessage(target: PushTarget, payload: NotificationPayload) {
  const destination = target.targetType === "fid"
    ? { fid: target.targetValue }
    : { token: target.targetValue };

  return {
    ...destination,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: normalizeFcmData(payload.data),
    android: {
      priority: "high",
      notification: {
        channel_id: "trip_alerts",
        sound: "default",
      },
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
      payload: {
        aps: {
          sound: "default",
          "content-available": 1,
        },
      },
    },
  };
}

export function classifyFcmFailure(
  httpStatus: number,
  errorCode: string,
  errorMessage: string,
  retryAfter: string | null,
  attemptCount: number,
): DeliveryResult {
  const normalizedCode = errorCode.toUpperCase();
  const disableDevice = normalizedCode.includes("UNREGISTERED") ||
    normalizedCode.includes("REGISTRATION_TOKEN_NOT_REGISTERED") ||
    normalizedCode.includes("SENDER_ID_MISMATCH");
  const retryable = httpStatus === 429 || httpStatus >= 500 ||
    normalizedCode.includes("RESOURCE_EXHAUSTED") ||
    normalizedCode.includes("UNAVAILABLE") ||
    normalizedCode.includes("INTERNAL");
  const retryAfterSeconds = httpStatus === 429
    ? parseRetryAfter(retryAfter)
    : calculateBackoff(attemptCount);

  return {
    success: false,
    providerMessageId: null,
    errorCode: errorCode || `HTTP_${httpStatus}`,
    errorMessage,
    retryable,
    retryAfterSeconds,
    disableDevice,
  };
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 300000) {
    return cachedAccessToken.value;
  }

  if (!accessTokenPromise) {
    accessTokenPromise = (async () => {
      const client = new JWT({
        email: requiredEnv("FCM_CLIENT_EMAIL"),
        key: requiredEnv("FCM_PRIVATE_KEY").replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
      });

      const credentials = await client.authorize();
      if (!credentials.access_token) {
        throw new Error("FCM OAuth response did not contain an access token.");
      }
      return {
        value: credentials.access_token,
        expiresAt: credentials.expiry_date || Date.now() + 3600000,
      };
    })().finally(() => {
      accessTokenPromise = null;
    });
  }

  cachedAccessToken = await accessTokenPromise;
  return cachedAccessToken.value;
}

export async function sendFcmMessage(
  target: PushTarget,
  payload: NotificationPayload,
  attemptCount: number,
): Promise<DeliveryResult> {
  try {
    const accessToken = await getAccessToken();
    const projectId = requiredEnv("FCM_PROJECT_ID");
    const validateOnly = Deno.env.get("FCM_VALIDATE_ONLY") === "true";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let response: Response;

    try {
      response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            validate_only: validateOnly,
            message: buildFcmMessage(target, payload),
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const responseBody = await response.json().catch(() => ({}));
    if (response.ok) {
      return {
        success: true,
        providerMessageId: responseBody.name || (validateOnly ? "validate-only" : null),
        errorCode: null,
        errorMessage: null,
        retryable: false,
        retryAfterSeconds: 0,
        disableDevice: false,
      };
    }

    const errorCode = responseBody.error?.status || responseBody.error?.details?.[0]?.errorCode || "";
    const errorMessage = responseBody.error?.message || `FCM returned HTTP ${response.status}.`;
    return classifyFcmFailure(
      response.status,
      errorCode,
      errorMessage,
      response.headers.get("retry-after"),
      attemptCount,
    );
  } catch (error) {
    return {
      success: false,
      providerMessageId: null,
      errorCode: error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
      errorMessage: error instanceof Error ? error.message : String(error),
      retryable: true,
      retryAfterSeconds: calculateBackoff(attemptCount),
      disableDevice: false,
    };
  }
}
