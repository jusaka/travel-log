// ===== Annual Report =====

const Annual = {
  year: new Date().getFullYear(),

  init() {
    document.getElementById('annualYear').textContent = this.year;
    document.getElementById('annualPrev').onclick = () => { this.year--; this.render(); };
    document.getElementById('annualNext').onclick = () => { this.year++; this.render(); };
  },

  render() {
    document.getElementById('annualYear').textContent = this.year;
    const trips = Store.getByYear(this.year);
    const content = document.getElementById('annualContent');

    if (trips.length === 0) {
      content.innerHTML = `<div class="annual-empty">
        <div style="font-size:48px;margin-bottom:16px">📭</div>
        <div style="font-size:16px;margin-bottom:8px">${this.year}年暂无出行记录</div>
        <div style="font-size:13px">添加行程后将生成年度报告</div>
      </div>`;
      return;
    }

    const flights = trips.filter(t => t.type === 'flight');
    const trains = trips.filter(t => t.type === 'train');
    let totalKm = 0, flightKm = 0, trainKm = 0;
    let totalMins = 0;
    const cities = new Set();
    const airports = new Set();
    const monthSet = new Set();
    const airlines = {};

    trips.forEach(t => {
      const d = t.distance || 0;
      totalKm += d;
      totalMins += t.duration || 0;
      if (t.fromCity) cities.add(t.fromCity);
      if (t.toCity) cities.add(t.toCity);
      monthSet.add(new Date(t.date).getMonth());
    });
    flights.forEach(f => {
      flightKm += f.distance || 0;
      if (f.fromCode) airports.add(f.fromCode);
      if (f.toCode) airports.add(f.toCode);
      if (f.airline) airlines[f.airline] = (airlines[f.airline]||0)+1;
    });
    trains.forEach(t => { trainKm += t.distance || 0 });

    // Find longest trip
    let longestTrip = null;
    trips.forEach(t => { if (!longestTrip || (t.distance||0) > (longestTrip.distance||0)) longestTrip = t; });

    // Find most frequent route
    const routeCounts = {};
    trips.forEach(t => {
      const key = `${t.fromCity||'?'}-${t.toCity||'?'}`;
      routeCounts[key] = (routeCounts[key]||0)+1;
    });
    const topRoute = Object.entries(routeCounts).sort((a,b)=>b[1]-a[1])[0];

    // First and last trip
    const sorted = [...trips].sort((a,b) => a.date.localeCompare(b.date));
    const firstTrip = sorted[0];
    const lastTrip = sorted[sorted.length - 1];

    // Top airline
    const topAirline = Object.entries(airlines).sort((a,b)=>b[1]-a[1])[0];

    let html = '';

    // Hero
    html += `<div class="annual-hero">
      <div class="big-num">${trips.length}</div>
      <div class="sub">次出行 · ${this.year}年度报告</div>
    </div>`;

    // Summary grid
    html += `<div class="annual-section">
      <h3>📊 年度总览</h3>
      <div class="annual-stat-grid">
        <div class="annual-stat-box">
          <div class="val" style="color:var(--flight)">${flights.length}</div>
          <div class="label">次飞行</div>
        </div>
        <div class="annual-stat-box">
          <div class="val" style="color:var(--train)">${trains.length}</div>
          <div class="label">次高铁</div>
        </div>
        <div class="annual-stat-box">
          <div class="val">${fmtDist(totalKm)}</div>
          <div class="label">总里程</div>
        </div>
        <div class="annual-stat-box">
          <div class="val">${fmtDuration(totalMins)}</div>
          <div class="label">在路上</div>
        </div>
        <div class="annual-stat-box">
          <div class="val">${cities.size}</div>
          <div class="label">到访城市</div>
        </div>
        <div class="annual-stat-box">
          <div class="val">${monthSet.size}</div>
          <div class="label">活跃月份</div>
        </div>
      </div>
    </div>`;

    // Highlights
    html += `<div class="annual-section">
      <h3>✨ 年度之最</h3>
      <div class="stat-card" style="margin:0">`;
    
    if (longestTrip) {
      html += `<div class="stat-row"><span class="stat-label">最远一程</span><span class="stat-value">${escHtml(longestTrip.fromCity||'?')} → ${escHtml(longestTrip.toCity||'?')} (${fmtDist(longestTrip.distance||0)})</span></div>`;
    }
    if (topRoute) {
      html += `<div class="stat-row"><span class="stat-label">最常路线</span><span class="stat-value">${escHtml(topRoute[0])} (${topRoute[1]}次)</span></div>`;
    }
    if (topAirline) {
      html += `<div class="stat-row"><span class="stat-label">常飞航司</span><span class="stat-value">${AIRLINES[topAirline[0]]?.name || topAirline[0]} (${topAirline[1]}次)</span></div>`;
    }
    if (firstTrip) {
      html += `<div class="stat-row"><span class="stat-label">首次出行</span><span class="stat-value">${fmtDate(firstTrip.date)}</span></div>`;
    }
    if (lastTrip && lastTrip !== firstTrip) {
      html += `<div class="stat-row"><span class="stat-label">最后出行</span><span class="stat-value">${fmtDate(lastTrip.date)}</span></div>`;
    }

    html += `</div></div>`;

    // Monthly timeline
    const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    const monthlyTrips = {};
    trips.forEach(t => {
      const m = new Date(t.date).getMonth();
      if (!monthlyTrips[m]) monthlyTrips[m] = [];
      monthlyTrips[m].push(t);
    });

    html += `<div class="annual-section">
      <h3>📅 月度时间线</h3>`;
    
    for (let m = 0; m < 12; m++) {
      const mt = monthlyTrips[m];
      if (!mt) continue;
      html += `<div style="margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;color:var(--accent2);margin-bottom:6px">${monthNames[m]}</div>`;
      mt.sort((a,b) => a.date.localeCompare(b.date)).forEach(t => {
        const icon = t.type === 'flight' ? '✈️' : '🚄';
        const no = t.type === 'flight' ? t.flightNo : t.trainNo;
        html += `<div style="font-size:12px;color:var(--text2);padding:4px 0;border-bottom:1px solid var(--bg3)">
          ${icon} ${fmtDateShort(t.date)} ${escHtml(t.fromCity||'?')} → ${escHtml(t.toCity||'?')} ${no ? '<span style="color:var(--text3)">'+escHtml(no)+'</span>' : ''}
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;

    // Fun facts
    const earthRounds = (totalKm / 40075).toFixed(1);
    html += `<div class="annual-section">
      <h3>🎯 趣味成就</h3>
      <div class="stat-card" style="margin:0">
        <div class="stat-row"><span class="stat-label">绕地球</span><span class="stat-value">${earthRounds} 圈</span></div>
        <div class="stat-row"><span class="stat-label">等效驾车</span><span class="stat-value">${Math.round(totalMins/60)} 小时不停歇</span></div>
        <div class="stat-row"><span class="stat-label">出行频率</span><span class="stat-value">平均每 ${Math.round(365/Math.max(trips.length,1))} 天一次</span></div>
      </div>
    </div>`;

    content.innerHTML = html;
  },
};
