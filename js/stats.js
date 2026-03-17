// ===== Statistics View v2 =====

function getTravelPersonality() {
  const trips = Store.getAll();
  const flights = trips.filter(t => t.type === 'flight');
  const trains = trips.filter(t => t.type === 'train');
  const totalKm = trips.reduce((s, t) => s + (t.distance || 0), 0);
  const cities = new Set();
  trips.forEach(t => { if (t.fromCity) cities.add(t.fromCity); if (t.toCity) cities.add(t.toCity); });
  const intlCodes = new Set(['SIN','BKK','NRT','KIX','ICN','HKG','MFM','TPE','KUL','MNL','HND','CDG','LHR','JFK','LAX','SFO','SYD','DXB']);
  const intlCount = flights.filter(f => intlCodes.has(f.fromCode) || intlCodes.has(f.toCode)).length;

  if (intlCount > flights.length * 0.5 && intlCount > 0) return { type: '🌏 环球探索家', desc: '你的足迹遍布全球，国际航线是你的主战场', color: '#3b82f6', emoji: '🌏' };
  if (trains.length > flights.length * 1.5 && trains.length > 0) return { type: '🚄 高铁侠', desc: '比起飞行你更爱脚踏实地，高铁是你的出行首选', color: '#10b981', emoji: '🚄' };
  if (totalKm > 50000) return { type: '✈️ 空中飞人', desc: '里程数惊人，你几乎活在天上', color: '#f59e0b', emoji: '✈️' };
  if (cities.size > 15) return { type: '🗺️ 城市收集家', desc: '到访城市无数，每到一处都留下足迹', color: '#8b5cf6', emoji: '🗺️' };
  if (flights.length > 0 && trains.length > 0) return { type: '🔀 双栖旅者', desc: '飞行与高铁并重，灵活切换出行方式', color: '#ec4899', emoji: '🔀' };
  if (flights.length > 5) return { type: '🛫 常旅客', desc: '飞行是你的日常，机场是你的第二个家', color: '#f97316', emoji: '🛫' };
  return { type: '🌱 旅行新手', desc: '旅途刚刚开始，未来可期', color: '#6b7280', emoji: '🌱' };
}

function getNextMilestone(totalKm) {
  const milestones = [
    { km: 5000, label: '5,000 km' },
    { km: 10000, label: '1万 km' },
    { km: 20000, label: '2万 km' },
    { km: 40075, label: '绕地球一圈' },
    { km: 80000, label: '8万 km' },
    { km: 100000, label: '10万 km' },
    { km: 384400, label: '飞到月球' },
  ];
  for (const m of milestones) {
    if (totalKm < m.km) return m;
  }
  return null;
}

const Stats = {
  render() {
    const stats = Store.getStats();
    const grid = document.getElementById('statsGrid');

    if (stats.totalTrips === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">暂无统计数据</div><div class="empty-sub">添加行程后这里将展示丰富的统计</div></div>';
      return;
    }

    let html = '';

    // Total distance hero
    html += `<div class="stat-card">
      <div class="stat-big">
        <div class="num">${fmtDist(stats.totalKm)}</div>
        <div class="unit">总行程里程</div>
      </div>
      <div style="display:flex;gap:20px;justify-content:center;margin-top:12px">
        <div style="text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--flight)">${fmtDist(stats.totalFlightKm)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">✈️ 飞行里程</div>
        </div>
        <div style="width:1px;background:var(--bg4)"></div>
        <div style="text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--train)">${fmtDist(stats.totalTrainKm)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">🚄 高铁里程</div>
        </div>
      </div>
    </div>`;

    // Travel personality card
    const personality = getTravelPersonality();
    html += `<div style="text-align:center;margin:16px 0;padding:16px;background:var(--bg2);border-radius:12px;border:1px solid var(--bg3)">
      <div style="font-size:32px">${personality.emoji}</div>
      <div style="font-size:18px;font-weight:700;color:${personality.color};margin:4px 0">${personality.type}</div>
      <div style="font-size:13px;color:var(--text3)">${personality.desc}</div>
      <button onclick="Stats.sharePersonality()" style="margin-top:12px;padding:8px 20px;border-radius:20px;background:var(--accent);color:#fff;border:none;font-size:13px;cursor:pointer">📤 分享人格卡片</button>
    </div>`;

    // Overview - only show non-zero rows
    {
      // Domestic/International split
      const intlCodes = new Set(['SIN','BKK','NRT','KIX','ICN','HKG','MFM','TPE','KUL','MNL','HND','CDG','LHR','JFK','LAX','SFO','SYD','DXB','MEL','YVR','YYZ','FRA','AMS','FCO','BCN','DME','SVO','DOH','ADD','JNB','GRU','EZE','AKL','DEL','BOM','CGK','SGN','HAN','RGN','PNH','CEB']);
      let domesticCount = 0, intlCount = 0;
      const allTrips = Store.getAll();
      allTrips.forEach(t => {
        if (t.type === 'flight' && t.fromCode && t.toCode) {
          if (intlCodes.has(t.fromCode) || intlCodes.has(t.toCode)) {
            intlCount++;
          } else {
            domesticCount++;
          }
        } else if (t.type === 'train') {
          domesticCount++;
        }
      });

      const overviewRows = [
        ['总行程', stats.totalTrips, '次', ''],
        ['✈️ 飞行', stats.flightCount, '次', 'var(--flight)'],
        ['🚄 高铁', stats.trainCount, '次', 'var(--train)'],
      ];
      if (domesticCount > 0 || intlCount > 0) {
        overviewRows.push(['🏠 国内', domesticCount, '次', '']);
        overviewRows.push(['🌏 国际/地区', intlCount, '次', '']);
      }
      overviewRows.push(
        ['🏙️ 到访城市', stats.cityCount, '个', ''],
        ['🛫 途经机场', stats.airportCount, '个', ''],
        ['🚉 途经车站', stats.stationCount, '个', ''],
        ['⏱️ 总旅途时间', stats.totalMins, '', ''],
        ['💰 总交通花费', stats.totalPrice, '元', ''],
      );
      const filteredRows = overviewRows.filter(([, val]) => val > 0);
      html += `<div class="stat-card">
        <h4>📋 出行概览</h4>
        ${filteredRows.map(([label, val, unit, color]) => {
          const display = label.includes('时间') ? fmtDuration(val) : label.includes('花费') ? '¥' + val.toLocaleString() : val + ' ' + unit;
          const style = color ? ` style="color:${color};font-weight:700"` : '';
          return `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value"${style}>${display}</span></div>`;
        }).join('')}
      </div>`;
    }

    // Pie chart: flight vs train
    if (stats.flightCount > 0 && stats.trainCount > 0) {
      html += this._renderPieChart(stats);
    }

    // History chart
    html += this._renderHistoryChart();

    // Earth comparison
    const earthRounds = (stats.totalKm / 40075).toFixed(2);
    const moonPct = ((stats.totalKm / 384400) * 100).toFixed(1);
    html += `<div class="stat-card">
      <h4>🌍 趣味里程对比</h4>
      <div class="stat-row"><span class="stat-label">绕地球</span><span class="stat-value">${earthRounds} 圈</span></div>
      <div class="stat-row"><span class="stat-label">到月球</span><span class="stat-value">${moonPct}%</span></div>
      <div class="stat-row"><span class="stat-label">马拉松等效</span><span class="stat-value">${Math.round(stats.totalKm / 42.195)} 场</span></div>
    </div>`;

    // Travel records
    const records = [];
    if (stats.maxStreak >= 1) records.push(['🔥 最长连续出行', `${stats.maxStreak} 天`]);
    if (stats.longestTrip) records.push(['📏 最远单程', `${escHtml(stats.longestTrip.fromCity || '?')} → ${escHtml(stats.longestTrip.toCity || '?')} (${fmtDist(stats.longestTrip.distance)})`]);
    if (stats.shortestTrip && stats.totalTrips > 1) records.push(['📍 最近单程', `${escHtml(stats.shortestTrip.fromCity || '?')} → ${escHtml(stats.shortestTrip.toCity || '?')} (${fmtDist(stats.shortestTrip.distance)})`]);
    if (stats.busiestMonth) {
      const [ym, count] = stats.busiestMonth;
      const [y, m] = ym.split('-');
      records.push(['📅 最忙月份', `${y}年${parseInt(m)}月 (${count}次)`]);
    }
    if (records.length > 0) {
      html += `<div class="stat-card">
        <h4>🏆 旅行纪录</h4>
        ${records.map(([label, val]) => `<div class="stat-row"><span class="stat-label">${label}</span><span class="stat-value" style="font-size:13px;max-width:60%;text-align:right">${val}</span></div>`).join('')}
      </div>`;
    }

    // Top cities
    if (stats.topCities.length > 0) {
      const maxCount = stats.topCities[0][1];
      html += `<div class="stat-card">
        <h4>🏙️ 最常到访城市</h4>
        <div class="bar-chart">
          ${stats.topCities.map(([city, count]) => `
            <div class="bar-item" style="cursor:pointer" onclick='document.querySelector(".tab[data-tab=\"trips\"]").click();setTimeout(()=>{document.getElementById("tripSearch").value=${JSON.stringify(city)};document.getElementById("tripSearch").dispatchEvent(new Event("input"))},200)'>
              <span class="bar-label">${escHtml(city)}</span>
              <div class="bar-track">
                <div class="bar-fill flight" style="width:${(count / maxCount * 100).toFixed(0)}%"></div>
                <span class="bar-count">${count}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // Top airlines
    if (stats.topAirlines.length > 0) {
      const maxCount = stats.topAirlines[0][1];
      html += `<div class="stat-card">
        <h4>🛫 常飞航司</h4>
        <div class="bar-chart">
          ${stats.topAirlines.map(([code, count]) => `
            <div class="bar-item" style="cursor:pointer" onclick='document.querySelector(".tab[data-tab=\"trips\"]").click();setTimeout(()=>{document.getElementById("tripSearch").value=${JSON.stringify(AIRLINES[code]?.name || code)};document.getElementById("tripSearch").dispatchEvent(new Event("input"))},200)'>
              <span class="bar-label">${escHtml(AIRLINES[code]?.name || code)}</span>
              <div class="bar-track">
                <div class="bar-fill train" style="width:${(count / maxCount * 100).toFixed(0)}%"></div>
                <span class="bar-count">${count}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // Top routes
    if (stats.topRoutes && stats.topRoutes.length > 0) {
      const maxCount = stats.topRoutes[0][1];
      html += `<div class="stat-card">
        <h4>🔥 热门航线</h4>
        <div class="bar-chart">
          ${stats.topRoutes.map(([route, count]) => `
            <div class="bar-item">
              <span class="bar-label" style="font-size:12px">${escHtml(route)}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width:${(count / maxCount * 100).toFixed(0)}%;background:linear-gradient(90deg,var(--flight),var(--accent))"></div>
                <span class="bar-count">${count}次</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // Monthly chart (current year)
    const now = new Date();
    const yearTrips = Store.getByYear(now.getFullYear());
    if (yearTrips.length > 0) {
      const monthlyCounts = new Array(12).fill(0);
      yearTrips.forEach(t => { monthlyCounts[new Date(t.date).getMonth()]++; });
      const maxM = Math.max(...monthlyCounts, 1);
      const months = ['1','2','3','4','5','6','7','8','9','10','11','12'];
      html += `<div class="stat-card">
        <h4>📅 ${now.getFullYear()}年月度出行</h4>
        <div style="display:flex;gap:4px;align-items:flex-end;height:80px;padding:0 2px">
          ${monthlyCounts.map((c, i) => {
            const h = c > 0 ? Math.max(10, (c / maxM) * 70) : 4;
            const isCurrentMonth = i === now.getMonth();
            const color = c > 0 ? (isCurrentMonth ? 'var(--flight)' : 'var(--accent)') : 'var(--bg3)';
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="font-size:10px;color:${c > 0 ? 'var(--text2)' : 'transparent'}">${c}</div>
              <div style="width:100%;height:${h}px;background:${color};border-radius:2px 2px 0 0"></div>
              <div style="font-size:9px;color:${isCurrentMonth ? 'var(--accent)' : 'var(--text3)'}${isCurrentMonth ? ';font-weight:700' : ''}">${months[i]}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    // Next milestone progress bar
    const milestone = getNextMilestone(stats.totalKm);
    if (milestone) {
      const pct = Math.min((stats.totalKm / milestone.km) * 100, 100);
      const remaining = milestone.km - stats.totalKm;
      html += `<div style="padding:12px;background:var(--bg2);border-radius:10px;margin:12px 0">
        <div style="font-size:12px;color:var(--text3);margin-bottom:6px">🎯 下一个目标：${milestone.label} (${milestone.km.toLocaleString()} km)</div>
        <div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden">
          <div style="height:100%;background:var(--flight);border-radius:4px;width:${pct.toFixed(1)}%;transition:width 0.5s"></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;text-align:right">还差 ${remaining.toLocaleString()} km</div>
      </div>`;
    }

    // Share stats button
    html += `<div style="text-align:center;padding:16px 0 80px">
      <button class="btn btn-primary" onclick="Stats.generateShareImage()" style="width:100%;padding:14px;font-size:15px;font-weight:600">📤 分享统计</button>
    </div>`;

    grid.innerHTML = html;
  },

  _renderPieChart(stats) {
    const canvasId = 'pieCanvas';
    setTimeout(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (W <= 0 || H <= 0) return; // Guard: hidden tab has zero dimensions
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 12;
      const total = stats.flightCount + stats.trainCount;
      const flightAngle = (stats.flightCount / total) * Math.PI * 2;

      // Flight slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + flightAngle);
      ctx.closePath();
      const fg = ctx.createRadialGradient(cx, cy - r / 2, r * 0.1, cx, cy, r);
      fg.addColorStop(0, '#fbbf24');
      fg.addColorStop(1, '#d97706');
      ctx.fillStyle = fg;
      ctx.fill();

      // Train slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, -Math.PI / 2 + flightAngle, -Math.PI / 2 + Math.PI * 2);
      ctx.closePath();
      const tg = ctx.createRadialGradient(cx, cy + r / 2, r * 0.1, cx, cy, r);
      tg.addColorStop(0, '#34d399');
      tg.addColorStop(1, '#059669');
      ctx.fillStyle = tg;
      ctx.fill();

      // Inner circle (donut hole) - theme aware
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      const isLight = document.documentElement.classList.contains('light');
      ctx.fillStyle = isLight ? '#f9fafb' : '#111827';
      ctx.fill();

      // Center text
      ctx.textAlign = 'center';
      ctx.fillStyle = isLight ? '#111827' : '#f3f4f6';
      ctx.font = `bold ${Math.round(r * 0.28)}px -apple-system, sans-serif`;
      ctx.fillText(total + '次', cx, cy + 4);
      ctx.font = `${Math.round(r * 0.15)}px -apple-system, sans-serif`;
      ctx.fillStyle = isLight ? '#6b7280' : '#9ca3af';
      ctx.fillText('总行程', cx, cy + r * 0.22);
    }, 50);

    const flightPct = Math.round(stats.flightCount / (stats.flightCount + stats.trainCount) * 100);
    const trainPct = 100 - flightPct;
    return `<div class="stat-card">
      <h4>🥧 出行方式占比</h4>
      <div style="display:flex;align-items:center;gap:16px">
        <canvas id="${canvasId}" style="width:120px;height:120px;flex-shrink:0"></canvas>
        <div style="flex:1">
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="color:var(--flight);font-size:13px">✈️ 飞行</span>
              <span style="font-weight:700">${flightPct}%</span>
            </div>
            <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
              <div style="width:${flightPct}%;height:100%;background:var(--flight);border-radius:3px"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="color:var(--train);font-size:13px">🚄 高铁</span>
              <span style="font-weight:700">${trainPct}%</span>
            </div>
            <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
              <div style="width:${trainPct}%;height:100%;background:var(--train);border-radius:3px"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  },

  _renderHistoryChart() {
    const trips = Store.getAll();
    if (trips.length < 2) return '';

    // Build sorted list of trips with cumulative km
    const sorted = [...trips].sort((a, b) => a.date.localeCompare(b.date));
    let cumFlightKm = 0, cumTrainKm = 0;

    const points = sorted.map(t => {
      if (t.type === 'flight') cumFlightKm += (t.distance || 0);
      else cumTrainKm += (t.distance || 0);
      return {
        date: t.date,
        type: t.type,
        flightKm: cumFlightKm,
        trainKm: cumTrainKm,
        totalKm: cumFlightKm + cumTrainKm,
      };
    });

    const maxKm = points[points.length - 1].totalKm;
    const canvasId = 'historyCanvas';

    // Render with requestAnimationFrame after DOM insert
    setTimeout(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (W <= 0 || H <= 0) return; // Guard: hidden tab
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const PAD = { l: 8, r: 8, t: 12, b: 8 };
      const chartW = W - PAD.l - PAD.r;
      const chartH = H - PAD.t - PAD.b;

      // Helper: map point index to x
      const n = points.length;
      const xOf = i => PAD.l + (i / (n - 1)) * chartW;
      const yOf = km => PAD.t + chartH - (km / maxKm) * chartH;

      // Draw grid lines
      const isLightTheme = document.documentElement.classList.contains('light');
      ctx.strokeStyle = isLightTheme ? 'rgba(209,213,219,0.6)' : 'rgba(55,65,81,0.5)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = PAD.t + (i / 4) * chartH;
        ctx.beginPath();
        ctx.moveTo(PAD.l, y);
        ctx.lineTo(W - PAD.r, y);
        ctx.stroke();
      }

      // Fill area under total curve
      ctx.beginPath();
      ctx.moveTo(xOf(0), yOf(0));
      points.forEach((p, i) => ctx.lineTo(xOf(i), yOf(p.totalKm)));
      ctx.lineTo(xOf(n - 1), H - PAD.b);
      ctx.lineTo(xOf(0), H - PAD.b);
      ctx.closePath();
      const areaGrad = ctx.createLinearGradient(0, PAD.t, 0, H);
      areaGrad.addColorStop(0, 'rgba(59,130,246,0.25)');
      areaGrad.addColorStop(1, 'rgba(59,130,246,0.02)');
      ctx.fillStyle = areaGrad;
      ctx.fill();

      // Draw flight km line
      ctx.beginPath();
      points.forEach((p, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(p.flightKm)) : ctx.lineTo(xOf(i), yOf(p.flightKm)));
      ctx.strokeStyle = 'rgba(245,158,11,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw train km line
      ctx.beginPath();
      points.forEach((p, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(p.trainKm)) : ctx.lineTo(xOf(i), yOf(p.trainKm)));
      ctx.strokeStyle = 'rgba(16,185,129,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw total km line
      ctx.beginPath();
      points.forEach((p, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(p.totalKm)) : ctx.lineTo(xOf(i), yOf(p.totalKm)));
      ctx.strokeStyle = 'rgba(96,165,250,1)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Draw dots at each trip
      points.forEach((p, i) => {
        const x = xOf(i), y = yOf(p.totalKm);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.type === 'flight' ? '#f59e0b' : '#10b981';
        ctx.fill();
        ctx.strokeStyle = document.documentElement.classList.contains('light') ? '#e5e7eb' : '#1f2937';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Year labels on x axis
      const years = {};
      points.forEach((p, i) => {
        const yr = p.date.slice(0, 4);
        if (!years[yr]) years[yr] = i;
      });
      ctx.font = '9px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(107,114,128,0.8)';
      ctx.textAlign = 'center';
      Object.entries(years).forEach(([yr, i]) => {
        ctx.fillText(yr, xOf(i), H - 1);
      });
    }, 50);

    return `<div class="stat-card">
      <h4>📈 历史里程曲线</h4>
      <div style="display:flex;gap:12px;margin-bottom:8px;font-size:11px">
        <span style="color:var(--accent2)">— 总里程</span>
        <span style="color:var(--flight)">— 飞行</span>
        <span style="color:var(--train)">— 高铁</span>
      </div>
      <canvas id="${canvasId}" style="width:100%;height:120px;display:block"></canvas>
    </div>`;
  },

  generateShareImage() {
    const stats = Store.getStats();
    if (stats.totalTrips === 0) { showToast('暂无数据'); return; }

    const dpr = 2;
    const W = 800;
    const H = 1200;
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c1929');
    bg.addColorStop(0.4, '#111d35');
    bg.addColorStop(1, '#080d18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Border (match other share cards)
    ctx.strokeStyle = 'rgba(245,158,11,0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    // Stars
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 35; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, 0.5 + Math.random(), 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Decorative glow
    ctx.globalAlpha = 0.04;
    ctx.beginPath(); ctx.arc(W * 0.8, 60, 120, 0, Math.PI * 2); ctx.fillStyle = '#3b82f6'; ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.2, H * 0.6, 100, 0, Math.PI * 2); ctx.fillStyle = '#f59e0b'; ctx.fill();
    ctx.globalAlpha = 1;

    const drawDivider = (y) => {
      const dg = ctx.createLinearGradient(40, 0, W - 40, 0);
      dg.addColorStop(0, 'transparent');
      dg.addColorStop(0.5, 'rgba(96,165,250,0.4)');
      dg.addColorStop(1, 'transparent');
      ctx.strokeStyle = dg;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 40, y); ctx.stroke();
    };

    let curY = 40;

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✈️ 旅途纵横 · 出行统计', W / 2, curY);
    curY += 20;
    drawDivider(curY);

    // Big number - total km
    curY += 48;
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 52px -apple-system, sans-serif';
    ctx.fillText(fmtDist(stats.totalKm), W / 2, curY);
    curY += 24;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '15px -apple-system, sans-serif';
    ctx.fillText('总行程里程', W / 2, curY);

    // Stats 2x2 grid
    curY += 28;
    const gridItems = [
      { label: '✈ 飞行', value: stats.flightCount + '次', color: '#fbbf24' },
      { label: '🚄 高铁', value: stats.trainCount + '次', color: '#34d399' },
      { label: '城市', value: stats.cityCount + '个', color: '#f472b6' },
      { label: '在路上', value: fmtDuration(stats.totalMins), color: '#c084fc' },
    ];
    const cellW = (W - 80) / 2;
    const cellH = 80;
    gridItems.forEach((s, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const cx = 30 + col * cellW + cellW / 2;
      const cy = curY + row * cellH;
      // Card bg
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.roundRect(30 + col * cellW + 4, cy - 12, cellW - 8, cellH - 6, 8);
      ctx.fill();
      ctx.fillStyle = s.color;
      ctx.font = 'bold 28px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.value, cx, cy + 10);
      ctx.fillStyle = '#6b7280';
      ctx.font = '15px -apple-system, sans-serif';
      ctx.fillText(s.label, cx, cy + 26);
    });

    // Fun facts
    curY += cellH * 2 + 14;
    drawDivider(curY);
    curY += 28;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 18px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🌍 趣味对比', 28, curY);

    const earthRounds = (stats.totalKm / 40075).toFixed(2);
    const moonPct = ((stats.totalKm / 384400) * 100).toFixed(1);
    const funFacts = [
      ['绕地球', earthRounds + ' 圈'],
      ['到月球', moonPct + '%'],
      ['马拉松', Math.round(stats.totalKm / 42.195) + ' 场'],
    ];
    funFacts.forEach(([label, val]) => {
      curY += 28;
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 28, curY);
      ctx.fillStyle = '#d1d5db';
      ctx.font = 'bold 14px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val, W - 28, curY);
    });

    // Top cities
    if (stats.topCities.length > 0) {
      curY += 20;
      drawDivider(curY);
      curY += 28;
      ctx.fillStyle = '#e5e7eb';
      ctx.font = 'bold 18px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🏙️ 常去城市 Top3', 28, curY);

      const top3 = stats.topCities.slice(0, 3);
      const maxC = top3[0][1];
      top3.forEach(([city, count]) => {
        curY += 30;
        const bw = (count / maxC) * (W - 160);
        const barGrad = ctx.createLinearGradient(80, 0, 80 + bw, 0);
        barGrad.addColorStop(0, 'rgba(96,165,250,0.6)');
        barGrad.addColorStop(1, 'rgba(96,165,250,0.1)');
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(80, curY - 10, bw, 18, 4);
        ctx.fill();
        ctx.fillStyle = '#d1d5db';
        ctx.font = '14px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(city, 28, curY + 3);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '13px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(count + '次', W - 28, curY + 3);
      });
    }

    // Flight vs train ratio bar
    if (stats.flightCount > 0 && stats.trainCount > 0) {
      curY += 28;
      drawDivider(curY);
      curY += 28;
      ctx.fillStyle = '#e5e7eb';
      ctx.font = 'bold 18px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🥧 出行方式', 28, curY);
      curY += 24;
      const total = stats.flightCount + stats.trainCount;
      const flightPct = stats.flightCount / total;
      const barX = 28, barY = curY, barH = 16, barTotalW = W - 56;
      // Flight portion
      ctx.fillStyle = 'rgba(251,191,36,0.7)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barTotalW * flightPct, barH, flightPct >= 1 ? 6 : [6, 0, 0, 6]);
      ctx.fill();
      // Train portion
      ctx.fillStyle = 'rgba(52,211,153,0.7)';
      ctx.beginPath();
      ctx.roundRect(barX + barTotalW * flightPct, barY, barTotalW * (1 - flightPct), barH, flightPct <= 0 ? 6 : [0, 6, 6, 0]);
      ctx.fill();
      curY += barH + 14;
      ctx.font = '13px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`✈ ${Math.round(flightPct * 100)}%`, barX, curY);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#34d399';
      ctx.fillText(`🚄 ${Math.round((1 - flightPct) * 100)}%`, barX + barTotalW, curY);
    }

    // Footer with QR
    curY += 30;
    drawDivider(curY);
    curY += 10;
    const footerH = drawShareFooter(ctx, W, curY, 60);
    curY += footerH;

    // Crop canvas to actual content height
    const finalH = curY + 20;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = W * dpr;
    finalCanvas.height = finalH * dpr;
    const fctx = finalCanvas.getContext('2d');
    fctx.drawImage(canvas, 0, 0);

    finalCanvas.toBlob(blob => {
      const text = `${stats.totalTrips}次出行 · ${fmtDist(stats.totalKm)} · ${stats.cityCount}个城市`;
      showSharePreview(blob, '旅途纵横-出行统计.png', '我的出行统计', text);
    }, 'image/png');
  },

  sharePersonality() {
    const stats = Store.getStats();
    const trips = Store.getAll();
    const personality = getTravelPersonality();
    if (stats.totalTrips === 0) { showToast('暂无数据'); return; }

    const flights = trips.filter(t => t.type === 'flight');
    const trains = trips.filter(t => t.type === 'train');
    const cities = new Set();
    trips.forEach(t => { if (t.fromCity) cities.add(t.fromCity); if (t.toCity) cities.add(t.toCity); });

    const dpr = 2;
    const W = 600;
    const H = 400;
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0c1929');
    bg.addColorStop(0.5, '#111d35');
    bg.addColorStop(1, '#080d18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Border
    ctx.strokeStyle = 'rgba(245,158,11,0.15)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12, 12, W - 24, H - 24);

    // Stars decoration
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      const sz = 0.4 + Math.random() * 1.2;
      ctx.arc(Math.random() * W, Math.random() * H, sz, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Decorative glow with personality color
    ctx.globalAlpha = 0.06;
    ctx.beginPath(); ctx.arc(W * 0.75, 50, 100, 0, Math.PI * 2); ctx.fillStyle = personality.color; ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.25, H * 0.7, 80, 0, Math.PI * 2); ctx.fillStyle = personality.color; ctx.fill();
    ctx.globalAlpha = 1;

    // Header
    ctx.fillStyle = '#9ca3af';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✈️ 旅途纵横 · 旅行人格', W / 2, 40);

    // Big emoji
    ctx.font = '56px -apple-system, sans-serif';
    ctx.fillText(personality.emoji, W / 2, 110);

    // Personality type name
    ctx.fillStyle = personality.color;
    ctx.font = 'bold 28px -apple-system, sans-serif';
    ctx.fillText(personality.type, W / 2, 155);

    // Description
    ctx.fillStyle = '#d1d5db';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.fillText(personality.desc, W / 2, 185);

    // Data support line
    const dataLine = `${flights.length}次飞行 · ${trains.length}次高铁 · ${cities.size}个城市 · ${fmtDist(stats.totalKm)}`;
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText(dataLine, W / 2, 215);

    // Divider
    const dg = ctx.createLinearGradient(60, 0, W - 60, 0);
    dg.addColorStop(0, 'transparent');
    dg.addColorStop(0.5, 'rgba(96,165,250,0.3)');
    dg.addColorStop(1, 'transparent');
    ctx.strokeStyle = dg;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(60, 235); ctx.lineTo(W - 60, 235); ctx.stroke();

    // Personality color accent bar
    ctx.fillStyle = personality.color;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.roundRect(W / 2 - 120, 245, 240, 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Footer with QR
    const footerH = drawShareFooter(ctx, W, 260, 50);

    canvas.toBlob(blob => {
      showSharePreview(blob, '旅途纵横-旅行人格.png', '我的旅行人格', personality.type + ' - ' + personality.desc);
    }, 'image/png');
  },
};
