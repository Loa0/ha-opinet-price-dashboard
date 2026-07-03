(function(){
'use strict';

// ===== guard: prevent double-registration on HACS re-load =====
if (window.__opinetDashboardLoaded) return;
window.__opinetDashboardLoaded = true;

// ===== helpers =====
function findStations(hass, deviceArg, includeFav) {
  // resolve device_id from entity_id or direct device_id
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
      // ponytail: favorites detected by entity_id containing 'jeulgyeocajgi'
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
      // ponytail: favorites at top with star indicator, no 순위 column
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
      // styles
      if (!this.querySelector('style')) {
        const st = document.createElement('style');
        st.textContent = '.oh{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px;font-size:1.1em;font-weight:500} .ot{width:100%;border-collapse:collapse;font-size:.95em;padding:0 8px 8px} .ow{cursor:pointer;border-bottom:1px solid var(--divider-color,#e0e0e0)} .ow:hover{background:var(--table-row-hover-background-color,rgba(0,0,0,.04))} .or1{width:32px;text-align:center;color:var(--secondary-text-color);padding:6px 4px} .or2{padding:6px 4px} .or3{text-align:right;font-weight:600;padding:6px 4px} .or4{text-align:right;color:var(--secondary-text-color);font-size:.85em;padding:6px 4px} .ous{padding:4px 16px 0;font-size:.78em;color:var(--secondary-text-color);text-align:right}';
        this.appendChild(st);
      }
      // events
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

      // ponytail: no domain filter — user picks whatever entity, findStations resolves device_id
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

      // ponytail: setTimeout — ha-switch click fires before checked updates
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
// Map Card — uses HA's built-in Leaflet (window.L from hui-map-card)
// ================================================================
if (!customElements.get('opinet-map-card')) {
  class OpinetMapCard extends HTMLElement {
    setConfig(c) { this._cfg = { ...c }; if (this._map) { this._map.remove(); this._map = null; } }
    set hass(h) { this._hass = h; if (this._cfg) this._initMap(); }
    _initMap() {
      if (this._map) return;
      if (!this.querySelector('.omap')) {
        // ponytail: outer clips overflow, inner is Leaflet target (no overflow:hidden on Leaflet)
        this.innerHTML = '<div style="height:400px;overflow:hidden;"><div class="omap" style="height:100%;"></div></div>';
      }
      const container = this.querySelector('.omap');
      if (!container || !container.offsetParent) { setTimeout(() => this._initMap(), 100); return; }
      if (typeof L === 'undefined') { setTimeout(() => this._initMap(), 200); return; }
      this._map = L.map(container, { attributionControl: false }).setView([36.5, 127.5], 14);
      L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}' + (L.Browser.retina ? '@2x' : '') + '.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
      }).addTo(this._map);
      let trackers = this._findTrackers();
      // ponytail: filter by configured entity IDs
      if (this._cfg.devices && this._cfg.devices.length) {
        const ids = new Set(this._cfg.devices);
        trackers = trackers.filter(t => ids.has(t.eid));
      }
      // ponytail: center on configured entity
      let centerLat = null, centerLon = null;
      if (this._cfg.center) {
        const cs = this._hass.states[this._cfg.center];
        if (cs && cs.attributes && cs.attributes.latitude != null) {
          centerLat = cs.attributes.latitude; centerLon = cs.attributes.longitude;
        }
      }
      const bounds = [];
      for (const t of trackers) {
        const lat = t.attributes ? t.attributes.latitude : t.latitude;
        const lon = t.attributes ? t.attributes.longitude : t.longitude;
        if (lat == null || lon == null) continue;
        const price = t['가격'] || (t.attributes && t.attributes['가격']);
        const label = price ? Number(price).toLocaleString() + '원' : '';
        const name = t['상호명'] || (t.attributes && t.attributes['상호명']) || '';
        const addr = t['주소'] || (t.attributes && t.attributes['주소']) || '';
        const icon = L.divIcon({
          className: 'omarker',
          html: '<div style="background:#1976d2;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3);transform:translate(-50%,-100%);margin-top:-6px;">' + label + '</div>',
          iconSize: [0,0], iconAnchor: [0,0]
        });
        L.marker([lat, lon], { icon }).addTo(this._map)
          .bindPopup('<b>' + name + '</b><br>' + label + '<br>' + addr);
        bounds.push([lat, lon]);
      }
      if (centerLat != null) this._map.setView([centerLat, centerLon], 14);
      else if (bounds.length) this._map.fitBounds(bounds, { padding: [20,20] });
      new ResizeObserver(() => this._map && this._map.invalidateSize()).observe(container);
    }
    _findTrackers() {
      const list = [];
      for (const [eid, s] of Object.entries(this._hass.states)) {
        if (!eid.startsWith('device_tracker.')) continue;
        if (s.attributes['상호명']) list.push({ eid, ...s.attributes });
      }
      return list;
    }
    getCardSize() { return 6; }
    // ponytail: copy rank card editor pattern
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

// ===== HA registry (dedup safe) =====
window.customCards = window.customCards || [];
const registered = window.customCards.map(c => c.type);
if (!registered.includes('opinet-rank-card')) {
  window.customCards.push({ type: 'opinet-rank-card', name: 'Opinet Rank Card', description: '오피넷 주유소 랭킹보드' });
}
if (!registered.includes('opinet-map-card')) {
  window.customCards.push({ type: 'opinet-map-card', name: 'Opinet Map Card', description: '오피넷 주유소 지도' });
}

})();
