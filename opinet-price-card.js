// ============================================================
// Opinet Price Dashboard — HA Lovelace Custom Cards
// 랭킹보드 + 지도카드
// ============================================================

// ===== Leaflet loader =====
const _OPINET_LEAFLET_LOADED = Symbol();
function _opinetLoadLeaflet() {
  if (window[_OPINET_LEAFLET_LOADED]) return;
  window[_OPINET_LEAFLET_LOADED] = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  document.head.appendChild(script);
}

// ===== Helpers =====
function _opinetFindStations(hass) {
  const stations = [];
  for (const [eid, state] of Object.entries(hass.states)) {
    if (eid.startsWith('sensor.') && state.attributes.순위) {
      stations.push({ ...state.attributes, entity_id: eid });
    }
  }
  stations.sort((a, b) => (a.순위 || 99) - (b.순위 || 99));
  return stations;
}

function _opinetFindRefreshButton(hass) {
  for (const eid of Object.keys(hass.states)) {
    if (eid.startsWith('button.opinet_price_refresh')) return eid;
  }
  return null;
}

function _opinetFindUsageSensor(hass) {
  for (const eid of Object.keys(hass.states)) {
    if (eid.startsWith('sensor.opinet_price_api_usage')) return eid;
  }
  return null;
}

function _opinetFindDeviceTrackers(hass, deviceId) {
  const trackers = [];
  for (const [eid, entity] of Object.entries(hass.entities || {})) {
    if (entity.device_id === deviceId && entity.platform === 'device_tracker') {
      const state = hass.states[eid];
      if (state && state.attributes.latitude) {
        trackers.push({ entity_id: eid, state, attrs: state.attributes });
      }
    }
  }
  return trackers;
}

// ============================================================
// 1. Opinet Rank Card
// ============================================================
class OpinetRankCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
  }

  setConfig(config) {
    this._config = {
      title: '⛽ 오피넷 주유소',
      show_usage: true,
      ...config,
    };
  }

  set hass(hass) {
    if (!this._config) return;
    this._hass = hass;
    this._render();
  }

  _render() {
    if (!this._hass) return;
    const stations = _opinetFindStations(this._hass);
    const refreshBtn = _opinetFindRefreshButton(this._hass);
    const usageSensor = _opinetFindUsageSensor(this._hass);

    let content = '';
    if (stations.length === 0) {
      content = '<div style="padding:16px;text-align:center;color:var(--secondary-text-color);">데이터가 없습니다</div>';
    } else {
      content = '<table style="width:100%;border-collapse:collapse;font-size:0.95em;">';
      for (const s of stations) {
        const price = s.가격 ? Number(s.가격).toLocaleString() : '-';
        const dist = s.거리 || '-';
        content += `<tr class="opinet-rank-row" data-entity="${s.entity_id}" style="cursor:pointer;border-bottom:1px solid var(--divider-color,#e0e0e0);">
          <td style="width:32px;text-align:center;color:var(--secondary-text-color);padding:6px 4px;">${s.순위 || '-'}위</td>
          <td style="padding:6px 4px;">${s.주유소명 || '-'}</td>
          <td style="text-align:right;font-weight:600;padding:6px 4px;">${price}원</td>
          <td style="text-align:right;color:var(--secondary-text-color);font-size:0.85em;padding:6px 4px;">${dist}</td>
        </tr>`;
      }
      content += '</table>';
    }

    let footer = '';
    if (this._config.show_usage && usageSensor) {
      const u = this._hass.states[usageSensor];
      footer += `<div style="padding:4px 16px 0;font-size:0.78em;color:var(--secondary-text-color);text-align:right;">${u.state}</div>`;
    }

    const headerRight = refreshBtn
      ? `<mwc-button dense @click="${(e) => { e.stopPropagation(); this._refresh(refreshBtn); }}">🔄</mwc-button>`
      : '';

    this.innerHTML = `
      <ha-card>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;">
          <div style="font-size:1.1em;font-weight:500;">${this._config.title}</div>
          ${headerRight}
        </div>
        <div style="padding:0 8px 8px;">${content}</div>
        ${footer}
      </ha-card>
    `;

    // hover effect
    const style = document.createElement('style');
    style.textContent = `.opinet-rank-row:hover { background: var(--table-row-hover-background-color, rgba(0,0,0,0.04)); }`;
    this.appendChild(style);

    // click → more-info
    this.querySelectorAll('.opinet-rank-row').forEach(row => {
      row.addEventListener('click', (e) => {
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          bubbles: true, composed: true,
          detail: { entityId: row.dataset.entity },
        }));
      });
    });
  }

  _refresh(btnEntity) {
    if (this._hass) {
      this._hass.callService('button', 'press', { entity_id: btnEntity });
    }
  }

  getCardSize() { return 3; }
}

customElements.define('opinet-rank-card', OpinetRankCard);

// ============================================================
// 2. Opinet Map Card
// ============================================================
class OpinetMapCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._map = null;
    this._markers = [];
  }

  setConfig(config) {
    if (!config.device_id) {
      throw new Error('device_id required — find it under Settings → Devices → 오피넷 주유소');
    }
    this._config = { ...config };
  }

  set hass(hass) {
    if (!this._config) return;
    this._hass = hass;
    _opinetLoadLeaflet();
    this._render();
  }

  _render() {
    const trackers = _opinetFindDeviceTrackers(this._hass, this._config.device_id);
    const container = document.createElement('div');
    container.style.height = '400px';
    container.id = `opinet-map-${Math.random().toString(36).slice(2)}`;

    this.innerHTML = '';
    this.appendChild(container);

    // wait for Leaflet
    const initMap = () => {
      if (typeof L === 'undefined') { setTimeout(initMap, 100); return; }
      if (!container.offsetParent) { setTimeout(initMap, 100); return; }

      if (this._map) { this._map.remove(); }
      this._map = L.map(container.id, { attributionControl: false }).setView([36.5, 127.5], 7);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(this._map);

      const bounds = [];
      for (const t of trackers) {
        const lat = t.state.attributes.latitude;
        const lon = t.state.attributes.longitude;
        if (lat == null || lon == null) continue;

        const label = t.attrs.가격표시 || t.attrs.가격 ? `${Number(t.attrs.가격).toLocaleString()}원` : '';
        const name = t.attrs.상호명 || t.state.attributes.friendly_name || '';

        const icon = L.divIcon({
          className: 'opinet-map-marker',
          html: `<div style="background:#1976d2;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${label}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([lat, lon], { icon }).addTo(this._map);
        marker.bindPopup(`<b>${name}</b><br>${label}<br>${t.attrs.주소 || ''}`);
        this._markers.push(marker);
        bounds.push([lat, lon]);
      }

      if (bounds.length > 0) {
        this._map.fitBounds(bounds, { padding: [20, 20] });
      } else {
        this._map.setView([36.5, 127.5], 7);
      }
    };

    initMap();
  }

  getCardSize() { return 6; }
}

customElements.define('opinet-map-card', OpinetMapCard);

// ===== HA Custom Card Registry =====
window.customCards = window.customCards || [];
window.customCards.push(
  {
    type: 'opinet-rank-card',
    name: 'Opinet Rank Card',
    description: '오피넷 주유소 랭킹보드 (갱신버튼 포함)',
  },
  {
    type: 'opinet-map-card',
    name: 'Opinet Map Card',
    description: '오피넷 주유소 지도 (기기단위 등록, 가격 마커)',
  }
);
