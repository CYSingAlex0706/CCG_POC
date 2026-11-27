(function () {
  const rum = window.DATAFLUX_RUM = window.DATAFLUX_RUM || {
    q: [], onReady(callback) { this.q.push(callback); }
  };
  rum.onReady(function () {
    window.DATAFLUX_RUM.init({
      applicationId: 'CCG_K8S_MSSQL',
      site: 'https://cn6-rum-openway.guance.one',
      clientToken: '__CLIENT_TOKEN__',
      service: 'ccg-k8s-web',
      env: 'test',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 100,
      defaultPrivacyLevel: 'mask-user-input',
      trackUserInteractions: true,
      allowedTracingUrls: [window.location.origin + '/api/'],
      traceType: 'w3c_traceparent',
      tracingSampleRate: 100
    });
    window.DATAFLUX_RUM.startSessionReplayRecording();
  });
  const sdk = document.createElement('script');
  sdk.async = true;
  sdk.src = 'https://static.guance.com/browser-sdk/v3/dataflux-rum.js';
  document.head.appendChild(sdk);
})();
