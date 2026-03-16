// ===== Utility functions =====

// Polyfill: CanvasRenderingContext2D.roundRect (Safari < 16, Chrome < 99)
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    const r = typeof radii === 'number' ? radii : (radii?.[0] || 0);
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.arcTo(x + w, y, x + w, y + r, r);
    this.lineTo(x + w, y + h - r);
    this.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.lineTo(x + r, y + h);
    this.arcTo(x, y + h, x, y + h - r, r);
    this.lineTo(x, y + r);
    this.arcTo(x, y, x + r, y, r);
    return this;
  };
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Haversine distance in km
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Format distance
function fmtDist(km) {
  if (km >= 10000) return (km/10000).toFixed(1) + '万km';
  return Math.round(km).toLocaleString() + ' km';
}

// Format duration in minutes
function fmtDuration(mins) {
  if (!mins || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return m + '分钟';
  if (m === 0) return h + '小时';
  return h + 'h' + (m < 10 ? '0' : '') + m + 'm';
}

// Parse time string "HH:MM" to minutes since midnight
function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Calculate trip duration in minutes from dep/arr times
// Handles timezone differences for international flights
function calcTripDuration(depTime, arrTime, fromCode, toCode) {
  const dep = timeToMins(depTime);
  const arr = timeToMins(arrTime);
  if (dep === null || arr === null) return null;
  let diff = arr - dep;
  if (diff < 0) diff += 24 * 60; // overnight
  // Adjust for timezone difference (times are local)
  if (fromCode && toCode && typeof AIRPORT_TZ !== 'undefined') {
    const fromTZ = AIRPORT_TZ[fromCode];
    const toTZ = AIRPORT_TZ[toCode];
    if (fromTZ != null && toTZ != null && fromTZ !== toTZ) {
      // arr is in toTZ local, dep is in fromTZ local
      // Real duration = naive diff - (toTZ - fromTZ) * 60
      diff -= (toTZ - fromTZ) * 60;
      if (diff < 0) diff += 24 * 60;
      if (diff > 20 * 60) diff -= 24 * 60; // sanity: no flight > 20h
    }
  }
  return diff;
}

// Generate unique ID
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Toast notification
function showToast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

// Modal management
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.body.style.overflow = '';
}

// Confirm dialog (replaces native confirm)
let _confirmCb = null;
function showConfirm(msg, onOk) {
  document.getElementById('confirmMsg').textContent = msg;
  _confirmCb = onOk;
  openModal('confirmModal');
}

// Date formatting
function fmtDate(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['日','一','二','三','四','五','六'];
  return `${y}.${m}.${day} 周${weekdays[d.getDay()]}`;
}

function fmtDateShort(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
}

// Get year from date string
function getYear(dateStr) {
  return new Date(dateStr).getFullYear();
}

// Search airports
function searchAirports(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const [code, info] of Object.entries(AIRPORTS)) {
    if (code.toLowerCase().includes(q) || info.city.includes(q) || info.name.includes(q) || (info.city + info.name).includes(q)) {
      results.push({ code, ...info });
    }
    if (results.length >= 8) break;
  }
  return results;
}

// Search stations
function searchStations(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const [name, info] of Object.entries(STATIONS)) {
    if (name.includes(q) || info.city.includes(q)) {
      results.push({ name, ...info });
    }
    if (results.length >= 8) break;
  }
  return results;
}

// Detect airline from flight number
function detectAirline(flightNo) {
  if (!flightNo) return '';
  const code = flightNo.replace(/\d/g, '').toUpperCase();
  return AIRLINES[code] ? code : '';
}
