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

// Inject popup CSS globally (not per-card)
if (!document.getElementById('opinet-popup-css')) {
  const ps = document.createElement('style');
  ps.id = 'opinet-popup-css';
  ps.textContent = '.opinet-popup-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:2147483647;isolation:isolate;display:flex;align-items:center;justify-content:center}' +
    '.opinet-popup{background:var(--card-background-color,#fff);color:var(--primary-text-color,#000);border-radius:16px;padding:24px;min-width:280px;max-width:90vw;max-height:90vh;overflow-y:auto;text-align:center;position:relative}' +
    '.opinet-popup-close{position:absolute;top:8px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;color:var(--secondary-text-color)}' +
    '.opinet-popup-name{font-size:1.2em;font-weight:600;margin-bottom:4px}' +
    '.opinet-popup-price{font-size:1.6em;font-weight:700;color:var(--primary-color,#1976d2);margin-bottom:8px}' +
    '.opinet-popup-addr{font-size:.85em;color:var(--secondary-text-color);cursor:pointer;padding:4px 8px;border-radius:6px;transition:background .3s;margin-bottom:16px}' +
    '.opinet-popup-nav{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}' +
    '.onb{display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#e0e0e0);border-radius:10px;padding:8px;cursor:pointer;min-width:64px;transition:background .2s}' +
    '.onb:hover{background:var(--table-row-hover-background-color,rgba(0,0,0,.04))}' +
    '.onb span{font-size:.7em;color:var(--secondary-text-color)}';
  document.head.appendChild(ps);
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

// ===== navigation icons (48x48 SVG) =====
const ICON_NAVER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#03C75A"/><text x="24" y="33" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="Arial">N</text></svg>');
const ICON_KAKAOMAP = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#FEE500"/><text x="24" y="33" text-anchor="middle" fill="#191919" font-size="28" font-weight="bold" font-family="Arial">K</text></svg>');
const ICON_KAKAONAVI = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#FEE500"/><text x="24" y="33" text-anchor="middle" fill="#191919" font-size="28" font-weight="bold" font-family="Arial">K</text></svg>');
const ICON_TMAP = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#3A5FCD"/><text x="24" y="33" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="Arial">T</text></svg>');

// ===== navigation + popup helpers =====
const NAV = [
  { name: '네이버지도', icon: ICON_NAVER,  app: (n,lat,lng,addr) => `nmap://route?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(n)}`, web: (n,lat,lng,addr) => `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(addr)}` },
  { name: '카카오맵',  icon: ICON_KAKAOMAP, app: (n,lat,lng,addr) => `kakaomap://route?ep=${lat},${lng}`, web: (n,lat,lng,addr) => `https://map.kakao.com/link/to/${encodeURIComponent(n)},${lat},${lng}` },
  { name: '카카오내비', icon: ICON_KAKAONAVI, app: (n,lat,lng,addr) => `kakaonavi://navigate?name=${encodeURIComponent(n)}&x=${lng}&y=${lat}`, web: (n,lat,lng,addr) => `https://map.kakao.com/link/to/${encodeURIComponent(n)},${lat},${lng}` },
  { name: '티맵',      icon: ICON_TMAP,  app: (n,lat,lng,addr) => `tmap://route?goalname=${encodeURIComponent(n)}&goalx=${lng}&goaly=${lat}`, web: (n,lat,lng,addr) => `https://map.kakao.com/link/to/${encodeURIComponent(n)},${lat},${lng}` },
];

function openNav(appUrl, webUrl) {
  window.open(appUrl, '_blank');
  setTimeout(function() { window.open(webUrl, '_blank'); }, 2000);
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
  // remove any existing dialog first
  const old = document.querySelector('.opinet-popup-overlay');
  if (old) old.remove();

  const name = station['주유소명'] || station['상호명'] || '';
  const price = station['가격'] ? Number(station['가격']).toLocaleString() + '원' : '';
  const addr = station['주소'] || '';
  const lat = station['위도'] || station['latitude'] || '';
  const lng = station['경도'] || station['longitude'] || '';

  const navBtns = NAV.map((n, i) => {
    const appUrl = lat && lng ? n.app(name, lat, lng, addr) : '';
    const webUrl = lat && lng ? n.web(name, lat, lng, addr) : '';
    return `<button class="onb" data-nav="${i}" data-app="${appUrl.replace(/"/g,'&quot;')}" data-web="${webUrl.replace(/"/g,'&quot;')}"><img src="${n.icon}" width="48" height="48" alt="${n.name}"><span>${n.name}</span></button>`;
  }).join('');

  const popup = document.createElement('div');
  popup.className = 'opinet-popup-overlay';
  popup.innerHTML = '<div class="opinet-popup">' +
    '<button class="opinet-popup-close">✕</button>' +
    '<div class="opinet-popup-name">' + name + '</div>' +
    '<div class="opinet-popup-price">' + price + '</div>' +
    '<div class="opinet-popup-addr">' + addr + ' <span style="font-size:.7em">📋</span></div>' +
    '<div class="opinet-popup-nav">' + navBtns + '</div>' +
    '</div>';
  popup.querySelector('.opinet-popup-close').onclick = () => popup.remove();
  popup.onclick = (e) => { if (e.target === popup) popup.remove(); };
  popup.querySelector('.opinet-popup-addr').onclick = function() {
    const a = addr;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(a).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = a; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    this.style.background = 'var(--success-color,#4caf50)';
    setTimeout(() => { this.style.background = ''; }, 600);
  };
  popup.querySelectorAll('.onb').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openNav(btn.dataset.app, btn.dataset.web);
    };
  });
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
        st.textContent = '.oh{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px;font-size:1.1em;font-weight:500} .ot{width:100%;border-collapse:collapse;font-size:.95em;padding:0 8px 8px} .ow{cursor:pointer;border-bottom:1px solid var(--divider-color,#e0e0e0)} .ow:hover{background:var(--table-row-hover-background-color,rgba(0,0,0,.04))} .or1{width:32px;text-align:center;color:var(--secondary-text-color);padding:6px 4px} .or2{padding:6px 4px} .or3{text-align:right;font-weight:600;padding:6px 4px} .or4{text-align:right;color:var(--secondary-text-color);font-size:.85em;padding:6px 4px} .ous{padding:4px 16px 0;font-size:.78em;color:var(--secondary-text-color);text-align:right}';
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
        marker.on('click', () => {
          showStationPopup(this._hass, {
            '주유소명': name,
            '가격': t['가격'],
            '주소': addr,
            '위도': lat,
            '경도': lon,
          });
        });
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
