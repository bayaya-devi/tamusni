/* Public frontend boundary for TAMUSNI's Cloudflare Pages API.
 * Browser code must use this gateway rather than calling fetch() for /api routes.
 */
(function (global) {
  "use strict";

  function apiUrl(input) {
    var url = new URL(String(input), global.location.origin);
    if (url.origin !== global.location.origin || !url.pathname.startsWith("/api/")) {
      throw new Error("Les requêtes du frontend doivent cibler l’API TAMUSNI.");
    }
    return url.pathname + url.search;
  }

  function request(input, options) {
    var settings = Object.assign({ credentials: "same-origin" }, options || {});
    var headers = new Headers(settings.headers || {});
    headers.set("Accept", "application/json");
    settings.headers = headers;
    return global.fetch(apiUrl(input), settings);
  }

  global.TamusniApi = Object.freeze({ request: request });
})(window);
