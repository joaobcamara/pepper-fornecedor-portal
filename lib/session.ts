import { cookies } from "next/headers";
import { decodeSession, getSessionCookieName } from "@/lib/auth";

export async function getCurrentSession() {
  const store = await cookies();
  const token = store.get(getSessionCookieName())?.value;
  return decodeSession(token);
}
