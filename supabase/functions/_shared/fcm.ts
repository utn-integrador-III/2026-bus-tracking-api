// FCM HTTP v1 vendor adapter.
// Isolates the push provider behind a single sendFcmMessage() entry point so the
// rest of the function (and the Node backend) never depends on FCM specifics (NFR-14).

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function loadServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (raw) {
    const parsed = JSON.parse(raw);
    return {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  }

  const project_id = Deno.env.get("FCM_PROJECT_ID");
  const client_email = Deno.env.get("FCM_CLIENT_EMAIL");
  const private_key = Deno.env.get("FCM_PRIVATE_KEY");

  if (!project_id || !client_email || !private_key) {
    throw new Error(
      "Missing FCM credentials: set FCM_SERVICE_ACCOUNT or FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY",
    );
  }

  return {
    project_id,
    client_email,
    private_key: private_key.replace(/\\n/g, "\n"),
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createSignedJwt(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: account.client_email,
    scope: FCM_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const unsigned = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${
    base64UrlEncode(encoder.encode(JSON.stringify(claims)))
  }`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsigned),
  );

  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  const jwt = await createSignedJwt(account);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(`OAuth token exchange failed (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  return json.access_token;
}

export async function sendFcmMessage(message: FcmMessage): Promise<unknown> {
  const account = loadServiceAccount();
  const accessToken = await getAccessToken(account);

  const url =
    `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: message.token,
        notification: { title: message.title, body: message.body },
        data: message.data ?? {},
      },
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`FCM send failed (${res.status}): ${JSON.stringify(payload)}`);
  }

  return payload;
}
