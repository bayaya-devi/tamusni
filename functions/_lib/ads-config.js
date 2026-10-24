// Advertising remains opt-in at infrastructure level. The publisher identifier
// is public by design, but is kept in one Cloudflare variable so it cannot drift
// between verification metadata, ads.txt and ad units.
const clientPattern = /^ca-pub-\d{16}$/;

export function adsenseClient(env) {
  const client = String(env?.ADSENSE_CLIENT_ID || '').trim();
  return clientPattern.test(client) ? client : '';
}

export function adsensePublisher(env) {
  return adsenseClient(env).replace(/^ca-/, '');
}

// Approval alone is not enough: the operator must explicitly enable ads after
// configuring a certified TCF CMP for the audiences where it is required.
export function adsEnabled(env) {
  return env?.ADS_ENABLED === 'true' && Boolean(adsenseClient(env));
}
