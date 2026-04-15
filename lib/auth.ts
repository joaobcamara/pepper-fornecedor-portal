import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "pepper_session";
const SESSION_SEPARATOR = ".";

export function hashPassword(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function verifyPassword(value: string, hash: string) {
  const valueHash = hashPassword(value);
  return timingSafeEqual(Buffer.from(valueHash), Buffer.from(hash));
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET nao configurado para producao.");
  }

  return "pepper-dev-secret";
}

type SessionPayload = {
  userId: string;
  role: "ADMIN" | "SUPPLIER";
  supplierId?: string | null;
  username: string;
};

export function encodeSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}${SESSION_SEPARATOR}${signature}`;
}

export function decodeSession(value?: string | null): SessionPayload | null {
  if (!value) {
    return null;
  }

  const [body, signature] = value.split(SESSION_SEPARATOR);

  if (!body || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}
