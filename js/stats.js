// ===== Statistics View v2 =====

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

    // Overview - only show non-zero rows
    {
      const overviewRows = [
        ['总行程', stats.totalTrips, '次', ''],
        ['✈️ 飞行', stats.flightCount, '次', 'var(--flight)'],
        ['🚄 高铁', stats.trainCount, '次', 'var(--train)'],
        ['🏙️ 到访城市', stats.cityCount, '个', ''],
        ['🛫 途经机场', stats.airportCount, '个', ''],
        ['🚉 途经车站', stats.stationCount, '个', ''],
        ['⏱️ 总旅途时间', stats.totalMins, '', ''],
      ].filter(([, val]) => val > 0);
      html += `<div class="stat-card">
        <h4>📋 出行概览</h4>
        ${overviewRows.map(([label, val, unit, color]) => {
          const display = label.includes('时间') ? fmtDuration(val) : val + ' ' + unit;
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
            <div class="bar-item">
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
            <div class="bar-item">
              <span class="bar-label">${AIRLINES[code]?.name || code}</span>
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
};
