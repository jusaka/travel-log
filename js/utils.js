// ===== Utility functions =====

// ===== Share Config (change these when domain changes) =====
const SHARE_URL = 'jusaka.github.io/travel-log';
const SHARE_FULL_URL = 'https://' + SHARE_URL + '/';
const SHARE_QR_PATH = 'icons/qr-share.png';

// Preload QR code image
const _shareQRImg = new Image();
_shareQRImg.src = SHARE_QR_PATH;

// Draw QR code on share canvas with rounded container
function drawShareQR(ctx, x, y, size) {
  // Draw rounded container background
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 6, size + 12, size + 30, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 6, size + 12, size + 30, 10);
  ctx.stroke();

  // Draw QR image
  if (_shareQRImg.complete && _shareQRImg.naturalWidth > 0) {
    ctx.drawImage(_shareQRImg, x, y, size, size);
  } else {
    // Fallback: placeholder
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR', x + size/2, y + size/2 + 4);
  }

  // "扫码体验" label below QR
  ctx.fillStyle = '#64748b';
  ctx.font = '9px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('扫码体验', x + size/2, y + size + 16);
}

// Draw standard share footer (brand + QR + URL)
function drawShareFooter(ctx, W, curY, qrSize) {
  qrSize = qrSize || 70;
  
  // QR on right with container
  const qrX = W - qrSize - 36;
  const qrY = curY + 6;
  drawShareQR(ctx, qrX, qrY, qrSize);
  
  // Brand text on left
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 16px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('旅途纵横', 30, curY + 28);
  
  ctx.fillStyle = '#475569';
  ctx.font = '13px -apple-system, sans-serif';
  ctx.fillText('TravelLog', 30, curY + 48);

  ctx.fillStyle = '#374151';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText(SHARE_URL, 30, curY + 68);
  
  return qrSize + 40;
}

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
      const restoredTrip = Store.add(_undoTrip);
      // Restore group membership if trip had a groupId
      if (_undoTrip.groupId) {
        const group = Store.getGroupById(_undoTrip.groupId);
        if (group && !group.tripIds.includes(restoredTrip.id)) {
          group.tripIds.push(restoredTrip.id);
          Store.save();
        }
      }
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
  // Close any open modal first (mutual exclusion)
  document.querySelectorAll('.modal').forEach(m => {
    if (m.style.display === 'flex' && m.id !== id && m.id !== 'confirmModal') {
      m.style.display = 'none';
    }
  });
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

// Pinyin syllable mapping for Chinese characters (deduplicated, 259 unique chars)
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
  '洛':'luo','泰':'tai','淮':'huai','烟':'yan','威':'wei','潍':'wei','坊':'fang','通':'tong',
  '徐':'xu','常':'chang','湖':'hu','嘉':'jia','兴':'xing','绍':'shao','舟':'zhou','义':'yi',
  '衢':'qu','甬':'yong','湘':'xiang','潭':'tan','株':'zhu','洲':'zhou','衡':'heng','邵':'shao',
  '岳':'yue','益':'yi','怀':'huai','娄':'lou','永':'yong','郴':'chen','湛':'zhan',
  '茂':'mao','名':'ming','汕':'shan','头':'tou','揭':'jie','梅':'mei','韶':'shao',
  '惠':'hui','肇':'zhao','清':'qing','柳':'liu','桂':'gui','林':'lin','梧':'wu','百':'bai','色':'se',
  '遵':'zun','顺':'shun','毕':'bi','节':'jie','曲':'qu','靖':'jing','楚':'chu','蒙':'meng',
  '文':'wen','昭':'zhao','普':'pu','版':'ban','纳':'na','雅':'ya','乐':'le','眉':'mei',
  '宜':'yi','泸':'lu','内':'nei','遂':'sui','巴':'ba','绵':'mian','攀':'pan','枝':'zhi',
  '凉':'liang','甘':'gan','孜':'zi','阿':'a','坝':'ba','张':'zhang','掖':'ye','酒':'jiu',
  '敦':'dun','煌':'huang','峪':'yu','关':'guan','定':'ding','陇':'long','临':'lin','夏':'xia',
  '平':'ping','格':'ge','玉':'yu','树':'shu','果':'guo','日':'ri','喀':'ka','则':'ze',
  '那':'na','昌':'chang','芝':'zhi','里':'li','包':'bao','赤':'chi','峰':'feng',
  '辽':'liao','鞍':'an','抚':'fu','本':'ben','溪':'xi','丹':'dan','营':'ying',
  '锦':'jin','盘':'pan','朝':'chao','葫':'hu','芦':'lu','岭':'ling','春':'chun',
  '吉':'ji','延':'yan','边':'bian','四':'si','城':'cheng','松':'song','牡':'mu',
  '佳':'jia','斯':'si','绥':'sui','化':'hua','黑':'hei','鸭':'ya','绿':'lv','狮':'shi',
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

// Share preview: show image in modal, then share or download
function showSharePreview(blob, filename, shareTitle, shareText) {
  const url = URL.createObjectURL(blob);
  const img = document.getElementById('sharePreviewImage');
  img.src = url;
  openModal('sharePreviewModal');

  // Save button
  document.getElementById('btnShareSave').onclick = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    showToast('📤 图片已保存');
  };

  // Share button
  const btnShare = document.getElementById('btnShareSend');
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    btnShare.style.display = '';
    btnShare.onclick = () => {
      navigator.share({
        title: shareTitle || '',
        text: shareText || '',
        files: [file]
      }).then(() => {
        closeModal('sharePreviewModal');
        showToast('📤 已分享！');
      }).catch(e => {
        if (e.name !== 'AbortError') showToast('分享失败，请手动保存');
      });
    };
  } else {
    // No Web Share API, hide share button
    btnShare.style.display = 'none';
  }
}
