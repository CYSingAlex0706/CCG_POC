(async function () {
  // The cluster exposes only the browser-scoped Client Token at this URL.
  const response = await fetch('/guance-client-token', { cache: 'no-store' });
  if (!response.ok) return;
  const clientToken = (await response.text()).trim();
  if (!/^[0-9a-f]{32}$/i.test(clientToken)) return;
  const rum = window.DATAFLUX_RUM = window.DATAFLUX_RUM || {
    q: [], onReady(callback) { this.q.push(callback); }
  };
  rum.onReady(function () {
    window.DATAFLUX_RUM.init({
      applicationId: 'CCG_K8S_MSSQL',
      site: 'https://cn6-rum-openway.guance.one',
      clientToken,
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
})().catch(() => console.warn('Unable to initialize Guance RUM'));
