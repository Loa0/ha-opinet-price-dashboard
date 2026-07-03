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
// Map Card — npm-bundled Leaflet, vehicle-status-card pattern
// ================================================================
if (!customElements.get('opinet-map-card')) {
  class OpinetMapCard extends HTMLElement {
    setConfig(c) { this._cfg = { ...c }; this._destroy(); }
    set hass(h) { this._hass = h; if (this._cfg && !this._map) this._draw(); }

    connectedCallback() {
      // vehicle-status-card: register ResizeObserver early, before map init
      this._ro = new ResizeObserver(() => {
        if (this._container) this._fixSize();
      });
    }

    _fixSize() {
      if (this._map) this._map.invalidateSize(false);
    }

    _draw() {
      try { this._drawImpl(); }
      catch(e) {
        this._destroy();
        this.innerHTML = '<div style="padding:16px;color:var(--error-color,red);">지도 오류: '+e.message+'</div>';
      }
    }

    _drawImpl() {
      this._destroy();
      this.innerHTML = '';

      // vehicle-status-card: host height + display
      this.style.display = 'block';
      this.style.height = '400px';

      const isDark = this._hass && this._hass.themes && this._hass.themes.darkMode;
      const card = document.createElement('div');
      card.style.cssText = 'background:var(--ha-card-background,var(--card-background-color,#fff));border-radius:var(--ha-card-border-radius,12px);box-shadow:var(--ha-card-box-shadow,0 1px 3px rgba(0,0,0,.12));overflow:hidden;width:100%;height:100%;';

      // vehicle-status-card: .map-wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'map-wrapper';
      wrapper.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;';

      // map container
      const container = document.createElement('div');
      container.style.cssText = 'height:100%;width:100%;background:transparent!important;';

      // vehicle-status-card: dark mode via CSS variable on tiles, not container filter
      if (isDark) {
        wrapper.style.setProperty('--vic-map-tiles-filter', 'brightness(0.8) invert(0.9) contrast(2.1) brightness(2) opacity(0.27) grayscale(1)');
      }

      wrapper.appendChild(container);
      card.appendChild(wrapper);
      this.appendChild(card);
      this._container = container;

      // Style injection (vehicle-status-card CSS)
      if (!this.querySelector('.omap-style')) {
        const st = document.createElement('style');
        st.className = 'omap-style';
        st.textContent = '.leaflet-container{background:transparent!important}.map-tiles{filter:var(--vic-map-tiles-filter,none)}.leaflet-control-container{display:none}';
        this.appendChild(st);
      }

      // ResizeObserver on container
      if (this._ro) this._ro.disconnect();
      this._ro = new ResizeObserver(() => this._fixSize());
      this._ro.observe(container);

      const initMap = () => {
        if (!container.isConnected || !container.offsetParent) { setTimeout(initMap, 100); return; }
        if (this._map) { this._map.remove(); this._map = null; }
        const retina = L.Browser.retina;
        // vehicle-status-card: mapOptions
        const map = L.map(container, {
          dragging: true,
          zoomControl: false,
          scrollWheelZoom: true,
          zoom: 14,
          minZoom: 7,
        }).setView([36.5, 127.5], 14);
        // vehicle-status-card: _createTileLayer
        L.tileLayer.provider('CartoDB.Positron', {
          className: 'map-tiles',
          detectRetina: true,
          tileSize: retina ? 512 : 256,
          zoomOffset: retina ? -1 : 0,
          transparent: true,
        }).addTo(map);
        this._map = map;
        this._addMarkers();
        setTimeout(() => map.invalidateSize(false), 100);
      };
      setTimeout(initMap, 50);
    }

    _addMarkers() {
      if (!this._map) return;
      let trackers = this._findTrackers();
      if (this._cfg.devices && this._cfg.devices.length) {
        const ids = new Set(this._cfg.devices);
        trackers = trackers.filter(t => ids.has(t.eid));
      }
      let centerLat = null, centerLon = null;
      if (this._cfg.center) {
        const cs = this._hass.states[this._cfg.center];
        if (cs && cs.attributes && cs.attributes.latitude != null) {
          centerLat = cs.attributes.latitude; centerLon = cs.attributes.longitude;
        }
      }
      const bounds = [];
      for (const t of trackers) {
        const attrs = t.attributes || t;
        const lat = attrs.latitude, lon = attrs.longitude;
        if (lat == null || lon == null) continue;
        const price = attrs['가격'];
        const label = price ? Number(price).toLocaleString() + '원' : (attrs['상호명'] || '');
        const name = attrs['상호명'] || '';
        const addr = attrs['주소'] || '';
        const icon = L.divIcon({
          className: 'omarker',
          html: '<div style="background:#1976d2;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3);transform:translate(-50%,-100%);margin-top:-6px;">' + label + '</div>',
          iconSize: [0,0], iconAnchor: [0,0]
        });
        L.marker([lat, lon], { icon }).addTo(this._map)
          .bindPopup('<b>' + name + '</b><br>' + (price ? label : '') + '<br>' + addr);
        bounds.push([lat, lon]);
      }
      if (centerLat != null) this._map.setView([centerLat, centerLon], 14);
      else if (bounds.length) this._map.fitBounds(bounds, { padding: [20,20], maxZoom: 12 });
    }

    _findTrackers() {
      const list = [];
      for (const [eid, s] of Object.entries(this._hass.states)) {
        if (!eid.startsWith('device_tracker.')) continue;
        if (s.attributes['상호명']) list.push({ eid, ...s.attributes });
      }
      return list;
    }

    _destroy() {
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._map) { this._map.remove(); this._map = null; }
      this._container = null;
    }
    disconnectedCallback() { this._destroy(); }
    getCardSize() { return 6; }

    static getConfigElement() {
      const el = document.createElement('div');
      el.style.display = 'flex'; el.style.flexDirection = 'column'; el.style.gap = '8px';
      const centerPick = document.createElement('ha-entity-picker');
      centerPick.setAttribute('label', '기준 위치'); centerPick.style.display = 'block';
      el.appendChild(centerPick);
      const devPick = document.createElement('ha-entity-picker');
      devPick.setAttribute('label', '주유소 마커'); devPick.style.display = 'block';
      el.appendChild(devPick);
      el.setConfig = function(cfg) {
        centerPick.value = cfg.center || ''; devPick.value = (cfg.devices || []).join(',');
      };
      const fireChange = () => setTimeout(() => {
        const ev = new Event('config-changed', { bubbles: true, composed: true });
        ev.detail = { config: el.value }; el.dispatchEvent(ev);
      }, 0);
      centerPick.addEventListener('value-changed', fireChange);
      devPick.addEventListener('value-changed', fireChange);
      Object.defineProperty(el, 'value', { get() {
        const v = { type: 'custom:opinet-map-card' };
        if (centerPick.value) v.center = centerPick.value;
        if (devPick.value) v.devices = devPick.value.split(',').filter(Boolean);
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
