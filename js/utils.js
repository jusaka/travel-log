// ===== Utility functions =====

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
function calcTripDuration(depTime, arrTime) {
  const dep = timeToMins(depTime);
  const arr = timeToMins(arrTime);
  if (dep === null || arr === null) return null;
  let diff = arr - dep;
  if (diff < 0) diff += 24 * 60; // overnight
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
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['日','一','二','三','四','五','六'];
  return `${m}月${day}日 周${weekdays[d.getDay()]}`;
}

function fmtDateShort(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth()+1}.${d.getDate()}`;
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
