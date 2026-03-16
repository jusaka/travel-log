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

// Undo support - last deleted trip
let _undoTrip = null;
let _undoTimer = null;

function showUndoToast(msg, trip) {
  _undoTrip = trip;
  const el = document.getElementById('toast');
  el.innerHTML = `${escHtml(msg)} <button id="btnUndo" style="margin-left:12px;background:var(--accent);color:#fff;border:none;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;cursor:pointer">撤销</button>`;
  el.classList.add('show');
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => { el.classList.remove('show'); el.textContent = ''; _undoTrip = null; }, 6000);
  document.getElementById('btnUndo').onclick = () => {
    if (_undoTrip) {
      Store.add(_undoTrip);
      _undoTrip = null;
      el.classList.remove('show');
      clearTimeout(_undoTimer);
      showToast('已恢复 ✅');
      Trips.render();
      TravelMap.draw();
      TravelMap.updateSummary();
      Stats.render();
      Annual.render();
    }
  };
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

// Simple pinyin first-letter matching for Chinese characters
// Covers common city/airport/station names
const _pinyinMap = {
  '北':'b','京':'j','上':'s','海':'h','广':'g','州':'z','深':'s','圳':'z',
  '天':'t','津':'j','重':'c','庆':'q','成':'c','都':'d','杭':'h','武':'w',
  '汉':'h','南':'n','西':'x','安':'a','长':'c','沙':'s','郑':'z','昆':'k',
  '明':'m','三':'s','亚':'y','口':'k','青':'q','岛':'d','大':'d','连':'l',
  '厦':'x','门':'m','福':'f','哈':'h','尔':'e','滨':'b','沈':'s','阳':'y',
  '乌':'w','鲁':'l','木':'m','齐':'q','拉':'l','萨':'s','呼':'h','和':'h',
  '浩':'h','特':'t','贵':'g','合':'h','肥':'f','太':'t','原':'y','石':'s',
  '家':'j','庄':'z','银':'y','川':'c','宁':'n','波':'b','无':'w','锡':'x',
  '苏':'s','东':'d','莞':'g','佛':'f','山':'s','珠':'z','中':'z','泉':'q',
  '温':'w','兰':'l','台':'t','旧':'j','金':'j','新':'x','加':'j','坡':'p',
  '曼':'m','谷':'g','香':'x','港':'g','澳':'a','丽':'l','江':'j','景':'j',
  '德':'d','镇':'z','虹':'h','桥':'q','浦':'p','首':'s','咸':'x','白':'b',
  '云':'y','宝':'b','萧':'x','禄':'l','黄':'h','花':'h','天':'t','河':'h',
  '凤':'f','凰':'h','美':'m','胶':'j','水':'s','子':'z','双':'s','流':'l',
  '机':'j','场':'c','站':'z','车':'c','火':'h','高':'g','铁':'t','飞':'f',
  '行':'x','旅':'l','程':'c','途':'t','出':'c','发':'f','到':'d','达':'d',
};

function toPinyinInitials(str) {
  if (!str) return '';
  let result = '';
  for (const ch of str) {
    result += _pinyinMap[ch] || ch.toLowerCase();
  }
  return result;
}

// Search airports (supports Chinese and pinyin initials)
function searchAirports(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const [code, info] of Object.entries(AIRPORTS)) {
    const cityPy = toPinyinInitials(info.city);
    const namePy = toPinyinInitials(info.name);
    if (code.toLowerCase().includes(q) || info.city.includes(q) || info.name.includes(q) || 
        (info.city + info.name).includes(q) || cityPy.includes(q) || namePy.includes(q) ||
        (cityPy + namePy).includes(q)) {
      results.push({ code, ...info });
    }
    if (results.length >= 8) break;
  }
  return results;
}

// Search stations (supports Chinese and pinyin initials)
function searchStations(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const [name, info] of Object.entries(STATIONS)) {
    const namePy = toPinyinInitials(name);
    const cityPy = toPinyinInitials(info.city);
    if (name.includes(q) || info.city.includes(q) || namePy.includes(q) || cityPy.includes(q)) {
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
