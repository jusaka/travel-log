// ===== Statistics View =====

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
      <div style="display:flex;gap:20px;justify-content:center;margin-top:8px">
        <div style="text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--flight)">${fmtDist(stats.totalFlightKm)}</div>
          <div style="font-size:11px;color:var(--text2)">飞行里程</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:20px;font-weight:700;color:var(--train)">${fmtDist(stats.totalTrainKm)}</div>
          <div style="font-size:11px;color:var(--text2)">高铁里程</div>
        </div>
      </div>
    </div>`;

    // Overview stats
    html += `<div class="stat-card">
      <h4>📋 出行概览</h4>
      <div class="stat-row"><span class="stat-label">总行程</span><span class="stat-value">${stats.totalTrips} 次</span></div>
      <div class="stat-row"><span class="stat-label">✈️ 飞行</span><span class="stat-value">${stats.flightCount} 次</span></div>
      <div class="stat-row"><span class="stat-label">🚄 高铁</span><span class="stat-value">${stats.trainCount} 次</span></div>
      <div class="stat-row"><span class="stat-label">到访城市</span><span class="stat-value">${stats.cityCount} 个</span></div>
      <div class="stat-row"><span class="stat-label">途经机场</span><span class="stat-value">${stats.airportCount} 个</span></div>
      <div class="stat-row"><span class="stat-label">途经车站</span><span class="stat-value">${stats.stationCount} 个</span></div>
      <div class="stat-row"><span class="stat-label">总旅途时间</span><span class="stat-value">${fmtDuration(stats.totalMins)}</span></div>
    </div>`;

    // Earth comparison
    const earthCircumference = 40075;
    const earthRounds = (stats.totalKm / earthCircumference).toFixed(1);
    const moonDist = 384400;
    const moonPct = ((stats.totalKm / moonDist) * 100).toFixed(1);
    html += `<div class="stat-card">
      <h4>🌍 趣味对比</h4>
      <div class="stat-row"><span class="stat-label">绕地球</span><span class="stat-value">${earthRounds} 圈</span></div>
      <div class="stat-row"><span class="stat-label">到月球</span><span class="stat-value">${moonPct}%</span></div>
    </div>`;

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
                <div class="bar-fill flight" style="width:${(count/maxCount*100).toFixed(0)}%"></div>
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
                <div class="bar-fill train" style="width:${(count/maxCount*100).toFixed(0)}%"></div>
                <span class="bar-count">${count}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    // Monthly heatmap for current year
    const now = new Date();
    const yearTrips = Store.getByYear(now.getFullYear());
    if (yearTrips.length > 0) {
      const monthlyCounts = new Array(12).fill(0);
      yearTrips.forEach(t => {
        const m = new Date(t.date).getMonth();
        monthlyCounts[m]++;
      });
      const maxM = Math.max(...monthlyCounts, 1);
      const months = ['1','2','3','4','5','6','7','8','9','10','11','12'];
      html += `<div class="stat-card">
        <h4>📅 ${now.getFullYear()}年月度出行</h4>
        <div style="display:flex;gap:6px;align-items:flex-end;height:80px;padding:0 4px">
          ${monthlyCounts.map((c, i) => {
            const h = c > 0 ? Math.max(10, (c / maxM) * 70) : 4;
            const color = c > 0 ? 'var(--accent)' : 'var(--bg3)';
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="font-size:10px;color:var(--text2)">${c||''}</div>
              <div style="width:100%;height:${h}px;background:${color};border-radius:2px"></div>
              <div style="font-size:9px;color:var(--text3)">${months[i]}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    grid.innerHTML = html;
  },
};
