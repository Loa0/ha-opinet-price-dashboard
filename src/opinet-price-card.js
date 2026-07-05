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
      // 즐겨찾기: 순위 없음 + 주유소명 있음 + 동일 device (엔티티명 무관)
      if (includeFav && s.attributes['주유소명']) {
        if (!deviceId || !hass.entities) {
          favs.push({ eid, ...s.attributes });
        } else {
          const ent = hass.entities[eid];
          if (ent && ent.device_id === deviceId) favs.push({ eid, ...s.attributes });
        }
      }
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

// ===== navigation icons (48x48 base64) =====
const ICON_NAVER = "data:image/png;base64,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";
const ICON_KAKAOMAP = "data:image/png;base64,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";
const ICON_KAKAONAVI = "data:image/png;base64,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";
const ICON_TMAP = "data:image/png;base64,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";

// ===== navigation + popup helpers =====
const NAV = [
  { name: '네이버지도', icon: ICON_NAVER,  app: (n,lat,lng,addr) => `nmap://route?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(n)}`, web: (n,lat,lng,addr) => `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(addr)}` },
  { name: '카카오맵',  icon: ICON_KAKAOMAP, app: (n,lat,lng,addr) => `kakaomap://route?epname=${encodeURIComponent(n)}&epx=${lng}&epy=${lat}`, web: (n,lat,lng,addr) => `https://map.kakao.com/link/to/${encodeURIComponent(n)},${lat},${lng}` },
  { name: '카카오내비', icon: ICON_KAKAONAVI, app: (n,lat,lng,addr) => `kakaonavi://route?epname=${encodeURIComponent(n)}&epx=${lng}&epy=${lat}`, web: (n,lat,lng,addr) => `https://map.kakao.com/link/to/${encodeURIComponent(n)},${lat},${lng}` },
  { name: '티맵',      icon: ICON_TMAP,  app: (n,lat,lng,addr) => `tmap://route?goalname=${encodeURIComponent(n)}&goalx=${lng}&goaly=${lat}`, web: (n,lat,lng,addr) => `https://tmap.life/link/?name=${encodeURIComponent(n)}&lon=${lng}&lat=${lat}` },
];

function openNav(appUrl, webUrl) {
  const t0 = Date.now();
  window.location.href = appUrl;
  setTimeout(() => { if (Date.now() - t0 < 1500) window.location.href = webUrl; }, 1000);
}

function copyAddress(addr) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(addr).catch(() => {});
  } else {
    const ta = document.createElement('textarea');
    ta.value = addr; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
}

function showStationPopup(hass, station) {
  const name = station['주유소명'] || station['상호명'] || '';
  const price = station['가격'] ? Number(station['가격']).toLocaleString() + '원' : '';
  const addr = station['주소'] || '';
  const lat = station['위도'] || station['latitude'] || '';
  const lng = station['경도'] || station['longitude'] || '';

  const navBtns = NAV.map(n => {
    const appUrl = lat && lng ? n.app(name, lat, lng, addr) : '';
    const webUrl = lat && lng ? n.web(name, lat, lng, addr) : '';
    return `<button class="onb" onclick="event.stopPropagation();openNav('${appUrl}','${webUrl}')"><img src="${n.icon}" width="48" height="48" alt="${n.name}"><span>${n.name}</span></button>`;
  }).join('');

  const escAddr = addr.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const popup = document.createElement('div');
  popup.className = 'opinet-popup-overlay';
  popup.innerHTML = `<div class="opinet-popup">
    <button class="opinet-popup-close" onclick="this.closest('.opinet-popup-overlay').remove()">✕</button>
    <div class="opinet-popup-name">${name}</div>
    <div class="opinet-popup-price">${price}</div>
    <div class="opinet-popup-addr" onclick="copyAddress('${escAddr}');var t=this;t.style.background='var(--success-color,#4caf50)';setTimeout(function(){t.style.background=''},600)">${addr} <span style="font-size:.7em">📋</span></div>
    <div class="opinet-popup-nav">${navBtns}</div>
  </div>`;
  popup.onclick = (e) => { if (e.target === popup) popup.remove(); };
  document.body.appendChild(popup);
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
        st.textContent = '.oh{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px;font-size:1.1em;font-weight:500} .ot{width:100%;border-collapse:collapse;font-size:.95em;padding:0 8px 8px} .ow{cursor:pointer;border-bottom:1px solid var(--divider-color,#e0e0e0)} .ow:hover{background:var(--table-row-hover-background-color,rgba(0,0,0,.04))} .or1{width:32px;text-align:center;color:var(--secondary-text-color);padding:6px 4px} .or2{padding:6px 4px} .or3{text-align:right;font-weight:600;padding:6px 4px} .or4{text-align:right;color:var(--secondary-text-color);font-size:.85em;padding:6px 4px} .ous{padding:4px 16px 0;font-size:.78em;color:var(--secondary-text-color);text-align:right}' +
          '.opinet-popup-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center}' +
          '.opinet-popup{background:var(--card-background-color,#fff);color:var(--primary-text-color,#000);border-radius:16px;padding:24px;min-width:280px;max-width:90vw;max-height:90vh;overflow-y:auto;text-align:center;position:relative}' +
          '.opinet-popup-close{position:absolute;top:8px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;color:var(--secondary-text-color)}' +
          '.opinet-popup-name{font-size:1.2em;font-weight:600;margin-bottom:4px}' +
          '.opinet-popup-price{font-size:1.6em;font-weight:700;color:var(--primary-color,#1976d2);margin-bottom:8px}' +
          '.opinet-popup-addr{font-size:.85em;color:var(--secondary-text-color);cursor:pointer;padding:4px 8px;border-radius:6px;transition:background .3s;margin-bottom:16px}' +
          '.opinet-popup-nav{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}' +
          '.onb{display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#e0e0e0);border-radius:10px;padding:8px;cursor:pointer;min-width:64px;transition:background .2s}' +
          '.onb:hover{background:var(--table-row-hover-background-color,rgba(0,0,0,.04))}' +
          '.onb span{font-size:.7em;color:var(--secondary-text-color)}';
        this.appendChild(st);
      }
      const rf = this.querySelector('.oref');
      if (rf) { rf.onclick = () => this._hass.callService('button','press',{entity_id:refreshBtn}); }
      this.querySelectorAll('.ow').forEach(r => {
        r.onclick = () => {
          const eid = r.dataset.eid;
          const s = this._hass.states[eid];
          if (s) showStationPopup(this._hass, { eid, ...s.attributes });
        };
      });
    }
    getCardSize() { return 3; }
    static getConfigElement() {
      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.gap = '8px';

      // title input
      const titleInp = document.createElement('input');
      titleInp.placeholder = '제목';
      titleInp.value = '⛽ 오피넷 주유소';
      titleInp.style.cssText = 'width:100%;padding:8px;box-sizing:border-box;margin-bottom:8px;font-size:14px;border:1px solid var(--divider-color,#ccc);border-radius:4px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#000)';
      el.appendChild(titleInp);

      // device picker — input fallback + entity-picker upgrade
      const devInp = document.createElement('input');
      devInp.placeholder = '엔티티 (entity_id)';
      devInp.style.cssText = 'width:100%;padding:8px;box-sizing:border-box;margin-bottom:8px;font-size:14px;border:1px solid var(--divider-color,#ccc);border-radius:4px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#000)';
      el.appendChild(devInp);

      // usage switch — checkbox fallback
      const usageLbl = document.createElement('label');
      usageLbl.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:14px;';
      const usageCb = document.createElement('input');
      usageCb.type = 'checkbox';
      usageCb.checked = true;
      usageLbl.appendChild(usageCb);
      usageLbl.appendChild(document.createTextNode('API 사용량 표시'));
      el.appendChild(usageLbl);

      // fav switch — checkbox fallback
      const favLbl = document.createElement('label');
      favLbl.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:14px;';
      const favCb = document.createElement('input');
      favCb.type = 'checkbox';
      favLbl.appendChild(favCb);
      favLbl.appendChild(document.createTextNode('즐겨찾기 표시'));
      el.appendChild(favLbl);

      // Upgrade to HA components when available
      const upgrade = () => {
        const hasPicker = customElements.get('ha-entity-picker');
        const hasSwitch = customElements.get('ha-switch');
        if (!hasPicker && !hasSwitch) return;

        // entity-picker upgrade
        if (hasPicker) {
          const pick = document.createElement('ha-entity-picker');
          pick.setAttribute('label', '엔티티 선택');
          pick.style.display = 'block';
          pick.style.marginBottom = '8px';
          pick.value = devInp.value;
          pick.addEventListener('value-changed', () => {
            devInp.value = pick.value || '';
            fire();
          });
          devInp.replaceWith(pick);
          el._devPick = pick;
          if (el._hass) pick.hass = el._hass;
        }

        // switch upgrades
        if (hasSwitch) {
          [ { cb: usageCb, lbl: usageLbl, label: 'API 사용량 표시', key: '_usageSw', checked: true },
            { cb: favCb, lbl: favLbl, label: '즐겨찾기 표시', key: '_favSw', checked: false }
          ].forEach(({ cb, lbl, label, key, checked }) => {
            const ff = document.createElement('ha-formfield');
            ff.setAttribute('label', label);
            const sw = document.createElement('ha-switch');
            sw.checked = cb.checked;
            ff.appendChild(sw);
            sw.addEventListener('click', () => {
              setTimeout(() => { cb.checked = sw.checked; fire(); }, 0);
            });
            lbl.replaceWith(ff);
            el[key] = sw;
          });
        }
      };
      if (customElements.get('ha-entity-picker') || customElements.get('ha-switch')) {
        upgrade();
      }
      Promise.all([
        customElements.whenDefined('ha-entity-picker'),
        customElements.whenDefined('ha-switch'),
      ]).then(upgrade);

      // Accept hass
      Object.defineProperty(el, 'hass', {
        set(h) {
          el._hass = h;
          if (el._devPick) el._devPick.hass = h;
        }
      });

      el.setConfig = function(cfg) {
        titleInp.value = cfg.title || '⛽ 오피넷 주유소';
        const dv = cfg.device || '';
        if (el._devPick) el._devPick.value = dv;
        else devInp.value = dv;
        usageCb.checked = cfg.show_usage !== false;
        favCb.checked = cfg.show_fav === true;
        if (el._usageSw) el._usageSw.checked = usageCb.checked;
        if (el._favSw) el._favSw.checked = favCb.checked;
      };

      const fire = () => setTimeout(() => {
        const ev = new Event('config-changed', { bubbles: true, composed: true });
        ev.detail = { config: el.value };
        el.dispatchEvent(ev);
      }, 0);
      titleInp.addEventListener('input', fire);
      devInp.addEventListener('input', fire);
      usageCb.addEventListener('change', fire);
      favCb.addEventListener('change', fire);

      Object.defineProperty(el, 'value', { get() {
        const v = {
          type: 'custom:opinet-rank-card',
          title: titleInp.value,
          show_usage: usageCb.checked,
          show_fav: favCb.checked,
        };
        const dv = (el._devPick ? el._devPick.value : devInp.value) || '';
        if (dv) v.device = dv;
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
      let trackers = [];
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
        // dedup by 상호명 (keep first occurrence)
        if (trackers.length > 1) {
          const seen = new Set();
          trackers = trackers.filter(t => {
            const name = t['상호명'] || '';
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
          });
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
            text-align: center;
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

      // Use text inputs as fallback, upgrade to entity-picker when available
      const mkInput = (label) => {
        const inp = document.createElement('input');
        inp.placeholder = label;
        inp.style.cssText = 'width:100%;padding:8px;box-sizing:border-box;font-size:14px;border:1px solid var(--divider-color,#ccc);border-radius:4px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#000)';
        return inp;
      };

      const centerInp = mkInput('사용자 위치 (entity_id)');
      el.appendChild(centerInp);

      const opinetInp = mkInput('오피넷 주유소 (entity_id)');
      el.appendChild(opinetInp);

      // Try to upgrade to entity-picker once defined
      const upgrade = () => {
        if (customElements.get('ha-entity-picker')) {
          [ { inp: centerInp, label: '사용자 위치 (포커싱)', key: 'centerPick' },
            { inp: opinetInp, label: '오피넷 주유소', key: 'opinetPick' }
          ].forEach(({ inp, label, key }) => {
            const pick = document.createElement('ha-entity-picker');
            pick.setAttribute('label', label);
            pick.style.display = 'block';
            pick.value = inp.value;
            pick.addEventListener('value-changed', () => {
              inp.value = pick.value || '';
              inp.dispatchEvent(new Event('input', { bubbles: true }));
            });
            inp.replaceWith(pick);
            el[key] = pick;
            inp.style.display = 'none';
            // Copy current value
            pick.value = inp.value;
            // Set hass if available
            if (el._hass) pick.hass = el._hass;
          });
        }
      };
      if (customElements.get('ha-entity-picker')) {
        upgrade();
      } else {
        customElements.whenDefined('ha-entity-picker').then(upgrade);
      }

      // Accept hass from HA
      Object.defineProperty(el, 'hass', {
        set(h) {
          el._hass = h;
          if (el.centerPick) el.centerPick.hass = h;
          if (el.opinetPick) el.opinetPick.hass = h;
        }
      });

      el.setConfig = function(cfg) {
        const cv = cfg.center_tracker || '';
        const ov = cfg.opinet_tracker || '';
        if (el.centerPick) el.centerPick.value = cv;
        else centerInp.value = cv;
        if (el.opinetPick) el.opinetPick.value = ov;
        else opinetInp.value = ov;
      };

      const fire = () => setTimeout(() => {
        const ev = new Event('config-changed', { bubbles: true, composed: true });
        ev.detail = { config: el.value };
        el.dispatchEvent(ev);
      }, 0);
      centerInp.addEventListener('input', fire);
      opinetInp.addEventListener('input', fire);

      Object.defineProperty(el, 'value', { get() {
        const v = { type: 'custom:opinet-map-card' };
        const cv = (el.centerPick ? el.centerPick.value : centerInp.value) || '';
        const ov = (el.opinetPick ? el.opinetPick.value : opinetInp.value) || '';
        if (cv) v.center_tracker = cv;
        if (ov) v.opinet_tracker = ov;
        return v;
      }});
      return el;
    }
    static getStubConfig() { return { type: 'custom:opinet-map-card' }; }
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
