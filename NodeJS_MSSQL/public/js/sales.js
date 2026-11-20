(function () {
  'use strict';
  const { apiFetch, renderHealthInto, clockInto } = window.RUM;
  renderHealthInto(document.getElementById('healthText'));
  clockInto(document.getElementById('clock'));
  setInterval(() => renderHealthInto(document.getElementById('healthText')), 5000);

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const money = v => 'HK$' + Math.round(Number(v) || 0).toLocaleString('en-US');

  async function loadProperties() {
    const t0 = performance.now();
    try {
      const res = await apiFetch('/api/properties');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const list = await res.json();
      $('propCount').textContent = list.length;
      $('propGrid').innerHTML = list.map((p, i) => `
        <a class="prop-card" href="/property.html?id=${encodeURIComponent(p.id)}">
          <div class="prop-card-top"></div>
          <div class="prop-card-body">
            <div class="prop-cat">${i === 0 ? '最新推出 · ' : ''}${esc(p.category)} / ${esc(p.type)}</div>
            <div class="prop-name">${esc(p.name)}</div>
            <div class="prop-zh">${esc(p.nameZh)}</div>
            <div class="prop-tag">${esc(p.tagline)}</div>
            <div class="prop-addr">${esc(p.address)}</div>
          </div>
          <div class="prop-card-foot"><span>${esc(p.district)}</span><span>詳情 ${p.schoolNet && p.schoolNet !== '—' ? '· 校網 ' + esc(p.schoolNet) : ''} →</span></div>
        </a>`).join('');
      // hero uses first property
      const first = list[0];
      if (first) {
        document.querySelector('#heroProperty h1').innerHTML = esc(first.name) + ' <span style="font-size:.5em;font-weight:300">' + esc(first.nameZh) + '</span>';
        document.querySelector('#heroProperty .tagline').textContent = first.tagline;
        document.querySelector('#heroProperty .addr').textContent = first.address + ' · ' + first.details;
      }
    } catch (e) {
      $('propGrid').innerHTML = '<div class="empty" style="grid-column:1/-1;color:var(--danger)">無法載入物業資料：' + esc(e.message) + '<br><span style="font-size:11px;color:var(--muted)">請檢查 APM 觀測台的錯誤日誌</span></div>';
    }
  }

  async function loadDocuments() {
    const t0 = performance.now();
    try {
      const res = await apiFetch('/api/documents');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const docs = await res.json();
      $('docMeta').textContent = docs.length + ' 份文件';
      $('docRows').innerHTML = docs.map(d => `
        <tr>
          <td><a href="/document.html?id=${d.id}" class="mono">${esc(d.reference)}</a></td>
          <td>${esc(d.property_address)}</td><td>${esc(d.city)}</td><td>${esc(d.property_type)}</td>
          <td class="num">${money(d.price)}</td>
          <td class="mono">${esc(String(d.sale_date).slice(0, 10))}</td>
          <td><span class="badge ${esc(d.status)}">${esc(d.status)}</span></td>
          <td>${esc(d.document_type)}</td>
        </tr>`).join('');
      $('renderInfo').textContent = '文件查詢 ' + Math.round(performance.now() - t0) + 'ms';
    } catch (e) {
      $('docMeta').textContent = '錯誤';
      $('docRows').innerHTML = '<tr><td colspan="8" class="empty" style="color:var(--danger)">無法載入銷售文件：' + esc(e.message) + ' · 已記錄至 APM</td></tr>';
    }
  }

  $('btnReload').addEventListener('click', () => { loadProperties(); loadDocuments(); });
  loadProperties();
  loadDocuments();
})();
