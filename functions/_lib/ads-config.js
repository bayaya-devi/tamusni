// Advertising stays off until TAMUSNI has been approved and the operator
// explicitly enables it in Cloudflare. Verification metadata and ads.txt are
// intentionally independent from this switch.
export function adsEnabled(env) {
  return env?.ADS_ENABLED === "true";
}
