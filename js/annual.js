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

    // Year-over-year comparison
    const prevTrips = Store.getByYear(this.year - 1);
    if (prevTrips.length > 0) {
      const prevKm = prevTrips.reduce((s, t) => s + (t.distance || 0), 0);
      const prevCities = new Set();
      prevTrips.forEach(t => { if (t.fromCity) prevCities.add(t.fromCity); if (t.toCity) prevCities.add(t.toCity); });
      const diffTrips = trips.length - prevTrips.length;
      const diffKm = totalKm - prevKm;
      const diffCities = cities.size - prevCities.size;
      const arrow = v => v > 0 ? `<span style="color:#34d399">↑${v}</span>` : v < 0 ? `<span style="color:#ef4444">↓${Math.abs(v)}</span>` : `<span style="color:var(--text3)">—</span>`;
      html += `<div class="annual-section">
        <h3>📈 同比 ${this.year - 1} 年</h3>
        <div class="stat-card" style="margin:0">
          <div class="stat-row"><span class="stat-label">出行次数</span><span class="stat-value">${prevTrips.length} → ${trips.length} ${arrow(diffTrips)}</span></div>
          <div class="stat-row"><span class="stat-label">总里程</span><span class="stat-value">${fmtDist(prevKm)} → ${fmtDist(totalKm)} ${arrow(diffKm > 0 ? 1 : diffKm < 0 ? -1 : 0)}</span></div>
          <div class="stat-row"><span class="stat-label">到访城市</span><span class="stat-value">${prevCities.size} → ${cities.size} ${arrow(diffCities)}</span></div>
        </div>
      </div>`;
    }
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
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:${c > 0 ? 'pointer' : 'default'}" ${c > 0 ? `onclick="document.querySelector('[data-tab=trips]').click();document.getElementById('tripSearch').value='';document.getElementById('filterYear').value='${this.year}';document.getElementById('filterType').value='all';Trips.render();setTimeout(()=>{const h=document.querySelectorAll('.trip-month-header');for(const el of h){if(el.dataset.month==='${i}'){el.scrollIntoView({behavior:'smooth',block:'start'});break;}}},100)"` : ''}>
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

    // Achievements
    const achievements = this._getAchievements(trips, flights, trains, totalKm, cities, airports);
    if (achievements.length > 0) {
      html += `<div class="annual-section">
        <h3>🏅 成就解锁</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${achievements.map(a => `<div style="background:${a.unlocked ? 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08))' : 'var(--bg2)'};border:1px solid ${a.unlocked ? 'rgba(251,191,36,0.4)' : 'var(--bg3)'};border-radius:12px;padding:10px 14px;text-align:center;min-width:90px;flex:1;opacity:${a.unlocked ? '1' : '0.4'}">
            <div style="font-size:24px;margin-bottom:4px">${a.icon}</div>
            <div style="font-size:11px;font-weight:600;color:${a.unlocked ? 'var(--flight)' : 'var(--text3)'}">${a.name}</div>
            <div style="font-size:9px;color:var(--text3);margin-top:2px">${a.desc}</div>
          </div>`).join('')}
        </div>
      </div>`;
    }

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
    const airlines = {};
    trips.forEach(t => {
      totalKm += t.distance || 0;
      totalMins += t.duration || 0;
      if (t.fromCity) cities.add(t.fromCity);
      if (t.toCity) cities.add(t.toCity);
    });
    flights.forEach(f => { if (f.airline) airlines[f.airline] = (airlines[f.airline]||0)+1; });

    // Top cities
    const cityCount = {};
    trips.forEach(t => {
      if (t.fromCity) cityCount[t.fromCity] = (cityCount[t.fromCity] || 0) + 1;
      if (t.toCity) cityCount[t.toCity] = (cityCount[t.toCity] || 0) + 1;
    });
    const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Top routes (bidirectional merge)
    const routeCounts = {};
    trips.forEach(t => {
      const a = t.fromCity || '?', b = t.toCity || '?';
      const key = a < b ? `${a} ↔ ${b}` : `${b} ↔ ${a}`;
      routeCounts[key] = (routeCounts[key] || 0) + 1;
    });
    const topRoutes = Object.entries(routeCounts).sort((a,b)=>b[1]-a[1]).slice(0, 3);

    // Top airline
    const topAirline = Object.entries(airlines).sort((a,b)=>b[1]-a[1])[0];

    // Monthly counts
    const monthlyCounts = new Array(12).fill(0);
    trips.forEach(t => { monthlyCounts[new Date(t.date).getMonth()]++; });

    // Longest trip & first trip
    let longestTrip = trips[0];
    trips.forEach(t => { if ((t.distance||0) > (longestTrip.distance||0)) longestTrip = t; });
    const sortedTrips = [...trips].sort((a,b) => a.date.localeCompare(b.date));
    const firstTrip = sortedTrips[0];

    const dpr = 2;
    const W = 375;
    // Dynamic height based on content
    const baseH = 1060;
    const routeH = topRoutes.length * 28;
    const H = baseH + routeH;
    
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background gradient - deep blue to dark
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c1929');
    bg.addColorStop(0.3, '#111d35');
    bg.addColorStop(0.7, '#0f1528');
    bg.addColorStop(1, '#080d18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle star dots
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * W, sy = Math.random() * H;
      const sr = 0.5 + Math.random() * 1;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Decorative glow circles
    ctx.globalAlpha = 0.04;
    [[W*0.8, 80, 150, '#3b82f6'], [W*0.2, H*0.4, 120, '#f59e0b'], [W*0.7, H*0.7, 100, '#a78bfa']].forEach(([x,y,r,c]) => {
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle = c; ctx.fill();
    });
    ctx.globalAlpha = 1;

    let curY = 0;

    // ===== HEADER =====
    curY = 48;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✈️ 旅途纵横', W / 2, curY);
    curY += 24;
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`— ${this.year}年度旅行报告 —`, W / 2, curY);

    // Divider
    curY += 18;
    const drawDivider = (y) => {
      const dg = ctx.createLinearGradient(50, 0, W - 50, 0);
      dg.addColorStop(0, 'transparent');
      dg.addColorStop(0.5, 'rgba(96,165,250,0.4)');
      dg.addColorStop(1, 'transparent');
      ctx.strokeStyle = dg;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(W - 50, y); ctx.stroke();
    };
    drawDivider(curY);

    // ===== BIG NUMBER =====
    curY += 50;
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 80px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(trips.length.toString(), W / 2, curY);
    curY += 20;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.fillText('次出行', W / 2, curY);

    // ===== STATS GRID (3x2) =====
    curY += 30;
    const statsData = [
      { label: '✈ 飞行', value: flights.length + '次', color: '#fbbf24' },
      { label: '🚄 高铁', value: trains.length + '次', color: '#34d399' },
      { label: '里程', value: fmtDist(totalKm), color: '#60a5fa' },
      { label: '在路上', value: fmtDuration(totalMins), color: '#c084fc' },
      { label: '城市', value: cities.size + '个', color: '#f472b6' },
      { label: '绕地球', value: (totalKm / 40075).toFixed(1) + '圈', color: '#fb923c' },
    ];
    const cellW = (W - 60) / 3;
    const cellH = 62;
    statsData.forEach((s, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const cx = 30 + col * cellW + cellW / 2;
      const cy = curY + row * cellH;
      // Card bg
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.roundRect(30 + col * cellW + 3, cy - 16, cellW - 6, cellH - 6, 8);
      ctx.fill();
      // Value
      ctx.fillStyle = s.color;
      ctx.font = 'bold 20px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.value, cx, cy + 8);
      // Label
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillText(s.label, cx, cy + 24);
    });

    // ===== MONTHLY BAR CHART =====
    curY += cellH * 2 + 20;
    drawDivider(curY);
    curY += 22;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📅 月度出行', 28, curY);
    curY += 14;
    const barAreaH = 55;
    const maxM = Math.max(...monthlyCounts, 1);
    const months = ['1','2','3','4','5','6','7','8','9','10','11','12'];
    const barW = (W - 56) / 12;
    months.forEach((m, i) => {
      const c = monthlyCounts[i];
      const bh = c > 0 ? Math.max(5, (c / maxM) * (barAreaH - 16)) : 2;
      const bx = 28 + i * barW + barW * 0.15;
      const bw = barW * 0.7;
      const by = curY + barAreaH - 14 - bh;
      // Bar
      ctx.fillStyle = c > 0 ? 'rgba(96,165,250,0.7)' : 'rgba(55,65,81,0.3)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 2);
      ctx.fill();
      // Count above bar
      if (c > 0) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '9px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(c, bx + bw/2, by - 3);
      }
      // Month label
      ctx.fillStyle = '#4b5563';
      ctx.font = '8px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m, bx + bw/2, curY + barAreaH - 2);
    });

    // ===== HEATMAP =====
    curY += barAreaH + 14;
    drawDivider(curY);
    curY += 22;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📆 出行热力图', 28, curY);
    curY += 12;
    {
      // Build date counts for heatmap
      const dateCounts = {};
      trips.forEach(t => { dateCounts[t.date] = (dateCounts[t.date] || 0) + 1; });
      const startDate = new Date(this.year, 0, 1);
      const startDay = startDate.getDay();
      const cellSize = 5;
      const cellGap = 1.5;
      const cols = 53, rows = 7;
      const heatW = cols * (cellSize + cellGap);
      const heatX = (W - heatW) / 2;
      const current = new Date(startDate);
      current.setDate(current.getDate() - startDay);
      for (let i = 0; i < cols * rows; i++) {
        const dateStr = current.toISOString().split('T')[0];
        const isInYear = current.getFullYear() === this.year;
        const count = isInYear ? (dateCounts[dateStr] || 0) : -1;
        const col = Math.floor(i / 7);
        const row = i % 7;
        const cx = heatX + col * (cellSize + cellGap);
        const cy = curY + row * (cellSize + cellGap);
        if (count < 0) {
          // skip
        } else if (count === 0) {
          ctx.fillStyle = 'rgba(55,65,81,0.3)';
          ctx.fillRect(cx, cy, cellSize, cellSize);
        } else {
          const alpha = Math.min(0.3 + count * 0.25, 1.0);
          ctx.fillStyle = `rgba(96,165,250,${alpha})`;
          ctx.fillRect(cx, cy, cellSize, cellSize);
        }
        current.setDate(current.getDate() + 1);
      }
      curY += rows * (cellSize + cellGap) + 4;
      // Month labels below heatmap
      const heatMonths = ['1','2','3','4','5','6','7','8','9','10','11','12'];
      ctx.font = '7px -apple-system, sans-serif';
      ctx.fillStyle = '#4b5563';
      ctx.textAlign = 'center';
      heatMonths.forEach((m, i) => {
        const x = heatX + (i / 12) * heatW + heatW / 24;
        ctx.fillText(m + '月', x, curY);
      });
      curY += 6;
    }

    // ===== TOP CITIES =====
    curY += 8;
    drawDivider(curY);
    curY += 22;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🏙️ 常去城市', 28, curY);
    curY += 8;
    const maxCc = topCities.length > 0 ? topCities[0][1] : 1;
    topCities.forEach(([city, count], i) => {
      curY += 24;
      const bw = (count / maxCc) * (W - 155);
      // Bar
      const barGrad = ctx.createLinearGradient(80, 0, 80 + bw, 0);
      barGrad.addColorStop(0, 'rgba(96,165,250,0.6)');
      barGrad.addColorStop(1, 'rgba(96,165,250,0.1)');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(80, curY - 10, bw, 18, 4);
      ctx.fill();
      // City
      ctx.fillStyle = '#d1d5db';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(city, 28, curY + 3);
      // Count
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(count + '次', W - 28, curY + 3);
    });

    // ===== HOT ROUTES =====
    curY += 20;
    drawDivider(curY);
    curY += 22;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🔥 热门航线', 28, curY);
    curY += 8;
    const maxRc = topRoutes.length > 0 ? topRoutes[0][1] : 1;
    topRoutes.forEach(([route, count]) => {
      curY += 24;
      const bw = (count / maxRc) * (W - 155);
      const rGrad = ctx.createLinearGradient(80, 0, 80 + bw, 0);
      rGrad.addColorStop(0, 'rgba(251,191,36,0.6)');
      rGrad.addColorStop(1, 'rgba(251,191,36,0.1)');
      ctx.fillStyle = rGrad;
      ctx.beginPath();
      ctx.roundRect(80, curY - 10, bw, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#d1d5db';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(route, 28, curY + 3);
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'right';
      ctx.fillText(count + '次', W - 28, curY + 3);
    });

    // ===== HIGHLIGHTS =====
    curY += 24;
    drawDivider(curY);
    curY += 22;
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✨ 年度之最', 28, curY);

    const highlights = [];
    if (longestTrip) highlights.push(['最远一程', `${longestTrip.fromCity||'?'} → ${longestTrip.toCity||'?'} (${fmtDist(longestTrip.distance||0)})`]);
    if (topAirline) highlights.push(['常飞航司', `${AIRLINES[topAirline[0]]?.name||topAirline[0]} (${topAirline[1]}次)`]);
    if (firstTrip) highlights.push(['首次出行', fmtDateShort(firstTrip.date)]);
    highlights.push(['出行频率', `约每 ${Math.round(365/Math.max(trips.length,1))} 天一次`]);

    highlights.forEach(([label, val]) => {
      curY += 22;
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, 28, curY);
      ctx.fillStyle = '#d1d5db';
      ctx.textAlign = 'right';
      ctx.fillText(val, W - 28, curY);
    });

    // ===== FOOTER =====
    curY += 35;
    drawDivider(curY);
    curY += 20;
    ctx.fillStyle = '#4b5563';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('旅途纵横 · 记录每一次出发', W / 2, curY);
    curY += 14;
    ctx.fillStyle = '#374151';
    ctx.fillText(`生成于 ${new Date().toISOString().split('T')[0]}`, W / 2, curY);

    // ===== CROP to actual content height =====
    const finalH = Math.min(curY + 20, H);
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = W * dpr;
    finalCanvas.height = finalH * dpr;
    const fctx = finalCanvas.getContext('2d');
    fctx.drawImage(canvas, 0, 0);

    // Convert to blob and download
    finalCanvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `旅途纵横-${this.year}年报.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('分享图片已生成 📸');
    }, 'image/png');
  },

  _getAchievements(trips, flights, trains, totalKm, cities, airports) {
    const allTrips = Store.getAll(); // all-time for some achievements
    const allFlights = allTrips.filter(t => t.type === 'flight');
    const allCities = new Set();
    allTrips.forEach(t => { if (t.fromCity) allCities.add(t.fromCity); if (t.toCity) allCities.add(t.toCity); });
    
    // International flights (non-China airports)
    const intlCodes = new Set(['SIN','BKK','NRT','KIX','ICN','HKG','MFM','TPE','KUL','MNL','HND','CDG','LHR','JFK','LAX','SFO','SYD','DXB']);
    const hasIntl = flights.some(f => intlCodes.has(f.fromCode) || intlCodes.has(f.toCode));
    const allHasIntl = allFlights.some(f => intlCodes.has(f.fromCode) || intlCodes.has(f.toCode));
    
    // Unique airlines in year
    const yearAirlines = new Set(flights.map(f => f.airline).filter(Boolean));
    const allAirlines = new Set(allFlights.map(f => f.airline).filter(Boolean));
    // Big 3 China airlines
    const big3 = ['CA', 'MU', 'CZ'];
    const hasBig3 = big3.every(c => allAirlines.has(c));

    return [
      { icon: '🌍', name: '首次起飞', desc: '完成首次飞行', unlocked: allFlights.length >= 1 },
      { icon: '✈️', name: '飞行达人', desc: '年飞10次以上', unlocked: flights.length >= 10 },
      { icon: '🚄', name: '高铁先锋', desc: '年坐5次高铁', unlocked: trains.length >= 5 },
      { icon: '🌏', name: '国际旅行家', desc: '有国际航班', unlocked: allHasIntl },
      { icon: '🏙️', name: '城市探索者', desc: '到访10个城市', unlocked: allCities.size >= 10 },
      { icon: '📏', name: '万里长征', desc: '年飞行1万km', unlocked: totalKm >= 10000 },
      { icon: '🔥', name: '停不下来', desc: '年出行20次', unlocked: trips.length >= 20 },
      { icon: '🛫', name: '三大航集齐', desc: '坐过国航东航南航', unlocked: hasBig3 },
      { icon: '💼', name: '商务精英', desc: '坐过商务舱', unlocked: allFlights.some(f => f.seatClass === 'business' || f.seatClass === 'first') },
      { icon: '🌍', name: '环球旅行', desc: '累计4万km', unlocked: allTrips.reduce((s,t) => s + (t.distance||0), 0) >= 40000 },
    ];
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
        <div style="display:flex;gap:2px;min-width:320px">
          <div class="heatmap-weekdays" style="display:flex;flex-direction:column;gap:2px;font-size:8px;color:var(--text3);padding-right:3px;flex-shrink:0">
            <div style="aspect-ratio:1;display:flex;align-items:center;visibility:hidden">-</div>
            <div style="aspect-ratio:1;display:flex;align-items:center">一</div>
            <div style="aspect-ratio:1;display:flex;align-items:center;visibility:hidden">-</div>
            <div style="aspect-ratio:1;display:flex;align-items:center">三</div>
            <div style="aspect-ratio:1;display:flex;align-items:center;visibility:hidden">-</div>
            <div style="aspect-ratio:1;display:flex;align-items:center">五</div>
            <div style="aspect-ratio:1;display:flex;align-items:center;visibility:hidden">-</div>
          </div>
          <div style="flex:1;min-width:0">
            <div class="heatmap-grid" style="min-width:290px">${cells}</div>
          </div>
        </div>
        <div class="heatmap-months" style="min-width:320px;padding-left:16px">${monthLabels.map(m => `<span>${m}</span>`).join('')}</div>
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
