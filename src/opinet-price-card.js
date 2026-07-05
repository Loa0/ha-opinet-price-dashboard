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

// ===== navigation icons (48x48 potrace SVG from original PNG) =====
const ICON_NAVER = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2248%22%20height%3D%2248%22%20viewBox%3D%220%200%20480%20480%22%3E%3Cpath%20fill%3D%22%2303C75A%22%20d%3D%22M0%20240%20l0%20-240%20240%200%20240%200%200%20240%200%20240%20-240%200%20-240%200%200%20-240z%20m243%0A213%20c-7%20-2%20-19%20-2%20-25%200%20-7%203%20-2%205%2012%205%2014%200%2019%20-2%2013%20-5z%20m25%20-20%20c-10%20-2%0A-28%20-2%20-40%200%20-13%202%20-5%204%2017%204%2022%201%2032%20-1%2023%20-4z%20m-118%20-18%20c0%20-2%20-6%20-5%20-13%20-8%0A-8%20-3%20-14%201%20-14%208%200%207%206%2011%2014%208%207%20-3%2013%20-6%2013%20-8z%20m226%20-11%20c1%20-9%200%20-13%20-4%0A-10%20-3%204%20-7%2014%20-8%2022%20-1%209%200%2013%204%2010%203%20-4%207%20-14%208%20-22z%20m29%20-17%20c1%20-7%206%20-11%0A12%20-10%206%201%2016%20-4%2023%20-12%209%20-10%208%20-13%20-5%20-11%20-20%203%20-38%2021%20-41%2042%20-1%209%201%2013%204%0A9%204%20-4%207%20-12%207%20-18z%20m-168%20-69%20l33%20-32%200%2033%20c0%2029%202%2032%2028%2029%2025%20-3%2027%20-7%2031%0A-53%202%20-33%206%20-44%2010%20-32%206%2017%2010%2016%2039%20-11%2028%20-27%2033%20-28%2046%20-13%208%209%2017%2032%2019%0A51%203%2019%204%209%202%20-22%20-1%20-45%20-7%20-64%20-29%20-90%20-15%20-18%20-24%20-26%20-20%20-18%204%208%2016%2026%0A28%2040%2017%2020%2014%2019%20-12%20-4%20-17%20-17%20-32%20-37%20-32%20-46%200%20-26%20-114%20-130%20-142%20-129%0A-20%201%20-19%202%207%2010%2017%204%2053%2032%2080%2061%20l50%2052%20-57%20-52%20c-45%20-41%20-63%20-52%20-87%20-50%0A-16%201%20-29%207%20-28%2013%201%205%20-4%209%20-10%208%20-7%20-2%20-12%203%20-10%2010%201%206%20-4%2011%20-11%209%20-8%20-1%0A-11%202%20-8%207%207%2011%20-19%2033%20-28%2023%20-4%20-4%20-6%200%20-4%208%202%208%20-3%2014%20-10%2012%20-8%20-1%20-11%202%0A-8%206%206%2011%20-28%2045%20-36%2037%20-7%20-7%20-58%2053%20-58%2068%200%206%207%202%2015%20-9%2013%20-17%2014%20-16%204%0A13%20-6%2018%20-9%2038%20-6%2045%203%207%206%203%206%20-8%201%20-12%2011%20-33%2022%20-48%20l21%20-27%2020%2020%20c10%2012%0A25%2021%2033%2021%2010%200%2016%2016%2021%2050%205%2042%2010%2050%2027%2050%2012%200%2036%20-14%2054%20-32z%22%2F%3E%3C%2Fsvg%3E';
const ICON_KAKAOMAP = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2248%22%20height%3D%2248%22%20viewBox%3D%220%200%20480%20480%22%3E%3Cpath%20fill%3D%22%23FEE500%22%20d%3D%22M1%20240%20l-1%20-239%20240%200%20240%200%200%20239%200%20239%20-239%200%20-239%20-1%20-1%20-238z%0Am318%20214%20c18%20-5%2022%20-4%2016%205%20-6%2010%20-3%2011%2014%201%2012%20-6%2019%20-15%2016%20-20%20-5%20-8%2013%0A-22%2040%20-32%206%20-1%209%20-6%208%20-10%20-2%20-5%204%20-8%2013%20-8%2011%200%2014%20-6%209%20-21%20-5%20-14%20-3%20-19%0A3%20-15%206%203%2014%201%2018%20-5%204%20-8%203%20-9%20-4%20-5%20-8%205%20-12%20-4%20-12%20-28%200%20-19%20-3%20-42%20-7%0A-52%20-5%20-12%20-3%20-15%206%20-9%2010%206%2011%203%202%20-14%20-7%20-11%20-17%20-20%20-24%20-18%20-7%201%20-11%20-4%0A-9%20-11%201%20-8%20-2%20-11%20-7%20-8%20-5%203%20-14%20-1%20-21%20-9%20-7%20-8%20-9%20-15%20-4%20-15%204%200%20-7%20-16%0A-26%20-35%20-18%20-18%20-38%20-33%20-44%20-32%20-5%201%20-11%20-7%20-12%20-18%20-1%20-26%20-33%20-86%20-34%20-65%0A0%2010%20-3%2011%20-8%204%20-4%20-7%20-18%20-14%20-31%20-15%20-19%20-3%20-29%204%20-45%2030%20-11%2019%20-15%2031%20-8%0A27%207%20-4%2012%20-3%2012%203%200%2010%20-19%2026%20-32%2026%20-9%200%20-45%2048%20-46%2060%200%205%20-6%2011%20-13%2014%0A-7%202%20-9%20-1%20-4%20-9%205%20-9%204%20-11%20-4%20-6%20-6%204%20-9%2011%20-6%2016%206%209%20-19%2032%20-27%2024%20-3%20-3%0A-9%200%20-14%207%20-5%208%20-3%2010%206%204%208%20-5%2011%20-3%208%206%20-3%208%20-10%2013%20-15%2012%20-10%20-2%20-12%2010%0A-17%2090%20-2%2039%202%2061%2011%2068%207%206%2013%208%2013%204%200%20-4%207%20-2%2015%205%208%207%2013%2016%2010%2020%20-3%204%203%0A14%2012%2021%2014%2012%2016%2012%208%200%20-6%20-11%20-4%20-13%2011%20-6%2074%2031%2093%2035%20144%2031%2030%20-3%2066%20-8%0A79%20-12z%20m138%20-176%20c-3%20-8%20-6%20-5%20-6%206%20-1%2011%202%2017%205%2013%203%20-3%204%20-12%201%20-19z%22%2F%3E%3C%2Fsvg%3E';
const ICON_KAKAONAVI = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2248%22%20height%3D%2248%22%20viewBox%3D%220%200%20480%20480%22%3E%3Cpath%20fill%3D%22%233A5FCD%22%20d%3D%22M0%20240%20l1%20-239%20239%200%20240%200%200%2064%20c0%2036%20-3%2065%20-7%2065%20-19%200%20-173%20-87%0A-166%20-94%204%20-4%20-1%20-4%20-11%200%20-13%205%20-17%204%20-12%20-4%205%20-8%201%20-10%20-10%20-5%20-12%204%2010%2020%0A79%2055%2054%2026%2097%2053%2097%2058%200%205%207%207%2015%204%2013%20-5%2015%2017%2015%20165%20l0%20171%20-240%200%20-240%0A0%200%20-240z%20m235%20200%20c-16%20-4%20-37%20-10%20-45%20-12%20-8%20-3%20-12%20-3%20-7%20-1%204%203%205%208%203%2011%0A-2%204%2015%208%2037%209%2038%201%2039%201%2012%20-7z%20m99%20-22%20c-5%20-8%20-2%20-9%2010%20-5%2011%204%2015%203%2010%20-4%0A-4%20-7%200%20-9%2012%20-5%2011%203%2026%201%2034%20-4%2013%20-9%2013%20-10%200%20-10%20-13%200%20-13%20-1%200%20-10%2020%0A-13%2033%20-12%2024%202%20-4%207%20-3%208%205%204%206%20-4%209%20-11%206%20-16%20-3%20-4%202%20-13%2010%20-20%208%20-7%2015%0A-17%2015%20-23%200%20-6%20-6%20-3%20-14%208%20-8%2011%20-41%2033%20-75%2050%20-41%2019%20-57%2031%20-49%2037%2018%2011%0A20%2010%2012%20-4z%20m-179%20-8%20c-3%20-5%20-12%20-10%20-18%20-10%20-7%200%20-6%204%203%2010%2019%2012%2023%2012%2015%0A0z%20m-117%20-284%20c13%20-16%2014%20-18%201%20-8%20-9%206%20-18%209%20-21%206%20-3%20-3%20-5%2041%20-5%2098%20l1%20103%0A3%20-90%20c3%20-66%208%20-95%2021%20-109z%20m339%20139%20c-5%20-14%20-99%20-65%20-110%20-58%20-5%203%20-6%2011%20-3%0A19%204%2010%20-4%2014%20-33%2014%20-36%200%20-37%20-1%20-33%20-30%207%20-48%20-3%20-62%20-33%20-48%20-22%2010%20-25%0A17%20-25%2064%200%2060%206%2064%2081%2064%2031%200%2048%204%2044%2010%20-3%206%20-3%2014%200%2020%208%2012%20116%20-41%20112%0A-55z%22%2F%3E%3C%2Fsvg%3E';
const ICON_TMAP = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2248%22%20height%3D%2248%22%20viewBox%3D%220%200%20480%20480%22%3E%3Cpath%20fill%3D%22%23FF6600%22%20d%3D%22M0%20240%20l0%20-240%20240%200%20240%200%200%20240%200%20240%20-240%200%20-240%200%200%20-240z%20m138%0A203%20c-10%20-2%20-26%20-2%20-35%200%20-10%203%20-2%205%2017%205%2019%200%2027%20-2%2018%20-5z%20m140%200%20c-21%20-2%0A-57%20-2%20-80%200%20-24%202%20-7%204%2037%204%2044%200%2063%20-2%2043%20-4z%20m100%200%20c-10%20-2%20-28%20-2%20-40%200%0A-13%202%20-5%204%2017%204%2022%201%2032%20-1%2023%20-4z%20m12%20-68%20l0%20-55%20-39%200%20c-24%200%20-44%20-6%20-52%0A-17%20-10%20-11%20-10%20-14%20-1%20-9%206%204%2012%203%2012%20-2%200%20-6%20-7%20-12%20-15%20-16%20-11%20-4%20-15%20-24%0A-16%20-78%20l-2%20-73%20-8%2075%20c-4%2041%20-6%2077%20-3%2079%202%202%20-4%2010%20-13%2016%20-32%2024%20-42%20-10%0A-43%20-139%20l0%20-118%2035%204%20c19%202%2035%200%2035%20-4%200%20-4%20-18%20-8%20-41%20-8%20l-40%200%203%20135%20c2%0A85%20-1%20135%20-7%20135%20-5%200%20-3%205%205%2010%2011%207%20-3%2010%20-47%2010%20l-63%200%200%2055%200%2055%20150%200%0A150%200%200%20-55z%20m-313%20-22%20c-2%20-16%20-4%20-5%20-4%2022%200%2028%202%2040%204%2028%202%20-13%202%20-35%200%20-50z%0Am296%20-50%20c-13%20-2%20-33%20-2%20-45%200%20-13%202%20-3%204%2022%204%2025%200%2035%20-2%2023%20-4z%20m-186%20-206%0Ac-2%20-34%20-3%20-6%20-3%2063%200%2069%201%2097%203%2062%202%20-34%202%20-90%200%20-125z%20m110%20131%20c-3%20-7%20-5%0A-2%20-5%2012%200%2014%202%2019%205%2013%202%20-7%202%20-19%200%20-25z%20m-29%20-215%20c-10%20-2%20-28%20-2%20-40%200%0A-13%202%20-5%204%2017%204%2022%201%2032%20-1%2023%20-4z%22%2F%3E%3C%2Fsvg%3E';
const NAV = [
  { name: '네이버지도', icon: ICON_NAVER,  app: (n,lat,lng,addr) => `nmap://route?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(n)}`, web: (n,lat,lng,addr) => `https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(addr)}` },
  { name: '카카오맵',  icon: ICON_KAKAOMAP, app: (n,lat,lng,addr) => `kakaomap://route?epname=${encodeURIComponent(n)}&epx=${lng}&epy=${lat}`, web: (n,lat,lng,addr) => `https://map.kakao.com/link/to/${encodeURIComponent(n)},${lat},${lng}` },
  { name: '카카오내비', icon: ICON_KAKAONAVI, app: (n,lat,lng,addr) => `kakaonavi://route?epname=${encodeURIComponent(n)}&epx=${lng}&epy=${lat}`, web: (n,lat,lng,addr) => `https://map.kakao.com/link/to/${encodeURIComponent(n)},${lat},${lng}` },
  { name: '티맵',      icon: ICON_TMAP,  app: (n,lat,lng,addr) => `tmap://route?goalname=${encodeURIComponent(n)}&goalx=${lng}&goaly=${lat}`, web: (n,lat,lng,addr) => `https://tmap.life/link/?name=${encodeURIComponent(n)}&lon=${lng}&lat=${lat}` },
];

function openNav(appUrl, webUrl) {
  window.location = appUrl;
  setTimeout(() => { window.open(webUrl, '_blank'); }, 800);
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
