export function isLocalOperationalMode() {
  return process.env.ALLOW_DEMO_AUTH === "true";
}
