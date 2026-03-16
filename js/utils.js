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

// Pinyin syllable mapping for Chinese characters (covers all common city/transport names)
const _pinyinFull = {
  '北':'bei','京':'jing','上':'shang','海':'hai','广':'guang','州':'zhou','深':'shen','圳':'zhen',
  '天':'tian','津':'jin','重':'chong','庆':'qing','成':'cheng','都':'du','杭':'hang','武':'wu',
  '汉':'han','南':'nan','西':'xi','安':'an','长':'chang','沙':'sha','郑':'zheng','昆':'kun',
  '明':'ming','三':'san','亚':'ya','口':'kou','青':'qing','岛':'dao','大':'da','连':'lian',
  '厦':'xia','门':'men','福':'fu','哈':'ha','尔':'er','滨':'bin','沈':'shen','阳':'yang',
  '乌':'wu','鲁':'lu','木':'mu','齐':'qi','拉':'la','萨':'sa','呼':'hu','和':'he',
  '浩':'hao','特':'te','贵':'gui','合':'he','肥':'fei','太':'tai','原':'yuan','石':'shi',
  '家':'jia','庄':'zhuang','银':'yin','川':'chuan','宁':'ning','波':'bo','无':'wu','锡':'xi',
  '苏':'su','东':'dong','莞':'guan','佛':'fo','山':'shan','珠':'zhu','中':'zhong','泉':'quan',
  '温':'wen','兰':'lan','台':'tai','旧':'jiu','金':'jin','新':'xin','加':'jia','坡':'po',
  '曼':'man','谷':'gu','香':'xiang','港':'gang','澳':'ao','丽':'li','江':'jiang','景':'jing',
  '德':'de','镇':'zhen','虹':'hong','桥':'qiao','浦':'pu','首':'shou','咸':'xian','白':'bai',
  '云':'yun','宝':'bao','萧':'xiao','禄':'lu','黄':'huang','花':'hua','河':'he',
  '凤':'feng','凰':'huang','美':'mei','胶':'jiao','水':'shui','子':'zi','双':'shuang','流':'liu',
  '机':'ji','场':'chang','站':'zhan','车':'che','火':'huo','高':'gao','铁':'tie','飞':'fei',
  '行':'xing','旅':'lv','程':'cheng','途':'tu','出':'chu','发':'fa','到':'dao','达':'da',
  '洛':'luo','阳':'yang','厦':'xia','泰':'tai','淮':'huai','海':'hai','烟':'yan','台':'tai',
  '威':'wei','海':'hai','潍':'wei','坊':'fang','南':'nan','通':'tong','苏':'su','徐':'xu',
  '州':'zhou','常':'chang','锡':'xi','无':'wu','湖':'hu','嘉':'jia','兴':'xing','绍':'shao',
  '宁':'ning','舟':'zhou','山':'shan','金':'jin','义':'yi','乌':'wu','丽':'li','水':'shui',
  '衢':'qu','温':'wen','台':'tai','丽':'li','杭':'hang','甬':'yong','湘':'xiang','潭':'tan',
  '株':'zhu','洲':'zhou','衡':'heng','邵':'shao','常':'chang','德':'de','岳':'yue',
  '益':'yi','怀':'huai','娄':'lou','永':'yong','郴':'chen','湛':'zhan','江':'jiang',
  '茂':'mao','名':'ming','汕':'shan','头':'tou','揭':'jie','梅':'mei','韶':'shao',
  '惠':'hui','东':'dong','珠':'zhu','肇':'zhao','清':'qing','云':'yun','江':'jiang',
  '柳':'liu','桂':'gui','林':'lin','梧':'wu','州':'zhou','百':'bai','色':'se',
  '贵':'gui','遵':'zun','义':'yi','安':'an','顺':'shun','毕':'bi','节':'jie',
  '昆':'kun','曲':'qu','靖':'jing','楚':'chu','蒙':'meng','文':'wen','昭':'zhao',
  '普':'pu','洱':'er','西':'xi','版':'ban','纳':'na','丽':'li','江':'jiang',
  '成':'cheng','雅':'ya','乐':'le','眉':'mei','宜':'yi','泸':'lu','内':'nei',
  '遂':'sui','广':'guang','巴':'ba','南':'nan','达':'da','绵':'mian','德':'de',
  '攀':'pan','枝':'zhi','花':'hua','凉':'liang','山':'shan','甘':'gan','孜':'zi',
  '阿':'a','坝':'ba','兰':'lan','州':'zhou','天':'tian','水':'shui','武':'wu',
  '威':'wei','张':'zhang','掖':'ye','酒':'jiu','泉':'quan','敦':'dun','煌':'huang',
  '嘉':'jia','峪':'yu','关':'guan','白':'bai','银':'yin','庆':'qing','阳':'yang',
  '定':'ding','西':'xi','陇':'long','南':'nan','临':'lin','夏':'xia','平':'ping',
  '凉':'liang','西':'xi','宁':'ning','海':'hai','东':'dong','格':'ge','尔':'er',
  '木':'mu','玉':'yu','树':'shu','果':'guo','洛':'luo','黄':'huang','南':'nan',
  '海':'hai','西':'xi','都':'du','西':'xi','宁':'ning','拉':'la','萨':'sa',
  '日':'ri','喀':'ka','则':'ze','那':'na','曲':'qu','昌':'chang','都':'du',
  '林':'lin','芝':'zhi','阿':'a','里':'li','锡':'xi','林':'lin','浩':'hao',
  '特':'te','呼':'hu','包':'bao','头':'tou','赤':'chi','峰':'feng','通':'tong',
  '辽':'liao','沈':'shen','阳':'yang','大':'da','连':'lian','鞍':'an','山':'shan',
  '抚':'fu','顺':'shun','本':'ben','溪':'xi','丹':'dan','东':'dong','营':'ying',
  '口':'kou','锦':'jin','州':'zhou','盘':'pan','锦':'jin','朝':'chao','阳':'yang',
  '葫':'hu','芦':'lu','岛':'dao','铁':'tie','岭':'ling','长':'chang','春':'chun',
  '吉':'ji','延':'yan','边':'bian','四':'si','平':'ping','白':'bai','城':'cheng',
  '松':'song','哈':'ha','牡':'mu','丹':'dan','江':'jiang','佳':'jia','木':'mu',
  '斯':'si','齐':'qi','绥':'sui','化':'hua','黑':'hei','河':'he','双':'shuang',
  '鸭':'ya','绿':'lv','石':'shi','狮':'shi','子':'zi','山':'shan',
};

// Also keep initials for fallback
const _pinyinInitials = {};
for (const [ch, py] of Object.entries(_pinyinFull)) {
  _pinyinInitials[ch] = py[0];
}

function toPinyinFull(str) {
  if (!str) return '';
  let result = '';
  for (const ch of str) {
    result += _pinyinFull[ch] || ch.toLowerCase();
  }
  return result;
}

function toPinyinInitials(str) {
  if (!str) return '';
  let result = '';
  for (const ch of str) {
    result += _pinyinInitials[ch] || _pinyinFull[ch]?.[0] || ch.toLowerCase();
  }
  return result;
}

// Search airports (supports Chinese, IATA code, full pinyin, and pinyin initials)
function searchAirports(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const [code, info] of Object.entries(AIRPORTS)) {
    const cityFull = toPinyinFull(info.city);
    const nameFull = toPinyinFull(info.name);
    const cityInit = toPinyinInitials(info.city);
    const nameInit = toPinyinInitials(info.name);
    if (code.toLowerCase().includes(q) ||
        info.city.includes(q) || info.name.includes(q) ||
        (info.city + info.name).includes(q) ||
        cityFull.includes(q) || nameFull.includes(q) ||
        (cityFull + nameFull).includes(q) ||
        cityInit.startsWith(q) || nameInit.startsWith(q)) {
      results.push({ code, ...info });
    }
    if (results.length >= 8) break;
  }
  return results;
}

// Search stations (supports Chinese, full pinyin, and pinyin initials)
function searchStations(query) {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const [name, info] of Object.entries(STATIONS)) {
    const nameFull = toPinyinFull(name);
    const cityFull = toPinyinFull(info.city);
    const nameInit = toPinyinInitials(name);
    const cityInit = toPinyinInitials(info.city);
    if (name.includes(q) || info.city.includes(q) ||
        nameFull.includes(q) || cityFull.includes(q) ||
        nameInit.startsWith(q) || cityInit.startsWith(q)) {
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
