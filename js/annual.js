// ===== Annual Report v2 =====

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
        <div style="font-size:13px;color:var(--text3)">添加行程后将生成年度报告</div>
      </div>`;
      return;
    }

    const flights = trips.filter(t => t.type === 'flight');
    const trains = trips.filter(t => t.type === 'train');
    let totalKm = 0, flightKm = 0, trainKm = 0;
    let totalMins = 0;
    const cities = new Set();
    const airports = new Set();
    const stations = new Set();
    const monthSet = new Set();
    const airlines = {};
    const dateCounts = {};

    trips.forEach(t => {
      const d = t.distance || 0;
      totalKm += d;
      totalMins += t.duration || 0;
      if (t.fromCity) cities.add(t.fromCity);
      if (t.toCity) cities.add(t.toCity);
      monthSet.add(new Date(t.date).getMonth());
      dateCounts[t.date] = (dateCounts[t.date] || 0) + 1;
    });
    flights.forEach(f => {
      flightKm += f.distance || 0;
      if (f.fromCode) airports.add(f.fromCode);
      if (f.toCode) airports.add(f.toCode);
      if (f.airline) airlines[f.airline] = (airlines[f.airline]||0)+1;
    });
    trains.forEach(t => {
      trainKm += t.distance || 0;
      if (t.fromStation) stations.add(t.fromStation);
      if (t.toStation) stations.add(t.toStation);
    });

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

    // Contribution Heatmap (GitHub-style)
    html += this._renderHeatmap(dateCounts);

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

    // Monthly activity bar chart
    const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    const monthlyCounts = new Array(12).fill(0);
    const monthlyKm = new Array(12).fill(0);
    trips.forEach(t => {
      const m = new Date(t.date).getMonth();
      monthlyCounts[m]++;
      monthlyKm[m] += (t.distance || 0);
    });
    const maxMonthCount = Math.max(...monthlyCounts, 1);

    html += `<div class="annual-section">
      <h3>📅 月度活跃度</h3>
      <div style="display:flex;gap:3px;align-items:flex-end;height:100px;padding:0 4px">
        ${monthlyCounts.map((c, i) => {
          const h = c > 0 ? Math.max(12, (c / maxMonthCount) * 85) : 4;
          const color = c > 0 ? 'var(--accent)' : 'var(--bg3)';
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
            ${c > 0 ? `<div style="font-size:10px;color:var(--text2);font-weight:600">${c}</div>` : '<div style="font-size:10px;color:transparent">0</div>'}
            <div style="width:100%;height:${h}px;background:${color};border-radius:3px 3px 0 0;transition:height .5s"></div>
            <div style="font-size:9px;color:var(--text3)">${monthNames[i]}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

    // Monthly timeline with trip details
    const monthlyTrips = {};
    trips.forEach(t => {
      const m = new Date(t.date).getMonth();
      if (!monthlyTrips[m]) monthlyTrips[m] = [];
      monthlyTrips[m].push(t);
    });

    html += `<div class="annual-section">
      <h3>🗓️ 行程回顾</h3>`;
    
    const fullMonthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    for (let m = 0; m < 12; m++) {
      const mt = monthlyTrips[m];
      if (!mt) continue;
      const mKm = monthlyKm[m];
      html += `<div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <div style="font-size:14px;font-weight:700;color:var(--accent2)">${fullMonthNames[m]}</div>
          <div style="font-size:11px;color:var(--text3)">${fmtDist(mKm)}</div>
        </div>`;
      mt.sort((a,b) => a.date.localeCompare(b.date)).forEach(t => {
        const icon = t.type === 'flight' ? '✈️' : '🚄';
        const no = t.type === 'flight' ? t.flightNo : t.trainNo;
        const km = t.distance ? `${fmtDist(t.distance)}` : '';
        html += `<div style="font-size:13px;color:var(--text2);padding:6px 0;border-bottom:1px solid var(--bg3);display:flex;justify-content:space-between;align-items:center">
          <span>${icon} <span style="color:var(--text3);font-size:11px">${fmtDateShort(t.date)}</span> ${escHtml(t.fromCity||'?')} → ${escHtml(t.toCity||'?')} ${no ? '<span style="color:var(--text3);font-size:11px">'+escHtml(no)+'</span>' : ''}</span>
          <span style="font-size:12px;color:var(--accent2);font-weight:600;flex-shrink:0;margin-left:8px">${km}</span>
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;

    // Fun facts
    const earthRounds = (totalKm / 40075).toFixed(1);
    const avgKmPerTrip = Math.round(totalKm / trips.length);
    const avgTripsPerMonth = (trips.length / monthSet.size).toFixed(1);
    html += `<div class="annual-section">
      <h3>🎯 趣味数据</h3>
      <div class="stat-card" style="margin:0">
        <div class="stat-row"><span class="stat-label">🌍 绕地球</span><span class="stat-value">${earthRounds} 圈</span></div>
        <div class="stat-row"><span class="stat-label">⏱️ 等效驾车</span><span class="stat-value">${Math.round(totalMins/60)} 小时</span></div>
        <div class="stat-row"><span class="stat-label">📐 平均每程</span><span class="stat-value">${fmtDist(avgKmPerTrip)}</span></div>
        <div class="stat-row"><span class="stat-label">📅 出行频率</span><span class="stat-value">约每 ${Math.round(365/Math.max(trips.length,1))} 天一次</span></div>
        <div class="stat-row"><span class="stat-label">📈 活跃月均</span><span class="stat-value">${avgTripsPerMonth} 次/月</span></div>
      </div>
    </div>`;

    // Fun footer + share
    html += `<div style="text-align:center;padding:16px 0 80px">
      <button class="btn btn-primary" onclick="Annual.generateShareImage()" style="width:100%;padding:14px;font-size:15px;font-weight:600">📤 生成分享图片</button>
    </div>`;

    content.innerHTML = html;
  },

  async generateShareImage() {
    const trips = Store.getByYear(this.year);
    if (!trips.length) return;

    const flights = trips.filter(t => t.type === 'flight');
    const trains = trips.filter(t => t.type === 'train');
    let totalKm = 0, totalMins = 0;
    const cities = new Set();
    trips.forEach(t => {
      totalKm += t.distance || 0;
      totalMins += t.duration || 0;
      if (t.fromCity) cities.add(t.fromCity);
      if (t.toCity) cities.add(t.toCity);
    });

    const dpr = 2;
    const W = 375, H = 667; // iPhone SE size
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d1b2e');
    bg.addColorStop(0.5, '#1a1a3e');
    bg.addColorStop(1, '#0a0f1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Decorative elements
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(W * Math.random(), H * Math.random(), 80 + Math.random() * 120, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#3b82f6' : '#f59e0b';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✈️ 旅途纵横', W / 2, 50);

    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`${this.year}年度旅行报告`, W / 2, 72);

    // Divider
    const divGrad = ctx.createLinearGradient(40, 0, W - 40, 0);
    divGrad.addColorStop(0, 'transparent');
    divGrad.addColorStop(0.5, 'rgba(59,130,246,0.5)');
    divGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 88);
    ctx.lineTo(W - 40, 88);
    ctx.stroke();

    // Big number
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 72px -apple-system, sans-serif';
    ctx.fillText(trips.length.toString(), W / 2, 158);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.fillText('次出行', W / 2, 178);

    // Stats grid (2x3)
    const statsData = [
      { label: '飞行', value: flights.length + '次', color: '#f59e0b' },
      { label: '高铁', value: trains.length + '次', color: '#10b981' },
      { label: '总里程', value: fmtDist(totalKm), color: '#60a5fa' },
      { label: '在路上', value: fmtDuration(totalMins), color: '#60a5fa' },
      { label: '城市', value: cities.size + '个', color: '#a78bfa' },
      { label: '绕地球', value: (totalKm / 40075).toFixed(1) + '圈', color: '#f472b6' },
    ];

    const gridY = 205;
    const cellW = (W - 60) / 3;
    const cellH = 65;
    statsData.forEach((s, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 30 + col * cellW + cellW / 2;
      const y = gridY + row * cellH;

      // Box background
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      const bx = 30 + col * cellW + 4;
      const by = y - 18;
      ctx.beginPath();
      ctx.roundRect(bx, by, cellW - 8, cellH - 8, 8);
      ctx.fill();

      ctx.fillStyle = s.color;
      ctx.font = 'bold 22px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.value, x, y + 8);

      ctx.fillStyle = '#6b7280';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillText(s.label, x, y + 26);
    });

    // Top cities
    const cityCount = {};
    trips.forEach(t => {
      if (t.fromCity) cityCount[t.fromCity] = (cityCount[t.fromCity] || 0) + 1;
      if (t.toCity) cityCount[t.toCity] = (cityCount[t.toCity] || 0) + 1;
    });
    const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const cityY = gridY + cellH * 2 + 25;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏙️ 常去城市 Top 5', 30, cityY);

    const maxCityCount = topCities.length > 0 ? topCities[0][1] : 1;
    topCities.forEach((c, i) => {
      const y = cityY + 20 + i * 28;
      const barW = (c[1] / maxCityCount) * (W - 140);

      // Bar
      const barGrad = ctx.createLinearGradient(75, 0, 75 + barW, 0);
      barGrad.addColorStop(0, 'rgba(59,130,246,0.6)');
      barGrad.addColorStop(1, 'rgba(59,130,246,0.15)');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(75, y - 8, barW, 18, 4);
      ctx.fill();

      // City name
      ctx.fillStyle = '#d1d5db';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(c[0], 30, y + 5);

      // Count
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(c[1] + '次', W - 30, y + 5);
    });

    // Divider 2
    const div2Y = cityY + 20 + topCities.length * 28 + 15;
    ctx.strokeStyle = divGrad;
    ctx.beginPath();
    ctx.moveTo(40, div2Y);
    ctx.lineTo(W - 40, div2Y);
    ctx.stroke();

    // Fun facts
    const funY = div2Y + 25;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🎯 趣味数据', 30, funY);

    const funFacts = [
      `📐 平均每程 ${fmtDist(Math.round(totalKm / Math.max(trips.length, 1)))}`,
      `📅 约每 ${Math.round(365 / Math.max(trips.length, 1))} 天出行一次`,
      `⏱️ 旅途总时长 ${Math.round(totalMins / 60)} 小时`,
    ];
    funFacts.forEach((f, i) => {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(f, 30, funY + 22 + i * 22);
    });

    // Footer
    ctx.fillStyle = '#4b5563';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('旅途纵横 · 记录每一次出发', W / 2, H - 30);
    ctx.fillText(`生成于 ${new Date().toISOString().split('T')[0]}`, W / 2, H - 16);

    // Convert to blob and download
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `旅途纵横-${this.year}年报.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('分享图片已生成 📸');
    }, 'image/png');
  },

  _renderHeatmap(dateCounts) {
    const year = this.year;
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const startDay = startDate.getDay(); // 0=Sun
    
    // Build 53 weeks x 7 days grid
    let cells = '';
    const current = new Date(startDate);
    // Pad to start from Sunday
    current.setDate(current.getDate() - startDay);
    
    const totalDays = 371; // 53*7
    for (let i = 0; i < totalDays; i++) {
      const dateStr = current.toISOString().split('T')[0];
      const isInYear = current.getFullYear() === year;
      const count = isInYear ? (dateCounts[dateStr] || 0) : -1;
      let level = '';
      if (count < 0) level = 'style="background:transparent"';
      else if (count === 0) level = '';
      else if (count === 1) level = 'class="heat-cell l1"';
      else if (count === 2) level = 'class="heat-cell l2"';
      else if (count === 3) level = 'class="heat-cell l3"';
      else level = 'class="heat-cell l4"';
      
      if (count < 0) cells += `<div class="heat-cell" style="background:transparent"></div>`;
      else cells += `<div ${level || 'class="heat-cell"'} title="${dateStr}: ${count}次"></div>`;
      
      current.setDate(current.getDate() + 1);
    }

    // Month labels
    const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    
    return `<div class="annual-section">
      <h3>📆 出行热力图</h3>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px">
        <div class="heatmap-grid" style="min-width:320px">${cells}</div>
        <div class="heatmap-months" style="min-width:320px">${monthLabels.map(m => `<span>${m}</span>`).join('')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-top:6px;font-size:10px;color:var(--text3)">
        少 <div class="heat-cell" style="width:10px;height:10px;display:inline-block"></div>
        <div class="heat-cell l1" style="width:10px;height:10px;display:inline-block"></div>
        <div class="heat-cell l2" style="width:10px;height:10px;display:inline-block"></div>
        <div class="heat-cell l3" style="width:10px;height:10px;display:inline-block"></div>
        <div class="heat-cell l4" style="width:10px;height:10px;display:inline-block"></div> 多
      </div>
    </div>`;
  },
};
