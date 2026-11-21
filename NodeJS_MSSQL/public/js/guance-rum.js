/* Solution 1: Guance RUM via the official CDN, loaded asynchronously.
 * This file is separate from the customer's custom /js/rum.js.
 */
(function (window, document) {
  'use strict';
  // Queue configuration until the CDN SDK has finished loading.
  window.DATAFLUX_RUM = window.DATAFLUX_RUM || {
    q: [], onReady: function (callback) { this.q.push(callback); }
  };
  var sdk = document.createElement('script');
  sdk.async = true; // Do not block HTML parsing while downloading the RUM SDK.
  sdk.src = 'https://static.guance.com/browser-sdk/v3/dataflux-rum.js';
  document.head.appendChild(sdk);
  window.DATAFLUX_RUM.onReady(function () {
    if (!window.CCG_RUM_CLIENT_TOKEN) return; // Fail closed until configured.
    window.DATAFLUX_RUM.init({
      applicationId: 'CCG_S1_APM_RUM', // Created in the Hong Kong workspace.
      site: 'https://cn6-rum-openway.guance.one', // Dedicated Hong Kong browser intake.
      clientToken: window.CCG_RUM_CLIENT_TOKEN, // Browser-scoped token from deployment config.
      service: 'ccg-s1-web', env: 'poc', version: 's1-dataway-1.1.0',
      sessionSampleRate: 100, // PoC only; choose a production sampling policy later.
      sessionReplaySampleRate: 100, // Record all sampled sessions.
      defaultPrivacyLevel: 'mask-user-input', // Default privacy: mask form inputs.
      trackUserInteractions: true,
      allowedTracingUrls: [window.location.origin + '/'], // Match this application only.
      traceType: 'w3c_traceparent', tracingSampleRate: 100 // Propagate to Beacon.
    });
    window.DATAFLUX_RUM.startSessionReplayRecording(); // Start after SDK initialization.
  });
})(window, document);
