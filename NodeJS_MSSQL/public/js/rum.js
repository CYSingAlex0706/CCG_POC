/* Real-user monitoring shim: every fetch records its own latency + result
   and reports it to the backend. This is what makes "frontend <-> backend
   errors" visible in the APM dashboard. */
(function () {
  'use strict';

  const events = [];

  function sendBeacon(payload) {
    try {
      fetch('/api/rum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    } catch (_) {}
  }

  async function apiFetch(url, options) {
    const t0 = performance.now();
    const traceId = Math.random().toString(16).slice(2, 10);
    let ok = false;
    let status = 0;
    let detail = null;
    try {
      const res = await fetch(url, options);
      status = res.status;
      ok = res.ok;
      if (!ok) {
        try { detail = (await res.clone().text()).slice(0, 200); } catch (_) {}
      }
      return res;
    } catch (e) {
      detail = e.message;
      throw e;
    } finally {
      const duration = Math.round(performance.now() - t0);
      const ev = {
        ts: Date.now(), type: 'fetch', path: url, duration_ms: duration,
        ok: ok, status: status, detail: detail, trace_id: traceId,
      };
      events.push(ev);
      if (events.length > 50) events.shift();
      sendBeacon(ev);
      window.dispatchEvent(new CustomEvent('rum:event', { detail: ev }));
    }
  }

  function renderHealthInto(el) {
    if (!el) return;
    apiFetch('/api/health').then(r => r.json()).then(h => {
      el.textContent = h.status === 'ok' ? '服務正常' : '服務降級';
      el.style.color = h.status === 'ok' ? 'var(--ok)' : 'var(--danger)';
    }).catch(() => {
      el.textContent = '無法連線';
      el.style.color = 'var(--danger)';
    });
  }

  function clockInto(el) {
    if (!el) return;
    const tick = () => {
      el.textContent = new Date().toLocaleTimeString('zh-HK', { hour12: false });
    };
    tick();
    setInterval(tick, 1000);
  }

  window.RUM = { apiFetch, events, renderHealthInto, clockInto };
})();
