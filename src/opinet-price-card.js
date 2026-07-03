import L from 'leaflet';
import 'leaflet-providers';
import leafletCSS from 'leaflet/dist/leaflet.css';

(function(){
'use strict';

if (window.__opinetDashboardLoaded) return;
window.__opinetDashboardLoaded = true;

// Inject Leaflet CSS
if (!document.getElementById('leaflet-css')) {
  const style = document.createElement('style');
  style.id = 'leaflet-css';
  style.textContent = leafletCSS;
  document.head.appendChild(style);
}

// ===== helpers =====
function findStations(hass, deviceArg, includeFav) {
  let deviceId = null;
  if (deviceArg && hass.entities) {
    const ent = hass.entities[deviceArg];
    deviceId = ent ? (ent.device_id || null) : deviceArg;
  }
  const list = [];
  const favs = [];
  for (const [eid, s] of Object.entries(hass.states)) {
    if (!eid.startsWith('sensor.')) continue;
    if (s.attributes['순위'] == null) {
      if (includeFav && /jeulgyeocajgi/.test(eid)) favs.push({ eid, ...s.attributes });
      continue;
    }
    if (deviceId && hass.entities) {
      const ent = hass.entities[eid];
      if (!ent || ent.device_id !== deviceId) continue;
    }
    list.push({ eid, ...s.attributes });
  }
  list.sort((a, b) => (a['순위']||99) - (b['순위']||99));
  favs.sort((a, b) => (a.eid||'').localeCompare(b.eid));
  return { stations: list, favorites: favs };
}

function findRefreshButton(hass) {
  for (const eid of Object.keys(hass.states)) {
    if (eid.startsWith('button.') && /opine[ts]/.test(eid)) return eid;
  }
  return null;
}

function findUsage(hass) {
  for (const eid of Object.keys(hass.states)) {
    if (eid.startsWith('sensor.') && /opine[ts]/.test(eid) && /api|sayong|usage/i.test(eid)) return eid;
  }
  return null;
}

// ================================================================
// Rank Card
// ================================================================
if (!customElements.get('opinet-rank-card')) {
  class OpinetRankCard extends HTMLElement {
    setConfig(c) { this._cfg = { title: '⛽ 오피넷 주유소', show_usage: true, show_fav: false, ...c }; }
    set hass(h) { this._hass = h; if (this._cfg) this._draw(); }
    _draw() {
      const { stations, favorites } = findStations(this._hass, this._cfg.device, this._cfg.show_fav);
      const refreshBtn = findRefreshButton(this._hass);
      const usageEid = findUsage(this._hass);
      let rows = '';
      if (favorites.length) {
        for (const s of favorites) {
          const p = s['가격'] ? Number(s['가격']).toLocaleString() : '-';
          const d = s['거리'] || '-';
          rows += `<tr class="ow ofav" data-eid="${s.eid}"><td class="or1">★</td><td class="or2">${s['주유소명']||'-'}</td><td class="or3">${p}원</td><td class="or4">${d}</td></tr>`;
        }
      }
      if (stations.length) {
        for (const s of stations) {
          const p = s['가격'] ? Number(s['가격']).toLocaleString() : '-';
          const d = s['거리'] || '-';
          rows += `<tr class="ow" data-eid="${s.eid}"><td class="or1">${s['순위']}위</td><td class="or2">${s['주유소명']||'-'}</td><td class="or3">${p}원</td><td class="or4">${d}</td></tr>`;
        }
      } else {
        rows = '<tr><td colspan="4" style="text-align:center;padding:16px;">데이터 없음</td></tr>';
      }
      const refreshHtml = refreshBtn ? '<ha-icon-button class="oref"><ha-icon icon="mdi:refresh"></ha-icon></ha-icon-button>' : '';
      let usageHtml = '';
      if (this._cfg.show_usage && usageEid) {
        const u = this._hass.states[usageEid];
        if (u) usageHtml = `<div class="ous">${u.state}</div>`;
      }
      this.innerHTML = `<ha-card>
        <div class="oh"><span>${this._cfg.title}</span>${refreshHtml}</div>
        <table class="ot">${rows}</table>${usageHtml}
      </ha-card>`;
      if (!this.querySelector('style')) {
        const st = document.createElement('style');
        st.textContent = '.oh{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px;font-size:1.1em;font-weight:500} .ot{width:100%;border-collapse:collapse;font-size:.95em;padding:0 8px 8px} .ow{cursor:pointer;border-bottom:1px solid var(--divider-color,#e0e0e0)} .ow:hover{background:var(--table-row-hover-background-color,rgba(0,0,0,.04))} .or1{width:32px;text-align:center;color:var(--secondary-text-color);padding:6px 4px} .or2{padding:6px 4px} .or3{text-align:right;font-weight:600;padding:6px 4px} .or4{text-align:right;color:var(--secondary-text-color);font-size:.85em;padding:6px 4px} .ous{padding:4px 16px 0;font-size:.78em;color:var(--secondary-text-color);text-align:right}';
        this.appendChild(st);
      }
      const rf = this.querySelector('.oref');
      if (rf) { rf.onclick = () => this._hass.callService('button','press',{entity_id:refreshBtn}); }
      this.querySelectorAll('.ow').forEach(r => {
        r.onclick = () => this.dispatchEvent(new CustomEvent('hass-more-info',{bubbles:true,composed:true,detail:{entityId:r.dataset.eid}}));
      });
    }
    getCardSize() { return 3; }
    static getConfigElement() {
      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '8px';
      el.innerHTML = `
        <input placeholder="제목" value="⛽ 오피넷 주유소" style="width:100%;padding:8px;box-sizing:border-box;margin-bottom:8px;font-size:14px;border:1px solid var(--divider-color,#ccc);border-radius:4px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#000)">
        <ha-formfield label="API 사용량 표시">
          <ha-switch checked></ha-switch>
        </ha-formfield>
        <ha-formfield label="즐겨찾기 표시">
          <ha-switch></ha-switch>
        </ha-formfield>
      `;
      const titleInp = el.querySelectorAll('input')[0];
      const usageSw = el.querySelectorAll('ha-switch')[0];
      const favSw = el.querySelectorAll('ha-switch')[1];
      const devPick = document.createElement('ha-entity-picker');
      devPick.setAttribute('label', '엔티티 선택');
      devPick.style.display = 'block';
      devPick.style.marginBottom = '8px';
      el.insertBefore(devPick, el.querySelector('ha-formfield'));
      el.setConfig = function(cfg) {
        titleInp.value = cfg.title || '⛽ 오피넷 주유소';
        devPick.value = cfg.device || '';
        usageSw.checked = cfg.show_usage !== false;
        favSw.checked = cfg.show_fav === true;
      };
      const fireChange = () => {
        setTimeout(() => {
          const ev = new Event('config-changed', { bubbles: true, composed: true });
          ev.detail = { config: el.value };
          el.dispatchEvent(ev);
        }, 0);
      };
      titleInp.addEventListener('input', fireChange);
      devPick.addEventListener('value-changed', fireChange);
      usageSw.addEventListener('click', fireChange);
      favSw.addEventListener('click', fireChange);
      Object.defineProperty(el, 'value', { get() {
        const v = { type: 'custom:opinet-rank-card', title: titleInp.value, show_usage: usageSw.checked, show_fav: favSw.checked };
        if (devPick.value) v.device = devPick.value;
        return v;
      }});
      return el;
    }
    static getStubConfig() {
      return { title: '⛽ 오피넷 주유소', show_usage: true, show_fav: false };
    }
  }
  customElements.define('opinet-rank-card', OpinetRankCard);
}

// ================================================================
// Map Card — vehicle-status-card Shadow DOM 패턴
// ================================================================
if (!customElements.get('opinet-map-card')) {
  class OpinetMapCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    setConfig(c) { this._cfg = c; }

    set hass(h) {
      this._hass = h;
      if (!this._cfg) return;

      // center tracker (user location)
      let centerLat = null, centerLon = null;
      if (this._cfg.center_tracker) {
        const cs = h.states[this._cfg.center_tracker];
        if (cs && cs.attributes.latitude != null) {
          centerLat = cs.attributes.latitude;
          centerLon = cs.attributes.longitude;
        }
      }

      // opinet trackers (gas stations) by device_id
      const trackers = [];
      if (this._cfg.opinet_tracker && h.entities && h.entities[this._cfg.opinet_tracker]) {
        const deviceId = h.entities[this._cfg.opinet_tracker].device_id;
        if (deviceId) {
          for (const [eid, s] of Object.entries(h.states)) {
            if (!eid.startsWith('device_tracker.')) continue;
            if (!s.attributes['상호명']) continue;
            const ent = h.entities[eid];
            if (!ent || ent.device_id !== deviceId) continue;
            trackers.push({ eid, ...s.attributes });
          }
        }
      }

      // if nothing to show, skip
      if (!centerLat && !trackers.length) return;

      if (!this._map) {
        this._centerLat = centerLat;
        this._centerLon = centerLon;
        this._trackers = trackers;
        this._draw();
      }
    }

    _draw() {
      this.style.display = 'block';
      this.style.height = (this._cfg.height || 400) + 'px';

      const isDark = this._hass && this._hass.themes && this._hass.themes.darkMode;
      const tileFilter = isDark
        ? '--vic-map-tiles-filter:brightness(0.8) invert(0.9) contrast(2.1) brightness(2) opacity(0.27) grayscale(1)'
        : '--vic-map-tiles-filter:none';

      this.shadowRoot.innerHTML = `
        <style>${leafletCSS}</style>
        <style>
          :host {
            display: block;
            width: 100%;
            height: 100%;
            border-radius: var(--ha-card-border-radius, 12px);
            overflow: hidden;
            background: var(--ha-card-background, var(--card-background-color, #fff));
            box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0,0,0,.12));
          }
          .leaflet-container { background: transparent !important; }
          .map-tiles { filter: var(--vic-map-tiles-filter, none); }
          .leaflet-control-container { display: none; }
          #omap { height: 100%; width: 100%; background: transparent !important; }
          .oprice {
            background: #1976d2 !important;
            color: #fff !important;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,.3);
            border: none !important;
            width: auto !important;
            height: auto !important;
          }
          .ouser {
            background: transparent !important;
            border: none !important;
            width: 16px !important;
            height: 16px !important;
          }
          .ouser::after {
            content: '';
            position: absolute;
            width: 16px; height: 16px;
            background: #ff9800;
            border: 3px solid #fff;
            border-radius: 50%;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 1px 4px rgba(0,0,0,.4);
          }
        </style>
        <div id="omap" style="${tileFilter}"></div>
      `;

      const c = this.shadowRoot.getElementById('omap');
      const zoom = this._cfg.zoom || 14;
      const map = L.map(c, {
        dragging: true,
        zoomControl: false,
        scrollWheelZoom: true,
      }).setView([36.5, 127.5], zoom);

      L.tileLayer.provider('CartoDB.Positron', {
        className: 'map-tiles',
        detectRetina: true,
        tileSize: L.Browser.retina ? 512 : 256,
        zoomOffset: L.Browser.retina ? -1 : 0,
        transparent: true,
      }).addTo(map);

      // center marker (user location) — orange dot
      if (this._centerLat != null) {
        L.marker([this._centerLat, this._centerLon], {
          icon: L.divIcon({ className: 'ouser', iconSize: [16, 16], iconAnchor: [8, 8] }),
        }).addTo(map);
        map.setView([this._centerLat, this._centerLon], zoom);
      }

      // opinet price markers
      this._markers = [];
      const bounds = [];
      for (const t of this._trackers) {
        const lat = t.latitude, lon = t.longitude;
        if (lat == null || lon == null) continue;
        const price = t['가격'] ? Number(t['가격']).toLocaleString() + '원' : '';
        const name = t['상호명'] || '';
        const addr = t['주소'] || '';
        const icon = L.divIcon({
          className: 'oprice',
          html: price,
          iconSize: null,
          iconAnchor: null,
        });
        const marker = L.marker([lat, lon], { icon }).addTo(map);
        if (price || name) {
          marker.bindPopup('<b>' + name + '</b><br>' + price + '<br>' + addr);
        }
        this._markers.push(marker);
        bounds.push([lat, lon]);
      }
      // fitBounds only if there are price markers AND no center tracker focus
      if (bounds.length && this._centerLat == null) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      this._map = map;

      this._ro = new ResizeObserver(() => map.invalidateSize(false));
      this._ro.observe(c);
    }

    disconnectedCallback() {
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._map) { this._map.remove(); this._map = null; }
      this._markers = null;
    }

    getCardSize() { return 6; }

    static getConfigElement() {
      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '8px';

      const centerPick = document.createElement('ha-entity-picker');
      centerPick.setAttribute('label', '사용자 위치 (포커싱)');
      centerPick.style.display = 'block';
      el.appendChild(centerPick);

      const opinetPick = document.createElement('ha-entity-picker');
      opinetPick.setAttribute('label', '오피넷 주유소');
      opinetPick.style.display = 'block';
      el.appendChild(opinetPick);

      el.setConfig = function(cfg) {
        centerPick.value = cfg.center_tracker || '';
        opinetPick.value = cfg.opinet_tracker || '';
      };

      const fire = () => setTimeout(() => {
        const ev = new Event('config-changed', { bubbles: true, composed: true });
        ev.detail = { config: el.value };
        el.dispatchEvent(ev);
      }, 0);
      centerPick.addEventListener('value-changed', fire);
      opinetPick.addEventListener('value-changed', fire);

      Object.defineProperty(el, 'value', { get() {
        const v = { type: 'custom:opinet-map-card' };
        if (centerPick.value) v.center_tracker = centerPick.value;
        if (opinetPick.value) v.opinet_tracker = opinetPick.value;
        return v;
      }});
      return el;
    }
    static getStubConfig() { return {}; }
  }
  customElements.define('opinet-map-card', OpinetMapCard);
}

// ===== HA registry =====
window.customCards = window.customCards || [];
const registered = window.customCards.map(c => c.type);
if (!registered.includes('opinet-rank-card')) {
  window.customCards.push({ type: 'opinet-rank-card', name: 'Opinet Rank Card', description: '오피넷 주유소 랭킹보드' });
}
if (!registered.includes('opinet-map-card')) {
  window.customCards.push({ type: 'opinet-map-card', name: 'Opinet Map Card', description: '오피넷 주유소 지도' });
}

})();
